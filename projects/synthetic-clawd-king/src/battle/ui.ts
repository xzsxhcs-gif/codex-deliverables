import type { BattleSnapshot } from './runtime';
import type { Lang } from './types';
import './ui.css';

export interface UICallbacks {
  onStart():void; onRetry():void; onReturn():void; onPause():void; onMute():void; onVolume(value:number):void;
  onTouchMove(x:number,z:number):void; onTouchLook(dx:number,dy:number):void;
  onTouchJump():void; onTouchSlide(active:boolean):void; onTouchFire(active:boolean):void;
}
export type BattleScreen = 'ready'|'pause'|'defeat'|'victory'|'error';
export interface BattleUI {
  setLanguage(lang:Lang):void; update(snapshot:BattleSnapshot):void;
  showScreen(kind:BattleScreen):void; hideScreen():void;
  setMuted(muted:boolean):void; setLockFallback(fallback:boolean):void; destroy():void;
}
const COPY = {
  en: {
    name:'CLAWD KING',eyebrow:'A SMALL MERGE. A ROYAL PROBLEM.',phase:'PHASE',health:'YOUR SHELL',energy:'BUBBLE SCEPTER',energyNote:'Hold to cast · unlimited bubbles',
    pause:'Pause encounter',mute:'Mute sound',unmute:'Enable sound',volume:'Sound volume',
    readyTitle:'YOU MERGED A KING.',readyText:'He would like a word. Keep moving, watch the royal warnings, and aim your bubbles at his pink shell.',
    readyTag:'THE KING AWAKENS',start:'Enter the royal court',resume:'Resume encounter',retry:'Try again',back:'Return to merging',
    pauseTitle:'A ROYAL TIMEOUT.',pauseText:'The crown can wait. Your merging board is exactly where you left it.',
    defeatTag:'SHELL SHOCKED',defeatTitle:'A LITTLE TOO ROYAL.',defeatText:'The king wins this round. Retry here — no merging required.',
    victoryTag:'SECRET ACHIEVEMENT',victoryTitle:'KINGSLAYER',victoryText:'One tiny crab. One enormous misunderstanding. The crown is yours.',
    errorTag:'THE COURT IS CLOSED',errorTitle:'THE PORTAL LOST ITS SPARK.',errorText:'3D rendering is unavailable. Your merging board is safe. You can try again or return to it.',
    controls:'WASD move   ·   Mouse aim   ·   Space jump   ·   Shift sprint   ·   Ctrl slide',
    mobileControls:'Left thumb moves · Right thumb aims · Hold the bubble to cast',
    fallback:'Mouse capture unavailable — click and drag to aim. Esc pauses.',
    attackIntro:'THE ROYAL COURT',attackIntroHint:'A small visitor. A very large king.',
    charge:'ROYAL CHARGE',chargeHint:'Leave the marked lane. Keep moving sideways.',
    slam:'CLAW SLAM',slamHint:'Leave the circle — or jump at the strike.',
    barrage:'BUBBLE BARRAGE',barrageHint:'Find the gaps. Jump over low bubbles.',
    recovery:'YOUR OPENING',recoveryHint:'The crown is catching its breath. Keep your aim steady.',
    idle:'WATCH THE CROWN',idleHint:'Move, aim, and read the next warning.',
    won:'THE KING YIELDS',wonHint:'Returning to your very ordinary crab collection…',
    fire:'Cast bubbles',jump:'Jump',slide:'Slide / crouch',move:'Move joystick',aim:'Drag to aim',loading:'Ready',
    phaseTwo:'THE CROWN GROWS RESTLESS',phaseOne:'THE KING IS AMUSED',
  },
  zh: {
    name:'克劳德蟹王',eyebrow:'合成一小步，惹出一位王。',phase:'阶段',health:'你的蟹壳',energy:'泡泡权杖',energyNote:'按住发射 · 泡泡无限',
    pause:'暂停战斗',mute:'关闭音效',unmute:'开启音效',volume:'音效音量',
    readyTitle:'你合成了一位王。',readyText:'他想和你聊聊。保持移动，留意王室警告，把泡泡瞄准他的粉色蟹壳。',
    readyTag:'蟹王觉醒',start:'进入王室庭院',resume:'继续战斗',retry:'再试一次',back:'返回合成',
    pauseTitle:'王室休息时间。',pauseText:'王冠可以等等。你的合成棋盘还在原处，安然无恙。',
    defeatTag:'蟹壳受挫',defeatTitle:'这位王有点厉害。',defeatText:'这一局蟹王获胜。直接再试一次，不必重新合成。',
    victoryTag:'隐藏成就解锁',victoryTitle:'弑王者',victoryText:'一只小蟹，一场巨大的误会。王冠归你了。',
    errorTag:'庭院暂未开放',errorTitle:'传送门没电了。',errorText:'暂时无法进行三维渲染。合成棋盘已保留，可以重试或返回。',
    controls:'WASD 移动   ·   鼠标瞄准   ·   空格跳跃   ·   Shift 冲刺   ·   Ctrl 滑铲',
    mobileControls:'左手移动 · 右手瞄准 · 按住泡泡发射',
    fallback:'鼠标锁定不可用：按住画面拖动瞄准，Esc 暂停。',
    attackIntro:'王室庭院',attackIntroHint:'来客很小，蟹王很大。',
    charge:'王室冲锋',chargeHint:'离开标记路线，向侧面躲避。',
    slam:'巨钳重击',slamHint:'离开圆圈，或在落钳时跳起。',
    barrage:'泡泡弹幕',barrageHint:'寻找空隙，跳过低空泡泡。',
    recovery:'反击时机',recoveryHint:'王冠正在喘口气。稳住瞄准，继续发射。',
    idle:'留意王冠',idleHint:'保持移动，等待下一次预警。',
    won:'蟹王认输了',wonHint:'即将返回你那十分普通的螃蟹收藏……',
    fire:'发射泡泡',jump:'跳跃',slide:'滑铲 / 蹲伏',move:'移动摇杆',aim:'拖动瞄准',loading:'就绪',
    phaseTwo:'王冠开始不耐烦了',phaseOne:'蟹王觉得很有趣',
  },
} as const;

/** A DOM-only HUD. Gameplay clocks its updates; it creates no timers or RAFs. */
export function createBattleUI(container:HTMLElement,callbacks:UICallbacks,initialLang:Lang):BattleUI {
  let lang=initialLang,muted=false,screen:BattleScreen|null='ready',fallback=false,lastSnapshot:BattleSnapshot|null=null;
  let lastHits=0,hitUntil=-1,lastHealth=100,damageUntil=-1,previousFocus:HTMLElement|null=null;
  const listeners:Array<()=>void>=[];
  const root=document.createElement('div');root.className='boss-ui';
  root.innerHTML=`
    <div class="boss-damage-wash" aria-hidden="true"></div>
    <div class="boss-hud">
      <header class="boss-topbar">
        <div class="boss-brand"><span class="boss-brand-mark" aria-hidden="true">♜</span><span>SYNTHETIC CLAWD<span class="boss-brand-sub">THE KING AWAKENS</span></span></div>
        <div class="boss-toolbar"><button type="button" id="boss-mute" class="boss-icon-button"><span aria-hidden="true">♪</span></button><button type="button" id="boss-pause" class="boss-icon-button"><span aria-hidden="true">Ⅱ</span></button></div>
      </header>
      <section class="boss-health" aria-labelledby="boss-name"><div class="boss-health-heading"><span class="boss-crown" aria-hidden="true">♛</span><h2 id="boss-name"></h2><span id="boss-phase" class="boss-phase"></span></div><progress id="boss-health-bar" value="1800" max="1800"></progress><div class="boss-health-meta"><span id="boss-phase-note"></span><span id="boss-health-number"></span></div></section>
      <div class="boss-reticle" aria-hidden="true"><i></i><span></span></div>
      <div class="boss-attack-status" role="status" aria-live="polite"><span class="boss-status-dot" aria-hidden="true"></span><strong id="boss-attack-name"></strong><span id="boss-attack-hint"></span><div class="boss-anticipation"><i></i></div></div>
      <div id="boss-capture-hint" class="boss-capture-hint" hidden></div>
      <footer class="boss-bottom"><section class="boss-player-vital"><span id="boss-shell-label" class="boss-small-label"></span><div class="boss-vital-number"><b id="boss-player-health">100</b><span>/ 100</span></div><progress id="boss-player-bar" value="100" max="100"></progress></section><p id="boss-controls" class="boss-controls"></p><section class="boss-weapon-label"><span class="boss-weapon-dot" aria-hidden="true"></span><b id="boss-weapon-name"></b><span id="boss-weapon-note"></span></section></footer>
      <div class="boss-mobile-controls"><div id="boss-stick" class="boss-stick" role="group"><span class="boss-stick-knob"></span></div><div id="boss-aim-zone" class="boss-aim-zone"></div><div class="boss-touch-actions"><button type="button" id="boss-touch-jump" class="boss-touch-small"><span aria-hidden="true">↑</span></button><button type="button" id="boss-touch-slide" class="boss-touch-small"><span aria-hidden="true">↓</span></button><button type="button" id="boss-touch-fire" class="boss-touch-fire"><span aria-hidden="true">◉</span></button></div></div>
    </div>
    <div class="boss-screen" id="boss-screen"><section class="boss-dialog" role="dialog" aria-modal="true" aria-labelledby="boss-screen-title" aria-describedby="boss-screen-description"><div class="boss-dialog-crown" aria-hidden="true"><span>♛</span><i></i></div><p id="boss-screen-tag" class="boss-eyebrow"></p><h1 id="boss-screen-title"></h1><p id="boss-screen-description" class="boss-screen-description"></p><div class="boss-screen-actions"><button type="button" id="boss-start" class="boss-button boss-primary"></button><button type="button" id="boss-retry" class="boss-button boss-secondary"></button><button type="button" id="boss-return" class="boss-button boss-text-button"></button></div><div class="boss-volume-row"><label for="boss-volume" id="boss-volume-label"></label><input id="boss-volume" type="range" min="0" max="0.7" step="0.05" value="0.45"><output for="boss-volume" id="boss-volume-output">64%</output><button type="button" id="boss-dialog-mute" class="boss-dialog-mute"><span aria-hidden="true">♪</span></button></div><p id="boss-screen-controls" class="boss-screen-controls"></p></section></div>`;
  container.appendChild(root);
  const get=<T extends HTMLElement=HTMLElement>(id:string):T=>root.querySelector<T>(`#${id}`)!;
  const text=(id:string,value:string)=>{const node=get(id);if(node.textContent!==value)node.textContent=value;};
  const on=<K extends keyof HTMLElementEventMap>(node:HTMLElement,name:K,fn:(event:HTMLElementEventMap[K])=>void)=>{node.addEventListener(name,fn);listeners.push(()=>node.removeEventListener(name,fn));};
  const c=()=>COPY[lang];
  const mobile=()=>matchMedia('(pointer: coarse)').matches;
  const labelButton=(id:string,label:string)=>{get(id).setAttribute('aria-label',label);get(id).title=label;};
  function setMuteLabel(){for(const id of ['boss-mute','boss-dialog-mute']){labelButton(id,muted?c().unmute:c().mute);get(id).setAttribute('aria-pressed',String(muted));get(id).classList.toggle('boss-is-muted',muted);}}
  function translate(){
    root.lang=lang==='zh'?'zh-CN':'en';text('boss-name',c().name);text('boss-shell-label',c().health);text('boss-weapon-name',c().energy);text('boss-weapon-note',c().energyNote);text('boss-controls',mobile()?c().mobileControls:c().controls);text('boss-screen-controls',mobile()?c().mobileControls:c().controls);text('boss-capture-hint',c().fallback);text('boss-volume-label',c().volume);
    labelButton('boss-pause',c().pause);labelButton('boss-touch-fire',c().fire);labelButton('boss-touch-jump',c().jump);labelButton('boss-touch-slide',c().slide);get('boss-stick').setAttribute('aria-label',c().move);get('boss-aim-zone').setAttribute('aria-label',c().aim);get('boss-health-bar').setAttribute('aria-label',c().name);get('boss-player-bar').setAttribute('aria-label',c().health);setMuteLabel();
    if(screen)renderScreen(screen);if(lastSnapshot)renderSnapshot(lastSnapshot);
  }
  function renderScreen(kind:BattleScreen){
    const copy=c();
    const titles={ready:copy.readyTitle,pause:copy.pauseTitle,defeat:copy.defeatTitle,victory:copy.victoryTitle,error:copy.errorTitle};
    const descriptions={ready:copy.readyText,pause:copy.pauseText,defeat:copy.defeatText,victory:copy.victoryText,error:copy.errorText};
    const tags={ready:copy.readyTag,pause:copy.readyTag,defeat:copy.defeatTag,victory:copy.victoryTag,error:copy.errorTag};
    text('boss-screen-title',titles[kind]);text('boss-screen-description',descriptions[kind]);text('boss-screen-tag',tags[kind]);
    text('boss-start',kind==='pause'?copy.resume:copy.start);text('boss-retry',copy.retry);text('boss-return',copy.back);
    get('boss-start').hidden=kind!=='ready'&&kind!=='pause';get('boss-retry').hidden=kind!=='pause'&&kind!=='defeat'&&kind!=='error';get('boss-return').hidden=false;
    get('boss-return').classList.toggle('boss-primary',kind==='victory');get('boss-return').classList.toggle('boss-text-button',kind!=='victory');
    root.dataset.screen=kind;get('boss-screen').dataset.screen=kind;
    (root.querySelector('.boss-volume-row') as HTMLElement).hidden=kind==='victory';
    get('boss-screen-controls').hidden=kind==='victory'||kind==='error';
  }
  function showScreen(kind:BattleScreen){
    if(!screen)previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    screen=kind;renderScreen(kind);get('boss-screen').hidden=false;root.classList.add('boss-screen-open');
    callbacks.onTouchMove(0,0);callbacks.onTouchFire(false);callbacks.onTouchSlide(false);
    const first=get('boss-screen').querySelector<HTMLButtonElement>('button:not([hidden])');first?.focus({preventScroll:true});
  }
  function hideScreen(){screen=null;get('boss-screen').hidden=true;root.classList.remove('boss-screen-open');root.removeAttribute('data-screen');get('boss-screen').removeAttribute('data-screen');if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});previousFocus=null;}
  function renderSnapshot(snapshot:BattleSnapshot){
    const b=snapshot.boss,copy=c();
    const hp=get<HTMLProgressElement>('boss-health-bar');hp.max=b.maxHealth;hp.value=Math.max(0,b.health);
    text('boss-health-number',`${Math.max(0,Math.ceil(b.health))} / ${b.maxHealth}`);text('boss-phase',`${copy.phase} ${String(b.phase).padStart(2,'0')}`);text('boss-phase-note',b.phase===2?copy.phaseTwo:copy.phaseOne);
    const playerHealth=Math.max(0,Math.ceil(snapshot.playerHealth));text('boss-player-health',String(playerHealth));get<HTMLProgressElement>('boss-player-bar').value=playerHealth;
    root.classList.toggle('boss-low-health',playerHealth<=30);root.classList.toggle('boss-phase-two',b.phase===2);
    const active=b.stage==='windup'||b.stage==='execute';
    const attackName=b.stage==='intro'?copy.attackIntro:b.stage==='defeated'?copy.won:active?copy[b.attack]:b.stage==='recover'?copy.recovery:copy.idle;
    const attackHint=b.stage==='intro'?copy.attackIntroHint:b.stage==='defeated'?copy.wonHint:active?copy[`${b.attack}Hint`]:b.stage==='recover'?copy.recoveryHint:copy.idleHint;
    text('boss-attack-name',attackName);text('boss-attack-hint',attackHint);root.dataset.attack=active?b.attack:'none';root.dataset.stage=b.stage;
    root.style.setProperty('--boss-warning-progress',String(b.stage==='windup'?Math.max(0,Math.min(1,b.elapsed/(b.duration||1))):0));
    if(snapshot.hits>lastHits)hitUntil=snapshot.elapsed+.14;
    if(snapshot.playerHealth<lastHealth)damageUntil=snapshot.elapsed+.45;
    lastHits=snapshot.hits;lastHealth=snapshot.playerHealth;
    root.classList.toggle('boss-confirm-hit',snapshot.elapsed<hitUntil);root.classList.toggle('boss-damage',snapshot.elapsed<damageUntil);
    get('boss-capture-hint').hidden=!fallback||mobile()||Boolean(screen);
  }
  on(get('boss-start'),'click',()=>callbacks.onStart());on(get('boss-retry'),'click',()=>callbacks.onRetry());on(get('boss-return'),'click',()=>callbacks.onReturn());on(get('boss-pause'),'click',()=>callbacks.onPause());on(get('boss-mute'),'click',()=>callbacks.onMute());on(get('boss-dialog-mute'),'click',()=>callbacks.onMute());
  on(get('boss-volume'),'input',()=>{const value=Number(get<HTMLInputElement>('boss-volume').value);text('boss-volume-output',`${Math.round(value/.7*100)}%`);callbacks.onVolume(value);});
  on(get('boss-screen'),'keydown',event=>{
    if(event.key==='Tab'){
      const items=Array.from(get('boss-screen').querySelectorAll<HTMLElement>('button:not([hidden]),input:not([hidden])')).filter(el=>el.getClientRects().length>0);
      if(!items.length)return;
      if(event.shiftKey&&document.activeElement===items[0]){event.preventDefault();items.at(-1)?.focus();}
      else if(!event.shiftKey&&document.activeElement===items.at(-1)){event.preventDefault();items[0].focus();}
    }
    if(event.key==='Escape'&&screen==='pause'){event.preventDefault();event.stopPropagation();callbacks.onStart();}
  });
  const stick=get('boss-stick'),knob=stick.querySelector<HTMLElement>('.boss-stick-knob')!;
  let stickPointer:number|null=null;
  const moveStick=(e:PointerEvent)=>{const r=stick.getBoundingClientRect(),radius=r.width*.34;let x=(e.clientX-r.left-r.width/2)/radius,z=-(e.clientY-r.top-r.height/2)/radius;const length=Math.max(1,Math.hypot(x,z));x/=length;z/=length;knob.style.transform=`translate(${x*radius}px,${-z*radius}px)`;callbacks.onTouchMove(x,z);};
  on(stick,'pointerdown',e=>{if(screen||stickPointer!==null)return;e.preventDefault();e.stopPropagation();stickPointer=e.pointerId;stick.setPointerCapture(e.pointerId);moveStick(e);});
  on(stick,'pointermove',e=>{if(e.pointerId===stickPointer){e.preventDefault();moveStick(e);}});
  const endStick=(e:PointerEvent)=>{if(e.pointerId!==stickPointer)return;stickPointer=null;knob.style.transform='translate(0,0)';callbacks.onTouchMove(0,0);};
  on(stick,'pointerup',endStick);on(stick,'pointercancel',endStick);on(stick,'lostpointercapture',endStick);
  const aim=get('boss-aim-zone');let aimPointer:number|null=null,aimX=0,aimY=0;
  on(aim,'pointerdown',e=>{if(screen||aimPointer!==null)return;e.preventDefault();e.stopPropagation();aimPointer=e.pointerId;aimX=e.clientX;aimY=e.clientY;aim.setPointerCapture(e.pointerId);});
  on(aim,'pointermove',e=>{if(e.pointerId!==aimPointer)return;e.preventDefault();callbacks.onTouchLook((e.clientX-aimX)*1.5,(e.clientY-aimY)*1.5);aimX=e.clientX;aimY=e.clientY;});
  const endAim=(e:PointerEvent)=>{if(e.pointerId===aimPointer)aimPointer=null;};on(aim,'pointerup',endAim);on(aim,'pointercancel',endAim);on(aim,'lostpointercapture',endAim);
  function holdButton(id:string,callback:(held:boolean)=>void){
    const button=get(id);let pointer:number|null=null;
    on(button,'pointerdown',e=>{if(screen||pointer!==null)return;e.preventDefault();e.stopPropagation();pointer=e.pointerId;button.setPointerCapture(e.pointerId);button.classList.add('boss-held');callback(true);});
    const end=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;pointer=null;button.classList.remove('boss-held');callback(false);};
    on(button,'pointerup',end);on(button,'pointercancel',end);on(button,'lostpointercapture',end);
    on(button,'keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat&&!screen){e.preventDefault();callback(true);}});on(button,'keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();callback(false);}});
  }
  holdButton('boss-touch-fire',active=>callbacks.onTouchFire(active));holdButton('boss-touch-slide',active=>callbacks.onTouchSlide(active));holdButton('boss-touch-jump',active=>{if(active)callbacks.onTouchJump();});
  for(const [id,action] of Object.entries({'boss-start':'start','boss-retry':'retry','boss-return':'return','boss-pause':'pause','boss-mute':'mute'}))get(id).dataset.action=action;
  translate();showScreen('ready');
  return {
    setLanguage(next){lang=next;translate();},
    update(snapshot){lastSnapshot=snapshot;renderSnapshot(snapshot);},
    showScreen,hideScreen,
    setMuted(value){muted=value;setMuteLabel();},
    setLockFallback(value){fallback=value;get('boss-capture-hint').hidden=!value||mobile()||Boolean(screen);},
    destroy(){listeners.forEach(remove=>remove());callbacks.onTouchMove(0,0);callbacks.onTouchFire(false);callbacks.onTouchSlide(false);root.remove();},
  };
}
