/**
 * Andryx Jump — i18n IT/EN/ES.
 *
 * Il motore non puo` usare il LinguaContext React, quindi memorizza la
 * lingua corrente a livello di modulo. GamePage.jsx la imposta tramite
 * `setPlatformLang(lingua)` all'avvio e al cambio di lingua.
 */

const LINGUE_OK = { it: true, en: true, es: true };
let linguaCorrente = 'it';

export function setPlatformLang(lingua) {
  if (LINGUE_OK[lingua]) linguaCorrente = lingua;
}

export function getPlatformLang() {
  return linguaCorrente;
}

const IT = {
  meta: {
    description: 'Platformer 2D originale a scorrimento laterale: 10 mondi a tema Andryx, salti acrobatici, power-up e nemici originali.',
    instructions: 'Frecce/A-D per muoverti · Spazio/W/Z per saltare (più tieni premuto, più salti alto) · Shift per correre · Salta sui nemici per sconfiggerli. Raggiungi la bandiera dorata!',
    gameOverTitle: 'Game Over',
    hubDescription: 'Platformer originale stile arcade: 10 mondi, power-up, nemici, classifica dedicata.',
  },
  ui: {
    coins: 'Monete',
    lives: 'Vite',
    time: 'Tempo',
    world: 'Mondo',
    score: 'Punteggio',
    pause: 'PAUSA',
    resume: 'Riprendi',
    quit: 'Esci',
    levelComplete: 'LIVELLO COMPLETATO!',
    timeBonus: 'Bonus tempo',
    coinBonus: 'Bonus monete',
    next: 'Continua',
    gameOver: 'GAME OVER',
    retry: 'Riprova',
    worldMap: 'Mappa Mondi',
    selectLevel: 'Seleziona livello',
    locked: 'Bloccato',
    completed: 'Completato',
    bestTime: 'Miglior tempo',
    bestScore: 'Record',
    newRecord: 'NUOVO RECORD!',
    crystalGet: 'Cristallo! Ora resisti a un colpo in più',
    starGet: 'Stella di Pixel! Invincibile per 8 secondi',
    featherGet: 'Piuma! Doppio salto per 12 secondi',
    checkpointReached: 'Checkpoint raggiunto',
    sessionScore: 'Punteggio sessione',
    totalCoins: 'Monete totali',
  },
};

const EN = {
  meta: {
    description: 'Original 2D side-scrolling platformer: 10 Andryx-themed worlds, acrobatic jumps, power-ups and original enemies.',
    instructions: 'Arrows/A-D to move · Space/W/Z to jump (hold for higher jump) · Shift to run · Jump on enemies to defeat them. Reach the golden flag!',
    gameOverTitle: 'Game Over',
    hubDescription: 'Original arcade-style platformer: 10 worlds, power-ups, enemies, dedicated leaderboard.',
  },
  ui: {
    coins: 'Coins',
    lives: 'Lives',
    time: 'Time',
    world: 'World',
    score: 'Score',
    pause: 'PAUSE',
    resume: 'Resume',
    quit: 'Quit',
    levelComplete: 'LEVEL CLEAR!',
    timeBonus: 'Time bonus',
    coinBonus: 'Coin bonus',
    next: 'Continue',
    gameOver: 'GAME OVER',
    retry: 'Retry',
    worldMap: 'World Map',
    selectLevel: 'Select level',
    locked: 'Locked',
    completed: 'Completed',
    bestTime: 'Best time',
    bestScore: 'Best score',
    newRecord: 'NEW RECORD!',
    crystalGet: 'Crystal! You can now take one extra hit',
    starGet: 'Pixel Star! Invincible for 8 seconds',
    featherGet: 'Feather! Double jump for 12 seconds',
    checkpointReached: 'Checkpoint reached',
    sessionScore: 'Session score',
    totalCoins: 'Total coins',
  },
};

const ES = {
  meta: {
    description: 'Plataformas 2D original de scroll lateral: 10 mundos temáticos Andryx, saltos acrobáticos, power-ups y enemigos originales.',
    instructions: 'Flechas/A-D para moverte · Espacio/W/Z para saltar (manten para saltar más alto) · Shift para correr · Salta sobre enemigos para vencerlos. Alcanza la bandera dorada!',
    gameOverTitle: 'Game Over',
    hubDescription: 'Plataformas arcade original: 10 mundos, power-ups, enemigos, clasificación dedicada.',
  },
  ui: {
    coins: 'Monedas',
    lives: 'Vidas',
    time: 'Tiempo',
    world: 'Mundo',
    score: 'Puntuación',
    pause: 'PAUSA',
    resume: 'Reanudar',
    quit: 'Salir',
    levelComplete: '¡NIVEL COMPLETADO!',
    timeBonus: 'Bonus tiempo',
    coinBonus: 'Bonus monedas',
    next: 'Continuar',
    gameOver: 'GAME OVER',
    retry: 'Reintentar',
    worldMap: 'Mapa de Mundos',
    selectLevel: 'Selecciona nivel',
    locked: 'Bloqueado',
    completed: 'Completado',
    bestTime: 'Mejor tiempo',
    bestScore: 'Récord',
    newRecord: '¡NUEVO RÉCORD!',
    crystalGet: '¡Cristal! Ahora resistes un golpe más',
    starGet: '¡Estrella Pixel! Invencible por 8 segundos',
    featherGet: '¡Pluma! Doble salto por 12 segundos',
    checkpointReached: 'Checkpoint alcanzado',
    sessionScore: 'Puntuación de sesión',
    totalCoins: 'Monedas totales',
  },
};

const CATALOG = { it: IT, en: EN, es: ES };

/** Restituisce un campo di meta tradotto (description/instructions/...). */
export function getMetaText(key) {
  return CATALOG[linguaCorrente]?.meta?.[key] || IT.meta[key] || '';
}

/** Restituisce una stringa UI tradotta. */
export function t(key) {
  return CATALOG[linguaCorrente]?.ui?.[key] || IT.ui[key] || key;
}
