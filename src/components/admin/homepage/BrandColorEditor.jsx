import { useId, useRef } from 'react';

const ACCENT_PRESETS = ['#0ea5e9', '#0284c7', '#2563eb', '#0d9488', '#059669', '#ea580c', '#c9a227', '#7c3aed', '#e11d48', '#171717'];
const SECONDARY_PRESETS = ['#1e3a5f', '#0f172a', '#334155', '#0d9488', '#7c3aed', '#78350f', '#7f1d1d', '#1e293b', '#475569', '#020617'];
const SURFACE_PRESETS = ['#f8fafc', '#ffffff', '#f1f5f9', '#fffbeb', '#fff7ed', '#f0fdfa', '#faf5ff', '#fefce8', '#f8fafc', '#eef2ff'];

function normalizeHex(value, fallback = '#0ea5e9') {
  const raw = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return fallback;
}

function ColorSwatch({ label, hint, value, onChange, presets, fallback }) {
  const id = useId();
  const inputRef = useRef(null);
  const hex = normalizeHex(value, fallback);

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative block w-full h-28 sm:h-32 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
        style={{ background: hex }}
        aria-label={`Επιλογή χρώματος: ${label}`}
      >
        <span className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-80" />
        <span className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
          <span>
            <span className="block text-white font-bold text-sm drop-shadow-sm">{label}</span>
            <span className="block text-white/80 text-[11px] mt-0.5 drop-shadow-sm">{hint}</span>
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 text-slate-800 px-2.5 py-1 text-[11px] font-bold shadow-sm group-hover:bg-white">
            <span className="material-symbols-outlined text-[14px]">palette</span>
            Αλλαγή
          </span>
        </span>
        <input
          ref={inputRef}
          id={id}
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
      </button>

      <div className="p-3 space-y-2.5">
        <div className="flex flex-wrap gap-1.5">
          {presets.map((c) => {
            const active = normalizeHex(c) === hex;
            return (
              <button
                key={c}
                type="button"
                title={c}
                onClick={() => onChange(c)}
                className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  active ? 'border-slate-900 ring-2 ring-slate-900/15 scale-110' : 'border-white shadow-sm ring-1 ring-black/10'
                }`}
                style={{ background: c }}
                aria-label={`Προεπιλογή ${c}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Οπτικός επεξεργαστής brand χρωμάτων — χωρίς hex κώδικες. */
export default function BrandColorEditor({
  accent,
  secondary,
  surface,
  onChange,
  onResetTheme,
  themeName,
}) {
  const a = normalizeHex(accent, '#0ea5e9');
  const s = normalizeHex(secondary, '#1e3a5f');
  const surf = normalizeHex(surface, '#f8fafc');

  const set = (key, value) => onChange({ [key]: normalizeHex(value) });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Χρώματα</p>
          <p className="text-sm text-gray-600 mt-1">Πάτα ένα χρώμα για να το αλλάξεις. Χωρίς κώδικες — μόνο οπτική επιλογή.</p>
        </div>
        {onResetTheme && (
          <button
            type="button"
            onClick={onResetTheme}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
          >
            <span className="material-symbols-outlined text-[16px]">restart_alt</span>
            Από θέμα{themeName ? `: ${themeName}` : ''}
          </button>
        )}
      </div>

      {/* Live mini preview */}
      <div
        className="rounded-2xl overflow-hidden border border-black/[0.06] shadow-sm"
        style={{ background: surf }}
      >
        <div className="px-4 py-3 flex items-center justify-between gap-3" style={{ background: s }}>
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-7 w-7 rounded-lg bg-white/20 shrink-0" />
            <span className="h-2.5 w-24 rounded-full bg-white/40" />
          </div>
          <span
            className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold text-white shadow-sm"
            style={{ background: a }}
          >
            Κράτηση
          </span>
        </div>
        <div className="p-4 space-y-3">
          <div className="h-2 w-2/5 max-w-[40%] rounded-full" style={{ background: `${s}33` }} />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-xl bg-white border border-black/[0.05] overflow-hidden shadow-sm">
                <div className="h-10" style={{ background: i === 0 ? `${a}55` : `${s}22` }} />
                <div className="p-2 space-y-1.5">
                  <div className="h-1.5 w-full rounded bg-slate-100" />
                  <div className="h-5 rounded-lg" style={{ background: a, opacity: i === 1 ? 1 : 0.35 }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500 font-medium">Ζωντανή προεπισκόπηση χρωμάτων</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <ColorSwatch
          label="Κύριο"
          hint="Κουμπιά & links"
          value={a}
          fallback="#0ea5e9"
          presets={ACCENT_PRESETS}
          onChange={(v) => set('accent_color', v)}
        />
        <ColorSwatch
          label="Δευτερεύον"
          hint="Header & τίτλοι"
          value={s}
          fallback="#1e3a5f"
          presets={SECONDARY_PRESETS}
          onChange={(v) => set('secondary_color', v)}
        />
        <ColorSwatch
          label="Φόντο"
          hint="Φόντο σελίδας"
          value={surf}
          fallback="#f8fafc"
          presets={SURFACE_PRESETS}
          onChange={(v) => set('surface_color', v)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            onChange({ accent_color: s, secondary_color: a });
          }}
          className="inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-primary/30 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
          Ανταλλαγή κύριου ↔ δευτερεύοντος
        </button>
      </div>
    </div>
  );
}
