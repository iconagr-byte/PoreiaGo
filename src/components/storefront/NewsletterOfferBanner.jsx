import { useEffect, useRef, useState } from 'react';
import { subscribeNewsletter } from '../../services/newsletterApi.js';
import '../../styles/newsletter-offer-banner.css';

const COPY = {
  trips: {
    eyebrow: 'Newsletter',
    title: 'Μην χάσεις καμία προσφορά',
    subtitle: 'Κάνε εγγραφή και λάβε πρώτος τις αποκλειστικές μας προσφορές εκδρομών.',
    cityLabel: 'Προτιμώμενη πόλη αναχώρησης',
    cityPlaceholder: 'π.χ. Αθήνα',
    image: '/images/newsletter-bus-interior.png',
    imageAlt: 'Εσωτερικό σύγχρονου λεωφορείου ταξιδιού',
  },
  rent: {
    eyebrow: 'Rent offers',
    title: 'Προσφορές ενοικίασης στο inbox σου',
    subtitle: 'Ενημερώσου πρώτος για εκπτώσεις στόλου και νέα οχήματα.',
    cityLabel: 'Προτιμώμενη πόλη παραλαβής',
    cityPlaceholder: 'π.χ. Ηράκλειο',
    image: '/images/newsletter-rent-road.png',
    imageAlt: 'Θέα από το εσωτερικό οχήματος ενοικίασης',
  },
};

/**
 * Split photo + dark form newsletter CTA (office storefront / rent landing).
 * @param {'trips'|'rent'} variant
 */
export default function NewsletterOfferBanner({
  variant = 'trips',
  privacyUrl = '#',
  privacyLabel = 'Πολιτική Απορρήτου',
}) {
  const cfg = COPY[variant === 'rent' ? 'rent' : 'trips'];
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.18 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!consent) {
      setError('Χρειάζεται να αποδεχτείς τους όρους ενημέρωσης.');
      return;
    }
    setBusy(true);
    try {
      await subscribeNewsletter({
        email,
        preferredCity: city,
        consent,
        source: variant === 'rent' ? 'rent' : 'trips',
      });
      setDone(true);
      setEmail('');
      setCity('');
      setConsent(false);
    } catch (err) {
      setError(err?.message || 'Αποτυχία εγγραφής');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      ref={rootRef}
      className={`nl-offer nl-offer--${variant === 'rent' ? 'rent' : 'trips'}${
        visible ? ' nl-offer--in' : ''
      }`}
      aria-label="Εγγραφή στο newsletter"
    >
      <div className="nl-offer-shell">
        <div className="nl-offer-media" aria-hidden={false}>
          <img src={cfg.image} alt={cfg.imageAlt} loading="lazy" decoding="async" />
          <div className="nl-offer-media-veil" aria-hidden />
        </div>

        <div className="nl-offer-panel">
          <p className="nl-offer-eyebrow">{cfg.eyebrow}</p>
          <h2 className="nl-offer-title">{cfg.title}</h2>
          <p className="nl-offer-sub">{cfg.subtitle}</p>

          {done ? (
            <p className="nl-offer-success" role="status">
              Ευχαριστούμε — θα σε ενημερώνουμε για νέες προσφορές.
            </p>
          ) : (
            <form className="nl-offer-form" onSubmit={onSubmit} noValidate>
              <div className="nl-offer-fields">
                <label className="nl-offer-field">
                  <span className="sr-only">Διεύθυνση email</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    placeholder="Διεύθυνση email"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    disabled={busy}
                  />
                </label>
                <label className="nl-offer-field">
                  <span className="sr-only">{cfg.cityLabel}</span>
                  <input
                    type="text"
                    name="preferred_city"
                    autoComplete="address-level2"
                    placeholder={cfg.cityPlaceholder}
                    value={city}
                    onChange={(ev) => setCity(ev.target.value)}
                    disabled={busy}
                  />
                </label>
              </div>

              <label className="nl-offer-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(ev) => setConsent(ev.target.checked)}
                  disabled={busy}
                />
                <span>
                  Συμφωνώ να λαμβάνω ενημερωτικά email με προσφορές. Μπορώ να διαγραφώ
                  οποιαδήποτε στιγμή. Δες την{' '}
                  <a href={privacyUrl || '#'} target="_blank" rel="noreferrer">
                    {privacyLabel || 'Πολιτική Απορρήτου'}
                  </a>
                  .
                </span>
              </label>

              {error ? (
                <p className="nl-offer-error" role="alert">
                  {error}
                </p>
              ) : null}

              <button type="submit" className="nl-offer-submit" disabled={busy}>
                {busy ? 'Αποστολή…' : 'Εγγραφή'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
