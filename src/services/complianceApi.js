import { saasFetch } from './saasApi.js';

export async function fetchAuditLogs({ offset = 0, limit = 50, resourceType, action } = {}) {
  const q = new URLSearchParams({ offset: String(offset), limit: String(limit) });
  if (resourceType) q.set('resource_type', resourceType);
  if (action) q.set('action', action);
  return saasFetch(`/api/v1/compliance/audit?${q}`);
}

export async function gdprExportSubject(subjectEmail) {
  return saasFetch('/api/v1/compliance/gdpr/export', {
    method: 'POST',
    body: JSON.stringify({ subject_email: subjectEmail.trim() }),
  });
}

export async function gdprEraseSubject(subjectEmail) {
  return saasFetch('/api/v1/compliance/gdpr/erase', {
    method: 'POST',
    body: JSON.stringify({ subject_email: subjectEmail.trim() }),
  });
}

export function downloadJsonExport(data, filename = 'gdpr-export.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
