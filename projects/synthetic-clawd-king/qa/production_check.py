"""Smoke-test compiled site and embedded single HTML without any development hooks."""
import asyncio,json,os,hashlib
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parent/'results'
BASE=os.environ.get('PRODUCTION_URL','http://127.0.0.1:5181/site')
REPORT={'checks':[],'errors':[],'limits':['Headless Chromium with software WebGL; not a physical phone or Safari.']}
def check(name,passed,detail=None):
 REPORT['checks'].append({'name':name,'passed':bool(passed),'detail':detail})
 print(('PASS ' if passed else 'FAIL ')+name,flush=True)
 if not passed:raise AssertionError(name)
INIT='''(()=>{
 const request=window.requestAnimationFrame.bind(window);const cancel=window.cancelAnimationFrame.bind(window);const pending=new Set();
 window.requestAnimationFrame=callback=>{let id=request(time=>{pending.delete(id);callback(time)});pending.add(id);return id};
 window.cancelAnimationFrame=id=>{pending.delete(id);cancel(id)};
 window.__activeClawdFrames=()=>pending.size;
 try{localStorage.setItem('sc_boss_unlocked','1');localStorage.setItem('sc_best','4321');localStorage.setItem('sc_lang','zh');}catch{}
})()'''
async def run():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('BROWSER_PATH','/usr/bin/chromium'),args=['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'])
  for name,url in [('standard-subdirectory',BASE+'/'),('single-file',BASE+'/Synthetic-Clawd-King.html')]:
   ctx=await browser.new_context(viewport={'width':1100,'height':720},reduced_motion='reduce')
   await ctx.add_init_script(INIT)
   page=await ctx.new_page();errors=[];requests=[]
   page.on('pageerror',lambda e:errors.append(str(e)))
   page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
   page.on('request',lambda r:requests.append(r.url))
   await page.goto(url,wait_until='networkidle');await page.wait_for_function('window.clawd2D')
   check(name+': production helpers stripped',await page.evaluate('!window.clawdQA && !window.clawd2D.testing'))
   check(name+': original score/language intact',await page.evaluate("window.clawd2D.summary().best===4321 && document.documentElement.lang==='zh-CN'"))
   await page.locator('#cb').click();await page.locator('#royal-replay').click();await page.locator('#boss-start').wait_for(state='visible',timeout=20000)
   await page.locator('#boss-start').click();await page.locator('#boss-screen').wait_for(state='hidden')
   await page.wait_for_timeout(600)
   check(name+': real WebGL battle renders',await page.locator('.boss-scene canvas').count()==1)
   check(name+': one animation loop',await page.evaluate('window.__activeClawdFrames()===1'))
   await page.screenshot(path=str(OUT/f'production-{name}.png'))
   await page.keyboard.press('Escape');await page.locator('#boss-screen[data-screen="pause"]').wait_for(state='visible')
   await page.locator('#boss-return').click();await page.locator('#boss-root').wait_for(state='hidden')
   check(name+': clean return to playable 2D',await page.evaluate('!window.clawd2D.bossActive && !window.clawd2D.summary().paused') and await page.locator('.boss-scene canvas').count()==0)
   check(name+': one loop after return',await page.evaluate('window.__activeClawdFrames()===1'))
   check(name+': no browser/shader errors',not errors,errors)
   local=[u for u in requests if u.startswith('http')]
   if name=='single-file':check(name+': no separate asset requests',local==[url],local)
   check(name+': no external network resources',all(u.startswith(BASE) for u in local),local)
   await ctx.close()
  # Check direct opening separately: managed browser policy can forbid file:// entirely.
  ctx=await browser.new_context();page=await ctx.new_page()
  local_path=Path(__file__).resolve().parents[1]/'dist/Synthetic-Clawd-King.html'
  try:
   await page.goto(local_path.as_uri(),wait_until='load',timeout=10000)
   await page.wait_for_function('window.clawd2D',timeout=5000)
   REPORT['local_file_open']={'passed':True}
  except Exception as e:
   REPORT['local_file_open']={'passed':False,'reason':str(e)[:400]}
   REPORT['limits'].append('Direct file:// navigation did not complete in the selected browser; HTTP single-file version is separately verified.')
  await ctx.close();await browser.close()
 REPORT['passed']=sum(c['passed'] for c in REPORT['checks'])
 REPORT['total']=len(REPORT['checks'])
 REPORT['artifact_sha256']=hashlib.sha256((Path(__file__).resolve().parents[1]/'dist/Synthetic-Clawd-King.html').read_bytes()).hexdigest()
try:asyncio.run(run())
finally:(OUT/'production-report.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
