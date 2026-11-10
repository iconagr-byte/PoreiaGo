/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { resolveWalletHomeFeed } from './walletHomeFeed.js';

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
});
