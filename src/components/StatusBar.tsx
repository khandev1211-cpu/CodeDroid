import { GitBranch, AlertCircle, CheckCircle2, Loader2, Wifi, WifiOff } from 'lucide-react'
import { useStore } from '../stores/appStore'
import './StatusBar.css'

export default function StatusBar() {
  const {
    openFiles, activeFileIndex, gitBranch, gitFiles,
    aiLoading, settings, updateSettings, setActivePanel
  } = useStore()

  const file = openFiles[activeFileIndex]
  const modifiedCount = gitFiles.filter(f => !f.staged).length
  const stagedCount = gitFiles.filter(f => f.staged).length

  return (
    <div className="status-bar">
      {/* Left */}
      <div className="status-left">
        <button
          className="status-item status-btn"
          onClick={() => setActivePanel('git')}
          title="Git branch"
        >
          <GitBranch size={11} />
          <span>{gitBranch}</span>
          {(modifiedCount > 0 || stagedCount > 0) && (
            <span className="status-git-counts">
              {stagedCount > 0 && <span style={{ color: 'var(--git-added)' }}>+{stagedCount}</span>}
              {modifiedCount > 0 && <span style={{ color: 'var(--git-modified)' }}>~{modifiedCount}</span>}
            </span>
          )}
        </button>

        {file?.isDirty && (
          <span className="status-item" style={{ color: 'var(--git-modified)' }}>
            ● Unsaved
          </span>
        )}
      </div>

      {/* Center */}
      <div className="status-center">
        {aiLoading && (
          <span className="status-item" style={{ color: 'var(--accent)' }}>
            <Loader2 size={10} className="spin" /> AI thinking...
          </span>
        )}
      </div>

      {/* Right */}
      <div className="status-right">
        {file && (
          <>
            <span className="status-item">{file.language}</span>
            <span className="status-divider" />
            <span className="status-item">
              Ln {file.cursorLine}, Col {file.cursorCol}
            </span>
            <span className="status-divider" />
            <span className="status-item">UTF-8</span>
          </>
        )}
        <span className="status-divider" />
        <button
          className="status-item status-btn"
          onClick={() => updateSettings({ showAiPanel: !settings.showAiPanel })}
          title="Toggle AI Panel"
          style={{ color: settings.showAiPanel ? 'var(--accent)' : undefined }}
        >
          AI
        </button>
        <span className="status-divider" />
        <span className="status-item" style={{ fontSize: 10 }}>
          CodeDroid v3
        </span>
      </div>
    </div>
  )
}
