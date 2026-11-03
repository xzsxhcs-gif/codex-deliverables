"""Real Chromium/WebGL integration checks. Development fixture only seeds a legitimate merge.

The full win uses an aim-and-move bot through PlayerController/BattleInput and real
bubbles; it never assigns boss HP or calls damageBoss. Fast-forward temporarily
skips GPU submission only; the same update/physics/projectile logic still runs.
"""
import asyncio
import json
import math
import hashlib
import os
from pathlib import Path
from datetime import datetime, timezone
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parent
OUT=ROOT/'results'
OUT.mkdir(exist_ok=True)
BASE=os.environ.get('BASE_URL','http://127.0.0.1:5180')
REPORT={'started':datetime.now(timezone.utc).isoformat(),'base':BASE,'browser':'Chromium / ANGLE SwiftShader','checks':[],'errors':[],'fixtures':[
 'Preload known old save records to verify backwards-compatible localStorage keys.',
 'seedKingMerge supplies two level-six bodies to the real collision/merge code; no synthetic boss event.',
 'Defeat test uses a combat bot that deliberately stands in real telegraphed strikes; health is not assigned.',
 'Victory uses actual Bubble Scepter projectiles, controller aiming, and movement inputs; no direct damageBoss or HP writes.',
 'Fast-forward runs ordinary fixed-step game updates with GPU submissions temporarily suppressed; screenshots restore the renderer.',
 'Mobile touch checks use Chromium mobile emulation, not a physical Android/iPhone.'
]}


def check(name,success,detail=None):
    item={'name':name,'passed':bool(success)}
    if detail is not None:item['detail']=detail
    REPORT['checks'].append(item)
    print(('PASS ' if success else 'FAIL ')+name,flush=True)
    if not success:
        raise AssertionError(f'{name}: {detail}')


async def screenshot(page,name):
    await page.screenshot(path=str(OUT/f'{name}.png'))


async def snapshot(page):
    return await page.evaluate('window.clawdQA.runtime()?.snapshot()')


async def fast(page,seconds,extra=''):
    return await page.evaluate('''({seconds,extra})=>{
      const r=window.clawdQA.runtime();if(!r)throw Error('No battle runtime');
      const original=r.render;r.render=()=>{};
      try{
        if(extra)Function('r',extra)(r);
        for(let t=0;t<seconds;t+=1/60)r.tick(1/60);
      }finally{r.render=original;if(window.clawdQA.runtime()===r)r.tick(0);}
      return r.snapshot();
    }''',{'seconds':seconds,'extra':extra})


async def wait_screen(page,kind,timeout=30000):
    await page.locator(f'#boss-screen[data-screen="{kind}"]').wait_for(state='visible',timeout=timeout)


async def enter_from_merge(page):
    await page.evaluate('window.clawd2D.testing.seedKingMerge()')
    await page.wait_for_function("window.clawdQA.mode()==='TRANSITION_TO_BOSS'",timeout=10000)
    before=await page.evaluate('window.clawd2D.summary()')
    await wait_screen(page,'ready')
    return before


async def enter_replay(page):
    await page.locator('#cb').click()
    await page.locator('#royal-replay').click()
    await wait_screen(page,'ready')


async def click_start(page):
    await page.locator('#boss-start').click()
    await page.wait_for_function("window.clawdQA.runtime() && !window.clawdQA.runtime().paused")
    await page.locator('#boss-screen').wait_for(state='hidden')


async def run_desktop(browser):
    context=await browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1,locale='en-US')
    page=await context.new_page()
    unexpected=[]
    page.on('pageerror',lambda e:unexpected.append(str(e)))
    page.on('console',lambda m:unexpected.append(m.text+' '+json.dumps(m.location)) if m.type=='error' else None)
    await page.goto(BASE,wait_until='networkidle')
    await page.evaluate("localStorage.setItem('sc_best','765');localStorage.setItem('sc_disc','5');localStorage.setItem('sc_ach','2');localStorage.setItem('sc_lang','zh');localStorage.removeItem('sc_boss_unlocked');localStorage.removeItem('sc_kingslayer')")
    await page.reload(wait_until='networkidle')
    await page.wait_for_function('window.clawd2D && window.clawdQA')
    check('2D starts in original merging mode',await page.evaluate("window.clawdQA.mode()==='MERGING' && !window.clawd2D.bossActive"))
    check('Old high score, collection, achievements and Chinese language survive',await page.evaluate("window.clawd2D.summary().best===765 && window.clawd2D.summary().discovered===5 && window.clawd2D.summary().achievements===2 && document.documentElement.lang==='zh-CN'"))
    await page.locator('#lang').click()
    check('Language switch preserves bilingual UI',await page.evaluate("document.documentElement.lang==='en' && document.getElementById('hint').textContent.startsWith('Drag')"))
    await page.locator('#lang').click()
    await page.locator('#mute').click()
    check('Original mute control remains functional',await page.evaluate('window.clawd2D.isMuted()'))
    await screenshot(page,'01-original-merging')
    canvas=page.locator('#c');box=await canvas.bounding_box()
    await page.mouse.click(box['x']+box['width']*.45,box['y']+box['height']*.25)
    await page.wait_for_function('window.clawd2D.summary().bodies.length>0')
    check('Original pointer drop adds a real physical body',await page.evaluate('window.clawd2D.summary().bodies.length>0'))
    await page.evaluate('window.clawd2D.testing.seedOrdinaryMerge()')
    await page.wait_for_function('window.clawd2D.summary().score>0')
    check('Ordinary merge still scores without starting boss',await page.evaluate("window.clawdQA.mode()==='MERGING' && window.clawd2D.summary().bodies.some(b=>b.lv===1)"))
    before=await enter_from_merge(page)
    check('Two penultimate bodies trigger one real King merge',before['score']>=70 and any(b['lv']==7 for b in before['bodies']),before)
    check('King freezes original board and unlocks replay',await page.evaluate("window.clawd2D.bossActive && window.clawd2D.summary().paused && localStorage.getItem('sc_boss_unlocked')==='1'"))
    check('Exactly one battle renderer created',await page.locator('.boss-scene canvas').count()==1)
    await screenshot(page,'02-ready')
    await click_start(page)
    check('Start is a real user-gesture entry into FPS',not (await snapshot(page))['paused'])
    await fast(page,2.8)
    await screenshot(page,'03-first-person')
    state=await snapshot(page)
    await page.keyboard.down('w');await page.keyboard.down('Shift')
    await page.wait_for_function('window.clawdQA.runtime().player.state.speed>8 && window.clawdQA.runtime().player.state.z<14.5',timeout=20000)
    running=await snapshot(page)
    check('WASD and sprint move the actual player',running['player']['z']<state['player']['z']-.25 and running['player']['speed']>6,{'before':state['player'],'after':running['player']})
    await page.keyboard.down('Control')
    await page.wait_for_function('window.clawdQA.runtime().player.state.sliding',timeout=3000)
    slide=await snapshot(page)
    check('Ctrl initiates momentum-preserving slide',slide['player']['sliding'] and slide['player']['speed']>5)
    await page.keyboard.press('Space')
    await page.wait_for_function('window.clawdQA.runtime().player.state.y>0.15',timeout=3000)
    jumping=await snapshot(page)
    check('Slide jump genuinely leaves ground',jumping['player']['y']>.15 and not jumping['player']['grounded'])
    await page.keyboard.up('Control');await page.keyboard.up('Shift');await page.keyboard.up('w')
    await page.wait_for_timeout(400)
    await page.keyboard.press('Escape')
    await wait_screen(page,'pause')
    paused=await snapshot(page)
    await page.wait_for_timeout(300)
    stopped=await snapshot(page)
    check('Escape pause freezes encounter time and releases capture',stopped['paused'] and abs(paused['elapsed']-stopped['elapsed'])<.001 and not stopped['locked'])
    await screenshot(page,'04-pause')
    await page.locator('#boss-volume').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight')
    await click_start(page)
    check('Resume restores playable encounter',not (await snapshot(page))['paused'])
    # Actual aim/cast path: place no test damage and aim using controller API.
    shot_state=await page.evaluate('''()=>{const r=window.clawdQA.runtime(),p=r.player.state,b=r.boss.state;const dx=b.x-p.x,dz=b.z-p.z;r.player.setOrientation(Math.atan2(-dx,-dz),Math.atan2(3.1-(p.y+1.65),Math.hypot(dx,dz)));return r.snapshot();}''')
    await page.mouse.down();await page.wait_for_function('(initialHits)=>window.clawdQA.runtime().snapshot().hits>initialHits',arg=shot_state['hits'],timeout=20000);await page.mouse.up()
    after_shots=await snapshot(page)
    check('Mouse attack launches colliding bubbles and deals boss damage',after_shots['shots']>shot_state['shots'] and after_shots['hits']>shot_state['hits'] and after_shots['boss']['health']<shot_state['boss']['health'],{'shots':after_shots['shots'],'hits':after_shots['hits'],'health':after_shots['boss']['health']})
    # Capture each actual telegraph while a non-shooting movement bot evades hazards.
    seen_attacks=[]
    for index in range(3):
        telegraph=await page.evaluate('''(seen)=>{
          const r=window.clawdQA.runtime(),render=r.render;r.render=()=>{};
          r.input.disable();r.paused=false;
          let found=null;
          try{for(let i=0;i<60*60&&r.boss.playerHealth>0;i++){
            const p=r.player.state,b=r.boss.state,t=r.elapsed;
            const dx=b.x-p.x,dz=b.z-p.z;r.player.setOrientation(Math.atan2(-dx,-dz),Math.atan2(3.1-(p.y+1.65),Math.hypot(dx,dz)));
            const tx=Math.sin(t*.38)*17,tz=Math.cos(t*.38)*17,mx=tx-p.x,mz=tz-p.z,d=Math.max(1,Math.hypot(mx,mz)),wx=mx/d,wz=mz/d;
            r.input.moveTouch(wx*Math.cos(p.yaw)-wz*Math.sin(p.yaw),-wx*Math.sin(p.yaw)-wz*Math.cos(p.yaw));r.tick(1/60);
            if(b.stage==='windup'&&b.elapsed>.35&&!seen.includes(b.attack)){found={attack:b.attack,state:r.snapshot()};break;}
          }}finally{r.pause();r.render=render;r.tick(0);}
          return found;
        }''',seen_attacks)
        check('Readable real telegraph '+str(index+1),bool(telegraph),telegraph)
        seen_attacks.append(telegraph['attack'])
        await screenshot(page,'attack-'+telegraph['attack'])
        if telegraph['attack']=='barrage':
            barrage=await page.evaluate('''()=>{
              const r=window.clawdQA.runtime(),render=r.render;r.render=()=>{};r.paused=false;
              try{for(let i=0;i<150;i++){r.tick(1/60);if(r.boss.state.stage==='execute'&&r.boss.state.elapsed>.55)break;}}
              finally{r.pause();r.render=render;r.tick(0);}
              return r.snapshot();
            }''')
            check('Barrage produces visible live projectiles',barrage['enemyBubbles']>0,barrage['enemyBubbles'])
            await screenshot(page,'attack-barrage-projectiles')
    check('All three telegraphs inspected',set(seen_attacks)=={'charge','slam','barrage'})
    # Deliberate-loss bot follows telegraphed slam centers and stays in charge lanes.
    loss=await page.evaluate('''()=>{
      const r=window.clawdQA.runtime();r.input.disable();r.paused=false;
      const render=r.render;r.render=()=>{};const seen=[];
      try{for(let t=0;t<150&&r.boss.playerHealth>0;t+=1/60){
        const b=r.boss.state;
        if(b.stage==='windup'||b.stage==='execute'){
          if(b.attack==='slam')r.player.teleport(b.target.x,0,b.target.z);
          else if(b.attack==='charge')r.player.teleport((b.origin.x+b.target.x)/2,0,(b.origin.z+b.target.z)/2);
        }
        r.tick(1/60);
        if(!seen.includes(b.attack))seen.push(b.attack);
      }}finally{r.render=render;r.tick(0);}
      return{snapshot:r.snapshot(),attacks:seen};
    }''')
    await wait_screen(page,'defeat')
    check('Real boss hazards can defeat player with no HP assignment',loss['snapshot']['playerHealth']<=0,loss)
    await screenshot(page,'05-defeat')
    await page.locator('#boss-retry').click();await wait_screen(page,'ready')
    retry=await snapshot(page)
    check('Defeat retry resets battle without repeating merging',retry['playerHealth']==100 and retry['boss']['health']==retry['boss']['maxHealth'] and retry['elapsed']==0 and await page.locator('.boss-scene canvas').count()==1)
    await click_start(page)
    # Real projectile win, controller-aiming and circular movement. Only rendering is skipped.
    victory=await page.evaluate('''()=>{
      const r=window.clawdQA.runtime();r.input.disable();r.paused=false;
      const render=r.render;r.render=()=>{};let seen=new Set(),minHp=100;
      try{
       for(let t=0;t<180&&r.boss.state.stage!=='defeated'&&r.boss.playerHealth>0;t+=1/60){
        const p=r.player.state,b=r.boss.state;const dx=b.x-p.x,dz=b.z-p.z;
        r.player.setOrientation(Math.atan2(-dx,-dz),Math.atan2(3.1-(p.y+(p.crouching?1.03:1.65)),Math.hypot(dx,dz)));
        const angle=t*.38,tx=Math.sin(angle)*17,tz=Math.cos(angle)*17;
        const mx=tx-p.x,mz=tz-p.z,d=Math.max(1,Math.hypot(mx,mz));
        const wx=mx/d,wz=mz/d;
        r.input.moveTouch(wx*Math.cos(p.yaw)-wz*Math.sin(p.yaw),-wx*Math.sin(p.yaw)-wz*Math.cos(p.yaw));
        if(b.attack==='slam'&&b.stage==='windup'&&b.elapsed>b.duration-.2)r.input.jumpTouch();
        r.input.firing=true;r.tick(1/60);seen.add(b.attack+':'+b.phase);minHp=Math.min(minHp,r.boss.playerHealth);
       }
      }finally{r.input.firing=false;r.input.moveTouch(0,0);r.render=render;r.tick(0);}
      window.__finishedRuntime=r;window.__winStats={snapshot:r.snapshot(),patterns:[...seen],minHp};return window.__winStats;
    }''')
    REPORT['combat_bot']=victory
    check('Aiming/moving bot wins via real bubble collisions',victory['snapshot']['boss']['stage']=='defeated' and victory['snapshot']['hits']>=200 and victory['snapshot']['playerHealth']>0,victory)
    check('All three attacks and second phase occurred during genuine fight',all(any(p.startswith(a+':') for p in victory['patterns']) for a in ['charge','slam','barrage']) and any(p.endswith(':2') for p in victory['patterns']),victory['patterns'])
    await screenshot(page,'06-king-defeated')
    await page.wait_for_function("window.clawdQA.mode()==='MERGING'",timeout=30000)
    after=await page.evaluate('window.clawd2D.summary()')
    check('Victory returns to original 2D game with score and records preserved',after['score']==before['score'] and after['best']>=before['best'] and (after['discovered']&before['discovered'])==before['discovered'] and any(b['lv']==7 for b in after['bodies']),{'before':before,'after':after})
    check('Victory achievement is persisted separately from old records',await page.evaluate("localStorage.getItem('sc_kingslayer')==='1' && window.clawd2D.kingslayer && !document.querySelector('.royal-trophy').hidden"))
    check('Returning disposes 3D canvas and unfreezes 2D input',await page.locator('.boss-scene canvas').count()==0 and not after['paused'] and not await page.evaluate('window.clawd2D.bossActive'))
    check('Disposed runtime releases its renderer and detached canvas',await page.evaluate('window.__finishedRuntime.diagnostics().disposed && !document.contains(window.__finishedRuntime.renderer.domElement)'))
    await screenshot(page,'07-returned-with-reward')
    body_count=len(after['bodies'])
    await page.locator('#c').click(position={'x':80,'y':90})
    await page.wait_for_function('(count)=>window.clawd2D.summary().bodies.length>count',arg=body_count)
    check('A fresh 2D drop works after winning the boss',len((await page.evaluate('window.clawd2D.summary()'))['bodies'])>body_count)
    await page.reload(wait_until='networkidle')
    check('Reload retains old best, Kingslayer and replay unlock',await page.evaluate("window.clawd2D.summary().best>=765 && window.clawd2D.kingslayer && localStorage.getItem('sc_boss_unlocked')==='1'"))
    await enter_replay(page)
    check('Unlocked replay enters encounter without additional King merge',await page.evaluate("window.clawdQA.mode()==='BOSS_BATTLE'") and await page.locator('.boss-scene canvas').count()==1)
    # Context-loss handler on an actual WebGL canvas; the browser context itself need not die.
    await page.evaluate("window.clawdQA.runtime().renderer.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true}))")
    await wait_screen(page,'error')
    check('Context loss surfaces a recoverable screen', (await snapshot(page))['paused'])
    await screenshot(page,'08-webgl-error')
    await page.locator('#boss-return').click()
    await page.wait_for_function("window.clawdQA.mode()==='MERGING'")
    check('Error return preserves usable merging game',await page.locator('.boss-scene canvas').count()==0 and not await page.evaluate('window.clawd2D.summary().paused'))
    check('No unexpected browser or shader errors',not unexpected,unexpected)
    REPORT['errors'].extend(unexpected)
    await context.close()


async def run_fallback(browser):
    context=await browser.new_context(viewport={'width':1024,'height':720},reduced_motion='reduce')
    page=await context.new_page()
    await page.add_init_script("HTMLCanvasElement.prototype.requestPointerLock=function(){return Promise.reject(new DOMException('QA denied','NotAllowedError'))}")
    await page.goto(BASE,wait_until='networkidle')
    await page.evaluate("localStorage.setItem('sc_boss_unlocked','1');localStorage.setItem('sc_lang','en')")
    await page.reload(wait_until='networkidle');await enter_replay(page);await click_start(page)
    await page.locator('#boss-capture-hint').wait_for(state='visible')
    before=await snapshot(page)
    canvas=page.locator('.boss-scene canvas');box=await canvas.bounding_box()
    await page.mouse.move(box['width']*.5,box['height']*.5);await page.mouse.down();await page.mouse.move(box['width']*.5+90,box['height']*.5-35,steps=6);await page.mouse.up()
    after=await snapshot(page)
    check('Denied pointer lock provides actual click-drag aiming fallback',not after['locked'] and abs(after['player']['yaw']-before['player']['yaw'])>.05)
    await page.keyboard.press('Escape');await wait_screen(page,'pause')
    check('Esc pauses fallback controls', (await snapshot(page))['paused'])
    await page.locator('#boss-return').click();await page.wait_for_function("window.clawdQA.mode()==='MERGING'")
    await context.close()


async def run_mobile(browser):
    context=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True,locale='zh-CN',reduced_motion='reduce')
    page=await context.new_page();await page.goto(BASE,wait_until='networkidle')
    await page.evaluate("localStorage.setItem('sc_boss_unlocked','1');localStorage.setItem('sc_lang','zh')")
    await page.reload(wait_until='networkidle');await enter_replay(page);await click_start(page)
    await fast(page,2.6)
    check('Mobile viewport has no horizontal overflow',await page.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
    check('Mobile movement, aim and combat controls are visible',all([await page.locator(s).is_visible() for s in ['#boss-stick','#boss-aim-zone','#boss-touch-fire','#boss-touch-jump','#boss-touch-slide']]))
    await screenshot(page,'09-mobile-battle')
    # CDP touch events emulate a real touch pointer rather than mouse events.
    client=await context.new_cdp_session(page)
    stick=await page.locator('#boss-stick').bounding_box();sx=stick['x']+stick['width']/2;sy=stick['y']+stick['height']/2
    before=await snapshot(page)
    await client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':sx,'y':sy,'id':1}]})
    await client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':sx+12,'y':sy-35,'id':1}]})
    await page.wait_for_timeout(500)
    await client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    moved=await snapshot(page)
    check('Touch joystick drives first-person movement',math.hypot(moved['player']['x']-before['player']['x'],moved['player']['z']-before['player']['z'])>.3)
    aim=await page.locator('#boss-aim-zone').bounding_box();ax=aim['x']+aim['width']*.35;ay=aim['y']+aim['height']*.4
    before=await snapshot(page)
    await client.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':ax,'y':ay,'id':2}]})
    await client.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':ax+45,'y':ay-15,'id':2}]})
    await client.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
    aimed=await snapshot(page)
    check('Touch aim zone rotates actual camera',abs(aimed['player']['yaw']-before['player']['yaw'])>.05)
    await page.locator('#boss-touch-jump').tap()
    await page.wait_for_function('window.clawdQA.runtime().player.state.y>0.1')
    check('Mobile jump button has real gameplay effect',(await snapshot(page))['player']['y']>.1)
    await page.set_viewport_size({'width':844,'height':390});await page.wait_for_timeout(250)
    check('Rotation resizes canvas without overflow',await page.evaluate('document.documentElement.scrollWidth<=window.innerWidth && Math.abs(window.clawdQA.runtime().camera.aspect-window.innerWidth/window.innerHeight)<.02'))
    await screenshot(page,'10-mobile-landscape')
    await page.locator('#boss-pause').tap();await wait_screen(page,'pause');await page.locator('#boss-return').tap();await page.wait_for_function("window.clawdQA.mode()==='MERGING'")
    check('Mobile can leave battle and resume normal game',await page.locator('.boss-scene canvas').count()==0)
    await context.close()


async def main():
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch(executable_path=os.environ.get('BROWSER_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
            for task in [run_desktop,run_fallback,run_mobile]:
                try:await task(browser)
                except Exception as exc:
                    REPORT['checks'].append({'name':task.__name__+' completed','passed':False,'error':str(exc)})
                    print('SCENARIO ERROR',task.__name__,str(exc),flush=True)
                finally:
                    for remaining in browser.contexts:await remaining.close()
            await browser.close()
    finally:
        REPORT['source_sha256']={str(path.relative_to(ROOT.parent)):hashlib.sha256(path.read_bytes()).hexdigest() for path in sorted([*list((ROOT.parent/'src').rglob('*.ts')),*list((ROOT.parent/'src').rglob('*.js')),*list((ROOT.parent/'src').rglob('*.css')),ROOT.parent/'index.html',ROOT.parent/'package-lock.json',ROOT.parent/'vite.config.ts'])}
        REPORT['finished']=datetime.now(timezone.utc).isoformat()
        REPORT['passed']=sum(c['passed'] for c in REPORT['checks'])
        REPORT['total']=len(REPORT['checks'])
        (OUT/'browser-report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
        print(f"RESULT {REPORT['passed']}/{REPORT['total']}",flush=True)
    if REPORT['passed']!=REPORT['total']:raise SystemExit(1)

if __name__=='__main__':asyncio.run(main())
