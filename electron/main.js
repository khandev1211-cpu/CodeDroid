const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { exec } = require('child_process')
const { spawn } = require('child_process')

// Fix electron-store import for both CJS and ESM
let Store
try {
  Store = require('electron-store')
  // electron-store v8+ exports default
  if (Store.default) Store = Store.default
} catch(e) {
  // fallback simple store using a JSON file
  const storePath = path.join(app.getPath?.('userData') || '.', 'settings.json')
  Store = class SimpleStore {
    constructor() {
      try { this.data = JSON.parse(fs.readFileSync(storePath, 'utf-8')) } catch { this.data = {} }
    }
    get(k) { return this.data[k] }
    set(k, v) { this.data[k] = v; fs.writeFileSync(storePath, JSON.stringify(this.data)) }
    get store() { return this.data }
  }
}

let store
let mainWindow = null
let pythonProcess = null
const PYTHON_PORT = 8765
const isDev = process.env.NODE_ENV === 'development'

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d0d0d',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  })

  // Show window when ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    mainWindow.focus()
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // Uncomment to open DevTools:
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── Python Sidecar ───────────────────────────────────────────────────────────
function startPython() {
  const scriptPath = path.join(__dirname, '../python/main.py')
  if (!fs.existsSync(scriptPath)) {
    console.log('[Python] Sidecar not found, skipping.')
    return
  }
  pythonProcess = spawn('python', [scriptPath, '--port', String(PYTHON_PORT)], {
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  pythonProcess.stdout?.on('data', d => console.log('[Python]', d.toString().trim()))
  pythonProcess.stderr?.on('data', d => console.error('[Python err]', d.toString().trim()))
  pythonProcess.on('close', code => console.log('[Python] exited:', code))
}

// ─── IPC: Window controls ─────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow?.maximize()
})
ipcMain.handle('window:close', () => mainWindow?.close())

// ─── IPC: File system ─────────────────────────────────────────────────────────
ipcMain.handle('fs:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return result.filePaths[0] || null
})

ipcMain.handle('fs:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] })
  return result.filePaths[0] || null
})

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try { return { ok: true, content: fs.readFileSync(filePath, 'utf-8') } }
  catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
  try { fs.writeFileSync(filePath, content, 'utf-8'); return { ok: true } }
  catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('fs:readDir', async (_, dirPath) => {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    return {
      ok: true,
      entries: entries.map(e => ({
        name: e.name,
        isDir: e.isDirectory(),
        path: path.join(dirPath, e.name),
      }))
    }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('fs:createFile', async (_, filePath) => {
  try { fs.writeFileSync(filePath, ''); return { ok: true } }
  catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('fs:createDir', async (_, dirPath) => {
  try { fs.mkdirSync(dirPath, { recursive: true }); return { ok: true } }
  catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('fs:rename', async (_, oldPath, newPath) => {
  try { fs.renameSync(oldPath, newPath); return { ok: true } }
  catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('fs:delete', async (_, filePath) => {
  try { fs.rmSync(filePath, { recursive: true, force: true }); return { ok: true } }
  catch (e) { return { ok: false, error: e.message } }
})

// ─── IPC: Settings ────────────────────────────────────────────────────────────
ipcMain.handle('store:get', (_, key) => store?.get(key))
ipcMain.handle('store:set', (_, key, val) => store?.set(key, val))
ipcMain.handle('store:getAll', () => store?.store || {})

// ─── IPC: Git ─────────────────────────────────────────────────────────────────
ipcMain.handle('git:run', async (_, cwd, args) => {
  return new Promise((resolve) => {
    exec(`git ${args.join(' ')}`, { cwd }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '', code: err?.code || 0 })
    })
  })
})

// ─── IPC: Shell ───────────────────────────────────────────────────────────────
ipcMain.handle('shell:exec', async (_, cmd, cwd) => {
  return new Promise((resolve) => {
    exec(cmd, { cwd: cwd || process.cwd() }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '' })
    })
  })
})

// ─── IPC: Search ─────────────────────────────────────────────────────────────
ipcMain.handle('search:inFiles', async (_, folderPath, query, opts = {}) => {
  const { caseSensitive = false, useRegex = false } = opts
  const results = []

  function walkDir(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walkDir(fullPath)
        } else {
          try {
            const content = fs.readFileSync(fullPath, 'utf-8')
            const lines = content.split('\n')
            lines.forEach((line, idx) => {
              const flags = caseSensitive ? 'g' : 'gi'
              const escapedQuery = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              try {
                const pattern = new RegExp(escapedQuery, flags)
                const match = pattern.exec(line)
                if (match) {
                  results.push({
                    filePath: fullPath,
                    lineNumber: idx + 1,
                    lineContent: line,
                    matchStart: match.index,
                    matchEnd: match.index + match[0].length
                  })
                }
              } catch {}
            })
          } catch {}
        }
        if (results.length > 5000) return
      }
    } catch {}
  }

  walkDir(folderPath)
  return results
})

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  try {
    store = new Store()
  } catch(e) {
    console.error('Store init failed:', e.message)
  }
  startPython()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  pythonProcess?.kill()
  if (process.platform !== 'darwin') app.quit()
})

// Handle uncaught errors gracefully
process.on('uncaughtException', err => {
  console.error('Uncaught:', err.message)
})