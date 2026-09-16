import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

const API_TARGET = process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8001'

const ACHILLIO_DOC_TITLE = 'Achillio Travel'
const POREIAGO_DOC_TITLE = 'PoreiaGo — Πλατφόρμα για ταξιδιωτικά γραφεία'

/**
 * Googlebot reads static <title>. Contabo often ignores Host-based shells, so:
 * - index.poreiago.html keeps PoreiaGo marketing title
 * - index.html + index.achillio.html get Achillio Travel (safe default SERP)
 */
function writeAchillioSpaShell() {
  const indexPath = path.resolve('dist/index.html')
  if (!fs.existsSync(indexPath)) return
  const poreiagoHtml = fs.readFileSync(indexPath, 'utf8')
  fs.writeFileSync(path.resolve('dist/index.poreiago.html'), poreiagoHtml)

  let achillioHtml = poreiagoHtml.split(POREIAGO_DOC_TITLE).join(ACHILLIO_DOC_TITLE)
  achillioHtml = achillioHtml.replace(
    /name="application-name" content="PoreiaGo"/g,
    `name="application-name" content="${ACHILLIO_DOC_TITLE}"`,
  )
  if (!achillioHtml.includes(`<title>${ACHILLIO_DOC_TITLE}</title>`)) {
    throw new Error('achillio-spa-shell: failed to rewrite document title')
  }
  fs.writeFileSync(path.resolve('dist/index.achillio.html'), achillioHtml)
  // Default index.html → Achillio so SERP is correct even when Host routing fails.
  fs.writeFileSync(indexPath, achillioHtml)
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'pwa-service-worker-allowed',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0] || ''
          if (url === '/rental-pwa/sw.js') {
            res.setHeader('Service-Worker-Allowed', '/rent')
          } else if (url === '/wallet-pwa/sw.js') {
            res.setHeader('Service-Worker-Allowed', '/wallet')
          }
          next()
        })
      },
    },
    {
      name: 'achillio-spa-shell',
      closeBundle() {
        writeAchillioSpaShell()
      },
    },
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
      '/api/admin/push': { target: API_TARGET, changeOrigin: true },
      '/api/admin/platform/fleet-rental': { target: API_TARGET, changeOrigin: true },
      '/api/passenger': { target: API_TARGET, changeOrigin: true },
      '/api/tickets': { target: API_TARGET, changeOrigin: true },
      '/api/abandoned': { target: API_TARGET, changeOrigin: true },
      '/api/branding': { target: API_TARGET, changeOrigin: true },
      '/api/site': { target: API_TARGET, changeOrigin: true },
      '/api/notifications': { target: API_TARGET, changeOrigin: true },
      '/api/auth': { target: API_TARGET, changeOrigin: true },
      '/api/push': { target: API_TARGET, changeOrigin: true },
      '/api/customer': { target: API_TARGET, changeOrigin: true },
      '/api/lost-items': { target: API_TARGET, changeOrigin: true },
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
