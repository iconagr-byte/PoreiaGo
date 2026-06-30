/** Συνημμένα email — client helpers */

export const MAX_ATTACH_FILES = 10;
export const MAX_FILE_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Αποτυχία ανάγνωσης αρχείου'));
        return;
      }
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Δεν διαβάστηκε: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export async function fileToAttachment(file) {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`Το «${file.name}» υπερβαίνει τα 8 MB`);
  }
  const data_base64 = await readFileAsBase64(file);
  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filename: file.name,
    content_type: file.type || 'application/octet-stream',
    data_base64,
    size: file.size,
  };
}

export function validateAttachmentList(list) {
  if (list.length > MAX_ATTACH_FILES) {
    throw new Error(`Μέγιστο ${MAX_ATTACH_FILES} συνημμένα`);
  }
  const total = list.reduce((s, a) => s + (a.size || 0), 0);
  if (total > MAX_TOTAL_BYTES) {
    throw new Error('Το συνολικό μέγεθος υπερβαίνει τα 20 MB');
  }
}

export function attachmentsForApi(list) {
  return list.map(({ filename, content_type, data_base64 }) => ({
    filename,
    content_type,
    data_base64,
  }));
}

export async function filesToAttachments(fileList, existing = []) {
  const next = [...existing];
  for (const file of fileList) {
    const att = await fileToAttachment(file);
    next.push(att);
    validateAttachmentList(next);
  }
  return next;
}
