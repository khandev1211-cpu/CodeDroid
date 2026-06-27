import { useState, useEffect, useRef, useMemo } from 'react'
import {
  Search, FileCode, Settings, Palette, GitBranch,
  Terminal, Bot, X, Folder, Hash, Zap, Users,
  PlugZap, RefreshCw, Save, Eye, Type,
} from 'lucide-react'
import { useStore } from '../stores/appStore'
import { themes } from '../themes/themes'
import './CommandPalette.css'

interface CmdItem {
  id: string
  group: 'file' | 'command' | 'theme' | 'ai' | 'goto'
  label: string
  desc?: string
  icon: any
  preview?: string
  action: () => void
}

const GROUP_LABELS: Record<CmdItem['group'], string> = {
  file:    'RECENT FILES',
  command: 'COMMANDS',
  theme:   'THEMES',
  ai:      'AI ACTIONS',
  goto:    'GO TO LINE',
}

const GROUP_ORDER: CmdItem['group'][] = ['goto', 'file', 'command', 'ai', 'theme']

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'var(--accent)30', color: 'var(--accent)', borderRadius: 2 }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export default function CommandPalette() {
  const store = useStore()
  const {
    setCommandPaletteOpen, updateSettings, applyThemeById,
    setActivePanel, settings, openFiles, activeFileIndex,
    saveFile, saveAllFiles, openNewFolder,
  } = store

  const [query, setQuery]     = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef  = useRef<HTMLInputElement>(null)
  const listRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // ── Build command list ──────────────────────────────────────────────────────
  const allItems = useMemo((): CmdItem[] => {
    const items: CmdItem[] = []

    // Recent open files
    openFiles.forEach((f, i) => {
      items.push({
        id: `file-${f.path}`, group: 'file',
        label: f.name,
        desc: f.path,
        icon: FileCode,
        preview: f.content.slice(0, 200),
        action: () => store.setActiveFileIndex(i),
      })
    })

    // Commands
    const cmds: Omit<CmdItem, 'id' | 'group'>[] = [
      { label: 'Open Folder',          desc: 'Choose a project folder',    icon: Folder,    action: () => openNewFolder() },
      { label: 'Save File',            desc: 'Ctrl+S',                     icon: Save,      action: () => saveFile(activeFileIndex) },
      { label: 'Save All',             desc: 'Ctrl+Shift+S',               icon: Save,      action: () => saveAllFiles() },
      { label: 'Toggle Sidebar',       desc: 'Ctrl+B',                     icon: Settings,  action: () => updateSettings({ showSidebar: !settings.showSidebar }) },
      { label: 'Toggle Terminal',      desc: 'Ctrl+J',                     icon: Terminal,  action: () => updateSettings({ showTerminal: !settings.showTerminal }) },
      { label: 'Toggle AI Panel',      desc: 'Show/hide AI copilot',       icon: Bot,       action: () => updateSettings({ showAiPanel: !settings.showAiPanel }) },
      { label: 'Toggle Minimap',       desc: 'Show/hide editor minimap',   icon: Eye,       action: () => updateSettings({ minimap: !settings.minimap }) },
      { label: 'Toggle Word Wrap',     desc: 'Wrap long lines',            icon: Type,      action: () => updateSettings({ wordWrap: !settings.wordWrap }) },
      { label: 'Toggle Auto Save',     desc: 'Save files automatically',   icon: RefreshCw, action: () => updateSettings({ autoSave: !settings.autoSave }) },
      { label: 'Source Control',       desc: 'Open git panel',             icon: GitBranch, action: () => setActivePanel('git') },
      { label: 'Search in Files',      desc: 'Find across project',        icon: Search,    action: () => setActivePanel('search') },
      { label: 'MCP Plugins',          desc: 'Manage extensions',          icon: PlugZap,   action: () => setActivePanel('extensions') },
      { label: 'Collaboration',        desc: 'Start or join a session',    icon: Users,     action: () => setActivePanel('collab') },
      { label: 'Settings',             desc: 'Editor preferences',         icon: Settings,  action: () => setActivePanel('settings') },
      { label: 'Font Size: 12',        desc: 'Small',                      icon: Type,      action: () => updateSettings({ fontSize: 12 }) },
      { label: 'Font Size: 14',        desc: 'Medium (default)',            icon: Type,      action: () => updateSettings({ fontSize: 14 }) },
      { label: 'Font Size: 16',        desc: 'Large',                      icon: Type,      action: () => updateSettings({ fontSize: 16 }) },
      { label: 'Font Size: 18',        desc: 'X-Large',                    icon: Type,      action: () => updateSettings({ fontSize: 18 }) },
    ]
    cmds.forEach((c, i) => items.push({ ...c, id: `cmd-${i}`, group: 'command' }))

    // AI actions
    const aiActions: Omit<CmdItem, 'id' | 'group'>[] = [
      { label: '/fix — Fix errors in current file',     icon: Zap, action: () => { setCommandPaletteOpen(false); window.dispatchEvent(new CustomEvent('codedroid-slash', { detail: '/fix' })) } },
      { label: '/explain — Explain selected code',      icon: Zap, action: () => { setCommandPaletteOpen(false); window.dispatchEvent(new CustomEvent('codedroid-slash', { detail: '/explain' })) } },
      { label: '/refactor — Refactor for clarity',      icon: Zap, action: () => { setCommandPaletteOpen(false); window.dispatchEvent(new CustomEvent('codedroid-slash', { detail: '/refactor' })) } },
      { label: '/tests — Generate unit tests',          icon: Zap, action: () => { setCommandPaletteOpen(false); window.dispatchEvent(new CustomEvent('codedroid-slash', { detail: '/tests' })) } },
      { label: '/docs — Add JSDoc / docstrings',        icon: Zap, action: () => { setCommandPaletteOpen(false); window.dispatchEvent(new CustomEvent('codedroid-slash', { detail: '/docs' })) } },
      { label: '/optimize — Performance improvements',  icon: Zap, action: () => { setCommandPaletteOpen(false); window.dispatchEvent(new CustomEvent('codedroid-slash', { detail: '/optimize' })) } },
      { label: '/review — Code review feedback',        icon: Zap, action: () => { setCommandPaletteOpen(false); window.dispatchEvent(new CustomEvent('codedroid-slash', { detail: '/review' })) } },
      { label: '/types — Add TypeScript types',         icon: Zap, action: () => { setCommandPaletteOpen(false); window.dispatchEvent(new CustomEvent('codedroid-slash', { detail: '/types' })) } },
    ]
    aiActions.forEach((a, i) => items.push({ ...a, id: `ai-${i}`, group: 'ai' }))

    // Themes
    themes.forEach(t => items.push({
      id: `theme-${t.id}`, group: 'theme',
      label: t.name,
      desc: t.category === 'new' ? '✨ Original theme' : t.category,
      icon: Palette,
      action: () => applyThemeById(t.id),
    }))

    return items
  }, [openFiles, settings, activeFileIndex])

  // ── Filter + goto shortcut ─────────────────────────────────────────────────
  const isGoto = query.startsWith(':')
  const lineNum = isGoto ? parseInt(query.slice(1)) : NaN

  const filtered = useMemo((): CmdItem[] => {
    if (isGoto) {
      return [{
        id: 'goto', group: 'goto',
        label: isNaN(lineNum) ? 'Go to line…' : `Go to line ${lineNum}`,
        desc: 'Type a line number after :',
        icon: Hash,
        action: () => {
          if (!isNaN(lineNum)) {
            window.dispatchEvent(new CustomEvent('codedroid-goto-line', { detail: lineNum }))
          }
        },
      }]
    }
    if (!query) return allItems.slice(0, 30)
    const q = query.toLowerCase()
    return allItems.filter(
      c => c.label.toLowerCase().includes(q) || c.desc?.toLowerCase().includes(q)
    ).slice(0, 40)
  }, [query, allItems, isGoto, lineNum])

  // ── Group by category ──────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map = new Map<CmdItem['group'], CmdItem[]>()
    for (const item of filtered) {
      if (!map.has(item.group)) map.set(item.group, [])
      map.get(item.group)!.push(item)
    }
    return map
  }, [filtered])

  useEffect(() => { setSelected(0) }, [query])

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`) as HTMLElement
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const run = (item: CmdItem) => {
    item.action()
    setCommandPaletteOpen(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter')     { if (filtered[selected]) run(filtered[selected]) }
    if (e.key === 'Escape')    { setCommandPaletteOpen(false) }
  }

  // Flat index tracker for keyboard nav across groups
  let globalIdx = 0

  return (
    <div
      className="palette-overlay"
      onClick={() => setCommandPaletteOpen(false)}
    >
      <div className="palette" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="palette-input-wrap">
          <Search size={14} style={{ color: 'var(--text-dim)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Type a command, file name, :line, or /ai-action…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <kbd style={{ fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 3, padding: '1px 5px', flexShrink: 0 }}>ESC</kbd>
          <button className="icon-btn" onClick={() => setCommandPaletteOpen(false)} style={{ flexShrink: 0 }}>
            <X size={13} />
          </button>
        </div>

        {/* Hints */}
        <div style={{ padding: '4px 14px 6px', display: 'flex', gap: 16, fontSize: 10, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}>
          <span><kbd style={{ fontFamily: 'inherit' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>Enter</kbd> run</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>:42</kbd> go to line</span>
          <span><kbd style={{ fontFamily: 'inherit' }}>/fix</kbd> AI actions</span>
        </div>

        {/* Results */}
        <div ref={listRef} className="palette-list">
          {filtered.length === 0 && (
            <div style={{ padding: '20px 14px', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>
              No results for "{query}"
            </div>
          )}

          {GROUP_ORDER.map(group => {
            const items = grouped.get(group)
            if (!items?.length) return null
            return (
              <div key={group}>
                {/* Group header */}
                <div style={{ padding: '6px 14px 2px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
                  {GROUP_LABELS[group]}
                </div>

                {items.map(item => {
                  const idx = globalIdx++
                  const isSelected = idx === selected
                  const Icon = item.icon
                  return (
                    <div
                      key={item.id}
                      data-idx={idx}
                      className={`palette-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => run(item)}
                      onMouseEnter={() => setSelected(idx)}
                    >
                      <Icon size={14} style={{ color: isSelected ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {highlight(item.label, query)}
                        </div>
                        {item.desc && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                            {item.desc}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div style={{ padding: '5px 14px', borderTop: '1px solid var(--border-light)', fontSize: 10, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          <span>CodeDroid v4</span>
        </div>
      </div>
    </div>
  )
}