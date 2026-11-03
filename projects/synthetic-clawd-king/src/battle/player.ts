import type { MoveInput, Obstacle, PlayerSnapshot, Vec2 } from './types';

const STEP = 1 / 120;
const RADIUS = 0.42;
const GRAVITY = 24;
const JUMP_SPEED = Math.sqrt(2 * GRAVITY * 1.4);
const NO_INPUT: MoveInput = { x: 0, z: 0, sprint: false, crouch: false, jump: false };

/**
 * Browser port of the supplied ParkourMotor's acceleration, gravity, jump buffer,
 * coyote time, crouch, timed slide and wall-kick. The original Unity source remains
 * in reference/. Fixed stepping, swept microsteps, arena collision and preserving
 * slide-jump momentum are additions for this browser encounter.
 */
export class PlayerController {
  public state: PlayerSnapshot = this.initialState();
  private accumulator = 0;
  private time = 0;
  private lastGrounded = -Infinity;
  private jumpPressed = -Infinity;
  private slideTime = 0;
  private wallRunTime = 0;
  private wallCooldown = 0;
  private previousCrouch = false;
  private pendingCrouch = false;
  private airMomentum = false;
  private input: MoveInput = { ...NO_INPUT };

  public constructor(
    private readonly obstacles: Obstacle[] = [],
    private readonly arenaRadius = 24,
  ) {}

  private initialState(): PlayerSnapshot {
    return { x: 0, y: 0, z: 15, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0,
      grounded: true, sliding: false, crouching: false, speed: 0 };
  }

  public reset(): void {
    Object.assign(this.state, this.initialState());
    this.accumulator = 0;
    this.time = 0;
    this.lastGrounded = -Infinity;
    this.jumpPressed = -Infinity;
    this.slideTime = 0;
    this.wallRunTime = 0;
    this.wallCooldown = 0;
    this.previousCrouch = false;
    this.pendingCrouch = false;
    this.airMomentum = false;
    this.input = { ...NO_INPUT };
  }

  /** Mouse deltas are CSS pixels; yaw/pitch use Three.js's default -Z forward. */
  public look(dx: number, dy: number): void {
    this.setOrientation(this.state.yaw - dx * 0.0022, this.state.pitch - dy * 0.0022);
  }

  public setOrientation(yaw: number, pitch: number): void {
    if (Number.isFinite(yaw)) this.state.yaw = yaw;
    if (Number.isFinite(pitch)) this.state.pitch = Math.max(-1.48353, Math.min(1.48353, pitch));
  }

  public teleport(x: number, y: number, z: number): void {
    if (![x, y, z].every(Number.isFinite)) return;
    Object.assign(this.state, { x, y: Math.max(0, y), z, vx: 0, vy: 0, vz: 0,
      speed: 0, grounded: y <= 0, sliding: false });
    this.accumulator = 0;
    this.slideTime = 0;
    this.airMomentum = false;
    this.jumpPressed = -Infinity;
    this.lastGrounded = -Infinity;
    this.resolveHorizontal();
  }

  /** Consumes jump as an edge and retains it across frames shorter than one tick. */
  public update(dt: number, input: MoveInput): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.input = { ...input };
    if (input.jump) this.jumpPressed = this.time;
    if (input.crouch && !this.previousCrouch) this.pendingCrouch = true;
    this.previousCrouch = input.crouch;
    // Returning from a suspended tab must not simulate minutes of missed input.
    this.accumulator += Math.min(dt, 0.25);
    while (this.accumulator + 1e-10 >= STEP) {
      this.tick(STEP);
      this.accumulator -= STEP;
    }
  }

  private tick(dt: number): void {
    const s = this.state;
    const input = this.input;
    this.time += dt;
    const inputLength = Math.max(1, Math.hypot(input.x, input.z));
    const ix = Math.max(-1, Math.min(1, input.x / inputLength));
    const iz = Math.max(-1, Math.min(1, input.z / inputLength));
    const sin = Math.sin(s.yaw), cos = Math.cos(s.yaw);
    const direction = { x: ix * cos - iz * sin, z: -ix * sin - iz * cos };
    const wasGrounded = s.grounded;
    if (!s.grounded && s.sliding) {
      s.sliding = false;
      this.airMomentum = true;
    }
    if (s.grounded) {
      this.lastGrounded = this.time;
      this.wallRunTime = 0;
      this.airMomentum = false;
      if (this.pendingCrouch && Math.hypot(s.vx, s.vz) >= 6) {
        this.slideTime = 0.85;
        // No arbitrary launch impulse: slide inherits precisely the running speed.
        s.sliding = true;
      }
    }
    this.pendingCrouch = false;
    s.crouching = input.crouch || s.sliding || !this.canStand();
    const wall = !s.grounded ? this.nearbyWall() : null;
    if (s.grounded && s.sliding) {
      this.slideTime -= dt;
      this.accelerate(0, 0, 3.5 * dt);
      s.vx += direction.x * 1.92 * dt;
      s.vz += direction.z * 1.92 * dt;
      if (this.slideTime <= 0 || Math.hypot(s.vx, s.vz) < 3.2) s.sliding = false;
    } else if (s.grounded) {
      const speed = s.crouching ? 3.2 : input.sprint ? 9.5 : 5.8;
      this.accelerate(direction.x * speed, direction.z * speed, 34 * dt);
    } else {
      const speed = this.airMomentum ? Math.max(9.5, Math.hypot(s.vx, s.vz)) : input.sprint ? 9.5 : 5.8;
      // Airborne slide jumps retain inertia; steer only when the player asks.
      if (!this.airMomentum || Math.hypot(ix, iz) > 0.01)
        this.accelerate(direction.x * speed, direction.z * speed, (this.airMomentum ? 4 : 12) * dt);
    }

    const jumpBuffered = this.time - this.jumpPressed <= 0.12;
    if (jumpBuffered && (s.grounded || this.time - this.lastGrounded <= 0.1)) {
      this.airMomentum = s.sliding;
      s.vy = JUMP_SPEED;
      s.grounded = false;
      s.sliding = false;
      this.jumpPressed = -Infinity;
      this.lastGrounded = -Infinity;
    } else if (jumpBuffered && wall && this.time >= this.wallCooldown) {
      s.vx = wall.x * 6.5 - sin * 2.275;
      s.vz = wall.z * 6.5 - cos * 2.275;
      s.vy = 7;
      s.sliding = false;
      this.airMomentum = true;
      this.wallCooldown = this.time + 0.35;
      this.wallRunTime = 1.2;
      this.jumpPressed = -Infinity;
    }

    let gravity = GRAVITY;
    if (!s.grounded && wall && input.sprint && s.vy <= 1 &&
        Math.hypot(s.vx, s.vz) >= 4.5 && this.time >= this.wallCooldown && this.wallRunTime < 1.2) {
      this.wallRunTime += dt;
      gravity *= 0.2;
      s.vy = Math.max(s.vy, -2.5);
      // Project motion along the contacted wall, preserving its direction.
      const into = s.vx * wall.x + s.vz * wall.z;
      if (into < 0) { s.vx -= into * wall.x; s.vz -= into * wall.z; }
    }
    if (!s.grounded) s.vy -= gravity * dt;
    else s.vy = 0;

    const microSteps = Math.max(1, Math.ceil(Math.hypot(s.vx, s.vy, s.vz) * dt / 0.18));
    const h = dt / microSteps;
    for (let i = 0; i < microSteps; i++) this.move(h);
    if (!wasGrounded && s.grounded) this.airMomentum = false;
    s.crouching = input.crouch || s.sliding || !this.canStand();
    s.speed = Math.hypot(s.vx, s.vz);
  }

  private accelerate(x: number, z: number, amount: number): void {
    const s = this.state, dx = x - s.vx, dz = z - s.vz;
    const length = Math.hypot(dx, dz);
    if (length <= amount) { s.vx = x; s.vz = z; }
    else { s.vx += dx / length * amount; s.vz += dz / length * amount; }
  }

  private move(dt: number): void {
    const s = this.state, oldY = s.y;
    s.x += s.vx * dt;
    s.z += s.vz * dt;
    s.y += s.vy * dt;
    s.grounded = false;
    // Landing on low plinths works without teleporting through their side walls.
    for (const o of this.obstacles) {
      if (oldY >= o.height - 0.001 && s.y <= o.height && s.vy <= 0 && this.overlapsXZ(o, RADIUS * 0.85)) {
        s.y = o.height;
        s.vy = 0;
        s.grounded = true;
      }
    }
    if (s.y <= 0) { s.y = 0; s.vy = 0; s.grounded = true; }
    this.resolveHorizontal();
  }

  private overlapsXZ(o: Obstacle, radius: number): boolean {
    const s = this.state;
    const cx = Math.max(o.x - o.halfX, Math.min(o.x + o.halfX, s.x));
    const cz = Math.max(o.z - o.halfZ, Math.min(o.z + o.halfZ, s.z));
    return (s.x - cx) ** 2 + (s.z - cz) ** 2 < radius ** 2;
  }

  private canStand(): boolean {
    return !this.obstacles.some(o => o.height > this.state.y + 0.02 && this.overlapsXZ(o, RADIUS - 0.01));
  }

  private resolveHorizontal(): void {
    const s = this.state;
    const bound = Math.max(RADIUS, this.arenaRadius - RADIUS);
    // Repeated constraints also resolve corners formed by multiple colliders.
    for (let pass = 0; pass < 3; pass++) {
      const length = Math.hypot(s.x, s.z);
      if (length > bound) {
        const nx = -s.x / length, nz = -s.z / length;
        s.x = -nx * bound;
        s.z = -nz * bound;
        this.removeIntoWall(nx, nz);
      }
      for (const o of this.obstacles) {
        if (o.height <= s.y + 0.015) continue;
        const closestX = Math.max(o.x - o.halfX, Math.min(o.x + o.halfX, s.x));
        const closestZ = Math.max(o.z - o.halfZ, Math.min(o.z + o.halfZ, s.z));
        const dx = s.x - closestX, dz = s.z - closestZ;
        const d = Math.hypot(dx, dz);
        if (d >= RADIUS) continue;
        let nx: number, nz: number, penetration: number;
        if (d > 1e-8) { nx = dx / d; nz = dz / d; penetration = RADIUS - d; }
        else {
          const faces = [
            { d: s.x - (o.x - o.halfX), x: -1, z: 0 },
            { d: o.x + o.halfX - s.x, x: 1, z: 0 },
            { d: s.z - (o.z - o.halfZ), x: 0, z: -1 },
            { d: o.z + o.halfZ - s.z, x: 0, z: 1 },
          ];
          faces.sort((a, b) => a.d - b.d);
          nx = faces[0].x; nz = faces[0].z; penetration = faces[0].d + RADIUS;
        }
        s.x += nx * (penetration + 1e-6);
        s.z += nz * (penetration + 1e-6);
        this.removeIntoWall(nx, nz);
      }
    }
  }

  private removeIntoWall(nx: number, nz: number): void {
    const s = this.state, into = s.vx * nx + s.vz * nz;
    if (into < 0) { s.vx -= into * nx; s.vz -= into * nz; }
  }

  private nearbyWall(): Vec2 | null {
    const s = this.state;
    const radial = Math.hypot(s.x, s.z);
    if (radial > this.arenaRadius - RADIUS - 0.3) return { x: -s.x / radial, z: -s.z / radial };
    for (const o of this.obstacles) {
      if (o.height < s.y + 0.65) continue;
      const cx = Math.max(o.x - o.halfX, Math.min(o.x + o.halfX, s.x));
      const cz = Math.max(o.z - o.halfZ, Math.min(o.z + o.halfZ, s.z));
      const dx = s.x - cx, dz = s.z - cz, d = Math.hypot(dx, dz);
      if (d > 0.001 && d < RADIUS + 0.3) return { x: dx / d, z: dz / d };
    }
    return null;
  }
}
