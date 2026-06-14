import { useEffect, useRef, useState } from 'react'
import { Terminal, Plus, X, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react'
import { useStore } from '../../stores/appStore'
import { getXtermTheme } from '../../themes/themes'
import './TerminalPanel.css'

function TerminalInstance({ id, active, cwd }: { id: string; active: boolean; cwd?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<any>(null)
  const fitRef = useRef<any>(null)
  const { folderPath, theme } = useStore()

  useEffect(() => {
    if (!containerRef.current) return

    let term: any
    let fitAddon: any
    let unlistenData: () => void
    let unlistenExit: () => void
    let unlistenTheme: () => void

    const init = async () => {
      try {
        const { Terminal: XTerm } = await import('@xterm/xterm')
        const { FitAddon } = await import('@xterm/addon-fit')
        const { WebLinksAddon } = await import('@xterm/addon-web-links')

        // Get initial theme from current app theme
        const initialTheme = getXtermTheme(useStore.getState().theme)

        term = new XTerm({
          cursorBlink: true,
          cursorStyle: 'block',
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          theme: initialTheme,
          allowTransparency: true,
          scrollback: 5000,
        })

        fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.loadAddon(new WebLinksAddon())
        term.open(containerRef.current!)
        fitAddon.fit()

        termRef.current = term
        fitRef.current = fitAddon

        // Listen for theme changes and update xterm immediately
        const onThemeChange = (e: Event) => {
          const newTheme = (e as CustomEvent).detail
          if (termRef.current) {
            termRef.current.options.theme = getXtermTheme(newTheme)
            // Force full re-render so colors take effect
            termRef.current.refresh(0, termRef.current.rows - 1)
          }
        }
        window.addEventListener('codedroid-theme-change', onThemeChange)
        unlistenTheme = () => window.removeEventListener('codedroid-theme-change', onThemeChange)

        // Create the real PTY process in the main process
        if (window.api) {
          await window.api.termCreate(id, cwd || folderPath)

          // Data from PTY -> UI
          unlistenData = window.api.onTermData(id, (data: string) => {
            term.write(data)
          })

          // Exit from PTY
          unlistenExit = window.api.onTermExit(id, ({ exitCode }: any) => {
            term.writeln(`\r\n[Process exited with code ${exitCode}]`)
          })

          // UI -> PTY
          term.onData((data: string) => {
            window.api.termWrite(id, data)
          })

          // Resize PTY
          const resize = () => {
            const dims = fitAddon.proposeDimensions()
            if (dims) {
              window.api.termResize(id, dims.cols, dims.rows)
              fitAddon.fit()
            }
          }

          window.addEventListener('resize', resize)
          setTimeout(resize, 100) // Initial fit
        }

      } catch (e) {
        console.warn('Terminal init failed:', e)
      }
    }

    init()

    const resizeObserver = new ResizeObserver(() => {
      if (fitRef.current && termRef.current && window.api) {
        const dims = fitRef.current.proposeDimensions()
        if (dims) {
          window.api.termResize(id, dims.cols, dims.rows)
          fitRef.current.fit()
        }
      }
    })

    if (containerRef.current) resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      unlistenData?.()
      unlistenExit?.()
      unlistenTheme?.()
      if (window.api) window.api.termKill(id)
      term?.dispose()
    }
  }, [id])

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', display: active ? 'block' : 'none', padding: '4px' }}
    />
  )
}

export default function TerminalPanel() {
  const {
    terminalTabs, activeTerminalTab,
    addTerminalTab, removeTerminalTab, setActiveTerminalTab,
    updateSettings, settings
  } = useStore()

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-tabs">
          <Terminal size={12} style={{ color: 'var(--text-dim)', marginRight: 4, flexShrink: 0 }} />
          {terminalTabs.map(tab => (
            <div
              key={tab.id}
              className={`term-tab ${activeTerminalTab === tab.id ? 'active' : ''} ${tab.isAgentTab ? 'agent-tab' : ''}`}
              onClick={() => setActiveTerminalTab(tab.id)}
              title={tab.isAgentTab ? '🤖 Agent Terminal' : tab.name}
            >
              {tab.name}
              {terminalTabs.length > 1 && (
                <button
                  className="term-tab-close"
                  onClick={e => { e.stopPropagation(); removeTerminalTab(tab.id) }}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
          <button className="icon-btn" onClick={addTerminalTab} title="New Terminal" style={{ width: 24, height: 24 }}>
            <Plus size={12} />
          </button>
        </div>
        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
          <button
            className="icon-btn"
            onClick={() => updateSettings({ terminalHeight: Math.max(80, settings.terminalHeight - 60) })}
            title="Shrink"
          >
            <ChevronDown size={13} />
          </button>
          <button
            className="icon-btn"
            onClick={() => updateSettings({ terminalHeight: Math.min(600, settings.terminalHeight + 60) })}
            title="Grow"
          >
            <ChevronUp size={13} />
          </button>
          <button className="icon-btn" onClick={() => updateSettings({ showTerminal: false })} title="Hide Terminal">
            <X size={13} />
          </button>
        </div>
      </div>
      <div className="terminal-body">
        {terminalTabs.map(tab => (
          <TerminalInstance key={tab.id} id={tab.id} active={activeTerminalTab === tab.id} cwd={tab.cwd} />
        ))}
      </div>
    </div>
  )
}