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
        body { font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif; padding: 36px; max-width: 640px; margin: 0 auto; color: #1d1d1f; }
        h1 { font-size: 1.45rem; letter-spacing: -0.035em; margin: 0 0 8px; font-weight: 700; }
        p { color: #6e6e73; line-height: 1.55; letter-spacing: -0.01em; }
        .url { font-family: ui-monospace, monospace; font-size: 13px; word-break: break-all; background: #f5f5f7; padding: 14px; border-radius: 14px; color: #1d1d1f; }
        .qr { margin: 28px auto; width: 220px; height: 220px; display: flex; align-items: center; justify-content: center; background: #fff; border-radius: 18px; border: 1px solid rgba(0,0,0,0.06); }
        .qr svg { width: 180px; height: 180px; }
        .note { font-size: 13px; color: #86868b; margin-top: 24px; }
      </style></head><body>
      <h1>${title.replace(/</g, '')}</h1>
      <p>Σκανάρετε για να ανοίξετε το My Wallet και το εισιτήριό σας.</p>
      <div class="qr">${qrHtml}</div>
      <p class="url">${walletUrl.replace(/</g, '')}</p>
      <p class="note">Μετά τη σύνδεση εμφανίζεται το QR επιβίβασης.</p>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <section className="dash-apple-panel h-full">
      <div className="dash-apple-panel__head">
        <div>
          <h3 className="dash-apple-panel__title">My Wallet — QR</h3>
          <p className="dash-apple-panel__meta">
            {officeName ? `${officeName} · ` : ''}
            Σύνδεσμος εισιτηρίων λεωφορείου για πελάτες
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start flex-1 p-5 sm:p-6">
        <div
          ref={qrRef}
          className="rounded-[16px] bg-white p-3.5 border border-black/[0.06] shrink-0 min-h-[148px] min-w-[148px] flex items-center justify-center shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]"
        >
          {loading || !walletUrl ? (
            <span className="text-xs font-semibold text-[#86868b]">Φόρτωση…</span>
          ) : (
            <QRCode value={walletUrl} size={120} bgColor="transparent" />
          )}
        </div>
        <div className="flex-1 w-full min-w-0 space-y-3">
          <div className="rounded-[14px] bg-[#f5f5f7] px-3.5 py-3 border border-black/[0.04]">
            <p className="text-[11px] font-semibold text-[#86868b] mb-1 tracking-tight">Σύνδεσμος</p>
            <code className="text-[12px] break-all text-[#1d1d1f] leading-snug tracking-tight">
              {loading ? '…' : walletUrl || '—'}
            </code>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyLink} disabled={!walletUrl} className="dash-apple-btn dash-apple-btn--primary">
              <span className="material-symbols-outlined">content_copy</span>
              Αντιγραφή
            </button>
            <button type="button" onClick={openLink} disabled={!walletUrl} className="dash-apple-btn dash-apple-btn--accent">
              <span className="material-symbols-outlined">open_in_new</span>
              Άνοιγμα
            </button>
            <button type="button" onClick={printSheet} disabled={!walletUrl} className="dash-apple-btn dash-apple-btn--ghost">
              <span className="material-symbols-outlined">print</span>
              Εκτύπωση
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
