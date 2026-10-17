import { type Ctx, W, H, P, backdrop, clamp, smooth, easeOut, lerp, hash, ring, line, text, pulse, burst, poly } from '../core';
import { drawPackage, drawWordmark, getGlyphPoints, drawGene } from '../visuals/brand';

function draftingField(ctx:Ctx,t:number,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;
  const pitch=90;
  for(let x=-pitch;x<W+pitch;x+=pitch)line(ctx,x+(t*12%pitch),200,x+(t*12%pitch),1710,P.blue,1,.3);
  for(let y=200;y<1740;y+=pitch)line(ctx,0,y,W,y,P.blue,1,.3);
  for(let i=0;i<22;i++){const x=80+hash(i*13)*920,y=230+hash(i*19)*1450;const a=.15+Math.pow(Math.sin(t*2+i),8)*.45;line(ctx,x-5,y,x+5,y,P.paper,1,a);line(ctx,x,y-5,x,y+5,P.paper,1,a);}
  ctx.restore();
}

function chapter(ctx:Ctx,num:string,word:string,t:number,color:string=P.white){
  const a=smooth(t/.25);ctx.save();ctx.globalAlpha=a;
  text(ctx,num,72,145,24,color);line(ctx,130,145,340,145,color,2,.5);
  text(ctx,word,72,226,72,color,'left',800);
  ctx.restore();
}

export function drawOrigin(ctx:Ctx,t:number){
  backdrop(ctx,P.black);draftingField(ctx,t,smooth((t-.3)/1.3)*.7);
  const reveal=t<.25?0:.10+.90*smooth((t-.25)/5.8);
  chapter(ctx,'00','ORIGIN',t-.12);
  const cx=540,cy=960;
  const aperture=150+easeOut(t/2.4)*490;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(-.24+smooth(t/6.4)*.12);
  const trace=clamp(t/1.3);
  line(ctx,-aperture,0,aperture*(2*trace-1),0,P.white,2,.35);
  line(ctx,0,-aperture*.58,0,aperture*.58*(2*trace-1),P.white,2,.3);
  for(let k=0;k<4;k++){const a=k*Math.PI/2;ring(ctx,0,0,aperture*.65,P.blue,2,a,a+trace*.6);}
  ctx.restore();
  const palette=[P.brown,P.white,P.red,P.blue];
  for(let i=0;i<4;i++){
    const enter=easeOut((t-.2-i*.16)/.9),merge=smooth((t-1.8-i*.1)/2.2);
    const x=lerp(180+i*230,cx+(i-1.5)*130,merge),y=lerp(610+(i%2)*680,cy,merge);
    ctx.save();ctx.globalAlpha=enter*(1-smooth((t-4)/.6));ctx.translate(x,y);ctx.rotate((1-merge)*(i-1.5)*.19);
    ctx.fillStyle=palette[i];ctx.fillRect(-60*(1+merge*3),-40,120*(1+merge*3),80);
    ctx.restore();
  }
  if(t>=1.6&&t<3.2){
    const q=(t-1.6)/1.6,points=getGlyphPoints(q<.5?0:4,96),head=Math.floor(q*160)%96;
    ctx.save();ctx.translate(540,950);ctx.rotate(-.36+q*.30);
    const scale=1420+q*220;const shown=points.slice(0,Math.max(3,Math.floor((.3+q*.7)*96))).map(p=>({x:p.x*scale,y:p.y*scale}));
    poly(ctx,shown,undefined,P.blue,44,false);poly(ctx,shown,undefined,P.white,3.5,false);
    const p=points[head];ctx.fillStyle=P.red;ctx.fillRect(p.x*scale-9,p.y*scale-9,18,18);
    for(let j=0;j<points.length;j+=8){const a=points[j];ring(ctx,a.x*scale,a.y*scale,5,P.red,2);}
    ctx.restore();
    text(ctx,'VERTEX / CONTOUR',540,1320,27,P.paper,'center');
  }else{
    drawPackage(ctx,{x:cx,y:cy,width:t<1.6?1100:940,angle:-.12,rotateX:.16*(1-reveal),rotateY:.28*(1-reveal),build:reveal,wire:1-smooth((t-4.1)/1.65)});
  }
  if(t<4.8){
    const scan=720+((t*165)%450);
    line(ctx,94,scan,986,scan,P.red,2,.45*(1-reveal));
    for(let i=0;i<8;i++){
      const pts=getGlyphPoints(i,24); const x=128+i*118;
      ctx.save();ctx.globalAlpha=clamp((t-2.8)*.8)*(1-smooth((t-4.2)/.6));
      for(let j=0;j<pts.length;j+=3){const q=pts[j];line(ctx,x+q.x*55,1420+q.y*80,540+q.x*110,960+q.y*130,P.blue,1,.25);}
      ctx.restore();
    }
  }
  text(ctx,'S / N / I / C / K / E / R / S',540,1450,28,P.muted,'center',500);
  text(ctx,t<3?'PATH → SHAPE':t<5?'SHAPE → SIGN':'SNICKERS',540,1550,t<5?25:45,P.white,'center',700);
  const number=Math.floor(clamp(t/6.2)*100).toString().padStart(3,'0');
  text(ctx,number,1008,1760,44,P.red,'right',700);
  for(let i=0;i<100;i++){ctx.fillStyle=i<Number(number)?P.white:'#1a2031';ctx.fillRect(72+i*8.6,1748,4,i%5===0?30:14);}
  if(t>5.6){const zoom=smooth((t-5.6)/.8);ctx.save();ctx.globalAlpha=zoom*.5;text(ctx,'01',980,345,160,P.red,'right',900);ctx.restore();}
}

function comicFrame(ctx:Ctx,x:number,y:number,w:number,h:number,fn:()=>void){ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();fn();ctx.restore();ctx.strokeStyle=P.ink;ctx.lineWidth=14;ctx.strokeRect(x,y,w,h);}

export function drawIdentity(ctx:Ctx,t:number){
  const u=t-6.4,shot=Math.min(5,Math.floor(u/1.6)),s=(u%1.6)/1.6;
  const accent=pulse(t,12);
  if(shot===0){
    backdrop(ctx,P.red);burst(ctx,540,950,.4+accent*.4,71,P.paper);
    text(ctx,'S',70,290,260,P.ink,'left',900);text(ctx,'01',995,1690,240,P.ink,'right',900);
    ctx.save();ctx.globalAlpha=.13;drawWordmark(ctx,540,710,1450,340);drawWordmark(ctx,540,1260,1450,340);ctx.restore();
    drawPackage(ctx,{x:540,y:950,width:1010+accent*36,angle:-.30+s*.18,rotateX:.23,rotateY:Math.sin(s*Math.PI)*.17});
    text(ctx,'SNICKERS',72,1750,65,P.white,'left',800);
    text(ctx,'RECONSTRUCTED',72,1820,25,P.white);
  }else if(shot===1){
    backdrop(ctx,P.paper);ctx.fillStyle=P.blue;ctx.fillRect(0,0,W,350);
    text(ctx,'CODE',72,200,140,P.white,'left',900);
    for(let i=0;i<3;i++)comicFrame(ctx,54,390+i*440,972,412,()=>{
      ctx.fillStyle=i===1?P.red:P.ink;ctx.fillRect(54,390+i*440,972,412);
      drawPackage(ctx,{x:540+Math.sin(s*4+i)*80,y:595+i*440,width:i===1?1340:950,angle:(i-1)*.18,rotateY:Math.sin(s*2+i)*.35,explode:clamp(s*1.6-.1)*(i===1?.65:.15)});
      text(ctx,`0${i+1}`,90,445+i*440,24,P.white);
    });
    text(ctx,'DRAW / BREAK / REPEAT',540,1815,24,P.ink,'center');
  }else if(shot===2){
    backdrop(ctx,P.ink);chapter(ctx,'02','ANATOMY',s);
    const ex=.72+Math.sin(s*Math.PI)*.24;
    drawPackage(ctx,{x:540,y:960,width:930,angle:-.30,rotateX:.55,rotateY:.25,explode:ex});
    const labels=[['01','CHROMA',440],['02','CONTOUR',650],['03','GLYPH',1260],['04','MATTER',1480]];
    for(const [n,word,y] of labels){const yy=Number(y);text(ctx,String(n),72,yy,24,P.red);text(ctx,String(word),130,yy,26,P.paper);line(ctx,350,yy,920,yy-90,P.muted,1,.5);}
    for(let i=0;i<8;i++)drawGene(ctx,i,120+i*120,1670,75,0,i%2?P.red:P.white,.65);
  }else if(shot===3){
    backdrop(ctx,P.blue);
    const strip=H/7;
    for(let i=0;i<7;i++){
      ctx.save();ctx.beginPath();ctx.rect(0,i*strip,W,strip-10);ctx.clip();
      const offset=Math.sin(i*1.7+s*4)*170*(1-s*.75);
      ctx.translate(offset,0);ctx.fillStyle=i%2?P.paper:P.blue;ctx.fillRect(-300,i*strip,1680,strip-10);
      drawWordmark(ctx,540,960,1470,440,{outline:i%2===0});
      drawPackage(ctx,{x:540,y:960,width:1500,angle:-.65+s*.3,rotateY:0,opacity:i%2?1:.2});
      ctx.restore();
    }
    text(ctx,'RE / CODE',72,180,76,P.white,'left',900);
    text(ctx,'NOT FOUND IN NATURE',72,1770,23,P.white);
  }else if(shot===4){
    backdrop(ctx,P.paper);chapter(ctx,'03','GENOME',s,P.ink);
    const spin=smooth(s)*Math.PI*2;
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4+spin*.22,x=540+Math.cos(a)*350,y=960+Math.sin(a)*460;
      line(ctx,540,960,x,y,P.blue,2,.3);
      drawGene(ctx,i,x,y,145,a*.15,i%2?P.red:P.blue);
      ring(ctx,x,y,105,P.ink,1);text(ctx,`0${i+1}`,x,y+138,22,P.ink,'center');
    }
    drawPackage(ctx,{x:540,y:960,width:600,angle:-.16,rotateY:.25*Math.cos(spin)});
    text(ctx,'8 LETTERS / 1 PATTERN',540,1630,31,P.ink,'center',800);
    text(ctx,'文明的底层代码',540,1710,35,P.blue,'center',700);
  }else{
    backdrop(ctx,P.black);const grow=smooth(s);
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4-grow*.6;const r=lerp(170,610,grow);
      const x=540+Math.cos(a)*r,y=960+Math.sin(a)*r;
      drawGene(ctx,i,x,y,lerp(75,200,grow),a*.2,i%2?P.red:P.white,1);
      for(let j=0;j<3;j++)ring(ctx,540,960,r+70*j,P.blue,2, a, a+.6);
    }
    drawPackage(ctx,{x:540,y:960,width:lerp(850,460,grow),angle:-.15,opacity:1-smooth((s-.1)/.8),explode:grow});
    text(ctx,'THE PATTERN',540,240,58,P.white,'center',900);
    text(ctx,'WAS ALWAYS HERE',540,1690,35,P.paper,'center',700);
    burst(ctx,540,960,accent*.35+grow*.12,23,P.white);
  }
}

export function drawCoda(ctx:Ctx,t:number){
  backdrop(ctx,P.paper);
  const settle=1-smooth((t-44.8)/.6);
  ctx.save();ctx.globalAlpha=.13;ctx.fillStyle=P.brown;ctx.beginPath();ctx.ellipse(540,1110,290,25,0,0,Math.PI*2);ctx.fill();ctx.restore();
  drawPackage(ctx,{x:540,y:1010-settle*60,width:760+settle*110,angle:-.055+settle*.13,rotateX:.08,rotateY:.05});
  if(t>46.1){ctx.save();ctx.globalAlpha=smooth((t-46.1)/.3);text(ctx,'就一根。',540,1420,37,P.brown,'center',500);ctx.restore();}
  if(t>47.4){ctx.save();ctx.globalAlpha=smooth((t-47.4)/.4)*.65;text(ctx,'全部，由代码画出。',540,1500,22,P.brown,'center',400);ctx.restore();}
}
