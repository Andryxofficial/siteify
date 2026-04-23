/**
 * EmotePicker — Pannello per selezionare e inserire emote Twitch + 7TV
 *
 * Mostra le emote in 4 sezioni: Twitch canale, 7TV canale, Twitch globali, 7TV globali.
 * Cliccando un'emote, viene invocato `onSelect(nome)`.
 * Supporta navigazione da tastiera (frecce, Invio, Escape) e ricerca.
 * Le emote 7TV animate (WebP animati) vengono renderizzate nativamente dal browser.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Search, X, Twitch } from 'lucide-react';

/** Numero fisso di colonne nella griglia emote */
const EMOTE_GRID_COLONNE = 7;

/** Icona 7TV stilizzata (lucide non la include) */
function SevenTVIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.5 4.5h7.2L8.3 19.5h3.4L16 4.5h2.5l-4.3 15h-7l4.4-15z" />
    </svg>
  );
}

export default function EmotePicker({
  emoteCanale,
  emoteGlobali,
  seventvCanale,
  seventvGlobali,
  onSelect,
  disabled,
}) {
  const [aperto, setAperto]   = useState(false);
  const [ricerca, setRicerca] = useState('');
  const [indFocus, setIndFocus] = useState(-1);
  // Posizione fixed del pannello calcolata dal bottone trigger
  const [panelStyle, setPanelStyle] = useState({});
  const pannelloRef = useRef(null);
  const btnRef      = useRef(null);
  const inputRef    = useRef(null);
  const gridRef     = useRef(null);

  /** Ricalcola le coordinate fixed del pannello rispetto al bottone trigger */
  const aggiornaPosPannello = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const PANEL_W  = Math.min(300, window.innerWidth * 0.88);
    const PANEL_H  = 340; // stima altezza massima panel (barra ricerca + griglia)
    const MARGIN   = 8;
    const spazioSopra  = rect.top;
    const spazioSotto  = window.innerHeight - rect.bottom;
    // Preferisce aprire sopra; se non c'è spazio sufficiente apre sotto
    const apriSopra = spazioSopra >= PANEL_H || spazioSopra > spazioSotto;
    // Allineamento orizzontale: parte dal bordo sinistro del pulsante, clamped al viewport
    let left = rect.left;
    if (left + PANEL_W > window.innerWidth - MARGIN) {
      left = window.innerWidth - PANEL_W - MARGIN;
    }
    left = Math.max(MARGIN, left);
    if (apriSopra) {
      setPanelStyle({ bottom: window.innerHeight - rect.top + MARGIN, top: 'auto', left, width: PANEL_W });
    } else {
      setPanelStyle({ top: rect.bottom + MARGIN, bottom: 'auto', left, width: PANEL_W });
    }
  }, []);

  // Chiudi pannello cliccando fuori
  useEffect(() => {
    if (!aperto) return;
    const handleClick = (e) => {
      if (
        pannelloRef.current && !pannelloRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) setAperto(false);
    };
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [aperto]);

  // Aggiorna posizione al resize e scroll quando il pannello è aperto
  useEffect(() => {
    if (!aperto) return;
    const handle = () => aggiornaPosPannello();
    window.addEventListener('resize', handle, { passive: true });
    window.addEventListener('scroll', handle, { passive: true, capture: true });
    return () => {
      window.removeEventListener('resize', handle);
      window.removeEventListener('scroll', handle, { capture: true });
    };
  }, [aperto, aggiornaPosPannello]);

  // Focus sul campo ricerca quando si apre
  useEffect(() => {
    if (aperto) {
      setTimeout(() => {
        setIndFocus(-1);
        inputRef.current?.focus();
      }, 50);
    }
  }, [aperto]);

  // Chiudi con Escape
  useEffect(() => {
    if (!aperto) return;
    const handleKey = (e) => { if (e.key === 'Escape') setAperto(false); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [aperto]);

  const togglePannello = useCallback(() => {
    setAperto(prev => {
      if (!prev) {
        // Calcola la posizione PRIMA di aprire, al prossimo microtask
        setTimeout(() => aggiornaPosPannello(), 0);
      }
      return !prev;
    });
    setRicerca('');
  }, [aggiornaPosPannello]);

  const handleSelect = useCallback((nome) => {
    onSelect?.(nome);
    setAperto(false);
  }, [onSelect]);

  const filtro = ricerca.trim().toLowerCase();

  const filtraEmote = (lista) =>
    filtro ? lista.filter(e => e.nome.toLowerCase().includes(filtro)) : lista;

  const canaleFiltered     = filtraEmote(emoteCanale     || []);
  const seventvCanaleF     = filtraEmote(seventvCanale   || []);
  const globaliFiltered    = filtraEmote(emoteGlobali    || []);
  const seventvGlobaliF    = filtraEmote(seventvGlobali  || []);

  // Lista piatta nell'ordine in cui le sezioni vengono renderizzate,
  // per la navigazione a tastiera coerente.
  const tuttiItems = useMemo(
    () => [...canaleFiltered, ...seventvCanaleF, ...globaliFiltered, ...seventvGlobaliF],
    [canaleFiltered, seventvCanaleF, globaliFiltered, seventvGlobaliF],
  );

  const nessunaEmote = tuttiItems.length === 0;
  const tutteVuote   =
    (!emoteCanale     || emoteCanale.length     === 0) &&
    (!emoteGlobali    || emoteGlobali.length    === 0) &&
    (!seventvCanale   || seventvCanale.length   === 0) &&
    (!seventvGlobali  || seventvGlobali.length  === 0);

  // Scorri automaticamente l'emote selezionata in vista (deve stare prima del return condizionale)
  useEffect(() => {
    if (indFocus < 0 || !gridRef.current) return;
    const btns = gridRef.current.querySelectorAll('button[data-emote]');
    btns[indFocus]?.scrollIntoView({ block: 'nearest' });
  }, [indFocus]);

  // Se non ci sono emote caricate, non mostrare il bottone
  if (tutteVuote) return null;

  const COLONNE = EMOTE_GRID_COLONNE;

  // Navigazione da tastiera nella griglia
  const handleGridKeyDown = (e) => {
    if (!tuttiItems.length) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setIndFocus(i => Math.min(i + 1, tuttiItems.length - 1));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setIndFocus(i => Math.max(i - 1, 0));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndFocus(i => Math.min(i + COLONNE, tuttiItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndFocus(i => {
        const n = i - COLONNE;
        if (n < 0) { inputRef.current?.focus(); return -1; }
        return n;
      });
    } else if (e.key === 'Enter' && indFocus >= 0) {
      e.preventDefault();
      handleSelect(tuttiItems[indFocus].nome);
    } else if (e.key === 'Tab') {
      setAperto(false);
    }
  };

  // Quando l'utente preme ArrowDown nel campo ricerca → sposta focus sulla griglia
  const handleInputKeyDown = (e) => {
    if (e.key === 'ArrowDown' && tuttiItems.length > 0) {
      e.preventDefault();
      setIndFocus(0);
      gridRef.current?.focus();
    } else if (e.key === 'Escape') {
      setAperto(false);
    }
  };

  /** Helper per renderizzare un'intestazione sezione con icona */
  const Intestazione = ({ icon, label, primaSezione }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.3rem',
      padding: primaSezione ? '0.2rem 0.3rem 0.4rem' : '0.6rem 0.3rem 0.4rem',
      fontSize: '0.72rem', fontWeight: 600, opacity: 0.6,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {icon} {label}
    </div>
  );

  /** Renderizza una sezione di emote (skip se vuota) */
  const renderSezione = (lista, intestazione, offsetIndice, primaSezione) => {
    if (lista.length === 0) return null;
    return (
      <>
        <Intestazione {...intestazione} primaSezione={primaSezione} />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${EMOTE_GRID_COLONNE}, 1fr)`, gap: '2px', width: '100%' }}>
          {lista.map((e, i) => (
            <BotoneEmote
              key={e.id}
              emote={e}
              indiceGlobale={offsetIndice + i}
              indFocus={indFocus}
              onSelect={handleSelect}
              onHover={setIndFocus}
            />
          ))}
        </div>
      </>
    );
  };

  // Calcolo offset per la navigazione tastiera coerente con la lista piatta
  const offCanale     = 0;
  const offSevenCan   = canaleFiltered.length;
  const offGlobali    = offSevenCan + seventvCanaleF.length;
  const offSevenGlob  = offGlobali + globaliFiltered.length;

  // Determina quale sezione è la "prima" mostrata, per il padding-top
  const primaSezioneEsiste =
    canaleFiltered.length > 0 ? 'canale'
      : seventvCanaleF.length > 0 ? '7tv-canale'
        : globaliFiltered.length > 0 ? 'globali'
          : '7tv-globali';

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Bottone toggle */}
      <button
        ref={btnRef}
        type="button"
        onClick={togglePannello}
        disabled={disabled}
        title="Emote Twitch + 7TV"
        style={{
          background: 'transparent',
          border: 'none',
          color: aperto ? 'var(--primary)' : 'inherit',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: '0.4rem',
          display: 'flex',
          alignItems: 'center',
          opacity: disabled ? 0.4 : 0.7,
          transition: 'opacity 0.2s, color 0.2s',
        }}
        onMouseEnter={e => { if (!disabled) e.currentTarget.style.opacity = '1'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = disabled ? '0.4' : '0.7'; }}
      >
        <Smile size={20} />
      </button>

      {/* Pannello emote — position:fixed per sfuggire a qualsiasi stacking context */}
      <AnimatePresence>
        {aperto && (
          <motion.div
            ref={pannelloRef}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="glass-panel"
            style={{
              position: 'fixed',
              zIndex: 9999,
              ...panelStyle,
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
              overflow: 'hidden',
              maxWidth: 'none',
              boxShadow: '0 8px 40px rgba(8,12,48,0.60)',
            }}
          >
            {/* Barra ricerca */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.6rem',
              borderBottom: '1px solid var(--vetro-bordo-colore)',
              flexShrink: 0,
            }}>
              <Search size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="search"
                value={ricerca}
                onChange={e => { setRicerca(e.target.value); setIndFocus(-1); }}
                onKeyDown={handleInputKeyDown}
                placeholder="Cerca emote..."
                inputMode="search"
                enterKeyHint="search"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: 'inherit',
                  fontSize: '0.82rem',
                  outline: 'none',
                  padding: '0.2rem 0',
                }}
              />
              {ricerca && (
                <button
                  type="button"
                  onClick={() => setRicerca('')}
                  title="Cancella ricerca"
                  style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Griglia emote — area scrollabile con navigazione tastiera */}
            <div
              ref={gridRef}
              tabIndex={indFocus >= 0 ? 0 : -1}
              onKeyDown={handleGridKeyDown}
              style={{
                overflowY: 'auto',
                overflowX: 'hidden',
                maxHeight: '280px',
                padding: '0.4rem',
                width: '100%',
                boxSizing: 'border-box',
                outline: 'none',
              }}
            >
              {nessunaEmote && (
                <p style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.8rem', padding: '1rem' }}>
                  {filtro ? 'Nessuna emote trovata' : 'Nessuna emote disponibile'}
                </p>
              )}

              {/* Twitch canale */}
              {renderSezione(
                canaleFiltered,
                { icon: <Twitch size={11} />, label: 'Twitch · Canale' },
                offCanale,
                primaSezioneEsiste === 'canale',
              )}

              {/* 7TV canale */}
              {renderSezione(
                seventvCanaleF,
                { icon: <SevenTVIcon size={11} />, label: '7TV · Canale' },
                offSevenCan,
                primaSezioneEsiste === '7tv-canale',
              )}

              {/* Twitch globali */}
              {renderSezione(
                globaliFiltered,
                { icon: <Twitch size={11} />, label: 'Twitch · Globali' },
                offGlobali,
                primaSezioneEsiste === 'globali',
              )}

              {/* 7TV globali */}
              {renderSezione(
                seventvGlobaliF,
                { icon: <SevenTVIcon size={11} />, label: '7TV · Globali' },
                offSevenGlob,
                primaSezioneEsiste === '7tv-globali',
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Singolo bottone emote con highlight focus da tastiera + indicatore animata */
function BotoneEmote({ emote, indiceGlobale, indFocus, onSelect, onHover }) {
  const focusato = indFocus === indiceGlobale;
  return (
    <button
      data-emote={emote.nome}
      data-provider={emote.provider || 'twitch'}
      type="button"
      onClick={() => onSelect(emote.nome)}
      onMouseEnter={() => onHover(indiceGlobale)}
      title={emote.animata ? `${emote.nome} (animata)` : emote.nome}
      style={{
        position: 'relative',
        background: focusato ? 'rgba(130,170,240,0.18)' : 'transparent',
        border: `1px solid ${focusato ? 'rgba(130,170,240,0.35)' : 'transparent'}`,
        borderRadius: 8,
        padding: '4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.12s, border-color 0.12s',
        outline: 'none',
      }}
    >
      <img
        src={emote.url}
        srcSet={`${emote.url} 1x, ${emote.url2x} 2x`}
        alt={emote.nome}
        loading="lazy"
        decoding="async"
        width={28}
        height={28}
        style={{ display: 'block', objectFit: 'contain' }}
      />
      {emote.animata && (
        <span
          aria-hidden="true"
          title="Animata"
          style={{
            position: 'absolute',
            bottom: 2,
            right: 2,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent-warm, #f5a623)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          }}
        />
      )}
    </button>
  );
}
