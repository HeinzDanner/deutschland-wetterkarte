import test from 'node:test'
import assert from 'node:assert/strict'
import { radarErrorMessage } from './src/radarError.ts'

test('missing current OPERA data is distinguished from request and image failures in both languages', () => {
  for (const reason of ['Keine aktuellen OPERA-Niederschlagsbilder verfügbar.', 'Keine OPERA-Radarbilder verfügbar.']) {
    assert.match(radarErrorMessage(reason, 'de'), /Keine aktuellen Radardaten beim Anbieter/)
    assert.match(radarErrorMessage(reason, 'en'), /No current radar data is available from the provider/)
  }
  for (const reason of ['Failed to fetch', 'OPERA: HTTP 429', 'OPERA-Radarbild konnte nicht geladen werden.']) {
    assert.match(radarErrorMessage(reason, 'de'), /Bitte erneut laden/)
    assert.match(radarErrorMessage(reason, 'en'), /Please reload/)
  }
})
