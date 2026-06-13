# CodeDroid Architecture Diagram

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         CODEDROID v3.0.0 SYSTEM DIAGRAM                      │
└──────────────────────────────────────────────────────────────────────────────┘

                         ┌─────────────────────────────┐
                         │   User / OS (Windows/Mac)   │
                         └──────────────┬──────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │   Electron 29 Main Process  │
                         │  • Window management        │
                         │  • IPC bridge               │
                         │  • File dialogs             │
                         │  • Python boot              │
                         └──────┬──────────────┬───────┘
                                │              │
                ┌───────────────┘              └────────────────┐
                │                                               │
    ┌───────────▼──────────────────────┐      ┌───────────────▼───────┐
    │  RENDERER PROCESS                │      │ PYTHON SIDECAR        │
    │  (React + TypeScript + Vite)     │      │ (FastAPI)             │
    │                                   │      │                       │
    │ ┌─────────────────────────────┐ │      │ ┌───────────────────┐ │
    │ │  React Components (JSX)     │ │      │ │ /ws/chat          │ │
    │ │                             │ │      │ │ (WebSocket)       │ │
    │ │  App.tsx (Root)             │ │      │ │                   │ │
    │ │  ├─ TitleBar                │ │      │ │ AI Providers:     │ │
    │ │  ├─ ActivityBar             │ │      │ │ • Groq            │ │
    │ │  ├─ Sidebar (tabbed)        │ │      │ │ • Gemini          │ │
    │ │  │ ├─ FilesPanel           │ │      │ │ • Ollama          │ │
    │ │  │ ├─ SearchPanel          │ │      │ │ • Claude (WIP)    │ │
    │ │  │ ├─ GitPanel             │ │      │ │                   │ │
    │ │  │ ├─ SettingsPanel        │ │      │ │ Tool Executor:    │ │
    │ │  │ └─ ExtensionsPanel      │ │      │ │ • file_*          │ │
    │ │  ├─ EditorArea             │ │      │ │ • run_shell       │ │
    │ │  │ ├─ TabBar               │ │      │ │ • git_*           │ │
    │ │  │ ├─ Breadcrumbs          │ │      │ │ • npm/pip_*       │ │
    │ │  │ └─ Monaco Editor        │ │      │ │ • docker_*        │ │
    │ │  ├─ TerminalPanel          │ │      │ │                   │ │
    │ │  │ └─ xterm.js (multi-tab) │ │      │ │ Model Manager:    │ │
    │ │  ├─ AiPanel                │ │      │ │ • /models/{prov}  │ │
    │ │  │ ├─ ChatModeSelector     │ │      │ │                   │ │
    │ │  │ ├─ PromptEnhancer       │ │      │ │ Utilities:        │ │
    │ │  │ ├─ HistoryPanel         │ │      │ │ • /format         │ │
    │ │  │ └─ MessageBubbles       │ │      │ │ • /lint           │ │
    │ │  ├─ StatusBar              │ │      │ │                   │ │
    │ │  └─ CommandPalette         │ │      │ └───────────────────┘ │
    │ │                             │ │      │                       │
    │ └─────────────────────────────┘ │      └───────────────────────┘
    │                                   │
    │ ┌─────────────────────────────┐ │
    │ │ Global State (Zustand)      │ │
    │ │                             │ │
    │ │ appStore.ts:                │ │
    │ │ • openFiles[]               │ │
    │ │ • messages[]                │ │
    │ │ • settings: {               │ │
    │ │   - theme, fontSize,        │ │
    │ │   - API keys                │ │
    │ │   - sidebarWidth,           │ │
    │ │   - terminalHeight          │ │
    │ │ }                           │ │
    │ │ • actions (setActiveFile,   │ │
    │ │   saveFile, etc.)           │ │
    │ │                             │ │
    │ │ historyStore.ts:            │ │
    │ │ • messageHistory            │ │
    │ │ • searchHistory             │ │
    │ │                             │ │
    │ └─────────────────────────────┘ │
    │                                   │
    │ ┌─────────────────────────────┐ │
    │ │ Styling & Themes            │ │
    │ │                             │ │
    │ │ themes.ts (16 themes):      │ │
    │ │ • 8 Classic (Dark, Light,   │ │
    │ │   Solarized, Dracula, etc.) │ │
    │ │ • 6 Originals (exclusive)   │ │
    │ │                             │ │
    │ │ global.css (layout)         │ │
    │ │ + Component CSS files       │ │
    │ │                             │ │
    │ └─────────────────────────────┘ │
    │                                   │
    │ ┌─────────────────────────────┐ │
    │ │ Type Definitions            │ │
    │ │                             │ │
    │ │ appStore.ts:                │ │
    │ │ • OpenFile                  │ │
    │ │ • AiMessage                 │ │
    │ │ • AgentStep, PlanStep       │ │
    │ │ • Settings                  │ │
    │ │ • GitFileStatus             │ │
    │ │                             │ │
    │ │ global.d.ts:                │ │
    │ │ • Window.ipc                │ │
    │ │ • Window.electron           │ │
    │ │                             │ │
    │ └─────────────────────────────┘ │
    │                                   │
    └─────────────────────────────┬─────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
    ┌───────────▼─────────┐  ┌────▼──────┐   ┌────▼──────────────┐
    │  Electron IPC       │  │   Browser  │   │  File System / OS │
    │  (Main ↔ Renderer)  │  │   APIs     │   │                   │
    │                     │  │            │   │ - fs module       │
    │ fs:*                │  │ - Drag/drop│   │ - PTY (node-pty)  │
    │ window:*            │  │ - Clipboard│   │ - Dialog boxes    │
    │ terminal:*          │  │ - Keyboard │   │ - Env vars        │
    │ git:*               │  │ - Network  │   │                   │
    │ search:*            │  │            │   │                   │
    │                     │  └────────────┘   └───────────────────┘
    └─────────────────────┘
                │
                │
    ┌───────────▼──────────────────────────┐
    │  RUST NATIVE ADDON (NAPI)            │
    │  (crates/core/src/lib.rs)            │
    │                                       │
    │  Exported Functions:                 │
    │  • walk_directory(path, maxDepth)    │
    │    └─ Returns: Vec<String> (files)   │
    │                                       │
    │  • search_in_files(dir, query,       │
    │      caseSensitive?, useRegex?)      │
    │    └─ Returns: Vec<SearchResult>     │
    │       {filePath, lineNum, content,   │
    │        matchStart, matchEnd}         │
    │                                       │
    │  • git_diff(repoPath, filePath)      │
    │    └─ Returns: String (unified diff) │
    │                                       │
    │  • file_watch(path, callback)        │
    │    └─ Emits: fs change events        │
    │                                       │
    │  Dependencies:                       │
    │  • napi 2.x (NAPI bindings)          │
    │  • ignore 0.4 (.gitignore aware)     │
    │  • regex 1.x (pattern matching)      │
    │  • git2 0.18 (git operations)        │
    │  • serde 1.x (JSON serialization)    │
    │  • notify 6 (file watching)          │
    │                                       │
    └───────────┬──────────────────────────┘
                │
    ┌───────────▼──────────────────────────┐
    │  OS / SYSTEM RESOURCES               │
    │  • File System (walk, read, write)   │
    │  • Git Repository (git2 library)     │
    │  • Process Management (PTY)          │
    │  • Network (HTTP/WebSocket)          │
    │                                       │
    └───────────────────────────────────────┘
```

---

## Communication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  USER INTERACTION FLOW: Editing File & AI Chat                      │
└─────────────────────────────────────────────────────────────────────┘

[1] User Types in Editor
    │
    ├─→ Monaco Editor (React state update)
    │   └─→ Zustand appStore.updateFileContent()
    │       └─→ EditorArea re-renders
    │           └─→ File marked as isDirty=true (dot on tab)
    │
    └─→ Auto-save (if enabled)
        └─→ appStore.saveFile()
            └─→ IPC invoke('fs:write-file', path, content)
                └─→ Electron Main (fs.promises.writeFile)
                    └─→ OS File System ✓

[2] User Selects Code & Opens AI Panel
    │
    ├─→ AiPanel Component
    │   ├─→ Reads selectedCode from EditorArea
    │   ├─→ Shows ChatModeSelector (ask/plan/agent)
    │   └─→ Shows 8 slash commands
    │
    └─→ User types prompt + selects skills
        └─→ SkillEngine.detectSkills() / buildSystemPrompt()

[3] User Presses Enter → Submit Message
    │
    ├─→ AiPanel.submitMessage()
    │   ├─→ Create AiMessage { role: 'user', content, provider, ... }
    │   ├─→ appStore.addAiMessage(userMsg)
    │   └─→ WebSocket send to Python sidecar
    │       {
    │         messages: [{role: 'user', content}],
    │         provider: 'groq',
    │         mode: 'ask',
    │         skills: ['code-formatter']
    │       }
    │
    └─→ Python Sidecar (FastAPI)
        ├─→ Route by provider (Groq/Gemini/Ollama/Claude)
        ├─→ Build system prompt (include skills)
        ├─→ Call AI API (streaming SSE)
        └─→ Send chunks back via WebSocket
            {
              "type": "chunk",
              "content": "Here is the"
            }

[4] React Receives Streaming Response
    │
    ├─→ WebSocket.onmessage() listener
    │   ├─→ Append chunk to assistantMsg.content
    │   ├─→ Mark isStreaming=true
    │   └─→ appStore.addAiMessage() (or updateMessage)
    │
    └─→ MessageBubble Component
        ├─→ Animate character-by-character typing
        │   (dynamic step sizing for catchup)
        ├─→ Render markdown (code blocks, bold, etc.)
        └─→ Show action buttons (Copy, Execute, etc.)

[5] (Optional) Agent Mode → Tool Execution
    │
    ├─→ Python receives tool request
    │   {
    │     "type": "tool_call",
    │     "tool": "run_shell_command",
    │     "args": {"cmd": "npm install"}
    │   }
    │
    ├─→ Python executes tool
    │   └─→ AgentStep { status: 'running' }
    │
    └─→ Send result back
        {
          "type": "tool_result",
          "result": "npm install output..."
        }
        └─→ React shows tool execution feedback

[6] User Interaction with Terminal
    │
    ├─→ TerminalPanel.tsx → xterm.js instance
    │   ├─→ User types command
    │   └─→ xterm.js sends data
    │
    ├─→ IPC invoke('terminal:write', {pid, data})
    │   └─→ Electron main → node-pty
    │       └─→ Write to PTY
    │
    └─→ PTY output (stdout)
        └─→ IPC send('terminal:data', {pid, data})
            └─→ React ← xterm.js.write(data)
                └─→ Display in terminal

[7] File Search (via Rust Addon)
    │
    ├─→ SearchPanel.tsx → user enters query
    │   └─→ IPC invoke('search:full-text', {
    │         dir: '/path/to/project',
    │         query: 'TODO',
    │         caseSensitive: false,
    │         useRegex: false
    │       })
    │
    ├─→ Electron main → Rust addon (NAPI)
    │   └─→ search_in_files() (compiled C++/Rust)
    │       ├─→ Walk directory (ignore .gitignore)
    │       ├─→ Match regex pattern in files
    │       └─→ Return Vec<SearchResult>
    │
    └─→ React receives results
        ├─→ appStore.setSearchResults()
        └─→ SearchPanel renders list
            └─→ User clicks result → open file + jump to line
```

---

## Data Structure Examples

```typescript
// ─── AiMessage (Chat History) ───────────────────────────────────
{
  id: "msg-1234567890",
  role: "user",
  content: "Fix the bug in handleClick",
  provider: "groq",
  mode: "ask",
  timestamp: 1718362200000,
  isStreaming: false,
  appliedSkills: ["code-analyzer", "security-auditor"],
  
  // For plan/agent modes:
  planSteps: [
    {
      id: "step-1",
      title: "Analyze current implementation",
      description: "Review the handleClick function",
      estimatedComplexity: "low",
      status: "completed",
      result: "Found null reference on line 45"
    },
    {
      id: "step-2",
      title: "Generate fixed version",
      description: "Create type-safe replacement",
      estimatedComplexity: "medium",
      status: "pending"
    }
  ],
  
  agentSteps: [
    {
      id: "agent-1",
      tool: "run_shell_command",
      input: "npm test",
      status: "success",
      output: "✓ All tests pass"
    }
  ]
}

// ─── OpenFile (Editor State) ────────────────────────────────────
{
  path: "C:\\Users\\...\\Desktop\\codedroid\\src\\App.tsx",
  name: "App.tsx",
  content: "import React from 'react'\n...",
  language: "typescript",
  isDirty: false,
  cursorLine: 42,
  cursorCol: 15,
  scrollTop: 1200,
  splitGroup: 0  // For split editor (0 = left, 1 = right)
}

// ─── Settings (Persistent) ─────────────────────────────────────
{
  // AI
  groqKey: "gsk_...",
  geminiKey: "AIzaSy...",
  ollamaHost: "http://localhost:11434",
  claudeKey: "sk-ant-...",
  defaultAiProvider: "groq",
  defaultAiModel: "llama3-70b",
  
  // UI
  themeId: "dracula",
  sidebarWidth: 320,
  aiPanelWidth: 400,
  terminalHeight: 250,
  showSidebar: true,
  showAiPanel: true,
  showTerminal: true,
  showStatusBar: true,
  showBreadcrumbs: true,
  
  // Editor
  fontSize: 14,
  fontFamily: "Fira Code",
  tabSize: 2,
  autoSave: true,
  
  // Terminal
  terminalFontSize: 12,
  terminalTheme: "dracula"
}

// ─── SearchResult (Rust addon) ─────────────────────────────────
{
  filePath: "/path/to/project/src/App.tsx",
  lineNumber: 45,
  lineContent: "  if (!activeFile) return null",
  matchStart: 6,  // Character offset in line
  matchEnd: 17
}

// ─── GitFileStatus ─────────────────────────────────────────────
{
  path: "src/App.tsx",
  status: "M",  // Modified | Added | Deleted | Untracked
  staged: true
}
```

---

## Keyboard Shortcuts Reference

```
┌────────────────────────────────────────────────────────┐
│          GLOBAL KEYBOARD SHORTCUTS (App.tsx)           │
├────────────────────────────────────────────────────────┤
│ Ctrl+S                  │ Save active file             │
│ Ctrl+Shift+S            │ Save all open files          │
│ Ctrl+Shift+P            │ Open command palette         │
│ Ctrl+B                  │ Toggle sidebar visibility    │
│ Ctrl+J                  │ Toggle terminal visibility   │
│ Escape                  │ Close modals/palette         │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│       AI PANEL SLASH COMMANDS (SkillEngine.ts)        │
├────────────────────────────────────────────────────────┤
│ /fix          │ Fix bugs in selected code              │
│ /explain      │ Explain this code                      │
│ /refactor     │ Refactor for clarity & performance     │
│ /tests        │ Generate unit tests                    │
│ /docs         │ Generate documentation                │
│ /optimize     │ Optimize for performance               │
│ /review       │ Code review with suggestions           │
│ /types        │ Add TypeScript types                   │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│          MONACO EDITOR (IDE-like)                      │
├────────────────────────────────────────────────────────┤
│ Ctrl+/        │ Toggle line comment                    │
│ Ctrl+H        │ Find and replace                       │
│ Ctrl+G        │ Go to line                             │
│ Alt+↑/↓       │ Move line up/down                      │
│ Ctrl+D        │ Add cursor to next match               │
│ Ctrl+K Ctrl+0 │ Fold all regions                       │
│ Ctrl+K Ctrl+J │ Unfold all regions                     │
└────────────────────────────────────────────────────────┘
```

---

## Build & Development

```bash
# Install all dependencies
npm install
pip install -r python/requirements.txt

# Development (with hot reload)
npm run dev
# Starts:
# • Vite dev server (localhost:5173)
# • Electron dev window (loads from Vite)
# • Python sidecar (auto-started by Electron)

# Production build
npm run build
# Outputs:
# • dist/index.html + compiled JS/CSS
# • dist/assets/ (Monaco editor, themes)

# Rebuild native Rust addon (if C++ changed)
npm run rebuild
# Uses: electron-rebuild to compile Rust → NAPI .node file

# Run specific npm script
npm run <script-name>
```

---

## Deployment

```bash
# Build for distribution
npm run build

# Package with electron-builder (if configured)
npm run electron-build

# Result:
# • Windows: .exe installer
# • macOS: .dmg installer
# • Linux: .AppImage or .deb
```

---

**Last Updated**: 2026-06-13 | **Version**: 3.0.0
