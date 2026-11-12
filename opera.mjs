import { fromArrayBuffer } from 'geotiff'
import { PNG } from 'pngjs'

const PRIMARY = 'https://s3.waw3-1.cloudferro.com/openradar-24h'
const BACKUP = 'https://object-store.os-api.cci1.ecmwf.int/openradar-24h-backup'
export const OPERA_PROJECTION = '+proj=laea +lat_0=55 +lon_0=10 +x_0=1950000 +y_0=-2100000 +ellps=WGS84 +units=m +no_defs'
export const OPERA_COLORS = [
  [0.1, [103, 210, 235]], [0.5, [50, 180, 125]], [1, [30, 145, 65]],
  [2, [220, 220, 40]], [5, [255, 170, 30]], [10, [245, 80, 35]],
  [20, [210, 35, 85]], [50, [160, 45, 180]],
]

export function rateColor(value, noData, undetect = NaN) {
  if (Object.is(value, undetect)) return [0, 0, 0, 0]
  if (!Number.isFinite(value) || value === noData || value < 0) {
    return [0, 0, 0, 0]
  }
  if (value < 0.1) return [0, 0, 0, 0]
  let color = OPERA_COLORS[0][1]
  for (const [threshold, candidate] of OPERA_COLORS) {
    if (value >= threshold) color = candidate
  }
  return [...color, 210]
}

let indexCache
let indexPending
const frames = new Map()
let running = 0
const queue = []

async function fetchChecked(url, timeout = 45000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeout) })
  if (!response.ok) throw new Error(`OPERA-Datenquelle antwortet mit HTTP ${response.status}.`)
  return response
}

async function listDay(base, day) {
  const prefix = `${day.replaceAll('-', '/')}/OPERA/COMP/`
  const keys = []
  let continuation
  do {
    const url = new URL(base)
    url.searchParams.set('list-type', '2')
    url.searchParams.set('prefix', prefix)
    url.searchParams.set('max-keys', '1000')
    if (continuation) url.searchParams.set('continuation-token', continuation)
    const xml = await (await fetchChecked(url, 10000)).text()
    for (const match of xml.matchAll(/<Key>([^<]+@RATE\.tiff)<\/Key>/g)) {
      keys.push(match[1])
    }
    continuation = xml.match(/<NextContinuationToken>([^<]+)<\/NextContinuationToken>/)?.[1]
    if (continuation) continuation = continuation.replaceAll('&amp;', '&')
  } while (continuation)
  return keys
}

export async function getOperaFrames() {
  if (indexCache && Date.now() - indexCache.at < 60000) return indexCache.data
  if (indexPending) return indexPending
  indexPending = (async () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86400000)
    const days = [now.toISOString().slice(0, 10)]
    if (now.getUTCHours() < 4) days.unshift(yesterday.toISOString().slice(0, 10))
    async function readSource(base) {
      const keys = (await Promise.all(days.map((day) => listDay(base, day)))).flat().sort()
      const available = keys.map((key) => {
        const stamp = key.match(/OPERA@(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})@0@RATE\.tiff$/)
        if (!stamp) return null
        return {
          time: `${stamp[1]}-${stamp[2]}-${stamp[3]}T${stamp[4]}:${stamp[5]}:00.000Z`,
          key,
        }
      }).filter((frame) => frame && Date.parse(frame.time) >= now.getTime() - 4 * 3600000 &&
        Date.parse(frame.time) <= now.getTime()).slice(-13)
      if (!available.length) throw new Error('Keine aktuellen OPERA-Niederschlagsbilder verfügbar.')
      return available
    }
    let base = PRIMARY
    let available
    try {
      available = await readSource(PRIMARY)
    } catch (reason) {
      console.warn('OPERA-Hauptquelle nicht verfügbar, versuche Backup:', reason.message)
      base = BACKUP
      try {
        available = await readSource(BACKUP)
      } catch (backupReason) {
        console.warn('OPERA-Backup ebenfalls nicht verfügbar:', backupReason.message)
        if (reason.message === 'Keine aktuellen OPERA-Niederschlagsbilder verfügbar.' &&
          backupReason.message === reason.message) throw backupReason
        throw new Error('OPERA-Hauptquelle und Backup sind nicht verfügbar.')
      }
    }
    const data = {
      frames: available.map((frame) => frame.time),
      latest: available.at(-1).time,
      colors: OPERA_COLORS,
    }
    indexCache = { at: Date.now(), data, available, base }
    for (const cacheKey of frames.keys()) {
      if (!available.some((frame) => cacheKey === `${base}|${frame.time}`)) frames.delete(cacheKey)
    }
    return data
  })()
  try {
    return await indexPending
  } finally {
    indexPending = undefined
  }
}

async function convertFrame(base, key) {
  // Bound simultaneous decompression/PNG encoding, not just network requests.
  if (running >= 2) await new Promise((resolve) => queue.push(resolve))
  running += 1
  try {
    let response
    try {
      response = await fetchChecked(`${base}/${key}`)
    } catch (reason) {
      const alternate = base === PRIMARY ? BACKUP : PRIMARY
      console.warn('OPERA-Bildabruf fehlgeschlagen, versuche andere Quelle:', reason.message)
      response = await fetchChecked(`${alternate}/${key}`)
    }
    const tiff = await fromArrayBuffer(await response.arrayBuffer())
    const image = await tiff.getImage()
    const geo = image.getGeoKeys()
    if (geo.ProjCoordTransGeoKey !== 10 || geo.ProjCenterLatGeoKey !== 55 ||
      geo.ProjCenterLongGeoKey !== 10 || geo.ProjFalseEastingGeoKey !== 1950000 ||
      geo.ProjFalseNorthingGeoKey !== -2100000) {
      throw new Error('Unerwartete OPERA-Projektion; Bild wird nicht falsch positioniert dargestellt.')
    }
    const width = image.getWidth()
    const height = image.getHeight()
    const [values] = await image.readRasters({ samples: [0] })
    const noData = image.getGDALNoData()
    const metadata = image.getGDALMetadata(0)
    if (metadata?.undetect === undefined) throw new Error('OPERA-Kennung für nicht nachweisbaren Niederschlag fehlt.')
    const undetect = Number(metadata.undetect)
    const png = new PNG({ width, height })
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x
        png.data.set(rateColor(values[index], noData, undetect), index * 4)
      }
    }
    return {
      png: PNG.sync.write(png),
      extent: image.getBoundingBox(),
      projection: OPERA_PROJECTION,
    }
  } finally {
    running -= 1
    queue.shift()?.()
  }
}

export async function getOperaFrame(time) {
  await getOperaFrames()
  const entry = indexCache.available.find((frame) => frame.time === time)
  if (!entry) {
    const error = new Error('OPERA-Zeitpunkt nicht mehr verfügbar. Bitte Zeitachse neu laden.')
    error.status = 404
    throw error
  }
  const base = indexCache.base
  const cacheKey = `${base}|${time}`
  if (!frames.has(cacheKey)) {
    const pending = convertFrame(base, entry.key)
    frames.set(cacheKey, pending)
    pending.catch(() => {
      if (frames.get(cacheKey) === pending) frames.delete(cacheKey)
    })
  }
  return frames.get(cacheKey)
}
