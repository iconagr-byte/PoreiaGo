import { forwardRef, memo, useImperativeHandle, useRef } from 'react';

/**
 * Bare uncontrolled card fields for Capacitor Android WebView.
 *
 * Hard rules (learned the hard way):
 * - NO React state / controlled `value` while typing
 * - NEVER write `el.value = …` on input/keypress (kills Gboard after 1 digit)
 * - NEVER scrollTo / scrollIntoView while focused
 * - type="text" + inputMode="numeric" (type="tel" + pattern is flaky on WebView)
 * - Spaces/slashes only when READING values for submit — not in the live field
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
            name="cc-number"
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            maxLength={19}
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
              name="cc-exp"
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              maxLength={5}
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
              name="cc-csc"
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              autoCapitalize="off"
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
