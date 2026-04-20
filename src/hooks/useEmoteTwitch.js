/**
 * useEmoteTwitch — Hook per caricare e usare le emote Twitch sul sito
 *
 * Carica le emote del canale + globali dall'endpoint /api/emotes.
 * Cache in localStorage con TTL di 2 ore per ridurre le chiamate.
 *
 * Espone:
 *   - emotes: lista completa emote (canale + globali)
 *   - emoteCanale: solo emote del canale
 *   - emoteGlobali: solo emote globali
 *   - mappaEmote: Map nome→oggetto emote (per lookup veloce)
 *   - caricamento: boolean
 *   - renderTestoConEmote(text): funzione che restituisce un array di string/JSX
 *   - inserisciEmote(nome): restituisce la stringa con il codice emote
 */
import { useState, useEffect, useCallback, useMemo, createElement } from 'react';

const API_URL = '/api/emotes';
const CACHE_KEY = 'andryxify_emotes_cache';
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

function salvaCache(canale, globali) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      canale,
      globali,
      timestamp: Date.now(),
    }));
  } catch { /* localStorage pieno, ignora */ }
}

export function useEmoteTwitch(twitchToken) {
  const [emoteCanale, setEmoteCanale] = useState([]);
  const [emoteGlobali, setEmoteGlobali] = useState([]);
  const [caricamento, setCaricamento] = useState(true);

  useEffect(() => {
    let annullato = false;

    async function caricaEmote() {
      // 1. Prova la cache localStorage
      const cache = leggiCache();
      if (cache) {
        setEmoteCanale(cache.canale || []);
        setEmoteGlobali(cache.globali || []);
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
            setEmoteCanale(data.canale || []);
            setEmoteGlobali(data.globali || []);
            salvaCache(data.canale || [], data.globali || []);
          }
        }
      } catch { /* silenzioso */ }
      if (!annullato) setCaricamento(false);
    }

    caricaEmote();
    return () => { annullato = true; };
  }, [twitchToken]);

  // Tutte le emote unite (canale prima)
  const emotes = useMemo(
    () => [...emoteCanale, ...emoteGlobali],
    [emoteCanale, emoteGlobali],
  );

  // Mappa nome → emote per lookup O(1)
  const mappaEmote = useMemo(() => {
    const m = new Map();
    for (const e of emotes) {
      m.set(e.nome, e);
    }
    return m;
  }, [emotes]);

  /**
   * Renderizza un testo sostituendo i codici emote con immagini.
   * Restituisce un array di stringhe e elementi React <img>.
   * I codici emote sono riconosciuti come parole esatte (separate da spazi).
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
            title: emote.nome,
            className: 'emote-inline',
            loading: 'lazy',
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
    mappaEmote,
    caricamento,
    renderTestoConEmote,
    inserisciEmote,
  };
}
