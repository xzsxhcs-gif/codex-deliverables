"""Original editorial illustrations. MIT code; generated graphics CC BY-SA 4.0.

No photographs, external art, geographic boundaries or downloaded assets are used.
Coordinates describe a 1000 x 600 artboard; render at double resolution for AA.
"""
from pathlib import Path
import math
from PIL import Image, ImageDraw, ImageFont

CREAM = '#F3EDE2'
TEAL = '#123E3A'
CLAY = '#B85E3F'
GOLD = '#C8A66B'
MUTED = '#67736A'
RULE = '#D8CDBA'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SERIF = '/usr/share/fonts/opentype/urw-base35/P052-Roman.otf'
SCALE = 2


def _board():
    image = Image.new('RGB', (2000, 1200), CREAM)
    return image, ImageDraw.Draw(image)


def _font(size, kind='sans'):
    return ImageFont.truetype({'sans': SANS, 'bold': BOLD, 'serif': SERIF}[kind], round(size*SCALE))


def _text(draw, xy, text, size=28, fill=TEAL, kind='sans', anchor=None):
    draw.text(tuple(round(v*SCALE) for v in xy), text, font=_font(size,kind), fill=fill, anchor=anchor)


def _line(draw, points, fill=TEAL, width=3):
    draw.line([(round(x*SCALE),round(y*SCALE)) for x,y in points], fill=fill, width=round(width*SCALE), joint='curve')


def _rect(draw, box, fill=None, outline=None, width=2, radius=0):
    coords=tuple(round(v*SCALE) for v in box)
    if radius:
        draw.rounded_rectangle(coords, radius=round(radius*SCALE), fill=fill, outline=outline, width=round(width*SCALE))
    else:
        draw.rectangle(coords, fill=fill, outline=outline, width=round(width*SCALE))


def _ellipse(draw, box, fill=None, outline=None, width=2):
    draw.ellipse(tuple(round(v*SCALE) for v in box), fill=fill, outline=outline, width=round(width*SCALE))


def _polygon(draw, points, fill, outline=None, width=2):
    coords=[(round(x*SCALE),round(y*SCALE)) for x,y in points]
    draw.polygon(coords,fill=fill)
    if outline: draw.line(coords+[coords[0]],fill=outline,width=round(width*SCALE),joint='curve')


def _finish(image, size):
    return image.resize(size,Image.Resampling.LANCZOS)


def draw_location(size=(1000,600)):
    """Administrative hierarchy, deliberately not a geographic map."""
    image, draw = _board()
    _text(draw,(60,42),'LOCATION GUIDE',21,kind='bold')
    _line(draw,[(60,83),(940,83)],RULE,1)
    rows=[('01','EASTERN CHINA','REGION',60,119,32),
          ('02','ZHEJIANG','PROVINCE',124,219,39),
          ('03','JINHUA','ADMINISTERS YONGKANG',188,319,44),
          ('04','YONGKANG','COUNTY-LEVEL CITY',252,419,52)]
    for n,label,sub,x,y,font in rows:
        if n!='01':
            _line(draw,[(x-42,y-20),(x-42,y+28),(x-10,y+28)],GOLD,2)
        _ellipse(draw,(x,y+7,x+44,y+51),CREAM,TEAL,2)
        _text(draw,(x+22,y+29),n,15,TEAL,'sans','mm')
        _text(draw,(x+66,y),label,font,TEAL,'serif' if n=='04' else 'bold')
        _text(draw,(x+67,y+font+11),sub,15,MUTED)
    _rect(draw,(318,505,738,510),CLAY)
    _text(draw,(60,555),'An introduction to Yongkang, Zhejiang Province.',18,MUTED)
    return _finish(image,size)


def _drill(draw,cx=190,cy=284):
    p=[(-105,-42),(12,-57),(58,-20),(29,27),(-6,18),(-18,111),(-65,109),(-57,18),(-105,9)]
    _polygon(draw,[(cx+x,cy+y) for x,y in p],TEAL)
    _polygon(draw,[(cx-101,cy-35),(cx+9,cy-49),(cx+30,cy-31),(cx-9,cy-4),(cx-101,cy-5)],CLAY)
    _rect(draw,(cx+44,cy-25,cx+82,cy+3),TEAL,radius=3)
    _line(draw,[(cx+84,cy-11),(cx+122,cy-11)],TEAL,7)
    _line(draw,[(cx+105,cy-17),(cx+116,cy-6)],GOLD,2)
    _rect(draw,(cx-80,cy+104,cx-6,cy+122),TEAL,radius=5)
    _rect(draw,(cx-22,cy+20,cx+1,cy+37),GOLD,radius=3)
    for y in [46,59,72,85]:_line(draw,[(cx-56,cy+y),(cx-27,cy+y+3)],CREAM,2)
    for x in [-82,-67,-52]:_line(draw,[(cx+x,cy-24),(cx+x+7,cy-10)],GOLD,2)


def _door(draw,cx=500,cy=300):
    _rect(draw,(cx-84,cy-107,cx+84,cy+115),None,TEAL,7)
    _rect(draw,(cx-67,cy-90,cx+67,cy+115),TEAL,radius=2)
    _rect(draw,(cx-49,cy-72,cx+48,cy-11),None,GOLD,2)
    _rect(draw,(cx-49,cy+7,cx+48,cy+96),None,GOLD,2)
    _ellipse(draw,(cx+33,cy-1,cx+44,cy+10),GOLD)
    _line(draw,[(cx+37,cy+5),(cx+18,cy+5)],GOLD,4)
    _line(draw,[(cx-91,cy+117),(cx+91,cy+117)],TEAL,5)


def _pot(draw,cx=810,cy=320):
    _rect(draw,(cx-89,cy-33,cx+89,cy+65),TEAL,radius=18)
    _rect(draw,(cx-110,cy-22,cx-76,cy+10),None,TEAL,6,radius=8)
    _rect(draw,(cx+76,cy-22,cx+110,cy+10),None,TEAL,6,radius=8)
    _rect(draw,(cx-84,cy-31,cx+84,cy-23),CLAY,radius=3)
    _ellipse(draw,(cx-91,cy-57,cx+91,cy-19),TEAL)
    _ellipse(draw,(cx-75,cy-55,cx+75,cy-29),CREAM)
    _rect(draw,(cx-18,cy-69,cx+18,cy-51),TEAL,radius=6)
    _line(draw,[(cx-57,cy-3),(cx-57,cy+32)],GOLD,3)
    _line(draw,[(cx-44,cy-4),(cx-44,cy+15)],GOLD,2)


def draw_hardware(size=(1000,600)):
    """Non-branded product examples, not a photograph of a factory."""
    image,draw=_board()
    _text(draw,(60,42),'MAKING EVERYDAY LIFE',21,kind='bold')
    _text(draw,(60,83),'Useful objects. A wider connection.',36,kind='serif')
    _line(draw,[(60,145),(940,145)],RULE,1)
    _drill(draw);_door(draw);_pot(draw)
    for center,label,n in [(190,'POWER TOOLS','01'),(500,'HOUSEHOLD DOORS','02'),(810,'KITCHENWARE','03')]:
        _line(draw,[(center-120,443),(center+120,443)],RULE,1)
        _text(draw,(center,482),label,22,TEAL,'bold','mm')
        _text(draw,(center,525),n,16,CLAY,'sans','mm')
    _text(draw,(500,570),'Illustration · examples of local products',17,MUTED,'sans','mm')
    return _finish(image,size)


def draw_food(size=(1000,600)):
    """Original diagram of the documented pork-and-preserved-vegetable flatbread."""
    image,draw=_board()
    _text(draw,(60,42),'A LOCAL TASTE',21,kind='bold')
    _line(draw,[(60,83),(940,83)],RULE,1)
    cx,cy,rx,ry=325,318,228,166
    _ellipse(draw,(cx-rx+12,cy-ry+33,cx+rx+12,cy+ry+33),'#E4D8C3')
    _ellipse(draw,(cx-rx,cy-ry+14,cx+rx,cy+ry+20),'#A25D32')
    _ellipse(draw,(cx-rx,cy-ry,cx+rx,cy+ry),'#C68B45',TEAL,2)
    _ellipse(draw,(cx-rx+13,cy-ry+8,cx+rx-13,cy+ry-8),'#DFA960')
    # Toast marks remain geometric and clearly illustrative.
    for i in range(72):
        a=i*2.3999632297;r=math.sqrt((i+.5)/72)*.92
        x=cx+math.cos(a)*rx*r;y=cy+math.sin(a)*ry*r
        if x>cx+32 and y>cy-10:continue
        k=3+(i*7)%10
        _ellipse(draw,(x-k,y-k*.45,x+k,y+k*.45),'#B4793B' if i%3 else '#A36532')
    # Front cutaway exposes layers rather than mimicking a food photograph.
    wedge=[(cx+12,cy+4),(cx+rx-9,cy+35),(cx+149,cy+130)]
    _polygon(draw,[(x,y+17) for x,y in wedge],'#AA643B',TEAL,2)
    _polygon(draw,wedge,'#E9C68F',TEAL,2)
    inner=[(cx+43,cy+20),(cx+rx-30,cy+42),(cx+146,cy+108)]
    _polygon(draw,inner,'#8E6445')
    for i in range(27):
        u=((i*37)%97)/97;v=((i*53)%89)/89
        if u+v>1:u,v=1-u,1-v
        x=inner[0][0]+u*(inner[1][0]-inner[0][0])+v*(inner[2][0]-inner[0][0])
        y=inner[0][1]+u*(inner[1][1]-inner[0][1])+v*(inner[2][1]-inner[0][1])
        _ellipse(draw,(x-5,y-3,x+5,y+3),'#536B43' if i%2 else '#D7A07A')
    _text(draw,(594,216),'ROUMAIBING',44,TEAL,'serif')
    _rect(draw,(594,306,907,311),CLAY)
    _text(draw,(594,340),'pork +',29,TEAL)
    _text(draw,(594,383),'preserved vegetables',25,TEAL)
    _text(draw,(594,445),'a savory local flatbread',20,MUTED)
    _text(draw,(60,553),'Original illustration · roumaibing',18,MUTED)
    return _finish(image,size)


def main():
    root=Path(__file__).resolve().parents[1]
    directory=root/'assets/graphics';directory.mkdir(parents=True,exist_ok=True)
    for name,fn in [('location',draw_location),('hardware',draw_hardware),('roumaibing',draw_food)]:
        result=fn();result.save(directory/f'{name}.png');print(directory/f'{name}.png')

if __name__=='__main__':main()
