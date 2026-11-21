"""Original surface plates, instrument artwork and atmospheres. No downloaded media."""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
from scipy.ndimage import gaussian_filter
from scipy.signal import butter,sosfilt
from scipy.io.wavfile import write
import numpy as np, math
A=Path(__file__).resolve().parents[1]/'Assets/SummitStation'
rng=np.random.default_rng(4307)
# Color is albedo under neutral lighting. Surfaces use meter-scaled UVs.
surfaces={
'Concrete':((129,129,117),'cement',0,.26),'FireratedWall':((173,181,169),'paint',.08,.38),
'Enamel':((52,77,77),'paint',.52,.47),'Iron':((57,63,63),'metal',.75,.48),
'Zinc':((147,148,138),'metal',.72,.53),'Copper':((137,83,51),'metal',.67,.49),
'Rubber':((41,44,40),'rubber',.05,.28),'Ochre':((208,135,48),'paint',.47,.44),
'Fabric':((103,114,110),'weave',0,.14),'Blanket':((127,79,49),'weave',0,.17),
'Laminate':((144,107,71),'wood',.03,.37),'Bedlinen':((187,182,155),'weave',0,.22),
'RoadSteel':((81,84,80),'tread',.64,.58),'Basalt':((83,88,90),'rock',.12,.29),
'Scree':((111,115,111),'rock',.09,.34),'Snow':((169,183,185),'cement',.05,.26),
'Roof':((69,83,84),'roof',.55,.48),'Gasket':((24,31,33),'rubber',0,.23),
'Umber':((137,62,45),'paint',.46,.4),'Paper':((208,195,158),'cement',0,.24)}
def grain(n,sy,sx):
 a=rng.normal(size=(n,n)); a=gaussian_filter(a,(sy,sx),mode='wrap');return (a-a.mean())/(a.std()+1e-8)
def font(n,bold=False):
 return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono'+('-Bold' if bold else '')+'.ttf',n)
def run():
 n=384; yy,xx=np.mgrid[:n,:n]
 for name,(base,kind,metal,gloss) in surfaces.items():
  fine=grain(n,.5,.5);coarse=grain(n,12,12); mid=grain(n,3,3)
  tex=1.7*fine+2.3*mid+1.9*coarse; height=tex.copy()
  if kind=='metal':tex+=grain(n,.45,9)*6+np.maximum(coarse-1,0)*-7
  if kind=='wood':tex+=7*grain(n,1,32)+3*np.sin(yy*.7+coarse)
  if kind=='weave':tex+=4*np.sin(xx*np.pi/2)*np.cos(yy*np.pi/3)+3*np.sin(yy*np.pi/2)
  if kind=='rock':tex+=10*mid+10*coarse+6*fine
  if kind=='cement':tex+=4*fine+3*mid
  if kind=='tread':
   ridge=(np.abs((xx+yy)%32-16)<2.7)&(np.abs((xx-yy)%48-24)<13)
   height+=ridge*30;tex+=ridge*20+6*coarse
  if kind=='roof':tex+=np.cos(xx*np.pi/16)*9;height+=np.cos(xx*np.pi/16)*30
  if kind=='paint':tex+=np.clip(mid-1.95,0,3)*-20
  if kind in ('tread','roof'): height=height*.7+tex*.3
  else:height=tex
  Image.fromarray(np.uint8(np.clip(np.array(base)[None,None,:]+tex[:,:,None],0,255))).save(A/'Textures'/f'{name}.jpg',quality=87)
  dx=(np.roll(height,-1,1)-np.roll(height,1,1))*.014;dy=(np.roll(height,-1,0)-np.roll(height,1,0))*.014
  normal=np.stack([-dx,dy,np.ones_like(dx)],axis=-1);normal/=np.linalg.norm(normal,axis=-1)[:,:,None]
  Image.fromarray(np.uint8((normal*.5+.5)*255)).save(A/'Textures'/f'{name}_N.png')
 # Original charts, station typography and wayfinding. Each screen uses one atlas tile.
 w=768;h=384
 for key,title,sub,code in [('Radar','DOPPLER','PRECIPITATION  /  C-BAND','WX 03'),('Trace','BAROGRAPH','PRESSURE TENDENCY  /  12 H','WX 04'),('Synoptic','SYNOPTIC','RIDGE NETWORK  /  TELEMETRY','WX 05'),('Log','NIGHT LOG','SHIFT 03   /   MS-17','OPS'),('Control','OBSERVATIONS','CONTROL ROOM','01'),('Quarters','NIGHT QUARTERS','REST MODULE','02'),('Exit','GENERATOR  >','EXPOSED WALKWAY','03'),('Generator','AUXILIARY POWER','DIESEL GENERATING SET','04'),('Tag','MS / 17','SUMMIT OBSERVATORY','2850 M'),('Service','ISOLATOR  01','ENGINE SERVICE ACCESS','GEN / B'),('Torch','EMERGENCY LAMP','RETURN TO CRADLE','L / 2')]:
  screen=key in ['Radar','Trace','Synoptic'];im=Image.new('RGB',(w,h),(12,35,40) if screen else (38,49,50));d=ImageDraw.Draw(im);ink=(188,220,207) if screen else (225,215,186);gold=(231,158,74)
  d.rectangle((14,14,w-14,h-14),outline=(75,99,95),width=2)
  if screen:
   d.text((28,25),title,font=font(32,True),fill=ink);d.text((32,70),sub,font=font(17),fill=(102,167,159));d.text((598,32),code,font=font(23),fill=gold)
   for x in range(32,590,32):d.line((x,108,x,346),fill=(27,59,60))
   for y in range(108,347,26):d.line((32,y,583,y),fill=(27,59,60))
   if key=='Radar':
    for r in (28,55,82,111):d.ellipse((280-r,227-r,280+r,227+r),outline=(67,130,116),width=2)
    for i in range(150):
     x,y=rng.multivariate_normal([287,222],[[1960,550],[550,526]]);rr=int(rng.uniform(2,8)); d.ellipse((x-rr,y-rr,x+rr,y+rr),fill=(int(rng.uniform(44,108)),int(rng.uniform(110,183)),104))
    d.line((280,227,354,147),fill=ink,width=2)
   else:
    for j in range(3 if key=='Trace' else 8):
     points=[(35+i*4,160+j*(51 if key=='Trace' else 19)+math.sin(i*.071+j)*17+math.sin(i*.17+j*.7)*4+(.22*i if key=='Trace' else -i*.14)) for i in range(136)]
     d.line(points,fill=[(120,203,174),(218,150,76),(85,151,190)][j%3],width=3)
   for j,txt in enumerate(['RIDGE','2850 M','04:17','NNW','24 M/S']): d.text((610,116+j*44),txt,font=font(18),fill=ink)
  else:
   d.rectangle((29,36,85,43),fill=gold);d.text((29,72),code,font=font(39),fill=gold);size=64 if len(title)<14 else 53
   d.text((27,145),title,font=font(size,True),fill=ink);d.line((30,260,738,260),fill=ink,width=2);d.text((30,282),sub,font=font(27),fill=ink)
  im.save(A/'Textures'/f'{key}.png')
 sr=22050
 def loop(name,seconds,build,level):
  t=np.arange(sr*seconds)/sr
  x=build(t)
  # Crossfade tail onto head at the loop boundary.
  n=sr//2; mix=np.linspace(0,1,n);x[:n]=x[-n:]*(1-mix)+x[:n]*mix;x=x[:-n]
  x=x/(np.max(abs(x))+.001)*level;write(A/'Audio'/f'{name}.wav',sr,(x*32767).astype(np.int16))
 def noise(t,lo,hi):return sosfilt(butter(3,[lo,hi],btype='bandpass',fs=sr,output='sos'),rng.normal(size=len(t)))
 loop('Wind',13,lambda t: noise(t,65,580)*(.62+.3*np.sin(.91*t))+.1*noise(t,640,1350),.67)
 loop('Rain',11,lambda t: noise(t,800,7400)*(.65+.10*np.sin(t*1.6))+.12*noise(t,250,580),.62)
 loop('Ventilation',8,lambda t:.25*np.sin(2*np.pi*51*t)+.1*np.sin(2*np.pi*102*t)+.075*np.sin(2*np.pi*154*t)+noise(t,80,370)*.55,.45)
 loop('Engine',8,lambda t:sum((1/i)*np.sin(2*np.pi*31*i*t+.1*np.sin(5*t)) for i in range(1,7))*(.83+.13*np.cos(2*np.pi*7*t))+.22*noise(t,48,680),.55)
 t=np.arange(sr*7)/sr;wave=noise(t,30,340)*sum(np.exp(-np.maximum(0,t-k)*q)*(t>k) for k,q in [(.05,1.4),(.8,1.15),(2.1,.9)]);wave*=np.minimum(1,t/.14)*np.minimum(1,(7-t)/.8)
 write(A/'Audio/Thunder.wav',sr,(wave/(np.max(abs(wave))+.01)*24200).astype(np.int16))
if __name__=='__main__':run()
