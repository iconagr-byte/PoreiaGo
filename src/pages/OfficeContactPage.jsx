import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import StorefrontHeader from '../components/storefront/StorefrontHeader.jsx';
import StorefrontFooter from '../components/storefront/StorefrontFooter.jsx';
import {
  DEFAULT_SITE_APPEARANCE,
  fetchSiteAppearance,
} from '../services/siteAppearanceApi.js';
import {
  DEFAULT_OFFICE_MODULES,
  fetchOfficeModules,
  shouldShowRentStorefront,
} from '../services/officeModulesApi.js';
import { resolveFooterContact } from '../lib/storefront/footerContact.js';
import { resolveOfficeBrand } from '../lib/branding/officeBrand.js';
import { submitOfficeContact } from '../services/officeContactApi.js';
import { isPlatformMarketingHost } from '../lib/platform/tenantHost.js';
import '../styles/office-contact.css';

const EMPTY = { name: '', email: '', phone: '', subject: '', message: '', website: '' };

export default function OfficeContactPage() {
  const [appearance, setAppearance] = useState(DEFAULT_SITE_APPEARANCE);
  const [modules, setModules] = useState(DEFAULT_OFFICE_MODULES);
  const [form, setForm] = useState(EMPTY);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetchSiteAppearance()
      .then((a) => {
        if (!cancelled && a) setAppearance(a);
      })
      .catch(() => {});
    fetchOfficeModules()
      .then((m) => {
        if (!cancelled && m) setModules(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const brand = resolveOfficeBrand(appearance);
  const contact = resolveFooterContact(appearance);
  const tripsEnabled = modules.trips_enabled !== false;
  const rentEnabled = shouldShowRentStorefront(modules);
  const marketing = isPlatformMarketingHost();

  const onChange = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const validateLocal = () => {
    const name = String(form.name || '').trim();
    const email = String(form.email || '').trim();
    const message = String(form.message || '').trim();
    if (name.length < 2) return 'Συμπληρώστε το ονοματεπώνυμό σας.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Μη έγκυρο email.';
    if (message.length < 10) return 'Το μήνυμα πρέπει να έχει τουλάχιστον 10 χαρακτήρες.';
    return '';
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const localErr = validateLocal();
    if (localErr) {
      setFormError(localErr);
      toast.error(localErr);
      return;
    }
    setFormError('');
    setSending(true);
    try {
      await submitOfficeContact(form);
      setSent(true);
      setForm(EMPTY);
      setFormError('');
      toast.success('Το μήνυμα στάλθηκε στο γραφείο.');
    } catch (err) {
      const msg = err?.message || 'Αποτυχία αποστολής.';
      setFormError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  if (marketing) {
    return (
      <div className="oc-page">
        <div className="oc-shell">
          <div className="oc-card">
            <p className="oc-kicker">Επικοινωνία</p>
            <h1 className="oc-title">Φόρμα γραφείου</h1>
            <p className="oc-lead">
              Η φόρμα επικοινωνίας είναι διαθέσιμη μόνο στις σελίδες των γραφείων
              (όχι στο poreiago.com).
            </p>
            <Link className="oc-back" to="/">
              ← Αρχική
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="oc-page storefront-themed">
      <StorefrontHeader
        siteAppearance={appearance}
        templateId={appearance.header_template || 'glass_dark'}
        tripsEnabled={tripsEnabled}
        rentEnabled={rentEnabled}
      />
      <main className="oc-shell">
        <div className="oc-card">
          <p className="oc-kicker">Επικοινωνία</p>
          <h1 className="oc-title">Στείλτε μήνυμα στο γραφείο</h1>
          <p className="oc-lead">
            Συμπληρώστε τη φόρμα και θα λάβουμε το μήνυμά σας στο email του{' '}
            {brand.displayName || brand.name}.
          </p>
          {contact.email ? (
            <p className="oc-to">
              <span className="material-symbols-outlined" aria-hidden>
                mail
              </span>
              {contact.email}
            </p>
          ) : null}

          {sent ? (
            <div className="oc-success">
              <span className="material-symbols-outlined" aria-hidden>
                check_circle
              </span>
              <h2 className="oc-title" style={{ fontSize: '1.35rem', marginTop: '0.5rem' }}>
                Ευχαριστούμε!
              </h2>
              <p className="oc-lead">Το μήνυμά σας στάλθηκε. Θα σας απαντήσουμε σύντομα.</p>
              <div className="oc-actions" style={{ justifyContent: 'center' }}>
                <button type="button" className="oc-submit" onClick={() => setSent(false)}>
                  Νέο μήνυμα
                </button>
                <Link className="oc-back" to="/">
                  Αρχική
                </Link>
              </div>
            </div>
          ) : (
            <form className="oc-form" onSubmit={onSubmit} noValidate>
              {formError ? (
                <div className="oc-error" role="alert">
                  {formError}
                </div>
              ) : null}
              <div className="oc-row">
                <div className="oc-field">
                  <label htmlFor="oc-name">Ονοματεπώνυμο *</label>
                  <input
                    id="oc-name"
                    name="name"
                    autoComplete="name"
                    required
                    value={form.name}
                    onChange={onChange('name')}
                    placeholder="π.χ. Μαρία Παπαδοπούλου"
                  />
                </div>
                <div className="oc-field">
                  <label htmlFor="oc-email">Email *</label>
                  <input
                    id="oc-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={form.email}
                    onChange={onChange('email')}
                    placeholder="name@email.com"
                  />
                </div>
              </div>
              <div className="oc-row">
                <div className="oc-field">
                  <label htmlFor="oc-phone">Τηλέφωνο</label>
                  <input
                    id="oc-phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={onChange('phone')}
                    placeholder="+30 …"
                  />
                </div>
                <div className="oc-field">
                  <label htmlFor="oc-subject">Θέμα</label>
                  <input
                    id="oc-subject"
                    name="subject"
                    value={form.subject}
                    onChange={onChange('subject')}
                    placeholder="π.χ. Ερώτηση για εκδρομή"
                  />
                </div>
              </div>
              <div className="oc-field">
                <label htmlFor="oc-message">Μήνυμα *</label>
                <textarea
                  id="oc-message"
                  name="message"
                  required
                  value={form.message}
                  onChange={onChange('message')}
                  placeholder="Γράψτε το μήνυμά σας…"
                />
              </div>
              {/* Honeypot */}
              <div className="oc-hp" aria-hidden>
                <label htmlFor="oc-website">Website</label>
                <input
                  id="oc-website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.website}
                  onChange={onChange('website')}
                />
              </div>
              <div className="oc-actions">
                <button type="submit" className="oc-submit" disabled={sending}>
                  <span className="material-symbols-outlined text-[18px]" aria-hidden>
                    send
                  </span>
                  {sending ? 'Αποστολή…' : 'Αποστολή μηνύματος'}
                </button>
                <Link className="oc-back" to="/">
                  ← Πίσω
                </Link>
              </div>
            </form>
          )}
        </div>
      </main>
      <StorefrontFooter
        siteAppearance={appearance}
        templateId={appearance.footer_template || 'classic_columns'}
        tripsEnabled={tripsEnabled}
        rentEnabled={rentEnabled}
      />
    </div>
  );
}
