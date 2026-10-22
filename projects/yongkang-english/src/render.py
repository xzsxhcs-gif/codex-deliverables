"""A photo-documentary renderer: licensed stills, original graphics, one timeline."""
from pathlib import Path
import argparse, bisect, json, math, os, subprocess, time
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
W,H,FPS = 1920,1080,30
CREAM='#F3EDE2'; TEAL='#123E3A'; GOLD='#C8A66B'; CLAY='#B85E3F'; INK='#16342F'
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SERIF='/usr/share/fonts/opentype/urw-base35/P052-Roman.otf'
CJK='/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc'
TIMELINE=json.loads((ROOT/'assets/audio/timeline.json').read_text())
ASSETS={r['id']:r for r in json.loads((ROOT/'research/assets.json').read_text())['assets']}
USED=set()
@lru_cache(80)
def font(size,kind='sans'):
    return ImageFont.truetype({'sans':FONT,'bold':BOLD,'serif':SERIF,'cjk':CJK}[kind],size)
def text(draw,xy,value,size=30,fill=INK,kind='sans',anchor=None):
    draw.text(xy,value,font=font(size,kind),fill=fill,anchor=anchor,spacing=7)
def multiline(draw,xy,values,size=72,fill=INK,kind='serif',gap=1.07):
    for i,value in enumerate(values):text(draw,(xy[0],round(xy[1]+i*size*gap)),value,size,fill,kind)
@lru_cache(50)
def fitted(asset,w,h):
    USED.add(asset)
    image=Image.open(ROOT/ASSETS[asset]['path']).convert('RGB')
    factor=max(w/image.width,h/image.height)*1.065
    return image.resize((math.ceil(image.width*factor),math.ceil(image.height*factor)),Image.Resampling.LANCZOS)
def photo(image,asset,rect,p,reverse=False):
    x,y,w,h=rect;src=fitted(asset,w,h)
    smooth=(1-math.cos(math.pi*max(0,min(1,p))))*.5
    if reverse:smooth=1-smooth
    left=round((src.width-w)*(.25+.45*smooth));top=round((src.height-h)*(.52-.15*smooth))
    image.paste(src.crop((left,top,left+w,top+h)),(x,y))
def credit(draw,asset,rect,color=INK):
    a=ASSETS[asset];x,y,w,h=rect
    label=a['credit_short']
    size=21
    while font(size,'cjk').getlength(label)>w and size>14:size-=1
    text(draw,(x,y+h+10),label,size,color,'cjk')
@lru_cache(20)
def graphic(name,w,h):
    return Image.open(ROOT/f'assets/graphics/{name}.png').convert('RGB').resize((w,h),Image.Resampling.LANCZOS)
@lru_cache(1)
def dark_gradient():
    y=np.linspace(0,1,H)[:,None];x=np.linspace(0,1,W)[None,:]
    a=np.clip(np.maximum((y-.42)/.58*.79,(.38-x)/.38*.25),0,.83)
    rgba=np.zeros((H,W,4),dtype=np.uint8);rgba[:,:,:3]=[7,22,21];rgba[:,:,3]=(a*255).astype(np.uint8)
    return Image.fromarray(rgba,'RGBA')
def full(image,asset,p):
    photo(image,asset,(0,0,W,H),p)
    image.paste(dark_gradient(),(0,0),dark_gradient())
def header(draw,number,label,light=False):
    color=CREAM if light else INK
    text(draw,(78,47),f'{number}  /  {label}',24,color,'bold')
    draw.line((78,93,1842,93),fill=('#ADBAAF' if light else '#CFC4B0'),width=1)
def fullcredit(draw,asset):
    a=ASSETS[asset];label=a['credit_short'];size=20
    f=font(size,'cjk');tw=round(f.getlength(label));x=W-78-tw
    draw.rounded_rectangle((x-12,114,W-64,153),radius=5,fill=(10,24,23,195))
    text(draw,(x,115),label,size,CREAM,'cjk')
def section_first(name):return next(r['start'] for r in TIMELINE['segments'] if r['section']==name)

# Scene boundaries follow actual synthesized sentences rather than guessed timings.
SCENES=[
 ('intro',0),('location',section_first('location')-.25),('history',section_first('history')-.25),
 ('making',section_first('making')-.25),('connection',TIMELINE['segments'][6]['start']-.2),
 ('transition',section_first('transition')-.2),('fangyan',section_first('fangyan')-.2),
 ('danxia',TIMELINE['segments'][10]['start']-.18),('xijin',section_first('xijin')-.2),
 ('walkway',TIMELINE['segments'][12]['start']-.2),('heritage',section_first('heritage')-.2),
 ('culture',section_first('culture')-.2),('food',section_first('food')-.2),
 ('closing',section_first('closing')-.2),('final',TIMELINE['segments'][18]['start']-.2),
 ('credits',TIMELINE['spoken_end']+.5),
]
STARTS=[s[1] for s in SCENES]
DURATION=TIMELINE['duration']

def scene_frame(i,t):
    name,start=SCENES[i];end=STARTS[i+1] if i+1<len(SCENES) else DURATION
    p=max(0,min(1,(t-start)/max(end-start,.01)))
    im=Image.new('RGB',(W,H),CREAM);d=ImageDraw.Draw(im,'RGBA')
    if name=='intro':
        full(im,'city-panorama',p);d=ImageDraw.Draw(im,'RGBA');header(d,'01','YONGKANG / ZHEJIANG, CHINA',True);fullcredit(d,'city-panorama')
        text(d,(78,320),'永康',63,CREAM,'cjk');text(d,(72,412),'YONGKANG',174,CREAM,'serif')
        multiline(d,(81,648),['Made by hand. Shaped by time.'],52,CREAM)
        text(d,(81,837),'AN ENGLISH-LANGUAGE CITY PORTRAIT',23,CREAM,'bold')
        text(d,(81,875),'Archival photography · original graphics',23,CREAM)
    elif name=='location':
        header(d,'01','A PLACE IN EASTERN CHINA')
        im.paste(graphic('location',880,528),(50,233))
        rect=(1000,188,842,650);photo(im,'city-hills',rect,p);d=ImageDraw.Draw(im,'RGBA');credit(d,'city-hills',rect)
        text(d,(1000,886),'Hills and a working city, side by side.',27,INK)
    elif name=='history':
        header(d,'01','A LONGER MEMORY')
        multiline(d,(78,240),['Three Kingdoms','roots.'],77)
        text(d,(82,470),'More than 1,700 years',29,CLAY,'bold')
        text(d,(82,523),'of county history.',32)
        text(d,(82,742),'A past carried into everyday life.',25)
        rect=(900,166,942,660);photo(im,'xijin-2007',rect,p);d=ImageDraw.Draw(im,'RGBA');credit(d,'xijin-2007',rect)
        text(d,(900,880),'Xijin Bridge · later city heritage',24)
    elif name=='making':
        header(d,'02','THE HARDWARE CITY')
        im.paste(graphic('hardware',1135,681),(30,165))
        rect=(1220,257,620,458);photo(im,'hardware-market',rect,p);d=ImageDraw.Draw(im,'RGBA');credit(d,'hardware-market',rect)
        text(d,(1220,774),'Hardware City market',26,INK,'bold')
        text(d,(1220,819),'An archival exterior view',22)
    elif name=='connection':
        full(im,'city-panorama',p);d=ImageDraw.Draw(im,'RGBA');header(d,'02','MAKING CONNECTIONS',True);fullcredit(d,'city-panorama')
        multiline(d,(78,622),['Built here.','Used far beyond.'],86,CREAM)
    elif name in ('transition','walkway'):
        rect=(78,132,735,760);photo(im,'xijin-2023-01',rect,p);d=ImageDraw.Draw(im,'RGBA');credit(d,'xijin-2023-01',rect)
        header(d,'03' if name=='transition' else '04','ANOTHER RHYTHM' if name=='transition' else 'XIJIN BRIDGE')
        if name=='transition':
            multiline(d,(945,295),['Beyond the','workshop.'],92)
            text(d,(951,574),'Places to gather. Stories to share.',28)
            text(d,(951,800),'Xijin Bridge · covered walkway',24,CLAY)
        else:
            multiline(d,(945,282),['At walking','pace.'],96)
            text(d,(952,579),'Timber, shade and passing light.',29)
            text(d,(952,800),'Xijin Bridge · interior',24,CLAY)
    elif name in ('fangyan','danxia'):
        header(d,'03','FANGYAN / A DIFFERENT LANDSCAPE')
        if name=='fangyan':
            multiline(d,(78,192),['FANGYAN'],70)
            multiline(d,(80,310),['Cliffs.','Form. Time.'],64)
            small=(80,579,498,282);photo(im,'fangyan-cliffs',small,p);d=ImageDraw.Draw(im,'RGBA');credit(d,'fangyan-cliffs',small)
            rect=(670,181,1172,681);photo(im,'fangyan-landscape',rect,p);d=ImageDraw.Draw(im,'RGBA');credit(d,'fangyan-landscape',rect)
        else:
            text(d,(81,245),'DANXIA',57,CLAY,'bold');multiline(d,(80,382),['A landscape','of cliffs.'],65)
            text(d,(82,760),'Fangyan scenic area',28)
            rect=(670,181,1172,681);photo(im,'fangyan-rocks',rect,p);d=ImageDraw.Draw(im,'RGBA');credit(d,'fangyan-rocks',rect)
    elif name=='xijin':
        full(im,'xijin-2020',p);d=ImageDraw.Draw(im,'RGBA');header(d,'04','THE CITY AT WALKING PACE',True);fullcredit(d,'xijin-2020')
        text(d,(78,673),'XIJIN BRIDGE',82,CREAM,'serif');text(d,(83,790),'Across the Yongkang River',32,CREAM)
    elif name=='heritage':
        full(im,'houwu-ancestral-hall',p);d=ImageDraw.Draw(im,'RGBA');header(d,'05','SHARED MEMORY',True);fullcredit(d,'houwu-ancestral-hall')
        text(d,(78,702),'Family. Craft. Memory.',70,CREAM,'serif')
        text(d,(82,808),'Wu ancestral hall · Houwu village',30,CREAM)
    elif name=='culture':
        header(d,'05','LIVING TRADITIONS')
        rect=(78,174,790,650);photo(im,'fangyan-foot',rect,p);d=ImageDraw.Draw(im,'RGBA');credit(d,'fangyan-foot',rect)
        text(d,(78,872),'Fangyan · scenic context',23)
        multiline(d,(1002,269),['A shared','celebration.'],86)
        text(d,(1007,594),'Fangyan Temple Fair',33,CLAY,'bold')
        text(d,(1007,661),'Local culture, carried forward.',28)
    elif name=='food':
        header(d,'06','A LOCAL TASTE')
        multiline(d,(81,340),['Something','to taste.'],91)
        text(d,(84,621),'A savory Yongkang flatbread',28,CLAY)
        im.paste(graphic('roumaibing',1120,672),(760,164))
    elif name in ('closing','final'):
        asset='city-hills' if name=='closing' else 'xijin-2007'
        full(im,asset,p);d=ImageDraw.Draw(im,'RGBA');header(d,'07','MORE THAN WHAT IT MAKES',True);fullcredit(d,asset)
        if name=='closing':
            multiline(d,(80,568),['Useful objects. Living traditions.','Distinctive landscapes.'],64,CREAM)
        else:
            text(d,(78,569),'YONGKANG',144,CREAM,'serif')
            text(d,(84,769),'A different side of Zhejiang.',45,CREAM)
    elif name=='credits':
        im=Image.new('RGB',(W,H),TEAL);d=ImageDraw.Draw(im,'RGBA');header(d,'08','SOURCES & MAKING',True)
        text(d,(78,185),'A city portrait, with a traceable story.',72,CREAM,'serif')
        rows=[('RESEARCH','Municipal sources, heritage reports and public standards.'),
              ('PHOTOGRAPHY','Wikimedia Commons · openly licensed archival photographs.'),
              ('SOUND & GRAPHICS','Piper / LJSpeech synthetic voice. Original music and illustrations.')]
        for j,(a,b) in enumerate(rows):
            y=358+j*130;text(d,(83,y),a,23,GOLD,'bold');text(d,(83,y+43),b,29,CREAM)
        text(d,(83,794),'Photo authors and licenses appear on their shots; full credits in the companion files.',25,CREAM)
        text(d,(83,853),'github.com/xzsxhcs-gif/codex-deliverables · projects/yongkang-english',25,CREAM)
        text(d,(83,920),'Film: CC BY-SA 4.0  /  Openly licensed photos retain their individual terms.',22,CREAM)
    return im

def frame(t):
    index=max(0,bisect.bisect_right(STARTS,t)-1);im=scene_frame(index,t)
    local=t-STARTS[index]
    if index>0 and local<.65:
        previous=scene_frame(index-1,STARTS[index]-.0001)
        q=local/.65;q=q*q*(3-2*q);im=Image.blend(previous,im,q)
    opacity=min(1,t/.85,(DURATION-t)/.85)
    if opacity<1:im=Image.blend(Image.new('RGB',(W,H),'black'),im,max(0,opacity))
    return im

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--stills',action='store_true');ap.add_argument('--output',default='output/picture-1080p.mp4');args=ap.parse_args()
    out=ROOT/'output';out.mkdir(exist_ok=True)
    scene_doc=[{'scene':name,'start':round(start,3),'end':round(STARTS[i+1] if i+1<len(SCENES) else DURATION,3)} for i,(name,start) in enumerate(SCENES)]
    (out/'scenes.json').write_text(json.dumps(scene_doc,indent=2)+'\n')
    if args.stills:
        for i,(name,start) in enumerate(SCENES):frame(min(start+1.3,DURATION-1)).save(out/f'review-{i:02}-{name}.jpg',quality=94)
        print('Rendered',len(SCENES),'review stills.');return
    # The soundtrack is mixed in a separate command so audio-only changes never rerender images.
    logfile=(out/'render-ffmpeg.log').open('w')
    cmd=['ffmpeg','-hide_banner','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{W}x{H}','-framerate',str(FPS),'-i','pipe:0','-an','-vf','ass=assets/audio/captions.ass','-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-profile:v','high','-level:v','4.1','-threads','3','-movflags','+faststart',str(ROOT/args.output)]
    env=os.environ.copy();env['XDG_CACHE_HOME']=str(out/'.cache')
    process=subprocess.Popen(cmd,stdin=subprocess.PIPE,stderr=logfile,cwd=ROOT,env=env)
    n=round(DURATION*FPS);begin=time.time()
    try:
        for number in range(n):
            process.stdin.write(frame(number/FPS).tobytes())
            if number%(FPS*10)==0:print(f'Render {number//FPS:3}s / {DURATION:.2f}s · elapsed {time.time()-begin:.1f}s',flush=True)
        process.stdin.close();code=process.wait()
        if code:raise RuntimeError(f'FFmpeg failed; see {logfile.name}')
    except Exception:
        process.kill();raise
    finally:logfile.close()
    (out/'used-assets.json').write_text(json.dumps([ASSETS[k] for k in sorted(USED)],ensure_ascii=False,indent=2)+'\n')
    print(f'Completed {n} frames in {time.time()-begin:.1f}s',flush=True)
if __name__=='__main__':main()
