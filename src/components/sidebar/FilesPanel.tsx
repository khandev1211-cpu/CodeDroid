import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import {
  FolderOpen, FolderClosed, File, FileCode, FileText, ChevronRight, ChevronDown,
  FilePlus, FolderPlus, RefreshCw, ChevronsUpDown,
} from 'lucide-react'
import { useStore } from '../../stores/appStore'
import './FilesPanel.css'

// ─── Cross-platform path utilities ────────────────────────────────────────────
// On Windows, Electron returns paths with backslashes.
// We normalise EVERYTHING to forward-slashes internally.

function normPath(p: string): string {
  return p.replace(/\\/g, '/')
}

function pathDirname(p: string): string {
  const n = normPath(p)
  const idx = n.lastIndexOf('/')
  return idx >= 0 ? n.slice(0, idx) : n
}

function pathBasename(p: string): string {
  const n = normPath(p)
  return n.slice(n.lastIndexOf('/') + 1)
}

function pathJoin(a: string, b: string): string {
  return normPath(a).replace(/\/+$/, '') + '/' + b
}

function pathStartsWith(child: string, parent: string): boolean {
  const c = normPath(child)
  const p = normPath(parent).replace(/\/+$/, '') + '/'
  return c.startsWith(p) || c === normPath(parent)
}

// ─── Validation ───────────────────────────────────────────────────────────────
const INVALID_CHARS = /[\\/:*?"<>|]/
const MAX_NAME_LEN  = 255

function validateName(name: string): string | null {
  if (!name.trim())              return 'Name cannot be empty'
  if (INVALID_CHARS.test(name)) return 'Name cannot contain: \\ / : * ? " < > |'
  if (name.length > MAX_NAME_LEN) return 'Name is too long'
  return null
}

// ─── Name conflict resolution ─────────────────────────────────────────────────
async function resolveNameConflict(destPath: string): Promise<string> {
  if (!window.api) return destPath
  if (!(await window.api.exists(destPath))) return destPath
  const ext  = destPath.includes('.') ? destPath.slice(destPath.lastIndexOf('.')) : ''
  const base = destPath.slice(0, destPath.length - ext.length)
  let candidate = `${base} copy${ext}`
  let n = 2
  while (await window.api.exists(candidate)) {
    candidate = `${base} copy ${n}${ext}`
    n++
  }
  return candidate
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function FileIcon({ name, isDir, expanded }: { name: string; isDir: boolean; expanded?: boolean }) {
  if (isDir) return expanded ? <FolderOpen size={14} className="fi-dir" /> : <FolderClosed size={14} className="fi-dir" />
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['ts','tsx','js','jsx','py','rs','dart'].includes(ext)) return <FileCode size={14} className="fi-code" />
  if (['md','txt','csv'].includes(ext)) return <FileText size={14} className="fi-text" />
  return <File size={14} className="fi-file" />
}

function getLanguage(name: string): string {
  const ext = '.' + (name.split('.').pop()?.toLowerCase() || '')
  const map: Record<string, string> = {
    '.ts':'typescript','.tsx':'typescript','.js':'javascript','.jsx':'javascript',
    '.py':'python','.rs':'rust','.html':'html','.css':'css','.json':'json',
    '.md':'markdown','.yml':'yaml','.yaml':'yaml','.sh':'shell',
    '.toml':'toml','.sql':'sql','.go':'go','.java':'java',
  }
  return map[ext] || 'plaintext'
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
  const [error, setError] = useState<string | null>(null)
  const [busy,  setBusy]  = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    inputRef.current?.focus()
    if (initialValue) {
      const dotIdx = initialValue.lastIndexOf('.')
      if (dotIdx > 0 && !isDir) inputRef.current?.setSelectionRange(0, dotIdx)
      else inputRef.current?.select()
    }
  }, [])

  const validate = (v: string): string | null => {
    const base = validateName(v)
    if (base) return base
    const finalName = v.endsWith('/') ? v.slice(0, -1) : v
    if (existingNames.includes(finalName)) return `⚠ '${finalName}' already exists in this location`
    return null
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
    if (e.key === 'Enter')  { e.preventDefault(); handleConfirm() }
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
          onChange={e => { setValue(e.target.value); setError(validate(e.target.value)) }}
          onKeyDown={handleKey}
          onBlur={onCancel}
          placeholder={isDir ? 'folder name' : 'file name'}
        />
        {error && <div className="inline-error">{error}</div>}
      </div>
    </div>
  )
}

// ─── Context Menu ─────────────────────────────────────────────────────────────
interface CtxItem { label?: string; icon?: string; shortcut?: string; danger?: boolean; separator?: boolean; action?: () => void }

function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: CtxItem[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x, top: y })

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useLayoutEffect(() => {
    if (!ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    setPos({ left: Math.min(x, window.innerWidth - width - 8), top: Math.min(y, window.innerHeight - height - 8) })
  }, [x, y])

  return (
    <div ref={ref} className="ctx-menu-v2" style={{ left: pos.left, top: pos.top }} onMouseDown={e => e.stopPropagation()}>
      {items.map((item, i) =>
        item.separator ? <div key={i} className="ctx-sep" /> : (
          <div key={i} className={`ctx-item-v2 ${item.danger ? 'danger' : ''}`}
            onMouseDown={e => { e.preventDefault(); item.action?.(); onClose() }}>
            <span className="ctx-icon">{item.icon}</span>
            <span className="ctx-label">{item.label}</span>
            {item.shortcut && <span className="ctx-shortcut">{item.shortcut}</span>}
          </div>
        )
      )}
    </div>
  )
}

// ─── Clipboard state (module-level so it persists across re-renders) ──────────
interface Clipboard { paths: string[]; mode: 'copy' | 'cut' }
let _clipboard: Clipboard | null = null
const _clipListeners: Set<() => void> = new Set()
function setClipboard(c: Clipboard | null) {
  _clipboard = c
  _clipListeners.forEach(fn => fn())
}
function useClipboard() {
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    const fn = () => forceUpdate(n => n + 1)
    _clipListeners.add(fn)
    return () => { _clipListeners.delete(fn) }
  }, [])
  return _clipboard
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
  workspaceRoot: string
  creatingIn: CreatingIn
  setCreatingIn: (c: CreatingIn) => void
}

function TreeItem({
  node, depth, selectedPath, onSelect, onOpen, onRefresh,
  onStartCreate, workspaceRoot, creatingIn, setCreatingIn,
}: TreeItemProps) {
  const [expanded,  setExpanded]  = useState(depth === 0)
  const [children,  setChildren]  = useState<TreeNode[]>([])
  const [renaming,  setRenaming]  = useState(false)
  const [ctx,       setCtx]       = useState<{ x: number; y: number } | null>(null)
  const [dragOver,  setDragOver]  = useState(false)
  const [dragging,  setDragging]  = useState(false)

  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clipboard  = useClipboard()

  const { gitFiles, openFiles, activeFileIndex, renameOpenFile, closeFile, addTerminalTab } = useStore()

  const gitStatus    = gitFiles.find(g => node.path.endsWith(g.path) || normPath(node.path) === normPath(g.path))
  const isActiveFile = !node.isDir && openFiles[activeFileIndex]?.path === node.path
  const isSelected   = selectedPath === node.path
  const isCut        = clipboard?.mode === 'cut' && clipboard.paths.includes(node.path)

  const gitColor = gitStatus
    ? gitStatus.status === 'M' ? 'var(--git-modified)'
    : gitStatus.status === 'A' ? 'var(--git-added)'
    : 'var(--git-deleted)'
    : undefined

  const loadChildren = useCallback(async () => {
    if (!node.isDir || !window.api) return
    const res = await window.api.readDir(node.path)
    if (res.ok) {
      const sorted = res.entries.sort((a: any, b: any) => {
        if (a.isDir !== b.isDir) return b.isDir ? 1 : -1
        return a.name.localeCompare(b.name)
      })
      setChildren(sorted.map((e: any) => ({ name: e.name, path: normPath(e.path), isDir: e.isDir })))
    }
  }, [node.path, node.isDir])

  useEffect(() => { if (expanded && node.isDir) loadChildren() }, [expanded])

  const handleChildRefresh = useCallback(async () => { await loadChildren(); onRefresh() }, [loadChildren, onRefresh])

  const toggle = async () => {
    if (!node.isDir) { onOpen(node); return }
    if (!expanded) await loadChildren()
    setExpanded(e => !e)
  }

  // Slow double-click rename
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(node.path)
    if (clickTimer.current) {
      clearTimeout(clickTimer.current); clickTimer.current = null
      setRenaming(true); return
    }
    clickTimer.current = setTimeout(() => { clickTimer.current = null; toggle() }, 300)
  }

  const handleCtxMenu = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    onSelect(node.path); setCtx({ x: e.clientX, y: e.clientY })
  }

  // ── Rename (Bug 1 fix: cross-platform path construction) ──────────────────
  const handleRenameConfirm = async (newName: string) => {
    const finalName = newName.endsWith('/') ? newName.slice(0, -1) : newName
    if (!finalName || finalName === node.name) { setRenaming(false); return }

    // Use cross-platform pathDirname/pathJoin — NEVER lastIndexOf('/')
    const parentDir = pathDirname(node.path)
    const newPath   = pathJoin(parentDir, finalName)

    const res = await window.api.rename(node.path, newPath)
    if (res.ok) {
      renameOpenFile(node.path, newPath, finalName)
      showToast(`✅ Renamed: ${node.name} → ${finalName}`)
      setRenaming(false); onRefresh()
    } else {
      showToast(`❌ ${res.message || res.error}`, 'err')
      setRenaming(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm(`Delete '${node.name}'?\nThis cannot be undone.`)) return
    const tabIdx = openFiles.findIndex(f => normPath(f.path) === normPath(node.path) || normPath(f.path).startsWith(normPath(node.path) + '/'))
    if (tabIdx >= 0) closeFile(tabIdx)
    const res = await window.api.deleteItem(node.path)
    if (res.ok) { showToast(`🗑️ Deleted: ${node.name}`); onRefresh() }
    else showToast(`❌ ${res.message || res.error}`, 'err')
  }

  // ── Copy / Cut / Paste (Bug 2 fix) ───────────────────────────────────────
  const handleCopy = () => setClipboard({ paths: [node.path], mode: 'copy' })
  const handleCut  = () => setClipboard({ paths: [node.path], mode: 'cut'  })

  const handlePaste = async () => {
    if (!clipboard || !node.isDir) return
    const targetDir = node.path

    for (const srcPath of clipboard.paths) {
      const srcName = pathBasename(srcPath)
      let destPath = await resolveNameConflict(pathJoin(targetDir, srcName))

      if (clipboard.mode === 'copy') {
        const res = await window.api.copy(srcPath, destPath)
        if (res.ok) showToast(`✅ Copied: ${srcName}`)
        else { showToast(`❌ Copy failed: ${res.message || res.error}`, 'err'); continue }
      } else {
        const res = await window.api.rename(srcPath, destPath)
        if (res.ok) {
          renameOpenFile(srcPath, destPath, pathBasename(destPath))
          showToast(`✅ Moved: ${srcName}`)
        } else { showToast(`❌ Move failed: ${res.message || res.error}`, 'err'); continue }
      }
    }

    if (clipboard.mode === 'cut') setClipboard(null)  // paste once for cut
    await loadChildren()
    setExpanded(true)
    onRefresh()
  }

  const copyAbsPath = () => navigator.clipboard.writeText(node.path)
  const copyRelPath = () => {
    const rel = normPath(node.path).startsWith(normPath(workspaceRoot))
      ? normPath(node.path).slice(normPath(workspaceRoot).length).replace(/^\//, '')
      : node.path
    navigator.clipboard.writeText(rel)
  }

  const openInTerminal = () => {
    const dir = node.isDir ? node.path : pathDirname(node.path)
    addTerminalTab(dir)
  }

  // ── Drag and Drop (Bug 3 fix) ─────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.setData('text/plain', node.path)
    e.dataTransfer.effectAllowed = 'move'
    setDragging(true)
  }

  const handleDragEnd = () => setDragging(false)

  const handleDragOver = (e: React.DragEvent) => {
    if (!node.isDir) { e.preventDefault(); return }
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  const handleDragEnter = (e: React.DragEvent) => {
    if (!node.isDir) return
    e.preventDefault(); e.stopPropagation()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation()
    setDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    setDragOver(false)
    const srcPath = e.dataTransfer.getData('text/plain')
    if (!srcPath) return

    const targetDir = node.isDir ? node.path : pathDirname(node.path)

    // Prevent drop onto itself or own subfolder
    if (pathStartsWith(targetDir, srcPath)) {
      showToast('❌ Cannot move a folder into itself', 'err'); return
    }
    // Prevent drop into same location
    if (normPath(pathDirname(srcPath)) === normPath(targetDir)) return

    const srcName = pathBasename(srcPath)
    const rawDest = pathJoin(targetDir, srcName)
    const destPath = await resolveNameConflict(rawDest)

    const res = await window.api.rename(srcPath, destPath)
    if (res.ok) {
      renameOpenFile(srcPath, destPath, pathBasename(destPath))
      showToast(`✅ Moved: ${srcName} → ${pathBasename(targetDir)}/`)
      if (!expanded) { await loadChildren(); setExpanded(true) }
      else await loadChildren()
      onRefresh()
    } else {
      showToast(`❌ Move failed: ${res.message || res.error}`, 'err')
    }
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
    { icon: '✏️',  label: 'Rename', shortcut: 'F2',  action: () => setRenaming(true) },
    { icon: '🗑️', label: 'Delete', shortcut: 'Del', danger: true, action: handleDelete },
    { separator: true },
    { icon: '📂', label: 'Open in Terminal',   action: openInTerminal },
    { icon: '📁', label: 'Reveal in Explorer', action: () => window.api.revealInExplorer(node.path) },
  ] : [
    { icon: '📋', label: 'Copy', action: handleCopy },
    { icon: '✂️',  label: 'Cut',  action: handleCut  },
    { separator: true },
    { icon: '✏️',  label: 'Rename', shortcut: 'F2',  action: () => setRenaming(true) },
    { icon: '🗑️', label: 'Delete', shortcut: 'Del', danger: true, action: handleDelete },
    { separator: true },
    { icon: '📋', label: 'Copy Path',          action: copyAbsPath },
    { icon: '📋', label: 'Copy Relative Path', action: copyRelPath },
    { icon: '📂', label: 'Open Containing Folder in Terminal', action: openInTerminal },
    { icon: '📁', label: 'Reveal in Explorer', action: () => window.api.revealInExplorer(node.path) },
  ]

  const siblingNames = children.map(c => c.name)

  const handleRowKey = (e: React.KeyboardEvent) => {
    if (e.key === 'F2')     { e.preventDefault(); setRenaming(true) }
    if (e.key === 'Delete') { e.preventDefault(); handleDelete() }
  }

  return (
    <div>
      {/* Row */}
      {renaming ? (
        <InlineInput
          depth={depth} isDir={node.isDir} initialValue={node.name}
          onConfirm={handleRenameConfirm} onCancel={() => setRenaming(false)}
          existingNames={[]}
        />
      ) : (
        <div
          className={[
            'tree-item',
            (isActiveFile || isSelected) ? 'active' : '',
            dragOver  ? 'drag-over'  : '',
            dragging  ? 'dragging'   : '',
            isCut     ? 'cut-item'   : '',
          ].join(' ').trim()}
          style={{ paddingLeft: depth * 12 + 8 }}
          onClick={handleClick}
          onContextMenu={handleCtxMenu}
          onKeyDown={handleRowKey}
          tabIndex={0}
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
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

      {/* Inline creation inside folder */}
      {node.isDir && expanded && creatingIn?.parentPath === node.path && (
        <InlineInput
          depth={creatingIn.depth} isDir={creatingIn.isDir}
          onConfirm={async (name) => {
            const isFolder  = creatingIn.isDir || name.endsWith('/')
            const finalName = name.endsWith('/') ? name.slice(0, -1) : name
            const fullPath  = pathJoin(node.path, finalName)
            const res       = isFolder ? await window.api.createDir(fullPath) : await window.api.createFile(fullPath)
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
            } else showToast(`❌ ${res.message || res.error}`, 'err')
          }}
          onCancel={() => setCreatingIn(null)}
          existingNames={siblingNames}
        />
      )}

      {/* Children */}
      {node.isDir && expanded && children.map(child => (
        <TreeItem
          key={child.path} node={child} depth={depth + 1}
          selectedPath={selectedPath} onSelect={onSelect}
          onOpen={onOpen} onRefresh={handleChildRefresh}
          onStartCreate={onStartCreate}
          workspaceRoot={workspaceRoot}
          creatingIn={creatingIn} setCreatingIn={setCreatingIn}
        />
      ))}

      {ctx && <ContextMenu x={ctx.x} y={ctx.y} items={ctxItems} onClose={() => setCtx(null)} />}
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
  const panelRef = useRef<HTMLDivElement>(null)

  const loadRoot = useCallback(async () => {
    if (!folderPath || !window.api) return
    const res = await window.api.readDir(folderPath)
    if (res.ok) {
      const sorted = res.entries.sort((a: any, b: any) => {
        if (a.isDir !== b.isDir) return b.isDir ? 1 : -1
        return a.name.localeCompare(b.name)
      })
      setRootChildren(sorted.map((e: any) => ({ name: e.name, path: normPath(e.path), isDir: e.isDir })))
    }
    loadGitStatus()
  }, [folderPath])

  useEffect(() => { loadRoot() }, [loadRoot, refreshKey])

  const handleFileOpen = async (node: TreeNode) => {
    if (!window.api) return
    let res: { ok: boolean; content: string; error?: string }
    try {
      res = await window.api.readFile(node.path)
    } catch (e: any) {
      console.error('[FilesPanel] readFile IPC error:', e)
      return
    }
    if (res.ok) {
      openFile({
        path: node.path, name: node.name, content: res.content,
        language: getLanguage(node.name), isDirty: false,
        cursorLine: 1, cursorCol: 1, scrollTop: 0,
      })
    } else {
      console.error('[FilesPanel] readFile failed:', res.error, 'path:', node.path)
    }
  }

  const getCreateContext = (): { parentPath: string; depth: number } => {
    if (!folderPath) return { parentPath: '', depth: 0 }
    if (!selectedPath) return { parentPath: normPath(folderPath), depth: 0 }
    const isDir = rootChildren.some(c => normPath(c.path) === normPath(selectedPath) && c.isDir)
    if (isDir) return { parentPath: normPath(selectedPath), depth: 1 }
    return { parentPath: pathDirname(normPath(selectedPath)) || normPath(folderPath), depth: 1 }
  }

  const startCreate = (isDir: boolean) => {
    const { parentPath, depth } = getCreateContext()
    if (parentPath) setCreatingIn({ parentPath, isDir, depth })
  }

  const rootSiblingNames = rootChildren.map(c => c.name)

  // Global Ctrl+C/X/V keyboard shortcuts at panel level
  const handlePanelKey = (e: React.KeyboardEvent) => {
    const ctrl = e.ctrlKey || e.metaKey
    if (!selectedPath) return
    if (ctrl && e.key === 'c' && !e.shiftKey) { e.preventDefault(); setClipboard({ paths: [selectedPath], mode: 'copy' }) }
    if (ctrl && e.key === 'x') { e.preventDefault(); setClipboard({ paths: [selectedPath], mode: 'cut'  }) }
    if (e.altKey && !e.shiftKey && e.key === 'n') { e.preventDefault(); startCreate(false) }
    if (e.altKey &&  e.shiftKey && e.key === 'N') { e.preventDefault(); startCreate(true) }
  }

  const normRoot = folderPath ? normPath(folderPath) : ''

  return (
    <div className="files-panel" ref={panelRef} tabIndex={-1} onKeyDown={handlePanelKey}>
      <div className="panel-header">
        <span>Explorer</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="icon-btn" onClick={() => startCreate(false)} title="New File (Alt+N)"><FilePlus size={14} /></button>
          <button className="icon-btn" onClick={() => startCreate(true)}  title="New Folder (Alt+Shift+N)"><FolderPlus size={14} /></button>
          <button className="icon-btn" onClick={() => setRefreshKey(k => k + 1)} title="Refresh"><RefreshCw size={14} /></button>
          <button className="icon-btn" onClick={() => setRefreshKey(k => k + 1)} title="Collapse All"><ChevronsUpDown size={14} /></button>
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
              {normPath(folderPath).split('/').pop() || folderPath}
            </div>

            {/* Root-level inline creation */}
            {creatingIn && creatingIn.parentPath === normRoot && (
              <InlineInput
                depth={0} isDir={creatingIn.isDir}
                onConfirm={async (name) => {
                  const isFolder  = creatingIn.isDir || name.endsWith('/')
                  const finalName = name.endsWith('/') ? name.slice(0, -1) : name
                  const fullPath  = pathJoin(normRoot, finalName)
                  const res       = isFolder ? await window.api.createDir(fullPath) : await window.api.createFile(fullPath)
                  if (res.ok) {
                    showToast(`✅ Created: ${finalName}`)
                    setCreatingIn(null); setRefreshKey(k => k + 1)
                    if (!isFolder) {
                      const content = await window.api.readFile(fullPath)
                      openFile({
                        path: fullPath, name: finalName,
                        content: content.ok ? content.content : '',
                        language: getLanguage(finalName),
                        isDirty: false, cursorLine: 1, cursorCol: 1, scrollTop: 0,
                      })
                    }
                  } else showToast(`❌ ${res.message || res.error}`, 'err')
                }}
                onCancel={() => setCreatingIn(null)}
                existingNames={rootSiblingNames}
              />
            )}

            {rootChildren.map(node => (
              <TreeItem
                key={node.path} node={node} depth={0}
                selectedPath={selectedPath} onSelect={setSelectedPath}
                onOpen={handleFileOpen} onRefresh={() => setRefreshKey(k => k + 1)}
                onStartCreate={(p, d, dep) => setCreatingIn({ parentPath: p, isDir: d, depth: dep })}
                workspaceRoot={normRoot}
                creatingIn={creatingIn} setCreatingIn={setCreatingIn}
              />
            ))}
          </div>
        )}
      </div>
      <Toast />
    </div>
  )
}