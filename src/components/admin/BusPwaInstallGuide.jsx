import { useMemo } from 'react';
import { QRCode } from 'react-qr-code';
import toast from 'react-hot-toast';
import { getDriverPwaStartUrl } from '../../lib/driver/driverPwaUrl.js';

/**
 * Οδηγίες για το κινητό του λεωφορείου — εγκατάσταση PWA στο /driver.
 */
export default function BusPwaInstallGuide() {
  const driverUrl = useMemo(() => getDriverPwaStartUrl('gps'), []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(driverUrl);
      toast.success('Ο σύνδεσμος αντιγράφηκε');
    } catch {
      toast.error('Αποτυχία αντιγραφής');
    }
  };

  const printSheet = () => {
    const w = window.open('', '_blank', 'width=720,height=900');
    if (!w) {
      toast.error('Επιτρέψτε pop-up για εκτύπωση');
      return;
    }
    w.document.write(`
      <!DOCTYPE html><html lang="el"><head><meta charset="utf-8"/>
      <title>Οδηγός PWA — κινητό λεωφορείου</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 32px; max-width: 640px; margin: 0 auto; color: #1d1d1f; }
        h1 { font-size: 1.35rem; letter-spacing: -0.02em; }
        h2 { font-size: 1rem; margin-top: 1.5rem; letter-spacing: -0.01em; }
        ol { line-height: 1.65; color: #424245; }
        .url { font-family: ui-monospace, monospace; font-size: 12px; word-break: break-all; background: #f5f5f7; padding: 12px; border-radius: 12px; }
        .note { font-size: 13px; color: #86868b; margin-top: 20px; }
      </style></head><body>
      <h1>PoreiaGo Driver</h1>
      <p>Ανοίξτε μόνο την εφαρμογή οδηγού (όχι BackOffice):</p>
      <p class="url">${driverUrl}</p>
      <h2>Android</h2>
      <ol>
        <li>Ανοίξτε τον σύνδεσμο στο Chrome.</li>
        <li>Μενού → Προσθήκη στην αρχική οθόνη.</li>
      </ol>
      <h2>iPhone</h2>
      <ol>
        <li>Ανοίξτε τον σύνδεσμο στο Safari.</li>
        <li>Κοινοποίηση → Προσθήκη στην Αρχική.</li>
      </ol>
      <p class="note">Κατά τη βάρδια κρατήστε την εφαρμογή ανοιχτή για GPS.</p>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="h-full rounded-[22px] bg-white/80 backdrop-blur-xl border border-black/[0.06] shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.04)] p-6 sm:p-7 flex flex-col gap-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
          Εγκατάσταση
        </p>
        <h3 className="mt-1 text-[19px] font-semibold tracking-tight text-zinc-900">
          Κινητό λεωφορείου
        </h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-zinc-500 tracking-tight">
          Σκανάρετε το QR στο τηλέφωνο του λεωφορείου. Ανοίγει μόνο το{' '}
          <span className="font-medium text-zinc-700">/driver</span>.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start flex-1">
        <div className="rounded-[18px] bg-zinc-50 p-4 border border-zinc-100 shrink-0">
          <QRCode value={driverUrl} size={132} bgColor="transparent" />
        </div>
        <div className="flex-1 w-full min-w-0 space-y-3">
          <div className="rounded-[14px] bg-zinc-50 px-3.5 py-3 border border-zinc-100">
            <p className="text-[11px] font-medium text-zinc-400 mb-1">Σύνδεσμος</p>
            <code className="text-[12px] break-all text-zinc-700 leading-snug">{driverUrl}</code>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2.5 rounded-[12px] bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              Αντιγραφή
            </button>
            <button
              type="button"
              onClick={printSheet}
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold px-4 py-2.5 rounded-[12px] bg-zinc-100 text-zinc-800 hover:bg-zinc-200/80 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              Εκτύπωση
            </button>
          </div>
          <details className="group text-[13px] text-zinc-500">
            <summary className="cursor-pointer font-medium text-zinc-600 hover:text-zinc-900 list-none flex items-center gap-1">
              Οδηγίες εγκατάστασης
              <span className="material-symbols-outlined text-[16px] group-open:rotate-180 transition-transform">
                expand_more
              </span>
            </summary>
            <ul className="mt-2 space-y-1.5 pl-0.5">
              <li>
                <span className="font-medium text-zinc-700">Android:</span> Chrome → Προσθήκη στην
                αρχική
              </li>
              <li>
                <span className="font-medium text-zinc-700">iPhone:</span> Safari → Κοινοποίηση →
                Προσθήκη στην Αρχική
              </li>
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
