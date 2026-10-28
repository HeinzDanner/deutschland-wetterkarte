const ENDPOINT = 'https://maps.dwd.de/geoserver/ows'
const LEVELS = { Minor: 1, Moderate: 2, Severe: 3, Extreme: 4 }
let cached
let pending

export function normalizeWarning(feature, now = Date.now()) {
  const p = feature.properties
  if (!p || p.STATUS !== 'Actual' || p.SCOPE !== 'Public' || p.MSGTYPE === 'Cancel') return null
  if (p.LANGUAGE && !p.LANGUAGE.toLowerCase().startsWith('de')) return null
  const onset = p.ONSET ?? p.EFFECTIVE
  if (!p.IDENTIFIER || !p.HEADLINE || !Number.isFinite(Date.parse(onset)) ||
    !Number.isFinite(Date.parse(p.EXPIRES))) {
    throw new Error('DWD-Warnung enthält unvollständige Pflichtangaben.')
  }
  if (Date.parse(p.EXPIRES) <= now) return null
  if (!['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) {
    throw new Error('DWD-Warngebiet enthält keine gültige Flächengeometrie.')
  }
  return {
    type: 'Feature',
    id: feature.id,
    geometry: feature.geometry,
    properties: {
      identifier: p.IDENTIFIER,
      area: p.AREADESC ?? p.NAME ?? '',
      headline: p.HEADLINE,
      description: p.DESCRIPTION ?? '',
      instruction: p.INSTRUCTION ?? '',
      event: p.EVENT ?? '',
      onset,
      expires: p.EXPIRES,
      sent: p.SENT ?? null,
      level: LEVELS[p.SEVERITY] ?? 0,
      severity: p.SEVERITY ?? 'Unknown',
      altitude: p.ALTITUDE ?? null,
      ceiling: p.CEILING ?? null,
    },
  }
}

export async function getWarnings() {
  if (cached && Date.now() - cached.at < 60000) return cached.data
  if (pending) return pending
  pending = (async () => {
    const features = []
    let start = 0
    const signal = AbortSignal.timeout(60000)
    while (true) {
      const url = new URL(ENDPOINT)
      for (const [name, value] of Object.entries({
        service: 'WFS', version: '2.0.0', request: 'GetFeature',
        typeNames: 'dwd:Warnungen_Gemeinden', outputFormat: 'application/json',
        srsName: 'EPSG:4326', count: '500', startIndex: String(start),
        sortBy: 'IDENTIFIER',
      })) url.searchParams.set(name, value)
      const response = await fetch(url, { signal })
      if (!response.ok) throw new Error(`DWD-Warnungen: HTTP ${response.status}`)
      const data = await response.json()
      if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
        throw new Error('DWD-Warnungen: ungültige GeoJSON-Antwort.')
      }
      features.push(...data.features)
      start += data.features.length
      if (data.features.length < 500) break
      if (start >= 20000) throw new Error('DWD-Warnungen überschreiten die unterstützte Datenmenge.')
    }
    const now = Date.now()
    const data = {
      type: 'FeatureCollection',
      fetchedAt: new Date(now).toISOString(),
      features: features.map((feature) => normalizeWarning(feature, now)).filter(Boolean),
    }
    cached = { at: now, data }
    return data
  })()
  try {
    return await pending
  } finally {
    pending = undefined
  }
}
