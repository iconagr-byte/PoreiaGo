import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { TRIP_COVER_ACCEPT } from '../../../lib/trips/tripImage.js';
import { HERO_FOCAL_OPTIONS, heroFocalCss } from '../../../lib/homepage/heroFocal.js';

/**
 * Rich hero photo editor — drag/drop, paste, URL, focal point, preview.
 */
export default function HeroImageBlock({
  previewUrl,
  uploading,
  hasCustom,
  focal = 'center',
  onUpload,
  onClear,
  onApplyUrl,
  onFocalChange,
  heroTitle = '',
  heroAccent = '',
} = {}) {
  const [dragOver, setDragOver] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [lightbox, setLightbox] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    const onPaste = (e) => {
      if (!dropRef.current) return;
      const inside =
        dropRef.current.contains(e.target) || dropRef.current.contains(document.activeElement);
      if (!inside) return;
      const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
      if (!file) return;
      e.preventDefault();
      onUpload?.({ target: { files: [file], value: '' } });
      toast.success('Εικόνα από clipboard');
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [onUpload]);

  const onDropFile = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Μόνο αρχεία εικόνας');
      return;
    }
    onUpload?.({ target: { files: [file], value: '' } });
  };

  const copyUrl = async () => {
    if (!previewUrl) return;
    try {
      await navigator.clipboard.writeText(previewUrl);
      toast.success('Το URL αντιγράφηκε');
    } catch {
      toast.error('Αποτυχία αντιγραφής');
    }
  };

  const applyUrl = () => {
    const url = String(urlDraft || '').trim();
    if (!url) {
      toast.error('Βάλε URL εικόνας');
      return;
    }
    if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && !url.startsWith('data:')) {
      toast.error('Χρησιμοποίησε http(s) ή /path');
      return;
    }
    onApplyUrl?.(url);
    setUrlDraft('');
  };

  return (
    <div
      ref={dropRef}
      tabIndex={0}
      className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden outline-none focus-within:ring-2 focus-within:ring-sky-400/30"
    >
      <div className="px-5 py-4 border-b border-black/[0.04] bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h5 className="font-bold text-base tracking-tight">Hero φωτογραφία</h5>
            <p className="text-xs text-white/65 mt-0.5 max-w-xl">
              Full-bleed φόντο πίσω από τον τίτλο · JPG συμπίεση αυτόματα · ιδανικά 1920×1080
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold">
            <span className="material-symbols-outlined text-[14px]">wallpaper</span>
            {hasCustom ? 'Προσαρμοσμένη' : 'Προεπιλογή'}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        <div
          className={`relative aspect-[16/9] w-full rounded-2xl overflow-hidden border transition ${
            dragOver ? 'border-sky-400 ring-4 ring-sky-400/20' : 'border-slate-200'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDropFile}
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              style={{ objectPosition: heroFocalCss(focal) }}
            />
          ) : (
            <div className="absolute inset-0 bg-slate-100 flex flex-col items-center justify-center text-slate-400 gap-2">
              <span className="material-symbols-outlined text-4xl opacity-40">add_photo_alternate</span>
              <span className="text-sm font-semibold">Σύρε εικόνα εδώ</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-slate-900/45 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-slate-900/20 pointer-events-none" />

          <div className="absolute left-4 bottom-4 right-4 max-w-md pointer-events-none">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/70 mb-1.5">
              Προεπισκόπηση hero
            </p>
            <p className="text-white font-bold text-lg sm:text-xl leading-snug tracking-tight drop-shadow">
              {heroTitle || 'Ο τίτλος σου εδώ'}
              {heroAccent ? (
                <>
                  {' '}
                  <span className="text-sky-300">{heroAccent}</span>
                </>
              ) : null}
            </p>
          </div>

          {dragOver ? (
            <div className="absolute inset-0 bg-sky-500/25 backdrop-blur-[1px] flex items-center justify-center">
              <span className="rounded-full bg-white text-sky-700 px-4 py-2 text-sm font-bold shadow-lg">
                Άφησε για ανέβασμα
              </span>
            </div>
          ) : null}

          {uploading ? (
            <div className="absolute inset-0 bg-slate-950/50 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-lg">
                <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                Συμπίεση & ανέβασμα…
              </span>
            </div>
          ) : null}

          {previewUrl ? (
            <button
              type="button"
              onClick={() => setLightbox(true)}
              className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/45 text-white text-xs font-bold px-3 py-1.5 backdrop-blur-md hover:bg-black/60"
            >
              <span className="material-symbols-outlined text-[16px]">zoom_in</span>
              Μεγέθυνση
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold cursor-pointer hover:bg-slate-800">
            <span className="material-symbols-outlined text-[18px]">upload</span>
            {hasCustom ? 'Αλλαγή αρχείου' : 'Ανέβασμα'}
            <input
              type="file"
              accept={TRIP_COVER_ACCEPT}
              className="hidden"
              disabled={uploading}
              onChange={onUpload}
            />
          </label>
          {previewUrl ? (
            <>
              <button
                type="button"
                onClick={copyUrl}
                className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                Αντιγραφή URL
              </button>
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Άνοιγμα
              </a>
            </>
          ) : null}
          {hasCustom ? (
            <button
              type="button"
              onClick={onClear}
              disabled={uploading}
              className="inline-flex items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[16px]">restart_alt</span>
              Επαναφορά προεπιλογής
            </button>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Σημείο εστίασης</p>
          <p className="text-xs text-slate-500 mb-3">Πού «κόβεται» η φωτογραφία στο hero σε κινητό / desktop.</p>
          <div className="flex flex-wrap gap-2">
            {HERO_FOCAL_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onFocalChange?.(opt.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  focal === opt.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_auto] gap-2 items-end">
          <label className="block text-sm min-w-0">
            <span className="font-bold text-slate-700 text-xs">URL εικόνας</span>
            <input
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              placeholder="https://… ή /images/…"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyUrl();
                }
              }}
            />
          </label>
          <button
            type="button"
            onClick={applyUrl}
            className="inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50"
          >
            Εφαρμογή URL
          </button>
        </div>

        <ul className="grid sm:grid-cols-3 gap-2 text-[11px] text-slate-500">
          <li className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
            <span className="font-bold text-slate-700 block">Drag & drop</span>
            Σύρε JPG / PNG / WebP πάνω στην προεπισκόπηση
          </li>
          <li className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
            <span className="font-bold text-slate-700 block">Paste</span>
            Ctrl/⌘+V με εικόνα στο clipboard
          </li>
          <li className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
            <span className="font-bold text-slate-700 block">Αυτόματη συμπίεση</span>
            Μεγάλα αρχεία γίνονται JPG πριν το save
          </li>
        </ul>
      </div>

      {lightbox && previewUrl ? (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Προεπισκόπηση hero"
          onClick={() => setLightbox(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 rounded-full bg-white/15 text-white p-2 hover:bg-white/25"
            aria-label="Κλείσιμο"
            onClick={() => setLightbox(false)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <img
            src={previewUrl}
            alt=""
            className="max-h-[85vh] max-w-[95vw] rounded-xl shadow-2xl object-contain"
            style={{ objectPosition: heroFocalCss(focal) }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}
    </div>
  );
}
