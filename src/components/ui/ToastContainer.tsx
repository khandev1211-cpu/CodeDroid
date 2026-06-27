import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react'
import { useNotifStore, Notification, NotifKind } from '../../lib/notifications'

const KIND_CONFIG: Record<NotifKind, { color: string; bg: string; Icon: any }> = {
  success: { color: 'var(--git-added)',    bg: 'rgba(78,201,176,0.10)', Icon: CheckCircle2  },
  error:   { color: 'var(--git-deleted)',  bg: 'rgba(244,71,71,0.10)',  Icon: XCircle       },
  info:    { color: 'var(--accent)',       bg: 'rgba(86,156,214,0.10)', Icon: Info          },
  warning: { color: 'var(--git-modified)', bg: 'rgba(215,186,125,0.10)',Icon: AlertTriangle },
}

function Toast({ notif, onDismiss }: { notif: Notification; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)
  const cfg = KIND_CONFIG[notif.kind]
  const { Icon } = cfg

  useEffect(() => {
    // Slide in
    const t = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(t)
  }, [])

  const handleDismiss = () => {
    setVisible(false)
    setTimeout(onDismiss, 200)
  }

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 10,
        padding: '10px 12px',
        background: `var(--bg-panel)`,
        border: `1px solid ${cfg.color}40`,
        borderLeft: `3px solid ${cfg.color}`,
        borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        minWidth: 260, maxWidth: 360,
        transform: visible ? 'translateX(0)' : 'translateX(120%)',
        opacity: visible ? 1 : 0,
        transition: 'transform 0.2s ease, opacity 0.2s ease',
        marginBottom: 8,
      }}
    >
      <Icon size={15} style={{ color: cfg.color, flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
          {notif.title}
        </div>
        {notif.body && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.5 }}>
            {notif.body}
          </div>
        )}
      </div>
      <button
        onClick={handleDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 1, flexShrink: 0 }}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const { items, dismiss } = useNotifStore()

  if (items.length === 0) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 30,
      right: 16,
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column-reverse',
      pointerEvents: 'none',
    }}>
      {items.map(n => (
        <div key={n.id} style={{ pointerEvents: 'all' }}>
          <Toast notif={n} onDismiss={() => dismiss(n.id)} />
        </div>
      ))}
    </div>
  )
}