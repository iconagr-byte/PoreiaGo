const MAX_BYTES = 900_000;
const MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.82;

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;

/** MIME can be empty on some OS/browsers — fall back to file extension. */
export function isTripCoverImageFile(file) {
  if (!file) return false;
  if (String(file.type || '').startsWith('image/')) {
    // Block HEIC/HEIF early — canvas decode is unreliable.
    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name || '')) {
      return false;
    }
    return true;
  }
  return IMAGE_EXT_RE.test(file.name || '');
}

/**
 * Resize & compress an image file for localStorage-backed trip covers.
 * Returns a JPEG data URL (or original data URL if already small enough).
 */
export function fileToTripCoverDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!isTripCoverImageFile(file)) {
      reject(new Error('Μόνο JPG, PNG ή WebP'));
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

export const TRIP_COVER_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif';
