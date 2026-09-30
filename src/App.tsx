import {
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import {
  completionStreakAfterCompletingDay,
  completionStreakForNewDay,
} from './completionStreak'
import appIconUrl from '../build/icon.png'
import angryGooseUrl from './assets/goose/angry.png'
import celebratingGooseUrl from './assets/goose/celebrating.png'
import codingGooseUrl from './assets/goose/coding.png'
import coffeeGooseUrl from './assets/goose/coffee.png'
import happyGooseUrl from './assets/goose/happy.png'
import lunchFullGooseUrl from './assets/goose/lunch-full.png'
import lunchHungryGooseUrl from './assets/goose/lunch-hungry.png'
import lunchGooseUrl from './assets/goose/lunch.png'
import meetingGooseUrl from './assets/goose/meeting.png'
import phoneGooseUrl from './assets/goose/phone.png'
import readingGooseUrl from './assets/goose/reading.png'
import relaxingGooseUrl from './assets/goose/relaxing.png'
import sittingGooseUrl from './assets/goose/sitting.png'
import standingGooseUrl from './assets/goose/standing.png'
import studyingGooseUrl from './assets/goose/studying.png'
import thumbsUpGooseUrl from './assets/goose/thumbs-up.png'
import waddlingGooseUrl from './assets/goose/waddling.png'
import walkingGooseUrl from './assets/goose/walking.png'
import {
  calculateHydrationUpdate,
  WATER_CUP_OUNCES,
} from './hydration'
import { movementMeetingPoints } from './wellnessRewards'

type Screen = 'welcome' | 'morning' | 'planning' | 'focus' | 'day-complete'
type TaskStatus = 'todo' | 'done'
type TaskSource = 'manual' | 'rollover' | 'suggested'

interface DailyTask {
  id: string
  title: string
  notes: string
  durationMinutes: number
  status: TaskStatus
  source: TaskSource
  scheduledFor: string
  subtasks: string[]
  completedSubtasks: string[]
  kind: 'work' | 'pr-review'
  isBackground: boolean
  backgroundReminderMinutes: number
  isStretchGoal: boolean
  elapsedSeconds: number
  manualPauseCount: number
  focusDriftCount: number
  scoreAwarded: boolean
  completedAt?: number
}

interface ScoreEvent {
  id: string
  timestamp: number
  points: number
  label: string
}

interface DailyScoreSummary {
  date: string
  score: number
  completedTasks: number
  uninterruptedCompletions: number
  longestFocusStreak: number
  morningSetupCompleted?: boolean
}

interface BadgeStatus {
  id: string
  title: string
  description: string
  icon: string
  progress: number
  target: number
  unlocked: boolean
}

interface BehaviorBaseline {
  trackedDays: number
  calibrated: boolean
  averageTasks: number
  averageFocusedTasks: number
  averagePoints: number
  morningSetupDays: number
}

interface FutureTask {
  id: string
  title: string
  targetDate: string
  notes: string
  durationMinutes?: number
  isBackground?: boolean
  backgroundReminderMinutes?: number
  isStretchGoal?: boolean
}

interface CompletedTaskRecord {
  id: string
  taskId: string
  date: string
  title: string
  notes: string
  durationMinutes: number
  elapsedSeconds: number
  completedAt: number
  isBackground: boolean
  isStretchGoal: boolean
}

interface DailyState {
  date: string
  screen: Screen
  morningStartedAt?: number
  morningChecks: Record<string, boolean>
  tasks: DailyTask[]
  futureTasks: FutureTask[]
  activeTaskIndex: number
  previousTaskId?: string
  taskStartedAt?: number
  pauseStartedAt?: number
  pausedSeconds: number
  isPaused: boolean
  activityAwareness: boolean
  dismissedReminders: string[]
  dismissedMovementPrompts: string[]
  exitedMeetingKeys: string[]
  movementMeetingStartedKeys: string[]
  rewardedMovementMeetingKeys: string[]
  meetings: CalendarMeeting[]
  meetingsLoaded: boolean
  calendarError: string
  lunchStart: string
  lunchDurationMinutes: 0 | 30 | 60
  lunchInProgress: boolean
  lunchCompleted: boolean
  lunchesCompleted: number
  workdayMinutes: number
  waterGoalOunces: number
  waterReminderCount: number
  waterScoringGoalOunces: number
  waterConsumedOunces: number
  waterScoredOunces: number
  waterCupBonusesAwarded: number
  waterGoalAwardedToday: boolean
  waterGoalsCompleted: number
  prReviewStart: string
  pauseReason?:
    | 'manual'
    | 'calendar'
    | 'meeting-ended'
    | 'ready'
    | 'reminder'
    | 'end-of-day'
  backgroundRemindersStartedAt?: number
  endOfDayCelebrated: boolean
  endOfDayDismissed: boolean
  workdayExtensionSeconds: number
  score: number
  scoreEvents: ScoreEvent[]
  completedTasksToday: number
  uninterruptedCompletionsToday: number
  morningSetupAwarded: boolean
  focusStreak: number
  longestFocusStreak: number
  latePenaltyHoursApplied: number
  scoreHistory: DailyScoreSummary[]
  earnedBadgeIds: string[]
  completedTaskHistory: CompletedTaskRecord[]
  dayCompletedAt?: number
  dayCompletionPoints?: number
  dailyCompletionStreak: number
  lastCompletedDay?: string
  standingMeetingsCompleted: number
  walkingMeetingsCompleted: number
  onTimeDaysCompleted: number
}

type ScoreTrendRange = 'week' | 'month' | 'year'

const STORAGE_KEY = 'daily-goose-state-v1'
const MANUAL_NEW_DAY_KEY = 'daily-goose-manual-new-day-v1'
const MORNING_MINUTES = 20
const PR_REVIEW_MINUTES = 60
const DEFAULT_WORKDAY_MINUTES = 8 * 60
const workdayHourOptions = Array.from({ length: 23 }, (_, index) => 1 + index * 0.5)
const lunchTimeOptions = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4)
  const minutes = (index % 4) * 15
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
})

const morningActivities = [
  {
    id: 'catch-up',
    icon: '🌤️',
    title: 'Read your overnight catch-up',
    description: 'Email, Teams mentions, PR activity, ADO changes, S360, and yesterday carryover.',
  },
  {
    id: 'messages',
    icon: '💌',
    title: 'Triage messages and email',
    description: 'Reply, flag, or turn anything actionable into a task.',
  },
  {
    id: 's360',
    icon: '🛡️',
    title: 'Review S360',
    description: 'Check action items and dismiss anything already handled.',
  },
  {
    id: 'sxs-validations',
    icon: '🧪',
    title: 'Handled SxS Validations',
    description: 'Review side-by-side validation results and follow up on anything that needs attention.',
  },
  {
    id: 'deliverables',
    icon: '🗂️',
    title: 'Update deliverables',
    description: 'Confirm status, remaining work, target dates, and any due-date risk.',
  },
  {
    id: 'day-list',
    icon: '✨',
    title: 'Capture today’s work',
    description: 'Write down what needs your attention before the PR review block.',
  },
]

const headlineQuotes = [
  'You have a plan. Now only do the next thing.',
  'A focused hour can move a whole flock forward.',
  'Choose the next useful thing and let the rest wait.',
  'Calm progress is still powerful progress.',
  'One clear priority is enough to begin.',
  'You do not need more pressure. You need one next step.',
  'Protect your focus and let the good work compound.',
  'Small completed things become meaningful momentum.',
  'Today is built one intentional block at a time.',
  'Make room for the work that matters most.',
  'A thoughtful pace still gets you where you are going.',
  'The plan can change without the day being lost.',
  'Finish the next right thing before carrying the rest.',
  'Your attention is valuable. Spend it on purpose.',
  'Steady work beats frantic work.',
  'Give this task your full wingspan.',
  'Progress does not need to be loud to count.',
  'A good day starts with one honest priority.',
  'Keep the goal visible and the next step small.',
  'You are allowed to work with focus instead of urgency.',
  'One task. One timer. One successful waddle.',
  'The shortest path forward is the next clear action.',
  'Let consistency do the heavy lifting today.',
  'Make this block count, then choose again.',
  'Focus on what you can finish, not everything you can see.',
  'A calm mind makes room for excellent work.',
  'Move with intention, not interruption.',
  'The flock can wait while you finish this.',
  'Today only asks for today-sized progress.',
  'Keep going gently. Momentum is already forming.',
  'You know the destination. Waddle the next few feet.',
]

const focusGooseQuotes = [
  'Small steps still move the whole flock forward.',
  'You do not have to finish everything at once. Just choose the next kind step.',
  'A calm plan is a gift to your future self.',
  'Progress counts, even when it waddles.',
  'Today only needs today-sized courage.',
  'The goose believes in focused, reasonable expectations.',
  'Close one loop before opening three more.',
  'A pause can be useful. A return to focus is powerful.',
  'Your best work does not need to happen all at once.',
  'Finish what is in front of your beak.',
  'You can reprioritize without judging yourself.',
  'Make the task smaller until starting feels easy.',
  'A steady waddle is faster than standing still.',
  'Protect this block from unnecessary honking.',
  'Your future self appreciates every finished detail.',
  'One completed task is better than five anxious beginnings.',
  'Breathe, check the timer, and keep waddling.',
  'The next step does not have to be the perfect step.',
  'Attention first. Speed can follow.',
  'Tiny progress is how big migrations begin.',
  'You are doing enough when you are doing the next thing.',
  'Let the checklist hold the worry for you.',
  'The goose recommends fewer tabs and one clear goal.',
  'Done creates more energy than almost done.',
  'Keep your wings on the task you chose.',
  'There is no prize for carrying every task at once.',
  'Make a little progress before checking for new work.',
  'Your plan is a guide, not a judgment.',
  'A focused finish deserves a celebratory honk.',
  'Do the useful thing, then take the win.',
  'Consistency looks ordinary until it becomes extraordinary.',
]

const suggestedSeedTasks = [
  {
    title: 'Review S360 action items that need follow-up',
    notes: 'Connector preview: live S360 suggestions will appear here after integration.',
    durationMinutes: 30,
  },
  {
    title: 'Check deliverables due within the next five business days',
    notes: 'Connector preview: due-date-aware ADO recommendations will replace this placeholder.',
    durationMinutes: 60,
  },
]

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function easternDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number(values.hour),
  }
}

function previousDateKey(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

function easternCalendarDateKey(date = new Date()) {
  return easternDateParts(date).dateKey
}

function workdayDateKey(date = new Date()) {
  const eastern = easternDateParts(date)
  return eastern.hour >= 7 ? eastern.dateKey : previousDateKey(eastern.dateKey)
}

function futureDateKey(daysFromToday: number) {
  const date = new Date()
  date.setDate(date.getDate() + daysFromToday)
  return localDateKey(date)
}

function dailyCollectionIndex(dateKey: string, collectionLength: number, offset = 0) {
  const dateTimestamp = new Date(`${dateKey}T00:00:00Z`).getTime()
  const dayNumber = Math.floor(dateTimestamp / (24 * 60 * 60 * 1000))
  return (dayNumber + offset) % collectionLength
}

function currentScoreSummary(state: DailyState): DailyScoreSummary {
  return {
    date: state.date,
    score: state.score,
    completedTasks: state.completedTasksToday,
    uninterruptedCompletions: state.uninterruptedCompletionsToday,
    longestFocusStreak: state.longestFocusStreak,
    morningSetupCompleted: state.morningSetupAwarded,
  }
}

function scoreTrend(
  summaries: DailyScoreSummary[],
  range: ScoreTrendRange,
  throughDate: string,
) {
  const days = range === 'week' ? 7 : range === 'month' ? 30 : 365
  const scoreByDate = new Map(summaries.map((summary) => [summary.date, summary.score]))
  const end = new Date(`${throughDate}T12:00:00Z`)
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end)
    date.setUTCDate(end.getUTCDate() - (days - index - 1))
    const dateKey = date.toISOString().slice(0, 10)
    return {
      date: dateKey,
      score: scoreByDate.get(dateKey) || 0,
    }
  })
}

function getBehaviorBaseline(state: DailyState): BehaviorBaseline {
  const records = [
    ...state.scoreHistory.filter((record) => record.date !== state.date),
    currentScoreSummary(state),
  ]
  const trackedRecords = records.filter(
    (record) =>
      record.score > 0 ||
      record.completedTasks > 0 ||
      record.uninterruptedCompletions > 0 ||
      record.morningSetupCompleted,
  )
  const recentRecords = trackedRecords.slice(-7)
  const divisor = Math.max(1, recentRecords.length)
  const average = (selector: (record: DailyScoreSummary) => number) =>
    recentRecords.reduce((total, record) => total + selector(record), 0) / divisor

  return {
    trackedDays: trackedRecords.length,
    calibrated: trackedRecords.length >= 7,
    averageTasks: average((record) => record.completedTasks),
    averageFocusedTasks: average((record) => record.uninterruptedCompletions),
    averagePoints: average((record) => record.score),
    morningSetupDays: records.filter((record) => record.morningSetupCompleted).length,
  }
}

function getBadgeStatuses(state: DailyState): BadgeStatus[] {
  const behaviorBaseline = getBehaviorBaseline(state)
  const records = [
    ...state.scoreHistory.filter((record) => record.date !== state.date),
    currentScoreSummary(state),
  ]
  const totalCompletedTasks = records.reduce(
    (total, record) => total + record.completedTasks,
    0,
  )
  const totalUninterruptedTasks = records.reduce(
    (total, record) => total + record.uninterruptedCompletions,
    0,
  )
  const bestDailyScore = records.reduce(
    (best, record) => Math.max(best, record.score),
    0,
  )
  const totalPoints = records.reduce(
    (total, record) => total + record.score,
    0,
  )
  const monthlyScores = new Map<string, number>()
  records.forEach((record) => {
    const month = record.date.slice(0, 7)
    monthlyScores.set(month, (monthlyScores.get(month) || 0) + record.score)
  })
  const bestMonthlyScore = Math.max(0, ...monthlyScores.values())
  const scoringDates = Array.from(
    new Set(
      records
        .filter((record) => record.score > 0)
        .map((record) => record.date),
    ),
  ).sort()
  const activeDays = scoringDates.length
  let longestDayStreak = 0
  let currentDayStreak = 0
  let previousTimestamp = 0
  scoringDates.forEach((date) => {
    const timestamp = new Date(`${date}T00:00:00Z`).getTime()
    currentDayStreak =
      previousTimestamp > 0 && timestamp - previousTimestamp === 24 * 60 * 60 * 1000
        ? currentDayStreak + 1
        : 1
    longestDayStreak = Math.max(longestDayStreak, currentDayStreak)
    previousTimestamp = timestamp
  })
  const firstScoringTimestamp =
    scoringDates.length > 0
      ? new Date(`${scoringDates[0]}T00:00:00Z`).getTime()
      : 0
  const currentDateTimestamp = new Date(`${state.date}T00:00:00Z`).getTime()
  const tenureDays =
    firstScoringTimestamp > 0
      ? Math.max(
          1,
          Math.floor(
            (currentDateTimestamp - firstScoringTimestamp) /
              (24 * 60 * 60 * 1000),
          ) + 1,
        )
      : 0

  const definitions = [
    {
      id: 'first-waddle',
      title: 'First Waddle',
      description: 'Complete your first task.',
      icon: '🐣',
      progress: totalCompletedTasks,
      target: 1,
    },
    {
      id: 'morning-hatchling',
      title: 'Morning Hatchling',
      description: 'Complete your first morning setup.',
      icon: '🌅',
      progress: behaviorBaseline.morningSetupDays,
      target: 1,
    },
    {
      id: 'morning-flock',
      title: 'Morning Flock',
      description: 'Complete morning setup on 5 different days.',
      icon: '☀️',
      progress: behaviorBaseline.morningSetupDays,
      target: 5,
    },
    {
      id: 'morning-regular',
      title: 'Morning Regular',
      description: 'Complete morning setup on 20 different days.',
      icon: '🌻',
      progress: behaviorBaseline.morningSetupDays,
      target: 20,
    },
    {
      id: 'morning-anchor',
      title: 'Morning Anchor',
      description: 'Complete morning setup on 60 different days.',
      icon: '⚓',
      progress: behaviorBaseline.morningSetupDays,
      target: 60,
    },
    {
      id: 'triple-honk',
      title: 'Triple Honk',
      description: 'Complete 3 tasks in one day.',
      icon: '📣',
      progress: state.completedTasksToday,
      target: 3,
    },
    {
      id: 'golden-goose-day',
      title: 'Golden Goose Day',
      description: 'Complete 5 tasks in one day.',
      icon: '🌟',
      progress: state.completedTasksToday,
      target: 5,
    },
    {
      id: 'focus-feather',
      title: 'Focus Feather',
      description: 'Complete an uninterrupted focus task.',
      icon: '🪶',
      progress: totalUninterruptedTasks,
      target: 1,
    },
    {
      id: 'laser-goose',
      title: 'Laser Goose',
      description: 'Complete 3 uninterrupted focus tasks in one day.',
      icon: '🎯',
      progress: state.uninterruptedCompletionsToday,
      target: 3,
    },
    {
      id: 'tenacious-goose',
      title: 'Tenacious Goose',
      description: 'Complete 10 tasks across all days.',
      icon: '💪',
      progress: totalCompletedTasks,
      target: 10,
    },
    {
      id: 'task-trot-25',
      title: 'Task Trot',
      description: 'Complete 25 tasks across all days.',
      icon: '👟',
      progress: totalCompletedTasks,
      target: 25,
    },
    {
      id: 'fifty-feathers',
      title: 'Fifty Feathers',
      description: 'Complete 50 tasks across all days.',
      icon: '🪶',
      progress: totalCompletedTasks,
      target: 50,
    },
    {
      id: 'century-waddle',
      title: 'Century Waddle',
      description: 'Complete 100 tasks across all days.',
      icon: '💯',
      progress: totalCompletedTasks,
      target: 100,
    },
    {
      id: 'migration-master',
      title: 'Migration Master',
      description: 'Complete 250 tasks across all days.',
      icon: '🧭',
      progress: totalCompletedTasks,
      target: 250,
    },
    {
      id: 'executive-goose',
      title: 'Executive Goose',
      description: 'Complete 500 tasks across all days.',
      icon: '💼',
      progress: totalCompletedTasks,
      target: 500,
    },
    {
      id: 'focus-flock-10',
      title: 'Focus Flock',
      description: 'Complete 10 uninterrupted focus tasks.',
      icon: '🔟',
      progress: totalUninterruptedTasks,
      target: 10,
    },
    {
      id: 'deep-work-waddle-25',
      title: 'Deep Work Waddle',
      description: 'Complete 25 uninterrupted focus tasks.',
      icon: '🧠',
      progress: totalUninterruptedTasks,
      target: 25,
    },
    {
      id: 'focus-formation-50',
      title: 'Focus Formation',
      description: 'Complete 50 uninterrupted focus tasks.',
      icon: '🛡️',
      progress: totalUninterruptedTasks,
      target: 50,
    },
    {
      id: 'focus-commander-100',
      title: 'Focus Commander',
      description: 'Complete 100 uninterrupted focus tasks.',
      icon: '🎖️',
      progress: totalUninterruptedTasks,
      target: 100,
    },
    {
      id: 'three-day-migration',
      title: 'Three-Day Migration',
      description: 'Score points on 3 consecutive days.',
      icon: '🗺️',
      progress: longestDayStreak,
      target: 3,
    },
    {
      id: 'weeklong-waddle',
      title: 'Weeklong Waddle',
      description: 'Score points on 7 consecutive days.',
      icon: '🏆',
      progress: longestDayStreak,
      target: 7,
    },
    {
      id: 'fortnight-flight',
      title: 'Fortnight Flight',
      description: 'Score points on 14 consecutive days.',
      icon: '🪽',
      progress: longestDayStreak,
      target: 14,
    },
    {
      id: 'monthly-migration-streak',
      title: 'Monthly Migration',
      description: 'Score points on 30 consecutive days.',
      icon: '🗓️',
      progress: longestDayStreak,
      target: 30,
    },
    {
      id: 'active-waddler-14',
      title: 'Regular Waddler',
      description: 'Score points on 14 different days.',
      icon: '🌤️',
      progress: activeDays,
      target: 14,
    },
    {
      id: 'active-waddler-30',
      title: 'Monthly Regular',
      description: 'Score points on 30 different days.',
      icon: '📅',
      progress: activeDays,
      target: 30,
    },
    {
      id: 'active-waddler-60',
      title: 'Two-Month Trot',
      description: 'Score points on 60 different days.',
      icon: '🌈',
      progress: activeDays,
      target: 60,
    },
    {
      id: 'active-waddler-90',
      title: 'Quarterly Quacker',
      description: 'Score points on 90 different days.',
      icon: '💎',
      progress: activeDays,
      target: 90,
    },
    {
      id: 'active-waddler-120',
      title: 'Seasoned Goose',
      description: 'Score points on 120 different days.',
      icon: '🎓',
      progress: activeDays,
      target: 120,
    },
    {
      id: 'active-waddler-150',
      title: 'Long-Haul Waddler',
      description: 'Score points on 150 different days.',
      icon: '✈️',
      progress: activeDays,
      target: 150,
    },
    {
      id: 'monthly-momentum',
      title: 'Monthly Momentum',
      description: 'Earn 2,500 points in one calendar month.',
      icon: '🚀',
      progress: bestMonthlyScore,
      target: 2500,
    },
    {
      id: 'high-flyer',
      title: 'High Flyer',
      description: 'Reach 1,000 points in one day.',
      icon: '👑',
      progress: bestDailyScore,
      target: 1000,
    },
    {
      id: 'points-5000',
      title: 'Five-Thousand Feather Club',
      description: 'Earn 5,000 total points.',
      icon: '5️⃣',
      progress: totalPoints,
      target: 5000,
    },
    {
      id: 'points-10000',
      title: 'Ten-Thousand Honks',
      description: 'Earn 10,000 total points.',
      icon: '🔔',
      progress: totalPoints,
      target: 10000,
    },
    {
      id: 'points-25000',
      title: 'Silver Waddle',
      description: 'Earn 25,000 total points.',
      icon: '🥈',
      progress: totalPoints,
      target: 25000,
    },
    {
      id: 'points-50000',
      title: 'Golden Migration',
      description: 'Earn 50,000 total points.',
      icon: '🥇',
      progress: totalPoints,
      target: 50000,
    },
    {
      id: 'six-month-goose-legend',
      title: 'Corporate Goose Legend',
      description: 'Keep waddling with Just a Corporate Goose for 180 days.',
      icon: '🏰',
      progress: tenureDays,
      target: 180,
    },
  ]

  const wellnessBadgeGroups = [
    {
      id: 'standing-meetings',
      titles: [
        'Stand Tall',
        'Standing Flock',
        'Upright Regular',
        'Standing Ovation',
      ],
      description: 'Complete standing meetings.',
      icon: '🧍',
      progress: state.standingMeetingsCompleted,
    },
    {
      id: 'walking-meetings',
      titles: [
        'First Walking Meeting',
        'Walking Flock',
        'Meeting Migration',
        'Road Goose',
      ],
      description: 'Complete walking meetings.',
      icon: '🚶',
      progress: state.walkingMeetingsCompleted,
    },
    {
      id: 'water-goals',
      titles: [
        'First Sip',
        'Hydrated Honker',
        'Water Waddler',
        'Hydration Hero',
      ],
      description: 'Reach the daily water goal.',
      icon: '💧',
      progress: state.waterGoalsCompleted,
    },
    {
      id: 'lunches',
      titles: [
        'Lunch Break',
        'Lunch Regular',
        'Well-Fed Goose',
        'Lunch Legend',
      ],
      description: 'Complete planned lunches.',
      icon: '🥪',
      progress: state.lunchesCompleted,
    },
    {
      id: 'on-time-days',
      titles: [
        'Right on Time',
        'Clockwork Goose',
        'Punctual Waddler',
        'On-Time Legend',
      ],
      description: 'Complete the day on time.',
      icon: '⏰',
      progress: state.onTimeDaysCompleted,
    },
  ]
  const wellnessBadgeTargets = [1, 5, 20, 50]
  wellnessBadgeGroups.forEach((group) => {
    wellnessBadgeTargets.forEach((target, index) => {
      definitions.push({
        id: `${group.id}-${target}`,
        title: group.titles[index],
        description: `${group.description} ${target} time${target === 1 ? '' : 's'}.`,
        icon: group.icon,
        progress: group.progress,
        target,
      })
    })
  })

  if (behaviorBaseline.calibrated) {
    definitions.push(
      {
        id: 'personal-task-stretch',
        title: 'Above Your Average',
        description: 'Beat your rolling 7-day task average today.',
        icon: '📈',
        progress: state.completedTasksToday,
        target: Math.max(1, Math.ceil(behaviorBaseline.averageTasks + 1)),
      },
      {
        id: 'personal-focus-stretch',
        title: 'Personal Focus Stretch',
        description: 'Beat your rolling 7-day focused-task average today.',
        icon: '🔭',
        progress: state.uninterruptedCompletionsToday,
        target: Math.max(1, Math.ceil(behaviorBaseline.averageFocusedTasks + 1)),
      },
      {
        id: 'personal-points-stretch',
        title: 'Personal Points Peak',
        description: 'Beat your rolling 7-day points average today.',
        icon: '⛰️',
        progress: state.score,
        target: Math.max(
          30,
          Math.ceil((behaviorBaseline.averagePoints + 1) / 10) * 10,
        ),
      },
    )
  }

  return definitions.map((badge) => ({
    ...badge,
    unlocked: badge.progress >= badge.target,
  }))
}

function timeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function createTask(
  title: string,
  durationMinutes: number,
  source: TaskSource,
  scheduledFor = localDateKey(),
  notes = '',
  kind: DailyTask['kind'] = 'work',
): DailyTask {
  return {
    id: createId(),
    title,
    notes,
    durationMinutes,
    status: 'todo',
    source,
    scheduledFor,
    subtasks: [],
    completedSubtasks: [],
    kind,
    isBackground: false,
    backgroundReminderMinutes: 60,
    isStretchGoal: false,
    elapsedSeconds: 0,
    manualPauseCount: 0,
    focusDriftCount: 0,
    scoreAwarded: false,
  }
}

function retainOneYearOfHistory(
  history: CompletedTaskRecord[],
  throughDate: string,
) {
  const cutoff = new Date(`${throughDate}T12:00:00`)
  cutoff.setFullYear(cutoff.getFullYear() - 1)
  const cutoffDate = localDateKey(cutoff)
  return history.filter((record) => record.date >= cutoffDate)
}

function archiveCompletedTasks(
  history: CompletedTaskRecord[],
  tasks: DailyTask[],
  date: string,
  archivedAt: number,
) {
  const records = tasks
    .filter((task) => task.status === 'done')
    .map((task): CompletedTaskRecord => ({
      id: `${date}:${task.id}`,
      taskId: task.id,
      date,
      title: task.title,
      notes: task.notes,
      durationMinutes: task.durationMinutes,
      elapsedSeconds: task.elapsedSeconds,
      completedAt: task.completedAt || archivedAt,
      isBackground: task.isBackground,
      isStretchGoal: task.isStretchGoal,
    }))
  const existingIds = new Set(history.map((record) => record.id))
  return retainOneYearOfHistory(
    [...history, ...records.filter((record) => !existingIds.has(record.id))],
    date,
  )
}

function defaultChecks() {
  return Object.fromEntries(morningActivities.map((activity) => [activity.id, false]))
}

function loadState(): DailyState {
  const manuallyRequestedDate = localStorage.getItem(MANUAL_NEW_DAY_KEY)
  if (manuallyRequestedDate) {
    localStorage.removeItem(MANUAL_NEW_DAY_KEY)
  }
  const today = manuallyRequestedDate || workdayDateKey()
  const forceNewDay = Boolean(manuallyRequestedDate)
  const raw = localStorage.getItem(STORAGE_KEY)

  if (!raw) {
    return {
      date: today,
      screen: 'welcome',
      morningChecks: defaultChecks(),
      tasks: [],
      futureTasks: [],
      activeTaskIndex: 0,
      pausedSeconds: 0,
      isPaused: false,
      activityAwareness: true,
      dismissedReminders: [],
      dismissedMovementPrompts: [],
      exitedMeetingKeys: [],
      movementMeetingStartedKeys: [],
      rewardedMovementMeetingKeys: [],
      meetings: [],
      meetingsLoaded: false,
      calendarError: '',
      lunchStart: '12:00',
      lunchDurationMinutes: 60,
      lunchInProgress: false,
      lunchCompleted: false,
      lunchesCompleted: 0,
      workdayMinutes: DEFAULT_WORKDAY_MINUTES,
      waterGoalOunces: 0,
      waterReminderCount: 4,
      waterScoringGoalOunces: 0,
      waterConsumedOunces: 0,
      waterScoredOunces: 0,
      waterCupBonusesAwarded: 0,
      waterGoalAwardedToday: false,
      waterGoalsCompleted: 0,
      prReviewStart: '09:30',
      endOfDayCelebrated: false,
      endOfDayDismissed: false,
      workdayExtensionSeconds: 0,
      score: 0,
      scoreEvents: [],
      completedTasksToday: 0,
      uninterruptedCompletionsToday: 0,
      morningSetupAwarded: false,
      focusStreak: 0,
      longestFocusStreak: 0,
      latePenaltyHoursApplied: 0,
      scoreHistory: [],
      earnedBadgeIds: [],
      completedTaskHistory: [],
      dailyCompletionStreak: 0,
      standingMeetingsCompleted: 0,
      walkingMeetingsCompleted: 0,
      onTimeDaysCompleted: 0,
    }
  }

  try {
    const previous = JSON.parse(raw) as DailyState
    if (previous.date === today && !forceNewDay) {
      const normalizedState: DailyState = {
        ...previous,
        meetings: (previous.meetings || []).map((meeting) => ({
          ...meeting,
          movementMode: meeting.movementMode || (meeting.walkable ? 'walk' : 'none'),
        })),
        dismissedMovementPrompts: previous.dismissedMovementPrompts || [],
        exitedMeetingKeys: previous.exitedMeetingKeys || [],
        movementMeetingStartedKeys: previous.movementMeetingStartedKeys || [],
        rewardedMovementMeetingKeys: previous.rewardedMovementMeetingKeys || [],
        meetingsLoaded: previous.meetingsLoaded || false,
        calendarError: previous.calendarError || '',
        lunchStart: previous.lunchStart || '12:00',
        lunchDurationMinutes: previous.lunchDurationMinutes ?? 60,
        lunchInProgress: previous.lunchInProgress || false,
        lunchCompleted: previous.lunchCompleted || false,
        lunchesCompleted: previous.lunchesCompleted || 0,
        workdayMinutes: previous.workdayMinutes || DEFAULT_WORKDAY_MINUTES,
        waterGoalOunces: previous.waterGoalOunces ?? 0,
        waterReminderCount:
          previous.waterReminderCount ??
          (previous.waterGoalOunces > 0
            ? Math.max(1, Math.ceil(previous.waterGoalOunces / 8))
            : 4),
        waterScoringGoalOunces:
          previous.waterScoringGoalOunces ?? previous.waterGoalOunces ?? 0,
        waterConsumedOunces: previous.waterConsumedOunces ?? 0,
        waterScoredOunces:
          previous.waterScoredOunces ?? previous.waterConsumedOunces ?? 0,
        waterCupBonusesAwarded:
          previous.waterCupBonusesAwarded ??
          Math.floor((previous.waterConsumedOunces ?? 0) / WATER_CUP_OUNCES),
        waterGoalAwardedToday: previous.waterGoalAwardedToday || false,
        waterGoalsCompleted: previous.waterGoalsCompleted || 0,
        prReviewStart: previous.prReviewStart || '09:30',
        endOfDayCelebrated: previous.endOfDayCelebrated || false,
        endOfDayDismissed: previous.endOfDayDismissed || false,
        workdayExtensionSeconds: previous.workdayExtensionSeconds || 0,
        score: previous.score || 0,
        scoreEvents: previous.scoreEvents || [],
        completedTasksToday: previous.completedTasksToday || 0,
        uninterruptedCompletionsToday:
          previous.uninterruptedCompletionsToday || 0,
        morningSetupAwarded: previous.morningSetupAwarded || false,
        focusStreak: previous.focusStreak || 0,
        longestFocusStreak: previous.longestFocusStreak || 0,
        latePenaltyHoursApplied: previous.latePenaltyHoursApplied || 0,
        scoreHistory: previous.scoreHistory || [],
        earnedBadgeIds: previous.earnedBadgeIds || [],
        completedTaskHistory: retainOneYearOfHistory(
          previous.completedTaskHistory || [],
          today,
        ),
        dayCompletedAt: previous.dayCompletedAt,
        dayCompletionPoints: previous.dayCompletionPoints,
        dailyCompletionStreak:
          previous.dailyCompletionStreak ?? (previous.dayCompletedAt ? 1 : 0),
        lastCompletedDay:
          previous.lastCompletedDay ??
          (previous.dayCompletedAt ? previous.date : undefined),
        standingMeetingsCompleted: previous.standingMeetingsCompleted || 0,
        walkingMeetingsCompleted: previous.walkingMeetingsCompleted || 0,
        onTimeDaysCompleted: previous.onTimeDaysCompleted || 0,
        tasks: previous.tasks.map((task) => {
          const removeLegacySteps = hasLegacySuggestedBreakdown(task)
          return {
            ...task,
            subtasks: removeLegacySteps ? [] : task.subtasks || [],
            completedSubtasks: removeLegacySteps
              ? []
              : task.completedSubtasks || [],
            kind:
              task.kind ||
              (task.title.trim().toLowerCase() === 'pr reviews' ? 'pr-review' : 'work'),
            isBackground: task.isBackground || false,
            backgroundReminderMinutes: task.backgroundReminderMinutes || 60,
            isStretchGoal: task.isStretchGoal || false,
            elapsedSeconds: task.elapsedSeconds || 0,
            manualPauseCount: task.manualPauseCount || 0,
            focusDriftCount: task.focusDriftCount || 0,
            scoreAwarded: task.scoreAwarded || false,
          }
        }),
      }
      const activeTaskId = normalizedState.tasks[normalizedState.activeTaskIndex]?.id
      const tasks = moveCompletedTasksToBottom(normalizedState.tasks)
      const activeTaskIndex = activeTaskId
        ? tasks.findIndex((task) => task.id === activeTaskId)
        : normalizedState.activeTaskIndex
      return restoreLegacyCompletedTaskScores({
        ...normalizedState,
        tasks,
        activeTaskIndex:
          activeTaskIndex >= 0 ? activeTaskIndex : normalizedState.activeTaskIndex,
      })
    }

    const rollover = previous.tasks
      .filter((task) => task.status !== 'done')
      .map((task) => {
        const removeLegacySteps = hasLegacySuggestedBreakdown(task)
        return {
          ...task,
          id: createId(),
          source: 'rollover' as const,
          scheduledFor: today,
          subtasks: removeLegacySteps ? [] : task.subtasks || [],
          completedSubtasks: [],
          kind:
            task.kind ||
            (task.title.trim().toLowerCase() === 'pr reviews' ? 'pr-review' : 'work'),
          isBackground: task.isBackground || false,
          backgroundReminderMinutes: task.backgroundReminderMinutes || 60,
          isStretchGoal: task.isStretchGoal || false,
          elapsedSeconds: task.elapsedSeconds || 0,
          manualPauseCount: task.manualPauseCount || 0,
          focusDriftCount: task.focusDriftCount || 0,
          scoreAwarded: false,
        }
      })

    const futureDue = previous.futureTasks
      .filter((task) => task.targetDate <= today)
      .map((task) => ({
        ...createTask(
          task.title,
          task.durationMinutes || 60,
          'rollover',
          today,
          task.notes,
        ),
        isBackground: task.isBackground || false,
        backgroundReminderMinutes: task.backgroundReminderMinutes || 60,
        isStretchGoal: task.isStretchGoal || false,
      }))

    const previousScoreHistory = previous.scoreHistory || []
    const previousSummary: DailyScoreSummary = {
      date: previous.date,
      score: previous.score || 0,
      completedTasks: previous.completedTasksToday || 0,
      uninterruptedCompletions: previous.uninterruptedCompletionsToday || 0,
      longestFocusStreak: previous.longestFocusStreak || 0,
      morningSetupCompleted: previous.morningSetupAwarded || false,
    }
    const scoreHistory = [
      ...previousScoreHistory.filter((summary) => summary.date !== previous.date),
      previousSummary,
    ]
    const completedTaskHistory = archiveCompletedTasks(
      previous.completedTaskHistory || [],
      previous.tasks,
      previous.date,
      previous.dayCompletedAt || Date.now(),
    )
    const dailyCompletionStreak = completionStreakForNewDay(
      previous.date,
      today,
      Boolean(previous.dayCompletedAt),
      previous.dailyCompletionStreak ?? (previous.dayCompletedAt ? 1 : 0),
    )

    return {
      date: today,
      screen: 'welcome',
      morningChecks: defaultChecks(),
      tasks: [...rollover, ...futureDue],
      futureTasks: previous.futureTasks.filter((task) => task.targetDate > today),
      activeTaskIndex: 0,
      pausedSeconds: 0,
      isPaused: false,
      activityAwareness: previous.activityAwareness,
      dismissedReminders: [],
      dismissedMovementPrompts: [],
      exitedMeetingKeys: [],
      movementMeetingStartedKeys: [],
      rewardedMovementMeetingKeys: [],
      meetings: [],
      meetingsLoaded: false,
      calendarError: '',
      lunchStart: previous.lunchStart || '12:00',
      lunchDurationMinutes: previous.lunchDurationMinutes ?? 60,
      lunchInProgress: false,
      lunchCompleted: false,
      lunchesCompleted: previous.lunchesCompleted || 0,
      workdayMinutes: previous.workdayMinutes || DEFAULT_WORKDAY_MINUTES,
      waterGoalOunces: previous.waterGoalOunces ?? 0,
      waterReminderCount: previous.waterReminderCount ?? 4,
      waterScoringGoalOunces: previous.waterGoalOunces ?? 0,
      waterConsumedOunces: 0,
      waterScoredOunces: 0,
      waterCupBonusesAwarded: 0,
      waterGoalAwardedToday: false,
      waterGoalsCompleted: previous.waterGoalsCompleted || 0,
      prReviewStart: previous.prReviewStart || '09:30',
      endOfDayCelebrated: false,
      endOfDayDismissed: false,
      workdayExtensionSeconds: 0,
      score: 0,
      scoreEvents: [],
      completedTasksToday: 0,
      uninterruptedCompletionsToday: 0,
      morningSetupAwarded: false,
      focusStreak: 0,
      longestFocusStreak: 0,
      latePenaltyHoursApplied: 0,
      scoreHistory,
      earnedBadgeIds: previous.earnedBadgeIds || [],
      completedTaskHistory,
      dayCompletedAt: undefined,
      dayCompletionPoints: undefined,
      dailyCompletionStreak,
      lastCompletedDay:
        previous.lastCompletedDay ??
        (previous.dayCompletedAt ? previous.date : undefined),
      standingMeetingsCompleted: previous.standingMeetingsCompleted || 0,
      walkingMeetingsCompleted: previous.walkingMeetingsCompleted || 0,
      onTimeDaysCompleted: previous.onTimeDaysCompleted || 0,
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY)
    return loadState()
  }
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) {
    return `${minutes}m`
  }
  if (minutes === 0) {
    return `${hours}h`
  }
  return `${hours}h ${minutes}m`
}

function formatCountdown(seconds: number) {
  const safe = Math.max(0, seconds)
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const remainder = safe % 60
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`
}

function formatClock(value: string | number | Date) {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function meetingMinutes(meeting: CalendarMeeting) {
  return Math.max(0, Math.round((new Date(meeting.end).getTime() - new Date(meeting.start).getTime()) / 60000))
}

function timeOnDate(dateKey: string, time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const date = new Date(`${dateKey}T00:00:00`)
  date.setHours(hours, minutes, 0, 0)
  return date.getTime()
}

function mergedBusyMinutes(intervals: Array<[number, number]>, windowStart: number, windowEnd: number) {
  const clipped = intervals
    .map(([start, end]) => [Math.max(start, windowStart), Math.min(end, windowEnd)] as [number, number])
    .filter(([start, end]) => end > start)
    .sort((left, right) => left[0] - right[0])

  const merged: Array<[number, number]> = []
  clipped.forEach(([start, end]) => {
    const previous = merged[merged.length - 1]
    if (!previous || start > previous[1]) {
      merged.push([start, end])
      return
    }
    previous[1] = Math.max(previous[1], end)
  })

  return Math.round(merged.reduce((total, [start, end]) => total + (end - start) / 60000, 0))
}

function legacySuggestedBreakdown(title: string) {
  const shortTitle = title.length > 42 ? `${title.slice(0, 39)}…` : title
  return [
    `Open the relevant links and gather context for ${shortTitle}`,
    'Write down the exact outcome and the smallest first action',
    'Complete the first concrete change or decision',
    'Validate the result and capture anything still blocked',
    'Update the work item or send the needed status note',
  ]
}

function hasLegacySuggestedBreakdown(task: DailyTask) {
  const legacySteps = legacySuggestedBreakdown(task.title)
  return (
    task.subtasks?.length === legacySteps.length &&
    legacySteps.every((step, index) => task.subtasks[index] === step)
  )
}

function playGooseChime(sound: 'gentle' | 'complete' = 'gentle') {
  const audioContext = new AudioContext()
  const start = audioContext.currentTime
  const frequencies =
    sound === 'complete' ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 783.99, 987.77]

  frequencies.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    const noteStart = start + index * 0.1
    oscillator.type = index % 2 === 0 ? 'sine' : 'triangle'
    oscillator.frequency.setValueAtTime(frequency, noteStart)
    gain.gain.setValueAtTime(0.0001, noteStart)
    gain.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + 0.22)
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(noteStart)
    oscillator.stop(noteStart + 0.24)
  })

  window.setTimeout(() => {
    void audioContext.close()
  }, 1000)
}

function notifyWithChime(
  payload: {
    title: string
    body: string
    urgent?: boolean
    pausesTask?: boolean
    actionLabel?: string
    actionType?: string
    actionTaskId?: string
    secondaryActionLabel?: string
    secondaryActionType?: string
    secondaryActionTaskId?: string
  },
  sound: 'gentle' | 'complete' = 'gentle',
) {
  playGooseChime(sound)
  return window.dailyGoose?.notify(payload)
}

function applyScoreChange(
  current: DailyState,
  requestedPoints: number,
  label: string,
  timestamp = Date.now(),
): DailyState {
  const nextScore = Math.max(0, current.score + requestedPoints)
  const appliedPoints = nextScore - current.score
  if (appliedPoints === 0) {
    return current
  }

  return {
    ...current,
    score: nextScore,
    scoreEvents: [
      {
        id: createId(),
        timestamp,
        points: appliedPoints,
        label,
      },
      ...current.scoreEvents,
    ].slice(0, 100),
  }
}

function applyWaterConsumption(
  current: DailyState,
  requestedOunces: number,
  timestamp = Date.now(),
): DailyState {
  const hydrationUpdate = calculateHydrationUpdate(current, requestedOunces)
  const completedWaterGoal =
    !current.waterGoalAwardedToday &&
    current.waterGoalOunces > 0 &&
    hydrationUpdate.waterConsumedOunces >= current.waterGoalOunces
  let next: DailyState = {
    ...current,
    waterScoringGoalOunces: hydrationUpdate.waterScoringGoalOunces,
    waterConsumedOunces: hydrationUpdate.waterConsumedOunces,
    waterScoredOunces: hydrationUpdate.waterScoredOunces,
    waterCupBonusesAwarded: hydrationUpdate.waterCupBonusesAwarded,
    waterGoalAwardedToday:
      current.waterGoalAwardedToday || completedWaterGoal,
    waterGoalsCompleted:
      current.waterGoalsCompleted + (completedWaterGoal ? 1 : 0),
  }

  if (hydrationUpdate.ouncePoints > 0) {
    next = applyScoreChange(
      next,
      hydrationUpdate.ouncePoints,
      hydrationUpdate.bonusOunces > 0
        ? `Hydration: ${Math.round((hydrationUpdate.baseOunces + hydrationUpdate.bonusOunces) * 10) / 10} oz, including ${Math.round(hydrationUpdate.bonusOunces * 10) / 10} bonus oz`
        : `Hydration: ${Math.round(hydrationUpdate.baseOunces * 10) / 10} oz`,
      timestamp,
    )
  }

  if (hydrationUpdate.cupBonusPoints > 0) {
    next = applyScoreChange(
      next,
      hydrationUpdate.cupBonusPoints,
      hydrationUpdate.newlyCompletedCups === 1
        ? `Filled a ${WATER_CUP_OUNCES} oz water cup`
        : `Filled ${hydrationUpdate.newlyCompletedCups} water cups`,
      timestamp + 1,
    )
  }

  return next
}

function restoreLegacyCompletedTaskScores(current: DailyState): DailyState {
  const completedTasksWithoutPoints = current.tasks.filter(
    (task) => task.status === 'done' && !task.scoreAwarded,
  )
  if (completedTasksWithoutPoints.length === 0) {
    return current
  }

  const restoredAt = Date.now()
  const restoredEvents = completedTasksWithoutPoints.map((task, index) => ({
    id: createId(),
    timestamp: restoredAt - index,
    points: 100,
    label: `Completed ${task.title}`,
  }))

  return {
    ...current,
    score: current.score + completedTasksWithoutPoints.length * 100,
    scoreEvents: [...restoredEvents, ...current.scoreEvents].slice(0, 100),
    completedTasksToday:
      current.completedTasksToday + completedTasksWithoutPoints.length,
    tasks: current.tasks.map((task) =>
      task.status === 'done' && !task.scoreAwarded
        ? { ...task, scoreAwarded: true }
        : task,
    ),
  }
}

function toggleManualPauseState(current: DailyState, changedAt: number): DailyState {
  if (current.pauseReason === 'ready' && current.tasks[current.activeTaskIndex]) {
    return {
      ...current,
      taskStartedAt: changedAt,
      pauseStartedAt: undefined,
      pausedSeconds: 0,
      isPaused: false,
      pauseReason: undefined,
    }
  }

  if (
    (current.screen !== 'focus' && current.screen !== 'planning') ||
    current.pauseReason === 'calendar'
  ) {
    return current
  }

  if (current.isPaused) {
    const additionalPausedSeconds = current.pauseStartedAt
      ? Math.max(0, Math.floor((changedAt - current.pauseStartedAt) / 1000))
      : 0
    if (!current.taskStartedAt) {
      return {
        ...current,
        taskStartedAt: changedAt,
        pauseStartedAt: undefined,
        pausedSeconds: 0,
        isPaused: false,
        workdayExtensionSeconds:
          current.workdayExtensionSeconds + additionalPausedSeconds,
        pauseReason: undefined,
      }
    }
    return {
      ...current,
      isPaused: false,
      pauseStartedAt: undefined,
      pausedSeconds: current.pausedSeconds + additionalPausedSeconds,
      workdayExtensionSeconds: current.workdayExtensionSeconds + additionalPausedSeconds,
      pauseReason: undefined,
    }
  }

  if (!current.taskStartedAt) {
    return current
  }

  const pausedState: DailyState = {
    ...current,
    tasks: current.tasks.map((task, index) =>
      index === current.activeTaskIndex
        ? { ...task, manualPauseCount: task.manualPauseCount + 1 }
        : task,
    ),
    isPaused: true,
    pauseStartedAt: changedAt,
    pauseReason: 'manual',
    focusStreak: 0,
  }
  return applyScoreChange(pausedState, -5, 'Manual pause', changedAt)
}

function activeSessionElapsedSeconds(current: DailyState, changedAt: number) {
  if (!current.taskStartedAt) {
    return 0
  }

  const sessionEnd =
    current.isPaused && current.pauseStartedAt ? current.pauseStartedAt : changedAt
  return Math.max(
    0,
    Math.floor((sessionEnd - current.taskStartedAt) / 1000) - current.pausedSeconds,
  )
}

function commitActiveTaskProgress(current: DailyState, changedAt: number): DailyState {
  const activeTask = current.tasks[current.activeTaskIndex]
  const sessionElapsedSeconds = activeSessionElapsedSeconds(current, changedAt)
  const tasks =
    activeTask && sessionElapsedSeconds > 0
      ? current.tasks.map((task) =>
          task.id === activeTask.id
            ? {
                ...task,
                elapsedSeconds: Math.min(
                  task.durationMinutes * 60,
                  task.elapsedSeconds + sessionElapsedSeconds,
                ),
              }
            : task,
        )
      : current.tasks

  return {
    ...current,
    tasks,
    taskStartedAt: undefined,
    pauseStartedAt: undefined,
    pausedSeconds: 0,
  }
}

function completeLunchState(current: DailyState, changedAt: number): DailyState {
  const lunchEnd =
    timeOnDate(current.date, current.lunchStart) +
    current.lunchDurationMinutes * 60 * 1000
  const completedEarly = changedAt < lunchEnd
  const completedLunchNow = !current.lunchCompleted
  let nextState: DailyState

  if (!current.isPaused || current.pauseReason !== 'calendar') {
    nextState = {
      ...current,
      lunchInProgress: false,
      lunchCompleted: true,
      lunchesCompleted:
        current.lunchesCompleted + (completedLunchNow ? 1 : 0),
    }
  } else {
    const lunchPauseSeconds = current.pauseStartedAt
      ? Math.max(0, Math.floor((changedAt - current.pauseStartedAt) / 1000))
      : 0
    nextState = {
      ...current,
      lunchInProgress: false,
      lunchCompleted: true,
      lunchesCompleted:
        current.lunchesCompleted + (completedLunchNow ? 1 : 0),
      isPaused: false,
      pauseStartedAt: undefined,
      pausedSeconds: current.pausedSeconds + lunchPauseSeconds,
      pauseReason: undefined,
    }
  }

  return completedEarly
    ? applyScoreChange(nextState, -5, 'Lunch ended early', changedAt)
    : nextState
}

function findNextFocusTaskIndex(
  tasks: DailyTask[],
  currentIndex: number,
  excludedTaskId?: string,
) {
  const isEligible = (task: DailyTask) =>
    task.id !== excludedTaskId && task.status !== 'done' && !task.isBackground
  const laterTaskIndex = tasks.findIndex(
    (task, index) => index > currentIndex && isEligible(task),
  )
  return laterTaskIndex >= 0 ? laterTaskIndex : tasks.findIndex(isEligible)
}

function moveCompletedTasksToBottom(tasks: DailyTask[]) {
  return [
    ...tasks.filter((task) => task.status !== 'done'),
    ...tasks.filter((task) => task.status === 'done'),
  ]
}

function JumpingGoose({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="jumping-goose"
      aria-label="Open completed task history"
      title="View completed task history"
      onClick={onClick}
    >
      <img src={standingGooseUrl} alt="" />
    </button>
  )
}

function taskGooseUrl(title: string, isBackground = false) {
  const normalizedTitle = title.toLowerCase()
  if (
    /(^|\W)pr(s)?(\W|$)/.test(normalizedTitle) ||
    normalizedTitle.includes('pull request') ||
    normalizedTitle.includes('create') ||
    normalizedTitle.includes('creating') ||
    normalizedTitle.includes('make ') ||
    normalizedTitle.includes('making') ||
    normalizedTitle.includes('update') ||
    normalizedTitle.includes('updating')
  ) {
    return codingGooseUrl
  }
  if (isBackground) {
    return phoneGooseUrl
  }
  if (
    normalizedTitle.includes('email') ||
    normalizedTitle.includes('message') ||
    normalizedTitle.includes('call') ||
    normalizedTitle.includes('phone')
  ) {
    return phoneGooseUrl
  }
  if (
    normalizedTitle.includes('review') ||
    normalizedTitle.includes('read')
  ) {
    return readingGooseUrl
  }
  if (
    normalizedTitle.includes('code') ||
    normalizedTitle.includes('deploy') ||
    normalizedTitle.includes('build') ||
    normalizedTitle.includes('test') ||
    normalizedTitle.includes('develop')
  ) {
    return codingGooseUrl
  }
  if (
    normalizedTitle.includes('prepare') ||
    normalizedTitle.includes('study') ||
    normalizedTitle.includes('research') ||
    normalizedTitle.includes('understand') ||
    normalizedTitle.includes('investigate')
  ) {
    return studyingGooseUrl
  }
  if (normalizedTitle.includes('lunch') || normalizedTitle.includes('eat')) {
    return lunchGooseUrl
  }
  if (normalizedTitle.includes('coffee') || normalizedTitle.includes('break')) {
    return coffeeGooseUrl
  }
  return standingGooseUrl
}

function meetingPoseUrl(movementMode: CalendarMeeting['movementMode']) {
  if (movementMode === 'walk') {
    return walkingGooseUrl
  }
  if (movementMode === 'stand') {
    return thumbsUpGooseUrl
  }
  return meetingGooseUrl
}

function reminderGooseUrl(payload: ReminderPayload) {
  const reminderText = `${payload.title} ${payload.body}`.toLowerCase()
  if (reminderText.includes('walking meeting') || reminderText.includes('for a walk')) {
    return walkingGooseUrl
  }
  if (reminderText.includes('standing meeting')) {
    return thumbsUpGooseUrl
  }
  if (reminderText.includes('meeting')) {
    return meetingGooseUrl
  }
  if (
    /(^|\W)pr(s)?(\W|$)/.test(reminderText) ||
    reminderText.includes('pull request') ||
    reminderText.includes('create') ||
    reminderText.includes('creating') ||
    reminderText.includes('make ') ||
    reminderText.includes('making') ||
    reminderText.includes('update') ||
    reminderText.includes('updating')
  ) {
    return codingGooseUrl
  }
  if (reminderText.includes('lunch') || reminderText.includes('eat')) {
    return lunchGooseUrl
  }
  if (reminderText.includes('water') || reminderText.includes('drink')) {
    return coffeeGooseUrl
  }
  if (
    reminderText.includes('complete') ||
    reminderText.includes('finished') ||
    reminderText.includes('you did it') ||
    reminderText.includes('work day') ||
    reminderText.includes('workday') ||
    reminderText.includes('switch tasks')
  ) {
    return celebratingGooseUrl
  }
  if (
    reminderText.includes('pause') ||
    reminderText.includes('break') ||
    reminderText.includes('rest')
  ) {
    return relaxingGooseUrl
  }
  if (
    reminderText.includes('honk') ||
    reminderText.includes('focus check') ||
    reminderText.includes('drift')
  ) {
    return angryGooseUrl
  }
  if (
    reminderText.includes('review') ||
    reminderText.includes('read') ||
    reminderText.includes('pull request')
  ) {
    return readingGooseUrl
  }
  if (
    reminderText.includes('background') ||
    reminderText.includes('check in') ||
    reminderText.includes('email') ||
    reminderText.includes('call')
  ) {
    return phoneGooseUrl
  }
  if (reminderText.includes('ready') || reminderText.includes('start')) {
    return thumbsUpGooseUrl
  }
  return happyGooseUrl
}

function MiniTimer() {
  const [payload, setPayload] = useState<MiniTimerPayload>({
    taskTitle: 'Waiting for today’s plan',
    remainingSeconds: 0,
    totalSeconds: 1,
    angry: false,
    isPaused: false,
    isReady: false,
    celebrating: false,
  })
  const [walkingFrame, setWalkingFrame] = useState(false)

  useEffect(() => {
    const removeUpdate = window.dailyGoose?.onMiniUpdate((next) => {
      setPayload((current) => ({ ...current, ...next }))
    })
    const removeActivity = window.dailyGoose?.onActivityState((activity) => {
      setPayload((current) => ({ ...current, angry: activity.angry }))
    })
    window.dailyGoose?.getCurrentMini().then((current) => {
      if (current) {
        setPayload(current)
      }
    })
    return () => {
      removeUpdate?.()
      removeActivity?.()
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(
      () => setWalkingFrame((current) => !current),
      850,
    )
    return () => window.clearInterval(interval)
  }, [])

  const progress = Math.max(
    0,
    Math.min(100, 100 - (payload.remainingSeconds / Math.max(payload.totalSeconds, 1)) * 100),
  )
  const isRunning = !payload.isPaused && !payload.isReady
  const miniGooseUrl = payload.celebrating
    ? celebratingGooseUrl
    : payload.isPaused
      ? sittingGooseUrl
      : payload.angry
        ? angryGooseUrl
        : payload.isReady
          ? thumbsUpGooseUrl
          : walkingFrame
            ? walkingGooseUrl
            : waddlingGooseUrl

  return (
    <main
      className={`mini-timer ${payload.angry ? 'angry' : ''} ${
        payload.celebrating ? 'celebrating' : ''
      } ${payload.isPaused && !payload.isReady ? 'paused' : ''} ${
        payload.isReady ? 'ready' : ''
      } ${isRunning ? 'running' : ''}`}
    >
      <div className="mini-actions">
        <button
          className="mini-pause"
          onClick={() =>
            payload.isReady && payload.remainingSeconds === 0
              ? window.dailyGoose?.requestCurrentTaskTime()
              : window.dailyGoose?.requestPauseToggle()
          }
        >
          {payload.isReady && payload.remainingSeconds === 0
            ? '+15m'
            : payload.isReady
              ? 'Start'
              : payload.isPaused
                ? 'Resume'
                : 'Pause'}
        </button>
        {payload.remainingSeconds > 0 && (
          <button
            className="mini-add-time"
            title={`Add 15 minutes to ${payload.taskTitle}`}
            onClick={() => window.dailyGoose?.requestCurrentTaskTime()}
          >
            +15m
          </button>
        )}
        <button className="mini-open" onClick={() => window.dailyGoose?.focusMain()}>
          ⇄ Tasks
        </button>
      </div>
      {isRunning && (
        <img
          className="mini-task-icon"
          src={taskGooseUrl(payload.taskTitle)}
          alt=""
        />
      )}
      <div className="mini-copy">
        <span className="mini-label">
          {payload.isReady
            ? 'Ready to get started on'
            : payload.isPaused
              ? 'Timer stopped'
              : payload.angry
                ? 'HONK! Focus check'
                : 'Right now'}
        </span>
        <strong>{payload.taskTitle}</strong>
        {payload.isReady ? (
          <span className="mini-ready-copy">
            <strong>{formatCountdown(payload.remainingSeconds)}</strong>
            <small>focus time remaining</small>
          </span>
        ) : payload.isPaused ? (
          <span className="mini-paused-copy">
            <strong>PAUSED</strong>
            <small>{formatCountdown(payload.remainingSeconds)} remaining</small>
          </span>
        ) : (
          <span className="mini-countdown">{formatCountdown(payload.remainingSeconds)}</span>
        )}
      </div>
      <div className="mini-track">
        <span style={{ width: `${progress}%` }} />
        <img
          className="mini-progress-goose"
          src={miniGooseUrl}
          alt=""
          style={{
            left: `clamp(44px, ${progress}%, calc(100% - 44px))`,
          }}
        />
      </div>
      <div className="goose-lane">
        {!payload.isReady && payload.taskId && (
          <button
            className="mini-complete"
            onClick={() => window.dailyGoose?.requestTaskComplete(payload.taskId!)}
          >
            ✓ Mark complete
          </button>
        )}
        {payload.isReady &&
          payload.previousTaskTitle &&
          payload.remainingSeconds > 0 && (
          <button
            className="mini-more-time"
            title={`Add 15 minutes to ${payload.previousTaskTitle}`}
            onClick={() => window.dailyGoose?.requestPreviousTaskTime()}
          >
            +15m previous
          </button>
        )}
      </div>
    </main>
  )
}

function ReminderPopup() {
  const [payload, setPayload] = useState<ReminderPayload>({
    title: 'Just a Corporate Goose reminder',
    body: 'Take a moment to check in.',
  })

  useEffect(() => {
    const removeUpdate = window.dailyGoose?.onReminderUpdate((next) => {
      setPayload(next)
    })
    window.dailyGoose?.getActiveReminder().then((current) => {
      if (current) {
        setPayload(current)
      }
    })
    return () => removeUpdate?.()
  }, [])

  return (
    <main className="reminder-popup">
      <div className="reminder-goose" aria-hidden="true">
        <img src={reminderGooseUrl(payload)} alt="" />
      </div>
      <div className="reminder-copy">
        <span>Just a Corporate Goose reminder</span>
        <strong>{payload.title}</strong>
        <p>{payload.body}</p>
      </div>
      <div className="reminder-actions">
        {payload.secondaryActionLabel ? (
          <>
            <button
              className="reminder-acknowledge"
              onClick={() => window.dailyGoose?.acknowledgeReminder()}
            >
              {payload.actionLabel || 'Acknowledge'}
            </button>
            <button
              className="reminder-primary-action"
              onClick={() => window.dailyGoose?.performReminderSecondaryAction()}
            >
              {payload.secondaryActionLabel}
            </button>
          </>
        ) : (
          <button
            className="reminder-primary-action"
            onClick={() => window.dailyGoose?.acknowledgeReminder()}
          >
            {payload.actionLabel || 'Acknowledge'}
          </button>
        )}
      </div>
    </main>
  )
}

function RequiredNumberInput({
  fieldId,
  value,
  min,
  max,
  step,
  className,
  onCommit,
  onValidityChange,
}: {
  fieldId: string
  value: number
  min: number
  max?: number
  step?: number
  className?: string
  onCommit: (value: number) => void
  onValidityChange: (fieldId: string, valid: boolean) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const [showError, setShowError] = useState(false)
  const numericValue = draft.trim() === '' ? Number.NaN : Number(draft)
  const valid =
    Number.isFinite(numericValue) &&
    numericValue >= min &&
    (max === undefined || numericValue <= max)

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  useEffect(() => {
    onValidityChange(fieldId, valid)
    return () => onValidityChange(fieldId, true)
  }, [fieldId, onValidityChange, valid])

  function commit() {
    setShowError(!valid)
    if (!valid) {
      return
    }

    onCommit(numericValue)
    setDraft(String(numericValue))
  }

  return (
    <input
      className={`${className || ''} ${showError ? 'required-number-invalid' : ''}`.trim()}
      type="number"
      min={min}
      max={max}
      step={step}
      value={draft}
      aria-invalid={showError}
      onChange={(event) => {
        const nextDraft = event.target.value
        setDraft(nextDraft)
        const nextValue = nextDraft.trim() === '' ? Number.NaN : Number(nextDraft)
        const nextValid =
          Number.isFinite(nextValue) &&
          nextValue >= min &&
          (max === undefined || nextValue <= max)
        onValidityChange(fieldId, nextValid)
        if (nextValid) {
          setShowError(false)
        }
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.currentTarget.blur()
        }
      }}
    />
  )
}

function DailyGooseApp() {
  const [state, setState] = useState<DailyState>(loadState)
  const [displayName, setDisplayName] = useState('')
  const [lunchDraftStart, setLunchDraftStart] = useState(state.lunchStart)
  const [lunchDraftDuration, setLunchDraftDuration] = useState<0 | 30 | 60>(
    state.lunchDurationMinutes,
  )
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newAdHocTaskTitle, setNewAdHocTaskTitle] = useState('')
  const [newAdHocTaskNotes, setNewAdHocTaskNotes] = useState('')
  const [newAdHocTaskDuration, setNewAdHocTaskDuration] = useState(60)
  const [newAdHocTaskIsBackground, setNewAdHocTaskIsBackground] = useState(false)
  const [newAdHocTaskIsStretchGoal, setNewAdHocTaskIsStretchGoal] = useState(false)
  const [newAdHocTaskReminderMinutes, setNewAdHocTaskReminderMinutes] = useState(60)
  const [newAdHocTaskWhen, setNewAdHocTaskWhen] = useState<'today' | 'future'>('today')
  const [newAdHocTaskDate, setNewAdHocTaskDate] = useState(() => futureDateKey(1))
  const [newFutureTitle, setNewFutureTitle] = useState('')
  const [newFutureDate, setNewFutureDate] = useState(localDateKey())
  const [draggedTaskId, setDraggedTaskId] = useState<string>()
  const [dragOverTaskId, setDragOverTaskId] = useState<string>()
  const [expandedStepTaskIds, setExpandedStepTaskIds] = useState<string[]>([])
  const [newStepDrafts, setNewStepDrafts] = useState<Record<string, string>>({})
  const [now, setNow] = useState<number>(() => Date.now())
  const [celebration, setCelebration] = useState('')
  const [gooseFlipping, setGooseFlipping] = useState(false)
  const [scoreBurst, setScoreBurst] = useState<number>()
  const [confettiActive, setConfettiActive] = useState(false)
  const [showScoreboard, setShowScoreboard] = useState(false)
  const [scoreTrendRange, setScoreTrendRange] = useState<ScoreTrendRange>('week')
  const [showTaskHistory, setShowTaskHistory] = useState(false)
  const [invalidNumberFields, setInvalidNumberFields] = useState<Set<string>>(
    new Set(),
  )

  useEffect(() => {
    let active = true
    window.dailyGoose
      ?.getLocalPreferences()
      .then((preferences) => {
        if (active) {
          setDisplayName(preferences.displayName.trim())
        }
      })
      .catch(() => {
        if (active) {
          setDisplayName('')
        }
      })

    return () => {
      active = false
    }
  }, [])

  const setNumberFieldValidity = useCallback((fieldId: string, valid: boolean) => {
    setInvalidNumberFields((current) => {
      const next = new Set(current)
      if (valid) {
        next.delete(fieldId)
      } else {
        next.add(fieldId)
      }
      if (
        next.size === current.size &&
        Array.from(next).every((item) => current.has(item))
      ) {
        return current
      }
      return next
    })
  }, [])
  const [pullRequests, setPullRequests] = useState<ReviewablePullRequest[]>([])
  const [pullRequestsLoading, setPullRequestsLoading] = useState(false)
  const [pullRequestsLoaded, setPullRequestsLoaded] = useState(false)
  const [pullRequestsError, setPullRequestsError] = useState('')
  const [newAdHocMeetingTitle, setNewAdHocMeetingTitle] = useState('')
  const [newAdHocMeetingStart, setNewAdHocMeetingStart] = useState(() =>
    timeInputValue(new Date()),
  )
  const [newAdHocMeetingDuration, setNewAdHocMeetingDuration] = useState(30)
  const [newAdHocMovementMode, setNewAdHocMovementMode] = useState<
    'none' | 'walk' | 'stand'
  >('none')
  const notifiedRef = useRef<Set<string>>(new Set())
  const interruptionRef = useRef('')
  const pullRequestInFlightRef = useRef(false)
  const prPromptRef = useRef('')

  function clearFocusNotifications() {
    notifiedRef.current.forEach((key) => {
      if (!key.startsWith('background-') && !key.startsWith('water-')) {
        notifiedRef.current.delete(key)
      }
    })
  }
  const resumeTaskAfterReminderRef = useRef<string | undefined>(undefined)
  const ignoreReminderPauseUntilRef = useRef(0)
  const completeTaskRef = useRef<(taskId: string) => void>(() => {})
  const logOneDrinkRef = useRef<() => void>(() => {})

  function updateState(updater: (current: DailyState) => DailyState) {
    setState((current) => updater(current))
  }

  const badgeStatuses = getBadgeStatuses(state)
  const behaviorBaseline = getBehaviorBaseline(state)
  const earnedBadges = badgeStatuses.filter(
    (badge) => badge.unlocked || state.earnedBadgeIds.includes(badge.id),
  )
  const badgesInProgress = badgeStatuses.filter(
    (badge) => !badge.unlocked && !state.earnedBadgeIds.includes(badge.id),
  )
  const newlyEarnedBadges = badgeStatuses.filter(
    (badge) => badge.unlocked && !state.earnedBadgeIds.includes(badge.id),
  )
  const newBadgeKey = newlyEarnedBadges.map((badge) => badge.id).join(',')
  const highScore = Math.max(
    state.score,
    ...state.scoreHistory.map((summary) => summary.score),
  )
  const scoreHistory = [
    currentScoreSummary(state),
    ...state.scoreHistory
      .filter((summary) => summary.date !== state.date)
      .sort((left, right) => right.date.localeCompare(left.date)),
  ]
  const trendScores = scoreTrend(scoreHistory, scoreTrendRange, state.date)
  const trendMaximum = Math.max(1, ...trendScores.map((item) => item.score))
  const trendPoints = trendScores
    .map((item, index) => {
      const x =
        trendScores.length === 1 ? 0 : (index / (trendScores.length - 1)) * 100
      const y = 92 - (item.score / trendMaximum) * 82
      return `${x},${y}`
    })
    .join(' ')
  const completedTaskHistory = archiveCompletedTasks(
    state.completedTaskHistory,
    state.tasks,
    state.date,
    now,
  ).sort((left, right) => right.completedAt - left.completedAt)
  const waterCupCount = Math.max(
    1,
    Math.ceil(state.waterConsumedOunces / WATER_CUP_OUNCES),
  )
  const waterAboveGoalOunces = Math.max(
    0,
    Math.round((state.waterConsumedOunces - state.waterGoalOunces) * 10) / 10,
  )

  function logWater(requestedOunces: number) {
    const changedAt = Date.now()
    const hydrationUpdate = calculateHydrationUpdate(state, requestedOunces)
    const totalPoints =
      hydrationUpdate.ouncePoints + hydrationUpdate.cupBonusPoints

    if (totalPoints > 0) {
      setScoreBurst(totalPoints)
      window.setTimeout(() => setScoreBurst(undefined), 1800)
    }
    if (hydrationUpdate.newlyCompletedCups > 0) {
      setCelebration(
        `💧 Full cup! +${hydrationUpdate.cupBonusPoints} point surge${
          hydrationUpdate.newlyCompletedCups > 1
            ? ` for ${hydrationUpdate.newlyCompletedCups} cups`
            : ''
        }!`,
      )
      setGooseFlipping(true)
      setConfettiActive(true)
      playGooseChime('complete')
      window.setTimeout(() => setCelebration(''), 4000)
      window.setTimeout(() => setGooseFlipping(false), 850)
      window.setTimeout(() => setConfettiActive(false), 2600)
    }

    setState((current) =>
      applyWaterConsumption(current, requestedOunces, changedAt),
    )
  }

  logOneDrinkRef.current = () => {
    const servings = Math.max(1, state.waterReminderCount)
    const servingOunces = state.waterGoalOunces / servings
    logWater(state.waterConsumedOunces + servingOunces)
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (!newBadgeKey) {
      return
    }

    const badge = newlyEarnedBadges[0]
    updateState((current) => ({
      ...current,
      earnedBadgeIds: [
        ...current.earnedBadgeIds,
        ...newlyEarnedBadges
          .map((item) => item.id)
          .filter((id) => !current.earnedBadgeIds.includes(id)),
      ],
    }))
    setCelebration(`🏅 Badge unlocked: ${badge.title}! ${badge.description}`)
    setGooseFlipping(true)
    setConfettiActive(true)
    playGooseChime('complete')
    window.setTimeout(() => setCelebration(''), 5000)
    window.setTimeout(() => setGooseFlipping(false), 850)
    window.setTimeout(() => setConfettiActive(false), 2600)
  }, [newBadgeKey, newlyEarnedBadges])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (workdayDateKey(new Date(now)) > state.date) {
      window.location.reload()
    }
  }, [now, state.date])

  useEffect(() => {
    const removePauseToggle = window.dailyGoose?.onPauseToggleRequested(() => {
      const changedAt = Date.now()
      setState((current) => toggleManualPauseState(current, changedAt))
    })
    return () => removePauseToggle?.()
  }, [])

  useEffect(() => {
    const removeCurrentTaskTime = window.dailyGoose?.onCurrentTaskTimeRequested(() => {
      clearFocusNotifications()
      setState((current) => {
        const activeTask = current.tasks[current.activeTaskIndex]
        if (!activeTask || activeTask.status === 'done' || activeTask.isBackground) {
          return current
        }

        return {
          ...current,
          tasks: current.tasks.map((task, index) =>
            index === current.activeTaskIndex
              ? {
                  ...task,
                  durationMinutes: task.durationMinutes + 15,
                }
              : task,
          ),
        }
      })
    })
    return () => removeCurrentTaskTime?.()
  }, [])

  useEffect(() => {
    const removePreviousTaskTime = window.dailyGoose?.onPreviousTaskTimeRequested(() => {
      clearFocusNotifications()
      setState((current) => {
        const previousTaskIndex = current.tasks.findIndex(
          (task) => task.id === current.previousTaskId,
        )
        if (previousTaskIndex < 0) {
          return current
        }

        return {
          ...current,
          tasks: current.tasks.map((task, index) =>
            index === previousTaskIndex
              ? {
                  ...task,
                  durationMinutes: task.durationMinutes + 15,
                  status: 'todo',
                }
              : task,
          ),
          activeTaskIndex: previousTaskIndex,
          previousTaskId: undefined,
          taskStartedAt: undefined,
          pauseStartedAt: undefined,
          pausedSeconds: 0,
          isPaused: true,
          pauseReason: 'ready',
        }
      })
    })
    return () => removePreviousTaskTime?.()
  }, [])

  useEffect(() => {
    const removeTaskComplete = window.dailyGoose?.onTaskCompleteRequested((taskId) => {
      completeTaskRef.current(taskId)
    })
    return () => removeTaskComplete?.()
  }, [])

  useEffect(() => {
    const removeReminderState = window.dailyGoose?.onReminderState(({ pending }) => {
      const changedAt = Date.now()
      if (pending && changedAt < ignoreReminderPauseUntilRef.current) {
        return
      }
      const resumeTaskId = pending ? undefined : resumeTaskAfterReminderRef.current
      if (!pending) {
        resumeTaskAfterReminderRef.current = undefined
      }
      setState((current) => {
        if (resumeTaskId) {
          const taskIndex = current.tasks.findIndex((task) => task.id === resumeTaskId)
          if (taskIndex < 0) {
            return current
          }

          return {
            ...current,
            activeTaskIndex: taskIndex,
            taskStartedAt: changedAt,
            pauseStartedAt: undefined,
            pausedSeconds: 0,
            isPaused: false,
            pauseReason: undefined,
          }
        }

        if (pending) {
          if (
            current.screen !== 'focus' ||
            !current.taskStartedAt ||
            current.isPaused
          ) {
            return current
          }

          return {
            ...current,
            isPaused: true,
            pauseStartedAt: changedAt,
            pauseReason: 'reminder',
          }
        }

        if (!current.isPaused || current.pauseReason !== 'reminder') {
          return current
        }

        const reminderPauseSeconds = current.pauseStartedAt
          ? Math.max(0, Math.floor((changedAt - current.pauseStartedAt) / 1000))
          : 0
        return {
          ...current,
          isPaused: false,
          pauseStartedAt: undefined,
          pausedSeconds: current.pausedSeconds + reminderPauseSeconds,
          pauseReason: undefined,
          workdayExtensionSeconds:
            current.workdayExtensionSeconds + reminderPauseSeconds,
        }
      })
    })
    return () => removeReminderState?.()
  }, [])

  useEffect(() => {
    const removeReminderAction = window.dailyGoose?.onReminderAction(({ type, taskId }) => {
      const changedAt = Date.now()
      if (type === 'add-time-to-task' && taskId) {
        clearFocusNotifications()
        resumeTaskAfterReminderRef.current = taskId
        ignoreReminderPauseUntilRef.current = changedAt + 2000
        setState((current) => {
          const taskIndex = current.tasks.findIndex((task) => task.id === taskId)
          if (taskIndex < 0) {
            return current
          }

          return {
            ...current,
            tasks: current.tasks.map((task, index) =>
              index === taskIndex
                ? {
                    ...task,
                    durationMinutes: task.durationMinutes + 15,
                    status: 'todo',
                  }
                : task,
            ),
            activeTaskIndex: taskIndex,
            previousTaskId: undefined,
            taskStartedAt: undefined,
            pauseStartedAt: changedAt,
            pausedSeconds: 0,
            isPaused: true,
            pauseReason: 'ready',
          }
        })
        return
      }

      if (type === 'complete-task' && taskId) {
        completeTaskRef.current(taskId)
        return
      }

      if (type === 'complete-lunch') {
        setState((current) => completeLunchState(current, changedAt))
        return
      }

      if (type === 'log-water') {
        logOneDrinkRef.current()
      }
    })
    return () => removeReminderAction?.()
  }, [])

  useEffect(() => {
    const removeDrift = window.dailyGoose?.onActivityDrift(() => {
      setCelebration('🪿 The focus goose is watching. Gently return to the task you chose.')
      window.setTimeout(() => setCelebration(''), 5000)
      setState((current) => ({
        ...current,
        tasks: current.tasks.map((task, index) =>
          index === current.activeTaskIndex
            ? { ...task, focusDriftCount: task.focusDriftCount + 1 }
            : task,
        ),
        focusStreak: 0,
      }))
    })
    return () => removeDrift?.()
  }, [])

  useEffect(() => {
    if (state.screen !== 'planning' || state.meetingsLoaded) {
      return
    }

    let cancelled = false
    window.dailyGoose
      ?.getTodaysMeetings()
      .then((meetings) => {
        if (cancelled) {
          return
        }
        updateState((current) => ({
          ...current,
          meetings: meetings.map((meeting) => ({ ...meeting, movementMode: 'none' })),
          meetingsLoaded: true,
          calendarError: '',
        }))
      })
      .catch((error: Error) => {
        if (cancelled) {
          return
        }
        updateState((current) => ({
          ...current,
          meetingsLoaded: true,
          calendarError: error.message || 'Unable to read the Outlook calendar.',
        }))
      })

    return () => {
      cancelled = true
    }
  }, [state.meetingsLoaded, state.screen])

  const activeTask = state.tasks[state.activeTaskIndex]
  const isPrReviewTask =
    activeTask?.kind === 'pr-review' || activeTask?.title.trim().toLowerCase() === 'pr reviews'
  const activeTaskTotalSeconds = (activeTask?.durationMinutes || 0) * 60
  const currentSessionElapsedSeconds = activeSessionElapsedSeconds(state, now)
  const elapsedSeconds = activeTask
    ? Math.min(
        activeTaskTotalSeconds,
        activeTask.elapsedSeconds + currentSessionElapsedSeconds,
      )
    : 0
  const remainingSeconds = activeTask
    ? Math.max(0, activeTaskTotalSeconds - elapsedSeconds)
    : 0
  const previousTask = state.tasks.find((task) => task.id === state.previousTaskId)
  const isTaskReady = state.pauseReason === 'ready'
  const hasIncompleteFocusTask = state.tasks.some(
    (task) => task.status !== 'done' && !task.isBackground,
  )

  const lunchStartTimestamp = timeOnDate(state.date, state.lunchStart)
  const lunchEndTimestamp =
    lunchStartTimestamp + state.lunchDurationMinutes * 60 * 1000
  const prReviewStartTimestamp = timeOnDate(state.date, state.prReviewStart)
  const prReviewEndTimestamp = prReviewStartTimestamp + PR_REVIEW_MINUTES * 60 * 1000
  const selectedMeetings = state.meetings.filter((meeting) => meeting.selected)
  const activeMeeting = selectedMeetings.find((meeting) => {
    const current = now
    const meetingKey = `${meeting.id}-${meeting.start}`
    return (
      !state.exitedMeetingKeys.includes(meetingKey) &&
      current >= new Date(meeting.start).getTime() &&
      current < new Date(meeting.end).getTime()
    )
  })
  const lunchScheduledNow =
    state.lunchDurationMinutes > 0 &&
    now >= lunchStartTimestamp &&
    now < lunchEndTimestamp
  const isLunch =
    !state.lunchCompleted &&
    (state.lunchInProgress || lunchScheduledNow)

  useEffect(() => {
    if (
      lunchScheduledNow &&
      !state.lunchCompleted &&
      !state.lunchInProgress
    ) {
      updateState((current) => ({
        ...current,
        lunchInProgress: true,
      }))
    }
  }, [
    lunchScheduledNow,
    state.lunchCompleted,
    state.lunchInProgress,
    state.lunchDurationMinutes,
  ])

  useEffect(() => {
    if (!activeMeeting || activeMeeting.movementMode === 'none') {
      return
    }

    const meetingKey = `${activeMeeting.id}-${activeMeeting.start}`
    if (state.movementMeetingStartedKeys.includes(meetingKey)) {
      return
    }

    updateState((current) => ({
      ...current,
      movementMeetingStartedKeys: current.movementMeetingStartedKeys.includes(
        meetingKey,
      )
        ? current.movementMeetingStartedKeys
        : [...current.movementMeetingStartedKeys, meetingKey],
    }))
  }, [activeMeeting, state.movementMeetingStartedKeys])

  useEffect(() => {
    const completedMovementMeetings = state.meetings.filter((meeting) => {
      const meetingKey = `${meeting.id}-${meeting.start}`
      return (
        meeting.movementMode !== 'none' &&
        now >= new Date(meeting.end).getTime() &&
        state.movementMeetingStartedKeys.includes(meetingKey) &&
        !state.rewardedMovementMeetingKeys.includes(meetingKey)
      )
    })
    if (completedMovementMeetings.length === 0) {
      return
    }

    const totalPoints = completedMovementMeetings.reduce(
      (total, meeting) => total + movementMeetingPoints(meeting.movementMode),
      0,
    )
    updateState((current) => {
      let next = current
      completedMovementMeetings.forEach((meeting, index) => {
        const meetingKey = `${meeting.id}-${meeting.start}`
        if (next.rewardedMovementMeetingKeys.includes(meetingKey)) {
          return
        }

        const isWalkingMeeting = meeting.movementMode === 'walk'
        next = {
          ...next,
          rewardedMovementMeetingKeys: [
            ...next.rewardedMovementMeetingKeys,
            meetingKey,
          ],
          standingMeetingsCompleted:
            next.standingMeetingsCompleted + (isWalkingMeeting ? 0 : 1),
          walkingMeetingsCompleted:
            next.walkingMeetingsCompleted + (isWalkingMeeting ? 1 : 0),
        }
        next = applyScoreChange(
          next,
          movementMeetingPoints(meeting.movementMode),
          isWalkingMeeting
            ? 'Completed a walking meeting'
            : 'Completed a standing meeting',
          Date.now() + index,
        )
      })
      return next
    })
    setCelebration(
      completedMovementMeetings.length === 1
        ? completedMovementMeetings[0].movementMode === 'walk'
          ? '🚶 Walking meeting complete! +200 points'
          : '🧍 Standing meeting complete! +100 points'
        : `🪿 Movement meetings complete! +${totalPoints} points`,
    )
    setScoreBurst(totalPoints)
    setConfettiActive(true)
    playGooseChime('complete')
    window.setTimeout(() => setCelebration(''), 4000)
    window.setTimeout(() => setScoreBurst(undefined), 1800)
    window.setTimeout(() => setConfettiActive(false), 2600)
  }, [
    now,
    state.meetings,
    state.movementMeetingStartedKeys,
    state.rewardedMovementMeetingKeys,
  ])

  const activeInterruption = useMemo(
    () =>
      activeMeeting
        ? {
            key: `meeting-${activeMeeting.id}-${activeMeeting.movementMode}`,
            title:
              activeMeeting.movementMode === 'walk'
                ? `Walking meeting: ${activeMeeting.title}`
                : activeMeeting.movementMode === 'stand'
                  ? `Standing meeting: ${activeMeeting.title}`
                  : `Meeting: ${activeMeeting.title}`,
            start: new Date(activeMeeting.start).getTime(),
            end: new Date(activeMeeting.end).getTime(),
          }
        : isLunch
          ? {
              key: 'lunch',
              title: 'Lunch break',
              start: lunchStartTimestamp,
              end: lunchEndTimestamp,
            }
          : undefined,
    [activeMeeting, isLunch, lunchEndTimestamp, lunchStartTimestamp],
  )
  const interruptionRemainingSeconds = activeInterruption
    ? Math.max(0, Math.floor((activeInterruption.end - now) / 1000))
    : 0
  const displayedTaskTitle = activeInterruption?.title || activeTask?.title || 'Waiting for today’s plan'
  const displayedRemainingSeconds = activeInterruption
    ? interruptionRemainingSeconds
    : remainingSeconds
  const displayedTotalSeconds = activeInterruption
    ? Math.max(1, activeInterruption.end - activeInterruption.start) / 1000
    : activeTaskTotalSeconds

  const dayStart = state.morningStartedAt || now
  const ongoingManualPauseSeconds =
    state.isPaused && state.pauseReason === 'manual' && state.pauseStartedAt
      ? Math.max(0, Math.floor((now - state.pauseStartedAt) / 1000))
      : 0
  const effectiveWorkdayMinutes =
    state.workdayMinutes +
    Math.floor((state.workdayExtensionSeconds + ongoingManualPauseSeconds) / 60)
  const dayEnd =
    dayStart +
    state.workdayMinutes * 60 * 1000 +
    (state.workdayExtensionSeconds + ongoingManualPauseSeconds) * 1000
  const fixedBusyIntervals: Array<[number, number]> = [
    [dayStart, dayStart + MORNING_MINUTES * 60 * 1000],
    [
      prReviewStartTimestamp,
      prReviewEndTimestamp,
    ],
    ...selectedMeetings.map(
      (meeting) =>
        [new Date(meeting.start).getTime(), new Date(meeting.end).getTime()] as [number, number],
    ),
  ]
  if (state.lunchDurationMinutes > 0) {
    fixedBusyIntervals.push([lunchStartTimestamp, lunchEndTimestamp])
  }
  const committedMinutes = mergedBusyMinutes(fixedBusyIntervals, dayStart, dayEnd)
  const availableWorkMinutes = Math.max(0, effectiveWorkdayMinutes - committedMinutes)
  const selectedMeetingMinutes = selectedMeetings.reduce(
    (total, meeting) => total + meetingMinutes(meeting),
    0,
  )

  useEffect(() => {
    if (
      state.screen !== 'focus' ||
      activeMeeting ||
      state.pauseReason === 'meeting-ended'
    ) {
      window.dailyGoose?.hideMini()
      window.dailyGoose?.setActivityAwareness({
        enabled: false,
        taskTitle: activeTask?.title || '',
      })
      return
    }

    if (!activeTask || (activeTask.status === 'done' && !hasIncompleteFocusTask)) {
      window.dailyGoose?.hideMini()
      return
    }

    const miniPayload: MiniTimerPayload = {
      taskId: activeTask.id,
      taskTitle: displayedTaskTitle,
      remainingSeconds: displayedRemainingSeconds,
      totalSeconds: displayedTotalSeconds,
      angry: false,
      isPaused: state.isPaused,
      isReady: isTaskReady,
      previousTaskTitle: previousTask?.title,
      celebrating: gooseFlipping,
    }
    void window.dailyGoose?.updateMini(miniPayload).then(() => {
      void window.dailyGoose?.showMini()
    })
    window.dailyGoose?.setActivityAwareness({
      enabled:
        state.screen === 'focus' &&
        state.activityAwareness &&
        !state.isPaused &&
        !activeInterruption,
      taskTitle: activeTask.title,
    })
  }, [
    activeTask,
    activeMeeting,
    activeInterruption,
    displayedRemainingSeconds,
    displayedTaskTitle,
    displayedTotalSeconds,
    gooseFlipping,
    hasIncompleteFocusTask,
    isTaskReady,
    previousTask?.title,
    state.activityAwareness,
    state.isPaused,
    state.pauseReason,
    state.screen,
    state.taskStartedAt,
  ])

  useEffect(() => {
    if (state.screen !== 'focus') {
      return
    }

    const promptKey = `${state.date}-${state.prReviewStart}`
    if (
      now >= prReviewStartTimestamp &&
      now < prReviewEndTimestamp &&
      !activeMeeting &&
      !state.isPaused &&
      prPromptRef.current !== promptKey
    ) {
      prPromptRef.current = promptKey
      notifyWithChime({
        title: 'It’s time for PR reviews',
        body:
          'Just a Corporate Goose brought the app forward. Select the PR reviews task when you are ready.',
        urgent: true,
      })
    }
  }, [
    now,
    activeMeeting,
    prReviewEndTimestamp,
    prReviewStartTimestamp,
    state.date,
    state.isPaused,
    state.prReviewStart,
    state.screen,
  ])

  useEffect(() => {
    if (state.screen !== 'focus') {
      interruptionRef.current = ''
      return
    }

    const nextKey = activeInterruption?.key || ''
    const previousKey = interruptionRef.current
    if (nextKey === previousKey) {
      return
    }

    interruptionRef.current = nextKey
    const changedAt = Date.now()

    if (nextKey) {
      if (activeMeeting) {
        const movementTitle =
          activeMeeting.movementMode === 'walk'
            ? 'Time for your walking meeting'
            : activeMeeting.movementMode === 'stand'
              ? 'Time for your standing meeting'
              : 'Your meeting is starting'
        const movementBody =
          activeMeeting.movementMode === 'walk'
            ? `“${activeMeeting.title}” is starting. Grab your headset and take the corporate goose for a walk.`
            : activeMeeting.movementMode === 'stand'
              ? `“${activeMeeting.title}” is starting. This is one of your standing meetings.`
              : `“${activeMeeting.title}” is starting. Your task timer is safely paused.`
        notifyWithChime({
          title: movementTitle,
          body: movementBody,
          urgent: true,
          pausesTask: false,
        })
      } else {
        notifyWithChime({
          title: 'Lunch break',
          body: `Your ${formatDuration(
            state.lunchDurationMinutes,
          )} lunch has started. Your task timer will stay paused until you complete lunch.`,
          urgent: true,
          pausesTask: false,
          actionLabel: 'Complete',
          actionType: 'complete-lunch',
        })
      }
      updateState((current) => {
        if (current.isPaused) {
          return current
        }
        return {
          ...current,
          isPaused: true,
          pauseStartedAt: changedAt,
          pauseReason: 'calendar',
        }
      })
      return
    }

    if (previousKey && state.isPaused && state.pauseReason === 'calendar') {
      if (previousKey.startsWith('meeting-')) {
        updateState((current) => ({
          ...current,
          pauseReason: 'meeting-ended',
        }))
        return
      }

      updateState((current) => {
        const additionalPausedSeconds = current.pauseStartedAt
          ? Math.max(0, Math.floor((changedAt - current.pauseStartedAt) / 1000))
          : 0
        return {
          ...current,
          isPaused: false,
          pauseStartedAt: undefined,
          pauseReason: undefined,
          pausedSeconds: current.pausedSeconds + additionalPausedSeconds,
        }
      })
    }
  }, [
    activeInterruption,
    activeMeeting,
    activeTask?.title,
    state.isPaused,
    state.lunchDurationMinutes,
    state.pauseReason,
    state.screen,
  ])

  useEffect(() => {
    if (
      state.screen !== 'focus' ||
      !isPrReviewTask ||
      pullRequestsLoaded ||
      pullRequestInFlightRef.current
    ) {
      return
    }

    pullRequestInFlightRef.current = true
    window.dailyGoose
      ?.getReviewablePrs()
      .then((items) => {
        setPullRequests(items)
        setPullRequestsLoaded(true)
      })
      .catch((error: Error) => {
        setPullRequestsError(error.message || 'Unable to load Azure DevOps pull requests.')
        setPullRequestsLoaded(true)
      })
      .finally(() => {
        pullRequestInFlightRef.current = false
        setPullRequestsLoading(false)
      })
  }, [
    isPrReviewTask,
    pullRequestsLoaded,
    state.screen,
  ])

  useEffect(() => {
    if (
      state.screen !== 'focus' ||
      !activeTask ||
      activeTask.status === 'done' ||
      state.isPaused ||
      activeMeeting
    ) {
      return
    }

    const reminders = [
      { seconds: 30 * 60, label: '30 minutes left' },
      { seconds: 15 * 60, label: '15 minutes left' },
      { seconds: 5 * 60, label: '5 minutes left' },
    ]

    reminders.forEach((reminder) => {
      const key = `${activeTask.id}-${reminder.seconds}`
      if (remainingSeconds === reminder.seconds && !notifiedRef.current.has(key)) {
        notifiedRef.current.add(key)
        notifyWithChime({
          title: reminder.label,
          body: `Keep waddling on: ${activeTask.title}`,
        })
      }
    })

    if (remainingSeconds === 0) {
      const key = `${activeTask.id}-complete`
      if (!notifiedRef.current.has(key)) {
        notifiedRef.current.add(key)
        notifyWithChime(
          {
            title: 'Time to switch tasks',
            body: `Your block for "${activeTask.title}" is complete.`,
            urgent: true,
            actionLabel: 'Mark complete',
            actionType: 'complete-task',
            actionTaskId: activeTask.id,
            secondaryActionLabel: 'Add 15 minutes',
            secondaryActionType: 'add-time-to-task',
            secondaryActionTaskId: activeTask.id,
          },
          'complete',
        )
        const changedAt = Date.now()
        updateState((current) => {
          const currentTask = current.tasks[current.activeTaskIndex]
          if (
            (current.isPaused && current.pauseReason !== 'reminder') ||
            !current.taskStartedAt ||
            currentTask?.id !== activeTask.id
          ) {
            return current
          }

          const committed = commitActiveTaskProgress(current, changedAt)
          const nextIndex = findNextFocusTaskIndex(
            committed.tasks,
            committed.activeTaskIndex,
            activeTask.id,
          )
          return {
            ...committed,
            activeTaskIndex:
              nextIndex >= 0 ? nextIndex : committed.activeTaskIndex,
            previousTaskId: activeTask.id,
            isPaused: true,
            pauseReason: 'ready',
          }
        })
      }
    }
  }, [activeMeeting, activeTask, remainingSeconds, state.isPaused, state.screen])

  useEffect(() => {
    if (
      state.screen !== 'focus' ||
      !state.backgroundRemindersStartedAt
    ) {
      return
    }

    state.tasks
      .filter((task) => task.isBackground && task.status !== 'done')
      .forEach((task) => {
        const intervalMilliseconds = Math.max(5, task.backgroundReminderMinutes) * 60 * 1000
        const elapsedMilliseconds = now - state.backgroundRemindersStartedAt!
        const reminderNumber = Math.floor(elapsedMilliseconds / intervalMilliseconds)
        if (reminderNumber < 1) {
          return
        }

        const key = `background-${task.id}-${reminderNumber}`
        if (notifiedRef.current.has(key)) {
          return
        }

        notifiedRef.current.add(key)
        notifyWithChime({
          title: 'Background task check-in',
          body: `Take a moment to check "${task.title}".`,
        })
      })
  }, [
    now,
    state.backgroundRemindersStartedAt,
    state.screen,
    state.tasks,
  ])

  useEffect(() => {
    if (
      state.screen !== 'focus' ||
      state.waterGoalOunces <= 0 ||
      now < dayStart ||
      now >= dayEnd
    ) {
      return
    }

    const servings = Math.max(1, state.waterReminderCount)
    const servingOunces = state.waterGoalOunces / servings
    const reminderInterval = (dayEnd - dayStart) / (servings + 1)
    const reminderNumber = Math.floor((now - dayStart) / reminderInterval)
    if (reminderNumber < 1 || reminderNumber > servings) {
      return
    }

    const key = `water-${state.date}-${state.waterGoalOunces}-${servings}-${reminderNumber}`
    if (notifiedRef.current.has(key)) {
      return
    }

    notifiedRef.current.add(key)
    notifyWithChime({
      title: 'Water break',
      body: `Drink ${Math.round(servingOunces * 10) / 10} oz. Log it now or acknowledge without changing your total (${reminderNumber} of ${servings}).`,
      actionLabel: 'Acknowledge',
      secondaryActionLabel: 'Log my water',
      secondaryActionType: 'log-water',
    })
  }, [
    dayEnd,
    dayStart,
    now,
    state.date,
    state.screen,
    state.waterGoalOunces,
    state.waterReminderCount,
  ])

  useEffect(() => {
    if (
      state.screen !== 'focus' ||
      !state.morningStartedAt ||
      activeMeeting ||
      now < dayEnd ||
      state.endOfDayCelebrated
    ) {
      return
    }

    window.dailyGoose?.hideMini()
    notifyWithChime(
      {
        title: 'You made it through your workday!',
        body: 'This should be the end of your workday. Work-life balance is a good thing.',
        urgent: true,
        pausesTask: false,
      },
      'complete',
    )
    updateState((current) => ({
      ...current,
      endOfDayCelebrated: true,
      endOfDayDismissed: false,
      isPaused: true,
      pauseStartedAt: Date.now(),
      pauseReason: 'end-of-day',
    }))
  }, [
    dayEnd,
    now,
    activeMeeting,
    state.endOfDayCelebrated,
    state.morningStartedAt,
    state.screen,
  ])

  const greeting = useMemo(() => {
    const date = new Date()
    const day = date.toLocaleDateString(undefined, { weekday: 'long' })
    const hour = date.getHours()
    const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
    return displayName
      ? `${salutation}, ${displayName}. Happy ${day}!`
      : `${salutation}. Happy ${day}!`
  }, [displayName])

  const quote = useMemo(() => {
    return focusGooseQuotes[
      dailyCollectionIndex(state.date, focusGooseQuotes.length, 13)
    ]
  }, [state.date])
  const headlineQuote =
    headlineQuotes[dailyCollectionIndex(state.date, headlineQuotes.length)]
  const focusGooseQuote =
    focusGooseQuotes[dailyCollectionIndex(state.date, focusGooseQuotes.length, 7)]

  const morningElapsed = state.morningStartedAt
    ? Math.floor((now - state.morningStartedAt) / 1000)
    : 0
  const morningRemaining = Math.max(0, MORNING_MINUTES * 60 - morningElapsed)
  const allMorningComplete = morningActivities.every((activity) => state.morningChecks[activity.id])
  const totalPlannedMinutes = state.tasks
    .filter(
      (task) => task.status !== 'done' && task.kind !== 'pr-review' && !task.isBackground,
    )
    .reduce((total, task) => total + task.durationMinutes, 0)

  function startDay() {
    updateState((current) => ({
      ...current,
      screen: 'morning',
      morningStartedAt: Date.now(),
      prReviewStart: timeInputValue(new Date(Date.now() + MORNING_MINUTES * 60 * 1000)),
      tasks: [
        ...(current.tasks.some(
          (task) => task.kind === 'pr-review' || task.title.trim().toLowerCase() === 'pr reviews',
        )
          ? []
          : [
              createTask(
                'PR reviews',
                PR_REVIEW_MINUTES,
                'suggested',
                localDateKey(),
                'Review active team PRs that are not yours, are not drafts, and have author approval.',
                'pr-review',
              ),
            ]),
        ...(current.tasks.length > 0
          ? current.tasks
          : suggestedSeedTasks.map((task) =>
              createTask(task.title, task.durationMinutes, 'suggested', localDateKey(), task.notes),
            )),
      ],
    }))
  }

  function toggleMorning(id: string) {
    updateState((current) => ({
      ...current,
      morningChecks: {
        ...current.morningChecks,
        [id]: !current.morningChecks[id],
      },
    }))
  }

  function completeMorningSetup() {
    if (!allMorningComplete) {
      return
    }

    const changedAt = Date.now()
    if (!state.morningSetupAwarded) {
      setCelebration('☀️ Morning setup complete! +30 points')
      setScoreBurst(30)
      setConfettiActive(true)
      playGooseChime('complete')
      window.setTimeout(() => setCelebration(''), 4000)
      window.setTimeout(() => setScoreBurst(undefined), 1800)
      window.setTimeout(() => setConfettiActive(false), 2200)
    }
    updateState((current) => {
      const planningState: DailyState = {
        ...current,
        screen: 'planning',
        morningSetupAwarded: true,
      }
      return current.morningSetupAwarded
        ? planningState
        : applyScoreChange(planningState, 30, 'Completed morning setup', changedAt)
    })
  }

  function addTask() {
    const title = newTaskTitle.trim()
    if (!title) {
      return
    }

    updateState((current) => {
      const activeTaskId = current.tasks[current.activeTaskIndex]?.id
      const tasks = moveCompletedTasksToBottom([
        ...current.tasks,
        createTask(title, 60, 'manual'),
      ])
      const activeTaskIndex = activeTaskId
        ? tasks.findIndex((task) => task.id === activeTaskId)
        : current.activeTaskIndex
      return {
        ...current,
        tasks,
        activeTaskIndex:
          activeTaskIndex >= 0 ? activeTaskIndex : current.activeTaskIndex,
      }
    })
    setNewTaskTitle('')
  }

  function addAdHocTask() {
    const title = newAdHocTaskTitle.trim()
    if (!title) {
      return
    }

    updateState((current) => {
      if (newAdHocTaskWhen === 'future') {
        const futureTask: FutureTask = {
          id: createId(),
          title,
          targetDate: newAdHocTaskDate,
          notes: newAdHocTaskNotes.trim(),
          durationMinutes: Math.max(5, newAdHocTaskDuration),
          isBackground: newAdHocTaskIsBackground,
          backgroundReminderMinutes: Math.max(5, newAdHocTaskReminderMinutes),
          isStretchGoal: newAdHocTaskIsStretchGoal,
        }
        return {
          ...current,
          futureTasks: [...current.futureTasks, futureTask].sort((left, right) =>
            left.targetDate.localeCompare(right.targetDate),
          ),
        }
      }

      const activeTaskId = current.tasks[current.activeTaskIndex]?.id
      const task: DailyTask = {
        ...createTask(
          title,
          Math.max(5, newAdHocTaskDuration),
          'manual',
          localDateKey(),
          newAdHocTaskNotes.trim(),
        ),
        isBackground: newAdHocTaskIsBackground,
        isStretchGoal: newAdHocTaskIsStretchGoal,
        backgroundReminderMinutes: Math.max(5, newAdHocTaskReminderMinutes),
      }
      const tasks = moveCompletedTasksToBottom([
        ...current.tasks,
        task,
      ])
      const activeTaskIndex = activeTaskId
        ? tasks.findIndex((task) => task.id === activeTaskId)
        : current.activeTaskIndex
      return {
        ...current,
        tasks,
        activeTaskIndex:
          activeTaskIndex >= 0 ? activeTaskIndex : current.activeTaskIndex,
      }
    })
    setNewAdHocTaskTitle('')
    setNewAdHocTaskNotes('')
    setNewAdHocTaskDuration(60)
    setNewAdHocTaskIsBackground(false)
    setNewAdHocTaskIsStretchGoal(false)
    setNewAdHocTaskReminderMinutes(60)
    setNewAdHocTaskWhen('today')
    setNewAdHocTaskDate(futureDateKey(1))
  }

  function updateTask(id: string, patch: Partial<DailyTask>) {
    updateState((current) => {
      const activeTaskId = current.tasks[current.activeTaskIndex]?.id
      const updatedTasks = current.tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              ...patch,
              completedAt:
                patch.status === 'todo' ? undefined : task.completedAt,
            }
          : task,
      )
      const tasks =
        patch.status === undefined
          ? updatedTasks
          : moveCompletedTasksToBottom(updatedTasks)
      const activeTaskIndex = activeTaskId
        ? tasks.findIndex((task) => task.id === activeTaskId)
        : current.activeTaskIndex

      return {
        ...current,
        tasks,
        activeTaskIndex:
          activeTaskIndex >= 0 ? activeTaskIndex : current.activeTaskIndex,
      }
    })
  }

  function addTimeToTask(id: string) {
    clearFocusNotifications()
    updateState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === id && task.status !== 'done' && !task.isBackground
          ? {
              ...task,
              durationMinutes: task.durationMinutes + 15,
            }
          : task,
      ),
    }))
  }

  function moveTask(id: string, offset: -1 | 1) {
    updateState((current) => {
      const fromIndex = current.tasks.findIndex((task) => task.id === id)
      const toIndex = fromIndex + offset
      if (fromIndex < 0 || toIndex < 0 || toIndex >= current.tasks.length) {
        return current
      }

      const tasks = [...current.tasks]
      const movedTask = tasks[fromIndex]
      const activeTaskId = current.tasks[current.activeTaskIndex]?.id
      tasks.splice(fromIndex, 1)
      tasks.splice(toIndex, 0, movedTask)

      return {
        ...current,
        tasks,
        activeTaskIndex: activeTaskId
          ? tasks.findIndex((task) => task.id === activeTaskId)
          : current.activeTaskIndex,
      }
    })
  }

  function moveTaskToPosition(id: string, insertionIndex: number) {
    updateState((current) => {
      const fromIndex = current.tasks.findIndex((task) => task.id === id)
      if (fromIndex < 0) {
        return current
      }

      const tasks = [...current.tasks]
      const activeTaskId = tasks[current.activeTaskIndex]?.id
      const [movedTask] = tasks.splice(fromIndex, 1)
      const adjustedInsertionIndex =
        fromIndex < insertionIndex ? insertionIndex - 1 : insertionIndex
      const boundedInsertionIndex = Math.max(
        0,
        Math.min(tasks.length, adjustedInsertionIndex),
      )
      tasks.splice(boundedInsertionIndex, 0, movedTask)

      return {
        ...current,
        tasks,
        activeTaskIndex: activeTaskId
          ? tasks.findIndex((task) => task.id === activeTaskId)
          : current.activeTaskIndex,
      }
    })
  }

  function startTaskDrag(event: DragEvent<HTMLElement>, taskId: string) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', taskId)
    setDraggedTaskId(taskId)
  }

  function dropTask(event: DragEvent<HTMLElement>, targetIndex: number) {
    event.preventDefault()
    const taskId = event.dataTransfer.getData('text/plain') || draggedTaskId
    if (!taskId) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()
    const dropAfter = event.clientY > bounds.top + bounds.height / 2
    moveTaskToPosition(taskId, targetIndex + (dropAfter ? 1 : 0))
    setDraggedTaskId(undefined)
    setDragOverTaskId(undefined)
  }

  function removeTask(id: string) {
    updateState((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== id),
    }))
  }

  function removeTaskFromFocus(id: string) {
    const task = state.tasks.find((item) => item.id === id)
    if (!task) {
      return
    }

    const changedAt = Date.now()
    setCelebration(`🪿 +10 points! "${task.title}" no longer needs your time.`)
    setScoreBurst(10)
    setGooseFlipping(true)
    setConfettiActive(true)
    playGooseChime('complete')
    window.setTimeout(() => setCelebration(''), 4000)
    window.setTimeout(() => setScoreBurst(undefined), 2200)
    window.setTimeout(() => setGooseFlipping(false), 850)
    window.setTimeout(() => setConfettiActive(false), 2600)

    setState((current) => {
      const activeTask = current.tasks[current.activeTaskIndex]
      const committed =
        activeTask?.id === id
          ? commitActiveTaskProgress(current, changedAt)
          : current
      const removedIndex = committed.tasks.findIndex((item) => item.id === id)
      if (removedIndex < 0) {
        return current
      }

      const tasks = committed.tasks.filter((item) => item.id !== id)
      const previousActiveTaskId = committed.tasks[committed.activeTaskIndex]?.id
      const previousActiveIndex = previousActiveTaskId
        ? tasks.findIndex((item) => item.id === previousActiveTaskId)
        : -1
      const activeTaskIndex =
        previousActiveIndex >= 0
          ? previousActiveIndex
          : Math.max(0, Math.min(removedIndex, tasks.length - 1))
      const clearedState: DailyState = {
        ...committed,
        screen: tasks.length === 0 ? 'planning' : committed.screen,
        tasks,
        activeTaskIndex,
        taskStartedAt: undefined,
        pauseStartedAt: undefined,
        pausedSeconds: 0,
        isPaused: true,
        pauseReason: 'ready',
      }
      return applyScoreChange(
        clearedState,
        10,
        `Removed unneeded task: ${task.title}`,
        changedAt,
      )
    })
  }

  function addFutureTask() {
    const title = newFutureTitle.trim()
    if (!title) {
      return
    }

    updateState((current) => ({
      ...current,
      futureTasks: [
        ...current.futureTasks,
        {
          id: createId(),
          title,
          targetDate: newFutureDate,
          notes: '',
        },
      ],
    }))
    setNewFutureTitle('')
  }

  function refreshMeetings() {
    updateState((current) => ({
      ...current,
      meetingsLoaded: false,
      calendarError: '',
    }))
  }

  function saveLunchChanges() {
    updateState((current) => ({
      ...current,
      lunchStart: lunchDraftStart,
      lunchDurationMinutes: lunchDraftDuration,
      lunchInProgress: false,
      lunchCompleted: false,
    }))
  }

  function toggleMeeting(id: string) {
    updateState((current) => ({
      ...current,
      meetings: current.meetings.map((meeting) =>
        meeting.id === id ? { ...meeting, selected: !meeting.selected } : meeting,
      ),
    }))
  }

  function setMeetingMovement(id: string, movementMode: 'walk' | 'stand') {
    updateState((current) => ({
      ...current,
      meetings: current.meetings.map((meeting) =>
        meeting.id === id
          ? {
              ...meeting,
              movementMode: meeting.movementMode === movementMode ? 'none' : movementMode,
            }
          : meeting,
      ),
    }))
  }

  function addAdHocMeeting() {
    const title = newAdHocMeetingTitle.trim()
    if (!title) {
      return
    }

    const startTimestamp = timeOnDate(state.date, newAdHocMeetingStart)
    const durationMinutes = Math.max(5, newAdHocMeetingDuration)
    const meeting: CalendarMeeting = {
      id: `ad-hoc-${createId()}`,
      title,
      start: new Date(startTimestamp).toISOString(),
      end: new Date(startTimestamp + durationMinutes * 60 * 1000).toISOString(),
      responseStatus: 'Ad hoc',
      selected: true,
      movementMode: newAdHocMovementMode,
    }

    updateState((current) => ({
      ...current,
      meetings: [...current.meetings, meeting].sort(
        (left, right) => new Date(left.start).getTime() - new Date(right.start).getTime(),
      ),
    }))
    setNewAdHocMeetingTitle('')
    setNewAdHocMovementMode('none')
  }

  function exitMeetingAndStartNextTask() {
    clearFocusNotifications()
    const meetingKey = activeMeeting ? `${activeMeeting.id}-${activeMeeting.start}` : undefined
    updateState((current) => {
      const changedAt = Date.now()
      const committed = commitActiveTaskProgress(current, changedAt)
      const currentTask = committed.tasks[committed.activeTaskIndex]
      const nextIndex = findNextFocusTaskIndex(
        committed.tasks,
        committed.activeTaskIndex,
        currentTask?.id,
      )
      return {
        ...committed,
        exitedMeetingKeys:
          meetingKey && !committed.exitedMeetingKeys.includes(meetingKey)
            ? [...committed.exitedMeetingKeys, meetingKey]
            : committed.exitedMeetingKeys,
        activeTaskIndex: nextIndex >= 0 ? nextIndex : committed.activeTaskIndex,
        previousTaskId:
          nextIndex >= 0 && currentTask ? currentTask.id : committed.previousTaskId,
        isPaused: true,
        pauseReason: 'ready',
      }
    })
  }

  function refreshPullRequests() {
    setPullRequests([])
    setPullRequestsError('')
    setPullRequestsLoading(true)
    setPullRequestsLoaded(false)
  }

  function toggleManualPause() {
    const changedAt = Date.now()
    updateState((current) => toggleManualPauseState(current, changedAt))
  }

  function completeDay() {
    if (state.dayCompletedAt) {
      return
    }

    const completedAt = Date.now()
    const lateHours = Math.max(
      0,
      Math.floor((completedAt - dayEnd) / (60 * 60 * 1000)),
    )
    const completionPoints = Math.max(0, 300 - lateHours * 50)
    window.dailyGoose?.hideMini()
    window.dailyGoose?.setActivityAwareness({
      enabled: false,
      taskTitle: '',
    })
    setCelebration(
      lateHours > 0
        ? `🎉 Day complete! +${completionPoints} points after ${lateHours} late hour${
            lateHours === 1 ? '' : 's'
          }.`
        : `🎉 Day complete on time! +${completionPoints} points.`,
    )
    setScoreBurst(completionPoints)
    setConfettiActive(true)
    playGooseChime('complete')
    window.setTimeout(() => setCelebration(''), 5000)
    window.setTimeout(() => setScoreBurst(undefined), 2200)
    window.setTimeout(() => setConfettiActive(false), 3200)

    updateState((current) => {
      const committed = commitActiveTaskProgress(current, completedAt)
      const completedState: DailyState = {
        ...committed,
        completedTaskHistory: archiveCompletedTasks(
          committed.completedTaskHistory,
          committed.tasks,
          committed.date,
          completedAt,
        ),
        dayCompletedAt: completedAt,
        dayCompletionPoints: completionPoints,
        endOfDayCelebrated: true,
        endOfDayDismissed: false,
        isPaused: true,
        pauseStartedAt: undefined,
        pauseReason: 'end-of-day',
        dailyCompletionStreak: completionStreakAfterCompletingDay(
          committed.date,
          committed.dailyCompletionStreak,
          committed.lastCompletedDay,
        ),
        lastCompletedDay: committed.date,
        onTimeDaysCompleted:
          committed.onTimeDaysCompleted + (lateHours === 0 ? 1 : 0),
      }
      return completionPoints > 0
        ? applyScoreChange(
            completedState,
            completionPoints,
            lateHours > 0
              ? `Completed day ${lateHours} hour${lateHours === 1 ? '' : 's'} late`
              : 'Completed day on time',
            completedAt,
          )
        : completedState
    })
  }

  function finishDayCelebration() {
    updateState((current) => ({
      ...current,
      screen: 'day-complete',
      endOfDayDismissed: true,
    }))
  }

  function startNewDayManually() {
    localStorage.setItem(MANUAL_NEW_DAY_KEY, easternCalendarDateKey())
    window.location.reload()
  }

  function editToday() {
    const changedAt = Date.now()
    updateState((current) => {
      const existingManualPauseSeconds =
        current.isPaused && current.pauseReason === 'manual' && current.pauseStartedAt
          ? Math.max(0, Math.floor((changedAt - current.pauseStartedAt) / 1000))
          : 0
      const committed = commitActiveTaskProgress(current, changedAt)

      return {
        ...committed,
        screen: 'planning',
        isPaused: true,
        pauseStartedAt: changedAt,
        pauseReason: 'manual',
        workdayExtensionSeconds:
          committed.workdayExtensionSeconds + existingManualPauseSeconds,
      }
    })
  }

  function beginFocus() {
    if (invalidNumberFields.size > 0) {
      return
    }

    if (state.tasks.length === 0) {
      return
    }

    const prTaskIndex = state.tasks.findIndex(
      (task) =>
        task.status !== 'done' &&
        (task.kind === 'pr-review' || task.title.trim().toLowerCase() === 'pr reviews'),
    )
    const firstWorkTaskIndex = state.tasks.findIndex(
      (task) =>
        task.status !== 'done' &&
        task.kind !== 'pr-review' &&
        !task.isBackground &&
        task.title.trim().toLowerCase() !== 'pr reviews',
    )
    const prBlockIsActive =
      Date.now() >= prReviewStartTimestamp && Date.now() < prReviewEndTimestamp
    const firstIncomplete =
      prBlockIsActive && prTaskIndex >= 0
        ? prTaskIndex
        : firstWorkTaskIndex >= 0
          ? firstWorkTaskIndex
          : prTaskIndex
    const firstTask = firstIncomplete >= 0 ? state.tasks[firstIncomplete] : undefined
    if (
      firstTask?.kind === 'pr-review' ||
      firstTask?.title.trim().toLowerCase() === 'pr reviews'
    ) {
      setPullRequestsLoading(true)
      setPullRequestsLoaded(false)
    }
    updateState((current) => {
      const changedAt = Date.now()
      const editingSeconds =
        current.pauseReason === 'manual' && current.pauseStartedAt
          ? Math.max(0, Math.floor((changedAt - current.pauseStartedAt) / 1000))
          : 0
      const currentTask = current.tasks[current.activeTaskIndex]
      const canResumeCurrentTask =
        Boolean(current.backgroundRemindersStartedAt) &&
        currentTask &&
        currentTask.status !== 'done' &&
        !currentTask.isBackground
      const selectedIndex = canResumeCurrentTask
        ? current.activeTaskIndex
        : firstIncomplete

      return {
        ...current,
        screen: 'focus',
        activeTaskIndex: selectedIndex,
        taskStartedAt: undefined,
        pauseStartedAt: undefined,
        pausedSeconds: 0,
        isPaused: true,
        pauseReason: 'ready',
        backgroundRemindersStartedAt: current.backgroundRemindersStartedAt || changedAt,
        workdayExtensionSeconds:
          current.workdayExtensionSeconds + editingSeconds,
      }
    })
  }

  function selectActiveTask(index: number) {
    clearFocusNotifications()
    const selectedTask = state.tasks[index]
    if (selectedTask?.isBackground || selectedTask?.status === 'done') {
      return
    }
    if (
      selectedTask?.kind === 'pr-review' ||
      selectedTask?.title.trim().toLowerCase() === 'pr reviews'
    ) {
      setPullRequestsLoading(true)
      setPullRequestsLoaded(false)
    }
    updateState((current) => {
      const changedAt = Date.now()
      const currentTask = current.tasks[current.activeTaskIndex]
      const committed = commitActiveTaskProgress(current, changedAt)
      const selectedTaskAfterCommit = committed.tasks[index]
      const selectedTaskNeedsMoreTime =
        selectedTaskAfterCommit &&
        selectedTaskAfterCommit.elapsedSeconds >=
          selectedTaskAfterCommit.durationMinutes * 60
      return {
        ...committed,
        activeTaskIndex: index,
        previousTaskId: selectedTaskNeedsMoreTime
          ? selectedTaskAfterCommit.id
          : currentTask && current.activeTaskIndex !== index
            ? currentTask.id
            : committed.previousTaskId,
        isPaused: true,
        pauseReason: 'ready',
      }
    })
  }

  function completeTask(id: string) {
    const task = state.tasks.find((candidate) => candidate.id === id)
    if (!task || task.status === 'done') {
      return
    }

    const completedAt = Date.now()
    const elapsedAtCompletion =
      task.elapsedSeconds +
      (state.tasks[state.activeTaskIndex]?.id === id
        ? activeSessionElapsedSeconds(state, completedAt)
        : 0)
    const uninterrupted =
      !task.isBackground &&
      elapsedAtCompletion > 0 &&
      task.manualPauseCount === 0 &&
      task.focusDriftCount === 0
    const completionPoints = task.scoreAwarded
      ? 0
      : 100 + (uninterrupted ? 30 : 0)
    setCelebration(
      `🎉 ${task.title} is done! +${completionPoints} points${
        uninterrupted ? ' · Focus Feather bonus!' : ''
      }`,
    )
    setGooseFlipping(true)
    if (completionPoints > 0) {
      setScoreBurst(completionPoints)
      setConfettiActive(true)
      window.setTimeout(() => setScoreBurst(undefined), 1800)
      window.setTimeout(() => setConfettiActive(false), 2600)
    }
    playGooseChime('complete')
    window.setTimeout(() => setCelebration(''), 4000)
    window.setTimeout(() => setGooseFlipping(false), 850)

    clearFocusNotifications()
    updateState((current) => {
      const currentActiveTask = current.tasks[current.activeTaskIndex]
      const completingActiveTask = currentActiveTask?.id === id
      const committed = completingActiveTask
        ? commitActiveTaskProgress(current, completedAt)
        : current
      const nextIndex = completingActiveTask
        ? findNextFocusTaskIndex(
            committed.tasks,
            committed.activeTaskIndex,
            id,
          )
        : -1
      const nextTaskId =
        nextIndex >= 0 ? committed.tasks[nextIndex]?.id : undefined
      const taskBeingCompleted = committed.tasks.find((candidate) => candidate.id === id)
      const shouldAward = Boolean(taskBeingCompleted && !taskBeingCompleted.scoreAwarded)
      const nextFocusStreak =
        shouldAward && uninterrupted ? committed.focusStreak + 1 : 0
      const updatedTasks = committed.tasks.map((candidate) =>
        candidate.id === id
          ? {
              ...candidate,
              status: 'done' as const,
              scoreAwarded: candidate.scoreAwarded || shouldAward,
              completedAt,
            }
          : candidate,
      )
      const tasks = moveCompletedTasksToBottom(updatedTasks)
      const activeTaskId = completingActiveTask
        ? nextTaskId || id
        : currentActiveTask?.id
      const activeTaskIndex = activeTaskId
        ? tasks.findIndex((candidate) => candidate.id === activeTaskId)
        : committed.activeTaskIndex
      const completedState: DailyState = {
        ...committed,
        tasks,
        activeTaskIndex:
          activeTaskIndex >= 0 ? activeTaskIndex : committed.activeTaskIndex,
        previousTaskId: completingActiveTask ? id : committed.previousTaskId,
        taskStartedAt: completingActiveTask ? undefined : committed.taskStartedAt,
        pauseStartedAt: completingActiveTask ? undefined : committed.pauseStartedAt,
        pausedSeconds: completingActiveTask ? 0 : committed.pausedSeconds,
        isPaused: completingActiveTask ? true : committed.isPaused,
        pauseReason: completingActiveTask ? 'ready' : committed.pauseReason,
        completedTasksToday:
          committed.completedTasksToday + (shouldAward ? 1 : 0),
        uninterruptedCompletionsToday:
          committed.uninterruptedCompletionsToday +
          (shouldAward && uninterrupted ? 1 : 0),
        focusStreak: nextFocusStreak,
        longestFocusStreak: Math.max(
          committed.longestFocusStreak,
          nextFocusStreak,
        ),
      }
      return shouldAward
        ? applyScoreChange(
            completedState,
            completionPoints,
            uninterrupted
              ? `Completed ${task.title} with uninterrupted focus`
              : `Completed ${task.title}`,
          )
        : completedState
    })
  }

  completeTaskRef.current = completeTask

  function breakDownTask(id: string) {
    setExpandedStepTaskIds((current) =>
      current.includes(id)
        ? current.filter((taskId) => taskId !== id)
        : [...current, id],
    )
  }

  function addSubtask(taskId: string) {
    const title = (newStepDrafts[taskId] || '').trim()
    if (!title) {
      return
    }

    updateState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId && !task.subtasks.includes(title)
          ? { ...task, subtasks: [...task.subtasks, title] }
          : task,
      ),
    }))
    setNewStepDrafts((current) => ({ ...current, [taskId]: '' }))
  }

  function renameSubtask(taskId: string, subtaskIndex: number, title: string) {
    updateState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id !== taskId) {
          return task
        }

        const previousTitle = task.subtasks[subtaskIndex]
        const subtasks = [...task.subtasks]
        subtasks[subtaskIndex] = title
        return {
          ...task,
          subtasks,
          completedSubtasks: task.completedSubtasks.map((completed) =>
            completed === previousTitle ? title : completed,
          ),
        }
      }),
    }))
  }

  function removeSubtask(taskId: string, subtaskIndex: number) {
    updateState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id !== taskId) {
          return task
        }

        const removedTitle = task.subtasks[subtaskIndex]
        return {
          ...task,
          subtasks: task.subtasks.filter((_, index) => index !== subtaskIndex),
          completedSubtasks: task.completedSubtasks.filter(
            (completed) => completed !== removedTitle,
          ),
        }
      }),
    }))
  }

  function clearSubtasks(taskId: string) {
    updateTask(taskId, {
      subtasks: [],
      completedSubtasks: [],
    })
  }

  function toggleSubtask(taskId: string, subtask: string) {
    const task = state.tasks.find((candidate) => candidate.id === taskId)
    if (!task) {
      return
    }

    const completed = task.completedSubtasks.includes(subtask)
    updateTask(taskId, {
      completedSubtasks: completed
        ? task.completedSubtasks.filter((candidate) => candidate !== subtask)
        : [...task.completedSubtasks, subtask],
    })
  }

  function renderTaskSteps(task: DailyTask) {
    const isEditing = expandedStepTaskIds.includes(task.id)
    if (!isEditing && task.subtasks.length === 0) {
      return null
    }

    if (!isEditing) {
      return (
        <div className="subtask-list">
          {task.subtasks.map((subtask, subtaskIndex) => {
            const checked = task.completedSubtasks.includes(subtask)
            return (
              <label className={checked ? 'complete' : ''} key={`${task.id}-${subtaskIndex}`}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSubtask(task.id, subtask)}
                />
                <span>{subtask}</span>
              </label>
            )
          })}
        </div>
      )
    }

    return (
      <div className="subtask-editor">
        <div className="subtask-editor-heading">
          <strong>Your steps</strong>
          {task.subtasks.length > 0 && (
            <button onClick={() => clearSubtasks(task.id)}>Clear all</button>
          )}
        </div>
        {task.subtasks.map((subtask, subtaskIndex) => {
          const checked = task.completedSubtasks.includes(subtask)
          return (
            <div
              className={`subtask-editor-row ${checked ? 'complete' : ''}`}
              key={`${task.id}-${subtaskIndex}`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleSubtask(task.id, subtask)}
              />
              <input
                value={subtask}
                aria-label={`Step ${subtaskIndex + 1} for ${task.title}`}
                onChange={(event) =>
                  renameSubtask(task.id, subtaskIndex, event.target.value)
                }
              />
              <button
                aria-label={`Remove step ${subtaskIndex + 1} from ${task.title}`}
                onClick={() => removeSubtask(task.id, subtaskIndex)}
              >
                ×
              </button>
            </div>
          )
        })}
        <div className="subtask-add">
          <input
            value={newStepDrafts[task.id] || ''}
            placeholder="Add your own next step"
            onChange={(event) =>
              setNewStepDrafts((current) => ({
                ...current,
                [task.id]: event.target.value,
              }))
            }
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                addSubtask(task.id)
              }
            }}
          />
          <button onClick={() => addSubtask(task.id)}>Add step</button>
        </div>
      </div>
    )
  }

  function renderChecklistMeeting(meeting: CalendarMeeting) {
    const meetingCompleted = now >= new Date(meeting.end).getTime()
    return (
      <article
        className={`focus-task meeting-checklist-item ${
          meetingCompleted ? 'completed' : ''
        }`}
        key={`checklist-${meeting.id}`}
      >
        <span className="meeting-check" aria-hidden="true">✓</span>
        <img
          className="task-pose meeting-task-pose"
          src={meetingPoseUrl(meeting.movementMode)}
          alt=""
        />
        <div className="focus-task-copy">
          <span className="meeting-checklist-label">Meeting</span>
          <strong className="meeting-checklist-title">{meeting.title}</strong>
          <span className="task-time-progress">
            {formatClock(meeting.start)}–{formatClock(meeting.end)} ·{' '}
            {meeting.movementMode === 'walk'
              ? 'Walking meeting'
              : meeting.movementMode === 'stand'
                ? 'Standing meeting'
                : 'Scheduled meeting'}
          </span>
        </div>
        <span className="meeting-calendar-badge">
          {meetingCompleted ? 'Completed' : 'Calendar'}
        </span>
      </article>
    )
  }

  return (
    <div className="app-shell">
      <div className="orb orb-one" />
      <div className="orb orb-two" />
      {celebration && <div className="celebration">{celebration}</div>}
      {scoreBurst !== undefined && (
        <div className={`score-burst ${scoreBurst < 0 ? 'negative' : ''}`}>
          {scoreBurst > 0 ? '+' : ''}
          {scoreBurst}
        </div>
      )}
      {confettiActive && (
        <div className="confetti-layer" aria-hidden="true">
          {Array.from({ length: 28 }, (_, index) => (
            <span key={index} />
          ))}
        </div>
      )}
      <div className="game-status-chips">
        <div
          className="streak-chip"
          title={`${state.dailyCompletionStreak} consecutive completed day${
            state.dailyCompletionStreak === 1 ? '' : 's'
          }`}
        >
          <span>🔥 {state.dailyCompletionStreak}</span>
          <small>day streak</small>
        </div>
        <button className="score-chip" onClick={() => setShowScoreboard(true)}>
          <span>⭐ {state.score} pts</span>
          <small>Best {highScore}</small>
        </button>
      </div>

      {showScoreboard && (
        <div className="scoreboard-overlay" role="dialog" aria-modal="true">
          <section className="scoreboard-card">
            <header>
              <div>
                <p className="eyebrow">JUST A CORPORATE GOOSE GAME</p>
                <div className="waddle-log-title-row">
                  <h1>Your waddle log</h1>
                  <span
                    className="duck-footprint-trail"
                    aria-label="Animated duck footprints"
                  >
                    {Array.from({ length: 5 }, (_, index) => (
                      <svg
                        className="duck-footprint"
                        key={index}
                        style={
                          {
                            '--footprint-index': index,
                          } as CSSProperties
                        }
                        viewBox="0 0 20 24"
                        aria-hidden="true"
                      >
                        <path d="M10 18V7M10 13L4 6M10 13L16 6" />
                        <ellipse cx="10" cy="20" rx="3.2" ry="2.4" />
                      </svg>
                    ))}
                  </span>
                </div>
                <p>Build momentum one focused waddle at a time.</p>
              </div>
              <button
                className="scoreboard-close"
                aria-label="Close score history"
                onClick={() => setShowScoreboard(false)}
              >
                ×
              </button>
            </header>

            <div className="score-summary-grid">
              <div>
                <span>Daily usage streak</span>
                <strong>🔥 {state.dailyCompletionStreak}</strong>
                <small>completed days in a row</small>
              </div>
              <div>
                <span>Today</span>
                <strong>{state.score}</strong>
                <small>points</small>
              </div>
              <div>
                <span>High score</span>
                <strong>{highScore}</strong>
                <small>best day</small>
              </div>
              <div>
                <span>Focus streak</span>
                <strong>{state.focusStreak}</strong>
                <small>uninterrupted tasks</small>
              </div>
              <div>
                <span>Badges</span>
                <strong>{state.earnedBadgeIds.length}</strong>
                <small>earned</small>
              </div>
            </div>

            <section className="score-trend-card">
              <div className="score-trend-heading">
                <div>
                  <p className="eyebrow">POINTS TREND</p>
                  <h2>Your daily momentum</h2>
                </div>
                <div className="score-trend-filters" aria-label="Points trend range">
                  {(['week', 'month', 'year'] as ScoreTrendRange[]).map((range) => (
                    <button
                      className={scoreTrendRange === range ? 'selected' : ''}
                      key={range}
                      onClick={() => setScoreTrendRange(range)}
                    >
                      {range[0].toUpperCase() + range.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="score-trend-chart">
                <span className="score-trend-maximum">{trendMaximum} pts</span>
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`${scoreTrendRange} daily points trend`}
                >
                  <defs>
                    <linearGradient id="scoreTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b6bdd" stopOpacity="0.38" />
                      <stop offset="100%" stopColor="#8b6bdd" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <polygon
                    points={`0,100 ${trendPoints} 100,100`}
                    fill="url(#scoreTrendFill)"
                  />
                  <polyline points={trendPoints} fill="none" />
                </svg>
                <div className="score-trend-labels">
                  {[0, Math.floor((trendScores.length - 1) / 2), trendScores.length - 1].map(
                    (index) => (
                      <span key={trendScores[index].date}>
                        {new Date(`${trendScores[index].date}T12:00:00`).toLocaleDateString(
                          undefined,
                          { month: 'short', day: 'numeric' },
                        )}
                      </span>
                    ),
                  )}
                </div>
              </div>
            </section>

            <section className="behavior-baseline">
              <div>
                <p className="eyebrow">PERSONAL CALIBRATION</p>
                <h2>
                  {behaviorBaseline.calibrated
                    ? 'Your rolling 7-day rhythm'
                    : `Learning your rhythm: ${Math.min(
                        behaviorBaseline.trackedDays,
                        7,
                      )}/7 days`}
                </h2>
                <p>
                  {behaviorBaseline.calibrated
                    ? 'Personal badge goals now adapt to what a realistic stretch looks like for you.'
                    : 'Keep using the goose normally. Personalized goals will appear after seven tracked days.'}
                </p>
              </div>
              {behaviorBaseline.calibrated && (
                <div className="behavior-baseline-stats">
                  <span>
                    <strong>{behaviorBaseline.averageTasks.toFixed(1)}</strong>
                    tasks/day
                  </span>
                  <span>
                    <strong>{behaviorBaseline.averageFocusedTasks.toFixed(1)}</strong>
                    focused/day
                  </span>
                  <span>
                    <strong>{Math.round(behaviorBaseline.averagePoints)}</strong>
                    points/day
                  </span>
                  <span>
                    <strong>{behaviorBaseline.morningSetupDays}</strong>
                    mornings
                  </span>
                </div>
              )}
            </section>

            {earnedBadges.length > 0 && (
              <section className="earned-badges">
                <div>
                  <p className="eyebrow">YOUR TROPHY PERCH</p>
                  <h2>Earned badges</h2>
                </div>
                <div className="earned-badge-shelf">
                  {earnedBadges.map((badge) => (
                    <span
                      className="earned-badge-icon"
                      data-tooltip={`${badge.title}: ${badge.description}`}
                      aria-label={`${badge.title}: ${badge.description}`}
                      tabIndex={0}
                      key={badge.id}
                    >
                      {badge.icon}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="point-rules">
              <div className="point-rules-heading">
                <div>
                  <p className="eyebrow">HOW POINTS WORK</p>
                  <h2>Corporate goose scoring rules</h2>
                </div>
                <span>Your score never drops below zero.</span>
              </div>
              <div className="point-rule-grid">
                <article className="positive">
                  <strong>+100</strong>
                  <span>Complete a task</span>
                </article>
                <article className="positive">
                  <strong>+30</strong>
                  <span>Finish a focus task without pausing or drifting</span>
                </article>
                <article className="positive">
                  <strong>+30</strong>
                  <span>Complete the full morning setup once per day</span>
                </article>
                <article className="positive">
                  <strong>+10</strong>
                  <span>Remove a task that no longer needs to be done</span>
                </article>
                <article className="positive">
                  <strong>+1/oz</strong>
                  <span>Drink water up to your original daily goal</span>
                </article>
                <article className="positive">
                  <strong>+25</strong>
                  <span>Fill each 32 oz water cup</span>
                </article>
                <article className="positive">
                  <strong>+2/oz</strong>
                  <span>Drink water above your original daily goal</span>
                </article>
                <article className="negative">
                  <strong>-5</strong>
                  <span>Manually pause a running focus task</span>
                </article>
                <article className="negative">
                  <strong>-5</strong>
                  <span>End lunch before its planned finish time</span>
                </article>
                <article className="positive">
                  <strong>+300</strong>
                  <span>Complete your day, minus 50 points per full late hour</span>
                </article>
              </div>
            </section>

            <div className="scoreboard-columns">
              <section>
                <h2>Badges to work toward</h2>
                <div className="badge-grid">
                  {badgesInProgress.map((badge) => {
                    const progress = Math.min(
                      100,
                      (badge.progress / badge.target) * 100,
                    )
                    return (
                      <article key={badge.id}>
                        <span className="badge-icon">{badge.icon}</span>
                        <div>
                          <strong>{badge.title}</strong>
                          <p>{badge.description}</p>
                          <div className="badge-progress">
                            <span style={{ width: `${progress}%` }} />
                          </div>
                          <small>
                            {Math.min(badge.progress, badge.target)} / {badge.target}
                          </small>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>

              <section>
                <h2>Daily scores</h2>
                <div className="score-history-list">
                  {scoreHistory.map((summary) => (
                    <article key={summary.date}>
                      <div>
                        <strong>
                          {new Date(`${summary.date}T12:00:00`).toLocaleDateString(
                            undefined,
                            {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            },
                          )}
                        </strong>
                        <small>
                          {summary.completedTasks} tasks ·{' '}
                          {summary.uninterruptedCompletions} focused
                        </small>
                      </div>
                      <span>{summary.score} pts</span>
                    </article>
                  ))}
                </div>

                <h2>Today’s point log</h2>
                <div className="score-event-list">
                  {state.scoreEvents.length === 0 ? (
                    <p className="empty-copy">Your first points are waiting.</p>
                  ) : (
                    state.scoreEvents.map((event) => (
                      <article key={event.id}>
                        <div>
                          <strong>{event.label}</strong>
                          <small>{formatClock(event.timestamp)}</small>
                        </div>
                        <span className={event.points < 0 ? 'negative' : ''}>
                          {event.points > 0 ? '+' : ''}
                          {event.points}
                        </span>
                      </article>
                    ))
                  )}
                </div>
              </section>
            </div>
          </section>
        </div>
      )}

      {showTaskHistory && (
        <div className="task-history-overlay" role="dialog" aria-modal="true">
          <section className="task-history-card">
            <header>
              <div>
                <p className="eyebrow">ONE YEAR OF WADDLES</p>
                <h1>Completed task history</h1>
                <p>Every completed task from the last year, newest first.</p>
              </div>
              <button
                className="scoreboard-close"
                aria-label="Close completed task history"
                onClick={() => setShowTaskHistory(false)}
              >
                ×
              </button>
            </header>
            <div className="task-history-list">
              {completedTaskHistory.length === 0 ? (
                <p className="empty-copy">Your completed waddles will appear here.</p>
              ) : (
                completedTaskHistory.map((record, index) => (
                  <div className="task-history-entry" key={record.id}>
                    {(index === 0 ||
                      completedTaskHistory[index - 1].date !== record.date) && (
                      <h2>
                        {new Date(`${record.date}T12:00:00`).toLocaleDateString(
                          undefined,
                          {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          },
                        )}
                      </h2>
                    )}
                    <article>
                      <span>✓</span>
                      <div>
                        <strong>{record.title}</strong>
                        {record.notes && <p>{record.notes}</p>}
                        <small>
                          {formatDuration(
                            Math.max(
                              1,
                              Math.round(record.elapsedSeconds / 60),
                            ),
                          )}{' '}
                          worked · {formatDuration(record.durationMinutes)} planned
                          {record.isBackground ? ' · Background' : ''}
                          {record.isStretchGoal ? ' · Stretch goal' : ''}
                        </small>
                      </div>
                    </article>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {state.screen === 'welcome' && (
        <main className="welcome-screen">
          <div className="welcome-goose">
            <img src={appIconUrl} alt="Just a Corporate Goose app icon" />
          </div>
          <p className="eyebrow">JUST A CORPORATE GOOSE</p>
          <h1>Your day can begin whenever you do.</h1>
          <p className="welcome-copy">
            A gentle plan, cheerful reminders, and one focused step at a time.
          </p>
          <button className="primary-button giant" onClick={startDay}>
            Start my day
          </button>
        </main>
      )}

      {state.screen === 'day-complete' && (
        <main className="welcome-screen day-complete-screen">
          <button
            className="day-complete-goose"
            onClick={() => setShowTaskHistory(true)}
            title="View completed task history"
          >
            <img src={celebratingGooseUrl} alt="Celebrating corporate goose" />
          </button>
          <p className="eyebrow">TODAY’S WADDLE IS COMPLETE</p>
          <h1>You did enough for today.</h1>
          <p className="welcome-copy">
            Your unfinished tasks and their progress are safe. They will be waiting in
            tomorrow’s setup.
          </p>
          <strong className="day-complete-score">
            +{state.dayCompletionPoints || 0} completion points
          </strong>
          <button className="primary-button giant" onClick={startNewDayManually}>
            Start a new day
          </button>
          <small>
            Otherwise, your fresh day starts automatically at 7:00 AM Eastern.
          </small>
        </main>
      )}

      {state.screen === 'morning' && (
        <main className="page">
          <header className="page-header">
            <div>
              <p className="eyebrow">MORNING NEST</p>
              <h1>{greeting}</h1>
              <p className="quote">“{quote}”</p>
            </div>
            <div className="morning-timer">
              <span>Get your day in order</span>
              <strong>{formatCountdown(morningRemaining)}</strong>
              <small>{MORNING_MINUTES}-minute morning block</small>
            </div>
          </header>

          <section className="catch-up-card">
            <div>
              <span className="connector-pill">Local-first preview</span>
              <h2>What you may have missed</h2>
              <p>
                Live connectors are not enabled yet. This space is prepared for important email,
                Teams mentions, PR activity, ADO items due soon, S360 actions, and unfinished work
                from yesterday.
              </p>
            </div>
            <div className="catch-up-icons" aria-hidden="true">
              💌 💬 🔎 🛡️
            </div>
          </section>

          <section className="morning-grid">
            {morningActivities.map((activity) => {
              const checked = state.morningChecks[activity.id]
              return (
                <button
                  className={`morning-card ${checked ? 'checked' : ''}`}
                  key={activity.id}
                  onClick={() => toggleMorning(activity.id)}
                >
                  <span className="morning-icon">{activity.icon}</span>
                  <span className="morning-card-copy">
                    <strong>{activity.title}</strong>
                    <small>{activity.description}</small>
                  </span>
                  <span className="check-bubble">{checked ? '✓' : ''}</span>
                </button>
              )
            })}
          </section>

          <div className="action-row">
            <span>
              {allMorningComplete
                ? 'Beautiful. Your nest is tidy.'
                : 'Check each item as you finish it.'}
            </span>
            <button
              className="primary-button"
              disabled={!allMorningComplete}
              onClick={completeMorningSetup}
            >
              OK, set up my day
            </button>
          </div>
        </main>
      )}

      {state.screen === 'planning' && (
        <main className="page">
          <header className="page-header compact">
            <div>
              <p className="eyebrow">BUILD YOUR FLIGHT PLAN</p>
              <h1>What deserves your time today?</h1>
              <p className="quote">
                Start with the fixed PR review block, then shape the rest of the day around what
                matters most.
              </p>
            </div>
            <div className="plan-total">
              <span>Planned focus time</span>
              <strong>{formatDuration(totalPlannedMinutes)}</strong>
            </div>
          </header>

          <section className="panel schedule-panel">
            <div className="panel-title">
              <div>
                <span className="connector-pill">Today’s real calendar</span>
                <h2>Protect meetings, lunch, and focus time</h2>
              </div>
              <button className="small-action" onClick={refreshMeetings}>
                Refresh Outlook
              </button>
            </div>

            <div className="capacity-grid">
              <div>
                <span>
                  Workday
                  {effectiveWorkdayMinutes > state.workdayMinutes ? ' with pause time' : ''}
                </span>
                <strong>{formatDuration(effectiveWorkdayMinutes)}</strong>
              </div>
              <div>
                <span>Morning + PR + lunch</span>
                <strong>
                  {formatDuration(
                    MORNING_MINUTES + PR_REVIEW_MINUTES + state.lunchDurationMinutes,
                  )}
                </strong>
              </div>
              <div>
                <span>Selected meetings</span>
                <strong>{formatDuration(selectedMeetingMinutes)}</strong>
              </div>
              <div className={totalPlannedMinutes > availableWorkMinutes ? 'capacity-warning' : ''}>
                <span>Available for checklist work</span>
                <strong>{formatDuration(availableWorkMinutes)}</strong>
              </div>
            </div>

            <div className="calendar-planning-grid">
              <div>
                <div className="subheading-row">
                  <h3>Which meetings will you attend?</h3>
                  <span>Accepted, tentative, and proposed</span>
                </div>
                {!state.meetingsLoaded && <p className="empty-copy">Reading today’s Outlook calendar…</p>}
                {state.calendarError && <p className="inline-error">{state.calendarError}</p>}
                {state.meetingsLoaded && state.meetings.length === 0 && (
                  <p className="empty-copy">No non-declined meetings are on today’s calendar.</p>
                )}
                <div className="meeting-list">
                  {state.meetings.map((meeting) => (
                    <div className={meeting.selected ? 'meeting selected' : 'meeting'} key={meeting.id}>
                      <label className="meeting-attendance">
                        <input
                          type="checkbox"
                          checked={meeting.selected}
                          onChange={() => toggleMeeting(meeting.id)}
                        />
                        <img
                          className="meeting-pose"
                          src={meetingPoseUrl(meeting.movementMode)}
                          alt=""
                        />
                        <span className="meeting-copy">
                          <strong>{meeting.title}</strong>
                          <small>
                            {formatClock(meeting.start)}–{formatClock(meeting.end)} ·{' '}
                            {formatDuration(meetingMinutes(meeting))} · {meeting.responseStatus}
                          </small>
                        </span>
                      </label>
                      <div className="meeting-movement-options">
                        <label className="movement-toggle walk">
                          <input
                            type="checkbox"
                            checked={meeting.movementMode === 'walk'}
                            disabled={!meeting.selected}
                            onChange={() => setMeetingMovement(meeting.id, 'walk')}
                          />
                          <span>Walk during this meeting</span>
                        </label>
                        <label className="movement-toggle stand">
                          <input
                            type="checkbox"
                            checked={meeting.movementMode === 'stand'}
                            disabled={!meeting.selected}
                            onChange={() => setMeetingMovement(meeting.id, 'stand')}
                          />
                          <span>Stand during this meeting</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="routine-stack">
                <div className="workday-card">
                  <span className="workday-icon">🕒</span>
                  <h3>How long are you working today?</h3>
                  <p>Capacity is based on this total, starting when you began your day.</p>
                  <select
                    value={state.workdayMinutes}
                    onChange={(event) =>
                      updateState((current) => ({
                        ...current,
                        workdayMinutes: Number(event.target.value),
                      }))
                    }
                  >
                    {workdayHourOptions.map((hours) => (
                      <option key={hours} value={hours * 60}>
                        {hours % 1 === 0 ? hours.toFixed(0) : hours} hours
                      </option>
                    ))}
                  </select>
                </div>

                <div className="water-card">
                  <span className="water-icon">💧</span>
                  <h3>What is your water goal?</h3>
                  <p>Reminders are spread evenly throughout your selected workday.</p>
                  <div className="water-goal-input">
                    <RequiredNumberInput
                      fieldId="water-goal"
                      min={0}
                      max={256}
                      step={8}
                      value={state.waterGoalOunces}
                      onValidityChange={setNumberFieldValidity}
                      onCommit={(value) =>
                        updateState((current) => ({
                          ...current,
                          waterGoalOunces: value,
                        }))
                      }
                    />
                    <span>oz</span>
                  </div>
                  <label className="water-reminder-count">
                    <span>How many reminders today?</span>
                    <RequiredNumberInput
                      fieldId="water-reminders"
                      min={1}
                      max={24}
                      step={1}
                      value={state.waterReminderCount}
                      onValidityChange={setNumberFieldValidity}
                      onCommit={(value) =>
                        updateState((current) => ({
                          ...current,
                          waterReminderCount: Math.round(value),
                        }))
                      }
                    />
                  </label>
                  <strong>
                    {state.waterGoalOunces > 0
                      ? `${state.waterReminderCount} reminders today`
                      : 'Water reminders are off'}
                  </strong>
                </div>

                <div className="lunch-card">
                  <span className="lunch-icon">🥪</span>
                  <h3>What time do you want lunch today?</h3>
                  <p>Choose no lunch, a half hour, or one hour.</p>
                  <select
                    value={lunchDraftDuration}
                    onChange={(event) => {
                      const duration = Number(event.target.value)
                      if (duration === 0 || duration === 30 || duration === 60) {
                        setLunchDraftDuration(duration)
                      }
                    }}
                  >
                    <option value={0}>No lunch</option>
                    <option value={30}>30-minute lunch</option>
                    <option value={60}>1-hour lunch</option>
                  </select>
                  {lunchDraftDuration > 0 ? (
                    <>
                      <select
                        value={lunchDraftStart}
                        onChange={(event) => setLunchDraftStart(event.target.value)}
                      >
                        {lunchTimeOptions.map((time) => (
                          <option key={time} value={time}>
                            {formatClock(timeOnDate(state.date, time))}
                          </option>
                        ))}
                      </select>
                      <strong>
                        {formatClock(timeOnDate(state.date, lunchDraftStart))}–
                        {formatClock(
                          timeOnDate(state.date, lunchDraftStart) +
                            lunchDraftDuration * 60 * 1000,
                        )}
                      </strong>
                    </>
                  ) : (
                    <strong>No lunch reserved</strong>
                  )}
                  <button className="save-lunch-button" onClick={saveLunchChanges}>
                    Save lunch changes
                  </button>
                </div>

                <div className="pr-time-card">
                  <span className="pr-time-icon">🔎</span>
                  <h3>When do you want to review PRs?</h3>
                  <p>
                    Just a Corporate Goose reserves one hour and brings the app forward at that
                    time.
                  </p>
                  <input
                    type="time"
                    value={state.prReviewStart}
                    onChange={(event) =>
                      updateState((current) => ({
                        ...current,
                        prReviewStart: event.target.value,
                      }))
                    }
                  />
                  <strong>
                    {formatClock(prReviewStartTimestamp)}–{formatClock(prReviewEndTimestamp)}
                  </strong>
                </div>
              </div>
            </div>

            <div className="capacity-footer">
              <span>
                You planned <strong>{formatDuration(totalPlannedMinutes)}</strong> of checklist work.
              </span>
              {totalPlannedMinutes > availableWorkMinutes ? (
                <span className="inline-error">
                  That is {formatDuration(totalPlannedMinutes - availableWorkMinutes)} over today’s
                  available capacity.
                </span>
              ) : (
                <span className="capacity-ok">
                  You still have {formatDuration(availableWorkMinutes - totalPlannedMinutes)} of
                  unallocated focus time.
                </span>
              )}
            </div>
          </section>

          <div className="planning-layout">
            <section className="panel task-panel">
              <div className="panel-title">
                <div>
                  <span className="connector-pill">Editable suggestions</span>
                  <h2>Today’s tasks</h2>
                </div>
                <span>{state.tasks.length} items</span>
              </div>

              <div className="edit-task-adder">
                <div className="edit-task-adder-copy">
                  <strong>Add a task to today</strong>
                  <small>
                    Add anything that came up after you started. It goes to the end until you
                    reorder it.
                  </small>
                </div>
                <div className="add-task">
                  <input
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        addTask()
                      }
                    }}
                    placeholder="What else needs to get done today?"
                  />
                  <button onClick={addTask}>Add to today</button>
                </div>
              </div>

              <div className="task-editor-list">
                {state.tasks.map((task, index) => (
                  <article
                    className={`task-editor ${
                      draggedTaskId === task.id ? 'dragging' : ''
                    } ${dragOverTaskId === task.id ? 'drag-over' : ''}`}
                    key={task.id}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDragOverTaskId(task.id)
                    }}
                    onDragLeave={() => setDragOverTaskId(undefined)}
                    onDrop={(event) => dropTask(event, index)}
                  >
                    <div className="task-order-controls">
                      <span className="task-order">{index + 1}</span>
                      <div className="task-reorder-buttons">
                        <button
                          className="reorder-button"
                          disabled={index === 0}
                          aria-label={`Move ${task.title} earlier`}
                          onClick={() => moveTask(task.id, -1)}
                        >
                          &uarr;
                        </button>
                        <button
                          className="reorder-button"
                          disabled={index === state.tasks.length - 1}
                          aria-label={`Move ${task.title} later`}
                          onClick={() => moveTask(task.id, 1)}
                        >
                          &darr;
                        </button>
                      </div>
                      <span
                        className="task-drag-handle"
                        draggable
                        role="button"
                        tabIndex={0}
                        title={`Drag ${task.title} to a new position`}
                        onDragStart={(event) => startTaskDrag(event, task.id)}
                        onDragEnd={() => {
                          setDraggedTaskId(undefined)
                          setDragOverTaskId(undefined)
                        }}
                      >
                        ⠿ Drag
                      </span>
                    </div>
                    <div className="task-editor-main">
                      <input
                        className="task-title-input"
                        value={task.title}
                        onChange={(event) => updateTask(task.id, { title: event.target.value })}
                      />
                      <textarea
                        value={task.notes}
                        onChange={(event) => updateTask(task.id, { notes: event.target.value })}
                        placeholder="Notes, expected outcome, or useful links"
                      />
                      <span className={`source-tag ${task.source}`}>{task.source}</span>
                      <button
                        className="small-action task-steps-toggle"
                        onClick={() => breakDownTask(task.id)}
                      >
                        {expandedStepTaskIds.includes(task.id)
                          ? 'Close steps'
                          : task.subtasks.length > 0
                            ? 'Edit steps'
                            : 'Add steps'}
                      </button>
                      {renderTaskSteps(task)}
                    </div>
                    <div className="task-scheduling">
                      {task.kind !== 'pr-review' && (
                        <div className="task-flags">
                          <label className="task-flag-toggle">
                            <input
                              type="checkbox"
                              checked={task.isBackground}
                              onChange={(event) =>
                                updateTask(task.id, { isBackground: event.target.checked })
                              }
                            />
                            <span>Background task</span>
                          </label>
                          <label className="task-flag-toggle stretch">
                            <input
                              type="checkbox"
                              checked={task.isStretchGoal}
                              onChange={(event) =>
                                updateTask(task.id, { isStretchGoal: event.target.checked })
                              }
                            />
                            <span>Stretch goal</span>
                          </label>
                        </div>
                      )}
                      {task.isBackground ? (
                        <label className="duration-field">
                          <span>Remind every</span>
                          <div className="number-with-unit">
                            <RequiredNumberInput
                              fieldId={`task-${task.id}-background-reminder`}
                              min={5}
                              step={5}
                              value={task.backgroundReminderMinutes}
                              onValidityChange={setNumberFieldValidity}
                              onCommit={(value) =>
                                updateTask(task.id, {
                                  backgroundReminderMinutes: value,
                                })
                              }
                            />
                            <small>min</small>
                          </div>
                        </label>
                      ) : (
                        <label className="duration-field">
                          <span>Minutes</span>
                          <RequiredNumberInput
                            fieldId={`task-${task.id}-duration`}
                            min={5}
                            step={5}
                            value={task.durationMinutes}
                            onValidityChange={setNumberFieldValidity}
                            onCommit={(value) =>
                              updateTask(task.id, {
                                durationMinutes: value,
                              })
                            }
                          />
                        </label>
                      )}
                    </div>
                    <button
                      className="icon-button danger"
                      aria-label={`Remove ${task.title}`}
                      onClick={() => removeTask(task.id)}
                    >
                      ×
                    </button>
                  </article>
                ))}
              </div>
            </section>

            <aside className="side-stack">
              <section className="panel connector-panel">
                <span className="connector-pill">Coming next</span>
                <h2>Smart suggestions</h2>
                <ul>
                  <li>ADO work weighted by due date and remaining effort</li>
                  <li>Unread email and Teams messages that imply action</li>
                  <li>PRs waiting for your review or response</li>
                  <li>S360 action items and deliverable hygiene reminders</li>
                </ul>
              </section>

              <section className="panel future-panel">
                <h2>Not today, but don’t forget</h2>
                <div className="future-add">
                  <input
                    value={newFutureTitle}
                    onChange={(event) => setNewFutureTitle(event.target.value)}
                    placeholder="Task for later"
                  />
                  <input
                    type="date"
                    min={localDateKey()}
                    value={newFutureDate}
                    onChange={(event) => setNewFutureDate(event.target.value)}
                  />
                  <button onClick={addFutureTask}>Save for later</button>
                </div>
                <div className="future-list">
                  {state.futureTasks.map((task) => (
                    <div key={task.id}>
                      <strong>{task.title}</strong>
                      <span>{task.targetDate}</span>
                    </div>
                  ))}
                </div>
              </section>

              <label className="awareness-toggle">
                <input
                  type="checkbox"
                  checked={state.activityAwareness}
                  onChange={(event) =>
                    updateState((current) => ({
                      ...current,
                      activityAwareness: event.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>Enable focus-goose awareness</strong>
                  <small>Checks only the active app name/title. No screenshots or keystrokes.</small>
                </span>
              </label>
            </aside>
          </div>

          <div className="action-row">
            <button
              className="secondary-button"
              onClick={() => updateState((current) => ({ ...current, screen: 'morning' }))}
            >
              Back
            </button>
            {invalidNumberFields.size > 0 && (
              <span className="required-number-message">
                Fill in every highlighted number before starting.
              </span>
            )}
            <button
              className="primary-button"
              disabled={state.tasks.length === 0 || invalidNumberFields.size > 0}
              onClick={beginFocus}
            >
              Ready to jump in
            </button>
          </div>
        </main>
      )}

      {state.screen === 'focus' && activeTask && (
        <main className="page focus-page">
          <div className="app-brand-title">
            <span aria-hidden="true">✦</span>
            <strong>Just a Corporate Goose</strong>
            <span aria-hidden="true">♛</span>
          </div>
          <header className="focus-header">
            <div>
              <button className="complete-day-button" onClick={completeDay}>
                ✓ Complete my day
              </button>
              <p className="eyebrow">TODAY’S WADDLE</p>
              <h1>{headlineQuote}</h1>
              {state.workdayExtensionSeconds + ongoingManualPauseSeconds > 0 && (
                <p className="schedule-extension">
                  Pause time accommodated: your workday moved by{' '}
                  {formatDuration(
                    Math.max(
                      1,
                      Math.ceil(
                        (state.workdayExtensionSeconds + ongoingManualPauseSeconds) / 60,
                      ),
                    ),
                  )}
                  .
                </p>
              )}
            </div>
            <div className="focus-header-actions">
              <JumpingGoose onClick={() => setShowTaskHistory(true)} />
              <button
                className="secondary-button"
                onClick={editToday}
              >
                Edit today
              </button>
            </div>
          </header>

          {(activeMeeting || state.pauseReason === 'meeting-ended') && (
            <section className="meeting-quiet-banner">
              <img
                className="meeting-quiet-goose"
                src={
                  activeMeeting
                    ? meetingPoseUrl(activeMeeting.movementMode)
                    : thumbsUpGooseUrl
                }
                alt=""
              />
              <div>
                <strong>
                  {activeMeeting ? 'Meeting privacy mode is on' : 'Ready when your meeting is over'}
                </strong>
                <p>
                  {activeMeeting
                    ? `The mini timer and all reminders are hidden for “${activeMeeting.title}”.`
                    : 'Just a Corporate Goose will not restart anything until you confirm that you are out.'}
                </p>
              </div>
              <button className="primary-button" onClick={exitMeetingAndStartNextTask}>
                I’m out — ready my next task
              </button>
            </section>
          )}

          <section
            className={`now-card ${activeInterruption ? 'interrupted' : ''} ${
              isTaskReady ? 'ready' : ''
            }`}
          >
            <div className="now-copy">
              <span>
                {activeInterruption
                  ? 'Scheduled time right now'
                  : isTaskReady
                    ? 'Ready to get started on'
                    : 'Right now you’re working on'}
              </span>
              <h2>{displayedTaskTitle}</h2>
              <p>
                {activeInterruption
                  ? isLunch
                  ? 'Your work timer is safely paused. Lunch stays active until you complete it.'
                  : 'Your work timer is safely paused for this scheduled block.'
                  : isTaskReady
                  ? 'The timer will not begin until you press Start.'
                  : activeTask.notes ||
                  'One focused block. You can adjust the plan whenever life happens.'}
              </p>
              {isLunch && (
                <button
                  className="primary-button"
                  onClick={() =>
                  updateState((current) => completeLunchState(current, Date.now()))
                  }
                >
                  Complete lunch
                </button>
              )}
            </div>
            <div className="focus-clock">
              <strong>{formatCountdown(displayedRemainingSeconds)}</strong>
              <span>
                {activeInterruption
                  ? `remaining of ${formatCountdown(displayedTotalSeconds)} total`
                  : isTaskReady
                    ? 'focus time ready'
                    : 'remaining'}
              </span>
              <div className="clock-track">
                <span
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(
                        100,
                        100 -
                          (displayedRemainingSeconds / Math.max(displayedTotalSeconds, 1)) * 100,
                      ),
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div className="focus-controls">
              {activeInterruption ? (
                <span className="auto-pause-label">⏸ Automatically paused for your schedule</span>
              ) : isTaskReady ? (
                <>
                  <button
                    onClick={() =>
                      remainingSeconds === 0
                        ? window.dailyGoose?.requestPreviousTaskTime()
                        : toggleManualPause()
                    }
                  >
                    {remainingSeconds === 0 ? 'Add 15 minutes' : 'Start'}
                  </button>
                  {remainingSeconds > 0 && (
                    <button onClick={() => addTimeToTask(activeTask.id)}>
                      +15 minutes
                    </button>
                  )}
                  {previousTask && previousTask.id !== activeTask.id && (
                    <button onClick={() => window.dailyGoose?.requestPreviousTaskTime()}>
                      Need more time on {previousTask.title}? +15m
                    </button>
                  )}
                  <button onClick={() => completeTask(activeTask.id)}>Mark complete</button>
                  <button onClick={() => breakDownTask(activeTask.id)}>
                    {expandedStepTaskIds.includes(activeTask.id)
                      ? 'Close steps'
                      : activeTask.subtasks.length > 0
                        ? 'Edit steps'
                        : 'Add steps'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={toggleManualPause}
                  >
                    {state.isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button onClick={() => addTimeToTask(activeTask.id)}>
                    +15 minutes
                  </button>
                  <button onClick={() => completeTask(activeTask.id)}>Mark complete</button>
                  <button onClick={() => breakDownTask(activeTask.id)}>Break it down</button>
                </>
              )}
            </div>
          </section>

          <section className="day-wellness-widgets" aria-label="Daily wellness progress">
            <article className={`lunch-status-widget ${state.lunchCompleted ? 'complete' : ''}`}>
              <img
                src={state.lunchCompleted ? lunchFullGooseUrl : lunchHungryGooseUrl}
                alt=""
              />
              <div>
                <span className="wellness-kicker">Lunch check</span>
                <h2>
                  {state.lunchCompleted
                    ? 'Lunch accomplished'
                    : state.lunchInProgress
                      ? 'Lunch is happening'
                      : 'This goose has not eaten yet'}
                </h2>
                <p>
                  {state.lunchCompleted
                    ? 'Full goose status unlocked for today.'
                    : state.lunchInProgress
                      ? 'Finish your break, then mark lunch complete.'
                      : `Lunch is planned for ${formatClock(
                          timeOnDate(state.date, state.lunchStart),
                        )}.`}
                </p>
              </div>
            </article>

            <article className="water-progress-widget">
              <div className="water-cups" aria-label={`${waterCupCount} water cups`}>
                {Array.from({ length: waterCupCount }, (_, index) => {
                  const ouncesInCup = Math.max(
                    0,
                    Math.min(
                      WATER_CUP_OUNCES,
                      state.waterConsumedOunces - index * WATER_CUP_OUNCES,
                    ),
                  )
                  const containsBonusWater =
                    waterAboveGoalOunces > 0 &&
                    (index + 1) * WATER_CUP_OUNCES > state.waterGoalOunces
                  return (
                    <div
                      className={`water-cup ${containsBonusWater ? 'bonus-water' : ''}`}
                      key={index}
                    >
                      <div
                        className="water-cup-fill"
                        style={{
                          height: `${(ouncesInCup / WATER_CUP_OUNCES) * 100}%`,
                        }}
                      />
                      <span>💧</span>
                      <small>
                        {Math.round(ouncesInCup * 10) / 10}/{WATER_CUP_OUNCES}
                      </small>
                    </div>
                  )
                })}
              </div>
              <div className="water-widget-copy">
                <span className="wellness-kicker">Water cups · 32 oz each</span>
                <h2>
                  {state.waterConsumedOunces} / {state.waterGoalOunces || 0} oz
                </h2>
                <p>
                  {state.waterGoalOunces > 0
                    ? waterAboveGoalOunces > 0
                      ? `${waterAboveGoalOunces} bonus oz · earning 2 points per ounce`
                      : `${Math.max(
                          0,
                          Math.round(
                            (state.waterGoalOunces - state.waterConsumedOunces) * 10,
                          ) / 10,
                        )} oz to go · ${state.waterReminderCount} reminders`
                    : 'Set a water goal in Edit today to turn reminders on.'}
                </p>
                <div className="water-manual-controls">
                  <label>
                    <span>Current ounces</span>
                    <RequiredNumberInput
                      fieldId="water-consumed"
                      min={0}
                      max={512}
                      step={1}
                      value={state.waterConsumedOunces}
                      onValidityChange={setNumberFieldValidity}
                      onCommit={logWater}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={state.waterGoalOunces <= 0}
                    onClick={() => {
                      const servings = Math.max(
                        1,
                        state.waterReminderCount,
                      )
                      const servingOunces = state.waterGoalOunces / servings
                      logWater(state.waterConsumedOunces + servingOunces)
                    }}
                  >
                    + Log one drink
                  </button>
                </div>
              </div>
            </article>
          </section>

          <div className="focus-layout">
            <section className="panel">
              {isPrReviewTask && (
                <div className="pr-review-view">
                  <div className="panel-title">
                    <div>
                      <span className="connector-pill">Live Azure DevOps</span>
                      <h2>PRs eligible for your review</h2>
                    </div>
                    <button className="small-action" onClick={refreshPullRequests}>
                      Refresh
                    </button>
                  </div>
                  <p className="pr-filter-note">
                    Active Purchase PRs · not yours · not draft · author approval recorded
                  </p>
                  {pullRequestsLoading && <p className="empty-copy">Loading eligible team PRs…</p>}
                  {pullRequestsError && <p className="inline-error">{pullRequestsError}</p>}
                  {!pullRequestsLoading && !pullRequestsError && pullRequests.length === 0 && (
                    <p className="empty-copy">No active PRs currently meet all review criteria.</p>
                  )}
                  <div className="pr-list">
                    {pullRequests.map((pullRequest) => (
                      <button
                        key={pullRequest.id}
                        onClick={() => window.dailyGoose?.openExternal(pullRequest.url)}
                      >
                        <span className="pr-number">PR {pullRequest.id}</span>
                        <strong>{pullRequest.title}</strong>
                        <small>
                          {pullRequest.author}
                          {pullRequest.createdDate
                            ? ` · opened ${new Date(pullRequest.createdDate).toLocaleDateString()}`
                            : ''}
                        </small>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="panel-title">
                <h2>Today’s checklist</h2>
                <span>
                  {state.tasks.filter((task) => task.status === 'done').length}/{state.tasks.length} done
                </span>
              </div>
              <div className="focus-task-list">
                {selectedMeetings
                  .filter((meeting) => now < new Date(meeting.end).getTime())
                  .map(renderChecklistMeeting)}
                {state.tasks.map((task, index) => (
                  <article
                    className={`focus-task ${task.status === 'done' ? 'done' : ''} ${
                      index === state.activeTaskIndex ? 'active' : ''
                    } ${draggedTaskId === task.id ? 'dragging' : ''} ${
                      dragOverTaskId === task.id ? 'drag-over' : ''
                    }`}
                    key={task.id}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDragOverTaskId(task.id)
                    }}
                    onDragLeave={() => setDragOverTaskId(undefined)}
                    onDrop={(event) => dropTask(event, index)}
                  >
                    <button
                      className="task-check"
                      onClick={() =>
                        task.status === 'done'
                          ? updateTask(task.id, { status: 'todo' })
                          : completeTask(task.id)
                      }
                    >
                      {task.status === 'done' ? '✓' : ''}
                    </button>
                    {task.status !== 'done' && (
                      <button
                        className="task-dismiss-button"
                        title={`Remove ${task.title} from today's list`}
                        aria-label={`Remove ${task.title} from today's list for 10 points`}
                        onClick={() => removeTaskFromFocus(task.id)}
                      >
                        🗑 Remove
                      </button>
                    )}
                    <img
                      className="task-pose"
                      src={taskGooseUrl(task.title, task.isBackground)}
                      alt=""
                    />
                    <div className="focus-task-copy">
                      <button
                        className={`task-name ${task.isBackground ? 'background' : ''}`}
                        disabled={task.isBackground}
                        onClick={() => selectActiveTask(index)}
                      >
                        {task.title}
                      </button>
                      {task.isBackground ? (
                        <span className="background-task-badge">
                          Background · remind every {task.backgroundReminderMinutes} min
                        </span>
                      ) : (
                        <span className="task-time-progress">
                          {formatCountdown(
                            Math.min(
                              task.durationMinutes * 60,
                              task.elapsedSeconds +
                                (index === state.activeTaskIndex
                                  ? currentSessionElapsedSeconds
                                  : 0),
                            ),
                          )}{' '}
                          worked ·{' '}
                          {formatCountdown(
                            Math.max(
                              0,
                              task.durationMinutes * 60 -
                                task.elapsedSeconds -
                                (index === state.activeTaskIndex
                                  ? currentSessionElapsedSeconds
                                  : 0),
                            ),
                          )}{' '}
                          remaining
                        </span>
                      )}
                      {task.isStretchGoal && (
                        <span className="stretch-goal-badge">Stretch goal</span>
                      )}
                      {renderTaskSteps(task)}
                    </div>
                    {task.status === 'done' ? (
                      <span className="meeting-calendar-badge task-completed-badge">
                        Completed
                      </span>
                    ) : (
                      <div className="focus-task-actions">
                        <span
                          className="task-drag-handle"
                          draggable
                          role="button"
                          tabIndex={0}
                          title={`Drag ${task.title} to a new position`}
                          onDragStart={(event) => startTaskDrag(event, task.id)}
                          onDragEnd={() => {
                            setDraggedTaskId(undefined)
                            setDragOverTaskId(undefined)
                          }}
                        >
                          ⠿ Drag
                        </span>
                        <div className="task-reorder-buttons">
                          <button
                            className="reorder-button"
                            disabled={index === 0}
                            aria-label={`Move ${task.title} earlier`}
                            onClick={() => moveTask(task.id, -1)}
                          >
                            &uarr;
                          </button>
                          <button
                            className="reorder-button"
                            disabled={index === state.tasks.length - 1}
                            aria-label={`Move ${task.title} later`}
                            onClick={() => moveTask(task.id, 1)}
                          >
                            &darr;
                          </button>
                        </div>
                        {!task.isBackground && index !== state.activeTaskIndex && (
                            <button
                              className="work-now-button"
                              onClick={() => selectActiveTask(index)}
                            >
                              Work on this
                            </button>
                          )}
                        {index === state.activeTaskIndex && (
                            <span className="active-task-badge">Currently working on</span>
                        )}
                        <button className="small-action" onClick={() => breakDownTask(task.id)}>
                          {expandedStepTaskIds.includes(task.id)
                            ? 'Close steps'
                            : task.subtasks.length > 0
                              ? 'Edit steps'
                              : 'Add steps'}
                        </button>
                      </div>
                    )}
                  </article>
                ))}
                {selectedMeetings
                  .filter((meeting) => now >= new Date(meeting.end).getTime())
                  .map(renderChecklistMeeting)}
              </div>
            </section>

            <aside className="side-stack">
              <section className="panel goose-coach">
                <div className="coach-goose">🪿</div>
                <h2>Focus goose says</h2>
                <p>{focusGooseQuote}</p>
              </section>

              <section className="panel ad-hoc-task-panel">
                <span className="connector-pill">New priority?</span>
                <h2>Add a task</h2>
                <p>
                  Add it to today or save it for a different day so it is waiting for you.
                </p>
                <div className="ad-hoc-task-when">
                  <button
                    className={newAdHocTaskWhen === 'today' ? 'selected' : ''}
                    onClick={() => setNewAdHocTaskWhen('today')}
                  >
                    Today
                  </button>
                  <button
                    className={newAdHocTaskWhen === 'future' ? 'selected' : ''}
                    onClick={() => setNewAdHocTaskWhen('future')}
                  >
                    Different day
                  </button>
                </div>
                {newAdHocTaskWhen === 'future' && (
                  <label className="ad-hoc-task-date">
                    <span>Scheduled for</span>
                    <input
                      type="date"
                      min={futureDateKey(1)}
                      value={newAdHocTaskDate}
                      onChange={(event) => setNewAdHocTaskDate(event.target.value)}
                    />
                  </label>
                )}
                <input
                  value={newAdHocTaskTitle}
                  onChange={(event) => setNewAdHocTaskTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      addAdHocTask()
                    }
                  }}
                  placeholder="Task name"
                />
                <textarea
                  value={newAdHocTaskNotes}
                  onChange={(event) => setNewAdHocTaskNotes(event.target.value)}
                  placeholder="Notes, expected outcome, or useful links"
                />
                <div className="ad-hoc-task-flags">
                  <label className="task-flag-toggle">
                    <input
                      type="checkbox"
                      checked={newAdHocTaskIsBackground}
                      onChange={(event) =>
                        setNewAdHocTaskIsBackground(event.target.checked)
                      }
                    />
                    <span>Background task</span>
                  </label>
                  <label className="task-flag-toggle stretch">
                    <input
                      type="checkbox"
                      checked={newAdHocTaskIsStretchGoal}
                      onChange={(event) =>
                        setNewAdHocTaskIsStretchGoal(event.target.checked)
                      }
                    />
                    <span>Stretch goal</span>
                  </label>
                </div>
                <label className="ad-hoc-task-duration">
                  <span>
                    {newAdHocTaskIsBackground ? 'Remind every' : 'Minutes'}
                  </span>
                  <RequiredNumberInput
                    fieldId="ad-hoc-task-duration"
                    min={5}
                    step={5}
                    value={
                      newAdHocTaskIsBackground
                        ? newAdHocTaskReminderMinutes
                        : newAdHocTaskDuration
                    }
                    onValidityChange={setNumberFieldValidity}
                    onCommit={(value) =>
                      newAdHocTaskIsBackground
                        ? setNewAdHocTaskReminderMinutes(value)
                        : setNewAdHocTaskDuration(value)
                    }
                  />
                </label>
                <button
                  className="primary-button"
                  disabled={
                    !newAdHocTaskTitle.trim() ||
                    invalidNumberFields.has('ad-hoc-task-duration')
                  }
                  onClick={addAdHocTask}
                >
                  {newAdHocTaskWhen === 'today'
                    ? 'Add to today'
                    : 'Save for that day'}
                </button>
              </section>

              <section className="panel ad-hoc-meeting-panel">
                <span className="connector-pill">Schedule changed?</span>
                <h2>Add an ad hoc meeting</h2>
                <p>It will pause your timer and silence other reminders during the meeting.</p>
                <input
                  value={newAdHocMeetingTitle}
                  onChange={(event) => setNewAdHocMeetingTitle(event.target.value)}
                  placeholder="Meeting name"
                />
                <div className="ad-hoc-meeting-row">
                  <label>
                    <span>Starts</span>
                    <input
                      type="time"
                      value={newAdHocMeetingStart}
                      onChange={(event) => setNewAdHocMeetingStart(event.target.value)}
                    />
                  </label>
                  <label>
                    <span>Minutes</span>
                    <RequiredNumberInput
                      fieldId="ad-hoc-meeting-duration"
                      min={5}
                      step={5}
                      value={newAdHocMeetingDuration}
                      onValidityChange={setNumberFieldValidity}
                      onCommit={setNewAdHocMeetingDuration}
                    />
                  </label>
                </div>
                <label className="ad-hoc-movement">
                  <span>Movement plan</span>
                  <select
                    value={newAdHocMovementMode}
                    onChange={(event) =>
                      setNewAdHocMovementMode(
                        event.target.value as 'none' | 'walk' | 'stand',
                      )
                    }
                  >
                    <option value="none">Seated meeting</option>
                    <option value="walk">Walking meeting</option>
                    <option value="stand">Standing meeting</option>
                  </select>
                </label>
                <button
                  className="primary-button"
                  disabled={
                    !newAdHocMeetingTitle.trim() ||
                    invalidNumberFields.has('ad-hoc-meeting-duration')
                  }
                  onClick={addAdHocMeeting}
                >
                  Add to today
                </button>
              </section>

              <section className="panel future-panel">
                <h2>Later this week</h2>
                {state.futureTasks.length === 0 ? (
                  <p className="empty-copy">Nothing waiting in the wings.</p>
                ) : (
                  <div className="future-list">
                    {state.futureTasks.map((task) => (
                      <div key={task.id}>
                        <strong>{task.title}</strong>
                        <span>{task.targetDate}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </main>
      )}

      {state.endOfDayCelebrated && !state.endOfDayDismissed && (
        <div className="end-of-day-overlay" role="dialog" aria-modal="true">
          <section className="end-of-day-card">
            <img src={celebratingGooseUrl} alt="Celebrating corporate goose" />
            <p className="eyebrow">YOU DID IT!</p>
            <h1>
              {state.dayCompletedAt
                ? 'Your day is officially complete!'
                : 'This should be the end of your workday.'}
            </h1>
            <p>
              {state.dayCompletedAt
                ? `You earned ${state.dayCompletionPoints || 0} completion points. Your unfinished work and its progress are saved for tomorrow.`
                : 'Work-life balance is a good thing. You showed up, made it through, and did enough for today. The goose is very proud of you.'}
            </p>
            <div className="end-of-day-cheer" aria-hidden="true">
              ✨ 🪿 🎉
            </div>
            <button
              className="primary-button giant"
              onClick={state.dayCompletedAt ? finishDayCelebration : completeDay}
            >
              {state.dayCompletedAt
                ? 'Celebrate and close out today'
                : 'I did it — complete my day'}
            </button>
          </section>
        </div>
      )}
    </div>
  )
}

const emptyLocalPreferences: LocalPreferences = {
  setupComplete: false,
  displayName: '',
  azureDevOps: {
    organizationUrl: '',
    project: '',
    repository: '',
    currentUser: '',
  },
}

function InitialSetupGate() {
  const [status, setStatus] = useState<'loading' | 'required' | 'complete'>(
    'loading',
  )
  const [draft, setDraft] = useState<LocalPreferences>(emptyLocalPreferences)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!window.dailyGoose) {
      setStatus('complete')
      return
    }

    let active = true
    window.dailyGoose
      .getLocalPreferences()
      .then((preferences) => {
        if (!active) {
          return
        }
        setDraft(preferences)
        setStatus(preferences.setupComplete ? 'complete' : 'required')
      })
      .catch(() => {
        if (active) {
          setStatus('required')
        }
      })

    return () => {
      active = false
    }
  }, [])

  async function saveSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!window.dailyGoose) {
      setStatus('complete')
      return
    }

    setSaving(true)
    setError('')
    try {
      await window.dailyGoose.saveLocalPreferences({
        ...draft,
        setupComplete: true,
      })
      setStatus('complete')
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save your local setup.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (status === 'complete') {
    return <DailyGooseApp />
  }

  if (status === 'loading') {
    return (
      <main className="setup-shell">
        <section className="setup-card setup-loading">
          <img src={appIconUrl} alt="" />
          <h1>Just a Corporate Goose</h1>
          <p>Preparing your local workspace...</p>
        </section>
      </main>
    )
  }

  return (
    <main className="setup-shell">
      <form className="setup-card" onSubmit={saveSetup}>
        <div className="setup-heading">
          <img src={appIconUrl} alt="" />
          <div>
            <span className="wellness-kicker">First-time setup</span>
            <h1>Let&apos;s personalize your goose</h1>
          </div>
        </div>
        <p>
          These settings are saved only in your Windows user profile. The app
          never asks for or stores passwords, access tokens, or authentication
          cookies.
        </p>

        <label>
          <span>Your first name or preferred name</span>
          <input
            required
            autoComplete="name"
            value={draft.displayName}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                displayName: event.target.value,
              }))
            }
          />
        </label>

        <fieldset>
          <legend>Azure DevOps PR review connector</legend>
          <p>
            Sign-in stays in Azure CLI. These fields only tell the app which
            repository to query.
          </p>
          <label>
            <span>Organization URL</span>
            <input
              required
              type="url"
              placeholder="https://dev.azure.com/your-organization"
              value={draft.azureDevOps.organizationUrl}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  azureDevOps: {
                    ...current.azureDevOps,
                    organizationUrl: event.target.value,
                  },
                }))
              }
            />
          </label>
          <div className="setup-field-grid">
            <label>
              <span>Project</span>
              <input
                required
                value={draft.azureDevOps.project}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    azureDevOps: {
                      ...current.azureDevOps,
                      project: event.target.value,
                    },
                  }))
                }
              />
            </label>
            <label>
              <span>Repository</span>
              <input
                required
                value={draft.azureDevOps.repository}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    azureDevOps: {
                      ...current.azureDevOps,
                      repository: event.target.value,
                    },
                  }))
                }
              />
            </label>
          </div>
          <label>
            <span>Azure DevOps account email</span>
            <input
              required
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={draft.azureDevOps.currentUser}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  azureDevOps: {
                    ...current.azureDevOps,
                    currentUser: event.target.value,
                  },
                }))
              }
            />
          </label>
        </fieldset>

        {error && <div className="setup-error">{error}</div>}
        <button className="primary-button giant" type="submit" disabled={saving}>
          {saving ? 'Saving locally...' : 'Save and start my day'}
        </button>
        <small>
          Saved to `%APPDATA%\dailygoose\local-config.json`. Setup will not
          appear again after this file is saved.
        </small>
      </form>
    </main>
  )
}

function App() {
  const mode = new URLSearchParams(window.location.search).get('mode')
  if (mode === 'mini') {
    return <MiniTimer />
  }
  if (mode === 'reminder') {
    return <ReminderPopup />
  }
  return <InitialSetupGate />
}

export default App
