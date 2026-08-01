import { Link } from 'react-router-dom';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';
import { RENT_SERVICE_FEATURES, rentServiceCopy } from '../../lib/rental/rentServicesCatalog.js';
import { rentCategoryLabel, withDemoRentFleet } from '../../lib/rental/demoRentFleet.js';
import { enrichRentVehicle } from '../../lib/rental/rentFleetEnrichment.js';
import { countRentFleetByBody } from '../../lib/rental/rentVehicleCategories.js';
import {
  rentFleetCardWrapperClass,
  rentFleetGridClass,
} from '../../lib/homepage/homepageTemplates.js';

function RentVehicleCard({ vehicle, templateId, featured = false }) {
  const v = vehicle;
  const photo = resolveSiteAssetUrl(v.primary_photo_url || v.photo_url || v.image_url) || '';
  const name = v.display_name || v.name || v.model || 'Όχημα';
  const price = v.daily_rate_eur ?? v.price_per_day ?? v.daily_price;
  const seats = v.seating_capacity;
  const meta = [v.transmission, v.fuel, v.luggage].filter(Boolean).slice(0, 3);
  const category = rentCategoryLabel(v.category);
  const priceLabel =
    price != null && price !== '' ? (
      <>
        από €{Number(price).toFixed(0)}
        <span className="font-medium text-on-surface-variant"> / ημέρα</span>
      </>
    ) : null;

  if (templateId === 'rent_overlay') {
    return (
      <Link
        to="/rent"
        className={`group relative block overflow-hidden rounded-3xl min-h-[240px] ${
          featured ? 'min-h-[300px]' : ''
        }`}
      >
        <div
          className="absolute inset-0 bg-slate-300 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
          style={photo ? { backgroundImage: `url('${photo}')` } : undefined}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-200">{category}</p>
          <h3 className="mt-1 font-headline-sm font-bold">{name}</h3>
          {priceLabel ? <p className="mt-2 text-sm font-bold text-white">{priceLabel}</p> : null}
        </div>
      </Link>
    );
  }

  if (templateId === 'rent_compact' || templateId === 'rent_spec') {
    return (
      <Link
        to="/rent"
        className="group flex gap-4 overflow-hidden rounded-2xl border border-black/[0.06] bg-white p-3 hover:shadow-md transition-shadow"
      >
        <div
          className="w-28 sm:w-36 shrink-0 rounded-xl bg-slate-200 bg-cover bg-center aspect-[4/3]"
          style={photo ? { backgroundImage: `url('${photo}')` } : undefined}
        />
        <div className="min-w-0 flex-1 flex flex-col justify-center">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">{category}</p>
          <h3 className="mt-0.5 font-bold text-on-surface truncate group-hover:text-teal-800">{name}</h3>
          {templateId === 'rent_spec' && meta.length ? (
            <p className="mt-1 text-xs font-semibold text-on-surface-variant">{meta.join(' · ')}</p>
          ) : null}
          {seats != null ? (
            <p className="mt-1 text-xs text-on-surface-variant">{seats} θέσεις</p>
          ) : null}
          {priceLabel ? <p className="mt-2 text-sm font-bold text-teal-800">{priceLabel}</p> : null}
        </div>
      </Link>
    );
  }

  if (templateId === 'rent_soft') {
    return (
      <Link
        to="/rent"
        className="group block overflow-hidden rounded-[22px] bg-[#f5f5f7] border border-black/[0.05] hover:bg-white hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)] transition-all"
      >
        <div
          className={`bg-slate-200 bg-cover bg-center ${featured ? 'aspect-[16/9]' : 'aspect-[16/10]'}`}
          style={photo ? { backgroundImage: `url('${photo}')` } : undefined}
        />
        <div className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{category}</p>
          <h3 className="mt-1 text-[17px] font-semibold text-[#1d1d1f] tracking-tight">{name}</h3>
          {v.display_blurb ? (
            <p className="mt-2 text-sm text-[#6e6e73] line-clamp-2">{v.display_blurb}</p>
          ) : null}
          {priceLabel ? <p className="mt-3 text-sm font-semibold text-[#0071e3]">{priceLabel}</p> : null}
        </div>
      </Link>
    );
  }

  // rent_premium (default)
  return (
    <Link
      to="/rent"
      className="group block overflow-hidden rounded-3xl border border-black/[0.06] bg-surface-container-lowest hover:-translate-y-0.5 transition-transform"
    >
      <div
        className={`bg-slate-200 bg-cover bg-center ${featured ? 'aspect-[16/9]' : 'aspect-[16/10]'}`}
        style={photo ? { backgroundImage: `url('${photo}')` } : undefined}
      />
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-teal-700">{category}</p>
          {seats != null ? (
            <p className="text-xs font-semibold text-on-surface-variant">{seats} θέσεις</p>
          ) : null}
        </div>
        <h3 className="mt-1 font-headline-sm font-bold text-on-surface group-hover:text-teal-800 transition-colors">
          {name}
        </h3>
        {v.display_headline ? (
          <p className="mt-1 text-xs font-semibold text-teal-800">{v.display_headline}</p>
        ) : null}
        {v.display_blurb ? (
          <p className="mt-2 text-sm text-on-surface-variant line-clamp-3">{v.display_blurb}</p>
        ) : null}
        {meta.length ? (
          <p className="mt-2 text-xs font-semibold text-on-surface-variant">{meta.join(' · ')}</p>
        ) : null}
        {priceLabel ? <p className="mt-3 text-sm font-bold text-teal-800">{priceLabel}</p> : null}
      </div>
    </Link>
  );
}

/**
 * Homepage Rent block for office storefronts that have rent_enabled.
 * Full booking lives on /rent — this is the discovery CTA on `/`.
 */
export default function StorefrontRentSection({
  vehicles = [],
  loading = false,
  rentOnly = false,
  brandName = '',
  showServices = true,
  siteAppearance = {},
}) {
  const title = rentOnly ? 'Ενοικιάσεις οχημάτων' : 'Ενοικίαση αυτοκινήτου';
  const subtitle = rentOnly
    ? `${brandName ? `${brandName}: ` : ''}online κράτηση — επιβατικά και van, ημερομηνίες και παραλαβή σε λίγα βήματα.`
    : 'Διαθέσιμος στόλος για ημερήσια ή πολυήμερη ενοικίαση, δίπλα στις εκδρομές μας.';

  const preview = withDemoRentFleet(vehicles).slice(0, 6);
  const { cars, vans } = countRentFleetByBody(preview);
  const layoutId = siteAppearance.rent_fleet_layout_template || 'rent_grid_three';
  const cardId = siteAppearance.rent_fleet_card_template || 'rent_premium';
  const gridClass = rentFleetGridClass(layoutId);

  return (
    <>
      <section id="rent" className="py-20 md:py-24 bg-surface-bright border-y border-black/[0.05]">
        <div className="max-w-container-max mx-auto px-margin-desktop">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700 mb-3">Rent</p>
              <h2 className="font-headline-lg font-bold text-on-surface mb-3">{title}</h2>
              <p className="font-body-lg text-on-surface-variant leading-relaxed">{subtitle}</p>
              <p className="mt-3 text-sm font-semibold text-on-surface-variant">
                {cars} επιβατικά · {vans} van
              </p>
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
          ) : (
            <ul className={gridClass}>
              {preview.map((raw, index) => {
                const v = enrichRentVehicle(raw);
                return (
                  <li key={v.id || v.name || index} className={rentFleetCardWrapperClass(layoutId, index)}>
                    <RentVehicleCard
                      vehicle={v}
                      templateId={cardId}
                      featured={layoutId === 'rent_featured' && index === 0}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {showServices ? (
        <section id="rent-services" className="py-20 md:py-24 bg-white">
          <div className="max-w-container-max mx-auto px-margin-desktop">
            <div className="max-w-2xl mb-12">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700 mb-3">
                Υπηρεσία
              </p>
              <h2 className="font-headline-lg font-bold text-on-surface mb-3">
                Τι περιλαμβάνει η ενοικίαση
              </h2>
              <p className="font-body-lg text-on-surface-variant leading-relaxed">
                Υποστήριξη στο δρόμο, ασφάλεια και εργαλεία ταξιδιού — μέσα από το Rent Wallet.
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 list-none p-0 m-0">
              {RENT_SERVICE_FEATURES.map((feature) => {
                const copy = rentServiceCopy(feature, 'el');
                return (
                  <li
                    key={feature.id}
                    className="rounded-3xl border border-black/[0.06] bg-surface-bright p-6"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-teal-700/10 text-teal-800 flex items-center justify-center mb-4">
                      <span className="material-symbols-outlined text-[26px]" aria-hidden>
                        {feature.icon}
                      </span>
                    </div>
                    <h3 className="font-headline-sm font-bold text-on-surface mb-2">{copy.title}</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{copy.copy}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
