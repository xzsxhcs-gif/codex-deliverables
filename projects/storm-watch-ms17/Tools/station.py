from geometry import *
from math import exp
zones=[]
def zone(name,pos=(0,0,0),yaw=0,kind=''):
 s=Zone(name,pos,yaw,kind);zones.append(s);return s
# Wall strips are authored around cutouts. Doors are never sealed by a box collider.
def wall(s,axis,fixed,start,end,height,openings=(),metal='FireratedWall'):
 def strip(a,b,y0,y1,mat,depth,offs=0,solid=False):
  if b<=a or y1<=y0:return
  mid=(a+b)/2;y=(y0+y1)/2
  c=(mid,y,fixed+offs) if axis=='x' else (fixed+offs,y,mid)
  sz=(b-a,y1-y0,depth) if axis=='x' else (depth,y1-y0,b-a)
  s.box(mat,c,sz,solid=solid)
 def skin(a,b,lo,hi):
  strip(a,b,lo,hi,metal,.21,solid=True)
  for offset in [-.11,.11]:
   strip(a,b,max(lo,.06),min(hi,.19),'Iron',.04,offset)
   strip(a,b,max(lo,.85),min(hi,.92),'Enamel',.03,offset)
   strip(a,b,max(lo,2.98),min(hi,3.07),'Zinc',.035,offset)
   for p in np.arange(start+.85,end,1.25):
    if a+.075<p<b-.075:strip(p,p+.012,lo+.03,hi-.02,'Zinc',.013,offset)
 cur=start
 for a,b,lo,hi in sorted(openings):
  skin(cur,a,0,height);skin(a,b,0,lo);skin(a,b,hi,height)
  for p in [a,b]:strip(p-.047,p+.047,lo,hi,'Enamel',.28)
  strip(a-.045,b+.045,hi-.045,hi+.045,'Enamel',.28)
  if lo>0:
   strip(a,b,lo-.055,lo+.04,'Enamel',.32)
   # actual pane with transparent Standard material, gasket and central mullions
   strip(a,b,lo+.02,hi-.03,'Glass',.009)
   for p in np.arange(a+1.45,b-.25,1.45):strip(p-.028,p+.028,lo,hi,'Iron',.18)
  cur=b
 skin(cur,end,0,height)
def room_floor(s,x0,x1,z0,z1,height=3.35):
 cx=(x0+x1)/2;cz=(z0+z1)/2;w=x1-x0;l=z1-z0
 s.box('Concrete',(cx,-.25,cz),(w,.5,l),solid=True);s.box('Roof',(cx,height+.17,cz),(w+.40,.28,l+.4))
 for z in np.arange(z0+.42,z1,.95):s.box('Zinc',(cx,height-.06,z),(w,.12,.075))
 s.box('FireratedWall',(cx,height+.005,cz),(w,.05,l))
def fixture(s,x,y,z,color='WarmLight',length=1.25):
 s.box('Gasket',(x,y+.04,z),(length+.16,.11,.25),.04)
 s.box(color,(x,y-.035,z),(length,.065,.17),.025)
 for i in [-.46,.46]:s.box('Iron',(x+i*length,y-.035,z),(.025,.082,.2))
 s.lamp((x,y-.27,z),(.98,.79,.54) if color=='WarmLight' else (.62,.84,1),1.85,7.8)
def panel(s,x,y,z,art,w,h,side='S'):
 if side in ['S','N']: dep=(w+.04,h+.04,.04);off=(0,0,-.023 if side=='S' else .023)
 else:dep=(.04,h+.04,w+.04);off=(.023 if side=='E' else -.023,0,0)
 s.box('Enamel',(x,y,z),dep,.008)
 s.sign(art,tuple(np.array([x,y,z])+off),w,h,side)
def door(name,pos,yaw,width):
 # Build in hinge-local coordinates. Door leaf points along local +X and opens inwards.
 s=zone(name,pos,yaw,'DoorHinge');s.box('Enamel',(width/2,1.1,0),(width,2.20,.078),.026,True)
 for sign in [-1,1]:
  s.box('FireratedWall',(width/2,1.53,sign*.044),(width-.18,.90,.022),.015)
  s.box('Iron',(width/2,.23,sign*.046),(width-.13,.32,.019),.01)
  s.box('Ochre',(width-.17,1.03,sign*.055),(.12,.31,.035),.02)
  s.path('Zinc',[(width-.17,1.05,sign*.06),(width-.17,1.05,sign*.13),(width-.33,1.05,sign*.13)],.019)
 for y in [.29,1.13,1.97]:s.rod('Zinc',(0,y,0),(0,y+.14,0),.034)
 return s
control=zone('01_Observations');living=zone('02_NightQuarters');hall=zone('03_ServiceSpine');deck=zone('04_RidgeWalk');gen=zone('05_GeneratorHouse');terrain=zone('06_BasaltMassif');mast=zone('07_TelemetryMast')
room_floor(control,-10,0,0,7.5);room_floor(living,0,6.6,0,7.5);room_floor(hall,-10,6.6,-2.8,0)
wall(control,'x',7.5,-10,0,3.35,[(-9.05,-.8,1.16,2.86)])
wall(control,'z',-10,0,7.5,3.35,[(1.1,5.9,1.23,2.83)])
wall(control,'x',0,-10,0,3.35,[(-4.15,-2.55,0,2.34)])
wall(living,'z',0,0,7.5,3.35);wall(living,'z',6.6,0,7.5,3.35,[(3.1,6.55,1.25,2.75)])
wall(living,'x',7.5,0,6.6,3.35,[(1.6,5,1.25,2.75)])
wall(living,'x',0,0,6.6,3.35,[(1.8,3.4,0,2.34)])
wall(hall,'x',-2.8,-10,6.6,3.35,[(-7.9,-4.5,1.2,2.8),(-.5,1.6,1.2,2.8)])
wall(hall,'z',-10,-2.8,0,3.35);wall(hall,'z',6.6,-2.8,0,3.35,[(-2.22,-.62,0,2.32)])
room_floor(gen,22,30,-4.2,2.8,3.55);wall(gen,'z',22,-4.2,2.8,3.55,[(-2.22,-.62,0,2.32)])
wall(gen,'z',30,-4.2,2.8,3.55);wall(gen,'x',2.8,22,30,3.55,[(23,25,1.7,2.86)]);wall(gen,'x',-4.2,22,30,3.55,[(24,28,2.1,2.9)])
door('D01_Control_Hinge',(-4.12,0,.14),-87,1.52);door('D02_Quarters_Hinge',(1.84,0,.14),-88,1.5)
door('D03_Exit_Hinge',(6.76,0,-2.18),-4,1.51);door('D04_Generator_Hinge',(22.14,0,-2.18),-5,1.51)
for s,x,z in [(control,-7.4,4.7),(control,-2.9,3.2),(living,3.2,4.7),(hall,-5.8,-1.39),(hall,3.4,-1.38),(gen,26,-1.4)]:
 fixture(s,x,3.15 if s!=gen else 3.38,z,'WarmLight' if s in [living,hall,gen] else 'CoolLight')
# Control desks: kickboard, side cheeks, monitor pedestal, separate bezels and display glass.
for i,(x,art) in enumerate([(-8.1,'Radar'),(-5.7,'Trace'),(-3.3,'Synoptic')]):
 z=5.75
 control.box('Gasket',(x,.075,z),(2.29,.15,.74),.035)
 control.box('Enamel',(x,.49,z),(2.22,.76,.78),.035,True)
 control.box('Laminate',(x,.915,z-.02),(2.38,.10,1.14),.035,True)
 for j in range(12):control.box('Gasket',(x-.78+j*.055,.43,z-.397),(.026,.38,.012))
 control.box('Zinc',(x,.991,z+.07),(.57,.038,.31),.013);control.rod('Iron',(x,1,z+.08),(x,1.24,z+.1),.04)
 control.box('Gasket',(x,1.51,z+.08),(1.1,.62,.105),.035)
 control.sign(art,(x,1.52,z+.025),1.035,.52)
 control.box('Iron',(x-.13,.987,z-.34),(.76,.034,.248),.013)
 for row in range(4):
  for col in range(13):control.box('Rubber',(x-.47+col*.055,1.011,z-.426+row*.052),(.047,.016,.04),.003)
 ctrl=zone('Console_%s_Selector'%i,(x+.73,.985,z-.31),0,'Rotary')
 ctrl.rod('Zinc',(0,0,0),(0,.065,0),.052,14);ctrl.box('Ochre',(0,.073,.025),(.013,.01,.036))
 for j in range(3):
  btn=zone('Console_%s_Key_%s'%(i,j),(x+.54+j*.115,.985,z+.04),0,'Button')
  btn.box('WarmLight' if j==0 else 'Enamel',(0,.024,0),(.08,.048,.075),.01)
for x in [-7.6,-3.65]:
 s=control;z=4.14
 s.rod('Iron',(x,.12,z),(x,.47,z),.055)
 for k in range(5):
  a=k*2*pi/5;end=(x+.33*cos(a),.11,z+.33*sin(a));s.rod('Zinc',(x,.19,z),end,.036);s.rod('Rubber',(end[0]-.035,.075,end[2]),(end[0]+.035,.075,end[2]),.056)
 s.box('Fabric',(x,.51,z),(.59,.13,.54),.06,True);s.rod('Iron',(x,.46,z-.19),(x,.95,z-.29),.036);s.box('Fabric',(x,.90,z-.27),(.54,.55,.095),.044)
# Storage and an instrument patch bay on the west side.
for z in [1.15,2.32]:
 control.box('Iron',(-9.43,1.06,z),(.78,2.12,1.01),.04,True)
 for j in range(8):
  y=.26+j*.232;control.box('Enamel',(-9.026,y,z),(.04,.197,.86),.008)
  for k in range(3):control.rod('CoolLight',(-9,y,z-.22+k*.068),(-8.993,y,z-.22+k*.068),.013,8)
  control.rod('Zinc',(-8.98,y-.045,z+.31),(-8.98,y+.045,z+.31),.014)
# Architectural conduit follows the ceiling, with brackets and elbow offsets.
for s,xa,xb,z in [(control,-9.7,-.3,6.92),(hall,-9.7,6.26,-2.34),(gen,22.35,29.6,2.26)]:
 for i in range(3):
  zz=z+i*.115;s.path('Zinc',[(xa,2.46,zz),(xa,2.93,zz),(xa+.17,3.07,zz),(xb-.2,3.07,zz),(xb,2.92,zz),(xb,2.41,zz)],.031 if i!=2 else .044)
 for x in np.arange(xa+.5,xb,1.65):s.box('Iron',(x,3.01,z+.1),(.045,.055,.46))
# Night quarters, two built-in bunks, bedding, ladder, kitchenette, fold-down mess table.
for level in [0,1]:
 y=.38+level*1.19
 living.box('Enamel',(1.02,y,4.91),(1.48,.14,2.55),.04,True)
 living.box('Bedlinen',(1.02,y+.155,4.91),(1.40,.19,2.45),.086)
 living.box('Blanket',(1.02,y+.26,4.49),(1.43,.10,1.58),.045)
 for j in range(4):living.box('Fabric',(1.02,y+.314,4.13+j*.12),(1.41,.012,.017))
 living.box('Bedlinen',(1.02,y+.30,5.72),(1.10,.18,.46),.08)
for x in [.30,1.73]:
 for z in [3.66,6.15]:living.rod('Zinc',(x,.015,z),(x,2.48,z),.033)
for j in range(5):living.rod('Zinc',(1.76,.25+j*.32,3.7),(1.76,.25+j*.32,4.2),.019)
living.rod('Zinc',(1.76,0,4.2),(1.76,2.12,4.2),.03)
living.box('Enamel',(4.75,.45,6.92),(2.8,.88,.85),.037,True);living.box('Laminate',(4.75,.93,6.91),(2.91,.09,.96),.025)
for i in range(3):
 d=zone('Galley_Cabinet_%d'%i,(3.42+i*.88,0,6.48),0,'CabinetHinge')
 d.box('FireratedWall',(.42,.49,0),(.82,.72,.043),.015);d.rod('Zinc',(.66,.63,-.055),(.66,.78,-.055),.014)
living.path('Zinc',[(4.32,.99,7.15),(4.32,1.26,7.15),(4.32,1.32,7.1),(4.32,1.32,6.91),(4.32,1.26,6.88)],.019)
living.box('Iron',(4.32,.983,6.92),(.56,.016,.40),.007)
living.rod('Zinc',(5.69,.98,6.91),(5.69,1.27,6.91),.142,20,.115);living.rod('Gasket',(5.69,1.27,6.91),(5.69,1.31,6.91),.12)
for k in range(2):
 x=5.14+k*.21;living.rod('Bedlinen',(x,.98,6.72),(x,1.095,6.72),.054,16); living.rod('Gasket',(x,1.096,6.72),(x,1.098,6.72),.043,16)
living.box('Laminate',(5.89,.79,2.0),(1.13,.09,1.75),.039,True)
for z in [1.38,2.62]:living.rod('Zinc',(5.48,.02,z),(5.48,.77,z),.034)
living.box('Paper',(5.75,.848,1.89),(.38,.018,.51),.007)
for z in [1.7,2.5]:
 living.rod('Fabric',(4.91,.43,z),(4.91,.54,z),.245,18);living.rod('Iron',(4.91,.035,z),(4.91,.43,z),.047)
# Hall textile locker, fuse chart, torch dock. Pivot and natural handle origins stored per prefab.
for i in range(4):
 x=-9.35+i*.57;hall.box('Enamel',(x,1.02,-.39),(.55,2.04,.54),.028,True)
 for k in range(5):hall.box('Iron',(x,1.67+k*.047,-.668),(.33,.014,.01))
 hall.box('Zinc',(x+.15,1.03,-.692),(.045,.17,.043),.01)
panel(hall,-2.0,1.67,-.122,'Control',.98,.49)
panel(hall,4.25,1.66,-.122,'Quarters',.98,.49)
panel(hall,4.08,1.80,-2.66,'Exit',1.24,.62,'N')
panel(hall,2.73,1.56,-2.66,'Torch',.68,.34,'N')
hall.box('Enamel',(2.72,.96,-2.51),(1.4,.085,.36),.027,True)
torch=zone('EmergencyLamp_Grip',(2.75,1.055,-2.49),0,'Grip')
torch.rod('Gasket',(-.15,0,0),(.07,0,0),.047,20);torch.rod('Ochre',(.06,0,0),(.135,0,0),.048,20,.079);torch.rod('Iron',(.135,0,0),(.16,0,0),.08,20);torch.rod('CoolLight',(.161,0,0),(.163,0,0),.063,20)
for j in range(7):torch.rod('Iron',(-.14+j*.024,0,0),(-.132+j*.024,0,0),.051,16)
drawer=zone('ServiceDesk_Drawer',(2.69,.8,-2.52),0,'DrawerSlide');drawer.box('Iron',(0,0,0),(.75,.23,.3),.016);drawer.rod('Zinc',(-.16,0,.185),(.16,0,.185),.016)
# Steel service bridge, cross-braced supports, separate observation platform.
def slab(s,xa,xb,za,zb):
 s.box('RoadSteel',((xa+xb)/2,-.10,(za+zb)/2),(xb-xa,.2,zb-za),solid=True)
 for z in [za+.08,zb-.08]:
  for y in [-.25,-.65]:s.box('Zinc',((xa+xb)/2,y,z),(xb-xa,.074,.18))
  s.box('Iron',((xa+xb)/2,-.45,z),(xb-xa,.43,.07))
 for x in np.arange(xa+.25,xb,.92):
  s.box('Zinc',(x,.006,(za+zb)/2),(.012,.009,zb-za))
 for x in np.arange(xa+.35,xb,3.0):
  for z in [za+.16,zb-.16]:
   s.rod('Iron',(x,-5,z),(x,-.22,z),.108,10);s.rod('Zinc',(x,-2.65,z),(min(x+2.69,xb),-.45,z),.05)
def rail(xa,za,xb,zb):
 v=np.array([xb-xa,zb-za]);length=np.linalg.norm(v);pieces=math.ceil(length/1.55)
 for i in range(pieces+1):
  x,z=np.array([xa,za])+v*i/pieces
  deck.box('Iron',(x,.045,z),(.19,.09,.19),.018);deck.rod('Zinc',(x,.07,z),(x,1.13,z),.034)
 for h in [.53,1.12]:deck.rod('Zinc',(xa,h,za),(xb,h,zb),.032 if h==1.12 else .021)
 deck.col(((xa+xb)/2,.55,(za+zb)/2),(max(abs(xb-xa),.09),1.1,max(abs(zb-za),.09)))
slab(deck,6.5,22.12,-2.83,.02);slab(deck,8.8,12,.02,6.8)
rail(6.68,-2.77,21.9,-2.77);rail(6.67,-.03,8.85,-.03);rail(11.93,-.03,21.93,-.03)
rail(8.86,0,8.86,6.73);rail(11.94,0,11.94,6.73);rail(8.86,6.73,11.94,6.73)
for x in [7.8,13.4,18.65,21.1]:
 deck.box('Iron',(x,.76,-2.72),(.14,.35,.13),.035);deck.box('WarmLight',(x,.79,-2.639),(.095,.19,.04),.017)
 if x in [7.8,18.65]:deck.lamp((x,.94,-2.45),(1,.56,.25),1.25,5.3)
for x in np.arange(7.4,21.8,.45):
 for z in [-2.44,-.30]:deck.box('Ochre',(x,.009,z),(.22,.006,.060))
# Exterior wall lamps and weatherproof plaques.
panel(deck,6.74,2.15,-.16,'Tag',.84,.42,'E');panel(gen,21.86,1.85,.40,'Generator',1.3,.65,'W')
# Generator skid, cast engine, cooling bank, belt shroud and insulated exhaust.
gen.box('Concrete',(27.37,.15,.20),(3.87,.30,2.14),.08,True)
for z in [-.51,.88]:gen.box('Iron',(27.37,.39,z),(3.46,.20,.19),.018)
for x in [26.10,28.57]:
 for z in [-.51,.88]:gen.box('Rubber',(x,.55,z),(.32,.15,.26),.028)
gen.box('Enamel',(27.48,1.02,.17),(1.61,.86,.90),.12,True)
for x in np.arange(26.86,28.18,.26):
 gen.rod('Iron',(x,1.24,-.01),(x,1.55,-.21),.15,12);gen.box('Enamel',(x,1.54,-.22),(.22,.19,.31),.047)
 gen.path('Copper',[(x,1.61,-.19),(x,1.69,-.19),(x-.07,1.76,-.10),(x-.07,1.76,.15)],.018)
gen.rod('Iron',(25.88,1.05,.16),(26.75,1.05,.16),.42,24,.38)
for x in np.arange(25.94,26.70,.075):gen.rod('Zinc',(x,1.05,.16),(x+.022,1.05,.16),.414,24)
gen.box('Gasket',(28.95,1.19,.16),(.46,1.23,1.33),.055,True)
for i in range(18):gen.box('Zinc',(28.96,.63+i*.061,-.522),(.38,.021,.03))
gen.path('Iron',[(28.02,1.55,.54),(28.02,1.96,.64),(28.27,2.21,.91),(28.27,2.22,2.13),(28.27,2.45,2.41),(28.27,4.22,2.41)],.105,16)
gen.rod('Zinc',(28.27,3.7,2.41),(28.27,4.35,2.41),.155,18)
for i in range(3):
 gen.path('Gasket',[(26.2+i*.1,.82,-.15),(26.16,.49,-.57-i*.09),(25.66,.14,-.84-i*.08),(24.78,.14,-.89-i*.07),(24.62,.57,-1.05-i*.06)],.029)
gen.box('Enamel',(24.58,.92,-.10),(.96,1.84,.72),.045,True)
panel(gen,24.58,1.57,-.49,'Service',.77,.385)
for i in range(2):
 f=zone('ServicePanel_Fuse_%d'%i,(24.36+i*.36,1.0,-.51),0,'FuseSeat')
 f.rod('Copper',(0,-.16,0),(0,.15,0),.055,12);f.rod('Bedlinen',(0,-.09,0),(0,.09,0),.062,16)
sw=zone('ServicePanel_MainSwitch',(24.6,.61,-.51),0,'SwitchPivot');sw.box('Gasket',(0,0,0),(.25,.32,.055),.02);sw.rod('Iron',(0,0,-.025),(0,.09,-.13),.025);sw.box('Umber',(0,.105,-.14),(.20,.073,.08),.026)
# Additional local storage and tool-board near the repair bay.
for i in range(2):
 x=26.0+i*.61
 gen.box('Ochre',(x,.48,2.16),(.53,.83,.43),.045,True);gen.box('Iron',(x,.91,2.16),(.26,.06,.12),.024)
panel(gen,27.22,2.04,2.65,'Log',1.06,.53)
# Lattice mast with service ladder, wind cups, aerial and guys.
cx,cz=10.39,5.51
def leg(j,y):
 radius=.75*(1-y/14.5)+.12
 return (cx+radius*cos(j*2*pi/3),y,cz+radius*sin(j*2*pi/3))
for j in range(3):
 mast.rod('Zinc',leg(j,.03),leg(j,12),.056,10,.032)
 for i in range(8):
  h=i*1.45+.08;mast.rod('Iron',leg(j,h),leg((j+1)%3,h+1.45),.025,7);mast.rod('Zinc',leg(j,h),leg((j+1)%3,h),.026)
mast.box('Concrete',(cx,.12,cz),(1.56,.24,1.42),.04,True)
mast.rod('Zinc',(cx,11.8,cz),(cx,13.6,cz),.052);mast.rod('Umber',(cx,13.6,cz),(cx,14,cz),.044)
for j in range(3):
 a=2*pi*j/3;end=(cx+.60*cos(a),13.35,cz+.60*sin(a))
 mast.rod('Iron',(cx,13.35,cz),end,.022);mast.rod('Zinc',end,(end[0]+.09*sin(a),13.36,end[2]-.09*cos(a)),.135,12,.061)
mast.rod('RedLight',(cx,14.0,cz),(cx,14.13,cz),.069,12)
# A wind-scoured summit and multiple asymmetric ridgelines descend beneath the platform.
def ground(x,z):
 summit=-2.45-.033*abs(x-6)-.027*abs(z)
 d=((x-5)/31)**2+((z-1)/18)**2
 noise=1.6*sin(x*.22+z*.19)+.9*cos(x*.37-z*.13)+.48*sin(x*.81+z*.48)
 local=summit-16*(1-exp(-max(0,d-.26)*.66))+noise*(.24+.75*min(1,d))
 ridges=sum(amp*exp(-((x-xc)/wx)**2-((z-zc)/wz)**2) for xc,zc,wx,wz,amp in [(-66,102,36,17,49),(-21,96,25,19,54),(18,128,35,27,62),(66,103,27,18,46),(112,56,22,60,53),(-100,21,26,34,44),(30,-102,44,24,51),(-48,-83,30,22,34)])
 return local+ridges+(sin(x*.18+z*.12)*3+cos(z*.32-x*.16)*1.7)*min(1,d/5)
grid=np.arange(-145,148,3.2);R=np.random.default_rng(17)
for i in range(len(grid)-1):
 for j in range(len(grid)-1):
  x,z=grid[i],grid[j];pts=[(x0,ground(x0,z0),z0) for x0,z0 in [(x,z),(x,z+3.2),(x+3.2,z+3.2),(x+3.2,z)]]
  for k,l in [(1,2),(2,3)]:
   a,b,c=pts[0],pts[k],pts[l];n=np.cross(np.subtract(b,a),np.subtract(c,a));grade=n[1]/np.linalg.norm(n)
   material='Snow' if a[1]>9+4*sin(x*.18) and grade>.70 else ('Scree' if grade>.93 else 'Basalt')
   terrain.face(material,[a,b,c])
# Anchored footings and diagonal substructure connect buildings to summit rock.
for s,xlist,zlist in [(control,[-9.55,-4.8,-.4],[.38,7.1]),(living,[.45,6.15],[.38,7.05]),(hall,[-9.55,-3.5,5.95],[-2.47]),(gen,[22.4,25.85,29.6],[-3.76,2.35])]:
 for x in xlist:
  for z in zlist:
   depth=ground(x,z)-1;s.box('Concrete',(x,(depth-.44)/2,z),(.63,-.44-depth,.63),.04)
# The radar head uses a faceted triangular sandwich-panel shell on a bolted base.
radar=zone('08_RadarRadome')
xc,zc=-6.9,3.45
radar.box('Iron',(xc,3.78,zc),(3.25,.52,3.25),.09);radar.rod('Enamel',(xc,3.93,zc),(xc,4.86,zc),1.19,32)
for y in [4.02,4.67,4.82]:radar.rod('Zinc',(xc,y,zc),(xc,y+.075,zc),1.30,32)
rings=[]
for row in range(7):
 angle=-.44+row*(pi/2+.44)/7;rr=2.02*cos(angle)
 rings.append([(xc+rr*cos(2*pi*(i+.5*(row%2))/18),5.72+2.02*sin(angle),zc+rr*sin(2*pi*(i+.5*(row%2))/18)) for i in range(18)])
for j in range(len(rings)-1):
 for i in range(18):
  a,b=rings[j][i],rings[j][(i+1)%18]; u,v=rings[j+1][i],rings[j+1][(i+1)%18]
  for face in [[a,u,b],[b,u,v]] if j%2==0 else [[a,v,b],[a,u,v]]:
   radar.face('Bedlinen',face)
  radar.rod('Zinc',a,b,.008,5);radar.rod('Zinc',a,u,.008,5);radar.rod('Zinc',b if j%2==0 else a,u if j%2==0 else v,.008,5)
for i in range(18):
 radar.face('Bedlinen',[rings[-1][i],(xc,7.74,zc),rings[-1][(i+1)%18]])
# Standing seams, rain conductors, curb flashings, ventilation cowls and cable entry glands.
for s,l,r,f,b,y in [(control,-10,0,0,7.5,3.35),(living,0,6.6,0,7.5,3.35),(hall,-10,6.6,-2.8,0,3.35),(gen,22,30,-4.2,2.8,3.55)]:
 for x in np.arange(l+.1,r,.64):s.box('Zinc',(x,y+.323,(f+b)/2),(.031,.043,b-f+.32))
 for z in [f-.16,b+.16]:s.box('Zinc',((l+r)/2,y+.15,z),(r-l+.35,.25,.11))
 for x in [l+.28,r-.25]:
  s.path('Zinc',[(x,y+.17,b+.19),(x,y-.07,b+.22),(x,y-.18,b+.15),(x,-.15,b+.15),(x,-.37,b+.36)],.056)
 for k in range(3):
  z=f+.6+k*.67;s.box('Zinc',(r+.145,1.36,z),(.078,.66,.51),.02)
  for q in range(7):s.box('Iron',(r+.19,1.14+q*.071,z),(.035,.026,.41))
for x,z in [(4.7,5.5),(25.7,1.5)]:
 genheight=3.55 if x>22 else 3.35
 h=genheight+.32;s=living if x<22 else gen
 s.rod('Zinc',(x,h,z),(x,h+.62,z),.295,20);s.rod('Iron',(x,h+.58,z),(x,h+.68,z),.42,20,.27)
 for i in range(5):s.rod('Zinc',(x,h+.13+i*.09,z),(x,h+.16+i*.09,z),.324,20)
# Rock clusters expose angular bedding planes around, but below, the catwalk.
for i in range(94):
 x,z=R.uniform(-40,54),R.uniform(-38,39)
 if -10.6<x<31 and -4.8<z<8.2:continue
 h=ground(x,z);lx,lz=R.uniform(.5,2.6),R.uniform(.5,1.8);lift=R.uniform(.4,1.65)
 lower=[];upper=[]
 for j in range(7):
  a=2*pi*j/7;rr=R.uniform(.78,1.1)
  lower.append((x+lx*rr*cos(a),h-.27,z+lz*rr*sin(a)))
  upper.append((x+.27+lx*.65*rr*cos(a),h+lift*(.68+.26*cos(a)),z+lz*.60*rr*sin(a)))
 for j in range(7):
  k=(j+1)%7;terrain.face('Basalt',[lower[j],upper[j],upper[k],lower[k]])
 terrain.face('Scree',upper[::-1])
# Human-scale work surfaces: paper synoptic survey, aneroid gauge, braided wiring, desk radio, inspection light.
panel(control,-9.86,1.82,6.52,'Survey',1.01,.60,'E')
panel(control,-6.64,1.75,.142,'Survey',1.41,.83,'N')
panel(hall,-5.34,1.60,-.14,'Log',.94,.47)
for s,x,y,z in [(control,-1.12,1.76,7.33),(gen,24.60,1.96,-.48)]:
 s.rod('Zinc',(x,y,z+.06),(x,y,z-.022),.181,28)
 s.sign('Pressure',(x,y,z-.024),.28,.28)
# Bound duty log and pencil on the console. Paper UVs occupy the full cover.
x,y,z=-4.47,.976,5.37
control.box('Umber',(x,y,z),(.48,.028,.34),.012);control.box('Paper',(x,y+.024,z),(.46,.025,.315),.01)
control.face('Notes',[(x-.22,y+.038,z-.15),(x-.22,y+.038,z+.15),(x+.22,y+.038,z+.15),(x+.22,y+.038,z-.15)],[(0,0),(0,1),(1,1),(1,0)])
control.rod('Ochre',(x+.16,y+.047,z-.14),(x+.04,y+.047,z+.12),.006,8)
for x in [-8.1,-5.7,-3.3]:
 for k in range(2):
  control.path('Gasket',[(x+.18+k*.07,1.34,5.90),(x+.21,1.12,6.04+k*.05),(x+.31,1.0,6.1+k*.05),(x+.6,.975,6.09+k*.05),(x+.81,.94,6.26),(x+.81,.49,6.30)],.009)
x,z=-2.48,5.83
control.box('Zinc',(x,1.094,z),(.46,.24,.28),.027);control.box('Gasket',(x,1.1,z-.15),(.405,.169,.017))
for i in range(9):control.box('Iron',(x-.16+i*.017,1.10,z-.168),(.008,.115,.014))
control.rod('Ochre',(x+.125,1.10,z-.161),(x+.125,1.10,z-.191),.041,16)
control.rod('Zinc',(x+.17,1.21,z+.08),(x+.23,1.68,z+.08),.007,8)
# Enamel mug with hollow rim and handle; no image billboards.
def mug(s,x,y,z):
 s.rod('Bedlinen',(x,y,z),(x,y+.12,z),.054,20,.061);s.rod('Gasket',(x,y+.121,z),(x,y+.123,z),.052,20)
 s.rod('Umber',(x,y+.10,z),(x,y+.112,z),.062,20);s.path('Bedlinen',[(x+.048,y+.097,z),(x+.091,y+.093,z),(x+.096,y+.052,z),(x+.052,y+.045,z)],.009)
mug(control,-6.47,.971,5.46)
# Corrugated radiator with valve and exposed tail pipes beneath corridor glazing.
for k in range(20):hall.box('FireratedWall',(-7.88+k*.10,.52,-2.59),(.083,.65,.16),.03)
hall.path('Copper',[(-8.22,.13,-2.61),(-8.22,.38,-2.61),(-7.86,.38,-2.61)],.025)
hall.rod('Umber',(-8.18,.38,-2.57),(-8.18,.38,-2.51),.071,12)
for x in [2.1,2.7,3.3]:
 living.box('Laminate',(x,1.64,7.33),(.48,.105,.08),.02)
 living.path('Zinc',[(x,1.64,7.28),(x,1.58,7.20),(x,1.65,7.17)],.016)
