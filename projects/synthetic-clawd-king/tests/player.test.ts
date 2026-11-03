import test from 'node:test';
import assert from 'node:assert/strict';
import { PlayerController } from '../src/battle/player';
import type { MoveInput } from '../src/battle/types';

const idle: MoveInput = { x: 0, z: 0, sprint: false, crouch: false, jump: false };
const sprint: MoveInput = { ...idle, z: 1, sprint: true };
function run(p: PlayerController, seconds: number, input: MoveInput, hz = 120) {
  for (let i = 0; i < Math.round(seconds * hz); i++) p.update(1 / hz, input);
}

test('forward movement, acceleration, diagonal limit and friction use real world axes', () => {
  const p = new PlayerController();
  run(p, 1, { ...idle, z: 1 });
  assert.ok(p.state.z < 10 && Math.abs(p.state.x) < 1e-6);
  assert.ok(Math.abs(p.state.speed - 5.8) < 1e-6);
  const diagonal = new PlayerController();
  run(diagonal, 1, { ...idle, x: 1, z: 1 });
  assert.ok(Math.abs(diagonal.state.speed - 5.8) < 1e-6);
  run(p, 0.4, idle);
  assert.equal(p.state.speed, 0);
});

test('fixed steps produce matching positions at 30/60/144 Hz', () => {
  const states = [30, 60, 144].map(hz => {
    const p = new PlayerController();
    run(p, 1.5, sprint, hz);
    return p.state;
  });
  for (const s of states.slice(1)) {
    assert.ok(Math.abs(s.z - states[0].z) < 1e-8);
    assert.ok(Math.abs(s.speed - states[0].speed) < 1e-8);
  }
});

test('a jump pressed just before landing is buffered and fires after landing', () => {
  const p = new PlayerController();
  p.teleport(0, 0.03, 0);
  p.state.vy = -1;
  p.update(1 / 120, { ...idle, jump: true });
  run(p, 0.08, idle);
  assert.ok(p.state.y > 0.1);
  assert.ok(p.state.vy > 0);
});

test('jump edge survives a frame shorter than a fixed physics step', () => {
  const p = new PlayerController();
  p.update(1 / 500, { ...idle, jump: true });
  p.update(1 / 120, idle);
  assert.ok(p.state.vy > 0);
});

test('coyote time allows jumping just after running off a platform edge', () => {
  const p = new PlayerController([{ x: 0, z: 0, halfX: 0.6, halfZ: 2, height: 1 }]);
  p.teleport(0, 1.001, 0);
  run(p, 0.1, idle);
  assert.equal(p.state.grounded, true);
  p.state.vx = 9.5;
  for (let i = 0; i < 30 && p.state.grounded; i++) p.update(1 / 120, { ...sprint, x: 1, z: 0 });
  assert.equal(p.state.grounded, false);
  p.update(1 / 120, { ...idle, jump: true });
  assert.ok(p.state.vy > 7);
});

test('slide inherits sprint momentum and slide jump keeps it without held sprint', () => {
  const p = new PlayerController();
  run(p, 0.5, sprint);
  const speed = p.state.speed;
  p.update(1 / 120, { ...sprint, crouch: true });
  assert.equal(p.state.sliding, true);
  assert.ok(p.state.speed > speed - 0.1);
  p.update(1 / 120, { ...idle, crouch: true, jump: true });
  assert.ok(!p.state.grounded && !p.state.sliding && p.state.vy > 0);
  const airborne = p.state.speed;
  run(p, 0.2, idle);
  assert.ok(p.state.speed >= airborne - 1e-6);
});

test('crouch is temporary and running slide expires without getting stuck', () => {
  const p = new PlayerController();
  run(p, 0.5, sprint);
  run(p, 1, { ...sprint, crouch: true });
  assert.equal(p.state.sliding, false);
  assert.equal(p.state.crouching, true);
  run(p, 0.2, idle);
  assert.equal(p.state.crouching, false);
});

test('thin obstacle blocks even externally applied high velocity without tunnelling', () => {
  const p = new PlayerController([{ x: 0, z: 0, halfX: 3, halfZ: 0.025, height: 4 }]);
  p.teleport(0, 0, 2);
  p.state.vz = -200;
  p.update(0.1, { ...idle, z: 1 });
  assert.ok(p.state.z >= 0.025 + 0.42 - 1e-5);
  assert.ok(p.state.vz >= -1e-6);
});

test('player can jump onto low platforms and becomes grounded on their top', () => {
  const p = new PlayerController([{ x: 0, z: 0, halfX: 2, halfZ: 2, height: 0.8 }]);
  p.teleport(0, 1.5, 0);
  run(p, 0.7, idle);
  assert.ok(Math.abs(p.state.y - 0.8) < 1e-6);
  assert.equal(p.state.grounded, true);
});

test('arena collision contains the player and permits tangential movement', () => {
  const p = new PlayerController([], 24);
  p.teleport(23.3, 0, 0);
  run(p, 2, { ...idle, x: 1, z: 1, sprint: true });
  assert.ok(Math.hypot(p.state.x, p.state.z) <= 24 - 0.42 + 1e-5);
  assert.ok(p.state.z < -5);
});

test('wall kick pushes an airborne player away with upward velocity and cooldown', () => {
  const p = new PlayerController([{ x: 0, z: 0, halfX: 1, halfZ: 3, height: 4 }]);
  p.teleport(1.5, 1, 0);
  p.update(1 / 120, { ...idle, jump: true });
  assert.ok(p.state.vx > 6);
  assert.ok(p.state.vy > 6);
  run(p, 0.1, idle);
  const vy = p.state.vy;
  p.update(1 / 120, { ...idle, jump: true });
  assert.ok(p.state.vy < vy);
});

test('mouse look clamps pitch and yaw correctly rotates movement', () => {
  const p = new PlayerController();
  p.look(100, -10000);
  assert.ok(p.state.yaw < 0);
  assert.ok(p.state.pitch <= 1.484);
  p.setOrientation(-Math.PI / 2, 0);
  run(p, 0.5, { ...idle, z: 1 });
  assert.ok(p.state.x > 2 && Math.abs(p.state.z - 15) < 1e-6);
});

test('reset clears transient input, pose, velocity and buffered jumps', () => {
  const p = new PlayerController();
  run(p, 0.5, sprint);
  p.update(1 / 120, { ...sprint, jump: true });
  p.look(300, 200);
  p.reset();
  assert.deepEqual(p.state, { x: 0, y: 0, z: 15, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0,
    grounded: true, sliding: false, crouching: false, speed: 0 });
  run(p, 0.05, idle);
  assert.equal(p.state.y, 0);
});
