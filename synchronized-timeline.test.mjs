import test from 'node:test'
import assert from 'node:assert/strict'
import { commonFrameTimes } from './src/synchronizedTimeline.ts'

test('matches actual timestamps rather than frame positions or string formatting', () => {
  assert.deepEqual(commonFrameTimes(
    ['2026-11-09T08:30:00Z', '2026-11-09T08:00:00Z', '2026-11-09T08:15:00Z', '2026-11-09T08:00:00Z'],
    ['2026-11-09T09:00:00+01:00', '2026-11-09T08:15:00.000Z', '2026-11-09T07:45:00Z'],
  ), ['2026-11-09T08:00:00.000Z', '2026-11-09T08:15:00.000Z'])
})

test('does not substitute nearby or unavailable image times', () => {
  assert.deepEqual(commonFrameTimes(['2026-11-09T08:00:00Z'], ['2026-11-09T08:01:00Z']), [])
  assert.deepEqual(commonFrameTimes([], ['2026-11-09T08:00:00Z']), [])
  assert.deepEqual(commonFrameTimes(['invalid'], ['invalid']), [])
})
