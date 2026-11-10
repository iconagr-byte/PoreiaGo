import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchPlatformSettings,
  updatePlatformSettings,
  createFleetVehicle,
} from '../../services/platformApi.js';
import {
  fetchAdminPaymentSettings,
  updatePaymentSettings,
  createBankAccount,
} from '../../services/paymentSettingsApi.js';
import { fetchAdminSiteAppearance } from '../../services/siteAppearanceApi.js';
import { createRentalVehicle } from '../../services/fleetRentalApi.js';
import {
  fetchTenantBrandingSettings,
  updateTenantBrandingSettings,
} from '../../services/growthApi.js';
import { getSaasTenantId } from '../../services/saasApi.js';
import {
  DEFAULT_INGRESS_CNAME,
  getDefaultIngressCname,
  getPlatformBaseDomain,
} from '../../lib/platform/domain.js';
import EmailConnectWizard from './email/EmailConnectWizard.jsx';
import FiscalProviderActivateWizard from './FiscalProviderActivateWizard.jsx';
import '../../styles/office-setup-wizard.css';

const STORAGE_KEY_BASE = 'poreiago_office_setup_v1';

/** Per-tenant so a new office always gets the wizard (not a previous office's «done»). */
function setupStorageKey(tenantId) {
  const tid = String(tenantId || getSaasTenantId() || '').trim() || 'default';
  return `${STORAGE_KEY_BASE}:${tid}`;
}

export function isOfficeSetupComplete(tenantId) {
  try {
    const key = setupStorageKey(tenantId);
    if (localStorage.getItem(key) === 'done') return true;
    // Older builds used an unscoped flag — migrate once into this tenant.
    if (localStorage.getItem(STORAGE_KEY_BASE) === 'done') {
      localStorage.setItem(key, 'done');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function markOfficeSetupComplete(tenantId) {
  try {
    localStorage.setItem(setupStorageKey(tenantId), 'done');
  } catch {
    /* ignore */
  }
}

export function clearOfficeSetupComplete(tenantId) {
  try {
    localStorage.removeItem(setupStorageKey(tenantId));
    // Legacy unscoped key from older builds.
    localStorage.removeItem(STORAGE_KEY_BASE);
  } catch {
    /* ignore */
  }
}

const STEPS = [
  { id: 'welcome', title: 'Καλώς ήρθατε' },
  { id: 'office', title: 'Γραφείο' },
  { id: 'domain', title: 'Domain' },
  { id: 'email', title: 'Email' },
  { id: 'payments', title: 'Πληρωμές' },
  { id: 'fiscal', title: 'Πάροχος' },
  { id: 'fleet', title: 'Στόλος' },
  { id: 'done', title: 'Έτοιμοι' },
];

function stepIndex(id) {
  return STEPS.findIndex((s) => s.id === id);
}

/** Platform placeholder seeds — treat as empty so office identity wins. */
export function isPlatformPlaceholderName(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return true;
  return (
    v === 'poreiago travel' ||
    v === 'poreiago' ||
    v === 'aerostride' ||
    v === 'iconarent' ||
    v === 'icona rent'
  );
}

export function isPlatformPlaceholderEmail(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return true;
  return (
    v.endsWith('@poreiago.app') ||
    v.endsWith('@poreiago.com') ||
    v.endsWith('@aerostride.com')
  );
}

export function pickOfficeName(...candidates) {
  for (const c of candidates) {
    const v = String(c || '').trim();
    if (v && !isPlatformPlaceholderName(v)) return v;
  }
  return '';
}

export function pickOfficeEmail(...candidates) {
  for (const c of candidates) {
    const v = String(c || '').trim();
    if (v && !isPlatformPlaceholderEmail(v)) return v;
  }
  return '';
}
function MarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7.5A3.5 3.5 0 0 1 7.5 4h9A3.5 3.5 0 0 1 20 7.5v9a3.5 3.5 0 0 1-3.5 3.5h-9A3.5 3.5 0 0 1 4 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 12.5 10.6 15 16 9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Full-screen Apple-style onboarding after new office create / contract.
 * Collects: identity, custom domain, email, payments, first vehicle.
 * Appearance (logo/theme) lives in Σχεδιασμός σελίδων — not in this wizard.
 */
export default function OfficeSetupWizard({
  rentEnabled = false,
  forceOpen = false,
  onFinished,
  onDismiss,
}) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [office, setOffice] = useState({
    company_name: '',
    support_email: '',
    timezone: 'Europe/Athens',
    default_locale: 'el-GR',
    smtp_from_email: '',
  });

  const [domain, setDomain] = useState({
    subdomain_fqdn: '',
    office_code: '',
    custom_domain: '',
    checkout_base_url: '',
    cname_host: '',
    cname_target: getDefaultIngressCname() || DEFAULT_INGRESS_CNAME,
    notes: [],
    saved: false,
  });

  const [brand, setBrand] = useState({
    accent: '#0071e3',
    logo_url: '',
    footer_brand_name: '',
  });

  const [pay, setPay] = useState({
    bank_name: '',
    beneficiary: '',
    iban: '',
    bic: '',
  });

  const [fleet, setFleet] = useState({
    plate_number: '',
    model: '',
    make: '',
    category: rentEnabled ? 'car' : 'coach',
    seat_count: rentEnabled ? 5 : 50,
    daily_rate_eur: 45,
  });

  const [emailConnected, setEmailConnected] = useState(false);
  const [fiscalConnected, setFiscalConnected] = useState(false);
  const [completed, setCompleted] = useState({
    office: false,
    domain: false,
    email: false,
    payments: false,
    fiscal: false,
    fleet: false,
  });

  const stepMeta = STEPS[step];
  const progress = useMemo(
    () => STEPS.map((_, i) => (i < step ? 'is-done' : i === step ? 'is-active' : '')),
    [step],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [plat, appearance, payments, branding] = await Promise.all([
          fetchPlatformSettings().catch(() => null),
          fetchAdminSiteAppearance().catch(() => null),
          fetchAdminPaymentSettings().catch(() => null),
          fetchTenantBrandingSettings().catch(() => null),
        ]);
        if (cancelled) return;
        const brandName = pickOfficeName(
          branding?.display_name,
          appearance?.footer_brand_name,
          appearance?.rent_office_name,
          plat?.company_name,
        );
        const supportEmail = pickOfficeEmail(
          branding?.support_email,
          branding?.contact_email,
          appearance?.footer_contact_email,
          plat?.support_email,
        );
        const smtpFrom = pickOfficeEmail(plat?.smtp_from_email, supportEmail);

        setOffice((o) => ({
          ...o,
          company_name: brandName || o.company_name,
          support_email: supportEmail || o.support_email,
          timezone: plat?.timezone || o.timezone,
          default_locale: plat?.default_locale || o.default_locale,
          smtp_from_email: smtpFrom || o.smtp_from_email,
        }));

        if (appearance) {
          setBrand((b) => ({
            ...b,
            footer_brand_name:
              pickOfficeName(
                appearance.footer_brand_name,
                appearance.rent_office_name,
                brandName,
              ) || b.footer_brand_name,
            accent: appearance.accent_color || b.accent,
            logo_url: appearance.logo_url || '',
          }));
        }
        if (branding) {
          const dns = branding.dns_instructions || {};
          const code = branding.subdomain || branding.slug || '';
          const fqdn =
            branding.subdomain_fqdn ||
            (code ? `${code}.${branding.platform_domain || getPlatformBaseDomain()}` : '');
          setDomain((d) => ({
            ...d,
            subdomain_fqdn: fqdn || d.subdomain_fqdn,
            office_code: code || d.office_code,
            custom_domain: branding.custom_domain || '',
            checkout_base_url: branding.checkout_base_url || '',
            cname_host: dns.cname_host || branding.custom_domain || '',
            cname_target: dns.cname_target || getDefaultIngressCname() || DEFAULT_INGRESS_CNAME,
            notes: Array.isArray(dns.notes) ? dns.notes : [],
            saved: Boolean(branding.custom_domain),
          }));
          if (brandName) {
            setBrand((b) => ({
              ...b,
              footer_brand_name: pickOfficeName(b.footer_brand_name, brandName),
              accent: branding.primary_color || b.accent,
              logo_url: b.logo_url || branding.logo_url || '',
            }));
          }
        }
        const bank = payments?.bank_accounts?.find((a) => a.is_default) || payments?.bank_accounts?.[0];
        if (bank) {
          setPay((p) => ({
            ...p,
            bank_name: bank.bank_name || '',
            beneficiary: bank.beneficiary || '',
            iban: bank.iban || '',
            bic: bank.bic || '',
          }));
        }
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const finish = () => {
    markOfficeSetupComplete();
    onFinished?.();
  };

  const dismiss = () => {
    markOfficeSetupComplete();
    onDismiss?.();
  };

  const saveOffice = async () => {
    if (!office.company_name.trim() || !office.support_email.trim()) {
      toast.error('Συμπληρώστε επωνυμία και email υποστήριξης');
      return false;
    }
    setBusy(true);
    try {
      await updatePlatformSettings({
        company_name: office.company_name.trim(),
        support_email: office.support_email.trim(),
        timezone: office.timezone,
        default_locale: office.default_locale,
        smtp_from_email: (office.smtp_from_email || office.support_email).trim(),
        checkout_bank_beneficiary: pay.beneficiary || office.company_name.trim(),
      });
      setCompleted((c) => ({ ...c, office: true }));
      return true;
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης γραφείου');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const normalizeCustomDomain = (raw) =>
    String(raw || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .replace(/^www\./, '');

  const saveDomain = async ({ requireCustom = false, customDomain } = {}) => {
    // Prefer explicit override so «Μόνο subdomain» does not race setState.
    const custom = normalizeCustomDomain(
      customDomain !== undefined ? customDomain : domain.custom_domain,
    );
    if (requireCustom && !custom) {
      toast.error('Συμπληρώστε το custom domain ή πατήστε «Μόνο subdomain»');
      return false;
    }
    if (custom && !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(custom)) {
      toast.error('Μη έγκυρο domain (π.χ. bookings.myagency.gr)');
      return false;
    }
    setBusy(true);
    try {
      const name = office.company_name.trim() || brand.footer_brand_name.trim();
      const payload = {
        display_name: name,
        primary_color: brand.accent || '#0071e3',
        logo_url: brand.logo_url || '',
        custom_domain: custom || '',
        checkout_base_url: custom
          ? domain.checkout_base_url.trim() || `https://${custom}`
          : domain.subdomain_fqdn
            ? `https://${domain.subdomain_fqdn}`
            : '',
      };
      const saved = await updateTenantBrandingSettings(payload);
      const dns = saved?.dns_instructions || {};
      setDomain((d) => ({
        ...d,
        custom_domain: saved?.custom_domain || custom || '',
        checkout_base_url: saved?.checkout_base_url || payload.checkout_base_url,
        subdomain_fqdn: saved?.subdomain_fqdn || d.subdomain_fqdn,
        office_code: saved?.subdomain || saved?.slug || d.office_code,
        cname_host: dns.cname_host || saved?.custom_domain || custom || '',
        cname_target: dns.cname_target || getDefaultIngressCname() || DEFAULT_INGRESS_CNAME,
        notes: Array.isArray(dns.notes) ? dns.notes : d.notes,
        saved: true,
      }));
      setCompleted((c) => ({ ...c, domain: true }));
      if (custom) toast.success('Domain αποθηκεύτηκε — ρυθμίστε το CNAME');
      return true;
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης domain');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const copyDomainText = (value, okMsg) => {
    const text = String(value || '').trim();
    if (!text) return;
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success(okMsg || 'Αντιγράφηκε'))
      .catch(() => toast.error('Αποτυχία αντιγραφής'));
  };

  const savePayments = async () => {
    if (!pay.iban.trim() || !pay.beneficiary.trim()) {
      toast.error('Συμπληρώστε δικαιούχο και IBAN');
      return false;
    }
    setBusy(true);
    try {
      // Deposit % stays out of onboarding — configure later in Πληρωμές.
      await updatePaymentSettings({
        methods: {
          bank_transfer: { enabled: true },
          card: { enabled: true },
          cash_office: { enabled: true },
        },
      });
      try {
        await createBankAccount({
          label: pay.bank_name.trim() || 'Κύριος λογαριασμός',
          bank_name: pay.bank_name.trim() || 'Τράπεζα',
          beneficiary: pay.beneficiary.trim(),
          iban: pay.iban.trim().replace(/\s+/g, ''),
          bic: pay.bic.trim(),
          currency: 'EUR',
          enabled: true,
          is_default: true,
          reference_template: 'BK-{pnr}',
        });
      } catch {
        /* may already exist — platform checkout fields below still update */
      }
      await updatePlatformSettings({
        checkout_bank_transfer_enabled: true,
        checkout_bank_name: pay.bank_name.trim() || 'Τράπεζα',
        checkout_bank_beneficiary: pay.beneficiary.trim(),
        checkout_bank_iban: pay.iban.trim().replace(/\s+/g, ''),
        checkout_bank_bic: pay.bic.trim(),
      });
      setCompleted((c) => ({ ...c, payments: true }));
      return true;
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης πληρωμών');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveFleet = async () => {
    if (!fleet.plate_number.trim()) {
      toast.error('Συμπληρώστε πινακίδα');
      return false;
    }
    setBusy(true);
    try {
      if (rentEnabled) {
        await createRentalVehicle({
          plate_number: fleet.plate_number.trim().toUpperCase(),
          model: fleet.model.trim() || 'Όχημα',
          category: fleet.category || 'car',
          seating_capacity: Number(fleet.seat_count) || 5,
          daily_rate_eur: Number(fleet.daily_rate_eur) || 45,
          status: 'available',
        });
      } else {
        await createFleetVehicle({
          plate_number: fleet.plate_number.trim().toUpperCase(),
          make: fleet.make.trim() || 'Coach',
          model: fleet.model.trim() || 'Bus',
          category: 'coach',
          seat_count: Number(fleet.seat_count) || 50,
          year: new Date().getFullYear(),
        });
      }
      setCompleted((c) => ({ ...c, fleet: true }));
      return true;
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης οχήματος');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    const id = STEPS[step].id;
    if (id === 'welcome') {
      setStep(stepIndex('office'));
      return;
    }
    if (id === 'office') {
      if (!(await saveOffice())) return;
      setStep(stepIndex('domain'));
      return;
    }
    if (id === 'domain') {
      if (!(await saveDomain({ requireCustom: Boolean(domain.custom_domain.trim()) }))) return;
      setStep(stepIndex('email'));
      return;
    }
    if (id === 'email') {
      setStep(stepIndex('payments'));
      return;
    }
    if (id === 'payments') {
      if (!(await savePayments())) return;
      setStep(stepIndex('fiscal'));
      return;
    }
    if (id === 'fiscal') {
      setStep(stepIndex('fleet'));
      return;
    }
    if (id === 'fleet') {
      if (!(await saveFleet())) return;
      setStep(stepIndex('done'));
      return;
    }
    if (id === 'done') {
      finish();
    }
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  if (!loaded && !forceOpen) {
    return null;
  }

  return (
    <div className="office-setup-root" role="dialog" aria-modal="true" aria-label="Ρύθμιση γραφείου">
      <div className="office-setup-shell">
        <div className="office-setup-top">
          <div className="office-setup-brand">
            <div className="office-setup-mark">
              <MarkIcon />
            </div>
            <div className="office-setup-brand-copy">
              <strong>Ρύθμιση γραφείου</strong>
              <span>
                Βήμα {step + 1} από {STEPS.length} · {stepMeta.title}
              </span>
            </div>
          </div>
          {step < STEPS.length - 1 && (
            <button type="button" className="office-setup-skip" onClick={dismiss}>
              Αργότερα
            </button>
          )}
        </div>

        <div className="office-setup-progress" aria-hidden>
          {progress.map((cls, i) => (
            <span key={STEPS[i].id} className={cls} />
          ))}
        </div>

        <div className="office-setup-card" key={STEPS[step].id}>
          <div className="office-setup-card-inner">
            {STEPS[step].id === 'welcome' && (
              <>
                <p className="office-setup-eyebrow">Νέο γραφείο</p>
                <h1 className="office-setup-title">Ας στήσουμε το γραφείο σας σε λίγα λεπτά</h1>
                <p className="office-setup-subtitle">
                  Ένα wizard για όλα: επωνυμία, custom domain, email, πληρωμές και πρώτο όχημα —
                  χωρίς να ψάχνετε στις ρυθμίσεις. Logo και θέμα ρυθμίζονται αργότερα στο
                  Σχεδιασμός σελίδων.
                </p>
                <div className="office-setup-feature-row">
                  <div className="office-setup-feature">
                    <div className="office-setup-feature-icon">1</div>
                    <strong>Ταυτότητα &amp; domain</strong>
                    <p>Επωνυμία, email υποστήριξης και σύνδεση του δικού σας domain.</p>
                  </div>
                  <div className="office-setup-feature">
                    <div
                      className="office-setup-feature-icon"
                      style={{ background: 'linear-gradient(145deg,#30d158,#0a7a6c)' }}
                    >
                      2
                    </div>
                    <strong>Email γραφείου</strong>
                    <p>Προσωπικό mailbox για εισερχόμενα και ειδοποιήσεις.</p>
                  </div>
                  <div className="office-setup-feature">
                    <div
                      className="office-setup-feature-icon"
                      style={{ background: 'linear-gradient(145deg,#ff9f0a,#ff453a)' }}
                    >
                      3
                    </div>
                    <strong>Πληρωμές &amp; στόλος</strong>
                    <p>IBAN, πάροχος τιμολόγησης και πρώτο {rentEnabled ? 'όχημα' : 'λεωφορείο'}.</p>
                  </div>
                </div>
              </>
            )}

            {STEPS[step].id === 'office' && (
              <>
                <p className="office-setup-eyebrow">Γραφείο</p>
                <h2 className="office-setup-title">Πώς λέγεται η εταιρεία σας;</h2>
                <p className="office-setup-subtitle">
                  Αυτά εμφανίζονται σε αποδείξεις, emails και σελίδα κράτησης. Στο επόμενο βήμα
                  συνδέετε το domain σας.
                </p>
                <div className="office-setup-grid cols-2">
                  <div className="office-setup-field" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="os-name">Επωνυμία γραφείου *</label>
                    <input
                      id="os-name"
                      value={office.company_name}
                      onChange={(e) => setOffice((o) => ({ ...o, company_name: e.target.value }))}
                      placeholder="π.χ. Aegean Travel"
                    />
                  </div>
                  <div className="office-setup-field">
                    <label htmlFor="os-email">Email υποστήριξης *</label>
                    <input
                      id="os-email"
                      type="email"
                      value={office.support_email}
                      onChange={(e) => setOffice((o) => ({ ...o, support_email: e.target.value }))}
                      placeholder="info@example.com"
                    />
                  </div>
                  <div className="office-setup-field">
                    <label htmlFor="os-from">Email αποστολέα (SMTP from)</label>
                    <input
                      id="os-from"
                      type="email"
                      value={office.smtp_from_email}
                      onChange={(e) => setOffice((o) => ({ ...o, smtp_from_email: e.target.value }))}
                      placeholder="Ίδιο με υποστήριξη"
                    />
                  </div>
                  <div className="office-setup-field">
                    <label htmlFor="os-tz">Ζώνη ώρας</label>
                    <select
                      id="os-tz"
                      value={office.timezone}
                      onChange={(e) => setOffice((o) => ({ ...o, timezone: e.target.value }))}
                    >
                      <option value="Europe/Athens">Europe/Athens</option>
                      <option value="Europe/Nicosia">Europe/Nicosia</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                  <div className="office-setup-field">
                    <label htmlFor="os-locale">Γλώσσα</label>
                    <select
                      id="os-locale"
                      value={office.default_locale}
                      onChange={(e) => setOffice((o) => ({ ...o, default_locale: e.target.value }))}
                    >
                      <option value="el-GR">Ελληνικά</option>
                      <option value="en-US">English</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {STEPS[step].id === 'domain' && (
              <>
                <p className="office-setup-eyebrow">Domain &amp; διεύθυνση</p>
                <h2 className="office-setup-title">Η διεύθυνση του γραφείου σας στο web</h2>
                <p className="office-setup-subtitle">
                  Το subdomain ανοίγει αυτόματα από το PoreiaGo DNS — ο πελάτης δεν ρυθμίζει
                  τίποτα. Προαιρετικά συνδέστε δικό σας domain με ένα CNAME.
                </p>

                <div className="office-setup-domain-hero">
                  <div className="office-setup-domain-orb" aria-hidden />
                  <div className="office-setup-domain-ready">
                    <span className="office-setup-domain-badge">Έτοιμο · SSL</span>
                    <p className="office-setup-domain-kicker">Διεύθυνση πλατφόρμας</p>
                    <p className="office-setup-domain-host">
                      {domain.subdomain_fqdn || `….${getPlatformBaseDomain()}`}
                    </p>
                    {domain.subdomain_fqdn ? (
                      <button
                        type="button"
                        className="office-setup-domain-copy"
                        onClick={() => copyDomainText(domain.subdomain_fqdn, 'Subdomain αντιγράφηκε')}
                      >
                        Αντιγραφή subdomain
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="office-setup-domain-card">
                  <div className="office-setup-domain-card-head">
                    <span className="office-setup-domain-card-icon" aria-hidden>
                      <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
                        <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.7" />
                        <path
                          d="M4.5 12h15M12 4.5c2.4 2.4 3.6 5 3.6 7.5s-1.2 5.1-3.6 7.5M12 4.5C9.6 6.9 8.4 9.5 8.4 12s1.2 5.1 3.6 7.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                    <div>
                      <strong>Δικό σας domain</strong>
                      <p>Π.χ. bookings.myagency.gr — χωρίς www.</p>
                    </div>
                  </div>
                  <div className="office-setup-field">
                    <label htmlFor="os-custom-domain">Custom domain</label>
                    <input
                      id="os-custom-domain"
                      className="office-setup-mono"
                      value={domain.custom_domain}
                      onChange={(e) =>
                        setDomain((d) => ({
                          ...d,
                          custom_domain: e.target.value
                            .trim()
                            .toLowerCase()
                            .replace(/^https?:\/\//, '')
                            .split('/')[0],
                          saved: false,
                        }))
                      }
                      placeholder="bookings.myagency.gr"
                      autoComplete="off"
                      spellCheck={false}
                    />
                    <p className="office-setup-hint">
                      Μπορείτε να το αφήσετε κενό και να χρησιμοποιείτε μόνο το subdomain PoreiaGo.
                    </p>
                  </div>

                  {domain.custom_domain.trim() || domain.saved ? (
                    <div className="office-setup-cname">
                      <p className="office-setup-cname-title">Οδηγίες DNS · CNAME</p>
                      <pre className="office-setup-cname-code">
                        {`${normalizeCustomDomain(domain.custom_domain) || domain.cname_host || 'your.domain'}  CNAME  ${domain.cname_target || DEFAULT_INGRESS_CNAME}`}
                      </pre>
                      <button
                        type="button"
                        className="office-setup-domain-copy"
                        onClick={() =>
                          copyDomainText(
                            `${normalizeCustomDomain(domain.custom_domain) || domain.cname_host}  CNAME  ${domain.cname_target || DEFAULT_INGRESS_CNAME}`,
                            'CNAME αντιγράφηκε',
                          )
                        }
                      >
                        Αντιγραφή CNAME
                      </button>
                      {domain.notes?.length ? (
                        <ul className="office-setup-cname-notes">
                          {domain.notes.map((note) => (
                            <li key={note}>{note}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="office-setup-hint" style={{ marginTop: '0.75rem' }}>
                          Μετά την αποθήκευση, προσθέστε την εγγραφή στον πάροχο DNS. Το SSL
                          εκδίδεται αυτόματα όταν το CNAME δείξει σωστά.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              </>
            )}

            {STEPS[step].id === 'email' && (
              <>
                <p className="office-setup-eyebrow">Email</p>
                <h2 className="office-setup-title">Συνδέστε το προσωπικό σας mailbox</h2>
                <p className="office-setup-subtitle">
                  Καταχωρήστε το email του γραφείου και τον κωδικό mailbox για συγχρονισμό.
                </p>
                <div className="office-setup-email-wrap">
                  <EmailConnectWizard
                    compact
                    initialEmail={
                      (office.support_email || office.smtp_from_email || '').trim() ||
                      (typeof window !== 'undefined' &&
                      /(?:^|\.)achilliotravel\.com$/i.test(window.location.hostname)
                        ? 'info@achilliotravel.com'
                        : '')
                    }
                    onCancel={() => setStep(stepIndex('payments'))}
                    onConnected={() => {
                      setEmailConnected(true);
                      setCompleted((c) => ({ ...c, email: true }));
                      toast.success('Email συνδέθηκε');
                      setStep(stepIndex('payments'));
                    }}
                  />
                </div>
              </>
            )}

            {STEPS[step].id === 'payments' && (
              <>
                <p className="office-setup-eyebrow">Πληρωμές</p>
                <h2 className="office-setup-title">Πού να πληρώνουν οι πελάτες;</h2>
                <p className="office-setup-subtitle">
                  Τραπεζικός λογαριασμός για καταθέσεις. Η προκαταβολή ρυθμίζεται μετά από Πληρωμές.
                </p>
                <div className="office-setup-grid cols-2">
                  <div className="office-setup-field">
                    <label htmlFor="os-ben">Δικαιούχος *</label>
                    <input
                      id="os-ben"
                      value={pay.beneficiary}
                      onChange={(e) => setPay((p) => ({ ...p, beneficiary: e.target.value }))}
                      placeholder={office.company_name || 'Επωνυμία ΑΕ'}
                    />
                  </div>
                  <div className="office-setup-field">
                    <label htmlFor="os-bank">Τράπεζα</label>
                    <input
                      id="os-bank"
                      value={pay.bank_name}
                      onChange={(e) => setPay((p) => ({ ...p, bank_name: e.target.value }))}
                      placeholder="Eurobank / Πειραιώς / Alpha"
                    />
                  </div>
                  <div className="office-setup-field">
                    <label htmlFor="os-iban">IBAN *</label>
                    <input
                      id="os-iban"
                      value={pay.iban}
                      onChange={(e) => setPay((p) => ({ ...p, iban: e.target.value }))}
                      placeholder="GR…"
                    />
                  </div>
                  <div className="office-setup-field">
                    <label htmlFor="os-bic">BIC / SWIFT</label>
                    <input
                      id="os-bic"
                      value={pay.bic}
                      onChange={(e) => setPay((p) => ({ ...p, bic: e.target.value }))}
                      placeholder="ERBKGRAA"
                    />
                  </div>
                </div>
              </>
            )}

            {STEPS[step].id === 'fiscal' && (
              <>
                <p className="office-setup-eyebrow">Φορολογία</p>
                <h2 className="office-setup-title">Ενεργοποιήστε πάροχο τιμολόγησης</h2>
                <p className="office-setup-subtitle">
                  SoftOne ή Impact (ΥΠΑΗΕΣ) για αυτόματη έκδοση με MARK μετά την πληρωμή.
                </p>
                <div className="office-setup-email-wrap">
                  <FiscalProviderActivateWizard
                    compact
                    onCancel={() => setStep(stepIndex('fleet'))}
                    onActivated={() => {
                      setFiscalConnected(true);
                      setCompleted((c) => ({ ...c, fiscal: true }));
                      toast.success('Πάροχος ενεργοποιήθηκε');
                      setStep(stepIndex('fleet'));
                    }}
                  />
                </div>
              </>
            )}

            {STEPS[step].id === 'fleet' && (
              <>
                <p className="office-setup-eyebrow">Στόλος</p>
                <h2 className="office-setup-title">
                  Προσθέστε το πρώτο σας {rentEnabled ? 'όχημα' : 'λεωφορείο'}
                </h2>
                <p className="office-setup-subtitle">
                  Μπορείτε να συμπληρώσετε τον στόλο αργότερα από το μενού{' '}
                  {rentEnabled ? 'Ενοικιάσεις' : 'Fleet'}.
                </p>
                <div className="office-setup-grid cols-2">
                  <div className="office-setup-field">
                    <label htmlFor="os-plate">Πινακίδα *</label>
                    <input
                      id="os-plate"
                      value={fleet.plate_number}
                      onChange={(e) => setFleet((f) => ({ ...f, plate_number: e.target.value }))}
                      placeholder="ΑΒΓ-1234"
                    />
                  </div>
                  {!rentEnabled && (
                    <div className="office-setup-field">
                      <label htmlFor="os-make">Μάρκα</label>
                      <input
                        id="os-make"
                        value={fleet.make}
                        onChange={(e) => setFleet((f) => ({ ...f, make: e.target.value }))}
                        placeholder="Mercedes / Setra"
                      />
                    </div>
                  )}
                  <div className="office-setup-field">
                    <label htmlFor="os-model">Μοντέλο</label>
                    <input
                      id="os-model"
                      value={fleet.model}
                      onChange={(e) => setFleet((f) => ({ ...f, model: e.target.value }))}
                      placeholder={rentEnabled ? 'Peugeot 208' : 'Tourismo'}
                    />
                  </div>
                  {rentEnabled && (
                    <div className="office-setup-field">
                      <label htmlFor="os-cat">Κατηγορία</label>
                      <select
                        id="os-cat"
                        value={fleet.category}
                        onChange={(e) => setFleet((f) => ({ ...f, category: e.target.value }))}
                      >
                        <option value="car">Αυτοκίνητο</option>
                        <option value="suv">SUV</option>
                        <option value="van">Van</option>
                        <option value="scooter">Scooter</option>
                      </select>
                    </div>
                  )}
                  <div className="office-setup-field">
                    <label htmlFor="os-seats">Θέσεις</label>
                    <input
                      id="os-seats"
                      type="number"
                      min={1}
                      value={fleet.seat_count}
                      onChange={(e) => setFleet((f) => ({ ...f, seat_count: e.target.value }))}
                    />
                  </div>
                  {rentEnabled && (
                    <div className="office-setup-field">
                      <label htmlFor="os-rate">Ημερήσια τιμή (€)</label>
                      <input
                        id="os-rate"
                        type="number"
                        min={1}
                        value={fleet.daily_rate_eur}
                        onChange={(e) => setFleet((f) => ({ ...f, daily_rate_eur: e.target.value }))}
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {STEPS[step].id === 'done' && (
              <div className="office-setup-done">
                <div className="office-setup-done-orb" aria-hidden>
                  ✓
                </div>
                <h2 className="office-setup-title">Το γραφείο είναι έτοιμο</h2>
                <p className="office-setup-subtitle" style={{ margin: '0.75rem auto 0' }}>
                  Μπορείτε να αλλάξετε τα πάντα αργότερα από Ρυθμίσεις. Καλή αρχή!
                </p>
                <ul className="office-setup-checklist">
                  <li>
                    <i>✓</i> {completed.office || office.company_name ? 'Γραφείο' : 'Γραφείο (παράλειψη)'}
                  </li>
                  <li>
                    <i>✓</i>{' '}
                    {completed.domain
                      ? domain.custom_domain
                        ? `Domain · ${domain.custom_domain}`
                        : 'Domain · subdomain πλατφόρμας'
                      : 'Domain'}
                  </li>
                  <li>
                    <i>✓</i>{' '}
                    {completed.email || emailConnected ? 'Email συνδεδεμένο' : 'Email — μπορείτε αργότερα'}
                  </li>
                  <li>
                    <i>✓</i> Πληρωμές
                  </li>
                  <li>
                    <i>✓</i>{' '}
                    {completed.fiscal || fiscalConnected
                      ? 'Πάροχος ενεργός'
                      : 'Πάροχος — μπορείτε αργότερα'}
                  </li>
                  <li>
                    <i>✓</i> Στόλος
                  </li>
                </ul>
              </div>
            )}

            <div className="office-setup-actions">
              {step > 0 && STEPS[step].id !== 'done' && (
                <button type="button" className="office-setup-btn office-setup-btn-ghost" onClick={back}>
                  Πίσω
                </button>
              )}
              <div className="office-setup-actions-right">
                {STEPS[step].id === 'domain' && (
                  <button
                    type="button"
                    className="office-setup-btn office-setup-btn-secondary"
                    disabled={busy}
                    onClick={async () => {
                      setDomain((d) => ({ ...d, custom_domain: '' }));
                      if (
                        !(await saveDomain({
                          requireCustom: false,
                          customDomain: '',
                        }))
                      ) {
                        return;
                      }
                      setStep(stepIndex('email'));
                    }}
                  >
                    Μόνο subdomain
                  </button>
                )}
                {STEPS[step].id === 'email' && (
                  <button
                    type="button"
                    className="office-setup-btn office-setup-btn-secondary"
                    onClick={() => setStep(stepIndex('payments'))}
                  >
                    Παράλειψη email
                  </button>
                )}
                {STEPS[step].id === 'fiscal' && (
                  <button
                    type="button"
                    className="office-setup-btn office-setup-btn-secondary"
                    onClick={() => setStep(stepIndex('fleet'))}
                  >
                    Παράλειψη παρόχου
                  </button>
                )}
                {STEPS[step].id === 'fleet' && (
                  <button
                    type="button"
                    className="office-setup-btn office-setup-btn-secondary"
                    onClick={() => setStep(stepIndex('done'))}
                  >
                    Παράλειψη στόλου
                  </button>
                )}
                {STEPS[step].id !== 'email' && STEPS[step].id !== 'fiscal' && (
                  <button
                    type="button"
                    className="office-setup-btn office-setup-btn-primary"
                    disabled={busy}
                    onClick={next}
                  >
                    {busy
                      ? 'Αποθήκευση…'
                      : STEPS[step].id === 'welcome'
                        ? 'Ας ξεκινήσουμε'
                        : STEPS[step].id === 'domain'
                          ? domain.custom_domain.trim()
                            ? 'Αποθήκευση domain'
                            : 'Συνέχεια'
                          : STEPS[step].id === 'done'
                            ? 'Μετάβαση στο Control Panel'
                            : 'Συνέχεια'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
