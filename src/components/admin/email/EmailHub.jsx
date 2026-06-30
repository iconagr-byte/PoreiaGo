import { useEffect, useState } from 'react';
import { fetchEmailSettings } from '../../../services/emailSettingsApi.js';
import EmailMailbox from './EmailMailbox.jsx';
import MarketingDashboard from './MarketingDashboard.jsx';
import EmailMarketingHub from './EmailMarketingHub.jsx';
import EmailSettingsPanel from './EmailSettingsPanel.jsx';
import '../../../styles/emailMailbox.css';

const TABS = [
  { id: 'settings', label: 'Ρυθμίσεις Email' },
  { id: 'mailbox', label: 'Mailbox' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'automations', label: 'Αυτοματισμοί' },
];

const STORAGE_KEY = 'email_active_account';

export default function EmailHub({ intent = null, onIntentHandled }) {
  const [tab, setTab] = useState('mailbox');
  const [accountId, setAccountId] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [accounts, setAccounts] = useState([]);
  const [composeLaunch, setComposeLaunch] = useState(null);
  const [marketingDraft, setMarketingDraft] = useState(null);

  useEffect(() => {
    if (!intent) return;
    setTab(intent.hubTab || 'mailbox');
    if (intent.initialDraft) {
      setMarketingDraft(intent.initialDraft);
    }
    if (intent.compose?.to || intent.compose?.subject) {
      setComposeLaunch(intent.compose);
    } else {
      setComposeLaunch(null);
    }
    onIntentHandled?.();
  }, [intent]);

  useEffect(() => {
    fetchEmailSettings()
      .then((list) => {
        setAccounts(list);
        if (!accountId && list[0]) {
          setAccountId(list[0].id);
          localStorage.setItem(STORAGE_KEY, list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  const selectAccount = (id) => {
    setAccountId(id);
    localStorage.setItem(STORAGE_KEY, id);
  };

  return (
    <div className="space-y-4">
      <div className="emhub-tabs">
        <div className="flex gap-2 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`emhub-tab ${tab === t.id ? 'emhub-tab-active' : ''}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {accounts.length > 0 && tab !== 'settings' && (
          <select
            className="emhub-account-select"
            value={accountId}
            onChange={(e) => selectAccount(e.target.value)}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label || a.email_address}
              </option>
            ))}
          </select>
        )}
      </div>
      {tab === 'settings' && (
        <EmailSettingsPanel
          onAccountChange={(id) => {
            selectAccount(id);
            fetchEmailSettings().then(setAccounts);
          }}
        />
      )}
      {tab === 'mailbox' && (
        <EmailMailbox emailSettingsId={accountId} composeInitial={composeLaunch} />
      )}
      {tab === 'marketing' && (
        <MarketingDashboard
          emailSettingsId={accountId}
          initialDraft={marketingDraft}
          onInitialDraftConsumed={() => setMarketingDraft(null)}
        />
      )}
      {tab === 'automations' && <EmailMarketingHub automationsOnly emailSettingsId={accountId} />}
    </div>
  );
}
