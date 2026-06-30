import { Link } from 'react-router-dom';
import { PLATFORM_NAME } from '../../lib/marketing/platformCopy.js';

/** Neutral platform wordmark — not a single travel agency. */
export default function PlatformBrand({ className = '', variant = 'dark', asLink = true }) {
  const isDark = variant === 'dark';
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-sm shadow-lg ${
          isDark
            ? 'bg-gradient-to-br from-sky-400 to-indigo-600 text-white'
            : 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white'
        }`}
      >
        T
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={`font-bold text-lg tracking-tight ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          {PLATFORM_NAME}
        </span>
        <span
          className={`text-[10px] font-semibold uppercase tracking-[0.14em] mt-0.5 ${
            isDark ? 'text-white/50' : 'text-slate-500'
          }`}
        >
          Travel Agency SaaS
        </span>
      </span>
    </span>
  );

  if (!asLink) return inner;
  return (
    <Link to="/" className="shrink-0 hover:opacity-90 transition-opacity" aria-label={`${PLATFORM_NAME} — Αρχική`}>
      {inner}
    </Link>
  );
}
