#!/usr/bin/env node
/**
 * DEPRECATED — legacy com.poreiago.driver package only.
 * Prefer scripts/cap-wallet-sync.mjs (unified com.poreiago.wallet + role router).
 * See docs/ANDROID-NATIVE.md.
 *
 * Sync PoreiaGo Driver Android project (parallel to Wallet).
 *
 * Usage:
 *   node scripts/cap-driver-sync.mjs              # packaged dist (default)
 *   node scripts/cap-driver-sync.mjs --packaged
 *   node scripts/cap-driver-sync.mjs --live [URL] # remote WebView (optional)
 *
 * Swaps capacitor.config.json + android/ ↔ android-driver/ around `npx cap sync`
 * so Wallet's android/ tree stays untouched after the script exits.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = path.join(root, 'capacitor.config.json');
const driverCfgPath = path.join(root, 'capacitor.driver.config.json');
const walletCfgBackup = path.join(root, '.capacitor.wallet.config.backup.json');
const androidDir = path.join(root, 'android');
const driverDir = path.join(root, 'android-driver');
const stashDir = path.join(root, '.android-wallet-stash');

const args = process.argv.slice(2);
const liveIdx = args.indexOf('--live');
const wantLive = liveIdx >= 0;

function fail(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

if (!existsSync(driverCfgPath)) {
  fail(`Missing ${driverCfgPath}`);
}
if (!existsSync(driverDir)) {
  fail(`Missing ${driverDir} — scaffold android-driver first`);
}
if (!existsSync(androidDir)) {
  fail(`Missing ${androidDir} — Wallet android project required as swap partner`);
}

const driverCfg = JSON.parse(readFileSync(driverCfgPath, 'utf8'));
const packagedServer = {
  androidScheme: 'https',
  allowNavigation: [
    'https://www.achilliotravel.com/*',
    'https://achilliotravel.com/*',
    'https://www.poreiago.com/*',
    'https://*.poreiago.com/*',
  ],
};

if (wantLive) {
  const url = (args[liveIdx + 1] || 'https://www.achilliotravel.com').replace(/\/$/, '');
  driverCfg.server = { ...packagedServer, url, cleartext: false };
  console.log(`Capacitor Driver: live WebView → ${url}`);
} else {
  driverCfg.server = { ...packagedServer };
  console.log('Capacitor Driver: packaged (local dist) → /driver');
}

writeFileSync(driverCfgPath, `${JSON.stringify(driverCfg, null, 2)}\n`);

let swapped = false;
function restore() {
  try {
    if (swapped) {
      if (existsSync(androidDir) && !existsSync(driverDir)) {
        renameSync(androidDir, driverDir);
      }
      if (existsSync(stashDir) && !existsSync(androidDir)) {
        renameSync(stashDir, androidDir);
      }
      swapped = false;
    }
  } catch (e) {
    console.error('ERROR restoring android folders:', e);
  }
  try {
    if (existsSync(walletCfgBackup)) {
      copyFileSync(walletCfgBackup, cfgPath);
      rmSync(walletCfgBackup, { force: true });
    }
  } catch (e) {
    console.error('ERROR restoring capacitor.config.json:', e);
  }
}

process.on('exit', restore);
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});
process.on('uncaughtException', (e) => {
  console.error(e);
  restore();
  process.exit(1);
});

// Backup wallet Capacitor config, install driver config as active.
if (!existsSync(cfgPath)) {
  fail(`Missing ${cfgPath}`);
}
copyFileSync(cfgPath, walletCfgBackup);
writeFileSync(cfgPath, `${JSON.stringify(driverCfg, null, 2)}\n`);

// Swap folders: android (wallet) → stash, android-driver → android
if (existsSync(stashDir)) {
  rmSync(stashDir, { recursive: true, force: true });
}
renameSync(androidDir, stashDir);
renameSync(driverDir, androidDir);
swapped = true;

const env = {
  ...process.env,
  VITE_NATIVE_APP: 'driver',
  // Default sealed office API for packaged driver (override with VITE_NATIVE_API_BASE).
  VITE_NATIVE_API_BASE:
    process.env.VITE_NATIVE_API_BASE || 'https://www.achilliotravel.com',
};

console.log('==> vite build (VITE_NATIVE_APP=driver)');
const build = spawnSync('npm', ['run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env,
});
if (build.status !== 0) {
  restore();
  process.exit(build.status || 1);
}

// Belt-and-suspenders: ensure index.html early boot seals to /driver
const indexHtml = path.join(root, 'dist', 'index.html');
if (existsSync(indexHtml)) {
  let html = readFileSync(indexHtml, 'utf8');
  html = html.replace(
    /window\.__POREIAGO_NATIVE_APP__\s*=\s*['"][^'"]*['"]/,
    "window.__POREIAGO_NATIVE_APP__ = 'driver'",
  );
  if (!html.includes("__POREIAGO_NATIVE_APP__ = 'driver'")) {
    html = html.replace(
      '<head>',
      "<head>\n    <script>window.__POREIAGO_NATIVE_APP__ = 'driver';</script>",
    );
  }
  writeFileSync(indexHtml, html);
  console.log('OK: dist/index.html marked native app = driver');
}

console.log('==> npx cap sync android (into android-driver via swap)');
const sync = spawnSync('npx', ['cap', 'sync', 'android'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
  env,
});
if (sync.status !== 0) {
  restore();
  process.exit(sync.status || 1);
}

// Verify package id landed in assets
const assetsCfg = path.join(androidDir, 'app/src/main/assets/capacitor.config.json');
if (!existsSync(assetsCfg)) {
  restore();
  fail('cap sync did not write android/app/src/main/assets/capacitor.config.json');
}
const assets = JSON.parse(readFileSync(assetsCfg, 'utf8'));
if (assets.appId !== 'com.poreiago.driver') {
  restore();
  fail(`Expected appId com.poreiago.driver, got ${assets.appId}`);
}

const publicDir = path.join(androidDir, 'app/src/main/assets/public');
mkdirSync(publicDir, { recursive: true });
const jsHit = spawnSync(
  'grep',
  ['-R', '-l', 'DriverCommandCenter\\|driver-route\\|/driver', publicDir],
  { encoding: 'utf8' },
);
// soft check — grep may miss minified names; look for VITE flavor marker instead
const flavorHit = spawnSync(
  'grep',
  ['-R', '-l', 'poreiago-native-driver\\|__POREIAGO_NATIVE_APP__\\|driver-native', publicDir],
  { encoding: 'utf8' },
);
if (jsHit.status !== 0 && flavorHit.status !== 0) {
  // Still OK if index has driver marker
  const pubIndex = path.join(publicDir, 'index.html');
  if (!existsSync(pubIndex) || !readFileSync(pubIndex, 'utf8').includes("driver")) {
    console.warn('WARN: could not confirm driver markers in packaged assets');
  }
}
console.log('OK: Driver Capacitor assets synced (com.poreiago.driver)');

restore();
console.log('DONE: android-driver ready; Wallet android/ restored');
process.exit(0);
