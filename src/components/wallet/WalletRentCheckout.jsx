import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RentBookingServicesStep from '../rental/RentBookingServicesStep.jsx';
import RentBookingDetailsStep from '../rental/RentBookingDetailsStep.jsx';
import RentBookingPaymentStep from '../rental/RentBookingPaymentStep.jsx';
import { parseWizardNavTarget } from '../../lib/rental/rentWizardEmbed.js';

const STEP_META = {
  services: { title: 'Υπηρεσίες', back: 'Στόλος' },
  details: { title: 'Στοιχεία', back: 'Υπηρεσίες' },
  payment: { title: 'Πληρωμή', back: 'Στοιχεία' },
};

function scrollCheckoutToTop(root) {
  const main = document.querySelector('.wallet-main');
  if (main) {
    try {
      main.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    } catch {
      main.scrollTop = 0;
    }
  }
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  } catch {
    window.scrollTo(0, 0);
  }
  if (root && typeof root.scrollIntoView === 'function') {
    try {
      root.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'auto' });
    } catch {
      /* ignore */
    }
  }
}

/**
 * In-wallet rent checkout — same desktop wizard steps, mobile-first chrome.
 */
export default function WalletRentCheckout({
  brandLabel = 'Γραφείο',
  initialStep = 'services',
  onExit,
  onBooked,
} = {}) {
  const routerNavigate = useNavigate();
  const rootRef = useRef(null);
  const [step, setStep] = useState(
    initialStep === 'details' || initialStep === 'payment' ? initialStep : 'services',
  );

  // Always land at the top of the handset scrollport when a wizard step opens.
  useLayoutEffect(() => {
    scrollCheckoutToTop(rootRef.current);
    const t = window.setTimeout(() => scrollCheckoutToTop(rootRef.current), 40);
    return () => window.clearTimeout(t);
  }, [step]);

  const onWizardNav = useCallback(
    (to, opts) => {
      const target = parseWizardNavTarget(to);
      if (target === 'services' || target === 'details' || target === 'payment') {
        setStep(target);
        return true;
      }
      if (target === 'fleet' || target === 'done') {
        onExit?.({ reason: target });
        return true;
      }
      if (target === 'login') {
        routerNavigate(to, opts);
        return true;
      }
      return false;
    },
    [onExit, routerNavigate],
  );

  const goBack = () => {
    if (step === 'payment') setStep('details');
    else if (step === 'details') setStep('services');
    else onExit?.({ reason: 'back' });
  };

  const meta = STEP_META[step] || STEP_META.services;

  return (
    <div ref={rootRef} className="wallet-rent-checkout" data-step={step}>
      <div className="wallet-rent-checkout-hero" aria-hidden>
        <span className="wallet-rent-checkout-orb wallet-rent-checkout-orb--a" />
        <span className="wallet-rent-checkout-orb wallet-rent-checkout-orb--b" />
      </div>

      <header className="wallet-rent-checkout-bar">
        <button type="button" className="wallet-rent-checkout-back" onClick={goBack}>
          <span className="material-symbols-outlined" aria-hidden>
            arrow_back
          </span>
          {meta.back}
        </button>
        <div className="wallet-rent-checkout-bar-copy">
          <p>{brandLabel}</p>
          <strong>{meta.title}</strong>
        </div>
        <button
          type="button"
          className="wallet-rent-checkout-close"
          aria-label="Κλείσιμο"
          onClick={() => onExit?.({ reason: 'close' })}
        >
          <span className="material-symbols-outlined" aria-hidden>
            close
          </span>
        </button>
      </header>

      <div className="wallet-rent-checkout-body" key={step}>
        {step === 'payment' ? (
          <RentBookingPaymentStep
            brandLabel={brandLabel}
            onWizardNav={onWizardNav}
            onBooked={onBooked}
          />
        ) : step === 'details' ? (
          <RentBookingDetailsStep brandLabel={brandLabel} onWizardNav={onWizardNav} />
        ) : (
          <RentBookingServicesStep brandLabel={brandLabel} onWizardNav={onWizardNav} />
        )}
      </div>
    </div>
  );
}
