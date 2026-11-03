import * as THREE from 'three';
import { createArena } from './arena';
import { createKing } from './king-model';
import { PlayerController } from './player';
import { BossDirector } from './boss';
import { BattleInput } from './input';
import type { BattleAudio } from './audio';
import type { BossSnapshot, PlayerSnapshot } from './types';

interface FriendlyBubble { mesh:THREE.Mesh; velocity:THREE.Vector3; age:number }
interface Spark { mesh:THREE.Mesh; velocity:THREE.Vector3; life:number }
export interface BattleSnapshot { boss:BossSnapshot; player:PlayerSnapshot; playerHealth:number; paused:boolean; elapsed:number; locked:boolean; shots:number; hits:number; enemyBubbles:number }
export interface BattleCallbacks { update:(snapshot:BattleSnapshot)=>void; pause:()=>void; lose:()=>void; victory:()=>void; lock:(locked:boolean)=>void; error:(message:string)=>void }

/** No RAF here. The original game's single animation loop clocks this renderer. */
export class BattleRuntime {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(68,1,.08,160);
  readonly arena = createArena();
  readonly king = createKing();
  readonly player:PlayerController;
  readonly boss:BossDirector;
  readonly input:BattleInput;
  paused=true;
  elapsed=0;
  private ended=false;
  private victoryElapsed=0;
  private wonCallback=false;
  private accumulator=0;
  private shotCooldown=0;
  private shots=0;
  private hits=0;
  private damageKick=0;
  private weaponKick=0;
  private lastHealth=100;
  private cameraHeight=1.65;
  private frameUpdates=0;
  private disposables: Array<THREE.BufferGeometry|THREE.Material> = [];
  private friendly:FriendlyBubble[]=[];
  private enemies=new Map<number,THREE.Mesh>();
  private sparks:Spark[]=[];
  private orbGeometry=new THREE.SphereGeometry(.22,12,8);
  private enemyGeometry=new THREE.SphereGeometry(1,12,8);
  private friendlyMaterial:THREE.MeshStandardMaterial;
  private enemyMaterial:THREE.MeshStandardMaterial;
  private sparkMaterial:THREE.MeshBasicMaterial;
  private warning:THREE.Mesh;
  private chargeWarning:THREE.Mesh;
  private impact:THREE.Mesh;
  private staff=new THREE.Group();
  private halo=new THREE.Group();
  private observer:ResizeObserver;
  private contextLost:(event:Event)=>void;
  private width=1;
  private height=1;
  private disposed=false;
  private hudTimer=0;
  constructor(private container:HTMLElement,private audio:BattleAudio,private callbacks:BattleCallbacks) {
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'high-performance'});
    const mobile=matchMedia('(pointer: coarse)').matches;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.35:1.75));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.1;
    this.renderer.shadowMap.enabled=!mobile;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute('aria-label','Clawd King first-person battle');
    this.container.appendChild(this.renderer.domElement);
    this.scene.background=new THREE.Color('#181a30');
    this.scene.fog=new THREE.FogExp2('#24233e',.015);
    this.scene.add(this.arena.group,this.king.group);
    this.player=new PlayerController(this.arena.obstacles,24);
    this.player.setOrientation(0,.075);
    this.boss=new BossDirector(this.arena.obstacles);
    this.input=new BattleInput(this.renderer.domElement,(dx,dy)=>this.player.look(dx,dy),()=>this.callbacks.pause(),locked=>this.callbacks.lock(locked));
    this.friendlyMaterial=new THREE.MeshStandardMaterial({color:'#b4fff2',emissive:'#70ceb8',emissiveIntensity:.8,roughness:.2,metalness:.15});
    this.enemyMaterial=new THREE.MeshStandardMaterial({color:'#e6a3ff',emissive:'#ad4eaf',emissiveIntensity:.55,roughness:.32,metalness:.1,transparent:true,opacity:.88});
    this.sparkMaterial=new THREE.MeshBasicMaterial({color:'#fff3bf',transparent:true,opacity:.9});
    this.disposables.push(this.orbGeometry,this.enemyGeometry,this.friendlyMaterial,this.enemyMaterial,this.sparkMaterial);
    this.warning=this.makeGroundRing('#ffb87d');
    this.impact=this.makeGroundRing('#ffce89');
    this.chargeWarning=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{time:{value:0}},
      vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv; uniform float time; void main(){float edges=smoothstep(.28,.49,abs(vUv.x-.5)); float stripe=step(.74,fract(vUv.y*13.-time*1.2));gl_FragColor=vec4(1.,.56,.35,.14+edges*.32+stripe*.13);}'
    }));
    this.disposables.push(this.chargeWarning.geometry,this.chargeWarning.material as THREE.Material);
    this.chargeWarning.rotation.x=-Math.PI/2;this.chargeWarning.position.y=.045;
    this.scene.add(this.warning,this.chargeWarning,this.impact);
    this.buildWand();
    this.camera.add(this.staff);this.scene.add(this.camera);
    this.scene.add(this.halo);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(container);this.resize();
    this.contextLost=event=>{event.preventDefault();this.pause();this.callbacks.error('webgl-lost');};
    this.renderer.domElement.addEventListener('webglcontextlost',this.contextLost);
    this.render();
  }
  private makeGroundRing(color:string) {
    const geometry=new THREE.PlaneGeometry(2,2),material=new THREE.ShaderMaterial({
      transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{color:{value:new THREE.Color(color)},progress:{value:0},opacity:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;uniform vec3 color;uniform float progress;uniform float opacity;void main(){float r=length((vUv-.5)*2.);float outer=1.-smoothstep(.96,1.,r);float edge=smoothstep(.91,.95,r)*outer;float fill=(1.-smoothstep(progress-.03,progress+.025,r))*.22;float dashes=.65+.35*step(.35,fract(atan(vUv.y-.5,vUv.x-.5)*12.));gl_FragColor=vec4(color,(edge*dashes+fill+.065*outer)*opacity);}'
    });
    this.disposables.push(geometry,material);
    const mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.y=.055;this.scene.add(mesh);return mesh;
  }
  private buildWand(){
    const material=new THREE.MeshStandardMaterial({color:'#efe6d3',metalness:.2,roughness:.48});
    const gold=new THREE.MeshStandardMaterial({color:'#e8bd6b',metalness:.62,roughness:.32});
    const pink=new THREE.MeshStandardMaterial({color:'#e7a0ba',roughness:.65});
    const glow=new THREE.MeshBasicMaterial({color:'#a1e9dc'});
    this.disposables.push(material,gold,pink,glow);
    const part=(geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number)=>{
      this.disposables.push(geo);const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);this.staff.add(mesh);return mesh;
    };
    part(new THREE.CylinderGeometry(.075,.085,.62,10),material,0,0,0);
    const head=part(new THREE.TorusGeometry(.16,.035,8,20),gold,0,.4,0);head.rotation.x=.15;
    part(new THREE.SphereGeometry(.095,12,8),glow,0,.4,0);
    part(new THREE.BoxGeometry(.08,.14,.065),pink,-.16,.43,0);
    part(new THREE.BoxGeometry(.08,.14,.065),pink,.16,.43,0);
    this.staff.scale.setScalar(.5);this.staff.position.set(.46,-.46,-.85);this.staff.rotation.z=-.25;
  }
  private resize(){
    const r=this.container.getBoundingClientRect();this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);
    this.renderer.setSize(this.width,this.height,false);this.camera.aspect=this.width/this.height;
    this.camera.fov=this.width<this.height?76:68;this.camera.updateProjectionMatrix();
  }
  start(requestLock=true){if(this.ended)return;this.audio.unlock();this.audio.restore();this.paused=false;this.accumulator=0;void this.input.enable(requestLock);}
  pause(){this.paused=true;this.input.disable();this.audio.fade();this.accumulator=0;}
  retry(){
    this.pause();this.clearEffects();this.player.reset();this.player.setOrientation(0,.075);this.boss.reset();
    this.elapsed=0;this.shotCooldown=0;this.ended=false;this.victoryElapsed=0;this.wonCallback=false;
    this.shots=0;this.hits=0;this.lastHealth=100;this.damageKick=0;this.weaponKick=0;this.cameraHeight=1.65;
    this.king.group.visible=true;this.updateVisuals(0);this.callbacks.update(this.snapshot());
  }
  tick(dt:number){
    if(this.disposed)return;
    if(!this.paused&&!this.ended){
      this.accumulator=Math.min(this.accumulator+Math.max(0,Math.min(.1,dt)),.15);
      const frameInput=this.accumulator>=1/120?this.input.consume():{x:0,z:0,sprint:false,crouch:false,jump:false};let jump=frameInput.jump;
      while(this.accumulator>=1/120){
        const h=1/120;this.accumulator-=h;this.elapsed+=h;
        this.player.update(h,{...frameInput,jump});jump=false;
        this.boss.update(h,this.player.state);
        // Dynamic king body blocks the player; idle contact never inflicts damage.
        const ps=this.player.state,bs=this.boss.state,dx=ps.x-bs.x,dz=ps.z-bs.z;
        const distance=Math.hypot(dx,dz),minimum=this.boss.bodyRadius+.42;
        if(distance<minimum&&ps.y<5.2&&bs.stage!=='defeated'){
          const nx=distance>.001?dx/distance:0,nz=distance>.001?dz/distance:1;
          ps.x=bs.x+nx*minimum;ps.z=bs.z+nz*minimum;
          const inward=ps.vx*nx+ps.vz*nz;
          if(inward<0){ps.vx-=inward*nx;ps.vz-=inward*nz;}
        }
        this.shotCooldown-=h;
        if(this.input.firing&&this.shotCooldown<=0&&this.boss.state.stage!=='intro')this.shoot();
        this.updateProjectiles(h);
        for(const event of this.boss.events.splice(0)){
          this.audio.event(event);
          if(event.type==='hit')this.burst(event.x??this.boss.state.x,event.y??3,event.z??this.boss.state.z,5);
          if(event.type==='player-hit')this.damageKick=.7;
          if(event.type==='victory'){this.ended=true;this.victoryElapsed=0;this.input.disable();this.burst(this.boss.state.x,4,this.boss.state.z,42);}
        }
        if(this.boss.playerHealth<=0&&!this.ended){this.ended=true;this.pause();this.callbacks.lose();break;}
        if(this.ended)break;
      }
    }
    if(this.ended&&this.boss.state.stage==='defeated'){
      this.victoryElapsed+=Math.min(dt,.05);this.updateSparks(Math.min(dt,.05));
      if(this.victoryElapsed>3.4&&!this.wonCallback){this.wonCallback=true;this.callbacks.victory();}
    }else if(!this.paused)this.updateSparks(Math.min(dt,.05));
    this.updateVisuals(this.paused?0:Math.min(dt,.05));
    this.hudTimer+=dt;
    if(this.hudTimer>.06){this.hudTimer=0;this.callbacks.update(this.snapshot());}
    this.render();
  }
  private shoot(){
    const p=this.player.state;const eye=p.y+(p.crouching||p.sliding?1.03:1.65);
    const direction=new THREE.Vector3(0,0,-1).applyEuler(new THREE.Euler(p.pitch,p.yaw,0,'YXZ'));
    const mesh=new THREE.Mesh(this.orbGeometry,this.friendlyMaterial);
    mesh.position.set(p.x,eye-.035,p.z).addScaledVector(direction,.5);this.scene.add(mesh);
    this.friendly.push({mesh,velocity:direction.multiplyScalar(42),age:0});
    this.shotCooldown=.19;this.weaponKick=1;this.shots++;
    this.audio.event({type:'shot'});
  }
  private updateProjectiles(dt:number){
    const b=this.boss.state;
    for(let i=this.friendly.length-1;i>=0;i--){
      const orb=this.friendly[i],old=orb.mesh.position.clone();orb.mesh.position.addScaledVector(orb.velocity,dt);orb.age+=dt;
      const p=orb.mesh.position;
      const hit=this.segmentEllipsoid(old,p,new THREE.Vector3(b.x,3.1,b.z),new THREE.Vector3(3.05,2.8,2.3));
      const blocked=this.arena.obstacles.some(o=>Math.abs(p.x-o.x)<o.halfX+.2&&Math.abs(p.z-o.z)<o.halfZ+.2&&p.y<o.height+.2&&p.y>0);
      if(hit&&this.boss.damageBoss(9,{x:p.x,y:p.y,z:p.z})){
        this.hits++;this.scene.remove(orb.mesh);this.friendly.splice(i,1);
      }else if(blocked||orb.age>2.4||p.y<.1||p.y>35||Math.hypot(p.x,p.z)>25){this.scene.remove(orb.mesh);this.friendly.splice(i,1);}
    }
  }
  private segmentEllipsoid(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,r:THREE.Vector3){
    const start=a.clone().sub(c).divide(r),delta=b.clone().sub(a).divide(r);
    const den=delta.lengthSq(),t=den>0?THREE.MathUtils.clamp(-start.dot(delta)/den,0,1):0;
    return start.addScaledVector(delta,t).lengthSq()<=1;
  }
  private burst(x:number,y:number,z:number,count:number){
    for(let i=0;i<count;i++){
      if(this.sparks.length>120){const s=this.sparks.shift()!;this.scene.remove(s.mesh);}
      const mesh=new THREE.Mesh(this.orbGeometry,this.sparkMaterial);mesh.scale.setScalar(.18+(i%3)*.08);mesh.position.set(x,y,z);
      const a=i*2.399963;const speed=count>10?3.5:1.3;
      const velocity=new THREE.Vector3(Math.cos(a)*speed,1+(i%5)*.4,Math.sin(a)*speed);
      this.sparks.push({mesh,velocity,life:.65+(i%4)*.12});this.scene.add(mesh);
    }
  }
  private updateSparks(dt:number){
    for(let i=this.sparks.length-1;i>=0;i--){const s=this.sparks[i];s.life-=dt;s.velocity.y-=dt*3;s.mesh.position.addScaledVector(s.velocity,dt);s.mesh.scale.multiplyScalar(Math.exp(-dt*2));if(s.life<=0){this.scene.remove(s.mesh);this.sparks.splice(i,1);}}
  }
  private updateVisuals(dt:number){
    const b=this.boss.state,p=this.player.state;
    this.arena.update(this.elapsed,b.phase);
    this.king.group.position.set(b.x,0,b.z);this.king.group.rotation.y=b.yaw;
    this.king.animate({time:this.elapsed,stage:b.stage,attack:b.attack,progress:b.duration?b.elapsed/b.duration:0,phase:b.phase,flash:b.flash,defeat:this.victoryElapsed/3.1});
    const targetHeight=p.crouching||p.sliding?1.03:1.65;
    this.cameraHeight=THREE.MathUtils.damp(this.cameraHeight,targetHeight,15,dt||.016);
    this.damageKick=Math.max(0,this.damageKick-dt*2.3);this.weaponKick=Math.max(0,this.weaponKick-dt*7);
    const moving=p.grounded?Math.min(1,p.speed/9):0;
    const bob=matchMedia('(prefers-reduced-motion: reduce)').matches?0:Math.sin(this.elapsed*10)*.018*moving;
    this.camera.position.set(p.x,p.y+this.cameraHeight+bob,p.z);
    this.camera.rotation.set(p.pitch+Math.sin(this.elapsed*40)*this.damageKick*.012,p.yaw,0,'YXZ');
    this.staff.position.set(.46,-.46+Math.sin(this.elapsed*7)*.006*moving,-.85+this.weaponKick*.035);
    this.staff.rotation.x=-this.weaponKick*.12;
    const windup=b.stage==='windup';
    this.warning.visible=windup&&b.attack==='slam';
    this.chargeWarning.visible=windup&&b.attack==='charge';
    this.impact.visible=b.attack==='slam'&&b.stage==='execute';
    const ring=this.warning.material as THREE.ShaderMaterial;
    ring.uniforms.progress.value=THREE.MathUtils.clamp(b.elapsed/b.duration,0,1);ring.uniforms.opacity.value=.8;
    this.warning.position.set(b.target.x,.055,b.target.z);this.warning.scale.setScalar(b.warningRadius);
    if(this.chargeWarning.visible){
      const dx=b.target.x-b.origin.x,dz=b.target.z-b.origin.z;
      this.chargeWarning.position.set((b.target.x+b.origin.x)/2,.04,(b.target.z+b.origin.z)/2);
      this.chargeWarning.rotation.set(-Math.PI/2,0,-Math.atan2(dx,dz));
      this.chargeWarning.scale.set(6.2,Math.hypot(dx,dz)+3,1);
      (this.chargeWarning.material as THREE.ShaderMaterial).uniforms.time.value=this.elapsed;
    }
    if(this.impact.visible){
      const progress=THREE.MathUtils.clamp(b.elapsed/b.duration,0,1);
      this.impact.position.set(b.target.x,.065,b.target.z);this.impact.scale.setScalar(b.warningRadius*(.7+progress*.3));
      const m=this.impact.material as THREE.ShaderMaterial;m.uniforms.progress.value=1;m.uniforms.opacity.value=(1-progress)*.7;
    }
    const alive=new Set<number>();
    for(const orb of this.boss.bubbles){
      alive.add(orb.id);let mesh=this.enemies.get(orb.id);
      if(!mesh){mesh=new THREE.Mesh(this.enemyGeometry,this.enemyMaterial);this.scene.add(mesh);this.enemies.set(orb.id,mesh);}
      mesh.position.set(orb.x,orb.y,orb.z);mesh.scale.setScalar(orb.radius);
    }
    for(const [id,mesh]of this.enemies)if(!alive.has(id)){this.scene.remove(mesh);this.enemies.delete(id);}
    this.lastHealth=this.boss.playerHealth;
  }
  private render(){this.renderer.render(this.scene,this.camera);this.frameUpdates++;}
  snapshot():BattleSnapshot {return{boss:{...this.boss.state,target:{...this.boss.state.target},origin:{...this.boss.state.origin}},player:{...this.player.state},playerHealth:this.boss.playerHealth,paused:this.paused,elapsed:this.elapsed,locked:this.input.locked,shots:this.shots,hits:this.hits,enemyBubbles:this.boss.bubbles.length};}
  diagnostics(){return{...this.snapshot(),renderFrames:this.frameUpdates,drawCalls:this.renderer.info.render.calls,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,disposed:this.disposed};}
  private clearEffects(){for(const s of [...this.friendly,...this.sparks])this.scene.remove(s.mesh);this.friendly=[];this.sparks=[];for(const m of this.enemies.values())this.scene.remove(m);this.enemies.clear();}
  dispose(){
    if(this.disposed)return;this.disposed=true;this.input.dispose();this.observer.disconnect();this.clearEffects();
    this.renderer.domElement.removeEventListener('webglcontextlost',this.contextLost);
    this.arena.dispose();this.king.dispose();this.disposables.forEach(resource=>resource.dispose());
    this.renderer.dispose();this.renderer.forceContextLoss();this.renderer.domElement.remove();this.scene.clear();
  }
}
