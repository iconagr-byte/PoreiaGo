import { useMemo } from 'react';
import QRCode from 'react-qr-code';
import toast from 'react-hot-toast';
import { getDriverPwaStartUrl } from '../../lib/driver/driverPwaUrl.js';

/**
 * Οδηγίες για το κινητό του λεωφορείου — εγκατάσταση PWA στο /driver (όχι /admin).
 */
export default function BusPwaInstallGuide() {
  const driverUrl = useMemo(() => getDriverPwaStartUrl('gps'), []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(driverUrl);
      toast.success('Ο σύνδεσμος PWA αντιγράφηκε');
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
        body { font-family: system-ui, sans-serif; padding: 24px; max-width: 640px; margin: 0 auto; }
        h1 { font-size: 1.25rem; }
        ol { line-height: 1.6; }
        .url { font-family: monospace; font-size: 12px; word-break: break-all; background: #f3f4f6; padding: 8px; border-radius: 8px; }
        .note { font-size: 13px; color: #b45309; margin-top: 16px; }
      </style></head><body>
      <h1>PoreiaGo Driver — κινητό λεωφορείου</h1>
      <p><strong>ΜΗΝ</strong> ανοίξετε το BackOffice (/admin). Μόνο η εφαρμογή οδηγού:</p>
      <p class="url">${driverUrl}</p>
      <h2>Android (Chrome)</h2>
      <ol>
        <li>Ανοίξτε τον σύνδεσμο παραπάνω στο κινητό του λεωφορείου.</li>
        <li>Μενού ⋮ → <strong>Προσθήκη στην αρχική οθόνη</strong> / Install app.</li>
        <li>Εικονίδιο «GPS Οδηγού» στην αρχική — ανοίγτε πάντα από εκεί.</li>
      </ol>
      <h2>iPhone (Safari)</h2>
      <ol>
        <li>Ανοίξτε τον σύνδεσμο στο Safari (όχι in-app browser).</li>
        <li>Κουμπί <strong>Κοινοποίηση</strong> → <strong>Προσθήκη στην Αρχική</strong>.</li>
        <li>Κατά τη βάρδια κρατήστε την εφαρμογή σε πρώτο πλάνο για GPS.</li>
      </ol>
      <h2>Κάθε βάρδια</h2>
      <ol>
        <li>Ανοίξτε το PWA από την αρχική.</li>
        <li>Σκανάρστε το Master QR στο ταμπλό (ή magic link).</li>
        <li>Ολοκληρώστε Pre-Trip → ξεκινήστε GPS / scan.</li>
      </ol>
      <p class="note">Το γραφείο εκδίδει QR από BackOffice. Ο οδηγός δεν χρειάζεται login admin.</p>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-5 sm:p-6 space-y-4">
      <div className="flex items-start gap-3">
        <span className="material-symbols-outlined text-indigo-600 text-[28px]">phone_android</span>
        <div>
          <h4 className="font-bold text-gray-900">Κινητό λεωφορείου — εγκατάσταση PWA</h4>
          <p className="text-sm text-gray-600 mt-1">
            Στείλτε ή σκανάρστε αυτό το QR στο <strong>κινητό του λεωφορείου</strong>. Ανοίγει{' '}
            <code className="text-xs bg-white px-1 rounded">/driver</code> — όχι BackOffice.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
        <div className="bg-white p-4 rounded-xl border-2 border-dashed border-indigo-200 shrink-0">
          <QRCode value={driverUrl} size={140} />
        </div>
        <div className="flex-1 space-y-3 text-sm w-full min-w-0">
          <div className="rounded-xl bg-white border border-gray-100 px-3 py-2">
            <p className="text-[10px] font-bold uppercase text-gray-400 mb-1">Σύνδεσμος PWA</p>
            <code className="text-xs break-all text-indigo-800">{driverUrl}</code>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <span className="material-symbols-outlined text-[16px]">content_copy</span>
              Αντιγραφή link
            </button>
            <button
              type="button"
              onClick={printSheet}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full border border-indigo-200 text-indigo-800 hover:bg-indigo-50"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              Εκτύπωση οδηγιών
            </button>
          </div>
          <ul className="text-xs text-gray-600 space-y-1.5 list-disc list-inside">
            <li>
              <strong>Android:</strong> Chrome → Προσθήκη στην αρχική / Install app
            </li>
            <li>
              <strong>iPhone:</strong> Safari → Κοινοποίηση → Προσθήκη στην Αρχική
            </li>
            <li>Κάθε πρωί: άνοιγμα PWA → σάρωση Master QR στο ταμπλό</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
