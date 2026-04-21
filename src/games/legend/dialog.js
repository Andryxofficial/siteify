/**
 * Sistema dialoghi e quest line per Andryx Legend.
 *
 * I dialoghi sono identificati da un id (es. 'king_intro'). Ogni dialogo è
 * una sequenza di "battute" — testi mostrati con effetto typewriter. Le
 * battute possono modificare lo stato (flag), avanzare quest o fornire
 * scelte multiple.
 *
 * La quest line guida il giocatore:
 *   1. talk_king        — Il Re affida la missione
 *   2. take_sword       — Andryx raccoglie la spada nel villaggio
 *   3. forest_crystal   — Sconfiggere i nemici nella Foresta + raccogliere Cristallo Verde
 *   4. cave_crystal     — Risolvere puzzle torce + sconfiggere Custode + Cristallo Blu
 *   5. castle_boss      — Sconfiggere Re Ombra + raccogliere Cristallo Rosso
 *   6. ending           — Tornare al Re per il finale
 */

/* ─── Definizione quest stage ─── */
export const QUEST_STAGES = [
  'start',
  'talked_to_king',
  'has_sword',
  'has_crystal_green',
  'has_crystal_blue',
  'has_crystal_red',
  'ending',
];

/* ─── Dialoghi ─── */
export const DIALOGS = {
  king_intro: {
    speaker: 'Re Andryx',
    portrait: 'NPC_KING',
    lines: [
      'Andryx, mio coraggioso campione...',
      'Il Re Ombra ha rubato i 3 Cristalli del Pixel.',
      'Senza di essi, Twitchia svanirà nell\'oblio.',
      'Recupera il Cristallo Verde nella Foresta,',
      'il Cristallo Blu nella Caverna delle Gemme,',
      'e il Cristallo Rosso nel suo Castello.',
      'Solo tu puoi salvarci. Buona fortuna!',
    ],
    onComplete: { setQuest: 'talked_to_king' },
  },

  king_progress: {
    speaker: 'Re Andryx',
    portrait: 'NPC_KING',
    lines: [
      'Hai gia` recuperato {crystals}/3 cristalli.',
      'Continua, eroe! Il regno ti benedice.',
    ],
  },

  king_ending: {
    speaker: 'Re Andryx',
    portrait: 'NPC_KING',
    lines: [
      'Hai... tutti e tre i Cristalli del Pixel!',
      'Twitchia è salva grazie al tuo coraggio.',
      'Sarai ricordato come il più grande eroe',
      'che il regno abbia mai conosciuto!',
      '~ FINE ~',
    ],
    onComplete: { setQuest: 'ending', triggerEnding: true },
  },

  elder_intro: {
    speaker: 'Anziano',
    portrait: 'NPC_ELDER',
    lines: [
      'Ah, giovane eroe...',
      'La spada di tuo padre giace nella casa a ovest.',
      'Prendila prima di affrontare i mostri!',
      'Ricorda: premi SPAZIO per attaccare.',
    ],
  },

  elder_after_sword: {
    speaker: 'Anziano',
    portrait: 'NPC_ELDER',
    lines: [
      'Vedo che hai la spada. Bene.',
      'Nella Caverna trovai uno scudo:',
      'cercalo, ti proteggera` dalle frecce.',
    ],
  },

  merchant: {
    speaker: 'Mercante',
    portrait: 'NPC_MERCHANT',
    lines: [
      'Benvenuto nel mio negozio, eroe!',
      'I miei prodotti sono i migliori di Twitchia.',
      'Purtroppo... non accetto rupie oggi.',
      'Torna quando avrai sconfitto il Re Ombra!',
    ],
  },

  child: {
    speaker: 'Bambino',
    portrait: 'NPC_CHILD',
    lines: [
      'Wow! Sei davvero un eroe?',
      'Mio fratello dice che nei vasi',
      'a volte ci sono cuori e rupie!',
      'Distruggili con la spada, prova!',
    ],
  },

  sword_pickup: {
    speaker: 'Sistema',
    portrait: 'ITEM_SWORD',
    lines: [
      'Hai trovato la SPADA DI ANDRYX!',
      'Premi SPAZIO o il pulsante azione',
      'per attaccare nella direzione',
      'in cui guardi.',
    ],
    onComplete: { setQuest: 'has_sword', setFlag: 'has_sword' },
  },

  shield_pickup: {
    speaker: 'Sistema',
    portrait: 'ITEM_SHIELD',
    lines: [
      'Hai trovato lo SCUDO DI BRONZO!',
      'Riduce a meta` i danni dei nemici.',
    ],
    onComplete: { setFlag: 'has_shield' },
  },

  crystal_green_pickup: {
    speaker: 'Sistema',
    portrait: 'ITEM_CRYSTAL_GREEN',
    lines: [
      'Hai recuperato il CRISTALLO VERDE!',
      'Uno dei tre Cristalli del Pixel.',
      'Ora puoi accedere al Castello',
      'tramite il portale a est.',
    ],
    onComplete: { setQuest: 'has_crystal_green', setFlag: 'has_crystal_green' },
  },

  crystal_blue_pickup: {
    speaker: 'Sistema',
    portrait: 'ITEM_CRYSTAL_BLUE',
    lines: [
      'Hai recuperato il CRISTALLO BLU!',
      'Il potere dell\'acqua fluisce in te.',
    ],
    onComplete: { setQuest: 'has_crystal_blue', setFlag: 'has_crystal_blue' },
  },

  crystal_red_pickup: {
    speaker: 'Sistema',
    portrait: 'ITEM_CRYSTAL_RED',
    lines: [
      'Hai recuperato il CRISTALLO ROSSO!',
      'L\'ultimo dei Cristalli del Pixel!',
      'Torna dal Re per completare la missione.',
    ],
    onComplete: { setQuest: 'has_crystal_red', setFlag: 'has_crystal_red' },
  },

  heart_container_pickup: {
    speaker: 'Sistema',
    portrait: 'ITEM_HEART_CONTAINER',
    lines: [
      'Contenitore di Cuore!',
      'I tuoi punti vita massimi aumentano.',
    ],
    onComplete: { addMaxHp: 2 },
  },

  guardian_intro: {
    speaker: 'Custode',
    portrait: 'BOSS_GUARDIAN',
    lines: [
      'CHI OSA RISVEGLIARE IL CUSTODE?',
      'NESSUNO PASSA SENZA SUPERARE LA PROVA!',
    ],
  },

  shadow_king_intro: {
    speaker: 'Re Ombra',
    portrait: 'BOSS_SHADOW_KING',
    lines: [
      'Cosi`, l\'eroe di Twitchia osa sfidarmi.',
      'I tuoi cristalli non basteranno.',
      'Ti annienteranno le mie ombre!',
      'PREPARATI A MORIRE!',
    ],
  },

  victory_guardian: {
    speaker: 'Sistema',
    portrait: 'ITEM_CRYSTAL_BLUE',
    lines: [
      'Custode sconfitto!',
      'Il Cristallo Blu si materializza.',
    ],
  },

  victory_shadow_king: {
    speaker: 'Sistema',
    portrait: 'ITEM_CRYSTAL_RED',
    lines: [
      'Re Ombra annientato!',
      'L\'oscurità si dissolve.',
      'Twitchia è salva!',
    ],
  },
};

/** Ritorna il dialogo per id, sostituendo eventuali placeholder. */
export function getDialog(id, state) {
  const d = DIALOGS[id];
  if (!d) return null;
  const lines = d.lines.map(l => substitute(l, state));
  return { ...d, lines };
}

function substitute(text, state) {
  if (!state) return text;
  const crystals = (state.flags?.has_crystal_green ? 1 : 0) +
                   (state.flags?.has_crystal_blue ? 1 : 0) +
                   (state.flags?.has_crystal_red ? 1 : 0);
  return text.replace('{crystals}', String(crystals));
}

/* ─── Selettore dialogo dinamico per NPC.
       Sceglie un dialogo in base allo stato corrente.   ─── */
export function selectNpcDialog(npcId, state) {
  const flags = state.flags || {};
  if (npcId === 'king_intro') {
    if (flags.has_crystal_green && flags.has_crystal_blue && flags.has_crystal_red) {
      return 'king_ending';
    }
    if (state.quest && state.quest !== 'start') {
      return 'king_progress';
    }
    return 'king_intro';
  }
  if (npcId === 'elder_intro') {
    return flags.has_sword ? 'elder_after_sword' : 'elder_intro';
  }
  return npcId;
}

/* ─── Punteggio finale: combina cristalli, kill, tempo, HP rimasti ─── */
export function calculateFinalScore(state) {
  let score = 0;
  if (state.flags?.has_sword) score += 50;
  if (state.flags?.has_shield) score += 100;
  if (state.flags?.has_crystal_green) score += 500;
  if (state.flags?.has_crystal_blue) score += 1000;
  if (state.flags?.has_crystal_red) score += 1500;
  score += (state.kills || 0) * 25;
  score += (state.rupees || 0) * 5;
  score += (state.maxHp || 6) * 10;
  /* Bonus tempo: meno tempo = piu` punti, max 1000 */
  const timeMin = (state.elapsedMs || 0) / 60000;
  const timeBonus = Math.max(0, Math.floor(1000 - timeMin * 50));
  score += timeBonus;
  /* Bonus completamento totale */
  if (state.flags?.has_crystal_green && state.flags?.has_crystal_blue && state.flags?.has_crystal_red) {
    score += 2000;
  }
  return score;
}
