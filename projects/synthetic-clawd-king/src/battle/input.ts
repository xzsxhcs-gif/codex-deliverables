import type { MoveInput } from './types';

export class BattleInput {
  private keys = new Set<string>();
  private jumpPressed = false;
  private dragging = false;
  private active = false;
  private touchMove = { x: 0, z: 0 };
  private touchSprint = false;
  private touchCrouch = false;
  firing = false;
  locked = false;
  private removers: Array<() => void> = [];
  constructor(private canvas: HTMLCanvasElement, private look: (dx:number,dy:number)=>void, private pause:()=>void, private lockStatus:(locked:boolean)=>void) {
    const listen = <K extends keyof WindowEventMap>(name: K, handler: (event:WindowEventMap[K])=>void) => {
      window.addEventListener(name, handler); this.removers.push(()=>window.removeEventListener(name,handler));
    };
    listen('keydown',e=>{
      if(!this.active || e.target instanceof HTMLInputElement) return;
      if(['KeyW','KeyA','KeyS','KeyD','Space','ShiftLeft','ShiftRight','ControlLeft','ControlRight','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Escape'].includes(e.code))e.preventDefault();
      if(e.code==='Escape') { this.pause(); return; }
      if(e.code==='Space'&&!e.repeat)this.jumpPressed=true;
      this.keys.add(e.code);
    });
    listen('keyup',e=>this.keys.delete(e.code));
    listen('mousemove',e=>{if(this.active&&(this.locked||this.dragging))this.look(e.movementX,e.movementY)});
    listen('mouseup',()=>{this.firing=false;this.dragging=false});
    listen('blur',()=>{if(this.active)this.pause();this.clear()});
    const down=(e:PointerEvent)=>{
      if(!this.active||e.pointerType==='touch')return;
      if(e.button===0){this.firing=true;this.dragging=true;}
    };
    canvas.addEventListener('pointerdown',down);
    this.removers.push(()=>canvas.removeEventListener('pointerdown',down));
    const lock=()=>{
      const was=this.locked;this.locked=document.pointerLockElement===canvas;this.lockStatus(this.locked);
      if(was&&!this.locked&&this.active)this.pause();
    };
    const lockError=()=>this.lockStatus(false);
    document.addEventListener('pointerlockerror',lockError);
    this.removers.push(()=>document.removeEventListener('pointerlockerror',lockError));
    document.addEventListener('pointerlockchange',lock);
    this.removers.push(()=>document.removeEventListener('pointerlockchange',lock));
    const visibility=()=>{if(document.hidden&&this.active)this.pause()};
    document.addEventListener('visibilitychange',visibility);
    this.removers.push(()=>document.removeEventListener('visibilitychange',visibility));
    const menu=(e:Event)=>e.preventDefault();canvas.addEventListener('contextmenu',menu);
    this.removers.push(()=>canvas.removeEventListener('contextmenu',menu));
  }
  async enable(requestLock=true) {
    this.clear();this.active=true;
    if(requestLock && this.canvas.requestPointerLock) {
      try { await this.canvas.requestPointerLock(); }
      catch { this.lockStatus(false); }
    } else if(requestLock) this.lockStatus(false);
  }
  disable() {
    this.active=false;this.clear();
    if(document.pointerLockElement===this.canvas)document.exitPointerLock();
  }
  clear(){this.keys.clear();this.firing=false;this.dragging=false;this.jumpPressed=false;this.touchMove={x:0,z:0};this.touchSprint=false;this.touchCrouch=false;}
  consume():MoveInput {
    const k=this.keys;
    const input={x:Math.max(-1,Math.min(1,Number(k.has('KeyD')||k.has('ArrowRight'))-Number(k.has('KeyA')||k.has('ArrowLeft'))+this.touchMove.x)),z:Math.max(-1,Math.min(1,Number(k.has('KeyW')||k.has('ArrowUp'))-Number(k.has('KeyS')||k.has('ArrowDown'))+this.touchMove.z)),sprint:k.has('ShiftLeft')||k.has('ShiftRight')||this.touchSprint,crouch:k.has('ControlLeft')||k.has('ControlRight')||this.touchCrouch,jump:this.jumpPressed};
    this.jumpPressed=false;return input;
  }
  moveTouch(x:number,z:number){this.touchMove={x,z};this.touchSprint=Math.hypot(x,z)>.82;}
  jumpTouch(){this.jumpPressed=true;}
  crouchTouch(active:boolean){this.touchCrouch=active;}
  lookTouch(dx:number,dy:number){if(this.active)this.look(dx,dy);}
  dispose(){this.disable();this.removers.forEach(fn=>fn());this.removers=[];}
}
