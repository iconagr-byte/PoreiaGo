const AVATAR_PALETTE = [
  'bg-violet-100 text-violet-700 ring-violet-200/60',
  'bg-sky-100 text-sky-700 ring-sky-200/60',
  'bg-emerald-100 text-emerald-700 ring-emerald-200/60',
  'bg-amber-100 text-amber-800 ring-amber-200/60',
  'bg-rose-100 text-rose-700 ring-rose-200/60',
  'bg-indigo-100 text-indigo-700 ring-indigo-200/60',
  'bg-teal-100 text-teal-700 ring-teal-200/60',
  'bg-orange-100 text-orange-800 ring-orange-200/60',
];

export function avatarColorClass(seed = '') {
  const s = String(seed);
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash + s.charCodeAt(i) * (i + 1)) % AVATAR_PALETTE.length;
  }
  return AVATAR_PALETTE[hash];
}
