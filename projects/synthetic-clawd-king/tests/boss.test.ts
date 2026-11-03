import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BossDirector } from '../src/battle/boss';
import type { PlayerSnapshot } from '../src/battle/types';

const player = (x = 0, z = 15, y = 0): PlayerSnapshot => ({ x, y, z, yaw: 0, pitch: 0, vx: 0, vy: 0, vz: 0, grounded: y === 0, sliding: false, crouching: false, speed: 0 });
function run(b: BossDirector, seconds: number, p = player(22, 0)): void {
  for (let t = 0; t < seconds - 1e-6; t += 1 / 120) b.update(Math.min(1 / 120, seconds - t), p);
}
function until(b: BossDirector, condition: () => boolean, p = player(22, 0), max = 30): void {
  for (let i = 0; i < max * 120; i++) {
    if (condition()) return;
    b.update(1 / 120, p);
  }
  assert.fail('Encounter did not reach expected state');
}

test('introduction is harmless and invulnerable; every attack starts with a readable windup', () => {
  const b = new BossDirector();
  assert.equal(b.damageBoss(100), false);
  run(b, 2.4, player());
  assert.equal(b.playerHealth, 100);
  assert.equal(b.state.stage, 'intro');
  until(b, () => b.state.stage === 'windup', player());
  assert.equal(b.state.attack, 'charge');
  assert.ok(b.state.duration >= 1);
  assert.equal(b.playerHealth, 100);
  assert.ok(b.events.some(e => e.type === 'windup' && e.attack === 'charge'));
});

test('charge endpoint stays fixed after warning; side-stepping avoids swept contact', () => {
  const b = new BossDirector();
  until(b, () => b.state.stage === 'windup', player(0, 10));
  const target = { ...b.state.target };
  run(b, b.state.duration + 1.2, player(10, 10));
  assert.deepEqual(b.state.target, target);
  assert.equal(b.playerHealth, 100);
  assert.ok(b.state.z > -6);
});

test('charge damage is bounded to one hit per attack despite continuous overlap', () => {
  const b = new BossDirector();
  until(b, () => b.state.stage === 'windup', player(0, 8));
  run(b, b.state.duration + 1.1, player(0, 8));
  assert.equal(b.playerHealth, 78);
  assert.equal(b.events.filter(e => e.type === 'player-hit').length, 1);
});

test('slam locks its circle and an airborne player can clear the impact', () => {
  const b = new BossDirector();
  until(b, () => b.state.stage === 'windup' && b.state.attack === 'slam');
  const target = { ...b.state.target };
  assert.ok(b.state.duration >= 1.2);
  run(b, b.state.duration + 0.5, player(target.x, target.z, 1.2));
  assert.equal(b.playerHealth, 100);
  assert.deepEqual(b.state.target, target);
});

test('slam hits once, not once per simulation step', () => {
  const b = new BossDirector();
  until(b, () => b.state.stage === 'windup' && b.state.attack === 'slam');
  const p = player(b.state.target.x, b.state.target.z);
  run(b, b.state.duration + 0.6, p);
  assert.equal(b.playerHealth, 76);
});

test('barrage has alternating separated fans, finite lifetime and no instant telegraph damage', () => {
  const b = new BossDirector();
  until(b, () => b.state.stage === 'windup' && b.state.attack === 'barrage');
  assert.equal(b.bubbles.length, 0);
  run(b, b.state.duration + 0.15);
  assert.equal(b.bubbles.length, 7);
  const angles = b.bubbles.map(p => Math.atan2(p.vx, p.vz)).sort((a, c) => a - c);
  for (let i = 1; i < angles.length; i++) assert.ok(angles[i] - angles[i - 1] > 0.3);
  run(b, 0.8);
  assert.ok(b.bubbles.length >= 10);
  assert.ok(b.bubbles.every(p => Math.hypot(p.vx, p.vz) < 7));
});

test('swept bubble collision cannot tunnel through the player; invulnerability bounds simultaneous hits', () => {
  const b = new BossDirector();
  run(b, 2.6);
  for (let id = 0; id < 8; id++) b.bubbles.push({ id, x: -4, y: 1, z: 0, vx: 100, vy: 0, vz: 0, radius: 0.38, life: 7 });
  b.update(0.1, player(0, 0));
  assert.equal(b.playerHealth, 86);
  assert.equal(b.bubbles.length, 0);
});

test('solid pillars absorb projectiles and truncate a charge path', () => {
  const b = new BossDirector([{ x: 0, z: 0, halfX: 1, halfZ: 1, height: 5 }]);
  until(b, () => b.state.stage === 'windup', player(0, 15));
  assert.ok(b.state.target.z < -3.6);
  b.bubbles.push({ id: 1, x: 0, y: 1, z: -2, vx: 0, vy: 0, vz: 10, radius: 0.38, life: 7 });
  run(b, 0.2, player(15, 15));
  assert.equal(b.bubbles.length, 0);
});

test('phase two is a single threshold event and combines patterns while retaining fair warnings', () => {
  const b = new BossDirector();
  run(b, 2.6);
  assert.equal(b.damageBoss(901), true);
  assert.equal(b.state.phase, 2);
  b.damageBoss(1);
  assert.equal(b.events.filter(e => e.type === 'phase').length, 1);
  until(b, () => b.state.stage === 'recover' && b.state.attack === 'charge');
  run(b, 0.4);
  assert.ok(b.bubbles.length > 0);
  until(b, () => b.state.stage === 'windup');
  assert.ok(b.state.duration >= 1);
});

test('victory is emitted exactly once, clears hazards, and prevents all later damage', () => {
  const b = new BossDirector();
  run(b, 2.6);
  b.bubbles.push({ id: 2, x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0, radius: 1, life: 7 });
  assert.equal(b.damageBoss(b.state.maxHealth), true);
  assert.equal(b.state.stage, 'defeated');
  assert.equal(b.bubbles.length, 0);
  assert.equal(b.damageBoss(1), false);
  run(b, 10, player(0, 0));
  assert.equal(b.playerHealth, 100);
  assert.equal(b.events.filter(e => e.type === 'victory').length, 1);
  assert.equal(b.state.health, 0);
});

test('reset restores the entire encounter without stale projectiles or events', () => {
  const b = new BossDirector();
  run(b, 2.6);
  b.damageBoss(950);
  b.playerHealth = 20;
  b.reset();
  assert.equal(b.state.health, b.state.maxHealth);
  assert.equal(b.playerHealth, 100);
  assert.equal(b.state.phase, 1);
  assert.equal(b.state.stage, 'intro');
  assert.equal(b.events.length, 0);
  assert.equal(b.bubbles.length, 0);
});
