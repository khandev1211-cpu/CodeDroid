/**
 * PreviewButton.tsx
 * Toolbar control for the Live Preview system. Starts/stops a real
 * Chromium window via the Python sidecar (Playwright), and toggles
 * Edit Mode (click-to-edit visual editing).
 */
import { useState, useRef, useCallback } from 'react'
import { Eye, EyeOff, Target, RotateCw, Loader2 } from 'lucide-react'
import { useStore } from '../../stores/appStore'
import { showToast } from '../sidebar/FilesPanel'
import './PreviewButton.css'

const SIDECAR_WS = 'ws://127.0.0.1:8765/ws/preview'
const SIDECAR_HTTP = 'http://127.0.0.1:8765'

// Module-level WS so it survives component re-renders / can be reused by
// other components (ElementEditChip, PendingChangesPanel) without prop drilling.
let _previewWS: WebSocket | null = null
export function getPreviewSocket() { return _previewWS }

export default function PreviewButton() {
  const {
    openFiles, activeFileIndex, folderPath,
    previewActive, editModeActive,
    setPreviewActive, setEditModeActive, setEditingElement,
    setPendingChanges, addPreviewConsole,
  } = useStore()

  const [starting, setStarting] = useState(false)
  const file = openFiles[activeFileIndex]
  const reconnectRef = useRef(0)

  const isPreviewable = file && /\.(html|htm)$/i.test(file.name)

  const connectSocket = useCallback(() => {
    const ws = new WebSocket(SIDECAR_WS)
    _previewWS = ws

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      const s = useStore.getState()

      switch (data.type) {
        case 'element_clicked':
          s.setEditingElement(data.data)
          break
        case 'edit_applying':
          // no-op marker; AiPanel listens for this to show a loading state in chat if desired
          break
        case 'element_edit_preview':
          window.dispatchEvent(new CustomEvent('codedroid-preview-edit-applied', {
            detail: { change: data.change, element: data.element_data },
          }))
          break
        case 'edit_error':
          showToast(`❌ ${data.message}`, 'err')
          break
        case 'pending_changes':
          s.setPendingChanges(data.changes || [])
          break
        case 'changes_saved':
          showToast(`💾 Saved: ${data.file_path}`)
          s.setEditingElement(null)
          break
        case 'changes_discarded':
          showToast('↩ Changes discarded')
          s.setEditingElement(null)
          break
        case 'console':
          s.addPreviewConsole(data.level, data.text)
          break
        case 'preview_closed':
          showToast('Preview window closed')
          s.setPreviewActive(false)
          s.setEditModeActive(false)
          break
        case 'edit_mode_enabled':
          break
        case 'edit_mode_disabled':
          break
      }
    }

    ws.onclose = () => {
      _previewWS = null
      // Only auto-reconnect while the preview is supposed to still be active
      if (useStore.getState().previewActive && reconnectRef.current < 3) {
        reconnectRef.current++
        setTimeout(connectSocket, 1000)
      }
    }

    ws.onerror = () => { /* onclose will fire next */ }

    return ws
  }, [])

  const handleStartStop = async () => {
    if (previewActive) {
      try { await fetch(`${SIDECAR_HTTP}/preview/stop`, { method: 'POST' }) } catch {}
      _previewWS?.close()
      _previewWS = null
      setPreviewActive(false)
      setEditModeActive(false)
      return
    }

    if (!file || !isPreviewable) {
      showToast('❌ Open an HTML file first — only .html/.htm files can be previewed', 'err')
      return
    }

    setStarting(true)

    // ── Step 1: is the sidecar running at all? ─────────────────────────────
    try {
      await fetch(`${SIDECAR_HTTP}/health`, { method: 'GET' })
    } catch {
      showToast(
        '❌ Sidecar not running.\n' +
        'In a terminal: cd python && uvicorn main:app --host 127.0.0.1 --port 8765',
        'err'
      )
      setStarting(false)
      return
    }

    // ── Step 2: is Playwright installed? ───────────────────────────────────
    try {
      const chk = await fetch(`${SIDECAR_HTTP}/preview/check`, { method: 'GET' })
      const chkData = await chk.json()
      if (!chkData.playwright_available) {
        showToast(
          '❌ Playwright not installed.\n' +
          'Run: pip install playwright && playwright install chromium',
          'err'
        )
        setStarting(false)
        return
      }
    } catch {
      // /preview/check may not exist yet — skip and try starting anyway
    }

    // ── Step 3: start the preview ──────────────────────────────────────────
    try {
      // Fix Windows path: C:\foo\bar.html → file:///C:/foo/bar.html
      const normalized = file.path.replace(/\\/g, '/')
      const fileUrl = normalized.startsWith('/')
        ? `file://${normalized}`
        : `file:///${normalized}`

      const encodedUrl = encodeURI(fileUrl)

      const res = await fetch(`${SIDECAR_HTTP}/preview/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: encodedUrl, workspace: folderPath || '' }),
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => `HTTP ${res.status}`)
        showToast(`❌ Preview start failed: ${txt}`, 'err')
        setStarting(false)
        return
      }

      const data = await res.json()
      if (!data.ok) {
        showToast(`❌ ${data.error || 'Preview failed to open'}`, 'err')
        setStarting(false)
        return
      }

      reconnectRef.current = 0
      connectSocket()
      setPreviewActive(true, data.url, file.path)
      showToast('✅ Preview started')
    } catch (e: any) {
      showToast(`❌ Preview start error: ${e?.message ?? String(e)}`, 'err')
    } finally {
      setStarting(false)
    }
  }

  const handleToggleEditMode = () => {
    const ws = _previewWS
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      showToast('❌ Preview is not connected', 'err')
      return
    }
    const next = !editModeActive
    ws.send(JSON.stringify({ type: next ? 'enable_edit_mode' : 'disable_edit_mode' }))
    setEditModeActive(next)
    if (!next) setEditingElement(null)
  }

  const handleReload = async () => {
    try {
      await fetch(`${SIDECAR_HTTP}/preview/reload`, { method: 'POST' })
    } catch {}
  }

  return (
    <div className="preview-toolbar">
      <button
        className={`preview-btn ${previewActive ? 'active' : ''}`}
        onClick={handleStartStop}
        disabled={starting}
        title={previewActive ? 'Stop Preview' : 'Start Live Preview'}
      >
        {starting ? <Loader2 size={13} className="spin" /> : previewActive ? <EyeOff size={13} /> : <Eye size={13} />}
        {previewActive ? 'Stop Preview' : 'Preview'}
      </button>

      {previewActive && (
        <>
          <button
            className={`edit-mode-toggle ${editModeActive ? 'active' : ''}`}
            onClick={handleToggleEditMode}
            title={editModeActive ? 'Exit Edit Mode' : 'Enable Edit Mode — click elements to edit them live'}
          >
            <Target size={13} />
            {editModeActive ? 'Exit Edit Mode' : 'Edit Mode'}
          </button>
          <button className="icon-btn" onClick={handleReload} title="Reload preview">
            <RotateCw size={13} />
          </button>
        </>
      )}
    </div>
  )
}