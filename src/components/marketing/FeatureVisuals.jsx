/**
 * Mini illustrated scenes for marketing feature cards (SVG / CSS — no stock icons alone).
 */
export function FeatureVisual({ kind }) {
  switch (kind) {
    case 'email':
      return <EmailVisual />;
    case 'qr':
      return <QrVisual />;
    case 'gps':
      return <GpsVisual />;
    case 'panel':
      return <PanelVisual />;
    case 'rent':
      return <RentVisual />;
    case 'billing':
      return <BillingVisual />;
    case 'brand':
      return <BrandVisual />;
    default:
      return <EmailVisual />;
  }
}

function SceneShell({ gradient, children }) {
  return (
    <div
      className="relative h-[132px] overflow-hidden rounded-t-[22px]"
      style={{ background: gradient }}
      aria-hidden
    >
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.35), transparent 45%), radial-gradient(circle at 85% 70%, rgba(255,255,255,0.12), transparent 40%)',
        }}
      />
      {children}
    </div>
  );
}

function EmailVisual() {
  return (
    <SceneShell gradient="linear-gradient(145deg, #3b1d6e 0%, #6d4aff 48%, #9b7bff 100%)">
      <div className="absolute inset-0 flex items-end justify-center pb-3 gap-2 px-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-[72px] rounded-xl bg-white/95 shadow-lg border border-white/60 p-2.5"
            style={{
              transform: `translateY(${(2 - i) * 6}px) rotate(${(i - 1) * 4}deg)`,
              zIndex: i + 1,
            }}
          >
            <div className="h-1.5 w-8 rounded-full bg-violet-400/80 mb-2" />
            <div className="space-y-1">
              <div className="h-1 w-full rounded bg-slate-200" />
              <div className="h-1 w-[80%] rounded bg-slate-200" />
              <div className="h-1 w-[55%] rounded bg-slate-100" />
            </div>
            <div className="mt-2 h-5 rounded-md bg-gradient-to-r from-violet-500 to-fuchsia-400" />
          </div>
        ))}
      </div>
    </SceneShell>
  );
}

function QrVisual() {
  return (
    <SceneShell gradient="linear-gradient(145deg, #0b3a66 0%, #0a84ff 55%, #5ac8fa 100%)">
      <div className="absolute inset-0 flex items-center justify-center gap-4 px-5">
        <div className="w-[88px] rounded-2xl bg-white shadow-xl p-2.5 -rotate-3">
          <div className="h-2 w-10 rounded bg-sky-400 mb-2" />
          <div className="h-1.5 w-full rounded bg-slate-200 mb-1" />
          <div className="h-1.5 w-[70%] rounded bg-slate-100 mb-3" />
          <div className="grid grid-cols-5 gap-[3px]">
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                className={`aspect-square rounded-[1px] ${
                  [0, 1, 2, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 21, 22, 24].includes(i)
                    ? 'bg-slate-900'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-11 h-11 rounded-full bg-white/20 border border-white/40 flex items-center justify-center backdrop-blur-sm">
            <span className="material-symbols-outlined text-white text-[22px]">qr_code_scanner</span>
          </div>
          <div className="h-1.5 w-14 rounded-full bg-white/50" />
        </div>
      </div>
    </SceneShell>
  );
}

function GpsVisual() {
  return (
    <SceneShell gradient="linear-gradient(160deg, #064e3b 0%, #059669 45%, #34d399 100%)">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 132" fill="none" aria-hidden>
        <path
          d="M20 98 C70 88, 90 40, 140 48 C190 56, 210 100, 260 78 C280 70, 300 55, 310 40"
          stroke="rgba(255,255,255,0.45)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="6 8"
        />
        <circle cx="140" cy="48" r="7" fill="#fff" />
        <circle cx="140" cy="48" r="14" fill="rgba(255,255,255,0.2)" />
        <rect x="228" y="58" width="52" height="28" rx="8" fill="rgba(255,255,255,0.95)" />
        <text x="254" y="76" textAnchor="middle" fill="#047857" fontSize="11" fontWeight="700">
          12′
        </text>
      </svg>
      <div className="absolute bottom-3 left-4 right-4 flex gap-2">
        <div className="flex-1 rounded-xl bg-white/95 px-3 py-2 shadow-md">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold text-slate-800">Λεωφορείο · ενεργό</span>
          </div>
        </div>
        <div className="rounded-xl bg-emerald-900/40 border border-white/20 px-3 py-2 text-[11px] font-semibold text-white backdrop-blur-sm">
          Ζωντανά
        </div>
      </div>
    </SceneShell>
  );
}

function PanelVisual() {
  return (
    <SceneShell gradient="linear-gradient(145deg, #1e1b4b 0%, #4338ca 50%, #818cf8 100%)">
      <div className="absolute inset-x-4 top-4 bottom-3 rounded-xl bg-white/95 shadow-xl overflow-hidden border border-white/70">
        <div className="h-6 bg-slate-100 border-b border-slate-200 flex items-center gap-1.5 px-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="ml-2 h-1.5 w-16 rounded bg-slate-300" />
        </div>
        <div className="p-2.5 grid grid-cols-3 gap-1.5">
          {['Εκδρομές', 'Στόλος', 'Email'].map((label, i) => (
            <div
              key={label}
              className={`rounded-lg p-2 ${i === 0 ? 'bg-indigo-50 ring-1 ring-indigo-200' : 'bg-slate-50'}`}
            >
              <div className={`h-1.5 w-8 rounded mb-1.5 ${i === 0 ? 'bg-indigo-400' : 'bg-slate-300'}`} />
              <div className="text-[9px] font-bold text-slate-600 leading-none">{label}</div>
            </div>
          ))}
          <div className="col-span-3 h-8 rounded-lg bg-gradient-to-r from-indigo-100 to-sky-50 border border-indigo-100 flex items-center px-2 gap-2">
            <div className="h-4 w-4 rounded bg-indigo-400/80" />
            <div className="flex-1 space-y-1">
              <div className="h-1 w-full rounded bg-indigo-200/80" />
              <div className="h-1 w-2/3 rounded bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    </SceneShell>
  );
}

function RentVisual() {
  return (
    <SceneShell gradient="linear-gradient(145deg, #134e4a 0%, #0d9488 48%, #5eead4 100%)">
      <div className="absolute inset-0 flex items-center justify-center">
        <svg width="200" height="90" viewBox="0 0 200 90" fill="none" aria-hidden>
          <ellipse cx="100" cy="78" rx="70" ry="8" fill="rgba(0,0,0,0.18)" />
          <path
            d="M38 58 L48 34 C50 28 54 26 62 26 H128 C138 26 144 30 148 38 L162 58 Z"
            fill="rgba(255,255,255,0.95)"
          />
          <path d="M62 26 L70 42 H118 L128 26" fill="rgba(13,148,136,0.25)" />
          <rect x="52" y="48" width="96" height="12" rx="3" fill="#0f766e" />
          <circle cx="64" cy="62" r="10" fill="#134e4a" />
          <circle cx="64" cy="62" r="4" fill="#99f6e4" />
          <circle cx="138" cy="62" r="10" fill="#134e4a" />
          <circle cx="138" cy="62" r="4" fill="#99f6e4" />
          <circle cx="168" cy="28" r="10" fill="#fbbf24" stroke="#fff" strokeWidth="2" />
          <path d="M168 22 v8 M164 28 h8" stroke="#134e4a" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <div className="absolute bottom-3 right-4 rounded-full bg-white/95 text-[11px] font-bold text-teal-800 px-3 py-1 shadow-md">
        SOS · 24/7
      </div>
    </SceneShell>
  );
}

function BillingVisual() {
  return (
    <SceneShell gradient="linear-gradient(145deg, #78350f 0%, #d97706 50%, #fbbf24 100%)">
      <div className="absolute inset-0 flex items-center justify-center gap-3 px-5">
        <div className="w-[100px] rounded-2xl bg-white shadow-xl p-3 -rotate-2 border border-amber-100">
          <div className="text-[10px] font-bold text-amber-700 mb-1">ΕΠΑΓΓΕΛΜΑΤΙΚΟ</div>
          <div className="text-xl font-black text-slate-900 tracking-tight">
            89€<span className="text-xs font-semibold text-slate-500">/μήνα</span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="h-1 rounded bg-amber-200" />
            <div className="h-1 w-4/5 rounded bg-slate-100" />
          </div>
        </div>
        <div className="w-[72px] rounded-2xl bg-amber-950/35 border border-white/25 backdrop-blur-sm p-3 text-white rotate-3">
          <div className="text-[9px] font-semibold text-amber-100/80 mb-1">Ετήσιο</div>
          <div className="text-sm font-black">−2 μήνες</div>
          <div className="mt-2 h-6 rounded-lg bg-white/15 flex items-center justify-center text-[10px] font-bold">
            Εξοικονόμηση
          </div>
        </div>
      </div>
    </SceneShell>
  );
}

function BrandVisual() {
  return (
    <SceneShell gradient="linear-gradient(145deg, #881337 0%, #e11d48 48%, #fb7185 100%)">
      <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
        <div className="w-[118px] rounded-2xl bg-white shadow-xl overflow-hidden -rotate-1 border border-white/80">
          <div className="h-8 bg-gradient-to-r from-rose-500 to-orange-400 flex items-center px-2.5 gap-1.5">
            <span className="w-4 h-4 rounded-full bg-white/90" />
            <span className="h-1.5 w-12 rounded bg-white/70" />
          </div>
          <div className="p-2 space-y-1.5">
            <div className="h-8 rounded-lg bg-rose-50 border border-rose-100" />
            <div className="grid grid-cols-2 gap-1">
              <div className="h-6 rounded bg-slate-100" />
              <div className="h-6 rounded bg-slate-100" />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {['#e11d48', '#0ea5e9', '#10b981', '#f59e0b'].map((c) => (
            <span
              key={c}
              className="w-7 h-7 rounded-full shadow-md ring-2 ring-white/50"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </SceneShell>
  );
}
