import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  fetchFleetDrivers,
  fetchFleetVehicles,
  updateFleetDriver,
} from '../../../services/platformApi.js';

export default function FleetAssignmentsPanel() {
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [d, v] = await Promise.all([fetchFleetDrivers(), fetchFleetVehicles()]);
      setDrivers(d);
      setVehicles(v);
    } catch (err) {
      toast.error(err.message || 'Αποτυχία φόρτωσης');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const assign = async (driver, vehicleId) => {
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    setSavingId(driver.id);
    try {
      await updateFleetDriver(driver.id, {
        vehicle_code: vehicle ? vehicle.id : null,
        license_plate: vehicle ? vehicle.plate_number : null,
      });
      toast.success(vehicle ? `Ανατέθηκε ${vehicle.plate_number}` : 'Αφαιρέθηκε η ανάθεση');
      await reload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Ανάθεση οδηγού ↔ όχημα</h2>
        <p className="text-sm text-gray-500 mt-1">
          Σύνδεσε κάθε οδηγό με πινακίδα / κωδικό οχήματος για GPS και dispatch.
        </p>
      </div>

      {loading && <p className="text-sm text-gray-500">Φόρτωση…</p>}

      <div className="bg-white rounded-[28px] border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100">
          <thead>
            <tr>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Οδηγός</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Τρέχουσα</th>
              <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase">Νέα ανάθεση</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {drivers.map((d) => (
              <tr key={d.id}>
                <td className="px-5 py-4">
                  <div className="font-bold text-gray-900">{d.name}</div>
                  <div className="text-xs text-gray-500">{d.phone || d.email || d.id}</div>
                </td>
                <td className="px-5 py-4 text-sm font-mono text-gray-600">
                  {d.license_plate || d.vehicle_code || '—'}
                </td>
                <td className="px-5 py-4">
                  <select
                    className="w-full max-w-xs rounded-xl border px-3 py-2 text-sm"
                    disabled={savingId === d.id}
                    value={
                      vehicles.find(
                        (v) =>
                          v.plate_number === d.license_plate ||
                          v.id === d.vehicle_code,
                      )?.id || ''
                    }
                    onChange={(e) => assign(d, e.target.value)}
                  >
                    <option value="">— Χωρίς όχημα —</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate_number} · {v.make} {v.model}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {!loading && drivers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-5 py-10 text-center text-sm text-gray-500">
                  Δεν υπάρχουν οδηγοί. Πρόσθεσε από το μενού Οδηγοί.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
