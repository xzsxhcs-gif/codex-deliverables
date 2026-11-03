import type { AttackKind, BattleEvent, BossSnapshot, EnemyBubble, Obstacle, PlayerSnapshot, Vec2 } from './types';

const TAU = Math.PI * 2;
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const distance = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.z - b.z);

function segmentDistance(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}

function sphereSweepsPlayer(a: EnemyBubble, oldX: number, oldY: number, oldZ: number, p: PlayerSnapshot): boolean {
  // Our projectile flight is horizontal, so compare its swept segment with the
  // standing/crouching capsule rather than relying on end-point overlap.
  const top = p.y + (p.crouching || p.sliding ? 1.15 : 1.8) - 0.36;
  const closestY = clamp((oldY + a.y) / 2, p.y + 0.36, top);
  const dy = (oldY + a.y) / 2 - closestY;
  const d = segmentDistance(p.x, p.z, oldX, oldZ, a.x, a.z);
  return d * d + dy * dy <= (a.radius + 0.36) ** 2;
}

function pointInObstacle(x: number, y: number, z: number, radius: number, obstacles: Obstacle[]): boolean {
  return obstacles.some(o => y - radius < o.height &&
    x > o.x - o.halfX - radius && x < o.x + o.halfX + radius &&
    z > o.z - o.halfZ - radius && z < o.z + o.halfZ + radius);
}

/** Fixed-step, renderer-independent encounter. All attacks expose their complete
 * warning before a finite execution window; damage is never tied to a render frame. */
export class BossDirector {
  public state!: BossSnapshot;
  public bubbles: EnemyBubble[] = [];
  public playerHealth = 100;
  public events: BattleEvent[] = [];
  public readonly bodyRadius = 2.9;

  private attackIndex = 0;
  private nextBubble = 0;
  private invulnerability = 0;
  private impactDone = false;
  private chargeHit = false;
  private volleyIndex = 0;
  private secondaryVolley = false;
  private aimAngle = 0;
  private readonly pattern: AttackKind[] = ['charge', 'slam', 'barrage', 'slam', 'charge', 'barrage'];

  public constructor(private readonly obstacles: Obstacle[] = []) {
    this.reset();
  }

  public reset(): void {
    this.state = {
      x: 0, z: -6, yaw: 0, health: 1800, maxHealth: 1800, phase: 1,
      stage: 'intro', attack: 'charge', elapsed: 0, duration: 2.5,
      target: { x: 0, z: 8 }, origin: { x: 0, z: -6 }, warningRadius: 3.2, flash: 0, time: 0,
    };
    this.playerHealth = 100;
    this.bubbles.length = 0;
    this.events.length = 0;
    this.attackIndex = this.nextBubble = this.volleyIndex = 0;
    this.invulnerability = 0;
    this.impactDone = this.chargeHit = this.secondaryVolley = false;
    this.aimAngle = 0;
  }

  public damageBoss(amount: number, hit?: { x: number; y: number; z: number }): boolean {
    if (this.state.stage === 'intro' || this.state.stage === 'defeated' || this.playerHealth <= 0 ||
      !Number.isFinite(amount) || amount <= 0) return false;
    this.state.health = Math.max(0, this.state.health - amount);
    this.state.flash = 0.13;
    this.events.push({ type: 'hit', damage: amount, x: hit?.x ?? this.state.x, y: hit?.y ?? 3, z: hit?.z ?? this.state.z });
    if (this.state.health <= 0) {
      this.state.stage = 'defeated';
      this.state.elapsed = 0;
      this.state.duration = 3.2;
      this.bubbles.length = 0;
      this.events.push({ type: 'victory' });
    } else if (this.state.phase === 1 && this.state.health <= this.state.maxHealth * 0.5) {
      this.state.phase = 2;
      this.events.push({ type: 'phase' });
    }
    return true;
  }

  public update(dt: number, player: PlayerSnapshot): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    // Protect collision accuracy even if a host accidentally supplies a long frame.
    let remaining = Math.min(dt, 0.25);
    while (remaining > 1e-7) {
      const h = Math.min(remaining, 1 / 120);
      this.step(h, player);
      remaining -= h;
    }
  }

  private step(dt: number, player: PlayerSnapshot): void {
    const s = this.state;
    s.time += dt;
    s.flash = Math.max(0, s.flash - dt);
    if (s.stage === 'defeated') {
      s.elapsed += dt;
      return;
    }
    if (this.playerHealth <= 0) return;
    this.invulnerability = Math.max(0, this.invulnerability - dt);
    this.advanceBubbles(dt, player);
    s.elapsed += dt;

    if (s.stage === 'intro') {
      if (s.elapsed >= s.duration) this.stage('idle', 0.8);
      return;
    }
    if (s.stage === 'idle') {
      this.face(player, dt * 1.8);
      if (s.elapsed >= s.duration) this.beginAttack(player);
      return;
    }
    if (s.stage === 'windup') {
      if (s.elapsed >= s.duration) this.executeAttack();
      return;
    }
    if (s.stage === 'execute') {
      this.executeStep(dt, player);
      if (s.elapsed >= s.duration) {
        this.stage('recover', s.phase === 1 ? 1.8 : 1.45);
        this.secondaryVolley = false;
      }
      return;
    }
    if (s.stage === 'recover') {
      if (s.phase === 2 && s.attack !== 'barrage' && s.elapsed >= 0.3 && !this.secondaryVolley) {
        this.secondaryVolley = true;
        // Previously aimed fan, not an instant attack at the player's new position.
        this.spawnVolley(1);
      }
      if (s.elapsed >= s.duration) this.stage('idle', s.phase === 1 ? 0.7 : 0.5);
    }
  }

  private stage(stage: BossSnapshot['stage'], duration: number): void {
    this.state.stage = stage;
    this.state.elapsed = 0;
    this.state.duration = duration;
  }

  private face(target: Vec2, factor: number): void {
    const desired = Math.atan2(target.x - this.state.x, target.z - this.state.z);
    const delta = ((desired - this.state.yaw + Math.PI * 3) % TAU) - Math.PI;
    this.state.yaw += delta * Math.min(1, factor);
  }

  private beginAttack(player: PlayerSnapshot): void {
    const s = this.state;
    s.attack = this.pattern[this.attackIndex++ % this.pattern.length];
    s.origin = { x: s.x, z: s.z };
    s.target = { x: player.x, z: player.z };
    this.face(player, 1);
    this.aimAngle = s.yaw;
    this.impactDone = this.chargeHit = false;
    this.volleyIndex = 0;

    if (s.attack === 'charge') {
      const d = distance(s.origin, s.target) || 1;
      const reach = Math.min(d, s.phase === 1 ? 14 : 16);
      s.target = { x: s.x + (player.x - s.x) / d * reach, z: s.z + (player.z - s.z) / d * reach };
      const radial = Math.hypot(s.target.x, s.target.z);
      if (radial > 19.7) {
        s.target.x *= 19.7 / radial;
        s.target.z *= 19.7 / radial;
      }
      // Charge stops before pillars, never cuts straight through solid cover.
      const dx = s.target.x - s.x, dz = s.target.z - s.z;
      const steps = Math.ceil(Math.hypot(dx, dz) / 0.15);
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        if (pointInObstacle(s.x + dx * t, 1, s.z + dz * t, 2.7, this.obstacles)) {
          const safe = Math.max(0, (i - 1) / steps);
          s.target = { x: s.x + dx * safe, z: s.z + dz * safe };
          break;
        }
      }
      s.warningRadius = 3.2;
      this.stage('windup', s.phase === 1 ? 1.25 : 1.05);
    } else if (s.attack === 'slam') {
      // The royal claw projects a magical ground strike: a fixed location, not a
      // homing marker. A jump or leaving the circle entirely avoids the impact.
      s.warningRadius = s.phase === 1 ? 4.1 : 4.5;
      this.stage('windup', s.phase === 1 ? 1.45 : 1.2);
    } else {
      s.warningRadius = 0;
      this.stage('windup', s.phase === 1 ? 1.25 : 1.05);
    }
    this.events.push({ type: 'windup', attack: s.attack, x: s.target.x, z: s.target.z });
  }

  private executeAttack(): void {
    const s = this.state;
    this.stage('execute', s.attack === 'charge' ? (s.phase === 1 ? 1.0 : 0.85) : s.attack === 'slam' ? 0.65 : (s.phase === 1 ? 1.7 : 2.0));
    this.events.push({ type: 'execute', attack: s.attack, x: s.target.x, z: s.target.z });
  }

  private executeStep(_dt: number, player: PlayerSnapshot): void {
    const s = this.state;
    if (s.attack === 'charge') {
      const oldX = s.x, oldZ = s.z;
      const t = clamp(s.elapsed / s.duration, 0, 1);
      const ease = t * t * (3 - 2 * t);
      s.x = s.origin.x + (s.target.x - s.origin.x) * ease;
      s.z = s.origin.z + (s.target.z - s.origin.z) * ease;
      if (!this.chargeHit && player.y < 2.6 && segmentDistance(player.x, player.z, oldX, oldZ, s.x, s.z) < 3.2) {
        if (this.hurtPlayer(22, 'charge')) this.chargeHit = true;
      }
    } else if (s.attack === 'slam') {
      if (!this.impactDone && s.elapsed >= 0.16) {
        this.impactDone = true;
        if (distance(player, s.target) < s.warningRadius + 0.35 && player.y < 0.95)
          this.hurtPlayer(24, 'slam');
      }
    } else {
      const count = s.phase === 1 ? 2 : 3;
      const interval = s.phase === 1 ? 0.75 : 0.65;
      if (this.volleyIndex < count && s.elapsed >= this.volleyIndex * interval) this.spawnVolley(this.volleyIndex++);
    }
  }

  private spawnVolley(variation: number): void {
    const s = this.state;
    const offsets = variation % 2 === 0 ? [-0.96, -0.64, -0.32, 0, 0.32, 0.64, 0.96] : [-0.8, -0.48, -0.16, 0.16, 0.48, 0.8];
    for (const offset of offsets) {
      const angle = this.aimAngle + offset;
      const speed = s.phase === 1 ? 5.9 : 6.6;
      this.bubbles.push({
        id: ++this.nextBubble, x: s.x + Math.sin(angle) * 3.5, y: 1.15,
        z: s.z + Math.cos(angle) * 3.5, vx: Math.sin(angle) * speed, vy: 0,
        vz: Math.cos(angle) * speed, radius: 0.38, life: 7,
      });
    }
  }

  private advanceBubbles(dt: number, player: PlayerSnapshot): void {
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i], oldX = b.x, oldY = b.y, oldZ = b.z;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.life -= dt;
      if (sphereSweepsPlayer(b, oldX, oldY, oldZ, player)) {
        this.hurtPlayer(14, 'barrage');
        this.bubbles.splice(i, 1);
      } else if (b.life <= 0 || Math.hypot(b.x, b.z) > 25.3 ||
        pointInObstacle(b.x, b.y, b.z, b.radius, this.obstacles)) {
        this.bubbles.splice(i, 1);
      }
    }
  }

  private hurtPlayer(damage: number, attack: AttackKind): boolean {
    if (this.invulnerability > 0 || this.playerHealth <= 0 || this.state.stage === 'defeated') return false;
    this.playerHealth = Math.max(0, this.playerHealth - damage);
    this.invulnerability = 1.05;
    this.events.push({ type: 'player-hit', attack, damage });
    return true;
  }
}
