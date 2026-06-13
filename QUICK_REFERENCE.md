# CodeDroid v3.0.0 - Quick Reference

## 📊 At a Glance

| Aspect | Details |
|---|---|
| **Type** | AI-native Desktop IDE |
| **Platform** | Windows, macOS, Linux |
| **Frontend** | Electron 29, React 18, TypeScript 5.3 |
| **Build Tool** | Vite 5 |
| **Editor** | Monaco (VS Code engine) |
| **Backend** | Python FastAPI + WebSocket |
| **Native** | Rust + NAPI (FS, search, git) |
| **State** | Zustand (persistent) |
| **Package** | 3.0.0 (rewrite from Flutter) |

---

## 🎯 Core Features

### **Editor**
- ✅ Monaco editor (full IntelliSense, 50+ languages)
- ✅ Multi-tab support with tab bar
- ✅ Breadcrumb navigation
- ✅ Split view support (left/right panes)
- ✅ Auto-save capability
- ✅ Syntax highlighting + themes

### **AI & Chat**
- ✅ 4 AI providers (Groq, Gemini, Ollama, Claude)
- ✅ Real-time streaming (character-by-character UI animation)
- ✅ 3 chat modes: Ask, Plan, Agent
- ✅ 8 slash commands (/fix, /explain, /refactor, /tests, /docs, /optimize, /review, /types)
- ✅ Skill detection engine
- ✅ Message history with persistence
- ✅ Code context injection (selected code → AI)

### **Sidebar Panels**
- ✅ **Files**: Directory tree, open/create/delete, git-aware
- ✅ **Search**: Full-text search (regex support)
- ✅ **Git**: Status, diff viewer, staging/committing
- ✅ **Settings**: API keys, theme, editor/terminal config
- ✅ **Extensions**: (Placeholder for future VS Code ext support)

### **Terminal**
- ✅ Multi-tab xterm.js terminal
- ✅ PTY support (node-pty)
- ✅ Respects OS shell (bash/powershell/zsh)
- ✅ Full terminal emulation

### **Themes & UI**
- ✅ 16 themes (8 classic + 6 originals)
- ✅ Custom window title bar (frameless)
- ✅ Activity bar (left sidebar icons)
- ✅ Status bar (cursor pos, file info, git status)
- ✅ Command palette (Cmd+Shift+P)

### **Native Performance**
- ✅ Fast directory walking (ripgrep-style)
- ✅ Full-text search (regex, case-sensitive options)
- ✅ Git operations (git2 library)
- ✅ File watching (fs events)

---

## 🏗️ Architecture Overview

### **Three-Process Model**

1. **Electron Main** (Node.js)
   - Window management
   - File dialogs
   - IPC routing
   - Python sidecar boot
   - Rust addon loading

2. **React Renderer** (TypeScript + React 18)
   - UI components (editor, ai, sidebar, terminal)
   - Zustand global state
   - IPC communication
   - Streaming UI animation

3. **Python Sidecar** (FastAPI)
   - AI streaming (4 providers)
   - Agentic tool execution (11 tools)
   - Model management
   - Code formatting/linting
   - WebSocket endpoint

### **Native Rust Addon** (NAPI)
- Directory walking (respects .gitignore)
- Full-text search (ripgrep-style)
- Git diff operations
- File system watching

---

## 🗂️ Project Structure

```
codedroid/
├── src/                    # React frontend (50+ components)
│   ├── components/         # UI components
│   ├── stores/             # Zustand state
│   ├── themes/             # 16 theme definitions
│   ├── skills/             # Skill registry
│   └── styles/             # Global CSS
│
├── electron/               # Electron main process
│   ├── main.js             # Window, IPC handlers
│   └── preload.js          # Secure IPC bridge
│
├── python/                 # FastAPI sidecar
│   ├── main.py             # Server endpoints
│   └── requirements.txt     # Python deps
│
├── crates/core/            # Rust native addon
│   ├── src/lib.rs          # Implementation
│   └── Cargo.toml          # Rust deps
│
├── vite.config.ts          # Build config
├── tsconfig.json           # TS config
└── package.json            # Node deps & scripts
```

---

## 📚 Documentation Files Created

### **1. PROJECT_ANALYSIS.md** (Comprehensive Overview)
- Full project description
- Architecture details
- Tech stack explanation
- Component breakdown
- AI & agentic system
- Performance optimizations
- Current status & roadmap

### **2. ARCHITECTURE.md** (Visual Diagrams & Flows)
- System architecture diagram
- Three-process model visualization
- Communication flow (chat, editing, terminal)
- Data structure examples
- Keyboard shortcuts reference
- Build & deployment info

### **3. IMPLEMENTATION_GUIDE.md** (Developer Reference)
- Complete directory structure
- Key component flows (file editing, AI chat, search, terminal)
- Zustand state pattern
- IPC type safety pattern
- Monaco editor integration
- Development patterns
- Common tasks & solutions

---

## 🚀 Getting Started

### **Installation**

```bash
# Install all dependencies
npm install
pip install -r python/requirements.txt

# (On Windows, also: python -m venv venv && venv\Scripts\activate)
```

### **Development**

```bash
# Start dev server (hot reload)
npm run dev
# Starts: Vite (localhost:5173) + Electron + Python sidecar
```

### **Production Build**

```bash
npm run build
# Outputs: dist/ folder (ready for packaging)
```

### **Rebuild Native Module**

```bash
npm run rebuild
# Recompiles Rust addon for current platform
```

---

## 🔑 Key Files to Know

### **Frontend Entry Points**
- `src/main.tsx` — React entry
- `src/App.tsx` — Root component, keyboard shortcuts
- `src/stores/appStore.ts` — Global state (files, AI, settings)

### **UI Components**
- `src/components/editor/EditorArea.tsx` — Code editor
- `src/components/ai/AiPanel.tsx` — AI chat interface
- `src/components/sidebar/Sidebar.tsx` — Sidebar container
- `src/components/terminal/TerminalPanel.tsx` — Terminal

### **Backend**
- `electron/main.js` — Electron main process
- `python/main.py` — FastAPI server
- `crates/core/src/lib.rs` — Rust implementation

### **Configuration**
- `package.json` — Scripts, Node deps
- `python/requirements.txt` — Python deps
- `crates/core/Cargo.toml` — Rust deps
- `vite.config.ts` — Build config
- `tsconfig.json` — TypeScript config
- `src/themes/themes.ts` — 16 theme definitions

---

## ⌨️ Essential Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save active file |
| `Ctrl+Shift+S` | Save all files |
| `Ctrl+Shift+P` | Open command palette |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+J` | Toggle terminal |
| `Escape` | Close modals |

---

## 🤖 AI Chat Modes

### **Ask Mode**
Simple Q&A with AI. Returns single response (no planning/tool execution).

### **Plan Mode**
AI generates multi-step plan. User can execute steps or ask for refinement.

### **Agent Mode**
AI autonomously executes agentic tools (file ops, shell commands, git, etc.).

---

## 🔧 Agentic Tools (11 Total)

| Category | Tools |
|---|---|
| **File Ops** | file_read, file_write, file_delete |
| **Shell** | run_shell_command |
| **Git** | git_commit, git_pull, git_push |
| **Package** | npm_install, pip_install |
| **Docker** | docker_build, docker_run |

---

## 💾 State Management

### **Global Store (Zustand)**
- **Files**: openFiles[], activeFileIndex, saveFile()
- **AI**: messages[], addAiMessage(), fetchModels()
- **Settings**: theme, fontSize, API keys, etc. (persisted via electron-store)
- **Sidebar**: activePanel, filePanelRoot, searchResults

### **Persistence**
- Zustand + electron-store automatically saves settings
- Message history stored separately (historyStore.ts)
- No manual localStorage needed

---

## 🔌 IPC (Electron ↔ React Communication)

### **File System**
```
invoke('fs:read-file', path) → {ok, content}
invoke('fs:write-file', path, content) → {ok}
invoke('fs:read-dir', path) → {ok, entries}
invoke('fs:open-folder') → path | null
invoke('fs:open-file') → path | null
```

### **Window Control**
```
invoke('window:minimize')
invoke('window:maximize')
invoke('window:close')
```

### **Terminal**
```
invoke('terminal:create-pty', {cwd, env}) → {pid}
invoke('terminal:write', {pid, data})
on('terminal:data', {pid, data})
```

### **Search & Git**
```
invoke('search:full-text', {dir, query, caseSensitive?, useRegex?})
invoke('git:get-status', repoPath)
invoke('git:diff', {repoPath, filePath})
```

---

## 📈 Technology Stack (Detailed)

### **Frontend**
- **Electron** 29.4.6 — Desktop app framework
- **React** 18.2.0 — UI framework
- **TypeScript** 5.3.3 — Type-safe JavaScript
- **Vite** 5.1.6 — Fast build tool
- **Monaco Editor** 0.45.0 — Code editor
- **xterm.js** 5.5.0 — Terminal emulator
- **Zustand** 4.5.0 — State management
- **Lucide React** 0.344.0 — Icons
- **electron-store** 8.1.0 — Persistent storage
- **node-pty** 1.1.0 — PTY for terminals

### **Backend**
- **Python** 3.10+
- **FastAPI** 0.110.0 — Web framework
- **Uvicorn** 0.27.0 — ASGI server
- **httpx** 0.26.0 — Async HTTP client
- **Pydantic** 2.5.0 — Data validation
- **black** 24.0.0 — Code formatter
- **pyflakes** 3.2.0 — Code linter

### **Native**
- **Rust** 2021 edition
- **napi-rs** 2.x — Node.js native bindings
- **ignore** 0.4 — .gitignore-aware walking
- **regex** 1.x — Pattern matching
- **git2** 0.18 — Git operations (vendored libgit2)
- **serde** 1.x — Serialization
- **notify** 6 — File system events

---

## 🎯 Design Principles

1. **Type-Safe**: TypeScript everywhere, IPC has types
2. **Reactive**: Zustand for declarative state, React for UI
3. **Modular**: Components are self-contained
4. **Performant**: Rust for heavy ops, streaming for UI
5. **Extensible**: Skill engine, theme system, tool registry
6. **Cross-Platform**: Works on Windows, macOS, Linux
7. **Developer-Friendly**: Hot reload, DevTools, clear patterns

---

## 🔮 Planned Features (v3.1+)

- ✔ Claude provider full integration
- ✔ VS Code extension support
- ✔ Database backend (SQLite)
- ✔ Plugin system (custom agentic tools)
- ✔ Workspace management
- ✔ Remote file editing (SSH)

---

## 📞 Support & Resources

### **Documentation Files**
- `PROJECT_ANALYSIS.md` — Full project overview
- `ARCHITECTURE.md` — System architecture & diagrams
- `IMPLEMENTATION_GUIDE.md` — Developer guide
- `README.md` — Project introduction

### **Key Files to Read**
1. Start with `PROJECT_ANALYSIS.md` for overview
2. Review `ARCHITECTURE.md` for system design
3. Use `IMPLEMENTATION_GUIDE.md` for development
4. Check individual component files for details

---

## 🔍 Quick Troubleshooting

| Issue | Solution |
|---|---|
| Electron won't start | Check `npm run dev` output for errors; ensure Node 18+ |
| Python sidecar fails | Install requirements: `pip install -r python/requirements.txt` |
| Rust addon missing | Run `npm run rebuild` to compile |
| Hot reload not working | Restart Vite dev server (Ctrl+C, then npm run dev) |
| Monaco theme broken | Clear electron-store settings: `rm ~/.config/codedroid/` |

---

## 📊 Project Stats

| Metric | Value |
|---|---|
| **Components** | 15+ main components |
| **Lines of Code (React)** | ~5,000+ |
| **Lines of Code (Python)** | ~1,000+ |
| **Lines of Code (Rust)** | ~500+ |
| **Total Themes** | 16 |
| **Agentic Tools** | 11 |
| **Slash Commands** | 8 |
| **Keyboard Shortcuts** | 10+ |
| **AI Providers** | 4 (Groq, Gemini, Ollama, Claude) |

---

## 🎉 Summary

**CodeDroid v3** is a modern, AI-native IDE that combines:
- **Professional Code Editing** via Monaco
- **AI Copilot Integration** with 4 providers
- **Native Performance** via Rust
- **Cross-Platform Support** via Electron
- **Extensible Architecture** with skill system

Perfect for developers who want an AI-powered IDE with the flexibility of open-source software.

---

**Version**: 3.0.0 | **Updated**: 2026-06-13 | **License**: MIT
