import { useEffect, useRef } from 'react';

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

/**
 * Uncontrolled-while-focused card digit fields.
 * Controlled value= + space formatting was remounting layout and scrolling
 * the Android WebView to the top on every keypress.
 */
export function CheckoutCardNumberInput({ value = '', onChange, className = '', ...rest }) {
  return (
    <DigitFormatInput
      value={value}
      onChange={onChange}
      className={className}
      format={formatCardNumber}
      inputMode="numeric"
      autoComplete="cc-number"
      placeholder="4242 4242 4242 4242"
      {...rest}
    />
  );
}

export function CheckoutExpiryInput({ value = '', onChange, className = '', ...rest }) {
  return (
    <DigitFormatInput
      value={value}
      onChange={onChange}
      className={className}
      format={formatExpiry}
      inputMode="numeric"
      autoComplete="cc-exp"
      placeholder="MM/YY"
      {...rest}
    />
  );
}

export function CheckoutCvvInput({ value = '', onChange, className = '', ...rest }) {
  return (
    <DigitFormatInput
      value={value}
      onChange={onChange}
      className={className}
      format={formatCvv}
      inputMode="numeric"
      autoComplete="cc-csc"
      placeholder="123"
      {...rest}
    />
  );
}

function DigitFormatInput({ value = '', onChange, format, className = '', ...rest }) {
  const ref = useRef(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || focusedRef.current) return;
    const next = value || '';
    if (el.value !== next) el.value = next;
  }, [value]);

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      defaultValue={value || ''}
      className={className}
      onFocus={(e) => {
        focusedRef.current = true;
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        const formatted = format(e.target.value);
        e.target.value = formatted;
        onChange?.(formatted);
        rest.onBlur?.(e);
      }}
      onChange={(e) => {
        const el = e.target;
        const prev = el.value;
        const caret = el.selectionStart ?? prev.length;
        const formatted = format(prev);
        if (formatted !== prev) {
          el.value = formatted;
          const delta = formatted.length - prev.length;
          const nextCaret = Math.max(0, caret + delta);
          try {
            el.setSelectionRange(nextCaret, nextCaret);
          } catch {
            /* ignore */
          }
        }
        onChange?.(el.value);
      }}
    />
  );
}
