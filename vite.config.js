import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

const API_TARGET = process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8001'

const ACHILLIO_DOC_TITLE = 'Achillio Travel — Εκδρομές με λεωφορείο'
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

  const ACHILLIO_DESC =
    'Achillio Travel — εκδρομές με λεωφορείο στην Ελλάδα. Κράτηση θέσης, εισιτήρια και My Wallet στο achilliotravel.com.'
  const POREIAGO_DESC =
    'PoreiaGo — πλατφόρμα κρατήσεων, στόλου και wallet για ταξιδιωτικά γραφεία.'
  const ACHILLIO_LD = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TravelAgency',
    name: 'Achillio Travel',
    url: 'https://www.achilliotravel.com/',
    description: ACHILLIO_DESC,
  })

  let achillioHtml = poreiagoHtml.split(POREIAGO_DOC_TITLE).join(ACHILLIO_DOC_TITLE)
  achillioHtml = achillioHtml.split(POREIAGO_DESC).join(ACHILLIO_DESC)
  achillioHtml = achillioHtml.replace(
    /name="application-name" content="PoreiaGo"/g,
    'name="application-name" content="Achillio Travel"',
  )
  achillioHtml = achillioHtml.replace(
    /property="og:site_name" content="PoreiaGo"/g,
    'property="og:site_name" content="Achillio Travel"',
  )
  if (!achillioHtml.includes('rel="canonical"')) {
    achillioHtml = achillioHtml.replace(
      '</title>',
      '</title>\n    <link rel="canonical" href="https://www.achilliotravel.com/" />',
    )
  }
  if (!achillioHtml.includes('application/ld+json')) {
    achillioHtml = achillioHtml.replace(
      '</head>',
      `    <script type="application/ld+json">${ACHILLIO_LD}</script>\n    <noscript><h1>Achillio Travel</h1><p>${ACHILLIO_DESC}</p></noscript>\n  </head>`,
    )
  }
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
