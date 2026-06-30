import { useRef } from 'react';
import { Upload } from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

function Field({ label, hint, children }) {
  return (
    <div className="emh-field">
      <span className="emh-field-label">{label}</span>
      {children}
      {hint ? <span className="emh-field-hint">{hint}</span> : null}
    </div>
  );
}

export default function ImageUploadField({ label, url, alt, onUrlChange, onAltChange, urlPlaceholder }) {
  const inputRef = useRef(null);

  const pickFile = () => inputRef.current?.click();

  const handleFiles = (fileList) => {
    const file = fileList?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Επιλέξτε αρχείο εικόνας (JPG, PNG, WebP…)');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Η εικόνα υπερβαίνει τα 3 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUrlChange(reader.result);
        if (!alt?.trim() && file.name) onAltChange?.(file.name.replace(/\.[^.]+$/, ''));
        toast.success('Η εικόνα ανέβηκε');
      }
    };
    reader.onerror = () => toast.error('Αποτυχία ανάγνωσης εικόνας');
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div
        className="emh-image-upload-zone"
        role="button"
        tabIndex={0}
        title="Κλικ για ανέβασμα εικόνας"
        onClick={pickFile}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            pickFile();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.classList.add('emh-image-upload-zone-active');
        }}
        onDragLeave={(e) => {
          e.currentTarget.classList.remove('emh-image-upload-zone-active');
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.classList.remove('emh-image-upload-zone-active');
          handleFiles(e.dataTransfer.files);
        }}
      >
        {url ? (
          <img src={url} alt={alt || ''} className="emh-image-upload-preview" />
        ) : (
          <>
            <Upload size={20} className="text-[#6366f1]" />
            <span className="emh-image-upload-label">Κλικ ή σύρετε εικόνα</span>
            <span className="emh-image-upload-hint">έως 3 MB</span>
          </>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <Field label={label || 'URL εικόνας'} hint="Ανέβασμα από αρχείο ή επικόλληση URL">
        <input
          className="emh-input mb-0"
          placeholder={urlPlaceholder || 'https://…'}
          value={url || ''}
          onChange={(e) => onUrlChange(e.target.value)}
        />
      </Field>
      {onAltChange ? (
        <Field label="Alt text">
          <input
            className="emh-input mb-0"
            value={alt || ''}
            onChange={(e) => onAltChange(e.target.value)}
          />
        </Field>
      ) : null}
    </>
  );
}
