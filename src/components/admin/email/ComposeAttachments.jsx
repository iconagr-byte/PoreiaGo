import { useRef, useState } from 'react';
import { File, Paperclip, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  filesToAttachments,
  formatFileSize,
  MAX_ATTACH_FILES,
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
} from '../../../lib/email/attachments.js';

export default function ComposeAttachments({ attachments, onChange }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = async (fileList) => {
    if (!fileList?.length) return;
    try {
      const updated = await filesToAttachments(Array.from(fileList), attachments);
      onChange(updated);
      toast.success(
        fileList.length === 1 ? 'Προστέθηκε 1 συνημμένο' : `Προστέθηκαν ${fileList.length} συνημμένα`,
      );
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = (id) => {
    onChange(attachments.filter((a) => a.id !== id));
  };

  const totalSize = attachments.reduce((s, a) => s + (a.size || 0), 0);

  const openPicker = () => inputRef.current?.click();

  return (
    <div className="emc-attachments">
      <p className="emc-section-title flex items-center gap-1">
        <Paperclip size={12} />
        Συνημμένα
      </p>

      <div
        className={`emc-attach-drop ${dragOver ? 'emc-attach-drop-active' : ''}`}
        role="button"
        tabIndex={0}
        title="Κλικ για ανέβασμα αρχείων"
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          addFiles(e.dataTransfer.files);
        }}
      >
        <Upload size={18} className="text-[#6366f1] mb-1" />
        <p className="text-xs font-semibold text-[#475569]">Σύρετε αρχεία εδώ</p>
        <p className="text-[10px] text-[#94a3b8] mt-0.5">
          κλικ ή σύρετε · έως {MAX_ATTACH_FILES} αρχεία · 8 MB/αρχείο
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {attachments.length > 0 && (
        <ul className="emc-attach-list">
          {attachments.map((a) => (
            <li key={a.id} className="emc-attach-item">
              <File size={14} className="shrink-0 text-[#6366f1]" />
              <span className="emc-attach-name" title={a.filename}>
                {a.filename}
              </span>
              <span className="emc-attach-size">{formatFileSize(a.size)}</span>
              <button
                type="button"
                className="emc-attach-remove"
                onClick={() => remove(a.id)}
                aria-label={`Αφαίρεση ${a.filename}`}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {attachments.length > 0 && (
        <p className="text-[10px] text-[#64748b] mt-1">
          {attachments.length}/{MAX_ATTACH_FILES} · {formatFileSize(totalSize)} /{' '}
          {formatFileSize(MAX_TOTAL_BYTES)}
        </p>
      )}
    </div>
  );
}
