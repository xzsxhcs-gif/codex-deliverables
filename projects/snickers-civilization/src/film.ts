import { type Ctx, W, H, DURATION, P, clamp, smooth, hash, pulse } from './core';
import { drawOrigin, drawIdentity, drawCoda } from './scenes/origin';
import { drawCivilization } from './scenes/civilization';
import { drawReassembly } from './scenes/reassembly';

export { W, H, DURATION };
export const CUTS=[6.4,8,9.6,11.2,12.8,14.4,16,18,20,22,24,26,28,30,32,33.6,35.2,36.8,38.4,40,41.6,43.2,44.8];

export function renderFilm(ctx:Ctx,time:number){
  const t=clamp(time,0,DURATION);ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.fillStyle=P.black;ctx.fillRect(0,0,W,H);
  if(t>=49.5){ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);ctx.restore();return;}
  const accent=t>=6.4&&t<44.8?pulse(t,20):0;
  const intensity=t>=16&&t<32?1.7:t>=32&&t<43.2?2.1:1;
  ctx.save();
  // Every shake and cut is a pure function of the frame time.
  ctx.translate((hash(Math.floor(t*30)*3)-.5)*accent*5*intensity,(hash(Math.floor(t*30)*7)-.5)*accent*7*intensity);
  if(t<6.4)drawOrigin(ctx,t);
  else if(t<16)drawIdentity(ctx,t);
  else if(t<32)drawCivilization(ctx,t);
  else if(t<44.8)drawReassembly(ctx,t);
  else drawCoda(ctx,t);
  ctx.restore();
  if(t<44.8){
    // A narrow displaced echo, never a full-frame noise layer.
    const nearCut=CUTS.some(c=>t>=c&&t<c+.0667);
    if(nearCut&&t>6.4){ctx.fillStyle=P.red;ctx.globalAlpha=.52;ctx.fillRect(0,310+hash(Math.floor(t*30))*900,W,5);ctx.globalAlpha=1;}
    for(let i=0;i<100;i++){const f=Math.floor(t*30),x=hash(i*11+f*.13)*W,y=hash(i*31+f*.23)*H;ctx.fillStyle=i%3===0?P.white:P.black;ctx.globalAlpha=.035;ctx.fillRect(x,y,1.3,1.3);}
    ctx.globalAlpha=1;
    const vignette=ctx.createRadialGradient(W/2,H/2,300,W/2,H/2,1250);
    vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.23)');ctx.fillStyle=vignette;ctx.fillRect(0,0,W,H);
  }
  if(t<.4){ctx.globalAlpha=1-smooth(t/.4);ctx.fillStyle=P.black;ctx.fillRect(0,0,W,H);}
  if(t>49.1){ctx.globalAlpha=smooth((t-49.1)/.4);ctx.fillStyle='#000';ctx.fillRect(0,0,W,H);}
  ctx.restore();
}
