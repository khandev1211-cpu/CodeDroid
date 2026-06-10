import { useEffect, useState } from 'react'
import { GitBranch, RefreshCw, Plus, Minus, Upload, Download, Archive, History } from 'lucide-react'
import { useStore } from '../../stores/appStore'

export default function GitPanel() {
  const {
    gitFiles, gitBranch, gitLog, commitMessage, setCommitMessage,
    loadGitStatus, stageFile, unstageFile, commitChanges, gitPush, gitPull, folderPath
  } = useStore()
  const [activeTab, setActiveTab] = useState<'changes' | 'history'>('changes')
  const [diff, setDiff] = useState('')
  const [diffFile, setDiffFile] = useState('')

  useEffect(() => { if (folderPath) loadGitStatus() }, [folderPath])

  const staged = gitFiles.filter(f => f.staged)
  const unstaged = gitFiles.filter(f => !f.staged)

  const loadDiff = async (path: string) => {
    if (!window.api || !folderPath) return
    const res = await window.api.gitRun(folderPath, ['diff', path])
    setDiff(res.stdout || '(no diff)')
    setDiffFile(path.split('/').pop() || path)
  }

  const statusColor = (s: string) =>
    s === 'M' ? 'var(--git-modified)' : s === 'A' ? 'var(--git-added)' : s === 'D' ? 'var(--git-deleted)' : 'var(--text-muted)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GitBranch size={13} />
          <span>{gitBranch}</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="icon-btn" onClick={loadGitStatus} title="Refresh"><RefreshCw size={13} /></button>
          <button className="icon-btn" onClick={gitPull} title="Pull"><Download size={13} /></button>
          <button className="icon-btn" onClick={gitPush} title="Push"><Upload size={13} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)' }}>
        {(['changes', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: '6px', border: 'none', background: activeTab === tab ? 'var(--bg-active)' : 'transparent',
              color: activeTab === tab ? 'var(--text)' : 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              borderBottom: activeTab === tab ? `1px solid var(--accent)` : '1px solid transparent' }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'changes' ? (
          <>
            {/* Commit input */}
            <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-light)' }}>
              <textarea
                className="input"
                placeholder="Commit message..."
                value={commitMessage}
                onChange={e => setCommitMessage(e.target.value)}
                rows={2}
                style={{ resize: 'none', lineHeight: 1.4 }}
              />
              <button className="btn btn-primary" onClick={commitChanges}
                style={{ width: '100%', marginTop: 6, justifyContent: 'center' }}
                disabled={!commitMessage.trim()}>
                Commit staged changes
              </button>
            </div>

            {staged.length > 0 && (
              <div>
                <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Staged ({staged.length})
                </div>
                {staged.map(f => (
                  <div key={f.path}
                    style={{ padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                    onClick={() => loadDiff(f.path)}>
                    <span style={{ color: statusColor(f.status), fontWeight: 600, fontSize: 10, minWidth: 12 }}>{f.status}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {f.path.split('/').pop()}
                    </span>
                    <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={e => { e.stopPropagation(); unstageFile(f.path) }} title="Unstage">
                      <Minus size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {unstaged.length > 0 && (
              <div>
                <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Changes ({unstaged.length})
                </div>
                {unstaged.map(f => (
                  <div key={f.path}
                    style={{ padding: '3px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                    onClick={() => loadDiff(f.path)}>
                    <span style={{ color: statusColor(f.status), fontWeight: 600, fontSize: 10, minWidth: 12 }}>{f.status}</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                      {f.path.split('/').pop()}
                    </span>
                    <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={e => { e.stopPropagation(); stageFile(f.path) }} title="Stage">
                      <Plus size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {diff && (
              <div style={{ borderTop: '1px solid var(--border)', padding: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>diff: {diffFile}</div>
                <pre style={{ fontSize: 11, fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  {diff.split('\n').map((line, i) => (
                    <span key={i} style={{
                      display: 'block',
                      color: line.startsWith('+') ? 'var(--git-added)' : line.startsWith('-') ? 'var(--git-deleted)' : undefined,
                      background: line.startsWith('+') ? 'rgba(78,201,176,0.08)' : line.startsWith('-') ? 'rgba(241,76,76,0.08)' : undefined,
                    }}>{line}</span>
                  ))}
                </pre>
              </div>
            )}

            {gitFiles.length === 0 && (
              <div className="empty-state"><Archive size={24} /><p>No changes</p></div>
            )}
          </>
        ) : (
          <div style={{ padding: '4px 0' }}>
            {gitLog.map((entry, i) => {
              const [hash, ...rest] = entry.split(' ')
              return (
                <div key={i} style={{ padding: '5px 10px', fontSize: 12, borderBottom: '1px solid var(--border-light)' }}>
                  <span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: 11 }}>{hash}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>{rest.join(' ')}</span>
                </div>
              )
            })}
            {gitLog.length === 0 && <div className="empty-state"><History size={24} /><p>No commits</p></div>}
          </div>
        )}
      </div>
    </div>
  )
}
