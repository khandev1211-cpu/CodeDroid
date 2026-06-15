const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development'

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(createWindow)
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })

// ─── Window Controls ─────────────────────────────────────────────────────────
ipcMain.handle('window:minimize', () => mainWindow?.minimize())
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window:close', () => mainWindow?.close())

// ─── File System ─────────────────────────────────────────────────────────────
ipcMain.handle('fs:open-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('fs:open-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('fs:read-file', async (_, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8')
    return { ok: true, content }
  } catch (e) {
    return { ok: false, content: '', error: e.message }
  }
})

ipcMain.handle('fs:write-file', async (_, filePath, content) => {
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, content, 'utf8')
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('fs:read-dir', async (_, dirPath) => {
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
  try {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
    await fs.promises.writeFile(filePath, '', { flag: 'wx' })
    return { ok: true }
  } catch (e) {
    if (e.code === 'EEXIST') return { ok: false, error: 'EEXIST', message: `'${path.basename(filePath)}' already exists in this location` }
    if (e.code === 'EACCES') return { ok: false, error: 'EACCES', message: `Permission denied — cannot modify this file` }
    if (e.code === 'ENOSPC') return { ok: false, error: 'ENOSPC', message: `Not enough disk space` }
    return { ok: false, error: e.code, message: e.message }
  }
})

ipcMain.handle('fs:create-dir', async (_, dirPath) => {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true })
    return { ok: true }
  } catch (e) {
    if (e.code === 'EEXIST') return { ok: false, error: 'EEXIST', message: `'${path.basename(dirPath)}' already exists in this location` }
    if (e.code === 'EACCES') return { ok: false, error: 'EACCES', message: `Permission denied — cannot create this folder` }
    return { ok: false, error: e.code, message: e.message }
  }
})

ipcMain.handle('fs:rename', async (_, oldPath, newPath) => {
  try {
    await fs.promises.rename(oldPath, newPath)
    return { ok: true }
  } catch (e) {
    if (e.code === 'EEXIST') return { ok: false, error: 'EEXIST', message: `'${path.basename(newPath)}' already exists in this location` }
    return { ok: false, error: e.code, message: e.message }
  }
})

ipcMain.handle('fs:delete-file', async (_, filePath) => {
  try {
    await fs.promises.unlink(filePath)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.code, message: e.message }
  }
})

ipcMain.handle('fs:delete-dir', async (_, dirPath) => {
  try {
    await fs.promises.rm(dirPath, { recursive: true, force: true })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.code, message: e.message }
  }
})

ipcMain.handle('fs:delete-item', async (_, itemPath) => {
  try {
    const stat = await fs.promises.stat(itemPath)
    if (stat.isDirectory()) {
      await fs.promises.rm(itemPath, { recursive: true, force: true })
    } else {
      await fs.promises.unlink(itemPath)
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.code, message: e.message }
  }
})

ipcMain.handle('fs:copy-file', async (_, src, dest) => {
  try {
    await fs.promises.mkdir(path.dirname(dest), { recursive: true })
    await fs.promises.copyFile(src, dest)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e.code, message: e.message }
  }
})

ipcMain.handle('fs:exists', async (_, filePath) => {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('fs:reveal', async (_, itemPath) => {
  shell.showItemInFolder(itemPath)
})

// ─── Settings Store ───────────────────────────────────────────────────────────
let Store
try { Store = require('electron-store') } catch { }
const store = Store ? new Store() : { get: () => undefined, set: () => { }, store: {} }

ipcMain.handle('store:get', (_, key) => store.get(key))
ipcMain.handle('store:set', (_, key, value) => store.set(key, value))
ipcMain.handle('store:get-all', () => store.store)

// ─── Git ──────────────────────────────────────────────────────────────────────
const { execFile } = require('child_process')
ipcMain.handle('git:run', (_, cwd, args) => {
  return new Promise((resolve) => {
    execFile('git', args, { cwd }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '', code: err?.code ?? 0 })
    })
  })
})

// ─── Shell Exec ───────────────────────────────────────────────────────────────
const { exec } = require('child_process')
ipcMain.handle('shell:exec', (_, cmd, cwd) => {
  return new Promise((resolve) => {
    exec(cmd, { cwd: cwd || undefined }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: stdout || '', stderr: stderr || '' })
    })
  })
})

// ─── File Search ──────────────────────────────────────────────────────────────
ipcMain.handle('search:in-files', async (_, folder, query, opts = {}) => {
  const results = []
  const { caseSensitive = false, useRegex = false } = opts
  const SKIP = new Set(['node_modules', '.git', 'dist', '.next', '__pycache__', '.cache'])

  async function walk(dir) {
    let entries
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
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
          } catch { }
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
try { pty = require('node-pty') } catch { }
const terminals = new Map()

ipcMain.handle('term:create', (event, id, cwd) => {
  if (!pty) return
  const shell = process.platform === 'win32' ? 'powershell.exe' : (process.env.SHELL || '/bin/bash')
  const term = pty.spawn(shell, [], { name: 'xterm-256color', cwd: cwd || process.env.HOME, env: process.env })
  terminals.set(id, term)
  term.onData((data) => { event.sender.send(`term:data:${id}`, data) })
  term.onExit(({ exitCode }) => { event.sender.send(`term:exit:${id}`, { exitCode }); terminals.delete(id) })
})

ipcMain.handle('term:write', (_, id, data) => { terminals.get(id)?.write(data) })
ipcMain.handle('term:resize', (_, id, cols, rows) => { terminals.get(id)?.resize(cols, rows) })
ipcMain.handle('term:kill', (_, id) => { terminals.get(id)?.kill(); terminals.delete(id) })