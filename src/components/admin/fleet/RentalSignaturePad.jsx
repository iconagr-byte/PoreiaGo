/**
 * Touch/mouse signature pad for rental check-in / check-out / tablet checkout.
 */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const RentalSignaturePad = forwardRef(function RentalSignaturePad(
  {
    previewUrl = null,
    onCommit,
    onClear,
    onInkChange,
    disabled = false,
    busy = false,
    /** Hide the built-in commit button — parent collects via ref.getFile(). */
    embedded = false,
    watermark = 'Υπογράψτε εδώ...',
    heightClass = 'h-28',
    label = 'Υπογραφή πελάτη',
  },
  ref,
) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  const setInk = (value) => {
    setHasInk(value);
    onInkChange?.(value);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || previewUrl) return undefined;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nextW = Math.max(1, Math.round(rect.width * dpr));
      const nextH = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width === nextW && canvas.height === nextH) return;
      canvas.width = nextW;
      canvas.height = nextH;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 2.25;
      setInk(false);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/resize only
  }, [previewUrl]);

  const pointFromEvent = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches?.[0] || e.changedTouches?.[0] || e;
    return {
      x: src.clientX - rect.left,
      y: src.clientY - rect.top,
    };
  };

  const start = (e) => {
    if (disabled || previewUrl) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const p = pointFromEvent(e);
    if (!ctx || !p) return;
    drawing.current = true;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e) => {
    if (!drawing.current || disabled || previewUrl) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const p = pointFromEvent(e);
    if (!ctx || !p) return;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setInk(true);
  };

  const end = (e) => {
    if (!drawing.current) return;
    e?.preventDefault?.();
    drawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    setInk(false);
    onClear?.();
  };

  const toFile = () =>
    new Promise((resolve) => {
      const canvas = canvasRef.current;
      if (!canvas || !hasInk) {
        resolve(null);
        return;
      }
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(null);
            return;
          }
          resolve(new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' }));
        },
        'image/png',
        0.92,
      );
    });

  useImperativeHandle(ref, () => ({
    clear: clearCanvas,
    hasInk: () => hasInk,
    getFile: toFile,
  }));

  const commit = async () => {
    const file = await toFile();
    if (file) onCommit?.(file);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-gray-500">{label}</span>
        <button
          type="button"
          onClick={clearCanvas}
          disabled={disabled || busy || (!hasInk && !previewUrl)}
          className="text-xs font-bold text-rose-600 disabled:opacity-40"
        >
          Καθαρισμός
        </button>
      </div>
      {previewUrl ? (
        <div className="rounded-xl border bg-white p-2">
          <img src={previewUrl} alt="Υπογραφή" className={`${heightClass} w-full object-contain`} />
        </div>
      ) : (
        <div className="relative">
          {!hasInk ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-300 select-none">
              {watermark}
            </span>
          ) : null}
          <canvas
            ref={canvasRef}
            className={`${heightClass} w-full touch-none rounded-xl border border-slate-300 bg-white cursor-crosshair`}
            onMouseDown={start}
            onMouseMove={move}
            onMouseUp={end}
            onMouseLeave={end}
            onTouchStart={start}
            onTouchMove={move}
            onTouchEnd={end}
          />
        </div>
      )}
      {!previewUrl && !embedded ? (
        <button
          type="button"
          disabled={disabled || busy || !hasInk}
          onClick={commit}
          className="w-full py-2 rounded-xl border text-sm font-bold disabled:opacity-40"
        >
          {busy ? 'Ανέβασμα…' : 'Αποθήκευση υπογραφής'}
        </button>
      ) : null}
    </div>
  );
});

export default RentalSignaturePad;
