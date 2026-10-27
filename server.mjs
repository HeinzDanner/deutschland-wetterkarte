import { createServer } from 'node:http'

const DWD_POI_URL = 'https://opendata.dwd.de/weather/weather_reports/poi'
const PORT = Number(process.env.PORT ?? 8787)
const stations = [
  { id: '10020', name: 'List auf Sylt', latitude: 55.0167, longitude: 8.4167 },
  { id: '10015', name: 'Helgoland', latitude: 54.1833, longitude: 7.9 },
  { id: '10035', name: 'Schleswig', latitude: 54.5333, longitude: 9.55 },
  { id: '10091', name: 'Arkona', latitude: 54.6833, longitude: 13.4333 },
  { id: '10113', name: 'Norderney', latitude: 53.7167, longitude: 7.15 },
  { id: '10147', name: 'Hamburg-Fuhlsbüttel', latitude: 53.6333, longitude: 10 },
  { id: '10156', name: 'Lübeck-Blankensee', latitude: 53.8167, longitude: 10.7 },
  { id: '10170', name: 'Rostock-Warnemünde', latitude: 54.1833, longitude: 12.0833 },
  { id: '10200', name: 'Emden', latitude: 53.35, longitude: 7.2167 },
  { id: '10224', name: 'Bremen', latitude: 53.05, longitude: 8.8 },
  { id: '10238', name: 'Bergen', latitude: 52.8167, longitude: 9.9333 },
  { id: '10253', name: 'Lüchow', latitude: 52.9667, longitude: 11.1333 },
  { id: '10281', name: 'Trollenhagen', latitude: 53.6, longitude: 13.3167 },
  { id: '10291', name: 'Angermünde', latitude: 53.0333, longitude: 14 },
  { id: '10315', name: 'Münster/Osnabrück', latitude: 52.1333, longitude: 7.7 },
  { id: '10325', name: 'Bad Salzuflen', latitude: 52.1, longitude: 8.75 },
  { id: '10338', name: 'Hannover', latitude: 52.4667, longitude: 9.6833 },
  { id: '10361', name: 'Magdeburg', latitude: 52.1333, longitude: 11.6 },
  { id: '10379', name: 'Potsdam', latitude: 52.3833, longitude: 13.0667 },
  { id: '10381', name: 'Berlin-Dahlem', latitude: 52.4667, longitude: 13.3 },
  { id: '10400', name: 'Düsseldorf', latitude: 51.3, longitude: 6.7667 },
  { id: '10410', name: 'Essen', latitude: 51.4, longitude: 6.9667 },
  { id: '10430', name: 'Bad Lippspringe', latitude: 51.7833, longitude: 8.8333 },
  { id: '10453', name: 'Brocken', latitude: 51.8, longitude: 10.6167 },
  { id: '10469', name: 'Leipzig/Halle', latitude: 51.4167, longitude: 12.2333 },
  { id: '10488', name: 'Dresden-Klotzsche', latitude: 51.1333, longitude: 13.75 },
  { id: '10513', name: 'Köln/Bonn', latitude: 50.8667, longitude: 7.1667 },
  { id: '10532', name: 'Gießen', latitude: 50.5833, longitude: 8.7 },
  { id: '10542', name: 'Bad Hersfeld', latitude: 50.85, longitude: 9.7333 },
  { id: '10548', name: 'Meiningen', latitude: 50.5667, longitude: 10.3833 },
  { id: '10554', name: 'Erfurt-Bindersleben', latitude: 50.9833, longitude: 10.9667 },
  { id: '10577', name: 'Chemnitz', latitude: 50.8, longitude: 12.8667 },
  { id: '10609', name: 'Trier-Petrisberg', latitude: 49.75, longitude: 6.6667 },
  { id: '10618', name: 'Idar-Oberstein', latitude: 49.7, longitude: 7.3333 },
  { id: '10637', name: 'Frankfurt Flughafen', latitude: 50.05, longitude: 8.6 },
  { id: '10655', name: 'Würzburg', latitude: 49.7667, longitude: 9.9667 },
  { id: '10688', name: 'Weiden', latitude: 49.6667, longitude: 12.1833 },
  { id: '10708', name: 'Saarbrücken-Ensheim', latitude: 49.2167, longitude: 7.1167 },
  { id: '10731', name: 'Rheinstetten', latitude: 48.9736, longitude: 8.3311 },
  { id: '10738', name: 'Stuttgart-Echterdingen', latitude: 48.6833, longitude: 9.2167 },
  { id: '10765', name: 'Roth', latitude: 49.2167, longitude: 11.1 },
  { id: '10776', name: 'Regensburg', latitude: 49.05, longitude: 12.1 },
  { id: '10803', name: 'Freiburg', latitude: 48, longitude: 7.85 },
  { id: '10852', name: 'Augsburg', latitude: 48.4333, longitude: 10.9333 },
  { id: '10865', name: 'München-Stadt', latitude: 48.1333, longitude: 11.55 },
  { id: '10895', name: 'Fürstenzell', latitude: 48.5461, longitude: 13.3547 },
  { id: '10908', name: 'Feldberg', latitude: 47.8833, longitude: 8 },
  { id: '10929', name: 'Konstanz', latitude: 47.6833, longitude: 9.1833 },
  { id: '10946', name: 'Kempten', latitude: 47.7167, longitude: 10.3333 },
  { id: '10948', name: 'Oberstdorf', latitude: 47.4, longitude: 10.2833 },
  { id: '10961', name: 'Zugspitze', latitude: 47.4167, longitude: 10.9833 },
  { id: '10499', name: 'Görlitz', latitude: 51.1667, longitude: 14.95 },
  { id: '10055', name: 'Westermarkelsdorf', latitude: 54.5333, longitude: 11.0667 },
  { id: '10496', name: 'Cottbus', latitude: 51.7833, longitude: 14.3167 },
  { id: '10267', name: 'Kyritz', latitude: 52.9333, longitude: 12.4167 },
  { id: '10564', name: 'Schleiz', latitude: 50.5667, longitude: 11.8167 },
  { id: '10004', name: 'UFS TW Ems', latitude: 54.1667, longitude: 6.35 },
  { id: '10982', name: 'Chieming', latitude: 47.8833, longitude: 12.5333 },
  { id: '10136', name: 'Nordholz', latitude: 53.7667, longitude: 8.6667 },
  { id: '10476', name: 'Holzdorf', latitude: 51.7667, longitude: 13.1833 },
  { id: '10675', name: 'Bamberg', latitude: 49.9167, longitude: 10.9 },
  { id: '10427', name: 'Kahler Asten', latitude: 51.1833, longitude: 8.4833 },
  { id: '10396', name: 'Manschnow', latitude: 52.55, longitude: 14.55 },
  { id: '10168', name: 'Goldberg', latitude: 53.6, longitude: 12.1 },
  { id: '10500', name: 'Geilenkirchen', latitude: 50.9667, longitude: 6.05 },
  { id: '10742', name: 'Öhringen', latitude: 49.2167, longitude: 9.5167 },
  { id: '10837', name: 'Laupheim', latitude: 48.2167, longitude: 9.9167 },
  { id: '10506', name: 'Nürburg-Barweiler', latitude: 50.35, longitude: 6.8667 },
  { id: '10424', name: 'Werl/Sönnern', latitude: 51.5778, longitude: 7.8889 },
  { id: '10321', name: 'Diepholz', latitude: 52.5833, longitude: 8.35 },
  { id: '10097', name: 'Greifswalder Oie', latitude: 54.2458, longitude: 13.9125 },
  { id: '10729', name: 'Mannheim', latitude: 49.52, longitude: 8.55 },
  { id: '10815', name: 'Freudenstadt', latitude: 48.45, longitude: 8.4167 },
  { id: '10210', name: 'Friesoythe-Altenoythe', latitude: 53.06, longitude: 7.9 },
  { id: '10444', name: 'Göttingen', latitude: 51.5, longitude: 9.95 },
  { id: '10348', name: 'Braunschweig', latitude: 52.3, longitude: 10.45 },
  { id: '10193', name: 'Ueckermünde', latitude: 53.75, longitude: 14.0667 },
  { id: '10796', name: 'Zwiesel', latitude: 49.0333, longitude: 13.2333 },
  { id: '10309', name: 'Ahaus/Wessum', latitude: 52.0828, longitude: 6.9417 },
  { id: '10872', name: 'Gottfrieding', latitude: 48.6606, longitude: 12.5403 },
  { id: '10860', name: 'Ingolstadt', latitude: 48.7167, longitude: 11.5333 },
  { id: '10526', name: 'Bad Marienberg', latitude: 50.6667, longitude: 7.9667 },
  { id: '10442', name: 'Alfeld/Buchenbrink', latitude: 51.9672, longitude: 9.8044 },
  { id: '10028', name: 'St. Peter-Ording', latitude: 54.3297, longitude: 8.6028 },
  { id: '10756', name: 'Feuchtwangen-Heilbronn', latitude: 49.1633, longitude: 10.3672 },
  { id: '10044', name: 'Leuchtturm Kiel', latitude: 54.5, longitude: 10.2833 },
  { id: '10368', name: 'Wiesenburg', latitude: 52.1167, longitude: 12.4667 },
  { id: '10162', name: 'Schwerin', latitude: 53.65, longitude: 11.3833 },
  { id: '10827', name: 'Meßstetten', latitude: 48.1833, longitude: 9 },
  { id: '10142', name: 'Itzehoe', latitude: 54, longitude: 9.5833 },
  { id: '10460', name: 'Artern', latitude: 51.3833, longitude: 11.3 },
  { id: '10480', name: 'Oschatz', latitude: 51.3, longitude: 13.1 },
  { id: '10557', name: 'Neuhaus am Rennweg', latitude: 50.5, longitude: 11.1333 },
  { id: '10393', name: 'Lindenberg', latitude: 52.2167, longitude: 14.1167 },
  { id: '10180', name: 'Barth', latitude: 54.3333, longitude: 12.7167 },
  { id: '10782', name: 'Waldmünchen/Hocha', latitude: 49.3922, longitude: 12.6853 },
  { id: '10628', name: 'Geisenheim', latitude: 49.9833, longitude: 7.95 },
  { id: '10249', name: 'Boizenburg', latitude: 53.4, longitude: 10.6833 },
  { id: '10139', name: 'Bremervörde', latitude: 53.5, longitude: 9.1667 },
  { id: '10836', name: 'Stötten', latitude: 48.6667, longitude: 9.8667 },
]

function parseDecimal(value) {
  if (!value || value === '---') return null

  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function parseObservation(station, csv) {
  const lines = csv.trim().split(/\r?\n/)
  const headers = lines[2].split(';')
  for (const line of lines.slice(3)) {
    const values = line.split(';')
    if (values.length !== headers.length) continue

    const field = (name) => values[headers.indexOf(name)]
    const temperature = parseDecimal(field('Temperatur (2m)'))
    if (temperature === null) continue

    const [day, month, shortYear] = field('Datum').split('.')
    const year = Number(shortYear) < 70 ? `20${shortYear}` : `19${shortYear}`
    const observedAt = new Date(
      `${year}-${month}-${day}T${field('Uhrzeit (UTC)')}:00Z`,
    )
    if (Number.isNaN(observedAt.getTime())) continue

    return {
      ...station,
      observedAt: observedAt.toISOString(),
      temperature,
      humidity: parseDecimal(field('Relative Feuchte')),
      windSpeed: parseDecimal(field('Windgeschwindigkeit')),
    }
  }

  throw new Error(`Keine Temperaturmessung in den DWD-Daten für ${station.id}`)
}

const CACHE_TTL = 5 * 60 * 1000
let cachedData = null
let cachedAt = 0
let pendingRefresh = null
let cachedRadarFrames = null
let radarFramesCachedAt = 0
let pendingRadarRefresh = null

async function loadStations() {
  const available = []
  const unavailable = []
  let nextIndex = 0
  // A single shared refresh uses at most six simultaneous DWD requests.
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (nextIndex < stations.length) {
      const station = stations[nextIndex++]
      try {
        const response = await fetch(`${DWD_POI_URL}/${station.id}-BEOB.csv`, {
          signal: AbortSignal.timeout(15000),
        })
        if (!response.ok) {
          throw new Error(`DWD antwortet mit ${response.status}`)
        }
        available.push(parseObservation(station, await response.text()))
      } catch (error) {
        console.warn(`DWD-Station ${station.id}:`, error.message)
        unavailable.push({ id: station.id, name: station.name })
      }
    }
  }))

  if (available.length === 0) {
    throw new Error('Keine DWD-Station konnte geladen werden')
  }

  return {
    stations: available.sort((a, b) => a.id.localeCompare(b.id)),
    unavailable,
    total: stations.length,
    fetchedAt: new Date().toISOString(),
  }
}

async function getStations() {
  if (cachedData && Date.now() - cachedAt < CACHE_TTL) return cachedData
  if (!pendingRefresh) {
    pendingRefresh = loadStations().then((data) => {
      cachedData = data
      cachedAt = Date.now()
      return data
    }).finally(() => {
      pendingRefresh = null
    })
  }
  return pendingRefresh
}

async function loadRadarFrames() {
  const url = 'https://maps.dwd.de/geoserver/ows?service=WMS&request=GetCapabilities&version=1.3.0'
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) {
    throw new Error(`DWD antwortet mit ${response.status}`)
  }

  const capabilities = await response.text()
  const layerStart = capabilities.indexOf('<Name>dwd:Niederschlagsradar</Name>')
  const layerEnd = capabilities.indexOf('</Layer>', layerStart)
  if (layerStart < 0 || layerEnd < 0) {
    throw new Error('Zeitdimension für das DWD-Niederschlagsradar fehlt')
  }

  const layer = capabilities.slice(layerStart, layerEnd)
  const dimension = layer.match(/<Dimension name="time"[^>]*>([^<]+)<\/Dimension>/)
  const range = dimension?.[1].match(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\/PT5M/,
  )
  if (!range) {
    throw new Error('DWD-Zeitbereich hat ein unerwartetes Format')
  }

  const referenceTime = layer.match(/<Dimension\b(?=[^>]*\bname="REFERENCE_TIME")(?=[^>]*\bdefault="([^"]+)")[^>]*>/)
  const observedUntil = Date.parse(referenceTime?.[1] ?? '')
  const earliest = Date.parse(range[1])
  const latest = Math.min(Date.parse(range[2]), observedUntil, Date.now())
  if (!Number.isFinite(earliest) || !Number.isFinite(latest) || latest < earliest) {
    throw new Error('DWD-Beobachtungszeitbereich oder Referenzzeit ist ungültig')
  }

  const frameStep = 5 * 60 * 1000
  const windowStart = Math.max(earliest, latest - 60 * 60 * 1000)
  const firstFrame = Math.ceil((windowStart - earliest) / frameStep)
  const lastFrame = Math.floor((latest - earliest) / frameStep)
  const frames = []
  for (let frame = firstFrame; frame <= lastFrame; frame += 1) {
    frames.push(new Date(earliest + frame * frameStep).toISOString())
  }
  if (frames.length === 0) {
    throw new Error('DWD hat keine Radarzeitpunkte im letzten Zeitraum veröffentlicht')
  }

  return { frames, latest: frames.at(-1) }
}

async function getRadarFrames() {
  if (cachedRadarFrames && Date.now() - radarFramesCachedAt < CACHE_TTL) {
    return cachedRadarFrames
  }
  if (!pendingRadarRefresh) {
    pendingRadarRefresh = loadRadarFrames().then((data) => {
      cachedRadarFrames = data
      radarFramesCachedAt = Date.now()
      return data
    }).finally(() => {
      pendingRadarRefresh = null
    })
  }
  return pendingRadarRefresh
}

let cachedCapabilities = null
let capabilitiesCachedAt = 0
let pendingCapabilities = null

// Both EUMETSAT layers share one slow capabilities document.
async function getEumetsatCapabilities() {
  if (cachedCapabilities && Date.now() - capabilitiesCachedAt < CACHE_TTL) return cachedCapabilities
  if (!pendingCapabilities) {
    const url = 'https://view.eumetsat.int/geoserver/ows?service=WMS&request=GetCapabilities&version=1.3.0'
    pendingCapabilities = fetch(url, { signal: AbortSignal.timeout(30000) }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`EUMETSAT antwortet mit ${response.status}`)
      }
      cachedCapabilities = await response.text()
      capabilitiesCachedAt = Date.now()
      return cachedCapabilities
    }).finally(() => {
      pendingCapabilities = null
    })
  }
  return cachedCapabilities ?? pendingCapabilities
}

async function loadEumetsatFrames(layerName) {
  const capabilities = await getEumetsatCapabilities()
  const layerStart = capabilities.indexOf(`<Name>${layerName}</Name>`)
  const layerEnd = capabilities.indexOf('</Layer>', layerStart)
  if (layerStart < 0 || layerEnd < 0) {
    throw new Error(`Zeitdimension für ${layerName} fehlt`)
  }

  const dimension = capabilities.slice(layerStart, layerEnd)
    .match(/<Dimension name="time"[^>]*>([^<]+)<\/Dimension>/)
  const range = dimension?.[1].match(
    /(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\/PT15M/,
  )
  if (!range) {
    throw new Error('EUMETSAT-Zeitbereich hat ein unerwartetes Format')
  }

  const earliest = Date.parse(range[1])
  const latest = Math.min(Date.parse(range[2]), Date.now())
  if (!Number.isFinite(earliest) || !Number.isFinite(latest) || latest < earliest) {
    throw new Error('EUMETSAT-Zeitbereich ist ungültig')
  }

  const frameStep = 15 * 60 * 1000
  const lastFrame = Math.floor((latest - earliest) / frameStep)
  const firstFrame = Math.max(0, lastFrame - 12)
  const frames = []
  for (let frame = firstFrame; frame <= lastFrame; frame += 1) {
    frames.push(new Date(earliest + frame * frameStep).toISOString())
  }

  return { frames, latest: frames.at(-1) }
}

function createEumetsatFramesGetter(layerName) {
  let cached = null
  let cachedAt = 0
  let pending = null

  return async () => {
    if (cached && Date.now() - cachedAt < CACHE_TTL) return cached
    if (!pending) {
      pending = loadEumetsatFrames(layerName).then((data) => {
        cached = data
        cachedAt = Date.now()
        return data
      }).finally(() => {
        pending = null
      })
    }
    // Stale data is better than waiting seconds for EUMETSAT.
    if (cached) {
      pending.catch(() => {})
      return cached
    }
    return pending
  }
}

const getSatelliteFrames = createEumetsatFramesGetter('msg_fes:ir108')
const getEuropePrecipitationFrames = createEumetsatFramesGetter('msg_fes:h60b')

const routes = {
  '/api/stations': {
    load: getStations,
    error: 'DWD-Beobachtungsdaten konnten nicht geladen werden.',
  },
  '/api/radar/times': {
    load: getRadarFrames,
    error: 'DWD-Radarzeitpunkte konnten nicht geladen werden.',
  },
  '/api/satellite/times': {
    load: getSatelliteFrames,
    error: 'EUMETSAT-Satellitenzeitpunkte konnten nicht geladen werden.',
  },
  '/api/precipitation-europe/times': {
    load: getEuropePrecipitationFrames,
    error: 'EUMETSAT-Niederschlagszeitpunkte konnten nicht geladen werden.',
  },
}

const forecastCache = new Map()

async function getForecast(latitude, longitude) {
  const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`
  const cached = forecastCache.get(key)
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
    return cached.data
  }

  const url = new URL('https://api.open-meteo.com/v1/dwd-icon')
  url.searchParams.set('latitude', latitude.toFixed(4))
  url.searchParams.set('longitude', longitude.toFixed(4))
  url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m')
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max')
  url.searchParams.set('timezone', 'Europe/Berlin')
  url.searchParams.set('forecast_days', '7')
  url.searchParams.set('forecast_hours', '24')

  const upstream = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!upstream.ok) {
    throw new Error(`Open-Meteo antwortete mit ${upstream.status}`)
  }
  const data = await upstream.json()
  if (forecastCache.size > 500) forecastCache.clear()
  forecastCache.set(key, { at: Date.now(), data })
  return data
}

createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*')

  const requestUrl = new URL(request.url, 'http://localhost')
  const pathname = requestUrl.pathname

  if (pathname === '/api/forecast') {
    const latitude = Number(requestUrl.searchParams.get('lat'))
    const longitude = Number(requestUrl.searchParams.get('lon'))
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      response.writeHead(400, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'Ungültige Koordinaten' }))
      return
    }
    try {
      const data = await getForecast(latitude, longitude)
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify(data))
    } catch (error) {
      response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({
        error: 'Vorhersage konnte nicht geladen werden.',
        detail: error instanceof Error ? error.message : 'Unbekannter Fehler',
      }))
    }
    return
  }

  const route = routes[pathname]
  if (!route) {
    response.writeHead(404, { 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Nicht gefunden' }))
    return
  }

  try {
    const data = await route.load()
    response.writeHead(200, {
      'Cache-Control': 'no-cache',
      'Content-Type': 'application/json; charset=utf-8',
    })
    response.end(JSON.stringify(data))
  } catch (error) {
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({
      error: route.error,
      detail: error instanceof Error ? error.message : 'Unbekannter Fehler',
    }))
  }
}).listen(PORT, () => {
  console.log(`DWD-BFF läuft unter http://localhost:${PORT}`)
  // The EUMETSAT capabilities take several seconds, so keep the frame list warm.
  const warmUp = () => {
    for (const load of [getSatelliteFrames, getEuropePrecipitationFrames, getRadarFrames]) {
      load().catch((error) => console.warn('Vorladen fehlgeschlagen:', error.message))
    }
  }
  warmUp()
  setInterval(warmUp, CACHE_TTL + 1000).unref()
})
