import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLanguage } from './i18n'
import countries from './data/searchCountries.json'

export type ForecastLocation = {
  name: string
  latitude: number
  longitude: number
}

type SearchResult = ForecastLocation & { id: number | string; region: string; country: string }

export function LocationSearch({ onSelect }: { onSelect: (place: ForecastLocation) => void }) {
  const { t, language, locale } = useLanguage()
  const [country, setCountry] = useState('DE')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<'empty' | 'error' | 'postcode' | null>(null)
  const request = useRef<AbortController | null>(null)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    request.current?.abort()
    setLoading(false)
    setResults([])
    setMessage(null)
  }, [country, language])
  const regionNames = new Intl.DisplayNames([locale], { type: 'region' })
  const countryOptions = countries.map((code) => ({ code, name: regionNames.of(code) ?? code }))
    .sort((a, b) => a.name.localeCompare(b.name, locale))

  async function search(event: FormEvent) {
    event.preventDefault()
    request.current?.abort()
    if (country !== 'DE' && /^\d+$/.test(query.trim())) {
      setLoading(false)
      setResults([])
      setMessage('postcode')
      return
    }
    const controller = new AbortController()
    request.current = controller
    setLoading(true)
    setResults([])
    setMessage(null)
    try {
      const params = new URLSearchParams({ q: query.trim(), country, language })
      const response = await fetch(`/api/locations/search?${params}`, {
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
        <label htmlFor="location-country">{t('Land für die Ortssuche', 'Country for location search')}</label>
        <select id="location-country" value={country} onChange={(event) => setCountry(event.target.value)}>
          {countryOptions.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
        </select>
        <label htmlFor="location-query">{country === 'DE'
          ? t('Ort oder Postleitzahl', 'Town or postal code') : t('Ort', 'Town')}</label>
        <div className="location-search-input">
          <input id="location-query" value={query} minLength={2} maxLength={100} required
            onChange={(event) => {
              request.current?.abort()
              setLoading(false)
              setResults([])
              setMessage(null)
              setQuery(event.target.value)
            }}
            placeholder={country === 'DE' ? t('z. B. München oder 59457', 'e.g. München or 59457')
              : t('Ortsnamen eingeben', 'Enter a town name')} type="search" />
          <button type="submit" disabled={loading || query.trim().length < 2}>{t('Suchen', 'Search')}</button>
        </div>
      </form>
      <div role="status">{loading ? <p>{t('Orte werden gesucht …', 'Searching for places …')}</p> : message && <p>{message === 'postcode'
        ? t('Postleitzahlsuche nur für Deutschland. Bitte einen Ortsnamen eingeben.', 'Postcode search is only available for Germany. Please enter a town name.')
        : message === 'empty'
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
      <small>{t('Orte im gewählten europäischen Land; PLZ nur für Deutschland. Oder auf die Karte klicken. Suche: ',
        'Places in the selected European country; postcodes for Germany only. Or click the map. Search: ')}
        <a href="https://open-meteo.com/">Open-Meteo</a> / <a href="https://www.geonames.org/">GeoNames</a>,
        {' '}<a href="https://www.zippopotam.us/">Zippopotam.us</a>.</small>
    </section>
  )
}
