/** Build WebSocket URL from API base or current host (Vite proxy). */
export function buildWsUrl(path) {
  const base = import.meta.env.VITE_API_BASE || '';
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (base.startsWith('http://') || base.startsWith('https://')) {
    return base.replace(/^http/, 'ws') + normalized;
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}${normalized}`;
}
