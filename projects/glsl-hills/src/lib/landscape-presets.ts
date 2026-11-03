export type Theme = 'monochrome' | 'glacier' | 'dusk'
export type Quality = 'auto' | 'high' | 'medium' | 'low'

export interface LandscapeSettings {
  theme: Theme
  speed: number
  terrainHeight: number
  detail: number
  paused: boolean
}

export interface LandscapePalette {
  name: string
  background: string
  base: string
  peak: string
  key: string
  fill: string
  fog: string
  fogDensity: number
}

export const PRESETS: Record<Theme, LandscapePalette> = {
  monochrome: {
    name: 'Monochrome', background: '#090c10', base: '#727c87', peak: '#c0c5cb',
    key: '#f0f0ed', fill: '#85909f', fog: '#090c10', fogDensity: 0.008,
  },
  glacier: {
    name: 'Glacier', background: '#070e18', base: '#49677e', peak: '#a8c9d5',
    key: '#d5edf0', fill: '#627fa2', fog: '#070e18', fogDensity: 0.0085,
  },
  dusk: {
    name: 'Dusk', background: '#110d18', base: '#75667f', peak: '#c9ada2',
    key: '#edc7a2', fill: '#9787b4', fog: '#110d18', fogDensity: 0.008,
  },
}

export const DEFAULT_SETTINGS: LandscapeSettings = {
  theme: 'monochrome', speed: 0.5, terrainHeight: 1, detail: 0.55, paused: false,
}
