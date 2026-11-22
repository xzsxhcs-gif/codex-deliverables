"""Deterministic portrait edit. All waveforms and channel meters come from render/peaks.npz."""
import argparse,math,subprocess,functools
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
from illustration import ROOT,backdrop,desk,actor,draw as svgdraw

OUT=ROOT/'render'; QA=ROOT/'qa'; FPS=30; DUR=38; BEAT=60/124; W=720;H=1280
PAPER='#f2e8d4';INK='#202d3b';MID='#7e918f';ORANGE='#ee845d';LIGHT='#eee3c9';PANEL='#192632';DARK='#131f2b'
CHANNELS=['FX','DRUMS','BASS','SYNTH','LEAD']
PIGMENTS=['#d9a57d','#ef8560','#e6c878','#9fcabe','#d9aabd']
NAMES=['音效','鼓组','贝斯','合成器','主奏']
CHAPTERS=[('RHYTHM','节奏骨架'),('LOW END','低频入场'),('HARMONICS','和声着色'),('TOP LINE','主旋律'),('FULL MIX','全轨合流')]
FONTS={'mono':'/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf','heavy':'/usr/share/fonts/opentype/urw-base35/NimbusSansNarrow-Bold.otf','italic':'/usr/share/fonts/opentype/urw-base35/NimbusSansNarrow-BoldOblique.otf','zh':'/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc','zbold':'/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc'}
P=np.load(OUT/'peaks.npz')
STAGES=np.array([0,16,32,48,64])*BEAT
def step(x):return max(0,min(1,x))
class Film:
    def __init__(self,scale):
        self.s=scale;self.width=round(W*scale);self.height=round(H*scale); self.bgs=[];self.desks=[];self.shells=[];self.heroes={}
        for st in range(5):
            self.bgs.append(svgdraw(backdrop(st),W,575,scale).convert('RGB'))
            self.desks.append(svgdraw(desk(st),W,575,scale))
            self.shells.append(self.shell(st))
    @functools.lru_cache(maxsize=80)
    def font(self,name,sz):
        return ImageFont.truetype(FONTS[name],max(1,round(sz*self.s)),index=2 if name in ('zbold','zh') else 0)
    def xy(self,*vals):return tuple(round(v*self.s) for v in vals)
    def box(self,d,b,c):d.rectangle(self.xy(*b),fill=c)
    def line(self,d,points,col,width=1):d.line([self.xy(*p) for p in points],fill=col,width=max(1,round(width*self.s)))
    def txt(self,d,pos,s,font,size,col,anchor='lt'):d.text(self.xy(*pos),s,font=self.font(font,size),fill=col,anchor=anchor)
    def logo(self,d,x,y,col):
        for j in range(5):
            t=[10,18,28,18,10][j]
            self.line(d,[(x+j*5.6,y+15-t/2),(x+j*5.6,y+15+t/2)],col,3)
    def shell(self,st):
        im=Image.new('RGB',(self.width,self.height),PANEL);d=ImageDraw.Draw(im)
        self.box(d,(0,0,W,91),PAPER)
        self.logo(d,29,14,INK)
        self.txt(d,(63,16),'短波夜班','zbold',32,INK)
        self.txt(d,(64,58),'S H O R T W A V E    /    N I G H T   S H I F T','mono',9.8,INK)
        self.txt(d,(690,23),'STEM SESSION','heavy',21,INK,'rt')
        self.txt(d,(690,53),'124 BPM   /   STEREO','mono',12,INK,'rt')
        self.box(d,(0,664,W,672),ORANGE)
        self.txt(d,(30,700),f'0{st+1} / 05','mono',17,'#e7c799')
        self.txt(d,(28,738),CHAPTERS[st][0],'italic',63,LIGHT)
        self.txt(d,(688,741),CHAPTERS[st][1],'zbold',29,LIGHT,'rt')
        self.txt(d,(689,704),'ARRANGEMENT','mono',12,'#adb7af','rt')
        self.line(d,[(30,810),(690,810)],'#627277',1)
        self.txt(d,(30,832),'轨道','zh',15,'#b8c3bd')
        self.txt(d,(690,833),'2 BARS','mono',12,'#a6b2af','rt')
        for i,n in enumerate(CHANNELS):
            y=893+i*59
            active=i<=st+1
            self.line(d,[(30,y+28),(690,y+28)],'#35434b',1)
            self.box(d,(30,y-15,33,y+14),PIGMENTS[i] if active else '#4a555a')
            self.txt(d,(45,y-14),n,'heavy',20,PIGMENTS[i] if active else '#7d8c90')
            self.txt(d,(46,y+8),NAMES[i],'zh',11,'#abb8b4' if active else '#75848a')
            self.line(d,[(151,y),(624,y)],'#36474e',1)
        self.box(d,(0,1185,W,1280),DARK)
        self.txt(d,(30,1208),'MASTER','heavy',20,LIGHT)
        self.txt(d,(31,1244),'L / R','mono',12,'#a1aba6')
        self.txt(d,(689,1240),'38.00 SEC','mono',11,'#a0aea9','rt')
        return im
    def hero(self,st,tick):
        key=st,tick
        if key in self.heroes:return self.heroes[key]
        # Clear a scene at the cut so memory remains bounded.
        if len(self.heroes)>36:self.heroes={k:v for k,v in self.heroes.items() if k[0]==st}
        im=self.bgs[st].copy();d=ImageDraw.Draw(im)
        self.txt(d,(31,23),'S/W','italic',51,INK)
        self.txt(d,(33,82),'深夜放送','zbold',17,INK)
        self.line(d,[(34,113),(112,113)],INK,2)
        self.txt(d,(34,125),'ON AIR','mono',12,INK)
        # A travelling dash is visible in the aerial receiver to the left of the performer.
        pulse=(tick/32)
        for j in range(9):
            x=39+j*8; h=3+9*(.5+.5*math.sin(1.5*j-2*math.pi*pulse))**2
            self.box(d,(x,160-h,x+3,160+h),INK)
        a,hand=actor(st,tick,self.s)
        im.paste(a,(0,0),a)
        deckim=self.desks[st];im.paste(deckim,(0,0),deckim)
        im.paste(hand,(0,0),hand)
        # Angular crop marks stay within the illustrated print.
        d=ImageDraw.Draw(im)
        self.line(d,[(673,30),(692,30),(692,49)],INK,2)
        self.line(d,[(30,538),(30,548),(43,548)],LIGHT,2)
        self.heroes[key]=im
        return im
    def frame(self,f):
        t=f/FPS;st=int(np.searchsorted(STAGES,t,side='right')-1);beat=t/BEAT
        im=self.shells[st].copy(); tick=int(beat/2*32)%32
        hero=self.hero(st,tick);im.paste(hero,self.xy(0,91));d=ImageDraw.Draw(im)
        self.box(d,(0,657,W,665),INK);self.box(d,(0,657,W*t/DUR,665),'#eac990')
        # The peak cache has a 160-sample bin at 48 kHz (300 bins per second).
        x0=152;x1=625;span=x1-x0; window=8*BEAT;frac=.37;left=t-window*frac
        cx=x0+frac*span
        for bn in range(math.floor(left/BEAT),math.ceil((left+window)/BEAT)+1):
            x=x0+(bn*BEAT-left)/window*span
            if not x0<=x<=x1 or bn<0:continue
            major=bn%4==0
            self.line(d,[(x,866),(x,1159)],'#41525a' if major else '#293a46',1)
            if major:self.txt(d,(x,841),f'{1+bn//4:02}.1','mono',11,'#a9b6b5')
        nb=max(2,int(span*self.s/2.0))
        # Waveform columns depict peak amplitude in the corresponding time interval.
        lo=np.floor((left+np.arange(nb)*window/nb)*300).astype(int)
        hi=np.ceil((left+(1+np.arange(nb))*window/nb)*300).astype(int)
        offs=np.arange(int(np.max(hi-lo))+1)
        idx=lo[:,None]+offs
        valid=(idx>=0)&(idx<round(300*DUR))&(idx<hi[:,None])
        safe=idx.clip(0,round(300*DUR)-1)
        n=int(t*300); meterx=650
        for i,name in enumerate(CHANNELS):
            y=893+i*59;active=i<=st+1
            arr=P[name]
            if active:
                h=np.max(arr[safe]*valid,axis=1)**.73*31
                h=np.minimum(h,22.3)
                xcoords=(x0+np.arange(nb)*span/(nb-1))*self.s
                # Contiguous symmetric peak silhouettes.
                bounds=[(round(x),round((y-v)*self.s)) for x,v in zip(xcoords,h)]
                bounds.extend((round(x),round((y+v)*self.s)) for x,v in zip(xcoords[::-1],h[::-1]))
                d.polygon(bounds,fill=PIGMENTS[i])
                val=arr[max(0,n-15):n+1].max()
            else:val=0
            for k in range(5):
                self.box(d,(meterx+k*7.6,y+4-k*1.5,meterx+k*7.6+4.4,y+11),PIGMENTS[i] if val>.024*1.83**k else '#42525a')
        self.line(d,[(cx,863),(cx,1158)],'#fff1cb',1.65)
        d.polygon([self.xy(cx-4,861),self.xy(cx+4,861),self.xy(cx,867)],fill=LIGHT)
        
        # Master bus meters measure the two rendered audio channels.
        for j in range(2):
            meter=self.master_level[j,max(0,n-13):n+1].max()
            db=20*np.log10(max(meter,.0001))
            seg=round(step((db+47)/47)*29)
            for k in range(29):
                x=137+k*10.3
                self.box(d,(x,1211+j*14,x+7.7,1219+j*14),('#ed965e' if k>=24 else '#a3c7b0') if k<seg else '#36434a')
        self.txt(d,(689,1204),f'{t:05.2f}','mono',23,LIGHT,'rt')
        # Brief paper splice sweeps across the artwork at each four-bar change.
        if st and t-STAGES[st]<.19:
            u=(t-STAGES[st])/.19; x=-280+1250*u
            for off,col,thick in [(0,'#e8dabb',90),(-101,INK,7)]:
                d.polygon([self.xy(x+off,91),self.xy(x+off+thick,91),self.xy(x+off+thick-240,656),self.xy(x+off-240,656)],fill=col)
        if t>DUR-.40:
            im=Image.blend(im,Image.new('RGB',im.size,INK),step((t-DUR+.40)/.365))
        return im
    def load_master(self):
        from scipy.io import wavfile
        sr,pcm=wavfile.read(OUT/'master.wav',mmap=True)
        self.master_level=(np.max(abs(pcm.astype('f').reshape(-1,160,2)),axis=1)/32768).T
def main():
    p=argparse.ArgumentParser();p.add_argument('--scale',type=float,default=1.5);p.add_argument('--stills',action='store_true');p.add_argument('--output',default='shortwave.mp4');a=p.parse_args()
    film=Film(a.scale);film.load_master(); QA.mkdir(exist_ok=True)
    if a.stills:
        for j,t in enumerate([2.4,10.4,19.4,26.7,33.3]):
            film.frame(round(t*FPS)).save(QA/f'chapter-{j+1}.jpg',quality=92)
        return
    cmd=['ffmpeg','-v','warning','-y','-f','rawvideo','-pixel_format','rgb24','-video_size',f'{film.width}x{film.height}','-framerate',str(FPS),'-i','pipe:0','-i',str(OUT/'master.wav'),'-map','0:v','-map','1:a','-vf','scale=in_range=full:out_range=tv:out_color_matrix=bt709,format=yuv420p','-color_primaries','bt709','-color_trc','bt709','-colorspace','bt709','-color_range','tv','-c:v','libx264','-threads','2','-preset','veryfast','-crf','20','-profile:v','high','-c:a','aac','-b:a','192k','-movflags','+faststart','-metadata','title=短波夜班 | Shortwave Night Shift',str(OUT/a.output)]
    proc=subprocess.Popen(cmd,stdin=subprocess.PIPE)
    try:
        for i in range(DUR*FPS):
            proc.stdin.write(film.frame(i).tobytes())
            if i%240==0:print('frame',i,flush=True)
    finally:proc.stdin.close()
    if proc.wait():raise SystemExit('Encoding failed')
if __name__=='__main__': main()
