import { amenityIcon } from '../services/fleetPublicApi.js';

export default function FleetShowcaseSection({ vehicles, loading, hidden = false }) {
  if (hidden) return null;

  return (
    <section
      id="our-fleet"
      className="py-24 px-margin-desktop max-w-container-max mx-auto bg-surface-container-lowest border-y border-black/[0.04]"
    >
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <span className="text-primary font-semibold tracking-wider uppercase text-sm mb-3 block">
          Ο Στόλος Μας
        </span>
        <h2 className="font-headline-lg text-4xl md:text-5xl font-bold text-on-surface tracking-tight mb-4">
          Premium λεωφορεία & παροχές
        </h2>
        <p className="text-on-surface-variant font-body-md">
          Τα οχήματά μας συγχρονίζονται από το Control Panel — άνεση, ασφάλεια και σύγχρονες
          παροχές σε κάθε διαδρομή.
        </p>
      </div>

      {loading ? (
        <p className="text-center text-on-surface-variant py-12">Φόρτωση στόλου…</p>
      ) : vehicles.length === 0 ? (
        <p className="text-center text-on-surface-variant py-12">
          Δεν υπάρχουν διαθέσιμα οχήματα προς εμφάνιση.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {vehicles.map((bus) => (
            <article
              key={bus.id}
              className="relative group bg-gradient-to-b from-white to-[#f8f9fa] rounded-[32px] border border-black/[0.04] shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgb(0,0,0,0.12)] transition-all duration-300 flex flex-col overflow-hidden"
            >
              <div className="relative h-52 w-full overflow-hidden shrink-0">
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent z-10" />
                <img
                  src={bus.image_url || '/images/hero-bus-achillio.png'}
                  alt={bus.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
                <span className="absolute top-4 left-4 z-20 px-3 py-1 rounded-full bg-white/95 text-xs font-bold text-primary shadow-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">directions_bus</span>
                  {bus.category}
                </span>
                <span className="absolute top-4 right-4 z-20 px-3 py-1 rounded-full bg-emerald-600/90 text-white text-xs font-bold shadow-sm">
                  {bus.status_label}
                </span>
                <div className="absolute bottom-4 left-6 right-6 z-20">
                  <h3 className="font-headline-md text-white font-bold drop-shadow-md">{bus.name}</h3>
                  <p className="text-sm text-white/85 mt-1">
                    {bus.year} · {bus.seat_count} θέσεις
                  </p>
                </div>
              </div>

              <div className="p-8 flex flex-col flex-1">
                {bus.summary && (
                  <p className="text-on-surface-variant font-body-md text-sm mb-6 line-clamp-3">
                    {bus.summary}
                  </p>
                )}
                <div className="mt-auto">
                  <p className="text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold mb-3">
                    Παροχές
                  </p>
                  <ul className="flex flex-wrap gap-2">
                    {(bus.amenities || []).map((item) => (
                      <li
                        key={`${bus.id}-${item}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-black/[0.06] text-xs font-medium text-on-surface shadow-sm"
                      >
                        <span className="material-symbols-outlined text-[16px] text-primary">
                          {amenityIcon(item)}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
