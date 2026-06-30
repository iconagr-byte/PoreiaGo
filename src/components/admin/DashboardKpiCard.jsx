const KPI_TONES = {
  emerald: {
    card: 'from-emerald-50/90 to-white border-emerald-100/90 hover:border-emerald-200',
    icon: 'bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 shadow-sm shadow-emerald-100/50',
    value: 'text-emerald-800',
  },
  sky: {
    card: 'from-sky-50/90 to-white border-sky-100/90 hover:border-sky-200',
    icon: 'bg-gradient-to-br from-sky-100 to-sky-50 text-sky-600 shadow-sm shadow-sky-100/50',
    value: 'text-sky-800',
  },
  violet: {
    card: 'from-violet-50/90 to-white border-violet-100/90 hover:border-violet-200',
    icon: 'bg-gradient-to-br from-violet-100 to-violet-50 text-violet-600 shadow-sm shadow-violet-100/50',
    value: 'text-violet-800',
  },
  amber: {
    card: 'from-amber-50/90 to-white border-amber-100/90 hover:border-amber-200',
    icon: 'bg-gradient-to-br from-amber-100 to-amber-50 text-amber-700 shadow-sm shadow-amber-100/50',
    value: 'text-amber-900',
  },
};

export default function DashboardKpiCard({ label, value, icon, tone = 'sky' }) {
  const t = KPI_TONES[tone] || KPI_TONES.sky;

  return (
    <article
      className={`rounded-[28px] border bg-gradient-to-br p-6 md:p-7 shadow-sm hover:shadow-md transition-all duration-300 ${t.card}`}
    >
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-5 ${t.icon}`}>
        <span className="material-symbols-outlined text-[26px]" aria-hidden>
          {icon}
        </span>
      </div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl md:text-[1.75rem] font-bold tracking-tight tabular-nums ${t.value}`}>
        {value}
      </p>
    </article>
  );
}
