const KPI_TONES = {
  emerald: 'dash-apple-kpi--emerald',
  sky: 'dash-apple-kpi--sky',
  violet: 'dash-apple-kpi--slate',
  slate: 'dash-apple-kpi--slate',
  amber: 'dash-apple-kpi--amber',
};

/**
 * Minimal Apple-style KPI tile for the admin dashboard overview.
 */
export default function DashboardKpiCard({ label, value, icon, tone = 'sky' }) {
  const toneClass = KPI_TONES[tone] || KPI_TONES.sky;

  return (
    <article className={`dash-apple-kpi ${toneClass}`}>
      <div className="dash-apple-kpi__top">
        <p className="dash-apple-kpi__label">{label}</p>
        {icon ? (
          <span className="dash-apple-kpi__icon" aria-hidden>
            <span className="material-symbols-outlined">{icon}</span>
          </span>
        ) : null}
      </div>
      <p className="dash-apple-kpi__value">{value}</p>
    </article>
  );
}
