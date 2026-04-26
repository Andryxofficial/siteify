# Ikigai Agency

Ikigai Agency è il sistema che permette a Ikigai di intervenire in modo proattivo e contestuale.

Non apre popup casuali. Osserva segnali locali minimizzati e interviene solo quando vede pattern chiari.

## Principio

Ikigai è libera di aiutare, consigliare e guidare l’utente, ma deve farlo in modo:

- utile
- non invadente
- disattivabile
- locale/privacy-first
- senza leggere contenuti privati grezzi quando non serve

## Eventi supportati

I componenti del sito possono chiamare:

```js
import { recordIkigaiSignal } from '../utils/ikigaiAgency';

recordIkigaiSignal('game:death', {
  gameId: 'scoiattoli',
  gameName: 'Scoiattoli',
});
```

Altri esempi:

```js
recordIkigaiSignal('game:fail', { topic: 'boss-1', label: 'Boss 1' });
recordIkigaiSignal('post:empty_submit', { topic: 'post' });
recordIkigaiSignal('post:missing_tags', { topic: 'tag' });
recordIkigaiSignal('form:error', { topic: 'settings-notifications', label: 'Notifiche' });
```

## Comportamento

- Dopo 3 morti nello stesso gioco: consiglio pratico.
- Dopo 3 errori simili: suggerimento di cambiare approccio.
- Post vuoto: aiuto a iniziare il contenuto.
- Post senza tag: suggerisce di aggiungere 1-3 tag.

## Anti-invadenza

Ikigai non deve parlare di continuo.

Il sistema usa:

- cooldown per argomento
- silenzio temporaneo da 30 minuti
- “più tardi” per rimandare un consiglio
- nessun toast mentre la chat Ikigai è aperta
- nessun toast mentre la tastiera è aperta

## Privacy

Gli eventi salvano solo segnali minimizzati in `localStorage`:

- tipo evento
- topic generico
- conteggio
- timestamp
- label breve

Non salva testo privato completo, messaggi privati, contenuto chat private o dati sensibili.

## UI

Il componente visibile è:

```txt
src/components/IkigaiAgencyToast.jsx
```

Lo stile è:

```txt
src/ikigai-agency.css
```

La logica è:

```txt
src/hooks/useIkigaiAgency.js
src/utils/ikigaiAgency.js
```

## Integrazione futura

In futuro i giochi possono inviare eventi più ricchi ma sempre minimizzati, ad esempio:

- area in cui l’utente muore
- tipo ostacolo
- tempo medio di sopravvivenza
- numero tentativi
- livello
- difficoltà percepita

Ikigai può trasformarli in consigli progressivi senza conoscere dati personali sensibili.
