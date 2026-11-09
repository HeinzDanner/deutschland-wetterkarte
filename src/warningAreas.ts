import polygonClipping from 'polygon-clipping'
import type { MultiPolygon, Pair } from 'polygon-clipping'

type Area = {
  geometry: { type: string; coordinates: number[][][] | number[][][][] }
  properties: {
    level: number
    event: string
    headline: string
    description: string
    instruction: string
    onset: string
    expires: string
    altitude: number | null
    ceiling: number | null
  }
}

export function mergeWarningAreas(areas: Area[]) {
  const groups = new Map<string, { level: number; geometries: MultiPolygon[] }>()
  for (const { geometry, properties: p } of areas) {
    const key = JSON.stringify([p.level, p.event, p.headline, p.description, p.instruction,
      p.onset, p.expires, p.altitude, p.ceiling])
    let group = groups.get(key)
    if (!group) {
      group = { level: p.level, geometries: [] }
      groups.set(key, group)
    }
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') {
      throw new Error('Warngebiet ist keine Polygonfläche.')
    }
    const polygons = geometry.type === 'Polygon'
      ? [geometry.coordinates as number[][][]] : geometry.coordinates as number[][][][]
    group.geometries.push(polygons.map((polygon) => polygon.map((ring) => ring.map((point): Pair => {
      if (!Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
        throw new Error('Warngebiet enthält ungültige Koordinaten.')
      }
      return [point[0], point[1]]
    }))))
  }
  return [...groups.values()].map(({ level, geometries }) => ({
    type: 'Feature' as const,
    properties: { level },
    geometry: {
      type: 'MultiPolygon' as const,
      coordinates: polygonClipping.union(geometries[0], ...geometries.slice(1)),
    },
  }))
}
