from pathlib import Path
from PIL import Image,ImageDraw,ImageFont,ImageOps
v=Path(__file__).resolve().parents[1]/'Verification'
def font(size,bold=False):
 return ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans'+('-Bold' if bold else '')+'.ttf',size)
def build():
 im=Image.new('RGB',(1424,1086),'#182326');d=ImageDraw.Draw(im)
 d.text((32,19),'MS–17    /    STORM WATCH',font=font(32,True),fill='#ebede1')
 d.text((34,70),'RIDGE OBSERVATORY      /      UNITY SCENE GEOMETRY      /      BLENDER LIGHTING STUDIES',font=font(14),fill='#a7b9b1')
 order=[('06_Summit','Summit observatory'),('01_Control','Night observations'),('04_RidgeWalk','Weather deck'),('05_Engine','Standby plant'),('02_Quarters','Watch quarters'),('03_NightCorridor','Service spine')]
 for i,(file,label) in enumerate(order):
  x=32+(i%2)*688;y=108+(i//2)*318
  picture=Image.open(v/(file+'.jpg'));im.paste(ImageOps.fit(picture,(672,273)),(x,y))
  d.text((x,y+279),label,font=font(18),fill='#dfddcb')
 im.save(v/'Overview.jpg',quality=92)
if __name__=='__main__':build()
