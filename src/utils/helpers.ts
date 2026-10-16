import exifr from 'exifr';

/**
 * Calculates SHA-256 hash of an object or string for determinism & verification
 */
export async function sha256Hash(data: any): Promise<string> {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Resizes an image file to max 1024px JPEG and extracts EXIF metadata
 */
export async function processPhotoFile(file: File): Promise<{
  id: string;
  name: string;
  thumbUrl: string;
  takenAt?: string;
  lat?: number;
  lng?: number;
}> {
  const id = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // 1. Extract EXIF GPS and timestamp using exifr
  let takenAt: string | undefined;
  let lat: number | undefined;
  let lng: number | undefined;

  try {
    const exif = await exifr.parse(file, {
      gps: true,
      pick: ['DateTimeOriginal', 'latitude', 'longitude'],
    });
    if (exif) {
      if (exif.DateTimeOriginal) {
        takenAt = new Date(exif.DateTimeOriginal).toISOString();
      }
      if (typeof exif.latitude === 'number' && typeof exif.longitude === 'number') {
        lat = Number(exif.latitude.toFixed(6));
        lng = Number(exif.longitude.toFixed(6));
      }
    }
  } catch (err) {
    console.warn('EXIF parsing skipped for image:', err);
  }

  // 2. Resize to max 1024px JPEG data URL
  const thumbUrl = await resizeImageToDataUrl(file, 1024);

  return {
    id,
    name: file.name,
    thumbUrl,
    takenAt,
    lat,
    lng,
  };
}

function resizeImageToDataUrl(file: File, maxSize: number = 1024): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(e.target?.result as string);
        }
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Calculates Euclidean distance between two RGB hex colors
 */
export function colorHexDistance(hex1: string, hex2: string): number {
  const c1 = parseInt(hex1.replace('#', ''), 16);
  const c2 = parseInt(hex2.replace('#', ''), 16);

  const r1 = (c1 >> 16) & 255;
  const g1 = (c1 >> 8) & 255;
  const b1 = c1 & 255;

  const r2 = (c2 >> 16) & 255;
  const g2 = (c2 >> 8) & 255;
  const b2 = c2 & 255;

  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}
