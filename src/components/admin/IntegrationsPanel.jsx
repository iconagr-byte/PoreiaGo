import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { isSaasSuperAdmin } from '../../lib/saasJwt.js';
import { getSaasToken } from '../../services/saasApi.js';
import {
  fetchPlatformIntegrations,
  updatePlatformIntegrations,
} from '../../services/platformSaasApi.js';

const EMPTY_FORM = {
  aviationstack_api_key: '',
  twilio_account_sid: '',
  twilio_auth_token: '',
  twilio_from_number: '',
  twilio_whatsapp_from: '',
};

function ModePill({ status }) {
  const live = status?.mode === 'live';
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
        live ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
      }`}
    >
      {live ? 'Live' : 'Stub'}
      {status?.source && status.source !== 'none' ? ` · ${status.source}` : ''}
    </span>
  );
}

function FieldHint({ field, status }) {
  const configured = status?.fields?.[field]?.configured;
  const source = status?.fields?.[field]?.source;
  if (!configured) {
    return <p className="text-xs text-slate-400 mt-1">Δεν έχει οριστεί</p>;
  }
  return (
    <p className="text-xs text-emerald-700 mt-1">
      Αποθηκευμένο ({source === 'ui' ? 'από UI' : 'από env'}) — άφησε κενό για να μείνει ως έχει
    </p>
  );
}

/**
 * Super-admin only — Aviationstack / Twilio keys (encrypted server-side).
 */
export default function IntegrationsPanel() {
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!getSaasToken() || !isSaasSuperAdmin()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setStatus(await fetchPlatformIntegrations());
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης integrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!isSaasSuperAdmin()) {
    return (
      <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        Μόνο για super admin πλατφόρμας.
      </div>
    );
  }

  const patch = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const body = {};
      for (const [k, v] of Object.entries(form)) {
        if (String(v || '').trim()) body[k] = String(v).trim();
      }
      if (!Object.keys(body).length) {
        toast.error('Συμπλήρωσε τουλάχιστον ένα νέο key');
        return;
      }
      const next = await updatePlatformIntegrations(body);
      setStatus(next);
      setForm(EMPTY_FORM);
      toast.success('Integrations αποθηκεύτηκαν');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία αποθήκευσης');
    } finally {
      setSaving(false);
    }
  };

  const clearField = async (field) => {
    if (!window.confirm('Διαγραφή αυτού του key από το UI store;')) return;
    setSaving(true);
    try {
      const next = await updatePlatformIntegrations({ clear_fields: [field] });
      setStatus(next);
      toast.success('Διαγράφηκε');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία');
    } finally {
      setSaving(false);
    }
  };

  const fieldClass =
    'mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10';

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="bg-white rounded-[24px] border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <h4 className="font-bold text-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">key</span>
            Platform integrations
          </h4>
          <p className="text-sm text-slate-500 mt-1">
            Aviationstack (live flight status) και Twilio (SMS / WhatsApp). Τα keys κρυπτογραφούνται
            στον server — δεν εμφανίζονται μετά την αποθήκευση. Το env στο VPS παραμένει fallback.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500">Φόρτωση…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <div className="rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Aviationstack
              </span>
              <ModePill status={status?.aviationstack} />
            </div>
            <div className="rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Twilio SMS
              </span>
              <ModePill status={status?.twilio_sms} />
            </div>
            <div className="rounded-xl border border-slate-200 px-3 py-2 flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                WhatsApp
              </span>
              <ModePill status={status?.twilio_whatsapp} />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={onSave} className="bg-white rounded-[24px] border border-slate-200 p-6 shadow-sm space-y-5">
        <label className="block">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Aviationstack API key
            </span>
            {status?.fields?.aviationstack_api_key?.configured ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => clearField('aviationstack_api_key')}
                className="text-xs font-bold text-rose-600"
              >
                Διαγραφή UI key
              </button>
            ) : null}
          </div>
          <input
            type="password"
            autoComplete="off"
            className={fieldClass}
            placeholder={status?.fields?.aviationstack_api_key?.configured ? '•••••••• (νέο για αντικατάσταση)' : 'access_key'}
            value={form.aviationstack_api_key}
            onChange={(e) => patch('aviationstack_api_key', e.target.value)}
          />
          <FieldHint field="aviationstack_api_key" status={status} />
        </label>

        <div className="border-t border-slate-100 pt-4 space-y-4">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Twilio</p>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Account SID</span>
            <input
              type="password"
              autoComplete="off"
              className={fieldClass}
              placeholder={status?.fields?.twilio_account_sid?.configured ? '••••••••' : 'ACxxxxxxxx'}
              value={form.twilio_account_sid}
              onChange={(e) => patch('twilio_account_sid', e.target.value)}
            />
            <FieldHint field="twilio_account_sid" status={status} />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Auth Token</span>
            <input
              type="password"
              autoComplete="off"
              className={fieldClass}
              placeholder={status?.fields?.twilio_auth_token?.configured ? '••••••••' : 'token'}
              value={form.twilio_auth_token}
              onChange={(e) => patch('twilio_auth_token', e.target.value)}
            />
            <FieldHint field="twilio_auth_token" status={status} />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">From number (E.164)</span>
            <input
              className={fieldClass}
              placeholder="+30…"
              value={form.twilio_from_number}
              onChange={(e) => patch('twilio_from_number', e.target.value)}
            />
            <FieldHint field="twilio_from_number" status={status} />
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">WhatsApp from</span>
            <input
              className={fieldClass}
              placeholder="whatsapp:+14155238886"
              value={form.twilio_whatsapp_from}
              onChange={(e) => patch('twilio_whatsapp_from', e.target.value)}
            />
            <FieldHint field="twilio_whatsapp_from" status={status} />
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-full bg-slate-900 text-white font-bold text-sm disabled:opacity-50"
        >
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση keys'}
        </button>
      </form>
    </div>
  );
}
