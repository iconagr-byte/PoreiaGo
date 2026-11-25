/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  RENT_WALLET_HOME_SERVICES,
  resolveWalletHomeFeed,
} from './walletHomeFeed.js';
import { DEFAULT_SITE_APPEARANCE } from '../../services/siteAppearanceApi.js';

describe('resolveWalletHomeFeed', () => {
  it('falls back to hero copy when wallet home fields are empty', () => {
    const feed = resolveWalletHomeFeed(
      {
        footer_brand_name: 'Achillio Travel',
        hero_badge: 'Premium',
        hero_title: 'Η Ελλάδα,',
        hero_title_accent: 'όπως πρέπει.',
        hero_subtitle: 'Εκδρομές με το γραφείο μας.',
        wallet_home_services: [],
      },
      { officeName: 'Achillio Travel' },
    );
    expect(feed.officeName).toBe('Achillio Travel');
    expect(feed.hook).toBe('Premium');
    expect(feed.headline).toContain('Η Ελλάδα');
    expect(feed.body).toContain('Εκδρομές');
    expect(feed.services.length).toBeGreaterThan(0);
    expect(feed.services[0].title).toBe(
      DEFAULT_SITE_APPEARANCE.wallet_home_services[0].title,
    );
    expect(feed.showTrips).toBe(true);
  });

  it('uses custom wallet home fields and news when set', () => {
    const feed = resolveWalletHomeFeed({
      wallet_home_hook: 'Καλοκαίρι 2026',
      wallet_home_headline: 'Νέα σεζόν εκδρομών',
      wallet_home_body: 'Κλείστε νωρίς.',
      wallet_home_services: [{ icon: 'bus', title: 'Comfort', body: 'Κλιματισμός' }],
      wallet_home_news: [{ title: 'Άνοιγμα κράτησης', body: 'Από Δευτέρα', badge: 'Νέο' }],
      wallet_home_show_trips: false,
      wallet_home_trips_title: 'Προσεχώς',
    });
    expect(feed.hook).toBe('Καλοκαίρι 2026');
    expect(feed.headline).toBe('Νέα σεζόν εκδρομών');
    expect(feed.services).toHaveLength(1);
    expect(feed.news[0].badge).toBe('Νέο');
    expect(feed.showTrips).toBe(false);
    expect(feed.tripsTitle).toBe('Προσεχώς');
  });

  it('does not treat hidden trips as rent-only (bus/hybrid can hide excursions)', () => {
    const feed = resolveWalletHomeFeed({
      hero_badge: 'Premium',
      hero_title: 'Η Ελλάδα,',
      hero_title_accent: 'όπως πρέπει.',
      hero_subtitle: 'Εκδρομές με το γραφείο μας.',
      rent_guest_hero_title: 'Ενοικίαση αυτοκινήτου',
      rent_guest_hero_copy: 'Παραλαβή στο γραφείο.',
      wallet_home_show_trips: false,
      wallet_home_services: [],
    });
    expect(feed.showTrips).toBe(false);
    expect(feed.hook).toBe('Premium');
    expect(feed.headline).toContain('Η Ελλάδα');
    expect(feed.body).toContain('Εκδρομές');
    expect(feed.body.toLowerCase()).not.toContain('ενοικίαση');
    expect(feed.services[0].title).toBe(
      DEFAULT_SITE_APPEARANCE.wallet_home_services[0].title,
    );
  });

  it('prefers rent guest copy for rent-only wallet home', () => {
    const feed = resolveWalletHomeFeed(
      {
        hero_title: 'Η Ελλάδα, όπως δεν την έχεις ξαναδεί:',
        hero_subtitle: 'Διάλεξτε από τις προγραμματισμένες εκδρομές μας.',
        rent_guest_hero_title: 'Ενοικίαση αυτοκινήτου',
        rent_guest_hero_title_accent: '— στόλος IconaRent',
        rent_hero_copy: 'Παραλαβή στο γραφείο.',
        rent_office_name: 'ICONA RENT',
        wallet_home_show_trips: false,
      },
      { rentOnly: true },
    );
    expect(feed.headline).toContain('Ενοικίαση αυτοκινήτου');
    expect(feed.body).toContain('Παραλαβή');
    expect(feed.showTrips).toBe(false);
    expect(feed.body.toLowerCase()).not.toContain('εκδρομές');
  });

  it('uses rent-safe service defaults when rent-only services are empty', () => {
    const feed = resolveWalletHomeFeed(
      {
        wallet_home_services: [],
        rent_guest_hero_title: 'Ενοικίαση αυτοκινήτου',
      },
      { rentOnly: true },
    );
    expect(feed.services).toHaveLength(RENT_WALLET_HOME_SERVICES.length);
    expect(feed.services[0].title).toBe(RENT_WALLET_HOME_SERVICES[0].title);
    expect(feed.services.map((s) => s.body).join(' ').toLowerCase()).not.toContain(
      'εισιτήρι',
    );
    expect(feed.services.map((s) => s.body).join(' ').toLowerCase()).not.toContain(
      'θέση',
    );
  });
});
