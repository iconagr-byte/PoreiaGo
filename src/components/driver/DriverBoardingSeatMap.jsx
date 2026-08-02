import { useEffect, useMemo, useRef, useState } from 'react';
import { buildBoardingSeatMap } from '../../lib/driver/boardingSeatMap.js';

function SeatCell({ seat, justBoarded, onSelect, selected }) {
  const status = seat?.status || 'EMPTY';
  const classes = [
    'driver-bus-seat',
    `is-${status.toLowerCase()}`,
    seat?.isVip ? 'is-vip' : '',
    justBoarded ? 'is-just-boarded' : '',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const label =
    status === 'BOARDED'
      ? `${seat.number} · ${seat.passenger_name || 'Επιβιβάστηκε'}`
      : status === 'RESERVED'
        ? `${seat.number} · ${seat.passenger_name || 'Αναμονή'} (κράτηση)`
        : `Θέση ${seat.number} ελεύθερη`;

  return (
    <button
      type="button"
      className={classes}
      aria-label={label}
      title={label}
      onClick={() => onSelect?.(seat)}
    >
      <span className="driver-bus-seat-headrest" aria-hidden />
      <span className="driver-bus-seat-cushion">
        <span className="driver-bus-seat-num">{seat.number}</span>
        {status === 'BOARDED' ? (
          <span className="driver-bus-seat-check material-symbols-outlined" aria-hidden>
            check
          </span>
        ) : null}
        {status === 'RESERVED' && !seat.isVip ? (
          <span className="driver-bus-seat-dot" aria-hidden />
        ) : null}
        {seat.isVip && status !== 'BOARDED' ? (
          <span className="driver-bus-seat-vip material-symbols-outlined" aria-hidden>
            star
          </span>
        ) : null}
      </span>
      <span className="driver-bus-seat-base" aria-hidden />
    </button>
  );
}

/**
 * Read-only κάτοψη λεωφορείου για το tab Κρατήσεις του οδηγού.
 * Οι θέσεις γεμίζουν με animation όταν γίνεται check-in.
 */
export default function DriverBoardingSeatMap({ manifest, vehicleType, className = '' }) {
  const map = useMemo(
    () => buildBoardingSeatMap(manifest, { vehicleType }),
    [manifest, vehicleType],
  );
  const [selectedId, setSelectedId] = useState(null);
  const [flashIds, setFlashIds] = useState(() => new Set());
  const prevBoardedRef = useRef(new Set());

  useEffect(() => {
    const boardedNow = new Set(
      map.seats.filter((s) => s.status === 'BOARDED').map((s) => s.number),
    );
    const prev = prevBoardedRef.current;
    const fresh = [...boardedNow].filter((id) => !prev.has(id));
    prevBoardedRef.current = boardedNow;
    if (!fresh.length) return undefined;
    setFlashIds((cur) => {
      const next = new Set(cur);
      fresh.forEach((id) => next.add(id));
      return next;
    });
    const t = window.setTimeout(() => {
      setFlashIds((cur) => {
        const next = new Set(cur);
        fresh.forEach((id) => next.delete(id));
        return next;
      });
    }, 1600);
    return () => window.clearTimeout(t);
  }, [map.seats]);

  const selected = map.seats.find((s) => s.number === selectedId) || null;
  const aisleAfterIndex = map.layout.cols.indexOf(map.layout.aisleAfter);

  if (!manifest) {
    return (
      <div className={`driver-bus-map ${className}`}>
        <p className="driver-bus-map-empty">Φόρτωση κάτοψης…</p>
      </div>
    );
  }

  return (
    <div className={`driver-bus-map ${className}`}>
      <div className="driver-bus-map-head">
        <div>
          <p className="driver-card-label">Κάτοψη λεωφορείου</p>
          <h3 className="driver-bus-map-title">
            {manifest.trip_title || map.layout.label}
          </h3>
        </div>
        <div className="driver-bus-map-progress" aria-label="Πρόοδος επιβίβασης">
          <span className="driver-bus-map-progress-num tabular-nums">
            {map.boardedCount}
            <small>/{map.capacity}</small>
          </span>
          <div className="driver-bus-map-bar">
            <div
              className="driver-bus-map-bar-fill"
              style={{ width: `${map.progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="driver-bus-shell">
        <div className="driver-bus-windshield">
          <span className="material-symbols-outlined">airline_seat_recline_extra</span>
          <span>Οδηγός</span>
        </div>

        <div className="driver-bus-cabin">
          <div className="driver-bus-aisle" aria-hidden />
          {Array.from({ length: map.layout.rows }).map((_, rowIndex) => {
            const row = rowIndex + 1;
            return (
              <div key={row} className="driver-bus-row">
                <span className="driver-bus-row-num">{row}</span>
                {map.layout.cols.map((col, colIndex) => {
                  const seat = map.seats.find((s) => s.row === row && s.col === col);
                  return (
                    <span key={`${row}-${col}`} className="contents">
                      {colIndex === aisleAfterIndex + 1 ? (
                        <span className="driver-bus-aisle-gap" aria-hidden />
                      ) : null}
                      {seat ? (
                        <SeatCell
                          seat={seat}
                          justBoarded={flashIds.has(seat.number)}
                          selected={selectedId === seat.number}
                          onSelect={(s) =>
                            setSelectedId((cur) => (cur === s.number ? null : s.number))
                          }
                        />
                      ) : (
                        <span className="driver-bus-seat is-ghost" aria-hidden />
                      )}
                    </span>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="driver-bus-rear" aria-hidden />
      </div>

      <div className="driver-bus-legend">
        <span>
          <i className="is-boarded" /> Επιβιβάστηκε
        </span>
        <span>
          <i className="is-reserved" /> Κράτηση
        </span>
        <span>
          <i className="is-empty" /> Ελεύθερη
        </span>
      </div>

      {selected ? (
        <div
          className={`driver-bus-detail is-${selected.status.toLowerCase()}`}
          role="status"
        >
          <div>
            <p className="driver-bus-detail-seat">Θέση {selected.number}</p>
            <p className="driver-bus-detail-name">
              {selected.passenger_name ||
                (selected.status === 'EMPTY' ? 'Ελεύθερη θέση' : 'Επιβάτης')}
            </p>
            {selected.booking_ref ? (
              <p className="driver-bus-detail-meta">Κράτηση {selected.booking_ref}</p>
            ) : null}
          </div>
          <span className="driver-bus-detail-badge">
            {selected.status === 'BOARDED'
              ? 'Μέσα'
              : selected.status === 'RESERVED'
                ? 'Αναμονή'
                : 'Κενή'}
          </span>
        </div>
      ) : (
        <p className="driver-bus-hint">
          Πάτα μια θέση για όνομα επιβάτη. Στο check-in η θέση γεμίζει με πράσινο.
        </p>
      )}
    </div>
  );
}
