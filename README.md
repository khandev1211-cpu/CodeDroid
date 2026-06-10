# ⚡ CodeDroid IDE v3

> AI-powered desktop IDE rebuilt from Flutter to **TypeScript + Python + Rust**

---

## 🏗 Architecture

```
codedroid/
├── src/                    # TypeScript + React (Electron renderer)
│   ├── components/
│   │   ├── editor/         # Monaco Editor, tabs, breadcrumbs
│   │   ├── ai/             # AI Copilot panel (4 providers, streaming)
│   │   ├── sidebar/        # Files, Search, Git, Extensions, Settings
│   │   └── terminal/       # xterm.js multi-tab terminal
│   ├── stores/             # Zustand global state
│   ├── themes/             # 16 themes (8 classic + NEW: Void Black, Aurora, Sandstorm, Neon City, Sakura, Glacier)
│   └── types/              # TypeScript declarations
├── electron/               # Electron main process + IPC handlers
│   ├── main.js             # Window, IPC, Python sidecar boot
│   └── preload.js          # Secure IPC bridge (contextBridge)
├── python/                 # FastAPI AI sidecar
│   ├── main.py             # AI streaming, 11 agentic tools, WebSocket
│   └── requirements.txt
└── crates/core/            # Rust native addon (napi-rs)
    └── src/lib.rs          # FS walk, full-text search, git2 diff
```

---

## 🎨 Themes (16 total)

### Classic Dark
- VS Code Dark+, One Dark Pro, Dracula, Monokai Pro, Nord, GitHub Dark, Catppuccin Mocha, Tokyo Night

### Light
- GitHub Light

### ✨ New Original Themes
| Theme | Vibe |
|---|---|
| **Void Black** | Pure black with neon red accents |
| **Aurora Borealis** | Deep navy with electric green |
| **Sandstorm** | Warm desert browns with amber |
| **Neon City** | Cyberpunk purple with hot pink & cyan |
| **Sakura Dusk** | Soft pinks, dark rose backgrounds |
| **Glacier** | Ice blue, crisp winter palette |

---

## 🤖 AI Providers

| Provider | Streaming | Models |
|---|---|---|
| **Groq** | ✅ SSE | llama3-70b, mixtral, gemma2 |
| **Gemini** | ✅ (batch) | gemini-1.5-pro, flash |
| **Claude (Anthropic)** | ✅ SSE | claude-sonnet-4, opus, haiku |
| **Ollama** | ✅ Stream | Any local model |

### Slash Commands
`/fix` `/explain` `/refactor` `/tests` `/docs` `/optimize` `/review` `/types`

---

## 🔧 Agentic Tools (11)

Python sidecar executes these on behalf of the AI:

`read_file` · `write_file` · `create_file` · `delete_file` · `make_dir`  
`list_files` · `run_command` · `run_python` · `pip_install` · `git_command` · `web_fetch`

---

## ⚙️ Tech Stack

| Layer | Tech |
|---|---|
| Shell | Electron 29 |
| UI | React 18 + Vite 5 |
| Editor | Monaco Editor (VS Code's core) |
| Terminal | xterm.js |
| State | Zustand |
| AI backend | FastAPI + httpx (Python) |
| FS/Search/Git | Rust (napi-rs + ignore + regex + git2) |

---

## 🚀 Setup & Run

### Prerequisites
- Node.js 18+
- Python 3.10+
- Rust + Cargo (for native addon)

### 1. Install JS dependencies
```bash
npm install
```

### 2. Install Python dependencies
```bash
pip install -r python/requirements.txt
```

### 3. Build Rust addon (optional - IDE works without it)
```bash
cd crates/core
cargo build --release
```

### 4. Run in development
```bash
npm run dev
```

### 5. Build for production
```bash
npm run build
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+S` | Save file |
| `Ctrl+Shift+S` | Save all |
| `Ctrl+Shift+P` | Command palette |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+J` | Toggle terminal |
| `Ctrl+I` | Inline AI edit |
| `Ctrl+W` | Close tab |
| `Ctrl+Z / Ctrl+Y` | Undo / Redo |

---

## 📁 Upgrade from v2 (Flutter)

| Feature | v2 Flutter | v3 TypeScript+Python+Rust |
|---|---|---|
| Editor | re_editor | Monaco Editor (VS Code core) |
| Search | Dart string scan | Rust regex (ripgrep-style) |
| AI providers | 3 | 4 (+ Claude) |
| Git diff | shell subprocess | libgit2 via Rust |
| Platform | Windows only | Windows + macOS + Linux |
| Themes | 13 | 16 (+ 6 originals) |

---

*CodeDroid v3 — Built with ❤️ using TypeScript, Python & Rust*
