import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { listWhatsAppTemplates, renderWhatsAppTemplate } from '../../../lib/hybrid/whatsappTemplates.js';
import { suggestRebook } from '../../../lib/hybrid/slaRebook.js';
import { emptyFlight } from '../../../lib/hybrid/hybridDefaults.js';
import { buildPassengerCheckinUrl } from '../../../lib/hybrid/shareTokens.js';

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-slate-400';

export default function HybridRebookWhatsApp({ formData, setFormData, tripId }) {
  const templates = listWhatsAppTemplates();
  const [tplId, setTplId] = useState(templates[0]?.id);
  const flights = formData.flights || [];
  const flight = flights[0];

  const preview = useMemo(() => {
    const pickup = (formData.segments || []).find((s) => s.segment_type !== 'flight');
    return renderWhatsAppTemplate(tplId, {
      flight_number: flight?.flight_number || '—',
      delay_minutes: flight?.delay_minutes || 0,
      pickup_time: pickup?.starts_at || '—',
      trip_title: formData.title || 'Εκδρομή',
      layover_minutes: 60,
      checkin_url: buildPassengerCheckinUrl({ ...formData, id: tripId || formData.id }),
    });
  }, [tplId, flight, formData, tripId]);

  const applyRebook = () => {
    const suggestion = suggestRebook({ trip: formData, flightId: flight?.id });
    if (!suggestion) {
      toast.error('Δεν υπάρχει πτήση για πρόταση');
      return;
    }
    const alt = emptyFlight({
      airline: suggestion.airline,
      flight_number: suggestion.suggestedFlightNumber,
      departure_airport: suggestion.departure_airport,
      arrival_airport: suggestion.arrival_airport,
      departure_time: suggestion.departure_time,
      arrival_time: suggestion.arrival_time,
      currency: formData.currency || 'EUR',
      notes: suggestion.reason,
      status: 'suggested',
    });
    setFormData((prev) => ({
      ...prev,
      flights: [...(prev.flights || []), alt],
      rebookSuggestion: suggestion,
    }));
    toast.success(`Προτάθηκε εναλλακτική ${suggestion.suggestedFlightNumber}`);
  };

  const copyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(preview);
      toast.success('WhatsApp template αντιγράφηκε');
    } catch {
      toast(preview);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Auto rebook suggestion</p>
        <p className="text-sm text-slate-600">
          Προτείνει εναλλακτική πτήση όταν υπάρχει καθυστέρηση / κρίσιμη σύνδεση (heuristic).
        </p>
        <button type="button" onClick={applyRebook} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold">
          Πρόταση εναλλακτικής πτήσης
        </button>
        {formData.rebookSuggestion ? (
          <p className="text-xs text-slate-500">
            Τελευταία: {formData.rebookSuggestion.suggestedFlightNumber} · pickup +
            {formData.rebookSuggestion.pickup_shift_minutes}′ · {formData.rebookSuggestion.reason}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">WhatsApp templates</p>
        <select className={fieldClass} value={tplId} onChange={(e) => setTplId(e.target.value)}>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <textarea readOnly rows={3} className={`${fieldClass} font-mono text-xs`} value={preview} />
        <button type="button" onClick={copyWhatsApp} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold">
          Αντιγραφή μηνύματος
        </button>
      </div>
    </div>
  );
}
