/**
 * Traduzioni di Andryx Legend — italiano / inglese / spagnolo.
 *
 * Il motore di gioco (engine.js, dialog.js, world.js) è JavaScript puro
 * e non può usare l'hook React `useLingua`. Usa invece la lingua corrente
 * memorizzata qui a livello di modulo, impostata da GamePage tramite
 * `setLegendLang()` all'avvio del gioco e quando l'utente cambia lingua.
 *
 * Fallback: se una chiave manca nella lingua corrente ricade sull'italiano.
 *
 * Struttura:
 *   dialogs[id] = { speaker, lines:[] }   — catalogo dialoghi (come DIALOGS)
 *   signs[id]   = "testo del cartello"    — testo con \n per ritorni a capo
 *   zones[id]   = "nome zona"             — etichetta minimap + zone enter
 *   engine[k]   = "stringa"               — overlay HUD, messaggi sistema
 *   meta        = { description, instructions, gameOverTitle }
 */

const LINGUE_OK = { it: true, en: true, es: true };

let linguaCorrente = 'it';

/**
 * Imposta la lingua corrente per il motore Legend.
 * Chiamata da GamePage.jsx prima di avviare il gioco e al cambio di lingua.
 * Se il codice non è supportato, ignora (mantiene il default/italiano).
 */
export function setLegendLang(lingua) {
  if (LINGUE_OK[lingua]) linguaCorrente = lingua;
}

export function getLegendLang() {
  return linguaCorrente;
}

/* ═══════════════════════════════════════════════════════════════════
   ITALIANO — lingua sorgente. Serve anche da fallback per chiavi
   mancanti nelle altre lingue.
   ═══════════════════════════════════════════════════════════════════ */
const IT = {
  dialogs: {
    king_intro: {
      speaker: 'Re Andryx',
      lines: [
        'Andryx, mio coraggioso campione...',
        'Il Re Ombra ha rubato i 3 Cristalli del Pixel.',
        'Senza di essi, Twitchia svanirà nell\'oblio.',
        'Recupera il Cristallo Verde nella Foresta,',
        'il Cristallo Blu nella Caverna delle Gemme,',
        'e il Cristallo Rosso nel suo Castello.',
        'Solo tu puoi salvarci. Buona fortuna!',
      ],
    },
    king_progress: {
      speaker: 'Re Andryx',
      lines: [
        'Hai gia` recuperato {crystals}/3 cristalli.',
        'Continua, eroe! Il regno ti benedice.',
      ],
    },
    king_ending: {
      speaker: 'Re Andryx',
      lines: [
        'Hai... tutti e tre i Cristalli del Pixel!',
        'Twitchia è salva grazie al tuo coraggio.',
        'Sarai ricordato come il più grande eroe',
        'che il regno abbia mai conosciuto!',
        '~ FINE ~',
      ],
    },
    elder_intro: {
      speaker: 'Anziano',
      lines: [
        'Andryx... finalmente sei qui.',
        'Tuo padre, eroe del passato,',
        'nascose la sua spada nella tua casa,',
        'quella con la porta chiusa a ovest.',
        'La chiave e` in uno dei vasi del villaggio.',
        'Cercala: rompi i vasi premendo SPAZIO.',
        'Solo allora potrai sfidare il Re Ombra.',
      ],
    },
    elder_after_key: {
      speaker: 'Anziano',
      lines: [
        'Hai trovato la chiave! Bene.',
        'Vai a recuperare la spada in casa,',
        'la porta e` ora aperta per te.',
      ],
    },
    elder_after_sword: {
      speaker: 'Anziano',
      lines: [
        'La spada di tuo padre risplende ancora.',
        'Sii degno del suo nome, eroe.',
        'Nella Caverna trovai uno scudo:',
        'cercalo, ti proteggera` dalle frecce.',
      ],
    },
    house_key_pickup: {
      speaker: 'Sistema',
      lines: [
        'Hai trovato la CHIAVE DI CASA!',
        'La porta della tua dimora si apre.',
        'Recupera la spada di tuo padre dentro.',
      ],
    },
    merchant: {
      speaker: 'Mercante',
      lines: [
        'Benvenuto nel mio negozio, eroe!',
        'I miei prodotti sono i migliori di Twitchia.',
        'Purtroppo... non accetto rupie oggi.',
        'Torna quando avrai sconfitto il Re Ombra!',
      ],
    },
    child: {
      speaker: 'Bambino',
      lines: [
        'Wow! Sei davvero un eroe?',
        'Mio fratello dice che nei vasi',
        'a volte ci sono cuori e rupie!',
        'Uno luccica di oro pero`...',
        'forse nasconde qualcosa di speciale!',
      ],
    },
    sword_pickup: {
      speaker: 'Sistema',
      lines: [
        'Hai trovato la SPADA DI ANDRYX!',
        'L\'eredita` di tuo padre brilla nella tua mano.',
        'Premi SPAZIO per attaccare nella',
        'direzione in cui guardi.',
        'Ora puoi sfidare i mostri della Foresta!',
      ],
    },
    shield_pickup: {
      speaker: 'Sistema',
      lines: [
        'Hai trovato lo SCUDO DI BRONZO!',
        'Riduce a meta` i danni dei nemici.',
      ],
    },
    crystal_green_pickup: {
      speaker: 'Sistema',
      lines: [
        'Hai recuperato il CRISTALLO VERDE!',
        'Uno dei tre Cristalli del Pixel.',
        'Ora puoi accedere al Castello',
        'tramite il portale a est.',
      ],
    },
    crystal_blue_pickup: {
      speaker: 'Sistema',
      lines: [
        'Hai recuperato il CRISTALLO BLU!',
        'Il potere dell\'acqua fluisce in te.',
      ],
    },
    crystal_red_pickup: {
      speaker: 'Sistema',
      lines: [
        'Hai recuperato il CRISTALLO ROSSO!',
        'L\'ultimo dei Cristalli del Pixel!',
        'Torna dal Re per completare la missione.',
      ],
    },
    heart_container_pickup: {
      speaker: 'Sistema',
      lines: [
        'Contenitore di Cuore!',
        'I tuoi punti vita massimi aumentano.',
      ],
    },
    guardian_intro: {
      speaker: 'Custode',
      lines: [
        'CHI OSA RISVEGLIARE IL CUSTODE?',
        'NESSUNO PASSA SENZA SUPERARE LA PROVA!',
      ],
    },
    shadow_king_intro: {
      speaker: 'Re Ombra',
      lines: [
        'Cosi`, l\'eroe di Twitchia osa sfidarmi.',
        'I tuoi cristalli non basteranno.',
        'Ti annienteranno le mie ombre!',
        'PREPARATI A MORIRE!',
      ],
    },
    victory_guardian: {
      speaker: 'Sistema',
      lines: [
        'Custode sconfitto!',
        'Il Cristallo Blu si materializza.',
      ],
    },
    victory_shadow_king: {
      speaker: 'Sistema',
      lines: [
        'Re Ombra annientato!',
        'L\'oscurità si dissolve.',
        'Twitchia è salva!',
      ],
    },
  },
  signs: {
    village_main: 'Verso est: Foresta Sussurrante.\nVerso sud-est: Portale Caverna.\nLa tua casa: a ovest.',
    village_fountain: 'Fontana del Villaggio.\nL\'acqua riflette le stelle.',
    forest_main: 'Foresta Sussurrante.\nElimina i nemici per\nfar apparire il Cristallo.',
    cave_main: 'Caverna delle Gemme.\nAccendi le 2 torce per\nrisvegliare il Custode.',
    castle_main: 'Castello del Re Ombra.\nIl tuo destino ti attende.',
  },
  zones: {
    village: 'Villaggio dei Pixel',
    forest:  'Foresta Sussurrante',
    cave:    'Caverna delle Gemme',
    castle:  'Castello del Re Ombra',
  },
  engine: {
    doors_open: 'Le porte si aprono!',
    sign_speaker: 'Cartello',
    game_over: 'SEI CADUTO',
    victory: 'VITTORIA!',
    victory_sub: 'Twitchia è salva',
  },
  meta: {
    description: 'Avventura epica top-down stile Zelda: recupera i 3 Cristalli del Pixel e sconfiggi il Re Ombra.',
    instructions: 'WASD/Frecce per muoverti · SPAZIO per attaccare/parlare · Esplora 4 zone, risolvi puzzle, sconfiggi i boss.',
    gameOverTitle: 'Sei caduto in battaglia',
    hubDescription: 'Avventura epica top-down: 4 zone, dialoghi, puzzle, boss. Classifica dedicata.',
  },
};

/* ═══════════════════════════════════════════════════════════════════
   ENGLISH
   ═══════════════════════════════════════════════════════════════════ */
const EN = {
  dialogs: {
    king_intro: {
      speaker: 'King Andryx',
      lines: [
        'Andryx, my brave champion...',
        'The Shadow King has stolen the 3 Pixel Crystals.',
        'Without them, Twitchia will fade into oblivion.',
        'Recover the Green Crystal in the Forest,',
        'the Blue Crystal in the Cave of Gems,',
        'and the Red Crystal in his Castle.',
        'Only you can save us. Good luck!',
      ],
    },
    king_progress: {
      speaker: 'King Andryx',
      lines: [
        'You\'ve already recovered {crystals}/3 crystals.',
        'Keep going, hero! The kingdom blesses you.',
      ],
    },
    king_ending: {
      speaker: 'King Andryx',
      lines: [
        'You have... all three Pixel Crystals!',
        'Twitchia is saved thanks to your courage.',
        'You will be remembered as the greatest hero',
        'the kingdom has ever known!',
        '~ THE END ~',
      ],
    },
    elder_intro: {
      speaker: 'Elder',
      lines: [
        'Andryx... at last you are here.',
        'Your father, a hero of the past,',
        'hid his sword inside your house,',
        'the one with the closed door to the west.',
        'The key is in one of the village jars.',
        'Find it: break the jars by pressing SPACE.',
        'Only then can you challenge the Shadow King.',
      ],
    },
    elder_after_key: {
      speaker: 'Elder',
      lines: [
        'You found the key! Good.',
        'Go retrieve the sword in your house,',
        'the door is now open for you.',
      ],
    },
    elder_after_sword: {
      speaker: 'Elder',
      lines: [
        'Your father\'s sword still shines.',
        'Be worthy of his name, hero.',
        'In the Cave I once found a shield:',
        'seek it out, it will protect you from arrows.',
      ],
    },
    house_key_pickup: {
      speaker: 'System',
      lines: [
        'You found the HOUSE KEY!',
        'The door to your home opens.',
        'Retrieve your father\'s sword inside.',
      ],
    },
    merchant: {
      speaker: 'Merchant',
      lines: [
        'Welcome to my shop, hero!',
        'My goods are the finest in Twitchia.',
        'Sadly... I\'m not taking rupees today.',
        'Come back when you\'ve beaten the Shadow King!',
      ],
    },
    child: {
      speaker: 'Child',
      lines: [
        'Wow! Are you really a hero?',
        'My brother says that in the jars',
        'there are sometimes hearts and rupees!',
        'One of them shines like gold though...',
        'maybe it hides something special!',
      ],
    },
    sword_pickup: {
      speaker: 'System',
      lines: [
        'You found ANDRYX\'S SWORD!',
        'Your father\'s legacy shines in your hand.',
        'Press SPACE to attack in the',
        'direction you\'re facing.',
        'Now you can face the monsters of the Forest!',
      ],
    },
    shield_pickup: {
      speaker: 'System',
      lines: [
        'You found the BRONZE SHIELD!',
        'Halves the damage taken from enemies.',
      ],
    },
    crystal_green_pickup: {
      speaker: 'System',
      lines: [
        'You recovered the GREEN CRYSTAL!',
        'One of the three Pixel Crystals.',
        'Now you can reach the Castle',
        'through the portal to the east.',
      ],
    },
    crystal_blue_pickup: {
      speaker: 'System',
      lines: [
        'You recovered the BLUE CRYSTAL!',
        'The power of water flows through you.',
      ],
    },
    crystal_red_pickup: {
      speaker: 'System',
      lines: [
        'You recovered the RED CRYSTAL!',
        'The last of the Pixel Crystals!',
        'Return to the King to complete the quest.',
      ],
    },
    heart_container_pickup: {
      speaker: 'System',
      lines: [
        'Heart Container!',
        'Your maximum hit points increase.',
      ],
    },
    guardian_intro: {
      speaker: 'Guardian',
      lines: [
        'WHO DARES AWAKEN THE GUARDIAN?',
        'NONE SHALL PASS WITHOUT PROVING THEIR WORTH!',
      ],
    },
    shadow_king_intro: {
      speaker: 'Shadow King',
      lines: [
        'So, the hero of Twitchia dares to challenge me.',
        'Your crystals will not be enough.',
        'My shadows will destroy you!',
        'PREPARE TO DIE!',
      ],
    },
    victory_guardian: {
      speaker: 'System',
      lines: [
        'Guardian defeated!',
        'The Blue Crystal materializes.',
      ],
    },
    victory_shadow_king: {
      speaker: 'System',
      lines: [
        'Shadow King annihilated!',
        'The darkness dissolves.',
        'Twitchia is saved!',
      ],
    },
  },
  signs: {
    village_main: 'East: Whispering Forest.\nSouth-east: Cave Portal.\nYour house: to the west.',
    village_fountain: 'Village Fountain.\nThe water reflects the stars.',
    forest_main: 'Whispering Forest.\nDefeat the enemies to\nmake the Crystal appear.',
    cave_main: 'Cave of Gems.\nLight the 2 torches to\nawaken the Guardian.',
    castle_main: 'Castle of the Shadow King.\nYour destiny awaits.',
  },
  zones: {
    village: 'Pixel Village',
    forest:  'Whispering Forest',
    cave:    'Cave of Gems',
    castle:  'Shadow King\'s Castle',
  },
  engine: {
    doors_open: 'The doors open!',
    sign_speaker: 'Sign',
    game_over: 'YOU FELL',
    victory: 'VICTORY!',
    victory_sub: 'Twitchia is saved',
  },
  meta: {
    description: 'Epic top-down Zelda-style adventure: recover the 3 Pixel Crystals and defeat the Shadow King.',
    instructions: 'WASD/Arrows to move · SPACE to attack/talk · Explore 4 zones, solve puzzles, beat the bosses.',
    gameOverTitle: 'You fell in battle',
    hubDescription: 'Epic top-down adventure: 4 zones, dialogues, puzzles, bosses. Dedicated leaderboard.',
  },
};

/* ═══════════════════════════════════════════════════════════════════
   ESPAÑOL
   ═══════════════════════════════════════════════════════════════════ */
const ES = {
  dialogs: {
    king_intro: {
      speaker: 'Rey Andryx',
      lines: [
        'Andryx, mi valiente campeón...',
        'El Rey Sombra ha robado los 3 Cristales del Píxel.',
        'Sin ellos, Twitchia se desvanecerá en el olvido.',
        'Recupera el Cristal Verde en el Bosque,',
        'el Cristal Azul en la Cueva de las Gemas,',
        'y el Cristal Rojo en su Castillo.',
        'Solo tú puedes salvarnos. ¡Buena suerte!',
      ],
    },
    king_progress: {
      speaker: 'Rey Andryx',
      lines: [
        'Ya has recuperado {crystals}/3 cristales.',
        '¡Continúa, héroe! El reino te bendice.',
      ],
    },
    king_ending: {
      speaker: 'Rey Andryx',
      lines: [
        '¡Tienes... los tres Cristales del Píxel!',
        'Twitchia está a salvo gracias a tu valor.',
        'Serás recordado como el héroe más grande',
        '¡que el reino haya conocido jamás!',
        '~ FIN ~',
      ],
    },
    elder_intro: {
      speaker: 'Anciano',
      lines: [
        'Andryx... por fin estás aquí.',
        'Tu padre, héroe del pasado,',
        'escondió su espada en tu casa,',
        'la de la puerta cerrada al oeste.',
        'La llave está en una vasija del pueblo.',
        'Búscala: rompe las vasijas con ESPACIO.',
        'Solo entonces podrás retar al Rey Sombra.',
      ],
    },
    elder_after_key: {
      speaker: 'Anciano',
      lines: [
        '¡Has encontrado la llave! Bien.',
        'Ve a recuperar la espada en tu casa,',
        'la puerta está ahora abierta para ti.',
      ],
    },
    elder_after_sword: {
      speaker: 'Anciano',
      lines: [
        'La espada de tu padre aún brilla.',
        'Sé digno de su nombre, héroe.',
        'En la Cueva encontré un escudo:',
        'búscalo, te protegerá de las flechas.',
      ],
    },
    house_key_pickup: {
      speaker: 'Sistema',
      lines: [
        '¡Has encontrado la LLAVE DE CASA!',
        'La puerta de tu hogar se abre.',
        'Recupera la espada de tu padre dentro.',
      ],
    },
    merchant: {
      speaker: 'Mercader',
      lines: [
        '¡Bienvenido a mi tienda, héroe!',
        'Mis productos son los mejores de Twitchia.',
        'Lamentablemente... hoy no acepto rupias.',
        '¡Vuelve cuando hayas vencido al Rey Sombra!',
      ],
    },
    child: {
      speaker: 'Niño',
      lines: [
        '¡Guau! ¿De verdad eres un héroe?',
        'Mi hermano dice que en las vasijas',
        '¡a veces hay corazones y rupias!',
        'Una brilla de oro, sin embargo...',
        '¡quizás esconda algo especial!',
      ],
    },
    sword_pickup: {
      speaker: 'Sistema',
      lines: [
        '¡Has encontrado la ESPADA DE ANDRYX!',
        'El legado de tu padre brilla en tu mano.',
        'Pulsa ESPACIO para atacar en la',
        'dirección a la que miras.',
        '¡Ya puedes enfrentarte a los monstruos del Bosque!',
      ],
    },
    shield_pickup: {
      speaker: 'Sistema',
      lines: [
        '¡Has encontrado el ESCUDO DE BRONCE!',
        'Reduce a la mitad el daño de los enemigos.',
      ],
    },
    crystal_green_pickup: {
      speaker: 'Sistema',
      lines: [
        '¡Has recuperado el CRISTAL VERDE!',
        'Uno de los tres Cristales del Píxel.',
        'Ahora puedes acceder al Castillo',
        'a través del portal al este.',
      ],
    },
    crystal_blue_pickup: {
      speaker: 'Sistema',
      lines: [
        '¡Has recuperado el CRISTAL AZUL!',
        'El poder del agua fluye a través de ti.',
      ],
    },
    crystal_red_pickup: {
      speaker: 'Sistema',
      lines: [
        '¡Has recuperado el CRISTAL ROJO!',
        '¡El último de los Cristales del Píxel!',
        'Vuelve con el Rey para completar la misión.',
      ],
    },
    heart_container_pickup: {
      speaker: 'Sistema',
      lines: [
        '¡Contenedor de Corazón!',
        'Tus puntos de vida máximos aumentan.',
      ],
    },
    guardian_intro: {
      speaker: 'Guardián',
      lines: [
        '¿QUIÉN OSA DESPERTAR AL GUARDIÁN?',
        '¡NADIE PASA SIN SUPERAR LA PRUEBA!',
      ],
    },
    shadow_king_intro: {
      speaker: 'Rey Sombra',
      lines: [
        'Así que el héroe de Twitchia osa desafiarme.',
        'Tus cristales no serán suficientes.',
        '¡Mis sombras te aniquilarán!',
        '¡PREPÁRATE A MORIR!',
      ],
    },
    victory_guardian: {
      speaker: 'Sistema',
      lines: [
        '¡Guardián derrotado!',
        'El Cristal Azul se materializa.',
      ],
    },
    victory_shadow_king: {
      speaker: 'Sistema',
      lines: [
        '¡Rey Sombra aniquilado!',
        'La oscuridad se disuelve.',
        '¡Twitchia está a salvo!',
      ],
    },
  },
  signs: {
    village_main: 'Al este: Bosque Susurrante.\nAl sureste: Portal de la Cueva.\nTu casa: al oeste.',
    village_fountain: 'Fuente del Pueblo.\nEl agua refleja las estrellas.',
    forest_main: 'Bosque Susurrante.\nElimina a los enemigos para\nhacer aparecer el Cristal.',
    cave_main: 'Cueva de las Gemas.\nEnciende las 2 antorchas para\ndespertar al Guardián.',
    castle_main: 'Castillo del Rey Sombra.\nTu destino te espera.',
  },
  zones: {
    village: 'Pueblo del Píxel',
    forest:  'Bosque Susurrante',
    cave:    'Cueva de las Gemas',
    castle:  'Castillo del Rey Sombra',
  },
  engine: {
    doors_open: '¡Las puertas se abren!',
    sign_speaker: 'Cartel',
    game_over: 'HAS CAÍDO',
    victory: '¡VICTORIA!',
    victory_sub: 'Twitchia está a salvo',
  },
  meta: {
    description: 'Aventura épica top-down estilo Zelda: recupera los 3 Cristales del Píxel y derrota al Rey Sombra.',
    instructions: 'WASD/Flechas para moverte · ESPACIO para atacar/hablar · Explora 4 zonas, resuelve acertijos, vence a los jefes.',
    gameOverTitle: 'Has caído en batalla',
    hubDescription: 'Aventura épica top-down: 4 zonas, diálogos, acertijos, jefes. Clasificación dedicada.',
  },
};

const CATALOGO = { it: IT, en: EN, es: ES };

/* ─── Helpers di lookup con fallback su italiano ─── */

function pick(cat, path) {
  /* path = ['dialogs', 'king_intro'] — discende nell'oggetto.
     Se uno step manca ritorna undefined. */
  let cur = cat;
  for (const k of path) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

function get(path) {
  const cat = CATALOGO[linguaCorrente] || IT;
  const val = pick(cat, path);
  if (val !== undefined) return val;
  return pick(IT, path);
}

/** Ritorna il dialogo { speaker, lines } nella lingua corrente, fallback IT. */
export function getLegendDialog(id) {
  const d = get(['dialogs', id]);
  if (!d) return null;
  return d;
}

/** Testo di un cartello per chiave (es. 'village_main'). Fallback IT. */
export function getLegendSign(key) {
  return get(['signs', key]) || '';
}

/** Nome di una zona per id (village/forest/cave/castle). Fallback IT. */
export function getLegendZoneName(id) {
  return get(['zones', id]) || id;
}

/** Stringa di gioco dall'engine (doors_open, sign_speaker, game_over, victory, victory_sub). */
export function getLegendEngineText(key) {
  return get(['engine', key]) || '';
}

/** Meta tradotta: description, instructions, gameOverTitle, hubDescription. */
export function getLegendMetaText(key) {
  return get(['meta', key]) || '';
}
