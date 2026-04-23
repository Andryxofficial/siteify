/**
 * MenzionePicker — @mention autocomplete per textarea e input
 *
 * Esporta:
 *   useMenzione(inputRef, value, onInserisci)
 *     → { onChange, onKeyDown, dropdownProps }
 *
 *   DropdownMenzione(dropdownProps)
 *     → pannello fixed posizionato sopra l'input, aperto quando query.length >= 2
 *
 * Utilizzo:
 *   const { onChange, onKeyDown, dropdownProps } = useMenzione(ref, valore, inserisci);
 *   <div style={{ position: 'relative' }}>
 *     <textarea ref={ref} value={valore} onChange={onChange} onKeyDown={onKeyDown} />
 *     <DropdownMenzione {...dropdownProps} />
 *   </div>
 *
 * La funzione `onInserisci(nuovoValore, nuovaCursore)` viene chiamata quando l'utente
 * seleziona un utente dalla tendina. Il chiamante aggiorna il proprio state e riposiziona il cursore.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AtSign } from 'lucide-react';

/* ── Costanti ── */
const MIN_QUERY_LEN = 1;   // caratteri minimi DOPO @ per avviare la ricerca
const MAX_RISULTATI = 8;
const DEBOUNCE_MS   = 180;
const PANEL_WIDTH   = 320; // larghezza fissa leggibile per il dropdown

/* ── Utility: trova il token @xxx alla posizione cursore ── */
function trovaMenzioneAlCursore(testo, cursore) {
  if (!testo || cursore < 1) return null;
  let i = cursore - 1;
  while (i >= 0) {
    const c = testo[i];
    if (c === '@') {
      const query = testo.slice(i + 1, cursore);
      /* La query non deve contenere spazi o newline */
      if (/\s/.test(query)) return null;
      return { query, start: i };
    }
    /* Se incontriamo uno spazio/newline prima dell'@ → nessun token */
    if (c === ' ' || c === '\n') return null;
    i--;
  }
  return null;
}

/* ── hook principale ── */
export function useMenzione(inputRef, value, onInserisci) {
  const [query, setQuery]           = useState(null);
  const [utenti, setUtenti]         = useState([]);
  const [indiceFocus, setIndiceFocus] = useState(0);
  const [caricamento, setCaricamento] = useState(false);
  const [posRect, setPosRect]       = useState(null);
  const tokenStartRef               = useRef(null);
  const debounceRef                 = useRef(null);

  /* Chiude la tendina */
  const chiudi = useCallback(() => {
    setQuery(null);
    setUtenti([]);
    setIndiceFocus(0);
    setPosRect(null);
  }, []);

  /* Fetch utenti (debounced) */
  useEffect(() => {
    if (!query || query.length < MIN_QUERY_LEN) {
      setUtenti([]);
      setCaricamento(false);
      return;
    }
    clearTimeout(debounceRef.current);
    setCaricamento(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/mention-search?q=${encodeURIComponent(query)}`);
        if (!res.ok) { setUtenti([]); return; }
        const data = await res.json();
        setUtenti((data.users || []).slice(0, MAX_RISULTATI));
        setIndiceFocus(0);
      } catch {
        setUtenti([]);
      } finally {
        setCaricamento(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  /* Intercetta onChange — rileva @xxx al cursore */
  const onChange = useCallback((e) => {
    const nuovoValore = e.target.value;
    const cursore     = e.target.selectionStart ?? nuovoValore.length;
    const trovato     = trovaMenzioneAlCursore(nuovoValore, cursore);

    if (trovato && trovato.query.length >= MIN_QUERY_LEN) {
      tokenStartRef.current = trovato.start;
      setQuery(trovato.query);
      /* Calcola posizione fixed del dropdown sopra l'elemento input */
      if (inputRef.current) {
        setPosRect(inputRef.current.getBoundingClientRect());
      }
    } else if (trovato && trovato.query.length === 0) {
      /* L'utente ha appena digitato @: tieni traccia della posizione ma
         non aprire il dropdown finché non c'è almeno 1 carattere. */
      tokenStartRef.current = trovato.start;
      chiudi();
    } else {
      chiudi();
    }
  }, [inputRef, chiudi]);

  /* Inserisce la menzione nel testo */
  const inserisci = useCallback((username) => {
    const el = inputRef.current;
    if (!el) { chiudi(); return; }

    const pos    = tokenStartRef.current ?? 0;
    const cursore = el.selectionStart ?? (value?.length ?? 0);
    const testo   = typeof value === 'string' ? value : el.value;
    const prima   = testo.slice(0, pos);
    const dopo    = testo.slice(cursore);
    const inserito = `@${username} `;
    const nuovoValore  = prima + inserito + dopo;
    const nuovaCursore = pos + inserito.length;

    onInserisci(nuovoValore, nuovaCursore);
    chiudi();

    /* Riposiziona il cursore al prossimo microtask */
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(nuovaCursore, nuovaCursore);
    }, 0);
  }, [inputRef, value, onInserisci, chiudi]);

  /* Intercetta onKeyDown — frecce + Enter + Escape */
  const onKeyDown = useCallback((e) => {
    if (!query || utenti.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndiceFocus(i => Math.min(i + 1, utenti.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndiceFocus(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (utenti[indiceFocus]) {
        e.preventDefault();
        inserisci(utenti[indiceFocus].username);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      chiudi();
    }
  }, [query, utenti, indiceFocus, inserisci, chiudi]);

  /* Aggiorna posRect al resize/scroll per non desincronizzarsi */
  useEffect(() => {
    if (!query) return;
    const handle = () => {
      if (inputRef.current) setPosRect(inputRef.current.getBoundingClientRect());
    };
    window.addEventListener('resize', handle, { passive: true });
    window.addEventListener('scroll', handle, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, { capture: true });
    };
  }, [query, inputRef]);

  return {
    onChange,
    onKeyDown,
    dropdownProps: { query, utenti, indiceFocus, setIndiceFocus, caricamento, posRect, inserisci, chiudi },
  };
}

/* ── Componente dropdown ── */
export function DropdownMenzione({
  query,
  utenti,
  indiceFocus,
  setIndiceFocus,
  caricamento,
  posRect,
  inserisci,
  chiudi,
}) {
  const aperto = !!(query && query.length >= MIN_QUERY_LEN && posRect);

  /* Stima altezza dropdown per capire se aprire sopra o sotto */
  const PANEL_H  = Math.min(utenti.length * 52 + 40, 300);
  const MARGIN   = 8;
  const spazioSopra = posRect ? posRect.top : 0;
  const apriSopra   = spazioSopra >= PANEL_H + MARGIN;

  let panelStyle = {};
  if (posRect) {
    /* Larghezza fissa leggibile, mai oltre il viewport */
    const width = Math.min(PANEL_WIDTH, window.innerWidth - 2 * MARGIN);
    /* Allinea il dropdown all'inizio del campo, ma mantienilo dentro il viewport */
    const leftPreferito = posRect.left;
    const leftMax       = window.innerWidth - width - MARGIN;
    const left          = Math.max(MARGIN, Math.min(leftPreferito, leftMax));
    if (apriSopra) {
      panelStyle = { bottom: window.innerHeight - posRect.top + MARGIN, top: 'auto', left, width };
    } else {
      panelStyle = { top: posRect.bottom + MARGIN, bottom: 'auto', left, width };
    }
  }

  return (
    <AnimatePresence>
      {aperto && (
        <motion.div
          key="dropdown-menzione"
          initial={{ opacity: 0, y: apriSopra ? 6 : -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: apriSopra ? 6 : -6, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className="glass-panel menzione-dropdown"
          style={{
            position: 'fixed',
            zIndex: 9999,
            padding: '0.4rem 0',
            overflow: 'hidden',
            ...panelStyle,
          }}
          onPointerDown={e => e.preventDefault()} /* evita blur sul textarea */
        >
          {/* Header */}
          <div style={{
            padding: '0.3rem 0.8rem 0.4rem',
            fontSize: '0.72rem',
            opacity: 0.55,
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            borderBottom: '1px solid var(--vetro-bordo-colore, rgba(130,170,240,0.12))',
          }}>
            <AtSign size={11} /> Menzioni
          </div>

          {/* Lista */}
          {caricamento && utenti.length === 0 && (
            <div style={{ padding: '0.7rem 1rem', opacity: 0.5, fontSize: '0.82rem' }}>
              Ricerca…
            </div>
          )}

          {!caricamento && utenti.length === 0 && (
            <div style={{ padding: '0.7rem 1rem', opacity: 0.5, fontSize: '0.82rem' }}>
              Nessun utente trovato
            </div>
          )}

          {utenti.map((u, i) => (
            <button
              key={u.username}
              type="button"
              className="menzione-voce"
              data-focus={i === indiceFocus ? 'true' : undefined}
              onPointerDown={() => inserisci(u.username)}
              onMouseEnter={() => setIndiceFocus(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.6rem',
                width: '100%',
                padding: '0.45rem 0.8rem',
                background: i === indiceFocus
                  ? 'rgba(130,170,240,0.16)'
                  : 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
            >
              {u.avatar ? (
                <img
                  src={u.avatar}
                  alt=""
                  width={28}
                  height={28}
                  style={{ borderRadius: '50%', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <AtSign size={13} style={{ opacity: 0.5 }} />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {u.displayName}
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  @{u.username}
                </div>
              </div>
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Utility: evidenzia @menzioni nel testo già renderizzato ── */
export function renderConMenzioni(testo) {
  if (!testo || typeof testo !== 'string') return testo;
  const parti = testo.split(/(@[a-zA-Z0-9_]{1,25})/g);
  return parti.map((parte, i) => {
    if (/^@[a-zA-Z0-9_]{1,25}$/.test(parte)) {
      return (
        <span key={i} className="tag-menzione" title={`Profilo di ${parte.slice(1)}`}>
          {parte}
        </span>
      );
    }
    return parte;
  });
}
