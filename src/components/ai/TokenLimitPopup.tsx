/**
 * TokenLimitPopup.tsx
 * Shown when AI response is truncated mid-generation.
 * Ask/Plan mode: shows Continue/Stop popup.
 * Agent mode: auto-continues silently.
 */
import './TokenLimitPopup.css'

interface TokenLimitPopupProps {
  truncatedContent: string
  onContinue: () => void
  onStop: () => void
}

export default function TokenLimitPopup({ truncatedContent, onContinue, onStop }: TokenLimitPopupProps) {
  const preview = truncatedContent.slice(-120).replace(/\n/g, ' ').trim()

  return (
    <div className="token-limit-popup">
      <div className="tlp-icon">⚠️</div>
      <div className="tlp-title">Response Limit Reached</div>
      <div className="tlp-body">
        The AI reached its output limit mid-response. The content may be incomplete.
      </div>

      {preview && (
        <div className="tlp-preview">
          Last output: "…{preview}"
        </div>
      )}

      <div className="tlp-actions">
        <button className="btn btn-primary tlp-btn" onClick={onContinue}>
          ▶ Continue from here
        </button>
        <button className="btn btn-ghost tlp-btn" onClick={onStop}>
          ✋ Stop — I have enough
        </button>
      </div>

      <div className="tlp-hint">
        💡 Tip: Switch to a model with higher token limits for long tasks
        (Claude, GPT-oss-120b, Groq Dev tier).
      </div>
    </div>
  )
}