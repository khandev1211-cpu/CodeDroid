import { Files, Search, GitBranch, Package, Settings } from "lucide-react"
import { useStore, Panel } from "../stores/appStore"
import "./ActivityBar.css"

const panels: { id: Panel; icon: any; label: string }[] = [
  { id: "files",      icon: Files,    label: "Explorer (Ctrl+Shift+E)" },
  { id: "search",     icon: Search,   label: "Search (Ctrl+Shift+F)" },
  { id: "git",        icon: GitBranch,label: "Source Control" },
  { id: "extensions", icon: Package,  label: "Extensions" },
  { id: "settings",   icon: Settings, label: "Settings" },
]

export default function ActivityBar() {
  const { activePanel, setActivePanel, updateSettings, settings } = useStore()

  return (
    <div className="activity-bar">
      <div className="activity-top">
        {panels.map(p => (
          <button key={p.id}
            className={`ab-btn ${activePanel === p.id ? "active" : ""}`}
            onClick={() => setActivePanel(p.id as Panel)}
            title={p.label}>
            <p.icon size={22} />
            {activePanel === p.id && <span className="ab-indicator" />}
          </button>
        ))}
      </div>
    </div>
  )
}