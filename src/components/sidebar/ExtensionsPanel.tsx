import { useState, useEffect } from 'react'
import {
  Package, Download, CheckCircle2, XCircle, Loader2,
  FolderOpen, Search
} from 'lucide-react'
import { useStore } from '../../stores/appStore'

interface VsExtension {
  id: string; name: string; publisher: string; description: string
  category: string; installed: boolean; installing: boolean
  supported: boolean; installCmd?: string; altAction?: string
}

const EXT_MAP: Record<string, Partial<VsExtension>> = {
  'ms-python.python':            { name: 'Python', category: 'Language', supported: true, installCmd: 'pip install pylint black pyflakes', description: 'Python language support with linting and formatting' },
  'ms-python.black-formatter':   { name: 'Black Formatter', category: 'Formatter', supported: true, installCmd: 'pip install black', description: 'Python code formatter' },
  'ms-python.pylint':            { name: 'Pylint', category: 'Linter', supported: true, installCmd: 'pip install pylint', description: 'Python linting' },
  'ms-python.flake8':            { name: 'Flake8', category: 'Linter', supported: true, installCmd: 'pip install flake8', description: 'Python style checker' },
  'rust-lang.rust-analyzer':     { name: 'Rust Analyzer', category: 'Language', supported: true, installCmd: 'rustup component add rust-analyzer', description: 'Rust language support' },
  'esbenp.prettier-vscode':      { name: 'Prettier', category: 'Formatter', supported: true, installCmd: 'npm install -g prettier', description: 'Code formatter for JS/TS/CSS' },
  'dbaeumer.vscode-eslint':      { name: 'ESLint', category: 'Linter', supported: true, installCmd: 'npm install -g eslint', description: 'JavaScript/TypeScript linting' },
  'golang.go':                   { name: 'Go', category: 'Language', supported: true, installCmd: 'go install golang.org/x/tools/gopls@latest', description: 'Go language support' },
  'ritwickdey.liveserver':       { name: 'Live Server', category: 'Server', supported: true, installCmd: 'npm install -g live-server', description: 'Local dev server with live reload' },
  'ms-vscode.cpptools':          { name: 'C/C++', category: 'Language', supported: false, description: 'C/C++ support', altAction: 'Monaco has built-in C/C++ syntax highlighting' },
  'ms-azuretools.vscode-docker': { name: 'Docker', category: 'DevOps', supported: false, description: 'Docker support', altAction: 'Use terminal for Docker commands' },
  'eamodio.gitlens':             { name: 'GitLens', category: 'Git', supported: false, description: 'Git supercharged', altAction: 'CodeDroid has built-in Git panel' },
  'github.copilot':              { name: 'GitHub Copilot', category: 'AI', supported: false, description: 'AI pair programmer', altAction: 'CodeDroid has built-in AI Copilot with 4 providers!' },
  'PKief.material-icon-theme':   { name: 'Material Icons', category: 'Theme', supported: false, description: 'File icon theme', altAction: 'CodeDroid has built-in file icons' },
  'zhuangtongfa.material-theme': { name: 'Material Theme', category: 'Theme', supported: false, description: 'VS Code theme', altAction: 'CodeDroid has 16 built-in themes!' },
}

const POPULAR: VsExtension[] = Object.entries(EXT_MAP).map(([id, v]) => ({
  id, publisher: id.split(".")[0], installed: false, installing: false, name: "", category: "", description: "", supported: false, ...v
} as VsExtension))

const CATEGORY_COLORS: Record<string, string> = {
  Language: "#4ec9b0", Formatter: "#dcdcaa", Linter: "#f48771",
  AI: "#c586c0", Git: "#f44747", Theme: "#ce9178",
  DevOps: "#9cdcfe", Runner: "#b5cea8", Server: "#569cd6", Remote: "#808080",
}

export default function ExtensionsPanel() {
  const { folderPath } = useStore()
  const [extensions, setExtensions] = useState<VsExtension[]>(POPULAR)
  const [imported, setImported] = useState<VsExtension[]>([])
  const [query, setQuery] = useState("")
  const [output, setOutput] = useState<{ name: string; text: string; ok: boolean } | null>(null)
  const [activeTab, setActiveTab] = useState<"import" | "browse">("import")
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!folderPath || !window.api) return
    const load = async () => {
      const res = await window.api.readFile(`${folderPath}/.vscode/extensions.json`)
      if (!res.ok) return
      try {
        const data = JSON.parse(res.content)
        const recs: string[] = data.recommendations || []
        setImported(recs.map(id => {
          const k = EXT_MAP[id]
          return { id, name: k?.name || id.split(".")[1] || id, publisher: id.split(".")[0],
            description: k?.description || "VS Code extension", category: k?.category || "Extension",
            supported: k?.supported ?? false, installed: false, installing: false,
            installCmd: k?.installCmd, altAction: k?.altAction }
        }))
        setActiveTab("import")
      } catch {}
    }
    load()
  }, [folderPath])

  const install = async (ext: VsExtension) => {
    if (!ext.installCmd || !window.api) return
    const update = (list: VsExtension[]) => list.map(e => e.id === ext.id ? { ...e, installing: true } : e)
    setExtensions(update); setImported(update)
    const res = await window.api.shellExec(ext.installCmd, folderPath || undefined)
    setOutput({ name: ext.name, text: res.stdout + res.stderr, ok: res.ok })
    const done = (list: VsExtension[]) => list.map(e => e.id === ext.id ? { ...e, installing: false, installed: res.ok } : e)
    setExtensions(done); setImported(done)
  }

  const installAll = async () => {
    setImporting(true)
    for (const ext of imported.filter(e => e.supported && e.installCmd && !e.installed)) await install(ext)
    setImporting(false)
  }

  const list = activeTab === "import" ? imported : extensions.filter(e =>
    e.name.toLowerCase().includes(query.toLowerCase()) || e.category.toLowerCase().includes(query.toLowerCase()))

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="panel-header">
        <span>Extensions</span>
        {importing && <Loader2 size={13} className="spin" style={{ color: "var(--accent)" }} />}
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border-light)" }}>
        {(["import", "browse"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{
            flex: 1, padding: "7px", border: "none", cursor: "pointer", fontSize: 12,
            background: activeTab === t ? "var(--bg-active)" : "transparent",
            color: activeTab === t ? "var(--text)" : "var(--text-muted)",
            borderBottom: activeTab === t ? "1px solid var(--accent)" : "1px solid transparent"
          }}>
            {t === "import" ? `📥 VS Code ${imported.length > 0 ? `(${imported.length})` : ""}` : "🔍 Browse"}
          </button>
        ))}
      </div>

      {activeTab === "import" && (
        <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-light)", fontSize: 12 }}>
          {imported.length === 0 ? (
            <div style={{ color: "var(--text-dim)", lineHeight: 1.6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <FolderOpen size={14} style={{ color: "var(--accent)" }} />
                <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Open a project folder</span>
              </div>
              Auto-imports from <code style={{ background: "var(--bg)", padding: "1px 4px", borderRadius: 3, fontSize: 11 }}>.vscode/extensions.json</code>
            </div>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: "var(--text-muted)" }}>
                {imported.filter(e => e.supported).length} installable · {imported.filter(e => !e.supported).length} built-in
              </span>
              <button className="btn btn-primary" onClick={installAll} style={{ padding: "4px 10px", fontSize: 11 }}>
                Install All
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === "browse" && (
        <div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border-light)" }}>
          <div style={{ position: "relative" }}>
            <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text-dim)" }} />
            <input className="input" placeholder="Search extensions..." value={query}
              onChange={e => setQuery(e.target.value)} style={{ paddingLeft: 26 }} />
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {list.length === 0 && activeTab === "import" && (
          <div className="empty-state"><Package size={28} style={{ color: "var(--text-dim)" }} /><p>Open a project with .vscode/extensions.json</p></div>
        )}
        {list.map(ext => (
          <div key={ext.id} style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-light)", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{ext.name}</span>
                  <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 10, fontWeight: 600,
                    background: `${CATEGORY_COLORS[ext.category] || "var(--accent)"}22`,
                    color: CATEGORY_COLORS[ext.category] || "var(--accent)",
                    border: `1px solid ${CATEGORY_COLORS[ext.category] || "var(--accent)"}44` }}>
                    {ext.category}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{ext.description}</div>
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginTop: 2 }}>by {ext.publisher}</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                {ext.installed ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--git-added)" }}>
                    <CheckCircle2 size={13} /> Done
                  </div>
                ) : ext.installing ? (
                  <Loader2 size={14} className="spin" style={{ color: "var(--accent)" }} />
                ) : ext.supported && ext.installCmd ? (
                  <button className="btn btn-primary" onClick={() => install(ext)} style={{ padding: "3px 8px", fontSize: 11 }}>
                    <Download size={11} /> Install
                  </button>
                ) : (
                  <span style={{ fontSize: 10, color: "var(--text-dim)", padding: "3px 6px",
                    background: "var(--bg-hover)", borderRadius: "var(--radius)", border: "1px solid var(--border-light)" }}>
                    Built-in
                  </span>
                )}
              </div>
            </div>
            {ext.altAction && (
              <div style={{ fontSize: 11, color: "var(--accent)", background: "var(--accent-soft)",
                padding: "4px 8px", borderRadius: "var(--radius)", borderLeft: "2px solid var(--accent)" }}>
                ✨ {ext.altAction}
              </div>
            )}
          </div>
        ))}
      </div>

      {output && (
        <div style={{ borderTop: "1px solid var(--border)", padding: 8, maxHeight: 100, overflowY: "auto", background: "var(--bg)" }}>
          <div style={{ fontSize: 11, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
            {output.ok ? <CheckCircle2 size={12} style={{ color: "var(--git-added)" }} /> : <XCircle size={12} style={{ color: "var(--git-deleted)" }} />}
            <span style={{ color: output.ok ? "var(--git-added)" : "var(--git-deleted)", fontWeight: 500 }}>
              {output.name}: {output.ok ? "Installed" : "Failed"}
            </span>
          </div>
          <pre style={{ fontSize: 10, fontFamily: "monospace", color: "var(--text-muted)", whiteSpace: "pre-wrap", margin: 0 }}>{output.text.slice(0, 500)}</pre>
        </div>
      )}
    </div>
  )
}