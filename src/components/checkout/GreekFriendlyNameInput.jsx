import { useEffect, useRef } from 'react';

/**
 * Android WebView-friendly name field for Greek (and other non-Latin) IME.
 *
 * Avoids controlled `value=` while focused — React re-renders mid-composition
 * often force Latin glyphs. Also uses autocapitalize="none" (not "off";
 * Chromium/WebView ignores invalid tokens and may keep words/sentences).
 */
export default function GreekFriendlyNameInput({
  value = '',
  onChange,
  className = '',
  ...rest
}) {
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
      lang="el-GR"
      inputMode="text"
      autoCapitalize="none"
      autoCorrect="off"
      autoComplete="off"
      spellCheck={false}
      defaultValue={value || ''}
      className={className}
      onFocus={(e) => {
        focusedRef.current = true;
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        onChange?.(e.target.value);
        rest.onBlur?.(e);
      }}
      onChange={(e) => {
        onChange?.(e.target.value);
      }}
    />
  );
}
