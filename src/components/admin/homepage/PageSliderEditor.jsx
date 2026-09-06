import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { fileToTripCoverDataUrl, TRIP_COVER_ACCEPT } from '../../../lib/trips/tripImage.js';
import {
  DEFAULT_SLIDER_OPTIONS,
  PAGE_SLIDER_MAX_SLIDES,
  SLIDER_CAPTION_POSITIONS,
  SLIDER_TRANSITIONS,
  clampSliderIntervalSec,
  createSliderSlide,
  normalizeSliderOptions,
  normalizeSliderSlides,
} from '../../../lib/homepage/pageSlider.js';
import { resolveSiteAssetUrl } from '../../../services/siteAppearanceApi.js';

const TABS = [
  { id: 'slides', label: 'Διαφάνειες', icon: 'photo_library' },
  { id: 'config', label: 'Ρυθμίσεις', icon: 'tune' },
  { id: 'mobile', label: 'Κινητό', icon: 'smartphone' },
];

/**
 * Soliloquy-inspired admin editor for bus or rent page hero slider.
 */
export default function PageSliderEditor({
  page = 'home',
  enabled,
  autoplay,
  intervalSec,
  options,
  slides,
  onChange,
  saving,
  onSave,
} = {}) {
  const [uploadingId, setUploadingId] = useState('');
  const [tab, setTab] = useState('slides');
  const [dragOver, setDragOver] = useState(false);
  const [dragSlideId, setDragSlideId] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const dragDepth = useRef(0);
  const fileInputRef = useRef(null);

  const list = normalizeSliderSlides(slides, { respectSchedule: false });
  const opts = normalizeSliderOptions(options || DEFAULT_SLIDER_OPTIONS);
  const isRent = page === 'rent';
  const accentColor = isRent ? '#0f766e' : '#0284c7';

  const update = (patch) =>
    onChange?.({
      enabled,
      autoplay,
      interval_sec: intervalSec,
      options: opts,
      slides: list,
      ...patch,
    });

  const setOpts = (patch) => update({ options: { ...opts, ...patch } });

  const setSlide = (id, patch) => {
    update({
      slides: list.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  };

  const addSlide = (partial = {}) => {
    if (list.length >= PAGE_SLIDER_MAX_SLIDES) {
      toast.error(`Μέχρι ${PAGE_SLIDER_MAX_SLIDES} διαφάνειες`);
      return null;
    }
    const slide = createSliderSlide({
      title: isRent ? 'Ενοικίαση' : 'Εκδρομή',
      ...partial,
    });
    update({
      enabled: true,
      slides: [...list, slide],
    });
    setExpandedId(slide.id);
    return slide;
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

  const reorderSlide = (fromId, toId) => {
    if (!fromId || !toId || fromId === toId) return;
    const from = list.findIndex((s) => s.id === fromId);
    const to = list.findIndex((s) => s.id === toId);
    if (from < 0 || to < 0) return;
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    update({ slides: next });
  };

  const onUpload = async (id, file) => {
    if (!file) return;
    setUploadingId(id);
    try {
      const url = await fileToTripCoverDataUrl(file);
      setSlide(id, { image_url: url, alt: file.name?.replace(/\.[^.]+$/, '') || '' });
      toast.success('Η εικόνα ανέβηκε');
    } catch (err) {
      toast.error(err?.message || 'Αποτυχία ανεβάσματος');
    } finally {
      setUploadingId('');
    }
  };

  const ingestFiles = async (files) => {
    const images = [...(files || [])].filter((f) => f.type.startsWith('image/'));
    if (!images.length) {
      toast.error('Σύρε εικόνες (JPG / PNG / WebP)');
      return;
    }
    const room = PAGE_SLIDER_MAX_SLIDES - list.length;
    if (room <= 0) {
      toast.error(`Μέχρι ${PAGE_SLIDER_MAX_SLIDES} διαφάνειες`);
      return;
    }
    const batch = images.slice(0, room);
    const created = [];
    for (const file of batch) {
      try {
        const url = await fileToTripCoverDataUrl(file);
        created.push(
          createSliderSlide({
            image_url: url,
            title: isRent ? 'Ενοικίαση' : 'Εκδρομή',
            alt: file.name?.replace(/\.[^.]+$/, '') || '',
          }),
        );
      } catch (err) {
        toast.error(err?.message || 'Αποτυχία ανεβάσματος');
      }
    }
    if (!created.length) return;
    update({
      enabled: true,
      slides: [...list, ...created],
    });
    setExpandedId(created[0].id);
    toast.success(
      created.length === 1 ? 'Προστέθηκε 1 διαφάνεια' : `Προστέθηκαν ${created.length} διαφάνειες`,
    );
    if (images.length > room) {
      toast.error(`Έγιναν αποδεκτές μόνο ${room} (μέγιστο ${PAGE_SLIDER_MAX_SLIDES})`);
    }
  };

  const onDropFiles = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragOver(false);
    if (!e.dataTransfer?.files?.length) return;
    ingestFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="inline-flex rounded-2xl border border-black/[0.06] bg-slate-100/80 p-1 gap-0.5"
          role="tablist"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                tab === t.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={onSave}
          className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold bg-gray-900 text-white disabled:opacity-60"
        >
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση slider'}
        </button>
      </div>

      {tab === 'slides' ? (
        <div
          className="space-y-4"
          onDragEnter={(e) => {
            e.preventDefault();
            if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
            dragDepth.current += 1;
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (![...(e.dataTransfer?.types || [])].includes('Files')) return;
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (![...(e.dataTransfer?.types || [])].includes('Files') && dragDepth.current === 0) {
              return;
            }
            dragDepth.current = Math.max(0, dragDepth.current - 1);
            if (dragDepth.current === 0) setDragOver(false);
          }}
          onDrop={onDropFiles}
        >
          <div className="grid sm:grid-cols-3 gap-3">
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
            <div className="rounded-2xl border border-black/[0.06] bg-slate-50 px-4 py-3 flex items-center justify-between gap-2">
              <div>
                <p className="font-bold text-gray-900 text-sm">
                  {list.length} / {PAGE_SLIDER_MAX_SLIDES} διαφάνειες
                </p>
                <p className="text-xs text-gray-500">Drag & drop · reorder · SEO alt</p>
              </div>
              <span className="material-symbols-outlined text-slate-400">view_carousel</span>
            </div>
            <div className="flex flex-wrap gap-2 items-center justify-end sm:justify-start">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-white"
                style={{ background: accentColor }}
              >
                <span className="material-symbols-outlined text-[18px]">upload</span>
                Ανέβασμα εικόνων
              </button>
              <button
                type="button"
                onClick={() => addSlide()}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold border border-slate-200 text-slate-800 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Κενή
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={TRIP_COVER_ACCEPT}
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  e.target.value = '';
                  ingestFiles(files);
                }}
              />
            </div>
          </div>

          {!list.length ? (
            <div
              className={`relative rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
                dragOver
                  ? 'border-sky-400 bg-sky-50 ring-4 ring-sky-400/20'
                  : 'border-gray-300 bg-white'
              }`}
            >
              <span className="material-symbols-outlined text-4xl text-gray-300">cloud_upload</span>
              <p className="mt-3 font-bold text-gray-900">Σύρε εικόνες εδώ (Soliloquy-style)</p>
              <p className="mt-1 text-sm text-gray-500 max-w-md mx-auto">
                Πολλαπλά αρχεία JPG / PNG / WebP · αυτόματη δημιουργία διαφανειών · μέχρι{' '}
                {PAGE_SLIDER_MAX_SLIDES}.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-5 inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-bold text-white"
                style={{ background: accentColor }}
              >
                Επίλεξε από τον υπολογιστή
              </button>
            </div>
          ) : (
            <ul className="space-y-3">
              {dragOver ? (
                <li className="rounded-2xl border-2 border-dashed border-sky-400 bg-sky-50 px-4 py-6 text-center text-sm font-bold text-sky-800">
                  Άφησε για προσθήκη νέων διαφανειών
                </li>
              ) : null}
              {list.map((slide, idx) => {
                const preview = resolveSiteAssetUrl(slide.image_url) || slide.image_url;
                const open = expandedId === slide.id;
                return (
                  <li
                    key={slide.id}
                    draggable
                    onDragStart={(e) => {
                      setDragSlideId(slide.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', slide.id);
                    }}
                    onDragEnd={() => setDragSlideId('')}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const from = e.dataTransfer.getData('text/plain') || dragSlideId;
                      reorderSlide(from, slide.id);
                      setDragSlideId('');
                    }}
                    className={`rounded-2xl border bg-white shadow-sm overflow-hidden transition ${
                      dragSlideId === slide.id
                        ? 'opacity-60 border-sky-300'
                        : 'border-black/[0.06]'
                    }`}
                  >
                    <div className="grid lg:grid-cols-[10rem_1fr_auto] gap-3 p-3 items-center">
                      <div className="relative h-28 rounded-xl overflow-hidden bg-slate-100 border border-dashed border-gray-200">
                        {preview ? (
                          <img
                            src={preview}
                            alt=""
                            className="w-full h-full object-cover pointer-events-none"
                            draggable={false}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                            Χωρίς εικόνα
                          </div>
                        )}
                        <span className="absolute top-2 left-2 rounded-full bg-black/55 text-white text-[11px] font-bold px-2 py-0.5">
                          {idx + 1}
                        </span>
                        <span className="absolute bottom-2 left-2 inline-flex items-center gap-0.5 rounded-md bg-black/45 text-white text-[10px] font-bold px-1.5 py-0.5">
                          <span className="material-symbols-outlined text-[12px]">drag_indicator</span>
                          Σύρε
                        </span>
                      </div>

                      <div className="min-w-0 space-y-1">
                        <p className="font-bold text-slate-900 truncate">
                          {slide.title || slide.alt || `Διαφάνεια ${idx + 1}`}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {slide.subtitle || slide.cta_href || 'Χωρίς caption / σύνδεσμο'}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {slide.alt ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5">
                              SEO alt
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-amber-50 text-amber-700 px-2 py-0.5">
                              Χωρίς alt
                            </span>
                          )}
                          {slide.schedule_start || slide.schedule_end ? (
                            <span className="text-[10px] font-bold uppercase tracking-wide rounded-full bg-violet-50 text-violet-700 px-2 py-0.5">
                              Προγραμματισμένη
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 justify-end">
                        <label className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold cursor-pointer hover:bg-slate-50">
                          <span className="material-symbols-outlined text-[16px]">image</span>
                          {uploadingId === slide.id ? '…' : 'Εικόνα'}
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
                        <button
                          type="button"
                          className="rounded-lg border px-2 py-1.5 text-xs font-bold"
                          onClick={() => setExpandedId(open ? '' : slide.id)}
                        >
                          {open ? 'Κλείσιμο' : 'Επεξεργασία'}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border px-2 py-1.5 text-xs font-bold"
                          onClick={() => moveSlide(slide.id, -1)}
                          disabled={idx === 0}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border px-2 py-1.5 text-xs font-bold"
                          onClick={() => moveSlide(slide.id, 1)}
                          disabled={idx === list.length - 1}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-rose-200 text-rose-700 px-2 py-1.5 text-xs font-bold"
                          onClick={() => removeSlide(slide.id)}
                        >
                          Διαγραφή
                        </button>
                      </div>
                    </div>

                    {open ? (
                      <div className="border-t border-black/[0.04] bg-slate-50/60 p-4 grid sm:grid-cols-2 gap-3">
                        <label className="block text-sm sm:col-span-2">
                          <span className="font-bold text-gray-700">Τίτλος</span>
                          <input
                            className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                            value={slide.title}
                            onChange={(e) => setSlide(slide.id, { title: e.target.value })}
                            placeholder={isRent ? 'π.χ. Καλοκαιρινές προσφορές' : 'π.χ. Σαντορίνη'}
                          />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="font-bold text-gray-700">Caption / υπότιτλος</span>
                          <textarea
                            className="mt-1 w-full rounded-xl border px-3 py-2 bg-white min-h-[4.5rem]"
                            value={slide.subtitle}
                            onChange={(e) => setSlide(slide.id, { subtitle: e.target.value })}
                          />
                        </label>
                        <label className="block text-sm sm:col-span-2">
                          <span className="font-bold text-gray-700">Alt text (SEO / accessibility)</span>
                          <input
                            className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                            value={slide.alt}
                            onChange={(e) => setSlide(slide.id, { alt: e.target.value })}
                            placeholder="Περιγραφή εικόνας για Google & screen readers"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-bold text-gray-700">Κουμπί CTA</span>
                          <input
                            className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                            value={slide.cta_label}
                            onChange={(e) => setSlide(slide.id, { cta_label: e.target.value })}
                            placeholder="π.χ. Κράτηση"
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-bold text-gray-700">Σύνδεσμος (URL)</span>
                          <input
                            className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                            value={slide.cta_href}
                            onChange={(e) => setSlide(slide.id, { cta_href: e.target.value })}
                            placeholder={isRent ? '/rent/wallet' : '#trips'}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-sm sm:col-span-2">
                          <input
                            type="checkbox"
                            checked={Boolean(slide.link_new_tab)}
                            onChange={(e) => setSlide(slide.id, { link_new_tab: e.target.checked })}
                            className="rounded border-gray-300"
                          />
                          <span className="font-bold text-gray-700">Άνοιγμα συνδέσμου σε νέα καρτέλα</span>
                        </label>
                        <label className="block text-sm">
                          <span className="font-bold text-gray-700">Προγραμματισμός από</span>
                          <input
                            type="datetime-local"
                            className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                            value={toLocalInput(slide.schedule_start)}
                            onChange={(e) =>
                              setSlide(slide.id, { schedule_start: fromLocalInput(e.target.value) })
                            }
                          />
                        </label>
                        <label className="block text-sm">
                          <span className="font-bold text-gray-700">Προγραμματισμός έως</span>
                          <input
                            type="datetime-local"
                            className="mt-1 w-full rounded-xl border px-3 py-2 bg-white"
                            value={toLocalInput(slide.schedule_end)}
                            onChange={(e) =>
                              setSlide(slide.id, { schedule_end: fromLocalInput(e.target.value) })
                            }
                          />
                        </label>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === 'config' ? (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={autoplay !== false}
                onChange={(e) => update({ autoplay: e.target.checked })}
                className="rounded border-gray-300"
              />
              <span>
                <span className="font-bold text-gray-900 block text-sm">Αυτόματη εναλλαγή</span>
                <span className="text-xs text-gray-500">Autoplay</span>
              </span>
            </label>
            <label className="block rounded-2xl border border-black/[0.06] bg-slate-50 px-4 py-3">
              <span className="font-bold text-gray-900 text-sm">Διάστημα (δευτ.)</span>
              <input
                type="number"
                min={3}
                max={20}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-white"
                value={clampSliderIntervalSec(intervalSec)}
                onChange={(e) => update({ interval_sec: clampSliderIntervalSec(e.target.value) })}
              />
            </label>
            <label className="block rounded-2xl border border-black/[0.06] bg-slate-50 px-4 py-3">
              <span className="font-bold text-gray-900 text-sm">Μετάβαση</span>
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-white"
                value={opts.transition}
                onChange={(e) => setOpts({ transition: e.target.value })}
              >
                {SLIDER_TRANSITIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block rounded-2xl border border-black/[0.06] bg-slate-50 px-4 py-3">
              <span className="font-bold text-gray-900 text-sm">Θέση caption</span>
              <select
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-white"
                value={opts.caption_position}
                onChange={(e) => setOpts({ caption_position: e.target.value })}
              >
                {SLIDER_CAPTION_POSITIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              ['show_arrows', 'Βέλη πλοήγησης', 'Previous / Next'],
              ['show_dots', 'Dots', 'Κουκκίδες κάτω'],
              ['show_thumbnails', 'Thumbnails', 'Μικρογραφίες κάτω από το slider'],
              ['loop', 'Loop', 'Ξαναρχίζει από την αρχή'],
              ['pause_on_hover', 'Παύση στο hover', 'Σταματάει με το ποντίκι'],
              ['keyboard', 'Πληκτρολόγιο', '← → για εναλλαγή'],
              ['lightbox', 'Lightbox', 'Μεγέθυνση σε fullscreen'],
              ['protect', 'Προστασία εικόνας', 'Απενεργοποίηση δεξιού κλικ'],
            ].map(([key, title, hint]) => (
              <label
                key={key}
                className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={Boolean(opts[key])}
                  onChange={(e) => setOpts({ [key]: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span>
                  <span className="font-bold text-gray-900 block text-sm">{title}</span>
                  <span className="text-xs text-gray-500">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'mobile' ? (
        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-slate-50 px-4 py-4">
            <input
              type="checkbox"
              checked={Boolean(opts.mobile_hide_captions)}
              onChange={(e) => setOpts({ mobile_hide_captions: e.target.checked })}
              className="rounded border-gray-300 mt-1"
            />
            <span>
              <span className="font-bold text-gray-900 block text-sm">Απόκρυψη captions στο κινητό</span>
              <span className="text-xs text-gray-500">
                Όπως στο Soliloquy Mobile: καθαρότερο hero σε μικρές οθόνες — μένουν βέλη / dots /
                swipe.
              </span>
            </span>
          </label>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-6 text-sm text-slate-600">
            <p className="font-bold text-slate-900 mb-1">Responsive by default</p>
            Το slider είναι full-bleed, swipe-ready και βελτιστοποιημένο για touch — χωρίς έξτρα
            ρύθμιση.
          </div>
        </div>
      ) : null}
    </div>
  );
}

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString();
}
