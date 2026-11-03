import type { AttackKind, BattleEvent } from './types';

/** One shared Web Audio context; all battle voices run through a bounded master. */
export class BattleAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private volume = 0.45;
  private lastHit = -100;
  constructor(private getContext: () => AudioContext | null) {}
  unlock() {
    this.context ??= this.getContext();
    if (this.context && !this.master) {
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.context.destination);
    }
    void this.context?.resume().catch(() => {});
  }
  setMuted(muted: boolean) { this.muted = muted; this.applyVolume(); }
  setVolume(volume: number) { this.volume = Math.max(0, Math.min(0.7, volume)); this.applyVolume(); }
  private applyVolume() {
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, .025);
  }
  private note(frequency: number, duration: number, gain: number, type: OscillatorType = 'sine', end = frequency, delay = 0) {
    if (!this.context || !this.master || this.muted) return;
    const c = this.context, t = c.currentTime + delay;
    const oscillator = c.createOscillator(), amp = c.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), t);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + duration);
    amp.gain.setValueAtTime(.0001, t);
    amp.gain.exponentialRampToValueAtTime(Math.max(.0002, gain), t + .008);
    amp.gain.exponentialRampToValueAtTime(.0001, t + duration);
    oscillator.connect(amp); amp.connect(this.master);
    oscillator.start(t); oscillator.stop(t + duration + .04);
    oscillator.onended = () => { oscillator.disconnect(); amp.disconnect(); };
  }
  intro() {
    [130.81, 196, 261.63, 392].forEach((f,i) => this.note(f,.7,.13,'triangle',f,i*.14));
    this.note(70,1.5,.2,'sine',42);
  }
  event(event: BattleEvent) {
    if (event.type === 'shot') { this.note(680,.14,.1,'sine',260); this.note(1200,.08,.035,'triangle',900); }
    if (event.type === 'hit' && this.context && this.context.currentTime - this.lastHit > .065) {
      this.lastHit = this.context.currentTime;
      this.note(980,.09,.11,'triangle',1350);
    }
    if (event.type === 'player-hit') { this.note(110,.24,.3,'triangle',55); this.note(240,.14,.13,'sine',90); }
    if (event.type === 'windup') this.warn(event.attack!);
    if (event.type === 'execute') {
      this.note(event.attack === 'barrage' ? 330 : 90,.36,.22,'triangle',55);
      if (event.attack === 'slam') this.note(55,.6,.3,'sine',28);
    }
    if (event.type === 'phase') [196,233.08,293.66,392].forEach((f,i) => this.note(f,.65,.14,'triangle',f,i*.1));
    if (event.type === 'victory') [261.63,329.63,392,523.25,659.25,783.99].forEach((f,i) => this.note(f,.8,.14,'triangle',f,i*.12));
  }
  private warn(attack: AttackKind) {
    const f = attack === 'charge' ? 196 : attack === 'slam' ? 261.63 : 392;
    for (let i=0;i<3;i++) this.note(f*(i===2?1.5:1),.16,.13,'sine',f,i*.19);
  }
  fade() { if (this.context && this.master) this.master.gain.setTargetAtTime(0,this.context.currentTime,.12); }
  restore() { this.applyVolume(); }
  dispose() { this.master?.disconnect(); this.master = null; }
}
