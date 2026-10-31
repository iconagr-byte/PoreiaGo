import { forwardRef, useImperativeHandle, useState } from 'react';

/**
 * Card fields with LOCAL state only.
 * Parent CheckoutPage must NOT setState on each digit — that re-render
 * makes Android WebView scroll the page to the top and drop keypresses.
 */

function digitsOnly(raw, max) {
  return String(raw || '')
    .replace(/\D/g, '')
    .slice(0, max);
}

function cardDisplay(raw) {
  return digitsOnly(raw, 16)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

function expiryDisplay(raw) {
  const d = digitsOnly(raw, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-surface-container bg-white px-3 py-2.5 text-base font-mono focus:ring-2 focus:ring-primary focus:outline-none';

function keepFieldInView(el) {
  if (!el || typeof el.scrollIntoView !== 'function') return;
  try {
    el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  } catch {
    el.scrollIntoView(false);
  }
}

const CheckoutCardPaymentFields = forwardRef(function CheckoutCardPaymentFields(_props, ref) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  useImperativeHandle(
    ref,
    () => ({
      getValues: () => ({
        cardNumber: cardDisplay(cardNumber),
        expiry: expiryDisplay(expiry),
        cvv: digitsOnly(cvv, 4),
      }),
    }),
    [cardNumber, expiry, cvv],
  );

  return (
    <div className="space-y-4 p-4 rounded-xl bg-surface-container-low border border-surface-container">
      <div className="block">
        <label
          htmlFor="checkout-card-number"
          className="font-bold text-xs text-on-surface-variant uppercase"
        >
          Αριθμός κάρτας
        </label>
        <input
          id="checkout-card-number"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          placeholder="4242 4242 4242 4242"
          value={cardNumber}
          onFocus={(e) => keepFieldInView(e.currentTarget)}
          onChange={(e) => setCardNumber(digitsOnly(e.target.value, 16))}
          onBlur={() => setCardNumber((v) => cardDisplay(v))}
          className={fieldClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="block">
          <label
            htmlFor="checkout-card-expiry"
            className="font-bold text-xs text-on-surface-variant uppercase"
          >
            Λήξη
          </label>
          <input
            id="checkout-card-expiry"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="MM/YY"
            value={expiry}
            onFocus={(e) => keepFieldInView(e.currentTarget)}
            onChange={(e) => setExpiry(digitsOnly(e.target.value, 4))}
            onBlur={() => setExpiry((v) => expiryDisplay(v))}
            className={fieldClass}
          />
        </div>
        <div className="block">
          <label
            htmlFor="checkout-card-cvv"
            className="font-bold text-xs text-on-surface-variant uppercase"
          >
            CVV
          </label>
          <input
            id="checkout-card-cvv"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="123"
            value={cvv}
            onFocus={(e) => keepFieldInView(e.currentTarget)}
            onChange={(e) => setCvv(digitsOnly(e.target.value, 4))}
            className={fieldClass}
          />
        </div>
      </div>
    </div>
  );
});

export default CheckoutCardPaymentFields;
