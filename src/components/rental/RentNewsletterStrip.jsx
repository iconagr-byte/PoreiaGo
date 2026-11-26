/**
 * Split photo + seafoam newsletter CTA under /rent services mosaic.
 * Office-configurable copy/colors — email + consent only (no interest checkboxes).
 */
import { useEffect, useRef, useState } from 'react';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import { subscribeNewsletter } from '../../services/newsletterApi.js';
import { resolveRentNewsletterStrip } from '../../lib/rental/rentNewsletterStrip.js';

export default function RentNewsletterStrip({ appearance = {} } = {}) {
  const cfg = resolveRentNewsletterStrip(appearance);
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
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
      { threshold: 0.16 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (!cfg.enabled) return null;

  const imageSrc = cfg.image_url ? resolveSiteAssetUrl(cfg.image_url) : '';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!consent) {
      setError('Χρειάζεται να συμφωνήσεις με την Πολιτική Απορρήτου.');
      return;
    }
    setBusy(true);
    try {
      await subscribeNewsletter({
        email,
        preferredCity: '',
        consent,
        source: 'rent',
      });
      setDone(true);
      setEmail('');
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
      id="rent-newsletter-strip"
      className={`rent-nl${visible ? ' rent-nl--in' : ''}`}
      aria-labelledby="rent-nl-title"
      style={{ '--rent-nl-panel': cfg.panel_color }}
    >
      <div className="rent-nl-shell">
        <div className="rent-nl-media">
          {imageSrc ? (
            <img src={imageSrc} alt="" loading="lazy" decoding="async" />
          ) : (
            <div className="rent-nl-media-fallback" aria-hidden />
          )}
        </div>

        <div className="rent-nl-panel">
          <h2 id="rent-nl-title" className="rent-nl-title">
            {cfg.title}
          </h2>

          {done ? (
            <p className="rent-nl-success" role="status">
              Ευχαριστούμε — θα λαμβάνεις τα νέα του γραφείου στο inbox σου.
            </p>
          ) : (
            <form className="rent-nl-form" onSubmit={onSubmit} noValidate>
              <div className="rent-nl-email-row">
                <label className="rent-nl-email-field">
                  <span className="rent-nl-email-label">Email</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    placeholder={cfg.email_placeholder}
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    disabled={busy}
                  />
                </label>
                <button type="submit" className="rent-nl-submit" disabled={busy}>
                  {busy ? 'Αποστολή…' : cfg.button_label}
                </button>
              </div>

              <label className="rent-nl-consent">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(ev) => setConsent(ev.target.checked)}
                  disabled={busy}
                />
                <span>
                  Έχω διαβάσει και συμφωνώ με την{' '}
                  <a href={cfg.privacy_url || '#'} target="_blank" rel="noreferrer">
                    {cfg.privacy_label || 'Πολιτική Απορρήτου'}
                  </a>
                </span>
              </label>

              {error ? (
                <p className="rent-nl-error" role="alert">
                  {error}
                </p>
              ) : null}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
