import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import { fetchFleetDrivers } from '../../services/platformApi.js';
import { fileToTripCoverDataUrl, TRIP_COVER_ACCEPT } from '../../lib/trips/tripImage.js';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import LocationPicker from './LocationPicker.jsx';
import {
  MARKET_DOMESTIC,
  MARKET_INTERNATIONAL,
  MARKET_LABELS,
} from '../../lib/trips/tripMarket.js';

const redIcon = L.divIcon({
  className: 'custom-red-pin',
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#ef4444" stroke="white" stroke-width="1.5" class="w-10 h-10 drop-shadow-lg" style="margin-top:-20px; margin-left:-8px;">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
      <circle cx="12" cy="10" r="3" fill="white"></circle>
    </svg>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});
L.Marker.prototype.options.icon = redIcon;

export default function TripForm({
  formData,
  setFormData,
  activeStopId,
  setActiveStopId,
  onSubmit,
  onCancel,
  isEdit,
  saving = false,
}) {
  const [drivers, setDrivers] = useState([]);
  const [coverUploading, setCoverUploading] = useState(false);

  useEffect(() => {
    fetchFleetDrivers().then(setDrivers);
  }, []);

  useEffect(() => {
    if (!drivers.length || formData.driverId) return;
    const byName = drivers.find((d) => d.name === formData.driverName);
    const byPlate =
      formData.vehiclePlate &&
      drivers.find((d) => d.license_plate === formData.vehiclePlate);
    const match = byName || byPlate;
    if (match) {
      setFormData((prev) => ({ ...prev, driverId: match.id }));
    }
  }, [drivers, formData.driverId, formData.driverName, formData.vehiclePlate, setFormData]);

  const assignableDrivers = drivers.filter((d) =>
    ['active', 'on_leave'].includes(d.status),
  );

  const handleDriverChange = (driverId) => {
    if (!driverId) {
      setFormData((prev) => ({
        ...prev,
        driverId: '',
        driverName: '',
        vehiclePlate: '',
        vehicleCode: '',
      }));
      return;
    }
    const driver = drivers.find((d) => d.id === driverId);
    if (!driver) return;
    setFormData((prev) => ({
      ...prev,
      driverId: driver.id,
      driverName: driver.name,
      vehiclePlate: driver.license_plate || prev.vehiclePlate || '',
      vehicleCode: driver.vehicle_code || prev.vehicleCode || '',
    }));
  };

  const handleAddStop = () => {
    const newId = Date.now();
    setFormData({
      ...formData,
      stops: [
        ...formData.stops,
        {
          id: newId,
          name: '',
          lat: 38.0,
          lng: 23.0,
          time: '12:00',
          image: null,
          description: '',
        },
      ],
    });
    setActiveStopId(newId);
  };

  const handleRemoveStop = (id) => {
    setFormData({
      ...formData,
      stops: formData.stops.filter((s) => s.id !== id),
    });
    if (activeStopId === id) setActiveStopId(null);
  };

  const handleUpdateStop = (id, field, value) => {
    setFormData({
      ...formData,
      stops: formData.stops.map((s) =>
        s.id === id
          ? { ...s, [field]: field === 'lat' || field === 'lng' ? parseFloat(value) : value }
          : s,
      ),
    });
  };

  const handleImageUpload = (id, e) => {
    const file = e.target.files[0];
    if (file) {
      handleUpdateStop(id, 'image', URL.createObjectURL(file));
    }
  };

  const handleCoverImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      toast.error('Το αρχείο είναι πολύ μεγάλο (μέγ. 12MB)');
      return;
    }
    setCoverUploading(true);
    try {
      const dataUrl = await fileToTripCoverDataUrl(file);
      setFormData((prev) => ({ ...prev, image: dataUrl }));
      toast.success('Η φωτογραφία ενημερώθηκε');
    } catch (err) {
      toast.error(err.message?.includes('large') ? 'Η εικόνα είναι πολύ μεγάλη — δοκιμάστε μικρότερο αρχείο' : 'Αποτυχία ανεβάσματος εικόνας');
    } finally {
      setCoverUploading(false);
      e.target.value = '';
    }
  };

  const removeCoverImage = () => {
    setFormData((prev) => ({ ...prev, image: '' }));
  };

  const isInternational = formData.market === MARKET_INTERNATIONAL;

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block font-label-md text-on-surface-variant mb-2">Αγορά</label>
          <select
            value={formData.market || MARKET_DOMESTIC}
            onChange={(e) =>
              setFormData({
                ...formData,
                market: e.target.value,
                ...(e.target.value === MARKET_DOMESTIC ? { destination: '' } : {}),
              })
            }
            className="w-full bg-surface-container-low text-on-surface border border-surface-container rounded-xl p-3 focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value={MARKET_DOMESTIC}>{MARKET_LABELS[MARKET_DOMESTIC]}</option>
            <option value={MARKET_INTERNATIONAL}>{MARKET_LABELS[MARKET_INTERNATIONAL]}</option>
          </select>
        </div>
        {isInternational && (
          <div>
            <label className="block font-label-md text-on-surface-variant mb-2">Προορισμός</label>
            <input
              type="text"
              value={formData.destination || ''}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              className="w-full bg-surface-container-low text-on-surface border border-surface-container rounded-xl p-3 focus:ring-2 focus:ring-primary focus:outline-none"
              placeholder="π.χ. Παρίσι, Γαλλία"
            />
          </div>
        )}
        <div className="md:col-span-2">
          <label className="block font-label-md text-on-surface-variant mb-2">Όνομα Εκδρομής</label>
          <input
            required
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className="w-full bg-surface-container-low text-on-surface border border-surface-container rounded-xl p-3 focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="π.χ. Ημερήσια στα Μετέωρα"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block font-label-md text-on-surface-variant mb-2">Περιγραφή Εκδρομής</label>
          <textarea
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full bg-surface-container-low text-on-surface border border-surface-container rounded-xl p-3 focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="Περιγράψτε την εμπειρία..."
          />
        </div>
        <div className="md:col-span-2">
          <label className="block font-label-md text-on-surface-variant mb-2 flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">photo_camera</span>
            Φωτογραφία εκδρομής (αρχική οθόνη)
          </label>
          <p className="text-xs text-on-surface-variant mb-3">
            Εμφανίζεται στην κάρτα της αρχικής σελίδας. JPG ή PNG, συμπιέζεται αυτόματα.
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative w-full sm:w-56 h-36 rounded-2xl overflow-hidden bg-surface-container-low border border-dashed border-surface-container shrink-0">
              {formData.image ? (
                <img
                  src={formData.image}
                  alt="Προεπισκόπηση"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-on-surface-variant gap-1">
                  <span className="material-symbols-outlined text-[32px] opacity-40">image</span>
                  <span className="text-xs font-medium">Χωρίς εικόνα</span>
                </div>
              )}
              {coverUploading && (
                <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                  <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <label className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary text-white text-sm font-bold cursor-pointer hover:opacity-90 transition-opacity w-fit">
                <span className="material-symbols-outlined text-[20px]">upload</span>
                {formData.image ? 'Αλλαγή φωτογραφίας' : 'Ανέβασμα φωτογραφίας'}
                <input
                  type="file"
                  accept={TRIP_COVER_ACCEPT}
                  className="hidden"
                  disabled={coverUploading}
                  onChange={handleCoverImageUpload}
                />
              </label>
              {formData.image && (
                <button
                  type="button"
                  onClick={removeCoverImage}
                  className="text-sm font-bold text-rose-600 hover:text-rose-800 w-fit"
                >
                  Αφαίρεση εικόνας
                </button>
              )}
            </div>
          </div>
          <label className="block font-label-md text-on-surface-variant mb-2 mt-4">
            Κείμενο στην κάρτα (προαιρετικό)
          </label>
          <input
            type="text"
            value={formData.hook || ''}
            onChange={(e) => setFormData({ ...formData, hook: e.target.value })}
            className="w-full bg-surface-container-low text-on-surface border border-surface-container rounded-xl p-3 focus:ring-2 focus:ring-primary focus:outline-none"
            placeholder="π.χ. Ανακαλύψτε τη μαγεία των βράχων"
          />
        </div>
        <div>
          <label className="block font-label-md text-on-surface-variant mb-2">Ημ/νία & Ώρα Αναχώρησης</label>
          <input
            required
            type="datetime-local"
            value={formData.departureTime}
            onChange={(e) => setFormData({ ...formData, departureTime: e.target.value })}
            className="w-full bg-surface-container-low text-on-surface border border-surface-container rounded-xl p-3 focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block font-label-md text-on-surface-variant mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px] text-primary">badge</span>
              Οδηγός
            </span>
            <Link
              to="/admin"
              state={{ activeTab: 'drivers' }}
              className="text-xs text-primary font-bold hover:underline"
            >
              Διαχείριση οδηγών
            </Link>
          </label>
          <select
            value={formData.driverId || ''}
            onChange={(e) => handleDriverChange(e.target.value)}
            className="w-full bg-surface-container-low text-on-surface border border-surface-container rounded-xl p-3 focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="">— Επιλέξτε οδηγό —</option>
            {assignableDrivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.license_plate ? ` · ${d.license_plate}` : ''}
                {d.status === 'on_leave' ? ' (άδεια)' : ''}
              </option>
            ))}
          </select>
          {formData.driverName && (
            <p className="text-xs text-on-surface-variant mt-1.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              Ανατεθειμένος: <span className="font-bold text-on-surface">{formData.driverName}</span>
              {formData.vehiclePlate && (
                <span className="font-mono text-gray-500"> · {formData.vehiclePlate}</span>
              )}
            </p>
          )}
        </div>
        <div>
          <label className="block font-label-md text-on-surface-variant mb-2">Τύπος Οχήματος</label>
          <select
            value={formData.vehicleType}
            onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
            className="w-full bg-surface-container-low text-on-surface border border-surface-container rounded-xl p-3 focus:ring-2 focus:ring-primary focus:outline-none"
          >
            <option value="Luxury Coach">Luxury Coach (50 Θέσεις)</option>
            <option value="Premium Express">Premium Express (30 Θέσεις)</option>
            <option value="VIP Minibus">VIP Minibus (15 Θέσεις)</option>
          </select>
        </div>
        <div>
          <label className="block font-label-md text-on-surface-variant mb-2">Πινακίδα οχήματος</label>
          <input
            type="text"
            value={formData.vehiclePlate || ''}
            onChange={(e) => setFormData({ ...formData, vehiclePlate: e.target.value })}
            className="w-full bg-surface-container-low text-on-surface border border-surface-container rounded-xl p-3 focus:ring-2 focus:ring-primary focus:outline-none font-mono"
            placeholder="π.χ. XAH-4021"
          />
        </div>
        <div>
          <label className="block font-label-md text-on-surface-variant mb-2">Τιμή Εισιτηρίου (€)</label>
          <input
            required
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
            className="w-full bg-surface-container-low text-on-surface border border-surface-container rounded-xl p-3 focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block font-label-md text-on-surface-variant mb-2">Διαθέσιμες Θέσεις</label>
          <input
            required
            type="number"
            min="0"
            value={formData.availableSeats}
            onChange={(e) => setFormData({ ...formData, availableSeats: e.target.value })}
            className="w-full bg-surface-container-low text-on-surface border border-surface-container rounded-xl p-3 focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-headline-sm text-on-surface">Διαδρομή & Στάσεις</h4>
            <button
              type="button"
              onClick={handleAddStop}
              className="px-4 py-2 bg-secondary-container text-on-secondary-container rounded-full text-sm font-semibold flex items-center gap-1 hover:bg-primary-container transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">add_location_alt</span>
              Νέα
            </button>
          </div>
          {formData.stops.length === 0 ? (
            <p className="text-sm text-on-surface-variant italic">Δεν έχουν προστεθεί ενδιάμεσες στάσεις.</p>
          ) : (
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {formData.stops.map((stop, index) => (
                <div
                  key={stop.id}
                  onClick={() => setActiveStopId(stop.id)}
                  className={`flex flex-col gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    activeStopId === stop.id
                      ? 'bg-primary/5 border-primary'
                      : 'bg-surface-variant border-transparent hover:border-black/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        activeStopId === stop.id ? 'bg-primary text-white' : 'bg-surface-container-high'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      required
                      value={stop.name}
                      onChange={(e) => handleUpdateStop(stop.id, 'name', e.target.value)}
                      className="flex-1 bg-surface text-sm rounded-lg p-2 focus:ring-2 focus:ring-primary"
                      placeholder="Όνομα Στάσης"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <input
                      type="time"
                      required
                      value={stop.time}
                      onChange={(e) => handleUpdateStop(stop.id, 'time', e.target.value)}
                      className="w-24 bg-surface text-sm rounded-lg p-2 focus:ring-2 focus:ring-primary"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveStop(stop.id);
                      }}
                      className="text-error hover:bg-error/10 p-2 rounded-lg"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                  {activeStopId === stop.id && (
                    <p className="text-xs text-primary font-medium italic">
                      Κάντε κλικ στον χάρτη για να ορίσετε την τοποθεσία.
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="h-[400px] bg-surface-variant rounded-2xl overflow-hidden border border-surface-container">
          <MapContainer center={[38.5, 23.0]} zoom={6} className="h-full w-full">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />
            <LocationPicker activeStopId={activeStopId} setFormData={setFormData} />
            {formData.stops.map((stop) => (
              <Marker key={stop.id} position={[stop.lat, stop.lng]} />
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="flex justify-end gap-4 pt-6 border-t border-surface-container">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 bg-surface-container-low text-on-surface rounded-full font-label-md hover:bg-surface-container"
        >
          Ακύρωση
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-8 py-3 bg-primary text-white rounded-full font-label-md hover:scale-105 transition-transform shadow-md flex items-center gap-2 disabled:opacity-60 disabled:hover:scale-100"
        >
          <span className="material-symbols-outlined text-[18px]">
            {saving ? 'hourglass_empty' : 'save'}
          </span>
          {saving ? 'Αποθήκευση…' : isEdit ? 'Αποθήκευση Αλλαγών' : 'Προσθήκη Εκδρομής'}
        </button>
      </div>
    </form>
  );
}
