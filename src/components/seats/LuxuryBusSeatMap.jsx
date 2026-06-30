import { useState } from 'react';
import { DEFAULT_SEAT_MAP_THEME, getSeatMapTheme } from '../../lib/seats/seatMapThemes.js';
import SeatDetailPopover from './SeatDetailPopover.jsx';

function seatVisualState(seat, selectedIds) {
  if (!seat) return 'empty';
  if (seat.status === 'BOOKED') return 'booked';
  if (selectedIds.includes(seat.id)) return 'selected';
  if (seat.isVip) return 'vip';
  return 'available';
}

function LuxurySeatButton({ seat, selectedIds, onClick, theme }) {
  const state = seatVisualState(seat, selectedIds);
  const disabled = !seat || state === 'booked';

  const shell =
    state === 'booked'
      ? 'opacity-45 cursor-not-allowed'
      : state === 'selected'
        ? 'cursor-pointer scale-[1.06] z-[2]'
        : 'cursor-pointer hover:scale-[1.04] hover:z-[1]';

  const bookedCushion =
    'bg-gradient-to-b from-slate-600/80 to-slate-700/90 border-slate-500/30 text-slate-400/80 shadow-none';
  const bookedHeadrest = 'bg-slate-500/70';

  let cushion = bookedCushion;
  let headrest = bookedHeadrest;
  let selectedRing = '';

  if (state === 'selected') {
    cushion = theme.selected.cushion;
    headrest = theme.selected.headrest;
    selectedRing = theme.selected.ring;
  } else if (state === 'vip') {
    cushion = theme.vip.cushion;
    headrest = theme.vip.headrest;
  } else if (state === 'available') {
    cushion = theme.available.cushion;
    headrest = theme.available.headrest;
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => seat && onClick?.(seat)}
      className={`group relative w-[2.35rem] h-[2.65rem] flex flex-col items-center transition-all duration-200 ${shell}`}
      aria-label={seat ? `Θέση ${seat.number}` : undefined}
    >
      <div
        className={`relative w-full flex-1 rounded-t-[10px] rounded-b-[6px] border pt-[3px] px-[2px] pb-[2px] transition-all ${cushion}`}
      >
        <div className={`mx-auto w-[72%] h-[5px] rounded-full mb-[2px] ${headrest}`} />
        <div className="flex items-stretch justify-center gap-[1px] flex-1 min-h-[14px]">
          <span className="w-[3px] rounded-full bg-black/10 shrink-0" aria-hidden />
          <span className="flex-1 flex items-center justify-center">
            <span className="text-[8px] font-bold tracking-tight leading-none tabular-nums">
              {seat?.number}
            </span>
          </span>
          <span className="w-[3px] rounded-full bg-black/10 shrink-0" aria-hidden />
        </div>
        {state === 'vip' && (
          <span
            className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border flex items-center justify-center shadow-md ${theme.vip.badge}`}
          >
            <span className={`material-symbols-outlined text-[8px] leading-none ${theme.vip.badgeIcon}`}>
              star
            </span>
          </span>
        )}
        {state === 'selected' && selectedRing && (
          <span
            className={`absolute inset-0 rounded-t-[10px] rounded-b-[6px] ring-2 pointer-events-none ${selectedRing}`}
          />
        )}
        {state === 'booked' && (
          <span
            className="absolute inset-[2px] rounded-t-[8px] rounded-b-[4px] bg-[repeating-linear-gradient(-45deg,transparent,transparent_3px,rgba(0,0,0,0.08)_3px,rgba(0,0,0,0.08)_6px)] pointer-events-none"
            aria-hidden
          />
        )}
      </div>
      <span className="w-[78%] h-[3px] rounded-b-full bg-black/25 mt-[1px]" aria-hidden />
    </button>
  );
}

function LegendSwatch({ className }) {
  return <span className={`w-4 h-[1.1rem] rounded-t-md rounded-b-sm shadow-sm ${className}`} />;
}

export default function LuxuryBusSeatMap({
  layout,
  seats,
  selectedSeats = [],
  onSeatClick,
  availableCount,
  vehicleType,
  theme: themeProp,
  showSeatPopup = false,
  className = '',
}) {
  const [previewSeat, setPreviewSeat] = useState(null);

  if (!layout) return null;

  const theme = themeProp || getSeatMapTheme(vehicleType) || DEFAULT_SEAT_MAP_THEME;
  const mapScale = layout.rows > 10 ? 'origin-top scale-[0.86] sm:scale-[0.92]' : 'scale-100';
  const aisleColIndex = layout.cols.indexOf(layout.aisleAfter) + 1;

  const handleSeatPress = (seat) => {
    if (!seat || seat.status === 'BOOKED') return;
    if (showSeatPopup) {
      setPreviewSeat(seat);
      return;
    }
    onSeatClick?.(seat);
  };

  const confirmPreview = () => {
    if (previewSeat) onSeatClick?.(previewSeat);
    setPreviewSeat(null);
  };

  return (
    <>
    <div className={`w-full max-w-[320px] ${className}`}>
      <div
        className={`relative rounded-[2rem] p-[2px] bg-gradient-to-b ${theme.frameOuter} shadow-[0_24px_60px_rgba(0,0,0,0.35)]`}
      >
        <div className={`rounded-[1.85rem] bg-gradient-to-b ${theme.frameInner} overflow-hidden`}>
          <div className="relative px-4 pt-4 pb-3">
            <div className="h-10 rounded-t-[1.25rem] rounded-b-lg bg-gradient-to-b from-sky-950/40 via-slate-800/80 to-slate-900 border border-white/10 shadow-inner flex items-center justify-center gap-2">
              <div
                className={`w-8 h-8 rounded-full bg-slate-950/80 border flex items-center justify-center ${theme.driverIconBorder}`}
              >
                <span className={`material-symbols-outlined text-[18px] ${theme.driverIconText}`}>
                  airline_seat_recline_extra
                </span>
              </div>
              <span
                className={`text-[10px] font-bold uppercase tracking-[0.28em] ${theme.driverLabel}`}
              >
                Οδηγός
              </span>
            </div>
            <div
              className={`absolute left-1/2 -translate-x-1/2 top-2 w-[70%] h-px bg-gradient-to-r from-transparent ${theme.shine} to-transparent`}
              aria-hidden
            />
          </div>

          <div className="px-3 pb-4">
            <div
              className={`relative rounded-[1.25rem] border border-white/[0.06] bg-gradient-to-b ${theme.interior} px-2 py-3 shadow-inner`}
            >
              <div
                className={`absolute inset-y-3 left-0 w-[3px] rounded-full bg-gradient-to-b ${theme.rail}`}
              />
              <div
                className={`absolute inset-y-3 right-0 w-[3px] rounded-full bg-gradient-to-b ${theme.rail}`}
              />

              <div
                className={`absolute top-3 bottom-3 left-1/2 -translate-x-1/2 w-3 rounded-full opacity-30 ${theme.aisle}`}
                aria-hidden
              />

              <div className={`${mapScale} mx-auto w-fit`}>
                <div className="space-y-[0.35rem]">
                  {Array.from({ length: layout.rows }).map((_, rowIndex) => {
                    const row = rowIndex + 1;
                    return (
                      <div key={row} className="flex items-center justify-center gap-[0.2rem]">
                        <span
                          className={`w-4 text-[8px] font-semibold text-right tabular-nums ${theme.rowNumber}`}
                        >
                          {row}
                        </span>
                        {layout.cols.map((col, colIndex) => {
                          const seat = seats.find((s) => s.row === row && s.col === col);
                          return (
                            <span key={`${row}-${col}`} className="contents">
                              {colIndex === aisleColIndex && (
                                <div className="w-3 h-7 shrink-0" aria-hidden />
                              )}
                              {seat ? (
                                <LuxurySeatButton
                                  seat={seat}
                                  selectedIds={selectedSeats}
                                  onClick={handleSeatPress}
                                  theme={theme}
                                />
                              ) : (
                                <span className="w-[2.35rem] h-[2.65rem] invisible" aria-hidden />
                              )}
                            </span>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div
              className={`mt-2 h-1.5 mx-6 rounded-full bg-gradient-to-r from-transparent ${theme.rearAccent} to-transparent`}
            />
          </div>

          <div className="px-4 pb-4 pt-1 border-t border-white/[0.06]">
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
              <span className="flex items-center gap-1.5">
                <LegendSwatch className={`border ${theme.available.legend}`} />
                Ελεύθερη
              </span>
              <span className="flex items-center gap-1.5">
                <LegendSwatch className={`border ${theme.vip.legend}`} />
                {theme.vipLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <LegendSwatch className={`border ${theme.selected.legend}`} />
                Επιλογή
              </span>
              <span className="flex items-center gap-1.5">
                <LegendSwatch className="bg-slate-600/80 border border-slate-500/40 opacity-60" />
                Κλειστή
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-center mt-3 font-medium tracking-wide">
        <span className={theme.footerCount}>{availableCount} διαθέσιμες</span>
        <span className="text-slate-400 mx-1.5">·</span>
        <span className="text-slate-600">{layout.label}</span>
        <span className="text-slate-400 mx-1.5">·</span>
        <span className="text-slate-500">{theme.vipLabel}</span>
      </p>
    </div>

      {previewSeat && (
        <SeatDetailPopover
          seat={previewSeat}
          theme={theme}
          selected={selectedSeats.includes(previewSeat.id)}
          onConfirm={confirmPreview}
          onClose={() => setPreviewSeat(null)}
        />
      )}
    </>
  );
}
