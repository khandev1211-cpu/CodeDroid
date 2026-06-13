import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import {
  FolderOpen, FolderClosed, File, FileCode, FileText, ChevronRight, ChevronDown,
  FilePlus, FolderPlus, RefreshCw, ChevronsUpDown,
} from 'lucide-react'
import { useStore, OpenFile } from '../../stores/appStore'
import './FilesPanel.css'

// ─── Constants ────────────────────────────────────────────────────────────────
const INVALID_CHARS = /[\\/:*?"<>|]/
const MAX_NAME_LEN  = 255

const EXT_LANG: Record<string, string> = {
  '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript',
  '.py': 'python', '.rs': 'rust', '.html': 'html', '.css': 'css', '.json': 'json',
  '.md': 'markdown', '.yml': 'yaml', '.yaml': 'yaml', '.sh': 'shell',
  '.toml': 'toml', '.sql': 'sql', '.go': 'go', '.java': 'java',
}

function getLanguage(name: string): string {
  const ext = '.' + (name.split('.').pop()?.toLowerCase() || '')
  return EXT_LANG[ext] || 'plaintext'
}

function validateName(name: string): string | null {
  if (!name.trim()) return 'Name cannot be empty'
  if (INVALID_CHARS.test(name)) return 'Name cannot contain: \\ / : * ? " < > |'
  if (name.length > MAX_NAME_LEN) return 'Name is too long'
  return null
}

function joinPath(a: string, b: string): string {
  return a.replace(/[\\/]+$/, '') + '/' + b
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function FileIcon({ name, isDir, expanded }: { name: string; isDir: boolean; expanded?: boolean }) {
  if (isDir) return expanded ? <FolderOpen size={14} className="fi-dir" /> : <FolderClosed size={14} className="fi-dir" />
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['ts','tsx','js','jsx','py','rs','dart'].includes(ext)) return <FileCode size={14} className="fi-code" />
  if (['md','txt','csv'].includes(ext)) return <FileText size={14} className="fi-text" />
  return <File size={14} className="fi-file" />
}

// ─── Toast ────────────────────────────────────────────────────────────────────
interface ToastMsg { id: number; text: string; type: 'ok' | 'err' }
let _toastId = 0
const _toastListeners: Set<(t: ToastMsg) => void> = new Set()
export function showToast(text: string, type: 'ok' | 'err' = 'ok') {
  const msg = { id: ++_toastId, text, type }
  _toastListeners.forEach(fn => fn(msg))
}

function Toast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([])
  useEffect(() => {
    const fn = (t: ToastMsg) => {
      setToasts(p => [...p, t])
      setTimeout(() => setToasts(p => p.filter(x => x.id !== t.id)), 3000)
    }
    _toastListeners.add(fn)
    return () => { _toastListeners.delete(fn) }
  }, [])
  if (!toasts.length) return null
  return (
    <div className="toast-stack">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>{t.text}</div>
      ))}
    </div>
  )
}

// ─── Inline Input ─────────────────────────────────────────────────────────────
interface InlineInputProps {
  depth: number
  isDir: boolean
  initialValue?: string
  onConfirm: (name: string) => Promise<void>
  onCancel: () => void
  existingNames?: string[]
}

function InlineInput({ depth, isDir, initialValue = '', onConfirm, onCancel, existingNames = [] }: InlineInputProps) {
  const [value, setValue] = useState(initialValue)
  const [error, setError]   = useState<string | null>(null)
  const [busy, setBusy]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    inputRef.current?.focus()
    if (initialValue) {
      const dotIdx = initialValue.lastIndexOf('.')
      if (dotIdx > 0 && !isDir) {
        inputRef.current?.setSelectionRange(0, dotIdx)
      } else {
        inputRef.current?.select()
      }
    }
  }, [])

  const validate = (v: string): string | null => {
    const base = validateName(v)
    if (base) return base
    const finalName = v.endsWith('/') ? v.slice(0, -1) : v
    if (existingNames.includes(finalName)) return `⚠ '${finalName}' already exists in this location`
    return null
  }

  const handleChange = (v: string) => {
    setValue(v)
    setError(validate(v))
  }

  const handleConfirm = async () => {
    const err = validate(value)
    if (err) { setError(err); return }
    setBusy(true)
    await onConfirm(value.trim())
    setBusy(false)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === 'Enter') { e.preventDefault(); handleConfirm() }
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
  }

  return (
    <div className="inline-input-wrap" style={{ paddingLeft: depth * 12 + 8 }}>
      <FileIcon name={value || (isDir ? 'folder' : 'file')} isDir={isDir || value.endsWith('/')} />
      <div className="inline-input-col">
        <input
          ref={inputRef}
          className={`tree-rename-input ${error ? 'input-err' : ''}`}
          value={value}
          disabled={busy}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKey}
          onBlur={onCancel}
          placeholder={isDir ? 'folder name' : 'file name'}
          style={{ flex: 1 }}
        />
        {error && <div className="inline-error">{error}</div>}
      </div>
    </div>
  )
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
interface CtxItem { label: string; icon?: string; shortcut?: string; danger?: boolean; separator?: boolean; action?: () => void }

function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: CtxItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Clamp position so it doesn't go off screen
  const [pos, setPos] = useState({ left: x, top: y })
  useLayoutEffect(() => {
    if (!ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    setPos({
      left: Math.min(x, window.innerWidth  - width  - 8),
      top:  Math.min(y, window.innerHeight - height - 8),
    })
  }, [x, y])

  return (
    <div ref={ref} className="ctx-menu-v2" style={{ left: pos.left, top: pos.top }} onMouseDown={e => e.stopPropagation()}>
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="ctx-sep" />
        ) : (
          <div
            key={i}
            className={`ctx-item-v2 ${item.danger ? 'danger' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); item.action?.(); onClose() }}
          >
            <span className="ctx-icon">{item.icon}</span>
            <span className="ctx-label">{item.label}</span>
            {item.shortcut && <span className="ctx-shortcut">{item.shortcut}</span>}
          </div>
        )
      )}
    </div>
  )
}

// ─── Tree Node ────────────────────────────────────────────────────────────────
interface TreeNode { name: string; path: string; isDir: boolean }
type CreatingIn = { parentPath: string; isDir: boolean; depth: number } | null

interface TreeItemProps {
  node: TreeNode
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
  onOpen: (n: TreeNode) => void
  onRefresh: () => void
  onStartCreate: (parentPath: string, isDir: boolean, depth: number) => void
  clipboard: { path: string; mode: 'copy' | 'cut' } | null
  setClipboard: (c: { path: string; mode: 'copy' | 'cut' } | null) => void
  workspaceRoot: string
  creatingIn: CreatingIn
  setCreatingIn: (c: CreatingIn) => void
}

function TreeItem({
  node, depth, selectedPath, onSelect, onOpen, onRefresh,
  onStartCreate, clipboard, setClipboard, workspaceRoot,
  creatingIn, setCreatingIn,
}: TreeItemProps) {
  const [expanded,  setExpanded]  = useState(depth === 0)
  const [children,  setChildren]  = useState<TreeNode[]>([])
  const [renaming,  setRenaming]  = useState(false)
  const [ctx,       setCtx]       = useState<{ x: number; y: number } | null>(null)
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { gitFiles, openFiles, activeFileIndex, renameOpenFile, closeFile } = useStore()
  const gitStatus   = gitFiles.find(g => g.path === node.path || node.path.endsWith(g.path))
  const isActiveFile = !node.isDir && openFiles[activeFileIndex]?.path === node.path
  const isSelected   = selectedPath === node.path
  const gitColor = gitStatus
    ? gitStatus.status === 'M' ? 'var(--git-modified)'
    : gitStatus.status === 'A' ? 'var(--git-added)'
    : gitStatus.status === 'D' ? 'var(--git-deleted)' : undefined
    : undefined

  const loadChildren = useCallback(async () => {
    if (!node.isDir || !window.api) return
    const res = await window.api.readDir(node.path)
    if (res.ok) {
      const sorted = res.entries.sort((a: any, b: any) => {
        if (a.isDir !== b.isDir) return b.isDir ? 1 : -1
        return a.name.localeCompare(b.name)
      })
      setChildren(sorted.map((e: any) => ({ name: e.name, path: e.path, isDir: e.isDir })))
    }
  }, [node.path, node.isDir])

  useEffect(() => {
    if (expanded && node.isDir) loadChildren()
  }, [expanded])

  // Refresh children when anything changes inside this folder
  const handleChildRefresh = useCallback(async () => {
    await loadChildren()
    onRefresh()
  }, [loadChildren, onRefresh])

  const toggle = async () => {
    if (!node.isDir) { onOpen(node); return }
    if (!expanded) await loadChildren()
    setExpanded(e => !e)
  }

  // Slow double-click to rename (like VS Code)
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(node.path)
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
      setRenaming(true)
      return
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      toggle()
    }, 300)
  }

  const handleCtxMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onSelect(node.path)
    setCtx({ x: e.clientX, y: e.clientY })
  }

  // ── Rename ────────────────────────────────────────────────────────────────
  const handleRenameConfirm = async (newName: string) => {
    const finalName = newName.endsWith('/') ? newName.slice(0, -1) : newName
    if (!finalName || finalName === node.name) { setRenaming(false); return }
    const parentDir = node.path.substring(0, node.path.lastIndexOf('/'))
    const newPath = joinPath(parentDir, finalName)
    const res = await window.api.rename(node.path, newPath)
    if (res.ok) {
      renameOpenFile(node.path, newPath, finalName)
      showToast(`✅ Renamed: ${node.name} → ${finalName}`)
      setRenaming(false)
      onRefresh()
    } else {
      showToast(`❌ ${res.message || res.error}`, 'err')
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete '${node.name}'?\nThis cannot be undone.`)) return
    // Close any open editor tab for this path
    const tabIdx = openFiles.findIndex(f => f.path === node.path || f.path.startsWith(node.path + '/'))
    if (tabIdx >= 0) closeFile(tabIdx)
    const res = await window.api.deleteItem(node.path)
    if (res.ok) {
      showToast(`🗑️ Deleted: ${node.name}`)
      onRefresh()
    } else {
      showToast(`❌ ${res.message || res.error}`, 'err')
    }
  }

  // ── Copy / Cut / Paste ────────────────────────────────────────────────────
  const handleCopy = () => setClipboard({ path: node.path, mode: 'copy' })
  const handleCut  = () => setClipboard({ path: node.path, mode: 'cut'  })

  const handlePaste = async () => {
    if (!clipboard || !node.isDir) return
    const srcName = clipboard.path.split('/').pop() || 'file'
    const destPath = joinPath(node.path, srcName)
    if (clipboard.mode === 'copy') {
      const res = await window.api.copyFile(clipboard.path, destPath)
      if (res.ok) { showToast(`✅ Copied: ${srcName}`); loadChildren(); onRefresh() }
      else showToast(`❌ ${res.message || res.error}`, 'err')
    } else {
      const res = await window.api.rename(clipboard.path, destPath)
      if (res.ok) { setClipboard(null); showToast(`✅ Moved: ${srcName}`); onRefresh() }
      else showToast(`❌ ${res.message || res.error}`, 'err')
    }
  }

  // ── Copy path ─────────────────────────────────────────────────────────────
  const copyAbsPath = () => navigator.clipboard.writeText(node.path)
  const copyRelPath = () => {
    const rel = node.path.startsWith(workspaceRoot)
      ? node.path.slice(workspaceRoot.length).replace(/^[\\/]/, '')
      : node.path
    navigator.clipboard.writeText(rel)
  }

  // ── Open in terminal ──────────────────────────────────────────────────────
  const { addTerminalTab } = useStore()
  const openInTerminal = () => {
    const targetDir = node.isDir ? node.path : node.path.substring(0, node.path.lastIndexOf('/'))
    addTerminalTab(targetDir)
  }

  // ── Context menu items ────────────────────────────────────────────────────
  const ctxItems: CtxItem[] = node.isDir ? [
    { icon: '📄', label: 'New File',   action: () => { setExpanded(true); onStartCreate(node.path, false, depth + 1) } },
    { icon: '📁', label: 'New Folder', action: () => { setExpanded(true); onStartCreate(node.path, true,  depth + 1) } },
    { separator: true },
    { icon: '📋', label: 'Copy', action: handleCopy },
    { icon: '✂️',  label: 'Cut',  action: handleCut  },
    { icon: '📌', label: 'Paste', action: handlePaste },
    { separator: true },
    { icon: '✏️',  label: 'Rename', shortcut: 'F2', action: () => setRenaming(true) },
    { icon: '🗑️', label: 'Delete', shortcut: 'Del', danger: true, action: handleDelete },
    { separator: true },
    { icon: '📂', label: 'Open in Terminal',  action: openInTerminal  },
    { icon: '📁', label: 'Reveal in Explorer', action: () => window.api.revealInExplorer(node.path) },
  ] : [
    { icon: '📋', label: 'Copy', action: handleCopy },
    { icon: '✂️',  label: 'Cut',  action: handleCut  },
    { separator: true },
    { icon: '✏️',  label: 'Rename', shortcut: 'F2', action: () => setRenaming(true) },
    { icon: '🗑️', label: 'Delete', shortcut: 'Del', danger: true, action: handleDelete },
    { separator: true },
    { icon: '📋', label: 'Copy Path',          action: copyAbsPath },
    { icon: '📋', label: 'Copy Relative Path', action: copyRelPath  },
    { icon: '📂', label: 'Open Containing Folder in Terminal', action: openInTerminal },
    { icon: '📁', label: 'Reveal in Explorer', action: () => window.api.revealInExplorer(node.path) },
  ]

  // Sibling names for duplicate-name check in inline creation
  const siblingNames = children.map(c => c.name)

  // ── Keyboard handling when this row is selected ───────────────────────────
  const handleRowKey = (e: React.KeyboardEvent) => {
    if (e.key === 'F2') { e.preventDefault(); setRenaming(true) }
    if (e.key === 'Delete') { e.preventDefault(); handleDelete() }
  }

  return (
    <div>
      {/* Tree row */}
      {renaming ? (
        <InlineInput
          depth={depth}
          isDir={node.isDir}
          initialValue={node.name}
          onConfirm={handleRenameConfirm}
          onCancel={() => setRenaming(false)}
          existingNames={[]}
        />
      ) : (
        <div
          className={`tree-item ${isActiveFile || isSelected ? 'active' : ''}`}
          style={{ paddingLeft: depth * 12 + 8 }}
          onClick={handleClick}
          onContextMenu={handleCtxMenu}
          onKeyDown={handleRowKey}
          tabIndex={0}
          data-path={node.path}
        >
          {node.isDir
            ? <span className="tree-arrow">{expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</span>
            : <span style={{ width: 14 }} />
          }
          <FileIcon name={node.name} isDir={node.isDir} expanded={expanded} />
          <span className="tree-name" style={{ color: gitColor }}>{node.name}</span>
          {gitStatus && <span className="git-badge" style={{ color: gitColor }}>{gitStatus.status}</span>}
        </div>
      )}

      {/* Inline creation slot inside this folder */}
      {node.isDir && expanded && creatingIn?.parentPath === node.path && (
        <InlineInput
          depth={creatingIn.depth}
          isDir={creatingIn.isDir}
          onConfirm={async (name) => {
            const isFolder = creatingIn.isDir || name.endsWith('/')
            const finalName = name.endsWith('/') ? name.slice(0, -1) : name
            const fullPath = joinPath(node.path, finalName)
            const res = isFolder
              ? await window.api.createDir(fullPath)
              : await window.api.createFile(fullPath)
            if (res.ok) {
              showToast(`✅ Created: ${finalName}`)
              setCreatingIn(null)
              await loadChildren()
              if (!isFolder) {
                const content = await window.api.readFile(fullPath)
                useStore.getState().openFile({
                  path: fullPath, name: finalName,
                  content: content.ok ? content.content : '',
                  language: getLanguage(finalName),
                  isDirty: false, cursorLine: 1, cursorCol: 1, scrollTop: 0,
                })
              }
              onRefresh()
            } else {
              showToast(`❌ ${res.message || res.error}`, 'err')
            }
          }}
          onCancel={() => setCreatingIn(null)}
          existingNames={siblingNames}
        />
      )}

      {/* Children */}
      {node.isDir && expanded && children.map(child => (
        <TreeItem
          key={child.path}
          node={child}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onOpen={onOpen}
          onRefresh={handleChildRefresh}
          onStartCreate={onStartCreate}
          clipboard={clipboard}
          setClipboard={setClipboard}
          workspaceRoot={workspaceRoot}
          creatingIn={creatingIn}
          setCreatingIn={setCreatingIn}
        />
      ))}

      {/* Context menu portal */}
      {ctx && (
        <ContextMenu
          x={ctx.x} y={ctx.y}
          items={ctxItems}
          onClose={() => setCtx(null)}
        />
      )}
    </div>
  )
}

// ─── FilesPanel ───────────────────────────────────────────────────────────────
export default function FilesPanel() {
  const { folderPath, openNewFolder, openFile, loadGitStatus, addTerminalTab } = useStore()
  const [rootChildren, setRootChildren] = useState<TreeNode[]>([])
  const [refreshKey,   setRefreshKey]   = useState(0)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [creatingIn,   setCreatingIn]   = useState<CreatingIn>(null)
  const [clipboard,    setClipboard]    = useState<{ path: string; mode: 'copy' | 'cut' } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const loadRoot = useCallback(async () => {
    if (!folderPath || !window.api) return
    const res = await window.api.readDir(folderPath)
    if (res.ok) {
      const sorted = res.entries.sort((a: any, b: any) => {
        if (a.isDir !== b.isDir) return b.isDir ? 1 : -1
        return a.name.localeCompare(b.name)
      })
      setRootChildren(sorted.map((e: any) => ({ name: e.name, path: e.path, isDir: e.isDir })))
    }
    loadGitStatus()
  }, [folderPath])

  useEffect(() => { loadRoot() }, [loadRoot, refreshKey])

  const handleFileOpen = async (node: TreeNode) => {
    if (!window.api) return
    const res = await window.api.readFile(node.path)
    if (res.ok) {
      openFile({
        path: node.path, name: node.name, content: res.content,
        language: getLanguage(node.name), isDirty: false,
        cursorLine: 1, cursorCol: 1, scrollTop: 0,
      })
    }
  }

  // Determine context folder for toolbar New File / New Folder
  const getCreateContext = (): { parentPath: string; depth: number } => {
    if (!folderPath) return { parentPath: '', depth: 0 }
    if (!selectedPath) return { parentPath: folderPath, depth: 0 }
    // If selected is a dir, create inside it; if a file, create in its parent
    const isSelectedDir = rootChildren.some(c => c.path === selectedPath && c.isDir)
    if (isSelectedDir) return { parentPath: selectedPath, depth: 1 }
    const parentPath = selectedPath.substring(0, selectedPath.lastIndexOf('/'))
    return { parentPath: parentPath || folderPath, depth: 1 }
  }

  const startCreate = (isDir: boolean) => {
    const { parentPath, depth } = getCreateContext()
    if (parentPath) setCreatingIn({ parentPath, isDir, depth })
  }

  // Root-level inline creation slot
  const rootSiblingNames = rootChildren.map(c => c.name)

  // Panel keyboard shortcuts
  const handlePanelKey = (e: React.KeyboardEvent) => {
    if (!selectedPath) return
    if (e.altKey && !e.shiftKey && e.key === 'n') { e.preventDefault(); startCreate(false) }
    if (e.altKey &&  e.shiftKey && e.key === 'N') { e.preventDefault(); startCreate(true) }
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') { if (selectedPath) setClipboard({ path: selectedPath, mode: 'copy' }) }
    if ((e.ctrlKey || e.metaKey) && e.key === 'x') { if (selectedPath) setClipboard({ path: selectedPath, mode: 'cut'  }) }
  }

  return (
    <div className="files-panel" ref={panelRef} tabIndex={-1} onKeyDown={handlePanelKey}>
      <div className="panel-header">
        <span>Explorer</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="icon-btn" onClick={() => startCreate(false)} title="New File (Alt+N)"><FilePlus size={14} /></button>
          <button className="icon-btn" onClick={() => startCreate(true)}  title="New Folder (Alt+Shift+N)"><FolderPlus size={14} /></button>
          <button className="icon-btn" onClick={() => setRefreshKey(k => k + 1)} title="Refresh"><RefreshCw size={14} /></button>
          <button className="icon-btn" title="Collapse All" onClick={() => setRefreshKey(k => k + 1)}><ChevronsUpDown size={14} /></button>
        </div>
      </div>

      <div className="files-content">
        {!folderPath ? (
          <div className="empty-state">
            <FolderOpen size={32} style={{ color: 'var(--text-dim)' }} />
            <p>No folder open</p>
            <button className="btn btn-primary" onClick={() => openNewFolder()}>Open Folder</button>
          </div>
        ) : (
          <div className="tree-root">
            <div className="tree-folder-name">
              {folderPath.split('/').pop() || folderPath.split('\\').pop()}
            </div>

            {/* Root-level inline creation */}
            {creatingIn && creatingIn.parentPath === folderPath && (
              <InlineInput
                depth={0}
                isDir={creatingIn.isDir}
                onConfirm={async (name) => {
                  const isFolder = creatingIn.isDir || name.endsWith('/')
                  const finalName = name.endsWith('/') ? name.slice(0, -1) : name
                  const fullPath = joinPath(folderPath, finalName)
                  const res = isFolder
                    ? await window.api.createDir(fullPath)
                    : await window.api.createFile(fullPath)
                  if (res.ok) {
                    showToast(`✅ Created: ${finalName}`)
                    setCreatingIn(null)
                    setRefreshKey(k => k + 1)
                    if (!isFolder) {
                      const content = await window.api.readFile(fullPath)
                      openFile({
                        path: fullPath, name: finalName,
                        content: content.ok ? content.content : '',
                        language: getLanguage(finalName),
                        isDirty: false, cursorLine: 1, cursorCol: 1, scrollTop: 0,
                      })
                    }
                  } else {
                    showToast(`❌ ${res.message || res.error}`, 'err')
                  }
                }}
                onCancel={() => setCreatingIn(null)}
                existingNames={rootSiblingNames}
              />
            )}

            {rootChildren.map(node => (
              <TreeItem
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedPath}
                onSelect={setSelectedPath}
                onOpen={handleFileOpen}
                onRefresh={() => setRefreshKey(k => k + 1)}
                onStartCreate={(parentPath, isDir, depth) => setCreatingIn({ parentPath, isDir, depth })}
                clipboard={clipboard}
                setClipboard={setClipboard}
                workspaceRoot={folderPath}
                creatingIn={creatingIn}
                setCreatingIn={setCreatingIn}
              />
            ))}
          </div>
        )}
      </div>
      <Toast />
    </div>
  )
}