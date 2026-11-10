import { LIVE_REFRESH_MS } from '../liveRefresh.js';

/** Baseline live-fleet HTTP poll (idle map — no active pins). */
export const FLEET_LIVE_POLL_MS = LIVE_REFRESH_MS;

/**
 * Fast poll while pins are (or were just) on the map so Τέλος βάρδιας
 * clears within ~1s even when WebSocket egress is unavailable.
 */
export const FLEET_LIVE_POLL_ACTIVE_MS = 1000;

/** Always clamp to known fleet intervals. */
export function clampFleetLivePollMs(ms) {
  const n = Number(ms);
  if (n === FLEET_LIVE_POLL_ACTIVE_MS) return FLEET_LIVE_POLL_ACTIVE_MS;
  return FLEET_LIVE_POLL_MS;
}

/** Pick poll interval from whether the map currently shows live vehicles. */
export function fleetPollMsForVehicleCount(count) {
  return Number(count) > 0 ? FLEET_LIVE_POLL_ACTIVE_MS : FLEET_LIVE_POLL_MS;
}
