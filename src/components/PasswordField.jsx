import { useState } from 'react';

const DEFAULT_INPUT_CLASS =
  'w-full px-4 py-3.5 pr-12 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container';

function EyeIcon({ off = false }) {
  if (off) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.5 10.5 0 0 1 12 5c5 0 9.3 3.1 11 7.5a11.8 11.8 0 0 1-4.2 5.1M6.1 6.1A11.8 11.8 0 0 0 1 12.5C2.7 16.9 7 20 12 20c1.4 0 2.7-.2 3.9-.7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M1 12.5C2.7 8.1 7 5 12 5s9.3 3.1 11 7.5c-1.7 4.4-6 7.5-11 7.5S2.7 16.9 1 12.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12.5" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export default function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  placeholder = '••••••••',
  required = false,
  minLength,
  className,
  inputClassName,
  labelClassName = 'block text-sm font-bold',
}) {
  const [visible, setVisible] = useState(false);
  const controlled = value !== undefined;
  const inputCls = `${inputClassName || className || DEFAULT_INPUT_CLASS}`.includes('pr-')
    ? inputClassName || className || DEFAULT_INPUT_CLASS
    : `${inputClassName || className || DEFAULT_INPUT_CLASS} pr-12`;

  return (
    <div className="space-y-1">
      {label ? (
        <label className={labelClassName} htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={id}
          name={name || id}
          type={visible ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          disabled={disabled}
          {...(controlled ? { value, onChange } : { onChange })}
          className={inputCls}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setVisible((v) => !v);
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-white text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-900"
          aria-label={visible ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
          aria-pressed={visible}
          title={visible ? 'Απόκρυψη' : 'Εμφάνιση'}
        >
          <EyeIcon off={visible} />
        </button>
      </div>
    </div>
  );
}
