/**
 * PendingChangesPanel.tsx
 * Floating panel inside CodeDroid (not the preview window) summarizing all
 * stacked, unsaved visual edits. Lets the user discard individual edits or
 * save/discard everything at once.
 */
import { useStore } from '../../stores/appStore'
import { getPreviewSocket } from '../editor/PreviewButton'
import './PendingChangesPanel.css'

export default function PendingChangesPanel() {
  const { pendingChanges, previewFilePath, settings, previewActive } = useStore()

  if (!previewActive || pendingChanges.length === 0) return null

  const discardSingle = (index: number) => {
    const ws = getPreviewSocket()
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'discard_single', index }))
  }

  const saveAll = () => {
    const ws = getPreviewSocket()
    if (!ws || ws.readyState !== WebSocket.OPEN || !previewFilePath) return
    const provider = settings.activeProvider
    const apiKey = provider === 'groq' ? settings.groqKey : provider === 'gemini' ? settings.geminiKey : provider === 'claude' ? settings.claudeKey : ''
    const model = provider === 'groq' ? settings.groqModel : provider === 'gemini' ? settings.geminiModel : provider === 'claude' ? settings.claudeModel : settings.ollamaModel
    ws.send(JSON.stringify({
      type: 'save_changes', file_path: previewFilePath,
      provider, api_key: apiKey, model, host: settings.ollamaHost,
    }))
  }

  const discardAll = () => {
    const ws = getPreviewSocket()
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'discard_changes' }))
  }

  return (
    <div className="pending-changes-panel">
      <div className="panel-header">🎯 {pendingChanges.length} Unsaved Visual Edit{pendingChanges.length !== 1 ? 's' : ''}</div>
      <div className="pending-list">
        {pendingChanges.map((c, i) => (
          <div key={i} className="pending-change-item">
            <span className="pending-change-text">
              <code>{c.selector}</code> → {c.action.replace(/_/g, ' ')}: "{String(c.value).slice(0, 40)}"
            </span>
            <button className="pending-change-remove" onClick={() => discardSingle(i)} title="Discard this edit">✕</button>
          </div>
        ))}
      </div>
      <div className="pending-actions">
        <button className="btn-save" onClick={saveAll}>💾 Save All Changes ({pendingChanges.length})</button>
        <button className="btn-discard" onClick={discardAll}>↩ Discard All</button>
      </div>
    </div>
  )
}