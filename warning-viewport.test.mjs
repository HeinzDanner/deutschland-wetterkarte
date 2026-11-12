import test from 'node:test'
import assert from 'node:assert/strict'
import Feature from 'ol/Feature.js'
import Polygon from 'ol/geom/Polygon.js'
import { highestWarningLevel, warningsInExtent } from './src/warningViewport.ts'

const now = Date.parse('2026-11-12T06:00:00Z')
const local = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
function feature(level, ring = local, onset = now - 1000, expires = now + 1000) {
  return new Feature({
    geometry: new Polygon([ring]),
    warning: { level, onset: new Date(onset).toISOString(), expires: new Date(expires).toISOString() },
  })
}

test('mobile warning summary includes only currently active warnings intersecting the viewport', () => {
  const active = feature(2, local, now)
  const future = feature(4, local, now + 1)
  const expired = feature(4, local, now - 1000, now)
  const outside = feature(4, [[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]])
  const visible = warningsInExtent([active, future, expired, outside], [1, 1, 2, 2], now)
  assert.deepEqual(visible, [active])
  assert.equal(highestWarningLevel(visible), 2)
  assert.equal(highestWarningLevel(warningsInExtent([active], [40, 40, 50, 50], now)), null)
})

test('warning viewport intersection respects polygon holes, not just bounding boxes', () => {
  const withHole = feature(3)
  withHole.setGeometry(new Polygon([local, [[2, 2], [2, 8], [8, 8], [8, 2], [2, 2]]]))
  assert.deepEqual(warningsInExtent([withHole], [3, 3, 4, 4], now), [])
  assert.equal(highestWarningLevel(warningsInExtent([withHole], [0, 0, 1, 1], now)), 3)
})

test('summary selects the highest recognized level and never invents warning freedom', () => {
  assert.equal(highestWarningLevel([feature(1), feature(4), feature(2)]), 4)
  assert.equal(highestWarningLevel([feature(0), feature(5), feature(NaN)]), null)
  assert.equal(highestWarningLevel([]), null)
})
