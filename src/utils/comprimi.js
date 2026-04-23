/**
 * Utility condivisa — compressione immagini lato client (canvas-based).
 * Usata da CommunityPage, ThreadView e altri componenti che gestiscono upload media.
 */

export const COMPRESS_MAX_DIM   = 2048;   // dimensione massima lato lungo (px)
export const COMPRESS_MAX_BYTES = 2_800_000; // ~2.8MB target (lascia margine per base64 overhead)

/** Restituisce true se il file è un'immagine comprimibile tramite canvas */
export function isImageComprimibile(file) {
  return (
    file.type.startsWith('image/') ||
    /\.(jpe?g|png|webp|bmp|gif|tiff?|avif|heic|heif|svg)$/i.test(file.name)
  );
}

/**
 * Comprime un'immagine usando Canvas 2D.
 * - Ridimensiona se supera COMPRESS_MAX_DIM sul lato lungo
 * - Prova prima WebP, poi JPEG come fallback
 * - Riduce qualità iterativamente finché il file entra in COMPRESS_MAX_BYTES
 * Restituisce un nuovo File compresso, o lancia un errore se impossibile.
 */
export async function comprimeImmagine(file) {
  /* Se è già piccola e in formato web-friendly, non ricomprimere */
  if (
    file.size <= COMPRESS_MAX_BYTES &&
    (file.type === 'image/jpeg' || file.type === 'image/webp')
  ) {
    return file;
  }

  /* SVG: nessuna compressione raster, restituisci così com'è se entro limite */
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    if (file.size <= COMPRESS_MAX_BYTES) return file;
    throw new Error('SVG troppo grande per essere caricato.');
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      let { width, height } = img;

      /* Ridimensiona se supera le dimensioni massime */
      if (width > COMPRESS_MAX_DIM || height > COMPRESS_MAX_DIM) {
        const rapporto = Math.min(COMPRESS_MAX_DIM / width, COMPRESS_MAX_DIM / height);
        width  = Math.round(width  * rapporto);
        height = Math.round(height * rapporto);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      let qualita = 0.82;
      const formati = ['image/webp', 'image/jpeg'];

      function tentaCompressione(idxFormato) {
        const formato = formati[idxFormato];
        if (!formato) {
          reject(new Error('Impossibile comprimere l\'immagine sotto il limite.'));
          return;
        }
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              /* Formato non supportato dal browser, prova il prossimo */
              tentaCompressione(idxFormato + 1);
              return;
            }
            if (blob.size <= COMPRESS_MAX_BYTES) {
              const ext      = formato === 'image/webp' ? '.webp' : '.jpg';
              const nomeBase = file.name.replace(/\.[^.]+$/, '') || 'immagine';
              resolve(new File([blob], nomeBase + ext, { type: formato }));
            } else if (qualita > 0.35) {
              qualita -= 0.12;
              canvas.toBlob(
                (blob2) => {
                  if (blob2 && blob2.size <= COMPRESS_MAX_BYTES) {
                    const ext      = formato === 'image/webp' ? '.webp' : '.jpg';
                    const nomeBase = file.name.replace(/\.[^.]+$/, '') || 'immagine';
                    resolve(new File([blob2], nomeBase + ext, { type: formato }));
                  } else {
                    tentaCompressione(idxFormato + 1);
                  }
                },
                formato, qualita
              );
            } else {
              tentaCompressione(idxFormato + 1);
            }
          },
          formato, qualita
        );
      }

      tentaCompressione(0);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Impossibile caricare l'immagine: ${file.name}`));
    };

    img.src = url;
  });
}

/**
 * Converte un File/Blob in stringa base64.
 * Utilizza lettura a blocchi per evitare stack overflow su file grandi.
 */
export function fileABase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => {
      const dataUrl = reader.result; // "data:<mime>;base64,<data>"
      const base64  = dataUrl.split(',')[1];
      if (!base64) reject(new Error('Conversione base64 fallita.'));
      else resolve(base64);
    };
    reader.onerror = () => reject(new Error('Lettura file fallita.'));
    reader.readAsDataURL(file);
  });
}

/** Restituisce la categoria del media: 'image' | 'audio' | 'video' | 'file' */
export function categoriaMedia(mimeType) {
  if (!mimeType) return 'file';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
}

/** Formatta dimensione file in KB/MB leggibili */
export function formatDimensione(bytes) {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Limite massimo per file audio/video (4 MB → lascia margine per base64 overhead in Redis) */
const AV_MAX_BYTES = 4_000_000;

/**
 * Elabora qualsiasi tipo di media per il caricamento:
 * - Immagini → compressione canvas-based
 * - Audio/video → verifica solo il limite di dimensione (no transcoding lato client)
 * - Lancia un errore se il file supera il limite e non è comprimibile
 */
export async function comprimeFileMedia(file) {
  if (!file) throw new Error('Nessun file selezionato.');

  if (file.type.startsWith('image/') || isImageComprimibile(file)) {
    return comprimeImmagine(file);
  }

  /* Audio e video: accettali se sotto il limite, altrimenti errore */
  if (file.type.startsWith('audio/') || file.type.startsWith('video/')) {
    if (file.size > AV_MAX_BYTES) {
      throw new Error(
        `File troppo grande (${formatDimensione(file.size)}). Limite: ${formatDimensione(AV_MAX_BYTES)}.`
      );
    }
    return file;
  }

  /* Formato non supportato */
  throw new Error(`Formato non supportato: ${file.type || file.name}`);
}
