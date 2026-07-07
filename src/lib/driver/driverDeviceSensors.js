/**
 * Mobile device sensors available to the Driver PWA (Battery, network, motion).
 */

let motionPermission = null;

export function isBatteryApiSupported() {
  return typeof navigator !== 'undefined' && 'getBattery' in navigator;
}

export function isNetworkInfoSupported() {
  return typeof navigator !== 'undefined' && 'connection' in navigator;
}

export function isMotionSupported() {
  return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
}

export async function requestMotionPermission() {
  if (!isMotionSupported()) return false;
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    if (motionPermission === true) return true;
    try {
      const result = await DeviceMotionEvent.requestPermission();
      motionPermission = result === 'granted';
      return motionPermission;
    } catch {
      motionPermission = false;
      return false;
    }
  }
  motionPermission = true;
  return true;
}

function readNetworkInfo() {
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!conn) return null;
  return {
    effective_type: conn.effectiveType || null,
    downlink_mbps: conn.downlink != null ? conn.downlink : null,
    rtt_ms: conn.rtt != null ? conn.rtt : null,
    save_data: conn.saveData === true,
  };
}

function readOrientation(event) {
  if (!event) return null;
  return {
    alpha: event.alpha != null ? Math.round(event.alpha * 10) / 10 : null,
    beta: event.beta != null ? Math.round(event.beta * 10) / 10 : null,
    gamma: event.gamma != null ? Math.round(event.gamma * 10) / 10 : null,
    absolute: event.absolute === true,
  };
}

function readAcceleration(event) {
  const acc = event?.accelerationIncludingGravity || event?.acceleration;
  if (!acc) return null;
  return {
    x: acc.x != null ? Math.round(acc.x * 100) / 100 : null,
    y: acc.y != null ? Math.round(acc.y * 100) / 100 : null,
    z: acc.z != null ? Math.round(acc.z * 100) / 100 : null,
  };
}

/**
 * @returns {Promise<object|null>}
 */
export async function readBatterySnapshot() {
  if (!isBatteryApiSupported()) return null;
  try {
    const battery = await navigator.getBattery();
    return {
      level_pct: Math.round(battery.level * 100),
      charging: battery.charging === true,
    };
  } catch {
    return null;
  }
}

/**
 * Start watching motion/orientation; callback receives merged sensor snapshot.
 * @returns {() => void}
 */
export function startDeviceSensorWatch(onUpdate) {
  let latest = {
    battery: null,
    network: readNetworkInfo(),
    orientation: null,
    acceleration: null,
  };

  const emit = () => onUpdate?.({ ...latest });

  const onMotion = (event) => {
    latest.acceleration = readAcceleration(event);
    emit();
  };

  const onOrientation = (event) => {
    latest.orientation = readOrientation(event);
    emit();
  };

  let batteryPollId = null;
  let batteryObj = null;

  const refreshBattery = async () => {
    latest.battery = await readBatterySnapshot();
    emit();
  };

  refreshBattery();
  batteryPollId = window.setInterval(refreshBattery, 30_000);

  if (motionPermission) {
    window.addEventListener('devicemotion', onMotion, { passive: true });
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
  }

  const networkPollId = window.setInterval(() => {
    latest.network = readNetworkInfo();
    emit();
  }, 15_000);

  emit();

  return () => {
    window.clearInterval(batteryPollId);
    window.clearInterval(networkPollId);
    window.removeEventListener('devicemotion', onMotion);
    window.removeEventListener('deviceorientation', onOrientation);
    if (batteryObj?.removeEventListener) {
      batteryObj.removeEventListener('levelchange', refreshBattery);
      batteryObj.removeEventListener('chargingchange', refreshBattery);
    }
  };
}

export async function readDeviceSensorSnapshot() {
  const snapshot = {
    battery: await readBatterySnapshot(),
    network: readNetworkInfo(),
    orientation: null,
    acceleration: null,
  };
  return snapshot;
}
