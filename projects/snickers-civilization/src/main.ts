import './style.css';
import { renderFilm, DURATION } from './film';
const canvas=document.querySelector<HTMLCanvasElement>('#film')!,ctx=canvas.getContext('2d')!;
const audio=new Audio('/audio/soundtrack.m4a');audio.preload='auto';
const button=document.querySelector<HTMLButtonElement>('#play')!,seek=document.querySelector<HTMLInputElement>('#seek')!,clock=document.querySelector<HTMLOutputElement>('#clock')!,chapter=document.querySelector('#chapter')!;
const param=new URLSearchParams(location.search).get('t');let t=param===null?0:Math.min(DURATION,Math.max(0,Number(param)||0)),playing=false,start=0,anchor=t;
function paint(at:number){t=Math.min(DURATION,Math.max(0,at));renderFilm(ctx,t);seek.value=String(t);clock.value=`${t.toFixed(2)} / 50.00`;chapter.textContent=t<6.4?'00 · 生成':t<16?'01 · 识别':t<32?'02 · 文明':t<44.8?'03 · 回收':'04 · 就一根。';}
function pause(){playing=false;audio.pause();button.textContent='播放';}
async function play(){if(t>=DURATION)t=0;audio.currentTime=t;try{await audio.play();}catch{}anchor=t;start=performance.now();playing=true;button.textContent='暂停';}
button.onclick=()=>playing?pause():void play();document.querySelector<HTMLButtonElement>('#restart')!.onclick=()=>{pause();paint(0);void play();};
seek.oninput=()=>{pause();paint(Number(seek.value));audio.currentTime=t;};
document.querySelector<HTMLAnchorElement>('#capture')!.onclick=e=>{e.preventDefault();const a=document.createElement('a');a.href=canvas.toDataURL('image/png');a.download=`snickers-${t.toFixed(3)}.png`;a.click();};
function loop(now:number){if(playing){paint(!audio.paused&&audio.readyState>=2?audio.currentTime:anchor+(now-start)/1000);if(t>=DURATION)pause();}requestAnimationFrame(loop);}
await document.fonts.load('500 24px FilmSans');await document.fonts.load('800 48px FilmSans');await document.fonts.ready;paint(t);requestAnimationFrame(loop);
Object.assign(window,{film:{ready:true,renderAt:(at:number)=>{pause();paint(at);return canvas;},capturePng:()=>canvas.toDataURL('image/png'),duration:DURATION}});
