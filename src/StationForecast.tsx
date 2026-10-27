import { useEffect, useState } from 'react'
import { getForecast, type Forecast } from './stations'

type Props = { latitude: number; longitude: number }

function describe(code: number | null): { icon: string; text: string } {
  if (code === null) return { icon: '–', text: 'unbekannt' }
  if (code === 0) return { icon: '☀️', text: 'klar' }
  if (code <= 2) return { icon: '🌤️', text: 'heiter' }
  if (code === 3) return { icon: '☁️', text: 'bedeckt' }
  if (code === 45 || code === 48) return { icon: '🌫️', text: 'Nebel' }
  if (code >= 51 && code <= 57) return { icon: '🌦️', text: 'Nieselregen' }
  if (code >= 61 && code <= 67) return { icon: '🌧️', text: 'Regen' }
  if (code >= 71 && code <= 77) return { icon: '🌨️', text: 'Schnee' }
  if (code >= 80 && code <= 82) return { icon: '🌦️', text: 'Schauer' }
  if (code === 85 || code === 86) return { icon: '🌨️', text: 'Schneeschauer' }
  if (code >= 95) return { icon: '⛈️', text: 'Gewitter' }
  return { icon: '☁️', text: 'wechselhaft' }
}

const round = (value: number | null) => (value === null ? '–' : Math.round(value))

export function StationForecast({ latitude, longitude }: Props) {
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [error, setError] = useState(false)
  const [view, setView] = useState<'hourly' | 'daily'>('hourly')

  useEffect(() => {
    const controller = new AbortController()
    setForecast(null)
    setError(false)
    getForecast(latitude, longitude, controller.signal)
      .then(setForecast)
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [latitude, longitude])

  const hourFormat = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' })
  const dayFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })

  return (
    <div className="forecast">
      <div className="forecast-tabs" role="tablist">
        <button aria-selected={view === 'hourly'} onClick={() => setView('hourly')} type="button">24 Stunden</button>
        <button aria-selected={view === 'daily'} onClick={() => setView('daily')} type="button">7 Tage</button>
      </div>
      {error && <p className="forecast-status">Vorhersage nicht verfügbar.</p>}
      {!error && !forecast && <p className="forecast-status">Vorhersage wird geladen …</p>}
      {forecast && view === 'hourly' && (
        <ul className="forecast-list">
          {forecast.hourly.time.map((time, i) => {
            const weather = describe(forecast.hourly.weather_code[i])
            return (
              <li key={time} title={weather.text}>
                <span>{hourFormat.format(new Date(time))}</span>
                <span>{weather.icon}</span>
                <strong>{round(forecast.hourly.temperature_2m[i])}°</strong>
                <small>{round(forecast.hourly.precipitation_probability[i])} % · {forecast.hourly.precipitation[i] ?? 0} mm</small>
              </li>
            )
          })}
        </ul>
      )}
      {forecast && view === 'daily' && (
        <ul className="forecast-list">
          {forecast.daily.time.map((time, i) => {
            const weather = describe(forecast.daily.weather_code[i])
            return (
              <li key={time} title={weather.text}>
                <span>{dayFormat.format(new Date(`${time}T12:00`))}</span>
                <span>{weather.icon}</span>
                <strong>{round(forecast.daily.temperature_2m_max[i])}° / {round(forecast.daily.temperature_2m_min[i])}°</strong>
                <small>{round(forecast.daily.precipitation_probability_max[i])} % · {forecast.daily.precipitation_sum[i] ?? 0} mm</small>
              </li>
            )
          })}
        </ul>
      )}
      <small className="forecast-source">Quelle: Open-Meteo, DWD ICON</small>
    </div>
  )
}
