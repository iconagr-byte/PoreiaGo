import { useRef, useCallback, useEffect } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Minus,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';

const TOOLBAR = [
  { cmd: 'undo', icon: Undo2, title: 'Αναίρεση', action: 'undo' },
  { cmd: 'redo', icon: Redo2, title: 'Επανάληψη', action: 'redo' },
  { divider: true },
  { cmd: 'bold', icon: Bold, title: 'Bold' },
  { cmd: 'italic', icon: Italic, title: 'Italic' },
  { cmd: 'underline', icon: Underline, title: 'Underline' },
  { cmd: 'strikeThrough', icon: Strikethrough, title: 'Διαγράμμιση' },
  { divider: true },
  { cmd: 'formatBlock', arg: 'h2', label: 'H2', title: 'Τίτλος H2' },
  { cmd: 'formatBlock', arg: 'h3', label: 'H3', title: 'Τίτλος H3' },
  { cmd: 'formatBlock', arg: 'p', label: 'P', title: 'Παράγραφος' },
  { divider: true },
  { cmd: 'insertUnorderedList', icon: List, title: 'Λίστα' },
  { cmd: 'insertOrderedList', icon: ListOrdered, title: 'Αριθμημένη' },
  { divider: true },
  { cmd: 'justifyLeft', icon: AlignLeft, title: 'Αριστερά' },
  { cmd: 'justifyCenter', icon: AlignCenter, title: 'Κέντρο' },
  { cmd: 'justifyRight', icon: AlignRight, title: 'Δεξιά' },
  { divider: true },
  { cmd: 'insertHorizontalRule', icon: Minus, title: 'Γραμμή' },
];

const COLORS = ['#0f172a', '#4f46e5', '#059669', '#dc2626', '#64748b'];

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Γράψτε το μήνυμά σας…',
  minHeight = 280,
  variant = 'default',
}) {
  const ref = useRef(null);

  const sync = useCallback(() => {
    onChange(ref.current?.innerHTML ?? '');
  }, [onChange]);

  const exec = useCallback(
    (command, arg) => {
      ref.current?.focus();
      if (command === 'undo') {
        document.execCommand('undo');
      } else if (command === 'redo') {
        document.execCommand('redo');
      } else {
        document.execCommand(command, false, arg ?? null);
      }
      sync();
    },
    [sync],
  );

  const insertLink = () => {
    const url = window.prompt('URL συνδέσμου:');
    if (url) exec('createLink', url);
  };

  const applyColor = (color) => {
    exec('foreColor', color);
  };

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const isMail = variant === 'mail';

  return (
    <div
      className={`flex flex-col min-h-0 flex-1 border border-[#e2e8f0] rounded-xl overflow-hidden bg-white ${
        isMail ? 'shadow-sm' : 'bg-surface border-outline-variant'
      }`}
    >
      <div
        className={`flex flex-wrap items-center gap-0.5 p-2 border-b shrink-0 ${
          isMail ? 'border-[#e2e8f0] bg-[#fafbfc]' : 'border-outline-variant bg-surface-container-low'
        }`}
      >
        {TOOLBAR.map((t, i) => {
          if (t.divider) {
            return <span key={`d-${i}`} className="w-px h-6 bg-[#e2e8f0] mx-0.5" />;
          }
          const Icon = t.icon;
          return (
            <button
              key={t.cmd + (t.arg || '') + i}
              type="button"
              title={t.title}
              onMouseDown={(e) => {
                e.preventDefault();
                exec(t.cmd, t.arg);
              }}
              className="w-8 h-8 rounded-md flex items-center justify-center text-[#475569] hover:bg-[#eef2ff] hover:text-[#4f46e5]"
            >
              {Icon ? <Icon size={16} strokeWidth={2} /> : (
                <span className="text-xs font-bold">{t.label}</span>
              )}
            </button>
          );
        })}
        <button
          type="button"
          title="Σύνδεσμος"
          onMouseDown={(e) => {
            e.preventDefault();
            insertLink();
          }}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[#475569] hover:bg-[#eef2ff]"
        >
          <Link2 size={16} />
        </button>
        <span className="w-px h-6 bg-[#e2e8f0] mx-1" />
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={`Χρώμα ${c}`}
            onMouseDown={(e) => {
              e.preventDefault();
              applyColor(c);
            }}
            className="w-5 h-5 rounded-full border border-[#e2e8f0] shrink-0"
            style={{ backgroundColor: c }}
          />
        ))}
        <button
          type="button"
          title="Καθαρισμός μορφοποίησης"
          onMouseDown={(e) => {
            e.preventDefault();
            exec('removeFormat');
          }}
          className="ml-1 px-2 h-8 rounded-md text-[10px] font-bold text-[#64748b] hover:bg-[#f1f5f9]"
        >
          Clear
        </button>
      </div>
      <div
        ref={ref}
        contentEditable
        role="textbox"
        aria-label={placeholder}
        className={`flex-1 overflow-y-auto p-4 outline-none text-[15px] leading-relaxed text-[#334155] prose prose-sm max-w-none ${
          isMail ? '' : 'text-on-surface'
        }`}
        style={{ minHeight }}
        onInput={sync}
        suppressContentEditableWarning
        data-placeholder={placeholder}
      />
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #94a3b8;
          pointer-events: none;
        }
      `}</style>
    </div>
  );
}
