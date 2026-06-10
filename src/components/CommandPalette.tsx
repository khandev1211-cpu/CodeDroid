import { useState, useEffect, useRef } from 'react'
import { Search, FileCode, Settings, Palette, GitBranch, Terminal, Bot, X } from 'lucide-react'
import { useStore } from '../stores/appStore'
import { themes } from '../themes/themes'
import './CommandPalette.css'

interface Command {
  id: string; label: string; desc?: string; icon: any; action: () => void
}

export default function CommandPalette() {
  const store = useStore()
  const { setCommandPaletteOpen, updateSettings, applyThemeById, setActivePanel, settings } = store
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const allCommands: Command[] = [
    { id: 'open-folder',    label: 'Open Folder',          desc: 'Open a project folder',   icon: FileCode,   action: () => window.api?.openFolder() },
    { id: 'open-file',      label: 'Open File',            desc: 'Open a file',             icon: FileCode,   action: () => window.api?.openFile() },
    { id: 'toggle-sidebar', label: 'Toggle Sidebar',       desc: 'Ctrl+B',                  icon: Settings,   action: () => updateSettings({ showSidebar: !settings.showSidebar }) },
    { id: 'toggle-terminal',label: 'Toggle Terminal',      desc: 'Ctrl+J',                  icon: Terminal,   action: () => updateSettings({ showTerminal: !settings.showTerminal }) },
    { id: 'toggle-ai',      label: 'Toggle AI Panel',      desc: '',                        icon: Bot,        action: () => updateSettings({ showAiPanel: !settings.showAiPanel }) },
    { id: 'git-panel',      label: 'Source Control',       desc: 'Open Git panel',          icon: GitBranch,  action: () => setActivePanel('git') },
    { id: 'search-panel',   label: 'Search in Files',      desc: 'Open search panel',       icon: Search,     action: () => setActivePanel('search') },
    ...themes.map(t => ({
      id: `theme-${t.id}`,
      label: `Theme: ${t.name}`,
      desc: t.category === 'new' ? '✨ New Original' : t.category,
      icon: Palette,
      action: () => applyThemeById(t.id)
    })),
    { id: 'font-sm',  label: 'Font Size: Small (12)',  desc: '', icon: Settings, action: () => updateSettings({ fontSize: 12 }) },
    { id: 'font-md',  label: 'Font Size: Medium (14)', desc: '', icon: Settings, action: () => updateSettings({ fontSize: 14 }) },
    { id: 'font-lg',  label: 'Font Size: Large (16)',  desc: '', icon: Settings, action: () => updateSettings({ fontSize: 16 }) },
    { id: 'font-xl',  label: 'Font Size: XLarge (18)', desc: '', icon: Settings, action: () => updateSettings({ fontSize: 18 }) },
    { id: 'wordwrap', label: 'Toggle Word Wrap',        desc: '', icon: Settings, action: () => updateSettings({ wordWrap: !settings.wordWrap }) },
    { id: 'minimap',  label: 'Toggle Minimap',          desc: '', icon: Settings, action: () => updateSettings({ minimap: !settings.minimap }) },
    { id: 'autosave', label: 'Toggle Auto Save',        desc: '', icon: Settings, action: () => updateSettings({ autoSave: !settings.autoSave }) },
  ]

  const filtered = query
    ? allCommands.filter(c =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        c.desc?.toLowerCase().includes(query.toLowerCase())
      )
    : allCommands

  useEffect(() => { setSelected(0) }, [query])

  const run = (cmd: Command) => {
    cmd.action()
    setCommandPaletteOpen(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter')     { if (filtered[selected]) run(filtered[selected]) }
    if (e.key === 'Escape')    { setCommandPaletteOpen(false) }
  }

  return (
    <div className="palette-overlay" onClick={() => setCommandPaletteOpen(false)}>
      <div className="palette" onClick={e => e.stopPropagation()}>
        <div className="palette-input-wrap">
          <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <button className="icon-btn" onClick={() => setCommandPaletteOpen(false)}>
            <X size={13} />
          </button>
        </div>
        <div className="palette-results">
          {filtered.length === 0 && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
              No commands found
            </div>
          )}
          {filtered.map((cmd, i) => (
            <div
              key={cmd.id}
              className={`palette-item ${i === selected ? 'selected' : ''}`}
              onClick={() => run(cmd)}
              onMouseEnter={() => setSelected(i)}
            >
              <cmd.icon size={14} style={{ color: i === selected ? 'var(--accent)' : 'var(--text-dim)', flexShrink: 0 }} />
              <span className="palette-label">{cmd.label}</span>
              {cmd.desc && <span className="palette-desc">{cmd.desc}</span>}
            </div>
          ))}
        </div>
        <div className="palette-footer">
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> run</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
