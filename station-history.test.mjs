import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { recordStationAvailability } from './station-history.mjs'

test('persists outages, repeated checks, recovery and subsequent outages', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'station-history-'))
  const file = join(directory, 'history.json')
  const station = { id: '10004', name: 'Teststation', reason: 'Keine Temperatur' }
  const record = (available, unavailable, time) =>
    recordStationAvailability(available, unavailable, { file, checkedAt: `2026-10-28T${time}:00Z` })
  try {
    await record([], [station], '09:00')
    await record([], [{ ...station, reason: 'HTTP 503' }], '09:05')
    await record([station], [], '09:10')
    await record([], [station], '09:15')
    const history = JSON.parse(await readFile(file, 'utf8'))
    assert.equal(history.stations['10004'].outages.length, 2)
    assert.deepEqual(history.stations['10004'].outages[0], {
      firstObservedAt: '2026-10-28T09:00:00Z',
      lastObservedAt: '2026-10-28T09:05:00Z',
      firstReason: 'Keine Temperatur',
      lastReason: 'HTTP 503',
      failedChecks: 2,
      recoveredAt: '2026-10-28T09:10:00Z',
    })
    assert.equal(history.stations['10004'].outages[1].recoveredAt, null)
    assert.equal(history.updatedAt, '2026-10-28T09:15:00Z')
    await writeFile(file, '{"version":999}')
    await assert.rejects(record([], [station], '09:20'), /Ungültige/)
    assert.equal(await readFile(file, 'utf8'), '{"version":999}')
    await writeFile(file, '{broken')
    await assert.rejects(record([], [station], '09:20'), SyntaxError)
    assert.equal(await readFile(file, 'utf8'), '{broken')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
