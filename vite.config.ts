import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['electron']
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    headers: {
      // Allow fetch/WebSocket to local sidecar (http://127.0.0.1:8765)
      // and Ollama (http://localhost:11434), plus cloud AI providers (https:)
      'Content-Security-Policy': [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: data: blob:",
        "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* https: wss:",
      ].join('; '),
    },
  },
  define: {
    // So Monaco editor works correctly
    global: 'globalThis',
  }
})