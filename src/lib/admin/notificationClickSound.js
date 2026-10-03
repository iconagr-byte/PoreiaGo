/** Short classic UI click / chime for new admin notifications. */

let sharedCtx = null;
let unlockArmed = false;

function getAudioContextCtor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function getCtx() {
  const AC = getAudioContextCtor();
  if (!AC) return null;
  if (!sharedCtx || sharedCtx.state === 'closed') {
    sharedCtx = new AC();
  }
  return sharedCtx;
}

/** Keep AudioContext unlocked — browsers re-suspend after idle / tab blur. */
export function unlockNotificationAudio() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
}

/** Call once from admin shell so any click/key keeps audio ready. */
export function armNotificationAudioUnlock() {
  if (typeof window === 'undefined' || unlockArmed) return;
  unlockArmed = true;
  const unlock = () => unlockNotificationAudio();
  window.addEventListener('pointerdown', unlock, { capture: true });
  window.addEventListener('keydown', unlock, { capture: true });
  window.addEventListener('touchstart', unlock, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockNotificationAudio();
  });
  // Warm context if a gesture already happened this page load.
  unlockNotificationAudio();
}

async function ensureRunningCtx() {
  const AC = getAudioContextCtor();
  if (!AC) return null;
  let ctx = getCtx();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* ignore */
    }
  }
  if (ctx.state === 'running') return ctx;
  // Recreate — suspended contexts sometimes never resume after long idle.
  try {
    await ctx.close();
  } catch {
    /* ignore */
  }
  sharedCtx = new AC();
  ctx = sharedCtx;
  try {
    await ctx.resume();
  } catch {
    /* ignore */
  }
  return ctx.state === 'running' ? ctx : null;
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

/** Tiny WAV beep when WebAudio stays suspended (no user gesture yet). */
function playHtmlBeepFallback() {
  try {
    // 0.18s 880Hz sine, 8-bit mono 22kHz — short enough for repeated alerts.
    const sampleRate = 22050;
    const duration = 0.18;
    const numSamples = Math.floor(sampleRate * duration);
    const dataSize = numSamples;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
    };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);
    for (let i = 0; i < numSamples; i += 1) {
      const t = i / sampleRate;
      const env = Math.min(1, i / 200) * Math.min(1, (numSamples - i) / 800);
      const sample = Math.sin(2 * Math.PI * 880 * t) * env;
      view.setUint8(44 + i, Math.max(0, Math.min(255, Math.floor(sample * 100 + 128))));
    }
    const blob = new Blob([buffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = 0.55;
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.catch(() => {}).finally(() => URL.revokeObjectURL(url));
    } else {
      URL.revokeObjectURL(url);
    }
  } catch {
    /* ignore */
  }
}

/** Soft click for generic inbox rows. */
export async function playNotificationClick() {
  try {
    const ctx = await ensureRunningCtx();
    if (!ctx) {
      playHtmlBeepFallback();
      return;
    }
    const t0 = ctx.currentTime;
    tone(ctx, { freq: 1400, start: t0, dur: 0.09, peak: 0.14, type: 'square' });
  } catch {
    playHtmlBeepFallback();
  }
}

/** Louder two-note chime when a driver connects / starts shift. */
export async function playDriverConnectChime() {
  try {
    const ctx = await ensureRunningCtx();
    if (!ctx) {
      playHtmlBeepFallback();
      // Second note via delayed fallback.
      window.setTimeout(() => playHtmlBeepFallback(), 160);
      return;
    }
    const t0 = ctx.currentTime;
    tone(ctx, { freq: 880, start: t0, dur: 0.16, peak: 0.25, type: 'sine' });
    tone(ctx, { freq: 1175, start: t0 + 0.14, dur: 0.24, peak: 0.22, type: 'sine' });
  } catch {
    playHtmlBeepFallback();
  }
}
