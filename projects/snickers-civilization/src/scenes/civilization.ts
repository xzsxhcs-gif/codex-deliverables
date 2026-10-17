import { Ctx, Vec2, P, clamp, lerp, smooth, hash, pulse, poly, line, ring, text, backdrop } from '../core';
import { getGlyphPoints } from '../visuals/brand';

const TAU = Math.PI * 2;
const TITLES = ['TOTEM', 'MYTH', 'PROOF', 'COSMOS', 'EMPIRE', 'ENERGY', 'CIRCUIT', 'CIVILIZATION'];
const SUBS = ['01 / PRIMITIVE MEMORY', '02 / RECURSIVE BELIEF', '03 / THE SAME AXIOM', '04 / EIGHT FIXED STARS', '05 / INHERITED AUTHORITY', '06 / CONSERVED FORM', '07 / DISTRIBUTED MEMORY', '08 / ONE UNDERLYING CODE'];
type Pose = { x: number; y: number; size: number; angle: number };
let source: Vec2[][] | undefined;
const genes = () => source ??= Array.from({length: 8}, (_, i) => getGlyphPoints(i, 64));
let extents: number[] | undefined;
const geneExtent=(i:number)=>(extents??=genes().map(g=>Math.max(...g.map(v=>v.x))-Math.min(...g.map(v=>v.x))))[i];
const rotate = (p: Vec2, a: number): Vec2 => ({x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a)});
const mixPose = (a: Pose, b: Pose, u: number): Pose => ({x: lerp(a.x,b.x,u), y: lerp(a.y,b.y,u), size: lerp(a.size,b.size,u), angle: lerp(a.angle,b.angle,u)});
const colorMix = (a:string,b:string,u:number) => {
  const rgb=(s:string)=>[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)];
  const aa=rgb(a),bb=rgb(b);return `rgb(${aa.map((v,i)=>Math.round(lerp(v,bb[i],u))).join(',')})`;
};
const ground = (s:number) => s===2||s===5 ? P.paper : s===0 ? '#170f10' : P.black;

function pose(stage:number,i:number,t:number):Pose {
  const a=i*TAU/8-Math.PI/2;
  if(stage===0) return {x:540+(i%2===0?-28:28),y:445+i*151,size:166,angle:(i%2===0?-.015:.015)};
  if(stage===1) return {x:540+282*Math.cos(a),y:943+282*Math.sin(a),size:176,angle:a+Math.PI/2};
  if(stage===2) return {x:350+(i%2)*380,y:500+Math.floor(i/2)*290,size:202,angle:0};
  if(stage===3) {
    const radius=185+Math.floor(i/2)*74;
    return {x:540+radius*Math.cos(a),y:935+radius*1.37*Math.sin(a),size:115+(i%3)*14,angle:0};
  }
  if(stage===4) return {x:345+(i%4)*130,y:837+Math.floor(i/4)*260,size:119,angle:0};
  if(stage===5) return {x:540,y:440+i*156,size:430,angle:0};
  if(stage===6) {
    const board=[{x:310,y:445},{x:770,y:445},{x:850,y:790},{x:850,y:1190},{x:770,y:1515},{x:310,y:1515},{x:230,y:1190},{x:230,y:790}];
    return {...board[i],size:174,angle:0};
  }
  const settle=smooth((t-31.45)/.48);
  const city={x:540+360*Math.cos(a),y:920+560*Math.sin(a),size:148,angle:0};
  return mixPose(city,{x:540+340*Math.cos(a),y:920+430*Math.sin(a),size:128,angle:0},settle);
}

function contour(stage:number,i:number,p:Vec2,k:number,t:number):Vec2 {
  const u=k/64,theta=u*TAU,glyph=genes()[i];
  if(stage===0){
    // Fold the lower half of each stroke back onto the upper half, then chisel it.
    const rune={x:Math.round((p.x*(p.y<0?1:-1)+p.y*.42)*6)/6,y:Math.round(p.y*6)/6};
    const carve=smooth((t-16.12)/.45);
    return {x:lerp(p.x,rune.x,carve),y:lerp(p.y,rune.y,carve)};
  }
  if(stage===1){
    // Radial engraving: source stroke width/depth modulate every petal vertex.
    const radius=.24+Math.abs(p.x)*.34+p.y*.16+.075*Math.cos(theta*3);
    return {x:Math.sin(theta)*radius*1.2,y:Math.cos(theta)*radius*1.8};
  }
  if(stage===2){
    const corners=3+Math.round(geneExtent(i)*6)%3;
    const sector=TAU/corners,sectorAngle=(theta+Math.PI/corners)%sector-Math.PI/corners;
    const radius=.43*Math.cos(Math.PI/corners)/Math.cos(sectorAngle);
    return {x:Math.cos(theta)*radius+p.x*.15,y:Math.sin(theta)*radius+p.y*.15};
  }
  if(stage===3){
    // Eight sampled stroke landmarks become stars; the original traversal becomes their route.
    const block=Math.floor(k/8),fraction=(k%8)/8;
    const star=(n:number)=>{
      const v=glyph[(n%8)*8],angle=n*2.399963+v.x*.8;
      const r=.22+Math.hypot(v.x,v.y)*.55;
      return {x:Math.cos(angle)*r,y:Math.sin(angle)*r};
    };
    const a=star(block),b=star((block+1)%8);
    return {x:lerp(a.x,b.x,fraction),y:lerp(a.y,b.y,fraction)};
  }
  if(stage===4){
    // Crossing the inherited stroke once around a seal produces a heraldic ligature.
    return {x:Math.sin(theta*2)*(.27+p.x*.28),y:Math.cos(theta)*(.40+p.y*.24)};
  }
  if(stage===5){
    // Read the contour as a signal: two traversals become the edges of a measured band.
    const travel=k<32?k/31:(63-k)/31;
    return {x:(travel-.5)*1.45,y:p.x*.32+p.y*.12+(k<32?-.045:.045)};
  }
  if(stage===6){
    const block=Math.floor(k/8),fraction=(k%8)/8;
    const pin=(n:number)=>{
      const v=glyph[(n%8)*8];
      return {x:Math.round((v.x+(n%2?.2:-.2))*5)/5,y:Math.round((v.y+Math.sin(n*Math.PI/2)*.18)*5)/5};
    };
    const a=pin(block),b=pin((block+1)%8);
    return {x:lerp(a.x,b.x,clamp(fraction*2)),y:lerp(a.y,b.y,clamp(fraction*2-1))};
  }
  // A digital packet contains the same contour values. It unwraps to the literal alphabet at handoff.
  const travel=u<.5?u*2:(1-u)*2;
  const packet={x:(u<.5?-.3:.3)+p.x*.18,y:travel-.5+p.y*.12};
  const unpack=smooth((t-31.35)/.58);
  return {x:lerp(packet.x,p.x,unpack),y:lerp(packet.y,p.y,unpack)};
}

function points(stage:number,i:number,t:number):Vec2[] {
  const p=pose(stage,i,t);
  return genes()[i].map((v,k)=>{const r=rotate(contour(stage,i,v,k,t),p.angle);return {x:p.x+r.x*p.size,y:p.y+r.y*p.size};});
}

function actualPoints(stage:number,previous:number,i:number,t:number,u:number):Vec2[] {
  const p=mixPose(pose(previous,i,t),pose(stage,i,t),u);
  return genes()[i].map((v,k)=>{
    const v0=contour(previous,i,v,k,t),v1=contour(stage,i,v,k,t);
    const r=rotate({x:lerp(v0.x,v1.x,u),y:lerp(v0.y,v1.y,u)},p.angle);
    return {x:p.x+r.x*p.size,y:p.y+r.y*p.size};
  });
}

function openPath(ctx:Ctx,p:Vec2[],color:string,width=2,alpha=1){
  ctx.save();ctx.globalAlpha*=alpha;poly(ctx,p,undefined,color,width,false);ctx.restore();
}

function emblem(ctx:Ctx,x:number,y:number,size:number,i:number,color:string,alpha=1,angle=0){
  ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate(angle);
  poly(ctx,genes()[i%8].map(p=>({x:p.x*size,y:p.y*size})),undefined,color,Math.max(.8,size/80));ctx.restore();
}

function wrapperFrame(ctx:Ctx,x:number,y:number,w:number,h:number,color:string,amount=1){
  const p:Vec2[]=[];
  for(let j=0;j<11;j++)p.push({x:x-w/2+j*w/10,y:y-h/2+(j%2)*11});
  for(let j=10;j>=0;j--)p.push({x:x-w/2+j*w/10,y:y+h/2-(j%2)*11});
  ctx.save();ctx.globalAlpha*=amount;poly(ctx,p,undefined,color,2);ctx.restore();
}

function totem(ctx:Ctx,t:number,alpha:number){
  ctx.save();ctx.globalAlpha*=alpha;
  const stone=ctx.createLinearGradient(338,0,756,0);stone.addColorStop(0,'#100c0c');stone.addColorStop(.33,'#38241c');stone.addColorStop(.53,'#593322');stone.addColorStop(1,'#100c0c');
  ctx.fillStyle=stone;ctx.fillRect(344,298,392,1390);
  wrapperFrame(ctx,540,992,396,1390,P.gold,.65);
  line(ctx,368,311,368,1676,P.red,15,.6);line(ctx,712,311,712,1676,P.blue,15,.8);
  // Every chisel mark is copied from a vertex of one of the eight source letters.
  for(let i=0;i<8;i++){
    const p=points(0,i,t);
    for(let k=0;k<64;k+=8){const v=p[k];line(ctx,352,v.y,384+v.x*.018,v.y-8,P.gold,1,.35);line(ctx,700,v.y,730,v.y+8,P.paper,1,.27);}
    line(ctx,392,515+i*151,687,515+i*151,P.gold,1,.24);
    for(let side=0;side<2;side++){
      const x=side===0?185:895;
      emblem(ctx,x,450+i*151,47,i,P.gold,.4,side===0?Math.PI/2:-Math.PI/2);
      line(ctx,x,485+i*151,x,545+i*151,P.gold,1,.2);
    }
  }
  for(let i=0;i<5;i++)wrapperFrame(ctx,540,992,440+i*84,1450+i*36,P.gold,.13-i*.018);
  ctx.restore();
}

function myth(ctx:Ctx,t:number,alpha:number){
  ctx.save();ctx.globalAlpha*=alpha;
  const a=(t-18)*.09;
  for(let layer=0;layer<3;layer++){
    const radius=235+layer*172;
    ring(ctx,540,943,radius,P.gold,layer===1?3:1.5);
    for(let i=0;i<8;i++){
      const theta=i*TAU/8-Math.PI/2;
      const glyph=genes()[i];
      // Eight letter outlines are bent into eight petals; no stock rosette is used.
      const petal=glyph.map((v,k)=>{
        const folded=contour(1,i,v,k,t);
        const angular=theta+folded.x*.74;
        const r=radius+folded.y*(128+layer*28);
        return {x:540+Math.cos(angular)*r,y:943+Math.sin(angular)*r};
      });
      poly(ctx,petal,undefined,layer===1?P.red:P.gold,layer===1?3:1.4);
      if(layer===2){
        const v=petal[8];line(ctx,540+Math.cos(theta)*310,943+Math.sin(theta)*310,v.x,v.y,P.paper,1,.28);
        emblem(ctx,540+Math.cos(theta+a)*630,943+Math.sin(theta+a)*630,54,i,P.paper,.44,theta+Math.PI/2);
      }
    }
  }
  ring(ctx,540,943,128,P.red,12);ring(ctx,540,943,112,P.paper,2);
  poly(ctx,genes()[0].map((v,k)=>{const p=contour(1,0,v,k,t);return{x:540+p.x*150,y:943+p.y*150};}),undefined,P.paper,2.5);
  for(let i=0;i<24;i++){
    const theta=i*TAU/24+a;const r=i%3===0?659:628;
    line(ctx,540+Math.cos(theta)*610,943+Math.sin(theta)*610,540+Math.cos(theta)*r,943+Math.sin(theta)*r,P.gold,i%3===0?3:1,.5);
  }
  ctx.restore();
}

function proof(ctx:Ctx,t:number,alpha:number){
  ctx.save();ctx.globalAlpha*=alpha;
  const cols=[P.blue,P.red];
  for(let i=0;i<8;i++){
    const p=points(2,i,t),center=pose(2,i,t);
    const A=p[4],B=p[23],C=p[45];
    ctx.save();ctx.globalAlpha*=.4;
    ring(ctx,A.x,A.y,Math.hypot(B.x-A.x,B.y-A.y),cols[i%2],1.4);
    ring(ctx,B.x,B.y,Math.hypot(C.x-B.x,C.y-B.y),cols[1-i%2],1.1);
    poly(ctx,[A,B,C],undefined,P.ink,1.3);
    line(ctx,center.x-158,center.y,center.x+158,center.y,P.ink,1,.2);
    line(ctx,center.x,center.y-140,center.x,center.y+140,P.ink,1,.2);
    ctx.restore();
    [A,B,C].forEach((v,k)=>{ring(ctx,v.x,v.y,5,cols[i%2],2);text(ctx,['A','B','C'][k],v.x+13,v.y-15,15,cols[i%2]);});
    text(ctx,`G${i+1}`,center.x-124,center.y+135,18,P.ink);
    if(i<6){const q=points(2,i+2,t)[4];line(ctx,C.x,C.y,q.x,q.y,P.blue,1,.18);}
  }
  line(ctx,540,330,540,1680,P.red,2,.3);
  text(ctx,'S : N : I : C : K : E : R : S',540,1720,24,P.ink,'center',500);
  ctx.restore();
}

function cosmos(ctx:Ctx,t:number,alpha:number){
  ctx.save();ctx.globalAlpha*=alpha;
  const spin=(t-22)*.12;
  for(let i=0;i<8;i++){
    const center=pose(3,i,t),glyph=genes()[i];
    const orbit:Vec2[]=[];
    for(let j=0;j<=72;j++){
      const a=j*TAU/72;
      const gene=glyph[j%64];
      const r=185+Math.floor(i/2)*74+gene.y*19;
      const v=rotate({x:Math.cos(a)*r,y:Math.sin(a)*r*.56},(i%4)*Math.PI/4+spin);
      orbit.push({x:540+v.x,y:935+v.y*1.65});
    }
    openPath(ctx,orbit,i%2===0?P.blue:P.gold,1.5,.55);
    const p=points(3,i,t);
    for(let k=0;k<64;k+=8){
      const v=p[k];ring(ctx,v.x,v.y,k%16===0?3.7:2,P.paper,1.3);
      if(k<56)line(ctx,v.x,v.y,p[k+8].x,p[k+8].y,P.paper,1,.3);
    }
    line(ctx,center.x,center.y,540,935,P.electric,1,.13);
    text(ctx,`0${i+1}`,center.x+84,center.y+36,17,P.gold);
  }
  const glow=ctx.createRadialGradient(540,935,1,540,935,108);glow.addColorStop(0,'rgba(255,247,232,.65)');glow.addColorStop(.08,'rgba(215,164,84,.28)');glow.addColorStop(1,'rgba(215,164,84,0)');
  ctx.fillStyle=glow;ctx.fillRect(430,825,220,220);
  ring(ctx,540,935,17,P.paper,2);ring(ctx,540,935,52,P.red,1);
  for(let i=0;i<80;i++){
    const g=genes()[i%8][(i*7)%64];
    const x=540+g.x*(870+hash(i)*300),y=935+g.y*(1370+hash(i+50)*500);
    line(ctx,x-2,y,x+2,y,P.paper,1,.18+hash(i)*.3);
  }
  ctx.restore();
}

function empire(ctx:Ctx,t:number,alpha:number){
  ctx.save();ctx.globalAlpha*=alpha;
  const wave=Math.sin((t-24)*2)*9;
  // Fold the long package into a heraldic seal. The wrapper's red/white/blue order survives.
  const shield=[{x:176,y:524},{x:540,y:430},{x:904,y:524},{x:872,y:1180},{x:540,y:1542},{x:208,y:1180}];
  poly(ctx,shield,P.brown,P.gold,3);
  ctx.save();ctx.beginPath();shield.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.clip();
  poly(ctx,[{x:320,y:430},{x:760,y:430},{x:760+wave,y:1550},{x:320+wave,y:1550}],P.red);
  poly(ctx,[{x:346,y:430},{x:734,y:430},{x:734+wave,y:1550},{x:346+wave,y:1550}],P.paper);
  poly(ctx,[{x:370,y:430},{x:710,y:430},{x:710+wave,y:1550},{x:370+wave,y:1550}],P.blue);
  ctx.restore();
  for(let side=0;side<2;side++){
    const x=side===0?118:962;
    for(let k=0;k<8;k++){
      const theta=(k/7-.5)*1.55;
      const branchX=x+(side===0?-1:1)*Math.cos(theta)*47;
      const branchY=950+Math.sin(theta)*660;
      emblem(ctx,branchX,branchY,66,k,P.gold,.9,side===0?-.4:.4);
      if(k<7)line(ctx,branchX,branchY,x+(side===0?-1:1)*Math.cos(theta+.22)*47,950+Math.sin(theta+.22)*660,P.gold,1.5,.6);
    }
  }
  for(let row=0;row<2;row++){
    poly(ctx,[{x:229,y:754+row*260},{x:851,y:730+row*260},{x:851,y:919+row*260},{x:229,y:944+row*260}],P.paper,P.red,5);
    line(ctx,242,767+row*260,838,744+row*260,P.blue,7);
  }
  text(ctx,'VIII',540,598,61,P.paper,'center',800);
  text(ctx,'S · N · I · C · K · E · R · S',540,1642,22,P.gold,'center',500);
  ctx.restore();
}

function energy(ctx:Ctx,t:number,alpha:number){
  ctx.save();ctx.globalAlpha*=alpha;
  for(let i=0;i<8;i++){
    const p=points(5,i,t),c=pose(5,i,t);
    line(ctx,c.x-144,c.y+124,c.x+144,c.y+124,P.ink,1,.44);
    line(ctx,c.x-136,c.y+134,c.x-136,c.y-135,P.ink,1,.44);
    // Oscillograms use contour coordinates as their measured signal.
    const trace=genes()[i].map((g,k)=>({x:c.x-128+k*4.1,y:c.y+124-g.y*40-20}));
    openPath(ctx,trace,P.red,2,.8);
    for(let k=0;k<64;k+=16){const v=p[k];line(ctx,v.x,v.y,c.x-128+k*4.1,c.y+124,P.blue,1,.24);ring(ctx,v.x,v.y,4,P.red,2);}
    text(ctx,['S = f(t)','N = 2S','I / dt','C = S²','K = ΔS','E = ∑ S','R = S⁻¹','S = S'][i],c.x+132,c.y-118,22,P.blue,'right',500);
  }
  line(ctx,94,1644,986,1644,P.ink,2,.4);
  text(ctx,'FORM IS CONSERVED',540,1695,30,P.ink,'center',600);
  ctx.restore();
}

function circuit(ctx:Ctx,t:number,alpha:number){
  ctx.save();ctx.globalAlpha*=alpha;
  for(let i=0;i<8;i++){
    const p=points(6,i,t),c=pose(6,i,t);
    ctx.strokeStyle=P.blue;ctx.lineWidth=2;ctx.strokeRect(c.x-118,c.y-124,236,248);
    for(let k=0;k<64;k+=8){
      const v=p[k],side=k%16===0?-1:1;
      const edgeX=c.x+side*118;
      const targetX=side<0?100+(k/8)*13:980-(k/8)*13;
      const targetY=340+i*164+(k%16)*7;
      const path=[v,{x:edgeX,y:v.y},{x:edgeX,y:targetY},{x:targetX,y:targetY}];
      openPath(ctx,path,k%16===0?P.electric:P.red,1.5,.52);
      ring(ctx,v.x,v.y,4,P.paper,1.3);
      const travel=(t*2.5+k/8+i*.19)%1;
      const j=Math.min(2,Math.floor(travel*3)),u=(travel*3)%1;
      const x=lerp(path[j].x,path[j+1].x,u),y=lerp(path[j].y,path[j+1].y,u);
      ctx.fillStyle=P.paper;ctx.fillRect(x-3,y-3,6,6);
    }
    for(let j=0;j<7;j++){
      line(ctx,c.x-122,c.y-90+j*30,c.x-136,c.y-90+j*30,P.gold,3,.7);
      line(ctx,c.x+122,c.y-90+j*30,c.x+136,c.y-90+j*30,P.gold,3,.7);
    }
    text(ctx,`G${i+1} / ${genes()[i].length}`,c.x,c.y+151,16,P.muted,'center');
  }
  text(ctx,'S N I C K E R S',540,1712,29,P.paper,'center',500);
  ctx.restore();
}

function civilization(ctx:Ctx,t:number,alpha:number){
  ctx.save();ctx.globalAlpha*=alpha;
  const settle=smooth((t-31.45)/.48),detail=1-settle*.92;
  // An information city grows from extruded letter vertices, then releases the original eight genes.
  for(let layer=3;layer>=0;layer--){
    for(let i=0;i<8;i++){
      const p=points(7,i,t),depth=(layer+1)*24*detail;
      const q=p.map(v=>({x:540+(v.x-540)*(1+layer*.055),y:v.y-depth}));
      openPath(ctx,[...q,q[0]],layer%2===0?P.blue:P.red,1,.32*detail);
      for(let k=0;k<64;k+=16)line(ctx,p[k].x,p[k].y,q[k].x,q[k].y,P.electric,1,.35*detail);
    }
  }
  for(let i=0;i<8;i++){
    const p=points(7,i,t),q=points(7,(i+3)%8,t);
    for(let k=0;k<64;k+=16){
      const a=p[k],b=q[(k+24)%64];
      const route=[a,{x:a.x,y:lerp(a.y,b.y,.5)},{x:b.x,y:lerp(a.y,b.y,.5)},b];
      openPath(ctx,route,i%2===0?P.blue:P.red,1.1,.24*detail);
    }
    const c=pose(7,i,t);
    text(ctx,`0${i+1}`,c.x+79,c.y+87,16,P.muted);
  }
  const growth=smooth((t-30.4)/.5)*(1-settle);
  if(growth>0){
    ctx.save();ctx.globalAlpha*=growth;
    for(let i=0;i<28;i++){
      const index=i%8,vertex=genes()[index][(i*9)%64];
      const x=540+vertex.x*1160,y=1600+(vertex.y*.5)*500;
      const height=90+hash(i)*210;
      poly(ctx,[{x:x-23,y},{x:x,y:y-18},{x:x+23,y},{x:x+23,y:y-height},{x:x,y:y-height-18},{x:x-23,y:y-height}],undefined,i%3===0?P.red:P.electric,1.2);
      line(ctx,x,y-18,x,y-height-18,P.paper,1,.4);
    }
    ctx.restore();
  }
  ctx.restore();
}

const decorations=[totem,myth,proof,cosmos,empire,energy,circuit,civilization];

function genealogyRail(ctx:Ctx,stage:number,t:number,alpha:number){
  const light=stage===2||stage===5;
  ctx.save();ctx.globalAlpha*=alpha;
  line(ctx,87,1810,993,1810,light?P.ink:P.muted,1,.3);
  for(let i=0;i<8;i++){
    const x=132+i*116;
    emblem(ctx,x,1847,33,i,light?P.blue:P.paper,i===stage?1:.35);
    if(i<=stage)line(ctx,x-12,1809,x+12,1809,i===stage?P.red:light?P.blue:P.electric,3);
  }
  ctx.restore();
}

/** One persistent eight-path alphabet, transformed through eight civilizations. */
export function drawCivilization(ctx:Ctx,t:number){
  const seconds=clamp(t-16,0,15.999999);
  const stage=Math.min(7,Math.floor(seconds/2)),previous=Math.max(0,stage-1),local=seconds-stage*2;
  const transition=stage===0?1:smooth(local/.43);
  const finish=smooth((t-31.45)/.48);
  const hit=pulse(t,12),light=stage===2||stage===5;
  backdrop(ctx,colorMix(ground(previous),ground(stage),transition));

  const cameraBurst=smooth((local-.78)/.17)*(1-smooth((local-1.42)/.36));
  const lenses=[1.92,1.65,1.98,1.39,1.52,2.1,2.04,1.32];
  const targets=[{x:540,y:810},{x:540,y:943},{x:350,y:790},{x:540,y:935},{x:540,y:905},{x:758,y:790},{x:318,y:1092},{x:540,y:1090}];
  const cam=1+cameraBurst*(lenses[stage]-1)*(1-finish);
  const focus={x:lerp(540,targets[stage].x,cameraBurst*(1-finish)),y:lerp(945,targets[stage].y,cameraBurst*(1-finish))};
  ctx.save();ctx.translate(540,945);ctx.scale(cam,cam);ctx.rotate((stage%2?1:-1)*cameraBurst*.024*(1-finish));ctx.translate(-focus.x,-focus.y);
  if(transition<1)decorations[previous](ctx,t,1-transition);
  decorations[stage](ctx,t,transition);

  if(transition>0&&transition<1){
    ctx.save();ctx.globalAlpha*=Math.sin(transition*Math.PI)*.36;
    for(let i=0;i<8;i++){
      const before=points(previous,i,t),after=points(stage,i,t);
      for(let k=0;k<64;k+=16){
        const a=before[k],b=after[k];
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.bezierCurveTo(a.x+(540-a.x)*.4,a.y,b.x,b.y+(945-b.y)*.35,b.x,b.y);
        ctx.strokeStyle=i%2?P.red:P.electric;ctx.lineWidth=1.3;ctx.stroke();
      }
    }
    ctx.restore();
  }

  const accent=light?P.blue:P.paper;
  for(let i=0;i<8;i++){
    const pts=actualPoints(stage,previous,i,t,transition);
    const color=stage===4?P.blue:(i%4===1?P.red:i%4===2?(light?P.blue:P.electric):accent);
    // Three offset contours show the inherited wrapper laminate under each symbol.
    if(stage!==3&&stage!==5){
      const dx=(1.2+hit*3)*(1-finish),dy=(2+hit*2)*(1-finish);
      ctx.save();ctx.globalAlpha*=.23*(1-finish);
      poly(ctx,pts.map(v=>({x:v.x+dx*3,y:v.y+dy*3})),undefined,P.red,2);
      poly(ctx,pts.map(v=>({x:v.x-dx*2,y:v.y-dy*2})),undefined,P.blue,2);ctx.restore();
    }
    ctx.save();ctx.globalAlpha*=stage===4?.98:stage===6?.32:stage===7?.24:.13+(stage===0?.19:0);poly(ctx,pts,color);ctx.restore();
    poly(ctx,pts,undefined,color,stage===0?3.7:stage===4?2:3.1);
    // One moving vertex remains attached to each source contour throughout morphs.
    const marker=pts[(Math.floor(t*20)+i*7)%pts.length];
    if(stage!==0&&stage!==4&&finish<1){ctx.save();ctx.globalAlpha*=.65*(1-finish);ctx.fillStyle=light?P.red:P.gold;ctx.fillRect(marker.x-3,marker.y-3,6,6);ctx.restore();}
  }

  // Speed strokes radiate from measured glyph vertices only on the strong eighth-note cuts.
  if(hit>.6&&local>.55&&finish<1){
    for(let i=0;i<8;i++){
      const p=actualPoints(stage,previous,i,t,transition)[i*7];
      const dx=p.x-540,dy=p.y-945,d=Math.max(1,Math.hypot(dx,dy));
      line(ctx,p.x+dx/d*155,p.y+dy/d*155,p.x+dx/d*340,p.y+dy/d*340,light?P.ink:P.paper,2,(hit-.6)*.42*(1-finish));
    }
  }
  ctx.restore();

  const titleShift=(1-smooth(local/.2))*45;
  const chapterAlpha=(1-smooth((local-.52)/.29))*(1-finish);
  ctx.save();ctx.globalAlpha*=chapterAlpha;
  text(ctx,SUBS[stage],84,116,18,light?P.ink:P.muted,'left',500);
  const title=TITLES[stage];
  text(ctx,title,80-titleShift,216,title==='CIVILIZATION'?84:112,light?P.ink:P.paper,'left',800);
  line(ctx,84,285,996,285,light?P.ink:P.paper,1,.28);
  ctx.fillStyle=P.red;ctx.fillRect(84,282,Math.max(6,912*local/2),5);
  ctx.restore();
  genealogyRail(ctx,stage,t,(1-finish)*(1-cameraBurst*.75));
}
