"""Rasterise an authored SVG with librsvg and Cairo, without a browser or GPU."""
from ctypes import CDLL, POINTER, c_void_p, c_int, c_double, c_char_p, c_size_t, string_at
from ctypes.util import find_library
from PIL import Image

rsvg=CDLL(find_library('rsvg-2')); cairo=CDLL(find_library('cairo')); glib=CDLL(find_library('gobject-2.0'))
def sig(lib,name,ret,*args):
    f=getattr(lib,name); f.restype=ret; f.argtypes=args; return f
new=sig(rsvg,'rsvg_handle_new_from_data',c_void_p,c_char_p,c_size_t,POINTER(c_void_p))
surface=sig(cairo,'cairo_image_surface_create',c_void_p,c_int,c_int,c_int)
context=sig(cairo,'cairo_create',c_void_p,c_void_p)
scale=sig(cairo,'cairo_scale',None,c_void_p,c_double,c_double)
render=sig(rsvg,'rsvg_handle_render_cairo',c_int,c_void_p,c_void_p)
data=sig(cairo,'cairo_image_surface_get_data',c_void_p,c_void_p)
flush=sig(cairo,'cairo_surface_flush',None,c_void_p)
done=sig(cairo,'cairo_destroy',None,c_void_p)
close=sig(cairo,'cairo_surface_destroy',None,c_void_p)
unref=sig(glib,'g_object_unref',None,c_void_p)
def draw(svg,width,height,factor):
    b=svg.encode(); handle=new(b,len(b),None)
    if not handle:raise ValueError('Invalid SVG')
    w,h=round(width*factor),round(height*factor)
    surf=surface(0,w,h);cr=context(surf);scale(cr,factor,factor)
    try:
        if not render(handle,cr):raise ValueError('SVG drawing failed')
        flush(surf)
        return Image.frombytes('RGBa',(w,h),string_at(data(surf),w*h*4),'raw','BGRa').convert('RGBA')
    finally:done(cr);close(surf);unref(handle)
