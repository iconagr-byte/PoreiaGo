import { useState } from 'react';

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete = 'new-password',
  placeholder = '••••••••',
  required = true,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="w-full px-4 py-3.5 pr-12 bg-surface-container-low rounded-2xl focus:ring-2 focus:ring-primary-container"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-black/[0.04]"
          aria-label={visible ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
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
