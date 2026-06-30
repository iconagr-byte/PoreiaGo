import {
  bookingFiscalMark,
  bookingFiscalMarks,
  bookingFiscalProvider,
  bookingFiscalStatus,
  fiscalProviderLabel,
} from '../../lib/fiscal/fiscalDisplay.js';

export default function FiscalMarkCell({ booking, compact = false }) {
  const status = bookingFiscalStatus(booking);
  const mark = bookingFiscalMark(booking);
  const marks = bookingFiscalMarks(booking);
  const provider = bookingFiscalProvider(booking);
  const providerLabel = fiscalProviderLabel(provider);

  if (!status && !mark) {
    return <span className="text-xs text-on-surface-variant/50">—</span>;
  }

  if (status === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-bold border border-amber-200">
        <span className="material-symbols-outlined text-[14px]">hourglass_top</span>
        Εκκρεμεί
      </span>
    );
  }

  if (status === 'failed') {
    return (
      <div className="space-y-0.5">
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[11px] font-bold border border-red-200">
          <span className="material-symbols-outlined text-[14px]">error</span>
          Αποτυχία
        </span>
        {providerLabel ? (
          <span className="block text-[10px] text-on-surface-variant">{providerLabel}</span>
        ) : null}
      </div>
    );
  }

  const displayMark = marks.length > 1 ? marks[marks.length - 1] : mark;
  const title = marks.length > 1 ? marks.join(', ') : displayMark;

  return (
    <div className={compact ? 'space-y-0.5 min-w-0' : 'space-y-1 min-w-0'}>
      <div
        className="font-mono text-xs font-semibold text-emerald-800 truncate max-w-[140px]"
        title={title || undefined}
      >
        {marks.length > 1 ? (
          <>
            {displayMark}
            <span className="text-emerald-600/80 font-sans font-bold ml-1">+{marks.length - 1}</span>
          </>
        ) : (
          displayMark
        )}
      </div>
      {providerLabel ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
          <span className="material-symbols-outlined text-[12px]">receipt_long</span>
          {providerLabel}
        </span>
      ) : null}
    </div>
  );
}
