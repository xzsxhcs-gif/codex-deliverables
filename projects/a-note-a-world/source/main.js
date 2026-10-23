import * as THREE from './vendor/three.module.js';
import {createWorkspace} from './workspace.js';
import {createLandscape} from './landscape.js';

const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*x*(x*(x*6-15)+10);};
const hash=x=>{const v=Math.sin(x*127.1+311.7)*43758.5453;return v-Math.floor(v);};
const FILM_START=3.7;
const CAMERA_Z=67.5/(2*Math.tan(THREE.MathUtils.degToRad(43/2)));
const PALETTE={0:'#e8c799',1:'#b8c6c2',2:'#cec3dc',3:'#afbed0',4:'#b7d8ce',5:'#d6b783',6:'#c4d3df',7:'#c0b2a7',9:'#c8ccd2'};

// Shape-preserving cubic interpolation keeps one continuous position and gaze.
const cameraKeys=[
  [0,0,0,CAMERA_Z,0,0,0,43],
  [35.8,0,0,CAMERA_Z,0,0,0,43],
  [42,2,2.8,82,0,0,-8,44],
  [48,8,10,72,0,1.8,-18,46],
  [57.33333,9,15,59,0,4,-22,49],
  [64,6,12,43,0,5,-48,49],
  [70,-3,11,24,0,8,-70,50],
  [75,-7,12,10,0,12,-78,49],
  [78.66667,-6,16,7,0,14,-75,48],
  [82,-3,25,16,0,11,-45,46],
  [84,0,28,38,0,8,-20,45],
  [87,0,12,70,0,1,-4,43.5],
  [90,0,0,CAMERA_Z,0,0,0,43],
  [94,0,0,CAMERA_Z,0,0,0,43],
];
function pchip(keys,t,col){
  const d=keys.slice(1).map((row,i)=>(row[col]-keys[i][col])/(row[0]-keys[i][0]));
  const slope=keys.map((row,i)=>{
    if(i===0)return d[0];if(i===keys.length-1)return d.at(-1);
    if(d[i-1]*d[i]<=0)return 0;
    const h0=row[0]-keys[i-1][0],h1=keys[i+1][0]-row[0];
    const w0=2*h1+h0,w1=h1+2*h0;
    return (w0+w1)/(w0/d[i-1]+w1/d[i]);
  });
  let i=0;while(i<keys.length-2&&t>keys[i+1][0])i++;
  const h=keys[i+1][0]-keys[i][0],u=clamp((t-keys[i][0])/h),u2=u*u,u3=u2*u;
  return (2*u3-3*u2+1)*keys[i][col]+(u3-2*u2+u)*h*slope[i]
    +(-2*u3+3*u2)*keys[i+1][col]+(u3-u2)*h*slope[i+1];
}

window.readyPromise=(async()=>{
  const [data,features]=await Promise.all([
    fetch('../notes.json').then(r=>{if(!r.ok)throw new Error('Missing notes.json: run prepare_music.py');return r.json();}),
    fetch('../music_features.json').then(r=>r.json()),
    document.fonts.load('42px FilmSans'),
  ]);
  await document.fonts.ready;
  const canvasWidth=window.innerWidth,canvasHeight=window.innerHeight;
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(1);renderer.setSize(canvasWidth,canvasHeight);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.debug.onShaderError=(gl,program,vertex,fragment)=>{throw new Error('Shader compilation failed: '+gl.getProgramInfoLog(program)+' '+gl.getShaderInfoLog(vertex)+' '+gl.getShaderInfoLog(fragment));};
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
  renderer.setClearColor('#000000');
  document.body.insertBefore(renderer.domElement,document.body.firstChild);
  const finish=document.createElement('canvas');finish.width=canvasWidth;finish.height=canvasHeight;
  Object.assign(finish.style,{position:'fixed',left:'0',top:'0',pointerEvents:'none'});document.body.appendChild(finish);
  const fx=finish.getContext('2d');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#070d17');
  scene.fog=new THREE.FogExp2('#0a111d',.0068);
  scene.add(new THREE.HemisphereLight('#b7cadb','#181716',1.30));
  const sun=new THREE.DirectionalLight('#ffe2b8',1.65);sun.position.set(-32,65,-64);scene.add(sun);
  const rim=new THREE.DirectionalLight('#91a5c3',.45);rim.position.set(55,18,20);scene.add(rim);
  const camera=new THREE.PerspectiveCamera(43,canvasWidth/canvasHeight,.5,700);camera.up.set(0,1,0);
  const look=new THREE.Vector3();
  const workspace=createWorkspace(data),world=createLandscape(data);
  scene.add(world.group);
  const deskTexture=new THREE.CanvasTexture(workspace.canvas);deskTexture.colorSpace=THREE.SRGBColorSpace;
  deskTexture.minFilter=THREE.LinearFilter;deskTexture.magFilter=THREE.LinearFilter;deskTexture.generateMipmaps=false;
  const deskMaterial=new THREE.MeshBasicMaterial({map:deskTexture,transparent:true,depthWrite:false,depthTest:false,toneMapped:false,side:THREE.DoubleSide});
  const desk=new THREE.Mesh(new THREE.PlaneGeometry(120,67.5),deskMaterial);desk.renderOrder=20;scene.add(desk);

  const geometry=new THREE.BufferGeometry(),positions=[],destinations=[],starts=[],ends=[],velocities=[],colors=[];
  const firstTheme=data.notes.findIndex(n=>n.tag==='theme-opening');
  data.notes.forEach((n,i)=>{
    const anchor=workspace.getOverviewAnchor(n);
    positions.push((anchor.x/1920-.5)*120,(.5-anchor.y/1080)*67.5,.12);
    let x=(n.p-66)*1.9+Math.sin(n.ch+i*.17)*8;
    let y=12+(n.p-38)*.53+hash(i+17)*14;
    let z=55-(n.t0-FILM_START)*2.45;
    y=Math.max(y,(world.getHeight?.(x,z)??0)+2.5);
    if(i===firstTheme){x=0;y=13;z=-75;}
    destinations.push(x,y,z);starts.push(n.t0);ends.push(n.t1);velocities.push(n.v/127);
    const c=new THREE.Color(PALETTE[n.ch]);colors.push(c.r,c.g,c.b);
  });
  for(const [name,values,size] of [['position',positions,3],['aWorld',destinations,3],['aColor',colors,3],['aStart',starts,1],['aEnd',ends,1],['aVelocity',velocities,1]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,size));
  const pointUniforms={uTime:{value:0},uMorph:{value:0},uAlpha:{value:0},uScreen:{value:canvasHeight/1080}};
  const noteMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:pointUniforms,
    vertexShader:`
      attribute vec3 aWorld,aColor;attribute float aStart,aEnd,aVelocity;
      uniform float uTime,uMorph,uAlpha,uScreen;varying vec3 vColor;varying float vAlpha;
      void main(){
        float played=step(aStart,uTime);float sounding=step(aStart,uTime)*(1.-step(aEnd,uTime));
        float attack=exp(-max(0.,uTime-aStart)*5.);
        vec3 p=mix(position,aWorld,uMorph);
        p.y+=sin((uTime-aStart)*.6+aStart)*.12*uMorph;
        vec4 mv=modelViewMatrix*vec4(p,1.);
        float nearFade=smoothstep(5.,20.,-mv.z);
        vAlpha=played*uAlpha*nearFade*(.22+sounding*.6+attack*.35);
        vColor=mix(aColor,vec3(1.,.88,.66),attack*.25);
        gl_PointSize=clamp((2.3+aVelocity*3.0)*uScreen*90./max(30.,-mv.z),1.,8.*uScreen);
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`varying vec3 vColor;varying float vAlpha;
      void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;
        float core=exp(-d*d*16.);float soft=pow(max(0.,1.-d),2.5);
        gl_FragColor=vec4(vColor*(.75+core*.7),(core*.8+soft*.3)*vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const noteStars=new THREE.Points(geometry,noteMaterial);noteStars.frustumCulled=false;noteStars.renderOrder=24;scene.add(noteStars);

  const ribbons=[];
  const channelList=[0,1,2,3,4,5,6,7,9];
  channelList.forEach((ch,lane)=>{
    const flat=[],dest=[];
    for(let j=0;j<=160;j++){
      const u=j/160,x=240+1460*u,y=238+lane*70;
      flat.push((x/1920-.5)*120,(.5-y/1080)*67.5,.06);
      const z=55-u*220,path=world.getPath?.(u)??{x:Math.sin(u*8)*6};
      let wx=path.x+(lane-4)*.8,wy=.7+lane*.12;
      if(ch===0||ch===2){wx+=(ch===0?-1:1)*(22+8*Math.sin(u*Math.PI));wy=(world.getHeight?.(wx,z)??8)+.35;}
      dest.push(wx,wy,z);
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(flat,3));g.setAttribute('aWorld',new THREE.Float32BufferAttribute(dest,3));
    const u={uMorph:{value:0},uAlpha:{value:0},uColor:{value:new THREE.Color(PALETTE[ch])}};
    const m=new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,
      vertexShader:`attribute vec3 aWorld;uniform float uMorph;varying float vDepth;void main(){vec4 p=modelViewMatrix*vec4(mix(position,aWorld,uMorph),1.);vDepth=-p.z;gl_Position=projectionMatrix*p;}`,
      fragmentShader:`uniform vec3 uColor;uniform float uAlpha;varying float vDepth;void main(){float fog=exp(-vDepth*.004);gl_FragColor=vec4(uColor,uAlpha*fog);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
    const line=new THREE.Line(g,m);line.frustumCulled=false;line.renderOrder=22;scene.add(line);ribbons.push({line,uniforms:u});
  });

  const noise=document.createElement('canvas');noise.width=noise.height=128;
  const nx=noise.getContext('2d'),image=nx.createImageData(128,128);
  for(let i=0;i<128*128;i++){const v=Math.floor(hash(i+666)*255);image.data.set([v,v,v,255],i*4);}nx.putImageData(image,0,0);
  const grain=fx.createPattern(noise,'repeat');
  const vignette=fx.createRadialGradient(canvasWidth*.5,canvasHeight*.46,canvasHeight*.25,canvasWidth*.5,canvasHeight*.5,canvasWidth*.68);
  vignette.addColorStop(0,'rgba(0,0,0,0)');vignette.addColorStop(1,'rgba(0,0,0,.23)');
  function energyAt(t){
    const center=(t-.05)/features.step;let energy=0,weight=0;
    for(let d=-7;d<=7;d++){
      const i=clamp(Math.round(center)+d,0,features.normalized.length-1),w=8-Math.abs(d);
      energy+=features.normalized[i]*w;weight+=w;
    }
    return energy/weight;
  }
  function frameState(t){
    const out=smooth(36.7,57.33333,t),back=smooth(78.66667,89.9,t);
    const morph=out*(1-back),visibility=smooth(38,50,t)*(1-smooth(84,90,t));
    const boardAlpha=1-smooth(40,53,t)+smooth(85.4,90,t);
    return {growth:morph,visibility,energy:energyAt(t),returnAmount:back,morph,boardAlpha:clamp(boardAlpha)};
  }
  window.cameraAt=t=>({position:[1,2,3].map(c=>pchip(cameraKeys,t,c)),target:[4,5,6].map(c=>pchip(cameraKeys,t,c)),fov:pchip(cameraKeys,t,7)});
  window.renderAt=t=>{
    t=clamp(Number(t)||0,0,data.total);const state=frameState(t);
    const flatOnly=t<=35.8||t>=90;
    deskMaterial.opacity=state.boardAlpha;desk.visible=state.boardAlpha>.001;
    if(desk.visible){workspace.render(t,{overview:smooth(29,36.7,t),release:state.morph});if(!flatOnly)deskTexture.needsUpdate=true;}
    const lens=window.cameraAt(t);
    camera.position.fromArray(lens.position);look.fromArray(lens.target);camera.lookAt(look);
    camera.fov=lens.fov;camera.updateProjectionMatrix();
    world.update(t,state);
    const noteAlpha=smooth(36.7,42,t)*(1-smooth(86,90,t));
    pointUniforms.uTime.value=t;pointUniforms.uMorph.value=state.morph;pointUniforms.uAlpha.value=noteAlpha;
    ribbons.forEach(({line,uniforms},i)=>{
      uniforms.uMorph.value=state.morph;uniforms.uAlpha.value=noteAlpha*lerp(.18,.07,state.morph)*(i===0||i===2?1.5:1);
      line.visible=noteAlpha>.001;
    });
    scene.background.set(state.visibility>.001?'#070d17':'#000000');
    renderer.domElement.style.visibility=flatOnly?'hidden':'visible';
    if(!flatOnly)renderer.render(scene,camera);
    fx.clearRect(0,0,canvasWidth,canvasHeight);
    if(flatOnly)fx.drawImage(workspace.canvas,0,0,canvasWidth,canvasHeight);
    if(t>2.55&&t<data.total-.8){
      fx.fillStyle=vignette;fx.fillRect(0,0,canvasWidth,canvasHeight);
      fx.save();fx.globalAlpha=.010;fx.translate((Math.floor(t*30)*17)%128,(Math.floor(t*30)*29)%128);
      fx.fillStyle=grain;fx.fillRect(-128,-128,canvasWidth+128,canvasHeight+128);fx.restore();
    }
    const fade=smooth(data.total-.8,data.total-.04,t);
    if(fade>0){fx.fillStyle=`rgba(0,0,0,${fade})`;fx.fillRect(0,0,canvasWidth,canvasHeight);}
    const active=data.notes.filter(n=>n.t0<=t&&t<n.t1).map(n=>({ch:n.ch,p:n.p,t0:n.t0,t1:n.t1}));
    const diagnostics={t,activeNotes:active,camera:{position:camera.position.toArray(),target:look.toArray(),fov:camera.fov},state,drawCalls:flatOnly?0:renderer.info.render.calls,triangles:flatOnly?0:renderer.info.render.triangles};
    window.lastFrame=diagnostics;return diagnostics;
  };
  window.sceneInfo={title:'一音成境',duration:data.total,frameCount:data.frame_count,fps:30,notes:data.notes.length,renderer:renderer.getContext().getParameter(renderer.getContext().RENDERER)};
  window.renderAt(0);

  const params=new URLSearchParams(location.search),ui=document.getElementById('preview');
  if(params.has('render')){ui.remove();return window.sceneInfo;}
  ui.hidden=false;const audio=new Audio('../final_music.wav');audio.preload='auto';
  const seek=document.getElementById('seek'),button=document.getElementById('play'),time=document.getElementById('time');seek.max=data.total;
  let at=clamp(Number(params.get('t'))||0,0,data.total),playing=false,last=0;
  function animate(now){if(playing){at=clamp(audio.currentTime||at+(now-last)/1000,0,data.total);if(at>=data.total)playing=false;}last=now;
    window.renderAt(at);seek.value=at;time.textContent=`${Math.floor(at/60)}:${String(Math.floor(at%60)).padStart(2,'0')}`;requestAnimationFrame(animate);}
  button.onclick=async()=>{playing=!playing;if(playing){audio.currentTime=at;await audio.play();button.textContent='暂停';}else{audio.pause();button.textContent='播放';}};
  seek.oninput=()=>{at=Number(seek.value);audio.currentTime=at;window.renderAt(at);};
  requestAnimationFrame(animate);return window.sceneInfo;
})();
