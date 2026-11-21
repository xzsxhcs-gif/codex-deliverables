"""Write native, inspector-editable Unity assets. No editor-time generation dependency."""
import hashlib,sys,struct,json,math
from math import sin,cos
from pathlib import Path
import numpy as np
import yaml
from media import surfaces,A
from station import zones
ROOT=A.parents[1]
def guid(path):return hashlib.md5(('summit17/'+Path(path).relative_to(ROOT).as_posix()).encode()).hexdigest()
class Flow(dict):pass
class Dumper(yaml.SafeDumper):
 def ignore_aliases(self,data):return True
Dumper.add_representer(Flow,lambda d,v:d.represent_mapping('tag:yaml.org,2002:map',v,flow_style=True))
def dump(x):return yaml.dump(x,Dumper=Dumper,sort_keys=False,width=220,allow_unicode=True)
def vec(a,keys='xyz'):return Flow((k,round(float(v),6)) for k,v in zip(keys,a))
def color(rgb,a=1):return vec([*rgb,a],'rgba')
def ref(i=0,path=None,t=2):return Flow(fileID=i,**({'guid':guid(path),'type':t} if path else {}))
def file(name,folder,ext):return A/folder/(name+ext)
HEAD='%YAML 1.1\n%TAG !u! tag:unity3d.com,2011:\n'
def doc(typ,id,name,body):return f'--- !u!{typ} &{id}\n'+dump({name:body})
def common():return dict(m_ObjectHideFlags=0,m_CorrespondingSourceObject=ref(),m_PrefabInstance=ref(),m_PrefabAsset=ref())
def meta(p,imp,extra=None):
 d={'fileFormatVersion':2,'guid':guid(p)}
 if p.is_dir():d['folderAsset']='yes'
 d[imp]={**(extra or {}),'userData':'','assetBundleName':'','assetBundleVariant':''}
 Path(str(p)+'.meta').write_text(dump(d).replace("folderAsset: 'yes'",'folderAsset: yes'))
def asset(p,typ,id,name,d):
 p.write_text(HEAD+doc(typ,id,name,d));meta(p,'NativeFormatImporter',{'mainObjectFileID':id})
def native_mesh(name,tris):
 arr=np.array([p for p,uv in tris],np.float64);uv=np.array([v for p,v in tris],np.float64)
 e1=arr[:,1]-arr[:,0];e2=arr[:,2]-arr[:,0];cross=np.cross(e1,e2);n=cross/np.maximum(np.linalg.norm(cross,axis=1,keepdims=True),1e-10)
 du1=uv[:,1]-uv[:,0];du2=uv[:,2]-uv[:,0];den=du1[:,0]*du2[:,1]-du1[:,1]*du2[:,0];t=np.zeros_like(n)
 good=abs(den)>1e-8;t[good]=(e1[good]*du2[good,1:2]-e2[good]*du1[good,1:2])/den[good,None];t[~good]=e1[~good];t/=np.maximum(np.linalg.norm(t,axis=1,keepdims=True),1e-8)
 hand=np.where(den<0,-1,1)
 attr=np.concatenate((arr,np.repeat(n[:,None,:],3,axis=1),np.repeat(np.column_stack([t,hand])[:,None,:],3,axis=1),uv),axis=2).astype('<f4').reshape(-1,12)
 # Deduplicate vertices without losing hard normals or UV seams.
 vertices,idx=np.unique(attr,axis=0,return_inverse=True);idx=idx.astype('<u2' if len(vertices)<65536 else '<u4')
 lo=arr.min(axis=(0,1));hi=arr.max(axis=(0,1));bounds=dict(m_Center=vec((lo+hi)/2),m_Extent=vec(np.maximum((hi-lo)/2,.0001)))
 channels=[dict(stream=0,offset=o,format=0,dimension=d) for o,d in [(0,3),(12,3),(24,4),(0,0),(40,2)]+[(0,0)]*9]
 empty=dict(m_NumItems=0,m_Data='',m_BitSize=0);packed=dict(m_NumItems=0,m_Range=0,m_Start=0,m_Data='',m_BitSize=0)
 cm={'m_'+i:(packed if i in ['Vertices','UV','Normals','Tangents','FloatColors'] else empty) for i in ['Vertices','UV','Normals','Tangents','Weights','NormalSigns','TangentSigns','FloatColors','BoneIndices','Triangles']};cm['m_UVInfo']=0
 data={**common(),'m_Name':name,'serializedVersion':10,'m_SubMeshes':[dict(serializedVersion=2,firstByte=0,indexCount=int(idx.size),topology=0,baseVertex=0,firstVertex=0,vertexCount=len(vertices),localAABB=bounds)],'m_Shapes':dict(vertices=[],shapes=[],channels=[],fullWeights=[]),'m_BindPose':[],'m_BoneNameHashes':'','m_RootBoneNameHash':0,'m_BonesAABB':[],'m_VariableBoneCountWeights':{'m_Data':''},'m_MeshCompression':0,'m_IsReadable':0,'m_KeepVertices':0,'m_KeepIndices':0,'m_IndexFormat':int(idx.itemsize==4),'m_IndexBuffer':idx.tobytes().hex(),'m_VertexData':dict(serializedVersion=3,m_VertexCount=len(vertices),m_Channels=channels,m_DataSize=vertices.nbytes,_typelessdata=vertices.tobytes().hex()),'m_CompressedMesh':cm,'m_LocalAABB':bounds,'m_MeshUsageFlags':0,'m_BakedConvexCollisionMesh':'','m_BakedTriangleCollisionMesh':'','m_MeshMetrics[0]':1,'m_MeshMetrics[1]':1,'m_MeshOptimizationFlags':1,'m_StreamData':dict(offset=0,size=0,path='')}
 p=file(name,'Meshes','.asset');asset(p,43,4300000,'Mesh',data);return p
def mr(m):return ref(2100000,file(m,'Materials','.mat'))
def script(m):return ref(11500000,file(m,'Scripts','.cs'),3)
def tex(m):return ref(2800000,file(m,'Textures','.jpg' if m in surfaces else '.png'),3)
def gen_material(m):
 special={'CoolLight':(.54,.88,.92),'WarmLight':(1,.76,.43),'RedLight':(.92,.055,.018)}
 base=(1,1,1);em=(0,0,0);amount=.22;metal=0;main=ref();normal=ref();emtex=ref()
 kws=[]
 if m in surfaces:base=(1,1,1);metal,amount=surfaces[m][2:];main=tex(m);normal=tex(m+'_N');kws.append('_NORMALMAP')
 elif m in special:base=special[m];em=tuple(v*2.2 for v in base);kws.append('_EMISSION')
 elif m=='Glass':base=(.51,.66,.7);amount=.82;kws.append('_ALPHABLEND_ON')
 elif m not in ['SquallSky','RainStreak']:
  main=tex(m)
  if m in ['Radar','Trace','Synoptic']:em=(.80,1,.91);emtex=main;kws.append('_EMISSION')
 def ten(key,r):return {key:dict(m_Texture=r,m_Scale=vec([1,1],'xy'),m_Offset=vec([0,0],'xy'))}
 shader=Flow(fileID=46,guid='0000000000000000f000000000000000',type=0)
 if m in ['SquallSky','RainStreak','Glass']:shader=ref(4800000,file({'SquallSky':'StormSky','RainStreak':'Rain','Glass':'StormPane'}[m],'Shaders','.shader'),3)
 blend=m=='Glass'
 props=dict(serializedVersion=3,m_TexEnvs=[ten('_MainTex',main),ten('_BumpMap',normal),ten('_EmissionMap',emtex)],m_Ints=[],m_Floats=[{k:v} for k,v in [('_Metallic',metal),('_Glossiness',amount),('_BumpScale',.40),('_Mode',2 if blend else 0),('_SrcBlend',5 if blend else 1),('_DstBlend',10 if blend else 0),('_ZWrite',0 if blend else 1)]],m_Colors=[{'_Color':color(base,.115 if blend else 1)},{'_EmissionColor':color(em)}])
 asset(file(m,'Materials','.mat'),21,2100000,'Material',{**common(),'serializedVersion':8,'m_Name':m,'m_Shader':shader,'m_ValidKeywords':kws,'m_InvalidKeywords':[],'m_LightmapFlags':2 if '_EMISSION' in kws else 4,'m_EnableInstancingVariants':1,'m_DoubleSidedGI':0,'m_CustomRenderQueue':3000 if blend else -1,'stringTagMap':{'RenderType':'Transparent'} if blend else {},'disabledShaderPasses':[],'m_SavedProperties':props,'m_BuildTextureStacks':[]})
class Tree:
 def __init__(self):self.rows=[];self.next=1000;self.root=None
 def id(self):self.next+=1;return self.next
 def add(self,name,parent=None,pos=(0,0,0),yaw=0,q=None,tag='Untagged'):
  gid=self.id();tid=self.id();go={**common(),'serializedVersion':6,'m_Component':[{'component':ref(tid)}],'m_Layer':0,'m_Name':name,'m_TagString':tag,'m_Icon':ref(),'m_NavMeshLayer':0,'m_StaticEditorFlags':0,'m_IsActive':1}
  tr={**common(),'m_GameObject':ref(gid),'m_LocalRotation':vec(q or [0,sin(math.radians(yaw)/2),0,cos(math.radians(yaw)/2)],'xyzw'),'m_LocalPosition':vec(pos),'m_LocalScale':vec([1,1,1]),'m_ConstrainProportionsScale':0,'m_Children':[],'m_Father':ref(parent[1] if parent else 0),'m_RootOrder':0,'m_LocalEulerAnglesHint':vec([0,yaw,0])}
  if parent:parent[3]['m_Children'].append(ref(tid))
  self.rows.extend([(1,gid,'GameObject',go),(4,tid,'Transform',tr)]);node=(gid,tid,go,tr)
  if self.root is None:self.root=node
  return node
 def comp(self,node,typ,name,props):
  id=self.id();node[2]['m_Component'].append({'component':ref(id)});self.rows.append((typ,id,name,{**common(),'m_GameObject':ref(node[0]),**props}));return id
 def mono(self,node,name,props):return self.comp(node,114,'MonoBehaviour',dict(m_Enabled=1,m_EditorHideFlags=0,m_Script=script(name),m_Name='',m_EditorClassIdentifier='',**props))
 def serial(self):return ''.join(doc(*row) for row in self.rows)
def light(tree,node,rgb,intensity,reach,directional=False):
 return tree.comp(node,108,'Light',dict(m_Enabled=1,serializedVersion=10,m_Type=1 if directional else 2,m_Shape=0,m_Color=color(rgb),m_Intensity=intensity,m_Range=reach,m_SpotAngle=35,m_InnerSpotAngle=21,m_CookieSize=10,m_Shadows=dict(m_Type=1 if directional else 0,m_Resolution=-1,m_CustomResolution=-1,m_Strength=.63,m_Bias=.05,m_NormalBias=.4,m_NearPlane=.2),m_Cookie=ref(),m_DrawHalo=0,m_Flare=ref(),m_RenderMode=0,m_CullingMask={'serializedVersion':2,'m_Bits':4294967295},m_RenderingLayerMask=1,m_Lightmapping=4,m_LightShadowCasterMode=0,m_BounceIntensity=1,m_ColorTemperature=6570,m_UseColorTemperature=0,m_UseBoundingSphereOverride=0,m_ShadowRadius=0,m_ShadowAngle=0))
def prefab(s):
 tree=Tree();root=tree.add(s.name)
 for m,tris in s.mesh.items():
  mesh=native_mesh(s.name+'_'+m,tris);n=tree.add(m,root)
  tree.comp(n,33,'MeshFilter',dict(m_Mesh=ref(4300000,mesh)))
  tree.comp(n,23,'MeshRenderer',dict(m_Enabled=1,m_CastShadows=int(m!='Glass'),m_ReceiveShadows=1,m_DynamicOccludee=1,m_StaticShadowCaster=0,m_MotionVectors=1,m_LightProbeUsage=1,m_ReflectionProbeUsage=1,m_RayTracingMode=0,m_RenderingLayerMask=1,m_RendererPriority=0,m_Materials=[mr(m)],m_StaticBatchInfo={'firstSubMesh':0,'subMeshCount':0},m_StaticBatchRoot=ref(),m_ProbeAnchor=ref(),m_LightProbeVolumeOverride=ref(),m_ScaleInLightmap=1,m_ReceiveGI=1,m_PreserveUVs=0,m_IgnoreNormalsForChartDetection=0,m_ImportantGI=0,m_StitchLightmapSeams=0,m_SelectedEditorRenderState=3,m_MinimumChartSize=4,m_AutoUVMaxDistance=.5,m_AutoUVMaxAngle=89,m_LightmapParameters=ref(),m_SortingLayerID=0,m_SortingLayer=0,m_SortingOrder=0))
 for i,(c,sz) in enumerate(s.colliders):
  n=tree.add('Solid %02d'%i,root,c);tree.comp(n,65,'BoxCollider',dict(m_Material=ref(),m_IsTrigger=0,m_Enabled=1,serializedVersion=2,m_Size=vec(sz),m_Center=vec((0,0,0))))
 for i,(p,c,power,reach) in enumerate(s.lights):light(tree,tree.add('Practical %02d'%i,root,p),c,power,reach)
 if s.kind:
  grips={'Grip':((0,0,0),(.32,.12,.12)),'Button':((0,.026,0),(.085,.06,.08)),'Rotary':((0,.035,0),(.11,.08,.11)),'SwitchPivot':((0,.06,-.10),(.21,.2,.18)),'FuseSeat':((0,0,0),(.14,.32,.14)),'DrawerSlide':((0,0,.17),(.4,.10,.1)),'CabinetHinge':((.66,.70,-.055),(.14,.24,.13)),'DoorHinge':((1.34,1.06,-.06),(.29,.17,.24))}
  c,sz=grips[s.kind];n=tree.add('Interaction volume',root,c)
  tree.comp(n,65,'BoxCollider',dict(m_Material=ref(),m_IsTrigger=1,m_Enabled=1,serializedVersion=2,m_Size=vec(sz),m_Center=vec([0,0,0])))
  axis=(0,1,0) if s.kind in ['DoorHinge','Rotary','CabinetHinge'] else ((1,0,0) if s.kind=='SwitchPivot' else (0,0,1))
  tree.mono(root,'StationSocket',dict(role=s.kind,localAxis=vec(axis),travel={'DoorHinge':90,'CabinetHinge':90,'DrawerSlide':.25,'Button':.009,'Rotary':120,'SwitchPivot':35,'FuseSeat':.12,'Grip':0}[s.kind]))
 p=file(s.name,'Prefabs','.prefab');p.write_text(HEAD+tree.serial());meta(p,'PrefabImporter');return p,root[1]
def write_scene():
 sc=Tree()
 root=sc.add('MS-17 | Storm watch')
 lamp=light(sc,sc.add('Storm light',root,q=(.33,-.32,.12,.88)),(.54,.70,.91),.43,190,True)
 sc.mono(root,'SummitWeather',{**{n:ref(8300000,file(f,'Audio','.wav'),3) for n,f in [('wind','Wind'),('rain','Rain'),('thunder','Thunder'),('ventilation','Ventilation'),('engine','Engine')]},'stormLight':ref(lamp),'rainMaterial':mr('RainStreak'),'lightningStrength':.48,'soundLevel':.78})
 spawn=(-4.7,.015,2.45);sc.add('XR Origin placement - floor datum',root,spawn,-12)
 player=sc.add('Desktop Visitor - disable for XR',root,spawn,-12);cam=sc.add('Eyes',player,(0,1.64,0),tag='MainCamera')
 eye=sc.comp(cam,20,'Camera',dict(m_Enabled=1,serializedVersion=2,m_ClearFlags=1,m_BackGroundColor=color((.072,.11,.15)),m_projectionMatrixMode=1,m_GateFitMode=2,m_FOVAxisMode=0,m_SensorSize=vec([36,24],'xy'),m_LensShift=vec([0,0],'xy'),m_FocalLength=50,m_NormalizedViewPortRect=dict(serializedVersion=2,x=0,y=0,width=1,height=1),**{'near clip plane':.035,'far clip plane':350,'field of view':68},orthographic=0,**{'orthographic size':5},m_Depth=0,m_CullingMask={'serializedVersion':2,'m_Bits':4294967295},m_RenderingPath=-1,m_TargetTexture=ref(),m_TargetDisplay=0,m_TargetEye=3,m_HDR=1,m_AllowMSAA=1,m_AllowDynamicResolution=0,m_ForceIntoRT=0,m_OcclusionCulling=1,m_StereoConvergence=10,m_StereoSeparation=.022))
 sc.comp(cam,81,'AudioListener',{'m_Enabled':1})
 sc.comp(player,143,'CharacterController',dict(m_Material=ref(),m_IsTrigger=0,m_Enabled=1,serializedVersion=2,m_Height=1.76,m_Radius=.27,m_SlopeLimit=42,m_StepOffset=.19,m_SkinWidth=.025,m_MinMoveDistance=0,m_Center=vec([0,.89,0])))
 sc.mono(player,'StationWalkthrough',dict(eyes=ref(eye)))
 settings=doc(104,1,'RenderSettings',dict(m_ObjectHideFlags=0,serializedVersion=9,m_Fog=1,m_FogColor=color([.082,.126,.166]),m_FogMode=2,m_FogDensity=.015,m_LinearFogStart=14,m_LinearFogEnd=135,m_AmbientSkyColor=color([.23,.29,.34]),m_AmbientEquatorColor=color([.16,.19,.20]),m_AmbientGroundColor=color([.08,.084,.08]),m_AmbientIntensity=.82,m_AmbientMode=1,m_SubtractiveShadowColor=color([.10,.12,.14]),m_SkyboxMaterial=mr('SquallSky'),m_HaloStrength=.4,m_FlareStrength=.5,m_FlareFadeSpeed=3,m_HaloTexture=ref(),m_SpotCookie=ref(),m_DefaultReflectionMode=0,m_DefaultReflectionResolution=128,m_ReflectionBounces=1,m_ReflectionIntensity=.46,m_CustomReflection=ref(),m_Sun=ref(lamp),m_UseRadianceAmbientProbe=0))
 instances=''
 for i,s in enumerate(zones):
  p,trans=prefab(s);mods=[];target=ref(trans,p,3)
  for key,v in [('m_LocalPosition',s.pos),('m_LocalRotation',[0,sin(math.radians(s.yaw)/2),0,cos(math.radians(s.yaw)/2)])]:
   for a,n in zip('xyzw',v):mods.append(dict(target=target,propertyPath=key+'.'+a,value=float(n),objectReference=ref()))
  mods.append(dict(target=target,propertyPath='m_RootOrder',value=i+1,objectReference=ref()))
  instances+=doc(1001,20000+i,'PrefabInstance',dict(m_ObjectHideFlags=0,serializedVersion=2,m_Modification=dict(m_TransformParent=ref(),m_Modifications=mods,m_RemovedComponents=[]),m_SourcePrefab=ref(100100000,p,3)))
 p=file('StormWatch','Scenes','.unity');p.write_text(HEAD+settings+sc.serial()+instances);meta(p,'DefaultImporter')
def main():
 for p in A.rglob('*'):
  if p.is_dir():meta(p,'DefaultImporter')
 meta(A,'DefaultImporter')
 for p in (A/'Textures').iterdir():
  if p.suffix not in ['.jpg','.png']:continue
  normal=p.stem.endswith('_N')
  meta(p,'TextureImporter',{'serializedVersion':12,'mipmaps':{'mipMapMode':0,'enableMipMap':1,'sRGBTexture':int(not normal),'linearTexture':int(normal),'fadeOut':0,'borderMipMap':0},'bumpmap':{'convertToNormalMap':0,'externalNormalMap':0,'heightScale':.25,'normalMapFilter':0,'flipGreenChannel':0},'isReadable':0,'textureType':1 if normal else 0,'textureShape':1,'maxTextureSize':1024,'textureSettings':{'serializedVersion':2,'filterMode':2,'aniso':4,'mipBias':0,'wrapU':0,'wrapV':0,'wrapW':0},'nPOTScale':0,'alphaIsTransparency':0,'textureCompression':1})
 for p in (A/'Audio').glob('*.wav'):meta(p,'AudioImporter',dict(serializedVersion=7,defaultSettings=dict(serializedVersion=2,loadType=1,sampleRateSetting=0,sampleRateOverride=22050,compressionFormat=1,quality=.68,conversionMode=0),platformSettingOverrides={},forceToMono=1,normalize=0,preloadAudioData=1,loadInBackground=1,ambisonic=0,**{'3D':1}))
 for p in A.rglob('*.cs'):meta(p,'MonoImporter',dict(serializedVersion=2,defaultReferences=[],executionOrder=0,icon=ref()))
 for p in (A/'Shaders').glob('*.shader'):meta(p,'ShaderImporter',dict(defaultTextures=[],nonModifiableTextures=[]))
 for m in sorted(set(m for s in zones for m in s.mesh)|{'RainStreak','SquallSky'}):gen_material(m)
 write_scene()
 print('prefabs',len(zones),'triangles',sum(len(tris) for s in zones for tris in s.mesh.values()))
if __name__=='__main__':main()
