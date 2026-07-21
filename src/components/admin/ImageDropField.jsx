import { useCallback, useRef, useState } from 'react';
import { resolveSiteAssetUrl } from '../../services/siteAppearanceApi.js';

const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';

/**
 * Drag-and-drop / click upload for a single image. Stores the resulting URL via onChange.
 */
export default function ImageDropField({
  label = 'Φωτογραφία',
  hint = 'Σύρετε εικόνα εδώ ή πατήστε για επιλογή',
  value = '',
  onChange,
  onUpload,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const preview = value ? resolveSiteAssetUrl(value) : '';

  const handleFile = useCallback(
    async (file) => {
      if (!file || disabled) return;
      if (!file.type.startsWith('image/')) {
        setError('Επιτρέπονται μόνο εικόνες (JPG, PNG, WebP)');
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        setError('Μέγιστο μέγεθος 4 MB');
        return;
      }
      setError('');
      setUploading(true);
      try {
        const result = await onUpload(file);
        const url = result?.url || result;
        if (!url || typeof url !== 'string') {
          throw new Error('Δεν επιστράφηκε URL');
        }
        onChange?.(url);
      } catch (err) {
        setError(err.message || 'Αποτυχία ανεβάσματος');
      } finally {
        setUploading(false);
      }
    },
    [disabled, onChange, onUpload],
  );

  const onInputChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    handleFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    handleFile(file);
  };

  return (
    <div className="space-y-2">
      {label ? <div className="text-sm font-bold text-gray-800">{label}</div> : null}

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => !disabled && !uploading && inputRef.current?.click()}
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setDragging(false);
        }}
        onDrop={onDrop}
        className={`relative rounded-2xl border-2 border-dashed p-4 transition-colors cursor-pointer select-none ${
          dragging
            ? 'border-sky-400 bg-sky-50'
            : 'border-gray-200 bg-white hover:border-sky-300 hover:bg-sky-50/40'
        } ${disabled || uploading ? 'opacity-70 pointer-events-none' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={disabled || uploading}
          onChange={onInputChange}
        />

        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-gray-100 border border-gray-100 shrink-0 flex items-center justify-center">
            {preview ? (
              <img src={preview} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-gray-300 text-[32px]">add_a_photo</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-800">
              {uploading ? 'Ανέβασμα…' : dragging ? 'Αφήστε την εικόνα' : hint}
            </p>
            <p className="text-xs text-gray-500 mt-1">JPG, PNG ή WebP · έως 4 MB</p>
            {preview ? (
              <button
                type="button"
                className="mt-2 text-xs font-bold text-rose-600 hover:text-rose-800"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange?.('');
                  setError('');
                }}
              >
                Αφαίρεση φωτογραφίας
              </button>
            ) : null}
          </div>
          {uploading ? (
            <span className="material-symbols-outlined animate-spin text-sky-600">progress_activity</span>
          ) : (
            <span className="material-symbols-outlined text-sky-600">upload</span>
          )}
        </div>
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
