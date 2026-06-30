import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  createAutoResponder,
  createCampaign,
  deleteAutoResponder,
  fetchAutoResponders,
  fetchCampaigns,
  fetchProductsForTemplate,
  fetchProductSnippet,
  pollImapInbox,
  sendCampaign,
  testAutoResponder,
  updateAutoResponder,
  updateCampaign,
} from '../../../services/emailMarketingApi.js';

const AUDIENCE_OPTIONS = [
  { value: 'all', label: 'Όλοι οι πελάτες' },
  { value: 'recent_buyers', label: 'Πρόσφατες κρατήσεις (90 ημέρες)' },
];

const STATUS_OPTIONS = ['Draft', 'Scheduled', 'Sent'];

function CampaignEditor({ campaign, products, onSaved, onCancel }) {
  const [form, setForm] = useState(
    campaign || {
      name: '',
      subject: '',
      body_html: '<p>Αγαπητέ/ή <strong>{{client_name}}</strong>,</p><p>{{product_list}}</p>',
      status: 'Draft',
      audience_filter: 'all',
    },
  );
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const insertProduct = async (productId) => {
    try {
      const { html } = await fetchProductSnippet(productId);
      setForm((p) => ({ ...p, body_html: `${p.body_html}\n${html}` }));
      toast.success('Προϊόν προστέθηκε στο email');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      let saved;
      if (campaign?.id) {
        saved = await updateCampaign(campaign.id, form);
      } else {
        saved = await createCampaign(form);
      }
      toast.success('Η καμπάνια αποθηκεύτηκε');
      onSaved(saved);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const send = async () => {
    if (!campaign?.id) {
      toast.error('Αποθηκεύστε πρώτα την καμπάνια');
      return;
    }
    if (!window.confirm('Αποστολή καμπάνιας σε όλους τους παραλήπτες;')) return;
    setSaving(true);
    try {
      const result = await sendCampaign(campaign.id);
      toast.success(`Στάλθηκαν ${result.sent}/${result.total_recipients} emails`);
      onSaved({ ...form, ...campaign, status: 'Sent', stats: result });
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-[28px] border border-black/[0.05] p-6 md:p-8 space-y-5">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-xl font-bold">{campaign?.id ? 'Επεξεργασία καμπάνιας' : 'Νέα καμπάνια'}</h3>
        <button type="button" onClick={onCancel} className="text-sm font-bold text-gray-500 hover:text-primary">
          ← Πίσω
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Όνομα καμπάνιας</label>
          <input className="w-full mt-1 px-4 py-3 rounded-xl bg-gray-50 border-0" value={form.name} onChange={set('name')} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-500 uppercase">Κοινό (audience)</label>
          <select className="w-full mt-1 px-4 py-3 rounded-xl bg-gray-50" value={form.audience_filter} onChange={set('audience_filter')}>
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-500 uppercase">Θέμα (υποστήριξη {'{{client_name}}'})</label>
        <input className="w-full mt-1 px-4 py-3 rounded-xl bg-gray-50" value={form.subject} onChange={set('subject')} />
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs font-bold text-gray-500 uppercase">Εισαγωγή προϊόντος</label>
          <select
            className="w-full mt-1 px-4 py-3 rounded-xl bg-gray-50"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) insertProduct(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="">— Επιλέξτε προϊόν —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title} — €{p.price}</option>
            ))}
          </select>
        </div>
        <p className="text-xs text-gray-400">Μεταβλητές: {'{{client_name}}'}, {'{{product_list}}'}</p>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-500 uppercase">Σώμα email (HTML)</label>
        <textarea
          className="w-full mt-1 px-4 py-3 rounded-xl bg-gray-50 font-mono text-sm min-h-[220px]"
          value={form.body_html}
          onChange={set('body_html')}
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={save} disabled={saving} className="px-6 py-3 rounded-full bg-primary text-white font-bold text-sm">
          {saving ? '…' : 'Αποθήκευση'}
        </button>
        {campaign?.id && form.status !== 'Sent' && (
          <button type="button" onClick={send} disabled={saving} className="px-6 py-3 rounded-full bg-emerald-600 text-white font-bold text-sm">
            Αποστολή καμπάνιας
          </button>
        )}
      </div>
    </div>
  );
}

function AutomationsPanel({ rules, onRefresh }) {
  const [form, setForm] = useState({
    name: '',
    trigger_keywords: 'προσφορά, τιμή',
    response_template: '<p>Ευχαριστούμε για το μήνυμά σας. Θα επικοινωνήσουμε σύντομα.</p>',
    is_active: true,
    priority: 100,
  });
  const [testSubject, setTestSubject] = useState('Ζητάω προσφορά');
  const [testBody, setTestBody] = useState('Θα ήθελα προσφορά για εκδρομή');

  const saveRule = async () => {
    try {
      await createAutoResponder(form);
      toast.success('Κανόνας προστέθηκε');
      setForm({
        name: '',
        trigger_keywords: '',
        response_template: '<p>Ευχαριστούμε για το μήνυμά σας.</p>',
        is_active: true,
        priority: 100,
      });
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggleActive = async (rule) => {
    try {
      await updateAutoResponder(rule.id, { is_active: !rule.is_active });
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Διαγραφή κανόνα;')) return;
    try {
      await deleteAutoResponder(id);
      onRefresh();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const runTest = async (ruleId) => {
    try {
      const r = await testAutoResponder(ruleId, testSubject, testBody);
      if (r.matches) toast.success('Ο κανόνας ταιριάζει — δείτε preview στο API response');
      else toast.error('Δεν ταιριάζει με τα keywords');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const pollImap = async () => {
    try {
      const r = await pollImapInbox();
      toast.success(`IMAP: ${r.fetched} μηνύματα, ${r.auto_replied} αυτόματες απαντήσεις`);
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-xl font-bold">Αυτοματισμοί (Auto-Responder)</h3>
        <button type="button" onClick={pollImap} className="px-4 py-2 rounded-full border font-bold text-sm hover:bg-gray-50">
          Έλεγχος IMAP τώρα
        </button>
      </div>

      <p className="text-sm text-gray-500">
        Αν το εισερχόμενο email (Subject/Body) περιέχει λέξη-κλειδί, στέλνεται αυτόματα η απάντηση.
        Ρύθμιση IMAP: <code className="text-xs bg-gray-100 px-1 rounded">IMAP_HOST, IMAP_USER, IMAP_PASSWORD</code>
      </p>

      <div className="bg-white rounded-[28px] border p-6 space-y-4">
        <h4 className="font-bold">Νέος κανόνας</h4>
        <input className="w-full px-4 py-3 rounded-xl bg-gray-50" placeholder="Όνομα κανόνα" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        <input className="w-full px-4 py-3 rounded-xl bg-gray-50" placeholder="Keywords (π.χ. προσφορά, βλάβη, τιμή)" value={form.trigger_keywords} onChange={(e) => setForm((p) => ({ ...p, trigger_keywords: e.target.value }))} />
        <textarea className="w-full px-4 py-3 rounded-xl bg-gray-50 min-h-[100px] font-mono text-sm" placeholder="HTML απάντηση" value={form.response_template} onChange={(e) => setForm((p) => ({ ...p, response_template: e.target.value }))} />
        <button type="button" onClick={saveRule} className="px-6 py-3 rounded-full bg-primary text-white font-bold text-sm">Προσθήκη κανόνα</button>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div key={rule.id} className="bg-white rounded-2xl border p-5 flex flex-wrap justify-between gap-4">
            <div>
              <div className="font-bold flex items-center gap-2">
                {rule.name}
                <span className={`text-xs px-2 py-0.5 rounded-full ${rule.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100'}`}>
                  {rule.is_active ? 'Ενεργός' : 'Ανενεργός'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">Keywords: {rule.trigger_keywords}</p>
              <p className="text-xs text-gray-400">Priority: {rule.priority}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button type="button" onClick={() => runTest(rule.id)} className="text-sm font-bold text-primary">Δοκιμή</button>
              <button type="button" onClick={() => toggleActive(rule)} className="text-sm font-bold">{rule.is_active ? 'Απενεργοποίηση' : 'Ενεργοποίηση'}</button>
              <button type="button" onClick={() => remove(rule.id)} className="text-sm font-bold text-red-600">Διαγραφή</button>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-2xl p-4 text-sm">
        <p className="font-bold mb-2">Δοκιμή matching</p>
        <input className="w-full mb-2 px-3 py-2 rounded-lg" placeholder="Subject" value={testSubject} onChange={(e) => setTestSubject(e.target.value)} />
        <textarea className="w-full px-3 py-2 rounded-lg min-h-[60px]" placeholder="Body" value={testBody} onChange={(e) => setTestBody(e.target.value)} />
      </div>
    </div>
  );
}

export default function EmailMarketingHub({ automationsOnly = false }) {
  const [subTab, setSubTab] = useState(automationsOnly ? 'automations' : 'campaigns');
  const [campaigns, setCampaigns] = useState([]);
  const [rules, setRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [c, r, p] = await Promise.all([
        fetchCampaigns(),
        fetchAutoResponders(),
        fetchProductsForTemplate(),
      ]);
      setCampaigns(c);
      setRules(r);
      setProducts(p);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (automationsOnly) {
    return (
      <div className="pb-6">
        {!loading && <AutomationsPanel rules={rules} onRefresh={load} />}
        {loading && <p className="text-gray-500">Φόρτωση…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h2 className="text-2xl font-bold text-on-surface">Email — Καμπάνιες & Αυτοματισμοί</h2>
        <p className="text-on-surface-variant text-sm mt-1">Marketing automation, μαζικές προσφορές, auto-responder</p>
      </div>

      <nav className="flex gap-2">
        {[
          { id: 'campaigns', label: 'Καμπάνιες / Προσφορές', icon: 'campaign' },
          { id: 'automations', label: 'Αυτοματισμοί', icon: 'smart_toy' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => { setSubTab(t.id); setEditing(null); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-colors ${
              subTab === t.id ? 'bg-primary text-white' : 'bg-white border text-gray-600'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {loading && <p className="text-gray-500">Φόρτωση…</p>}

      {!loading && subTab === 'campaigns' && !editing && (
        <>
          <button
            type="button"
            onClick={() => setEditing({})}
            className="px-6 py-3 rounded-full bg-primary text-white font-bold text-sm"
          >
            + Νέα καμπάνια
          </button>
          <div className="grid gap-4">
            {campaigns.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border p-5 flex justify-between items-start gap-4">
                <div>
                  <h4 className="font-bold">{c.name}</h4>
                  <p className="text-sm text-gray-500">{c.subject}</p>
                  <p className="text-xs mt-2">
                    <span className="font-bold">{c.status}</span> · {c.audience_filter}
                    {c.stats && ` · ${c.stats.sent}/${c.stats.total_recipients} sent`}
                  </p>
                </div>
                <button type="button" onClick={() => setEditing(c)} className="text-sm font-bold text-primary shrink-0">
                  Επεξεργασία
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && subTab === 'campaigns' && editing !== null && (
        <CampaignEditor
          campaign={editing.id ? editing : null}
          products={products}
          onSaved={(saved) => { setEditing(null); load(); setCampaigns((prev) => {
            const idx = prev.findIndex((x) => x.id === saved.id);
            if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n; }
            return [saved, ...prev];
          }); }}
          onCancel={() => setEditing(null)}
        />
      )}

      {!loading && subTab === 'automations' && (
        <AutomationsPanel rules={rules} onRefresh={load} />
      )}
    </div>
  );
}
