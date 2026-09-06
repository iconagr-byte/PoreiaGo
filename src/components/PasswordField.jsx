import { useState } from 'react';

const DEFAULT_INPUT_CLASS =
  'w-full px-4 py-3.5 pr-12 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container';

export default function PasswordField({
  id,
  name,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  placeholder = '••••••••',
  required = true,
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
          {...(controlled ? { value, onChange } : { onChange })}
          className={inputCls}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-black/[0.04]"
          aria-label={visible ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
          aria-pressed={visible}
          tabIndex={-1}
        >
          <span className="material-symbols-outlined text-[20px]">
            {visible ? 'visibility_off' : 'visibility'}
          </span>
        </button>
      </div>
    </div>
  );
}
