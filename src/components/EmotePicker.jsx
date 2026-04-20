/**
 * EmotePicker — Pannello per selezionare e inserire emote Twitch
 *
 * Mostra le emote del canale (prima) e le globali (dopo) in un pannello
 * scrollabile. Cliccando un'emote, viene invocato `onSelect(nome)`.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile, Search, X, Twitch } from 'lucide-react';

export default function EmotePicker({ emoteCanale, emoteGlobali, onSelect, disabled }) {
  const [aperto, setAperto] = useState(false);
  const [ricerca, setRicerca] = useState('');
  const pannelloRef = useRef(null);
  const btnRef = useRef(null);

  // Chiudi pannello cliccando fuori
  useEffect(() => {
    if (!aperto) return;
    const handleClick = (e) => {
      if (
        pannelloRef.current && !pannelloRef.current.contains(e.target) &&
        btnRef.current && !btnRef.current.contains(e.target)
      ) {
        setAperto(false);
      }
    };
    document.addEventListener('pointerdown', handleClick);
    return () => document.removeEventListener('pointerdown', handleClick);
  }, [aperto]);

  const togglePannello = useCallback(() => {
    setAperto(prev => !prev);
    setRicerca('');
  }, []);

  const handleSelect = useCallback((nome) => {
    onSelect?.(nome);
  }, [onSelect]);

  const filtro = ricerca.trim().toLowerCase();

  const filtraEmote = (lista) =>
    filtro ? lista.filter(e => e.nome.toLowerCase().includes(filtro)) : lista;

  const canaleFiltered = filtraEmote(emoteCanale || []);
  const globaliFiltered = filtraEmote(emoteGlobali || []);
  const nessunaEmote = canaleFiltered.length === 0 && globaliFiltered.length === 0;
  const tutteVuote = (!emoteCanale || emoteCanale.length === 0) && (!emoteGlobali || emoteGlobali.length === 0);

  // Se non ci sono emote caricate, non mostrare il bottone
  if (tutteVuote) return null;

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
              width: 'min(320px, 85vw)',
              maxHeight: '300px',
              display: 'flex',
              flexDirection: 'column',
              zIndex: 100,
              padding: 0,
              overflow: 'hidden',
            }}
          >
            {/* Barra ricerca */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 0.6rem',
              borderBottom: '1px solid rgba(130,170,240,0.1)',
            }}>
              <Search size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
              <input
                type="text"
                value={ricerca}
                onChange={e => setRicerca(e.target.value)}
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

            {/* Griglia emote */}
            <div style={{ overflowY: 'auto', padding: '0.4rem' }}>
              {nessunaEmote && (
                <p style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.8rem', padding: '1rem' }}>
                  {filtro ? 'Nessuna emote trovata' : 'Nessuna emote disponibile'}
                </p>
              )}

              {/* Emote del canale */}
              {canaleFiltered.length > 0 && (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.2rem 0.3rem 0.4rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    opacity: 0.6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    <Twitch size={11} /> Canale
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))',
                    gap: '2px',
                  }}>
                    {canaleFiltered.map(e => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => handleSelect(e.nome)}
                        title={e.nome}
                        style={{
                          background: 'transparent',
                          border: '1px solid transparent',
                          borderRadius: 8,
                          padding: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={ev => {
                          ev.currentTarget.style.background = 'rgba(130,170,240,0.12)';
                          ev.currentTarget.style.borderColor = 'rgba(130,170,240,0.2)';
                        }}
                        onMouseLeave={ev => {
                          ev.currentTarget.style.background = 'transparent';
                          ev.currentTarget.style.borderColor = 'transparent';
                        }}
                      >
                        <img
                          src={e.url}
                          srcSet={`${e.url} 1x, ${e.url2x} 2x`}
                          alt={e.nome}
                          loading="lazy"
                          width={28}
                          height={28}
                          style={{ display: 'block' }}
                        />
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Emote globali */}
              {globaliFiltered.length > 0 && (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    padding: '0.6rem 0.3rem 0.4rem',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    opacity: 0.6,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    <Twitch size={11} /> Globali
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))',
                    gap: '2px',
                  }}>
                    {globaliFiltered.map(e => (
                      <button
                        key={e.id}
                        type="button"
                        onClick={() => handleSelect(e.nome)}
                        title={e.nome}
                        style={{
                          background: 'transparent',
                          border: '1px solid transparent',
                          borderRadius: 8,
                          padding: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.15s, border-color 0.15s',
                        }}
                        onMouseEnter={ev => {
                          ev.currentTarget.style.background = 'rgba(130,170,240,0.12)';
                          ev.currentTarget.style.borderColor = 'rgba(130,170,240,0.2)';
                        }}
                        onMouseLeave={ev => {
                          ev.currentTarget.style.background = 'transparent';
                          ev.currentTarget.style.borderColor = 'transparent';
                        }}
                      >
                        <img
                          src={e.url}
                          srcSet={`${e.url} 1x, ${e.url2x} 2x`}
                          alt={e.nome}
                          loading="lazy"
                          width={28}
                          height={28}
                          style={{ display: 'block' }}
                        />
                      </button>
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
