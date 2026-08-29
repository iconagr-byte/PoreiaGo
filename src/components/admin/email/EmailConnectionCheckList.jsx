/**
 * Visual checklist for email connection «Έλεγχος».
 */
const STATUS = {
  ok: {
    icon: '✓',
    ring: 'bg-emerald-500 text-white',
    row: 'border-emerald-100 bg-emerald-50/70',
    detail: 'text-emerald-800',
  },
  fail: {
    icon: '✕',
    ring: 'bg-rose-500 text-white',
    row: 'border-rose-100 bg-rose-50/70',
    detail: 'text-rose-800',
  },
  skip: {
    icon: '–',
    ring: 'bg-[#d2d2d7] text-[#6e6e73]',
    row: 'border-transparent bg-[#f5f5f7]/90',
    detail: 'text-[#86868b]',
  },
  running: {
    icon: '●',
    ring: 'bg-[#0071e3] text-white animate-pulse',
    row: 'border-[#0071e3]/15 bg-[#0071e3]/[0.06]',
    detail: 'text-[#0071e3]',
  },
  pending: {
    icon: '○',
    ring: 'bg-white text-[#aeaeb2] border border-[#d2d2d7]',
    row: 'border-transparent bg-[#f5f5f7]/70',
    detail: 'text-[#86868b]',
  },
};

export default function EmailConnectionCheckList({
  checks = [],
  testing = false,
  title,
} = {}) {
  if (!checks.length && !testing) return null;

  const done = checks.filter((c) => c.status === 'ok' || c.status === 'fail').length;
  const total = checks.length;

  return (
    <div
      className="overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 border-b border-black/[0.05] bg-[#fbfbfd] px-3.5 py-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#0071e3]">
          {title || (testing ? 'Έλεγχος σε εξέλιξη — τι ελέγχεται' : 'Αποτέλεσμα ελέγχου')}
        </p>
        {total > 0 ? (
          <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#6e6e73]">
            {done}/{total}
          </span>
        ) : null}
      </div>
      <ul className="space-y-1.5 p-2.5">
        {checks.map((c) => {
          const s = STATUS[c.status] || STATUS.pending;
          return (
            <li
              key={c.id}
              className={`flex items-start gap-2.5 rounded-xl border px-2.5 py-2 text-[13px] ${s.row}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${s.ring}`}
                aria-hidden
              >
                {s.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[#1d1d1f]">{c.label}</span>
                {c.detail ? (
                  <span className={`mt-0.5 block text-[12px] leading-snug whitespace-pre-wrap ${s.detail}`}>
                    {c.detail}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
