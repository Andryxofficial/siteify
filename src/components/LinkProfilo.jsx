/**
 * LinkProfilo — wrapper cliccabile che porta al profilo di un utente.
 *
 * Funziona sia in contesti standalone sia annidato dentro un `<Link>` o `<button>`
 * più ampio (es. la card di un post che e` a sua volta un Link al thread): in tal
 * caso intercetta il click con `stopPropagation` + `preventDefault` e naviga
 * programmaticamente. Usa un `<span role="link">` per evitare HTML invalido (un
 * `<a>` annidato in un altro `<a>`).
 *
 * Props:
 *   user         (string, obbligatoria)   username Twitch (case-insensitive)
 *   children     (ReactNode)              contenuto cliccabile (testo, avatar, ecc.)
 *   className    (string, opzionale)      classi extra (la classe base "link-profilo" e` sempre applicata)
 *   style        (object, opzionale)      stile inline
 *   title        (string, opzionale)      tooltip
 *   onClickExtra (function, opzionale)    callback aggiuntivo dopo lo stop propagation
 */
import { useNavigate } from 'react-router-dom';

export default function LinkProfilo({ user, children, className = '', style, title, onClickExtra }) {
  const navigate = useNavigate();
  if (!user) return <>{children}</>;

  const username = String(user).toLowerCase();
  const onClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onClickExtra) {
      try { onClickExtra(e); } catch { /* silenzioso */ }
    }
    /* Cmd/Ctrl/middle click → nuova scheda */
    if (e.metaKey || e.ctrlKey || e.button === 1) {
      window.open(`/profilo/${username}`, '_blank', 'noopener');
      return;
    }
    navigate(`/profilo/${username}`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <span
      role="link"
      tabIndex={0}
      className={`link-profilo ${className}`.trim()}
      style={style}
      title={title || `Vai al profilo di ${username}`}
      onClick={onClick}
      onAuxClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </span>
  );
}
