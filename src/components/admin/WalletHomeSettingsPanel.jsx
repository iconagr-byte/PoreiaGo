import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_SITE_APPEARANCE,
  fetchSiteAppearance,
  updateSiteAppearance,
} from '../../services/siteAppearanceApi.js';

function blankService() {
  return { icon: 'check_circle', title: '', body: '' };
}

function blankNews() {
  return { title: '', body: '', date: '', badge: '' };
}

function asList(value, fallback = []) {
  return Array.isArray(value) ? value.map((row) => ({ ...row })) : [...fallback];
}

export default function WalletHomeSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    wallet_home_hook: DEFAULT_SITE_APPEARANCE.wallet_home_hook,
    wallet_home_headline: DEFAULT_SITE_APPEARANCE.wallet_home_headline,
    wallet_home_body: DEFAULT_SITE_APPEARANCE.wallet_home_body,
    wallet_home_image_url: DEFAULT_SITE_APPEARANCE.wallet_home_image_url,
    wallet_home_services: asList(DEFAULT_SITE_APPEARANCE.wallet_home_services),
    wallet_home_news: asList(DEFAULT_SITE_APPEARANCE.wallet_home_news),
    wallet_home_show_trips: true,
    wallet_home_trips_title: DEFAULT_SITE_APPEARANCE.wallet_home_trips_title,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSiteAppearance()
      .then((data) => {
        if (cancelled) return;
        setForm({
          wallet_home_hook: data.wallet_home_hook || '',
          wallet_home_headline: data.wallet_home_headline || '',
          wallet_home_body: data.wallet_home_body || '',
          wallet_home_image_url: data.wallet_home_image_url || '',
          wallet_home_services: asList(
            data.wallet_home_services,
            DEFAULT_SITE_APPEARANCE.wallet_home_services,
          ),
          wallet_home_news: asList(data.wallet_home_news, []),
          wallet_home_show_trips: data.wallet_home_show_trips !== false,
          wallet_home_trips_title:
            data.wallet_home_trips_title || DEFAULT_SITE_APPEARANCE.wallet_home_trips_title,
        });
      })
      .catch(() => {
        if (!cancelled) toast.error('Αποτυχία φόρτωσης Wallet Αρχικής');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setField = (key) => (e) => {
    const value = e?.target?.type === 'checkbox' ? e.target.checked : e?.target?.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateService = (index, key, value) => {
    setForm((prev) => {
      const next = [...prev.wallet_home_services];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, wallet_home_services: next };
    });
  };

  const updateNews = (index, key, value) => {
    setForm((prev) => {
      const next = [...prev.wallet_home_news];
      next[index] = { ...next[index], [key]: value };
      return { ...prev, wallet_home_news: next };
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const patch = {
        wallet_home_hook: String(form.wallet_home_hook || '').trim(),
        wallet_home_headline: String(form.wallet_home_headline || '').trim(),
        wallet_home_body: String(form.wallet_home_body || '').trim(),
        wallet_home_image_url: String(form.wallet_home_image_url || '').trim(),
        wallet_home_services: (form.wallet_home_services || [])
          .map((row) => ({
            icon: String(row.icon || 'check_circle').trim() || 'check_circle',
            title: String(row.title || '').trim(),
            body: String(row.body || '').trim(),
          }))
          .filter((row) => row.title || row.body),
        wallet_home_news: (form.wallet_home_news || [])
          .map((row) => ({
            title: String(row.title || '').trim(),
            body: String(row.body || '').trim(),
            date: String(row.date || '').trim(),
            badge: String(row.badge || '').trim(),
          }))
          .filter((row) => row.title || row.body),
        wallet_home_show_trips: Boolean(form.wallet_home_show_trips),
        wallet_home_trips_title:
          String(form.wallet_home_trips_title || '').trim() || 'Επερχόμενες εκδρομές',
      };
      await updateSiteAppearance(patch);
      toast.success('Αποθηκεύτηκε η Wallet Αρχική');
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Φόρτωση Wallet Αρχικής…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              My Wallet
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Αρχική σελίδα εφαρμογής
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Αυτά εμφανίζονται πρώτα όταν ο πελάτης ανοίγει το Wallet του γραφείου σας — hook,
              παροχές, εκδρομές και νέα.
            </p>
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Hook (μικρή γραμμή)</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={form.wallet_home_hook}
              onChange={setField('wallet_home_hook')}
              placeholder="π.χ. Premium ταξιδιωτική εμπειρία"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-semibold text-slate-700">Τίτλος εκδρομών</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={form.wallet_home_trips_title}
              onChange={setField('wallet_home_trips_title')}
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-slate-700">Κύριος τίτλος</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={form.wallet_home_headline}
              onChange={setField('wallet_home_headline')}
              placeholder="Αφήστε κενό για να χρησιμοποιηθεί το hero της ιστοσελίδας"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-slate-700">Κείμενο παρουσίασης</span>
            <textarea
              className="min-h-[96px] w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={form.wallet_home_body}
              onChange={setField('wallet_home_body')}
              placeholder="Σύντομη ιστορία / παροχές του γραφείου"
            />
          </label>
          <label className="block text-sm md:col-span-2">
            <span className="mb-1 block font-semibold text-slate-700">URL εικόνας hero</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5"
              value={form.wallet_home_image_url}
              onChange={setField('wallet_home_image_url')}
              placeholder="Κενό = εικόνα hero ιστοσελίδας"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={Boolean(form.wallet_home_show_trips)}
              onChange={setField('wallet_home_show_trips')}
            />
            Εμφάνιση επερχόμενων εκδρομών στην Αρχική
          </label>
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Παροχές</h3>
            <p className="text-sm text-slate-500">Κάρτες υπηρεσιών κάτω από το hero.</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                wallet_home_services: [...prev.wallet_home_services, blankService()],
              }))
            }
          >
            + Παροχή
          </button>
        </div>
        <div className="space-y-3">
          {form.wallet_home_services.map((row, index) => (
            <div
              key={`svc-${index}`}
              className="grid gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 md:grid-cols-[120px_1fr_1fr_auto]"
            >
              <input
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={row.icon || ''}
                onChange={(e) => updateService(index, 'icon', e.target.value)}
                placeholder="icon"
              />
              <input
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={row.title || ''}
                onChange={(e) => updateService(index, 'title', e.target.value)}
                placeholder="Τίτλος"
              />
              <input
                className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                value={row.body || ''}
                onChange={(e) => updateService(index, 'body', e.target.value)}
                placeholder="Περιγραφή"
              />
              <button
                type="button"
                className="rounded-lg px-2 py-2 text-sm font-bold text-rose-600"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    wallet_home_services: prev.wallet_home_services.filter((_, i) => i !== index),
                  }))
                }
              >
                Διαγραφή
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Νέα γραφείου</h3>
            <p className="text-sm text-slate-500">Ανακοινώσεις που φαίνονται στο Wallet.</p>
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                wallet_home_news: [...prev.wallet_home_news, blankNews()],
              }))
            }
          >
            + Νέα
          </button>
        </div>
        <div className="space-y-3">
          {form.wallet_home_news.length === 0 ? (
            <p className="text-sm text-slate-500">Δεν υπάρχουν νέα ακόμα.</p>
          ) : (
            form.wallet_home_news.map((row, index) => (
              <div
                key={`news-${index}`}
                className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3"
              >
                <div className="grid gap-2 md:grid-cols-3">
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm md:col-span-2"
                    value={row.title || ''}
                    onChange={(e) => updateNews(index, 'title', e.target.value)}
                    placeholder="Τίτλος"
                  />
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={row.badge || ''}
                    onChange={(e) => updateNews(index, 'badge', e.target.value)}
                    placeholder="Badge (π.χ. Νέο)"
                  />
                </div>
                <textarea
                  className="min-h-[72px] w-full rounded-lg border border-slate-200 px-2 py-2 text-sm"
                  value={row.body || ''}
                  onChange={(e) => updateNews(index, 'body', e.target.value)}
                  placeholder="Κείμενο"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    className="rounded-lg border border-slate-200 px-2 py-2 text-sm"
                    value={row.date || ''}
                    onChange={(e) => updateNews(index, 'date', e.target.value)}
                    placeholder="Ημερομηνία (ελεύθερο κείμενο)"
                  />
                  <button
                    type="button"
                    className="rounded-lg px-2 py-2 text-sm font-bold text-rose-600"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        wallet_home_news: prev.wallet_home_news.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    Διαγραφή
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
