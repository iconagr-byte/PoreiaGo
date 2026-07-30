/**
 * Visual checklist for email connection «Έλεγχος».
 */
export default function EmailConnectionCheckList({
  checks = [],
  testing = false,
  title,
} = {}) {
  if (!checks.length && !testing) return null;

  return (
    <div
      className="rounded-2xl border border-black/[0.08] bg-white/95 px-3.5 py-3 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#0071e3]">
        {title || (testing ? 'Έλεγχος σε εξέλιξη — τι ελέγχεται' : 'Αποτέλεσμα ελέγχου')}
      </p>
      <ul className="mt-2 space-y-1.5">
        {checks.map((c) => {
          const icon =
            c.status === 'ok'
              ? '✓'
              : c.status === 'fail'
                ? '✕'
                : c.status === 'skip'
                  ? '–'
                  : c.status === 'running'
                    ? '●'
                    : '○';
          const color =
            c.status === 'ok'
              ? 'text-emerald-700'
              : c.status === 'fail'
                ? 'text-rose-700'
                : c.status === 'skip'
                  ? 'text-[#86868b]'
                  : c.status === 'running'
                    ? 'text-[#0071e3]'
                    : 'text-[#86868b]';
          return (
            <li
              key={c.id}
              className="flex items-start gap-2 rounded-xl bg-[#f5f5f7]/90 px-2.5 py-2 text-[13px]"
            >
              <span className={`mt-0.5 w-4 shrink-0 text-center font-bold ${color}`}>{icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[#1d1d1f]">{c.label}</span>
                {c.detail ? (
                  <span className={`mt-0.5 block text-[12px] leading-snug whitespace-pre-wrap ${color}`}>
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
