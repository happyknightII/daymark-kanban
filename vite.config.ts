import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.DAYMARK_BASE_PATH || '/',
  plugins: [react()],
  preview: {
    allowedHosts: process.env.DAYMARK_ALLOWED_HOST ? [process.env.DAYMARK_ALLOWED_HOST] : [],
  },
})
