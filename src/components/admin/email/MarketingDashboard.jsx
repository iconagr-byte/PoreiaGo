import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { fetchCampaigns } from '../../../services/emailMarketingApi.js';
import { fetchSubscribers } from '../../../services/emailClientApi.js';
import '../../../styles/emailMarketingHub.css';
import NewCampaignEditor from './NewCampaignEditor.jsx';

export default function MarketingDashboard({
  emailSettingsId = '',
  initialDraft = null,
  onInitialDraftConsumed,
}) {
  const [view, setView] = useState(initialDraft ? 'create' : 'list');
  const [editCampaignId, setEditCampaignId] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [subCount, setSubCount] = useState(0);
  const [createDraft, setCreateDraft] = useState(initialDraft);

  useEffect(() => {
    if (!initialDraft) return;
    setCreateDraft(initialDraft);
    setView('create');
    onInitialDraftConsumed?.();
  }, [initialDraft, onInitialDraftConsumed]);

  const load = async () => {
    try {
      const [c, subs] = await Promise.all([fetchCampaigns(), fetchSubscribers(true)]);
      setCampaigns(c);
      setSubCount(subs.length);
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const backToList = () => {
    setView('list');
    setEditCampaignId(null);
    setCreateDraft(null);
  };

  if (view === 'create') {
    return (
      <div className="emh-luxury emh-luxury--campaign-editor">
        <NewCampaignEditor
          emailSettingsId={emailSettingsId}
          initialDraft={createDraft}
          onBack={backToList}
          onSaved={() => {
            backToList();
            load();
          }}
        />
      </div>
    );
  }

  if (view === 'edit' && editCampaignId) {
    return (
      <div className="emh-luxury emh-luxury--campaign-editor">
        <NewCampaignEditor
          campaignId={editCampaignId}
          emailSettingsId={emailSettingsId}
          onBack={backToList}
          onSaved={() => {
            backToList();
            load();
          }}
          onDeleted={() => {
            backToList();
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="emh-luxury space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="emh-page-title">Marketing & Newsletters</h2>
          <p className="emh-page-sub">
            Εγγεγραμμένοι παραλήπτες: <strong style={{ color: 'var(--emh-accent-strong)' }}>{subCount}</strong>
            {' '}
            · Opens/Clicks με tracking pixel
          </p>
        </div>
        <button type="button" onClick={() => setView('create')} className="emh-btn-primary">
          Νέα καμπάνια
        </button>
      </div>

      <div className="emh-list-card overflow-hidden p-0">
        <table className="emh-table w-full text-left text-body-sm">
          <thead style={{ background: '#f8fafc' }}>
            <tr>
              <th className="p-3">Όνομα</th>
              <th className="p-3">Κατάσταση</th>
              <th className="p-3">Opens</th>
              <th className="p-3">Clicks</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr
                key={c.id}
                className="border-t border-outline-variant hover:bg-surface-container-lowest cursor-pointer"
                onClick={() => {
                  setEditCampaignId(c.id);
                  setView('edit');
                }}
              >
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.status}</td>
                <td className="p-3">{c.open_count ?? 0}</td>
                <td className="p-3">{c.click_count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
