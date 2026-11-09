import test from 'node:test'
import assert from 'node:assert/strict'
import { searchLocations } from './location-search.mjs'
import countries from './src/data/searchCountries.json' with { type: 'json' }

test('European country searches use one filtered request with the selected language', async () => {
  for (const country of countries) {
    let calls = 0
    const results = await searchLocations('Example', country, 'en', async (url, options) => {
      calls++
      assert.equal(url.searchParams.get('countryCode'), country)
      assert.equal(url.searchParams.get('language'), 'en')
      assert.equal(url.searchParams.get('count'), '8')
      assert.ok(options.signal instanceof AbortSignal)
      return Response.json({ results: [
        { id: 1, name: 'Small town', country_code: country, country: 'Country', latitude: 50, longitude: 10, population: 10 },
        { id: 2, name: 'Large town', country_code: country, country: 'Country', admin1: 'Region', latitude: 51, longitude: 11, population: 100 },
        { id: 3, name: 'Wrong country', country_code: 'US', population: 1000 },
      ] })
    })
    assert.equal(calls, 1)
    assert.deepEqual(results.map((place) => place.id), [2, 1])
    assert.equal(results[0].region, 'Region')
    assert.equal(results[1].region, '')
  }
})

test('German postcode lookup stays separate, localised and distinguishes missing data from errors', async () => {
  const results = await searchLocations('59457', undefined, 'en', async (url) => {
    assert.equal(url, 'https://api.zippopotam.us/de/59457')
    return Response.json({ places: [{ 'place name': 'Werl', state: 'NRW', latitude: '51.55', longitude: '7.91' }] })
  })
  assert.equal(results[0].name, 'Werl (59457)')
  assert.equal(results[0].country, 'Germany')
  assert.equal(results[0].latitude, 51.55)
  assert.deepEqual(await searchLocations('00000', 'DE', 'de', async () => new Response(null, { status: 404 })), [])
  await assert.rejects(searchLocations('59457', 'DE', 'de', async () => new Response(null, { status: 503 })), /503/)
})

test('search rejects unsupported parameters without contacting an upstream', async () => {
  const unexpected = () => { throw new Error('Unexpected upstream request') }
  for (const [query, country, language] of [
    ['Paris', 'US', 'de'], ['Paris', 'FR', 'fr'], ['75001', 'FR', 'de'],
    ['A', 'DE', 'de'], ['x'.repeat(101), 'DE', 'de'],
  ]) {
    await assert.rejects(searchLocations(query, country, language, unexpected), { status: 400 })
  }
})

test('empty results are not errors but upstream HTTP failures and timeouts propagate', async () => {
  assert.deepEqual(await searchLocations('Paris', 'FR', 'de', async () => Response.json({})), [])
  await assert.rejects(searchLocations('Paris', 'FR', 'de', async () => new Response(null, { status: 429 })), /429/)
  const timeout = new DOMException('Timed out', 'TimeoutError')
  await assert.rejects(searchLocations('Paris', 'FR', 'de', async () => { throw timeout }), { name: 'TimeoutError' })
})
