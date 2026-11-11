export const satelliteSource = {
  provider: 'EUMETSAT',
  family: 'Meteosat',
  service: 'EUMETView',
  url: 'https://view.eumetsat.int/geoserver/ows',
  sourceUrl: 'https://view.eumetsat.int/',
  layer: 'msg_fes:ir108',
  licence: 'CC BY 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by/4.0/',
} as const

export function satelliteDataYear(time: string | null): string | null {
  if (!time || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(time)) return null
  const date = new Date(time)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 19) !== time.slice(0, 19)) return null
  return String(date.getUTCFullYear())
}

export function satelliteMapAttribution(time: string): string {
  const year = satelliteDataYear(time)
  return `Satellite: <a href="${satelliteSource.sourceUrl}">${satelliteSource.provider} ${satelliteSource.family}</a>${year ? ` ${year}` : ''} · <a href="${satelliteSource.licenceUrl}">${satelliteSource.licence}</a> · modified display`
}
