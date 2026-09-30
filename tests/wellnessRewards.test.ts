import assert from 'node:assert/strict'
import test from 'node:test'
import { movementMeetingPoints } from '../src/wellnessRewards.js'

test('awards 100 points for a standing meeting', () => {
  assert.equal(movementMeetingPoints('stand'), 100)
})

test('awards 200 points for a walking meeting', () => {
  assert.equal(movementMeetingPoints('walk'), 200)
})

test('does not award movement points for a regular meeting', () => {
  assert.equal(movementMeetingPoints('none'), 0)
})
