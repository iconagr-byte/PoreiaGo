import { useMapEvents } from 'react-leaflet';

export default function LocationPicker({ activeStopId, setFormData }) {
  useMapEvents({
    click(e) {
      if (!activeStopId) return;
      setFormData((prev) => ({
        ...prev,
        stops: prev.stops.map((s) =>
          s.id === activeStopId ? { ...s, lat: e.latlng.lat, lng: e.latlng.lng } : s,
        ),
      }));
    },
  });
  return null;
}
