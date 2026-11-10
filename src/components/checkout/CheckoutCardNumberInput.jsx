/**
 * Android WebView-safe card digit fields.
 *
 * - type="tel" (most reliable digit pad on Capacitor/Android)
 * - no spaces/slashes while typing (inserting them into controlled values
 *   desyncs the numeric IME and further keys are dropped)
 * - format separators only on blur
 * - autocomplete off (Google Autofill overlay often steals focus)
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

export function CheckoutCardNumberInput({ value = '', onChange, className = '', ...rest }) {
  return (
    <input
      {...rest}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="next"
      placeholder="4242 4242 4242 4242"
      value={value}
      onChange={(e) => onChange?.(digitsOnly(e.target.value, 16))}
      onBlur={(e) => onChange?.(cardDisplay(e.target.value))}
      className={className || fieldClass}
    />
  );
}

export function CheckoutExpiryInput({ value = '', onChange, className = '', ...rest }) {
  return (
    <input
      {...rest}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="next"
      placeholder="MM/YY"
      value={value}
      onChange={(e) => onChange?.(digitsOnly(e.target.value, 4))}
      onBlur={(e) => onChange?.(expiryDisplay(e.target.value))}
      className={className || fieldClass}
    />
  );
}

export function CheckoutCvvInput({ value = '', onChange, className = '', ...rest }) {
  return (
    <input
      {...rest}
      type="tel"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      enterKeyHint="done"
      placeholder="123"
      value={value}
      onChange={(e) => onChange?.(digitsOnly(e.target.value, 4))}
      className={className || fieldClass}
    />
  );
}
