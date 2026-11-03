export type Lang = 'en' | 'zh';
export type GameMode = 'MERGING' | 'TRANSITION_TO_BOSS' | 'BOSS_BATTLE' | 'BOSS_DEFEATED' | 'RETURN_TO_MERGING';
export type Vec2 = { x: number; z: number };
export interface Obstacle { x: number; z: number; halfX: number; halfZ: number; height: number }
export interface MoveInput { x: number; z: number; sprint: boolean; crouch: boolean; jump: boolean }
export interface PlayerSnapshot { x: number; y: number; z: number; yaw: number; pitch: number; vx: number; vy: number; vz: number; grounded: boolean; sliding: boolean; crouching: boolean; speed: number }
export type AttackKind = 'charge' | 'slam' | 'barrage';
export type BossStage = 'intro' | 'idle' | 'windup' | 'execute' | 'recover' | 'defeated';
export interface EnemyBubble { id: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; radius: number; life: number }
export interface BossSnapshot {
  x: number; z: number; yaw: number; health: number; maxHealth: number; phase: 1 | 2;
  stage: BossStage; attack: AttackKind; elapsed: number; duration: number;
  target: Vec2; origin: Vec2; warningRadius: number; flash: number; time: number;
}
export type BattleEvent = { type: 'windup' | 'execute' | 'hit' | 'player-hit' | 'phase' | 'victory' | 'shot' | 'bounce'; attack?: AttackKind; x?: number; y?: number; z?: number; damage?: number };
export interface BossModelPose { time: number; stage: BossStage; attack: AttackKind; progress: number; phase: 1 | 2; flash: number; defeat: number }
