const MAX_BYTES = 900_000;
const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.82;

/**
 * Resize & compress an image file for localStorage-backed trip covers.
 * Returns a JPEG data URL (or original data URL if already small enough).
 */
export function fileToTripCoverDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Invalid image type'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode image'));
      img.onload = () => {
        try {
          const scale = Math.min(1, MAX_WIDTH / img.width);
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas not supported'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);
          let quality = JPEG_QUALITY;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > MAX_BYTES && quality > 0.45) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          if (dataUrl.length > MAX_BYTES) {
            reject(new Error('Image too large after compression'));
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

export const TRIP_COVER_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';
