import { useState } from 'react';
import toast from 'react-hot-toast';
import { mailTimeoutGuide } from '../../../lib/email/mailReachability.js';

async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(okMsg || 'Αντιγράφηκε', { id: 'email-conn-copy' });
    return true;
  } catch {
    toast.error('Αποτυχία αντιγραφής', { id: 'email-conn-copy' });
    return false;
  }
}

function FactChip({ label, value, onCopy }) {
  return (
    <button
      type="button"
      onClick={() => onCopy(value)}
      title={`Αντιγραφή ${label}`}
      className="group inline-flex min-w-0 flex-col items-start gap-0.5 rounded-xl border border-black/[0.06] bg-white/90 px-3 py-2 text-left transition hover:border-[#0071e3]/35 hover:bg-white hover:shadow-sm"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#86868b]">
        {label}
      </span>
      <span className="max-w-full truncate font-mono text-[13px] font-semibold text-[#1d1d1f] group-hover:text-[#0071e3]">
        {value}
      </span>
    </button>
  );
}

/**
 * Result banner after IMAP/SMTP «Έλεγχος» — success, auth error, or network timeout guide.
 */
export default function EmailConnectionResult({
  ok = false,
  message = '',
  hint = '',
  timeout = false,
  mailHost,
  imapPort,
  smtpPort,
} = {}) {
  const [copied, setCopied] = useState(false);
  const guide = timeout ? mailTimeoutGuide({ mailHost, imapPort, smtpPort }) : null;

  if (ok) {
    return (
      <div
        className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white px-4 py-3.5 shadow-sm"
        role="status"
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white"
            aria-hidden
          >
            ✓
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-emerald-950">Έλεγχος επιτυχής</p>
            <p className="mt-0.5 text-[13px] leading-snug text-emerald-900/80">
              {message || 'IMAP & SMTP: σύνδεση OK — μπορείτε να αποθηκεύσετε.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (timeout && guide) {
    return (
      <div
        className="overflow-hidden rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-[#f5f5f7] shadow-sm"
        role="status"
      >
        <div className="border-b border-amber-200/70 bg-amber-50/80 px-4 py-3">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white"
              aria-hidden
            >
              !
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-amber-950">{guide.title}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-amber-950/75">{guide.summary}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3.5 px-4 py-3.5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {guide.facts.map((f) => (
              <FactChip
                key={f.id}
                label={f.label}
                value={f.value}
                onCopy={(v) => copyText(v, `${f.label} αντιγράφηκε`)}
              />
            ))}
          </div>

          <ol className="space-y-1.5 text-[12.5px] leading-snug text-[#424245]">
            {guide.steps.map((step, i) => (
              <li key={step} className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-[10px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>

          <div className="rounded-xl border border-black/[0.08] bg-[#1d1d1f]/[0.03] p-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[#86868b]">
              Αίτημα για hosting
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[#1d1d1f]">{guide.request}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  const okCopy = await copyText(guide.request, 'Αίτημα whitelist αντιγράφηκε');
                  if (okCopy) {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  }
                }}
                className="inline-flex items-center justify-center rounded-xl bg-[#0071e3] px-3.5 py-2 text-[13px] font-bold text-white shadow-sm transition hover:bg-[#0077ed]"
              >
                {copied ? 'Αντιγράφηκε ✓' : 'Αντιγραφή αιτήματος'}
              </button>
              <button
                type="button"
                onClick={() => copyText(guide.facts[0].copy, 'IP αντιγράφηκε')}
                className="inline-flex items-center justify-center rounded-xl border border-black/[0.1] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#1d1d1f] transition hover:bg-[#f5f5f7]"
              >
                Μόνο IP
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border border-rose-200/90 bg-gradient-to-br from-rose-50 to-white px-4 py-3.5 shadow-sm"
      role="status"
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500 text-sm font-bold text-white"
          aria-hidden
        >
          ✕
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-rose-950">Έλεγχος απέτυχε</p>
          {message ? (
            <p className="mt-0.5 text-[13px] leading-snug whitespace-pre-wrap text-rose-900/85">
              {message}
            </p>
          ) : null}
          {hint ? (
            <p className="mt-2 rounded-xl border border-rose-200/80 bg-white/70 px-3 py-2 text-[12.5px] leading-snug text-rose-950/80">
              {hint}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
