export {}

declare global {
  interface Window {
    api: {
      // Window controls
      minimize: () => Promise<void>
      maximize: () => Promise<void>
      close: () => Promise<void>

      // File system
      openFolder: () => Promise<string | null>
      openFile: () => Promise<string | null>
      readFile: (path: string) => Promise<{ ok: boolean; content: string; error?: string }>
      writeFile: (path: string, content: string) => Promise<{ ok: boolean; error?: string }>
      readDir: (path: string) => Promise<{ ok: boolean; entries: Array<{ name: string; path: string; isDir: boolean }>; error?: string }>
      createFile: (path: string) => Promise<{ ok: boolean; error?: string; message?: string }>
      createDir: (path: string) => Promise<{ ok: boolean; error?: string; message?: string }>
      rename: (oldPath: string, newPath: string) => Promise<{ ok: boolean; error?: string; message?: string }>
      deleteItem: (path: string) => Promise<{ ok: boolean; error?: string; message?: string }>
      copyFile: (src: string, dest: string) => Promise<{ ok: boolean; error?: string; message?: string }>
      exists: (path: string) => Promise<boolean>
      revealInExplorer: (path: string) => Promise<void>

      // Settings store
      storeGet: (key: string) => Promise<any>
      storeSet: (key: string, value: any) => Promise<void>
      storeGetAll: () => Promise<Record<string, any>>

      // Git
      gitRun: (cwd: string, args: string[]) => Promise<{ ok: boolean; stdout: string; stderr: string; code: number }>

      // Shell
      shellExec: (cmd: string, cwd?: string) => Promise<{ ok: boolean; stdout: string; stderr: string }>

      // Search
      searchInFiles: (
        folder: string,
        query: string,
        opts?: { caseSensitive?: boolean; useRegex?: boolean }
      ) => Promise<Array<{ filePath: string; lineNumber: number; lineContent: string; matchStart: number; matchEnd: number }>>

      // Terminal (node-pty)
      termCreate: (id: string, cwd: string | null) => Promise<void>
      termWrite:  (id: string, data: string) => Promise<void>
      termResize: (id: string, cols: number, rows: number) => Promise<void>
      termKill:   (id: string) => Promise<void>
      onTermData: (id: string, cb: (data: string) => void) => () => void
      onTermExit: (id: string, cb: (info: { exitCode: number }) => void) => () => void
    }
  }
}