import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MARKET_DOMESTIC } from '../../lib/trips/tripMarket.js';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/AdminLayout.jsx';
import MasterQrIssuedModal from '../../components/admin/MasterQrIssuedModal.jsx';
import TripForm from '../../components/admin/TripForm.jsx';
import {
  createEmptyTripForm,
  formDataToTrip,
  getTripById,
  tripToFormData,
  upsertTrip,
} from '../../lib/trips/tripStore.js';
import { issueMasterQr } from '../../services/platformApi.js';
import { syncTripsToPostgres } from '../../services/tripsSyncApi.js';

export default function TripEditorPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = tripId === 'new';
  const isEdit = Boolean(tripId && !isNew);

  const [formData, setFormData] = useState(createEmptyTripForm);
  const [activeStopId, setActiveStopId] = useState(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [issuedQr, setIssuedQr] = useState(null);
  const [savedTrip, setSavedTrip] = useState(null);

  useEffect(() => {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin') {
      navigate('/admin/login');
      return;
    }
    if (!tripId) {
      navigate('/admin', { state: { activeTab: 'routes' } });
      return;
    }
    if (isNew) {
      const defaultMarket = location.state?.market || MARKET_DOMESTIC;
      setFormData(createEmptyTripForm(defaultMarket));
      setActiveStopId(null);
      setReady(true);
      return;
    }
    const trip = getTripById(tripId);
    if (!trip) {
      toast.error('Η εκδρομή δεν βρέθηκε');
      navigate('/admin', { state: { activeTab: 'routes' } });
      return;
    }
    setFormData(tripToFormData(trip));
    setReady(true);
  }, [tripId, isNew, navigate, location.state?.market]);

  const goToRoutes = (trip) => {
    navigate('/admin', {
      state: { activeTab: 'routes', routesMarket: trip.market },
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const existingId = isEdit ? Number(tripId) : null;
    const trip = formDataToTrip(formData, existingId);
    upsertTrip(trip);

    if (isEdit) {
      toast.success('Η εκδρομή ενημερώθηκε');
      goToRoutes(trip);
      return;
    }

    setSaving(true);
    try {
      await syncTripsToPostgres([trip]);
      const qr = await issueMasterQr({
        tripId: trip.id,
        driverId: trip.driverId?.trim() || undefined,
      });
      setSavedTrip(trip);
      setIssuedQr(qr);
      toast.success('Η εκδρομή προστέθηκε — Master QR έτοιμο');
    } catch (err) {
      toast.success('Η εκδρομή προστέθηκε');
      toast.error(err.message || 'Αποτυχία έκδοσης Master QR');
      goToRoutes(trip);
    } finally {
      setSaving(false);
    }
  };

  const closeQrModal = () => {
    const trip = savedTrip;
    setIssuedQr(null);
    setSavedTrip(null);
    if (trip) goToRoutes(trip);
  };

  const handleCancel = () => {
    navigate('/admin', {
      state: {
        activeTab: 'routes',
        routesMarket: formData.market || location.state?.market,
      },
    });
  };

  const header = (
    <div className="flex items-center gap-4 w-full">
      <button
        type="button"
        onClick={handleCancel}
        className="w-10 h-10 rounded-full bg-surface-container-low flex items-center justify-center hover:bg-surface-container-high"
        aria-label="Επιστροφή"
      >
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <h1 className="font-headline-md font-bold flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">route</span>
        {isEdit ? 'Επεξεργασία Εκδρομής' : 'Δημιουργία Νέας Εκδρομής'}
      </h1>
    </div>
  );

  if (!ready) {
    return (
      <AdminLayout activeTab="routes" title={header}>
        <p className="text-on-surface-variant">Φόρτωση…</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout activeTab="routes" title={header}>
      <div className="max-w-5xl mx-auto pb-16">
        <div className="bg-surface-container-lowest rounded-[32px] border border-black/[0.05] shadow-sm p-6 md:p-10">
          <TripForm
            formData={formData}
            setFormData={setFormData}
            activeStopId={activeStopId}
            setActiveStopId={setActiveStopId}
            onSubmit={handleSave}
            onCancel={handleCancel}
            isEdit={isEdit}
            saving={saving}
          />
        </div>
      </div>

      <MasterQrIssuedModal
        open={Boolean(issuedQr)}
        issued={issuedQr}
        driverId={savedTrip?.driverId}
        tripTitle={savedTrip?.title}
        onClose={closeQrModal}
      />
    </AdminLayout>
  );
}
