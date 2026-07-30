/**
 * Edit marketing cards for PoreiaGo Rent (standalone + add-on) shown on /grafeia/rent.
 * Polished editor: live preview, feature rows, sticky save.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  DEFAULT_RENT_SECTION_TITLE,
  RENT_ADDON,
  RENT_STANDALONE_PLAN,
  mergeRentPlanCatalog,
  normalizeRentCtaLabel,
} from '../../../lib/billing/planCatalog.js';
import {
  fetchAdminRentPlanCatalog,
  updateRentPlanCatalog,
} from '../../../services/rentPlanCatalogApi.js';

function cardToForm(card) {
  const features = Array.isArray(card.features)
    ? card.features.map((f) => String(f))
    : [];
  return {
    badge: card.badge || '',
    name: card.name || '',
    tagline: card.tagline || '',
    monthlyEur: card.monthlyEur ?? '',
    features: features.length ? features : [''],
    ctaLoggedIn: normalizeRentCtaLabel(card.ctaLoggedIn || 'Εγγραφή'),
    ctaGuest: normalizeRentCtaLabel(card.ctaGuest || 'Εγγραφή'),
    servicesLinkLabel: card.servicesLinkLabel || '',
    visible: card.visible !== false,
  };
}

function formToCard(form) {
  const monthly = Number(form.monthlyEur);
  return {
    badge: String(form.badge || '').trim(),
    name: String(form.name || '').trim(),
    tagline: String(form.tagline || '').trim(),
    monthlyEur: Number.isFinite(monthly) ? monthly : 0,
    features: (form.features || []).map((l) => String(l).trim()).filter(Boolean),
    ctaLoggedIn: normalizeRentCtaLabel(form.ctaLoggedIn || 'Εγγραφή'),
    ctaGuest: normalizeRentCtaLabel(form.ctaGuest || 'Εγγραφή'),
    servicesLinkLabel: String(form.servicesLinkLabel || '').trim(),
    visible: Boolean(form.visible),
  };
}

function serializeSnapshot(sectionTitle, standalone, addon) {
  return JSON.stringify({
    sectionTitle,
    standalone: formToCard(standalone),
    addon: formToCard(addon),
  });
}

function Field({ label, hint, children }) {
  return (
    <label className="rent-plan-field">
      <span className="rent-plan-field-label">{label}</span>
      {hint ? <span className="rent-plan-field-hint">{hint}</span> : null}
      {children}
    </label>
  );
}

function FeatureListEditor({ features, onChange }) {
  const rows = features?.length ? features : [''];

  const updateRow = (idx, value) => {
    const next = [...rows];
    next[idx] = value;
    onChange(next);
  };

  const addRow = () => onChange([...rows, '']);

  const removeRow = (idx) => {
    if (rows.length <= 1) {
      onChange(['']);
      return;
    }
    onChange(rows.filter((_, i) => i !== idx));
  };

  const moveRow = (idx, dir) => {
    const j = idx + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };

  return (
    <div className="rent-plan-features">
      <div className="rent-plan-features-head">
        <span className="rent-plan-field-label">Features</span>
        <button type="button" className="rent-plan-chip-btn" onClick={addRow}>
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            add
          </span>
          Προσθήκη
        </button>
      </div>
      <ul className="rent-plan-feature-list">
        {rows.map((row, idx) => (
          <li key={`f-${idx}`} className="rent-plan-feature-row">
            <span className="rent-plan-feature-handle" aria-hidden>
              {idx + 1}
            </span>
            <input
              className="rent-plan-input"
              value={row}
              placeholder="π.χ. Customer app /rent + Rent Wallet"
              onChange={(e) => updateRow(idx, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addRow();
                }
              }}
            />
            <div className="rent-plan-feature-actions">
              <button
                type="button"
                className="rent-plan-icon-btn"
                title="Πάνω"
                disabled={idx === 0}
                onClick={() => moveRow(idx, -1)}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_upward</span>
              </button>
              <button
                type="button"
                className="rent-plan-icon-btn"
                title="Κάτω"
                disabled={idx === rows.length - 1}
                onClick={() => moveRow(idx, 1)}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_downward</span>
              </button>
              <button
                type="button"
                className="rent-plan-icon-btn is-danger"
                title="Διαγραφή"
                onClick={() => removeRow(idx)}
              >
                <span className="material-symbols-outlined text-[18px]">delete</span>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanPreview({ form, tone = 'teal' }) {
  const card = formToCard(form);
  const price = Number.isFinite(Number(form.monthlyEur)) ? Number(form.monthlyEur) : 0;
  return (
    <div className={`rent-plan-preview rent-plan-preview--${tone}${card.visible ? '' : ' is-hidden'}`}>
      {!card.visible ? (
        <p className="rent-plan-preview-hidden">Κρυφή στο /grafeia/rent</p>
      ) : null}
      <span className="rent-plan-preview-badge">{card.badge || 'Badge'}</span>
      <h4 className="rent-plan-preview-title">{card.name || 'Τίτλος'}</h4>
      <p className="rent-plan-preview-tagline">{card.tagline || 'Υπότιτλος…'}</p>
      <p className="rent-plan-preview-price">
        €{price}
        <span>/μήνα</span>
      </p>
      <ul className="rent-plan-preview-features">
        {(card.features.length ? card.features : ['Feature…']).slice(0, 6).map((f) => (
          <li key={f}>
            <span className="material-symbols-outlined" aria-hidden>
              check_circle
            </span>
            {f}
          </li>
        ))}
      </ul>
      <div className="rent-plan-preview-cta">{card.ctaLoggedIn || 'Κουμπί'}</div>
    </div>
  );
}

function CardEditor({ title, subtitle, tone, form, onChange, showServicesLink }) {
  const set = (patch) => onChange({ ...form, ...patch });

  return (
    <article className={`rent-plan-editor-card rent-plan-editor-card--${tone}`}>
      <header className="rent-plan-editor-card-head">
        <div className="min-w-0">
          <p className="rent-plan-editor-kicker">{tone === 'teal' ? 'Standalone' : 'Add-on'}</p>
          <h4 className="rent-plan-editor-title">{title}</h4>
          {subtitle ? <p className="rent-plan-editor-sub">{subtitle}</p> : null}
        </div>
        <label className={`rent-plan-toggle${form.visible ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={form.visible}
            onChange={(e) => set({ visible: e.target.checked })}
          />
          <span className="rent-plan-toggle-track" aria-hidden />
          <span className="rent-plan-toggle-text">{form.visible ? 'Εμφάνιση' : 'Κρυφή'}</span>
        </label>
      </header>

      <div className="rent-plan-editor-grid">
        <div className="rent-plan-editor-fields space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Badge">
              <input
                className="rent-plan-input"
                value={form.badge}
                onChange={(e) => set({ badge: e.target.value })}
              />
            </Field>
            <Field label="Τιμή (€ / μήνα)">
              <div className="rent-plan-price-wrap">
                <span aria-hidden>€</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className="rent-plan-input"
                  value={form.monthlyEur}
                  onChange={(e) => set({ monthlyEur: e.target.value })}
                />
              </div>
            </Field>
          </div>

          <Field label="Τίτλος">
            <input
              className="rent-plan-input rent-plan-input--lg"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>

          <Field label="Υπότιτλος">
            <input
              className="rent-plan-input"
              value={form.tagline}
              onChange={(e) => set({ tagline: e.target.value })}
            />
          </Field>

          <FeatureListEditor
            features={form.features}
            onChange={(features) => set({ features })}
          />

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Κουμπί (συνδεδεμένος)">
              <input
                className="rent-plan-input"
                value={form.ctaLoggedIn}
                onChange={(e) => set({ ctaLoggedIn: e.target.value })}
                placeholder="Εγγραφή"
              />
            </Field>
            <Field label="Κουμπί (επισκέπτης)">
              <input
                className="rent-plan-input"
                value={form.ctaGuest}
                onChange={(e) => set({ ctaGuest: e.target.value })}
                placeholder="Εγγραφή"
              />
            </Field>
          </div>

          {showServicesLink ? (
            <Field label="Link υπηρεσιών" hint="Κενό = χωρίς link">
              <input
                className="rent-plan-input"
                value={form.servicesLinkLabel}
                onChange={(e) => set({ servicesLinkLabel: e.target.value })}
              />
            </Field>
          ) : null}
        </div>

        <div className="rent-plan-editor-preview-col">
          <p className="rent-plan-field-label mb-2">Προεπισκόπηση</p>
          <PlanPreview form={form} tone={tone} />
        </div>
      </div>
    </article>
  );
}

export default function RentPlanCardsEditor() {
  const [sectionTitle, setSectionTitle] = useState(DEFAULT_RENT_SECTION_TITLE);
  const [standalone, setStandalone] = useState(cardToForm(RENT_STANDALONE_PLAN));
  const [addon, setAddon] = useState(cardToForm(RENT_ADDON));
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminRentPlanCatalog();
      const s = cardToForm(data.standalone);
      const a = cardToForm(data.addon);
      setSectionTitle(data.sectionTitle);
      setStandalone(s);
      setAddon(a);
      setSavedSnapshot(serializeSnapshot(data.sectionTitle, s, a));
    } catch {
      toast.error('Αποτυχία φόρτωσης καρτών Rent');
      const fallback = mergeRentPlanCatalog(null);
      const s = cardToForm(fallback.standalone);
      const a = cardToForm(fallback.addon);
      setSectionTitle(fallback.sectionTitle);
      setStandalone(s);
      setAddon(a);
      setSavedSnapshot(serializeSnapshot(fallback.sectionTitle, s, a));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = useMemo(
    () => serializeSnapshot(sectionTitle, standalone, addon) !== savedSnapshot,
    [sectionTitle, standalone, addon, savedSnapshot],
  );

  const onSave = async (e) => {
    e?.preventDefault?.();
    if (saving) return;
    setSaving(true);
    try {
      const payload = {
        sectionTitle,
        standalone: formToCard(standalone),
        addon: formToCard(addon),
      };
      const saved = await updateRentPlanCatalog(payload);
      const s = cardToForm(saved.standalone);
      const a = cardToForm(saved.addon);
      setSectionTitle(saved.sectionTitle);
      setStandalone(s);
      setAddon(a);
      setSavedSnapshot(serializeSnapshot(saved.sectionTitle, s, a));
      toast.success(
        `Αποθηκεύτηκε · ${saved.standalone.name} €${saved.standalone.monthlyEur}/μήνα`,
      );
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rent-plan-editor-loading">
        <span className="material-symbols-outlined animate-spin" aria-hidden>
          progress_activity
        </span>
        Φόρτωση καρτών συμβολαίων…
      </div>
    );
  }

  return (
    <form onSubmit={onSave} className="rent-plan-editor space-y-4">
      <div className="rent-plan-editor-hero">
        <div className="min-w-0">
          <p className="rent-plan-editor-kicker">Marketing · σελίδα συμβολαίων SaaS</p>
          <h3 className="rent-plan-editor-hero-title">Κάρτες τιμών ενοικιάσεων</h3>
          <p className="rent-plan-editor-hero-copy">
            Τιμές και κείμενα για τη δημόσια σελίδα /grafeia/rent. Η χαρτούρα κάθε κράτησης (υπογραφές,
            σύμβαση) είναι στο μενού «Χαρτούρα».
          </p>
        </div>
        <div className="rent-plan-editor-hero-actions">
          {dirty ? <span className="rent-plan-dirty">Μη αποθηκευμένες αλλαγές</span> : null}
          <button
            type="button"
            onClick={load}
            className="rent-plan-secondary-btn"
            disabled={saving}
          >
            Επαναφόρτωση
          </button>
          <a
            href="/grafeia/rent"
            target="_blank"
            rel="noreferrer"
            className="rent-plan-secondary-btn"
          >
            Άνοιγμα /grafeia/rent
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              open_in_new
            </span>
          </a>
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={onSave}
            className="rent-plan-primary-btn"
          >
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              save
            </span>
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
        </div>
      </div>

      <div className="rent-plan-section-bar">
        <Field label="Τίτλος ενότητας στη σελίδα συμβολαίων">
          <input
            className="rent-plan-input rent-plan-input--lg"
            value={sectionTitle}
            onChange={(e) => setSectionTitle(e.target.value)}
          />
        </Field>
      </div>

      <div className="space-y-4">
        <CardEditor
          title="PoreiaGo Rent"
          subtitle="Αυτόνομο συμβόλαιο — μόνο ενοικιάσεις"
          tone="teal"
          form={standalone}
          onChange={setStandalone}
        />
        <CardEditor
          title="Add-on Ενοικιάσεις"
          subtitle="Πάνω σε υπάρχον συμβόλαιο λεωφορείων"
          tone="slate"
          form={addon}
          onChange={setAddon}
          showServicesLink
        />
      </div>

      <div className="rent-plan-sticky-save">
        <p className="text-sm text-gray-500">
          {dirty ? 'Υπάρχουν αλλαγές προς αποθήκευση.' : 'Όλα αποθηκευμένα.'}
        </p>
        <button
          type="button"
          disabled={saving || !dirty}
          onClick={onSave}
          className="rent-plan-primary-btn"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            save
          </span>
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
      </div>
    </form>
  );
}
