import { forwardRef, memo, useImperativeHandle, useRef } from 'react';

/**
 * Bare DOM card fields for Capacitor Android WebView.
 *
 * Critical: do not nest overflow-y scroll parents around these, do not
 * rewrite el.value while focused, do not use React controlled value.
 * Digits are read only at submit via getValues().
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
  'checkout-card-field mt-1 w-full rounded-xl border border-surface-container bg-white px-3 py-3 text-base font-mono focus:ring-2 focus:ring-primary focus:outline-none';

const CheckoutCardPaymentFields = memo(
  forwardRef(function CheckoutCardPaymentFields(_props, ref) {
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
      <div
        className="space-y-4 p-4 rounded-xl bg-surface-container-low border border-surface-container"
        // Isolate from parent pan/scroll gesture steal on Android.
        style={{ touchAction: 'manipulation' }}
      >
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
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={16}
            placeholder="4242424242424242"
            defaultValue=""
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
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              maxLength={4}
              placeholder="MMYY"
              defaultValue=""
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
              type="text"
              inputMode="numeric"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              maxLength={4}
              placeholder="123"
              defaultValue=""
              className={fieldClass}
            />
          </div>
        </div>
      </div>
    );
  }),
);

export default CheckoutCardPaymentFields;
