import { useEffect, useRef, useState } from 'react'
import { Terminal, Plus, X, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react'
import { useStore } from '../../stores/appStore'
import './TerminalPanel.css'

function TerminalInstance({ id, active }: { id: string; active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<any>(null)
  const fitRef = useRef<any>(null)
  const { folderPath } = useStore()

  useEffect(() => {
    if (!containerRef.current) return

    let term: any
    let fitAddon: any

    const init = async () => {
      try {
        const { Terminal: XTerm } = await import('@xterm/xterm')
        const { FitAddon } = await import('@xterm/addon-fit')
        const { WebLinksAddon } = await import('@xterm/addon-web-links')

        term = new XTerm({
          cursorBlink: true,
          cursorStyle: 'bar',
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          theme: {
            background: 'var(--terminal)' || '#1e1e1e',
            foreground: '#cccccc',
            cursor: 'var(--accent)' || '#0078d4',
            black: '#000000', red: '#cd3131', green: '#0dbc79',
            yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc',
            cyan: '#11a8cd', white: '#e5e5e5',
            brightBlack: '#666666', brightRed: '#f14c4c',
            brightGreen: '#23d18b', brightYellow: '#f5f543',
            brightBlue: '#3b8eea', brightMagenta: '#d670d6',
            brightCyan: '#29b8db', brightWhite: '#ffffff',
          },
          allowTransparency: true,
          scrollback: 5000,
          rightClickSelectsWord: true,
        })

        fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.loadAddon(new WebLinksAddon())
        term.open(containerRef.current!)
        fitAddon.fit()

        termRef.current = term
        fitRef.current = fitAddon

        // Welcome message
        const cwd = folderPath || process.cwd?.() || '~'
        term.writeln(`\x1b[36mCodeDroid Terminal\x1b[0m · \x1b[33m${cwd}\x1b[0m`)
        term.writeln('')
        term.write('\x1b[32m$ \x1b[0m')

        // Handle user input (basic shell simulation)
        let currentLine = ''

        term.onKey(async ({ key, domEvent }: any) => {
          const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

          if (domEvent.keyCode === 13) { // Enter
            term.writeln('')
            const cmd = currentLine.trim()
            currentLine = ''

            if (cmd) {
              try {
                if (window.api) {
                  const result = await window.api.shellExec(cmd, folderPath || undefined)
                  if (result.stdout) {
                    result.stdout.split('\n').forEach((line: string) => {
                      if (line) term.writeln(line)
                    })
                  }
                  if (result.stderr) {
                    result.stderr.split('\n').forEach((line: string) => {
                      if (line) term.writeln(`\x1b[31m${line}\x1b[0m`)
                    })
                  }
                }
              } catch (e: any) {
                term.writeln(`\x1b[31mError: ${e.message}\x1b[0m`)
              }
            }

            term.write('\x1b[32m$ \x1b[0m')
          } else if (domEvent.keyCode === 8) { // Backspace
            if (currentLine.length > 0) {
              currentLine = currentLine.slice(0, -1)
              term.write('\b \b')
            }
          } else if (domEvent.keyCode === 67 && domEvent.ctrlKey) { // Ctrl+C
            currentLine = ''
            term.writeln('^C')
            term.write('\x1b[32m$ \x1b[0m')
          } else if (printable) {
            currentLine += key
            term.write(key)
          }
        })

      } catch (e) {
        console.warn('Terminal init failed:', e)
      }
    }

    init()

    const resizeObserver = new ResizeObserver(() => {
      try { fitRef.current?.fit() } catch {}
    })
    if (containerRef.current) resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
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
              className={`term-tab ${activeTerminalTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTerminalTab(tab.id)}
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
          <TerminalInstance key={tab.id} id={tab.id} active={activeTerminalTab === tab.id} />
        ))}
      </div>
    </div>
  )
}