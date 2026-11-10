/**
 * Stripe PaymentElement modal for rental PaymentIntents.
 * Uses @stripe/react-stripe-js when available; otherwise loads Stripe.js from CDN.
 */
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

let stripePromiseCache = null;

async function loadStripeJs(publishableKey) {
  if (!publishableKey) return null;
  try {
    const mod = await import('@stripe/stripe-js');
    if (!stripePromiseCache) {
      stripePromiseCache = mod.loadStripe(publishableKey);
    }
    return stripePromiseCache;
  } catch {
    // CDN fallback when npm package missing / install failed.
    if (!window.Stripe) {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://js.stripe.com/v3/';
        s.async = true;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    return window.Stripe(publishableKey);
  }
}

function CdnPaymentForm({ clientSecret, publishableKey, onSuccess, onClose }) {
  const [busy, setBusy] = useState(false);
  const [stripe, setStripe] = useState(null);
  const [elements, setElements] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await loadStripeJs(publishableKey);
        if (cancelled || !s) return;
        setStripe(s);
        const el = s.elements({ clientSecret });
        const payment = el.create('payment');
        payment.mount('#rental-stripe-payment-element');
        setElements(el);
        setReady(true);
      } catch (err) {
        toast.error(err.message || 'Stripe load failed');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientSecret, publishableKey]);

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (error) {
        toast.error(error.message || 'Payment failed');
        return;
      }
      if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
        onSuccess?.(paymentIntent);
      }
    } catch (err) {
      toast.error(err.message || 'Payment failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="font-bold text-gray-900">Πληρωμή με κάρτα</h3>
          <button type="button" className="text-sm text-gray-500" onClick={onClose}>
            Κλείσιμο
          </button>
        </div>
        <div id="rental-stripe-payment-element" className="min-h-[180px]" />
        <button
          type="button"
          disabled={!ready || busy}
          onClick={pay}
          className="mt-4 w-full rounded-xl bg-[#0a7a6c] text-white font-bold py-3 disabled:opacity-50"
        >
          {busy ? '…' : 'Πληρωμή'}
        </button>
      </div>
    </div>
  );
}

function ReactStripePay({ clientSecret, publishableKey, onSuccess, onClose }) {
  const [StripeReact, setStripeReact] = useState(null);
  const [stripePromise, setStripePromise] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [js, react] = await Promise.all([
          import('@stripe/stripe-js'),
          import('@stripe/react-stripe-js'),
        ]);
        if (cancelled) return;
        setStripeReact(react);
        setStripePromise(js.loadStripe(publishableKey));
      } catch {
        if (!cancelled) setStripeReact(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publishableKey]);

  if (!StripeReact || !stripePromise) {
    return (
      <CdnPaymentForm
        clientSecret={clientSecret}
        publishableKey={publishableKey}
        onSuccess={onSuccess}
        onClose={onClose}
      />
    );
  }

  const { Elements, PaymentElement, useStripe, useElements } = StripeReact;

  function Inner() {
    const stripe = useStripe();
    const elements = useElements();
    const [busy, setBusy] = useState(false);
    const submit = async () => {
      if (!stripe || !elements) return;
      setBusy(true);
      try {
        const { error, paymentIntent } = await stripe.confirmPayment({
          elements,
          redirect: 'if_required',
        });
        if (error) {
          toast.error(error.message || 'Payment failed');
          return;
        }
        if (paymentIntent?.status === 'succeeded' || paymentIntent?.status === 'processing') {
          onSuccess?.(paymentIntent);
        }
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/45 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-bold text-gray-900">Πληρωμή με κάρτα</h3>
            <button type="button" className="text-sm text-gray-500" onClick={onClose}>
              Κλείσιμο
            </button>
          </div>
          <PaymentElement />
          <button
            type="button"
            disabled={!stripe || busy}
            onClick={submit}
            className="mt-4 w-full rounded-xl bg-[#0a7a6c] text-white font-bold py-3 disabled:opacity-50"
          >
            {busy ? '…' : 'Πληρωμή'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <Inner />
    </Elements>
  );
}

export default function RentalStripePay({
  clientSecret,
  publishableKey,
  onSuccess,
  onClose,
}) {
  const key = useMemo(
    () =>
      publishableKey ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY) ||
      '',
    [publishableKey],
  );

  if (!clientSecret) return null;
  if (!key) {
    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4">
        <div className="rounded-2xl bg-white p-5 max-w-sm text-sm text-gray-700">
          <p>Λείπει το Stripe publishable key (VITE_STRIPE_PUBLISHABLE_KEY).</p>
          <button type="button" className="mt-3 font-bold text-[#0a7a6c]" onClick={onClose}>
            Κλείσιμο
          </button>
        </div>
      </div>
    );
  }

  return (
    <ReactStripePay
      clientSecret={clientSecret}
      publishableKey={key}
      onSuccess={onSuccess}
      onClose={onClose}
    />
  );
}
