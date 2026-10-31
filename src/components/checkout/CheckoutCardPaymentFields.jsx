import { forwardRef, useImperativeHandle, useRef } from 'react';

/**
 * Fully uncontrolled card fields for Capacitor Android WebView.
 *
 * Any React setState on each keystroke (even local) can remount/reconcile
 * the focused <input> and make the WebView scroll to the top + drop digits.
 * Values are read from the DOM via ref.getValues() only on submit.
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

function clampDigits(el, max) {
  if (!el) return;
  const next = digitsOnly(el.value, max);
  if (el.value !== next) {
    const start = el.selectionStart;
    el.value = next;
    // Keep caret at end after strip — mid-field caret + IME is unreliable on WebView.
    try {
      const pos = typeof start === 'number' ? Math.min(start, next.length) : next.length;
      el.setSelectionRange(pos, pos);
    } catch {
      /* ignore */
    }
  }
}

const CheckoutCardPaymentFields = forwardRef(function CheckoutCardPaymentFields(_props, ref) {
  const numberRef = useRef(null);
  const expiryRef = useRef(null);
  const cvvRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      getValues: () => ({
        cardNumber: cardDisplay(numberRef.current?.value),
        expiry: expiryDisplay(expiryRef.current?.value),
        cvv: digitsOnly(cvvRef.current?.value, 4),
      }),
    }),
    [],
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
          ref={numberRef}
          id="checkout-card-number"
          name="checkout-card-number"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          placeholder="4242 4242 4242 4242"
          defaultValue=""
          onInput={(e) => clampDigits(e.currentTarget, 16)}
          onBlur={(e) => {
            e.currentTarget.value = cardDisplay(e.currentTarget.value);
          }}
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
            ref={expiryRef}
            id="checkout-card-expiry"
            name="checkout-card-expiry"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="MM/YY"
            defaultValue=""
            onInput={(e) => clampDigits(e.currentTarget, 4)}
            onBlur={(e) => {
              e.currentTarget.value = expiryDisplay(e.currentTarget.value);
            }}
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
            ref={cvvRef}
            id="checkout-card-cvv"
            name="checkout-card-cvv"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            placeholder="123"
            defaultValue=""
            onInput={(e) => clampDigits(e.currentTarget, 4)}
            className={fieldClass}
          />
        </div>
      </div>
    </div>
  );
});

export default CheckoutCardPaymentFields;
