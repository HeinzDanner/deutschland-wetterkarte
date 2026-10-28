import test from 'node:test'
import assert from 'node:assert/strict'
import { retainedRadarIndex } from './src/radarTimeline.ts'

const frames = ['09:00', '09:15', '09:30'].map((time) => `2026-10-28T${time}:00Z`)
test('initial radar view uses latest, refresh preserves selected timestamp', () => {
  assert.equal(retainedRadarIndex(frames), 2)
  assert.equal(retainedRadarIndex(frames, frames[1]), 1)
  assert.equal(retainedRadarIndex(frames.slice(1), frames[1]), 0)
  assert.equal(retainedRadarIndex(frames.slice(1), frames[2]), 1)
})
test('expired or missing selected frames move to closest available timestamp', () => {
  assert.equal(retainedRadarIndex(frames.slice(1), frames[0]), 0)
  assert.equal(retainedRadarIndex([frames[0], frames[2]], frames[1]), 0)
})
