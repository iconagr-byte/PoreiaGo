/**
 * Card digit fields — format in React state only.
 * Never assign input.value in onChange: Android numeric IME drops subsequent
 * keypresses when the DOM value is rewritten mid-input.
 */

function formatCardNumber(raw) {
  const digits = String(raw || '')
    .replace(/\D/g, '')
    .slice(0, 16);
  return digits.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(raw) {
  const digits = String(raw || '')
    .replace(/\D/g, '')
    .slice(0, 4);
  if (digits.length >= 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function formatCvv(raw) {
  return String(raw || '')
    .replace(/\D/g, '')
    .slice(0, 4);
}

const fieldClass =
  'mt-1 w-full rounded-xl border border-surface-container bg-white px-3 py-2.5 text-base font-mono focus:ring-2 focus:ring-primary focus:outline-none';

export function CheckoutCardNumberInput({ value = '', onChange, className = '', ...rest }) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="cc-number"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      placeholder="4242 4242 4242 4242"
      value={value}
      onChange={(e) => onChange?.(formatCardNumber(e.target.value))}
      className={className || fieldClass}
    />
  );
}

export function CheckoutExpiryInput({ value = '', onChange, className = '', ...rest }) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="cc-exp"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      placeholder="MM/YY"
      value={value}
      onChange={(e) => onChange?.(formatExpiry(e.target.value))}
      className={className || fieldClass}
    />
  );
}

export function CheckoutCvvInput({ value = '', onChange, className = '', ...rest }) {
  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="cc-csc"
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      placeholder="123"
      value={value}
      onChange={(e) => onChange?.(formatCvv(e.target.value))}
      className={className || fieldClass}
    />
  );
}
