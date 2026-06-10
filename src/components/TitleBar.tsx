import { Minus, Square, X, Code2 } from 'lucide-react'
import { useStore } from '../stores/appStore'
import './TitleBar.css'

export default function TitleBar() {
  const { folderPath, openFiles, activeFileIndex } = useStore()
  const activeFile = openFiles[activeFileIndex]
  const title = activeFile
    ? `${activeFile.isDirty ? '● ' : ''}${activeFile.name} — CodeDroid`
    : 'CodeDroid IDE'

  return (
    <div className="titlebar">
      <div className="titlebar-drag" />
      <div className="titlebar-left">
        <Code2 size={15} className="titlebar-logo" />
        <span className="titlebar-appname">CodeDroid</span>
        {folderPath && (
          <span className="titlebar-folder">
            {folderPath.split('/').pop() || folderPath.split('\\').pop()}
          </span>
        )}
      </div>
      <div className="titlebar-title">{title}</div>
      <div className="titlebar-controls">
        <button className="wc-btn wc-min" onClick={() => window.api?.minimize()} title="Minimize">
          <Minus size={11} />
        </button>
        <button className="wc-btn wc-max" onClick={() => window.api?.maximize()} title="Maximize">
          <Square size={10} />
        </button>
        <button className="wc-btn wc-close" onClick={() => window.api?.close()} title="Close">
          <X size={11} />
        </button>
      </div>
    </div>
  )
}
