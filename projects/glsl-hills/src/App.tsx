import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Expand, Pause, Play, SlidersHorizontal } from 'lucide-react'
import { GLSLHills, type GLSLHillsHandle } from '@/components/ui/glsl-hills'
import { Button } from '@/components/ui/button'
import { LandscapeControls } from '@/components/landscape/landscape-controls'
import { DEFAULT_SETTINGS, type LandscapeSettings } from '@/lib/landscape-presets'
import type { LandscapeDiagnostics } from '@/lib/landscape-engine'

declare global {
  interface Window {
    __GLSL_HILLS__?: {
      getDiagnostics: () => LandscapeDiagnostics | null
      getSettings: () => LandscapeSettings
    }
  }
}

export default function App() {
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [settings, setSettings] = useState<LandscapeSettings>(() => ({ ...DEFAULT_SETTINGS, paused: reducedMotion }))
  const [panelOpen, setPanelOpen] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const [ready, setReady] = useState(false)
  const [showExitHint, setShowExitHint] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  const hillsRef = useRef<GLSLHillsHandle>(null)
  const settingsButton = useRef<HTMLButtonElement>(null)
  const immersiveButton = useRef<HTMLButtonElement>(null)
  const wasFullscreen = useRef(false)
  const wasImmersive = useRef(false)
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])
  const gesture = useRef({ points: new Map<number, { x: number; y: number }>(), moved: false, multi: false, lastTap: 0, tapX: 0, tapY: 0 })

  const leaveImmersive = useCallback(() => {
    setImmersive(false)
    setShowExitHint(false)
    if (document.fullscreenElement === rootRef.current && document.exitFullscreen) {
      void document.exitFullscreen().catch(() => undefined)
    }
  }, [])

  const enterImmersive = useCallback(() => {
    setPanelOpen(false)
    setImmersive(true)
    setShowExitHint(true)
    wasImmersive.current = true
    const root = rootRef.current
    if (root && typeof root.requestFullscreen === 'function' && document.fullscreenEnabled) {
      // CSS immersion remains active if fullscreen is unsupported or declined.
      void root.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined)
    }
  }, [])

  const changePanel = useCallback((open: boolean) => {
    setPanelOpen(open)
    if (!open) settingsButton.current?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches)
      if (event.matches) setSettings((old) => ({ ...old, paused: true }))
    }
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    const changed = () => {
      if (document.fullscreenElement === rootRef.current) wasFullscreen.current = true
      else if (wasFullscreen.current) {
        wasFullscreen.current = false
        setImmersive(false)
        setShowExitHint(false)
      }
    }
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  }, [])

  useEffect(() => {
    if (!immersive && wasImmersive.current) {
      wasImmersive.current = false
      immersiveButton.current?.focus({ preventScroll: true })
    }
    if (!showExitHint) return
    const id = window.setTimeout(() => setShowExitHint(false), 2600)
    return () => window.clearTimeout(id)
  }, [immersive, showExitHint])

  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (immersive) leaveImmersive()
        else if (panelOpen) changePanel(false)
        return
      }
      const target = event.target
      if (target instanceof Element && target.closest('input, textarea, select, button, [role="slider"], [contenteditable="true"]')) return
      if (event.code === 'Space') {
        event.preventDefault()
        setSettings((old) => ({ ...old, paused: !old.paused }))
      } else if (event.key.toLowerCase() === 'f') {
        event.preventDefault()
        if (immersive) leaveImmersive()
        else enterImmersive()
      } else if (event.key.toLowerCase() === 'r') {
        hillsRef.current?.resetView()
      }
    }
    window.addEventListener('keydown', keyboard)
    return () => window.removeEventListener('keydown', keyboard)
  }, [immersive, panelOpen, leaveImmersive, enterImmersive, changePanel])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__GLSL_HILLS__ = {
      getDiagnostics: () => hillsRef.current?.getDiagnostics() ?? null,
      getSettings: () => ({ ...settingsRef.current }),
    }
    return () => { delete window.__GLSL_HILLS__ }
  }, [])

  const pointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!immersive || event.pointerType !== 'touch') return
    const g = gesture.current
    if (g.points.size === 0) { g.multi = false; g.moved = false }
    g.points.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (g.points.size > 1) g.multi = true
  }
  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current
    const start = g.points.get(event.pointerId)
    if (start && Math.hypot(start.x - event.clientX, start.y - event.clientY) > 9) g.moved = true
  }
  const pointerUp = (event: PointerEvent<HTMLElement>) => {
    const g = gesture.current
    if (immersive && event.pointerType === 'touch' && g.points.has(event.pointerId) && !g.multi && !g.moved) {
      const at = performance.now()
      if (at - g.lastTap < 340 && Math.hypot(g.tapX - event.clientX, g.tapY - event.clientY) < 30) {
        g.lastTap = 0
        leaveImmersive()
      } else {
        g.lastTap = at; g.tapX = event.clientX; g.tapY = event.clientY
      }
    }
    g.points.delete(event.pointerId)
  }

  return (
    <main className="experience" ref={rootRef} data-theme={settings.theme} data-immersive={immersive} data-panel-open={panelOpen}
      onPointerDownCapture={pointerDown} onPointerMoveCapture={pointerMove} onPointerUpCapture={pointerUp}
      onPointerCancelCapture={(event) => { gesture.current.points.delete(event.pointerId); gesture.current.moved = true }}
      onDoubleClick={() => { if (immersive) leaveImmersive() }}>
      <GLSLHills ref={hillsRef} {...settings} width="100%" height="100%" onReady={() => setReady(true)} onError={() => setReady(true)} />
      <div className={`loading-curtain ${ready ? 'is-ready' : ''}`} aria-hidden={ready}>
        <span role="status">Preparing the landscape<span className="loading-period">.</span></span>
      </div>
      <div className="interface" inert={immersive} aria-hidden={immersive}>
        <header className="experience-header">
          <div className="wordmark">
            <h1>GLSL HILLS</h1>
            <p>An interactive generative landscape</p>
          </div>
          <nav className="header-actions" aria-label="Landscape controls">
            <Button className="control-button" variant="ghost" size="icon" type="button"
              aria-label={settings.paused ? 'Resume motion' : 'Pause motion'} title={settings.paused ? 'Resume motion · Space' : 'Pause motion · Space'}
              onClick={() => setSettings((old) => ({ ...old, paused: !old.paused }))}>
              {settings.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
            </Button>
            <Button className="control-button" variant="ghost" size="icon" type="button" ref={immersiveButton}
              aria-label="Enter immersive mode" title="Immersive view · F. Escape or double-tap to return." onClick={enterImmersive}>
              <Expand aria-hidden="true" />
            </Button>
            <Button className="control-button" variant="ghost" size="icon" type="button" ref={settingsButton}
              aria-label="Open landscape settings" title="Landscape settings" aria-expanded={panelOpen} aria-controls="landscape-settings"
              onClick={() => setPanelOpen((open) => !open)}>
              <SlidersHorizontal aria-hidden="true" />
            </Button>
          </nav>
        </header>
        <p className="gesture-hint"><span className="desktop-hint">Drag to explore<span className="hint-dot">·</span>Scroll to move closer</span><span className="touch-hint">Drag to explore<span className="hint-dot">·</span>Pinch to move closer</span></p>
        <LandscapeControls settings={settings} open={panelOpen} onOpenChange={changePanel}
          onChange={(patch) => setSettings((old) => ({ ...old, ...patch }))}
          onResetView={() => hillsRef.current?.resetView()}
          onResetSettings={() => { setSettings({ ...DEFAULT_SETTINGS, paused: reducedMotion }); hillsRef.current?.resetView() }} />
      </div>
      {immersive && <>
        <button type="button" className="immersive-exit" onClick={leaveImmersive}>Leave immersive mode</button>
        <p className={`immersive-hint ${showExitHint ? 'is-visible' : ''}`} aria-live="polite">Escape or double-tap to return</p>
      </>}
    </main>
  )
}
