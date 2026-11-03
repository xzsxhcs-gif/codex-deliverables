import { useId } from "react"
import { Focus, Pause, Play, RotateCcw, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import type { LandscapeSettings, Theme } from "@/lib/landscape-presets"

type LandscapeControlsProps = {
  settings: LandscapeSettings
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (patch: Partial<LandscapeSettings>) => void
  onResetView: () => void
  onResetSettings: () => void
}

const themeOptions: { value: Theme; label: string; colors: string }[] = [
  {
    value: "monochrome",
    label: "Monochrome",
    colors: "linear-gradient(145deg, #c8cacb 0%, #7c8387 48%, #333b40 100%)",
  },
  {
    value: "glacier",
    label: "Glacier",
    colors: "linear-gradient(145deg, #d8e8eb 0%, #8eafb9 48%, #3e6473 100%)",
  },
  {
    value: "dusk",
    label: "Dusk",
    colors: "linear-gradient(145deg, #d2b8cc 0%, #9b769e 48%, #514d73 100%)",
  },
]

type SliderControlProps = {
  label: string
  value: number
  formattedValue: string
  min: number
  max: number
  onChange: (value: number) => void
}

function SliderControl({
  label,
  value,
  formattedValue,
  min,
  max,
  onChange,
}: SliderControlProps) {
  const id = useId()

  return (
    <div className="control-group">
      <div className="control-label">
        <label id={`${id}-label`} htmlFor={id}>
          {label}
        </label>
        <output className="control-value" htmlFor={id}>
          {formattedValue}
        </output>
      </div>
      <Slider
        id={id}
        className="control-slider"
        aria-label={label}
        aria-labelledby={`${id}-label`}
        aria-valuetext={formattedValue}
        value={[value]}
        min={min}
        max={max}
        step={0.05}
        onValueChange={(values) => {
          const nextValue = values[0]
          if (typeof nextValue === "number") onChange(nextValue)
        }}
      />
    </div>
  )
}

export function LandscapeControls({
  settings,
  open,
  onOpenChange,
  onChange,
  onResetView,
  onResetSettings,
}: LandscapeControlsProps) {
  const themeGroupId = useId()

  if (!open) return null

  return (
    <section
      id="landscape-settings"
      className="landscape-panel"
      role="region"
      aria-label="Landscape settings"
    >
      <div className="panel-header">
        <div>
          <p className="panel-kicker">SHAPE THE QUIET</p>
          <h2 className="panel-title">Landscape</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="panel-close"
          aria-label="Close landscape settings"
          onClick={() => onOpenChange(false)}
        >
          <X aria-hidden="true" />
        </Button>
      </div>

      <fieldset className="control-group">
        <legend className="control-label">Theme</legend>
        <div className="theme-options">
          {themeOptions.map((theme) => (
            <label
              key={theme.value}
              className="theme-option"
              data-selected={settings.theme === theme.value}
            >
              <input
                className="theme-radio sr-only"
                type="radio"
                name={`${themeGroupId}-theme`}
                value={theme.value}
                checked={settings.theme === theme.value}
                onChange={(event) => {
                  if (event.currentTarget.checked) onChange({ theme: theme.value })
                }}
              />
              <span
                className={`theme-swatch theme-swatch-${theme.value}`}
                style={{ background: theme.colors }}
                aria-hidden="true"
              />
              <span className="theme-label">{theme.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <SliderControl
        label="Motion speed"
        value={settings.speed}
        formattedValue={`${settings.speed.toFixed(2)}×`}
        min={0}
        max={1.5}
        onChange={(speed) => onChange({ speed })}
      />
      <SliderControl
        label="Terrain height"
        value={settings.terrainHeight}
        formattedValue={`${Math.round(settings.terrainHeight * 100)}%`}
        min={0.35}
        max={1.7}
        onChange={(terrainHeight) => onChange({ terrainHeight })}
      />
      <SliderControl
        label="Detail"
        value={settings.detail}
        formattedValue={`${Math.round(settings.detail * 100)}%`}
        min={0}
        max={1.5}
        onChange={(detail) => onChange({ detail })}
      />

      <div className="panel-actions">
        <Button
          type="button"
          className="motion-button"
          onClick={() => onChange({ paused: !settings.paused })}
        >
          {settings.paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          {settings.paused ? "Resume motion" : "Pause motion"}
        </Button>
        <div className="reset-actions">
          <Button type="button" variant="ghost" onClick={onResetView}>
            <Focus aria-hidden="true" />
            Reset view
          </Button>
          <Button type="button" variant="ghost" onClick={onResetSettings}>
            <RotateCcw aria-hidden="true" />
            Reset settings
          </Button>
        </div>
      </div>
    </section>
  )
}
