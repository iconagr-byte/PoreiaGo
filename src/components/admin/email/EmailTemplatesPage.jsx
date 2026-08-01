import { useEffect, useMemo, useState } from 'react';
import { LayoutTemplate } from 'lucide-react';
import { STITCH_CAMPAIGN_TEMPLATES } from '../../../lib/email/stitchTemplates.js';
import { resolveStitchTemplateAccess } from '../../../lib/email/stitchTemplateAccess.js';
import { fetchBillingSubscription } from '../../../services/billingApi.js';
import { fetchAdminOfficeModules } from '../../../services/officeModulesApi.js';
import CampaignTemplatesGallery from './CampaignTemplatesGallery.jsx';
import '../../../styles/emailMarketingHub.css';

export default function EmailTemplatesPage({
  onUseTemplate,
  rentEnabled: rentEnabledProp,
  onOpenContracts,
}) {
  const [modules, setModules] = useState(null);
  const [subscription, setSubscription] = useState(null);

  useEffect(() => {
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
  }, []);

  const access = useMemo(
    () =>
      resolveStitchTemplateAccess({
        rentEnabled: rentEnabledProp,
        modules: modules || undefined,
        subscription,
      }),
    [rentEnabledProp, modules, subscription],
  );

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
              {STITCH_CAMPAIGN_TEMPLATES.length} πρότυπα · Newsletter & Ενοικιάσεις ξεκλειδώνουν με
              συμβόλαιο
            </p>
          </div>
        </div>
        <p className="emh-templates-page-hint">
          Επιλέξτε πρότυπο και πατήστε <strong>Χρήση</strong> για νέα καμπάνια. Τα packs{' '}
          <strong>Newsletter</strong> και <strong>Ενοικιάσεις</strong> ενεργοποιούνται όταν αγοραστεί
          το αντίστοιχο συμβόλαιο.
        </p>
      </header>

      <CampaignTemplatesGallery
        variant="page"
        onSelect={onUseTemplate}
        access={access}
        onRequestUnlock={() => onOpenContracts?.()}
      />
    </div>
  );
}
