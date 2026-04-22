/**
 * Andryx Jump — i18n IT/EN/ES.
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
    instructions: 'Frecce/A-D per muoverti · Spazio/W/Z per saltare (piu tieni premuto, piu salti alto) · Shift per correre · X/Sec per palle di fuoco · Salta sui nemici. Raggiungi la bandiera dorata!',
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
    crystalGet: 'Cristallo! Ora sei Grande Andryx!',
    starGet: 'Stella di Pixel! Invincibile per 8 secondi',
    featherGet: 'Piuma! Doppio salto per 12 secondi',
    fireGet: 'Fiore di fuoco! Puoi sparare palle di fuoco',
    checkpointReached: 'Checkpoint raggiunto',
    sessionScore: 'Punteggio sessione',
    totalCoins: 'Monete totali',
    tartaraxStomp: 'Tartarax neutralizzato!',
    shellKick: 'Guscio lanciato!',
    bigGet: 'Cristallo! Ora sei Grande Andryx!',
  },
};

const EN = {
  meta: {
    description: 'Original 2D side-scrolling platformer: 10 Andryx-themed worlds, acrobatic jumps, power-ups and original enemies.',
    instructions: 'Arrows/A-D to move · Space/W/Z to jump (hold for higher jump) · Shift to run · X/Sec for fireballs · Jump on enemies to defeat them. Reach the golden flag!',
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
    crystalGet: 'Crystal! Now you are Big Andryx!',
    starGet: 'Pixel Star! Invincible for 8 seconds',
    featherGet: 'Feather! Double jump for 12 seconds',
    fireGet: 'Fire Flower! You can shoot fireballs',
    checkpointReached: 'Checkpoint reached',
    sessionScore: 'Session score',
    totalCoins: 'Total coins',
    tartaraxStomp: 'Tartarax neutralized!',
    shellKick: 'Shell kicked!',
    bigGet: 'Crystal! Now you are Big Andryx!',
  },
};

const ES = {
  meta: {
    description: 'Plataformas 2D original de scroll lateral: 10 mundos tematicos Andryx, saltos acrobaticos, power-ups y enemigos originales.',
    instructions: 'Flechas/A-D para moverte · Espacio/W/Z para saltar (manten para saltar mas alto) · Shift para correr · X/Sec para bolas de fuego · Salta sobre enemigos. Alcanza la bandera dorada!',
    gameOverTitle: 'Game Over',
    hubDescription: 'Plataformas arcade original: 10 mundos, power-ups, enemigos, clasificacion dedicada.',
  },
  ui: {
    coins: 'Monedas',
    lives: 'Vidas',
    time: 'Tiempo',
    world: 'Mundo',
    score: 'Puntuacion',
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
    bestScore: 'Record',
    newRecord: '¡NUEVO RECORD!',
    crystalGet: '¡Cristal! ¡Ahora eres el Gran Andryx!',
    starGet: '¡Estrella Pixel! Invencible por 8 segundos',
    featherGet: '¡Pluma! Doble salto por 12 segundos',
    fireGet: '¡Flor de fuego! Puedes disparar bolas de fuego',
    checkpointReached: 'Checkpoint alcanzado',
    sessionScore: 'Puntuacion de sesion',
    totalCoins: 'Monedas totales',
    tartaraxStomp: '¡Tartarax neutralizado!',
    shellKick: '¡Concha lanzada!',
    bigGet: '¡Cristal! ¡Ahora eres el Gran Andryx!',
  },
};

const CATALOG = { it: IT, en: EN, es: ES };

export function getMetaText(key) {
  return CATALOG[linguaCorrente]?.meta?.[key] || IT.meta[key] || '';
}

export function t(key) {
  return CATALOG[linguaCorrente]?.ui?.[key] || IT.ui[key] || key;
}
