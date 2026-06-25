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
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [AI Providers & Reasoning](#-ai-providers--reasoning)
- [Agentic Tools](#-agentic-tools)
- [Themes](#-themes)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [Setup & Run](#-setup--run)
- [Upgrade from v2](#-upgrade-from-v2-flutter)

---

## 🌟 Overview

CodeDroid v3 is a **fully-featured, AI-native desktop IDE** that integrates 4 major AI providers, 11 autonomous agentic tools, a live visual edit mode, and Monaco Editor (the engine behind VS Code) — natively on Windows, macOS, and Linux.

| Core Engine | Description |
|---|---|
| 🧠 **AI Copilot** | 4 providers (Groq, Gemini, Claude, Ollama) with real-time streaming, 8 slash commands, and CoT reasoning. |
| 🌐 **Live Visual Preview** | Playwright-driven Chromium browser with click-to-edit DOM selectors and AI-driven source code patching. |
| 🛠️ **Autonomous Auto-Fix** | Closed-loop script debugger: runs shell tasks, auto-detects compile/runtime errors, writes minimal surgical fixes, and verifies. |
| ⚡ **Monaco Editor** | VS Code's core text engine, providing syntax highlighting, tabs, breadcrumbs, and full IntelliSense. |
| 🦀 **Rust Addon** | Native performance for ignores, ripgrep-style full-text searches, and `libgit2`-based file differences. |
| 🎨 **15 Themes** | 8 classic dark/light palettes + 6 exclusive high-contrast and neon themes (e.g. Void Black, Aurora Borealis). |

---

## 🚀 Key Features

### 1. Visual Edit Mode (Live Preview)
Run your web app directly inside the integrated browser view driven by Playwright. Toggle **Edit Mode** to hover and select any element on your page, type a prompt into the floating UI input, and let the AI patch the live DOM. When satisfied, click **Save** to write the modifications back to your local HTML/source file surgically, preserving all formatting and comments.

### 2. Autonomous Auto-Fix Loop
Runs compilation, test commands, or execution scripts directly in a dedicated tab. If a crash or exit code is detected, the `error_detector` parses the stderr traceback, maps it to a file, line, and column, prompts the LLM for a surgical fix, overwrites the file, and re-runs the task. Recurs up to 3 times or until the test suite passes.

### 3. Collapsible Chain-of-Thought (CoT)
Supports native reasoning models (DeepSeek-R1, Qwen-QwQ, Gemini Flash-Thinking) or injects specialized CoT instructions for standard models. Thinking streams are automatically parsed and rendered inside collapsible reasoning blocks in the AI Chat Panel.

---

## 🏗 Architecture

```
codedroid/
├── src/                        # TypeScript + React (Electron renderer)
│   ├── components/
│   │   ├── editor/             # Monaco Editor, tabs, breadcrumbs
│   │   ├── ai/                 # AI Copilot panel (ask/plan/agent modes)
│   │   ├── sidebar/            # Files, Search, Git, Settings
│   │   └── terminal/           # xterm.js multi-tab terminal
│   ├── stores/                 # Zustand global state persistence
│   ├── themes/                 # 15 themes (8 classic + 1 light + 6 originals)
│   └── types/                  # TypeScript declaration files
│
├── electron/                   # Electron main process + IPC handlers
│   ├── main.js                 # Window shell, node-pty terminal tabs, Python boot
│   └── preload.js              # Secure IPC bridge (contextBridge window.api)
│
├── python/                     # FastAPI AI sidecar
│   ├── main.py                 # WebSocket chat routing, tool execution, auto-fix
│   ├── error_detector.py       # Regex traceback/exit code classifier
│   ├── thinking_detector.py    # CoT reasoning controller and token trimmer
│   ├── browser_agent.py        # Playwright live preview controller
│   └── requirements.txt
│
└── crates/core/                # Rust native addon (napi-rs)
    └── src/lib.rs              # ignore-walking, full-text search, git2 diffs
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| 🖥 Shell | Electron 29 |
| 🎨 UI | React 18 + Vite 5 |
| ✏️ Editor | Monaco Editor (VS Code's core engine) |
| 💻 Terminal | xterm.js (multi-tab node-pty stream) |
| 🗃 State | Zustand (Persisted via `electron-store`) |
| 🤖 AI Sidecar | FastAPI + httpx + Uvicorn (Python 3.10+) |
| 🔍 FS / Git / Search | Rust — napi-rs · ignore · regex · git2 |
| 🌐 Live Preview | Playwright (Chromium) |

---

## 🤖 AI Providers & Reasoning

All providers support real-time token streaming, agentic function-calling, and custom Chain-of-Thought (CoT) tracking.

| Provider | Streaming | Tool Use | Reasoning (CoT) |
|---|---|---|---|
| **Groq** | ✅ SSE | ✅ Native | ✅ Native / Injected |
| **Gemini** | ✅ Batch/Stream | ✅ Prompt-injected | ✅ Native / Injected |
| **Claude** | ✅ SSE | ✅ Native | ✅ Native (Budget config) |
| **Ollama** | ✅ Stream | ✅ Prompt-injected | ✅ Native / Injected |

### ⌨️ Slash Commands

Type these in the AI panel for instant context-aware actions:

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

The Python sidecar executes these tools autonomously on behalf of the AI inside **Agent Mode**:

```
read_file     write_file    create_file   delete_file   make_dir
list_files    run_command   run_python    pip_install   git_command   web_fetch
```

---

## 🎨 Themes (15 Total)

### 🌑 Classic Dark
`VS Code Dark+` · `One Dark Pro` · `Dracula` · `Monokai Pro` · `Nord` · `GitHub Dark` · `Catppuccin Mocha` · `Tokyo Night`

### ☀️ Light
`GitHub Light`

### ✨ Original Exclusive Themes
*   **Void Black**: Pure black background with vibrant neon red accents.
*   **Aurora Borealis**: Deep space navy with electric green and cyan highlights.
*   **Sandstorm**: Warm desert browns with golden amber typography.
*   **Neon City**: Cyberpunk purple with hot pink and cyan indicators.
*   **Sakura Dusk**: Soft pinks on dark rose backgrounds.
*   **Glacier**: Crisp ice blue and winter teal layout.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + S` | Save file |
| `Ctrl + Shift + S` | Save all files |
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
*(Optionally setup Playwright: `pip install playwright && playwright install chromium`)*

### 3. Build Rust addon *(optional — IDE works with JS fallback)*
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
| Themes | 13 | 15 *(+ 6 originals)* |

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
