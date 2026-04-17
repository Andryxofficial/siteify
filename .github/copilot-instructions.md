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
│   ├── leaderboard.js            ← GET/POST classifica (weekly/monthly/general)
│   ├── reset-leaderboard.js      ← GET status + POST admin (reset/wipe/recalculate)
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
│   │   └── [altri mesi].js       ← gennaio/febbraio/giugno/luglio/agosto/settembre/novembre/dicembre
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

### Struttura Redis

| Board | Logica | Chiave Redis | TTL |
|---|---|---|---|
| **Settimanale** | MAX punteggio utente nella settimana ISO corrente | `lb:<YYYY-MM>:weekly:<YYYY-WNN>` | 8 giorni |
| **Mensile** | MAX punteggio utente nel mese corrente | `lb:<YYYY-MM>:monthly` | permanente |
| **Generale** | Somma dei MAX mensili (`ZINCRBY Δ`) | `lb:general` | permanente |

### Logica generale
Quando un utente migliora il suo max mensile di Δ → `ZINCRBY lb:general Δ username`.
Risultato: `general[user] = Σ monthly_max(user, mese)` su tutti i mesi giocati.

### GET `/api/leaderboard[?season=YYYY-MM]`
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
- Body: `{ score: number, season?: string }`
- Header: `Authorization: ******`
- Valida token Twitch → scrive su weekly + monthly + ZINCRBY general

---

## 🔧 Admin — `api/reset-leaderboard.js`

Protetto da `Authorization: ******` (`IUA_SECRET` env var).

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

---

## 💡 Idee di miglioramento e feature future

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

- Componenti React in **PascalCase** (`Navbar.jsx`, `Footer.jsx`)
- File CSS specifici affiancati al componente (`SquirrelRadar.css` vicino a `tracker_scoiattoli.jsx`)
- Icone da `lucide-react`; solo se mancante usare SVG custom in un componente dedicato
- Animazioni sempre con **Framer Motion** (non CSS keyframes per elementi interattivi)
- Stili globali e design token in `src/index.css` (variabili CSS `--primary`, `--secondary`, `--accent`, `--glass-border`, `--prism-*`, ecc.)
- Design language: **Apple Liquid Glass** (WWDC 2025) — translucency, deep blur, iridescent specular highlights, 0.5px hairline borders, capsule shapes, concentric radii
- Bordi: usare `0.5px solid` (hairline Apple) anziché `1px solid`; `border-top-color` separato per specular highlight
- Glass primitives: `.glass-panel` (sezioni principali), `.glass-card` (card interne), `.glass-banner` (banner pagina con shimmer overlay), `.glass-avatar` (avatar profilo con depth shadow), `.glass-stats-bar` (barra statistiche capsule con backdrop-filter) — tutti con `backdrop-filter: blur()`, `inset box-shadow` e `::before` shimmer prismatico
- Nessun CSS-in-JS: usare `className` con classi definite in `index.css`
- Le costanti condivise tra componenti (es. `LOGO_URL`) vanno estratte e mantenute coerenti
- Le chiavi API/OAuth introdotte dall'agent si chiamano `VITE_CHIAVE<PROVIDER>` e vengono lette da `import.meta.env` (mai hardcodate nel sorgente)
- Ogni modulo gioco (`src/games/*.js`) deve esportare `meta` e `createGame` secondo il contratto di `registry.js`
