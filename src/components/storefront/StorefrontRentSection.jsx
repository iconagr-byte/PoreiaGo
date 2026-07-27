import { Link } from 'react-router-dom';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

/**
 * Homepage Rent block for office storefronts that have rent_enabled.
 * Full booking lives on /rent — this is the discovery CTA on `/`.
 */
export default function StorefrontRentSection({
  vehicles = [],
  loading = false,
  rentOnly = false,
  brandName = '',
}) {
  const title = rentOnly
    ? 'Ενοικιάσεις οχημάτων'
    : 'Ενοικίαση αυτοκινήτου';
  const subtitle = rentOnly
    ? `${brandName || 'Κλείστε'} online — στόλος, ημερομηνίες και παραλαβή σε λίγα βήματα.`
    : 'Διαθέσιμος στόλος για ημερήσια ή πολυήμερη ενοικίαση, δίπλα στις εκδρομές μας.';

  const preview = (vehicles || []).slice(0, 6);

  return (
    <section id="rent" className="py-20 md:py-24 bg-surface-bright border-y border-black/[0.05]">
      <div className="max-w-container-max mx-auto px-margin-desktop">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700 mb-3">
              Rent
            </p>
            <h2 className="font-headline-lg font-bold text-on-surface mb-3">{title}</h2>
            <p className="font-body-lg text-on-surface-variant leading-relaxed">{subtitle}</p>
          </div>
          <Link
            to="/rent"
            className="inline-flex items-center justify-center gap-2 self-start md:self-auto px-6 py-3.5 rounded-full bg-teal-700 text-white font-bold hover:bg-teal-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              directions_car
            </span>
            Δες στόλο & κράτηση
          </Link>
        </div>

        {loading ? (
          <p className="text-sm text-on-surface-variant">Φόρτωση στόλου ενοικίασης…</p>
        ) : preview.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            Ο στόλος ενοικίασης θα εμφανιστεί εδώ μόλις προστεθούν οχήματα.
          </p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0">
            {preview.map((v) => {
              const photo =
                resolveSiteAssetUrl(v.primary_photo_url || v.photo_url || v.image_url) || '';
              const name = v.display_name || v.name || v.model || 'Όχημα';
              const price = v.daily_rate_eur ?? v.price_per_day ?? v.daily_price;
              return (
                <li key={v.id || name}>
                  <Link
                    to="/rent"
                    className="group block overflow-hidden rounded-3xl border border-black/[0.06] bg-surface-container-lowest hover:-translate-y-0.5 transition-transform"
                  >
                    <div
                      className="aspect-[16/10] bg-slate-200 bg-cover bg-center"
                      style={photo ? { backgroundImage: `url('${photo}')` } : undefined}
                    />
                    <div className="p-5">
                      <h3 className="font-headline-sm font-bold text-on-surface group-hover:text-teal-800 transition-colors">
                        {name}
                      </h3>
                      {v.category ? (
                        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                          {v.category}
                        </p>
                      ) : null}
                      {price != null && price !== '' ? (
                        <p className="mt-3 text-sm font-bold text-teal-800">
                          από €{Number(price).toFixed(0)}
                          <span className="font-medium text-on-surface-variant"> / ημέρα</span>
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
