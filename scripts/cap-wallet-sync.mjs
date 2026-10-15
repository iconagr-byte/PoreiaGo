#!/usr/bin/env node
/**
 * Sync PoreiaGo Wallet Android project.
 * Usage:
 *   node scripts/cap-wallet-sync.mjs              # packaged dist (default)
 *   node scripts/cap-wallet-sync.mjs --packaged   # same
 *   node scripts/cap-wallet-sync.mjs --live [URL] # remote WebView (optional)
 *
 * Google Sign-In on Android uses native Credential Manager (@capgo/capacitor-social-login),
 * not GIS inside the WebView — so packaged https://localhost is fine for auth.
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

cfg.plugins = cfg.plugins || {};
cfg.plugins.SocialLogin = {
  providers: {
    google: true,
    facebook: false,
    apple: false,
    twitter: false,
  },
};

const liveIdx = args.indexOf('--live');
const wantLive = liveIdx >= 0;

if (wantLive) {
  const url = (args[liveIdx + 1] || 'https://www.achilliotravel.com').replace(/\/$/, '');
  cfg.server = { ...packagedServer, url, cleartext: false };
  console.log(`Capacitor: live WebView → ${url}`);
} else {
  cfg.server = { ...packagedServer };
  console.log('Capacitor: packaged (local dist) + native Google Sign-In');
}

writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);

const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true });
if (build.status !== 0) process.exit(build.status || 1);

const sync = spawnSync('npx', ['cap', 'sync', 'android'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
if (sync.status !== 0) process.exit(sync.status || 1);

// Fail loudly if native SocialLogin was not wired into the Android project.
const settingsGradle = readFileSync(path.join(root, 'android/capacitor.settings.gradle'), 'utf8');
const appCapacitorBuild = readFileSync(path.join(root, 'android/app/capacitor.build.gradle'), 'utf8');
const pluginsJsonPath = path.join(root, 'android/app/src/main/assets/capacitor.plugins.json');
const pluginsJson = readFileSync(pluginsJsonPath, 'utf8');
if (
  !settingsGradle.includes('capgo-capacitor-social-login') ||
  !appCapacitorBuild.includes('capgo-capacitor-social-login') ||
  !pluginsJson.includes('SocialLoginPlugin')
) {
  console.error(
    'ERROR: @capgo/capacitor-social-login not registered in Android after cap sync.\n' +
      'Check npm install and android/capacitor.settings.gradle',
  );
  process.exit(1);
}
console.log('OK: SocialLogin native plugin registered in Android');
process.exit(0);
