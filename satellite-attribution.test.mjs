import test from 'node:test'
import assert from 'node:assert/strict'
import { satelliteSource, satelliteDataYear, satelliteMapAttribution } from './src/satelliteAttribution.ts'

test('satellite attribution identifies the confirmed EUMETView layer and licence', () => {
  assert.equal(satelliteSource.layer, 'msg_fes:ir108')
  assert.equal(satelliteSource.url, 'https://view.eumetsat.int/geoserver/ows')
  const attribution = satelliteMapAttribution('2024-12-31T23:45:00.000Z')
  assert.match(attribution, /EUMETSAT Meteosat<\/a> 2024/)
  assert.ok(attribution.includes(`href="${satelliteSource.sourceUrl}"`))
  assert.ok(attribution.includes('href="https://creativecommons.org/licenses/by/4.0/"'))
  assert.match(attribution, /CC BY 4.0/)
})

test('data year comes from valid UTC image metadata, never the current calendar', () => {
  assert.equal(satelliteDataYear('2024-12-31T23:45:00Z'), '2024')
  assert.equal(satelliteDataYear('2025-01-01T00:00:00.000Z'), '2025')
  for (const time of [null, '', 'not-a-date', '2026', '2026-02-30T00:00:00Z', '2026-01-01T00:00:00+02:00']) {
    assert.equal(satelliteDataYear(time), null)
  }
})
