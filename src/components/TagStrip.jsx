/* ─────────────────────────────────────────────────────────
   TagStrip — strip in cima al feed con macro-categorie,
   tag in trend e tag che l'utente segue.
   ─────────────────────────────────────────────────────────
   Carica /api/tags al mount e mostra:
     • Macro-categorie (cluster automatici via Jaccard)
     • Tag che l'utente segue (se loggato)
     • Tag in trend (recenti)

   Fetch in background non blocca il rendering: mostra
   skeleton min-height 84px per evitare CLS.
   ───────────────────────────────────────────────────────── */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, TrendingUp, Bookmark, Info } from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';

/* Chip riusabile per un tag (link al filtro feed) */
export function TagChip({ slug, label, postCount, emoji, color, ariaLabel, compact = false }) {
  return (
    <Link
      to={`/socialify?slug=${encodeURIComponent(slug)}`}
      className={`tag-chip${compact ? ' tag-chip--compact' : ''}`}
      style={color ? { '--tag-color': color } : undefined}
      aria-label={ariaLabel || `Tag ${slug}`}
      onClick={(e) => e.stopPropagation()}
    >
      {emoji && <span className="tag-chip-emoji" aria-hidden="true">{emoji}</span>}
      <span className="tag-chip-slug">{label || `#${slug}`}</span>
      {typeof postCount === 'number' && postCount > 0 && (
        <span className="tag-chip-conteggio">{postCount}</span>
      )}
    </Link>
  );
}

/* Riga di chip orizzontalmente scorrevole */
function RigaTag({ titolo, icona, items, vuoto, link }) {
  if (!items || items.length === 0) {
    if (!vuoto) return null;
    return (
      <div className="tag-strip-riga">
        <div className="tag-strip-intestazione">
          {icona}
          <span className="tag-strip-titolo">{titolo}</span>
          {link && <Link to={link} className="tag-strip-link"><Info size={11} /> Info</Link>}
        </div>
        <div className="tag-strip-vuoto">{vuoto}</div>
      </div>
    );
  }
  return (
    <div className="tag-strip-riga">
      <div className="tag-strip-intestazione">
        {icona}
        <span className="tag-strip-titolo">{titolo}</span>
        {link && <Link to={link} className="tag-strip-link"><Info size={11} /> Info</Link>}
      </div>
      <div className="tag-strip-scroll">
        {items}
      </div>
    </div>
  );
}

export default function TagStrip() {
  const { twitchToken } = useTwitchAuth();
  const [data, setData] = useState({ popular: [], trending: [], macros: [], following: [] });
  const [caricato, setCaricato] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/tags', {
          headers: twitchToken ? { Authorization: `Bearer ${twitchToken}` } : {},
        });
        if (!res.ok) return;
        const d = await res.json();
        if (alive) setData({
          popular: d.popular || [],
          trending: d.trending || [],
          macros: d.macros || [],
          following: d.following || [],
        });
      } catch { /* silent */ }
      finally {
        if (alive) setCaricato(true);
      }
    })();
    return () => { alive = false; };
  }, [twitchToken]);

  // Skeleton durante il caricamento — riserva l'altezza per evitare CLS
  if (!caricato) {
    return (
      <div className="tag-strip glass-panel" aria-hidden="true">
        <div className="tag-strip-skeleton skeleton" />
      </div>
    );
  }

  const haContenuto = data.macros.length > 0 || data.trending.length > 0 || data.following.length > 0;
  if (!haContenuto) return null;

  return (
    <div className="tag-strip glass-panel">
      {data.macros.length > 0 && (
        <RigaTag
          titolo="Categorie smart"
          icona={<Sparkles size={13} color="var(--primary)" />}
          link="/socialify/info-tag"
          items={data.macros.map(m => (
            <TagChip
              key={m.id}
              slug={m.id}
              label={`${m.emoji} ${m.name}`}
              postCount={m.postCount}
              ariaLabel={`Macro categoria ${m.name}`}
            />
          ))}
        />
      )}
      {data.following.length > 0 && (
        <RigaTag
          titolo="Tag che segui"
          icona={<Bookmark size={13} color="var(--accent-warm)" />}
          items={data.following.slice(0, 12).map(t => (
            <TagChip
              key={t.slug}
              slug={t.slug}
              postCount={t.postCount}
            />
          ))}
        />
      )}
      {data.trending.length > 0 && (
        <RigaTag
          titolo="In trend"
          icona={<TrendingUp size={13} color="var(--secondary)" />}
          items={data.trending.slice(0, 12).map(t => (
            <TagChip
              key={t.slug}
              slug={t.slug}
              postCount={t.postCount}
            />
          ))}
        />
      )}
    </div>
  );
}
