import { useRef } from 'react';
import { emptyPassengerSeat } from '../../../lib/hybrid/hybridDefaults.js';
import { parsePnrCsv, PNR_CSV_TEMPLATE } from '../../../lib/hybrid/pnrImport.js';
import { exportHybridManifestCsv, exportTripManifestPdf } from '../../../lib/manifest/exportManifestPdf.js';
import toast from 'react-hot-toast';

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400';

export default function HybridPassengerManifest({ formData, setFormData }) {
  const fileRef = useRef(null);
  const seats = formData.passengerFlightSeats || [];
  const flights = formData.flights || [];

  const patchSeats = (next) => setFormData((prev) => ({ ...prev, passengerFlightSeats: next }));

  const addRow = () => {
    patchSeats([
      ...seats,
      emptyPassengerSeat({
        flight_id: flights[0]?.id || '',
        pnr_code: flights[0]?.pnr_code || '',
      }),
    ]);
  };

  const updateRow = (id, partial) => {
    patchSeats(seats.map((r) => (r.id === id ? { ...r, ...partial } : r)));
  };

  const removeRow = (id) => patchSeats(seats.filter((r) => r.id !== id));

  const handleExportPdf = () => {
    try {
      exportTripManifestPdf({
        tripTitle: formData.title || 'Hybrid trip',
        date: formData.departureTime || '',
        bookings: seats.map((s) => ({
          customerName: s.passenger_name,
          seat: s.ground_seat,
          flightSeat: s.flight_seat,
          pnr: s.pnr_code || s.ticket_code,
          ticketCode: s.ticket_code,
          price: formData.price,
          currency: formData.currency || 'EUR',
        })),
        flights,
        currency: formData.currency || 'EUR',
        companyName: 'PoreiaGo Travel',
      });
      toast.success('Άνοιγμα εκτύπωσης hybrid manifest…');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία PDF');
    }
  };

  const handleExportCsv = () => {
    try {
      exportHybridManifestCsv({
        tripTitle: formData.title || 'Hybrid trip',
        seats,
        flights,
      });
      toast.success('Κατέβηκε Excel/CSV manifest');
    } catch (err) {
      toast.error(err.message || 'Αποτυχία CSV');
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([PNR_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'group-pnr-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const { rows, errors } = parsePnrCsv(text, {
        flights,
        defaultFlightId: flights[0]?.id || '',
      });
      if (!rows.length) {
        toast.error(errors[0] || 'Καμία έγκυρη γραμμή');
        return;
      }
      patchSeats([...seats, ...rows]);
      toast.success(`Εισήχθησαν ${rows.length} επιβάτες από PNR CSV`);
      if (errors.length) toast(`${errors.length} γραμμές παραλείφθηκαν`);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία import');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold"
        >
          <span className="material-symbols-outlined text-[16px]">person_add</span>
          Επιβάτης
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-[16px]">upload_file</span>
          Import PNR CSV
        </button>
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Template
        </button>
        <button
          type="button"
          onClick={handleExportPdf}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-[16px]">picture_as_pdf</span>
          PDF
        </button>
        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <span className="material-symbols-outlined text-[16px]">table_view</span>
          Excel / CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleImportFile}
        />
      </div>

      {seats.length === 0 ? (
        <p className="text-sm text-slate-500 italic py-6 text-center border border-dashed border-slate-200 rounded-xl">
          Προσθέστε επιβάτες ή κάντε import group PNR CSV για χαρτογράφηση θέσης λεωφορείου και πτήσης.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 font-bold">Επιβάτης</th>
                <th className="px-3 py-2 font-bold">Θέση λεωφ.</th>
                <th className="px-3 py-2 font-bold">Πτήση</th>
                <th className="px-3 py-2 font-bold">Θέση αέρα</th>
                <th className="px-3 py-2 font-bold">PNR / Ticket</th>
                <th className="px-3 py-2 font-bold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {seats.map((row) => (
                <tr key={row.id}>
                  <td className="px-2 py-2">
                    <input
                      className={fieldClass}
                      value={row.passenger_name || ''}
                      onChange={(e) => updateRow(row.id, { passenger_name: e.target.value })}
                      placeholder="Ονοματεπώνυμο"
                    />
                  </td>
                  <td className="px-2 py-2 w-24">
                    <input
                      className={fieldClass}
                      value={row.ground_seat || ''}
                      onChange={(e) => updateRow(row.id, { ground_seat: e.target.value })}
                      placeholder="12A"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <select
                      className={fieldClass}
                      value={row.flight_id || ''}
                      onChange={(e) => {
                        const fl = flights.find((f) => f.id === e.target.value);
                        updateRow(row.id, {
                          flight_id: e.target.value,
                          pnr_code: fl?.pnr_code || row.pnr_code,
                        });
                      }}
                    >
                      <option value="">—</option>
                      {flights.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.flight_number || f.id}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 w-24">
                    <input
                      className={fieldClass}
                      value={row.flight_seat || ''}
                      onChange={(e) => updateRow(row.id, { flight_seat: e.target.value })}
                      placeholder="14C"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <input
                        className={fieldClass}
                        value={row.pnr_code || ''}
                        onChange={(e) => updateRow(row.id, { pnr_code: e.target.value })}
                        placeholder="PNR"
                      />
                      <input
                        className={fieldClass}
                        value={row.ticket_code || ''}
                        onChange={(e) => updateRow(row.id, { ticket_code: e.target.value })}
                        placeholder="Ticket"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
