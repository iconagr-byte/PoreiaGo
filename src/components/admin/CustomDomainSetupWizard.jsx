import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  checkTenantDomainDns,
  fetchTenantBrandingSettings,
  provisionTenantDomainEdge,
  updateTenantBrandingSettings,
} from '../../services/growthApi.js';
import { DEFAULT_INGRESS_CNAME } from '../../lib/platform/domain.js';
import '../../styles/custom-domain-wizard.css';

const MINI_STEPS = [
  { id: 'intro', title: 'Το δικό σας domain' },
  { id: 'enter', title: 'Καταχώρηση' },
  { id: 'dns', title: 'DNS' },
  { id: 'verify', title: 'Έλεγχος' },
  { id: 'live', title: 'Έτοιμο' },
];

function normalizeApex(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/^www\./, '');
}

function copyText(value, okMsg) {
  const text = String(value || '').trim();
  if (!text) return;
  navigator.clipboard
    ?.writeText(text)
    .then(() => toast.success(okMsg || 'Αντιγράφηκε'))
    .catch(() => toast.error('Αποτυχία αντιγραφής'));
}

/**
 * Step-by-step custom domain setup (Achillio-style) for any office.
 * Used in OfficeSetupWizard (first login) and BrandingPanel (Settings → Domain).
 */
export default function CustomDomainSetupWizard({
  compact = false,
  embedded = false,
  onComplete,
  onSkip,
  initialDomain = '',
}) {
  const [mini, setMini] = useState(0);
  const [domain, setDomain] = useState(() => normalizeApex(initialDomain));
  const [dns, setDns] = useState({
    cname_host: '',
    cname_target: DEFAULT_INGRESS_CNAME,
    apex_host: '',
    apex_a_record: '169.58.199.186',
  });
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [dnsCheck, setDnsCheck] = useState(null);
  const [saved, setSaved] = useState(Boolean(normalizeApex(initialDomain)));
  const [loaded, setLoaded] = useState(false);

  const stepMeta = MINI_STEPS[mini] || MINI_STEPS[0];
  const apex = normalizeApex(domain);
  const cnameHost = dns.cname_host || (apex ? `www.${apex}` : 'www.your-domain.gr');
  const cnameTarget = dns.cname_target || DEFAULT_INGRESS_CNAME;
  const apexHost = dns.apex_host || apex || 'your-domain.gr';
  const apexA = dns.apex_a_record || '169.58.199.186';
  const cnameLine = `${cnameHost}  CNAME  ${cnameTarget}`;
  const apexLine = `${apexHost}  A  ${apexA}`;

  const progress = useMemo(
    () => MINI_STEPS.map((_, i) => (i < mini ? 'is-done' : i === mini ? 'is-active' : '')),
    [mini],
  );

  const load = useCallback(async () => {
    try {
      const data = await fetchTenantBrandingSettings();
      const existing = normalizeApex(data.custom_domain || initialDomain);
      if (existing) {
        setDomain(existing);
        setSaved(true);
        if (!initialDomain) setMini(2);
      }
      if (data.dns_instructions) {
        setDns((d) => ({ ...d, ...data.dns_instructions }));
      }
    } catch {
      /* first-time office may not have branding yet */
    } finally {
      setLoaded(true);
    }
  }, [initialDomain]);

  useEffect(() => {
    load();
  }, [load]);

  const saveDomain = async () => {
    if (!apex || !apex.includes('.')) {
      toast.error('Δώσε έγκυρο domain (π.χ. myagency.gr) — χωρίς www');
      return false;
    }
    setBusy(true);
    try {
      const data = await updateTenantBrandingSettings({ custom_domain: apex });
      setDomain(normalizeApex(data.custom_domain || apex));
      if (data.dns_instructions) setDns((d) => ({ ...d, ...data.dns_instructions }));
      setSaved(true);
      toast.success('Το domain αποθηκεύτηκε');
      return true;
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης domain');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const runDnsCheck = async () => {
    if (!apex) {
      toast.error('Συμπλήρωσε πρώτα το domain');
      return null;
    }
    setChecking(true);
    try {
      const result = await checkTenantDomainDns(apex);
      setDnsCheck(result);
      if (result?.ready_for_tls) toast.success(result.message || 'DNS έτοιμο');
      else toast(result?.message || 'DNS σε εκκρεμότητα', { icon: 'ℹ️' });
      return result;
    } catch (err) {
      toast.error(err.message || 'Αποτυχία ελέγχου DNS');
      const fail = { ready_for_tls: false, message: err.message || 'Αποτυχία' };
      setDnsCheck(fail);
      return fail;
    } finally {
      setChecking(false);
    }
  };

  const runProvision = async () => {
    if (!apex) return null;
    setProvisioning(true);
    try {
      const result = await provisionTenantDomainEdge(apex);
      setDnsCheck(result);
      toast.success(result?.ready_for_tls ? 'Edge sync OK' : 'Edge sync ολοκληρώθηκε');
      return result;
    } catch (err) {
      toast.error(err.message || 'Αποτυχία edge sync');
      return null;
    } finally {
      setProvisioning(false);
    }
  };

  const goNext = async () => {
    const id = MINI_STEPS[mini].id;
    if (id === 'intro') {
      setMini(1);
      return;
    }
    if (id === 'enter') {
      if (!(await saveDomain())) return;
      setMini(2);
      return;
    }
    if (id === 'dns') {
      setMini(3);
      return;
    }
    if (id === 'verify') {
      let status = dnsCheck;
      if (!status) status = await runDnsCheck();
      if (apex) {
        const provisioned = await runProvision();
        if (provisioned) status = provisioned;
      }
      setMini(4);
      return;
    }
    if (id === 'live') {
      onComplete?.({ domain: apex, dnsCheck, saved: true });
    }
  };

  const goBack = () => setMini((m) => Math.max(0, m - 1));

  const skip = () => {
    onSkip?.();
  };

  if (!loaded && !embedded) {
    return (
      <div className={`cdw-root${compact ? ' is-compact' : ''}`}>
        <p className="cdw-muted">Φόρτωση domain…</p>
      </div>
    );
  }

  return (
    <div className={`cdw-root${compact ? ' is-compact' : ''}${embedded ? ' is-embedded' : ''}`}>
      <div className="cdw-progress" aria-hidden>
        {progress.map((cls, i) => (
          <span key={MINI_STEPS[i].id} className={cls} title={MINI_STEPS[i].title} />
        ))}
      </div>
      <p className="cdw-step-label">
        Βήμα {mini + 1} από {MINI_STEPS.length} · {stepMeta.title}
      </p>

      {MINI_STEPS[mini].id === 'intro' && (
        <div className="cdw-pane">
          <h3 className="cdw-title">Συνδέστε το δικό σας domain</h3>
          <p className="cdw-copy">
            Όπως το Achillio Travel με <strong>achilliotravel.com</strong> — χωρίς αλλαγή nameservers.
            Αρκεί ένα CNAME στο DNS του παρόχου σας.
          </p>
          <ol className="cdw-list">
            <li>Καταχωρείτε το domain στο PoreiaGo</li>
            <li>Βάζετε CNAME: <code>www</code> → <code>www.poreiago.com</code></li>
            <li>Ελέγχουμε το DNS και ενεργοποιούμε HTTPS</li>
          </ol>
        </div>
      )}

      {MINI_STEPS[mini].id === 'enter' && (
        <div className="cdw-pane">
          <h3 className="cdw-title">Ποιο είναι το domain σας;</h3>
          <p className="cdw-copy">Χωρίς www — π.χ. <code>myagency.gr</code></p>
          <label className="cdw-field">
            <span>Custom domain</span>
            <input
              className="cdw-input"
              value={domain}
              onChange={(e) => setDomain(normalizeApex(e.target.value))}
              placeholder="myagency.gr"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          {saved && apex ? (
            <p className="cdw-ok">Αποθηκευμένο: {apex}</p>
          ) : null}
        </div>
      )}

      {MINI_STEPS[mini].id === 'dns' && (
        <div className="cdw-pane">
          <h3 className="cdw-title">Ρυθμίστε το DNS</h3>
          <p className="cdw-copy">
            Στον πάροχο όπου αγοράσατε το domain (π.χ. GoDaddy, Cloudflare, Papaki), προσθέστε:
          </p>
          <div className="cdw-dns-card">
            <p className="cdw-dns-kicker">1 · Υποχρεωτικό</p>
            <code className="cdw-dns-line">{cnameLine}</code>
            <button type="button" className="cdw-chip" onClick={() => copyText(cnameLine, 'CNAME αντιγράφηκε')}>
              Αντιγραφή CNAME
            </button>
          </div>
          <div className="cdw-dns-card">
            <p className="cdw-dns-kicker">2 · Προαιρετικό (χωρίς www)</p>
            <code className="cdw-dns-line">{apexLine}</code>
            <button type="button" className="cdw-chip" onClick={() => copyText(apexLine, 'A record αντιγράφηκε')}>
              Αντιγραφή A
            </button>
          </div>
          <p className="cdw-hint">
            Η διάδοση DNS μπορεί να πάρει λίγα λεπτά. Μπορείτε να συνεχίσετε και να ελέγξετε μετά.
          </p>
        </div>
      )}

      {MINI_STEPS[mini].id === 'verify' && (
        <div className="cdw-pane">
          <h3 className="cdw-title">Έλεγχος DNS &amp; σύνδεση</h3>
          <p className="cdw-copy">
            Πατήστε έλεγχο όταν έχετε αποθηκεύσει τις εγγραφές στον πάροχο DNS.
          </p>
          <div className="cdw-actions-inline">
            <button
              type="button"
              className="cdw-btn cdw-btn-secondary"
              disabled={checking || !apex}
              onClick={runDnsCheck}
            >
              {checking ? 'Έλεγχος…' : 'Έλεγχος DNS'}
            </button>
            <button
              type="button"
              className="cdw-btn cdw-btn-secondary"
              disabled={provisioning || !apex}
              onClick={runProvision}
            >
              {provisioning ? 'Sync…' : 'Edge sync'}
            </button>
          </div>
          {dnsCheck ? (
            <div className={`cdw-status${dnsCheck.ready_for_tls ? ' is-ok' : ' is-wait'}`}>
              <strong>
                www {dnsCheck.www_ok ? '✓' : '✗'} · apex {dnsCheck.apex_ok ? '✓' : '✗'}
                {dnsCheck.ready_for_tls ? ' · έτοιμο για TLS' : ''}
              </strong>
              {dnsCheck.message ? <p>{dnsCheck.message}</p> : null}
            </div>
          ) : (
            <p className="cdw-hint">Δεν έχει γίνει ακόμα έλεγχος.</p>
          )}
        </div>
      )}

      {MINI_STEPS[mini].id === 'live' && (
        <div className="cdw-pane cdw-pane-done">
          <div className="cdw-orb" aria-hidden>
            ✓
          </div>
          <h3 className="cdw-title">
            {dnsCheck?.ready_for_tls ? 'Το domain είναι έτοιμο' : 'Domain καταχωρημένο'}
          </h3>
          <p className="cdw-copy">
            {apex ? (
              <>
                Δημόσια διεύθυνση: <strong>https://www.{apex}</strong>
              </>
            ) : (
              'Μπορείτε να ολοκληρώσετε το DNS αργότερα από Ρυθμίσεις → Domain.'
            )}
          </p>
          {!dnsCheck?.ready_for_tls && apex ? (
            <p className="cdw-hint">
              Αν το CNAME δεν έχει διαδοθεί ακόμα, ξαναπατήστε «Έλεγχος DNS» στις Ρυθμίσεις σε λίγο.
            </p>
          ) : null}
        </div>
      )}

      <div className="cdw-footer">
        {mini > 0 && MINI_STEPS[mini].id !== 'live' ? (
          <button type="button" className="cdw-btn cdw-btn-ghost" onClick={goBack}>
            Πίσω
          </button>
        ) : (
          <span />
        )}
        <div className="cdw-footer-right">
          {typeof onSkip === 'function' && MINI_STEPS[mini].id !== 'live' ? (
            <button type="button" className="cdw-btn cdw-btn-secondary" onClick={skip}>
              Αργότερα
            </button>
          ) : null}
          <button
            type="button"
            className="cdw-btn cdw-btn-primary"
            disabled={busy || checking || provisioning}
            onClick={goNext}
          >
            {busy
              ? 'Αποθήκευση…'
              : MINI_STEPS[mini].id === 'intro'
                ? 'Ξεκινάμε'
                : MINI_STEPS[mini].id === 'enter'
                  ? 'Αποθήκευση & συνέχεια'
                  : MINI_STEPS[mini].id === 'live'
                    ? embedded
                      ? 'Συνέχεια ρύθμισης'
                      : 'Ολοκλήρωση'
                    : 'Συνέχεια'}
          </button>
        </div>
      </div>
    </div>
  );
}
