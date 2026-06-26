/**
 * sidecar.ts — single source of truth for the Python sidecar URL.
 *
 * Call initSidecarPort() once at app startup (in main.tsx).
 * Then use sidecarHttp() and sidecarWs() everywhere instead of hardcoding
 * "http://127.0.0.1:8765" or "ws://127.0.0.1:8765".
 */

let _port = 8765
let _initialized = false

export async function initSidecarPort(): Promise<void> {
  if (_initialized) return
  try {
    if (typeof window !== 'undefined' && (window as any).api?.getSidecarPort) {
      _port = await (window as any).api.getSidecarPort()
    }
  } catch {
    // fall back to 8765
  }
  _initialized = true
}

export function sidecarHttp(path = ''): string {
  return `http://127.0.0.1:${_port}${path}`
}

export function sidecarWs(path = ''): string {
  return `ws://127.0.0.1:${_port}${path}`
}

export function getSidecarPort(): number {
  return _port
}