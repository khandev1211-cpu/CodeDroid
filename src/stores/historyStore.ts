import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ChatMode, AiProvider, AiMessage, AgentStep, PlanStep } from './appStore'

export interface Checkpoint {
  id: string
  timestamp: number
  mode: ChatMode
  userMessage: string
  aiResponse: string
  skillsApplied: string[]
  agentSteps?: AgentStep[]
  planSteps?: PlanStep[]
  codeArtifacts?: { filename: string, content: string }[]
  provider: AiProvider
  model: string
}

interface HistoryStore {
  checkpoints: Checkpoint[]
  addCheckpoint: (cp: Checkpoint) => void
  loadHistory: () => Promise<void>
  exportHistory: () => void
  revertToCheckpoint: (id: string) => void
}

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
      checkpoints: [],

      addCheckpoint: (cp) => {
        set((s) => ({ checkpoints: [cp, ...s.checkpoints] }))
        // Save to disk via IPC
        if (window.api && window.api.saveHistory) {
          window.api.saveHistory(get().checkpoints)
        }
      },

      loadHistory: async () => {
        if (window.api && window.api.loadHistory) {
          const history = await window.api.loadHistory()
          if (history) set({ checkpoints: history })
        }
      },

      exportHistory: () => {
        const data = JSON.stringify(get().checkpoints, null, 2)
        const blob = new Blob([data], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `codedroid-history-${Date.now()}.json`
        a.click()
      },

      revertToCheckpoint: (id) => {
        // Logic to revert app state will be handled in the component
        // by reading this checkpoint and updating appStore
      }
    }),
    {
      name: 'codedroid-history'
    }
  )
)
