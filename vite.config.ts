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
  },
  define: {
    // So Monaco editor works correctly
    global: 'globalThis',
  }
})