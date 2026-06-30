import { LayoutTemplate, X } from 'lucide-react';
import CampaignTemplatesGallery from './CampaignTemplatesGallery.jsx';

export default function CampaignTemplatesModal({ open, onClose, onSelect }) {
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
                Σύρετε την μικρογραφία για όλο το email · «Προεπισκόπηση» για μεγέθυνση
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="emh-btn-ghost p-2 shrink-0" aria-label="Κλείσιμο">
            <X size={20} />
          </button>
        </header>

        <CampaignTemplatesGallery
          variant="modal"
          onSelect={(tpl) => {
            onSelect(tpl);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
