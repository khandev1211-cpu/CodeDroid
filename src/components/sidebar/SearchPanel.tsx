import { useState } from 'react'
import { Search, Replace, CaseSensitive, Regex, Loader2, FileCode } from 'lucide-react'
import { useStore } from '../../stores/appStore'

export default function SearchPanel() {
  const {
    searchQuery, setSearchQuery, replaceQuery, setReplaceQuery,
    searchResults, searchLoading, runSearch, replaceAll, openFile
  } = useStore()
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [useRegex, setUseRegex] = useState(false)
  const [showReplace, setShowReplace] = useState(false)

  const handleSearch = () => runSearch({ caseSensitive, useRegex })

  const handleOpenResult = async (filePath: string, line: number) => {
    if (!window.api) return
    const res = await window.api.readFile(filePath)
    if (res.ok) {
      const name = filePath.split('/').pop() || filePath.split('\\').pop() || filePath
      openFile({ path: filePath, name, content: res.content, language: 'plaintext', isDirty: false, cursorLine: line, cursorCol: 1, scrollTop: 0 })
    }
  }

  const byFile = new Map<string, typeof searchResults>()
  for (const r of searchResults) {
    if (!byFile.has(r.filePath)) byFile.set(r.filePath, [])
    byFile.get(r.filePath)!.push(r)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <span>Search</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {searchResults.length > 0 ? `${searchResults.length} results` : ''}
        </span>
      </div>
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              className="input"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button className="icon-btn" onClick={() => setCaseSensitive(!caseSensitive)}
            title="Case Sensitive" style={{ color: caseSensitive ? 'var(--accent)' : undefined }}>
            <CaseSensitive size={14} />
          </button>
          <button className="icon-btn" onClick={() => setUseRegex(!useRegex)}
            title="Use Regex" style={{ color: useRegex ? 'var(--accent)' : undefined }}>
            <Regex size={14} />
          </button>
        </div>
        {showReplace && (
          <div style={{ display: 'flex', gap: 4 }}>
            <input className="input" placeholder="Replace..." value={replaceQuery} onChange={e => setReplaceQuery(e.target.value)} />
            <button className="btn btn-ghost" onClick={replaceAll} style={{ flexShrink: 0, padding: '4px 8px' }}>
              All
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn btn-primary" onClick={handleSearch} style={{ flex: 1 }}>
            <Search size={12} /> Find
          </button>
          <button className="btn btn-ghost" onClick={() => setShowReplace(!showReplace)} title="Toggle Replace">
            <Replace size={12} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {searchLoading && (
          <div className="empty-state"><Loader2 size={18} className="spin" /> Searching...</div>
        )}
        {!searchLoading && searchResults.length === 0 && searchQuery && (
          <div className="empty-state"><Search size={20} style={{ color: 'var(--text-dim)' }} /><p>No results found</p></div>
        )}
        {Array.from(byFile.entries()).map(([filePath, results]) => (
          <div key={filePath}>
            <div style={{ padding: '4px 10px', fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--border-light)' }}>
              <FileCode size={12} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {filePath.split('/').pop()}
              </span>
              <span style={{ marginLeft: 'auto', color: 'var(--text-dim)', flexShrink: 0 }}>{results.length}</span>
            </div>
            {results.slice(0, 20).map((r, i) => (
              <div
                key={i}
                style={{ padding: '4px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'monospace', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-light)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
                onClick={() => handleOpenResult(filePath, r.lineNumber)}
              >
                <span style={{ color: 'var(--text-dim)', marginRight: 8 }}>{r.lineNumber}</span>
                {r.lineContent.trim()}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
