"""Browser acceptance checks using real WebGL rendering; no particular FPS is promised."""
from __future__ import annotations
import hashlib, json, math, os, time, traceback
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:5173').rstrip('/')
DEFAULT_OUT = Path('/workspace/output/glsl-hills/qa') if Path('/workspace/output').is_dir() else ROOT/'verification'/'browser'
OUT = Path(os.environ.get('OUTPUT_DIR', str(DEFAULT_OUT)))
OUT.mkdir(parents=True, exist_ok=True)
checks = []
errors = []
artifacts = []
contexts = []

def source_hashes():
    return {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted((ROOT/'src').rglob('*')) if p.is_file()}

start_hashes = source_hashes()

def check(name, operation):
    try:
        detail = operation()
        checks.append({'name': name, 'passed': True, 'detail': detail})
        print('PASS:', name, flush=True)
        return detail
    except Exception as exc:
        checks.append({'name': name, 'passed': False, 'detail': str(exc)[:1400]})
        print('FAIL:', name, str(exc)[:500], flush=True)
        return None

def demand(condition, message):
    if not condition: raise AssertionError(message)

def diag(page): return page.evaluate('window.__GLSL_HILLS__?.getDiagnostics()')
def state(page): return page.evaluate('window.__GLSL_HILLS__?.getSettings()')
def stats(page): return page.evaluate("""async () => { const resource=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/lib/landscape-engine.ts'); return (await import(resource?.name ?? '/src/lib/landscape-engine.ts')).getLiveLandscapeStats(); }""")

def ready(page):
    page.wait_for_selector('[data-landscape-status="ready"]', timeout=60000)
    page.wait_for_function('window.__GLSL_HILLS__?.getDiagnostics()?.frames > 0', timeout=20000)

def screenshot(page, name):
    path = OUT/name
    page.screenshot(path=str(path), full_page=False)
    artifacts.append(name)
    return path

def open_panel(page):
    if page.get_by_role('region', name='Landscape settings').count() == 0:
        page.get_by_role('button', name='Open landscape settings', exact=True).click()
    page.get_by_role('region', name='Landscape settings').wait_for(state='visible')

def close_panel(page):
    if page.get_by_role('region', name='Landscape settings').count():
        page.get_by_role('button', name='Close landscape settings', exact=True).click()

def pause(page):
    if not state(page)['paused']:
        page.locator('.header-actions').get_by_role('button', name='Pause motion', exact=True).click()
    page.wait_for_function('window.__GLSL_HILLS__.getSettings().paused === true')
    page.wait_for_function('window.__GLSL_HILLS__.getDiagnostics().paused === true')

def reset(page):
    open_panel(page)
    page.get_by_role('button', name='Reset settings', exact=True).click()
    page.wait_for_function('window.__GLSL_HILLS__.getSettings().speed === .5 && window.__GLSL_HILLS__.getSettings().terrainHeight === 1')

def slider(page, label, key):
    open_panel(page)
    item=page.get_by_role('slider', name=label, exact=True)
    item.focus();item.press(key)
    return item

def uniform(page, name):
    return page.evaluate('''name => {
      const canvas=document.querySelector('canvas');
      const gl=canvas?.getContext('webgl2');if(!gl)return null;
      const p=gl.getParameter(gl.CURRENT_PROGRAM);if(!p)return null;
      const location=gl.getUniformLocation(p,name);if(!location)return null;
      const v=gl.getUniform(p,location);return typeof v === 'number' ? v : Array.from(v);
    }''', name)

def distance(a,b): return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))

def wait_uniform(page, name, goal, tolerance=.015):
    until=time.monotonic()+14
    while time.monotonic()<until:
        actual=uniform(page,name)
        if isinstance(actual,(int,float)) and abs(actual-goal)<tolerance:return actual
        page.wait_for_timeout(100)
    raise AssertionError(f'{name} did not converge to {goal}: {uniform(page,name)}')
def listen(page, expected=False):
    page.on('pageerror', lambda e: errors.append({'page':page.url, 'kind':'pageerror', 'message':str(e), 'expected':expected}))
    page.on('console', lambda m: errors.append({'page':page.url,'kind':'console.error','message':m.text,'expected':expected}) if m.type=='error' else None)
    page.set_default_timeout(9000)

report={'started_at_utc':datetime.now(timezone.utc).isoformat(),'base_url':BASE,
 'environment':'Headless Chromium on Linux using ANGLE SwiftShader software WebGL. Mobile tests use Chromium touch/device emulation, not physical phones or Safari.',
 'checks':checks,'screenshots':artifacts,'console':errors,
 'limitations':['No physical mobile device or Safari run was performed.','Visibility-event suppression is simulated explicitly; it does not measure OS background throttling.','Lifecycle counters and DOM removal are observed, not a GPU-driver heap audit.']}

with sync_playwright() as p:
    browser_path=os.environ.get('BROWSER_PATH') or ('/usr/bin/chromium' if Path('/usr/bin/chromium').is_file() else None)
    browser=p.chromium.launch(executable_path=browser_path,headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    try:
        desktop=browser.new_context(viewport={'width':1280,'height':800},device_scale_factor=1)
        contexts.append(desktop);page=desktop.new_page();listen(page)
        page.goto(BASE,wait_until='networkidle');ready(page)
        initial=diag(page)
        report['renderer']=page.evaluate('''() => {const gl=document.querySelector('canvas').getContext('webgl2');const d=gl.getExtension('WEBGL_debug_renderer_info');return d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)}''')
        def initial_render():
            demand(initial['drawCalls']==1 and initial['frames']>0,'Terrain did not make its expected draw call')
            image=Image.open(screenshot(page,'desktop-monochrome.png')).convert('RGB')
            roi=image.crop((60,320,800,680));s=ImageStat.Stat(roi)
            demand(max(s.stddev)>2,'Terrain region is visually uniform/blank')
            return {'diagnostics':initial,'terrain_region_rgb_stddev':s.stddev,'live_resources':stats(page)}
        check('Initial terrain renders with one live Strict Mode engine',initial_render)
        check('Exact title, subtitle and initially collapsed settings',lambda: (
            demand(page.get_by_role('heading',name='GLSL HILLS',exact=True).is_visible(),'Title missing'),
            demand(page.get_by_text('An interactive generative landscape',exact=True).is_visible(),'Subtitle missing'),
            demand(page.get_by_role('region',name='Landscape settings').count()==0,'Settings initially cover artwork'),
            demand(stats(page)['activeEngines']==1,f'Unexpected live engine stats: {stats(page)}')))
        def animation():
            a=diag(page);page.wait_for_timeout(450);b=diag(page)
            demand(b['time']>a['time'] and b['frames']>a['frames'],'Animation did not advance')
            return {'before':a['time'],'after':b['time'],'frame_delta':b['frames']-a['frames']}
        check('Time-driven animation advances',animation)
        open_panel(page)
        def accessible_controls():
            for label in ['Motion speed','Terrain height','Detail']:
                item=page.get_by_role('slider',name=label,exact=True)
                demand(item.count()==1 and item.get_attribute('aria-valuenow') is not None,f'Unlabeled slider: {label}')
            demand(page.get_by_role('radio').count()==3,'Theme choices missing')
            screenshot(page,'desktop-controls.png')
            return {'slider_labels':['Motion speed','Terrain height','Detail']}
        check('Settings expose labeled keyboard sliders and three themes',accessible_controls)
        def paused():
            pause(page);page.wait_for_timeout(1100)
            a=diag(page);page.wait_for_timeout(400);b=diag(page)
            demand(abs(b['time']-a['time'])<1e-8,'Paused terrain time still changes')
            return {'time_before':a['time'],'time_after':b['time'],'resources':stats(page)}
        check('Pause freezes terrain time without resetting phase',paused)
        def themes():
            before_id=diag(page)['rendererId'];measurements=[]
            for label,key in [('Glacier','glacier'),('Dusk','dusk'),('Monochrome','monochrome')]:
                start=uniform(page,'uBaseColor');radio=page.get_by_role('radio',name=label,exact=True)
                radio.locator('xpath=..').click()
                page.wait_for_function('(theme) => window.__GLSL_HILLS__.getSettings().theme === theme',arg=key)
                middle=uniform(page,'uBaseColor')
                page.wait_for_timeout(850);end=uniform(page,'uBaseColor')
                demand(start is not None and end is not None and distance(start,end)>0.0001,'Theme did not update shader palette')
                demand(distance(start,middle)<distance(start,end)*.99,'Theme jumped immediately to its final palette')
                demand(diag(page)['rendererId']==before_id,'Theme recreated renderer')
                screenshot(page,f'theme-{key}.png')
                measurements.append({'theme':key,'start':start,'first_sample':middle,'settled':end})
            return measurements
        check('All palettes transition through uniforms with renderer reuse',themes)
        def sliders():
            renderer_id=diag(page)['rendererId']
            for label,field,expected,name in [('Terrain height','terrainHeight',1.7,'uAmplitude'),('Detail','detail',1.5,'uFineDetail')]:
                item=slider(page,label,'End');wait_uniform(page,name,expected)
                demand(abs(state(page)[field]-expected)<.001,f'{label} UI did not reach upper bound')
                actual=uniform(page,name);demand(actual is not None and abs(actual-expected)<.02,f'{label} did not reach actual shader upper bound: {actual}')
                demand(float(item.get_attribute('aria-valuenow'))==expected,f'{label} displayed value missing')
            demand(diag(page)['rendererId']==renderer_id,'Slider recreated renderer')
            return {'renderer_id':renderer_id,'height_shader':uniform(page,'uAmplitude'),'detail_shader':uniform(page,'uFineDetail')}
        check('Height and detail reach real shader bounds without renderer recreation',sliders)
        def zero_speed():
            reset(page);slider(page,'Motion speed','Home');page.wait_for_timeout(300)
            a=diag(page);page.wait_for_timeout(350);b=diag(page)
            demand(state(page)['speed']==0 and abs(a['time']-b['time'])<1e-8,'Zero speed failed to freeze')
            slider(page,'Motion speed','End');page.wait_for_timeout(400)
            c=diag(page);demand(c['time']>b['time'] and c['speed']==1.5,'Resuming speed failed')
            return {'zero_time':a['time'],'unchanged_time':b['time'],'resumed_time':c['time']}
        check('Zero speed freezes and keyboard speed adjustment resumes',zero_speed)
        def resets():
            reset(page);s=state(page)
            demand(s=={'theme':'monochrome','speed':.5,'terrainHeight':1,'detail':.55,'paused':False},f'Reset settings incorrect: {s}')
            return s
        check('Reset settings restores the original appearance and motion',resets)
        def camera():
            open_panel(page);page.get_by_role('button',name='Reset view',exact=True).click()
            page.wait_for_function('()=>{const c=window.__GLSL_HILLS__.getDiagnostics().camera;return Math.abs(c.yaw)<.003 && Math.abs(c.distance-Math.hypot(65,143))<.5}',timeout=14000)
            close_panel(page);pause(page)
            canvas=page.locator('canvas');box=canvas.bounding_box();x=box['width']*.48;y=box['height']*.55
            base=diag(page)['camera'];page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+210,y+70,steps=10);page.mouse.up();page.wait_for_timeout(650)
            dragged=diag(page)['camera'];demand(abs(dragged['yaw']-base['yaw'])>.04,'Drag did not orbit')
            page.mouse.wheel(0,-550);page.wait_for_timeout(650);zoomed=diag(page)['camera']
            demand(zoomed['distance']<dragged['distance'],'Wheel did not zoom in')
            demand(abs(zoomed['yaw'])<=.401 and .29<=zoomed['pitch']<=.9,'Camera outside bounded orbit')
            open_panel(page);page.get_by_role('button',name='Reset view',exact=True).click();page.wait_for_function('(base)=>{const c=window.__GLSL_HILLS__.getDiagnostics().camera;return Math.abs(c.yaw)<.004 && Math.abs(c.distance-base.distance)<.7}',arg=base,timeout=14000)
            restored=diag(page)['camera'];demand(abs(restored['yaw'])<.004 and abs(restored['distance']-base['distance'])<.7,'Reset view did not settle at original view')
            return {'base':base,'dragged':dragged,'zoomed':zoomed,'restored':restored}
        check('Drag, zoom and smooth Reset View operate within bounds',camera)
        def immersive():
            close_panel(page);page.get_by_role('button',name='Enter immersive mode',exact=True).click();page.wait_for_selector('[data-immersive="true"]')
            page.wait_for_function("document.querySelector('.interface').inert && getComputedStyle(document.querySelector('.interface')).visibility === 'hidden'")
            native=page.evaluate('!!document.fullscreenElement');page.wait_for_timeout(2800);screenshot(page,'desktop-immersive.png')
            page.keyboard.press('Escape');page.wait_for_selector('[data-immersive="false"]')
            demand(page.get_by_role('button',name='Enter immersive mode',exact=True).is_visible(),'Escape did not restore controls')
            return {'native_fullscreen_entered':native,'escape_restores':True}
        check('Immersive mode hides interface and Escape restores it',immersive)
        def fullscreen_fallback():
            if page.locator('.experience').get_attribute('data-immersive')=='true':
                page.keyboard.press('Escape');page.wait_for_selector('[data-immersive="false"]')
            page.evaluate("Object.defineProperty(HTMLElement.prototype,'requestFullscreen',{configurable:true,value:undefined})")
            page.get_by_role('button',name='Enter immersive mode',exact=True).click();page.wait_for_selector('[data-immersive="true"]')
            page.locator('canvas').dblclick(position={'x':500,'y':420});page.wait_for_selector('[data-immersive="false"]')
            return {'fullscreen_api_disabled':True,'double_click_restored':True}
        check('Fullscreen-unavailable fallback and double-click escape work',fullscreen_fallback)
        check('Desktop layout has no horizontal overflow',lambda:demand(page.evaluate('document.documentElement.scrollWidth <= innerWidth && scrollY === 0'),'Desktop overflows'))
        desktop.close();contexts.remove(desktop)

        mobile=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=3,is_mobile=True,has_touch=True)
        contexts.append(mobile);mp=mobile.new_page();listen(mp);mp.goto(BASE,wait_until='networkidle');ready(mp)
        def mobile_layout():
            d=diag(mp);demand(d['width']==390 and d['height']==844,'Canvas does not use mobile container size')
            demand(d['pixelRatio']<=1.5,'Mobile DPR is not capped')
            demand(mp.evaluate('document.documentElement.scrollWidth <= innerWidth && scrollY === 0'),'Mobile horizontal overflow')
            screenshot(mp,'mobile-portrait.png');open_panel(mp)
            panel=mp.get_by_role('region',name='Landscape settings').bounding_box();demand(panel['x']>=0 and panel['x']+panel['width']<=391,'Mobile panel overflows')
            screenshot(mp,'mobile-controls.png');close_panel(mp)
            return {'diagnostics':d,'panel_bounds':panel}
        check('Mobile framing, capped DPR and compact panel fit portrait',mobile_layout)
        cdp=mobile.new_cdp_session(mp)
        def touch(event,points):cdp.send('Input.dispatchTouchEvent',{'type':event,'touchPoints':[{'x':x,'y':y,'id':i} for i,x,y in points]})
        def mobile_touch():
            before=diag(mp)['camera'];touch('touchStart',[(1,180,460)]);touch('touchMove',[(1,265,500)]);touch('touchEnd',[]);mp.wait_for_timeout(600)
            moved=diag(mp)['camera'];demand(abs(moved['yaw']-before['yaw'])>.03,'Touch drag did not orbit')
            touch('touchStart',[(1,150,470),(2,240,470)]);touch('touchMove',[(1,100,470),(2,290,470)]);touch('touchEnd',[]);mp.wait_for_timeout(650)
            zoomed=diag(mp)['camera'];demand(zoomed['distance']<moved['distance'],'Pinch did not zoom')
            demand(mp.evaluate('scrollY===0'),'Touch scrolled the page')
            return {'before':before,'dragged':moved,'pinched':zoomed}
        check('Real touch events drag and pinch without page scrolling',mobile_touch)
        def rotate():
            mp.set_viewport_size({'width':844,'height':390});mp.wait_for_timeout(700);d=diag(mp)
            demand(d['width']==844 and d['height']==390,'Rotation did not resize canvas')
            demand(mp.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Landscape rotation overflows')
            screenshot(mp,'mobile-landscape.png');return d
        check('Mobile rotation updates renderer dimensions',rotate)
        def mobile_immersive():
            mp.set_viewport_size({'width':390,'height':844});mp.wait_for_timeout(350)
            mp.get_by_role('button',name='Enter immersive mode',exact=True).tap();mp.wait_for_selector('[data-immersive="true"]')
            mp.touchscreen.tap(180,470);mp.wait_for_timeout(100);mp.touchscreen.tap(180,470)
            mp.wait_for_selector('[data-immersive="false"]');return {'double_tap_restored':True}
        check('Mobile immersive mode restores with double-tap',mobile_immersive)
        mobile.close();contexts.remove(mobile)

        reduced=browser.new_context(viewport={'width':1000,'height':700},reduced_motion='reduce');contexts.append(reduced)
        rp=reduced.new_page();listen(rp);rp.goto(BASE,wait_until='networkidle');ready(rp)
        def reduced_motion():
            demand(state(rp)['paused'] is True,'Reduced motion did not pause initially')
            a=diag(rp)['time'];rp.wait_for_timeout(350);b=diag(rp)['time'];demand(a==b,'Reduced-motion terrain moves')
            rp.get_by_role('button',name='Resume motion',exact=True).click();rp.wait_for_timeout(350)
            demand(diag(rp)['time']>b,'Explicit resume is not respected')
            return {'initial_time':a,'stable_time':b,'resumed_time':diag(rp)['time']}
        check('Reduced-motion starts still and explicit resume remains possible',reduced_motion)
        reduced.close();contexts.remove(reduced)

        harness=browser.new_context(viewport={'width':1000,'height':700});contexts.append(harness)
        hp=harness.new_page();listen(hp);hp.goto(BASE+'/qa/harness.html',wait_until='networkidle')
        hp.wait_for_function('window.__HILLS_HARNESS__?.diagnostics()?.frames > 0',timeout=60000)
        hdiag=lambda:hp.evaluate('window.__HILLS_HARNESS__.diagnostics()')
        hstats=lambda:hp.evaluate('window.__HILLS_HARNESS__.stats()')
        def container_resize():
            a=hdiag();demand(a['width']==480 and a['height']==270,'Initial arbitrary container ignored')
            hp.evaluate('window.__HILLS_HARNESS__.setSize(317,219)');hp.wait_for_timeout(500);b=hdiag()
            demand(b['width']==317 and b['height']==219,'ResizeObserver ignored container change')
            demand(a['rendererId']==b['rendererId'],'Resize recreated renderer')
            return {'initial':a,'resized':b}
        check('Reusable component sizes from its container, not window',container_resize)
        def visibility():
            hp.evaluate('window.__HILLS_HARNESS__.offscreen(true)');hp.wait_for_function('window.__HILLS_HARNESS__.stats().activeLoops===0')
            a=hdiag()['time'];hp.wait_for_timeout(300);b=hdiag()['time'];demand(a==b,'Offscreen time advanced')
            hp.evaluate('window.__HILLS_HARNESS__.offscreen(false)');hp.wait_for_timeout(350);demand(hdiag()['time']>b,'Visible terrain did not resume')
            hp.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'))")
            hp.wait_for_function('window.__HILLS_HARNESS__.stats().activeLoops===0');c=hdiag()['time'];hp.wait_for_timeout(250);demand(hdiag()['time']==c,'Visibility handler did not suspend time')
            hp.evaluate("delete document.hidden;document.dispatchEvent(new Event('visibilitychange'))");hp.wait_for_timeout(300)
            demand(hdiag()['time']>c,'Visibility handler did not resume')
            return {'offscreen_stable':True,'synthetic_visibility_event_stable':True}
        check('Offscreen and visibility-event rendering suspend and resume',visibility)
        def cleanup():
            samples=[]
            for _ in range(3):
                hp.evaluate('window.__HILLS_HARNESS__.unmount()');hp.wait_for_timeout(150);s=hstats()
                demand(s=={'activeEngines':0,'activeLoops':0,'activeObservers':0},f'Resources remain after unmount: {s}')
                demand(hp.locator('canvas').count()==0,'Unmounted canvas remains')
                samples.append(s)
                hp.evaluate('window.__HILLS_HARNESS__.mount()');hp.wait_for_function('window.__HILLS_HARNESS__.diagnostics()?.frames>0',timeout=30000)
                demand(hstats()['activeEngines']==1,'Strict Mode created duplicate engines')
            hp.evaluate('window.__HILLS_HARNESS__.unmount()');hp.wait_for_timeout(150)
            demand(hstats()=={'activeEngines':0,'activeLoops':0,'activeObservers':0},'Final resource counters not zero')
            return {'unmounted_samples':samples,'final':hstats()}
        check('Strict Mode repeat mounts clean renderers, loops, observers and canvases',cleanup)
        harness.close();contexts.remove(harness)

        unsupported=browser.new_context(viewport={'width':1000,'height':700});contexts.append(unsupported)
        unsupported.add_init_script("const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(type==='webgl2'||type==='webgl'||type==='experimental-webgl')return null;return original.call(this,type,...args)}")
        up=unsupported.new_page();listen(up,expected=True);up.goto(BASE,wait_until='networkidle')
        def unsupported_fallback():
            up.get_by_text('A moment of stillness',exact=True).wait_for(state='visible')
            demand(up.get_by_text('The interactive landscape needs WebGL.',exact=False).is_visible(),'WebGL fallback description missing')
            demand(up.locator('canvas').count()==0,'Broken canvas remains in unsupported view')
            screenshot(up,'webgl-unavailable.png');return {'graceful_fallback_visible':True}
        check('Unsupported WebGL presents a consistent useful fallback',unsupported_fallback)
        unsupported.close();contexts.remove(unsupported)
        check('No unexpected browser or shader errors',lambda:demand(not [e for e in errors if not e['expected']],str([e for e in errors if not e['expected']])[:1200]))
        check('Application source unchanged during verification',lambda:demand(source_hashes()==start_hashes,'Source changed during QA; rerun required'))
    except Exception as exc:
        checks.append({'name':'Browser suite reached completion','passed':False,'detail':traceback.format_exc()[-3000:]})
        print('SUITE ERROR:',str(exc),flush=True)
    finally:
        for context in contexts:
            try:context.close()
            except Exception:pass
        browser.close()

report.update(finished_at_utc=datetime.now(timezone.utc).isoformat(),source_sha256=start_hashes,passed=sum(c['passed'] for c in checks),total=len(checks))
report['status']='passed' if checks and all(c['passed'] for c in checks) else 'failed'
(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(f"RESULT: {report['passed']}/{report['total']} passed; {OUT/'report.json'}",flush=True)
raise SystemExit(0 if report['status']=='passed' else 1)
