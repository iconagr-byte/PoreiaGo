/**
 * Touch/mouse signature pad for rental check-in / check-out.
 */
import { useEffect, useRef, useState } from 'react';

export default function RentalSignaturePad({
  previewUrl = null,
  onCommit,
  onClear,
  disabled = false,
  busy = false,
}) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

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
      setHasInk(false);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
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
    setHasInk(true);
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
    setHasInk(false);
    onClear?.();
  };

  const commit = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' });
        onCommit?.(file);
      },
      'image/png',
      0.92,
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-gray-500">Υπογραφή πελάτη</span>
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
          <img src={previewUrl} alt="Υπογραφή" className="h-24 w-full object-contain" />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          className="h-28 w-full touch-none rounded-xl border border-dashed border-black/20 bg-[#fafafa] cursor-crosshair"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      )}
      {!previewUrl ? (
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
}
