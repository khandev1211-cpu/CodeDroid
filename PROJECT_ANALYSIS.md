# 🚀 CodeDroid v3.0.0 - Full Project Analysis

**Status**: AI-powered desktop IDE | **License**: MIT | **Multi-platform**: Windows · macOS · Linux

---

## 📋 Project Overview

CodeDroid v3 is a **fully-featured, AI-native desktop IDE** that combines:
- **4 AI Providers** (Groq, Gemini, Ollama, Claude) with real-time streaming
- **Monaco Editor** (VS Code's core engine) for professional code editing
- **Rust Native Engine** for high-performance FS operations, search, and git
- **16 Themes** (8 classic + 6 exclusive originals)
- **11 Agentic Tools** for code analysis, testing, documentation, optimization
- **8 Slash Commands** (/fix, /explain, /refactor, /tests, /docs, /optimize, /review, /types)
- **Multi-tab Terminal** (xterm.js) with cross-platform support
- **Git Integration** via git2 library with diff operations
- **Full-text Search** with regex support (ripgrep-style)
- **File Explorer** with .gitignore respecting directory walking

**Version**: 3.0.0 (rewrite from Flutter → TypeScript + Python + Rust)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Electron 29 (Main Process)                    │
│  • Window management, IPC bridge, file dialogs, Python sidecar  │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
┌───────▼──────────┐    ┌────────▼───────┐
│ Renderer Process │    │  Python Sidecar│
│  (React + Vite)  │◄──►│   (FastAPI)     │
│                  │    │  + WebSocket    │
│ • TypeScript     │    │                 │
│ • React 18       │    │ • AI Streaming  │
│ • Monaco Editor  │    │ • Tool Exec     │
│ • Zustand Store  │    │ • Model Mgmt    │
│ • xterm.js       │    │ • Formatting    │
└──────────────────┘    └────────┬────────┘
                                  │
                        ┌─────────▼─────────┐
                        │  Rust Native Addon│
                        │   (napi-rs)       │
                        │                   │
                        │ • FS walking      │
                        │ • Full-text search│
                        │ • git2 operations │
                        └───────────────────┘
```

---

## 📁 Project Structure

### **`src/` — React + TypeScript Frontend**

```
src/
├── main.tsx                  # React entry point (ReactDOM.render)
├── App.tsx                   # Root component, keyboard shortcuts, theme setup
├── components/
│   ├── ActivityBar.tsx       # Left activity bar (Files, Search, Git, etc.)
│   ├── TitleBar.tsx          # Custom window title bar (minimize, maximize, close)
│   ├── StatusBar.tsx         # Bottom status bar (cursor pos, file info)
│   ├── CommandPalette.tsx    # Cmd+Shift+P command palette
│   ├── ai/
│   │   ├── AiPanel.tsx       # Main AI chat interface (streaming, modes)
│   │   ├── ChatModeSelector.tsx  # Switch between "ask", "plan", "agent"
│   │   ├── PromptEnhancer.tsx    # Auto-enhance prompts with context
│   │   ├── HistoryPanel.tsx      # View/restore message history
│   │   └── SkillEngine.ts        # Detect applicable skills, build system prompt
│   ├── editor/
│   │   └── EditorArea.tsx    # Monaco editor, tabs, breadcrumbs, splits
│   ├── sidebar/
│   │   ├── Sidebar.tsx       # Panel switcher
│   │   ├── FilesPanel.tsx    # File tree (open folder, create, delete)
│   │   ├── SearchPanel.tsx   # Full-text search UI
│   │   ├── GitPanel.tsx      # Git status, diff viewer, staging
│   │   ├── ExtensionsPanel.tsx   # (Placeholder for extensions)
│   │   └── SettingsPanel.tsx     # User preferences (API keys, theme, etc.)
│   └── terminal/
│       └── TerminalPanel.tsx # xterm.js multi-tab terminal
├── stores/
│   ├── appStore.ts           # Zustand global state (files, AI, settings)
│   └── historyStore.ts       # Message history persistence
├── skills/
│   ├── skillRegistry.ts      # All available skills database
│   └── designSkillRegistry.ts    # (Possibly skill metadata)
├── themes/
│   └── themes.ts             # 16 theme definitions, applyTheme()
├── styles/
│   └── global.css            # Root styles
└── types/
    └── global.d.ts           # Window API types, IPC types
```

**Key Components & Features:**
- **EditorArea**: Monaco editor with tab bar, breadcrumbs, split support
- **AiPanel**: Chat interface with 3 modes (ask, plan, agent), 8 slash commands
- **Sidebar**: Tabbed panels (Files, Search, Git, Settings, Extensions)
- **TerminalPanel**: Multi-tab xterm.js terminal with PTY support
- **CommandPalette**: Fuzzy command search (Cmd+Shift+P)
- **StatusBar**: Real-time cursor position, file encoding, git status

---

### **`electron/` — Electron Main Process**

```
electron/
├── main.js              # Window creation, IPC handlers, Python sidecar boot
└── preload.js           # Safe IPC bridge (contextBridge, contextualizedAPI)
```

**IPC Handlers:**
- **Window Control**: `window:minimize`, `window:maximize`, `window:close`
- **File System**: `fs:read-file`, `fs:write-file`, `fs:read-dir`, `fs:open-folder`, `fs:open-file`
- **Terminal**: PTY creation via `node-pty`
- **Search**: Delegated to Rust addon
- **Git**: Delegated to Rust addon

---

### **`python/` — FastAPI AI Sidecar**

```
python/
├── main.py              # FastAPI server + WebSocket streaming
└── requirements.txt     # FastAPI, Pydantic, httpx, uvicorn, black, pyflakes
```

**Endpoints & WebSocket:**
- **`POST /chat/stream`**: Stream AI responses (Groq, Gemini, Ollama, Claude)
- **`WebSocket /ws/chat`**: Real-time streaming + agentic tool execution
- **`POST /tools/execute`**: Run agentic tools (file ops, git, shell, etc.)
- **`GET /models/{provider}`**: Fetch available models
- **`POST /format`**: Code formatting (black for Python, custom for others)
- **`POST /lint`**: Code linting (pyflakes for Python)

**AI Providers:**
| Provider | Streaming | Max Tokens | Status |
|---|---|---|---|
| **Groq** | ✅ SSE | 8K-32K | Production |
| **Gemini** | ✅ Batch | Unlimited | Production |
| **Ollama** | ✅ Local | Model-dependent | Production |
| **Claude** | ✅ (Planned) | 200K | In development |

**Agentic Tools (11 total):**
- `file_read`, `file_write`, `file_delete`
- `run_shell_command`
- `git_commit`, `git_pull`, `git_push`
- `npm_install`, `pip_install`
- `docker_build`, `docker_run`

---

### **`crates/core/` — Rust NAPI Native Addon**

```
crates/core/
├── src/
│   └── lib.rs               # Rust implementation (napi-rs)
├── build.rs                 # Build script
└── Cargo.toml               # Rust dependencies
```

**Dependencies:**
- `napi` 2.x — Node.js native binding framework
- `ignore` 0.4 — Fast .gitignore-aware directory walking
- `regex` 1.x — Pattern matching (ripgrep-style)
- `git2` 0.18 — Git operations (with vendored libgit2)
- `serde` 1.x — JSON serialization

**Exposed Functions:**

1. **`walk_directory(dir: String, max_depth: Option<u32>) → Vec<String>`**
   - Recursively walk directory respecting .gitignore
   - Returns all file paths

2. **`search_in_files(dir, query, case_sensitive?, use_regex?) → Vec<SearchResult>`**
   - Fast full-text search across directory
   - Supports regex patterns
   - Returns file path, line number, content, match offsets

3. **`git_diff(repo_path, file_path) → String`**
   - Generate unified diff for a file
   - Shows staged vs. working tree changes

4. **File watching** (via `notify` crate)
   - Detect file system changes in real-time
   - Emit events to renderer

---

## 🔄 Data Flow & State Management

### **Global State (Zustand Store)**

```typescript
// appStore.ts
export interface Settings {
  // AI Config
  groqKey: string
  geminiKey: string
  ollamaHost: string
  claudeKey: string
  defaultAiProvider: AiProvider
  defaultAiModel: string
  
  // UI
  themeId: string
  sidebarWidth: number
  aiPanelWidth: number
  terminalHeight: number
  showSidebar: boolean
  showAiPanel: boolean
  showTerminal: boolean
  showStatusBar: boolean
  showBreadcrumbs: boolean
  
  // Editor
  fontSize: number
  fontFamily: string
  tabSize: number
  autoSave: boolean
  
  // Terminal
  terminalFontSize: number
  terminalTheme: string
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  provider: AiProvider
  timestamp: number
  isStreaming?: boolean
  mode?: ChatMode  // 'ask' | 'plan' | 'agent'
  appliedSkills?: string[]
  agentSteps?: AgentStep[]
  planSteps?: PlanStep[]
}

export interface OpenFile {
  path: string
  name: string
  content: string
  language: string
  isDirty: boolean
  cursorLine: number
  cursorCol: number
  scrollTop: number
  splitGroup?: 0 | 1
}
```

**Store Hooks:**
- `setActiveFile(index)` — Switch active editor tab
- `openFile(path)` — Load file into editor
- `closeFile(index)` — Close tab
- `saveFile(index)` — Persist to disk
- `updateFileContent(index, content)` — Edit buffer
- `addAiMessage(message)` — Add AI response to chat
- `updateSettings(partial)` — Merge settings
- `fetchModels(provider)` — Async fetch available models

### **Message Streaming Flow**

```
User Input (React)
    ↓
AiPanel.tsx (collect prompt, context, mode, skills)
    ↓
WebSocket → Python Sidecar
    ↓
FastAPI /ws/chat (route by provider)
    ↓
AI Provider (Groq/Gemini/Ollama/Claude)
    ↓
Streaming SSE/Server-Sent-Events
    ↓
WebSocket → React (append to displayedContent)
    ↓
AiPanel UI updates (character-by-character animation)
```

---

## 🎨 UI/UX Architecture

### **Layout Structure**

```
┌─────────────────────────────────────────────────────────┐
│                    TitleBar (Custom)                     │
├─┬───────────────────────────────────────────────────────┤
│A│                    EditorArea                      │AI │
│c│ ┌─────────────────────────────────────────────────┤Pa│
│t│ │ TabBar (open files, active indicator)           │ne│
│i│ ├─────────────────────────────────────────────────┤l │
│v│ │ Breadcrumbs (file path)                         │  │
│i│ ├─────────────────────────────────────────────────┤  │
│t│ │                                                 │  │
│y│ │          Monaco Editor (Code)                   │  │
│B│ │   (full IntelliSense, themes, syntax)          │  │
│a│ │                                                 │  │
│r│ ├─────────────────────────────────────────────────┤  │
│ │ │          TerminalPanel (xterm.js)              │  │
│ │ │   (multi-tab PTY, shell integration)           │  │
│ └─────────────────────────────────────────────────────┘
├─────────────────────────────────────────────────────────┤
│                  StatusBar (Info)                        │
└─────────────────────────────────────────────────────────┘

Sidebar (when visible):
├─ Files Panel
├─ Search Panel
├─ Git Panel
├─ Extensions Panel
└─ Settings Panel
```

### **Keyboard Shortcuts**

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save active file |
| `Ctrl+Shift+S` | Save all files |
| `Ctrl+Shift+P` | Open command palette |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+J` | Toggle terminal |
| `Escape` | Close modals (cmd palette, etc.) |

### **Themes**

16 total themes:
- **8 Classic**: VS Code-inspired (Dark, Light, Solarized, Dracula, Gruvbox, Nord, etc.)
- **6 Originals**: CodeDroid-exclusive designs

Theme system:
```typescript
// themes.ts
interface Theme {
  id: string
  label: string
  colors: {
    bg: string
    fg: string
    accent: string
    editorBg: string
    editorFg: string
    // ... 20+ color properties
  }
}

export function applyTheme(theme: Theme) {
  // Set CSS variables, Monaco theme, xterm.js theme
}
```

---

## 🤖 AI & Agentic System

### **Chat Modes**

1. **Ask Mode** (`mode: 'ask'`)
   - Simple Q&A with AI
   - No tool execution
   - Direct streaming response

2. **Plan Mode** (`mode: 'plan'`)
   - AI generates multi-step plan
   - Each step rendered with status (pending → running → completed)
   - User can execute steps or ask AI to refine

3. **Agent Mode** (`mode: 'agent'`)
   - AI autonomously executes agentic tools
   - Real-time tool invocation feedback
   - Can iterate on results

### **Slash Commands**

Built-in prompt shortcuts:
- `/fix` → "Fix bugs in selected code"
- `/explain` → "Explain this code"
- `/refactor` → "Refactor for clarity & performance"
- `/tests` → "Generate unit tests"
- `/docs` → "Generate documentation"
- `/optimize` → "Optimize for performance"
- `/review` → "Code review with suggestions"
- `/types` → "Add TypeScript types"

### **Skill Engine**

```typescript
// SkillEngine.ts
export function detectSkills(prompt: string, fileContent: string): Skill[] {
  // Analyze prompt + file content
  // Match against skillRegistry.ts
  // Return applicable skills
}

export function buildSystemPrompt(provider: AiProvider, skills: Skill[]): string {
  // Construct provider-specific system prompt
  // Include skill descriptions
  // Add code context, file info, etc.
}
```

**Skills** are JSON-defined tools (in `python/skills/`):
- `cuda-quantum.json` — Quantum computing helpers
- `nemotron-customize.json` — Model customization
- `security-auditor.json` — Security analysis
- `web-scraper.json` — Web scraping utilities

---

## 📦 Tech Stack Summary

| Layer | Technology | Version |
|---|---|---|
| **Shell** | Electron | 29.4.6 |
| **UI Framework** | React | 18.2.0 |
| **Build Tool** | Vite | 5.1.6 |
| **Language** | TypeScript | 5.3.3 |
| **Editor** | Monaco Editor | 0.45.0 |
| **Terminal** | xterm.js | 5.5.0 |
| **State** | Zustand | 4.5.0 |
| **Icons** | Lucide React | 0.344.0 |
| **Backend** | FastAPI | 0.110.0+ |
| **Backend Language** | Python | 3.10+ |
| **PTY** | node-pty | 1.1.0 |
| **Native Module** | Rust + napi-rs | 2.x |
| **Store** | electron-store | 8.1.0 |

---

## 🔌 IPC & API Contracts

### **Electron IPC (Main ↔ Renderer)**

```typescript
// Type-safe IPC handlers

// Window
invoke('window:minimize')
invoke('window:maximize')
invoke('window:close')

// File System
invoke('fs:read-file', filePath) → { ok, content, error? }
invoke('fs:write-file', filePath, content) → { ok, error? }
invoke('fs:read-dir', dirPath) → { ok, entries: [{name, path, isDir}] }
invoke('fs:open-folder') → filePath | null
invoke('fs:open-file') → filePath | null

// Terminal
invoke('terminal:create-pty', {cwd, env}) → { pid, fd }
invoke('terminal:resize', {pid, cols, rows})
invoke('terminal:write', {pid, data})
on('terminal:data', {pid, data})

// Git
invoke('git:get-status', repoPath) → [{path, status, staged}]
invoke('git:diff', {repoPath, filePath}) → diffText

// Search
invoke('search:full-text', {dir, query, caseSensitive?, useRegex?}) → [SearchResult]
```

### **Python WebSocket API**

```python
# /ws/chat
# Client → Server (JSON)
{
  "type": "message",
  "messages": [{"role": "user", "content": "..."}],
  "provider": "groq",
  "model": "llama3-70b",
  "mode": "ask",
  "api_key": "...",
  "skills": ["security-auditor"]
}

# Server → Client (SSE streamed JSON lines)
{"type": "chunk", "content": "Here"}
{"type": "chunk", "content": " is"}
{"type": "chunk", "content": " the"}
...
{"type": "done", "content": "Here is the answer"}

# Tool execution
{"type": "tool", "tool": "run_shell_command", "args": {"cmd": "npm install"}}
{"type": "tool_result", "result": "npm output..."}
```

---

## 🚀 Development Workflow

### **Build & Run**

```bash
# Install dependencies
npm install
pip install -r python/requirements.txt

# Development (hot reload)
npm run dev
# Runs: Vite dev server + Electron dev process

# Production build
npm run build
# Outputs: dist/index.html + compiled JS

# Rebuild native Rust addon
npm run rebuild
```

### **File Watching & Hot Reload**

- **Frontend**: Vite HMR (React components auto-refresh)
- **Rust**: `npm run rebuild` required (C++ compilation)
- **Python**: Sidecar auto-restarts via Electron IPC

### **Debugging**

- **React DevTools**: Available in dev mode
- **Chrome DevTools**: Press F12 in Electron window
- **Python Sidecar**: `--debug` flag available
- **Electron**: Inspect in Chrome at `chrome://inspect`

---

## 🐛 Key Dependencies & Configurations

### **Vite Config** (vite.config.ts)
- React plugin (@vitejs/plugin-react)
- Build output: dist/
- Dev server: localhost:5173

### **TypeScript Config** (tsconfig.json)
- Target: ES2020
- Module: ESM
- Strict mode enabled
- JSX: react-jsx

### **Rust Cargo.toml**
- Edition: 2021
- WASM/NAPI compilation

---

## 📊 Component Dependency Graph

```
App.tsx (root)
├─ TitleBar
├─ ActivityBar
├─ Sidebar
│  ├─ FilesPanel
│  ├─ SearchPanel
│  ├─ GitPanel
│  ├─ ExtensionsPanel
│  └─ SettingsPanel
├─ EditorArea
│  ├─ TabBar
│  ├─ Breadcrumbs
│  └─ Monaco Editor
├─ TerminalPanel
│  └─ xterm.js
├─ AiPanel
│  ├─ ChatModeSelector
│  ├─ PromptEnhancer
│  ├─ HistoryPanel
│  └─ MessageBubbles (streaming)
├─ StatusBar
└─ CommandPalette
    └─ Fuzzy search

Global State (Zustand)
├─ appStore (files, AI, settings)
└─ historyStore (message history)
```

---

## 🔒 Security & Architecture Decisions

1. **Context Isolation** (Electron)
   - preload.js uses `contextBridge`
   - No direct `node` access from renderer
   - All IPC is explicit (invoke/handle)

2. **Python Sidecar**
   - Separate process (subprocess from Electron)
   - WebSocket for real-time communication
   - CORS enabled for development

3. **Rust Native Addon**
   - Compiled C++ via napi-rs
   - Blocking operations (FS, git) don't freeze UI
   - Type-safe Node.js bindings

---

## 📈 Performance Optimizations

1. **File Searching**
   - Rust implementation for O(1) speed on large repos
   - .gitignore-aware filtering
   - Parallel regex matching

2. **Streaming AI**
   - Character-by-character animation in React
   - Dynamic step sizing (fast append when behind, slow when caught up)
   - No UI blocking during long API calls

3. **Editor**
   - Monaco's built-in IntelliSense caching
   - Lazy-loaded language definitions
   - Virtual scrolling for large files

4. **Zustand State**
   - Minimal re-renders (selector-based)
   - Persistent settings via electron-store

---

## 🎯 Current Status & Next Steps

**Completed:**
- ✅ Electron + React frontend
- ✅ Monaco editor integration
- ✅ 4 AI providers + streaming
- ✅ Rust native addon (FS, search, git)
- ✅ Python FastAPI sidecar
- ✅ Multi-tab terminal (xterm.js)
- ✅ 16 themes
- ✅ Global state management

**In Progress/Planned:**
- 🔄 Claude provider integration (v3.1)
- 🔄 VS Code extension support (v3.2)
- 🔄 Database integration (SQLite backend)
- 🔄 Plugin system (extensible agentic tools)
- 🔄 Performance profiling & optimization

---

## 📚 Key Files Reference

| File | Purpose |
|---|---|
| [src/App.tsx](src/App.tsx) | Root component, keyboard shortcuts |
| [src/stores/appStore.ts](src/stores/appStore.ts) | Zustand global state |
| [src/components/ai/AiPanel.tsx](src/components/ai/AiPanel.tsx) | AI chat UI |
| [src/components/editor/EditorArea.tsx](src/components/editor/EditorArea.tsx) | Editor + tabs |
| [electron/main.js](electron/main.js) | Electron main process |
| [python/main.py](python/main.py) | FastAPI sidecar |
| [crates/core/src/lib.rs](crates/core/src/lib.rs) | Rust native addon |
| [src/themes/themes.ts](src/themes/themes.ts) | Theme definitions |
| [src/skills/skillRegistry.ts](src/skills/skillRegistry.ts) | Skill definitions |

---

**Generated**: 2026-06-13 | **Version**: 3.0.0
