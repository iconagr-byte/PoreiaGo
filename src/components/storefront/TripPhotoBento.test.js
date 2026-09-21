import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collectTripPhotoUrls } from '../../lib/trips/tripPhotos.js';
import { galleryForDemoTrip, DEMO_TRIP_GALLERIES } from '../../data/demoTripGalleries.js';
import { mockTrips } from '../../data/mockData.js';

describe('demo trip galleries', () => {
  it('provides 5 photos per demo destination key', () => {
    for (const key of Object.keys(DEMO_TRIP_GALLERIES)) {
      const g = galleryForDemoTrip(key);
      assert.ok(g.length >= 5, key);
      assert.ok(g.every((u) => typeof u === 'string' && u.length > 0));
    }
  });

  it('attaches images arrays on all mock trips', () => {
    assert.ok(mockTrips.length >= 6);
    for (const trip of mockTrips) {
      assert.ok(Array.isArray(trip.images), trip.title);
      assert.ok(trip.images.length >= 4, trip.title);
      assert.ok(trip.image, trip.title);
    }
  });

  it('collectTripPhotoUrls prefers images then cover then stops', () => {
    const urls = collectTripPhotoUrls({
      image: '/cover.png',
      images: ['/a.jpg', '/b.jpg'],
      stops: [{ image: '/stop.png' }, { name: 'no-img' }],
    });
    assert.deepEqual(urls, ['/a.jpg', '/b.jpg', '/cover.png', '/stop.png']);
  });

  it('skips platform Achillio default bus and empty covers', () => {
    const urls = collectTripPhotoUrls({
      image: '/images/hero-bus-achillio.png',
      images: ['/images/hero-bus-achillio.png', '/real.jpg'],
    });
    assert.deepEqual(urls, ['/real.jpg']);
    assert.equal(
      collectTripPhotoUrls({ image: '', images: [] }).length,
      0,
    );
  });
});
