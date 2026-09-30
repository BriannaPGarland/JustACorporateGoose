const { app, BrowserWindow, ipcMain, Menu, screen, shell } = require('electron')
const { execFile } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

let mainWindow
let miniWindow
let reminderWindow
let miniShouldShow = false
let currentMiniPayload
let activeReminder
const reminderQueue = []
let activityTimer
let activityState = {
  enabled: false,
  taskTitle: '',
  mismatchCount: 0,
}

const isDev = !app.isPackaged
if (!process.argv.some((argument) => argument.startsWith('--user-data-dir='))) {
  app.setPath('userData', path.join(app.getPath('appData'), 'dailygoose'))
}

function getLocalConfig() {
  const configPath = path.join(app.getPath('userData'), 'local-config.json')
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Unable to read local configuration from ${configPath}.`, error)
    }
    return {}
  }
}

function requireAzureDevOpsConfig() {
  const azureDevOps = getLocalConfig().azureDevOps
  const requiredFields = ['organizationUrl', 'project', 'repository', 'currentUser']
  if (
    !azureDevOps ||
    requiredFields.some(
      (field) =>
        typeof azureDevOps[field] !== 'string' || azureDevOps[field].trim() === '',
    )
  ) {
    throw new Error(
      'Azure DevOps is not configured. Add azureDevOps settings to local-config.json in the app user-data folder.',
    )
  }
  return azureDevOps
}

function powerShellSingleQuoted(value) {
  return `'${String(value).replaceAll("'", "''")}'`
}

function rendererUrl(mode) {
  if (isDev) {
    return `http://localhost:5173${mode ? `?mode=${mode}` : ''}`
  }

  const filePath = path.join(__dirname, '..', 'dist', 'index.html')
  return mode ? `${filePath}?mode=${mode}` : filePath
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1406,
    height: 924,
    minWidth: 980,
    minHeight: 700,
    backgroundColor: '#fff8f3',
    title: 'Just a Corporate Goose',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })
  mainWindow.setMenuBarVisibility(false)

  if (isDev) {
    mainWindow.loadURL(rendererUrl())
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = undefined
  })
}

function roundedWindowShape(width, height, radius) {
  const rects = []
  for (let y = 0; y < radius; y += 1) {
    const distanceFromCenter = radius - y - 0.5
    const inset = Math.ceil(
      radius - Math.sqrt(radius * radius - distanceFromCenter * distanceFromCenter),
    )
    rects.push({ x: inset, y, width: width - inset * 2, height: 1 })
    rects.push({ x: inset, y: height - y - 1, width: width - inset * 2, height: 1 })
  }
  rects.push({ x: 0, y: radius, width, height: height - radius * 2 })
  return rects
}

function miniWindowWidth(payload) {
  return payload && !payload.isPaused && !payload.isReady ? 490 : 390
}

function miniWindowHeight(payload) {
  return payload && !payload.isPaused && !payload.isReady ? 200 : 190
}

function keepMiniWindowOnTop(window) {
  if (!window || window.isDestroyed()) {
    return
  }

  window.setAlwaysOnTop(true, 'screen-saver', 1)
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  window.moveTop()
}

function resizeMiniWindow(window, payload) {
  if (!window || window.isDestroyed()) {
    return
  }

  const display = screen.getPrimaryDisplay()
  const width = miniWindowWidth(payload)
  const height = miniWindowHeight(payload)
  window.setBounds({
    width,
    height,
    x: display.workArea.x + display.workArea.width - width - 18,
    y: display.workArea.y + 18,
  })
  window.setShape(roundedWindowShape(width, height, 24))
}

function createMiniWindow() {
  if (miniWindow && !miniWindow.isDestroyed()) {
    return miniWindow
  }

  const display = screen.getPrimaryDisplay()
  const width = miniWindowWidth(currentMiniPayload)
  const height = miniWindowHeight(currentMiniPayload)

  miniWindow = new BrowserWindow({
    width,
    height,
    x: display.workArea.x + display.workArea.width - width - 18,
    y: display.workArea.y + 18,
    minWidth: 390,
    minHeight: 190,
    maxWidth: 490,
    maxHeight: 200,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    alwaysOnTop: true,
    focusable: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  keepMiniWindowOnTop(miniWindow)
  miniWindow.setIgnoreMouseEvents(false)
  miniWindow.setShape(roundedWindowShape(width, height, 24))

  if (isDev) {
    miniWindow.loadURL(rendererUrl('mini'))
  } else {
    miniWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      query: { mode: 'mini' },
    })
  }

  miniWindow.webContents.on('did-finish-load', () => {
    if (currentMiniPayload) {
      resizeMiniWindow(miniWindow, currentMiniPayload)
      miniWindow?.webContents.send('mini-update', currentMiniPayload)
    }
  })

  miniWindow.once('ready-to-show', () => {
    if (miniShouldShow) {
      miniWindow.showInactive()
      keepMiniWindowOnTop(miniWindow)
    }
  })

  miniWindow.on('closed', () => {
    miniWindow = undefined
  })

  return miniWindow
}

function sendActiveReminder() {
  if (
    !activeReminder ||
    !reminderWindow ||
    reminderWindow.isDestroyed() ||
    reminderWindow.webContents.isLoading()
  ) {
    return
  }

  reminderWindow.webContents.send('reminder-update', activeReminder)
}

function createReminderWindow() {
  if (reminderWindow && !reminderWindow.isDestroyed()) {
    return reminderWindow
  }

  const display = screen.getPrimaryDisplay()
  const width = Math.min(760, display.workArea.width - 80)
  const height = Math.min(420, display.workArea.height - 80)
  reminderWindow = new BrowserWindow({
    width,
    height,
    x: display.workArea.x + Math.round((display.workArea.width - width) / 2),
    y: display.workArea.y + Math.round((display.workArea.height - height) / 2),
    minWidth: width,
    minHeight: height,
    maxWidth: width,
    maxHeight: height,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    alwaysOnTop: true,
    focusable: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  })

  keepReminderWindowOnTop(reminderWindow)
  reminderWindow.setShape(roundedWindowShape(width, height, 32))

  if (isDev) {
    reminderWindow.loadURL(rendererUrl('reminder'))
  } else {
    reminderWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'), {
      query: { mode: 'reminder' },
    })
  }

  reminderWindow.webContents.on('did-finish-load', () => {
    sendActiveReminder()
  })
  reminderWindow.on('closed', () => {
    reminderWindow = undefined
  })

  return reminderWindow
}

function keepReminderWindowOnTop(window) {
  if (!window || window.isDestroyed()) {
    return
  }

  window.setAlwaysOnTop(true, 'screen-saver', 1)
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  window.moveTop()
}

function showNextReminder() {
  if (activeReminder || reminderQueue.length === 0) {
    return
  }

  activeReminder = reminderQueue.shift()
  const window = createReminderWindow()
  if (!window.webContents.isLoading()) {
    sendActiveReminder()
  }
  mainWindow?.webContents.send('reminder-state', {
    pending: activeReminder.pausesTask !== false,
  })
  window.show()
  keepReminderWindowOnTop(window)
  window.focus()
  window.moveTop()
  window.flashFrame(true)
}

function showNotification(payload) {
  reminderQueue.push(payload)
  showNextReminder()

  if (payload.urgent && mainWindow) {
    mainWindow.show()
    mainWindow.focus()
    mainWindow.flashFrame(true)
  }
}

function finishReminder(actionType, taskId) {
  if (actionType) {
    mainWindow?.webContents.send('reminder-action', {
      type: actionType,
      taskId,
    })
  }
  activeReminder = undefined
  if (reminderQueue.length > 0) {
    showNextReminder()
    return
  }

  reminderWindow?.hide()
  reminderWindow?.flashFrame(false)
  mainWindow?.webContents.send('reminder-state', { pending: false })
}

function acknowledgeReminder() {
  finishReminder(activeReminder?.actionType, activeReminder?.actionTaskId)
}

function performReminderSecondaryAction() {
  finishReminder(
    activeReminder?.secondaryActionType,
    activeReminder?.secondaryActionTaskId,
  )
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
    return
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }

  mainWindow.show()
  mainWindow.focus()
  mainWindow.flashFrame(false)
}

function normalizeWords(value) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4)
}

function activeWindowMatchesTask(activeWindow, taskTitle) {
  if (!activeWindow || !taskTitle) {
    return true
  }

  const appName = `${activeWindow.processName || ''} ${activeWindow.title || ''}`.toLowerCase()
  if (appName.includes('daily goose') || appName.includes('dailygoose')) {
    return true
  }

  const taskWords = normalizeWords(taskTitle)
  if (taskWords.length === 0) {
    return true
  }

  return taskWords.some((word) => appName.includes(word))
}

function getActiveWindow() {
  const script = [
    'Add-Type @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'using System.Text;',
    'public static class ForegroundWindow {',
    '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
    '  [DllImport("user32.dll", SetLastError=true)] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);',
    '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);',
    '}',
    '"@',
    '$handle = [ForegroundWindow]::GetForegroundWindow()',
    '$processId = 0',
    '[void][ForegroundWindow]::GetWindowThreadProcessId($handle, [ref]$processId)',
    '$title = New-Object System.Text.StringBuilder 1024',
    '[void][ForegroundWindow]::GetWindowText($handle, $title, $title.Capacity)',
    '$process = Get-Process -Id $processId -ErrorAction SilentlyContinue',
    '[pscustomobject]@{ title = $title.ToString(); processName = $process.ProcessName } | ConvertTo-Json -Compress',
  ].join('\n')

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout: 10000 },
      (error, stdout) => {
        if (error) {
          reject(error)
          return
        }

        try {
          resolve(JSON.parse(stdout.trim()))
        } catch (parseError) {
          reject(parseError)
        }
      },
    )
  })
}

function runPowerShellJson(script, timeout = 30000) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { windowsHide: true, timeout, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message))
          return
        }

        try {
          const output = stdout.trim()
          resolve(output ? JSON.parse(output) : [])
        } catch (parseError) {
          reject(parseError)
        }
      },
    )
  })
}

async function getTodaysMeetings() {
  const script = [
    '$ErrorActionPreference = "Stop"',
    '$start = (Get-Date).Date',
    '$end = $start.AddDays(1)',
    '$outlook = New-Object -ComObject Outlook.Application',
    '$namespace = $outlook.GetNamespace("MAPI")',
    '$calendar = $namespace.GetDefaultFolder(9)',
    '$items = $calendar.Items',
    '$items.Sort("[Start]")',
    '$items.IncludeRecurrences = $true',
    `$filter = "[Start] < '" + $end.ToString("g") + "' AND [End] > '" + $start.ToString("g") + "'"`,
    '$seen = @{}',
    '$meetings = @()',
    'foreach ($item in $items.Restrict($filter)) {',
    '  if ($item.ResponseStatus -eq 4) { continue }',
    '  $meetingStart = [datetime]$item.Start',
    '  $meetingEnd = [datetime]$item.End',
    `  $key = "$($item.Subject)|$($meetingStart.ToString("o"))|$($meetingEnd.ToString("o"))"`,
    '  if ($seen.ContainsKey($key)) { continue }',
    '  $seen[$key] = $true',
    '  $status = switch ($item.ResponseStatus) {',
    '    1 { "Organizer" }',
    '    2 { "Tentative" }',
    '    3 { "Accepted" }',
    '    5 { "Proposed" }',
    '    default { "No response" }',
    '  }',
    '  $meetings += [pscustomobject]@{',
    '    id = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($key))',
    '    title = [string]$item.Subject',
    '    start = $meetingStart.ToString("o")',
    '    end = $meetingEnd.ToString("o")',
    '    responseStatus = $status',
    '    selected = $item.ResponseStatus -in @(1, 2, 3)',
    '  }',
    '}',
    'ConvertTo-Json -InputObject @($meetings) -Compress -Depth 4',
  ].join('\n')

  return runPowerShellJson(script)
}

async function getReviewablePullRequests() {
  const azureDevOps = requireAzureDevOpsConfig()
  const script = [
    '$ErrorActionPreference = "Stop"',
    `$prs = & az repos pr list --organization ${powerShellSingleQuoted(azureDevOps.organizationUrl)} --project ${powerShellSingleQuoted(azureDevOps.project)} --repository ${powerShellSingleQuoted(azureDevOps.repository)} --status active --top 100 --output json`,
    'if ($LASTEXITCODE -ne 0) { throw "Unable to query Azure DevOps pull requests." }',
    '$prs',
  ].join('\n')

  const pullRequests = await runPowerShellJson(script, 60000)
  const currentUser = azureDevOps.currentUser.toLowerCase()
  const organizationUrl = azureDevOps.organizationUrl.replace(/\/+$/, '')
  const project = encodeURIComponent(azureDevOps.project)
  const repository = encodeURIComponent(azureDevOps.repository)

  return pullRequests
    .filter((pullRequest) => !pullRequest.isDraft)
    .filter(
      (pullRequest) =>
        String(pullRequest.createdBy?.uniqueName || '').toLowerCase() !== currentUser,
    )
    .filter((pullRequest) => {
      const authorVote = (pullRequest.reviewers || []).find(
        (reviewer) => reviewer.id === pullRequest.createdBy?.id,
      )?.vote
      return Number(authorVote) >= 5
    })
    .map((pullRequest) => {
      const id = pullRequest.pullRequestId || pullRequest.codeReviewId
      return {
        id,
        title: pullRequest.title,
        author: pullRequest.createdBy?.displayName || 'Unknown author',
        createdDate: pullRequest.creationDate || '',
        url: `${organizationUrl}/${project}/_git/${repository}/pullrequest/${id}`,
      }
    })
}

async function checkActiveWindow() {
  if (!activityState.enabled || !activityState.taskTitle) {
    activityState.mismatchCount = 0
    return
  }

  try {
    const current = await getActiveWindow()
    const matches = activeWindowMatchesTask(current, activityState.taskTitle)

    if (matches) {
      activityState.mismatchCount = 0
      miniWindow?.webContents.send('activity-state', { angry: false })
      return
    }

    activityState.mismatchCount += 1
    if (activityState.mismatchCount >= 3) {
      const payload = {
        angry: true,
        applicationName: current?.processName || 'another app',
      }
      miniWindow?.webContents.send('activity-state', payload)
      mainWindow?.webContents.send('activity-drift', payload)
      showNotification({
        title: 'The focus goose noticed a detour',
        body: `You planned to work on "${activityState.taskTitle}", but ${payload.applicationName} has your attention.`,
      })
      activityState.mismatchCount = 0
    }
  } catch (error) {
    console.error('Unable to inspect the active window.', error)
  }
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.justacorporategoose.app')
  Menu.setApplicationMenu(null)
  createMainWindow()
  activityTimer = setInterval(checkActiveWindow, 30000)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  if (activityTimer) {
    clearInterval(activityTimer)
  }
})

ipcMain.handle('notify', (_event, payload) => {
  showNotification(payload)
})

ipcMain.handle('acknowledge-reminder', () => {
  acknowledgeReminder()
})

ipcMain.handle('perform-reminder-secondary-action', () => {
  performReminderSecondaryAction()
})

ipcMain.handle('get-active-reminder', () => activeReminder)
ipcMain.handle('get-current-mini', () => currentMiniPayload)

ipcMain.handle('show-mini', () => {
  miniShouldShow = true
  const window = createMiniWindow()
  if (!window.webContents.isLoading()) {
    window.showInactive()
    keepMiniWindowOnTop(window)
  }
})

ipcMain.handle('hide-mini', () => {
  miniShouldShow = false
  miniWindow?.hide()
})

ipcMain.handle('focus-main', () => {
  focusMainWindow()
})

ipcMain.handle('request-pause-toggle', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pause-toggle-requested')
  }
})

ipcMain.handle('request-current-task-time', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('current-task-time-requested')
  }
})

ipcMain.handle('request-previous-task-time', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('previous-task-time-requested')
  }
})

ipcMain.handle('request-task-complete', (_event, taskId) => {
  if (mainWindow && !mainWindow.isDestroyed() && taskId) {
    mainWindow.webContents.send('task-complete-requested', taskId)
  }
})

ipcMain.handle('update-mini', (_event, payload) => {
  currentMiniPayload = payload
  const window = createMiniWindow()
  resizeMiniWindow(window, payload)
  keepMiniWindowOnTop(window)
  if (!window.webContents.isLoading()) {
    window.webContents.send('mini-update', payload)
  }
})

ipcMain.handle('set-activity-awareness', (_event, payload) => {
  activityState = {
    enabled: Boolean(payload.enabled),
    taskTitle: payload.taskTitle || '',
    mismatchCount: 0,
  }
})

ipcMain.handle('get-todays-meetings', async () => {
  return getTodaysMeetings()
})

ipcMain.handle('get-reviewable-prs', async () => {
  return getReviewablePullRequests()
})

ipcMain.handle('get-local-preferences', () => {
  const displayName = getLocalConfig().displayName
  return {
    displayName: typeof displayName === 'string' ? displayName : '',
  }
})

ipcMain.handle('open-external', async (_event, url) => {
  await shell.openExternal(url)
})
