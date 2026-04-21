/**
 * Game Registry — mappa ogni mese (1-12) a un modulo gioco.
 *
 * I metadati (meta) sono definiti inline qui (nessun import statico dai
 * moduli gioco) per evitare che il chunk GamePage abbia 12 dipendenze
 * statiche esterne. Se anche solo uno di questi chunk JS fallisse il
 * caricamento (404 dopo un redeploy, problema CDN, cache stale), l'intera
 * lazy-load di GamePage fallirebbe con "Importing a module script failed."
 *
 * Il codice gioco pesante (createGame) è caricato on-demand via dynamic
 * import per ridurre drasticamente il bundle iniziale.
 *
 * Ogni modulo gioco esporta:
 *   meta   — { name, emoji, description, color, controls }
 *   createGame(canvas, callbacks) → cleanup()
 *
 * callbacks = {
 *   keysRef, joystickRef, actionBtnRef,
 *   onScore(score), onGameOver(finalScore), onHpChange(hp, maxHp), onInfo(text)
 * }
 */

/* Mappa mese → { meta, loader (dynamic import) } */
const GAMES = {
  1: {
    meta: {
      name: 'Frost Dash', emoji: '❄️',
      description: 'Corri sul ghiaccio, salta gli ostacoli e raccogli i cristalli!',
      color: '#4FC3F7', controls: 'tap',
      instructions: 'Premi Spazio o tocca lo schermo per saltare. Evita gli ostacoli di ghiaccio!',
      gameOverTitle: 'Scivolato!', actionLabel: '🦘',
    },
    loader: () => import('./gennaio'),
  },
  2: {
    meta: {
      name: 'Heart Breaker', emoji: '💕',
      description: 'Cattura i cuori e evita quelli spezzati!',
      color: '#FF69B4', controls: 'joystick',
      instructions: 'Muovi con joystick o WASD. Raccogli i cuori, evita quelli spezzati! Premi 💘 per lo scudo.',
      gameOverTitle: 'Cuore spezzato!', actionLabel: '💘',
    },
    loader: () => import('./febbraio'),
  },
  3: {
    meta: {
      name: 'Wind Walker', emoji: '🍃',
      description: 'Cavalca il vento e raccogli le foglie!',
      color: '#4CAF50', controls: 'joystick',
      instructions: 'Muoviti con ← → o WASD. Premi 🌬️ per emettere una raffica di vento che respinge gli ostacoli!',
      gameOverTitle: 'Portato via dal vento!', actionLabel: '🌬️',
    },
    loader: () => import('./marzo'),
  },
  4: {
    meta: {
      name: 'Andryx Quest', emoji: '⚔️',
      description: 'Esplora i dungeon, sconfiggi i nemici e raccogli le gemme!',
      color: '#00f5d4', controls: 'joystick',
      instructions: 'Muoviti con WASD/frecce o joystick. Attacca con Spazio o il pulsante ⚔️. Sconfiggi tutti i nemici per aprire il portale!',
      gameOverTitle: 'Sei caduto!', actionLabel: '⚔️',
    },
    loader: () => import('./aprile'),
  },
  5: {
    meta: {
      name: 'Bloom Blitz', emoji: '🌸',
      description: 'Fai fiorire il giardino e difendilo dagli insetti!',
      color: '#E91E63', controls: 'joystick',
      instructions: 'Muoviti con WASD/frecce o joystick. Premi Spazio o 🌺 per spruzzare insetticida. Pianta fiori automaticamente mentre cammini. Difendi il giardino dagli insetti!',
      gameOverTitle: 'Il giardino è appassito!', actionLabel: '🌺',
    },
    loader: () => import('./maggio'),
  },
  6: {
    meta: {
      name: 'Solar Surge', emoji: '☀️',
      description: 'Cavalca i raggi solari ed evita le ombre!',
      color: '#FF9800', controls: 'joystick',
      instructions: 'Muoviti con WASD/frecce o joystick. Premi Spazio o 🔥 per sparare proiettili solari. Elimina le creature d\'ombra e sopravvivi alle ondate!',
      gameOverTitle: 'Eclissi totale!', actionLabel: '🔥',
    },
    loader: () => import('./giugno'),
  },
  7: {
    meta: {
      name: 'Wave Rider', emoji: '🏄',
      description: 'Surfa le onde e raccogli le stelle marine!',
      color: '#00BCD4', controls: 'joystick',
      instructions: 'Usa ↑↓ o joystick per muoverti. Raccogli le stelle marine ⭐ ed evita rocce e meduse! Premi Spazio o 🌊 per tuffarti sotto le onde (invulnerabilità breve).',
      gameOverTitle: 'Onda anomala!', actionLabel: '🌊',
    },
    loader: () => import('./luglio'),
  },
  8: {
    meta: {
      name: 'Meteor Storm', emoji: '💥',
      description: 'Sopravvivi alla pioggia di meteoriti!',
      color: '#FF5722', controls: 'joystick',
      instructions: 'Muoviti con WASD / joystick. Evita i meteoriti e raccogli i frammenti stellari ✦ per punti! Premi Spazio o 🛡️ per un\'onda scudo che distrugge i meteoriti vicini. Cura +❤️ ogni 1000 punti!',
      gameOverTitle: 'Disintegrato!', actionLabel: '🛡️',
    },
    loader: () => import('./agosto'),
  },
  9: {
    meta: {
      name: 'Leaf Catcher', emoji: '🍂',
      description: 'Raccogli le foglie d\'autunno prima che tocchino terra!',
      color: '#FF6F00', controls: 'joystick',
      instructions: 'Muovi il cesto con WASD / frecce / joystick. Raccogli foglie 🍁 per punti (quercia 10, acero 25, oro 50). Ghiande 🌰 = bonus! Evita le foglie marce ☠. Premi Spazio o 🍁 per una raffica di vento che attira le foglie verso di te! Cura ✚ ogni 1000 punti.',
      gameOverTitle: 'L\'autunno è finito!', actionLabel: '🍁',
    },
    loader: () => import('./settembre'),
  },
  10: {
    meta: {
      name: 'Shadow Maze', emoji: '🎃',
      description: 'Trova l\'uscita nel labirinto stregato!',
      color: '#FF6D00', controls: 'joystick',
      instructions: 'Muoviti con WASD/frecce o joystick. Raccogli le caramelle 🍬, evita i fantasmi 👻 e trova il portale per avanzare! Premi 🔦 per illuminare e stordire i fantasmi vicini.',
      gameOverTitle: 'Catturato dai fantasmi!', actionLabel: '🔦',
    },
    loader: () => import('./ottobre'),
  },
  11: {
    meta: {
      name: 'Cloud Hopper', emoji: '☁️',
      description: 'Salta di nuvola in nuvola e raggiungi il cielo!',
      color: '#90CAF9', controls: 'lr',
      instructions: 'Muoviti con ← → o WASD. Il personaggio rimbalza automaticamente sulle nuvole!',
      gameOverTitle: 'Caduto dalle nuvole!', actionLabel: '☁️',
    },
    loader: () => import('./novembre'),
  },
  12: {
    meta: {
      name: 'Gift Rush', emoji: '🎄',
      description: 'Raccogli i regali e consegnali nei camini prima che scada il tempo!',
      color: '#F44336', controls: 'joystick',
      instructions: 'Muoviti con ← → per raccogliere regali. Portali sui camini 🏠 e premi Spazio per consegnare!',
      gameOverTitle: 'Tempo scaduto!', actionLabel: '🎁',
    },
    loader: () => import('./dicembre'),
  },
};

/** Restituisce meta + loader per il mese dato (1-12). */
export function getGameForMonth(month) {
  return GAMES[month] || GAMES[4]; // fallback ad Aprile
}

/**
 * Carica dinamicamente il modulo gioco e restituisce createGame.
 * Il risultato è cachato: import() risolve dalla cache Vite/browser.
 */
export async function loadGameModule(month) {
  const entry = GAMES[month] || GAMES[4];
  const mod = await entry.loader();
  return mod;
}

/** Restituisce tutti i 12 meta (per calendario/archivio). */
export function getAllGameMetas() {
  return Object.entries(GAMES).map(([m, g]) => ({
    month: Number(m),
    ...g.meta,
  }));
}

/** Restituisce il meta di un mese specifico. */
export function getGameMeta(month) {
  const g = GAMES[month];
  return g ? g.meta : null;
}
