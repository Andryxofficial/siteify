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
      'Prima di partire, vai nella tua casa.',
      'Un vaso dorato nasconde la chiave di casa.',
      'Dentro troverai lo scudo di tua madre.',
      'Poi vai dal saggio nella grotta a nord-ovest:',
      'ti darà la spada di tuo padre.',
      'Solo con entrambi potrai avventurarti fuori.',
      'Buona fortuna, eroe!',
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
      'Andryx... ti stavo aspettando.',
      'Il Re Ombra ha mosso guerra a Twitchia.',
      'Non puoi affrontarlo a mani nude.',
      'Prendi questa.',
      /* Omaggio a The Legend of Zelda (1986): "It's dangerous to go alone! Take this."
         — il vecchietto nella caverna che dona la spada all'eroe. */
      '— È pericoloso andare da solo. —',
      'Era la spada di tuo padre.',
      'Ora è tua. Usala bene, eroe.',
      'Ricorda: avrai bisogno anche dello scudo',
      'prima di avventurarti fuori dal villaggio.',
      'Lo trovi nella tua casa — usa il vaso dorato.',
    ],
    onComplete: { setFlag: 'has_sword', setQuest: 'has_sword', playSfx: 'pickup' },
  },

  elder_after_sword: {
    speaker: 'Anziano',
    portrait: 'NPC_ELDER',
    lines: [
      'La spada di tuo padre risplende ancora.',
      'Sii degno del suo nome, eroe.',
      'Recupera lo scudo a casa tua,',
      'poi parti per la Foresta a est.',
    ],
  },

  elder_village: {
    speaker: 'Anziano del Villaggio',
    portrait: 'NPC_ELDER',
    lines: [
      'Ah, finalmente sei tornato figlio mio.',
      'La grotta a nord-ovest nasconde un vecchio saggio.',
      'Entra tra le rocce — ti aspetta con la spada.',
      'E ricorda: nella tua casa c\'è lo scudo.',
      'Il vaso dorato accanto all\'ingresso ne ha la chiave.',
    ],
  },

  house_key_pickup: {
    speaker: 'Sistema',
    portrait: null,
    lines: [
      'Hai trovato la CHIAVE DI CASA!',
      'La porta della tua dimora si apre.',
      'Dentro troverai lo scudo di tua madre.',
    ],
    onComplete: { setFlag: 'house_key' },
  },

  andryx_house_enter: {
    speaker: 'Narratore',
    portrait: 'NPC_ELDER',
    lines: [
      'Casa di Andryx.',
      'L\'odore di legno antico e cera di candela',
      'ti avvolge come un ricordo lontano.',
      'Tuo padre partì da qui per sempre.',
      'Ciò che lasciò è ancora qui ad aspettarti.',
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
      'Uno luccica di oro pero`...',
      'forse nasconde qualcosa di speciale!',
      'È vicino alla porta della tua casa!',
    ],
  },

  sword_pickup: {
    speaker: 'Sistema',
    portrait: 'ITEM_SWORD',
    lines: [
      'Hai trovato la SPADA DI ANDRYX!',
      'L\'eredita` di tuo padre brilla nella tua mano.',
      'Premi SPAZIO per attaccare nella',
      'direzione in cui guardi.',
      'Ora recupera lo scudo a casa tua!',
    ],
    onComplete: { setQuest: 'has_sword', setFlag: 'has_sword' },
  },

  shield_pickup: {
    speaker: 'Sistema',
    portrait: 'ITEM_SHIELD',
    lines: [
      'Hai trovato lo SCUDO DI TUA MADRE!',
      'Riduce a metà i danni dei nemici.',
      'Con spada e scudo puoi avventurarti',
      'fuori dal Villaggio dei Pixel.',
      'Parti per la Foresta a est!',
    ],
    onComplete: { setFlag: 'has_shield' },
  },

  crystal_green_pickup: {
    speaker: 'Sistema',
    portrait: 'ITEM_CRYSTAL_GREEN',
    lines: [
      'Hai recuperato il CRISTALLO VERDE!',
      'Uno dei tre Cristalli del Pixel.',
      'Torna al Villaggio e imbocca',
      'la strada a sud per la Caverna.',
    ],
    onComplete: { setQuest: 'has_crystal_green', setFlag: 'has_crystal_green' },
  },

  crystal_blue_pickup: {
    speaker: 'Sistema',
    portrait: 'ITEM_CRYSTAL_BLUE',
    lines: [
      'Hai recuperato il CRISTALLO BLU!',
      'Il potere dell\'acqua fluisce in te.',
      'La strada a NORD del Villaggio',
      'verso il Castello è ora aperta.',
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
      'GRAAAARGH!',
      'CHI OSA RISVEGLIARE IL CUSTODE?',
      'Le torce bruciano... il patto è sigillato.',
      'NESSUNO PASSA SENZA SUPERARE LA PROVA!',
    ],
  },

  shadow_king_intro: {
    speaker: 'Re Ombra',
    portrait: 'BOSS_SHADOW_KING',
    lines: [
      'Così... l\'eroe di Twitchia osa sfidarmi.',
      'Ho visto cadere eroi più forti di te.',
      'I Cristalli del Pixel appartengono a ME.',
      'I tuoi compagni moriranno tutti.',
      'PREPARATI A SPROFONDARE NELL\'OMBRA!',
    ],
  },

  forest_troll_intro: {
    speaker: 'Troll della Foresta',
    portrait: 'NPC_ELDER',
    lines: [
      'UGRRRRH!',
      'Piccolo umano entrare nel mio bosco...',
      'Troll schiacciare umano come mosca!',
      'NESSUNO PASSA DAL TROLL!',
    ],
  },

  forest_troll_victory: {
    speaker: 'Sistema',
    portrait: null,
    lines: [
      'Il Troll della Foresta è sconfitto!',
      'La foresta profonda è ora esplorablie.',
      'Il Cristallo Verde si sta materializzando...',
    ],
  },

  castle_boss_awakens: {
    speaker: 'Re Ombra',
    portrait: 'BOSS_SHADOW_KING',
    lines: [
      '...le mie guardie... cadute!',
      'Bene, allora... affrontami tu stesso.',
      'Mostrerò al mondo la fine di Andryx!',
    ],
  },

  victory_guardian: {
    speaker: 'Sistema',
    portrait: 'ITEM_CRYSTAL_BLUE',
    lines: [
      'Custode sconfitto!',
      'Il Cristallo Blu si materializza.',
      'Un contenitore di cuore appare nella stanza.',
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

  /* ─── Prima visita ai dungeon ─── */
  village_intro: {
    speaker: 'Narratore',
    portrait: 'NPC_ELDER',
    lines: [
      'Villaggio dei Pixel. La tua casa.',
      'Il Re Andryx ti ha convocato.',
      'Parla con lui: porta la tua spada e scudo.',
      '[ WASD / Frecce → movimento ]',
      '[ SPAZIO / Tasto azione → attacco / interazione ]',
    ],
  },

  forest_enter: {
    speaker: 'Narratore',
    portrait: 'NPC_ELDER',
    lines: [
      'Foresta Sussurrante.',
      'Il vento porta con sé un odore di muschio',
      'e qualcosa di più oscuro...',
      'I nemici del Re Ombra pattugliano questi boschi.',
      'Una presenza enorme si muove nella foresta profonda.',
      'Elimina tutti i mostri per far apparire il Cristallo.',
    ],
  },

  cave_enter: {
    speaker: 'Narratore',
    portrait: 'NPC_ELDER',
    lines: [
      'Caverna delle Gemme.',
      'Il freddo ti avvolge come un mantello di pietra.',
      'Echi di battaglie lontane risuonano nelle gallerie.',
      'Sposta i blocchi sulle piastre per aprire le porte.',
      'Poi accendi le due torce per risvegliare il Custode.',
      'Solo sconfiggendolo otterrai il Cristallo Blu.',
    ],
  },

  castle_enter: {
    speaker: 'Re Ombra',
    portrait: 'BOSS_SHADOW_KING',
    lines: [
      '...',
      'Sei arrivato fin qui, piccolo eroe.',
      'Twitchia ti ha cresciuto bene.',
      'Peccato che morirai qui.',
      'Sconfiggi tutte le mie guardie se ci riesci.',
      'Solo allora mi degnerò di affrontarti di persona.',
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
    if (flags.has_sword) return 'elder_after_sword';
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
