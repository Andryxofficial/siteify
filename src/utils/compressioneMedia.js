/**
 * compressioneMedia.js — Utility condivisa per compressione e lettura media lato client.
 *
 * Esportazioni:
 *   comprimeImmagine(file)        → Promise<File>   compressione canvas WebP/JPEG
 *   leggiComeBas64(file)          → Promise<string> base64 puro (senza data-url prefix)
 *   getMediaType(file)            → 'image' | 'audio' | 'video'
 *   MEDIA_ACCETTATI               → stringa accept per <input type="file">
 *   MEDIA_MAX_BYTES_GENERICO      → 5 MB limite per audio/video
 */

export const COMPRESS_MAX_DIM       = 2048;
export const COMPRESS_MAX_BYTES_IMG = 2_800_000;   // ~2.8 MB target immagini
export const MEDIA_MAX_BYTES_GENERICO = 5_242_880; // 5 MB audio/video
export const MEDIA_ACCETTATI = 'image/*,audio/*,video/*';

export function getMediaType(file) {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('audio/')) return 'audio';
  if (file.type.startsWith('video/')) return 'video';
  return 'image';
}

function isImageComprimibile(file) {
  return file.type.startsWith('image/') ||
    /\.(jpe?g|png|webp|bmp|gif|tiff?|avif|heic|heif)$/i.test(file.name);
}

/** Comprime un'immagine con canvas (resize + riduzione qualità). */
export async function comprimeImmagine(file) {
  if (
    file.size <= COMPRESS_MAX_BYTES_IMG &&
    (file.type === 'image/jpeg' || file.type === 'image/webp')
  ) {
    return file;
  }

  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    if (file.size <= COMPRESS_MAX_BYTES_IMG) return file;
    throw new Error('SVG troppo grande');
  }

  if (!isImageComprimibile(file)) return file;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > COMPRESS_MAX_DIM || height > COMPRESS_MAX_DIM) {
        const r = Math.min(COMPRESS_MAX_DIM / width, COMPRESS_MAX_DIM / height);
        width  = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      let qualita = 0.82;
      const formati = ['image/webp', 'image/jpeg'];

      function tenta(idxFormato) {
        const formato = formati[idxFormato];
        if (!formato) {
          reject(new Error('Impossibile comprimere l\'immagine sotto il limite'));
          return;
        }
        canvas.toBlob((blob) => {
          if (!blob) { tenta(idxFormato + 1); return; }
          const nomeBase = (file.name.replace(/\.[^.]+$/, '') || 'immagine');
          const ext = formato === 'image/webp' ? '.webp' : '.jpg';
          if (blob.size <= COMPRESS_MAX_BYTES_IMG) {
            resolve(new File([blob], nomeBase + ext, { type: formato }));
          } else if (qualita > 0.35) {
            qualita -= 0.12;
            canvas.toBlob((blob2) => {
              if (blob2 && blob2.size <= COMPRESS_MAX_BYTES_IMG) {
                resolve(new File([blob2], nomeBase + ext, { type: formato }));
              } else {
                tenta(idxFormato + 1);
              }
            }, formato, qualita);
          } else {
            tenta(idxFormato + 1);
          }
        }, formato, qualita);
      }
      tenta(0);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Impossibile caricare: ${file.name}`));
    };
    img.src = url;
  });
}

/** Converte Uint8Array in stringa base64 a blocchi (evita stack overflow su file grandi). */
function uint8aBase64(arr) {
  const CHUNK = 8192;
  let str = '';
  for (let i = 0; i < arr.length; i += CHUNK) {
    str += String.fromCharCode(...arr.subarray(i, i + CHUNK));
  }
  return btoa(str);
}

/** Legge un File e restituisce la stringa base64 pura (senza "data:...;base64," prefix). */
export async function leggiComeBas64(file) {
  const buf = await file.arrayBuffer();
  return uint8aBase64(new Uint8Array(buf));
}

/**
 * Prepara un file per l'upload:
 *   - Se immagine → comprime e converte in base64
 *   - Se audio/video → controlla dimensioni e converte in base64
 * Ritorna { data: string, mimeType: string, name: string, mediaType: string }
 * Lancia un Error con messaggio leggibile in caso di problemi.
 */
export async function preparaMediaPerUpload(file) {
  const mediaType = getMediaType(file);

  let fileFinale = file;
  if (mediaType === 'image') {
    fileFinale = await comprimeImmagine(file);
  } else if (file.size > MEDIA_MAX_BYTES_GENERICO) {
    throw new Error(`File troppo grande (max 5 MB per audio/video). Il tuo file è ${(file.size / 1_048_576).toFixed(1)} MB.`);
  }

  const data = await leggiComeBas64(fileFinale);
  return {
    data,
    mimeType: fileFinale.type || file.type,
    name: fileFinale.name || file.name,
    mediaType,
  };
}
