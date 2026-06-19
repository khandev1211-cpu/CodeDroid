/**
 * ThinkingBlock.tsx
 * Collapsible reasoning block shown above the AI's final answer.
 * Appears when the AI uses extended thinking / chain-of-thought.
 */
import { useState } from 'react'
import './ThinkingBlock.css'

interface ThinkingBlockProps {
  thinking: string
  isStreaming?: boolean
}

export default function ThinkingBlock({ thinking, isStreaming }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false)
  const wordCount = thinking.trim().split(/\s+/).length

  return (
    <div className="thinking-block">
      <button className="thinking-header" onClick={() => setExpanded(e => !e)}>
        <span className="thinking-icon">🧠</span>
        <span className="thinking-label">
          {isStreaming ? 'Thinking…' : 'Reasoning'}
        </span>
        {isStreaming && <span className="thinking-spinner">⟳</span>}
        {!isStreaming && (
          <span className="thinking-wordcount">{wordCount} words</span>
        )}
        <span className="thinking-chevron">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="thinking-content">
          <pre className="thinking-text">{thinking}</pre>
        </div>
      )}
    </div>
  )
}