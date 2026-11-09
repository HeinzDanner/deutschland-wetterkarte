import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeWarningAreas } from './src/warningAreas.ts'

const properties = {
  level: 2, event: 'Rain', headline: 'Rain warning', description: 'Rain',
  instruction: '', onset: '2026-11-09T08:00:00Z', expires: '2026-11-09T20:00:00Z',
  altitude: null, ceiling: null,
}
const area = (x, overrides = {}) => ({
  geometry: { type: 'Polygon', coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] },
  properties: { ...properties, ...overrides },
})

test('adjacent municipalities become one outline without their internal border', () => {
  const result = mergeWarningAreas([area(0), area(1)])
  assert.equal(result.length, 1)
  assert.deepEqual(result[0].geometry.coordinates, [[[[0, 0], [2, 0], [2, 1], [0, 1], [0, 0]]]])
})

test('distinct severities, validity periods and texts remain separate', () => {
  assert.equal(mergeWarningAreas([area(0), area(1, { level: 3 })]).length, 2)
  assert.equal(mergeWarningAreas([area(0), area(1, { expires: '2026-11-10T20:00:00Z' })]).length, 2)
  assert.equal(mergeWarningAreas([area(0), area(1, { description: 'Different warning' })]).length, 2)
})

test('disconnected areas and holes are preserved; input is not modified', () => {
  const hole = {
    geometry: { type: 'MultiPolygon', coordinates: [[
      [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
      [[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]],
    ]] },
    properties,
  }
  const before = JSON.stringify(hole)
  const result = mergeWarningAreas([hole, area(6)])
  assert.equal(result[0].geometry.coordinates.length, 2)
  assert.equal(result[0].geometry.coordinates[0].length, 2)
  assert.equal(JSON.stringify(hole), before)
  assert.deepEqual(mergeWarningAreas([]), [])
})
