import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { BossModelPose } from './types';

export interface KingModel {
  group: THREE.Group;
  animate(pose: BossModelPose): void;
  dispose(): void;
}

/** The original seven-part pixel crab, given volume, rounded corners and a royal crown. */
export function createKing(): KingModel {
  const group = new THREE.Group();
  group.name = 'Clawd King';
  const rig = new THREE.Group();
  group.add(rig);
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const skin = material(0xff7eb6, 0.56);
  const lightSkin = material(0xffa3cf, 0.62);
  const darkSkin = material(0xe85e9d, 0.65);
  const gold = material(0xffd166, 0.33, 0.36);
  const goldSide = material(0xca963b, 0.48, 0.28);
  const ink = material(0x21182a, 0.4);
  const white = material(0xfff4ed, 0.26);
  const ruby = material(0x9e78e3, 0.22, 0.2);
  const skinMaterials = [skin, lightSkin, darkSkin];
  const crownGlow = new THREE.PointLight(0xffd166, 0.5, 12, 2);

  function material(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(m);
    return m;
  }
  function box(parent: THREE.Object3D, dimensions: [number, number, number], position: [number, number, number], mat: THREE.Material, radius = 0.15): THREE.Mesh {
    const g = new RoundedBoxGeometry(...dimensions, 2, Math.min(radius, ...dimensions.map(v => v * 0.4)));
    geometries.add(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function sphere(parent: THREE.Object3D, radius: number, position: [number, number, number], mat: THREE.Material): THREE.Mesh {
    const g = new THREE.SphereGeometry(radius, 12, 8);
    geometries.add(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(...position);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const torso = new THREE.Group();
  torso.position.y = 3.05;
  rig.add(torso);
  box(torso, [4.9, 3.05, 2.55], [0, 0, 0], skin, 0.36);
  // A soft upper lip catches the key light without replacing the original flat-faced silhouette.
  box(torso, [4.45, 0.22, 2.18], [0, 1.38, 0.02], lightSkin, 0.1);
  box(torso, [3.85, 0.45, 2.18], [0, -1.32, 0.02], darkSkin, 0.18);

  const eyes: THREE.Group[] = [];
  const eyelids: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(side * 0.95, 0.35, 1.3);
    torso.add(eye);
    const pupil = box(eye, [0.43, 0.81, 0.17], [0, 0, 0.03], ink, 0.06);
    box(eye, [0.12, 0.17, 0.035], [-0.07, 0.2, 0.13], white, 0.02);
    eyes.push(eye);
    eyelids.push(pupil);
    box(torso, [0.56, 0.13, 0.16], [side * 0.95, 1.0, 1.28], darkSkin, 0.05).rotation.z = side * -0.12;
    box(torso, [0.5, 0.16, 0.035], [side * 1.5, -0.28, 1.31], lightSkin, 0.06);
  }

  const legs: THREE.Group[] = [];
  for (const x of [-1.68, -0.62, 0.62, 1.68]) {
    const leg = new THREE.Group();
    leg.position.set(x, 1.55, 0);
    rig.add(leg);
    box(leg, [0.58, 1.28, 0.83], [0, -0.57, 0], skin, 0.15);
    box(leg, [0.68, 0.38, 1.1], [0, -1.14, 0.12], darkSkin, 0.12);
    legs.push(leg);
  }

  const arms: THREE.Group[] = [];
  const jaws: THREE.Group[][] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 2.3, 3.1, 0);
    rig.add(arm);
    box(arm, [1.05, 0.74, 0.93], [side * 0.38, -0.07, 0], darkSkin, 0.2);
    box(arm, [1.48, 1.25, 1.45], [side * 1.08, 0.12, 0.08], skin, 0.26);
    const pair: THREE.Group[] = [];
    for (const jawSide of [-1, 1]) {
      const jaw = new THREE.Group();
      jaw.position.set(side * 1.42, jawSide * 0.39 + 0.13, 0.06);
      arm.add(jaw);
      box(jaw, [1.35, 0.46, 1.19], [side * 0.39, 0, 0.01], jawSide === 1 ? lightSkin : skin, 0.16);
      box(jaw, [0.38, 0.52, 1.08], [side * 0.91, -jawSide * 0.14, 0.01], skin, 0.12);
      pair.push(jaw);
    }
    arms.push(arm);
    jaws.push(pair);
  }

  const crown = new THREE.Group();
  crown.position.set(0, 4.7, 0);
  rig.add(crown);
  box(crown, [3.35, 0.42, 2.08], [0, 0.18, 0], goldSide, 0.1);
  box(crown, [3.5, 0.24, 2.2], [0, 0.42, 0], gold, 0.08);
  for (const side of [-1, 0, 1]) {
    const height = side === 0 ? 1.18 : 0.85;
    box(crown, [0.5, height, 0.54], [side * 1.22, 0.49 + height / 2, 0.76], gold, 0.08);
    box(crown, [0.5, height * 0.75, 0.5], [side * 1.22, 0.49 + height * 0.375, -0.72], goldSide, 0.08);
    sphere(crown, side === 0 ? 0.16 : 0.125, [side * 1.22, 0.49 + height + 0.05, 0.76], gold);
    const gem = box(crown, [0.29, 0.32, 0.12], [side * 1.18, 0.23, 1.095], ruby, 0.06);
    gem.rotation.z = Math.PI / 4;
  }
  crownGlow.position.set(0, 0.8, 1.4);
  crown.add(crownGlow);

  const smooth = (x: number) => {
    const t = THREE.MathUtils.clamp(x, 0, 1);
    return t * t * (3 - 2 * t);
  };
  let disposed = false;
  return {
    group,
    animate(pose) {
      const t = pose.time;
      const p = THREE.MathUtils.clamp(pose.progress, 0, 1);
      const dead = pose.stage === 'defeated' ? smooth(pose.defeat) : 0;
      const charge = pose.attack === 'charge' && pose.stage === 'execute';
      const chargePrep = pose.attack === 'charge' && pose.stage === 'windup' ? smooth(p) : 0;
      const slamPrep = pose.attack === 'slam' && pose.stage === 'windup' ? smooth(p) : 0;
      const slamExecution = pose.attack === 'slam' && pose.stage === 'execute' ? 1 - smooth(p * 3.6) * 1.22 : 0;
      const slamRecovery = pose.attack === 'slam' && pose.stage === 'recover' ? -(1 - smooth(p)) * 0.22 : 0;
      const barrage = pose.attack === 'barrage' && (pose.stage === 'windup' || pose.stage === 'execute');
      const happyBounce = Math.sin(t * 2.1) * 0.045;
      rig.position.y = happyBounce * (1 - dead) - dead * 1.03;
      rig.rotation.set(-chargePrep * 0.12 - (charge ? 0.12 : 0) + dead * 0.08, 0, dead * -0.13);
      rig.scale.set(1 + dead * 0.06, 1 - dead * 0.15, 1 + dead * 0.035);
      torso.rotation.z = Math.sin(t * 1.7) * 0.012 * (1 - dead);
      const blinkPhase = t % 4.6;
      const blink = blinkPhase > 4.34 && blinkPhase < 4.48 ? 0.12 : 1;
      for (let i = 0; i < eyes.length; i++) {
        eyes[i].scale.y = dead > 0.4 ? 0.15 : blink;
        eyes[i].rotation.z = dead * (i === 0 ? -0.15 : 0.15);
        eyelids[i].scale.y = pose.phase === 2 && dead === 0 ? 0.85 : 1;
      }
      for (let i = 0; i < legs.length; i++) {
        const walk = charge ? Math.sin(t * 22 + i * 1.8) : Math.sin(t * 2 + i * 0.8) * 0.12;
        legs[i].rotation.x = walk * (charge ? 0.48 : 0.11) * (1 - dead);
      }
      for (let i = 0; i < arms.length; i++) {
        const side = i === 0 ? -1 : 1;
        const raised = i === 0 ? slamPrep + slamExecution + slamRecovery : 0;
        arms[i].rotation.z = side * (Math.sin(t * 1.8 + i) * 0.035 + raised * 1.18 + (barrage ? 0.22 : 0) - dead * 0.2);
        arms[i].rotation.x = (charge ? -0.2 : 0) + raised * -0.32 + (barrage ? Math.sin(t * 5 + i) * 0.05 : 0);
        arms[i].position.y = 3.1 - chargePrep * 0.14 - dead * 0.24;
        for (let j = 0; j < 2; j++) {
          const open = (j === 0 ? -1 : 1) * side;
          jaws[i][j].rotation.z = open * (0.07 + (barrage ? 0.17 : 0.05) * (0.5 + Math.sin(t * 3 + i) * 0.5) + chargePrep * 0.15);
        }
      }
      crown.rotation.z = Math.sin(t * 1.3) * 0.009 + dead * 0.14;
      crown.position.y = 4.7 + dead * -0.2;
      crownGlow.intensity = (pose.phase === 2 ? 2.8 : 0.5) * (1 - dead) + dead * 0.7;
      gold.emissive.setHex(0xffc15b);
      gold.emissiveIntensity = pose.phase === 2 ? 0.2 : 0.025;
      for (const m of skinMaterials) {
        m.emissive.setHex(0xffe2ed);
        m.emissiveIntensity = Math.max(0, pose.flash) * 0.9;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      group.removeFromParent();
    },
  };
}
