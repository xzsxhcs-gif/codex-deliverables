import { StrictMode, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { GLSLHills, type GLSLHillsHandle, type GLSLHillsProps } from '@/components/ui/glsl-hills'
import { getLiveLandscapeStats } from '@/lib/landscape-engine'
import '../src/index.css'

declare global { interface Window { __HILLS_HARNESS__: { mount: () => void; unmount: () => void; setSize: (width: number, height: number) => void; offscreen: (value: boolean) => void; update: (value: GLSLHillsProps) => void; diagnostics: () => ReturnType<GLSLHillsHandle['getDiagnostics']>; stats: typeof getLiveLandscapeStats } } }
export default function Harness() {
  const [mounted, setMounted] = useState(true)
  const [size, setSize] = useState({ width: 480, height: 270 })
  const [offscreen, setOffscreen] = useState(false)
  const [options, setOptions] = useState<GLSLHillsProps>({ paused: false, quality: 'low' })
  const scene = useRef<GLSLHillsHandle>(null)
  useEffect(() => {
    window.__HILLS_HARNESS__ = {
      mount: () => setMounted(true), unmount: () => setMounted(false),
      setSize: (width, height) => setSize({ width, height }), offscreen: setOffscreen,
      update: (value) => setOptions((old) => ({ ...old, ...value })),
      diagnostics: () => scene.current?.getDiagnostics() ?? null, stats: getLiveLandscapeStats,
    }
  }, [])
  return <div id="terrain-host" style={{ position: 'absolute', left: 24, top: offscreen ? 2400 : 24, width: size.width, height: size.height }}>{mounted && <GLSLHills ref={scene} {...options} width="100%" height="100%" />}</div>
}
createRoot(document.getElementById('qa-root')!).render(<StrictMode><Harness /></StrictMode>)
