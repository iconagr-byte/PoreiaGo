export default function SeatDetailPopover({
  seat,
  theme,
  selected,
  onConfirm,
  onClose,
}) {
  if (!seat) return null;

  const tierLabel = seat.tier === 'vip' ? theme?.vipLabel || 'VIP' : 'Standard';

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-[1px]"
        aria-label="Κλείσιμο"
        onClick={onClose}
      />
      <div
        className="fixed z-[70] w-[min(17rem,calc(100vw-2rem))] rounded-2xl border border-white/20 bg-gradient-to-b from-slate-900 to-slate-950 text-white shadow-[0_20px_50px_rgba(0,0,0,0.45)] p-4 animate-in fade-in zoom-in-95 duration-150"
        style={{
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        role="dialog"
        aria-labelledby="seat-popover-title"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/50">{tierLabel}</p>
            <h3 id="seat-popover-title" className="text-lg font-bold">
              Θέση {seat.number}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <p className="text-2xl font-bold text-amber-300 mb-3">€{Number(seat.priceEur || 0).toFixed(2)}</p>

        {seat.amenities?.length > 0 ? (
          <ul className="space-y-1.5 mb-4 max-h-32 overflow-y-auto text-sm text-white/85">
            {seat.amenities.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="material-symbols-outlined text-amber-300 text-[16px] shrink-0 mt-0.5">
                  check_circle
                </span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/50 mb-4">Χωρίς επιπλέον παροχές.</p>
        )}

        <button
          type="button"
          onClick={onConfirm}
          className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${
            selected
              ? 'bg-white/15 text-white border border-white/25 hover:bg-white/20'
              : 'bg-amber-400 text-slate-950 hover:bg-amber-300'
          }`}
        >
          {selected ? 'Αφαίρεση θέσης' : 'Προσθήκη θέσης'}
        </button>
      </div>
    </>
  );
}
