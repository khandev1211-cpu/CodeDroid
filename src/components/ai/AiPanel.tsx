import { useState, useRef, useEffect } from "react"
import {
  Bot, Send, Trash2, Copy, Loader2, Zap, CheckCheck,
  ChevronDown, RefreshCw, Sparkles
} from "lucide-react"
import { useStore, AiProvider } from "../../stores/appStore"
import "./AiPanel.css"

// ── Provider config ─────────────────────────────────────────────────────────
const PROVIDER_COLORS: Record<AiProvider, string> = {
  groq: "#f55036", gemini: "#4285f4", ollama: "#aaaaaa", claude: "#d97757"
}
const PROVIDER_LABELS: Record<AiProvider, string> = {
  groq: "Groq", gemini: "Gemini", ollama: "Ollama", claude: "Claude"
}
const STATIC_MODELS: Record<AiProvider, string[]> = {
  groq:   ["llama3-70b-8192","llama3-8b-8192","mixtral-8x7b-32768","gemma2-9b-it","llama-3.1-70b-versatile","llama-3.3-70b-versatile"],
  gemini: ["gemini-1.5-pro","gemini-1.5-flash","gemini-2.0-flash","gemini-2.0-flash-lite"],
  claude: ["claude-sonnet-4-20250514","claude-opus-4-5","claude-haiku-4-5-20251001","claude-3-5-sonnet-20241022"],
  ollama: [],
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

async function fetchModels(
  provider: AiProvider, apiKey: string, host: string,
  onError?: (msg: string) => void
): Promise<string[]> {
  try {
    if (provider === "groq") {
      if (!apiKey) { onError?.("No Groq API key — add it in Settings → AI"); return STATIC_MODELS.groq }
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" }
      })
      if (!res.ok) { onError?.(`Groq error ${res.status}: ${res.statusText}`); return STATIC_MODELS.groq }
      const data = await res.json()
      const models = data.data?.map((m: any) => m.id).sort() || []
      if (!models.length) { onError?.("Groq returned 0 models"); return STATIC_MODELS.groq }
      return models
    }
    if (provider === "ollama") {
      const res = await fetch(`${host}/api/tags`).catch(() => null)
      if (!res) { onError?.(`Cannot reach Ollama at ${host} — is it running?`); return [] }
      const data = await res.json()
      const models = data.models?.map((m: any) => m.name) || []
      if (!models.length) { onError?.("Ollama is running but no models found — run: ollama pull llama3") }
      return models
    }
    if (provider === "gemini") {
      if (!apiKey) { onError?.("No Gemini API key — add it in Settings → AI"); return STATIC_MODELS.gemini }
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
      if (!res.ok) { onError?.(`Gemini error ${res.status}: ${res.statusText}`); return STATIC_MODELS.gemini }
      const data = await res.json()
      const models = data.models?.map((m: any) => m.name.replace("models/","")).filter((m: string) => m.includes("gemini")) || []
      return models.length ? models : STATIC_MODELS.gemini
    }
    if (provider === "claude") {
      if (!apiKey) { onError?.("No Claude API key — add it in Settings → AI"); return STATIC_MODELS.claude }
      // Anthropic has no public list endpoint — use curated static list
      return STATIC_MODELS.claude
    }
  } catch (e: any) {
    onError?.(`Fetch failed: ${e.message}`)
  }
  return STATIC_MODELS[provider] || []
}

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

function MessageBubble({ msg }: { msg: any }) {
  const isUser = msg.role === "user"
  const [copied, setCopied] = useState(false)
  const copy = () => { navigator.clipboard.writeText(msg.content); setCopied(true); setTimeout(()=>setCopied(false),1500) }
  return (
    <div className={`msg-wrap ${isUser?"user":"assistant"}`}>
      <div className={`msg-bubble ${isUser?"msg-user":"msg-ai"}`}>
        {!isUser && (
          <div className="msg-header">
            <span className="provider-badge" style={{ color: PROVIDER_COLORS[msg.provider as AiProvider] }}>
              {PROVIDER_LABELS[msg.provider as AiProvider] || msg.provider}
            </span>
            <button className="icon-btn" style={{width:20,height:20}} onClick={copy}>
              {copied ? <CheckCheck size={11} style={{color:"var(--git-added)"}} /> : <Copy size={11} />}
            </button>
          </div>
        )}
        {isUser
          ? <div className="msg-text">{msg.content}</div>
          : <div className="msg-md" dangerouslySetInnerHTML={{__html: renderMarkdown(msg.content)}} />}
        {msg.isStreaming && <span className="streaming-cursor">▋</span>}
      </div>
    </div>
  )
}

// ── Model Picker (Copilot-style bottom bar) ─────────────────────────────────
function ModelPicker() {
  const { settings, updateSettings } = useStore()
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<Record<AiProvider, string[]>>(STATIC_MODELS)
  const [loading, setLoading] = useState<AiProvider | null>(null)
  const [fetched, setFetched] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
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

  const loadModels = async (p: AiProvider, force = false) => {
    if (fetched[p] && !force) return
    setLoading(p)
    setErrors(prev => ({ ...prev, [p]: "" }))
    const keyMap: Record<AiProvider, keyof typeof settings> = { groq:"groqKey", gemini:"geminiKey", claude:"claudeKey", ollama:"ollamaHost" }
    const apiKey = settings[keyMap[p]] as string
    const fetched2 = await fetchModels(p, apiKey, settings.ollamaHost, (err) => {
      setErrors(prev => ({ ...prev, [p]: err }))
    })
    setModels(prev => ({ ...prev, [p]: fetched2.length ? fetched2 : STATIC_MODELS[p] }))
    setFetched(prev => ({ ...prev, [p]: true }))
    setLoading(null)
  }

  const switchProvider = async (p: AiProvider) => {
    updateSettings({ activeProvider: p })
    await loadModels(p)
  }

  const selectModel = (model: string) => {
    const modelKeyMap: Record<AiProvider, keyof typeof settings> = { groq:"groqModel", gemini:"geminiModel", claude:"claudeModel", ollama:"ollamaModel" }
    updateSettings({ [modelKeyMap[provider]]: model } as any)
    setOpen(false)
  }

  const shortModel = currentModel.split("/").pop()?.split(":")[0] || currentModel
  const providerModels = models[provider] || STATIC_MODELS[provider] || []

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Trigger button — Copilot style */}
      <button onClick={() => { setOpen(!open); loadModels(provider) }}
        title={errors[provider] || `${PROVIDER_LABELS[provider]} — click to change model`}
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
                    onClick={() => { loadModels(provider, true) }}>
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
              onClick={() => { loadModels(provider, true) }}>
              <RefreshCw size={10} /> Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main AI Panel ────────────────────────────────────────────────────────────
export default function AiPanel() {
  const { aiMessages, aiLoading, sendAiMessage, clearAiMessages } = useStore()
  const [input, setInput] = useState("")
  const [showCommands, setShowCommands] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [aiMessages, aiLoading])

  const send = async () => {
    const text = input.trim()
    if (!text || aiLoading) return
    setInput(""); setShowCommands(false)
    await sendAiMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() }
    if (e.key === "Escape") setShowCommands(false)
  }

  const filteredCmds = SLASH_COMMANDS.filter(c => input === "/" || c.cmd.startsWith(input.split(" ")[0]))

  return (
    <div className="ai-panel">
      <div className="panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Sparkles size={14} style={{ color: "var(--accent)" }} />
          <span>AI Copilot</span>
        </div>
        <button className="icon-btn" onClick={clearAiMessages} title="Clear"><Trash2 size={13} /></button>
      </div>

      <div className="ai-messages">
        {aiMessages.length === 0 && (
          <div className="ai-welcome">
            <Bot size={28} style={{ color: "var(--accent)", marginBottom: 8 }} />
            <div className="ai-welcome-title">CodeDroid AI</div>
            <div className="ai-welcome-sub">Ask anything about your code</div>
            <div className="ai-suggestions">
              {["/fix bugs in selected code","/explain this function","/write unit tests","/refactor for performance"].map(s => (
                <button key={s} className="ai-suggestion" onClick={() => { setInput(s); inputRef.current?.focus() }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {aiMessages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
        {aiLoading && aiMessages[aiMessages.length-1]?.role !== "assistant" && (
          <div className="msg-wrap assistant">
            <div className="msg-bubble msg-ai"><Loader2 size={14} className="spin" style={{color:"var(--accent)"}} /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

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

      {/* Input area */}
      <div className="ai-input-area">
        <div className="ai-input-wrap">
          <textarea ref={inputRef} className="ai-input"
            placeholder="Ask AI... (/ for commands)"
            value={input}
            onChange={e => { setInput(e.target.value); setShowCommands(e.target.value.startsWith("/") && e.target.value.length > 0) }}
            onKeyDown={handleKeyDown} rows={1} style={{ resize: "none" }} />
          <button className="ai-send-btn" onClick={send} disabled={!input.trim() || aiLoading}>
            {aiLoading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
          </button>
        </div>

        {/* ── Copilot-style model picker bar ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 2px 2px" }}>
          <ModelPicker />
          <span style={{ fontSize: 10, color: "var(--text-dim)" }}>
            <kbd style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 2, padding: "0 3px", fontSize: 9, fontFamily: "monospace" }}>Enter</kbd> send
            {" · "}
            <kbd style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 2, padding: "0 3px", fontSize: 9, fontFamily: "monospace" }}>/</kbd> cmds
          </span>
        </div>
      </div>
    </div>
  )
}