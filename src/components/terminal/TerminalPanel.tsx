import { useEffect, useRef, useState } from 'react'
import { Terminal, Plus, X, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react'
import { useStore } from '../../stores/appStore'
import { getXtermTheme } from '../../themes/themes'
import './TerminalPanel.css'

function TerminalInstance({ id, active, cwd }: { id: string; active: boolean; cwd?: string }) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const termRef       = useRef<any>(null)
  const fitRef        = useRef<any>(null)
  const outputBufRef  = useRef<string>('')      // rolling buffer of last ~200 lines
  const [ctxMenu,     setCtxMenu]  = useState<{ x: number; y: number; text: string } | null>(null)
  const [showFix,     setShowFix]  = useState(false)
  const [fixSnapshot, setFixSnapshot] = useState('')
  const fixTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unlistenAgentWriteRef = useRef<(() => void) | undefined>(undefined)
  const { folderPath, theme } = useStore()

  // ── Error detection helper ────────────────────────────────────────────────
  const ERROR_RE = /error|exception|traceback|failed|enoent|cannot find|undefined|syntaxerror|typeerror|valueerror|importerror|npm err/i

  const appendOutput = (chunk: string) => {
    outputBufRef.current = (outputBufRef.current + chunk).split('\n').slice(-200).join('\n')
    // Scan last 50 lines for errors
    const last50 = outputBufRef.current.split('\n').slice(-50).join('\n')
    if (ERROR_RE.test(last50)) {
      setFixSnapshot(last50)
      setShowFix(true)
      if (fixTimerRef.current) clearTimeout(fixTimerRef.current)
      fixTimerRef.current = setTimeout(() => setShowFix(false), 10000)
    }
  }

  const sendToAI = (selected: string, intent: 'fix' | 'explain' | 'ask') => {
    const prompts: Record<string, string> = {
      fix: `I got this error/output from my terminal:\n\`\`\`\n${selected}\n\`\`\`\n\nPlease analyze it, find the root cause, fix the relevant file, and re-run the command.`,
      explain: `Explain this terminal output:\n\`\`\`\n${selected}\n\`\`\``,
      ask: `I have a question about this terminal output:\n\`\`\`\n${selected}\n\`\`\`\n\nWhat does this mean?`,
    }
    const { updateSettings, sendAiMessage } = useStore.getState()
    if (intent === 'fix') updateSettings({ activeMode: 'agent' })
    sendAiMessage(prompts[intent])
    setCtxMenu(null)
  }

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
        const { FitAddon }       = await import('@xterm/addon-fit')
        const { WebLinksAddon }  = await import('@xterm/addon-web-links')
        const initialTheme       = getXtermTheme(useStore.getState().theme)

        term = new XTerm({
          cursorBlink: true, cursorStyle: 'block', fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          theme: initialTheme, allowTransparency: true, scrollback: 5000,
        })
        fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.loadAddon(new WebLinksAddon())
        term.open(containerRef.current!)
        fitAddon.fit()
        termRef.current = term
        fitRef.current  = fitAddon

        // Theme change listener
        const onThemeChange = (e: Event) => {
          const newTheme = (e as CustomEvent).detail
          if (termRef.current) {
            termRef.current.options.theme = getXtermTheme(newTheme)
            termRef.current.refresh(0, termRef.current.rows - 1)
          }
        }
        window.addEventListener('codedroid-theme-change', onThemeChange)
        unlistenTheme = () => window.removeEventListener('codedroid-theme-change', onThemeChange)

        if (window.api) {
          await window.api.termCreate(id, cwd || folderPath)
          unlistenData = window.api.onTermData(id, (data: string) => {
            term.write(data)
            appendOutput(data)
          })
          unlistenExit = window.api.onTermExit(id, ({ exitCode }: any) => {
            term.writeln(`\r\n[Process exited with code ${exitCode}]`)
          })
          term.onData((data: string) => { window.api.termWrite(id, data) })
          const resize = () => {
            const dims = fitAddon.proposeDimensions()
            if (dims) { window.api.termResize(id, dims.cols, dims.rows); fitAddon.fit() }
          }
          window.addEventListener('resize', resize)
          setTimeout(resize, 100)
        }

        // If this is the agent-owned terminal, listen for streamed agent command output
        const isAgentTab = useStore.getState().agentTerminalId === id
        if (isAgentTab) {
          const onAgentWrite = (e: Event) => {
            const { line, isError } = (e as CustomEvent).detail
            if (termRef.current) {
              const prefix = isError ? '\x1b[31m' : ''
              const suffix = isError ? '\x1b[0m' : ''
              termRef.current.write(prefix + line.replace(/\n/g, '\r\n') + suffix)
              appendOutput(line)
            }
          }
          window.addEventListener('codedroid-agent-terminal-write', onAgentWrite)
          unlistenAgentWriteRef.current = () => window.removeEventListener('codedroid-agent-terminal-write', onAgentWrite)
        }
      } catch (e) { console.warn('Terminal init failed:', e) }
    }
    init()

    const resizeObserver = new ResizeObserver(() => {
      if (fitRef.current && termRef.current && window.api) {
        const dims = fitRef.current.proposeDimensions()
        if (dims) { window.api.termResize(id, dims.cols, dims.rows); fitRef.current.fit() }
      }
    })
    if (containerRef.current) resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      unlistenData?.(); unlistenExit?.(); unlistenTheme?.()
      unlistenAgentWriteRef.current?.()
      if (fixTimerRef.current) clearTimeout(fixTimerRef.current)
      if (window.api) window.api.termKill(id)
      term?.dispose()
    }
  }, [id])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    const selected = termRef.current?.getSelection?.() || ''
    setCtxMenu({ x: e.clientX, y: e.clientY, text: selected })
  }

  const handleSnapshot = () => {
    const snap = outputBufRef.current
    const msg = `Here is a snapshot of my terminal output:\n\`\`\`\n${snap.slice(-3000)}\n\`\`\`\n\nPlease analyze it.`
    const { sendAiMessage } = useStore.getState()
    sendAiMessage(msg)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: active ? 'flex' : 'none', flexDirection: 'column' }}>
      {/* Floating Fix Error button */}
      {showFix && active && (
        <button
          className="term-fix-btn"
          onClick={() => { sendToAI(fixSnapshot, 'fix'); setShowFix(false) }}
          title="Send this error to Agent for auto-fix"
        >
          🔧 Fix Error
        </button>
      )}

      <div
        ref={containerRef}
        style={{ flex: 1, padding: '4px' }}
        onContextMenu={handleContextMenu}
      />

      {/* Right-click context menu */}
      {ctxMenu && (
        <div
          className="term-ctx-menu"
          style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 9999 }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          <div className="term-ctx-item" onClick={() => { navigator.clipboard.writeText(ctxMenu.text || outputBufRef.current.slice(-500)); setCtxMenu(null) }}>📋 Copy</div>
          <div className="term-ctx-item" onClick={() => { if (termRef.current) termRef.current.paste(navigator.clipboard.readText() as any); setCtxMenu(null) }}>📌 Paste</div>
          {ctxMenu.text && <>
            <div className="term-ctx-sep" />
            <div className="term-ctx-item term-ctx-ai" onClick={() => sendToAI(ctxMenu.text, 'fix')}>🤖 Fix This Error</div>
            <div className="term-ctx-item term-ctx-ai" onClick={() => sendToAI(ctxMenu.text, 'explain')}>🤖 Explain This</div>
            <div className="term-ctx-item term-ctx-ai" onClick={() => sendToAI(ctxMenu.text, 'ask')}>🤖 Ask About This</div>
          </>}
          <div className="term-ctx-sep" />
          <div className="term-ctx-item" onClick={() => { handleSnapshot(); setCtxMenu(null) }}>📸 Snapshot → AI</div>
          <div className="term-ctx-item" onClick={() => { termRef.current?.clear(); setCtxMenu(null) }}>🗑️ Clear</div>
        </div>
      )}
    </div>
  )
}

export default function TerminalPanel() {
  const {
    terminalTabs, activeTerminalTab,
    addTerminalTab, removeTerminalTab, setActiveTerminalTab,
    updateSettings, settings, agentRunning,
  } = useStore()

  return (
    <div className="terminal-panel">
      <div className="terminal-header">
        <div className="terminal-tabs">
          <Terminal size={12} style={{ color: 'var(--text-dim)', marginRight: 4, flexShrink: 0 }} />
          {terminalTabs.map(tab => (
            <div
              key={tab.id}
              className={`term-tab ${activeTerminalTab === tab.id ? 'active' : ''} ${tab.isAgentTab ? 'agent-tab' : ''} ${tab.isAgentTab && agentRunning ? 'agent-running' : ''}`}
              onClick={() => setActiveTerminalTab(tab.id)}
              title={tab.isAgentTab ? (agentRunning ? '🟠 Agent Running' : '🤖 Agent Terminal') : tab.name}
            >
              {tab.isAgentTab && agentRunning && <span className="agent-running-dot" />}
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