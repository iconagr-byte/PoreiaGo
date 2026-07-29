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
import {
  fetchSiteAppearance,
  updateSiteAppearance,
} from '../../services/siteAppearanceApi.js';
import { createRentalVehicle } from '../../services/fleetRentalApi.js';
import EmailConnectWizard from './email/EmailConnectWizard.jsx';
import '../../styles/office-setup-wizard.css';

const STORAGE_KEY = 'poreiago_office_setup_v1';

export function isOfficeSetupComplete() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'done';
  } catch {
    return false;
  }
}

export function markOfficeSetupComplete() {
  try {
    localStorage.setItem(STORAGE_KEY, 'done');
  } catch {
    /* ignore */
  }
}

export function clearOfficeSetupComplete() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

const ACCENTS = [
  { id: 'blue', color: '#0071e3', label: 'Ocean' },
  { id: 'teal', color: '#0a7a6c', label: 'Aegean' },
  { id: 'indigo', color: '#5856d6', label: 'Indigo' },
  { id: 'orange', color: '#ff9f0a', label: 'Sunset' },
  { id: 'pink', color: '#ff2d55', label: 'Coral' },
  { id: 'graphite', color: '#1d1d1f', label: 'Graphite' },
];

const STEPS = [
  { id: 'welcome', title: 'Καλώς ήρθατε' },
  { id: 'office', title: 'Γραφείο' },
  { id: 'brand', title: 'Εμφάνιση' },
  { id: 'email', title: 'Email' },
  { id: 'payments', title: 'Πληρωμές' },
  { id: 'fleet', title: 'Στόλος' },
  { id: 'done', title: 'Έτοιμοι' },
];

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
 * Full-screen Apple-style onboarding for offices after contract purchase.
 * Collects: identity, branding, email, payments, first vehicle.
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

  const [brand, setBrand] = useState({
    accent: ACCENTS[0].color,
    footer_brand_name: '',
    footer_contact_phone: '',
    footer_address: '',
    rent_office_name: '',
    hero_title: '',
  });

  const [pay, setPay] = useState({
    bank_name: '',
    beneficiary: '',
    iban: '',
    bic: '',
    deposit_percent: 30,
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
  const [completed, setCompleted] = useState({
    office: false,
    brand: false,
    email: false,
    payments: false,
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
        const [plat, appearance, payments] = await Promise.all([
          fetchPlatformSettings().catch(() => null),
          fetchSiteAppearance().catch(() => null),
          fetchAdminPaymentSettings().catch(() => null),
        ]);
        if (cancelled) return;
        if (plat) {
          setOffice((o) => ({
            ...o,
            company_name: plat.company_name || o.company_name,
            support_email: plat.support_email || o.support_email,
            timezone: plat.timezone || o.timezone,
            default_locale: plat.default_locale || o.default_locale,
            smtp_from_email: plat.smtp_from_email || o.smtp_from_email,
          }));
        }
        if (appearance) {
          setBrand((b) => ({
            ...b,
            footer_brand_name: appearance.footer_brand_name || b.footer_brand_name,
            footer_contact_phone: appearance.footer_contact_phone || '',
            footer_address: appearance.footer_address || '',
            rent_office_name: appearance.rent_office_name || '',
            hero_title: appearance.hero_title || '',
            accent: appearance.accent_color || b.accent,
          }));
        }
        const bank = payments?.bank_accounts?.find((a) => a.is_default) || payments?.bank_accounts?.[0];
        if (bank) {
          setPay((p) => ({
            ...p,
            bank_name: bank.bank_name || '',
            beneficiary: bank.beneficiary || '',
            iban: bank.iban || '',
            bic: bank.bic || '',
            deposit_percent: payments?.deposit?.percent || 30,
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

  const saveBrand = async () => {
    setBusy(true);
    try {
      const name = brand.footer_brand_name.trim() || office.company_name.trim();
      await updateSiteAppearance({
        footer_brand_name: name,
        footer_contact_email: office.support_email.trim(),
        footer_contact_phone: brand.footer_contact_phone.trim(),
        footer_address: brand.footer_address.trim(),
        rent_office_name: (brand.rent_office_name || name).trim(),
        hero_title: brand.hero_title.trim() || undefined,
        accent_color: brand.accent,
      });
      setCompleted((c) => ({ ...c, brand: true }));
      return true;
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης εμφάνισης');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const savePayments = async () => {
    if (!pay.iban.trim() || !pay.beneficiary.trim()) {
      toast.error('Συμπληρώστε δικαιούχο και IBAN');
      return false;
    }
    setBusy(true);
    try {
      await updatePaymentSettings({
        deposit: { enabled: true, percent: Number(pay.deposit_percent) || 30 },
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
        checkout_deposit_enabled: true,
        checkout_deposit_percent: Number(pay.deposit_percent) || 30,
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
      setStep(1);
      return;
    }
    if (id === 'office') {
      if (!(await saveOffice())) return;
      setStep(2);
      return;
    }
    if (id === 'brand') {
      if (!(await saveBrand())) return;
      setStep(3);
      return;
    }
    if (id === 'email') {
      setStep(4);
      return;
    }
    if (id === 'payments') {
      if (!(await savePayments())) return;
      setStep(5);
      return;
    }
    if (id === 'fleet') {
      if (!(await saveFleet())) return;
      setStep(6);
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
              <strong>PoreiaGo Setup</strong>
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
                  Μετά την αγορά συμβολαίου, καταχωρείτε μόνοι σας ό,τι χρειάζεται για να
                  λειτουργήσετε — επωνυμία, εμφάνιση, email, πληρωμές και πρώτο όχημα.
                </p>
                <div className="office-setup-feature-row">
                  <div className="office-setup-feature">
                    <div className="office-setup-feature-icon">1</div>
                    <strong>Ταυτότητα</strong>
                    <p>Επωνυμία, επικοινωνία και ζώνη ώρας του γραφείου.</p>
                  </div>
                  <div className="office-setup-feature">
                    <div
                      className="office-setup-feature-icon"
                      style={{ background: 'linear-gradient(145deg,#30d158,#0a7a6c)' }}
                    >
                      2
                    </div>
                    <strong>Email & πληρωμές</strong>
                    <p>Προσωπικό mailbox και IBAN χωρίς ticket σε hosting.</p>
                  </div>
                  <div className="office-setup-feature">
                    <div
                      className="office-setup-feature-icon"
                      style={{ background: 'linear-gradient(145deg,#ff9f0a,#ff453a)' }}
                    >
                      3
                    </div>
                    <strong>Στόλος</strong>
                    <p>Το πρώτο σας {rentEnabled ? 'όχημα ενοικίασης' : 'λεωφορείο'}.</p>
                  </div>
                </div>
              </>
            )}

            {STEPS[step].id === 'office' && (
              <>
                <p className="office-setup-eyebrow">Γραφείο</p>
                <h2 className="office-setup-title">Πώς λέγεται η εταιρεία σας;</h2>
                <p className="office-setup-subtitle">
                  Αυτά εμφανίζονται σε αποδείξεις, emails και σελίδα κράτησης.
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

            {STEPS[step].id === 'brand' && (
              <>
                <p className="office-setup-eyebrow">Εμφάνιση</p>
                <h2 className="office-setup-title">Η πρώτη εντύπωση του brand σας</h2>
                <p className="office-setup-subtitle">
                  Χρώμα και στοιχεία επικοινωνίας για storefront και Rent app.
                </p>
                <div className="office-setup-grid cols-2">
                  <div className="office-setup-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Χρώμα έμφασης</label>
                    <div className="office-setup-swatches">
                      {ACCENTS.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          title={a.label}
                          className={`office-setup-swatch${brand.accent === a.color ? ' is-active' : ''}`}
                          style={{ background: a.color }}
                          onClick={() => setBrand((b) => ({ ...b, accent: a.color }))}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="office-setup-field">
                    <label htmlFor="os-brand">Όνομα brand</label>
                    <input
                      id="os-brand"
                      value={brand.footer_brand_name}
                      onChange={(e) => setBrand((b) => ({ ...b, footer_brand_name: e.target.value }))}
                      placeholder={office.company_name || 'Brand name'}
                    />
                  </div>
                  <div className="office-setup-field">
                    <label htmlFor="os-phone">Τηλέφωνο επικοινωνίας</label>
                    <input
                      id="os-phone"
                      value={brand.footer_contact_phone}
                      onChange={(e) => setBrand((b) => ({ ...b, footer_contact_phone: e.target.value }))}
                      placeholder="+30 …"
                    />
                  </div>
                  <div className="office-setup-field" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="os-addr">Διεύθυνση γραφείου</label>
                    <input
                      id="os-addr"
                      value={brand.footer_address}
                      onChange={(e) => setBrand((b) => ({ ...b, footer_address: e.target.value }))}
                      placeholder="Οδός, πόλη"
                    />
                  </div>
                  {rentEnabled && (
                    <div className="office-setup-field" style={{ gridColumn: '1 / -1' }}>
                      <label htmlFor="os-rent-name">Όνομα Rent app</label>
                      <input
                        id="os-rent-name"
                        value={brand.rent_office_name}
                        onChange={(e) => setBrand((b) => ({ ...b, rent_office_name: e.target.value }))}
                        placeholder="π.χ. Achillio Rent"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {STEPS[step].id === 'email' && (
              <>
                <p className="office-setup-eyebrow">Email</p>
                <h2 className="office-setup-title">Συνδέστε το προσωπικό σας mailbox</h2>
                <p className="office-setup-subtitle">
                  Gmail / Outlook / Yahoo δουλεύουν αυτόνομα. Για domain σε cPanel προτείνεται
                  forward σε Gmail.
                </p>
                <div className="office-setup-email-wrap">
                  <EmailConnectWizard
                    compact
                    onCancel={() => setStep(4)}
                    onConnected={() => {
                      setEmailConnected(true);
                      setCompleted((c) => ({ ...c, email: true }));
                      toast.success('Email συνδέθηκε');
                      setStep(4);
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
                  Τραπεζικός λογαριασμός για καταθέσεις και προκαταβολή κράτησης.
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
                  <div className="office-setup-field">
                    <label htmlFor="os-dep">Προκαταβολή %</label>
                    <input
                      id="os-dep"
                      type="number"
                      min={5}
                      max={90}
                      value={pay.deposit_percent}
                      onChange={(e) => setPay((p) => ({ ...p, deposit_percent: e.target.value }))}
                    />
                    <p className="office-setup-hint">Συνήθως 30% για κρατήσεις.</p>
                  </div>
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
                      placeholder={rentEnabled ? 'Toyota Yaris' : 'Tourismo'}
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
                    <i>✓</i> Εμφάνιση
                  </li>
                  <li>
                    <i>✓</i>{' '}
                    {completed.email || emailConnected ? 'Email συνδεδεμένο' : 'Email — μπορείτε αργότερα'}
                  </li>
                  <li>
                    <i>✓</i> Πληρωμές
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
                {STEPS[step].id === 'email' && (
                  <button
                    type="button"
                    className="office-setup-btn office-setup-btn-secondary"
                    onClick={() => setStep(4)}
                  >
                    Παράλειψη email
                  </button>
                )}
                {STEPS[step].id === 'fleet' && (
                  <button
                    type="button"
                    className="office-setup-btn office-setup-btn-secondary"
                    onClick={() => setStep(6)}
                  >
                    Παράλειψη στόλου
                  </button>
                )}
                {STEPS[step].id !== 'email' && (
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
