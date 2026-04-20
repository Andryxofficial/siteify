/**
 * EmotePicker — Pannello per selezionare e inserire emote Twitch
 *
 * Mostra le emote del canale (prima) e le globali (dopo) in un pannello
 * scrollabile con 7 colonne. Cliccando un'emote, viene invocato `onSelect(nome)`.
 * Supporta navigazione da tastiera (frecce, Invio, Escape) e ricerca.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Search, X, Twitch } from 'lucide-react';

/** Numero fisso di colonne nella griglia emote */
const EMOTE_GRID_COLONNE = 7;

export default function EmotePicker({ emoteCanale, emoteGlobali, onSelect, disabled }) {
  const [aperto, setAperto]   = useState(false);
  const [ricerca, setRicerca] = useState('');
  const [indFocus, setIndFocus] = useState(-1);
  const pannelloRef = useRef(null);
  const btnRef      = useRef(null);
  const inputRef    = useRef(null);
  const gridRef     = useRef(null);

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
    setAperto(prev => !prev);
    setRicerca('');
  }, []);

  const handleSelect = useCallback((nome) => {
    onSelect?.(nome);
    setAperto(false);
  }, [onSelect]);

  const filtro = ricerca.trim().toLowerCase();

  const filtraEmote = (lista) =>
    filtro ? lista.filter(e => e.nome.toLowerCase().includes(filtro)) : lista;

  const canaleFiltered  = filtraEmote(emoteCanale  || []);
  const globaliFiltered = filtraEmote(emoteGlobali || []);

  // Lista piatta di tutte le emote visibili, per navigazione a tastiera
  const tuttiItems = useMemo(
    () => [...canaleFiltered, ...globaliFiltered],
    [canaleFiltered, globaliFiltered],
  );

  const nessunaEmote = tuttiItems.length === 0;
  const tutteVuote   = (!emoteCanale || emoteCanale.length === 0) && (!emoteGlobali || emoteGlobali.length === 0);

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

  return (
    <div style={{ position: 'relative' }}>
      {/* Bottone toggle */}
      <button
        ref={btnRef}
        type="button"
        onClick={togglePannello}
        disabled={disabled}
        title="Emote Twitch"
        style={{
          background: 'transparent',
          border: 'none',
          color: aperto ? 'var(--accent, #a78bfa)' : 'inherit',
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

      {/* Pannello emote */}
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
              position: 'absolute',
              bottom: '100%',
              left: 0,
              marginBottom: '0.5rem',
              width: 'min(300px, 88vw)',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 200,
              padding: 0,
              overflow: 'hidden',
              maxWidth: 'none',
              margin: '0 0 0.5rem 0',
            }}
          >
            {/* Barra ricerca */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.6rem',
              borderBottom: '1px solid rgba(130,170,240,0.1)',
              flexShrink: 0,
            }}>
              <Search size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={ricerca}
                onChange={e => { setRicerca(e.target.value); setIndFocus(-1); }}
                onKeyDown={handleInputKeyDown}
                placeholder="Cerca emote..."
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
                maxHeight: '260px',
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

              {/* Emote del canale */}
              {canaleFiltered.length > 0 && (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.2rem 0.3rem 0.4rem',
                    fontSize: '0.72rem', fontWeight: 600, opacity: 0.6,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    <Twitch size={11} /> Canale
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${EMOTE_GRID_COLONNE}, 1fr)`, gap: '2px', width: '100%' }}>
                    {canaleFiltered.map((e, i) => (
                      <BotoneEmote
                        key={e.id}
                        emote={e}
                        indiceGlobale={i}
                        indFocus={indFocus}
                        onSelect={handleSelect}
                        onHover={setIndFocus}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Emote globali */}
              {globaliFiltered.length > 0 && (
                <>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.6rem 0.3rem 0.4rem',
                    fontSize: '0.72rem', fontWeight: 600, opacity: 0.6,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    <Twitch size={11} /> Globali
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${EMOTE_GRID_COLONNE}, 1fr)`, gap: '2px', width: '100%' }}>
                    {globaliFiltered.map((e, i) => (
                      <BotoneEmote
                        key={e.id}
                        emote={e}
                        indiceGlobale={canaleFiltered.length + i}
                        indFocus={indFocus}
                        onSelect={handleSelect}
                        onHover={setIndFocus}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Singolo bottone emote con highlight focus da tastiera */
function BotoneEmote({ emote, indiceGlobale, indFocus, onSelect, onHover }) {
  const focusato = indFocus === indiceGlobale;
  return (
    <button
      data-emote={emote.nome}
      type="button"
      onClick={() => onSelect(emote.nome)}
      onMouseEnter={() => onHover(indiceGlobale)}
      title={emote.nome}
      style={{
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
        width={28}
        height={28}
        style={{ display: 'block', objectFit: 'contain' }}
      />
    </button>
  );
}
