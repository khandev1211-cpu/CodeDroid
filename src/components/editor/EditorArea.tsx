import { useState, useRef, useCallback } from 'react'
import Editor, { OnMount } from '@monaco-editor/react'
import { X, Circle, ChevronRight, SplitSquareHorizontal } from 'lucide-react'
import { useStore } from '../../stores/appStore'
import './EditorArea.css'

const LANG_ICON_COLOR: Record<string, string> = {
  typescript: '#3178c6', javascript: '#f7df1e', python: '#3776ab',
  rust: '#ce422b', go: '#00acd7', java: '#b07219', html: '#e34c26',
  css: '#563d7c', json: '#5c5c5c', markdown: '#083fa1', plaintext: '#888',
}

function TabBar() {
  const { openFiles, activeFileIndex, closeFile, setActiveFile, saveFile } = useStore()

  return (
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
  )
}

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
    settings, theme, setInlineAi
  } = useStore()
  const editorRef = useRef<any>(null)
  const [editorReady, setEditorReady] = useState(false)

  const file = openFiles[activeFileIndex]

  const getMonacoTheme = () => {
    const isDark = theme.category !== 'light'
    return isDark ? 'codedroid-dark' : 'codedroid-light'
  }

  const defineTheme = (monaco: any) => {
    const c = theme.colors
    monaco.editor.defineTheme('codedroid-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: c.keyword.slice(1) },
        { token: 'string', foreground: c.string.slice(1) },
        { token: 'comment', foreground: c.comment.slice(1), fontStyle: 'italic' },
        { token: 'number', foreground: c.number.slice(1) },
        { token: 'identifier', foreground: c.variable.slice(1) },
        { token: 'type', foreground: c.type.slice(1) },
        { token: 'function', foreground: c.func.slice(1) },
        { token: 'operator', foreground: c.operator.slice(1) },
      ],
      colors: {
        'editor.background': c.bgEditor,
        'editor.foreground': c.text,
        'editor.lineHighlightBackground': c.lineHighlight,
        'editor.selectionBackground': c.selection,
        'editorLineNumber.foreground': c.textDim,
        'editorLineNumber.activeForeground': c.textMuted,
        'editor.findMatchBackground': c.accentSoft,
        'editorCursor.foreground': c.accent,
        'editorWhitespace.foreground': c.border,
        'editorIndentGuide.background': c.borderLight,
        'editorIndentGuide.activeBackground': c.border,
        'scrollbarSlider.background': c.scrollbar + '88',
        'scrollbarSlider.hoverBackground': c.scrollbar,
        'editorWidget.background': c.bgPanel,
        'editorWidget.border': c.border,
        'input.background': c.bgInput,
        'input.foreground': c.text,
        'input.border': c.border,
        'focusBorder': c.accent,
        'dropdown.background': c.bgPanel,
        'list.hoverBackground': c.bgHover,
        'list.activeSelectionBackground': c.bgActive,
        'list.focusBackground': c.bgActive,
      }
    })
    monaco.editor.defineTheme('codedroid-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: c.keyword.slice(1) },
        { token: 'string', foreground: c.string.slice(1) },
        { token: 'comment', foreground: c.comment.slice(1), fontStyle: 'italic' },
      ],
      colors: {
        'editor.background': c.bgEditor,
        'editor.foreground': c.text,
        'editor.lineHighlightBackground': c.lineHighlight,
        'editor.selectionBackground': c.selection,
        'editorLineNumber.foreground': c.textDim,
        'editorCursor.foreground': c.accent,
      }
    })
  }

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor
    defineTheme(monaco)
    monaco.editor.setTheme(getMonacoTheme())
    setEditorReady(true)

    // Ctrl+S = save
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveFile(activeFileIndex)
    })

    // Ctrl+I = inline AI
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
      const selection = editor.getSelection()
      const selectedText = editor.getModel()?.getValueInRange(selection!) || ''
      const line = selection?.startLineNumber || 1
      setInlineAi(true, { line, selection: selectedText })
    })
  }

  const handleChange = (value: string | undefined) => {
    if (value !== undefined && file) {
      updateFileContent(activeFileIndex, value, true)
      if (settings.autoSave) saveFile(activeFileIndex)
    }
  }

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
            <button className="btn btn-primary" onClick={() => window.api?.openFolder()}>
              Open Folder
            </button>
            <button className="btn btn-ghost" onClick={() => window.api?.openFile()}>
              Open File
            </button>
          </div>
          <div className="welcome-shortcuts">
            {[
              ['Ctrl+Shift+P', 'Command Palette'],
              ['Ctrl+B', 'Toggle Sidebar'],
              ['Ctrl+J', 'Toggle Terminal'],
              ['Ctrl+I', 'Inline AI Edit'],
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

  return (
    <div className="editor-area">
      <TabBar />
      <Breadcrumbs />
      <div className="editor-container">
        <Editor
          language={file.language}
          value={file.content}
          theme={getMonacoTheme()}
          onChange={handleChange}
          onMount={handleEditorMount}
          options={{
            fontSize: settings.fontSize,
            fontFamily: settings.fontFamily,
            wordWrap: settings.wordWrap ? 'on' : 'off',
            minimap: { enabled: settings.minimap },
            lineNumbers: settings.lineNumbers ? 'on' : 'off',
            tabSize: settings.tabSize,
            insertSpaces: true,
            scrollBeyondLastLine: false,
            renderWhitespace: 'selection',
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            renderLineHighlight: 'line',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            padding: { top: 8, bottom: 8 },
            suggest: { showKeywords: true, showSnippets: true },
            quickSuggestions: { other: true, comments: true, strings: true },
            formatOnPaste: true,
            autoIndent: 'advanced',
            overviewRulerLanes: 3,
            scrollbar: { vertical: 'auto', horizontal: 'auto', verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
          }}
        />
      </div>
    </div>
  )
}
