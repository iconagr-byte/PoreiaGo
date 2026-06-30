import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  Inbox,
  Mail,
  MailOpen,
  PenSquare,
  RefreshCw,
  Reply,
  Send,
  FileText,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { fetchEmailSettings } from '../../../services/emailSettingsApi.js';
import {
  deleteMailboxMessage,
  fetchMailboxFolders,
  fetchMailboxMessage,
  fetchMailboxMessages,
  fetchMessageCustomer,
  replyMailboxMessage,
  syncMailbox,
} from '../../../services/emailClientApi.js';
import '../../../styles/emailMarketingHub.css';
import '../../../styles/emailMailbox.css';
import EmailComposeModal from './EmailComposeModal.jsx';
import RichTextEditor from './RichTextEditor.jsx';

const FOLDER_META = {
  Inbox: { label: 'Εισερχόμενα', Icon: Inbox, color: '#6366f1', bg: '#eef2ff' },
  Sent: { label: 'Απεσταλμένα', Icon: Send, color: '#059669', bg: '#ecfdf5' },
  Drafts: { label: 'Πρόχειρα', Icon: FileText, color: '#d97706', bg: '#fffbeb' },
  Spam: { label: 'Spam', Icon: ShieldAlert, color: '#ea580c', bg: '#fff7ed' },
  Trash: { label: 'Κάδος', Icon: Trash2, color: '#dc2626', bg: '#fef2f2' },
};

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #0ea5e9, #6366f1)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #f59e0b, #ea580c)',
  'linear-gradient(135deg, #ec4899, #a855f7)',
];

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('el-GR', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

function initialsFrom(emailOrName) {
  const s = (emailOrName || '?').trim();
  const local = s.includes('@') ? s.split('@')[0] : s;
  const parts = local.split(/[.\s_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

function avatarGradient(key) {
  let h = 0;
  for (let i = 0; i < (key || '').length; i++) h += key.charCodeAt(i);
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

export default function EmailMailbox({ emailSettingsId = '', composeInitial = null }) {
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState('Inbox');
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [fromEmail, setFromEmail] = useState('');
  const [replyBody, setReplyBody] = useState('<p></p>');

  const loadFolders = useCallback(async () => {
    try {
      const data = await fetchMailboxFolders(emailSettingsId || undefined);
      setFolders(data.folders || []);
    } catch (err) {
      toast.error(err.message);
    }
  }, [emailSettingsId]);

  const loadMessages = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchMailboxMessages(activeFolder, {
        accountId: emailSettingsId || undefined,
      });
      setMessages(list);
      if (selectedId && !list.find((m) => m.id === selectedId)) {
        setSelectedId(null);
        setDetail(null);
        setCustomer(null);
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeFolder, selectedId, emailSettingsId]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (!emailSettingsId) {
      setFromEmail('');
      return;
    }
    fetchEmailSettings()
      .then((list) => {
        const acc = list.find((a) => a.id === emailSettingsId);
        setFromEmail(acc?.email_address || '');
      })
      .catch(() => setFromEmail(''));
  }, [emailSettingsId]);

  useEffect(() => {
    if (composeInitial?.to || composeInitial?.subject) {
      setComposeOpen(true);
    }
  }, [composeInitial]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const selectMessage = async (id) => {
    setSelectedId(id);
    setReplyOpen(false);
    try {
      const msg = await fetchMailboxMessage(id);
      setDetail(msg);
      const cust = await fetchMessageCustomer(id);
      setCustomer(cust);
      loadFolders();
      loadMessages();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await syncMailbox(emailSettingsId || undefined);
      toast.success(`Συγχρονίστηκαν ${r.synced || 0} μηνύματα`);
      await loadFolders();
      await loadMessages();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleTrash = async () => {
    if (!selectedId) return;
    try {
      await deleteMailboxMessage(selectedId);
      toast.success('Μετακινήθηκε στον Κάδο');
      setSelectedId(null);
      setDetail(null);
      loadMessages();
      loadFolders();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleReply = async () => {
    if (!selectedId) return;
    try {
      await replyMailboxMessage(selectedId, { body_html: replyBody });
      toast.success('Η απάντηση στάλθηκε');
      setReplyOpen(false);
      loadMessages();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const peer = detail
    ? activeFolder === 'Sent'
      ? detail.recipient
      : detail.sender
    : '';

  const folderList =
    folders.length > 0
      ? folders
      : Object.keys(FOLDER_META).map((name) => ({ name, unread: 0 }));

  const activeMeta = FOLDER_META[activeFolder] || FOLDER_META.Inbox;

  return (
    <div className="embox-luxury">
      {!emailSettingsId && (
        <div className="embox-banner" role="status">
          <AlertCircle size={18} strokeWidth={2} aria-hidden />
          Προσθέστε λογαριασμό email από την καρτέλα «Ρυθμίσεις Email».
        </div>
      )}

      <header className="embox-header">
        <div className="embox-header-brand">
          <span className="embox-header-icon" aria-hidden>
            <Mail size={22} strokeWidth={2} />
          </span>
          <div>
            <h2>Email Client</h2>
            <p className="embox-header-sub">
              {fromEmail || 'Διαχείριση εισερχομένων & αποστολών'}
            </p>
          </div>
        </div>
        <div className="embox-header-actions">
          <button type="button" onClick={() => setComposeOpen(true)} className="embox-btn-primary">
            <PenSquare size={16} strokeWidth={2} aria-hidden />
            Νέο email
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="embox-btn-outline"
          >
            <RefreshCw size={16} strokeWidth={2} className={syncing ? 'animate-spin' : ''} aria-hidden />
            {syncing ? 'Συγχρονισμός…' : 'Συγχρονισμός IMAP'}
          </button>
        </div>
      </header>

      <div className="embox-layout">
        <aside className="embox-folders">
          {folderList.map((f) => {
            const meta = FOLDER_META[f.name] || {
              label: f.name,
              Icon: Inbox,
              color: '#64748b',
              bg: '#f1f5f9',
            };
            const Icon = meta.Icon;
            const active = activeFolder === f.name;
            return (
              <button
                key={f.name}
                type="button"
                onClick={() => {
                  setActiveFolder(f.name);
                  setSelectedId(null);
                  setDetail(null);
                }}
                className={`embox-folder-btn ${active ? 'embox-folder-btn-active' : ''}`}
                style={
                  active
                    ? {
                        '--embox-folder-color': meta.color,
                        '--embox-folder-bg': meta.bg,
                      }
                    : undefined
                }
              >
                <span
                  className="embox-folder-icon"
                  style={{ '--embox-folder-color': meta.color, '--embox-folder-bg': meta.bg }}
                >
                  <Icon size={16} strokeWidth={2} aria-hidden />
                </span>
                <span className="embox-folder-label">{meta.label}</span>
                {f.unread > 0 && <span className="embox-folder-badge">{f.unread}</span>}
              </button>
            );
          })}
        </aside>

        <section className="embox-list">
          <div className="embox-list-head">{activeMeta.label}</div>
          {loading && <p className="embox-list-loading">Φόρτωση…</p>}
          {!loading && messages.length === 0 && (
            <p className="embox-list-empty">Δεν υπάρχουν μηνύματα.</p>
          )}
          <ul className="embox-list-scroll">
            {messages.map((m) => {
              const display = activeFolder === 'Sent' ? m.recipient : m.sender;
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => selectMessage(m.id)}
                    className={`embox-msg-btn ${selectedId === m.id ? 'embox-msg-btn-active' : ''} ${
                      !m.is_read ? 'embox-msg-btn-unread' : ''
                    }`}
                  >
                    <span
                      className="embox-avatar"
                      style={{ background: avatarGradient(display) }}
                      aria-hidden
                    >
                      {initialsFrom(display)}
                    </span>
                    <span className="embox-msg-body">
                      <div className="embox-msg-from">{display || '—'}</div>
                      <div className="embox-msg-subject">{m.subject || '(χωρίς θέμα)'}</div>
                      <div className="embox-msg-meta">
                        <span className="embox-msg-date">{formatDate(m.date)}</span>
                        {!m.is_read && <span className="embox-unread-dot" title="Αδιάβαστο" />}
                      </div>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="embox-detail">
          {!detail && (
            <div className="embox-detail-empty">
              <span className="embox-detail-empty-icon" aria-hidden>
                <MailOpen size={28} strokeWidth={1.5} />
              </span>
              <p>Επιλέξτε ένα μήνυμα</p>
            </div>
          )}
          {detail && (
            <>
              <div className="embox-detail-head">
                <h3>{detail.subject || '(χωρίς θέμα)'}</h3>
                <p className="embox-detail-peer">
                  <span
                    className="embox-avatar"
                    style={{
                      width: 28,
                      height: 28,
                      fontSize: '0.6rem',
                      background: avatarGradient(peer),
                    }}
                    aria-hidden
                  >
                    {initialsFrom(peer)}
                  </span>
                  {peer} · {formatDate(detail.date)}
                </p>
                <div className="embox-detail-actions">
                  <button
                    type="button"
                    onClick={() => setReplyOpen(true)}
                    className="embox-action-btn"
                  >
                    <Reply size={14} strokeWidth={2} aria-hidden />
                    Απάντηση
                  </button>
                  <button type="button" onClick={handleTrash} className="embox-action-btn embox-action-danger">
                    <Trash2 size={14} strokeWidth={2} aria-hidden />
                    Κάδος
                  </button>
                </div>
              </div>
              <div className="embox-detail-content">
                <div
                  className="embox-detail-body"
                  dangerouslySetInnerHTML={{ __html: detail.body_html || '<p></p>' }}
                />
                {customer && (
                  <aside className="embox-customer">
                    <h4>Πελάτης</h4>
                    <p className="embox-customer-name">{customer.name}</p>
                    <p className="embox-customer-email">{customer.email}</p>
                    {customer.customer_id && (
                      <p className="text-label-sm text-on-surface-variant mt-2">ID: {customer.customer_id}</p>
                    )}
                    {customer.source === 'unknown' && (
                      <p className="text-label-sm text-on-surface-variant mt-2 italic">Μη καταχωρημένος</p>
                    )}
                  </aside>
                )}
              </div>
              {replyOpen && (
                <div className="embox-reply-panel space-y-3">
                  <RichTextEditor
                    variant="mail"
                    value={replyBody}
                    onChange={setReplyBody}
                    placeholder="Η απάντησή σας…"
                    minHeight={140}
                  />
                  <button type="button" onClick={handleReply} className="embox-btn-primary">
                    <Send size={16} strokeWidth={2} aria-hidden />
                    Αποστολή απάντησης
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <EmailComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        emailSettingsId={emailSettingsId}
        fromEmail={fromEmail}
        initial={
          composeInitial?.to
            ? composeInitial
            : customer?.email
              ? { to: customer.email, subject: detail?.subject ? `Re: ${detail.subject}` : '' }
              : {}
        }
        onSent={() => {
          setActiveFolder('Sent');
          loadMessages();
          loadFolders();
        }}
      />
    </div>
  );
}
