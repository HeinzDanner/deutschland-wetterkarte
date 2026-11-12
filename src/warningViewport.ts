import type Feature from 'ol/Feature'
import type Geometry from 'ol/geom/Geometry'
import type { Extent } from 'ol/extent'

type WarningPeriod = { onset: string; expires: string; level: number }

export function warningsInExtent(features: Feature<Geometry>[], extent: Extent, now: number) {
  return features.filter((feature) => {
    const warning = feature.get('warning') as WarningPeriod
    return Date.parse(warning.onset) <= now && Date.parse(warning.expires) > now &&
      feature.getGeometry()?.intersectsExtent(extent)
  })
}

export function highestWarningLevel(features: Feature<Geometry>[]): number | null {
  const levels = features.map((feature) => (feature.get('warning') as WarningPeriod).level)
    .filter((level) => Number.isInteger(level) && level >= 1 && level <= 4)
  return levels.length ? Math.max(...levels) : null
}
