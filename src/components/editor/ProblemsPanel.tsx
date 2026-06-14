/**
 * ProblemsPanel.tsx
 * VS Code-style Problems panel listing all current inline errors.
 * Shown below the editor when there are active agent-detected errors.
 */
import { AlertTriangle, X, ChevronRight } from 'lucide-react'
import { useStore, InlineError } from '../../stores/appStore'
import './ProblemsPanel.css'

export default function ProblemsPanel() {
  const { inlineErrors, clearInlineErrors, openFiles, activeFileIndex } = useStore()

  if (!inlineErrors.length) return null

  // Group by file
  const byFile: Record<string, InlineError[]> = {}
  for (const err of inlineErrors) {
    const key = err.file || 'unknown'
    if (!byFile[key]) byFile[key] = []
    byFile[key].push(err)
  }

  const goToLine = (err: InlineError) => {
    // Dispatch a custom event that EditorArea listens to for navigation
    window.dispatchEvent(new CustomEvent('codedroid-goto-line', {
      detail: { file: err.file, line: err.line, column: err.column ?? 1 },
    }))
  }

  const totalCount = inlineErrors.length

  return (
    <div className="problems-panel">
      <div className="problems-header">
        <AlertTriangle size={12} className="problems-icon" />
        <span className="problems-title">Problems</span>
        <span className="problems-count">{totalCount} error{totalCount !== 1 ? 's' : ''}</span>
        <button className="icon-btn problems-clear" onClick={clearInlineErrors} title="Clear all errors">
          <X size={12} />
        </button>
      </div>

      <div className="problems-list">
        {Object.entries(byFile).map(([file, errors]) => (
          <div key={file} className="problems-file-group">
            <div className="problems-file-row">
              <ChevronRight size={10} />
              <span className="problems-file-name">{file.split('/').pop() || file}</span>
              <span className="problems-file-path">{file}</span>
              <span className="problems-badge">{errors.length}</span>
            </div>
            {errors.map((err, i) => (
              <div
                key={i}
                className="problems-item"
                onClick={() => goToLine(err)}
                title={`${err.errorType}: ${err.message}`}
              >
                <span className="problems-err-icon">●</span>
                <span className="problems-msg">{err.message}</span>
                <span className="problems-loc">
                  [{err.errorType}] Ln {err.line}{err.column ? `, Col ${err.column}` : ''}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}