"""Optional Open Image Denoise pass on the Cycles inspection renders."""
import subprocess,os,sys,tempfile
from pathlib import Path
from PIL import Image
import numpy as np
def clean(path,exe):
 with tempfile.TemporaryDirectory() as work:
  a=np.asarray(Image.open(path).convert('RGB'),dtype=np.float32)/255.
  h,w=a.shape[:2]
  src=Path(work)/'input.pfm';out=Path(work)/'output.pfm'
  with src.open('wb') as f:
   f.write(f'PF\n{w} {h}\n-1.0\n'.encode());f.write(np.ascontiguousarray(a[::-1],dtype='<f4').tobytes())
  subprocess.run([exe,'-d','cpu','-ldr',str(src),'-srgb','-o',str(out),'--threads','2'],check=True,stdout=subprocess.DEVNULL)
  with out.open('rb') as f:
   assert f.readline().strip()==b'PF';size=f.readline();scale=f.readline();rgb=np.frombuffer(f.read(),dtype='<f4').reshape(h,w,3)[::-1]
  Image.fromarray(np.uint8(np.clip(rgb,0,1)*255)).save(path,quality=94)
if __name__=='__main__':
 for name in sys.argv[2:]:clean(Path(name),sys.argv[1])
