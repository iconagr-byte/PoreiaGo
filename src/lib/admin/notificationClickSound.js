/** Short classic UI click / chime for new admin notifications. */

let sharedCtx = null;
let unlockArmed = false;
let htmlUnlocked = false;
let lastChimeAt = 0;

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

/** Build a short mono WAV (16-bit) as a data URL — works with HTMLAudioElement. */
function buildWavDataUrl({ freq = 880, duration = 0.2, volume = 0.55 } = {}) {
  const sampleRate = 22050;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2;
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
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  for (let i = 0; i < numSamples; i += 1) {
    const t = i / sampleRate;
    const attack = Math.min(1, i / 180);
    const release = Math.min(1, (numSamples - i) / 900);
    const env = attack * release;
    const sample = Math.sin(2 * Math.PI * freq * t) * env * volume;
    const int16 = Math.max(-32768, Math.min(32767, Math.floor(sample * 32767)));
    view.setInt16(44 + i * 2, int16, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

const CLICK_WAV = (() => {
  try {
    return buildWavDataUrl({ freq: 1400, duration: 0.1, volume: 0.5 });
  } catch {
    return '';
  }
})();

const CHIME_A_WAV = (() => {
  try {
    return buildWavDataUrl({ freq: 880, duration: 0.22, volume: 0.7 });
  } catch {
    return '';
  }
})();

const CHIME_B_WAV = (() => {
  try {
    return buildWavDataUrl({ freq: 1175, duration: 0.28, volume: 0.65 });
  } catch {
    return '';
  }
})();

/**
 * Always create a fresh Audio element.
 * Reusing one element + swapping src hangs Chromium after the first play().
 * Never wait forever — race play() against a short timeout.
 */
function playHtmlUrl(url, volume = 0.85) {
  if (!url || typeof window === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const timer = window.setTimeout(() => done(false), 700);
    try {
      const audio = new Audio(url);
      audio.volume = Math.max(0, Math.min(1, volume));
      const p = audio.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          window.clearTimeout(timer);
          done(true);
          // Release element after the clip ends so GC can collect it.
          window.setTimeout(() => {
            try {
              audio.removeAttribute('src');
              audio.load();
            } catch {
              /* ignore */
            }
          }, 1200);
        }).catch(() => {
          window.clearTimeout(timer);
          done(false);
        });
      } else {
        window.clearTimeout(timer);
        done(true);
      }
    } catch {
      window.clearTimeout(timer);
      done(false);
    }
  });
}

/** Prime WebAudio during a user gesture so later alerts can ding. */
export function unlockNotificationAudio() {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (typeof window === 'undefined') return;
  // One silent HTML play unlocks autoplay for subsequent fresh Audio() calls.
  if (!htmlUnlocked && CLICK_WAV) {
    try {
      const warm = new Audio(CLICK_WAV);
      warm.volume = 0.01;
      const p = warm.play();
      if (p && typeof p.then === 'function') {
        p.then(() => {
          htmlUnlocked = true;
          try {
            warm.pause();
            warm.removeAttribute('src');
            warm.load();
          } catch {
            /* ignore */
          }
        }).catch(() => {
          /* next gesture retries */
        });
      } else {
        htmlUnlocked = true;
      }
    } catch {
      /* ignore */
    }
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
  window.addEventListener('click', unlock, { capture: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') unlockNotificationAudio();
  });
  unlockNotificationAudio();
}

async function ensureRunningCtx() {
  const AC = getAudioContextCtor();
  if (!AC) return null;
  let ctx = getCtx();
  if (!ctx) return null;
  if (ctx.state === 'suspended') {
    try {
      await Promise.race([
        ctx.resume(),
        new Promise((r) => {
          window.setTimeout(r, 400);
        }),
      ]);
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
    await Promise.race([
      ctx.resume(),
      new Promise((r) => {
        window.setTimeout(r, 400);
      }),
    ]);
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
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), start + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + dur + 0.02);
  // Disconnect after stop so nodes don't pile up and mute the graph.
  osc.onended = () => {
    try {
      osc.disconnect();
      gain.disconnect();
    } catch {
      /* ignore */
    }
  };
}

/** Soft click for generic inbox rows. */
export async function playNotificationClick() {
  unlockNotificationAudio();
  try {
    const ctx = await ensureRunningCtx();
    if (ctx) {
      const t0 = ctx.currentTime;
      tone(ctx, { freq: 1400, start: t0, dur: 0.1, peak: 0.22, type: 'square' });
      return;
    }
  } catch {
    /* ignore */
  }
  await playHtmlUrl(CLICK_WAV, 0.7);
}

/** Louder two-note chime when a driver connects / starts shift. */
export async function playDriverConnectChime() {
  const now = Date.now();
  // Only collapse double-fire from bell + telemetry in the same tick.
  if (now - lastChimeAt < 700) return;
  lastChimeAt = now;

  unlockNotificationAudio();

  let webOk = false;
  try {
    const ctx = await ensureRunningCtx();
    if (ctx) {
      const t0 = ctx.currentTime;
      tone(ctx, { freq: 880, start: t0, dur: 0.2, peak: 0.38, type: 'sine' });
      tone(ctx, { freq: 1175, start: t0 + 0.16, dur: 0.28, peak: 0.34, type: 'sine' });
      webOk = true;
    }
  } catch {
    /* ignore */
  }

  // HTML path is backup — never block on it (timeout inside playHtmlUrl).
  if (!webOk) {
    const a = await playHtmlUrl(CHIME_A_WAV, 0.9);
    window.setTimeout(() => {
      void playHtmlUrl(CHIME_B_WAV, 0.85);
    }, 150);
    if (!a) {
      window.setTimeout(() => {
        unlockNotificationAudio();
        void playHtmlUrl(CHIME_A_WAV, 0.9);
        window.setTimeout(() => void playHtmlUrl(CHIME_B_WAV, 0.85), 150);
      }, 100);
    }
  } else {
    // Soft HTML reinforcement without awaiting — avoids freeze if play() stalls.
    void playHtmlUrl(CHIME_A_WAV, 0.55);
  }
}
