import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLanguage } from './i18n'

export type ForecastLocation = {
  name: string
  latitude: number
  longitude: number
}

type SearchResult = ForecastLocation & { id: number | string; region: string; country: string }

export function LocationSearch({ onSelect }: { onSelect: (place: ForecastLocation) => void }) {
  const { t } = useLanguage()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<'empty' | 'error' | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])

  async function search(event: FormEvent) {
    event.preventDefault()
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setResults([])
    setMessage(null)
    try {
      const response = await fetch(`/api/locations/search?q=${encodeURIComponent(query.trim())}`, {
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Ortssuche fehlgeschlagen. Bitte erneut versuchen.')
      const data = await response.json() as { results: SearchResult[] }
      if (controller.signal.aborted) return
      setResults(data.results)
      if (!data.results.length) setMessage('empty')
    } catch {
      if (!controller.signal.aborted) setMessage('error')
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  return (
    <section className="location-search">
      <form onSubmit={(event) => void search(event)}>
        <label htmlFor="location-query">{t('Ort oder Postleitzahl', 'Town or postal code')}</label>
        <div className="location-search-input">
          <input id="location-query" value={query} minLength={2} maxLength={100} required
            onChange={(event) => {
              request.current?.abort()
              setLoading(false)
              setResults([])
              setMessage(null)
              setQuery(event.target.value)
            }}
            placeholder={t('z. B. München oder 59457', 'e.g. München or 59457')} type="search" />
          <button type="submit" disabled={loading || query.trim().length < 2}>{t('Suchen', 'Search')}</button>
        </div>
      </form>
      <div role="status">{loading ? <p>{t('Orte werden gesucht …', 'Searching for places …')}</p> : message && <p>{message === 'empty'
        ? t('Keine Orte gefunden. Bitte Ortsnamen oder Postleitzahl genauer angeben.', 'No places found. Please enter a more specific town name or postal code.')
        : t('Ortssuche fehlgeschlagen. Bitte erneut versuchen.', 'Location search failed. Please try again.')}</p>}</div>
      {results.length > 0 && (
        <ul className="location-results">
          {results.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => {
                onSelect({ name: [place.name, place.region, place.country].filter(Boolean).join(', '),
                  latitude: place.latitude, longitude: place.longitude })
                setResults([])
                setQuery(place.name)
              }}>
                <strong>{place.name}</strong>
                <small>{[place.region, place.country].filter(Boolean).join(' · ')}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <small>{t('Orte in Deutschland, Österreich und der Schweiz; PLZ für Deutschland. Oder auf die Karte klicken. Suche: Open-Meteo / GeoNames, Zippopotam.us.', 'Places in Germany, Austria and Switzerland; postal codes for Germany. Or click the map. Search: Open-Meteo / GeoNames, Zippopotam.us.')}</small>
    </section>
  )
}
