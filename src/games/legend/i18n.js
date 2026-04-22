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
        'È pericoloso andare da solo...',
        'Prendi questa spada!',
        'Era di tuo padre, eroe leggendario.',
        'Raccoglila dal pavimento vicino a me.',
        'Lo scudo è nella tua casa a ovest:',
        'rompi il vaso dorato fuori casa per la chiave.',
        'Poi esplora la Foresta e la Caverna a sud.',
      ],
    },
    elder_after_key: {
      speaker: 'Anziano',
      lines: [
        'Hai trovato la chiave! Bene.',
        'Vai a recuperare lo scudo in casa,',
        'la porta è ora aperta per te.',
      ],
    },
    elder_after_sword: {
      speaker: 'Anziano',
      lines: [
        'La spada di tuo padre è nelle tue mani.',
        'Sii degno del suo nome, eroe.',
        'Nella tua casa c\'è lo scudo di tua madre:',
        'proteggiti e affronta i dungeon a sud.',
      ],
    },
    house_key_pickup: {
      speaker: 'Sistema',
      lines: [
        'Hai trovato la CHIAVE DI CASA!',
        'La porta della tua dimora si apre.',
        'Recupera lo scudo di tua madre dentro.',
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
    elder_village: {
      speaker: 'Anziano del Villaggio',
      lines: [
        'Ah, sei tu, Andryx.',
        'Il vecchio saggio nella grotta a nord-ovest',
        'ha qualcosa di importante per te.',
        'E ricorda: nella tua casa c\'è lo scudo.',
        'Usa il vaso dorato per trovare la chiave.',
      ],
    },
    andryx_house_enter: {
      speaker: 'Narratore',
      lines: [
        'Casa di Andryx.',
        'L\'odore di legno antico e cera di candela',
        'ti avvolge come un ricordo lontano.',
        'Ciò che lasciò tua madre è ancora qui.',
      ],
    },
    forest_troll_intro: {
      speaker: 'Troll della Foresta',
      lines: [
        'UGRRRRH!',
        'Piccolo umano entrare nel mio bosco...',
        'Troll schiacciare umano come mosca!',
        'NESSUNO PASSA DAL TROLL!',
      ],
    },
    forest_troll_victory: {
      speaker: 'Sistema',
      lines: [
        'Il Troll della Foresta è sconfitto!',
        'Il Cristallo Verde si sta materializzando...',
      ],
    },
    castle_boss_awakens: {
      speaker: 'Re Ombra',
      lines: [
        '...le mie guardie... cadute!',
        'Bene, allora... affrontami tu stesso.',
        'Mostrerò al mondo la fine di Andryx!',
      ],
    },
    village_intro: {
      speaker: 'Narratore',
      lines: [
        'Villaggio dei Pixel. La tua casa.',
        'Il Re Andryx ti ha convocato.',
        '[ WASD / Frecce → movimento ]',
        '[ SPAZIO → attacco / interazione ]',
        'Parla con il Re per iniziare l\'avventura.',
      ],
    },
    forest_enter: {
      speaker: 'Narratore',
      lines: [
        'Foresta Sussurrante.',
        'Il vento porta con sé qualcosa di oscuro...',
        'I nemici del Re Ombra pattugliano questi boschi.',
        'Una presenza enorme si muove nella foresta profonda.',
        'Elimina tutti i mostri per far apparire il Cristallo.',
      ],
    },
    cave_enter: {
      speaker: 'Narratore',
      lines: [
        'Caverna delle Gemme.',
        'Il freddo ti avvolge come un mantello di pietra.',
        'Sposta i blocchi sulle piastre per aprire le porte.',
        'Poi accendi le due torce per risvegliare il Custode.',
        'Solo sconfiggendolo otterrai il Cristallo Blu.',
      ],
    },
    castle_enter: {
      speaker: 'Re Ombra',
      lines: [
        '...',
        'Sei arrivato fin qui, piccolo eroe.',
        'Peccato che morirai qui.',
        'Sconfiggi tutte le mie guardie se ci riesci.',
        'Solo allora mi degnerò di affrontarti di persona.',
      ],
    },
  },
  signs: {
    village_main: 'Crocevia del Villaggio.\nN: Castello (Cristallo Blu)\nS: Caverna delle Gemme\nE: Foresta Sussurrante\nO: Pianura dell\'Ovest',
    village_fountain: 'Fontana del Villaggio.\nL\'acqua riflette le stelle.',
    village_castle: 'Strada per il Castello.\nRichiede il Cristallo Blu.',
    village_cave_hint: 'Grotta del Saggio.\nUn anziano vive qui.\nHa qualcosa di importante\nper te, eroe.',
    village_house: 'Casa di Andryx.\nLo scudo di tua madre\nè custodito qui dentro.\nUsa il vaso dorato per la chiave.',
    village_east: 'Foresta Sussurrante.\nPericoloso! Servono\nspada e scudo.',
    village_south: 'Caverna delle Gemme.\nPorta spada e scudo\nper sopravvivere!',
    forest_main: 'Foresta Sussurrante.\nElimina i nemici per\nfar apparire il Cristallo.',
    forest_troll_hint: 'Attenzione!\nSi sente un rumore pesante\nnella foresta profonda...',
    cave_main: 'Caverna delle Gemme.\nAccendi le 2 torce per\nrisvegliare il Custode.\nLa chiave apre la porta.',
    cave_deep: 'Sento passi pesanti\nprovenire dal fondo...\nSii prudente, viandante.',
    castle_main: 'Castello del Re Ombra.\nIl tuo destino ti attende.\nSconfiggi tutte le guardie\nper risvegliare il Re.',
    castle_lava: 'Attento alle piastrelle\nincandescenti di lava!',
  },
  zones: {
    village: 'Villaggio dei Pixel',
    forest:  'Foresta Sussurrante',
    cave:    'Caverna delle Gemme',
    castle:  'Castello del Re Ombra',
    andryx_house: 'Casa di Andryx',
  },
  engine: {
    doors_open: 'Le porte si aprono!',
    sign_speaker: 'Cartello',
    game_over: 'SEI CADUTO',
    victory: 'VITTORIA!',
    victory_sub: 'Twitchia è salva',
    boss_awakens: '⚠ Il Custode si risveglia!',
    puzzle_solved: '✅ Puzzle risolto! La porta si apre!',
    chest_open: '📦 Hai trovato qualcosa!',
    key_used: '🗝️ Porta aperta!',
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
        'It\'s dangerous to go alone...',
        'Take this sword!',
        'It belonged to your father, a legendary hero.',
        'Pick it up from the floor near me.',
        'Your shield is in your house to the west:',
        'break the golden jar outside for the key.',
        'Then explore the Forest and Cave to the south.',
      ],
    },
    elder_after_key: {
      speaker: 'Elder',
      lines: [
        'You found the key! Good.',
        'Go retrieve the shield in your house,',
        'the door is now open for you.',
      ],
    },
    elder_after_sword: {
      speaker: 'Elder',
      lines: [
        'Your father\'s sword is in your hands.',
        'Be worthy of his name, hero.',
        'Your mother\'s shield is in your house:',
        'protect yourself and face the dungeons to the south.',
      ],
    },
    house_key_pickup: {
      speaker: 'System',
      lines: [
        'You found the HOUSE KEY!',
        'The door to your home opens.',
        'Retrieve your mother\'s shield inside.',
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
    elder_village: {
      speaker: 'Village Elder',
      lines: [
        'Ah, it\'s you, Andryx.',
        'The old sage in the cave to the north-west',
        'has something important for you.',
        'And remember: your shield is in your house.',
        'Use the golden pot to find the key.',
      ],
    },
    andryx_house_enter: {
      speaker: 'Narrator',
      lines: [
        'Andryx\'s House.',
        'The smell of old wood and candle wax',
        'wraps around you like a distant memory.',
        'What your mother left behind is still here.',
      ],
    },
    forest_troll_intro: {
      speaker: 'Forest Troll',
      lines: [
        'UGRRRRH!',
        'Little human enter MY forest...',
        'Troll CRUSH human like bug!',
        'NOBODY PASSES THE TROLL!',
      ],
    },
    forest_troll_victory: {
      speaker: 'System',
      lines: [
        'Forest Troll defeated!',
        'The Green Crystal is materializing...',
      ],
    },
    castle_boss_awakens: {
      speaker: 'Shadow King',
      lines: [
        '...my guards... fallen!',
        'Very well... face me yourself then.',
        'I will show the world the end of Andryx!',
      ],
    },
    village_intro: {
      speaker: 'Narrator',
      lines: [
        'Pixel Village. Your home.',
        'King Andryx has summoned you.',
        '[ WASD / Arrows → movement ]',
        '[ SPACE → attack / interact ]',
        'Talk to the King to begin the adventure.',
      ],
    },
    forest_enter: {
      speaker: 'Narrator',
      lines: [
        'Whispering Forest.',
        'The wind carries something dark...',
        'The Shadow King\'s enemies patrol these woods.',
        'An enormous presence stirs in the deep forest.',
        'Defeat all monsters to make the Crystal appear.',
      ],
    },
    cave_enter: {
      speaker: 'Narrator',
      lines: [
        'Cave of Gems.',
        'Cold wraps around you like a cloak of stone.',
        'Push blocks onto pressure plates to open doors.',
        'Then light the two torches to awaken the Guardian.',
        'Only by defeating it will you obtain the Blue Crystal.',
      ],
    },
    castle_enter: {
      speaker: 'Shadow King',
      lines: [
        '...',
        'You made it this far, little hero.',
        'Pity you will die here.',
        'Defeat all my guards if you can.',
        'Only then will I deign to face you personally.',
      ],
    },
  },
  signs: {
    village_main: 'Village Crossroads.\nN: Castle (Blue Crystal)\nS: Cave of Gems\nE: Whispering Forest\nW: Western Plains',
    village_fountain: 'Village Fountain.\nThe water reflects the stars.',
    village_castle: 'Road to the Castle.\nRequires the Blue Crystal.',
    village_cave_hint: 'Sage\'s Cave.\nA wise elder lives here.\nHe has something important\nfor you, hero.',
    village_house: 'Andryx\'s House.\nYour mother\'s shield\nis kept inside.\nUse the golden jar for the key.',
    village_east: 'Whispering Forest.\nDangerous! You need\nsword and shield.',
    village_south: 'Cave of Gems.\nBring sword and shield\nto survive!',
    forest_main: 'Whispering Forest.\nDefeat the enemies to\nmake the Crystal appear.',
    forest_troll_hint: 'Warning!\nA heavy sound comes\nfrom the deep forest...',
    cave_main: 'Cave of Gems.\nLight the 2 torches to\nawaken the Guardian.\nThe key opens the door.',
    cave_deep: 'I hear heavy footsteps\ncoming from the depths...\nBe careful, wanderer.',
    castle_main: 'Castle of the Shadow King.\nYour destiny awaits.\nDefeat all guards\nto awaken the King.',
    castle_lava: 'Beware of the\nincandescent lava tiles!',
  },
  zones: {
    village: 'Pixel Village',
    forest:  'Whispering Forest',
    cave:    'Cave of Gems',
    castle:  'Shadow King\'s Castle',
    andryx_house: 'Andryx\'s House',
  },
  engine: {
    doors_open: 'The doors open!',
    sign_speaker: 'Sign',
    game_over: 'YOU FELL',
    victory: 'VICTORY!',
    victory_sub: 'Twitchia is saved',
    boss_awakens: '⚠ The Guardian awakens!',
    puzzle_solved: '✅ Puzzle solved! The door opens!',
    chest_open: '📦 You found something!',
    key_used: '🗝️ Door opened!',
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
        'Es peligroso ir solo...',
        '¡Toma esta espada!',
        'Perteneció a tu padre, un héroe legendario.',
        'Recógela del suelo cerca de mí.',
        'Tu escudo está en tu casa al oeste:',
        'rompe la vasija dorada fuera para la llave.',
        'Luego explora el Bosque y la Cueva al sur.',
      ],
    },
    elder_after_key: {
      speaker: 'Anciano',
      lines: [
        '¡Has encontrado la llave! Bien.',
        'Ve a recuperar el escudo en tu casa,',
        'la puerta está ahora abierta para ti.',
      ],
    },
    elder_after_sword: {
      speaker: 'Anciano',
      lines: [
        'La espada de tu padre está en tus manos.',
        'Sé digno de su nombre, héroe.',
        'El escudo de tu madre está en tu casa:',
        'protégete y afronta las mazmorras al sur.',
      ],
    },
    house_key_pickup: {
      speaker: 'Sistema',
      lines: [
        '¡Has encontrado la LLAVE DE CASA!',
        'La puerta de tu hogar se abre.',
        'Recupera el escudo de tu madre dentro.',
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
    elder_village: {
      speaker: 'Anciano del Pueblo',
      lines: [
        'Ah, eres tú, Andryx.',
        'El viejo sabio en la cueva al noroeste',
        'tiene algo importante para ti.',
        'Y recuerda: tu escudo está en tu casa.',
        'Usa la vasija dorada para encontrar la llave.',
      ],
    },
    andryx_house_enter: {
      speaker: 'Narrador',
      lines: [
        'Casa de Andryx.',
        'El olor a madera vieja y cera de vela',
        'te envuelve como un recuerdo lejano.',
        'Lo que dejó tu madre todavía está aquí.',
      ],
    },
    forest_troll_intro: {
      speaker: 'Trol del Bosque',
      lines: [
        '¡UGRRRRH!',
        'Humano pequeño entrar en MI bosque...',
        '¡Trol APLASTAR humano como mosca!',
        '¡NADIE PASA POR EL TROL!',
      ],
    },
    forest_troll_victory: {
      speaker: 'Sistema',
      lines: [
        '¡Trol del Bosque derrotado!',
        'El Cristal Verde está materializándose...',
      ],
    },
    castle_boss_awakens: {
      speaker: 'Rey Sombra',
      lines: [
        '...mis guardias... ¡caídos!',
        'Bien entonces... enfréntame tú mismo.',
        '¡Mostraré al mundo el fin de Andryx!',
      ],
    },
    village_intro: {
      speaker: 'Narrador',
      lines: [
        'Pueblo del Píxel. Tu hogar.',
        'El Rey Andryx te ha convocado.',
        '[ WASD / Flechas → movimiento ]',
        '[ ESPACIO → atacar / interactuar ]',
        'Habla con el Rey para comenzar la aventura.',
      ],
    },
    forest_enter: {
      speaker: 'Narrador',
      lines: [
        'Bosque Susurrante.',
        'El viento trae algo oscuro...',
        'Los enemigos del Rey Sombra patrullan estos bosques.',
        'Una enorme presencia se mueve en el bosque profundo.',
        'Elimina todos los monstruos para que aparezca el Cristal.',
      ],
    },
    cave_enter: {
      speaker: 'Narrador',
      lines: [
        'Cueva de las Gemas.',
        'El frío te envuelve como un manto de piedra.',
        'Mueve bloques sobre las baldosas para abrir puertas.',
        'Luego enciende las dos antorchas para despertar al Guardián.',
        'Solo derrotándolo obtendrás el Cristal Azul.',
      ],
    },
    castle_enter: {
      speaker: 'Rey Sombra',
      lines: [
        '...',
        'Has llegado hasta aquí, pequeño héroe.',
        'Lástima que morirás aquí.',
        'Derrota a todos mis guardias si puedes.',
        'Solo entonces me dignaré a enfrentarte personalmente.',
      ],
    },
  },
  signs: {
    village_main: 'Cruce del Pueblo.\nN: Castillo (Cristal Azul)\nS: Cueva de las Gemas\nE: Bosque Susurrante\nO: Llanura del Oeste',
    village_fountain: 'Fuente del Pueblo.\nEl agua refleja las estrellas.',
    village_castle: 'Camino al Castillo.\nRequiere el Cristal Azul.',
    village_cave_hint: 'Cueva del Sabio.\nUn anciano vive aquí.\nTiene algo importante\npara ti, héroe.',
    village_house: 'Casa de Andryx.\nEl escudo de tu madre\nestá guardado aquí dentro.\nUsa la vasija dorada para la llave.',
    village_east: 'Bosque Susurrante.\n¡Peligroso! Necesitas\nespada y escudo.',
    village_south: 'Cueva de las Gemas.\n¡Lleva espada y escudo\npara sobrevivir!',
    forest_main: 'Bosque Susurrante.\nElimina a los enemigos para\nhacer aparecer el Cristal.',
    forest_troll_hint: '¡Atención!\nSe oye un ruido pesado\nen el bosque profundo...',
    cave_main: 'Cueva de las Gemas.\nEnciende las 2 antorchas para\ndespertar al Guardián.\nLa llave abre la puerta.',
    cave_deep: 'Escucho pasos pesados\nprovenientes del fondo...\nSé prudente, viajero.',
    castle_main: 'Castillo del Rey Sombra.\nTu destino te espera.\nDerrota a todos los guardias\npara despertar al Rey.',
    castle_lava: '¡Cuidado con las\nbaldosas de lava incandescente!',
  },
  zones: {
    village: 'Pueblo del Píxel',
    forest:  'Bosque Susurrante',
    cave:    'Cueva de las Gemas',
    castle:  'Castillo del Rey Sombra',
    andryx_house: 'Casa de Andryx',
  },
  engine: {
    doors_open: '¡Las puertas se abren!',
    sign_speaker: 'Cartel',
    game_over: 'HAS CAÍDO',
    victory: '¡VICTORIA!',
    victory_sub: 'Twitchia está a salvo',
    boss_awakens: '⚠ ¡El Guardián despierta!',
    puzzle_solved: '✅ ¡Puzzle resuelto! ¡La puerta se abre!',
    chest_open: '📦 ¡Has encontrado algo!',
    key_used: '🗝️ ¡Puerta abierta!',
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
