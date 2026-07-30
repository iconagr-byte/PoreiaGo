/**
 * Admin card: QR + link for the customer rental PWA (/rent) of the *current office*.
 */
import { useEffect, useRef, useState } from 'react';
import { QRCode } from 'react-qr-code';
import toast from 'react-hot-toast';
import { fetchTenantBrandingSettings } from '../../../services/growthApi.js';
import { getOfficeRentWalletUrl } from '../../../lib/platform/officePublicUrl.js';

export default function RentAppShareBanner() {
  const [rentUrl, setRentUrl] = useState('');
  const [officeName, setOfficeName] = useState('');
  const [loading, setLoading] = useState(true);
  const qrRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    // 1) Resolve current office (JWT tenant branding), 2) then emit Rent Wallet link + QR.
    fetchTenantBrandingSettings()
      .then((branding) => {
        if (cancelled) return;
        const office = branding || {};
        setOfficeName(office.display_name || office.slug || office.subdomain || 'Γραφείο');
        setRentUrl(getOfficeRentWalletUrl(office));
      })
      .catch(() => {
        if (cancelled) return;
        setOfficeName('Γραφείο');
        setRentUrl(getOfficeRentWalletUrl({}));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const copyLink = async () => {
    if (!rentUrl) return;
    try {
      await navigator.clipboard.writeText(rentUrl);
      toast.success('Ο σύνδεσμος /rent αντιγράφηκε');
    } catch {
      toast.error('Αποτυχία αντιγραφής');
    }
  };

  const printSheet = () => {
    if (!rentUrl) return;
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) {
      toast.error('Επιτρέψτε pop-up για εκτύπωση');
      return;
    }
    const title = officeName ? `Ενοικίαση — ${officeName}` : 'Ενοικίαση — /rent';
    const svg = qrRef.current?.querySelector('svg');
    const qrHtml = svg
      ? new XMLSerializer().serializeToString(svg)
      : `<p style="font-family:monospace;font-size:12px;word-break:break-all">${rentUrl}</p>`;
    w.document.write(`<!DOCTYPE html><html lang="el"><head><meta charset="utf-8"/>
      <title>${String(title).replace(/</g, '')}</title>
      <style>
        body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;padding:32px;max-width:640px;margin:0 auto;color:#1d1d1f}
        h1{font-size:1.45rem;letter-spacing:-.03em;margin:0 0 8px}
        p{color:#6e6e73;line-height:1.55}
        .url{font-family:ui-monospace,monospace;font-size:13px;word-break:break-all;background:#f5f5f7;padding:14px;border-radius:12px}
        .qr{margin:28px auto;width:220px;height:220px;display:flex;align-items:center;justify-content:center}
        .qr svg{width:200px;height:200px}
      </style></head><body>
      <h1>${String(title).replace(/</g, '')}</h1>
      <p>Σκανάρετε για κράτηση οχήματος και εγκατάσταση στην αρχική οθόνη.</p>
      <div class="qr">${qrHtml}</div>
      <p class="url">${String(rentUrl).replace(/</g, '')}</p>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="sm:col-span-2 lg:col-span-4 relative overflow-hidden rounded-[26px] border border-black/[0.06] bg-white/80 backdrop-blur-xl px-4 py-4 text-sm text-[#1d1d1f] shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-teal-400/15 blur-2xl"
        aria-hidden
      />
      <div className="relative flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-[#0b3d4a] text-white shadow-lg shadow-teal-700/20 flex items-center justify-center shrink-0">
            <span
              className="material-symbols-outlined text-[22px]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              smartphone
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-bold tracking-tight">
              Rent Wallet · /rent/wallet
              {officeName ? (
                <span className="ml-1.5 font-semibold text-[#6e6e73]">· {officeName}</span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[#6e6e73] text-[13px] leading-snug">
              Πράσινο My Wallet ενοικίασης — χωριστά από το μπλε /wallet λεωφορείων. Σκανάρετε για
              σύνδεση, κρατήσεις και εγκατάσταση.
            </p>
            <div className="mt-2 rounded-xl bg-[#f5f5f7] border border-black/[0.04] px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6e6e73]">
                Σύνδεσμος Rent Wallet
              </p>
              <code className="text-[11px] break-all text-[#1d1d1f] leading-snug">
                {loading ? 'Φόρτωση γραφείου…' : rentUrl || '—'}
              </code>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a
                href={rentUrl || '/rent/wallet'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#0b3d4a] text-white text-xs font-bold shadow-md shadow-teal-900/20"
              >
                Άνοιγμα /rent/wallet
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </a>
              <button
                type="button"
                onClick={copyLink}
                disabled={!rentUrl || loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-black/[0.08] text-[#1d1d1f] text-xs font-bold disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                Αντιγραφή
              </button>
              <button
                type="button"
                onClick={printSheet}
                disabled={!rentUrl || loading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-black/[0.08] text-[#1d1d1f] text-xs font-bold disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">print</span>
                Εκτύπωση QR
              </button>
            </div>
          </div>
        </div>

        <div
          ref={qrRef}
          className="shrink-0 self-center sm:self-auto rounded-[18px] bg-white border border-black/[0.06] p-3 shadow-sm min-h-[148px] min-w-[148px] flex items-center justify-center"
          aria-label="QR εφαρμογής ενοικίασης"
        >
          {loading || !rentUrl ? (
            <span className="text-xs font-semibold text-[#6e6e73]">Φόρτωση…</span>
          ) : (
            <QRCode value={rentUrl} size={124} bgColor="#ffffff" fgColor="#0b3d4a" />
          )}
        </div>
      </div>
    </div>
  );
}
