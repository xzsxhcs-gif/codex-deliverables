/** The composition desk: one shared clock, one shared projection, one small maker. */
const W=1920,H=1080, START=3.7, SPAN=90.02975;
const CHANNELS=[0,1,2,3,4,5,6,7,9];
const CENTERS={0:70,1:51,2:76,3:64,4:77,5:60,6:67,7:42,9:49};
const LABELS={0:'钢琴',1:'大提琴',2:'小提琴',3:'弦乐',4:'长笛',5:'圆号',6:'竖琴',7:'定音鼓',9:'轻钹'};
const COLORS={0:'#e8c799',1:'#b8c6c2',2:'#cec3dc',3:'#afbed0',4:'#b7d8ce',5:'#d6b783',6:'#c4d3df',7:'#c0b2a7',9:'#c8ccd2'};
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const mix=(a,b,p)=>a+(b-a)*p;
const ease=(a,b,t)=>{const p=clamp((t-a)/(b-a));return p*p*(3-2*p);};
const rgba=(hex,a)=>{const n=parseInt(hex.slice(1),16);return `rgba(${n>>16},${n>>8&255},${n&255},${a})`;};

function rounded(ctx,x,y,w,h,r){
  const rr=Math.min(r,h/2,w/2);ctx.beginPath();ctx.roundRect(x,y,w,h,rr);
}

function findLast(array,value,key){
  let lo=0,hi=array.length;
  while(lo<hi){const m=(lo+hi)>>1;if(key(array[m])<=value)lo=m+1;else hi=m;}
  return lo-1;
}

export function createWorkspace(data){
  const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext('2d',{alpha:false});
  const notes=data.notes.map((note,index)=>({...note,index}));
  const total=data.total||93.7333333333;
  const byChannel=new Map(CHANNELS.map(ch=>[ch,notes.filter(n=>n.ch===ch).sort((a,b)=>a.t0-b.t0||b.p-a.p)]));
  const first=Object.fromEntries(CHANNELS.map(ch=>[ch,Math.min(...byChannel.get(ch).map(n=>n.t0))]));
  const beats=data.beats||[],bars=data.bars||[];
  const actors=[0,1,3,2].map((ch,id)=>{
    let list=byChannel.get(ch);
    if(ch===0)list=list.filter(n=>String(n.tag).startsWith('theme'));
    const targets=[];
    for(const n of list){
      const prev=targets.at(-1);
      if(!prev||n.t0-prev.t0>.18)targets.push(n);
      else if(Math.abs(n.t0-prev.t0)<.035&&n.p>prev.p)targets[targets.length-1]=n;
    }
    return {ch,id,targets,first:targets[0]?.t0??first[ch]};
  });

  function getOverviewAnchor(note){
    const i=CHANNELS.indexOf(note.ch),p=note.p??note.pitch;
    return {x:240+(note.t0-START)/SPAN*1460,y:238+i*70+(CENTERS[note.ch]-p)*1.3};
  }

  function layout(t,opts={}){
    const overview=clamp(opts.overview??ease(29,36.7,t));
    const scroll=ease(9,16,t);
    const localStart=mix(-7.3,t-9,scroll);
    const localSpan=24+9*ease(14,30,t);
    const windowStart=mix(localStart,START,overview);
    const windowSpan=mix(localSpan,SPAN,overview);
    const baseY=mix(520-180*ease(11,28,t),238,overview);
    const spacing=mix(128-22*ease(14,30,t),70,overview);
    const pitchScale=mix(2.0,1.3,overview);
    return {overview,windowStart,windowSpan,baseY,spacing,pitchScale,
      x:time=>240+(time-windowStart)/windowSpan*1460,
      y:note=>baseY+CHANNELS.indexOf(note.ch)*spacing+(CENTERS[note.ch]-(note.p??note.pitch))*pitchScale,
      laneY:ch=>baseY+CHANNELS.indexOf(ch)*spacing,
      width:duration=>duration/windowSpan*1460,
    };
  }

  function actorState(actor,t,L){
    const list=actor.targets;
    if(!list.length)return null;
    let next=Math.max(0,findLast(list,t+.45,n=>n.t0));
    const target=list[next],previous=list[Math.max(0,next-1)];
    const p=ease(target.t0-.45,target.t0-.09,t);
    let x=mix(L.x(previous.t0),L.x(target.t0),p)-44;
    let y=mix(L.y(previous),L.y(target),p)-54;
    let alpha=actor.id===0?ease(2.12,3.35,t):ease(actor.first-1.25,actor.first-.30,t);
    if(actor.id===0){
      const entrance=ease(2.12,3.80,t);
      x=mix(530,x,entrance);y=mix(715,y,entrance);
    }else{
      const split=ease(actor.first-1.15,actor.first-.15,t);
      const home=actorState(actors[0],Math.min(t,actor.first-.8),L);
      x=mix(home.x,x,split);y=mix(home.y,y,split);
    }
    if(t>79){
      const arrive=ease(82,87,t),restX=1760-actor.id*53,restY=830;
      x=mix(x,restX,arrive);y=mix(y,restY,arrive);
      if(actor.id>0)alpha*=1-ease(84.5,87.5,t);
    }
    alpha*=1-ease(total-.72,total-.07,t);
    const last=findLast(list,t,n=>n.t0),lastTarget=list[Math.max(0,last)];
    const dt=t-lastTarget.t0;
    const impulse=last>=0?Math.exp(-Math.pow(dt/.16,2)):0;
    const reach=ease(target.t0-.27,target.t0-.035,t)*(1-ease(target.t0+.05,target.t0+.26,t))*(1-ease(80.5,85.5,t));
    return {x,y,alpha,impulse,reach,ch:actor.ch,id:actor.id,
      target:{x:L.x(target.t0),y:L.y(target),time:target.t0},
      scale:actor.id===0?mix(1.34,1,ease(5,9,t)):0.84};
  }

  function drawAssistant(state,t){
    if(!state||state.alpha<.002)return;
    const {x,y,alpha,scale,ch,reach,impulse}=state,color=COLORS[ch];
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.globalAlpha=alpha;
    const targetX=(state.target.x-x)/scale,targetY=(state.target.y-y)/scale;
    // The paired folds and a dark, narrow visor form an original non-pixel silhouette.
    const aura=ctx.createRadialGradient(0,-5,5,0,-5,59);
    aura.addColorStop(0,rgba(color,.055));aura.addColorStop(1,rgba(color,0));
    ctx.fillStyle=aura;ctx.fillRect(-60,-65,120,120);
    ctx.strokeStyle=rgba(color,.65);ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(-12,2);ctx.quadraticCurveTo(-25,8,-26,19);ctx.stroke();
    const handX=mix(27,targetX,reach*.92),handY=mix(12,targetY,reach*.92);
    ctx.beginPath();ctx.moveTo(12,1);ctx.quadraticCurveTo(27,1,handX,handY);ctx.stroke();
    ctx.fillStyle=rgba(color,.9);ctx.beginPath();ctx.arc(handX,handY,2.1,0,Math.PI*2);ctx.fill();
    if(reach>.04){
      ctx.globalAlpha=alpha*reach*.8;ctx.strokeStyle=rgba(color,.72);ctx.lineWidth=.8;
      ctx.beginPath();ctx.moveTo(handX,handY);ctx.lineTo(targetX,targetY);ctx.stroke();
      ctx.beginPath();ctx.arc(targetX,targetY,2.5+impulse*2.1,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=alpha;
    }
    const body=ctx.createLinearGradient(-17,-9,20,31);
    body.addColorStop(0,'#e4dfd1');body.addColorStop(.49,'#b9b6af');body.addColorStop(1,'#5e656b');
    ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(-16,-4);ctx.lineTo(18,-4);ctx.lineTo(13,18);
    ctx.lineTo(3,31);ctx.lineTo(-1,14);ctx.lineTo(-9,26);ctx.lineTo(-18,13);ctx.closePath();ctx.fill();
    ctx.fillStyle='#d4d0c4';ctx.beginPath();ctx.moveTo(-16,-4);ctx.lineTo(-1,14);ctx.lineTo(3,31);ctx.lineTo(-9,26);ctx.lineTo(-18,13);ctx.closePath();ctx.fill();
    ctx.strokeStyle='rgba(242,235,217,.32)';ctx.lineWidth=.8;
    ctx.beginPath();ctx.moveTo(-16,-4);ctx.lineTo(-1,14);ctx.lineTo(18,-4);ctx.stroke();
    const shell=ctx.createLinearGradient(-18,-33,17,0);
    shell.addColorStop(0,'#e7e3d8');shell.addColorStop(.75,'#b9bab4');shell.addColorStop(1,'#7b8488');
    rounded(ctx,-19,-34,39,34,13);ctx.fillStyle=shell;ctx.fill();
    rounded(ctx,-15,-25,31,14,6);ctx.fillStyle='#151f28';ctx.fill();
    ctx.strokeStyle=rgba(color,.8);ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(-10,-25);ctx.lineTo(12,-25);ctx.stroke();
    // The eyes remain calm; purposeful gestures, rather than bouncing, carry the action.
    ctx.fillStyle='#e5ddc5';ctx.beginPath();ctx.ellipse(-5,-18,1.35,2.1,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(6,-18,1.35,2.1,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=rgba(color,.85);ctx.beginPath();ctx.arc(19,-8,1.6,0,Math.PI*2);ctx.fill();
    ctx.restore();
  }

  function drawLane(ch,t,L){
    const born=ease(first[ch]-1.35,first[ch]-.2,t);
    const returned=ease(81,86,t);
    const alpha=Math.max(born,returned);
    if(alpha<.001)return;
    const y=L.laneY(ch),color=COLORS[ch];
    if(y>945)return;
    ctx.save();ctx.globalAlpha=alpha;
    const rail=ctx.createLinearGradient(222,y,1732,y);
    rail.addColorStop(0,rgba(color,.02));rail.addColorStop(.08,rgba(color,.14));
    rail.addColorStop(.88,rgba(color,.11));rail.addColorStop(1,rgba(color,0));
    ctx.strokeStyle=rail;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(223,y);ctx.lineTo(1740,y);ctx.stroke();
    ctx.fillStyle=rgba(color,.63);ctx.font='23px FilmSans, sans-serif';ctx.textAlign='right';
    ctx.fillText(LABELS[ch],205,y+7);
    ctx.restore();
  }

  function drawNotes(t,L,release){
    ctx.save();ctx.beginPath();ctx.rect(225,170,1525,758);ctx.clip();
    for(const note of notes){
      if(note.t0>t+.000001)continue;
      const x=L.x(note.t0),y=L.y(note);
      const width=Math.max(note.ch===9?4.2:2.2,L.width(note.t1-note.t0));
      if(x+width<229||x>1747||y<176||y>922)continue;
      const active=t>=note.t0&&t<note.t1;
      const attack=Math.exp(-Math.max(0,t-note.t0)*7.5);
      const velocity=(note.v??note.velocity??65)/127;
      const archived=.23+velocity*.22;
      const releaseAlpha=1-release*(.55+.45*ease(note.t1,note.t1+1,t));
      const alpha=(active?.60+velocity*.36:archived)*releaseAlpha;
      const height=note.ch>=7?4.4:3.1+velocity*1.3;
      ctx.fillStyle=rgba(COLORS[note.ch],alpha);
      ctx.shadowColor=COLORS[note.ch];ctx.shadowBlur=active?8+attack*8:0;
      rounded(ctx,x,y-height/2,width,height,height/2);ctx.fill();
      ctx.shadowBlur=0;
      if(active){
        const head=x+Math.min(width,L.width(Math.max(0,t-note.t0)));
        ctx.fillStyle=rgba('#fff3d7',.7+attack*.2);
        ctx.beginPath();ctx.arc(head,y,1.6+attack*1.6,0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPhrase(t,L){
    const phase=1-ease(33,39,t);
    if(phase<.002)return;
    const phrase=byChannel.get(0).filter(n=>n.tag==='theme-opening'&&n.t0<=t);
    if(phrase.length<2)return;
    ctx.save();ctx.strokeStyle=rgba(COLORS[0],phase*.15);ctx.lineWidth=1;
    ctx.beginPath();let started=false;
    for(const n of phrase){
      const x=L.x(n.t0),y=L.y(n)-10;
      if(x<235||x>1730)continue;
      if(!started){ctx.moveTo(x,y);started=true;}else ctx.lineTo(x,y);
    }
    ctx.stroke();ctx.restore();
  }

  function getState(t,opts={}){
    const L=layout(t,opts);
    return {layout:L,playhead:{x:L.x(t),y0:L.baseY-65,y1:Math.min(900,L.baseY+8*L.spacing+40)},
      assistants:actors.map(actor=>actorState(actor,t,L)),
      activeNotes:notes.filter(n=>n.t0<=t&&t<n.t1),
      firstNoteTime:Math.min(...notes.map(n=>n.t0)),
      overview:L.overview};
  }

  function render(t,opts={}){
    const L=layout(t,opts),timeline=ease(2.72,3.75,t),release=clamp(opts.release??0);
    const blackToDesk=ease(2.55,4.25,t);
    ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.fillStyle='#000000';ctx.fillRect(0,0,W,H);
    if(blackToDesk>0){
      ctx.fillStyle=`rgba(6,9,15,${blackToDesk})`;ctx.fillRect(0,0,W,H);
      const atmosphere=ctx.createRadialGradient(920,510,50,920,510,850);
      atmosphere.addColorStop(0,`rgba(46,42,35,${.13*blackToDesk})`);
      atmosphere.addColorStop(1,'rgba(6,9,15,0)');ctx.fillStyle=atmosphere;ctx.fillRect(0,0,W,H);
    }
    const question=ease(.12,.85,t)*(1-ease(2.48,3.2,t));
    if(question>.001){
      ctx.globalAlpha=question;ctx.fillStyle='#e8e2d8';ctx.textAlign='center';ctx.font='42px FilmSans, sans-serif';
      ctx.fillText('一首曲子，是怎样诞生的？',960,493);
      ctx.fillStyle='rgba(210,193,166,.30)';ctx.fillRect(947,536,26,1);ctx.globalAlpha=1;
    }
    if(timeline>0){
      ctx.save();ctx.globalAlpha=timeline;
      // Deliberately sparse bar marks; all positions come from the same transformed seconds.
      const gridAlpha=.05+L.overview*.03;
      for(const b of bars){
        const x=L.x(b);if(x<235||x>1735)continue;
        ctx.strokeStyle=`rgba(194,199,206,${gridAlpha})`;ctx.lineWidth=.7;
        ctx.beginPath();ctx.moveTo(x,L.baseY-45);ctx.lineTo(x,Math.min(887,L.baseY+8*L.spacing+29));ctx.stroke();
      }
      for(const ch of CHANNELS)drawLane(ch,t,L);
      drawPhrase(t,L);drawNotes(t,L,release);
      const maxActive=CHANNELS.filter(ch=>t>first[ch]-.8).reduce((m,ch)=>Math.max(m,CHANNELS.indexOf(ch)),0);
      const playheadX=L.x(t),playheadAlpha=(1-ease(84,88,t))*.32;
      if(playheadX>=235&&playheadX<=1735&&t>3.4){
        ctx.strokeStyle=`rgba(240,220,184,${playheadAlpha})`;ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(playheadX,L.baseY-55);ctx.lineTo(playheadX,Math.min(885,L.baseY+maxActive*L.spacing+42));ctx.stroke();
        ctx.fillStyle=`rgba(240,220,184,${playheadAlpha+.12})`;
        ctx.beginPath();ctx.arc(playheadX,L.baseY-61,2.1,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    }
    for(const actor of actors)drawAssistant(actorState(actor,t,L),t);
    const endTitle=ease(89.0,90.3,t)*(1-ease(total-.85,total-.08,t));
    if(endTitle>.001){
      ctx.globalAlpha=endTitle;ctx.textAlign='left';ctx.fillStyle='#dfd4bf';ctx.font='38px FilmSans, sans-serif';
      ctx.fillText('一音成境',240,133);ctx.fillStyle='rgba(195,197,201,.52)';ctx.font='20px FilmSans, sans-serif';
      ctx.fillText('微光归途',242,173);ctx.globalAlpha=1;
    }
    const fade=ease(total-.72,total-.06,t);
    if(fade>0){ctx.fillStyle=`rgba(0,0,0,${fade})`;ctx.fillRect(0,0,W,H);}
    return canvas;
  }
  return {canvas,render,getOverviewAnchor,getState};
}
