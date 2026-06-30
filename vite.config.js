import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API_TARGET = process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    // Μόνο API endpoints — ΟΧΙ /admin/login ή /admin (React routes)
    proxy: {
      '/admin/scan': { target: API_TARGET, changeOrigin: true },
      '/admin/boarding': { target: API_TARGET, changeOrigin: true },
      '/admin/offline-manifest': { target: API_TARGET, changeOrigin: true },
      '/admin/sms': { target: API_TARGET, changeOrigin: true },
      '/api/driver': { target: API_TARGET, changeOrigin: true },
      '/telemetry': { target: API_TARGET, changeOrigin: true },
      '/api/v1/telemetry': { target: API_TARGET, changeOrigin: true },
      '/api/admin/telemetry': { target: API_TARGET, changeOrigin: true },
      '/api/admin/platform': { target: API_TARGET, changeOrigin: true },
      '/api/passenger': { target: API_TARGET, changeOrigin: true },
      '/api/tickets': { target: API_TARGET, changeOrigin: true },
      '/api/abandoned': { target: API_TARGET, changeOrigin: true },
      '/api/branding': { target: API_TARGET, changeOrigin: true },
      '/api/site': { target: API_TARGET, changeOrigin: true },
      '/api/notifications': { target: API_TARGET, changeOrigin: true },
      '/api/auth': { target: API_TARGET, changeOrigin: true },
      '/api/push': { target: API_TARGET, changeOrigin: true },
      '/api/customer': { target: API_TARGET, changeOrigin: true },
      '/api/bookings': { target: API_TARGET, changeOrigin: true },
      '/api/campaigns': { target: API_TARGET, changeOrigin: true },
      '/api/email': { target: API_TARGET, changeOrigin: true },
      '/api/mailbox': { target: API_TARGET, changeOrigin: true },
      '/api/track': { target: API_TARGET, changeOrigin: true },
      '/api/unsubscribe': { target: API_TARGET, changeOrigin: true },
      '/health': { target: API_TARGET, changeOrigin: true },
      '/admin/scan': { target: API_TARGET, changeOrigin: true },
      '/admin/boarding': { target: API_TARGET, changeOrigin: true },
      '/api/v1': { target: API_TARGET, changeOrigin: true },
      '/ws': { target: API_TARGET.replace(/^http/, 'ws'), ws: true },
    },
  },
  // Camera requires secure context: use http://localhost:5173 (not raw IP/file://)
})
