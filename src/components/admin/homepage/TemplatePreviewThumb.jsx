/** Mini wireframe previews for homepage template pickers. */

function ThumbFrame({ children, className = '' }) {
  return (
    <div
      className={`relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-black/[0.08] bg-slate-100 ${className}`}
    >
      {children}
    </div>
  );
}

function HeaderThumb({ id }) {
  if (id === 'solid_light') {
    return (
      <ThumbFrame className="bg-white">
        <div className="h-[22%] bg-white border-b border-slate-200 flex items-center px-2 gap-1">
          <div className="w-3 h-3 rounded bg-indigo-500" />
          <div className="h-1 flex-1 bg-slate-200 rounded" />
        </div>
        <div className="h-[78%] bg-slate-200" />
      </ThumbFrame>
    );
  }
  if (id === 'floating_pill') {
    return (
      <ThumbFrame>
        <div className="h-[78%] bg-slate-300" />
        <div className="absolute top-[12%] left-[10%] right-[10%] h-[18%] rounded-full bg-white shadow border flex items-center px-2 gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-500" />
          <div className="flex-1 h-1 bg-slate-200 rounded" />
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'gradient_bar') {
    return (
      <ThumbFrame>
        <div className="h-[20%] bg-gradient-to-r from-indigo-600 to-sky-500" />
        <div className="h-[80%] bg-slate-300" />
      </ThumbFrame>
    );
  }
  if (id === 'bordered_elegant') {
    return (
      <ThumbFrame className="bg-white">
        <div className="h-[18%] border-b-2 border-slate-300 flex items-center px-2">
          <div className="w-3 h-3 bg-slate-800 rounded-sm" />
        </div>
        <div className="h-[82%] bg-slate-100" />
      </ThumbFrame>
    );
  }
  if (id === 'transparent_minimal') {
    return (
      <ThumbFrame>
        <div className="h-full bg-gradient-to-b from-slate-400 to-slate-500" />
        <div className="absolute top-2 left-2 right-2 h-2 bg-white/30 rounded" />
      </ThumbFrame>
    );
  }
  return (
    <ThumbFrame>
      <div className="h-[20%] bg-slate-800/80 backdrop-blur flex items-center px-2 gap-1">
        <div className="w-2.5 h-2.5 rounded bg-sky-400" />
        <div className="flex-1" />
      </div>
      <div className="h-[80%] bg-slate-400" />
    </ThumbFrame>
  );
}

function HeroThumb({ id }) {
  if (id === 'split_left') {
    return (
      <ThumbFrame>
        <div className="absolute inset-0 grid grid-cols-2">
          <div className="bg-slate-800 p-2 flex flex-col justify-center gap-1">
            <div className="h-1.5 w-3/4 bg-white/80 rounded" />
            <div className="h-1 w-1/2 bg-white/50 rounded" />
            <div className="h-4 w-full bg-white/20 rounded mt-1" />
          </div>
          <div className="bg-slate-400" />
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'centered_compact') {
    return (
      <ThumbFrame>
        <div className="h-full bg-slate-500 flex flex-col items-center justify-center p-3 gap-1">
          <div className="h-1.5 w-2/3 bg-white/90 rounded" />
          <div className="h-1 w-1/2 bg-white/60 rounded" />
          <div className="h-5 w-4/5 bg-white/25 rounded mt-2" />
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'gradient_mesh') {
    return (
      <ThumbFrame className="bg-gradient-to-br from-indigo-700 via-violet-700 to-sky-700">
        <div className="p-3 pt-6">
          <div className="h-1.5 w-2/3 bg-white/90 rounded mb-1" />
          <div className="h-1 w-1/2 bg-white/60 rounded" />
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'card_inset') {
    return (
      <ThumbFrame className="bg-slate-200 p-2">
        <div className="h-full rounded-lg overflow-hidden bg-slate-500 relative">
          <div className="absolute bottom-2 left-2 right-2 h-6 bg-black/30 rounded" />
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'bottom_search') {
    return (
      <ThumbFrame>
        <div className="h-full bg-slate-400" />
        <div className="absolute bottom-2 left-2 right-2 space-y-1">
          <div className="h-1 w-1/2 bg-white/80 rounded" />
          <div className="h-5 bg-white/30 rounded" />
        </div>
      </ThumbFrame>
    );
  }
  return (
    <ThumbFrame>
      <div className="h-full bg-slate-400" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
      <div className="absolute left-3 top-1/3 w-1/2 space-y-1">
        <div className="h-1 w-full bg-white/90 rounded" />
        <div className="h-1 w-3/4 bg-white/60 rounded" />
        <div className="h-4 w-full bg-white/20 rounded mt-2" />
      </div>
    </ThumbFrame>
  );
}

function CardThumb({ id }) {
  if (id === 'soft_apple') {
    return (
      <ThumbFrame className="bg-[#f5f5f7] p-2 flex flex-col gap-1">
        <div className="h-[50%] bg-slate-300 rounded-lg" />
        <div className="h-1.5 w-3/4 bg-slate-400 rounded" />
        <div className="h-1 w-1/2 bg-slate-300 rounded" />
        <div className="mt-auto h-1.5 w-1/3 bg-sky-500 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'luxe_noir') {
    return (
      <ThumbFrame className="bg-slate-900 p-2 flex flex-col gap-1">
        <div className="h-[50%] bg-slate-700 rounded-lg" />
        <div className="h-1.5 w-2/3 bg-amber-300/80 rounded" />
        <div className="h-1 w-1/2 bg-white/30 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'spotlight') {
    return (
      <ThumbFrame>
        <div className="h-full bg-slate-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 to-transparent" />
        <div className="absolute top-2 right-2 h-4 w-8 bg-white rounded" />
        <div className="absolute bottom-2 left-2 right-2 h-1.5 bg-white/90 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'ticket_stub') {
    return (
      <ThumbFrame className="bg-white p-1.5">
        <div className="flex h-full border border-dashed border-slate-400 rounded overflow-hidden">
          <div className="w-[40%] bg-slate-300" />
          <div className="flex-1 p-1.5 flex flex-col justify-center gap-1">
            <div className="h-1 bg-slate-400 rounded" />
            <div className="h-1 w-2/3 bg-slate-300 rounded" />
          </div>
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'rent_premium' || id === 'rent_soft') {
    return (
      <ThumbFrame className="bg-white p-1.5 flex flex-col gap-1">
        <div className={`h-[55%] rounded-lg ${id === 'rent_soft' ? 'bg-slate-200' : 'bg-teal-200/80'}`} />
        <div className="h-1 bg-slate-300 rounded" />
        <div className="h-1 w-1/3 bg-teal-600 rounded-full mt-auto" />
      </ThumbFrame>
    );
  }
  if (id === 'rent_overlay') {
    return (
      <ThumbFrame>
        <div className="h-full bg-teal-700/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2 h-1 bg-white/90 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'rent_compact' || id === 'rent_spec') {
    return (
      <ThumbFrame className="bg-white p-2">
        <div className="flex gap-1.5 h-full">
          <div className="w-1/3 bg-slate-300 rounded" />
          <div className="flex-1 flex flex-col justify-center gap-1">
            <div className="h-1 w-full bg-slate-300 rounded" />
            <div className="h-1 w-2/3 bg-slate-200 rounded" />
            {id === 'rent_spec' ? <div className="h-1 w-1/2 bg-teal-400 rounded" /> : null}
          </div>
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'compact_horizontal') {
    return (
      <ThumbFrame className="bg-white p-2">
        <div className="flex gap-1.5 h-full">
          <div className="w-1/3 bg-slate-300 rounded" />
          <div className="flex-1 flex flex-col justify-center gap-1">
            <div className="h-1 w-full bg-slate-300 rounded" />
            <div className="h-1 w-2/3 bg-slate-200 rounded" />
          </div>
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'abroad_horizontal') {
    return (
      <ThumbFrame className="bg-slate-50 p-1.5">
        <div className="flex gap-1.5 h-full rounded-md overflow-hidden bg-white border border-sky-100">
          <div className="w-[38%] bg-gradient-to-br from-sky-300 to-slate-400" />
          <div className="flex-1 flex flex-col justify-center gap-1 pr-1">
            <div className="h-1 w-1/3 bg-sky-500 rounded" />
            <div className="h-1.5 w-full bg-slate-800 rounded" />
            <div className="h-1 w-2/3 bg-slate-300 rounded" />
            <div className="h-1 w-1/2 bg-sky-400 rounded mt-0.5" />
          </div>
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'image_overlay') {
    return (
      <ThumbFrame>
        <div className="h-full bg-slate-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute bottom-2 left-2 right-2 h-1 bg-white/90 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'destination_poster') {
    return (
      <ThumbFrame>
        <div className="h-full bg-gradient-to-br from-sky-600 via-slate-500 to-amber-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-end justify-between gap-1">
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="h-1.5 w-2/3 bg-white rounded" />
            <div className="h-1 w-1/2 bg-white/70 rounded" />
          </div>
          <div className="h-1 w-8 bg-white/85 rounded shrink-0" />
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'minimal_clean') {
    return (
      <ThumbFrame className="bg-white p-2 flex flex-col gap-1">
        <div className="h-[45%] bg-slate-200 rounded" />
        <div className="h-1 bg-slate-300 rounded" />
        <div className="h-1 w-2/3 bg-slate-200 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'magazine') {
    return (
      <ThumbFrame className="bg-white p-2 flex flex-col gap-1">
        <div className="h-[50%] bg-slate-300" />
        <div className="h-1.5 w-full bg-slate-800 rounded" />
        <div className="h-1 w-3/4 bg-slate-300 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'bordered_sharp') {
    return (
      <ThumbFrame className="bg-white border-2 border-slate-900 p-0">
        <div className="h-[50%] bg-slate-300 border-b-2 border-slate-900" />
        <div className="p-1.5 space-y-1">
          <div className="h-1 bg-slate-800 rounded-none" />
          <div className="h-1 w-2/3 bg-slate-300 rounded-none" />
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'glass_card') {
    return (
      <ThumbFrame className="bg-gradient-to-br from-violet-100 to-sky-100 p-2">
        <div className="h-full rounded-lg bg-white/50 backdrop-blur border border-white/60 p-1.5 flex flex-col gap-1">
          <div className="h-[45%] bg-slate-300/80 rounded" />
          <div className="h-1 bg-slate-400/60 rounded" />
        </div>
      </ThumbFrame>
    );
  }
  return (
    <ThumbFrame className="bg-white p-1.5 flex flex-col">
      <div className="h-[55%] bg-slate-300 rounded-lg mb-1" />
      <div className="h-1 bg-slate-300 rounded" />
      <div className="h-1 w-2/3 bg-slate-200 rounded mt-0.5" />
      <div className="mt-auto h-2 w-1/3 bg-indigo-500 rounded-full" />
    </ThumbFrame>
  );
}

function LayoutThumb({ id }) {
  if (id === 'grid_two_large' || id === 'rent_grid_two') {
    return (
      <ThumbFrame className="bg-white p-2 grid grid-cols-2 gap-1">
        <div className="bg-slate-200 rounded" />
        <div className="bg-slate-200 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'featured_plus_grid' || id === 'rent_featured') {
    return (
      <ThumbFrame className="bg-white p-2 grid grid-cols-3 gap-1">
        <div className="col-span-2 bg-slate-300 rounded" />
        <div className="bg-slate-200 rounded" />
        <div className="bg-slate-200 rounded" />
        <div className="bg-slate-200 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'bento_showcase') {
    return (
      <ThumbFrame className="bg-white p-2 grid grid-cols-3 grid-rows-2 gap-1">
        <div className="col-span-2 row-span-2 bg-slate-300 rounded" />
        <div className="bg-slate-200 rounded" />
        <div className="bg-slate-250 bg-slate-200 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'destination_bento') {
    return (
      <ThumbFrame className="bg-[#f5f5f7] p-1.5 grid grid-cols-6 grid-rows-2 gap-1">
        <div className="col-span-2 rounded bg-gradient-to-br from-slate-400 to-slate-600" />
        <div className="col-span-2 rounded bg-gradient-to-br from-sky-400 to-sky-700" />
        <div className="col-span-2 rounded bg-gradient-to-br from-amber-400 to-rose-600" />
        <div className="col-span-3 rounded bg-gradient-to-br from-emerald-500 to-teal-800" />
        <div className="col-span-3 rounded bg-gradient-to-br from-violet-400 to-indigo-700" />
      </ThumbFrame>
    );
  }
  if (id === 'grid_four') {
    return (
      <ThumbFrame className="bg-white p-2 grid grid-cols-4 gap-1">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="bg-slate-200 rounded aspect-square" />
        ))}
      </ThumbFrame>
    );
  }
  if (id === 'editorial_stack') {
    return (
      <ThumbFrame className="bg-white p-2 flex flex-col gap-1 items-stretch">
        <div className="flex-1 bg-slate-300 rounded" />
        <div className="flex-1 bg-slate-200 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'rent_list') {
    return (
      <ThumbFrame className="bg-white p-2 flex flex-col gap-1">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex gap-1 h-[28%]">
            <div className="w-1/4 bg-teal-200 rounded" />
            <div className="flex-1 bg-slate-100 rounded" />
          </div>
        ))}
      </ThumbFrame>
    );
  }
  if (id === 'horizontal_scroll' || id === 'rent_scroll') {
    return (
      <ThumbFrame className="bg-white p-2 flex gap-1 overflow-hidden">
        {[1, 2, 3].map((n) => (
          <div key={n} className="shrink-0 w-[38%] h-full bg-slate-200 rounded" />
        ))}
      </ThumbFrame>
    );
  }
  if (id === 'alternating_rows') {
    return (
      <ThumbFrame className="bg-white p-2 flex flex-col gap-1">
        <div className="flex gap-1 flex-1">
          <div className="w-1/2 bg-slate-300 rounded" />
          <div className="w-1/2 flex flex-col justify-center gap-0.5 p-1">
            <div className="h-1 bg-slate-300 rounded" />
            <div className="h-1 w-2/3 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="flex gap-1 flex-1 flex-row-reverse">
          <div className="w-1/2 bg-slate-300 rounded" />
          <div className="w-1/2 bg-slate-100 rounded" />
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'compact_list') {
    return (
      <ThumbFrame className="bg-white p-2 flex flex-col gap-1">
        {[1, 2, 3].map((n) => (
          <div key={n} className="flex gap-1 h-[28%]">
            <div className="w-1/4 bg-slate-300 rounded" />
            <div className="flex-1 bg-slate-100 rounded" />
          </div>
        ))}
      </ThumbFrame>
    );
  }
  if (id === 'masonry_two') {
    return (
      <ThumbFrame className="bg-white p-2 grid grid-cols-2 gap-1">
        <div className="bg-slate-200 rounded h-[60%]" />
        <div className="bg-slate-300 rounded h-[80%]" />
        <div className="bg-slate-300 rounded h-[70%] -mt-4" />
        <div className="bg-slate-200 rounded h-[50%]" />
      </ThumbFrame>
    );
  }
  return (
    <ThumbFrame className="bg-white p-2 grid grid-cols-3 gap-1">
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <div key={n} className="bg-slate-200 rounded" />
      ))}
    </ThumbFrame>
  );
}

function FooterThumb({ id }) {
  if (id === 'minimal_center') {
    return (
      <ThumbFrame className="bg-slate-50 flex flex-col items-center justify-center gap-1 p-2">
        <div className="h-1.5 w-1/3 bg-slate-400 rounded" />
        <div className="flex gap-1">
          <div className="h-1 w-6 bg-slate-300 rounded" />
          <div className="h-1 w-6 bg-slate-300 rounded" />
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'dark_band') {
    return (
      <ThumbFrame className="bg-slate-900 flex items-end p-2">
        <div className="w-1/2 space-y-1">
          <div className="h-1 w-2/3 bg-white/80 rounded" />
          <div className="h-1 w-1/2 bg-white/40 rounded" />
        </div>
      </ThumbFrame>
    );
  }
  if (id === 'newsletter_cta') {
    return (
      <ThumbFrame className="bg-slate-100 p-2 flex flex-col justify-end gap-1">
        <div className="h-[40%] bg-slate-800 rounded-lg" />
        <div className="h-1 w-1/3 bg-slate-400 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'compact_inline') {
    return (
      <ThumbFrame className="bg-slate-100 flex items-center px-2">
        <div className="h-1 flex-1 bg-slate-300 rounded" />
      </ThumbFrame>
    );
  }
  if (id === 'split_contact') {
    return (
      <ThumbFrame className="bg-white p-2 grid grid-cols-3 gap-1 items-end">
        <div className="h-1 bg-slate-400 rounded" />
        <div className="h-3 bg-slate-200 rounded" />
        <div className="h-1 bg-slate-300 rounded" />
      </ThumbFrame>
    );
  }
  return (
    <ThumbFrame className="bg-slate-50 p-2 flex flex-col justify-end">
      <div className="grid grid-cols-3 gap-1 items-end">
        <div className="col-span-1 space-y-1">
          <div className="h-1.5 w-full bg-slate-400 rounded" />
          <div className="h-1 w-2/3 bg-slate-300 rounded" />
        </div>
        <div className="col-span-2 flex justify-end gap-1">
          <div className="h-1 w-5 bg-slate-300 rounded" />
          <div className="h-1 w-5 bg-slate-300 rounded" />
        </div>
      </div>
    </ThumbFrame>
  );
}

export default function TemplatePreviewThumb({ category, templateId }) {
  switch (category) {
    case 'header':
      return <HeaderThumb id={templateId} />;
    case 'hero':
      return <HeroThumb id={templateId} />;
    case 'trip_card':
    case 'rent_fleet_card':
      return <CardThumb id={templateId} />;
    case 'trips_layout':
    case 'rent_fleet_layout':
      return <LayoutThumb id={templateId} />;
    case 'footer':
      return <FooterThumb id={templateId} />;
    default:
      return <ThumbFrame />;
  }
}
