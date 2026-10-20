import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPublicOfficeTrips } from '../../services/officeTripsApi.js';
import {
  filterTrips,
  formatTripDepartureLabel,
  sortTripsByDeparture,
} from '../../lib/trips/tripSearch.js';
import { tripCoverUrl } from '../../lib/trips/tripPhotos.js';
import { rememberWalletOfficeTrips } from '../../lib/wallet/walletOfficeTrips.js';

function euro(n, currency = 'EUR') {
  const amount = Number(n || 0);
  try {
    return new Intl.NumberFormat('el-GR', {
      style: 'currency',
      currency: String(currency || 'EUR').toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `€${amount.toFixed(0)}`;
  }
}

/**
 * Browse / search / book published excursions for the sealed Wallet office.
 */
export default function WalletOfficeExcursionsPanel({
  tenantId = '',
  officeName = '',
  compact = false,
}) {
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicOfficeTrips(tenantId ? { tenantId } : undefined)
      .then((list) => {
        if (cancelled) return;
        const rows = Array.isArray(list) ? list : [];
        rememberWalletOfficeTrips(rows, tenantId || null);
        setTrips(rows);
      })
      .catch(() => {
        if (!cancelled) setTrips([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const filtered = useMemo(
    () => filterTrips(sortTripsByDeparture(trips), { query }),
    [trips, query],
  );

  const title = officeName ? `Εκδρομές · ${officeName}` : 'Εκδρομές γραφείου';

  return (
    <section className={`wallet-panel wallet-excursions${compact ? ' wallet-excursions--compact' : ''}`}>
      <div className="wallet-panel-head">
        <span className="wallet-panel-head-icon" aria-hidden>
          <span className="material-symbols-outlined">directions_bus</span>
        </span>
        <div>
          <h2>{title}</h2>
          <p>Ψάξτε και κλείστε θέση απευθείας από το Wallet.</p>
        </div>
      </div>

      <label className="wallet-excursion-search">
        <span className="material-symbols-outlined" aria-hidden>
          search
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Αναζήτηση προορισμού ή εκδρομής…"
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>

      {loading ? (
        <p className="wallet-panel-lead">Φόρτωση εκδρομών…</p>
      ) : filtered.length === 0 ? (
        <p className="wallet-panel-lead">
          {trips.length === 0
            ? 'Δεν υπάρχουν δημοσιευμένες εκδρομές από το γραφείο αυτή τη στιγμή.'
            : 'Καμία εκδρομή δεν ταιριάζει στην αναζήτηση.'}
        </p>
      ) : (
        <ul className="wallet-excursion-list">
          {filtered.map((trip) => {
            const cover = tripCoverUrl(trip);
            const price = euro(trip.price, trip.currency);
            return (
              <li key={trip.id}>
                <article className="wallet-excursion-card">
                  <div
                    className="wallet-excursion-cover"
                    style={cover ? { backgroundImage: `url(${cover})` } : undefined}
                    aria-hidden
                  />
                  <div className="wallet-excursion-body">
                    <h3>{trip.title || trip.destination || 'Εκδρομή'}</h3>
                    <p>
                      {formatTripDepartureLabel(trip)}
                      {trip.destination ? ` · ${trip.destination}` : ''}
                      {trip.availableSeats != null ? ` · ${trip.availableSeats} θέσεις` : ''}
                    </p>
                    <p className="wallet-excursion-price">{price}</p>
                    <div className="wallet-excursion-actions">
                      <button
                        type="button"
                        className="wallet-btn wallet-btn-secondary"
                        onClick={() => navigate(`/trip/${trip.id}`)}
                      >
                        Πληροφορίες
                      </button>
                      <button
                        type="button"
                        className="wallet-btn wallet-btn-primary"
                        onClick={() => navigate(`/select-seat/${trip.id}`)}
                      >
                        Κράτηση
                      </button>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
