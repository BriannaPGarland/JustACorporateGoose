export const WATER_CUP_OUNCES = 32
export const WATER_CUP_BONUS_POINTS = 25

export interface HydrationProgress {
  waterGoalOunces: number
  waterScoringGoalOunces: number
  waterConsumedOunces: number
  waterScoredOunces: number
  waterCupBonusesAwarded: number
}

export interface HydrationUpdate {
  waterConsumedOunces: number
  waterScoringGoalOunces: number
  waterScoredOunces: number
  waterCupBonusesAwarded: number
  baseOunces: number
  bonusOunces: number
  newlyCompletedCups: number
  ouncePoints: number
  cupBonusPoints: number
}

export function calculateHydrationUpdate(
  current: HydrationProgress,
  requestedOunces: number,
): HydrationUpdate {
  const nextConsumption =
    Math.round(Math.max(0, Math.min(512, requestedOunces)) * 10) / 10
  const previousScoredOunces = Math.max(0, current.waterScoredOunces)
  const nextScoredOunces = Math.max(previousScoredOunces, nextConsumption)
  const scoringGoal =
    current.waterScoringGoalOunces > 0
      ? current.waterScoringGoalOunces
      : current.waterGoalOunces
  const scoringEnabled = scoringGoal > 0
  const baseOunces = scoringEnabled
    ? Math.max(
        0,
        Math.min(nextScoredOunces, scoringGoal) -
          Math.min(previousScoredOunces, scoringGoal),
      )
    : 0
  const bonusOunces = scoringEnabled
    ? Math.max(0, nextScoredOunces - scoringGoal) -
      Math.max(0, previousScoredOunces - scoringGoal)
    : 0
  const completedCups = Math.floor(nextScoredOunces / WATER_CUP_OUNCES)
  const newlyCompletedCups = scoringEnabled
    ? Math.max(0, completedCups - current.waterCupBonusesAwarded)
    : 0

  return {
    waterConsumedOunces: nextConsumption,
    waterScoringGoalOunces: scoringGoal,
    waterScoredOunces: nextScoredOunces,
    waterCupBonusesAwarded: Math.max(
      current.waterCupBonusesAwarded,
      completedCups,
    ),
    baseOunces,
    bonusOunces,
    newlyCompletedCups,
    ouncePoints: Math.round((baseOunces + bonusOunces * 2) * 10) / 10,
    cupBonusPoints: newlyCompletedCups * WATER_CUP_BONUS_POINTS,
  }
}
