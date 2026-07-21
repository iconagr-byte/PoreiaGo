/**
 * Drivers hub — Apple-like layout: accounts first, QR/PWA tools collapsed.
 */
import { useState } from 'react';
import DriversManagementPanel from './DriversManagementPanel.jsx';
import MasterQrPanel from './MasterQrPanel.jsx';
import BusPwaInstallGuide from './BusPwaInstallGuide.jsx';

export default function DriversHub({ showPageHeader = true }) {
  const [toolsOpen, setToolsOpen] = useState(false);

  return (
    <div className="drivers-hub relative space-y-8 pb-10 animate-in fade-in duration-500">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-6 h-56 -z-10 bg-[radial-gradient(ellipse_at_top,_rgba(24,24,27,0.06),_transparent_65%)]"
      />

      {showPageHeader ? (
        <header className="space-y-1.5 pt-1">
          <h2 className="text-[28px] sm:text-[34px] font-semibold tracking-tight text-zinc-900 leading-none">
            Οδηγοί
          </h2>
          <p className="text-[15px] text-zinc-500 tracking-tight max-w-xl leading-relaxed">
            Λογαριασμοί εφαρμογής λεωφορείου και εργαλεία βάρδιας.
          </p>
        </header>
      ) : null}

      <DriversManagementPanel />

      <section className="space-y-4">
        <button
          type="button"
          onClick={() => setToolsOpen((v) => !v)}
          aria-expanded={toolsOpen}
          className="w-full flex items-center justify-between gap-3 rounded-[20px] bg-zinc-100/70 hover:bg-zinc-100 px-5 py-4 text-left transition-colors border border-black/[0.03]"
        >
          <div className="min-w-0 flex items-start gap-3">
            <span className="mt-0.5 w-9 h-9 rounded-[11px] bg-white border border-black/[0.05] flex items-center justify-center shrink-0 text-zinc-700">
              <span className="material-symbols-outlined text-[18px]">qr_code_2</span>
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-zinc-900 tracking-tight">
                Εργαλεία ταμπλό &amp; εγκατάσταση
              </p>
              <p className="text-[13px] text-zinc-500 mt-0.5 tracking-tight">
                Master QR και οδηγίες PWA για το κινητό του λεωφορείου
              </p>
            </div>
          </div>
          <span
            className={`material-symbols-outlined text-zinc-400 transition-transform duration-200 ${
              toolsOpen ? 'rotate-180' : ''
            }`}
          >
            expand_more
          </span>
        </button>

        {toolsOpen ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 animate-in fade-in slide-in-from-top-2 duration-300">
            <MasterQrPanel compact />
            <BusPwaInstallGuide />
          </div>
        ) : null}
      </section>
    </div>
  );
}
