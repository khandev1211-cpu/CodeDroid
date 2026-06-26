const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, session } = require('electron')
const path = require('path')
const fs = require('fs')
const { execFile, exec, spawn } = require('child_process')

const isDev = process.env.NODE_ENV === 'development'

// ─── Sidecar port — single source of truth ────────────────────────────────────
const SIDECAR_PORT = process.env.CODEDROID_SIDECAR_PORT
  ? parseInt(process.env.CODEDROID_SIDECAR_PORT)
  : 8765

let mainWindow
let sidecareProcess = null

// ─── Python Sidecar auto-start ────────────────────────────────────────────────
function startSidecar() {
  const pythonDir = path.join(__dirname, '..', 'python')
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

  // Check if already running
  const http = require('http')
  const req = http.get(`http://127.0.0.1:${SIDECAR_PORT}/health`, () => {
    console.log('[Sidecar] Already running on port', SIDECAR_PORT)
  })
  req.on('error', () => {
    // Not running — start it
    console.log('[Sidecar] Starting on port', SIDECAR_PORT)
    sidecareProcess = spawn(pythonCmd, [
      path.join(pythonDir, 'main.py'),
      '--port', String(SIDECAR_PORT),
      '--host', '127.0.0.1',
    ], {
      cwd: pythonDir,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    })

    sidecareProcess.stdout.on('data', d => process.stdout.write(`[Sidecar] ${d}`))
    sidecareProcess.stderr.on('data', d => process.stderr.write(`[Sidecar ERR] ${d}`))
    sidecareProcess.on('exit', (code) => {
      console.log(`[Sidecar] Exited with code ${code}`)
      sidecareProcess = null
    })
  })
  req.setTimeout(1000)
  req.end()
}

function stopSidecar() {
  if (sidecareProcess) {
    sidecareProcess.kill()
    sidecareProcess = null
  }
}

// ─── IPC path traversal guard ─────────────────────────────────────────────────
// Returns true if the resolved path is safely inside the workspace root.
// Blocks any attempt to escape the workspace via ../../../ tricks.
let _workspaceRoot = null

function setWorkspaceRoot(p) {
  _workspaceRoot = p ? path.resolve(p) : null
}

function isSafePath(filePath) {
  if (!filePath || typeof filePath !== 'string') return false
  // Always allow paths from dialog (they were user-chosen) — only guard
  // programmatic paths that come from renderer via IPC.
  // If no workspace is open yet, allow any valid absolute path.
  if (!_workspaceRoot) return path.isAbsolute(filePath)
  const resolved = path.resolve(filePath)
  return resolved.startsWith(_workspaceRoot + path.sep) || resolved === _workspaceRoot
}

// ─── safeStorage encrypted key store ─────────────────────────────────────────
// API keys are stored encrypted via OS keychain (safeStorage).
// Non-sensitive settings still go through electron-store (plaintext JSON).
const ENCRYPTED_KEYS = ['groqKey', 'geminiKey', 'claudeKey']
const ENCRYPTED_PREFIX = 'enc:'

function encryptValue(val) {
  if (!safeStorage.isEncryptionAvailable()) return val
  try {
    return ENCRYPTED_PREFIX + safeStorage.encryptString(val).toString('base64')
  } catch { return val }
}

function decryptValue(val) {
  if (!val || !val.startsWith(ENCRYPTED_PREFIX)) return val
  if (!safeStorage.isEncryptionAvailable()) return ''
  try {
    return safeStorage.decryptString(Buffer.from(val.slice(ENCRYPTED_PREFIX.length), 'base64'))
  } catch { return '' }
}

// ─── Window creation ──────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // required for preload to use require
    },
  })

  // ── Production CSP ────────────────────────────────────────────────────────
  // Applied in both dev and prod via onHeadersReceived (dev already has it via
  // vite.config.ts server.headers, but belt-and-suspenders here).
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Monaco needs unsafe-eval
            `connect-src 'self' http://127.0.0.1:${SIDECAR_PORT} ws://127.0.0.1:${SIDECAR_PORT} http://localhost:${SIDECAR_PORT} ws://localhost:${SIDECAR_PORT} https://api.groq.com https://generativelanguage.googleapis.com https://api.anthropic.com http://localhost:11434 http://127.0.0.1:11434`,
            "style-src 'self' 'unsafe-inline'",
            "font-src 'self' data:",
            "img-src 'self' data: blob:",
            "worker-src 'self' blob:",
          ].join('; ')
        ],
      },
    })
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  startSidecar()
  createWindow()
})

app.on('window-all-closed', () => {
  stopSidecar()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', stopSidecar)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ─── Window Controls ─────────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window:close', () => mainWindow?.close())

// Expose the sidecar port to the renderer so it doesn't need to hardcode it
ipcMain.handle('app:sidecar-port', () => SIDECAR_PORT)

// ─── File System ─────────────────────────────────────────────────────────────
ipcMain.handle('fs:open-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  if (result.canceled) return null
  const p = result.filePaths[0]
  setWorkspaceRoot(p)
  return p
})

ipcMain.handle('fs:open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('fs:read-file', async (_, filePath) => {
  if (!isSafePath(filePath)) return { ok: false, content: '', error: 'Path not allowed' }
  try {
    const content = await fs.promises.readFile(filePath, 'utf8')
    return { ok: true, content }
  } catch (e) {
    return { ok: false, content: '', error: e.message }
  }
})

ipcMain.handle('fs:write-file', async (_, filePath, content) => {
  if (!isSafePath(filePath)) return { ok: false, error: 'Path not allowed' }
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, content, 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:read-dir', async (_, dirPath) => {
  if (!isSafePath(dirPath)) return { ok: false, entries: [], error: 'Path not allowed' }
  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true })
    return {
      ok: true,
      entries: entries.map(e => ({
        name: e.name,
        path: path.join(dirPath, e.name),
        isDir: e.isDirectory(),
      }))
    }
  } catch (e) {
    return { ok: false, entries: [], error: e.message }
  }
})

ipcMain.handle('fs:create-file', async (_, filePath) => {
  if (!isSafePath(filePath)) return { ok: false, error: 'EPERM', message: 'Path not allowed' }
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, '', { flag: 'wx' })
    return { ok: true }
  } catch (e) {
    if (e.code === 'EEXIST') return { ok: false, error: 'EEXIST', message: `'${path.basename(filePath)}' already exists` }
    if (e.code === 'EACCES') return { ok: false, error: 'EACCES', message: `Permission denied` }
    if (e.code === 'ENOSPC') return { ok: false, error: 'ENOSPC', message: `Not enough disk space` }
    return { ok: false, error: e.code, message: e.message }
  }
})

ipcMain.handle('fs:create-dir', async (_, dirPath) => {
  if (!isSafePath(dirPath)) return { ok: false, error: 'EPERM', message: 'Path not allowed' }
  try {
    await fs.promises.mkdir(dirPath, { recursive: true })
    return { ok: true }
  } catch (e) {
    if (e.code === 'EEXIST') return { ok: false, error: 'EEXIST', message: `'${path.basename(dirPath)}' already exists` }
    if (e.code === 'EACCES') return { ok: false, error: 'EACCES', message: `Permission denied` }
    return { ok: false, error: e.code, message: e.message }
  }
})

ipcMain.handle('fs:rename', async (_, oldPath, newPath) => {
  if (!isSafePath(oldPath) || !isSafePath(newPath)) return { ok: false, error: 'EPERM', message: 'Path not allowed' }
  try {
    try { await fs.promises.access(oldPath) }
    catch { return { ok: false, error: 'ENOENT', message: `Source not found: ${path.basename(oldPath)}` } }
    try {
      await fs.promises.access(newPath)
      return { ok: false, error: 'EEXIST', message: `'${path.basename(newPath)}' already exists` }
    } catch { /* good */ }
    await fs.promises.rename(oldPath, newPath)
    return { ok: true, oldPath, newPath }
  } catch (e) {
    return { ok: false, error: e.code, message: e.message }
  }
})

async function copyDirRecursive(src, dest) {
  await fs.promises.mkdir(dest, { recursive: true })
  const entries = await fs.promises.readdir(src, { withFileTypes: true })
  for (const entry of entries) {
    const srcChild = path.join(src, entry.name)
    const destChild = path.join(dest, entry.name)
    if (entry.isDirectory()) await copyDirRecursive(srcChild, destChild)
    else await fs.promises.copyFile(srcChild, destChild)
  }
}

ipcMain.handle('fs:copy', async (_, src, dest) => {
  if (!isSafePath(src) || !isSafePath(dest)) return { ok: false, error: 'EPERM', message: 'Path not allowed' }
  try {
    const stat = await fs.promises.stat(src)
    if (stat.isDirectory()) await copyDirRecursive(src, dest)
    else {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true })
      await fs.promises.copyFile(src, dest)
    }
    return { ok: true }
  } catch (e) { return { ok: false, error: e.code, message: e.message } }
})

ipcMain.handle('fs:copy-file', async (_, src, dest) => {
  if (!isSafePath(src) || !isSafePath(dest)) return { ok: false, error: 'EPERM', message: 'Path not allowed' }
  try {
    const stat = await fs.promises.stat(src)
    if (stat.isDirectory()) await copyDirRecursive(src, dest)
    else {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true })
      await fs.promises.copyFile(src, dest)
    }
    return { ok: true }
  } catch (e) { return { ok: false, error: e.code, message: e.message } }
})

ipcMain.handle('fs:delete-file', async (_, filePath) => {
  if (!isSafePath(filePath)) return { ok: false, error: 'EPERM', message: 'Path not allowed' }
  try {
    await fs.promises.unlink(filePath)
    return { ok: true }
  } catch (e) { return { ok: false, error: e.code, message: e.message } }
})

ipcMain.handle('fs:delete-dir', async (_, dirPath) => {
  if (!isSafePath(dirPath)) return { ok: false, error: 'EPERM', message: 'Path not allowed' }
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true })
    return { ok: true }
  } catch (e) { return { ok: false, error: e.code, message: e.message } }
})

ipcMain.handle('fs:delete-item', async (_, itemPath) => {
  if (!isSafePath(itemPath)) return { ok: false, error: 'EPERM', message: 'Path not allowed' }
  try {
    const stat = await fs.promises.stat(itemPath)
    if (stat.isDirectory()) await fs.promises.rm(itemPath, { recursive: true, force: true })
    else await fs.promises.unlink(itemPath)
    return { ok: true }
  } catch (e) { return { ok: false, error: e.code, message: e.message } }
})

ipcMain.handle('fs:exists', async (_, filePath) => {
  try { await fs.promises.access(filePath); return true }
  catch { return false }
})

ipcMain.handle('fs:reveal', async (_, itemPath) => {
  shell.showItemInFolder(itemPath)
})

// ─── Settings Store (non-sensitive keys) ─────────────────────────────────────
let Store
try { Store = require('electron-store') } catch {}
const store = Store ? new Store() : { get: () => undefined, set: () => {}, store: {} }

ipcMain.handle('store:get', (_, key) => store.get(key))
ipcMain.handle('store:set', (_, key, value) => store.set(key, value))
ipcMain.handle('store:get-all', () => store.store)

// ─── Encrypted API key store (safeStorage) ───────────────────────────────────
// Keys: groqKey, geminiKey, claudeKey
// Stored under 'enc_<key>' in electron-store as base64-encrypted blobs.
ipcMain.handle('keys:set', (_, key, value) => {
  if (!ENCRYPTED_KEYS.includes(key)) return { ok: false, error: 'Unknown key' }
  try {
    store.set(`enc_${key}`, encryptValue(value))
    return { ok: true }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('keys:get', (_, key) => {
  if (!ENCRYPTED_KEYS.includes(key)) return null
  try {
    const raw = store.get(`enc_${key}`)
    if (!raw) {
      // Migrate from old plaintext settings if present
      const legacy = store.get(`settings.${key}`) || store.get(key)
      if (legacy) {
        store.set(`enc_${key}`, encryptValue(legacy))
        return legacy
      }
      return null
    }
    return decryptValue(raw)
  } catch { return null }
})

ipcMain.handle('keys:get-all', () => {
  const result = {}
  for (const key of ENCRYPTED_KEYS) {
    try {
      const raw = store.get(`enc_${key}`)
      result[key] = raw ? decryptValue(raw) : ''
    } catch { result[key] = '' }
  }
  return result
})

ipcMain.handle('keys:delete', (_, key) => {
  if (!ENCRYPTED_KEYS.includes(key)) return
  store.delete(`enc_${key}`)
})

// ─── Git ──────────────────────────────────────────────────────────────────────
ipcMain.handle('git:run', (_, cwd, args) => {
  if (!isSafePath(cwd)) return { ok: false, stdout: '', stderr: 'Path not allowed', code: 1 }
  // Allowlist of safe git subcommands — prevent arbitrary git abuse
  const ALLOWED_GIT = ['status','log','diff','branch','checkout','add','commit','push',
    'pull','fetch','merge','rebase','stash','show','blame','rev-parse','remote']
  const sub = args[0]
  if (!ALLOWED_GIT.includes(sub)) return { ok: false, stdout: '', stderr: `git ${sub} not allowed`, code: 1 }
  return new Promise((resolve) => {
    execFile('git', args, { cwd }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '', code: err?.code ?? 0 })
    })
  })
})

// ─── Shell Exec ───────────────────────────────────────────────────────────────
ipcMain.handle('shell:exec', (_, cmd, cwd) => {
  if (cwd && !isSafePath(cwd)) return { ok: false, stdout: '', stderr: 'Path not allowed' }
  return new Promise((resolve) => {
    exec(cmd, { cwd: cwd || undefined }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '' })
    })
  })
})

// ─── File Search (JS fallback when Rust addon not available) ──────────────────
ipcMain.handle('search:in-files', async (_, folder, query, opts = {}) => {
  if (!isSafePath(folder)) return []
  const results = []
  const { caseSensitive = false, useRegex = false } = opts
  const SKIP = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', '.cache', 'target'])
  const MAX_RESULTS = 500

  async function walk(dir) {
    if (results.length >= MAX_RESULTS) return
    let entries
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (results.length >= MAX_RESULTS) return
      if (SKIP.has(e.name)) continue
      const full = path.join(dir, e.name)
      if (e.isDirectory()) { await walk(full); continue }
      let content
      try { content = await fs.promises.readFile(full, 'utf8') } catch { continue }
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        let matchStart = -1
        if (useRegex) {
          try {
            const re = new RegExp(query, caseSensitive ? '' : 'i')
            const m = re.exec(line)
            if (m) matchStart = m.index
          } catch {}
        } else {
          matchStart = caseSensitive ? line.indexOf(query) : line.toLowerCase().indexOf(query.toLowerCase())
        }
        if (matchStart >= 0) {
          results.push({ filePath: full, lineNumber: i + 1, lineContent: line, matchStart, matchEnd: matchStart + query.length })
        }
      }
    }
  }

  await walk(folder)
  return results
})

// ─── Terminal (node-pty) ──────────────────────────────────────────────────────
let pty
try { pty = require('node-pty') } catch {}
const terminals = new Map()

ipcMain.handle('term:create', (event, id, cwd) => {
  if (!pty) return
  if (cwd && !isSafePath(cwd)) return
  const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash')
  const term = pty.spawn(shell, [], { name: 'xterm-256color', cwd: cwd || process.env.HOME, env: process.env })
  terminals.set(id, term)
  term.onData(data => event.sender.send(`term:data:${id}`, data))
  term.onExit(({ exitCode }) => { event.sender.send(`term:exit:${id}`, { exitCode }); terminals.delete(id) })
})

ipcMain.handle('term:write', (_, id, data) => { terminals.get(id)?.write(data) })
ipcMain.handle('term:resize', (_, id, cols, rows) => { terminals.get(id)?.resize(cols, rows) })
ipcMain.handle('term:kill', (_, id) => { terminals.get(id)?.kill(); terminals.delete(id) })