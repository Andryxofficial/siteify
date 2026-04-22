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

    /* ── Prompt installa PWA ── */
    'installa.titolo':            'Installa ANDRYXify',
    'installa.descrizione_android': 'Aggiungila alla schermata Home: parte in un istante, funziona offline e ti notifica quando vado in live.',
    'installa.descrizione_ios':   'Aggiungila alla schermata Home: parte in un istante, funziona offline e sembra un\'app vera.',
    'installa.installa':          'Installa',
    'installa.piu_tardi':         'Più tardi',
    'installa.aria.chiudi':       'Chiudi suggerimento installazione',
    'installa.ios.passo1_prefix': 'Tocca',
    'installa.ios.passo1_suffix': 'in basso al centro su Safari',
    'installa.ios.passo2_prefix': 'Scorri e scegli',
    'installa.ios.aggiungi':      'Aggiungi alla schermata Home',
    'installa.ios.passo3':        'Conferma con “Aggiungi” in alto a destra',

    /* ── Condivisione (Web Share API) ── */
    'condividi.titolo':       'Guarda questo su ANDRYXify',
    'condividi.copiato':      'Link copiato negli appunti',
    'condividi.errore':       'Impossibile condividere',

    /* ── Pagina /app ── */
    'app.titolo':             'ANDRYXify — l\'app',
    'app.claim':              'Twitch, gioco con classifica, podcast, community: tutto in un\'app vetro che parte in un istante.',
    'app.chip.gratis':        'Gratis',
    'app.chip.no_pubblicita': 'Senza pubblicità',
    'app.chip.privacy':       'Rispetta la privacy',
    'app.installa_ora':       'Installa ora',
    'app.gia_installata':     'App installata, sei a posto ✨',
    'app.guida_ios':          'Su iPhone: tocca Condividi → “Aggiungi alla schermata Home”.',
    'app.feature.live.titolo':       'Sapere se sono live',
    'app.feature.live.descrizione':  'Notifica push quando inizio una live su Twitch.',
    'app.feature.gioco.titolo':      'Gioco con classifica',
    'app.feature.gioco.descrizione': 'Andryx Quest, Legend e Jump — funzionano anche offline.',
    'app.feature.offline.titolo':    'Funziona offline',
    'app.feature.offline.descrizione': 'Apri l\'app anche senza rete: l\'ultima versione è in cache.',
    'app.feature.veloce.titolo':     'Veloce davvero',
    'app.feature.veloce.descrizione': 'Carica in millisecondi, transizioni a 60fps.',
    'app.qr.titolo':          'Aprila sul telefono',
    'app.qr.testo':           'Scansiona questo QR con la fotocamera per aprire ANDRYXify e installarla in due tap.',
    'app.novita.titolo':      'Cosa c\'è di nuovo',

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

    /* ── Nav: Chi Sono ── */
    'nav.chisono': 'Chi Sono',

    /* ── Pagina Chi Sono ── */
    'chisono.seo.titolo':     'Chi Sono — Andrea Taliento (ANDRYXify)',
    'chisono.seo.descrizione': 'Ciao, sono Andrea Taliento (ANDRYXify), streamer Twitch di Genova nato nel 1998. Appassionato di videogiochi, intelligenza artificiale, anime, manga e fotografia. Content creator italiano.',
    'chisono.seo.keywords':   'andrea taliento, andryxify, streamer genova, streamer italiano, chi è andryxify, content creator genova, gamer genova, one piece, anime manga, intelligenza artificiale',
    'chisono.titolo':         'Ciao, sono Andryx! 👋',
    'chisono.nascita_mese':   'Marzo',
    'chisono.presentazione.titolo': 'La mia storia',
    'chisono.bio':            'Ciao, io sono Andrea, sono nato il 5 Marzo del 1998 e amo tutto ciò che concerne i videogiochi, le foto, i video, la tecnologia, l\'IA... Insomma, sono un nerd. Mi piacciono gli Anime e leggo Manga. Il mio Anime preferito rimane One Piece, ma ho una lista davvero luuuuunghissima, che sia di anime che sia di manga, ma di questo magari ne parlerò in live per presentarmi meglio. Benvenuto nel mio sito!',
    'chisono.passioni.titolo':       'Le mie passioni',
    'chisono.passioni.videogiochi':  'Videogiochi',
    'chisono.passioni.ia':           'Intelligenza Artificiale',
    'chisono.passioni.foto':         'Fotografia & Video',
    'chisono.passioni.streaming':    'Live Streaming',
    'chisono.passioni.podcast':      'Podcast',
    'chisono.passioni.manga':        'Manga',
    'chisono.passioni.anime':        'Anime',
    'chisono.anime.titolo':          'Anime & Manga',
    'chisono.anime.testo':           'Sono un appassionato di anime e manga da anni. Ho una lista lunghissima di titoli — sia di anime che di manga — che sarebbe impossibile elencare qui. Ma il mio anime preferito in assoluto è One Piece: una storia epica che mi accompagna da sempre.',
    'chisono.trovami.titolo':        'Dove trovarmi',
    'chisono.trovami.testo':         'Sono attivo su più piattaforme: faccio live su Twitch, pubblico video su YouTube, condivido momenti su Instagram e TikTok, e ho un podcast su Spotify che parla di intelligenza artificiale e tecnologia.',

    /* ── Pagina Twitch ── */
    'twitch.titolo':           'Twitch Experience',
    'twitch.sottotitolo':      'Segui le dirette, interagisci in chat e scopri i momenti migliori.',
    'twitch.stat.community':   'Community attiva',
    'twitch.stat.contenuti':   'Contenuti originali',
    'twitch.stat.live':        'Live regolari',
    'twitch.chat.intestazione': 'Chat in diretta — scrivi qui o usa il tasto ',
    'twitch.chat.accedi':      'Accedi',
    'twitch.chat.suffisso':    ' in alto',
    'twitch.canale.titolo':    'andryxify su Twitch',
    'twitch.canale.desc':      'Seguimi su Twitch per non perderti nessuna diretta. Attiva le notifiche e unisciti alla community!',
    'twitch.canale.segui':     'Segui su Twitch',
    'twitch.canale.donazioni': 'Donazioni su x.la',

    /* ── Pagina YouTube ── */
    'youtube.titolo':          'YouTube Hub',
    'youtube.sottotitolo':     'Riflessioni, approfondimenti e highlights sul futuro digitale.',
    'youtube.desc':            'Live, estratti, approfondimenti sull\'intelligenza artificiale, reaction e gaming. Esplora tutti i contenuti originali e unisciti alla community!',
    'youtube.iscriviti':       'Iscriviti al Canale',
    'youtube.ultimi_video':    'Ultimi Video',
    'youtube.guarda':          'Guarda su YouTube',

    /* ── Pagina Instagram ── */
    'instagram.titolo':        'Instagram Feed',
    'instagram.sottotitolo':   'Dietro le quinte, storie quotidiane e istanti catturati.',
    'instagram.desc':          'Dietro le quinte delle live, pillole di IA, gaming moments e contenuti esclusivi. Seguimi per non perderti nulla!',
    'instagram.segui':         'Segui su Instagram',
    'instagram.stories.desc':  'Le Stories di Instagram sono il posto migliore per seguire i miei aggiornamenti quotidiani in tempo reale.',
    'instagram.stories.apri':  'Apri le Stories',

    /* ── Pagina TikTok ── */
    'tiktok.titolo':           'TikTok Vibes',
    'tiktok.sottotitolo':      'Clip, trend, IA e gaming nei formati più veloci del web.',
    'tiktok.desc':             'Gaming, IA, tech e tanto altro in pillole veloci. Seguimi per non perdere nemmeno un trend!',
    'tiktok.segui':            'Seguimi su TikTok',
    'tiktok.feed.titolo':      'Feed TikTok',
    'tiktok.apri_profilo':     'Apri il profilo TikTok',

    /* ── Pagina Podcast ── */
    'podcast.titolo':          'Umanità o IA?',
    'podcast.sottotitolo':     'Il podcast che esplora i confini tra l\'essere umano e la tecnologia.',
    'podcast.ascolta':         'Ascolta su Spotify',
    'podcast.condividi':       'Condividi',
    'podcast.perche.titolo':   '🎙️ Perché questo podcast?',
    'podcast.perche.testo':    'Nell\'era dell\'intelligenza artificiale, sappiamo davvero distinguere fra strumento e cervello in prestito? ANDRYXify ti guida in un viaggio tra bit e biologia, esplorando domande che nessun algoritmo sa ancora rispondere.',
    'podcast.inizia':          'Inizia ad ascoltare',
    'podcast.share.testo':     'Scopri il podcast dove indaghiamo il confine tra tecnologia e biologia.',
    'podcast.share.copiato':   'Link copiato!',

    /* ── Home: sezioni non ancora tradotte ── */
    'home.premi.titolo':       'Premi della Community',
    'home.premi.frequenza':    'Ogni settimana e ogni mese',
    'home.premi.desc':         'Competi nel gioco del mese, rimani attivo nella community e vinci premi esclusivi. Tre modi per distinguersi.',
    'home.premi.vip.titolo':   'VIP Settimanale',
    'home.premi.vip.desc':     'Il punteggio più alto della settimana vince il ruolo VIP su Twitch per un mese intero.',
    'home.premi.campione.titolo': 'Campione Mensile',
    'home.premi.campione.desc':   'Il punteggio più alto del mese riceve un premio speciale rivelato in live da Andryx.',
    'home.premi.star.titolo':  'Social Star',
    'home.premi.star.desc':    'Il membro più attivo e costruttivo della community ogni mese ottiene un riconoscimento speciale.',
    'home.premi.gioca_ora':    'Gioca ora',
    'home.premi.classifica':   'Classifica',
    'home.premi.community':    'Community',
    'home.msg.titolo':         'Messaggi Privati',
    'home.msg.sottotitolo':    '— Cifrati E2E',
    'home.msg.desc':           'Chatta in modo sicuro con gli altri membri della community. Zero intercettazioni, massima privacy — protetto dalla tua passkey.',
    'home.msg.login.titolo':   'Login con Twitch',
    'home.msg.login.desc':     'Accedi con il tuo account Twitch in un click, nessuna registrazione extra.',
    'home.msg.e2e.titolo':     'Cifrati End‑to‑End',
    'home.msg.e2e.desc':       'I messaggi sono leggibili solo da te e dal destinatario. Nemmeno il server può leggerli.',
    'home.msg.passkey.titolo': 'Passkey',
    'home.msg.passkey.desc':   'Proteggi le tue chiavi con Face ID, impronta digitale o PIN del dispositivo.',
    'home.msg.prova':          'Prova i Messaggi',
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

    /* ── Install PWA prompt ── */
    'installa.titolo':            'Install ANDRYXify',
    'installa.descrizione_android': 'Add it to your Home Screen: starts instantly, works offline and notifies you when I go live.',
    'installa.descrizione_ios':   'Add it to your Home Screen: starts instantly, works offline and feels like a real app.',
    'installa.installa':          'Install',
    'installa.piu_tardi':         'Later',
    'installa.aria.chiudi':       'Close install hint',
    'installa.ios.passo1_prefix': 'Tap',
    'installa.ios.passo1_suffix': 'at the bottom of Safari',
    'installa.ios.passo2_prefix': 'Scroll down and pick',
    'installa.ios.aggiungi':      'Add to Home Screen',
    'installa.ios.passo3':        'Confirm with “Add” in the top right',

    /* ── Web Share ── */
    'condividi.titolo':       'Check this out on ANDRYXify',
    'condividi.copiato':      'Link copied to clipboard',
    'condividi.errore':       'Couldn\'t share',

    /* ── /app page ── */
    'app.titolo':             'ANDRYXify — the app',
    'app.claim':              'Twitch, leaderboard game, podcast, community: all in one glass app that starts in an instant.',
    'app.chip.gratis':        'Free',
    'app.chip.no_pubblicita': 'No ads',
    'app.chip.privacy':       'Privacy-friendly',
    'app.installa_ora':       'Install now',
    'app.gia_installata':     'App installed, you\'re all set ✨',
    'app.guida_ios':          'On iPhone: tap Share → “Add to Home Screen”.',
    'app.feature.live.titolo':       'Know when I go live',
    'app.feature.live.descrizione':  'Push notification when a Twitch live starts.',
    'app.feature.gioco.titolo':      'Game with leaderboard',
    'app.feature.gioco.descrizione': 'Andryx Quest, Legend and Jump — even offline.',
    'app.feature.offline.titolo':    'Works offline',
    'app.feature.offline.descrizione': 'Open the app without network: the last version is cached.',
    'app.feature.veloce.titolo':     'Truly fast',
    'app.feature.veloce.descrizione': 'Loads in milliseconds, 60fps transitions.',
    'app.qr.titolo':          'Open it on your phone',
    'app.qr.testo':           'Scan this QR with your camera to open ANDRYXify and install it in two taps.',
    'app.novita.titolo':      'What\'s new',

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

    /* ── Nav: Chi Sono ── */
    'nav.chisono': 'About Me',

    /* ── Chi Sono Page ── */
    'chisono.seo.titolo':     'About Me — Andrea Taliento (ANDRYXify)',
    'chisono.seo.descrizione': 'Hi, I\'m Andrea Taliento (ANDRYXify), a Twitch streamer from Genova born in 1998. Passionate about video games, AI, anime, manga and photography. Italian content creator.',
    'chisono.seo.keywords':   'andrea taliento, andryxify, streamer genova, italian streamer, who is andryxify, content creator genova, gamer genova, one piece, anime manga, artificial intelligence',
    'chisono.titolo':         'Hi, I\'m Andryx! 👋',
    'chisono.nascita_mese':   'March',
    'chisono.presentazione.titolo': 'My story',
    'chisono.bio':            'Hi, I\'m Andrea, born on March 5th 1998, and I love everything related to video games, photography, videos, technology, AI… In short, I\'m a nerd. I enjoy Anime and read Manga. My favourite Anime is One Piece, but I have a really loooooong list — both anime and manga — and I\'ll probably share it during a live stream to introduce myself properly. Welcome to my site!',
    'chisono.passioni.titolo':       'My passions',
    'chisono.passioni.videogiochi':  'Video Games',
    'chisono.passioni.ia':           'Artificial Intelligence',
    'chisono.passioni.foto':         'Photography & Video',
    'chisono.passioni.streaming':    'Live Streaming',
    'chisono.passioni.podcast':      'Podcast',
    'chisono.passioni.manga':        'Manga',
    'chisono.passioni.anime':        'Anime',
    'chisono.anime.titolo':          'Anime & Manga',
    'chisono.anime.testo':           'I\'ve been an anime and manga fan for years. I have an incredibly long list of titles — both anime and manga — that would be impossible to list here. But my all-time favourite anime is One Piece: an epic story that has been with me forever.',
    'chisono.trovami.titolo':        'Where to find me',
    'chisono.trovami.testo':         'I\'m active on multiple platforms: I stream on Twitch, upload videos on YouTube, share moments on Instagram and TikTok, and host a podcast on Spotify about artificial intelligence and technology.',

    /* ── Twitch Page ── */
    'twitch.titolo':           'Twitch Experience',
    'twitch.sottotitolo':      'Watch live streams, chat and discover the best moments.',
    'twitch.stat.community':   'Active community',
    'twitch.stat.contenuti':   'Original content',
    'twitch.stat.live':        'Regular streams',
    'twitch.chat.intestazione': 'Live chat — type here or use the ',
    'twitch.chat.accedi':      'Log in',
    'twitch.chat.suffisso':    ' button above',
    'twitch.canale.titolo':    'andryxify on Twitch',
    'twitch.canale.desc':      'Follow me on Twitch so you never miss a stream. Enable notifications and join the community!',
    'twitch.canale.segui':     'Follow on Twitch',
    'twitch.canale.donazioni': 'Donate on x.la',

    /* ── YouTube Page ── */
    'youtube.titolo':          'YouTube Hub',
    'youtube.sottotitolo':     'Insights, highlights and deep dives into the digital future.',
    'youtube.desc':            'Live streams, clips, AI deep dives, reactions and gaming. Explore all the original content and join the community!',
    'youtube.iscriviti':       'Subscribe to Channel',
    'youtube.ultimi_video':    'Latest Videos',
    'youtube.guarda':          'Watch on YouTube',

    /* ── Instagram Page ── */
    'instagram.titolo':        'Instagram Feed',
    'instagram.sottotitolo':   'Behind the scenes, daily stories and captured moments.',
    'instagram.desc':          'Behind-the-scenes of streams, AI snippets, gaming moments and exclusive content. Follow me so you don\'t miss anything!',
    'instagram.segui':         'Follow on Instagram',
    'instagram.stories.desc':  'Instagram Stories are the best place to follow my daily updates in real time.',
    'instagram.stories.apri':  'Open Stories',

    /* ── TikTok Page ── */
    'tiktok.titolo':           'TikTok Vibes',
    'tiktok.sottotitolo':      'Clips, trends, AI and gaming in the fastest formats on the web.',
    'tiktok.desc':             'Gaming, AI, tech and much more in quick clips. Follow me so you never miss a trend!',
    'tiktok.segui':            'Follow me on TikTok',
    'tiktok.feed.titolo':      'TikTok Feed',
    'tiktok.apri_profilo':     'Open TikTok profile',

    /* ── Podcast Page ── */
    'podcast.titolo':          'Humanity or AI?',
    'podcast.sottotitolo':     'The podcast that explores the boundaries between humans and technology.',
    'podcast.ascolta':         'Listen on Spotify',
    'podcast.condividi':       'Share',
    'podcast.perche.titolo':   '🎙️ Why this podcast?',
    'podcast.perche.testo':    'In the age of artificial intelligence, can we really tell the difference between a tool and a borrowed brain? ANDRYXify takes you on a journey between bits and biology, exploring questions no algorithm can answer yet.',
    'podcast.inizia':          'Start listening',
    'podcast.share.testo':     'Discover the podcast where we investigate the boundary between technology and biology.',
    'podcast.share.copiato':   'Link copied!',

    /* ── Home: untranslated sections ── */
    'home.premi.titolo':       'Community Rewards',
    'home.premi.frequenza':    'Every week and every month',
    'home.premi.desc':         'Compete in the game of the month, stay active in the community and win exclusive prizes. Three ways to stand out.',
    'home.premi.vip.titolo':   'Weekly VIP',
    'home.premi.vip.desc':     'The highest score of the week wins the VIP role on Twitch for an entire month.',
    'home.premi.campione.titolo': 'Monthly Champion',
    'home.premi.campione.desc':   'The highest score of the month receives a special prize revealed live by Andryx.',
    'home.premi.star.titolo':  'Social Star',
    'home.premi.star.desc':    'The most active and constructive community member each month earns a special recognition.',
    'home.premi.gioca_ora':    'Play now',
    'home.premi.classifica':   'Leaderboard',
    'home.premi.community':    'Community',
    'home.msg.titolo':         'Private Messages',
    'home.msg.sottotitolo':    '— E2E Encrypted',
    'home.msg.desc':           'Chat securely with other community members. Zero interception, maximum privacy — protected by your passkey.',
    'home.msg.login.titolo':   'Login with Twitch',
    'home.msg.login.desc':     'Sign in with your Twitch account in one click, no extra registration.',
    'home.msg.e2e.titolo':     'End‑to‑End Encrypted',
    'home.msg.e2e.desc':       'Messages are readable only by you and the recipient. Not even the server can read them.',
    'home.msg.passkey.titolo': 'Passkey',
    'home.msg.passkey.desc':   'Protect your keys with Face ID, fingerprint or device PIN.',
    'home.msg.prova':          'Try Messages',
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

    /* ── Instalar PWA ── */
    'installa.titolo':            'Instala ANDRYXify',
    'installa.descrizione_android': 'Añádela a la pantalla de inicio: arranca al instante, funciona sin conexión y te avisa cuando estoy en directo.',
    'installa.descrizione_ios':   'Añádela a la pantalla de inicio: arranca al instante, funciona sin conexión y parece una app de verdad.',
    'installa.installa':          'Instalar',
    'installa.piu_tardi':         'Más tarde',
    'installa.aria.chiudi':       'Cerrar sugerencia de instalación',
    'installa.ios.passo1_prefix': 'Toca',
    'installa.ios.passo1_suffix': 'en la parte inferior de Safari',
    'installa.ios.passo2_prefix': 'Desliza y elige',
    'installa.ios.aggiungi':      'Añadir a la pantalla de inicio',
    'installa.ios.passo3':        'Confirma con “Añadir” arriba a la derecha',

    /* ── Compartir (Web Share) ── */
    'condividi.titolo':       'Mira esto en ANDRYXify',
    'condividi.copiato':      'Enlace copiado al portapapeles',
    'condividi.errore':       'No se pudo compartir',

    /* ── Página /app ── */
    'app.titolo':             'ANDRYXify — la app',
    'app.claim':              'Twitch, juego con clasificación, podcast, comunidad: todo en una app de cristal que arranca al instante.',
    'app.chip.gratis':        'Gratis',
    'app.chip.no_pubblicita': 'Sin anuncios',
    'app.chip.privacy':       'Respeta la privacidad',
    'app.installa_ora':       'Instalar ahora',
    'app.gia_installata':     'App instalada, todo listo ✨',
    'app.guida_ios':          'En iPhone: toca Compartir → “Añadir a la pantalla de inicio”.',
    'app.feature.live.titolo':       'Saber cuándo estoy en directo',
    'app.feature.live.descrizione':  'Notificación push cuando empiezo en Twitch.',
    'app.feature.gioco.titolo':      'Juego con clasificación',
    'app.feature.gioco.descrizione': 'Andryx Quest, Legend y Jump — también sin conexión.',
    'app.feature.offline.titolo':    'Funciona sin conexión',
    'app.feature.offline.descrizione': 'Abre la app aunque no tengas red: la última versión está en caché.',
    'app.feature.veloce.titolo':     'De verdad rápida',
    'app.feature.veloce.descrizione': 'Carga en milisegundos, transiciones a 60fps.',
    'app.qr.titolo':          'Ábrela en tu teléfono',
    'app.qr.testo':           'Escanea este QR con la cámara para abrir ANDRYXify e instalarla en dos toques.',
    'app.novita.titolo':      'Novedades',

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

    /* ── Nav: Chi Sono ── */
    'nav.chisono': 'Sobre Mí',

    /* ── Página Chi Sono ── */
    'chisono.seo.titolo':     'Sobre Mí — Andrea Taliento (ANDRYXify)',
    'chisono.seo.descrizione': 'Hola, soy Andrea Taliento (ANDRYXify), streamer de Twitch de Génova nacido en 1998. Apasionado por los videojuegos, la IA, los anime, los manga y la fotografía. Content creator italiano.',
    'chisono.seo.keywords':   'andrea taliento, andryxify, streamer genova, streamer italiano, quién es andryxify, content creator genova, gamer genova, one piece, anime manga, inteligencia artificial',
    'chisono.titolo':         '¡Hola, soy Andryx! 👋',
    'chisono.nascita_mese':   'Marzo',
    'chisono.presentazione.titolo': 'Mi historia',
    'chisono.bio':            'Hola, soy Andrea, nací el 5 de Marzo de 1998 y amo todo lo relacionado con los videojuegos, las fotos, los videos, la tecnología, la IA... En resumen, soy un nerd. Me gustan los Anime y leo Manga. Mi Anime favorito sigue siendo One Piece, pero tengo una lista reaaaalmente larga, tanto de anime como de manga, pero de eso quizás hablaré en directo para presentarme mejor. ¡Bienvenido a mi sitio!',
    'chisono.passioni.titolo':       'Mis pasiones',
    'chisono.passioni.videogiochi':  'Videojuegos',
    'chisono.passioni.ia':           'Inteligencia Artificial',
    'chisono.passioni.foto':         'Fotografía y Video',
    'chisono.passioni.streaming':    'Streaming en Directo',
    'chisono.passioni.podcast':      'Podcast',
    'chisono.passioni.manga':        'Manga',
    'chisono.passioni.anime':        'Anime',
    'chisono.anime.titolo':          'Anime y Manga',
    'chisono.anime.testo':           'Soy fan del anime y del manga desde hace años. Tengo una lista increíblemente larga de títulos — tanto anime como manga — que sería imposible enumerar aquí. Pero mi anime favorito de todos los tiempos es One Piece: una historia épica que me ha acompañado siempre.',
    'chisono.trovami.titolo':        'Dónde encontrarme',
    'chisono.trovami.testo':         'Estoy activo en varias plataformas: hago streams en Twitch, subo videos en YouTube, comparto momentos en Instagram y TikTok, y tengo un podcast en Spotify sobre inteligencia artificial y tecnología.',

    /* ── Página Twitch ── */
    'twitch.titolo':           'Experiencia Twitch',
    'twitch.sottotitolo':      'Sigue los directos, interactúa en el chat y descubre los mejores momentos.',
    'twitch.stat.community':   'Comunidad activa',
    'twitch.stat.contenuti':   'Contenido original',
    'twitch.stat.live':        'Directos regulares',
    'twitch.chat.intestazione': 'Chat en directo — escribe aquí o usa el botón ',
    'twitch.chat.accedi':      'Iniciar sesión',
    'twitch.chat.suffisso':    ' arriba',
    'twitch.canale.titolo':    'andryxify en Twitch',
    'twitch.canale.desc':      '¡Sígueme en Twitch para no perderte ningún directo. Activa las notificaciones y únete a la comunidad!',
    'twitch.canale.segui':     'Seguir en Twitch',
    'twitch.canale.donazioni': 'Donaciones en x.la',

    /* ── Página YouTube ── */
    'youtube.titolo':          'YouTube Hub',
    'youtube.sottotitolo':     'Reflexiones, análisis y highlights sobre el futuro digital.',
    'youtube.desc':            'Directos, clips, análisis sobre IA, reacciones y gaming. ¡Explora todos los contenidos originales y únete a la comunidad!',
    'youtube.iscriviti':       'Suscribirse al Canal',
    'youtube.ultimi_video':    'Últimos Videos',
    'youtube.guarda':          'Ver en YouTube',

    /* ── Página Instagram ── */
    'instagram.titolo':        'Feed de Instagram',
    'instagram.sottotitolo':   'Entre bastidores, historias diarias e instantes capturados.',
    'instagram.desc':          'Entre bastidores de los directos, píldoras de IA, gaming moments y contenido exclusivo. ¡Sígueme para no perderte nada!',
    'instagram.segui':         'Seguir en Instagram',
    'instagram.stories.desc':  'Las Stories de Instagram son el mejor lugar para seguir mis actualizaciones diarias en tiempo real.',
    'instagram.stories.apri':  'Abrir Stories',

    /* ── Página TikTok ── */
    'tiktok.titolo':           'TikTok Vibes',
    'tiktok.sottotitolo':      'Clips, tendencias, IA y gaming en los formatos más rápidos de la web.',
    'tiktok.desc':             'Gaming, IA, tech y mucho más en cápsulas rápidas. ¡Sígueme para no perderte ninguna tendencia!',
    'tiktok.segui':            'Sígueme en TikTok',
    'tiktok.feed.titolo':      'Feed TikTok',
    'tiktok.apri_profilo':     'Abrir perfil TikTok',

    /* ── Página Podcast ── */
    'podcast.titolo':          '¿Humanidad o IA?',
    'podcast.sottotitolo':     'El podcast que explora los límites entre el ser humano y la tecnología.',
    'podcast.ascolta':         'Escucha en Spotify',
    'podcast.condividi':       'Compartir',
    'podcast.perche.titolo':   '🎙️ ¿Por qué este podcast?',
    'podcast.perche.testo':    'En la era de la inteligencia artificial, ¿sabemos realmente distinguir entre herramienta y cerebro prestado? ANDRYXify te lleva en un viaje entre bits y biología, explorando preguntas que ningún algoritmo sabe responder todavía.',
    'podcast.inizia':          'Empieza a escuchar',
    'podcast.share.testo':     'Descubre el podcast donde investigamos el límite entre tecnología y biología.',
    'podcast.share.copiato':   '¡Enlace copiado!',

    /* ── Home: secciones sin traducir ── */
    'home.premi.titolo':       'Premios de la Comunidad',
    'home.premi.frequenza':    'Cada semana y cada mes',
    'home.premi.desc':         'Compite en el juego del mes, mantente activo en la comunidad y gana premios exclusivos. Tres formas de destacar.',
    'home.premi.vip.titolo':   'VIP Semanal',
    'home.premi.vip.desc':     'La puntuación más alta de la semana gana el rol VIP en Twitch durante un mes entero.',
    'home.premi.campione.titolo': 'Campeón Mensual',
    'home.premi.campione.desc':   'La puntuación más alta del mes recibe un premio especial revelado en directo por Andryx.',
    'home.premi.star.titolo':  'Social Star',
    'home.premi.star.desc':    'El miembro más activo y constructivo de la comunidad cada mes recibe un reconocimiento especial.',
    'home.premi.gioca_ora':    'Jugar ahora',
    'home.premi.classifica':   'Clasificación',
    'home.premi.community':    'Comunidad',
    'home.msg.titolo':         'Mensajes Privados',
    'home.msg.sottotitolo':    '— Cifrado E2E',
    'home.msg.desc':           'Chatea de forma segura con otros miembros de la comunidad. Cero interceptaciones, máxima privacidad — protegido por tu passkey.',
    'home.msg.login.titolo':   'Login con Twitch',
    'home.msg.login.desc':     'Inicia sesión con tu cuenta de Twitch en un clic, sin registro adicional.',
    'home.msg.e2e.titolo':     'Cifrado de extremo a extremo',
    'home.msg.e2e.desc':       'Los mensajes solo los pueden leer tú y el destinatario. Ni siquiera el servidor puede leerlos.',
    'home.msg.passkey.titolo': 'Passkey',
    'home.msg.passkey.desc':   'Protege tus claves con Face ID, huella dactilar o PIN del dispositivo.',
    'home.msg.prova':          'Probar Mensajes',
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
