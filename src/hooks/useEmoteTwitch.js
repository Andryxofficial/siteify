/**
 * useEmoteTwitch — Hook per caricare e usare le emote (Twitch + 7TV) sul sito
 *
 * Carica le emote del canale + globali (sia Twitch che 7TV) dall'endpoint
 * /api/emotes. Cache in localStorage con TTL di 2 ore per ridurre le chiamate.
 *
 * Le emote 7TV supportano il formato animato (WebP animato) — il browser
 * le renderizza nativamente con il tag <img>.
 *
 * Espone:
 *   - emotes: lista completa emote (Twitch canale + 7TV canale + Twitch globali + 7TV globali)
 *   - emoteCanale / emoteGlobali: solo Twitch (retrocompatibile)
 *   - seventvCanale / seventvGlobali: solo 7TV
 *   - mappaEmote: Map nome→oggetto emote (per lookup veloce). Priorità di
 *     risoluzione collisioni: canale Twitch > canale 7TV > globali Twitch > globali 7TV.
 *   - caricamento: boolean
 *   - renderTestoConEmote(text): array di stringhe + JSX <img>
 *   - inserisciEmote(nome): stringa col codice emote (passthrough)
 */
import { useState, useEffect, useCallback, useMemo, createElement } from 'react';

const API_URL = '/api/emotes';
// Bump versione cache: lo schema include ora `provider`, `animata` e 7TV
const CACHE_KEY = 'andryxify_emotes_cache_v2';
const LEGACY_CACHE_KEY = 'andryxify_emotes_cache';
const CACHE_TTL = 2 * 60 * 60 * 1000; // 2 ore in ms

function leggiCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (Date.now() - data.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function salvaCache(canale, globali, seventvCanale, seventvGlobali) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      canale,
      globali,
      seventvCanale,
      seventvGlobali,
      timestamp: Date.now(),
    }));
    // Rimuovi la cache legacy (schema vecchio) se ancora presente
    try { localStorage.removeItem(LEGACY_CACHE_KEY); } catch { /* noop */ }
  } catch { /* localStorage pieno, ignora */ }
}

export function useEmoteTwitch(twitchToken) {
  const [emoteCanale, setEmoteCanale] = useState([]);
  const [emoteGlobali, setEmoteGlobali] = useState([]);
  const [seventvCanale, setSeventvCanale] = useState([]);
  const [seventvGlobali, setSeventvGlobali] = useState([]);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    let annullato = false;

    async function caricaEmote() {
      // 1. Prova la cache localStorage
      const cache = leggiCache();
      if (cache) {
        setEmoteCanale(cache.canale || []);
        setEmoteGlobali(cache.globali || []);
        setSeventvCanale(cache.seventvCanale || []);
        setSeventvGlobali(cache.seventvGlobali || []);
        setCaricamento(false);
        return;
      }

      // 2. Fetch dall'API (serve il token per aggiornare la cache server)
      if (!twitchToken) {
        setCaricamento(false);
        return;
      }

      try {
        const res = await fetch(API_URL, {
          headers: { Authorization: `Bearer ${twitchToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!annullato) {
            const canale  = data.canale  || [];
            const globali = data.globali || [];
            const stvCan  = data.seventv?.canale  || [];
            const stvGlob = data.seventv?.globali || [];
            setEmoteCanale(canale);
            setEmoteGlobali(globali);
            setSeventvCanale(stvCan);
            setSeventvGlobali(stvGlob);
            salvaCache(canale, globali, stvCan, stvGlob);
          }
        }
      } catch { /* silenzioso */ }
      if (!annullato) setCaricamento(false);
    }

    caricaEmote();
    return () => { annullato = true; };
  }, [twitchToken]);

  // Tutte le emote unite, in ordine di priorità per le collisioni di nome
  const emotes = useMemo(
    () => [...emoteCanale, ...seventvCanale, ...emoteGlobali, ...seventvGlobali],
    [emoteCanale, seventvCanale, emoteGlobali, seventvGlobali],
  );

  // Mappa nome → emote per lookup O(1).
  // L'ordine sopra garantisce che canale Twitch vince su 7TV e su globali.
  const mappaEmote = useMemo(() => {
    const m = new Map();
    for (const e of emotes) {
      if (!m.has(e.nome)) m.set(e.nome, e);
    }
    return m;
  }, [emotes]);

  /**
   * Renderizza un testo sostituendo i codici emote con immagini.
   * Restituisce un array di stringhe e elementi React <img>.
   * I codici emote sono riconosciuti come parole esatte (separate da spazi).
   * `decoding="async"` evita di bloccare il rendering con WebP animati.
   */
  const renderTestoConEmote = useCallback((testo) => {
    if (!testo || mappaEmote.size === 0) return [testo || ''];

    const parole = testo.split(/(\s+)/); // mantiene spazi/tab/newline come separatori
    const risultato = [];
    let testoAccumulato = '';

    for (const parola of parole) {
      const emote = mappaEmote.get(parola);
      if (emote) {
        // Flush testo accumulato prima dell'emote
        if (testoAccumulato) {
          risultato.push(testoAccumulato);
          testoAccumulato = '';
        }
        risultato.push(
          createElement('img', {
            key: `${emote.id}-${risultato.length}`,
            src: emote.url,
            srcSet: `${emote.url} 1x, ${emote.url2x} 2x`,
            alt: emote.nome,
            title: emote.animata ? `${emote.nome} (animata)` : emote.nome,
            className: `emote-inline${emote.animata ? ' emote-animata' : ''}`,
            loading: 'lazy',
            decoding: 'async',
            'data-provider': emote.provider || 'twitch',
            width: 24,
            height: 24,
          }),
        );
      } else {
        testoAccumulato += parola;
      }
    }

    // Flush residuo finale
    if (testoAccumulato) {
      risultato.push(testoAccumulato);
    }

    return risultato.length > 0 ? risultato : [testo];
  }, [mappaEmote]);

  // Restituisce il codice emote pronto per l'inserimento nel campo testo
  const inserisciEmote = useCallback((nome) => nome, []);

  return {
    emotes,
    emoteCanale,
    emoteGlobali,
    seventvCanale,
    seventvGlobali,
    mappaEmote,
    caricamento,
    renderTestoConEmote,
    inserisciEmote,
  };
}
