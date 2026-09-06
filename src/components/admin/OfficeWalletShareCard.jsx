import { useEffect, useRef, useState } from 'react';
import { QRCode } from 'react-qr-code';
import toast from 'react-hot-toast';
import { fetchTenantBrandingSettings } from '../../services/growthApi.js';
import {
  getOfficeShareDisplayName,
  getOfficeWalletUrl,
} from '../../lib/platform/officePublicUrl.js';

/**
 * Dashboard card: per-office My Wallet QR + public link for customers.
 */
export default function OfficeWalletShareCard() {
  const [walletUrl, setWalletUrl] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [loading, setLoading] = useState(true);
  const qrRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    // Resolve current office first, then emit wallet link + QR for that office only.
    // Pass browser host so PoreiaGo admin never advertises Achillio Travel domain.
    const contextHost =
      typeof window !== 'undefined' ? window.location.hostname : '';
    fetchTenantBrandingSettings()
      .then((branding) => {
        if (cancelled) return;
        const office = branding || {};
        setWalletUrl(getOfficeWalletUrl(office, { contextHost }));
        setOfficeName(getOfficeShareDisplayName(office));
      })
      .catch(() => {
        if (!cancelled) {
          setWalletUrl(getOfficeWalletUrl({}, { contextHost }));
          setOfficeName('Γραφείο');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const copyLink = async () => {
    if (!walletUrl) return;
    try {
      await navigator.clipboard.writeText(walletUrl);
      toast.success('Ο σύνδεσμος My Wallet αντιγράφηκε');
    } catch {
      toast.error('Αποτυχία αντιγραφής');
    }
  };

  const openLink = () => {
    if (!walletUrl) return;
    window.open(walletUrl, '_blank', 'noopener,noreferrer');
  };

  const printSheet = () => {
    if (!walletUrl) return;
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) {
      toast.error('Επιτρέψτε pop-up για εκτύπωση');
      return;
    }
    const title = officeName ? `My Wallet — ${officeName}` : 'My Wallet';
    const svg = qrRef.current?.querySelector('svg');
    const qrHtml = svg
      ? new XMLSerializer().serializeToString(svg)
      : `<p style="font-family:monospace;font-size:12px;word-break:break-all">${walletUrl}</p>`;
    w.document.write(`
      <!DOCTYPE html><html lang="el"><head><meta charset="utf-8"/>
      <title>${title.replace(/</g, '')}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 32px; max-width: 640px; margin: 0 auto; color: #0f172a; }
        h1 { font-size: 1.4rem; letter-spacing: -0.02em; margin: 0 0 8px; }
        p { color: #64748b; line-height: 1.55; }
        .url { font-family: ui-monospace, monospace; font-size: 13px; word-break: break-all; background: #f4f7fb; padding: 14px; border-radius: 12px; color: #0f172a; }
        .qr { margin: 28px auto; width: 220px; height: 220px; display: flex; align-items: center; justify-content: center; }
        .qr svg { width: 200px; height: 200px; }
        .note { font-size: 13px; color: #94a3b8; margin-top: 24px; }
      </style></head><body>
      <h1>${title.replace(/</g, '')}</h1>
      <p>Σκανάρετε για να ανοίξετε το My Wallet και το εισιτήριό σας.</p>
      <div class="qr">${qrHtml}</div>
      <p class="url">${walletUrl.replace(/</g, '')}</p>
      <p class="note">Μετά τη σύνδεση εμφανίζεται το QR επιβίβασης. Μπορείτε να το προσθέσετε στην αρχική οθόνη.</p>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="h-full rounded-[22px] bg-white/80 backdrop-blur-xl border border-sky-100/80 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-6 sm:p-7 flex flex-col gap-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-500/90">
          Πελάτες
        </p>
        <h3 className="mt-1 text-[19px] font-semibold tracking-tight text-zinc-900">
          My Wallet λεωφορείων — QR
        </h3>
        {officeName ? (
          <p className="mt-1 text-[13px] font-medium text-sky-700/90 tracking-tight">
            Γραφείο: {officeName}
          </p>
        ) : null}
        <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-500 tracking-tight">
          Μόνο εισιτήρια λεωφορείου (<span className="font-medium text-zinc-700">/wallet</span>). Η
          ενοικίαση είναι στο πράσινο Rent Wallet (<span className="font-medium text-zinc-700">/rent/wallet</span>).
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start flex-1">
        <div
          ref={qrRef}
          className="rounded-[18px] bg-sky-50/80 p-4 border border-sky-100 shrink-0 min-h-[164px] min-w-[164px] flex items-center justify-center"
        >
          {loading || !walletUrl ? (
            <span className="text-xs font-semibold text-zinc-400">Φόρτωση…</span>
          ) : (
            <QRCode value={walletUrl} size={132} bgColor="transparent" />
          )}
        </div>
        <div className="flex-1 w-full min-w-0 space-y-3">
          <div className="rounded-[14px] bg-zinc-50 px-3.5 py-3 border border-zinc-100">
            <p className="text-[11px] font-medium text-zinc-400 mb-1">Σύνδεσμος</p>
            <code className="text-[12px] break-all text-zinc-700 leading-snug">
              {loading ? '…' : walletUrl || '—'}
            </code>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              disabled={!walletUrl}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2.5 rounded-[12px] bg-zinc-900 text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              Αντιγραφή
            </button>
            <button
              type="button"
              onClick={openLink}
              disabled={!walletUrl}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2.5 rounded-[12px] bg-sky-600 text-white hover:bg-sky-700 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              Άνοιγμα
            </button>
            <button
              type="button"
              onClick={printSheet}
              disabled={!walletUrl}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2.5 rounded-[12px] bg-zinc-100 text-zinc-800 hover:bg-zinc-200/80 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              Εκτύπωση
            </button>
          </div>
          <p className="text-[12px] text-zinc-500 leading-relaxed">
            Ο σύνδεσμος είναι μόνο για αυτό το γραφείο — δεν μοιράζεται domain με άλλο
            γραφείο (π.χ. Achillio Travel ≠ PoreiaGo).
          </p>
        </div>
      </div>
    </div>
  );
}
