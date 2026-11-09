import countries from './src/data/searchCountries.json' with { type: 'json' }

export async function searchLocations(query, country = 'DE', language = 'de', fetchUpstream = fetch) {
  if (!countries.includes(country) || !['de', 'en'].includes(language)
    || query.length < 2 || query.length > 100 || (country !== 'DE' && /^\d+$/.test(query))) {
    throw Object.assign(new Error('Ungültige Suchparameter. Postleitzahlsuche wird nur für Deutschland unterstützt.'), { status: 400 })
  }
  if (country === 'DE' && /^\d{5}$/.test(query)) {
    const upstream = await fetchUpstream(`https://api.zippopotam.us/de/${query}`, {
      signal: AbortSignal.timeout(15000),
    })
    if (!upstream.ok && upstream.status !== 404) throw new Error(`PLZ-Suche antwortete mit HTTP ${upstream.status}.`)
    const data = upstream.status === 404 ? null : await upstream.json()
    return (data?.places ?? []).map((place, index) => ({
      id: `${query}-${index}`,
      name: `${place['place name']} (${query})`,
      region: place.state ?? '',
      country: language === 'en' ? 'Germany' : 'Deutschland',
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
    }))
  }
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', query)
  url.searchParams.set('countryCode', country)
  url.searchParams.set('count', '8')
  url.searchParams.set('language', language)
  url.searchParams.set('format', 'json')
  const upstream = await fetchUpstream(url, { signal: AbortSignal.timeout(15000) })
  if (!upstream.ok) throw new Error(`Ortssuche antwortete mit HTTP ${upstream.status}.`)
  const data = await upstream.json()
  return (data.results ?? [])
    .filter((place) => place.country_code === country)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    .slice(0, 8).map((place) => ({
      id: place.id,
      name: place.name,
      region: place.admin1 ?? '',
      country: place.country ?? '',
      latitude: place.latitude,
      longitude: place.longitude,
    }))
}
