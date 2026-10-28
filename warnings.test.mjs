import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeWarning } from './warnings.mjs'

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
