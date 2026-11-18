import test from 'node:test'
import assert from 'node:assert/strict'
import { getWarnings, normalizeWarning } from './warnings.mjs'

const now = Date.parse('2026-10-28T10:00:00Z')
function feature(properties = {}) {
  return {
    type: 'Feature', id: 'warning.1',
    geometry: { type: 'Polygon', coordinates: [[[10, 50], [11, 50], [11, 51], [10, 50]]] },
    properties: {
      IDENTIFIER: 'test-warning', STATUS: 'Actual', SCOPE: 'Public', MSGTYPE: 'Alert',
      LANGUAGE: 'de-DE', HEADLINE: 'Amtliche Warnung vor STURMBÖEN',
      DESCRIPTION: 'Originaltext', INSTRUCTION: 'Bitte beachten.',
      ONSET: '2026-10-28T09:00:00Z', EXPIRES: '2026-10-28T12:00:00Z',
      SEVERITY: 'Severe', ...properties,
    },
  }
}

test('preserves geometry and original text and maps severity', () => {
  const raw = feature()
  const result = normalizeWarning(raw, now)
  assert.equal(result.properties.level, 3)
  assert.equal(result.properties.description, 'Originaltext')
  assert.deepEqual(result.geometry, raw.geometry)
  for (const [severity, level] of [['Minor', 1], ['Moderate', 2], ['Severe', 3], ['Extreme', 4], ['Unknown', 0]]) {
    assert.equal(normalizeWarning(feature({ SEVERITY: severity }), now).properties.level, level)
  }
})

test('excludes expired, cancelled, test, private and duplicate-language warnings', () => {
  for (const props of [
    { EXPIRES: '2026-10-28T10:00:00Z' }, { MSGTYPE: 'Cancel' },
    { STATUS: 'Test' }, { SCOPE: 'Private' }, { LANGUAGE: 'en-US' },
  ]) assert.equal(normalizeWarning(feature(props), now), null)
})

test('keeps upcoming warnings and rejects malformed required values', () => {
  assert.ok(normalizeWarning(feature({ ONSET: '2026-10-28T11:00:00Z' }), now))
  assert.throws(() => normalizeWarning(feature({ EXPIRES: 'bad' }), now))
  assert.throws(() => normalizeWarning({ ...feature(), geometry: null }, now))
})

test('fetches all pages beyond 20,000 entries and keeps upcoming warnings', async (t) => {
  const expires = new Date(Date.now() + 2 * 3600000).toISOString()
  const onset = new Date(Date.now() + 3600000).toISOString()
  const offsets = []
  const filters = new Set()
  t.mock.method(globalThis, 'fetch', async (url) => {
    const start = Number(url.searchParams.get('startIndex'))
    const count = Number(url.searchParams.get('count'))
    assert.equal(count, 2000)
    assert.equal(url.searchParams.get('sortBy'), 'IDENTIFIER,WARNCELLID,LANGUAGE')
    offsets.push(start)
    filters.add(url.searchParams.get('CQL_FILTER'))
    const features = Array.from({ length: Math.min(count, 20204 - start) }, (_, index) => ({
      ...feature({ ONSET: onset, EXPIRES: expires }),
      id: `warning.${start + index}`,
    }))
    return { ok: true, json: async () => ({ type: 'FeatureCollection', features }) }
  })

  const result = await getWarnings()
  assert.deepEqual(offsets, Array.from({ length: 11 }, (_, index) => index * 2000))
  assert.equal(filters.size, 1)
  assert.match([...filters][0], /STATUS = 'Actual'.*SCOPE = 'Public'.*MSGTYPE <> 'Cancel'.*EXPIRES > '\d{4}-/)
  assert.equal(result.features.length, 20204)
  assert.equal(result.features.at(-1).id, 'warning.20203')
  assert.equal(result.features.at(-1).properties.onset, onset)
})

test('continues when DWD caps a page below the requested size', async (t) => {
  const { getWarnings: loadWarnings } = await import('./warnings.mjs?limited-pages')
  const expires = new Date(Date.now() + 3600000).toISOString()
  const offsets = []
  t.mock.method(globalThis, 'fetch', async (url) => {
    const start = Number(url.searchParams.get('startIndex'))
    offsets.push(start)
    const features = Array.from({ length: Math.min(2, 5 - start) }, (_, index) => ({
      ...feature({ EXPIRES: expires }),
      id: `warning.${start + index}`,
    }))
    return { ok: true, json: async () => ({ type: 'FeatureCollection', numberMatched: 5, features }) }
  })

  assert.equal((await loadWarnings()).features.length, 5)
  assert.deepEqual(offsets, [0, 2, 4])
})
