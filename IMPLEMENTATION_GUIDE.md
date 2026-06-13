# CodeDroid Implementation Guide

## Directory Structure & Key Files

```
codedroid/
│
├── 📄 package.json              # Node.js project config, scripts, deps
├── 📄 tsconfig.json             # TypeScript compilation settings
├── 📄 tsconfig.node.json        # TS for Vite/Node config files
├── 📄 vite.config.ts            # Vite build & dev config
├── 📄 index.html                # HTML entry point
├── 📄 README.md                 # Project overview
│
├── 📁 src/                      # React + TypeScript frontend
│   ├── main.tsx                 # React entry (ReactDOM.createRoot)
│   ├── App.tsx                  # Root component + global keyboard handlers
│   │
│   ├── 📁 components/           # Reusable React components
│   │   ├── ActivityBar.tsx       # Left activity sidebar icons
│   │   ├── ActivityBar.css
│   │   ├── TitleBar.tsx          # Custom window title bar (custom frame)
│   │   ├── TitleBar.css
│   │   ├── StatusBar.tsx         # Bottom info bar (cursor, git, etc.)
│   │   ├── StatusBar.css
│   │   ├── CommandPalette.tsx    # Cmd+Shift+P fuzzy search
│   │   ├── CommandPalette.css
│   │   │
│   │   ├── 📁 editor/           # Code editor components
│   │   │   ├── EditorArea.tsx    # Monaco editor + tabs + breadcrumbs
│   │   │   │   ├─ TabBar()       # File tabs (open, active, unsaved)
│   │   │   │   ├─ Breadcrumbs()  # File path visualization
│   │   │   │   └─ Monaco Editor  # Full IntelliSense, themes, languages
│   │   │   └── EditorArea.css
│   │   │
│   │   ├── 📁 ai/               # AI chat components
│   │   │   ├── AiPanel.tsx       # Main AI interface (chat, streaming)
│   │   │   │   ├─ MessageBubble()    # User/assistant message render
│   │   │   │   ├─ renderMarkdown()   # Convert MD to HTML
│   │   │   │   ├─ submitMessage()    # Send to Python WebSocket
│   │   │   │   └─ Animation logic    # Char-by-char typing effect
│   │   │   ├── AiPanel.css
│   │   │   ├── ChatModeSelector.tsx  # ask/plan/agent mode selector
│   │   │   ├── PromptEnhancer.tsx    # Auto-enhance prompts
│   │   │   ├── HistoryPanel.tsx      # View message history
│   │   │   └── SkillEngine.ts        # Skill detection + system prompt build
│   │   │
│   │   ├── 📁 sidebar/          # Left sidebar panels
│   │   │   ├── Sidebar.tsx       # Panel container + switcher
│   │   │   ├── FilesPanel.tsx    # File tree (open, create, delete)
│   │   │   ├── FilesPanel.css
│   │   │   ├── SearchPanel.tsx   # Full-text search UI + results
│   │   │   ├── GitPanel.tsx      # Git status + diff viewer
│   │   │   ├── ExtensionsPanel.tsx   # (Future: VS Code extensions)
│   │   │   └── SettingsPanel.tsx     # User preferences (API keys, etc.)
│   │   │
│   │   └── 📁 terminal/         # Terminal components
│   │       ├── TerminalPanel.tsx # xterm.js wrapper, multi-tab
│   │       │   ├─ useTerminal()  # Custom hook for PTY
│   │       │   ├─ TabBar()       # Terminal tab switcher
│   │       │   └─ xterm instance # Rendered shell
│   │       └── TerminalPanel.css
│   │
│   ├── 📁 stores/               # Zustand global state
│   │   ├── appStore.ts          # Main app state (files, AI, settings)
│   │   │   ├─ export types:     # OpenFile, AiMessage, Settings, etc.
│   │   │   ├─ useStore() hook   # Access + mutations
│   │   │   └─ Persisted via:    # electron-store (persistent storage)
│   │   │
│   │   └── historyStore.ts      # Message history (separate Zustand)
│   │
│   ├── 📁 skills/               # Skill registry & definitions
│   │   ├── skillRegistry.ts      # All skills with metadata
│   │   │   └─ Skill interface    # {id, name, description, triggers, ...}
│   │   │
│   │   └── designSkillRegistry.ts    # (Design-time skill definitions)
│   │
│   ├── 📁 themes/               # Theme system
│   │   └── themes.ts            # 16 themes + applyTheme() function
│   │       ├─ Define color maps # bg, fg, accent, editorBg, etc.
│   │       ├─ Apply to DOM      # CSS variables + Monaco API
│   │       └─ Apply to xterm    # Terminal color scheme
│   │
│   ├── 📁 styles/               # Global CSS
│   │   └── global.css           # Root layout, app-root, main-area, etc.
│   │
│   └── 📁 types/                # Type definitions
│       └── global.d.ts          # Window interface augmentation
│           ├─ Window.ipc        # IPC invoke method
│           └─ Window.electron   # Electron API types
│
├── 📁 electron/                 # Electron main process
│   ├── main.js                  # Entry point, window creation, IPC
│   │   ├─ createWindow()        # BrowserWindow creation
│   │   ├─ IPC Handlers:
│   │   │   ├─ window:*          # window control
│   │   │   ├─ fs:*              # file system ops
│   │   │   ├─ terminal:*        # PTY creation/write
│   │   │   ├─ git:*             # git operations
│   │   │   └─ search:*          # full-text search (Rust)
│   │   │
│   │   ├─ Python boot           # subprocess spawn python/main.py
│   │   └─ IPC event listeners   # Forward file/terminal events
│   │
│   └── preload.js               # Secure IPC bridge
│       └─ contextBridge.exposeInMainWorld()
│           └─ window.ipc object (invoke, on, off)
│
├── 📁 python/                   # Python FastAPI sidecar
│   ├── main.py                  # FastAPI app + WebSocket endpoint
│   │   ├─ /ws/chat              # WebSocket for streaming
│   │   │   ├─ Receive:  ChatRequest (messages, provider, model, etc.)
│   │   │   └─ Send:     Streaming chunks (SSE format)
│   │   │
│   │   ├─ /chat/stream          # HTTP streaming endpoint
│   │   ├─ /tools/execute        # Tool execution (file, shell, git, etc.)
│   │   ├─ /models/{provider}    # Fetch available models
│   │   ├─ /format               # Code formatting
│   │   └─ /lint                 # Code linting
│   │
│   │   ├─ Provider routing:     # Groq, Gemini, Ollama, Claude
│   │   ├─ Tool executor         # 11 agentic tools
│   │   └─ Token limit tracking  # Per-model max tokens
│   │
│   ├── requirements.txt         # Python dependencies
│   │   ├─ fastapi >= 0.110
│   │   ├─ uvicorn[standard]
│   │   ├─ httpx >= 0.26 (async HTTP)
│   │   ├─ pydantic >= 2.5
│   │   ├─ black >= 24 (formatting)
│   │   └─ pyflakes >= 3.2 (linting)
│   │
│   └── 📁 skills/               # Skill JSON definitions
│       ├── cuda-quantum.json     # Quantum computing skills
│       ├── nemotron-customize.json
│       ├── security-auditor.json # Security analysis
│       └── web-scraper.json      # Web scraping
│
├── 📁 crates/                   # Rust native modules
│   └── 📁 core/
│       ├── Cargo.toml           # Rust package config
│       │   ├─ [lib] crate-type = ["cdylib"]  # Compile to .dll/.so
│       │   ├─ Dependencies:
│       │   │   ├─ napi 2
│       │   │   ├─ napi-derive 2
│       │   │   ├─ ignore 0.4        # .gitignore support
│       │   │   ├─ regex 1            # Pattern matching
│       │   │   ├─ git2 0.18          # Git operations
│       │   │   ├─ serde 1            # Serialization
│       │   │   └─ notify 6           # File watching
│       │   │
│       │   └─ [build-dependencies]
│       │       └─ napi-build
│       │
│       ├── build.rs             # Build script (NAPI compilation)
│       │
│       ├── 📁 src/
│       │   └── lib.rs           # Rust implementation
│       │       ├─ walk_directory()    # FS traversal (respects .gitignore)
│       │       ├─ search_in_files()   # Full-text search (regex)
│       │       ├─ git_diff()          # Generate unified diff
│       │       ├─ file_watch()        # Watch for FS changes
│       │       └─ Attribute: #[napi]  # Expose to Node.js
│       │
│       └── 📁 target/
│           └── release/
│               └── codedroid_core.dll  # Compiled Windows addon
│                  (or .so on Linux, .dylib on macOS)
│
└── 📁 dist/                     # Build output (generated)
    ├── index.html               # Bundled HTML
    ├── 📁 assets/               # JS, CSS, fonts
    └── ... (Vite build artifacts)
```

---

## Key Component Flows

### **1. File Opening & Editing**

```typescript
// src/components/editor/EditorArea.tsx
function EditorArea() {
  const { openFiles, activeFileIndex, updateFileContent } = useStore()
  const file = openFiles[activeFileIndex]

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      updateFileContent(activeFileIndex, value)  // Mark dirty
    }
  }

  return (
    <div>
      <TabBar />  {/* Render open file tabs */}
      <Breadcrumbs />  {/* Show file path */}
      <Editor
        language={file.language}
        value={file.content}
        onChange={handleEditorChange}
        theme={useStore(s => s.theme).monacoTheme}
        options={{
          fontSize: useStore(s => s.settings.fontSize),
          tabSize: useStore(s => s.settings.tabSize),
          autoSave: useStore(s => s.settings.autoSave),
        }}
      />
    </div>
  )
}

// appStore.ts
const useStore = create<AppState & AppActions>(
  persist(
    (set) => ({
      updateFileContent: (index, content) => set(state => {
        const files = [...state.openFiles]
        files[index] = { ...files[index], content, isDirty: true }
        return { openFiles: files }
      }),

      saveFile: (index) => {
        const file = get().openFiles[index]
        invoke('fs:write-file', file.path, file.content)
          .then(() => {
            set(state => {
              const files = [...state.openFiles]
              files[index] = { ...files[index], isDirty: false }
              return { openFiles: files }
            })
          })
      },
    }),
    {
      name: 'codedroid-state',
      storage: electronStore,  // Persisted
    }
  )
)
```

### **2. AI Chat Streaming**

```typescript
// src/components/ai/AiPanel.tsx
async function submitMessage(userPrompt: string) {
  // 1. Add user message to store
  const userMsg: AiMessage = {
    id: generateId(),
    role: 'user',
    content: userPrompt,
    provider: settings.defaultAiProvider,
    timestamp: Date.now(),
    mode: chatMode,
  }
  addAiMessage(userMsg)

  // 2. Create assistant placeholder
  const assistantMsg: AiMessage = {
    id: generateId(),
    role: 'assistant',
    content: '',
    provider: settings.defaultAiProvider,
    timestamp: Date.now(),
    isStreaming: true,
  }
  addAiMessage(assistantMsg)

  // 3. Open WebSocket to Python sidecar
  const ws = new WebSocket('ws://localhost:8000/ws/chat')
  ws.onopen = () => {
    ws.send(JSON.stringify({
      messages: [{ role: 'user', content: userPrompt }],
      provider: settings.defaultAiProvider,
      model: settings.defaultAiModel,
      api_key: settings.groqKey,  // If Groq selected
      mode: chatMode,
      skills: detectedSkills,
    }))
  }

  // 4. Stream chunks
  ws.onmessage = (event) => {
    const { type, content } = JSON.parse(event.data)
    if (type === 'chunk') {
      updateMessage(assistantMsg.id, {
        content: assistantMsg.content + content,
      })
      // React re-renders, MessageBubble animates char-by-char
    }
    if (type === 'done') {
      updateMessage(assistantMsg.id, { isStreaming: false })
      ws.close()
    }
  }
}

// python/main.py
@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
  await websocket.accept()
  data = await websocket.receive_json()
  
  # Route to provider
  if data['provider'] == 'groq':
    stream = groq_client.chat.completions.create(
      model=data['model'],
      messages=data['messages'],
      stream=True
    )
  
  # Stream chunks back
  for chunk in stream:
    content = chunk.choices[0].delta.content
    await websocket.send_json({
      'type': 'chunk',
      'content': content
    })
  
  await websocket.send_json({'type': 'done'})
```

### **3. File Search (Rust Addon)**

```typescript
// src/components/sidebar/SearchPanel.tsx
function SearchPanel() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])

  const handleSearch = async (q: string) => {
    setQuery(q)
    const results = await invoke('search:full-text', {
      dir: projectRoot,
      query: q,
      caseSensitive: false,
      useRegex: q.startsWith('/'),  // /regex/ syntax
    })
    setResults(results)
  }

  return (
    <div>
      <input onChange={e => handleSearch(e.target.value)} />
      {results.map(r => (
        <div
          key={`${r.filePath}:${r.lineNumber}`}
          onClick={() => openFile(r.filePath, r.lineNumber)}
        >
          {r.filePath}:{r.lineNumber}
          <span style={{
            color: 'var(--match)',
            background: 'var(--match-bg)',
          }}>
            {r.lineContent.substring(r.matchStart, r.matchEnd)}
          </span>
        </div>
      ))}
    </div>
  )
}

// electron/main.js
ipcMain.handle('search:full-text', async (_, { dir, query, caseSensitive, useRegex }) => {
  // Delegate to Rust addon
  const { searchInFiles } = require('./crates/core/build/Release/codedroid_core.node')
  return searchInFiles(dir, query, caseSensitive, useRegex)
})

// crates/core/src/lib.rs
#[napi]
pub fn search_in_files(
  dir: String,
  query: String,
  case_sensitive: Option<bool>,
  use_regex: Option<bool>,
) -> Result<Vec<SearchResult>> {
  use regex::RegexBuilder;

  let pattern = if use_regex.unwrap_or(false) {
    query
  } else {
    regex::escape(&query)
  };

  let re = RegexBuilder::new(&pattern)
    .case_insensitive(!case_sensitive.unwrap_or(false))
    .build()?;

  let mut results = Vec::new();
  for entry in ignore::WalkBuilder::new(&dir).build() {
    if let Ok(e) = entry {
      // Read file, search for pattern
      if let Ok(content) = std::fs::read_to_string(e.path()) {
        for (line_num, line) in content.lines().enumerate() {
          for m in re.find_iter(line) {
            results.push(SearchResult {
              file_path: e.path().to_string_lossy().to_string(),
              line_number: (line_num + 1) as u32,
              line_content: line.to_string(),
              match_start: m.start() as u32,
              match_end: m.end() as u32,
            });
          }
        }
      }
    }
  }
  Ok(results)
}
```

### **4. Terminal Multi-Tab**

```typescript
// src/components/terminal/TerminalPanel.tsx
function TerminalPanel() {
  const [tabs, setTabs] = useState<TerminalTabDef[]>([
    { id: 'term-1', name: 'bash', cwd: projectRoot }
  ])
  const [activeTabId, setActiveTabId] = useState('term-1')
  const xterm_instances = useRef<Map<string, Terminal>>(new Map())

  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (!activeTab) return

    // Create PTY via IPC
    invoke('terminal:create-pty', {
      cwd: activeTab.cwd,
      env: { ...process.env },
    }).then(({ pid }) => {
      // Create xterm.js instance
      const term = new Terminal()
      term.open(document.getElementById(`terminal-${activeTabId}`))
      xterm_instances.current.set(activeTabId, term)

      // Data -> PTY
      term.onData(data => {
        invoke('terminal:write', { pid, data })
      })

      // PTY -> xterm
      on('terminal:data', ({ pid: p, data }) => {
        if (p === pid) term.write(data)
      })
    })
  }, [activeTabId])

  return (
    <div>
      <TabBar tabs={tabs} activeTabId={activeTabId} />
      {tabs.map(tab => (
        <div
          key={tab.id}
          id={`terminal-${tab.id}`}
          style={{ display: activeTabId === tab.id ? 'block' : 'none' }}
        />
      ))}
    </div>
  )
}

// electron/main.js
const { spawn } = require('child_process')
const pty = require('node-pty')

ipcMain.handle('terminal:create-pty', async (_, { cwd, env }) => {
  const shell = process.platform === 'win32' ? 'powershell' : 'bash'
  const ptyProcess = pty.spawn(shell, [], {
    name: 'xterm-color',
    cwd,
    env,
  })

  const pid = ptyProcess.pid
  ptyStore.set(pid, ptyProcess)

  // Emit data events
  ptyProcess.onData(data => {
    mainWindow.webContents.send('terminal:data', { pid, data })
  })

  return { pid }
})

ipcMain.handle('terminal:write', async (_, { pid, data }) => {
  const pty = ptyStore.get(pid)
  if (pty) pty.write(data)
})
```

---

## Important Implementation Details

### **State Management Pattern (Zustand)**

```typescript
// appStore.ts
interface AppState {
  // Data
  openFiles: OpenFile[]
  activeFileIndex: number
  messages: AiMessage[]
  settings: Settings

  // Actions
  openFile: (path: string) => void
  closeFile: (index: number) => void
  setActiveFile: (index: number) => void
  updateFileContent: (index: number, content: string) => void
  saveFile: (index: number) => void
  addAiMessage: (msg: AiMessage) => void
  updateMessage: (id: string, partial: Partial<AiMessage>) => void
  updateSettings: (partial: Partial<Settings>) => void
  fetchModels: (provider: AiProvider) => void
}

// Zustand create()
const useStore = create<AppState>(
  persist(
    (set, get) => ({
      // Initial state
      openFiles: [],
      activeFileIndex: 0,
      messages: [],
      settings: {
        groqKey: '',
        themeId: 'dracula',
        // ... all defaults
      },

      // Actions
      openFile: (path: string) => set(state => ({
        openFiles: [
          ...state.openFiles,
          { path, name: basename(path), content: '', ... }
        ]
      })),

      // Persist via electron-store
    }),
    {
      name: 'codedroid-state',
      storage: {
        getItem: (name) => ({
          state: electronStore.get(name)
        }),
        setItem: (name, value) => {
          electronStore.set(name, value.state)
        },
      }
    }
  )
)
```

### **IPC Type Safety Pattern**

```typescript
// src/types/global.d.ts
export {}

declare global {
  interface Window {
    ipc: {
      invoke: (channel: string, ...args: any[]) => Promise<any>
      on: (channel: string, listener: (event: any, args: any) => void) => void
      off: (channel: string, listener: Function) => void
    }
  }
}

// Usage in React
const invoke = window.ipc.invoke
const { ok, content, error } = await invoke('fs:read-file', filePath)

// electron/preload.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('ipc', {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  off: (channel, listener) => ipcRenderer.off(channel, listener),
})
```

### **Monaco Editor Integration**

```typescript
// Editor options from settings
<Editor
  defaultLanguage={file.language}
  defaultValue={file.content}
  theme={themeMap[currentTheme.id]}  // 'vs-dark', 'vs', custom, etc.
  onChange={handleChange}
  options={{
    // Editor behavior
    fontSize: settings.fontSize,
    tabSize: settings.tabSize,
    insertSpaces: true,
    wordWrap: 'on',
    minimap: { enabled: false },

    // IntelliSense
    automaticLayout: true,
    codeLens: true,
    formatOnSave: true,
    defaultFormatter: 'esbenp.prettier-vscode',

    // Display
    lineNumbers: 'on',
    scrollBeyondLastLine: false,
    renderWhitespace: 'selection',
  }}
/>

// Custom language registration (if needed)
import * as monaco from 'monaco-editor'
monaco.languages.register({ id: 'custom-lang' })
monaco.languages.setMonarchTokensProvider('custom-lang', {
  tokenizer: { root: [[/\d+/, 'number']] },
})
```

---

## Development Patterns

### **Adding a New Component**

1. **Create file** in `src/components/{category}/NewComponent.tsx`
2. **Add styles** in `src/components/{category}/NewComponent.css`
3. **Use Zustand hooks** for state:
   ```typescript
   const { openFiles, updateSettings } = useStore()
   ```
4. **Export from App.tsx** and place in layout
5. **Add keyboard shortcuts** if needed to `App.tsx` handleKeyDown

### **Adding a New AI Slash Command**

1. **Define in** `SLASH_COMMANDS` array in `AiPanel.tsx`
2. **Update** `SkillEngine.ts` to detect triggers
3. **Build system prompt** that includes command description
4. **Optionally add Python tool** in `python/main.py` for agentic execution

### **Adding a New Rust Function**

1. **Define in** `crates/core/src/lib.rs` with `#[napi]` attribute
2. **Build**: `npm run rebuild`
3. **Expose via IPC**: Add handler in `electron/main.js`
4. **Call from React**: `invoke('my-rust-function', args)`

### **Persisting User Data**

- Zustand store + electron-store automatically
- No manual localStorage needed
- Data saved to `~/.config/codedroid/` (Linux) or Windows equivalent

---

## Common Tasks

### **Changing UI Colors**

1. Edit `src/themes/themes.ts`
2. Add color to theme object
3. Use CSS variable: `var(--new-color)`
4. Apply theme: `applyTheme(newTheme)`

### **Adding New Terminal Feature**

1. Use `invoke('terminal:create-pty', ...)` or write
2. Listen to `on('terminal:data', ...)`
3. Update xterm instance

### **Debugging Python Sidecar**

1. Set `DEBUG=1` in subprocess
2. Check console output in Electron DevTools
3. Or attach debugger: `python -m debugpy --listen localhost:5678 main.py`

### **Performance Profiling**

- React DevTools: Check re-render rates
- Chrome DevTools: Performance tab
- Rust addon: Add `eprintln!()` for tracing

---

**Last Updated**: 2026-06-13 | **Version**: 3.0.0
