/**
 * Quiet mini scenes for marketing feature cards — soft gray, light accents.
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

function SceneShell({ tint = 'rgba(0, 113, 227, 0.06)', children }) {
  return (
    <div
      className="relative h-[120px] overflow-hidden border-b border-black/[0.05]"
      style={{
        background: `linear-gradient(180deg, #fafafa 0%, #f2f3f5 100%), radial-gradient(ellipse 80% 70% at 50% 0%, ${tint}, transparent 70%)`,
        backgroundBlendMode: 'normal',
      }}
      aria-hidden
    >
      {children}
    </div>
  );
}

function EmailVisual() {
  return (
    <SceneShell tint="rgba(125, 90, 232, 0.07)">
      <div className="absolute inset-0 flex items-end justify-center pb-3 gap-2 px-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-[72px] rounded-xl bg-white shadow-sm border border-black/[0.06] p-2.5"
            style={{
              transform: `translateY(${(2 - i) * 4}px)`,
              zIndex: i + 1,
              opacity: 0.85 + i * 0.07,
            }}
          >
            <div className="h-1.5 w-8 rounded-full bg-slate-300 mb-2" />
            <div className="space-y-1">
              <div className="h-1 w-full rounded bg-slate-200" />
              <div className="h-1 w-[80%] rounded bg-slate-200" />
              <div className="h-1 w-[55%] rounded bg-slate-100" />
            </div>
            <div className="mt-2 h-5 rounded-md bg-slate-800/90" />
          </div>
        ))}
      </div>
    </SceneShell>
  );
}

function QrVisual() {
  return (
    <SceneShell tint="rgba(0, 113, 227, 0.08)">
      <div className="absolute inset-0 flex items-center justify-center gap-4 px-5">
        <div className="w-[88px] rounded-2xl bg-white shadow-sm border border-black/[0.06] p-2.5">
          <div className="h-2 w-10 rounded bg-slate-300 mb-2" />
          <div className="h-1.5 w-full rounded bg-slate-200 mb-1" />
          <div className="h-1.5 w-[70%] rounded bg-slate-100 mb-3" />
          <div className="grid grid-cols-5 gap-[3px]">
            {Array.from({ length: 25 }).map((_, i) => (
              <div
                key={i}
                className={`aspect-square rounded-[1px] ${
                  [0, 1, 2, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 21, 22, 24].includes(i)
                    ? 'bg-slate-800'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-11 h-11 rounded-full bg-white border border-black/[0.08] flex items-center justify-center shadow-sm">
            <span className="material-symbols-outlined text-slate-500 text-[22px]">qr_code_scanner</span>
          </div>
          <div className="h-1.5 w-14 rounded-full bg-slate-300/80" />
        </div>
      </div>
    </SceneShell>
  );
}

function GpsVisual() {
  return (
    <SceneShell tint="rgba(31, 157, 98, 0.08)">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 120" fill="none" aria-hidden>
        <path
          d="M20 90 C70 80, 90 36, 140 44 C190 52, 210 92, 260 72 C280 64, 300 50, 310 36"
          stroke="rgba(29, 29, 31, 0.18)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="5 7"
        />
        <circle cx="140" cy="44" r="6" fill="#1d1d1f" />
        <circle cx="140" cy="44" r="12" fill="rgba(29, 29, 31, 0.08)" />
        <rect x="228" y="52" width="52" height="26" rx="8" fill="#fff" stroke="rgba(0,0,0,0.06)" />
        <text x="254" y="69" textAnchor="middle" fill="#1d1d1f" fontSize="11" fontWeight="600">
          12′
        </text>
      </svg>
      <div className="absolute bottom-3 left-4 right-4 flex gap-2">
        <div className="flex-1 rounded-xl bg-white px-3 py-2 shadow-sm border border-black/[0.06]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500/80" />
            <span className="text-[11px] font-semibold text-slate-700">Λεωφορείο · ενεργό</span>
          </div>
        </div>
        <div className="rounded-xl bg-white border border-black/[0.06] px-3 py-2 text-[11px] font-semibold text-slate-600 shadow-sm">
          Ζωντανά
        </div>
      </div>
    </SceneShell>
  );
}

function PanelVisual() {
  return (
    <SceneShell tint="rgba(79, 91, 213, 0.07)">
      <div className="absolute inset-x-4 top-4 bottom-3 rounded-xl bg-white shadow-sm overflow-hidden border border-black/[0.06]">
        <div className="h-6 bg-[#f5f5f7] border-b border-black/[0.05] flex items-center gap-1.5 px-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
          <span className="ml-2 h-1.5 w-16 rounded bg-slate-200" />
        </div>
        <div className="p-2.5 grid grid-cols-3 gap-1.5">
          {['Εκδρομές', 'Στόλος', 'Email'].map((label, i) => (
            <div
              key={label}
              className={`rounded-lg p-2 ${
                i === 0 ? 'bg-slate-100 ring-1 ring-slate-200' : 'bg-[#fafafa]'
              }`}
            >
              <div className={`h-1.5 w-8 rounded mb-1.5 ${i === 0 ? 'bg-slate-500' : 'bg-slate-300'}`} />
              <div className="text-[9px] font-semibold text-slate-600 leading-none">{label}</div>
            </div>
          ))}
          <div className="col-span-3 h-8 rounded-lg bg-[#f5f5f7] border border-black/[0.04] flex items-center px-2 gap-2">
            <div className="h-4 w-4 rounded bg-slate-300" />
            <div className="flex-1 space-y-1">
              <div className="h-1 w-full rounded bg-slate-250 bg-slate-200" />
              <div className="h-1 w-2/3 rounded bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    </SceneShell>
  );
}

function RentVisual() {
  return (
    <SceneShell tint="rgba(15, 118, 110, 0.07)">
      <div className="absolute inset-0 flex items-center justify-center">
        <svg width="200" height="90" viewBox="0 0 200 90" fill="none" aria-hidden>
          <ellipse cx="100" cy="78" rx="70" ry="8" fill="rgba(0,0,0,0.06)" />
          <path
            d="M38 58 L48 34 C50 28 54 26 62 26 H128 C138 26 144 30 148 38 L162 58 Z"
            fill="#fff"
            stroke="rgba(0,0,0,0.06)"
          />
          <path d="M62 26 L70 42 H118 L128 26" fill="rgba(29,29,31,0.06)" />
          <rect x="52" y="48" width="96" height="12" rx="3" fill="#3a3a3c" />
          <circle cx="64" cy="62" r="10" fill="#1d1d1f" />
          <circle cx="64" cy="62" r="4" fill="#d2d2d7" />
          <circle cx="138" cy="62" r="10" fill="#1d1d1f" />
          <circle cx="138" cy="62" r="4" fill="#d2d2d7" />
        </svg>
      </div>
      <div className="absolute bottom-3 right-4 rounded-full bg-white text-[11px] font-semibold text-slate-700 px-3 py-1 shadow-sm border border-black/[0.06]">
        SOS · 24/7
      </div>
    </SceneShell>
  );
}

function BillingVisual() {
  return (
    <SceneShell tint="rgba(201, 134, 10, 0.08)">
      <div className="absolute inset-0 flex items-center justify-center gap-3 px-5">
        <div className="w-[100px] rounded-2xl bg-white shadow-sm p-3 border border-black/[0.06]">
          <div className="text-[10px] font-semibold text-slate-500 mb-1 tracking-wide">ΕΠΑΓΓΕΛΜΑΤΙΚΟ</div>
          <div className="text-xl font-semibold text-[#1d1d1f] tracking-tight">
            89€<span className="text-xs font-medium text-slate-500">/μήνα</span>
          </div>
          <div className="mt-2 space-y-1">
            <div className="h-1 rounded bg-slate-200" />
            <div className="h-1 w-4/5 rounded bg-slate-100" />
          </div>
        </div>
        <div className="w-[72px] rounded-2xl bg-[#f5f5f7] border border-black/[0.06] p-3 text-slate-700">
          <div className="text-[9px] font-medium text-slate-500 mb-1">Ετήσιο</div>
          <div className="text-sm font-semibold text-[#1d1d1f]">−2 μήνες</div>
          <div className="mt-2 h-6 rounded-lg bg-white border border-black/[0.05] flex items-center justify-center text-[10px] font-semibold text-slate-600">
            Εξοικονόμηση
          </div>
        </div>
      </div>
    </SceneShell>
  );
}

function BrandVisual() {
  return (
    <SceneShell tint="rgba(232, 74, 122, 0.07)">
      <div className="absolute inset-0 flex items-center justify-center gap-3 px-4">
        <div className="w-[118px] rounded-2xl bg-white shadow-sm overflow-hidden border border-black/[0.06]">
          <div className="h-8 bg-[#1d1d1f] flex items-center px-2.5 gap-1.5">
            <span className="w-4 h-4 rounded-full bg-white/90" />
            <span className="h-1.5 w-12 rounded bg-white/50" />
          </div>
          <div className="p-2 space-y-1.5">
            <div className="h-8 rounded-lg bg-[#f5f5f7] border border-black/[0.04]" />
            <div className="grid grid-cols-2 gap-1">
              <div className="h-6 rounded bg-slate-100" />
              <div className="h-6 rounded bg-slate-100" />
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {['#86868b', '#a1a1a6', '#d2d2d7', '#1d1d1f'].map((c) => (
            <span
              key={c}
              className="w-6 h-6 rounded-full shadow-sm ring-1 ring-black/[0.06]"
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </SceneShell>
  );
}
