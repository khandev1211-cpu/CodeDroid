<div align="center">

<img src="https://img.shields.io/badge/version-3.0.0-f69673?style=for-the-badge" />
<img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-1b93c9?style=for-the-badge" />
<img src="https://img.shields.io/badge/license-MIT-brightgreen?style=for-the-badge" />
<img src="https://img.shields.io/badge/PRs-welcome-blueviolet?style=for-the-badge" />

# ⚡ CodeDroid IDE

### AI-powered desktop IDE — rebuilt from Flutter to TypeScript + Python + Rust

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Rust](https://img.shields.io/badge/Rust-000000?style=flat-square&logo=rust&logoColor=white)](https://www.rust-lang.org/)
[![Electron](https://img.shields.io/badge/Electron-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React_18-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)

</div>

---

## 🗂 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [AI Providers](#-ai-providers)
- [Agentic Tools](#-agentic-tools)
- [Themes](#-themes)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Setup & Run](#-setup--run)
- [Upgrade from v2](#-upgrade-from-v2-flutter)

---

## 🌟 Overview

CodeDroid v3 is a **fully-featured, AI-native desktop IDE** that puts 4 AI providers, 11 agentic tools, and Monaco Editor (the engine behind VS Code) directly in your hands — on Windows, macOS, and Linux.

| | |
|---|---|
| 🧠 **AI Copilot** | 4 providers, streaming, 8 slash commands |
| ⚡ **Monaco Editor** | VS Code's core — full IntelliSense |
| 🦀 **Rust Engine** | Ripgrep-style search, git2 diff, fast FS |
| 🎨 **16 Themes** | 8 classic + 6 original exclusive themes |
| 🖥 **Cross-platform** | Windows · macOS · Linux |

---

## 🏗 Architecture

```
codedroid/
├── src/                        # TypeScript + React (Electron renderer)
│   ├── components/
│   │   ├── editor/             # Monaco Editor, tabs, breadcrumbs
│   │   ├── ai/                 # AI Copilot panel (4 providers, streaming)
│   │   ├── sidebar/            # Files, Search, Git, Extensions, Settings
│   │   └── terminal/           # xterm.js multi-tab terminal
│   ├── stores/                 # Zustand global state
│   ├── themes/                 # 16 themes (8 classic + 6 originals)
│   └── types/                  # TypeScript declarations
│
├── electron/                   # Electron main process + IPC handlers
│   ├── main.js                 # Window, IPC, Python sidecar boot
│   └── preload.js              # Secure IPC bridge (contextBridge)
│
├── python/                     # FastAPI AI sidecar
│   ├── main.py                 # AI streaming, 11 agentic tools, WebSocket
│   └── requirements.txt
│
└── crates/core/                # Rust native addon (napi-rs)
    └── src/lib.rs              # FS walk, full-text search, git2 diff
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| 🖥 Shell | Electron 29 |
| 🎨 UI | React 18 + Vite 5 |
| ✏️ Editor | Monaco Editor (VS Code's core engine) |
| 💻 Terminal | xterm.js (multi-tab) |
| 🗃 State | Zustand |
| 🤖 AI Backend | FastAPI + httpx (Python 3.10+) |
| 🔍 FS / Search / Git | Rust — napi-rs · ignore · regex · git2 |

---

## 🤖 AI Providers

All providers support **real-time streaming** directly in the editor panel.

| Provider | Streaming | Available Models |
|---|---|---|
| **Groq** | ✅ SSE | llama3-70b, mixtral, gemma2 |
| **Gemini** | ✅ Batch | gemini-1.5-pro, gemini-flash |
| **Claude (Anthropic)** | ✅ SSE | claude-sonnet-4, opus, haiku |
| **Ollama** | ✅ Stream | Any local model |

### ⌨️ Slash Commands

Type these in the AI panel for instant actions:

| Command | Action |
|---|---|
| `/fix` | Fix bugs in selected code |
| `/explain` | Explain what the code does |
| `/refactor` | Refactor for cleanliness |
| `/tests` | Generate unit tests |
| `/docs` | Write documentation |
| `/optimize` | Optimize for performance |
| `/review` | Full code review |
| `/types` | Add TypeScript types |

---

## 🔧 Agentic Tools (11)

The Python sidecar executes these tools autonomously on behalf of the AI:

```
read_file     write_file    create_file   delete_file   make_dir
list_files    run_command   run_python    pip_install   git_command   web_fetch
```

> The AI can chain multiple tools together to complete complex tasks — reading files, running code, installing packages, and pushing git commits, all without leaving the IDE.

---

## 🎨 Themes (16 Total)

### 🌑 Classic Dark
`VS Code Dark+` · `One Dark Pro` · `Dracula` · `Monokai Pro` · `Nord` · `GitHub Dark` · `Catppuccin Mocha` · `Tokyo Night`

### ☀️ Light
`GitHub Light`

### ✨ Original Exclusive Themes

| Theme | Vibe |
|---|---|
| **Void Black** | Pure black with neon red accents |
| **Aurora Borealis** | Deep navy with electric green highlights |
| **Sandstorm** | Warm desert browns with golden amber |
| **Neon City** | Cyberpunk purple with hot pink & cyan |
| **Sakura Dusk** | Soft pinks on dark rose backgrounds |
| **Glacier** | Crisp ice blue — clean winter palette |

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + S` | Save file |
| `Ctrl + Shift + S` | Save all |
| `Ctrl + Shift + P` | Command palette |
| `Ctrl + B` | Toggle sidebar |
| `Ctrl + J` | Toggle terminal |
| `Ctrl + I` | Inline AI edit |
| `Ctrl + W` | Close tab |
| `Ctrl + Z` / `Ctrl + Y` | Undo / Redo |

---

## 🚀 Setup & Run

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **Rust + Cargo** *(optional — for native Rust addon)*

### 1. Install JS dependencies
```bash
npm install
```

### 2. Install Python dependencies
```bash
pip install -r python/requirements.txt
```

### 3. Build Rust addon *(optional — IDE works without it)*
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

## 📁 Upgrade from v2 (Flutter)

| Feature | v2 · Flutter | v3 · TypeScript + Python + Rust |
|---|---|---|
| Editor | re_editor | Monaco Editor (VS Code core) |
| Search | Dart string scan | Rust regex *(ripgrep-style)* |
| AI providers | 3 | 4 *(+ Claude)* |
| Git diff | shell subprocess | libgit2 via Rust |
| Platform | Windows only | Windows + macOS + Linux |
| Themes | 13 | 16 *(+ 6 originals)* |

---

## 👥 Contributors & Links

1. **[khandev1211-cpu](https://github.com/khandev1211-cpu)** — Project Lead & Developer
2. **[CodeDroid Repository](https://github.com/khandev1211-cpu/CodeDroid)** — Main Project Repository

---

<div align="center">

**CodeDroid v3** — Built with ❤️ using TypeScript, Python & Rust

[![GitHub Profile](https://img.shields.io/badge/GitHub-khandev1211--cpu-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/khandev1211-cpu)
[![GitHub Repo](https://img.shields.io/badge/Repository-CodeDroid-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/khandev1211-cpu/CodeDroid)
[![Gmail](https://img.shields.io/badge/Contact-khandev1211@gmail.com-D14836?style=for-the-badge&logo=gmail&logoColor=white)](mailto:khandev1211@gmail.com)

</div>
