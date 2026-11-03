import './legacy/merging.js';
import './shell.css';
import { BattleAudio } from './battle/audio';
import { BattleRuntime } from './battle/runtime';
import { createBattleUI, type BattleUI } from './battle/ui';
import type { GameMode, Lang } from './battle/types';

const bridge=window.clawd2D;
let mode:GameMode='MERGING';
let runtime:BattleRuntime|null=null;
let ui:BattleUI|null=null;
let transitionTime=0;
let returning=false;
let returnTime=0;
let battleLost=false;
let wonThisEncounter=false;
let needsRebuild=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const getFlag=(key:string)=>{try{return localStorage.getItem(key)==='1';}catch{return false;}};
const setFlag=(key:string)=>{try{localStorage.setItem(key,'1');}catch{/* In-memory play is still available. */}};
let unlocked=getFlag('sc_boss_unlocked');
bridge.kingslayer=getFlag('sc_kingslayer');
const audio=new BattleAudio(bridge.audioContext);
audio.setMuted(bridge.isMuted());

const root=document.createElement('section');root.id='boss-root';root.className='boss-root';root.hidden=true;root.setAttribute('aria-label','Clawd King');
const sceneHost=document.createElement('div');sceneHost.className='boss-scene';root.appendChild(sceneHost);
const transition=document.createElement('div');transition.className='royal-transition';transition.hidden=true;
transition.innerHTML='<div class="royal-transition__crown" aria-hidden="true">♛</div><p class="royal-transition__eyebrow"></p><h2></h2><span class="royal-transition__line"></span>';
const trophy=document.createElement('p');trophy.className='royal-trophy';trophy.hidden=!bridge.kingslayer;
const royalSection=document.createElement('div');royalSection.className='royal-collection';
const replay=document.createElement('button');replay.id='royal-replay';replay.type='button';replay.hidden=!unlocked;
const record=document.createElement('p');royalSection.append(record,replay);
document.getElementById('col')!.append(royalSection);
document.body.append(trophy,root,transition);
const language=():Lang=>bridge.language();
function translate(){
 const zh=language()==='zh';
 transition.querySelector('h2')!.textContent=zh?'蟹王，苏醒了。':'CLAWD KING HAS AWAKENED.';
 transition.querySelector('p')!.textContent=zh?'你刚刚合成了什么？':'WHAT HAVE YOU MERGED?';
 trophy.textContent=zh?'♛ 弑王者 · 王冠星辉':'♛ KINGSLAYER · CROWN STARLIGHT';
 replay.textContent=zh?'再次挑战蟹王':'Challenge the King again';
 record.textContent=unlocked?(bridge.kingslayer?(zh?'秘密成就 · 弑王者已解锁':'Secret achievement · KINGSLAYER unlocked'):(zh?'王座已开启。你的对手仍在等待。':'The throne is open. Your challenger awaits.')):'';
 ui?.setLanguage(language());
}
function setMode(next:GameMode){
 mode=next;document.body.dataset.mode=next;
 for(const node of document.querySelectorAll<HTMLElement>('body > header,body > .bar,body > .wrap,body > .hint,body > .royal-trophy'))node.inert=next!=='MERGING';
}
function requestBoss(x=180,y=280){
 if(mode!=='MERGING')return;
 bridge.freeze();unlocked=true;setFlag('sc_boss_unlocked');replay.hidden=false;translate();
 transitionTime=0;returning=false;battleLost=false;wonThisEncounter=false;needsRebuild=false;setMode('TRANSITION_TO_BOSS');
 const canvas=document.getElementById('c')!;
 canvas.style.transformOrigin=`${x/360*100}% ${y/560*100}%`;
 canvas.classList.add('royal-zoom');transition.hidden=false;transition.classList.remove('royal-transition--out');
 audio.unlock();audio.restore();audio.intro();
}
function createBattle(){
 root.hidden=false;
 try{
  ui=createBattleUI(root,{
   onStart:()=>{if(!runtime)return;ui?.hideScreen();runtime.start(!matchMedia('(pointer:coarse)').matches);},
   onRetry:()=>{if(needsRebuild){runtime?.dispose();runtime=null;ui?.destroy();ui=null;sceneHost.replaceChildren();needsRebuild=false;createBattle();return;}if(!runtime)return;battleLost=false;runtime.retry();ui?.showScreen('ready');},
   onReturn:()=>returnToMerging(false),
   onPause:()=>pause(),
   onMute:()=>{const muted=!bridge.isMuted();bridge.setMuted(muted);audio.setMuted(muted);ui?.setMuted(muted);},
   onVolume:(value:number)=>audio.setVolume(value),
   onTouchMove:(x:number,z:number)=>runtime?.input.moveTouch(x,z),
   onTouchLook:(dx:number,dy:number)=>runtime?.input.lookTouch(dx,dy),
   onTouchJump:()=>runtime?.input.jumpTouch(),
   onTouchSlide:(active:boolean)=>runtime?.input.crouchTouch(active),
   onTouchFire:(active:boolean)=>{if(runtime)runtime.input.firing=active;}
  },language());
  runtime=new BattleRuntime(sceneHost,audio,{
   update:snapshot=>ui?.update(snapshot),
   pause:()=>pause(),
   lose:()=>{battleLost=true;ui?.showScreen('defeat');},
   victory:()=>returnToMerging(true),
   lock:locked=>ui?.setLockFallback(!locked),
   error:()=>{needsRebuild=true;runtime?.pause();ui?.showScreen('error');}
  });
  ui.setMuted(bridge.isMuted());ui.update(runtime.snapshot());ui.showScreen('ready');
 }catch(error){
  console.error('Clawd arena initialization failed:',error);
  needsRebuild=true;runtime?.dispose();runtime=null;ui?.showScreen('error');
 }
 setMode('BOSS_BATTLE');
 transition.classList.add('royal-transition--out');
}
function pause(){
 if(mode!=='BOSS_BATTLE'||returning||battleLost||runtime?.boss.state.stage==='defeated')return;
 runtime?.pause();ui?.showScreen('pause');
}
function returnToMerging(victory:boolean){
 if(mode==='MERGING'||returning)return;
 returning=true;
 if(victory){
  wonThisEncounter=true;setMode('BOSS_DEFEATED');setFlag('sc_kingslayer');bridge.kingslayer=true;
  trophy.hidden=false;ui?.showScreen('victory');
 }else setMode('RETURN_TO_MERGING');
 runtime?.pause();audio.fade();returnTime=0;
 root.classList.add('boss-root--leaving');
}
function finishReturn(){
 runtime?.dispose();runtime=null;ui?.destroy();ui=null;sceneHost.replaceChildren();root.hidden=true;root.classList.remove('boss-root--leaving');
 transition.hidden=true;document.getElementById('c')!.classList.remove('royal-zoom');
 setMode('MERGING');bridge.resume();if(wonThisEncounter)bridge.notifyVictory();
 returning=false;translate();
}
bridge.tick=(dt)=>{
 if(mode==='TRANSITION_TO_BOSS'){
  transitionTime+=dt;
  if(transitionTime>=(reduced?1.1:2.9))createBattle();
 }else if(runtime&&mode!=='MERGING')runtime.tick(dt);
 if(mode==='BOSS_BATTLE'&&transitionTime!==-1){
  transitionTime+=dt;if(transitionTime>3.8){transition.hidden=true;transitionTime=-1;}
 }
 if(returning){returnTime+=dt;if(returnTime>.6)finishReturn();}
};
window.addEventListener('clawd:king',((event:CustomEvent<{x:number;y:number}>)=>requestBoss(event.detail.x,event.detail.y)) as EventListener);
window.addEventListener('clawd:language',translate);
window.addEventListener('clawd:mute',()=>{audio.setMuted(bridge.isMuted());ui?.setMuted(bridge.isMuted());});
replay.addEventListener('click',()=>requestBoss());
window.addEventListener('pagehide',(event)=>{
 if(event.persisted){if(mode==='BOSS_BATTLE')pause();return;}
 runtime?.dispose();audio.dispose();
});
window.addEventListener('pageshow',(event)=>{if(event.persisted&&mode==='BOSS_BATTLE')pause();});
if(import.meta.env.DEV){
 window.clawdQA={mode:()=>mode,runtime:()=>runtime,advance:(seconds)=>{for(let t=0;t<seconds;t+=1/60)bridge.tick(1/60,0);},returnToMerging:()=>returnToMerging(false)};
}
translate();
setMode('MERGING');
