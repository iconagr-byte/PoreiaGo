import { LIVE_REFRESH_MS } from '../liveRefresh.js';

/** Locked live-fleet HTTP poll interval (admin map / markers). */
export const FLEET_LIVE_POLL_MS = LIVE_REFRESH_MS;

/** Always 5s — callers cannot override. */
export function clampFleetLivePollMs(_ms) {
  return FLEET_LIVE_POLL_MS;
}
