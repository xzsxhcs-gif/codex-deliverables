export type Ctx = CanvasRenderingContext2D;
export type Vec2 = {x: number; y: number};
export const W = 1080, H = 1920, FPS = 30, DURATION = 50, BPM = 150;
export const P = { ink: '#0b1020', black: '#06070b', blue: '#153a92', electric: '#426dff', red: '#ed302d', white: '#fff7e8', paper: '#eee2c9', brown: '#492719', gold: '#d7a454', muted: '#8893ad' };
export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, u: number) => a + (b - a) * u;
export const smooth = (v: number) => {const u=clamp(v); return u*u*(3-2*u);};
export const easeOut = (v: number) => 1-Math.pow(1-clamp(v),3);
export const easeInOut = (v: number) => {const u=clamp(v);return u<.5?4*u*u*u:1-Math.pow(-2*u+2,3)/2;};
export const hash = (n: number) => {const s=Math.sin(n*127.1+311.7)*43758.5453123;return s-Math.floor(s);};
export const beat = (t: number) => t * BPM / 60;
export const pulse = (t: number, decay = 10) => {const b=beat(t);return Math.exp(-Math.max(0,b-Math.floor(b+1e-8))*decay);};
export function poly(ctx: Ctx, points: Vec2[], fill?: string, stroke?: string, width = 2, close = true) {
  if (!points.length) return; ctx.beginPath();ctx.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) ctx.lineTo(p.x,p.y);if(close)ctx.closePath();
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
}
export function line(ctx:Ctx,x1:number,y1:number,x2:number,y2:number,color:string,width=2,alpha=1){ctx.save();ctx.globalAlpha*=alpha;ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore();}
export function ring(ctx:Ctx,x:number,y:number,r:number,color:string,width=2,start=0,end=Math.PI*2){ctx.beginPath();ctx.arc(x,y,Math.max(0,r),start,end);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
export function text(ctx:Ctx,value:string,x:number,y:number,size=24,color:string=P.white,align:CanvasTextAlign='left',weight=600){ctx.fillStyle=color;ctx.textAlign=align;ctx.textBaseline='middle';const standardWeight=Math.round(clamp(weight,100,900)/100)*100;ctx.font=`${standardWeight} ${size}px "FilmSans", "Noto Sans CJK SC", sans-serif`;ctx.fillText(value,x,y);}
export function backdrop(ctx:Ctx,color:string=P.black){ctx.fillStyle=color;ctx.fillRect(0,0,W,H);}
export function burst(ctx:Ctx,x:number,y:number,amount:number,seed=0,color:string=P.white){ctx.save();ctx.strokeStyle=color;ctx.globalAlpha*=amount;for(let i=0;i<46;i++){const a=hash(i+seed)*Math.PI*2;const r=240+hash(i*7+seed)*450;line(ctx,x+Math.cos(a)*r,y+Math.sin(a)*r,x+Math.cos(a)*(r+300+hash(i)*700),y+Math.sin(a)*(r+300+hash(i)*700),color,2+hash(i+9)*5);}ctx.restore();}
