import { useState, useEffect, useCallback } from 'react'
import {
  FolderOpen, FolderClosed, File, FileCode, FileText, ChevronRight, ChevronDown,
  Plus, FilePlus, FolderPlus, RefreshCw, Pencil, Trash2
} from 'lucide-react'
import { useStore, OpenFile } from '../../stores/appStore'
import './FilesPanel.css'

interface TreeNode {
  name: string; path: string; isDir: boolean
  children?: TreeNode[]; expanded?: boolean
}

function getLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', rs: 'rust', go: 'go', java: 'java', cpp: 'cpp', c: 'c',
    html: 'html', css: 'css', scss: 'scss', json: 'json', yaml: 'yaml',
    yml: 'yaml', md: 'markdown', sh: 'shell', toml: 'toml', sql: 'sql',
    dart: 'dart', swift: 'swift', kt: 'kotlin', rb: 'ruby', php: 'php',
  }
  return map[ext] || 'plaintext'
}

function FileIcon({ name, isDir, expanded }: { name: string; isDir: boolean; expanded?: boolean }) {
  if (isDir) return expanded ? <FolderOpen size={14} className="fi-dir" /> : <FolderClosed size={14} className="fi-dir" />
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['ts','tsx','js','jsx','py','rs','dart'].includes(ext)) return <FileCode size={14} className="fi-code" />
  if (['md','txt','csv'].includes(ext)) return <FileText size={14} className="fi-text" />
  return <File size={14} className="fi-file" />
}

function TreeItem({
  node, depth, onOpen, onRefresh
}: {
  node: TreeNode; depth: number; onOpen: (n: TreeNode) => void; onRefresh: () => void
}) {
  const [expanded, setExpanded] = useState(depth === 0)
  const [children, setChildren] = useState<TreeNode[]>([])
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(node.name)
  const [showCtx, setShowCtx] = useState(false)
  const { gitFiles, openFiles, activeFileIndex } = useStore()

  const gitStatus = gitFiles.find(g => g.path === node.path || node.path.endsWith(g.path))
  const isActiveFile = !node.isDir && openFiles[activeFileIndex]?.path === node.path

  const loadChildren = async () => {
    if (!node.isDir || !window.api) return
    const res = await window.api.readDir(node.path)
    if (res.ok) {
      const sorted = res.entries.sort((a: any, b: any) => {
        if (a.isDir !== b.isDir) return b.isDir ? 1 : -1
        return a.name.localeCompare(b.name)
      })
      setChildren(sorted.map((e: any) => ({ name: e.name, path: e.path, isDir: e.isDir })))
    }
  }

  const toggle = async () => {
    if (!node.isDir) { onOpen(node); return }
    if (!expanded) await loadChildren()
    setExpanded(!expanded)
  }

  const handleDelete = async () => {
    if (!window.api) return
    if (confirm(`Delete "${node.name}"?`)) {
      await window.api.deleteItem(node.path)
      onRefresh()
    }
  }

  const handleRename = async () => {
    if (!window.api || newName === node.name) { setRenaming(false); return }
    const newPath = node.path.replace(node.name, newName)
    await window.api.rename(node.path, newPath)
    setRenaming(false)
    onRefresh()
  }

  const gitColor = gitStatus
    ? gitStatus.status === 'M' ? 'var(--git-modified)'
    : gitStatus.status === 'A' ? 'var(--git-added)'
    : gitStatus.status === 'D' ? 'var(--git-deleted)' : 'var(--text-muted)'
    : undefined

  return (
    <div>
      <div
        className={`tree-item ${isActiveFile ? 'active' : ''}`}
        style={{ paddingLeft: depth * 12 + 8 }}
        onClick={toggle}
        onContextMenu={(e) => { e.preventDefault(); setShowCtx(true) }}
      >
        {node.isDir && (
          <span className="tree-arrow">
            {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </span>
        )}
        {!node.isDir && <span style={{ width: 14 }} />}
        <FileIcon name={node.name} isDir={node.isDir} expanded={expanded} />
        {renaming ? (
          <input
            className="tree-rename-input"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
            autoFocus onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="tree-name" style={{ color: gitColor }}>
            {node.name}
          </span>
        )}
        {gitStatus && (
          <span className="git-badge" style={{ color: gitColor }}>
            {gitStatus.status}
          </span>
        )}
      </div>
      {showCtx && (
        <div className="ctx-menu" onMouseLeave={() => setShowCtx(false)}>
          <div className="ctx-item" onClick={() => { setRenaming(true); setShowCtx(false) }}>
            <Pencil size={12} /> Rename
          </div>
          <div className="ctx-item danger" onClick={() => { handleDelete(); setShowCtx(false) }}>
            <Trash2 size={12} /> Delete
          </div>
        </div>
      )}
      {node.isDir && expanded && children.map(child => (
        <TreeItem key={child.path} node={child} depth={depth + 1} onOpen={onOpen} onRefresh={() => { loadChildren(); onRefresh() }} />
      ))}
    </div>
  )
}

export default function FilesPanel() {
  const { folderPath, setFolderPath, openFile, loadGitStatus } = useStore()
  const [rootChildren, setRootChildren] = useState<TreeNode[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

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

  const handleOpenFolder = async () => {
    if (!window.api) return
    const p = await window.api.openFolder()
    if (p) setFolderPath(p)
  }

  const handleFileOpen = async (node: TreeNode) => {
    if (!window.api) return
    const res = await window.api.readFile(node.path)
    if (res.ok) {
      const file: OpenFile = {
        path: node.path, name: node.name, content: res.content,
        language: getLanguage(node.name), isDirty: false,
        cursorLine: 1, cursorCol: 1, scrollTop: 0
      }
      openFile(file)
    }
  }

  const handleNewFile = async () => {
    if (!folderPath || !window.api) return
    const name = prompt('File name:')
    if (!name) return
    await window.api.createFile(`${folderPath}/${name}`)
    setRefreshKey(k => k + 1)
  }

  const handleNewFolder = async () => {
    if (!folderPath || !window.api) return
    const name = prompt('Folder name:')
    if (!name) return
    await window.api.createDir(`${folderPath}/${name}`)
    setRefreshKey(k => k + 1)
  }

  return (
    <div className="files-panel">
      <div className="panel-header">
        <span>Explorer</span>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="icon-btn" onClick={handleNewFile} title="New File"><FilePlus size={14} /></button>
          <button className="icon-btn" onClick={handleNewFolder} title="New Folder"><FolderPlus size={14} /></button>
          <button className="icon-btn" onClick={() => setRefreshKey(k => k + 1)} title="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>
      <div className="files-content">
        {!folderPath ? (
          <div className="empty-state">
            <FolderOpen size={32} style={{ color: 'var(--text-dim)' }} />
            <p>No folder open</p>
            <button className="btn btn-primary" onClick={handleOpenFolder}>
              Open Folder
            </button>
          </div>
        ) : (
          <div className="tree-root">
            <div className="tree-folder-name">
              {folderPath.split('/').pop() || folderPath.split('\\').pop()}
            </div>
            {rootChildren.map(node => (
              <TreeItem
                key={node.path} node={node} depth={0}
                onOpen={handleFileOpen}
                onRefresh={() => setRefreshKey(k => k + 1)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
