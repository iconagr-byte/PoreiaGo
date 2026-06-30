export const API_BASE = import.meta.env.VITE_API_BASE || '';
export const DRIVER_API_KEY =
  import.meta.env.VITE_DRIVER_API_KEY || 'dev-driver-key';

export function driverAuthHeaders() {
  const key = localStorage.getItem('driverApiKey') || DRIVER_API_KEY;
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}
