import { useState, useEffect } from "react"
import { Eye, EyeOff, RefreshCw, Loader2, CheckCircle2, Palette, Code, Layout, Bot, Keyboard, Type, Monitor } from "lucide-react"
import { useStore } from "../../stores/appStore"
import { themes } from "../../themes/themes"

type Tab = "ai" | "themes" | "editor" | "layout" | "keys"

// ── Font catalogue ──────────────────────────────────────────────────────────
const FONTS = [
  { label: "JetBrains Mono", value: "\'JetBrains Mono\', monospace" },
  { label: "Fira Code",       value: "\'Fira Code\', monospace" },
  { label: "Cascadia Code",   value: "\'Cascadia Code\', monospace" },
  { label: "Source Code Pro", value: "\'Source Code Pro\', monospace" },
  { label: "Consolas",        value: "Consolas, monospace" },
  { label: "Courier New",     value: "\'Courier New\', monospace" },
  { label: "Inconsolata",     value: "Inconsolata, monospace" },
  { label: "System Mono",     value: "monospace" },
]

// ── Model lists per provider ────────────────────────────────────────────────
const STATIC_MODELS: Record<string, string[]> = {
  groq:   ["llama3-70b-8192","llama3-8b-8192","mixtral-8x7b-32768","gemma2-9b-it","llama-3.1-70b-versatile","llama-3.1-8b-instant","llama-3.3-70b-versatile"],
  gemini: ["gemini-1.5-pro","gemini-1.5-flash","gemini-1.5-flash-8b","gemini-2.0-flash","gemini-2.0-flash-lite"],
  claude: ["claude-sonnet-4-20250514","claude-opus-4-5","claude-haiku-4-5-20251001","claude-3-5-sonnet-20241022"],
  ollama: [],
}

async function fetchModels(provider: string, apiKey: string, host: string): Promise<string[]> {
  try {
    if (provider === "groq" && apiKey) {
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      const data = await res.json()
      return data.data?.map((m: any) => m.id).sort() || STATIC_MODELS.groq
    }
    if (provider === "ollama") {
      const res = await fetch(`${host}/api/tags`)
      const data = await res.json()
      return data.models?.map((m: any) => m.name) || []
    }
    if (provider === "gemini" && apiKey) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
      const data = await res.json()
      return data.models?.map((m: any) => m.name.replace("models/","")).filter((m: string) => m.includes("gemini")) || STATIC_MODELS.gemini
    }
  } catch {}
  return STATIC_MODELS[provider] || []
}

export default function SettingsPanel() {
  const { settings, updateSettings, applyThemeById } = useStore()
  const [tab, setTab] = useState<Tab>("themes")
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({})
  const [models, setModels] = useState<Record<string, string[]>>(STATIC_MODELS)
  const [fetchingModels, setFetchingModels] = useState<string | null>(null)
  const [modelsFetched, setModelsFetched] = useState<Record<string, boolean>>({})

  const toggleKey = (k: string) => setShowKeys(s => ({ ...s, [k]: !s[k] }))

  const loadModels = async (provider: string) => {
    setFetchingModels(provider)
    const key = provider === "groq" ? settings.groqKey : provider === "gemini" ? settings.geminiKey : provider === "claude" ? settings.claudeKey : ""
    const fetched = await fetchModels(provider, key, settings.ollamaHost)
    setModels(prev => ({ ...prev, [provider]: fetched.length ? fetched : STATIC_MODELS[provider] || [] }))
    setModelsFetched(prev => ({ ...prev, [provider]: true }))
    setFetchingModels(null)
  }

  const PROVIDER_COLORS: Record<string, string> = {
    groq: "#f55036", gemini: "#4285f4", ollama: "#aaaaaa", claude: "#d97757"
  }

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: "themes", icon: Palette,  label: "Themes" },
    { id: "ai",     icon: Bot,      label: "AI" },
    { id: "editor", icon: Type,     label: "Editor" },
    { id: "layout", icon: Monitor,  label: "Layout" },
    { id: "keys",   icon: Keyboard, label: "Keys" },
  ]

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="panel-header"><span>Settings</span></div>

      {/* Tab strip */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border-light)", overflowX: "auto", flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: "flex", alignItems: "center", gap: 4, padding: "7px 10px",
            border: "none", background: tab === t.id ? "var(--bg-active)" : "transparent",
            color: tab === t.id ? "var(--text)" : "var(--text-dim)", fontSize: 11,
            cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
            borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent"
          }}>
            <t.icon size={12} />{t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px" }}>

        {/* ── THEMES ── */}
        {tab === "themes" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Font section */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                Font & Size
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Font Family</label>
                  <select className="input" value={settings.fontFamily} onChange={e => updateSettings({ fontFamily: e.target.value })}>
                    {FONTS.map(f => <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>)}
                  </select>
                </div>
              </div>
              {/* Font preview */}
              <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", fontFamily: settings.fontFamily, fontSize: settings.fontSize, color: "var(--text)", marginBottom: 10 }}>
                <span style={{ color: "var(--syn-keyword)" }}>const</span>
                {" "}<span style={{ color: "var(--syn-func)" }}>greet</span>
                <span style={{ color: "var(--text)" }}>{"("}</span>
                <span style={{ color: "var(--syn-var)" }}>name</span>
                <span style={{ color: "var(--text)" }}>{")"}</span>
                {" "}<span style={{ color: "var(--syn-keyword)"}}>=&gt;</span>
                {" "}<span style={{ color: "var(--syn-string)"}}>\`Hello, ${"${name}"}!\`</span>
              </div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>Font Size</span>
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>{settings.fontSize}px</span>
              </label>
              <input type="range" min={10} max={24} value={settings.fontSize}
                onChange={e => updateSettings({ fontSize: Number(e.target.value) })}
                style={{ width: "100%", accentColor: "var(--accent)", marginBottom: 8 }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-dim)" }}>
                <span>10px</span><span>14px</span><span>18px</span><span>24px</span>
              </div>
            </div>

            <div style={{ height: 1, background: "var(--border-light)", margin: "4px 0" }} />

            {/* Theme sections */}
            {(["new", "dark", "light"] as const).map(cat => (
              <div key={cat}>
                <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", margin: "10px 0 6px" }}>
                  {cat === "new" ? "✨ New Originals" : cat === "dark" ? "🌙 Dark" : "☀️ Light"}
                </div>
                {themes.filter(t => t.category === cat).map(t => (
                  <div key={t.id} onClick={() => applyThemeById(t.id)} style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                    borderRadius: "var(--radius)", cursor: "pointer", marginBottom: 4,
                    border: `1px solid ${settings.themeId === t.id ? "var(--accent)" : "var(--border-light)"}`,
                    background: settings.themeId === t.id ? "var(--accent-soft)" : "transparent",
                    transition: "all 0.1s"
                  }}
                  onMouseEnter={e => { if (settings.themeId !== t.id)(e.currentTarget as HTMLElement).style.background = "var(--bg-hover)" }}
                  onMouseLeave={e => { if (settings.themeId !== t.id)(e.currentTarget as HTMLElement).style.background = "" }}>
                    {/* Color swatches */}
                    <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      {[t.colors.bg, t.colors.bgPanel, t.colors.accent, t.colors.keyword, t.colors.string, t.colors.func].map((c, i) => (
                        <div key={i} style={{ width: 12, height: 20, background: c, borderRadius: 2, border: "1px solid rgba(128,128,128,0.2)" }} />
                      ))}
                    </div>
                    <span style={{ fontSize: 12, flex: 1, color: settings.themeId === t.id ? "var(--text)" : "var(--text-muted)" }}>{t.name}</span>
                    {settings.themeId === t.id && (
                      <CheckCircle2 size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ── AI SETTINGS ── */}
        {tab === "ai" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Provider selector */}
            <div>
              <div style={{ fontSize: 11, color: "var(--text-dim)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Active Provider</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                {(["groq", "gemini", "claude", "ollama"] as const).map(p => (
                  <button key={p} onClick={() => updateSettings({ activeProvider: p })} style={{
                    padding: "10px", border: `1px solid ${settings.activeProvider === p ? PROVIDER_COLORS[p] : "var(--border)"}`,
                    background: settings.activeProvider === p ? `${PROVIDER_COLORS[p]}15` : "transparent",
                    borderRadius: "var(--radius)", cursor: "pointer", textAlign: "left",
                    fontFamily: "inherit", transition: "all 0.15s"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: PROVIDER_COLORS[p] }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: settings.activeProvider === p ? PROVIDER_COLORS[p] : "var(--text-muted)" }}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Per-provider config */}
            {(["groq", "gemini", "claude", "ollama"] as const).map(p => {
              const keyMap: Record<string, keyof typeof settings> = { groq: "groqKey", gemini: "geminiKey", claude: "claudeKey", ollama: "ollamaHost" }
              const modelMap: Record<string, keyof typeof settings> = { groq: "groqModel", gemini: "geminiModel", claude: "claudeModel", ollama: "ollamaModel" }
              const keyField = keyMap[p]
              const modelField = modelMap[p]
              const providerModels = models[p] || STATIC_MODELS[p] || []

              return (
                <div key={p} style={{
                  border: `1px solid ${settings.activeProvider === p ? PROVIDER_COLORS[p] + "44" : "var(--border-light)"}`,
                  borderRadius: "var(--radius)", padding: "12px", background: settings.activeProvider === p ? `${PROVIDER_COLORS[p]}08` : "transparent"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: PROVIDER_COLORS[p] }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: PROVIDER_COLORS[p] }}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                  </div>

                  <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    {p === "ollama" ? "Host URL" : "API Key"}
                  </label>
                  <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                    <input className="input"
                      type={showKeys[p] ? "text" : p === "ollama" ? "text" : "password"}
                      placeholder={p === "ollama" ? "http://localhost:11434" : p === "groq" ? "gsk_..." : p === "gemini" ? "AIza..." : "sk-ant-..."}
                      value={settings[keyField] as string}
                      onChange={e => updateSettings({ [keyField]: e.target.value } as any)} />
                    {p !== "ollama" && (
                      <button className="icon-btn" onClick={() => toggleKey(p)}>
                        {showKeys[p] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    )}
                  </div>

                  {/* Model selector with fetch */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: "var(--text-muted)", flex: 1 }}>Model</label>
                    <button className="icon-btn" style={{ width: 22, height: 22 }}
                      onClick={() => loadModels(p)} title="Fetch available models">
                      {fetchingModels === p
                        ? <Loader2 size={12} className="spin" style={{ color: "var(--accent)" }} />
                        : <RefreshCw size={12} style={{ color: modelsFetched[p] ? "var(--git-added)" : "var(--text-dim)" }} />}
                    </button>
                  </div>
                  <select className="input" value={settings[modelField] as string}
                    onChange={e => updateSettings({ [modelField]: e.target.value } as any)}>
                    {providerModels.length === 0
                      ? <option value="">No models — click ↻ to fetch</option>
                      : providerModels.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {modelsFetched[p] && (
                    <div style={{ fontSize: 10, color: "var(--git-added)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                      <CheckCircle2 size={10} /> {providerModels.length} models loaded
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── EDITOR ── */}
        {tab === "editor" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Font Family</label>
              <select className="input" value={settings.fontFamily} onChange={e => updateSettings({ fontFamily: e.target.value })}>
                {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>Font Size</span><span style={{ color: "var(--accent)" }}>{settings.fontSize}px</span>
              </label>
              <input type="range" min={10} max={24} value={settings.fontSize}
                onChange={e => updateSettings({ fontSize: Number(e.target.value) })}
                style={{ width: "100%", accentColor: "var(--accent)" }} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Tab Size</label>
              <select className="input" value={settings.tabSize} onChange={e => updateSettings({ tabSize: Number(e.target.value) })}>
                {[2, 4, 8].map(n => <option key={n} value={n}>{n} spaces</option>)}
              </select>
            </div>
            {[
              { label: "Word Wrap", key: "wordWrap" },
              { label: "Minimap", key: "minimap" },
              { label: "Line Numbers", key: "lineNumbers" },
              { label: "Auto Save", key: "autoSave" },
              { label: "Breadcrumbs", key: "showBreadcrumbs" },
            ].map(({ label, key }) => (
              <label key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <div onClick={() => updateSettings({ [key]: !(settings as any)[key] } as any)}
                  style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", transition: "background 0.2s",
                    background: (settings as any)[key] ? "var(--accent)" : "var(--border)",
                    position: "relative", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 2, transition: "left 0.2s",
                    left: (settings as any)[key] ? 18 : 2,
                    width: 16, height: 16, borderRadius: "50%", background: "white" }} />
                </div>
              </label>
            ))}
          </div>
        )}

        {/* ── LAYOUT ── */}
        {tab === "layout" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { label: "Sidebar", key: "showSidebar" },
              { label: "AI Panel", key: "showAiPanel" },
              { label: "Terminal", key: "showTerminal" },
              { label: "Status Bar", key: "showStatusBar" },
            ].map(({ label, key }) => (
              <label key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, cursor: "pointer" }}>
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <div onClick={() => updateSettings({ [key]: !(settings as any)[key] } as any)}
                  style={{ width: 36, height: 20, borderRadius: 10, cursor: "pointer", transition: "background 0.2s",
                    background: (settings as any)[key] ? "var(--accent)" : "var(--border)", position: "relative", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 2, transition: "left 0.2s",
                    left: (settings as any)[key] ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "white" }} />
                </div>
              </label>
            ))}
            {[
              { label: "Sidebar Width", key: "sidebarWidth", min: 160, max: 480 },
              { label: "AI Panel Width", key: "aiPanelWidth", min: 200, max: 600 },
              { label: "Terminal Height", key: "terminalHeight", min: 80, max: 500 },
            ].map(({ label, key, min, max }) => (
              <div key={key}>
                <label style={{ fontSize: 11, color: "var(--text-muted)", display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>{label}</span><span style={{ color: "var(--accent)" }}>{(settings as any)[key]}px</span>
                </label>
                <input type="range" min={min} max={max} value={(settings as any)[key]}
                  onChange={e => updateSettings({ [key]: Number(e.target.value) } as any)}
                  style={{ width: "100%", accentColor: "var(--accent)" }} />
              </div>
            ))}
          </div>
        )}

        {/* ── KEYS ── */}
        {tab === "keys" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {[
              ["Save File", "Ctrl+S"], ["Save All", "Ctrl+Shift+S"],
              ["Command Palette", "Ctrl+Shift+P"], ["Toggle Sidebar", "Ctrl+B"],
              ["Toggle Terminal", "Ctrl+J"], ["Inline AI Edit", "Ctrl+I"],
              ["Close Tab", "Ctrl+W"], ["Find in Files", "Ctrl+Shift+F"],
              ["Undo", "Ctrl+Z"], ["Redo", "Ctrl+Y"],
              ["Format Document", "Shift+Alt+F"], ["Toggle Comment", "Ctrl+/"],
            ].map(([action, key]) => (
              <div key={action} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "7px 4px", borderBottom: "1px solid var(--border-light)", fontSize: 12 }}>
                <span style={{ color: "var(--text-muted)" }}>{action}</span>
                <kbd style={{ background: "var(--bg-input)", border: "1px solid var(--border)",
                  borderRadius: 3, padding: "2px 6px", fontSize: 11, fontFamily: "monospace", color: "var(--text)" }}>
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}