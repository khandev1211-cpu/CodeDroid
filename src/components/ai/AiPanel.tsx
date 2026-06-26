import { useState, useRef, useEffect, useCallback } from "react"
import {
  Bot, Send, Trash2, Copy, Loader2, Zap, CheckCheck,
  ChevronDown, RefreshCw, Sparkles, Map as MapIcon, History,
  Play, Pause, Square, ChevronRight, Wrench, Brain,
} from "lucide-react"
import { useStore, AiProvider, AiMessage, PlanStep, AgentStep, ElementData, DomChange } from "../../stores/appStore"
import { useHistoryStore } from "../../stores/historyStore"
import { detectSkills, buildSystemPrompt } from "./SkillEngine"
import { Skill } from "../../skills/skillRegistry"
import ChatModeSelector from "./ChatModeSelector"
import PromptEnhancer from "./PromptEnhancer"
import HistoryPanel from "./HistoryPanel"
import ThinkingBlock from "./ThinkingBlock"
import TokenLimitPopup from "./TokenLimitPopup"
import { sidecarHttp, sidecarWs } from "../../lib/sidecar"
import ElementEditActions from "./ElementEditActions"
import PendingChangesPanel from "./PendingChangesPanel"
import { getPreviewSocket } from "../editor/PreviewButton"
import "./AiPanel.css"

// ── Provider config ─────────────────────────────────────────────────────────
const PROVIDER_COLORS: Record<AiProvider, string> = {
  groq: "#f55036", gemini: "#4285f4", ollama: "#aaaaaa", claude: "#d97757"
}
const PROVIDER_LABELS: Record<AiProvider, string> = {
  groq: "Groq", gemini: "Gemini", ollama: "Ollama", claude: "Claude"
}

const SLASH_COMMANDS = [
  { cmd: "/fix",      desc: "Fix bugs in selected code" },
  { cmd: "/explain",  desc: "Explain this code" },
  { cmd: "/refactor", desc: "Refactor for clarity & performance" },
  { cmd: "/tests",    desc: "Generate unit tests" },
  { cmd: "/docs",     desc: "Generate documentation" },
  { cmd: "/optimize", desc: "Optimize for performance" },
  { cmd: "/review",   desc: "Code review with suggestions" },
  { cmd: "/types",    desc: "Add TypeScript types" },
]

function renderMarkdown(text: string) {
  return text
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_,lang,code) =>
      `<div class="code-block"><div class="code-header"><span class="code-lang">${lang||"code"}</span><button class="copy-btn" onclick="navigator.clipboard.writeText(decodeURIComponent(\'${encodeURIComponent(code.trim())}\'))"><svg width=\'12\' height=\'12\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\'><rect x=\'9\' y=\'9\' width=\'13\' height=\'13\' rx=\'2\'/><path d=\'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1\'/></svg> Copy</button></div><pre><code>${code.trim()}</code></pre></div>`)
    .replace(/\`([^\`]+)\`/g,"<code class=\"inline-code\">$1</code>")
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/^### (.+)$/gm,"<h3>$1</h3>")
    .replace(/^## (.+)$/gm,"<h2>$1</h2>")
    .replace(/^- (.+)$/gm,"<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g,s=>`<ul>${s}</ul>`)
    .replace(/\n\n/g,"</p><p>")
}

function MessageBubble({ msg, onExecutePlan }: { msg: AiMessage; onExecutePlan?: (id: string) => void }) {
  const isUser = msg.role === "user"
  const [copied, setCopied] = useState(false)
  const [displayedContent, setDisplayedContent] = useState("")
  const targetRef = useRef(msg.content)
  targetRef.current = msg.content

  useEffect(() => {
    // Determine if we should animate: only animate fresh messages (< 2.5 seconds old) or currently streaming ones.
    const age = Date.now() - msg.timestamp
    const shouldAnimate = !isUser && (msg.isStreaming || age < 2500)

    if (!shouldAnimate) {
      setDisplayedContent(msg.content)
      return
    }

    const interval = setInterval(() => {
      setDisplayedContent((current) => {
        const target = targetRef.current
        if (current.length >= target.length) {
          return target
        }

        // Dynamically adjust typing step size depending on how far behind the stream we are
        const remaining = target.length - current.length
        let step = 1
        if (remaining > 300) step = 25
        else if (remaining > 150) step = 12
        else if (remaining > 60) step = 6
        else if (remaining > 20) step = 3
        else if (remaining > 5) step = 2

        return target.slice(0, current.length + step)
      })
    }, 12)

    return () => clearInterval(interval)
  }, [isUser, msg.timestamp])

  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(()=>setCopied(false),1500) }

  return (
    <div className={`msg-wrap ${isUser?"user":"assistant"}`}>
      <div className={`msg-bubble ${isUser?"msg-user":"msg-ai"}`}>
        {!isUser && (
          <div className="msg-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="provider-badge" style={{ color: PROVIDER_COLORS[msg.provider] }}>
                {PROVIDER_LABELS[msg.provider] || msg.provider}
              </span>
              {msg.mode && (
                <span className={`mode-pill ${msg.mode}`}>
                  {msg.mode === 'plan' ? '🗺️ Plan' : msg.mode === 'agent' ? '🤖 Agent' : '💬 Ask'}
                </span>
              )}
            </div>
            <button className="icon-btn" style={{width:20,height:20}} onClick={copy}>
              {copied ? <CheckCheck size={11} style={{color:"var(--git-added)"}} /> : <Copy size={11} />}
            </button>
          </div>
        )}

        {/* Skills applied */}
        {msg.appliedSkills && msg.appliedSkills.length > 0 && (
          <div className="msg-skills">
            {msg.appliedSkills.map(s => <span key={s} className="skill-tag">🔧 {s}</span>)}
          </div>
        )}

        {isUser
          ? <div className="msg-text">{msg.content}</div>
          : (
            <>
              {/* Thinking block — shown above the answer */}
              {msg.thinking && (
                <ThinkingBlock
                  thinking={msg.thinking}
                  isStreaming={msg.isThinkingStreaming}
                />
              )}

              <div className="msg-md" dangerouslySetInnerHTML={{__html: renderMarkdown(displayedContent)}} />

              {/* Token limit popup — shown when response was cut off */}
              {msg.isTruncated && !msg.isStreaming && (
                <TokenLimitPopup
                  truncatedContent={msg.content}
                  onContinue={() => {
                    window.dispatchEvent(new CustomEvent('codedroid-continue-response', {
                      detail: { messageId: msg.id }
                    }))
                  }}
                  onStop={() => {
                    useStore.setState(s => ({
                      aiMessages: s.aiMessages.map(m =>
                        m.id === msg.id ? { ...m, isTruncated: false } : m
                      )
                    }))
                  }}
                />
              )}

              {/* Plan Steps - Interactive Cards */}
              {msg.planSteps && msg.planSteps.length > 0 && (
                <div className="plan-steps-container">
                  <div className="plan-header-title">Implementation Plan</div>
                  {msg.planSteps.map((step, idx) => (
                    <div key={step.id} className={`plan-step-card ${step.status || 'pending'}`}>
                      <div className="step-num">{idx + 1}</div>
                      <div className="step-content">
                        <div className="step-row">
                          <span className="step-title">{step.title}</span>
                          <span className="step-complexity">{step.estimatedComplexity}</span>
                        </div>
                        <div className="step-description">{step.description}</div>
                        {step.result && <div className="step-result-bubble">{step.result}</div>}
                      </div>
                      <div className="step-status-icon">
                        {step.status === 'completed' && <CheckCheck size={14} style={{color: 'var(--git-added)'}} />}
                        {step.status === 'running' && <Loader2 size={14} className="spin" style={{color: 'var(--accent)'}} />}
                      </div>
                    </div>
                  ))}
                  {msg.mode === 'plan' && !msg.isStreaming && !msg.planSteps.some(s => s.status === 'completed' || s.status === 'running') && (
                    <button className="execute-plan-btn" onClick={() => onExecutePlan?.(msg.id)}>
                      <Play size={12} fill="currentColor" />
                      <span>Execute this plan</span>
                    </button>
                  )}
                </div>
              )}

              {/* Agent Tool Logs */}
              {msg.agentSteps && msg.agentSteps.length > 0 && (
                <div className="agent-logs">
                  <div className="logs-header">Agent Actions</div>
                  {msg.agentSteps.map(step => (
                    <details key={step.id} className={`agent-log-entry ${step.status}`}>
                      <summary>
                        <div className="log-summary">
                          <Zap size={10} />
                          <span className="log-tool">{step.tool}</span>
                          <span className="log-status">{step.status}</span>
                        </div>
                      </summary>
                      <div className="log-details">
                        <div className="log-label">Input:</div>
                        <pre className="log-code">{step.input}</pre>
                        {step.output && (
                          <>
                            <div className="log-label">Output:</div>
                            <pre className="log-code">{step.output}</pre>
                          </>
                        )}
                      </div>
                    </details>
                  ))}
                </div>
              )}
            </>
          )}

        {msg.isStreaming && <span className="streaming-cursor">▋</span>}
      </div>
    </div>
  )
}

function BeautifulLoading() {
  return (
    <div className="msg-wrap assistant">
      <div className="msg-bubble msg-ai loading-state-new">
        <div className="ai-pulse">
          <div className="pulse-ring"></div>
          <Bot size={20} className="pulse-bot" />
        </div>
        <div className="loading-content">
          <div className="loading-title">Analyzing request...</div>
          <div className="loading-bar"><div className="loading-progress"></div></div>
        </div>
      </div>
    </div>
  )
}

function ResponseTimer() {
  const { aiLoading, aiResponseStartTime, aiLastResponseTime } = useStore()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    let interval: any
    if (aiLoading && aiResponseStartTime) {
      interval = setInterval(() => {
        setElapsed(Math.floor((Date.now() - aiResponseStartTime) / 100) / 10)
      }, 100)
    } else {
      setElapsed(0)
    }
    return () => clearInterval(interval)
  }, [aiLoading, aiResponseStartTime])

  if (aiLoading) {
    return (
      <div className="response-timer loading">
        <Loader2 size={10} className="spin" />
        <span>{elapsed.toFixed(1)}s</span>
      </div>
    )
  }

  if (aiLastResponseTime) {
    return (
      <div className="response-timer">
        <Zap size={10} />
        <span>{(aiLastResponseTime / 1000).toFixed(1)}s</span>
      </div>
    )
  }

  return null
}

// ── Model Picker (Copilot-style bottom bar) ─────────────────────────────────
function ModelPicker() {
  const { settings, updateSettings, availableModels, fetchModels } = useStore()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState<AiProvider | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  const provider = settings.activeProvider
  const modelKey = `${provider}Model` as keyof typeof settings
  const currentModel = (settings[modelKey] as string) || ""

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const loadModels = async (p: AiProvider) => {
    setLoading(p)
    await fetchModels(p)
    setLoading(null)
  }

  const switchProvider = async (p: AiProvider) => {
    updateSettings({ activeProvider: p })
    if (!availableModels[p] || availableModels[p].length === 0) {
      await loadModels(p)
    }
  }

  const selectModel = (model: string) => {
    const modelKeyMap: Record<AiProvider, keyof typeof settings> = { groq:"groqModel", gemini:"geminiModel", claude:"claudeModel", ollama:"ollamaModel" }
    updateSettings({ [modelKeyMap[provider]]: model } as any)
    setOpen(false)
  }

  const shortModel = currentModel.split("/").pop()?.split(":")[0] || currentModel
  const providerModels = availableModels[provider] || []

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger button — Copilot style */}
      <button onClick={() => { setOpen(!open); if(!providerModels.length) loadModels(provider) }}
        title={`${PROVIDER_LABELS[provider]} — click to change model`}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          background: open ? "var(--bg-hover)" : "transparent",
          border: "1px solid var(--border-light)", borderRadius: 6,
          padding: "4px 8px", cursor: "pointer", transition: "all 0.15s",
          color: "var(--text-muted)", fontFamily: "inherit", fontSize: 11,
        }}
        onMouseEnter={e => (e.currentTarget.style.background="var(--bg-hover)")}
        onMouseLeave={e => { if(!open)(e.currentTarget.style.background="transparent") }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: PROVIDER_COLORS[provider], flexShrink: 0 }} />
        <span style={{ color: PROVIDER_COLORS[provider], fontWeight: 600, fontSize: 10 }}>
          {PROVIDER_LABELS[provider]}
        </span>
        <span style={{ color: "var(--text)", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {shortModel || "Select model"}
        </span>
        <ChevronDown size={10} style={{ color: "var(--text-dim)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: 0,
          width: 280, background: "var(--bg-panel)",
          border: "1px solid var(--border)", borderRadius: 10,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
          zIndex: 999, overflow: "hidden",
        }}>
          {/* Provider tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid var(--border-light)", padding: "6px 6px 0" }}>
            {(["groq","gemini","claude","ollama"] as AiProvider[]).map(p => (
              <button key={p} onClick={() => switchProvider(p)} style={{
                flex: 1, padding: "5px 4px", border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600,
                fontFamily: "inherit", borderRadius: "6px 6px 0 0", transition: "all 0.1s",
                background: provider === p ? "var(--bg-active)" : "transparent",
                color: provider === p ? PROVIDER_COLORS[p] : "var(--text-dim)",
                borderBottom: provider === p ? `2px solid ${PROVIDER_COLORS[p]}` : "2px solid transparent"
              }}>
                {loading === p ? <Loader2 size={10} className="spin" /> : PROVIDER_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Model list */}
          <div style={{ maxHeight: 220, overflowY: "auto", padding: "4px" }}>
            {providerModels.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", color: "var(--text-dim)", fontSize: 12 }}>
                {loading === provider ? (
                  <><Loader2 size={14} className="spin" style={{ margin: "0 auto 6px", display: "block" }} />Fetching models...</>
                ) : (
                  <>No models found<br/>
                  <button className="btn btn-ghost" style={{ marginTop: 8, fontSize: 11 }}
                    onClick={() => { loadModels(provider) }}>
                    <RefreshCw size={11} /> Retry
                  </button></>
                )}
              </div>
            ) : (
              providerModels.map(model => {
                const isActive = currentModel === model
                const shortName = model.split("/").pop() || model
                return (
                  <div key={model} onClick={() => selectModel(model)} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "7px 10px", borderRadius: 6, cursor: "pointer",
                    background: isActive ? "var(--accent-soft)" : "transparent",
                    border: isActive ? "1px solid var(--accent)44" : "1px solid transparent",
                    marginBottom: 2, transition: "all 0.1s"
                  }}
                  onMouseEnter={e => { if(!isActive)(e.currentTarget as HTMLElement).style.background="var(--bg-hover)" }}
                  onMouseLeave={e => { if(!isActive)(e.currentTarget as HTMLElement).style.background="" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: isActive ? "var(--text)" : "var(--text-muted)",
                        fontWeight: isActive ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {shortName}
                      </div>
                    </div>
                    {isActive && <CheckCheck size={12} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "6px 10px 8px", borderTop: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{providerModels.length} models</span>
            <button style={{ fontSize: 10, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit" }}
              onClick={() => { loadModels(provider) }}>
              <RefreshCw size={10} /> Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * extractFileBlocks — parse AI response for code blocks that represent files.
 * Looks for:
 *   ```python filename.py
 *   <code>
 *   ```
 * or lines like "**filename.py**" / "# filename.py" / "File: filename.py" before a code block.
 * Returns array of { filename, content, language }.
 */
function extractFileBlocks(text: string): Array<{ filename: string; content: string; language: string }> {
  const results: Array<{ filename: string; content: string; language: string }> = []
  // Match ```lang? filename?\n...``` blocks
  const fenceRe = /```(\w+)?(?:\s+([^\n]+))?\n([\s\S]*?)```/g
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(text)) !== null) {
    const lang     = (m[1] || '').trim()
    const rawLabel = (m[2] || '').trim()
    const code     = m[3]

    let filename = ''

    // Label on the fence line: ```python scraper.py
    if (rawLabel && /\.[a-z]{1,5}$/i.test(rawLabel)) {
      filename = rawLabel.replace(/[`'"*]/g, '').trim()
    }

    // Look for a filename marker in the 3 lines before this block
    if (!filename) {
      const before = text.slice(Math.max(0, m.index - 200), m.index)
      const linesBefore = before.split('\n').slice(-4)
      for (const line of linesBefore.reverse()) {
        const clean = line.replace(/[*#`_]/g, '').trim()
        // "File: scraper.py" or "**scraper.py**" or "# scraper.py"
        const nameMatch = clean.match(/(?:file[:\s]+)?([a-zA-Z0-9_\-./]+\.[a-z]{1,5})$/i)
        if (nameMatch) { filename = nameMatch[1]; break }
      }
    }

    // Last resort: derive filename from language
    if (!filename && lang) {
      const EXT: Record<string, string> = {
        python: 'script.py', javascript: 'script.js', typescript: 'script.ts',
        jsx: 'component.jsx', tsx: 'component.tsx', bash: 'run.sh',
        shell: 'run.sh', html: 'index.html', css: 'styles.css', json: 'data.json',
        rust: 'main.rs', go: 'main.go', java: 'Main.java',
      }
      filename = EXT[lang] || `file.${lang}`
    }

    if (filename && code.trim()) {
      // Deduplicate — if same filename already extracted, append index
      const existing = results.filter(r => r.filename === filename).length
      if (existing > 0) filename = filename.replace(/(\.[^.]+)$/, `_${existing + 1}$1`)
      results.push({ filename, content: code, language: lang })
    }
  }
  return results
}

// ── Main AI Panel ────────────────────────────────────────────────────────────
export default function AiPanel() {
  const {
    aiMessages, aiLoading, sendAiMessage, clearAiMessages,
    settings, updateSettings, addAiMessage, updateAiMessage, setAiLoading,
    enhancerLoading, setInlineErrors, clearInlineErrors,
    addAgentTerminal, folderPath,
    previewActive, editModeActive, editingElement, setEditingElement, pendingChanges,
  } = useStore()
  const { addCheckpoint } = useHistoryStore()

  const [input, setInput]             = useState("")
  const [showCommands, setShowCommands] = useState(false)
  const [detectedSkills, setDetectedSkills] = useState<Skill[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [isErrorMode, setIsErrorMode] = useState(false)
  const [errorBannerDismissed, setErrorBannerDismissed] = useState(false)
  const [useDeepThink, setUseDeepThink] = useState(false)
  const [pendingEditPreview, setPendingEditPreview] = useState<{ change: DomChange; element: ElementData } | null>(null)
  const [editSubmitting, setEditSubmitting] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)
  const sendRef   = useRef<(overrideText?: string, isContinuation?: boolean) => void>(() => {})
  const continuationHopsRef = useRef<Map<string, number>>(new Map())

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [aiMessages, aiLoading])

  // Skill detection on input change
  useEffect(() => {
    setDetectedSkills(detectSkills(input))
  }, [input])

  // Auto-activate deep think when input looks complex
  useEffect(() => {
    if (input.length > 80) {
      const lower = input.toLowerCase()
      const complexKeywords = ['architect','refactor','optimize','debug','why','explain','design','algorithm','performance','security','compare']
      const matches = complexKeywords.filter(k => lower.includes(k)).length
      if (matches >= 2) setUseDeepThink(true)
    }
  }, [input])

  // Listen for continue-response event from TokenLimitPopup
  // (sendRef keeps this listener pointed at the latest send() closure)
  useEffect(() => {
    const handler = (e: Event) => {
      const { messageId } = (e as CustomEvent).detail
      const msg = useStore.getState().aiMessages.find(m => m.id === messageId)
      if (!msg) return
      sendRef.current('', true)
    }
    window.addEventListener('codedroid-continue-response', handler)
    return () => window.removeEventListener('codedroid-continue-response', handler)
  }, [])

  // Listen for live preview DOM-edit results — shows Save/Discard inline in chat
  useEffect(() => {
    const handler = (e: Event) => {
      const { change, element } = (e as CustomEvent).detail
      setPendingEditPreview({ change, element })
      setEditSubmitting(false)
      addAiMessage({
        role: 'assistant',
        content: `Applied **${change.action.replace(/_/g, ' ')}** to \`${element.tag}\` — visible live in the preview now.`,
        provider: settings.activeProvider, mode: 'ask', isStreaming: false,
      })
    }
    window.addEventListener('codedroid-preview-edit-applied', handler)
    return () => window.removeEventListener('codedroid-preview-edit-applied', handler)
  }, [settings.activeProvider])

  // Clear the inline Save/Discard card once all pending changes are resolved
  useEffect(() => {
    if (pendingChanges.length === 0) setPendingEditPreview(null)
  }, [pendingChanges.length])

  // Paste detection — check if pasted text looks like an error report
  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text')
    if (!pasted || pasted.length < 20) return
    try {
      const res = await fetch(sidecarHttp('/detect-error'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasted }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.is_error_paste) {
        setIsErrorMode(true)
        setErrorBannerDismissed(false)
        // Auto-switch to agent mode for fix
        updateSettings({ activeMode: 'agent' })
      }
    } catch { /* sidecar not running — ignore */ }
  }

  // Agent-Fix WebSocket: run a command, auto-fix on error
  const runAgentFix = async (command: string, filePath?: string) => {
    const provider  = settings.activeProvider
    const apiKey    = provider === 'groq' ? settings.groqKey
      : provider === 'gemini' ? settings.geminiKey
      : provider === 'claude' ? settings.claudeKey : ''
    const model = provider === 'groq' ? settings.groqModel
      : provider === 'gemini' ? settings.geminiModel
      : provider === 'claude' ? settings.claudeModel : settings.ollamaModel
    const workspace = folderPath || ''

    // Open / reuse agent terminal tab
    addAgentTerminal(workspace)
    useStore.getState().setAgentRunning(true)

    setAiLoading(true)
    const assistantId = addAiMessage({
      role: 'assistant', content: '', provider, isStreaming: true,
      mode: 'agent', agentSteps: [], planSteps: [],
    })

    let fullText = ''
    const agentSteps: AgentStep[] = []

    return new Promise<void>((resolve) => {
      try {
        const ws = new WebSocket(sidecarWs('/ws/agent-fix'))

        ws.onopen = () => {
          ws.send(JSON.stringify({
            command, workspace,
            file_path: filePath || '',
            error_text: '',
            provider, api_key: apiKey, model,
            host: settings.ollamaHost,
          }))
        }

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data)

          if (data.type === 'step') {
            // Each step message → new agent step card
            const step: AgentStep = {
              id: Math.random().toString(),
              tool: 'agent_step',
              input: data.text,
              status: data.text.includes('✅') ? 'success'
                    : data.text.includes('❌') ? 'error' : 'running',
            }
            agentSteps.push(step)
            useStore.setState((s) => ({
              aiMessages: s.aiMessages.map(m =>
                m.id === assistantId ? { ...m, agentSteps: [...agentSteps] } : m
              )
            }))
          } else if (data.type === 'token') {
            fullText += data.text
            updateAiMessage(assistantId, fullText, true)
          } else if (data.type === 'error_detected') {
            const err = data.error
            if (err?.has_error && err.file_path) {
              setInlineErrors([{
                file: err.file_path,
                line: err.line_number || 1,
                column: err.column,
                errorType: err.error_type || 'error',
                message: err.error_message || '',
              }])
            }
          } else if (data.type === 'fix_applied') {
            // Clear decorations after fix applied
            clearInlineErrors()
          } else if (data.type === 'success') {
            updateAiMessage(assistantId, fullText, false)
            setAiLoading(false)
            useStore.getState().setAgentRunning(false)
            ws.close()
            resolve()
          } else if (data.type === 'failed') {
            updateAiMessage(assistantId, fullText, false)
            setAiLoading(false)
            useStore.getState().setAgentRunning(false)
            ws.close()
            resolve()
          } else if (data.type === 'done') {
            updateAiMessage(assistantId, fullText, false)
            setAiLoading(false)
            useStore.getState().setAgentRunning(false)
            ws.close()
            resolve()
          }
        }

        ws.onerror = () => { setAiLoading(false); useStore.getState().setAgentRunning(false); ws.close(); resolve() }
      } catch { setAiLoading(false); useStore.getState().setAgentRunning(false); resolve() }
    })
  }

  // Submit an edit prompt for the currently-selected preview element.
  // Used by the chat input when an element chip is active (Feature 2/3 sync rule:
  // whichever input — in-page floating box or this chat box — submits first wins;
  // the in-page popup closes itself on submit from its own JS).
  const submitElementEdit = (prompt: string) => {
    const ws = getPreviewSocket()
    if (!ws || ws.readyState !== WebSocket.OPEN || !editingElement) return
    const provider = settings.activeProvider
    const apiKey = provider === 'groq' ? settings.groqKey : provider === 'gemini' ? settings.geminiKey : provider === 'claude' ? settings.claudeKey : ''
    const model = provider === 'groq' ? settings.groqModel : provider === 'gemini' ? settings.geminiModel : provider === 'claude' ? settings.claudeModel : settings.ollamaModel

    setEditSubmitting(true)
    addAiMessage({ role: 'user', content: prompt, provider, mode: 'ask', isStreaming: false })

    ws.send(JSON.stringify({
      type: 'submit_edit',
      element: editingElement,
      prompt,
      provider, api_key: apiKey, model, host: settings.ollamaHost,
    }))

    setInput("")
  }

  const send = async (overrideText?: string, isContinuation?: boolean) => {
    // For continuations, the "text" isn't user-typed input at all — it's just
    // a trigger to resume streaming. Don't fall through to `input` (which may
    // be empty) and don't bail out on an empty string the way normal sends do.
    const text = isContinuation ? (overrideText ?? '') : (overrideText ?? input).trim()
    if (isContinuation) {
      // Continuation has no "user typed text" requirement — only block if
      // something is already streaming.
      if (aiLoading) return
    } else {
      if (!text || aiLoading) return
    }

    const mode = settings.activeMode || 'ask'
    const skills = isContinuation ? [] : detectSkills(text)

    if (!overrideText && !isContinuation) { setInput(""); setShowCommands(false) }

    // Agent mode: mark agent as running and ensure the dedicated terminal exists
    if (mode === 'agent') {
      useStore.getState().setAgentRunning(true)
      useStore.getState().addAgentTerminal(folderPath || undefined)
    }

    // Skill Injection logic
    const baseSystemPrompt = `You are CodeDroid AI Copilot, an expert coding assistant embedded in an IDE.
Be concise, technical, and precise. Format code with proper markdown code blocks.`

    let systemInjected = buildSystemPrompt(skills, baseSystemPrompt)

    if (mode === 'plan') {
      systemInjected += "\n\nDo not execute. Return only a numbered step-by-step plan in JSON format: {steps: [{id, title, description, estimatedComplexity}]}"
    } else if (mode === 'agent') {
      systemInjected += `\n\nYou are operating in AGENT mode. Act as an autonomous coding agent.
Your workflow:
1. **Analyze** the user's request thoroughly — understand the goal, constraints, and context.
2. **Reason** step-by-step about the best approach, considering best practices and potential issues.
3. **Generate** a complete, production-ready implementation with full code, clear explanations, and any necessary instructions.
4. **Explain** what you built, why you made specific design decisions, and how to use it.

Important rules for Agent mode:
- Always provide COMPLETE, working code — never partial snippets or placeholders.
- If the user mentions skills or frameworks (e.g., Tailwind, shadcn/ui), use them fully in your implementation.
- Structure your response clearly with sections: Analysis, Implementation, and Usage.
- Be proactive: anticipate follow-up needs and address them.
- If the task involves multiple files, provide all of them clearly labeled.`
    }

    const provider = settings.activeProvider

    let assistantId: string
    let continuingMessageOriginalContent = ''

    if (isContinuation) {
      // Don't add a new user bubble — find the truncated assistant message and resume it
      const truncatedMsg = [...aiMessages].reverse().find(m => m.role === 'assistant' && m.isTruncated)
      if (truncatedMsg) {
        assistantId = truncatedMsg.id
        continuingMessageOriginalContent = truncatedMsg.content
        useStore.setState(s => ({
          aiMessages: s.aiMessages.map(m =>
            m.id === assistantId ? { ...m, isTruncated: false, isStreaming: true } : m)
        }))
      } else {
        assistantId = addAiMessage({
          role: 'assistant', content: '', provider, isStreaming: true, mode, appliedSkills: [],
          agentSteps: [], planSteps: [],
        })
      }
    } else {
      addAiMessage({ role: 'user', content: text, provider, mode, appliedSkills: skills.map(s => s.name) })
      assistantId = addAiMessage({
        role: 'assistant', content: '', provider, isStreaming: true, mode, appliedSkills: skills.map(s => s.name),
        agentSteps: [], planSteps: [],
      })
    }

    setAiLoading(true)
    useStore.setState({ aiResponseStartTime: Date.now(), aiLastResponseTime: null })

    // ── Token budget for Groq free tier (8000 TPM total = input + output) ──
    // Rough estimate: 1 token ≈ 4 chars
    // Budget: 8000 TPM total → reserve 2000 for output → 6000 tokens for input
    // 6000 tokens × 4 chars = 24000 chars max input
    // System prompt cap: 800 chars (~200 tokens)
    // History: last 4 messages, 400 chars each (~100 tokens each = 400 tokens)
    // User message: up to 2000 chars (~500 tokens)
    // Total input estimate: 200 + 400 + 500 = ~1100 tokens → safe under 6000

    const MAX_SYSTEM_CHARS   = 800   // ~200 tokens
    const MAX_HISTORY_MSGS   = 4     // last 2 pairs
    const MAX_HISTORY_CHARS  = 400   // per message
    const MAX_OUTPUT_TOKENS  = 2000  // safe output budget under free tier

    if (systemInjected.length > MAX_SYSTEM_CHARS) {
      systemInjected = systemInjected.slice(0, MAX_SYSTEM_CHARS)
    }

    // Only send last N messages, each capped at MAX_HISTORY_CHARS
    // For continuations, include the truncated assistant content as real context (not capped)
    // so the model actually knows what it already wrote.
    const baseHistory = aiMessages
      .filter(m => m.content && m.role !== 'tool' && m.id !== assistantId)
      .slice(-MAX_HISTORY_MSGS)
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content.slice(0, MAX_HISTORY_CHARS),
      }))

    const trimmedHistory = isContinuation
      ? [
          ...baseHistory,
          { role: 'assistant', content: continuingMessageOriginalContent },
          { role: 'user', content: 'Continue exactly where you left off. Do not repeat anything you already wrote. Do not add any preamble — just continue the content seamlessly from the last word.' },
        ]
      : baseHistory

    // For continuations the "final user turn" is already the last item in trimmedHistory.
    // For normal sends, we still need to append the new user message.
    const finalMessages = isContinuation
      ? trimmedHistory
      : [...trimmedHistory, { role: 'user', content: text }]

    const trySidecar = (): Promise<boolean> => {
      return new Promise((resolve) => {
        let hasReceivedData = false
        let resolved = false

        const cleanupAndResolve = (success: boolean) => {
          if (resolved) return
          resolved = true
          resolve(success)
        }

        try {
          const ws = new WebSocket(sidecarWs('/ws/chat'))
          let fullText = isContinuation ? continuingMessageOriginalContent : ''
          let agentSteps: AgentStep[] = []
          let wasTruncatedThisTurn = false

          // Timeout if sidecar doesn't respond or connect within 1500ms
          const timeout = setTimeout(() => {
            if (!hasReceivedData) {
              ws.close()
              cleanupAndResolve(false)
            }
          }, 1500)

          ws.onopen = () => {
            const key = provider === 'groq' ? settings.groqKey : provider === 'gemini' ? settings.geminiKey : provider === 'claude' ? settings.claudeKey : ''
            const model = provider === 'groq' ? settings.groqModel : provider === 'gemini' ? settings.geminiModel : provider === 'claude' ? settings.claudeModel : settings.ollamaModel

            ws.send(JSON.stringify({
              messages: finalMessages,
              provider, api_key: key, model, host: settings.ollamaHost,
              system: systemInjected,
              mode,
              skills: skills.map(s => s.id),
              thinking: useDeepThink,
            }))
          }

          ws.onmessage = (event) => {
            hasReceivedData = true
            clearTimeout(timeout)
            cleanupAndResolve(true)

            const data = JSON.parse(event.data)
            if (data.type === 'token') {
              fullText += data.text
              updateAiMessage(assistantId, fullText, true)
            } else if (data.type === 'thinking_start') {
              // Mark message as actively thinking
              useStore.setState(s => ({
                aiMessages: s.aiMessages.map(m =>
                  m.id === assistantId ? { ...m, isThinkingStreaming: true } : m)
              }))
            } else if (data.type === 'thinking') {
              // Append thinking content and turn off spinner
              useStore.setState(s => ({
                aiMessages: s.aiMessages.map(m =>
                  m.id === assistantId
                    ? { ...m, thinking: (m.thinking || '') + data.text, isThinkingStreaming: false }
                    : m)
              }))
            } else if (data.type === 'truncated') {
              // Response hit token limit. Always record it on the message —
              // Ask/Plan mode shows the Continue popup; Agent mode auto-continues
              // once the 'done' event confirms this turn has fully finished streaming.
              useStore.setState(s => ({
                aiMessages: s.aiMessages.map(m =>
                  m.id === assistantId ? { ...m, isTruncated: true } : m)
              }))
              if (mode === 'agent') {
                wasTruncatedThisTurn = true
              }
            } else if (data.type === 'terminal_output') {
              // Stream agent command output into the dedicated agent terminal tab
              window.dispatchEvent(new CustomEvent('codedroid-agent-terminal-write', {
                detail: { line: data.line, isError: !!data.is_error }
              }))
            } else if (data.type === 'agent_warning') {
              // Show a step card warning (e.g. hanging process)
              agentSteps.push({ id: Math.random().toString(), tool: 'warning', input: data.message, status: 'error' })
              useStore.setState((s) => ({
                aiMessages: s.aiMessages.map(m => m.id === assistantId ? { ...m, agentSteps: [...agentSteps] } : m)
              }))
            } else if (data.type === 'tool_start') {
              agentSteps.push({ id: Math.random().toString(), tool: data.tool, input: JSON.stringify(data.args), status: 'running' })
              useStore.setState((s) => ({
                aiMessages: s.aiMessages.map(m => m.id === assistantId ? { ...m, agentSteps: [...agentSteps] } : m)
              }))
            } else if (data.type === 'tool_end') {
              const step = agentSteps.find(s => s.tool === data.tool && s.status === 'running')
              if (step) {
                step.status = 'success'
                step.output = data.output
              }
              useStore.setState((s) => ({
                aiMessages: s.aiMessages.map(m => m.id === assistantId ? { ...m, agentSteps: [...agentSteps] } : m)
              }))
            } else if (data.type === 'done') {
              // Parse steps if plan mode
              let planSteps: PlanStep[] = []
              if (mode === 'plan') {
                try {
                  const match = fullText.match(/\{[\s\S]*\}/)
                  if (match) {
                    const parsed = JSON.parse(match[0])
                    planSteps = parsed.steps || []
                  }
                } catch {}
              }

              updateAiMessage(assistantId, fullText, false)
              if (planSteps.length > 0) {
                useStore.setState((s) => ({
                  aiMessages: s.aiMessages.map(m => m.id === assistantId ? { ...m, planSteps } : m)
                }))
              }

              setAiLoading(false)
              const duration = Date.now() - (useStore.getState().aiResponseStartTime || Date.now())
              useStore.setState({ aiLastResponseTime: duration, aiResponseStartTime: null })

              // History Checkpoint
              addCheckpoint({
                id: Math.random().toString(),
                timestamp: Date.now(),
                mode, userMessage: isContinuation ? '(continued)' : text, aiResponse: fullText,
                skillsApplied: skills.map(s => s.name),
                agentSteps: [...agentSteps],
                planSteps,
                provider,
                model: settings[`${provider}Model` as keyof typeof settings] as string
              })

              ws.close()

              // Agent mode auto-continuation: if this turn ended truncated,
              // immediately resume in the same message (max 3 hops to avoid loops)
              if (mode === 'agent' && wasTruncatedThisTurn) {
                const hops = continuationHopsRef.current.get(assistantId) || 0
                if (hops < 3) {
                  continuationHopsRef.current.set(assistantId, hops + 1)
                  setTimeout(() => sendRef.current('', true), 50)
                } else {
                  useStore.setState(s => ({
                    aiMessages: s.aiMessages.map(m =>
                      m.id === assistantId ? { ...m, isTruncated: false } : m)
                  }))
                }
              }
            }
          }

          ws.onerror = () => {
            clearTimeout(timeout)
            ws.close()
            cleanupAndResolve(false)
          }

          ws.onclose = () => {
            clearTimeout(timeout)
            cleanupAndResolve(false)
          }

        } catch (e) {
          cleanupAndResolve(false)
        }
      })
    }

    const runDirect = async () => {
      try {
        let fullText = isContinuation ? continuingMessageOriginalContent : ''
        const key = provider === 'groq' ? settings.groqKey : provider === 'gemini' ? settings.geminiKey : provider === 'claude' ? settings.claudeKey : ''
        const model = provider === 'groq' ? settings.groqModel : provider === 'gemini' ? settings.geminiModel : provider === 'claude' ? settings.claudeModel : settings.ollamaModel

        // Use same trimmed history to avoid token overflow
        const history = trimmedHistory

        if (!key && provider !== 'ollama') {
          throw new Error(`API key for ${provider.toUpperCase()} is missing. Go to Settings (gear icon) and add your key.`)
        }

        if (provider === 'groq') {
          // All values = max OUTPUT tokens. Free tier TPM = 8000 (input+output).
          // We keep output ≤ 2000 so input has room. Users on Dev tier get 100k+ TPM.
          const GROQ_MAX: Record<string, number> = {
            'openai/gpt-oss-120b':               2000,
            'openai/gpt-oss-20b':                2000,
            'llama-3.3-70b-versatile':           2000,
            'llama-3.1-70b-versatile':           2000,
            'llama-3.1-8b-instant':              2000,
            'llama3-70b-8192':                   2000,
            'llama3-8b-8192':                    2000,
            'llama3-groq-70b-8192-tool-use-preview': 2000,
            'mixtral-8x7b-32768':                2000,
            'gemma2-9b-it':                      2000,
            'gemma-7b-it':                       2000,
            'default':                           1500,
          }
          const groqModel = model || 'llama-3.3-70b-versatile'
          const maxTokens = GROQ_MAX[groqModel] ?? GROQ_MAX['default']
          const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: groqModel, stream: true, max_tokens: maxTokens,
              messages: [{ role: 'system', content: systemInjected }, ...finalMessages]
            })
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.error?.message || `Groq HTTP ${res.status}`)
          }

          const reader = res.body!.getReader()
          const dec = new TextDecoder()
          let groqFinishReason = ''
          while (true) {
            const { done, value } = await reader.read(); if (done) break
            const chunk = dec.decode(value)
            for (const line of chunk.split('\n')) {
              if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                try {
                  const d = JSON.parse(line.slice(6))
                  fullText += d.choices?.[0]?.delta?.content || ''
                  groqFinishReason = d.choices?.[0]?.finish_reason || groqFinishReason
                  updateAiMessage(assistantId, fullText, true)
                } catch {}
              }
            }
          }
          if (groqFinishReason === 'length') {
            useStore.setState(s => ({
              aiMessages: s.aiMessages.map(m => m.id === assistantId ? { ...m, isTruncated: true } : m)
            }))
            if (mode === 'agent') {
              const hops = continuationHopsRef.current.get(assistantId) || 0
              if (hops < 3) {
                continuationHopsRef.current.set(assistantId, hops + 1)
                setTimeout(() => sendRef.current('', true), 50)
              }
            }
          }
        } else if (provider === 'gemini') {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemInjected }] },
              contents: finalMessages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
            })
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.error?.message || `HTTP ${res.status}`)
          }

          const data = await res.json()
          fullText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
          updateAiMessage(assistantId, fullText, true)
        } else if (provider === 'claude') {
          // Streaming SSE for Claude direct fallback
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': key,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              model: model,
              max_tokens: 4096,
              stream: true,
              system: systemInjected,
              messages: finalMessages
            })
          })

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}))
            throw new Error(errData.error?.message || `HTTP ${res.status}`)
          }

          const reader = res.body!.getReader()
          const dec = new TextDecoder()
          while (true) {
            const { done, value } = await reader.read(); if (done) break
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
        } else if (provider === 'ollama') {
          if (window.api && window.api.ollamaChat) {
            window.api.removeOllamaListeners?.()

            await new Promise<void>((resolve, reject) => {
              window.api.onOllamaChunk?.((chunk: any) => {
                fullText += chunk.message?.content || ''
                updateAiMessage(assistantId, fullText, true)
              })

              window.api.onOllamaDone?.(() => {
                resolve()
              })

              window.api.ollamaChat?.(settings.ollamaHost, {
                model: model,
                stream: true,
                messages: [{ role: 'system', content: systemInjected }, ...finalMessages]
              }).then((res: { ok: boolean; error?: string } | undefined) => {
                if (res && !res.ok) reject(new Error(res.error))
              })
            })
          } else {
            const res = await fetch(`${settings.ollamaHost}/api/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                model: model, stream: true,
                messages: [{ role: 'system', content: systemInjected }, ...finalMessages]
              })
            })

            if (!res.ok) throw new Error(`Ollama returned status ${res.status}`)

            const reader = res.body!.getReader()
            const dec = new TextDecoder()
            while (true) {
              const { done, value } = await reader.read(); if (done) break
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
        }

        let planSteps: PlanStep[] = []
        if (mode === 'plan') {
          try {
            const match = fullText.match(/\{[\s\S]*\}/)
            if (match) {
              const parsed = JSON.parse(match[0])
              planSteps = parsed.steps || []
            }
          } catch {}
        }

        // ── Agent mode: extract code blocks and write files to disk ────────
        // When the sidecar isn't running, the AI returns text with code blocks.
        // We parse them out and create files via Electron IPC so SOMETHING lands on disk.
        if (mode === 'agent' && window.api && folderPath) {
          const agentSteps: AgentStep[] = []
          const fileBlocks = extractFileBlocks(fullText)
          for (const fb of fileBlocks) {
            const fullPath = folderPath.replace(/[\\/]+$/, '') + '/' + fb.filename
            try {
              const res = await window.api.writeFile(fullPath, fb.content)
              const step: AgentStep = {
                id: Math.random().toString(),
                tool: 'create_file',
                input: fb.filename,
                output: res.ok ? `✅ Created: ${fullPath}` : `❌ ${res.error}`,
                status: res.ok ? 'success' : 'error',
              }
              agentSteps.push(step)
            } catch (err: any) {
              agentSteps.push({
                id: Math.random().toString(), tool: 'create_file',
                input: fb.filename, output: `❌ ${err.message}`, status: 'error',
              })
            }
          }
          if (agentSteps.length > 0) {
            useStore.setState((s) => ({
              aiMessages: s.aiMessages.map(m => m.id === assistantId ? { ...m, agentSteps } : m)
            }))
          }
        }

        updateAiMessage(assistantId, fullText, false)
        if (planSteps.length > 0) {
          useStore.setState((s) => ({
            aiMessages: s.aiMessages.map(m => m.id === assistantId ? { ...m, planSteps } : m)
          }))
        }

        setAiLoading(false)
        const duration = Date.now() - (useStore.getState().aiResponseStartTime || Date.now())
        useStore.setState({ aiLastResponseTime: duration, aiResponseStartTime: null })

        addCheckpoint({
          id: Math.random().toString(),
          timestamp: Date.now(),
          mode, userMessage: isContinuation ? '(continued)' : text, aiResponse: fullText,
          skillsApplied: skills.map(s => s.name),
          agentSteps: [],
          planSteps,
          provider,
          model: settings[`${provider}Model` as keyof typeof settings] as string
        })

      } catch (e: any) {
        console.error("Direct API failed:", e)
        updateAiMessage(assistantId, `❌ ${e.message || e}`, false)
        setAiLoading(false)
        useStore.setState({ aiResponseStartTime: null })
      }
    }

    const success = await trySidecar()
    if (!success) {
      console.warn("[AiPanel] Sidecar unreachable — using direct API (no tool execution)")
      await runDirect()
    }

    if (mode === 'agent') {
      useStore.getState().setAgentRunning(false)
    }
  }

  // Keep sendRef pointed at the latest send() closure (settings/aiMessages change every render)
  useEffect(() => { sendRef.current = send })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (editingElement && input.trim()) {
        submitElementEdit(input.trim())
      } else {
        send()
      }
    }
    if (e.ctrlKey && e.key === '1') { e.preventDefault(); updateSettings({ activeMode: 'plan' }) }
    if (e.ctrlKey && e.key === '2') { e.preventDefault(); updateSettings({ activeMode: 'agent' }) }
    if (e.ctrlKey && e.key === '3') { e.preventDefault(); updateSettings({ activeMode: 'ask' }) }
  }

  const handleExecuteStep = async (messageId: string, stepId: string) => {
    // Implement step execution logic
    // 1. Update step status to 'running'
    // 2. Send request to sidecar
    // 3. Update result and status to 'completed'
  }

  const handleExecutePlan = async (messageId: string) => {
    const msg = aiMessages.find(m => m.id === messageId)
    if (!msg || !msg.planSteps) return

    // Sequential execution
    for (const step of msg.planSteps) {
      // Logic to execute each step
    }
  }

  const filteredCmds = SLASH_COMMANDS.filter(c => input === "/" || c.cmd.startsWith(input.split(" ")[0]))

  return (
    <div className="ai-panel">
      <div className="panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Sparkles size={14} style={{ color: "var(--accent)" }} />
          <span>AI Copilot</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" onClick={() => setShowHistory(true)} title="History"><History size={13} /></button>
          <button className="icon-btn" onClick={clearAiMessages} title="Clear"><Trash2 size={13} /></button>
        </div>
      </div>

      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}

      <ChatModeSelector />

      <div className="ai-messages">
        {aiMessages.length === 0 && (
          <div className="ai-welcome">
            <Bot size={28} style={{ color: "var(--accent)", marginBottom: 8 }} />
            <div className="ai-welcome-title">CodeDroid AI</div>
            <div className="ai-welcome-sub">How can I help you today?</div>
          </div>
        )}
        {aiMessages.map((msg, idx) => {
          // If this is an empty assistant message and we are loading,
          // don't show the bubble yet (BeautifulLoading will show instead)
          if (msg.role === 'assistant' && !msg.content && aiLoading && idx === aiMessages.length - 1) {
            return null
          }
          return <MessageBubble key={msg.id} msg={msg} onExecutePlan={handleExecutePlan} />
        })}
        {aiLoading && (!aiMessages.length || aiMessages[aiMessages.length-1].role !== 'assistant' || !aiMessages[aiMessages.length-1].content) && (
          <BeautifulLoading />
        )}

        {/* Live preview edit result card — Save/Discard for the most recent edit */}
        {pendingEditPreview && pendingChanges.length > 0 && (
          <ElementEditActions change={pendingEditPreview.change} elementData={pendingEditPreview.element} />
        )}

        <div ref={bottomRef} />
      </div>

      {/* Editing element chip — shown when a preview element is selected for editing */}
      {editingElement && (
        <div className="editing-element-chip">
          🎯 Editing: <code>{editingElement.tag}</code> "{editingElement.text.slice(0, 40)}"
          {editSubmitting && <Loader2 size={11} className="spin" style={{ marginLeft: 4 }} />}
          <button onClick={() => setEditingElement(null)} title="Clear selection">✕</button>
        </div>
      )}

      {/* Error paste banner */}
      {isErrorMode && !errorBannerDismissed && (
        <div className="error-paste-banner">
          <span>🔍 Error detected — entering fix mode</span>
          <button className="banner-dismiss" onClick={() => { setIsErrorMode(false); setErrorBannerDismissed(true) }}>✕</button>
        </div>
      )}

      {/* Slash commands */}
      {showCommands && filteredCmds.length > 0 && (
        <div className="slash-popup">
          {filteredCmds.map(c => (
            <button key={c.cmd} className="slash-item" onClick={() => { setInput(c.cmd+" "); setShowCommands(false); inputRef.current?.focus() }}>
              <span className="slash-cmd">{c.cmd}</span>
              <span className="slash-desc">{c.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* Skills detection pill */}
      {detectedSkills.length > 0 && (
        <div className="detected-skills-bar">
          <span className="pill">
            🔧 Skills: {detectedSkills.map(s => s.name).join(' · ')}
            <span className="info-icon" title={detectedSkills.map(s => `${s.name}: ${s.description}`).join('\n')}>ℹ️</span>
          </span>
        </div>
      )}

      {/* Input area */}
      <div className="ai-input-area">
        <div className={`ai-input-wrap ${enhancerLoading ? 'enhancing' : ''} ${isErrorMode ? 'error-mode-input' : ''}`}>
          <textarea ref={inputRef} className="ai-input"
            placeholder={editingElement
              ? `Describe the change to ${editingElement.tag}...`
              : isErrorMode
              ? `Paste the error here or describe what to fix...`
              : `Ask AI in ${settings.activeMode || 'ask'} mode...`}
            value={input}
            onChange={e => { setInput(e.target.value); setShowCommands(e.target.value.startsWith("/") && e.target.value.length > 0) }}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown} rows={4} />

          {enhancerLoading && (
            <div className="enhancer-status-inline">
              <Sparkles size={12} className="pulse" />
              <span>AI is polishing your prompt...</span>
            </div>
          )}

          <div className="input-actions">
            <PromptEnhancer input={input} setInput={setInput} />
            <button
              className={`deep-think-btn ${useDeepThink ? 'active' : ''}`}
              title={useDeepThink ? 'Deep Think ON — click to disable' : 'Enable Deep Think (extended reasoning)'}
              onClick={() => setUseDeepThink(t => !t)}
            >
              <Brain size={13} />
              {useDeepThink && <span className="deep-think-label">Deep Think</span>}
            </button>
            <button
              className="ai-send-btn"
              onClick={() => editingElement && input.trim() ? submitElementEdit(input.trim()) : send()}
              disabled={!input.trim() || aiLoading}
            >
              {aiLoading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 2px 2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ModelPicker />
            <ResponseTimer />
          </div>
          <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
            Ctrl+1/2/3 modes
          </span>
        </div>
      </div>

      <PendingChangesPanel />
    </div>
  )
}