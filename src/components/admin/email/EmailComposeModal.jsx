import { useEffect, useMemo, useState } from 'react';
import { Save, Send, X } from 'lucide-react';
import toast from 'react-hot-toast';
import '../../../styles/emailCompose.css';
import '../../../styles/emailMarketingHub.css';
import { attachmentsForApi, validateAttachmentList } from '../../../lib/email/attachments.js';
import { buildComposeHtml, COMPOSE_SNIPPETS } from '../../../lib/email/composeHtml.js';
import { parseToEmails } from '../../../lib/email/recipients.js';
import { composeEmail, saveMailboxDraft } from '../../../services/emailClientApi.js';
import ComposeAttachments from './ComposeAttachments.jsx';
import ComposeRecipients from './ComposeRecipients.jsx';
import RichTextEditor from './RichTextEditor.jsx';

const DEFAULT_STATE = {
  to: '',
  cc: '',
  bcc: '',
  subject: '',
  preheader: '',
  body_html: '<p></p>',
  priority: 'normal',
  requestReadReceipt: false,
  includeSignature: true,
};

export default function EmailComposeModal({
  open,
  onClose,
  emailSettingsId = '',
  fromEmail = '',
  initial = {},
  onSent,
}) {
  const [form, setForm] = useState({ ...DEFAULT_STATE, ...initial });
  const [showCc, setShowCc] = useState(Boolean(initial.cc));
  const [showBcc, setShowBcc] = useState(Boolean(initial.bcc));
  const [sending, setSending] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [attachments, setAttachments] = useState([]);

  useEffect(() => {
    if (!open) return;
    setForm({ ...DEFAULT_STATE, ...initial });
    setAttachments([]);
    setShowCc(Boolean(initial.cc));
    setShowBcc(Boolean(initial.bcc));
  }, [open]);

  const patch = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const previewHtml = useMemo(
    () =>
      buildComposeHtml({
        body_html: form.body_html,
        preheader: form.preheader,
        includeSignature: form.includeSignature,
      }),
    [form.body_html, form.preheader, form.includeSignature],
  );

  const insertSnippet = (html) => {
    const base = form.body_html?.trim() && form.body_html !== '<p></p>' ? form.body_html : '';
    patch('body_html', `${base}${html}`);
  };

  const validate = () => {
    if (!parseToEmails(form.to).length) {
      toast.error('Συμπληρώστε έγκυρο email παραλήπτη (ή επιλέξτε πελάτη)');
      return false;
    }
    if (!form.subject.trim()) {
      toast.error('Συμπληρώστε θέμα');
      return false;
    }
    return true;
  };

  const handleSend = async () => {
    if (!validate()) return;
    try {
      validateAttachmentList(attachments);
    } catch (err) {
      toast.error(err.message);
      return;
    }
    setSending(true);
    try {
      await composeEmail(
        {
          to: form.to.trim(),
          cc: form.cc.trim(),
          bcc: form.bcc.trim(),
          subject: form.subject.trim(),
          body_html: previewHtml,
          priority: form.priority,
          request_read_receipt: form.requestReadReceipt,
          attachments: attachmentsForApi(attachments),
        },
        emailSettingsId || undefined,
      );
      toast.success('Το email στάλθηκε');
      onSent?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  const handleDraft = async () => {
    if (attachments.length > 0) {
      toast.error('Τα συνημμένα δεν αποθηκεύονται στο πρόχειρο — αφαιρέστε τα ή στείλτε απευθείας');
      return;
    }
    setSavingDraft(true);
    try {
      await saveMailboxDraft(
        {
          recipient: form.to.trim(),
          subject: form.subject.trim(),
          body_html: previewHtml,
          email_settings_id: emailSettingsId || null,
        },
        emailSettingsId || undefined,
      );
      toast.success('Αποθηκεύτηκε στα Πρόχειρα');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingDraft(false);
    }
  };

  if (!open) return null;

  return (
    <div className="emc-overlay" role="dialog" aria-modal="true" aria-labelledby="emc-title">
      <div className="emc-shell">
        <header className="emc-header">
          <h2 id="emc-title">Νέο email</h2>
          <div className="emc-header-actions">
            <button type="button" onClick={onClose} className="emh-btn-ghost flex items-center gap-1 px-3">
              <X size={16} />
              Ακύρωση
            </button>
            <button
              type="button"
              disabled={savingDraft}
              onClick={handleDraft}
              className="emh-btn-outline flex items-center gap-1"
            >
              <Save size={16} />
              {savingDraft ? '…' : 'Πρόχειρο'}
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={handleSend}
              className="emh-btn-primary flex items-center gap-1"
            >
              <Send size={16} />
              {sending ? 'Αποστολή…' : 'Αποστολή'}
            </button>
          </div>
        </header>

        <div className="emc-body">
          {/* Αριστερά: ρυθμίσεις */}
          <aside className="emc-side">
            {fromEmail && (
              <p className="emc-from-line">
                <strong>Από:</strong> {fromEmail}
              </p>
            )}

            <p className="emc-section-title">Παραλήπτες</p>
            <ComposeRecipients value={form.to} onChange={(v) => patch('to', v)} />
            <label className="emc-toggle-row">
              <input type="checkbox" checked={showCc} onChange={(e) => setShowCc(e.target.checked)} />
              Cc
            </label>
            {showCc && (
              <input
                className="emc-field"
                placeholder="Cc"
                value={form.cc}
                onChange={(e) => patch('cc', e.target.value)}
              />
            )}
            <label className="emc-toggle-row">
              <input type="checkbox" checked={showBcc} onChange={(e) => setShowBcc(e.target.checked)} />
              Bcc
            </label>
            {showBcc && (
              <input
                className="emc-field"
                placeholder="Bcc"
                value={form.bcc}
                onChange={(e) => patch('bcc', e.target.value)}
              />
            )}

            <p className="emc-section-title mt-3">Θέμα & Inbox</p>
            <input
              className="emc-field"
              placeholder="Θέμα *"
              value={form.subject}
              onChange={(e) => patch('subject', e.target.value)}
            />
            <input
              className="emc-field"
              placeholder="Preheader (προεπισκόπηση inbox)"
              value={form.preheader}
              onChange={(e) => patch('preheader', e.target.value)}
            />

            <p className="emc-section-title mt-3">Επιλογές</p>
            <label className="emc-field" style={{ display: 'block', padding: '0.5rem' }}>
              <span className="text-xs text-[#64748b] block mb-1">Προτεραιότητα</span>
              <select
                className="w-full border-0 bg-transparent text-sm outline-none"
                value={form.priority}
                onChange={(e) => patch('priority', e.target.value)}
              >
                <option value="normal">Κανονική</option>
                <option value="high">Υψηλή</option>
                <option value="low">Χαμηλή</option>
              </select>
            </label>
            <label className="emc-toggle-row">
              <input
                type="checkbox"
                checked={form.requestReadReceipt}
                onChange={(e) => patch('requestReadReceipt', e.target.checked)}
              />
              Αίτημα ανάγνωσης (Disposition-Notification)
            </label>
            <label className="emc-toggle-row">
              <input
                type="checkbox"
                checked={form.includeSignature}
                onChange={(e) => patch('includeSignature', e.target.checked)}
              />
              Υπογραφή PoreiaGo
            </label>

            <p className="emc-section-title mt-3">Γρήγορες εισαγωγές</p>
            <div className="emc-snippet-grid">
              {COMPOSE_SNIPPETS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="emc-snippet-btn"
                  onClick={() => insertSnippet(s.html)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <ComposeAttachments attachments={attachments} onChange={setAttachments} />
          </aside>

          {/* Κέντρο: rich editor */}
          <div className="emc-center">
            <div className="emc-editor-wrap">
              <RichTextEditor
                variant="mail"
                value={form.body_html}
                onChange={(html) => patch('body_html', html)}
                placeholder="Γράψτε το μήνυμά σας…"
                minHeight={420}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
