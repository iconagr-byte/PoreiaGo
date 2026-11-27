/**
 * Office admin — configure the /rent services mosaic under the fleet list.
 */
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { normalizeRentServicesMosaicCard } from '../../../lib/rental/rentServicesMosaic.js';
import {
  fetchAdminSiteAppearance,
  updateSiteAppearance,
} from '../../../services/siteAppearanceApi.js';
import RentServicesMosaicFields, {
  ensureRentServicesMosaicForm,
} from './RentServicesMosaicFields.jsx';

function formFromAppearance(data) {
  return ensureRentServicesMosaicForm(data || {});
}

export default function RentServicesMosaicEditor({ embedded = false, onSaved } = {}) {
  const [form, setForm] = useState(() => formFromAppearance(null));
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminSiteAppearance();
      const next = ensureRentServicesMosaicForm(data || {});
      setForm(next);
      setSaved(JSON.stringify(next));
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = JSON.stringify(ensureRentServicesMosaicForm(form)) !== saved;

  const save = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    try {
      const mosaic = ensureRentServicesMosaicForm(form);
      const cards = mosaic.rent_services_mosaic_cards
        .map((row, i) => normalizeRentServicesMosaicCard(row, i))
        .filter(Boolean);
      const patch = {
        rent_services_mosaic_enabled: Boolean(mosaic.rent_services_mosaic_enabled),
        rent_services_mosaic_kicker: String(mosaic.rent_services_mosaic_kicker || '').trim(),
        rent_services_mosaic_title: String(mosaic.rent_services_mosaic_title || '').trim(),
        rent_services_mosaic_lead: String(mosaic.rent_services_mosaic_lead || '').trim(),
        rent_services_mosaic_cards: cards,
      };
      const result = await updateSiteAppearance(patch);
      const next = ensureRentServicesMosaicForm(result || patch);
      setForm(next);
      setSaved(JSON.stringify(next));
      onSaved?.(result || patch);
      toast.success('Οι υπηρεσίες στο /rent αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Φόρτωση υπηρεσιών…</p>;
  }

  return (
    <form
      onSubmit={save}
      className={
        embedded
          ? 'space-y-4'
          : 'space-y-4 rounded-2xl border border-teal-100 bg-white p-4 sm:p-5'
      }
    >
      {!embedded ? (
        <div>
          <h3 className="text-base font-bold text-slate-900">Υπηρεσίες κάτω από τον στόλο</h3>
          <p className="mt-1 text-sm text-slate-500">
            Εμφανίζονται στο /rent κάτω από τα αυτοκίνητα. Αλλάξτε τίτλους, κείμενα, φωτό και πού
            οδηγεί το «Μάθετε περισσότερα» — αποθηκεύστε και φαίνονται αμέσως.
          </p>
        </div>
      ) : null}

      <RentServicesMosaicFields form={form} setForm={setForm} />

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!dirty || saving}
          className="rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση υπηρεσιών'}
        </button>
        {dirty ? (
          <span className="text-xs font-semibold text-amber-700">Μη αποθηκευμένες αλλαγές</span>
        ) : null}
      </div>
    </form>
  );
}
