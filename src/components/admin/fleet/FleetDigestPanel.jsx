import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import AdminFleetPushPanel from '../AdminFleetPushPanel.jsx';
import { fetchFleetCalendar } from '../../../services/platformApi.js';
import { fetchAdminPaymentSettings } from '../../../services/paymentSettingsApi.js';
import {
  fetchTelemetrySettings,
  sendFleetDigest,
  updateTelemetrySettings,
} from '../../../services/telemetryApi.js';

const LOOKBACK_OPTIONS = [1, 3, 7, 14];

const CHANNELS = [
  {
    key: 'fleet_digest_enabled',
    label: 'Ημερήσιο digest',
    hint: 'Συλλογή KPI / λήξεων και αποστολή στο γραφείο',
    icon: 'mark_email_unread',
    tone: 'from-rose-50 to-orange-50/50 border-rose-100',
    iconBg: 'bg-rose-500',
  },
  {
    key: 'fleet_digest_email_enabled',
    label: 'Αποστολή email',
    hint: 'Στέλνει digest στο admin email',
    icon: 'mail',
    tone: 'from-sky-50 to-blue-50/40 border-sky-100',
    iconBg: 'bg-sky-500',
  },
  {
    key: 'fleet_digest_sms_enabled',
    label: 'Αποστολή SMS',
    hint: 'Σύντομο μήνυμα στο admin τηλέφωνο',
    icon: 'sms',
    tone: 'from-emerald-50 to-teal-50/40 border-emerald-100',
    iconBg: 'bg-emerald-500',
  },
];

function Toggle({ checked, disabled, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
        checked ? 'bg-rose-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function maskPhone(phone) {
  const p = String(phone || '').trim();
  if (p.length < 6) return p || '—';
  return `${p.slice(0, 3)}•••${p.slice(-2)}`;
}

export default function FleetDigestPanel({ onOpenPayments, onOpenCalendar }) {
  const [settings, setSettings] = useState(null);
  const [days, setDays] = useState(1);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [recipients, setRecipients] = useState({ email: '', phone: '' });

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchTelemetrySettings().catch(() => ({})),
      fetchFleetCalendar(30).catch(() => []),
      fetchAdminPaymentSettings().catch(() => null),
    ]).then(([telemetry, calendar, payments]) => {
      if (cancelled) return;
      setSettings(telemetry || {});
      const urgent = (Array.isArray(calendar) ? calendar : [])
        .filter((item) => item.severity === 'urgent' || Number(item.days_left) <= 14)
        .slice(0, 5);
      setUpcoming(urgent);
      const security = payments?.security || {};
      setRecipients({
        email: String(security.admin_notification_email || '').trim(),
        phone: String(security.admin_notification_phone || '').trim(),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = async (key, value) => {
    setSaving(true);
    try {
      const next = await updateTelemetrySettings({ [key]: value });
      setSettings(next);
      toast.success('Αποθηκεύτηκε');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const onSend = async () => {
    setSending(true);
    try {
      const result = await sendFleetDigest({ days });
      setLastResult(result);
      if (result?.sent) {
        const parts = [];
        if (result.email?.to || result.email?.reference) parts.push('email');
        if (result.sms?.to || result.sms?.reference) parts.push('SMS');
        toast.success(parts.length ? `Στάλθηκε (${parts.join(' + ')})` : 'Το digest στάλθηκε');
      } else if (result?.skipped) {
        const reason = result.reason || 'skipped';
        const map = {
          no_recipients: 'Χωρίς παραλήπτες — ρύθμισε email/τηλέφωνο στις Πληρωμές',
          disabled: 'Το digest είναι απενεργοποιημένο',
          tenant_disabled: 'Το digest είναι απενεργοποιημένο για το γραφείο',
        };
        toast.error(map[reason] || `Δεν στάλθηκε (${reason})`);
      } else {
        toast.success('Το digest συλλέχθηκε');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const statusCards = useMemo(() => {
    if (!settings) return [];
    const digestOn = Boolean(settings.fleet_digest_enabled);
    return [
      {
        label: 'Κατάσταση',
        value: digestOn ? 'Ενεργό' : 'Κλειστό',
        icon: digestOn ? 'notifications_active' : 'notifications_off',
        tone: digestOn
          ? 'from-emerald-50 to-white border-emerald-100 text-emerald-800'
          : 'from-slate-50 to-white border-slate-200 text-slate-700',
        iconTone: digestOn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600',
      },
      {
        label: 'Email',
        value: settings.fleet_digest_email_enabled ? 'ON' : 'OFF',
        icon: 'mail',
        tone: 'from-sky-50 to-white border-sky-100 text-sky-800',
        iconTone: 'bg-sky-100 text-sky-700',
      },
      {
        label: 'SMS',
        value: settings.fleet_digest_sms_enabled ? 'ON' : 'OFF',
        icon: 'sms',
        tone: 'from-teal-50 to-white border-teal-100 text-teal-800',
        iconTone: 'bg-teal-100 text-teal-700',
      },
      {
        label: 'Επείγουσες λήξεις',
        value: String(upcoming.length),
        icon: 'event_busy',
        tone: 'from-amber-50 to-white border-amber-100 text-amber-800',
        iconTone: 'bg-amber-100 text-amber-700',
      },
    ];
  }, [settings, upcoming.length]);

  if (!settings) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-28 rounded-[32px] bg-slate-100" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-24 rounded-3xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-10">
      <section className="relative overflow-hidden rounded-[32px] border border-rose-100/80 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 sm:p-6 shadow-[0_12px_40px_rgba(244,63,94,0.08)]">
        <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-rose-300/20 blur-2xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-14 left-1/3 h-40 w-40 rounded-full bg-amber-300/20 blur-2xl" aria-hidden />
        <div className="relative flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-orange-500 text-white shadow-lg shadow-rose-500/25 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                notifications_active
              </span>
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Ειδοποιήσεις στόλου
              </h2>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">
                Ημερήσιο digest με KPI, λήξεις και alerts — email/SMS στο γραφείο, plus push για βάρδιες οδηγών.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={sending || !settings.fleet_digest_enabled}
            onClick={onSend}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-orange-500 text-white px-5 py-2.5 text-sm font-bold shadow-md shadow-rose-500/20 hover:brightness-110 disabled:opacity-50 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">send</span>
            {sending ? 'Αποστολή…' : 'Αποστολή τώρα'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statusCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-3xl border bg-gradient-to-br p-4 shadow-sm ${card.tone}`}
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${card.iconTone}`}>
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {card.icon}
              </span>
            </div>
            <div className="text-[11px] font-bold uppercase tracking-wider opacity-70">{card.label}</div>
            <div className="text-xl font-bold mt-0.5">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        <div className="xl:col-span-3 space-y-3">
          {CHANNELS.map((channel) => (
            <div
              key={channel.key}
              className={`rounded-[24px] border bg-gradient-to-br p-4 sm:p-5 flex items-center justify-between gap-4 ${channel.tone}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-2xl ${channel.iconBg} text-white shadow-md flex items-center justify-center shrink-0`}
                >
                  <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {channel.icon}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{channel.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{channel.hint}</p>
                </div>
              </div>
              <Toggle
                checked={Boolean(settings[channel.key])}
                disabled={saving}
                onChange={(next) => patch(channel.key, next)}
              />
            </div>
          ))}
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div className="rounded-[24px] border border-slate-200/80 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-500">timelapse</span>
                Χειροκίνητη αποστολή
              </h3>
              <p className="text-xs text-slate-500 mt-1">Επίλεξε lookback και στείλε digest τώρα.</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                Lookback
              </p>
              <div className="flex flex-wrap gap-2">
                {LOOKBACK_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setDays(opt)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-bold border transition-colors ${
                      days === opt
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {opt} {opt === 1 ? 'ημέρα' : 'ημέρες'}
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              disabled={sending || !settings.fleet_digest_enabled}
              onClick={onSend}
              className="w-full rounded-full bg-slate-900 text-white px-4 py-2.5 text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-50 hover:bg-slate-800"
            >
              <span className="material-symbols-outlined text-[18px]">send</span>
              {sending ? 'Αποστολή…' : `Αποστολή (${days}η)`}
            </button>
            {lastResult && (
              <div
                className={`rounded-2xl border px-3 py-2.5 text-xs ${
                  lastResult.sent
                    ? 'border-emerald-100 bg-emerald-50 text-emerald-800'
                    : 'border-amber-100 bg-amber-50 text-amber-900'
                }`}
              >
                <p className="font-bold">
                  {lastResult.sent ? 'Τελευταία αποστολή OK' : 'Δεν στάλθηκε'}
                </p>
                {lastResult.reason && (
                  <p className="mt-0.5 opacity-80">Λόγος: {lastResult.reason}</p>
                )}
                {lastResult.email?.to && <p className="mt-0.5">Email → {lastResult.email.to}</p>}
                {lastResult.email?.error && (
                  <p className="mt-0.5 text-rose-700">Email error: {lastResult.email.error}</p>
                )}
                {lastResult.sms?.to && <p className="mt-0.5">SMS → {lastResult.sms.to}</p>}
                {lastResult.sms?.error && (
                  <p className="mt-0.5 text-rose-700">SMS error: {lastResult.sms.error}</p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-[24px] border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-sky-600">contacts</span>
              Παραλήπτες γραφείου
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white/80 border border-sky-100 px-3 py-2">
                <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Email</span>
                <span className="font-mono text-slate-800 truncate">
                  {recipients.email || 'Μη ορισμένο'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white/80 border border-sky-100 px-3 py-2">
                <span className="text-slate-500 font-bold text-xs uppercase tracking-wider">Τηλ.</span>
                <span className="font-mono text-slate-800">{maskPhone(recipients.phone)}</span>
              </div>
            </div>
            {onOpenPayments ? (
              <button
                type="button"
                onClick={onOpenPayments}
                className="text-sm font-bold text-sky-800 hover:underline inline-flex items-center gap-1"
              >
                Ρύθμιση στις Πληρωμές
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            ) : (
              <p className="text-xs text-slate-500">
                Οι παραλήπτες ρυθμίζονται στις ειδοποιήσεις ασφαλείας πληρωμών.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-[24px] border border-violet-100 bg-gradient-to-br from-violet-50/60 to-white p-4 sm:p-5 shadow-sm">
        <div className="mb-3">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <span className="material-symbols-outlined text-violet-600">phone_iphone</span>
            Push βάρδιας οδηγών
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Ξεχωριστό κανάλι: ειδοποίηση όταν οδηγός πατάει Έναρξη / Τέλος βάρδιας.
          </p>
        </div>
        <AdminFleetPushPanel autoPrompt={false} />
      </div>

      <section className="rounded-[28px] border border-amber-100 bg-gradient-to-br from-amber-50/50 to-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-amber-600">priority_high</span>
              Επείγουσες λήξεις (30 ημέρες)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Προεπισκόπηση από το ημερολόγιο στόλου — τι θα μπει στο digest.
            </p>
          </div>
          {onOpenCalendar && (
            <button
              type="button"
              onClick={onOpenCalendar}
              className="text-sm font-bold text-amber-800 hover:underline inline-flex items-center gap-1"
            >
              Άνοιγμα ημερολογίου
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </button>
          )}
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500 bg-white/70 border border-amber-100 rounded-2xl px-4 py-6 text-center">
            Δεν υπάρχουν επείγουσες λήξεις το επόμενο διάστημα.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((item) => (
              <li
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-2xl border border-amber-100/80 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-bold text-slate-900 truncate">{item.title}</p>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    {item.plate_number || '—'} · {item.due_date || '—'}
                  </p>
                </div>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0 ${
                    Number(item.days_left) < 0
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {Number(item.days_left) < 0
                    ? `Ληγμένο ${Math.abs(item.days_left)}η`
                    : `${item.days_left} ημέρες`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
