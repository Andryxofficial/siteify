/**
 * Utility per la condivisione "alla nativa".
 *
 * - Su browser che supportano Web Share API (mobile + Safari desktop):
 *   apre il foglio di condivisione di sistema (Messages, WhatsApp, ecc.).
 * - Altrove: copia il link negli appunti come fallback.
 *
 * Restituisce uno stato testuale: 'shared' | 'copied' | 'cancelled' | 'unsupported'
 * così il chiamante può decidere se mostrare un toast.
 *
 * Esempio:
 *   const r = await condividi({ titolo: 'Andryx Live', url: 'https://...' });
 *   if (r === 'copied') toast.success('Link copiato!');
 */

export function puoCondividere(dati = {}) {
  if (typeof navigator === 'undefined') return false;
  if (typeof navigator.share !== 'function') return false;
  if (typeof navigator.canShare === 'function' && Object.keys(dati).length > 0) {
    try { return navigator.canShare(dati); } catch { return true; }
  }
  return true;
}

export async function condividi({ titolo, testo, url }) {
  const dati = {};
  if (titolo) dati.title = titolo;
  if (testo)  dati.text  = testo;
  if (url)    dati.url   = url;

  if (puoCondividere(dati)) {
    try {
      await navigator.share(dati);
      return 'shared';
    } catch (err) {
      // AbortError → utente ha annullato il share sheet
      if (err && (err.name === 'AbortError' || err.code === 20)) return 'cancelled';
      // Altri errori → cadi sul fallback copia
    }
  }

  /* Fallback: copia url negli appunti */
  if (url && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return 'copied';
    } catch {
      /* clipboard negato — ultimo fallback con execCommand */
      try {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        return 'copied';
      } catch {
        return 'unsupported';
      }
    }
  }

  return 'unsupported';
}
