# Regola base i18n ANDRYXify

Tutto il sito deve essere tradotto in italiano, inglese e spagnolo. Nessuna eccezione.

## Regola assoluta

Nessuna stringa visibile all'utente deve essere hardcoded direttamente nei componenti React, nelle pagine, nei menu, nei bottoni, nei messaggi di errore, nei placeholder, nei toast, nelle notifiche, nei pannelli Ikigai, nella privacy o negli stati vuoti.

Ogni testo visibile deve passare da:

- `src/i18n/traduzioni.js` per UI generale;
- moduli i18n dedicati, come `src/i18n/privacySecurity.js`, quando la sezione è grande;
- motori backend con risposta localizzata per Ikigai e API.

## Lingue obbligatorie

- Italiano `it`
- Inglese `en`
- Spagnolo `es`

Se una chiave viene aggiunta in una lingua, deve essere aggiunta anche nelle altre due.

## Vietato

- Testi hardcoded nei componenti.
- Placeholder hardcoded.
- Toast hardcoded.
- Alert hardcoded.
- Messaggi API visibili non localizzati.
- Fallback visibili tecnici tipo chiave grezza, salvo ambiente di sviluppo.
- Microcopy scherzoso fuori contesto nelle impostazioni o nelle sezioni tecniche.

## Consentito senza traduzione

Solo brand, nomi propri o label tecniche intenzionali:

- ANDRYXify
- SOCIALify
- Ikigai
- Twitch
- YouTube
- Instagram
- TikTok
- nomi utente
- hashtag/tag scritti dagli utenti
- URL

## Guardia sviluppo

`src/i18n/i18nDevGuard.js` segnala in console stringhe visibili sospette non tradotte durante lo sviluppo. Non blocca la produzione, ma deve essere usata come allarme per ripulire il sito.

## Checklist PR

Prima di merge:

1. cambiare lingua in Italiano, English, Español;
2. controllare navbar mobile e desktop;
3. controllare impostazioni;
4. controllare Ikigai;
5. controllare SOCIALify e thread;
6. controllare notifiche/toast/stati vuoti;
7. controllare privacy;
8. controllare console dev per warning `[i18n-dev-guard]`.
