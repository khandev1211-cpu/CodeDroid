import { useState, useRef, useEffect } from 'react'
import Editor, { OnMount, loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import { X, Circle, ChevronRight, SplitSquareHorizontal } from 'lucide-react'
import { useStore } from '../../stores/appStore'
import { useCollabStore } from '../../stores/collabStore'
import { applyErrorDecorations, clearErrorDecorations } from './ErrorDecorations'
import ProblemsPanel from './ProblemsPanel'
import PreviewButton from './PreviewButton'
import './EditorArea.css'

const LANG_ICON_COLOR: Record<string, string> = {
  typescript: '#3178c6', javascript: '#f7df1e', python: '#3776ab',
  rust: '#ce422b', go: '#00acd7', java: '#b07219', html: '#e34c26',
  css: '#563d7c', json: '#5c5c5c', markdown: '#083fa1', plaintext: '#888',
}

function TabBar() {
  const { openFiles, activeFileIndex, closeFile, setActiveFile, saveFile } = useStore()
  return (
    <div className="tab-bar-row">
      <div className="tab-bar">
        {openFiles.map((file, i) => (
          <div
            key={file.path}
            className={`tab ${i === activeFileIndex ? 'active' : ''}`}
            onClick={() => setActiveFile(i)}
            onMouseDown={e => { if (e.button === 1) { e.preventDefault(); closeFile(i) } }}
            title={file.path}
          >
            <span className="tab-lang-dot" style={{ background: LANG_ICON_COLOR[file.language] || '#888' }} />
            <span className="tab-name">{file.name}</span>
            <button
              className="tab-close"
              onClick={e => { e.stopPropagation(); closeFile(i) }}
              title={file.isDirty ? 'Unsaved changes' : 'Close'}
            >
              {file.isDirty ? <Circle size={8} fill="currentColor" /> : <X size={10} />}
            </button>
          </div>
        ))}
      </div>
      <PreviewButton />
    </div>
  )
}

// ── Configure Monaco loader once at module level ─────────────────────────────
// Use the locally bundled monaco-editor instead of CDN/dynamic loading.
// This is the correct pattern for Electron + Vite — avoids worker path issues.
loader.config({ monaco })

function Breadcrumbs() {
  const { openFiles, activeFileIndex, settings } = useStore()
  if (!settings.showBreadcrumbs) return null
  const file = openFiles[activeFileIndex]
  if (!file) return null
  const parts = file.path.replace(/\\/g, '/').split('/')
  return (
    <div className="breadcrumbs">
      {parts.map((part, i) => (
        <span key={i} className="bc-part">
          {i > 0 && <ChevronRight size={10} className="bc-sep" />}
          <span className={i === parts.length - 1 ? 'bc-active' : 'bc-dir'}>{part}</span>
        </span>
      ))}
    </div>
  )
}

export default function EditorArea() {
  const {
    openFiles, activeFileIndex, updateFileContent, saveFile,
    settings, theme, setInlineAi, openNewFolder,
    inlineErrors, clearInlineErrors,
  } = useStore()

  // Collab
  const { session, getDoc, getProvider, openFileInCollab, updateMyPresence } = useCollabStore()
  const collabBindingRef = useRef<any>(null)

  const editorRef      = useRef<any>(null)
  const monacoRef      = useRef<any>(null)
  const [editorReady, setEditorReady] = useState(false)

  const file = openFiles[activeFileIndex]

  // ── All hooks BEFORE any conditional return ──────────────────────────────

  // Re-apply Monaco theme on theme change
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return
    const monaco = monacoRef.current
    const c = theme.colors
    const isDark = theme.category !== 'light'
    const themeId = isDark ? 'codedroid-dark' : 'codedroid-light'
    monaco.editor.defineTheme(themeId, {
      base: isDark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: [
        { token: 'keyword',    foreground: c.keyword.slice(1) },
        { token: 'string',     foreground: c.string.slice(1) },
        { token: 'comment',    foreground: c.comment.slice(1), fontStyle: 'italic' },
        { token: 'number',     foreground: c.number.slice(1) },
        { token: 'identifier', foreground: c.variable.slice(1) },
        { token: 'type',       foreground: c.type.slice(1) },
        { token: 'function',   foreground: c.func.slice(1) },
        { token: 'operator',   foreground: c.operator.slice(1) },
      ],
      colors: {
        'editor.background':               c.bgEditor,
        'editor.foreground':               c.text,
        'editor.lineHighlightBackground':  c.lineHighlight,
        'editor.selectionBackground':      c.selection,
        'editorLineNumber.foreground':     c.textDim,
        'editorLineNumber.activeForeground': c.textMuted,
        'editor.findMatchBackground':      c.accentSoft,
        'editorCursor.foreground':         c.accent,
        'editorWhitespace.foreground':     c.border,
        'scrollbarSlider.background':      c.scrollbar + '88',
        'scrollbarSlider.hoverBackground': c.scrollbar,
        'editorWidget.background':         c.bgPanel,
        'editorWidget.border':             c.border,
        'input.background':                c.bgInput,
        'input.foreground':                c.text,
        'focusBorder':                     c.accent,
        'dropdown.background':             c.bgPanel,
        'list.hoverBackground':            c.bgHover,
        'list.activeSelectionBackground':  c.bgActive,
      }
    })
    monaco.editor.setTheme(themeId)
  }, [theme])

  // Update Monaco model language when file is renamed (extension changes)
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !file) return
    const model = editorRef.current.getModel()
    if (!model) return
    if (model.getLanguageId() !== file.language) {
      monacoRef.current.editor.setModelLanguage(model, file.language)
    }
  }, [file?.language, file?.path])

  // Apply inline error decorations from agent auto-fix
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return
    if (!file) { clearErrorDecorations(editorRef.current); return }
    const fileErrors = inlineErrors.filter(e =>
      e.file === file.path || file.path.endsWith(e.file)
    )
    if (fileErrors.length === 0) {
      clearErrorDecorations(editorRef.current)
    } else {
      applyErrorDecorations(editorRef.current, monacoRef.current, fileErrors)
    }
  }, [inlineErrors, activeFileIndex, openFiles])

  // goto-line event from ProblemsPanel click
  useEffect(() => {
    const handler = (e: Event) => {
      const { line, column } = (e as CustomEvent).detail
      if (editorRef.current) {
        editorRef.current.revealLineInCenter(line)
        editorRef.current.setPosition({ lineNumber: line, column: column ?? 1 })
        editorRef.current.focus()
      }
    }
    window.addEventListener('codedroid-goto-line', handler)
    return () => window.removeEventListener('codedroid-goto-line', handler)
  }, [])

  // Cleanup Monaco theme listener on unmount
  useEffect(() => {
    const onThemeChange = (e: Event) => {
      const newTheme = (e as CustomEvent).detail
      if (!editorRef.current || !monacoRef.current) return
      const c = newTheme.colors
      const isDark = newTheme.category !== 'light'
      const themeId = isDark ? 'codedroid-dark' : 'codedroid-light'
      monacoRef.current.editor.defineTheme(themeId, {
        base: isDark ? 'vs-dark' : 'vs', inherit: true,
        rules: [
          { token: 'keyword',    foreground: c.keyword.slice(1) },
          { token: 'string',     foreground: c.string.slice(1) },
          { token: 'comment',    foreground: c.comment.slice(1), fontStyle: 'italic' },
          { token: 'number',     foreground: c.number.slice(1) },
          { token: 'identifier', foreground: c.variable.slice(1) },
          { token: 'type',       foreground: c.type.slice(1) },
          { token: 'function',   foreground: c.func.slice(1) },
          { token: 'operator',   foreground: c.operator.slice(1) },
        ],
        colors: {
          'editor.background':              c.bgEditor,
          'editor.foreground':              c.text,
          'editor.lineHighlightBackground': c.lineHighlight,
          'editor.selectionBackground':     c.selection,
          'editorLineNumber.foreground':    c.textDim,
          'editorCursor.foreground':        c.accent,
          'scrollbarSlider.background':     c.scrollbar + '88',
          'editorWidget.background':        c.bgPanel,
          'focusBorder':                    c.accent,
        }
      })
      monacoRef.current.editor.setTheme(themeId)
    }
    window.addEventListener('codedroid-theme-change', onThemeChange)
    return () => window.removeEventListener('codedroid-theme-change', onThemeChange)
  }, [])

  // ── Handlers ─────────────────────────────────────────────────────────────

  const getMonacoTheme = () => theme.category !== 'light' ? 'codedroid-dark' : 'codedroid-light'

  const handleChange = (value: string | undefined) => {
    if (value !== undefined && file) {
      updateFileContent(activeFileIndex, value, true)
      if (settings.autoSave) saveFile(activeFileIndex)
    }
  }

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current  = editor
    monacoRef.current  = monaco
    setEditorReady(true)

    // Define initial theme
    const c = theme.colors
    const isDark = theme.category !== 'light'
    const themeId = isDark ? 'codedroid-dark' : 'codedroid-light'
    monaco.editor.defineTheme(themeId, {
      base: isDark ? 'vs-dark' : 'vs', inherit: true,
      rules: [
        { token: 'keyword',    foreground: c.keyword.slice(1) },
        { token: 'string',     foreground: c.string.slice(1) },
        { token: 'comment',    foreground: c.comment.slice(1), fontStyle: 'italic' },
        { token: 'number',     foreground: c.number.slice(1) },
        { token: 'identifier', foreground: c.variable.slice(1) },
        { token: 'type',       foreground: c.type.slice(1) },
        { token: 'function',   foreground: c.func.slice(1) },
        { token: 'operator',   foreground: c.operator.slice(1) },
      ],
      colors: {
        'editor.background':               c.bgEditor,
        'editor.foreground':               c.text,
        'editor.lineHighlightBackground':  c.lineHighlight,
        'editor.selectionBackground':      c.selection,
        'editorLineNumber.foreground':     c.textDim,
        'editorLineNumber.activeForeground': c.textMuted,
        'editor.findMatchBackground':      c.accentSoft,
        'editorCursor.foreground':         c.accent,
        'editorWhitespace.foreground':     c.border,
        'scrollbarSlider.background':      c.scrollbar + '88',
        'scrollbarSlider.hoverBackground': c.scrollbar,
        'editorWidget.background':         c.bgPanel,
        'editorWidget.border':             c.border,
        'input.background':                c.bgInput,
        'input.foreground':                c.text,
        'focusBorder':                     c.accent,
        'dropdown.background':             c.bgPanel,
        'list.hoverBackground':            c.bgHover,
        'list.activeSelectionBackground':  c.bgActive,
      }
    })
    monaco.editor.setTheme(themeId)

    // Ctrl+S — save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile(activeFileIndex)
    })

    // Ctrl+I — inline AI
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
      const selection = editor.getSelection()
      const selectedText = editor.getModel()?.getValueInRange(selection!) || ''
      const line = selection?.startLineNumber || 1
      setInlineAi(true, { line, selection: selectedText })
    })
  }

  // ── Welcome screen (no file open) — after all hooks ──────────────────────
  if (!file) {
    return (
      <div className="editor-area">
        <div className="editor-welcome">
          <div className="welcome-logo">
            <span style={{ fontSize: 48 }}>⚡</span>
          </div>
          <h2 className="welcome-title">CodeDroid IDE</h2>
          <p className="welcome-sub">TypeScript · Python · Rust</p>
          <div className="welcome-actions">
            <button className="btn btn-primary" onClick={() => openNewFolder()}>
              Open Folder
            </button>
            <button className="btn btn-ghost" onClick={() => window.api?.openFile()}>
              Open File
            </button>
          </div>
          <div className="welcome-shortcuts">
            {[
              ['Ctrl+Shift+P', 'Command Palette'],
              ['Ctrl+B',       'Toggle Sidebar'],
              ['Ctrl+J',       'Toggle Terminal'],
              ['Ctrl+I',       'Inline AI Edit'],
            ].map(([key, desc]) => (
              <div key={key} className="welcome-shortcut">
                <kbd>{key}</kbd>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Editor with open file ─────────────────────────────────────────────────
  return (
    <div className="editor-area">
      <TabBar />
      <Breadcrumbs />
      <div className="editor-container">
        <Editor
          language={file.language}
          value={file.content}
          path={file.path}
          theme={getMonacoTheme()}
          onChange={handleChange}
          onMount={handleEditorMount}

          loading={
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: 'var(--text-muted)', fontSize: 13, gap: 8,
            }}>
              <div style={{
                width: 16, height: 16, border: '2px solid var(--accent)',
                borderTopColor: 'transparent', borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }} />
              Opening {file.name}...
            </div>
          }
          options={{
            fontSize:               settings.fontSize,
            fontFamily:             settings.fontFamily,
            wordWrap:               settings.wordWrap ? 'on' : 'off',
            minimap:                { enabled: settings.minimap },
            lineNumbers:            settings.lineNumbers ? 'on' : 'off',
            tabSize:                settings.tabSize,
            insertSpaces:           true,
            scrollBeyondLastLine:   false,
            renderWhitespace:       'selection',
            smoothScrolling:        true,
            cursorBlinking:         'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight:    'line',
            bracketPairColorization: { enabled: true },
            guides:                 { bracketPairs: true, indentation: true },
            padding:                { top: 8, bottom: 8 },
            suggest:                { showKeywords: true, showSnippets: true },
            quickSuggestions:       { other: true, comments: true, strings: true },
            formatOnPaste:          true,
            autoIndent:             'advanced',
            overviewRulerLanes:     3,
            glyphMargin:            true,
            scrollbar:              { vertical: 'auto', horizontal: 'auto', verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          }}
        />
      </div>
      <ProblemsPanel />
    </div>
  )
}