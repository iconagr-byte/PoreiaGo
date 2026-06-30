import { useEffect, useMemo, useState } from 'react';
import { pushHomepagePreviewDraft } from '../../../lib/homepage/homepagePreview.js';

export default function HomepageLivePreview({ form, className = '' }) {
  const [iframeKey, setIframeKey] = useState(0);
  const [device, setDevice] = useState('desktop');
  const previewSrc = useMemo(() => `/storefront?preview=1&k=${iframeKey}`, [iframeKey]);

  useEffect(() => {
    if (!form) return;
    pushHomepagePreviewDraft(form);
    const t = setTimeout(() => setIframeKey((k) => k + 1), 300);
    return () => clearTimeout(t);
  }, [form]);

  const frameWidth = device === 'mobile' ? '375px' : device === 'tablet' ? '768px' : '100%';

  return (
    <div className={`rounded-[24px] border border-black/[0.08] bg-slate-900/95 overflow-hidden shadow-2xl ${className}`}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10 bg-slate-900">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-white/90">Live preview</span>
        </div>
        <div className="flex items-center gap-1 bg-white/10 rounded-full p-0.5">
          {[
            { id: 'mobile', icon: 'smartphone' },
            { id: 'tablet', icon: 'tablet' },
            { id: 'desktop', icon: 'desktop_windows' },
          ].map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDevice(d.id)}
              className={`p-1.5 rounded-full transition-colors ${
                device === d.id ? 'bg-white text-slate-900' : 'text-white/60 hover:text-white'
              }`}
              aria-label={d.id}
            >
              <span className="material-symbols-outlined text-[18px]">{d.icon}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIframeKey((k) => k + 1)}
          className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/10"
          title="Ανανέωση"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
        </button>
      </div>

      <div className="bg-slate-800 p-3 flex justify-center min-h-[420px] max-h-[min(72vh,640px)] overflow-auto">
        <div
          className="bg-white rounded-xl overflow-hidden shadow-2xl transition-all duration-300 h-[min(68vh,600px)]"
          style={{ width: frameWidth, maxWidth: '100%' }}
        >
          <iframe
            key={iframeKey}
            title="Προεπισκόπηση αρχικής"
            src={previewSrc}
            className="w-full h-full border-0"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      </div>

      <div className="px-4 py-2.5 border-t border-white/10 flex justify-between items-center">
        <span className="text-[10px] text-white/50">Αλλαγές εμφανίζονται αυτόματα</span>
        <a
          href="/storefront?preview=1"
          target="_blank"
          rel="noreferrer"
          className="text-[10px] font-bold text-sky-400 hover:text-sky-300 flex items-center gap-1"
        >
          Άνοιγμα σε νέο tab
          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
        </a>
      </div>
    </div>
  );
}
