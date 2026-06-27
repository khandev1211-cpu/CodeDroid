import { useState, useEffect, useRef } from 'react'
import {
  Users, Copy, CheckCheck, Link2, UserPlus,
  Wifi, WifiOff, X, Crown, Circle,
} from 'lucide-react'
import { useCollabStore, CollabPeer } from '../../stores/collabStore'
import { useStore } from '../../stores/appStore'

// ── Peer avatar ────────────────────────────────────────────────────────────────
function PeerAvatar({ peer, size = 28 }: { peer: CollabPeer; size?: number }) {
  return (
    <div title={`${peer.name}${peer.isHost ? ' (host)' : ''} — ${peer.activePath || 'no file open'}`}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: peer.color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 700,
        border: '2px solid var(--bg-panel)',
        flexShrink: 0, position: 'relative',
      }}
    >
      {peer.avatar}
      {peer.isHost && (
        <Crown size={9} style={{
          position: 'absolute', bottom: -3, right: -3,
          color: '#f5c542', background: 'var(--bg-panel)', borderRadius: '50%', padding: 1,
        }} />
      )}
    </div>
  )
}

// ── Peer list item ─────────────────────────────────────────────────────────────
function PeerRow({ peer }: { peer: CollabPeer }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '7px 12px', borderBottom: '1px solid var(--border-light)',
    }}>
      <PeerAvatar peer={peer} size={30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{peer.name}</span>
          {peer.isHost && <Crown size={10} style={{ color: '#f5c542' }} />}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {peer.activePath ? peer.activePath.split(/[\\/]/).pop() : 'No file open'}
        </div>
      </div>
      <Circle size={8} style={{ color: 'var(--git-added)', fill: 'var(--git-added)', flexShrink: 0 }} />
    </div>
  )
}

// ── Join form ──────────────────────────────────────────────────────────────────
function JoinForm({ onJoin }: { onJoin: (id: string) => void }) {
  const [id, setId] = useState('')
  return (
    <div style={{ display: 'flex', gap: 6, padding: '10px 12px' }}>
      <input
        className="input"
        placeholder="Paste session ID..."
        value={id}
        onChange={e => setId(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && id.trim() && onJoin(id.trim())}
        style={{ flex: 1, fontSize: 12 }}
      />
      <button
        onClick={() => id.trim() && onJoin(id.trim())}
        disabled={!id.trim()}
        style={{
          padding: '0 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
          background: 'var(--accent)', color: '#fff', border: 'none',
          opacity: id.trim() ? 1 : 0.5,
        }}
      >Join</button>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────
export default function CollabPanel() {
  const {
    session, peers, isConnecting, error,
    myName, myColor,
    startSession, joinSession, stopSession, setMyName,
  } = useCollabStore()

  const { folderPath } = useStore()
  const [copied, setCopied] = useState(false)
  const [nameEdit, setNameEdit] = useState(false)
  const [nameVal, setNameVal] = useState(myName)
  const [tab, setTab] = useState<'host' | 'join'>('host')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setNameVal(myName) }, [myName])
  useEffect(() => { if (nameEdit) nameRef.current?.focus() }, [nameEdit])

  const handleCopy = () => {
    if (!session) return
    navigator.clipboard.writeText(session.id)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStart = async () => {
    await startSession(folderPath || 'untitled', myName)
  }

  const handleJoin = async (id: string) => {
    await joinSession(id, myName)
  }

  const handleNameSave = () => {
    setMyName(nameVal.trim() || 'Anonymous')
    setNameEdit(false)
  }

  // My "peer" for display
  const mePeer: CollabPeer = {
    clientId: 0, name: myName, color: myColor,
    avatar: myName.split(' ').map((w: string) => w[0] || '').join('').toUpperCase().slice(0, 2) || '??',
    activePath: '', cursor: null, isHost: session?.isHost ?? false, joinedAt: Date.now(),
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
          <Users size={14} style={{ color: 'var(--accent)' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Collaboration</span>
          {session && (
            <div style={{
              marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: 'var(--git-added)',
            }}>
              <Wifi size={10} /> Live
            </div>
          )}
        </div>

        {/* My name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PeerAvatar peer={mePeer} size={26} />
          {nameEdit ? (
            <input
              ref={nameRef}
              className="input"
              value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={e => { if (e.key === 'Enter') handleNameSave() }}
              style={{ flex: 1, fontSize: 12 }}
            />
          ) : (
            <span
              onClick={() => setNameEdit(true)}
              style={{ fontSize: 12, color: 'var(--text)', cursor: 'text', flex: 1 }}
              title="Click to change your display name"
            >
              {myName} <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>(you)</span>
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {!session ? (
        /* No session — show host/join options */
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {(['host', 'join'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{
                flex: 1, padding: '8px 0', fontSize: 12, cursor: 'pointer',
                background: 'none', border: 'none',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                color: tab === t ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: tab === t ? 600 : 400,
              }}>
                {t === 'host' ? '🏠 Host Session' : '🔗 Join Session'}
              </button>
            ))}
          </div>

          {tab === 'host' ? (
            <div style={{ padding: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.6 }}>
                Start a session and share the ID with teammates. They connect directly via WebRTC — no server required on LAN.
              </div>
              <button
                onClick={handleStart}
                disabled={isConnecting}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 7, fontSize: 13,
                  cursor: isConnecting ? 'default' : 'pointer',
                  background: 'var(--accent)', color: '#fff', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  opacity: isConnecting ? 0.7 : 1,
                }}
              >
                <UserPlus size={14} />
                {isConnecting ? 'Starting...' : 'Start Session'}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ padding: '12px 12px 4px', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Paste a session ID from your teammate to join their session.
              </div>
              <JoinForm onJoin={handleJoin} />
              {isConnecting && (
                <div style={{ padding: '0 12px', fontSize: 11, color: 'var(--accent)' }}>
                  ⏳ Connecting to session...
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ margin: '0 12px', padding: '8px 10px', borderRadius: 6, background: 'rgba(244,71,71,0.08)', border: '1px solid rgba(244,71,71,0.2)', fontSize: 11, color: 'var(--git-deleted)' }}>
              ⚠️ {error}
            </div>
          )}

          {/* Info */}
          <div style={{ margin: '16px 12px 0', padding: '10px 12px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>How it works</div>
            <div>✓ Real-time collaborative editing powered by Yjs CRDT</div>
            <div>✓ Peer-to-peer via WebRTC — no cloud dependency</div>
            <div>✓ See teammates' cursors live in the editor</div>
            <div>✓ Works on LAN without internet (via local signaling)</div>
          </div>
        </div>
      ) : (
        /* Active session */
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          {/* Session ID card */}
          <div style={{ margin: 12, padding: '10px 12px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--accent)40' }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
              {session.isHost ? 'YOUR SESSION ID — share this' : 'JOINED SESSION'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', color: 'var(--accent)', letterSpacing: 1 }}>
                {session.id}
              </code>
              <button onClick={handleCopy} title="Copy session ID" style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: copied ? 'var(--git-added)' : 'var(--text-muted)', padding: 2,
              }}>
                {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              {peers.length === 0 ? 'Waiting for teammates to join...' : `${peers.length} teammate${peers.length !== 1 ? 's' : ''} connected`}
            </div>
          </div>

          {/* Peer list */}
          <div style={{ borderTop: '1px solid var(--border-light)' }}>
            <div style={{ padding: '6px 12px 4px', fontSize: 10, color: 'var(--text-muted)' }}>
              IN THIS SESSION ({peers.length + 1})
            </div>
            {/* Me */}
            <PeerRow peer={{ ...mePeer, isHost: session.isHost }} />
            {/* Others */}
            {peers.map(p => <PeerRow key={p.clientId} peer={p} />)}
          </div>

          {/* Leave button */}
          <div style={{ padding: 12, marginTop: 'auto' }}>
            <button
              onClick={stopSession}
              style={{
                width: '100%', padding: '8px 0', borderRadius: 7, fontSize: 12,
                cursor: 'pointer', background: 'rgba(244,71,71,0.08)',
                color: 'var(--git-deleted)', border: '1px solid rgba(244,71,71,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <WifiOff size={13} />
              {session.isHost ? 'End Session' : 'Leave Session'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}