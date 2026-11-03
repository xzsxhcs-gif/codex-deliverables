import type { Lang, GameMode } from './battle/types';
import type { BattleSnapshot } from './battle/runtime';
export interface LegacySummary { score:number;best:number;discovered:number;achievements:number;language:Lang;paused:boolean;over:boolean;bodies:Array<{lv:number;x:number;y:number;a:number}> }
export interface ClawdBridge {
 bossActive:boolean;kingslayer:boolean;tick:(dt:number,time:number)=>void;
 language:()=>Lang;isMuted:()=>boolean;audioContext:()=>AudioContext|null;
 setMuted:(muted:boolean)=>void;freeze:()=>void;resume:()=>void;notifyVictory:()=>void;summary:()=>LegacySummary;
 testing?:{seedKingMerge:()=>void;seedOrdinaryMerge:()=>void};
}
declare global {
 interface Window {
  clawd2D:ClawdBridge;
  clawdQA?:{mode:()=>GameMode;runtime:()=>import('./battle/runtime').BattleRuntime|null;advance:(seconds:number)=>void;returnToMerging:()=>void};
 }
}
