import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getTripById, upsertTrip } from '../../lib/trips/tripStore.js';
import { emptyPassengerSeat } from '../../lib/hybrid/hybridDefaults.js';
import {
  enqueueTourLeaderAction,
  flushTourLeaderOfflineQueue,
  isBrowserOnline,
  listTourLeaderOfflineQueue,
} from '../../lib/hybrid/tourLeaderOffline.js';
import { listLuggageRemote, upsertLuggageRemote } from '../../services/hybridTripApi.js';

function buildLocalLuggage(trip) {
  if (!trip) return [];
  if (trip.luggageCheckins?.length) return trip.luggageCheckins;
  return (trip.passengerFlightSeats || []).map((p) => ({
    id: p.id || emptyPassengerSeat().id,
    booking_id: p.booking_id || '',
    passenger_name: p.passenger_name,
    checkin_status: 'pending',
    luggage_count: 0,
    luggage_notes: '',
  }));
}

/**
 * Tour leader PWA-style luggage & check-in tracker (offline-capable).
 */
export default function TourLeaderLuggagePage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const trip = useMemo(() => getTripById(tripId), [tripId]);
  const seedItems = useMemo(() => buildLocalLuggage(trip), [trip]);
  const [items, setItems] = useState(seedItems);
  const [activeTripId, setActiveTripId] = useState(trip?.id ?? null);
  const [draftName, setDraftName] = useState('');
  const [leaderName, setLeaderName] = useState(() => localStorage.getItem('tour_leader_name') || '');
  const [online, setOnline] = useState(() => isBrowserOnline());
  const [pendingCount, setPendingCount] = useState(() => listTourLeaderOfflineQueue(tripId).length);
  const [syncing, setSyncing] = useState(false);

  if (trip?.id !== activeTripId) {
    setActiveTripId(trip?.id ?? null);
    setItems(seedItems);
  }

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    navigator.serviceWorker
      .register('/tour-leader-sw.js', { updateViaCache: 'none', scope: '/tour' })
      .then((reg) => {
        reg.update().catch(() => {});
        const askWaitingToActivate = () => {
          if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        };
        askWaitingToActivate();
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed') askWaitingToActivate();
          });
        });
      })
      .catch(() => {});
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  useEffect(() => {
    if (!trip) {
      toast.error('Η εκδρομή δεν βρέθηκε τοπικά');
      return undefined;
    }
    let cancelled = false;
    listLuggageRemote(trip.id)
      .then((remote) => {
        if (!cancelled && Array.isArray(remote) && remote.length) setItems(remote);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [trip]);

  useEffect(() => {
    if (!trip || !online) return undefined;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      const result = await flushTourLeaderOfflineQueue(trip.id, (payload) =>
        upsertLuggageRemote(trip.id, payload),
      );
      if (!cancelled) {
        setPendingCount(listTourLeaderOfflineQueue(trip.id).length);
        if (result.synced) toast.success(`Offline sync: ${result.synced} εγγραφές`);
      }
      setSyncing(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [trip, online]);

  if (!trip) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-slate-700 font-semibold">Δεν βρέθηκε εκδρομή #{tripId}</p>
          <Link to="/admin" className="text-sm font-bold text-slate-900 underline">
            Επιστροφή
          </Link>
        </div>
      </div>
    );
  }

  const persist = async (next) => {
    setItems(next);
    upsertTrip({ ...trip, luggageCheckins: next });
    for (const item of next) {
      const payload = { ...item, checked_by: leaderName || undefined };
      if (!isBrowserOnline()) {
        enqueueTourLeaderAction({ tripId: trip.id, type: 'luggage_upsert', payload });
        setPendingCount(listTourLeaderOfflineQueue(trip.id).length);
        continue;
      }
      try {
        await upsertLuggageRemote(trip.id, payload);
      } catch {
        enqueueTourLeaderAction({ tripId: trip.id, type: 'luggage_upsert', payload });
        setPendingCount(listTourLeaderOfflineQueue(trip.id).length);
      }
    }
  };

  const updateItem = (id, partial) => {
    const next = items.map((it) => (it.id === id ? { ...it, ...partial } : it));
    persist(next);
  };

  const addPassenger = () => {
    const name = draftName.trim();
    if (!name) return;
    const next = [
      ...items,
      {
        id: emptyPassengerSeat().id,
        passenger_name: name,
        checkin_status: 'pending',
        luggage_count: 1,
        luggage_notes: '',
        booking_id: '',
      },
    ];
    setDraftName('');
    persist(next);
  };

  const flushNow = async () => {
    setSyncing(true);
    const result = await flushTourLeaderOfflineQueue(trip.id, (payload) =>
      upsertLuggageRemote(trip.id, payload),
    );
    setPendingCount(listTourLeaderOfflineQueue(trip.id).length);
    setSyncing(false);
    if (result.synced) toast.success(`Συγχρονίστηκαν ${result.synced}`);
    else if (result.failed) toast.error(`Απέτυχαν ${result.failed}`);
    else toast('Η ουρά είναι άδεια');
  };

  const checked = items.filter((i) => i.checkin_status === 'checked_in' || i.checkin_status === 'boarded').length;
  const bags = items.reduce((s, i) => s + (Number(i.luggage_count) || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200 text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur px-4 py-3">
        <div className="max-w-lg mx-auto flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tour Leader</p>
            <h1 className="text-lg font-bold leading-tight">{trip.title}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Check-in {checked}/{items.length} · Αποσκευές {bags}
              {!online ? ' · Offline' : ''}
              {pendingCount ? ` · Ουρά ${pendingCount}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {pendingCount > 0 ? (
              <button
                type="button"
                disabled={syncing || !online}
                onClick={flushNow}
                className="px-2 py-1 rounded-lg text-xs font-bold border border-slate-200 disabled:opacity-40"
              >
                {syncing ? '…' : 'Sync'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4 pb-24">
        {!online ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
            Λειτουργία offline — οι αλλαγές θα συγχρονιστούν όταν επανέλθει το δίκτυο.
          </div>
        ) : null}

        <label className="block rounded-2xl border border-slate-200 bg-white p-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Όνομα tour leader</span>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={leaderName}
            onChange={(e) => {
              setLeaderName(e.target.value);
              localStorage.setItem('tour_leader_name', e.target.value);
            }}
            placeholder="π.χ. Μαρία"
          />
        </label>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            placeholder="Νέος επιβάτης"
            onKeyDown={(e) => e.key === 'Enter' && addPassenger()}
          />
          <button
            type="button"
            onClick={addPassenger}
            className="px-4 rounded-xl bg-slate-900 text-white text-sm font-bold"
          >
            Προσθήκη
          </button>
        </div>

        <ul className="space-y-3">
          {items.map((item) => {
            const done = item.checkin_status === 'checked_in' || item.checkin_status === 'boarded';
            return (
              <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{item.passenger_name}</p>
                    {item.booking_id ? (
                      <p className="text-xs text-slate-500">Booking {item.booking_id}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      updateItem(item.id, {
                        checkin_status: done ? 'pending' : 'checked_in',
                        checked_at: done ? null : new Date().toISOString(),
                        checked_by: leaderName || null,
                      })
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      done ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-900 text-white'
                    }`}
                  >
                    {done ? 'Checked-in' : 'Check-in'}
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="material-symbols-outlined text-slate-500">luggage</span>
                    <input
                      type="number"
                      min="0"
                      className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                      value={item.luggage_count ?? 0}
                      onChange={(e) => updateItem(item.id, { luggage_count: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <input
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                    value={item.luggage_notes || ''}
                    onChange={(e) => updateItem(item.id, { luggage_notes: e.target.value })}
                    placeholder="Σημειώσεις αποσκευών"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
