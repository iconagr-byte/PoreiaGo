import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPublicOfficeTrips } from '../../services/officeTripsApi.js';
import { formatTripDepartureLabel, sortTripsByDeparture } from '../../lib/trips/tripSearch.js';
import { tripCoverUrl } from '../../lib/trips/tripPhotos.js';
import { rememberWalletOfficeTrips } from '../../lib/wallet/walletOfficeTrips.js';
import { resolveWalletHomeFeed } from '../../lib/wallet/walletHomeFeed.js';
import { isNativeApp } from '../../lib/capacitor/isNativeApp.js';

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
 * Wallet «Αρχική» — office hook, services, upcoming trips, news.
 * Same feed on phone/native and desktop main column.
 */
export default function WalletStartFeed({
  appearance = {},
  officeName = '',
  tenantId = '',
  onOpenTicket,
  onBrowseAllTrips,
}) {
  const navigate = useNavigate();
  const nativeWallet = isNativeApp();
  const tripsSectionRef = useRef(null);
  const feed = useMemo(
    () => resolveWalletHomeFeed(appearance, { officeName }),
    [appearance, officeName],
  );
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(Boolean(feed.showTrips));

  useEffect(() => {
    if (!feed.showTrips) {
      setTrips([]);
      setTripsLoading(false);
      return undefined;
    }
    let cancelled = false;
    setTripsLoading(true);
    fetchPublicOfficeTrips(tenantId ? { tenantId } : undefined)
      .then((list) => {
        if (cancelled) return;
        const rows = Array.isArray(list) ? list : [];
        rememberWalletOfficeTrips(rows, tenantId || null);
        setTrips(sortTripsByDeparture(rows).slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setTrips([]);
      })
      .finally(() => {
        if (!cancelled) setTripsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId, feed.showTrips]);

  const scrollToTrips = () => {
    const el = tripsSectionRef.current;
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (onBrowseAllTrips) {
      onBrowseAllTrips();
      return;
    }
    if (!nativeWallet) navigate('/');
  };

  const openAllTrips = () => {
    if (onBrowseAllTrips) {
      onBrowseAllTrips();
      return;
    }
    if (!nativeWallet) navigate('/');
  };

  return (
    <div className="wallet-stack wallet-start-feed">
      <section className="wallet-start-hero" aria-label={feed.officeName}>
        <div
          className="wallet-start-hero-media"
          style={feed.imageUrl ? { backgroundImage: `url(${feed.imageUrl})` } : undefined}
        />
        <div className="wallet-start-hero-shade" />
        <div className="wallet-start-hero-copy">
          {feed.hook ? <p className="wallet-start-hook">{feed.hook}</p> : null}
          <h1>{feed.officeName}</h1>
          <p className="wallet-start-headline">{feed.headline}</p>
          {feed.body ? <p className="wallet-start-body">{feed.body}</p> : null}
          <div className="wallet-start-hero-actions">
            <button type="button" className="wallet-btn wallet-btn-primary" onClick={scrollToTrips}>
              Δείτε εκδρομές
            </button>
            {onOpenTicket ? (
              <button type="button" className="wallet-btn wallet-btn-secondary" onClick={onOpenTicket}>
                Το εισιτήριό μου
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {feed.services.length > 0 ? (
        <section className="wallet-panel wallet-start-services" aria-label="Παροχές">
          <h2>Παροχές</h2>
          <p className="wallet-panel-lead">Τι σας προσφέρει το γραφείο στο Wallet.</p>
          <ul className="wallet-start-service-list">
            {feed.services.map((svc) => (
              <li key={svc.id} className="wallet-start-service">
                <span className="wallet-start-service-icon" aria-hidden>
                  <span className="material-symbols-outlined">{svc.icon}</span>
                </span>
                <div>
                  <h3>{svc.title}</h3>
                  {svc.body ? <p>{svc.body}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {feed.showTrips ? (
        <section
          ref={tripsSectionRef}
          className="wallet-panel"
          aria-label={feed.tripsTitle}
          id="wallet-upcoming-trips"
        >
          <h2>{feed.tripsTitle}</h2>
          <p className="wallet-panel-lead">Επιλέξτε και κλείστε θέση από το Wallet.</p>
          {tripsLoading ? (
            <p className="wallet-panel-lead">Φόρτωση…</p>
          ) : trips.length === 0 ? (
            <p className="wallet-panel-lead">Δεν υπάρχουν δημοσιευμένες εκδρομές αυτή τη στιγμή.</p>
          ) : (
            <ul className="wallet-excursion-list">
              {trips.map((trip) => {
                const cover = tripCoverUrl(trip);
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
                      </p>
                      <p className="wallet-excursion-price">{euro(trip.price, trip.currency)}</p>
                      <div className="wallet-excursion-actions">
                        {nativeWallet ? null : (
                          <button
                            type="button"
                            className="wallet-btn wallet-btn-secondary"
                            onClick={() => navigate(`/trip/${trip.id}`)}
                          >
                            Πληροφορίες
                          </button>
                        )}
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
          {trips.length > 0 ? (
            <button
              type="button"
              className="wallet-btn wallet-btn-ghost wallet-btn-block"
              style={{ marginTop: '0.75rem' }}
              onClick={openAllTrips}
            >
              Όλες οι εκδρομές
            </button>
          ) : null}
        </section>
      ) : null}

      {feed.news.length > 0 ? (
        <section className="wallet-panel wallet-start-news" aria-label="Νέα γραφείου">
          <h2>Νέα γραφείου</h2>
          <p className="wallet-panel-lead">Ενημερώσεις από {feed.officeName}.</p>
          <ul className="wallet-start-news-list">
            {feed.news.map((item) => (
              <li key={item.id} className="wallet-start-news-item">
                <div className="wallet-start-news-meta">
                  {item.badge ? <span className="wallet-start-news-badge">{item.badge}</span> : null}
                  {item.date ? <time>{item.date}</time> : null}
                </div>
                <h3>{item.title}</h3>
                {item.body ? <p>{item.body}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
