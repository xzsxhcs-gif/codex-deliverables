"""Offline art inspection. Reads geometry extracted from saved native Mesh assets, not a Unity screenshot."""
import bpy,numpy as np,json,sys,math
from pathlib import Path
from tempfile import gettempdir
from mathutils import Vector
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'Tools'))
data=(Path(gettempdir()) / 'summit17-review');db=np.load(data/'meshes.npz');info=json.loads((data/'instances.json').read_text())
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=14;scene.cycles.use_denoising=False;scene.cycles.max_bounces=5
scene.render.resolution_x=896;scene.render.resolution_y=526;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.32
scene.render.image_settings.file_format='JPEG';scene.render.image_settings.quality=90
world=bpy.data.worlds.new('Night cloud deck');world.use_nodes=True;scene.world=world
nodes=world.node_tree.nodes;ln=world.node_tree.links;bg=nodes['Background']
coord=nodes.new('ShaderNodeTexCoord');noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=4;noise.inputs['Detail'].default_value=4.2;ln.new(coord.outputs['Normal'],noise.inputs['Vector'])
ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.27;ramp.color_ramp.elements[0].color=(.008,.017,.032,1);ramp.color_ramp.elements[1].position=.7;ramp.color_ramp.elements[1].color=(.095,.16,.24,1);ln.new(noise.outputs['Fac'],ramp.inputs['Fac']);ln.new(ramp.outputs[0],bg.inputs['Color'])
def light(name,typ,pos,rgb,energy,size):
 l=bpy.data.lights.new(name,typ);o=bpy.data.objects.new(name,l);scene.collection.objects.link(o);o.location=pos;l.color=rgb;l.energy=energy
 if typ=='POINT':l.shadow_soft_size=size
 return o
sun=light('Cloud filtered moon','SUN',(0,0,40),(.52,.67,.90),.86,0);sun.rotation_euler=(.68,-.63,-.33);sun.data.angle=.18
for j,(p,col,pow) in enumerate(info['lights']):
 x,y,z=p;light('Practical '+str(j),'POINT',(x,z,y),col,pow*(50 if y<1 else 100),.24)
texture=root/'Assets/SummitStation/Textures'
mats={}
def material(name):
 if name in mats:return mats[name]
 m=bpy.data.materials.new(name);m.use_nodes=True;mats[name]=m;n=m.node_tree.nodes;link=m.node_tree.links;bs=n.get('Principled BSDF')
 if name=='Glass':
  bs.inputs['Alpha'].default_value=.115;bs.inputs['Roughness'].default_value=.11;bs.inputs['Base Color'].default_value=(.27,.4,.47,1);return m
 if name in ['CoolLight','WarmLight','RedLight']:
  c={'CoolLight':(.51,.81,.97,1),'WarmLight':(1,.66,.28,1),'RedLight':(1,.055,.02,1)}[name];bs.inputs['Base Color'].default_value=c;bs.inputs['Emission Color'].default_value=c;bs.inputs['Emission Strength'].default_value=2.8;return m
 f=texture/(name+'.jpg')
 if not f.exists():f=f.with_suffix('.png')
 im=n.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(f));link.new(im.outputs['Color'],bs.inputs['Base Color'])
 # Extract the Unity scalar material parameters without a YAML dependency in Blender.
 import re
 saved=(root/'Assets/SummitStation/Materials'/(name+'.mat')).read_text()
 for key,target in [('Metallic','Metallic'),('Glossiness','Roughness')]:
  val=float(re.search('- _'+key+r': ([0-9.e-]+)',saved)[1]);bs.inputs[target].default_value=val if key=='Metallic' else 1-val
 if name in ['Radar','Trace','Synoptic']:
  link.new(im.outputs['Color'],bs.inputs['Emission Color']);bs.inputs['Emission Strength'].default_value=.8
 nf=texture/(name+'_N.png')
 if nf.exists():
  tex=n.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(nf));tex.image.colorspace_settings.name='Non-Color';norm=n.new('ShaderNodeNormalMap');norm.inputs['Strength'].default_value=.4;link.new(tex.outputs['Color'],norm.inputs['Color']);link.new(norm.outputs['Normal'],bs.inputs['Normal'])
 return m
for key,mat,pos,angle in info['draw']:
 v=db[key+'__v'];idx=db[key+'__i'][:,::-1].copy();mesh=bpy.data.meshes.new(key)
 mesh.from_pydata(v[:,[0,2,1]].tolist(),[],idx.tolist());mesh.update()
 uv=mesh.uv_layers.new();uv.data.foreach_set('uv',np.ascontiguousarray(v[idx.flatten(),10:12]).flatten())
 obj=bpy.data.objects.new(key,mesh);scene.collection.objects.link(obj);obj.location=(pos[0],pos[2],pos[1]);obj.rotation_euler.z=-angle
 mesh.materials.append(material(mat))
cams=[
 ('01_Control',(-1.20,1.59,1.60),(-6.17,1.39,5.65),22),
 ('02_Quarters',(2.70,1.62,.48),(3.09,1.19,5.77),18),
 ('03_NightCorridor',(-7.7,1.62,-1.72),(3.75,1.42,-1.08),25),
 ('04_RidgeWalk',(20.45,1.68,-2.15),(2.0,2.88,2.6),22),
 ('05_Engine',(22.90,1.62,-3.28),(26.64,1.32,.11),22),
 ('06_Summit',(40,16,-39),(6,1.6,1.5),38)]
cam=bpy.data.cameras.new('Inspection');eye=bpy.data.objects.new('Inspection',cam);scene.collection.objects.link(eye);scene.camera=eye;cam.clip_end=440
for label,p,t,lens in [cams[i] for i in (5,0,3,4,1,2)]:
 eye.location=(p[0],p[2],p[1]);eye.rotation_euler=(Vector((t[0],t[2],t[1]))-eye.location).to_track_quat('-Z','Y').to_euler();cam.lens=lens
 scene.render.filepath=str(root/'Verification'/(label+'.jpg'));bpy.ops.render.render(write_still=True)
