/**
 * navTransizione — segnale globale (non React state) per comunicare
 * il tipo di navigazione (click o swipe) e la direzione a PageTransition.
 *
 * È un semplice oggetto mutabile: nessun overhead di context/provider.
 * Viene scritto immediatamente prima di ogni `navigate()` e letto da
 * PageTransition durante il mount del componente entrante.
 *
 * tipo:  'click'  → animazione spring fade (comportamento default)
 *        'swipe'  → slide orizzontale fluido
 * dir:    1 → navigazione verso destra (tab successivo / avanti)
 *        -1 → navigazione verso sinistra (tab precedente / indietro)
 */
export const navTransizioneRef = {
  tipo: 'click',
  dir: 1,
};

/** Imposta il tipo di navigazione prima di chiamare navigate(). */
export function segnaNavigazione(tipo = 'click', dir = 1) {
  navTransizioneRef.tipo = tipo;
  navTransizioneRef.dir  = dir;
}

/** Legge il tipo corrente e lo resetta a 'click' (default). */
export function leggiEResetNavigazione() {
  const { tipo, dir } = navTransizioneRef;
  navTransizioneRef.tipo = 'click';
  navTransizioneRef.dir  = 1;
  return { tipo, dir };
}
