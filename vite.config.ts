import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.DAYMARK_BASE_PATH || '/',
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:5176' },
  },
  preview: {
    allowedHosts: process.env.DAYMARK_ALLOWED_HOST ? [process.env.DAYMARK_ALLOWED_HOST] : [],
  },
})
