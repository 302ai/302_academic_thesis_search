import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://e0am-academic.havethefeb.autos',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "./build",
    emptyOutDir: true
  }
})
