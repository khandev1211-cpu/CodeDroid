import { useStore } from "../../stores/appStore"
import FilesPanel from "./FilesPanel"
import SearchPanel from "./SearchPanel"
import GitPanel from "./GitPanel"
import ExtensionsPanel from "./ExtensionsPanel"
import SettingsPanel from "./SettingsPanel"

export default function Sidebar() {
  const { activePanel } = useStore()
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {activePanel === "files"      && <FilesPanel />}
      {activePanel === "search"     && <SearchPanel />}
      {activePanel === "git"        && <GitPanel />}
      {activePanel === "extensions" && <ExtensionsPanel />}
      {activePanel === "settings"   && <SettingsPanel />}
    </div>
  )
}