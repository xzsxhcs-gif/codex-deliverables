"""Validate saved Unity YAML (not authoring inputs), binary vertex data and connected walkable floor."""
from pathlib import Path
from tempfile import gettempdir
import hashlib, json,re,math,sys
from collections import deque
import numpy as np,yaml
from scipy.io.wavfile import read
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parents[1];A=ROOT/'Assets/SummitStation';V=ROOT/'Verification'
def load(p):
 text=p.read_text(); sections=re.split(r'^--- !u!(\d+) &(\d+)\s*$',text,flags=re.M)[1:];out={}
 for idx in range(0,len(sections),3):
  kind,id,body=sections[idx:idx+3];obj=yaml.safe_load(body);key=next(iter(obj));out[int(id)]=(key,obj[key])
 return out
def xyz(d):return [d[k] for k in 'xyz']
def run():
 metas={};counts={};triangles=0;vcount=0;sizes=[];allcols=[];draw=[];lights=[];coords={}
 for p in ROOT.glob('Assets/**/*.meta'):
  g=re.search(r'^guid: (\w+)',p.read_text(),re.M)[1];assert g not in metas;metas[g]=Path(str(p)[:-5]);assert metas[g].exists()
 def get(r):return metas[r['guid']]
 scene=A/'Scenes/StormWatch.unity';docs=load(scene);checks={}
 walker=next(v for t,v in docs.values() if t=='CharacterController');assert walker['m_Radius']==.27
 meshdata={}
 for guid,p in metas.items():
  if p.suffix in ['.prefab','.asset','.mat','.unity']:
   for g in re.findall(r'guid: ([0-9a-f]{32})',p.read_text()):assert g in metas or g=='0000000000000000f000000000000000',str(p)+g
  if p.suffix!='.asset':continue
  data=load(p)[4300000][1];vb=data['m_VertexData'];b=bytes.fromhex(vb['_typelessdata']);assert len(b)==vb['m_DataSize']==vb['m_VertexCount']*48
  v=np.frombuffer(b,'<f4').reshape(-1,12);assert np.isfinite(v).all()
  idx=np.frombuffer(bytes.fromhex(data['m_IndexBuffer']),'<u2' if data['m_IndexFormat']==0 else '<u4').reshape(-1,3)
  assert idx.max()<len(v) and idx.size==data['m_SubMeshes'][0]['indexCount']
  bbox=data['m_LocalAABB'];center=np.array(xyz(bbox['m_Center']));ext=np.array(xyz(bbox['m_Extent']));assert np.all(abs(v[:,:3]-center)<=ext+1e-4)
  meshdata[p.stem]=(v,idx);triangles+=len(idx);vcount+=len(v)
 for _,(typ,pi) in docs.items():
  if typ!='PrefabInstance':continue
  p=get(pi['m_SourcePrefab']);pf=load(p);mods={o['propertyPath']:o['value'] for o in pi['m_Modification']['m_Modifications']}
  for o in pi['m_Modification']['m_Modifications']:assert o['target']['fileID'] in pf
  pos=[mods['m_LocalPosition.'+k] for k in 'xyz'];ang=2*math.atan2(mods['m_LocalRotation.y'],mods['m_LocalRotation.w'])
  def world(c):
   x,y,z=c;return [pos[0]+x*math.cos(ang)+z*math.sin(ang),pos[1]+y,pos[2]-x*math.sin(ang)+z*math.cos(ang)]
  coords[p.stem]=pos
  for id,(t,v) in pf.items():
   if t=='GameObject':
    for cmp in v['m_Component']:assert cmp['component']['fileID'] in pf
   elif t=='Transform':
    assert not v['m_Father']['fileID'] or v['m_Father']['fileID'] in pf
    for ch in v['m_Children']:assert ch['fileID'] in pf
   elif t=='MeshRenderer':
    go=pf[v['m_GameObject']['fileID']][1]
    filt=next(pf[c['component']['fileID']][1] for c in go['m_Component'] if pf[c['component']['fileID']][0]=='MeshFilter')
    mesh=get(filt['m_Mesh']).stem;mat=get(v['m_Materials'][0]).stem
    assert mesh in meshdata;draw.append([mesh,mat,pos,ang])
   elif t=='BoxCollider' or t=='Light':
    g=pf[v['m_GameObject']['fileID']][1];tr=pf[g['m_Component'][0]['component']['fileID']][1];c=world(xyz(tr['m_LocalPosition']))
    if t=='BoxCollider' and v.get('m_IsTrigger'):continue
    if t=='BoxCollider':allcols.append((p.stem,c,xyz(v['m_Size']),ang))
    else:lights.append((c,[v['m_Color'][k] for k in 'rgb'],v['m_Intensity']))
   elif t=='MonoBehaviour':counts[v['role']]=counts.get(v['role'],0)+1
 # Exhaustively test human-scale clearance on a 10cm XZ grid, including open doors at their saved angle.
 X,Z=np.meshgrid(np.arange(-10.5,30.5,.1),np.arange(-4.6,7.9,.1));floor=np.zeros(X.shape,bool);blocked=floor.copy()
 rad=.27
 for _,c,size,ang in allcols:
  x,y,z=c;w,h,d=np.array(size)/2;lx=abs((X-x)*math.cos(ang)-(Z-z)*math.sin(ang));lz=abs((X-x)*math.sin(ang)+(Z-z)*math.cos(ang))
  if -.04<=y+h<=.04:floor|=(lx<=w+.003)&(lz<=d+.003)
  elif y+h>.055 and y-h<1.83:blocked|=np.hypot(np.maximum(lx-w,0),np.maximum(lz-d,0))<rad+.015
 ok=floor&~blocked
 def grid(x,z):return (int(round((z+4.6)*10)),int(round((x+10.5)*10)))
 start=grid(-4.7,2.45);assert ok[start]
 q=deque([start]);dist={start:0}
 while q:
  z,x=q.popleft()
  for n in [(z-1,x),(z+1,x),(z,x-1),(z,x+1)]:
   if n in dist or min(n)<0 or n[0]>=len(ok) or n[1]>=ok.shape[1] or not ok[n]:continue
   dist[n]=dist[z,x]+1;q.append(n)
 destinations={'console':(-5.5,4.7),'quarters':(3.5,4.6),'corridor':(.8,-1.4),'lamp dock':(2.75,-1.88),'ridge walk':(16,-1.4),'mast overlook':(10.35,3.4),'repair cabinet':(24.6,-1.35),'engine inspection':(27.5,-1.6)}
 for name,pt in destinations.items():
  assert grid(*pt) in dist,'Unreachable: '+name
 checks['destinations_path_m']={k:round(dist[grid(*v)]*.1,1) for k,v in destinations.items()}
 checks.update(scene=scene.name,zone_and_prop_prefabs=len(coords),native_meshes=len(meshdata),triangles=triangles,vertices=vcount,materials=len(list((A/'Materials').glob('*.mat'))),colliders=len(allcols),practical_lights=len(lights),socket_roles=counts,validated_external_guids=len(metas))
 for p in (A/'Audio').glob('*.wav'):
  sr,x=read(p);assert sr==22050 and np.max(abs(x.astype(float)))<32768 and x.std()>100
 for p in (A/'Textures').iterdir():
  if p.suffix in ['.png','.jpg']:Image.open(p).verify()
 V.mkdir(exist_ok=True);(V/'SceneChecks.json').write_text(json.dumps(checks,indent=2));print(checks)
 if '--preview-data' in sys.argv:
  target=(Path(gettempdir()) / 'summit17-review');target.mkdir(exist_ok=True)
  packed={}
  for k,(v,i) in meshdata.items():packed[k+'__v']=v;packed[k+'__i']=i
  np.savez(target/'meshes.npz',**packed);(target/'instances.json').write_text(json.dumps(dict(draw=draw,lights=lights)))
if __name__=='__main__':run()
