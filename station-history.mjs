import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HISTORY_FILE = new URL('./data/station-outages.json', import.meta.url)

export async function recordStationAvailability(available, unavailable, {
  file = HISTORY_FILE,
  checkedAt = new Date().toISOString(),
} = {}) {
  let history
  try {
    history = JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    history = { version: 1, updatedAt: null, stations: {} }
  }
  if (history.version !== 1 || !history.stations || typeof history.stations !== 'object' ||
    Array.isArray(history.stations) || Object.values(history.stations).some((station) =>
      !Array.isArray(station.outages) || station.outages.some((outage) =>
        !outage || !Number.isFinite(Date.parse(outage.firstObservedAt)) ||
        !Number.isFinite(Date.parse(outage.lastObservedAt)) ||
        (outage.recoveredAt !== null && !Number.isFinite(Date.parse(outage.recoveredAt)))))) {
    throw new Error('Ungültige lokale Stations-Ausfallhistorie; Datei bleibt unverändert.')
  }
  for (const station of unavailable) {
    const entry = history.stations[station.id] ??= { name: station.name, outages: [] }
    entry.name = station.name
    const last = entry.outages.at(-1)
    if (last && last.recoveredAt === null) {
      last.lastObservedAt = checkedAt
      last.lastReason = station.reason
      last.failedChecks++
    } else {
      entry.outages.push({
        firstObservedAt: checkedAt,
        lastObservedAt: checkedAt,
        firstReason: station.reason,
        lastReason: station.reason,
        failedChecks: 1,
        recoveredAt: null,
      })
    }
  }
  for (const station of available) {
    const last = history.stations[station.id]?.outages.at(-1)
    if (last && last.recoveredAt === null) last.recoveredAt = checkedAt
  }
  history.updatedAt = checkedAt
  const path = file instanceof URL ? fileURLToPath(file) : file
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.tmp`
  await writeFile(temporary, `${JSON.stringify(history, null, 2)}\n`, 'utf8')
  await rename(temporary, file)
}
