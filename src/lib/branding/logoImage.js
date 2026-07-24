const MAX_BYTES = 700_000;
const MAX_EDGE = 640;

/**
 * Compress a logo for storage in site appearance (data URL).
 * Keeps PNG when the source has transparency; otherwise JPEG.
 */
export function fileToLogoDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Μόνο αρχεία εικόνας'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Αποτυχία ανάγνωσης'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Μη έγκυρη εικόνα'));
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }
          ctx.clearRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);

          const preferPng =
            file.type === 'image/png' ||
            file.type === 'image/webp' ||
            file.type === 'image/gif';

          if (preferPng) {
            const png = canvas.toDataURL('image/png');
            if (png.length <= MAX_BYTES) {
              resolve(png);
              return;
            }
          }

          let quality = 0.9;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > MAX_BYTES && quality > 0.5) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          if (dataUrl.length > MAX_BYTES) {
            reject(new Error('Το λογότυπο είναι πολύ μεγάλο μετά τη συμπίεση'));
            return;
          }
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
