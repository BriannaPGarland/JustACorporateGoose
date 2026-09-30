const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('dailyGoose', {
  notify: (payload) => ipcRenderer.invoke('notify', payload),
  acknowledgeReminder: () => ipcRenderer.invoke('acknowledge-reminder'),
  performReminderSecondaryAction: () =>
    ipcRenderer.invoke('perform-reminder-secondary-action'),
  getActiveReminder: () => ipcRenderer.invoke('get-active-reminder'),
  getCurrentMini: () => ipcRenderer.invoke('get-current-mini'),
  showMini: () => ipcRenderer.invoke('show-mini'),
  hideMini: () => ipcRenderer.invoke('hide-mini'),
  focusMain: () => ipcRenderer.invoke('focus-main'),
  requestPauseToggle: () => ipcRenderer.invoke('request-pause-toggle'),
  requestCurrentTaskTime: () => ipcRenderer.invoke('request-current-task-time'),
  requestPreviousTaskTime: () => ipcRenderer.invoke('request-previous-task-time'),
  requestTaskComplete: (taskId) => ipcRenderer.invoke('request-task-complete', taskId),
  updateMini: (payload) => ipcRenderer.invoke('update-mini', payload),
  setActivityAwareness: (payload) => ipcRenderer.invoke('set-activity-awareness', payload),
  getTodaysMeetings: () => ipcRenderer.invoke('get-todays-meetings'),
  getReviewablePrs: () => ipcRenderer.invoke('get-reviewable-prs'),
  getLocalPreferences: () => ipcRenderer.invoke('get-local-preferences'),
  saveLocalPreferences: (preferences) =>
    ipcRenderer.invoke('save-local-preferences', preferences),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onMiniUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('mini-update', handler)
    return () => ipcRenderer.removeListener('mini-update', handler)
  },
  onReminderUpdate: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('reminder-update', handler)
    return () => ipcRenderer.removeListener('reminder-update', handler)
  },
  onReminderState: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('reminder-state', handler)
    return () => ipcRenderer.removeListener('reminder-state', handler)
  },
  onReminderAction: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('reminder-action', handler)
    return () => ipcRenderer.removeListener('reminder-action', handler)
  },
  onPauseToggleRequested: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('pause-toggle-requested', handler)
    return () => ipcRenderer.removeListener('pause-toggle-requested', handler)
  },
  onCurrentTaskTimeRequested: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('current-task-time-requested', handler)
    return () => ipcRenderer.removeListener('current-task-time-requested', handler)
  },
  onPreviousTaskTimeRequested: (callback) => {
    const handler = () => callback()
    ipcRenderer.on('previous-task-time-requested', handler)
    return () => ipcRenderer.removeListener('previous-task-time-requested', handler)
  },
  onTaskCompleteRequested: (callback) => {
    const handler = (_event, taskId) => callback(taskId)
    ipcRenderer.on('task-complete-requested', handler)
    return () => ipcRenderer.removeListener('task-complete-requested', handler)
  },
  onActivityState: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('activity-state', handler)
    return () => ipcRenderer.removeListener('activity-state', handler)
  },
  onActivityDrift: (callback) => {
    const handler = (_event, payload) => callback(payload)
    ipcRenderer.on('activity-drift', handler)
    return () => ipcRenderer.removeListener('activity-drift', handler)
  },
})
