import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchAdminSiteAppearance,
  updateSiteAppearance,
} from '../../../services/siteAppearanceApi.js';

/**
 * Office admin: manage pickup / dropoff points shown on /rent search.
 * Stored in site appearance `rent_pickup_locations` (office tenant scoped).
 */
export default function RentPickupLocationsEditor() {
  const [officeLabel, setOfficeLabel] = useState('Γραφείο');
  const [officeAddress, setOfficeAddress] = useState('');
  const [locations, setLocations] = useState([]);
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState('[]');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSiteAppearance();
      const locs = Array.isArray(data?.rent_pickup_locations)
        ? data.rent_pickup_locations.map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      const brand =
        String(data?.rent_office_name || data?.footer_brand_name || data?.display_name || '').trim() ||
        'Γραφείο';
      setOfficeLabel(brand);
      setOfficeAddress(String(data?.footer_address || '').trim());
      setLocations(locs);
      setSaved(JSON.stringify(locs));
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης σημείων');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = JSON.stringify(locations) !== saved;

  const addLocation = (e) => {
    e?.preventDefault?.();
    const label = draft.trim();
    if (!label) return;
    if (locations.some((l) => l.toLowerCase() === label.toLowerCase())) {
      toast.error('Το σημείο υπάρχει ήδη');
      return;
    }
    if (label.toLowerCase() === 'γραφείο' || label.toLowerCase() === officeLabel.toLowerCase()) {
      toast.error('Το γραφείο υπάρχει ήδη ως βασικό σημείο');
      return;
    }
    setLocations((prev) => [...prev, label].slice(0, 24));
    setDraft('');
  };

  const removeLocation = (idx) => {
    setLocations((prev) => prev.filter((_, i) => i !== idx));
  };

  const onSave = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      await updateSiteAppearance({ rent_pickup_locations: locations });
      setSaved(JSON.stringify(locations));
      toast.success('Τα σημεία παραλαβής αποθηκεύτηκαν — εμφανίζονται στο /rent');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-8 text-center text-sm text-gray-500">
        <span className="material-symbols-outlined animate-spin text-[22px]" aria-hidden>
          progress_activity
        </span>
        <p className="mt-2">Φόρτωση σημείων παραλαβής…</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="space-y-4">
      <div className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-gray-900">Σημεία παραλαβής</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-xl">
              Εμφανίζονται στο <strong className="font-semibold text-gray-700">hero</strong> της{' '}
              <a href="/rent" target="_blank" rel="noreferrer" className="text-teal-700 font-semibold">
                /rent
              </a>{' '}
              και στο μενού «Σημείο έναρξης ενοικίασης» της φόρμας αναζήτησης.
            </p>
          </div>
          <button
            type="submit"
            disabled={saving || !dirty}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-700 text-white text-sm font-bold disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              save
            </span>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-teal-100 bg-teal-50/70 px-3.5 py-3 flex items-start gap-3">
          <span className="material-symbols-outlined text-teal-800 mt-0.5" aria-hidden>
            location_on
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-teal-800/80">
              Σημείο έναρξης ενοικίασης · βασικό
            </p>
            <p className="font-bold text-gray-900 mt-0.5">Γραφείο · {officeLabel}</p>
            {officeAddress ? (
              <p className="text-xs text-gray-600 mt-0.5">{officeAddress}</p>
            ) : (
              <p className="text-xs text-gray-500 mt-0.5">
                Πρόσθεσε διεύθυνση από Εμφάνιση /rent ή ρυθμίσεις αρχικής.
              </p>
            )}
            <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold px-2 py-0.5 rounded-full bg-white text-teal-800 border border-teal-200">
              <span className="material-symbols-outlined text-[14px]" aria-hidden>
                hub
              </span>
              Δίκτυο
            </span>
          </div>
        </div>

        <ul className="mt-4 space-y-2">
          {locations.length === 0 ? (
            <li className="text-sm text-gray-500 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center">
              Δεν υπάρχουν επιπλέον σημεία ακόμα — πρόσθεσε αεροδρόμιο, λιμάνι, ξενοδοχείο κ.λπ.
            </li>
          ) : (
            locations.map((loc, idx) => (
              <li
                key={`${loc}-${idx}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] bg-slate-50 px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-teal-700 text-[20px]" aria-hidden>
                    place
                  </span>
                  <span className="font-semibold text-gray-900 truncate">{loc}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeLocation(idx)}
                  className="text-xs font-bold text-rose-600 shrink-0"
                >
                  Αφαίρεση
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLocation();
              }
            }}
            placeholder="π.χ. Αεροδρόμιο, Λιμάνι, Ξενοδοχείο…"
            className="flex-1 min-w-[14rem] rounded-xl border border-black/[0.08] bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-teal-500"
          />
          <button
            type="button"
            onClick={addLocation}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-teal-200 bg-white text-teal-900 text-sm font-bold hover:bg-teal-50"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              add
            </span>
            Προσθήκη
          </button>
        </div>

        <p className="mt-3 text-xs text-gray-500">
          {dirty ? 'Υπάρχουν μη αποθηκευμένες αλλαγές.' : 'Όλα αποθηκευμένα.'}
        </p>
      </div>
    </form>
  );
}
