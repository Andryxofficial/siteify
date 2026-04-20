/**
 * CommandPalette.jsx — Palette ⌘K per saltare velocemente tra sezioni
 * ed eseguire azioni del Mod Panel.
 *
 * Si apre con Cmd/Ctrl+K, si naviga con frecce, conferma con Enter.
 * Filtra le voci in fuzzy-search (case-insensitive, sub-string).
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CornerDownLeft } from 'lucide-react';

/* Lista navigabile: indice viene resettato a 0 quando cambia `query`
   tramite la prop `key={query}` su questo componente (pattern React
   ufficiale per reset di state quando cambiano le props). */
function ElencoNavigabile({ filtrate, onScegli, onClose }) {
  const [indice, setIndice] = useState(0);
  const elencoRef = useRef(null);

  const scegli = useCallback((v) => {
    if (!v) return;
    onScegli(v);
    onClose();
  }, [onScegli, onClose]);

  // Tastiera: frecce + Enter
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndice(i => Math.min(i + 1, filtrate.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndice(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        scegli(filtrate[indice]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [indice, filtrate, scegli]);

  // Auto-scroll item selezionato (effetto su DOM esterno → consentito in effect)
  useEffect(() => {
    const lista = elencoRef.current;
    if (!lista) return;
    const item = lista.querySelector('.cmd-item-active');
    if (item && typeof item.scrollIntoView === 'function') {
      item.scrollIntoView({ block: 'nearest' });
    }
  }, [indice, filtrate.length]);

  return (
    <div ref={elencoRef} className="cmd-elenco">
      {filtrate.length === 0 && (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-faint)', fontSize: '0.85rem' }}>
          Nessun comando trovato.
        </div>
      )}
      {filtrate.map((v, i) => {
        const Icon = v.icon;
        const attiva = i === indice;
        return (
          <button
            key={v.id}
            onClick={() => scegli(v)}
            onMouseEnter={() => setIndice(i)}
            className={`cmd-item${attiva ? ' cmd-item-active' : ''}`}
            style={attiva ? { '--cmd-accento': v.color || 'var(--primary)' } : {}}
          >
            {Icon && (
              <span className="cmd-item-icona" style={{ color: v.color || 'var(--text-muted)' }}>
                <Icon size={14} />
              </span>
            )}
            <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.label}
              </span>
              {v.descrizione && (
                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-faint)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.descrizione}
                </span>
              )}
            </span>
            {v.gruppo && (
              <span className="cmd-item-gruppo">{v.gruppo}</span>
            )}
            {attiva && <CornerDownLeft size={12} style={{ color: 'var(--text-faint)' }} />}
          </button>
        );
      })}
    </div>
  );
}

/* Componente interno: viene montato solo quando la palette è aperta,
   così tutti gli state ripartono freschi senza dover usare setState
   sincrono dentro un useEffect. */
function PaletteInterna({ voci, onClose, onScegli }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  // Focus all'apertura
  useEffect(() => { inputRef.current?.focus(); }, []);

  // ESC → chiudi (deve restare anche quando la query è vuota)
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Filtraggio fuzzy (sub-string)
  const filtrate = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return voci;
    return voci.filter(v =>
      (v.label || '').toLowerCase().includes(q) ||
      (v.descrizione || '').toLowerCase().includes(q) ||
      (v.gruppo || '').toLowerCase().includes(q)
    );
  }, [voci, query]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="cmd-palette-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Palette comandi"
    >
      <motion.div
        initial={{ opacity: 0, y: -16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="cmd-palette glass-panel"
        onClick={e => e.stopPropagation()}
      >
        <div className="cmd-input-row">
          <Search size={15} style={{ color: 'var(--text-faint)' }} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cerca sezione o azione…"
            className="cmd-input"
          />
          <kbd className="cmd-kbd">ESC</kbd>
        </div>
        {/* key={query} → l'ElencoNavigabile si re-mounta resettando l'indice */}
        <ElencoNavigabile key={query} filtrate={filtrate} onScegli={onScegli} onClose={onClose} />
        <div className="cmd-footer">
          <span><kbd className="cmd-kbd">↑</kbd><kbd className="cmd-kbd">↓</kbd> Naviga</span>
          <span><kbd className="cmd-kbd">↵</kbd> Apri</span>
          <span style={{ marginLeft: 'auto', opacity: 0.7 }}>⌘K · ANDRYXify Mod Panel</span>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function CommandPalette({ aperta, onClose, voci, onScegli }) {
  return (
    <AnimatePresence>
      {aperta && (
        <PaletteInterna voci={voci} onClose={onClose} onScegli={onScegli} />
      )}
    </AnimatePresence>
  );
}
