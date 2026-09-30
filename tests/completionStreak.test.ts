import assert from 'node:assert/strict'
import test from 'node:test'
import {
  completionStreakAfterCompletingDay,
  completionStreakForNewDay,
} from '../src/completionStreak.js'

test('preserves a streak while entering the next consecutive day', () => {
  assert.equal(
    completionStreakForNewDay('2026-09-29', '2026-09-30', true, 5),
    5,
  )
})

test('resets a streak when the prior day was not completed', () => {
  assert.equal(
    completionStreakForNewDay('2026-09-29', '2026-09-30', false, 5),
    0,
  )
})

test('resets a streak when one or more calendar days were skipped', () => {
  assert.equal(
    completionStreakForNewDay('2026-09-28', '2026-09-30', true, 5),
    0,
  )
})

test('increments after completing consecutive days', () => {
  assert.equal(
    completionStreakAfterCompletingDay('2026-09-30', 5, '2026-09-29'),
    6,
  )
})

test('starts at one after a missed day', () => {
  assert.equal(
    completionStreakAfterCompletingDay('2026-09-30', 0, '2026-09-27'),
    1,
  )
})

test('does not increment twice for the same day', () => {
  assert.equal(
    completionStreakAfterCompletingDay('2026-09-30', 6, '2026-09-30'),
    6,
  )
})
