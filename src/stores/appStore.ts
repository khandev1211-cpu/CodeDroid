import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { themes, applyTheme, Theme } from '../themes/themes'

// ─── Types ────────────────────────────────────────────────────────────────────
export type AiProvider = 'groq' | 'gemini' | 'ollama' | 'claude'
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

export interface AiMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  provider: AiProvider
  toolName?: string
  timestamp: number
  isStreaming?: boolean
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
  claudeKey: '', groqModel: 'llama3-70b-8192', geminiModel: 'gemini-1.5-pro',
  ollamaModel: 'llama3', claudeModel: 'claude-sonnet-4-20250514',
  activeProvider: 'groq',
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

  // Actions: Files
  setFolderPath: (p: string | null) => void
  openFile: (file: OpenFile) => void
  closeFile: (index: number) => void
  setActiveFile: (index: number) => void
  updateFileContent: (index: number, content: string, dirty?: boolean) => void
  saveFile: (index: number) => Promise<void>
  saveAllFiles: () => Promise<void>
  toggleSplit: () => void

  // Actions: AI
  addAiMessage: (msg: Omit<AiMessage, 'id' | 'timestamp'>) => string
  updateAiMessage: (id: string, content: string, streaming?: boolean) => void
  clearAiMessages: () => void
  setAiLoading: (b: boolean) => void
  setAiError: (e: string | null) => void
  sendAiMessage: (text: string) => Promise<void>

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
  addTerminalTab: () => void
  removeTerminalTab: (id: string) => void
  setActiveTerminalTab: (id: string) => void

  // Actions: UI
  setActivePanel: (p: Panel) => void
  updateSettings: (s: Partial<Settings>) => void
  applyThemeById: (id: string) => void
  setCommandPaletteOpen: (b: boolean) => void
  setInlineAi: (open: boolean, target?: { line: number; selection: string } | null) => void
}

let msgIdCounter = 0
const uid = () => `msg_${++msgIdCounter}_${Date.now()}`

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // ── Initial state ──────────────────────────────────────────────────────
      openFiles: [], activeFileIndex: 0, folderPath: null, splitEnabled: false,
      aiMessages: [], aiLoading: false, aiError: null,
      gitFiles: [], gitBranch: 'main', gitLog: [], commitMessage: '',
      searchQuery: '', searchResults: [], searchLoading: false, replaceQuery: '',
      terminalTabs: [{ id: 'term_1', name: 'Terminal 1' }], activeTerminalTab: 'term_1',
      activePanel: 'files',
      settings: defaultSettings,
      theme: themes[0],
      commandPaletteOpen: false, inlineAiOpen: false, inlineAiTarget: null,

      // ── File actions ───────────────────────────────────────────────────────
      setFolderPath: (p) => set({ folderPath: p }),

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

      sendAiMessage: async (text) => {
        const { settings, aiMessages, addAiMessage, updateAiMessage, setAiLoading, openFiles, activeFileIndex } = get()
        const activeFile = openFiles[activeFileIndex]

        // Add user message
        addAiMessage({ role: 'user', content: text, provider: settings.activeProvider })
        setAiLoading(true)

        const assistantId = addAiMessage({
          role: 'assistant', content: '', provider: settings.activeProvider, isStreaming: true
        })

        try {
          const history = aiMessages.filter(m => m.role !== 'tool').map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          }))

          const systemPrompt = `You are CodeDroid AI Copilot, an expert coding assistant embedded in an IDE.
${activeFile ? `\nCurrently open file: ${activeFile.name}\n\`\`\`${activeFile.language}\n${activeFile.content.slice(0, 3000)}\n\`\`\`` : ''}
Be concise, technical, and precise. Format code with proper markdown code blocks.`

          let fullText = ''

          if (settings.activeProvider === 'groq') {
            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${settings.groqKey}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: settings.groqModel, stream: true, max_tokens: 4096,
                messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: text }]
              })
            })
            const reader = res.body!.getReader()
            const dec = new TextDecoder()
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
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
          } else if (settings.activeProvider === 'gemini') {
            const res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${settings.geminiModel}:generateContent?key=${settings.geminiKey}`,
              {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  system_instruction: { parts: [{ text: systemPrompt }] },
                  contents: [...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
                    { role: 'user', parts: [{ text: text }] }]
                })
              }
            )
            const data = await res.json()
            fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
          } else if (settings.activeProvider === 'claude') {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: { 'x-api-key': settings.claudeKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: settings.claudeModel, max_tokens: 4096, stream: true,
                system: systemPrompt,
                messages: [...history, { role: 'user', content: text }]
              })
            })
            const reader = res.body!.getReader()
            const dec = new TextDecoder()
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunk = dec.decode(value)
              for (const line of chunk.split('\n')) {
                if (line.startsWith('data: ')) {
                  try {
                    const d = JSON.parse(line.slice(6))
                    if (d.type === 'content_block_delta') {
                      fullText += d.delta?.text || ''
                      updateAiMessage(assistantId, fullText, true)
                    }
                  } catch {}
                }
              }
            }
          } else if (settings.activeProvider === 'ollama') {
            const res = await fetch(`${settings.ollamaHost}/api/chat`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: settings.ollamaModel, stream: true,
                messages: [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: text }]
              })
            })
            const reader = res.body!.getReader()
            const dec = new TextDecoder()
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              const chunk = dec.decode(value)
              for (const line of chunk.split('\n')) {
                if (line.trim()) {
                  try {
                    const d = JSON.parse(line)
                    fullText += d.message?.content || ''
                    updateAiMessage(assistantId, fullText, true)
                  } catch {}
                }
              }
            }
          }

          updateAiMessage(assistantId, fullText, false)
        } catch (e: any) {
          updateAiMessage(assistantId, `Error: ${e.message}`, false)
        } finally {
          setAiLoading(false)
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
      addTerminalTab: () => set((s) => {
        const id = `term_${Date.now()}`
        const name = `Terminal ${s.terminalTabs.length + 1}`
        return {
          terminalTabs: [...s.terminalTabs, { id, name }],
          activeTerminalTab: id,
        }
      }),

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
    }),
    {
      name: 'codedroid-store',
      partialize: (s) => ({ settings: s.settings, folderPath: s.folderPath }),
    }
  )
)