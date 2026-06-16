const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close:    () => ipcRenderer.invoke('window:close'),

  // File system
  openFolder:  () => ipcRenderer.invoke('fs:open-folder'),
  openFile:    () => ipcRenderer.invoke('fs:open-file'),
  readFile:    (p)       => ipcRenderer.invoke('fs:read-file', p),
  writeFile:   (p, c)    => ipcRenderer.invoke('fs:write-file', p, c),
  readDir:     (p)       => ipcRenderer.invoke('fs:read-dir', p),
  createFile:  (p)       => ipcRenderer.invoke('fs:create-file', p),
  createDir:   (p)       => ipcRenderer.invoke('fs:create-dir', p),
  rename:      (o, n)    => ipcRenderer.invoke('fs:rename', o, n),
  deleteItem:  (p)       => ipcRenderer.invoke('fs:delete-item', p),
  copyFile:    (s, d)    => ipcRenderer.invoke('fs:copy-file', s, d),
  copy:        (s, d)    => ipcRenderer.invoke('fs:copy', s, d),
  exists:      (p)       => ipcRenderer.invoke('fs:exists', p),
  revealInExplorer: (p)  => ipcRenderer.invoke('fs:reveal', p),

  // Settings
  storeGet:    (k)    => ipcRenderer.invoke('store:get', k),
  storeSet:    (k, v) => ipcRenderer.invoke('store:set', k, v),
  storeGetAll: ()     => ipcRenderer.invoke('store:get-all'),

  // Git
  gitRun: (cwd, args) => ipcRenderer.invoke('git:run', cwd, args),

  // Shell
  shellExec: (cmd, cwd) => ipcRenderer.invoke('shell:exec', cmd, cwd),

  // Search
  searchInFiles: (folder, query, opts) => ipcRenderer.invoke('search:in-files', folder, query, opts),

  // Terminal (node-pty via IPC)
  termCreate: (id, cwd) => ipcRenderer.invoke('term:create', id, cwd),
  termWrite:  (id, d)   => ipcRenderer.invoke('term:write', id, d),
  termResize: (id, c, r) => ipcRenderer.invoke('term:resize', id, c, r),
  termKill:   (id)      => ipcRenderer.invoke('term:kill', id),
  onTermData: (id, cb)  => {
    const ch = `term:data:${id}`
    const listener = (_, data) => cb(data)
    ipcRenderer.on(ch, listener)
    return () => ipcRenderer.removeListener(ch, listener)
  },
  onTermExit: (id, cb) => {
    const ch = `term:exit:${id}`
    const listener = (_, info) => cb(info)
    ipcRenderer.on(ch, listener)
    return () => ipcRenderer.removeListener(ch, listener)
  },
})