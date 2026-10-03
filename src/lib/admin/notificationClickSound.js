/** Short classic UI click / chime for new admin notifications. */

let sharedCtx = null;

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AC();
  }
  return sharedCtx;
}

/** Unlock audio on first user gesture (browsers block autoplay). */
export function unlockNotificationAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

function tone(ctx, { freq, start, dur, peak = 0.16, type = 'sine' }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

/** Soft click for generic inbox rows. */
export function playNotificationClick() {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const t0 = ctx.currentTime;
    tone(ctx, { freq: 1400, start: t0, dur: 0.09, peak: 0.14, type: 'square' });
  } catch {
    /* audio unavailable */
  }
}

/** Louder two-note chime when a driver connects / starts shift. */
export function playDriverConnectChime() {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    const t0 = ctx.currentTime;
    tone(ctx, { freq: 880, start: t0, dur: 0.16, peak: 0.22, type: 'sine' });
    tone(ctx, { freq: 1175, start: t0 + 0.14, dur: 0.22, peak: 0.2, type: 'sine' });
  } catch {
    /* audio unavailable */
  }
}
