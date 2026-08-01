import { useEffect, useMemo, useState } from 'react';
import { LayoutTemplate, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { resolveStitchTemplateAccess } from '../../../lib/email/stitchTemplateAccess.js';
import { fetchBillingSubscription } from '../../../services/billingApi.js';
import { fetchAdminOfficeModules } from '../../../services/officeModulesApi.js';
import CampaignTemplatesGallery from './CampaignTemplatesGallery.jsx';

export default function CampaignTemplatesModal({ open, onClose, onSelect, onOpenContracts }) {
  const [modules, setModules] = useState(null);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    Promise.all([
      fetchAdminOfficeModules().catch(() => null),
      fetchBillingSubscription().catch(() => null),
    ]).then(([mods, sub]) => {
      if (cancelled) return;
      setModules(mods);
      setSubscription(sub);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const access = useMemo(
    () =>
      resolveStitchTemplateAccess({
        modules: modules || undefined,
        subscription,
      }),
    [modules, subscription],
  );

  if (!open) return null;

  return (
    <div
      className="emh-modal-backdrop emh-templates-backdrop fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emh-templates-modal-title"
      onClick={onClose}
    >
      <div
        className="emh-modal emh-templates-modal rounded-2xl w-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="emh-templates-modal-header">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutTemplate size={22} aria-hidden />
            <div className="min-w-0">
              <h2 id="emh-templates-modal-title" className="emh-templates-modal-title">
                Πρότυπα email · Horizon Ethos
              </h2>
              <p className="emh-templates-modal-sub">
                Newsletter & Ενοικιάσεις ξεκλειδώνουν με συμβόλαιο
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="emh-btn-ghost p-2 shrink-0" aria-label="Κλείσιμο">
            <X size={20} />
          </button>
        </header>

        <CampaignTemplatesGallery
          variant="modal"
          access={access}
          onRequestUnlock={() => {
            onClose?.();
            if (onOpenContracts) onOpenContracts();
            else toast('Ανοίξτε Ρυθμίσεις → Συμβόλαιο για ενεργοποίηση');
          }}
          onSelect={(tpl) => {
            onSelect(tpl);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
