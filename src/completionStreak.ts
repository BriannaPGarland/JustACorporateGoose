function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

export function completionStreakForNewDay(
  previousDate: string,
  nextDate: string,
  previousDayCompleted: boolean,
  previousStreak: number,
) {
  if (!previousDayCompleted || previousDateKey(nextDate) !== previousDate) {
    return 0
  }

  return Math.max(1, previousStreak)
}

export function completionStreakAfterCompletingDay(
  date: string,
  currentStreak: number,
  lastCompletedDay?: string,
) {
  if (lastCompletedDay === date) {
    return currentStreak
  }

  return lastCompletedDay === previousDateKey(date)
    ? Math.max(0, currentStreak) + 1
    : 1
}
