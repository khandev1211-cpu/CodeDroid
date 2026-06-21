import { useStore, ChatMode } from '../../stores/appStore'
import { Bot, MessageSquare, Map as MapIcon } from 'lucide-react'

export default function ChatModeSelector() {
  const { settings, updateSettings } = useStore()
  const activeMode = settings.activeMode || 'ask'

  const modes: { id: ChatMode; name: string; icon: any; label: string }[] = [
    { id: 'plan', name: 'Plan', icon: MapIcon, label: '🗺️ Plan' },
    { id: 'agent', name: 'Agent', icon: Bot, label: '🤖 Agent' },
    { id: 'ask', name: 'Ask', icon: MessageSquare, label: '💬 Ask' },
  ]

  const setMode = (mode: ChatMode) => {
    updateSettings({ activeMode: mode })
  }

  return (
    <div className="chat-mode-selector">
      {modes.map((m) => (
        <button
          key={m.id}
          className={`mode-btn ${activeMode === m.id ? 'active' : ''}`}
          onClick={() => setMode(m.id)}
          title={`Switch to ${m.name} mode`}
        >
          <m.icon size={14} />
          <span>{m.name}</span>
        </button>
      ))}
    </div>
  )
}