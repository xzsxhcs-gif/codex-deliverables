"""Metre-scale procedural fabrication tools. Coordinates are Unity X/east Y/up Z/north."""
from collections import defaultdict
import numpy as np, math
from pathlib import Path
from math import sin,cos,pi
class Zone:
 def __init__(self,name,pos=(0,0,0),yaw=0,kind=''):
  self.name=name;self.pos=pos;self.yaw=yaw;self.kind=kind;self.mesh=defaultdict(list);self.colliders=[];self.lights=[]
 def tri(self,m,pts,uv):
  self.mesh[m].append((pts,uv))
 def face(self,m,pts,uv=None):
  if uv is None:
   n=np.cross(np.subtract(pts[1],pts[0]),np.subtract(pts[2],pts[0]));axes=([2,1],[0,2],[0,1])[np.argmax(abs(n))]
   uv=[(p[axes[0]]*.78,p[axes[1]]*.78) for p in pts]
  for i in range(1,len(pts)-1):self.tri(m,[pts[0],pts[i],pts[i+1]],[uv[0],uv[i],uv[i+1]])
 def col(self,c,size):self.colliders.append((c,size))
 def box(self,m,c,size,bevel=0,solid=False):
  x,y,z=c;a,b,d=np.array(size)/2
  # Eight-corner bent sheet profile plus a shallow chamfer at the top and bottom.
  k=min(bevel,a*.44,d*.44,b*.55)
  def ring(h,shrink):
   aa=a-shrink;dd=d-shrink;r=min(aa*.45,dd*.45,k)
   pts=[(-aa+r,-dd),(aa-r,-dd),(aa,-dd+r),(aa,dd-r),(aa-r,dd),(-aa+r,dd),(-aa,dd-r),(-aa,-dd+r)] if k>0 else [(-aa,-dd),(aa,-dd),(aa,dd),(-aa,dd)]
   return [(x+u,y+h,z+v) for u,v in pts]
  loops=[ring(-b,k*.44),ring(-b+k*.45,0),ring(b-k*.45,0),ring(b,k*.44)] if k>0 else [ring(-b,0),ring(b,0)]
  self.face(m,loops[0]);self.face(m,loops[-1][::-1])
  for lo,hi in zip(loops,loops[1:]):
   for i in range(len(lo)):
    j=(i+1)%len(lo);self.face(m,[lo[i],hi[i],hi[j],lo[j]])
  if solid:self.col(c,size)
 def rod(self,m,a,b,r,n=10,r2=None):
  aa,bb=np.array(a,dtype=float),np.array(b,dtype=float);v=bb-aa;v/=np.linalg.norm(v);u=np.cross(v,[0,1,0] if abs(v[1])<.93 else [1,0,0]);u/=np.linalg.norm(u);w=np.cross(v,u)
  rings=[[c+rr*(u*cos(i*2*pi/n)+w*sin(i*2*pi/n)) for i in range(n)] for c,rr in [(aa,r),(bb,r if r2 is None else r2)]]
  l,h=rings; self.face(m,l[::-1]); self.face(m,h)
  for i in range(n):j=(i+1)%n;self.face(m,[l[i],l[j],h[j],h[i]])
 def path(self,m,pts,r,n=8):
  for a,b in zip(pts,pts[1:]):self.rod(m,a,b,r,n)
 def sign(self,m,c,w,h,side='S'):
  x,y,z=c;u={'S':(1,0,0),'N':(-1,0,0),'E':(0,0,1),'W':(0,0,-1)}[side];a=np.array(u)*w/2;b=np.array([0,h/2,0]);p=np.array(c)
  self.face(m,[p-a-b,p-a+b,p+a+b,p+a-b],[(0,0),(0,1),(1,1),(1,0)])
 def lamp(self,c,color,power,reach):
  self.lights.append((c,color,power,reach))
