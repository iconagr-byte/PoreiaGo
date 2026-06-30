import { useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { mockFleet } from '../data/mockData';
import AdminLayout from '../components/AdminLayout';

export default function FleetVehicleDetail() {
  const { vehicleId } = useParams();
  const navigate = useNavigate();
  const bus = mockFleet.find((f) => f.id === vehicleId);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin') {
      navigate('/admin/login');
    }
  }, [navigate]);

  if (!bus) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-on-surface-variant mb-4">Δεν βρέθηκε όχημα με ID {vehicleId}</p>
          <Link to="/admin" state={{ activeTab: 'fleet' }} className="text-primary font-bold">
            Επιστροφή στον Στόλο
          </Link>
        </div>
      </div>
    );
  }

  const kmUntilService = bus.nextServiceKm - bus.kilometers;
  const serviceProgress = Math.max(0, Math.min(100, (bus.kilometers / bus.nextServiceKm) * 100));

  const header = (
    <div className="flex items-center justify-between w-full gap-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/admin', { state: { activeTab: 'fleet' } })}
          className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-surface-container-high transition-colors"
          aria-label="Επιστροφή στον στόλο"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 className="font-headline-md font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">directions_bus</span>
          Προφίλ Οχήματος &amp; Service
        </h1>
      </div>
    </div>
  );

  return (
    <AdminLayout activeTab="fleet" title={header}>
      <div className="max-w-container-max mx-auto pb-16 space-y-8">
        <div className="bg-white rounded-[32px] border border-black/[0.05] shadow-sm p-8">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="w-28 h-28 rounded-2xl bg-surface-container-low text-primary flex items-center justify-center shadow-sm shrink-0">
              <span className="material-symbols-outlined text-[56px]">airport_shuttle</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-gray-900">{bus.name}</h2>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                    bus.status === 'Ενεργό'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {bus.status}
                </span>
              </div>
              <p className="text-sm font-mono text-gray-500 mb-6">
                {bus.licensePlate} · ID: {bus.id}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">Τύπος</div>
                  <div className="font-bold text-gray-900">{bus.type}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">Θέσεις</div>
                  <div className="font-bold text-gray-900">{bus.seats}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">Χιλιόμετρα</div>
                  <div className="font-bold text-gray-900">{bus.kilometers.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 uppercase mb-1">Έσοδα</div>
                  <div className="font-bold text-emerald-600">
                    €{bus.financials.revenue.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-surface-container-low rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-[20px]">shield</span>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Ασφάλεια</div>
                <div className="text-sm font-bold">{bus.insuranceExpiry}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-[20px]">badge</span>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Βασικός Οδηγός</div>
                <div className="text-sm font-bold">{bus.driver}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-[20px]">local_gas_station</span>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Κατανάλωση</div>
                <div className="text-sm font-bold">{bus.fuelConsumption}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-primary text-[20px]">settings</span>
              <div>
                <div className="text-xs text-gray-500 mb-0.5">Κινητήρας</div>
                <div className="text-sm font-bold">{bus.engineType}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[24px] border border-black/[0.05] shadow-sm">
          <div className="flex justify-between items-end mb-3 gap-4">
            <div>
              <div className="font-bold text-gray-900">Κατάσταση Συντήρησης</div>
              <div className="text-xs text-gray-500 mt-1">
                Επόμενο Service στα {bus.nextServiceKm.toLocaleString()} km
              </div>
            </div>
            <div className="font-bold text-primary text-sm shrink-0">
              {kmUntilService.toLocaleString()} km υπολείπονται
            </div>
          </div>
          <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                kmUntilService < 5000 ? 'bg-rose-500' : 'bg-primary'
              }`}
              style={{ width: `${serviceProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">Τελευταίο service: {bus.lastService}</p>
        </div>

        <section>
          <h2 className="font-headline-sm font-bold mb-6 flex items-center gap-2 text-gray-900">
            <span className="material-symbols-outlined text-gray-400">build</span>
            Ιστορικό Συντήρησης (Service Log)
          </h2>
          <div className="space-y-4">
            {bus.serviceHistory?.map((service) => (
              <div
                key={service.id}
                className="bg-white p-5 rounded-2xl border border-black/[0.05] shadow-sm"
              >
                <div className="flex justify-between items-start gap-4 mb-2">
                  <div className="font-bold text-gray-900">{service.type}</div>
                  <div className="text-xs font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-md shrink-0">
                    {service.date}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">{service.description}</p>
                <div className="text-sm font-bold text-rose-500">€{service.cost.toLocaleString()}</div>
              </div>
            ))}
            {!bus.serviceHistory?.length && (
              <p className="text-center text-gray-500 text-sm py-8 bg-white rounded-2xl border border-black/[0.05]">
                Δεν υπάρχει καταγεγραμμένο ιστορικό service.
              </p>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
