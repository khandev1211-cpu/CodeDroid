import { useHistoryStore, Checkpoint } from '../../stores/historyStore'
import { useStore } from '../../stores/appStore'
import { X, Clock, Map, Bot, MessageSquare, RotateCcw, Download, Trash2 } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function HistoryPanel({ onClose }: Props) {
  const { checkpoints, exportHistory, revertToCheckpoint } = useHistoryStore()
  const { clearAiMessages, addAiMessage, updateSettings } = useStore()

  const handleRevert = (cp: Checkpoint) => {
    if (confirm('Revert conversation to this state? Current messages after this point will be lost.')) {
      // Revert logic:
      // 1. Clear current messages
      // 2. Load messages from history leading up to this point
      // (Simplified for this demo: we just load this one pair)
      clearAiMessages()
      addAiMessage({
        role: 'user', content: cp.userMessage,
        provider: cp.provider as any, mode: cp.mode
      })
      addAiMessage({
        role: 'assistant', content: cp.aiResponse,
        provider: cp.provider as any, mode: cp.mode,
        appliedSkills: cp.skillsApplied,
        agentSteps: cp.agentSteps,
        planSteps: cp.planSteps
      })
      updateSettings({ activeMode: cp.mode, activeProvider: cp.provider as any })
      onClose()
    }
  }

  return (
    <div className="history-drawer">
      <div className="drawer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} />
          <span>History</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="icon-btn" onClick={exportHistory} title="Export History"><Download size={14} /></button>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
      </div>

      <div className="drawer-content">
        {checkpoints.length === 0 ? (
          <div className="empty-state">
            <Clock size={32} style={{ opacity: 0.2 }} />
            <p>No history yet</p>
          </div>
        ) : (
          <div className="history-list">
            {checkpoints.map(cp => (
              <div key={cp.id} className="history-card">
                <div className="card-top">
                  <span className="timestamp">{new Date(cp.timestamp).toLocaleTimeString()}</span>
                  <div className="badges">
                    {cp.mode === 'plan' && <span className="mode-badge plan"><Map size={10}/></span>}
                    {cp.mode === 'agent' && <span className="mode-badge agent"><Bot size={10}/></span>}
                    {cp.mode === 'ask' && <span className="mode-badge ask"><MessageSquare size={10}/></span>}
                  </div>
                </div>
                <div className="card-prompt">{cp.userMessage.slice(0, 60)}{cp.userMessage.length > 60 ? '...' : ''}</div>
                <div className="card-footer">
                  <span className="model-info">{cp.provider} · {cp.model.split('/').pop()}</span>
                  <button className="revert-btn" onClick={() => handleRevert(cp)}>
                    <RotateCcw size={12} /> Revert
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
