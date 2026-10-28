import test from 'node:test'
import assert from 'node:assert/strict'
import proj4 from 'proj4'
import { OPERA_COLORS, OPERA_PROJECTION, rateColor } from './opera.mjs'

test('OPERA undetect NaN means no precipitation, not missing coverage', () => {
  assert.deepEqual(rateColor(NaN, -9999000), [0, 0, 0, 0])
  assert.deepEqual(rateColor(0, -9999000), [0, 0, 0, 0])
  assert.deepEqual(rateColor(0.09, -9999000), [0, 0, 0, 0])
})

test('OPERA missing coverage and undetect remain transparent without hatching', () => {
  assert.deepEqual(rateColor(-9999000, -9999000), [0, 0, 0, 0])
  assert.deepEqual(rateColor(Infinity, -9999000), [0, 0, 0, 0])
  assert.deepEqual(rateColor(-1, -9999000, -1), [0, 0, 0, 0])
})

test('rain-rate thresholds and legend use identical colors', () => {
  for (const [threshold, rgb] of OPERA_COLORS) {
    assert.deepEqual(rateColor(threshold, -9999000), [...rgb, 210])
  }
  assert.deepEqual(rateColor(100, -9999000), [...OPERA_COLORS.at(-1)[1], 210])
})

test('native LAEA coordinates correctly position central Europe', () => {
  const center = proj4('EPSG:4326', OPERA_PROJECTION, [10, 55])
  assert.ok(Math.abs(center[0] - 1950000) < 0.01)
  assert.ok(Math.abs(center[1] + 2100000) < 0.01)
  const munich = proj4('EPSG:4326', OPERA_PROJECTION, [11.58, 48.14])
  assert.ok(munich[0] > -1000 && munich[0] < 3799000)
  assert.ok(munich[1] > -4399000 && munich[1] < 1000)
  const roundTrip = proj4(OPERA_PROJECTION, 'EPSG:4326', munich)
  assert.ok(Math.abs(roundTrip[0] - 11.58) < 0.00001)
  assert.ok(Math.abs(roundTrip[1] - 48.14) < 0.00001)
})
