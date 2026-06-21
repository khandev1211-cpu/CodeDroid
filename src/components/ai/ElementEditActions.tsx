/**
 * ElementEditActions.tsx
 * Shown inline in chat right after a DOM change has been previewed live.
 * Save writes the change(s) to disk; Discard reloads the page (file untouched).
 */
import { DomChange, ElementData, useStore } from '../../stores/appStore'
import { getPreviewSocket } from '../editor/PreviewButton'
import './ElementEditActions.css'

interface Props {
  change: DomChange
  elementData: ElementData
}

export default function ElementEditActions({ change, elementData }: Props) {
  const { pendingChanges, previewFilePath, settings } = useStore()

  const handleSave = () => {
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

  const handleDiscard = () => {
    const ws = getPreviewSocket()
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ type: 'discard_changes' }))
  }

  const actionLabel = change.action.replace(/_/g, ' ')
  const count = pendingChanges.length || 1

  return (
    <div className="element-edit-actions">
      <div className="edit-summary">
        ✏️ Changed <code>{elementData.tag}</code> {actionLabel} to: "{String(change.value).slice(0, 80)}"
      </div>
      <div className="edit-buttons">
        <button className="btn-save" onClick={handleSave}>
          💾 Save {count > 1 ? `All Changes (${count})` : 'Changes'}
        </button>
        <button className="btn-discard" onClick={handleDiscard}>
          ↩ Discard
        </button>
      </div>
      <div className="edit-hint">
        💡 This change is live in preview only. Click Save to write it to your HTML file.
      </div>
    </div>
  )
}