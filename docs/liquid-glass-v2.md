# Liquid Glass v2

`src/liquid-glass-v2.css` è il layer finale del materiale visivo ANDRYXify.

Viene importato per ultimo in `src/main.jsx`, così può normalizzare le varie patch precedenti senza doverle eliminare subito.

## Obiettivi

- Rendere coerente il vetro su desktop, mobile browser e PWA.
- Evitare effetto “latte” in light mode.
- Evitare pannelli dark illeggibili in pagine chiare.
- Dare profondità reale: bordo ottico, riflesso superiore, caustica, glow, ombre stratificate.
- Mantenere leggibilità e tappabilità.
- Non rompere componenti già funzionanti.

## Materiali

Il file definisce token `--lgv-*`:

- raggi: `--lgv-radius-*`
- blur: `--lgv-blur-*`
- ombre: `--lgv-shadow-*`
- bordi: `--lgv-stroke`, `--lgv-stroke-hot`
- superfici: `--lgv-bg-panel`, `--lgv-bg-card`, `--lgv-bg-control`, `--lgv-bg-nav`
- colori testo: `--lgv-text`, `--lgv-text-muted`

## Layer coperti

- `.glass-panel`
- `.glass-card`
- `.navbar`, `.navbar-container`
- `.mobile-tab-bar`
- `.mobile-topbar-brand`
- `.mobile-profile-trigger`, `.mobile-profile-menu`
- `.ikigai-fab`, `.ikigai-panel`
- `.cookie-banner`
- `.settings-privacy-tail`
- `.social-scheda-post`
- `.premio-card`
- `.msg-feature`
- `.btn`, `.chip`, `.tab-item`, `.nav-link`
- input, textarea, select

## Desktop

Su desktop il materiale usa blur più alto, ombre più profonde e hover morbido su card/post/premi.

## Mobile browser

Su mobile il blur viene ridotto per performance e il materiale diventa più spesso, con ombre meno aggressive e bordi più leggibili.

## PWA standalone

In modalità standalone la navbar mobile, Ikigai e topbar usano una resa più “native shell”, con blur leggermente più marcato ma controllato.

## Accessibilità

- Focus ring visibile su input e textarea.
- Placeholder con contrasto più alto.
- Fallback opaco quando `backdrop-filter` non è supportato.
- `prefers-reduced-motion` disattiva transizioni/trasformazioni.

## Regola pratica

Nuove componenti dovrebbero usare classi già coperte dal materiale (`glass-panel`, `glass-card`, `btn`, `chip`) invece di creare stili vetro isolati.
