import { useEffect, useCallback } from 'react'
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
import './styles/global.css'

export default function App() {
  const {
    settings, theme, commandPaletteOpen,
    setCommandPaletteOpen, saveAllFiles, applyThemeById,
    updateSettings, openFiles, activeFileIndex, saveFile,
    fetchModels // Added fetchModels
  } = useStore()

  // Apply saved theme and auto-fetch models on startup
  useEffect(() => {
    const saved = themes.find(t => t.id === settings.themeId) || themes[0]
    applyTheme(saved)

    // Signal to index.html that React has actually mounted and painted —
    // this removes the splash screen instead of a blind window.load timer,
    // which could fire before #root has any content (causing a black screen).
    window.dispatchEvent(new Event('codedroid-app-ready'))

    // Auto-fetch models with a slight delay to allow sidecar to boot
    const timer = setTimeout(() => {
      fetchModels('ollama')
      if (settings.groqKey) fetchModels('groq')
      if (settings.geminiKey) fetchModels('gemini')
    }, 3000)

    return () => clearTimeout(timer)
  }, [])

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey
    if (ctrl && e.key === 's' && !e.shiftKey) {
      e.preventDefault()
      saveFile(activeFileIndex)
    }
    if (ctrl && e.shiftKey && e.key === 'S') {
      e.preventDefault()
      saveAllFiles()
    }
    if (ctrl && e.shiftKey && e.key === 'P') {
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
    if (e.key === 'Escape' && commandPaletteOpen) {
      setCommandPaletteOpen(false)
    }
  }, [settings, activeFileIndex, commandPaletteOpen])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const { showSidebar, showAiPanel, showTerminal, showStatusBar,
    sidebarWidth, aiPanelWidth, terminalHeight } = settings

  return (
    <div className="app-root">
      <TitleBar />
      <div className="app-body">
        <ActivityBar />
        {showSidebar && (
          <div className="sidebar-wrap" style={{ width: sidebarWidth }}>
            <Sidebar />
          </div>
        )}
        <div className="main-area">
          <div className="editor-terminal-col">
            <div className="editor-wrap">
              <EditorArea />
            </div>
            {showTerminal && (
              <div className="terminal-wrap" style={{ height: terminalHeight }}>
                <TerminalPanel />
              </div>
            )}
          </div>
          {showAiPanel && (
            <div className="ai-wrap" style={{ width: aiPanelWidth }}>
              <AiPanel />
            </div>
          )}
        </div>
      </div>
      {showStatusBar && <StatusBar />}
      {commandPaletteOpen && <CommandPalette />}
    </div>
  )
}