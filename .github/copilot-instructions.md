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
├── public/                       ← Asset statici serviti direttamente
│   ├── andryx-logo.png           ← Logo Andryx (navbar & footer) — aggiunto 2026-04-16
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
│   └── pages/
│       ├── Home.jsx              ← Homepage: hero, live preview Twitch, SocialHub, PodcastPromo
│       ├── TwitchPage.jsx        ← Embed stream Twitch + chat
│       ├── YouTubePage.jsx       ← Ultimi video YouTube (API)
│       ├── InstagramPage.jsx     ← Feed Instagram
│       ├── PodcastPage.jsx       ← Episodi podcast Spotify
│       ├── TikTokPage.jsx        ← Feed TikTok
│       ├── tracker_scoiattoli.jsx ← 🔒 Pagina segreta /scoiattoli (Squirrel Radar)
│       └── SquirrelRadar.css     ← Stili specifici per tracker_scoiattoli
├── vercel.json                   ← Configurazione deploy Vercel
├── vite.config.js                ← Configurazione Vite
├── eslint.config.js              ← ESLint (flat config)
├── package.json                  ← Dipendenze e script npm
└── .env.example                  ← Template variabili d'ambiente
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
| @upstash/redis + @vercel/kv | Storage serverless (KV) |
| Vercel | Hosting + serverless functions |

---

## 🧩 Componenti principali

### `Navbar.jsx`
- **Desktop**: navbar in cima con pill liquida animata (segue hover e route attiva)
- **Mobile**: tab bar in basso stile iOS con pill scorrevole
- `LOGO_URL` → punta a `/andryx-logo.png` (file locale in `public/`)
- `NAV_LINKS` → array con path, label e icona per ogni sezione

### `Footer.jsx`
- Logo + link social + copyright
- `LOGO_URL` → stessa costante, deve restare allineata a `Navbar.jsx`

### `App.jsx`
- Gestisce il redirect OAuth di Twitch: legge `access_token` dall'URL hash e lo salva in `localStorage`
- Route `/scoiattoli` è nascosta (non appare in navbar)

### `TikTokIcon.jsx`
- SVG custom perché lucide-react non include l'icona TikTok
- Accetta prop `size` (default 24)

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

---

## 🖼️ Asset e immagini

- I file nella cartella `public/` sono serviti alla radice (`/nomefile.ext`)
- **Non usare URL GitHub raw** per le immagini del sito: scaricare sempre il file in `public/` e referenziarlo con path locale (es. `/andryx-logo.png`)
- Il logo principale è `public/andryx-logo.png` (PNG con sfondo bianco, firma "Andryx" in nero/viola)

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

> **Nota per l'agent**: aggiornare sempre la tabella "Registro operazioni" ogni volta che si esegue una modifica significativa al progetto.

---

## 📏 Convenzioni di codice

- Componenti React in **PascalCase** (`Navbar.jsx`, `Footer.jsx`)
- File CSS specifici affiancati al componente (`SquirrelRadar.css` vicino a `tracker_scoiattoli.jsx`)
- Icone da `lucide-react`; solo se mancante usare SVG custom in un componente dedicato
- Animazioni sempre con **Framer Motion** (non CSS keyframes per elementi interattivi)
- Stili globali e design token in `src/index.css` (variabili CSS `--primary`, `--secondary`, `--accent`, `--glass-border`, ecc.)
- Nessun CSS-in-JS: usare `className` con classi definite in `index.css`
- Le costanti condivise tra componenti (es. `LOGO_URL`) vanno estratte e mantenute coerenti
