"""Author paper field charts, an aneroid dial and bound night watch book."""
from media import A,font
from PIL import Image,ImageDraw
import numpy as np,math
def make():
 rnd=np.random.default_rng(241)
 im=Image.new('RGB',(768,448),(200,193,161));d=ImageDraw.Draw(im)
 d.text((24,16),'RIDGE SURVEY   /   MS-17',font=font(27,1),fill=(45,63,54))
 x,y=np.meshgrid(np.arange(724),np.arange(284))
 field=np.sin(x*.011+y*.005)+.72*np.cos(y*.018-x*.003)+.38*np.sin((x+y)*.019)+.22*np.cos(x*.034-y*.011)
 a=np.empty((*x.shape,3),np.uint8);a[:]=[192,187,157];a[(field*8-np.floor(field*8))<.13]=[113,119,97];a[::44,:,:]=[138,145,121];a[:,::44,:]=[138,145,121]
 im.paste(Image.fromarray(a),(20,70))
 d.line([(144,276),(277,242),(360,254),(394,201),(486,168)],fill=(142,69,48),width=4)
 for xx,yy in [(144,276),(394,201),(486,168)]:d.ellipse((xx-6,yy-6,xx+6,yy+6),fill=(134,67,47))
 d.text((26,378),'CONTOURS   20 M    /    RIDGE APPROACH     N  ^',font=font(20),fill=(57,65,52));im.save(A/'Textures/Survey.png')
 im=Image.new('RGB',(384,384),(44,51,48));d=ImageDraw.Draw(im);d.ellipse((8,8,376,376),fill=(205,199,168),outline=(78,81,65),width=7)
 for i in range(73):
  a=math.radians(141+258*i/72);r=135 if i%6 else 120
  d.line([(192+math.cos(a)*149,192+math.sin(a)*149),(192+math.cos(a)*r,192+math.sin(a)*r)],fill=(48,55,45),width=3)
  if i%12==0:
   d.text((192+math.cos(a)*105,192+math.sin(a)*105),str(920+i*2),font=font(17),anchor='mm',fill=(53,62,54))
 d.text((192,238),'hPa',font=font(20),anchor='mm',fill=(64,66,53));d.line((192,192,152,79),fill=(131,52,30),width=6);d.ellipse((183,183,201,201),fill=(57,61,50));im.save(A/'Textures/Pressure.png')
 im=Image.new('RGB',(512,384),(202,194,161));d=ImageDraw.Draw(im);d.text((25,19),'FIELD RECORD   /   17',font=font(23,1),fill=(56,64,57))
 for j in range(8):
  y=75+j*35;d.line((22,y+18,490,y+18),fill=(157,159,137));d.text((24,y),f'0{j//4+2}:{(j%4)*15:02}',font=font(15),fill=(62,73,66))
  for i in range(3):d.line([(100+i*126+k*4,y+8+rnd.integers(-5,6)) for k in range(17)],fill=(82,98,91),width=2)
 im.save(A/'Textures/Notes.png')
if __name__=='__main__':make()
