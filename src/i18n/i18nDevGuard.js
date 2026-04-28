/* Dev guard i18n — ANDRYXify
   Regola progetto: nessuna stringa visibile hardcoded.
   In sviluppo segnala nodi testuali sospetti non passati da i18n.
   In produzione è no-op. */

const IGNORA_TAG = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'PATH', 'CODE', 'PRE']);
const TESTO_TROPPO_TECNICO = /^(\d+|[\s\W]+|https?:|\/|#|@|ANDRYXify|SOCIALify|Ikigai|Twitch|YouTube|Instagram|TikTok)$/i;
const SOSPETTO = /[a-zàèéìòùáéíóúñ]{3,}/i;
const CONSENTITI = new Set([
  'ANDRYXify',
  'SOCIALify',
  'Ikigai',
  'Twitch',
  'YouTube',
  'Instagram',
  'TikTok',
]);

let avviato = false;
const segnalati = new Set();

function pulisci(testo = '') {
  return String(testo).replace(/\s+/g, ' ').trim();
}

function nodoVisibile(node) {
  const parent = node?.parentElement;
  if (!parent) return false;
  if (IGNORA_TAG.has(parent.tagName)) return false;
  if (parent.closest('[data-i18n-ignore], [aria-hidden="true"], .no-i18n-check')) return false;
  const style = window.getComputedStyle(parent);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function deveSegnalare(testo) {
  const t = pulisci(testo);
  if (!t || t.length < 4) return false;
  if (CONSENTITI.has(t)) return false;
  if (TESTO_TROPPO_TECNICO.test(t)) return false;
  return SOSPETTO.test(t);
}

function segnala(testo, parent) {
  const t = pulisci(testo);
  if (!deveSegnalare(t) || segnalati.has(t)) return;
  segnalati.add(t);
  console.warn('[i18n-dev-guard] Stringa visibile potenzialmente non tradotta:', t, parent);
}

function scansiona(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (nodoVisibile(node)) segnala(node.nodeValue, node.parentElement);
  }
}

export function avviaI18nDevGuard() {
  if (avviato) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!import.meta.env?.DEV) return;
  avviato = true;

  window.setTimeout(() => scansiona(), 800);

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE && nodoVisibile(node)) segnala(node.nodeValue, node.parentElement);
          if (node.nodeType === Node.ELEMENT_NODE) scansiona(node);
        });
      }
      if (mutation.type === 'characterData' && nodoVisibile(mutation.target)) {
        segnala(mutation.target.nodeValue, mutation.target.parentElement);
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}
