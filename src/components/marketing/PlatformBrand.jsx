import { Link } from 'react-router-dom';
import { PLATFORM_BRAND_LINE, PLATFORM_NAME } from '../../lib/marketing/platformCopy.js';

/**
 * PoreiaGo platform wordmark — wave mark + Poreia/Go split.
 * Sized as a header brand signal (not a tiny nav icon).
 */
export default function PlatformBrand({ className = '', variant = 'dark', asLink = true }) {
  const isDark = variant === 'dark';
  const mark = (
    <span className={`pg-brand ${isDark ? 'pg-brand--dark' : 'pg-brand--light'} ${className}`.trim()}>
      <svg
        className="pg-brand-mark"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M14 38c0-10 4.5-18 10-26"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
        />
        <path
          d="M24 40c0-11 4.8-20 11-28"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
          opacity="0.85"
        />
        <path
          d="M34 42c0-12 4.2-21 9-28"
          stroke="currentColor"
          strokeWidth="5.5"
          strokeLinecap="round"
          opacity="0.7"
        />
      </svg>
      <span className="pg-brand-copy">
        <span className="pg-brand-name">
          Poreia<span className="pg-brand-go">Go</span>
        </span>
        <span className="pg-brand-line">{PLATFORM_BRAND_LINE}</span>
      </span>
    </span>
  );

  if (!asLink) return mark;
  return (
    <Link
      to="/"
      className="pg-brand-link hover:opacity-90 transition-opacity"
      aria-label={`${PLATFORM_NAME} — Αρχική`}
    >
      {mark}
    </Link>
  );
}
