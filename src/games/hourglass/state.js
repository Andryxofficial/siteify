/**
 * Andryx Hourglass — Stato globale del gioco.
 *
 * Lo state e` mutabile (riferimento condiviso tra engine, scene, render).
 * Le scene leggono/scrivono campi liberamente; il save serializza solo
 * il sottoinsieme rilevante (vedi save.js).
 */

export function makeInitialState(savedData) {
  const base = {
    sceneId: 'sea',           /* sea | mercay | temple | fire */
    nextSceneId: null,        /* triggera un transition() nel loop */
    nextSpawn: null,          /* { x, y } pixel logici nella nuova scena */

    /* Player */
    hp: 6,
    maxHp: 6,
    rupees: 0,
    score: 0,
    elapsedMs: 0,
    startedAt: Date.now(),

    /* Items / flag */
    items: {
      sword: false,
      shield: false,
      boomerang: false,
      bombs: 0,        /* count, max 10 */
      bombsMax: 10,
      bow: false,
      arrows: 0,
      arrowsMax: 20,
      potions: 0,
      potionsMax: 3,
      keys: 0,         /* dungeon keys correnti */
      chart: false,    /* mappa marina sbloccata */
    },

    /* Flag narrativi */
    flags: {
      met_oshus: false,
      met_linebeck: false,
      visited_temple: false,
      visited_fire: false,
      defeated_phantom_lord: false,
      defeated_fire_boss: false,
      win: false,
    },

    /* Phantom Hourglass — secondi rimasti nel Tempio */
    hourglassMs: 600000,    /* 10 minuti iniziali */
    hourglassMax: 600000,
    inSafeZone: false,

    /* Sea — posizione attuale e isole sbloccate */
    sea: {
      shipX: 240,
      shipY: 240,
      destX: null,
      destY: null,
      currentIslandId: 'mercay',
      islandsUnlocked: { mercay: true, temple: false, fire: false },
    },

    /* Tempio Re del Mare — piano corrente */
    oceanFloor: 0,

    /* Stats */
    kills: 0,
  };

  if (savedData) {
    base.sceneId = savedData.sceneId || base.sceneId;
    base.hp = savedData.hp ?? base.hp;
    base.maxHp = savedData.maxHp ?? base.maxHp;
    base.rupees = savedData.rupees || 0;
    base.score = savedData.score || 0;
    base.elapsedMs = savedData.elapsedMs || 0;
    base.items = { ...base.items, ...(savedData.items || {}) };
    base.flags = { ...base.flags, ...(savedData.flags || {}) };
    base.oceanFloor = savedData.oceanFloor || 0;
  }
  return base;
}

/** Aggiunge `n` rupie cap a 999. */
export function addRupees(state, n) {
  state.rupees = Math.max(0, Math.min(999, (state.rupees || 0) + n));
  state.score += Math.max(0, n) * 5;
}

/** Heal di `n` mezzi-cuori (1 unita` = 1 mezzo cuore) cap a maxHp. */
export function heal(state, n) {
  state.hp = Math.max(0, Math.min(state.maxHp, state.hp + n));
}

/** Danno applicato al player. Restituisce true se uccide. */
export function damage(state, n) {
  /* Lo scudo dimezza il danno (almeno 1) */
  let d = n;
  if (state.items.shield) d = Math.max(1, Math.ceil(n / 2));
  state.hp = Math.max(0, state.hp - d);
  return state.hp <= 0;
}
