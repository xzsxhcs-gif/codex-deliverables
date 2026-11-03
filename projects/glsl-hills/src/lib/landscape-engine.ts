import * as THREE from 'three';
import vertexShader from '@/lib/shaders/terrain-vertex.glsl?raw';
import fragmentShader from '@/lib/shaders/terrain-fragment.glsl?raw';
import { PRESETS, type LandscapeSettings, type Quality } from '@/lib/landscape-presets';

export interface EngineOptions extends LandscapeSettings {
  cameraZ: number;
  planeSize: number;
  quality: Quality;
  reducedMotion: boolean;
}

export interface LandscapeDiagnostics {
  time: number;
  frames: number;
  width: number;
  height: number;
  pixelRatio: number;
  segments: number;
  tier: string;
  drawCalls: number;
  camera: { yaw: number; pitch: number; distance: number };
  paused: boolean;
  speed: number;
  rendererId: number;
}

export interface LandscapeEngine {
  update(options: Partial<EngineOptions>): void;
  resetView(): void;
  getDiagnostics(): LandscapeDiagnostics;
  dispose(): void;
}

type Tier = 'high' | 'medium' | 'low';
type Orbit = { yaw: number; pitch: number; distance: number };
type Contact = { x: number; y: number };
const SEGMENTS: Record<Tier, number> = { high: 192, medium: 128, low: 96 };
const liveStats = { activeEngines: 0, activeLoops: 0, activeObservers: 0 };
let nextRendererId = 1;

export function getLiveLandscapeStats(): typeof liveStats {
  return { ...liveStats };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const finite = (value: number, fallback: number, min: number, max: number) =>
  Number.isFinite(value) ? clamp(value, min, max) : fallback;
const asError = (error: unknown) => error instanceof Error ? error : new Error(String(error));

export function createLandscapeEngine(
  container: HTMLElement,
  initial: EngineOptions,
  hooks: { onReady: () => void; onError: (error: Error) => void },
): LandscapeEngine {
  let options = { ...initial };
  let renderer: THREE.WebGLRenderer | undefined;
  let geometry: THREE.PlaneGeometry | undefined;
  let material: THREE.ShaderMaterial | undefined;
  let mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial> | undefined;
  let disposed = false;
  let registered = false;
  let ready = false;
  let rafId: number | null = null;
  let lastTimestamp: number | null = null;
  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let frames = 0;
  let elapsed = 0;
  let drawCalls = 0;
  let onScreen = true;
  let geometrySize = initial.planeSize;
  let slowSeconds = 0;
  let sampleFrames = 0;
  let qualityCooldownUntil = performance.now() + 3000;
  const rendererId = nextRendererId++;
  const cleanups: Array<() => void> = [];
  const contacts = new Map<number, Contact>();
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const chooseTier = (quality: Quality): Tier => quality === 'auto'
    ? (coarse ? 'medium' : 'high')
    : quality;
  let tier = chooseTier(options.quality);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 10000);
  const lookAt = new THREE.Vector3(0, 0, -18);
  const baseOrbit = (): Orbit => ({
    yaw: 0,
    pitch: Math.atan2(65, options.cameraZ - lookAt.z),
    distance: Math.hypot(65, options.cameraZ - lookAt.z),
  });
  let target = baseOrbit();
  const current = { ...target };
  let parallaxYaw = 0;
  let parallaxPitch = 0;
  const palette = PRESETS[options.theme];
  const background = new THREE.Color(palette.background);
  const desired = {
    background: new THREE.Color(palette.background),
    base: new THREE.Color(palette.base),
    peak: new THREE.Color(palette.peak),
    key: new THREE.Color(palette.key),
    fill: new THREE.Color(palette.fill),
    fog: new THREE.Color(palette.fog),
  };
  const uniforms = {
    uTime: { value: 0 },
    uAmplitude: { value: options.terrainHeight },
    uFineDetail: { value: options.detail },
    uPlaneSize: { value: options.planeSize },
    uBaseColor: { value: new THREE.Color(palette.base) },
    uPeakColor: { value: new THREE.Color(palette.peak) },
    uKeyColor: { value: new THREE.Color(palette.key) },
    uFillColor: { value: new THREE.Color(palette.fill) },
    uFogColor: { value: new THREE.Color(palette.fog) },
    uFogDensity: { value: palette.fogDensity },
  };
  const colorPairs: Array<[THREE.Color, THREE.Color]> = [
    [background, desired.background], [uniforms.uBaseColor.value, desired.base],
    [uniforms.uPeakColor.value, desired.peak], [uniforms.uKeyColor.value, desired.key],
    [uniforms.uFillColor.value, desired.fill], [uniforms.uFogColor.value, desired.fog],
  ];

  function cancelFrame() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
      liveStats.activeLoops--;
    }
    lastTimestamp = null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelFrame();
    for (const cleanup of cleanups.splice(0)) cleanup();
    contacts.clear();
    geometry?.dispose();
    material?.dispose();
    scene.clear();
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
    if (registered) {
      liveStats.activeEngines--;
      registered = false;
    }
  }

  function fail(error: unknown) {
    if (disposed) return;
    dispose();
    hooks.onError(asError(error));
  }

  function canRender() {
    return !disposed && !document.hidden && onScreen && width > 0 && height > 0;
  }

  function schedule() {
    if (rafId !== null || !canRender()) return;
    rafId = requestAnimationFrame(frame);
    liveStats.activeLoops++;
  }

  function listen(
    element: EventTarget,
    type: string,
    listener: EventListener,
    listenerOptions?: AddEventListenerOptions,
  ) {
    element.addEventListener(type, listener, listenerOptions);
    cleanups.push(() => element.removeEventListener(type, listener, listenerOptions));
  }

  function resize() {
    if (disposed || !renderer) return;
    const nextWidth = Math.max(0, container.clientWidth);
    const nextHeight = Math.max(0, container.clientHeight);
    const cap = tier === 'low' ? 1.25 : tier === 'medium' ? 1.5 : coarse ? 1.5 : 1.75;
    const nextRatio = Math.min(window.devicePixelRatio || 1, cap);
    if (nextWidth === width && nextHeight === height && nextRatio === pixelRatio) return;
    width = nextWidth;
    height = nextHeight;
    pixelRatio = nextRatio;
    if (width === 0 || height === 0) {
      cancelFrame();
      return;
    }
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    schedule();
  }

  function changeTier(next: Tier) {
    if (next === tier || !mesh) return;
    const previous = geometry;
    geometry = new THREE.PlaneGeometry(options.planeSize, options.planeSize, SEGMENTS[next], SEGMENTS[next]);
    geometry.rotateX(-Math.PI / 2);
    geometrySize = options.planeSize;
    mesh.geometry = geometry;
    previous?.dispose();
    tier = next;
    slowSeconds = 0;
    sampleFrames = 0;
    qualityCooldownUntil = performance.now() + 6000;
    resize();
  }

  function clampOrbit() {
    const base = baseOrbit();
    target.yaw = clamp(target.yaw, -0.4, 0.4);
    target.pitch = clamp(target.pitch, 0.3, 0.75);
    target.distance = clamp(target.distance, base.distance * 0.72, base.distance * 1.4);
  }

  function approach(value: number, goal: number, blend: number, epsilon = 0.0001) {
    return Math.abs(value - goal) < epsilon ? goal : THREE.MathUtils.lerp(value, goal, blend);
  }

  function frame(timestamp: number) {
    rafId = null;
    liveStats.activeLoops--;
    if (!canRender() || !renderer) { lastTimestamp = null; return; }
    const rawDelta = lastTimestamp === null ? 0 : Math.max(0, (timestamp - lastTimestamp) / 1000);
    const delta = Math.min(rawDelta, 0.1);
    lastTimestamp = timestamp;
    const moving = !options.paused && options.speed > 0;
    if (moving) elapsed += delta * options.speed;
    uniforms.uTime.value = elapsed;
    const blend = 1 - Math.exp(-Math.max(delta, 1 / 120) * 7.5);
    const goalYaw = clamp(target.yaw + parallaxYaw, -0.4, 0.4);
    const goalPitch = clamp(target.pitch + parallaxPitch, 0.3, 0.75);
    current.yaw = approach(current.yaw, goalYaw, blend);
    current.pitch = approach(current.pitch, goalPitch, blend);
    current.distance = approach(current.distance, target.distance, blend, 0.005);
    uniforms.uAmplitude.value = approach(uniforms.uAmplitude.value, options.terrainHeight, blend);
    uniforms.uFineDetail.value = approach(uniforms.uFineDetail.value, options.detail, blend);
    uniforms.uFogDensity.value = approach(uniforms.uFogDensity.value, PRESETS[options.theme].fogDensity, blend, 0.000001);
    let settling = current.yaw !== goalYaw || current.pitch !== goalPitch || current.distance !== target.distance
      || uniforms.uAmplitude.value !== options.terrainHeight || uniforms.uFineDetail.value !== options.detail
      || uniforms.uFogDensity.value !== PRESETS[options.theme].fogDensity;
    for (const [color, goal] of colorPairs) {
      const difference = Math.abs(color.r - goal.r) + Math.abs(color.g - goal.g) + Math.abs(color.b - goal.b);
      if (difference < 0.0001) color.copy(goal);
      else { color.lerp(goal, blend); settling = true; }
    }
    const horizontal = Math.cos(current.pitch) * current.distance;
    camera.position.set(
      Math.sin(current.yaw) * horizontal,
      Math.max(Math.sin(current.pitch) * current.distance, uniforms.uAmplitude.value * 24 + 12),
      lookAt.z + Math.cos(current.yaw) * horizontal,
    );
    camera.lookAt(lookAt);
    try {
      renderer.setClearColor(background, 1);
      renderer.render(scene, camera);
      drawCalls = renderer.info.render.calls;
      frames++;
      if (!ready) { ready = true; hooks.onReady(); }
    } catch (error) { fail(error); return; }
    if (disposed) return;
    if (moving && options.quality === 'auto' && rawDelta > 0 && rawDelta < 1) {
      sampleFrames++;
      slowSeconds = rawDelta > 1 / 38 ? slowSeconds + rawDelta : Math.max(0, slowSeconds - rawDelta * 0.6);
      if (sampleFrames >= 30 && slowSeconds > 1.5 && timestamp > qualityCooldownUntil) {
        if (tier === 'high') changeTier('medium');
        else if (tier === 'medium') changeTier('low');
      }
    }
    if (moving || settling) schedule();
    else lastTimestamp = null;
  }

  function resetView() {
    if (disposed) return;
    target = baseOrbit();
    parallaxYaw = 0;
    parallaxPitch = 0;
    schedule();
  }

  function update(next: Partial<EngineOptions>) {
    if (disposed) return;
    const previous = options;
    options = { ...options, ...next };
    options.cameraZ = finite(options.cameraZ, previous.cameraZ, 40, 2000);
    options.planeSize = finite(options.planeSize, previous.planeSize, 16, 4096);
    options.speed = finite(options.speed, previous.speed, 0, 1.5);
    options.terrainHeight = finite(options.terrainHeight, previous.terrainHeight, 0.35, 1.7);
    options.detail = finite(options.detail, previous.detail, 0, 1.5);
    if (options.cameraZ !== previous.cameraZ) {
      const ratio = baseOrbit().distance / Math.hypot(65, previous.cameraZ - lookAt.z);
      target.distance *= ratio;
      target.pitch = baseOrbit().pitch;
      clampOrbit();
    }
    if (options.planeSize !== geometrySize && geometry) {
      // Keep the grid allocation stable when only the physical extent changes.
      const positions = geometry.getAttribute('position');
      const scale = options.planeSize / geometrySize;
      for (let i = 0; i < positions.count; i++) {
        positions.setX(i, positions.getX(i) * scale);
        positions.setZ(i, positions.getZ(i) * scale);
      }
      positions.needsUpdate = true;
      geometry.computeBoundingSphere();
      geometrySize = options.planeSize;
      uniforms.uPlaneSize.value = options.planeSize;
    }
    if (options.quality !== previous.quality) changeTier(chooseTier(options.quality));
    if (options.theme !== previous.theme) {
      const nextPalette = PRESETS[options.theme];
      desired.background.set(nextPalette.background);
      desired.base.set(nextPalette.base);
      desired.peak.set(nextPalette.peak);
      desired.key.set(nextPalette.key);
      desired.fill.set(nextPalette.fill);
      desired.fog.set(nextPalette.fog);
    }
    if (options.reducedMotion) { parallaxYaw = 0; parallaxPitch = 0; }
    if (previous.paused !== options.paused || previous.speed !== options.speed) lastTimestamp = null;
    schedule();
  }

  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.debug.checkShaderErrors = true;
    renderer.debug.onShaderError = (gl, program, vertex, fragment) => {
      throw new Error(`The landscape shader could not compile. ${gl.getProgramInfoLog(program) ?? ''} ${gl.getShaderInfoLog(vertex) ?? ''} ${gl.getShaderInfoLog(fragment) ?? ''}`);
    };
    const canvas = renderer.domElement;
    canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline-offset:-4px;';
    canvas.setAttribute('aria-label', 'Interactive mountain landscape. Drag to orbit, scroll to zoom. Arrow keys move the view; R resets it.');
    canvas.setAttribute('role', 'img');
    canvas.tabIndex = 0;
    container.appendChild(canvas);
    geometry = new THREE.PlaneGeometry(options.planeSize, options.planeSize, SEGMENTS[tier], SEGMENTS[tier]);
    geometry.rotateX(-Math.PI / 2);
    material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms, side: THREE.FrontSide });
    mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    scene.add(mesh);
    liveStats.activeEngines++;
    registered = true;

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(resize);
      observer.observe(container);
      liveStats.activeObservers++;
      cleanups.push(() => { observer.disconnect(); liveStats.activeObservers--; });
    }
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(entries => {
        const entry = entries[entries.length - 1];
        if (!entry || disposed) return;
        onScreen = entry.isIntersecting;
        cancelFrame();
        if (onScreen) schedule();
      }, { threshold: 0 });
      observer.observe(container);
      liveStats.activeObservers++;
      cleanups.push(() => { observer.disconnect(); liveStats.activeObservers--; });
    }
    listen(document, 'visibilitychange', () => { cancelFrame(); if (!document.hidden) schedule(); });
    listen(window, 'resize', resize);
    listen(canvas, 'webglcontextlost', event => {
      event.preventDefault();
      if (disposed) return;
      try { renderer?.forceContextRestore(); } catch { /* Restoration is browser controlled. */ }
      fail(new Error('The graphics context was interrupted. Reload to restore the landscape.'));
    });
    const pinchSpan = () => {
      const pair = Array.from(contacts.values());
      return pair.length < 2 ? 0 : Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
    };
    listen(canvas, 'pointerdown', event => {
      const pointer = event as PointerEvent;
      if (pointer.pointerType === 'mouse' && pointer.button !== 0) return;
      pointer.preventDefault();
      contacts.set(pointer.pointerId, { x: pointer.clientX, y: pointer.clientY });
      canvas.setPointerCapture(pointer.pointerId);
      canvas.focus({ preventScroll: true });
      parallaxYaw = 0;
      parallaxPitch = 0;
      canvas.style.cursor = 'grabbing';
      schedule();
    });
    listen(canvas, 'pointermove', event => {
      const pointer = event as PointerEvent;
      const previous = contacts.get(pointer.pointerId);
      if (previous) {
        pointer.preventDefault();
        const oldSpan = pinchSpan();
        contacts.set(pointer.pointerId, { x: pointer.clientX, y: pointer.clientY });
        if (contacts.size >= 2) {
          const newSpan = pinchSpan();
          if (oldSpan > 0 && newSpan > 0) target.distance *= oldSpan / newSpan;
        } else {
          target.yaw -= (pointer.clientX - previous.x) / Math.max(width, 1) * 0.85;
          target.pitch += (pointer.clientY - previous.y) / Math.max(height, 1) * 0.55;
        }
        clampOrbit();
      } else if (pointer.pointerType === 'mouse' && contacts.size === 0 && !options.reducedMotion) {
        const bounds = canvas.getBoundingClientRect();
        parallaxYaw = clamp(((pointer.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5) * 0.06, -0.03, 0.03);
        parallaxPitch = clamp(((pointer.clientY - bounds.top) / Math.max(bounds.height, 1) - 0.5) * 0.024, -0.012, 0.012);
      } else return;
      schedule();
    }, { passive: false });
    const releaseContact: EventListener = event => {
      const pointer = event as PointerEvent;
      contacts.delete(pointer.pointerId);
      if (canvas.hasPointerCapture(pointer.pointerId)) canvas.releasePointerCapture(pointer.pointerId);
      canvas.style.cursor = 'grab';
      schedule();
    };
    listen(canvas, 'pointerup', releaseContact);
    listen(canvas, 'pointercancel', releaseContact);
    listen(canvas, 'lostpointercapture', event => {
      contacts.delete((event as PointerEvent).pointerId);
      canvas.style.cursor = 'grab';
    });
    listen(canvas, 'pointerleave', () => {
      if (contacts.size) return;
      parallaxYaw = 0;
      parallaxPitch = 0;
      schedule();
    });
    listen(canvas, 'wheel', event => {
      const wheel = event as WheelEvent;
      wheel.preventDefault();
      const unit = wheel.deltaMode === 1 ? 16 : wheel.deltaMode === 2 ? height : 1;
      target.distance *= Math.exp(clamp(wheel.deltaY * unit, -300, 300) * 0.001);
      clampOrbit();
      schedule();
    }, { passive: false });
    listen(canvas, 'keydown', event => {
      const key = event as KeyboardEvent;
      switch (key.key) {
        case 'ArrowLeft': target.yaw -= 0.04; break;
        case 'ArrowRight': target.yaw += 0.04; break;
        case 'ArrowUp': target.pitch -= 0.035; break;
        case 'ArrowDown': target.pitch += 0.035; break;
        case '+': case '=': target.distance *= 0.94; break;
        case '-': target.distance *= 1.06; break;
        case 'r': case 'R': case 'Home': resetView(); break;
        default: return;
      }
      key.preventDefault();
      clampOrbit();
      schedule();
    });
    canvas.style.cursor = 'grab';
    resize();
    schedule();
  } catch (error) {
    dispose();
    throw asError(error);
  }

  return {
    update,
    resetView,
    dispose,
    getDiagnostics: () => {
      const offset = camera.position.clone().sub(lookAt);
      return {
        time: elapsed, frames, width, height, pixelRatio, segments: SEGMENTS[tier], tier, drawCalls,
        camera: {
          yaw: Math.atan2(offset.x, offset.z),
          pitch: Math.atan2(offset.y, Math.hypot(offset.x, offset.z)),
          distance: offset.length(),
        },
        paused: options.paused || options.speed === 0,
        speed: options.speed,
        rendererId,
      };
    },
  };
}
