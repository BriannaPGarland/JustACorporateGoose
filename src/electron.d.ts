export {}

declare global {
  interface Window {
    dailyGoose?: {
      notify: (payload: {
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
      }) => Promise<void>
      acknowledgeReminder: () => Promise<void>
      performReminderSecondaryAction: () => Promise<void>
      getActiveReminder: () => Promise<ReminderPayload | undefined>
      getCurrentMini: () => Promise<MiniTimerPayload | undefined>
      showMini: () => Promise<void>
      hideMini: () => Promise<void>
      focusMain: () => Promise<void>
      requestPauseToggle: () => Promise<void>
      requestCurrentTaskTime: () => Promise<void>
      requestPreviousTaskTime: () => Promise<void>
      requestTaskComplete: (taskId: string) => Promise<void>
      updateMini: (payload: MiniTimerPayload) => Promise<void>
      setActivityAwareness: (payload: { enabled: boolean; taskTitle: string }) => Promise<void>
      getTodaysMeetings: () => Promise<CalendarMeeting[]>
      getReviewablePrs: () => Promise<ReviewablePullRequest[]>
      getLocalPreferences: () => Promise<{ displayName: string }>
      openExternal: (url: string) => Promise<void>
      onMiniUpdate: (callback: (payload: MiniTimerPayload) => void) => () => void
      onReminderUpdate: (callback: (payload: ReminderPayload) => void) => () => void
      onReminderState: (callback: (payload: { pending: boolean }) => void) => () => void
      onReminderAction: (
        callback: (payload: { type: string; taskId?: string }) => void,
      ) => () => void
      onPauseToggleRequested: (callback: () => void) => () => void
      onCurrentTaskTimeRequested: (callback: () => void) => () => void
      onPreviousTaskTimeRequested: (callback: () => void) => () => void
      onTaskCompleteRequested: (callback: (taskId: string) => void) => () => void
      onActivityState: (callback: (payload: { angry: boolean; applicationName?: string }) => void) => () => void
      onActivityDrift: (callback: (payload: { angry: boolean; applicationName?: string }) => void) => () => void
    }
  }

  interface MiniTimerPayload {
    taskId?: string
    taskTitle: string
    remainingSeconds: number
    totalSeconds: number
    angry: boolean
    isPaused: boolean
    isReady: boolean
    previousTaskTitle?: string
    celebrating: boolean
  }

  interface ReminderPayload {
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
  }

  interface CalendarMeeting {
    id: string
    title: string
    start: string
    end: string
    responseStatus: string
    selected: boolean
    movementMode: 'none' | 'walk' | 'stand'
    walkable?: boolean
  }

  interface ReviewablePullRequest {
    id: number
    title: string
    author: string
    createdDate: string
    url: string
  }
}
