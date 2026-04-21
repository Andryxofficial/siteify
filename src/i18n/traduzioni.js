/**
 * Catalogo traduzioni — Italiano / Inglese / Spagnolo.
 *
 * Struttura piatta: chiavi "namespace.sotto.chiave" per semplicità.
 * Se una chiave manca in una lingua si usa fallback italiano (lingua sorgente).
 *
 * Per aggiungere stringhe a una nuova sezione, aggiungere la chiave in tutte
 * e tre le lingue. Le chiavi mancanti verranno loggate in console in dev.
 */

export const LINGUE_DISPONIBILI = [
  { codice: 'it', nome: 'Italiano', bandiera: '🇮🇹' },
  { codice: 'en', nome: 'English',  bandiera: '🇬🇧' },
  { codice: 'es', nome: 'Español',  bandiera: '🇪🇸' },
];

export const LINGUA_DEFAULT = 'it';

export const TRADUZIONI = {
  it: {
    /* ── Navbar + tab bar mobile ── */
    'nav.home':          'Home',
    'nav.socialify':     'SOCIALify',
    'nav.twitch':        'Twitch',
    'nav.youtube':       'YouTube',
    'nav.instagram':     'Instagram',
    'nav.podcast':       'Podcast',
    'nav.tiktok':        'TikTok',
    'nav.giochi':        'Giochi',
    'nav.chat':          'Chat',
    'nav.impostazioni':  'Impostazioni',
    'nav.aria.main':     'Navigazione principale',
    'nav.aria.logo':     'ANDRYXify – Home',

    'nav.tema.auto':          'Tema: Auto (segue sistema)',
    'nav.tema.alba-tramonto': 'Tema: Alba/Tramonto (in base all\'ora)',
    'nav.tema.chiaro':        'Tema: Chiaro',
    'nav.tema.scuro':         'Tema: Scuro',

    /* ── Footer ── */
    'footer.tagline':   'Esplorando Umanità, IA & Gaming.',
    'footer.copyright': 'Fatto con ♥ per il futuro.',

    /* ── Cookie banner ── */
    'cookie.titolo':     'Cookie & Privacy',
    'cookie.testo':      'Usiamo cookie tecnici essenziali per far funzionare il sito. Nessun dato venduto a terzi.',
    'cookie.maggiori':   'Maggiori info',
    'cookie.rifiuta':    'Rifiuta',
    'cookie.accetta':    'Accetta',
    'cookie.aria.banner':  'Consenso cookie',
    'cookie.aria.chiudi':  'Chiudi banner cookie',

    /* ── Banner offline ── */
    'offline.sei_offline':     'Sei offline',
    'offline.ripristinata':    'Connessione ripristinata',
    'offline.gioca_offline':   'Gioca offline',
    'offline.aria.gioca':      'Gioca offline mentre la connessione torna',

    /* ── Toast aggiornamento ── */
    'update.messaggio':     'Nuova versione disponibile — tocca per aggiornare',
    'update.aria.aggiorna': 'Aggiorna alla nuova versione',

    /* ── Error boundary ── */
    'errore.titolo':     'Qualcosa è andato storto',
    'errore.generico':   'Errore inaspettato. Ricarica la pagina per riprovare.',
    'errore.ricarica':   'Ricarica la pagina',

    /* ── Home hero ── */
    'home.hero.sottotitolo_prefix': 'Esplorando il confine tra',
    'home.hero.umanita':            'Umanità',
    'home.hero.ai':                 'Intelligenza Artificiale',
    'home.hero.e':                  'e',
    'home.hero.gaming':             'Gaming',
    'home.chip.creator':     'Content Creator',
    'home.chip.ai_explorer': 'AI Explorer',
    'home.chip.gamer':       'Gamer',
    'home.cta.guarda_live':  'Guarda la LIVE',
    'home.cta.seguimi':      'Seguimi su Twitch',
    'home.cta.gioca_ora':    'Gioca ora',
    'home.live.titolo':      'Live Preview',
    'home.live.live_ora':    'LIVE ORA',
    'home.live.offline':     '⚪ OFFLINE',
    'home.live.simulcast':   '🔴 In simulcast anche su YouTube',
    'home.live.apri':        'Apri stream completo',
    'home.trovami':          'Trovami su 📡',

    /* ── Settings ── */
    'settings.titolo':               'Impostazioni',
    'settings.accessibilita':        'Accessibilità',
    'settings.aspetto':              'Aspetto',
    'settings.lingua':               'Lingua',
    'settings.account':              'Account',
    'settings.notifiche':            'Notifiche',
    'settings.sicurezza':            'Sicurezza E2E',
    'settings.privacy':              'Privacy',
    'settings.dati':                 'Dati',

    'settings.modalita_schermo':     'Modalità schermo:',
    'settings.dimensione_testo':     'Dimensione testo:',
    'settings.colore_principale':    'Colore principale dell\'interfaccia:',

    'settings.tema.scuro':           'Scuro',
    'settings.tema.chiaro':          'Chiaro',
    'settings.tema.auto':            'Auto',
    'settings.tema.alba-tramonto':   'Alba/Tramonto',

    'settings.font.normale':         'Normale',
    'settings.font.grande':          'Grande',
    'settings.font.gigante':         'Molto grande',

    'settings.alba.descr':           'Tema cambia automaticamente in base all\'orario di alba e tramonto.',
    'settings.alba.richiedi':        'Concedi la posizione per alba/tramonto precisi alla tua zona — altrimenti uso l\'Italia centrale come riferimento.',
    'settings.alba.concedi':         'Concedi',

    'settings.lingua.descr':         'Scegli la lingua dell\'interfaccia. Al primo ingresso rilevata automaticamente dal dispositivo.',
    'settings.lingua.auto':          'Automatica',
    'settings.lingua.auto_descr':    'Segue la lingua del dispositivo',

    'settings.accedi_altre':         'Accedi per altre impostazioni',
    'settings.accedi_descr':         'Effettua il login con Twitch per gestire account, notifiche e privacy.',
    'settings.accedi_con_twitch':    'Accedi con Twitch',

    'settings.vedi_profilo':         'Vedi profilo',
    'settings.esci':                 'Esci',

    'settings.notif.in_app':         'Notifiche in-app',
    'settings.notif.push':           'Notifiche push',
    'settings.notif.suoni':          'Suoni',

    'settings.e2e.descr':            'La crittografia end-to-end è configurata direttamente nella sezione Messaggi. Puoi gestire le chiavi, aggiungere dispositivi o reimpostare la crittografia da lì.',
    'settings.e2e.vai_messaggi':     'Vai a Messaggi',

    'settings.privacy.amicizia':     'Richieste di amicizia aperte',
    'settings.privacy.visibilita':   'Visibilità profilo',
    'settings.privacy.pubblico':     'Pubblico',
    'settings.privacy.amici':        'Solo amici',
    'settings.privacy.privato':      'Privato',

    'settings.dati.esporta':         'Esporta impostazioni (JSON)',
    'settings.dati.elimina_descr':   'Per eliminare il tuo account e tutti i dati associati, contatta l\'amministratore tramite i canali social.',
  },

  en: {
    'nav.home':          'Home',
    'nav.socialify':     'SOCIALify',
    'nav.twitch':        'Twitch',
    'nav.youtube':       'YouTube',
    'nav.instagram':     'Instagram',
    'nav.podcast':       'Podcast',
    'nav.tiktok':        'TikTok',
    'nav.giochi':        'Games',
    'nav.chat':          'Chat',
    'nav.impostazioni':  'Settings',
    'nav.aria.main':     'Main navigation',
    'nav.aria.logo':     'ANDRYXify – Home',

    'nav.tema.auto':          'Theme: Auto (follows system)',
    'nav.tema.alba-tramonto': 'Theme: Sunrise/Sunset (time-based)',
    'nav.tema.chiaro':        'Theme: Light',
    'nav.tema.scuro':         'Theme: Dark',

    'footer.tagline':   'Exploring Humanity, AI & Gaming.',
    'footer.copyright': 'Made with ♥ for the future.',

    'cookie.titolo':     'Cookies & Privacy',
    'cookie.testo':      'We use essential technical cookies to run the site. No data sold to third parties.',
    'cookie.maggiori':   'Learn more',
    'cookie.rifiuta':    'Decline',
    'cookie.accetta':    'Accept',
    'cookie.aria.banner':  'Cookie consent',
    'cookie.aria.chiudi':  'Close cookie banner',

    'offline.sei_offline':     'You\'re offline',
    'offline.ripristinata':    'Connection restored',
    'offline.gioca_offline':   'Play offline',
    'offline.aria.gioca':      'Play offline while the connection comes back',

    'update.messaggio':     'New version available — tap to update',
    'update.aria.aggiorna': 'Update to the new version',

    'errore.titolo':     'Something went wrong',
    'errore.generico':   'Unexpected error. Reload the page to try again.',
    'errore.ricarica':   'Reload page',

    'home.hero.sottotitolo_prefix': 'Exploring the boundary between',
    'home.hero.umanita':            'Humanity',
    'home.hero.ai':                 'Artificial Intelligence',
    'home.hero.e':                  'and',
    'home.hero.gaming':             'Gaming',
    'home.chip.creator':     'Content Creator',
    'home.chip.ai_explorer': 'AI Explorer',
    'home.chip.gamer':       'Gamer',
    'home.cta.guarda_live':  'Watch LIVE',
    'home.cta.seguimi':      'Follow me on Twitch',
    'home.cta.gioca_ora':    'Play now',
    'home.live.titolo':      'Live Preview',
    'home.live.live_ora':    'LIVE NOW',
    'home.live.offline':     '⚪ OFFLINE',
    'home.live.simulcast':   '🔴 Simulcast on YouTube too',
    'home.live.apri':        'Open full stream',
    'home.trovami':          'Find me on 📡',

    'settings.titolo':               'Settings',
    'settings.accessibilita':        'Accessibility',
    'settings.aspetto':              'Appearance',
    'settings.lingua':               'Language',
    'settings.account':              'Account',
    'settings.notifiche':            'Notifications',
    'settings.sicurezza':            'E2E Security',
    'settings.privacy':              'Privacy',
    'settings.dati':                 'Data',

    'settings.modalita_schermo':     'Display mode:',
    'settings.dimensione_testo':     'Text size:',
    'settings.colore_principale':    'Main interface color:',

    'settings.tema.scuro':           'Dark',
    'settings.tema.chiaro':          'Light',
    'settings.tema.auto':            'Auto',
    'settings.tema.alba-tramonto':   'Sunrise/Sunset',

    'settings.font.normale':         'Normal',
    'settings.font.grande':          'Large',
    'settings.font.gigante':         'Very large',

    'settings.alba.descr':           'Theme changes automatically based on sunrise and sunset times.',
    'settings.alba.richiedi':        'Grant location for precise sunrise/sunset in your area — otherwise I\'ll use central Italy as reference.',
    'settings.alba.concedi':         'Grant',

    'settings.lingua.descr':         'Choose the interface language. First visit is auto-detected from your device.',
    'settings.lingua.auto':          'Automatic',
    'settings.lingua.auto_descr':    'Follows device language',

    'settings.accedi_altre':         'Log in for more settings',
    'settings.accedi_descr':         'Log in with Twitch to manage account, notifications and privacy.',
    'settings.accedi_con_twitch':    'Log in with Twitch',

    'settings.vedi_profilo':         'View profile',
    'settings.esci':                 'Log out',

    'settings.notif.in_app':         'In-app notifications',
    'settings.notif.push':           'Push notifications',
    'settings.notif.suoni':          'Sounds',

    'settings.e2e.descr':            'End-to-end encryption is configured directly in the Messages section. You can manage keys, add devices or reset encryption from there.',
    'settings.e2e.vai_messaggi':     'Go to Messages',

    'settings.privacy.amicizia':     'Open friend requests',
    'settings.privacy.visibilita':   'Profile visibility',
    'settings.privacy.pubblico':     'Public',
    'settings.privacy.amici':        'Friends only',
    'settings.privacy.privato':      'Private',

    'settings.dati.esporta':         'Export settings (JSON)',
    'settings.dati.elimina_descr':   'To delete your account and all associated data, contact the admin through the social channels.',
  },

  es: {
    'nav.home':          'Inicio',
    'nav.socialify':     'SOCIALify',
    'nav.twitch':        'Twitch',
    'nav.youtube':       'YouTube',
    'nav.instagram':     'Instagram',
    'nav.podcast':       'Podcast',
    'nav.tiktok':        'TikTok',
    'nav.giochi':        'Juegos',
    'nav.chat':          'Chat',
    'nav.impostazioni':  'Ajustes',
    'nav.aria.main':     'Navegación principal',
    'nav.aria.logo':     'ANDRYXify – Inicio',

    'nav.tema.auto':          'Tema: Auto (según el sistema)',
    'nav.tema.alba-tramonto': 'Tema: Amanecer/Atardecer (según la hora)',
    'nav.tema.chiaro':        'Tema: Claro',
    'nav.tema.scuro':         'Tema: Oscuro',

    'footer.tagline':   'Explorando Humanidad, IA y Gaming.',
    'footer.copyright': 'Hecho con ♥ para el futuro.',

    'cookie.titolo':     'Cookies y Privacidad',
    'cookie.testo':      'Usamos cookies técnicas esenciales para hacer funcionar el sitio. Ningún dato vendido a terceros.',
    'cookie.maggiori':   'Más información',
    'cookie.rifiuta':    'Rechazar',
    'cookie.accetta':    'Aceptar',
    'cookie.aria.banner':  'Consentimiento de cookies',
    'cookie.aria.chiudi':  'Cerrar banner de cookies',

    'offline.sei_offline':     'Estás sin conexión',
    'offline.ripristinata':    'Conexión restablecida',
    'offline.gioca_offline':   'Juega sin conexión',
    'offline.aria.gioca':      'Juega sin conexión mientras vuelve la conexión',

    'update.messaggio':     'Nueva versión disponible — toca para actualizar',
    'update.aria.aggiorna': 'Actualizar a la nueva versión',

    'errore.titolo':     'Algo salió mal',
    'errore.generico':   'Error inesperado. Recarga la página para volver a intentarlo.',
    'errore.ricarica':   'Recargar la página',

    'home.hero.sottotitolo_prefix': 'Explorando el límite entre',
    'home.hero.umanita':            'Humanidad',
    'home.hero.ai':                 'Inteligencia Artificial',
    'home.hero.e':                  'y',
    'home.hero.gaming':             'Gaming',
    'home.chip.creator':     'Content Creator',
    'home.chip.ai_explorer': 'AI Explorer',
    'home.chip.gamer':       'Gamer',
    'home.cta.guarda_live':  'Ver EN VIVO',
    'home.cta.seguimi':      'Sígueme en Twitch',
    'home.cta.gioca_ora':    'Jugar ahora',
    'home.live.titolo':      'Vista Previa Live',
    'home.live.live_ora':    'EN VIVO AHORA',
    'home.live.offline':     '⚪ OFFLINE',
    'home.live.simulcast':   '🔴 También en simulcast en YouTube',
    'home.live.apri':        'Abrir stream completo',
    'home.trovami':          'Encuéntrame en 📡',

    'settings.titolo':               'Ajustes',
    'settings.accessibilita':        'Accesibilidad',
    'settings.aspetto':              'Apariencia',
    'settings.lingua':               'Idioma',
    'settings.account':              'Cuenta',
    'settings.notifiche':            'Notificaciones',
    'settings.sicurezza':            'Seguridad E2E',
    'settings.privacy':              'Privacidad',
    'settings.dati':                 'Datos',

    'settings.modalita_schermo':     'Modo de pantalla:',
    'settings.dimensione_testo':     'Tamaño del texto:',
    'settings.colore_principale':    'Color principal de la interfaz:',

    'settings.tema.scuro':           'Oscuro',
    'settings.tema.chiaro':          'Claro',
    'settings.tema.auto':            'Auto',
    'settings.tema.alba-tramonto':   'Amanecer/Atardecer',

    'settings.font.normale':         'Normal',
    'settings.font.grande':          'Grande',
    'settings.font.gigante':         'Muy grande',

    'settings.alba.descr':           'El tema cambia automáticamente según los horarios de amanecer y atardecer.',
    'settings.alba.richiedi':        'Concede la ubicación para un amanecer/atardecer preciso de tu zona — si no, uso Italia central como referencia.',
    'settings.alba.concedi':         'Conceder',

    'settings.lingua.descr':         'Elige el idioma de la interfaz. En la primera visita se detecta automáticamente desde tu dispositivo.',
    'settings.lingua.auto':          'Automático',
    'settings.lingua.auto_descr':    'Sigue el idioma del dispositivo',

    'settings.accedi_altre':         'Inicia sesión para más ajustes',
    'settings.accedi_descr':         'Inicia sesión con Twitch para gestionar cuenta, notificaciones y privacidad.',
    'settings.accedi_con_twitch':    'Iniciar sesión con Twitch',

    'settings.vedi_profilo':         'Ver perfil',
    'settings.esci':                 'Cerrar sesión',

    'settings.notif.in_app':         'Notificaciones en la app',
    'settings.notif.push':           'Notificaciones push',
    'settings.notif.suoni':          'Sonidos',

    'settings.e2e.descr':            'El cifrado de extremo a extremo se configura directamente en la sección Mensajes. Puedes gestionar las claves, añadir dispositivos o reiniciar el cifrado desde allí.',
    'settings.e2e.vai_messaggi':     'Ir a Mensajes',

    'settings.privacy.amicizia':     'Solicitudes de amistad abiertas',
    'settings.privacy.visibilita':   'Visibilidad del perfil',
    'settings.privacy.pubblico':     'Público',
    'settings.privacy.amici':        'Solo amigos',
    'settings.privacy.privato':      'Privado',

    'settings.dati.esporta':         'Exportar ajustes (JSON)',
    'settings.dati.elimina_descr':   'Para eliminar tu cuenta y todos los datos asociados, contacta al administrador por los canales sociales.',
  },
};

/**
 * Rileva la lingua preferita dall'ambiente (browser/SO del telefono).
 * Restituisce uno dei codici in LINGUE_DISPONIBILI, o LINGUA_DEFAULT se nessuno corrisponde.
 *
 * Scorre navigator.languages in ordine di preferenza e restituisce la prima
 * lingua supportata (confronto sul codice base, es. "en-US" → "en").
 */
export function rilevaLinguaDispositivo() {
  if (typeof navigator === 'undefined') return LINGUA_DEFAULT;
  const disponibili = new Set(LINGUE_DISPONIBILI.map(l => l.codice));
  const candidati = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language || LINGUA_DEFAULT];
  for (const raw of candidati) {
    if (!raw) continue;
    const base = String(raw).toLowerCase().split('-')[0];
    if (disponibili.has(base)) return base;
  }
  return LINGUA_DEFAULT;
}
