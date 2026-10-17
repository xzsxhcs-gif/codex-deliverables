import { type Ctx, type Vec2, P, clamp, smooth, lerp, poly } from '../core';

export const WORD = 'SNICKERS';
type V3 = Vec2 & { z: number };
type Command = ['M' | 'L', number, number] | ['Q', number, number, number, number];
type Glyph = { width: number; paths: Vec2[][] };

// Original hand-built contours: the wordmark never invokes fillText or a font.
function contour(commands: Command[]): Vec2[] {
  const points: Vec2[] = [];
  let current = {x: 0, y: 0};
  for (const c of commands) {
    if (c[0] !== 'Q') { current = {x:c[1], y:c[2]}; points.push(current); }
    else {
      const start = current;
      for (let j=1;j<=6;j++) { const u=j/6, v=1-u; points.push({x:v*v*start.x+2*v*u*c[1]+u*u*c[3],y:v*v*start.y+2*v*u*c[2]+u*u*c[4]}); }
      current={x:c[3],y:c[4]};
    }
  }
  return points;
}
const S: Command[] = [['M',81,8],['Q',62,0,40,0],['Q',0,0,0,38],['Q',0,64,26,75],['L',49,85],['Q',58,89,58,99],['Q',58,113,43,113],['Q',22,113,2,103],['L',2,133],['Q',20,142,43,142],['Q',85,142,85,101],['Q',85,76,60,65],['L',37,55],['Q',26,51,26,41],['Q',26,28,42,28],['Q',62,28,81,37]];
const contours: {width:number; paths:Command[][]}[] = [
  {width:85,paths:[S]},
  {width:90,paths:[[['M',0,2],['L',27,2],['L',63,82],['L',63,2],['L',90,2],['L',90,140],['L',63,140],['L',27,61],['L',27,140],['L',0,140]]]},
  {width:31,paths:[[['M',0,2],['L',31,2],['L',31,140],['L',0,140]]]},
  {width:82,paths:[[['M',82,9],['Q',65,0,44,0],['Q',0,0,0,44],['L',0,99],['Q',0,142,44,142],['Q',64,142,82,133],['L',82,102],['Q',64,112,49,112],['Q',30,112,30,94],['L',30,49],['Q',30,30,49,30],['Q',64,30,82,40]]]},
  {width:93,paths:[[['M',0,2],['L',29,2],['L',29,57],['L',61,2],['L',94,2],['L',55,65],['L',96,140],['L',61,140],['L',34,87],['L',29,95],['L',29,140],['L',0,140]]]},
  {width:76,paths:[[['M',0,2],['L',76,2],['L',76,31],['L',30,31],['L',30,55],['L',69,55],['L',69,83],['L',30,83],['L',30,111],['L',76,111],['L',76,140],['L',0,140]]]},
  {width:88,paths:[[['M',0,2],['L',46,2],['Q',86,2,86,40],['L',86,49],['Q',86,73,68,81],['L',94,140],['L',61,140],['L',39,87],['L',29,87],['L',29,140],['L',0,140]], [['M',29,29],['L',29,61],['L',43,61],['Q',56,61,56,46],['L',56,43],['Q',56,29,43,29]]]},
  {width:85,paths:[S]},
];
const GLYPHS: Glyph[] = contours.map(g=>({width:g.width,paths:g.paths.map(contour)}));
const TRACK = 14;
const TOTAL = GLYPHS.reduce((s,g)=>s+g.width,0)+TRACK*7+24;
const STARTS = GLYPHS.map((_,i)=>GLYPHS.slice(0,i).reduce((s,g)=>s+g.width+TRACK,0));
const slant = (p:Vec2):Vec2=>({x:p.x+(142-p.y)*.168,y:p.y});
const normalized = (p:Vec2,index:number):Vec2=>({x:(slant(p).x-(GLYPHS[index].width+24)/2)/142,y:(p.y-71)/142});

function sampleClosed(points:Vec2[],count:number):Vec2[] {
  const lengths:number[]=[];let total=0;
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];total+=Math.hypot(b.x-a.x,b.y-a.y);lengths.push(total);}
  const output:Vec2[]=[];let segment=0;
  for(let i=0;i<count;i++){const d=total*i/count;while(segment<lengths.length-1&&lengths[segment]<d)segment++;const prev=segment?lengths[segment-1]:0;const u=(d-prev)/(lengths[segment]-prev||1);const a=points[segment],b=points[(segment+1)%points.length];output.push({x:lerp(a.x,b.x,u),y:lerp(a.y,b.y,u)});}
  return output;
}
const samples = new Map<string,Vec2[]>();
export function getGlyphPoints(index:number,count=64):Vec2[] {
  const i=((index%8)+8)%8,n=Math.max(3,Math.floor(count)),key=`${i}:${n}`;
  if(!samples.has(key))samples.set(key,sampleClosed(GLYPHS[i].paths[0].map(p=>normalized(p,i)),n));
  return samples.get(key)!.map(p=>({...p}));
}
export function getWordmarkGlyphLayout(width:number,height:number):{x:number;y:number;scaleX:number;scaleY:number}[]{
  return GLYPHS.map((g,i)=>({x:(STARTS[i]+(g.width+24)/2-TOTAL/2)/TOTAL*width,y:0,scaleX:142*width/TOTAL,scaleY:height}));
}
export function getWordmarkPoints(width:number,height:number,count=64):Vec2[][]{
  return getWordmarkGlyphLayout(width,height).map((layout,i)=>getGlyphPoints(i,count).map(p=>({x:layout.x+p.x*layout.scaleX,y:p.y*layout.scaleY})));
}
function canvasPaths(ctx:Ctx,paths:Vec2[][],map:(p:Vec2)=>Vec2):void{
  ctx.beginPath();for(const path of paths){path.forEach((p,i)=>{const q=map(p);if(!i)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y);});ctx.closePath();}
}
function strokeProgress(ctx:Ctx,points:Vec2[],progress:number,color:string,width:number):void{
  if(progress<=0||!points.length)return;
  const p=sampleClosed(points,120),count=Math.max(1,Math.ceil(clamp(progress)*p.length));
  ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<count;i++)ctx.lineTo(p[i].x,p[i].y);if(progress>=1)ctx.closePath();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();
}
export function drawGene(ctx:Ctx,index:number,x:number,y:number,size:number,angle=0,color:string=P.white,alpha=1):void{
  const i=((index%8)+8)%8;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(x,y);ctx.rotate(angle);
  canvasPaths(ctx,GLYPHS[i].paths,p=>{const q=normalized(p,i);return{x:q.x*size,y:q.y*size};});ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,size*.021);ctx.lineJoin='round';ctx.stroke();ctx.restore();
}
export function drawWordmark(ctx:Ctx,x:number,y:number,width:number,height:number,options:{alpha?:number;outline?:boolean;progress?:number}={}):void{
  ctx.save();ctx.globalAlpha*=options.alpha??1;ctx.lineJoin='round';
  const progress=clamp(options.progress??1);
  GLYPHS.forEach((g,i)=>{
    const local=clamp(progress*8-i),map=(p:Vec2)=>{const q=slant(p);return{x:x+(STARTS[i]+q.x-TOTAL/2)/TOTAL*width,y:y+(q.y/142-.5)*height};};
    if(options.outline||local<1){g.paths.forEach(path=>strokeProgress(ctx,path.map(map),local,P.blue,Math.max(1.4,height*.015)));}
    else{canvasPaths(ctx,g.paths,map);ctx.fillStyle=P.blue;ctx.fill('evenodd');}
  });ctx.restore();
}

export interface PackageOptions {x:number;y:number;width:number;angle?:number;rotateX?:number;rotateY?:number;opacity?:number;wire?:number;build?:number;explode?:number}

function wrapperOutline():Vec2[]{
  const points:Vec2[]=[{x:-420,y:-119},{x:-353,y:-116},{x:-330,y:-126},{x:328,y:-126},{x:353,y:-116},{x:430,y:-119}];
  for(let i=0;i<21;i++)points.push({x:i%2?447:439,y:-117+i*11.7});
  points.push({x:425,y:119},{x:353,y:116},{x:328,y:126},{x:-330,y:126},{x:-353,y:116},{x:-425,y:119});
  for(let i=0;i<21;i++)points.push({x:i%2?-447:-439,y:117-i*11.7});
  return points;
}
const WRAPPER=wrapperOutline();
const LABEL:Vec2[]=[{x:-326,y:-94},{x:326,y:-94},{x:333,y:94},{x:-333,y:94}];
const LABEL_WHITE:Vec2[]=[{x:-313,y:-82},{x:313,y:-82},{x:319,y:82},{x:-319,y:82}];
const rect=(x:number,y:number,w:number,h:number):Vec2[]=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];

export function drawPackage(ctx:Ctx,options:PackageOptions):void{
  const {x,y,width}=options,build=clamp(options.build??1),wire=clamp(options.wire??0),explode=clamp(options.explode??0);
  const rx=options.rotateX??-.12,ry=options.rotateY??0,rz=options.angle??0;
  const cx=Math.cos(rx),sx=Math.sin(rx),cy=Math.cos(ry),sy=Math.sin(ry),cz=Math.cos(rz),sz=Math.sin(rz),scale=width/900;
  const rotate=(p:V3):V3=>{const xx=p.x*cy+p.z*sy,zz=-p.x*sy+p.z*cy;return{x:xx,y:p.y*cx-zz*sx,z:p.y*sx+zz*cx};};
  const project=(p:V3):Vec2=>{const q=rotate(p),k=1750/(1750-q.z);return{x:x+(q.x*cz-q.y*sz)*k*scale,y:y+(q.x*sz+q.y*cz)*k*scale};};
  const at=(p:Vec2,z=27):Vec2=>project({...p,z});
  const face=(pts:Vec2[],z:number,fill:string,stroke?:string,lw=1)=>poly(ctx,pts.map(p=>at(p,z)),fill,stroke,lw*scale);
  const baseA=smooth((build-.11)/.34)*(1-wire*.92),labelA=smooth((build-.38)/.25)*(1-wire*.86),inkA=smooth((build-.6)/.4)*(1-wire*.9);
  ctx.save();ctx.globalAlpha*=options.opacity??1;ctx.lineJoin='round';
  if(build<=0){ctx.restore();return;}
  // All wrapper planes and letter vertices share one 3-D projection.
  const surfaces:[V3[],string][]=[
    [[{x:-340,y:-126,z:27},{x:340,y:-126,z:27},{x:340,y:-117,z:-30},{x:-340,y:-117,z:-30}],'#673d28'],
    [[{x:-340,y:126,z:27},{x:340,y:126,z:27},{x:340,y:117,z:-30},{x:-340,y:117,z:-30}],'#25130e'],
    [[{x:-340,y:-126,z:27},{x:-340,y:126,z:27},{x:-340,y:117,z:-30},{x:-340,y:-117,z:-30}],'#341d16'],
    [[{x:340,y:-126,z:27},{x:340,y:126,z:27},{x:340,y:117,z:-30},{x:340,y:-117,z:-30}],'#5c3523'],
    [rect(-340,-117,680,234).map(p=>({...p,z:-30})),'#3c241a'],
  ];
  surfaces.sort((a,b)=>a[0].reduce((s,p)=>s+rotate(p).z,0)/4-b[0].reduce((s,p)=>s+rotate(p).z,0)/4);
  ctx.save();ctx.globalAlpha*=baseA;
  for(const [points,color]of surfaces)poly(ctx,points.map(project),color,'#905a39',.75*scale);
  const frontOffset=explode*36;
  const outline=WRAPPER.map(p=>({x:p.x,y:p.y*(1+explode*.12)}));
  const grad=ctx.createLinearGradient(at({x:0,y:-126}).x,at({x:0,y:-126}).y,at({x:0,y:126}).x,at({x:0,y:126}).y);grad.addColorStop(0,'#744a30');grad.addColorStop(.13,'#51301f');grad.addColorStop(.48,'#372017');grad.addColorStop(.76,'#46281c');grad.addColorStop(.94,'#643b25');grad.addColorStop(1,'#2d1a13');
  ctx.beginPath();outline.map(p=>at(p,28+frontOffset)).forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=grad;ctx.fill();ctx.strokeStyle='#8c5c3b';ctx.lineWidth=1.1*scale;ctx.stroke();
  // Fold geometry is constructed from the same envelope, never texture sampled.
  for(const side of[-1,1]){
    for(let i=0;i<7;i++){const xx=side*(363+i*10);face([{x:xx,y:-116},{x:xx+side*3,y:-117},{x:xx+side*1,y:115},{x:xx-side*2,y:116}],29+frontOffset,i%2?'#6e452d':'#2b1912');}
    face([{x:side*347,y:-114},{x:side*417,y:-84},{x:side*351,y:-72}],29+frontOffset,'#75492e');
    face([{x:side*350,y:69},{x:side*424,y:102},{x:side*346,y:117}],29+frontOffset,'#68412a');
    face([{x:side*346,y:-108},{x:side*383,y:-38},{x:side*355,y:80}],30+frontOffset,'#4f2d20');
    face([{x:side*395,y:-79},{x:side*421,y:-57},{x:side*419,y:68},{x:side*399,y:82}],30+frontOffset,'#41271b');
  }
  face([{x:-327,y:-122},{x:325,y:-122},{x:337,y:-111},{x:-337,y:-111}],30+frontOffset,'#a06b41');
  face([{x:-330,y:114},{x:330,y:114},{x:324,y:121},{x:-324,y:121}],30+frontOffset,'#291810');
  // Tiny drawn production marks and an energy stripe, deliberately not extra copy.
  for(let i=0;i<15;i++){const xx=362+i*3.2;face(rect(xx,-36,(i%4===0?2:1),66),31+frontOffset,i%3?'#b49b71':'#e0c29a');}
  face(rect(-410,-21,40,5),31+frontOffset,P.white);face(rect(-410,-10,30,4),31+frontOffset,P.gold);face(rect(-410,1,35,3),31+frontOffset,'#a97b4e');
  ctx.restore();
  const lz=32+explode*110;
  ctx.save();ctx.globalAlpha*=labelA;
  face(LABEL.map(p=>({x:p.x+4,y:p.y+5})),lz-1,'#1a1010');
  face(LABEL,lz,P.red);
  face(LABEL_WHITE,lz+1,'#fffdf3');
  // Hairline navy side accents strengthen the red / white / blue genealogy.
  face(rect(-314,-82,628,3),lz+2,'#c5c7ce');
  ctx.restore();
  ctx.save();ctx.globalAlpha*=inkA;
  const logoWidth=603,logoHeight=137;
  GLYPHS.forEach((g,i)=>{
    const reveal=smooth((build-(.58+i*.032))/.17);
    if(reveal<=0)return;
    const offset=(i-3.5)*explode*37,dy=Math.sin(i*1.6)*explode*32,zz=lz+4+explode*(22+Math.abs(i-3.5)*9);
    const mapped=(p:Vec2):Vec2=>{const q=slant(p);return at({x:(STARTS[i]+q.x-TOTAL/2)/TOTAL*logoWidth+offset,y:(q.y/142-.5)*logoHeight+dy},zz);};
    ctx.save();ctx.globalAlpha*=reveal;canvasPaths(ctx,g.paths,mapped);ctx.fillStyle=P.blue;ctx.fill('evenodd');ctx.restore();
  });ctx.restore();
  // Construction drawing survives until the solids, label, and ink are resolved.
  const wireA=Math.max(wire,(1-smooth((build-.72)/.28))*.88);
  if(wireA>0.001){
    ctx.save();ctx.globalAlpha*=wireA;
    strokeProgress(ctx,outline.map(p=>at(p,29+frontOffset)),build*3.2,P.white,1.5*scale);
    strokeProgress(ctx,LABEL.map(p=>at(p,lz+3)),clamp((build-.18)*2.8),P.red,2*scale);
    GLYPHS.forEach((g,i)=>g.paths.forEach(path=>strokeProgress(ctx,path.map(p=>{const q=slant(p);return at({x:(STARTS[i]+q.x-TOTAL/2)/TOTAL*603+(i-3.5)*explode*37,y:(q.y/142-.5)*137+Math.sin(i*1.6)*explode*32},lz+5+explode*(22+Math.abs(i-3.5)*9));}),clamp((build-.34-i*.028)*3.1),P.electric,1.35*scale)));
    for(const yy of[-126,126])for(const xx of[-340,340]){const a=at({x:xx,y:yy},27),b=at({x:xx,y:yy*.93},-30);ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.strokeStyle=P.gold;ctx.lineWidth=.8*scale;ctx.stroke();}
    ctx.restore();
  }
  ctx.restore();
}
