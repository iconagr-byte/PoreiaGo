#!/usr/bin/env node
/**
 * Sync PoreiaGo Wallet Android project.
 * Usage:
 *   node scripts/cap-wallet-sync.mjs
 *       Default: live WebView at achilliotravel.com — Google Sign-In works
 *       (authorized JS origin). Avoids Capacitor https://localhost origin_mismatch.
 *   node scripts/cap-wallet-sync.mjs --live [URL]
 *       Same, optional custom URL (default /wallet entry).
 *   node scripts/cap-wallet-sync.mjs --packaged
 *       Offline dist only. Requires https://localhost in Google Console origins.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = path.join(root, 'capacitor.config.json');
const args = process.argv.slice(2);

const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const packagedServer = {
  androidScheme: 'https',
  allowNavigation: [
    'https://www.achilliotravel.com/*',
    'https://achilliotravel.com/*',
    'https://www.poreiago.com/*',
    'https://accounts.google.com/*',
    'https://*.googleusercontent.com/*',
  ],
};

const DEFAULT_LIVE = 'https://www.achilliotravel.com';
const liveIdx = args.indexOf('--live');
const wantPackaged = args.includes('--packaged');

if (wantPackaged && liveIdx < 0) {
  // Offline packaged assets — Google needs https://localhost in Cloud Console.
  cfg.server = { ...packagedServer };
} else {
  // Live office host = authorized Google JS origin (no origin_mismatch).
  let url = DEFAULT_LIVE;
  if (liveIdx >= 0) {
    url = (args[liveIdx + 1] || DEFAULT_LIVE).replace(/\/$/, '');
  }
  cfg.server = { ...packagedServer, url, cleartext: false };
}

writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(
  wantPackaged && liveIdx < 0
    ? 'Capacitor: packaged (local dist) — add https://localhost to Google Console'
    : `Capacitor: live WebView → ${cfg.server.url} (Google Sign-In OK)`,
);

const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true });
if (build.status !== 0) process.exit(build.status || 1);

const sync = spawnSync('npx', ['cap', 'sync', 'android'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(sync.status || 0);
