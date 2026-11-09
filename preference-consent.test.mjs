import test from 'node:test'
import assert from 'node:assert/strict'
import { CONSENT_KEY, PREFERENCE_KEYS, clearPreferences, readConsent, setConsent } from './src/preferenceConsent.ts'

function memoryStorage() {
  const data = new Map()
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  }
}

test('only explicit versioned consent enables preferences', () => {
  const storage = memoryStorage()
  assert.equal(readConsent(storage), null)
  for (const raw of ['yes', '{}', '{"version":2,"choice":"accepted","decidedAt":"2026-01-01"}',
    '{"version":1,"choice":"accepted","decidedAt":"invalid"}']) {
    storage.setItem(CONSENT_KEY, raw)
    assert.equal(readConsent(storage), null)
  }
  const record = setConsent(storage, 'accepted')
  assert.equal(readConsent(storage).choice, 'accepted')
  assert.equal(record.version, 1)
  assert.ok(Number.isFinite(Date.parse(record.decidedAt)))
})

test('rejecting or withdrawing removes all preferences but preserves other data', () => {
  const storage = memoryStorage()
  setConsent(storage, 'accepted')
  for (const key of PREFERENCE_KEYS) storage.setItem(key, 'saved')
  storage.setItem('unrelated', 'keep')
  setConsent(storage, 'rejected')
  assert.equal(readConsent(storage).choice, 'rejected')
  for (const key of PREFERENCE_KEYS) assert.equal(storage.getItem(key), null)
  assert.equal(storage.getItem('unrelated'), 'keep')
  clearPreferences(storage)
  assert.equal(readConsent(storage).choice, 'rejected')
})
