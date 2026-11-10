export default function HybridChangeLogPanel({ formData }) {
  const log = formData.hybridChangeLog || [];
  if (!log.length) {
    return (
      <p className="text-sm text-slate-500 italic py-4 text-center border border-dashed border-slate-200 rounded-xl">
        Δεν υπάρχουν ακόμα αλλαγές hybrid. Θα καταγράφονται με κάθε αποθήκευση.
      </p>
    );
  }
  return (
    <ul className="space-y-2 max-h-56 overflow-y-auto">
      {log.slice(0, 20).map((entry) => (
        <li key={entry.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-sm font-semibold text-slate-800">{entry.summary}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {entry.actor || 'office'} ·{' '}
            {entry.at
              ? new Date(entry.at).toLocaleString('el-GR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </p>
        </li>
      ))}
    </ul>
  );
}
