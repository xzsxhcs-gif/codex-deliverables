import { forwardRef, useEffect, useLayoutEffect, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';
import { createLandscapeEngine, type EngineOptions, type LandscapeDiagnostics, type LandscapeEngine } from '@/lib/landscape-engine';
import { type Theme, type Quality } from '@/lib/landscape-presets';

export interface GLSLHillsProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  cameraZ?: number;
  planeSize?: number;
  speed?: number;
  terrainHeight?: number;
  detail?: number;
  theme?: Theme;
  paused?: boolean;
  quality?: Quality;
  className?: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export interface GLSLHillsHandle {
  resetView(): void;
  getDiagnostics(): LandscapeDiagnostics | null;
}

export const GLSLHills = forwardRef<GLSLHillsHandle, GLSLHillsProps>(function GLSLHills({
  width = '100%', height = '100dvh', cameraZ = 125, planeSize = 256,
  speed = 0.5, terrainHeight = 1, detail = 0.55, theme = 'monochrome',
  paused, quality = 'auto', className, onReady, onError,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LandscapeEngine | null>(null);
  const notifiedErrorRef = useRef(false);
  const callbacksRef = useRef({ onReady, onError });
  const optionsRef = useRef({ cameraZ, planeSize, speed, terrainHeight, detail, theme, paused, quality });
  useLayoutEffect(() => {
    callbacksRef.current = { onReady, onError };
    optionsRef.current = { cameraZ, planeSize, speed, terrainHeight, detail, theme, paused, quality };
  }, [cameraZ, planeSize, speed, terrainHeight, detail, theme, paused, quality, onReady, onError]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useImperativeHandle(ref, () => ({
    resetView: () => engineRef.current?.resetView(),
    getDiagnostics: () => engineRef.current?.getDiagnostics() ?? null,
  }), []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let active = true;
    let failed = false;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const currentOptions = (): EngineOptions => ({
      ...optionsRef.current,
      paused: optionsRef.current.paused ?? motion.matches,
      reducedMotion: motion.matches,
    });
    const handleError = (error: Error) => {
      if (!active || failed) return;
      failed = true;
      engineRef.current?.dispose();
      engineRef.current = null;
      setErrorMessage(error.message);
      setStatus('error');
      if (!notifiedErrorRef.current) {
        notifiedErrorRef.current = true;
        callbacksRef.current.onError?.(error);
      }
    };
    setStatus('loading');
    try {
      engineRef.current = createLandscapeEngine(container, currentOptions(), {
        onReady: () => {
          if (!active || failed) return;
          setStatus('ready');
          callbacksRef.current.onReady?.();
        },
        onError: handleError,
      });
    } catch (error) {
      handleError(error instanceof Error ? error : new Error(String(error)));
    }
    const updateMotion = () => engineRef.current?.update(currentOptions());
    motion.addEventListener('change', updateMotion);
    return () => {
      active = false;
      motion.removeEventListener('change', updateMotion);
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    engineRef.current?.update({
      cameraZ, planeSize, speed, terrainHeight, detail, theme, quality,
      paused: paused ?? reducedMotion, reducedMotion,
    });
  }, [cameraZ, planeSize, speed, terrainHeight, detail, theme, paused, quality]);

  return (
    <div
      ref={containerRef}
      className={className}
      data-landscape-status={status}
      style={{ position: 'relative', overflow: 'hidden', width, height, background: '#111315' }}
    >
      {status === 'loading' && <span className="sr-only" role="status">Preparing the landscape.</span>}
      {status === 'error' && (
        <div className="webgl-fallback" role="status" style={{
          position: 'absolute', inset: 0, display: 'grid', placeContent: 'center', gap: 12,
          padding: 32, textAlign: 'center', color: '#e9e9e7',
          background: 'radial-gradient(ellipse at 50% 100%, #42474b 0%, #1b1e21 42%, #111315 75%)',
        }}>
          <span style={{ fontSize: 13, letterSpacing: '0.16em', textTransform: 'uppercase' }}>A moment of stillness</span>
          <p style={{ margin: 0, maxWidth: 340, fontSize: 14, lineHeight: 1.65, opacity: 0.7 }}>
            The interactive landscape needs WebGL. Try a browser with graphics acceleration enabled.
          </p>
          <span className="sr-only">{errorMessage}</span>
        </div>
      )}
    </div>
  );
});
