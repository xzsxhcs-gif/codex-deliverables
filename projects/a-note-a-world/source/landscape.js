import * as THREE from './vendor/three.module.js';

// The landscape is a spatial reading of the score: melodic height, harmonic
// meanders, and the opening intervals remain visible as the world unfolds.
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{x=clamp((x-a)/(b-a));return x*x*(3-2*x);};
const mix=(a,b,t)=>a+(b-a)*t;
const hash=(x,y=0)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453123;return n-Math.floor(n);};
function noise(x,y){
  const a=Math.floor(x),b=Math.floor(y),u=smooth(0,1,x-a),v=smooth(0,1,y-b);
  return mix(mix(hash(a,b),hash(a+1,b),u),mix(hash(a,b+1),hash(a+1,b+1),u),v);
}
function sample(values,u){
  const p=clamp(u)*(values.length-1),i=Math.floor(p),f=p-i;
  const a=values[Math.max(0,i-1)],b=values[i],c=values[Math.min(values.length-1,i+1)],d=values[Math.min(values.length-1,i+2)];
  return .5*((2*b)+(-a+c)*f+(2*a-5*b+4*c-d)*f*f+(-a+3*b-3*c+d)*f*f*f);
}
function cloudTexture(){
  const c=document.createElement('canvas');c.width=256;c.height=128;
  const ctx=c.getContext('2d'),im=ctx.createImageData(c.width,c.height);
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const u=x/c.width,v=y/c.height;
    let density=0;
    for(const [cx,cy,rx,ry,w] of [[.25,.57,.22,.22,.7],[.47,.48,.25,.34,1],[.68,.55,.23,.25,.85],[.82,.64,.14,.17,.55]]){
      density+=Math.exp(-(((u-cx)/rx)**2+((v-cy)/ry)**2)*2)*w;
    }
    const n=.55*noise(u*7,v*7)+.3*noise(u*17+6,v*17)+.15*noise(u*41,v*41+3);
    const alpha=clamp((density-.17)*.75)*(.47+.53*n);
    const k=(y*c.width+x)*4;im.data[k]=im.data[k+1]=im.data[k+2]=255;im.data[k+3]=Math.round(alpha*255);
  }
  ctx.putImageData(im,0,0);
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.NoColorSpace;
  texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
  return texture;
}
function tubeMesh(segments,color){
  const p=[];const sides=7;
  for(const [a0,b0,r0,r1] of segments){
    const a=new THREE.Vector3(...a0),b=new THREE.Vector3(...b0),axis=b.clone().sub(a).normalize();
    const cross=Math.abs(axis.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
    const u=new THREE.Vector3().crossVectors(axis,cross).normalize(),v=new THREE.Vector3().crossVectors(axis,u).normalize();
    const ring=(at,r,k)=>at.clone().addScaledVector(u,Math.cos(k/sides*Math.PI*2)*r).addScaledVector(v,Math.sin(k/sides*Math.PI*2)*r);
    for(let k=0;k<sides;k++){
      const q=[ring(a,r0,k),ring(b,r1,k),ring(b,r1,k+1),ring(a,r0,k+1)];
      for(const j of [0,2,1,0,3,2])p.push(...q[j].toArray());
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.computeVertexNormals();
  return new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color,transparent:true,opacity:1,fog:true,toneMapped:true}));
}

export function createLandscape(data){
  const group=new THREE.Group();group.name='score-born-landscape';
  const notes=data.notes||[];
  const theme=notes.filter(n=>String(n.tag).startsWith('theme-opening'));
  const melodic=theme.length?theme.map(n=>n.p):[66,69,74,73,71,69,71,74,78,66,69,74];
  const bass=notes.filter(n=>n.ch===1),start=data.originalMusicStart??3.7;
  const musicalLength=90.02975;
  const harmony=notes.filter(n=>n.ch===3);
  const harmonicSpread=harmony.length?Math.max(...harmony.map(n=>n.p))-Math.min(...harmony.map(n=>n.p)):19;
  const lakeExpansion=17+harmonicSpread*.22;
  const roots=Array.from({length:33},(_,i)=>{
    const time=start+i/32*musicalLength;
    let before=bass[0];for(const n of bass){if(n.t0>time)break;before=n;}
    return before?(before.p-48)/12:0;
  });
  const smoothed=roots.map((v,i)=>(roots[Math.max(0,i-1)]+2*v+roots[Math.min(32,i+1)])/4);
  function riverX(z){const u=(40-z)/220;return 3.1*Math.sin(u*Math.PI*3.1)+sample(smoothed,u)*2.6;}
  function getPath(u){const z=40-u*220;return new THREE.Vector3(riverX(z),.44,z);}
  function getHeight(x,z){
    const path=riverX(z),d=Math.abs(x-path);
    const lake=Math.exp(-(((z+68)/42)**2));
    const shore=8+lake*lakeExpansion;
    const rise=smooth(shore,shore+20,d);
    const side=x<path?-1:1;
    let peaks=0;
    for(let i=0;i<3;i++){
      const pitch=melodic[i]??[66,69,74][i],amp=12+(pitch-60)*1.5;
      const cx=side*(39+i*8+Math.sin(z*.019+i)*5),cz=7-i*76+(side<0?-11:17);
      peaks+=amp*Math.exp(-(((x-cx)/(23+i*3))**2)-(((z-cz)/(46+i*6))**2));
    }
    const contour=(sample(melodic,(40-z)/230)-66)/13;
    const detail=(noise(x*.072,z*.055)-.5)*2.9+(noise(x*.19+9,z*.14)-.5)*.9;
    // Broad, anisotropic ridge folds erode the smooth melodic mass. The pitch
    // contour warps their course; the river floor and its shoreline stay intact.
    const ridge=1-Math.abs(2*noise(x*.112+z*.037+contour*.52,z*.073+x*.015)-1);
    const smallRidge=1-Math.abs(2*noise(x*.185-z*.024+7,z*.116+contour*.28)-1);
    const foldGate=smooth(.22,.92,rise)*smooth(5,18,peaks);
    const folds=clamp((ridge-.62)*4.6+(smallRidge-.57)*1.3,-3.4,3.4)*foldGate;
    let h=.13+rise*(3.6+peaks+contour*2.8+detail)+folds;
    h-=lake*(1-rise)*.38;
    const island=1.35*Math.exp(-(x*x/30+(z+75)**2/41));
    return h+island;
  }

  // One continuous mesh means no horizon seams or intersecting mountain cards.
  const nx=128,nz=144,positions=[],colors=[],indices=[];
  const low=new THREE.Color('#1a2a33'),mid=new THREE.Color('#3d4a5a'),high=new THREE.Color('#7b7e88');
  const exposedStone=new THREE.Color('#817c73');
  const c=new THREE.Color();
  for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
    const x=-110+i/nx*220,z=65-j/nz*300,h=getHeight(x,z);
    positions.push(x,h,z);
    c.copy(low).lerp(mid,smooth(1,23,h));c.lerp(high,smooth(20,43,h)*.62);
    const dx=getHeight(x+1.6,z)-getHeight(x-1.6,z),dz=getHeight(x,z+1.6)-getHeight(x,z-1.6);
    const slope=Math.sqrt(dx*dx+dz*dz)/3.2;
    c.lerp(exposedStone,smooth(.8,2.1,slope)*smooth(7,24,h)*.17);
    const strata=smooth(-.85,.85,Math.sin(h*.33+noise(x*.054,z*.046)*2.4));
    c.multiplyScalar(.84+.1*strata+.06*noise(x*.15,z*.15));colors.push(c.r,c.g,c.b);
  }
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i,b=a+nx+1;
    indices.push(a,a+1,b,b,a+1,b+1);
  }
  const terrainGeo=new THREE.BufferGeometry();terrainGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));terrainGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));terrainGeo.setIndex(indices);terrainGeo.computeVertexNormals();
  const terrainMat=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,metalness:0,emissive:'#101825',emissiveIntensity:.23,transparent:true,opacity:0,fog:true});
  const terrain=new THREE.Mesh(terrainGeo,terrainMat);terrain.name='melody-mountain-volumes';terrain.renderOrder=0;group.add(terrain);

  const contourPoints=[];
  for(const side of [-1,1])for(let family=0;family<6;family++){
    let previous=null;
    for(let k=0;k<=144;k++){
      const z=55-k/144*278,x=side*(23+family*10)+Math.sin(z*.026+family*.3)*2;
      const point=[x,getHeight(x,z)+.055,z];
      if(previous)contourPoints.push(...previous,...point);previous=point;
    }
  }
  const contourGeo=new THREE.BufferGeometry();contourGeo.setAttribute('position',new THREE.Float32BufferAttribute(contourPoints,3));
  const contourMat=new THREE.LineBasicMaterial({color:'#cebda6',transparent:true,opacity:0,depthWrite:false,fog:true});
  const contours=new THREE.LineSegments(contourGeo,contourMat);contours.name='melody-contour-families';contours.renderOrder=2;group.add(contours);

  const waterUniforms={uTime:{value:0},uVisibility:{value:0},uEnergy:{value:0}};
  const waterMat=new THREE.ShaderMaterial({uniforms:waterUniforms,transparent:true,depthWrite:true,side:THREE.DoubleSide,
    vertexShader:`varying vec3 vWorld;
      void main(){vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`precision highp float;varying vec3 vWorld;uniform float uTime,uVisibility,uEnergy;
      void main(){
        vec2 p=vWorld.xz;
        float a=.18*p.x+.24*p.y-uTime*.22,b=-.14*p.x+.17*p.y+uTime*.16;
        vec2 grad=vec2(.18,.24)*cos(a)*.031+vec2(-.14,.17)*cos(b)*.023;
        vec3 N=normalize(vec3(-grad.x,1.,-grad.y));
        vec3 V=normalize(cameraPosition-vWorld),L=normalize(vec3(-.2,.65,-.7));
        float fres=.04+.26*pow(1.-max(0.,dot(N,V)),3.);
        vec3 col=mix(vec3(.012,.025,.035),vec3(.060,.091,.125),fres);
        float spec=pow(max(0.,dot(reflect(-L,N),V)),80.);
        col+=vec3(.24,.23,.20)*spec*.11;
        float s=cameraPosition.y/(cameraPosition.y+13.);
        vec2 reflected=mix(cameraPosition.xz,vec2(0.,-75.),s);
        float along=clamp((p.y+75.)/max(3.,reflected.y+75.),0.,1.);
        float cx=mix(0.,reflected.x,along);
        float width=.45+along*.75;
        float glimmer=exp(-pow((p.x-cx)/width,2.));
        glimmer*=smoothstep(-81.,-73.,p.y)*(1.-smoothstep(reflected.y+3.,reflected.y+22.,p.y));
        float wave=.5+.2*sin(p.y*.68+p.x*.37-uTime*.36)
          +.15*sin(p.y*1.17-p.x*.29+uTime*.2)+.12*sin(p.y*.17+p.x*.73+uTime*.11);
        wave=pow(clamp(wave,0.,1.),3.);
        col+=vec3(.42,.28,.13)*glimmer*(.18+.28*wave)*(.8+.2*uEnergy);
        float surface=.5+.5*sin(p.x*.42+p.y*.26+sin(p.y*.31)*.32-uTime*.08);
        col+=vec3(.005,.008,.009)*surface*fres;
        float distanceToCamera=length(cameraPosition-vWorld);
        float fog=1.-exp(-distanceToCamera*distanceToCamera*.000065);
        col=mix(col,vec3(.026,.039,.058),fog*.88);
        gl_FragColor=vec4(col,uVisibility);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const waterGeo=new THREE.PlaneGeometry(220,300,40,70);waterGeo.rotateX(-Math.PI/2);
  const water=new THREE.Mesh(waterGeo,waterMat);water.position.set(0,.39,-85);water.name='harmony-river-and-lake';water.renderOrder=1;group.add(water);

  // A warm branching seed is grown from the actual theme intervals, not a logo.
  const treeSegments=[],twigSegments=[],tips=[];
  const baseY=getHeight(0,-75)+.04;
  const trunk=[[0,baseY,-75],[.13,baseY+4.2,-75.1],[-.18,baseY+8.7,-75.05],[.1,baseY+12.7,-75.25]];
  for(let i=0;i<trunk.length-1;i++)treeSegments.push([trunk[i],trunk[i+1],.14-i*.032,.11-i*.029]);
  for(let i=0;i<10;i++){
    const pitch=melodic[i%melodic.length],side=i%2?-1:1,y=baseY+3.3+i*.78;
    const length=2.1+(pitch-60)*.14;
    const a=[Math.sin(i*.7)*.12,y,-75.08],b=[side*length,y+1.05+((pitch-60)%4)*.16,-75.15+Math.sin(i*1.9)*.85];
    treeSegments.push([a,b,.067,.031]);
    for(const f of [-1,1]){
      const end=[b[0]+side*(.7+(pitch%3)*.13),b[1]+.55+f*.3,b[2]+f*.65];
      twigSegments.push([b,end,.027,.009]);tips.push(end);
    }
  }
  const tree=tubeMesh(treeSegments,'#e7c48d'),twigs=tubeMesh(twigSegments,'#dbc4a2');
  tree.name='opening-motif-seed-tree';twigs.name='interval-branches';group.add(tree,twigs);
  const leafGeo=new THREE.SphereGeometry(1,8,5),leafMat=new THREE.MeshBasicMaterial({color:'#f1d7ad',transparent:true,opacity:0,fog:true});
  const leaves=new THREE.InstancedMesh(leafGeo,leafMat,tips.length),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
  tips.forEach((tip,i)=>{
    q.setFromEuler(new THREE.Euler(.2,i*.7,(i%2?1:-1)*.65));scale.set(.085,.21,.035);matrix.compose(new THREE.Vector3(...tip),q,scale);leaves.setMatrixAt(i,matrix);
  });leaves.instanceMatrix.needsUpdate=true;leaves.name='sustained-note-leaves';group.add(leaves);

  const cloudBase=new THREE.PlaneGeometry(1,1),cloudGeo=new THREE.InstancedBufferGeometry();
  cloudGeo.index=cloudBase.index;cloudGeo.attributes.position=cloudBase.attributes.position;cloudGeo.attributes.uv=cloudBase.attributes.uv;
  const centers=[],sizes=[],phases=[];
  for(let i=0;i<12;i++){
    centers.push((hash(i+4)-.5)*175,23+hash(i+50)*20,-217+i*15);
    sizes.push(55+hash(i+3)*47,12+hash(i+25)*10);phases.push(i*.83);
  }
  cloudGeo.setAttribute('aCenter',new THREE.InstancedBufferAttribute(new Float32Array(centers),3));cloudGeo.setAttribute('aSize',new THREE.InstancedBufferAttribute(new Float32Array(sizes),2));cloudGeo.setAttribute('aPhase',new THREE.InstancedBufferAttribute(new Float32Array(phases),1));cloudGeo.instanceCount=12;
  const cloudUniforms={uMap:{value:cloudTexture()},uTime:{value:0},uVisibility:{value:0}};
  const cloudMat=new THREE.ShaderMaterial({uniforms:cloudUniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`attribute vec3 aCenter;attribute vec2 aSize;attribute float aPhase;uniform float uTime;varying vec2 vUv;varying float vDistance;varying float vPhase;
      void main(){vec3 center=aCenter;center.x+=sin(uTime*.018+aPhase)*.45;vec4 mv=modelViewMatrix*vec4(center,1.);vDistance=-mv.z;mv.xy+=position.xy*aSize;gl_Position=projectionMatrix*mv;vUv=uv;vPhase=aPhase;}`,
    fragmentShader:`precision highp float;uniform sampler2D uMap;uniform float uVisibility;varying vec2 vUv;varying float vDistance,vPhase;
      void main(){float a=texture2D(uMap,vUv).a;float fog=1.-exp(-vDistance*vDistance*.00003);vec3 color=mix(vec3(.135,.151,.177),vec3(.052,.066,.091),fog);color*=.85+.15*sin(vPhase);gl_FragColor=vec4(color,a*uVisibility*.42*(1.-fog*.6));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const clouds=new THREE.Mesh(cloudGeo,cloudMat);clouds.frustumCulled=false;clouds.name='quiet-depth-cloud-banks';clouds.renderOrder=3;group.add(clouds);

  const skyUniforms={uVisibility:{value:0}};
  const skyMat=new THREE.ShaderMaterial({uniforms:skyUniforms,side:THREE.BackSide,transparent:true,depthWrite:false,
    vertexShader:`varying vec3 vDirection;void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`precision highp float;varying vec3 vDirection;uniform float uVisibility;
      void main(){vec3 d=normalize(vDirection);float h=exp(-pow((d.y-.035)*5.5,2.));vec3 c=mix(vec3(.003,.006,.013),vec3(.061,.075,.103),h*.65);float glow=exp(-pow((d.x+.02)*3.2,2.)-pow((d.y-.07)*10.,2.))*smoothstep(.1,.95,-d.z);c+=vec3(.07,.048,.024)*glow;gl_FragColor=vec4(c,uVisibility);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const sky=new THREE.Mesh(new THREE.SphereGeometry(345,32,16),skyMat);sky.position.set(0,0,-65);sky.name='haze-and-distant-warmth';sky.renderOrder=-100;group.add(sky);

  function update(t,state={}){
    const growth=clamp(state.growth??1),vis=clamp(state.visibility??1),energy=clamp(state.energy??0);
    group.visible=vis>.0001;group.scale.y=Math.max(.0001,growth);
    terrainMat.opacity=vis*smooth(.08,.4,growth);
    contourMat.opacity=vis*smooth(.18,.7,growth)*(.055+.022*energy);
    waterUniforms.uTime.value=t;waterUniforms.uVisibility.value=vis*smooth(.3,.68,growth);waterUniforms.uEnergy.value=energy;
    const treeReveal=vis*smooth(.58,.98,growth);
    tree.material.opacity=treeReveal*.95;twigs.material.opacity=treeReveal*.76;leafMat.opacity=treeReveal*.83;
    cloudUniforms.uTime.value=t;cloudUniforms.uVisibility.value=vis*smooth(.45,.95,growth);
    skyUniforms.uVisibility.value=vis*smooth(.05,.5,growth);
  }
  update(0,{growth:0,visibility:0});
  return {group,update,getPath,getHeight,
    metrics:{terrainTriangles:indices.length/3,waterTriangles:40*70*2,cloudInstances:12,drawCalls:8,sourceThemePitches:melodic.slice(0,3),harmonicRegisterSpan:harmonicSpread,heroPosition:[0,baseY,-75]},
    dispose(){group.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of(Array.isArray(o.material)?o.material:[o.material]))m.dispose();}});cloudUniforms.uMap.value.dispose();}
  };
}
