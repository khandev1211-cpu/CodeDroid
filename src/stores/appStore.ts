import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { themes, applyTheme, Theme } from '../themes/themes'

// ─── Types ────────────────────────────────────────────────────────────────────
export type AiProvider = 'groq' | 'gemini' | 'ollama' | 'claude'
export type ChatMode = 'plan' | 'agent' | 'ask'
export type Panel = 'files' | 'search' | 'git' | 'extensions' | 'settings'

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

export interface AgentStep {
  id: string
  tool: string
  input: string
  output?: string
  status: 'running' | 'success' | 'error'
  exitCode?: number
  hadError?: boolean
}

export interface InlineError {
  file: string
  line: number
  column?: number
  errorType: string
  message: string
}

export interface ElementData {
  selector: string
  tag: string
  text: string
  html: string
  rect: { x: number; y: number; width: number; height: number }
}

export interface DomChange {
  action: 'set_text' | 'set_html' | 'set_attribute' | 'remove' | 'set_style'
  selector: string
  value: any
  attribute_name?: string
}

export interface PlanStep {
  id: string
  title: string
  description: string
  estimatedComplexity: string
  status?: 'pending' | 'running' | 'completed' | 'failed'
  result?: string
}

export interface AiMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  provider: AiProvider
  toolName?: string
  timestamp: number
  isStreaming?: boolean
  mode?: ChatMode
  appliedSkills?: string[]
  agentSteps?: AgentStep[]
  planSteps?: PlanStep[]
  thinking?: string          // collapsible reasoning block
  isThinkingStreaming?: boolean
  isTruncated?: boolean      // hit token limit
  continuationOf?: string    // id of parent truncated message
}

export interface GitFileStatus {
  path: string
  status: 'M' | 'A' | 'D' | 'U' | '?'
  staged: boolean
}

export interface SearchResult {
  filePath: string
  lineNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}

export interface TerminalTabDef {
  id: string
  name: string
  pid?: number
  cwd?: string
  isAgentTab?: boolean
}

// ─── Settings interface ───────────────────────────────────────────────────────
export interface Settings {
  // AI
  groqKey: string
  geminiKey: string
  ollamaHost: string
  claudeKey: string
  groqModel: string
  geminiModel: string
  ollamaModel: string
  claudeModel: string
  activeProvider: AiProvider
  activeMode: ChatMode
  // Editor
  fontSize: number
  fontFamily: string
  wordWrap: boolean
  minimap: boolean
  lineNumbers: boolean
  tabSize: number
  autoSave: boolean
  // Layout
  sidebarWidth: number
  aiPanelWidth: number
  terminalHeight: number
  showSidebar: boolean
  showAiPanel: boolean
  showTerminal: boolean
  showStatusBar: boolean
  showBreadcrumbs: boolean
  // Theme
  themeId: string
}

const defaultSettings: Settings = {
  groqKey: '', geminiKey: '', ollamaHost: 'http://localhost:11434',
  claudeKey: '', groqModel: 'llama-3.3-70b-versatile', geminiModel: 'gemini-1.5-pro',
  ollamaModel: 'llama3', claudeModel: 'claude-sonnet-4-20250514',
  activeProvider: 'groq', activeMode: 'ask',
  fontSize: 14, fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  wordWrap: false, minimap: true, lineNumbers: true, tabSize: 2, autoSave: false,
  sidebarWidth: 240, aiPanelWidth: 340, terminalHeight: 200,
  showSidebar: true, showAiPanel: true, showTerminal: true,
  showStatusBar: true, showBreadcrumbs: true,
  themeId: 'vscode-dark',
}

// ─── Store ────────────────────────────────────────────────────────────────────
interface AppStore {
  // Files
  openFiles: OpenFile[]
  activeFileIndex: number
  folderPath: string | null
  splitEnabled: boolean

  // AI
  aiMessages: AiMessage[]
  aiLoading: boolean
  aiError: string | null
  aiResponseStartTime: number | null
  aiLastResponseTime: number | null

  // Agent
  agentRunning: boolean
  agentPaused: boolean
  agentCurrentStep: number
  agentTotalSteps: number
  agentCurrentTool: string
  agentWebSocket: WebSocket | null
  agentTerminalId: string | null       // ID of the dedicated 🤖 Agent terminal tab
  inlineErrors: InlineError[]          // errors to show in Monaco decorations

  // Live Preview + Edit Mode
  previewActive: boolean
  previewUrl: string | null
  previewFilePath: string | null       // source file the preview corresponds to, for Save
  editModeActive: boolean
  editingElement: ElementData | null   // currently-selected element (chip context)
  pendingChanges: DomChange[]
  previewConsole: { level: string; text: string }[]

  // Git
  gitFiles: GitFileStatus[]
  gitBranch: string
  gitLog: string[]
  commitMessage: string

  // Search
  searchQuery: string
  searchResults: SearchResult[]
  searchLoading: boolean
  replaceQuery: string

  // Terminal
  terminalTabs: TerminalTabDef[]
  activeTerminalTab: string | null

  // UI
  activePanel: Panel
  settings: Settings
  theme: Theme
  commandPaletteOpen: boolean
  inlineAiOpen: boolean
  inlineAiTarget: { line: number; selection: string } | null
  enhancerLoading: boolean

  // Available models (fetched from APIs)
  availableModels: Record<string, string[]>

  // Actions: Files
  setFolderPath: (p: string | null) => void
  openNewFolder: () => Promise<void>
  openFile: (file: OpenFile) => void
  closeFile: (index: number) => void
  setActiveFile: (index: number) => void
  updateFileContent: (index: number, content: string, dirty?: boolean) => void
  saveFile: (index: number) => Promise<void>
  saveAllFiles: () => Promise<void>
  toggleSplit: () => void
  renameOpenFile: (oldPath: string, newPath: string, newName: string) => void

  // Actions: AI
  addAiMessage: (msg: Omit<AiMessage, 'id' | 'timestamp'>) => string
  updateAiMessage: (id: string, content: string, streaming?: boolean) => void
  clearAiMessages: () => void
  setAiLoading: (b: boolean) => void
  setAiError: (e: string | null) => void
  sendAiMessage: (text: string) => Promise<void>

  // Actions: Agent
  setAgentRunning: (running: boolean) => void
  setAgentPaused: (paused: boolean) => void
  setAgentTerminalId: (id: string | null) => void
  setInlineErrors: (errors: InlineError[]) => void
  clearInlineErrors: () => void
  setAgentStatus: (step: number, total: number, tool: string) => void
  setAgentWebSocket: (ws: WebSocket | null) => void

  // Actions: Live Preview + Edit Mode
  setPreviewActive: (active: boolean, url?: string | null, filePath?: string | null) => void
  setEditModeActive: (active: boolean) => void
  setEditingElement: (el: ElementData | null) => void
  setPendingChanges: (changes: DomChange[]) => void
  addPreviewConsole: (level: string, text: string) => void
  clearPreviewConsole: () => void
  pauseAgent: () => void
  stopAgent: () => void
  resetAgentState: () => void
  fetchModels: (provider: string) => Promise<void>

  // Actions: Git
  loadGitStatus: () => Promise<void>
  stageFile: (path: string) => Promise<void>
  unstageFile: (path: string) => Promise<void>
  commitChanges: () => Promise<void>
  setCommitMessage: (m: string) => void
  gitPush: () => Promise<void>
  gitPull: () => Promise<void>

  // Actions: Search
  setSearchQuery: (q: string) => void
  setReplaceQuery: (q: string) => void
  runSearch: (opts?: { caseSensitive?: boolean; useRegex?: boolean }) => Promise<void>
  replaceAll: () => Promise<void>

  // Actions: Terminal
  addTerminalTab: (cwd?: string) => void
  addAgentTerminal: (cwd?: string) => string   // returns tab id
  removeTerminalTab: (id: string) => void
  setActiveTerminalTab: (id: string) => void

  // Actions: UI
  setActivePanel: (p: Panel) => void
  updateSettings: (s: Partial<Settings>) => void
  applyThemeById: (id: string) => void
  setCommandPaletteOpen: (b: boolean) => void
  setInlineAi: (open: boolean, target?: { line: number; selection: string } | null) => void
  setEnhancerLoading: (b: boolean) => void
}

let msgIdCounter = 0
const uid = () => `msg_${++msgIdCounter}_${Date.now()}`

function getLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'c',
    html: 'html', css: 'css', scss: 'scss', json: 'json', yaml: 'yaml',
    yml: 'yaml', md: 'markdown', sh: 'shell', toml: 'toml', sql: 'sql',
    dart: 'dart', swift: 'swift', kt: 'kotlin', rb: 'ruby', php: 'php',
  }
  return map[ext] || 'plaintext'
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      openFiles: [], activeFileIndex: 0, folderPath: null, splitEnabled: false,
      aiMessages: [], aiLoading: false, aiError: null,
      aiResponseStartTime: null, aiLastResponseTime: null,
      agentRunning: false, agentPaused: false, agentCurrentStep: 0,
      agentTotalSteps: 0, agentCurrentTool: '', agentWebSocket: null,
      agentTerminalId: null, inlineErrors: [],

      previewActive: false, previewUrl: null, previewFilePath: null,
      editModeActive: false, editingElement: null, pendingChanges: [], previewConsole: [],
      gitFiles: [], gitBranch: 'main', gitLog: [], commitMessage: '',
      searchQuery: '', searchResults: [], searchLoading: false, replaceQuery: '',
      terminalTabs: [{ id: 'term_1', name: 'Terminal 1' }], activeTerminalTab: 'term_1',
      activePanel: 'files',
      settings: defaultSettings,
      theme: themes[0],
      commandPaletteOpen: false, inlineAiOpen: false, inlineAiTarget: null,
      enhancerLoading: false,
      availableModels: {
        groq: ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant", "llama3-8b-8192", "mixtral-8x7b-32768", "gemma2-9b-it"],
        gemini: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.0-flash"],
        claude: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-4-20250514", "claude-3-5-sonnet-20241022", "claude-3-opus-20240229"],
        ollama: []
      },

      // ── File actions ───────────────────────────────────────────────────────
      setFolderPath: (p) => set({ folderPath: p }),

      openNewFolder: async () => {
        if (!window.api) return
        const p = await window.api.openFolder()
        if (!p) return

        const { openFiles } = get()
        const hasDirty = openFiles.some(f => f.isDirty)
        if (hasDirty) {
          const ok = confirm('Opening a new project will close current session.\nUnsaved changes will be lost. Continue?')
          if (!ok) return
        } else if (openFiles.length > 0) {
          const ok = confirm('Opening a new project will close current session. Continue?')
          if (!ok) return
        }

        // Notify sidecar of new workspace
        try {
          await fetch('http://localhost:8765/set-workspace', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: p })
          })
        } catch { /* sidecar may not be running — non-fatal */ }

        set({
          folderPath: p,
          openFiles: [],
          activeFileIndex: 0,
          aiMessages: [],
          searchResults: [],
          searchQuery: '',
          gitFiles: [],
          gitBranch: 'main',
          gitLog: [],
          commitMessage: '',
        })
      },

      openFile: (file) => set((s) => {
        const existing = s.openFiles.findIndex(f => f.path === file.path)
        if (existing >= 0) return { activeFileIndex: existing }
        return { openFiles: [...s.openFiles, file], activeFileIndex: s.openFiles.length }
      }),

      closeFile: (index) => set((s) => {
        const files = s.openFiles.filter((_, i) => i !== index)
        const active = Math.min(s.activeFileIndex, Math.max(0, files.length - 1))
        return { openFiles: files, activeFileIndex: active }
      }),

      setActiveFile: (index) => set({ activeFileIndex: index }),

      updateFileContent: (index, content, dirty = true) => set((s) => {
        const files = [...s.openFiles]
        if (files[index]) files[index] = { ...files[index], content, isDirty: dirty }
        return { openFiles: files }
      }),

      saveFile: async (index) => {
        const { openFiles } = get()
        const file = openFiles[index]
        if (!file || !window.api) return
        await window.api.writeFile(file.path, file.content)
        set((s) => {
          const files = [...s.openFiles]
          if (files[index]) files[index] = { ...files[index], isDirty: false }
          return { openFiles: files }
        })
      },

      saveAllFiles: async () => {
        const { openFiles } = get()
        for (let i = 0; i < openFiles.length; i++) {
          if (openFiles[i].isDirty) await get().saveFile(i)
        }
      },

      toggleSplit: () => set((s) => ({ splitEnabled: !s.splitEnabled })),

      renameOpenFile: (oldPath, newPath, newName) => set((s) => ({
        openFiles: s.openFiles.map(f =>
          f.path === oldPath
            ? { ...f, path: newPath, name: newName, language: getLanguage(newName) }
            : f
        )
      })),

      // ── AI actions ─────────────────────────────────────────────────────────
      addAiMessage: (msg) => {
        const id = uid()
        set((s) => ({
          aiMessages: [...s.aiMessages, { ...msg, id, timestamp: Date.now() }]
        }))
        return id
      },

      updateAiMessage: (id, content, streaming = false) => set((s) => ({
        aiMessages: s.aiMessages.map(m => m.id === id ? { ...m, content, isStreaming: streaming } : m)
      })),

      clearAiMessages: () => set({ aiMessages: [] }),
      setAiLoading: (aiLoading) => set({ aiLoading }),
      setAiError: (aiError) => set({ aiError }),

      // ── Agent actions ──────────────────────────────────────────────────────
      setAgentRunning: (running) => set({ agentRunning: running }),
      setAgentPaused: (paused) => set({ agentPaused: paused }),
      setAgentTerminalId: (id) => set({ agentTerminalId: id }),
      setInlineErrors: (errors) => set({ inlineErrors: errors }),
      clearInlineErrors: () => set({ inlineErrors: [] }),
      setAgentStatus: (step, total, tool) => set({ agentCurrentStep: step, agentTotalSteps: total, agentCurrentTool: tool }),
      setAgentWebSocket: (ws) => set({ agentWebSocket: ws }),

      // ── Live Preview + Edit Mode actions ───────────────────────────────────
      setPreviewActive: (active, url, filePath) => set({
        previewActive: active,
        previewUrl: active ? (url ?? null) : null,
        previewFilePath: active ? (filePath ?? null) : null,
        ...(active ? {} : { editModeActive: false, editingElement: null, pendingChanges: [] }),
      }),
      setEditModeActive: (active) => set({ editModeActive: active, ...(active ? {} : { editingElement: null }) }),
      setEditingElement: (el) => set({ editingElement: el }),
      setPendingChanges: (changes) => set({ pendingChanges: changes }),
      addPreviewConsole: (level, text) => set((s) => ({
        previewConsole: [...s.previewConsole.slice(-99), { level, text }],
      })),
      clearPreviewConsole: () => set({ previewConsole: [] }),

      pauseAgent: () => {
        const { agentWebSocket, agentPaused } = get()
        const newPaused = !agentPaused
        set({ agentPaused: newPaused })
        if (agentWebSocket && agentWebSocket.readyState === WebSocket.OPEN) {
          agentWebSocket.send(JSON.stringify({ type: newPaused ? 'pause' : 'resume' }))
        }
      },
      stopAgent: () => {
        const { agentWebSocket } = get()
        if (agentWebSocket && agentWebSocket.readyState === WebSocket.OPEN) {
          agentWebSocket.send(JSON.stringify({ type: 'cancel' }))
          agentWebSocket.close()
        }
        set({ agentRunning: false, agentPaused: false, agentCurrentStep: 0, agentTotalSteps: 0, agentCurrentTool: '', agentWebSocket: null, aiLoading: false })
      },
      resetAgentState: () => set({ agentRunning: false, agentPaused: false, agentCurrentStep: 0, agentTotalSteps: 0, agentCurrentTool: '', agentWebSocket: null }),

      sendAiMessage: async (text) => {
        const { settings, aiMessages, addAiMessage, updateAiMessage, setAiLoading, openFiles, activeFileIndex } = get()
        const activeFile = openFiles[activeFileIndex]
        const provider = settings.activeProvider
        const mode = settings.activeMode || 'ask'

        // Add user message
        addAiMessage({ role: 'user', content: text, provider, mode })
        setAiLoading(true)
        set({ aiResponseStartTime: Date.now(), aiLastResponseTime: null })

        const assistantId = addAiMessage({
          role: 'assistant', content: '', provider, isStreaming: true, mode, agentSteps: [], planSteps: []
        })

        const systemPrompt = `You are CodeDroid AI Copilot, an expert coding assistant embedded in an IDE.
${activeFile ? `\nCurrently open file: ${activeFile.name}\n\`\`\`${activeFile.language}\n${activeFile.content.slice(0, 3000)}\n\`\`\`` : ''}
Be concise, technical, and precise. Format code with proper markdown code blocks.`

        const history = aiMessages.filter(m => m.role !== 'tool').map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content
        }))

        // ─── Try Sidecar first (Required for Tools, better for Ollama) ─────────
        const trySidecar = async () => {
          return new Promise<boolean>((resolve) => {
            try {
              const ws = new WebSocket('ws://127.0.0.1:8765/ws/chat')
              let fullText = ''
              let hasReceivedData = false

              ws.onopen = () => {
                const key = provider === 'groq' ? settings.groqKey : provider === 'gemini' ? settings.geminiKey : provider === 'claude' ? settings.claudeKey : ''
                const model = provider === 'groq' ? settings.groqModel : provider === 'gemini' ? settings.geminiModel : provider === 'claude' ? settings.claudeModel : settings.ollamaModel

                ws.send(JSON.stringify({
                  messages: [...history, { role: 'user', content: text }],
                  provider, api_key: key, model, host: settings.ollamaHost,
                  system: systemPrompt,
                  mode,
                  skills: []
                }))
              }

              ws.onmessage = (event) => {
                hasReceivedData = true
                clearTimeout(timeout)
                const data = JSON.parse(event.data)
                if (data.type === 'token') {
                  fullText += data.text
                  updateAiMessage(assistantId, fullText, true)
                } else if (data.type === 'tool_start') {
                  const step = { id: uid(), tool: data.tool, input: JSON.stringify(data.args || {}), status: 'running' as const }
                  set((s) => ({
                    aiMessages: s.aiMessages.map(m => m.id === assistantId
                      ? { ...m, agentSteps: [...(m.agentSteps || []), step] } : m)
                  }))
                } else if (data.type === 'tool_end') {
                  set((s) => ({
                    aiMessages: s.aiMessages.map(m => m.id === assistantId
                      ? { ...m, agentSteps: (m.agentSteps || []).map(st => st.tool === data.tool && st.status === 'running' ? { ...st, output: data.output, status: 'success' as const } : st) } : m)
                  }))
                } else if (data.type === 'done') {
                  updateAiMessage(assistantId, fullText, false)
                  setAiLoading(false)
                  const endTime = Date.now()
                  set({ aiLastResponseTime: endTime - (get().aiResponseStartTime || endTime), aiResponseStartTime: null })
                  ws.close()
                  resolve(true)
                } else if (data.type === 'error') {
                  updateAiMessage(assistantId, `Sidecar error: ${data.message}`, false)
                  setAiLoading(false)
                  ws.close()
                  resolve(true) // handled — don't fall through to direct
                }
              }

              ws.onerror = () => {
                if (!hasReceivedData) resolve(false)
              }

              // Timeout if sidecar is totally unresponsive
              const timeout = setTimeout(() => { if (!hasReceivedData) { ws.close(); resolve(false) } }, 1500)
            } catch { resolve(false) }
          })
        }

        // ─── Fallback: Direct API Calls ────────────────────────────────────────
        const runDirect = async () => {
          try {
            let fullText = ''
            if (provider === 'groq') {
              const groqModel = settings.groqModel || 'llama3-70b-8192'
              const GROQ_MAX: Record<string, number> = {
                'llama3-70b-8192': 8192, 'llama3-8b-8192': 8192,
                'mixtral-8x7b-32768': 32768, 'gemma2-9b-it': 8192, 'default': 8192
              }
              const maxTokens = GROQ_MAX[groqModel] ?? GROQ_MAX['default']
              const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${settings.groqKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: groqModel, stream: true, max_tokens: maxTokens,
                  messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: text }]
                })
              })
              const reader = res.body!.getReader(); const dec = new TextDecoder()
              while (true) {
                const { done, value } = await reader.read(); if (done) break
                const chunk = dec.decode(value)
                for (const line of chunk.split('\n')) {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      const d = JSON.parse(line.slice(6))
                      fullText += d.choices?.[0]?.delta?.content || ''
                      updateAiMessage(assistantId, fullText, true)
                    } catch {}
                  }
                }
              }
            } else if (provider === 'ollama') {
              // Use Native Bridge for Ollama Chat to avoid CORS
              if (window.api && (window.api as any).ollamaChat) {
                ;(window.api as any).removeOllamaListeners?.()
                ;(window.api as any).onOllamaChunk?.((chunk: any) => {
                  fullText += chunk.message?.content || ''
                  updateAiMessage(assistantId, fullText, true)
                })
                ;(window.api as any).onOllamaDone?.(() => {
                  updateAiMessage(assistantId, fullText, false)
                  setAiLoading(false)
                })
                const res = await (window.api as any).ollamaChat(settings.ollamaHost, {
                  model: settings.ollamaModel, stream: true,
                  messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: text }]
                })
                if (!res.ok) {
                  updateAiMessage(assistantId, `Ollama error: ${res.error}`, false)
                  setAiLoading(false)
                }
                return
              }
              const res = await fetch(`${settings.ollamaHost}/api/chat`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: settings.ollamaModel, stream: true,
                  messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: text }]
                })
              })
              const reader = res.body!.getReader(); const dec = new TextDecoder()
              while (true) {
                const { done, value } = await reader.read(); if (done) break
                const chunk = dec.decode(value)
                for (const line of chunk.split('\n')) {
                  if (line.trim()) {
                    try { const d = JSON.parse(line); fullText += d.message?.content || ''; updateAiMessage(assistantId, fullText, true) } catch {}
                  }
                }
              }
            } else if (provider === 'gemini') {
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${settings.geminiModel}:generateContent?key=${settings.geminiKey}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  system_instruction: { parts: [{ text: systemPrompt }] },
                  contents: [...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), { role: 'user', parts: [{ text: text }] }]
                })
              })
              const data = await res.json()
              fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
            } else if (provider === 'claude') {
              const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: { 'x-api-key': settings.claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  model: settings.claudeModel || 'claude-sonnet-4-20250514',
                  max_tokens: 4096, stream: true,
                  system: systemPrompt,
                  messages: [...history, { role: 'user', content: text }]
                })
              })
              const reader = res.body!.getReader(); const dec = new TextDecoder()
              while (true) {
                const { done, value } = await reader.read(); if (done) break
                const chunk = dec.decode(value)
                for (const line of chunk.split('\n')) {
                  if (line.startsWith('data: ')) {
                    try {
                      const d = JSON.parse(line.slice(6))
                      if (d.type === 'content_block_delta') { fullText += d.delta?.text || ''; updateAiMessage(assistantId, fullText, true) }
                    } catch {}
                  }
                }
              }
            }
            updateAiMessage(assistantId, fullText, false)
            const endTime = Date.now()
            set({ aiLastResponseTime: endTime - (get().aiResponseStartTime || endTime), aiResponseStartTime: null })
          } catch (e: any) {
            updateAiMessage(assistantId, `Error: ${e.message}. Please check your connection or API keys.`, false)
            set({ aiResponseStartTime: null })
          } finally {
            setAiLoading(false)
          }
        }

        const success = await trySidecar()
        if (!success) await runDirect()
      },

      fetchModels: async (provider) => {
        const { settings, setAiError } = get()
        try {
          if (provider === 'ollama') {
            // Use Native IPC Bridge to bypass CORS
            if (window.api && window.api.getOllamaModels) {
              const res = await window.api.getOllamaModels(settings.ollamaHost)
              if (res.ok && res.models && res.models.length > 0) {
                set((s) => ({ availableModels: { ...s.availableModels, ollama: res.models } }))
                return
              } else if (!res.ok) {
                console.warn("Native Ollama fetch failed:", res.error)
              }
            }

            // Fallback 1: Try via Python sidecar
            try {
              const res = await fetch(`http://localhost:8765/models/ollama?host=${encodeURIComponent(settings.ollamaHost)}`)
              const data = await res.json()
              if (data.ok && data.models && data.models.length > 0) {
                set((s) => ({ availableModels: { ...s.availableModels, ollama: data.models } }))
                return
              }
            } catch {}

            // Fallback 2: Direct (will likely fail CORS but good to have)
            const res = await fetch(`${settings.ollamaHost}/api/tags`)
            const data = await res.json()
            const models = data.models?.map((m: any) => m.name) || []
            if (models.length > 0) {
              set((s) => ({ availableModels: { ...s.availableModels, ollama: models } }))
            }
          } else if (provider === 'groq' && settings.groqKey) {
            const res = await fetch('https://api.groq.com/openai/v1/models', {
              headers: { 'Authorization': `Bearer ${settings.groqKey}` }
            })
            const data = await res.json()

            // Groq's API returns ALL models including whisper, vision, openai/*, compound-beta.
            // Only keep real text-generation chat models that work with /chat/completions.
            const GROQ_CHAT_MODELS = [
              'openai/gpt-oss-120b',          // OpenAI open-weight, 128K ctx, agentic
              'openai/gpt-oss-20b',           // OpenAI open-weight, faster/smaller
              'llama-3.3-70b-versatile',
              'llama-3.1-70b-versatile',
              'llama-3.1-8b-instant',
              'llama3-70b-8192',
              'llama3-8b-8192',
              'mixtral-8x7b-32768',
              'gemma2-9b-it',
              'gemma-7b-it',
              'llama3-groq-70b-8192-tool-use-preview',
              'llama3-groq-8b-8192-tool-use-preview',
            ]

            const rawIds: string[] = data.data?.map((m: any) => m.id) || []

            // Filter out non-chat models: audio transcription, TTS, vision-only, guard models
            // openai/gpt-oss-* ARE valid Groq chat models — keep them
            const fetchedSafe = rawIds.filter((id: string) =>
              !id.includes('whisper') &&
              !id.includes('-tts') &&
              !id.includes('guard') &&
              !id.startsWith('compound')   // compound-* are system agents, not direct chat models
            )

            // Merge: known safe list first, then any extra fetched ones, deduped
            const merged = [
              ...GROQ_CHAT_MODELS.filter(m => rawIds.includes(m) || rawIds.length === 0),
              ...fetchedSafe.filter((m: string) => !GROQ_CHAT_MODELS.includes(m)),
            ]

            const models = merged.length > 0 ? merged : GROQ_CHAT_MODELS
            set((s) => ({ availableModels: { ...s.availableModels, groq: models } }))

            // If current model is not in the safe list, reset to best available
            const currentModel = get().settings.groqModel
            if (!models.includes(currentModel)) {
              const fallback = models.find(m => m.includes('llama-3.3') || m.includes('llama3-70b')) || models[0]
              if (fallback) {
                set((s) => ({ settings: { ...s.settings, groqModel: fallback } }))
              }
            }
          } else if (provider === 'gemini' && settings.geminiKey) {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${settings.geminiKey}`)
            const data = await res.json()
            const models = data.models?.map((m: any) => m.name.replace('models/', '')).filter((m: string) => m.includes('gemini')) || []
            if (models.length > 0) {
              set((s) => ({ availableModels: { ...s.availableModels, gemini: models } }))
            }
          }
        } catch (e: any) {
          console.error(`Failed to fetch ${provider} models:`, e)
          if (provider === 'ollama') setAiError(`Ollama Error: ${e.message}. Ensure Ollama is running.`)
        }
      },

      // ── Git actions ────────────────────────────────────────────────────────
      loadGitStatus: async () => {
        const { folderPath } = get()
        if (!folderPath || !window.api) return

        const statusRes = await window.api.gitRun(folderPath, ['status', '--porcelain'])
        if (statusRes.ok) {
          const files: GitFileStatus[] = statusRes.stdout.split('\n').filter(Boolean).map(line => {
            const code = line.slice(0, 2).trim()
            const path = line.slice(3).trim()
            const staged = line[0] !== ' ' && line[0] !== '?'
            return { path, status: (code[0] || code[1] || 'U') as any, staged }
          })
          set({ gitFiles: files })
        }

        const branchRes = await window.api.gitRun(folderPath, ['branch', '--show-current'])
        if (branchRes.ok) set({ gitBranch: branchRes.stdout.trim() })

        const logRes = await window.api.gitRun(folderPath, ['log', '--oneline', '-20'])
        if (logRes.ok) set({ gitLog: logRes.stdout.split('\n').filter(Boolean) })
      },

      stageFile: async (filePath) => {
        const { folderPath } = get()
        if (!folderPath || !window.api) return
        await window.api.gitRun(folderPath, ['add', filePath])
        await get().loadGitStatus()
      },

      unstageFile: async (filePath) => {
        const { folderPath } = get()
        if (!folderPath || !window.api) return
        await window.api.gitRun(folderPath, ['reset', 'HEAD', filePath])
        await get().loadGitStatus()
      },

      setCommitMessage: (m) => set({ commitMessage: m }),

      commitChanges: async () => {
        const { folderPath, commitMessage } = get()
        if (!folderPath || !commitMessage || !window.api) return
        await window.api.gitRun(folderPath, ['commit', '-m', `"${commitMessage}"`])
        set({ commitMessage: '' })
        await get().loadGitStatus()
      },

      gitPush: async () => {
        const { folderPath } = get()
        if (!folderPath || !window.api) return
        await window.api.gitRun(folderPath, ['push'])
      },

      gitPull: async () => {
        const { folderPath } = get()
        if (!folderPath || !window.api) return
        await window.api.gitRun(folderPath, ['pull'])
        await get().loadGitStatus()
      },

      // ── Search actions ─────────────────────────────────────────────────────
      setSearchQuery: (q) => set({ searchQuery: q }),
      setReplaceQuery: (q) => set({ replaceQuery: q }),

      runSearch: async (opts = {}) => {
        const { folderPath, searchQuery } = get()
        if (!folderPath || !searchQuery || !window.api) return
        set({ searchLoading: true, searchResults: [] })
        const results = await window.api.searchInFiles(folderPath, searchQuery, opts)
        set({ searchResults: results, searchLoading: false })
      },

      replaceAll: async () => {
        const { searchResults, replaceQuery, searchQuery } = get()
        if (!window.api) return
        const byFile = new Map<string, SearchResult[]>()
        for (const r of searchResults) {
          if (!byFile.has(r.filePath)) byFile.set(r.filePath, [])
          byFile.get(r.filePath)!.push(r)
        }
        for (const [filePath, _] of byFile) {
          const res = await window.api.readFile(filePath)
          if (res.ok) {
            const newContent = res.content.split(searchQuery).join(replaceQuery)
            await window.api.writeFile(filePath, newContent)
          }
        }
        await get().runSearch()
      },

      // ── Terminal actions ───────────────────────────────────────────────────
      addTerminalTab: (cwd?) => set((s) => {
        const id = `term_${Date.now()}`
        const name = `Terminal ${s.terminalTabs.length + 1}`
        return {
          terminalTabs: [...s.terminalTabs, { id, name, cwd: cwd || undefined }],
          activeTerminalTab: id,
        }
      }),

      addAgentTerminal: (cwd?) => {
        const existing = get().agentTerminalId
        if (existing) {
          set({ activeTerminalTab: existing })
          return existing
        }
        const id = `agent_term_${Date.now()}`
        set((s) => ({
          terminalTabs: [...s.terminalTabs, { id, name: '🤖 Agent', cwd: cwd || s.folderPath || undefined, isAgentTab: true }],
          activeTerminalTab: id,
          agentTerminalId: id,
        }))
        return id
      },

      removeTerminalTab: (id) => set((s) => {
        const tabs = s.terminalTabs.filter(t => t.id !== id)
        return {
          terminalTabs: tabs,
          activeTerminalTab: tabs[tabs.length - 1]?.id || null,
        }
      }),

      setActiveTerminalTab: (id) => set({ activeTerminalTab: id }),

      // ── UI actions ─────────────────────────────────────────────────────────
      setActivePanel: (activePanel) => set({ activePanel }),

      updateSettings: (s) => set((st) => ({
        settings: { ...st.settings, ...s }
      })),

      applyThemeById: (id) => {
        const theme = themes.find(t => t.id === id) || themes[0]
        applyTheme(theme)
        set({ theme })
        get().updateSettings({ themeId: id })
      },

      setCommandPaletteOpen: (b) => set({ commandPaletteOpen: b }),

      setInlineAi: (open, target = null) => set({ inlineAiOpen: open, inlineAiTarget: target }),

      setEnhancerLoading: (enhancerLoading) => set({ enhancerLoading }),
    }),
    {
      name: 'codedroid-store',
      partialize: (s) => ({
        settings: s.settings,
        folderPath: s.folderPath,
        availableModels: s.availableModels
      }),
    }
  )
)