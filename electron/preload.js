const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close:    () => ipcRenderer.invoke('window:close'),

  // File system
  openFolder:  () => ipcRenderer.invoke('fs:openFolder'),
  openFile:    () => ipcRenderer.invoke('fs:openFile'),
  readFile:    (p) => ipcRenderer.invoke('fs:readFile', p),
  writeFile:   (p, c) => ipcRenderer.invoke('fs:writeFile', p, c),
  readDir:     (p) => ipcRenderer.invoke('fs:readDir', p),
  createFile:  (p) => ipcRenderer.invoke('fs:createFile', p),
  createDir:   (p) => ipcRenderer.invoke('fs:createDir', p),
  rename:      (o, n) => ipcRenderer.invoke('fs:rename', o, n),
  deleteItem:  (p) => ipcRenderer.invoke('fs:delete', p),

  // Settings store
  storeGet:    (k) => ipcRenderer.invoke('store:get', k),
  storeSet:    (k, v) => ipcRenderer.invoke('store:set', k, v),
  storeGetAll: () => ipcRenderer.invoke('store:getAll'),

  // Git
  gitRun:      (cwd, args) => ipcRenderer.invoke('git:run', cwd, args),

  // Shell
  shellExec:   (cmd, cwd) => ipcRenderer.invoke('shell:exec', cmd, cwd),

  // Search
  searchInFiles: (folder, query, opts) => ipcRenderer.invoke('search:inFiles', folder, query, opts),
})
