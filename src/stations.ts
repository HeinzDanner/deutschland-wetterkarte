export type WeatherStation = {
  id: string
  name: string
  latitude: number
  longitude: number
  observedAt: string
  temperature: number | null
  humidity: number | null
  windSpeed: number | null
}

export type StationsResponse = {
  stations: WeatherStation[]
  unavailable: { id: string; name: string }[]
  total: number
  fetchedAt: string
}

export type RadarFramesResponse = {
  frames: string[]
  latest: string
}

export type Forecast = {
  hourly: {
    time: string[]
    temperature_2m: (number | null)[]
    precipitation_probability: (number | null)[]
    precipitation: (number | null)[]
    weather_code: (number | null)[]
    wind_speed_10m: (number | null)[]
  }
  daily: {
    time: string[]
    weather_code: (number | null)[]
    temperature_2m_max: (number | null)[]
    temperature_2m_min: (number | null)[]
    precipitation_sum: (number | null)[]
    precipitation_probability_max: (number | null)[]
    wind_speed_10m_max: (number | null)[]
  }
}

export async function getForecast(latitude: number, longitude: number, signal: AbortSignal): Promise<Forecast> {
  const response = await fetch(`/api/forecast?lat=${latitude}&lon=${longitude}`, { signal })
  if (!response.ok) {
    throw new Error('Vorhersage konnte nicht geladen werden.')
  }

  return await response.json() as Forecast
}

export async function getSatelliteFrames(signal: AbortSignal): Promise<RadarFramesResponse> {
  const response = await fetch('/api/satellite/times', { signal })
  if (!response.ok) {
    throw new Error('Satellitenzeitpunkte konnten nicht geladen werden.')
  }

  return await response.json() as RadarFramesResponse
}

export async function getEuropePrecipitationFrames(signal: AbortSignal): Promise<RadarFramesResponse> {
  const response = await fetch('/api/precipitation-europe/times', { signal })
  if (!response.ok) {
    throw new Error('Europa-Niederschlagszeitpunkte konnten nicht geladen werden.')
  }

  return await response.json() as RadarFramesResponse
}

export async function getStations(signal: AbortSignal): Promise<StationsResponse> {
  const response = await fetch('/api/stations', { signal })
  if (!response.ok) {
    throw new Error('DWD-Beobachtungsdaten konnten nicht geladen werden.')
  }

  return await response.json() as StationsResponse
}

export async function getRadarFrames(signal: AbortSignal): Promise<RadarFramesResponse> {
  const response = await fetch('/api/radar/times', { signal })
  if (!response.ok) {
    throw new Error('DWD-Radarzeitpunkte konnten nicht geladen werden.')
  }

  return await response.json() as RadarFramesResponse
}
