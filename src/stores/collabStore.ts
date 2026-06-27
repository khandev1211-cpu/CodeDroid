/**
 * collabStore.ts — Yjs CRDT collaboration for CodeDroid v4.
 *
 * Architecture:
 *   - Host opens a project → gets a session ID (stored in kv + URL hash)
 *   - Peers join via codedroid://session/<id> or paste the ID in the Collab panel
 *   - Each open file becomes a Y.Text document synced via y-webrtc
 *   - Cursors/selections shared via Yjs awareness protocol
 *   - No server needed for LAN — WebRTC peer-to-peer direct connect
 *
 * Usage:
 *   const { startSession, joinSession, stopSession } = useCollabStore()
 */

import { create } from 'zustand'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'

// ── Signaling servers (free public ones for WebRTC peer discovery) ─────────────
const SIGNALING_SERVERS = [
  'wss://signaling.yjs.dev',
  'wss://y-webrtc-signaling-eu.herokuapp.com',
  'wss://y-webrtc-signaling-us.herokuapp.com',
]

// ── Types ──────────────────────────────────────────────────────────────────────
export interface CollabPeer {
  clientId: number
  name: string
  color: string
  avatar: string       // initials
  activePath: string   // which file they're in
  cursor: { line: number; col: number } | null
  isHost: boolean
  joinedAt: number
}

export interface CollabSession {
  id: string
  isHost: boolean
  roomName: string     // derived from session id — used for WebRTC room
  startedAt: number
  project: string
}

interface CollabState {
  // Session
  session: CollabSession | null
  peers: CollabPeer[]
  isConnecting: boolean
  error: string

  // Yjs internals (not serialized)
  _docs: Map<string, Y.Doc>
  _providers: Map<string, WebrtcProvider>
  _rootDoc: Y.Doc | null

  // My presence info
  myName: string
  myColor: string

  // Actions
  startSession:  (project: string, myName: string) => Promise<string>
  joinSession:   (sessionId: string, myName: string) => Promise<void>
  stopSession:   () => void
  getDoc:        (filePath: string) => Y.Doc | null
  getProvider:   (filePath: string) => WebrtcProvider | null
  openFileInCollab: (filePath: string, initialContent: string) => Y.Doc
  updateMyPresence: (filePath: string, cursor: { line: number; col: number } | null) => void
  setMyName:     (name: string) => void
}

// ── Color palette for peers ────────────────────────────────────────────────────
const PEER_COLORS = [
  '#4ec9b0', '#f48771', '#9cdcfe', '#dcdcaa',
  '#c586c0', '#ce9178', '#b5cea8', '#569cd6',
]

let _colorIdx = 0
function nextColor() {
  return PEER_COLORS[_colorIdx++ % PEER_COLORS.length]
}

function generateSessionId(): string {
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function initials(name: string): string {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2) || '??'
}

// ── Store ──────────────────────────────────────────────────────────────────────
export const useCollabStore = create<CollabState>((set, get) => ({
  session:      null,
  peers:        [],
  isConnecting: false,
  error:        '',
  _docs:        new Map(),
  _providers:   new Map(),
  _rootDoc:     null,
  myName:       'Anonymous',
  myColor:      nextColor(),

  setMyName: (name) => set({ myName: name }),

  // ── Start a new session as host ──────────────────────────────────────────────
  startSession: async (project, myName) => {
    const { stopSession } = get()
    stopSession()

    const sessionId = generateSessionId()
    const roomName  = `codedroid-${sessionId}`
    const myColor   = get().myColor

    const session: CollabSession = {
      id:         sessionId,
      isHost:     true,
      roomName,
      startedAt:  Date.now(),
      project,
    }

    // Root doc for session metadata (peer list, file manifest)
    const rootDoc = new Y.Doc()
    const provider = new WebrtcProvider(roomName, rootDoc, {
      signaling: SIGNALING_SERVERS,
    })

    // Broadcast my presence
    provider.awareness.setLocalStateField('user', {
      name:       myName,
      color:      myColor,
      avatar:     initials(myName),
      activePath: '',
      cursor:     null,
      isHost:     true,
      joinedAt:   Date.now(),
    })

    // Listen for peer presence changes
    provider.awareness.on('change', () => {
      _updatePeers(provider, set)
    })

    set({
      session,
      peers:        [],
      isConnecting: false,
      error:        '',
      myName,
      _rootDoc:     rootDoc,
    })

    // Store root provider under a special key
    const providers = new Map(get()._providers)
    providers.set('__root__', provider)
    set({ _providers: providers })

    return sessionId
  },

  // ── Join an existing session as peer ─────────────────────────────────────────
  joinSession: async (sessionId, myName) => {
    const { stopSession } = get()
    stopSession()

    set({ isConnecting: true, error: '' })

    const roomName = `codedroid-${sessionId.trim()}`
    const myColor  = get().myColor

    const session: CollabSession = {
      id:         sessionId,
      isHost:     false,
      roomName,
      startedAt:  Date.now(),
      project:    '',
    }

    const rootDoc = new Y.Doc()
    const provider = new WebrtcProvider(roomName, rootDoc, {
      signaling: SIGNALING_SERVERS,
    })

    provider.awareness.setLocalStateField('user', {
      name:       myName,
      color:      myColor,
      avatar:     initials(myName),
      activePath: '',
      cursor:     null,
      isHost:     false,
      joinedAt:   Date.now(),
    })

    provider.awareness.on('change', () => {
      _updatePeers(provider, set)
    })

    // Wait up to 8s for at least one peer (the host) to appear
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => resolve(), 8000)
      const check = setInterval(() => {
        const states = Array.from(provider.awareness.getStates().values())
        if (states.length > 1) {
          clearInterval(check)
          clearTimeout(timeout)
          resolve()
        }
      }, 500)
    })

    const providers = new Map(get()._providers)
    providers.set('__root__', provider)

    set({
      session,
      isConnecting: false,
      error:        '',
      myName,
      _rootDoc:     rootDoc,
      _providers:   providers,
    })
  },

  // ── Open a file in the collab session ────────────────────────────────────────
  openFileInCollab: (filePath, initialContent) => {
    const { session, _docs, _providers, myColor, myName } = get()
    if (!session) throw new Error('No active collab session')

    // Return existing doc if already open
    if (_docs.has(filePath)) return _docs.get(filePath)!

    const roomName = `${session.roomName}-file-${btoa(filePath).replace(/[^a-z0-9]/gi, '').slice(0, 20)}`
    const doc = new Y.Doc()
    const text = doc.getText('content')

    const provider = new WebrtcProvider(roomName, doc, {
      signaling: SIGNALING_SERVERS,
    })

    // Set initial content on the host (only if doc is empty)
    if (session.isHost && text.length === 0 && initialContent) {
      text.insert(0, initialContent)
    }

    // Awareness for this file's cursors
    provider.awareness.setLocalStateField('user', {
      name:   myName,
      color:  myColor,
      cursor: null,
      path:   filePath,
    })

    const newDocs = new Map(get()._docs)
    const newProviders = new Map(get()._providers)
    newDocs.set(filePath, doc)
    newProviders.set(filePath, provider)
    set({ _docs: newDocs, _providers: newProviders })

    return doc
  },

  // ── Update my cursor/presence ─────────────────────────────────────────────────
  updateMyPresence: (filePath, cursor) => {
    const { _providers, myName, myColor } = get()
    const provider = _providers.get(filePath)
    if (provider) {
      provider.awareness.setLocalStateField('user', {
        name: myName, color: myColor, cursor, path: filePath,
      })
    }
    // Also update root awareness with active file
    const root = _providers.get('__root__')
    if (root) {
      const cur = root.awareness.getLocalState()?.user || {}
      root.awareness.setLocalStateField('user', {
        ...cur, activePath: filePath,
      })
    }
  },

  // ── Get doc/provider for a file ───────────────────────────────────────────────
  getDoc:      (filePath) => get()._docs.get(filePath) ?? null,
  getProvider: (filePath) => get()._providers.get(filePath) ?? null,

  // ── Stop session and clean up all connections ─────────────────────────────────
  stopSession: () => {
    const { _providers, _docs } = get()
    for (const provider of _providers.values()) {
      try { provider.destroy() } catch {}
    }
    for (const doc of _docs.values()) {
      try { doc.destroy() } catch {}
    }
    set({
      session:      null,
      peers:        [],
      isConnecting: false,
      error:        '',
      _docs:        new Map(),
      _providers:   new Map(),
      _rootDoc:     null,
    })
  },
}))

// ── Peer list updater ──────────────────────────────────────────────────────────
function _updatePeers(
  provider: WebrtcProvider,
  set: (partial: Partial<CollabState>) => void,
) {
  const myClientId = provider.awareness.clientID
  const peers: CollabPeer[] = []

  provider.awareness.getStates().forEach((state, clientId) => {
    if (clientId === myClientId) return
    const u = state.user
    if (!u) return
    peers.push({
      clientId,
      name:       u.name || 'Anonymous',
      color:      u.color || '#888',
      avatar:     u.avatar || '??',
      activePath: u.activePath || '',
      cursor:     u.cursor || null,
      isHost:     u.isHost || false,
      joinedAt:   u.joinedAt || Date.now(),
    })
  })

  set({ peers })
}