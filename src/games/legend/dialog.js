/**
 * Sistema dialoghi e quest line per Andryx Legend.
 *
 * I dialoghi sono identificati da un id (es. 'king_intro'). Ogni dialogo è
 * una sequenza di "battute" — testi mostrati con effetto typewriter. Le
 * battute possono modificare lo stato (flag), avanzare quest o fornire
 * scelte multiple.
 *
 * TRADUZIONI: i campi `speaker` e `lines` sono definiti in `./i18n.js`
 * e vengono risolti nella lingua corrente al momento dell'apertura
 * del dialogo (vedi `getDialog`). I metadati qui sotto (portrait,
 * onComplete) restano invariati perché indipendenti dalla lingua.
 *
 * La quest line guida il giocatore:
 *   1. talk_king        — Il Re affida la missione
 *   2. take_sword       — Andryx raccoglie la spada nel villaggio
 *   3. forest_crystal   — Sconfiggere i nemici nella Foresta + raccogliere Cristallo Verde
 *   4. cave_crystal     — Risolvere puzzle torce + sconfiggere Custode + Cristallo Blu
 *   5. castle_boss      — Sconfiggere Re Ombra + raccogliere Cristallo Rosso
 *   6. ending           — Tornare al Re per il finale
 */

import { getLegendDialog } from './i18n.js';

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

/* ─── Metadati dei dialoghi (portrait + effetti collaterali on-complete).
       Speaker e lines vengono risolti al runtime da `./i18n.js` in base
       alla lingua corrente: questo oggetto contiene SOLO i dati indipendenti
       dalla lingua. Per aggiungere una nuova entry serve aggiornare sia
       qui (portrait + onComplete) sia i tre cataloghi IT/EN/ES in i18n.js. ─── */
export const DIALOGS = {
  king_intro: {
    portrait: 'NPC_KING',
    onComplete: { setQuest: 'talked_to_king' },
  },
  king_progress: {
    portrait: 'NPC_KING',
  },
  king_ending: {
    portrait: 'NPC_KING',
    onComplete: { setQuest: 'ending', triggerEnding: true },
  },
  elder_intro: {
    portrait: 'NPC_ELDER',
    /* La spada viene raccolta fisicamente come item sul pavimento — nessun setFlag qui */
  },
  elder_after_key: {
    portrait: 'NPC_ELDER',
  },
  elder_after_sword: {
    portrait: 'NPC_ELDER',
  },
  elder_village: {
    portrait: 'NPC_ELDER',
  },
  house_key_pickup: {
    portrait: 'ITEM_HOUSE_KEY',
    onComplete: { setFlag: 'house_key' },
  },
  andryx_house_enter: {
    portrait: 'NPC_ELDER',
  },
  merchant: {
    portrait: 'NPC_MERCHANT',
  },
  child: {
    portrait: 'NPC_CHILD',
  },
  sword_pickup: {
    portrait: 'ITEM_SWORD',
    onComplete: { setQuest: 'has_sword', setFlag: 'has_sword' },
  },
  shield_pickup: {
    portrait: 'ITEM_SHIELD',
    onComplete: { setFlag: 'has_shield' },
  },
  crystal_green_pickup: {
    portrait: 'ITEM_CRYSTAL_GREEN',
    onComplete: { setQuest: 'has_crystal_green', setFlag: 'has_crystal_green' },
  },
  crystal_blue_pickup: {
    portrait: 'ITEM_CRYSTAL_BLUE',
    onComplete: { setQuest: 'has_crystal_blue', setFlag: 'has_crystal_blue' },
  },
  crystal_red_pickup: {
    portrait: 'ITEM_CRYSTAL_RED',
    onComplete: { setQuest: 'has_crystal_red', setFlag: 'has_crystal_red' },
  },
  heart_container_pickup: {
    portrait: 'ITEM_HEART_CONTAINER',
    onComplete: { addMaxHp: 2 },
  },
  guardian_intro: {
    portrait: 'BOSS_GUARDIAN',
  },
  shadow_king_intro: {
    portrait: 'BOSS_SHADOW_KING',
  },
  forest_troll_intro: {
    portrait: 'BOSS_GUARDIAN',
  },
  forest_troll_victory: {
    portrait: null,
  },
  castle_boss_awakens: {
    portrait: 'BOSS_SHADOW_KING',
  },
  victory_guardian: {
    portrait: 'ITEM_CRYSTAL_BLUE',
  },
  victory_shadow_king: {
    portrait: 'ITEM_CRYSTAL_RED',
  },
  village_intro: {
    portrait: 'NPC_ELDER',
  },
  forest_enter: {
    portrait: 'NPC_ELDER',
  },
  cave_enter: {
    portrait: 'NPC_ELDER',
  },
  castle_enter: {
    portrait: 'BOSS_SHADOW_KING',
  },
};

/** Ritorna il dialogo per id nella lingua corrente, sostituendo i placeholder. */
export function getDialog(id, state) {
  const meta = DIALOGS[id];
  if (!meta) return null;
  const translated = getLegendDialog(id);
  if (!translated) return null;
  const lines = (translated.lines || []).map(l => substitute(l, state));
  return {
    speaker: translated.speaker || '',
    portrait: meta.portrait,
    lines,
    onComplete: meta.onComplete,
  };
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
    if (flags.has_sword) return 'elder_after_sword';
    if (flags.house_key) return 'elder_after_key';
    return 'elder_intro';
  }
  if (npcId === 'elder_village') {
    return 'elder_village';
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
