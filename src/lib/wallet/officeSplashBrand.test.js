import {
  ACHILLIO_TRAVEL_NAME,
  isAchillioTravelSplashBrand,
  pickOfficeName,
  resolveOfficeSplashBrand,
} from './officeSplashBrand.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}

// Logo + empty name fields → Achillio Travel via slug.
{
  const brand = resolveOfficeSplashBrand({
    logo_url: '/api/site/assets/logo-abc',
    tenant_slug: 'admin-achillio-gr',
    footer_brand_name: '',
    display_name: '',
  });
  assert(brand.hasLogo, 'has logo');
  assert(brand.name === ACHILLIO_TRAVEL_NAME, `name from slug, got ${brand.name}`);
}

// Explicit footer name wins.
{
  const name = pickOfficeName(
    { footer_brand_name: 'Aegean Tours', logo_url: '/api/site/assets/x' },
    { displayName: 'Aegean Tours', name: 'Aegean Tours' },
  );
  assert(name === 'Aegean Tours', 'explicit name wins');
}

// Brand text in footer detects Achillio.
assert(
  isAchillioTravelSplashBrand({ footer_brand_name: 'Achillio Travel' }),
  'footer brand detects Achillio',
);

// Logo URL containing achillio recovers wordmark.
{
  const brand = resolveOfficeSplashBrand({
    logo_url: 'https://cdn.example/achillio-seal.png',
    footer_brand_name: '',
  });
  assert(brand.name === ACHILLIO_TRAVEL_NAME, 'logo path recovers Achillio Travel');
}

console.log('officeSplashBrand.test.js ok');
