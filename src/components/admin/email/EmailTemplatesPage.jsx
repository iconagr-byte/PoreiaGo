import { LayoutTemplate } from 'lucide-react';
import { STITCH_CAMPAIGN_TEMPLATES } from '../../../lib/email/stitchTemplates.js';
import CampaignTemplatesGallery from './CampaignTemplatesGallery.jsx';
import '../../../styles/emailMarketingHub.css';

export default function EmailTemplatesPage({ onUseTemplate }) {
  return (
    <div className="emh-luxury emh-templates-page space-y-5">
      <header className="emh-templates-page-header">
        <div className="flex items-start gap-3 min-w-0">
          <span className="emh-templates-page-icon" aria-hidden>
            <LayoutTemplate size={26} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <h2 className="emh-page-title m-0">Πρότυπα email</h2>
            <p className="emh-page-sub m-0 mt-1">
              {STITCH_CAMPAIGN_TEMPLATES.length} έτοιμα πρότυπα · Horizon Ethos / Stitch gallery
            </p>
          </div>
        </div>
        <p className="emh-templates-page-hint">
          Επιλέξτε πρότυπο και πατήστε <strong>Χρήση</strong> για νέα καμπάνια στο Marketing editor.
        </p>
      </header>

      <CampaignTemplatesGallery variant="page" onSelect={onUseTemplate} />
    </div>
  );
}
