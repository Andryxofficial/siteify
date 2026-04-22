# Copilot Instructions — ANDRYXify

Questo file viene letto automaticamente da GitHub Copilot ad ogni avvio di un agent.
Contiene la mappa completa del progetto, le convenzioni e la cronologia delle operazioni eseguite.

---

## 🗂️ Struttura del progetto

```
siteify/
├── .github/
│   └── copilot-instructions.md   ← questo file
├── api/                          ← Serverless functions (Vercel)
│   ├── leaderboard.js            ← GET/POST classifica weekly/monthly/general (param `?game=monthly|legend|platform`)
│   ├── reset-leaderboard.js      ← GET status + POST admin (param `?game=monthly|legend|platform`)
│   └── ikigai-bridge.js
├── public/                       ← Asset statici serviti direttamente
│   ├── andryx-logo.svg           ← Logo Andryx SVG (navbar & footer)
│   ├── firma_andryx.png          ← Firma grafica
│   ├── logo.png                  ← Logo generico
│   ├── favicon.svg
│   ├── bg.png
│   ├── icons.svg
│   ├── manifest.webmanifest
│   ├── pwa-192.png
│   ├── pwa-512.png
│   ├── apple-touch-icon.png
│   ├── sw.js                     ← Service Worker (PWA)
│   └── _redirects                ← Regole redirect (Netlify/Vercel)
├── src/
│   ├── main.jsx                  ← Entry point React
│   ├── App.jsx                   ← Router principale + gestione token Twitch OAuth
│   ├── index.css                 ← Stili globali (CSS custom properties, glass UI)
│   ├── assets/                   ← Asset importati via bundler
│   ├── components/
│   │   ├── Navbar.jsx            ← Navbar desktop (pill animata) + tab bar mobile
│   │   ├── Footer.jsx            ← Footer con logo e link social
│   │   ├── SocialHub.jsx         ← Grid card social (Twitch, YouTube, Instagram, TikTok, Podcast)
│   │   ├── PodcastPromo.jsx      ← Banner promozionale podcast Spotify
│   │   └── TikTokIcon.jsx        ← Icona SVG custom TikTok (lucide non la include)
│   ├── games/
│   │   ├── registry.js           ← Mappa mese→modulo gioco; getGameForMonth(month)
│   │   ├── aprile.js             ← Aprile: "Andryx Quest" ⚔️ (Zelda-like dungeon crawler)
│   │   ├── marzo.js              ← Marzo
│   │   ├── maggio.js             ← Maggio
│   │   ├── ottobre.js            ← Ottobre
│   │   ├── [altri mesi].js       ← gennaio/febbraio/giugno/luglio/agosto/settembre/novembre/dicembre
│   │   └── legend/               ← 🗡️ Andryx Legend (gioco principale, sempre disponibile) — **2D pixel-art ispirato a *The Minish Cap***
│   │       ├── index.js          ← Entry: meta + createGame, helpers save (hasSave/clearSave)
│   │       ├── engine.js         ← Game loop monolitico: update/dialogo/quest/inventario/combat/puzzle/AI nemici/boss. Render delegato a Renderer2D, HUD disegnato sullo stesso canvas
│   │       ├── renderer2d.js     ← Renderer 2D pixel-art (Minish Cap-style): canvas con DPR scaling, tile vettoriali, ombre ovali, Y-sort, vignettatura, fade transizioni, camera shake
│   │       ├── sprites.js        ← Pixel art procedurale (cuori, chiavi, ritratti NPC) — usata SOLO per HUD/dialog 2D overlay
│   │       ├── palette.js        ← Palette colori condivisa
│   │       ├── tiles.js          ← Costanti tile + collisioni + proprieta` 2D (`TILES`, `TILE_SIZE`, `getTile`, `isSolid`, `getTileSprite`)
│   │       ├── world.js          ← 4 zone (Foresta, Villaggio, Caverna, Castello), tilemap + entita` + connessioni
│   │       ├── dialog.js         ← Sistema dialoghi (typewriter, scelte, ritratti NPC)
│   │   │   ├── audio.js          ← SFX Web Audio API (no asset esterni)
│   │   │   └── save.js           ← localStorage versionato (zona, posizione, inventario, quest, HP, cristalli)
│   │   └── platform/             ← 🦘 Andryx Jump (terza modalita`, sempre disponibile) — platformer 2D originale a scorrimento laterale, 10 mondi a tema
│   │       ├── index.js          ← Entry: meta + createGame, helpers save (hasSave/clearSave), setPlatformLang
│   │       ├── engine.js         ← Game loop completo: gravita`, salto variabile, coyote/jump-buffer, run/walk con accel/friction, fall-through one-way, AABB collision X poi Y, AI nemici (Sloimo/Pipistrellix/Spinazzo), power-up (cristallo/stella/piuma), camera dead-zone+clamp+parallax 2 layer, HUD, pause, level-complete, fade transizioni
│   │       ├── physics.js        ← Costanti fisica (PHYS) + helpers AABB
│   │       ├── tiles.js          ← Costanti tile (TILES, TILE_SIZE) + helpers (isSolid, isOneWay, isLava, isWater, isIce, isPickup, getSpawnType, getTile)
│   │       ├── world.js          ← Definizione 10 mondi tematici (Foresta di Twitchia, Pianure di Pixel, Caverna delle Gemme, Deserto del Lag, Palude del Buffer, Vetta del Ping, Tundra del Frame, Inferno del Crash, Notte Stellare, Castello del Re Ombra). Mondo 1: 3 livelli disegnati a mano. Mondi 2-10: 1 livello procedurale ciascuno (stub, da espandere in PR successive)
│   │       ├── sprites.js        ← Pixel art procedurale (Andryx 4 stati big/small, Sloimo, Pipistrellix, Spinazzo, coin, crystal/star/feather, bandiere)
│   │       ├── audio.js          ← Web Audio sintetizzato: jump/doubleJump/coin/stomp/hit/powerup/death/levelClear/oneup + 10 brani musicali procedurali (uno per mondo, scala/tempo/timbro distinti)
│   │       ├── save.js           ← localStorage versionato `andryxify_platform_save_v1` (worldsUnlocked, completedLevels, totalCoins, lives, bestTimes, bestScores, sessione corrente)
│   │       └── i18n.js           ← Traduzioni IT/EN/ES per meta + UI
│   └── pages/
│       ├── Home.jsx              ← Homepage: hero, live preview Twitch, SocialHub, PodcastPromo
│       ├── TwitchPage.jsx        ← Embed stream Twitch + chat
│       ├── YouTubePage.jsx       ← Ultimi video YouTube (API)
│       ├── InstagramPage.jsx     ← Feed Instagram
│       ├── PodcastPage.jsx       ← Episodi podcast Spotify
│       ├── TikTokPage.jsx        ← Feed TikTok
│       ├── GamePage.jsx          ← Shell modulare gioco: canvas, joystick, HUD, classifica
│       ├── tracker_scoiattoli.jsx ← 🔒 Pagina segreta /scoiattoli (Squirrel Radar)
│       └── SquirrelRadar.css     ← Stili specifici per tracker_scoiattoli
├── vercel.json                   ← Configurazione deploy Vercel
├── vite.config.js                ← Configurazione Vite
├── eslint.config.js              ← ESLint (flat config)
├── package.json                  ← Dipendenze e script npm
├── .env.example                  ← Template variabili d'ambiente (pubblico, senza valori)
└── .env.local                    ← 🔒 Credenziali reali (gitignored, NON committare)
```

---

## ⚙️ Stack tecnologico

| Tecnologia | Utilizzo |
|---|---|
| React 19 | UI framework |
| Vite 8 | Bundler / dev server |
| React Router v7 | Routing SPA |
| Framer Motion v12 | Animazioni (pill navbar, transizioni pagina) |
| Lucide React | Icone |
| Tailwind Merge + clsx | Utility CSS |
| @upstash/redis | Storage serverless (KV — sorted sets per leaderboard) |
| Vercel | Hosting + serverless functions |

---

## 🧩 Componenti principali

### `Navbar.jsx`
- **Desktop**: navbar in cima con pill liquida animata (segue hover e route attiva)
- **Mobile**: tab bar in basso stile iOS con pill scorrevole
- `LOGO_URL` → punta a `/andryx-logo.svg` (SVG locale in `public/`)
- `NAV_LINKS` → array con path, label e icona per ogni sezione

### `Footer.jsx`
- Logo + link social + copyright
- `LOGO_URL` → stessa costante, deve restare allineata a `Navbar.jsx`

### `App.jsx`
- Gestisce il redirect OAuth di Twitch: legge `access_token` dall'URL hash e lo salva in `localStorage`
- Route `/scoiattoli` è nascosta (non appare in navbar)

### `GamePage.jsx`
- **Shell modulare**: carica il gioco del mese corrente da `src/games/registry.js`
- Fornisce: canvas 480×480, joystick touch floating, pulsante azione, HUD HP+score
- Autenticazione Twitch OAuth via `VITE_CHIAVETWITCH`
- Classifica con 3 tab: **Settimanale** / **Mensile** / **Generale**
- Calendario giochi con leader in tempo reale per il mese corrente

### `src/games/registry.js`
- Esporta `getGameForMonth(month)` → restituisce il modulo del gioco per quel mese (1–12)
- Ogni modulo esporta: `meta` (name, emoji, description, color, controls, instructions, gameOverTitle, actionLabel) + `createGame(canvas, callbacks)` → `cleanup()`
- Callbacks ricevuti: `keysRef`, `joystickRef`, `actionBtnRef`, `onScore`, `onGameOver`, `onHpChange`

### `TikTokIcon.jsx`
- SVG custom perché lucide-react non include l'icona TikTok
- Accetta prop `size` (default 24)

---

## 🕹️ Architettura gioco — `aprile.js` (Andryx Quest ⚔️)

- Top-down Zelda-like su canvas 480×480
- Player: WASD/frecce + joystick touch floating + gamepad API
- 3 tipi nemici: slime (lento), bat (veloce), ghost (passa i muri)
- Generazione procedurale stanze con muri, torce, gemme
- HUD: cuori `♥`/`♡`, punteggio, numero stanza, nemici rimasti
- Porta porta al prossimo piano (tutti i nemici morti → portale)
- Heal power-up ogni 1000 punti se HP < max
- Iframe di 45 frame dopo danno ricevuto

---

## 🏆 Classifica — `api/leaderboard.js`

### Struttura Redis (multi-gioco)

Il parametro `game` (default `monthly` per retrocompatibilita`) determina il prefisso delle chiavi:

| game | Prefisso |
|---|---|
| `monthly` (default) | `lb:` |
| `legend` | `lb:legend:` |
| `platform` | `lb:platform:` |

| Board | Logica | Chiave Redis (monthly) | Chiave Redis (legend) | TTL |
|---|---|---|---|---|
| **Settimanale** | MAX punteggio utente nella settimana ISO corrente | `lb:<YYYY-MM>:weekly:<YYYY-WNN>` | `lb:legend:<YYYY-MM>:weekly:<YYYY-WNN>` | 8 giorni |
| **Mensile** | MAX punteggio utente nel mese corrente | `lb:<YYYY-MM>:monthly` | `lb:legend:<YYYY-MM>:monthly` | permanente |
| **Generale** | Somma dei MAX mensili (`ZINCRBY Δ`) | `lb:general` | `lb:legend:general` | permanente |

### Logica generale
Quando un utente migliora il suo max mensile di Δ → `ZINCRBY lb:general Δ username`.
Risultato: `general[user] = Σ monthly_max(user, mese)` su tutti i mesi giocati.

### GET `/api/leaderboard[?season=YYYY-MM][&game=monthly|legend]`
```json
{
  "weekly":  [{ "username": "...", "score": 0 }],
  "monthly": [{ "username": "...", "score": 0 }],
  "general": [{ "username": "...", "score": 0 }],
  "archive": [{ "season": "2026-03", "label": "Marzo 2026", "monthNum": 3, "top3": [...] }],
  "currentSeason": "2026-04",
  "currentLabel": "Aprile 2026"
}
```

### POST `/api/leaderboard`
- Body: `{ score: number, season?: string, game?: 'monthly'|'legend' }`
- Header: `Authorization: ******`
- Valida token Twitch → scrive su weekly + monthly + ZINCRBY general (per il `game` selezionato)

---

## 🔧 Admin — `api/reset-leaderboard.js`

Protetto da `Authorization: ******` (`IUA_SECRET` env var). Tutte le operazioni accettano `?game=monthly|legend` (default `monthly`) per agire sulla board del gioco corrispondente.

### GET — stato attuale
```bash
curl -X GET /api/reset-leaderboard -H "Authorization: ******"
# → entry counts, TTLs, lista di tutte le chiavi lb:*
```

### POST — operazioni
```bash
# Reset settimanale (default)
curl -X POST /api/reset-leaderboard -H "..." -d '{}'

# Reset mensile + aggiusta generale
curl -X POST /api/reset-leaderboard -H "..." -d '{"monthly": true}'

# Azzera classifica generale
curl -X POST /api/reset-leaderboard -H "..." -d '{"general": true}'

# Ricalcola generale da zero (scansione tutti lb:*:monthly)
curl -X POST /api/reset-leaderboard -H "..." -d '{"recalculate_general": true}'

# Rimuovi un utente da tutte le board attive
curl -X POST /api/reset-leaderboard -H "..." -d '{"user": "twitchusername"}'

# Wipe totale (tutte le chiavi lb:*)
curl -X POST /api/reset-leaderboard -H "..." -d '{"full": true}'
```

---

## 🌐 Route dell'applicazione

| Path | Componente | Note |
|---|---|---|
| `/` | `Home` | Homepage pubblica |
| `/twitch` | `TwitchPage` | Embed stream |
| `/youtube` | `YouTubePage` | Video YouTube |
| `/instagram` | `InstagramPage` | Feed Instagram |
| `/podcast` | `PodcastPage` | Episodi podcast |
| `/tiktok` | `TikTokPage` | Feed TikTok |
| `/scoiattoli` | `tracker_scoiattoli` | Pagina segreta (non in navbar) |
| `/gioco` | `GamePage` | Gioco con login Twitch e leaderboard |

---

## 🖼️ Asset e immagini

- I file nella cartella `public/` sono serviti alla radice (`/nomefile.ext`)
- **Non usare URL GitHub raw** per le immagini del sito: usare sempre path locale (es. `/andryx-logo.svg`)
- Il logo principale è `public/andryx-logo.svg` (SVG con gradient fill, no filtri CSS necessari)

---

## 🔑 Credenziali e variabili d'ambiente

### File
- **`.env.local`** — file gitignored (coperto da `*.local` in `.gitignore`). Contiene tutte le chiavi reali. **Non committare mai questo file.**
- **`.env.example`** — template pubblico senza valori, da tenere aggiornato.

### Convenzione di naming (chiavi frontend / Vite)

| Variabile | Provider | Usato in |
|---|---|---|
| `VITE_CHIAVETWITCH` | Twitch | `src/pages/GamePage.jsx` |

### Chiavi server-side (Vercel dashboard)

| Variabile | Descrizione |
|---|---|
| `KV_REST_API_URL` | URL Upstash Redis |
| `KV_REST_API_TOKEN` | Token Upstash Redis |
| `IUA_SECRET` | Segreto admin per `/api/reset-leaderboard` |

> **Regola**: chiavi frontend → `VITE_CHIAVE<PROVIDER>`; chiavi server → senza prefisso `VITE_`. Mai hardcodate nel sorgente.

---

## 🛠️ Comandi utili

```bash
npm run dev       # Avvia dev server (Vite, porta 5173)
npm run build     # Build produzione in /dist
npm run preview   # Anteprima build produzione
npm run lint      # ESLint (flat config)
```

---

## 📋 Registro operazioni agent

| Data | Operazione | File modificati |
|---|---|---|
| 2026-04-16 | Aggiunto logo Andryx in `public/andryx-logo.png` e aggiornato `LOGO_URL` in Navbar e Footer | `public/andryx-logo.png`, `src/components/Navbar.jsx`, `src/components/Footer.jsx` |
| 2026-04-16 | Creato `.github/copilot-instructions.md` con mappatura completa del progetto | `.github/copilot-instructions.md` |
| 2026-04-16 | Rinominato `TWITCH_CLIENT_ID` → `CHIAVETWITCH`; spostato in `.env.local`; `GamePage.jsx` legge da `import.meta.env.VITE_CHIAVETWITCH` | `src/pages/GamePage.jsx`, `.env.local`, `.env.example` |
| 2026-04-17 | **Fix cuori**: `P.heartDim` era invisibile (0.15 opacity) → ora `♡` outline a 0.32 opacity in `aprile.js`, `marzo.js`, `maggio.js`, `ottobre.js` | `src/games/aprile.js`, `src/games/marzo.js`, `src/games/maggio.js`, `src/games/ottobre.js` |
| 2026-04-17 | **Fix joystick**: `onTouchMove` React passivo → native `addEventListener` con `{ passive: false }` + joystick floating (centro = punto di touch iniziale) | `src/pages/GamePage.jsx` |
| 2026-04-17 | **Classifica v2**: riscritta con weekly/monthly/general (ZINCRBY delta). Nuova struttura Redis: weekly TTL 8gg, monthly permanente, general cumulativo | `api/leaderboard.js` |
| 2026-04-17 | **Admin leaderboard**: `reset-leaderboard.js` esteso con GET status + POST weekly/monthly/general/recalculate_general/user/full | `api/reset-leaderboard.js` |
| 2026-04-17 | **UI classifica**: tab Sett./Mensile/Generale; tab Mensile mostra mese corrente + archivio mesi passati | `src/pages/GamePage.jsx` |
| 2026-04-17 | **Calendario leader**: riga mese corrente mostra `🥇 username` in tempo reale (colore tema gioco); badge "ORA" solo se nessuno ha ancora giocato | `src/pages/GamePage.jsx` |
| 2026-04-17 | **Liquid Glass Overhaul**: restyling completo secondo le linee guida Apple Liquid Glass (WWDC 2025). Variabili CSS potenziate (prismatic tokens, concentric radii, spring curves), sfondo atmosferico multi-layer, glass-panel con blur 64px e shimmer iridescente, glass-card hover con gradiente liquido, bottoni capsule con trattamento vetro, chip con backdrop-filter, navbar/tab-bar blur potenziato, game UI glass-themed (joystick, attack button con backdrop-filter), leaderboard tabs vetro, scrollbar globali vetro, ::selection e :focus-visible branded, profili social con boxShadow profondità, overlay video con blur, footer con bordo hairline 0.5px | `src/index.css`, `src/components/Footer.jsx`, `src/components/SocialHub.jsx`, `src/pages/Home.jsx`, `src/pages/TwitchPage.jsx`, `src/pages/YouTubePage.jsx`, `src/pages/InstagramPage.jsx`, `src/pages/TikTokPage.jsx`, `src/pages/PodcastPage.jsx` |
| 2026-04-17 | **Liquid Glass Desktop Enhancement**: potenziamento specifico della resa glass su desktop — nuove classi CSS `.glass-banner` (shimmer overlay + prismatic line per banner pagine), `.glass-avatar` (box-shadow profondità per avatar), `.glass-stats-bar` (capsule con backdrop-filter per barre statistiche), sezione `@media (min-width: 641px)` con hover glass-card più profondi, glass-panel hover glow, btn-primary/btn-ghost hover potenziati, leaderboard-tab hover. Applicato `.glass-banner` ai banner di YouTube, Instagram, TikTok; `.glass-avatar` agli avatar profilo; `.glass-stats-bar` alle barre stats di Twitch e TikTok. Fix `.active-pill` da `1px` a `0.5px`. Aggiunto hover `.game-calendar-row`. | `src/index.css`, `src/pages/YouTubePage.jsx`, `src/pages/InstagramPage.jsx`, `src/pages/TikTokPage.jsx`, `src/pages/TwitchPage.jsx`, `src/pages/PodcastPage.jsx` |
| 2026-04-17 | **Liquid Glass — Apple Authentic Rewrite**: riscrittura completa del CSS per aderire alla documentazione ufficiale Apple (developer.apple.com/documentation/technologyoverviews/liquid-glass). Rimossi effetti prismatici/iridescenti rainbow (non nell'spec Apple), rimosso `brightness()` da backdrop-filter, blur ridotto a 24px standard (32px per navbar), saturate a 180% (era 210-220%), background opacity alzato a rgba(40,50,70,0.35) (era 0.06 troppo trasparente), bordi da 0.5px a 1px (standard Apple), box-shadow semplificati (outer + single inset specular), specular highlight solo bianco (no rainbow gradient), radii corretti (22-28px), varianti Regular/Clear rispettate. | `src/index.css`, `.github/copilot-instructions.md` |
| 2026-04-17 | **Liquid Glass — True iOS 26 Rewrite v2**: riscrittura radicale per catturare il vero look Liquid Glass. Gradient backgrounds (simula profondità/curvatura vetro reale), radial specular highlights (macchie "wet glass" via radial-gradient ::before), refraction caustic overlays (color bleed ::after + mix-blend-mode:screen), backdrop-filter con blur(32px)+saturate(180%)+contrast(108%), bordi blue-tinted 1.5px rgba(130,170,240,0.14), ombre blue-tinted rgba(8,12,48,...), navbar blur 40px, tab bar blur 48px | `src/index.css`, `src/components/Footer.jsx`, `src/components/SocialHub.jsx`, `src/pages/TwitchPage.jsx`, `.github/copilot-instructions.md` |
| 2026-04-21 | **🗡️ Andryx Legend** — nuovo gioco principale stile *Zelda: The Minish Cap*. Avventura top-down 2D pixel-art completa: 4 zone (Foresta di Twitchia, Villaggio dei Pixel, Caverna delle Gemme, Castello del Re Ombra), Andryx pixel-art a 4 direzioni, NPC con dialoghi typewriter, quest line (3 cristalli + boss finale), inventario (spada/scudo/chiavi/bombe/pozioni/cristalli), puzzle (blocchi spingibili, piastre, interruttori, candele), nemici con AI distinta, mini-boss + boss finale multifase, salvataggio localStorage versionato, audio Web Audio sintetizzato, HUD ricco. Hub modalita` in GamePage (Mese/Legend). Backend leaderboard esteso con `?game=monthly\|legend` (nuovo prefisso `lb:legend:*` per board separata). Chunk Vite separato `legend-*.js` (~16kB gz). | `src/games/legend/` (9 file: index.js, engine.js, sprites.js, palette.js, tiles.js, world.js, dialog.js, audio.js, save.js), `src/pages/GamePage.jsx`, `api/leaderboard.js`, `api/reset-leaderboard.js`, `.github/copilot-instructions.md` |
| 2026-04-21 | **🎮 Andryx Legend → DAVVERO 3D (Three.js low-poly)**: porting completo del renderer da canvas 2D a Three.js. Aggiunta dipendenza `three@0.171.0` (chunk `vendor-three` ~121kB gz). Nuovi file `renderer3d.js` (scena, camera prospettica top-down 3/4 stile Link's Awakening Switch, luci ambient+direzionale+hemi+point light torce, fog dinamica per zone interne/esterne, mesh pool per tile/entita`/particelle) e `models3d.js` (factory low-poly: player Andryx con cappello a punta, NPC, slime/bat/skeleton/mage, boss Guardian + Shadow King, item, alberi/stone/case modulari/fontana/portale animato/torce con glow emissivo. Cache geometrie+materiali condivise per perf). `tiles.js` esteso con `TILE_3D` + `getTile3D` + `darkenColor`. `engine.js` mantiene gameplay invariato (collisioni, AI, dialoghi, quest, save) ma render delegato al Renderer3D; HUD/dialog/minimap/overlay disegnati su un canvas 2D overlay creato dinamicamente come sibling assoluto del canvas WebGL. Chunk `legend-*.js` 78kB / 22.77kB gz. | `package.json`, `vite.config.js`, `src/games/legend/renderer3d.js`, `src/games/legend/models3d.js`, `src/games/legend/tiles.js`, `src/games/legend/engine.js`, `.github/copilot-instructions.md` |
| 2026-04-21 | **🎮 Andryx Legend → ritorno al 2D pixel-art (Minish Cap "vero")**: il renderer 3D Three.js era illeggibile e fragile (mappa rotta, texture rotte, scritte minuscole). Sostituito con `renderer2d.js`: canvas 2D con scaling per `devicePixelRatio` (testo crisp), tile vettoriali stile *The Minish Cap* (alberi tondi con highlight, sassi, cespugli, vasi, tetti rossi a listelli, finestre azzurre, fontana, torce con glow, portale pulsante), erba con variazione deterministica + filo d'erba, acqua animata, lava pulsante, ombre ovali sotto entità + Y-sort, slash arc spada, vignettatura, tinte zona, fade transizioni, camera shake. HUD molto più grande sul medesimo canvas (overlay rimosso): bar oro Minish con cuori 26px / rupie 22px / cristalli 24px, **mini-mappa 130×130** con doppio bordo oro e etichetta zona 16px, **dialog 168px** con font sans 22/20px e word-wrap automatico via `measureText`. **Eliminati** `renderer3d.js`, `models3d.js`, dipendenza `three`, chunk `vendor-three`. Esportazioni 3D rimosse anche da `tiles.js`. Chunk `legend-*.js` 72kB / 21kB gz (era 78kB+121kB Three → **-100kB+ gzipped**). | `src/games/legend/renderer2d.js` (nuovo), `src/games/legend/engine.js`, `src/games/legend/tiles.js`, `package.json`, `vite.config.js`, `.github/copilot-instructions.md`; eliminati: `renderer3d.js`, `models3d.js` |
| 2026-04-21 | **🛣️ Andryx Legend → strade al posto dei portali + fullscreen**: rimossi tutti i tile portale `*` dalle mappe; il Villaggio dei Pixel ha ora una croce di strade `_` (cols 14-15 verticali, rows 10-11 orizzontali) che collega i 4 confini cardinali alle dungeon: **N→Castello** (gated da `has_crystal_blue`), **S→Caverna**, **E→Foresta**, **O→Pianura dell'Ovest** (zona nuova, overworld con heart container e cartello "presto un nuovo dungeon"). Tutte le `transitions` sono ora `trigger:'edge'` (niente piu` `trigger:'portal'`). Mappe Foresta/Caverna/Castello aggiornate per avere l'apertura sul lato corretto + spawn allineati. Case del villaggio spostate per fare spazio alle aperture (Anziano cols 9-11, Re cols 19-21, Andryx cols 2-4 rows 13-14). Aggiunto bottone fullscreen (Maximize2/Minimize2 lucide) in alto a destra del `game-canvas-wrapper` che usa Fullscreen API + sync via `fullscreenchange`; CSS `.is-fullscreen` / `:fullscreen` scala il wrapper a 100vw/100vh con sfondo nero. Aggiornati dialoghi `crystal_green_pickup` (no piu` "portale a est") e `crystal_blue_pickup` (annuncia apertura strada nord). | `src/games/legend/world.js`, `src/games/legend/dialog.js`, `src/pages/GamePage.jsx`, `src/index.css`, `.github/copilot-instructions.md` |
| 2026-04-21 | **🐛 Andryx Legend bugfix**: 1) **NPC invisibili** — `_drawEntities` filtrava `e.hp <= 0` con eccezione solo per `item`/`projectile`; gli NPC non hanno hp (tipo non-mortale) quindi sparivano dal render. Ora il filtro hp si applica solo a `enemy`/`boss`. 2) **Musica monotona** — riscritto `playMusic` con tracce multistrato (melodia in `triangle/square` + linea di basso in `sine/triangle` + accento armonico ogni 8 step), pattern A/B di 32 step, BPM per zona (110/96/88/80), envelope ADSR per note morbide. Costruite quattro tracce vere: villaggio C-maggiore allegro, foresta minore misterioso, caverna eolio cupo, castello marcia tetra. 3) **GUI in fullscreen** — il fullscreen ora viene chiesto su `.game-area` invece che sul solo `.game-canvas-wrapper`, cosi` joystick/attack-button/keyboard-hint restano visibili anche a schermo intero su mobile. CSS aggiornato con `safe-area-inset-*` e flex layout in `.game-area.is-fullscreen`. | `src/games/legend/renderer2d.js`, `src/games/legend/audio.js`, `src/pages/GamePage.jsx`, `src/index.css` |
| 2026-04-22 | **🗑️ Rimozione Andryx Hourglass + 🦘 nuovo Andryx Jump (platformer)**: cancellata cartella `src/games/hourglass/` (19 file), rimosso chunk `hourglass` da `vite.config.js`, rimosso `'hourglass'` da `SUPPORTED_GAMES` in `api/leaderboard.js` e `api/reset-leaderboard.js`, rimosso hub-modalità Hourglass da `GamePage.jsx` (stato/import/UI/save overlay). Creato nuovo gioco `src/games/platform/` (Andryx Jump): platformer 2D originale a scorrimento laterale come terza modalità nell'hub accanto a Mese e Legend. Engine completo (gravità, salto variabile, coyote-time, jump-buffer, run/walk con accel/friction, fall-through one-way, AABB collision separata X/Y), 3 nemici (Sloimo cammina+gravità+inverte su muri/burroni, Pipistrellix vola sinusoide e segue player, Spinazzo statico), 3 power-up (Cristallo cresci 2-hit, Stella invuln 8s, Piuma doppio salto 12s), camera con dead-zone+clamp+parallax 2 layer, sprite Andryx pixel-art 4 stati big/small, HUD (mondo X-Y, monete, vite, tempo, score), pause/game-over/level-complete con fade, checkpoint, bandiera fine livello, lava/acqua/ghiaccio. 10 mondi tematici definiti: Mondo 1 (Foresta di Twitchia) con 3 livelli disegnati a mano, mondi 2-10 con 1 livello procedurale ciascuno (stub). Audio Web Audio sintetizzato: 9 SFX + 10 brani musicali procedurali (uno per mondo, scala/tempo/timbro distinti). Save localStorage `andryxify_platform_save_v1` con sblocco mondi, livelli completati, record. i18n IT/EN/ES. Leaderboard backend estesa con `'platform'` in `SUPPORTED_GAMES` (prefisso Redis `lb:platform:*`). Chunk Vite separato `platform-*.js` ~48kB / 15kB gz. Lint + build verde. | `src/games/hourglass/` (eliminata, 19 file), `src/games/platform/` (creata: index, engine, physics, tiles, world, sprites, audio, save, i18n), `vite.config.js`, `api/leaderboard.js`, `api/reset-leaderboard.js`, `src/pages/GamePage.jsx`, `.github/copilot-instructions.md` |
| 2026-04-22 | **🔐 Mod Panel — broadcaster token persistence**: aggiunto in `api/_modAuth.js` la persistenza del token OAuth del broadcaster in Redis (`mod:broadcaster:token` + `mod:broadcaster:scopes` + `mod:broadcaster:token:ts`, TTL 50gg) tramite `maybePersistBroadcasterToken` chiamato dentro `modAuthGate`. Nuovi helper esportati: `getBroadcasterToken(redis)` (legge + valida via `https://id.twitch.tv/oauth2/validate`, cancella se invalido), `pickHelixAuth({ twitchUser, redis, requireBroadcaster })` (sceglie tra token broadcaster persistito e token mod), `broadcasterTokenMissing(res)` (HTTP 503 + `code:'broadcaster_token_missing'` + `error` italiano leggibile). `syncModsFromTwitch` ora funziona anche se ad accedere è un mod (non più solo il broadcaster) usando il token broadcaster persistito. `helixGet`/`helixRequest` propagano errori arricchiti (`status`, `helix`, `path`). Tutti gli endpoint mod-* (channel PATCH, polls, rewards, schedule mutazioni, actions raid/commercial/marker/ad_schedule, users mods/vips/subs add/remove, events subscriptions) usano ora `pickHelixAuth({requireBroadcaster:true})` per le azioni di categoria A; le moderator-scoped (ban/timeout/chat-settings/shoutout) restano sul token del mod per audit corretto. `mod-commands.js` GET ritorna `broadcasterTokenAvailable`. `ModPanel.jsx` mostra `BannerBroadcasterToken` ai mod (non al broadcaster) quando il token broadcaster manca. **Categoria A** = endpoint che modificano lo stato del canale (richiedono broadcaster token). **Categoria B** = endpoint moderator-scoped con `moderator_id` (usano mod token). | `api/_modAuth.js`, `api/mod-channel.js`, `api/mod-polls.js`, `api/mod-rewards.js`, `api/mod-schedule.js`, `api/mod-actions.js`, `api/mod-users.js`, `api/mod-events.js`, `api/mod-commands.js`, `src/pages/ModPanel.jsx` |
| 2026-04-22 | **🖥️ Pulsante fullscreen fuori dal canvas + direttive qualita` giochi**: il bottone "schermo intero" era `position:absolute` dentro `.game-canvas-wrapper` con `z-index:12`, quindi copriva l'angolo top-right dell'HUD del gioco (rupie/cristalli di Andryx Legend) e anche l'overlay idle/game-over. Spostato in una nuova `.game-toolbar` flex sopra il `.game-canvas-wrapper` (sibling, non figlio), come pill con icona+label "Schermo intero"/"Esci". Su mobile <480px solo icona. Aggiunto blocco "Direttive obbligatorie per ogni gioco" in `Convenzioni di codice`: responsive a tutte le risoluzioni, DPR scaling per qualita` ultra-HD, HUD separato dal mondo di gioco, controlli meta esterni al canvas, touch+tastiera+gamepad, target 60fps, fullscreen-friendly, tema chiaro/scuro. | `src/pages/GamePage.jsx`, `src/index.css`, `.github/copilot-instructions.md` |

---

## 💡 Idee di miglioramento e feature future

---

### 🎮 Gioco
- [ ] **Più tipi di nemici** per le stanze avanzate (boss room ogni 5 stanze, range attacker, ecc.)
- [ ] **Power-up variati**: scudo temporaneo, velocità, attacco potenziato (non solo heal)
- [ ] **Suoni e musica**: Web Audio API per SFX (attacco, danno, gemma, portale) e loop musicale
- [ ] **Salvataggio sessione**: `sessionStorage` per riprendere dal piano raggiunto in caso di refresh accidentale
- [ ] **Animazioni morte più elaborate**: esplosione/dissoluzione per ogni tipo di nemico
- [ ] **Feedback danno sul player**: flash rosso breve sullo schermo quando si viene colpiti
- [ ] **Difficoltà progressiva**: aumentare numero nemici e HP al passare delle stanze più velocemente

### 🏆 Classifica
- [ ] **Notifica in-game** quando l'utente scala la classifica ("Sei in 2ª posizione!")
- [ ] **Profilo utente**: pagina `/gioco/@username` con storico punteggi mensili e badge
- [ ] **Webhook Discord/Twitch** quando qualcuno prende il primo posto
- [ ] **Paginazione** per la classifica generale (oltre i top 50)
- [ ] **Dashboard admin** (pagina web protetta) per non dover usare curl per le operazioni di reset

### 📅 Calendario
- [ ] **Countdown** al prossimo gioco del mese (se il mese non è ancora iniziato)
- [ ] **Preview del gioco futuro** (nome + emoji) per i mesi non ancora giocabili

### 🔧 Tecnico
- [ ] **Code splitting**: il bundle principale supera 500KB; usare `React.lazy()` per le pagine gioco e leaderboard
- [ ] **Joystick visivo**: aggiornare la posizione del knob a 60fps (ora il transform viene calcolato dal React state, non dal ref → possibile lag visivo)
- [ ] **Test E2E**: Playwright per verificare il flusso OAuth Twitch + submit punteggio

---

## 📏 Convenzioni di codice

- **Lingua**: tutto il codice (commenti, stringhe UI, messaggi di errore, documentazione, nomi di costanti leggibili) deve essere scritto in **italiano** o **latino**, mai in inglese. I nomi tecnici di variabili/funzioni legati a framework o API possono restare in inglese (es. `useState`, `useEffect`, `className`), ma i commenti esplicativi e le stringhe visibili all'utente devono essere sempre in italiano.
- Componenti React in **PascalCase** (`Navbar.jsx`, `Footer.jsx`)
- File CSS specifici affiancati al componente (`SquirrelRadar.css` vicino a `tracker_scoiattoli.jsx`)
- Icone da `lucide-react`; solo se mancante usare SVG custom in un componente dedicato
- Animazioni sempre con **Framer Motion** (non CSS keyframes per elementi interattivi)
- Stili globali e design token in `src/index.css` (variabili CSS `--primary`, `--secondary`, `--accent`, `--glass-bg`, `--glass-border`, `--glass-highlight`, `--glass-shadow`, ecc.)
- Design language: **Apple Liquid Glass** (WWDC 2025 / iOS 26) — `backdrop-filter: blur(32px) saturate(180%) contrast(108%)`, gradient background simulating glass depth (e.g. `linear-gradient(145deg, rgba(24,30,50,0.72), rgba(48,64,100,0.28))`), blue-tinted `1.5px solid rgba(130,170,240,0.14)` borders, radial specular highlight spots (radial-gradient `::before` pseudo-element), refraction caustic overlays (subtle color bleed `::after`), blue-tinted shadows, capsule shapes for buttons, concentric radii 22-28px for panels
- Bordi: usare `1.5px solid rgba(130,170,240,0.14)` (blue-tinted, Apple glass style); specular via `radial-gradient(ellipse at 32% 6%, rgba(255,255,255,0.22)...)`
- Glass primitives: `.glass-panel` (gradient bg + radial specular `::before` + refraction caustic `::after`), `.glass-card` (same treatment), `.glass-banner` (banner con radial specular), `.glass-avatar` (depth shadow), `.glass-stats-bar` (capsule glass) — tutti con `backdrop-filter: blur(32px) saturate(180%) contrast(108%)`, radial specular spot highlights, blue-tinted borders/shadows
- Nessun CSS-in-JS: usare `className` con classi definite in `index.css`
- Le costanti condivise tra componenti (es. `LOGO_URL`) vanno estratte e mantenute coerenti
- Le chiavi API/OAuth introdotte dall'agent si chiamano `VITE_CHIAVE<PROVIDER>` e vengono lette da `import.meta.env` (mai hardcodate nel sorgente)
- Ogni modulo gioco (`src/games/*.js`) deve esportare `meta` e `createGame` secondo il contratto di `registry.js`

### 🎮 Direttive obbligatorie per ogni gioco

Ogni gioco (mensile, Andryx Legend, Andryx Jump, futuri) **deve** rispettare le seguenti regole, senza eccezioni:

1. **Responsive a tutte le risoluzioni**: il render deve adattarsi a qualsiasi dimensione del contenitore (da 320px mobile a 4K desktop, sia portrait che landscape). Mai dimensioni hardcoded del canvas in pixel logici fissi senza scaling. Usare `ResizeObserver` sul wrapper e ridisegnare a ogni cambio di dimensione.
2. **Qualita` ULTRA ALTA — DPR scaling obbligatorio**: il backing buffer del canvas deve essere moltiplicato per `window.devicePixelRatio` (cap a 2-3 per evitare costi insostenibili) cosi` testo e linee restano crisp su display Retina/4K. Non lasciare mai `image-rendering: pixelated` salvo casi pixel-art voluti dichiarati esplicitamente nel renderer.
3. **GUI/HUD separata dal mondo di gioco**: l'HUD (vite, score, mini-mappa, dialoghi, menu pause) e il mondo giocato devono restare visivamente e logicamente separati. L'HUD non deve mai coprire elementi di gameplay critici (player, nemici imminenti, hitbox). Posizionare HUD ai bordi (top bar / bottom bar / corners) lasciando libera l'area centrale di gioco.
4. **Controlli meta esterni al canvas**: pulsanti del sito (fullscreen, pausa esterna, lingua, exit) **non** devono essere posizionati sopra il canvas con `position: absolute`. Vanno in toolbar fuori dal canvas-wrapper (es. `.game-toolbar`) per non occludere mai HUD ne` schermate idle/game-over.
5. **Touch + tastiera + gamepad**: ogni gioco accetta input da almeno joystick floating + tastiera; supportare Gamepad API quando ragionevole.
6. **Performance**: target 60fps su mobile mid-range. Render pool/cache (sprite, geometrie, materiali) per evitare allocazioni nel game loop. Niente `console.log` nel loop in produzione.
7. **Fullscreen-friendly**: il render si deve adattare automaticamente alla nuova dimensione del wrapper quando si entra/esce da fullscreen (gia` gestito a livello di pagina via Fullscreen API + ResizeObserver del renderer).
8. **Tema chiaro/scuro**: testo HUD usa colori che restano leggibili in entrambi i temi; preferire variabili CSS o palette esplicite ad alto contrasto.

