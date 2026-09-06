/** Build WebSocket URL from API base or current host (Vite proxy). */
export function buildWsUrl(path, query = {}) {
  const base = import.meta.env.VITE_API_BASE || '';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const params = new URLSearchParams();
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value == null || value === '') return;
    params.set(key, String(value));
  });
  const qs = params.toString();
  let withQuery = normalized;
  if (qs) {
    withQuery = normalized.includes('?') ? `${normalized}&${qs}` : `${normalized}?${qs}`;
  }
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return base.replace(/^http/, 'ws') + withQuery;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${withQuery}`;
}
