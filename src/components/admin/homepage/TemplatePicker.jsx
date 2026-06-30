import TemplatePreviewThumb from './TemplatePreviewThumb.jsx';

export default function TemplatePicker({
  category,
  templates,
  value,
  onChange,
  columns = 3,
}) {
  const colClass =
    columns === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : columns === 4
        ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={`grid ${colClass} gap-4`}>
      {templates.map((tpl) => {
        const selected = value === tpl.id;
        return (
          <button
            key={tpl.id}
            type="button"
            onClick={() => onChange(tpl.id)}
            className={`group text-left rounded-2xl border-2 p-4 transition-all hover:shadow-lg ${
              selected
                ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                : 'border-black/[0.06] bg-white hover:border-primary/30'
            }`}
          >
            <TemplatePreviewThumb category={category} templateId={tpl.id} />
            <div className="mt-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-sm text-gray-900 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-primary">{tpl.icon}</span>
                  {tpl.label}
                </p>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{tpl.description}</p>
              </div>
              {selected && (
                <span className="material-symbols-outlined text-primary text-[22px] shrink-0">check_circle</span>
              )}
            </div>
            {tpl.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tpl.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
