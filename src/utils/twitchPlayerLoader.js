/**
 * twitchPlayerLoader.js — Lazy loader idempotente per Twitch Player Embed API
 *
 * Carica il player JavaScript SDK di Twitch una sola volta, condiviso tra
 * tutte le istanze (LivePlayer.jsx e MiniPlayerLive.jsx).
 * Lo script viene aggiunto al <head> in modo asincrono e il Promise
 * risolve quando `window.Twitch.Player` è disponibile.
 *
 * Uso:
 *   import { loadTwitchPlayer } from '@/utils/twitchPlayerLoader';
 *   const TwitchPlayer = await loadTwitchPlayer();
 *   const player = new TwitchPlayer('container-id', { ... });
 */

let twitchPlayerPromise = null;

export function loadTwitchPlayer() {
  // Se già presente, risolvi subito
  if (window.Twitch?.Player) return Promise.resolve(window.Twitch.Player);

  // Se già in fase di caricamento, ritorna la promessa esistente
  if (twitchPlayerPromise) return twitchPlayerPromise;

  // Altrimenti crea lo script e carica il player SDK
  twitchPlayerPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://player.twitch.tv/js/embed/v1.js';
    script.async = true;
    script.onload = () => {
      if (window.Twitch?.Player) {
        resolve(window.Twitch.Player);
      } else {
        reject(new Error('Twitch Player SDK caricato ma window.Twitch.Player non disponibile.'));
      }
    };
    script.onerror = () => reject(new Error('Impossibile caricare Twitch Player SDK.'));
    document.head.appendChild(script);
  });

  return twitchPlayerPromise;
}
