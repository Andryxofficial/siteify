/**
 * Palette globale per Andryx Legend.
 * Ispirata alla palette GBA di The Minish Cap: colori saturi, contrasti morbidi,
 * verdi naturali, rossi caldi, blu cielo, beige villaggio.
 *
 * Ogni colore ha una chiave di 1 carattere (utilizzata negli sprite encoded
 * come griglie ASCII — vedi sprites.js).
 *
 * '.' = trasparente.
 */
export const PAL = {
  '.': 'transparent',

  // Pelle / capelli Andryx (eroe)
  k: '#f7d4a3', // pelle chiara
  K: '#d6a373', // pelle ombra
  h: '#6b3a1f', // capelli scuri
  H: '#4a2812', // capelli ombra
  e: '#1a1a2e', // occhi/contorni neri

  // Verde (cappello eroe / foresta)
  g: '#3a8c3a', // verde primario
  G: '#266b26', // verde scuro
  l: '#5fb35f', // verde chiaro

  // Rosso (cuori, fiori, sangue, mantello)
  r: '#d23a3a', // rosso
  R: '#8e1818', // rosso scuro
  p: '#ff7a7a', // rosso chiaro/rosa

  // Marrone (legno, terra, capelli)
  b: '#7a4a25', // marrone medio
  B: '#4a2812', // marrone scuro
  c: '#a87045', // beige scuro

  // Beige / sabbia / pareti villaggio
  s: '#e8c896', // sabbia chiara
  S: '#b89060', // sabbia scura
  w: '#fff5dd', // crema chiarissima

  // Grigio / pietra / metallo
  o: '#888888', // grigio medio
  O: '#555555', // grigio scuro
  M: '#cccccc', // grigio chiaro
  N: '#2a2a35', // quasi nero

  // Blu (acqua, cielo, magia, scudo)
  u: '#3a72c8', // blu medio
  U: '#1f4a8c', // blu scuro
  d: '#7ab4f0', // blu chiaro

  // Giallo (oro, rupie, sole, fiamma, cristalli)
  y: '#f0c850', // giallo oro
  Y: '#b88830', // oro scuro
  f: '#ffd870', // giallo chiaro

  // Viola (magia, ombra, boss)
  v: '#7a3aa0', // viola
  V: '#4a1f60', // viola scuro
  m: '#b870d0', // viola chiaro

  // Cristalli speciali
  q: '#ff5af0', // rosa cristallo
  Q: '#a020a0', // viola cristallo

  // Bianco / luce
  W: '#ffffff',
  L: '#f0f0f0',

  // Verde chiaro erba
  j: '#88c870', // erba chiara
  J: '#4a8830', // erba scura

  // Acqua animata
  a: '#5fa0e0', // acqua media
  A: '#3a78c0', // acqua scura
  i: '#a8d0f0', // acqua chiara/spuma
};

/* Combine: colore primario del gioco (per HUD/menu) */
export const C = {
  primary:    '#3a8c3a',
  secondary:  '#d23a3a',
  accent:     '#f0c850',
  text:       'var(--text-main)',
  textMuted:  'var(--text-muted)',
  bgDark:     '#1a1a2e',
  heart:      '#d23a3a',
  rupee:      '#3a8c3a',
  panel:      'rgba(20,20,40,0.92)',
  panelEdge:  '#f0c850',
  shadow:     'rgba(0,0,0,0.45)',
};
