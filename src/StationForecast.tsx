import { useEffect, useState } from 'react'
import { getForecast, type Forecast } from './stations'
import { useLanguage, type Translate } from './i18n'

type Props = { latitude: number; longitude: number }

function describe(code: number | null | undefined, t: Translate): { icon: string; text: string } {
  if (code == null) return { icon: '–', text: t('unbekannt', 'unknown') }
  if (code === 0) return { icon: '☀️', text: t('klar', 'clear') }
  if (code <= 2) return { icon: '🌤️', text: t('heiter', 'partly cloudy') }
  if (code === 3) return { icon: '☁️', text: t('bedeckt', 'overcast') }
  if (code === 45 || code === 48) return { icon: '🌫️', text: t('Nebel', 'fog') }
  if (code >= 51 && code <= 57) return { icon: '🌦️', text: t('Nieselregen', 'drizzle') }
  if (code >= 61 && code <= 67) return { icon: '🌧️', text: t('Regen', 'rain') }
  if (code >= 71 && code <= 77) return { icon: '🌨️', text: t('Schnee', 'snow') }
  if (code >= 80 && code <= 82) return { icon: '🌦️', text: t('Schauer', 'showers') }
  if (code === 85 || code === 86) return { icon: '🌨️', text: t('Schneeschauer', 'snow showers') }
  if (code >= 95) return { icon: '⛈️', text: t('Gewitter', 'thunderstorm') }
  return { icon: '☁️', text: t('wechselhaft', 'changeable') }
}

function useNumberFormat() {
  const { locale } = useLanguage()
  return (value: number | null | undefined, digits = 0) =>
    value == null || !Number.isFinite(value) ? '–' : value.toLocaleString(locale, { maximumFractionDigits: digits })
}

function ForecastChart({ forecast }: { forecast: Forecast }) {
  const { t, locale } = useLanguage()
  const formatNumber = useNumberFormat()
  const { hourly } = forecast
  const temperatures = hourly.temperature_2m.filter((v): v is number => v != null && Number.isFinite(v))
  const minimum = Math.min(0, ...temperatures) - 2
  const maximum = Math.max(0, ...temperatures) + 2
  const rainMaximum = Math.max(1, ...hourly.precipitation.filter((v): v is number => v != null && Number.isFinite(v)))
  const x = (index: number) => 28 + index * 224 / Math.max(1, hourly.time.length - 1)
  const y = (value: number) => 78 - (value - minimum) / (maximum - minimum) * 62
  const paths: string[] = []
  let segment = ''
  hourly.time.forEach((_, index) => {
    const value = hourly.temperature_2m[index]
    if (value == null || !Number.isFinite(value)) {
      if (segment) paths.push(segment)
      segment = ''
    } else {
      segment += `${segment ? ' L' : 'M'}${x(index)},${y(value)}`
    }
  })
  if (segment) paths.push(segment)
  const hours = new Intl.DateTimeFormat(locale, { hour: '2-digit', timeZone: forecast.timezone })
  return (
    <figure className="forecast-chart">
      <figcaption>{t('24 Stunden', '24 hours')} · <span>{t('Temperatur °C', 'Temperature °C')}</span> / {t('Niederschlag mm', 'Precipitation mm')}</figcaption>
      <svg viewBox="0 0 280 108" role="img" aria-label={t('Temperatur als orange Linie und stündlicher Niederschlag als blaue Balken; fehlende Werte bleiben ausgespart.', 'Temperature as an orange line and hourly precipitation as blue bars; missing values are left blank.')}>
        <text x="0" y="16">{formatNumber(maximum)}°</text>
        <text x="0" y="80">{formatNumber(minimum)}°</text>
        <text x="278" y="16" textAnchor="end">{formatNumber(rainMaximum, 1)}</text>
        <path d="M28,82 H252" stroke="#54718a" />
        {hourly.time.map((time, index) => {
          const rain = hourly.precipitation[index]
          if (rain == null || !Number.isFinite(rain)) return null
          const height = Math.max(0, rain) / rainMaximum * 62
          return <rect key={time} x={x(index) - 3} y={78 - height} width="6" height={height} fill="#45b9e5">
            <title>{hours.format(new Date(time * 1000))}: {formatNumber(rain, 1)} mm</title>
          </rect>
        })}
        {paths.map((path, index) => <path key={index} d={path} fill="none" stroke="#ffb454" strokeWidth="2" />)}
        {hourly.time.map((time, index) => index % 6 === 0 || index === hourly.time.length - 1
          ? <text key={time} x={x(index)} y="101" textAnchor="middle">{hours.format(new Date(time * 1000))}</text> : null)}
      </svg>
    </figure>
  )
}

export function StationForecast({ latitude, longitude }: Props) {
  const { t, locale } = useLanguage()
  const formatNumber = useNumberFormat()
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [error, setError] = useState(false)
  const [view, setView] = useState<'hourly' | 'daily'>('hourly')
  const [reload, setReload] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setForecast(null)
    setError(false)
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20000)])
    getForecast(latitude, longitude, signal)
      .then((data) => { if (!controller.signal.aborted) setForecast(data) })
      .catch(() => { if (!controller.signal.aborted) setError(true) })
    return () => controller.abort()
  }, [latitude, longitude, reload])

  const timeZone = forecast?.timezone ?? 'Europe/Berlin'
  const hourFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone })
  const dayFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone })

  return (
    <div className="forecast">
      <div className="forecast-tabs" role="group" aria-label={t('Vorhersagezeitraum', 'Forecast period')}>
        <button aria-pressed={view === 'hourly'} onClick={() => setView('hourly')} type="button">{t('24 Stunden', '24 hours')}</button>
        <button aria-pressed={view === 'daily'} onClick={() => setView('daily')} type="button">{t('7 Tage', '7 days')}</button>
      </div>
      {error && <div role="alert">
        <p className="forecast-status">{t('Vorhersage nicht verfügbar.', 'Forecast unavailable.')}</p>
        <button className="reload-button" type="button" onClick={() => setReload((count) => count + 1)}>{t('Erneut versuchen', 'Try again')}</button>
      </div>}
      {!error && !forecast && <p className="forecast-status" role="status">{t('Vorhersage wird geladen …', 'Loading forecast …')}</p>}
      {forecast && view === 'hourly' && <ForecastChart forecast={forecast} />}
      {forecast && view === 'hourly' && (
        <ul className="forecast-list">
          {forecast.hourly.time.map((time, i) => {
            const weather = describe(forecast.hourly.weather_code[i], t)
            return (
              <li key={time} title={weather.text}>
                <span title={dayFormat.format(new Date(time * 1000))}>{hourFormat.format(new Date(time * 1000))}</span>
                <span>{weather.icon}</span>
                <strong>{formatNumber(forecast.hourly.temperature_2m[i])}°</strong>
                <small>{formatNumber(forecast.hourly.precipitation_probability[i])} % · {formatNumber(forecast.hourly.precipitation[i], 1)} mm</small>
                <small className="forecast-wind">Wind {formatNumber(forecast.hourly.wind_speed_10m[i])} km/h</small>
              </li>
            )
          })}
        </ul>
      )}
      {forecast && view === 'daily' && (
        <ul className="forecast-list">
          {forecast.daily.time.map((time, i) => {
            const weather = describe(forecast.daily.weather_code[i], t)
            return (
              <li key={time} title={weather.text}>
                <span>{dayFormat.format(new Date(time * 1000))}</span>
                <span>{weather.icon}</span>
                <strong>{formatNumber(forecast.daily.temperature_2m_max[i])}° / {formatNumber(forecast.daily.temperature_2m_min[i])}°</strong>
                <small>{formatNumber(forecast.daily.precipitation_probability_max[i])} % · {formatNumber(forecast.daily.precipitation_sum[i], 1)} mm</small>
                <small className="forecast-wind">{t('Wind max.', 'Max. wind')} {formatNumber(forecast.daily.wind_speed_10m_max[i])} km/h</small>
              </li>
            )
          })}
        </ul>
      )}
      <small className="forecast-source">{t('Quelle', 'Source')}: <a href="https://open-meteo.com/">Open-Meteo</a>, DWD ICON
        {' · '}<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
        {' · '}{t('Zeit', 'Time')}: {timeZone} · {t('– = keine Daten', '– = no data')}</small>
    </div>
  )
}
