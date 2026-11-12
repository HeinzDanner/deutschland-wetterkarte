import { preferencesAllowed } from './preferenceConsent.ts'

export const MAP_VIEW_KEY = 'weather-map-view'
export const MAP_LAYERS_KEY = 'weather-map-layers'
export const DEFAULT_VIEW = { center: [10.5, 51.5], zoom: 4.6 }
export const DEFAULT_LAYERS = {
  opera: true, satellite: true, stations: true, warnings: true, satelliteOpacity: 0.95,
}

export function validView(value: unknown): value is typeof DEFAULT_VIEW {
  if (!value || typeof value !== 'object') return false
  const view = value as typeof DEFAULT_VIEW
  return Array.isArray(view.center) && view.center.length === 2 &&
    view.center.every(Number.isFinite) && Math.abs(view.center[0]) <= 180 &&
    Math.abs(view.center[1]) <= 85.051129 &&
    Number.isFinite(view.zoom) && view.zoom >= 3.5 && view.zoom <= 12
}

export function validLayers(value: unknown): value is typeof DEFAULT_LAYERS {
  if (!value || typeof value !== 'object') return false
  const layers = value as typeof DEFAULT_LAYERS
  return ['opera', 'satellite', 'stations', 'warnings'].every((key) =>
    typeof Reflect.get(layers, key) === 'boolean') &&
    Number.isFinite(layers.satelliteOpacity) && layers.satelliteOpacity >= 0 &&
    layers.satelliteOpacity <= 1
}

export function readPreference<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    if (!preferencesAllowed()) return fallback
    const raw = localStorage.getItem(key)
    if (raw === null) return fallback
    const value: unknown = JSON.parse(raw)
    if (!valid(value)) throw new Error(`Invalid saved preference: ${key}`)
    return value
  } catch (error) {
    console.warn('Map preference could not be read:', error)
    return fallback
  }
}

export function savePreference(key: string, value: unknown) {
  try {
    if (!preferencesAllowed()) return
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.warn('Map preference could not be saved:', error)
  }
}
