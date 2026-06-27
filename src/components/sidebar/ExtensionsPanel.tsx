import { useState, useEffect, useCallback } from 'react'
import {
  Package, Plus, Trash2, RefreshCw, CheckCircle2,
  XCircle, Loader2, Globe, Terminal, Zap, ChevronDown,
  ChevronRight, AlertTriangle, PlugZap, Search,
} from 'lucide-react'
import { sidecarHttp } from '../../lib/sidecar'

interface McpTool { name: string; description: string }
interface McpServer {
  id: string; name: string; description: string
  transport: 'stdio'|'sse'|'http'|'builtin'; permissions: string[]
  enabled: boolean; status: 'disconnected'|'connecting'|'connected'|'error'
  error: string; tools: McpTool[]
}

const STATUS_CFG = {
  connected:    { color: 'var(--git-added)',   Icon: CheckCircle2,  label: 'Connected'    },
  connecting:   { color: 'var(--accent)',      Icon: Loader2,       label: 'Connecting'   },
  disconnected: { color: 'var(--text-muted)',  Icon: XCircle,       label: 'Disconnected' },
  error:        { color: 'var(--git-deleted)', Icon: AlertTriangle, label: 'Error'        },
}
const TRANSPORT_ICON: Record<string,any> = { stdio: Terminal, sse: Globe, http: Globe, builtin: Zap }
const PERM_COLOR: Record<string,string> = {
  'filesystem:read':'#4ec9b0','filesystem:write':'#f48771',
  'network:external':'#9cdcfe','shell:execute':'#f44747',
}
const PRESETS = [
  { id:'web-search', name:'Web Search', description:'DuckDuckGo search — no API key', transport:'builtin', command:[], url:'', permissions:['network:external'] },
  { id:'github', name:'GitHub', description:'Repos, issues, PRs. Needs GITHUB_PERSONAL_ACCESS_TOKEN.', transport:'stdio', command:['npx','-y','@modelcontextprotocol/server-github'], url:'', permissions:['network:external'] },
  { id:'filesystem', name:'Filesystem (extended)', description:'Extended file ops via MCP', transport:'stdio', command:['npx','-y','@modelcontextprotocol/server-filesystem'], url:'', permissions:['filesystem:read','filesystem:write'] },
  { id:'brave-search', name:'Brave Search', description:'Web search via Brave. Needs BRAVE_API_KEY.', transport:'stdio', command:['npx','-y','@modelcontextprotocol/server-brave-search'], url:'', permissions:['network:external'] },
  { id:'puppeteer', name:'Browser (Puppeteer)', description:'Headless browser — screenshot, click, scrape', transport:'stdio', command:['npx','-y','@modelcontextprotocol/server-puppeteer'], url:'', permissions:['network:external','shell:execute'] },
]

function InstallForm({ onInstall, onCancel }: { onInstall:(m:any)=>void; onCancel:()=>void }) {
  const [tab, setTab] = useState<'preset'|'custom'>('preset')
  const [c, setC] = useState({ id:'', name:'', description:'', command:'', url:'', permissions:[] as string[] })
  const perms = ['filesystem:read','filesystem:write','network:external','shell:execute']
  return (
    <div style={{ background:'var(--bg-panel)', border:'1px solid var(--border)', borderRadius:10, padding:16, marginBottom:12 }}>
      <div style={{ display:'flex', gap:8, marginBottom:14 }}>
        {(['preset','custom'] as const).map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{ padding:'4px 12px', borderRadius:6, fontSize:12, cursor:'pointer', background:tab===t?'var(--accent)':'var(--bg-input)', color:tab===t?'#fff':'var(--text-muted)', border:'1px solid var(--border)' }}>
            {t==='preset'?'From Preset':'Custom'}
          </button>
        ))}
      </div>
      {tab==='preset' ? (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {PRESETS.map(p => (
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:7, background:'var(--bg-input)', border:'1px solid var(--border)' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:'var(--text)' }}>{p.name}</div>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>{p.description}</div>
              </div>
              <button onClick={()=>onInstall({...p,enabled:true})} style={{ padding:'4px 10px', borderRadius:5, fontSize:11, cursor:'pointer', background:'var(--accent)', color:'#fff', border:'none', whiteSpace:'nowrap' }}>Install</button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {[{k:'id',l:'ID',ph:'my-server'},{k:'name',l:'Name',ph:'My Server'},{k:'description',l:'Description',ph:'...'},{k:'command',l:'Command (stdio)',ph:'npx -y @my/server'},{k:'url',l:'URL (SSE/HTTP)',ph:'https://...'}].map(({k,l,ph})=>(
            <div key={k}>
              <label style={{ fontSize:11, color:'var(--text-muted)', display:'block', marginBottom:3 }}>{l}</label>
              <input className="input" placeholder={ph} value={(c as any)[k]} onChange={e=>setC(x=>({...x,[k]:e.target.value}))} style={{ width:'100%', fontSize:12 }} />
            </div>
          ))}
          <div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>Permissions</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
              {perms.map(p=>(
                <label key={p} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, cursor:'pointer' }}>
                  <input type="checkbox" checked={c.permissions.includes(p)} onChange={e=>setC(x=>({...x,permissions:e.target.checked?[...x.permissions,p]:x.permissions.filter(v=>v!==p)}))} />
                  <span style={{ color:PERM_COLOR[p]||'var(--text)' }}>{p}</span>
                </label>
              ))}
            </div>
          </div>
          <button onClick={()=>{ if(!c.id||!c.name) return; const cmd=c.command.trim().split(/\s+/).filter(Boolean); onInstall({id:c.id,name:c.name,description:c.description,transport:c.url.startsWith('http')?'http':'stdio',command:cmd,url:c.url,permissions:c.permissions,enabled:true}) }} style={{ padding:'7px 14px', borderRadius:6, fontSize:12, cursor:'pointer', background:'var(--accent)', color:'#fff', border:'none', marginTop:4 }}>Install</button>
        </div>
      )}
      <button onClick={onCancel} style={{ marginTop:10, padding:'5px 12px', borderRadius:6, fontSize:11, background:'transparent', color:'var(--text-muted)', border:'1px solid var(--border)', cursor:'pointer', width:'100%' }}>Cancel</button>
    </div>
  )
}

function ServerCard({ s, onToggle, onUninstall, onRefresh }: { s:McpServer; onToggle:(id:string,en:boolean)=>void; onUninstall:(id:string)=>void; onRefresh:()=>void }) {
  const [exp, setExp] = useState(false)
  const cfg = STATUS_CFG[s.status] || STATUS_CFG.disconnected
  const { Icon: StatusIcon } = cfg
  const TIcon = TRANSPORT_ICON[s.transport] || Package
  return (
    <div style={{ background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:9, overflow:'hidden', marginBottom:8 }}>
      <div style={{ padding:'10px 12px', display:'flex', alignItems:'center', gap:10 }}>
        <TIcon size={14} style={{ color:'var(--accent)', flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{s.name}</span>
            <StatusIcon size={11} style={{ color:cfg.color, animation:s.status==='connecting'?'spin 1s linear infinite':undefined }} />
          </div>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{s.description}</div>
        </div>
        <div onClick={()=>onToggle(s.id,!s.enabled)} style={{ width:32, height:18, borderRadius:9, cursor:'pointer', background:s.enabled?'var(--accent)':'var(--border)', position:'relative', flexShrink:0, transition:'background 0.2s' }}>
          <div style={{ position:'absolute', top:2, width:14, height:14, borderRadius:'50%', background:'white', left:s.enabled?16:2, transition:'left 0.2s' }} />
        </div>
        <button onClick={()=>setExp(v=>!v)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2 }}>
          {exp ? <ChevronDown size={13}/> : <ChevronRight size={13}/>}
        </button>
      </div>
      {exp && (
        <div style={{ padding:'0 12px 12px', borderTop:'1px solid var(--border-light)' }}>
          {s.permissions.length>0 && (
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:4 }}>PERMISSIONS</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                {s.permissions.map(p=>(
                  <span key={p} style={{ fontSize:10, padding:'2px 7px', borderRadius:4, background:`${PERM_COLOR[p]||'#888'}20`, color:PERM_COLOR[p]||'var(--text-muted)', border:`1px solid ${PERM_COLOR[p]||'#888'}40` }}>{p}</span>
                ))}
              </div>
            </div>
          )}
          {s.error && <div style={{ marginTop:8, padding:'6px 10px', borderRadius:6, background:'rgba(244,71,71,0.08)', border:'1px solid rgba(244,71,71,0.2)', fontSize:11, color:'var(--git-deleted)' }}>⚠️ {s.error}</div>}
          {s.tools.length>0 && (
            <div style={{ marginTop:10 }}>
              <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:6 }}>TOOLS ({s.tools.length})</div>
              {s.tools.map(t=>(
                <div key={t.name} style={{ padding:'5px 8px', borderRadius:5, marginBottom:4, background:'var(--bg-panel)', border:'1px solid var(--border-light)' }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'var(--accent)', fontFamily:'monospace' }}>{t.name}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:1 }}>{t.description}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:'flex', gap:6, marginTop:12 }}>
            <button onClick={onRefresh} style={{ flex:1, padding:'5px 0', borderRadius:5, fontSize:11, cursor:'pointer', background:'var(--bg-panel)', color:'var(--text-muted)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
              <RefreshCw size={11}/> Reconnect
            </button>
            <button onClick={()=>onUninstall(s.id)} style={{ flex:1, padding:'5px 0', borderRadius:5, fontSize:11, cursor:'pointer', background:'rgba(244,71,71,0.08)', color:'var(--git-deleted)', border:'1px solid rgba(244,71,71,0.2)', display:'flex', alignItems:'center', justifyContent:'center', gap:4 }}>
              <Trash2 size={11}/> Uninstall
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ExtensionsPanel() {
  const [servers, setServers] = useState<McpServer[]>([])
  const [loading, setLoading] = useState(false)
  const [showInstall, setShowInstall] = useState(false)
  const [query, setQuery] = useState('')
  const [totalTools, setTotalTools] = useState(0)

  const fetchServers = useCallback(async () => {
    setLoading(true)
    try {
      const [sr, tr] = await Promise.all([
        fetch(sidecarHttp('/mcp/servers')).then(r=>r.json()).catch(()=>({ok:false,servers:[]})),
        fetch(sidecarHttp('/mcp/tools')).then(r=>r.json()).catch(()=>({ok:false,tools:[]})),
      ])
      if (sr.ok) setServers(sr.servers||[])
      if (tr.ok) setTotalTools((tr.tools||[]).length)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchServers(); const id=setInterval(fetchServers,8000); return ()=>clearInterval(id) }, [fetchServers])

  const handleInstall = async (manifest: any) => {
    setShowInstall(false)
    await fetch(sidecarHttp('/mcp/install'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(manifest)}).catch(()=>{})
    setTimeout(fetchServers, 2000)
  }
  const handleToggle = async (id: string, enabled: boolean) => {
    setServers(s=>s.map(sv=>sv.id===id?{...sv,enabled}:sv))
    await fetch(sidecarHttp('/mcp/toggle'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,enabled})}).catch(()=>{})
    setTimeout(fetchServers, 2000)
  }
  const handleUninstall = async (id: string) => {
    setServers(s=>s.filter(sv=>sv.id!==id))
    await fetch(sidecarHttp(`/mcp/uninstall/${id}`),{method:'DELETE'}).catch(()=>{})
  }

  const filtered = servers.filter(s=>!query||s.name.toLowerCase().includes(query.toLowerCase())||s.description.toLowerCase().includes(query.toLowerCase()))
  const connected = servers.filter(s=>s.status==='connected').length

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      <div style={{ padding:'10px 12px 8px', borderBottom:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <PlugZap size={14} style={{ color:'var(--accent)' }} />
            <span style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>MCP Plugins</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6 }}>
            <button onClick={fetchServers} title="Refresh" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', padding:2 }}>
              <RefreshCw size={12} className={loading?'spin':''} />
            </button>
            <button onClick={()=>setShowInstall(v=>!v)} style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer', background:showInstall?'var(--bg-input)':'var(--accent)', color:showInstall?'var(--text-muted)':'#fff', border:'1px solid var(--border)' }}>
              <Plus size={11}/> Add
            </button>
          </div>
        </div>
        <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text-muted)' }}>
          <span><span style={{ color:'var(--git-added)' }}>{connected}</span>/{servers.length} connected</span>
          <span><span style={{ color:'var(--accent)' }}>{totalTools}</span> tools available</span>
        </div>
      </div>
      <div style={{ padding:'8px 12px', borderBottom:'1px solid var(--border-light)' }}>
        <div style={{ position:'relative' }}>
          <Search size={11} style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)', pointerEvents:'none' }} />
          <input className="input" placeholder="Filter plugins..." value={query} onChange={e=>setQuery(e.target.value)} style={{ width:'100%', paddingLeft:26, fontSize:12 }} />
        </div>
      </div>
      <div style={{ flex:1, overflow:'auto', padding:'10px 12px' }}>
        {showInstall && <InstallForm onInstall={handleInstall} onCancel={()=>setShowInstall(false)} />}
        {filtered.length===0 && !loading && !showInstall && (
          <div style={{ textAlign:'center', color:'var(--text-muted)', fontSize:12, marginTop:32 }}>
            <PlugZap size={28} style={{ opacity:0.3, marginBottom:8 }} />
            <div>No MCP plugins installed</div>
            <div style={{ fontSize:11, marginTop:4 }}>Click Add to install your first plugin</div>
          </div>
        )}
        {filtered.map(s=>(
          <ServerCard key={s.id} s={s} onToggle={handleToggle} onUninstall={handleUninstall} onRefresh={fetchServers} />
        ))}
      </div>
      <div style={{ padding:'8px 12px', borderTop:'1px solid var(--border)', fontSize:10, color:'var(--text-muted)', lineHeight:1.5 }}>
        MCP tools are available to the AI in agent mode. <span style={{ color:'var(--accent)' }}>Web Search</span> is built-in.
      </div>
    </div>
  )
}