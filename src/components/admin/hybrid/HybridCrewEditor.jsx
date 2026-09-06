import { emptyCrew } from '../../../lib/hybrid/changeLog.js';

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-slate-400';

export default function HybridCrewEditor({ formData, setFormData }) {
  const crew = formData.crew || emptyCrew();
  const patchCrew = (partial) =>
    setFormData((prev) => ({ ...prev, crew: { ...(prev.crew || emptyCrew()), ...partial } }));

  return (
    <div className="grid sm:grid-cols-3 gap-3">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
          Tour leader
        </span>
        <input
          className={fieldClass}
          value={crew.tourLeader || ''}
          onChange={(e) => patchCrew({ tourLeader: e.target.value })}
          placeholder="π.χ. Μαρία"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
          Οδηγός
        </span>
        <input
          className={fieldClass}
          value={crew.driverName || ''}
          onChange={(e) => patchCrew({ driverName: e.target.value })}
          placeholder="Όνομα οδηγού"
        />
      </label>
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">
          Ξεναγός
        </span>
        <input
          className={fieldClass}
          value={crew.guideName || ''}
          onChange={(e) => patchCrew({ guideName: e.target.value })}
          placeholder="Όνομα ξεναγού"
        />
      </label>
    </div>
  );
}
