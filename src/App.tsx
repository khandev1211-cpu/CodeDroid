import { useEffect, useCallback, useRef } from 'react'
import { useStore } from './stores/appStore'
import { applyTheme, themes } from './themes/themes'
import TitleBar from './components/TitleBar'
import ActivityBar from './components/ActivityBar'
import Sidebar from './components/sidebar/Sidebar'
import EditorArea from './components/editor/EditorArea'
import AiPanel from './components/ai/AiPanel'
import TerminalPanel from './components/terminal/TerminalPanel'
import StatusBar from './components/StatusBar'
import CommandPalette from './components/CommandPalette'
import ToastContainer from './components/ui/ToastContainer'
import { useResizable } from './hooks/useResizable'
import { notify } from './lib/notifications'
import './styles/global.css'

export default function App() {
  const {
    settings, theme, commandPaletteOpen,
    setCommandPaletteOpen, saveAllFiles, applyThemeById,
    updateSettings, openFiles, activeFileIndex, saveFile,
    fetchModels, loadEncryptedKeys,
  } = useStore()

  // ── Resizable panels ──────────────────────────────────────────────────────
  const sidebar = useResizable({
    direction: 'horizontal',
    initial:   settings.sidebarWidth,
    min: 160, max: 600,
    onEnd: (v) => updateSettings({ sidebarWidth: v }),
  })

  const aiPanel = useResizable({
    direction: 'horizontal',
    initial:   settings.aiPanelWidth,
    min: 260, max: 700,
    reverse: true,
    onEnd: (v) => updateSettings({ aiPanelWidth: v }),
  })

  const terminal = useResizable({
    direction: 'vertical',
    initial:   settings.terminalHeight,
    min: 80, max: 600,
    reverse: true,
    onEnd: (v) => updateSettings({ terminalHeight: v }),
  })

  // ── Startup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    loadEncryptedKeys()

    const saved = themes.find(t => t.id === settings.themeId) || themes[0]
    applyTheme(saved)

    window.dispatchEvent(new Event('codedroid-app-ready'))

    const timer = setTimeout(async () => {
      fetchModels('ollama')
      if (settings.groqKey)   fetchModels('groq')
      if (settings.geminiKey) fetchModels('gemini')
    }, 3000)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key === 's' && !e.shiftKey) {
      e.preventDefault()
      saveFile(activeFileIndex)
      notify.success('File saved')
    }
    if (ctrl && e.shiftKey && e.key === 'S') {
      e.preventDefault()
      saveAllFiles()
      notify.success('All files saved')
    }
    if (ctrl && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
      e.preventDefault()
      setCommandPaletteOpen(true)
    }
    if (ctrl && e.key === 'b') {
      e.preventDefault()
      updateSettings({ showSidebar: !settings.showSidebar })
    }
    if (ctrl && e.key === 'j') {
      e.preventDefault()
      updateSettings({ showTerminal: !settings.showTerminal })
    }
    if (ctrl && e.key === '`') {
      e.preventDefault()
      updateSettings({ showTerminal: !settings.showTerminal })
    }
    if (e.key === 'Escape' && commandPaletteOpen) {
      setCommandPaletteOpen(false)
    }
  }, [settings, activeFileIndex, commandPaletteOpen, saveFile, saveAllFiles,
      setCommandPaletteOpen, updateSettings])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // ── Listen for goto-line events from command palette ─────────────────────
  useEffect(() => {
    const handler = (e: Event) => {
      const line = (e as CustomEvent).detail as number
      window.dispatchEvent(new CustomEvent('codedroid-editor-goto', { detail: line }))
    }
    window.addEventListener('codedroid-goto-line', handler)
    return () => window.removeEventListener('codedroid-goto-line', handler)
  }, [])

  const { showSidebar, showAiPanel, showTerminal, showStatusBar } = settings

  return (
    <div className="app-root">
      <TitleBar />
      <div className="app-body">
        <ActivityBar />

        {/* Sidebar + resize handle */}
        {showSidebar && (
          <>
            <div className="sidebar-wrap" style={{ width: sidebar.size }}>
              <Sidebar />
            </div>
            <div
              className={`resize-handle resize-handle-h ${sidebar.dragging ? 'dragging' : ''}`}
              onMouseDown={sidebar.handleMouseDown}
            />
          </>
        )}

        {/* Main area */}
        <div className="main-area">
          <div className="editor-terminal-col">
            {/* Editor */}
            <div className="editor-wrap">
              <EditorArea />
            </div>

            {/* Terminal resize handle + terminal */}
            {showTerminal && (
              <>
                <div
                  className={`resize-handle resize-handle-v ${terminal.dragging ? 'dragging' : ''}`}
                  onMouseDown={terminal.handleMouseDown}
                />
                <div className="terminal-wrap" style={{ height: terminal.size }}>
                  <TerminalPanel />
                </div>
              </>
            )}
          </div>

          {/* AI panel resize handle + panel */}
          {showAiPanel && (
            <>
              <div
                className={`resize-handle resize-handle-h ${aiPanel.dragging ? 'dragging' : ''}`}
                onMouseDown={aiPanel.handleMouseDown}
              />
              <div className="ai-wrap" style={{ width: aiPanel.size }}>
                <AiPanel />
              </div>
            </>
          )}
        </div>
      </div>

      {showStatusBar && <StatusBar />}
      {commandPaletteOpen && <CommandPalette />}

      {/* Toast notifications */}
      <ToastContainer />

      {/* Cursor style during drag */}
      {(sidebar.dragging || aiPanel.dragging) && (
        <style>{`* { cursor: col-resize !important; user-select: none !important; }`}</style>
      )}
      {terminal.dragging && (
        <style>{`* { cursor: row-resize !important; user-select: none !important; }`}</style>
      )}
    </div>
  )
}