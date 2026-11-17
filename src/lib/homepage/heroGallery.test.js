import {
  HERO_GALLERY_FALLBACK,
  readHeroGallery,
  writeHeroGalleryPatch,
} from './heroGallery.js';

const bus = HERO_GALLERY_FALLBACK;
const second = '/uploads/office/hero-2.jpg';
const third = 'https://cdn.example.com/trip.jpg';

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert failed');
}

// Adding a 2nd photo must KEEP the Achillio bus primary (regression).
{
  const patch = writeHeroGalleryPatch(
    [
      { id: 'hero-primary', url: bus, role: 'primary' },
      { id: 'tmp_2', url: second, role: 'extra' },
    ],
    { carousel: true, autoplay: true, intervalSec: 5, options: {} },
  );
  assert(patch.hero_image_url === bus, 'bus stays primary');
  assert(patch.home_slider_enabled === true, 'carousel on with 2 photos');
  assert(patch.home_slider_slides.length === 2, 'both slides in carousel');
  assert(
    patch.home_slider_slides.map((s) => s.image_url).includes(bus),
    'bus in carousel slides',
  );
  assert(
    patch.home_slider_slides.map((s) => s.image_url).includes(second),
    'second in carousel slides',
  );
}

// 3 photos rotate.
{
  const patch = writeHeroGalleryPatch(
    [
      { id: 'hero-primary', url: bus, role: 'primary' },
      { id: 'a', url: second, role: 'extra' },
      { id: 'b', url: third, role: 'extra' },
    ],
    { carousel: true, intervalSec: 4, options: { transition: 'fade' } },
  );
  assert(patch.home_slider_slides.length === 3, 'three slides');
  assert(patch.home_slider_enabled === true, 'carousel enabled');
}

// Synthetic fallback alone must not be written as a real hero.
{
  const patch = writeHeroGalleryPatch(
    [{ id: 'hero-fallback', url: bus, role: 'fallback' }],
    { carousel: false },
  );
  assert(patch.hero_image_url === '', 'fallback not persisted as hero');
  assert(patch.home_slider_enabled === false, 'no carousel');
  assert(patch.home_slider_slides.length === 0, 'no slides');
}

// readGallery: explicit bus hero is primary, not fallback.
{
  const photos = readHeroGallery({
    hero_image_url: bus,
    home_slider_slides: [{ id: 'x', image_url: second }],
  });
  assert(photos.length === 2, 'primary + extra');
  assert(photos[0].role === 'primary' && photos[0].url === bus, 'bus primary');
  assert(photos[1].role === 'extra' && photos[1].url === second, 'extra kept');
}

console.log('heroGallery.test.js: ok');
