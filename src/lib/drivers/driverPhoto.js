const MAX_BYTES = 450_000;
const MAX_EDGE = 512;
const JPEG_QUALITY = 0.84;

/**
 * Compress a driver headshot to a JPEG data URL for storage on create/update.
 * Avoids the separate multipart upload endpoint (which can fail with Invalid token
 * when the office session JWT is rejected on FormData POSTs).
 */
export function fileToDriverPhotoDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Επιτρέπονται μόνο εικόνες (JPG, PNG, WebP)'));
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      reject(new Error('Η εικόνα είναι πολύ μεγάλη (μέγ. 4 MB)'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Αποτυχία ανάγνωσης'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Μη έγκυρη εικόνα'));
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_EDGE / Math.max(img.width || 1, img.height || 1));
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
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          let quality = JPEG_QUALITY;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > MAX_BYTES && quality > 0.45) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          if (dataUrl.length > MAX_BYTES) {
            reject(new Error('Η φωτογραφία είναι πολύ μεγάλη μετά τη συμπίεση'));
            return;
          }
          resolve(dataUrl);
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Αποτυχία συμπίεσης'));
        }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
