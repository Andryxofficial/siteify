/* sole.js — Calcolo alba/tramonto (NOAA Solar Position Algorithm semplificato).
 *
 * Tutte le funzioni sono pure, zero dipendenze esterne.
 *   calcolaAlbaTramonto(data, lat, lon) → { alba: Date, tramonto: Date }
 *   inOreDiLuce(now, lat, lon)          → boolean
 *
 * Senza coordinate (lat/lon undefined) si usa un fallback "Italia centro"
 * (Roma, ~41.9°N 12.5°E) — perfettamente accettabile per il caso d'uso
 * "tema chiaro/scuro in base all'ora del giorno".
 */

const ROMA = { lat: 41.9028, lon: 12.4964 };

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/* Zenith standard per l'orizzonte (90° + correzione rifrazione atmosferica
   ~0.833° = 90.833°). Usato dalla USNO/NOAA per definire alba/tramonto
   "ufficiali" (sole appare/scompare all'orizzonte apparente). */
const ZENITH_ALBA_TRAMONTO_DEG = 90.833;

/* Fallback per regioni polari (sole sempre sopra/sotto orizzonte): consideriamo
   "giorno" l'intervallo 7:00-19:00 ora locale. Stessi valori usati dall'anti-FOUC
   in index.html per coerenza. */
const ORA_ALBA_FALLBACK     = 7;
const ORA_TRAMONTO_FALLBACK = 19;

/* Giorno giuliano da Date UTC */
function giornoGiuliano(d) {
  return d.getTime() / 86400000 + 2440587.5;
}

/* Anomalia media solare (gradi) */
function anomaliaMedia(jd) {
  return (357.5291 + 0.98560028 * (jd - 2451545)) % 360;
}

/* Equazione del centro */
function equazioneCentro(M) {
  const Mr = M * RAD;
  return 1.9148 * Math.sin(Mr) + 0.0200 * Math.sin(2 * Mr) + 0.0003 * Math.sin(3 * Mr);
}

/* Longitudine eclittica del sole */
function longitudineSole(M) {
  return (M + equazioneCentro(M) + 180 + 102.9372) % 360;
}

/* Declinazione solare */
function declinazione(L) {
  return Math.asin(Math.sin(L * RAD) * Math.sin(23.4397 * RAD)) * DEG;
}

/* Equazione del tempo (minuti) */
function equazioneTempo(M, L) {
  const y = Math.tan(23.4397 / 2 * RAD) ** 2;
  const Lr = L * RAD;
  const Mr = M * RAD;
  const e = 0.0167;
  const E = y * Math.sin(2 * Lr) - 2 * e * Math.sin(Mr)
          + 4 * e * y * Math.sin(Mr) * Math.cos(2 * Lr)
          - 0.5 * y * y * Math.sin(4 * Lr)
          - 1.25 * e * e * Math.sin(2 * Mr);
  return 4 * E * DEG;
}

/**
 * Calcola alba e tramonto (Date locali UTC) per una data e coordinate.
 * Se lat/lon non sono fornite, usa Roma come fallback.
 * In casi degeneri (sole sempre sopra/sotto orizzonte, regioni polari)
 * ritorna { alba: null, tramonto: null }.
 */
export function calcolaAlbaTramonto(data, lat = ROMA.lat, lon = ROMA.lon) {
  // Mezzogiorno UTC del giorno richiesto come riferimento
  const giorno = new Date(Date.UTC(
    data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate(), 12, 0, 0
  ));
  const jd = giornoGiuliano(giorno);
  const M  = anomaliaMedia(jd);
  const L  = longitudineSole(M);
  const dec = declinazione(L);
  const eqt = equazioneTempo(M, L);

  // Angolo orario all'orizzonte (zenith standard + correzione rifrazione)
  const cosH = (Math.cos(ZENITH_ALBA_TRAMONTO_DEG * RAD) - Math.sin(lat * RAD) * Math.sin(dec * RAD))
             / (Math.cos(lat * RAD) * Math.cos(dec * RAD));
  if (cosH > 1 || cosH < -1) {
    return { alba: null, tramonto: null };
  }
  const H = Math.acos(cosH) * DEG; // gradi

  // Mezzogiorno solare in minuti UTC
  const mezzogiornoMin = 720 - 4 * lon - eqt;
  const albaMin     = mezzogiornoMin - 4 * H;
  const tramontoMin = mezzogiornoMin + 4 * H;

  const base = Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate());
  return {
    alba:     new Date(base + albaMin     * 60000),
    tramonto: new Date(base + tramontoMin * 60000),
  };
}

/**
 * Ritorna true se `now` è tra alba e tramonto (= dovrebbe essere chiaro).
 * Gestisce regioni polari ricadendo sull'orario locale: 7:00-19:00 = giorno.
 */
export function inOreDiLuce(now = new Date(), lat, lon) {
  const { alba, tramonto } = calcolaAlbaTramonto(now, lat, lon);
  if (!alba || !tramonto) {
    const ora = now.getHours();
    return ora >= ORA_ALBA_FALLBACK && ora < ORA_TRAMONTO_FALLBACK;
  }
  return now >= alba && now < tramonto;
}
