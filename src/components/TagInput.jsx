/* ─────────────────────────────────────────────────────────
   TagInput — chip input con autocomplete dei tag liberi
   ─────────────────────────────────────────────────────────
   Permette all'utente di inserire fino a `max` tag liberi
   (slugificati lato client per coerenza con la validazione
   server di `_tagSystem.js`).

   Comportamento:
     • Tab/Enter/Virgola/Spazio → aggiunge il tag in editing
     • Backspace su input vuoto → rimuove l'ultimo chip
     • Mentre digiti, mostra suggerimenti dal /api/tags?action=autocomplete
     • Frecce ↑/↓ per scegliere un suggerimento, Enter per confermare

   Props:
     value:     string[]                — slug attualmente selezionati
     onChange:  (string[]) => void      — chiamato quando la lista cambia
     max:       number                  — limite (default 5)
     placeholder: string
   ───────────────────────────────────────────────────────── */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Tag, X } from 'lucide-react';

/** Slugify lato client — DEVE corrispondere a slugifyTag in api/_tagSystem.js */
function slugifyClient(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[#@]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
}

export default function TagInput({ value = [], onChange, max = 5, placeholder = 'Aggiungi un tag e premi invio…' }) {
  const [bozza, setBozza] = useState('');
  const [suggerimenti, setSuggerimenti] = useState([]);
  const [indiceSugg, setIndiceSugg] = useState(-1);
  const [aperto, setAperto] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  /* Autocomplete debounce */
  useEffect(() => {
    if (!bozza || bozza.length < 1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset suggerimenti quando input vuoto
      setSuggerimenti([]);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      try {
        const slug = slugifyClient(bozza);
        if (!slug) { setSuggerimenti([]); return; }
        const res = await fetch(`/api/tags?action=autocomplete&q=${encodeURIComponent(slug)}&limit=6`);
        if (!res.ok) return;
        const data = await res.json();
        // Filtra fuori i tag già selezionati
        const filtered = (data.suggestions || []).filter(s => !value.includes(s.slug));
        setSuggerimenti(filtered);
      } catch {
        /* silent */
      }
    }, 180);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [bozza, value]);

  const aggiungi = useCallback((raw) => {
    const slug = slugifyClient(raw);
    if (!slug || slug.length < 2) return;
    if (value.includes(slug)) return;
    if (value.length >= max) return;
    onChange([...value, slug]);
    setBozza('');
    setSuggerimenti([]);
    setIndiceSugg(-1);
  }, [value, onChange, max]);

  const rimuovi = useCallback((slug) => {
    onChange(value.filter(s => s !== slug));
  }, [value, onChange]);

  const onKeyDown = (e) => {
    // Navigazione suggerimenti
    if (suggerimenti.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setIndiceSugg(idx => {
        const next = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
        if (next < 0) return suggerimenti.length - 1;
        if (next >= suggerimenti.length) return 0;
        return next;
      });
      return;
    }
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ' || e.key === 'Tab') {
      if (e.key === 'Tab' && !bozza) return;  // permetti Tab via se vuoto
      e.preventDefault();
      // Se c'è un suggerimento selezionato, usalo
      if (indiceSugg >= 0 && suggerimenti[indiceSugg]) {
        aggiungi(suggerimenti[indiceSugg].slug);
      } else if (bozza) {
        aggiungi(bozza);
      }
      return;
    }
    if (e.key === 'Backspace' && !bozza && value.length > 0) {
      // Rimuovi l'ultimo chip
      rimuovi(value[value.length - 1]);
      return;
    }
    if (e.key === 'Escape') {
      setAperto(false);
      setSuggerimenti([]);
    }
  };

  const onBlur = () => {
    // Aspetta un attimo per permettere il click sui suggerimenti
    setTimeout(() => {
      setAperto(false);
      // Se c'è una bozza, prova ad aggiungerla
      if (bozza) aggiungi(bozza);
    }, 150);
  };

  const pieno = value.length >= max;

  return (
    <div className="tag-input-contenitore">
      <div className="tag-input-chips">
        <Tag size={14} className="tag-input-icona" aria-hidden="true" />
        {value.map(slug => (
          <span key={slug} className="tag-input-chip">
            #{slug}
            <button
              type="button"
              onClick={() => rimuovi(slug)}
              className="tag-input-chip-rimuovi"
              aria-label={`Rimuovi tag ${slug}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}
        {!pieno && (
          <input
            ref={inputRef}
            type="text"
            value={bozza}
            onChange={(e) => { setBozza(e.target.value); setAperto(true); setIndiceSugg(-1); }}
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            onFocus={() => setAperto(true)}
            placeholder={value.length === 0 ? placeholder : ''}
            className="tag-input-campo"
            maxLength={24}
            autoComplete="off"
            spellCheck="false"
          />
        )}
        <span className="tag-input-contatore">
          {value.length}/{max}
        </span>
      </div>

      {aperto && suggerimenti.length > 0 && (
        <div className="tag-input-suggerimenti glass-panel">
          {suggerimenti.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              className={`tag-input-suggerimento${i === indiceSugg ? ' tag-input-suggerimento--attivo' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); aggiungi(s.slug); }}
              onMouseEnter={() => setIndiceSugg(i)}
            >
              <span className="tag-input-suggerimento-slug">#{s.slug}</span>
              <span className="tag-input-suggerimento-stat">
                {s.postCount} {s.postCount === 1 ? 'post' : 'post'}
                {s.followerCount > 0 && ` · ${s.followerCount} 👤`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
