/**
 * Andryx Hourglass — i18n IT/EN/ES.
 * setLang(lingua) imposta la lingua module-level. Le scene importano
 * `t(key)` per recuperare le stringhe correnti.
 */
let LANG = 'it';

const IT = {
  meta: {
    name: 'Andryx Hourglass',
    description: 'Avventura marinaresca ispirata a Phantom Hourglass: naviga, esplora isole, sconfiggi i Phantom.',
    instructions: 'CLICK/TAP per muoverti e attaccare · DRAG per navigare · I per inventario · ESC per menu',
    gameOverTitle: 'La Clessidra si è fermata',
    hubDescription: 'Avventura marinaresca: naviga tra isole, scopri dungeon, affronta il Tempio del Re del Mare.',
    actionLabel: '⚔️',
  },
  ui: {
    loading: 'Caricamento scena...',
    loading_scene: 'Caricamento {scene}...',
    inventory_title: 'INVENTARIO',
    items: 'OGGETTI',
    quest: 'MISSIONE',
    map: 'MAPPA',
    close: 'CHIUDI',
    sail_to: 'Naviga verso {place}',
    set_sail: 'Salpa',
    return_port: 'Torna al porto',
    talk: 'Parla',
    examine: 'Esamina',
    pause: 'PAUSA',
    resume: 'Riprendi',
    save_quit: 'Salva ed esci',
    use: 'Usa',
    equip: 'Equipaggia',
    item_sword: 'Spada',
    item_shield: 'Scudo',
    item_boomerang: 'Boomerang',
    item_bombs: 'Bombe',
    item_bow: 'Arco',
    item_potion: 'Pozione',
    item_key: 'Chiave',
    item_chart: 'Mappa Marina',
    no_item: 'Nessun oggetto',
    timer_remaining: 'Tempo rimasto',
    safe_zone: 'ZONA SICURA',
    phantom_alert: '⚠ PHANTOM IN ALLARME',
    score: 'Punteggio',
    rupees: 'Rupie',
    hp: 'Vita',
  },
  toast: {
    got_sword: '⚔️ Hai ottenuto la SPADA!',
    got_shield: '🛡️ Hai ottenuto lo SCUDO!',
    got_boomerang: '🪃 Hai ottenuto il BOOMERANG!',
    got_bombs: '💣 Hai ottenuto le BOMBE!',
    got_bow: '🏹 Hai ottenuto l\'ARCO!',
    got_chart: '🗺️ Mappa Marina aggiornata!',
    got_key: '🗝️ Chiave del dungeon ottenuta!',
    got_rupees: '💎 +{n} rupie',
    got_heart: '❤ Cuore recuperato',
    got_heart_container: '❤❤ Contenitore di cuori! Vita massima +1',
    door_locked: '🔒 Porta chiusa: serve una chiave',
    door_open: '🗝️ Porta aperta!',
    sail_blocked: '✗ Niente da raggiungere in questa direzione',
    no_potion: '✗ Nessuna pozione',
    full_hp: '✓ Vita già piena',
    potion_used: '🧪 Pozione usata!',
    timer_low: '⚠ Tempo quasi scaduto!',
    safe_entered: '✓ Zona sicura — la clessidra si ricarica',
    saved: '💾 Partita salvata',
  },
  npc: {
    oshus_intro: 'Ah, finalmente ti sei svegliato.\nIo sono Oshus.\nIl Re del Mare è tornato:\nha rapito i guardiani delle isole.\nPrendi questa spada e parti.',
    linebeck_intro: 'Salve! Sono Linebeck,\nfiero capitano della S.S. Pixel.\nTi posso portare ovunque...\nper il giusto prezzo, beninteso.',
    linebeck_sail: 'Pronto a salpare?\nIndica una rotta sulla mappa marina.',
    shopkeeper: 'Benvenuto al mio negozio!\nOggi rupie scarse,\ntorna piu` tardi.',
    elder_temple: 'Nel Tempio del Re del Mare\nil tempo ti consuma.\nResta nelle zone sicure verdi\nper ricaricare la clessidra.',
    sign_dock: 'Molo di Mercay.\nLa S.S. Pixel salpa\nogni volta che lo desideri.',
    sign_temple: 'Tempio del Re del Mare.\nAttento ai Phantom!',
    sign_fire: 'Tempio del Fuoco.\nIl boomerang è qui dentro.',
  },
  scene: {
    sea: 'Mare Aperto',
    mercay: 'Isola di Mercay',
    temple: 'Tempio del Re del Mare',
    fire: 'Tempio del Fuoco',
  },
  dialog: {
    next: '▼',
    speaker_sign: 'Cartello',
    speaker_system: 'Sistema',
  },
};

const EN = {
  meta: {
    name: 'Andryx Hourglass',
    description: 'Seafaring adventure inspired by Phantom Hourglass: sail, explore islands, defeat the Phantoms.',
    instructions: 'CLICK/TAP to move and attack · DRAG to sail · I for inventory · ESC for menu',
    gameOverTitle: 'The Hourglass has stopped',
    hubDescription: 'Seafaring adventure: sail between islands, find dungeons, face the Temple of the Ocean King.',
    actionLabel: '⚔️',
  },
  ui: {
    loading: 'Loading scene...',
    loading_scene: 'Loading {scene}...',
    inventory_title: 'INVENTORY',
    items: 'ITEMS',
    quest: 'QUEST',
    map: 'MAP',
    close: 'CLOSE',
    sail_to: 'Sail to {place}',
    set_sail: 'Set sail',
    return_port: 'Return to port',
    talk: 'Talk',
    examine: 'Examine',
    pause: 'PAUSE',
    resume: 'Resume',
    save_quit: 'Save & quit',
    use: 'Use',
    equip: 'Equip',
    item_sword: 'Sword',
    item_shield: 'Shield',
    item_boomerang: 'Boomerang',
    item_bombs: 'Bombs',
    item_bow: 'Bow',
    item_potion: 'Potion',
    item_key: 'Key',
    item_chart: 'Sea Chart',
    no_item: 'No item',
    timer_remaining: 'Time left',
    safe_zone: 'SAFE ZONE',
    phantom_alert: '⚠ PHANTOM ALERT',
    score: 'Score',
    rupees: 'Rupees',
    hp: 'HP',
  },
  toast: {
    got_sword: '⚔️ You got the SWORD!',
    got_shield: '🛡️ You got the SHIELD!',
    got_boomerang: '🪃 You got the BOOMERANG!',
    got_bombs: '💣 You got the BOMBS!',
    got_bow: '🏹 You got the BOW!',
    got_chart: '🗺️ Sea Chart updated!',
    got_key: '🗝️ Dungeon key obtained!',
    got_rupees: '💎 +{n} rupees',
    got_heart: '❤ Heart recovered',
    got_heart_container: '❤❤ Heart Container! Max HP +1',
    door_locked: '🔒 Door locked: need a key',
    door_open: '🗝️ Door opened!',
    sail_blocked: '✗ Nothing to reach this way',
    no_potion: '✗ No potions',
    full_hp: '✓ HP already full',
    potion_used: '🧪 Potion used!',
    timer_low: '⚠ Time almost out!',
    safe_entered: '✓ Safe zone — hourglass refilling',
    saved: '💾 Game saved',
  },
  npc: {
    oshus_intro: 'Ah, you\'re finally awake.\nI am Oshus.\nThe Ocean King is back:\nhe took the island guardians.\nTake this sword and depart.',
    linebeck_intro: 'Hello there! I\'m Linebeck,\nproud captain of the S.S. Pixel.\nI\'ll take you anywhere...\nfor the right price, mind you.',
    linebeck_sail: 'Ready to set sail?\nMark a route on the sea chart.',
    shopkeeper: 'Welcome to my shop!\nRupees are tight today,\ncome back later.',
    elder_temple: 'In the Temple of the Ocean King\ntime drains your life.\nStand on green safe zones\nto refill the hourglass.',
    sign_dock: 'Mercay docks.\nThe S.S. Pixel sets sail\nwhenever you want.',
    sign_temple: 'Temple of the Ocean King.\nBeware of Phantoms!',
    sign_fire: 'Temple of Fire.\nThe boomerang is inside.',
  },
  scene: {
    sea: 'Open Sea',
    mercay: 'Mercay Island',
    temple: 'Temple of the Ocean King',
    fire: 'Temple of Fire',
  },
  dialog: {
    next: '▼',
    speaker_sign: 'Sign',
    speaker_system: 'System',
  },
};

const ES = {
  meta: {
    name: 'Andryx Hourglass',
    description: 'Aventura marinera inspirada en Phantom Hourglass: navega, explora islas, derrota a los Phantom.',
    instructions: 'CLIC/TAP para moverte y atacar · ARRASTRA para navegar · I inventario · ESC menú',
    gameOverTitle: 'El Reloj se ha detenido',
    hubDescription: 'Aventura marinera: navega entre islas, descubre mazmorras, enfréntate al Templo del Rey del Mar.',
    actionLabel: '⚔️',
  },
  ui: {
    loading: 'Cargando escena...',
    loading_scene: 'Cargando {scene}...',
    inventory_title: 'INVENTARIO',
    items: 'OBJETOS',
    quest: 'MISIÓN',
    map: 'MAPA',
    close: 'CERRAR',
    sail_to: 'Navega a {place}',
    set_sail: 'Zarpar',
    return_port: 'Volver al puerto',
    talk: 'Hablar',
    examine: 'Examinar',
    pause: 'PAUSA',
    resume: 'Reanudar',
    save_quit: 'Guardar y salir',
    use: 'Usar',
    equip: 'Equipar',
    item_sword: 'Espada',
    item_shield: 'Escudo',
    item_boomerang: 'Bumerán',
    item_bombs: 'Bombas',
    item_bow: 'Arco',
    item_potion: 'Poción',
    item_key: 'Llave',
    item_chart: 'Mapa Marítimo',
    no_item: 'Sin objeto',
    timer_remaining: 'Tiempo restante',
    safe_zone: 'ZONA SEGURA',
    phantom_alert: '⚠ ALERTA PHANTOM',
    score: 'Puntos',
    rupees: 'Rupias',
    hp: 'Vida',
  },
  toast: {
    got_sword: '⚔️ ¡Has obtenido la ESPADA!',
    got_shield: '🛡️ ¡Has obtenido el ESCUDO!',
    got_boomerang: '🪃 ¡Has obtenido el BUMERÁN!',
    got_bombs: '💣 ¡Has obtenido las BOMBAS!',
    got_bow: '🏹 ¡Has obtenido el ARCO!',
    got_chart: '🗺️ ¡Mapa Marítimo actualizado!',
    got_key: '🗝️ ¡Llave de mazmorra obtenida!',
    got_rupees: '💎 +{n} rupias',
    got_heart: '❤ Corazón recuperado',
    got_heart_container: '❤❤ ¡Contenedor de corazones! Vida máx +1',
    door_locked: '🔒 Puerta cerrada: necesitas una llave',
    door_open: '🗝️ ¡Puerta abierta!',
    sail_blocked: '✗ Nada que alcanzar por aquí',
    no_potion: '✗ Sin pociones',
    full_hp: '✓ Vida ya llena',
    potion_used: '🧪 ¡Poción usada!',
    timer_low: '⚠ ¡Tiempo casi agotado!',
    safe_entered: '✓ Zona segura — el reloj se recarga',
    saved: '💾 Partida guardada',
  },
  npc: {
    oshus_intro: 'Ah, por fin despiertas.\nSoy Oshus.\nEl Rey del Mar ha vuelto:\nse llevó a los guardianes.\nToma esta espada y parte.',
    linebeck_intro: '¡Hola! Soy Linebeck,\norgulloso capitán de la S.S. Pixel.\nTe llevo a cualquier parte...\npor el precio justo, claro.',
    linebeck_sail: '¿Listo para zarpar?\nMarca una ruta en el mapa.',
    shopkeeper: '¡Bienvenido a mi tienda!\nHoy escasean las rupias,\nvuelve más tarde.',
    elder_temple: 'En el Templo del Rey del Mar\nel tiempo te consume.\nQuédate en zonas verdes seguras\npara recargar el reloj.',
    sign_dock: 'Muelle de Mercay.\nLa S.S. Pixel zarpa\ncuando lo desees.',
    sign_temple: 'Templo del Rey del Mar.\n¡Cuidado con los Phantom!',
    sign_fire: 'Templo del Fuego.\nEl bumerán está dentro.',
  },
  scene: {
    sea: 'Mar Abierto',
    mercay: 'Isla de Mercay',
    temple: 'Templo del Rey del Mar',
    fire: 'Templo del Fuego',
  },
  dialog: {
    next: '▼',
    speaker_sign: 'Cartel',
    speaker_system: 'Sistema',
  },
};

const CATALOG = { it: IT, en: EN, es: ES };

export function setLang(lingua) {
  if (lingua && CATALOG[lingua]) LANG = lingua;
}

/** Restituisce una stringa dal catalogo. Supporta path "section.key"
 *  o "section.key.sub". Sostituisce {placeholder} con `params`. */
export function t(path, params) {
  const segs = path.split('.');
  let cur = CATALOG[LANG] || IT;
  for (const s of segs) {
    if (cur && typeof cur === 'object' && s in cur) cur = cur[s];
    else { cur = null; break; }
  }
  if (cur == null) {
    /* Fallback IT */
    cur = IT;
    for (const s of segs) {
      if (cur && typeof cur === 'object' && s in cur) cur = cur[s];
      else { cur = null; break; }
    }
  }
  if (typeof cur !== 'string') return path;
  if (params) {
    return cur.replace(/\{(\w+)\}/g, (_, k) => (params[k] != null ? String(params[k]) : `{${k}}`));
  }
  return cur;
}
