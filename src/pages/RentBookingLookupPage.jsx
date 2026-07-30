import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import OfficeBrandMark from '../components/storefront/OfficeBrandMark.jsx';
import { getCustomerToken } from '../lib/auth.js';
import { lookupPublicRentalBooking } from '../services/customerRentalApi.js';
import { fetchSiteAppearance } from '../services/siteAppearanceApi.js';
import '../styles/booking-lookup.css';

const EMAIL_KEY = 'poreiago_rent_lookup_email_v1';

function normalizeReference(raw) {
  let s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!s) return '';
  s = s.replace(/^#/, '');
  if (s.startsWith('BK-')) s = `RB-${s.slice(3)}`;
  if (!s.startsWith('RB-') && /^[A-Z0-9]{6,}$/.test(s)) s = `RB-${s.slice(0, 8)}`;
  return s;
}

function extractFromPaste(text) {
  const raw = String(text || '');
  const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const refMatch =
    raw.match(/\bRB[-\s]?[A-Z0-9]{4,}\b/i) ||
    raw.match(/\b(?:κωδικός|reference|ref|booking)[:\s#]*([A-Z0-9-]{5,})\b/i);
  return {
    email: emailMatch ? emailMatch[0].toLowerCase() : '',
    reference: refMatch ? normalizeReference(refMatch[0].replace(/^.*?([A-Z0-9-]+)$/i, '$1')) : '',
  };
}

export default function RentBookingLookupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [reference, setReference] = useState('');
  const [fieldError, setFieldError] = useState({ email: '', reference: '' });
  const [helpOpen, setHelpOpen] = useState(false);
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let cancelled = false;
    const qEmail = searchParams.get('email') || '';
    const qRef = searchParams.get('ref') || searchParams.get('reference') || searchParams.get('code') || '';
    let saved = '';
    try {
      saved = localStorage.getItem(EMAIL_KEY) || '';
    } catch {
      /* ignore */
    }
    if (!cancelled) {
      setEmail((qEmail || saved).trim().toLowerCase());
      if (qRef) setReference(normalizeReference(qRef));
    }
    fetchSiteAppearance()
      .then((data) => {
        if (!cancelled) setPhone(String(data?.footer_contact_phone || '').trim());
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const canSubmit = useMemo(
    () => Boolean(email.trim() && reference.trim() && !loading),
    [email, reference, loading],
  );

  const validate = () => {
    const next = { email: '', reference: '' };
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Βάλτε έγκυρο email από την κράτηση ενοικίασης';
    }
    if (!reference.trim() || reference.trim().length < 4) {
      next.reference = 'Βάλτε τον κωδικό αναφοράς (π.χ. RB-AB12CD34)';
    }
    setFieldError(next);
    return !next.email && !next.reference;
  };

  const handlePasteReference = (e) => {
    const text = e.clipboardData?.getData('text') || '';
    if (!text || (!text.includes('@') && !/RB/i.test(text) && text.length < 40)) return;
    const parsed = extractFromPaste(text);
    if (!parsed.email && !parsed.reference) return;
    e.preventDefault();
    if (parsed.email) setEmail(parsed.email);
    if (parsed.reference) setReference(parsed.reference);
    toast.success('Αναγνωρίστηκαν στοιχεία από το επικολλημένο κείμενο');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    const cleanRef = normalizeReference(reference);
    setReference(cleanRef);
    try {
      localStorage.setItem(EMAIL_KEY, cleanEmail);
    } catch {
      /* ignore */
    }

    try {
      const booking = await lookupPublicRentalBooking({
        email: cleanEmail,
        reference: cleanRef,
      });
      if (!booking) {
        setFieldError({
          email: '',
          reference: 'Δεν βρέθηκε κράτηση ενοικίασης με αυτά τα στοιχεία',
        });
        toast.error('Δεν βρέθηκε κράτηση. Ελέγξτε email και κωδικό (π.χ. RB-…).');
        return;
      }

      const navState = {
        rentLookup: true,
        openRentWallet: true,
        highlightRentalBooking: booking.id,
        rentLookupEmail: cleanEmail,
        rentLookupRef: booking.reference_code || cleanRef,
      };

      if (getCustomerToken()) {
        toast.success('Η κράτηση ενοικίασης βρέθηκε');
        navigate('/rent', { replace: true, state: navState });
        return;
      }

      toast.success('Βρέθηκε η κράτηση — συνδεθείτε στο Rent Wallet');
      navigate('/rent', {
        replace: true,
        state: {
          ...navState,
          rentContinue: false,
          from: '/rent',
          rentEntrance: true,
        },
      });
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αναζήτησης');
    } finally {
      setLoading(false);
    }
  };

  const tel = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : '';

  return (
    <div className="booking-lookup-shell booking-lookup-shell--rent">
      <div className="booking-lookup-glow booking-lookup-glow--a" aria-hidden />
      <div className="booking-lookup-glow booking-lookup-glow--b" aria-hidden />
      <div className="booking-lookup-grid" aria-hidden />

      <header className="booking-lookup-top">
        <Link to="/rent" className="booking-lookup-back">
          <span className="material-symbols-outlined" aria-hidden>
            arrow_back
          </span>
          Ενοικίαση
        </Link>
        <OfficeBrandMark className="h-8" variant="light" />
      </header>

      <main className="booking-lookup-main">
        <section className="booking-lookup-card" aria-labelledby="rent-booking-lookup-title">
          <div className="booking-lookup-steps" aria-hidden>
            <span className="is-active">1 · Στοιχεία</span>
            <span className="booking-lookup-steps-line" />
            <span>2 · Κράτηση</span>
          </div>

          <div className="booking-lookup-icon" aria-hidden>
            <span className="material-symbols-outlined">directions_car</span>
          </div>

          <h1 id="rent-booking-lookup-title" className="booking-lookup-title">
            Εύρεση κράτησης ενοικίασης
          </h1>
          <p className="booking-lookup-lead">
            Συμπλήρωσε το email και τον κωδικό από το μήνυμα επιβεβαίωσης για να ανοίξεις την κράτηση
            οχήματος στο Rent Wallet.
          </p>

          <form onSubmit={handleSubmit} className="booking-lookup-form" noValidate>
            <label className={`booking-lookup-field ${fieldError.email ? 'has-error' : ''}`} htmlFor="email">
              <span>Email κράτησης</span>
              <div className="booking-lookup-input-wrap">
                <span className="material-symbols-outlined" aria-hidden>
                  mail
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (fieldError.email) setFieldError((f) => ({ ...f, email: '' }));
                  }}
                />
              </div>
              {fieldError.email ? <em>{fieldError.email}</em> : null}
            </label>

            <label
              className={`booking-lookup-field ${fieldError.reference ? 'has-error' : ''}`}
              htmlFor="reference"
            >
              <span>Κωδικός αναφοράς</span>
              <div className="booking-lookup-input-wrap">
                <span className="material-symbols-outlined" aria-hidden>
                  tag
                </span>
                <input
                  id="reference"
                  name="reference"
                  type="text"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  className="is-mono"
                  placeholder="RB-XXXXXXXX"
                  value={reference}
                  onPaste={handlePasteReference}
                  onChange={(e) => {
                    setReference(e.target.value.toUpperCase());
                    if (fieldError.reference) setFieldError((f) => ({ ...f, reference: '' }));
                  }}
                  onBlur={() => {
                    if (reference.trim()) setReference(normalizeReference(reference));
                  }}
                />
              </div>
              {fieldError.reference ? (
                <em>{fieldError.reference}</em>
              ) : (
                <small>Μπορείς να επικολλήσεις ολόκληρο το email επιβεβαίωσης</small>
              )}
            </label>

            <button type="submit" disabled={!canSubmit} className="booking-lookup-submit">
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin" aria-hidden>
                    progress_activity
                  </span>
                  Αναζήτηση…
                </>
              ) : (
                <>
                  Εμφάνιση κράτησης
                  <span className="material-symbols-outlined" aria-hidden>
                    arrow_forward
                  </span>
                </>
              )}
            </button>
          </form>

          <button
            type="button"
            className="booking-lookup-help-toggle"
            aria-expanded={helpOpen}
            onClick={() => setHelpOpen((o) => !o)}
          >
            <span className="material-symbols-outlined" aria-hidden>
              {helpOpen ? 'expand_less' : 'help'}
            </span>
            Πού βρίσκω τον κωδικό;
          </button>

          {helpOpen ? (
            <div className="booking-lookup-help">
              <ol>
                <li>Άνοιξε το email επιβεβαίωσης ενοικίασης.</li>
                <li>
                  Ψάξε για κωδικό τύπου <strong>RB-…</strong> (αναφορά κράτησης οχήματος).
                </li>
                <li>Χρησιμοποίησε το ίδιο email με την κράτηση.</li>
              </ol>
              {tel ? (
                <p>
                  Χρειάζεσαι βοήθεια;{' '}
                  <a href={tel} className="booking-lookup-phone">
                    Κάλεσε {phone}
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}

          <p className="booking-lookup-note">
            Για λόγους απορρήτου χρειάζονται και τα δύο στοιχεία — δεν εμφανίζονται όλες οι κρατήσεις του
            email. Τα εισιτήρια λεωφορείου είναι στο{' '}
            <Link to="/my-booking">My Wallet λεωφορείων</Link>.
          </p>

          <div className="booking-lookup-footer-links">
            <Link
              to="/rent"
              state={{ from: '/rent', rentEntrance: true }}
              className="booking-lookup-wallet"
            >
              Σύνδεση στο Rent Wallet
            </Link>
            {tel ? (
              <a href={tel} className="booking-lookup-phone">
                <span className="material-symbols-outlined" aria-hidden>
                  call
                </span>
                {phone}
              </a>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
