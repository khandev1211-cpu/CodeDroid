/**
 * notifications.ts — lightweight toast notification system for CodeDroid v4.
 *
 * Usage anywhere:
 *   import { notify } from '../lib/notifications'
 *   notify.success('File saved')
 *   notify.error('Build failed', 'Check the terminal for details')
 *   notify.info('Agent started a new task')
 *   notify.warning('API key not set')
 */

import { create } from 'zustand'

export type NotifKind = 'success' | 'error' | 'info' | 'warning'

export interface Notification {
  id: string
  kind: NotifKind
  title: string
  body?: string
  duration: number    // ms, 0 = sticky
  createdAt: number
}

interface NotifState {
  items: Notification[]
  push: (n: Omit<Notification, 'id' | 'createdAt'>) => string
  dismiss: (id: string) => void
  clear: () => void
}

export const useNotifStore = create<NotifState>((set) => ({
  items: [],

  push: (n) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const notif: Notification = { ...n, id, createdAt: Date.now() }
    set(s => ({ items: [...s.items.slice(-9), notif] }))   // max 10 toasts
    if (n.duration > 0) {
      setTimeout(() => {
        set(s => ({ items: s.items.filter(x => x.id !== id) }))
      }, n.duration)
    }
    return id
  },

  dismiss: (id) => set(s => ({ items: s.items.filter(x => x.id !== id) })),
  clear:   ()   => set({ items: [] }),
}))

// ── Convenience API ────────────────────────────────────────────────────────────
const push = (kind: NotifKind, title: string, body?: string, duration = 4000) =>
  useNotifStore.getState().push({ kind, title, body, duration })

export const notify = {
  success: (title: string, body?: string, duration = 3000) => push('success', title, body, duration),
  error:   (title: string, body?: string, duration = 6000) => push('error',   title, body, duration),
  info:    (title: string, body?: string, duration = 4000) => push('info',    title, body, duration),
  warning: (title: string, body?: string, duration = 5000) => push('warning', title, body, duration),
  sticky:  (kind: NotifKind, title: string, body?: string) => push(kind, title, body, 0),
  dismiss: (id: string) => useNotifStore.getState().dismiss(id),
}