# Ikigai — Knowledge Base ANDRYXify

Ikigai è l'helper interno di ANDRYXify. Aiuta gli utenti a capire cosa possono fare sul sito, dove trovare le funzioni e come funzionano community, classifiche, premi, tag, notifiche, profili e impostazioni.

## Identità del sito

ANDRYXify è il sito ufficiale di Andrea / Andryx. Riunisce community, streaming, gaming, profili, messaggi, chat, impostazioni, pagine social e strumenti interattivi. È progettato come web app/PWA con stile Liquid Glass, navigazione mobile a tab, integrazione Twitch e funzioni social.

## Sezioni principali

- Home `/`: panoramica del progetto, preview live, community, giochi e contenuti principali.
- Chi sono `/chi-sono`: pagina personale di Andrea / Andryx.
- SOCIALify `/socialify`: area community con post, feed, categorie, tag, trend, risposte, allegati, preferiti e interazioni.
- Giochi `/gioco` e `/giochi`: area giochi e contenuti interattivi.
- Chat `/chat`: chat generale del sito.
- Twitch `/twitch`: collegamento alla presenza Twitch e allo streaming.
- YouTube `/youtube`: contenuti video.
- Instagram `/instagram`: contenuti social visivi.
- TikTok `/tiktok`: contenuti short/social.
- Podcast `/podcast`: contenuti podcast.
- Amici `/amici`: gestione amici.
- Messaggi `/messaggi`: messaggi privati.
- Impostazioni `/impostazioni`: account, tema, lingua, accessibilità, privacy, notifiche e dati.
- Profilo `/profilo/:username`: profilo pubblico utente.
- Info tag `/socialify/info-tag`: spiegazione del sistema tag.
- Mod Panel `/mod-panel`: strumenti di moderazione per utenti autorizzati.
- App `/app`: informazioni/installazione dell'app.
- Telegram `/telegram`: integrazione o pagina Telegram.

## Login e account

Il login principale usa Twitch. Serve per pubblicare post, mettere like, salvare preferiti, rispondere, usare amici e messaggi, modificare profilo, partecipare alle classifiche XP, gestire privacy e notifiche personalizzate. Senza login l'utente può comunque visitare pagine pubbliche e leggere contenuti disponibili.

## SOCIALify

SOCIALify è il cuore community del sito. Gli utenti possono leggere il feed, filtrare per categorie, usare tag liberi smart, aprire thread, rispondere, mettere like, salvare preferiti, condividere, allegare media, usare menzioni `@`, scegliere visibilità pubblica o solo amici, vedere tendenze e macrocategorie.

Categorie classiche: Generale, Giochi, Dirette/Stream, Tech e IA, Meme, Suggerimenti.

## Post SOCIALify

Un post può contenere titolo, testo, categoria classica, tag liberi smart, visibilità, media allegato, autore, avatar, data, like, risposte e stato preferito. Limiti principali: titolo circa 120 caratteri, corpo circa 2000 caratteri, tag liberi validati, rate limit anti-spam, media immagini/audio/video.

## Media e allegati

SOCIALify supporta immagini, audio, video e URL HTTPS legacy. Il backend valida MIME type e il frontend prepara/comprime media quando possibile.

## Risposte e thread

Ogni post può avere una pagina thread dove leggere post completo, risposte e scrivere una nuova risposta. Ikigai deve suggerire di aprire il thread quando l'utente vuole seguire una conversazione specifica.

## Preferiti

Gli utenti loggati possono salvare post nei preferiti per ritrovarli velocemente. I preferiti sono personali.

## Amici e visibilità

Il sito supporta relazioni di amicizia. I post possono essere pubblici oppure solo amici. I contenuti friends-only sono visibili all'autore e agli amici autorizzati.

## Classifiche e XP

Il sito ha un sistema XP community. Le azioni premiate includono: creare post, scrivere risposte, ricevere like, dare like e creare/usare tag che diventano popolari. Le classifiche principali sono mensile, generale e archivio mesi precedenti. Esistono rendimenti decrescenti per evitare spam: ripetere troppo la stessa azione in poco tempo dà meno XP.

## Livelli community

Livelli derivati dagli XP: Nuovo Arrivato 🌱, Curioso 🌿, Appassionato ⭐, Habitué 💫, Esperto 🔥, Veterano 💎, Elite 🏆, Leggenda 👑. Ogni livello ha soglie XP e progresso verso il livello successivo.

## Premi e milestone

I premi sono legati alla partecipazione e ai tag: tag usati in più post, tag seguiti, post con interazioni, attività mensile e milestone community. I tag spam o sospetti possono essere penalizzati.

## Sistema tag intelligente

Il sistema tag libero normalizza e valida tag, blocca tag non consentiti, segnala tag sospetti, indicizza post per tag, traccia popolarità/trend, permette follow/unfollow dei tag, crea macroCategorie tramite clustering e assegna milestone XP per tag popolari.

## Tendenze in crescita

Mostrano tag e argomenti che stanno crescendo nella community. Servono per scoprire contenuti vivi.

## Evoluzione macroCategorie

Le macroCategorie nascono dai tag usati dagli utenti e dalle co-occorrenze. L'obiettivo è far evolvere la categorizzazione del sito partendo dal comportamento reale della community.

## Intelligenza locale

ANDRYXify usa motori locali backend-only per classificazione, tag, macroCategorie e helper. Principi: niente API esterne, niente invio dati a servizi terzi, input sanitizzato, output controllato, fallback deterministico, evoluzione tramite tag, contesto dei post e knowledge base interna.

## Notifiche

Le notifiche possono includere in-app, push dispositivo, suoni, vibrazione, anteprime, raggruppamento simili, solo prioritarie, ore silenziose e categorie. Categorie utili: messaggi privati, risposte, menzioni, mi piace/reazioni, amici, community, live/Twitch, sistema.

## Impostazioni

In impostazioni si gestiscono account Twitch, tema, colore principale, modalità chiaro/scuro/auto/alba-tramonto, dimensione testo, lingua, notifiche, privacy, esportazione dati e sicurezza/messaggi.

## Privacy e sicurezza

Ikigai deve evitare di esporre dati privati, non inventare informazioni personali e non promettere funzioni non implementate. Quando una funzione richiede login, deve dirlo chiaramente e indicare il percorso.

## Stile di risposta di Ikigai

Risposte brevi, pratiche, orientate all'azione, con massimo 3-5 punti quando utile. Deve suggerire route concrete e non inventare funzioni assenti.

Esempi:

- “Come salgo in classifica?” → spiega post, risposte, like, qualità, rendimenti decrescenti e tag utili.
- “A cosa servono i tag?” → spiega ricerca, trend, macroCategorie, follow tag e scoperta contenuti.
- “Cosa posso fare qui?” → panoramica rapida delle sezioni e invito a SOCIALify/login.
- “Come controllo le notifiche?” → manda in impostazioni e spiega categorie, ore silenziose, push, suoni e anteprime.
