import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Obstacle } from './types';

export interface Arena {
  group: THREE.Group;
  obstacles: Obstacle[];
  update(time: number, phase: 1 | 2): void;
  dispose(): void;
}

/** A quiet, toy-scale royal courtyard. Gameplay collision uses the same pillar dimensions. */
export function createArena(): Arena {
  const group = new THREE.Group();
  group.name = 'Royal courtyard';
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const accentMeshes: THREE.Mesh[] = [];
  const floor = material(0x514663, 0.93);
  const edge = material(0x443a58, 0.92);
  const stone = material(0x756783, 0.82);
  const pillar = material(0x9c8bae, 0.74);
  const pale = material(0xb2a2bd, 0.7);
  const gold = material(0xd7b779, 0.5, 0.15);
  const inset = material(0x363048, 0.94);
  const glow = material(0xffd699, 0.55);
  glow.emissive.setHex(0xf6bd73);
  glow.emissiveIntensity = 0.2;

  function material(color: number, roughness: number, metalness = 0): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    materials.add(m);
    return m;
  }
  function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, cast = true): THREE.Mesh {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.castShadow = cast;
    object.receiveShadow = true;
    group.add(object);
    return object;
  }
  function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, radius = 0.08): THREE.Mesh {
    return mesh(new RoundedBoxGeometry(w, h, d, 1, Math.min(radius, w * 0.3, h * 0.3, d * 0.3)), mat, x, y, z);
  }

  mesh(new THREE.CylinderGeometry(24.6, 24.8, 0.65, 96), edge, 0, -0.4, 0);
  mesh(new THREE.CircleGeometry(24.05, 96).rotateX(-Math.PI / 2), floor, 0, -0.015, 0, false);
  // Broad inset arcs establish scale without filling the battlefield with editor-like grids.
  for (const radius of [7.2, 15.4, 22.5]) {
    const ring = new THREE.RingGeometry(radius, radius + 0.055, 96).rotateX(-Math.PI / 2);
    mesh(ring, radius === 22.5 ? gold : inset, 0, 0.003, 0, false);
  }
  for (let i = 0; i < 24; i++) {
    const angle = i / 24 * Math.PI * 2;
    const x = Math.sin(angle) * 24.6;
    const z = Math.cos(angle) * 24.6;
    const wall = box(5.8, 2.5, 1.02, stone, x, 1.05, z, 0.12);
    wall.rotation.y = angle;
    const cap = box(5.95, 0.24, 1.25, pale, x, 2.38, z, 0.08);
    cap.rotation.y = angle;
    const seam = box(0.22, 2.8, 1.2, edge, Math.sin(angle + Math.PI / 24) * 24.6, 1.2, Math.cos(angle + Math.PI / 24) * 24.6);
    seam.rotation.y = angle + Math.PI / 24;
    if (i % 3 === 0) {
      const jewel = box(0.42, 0.42, 0.13, gold, Math.sin(angle) * 24.03, 1.48, Math.cos(angle) * 24.03);
      jewel.rotation.y = angle;
      jewel.rotateZ(Math.PI / 4);
    }
  }

  const obstacles: Obstacle[] = [];
  for (const x of [-13, 13]) for (const z of [-7, 7]) {
    obstacles.push({ x, z, halfX: 0.9, halfZ: 0.9, height: 4.2 });
    box(1.8, 4.2, 1.8, pillar, x, 2.1, z, 0.14);
    // Bases sit inside the collision footprint so visual geometry never creates invisible ledges.
    box(1.78, 0.25, 1.78, pale, x, 0.14, z);
    box(1.78, 0.25, 1.78, pale, x, 3.95, z);
    const cap = box(1.5, 0.2, 1.5, gold, x, 4.28, z);
    accentMeshes.push(cap);
    const lantern = mesh(new THREE.OctahedronGeometry(0.29), glow, x, 4.7, z);
    accentMeshes.push(lantern);
  }

  // Distant throne-door silhouette sits outside the playable circle.
  box(1.9, 9.6, 1.9, edge, -4.2, 4.0, -26.2, 0.16);
  box(1.9, 9.6, 1.9, edge, 4.2, 4.0, -26.2, 0.16);
  box(9.2, 1.4, 1.9, stone, 0, 8.25, -26.2, 0.16);
  box(6.6, 0.18, 0.12, gold, 0, 8.16, -25.17, 0.04);
  for (const x of [-1.2, 0, 1.2]) {
    const h = x === 0 ? 1.4 : 1.0;
    box(0.45, h, 0.6, gold, x, 9.0 + h / 2, -26.2, 0.08);
  }
  box(3.7, 0.36, 0.75, gold, 0, 9.06, -26.2);

  const hemi = new THREE.HemisphereLight(0xf3ddff, 0x39304f, 2.15);
  group.add(hemi);
  const key = new THREE.DirectionalLight(0xffe5c9, 3.1);
  key.position.set(-11, 19, 13);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -27;
  key.shadow.camera.right = 27;
  key.shadow.camera.top = 27;
  key.shadow.camera.bottom = -27;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 65;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.04;
  group.add(key);
  const fill = new THREE.DirectionalLight(0xaba9ff, 0.9);
  fill.position.set(12, 10, -14);
  group.add(fill);
  const centerGlow = new THREE.PointLight(0xffa0c8, 7.5, 24, 2);
  centerGlow.position.set(0, 7, -6);
  group.add(centerGlow);

  // Bake only static pieces into material batches; animated lanterns retain their own transforms.
  // Matching shadow flags avoids making floor inlays cast new shadows after batching.
  const animated = new Set<THREE.Object3D>(accentMeshes);
  const batches = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]>();
  for (const child of group.children) {
    if (!(child instanceof THREE.Mesh) || Array.isArray(child.material) || animated.has(child)) continue;
    const id = `${child.material.uuid}:${child.castShadow}:${child.receiveShadow}`;
    const batch = batches.get(id) ?? [];
    batch.push(child);
    batches.set(id, batch);
  }
  for (const batch of batches.values()) {
    if (batch.length < 2) continue;
    const baked = batch.map(object => {
      object.updateMatrix();
      const geometry = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
      geometry.applyMatrix4(object.matrix);
      geometry.clearGroups();
      return geometry;
    });
    const combined = mergeGeometries(baked, false);
    baked.forEach(geometry => geometry.dispose());
    if (!combined) continue;
    const first = batch[0];
    const combinedMesh = new THREE.Mesh(combined, first.material);
    combinedMesh.name = `Static courtyard ${first.material.uuid}`;
    combinedMesh.castShadow = first.castShadow;
    combinedMesh.receiveShadow = first.receiveShadow;
    group.add(combinedMesh);
    geometries.add(combined);
    for (const object of batch) {
      object.removeFromParent();
      object.geometry.dispose();
      geometries.delete(object.geometry);
    }
  }
  let disposed = false;
  return {
    group,
    obstacles,
    update(time, phase) {
      const target = phase === 2 ? 0.6 : 0.2;
      glow.emissiveIntensity = target;
      centerGlow.intensity = phase === 2 ? 12 : 7.5;
      for (let i = 1; i < accentMeshes.length; i += 2) {
        accentMeshes[i].rotation.y = time * 0.3;
        accentMeshes[i].position.y = 4.7 + Math.sin(time * 1.2 + i) * 0.07;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose());
      key.shadow.map?.dispose();
      key.shadow.mapPass?.dispose();
      group.removeFromParent();
    },
  };
}
