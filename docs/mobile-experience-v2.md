# Mobile Experience v2

`src/mobile-experience-v2.css` è il layer finale per rendere ANDRYXify più simile a un’app nativa su mobile browser e PWA.

## Principi

- Touch target minimi da 48px.
- Input sempre almeno 16px per evitare zoom iOS.
- Swipe orizzontale naturale sulle righe di tab, tag, chip, suggerimenti e quick actions.
- Scroll-snap leggero, non forzato.
- Maschere laterali per far capire che una riga è scrollabile.
- Ikigai sempre sopra la navbar e adattata alla tastiera.
- Navbar mobile sempre presente ma nascosta quando la tastiera è aperta.
- Sensori del telefono leggeri, solo dopo gesto utente e mai invasivi.
- `prefers-reduced-motion` rispettato.

## Classi scrollabili coperte

- `.tab-list`
- `.tabs`
- `.feed-tabs`
- `.category-tabs`
- `.tag-row`
- `.tags-row`
- `.social-tags-row`
- `.smart-tags-row`
- `.ikigai-suggestions`
- `.quick-actions`
- `.profile-menu-actions`
- `.notification-chips`
- `.privacy-actions`
- `.settings-buttons-row`

## JS associato

`src/hooks/useReactiveExperience.js` aggiunge automaticamente:

- `.is-swipeable`
- `.is-swiping`
- `.is-touching`
- `.is-at-start`
- `.is-at-end`

Queste classi servono per micro-feedback mobile e possono essere usate da future animazioni.

## Regola per nuove sezioni

Le nuove righe di bottoni/chip su mobile devono usare una delle classi scrollabili sopra, oppure una classe nuova da aggiungere sia a `mobile-experience-v2.css` sia a `SWIPE_SELECTOR` dentro `useReactiveExperience.js`.
