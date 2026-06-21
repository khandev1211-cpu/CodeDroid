import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Top-level error boundary.
 *
 * Without this, any uncaught error during React's render (a bad persisted
 * setting, a theme lookup miss, window.api being called before Electron's
 * preload bridge attaches, etc.) unmounts the entire tree silently — the
 * splash screen has already been removed, #root has nothing in it, and the
 * user just sees a black window with no indication anything went wrong.
 *
 * This catches that, shows a recoverable error screen instead, and offers
 * a "Reset & Reload" action that clears persisted app state in case a
 * corrupted localStorage/electron-store value is what caused the crash.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[CodeDroid] Uncaught render error:', error, info.componentStack)
    // Make sure the splash screen clears right away to reveal this error UI,
    // instead of waiting on the 8s safety fallback in index.html.
    window.dispatchEvent(new Event('codedroid-app-ready'))
  }

  handleReload = () => {
    window.location.reload()
  }

  handleResetAndReload = () => {
    try {
      localStorage.clear()
    } catch {}
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          position: 'fixed', inset: 0, background: '#1e1e1e', color: '#cccccc',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'sans-serif', gap: 16, padding: 24, textAlign: 'center', zIndex: 999999,
        }}
      >
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h1 style={{ fontWeight: 300, fontSize: 20, margin: 0 }}>CodeDroid hit a startup error</h1>
        <p style={{ color: '#888', fontSize: 13, maxWidth: 480, margin: 0 }}>
          {this.state.error?.message || 'An unknown error occurred while loading the app.'}
        </p>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button
            onClick={this.handleReload}
            style={{
              background: '#0078d4', color: '#fff', border: 'none', borderRadius: 4,
              padding: '8px 16px', fontSize: 13, cursor: 'pointer',
            }}
          >
            Reload
          </button>
          <button
            onClick={this.handleResetAndReload}
            style={{
              background: 'transparent', color: '#ccc', border: '1px solid #444', borderRadius: 4,
              padding: '8px 16px', fontSize: 13, cursor: 'pointer',
            }}
          >
            Reset Settings & Reload
          </button>
        </div>
        <p style={{ color: '#555', fontSize: 11, marginTop: 16 }}>
          If this keeps happening, open DevTools (Ctrl+Shift+I) to see the full error in the console.
        </p>
      </div>
    )
  }
}