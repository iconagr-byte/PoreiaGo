import { useState } from 'react';
import toast from 'react-hot-toast';
import { fileToTripCoverDataUrl, TRIP_COVER_ACCEPT } from '../../lib/trips/tripImage.js';
import {
  PAGE_SLIDER_MAX_SLIDES,
  clampSliderIntervalSec,
  createSliderSlide,
  normalizeSliderSlides,
} from '../../lib/homepage/pageSlider.js';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

/**
 * Admin editor for bus or rent page hero slider.
 */
export default function PageSliderEditor({
  page = 'home',
  enabled,
  autoplay,
  intervalSec,
  slides,
  onChange,
  saving,
  onSave,
} = {}) {
  const [uploadingId, setUploadingId] = useState('');
  const list = normalizeSliderSlides(slides);
  const isRent = page === 'rent';
  const accent = isRent ? 'teal' : 'sky';

  const update = (patch) => onChange?.({ enabled, autoplay, interval_sec: intervalSec, slides: list, ...patch });

  const setSlide = (id, patch) => {
    update({
      slides: list.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const addSlide = () => {
    if (list.length >= PAGE_SLIDER_MAX_SLIDES) {
      toast.error(`Μέχρι ${PAGE_SLIDER_MAX_SLIDES} διαφάνειες`);
      return;
    }
    update({
      enabled: true,
      slides: [...list, createSliderSlide({ title: isRent ? 'Ενοικίαση' : 'Εκδρομή' })],
    });
  };

  const removeSlide = (id) => {
    const next = list.filter((s) => s.id !== id);
    update({ slides: next, enabled: enabled && next.length > 0 });
  };

  const moveSlide = (id, dir) => {
    const i = list.findIndex((s) => s.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    update({ slides: next });
  };

  const onUpload = async (id, file) => {
    if (!file) return;
    setUploadingId(id);
    try {
      const url = await fileToTripCoverDataUrl(file);
      setSlide(id, { image_url: url });
      toast.success('Η εικόνα ανέβηκε');
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία ανεβάσματος');
    } finally {
      setUploadingId('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <label className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            checked={Boolean(enabled)}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="rounded border-gray-300"
          />
          <span>
            <span className="font-bold text-gray-900 block text-sm">Ενεργό στο hero</span>
            <span className="text-xs text-gray-500">Αντικαθιστά τη σταθερή φωτογραφία</span>
          </span>
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            checked={autoplay !== false}
            onChange={(e) => update({ autoplay: e.target.checked })}
            className="rounded border-gray-300"
          />
          <span>
            <span className="font-bold text-gray-900 block text-sm">Αυτόματη εναλλαγή</span>
            <span className="text-xs text-gray-500">Παύση στο hover</span>
          </span>
        </label>
        <label className="block rounded-2xl border border-black/[0.06] bg-slate-50 px-4 py-3">
          <span className="font-bold text-gray-900 text-sm">Διάστημα (δευτ.)</span>
          <input
            type="number"
            min={3}
            max={20}
            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
            value={clampSliderIntervalSec(intervalSec)}
            onChange={(e) => update({ interval_sec: clampSliderIntervalSec(e.target.value) })}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {list.length} / {PAGE_SLIDER_MAX_SLIDES} διαφάνειες · σύρε swipe στο κινητό · βέλη & dots
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addSlide}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white bg-${accent}-600 hover:opacity-95`}
            style={{ background: isRent ? '#0f766e' : '#0284c7' }}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Νέα διαφάνεια
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold bg-gray-900 text-white disabled:opacity-60"
          >
            {saving ? 'Αποθήκευση…' : 'Αποθήκευση slider'}
          </button>
        </div>
      </div>

      {!list.length ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <span className="material-symbols-outlined text-4xl text-gray-300">view_carousel</span>
          <p className="mt-3 font-bold text-gray-900">Δεν υπάρχουν διαφάνειες ακόμα</p>
          <p className="mt-1 text-sm text-gray-500">
            Πρόσθεσε 2–5 δυνατές φωτογραφίες για ισχυρό πρώτο εντύπωμα.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {list.map((slide, idx) => {
            const preview = resolveSiteAssetUrl(slide.image_url) || slide.image_url;
            return (
              <li
                key={slide.id}
                className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-sm grid lg:grid-cols-[11rem_1fr] gap-4"
              >
                <div className="space-y-2">
                  <div className="relative h-36 rounded-xl overflow-hidden bg-slate-100 border border-dashed border-gray-200">
                    {preview ? (
                      <img src={preview} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                        Χωρίς εικόνα
                      </div>
                    )}
                    <span className="absolute top-2 left-2 rounded-full bg-black/55 text-white text-[11px] font-bold px-2 py-0.5">
                      {idx + 1}
                    </span>
                  </div>
                  <label className="inline-flex w-full justify-center items-center gap-1 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer hover:bg-slate-50">
                    <span className="material-symbols-outlined text-[16px]">upload</span>
                    {uploadingId === slide.id ? 'Ανέβασμα…' : 'Εικόνα'}
                    <input
                      type="file"
                      accept={TRIP_COVER_ACCEPT}
                      className="hidden"
                      disabled={uploadingId === slide.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        onUpload(slide.id, file);
                      }}
                    />
                  </label>
                </div>

                <div className="space-y-3 min-w-0">
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      className="rounded-lg border px-2 py-1 text-xs font-bold"
                      onClick={() => moveSlide(slide.id, -1)}
                      disabled={idx === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border px-2 py-1 text-xs font-bold"
                      onClick={() => moveSlide(slide.id, 1)}
                      disabled={idx === list.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 text-rose-700 px-2 py-1 text-xs font-bold"
                      onClick={() => removeSlide(slide.id)}
                    >
                      Διαγραφή
                    </button>
                  </div>
                  <label className="block text-sm">
                    <span className="font-bold text-gray-700">Τίτλος (προαιρετικό)</span>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={slide.title}
                      onChange={(e) => setSlide(slide.id, { title: e.target.value })}
                      placeholder={isRent ? 'π.χ. Καλοκαιρινές προσφορές' : 'π.χ. Σαντορίνη'}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-bold text-gray-700">Υπότιτλος</span>
                    <input
                      className="mt-1 w-full rounded-xl border px-3 py-2"
                      value={slide.subtitle}
                      onChange={(e) => setSlide(slide.id, { subtitle: e.target.value })}
                    />
                  </label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block text-sm">
                      <span className="font-bold text-gray-700">Κουμπί</span>
                      <input
                        className="mt-1 w-full rounded-xl border px-3 py-2"
                        value={slide.cta_label}
                        onChange={(e) => setSlide(slide.id, { cta_label: e.target.value })}
                        placeholder="π.χ. Κράτηση"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="font-bold text-gray-700">Σύνδεσμος</span>
                      <input
                        className="mt-1 w-full rounded-xl border px-3 py-2"
                        value={slide.cta_href}
                        onChange={(e) => setSlide(slide.id, { cta_href: e.target.value })}
                        placeholder={isRent ? '/rent/wallet' : '#trips'}
                      />
                    </label>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
