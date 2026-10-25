import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://guitar-except-divorce-mem.trycloudflare.com',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
