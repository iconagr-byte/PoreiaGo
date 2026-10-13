#!/usr/bin/env node
/**
 * Sync PoreiaGo Wallet Android project.
 * Usage:
 *   node scripts/cap-wallet-sync.mjs              # packaged My Wallet (default)
 *   node scripts/cap-wallet-sync.mjs --packaged   # same — remove server.url (use dist)
 *   node scripts/cap-wallet-sync.mjs --live URL   # optional live WebView (not recommended)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cfgPath = path.join(root, 'capacitor.config.json');
const args = process.argv.slice(2);

const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
const liveIdx = args.indexOf('--live');
if (liveIdx >= 0) {
  const url = (args[liveIdx + 1] || 'https://www.achilliotravel.com/wallet').replace(
    /\/$/,
    '',
  );
  cfg.server = { url, cleartext: false };
} else {
  // Default: packaged local dist — My Wallet only, not the live website.
  delete cfg.server;
}

writeFileSync(cfgPath, `${JSON.stringify(cfg, null, 2)}\n`);

const build = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', shell: true });
if (build.status !== 0) process.exit(build.status || 1);

const sync = spawnSync('npx', ['cap', 'sync', 'android'], {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});
process.exit(sync.status || 0);
