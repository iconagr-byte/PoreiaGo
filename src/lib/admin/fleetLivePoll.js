/** Minimum live-fleet HTTP poll interval (admin map / markers). */
export const FLEET_LIVE_POLL_MS = 5000;

export function clampFleetLivePollMs(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return FLEET_LIVE_POLL_MS;
  return Math.max(FLEET_LIVE_POLL_MS, Math.floor(n));
}
