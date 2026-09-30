import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateHydrationUpdate,
  type HydrationProgress,
} from '../src/hydration.js'

function createProgress(
  overrides: Partial<HydrationProgress> = {},
): HydrationProgress {
  return {
    waterGoalOunces: 64,
    waterScoringGoalOunces: 0,
    waterConsumedOunces: 0,
    waterScoredOunces: 0,
    waterCupBonusesAwarded: 0,
    ...overrides,
  }
}

test('fills independent 32-ounce cups and awards each cup surge once', () => {
  const firstCup = calculateHydrationUpdate(createProgress(), 32)
  assert.equal(firstCup.ouncePoints + firstCup.cupBonusPoints, 57)
  assert.equal(firstCup.newlyCompletedCups, 1)

  const fiftyOunces = calculateHydrationUpdate(
    createProgress({
      waterScoringGoalOunces: firstCup.waterScoringGoalOunces,
      waterConsumedOunces: firstCup.waterConsumedOunces,
      waterScoredOunces: firstCup.waterScoredOunces,
      waterCupBonusesAwarded: firstCup.waterCupBonusesAwarded,
    }),
    50,
  )
  assert.equal(fiftyOunces.ouncePoints + fiftyOunces.cupBonusPoints, 18)
  assert.equal(fiftyOunces.newlyCompletedCups, 0)

  const secondCup = calculateHydrationUpdate(
    createProgress({
      waterScoringGoalOunces: fiftyOunces.waterScoringGoalOunces,
      waterConsumedOunces: fiftyOunces.waterConsumedOunces,
      waterScoredOunces: fiftyOunces.waterScoredOunces,
      waterCupBonusesAwarded: fiftyOunces.waterCupBonusesAwarded,
    }),
    64,
  )
  assert.equal(secondCup.ouncePoints + secondCup.cupBonusPoints, 39)
  assert.equal(secondCup.newlyCompletedCups, 1)
})

test('awards double points above the original goal', () => {
  const update = calculateHydrationUpdate(
    createProgress({ waterGoalOunces: 40 }),
    50,
  )

  assert.equal(update.baseOunces, 40)
  assert.equal(update.bonusOunces, 10)
  assert.equal(update.ouncePoints + update.cupBonusPoints, 85)
})

test('does not subtract or re-award points after a decrease', () => {
  const decrease = calculateHydrationUpdate(
    createProgress({
      waterScoringGoalOunces: 64,
      waterConsumedOunces: 50,
      waterScoredOunces: 50,
      waterCupBonusesAwarded: 1,
    }),
    10,
  )
  assert.equal(decrease.ouncePoints + decrease.cupBonusPoints, 0)
  assert.equal(decrease.waterScoredOunces, 50)
  assert.equal(decrease.waterCupBonusesAwarded, 1)

  const reentry = calculateHydrationUpdate(
    createProgress({
      waterScoringGoalOunces: decrease.waterScoringGoalOunces,
      waterConsumedOunces: decrease.waterConsumedOunces,
      waterScoredOunces: decrease.waterScoredOunces,
      waterCupBonusesAwarded: decrease.waterCupBonusesAwarded,
    }),
    50,
  )
  assert.equal(reentry.ouncePoints + reentry.cupBonusPoints, 0)
  assert.equal(reentry.newlyCompletedCups, 0)
})

test('handles multiple cup thresholds crossed in one update', () => {
  const update = calculateHydrationUpdate(createProgress(), 96)

  assert.equal(update.baseOunces, 64)
  assert.equal(update.bonusOunces, 32)
  assert.equal(update.newlyCompletedCups, 3)
  assert.equal(update.ouncePoints + update.cupBonusPoints, 203)
})

test('preserves the original scoring goal after goal edits', () => {
  const update = calculateHydrationUpdate(
    createProgress({
      waterGoalOunces: 96,
      waterScoringGoalOunces: 40,
      waterConsumedOunces: 32,
      waterScoredOunces: 32,
      waterCupBonusesAwarded: 1,
    }),
    50,
  )

  assert.equal(update.baseOunces, 8)
  assert.equal(update.bonusOunces, 10)
  assert.equal(update.ouncePoints + update.cupBonusPoints, 28)
  assert.equal(update.waterScoringGoalOunces, 40)
})

test('migrated consumption is not awarded retroactively', () => {
  const update = calculateHydrationUpdate(
    createProgress({
      waterConsumedOunces: 50,
      waterScoredOunces: 50,
      waterCupBonusesAwarded: 1,
    }),
    50,
  )

  assert.equal(update.ouncePoints + update.cupBonusPoints, 0)
})
