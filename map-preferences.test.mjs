import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_VIEW, DEFAULT_LAYERS, validView, validLayers } from './src/mapPreferences.ts'

test('accepts default and saved map views but rejects invalid coordinates and zoom', () => {
  assert.ok(validView(DEFAULT_VIEW))
  assert.ok(validView({ center: [8.6, 50.1], zoom: 9 }))
  for (const value of [null, {}, { center: [Infinity, 50], zoom: 9 },
    { center: [181, 50], zoom: 9 }, { center: [10, 90], zoom: 9 },
    { center: [10, 50], zoom: 13 }, { center: [10, 50], zoom: '9' }]) {
    assert.equal(validView(value), false)
  }
})

test('validates all layer switches and opacity without interpreting strings as booleans', () => {
  assert.ok(validLayers(DEFAULT_LAYERS))
  assert.ok(validLayers({ ...DEFAULT_LAYERS, warnings: false, satelliteOpacity: 0.4 }))
  for (const value of [null, {}, { ...DEFAULT_LAYERS, opera: 'false' },
    { ...DEFAULT_LAYERS, satelliteOpacity: null }, { ...DEFAULT_LAYERS, satelliteOpacity: 1.1 }]) {
    assert.equal(validLayers(value), false)
  }
})
