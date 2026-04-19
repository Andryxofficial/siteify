import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, MessageSquare, Clock, Send, Trash2, User,
  Twitch, Film, Music,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import SEO from '../components/SEO';

const MAPPA_CATEGORIE = {
  generale:     { etichetta: '💬 Generale',     colore: 'var(--text-muted)' },
  giochi:       { etichetta: '🎮 Giochi',       colore: 'var(--accent-twitch)' },
  stream:       { etichetta: '📺 Dirette',      colore: '#9146FF' },
  tech:         { etichetta: '🤖 Tech & IA',    colore: 'var(--secondary)' },
  meme:         { etichetta: '😂 Meme',         colore: 'var(--accent-warm)' },
  suggerimenti: { etichetta: '💡 Suggerimenti', colore: 'var(--primary)' },
};

function infoCategoria(valore) {
  return MAPPA_CATEGORIE[valore] || MAPPA_CATEGORIE.generale;
}

function tempoFa(ts) {
  const diff = Date.now() - Number(ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'adesso';
  if (min < 60) return `${min} min fa`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return `${ore}h fa`;
  const giorni = Math.floor(ore / 24);
  if (giorni < 30) return `${giorni}g fa`;
  return `${Math.floor(giorni / 30)} mesi fa`;
}

function formattaData(ts) {
  return new Date(Number(ts)).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const entrata = (ritardo = 0) => ({
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay: ritardo, type: 'spring', stiffness: 220, damping: 24 },
});

/* ═══════════════════════════════════════
   SCHEDA RISPOSTA
   ═══════════════════════════════════════ */
function SchedaRisposta({ risposta, puoEliminare, onElimina }) {
  return (
    <motion.div
      className="social-risposta"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      <div className="social-risposta-riga">
        <div className="social-avatar social-avatar-piccolo">
          {risposta.authorAvatar ? (
            <img src={risposta.authorAvatar} alt="" />
          ) : (
            <User size={16} />
          )}
        </div>
        <div className="social-risposta-corpo">
          <div className="social-risposta-intestazione">
            <span className="social-autore" style={{ fontSize: '0.82rem' }}>
              {risposta.authorDisplay || risposta.author}
            </span>
            <span className="social-tempo" style={{ fontSize: '0.68rem' }}>
              {tempoFa(risposta.createdAt)}
            </span>
            {puoEliminare && (
              <button
                className="social-btn-azione"
                onClick={() => onElimina(risposta.id)}
                style={{ marginLeft: 'auto', color: 'var(--accent)', padding: '2px 6px' }}
                title="Elimina risposta"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <p className="social-testo-risposta">{risposta.body}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   VISTA DISCUSSIONE
   ═══════════════════════════════════════ */
export default function ThreadView() {
  const { postId } = useParams();
  const { isLoggedIn, twitchUser, twitchToken, clientId, getTwitchLoginUrl } = useTwitchAuth();

  const [post, setPost] = useState(null);
  const [risposte, setRisposte] = useState([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');

  const [testoRisposta, setTestoRisposta] = useState('');
  const [invio, setInvio] = useState(false);
  const [erroreRisposta, setErroreRisposta] = useState('');

  /* ── Carica dati del post ── */
  const caricaTutto = useCallback(async () => {
    setCaricamento(true);
    setErrore('');
    try {
      const headers = {};
      if (twitchToken) headers.Authorization = `Bearer ${twitchToken}`;

      // Carica il singolo post direttamente via ?id=
      const res = await fetch(`/api/community?id=${postId}`, { headers });
      if (!res.ok) {
        setErrore('Post non trovato.');
        setCaricamento(false);
        return;
      }
      const data = await res.json();
      if (!data.post) {
        setErrore('Post non trovato.');
        setCaricamento(false);
        return;
      }
      setPost(data.post);

      // Carica risposte
      const resRisposte = await fetch(`/api/community-replies?postId=${postId}&limit=50`);
      if (resRisposte.ok) {
        const datiRisposte = await resRisposte.json();
        setRisposte(datiRisposte.replies || []);
      }
    } catch {
      setErrore('Errore nel caricamento della discussione.');
    } finally {
      setCaricamento(false);
    }
  }, [postId, twitchToken]);

  useEffect(() => { caricaTutto(); }, [caricaTutto]);

  /* ── Mi piace ── */
  const gestisciMiPiace = async () => {
    if (!isLoggedIn || !post) return;
    const azione = post.liked ? 'unlike' : 'like';
    setPost(prev => ({
      ...prev,
      liked: !prev.liked,
      likeCount: prev.liked ? Math.max(0, prev.likeCount - 1) : prev.likeCount + 1,
    }));
    try {
      await fetch('/api/community', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ postId: post.id, action: azione }),
      });
    } catch {
      setPost(prev => ({
        ...prev,
        liked: post.liked,
        likeCount: post.likeCount,
      }));
    }
  };

  /* ── Invia risposta ── */
  const inviaRisposta = async (e) => {
    e.preventDefault();
    if (!testoRisposta.trim() || !twitchToken) return;
    setInvio(true);
    setErroreRisposta('');
    try {
      const res = await fetch('/api/community-replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ postId, body: testoRisposta.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setRisposte(prev => [...prev, data.reply]);
      setTestoRisposta('');
      setPost(prev => prev ? { ...prev, replyCount: (prev.replyCount || 0) + 1 } : prev);
    } catch (err) {
      setErroreRisposta(err.message);
    } finally {
      setInvio(false);
    }
  };

  /* ── Elimina risposta ── */
  const eliminaRisposta = async (idRisposta) => {
    if (!twitchToken) return;
    const backup = risposte;
    setRisposte(prev => prev.filter(r => r.id !== idRisposta));
    try {
      const res = await fetch('/api/community-replies', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ replyId: idRisposta }),
      });
      if (res.ok) {
        setPost(prev => prev ? { ...prev, replyCount: Math.max(0, (prev.replyCount || 0) - 1) } : prev);
      } else {
        setRisposte(backup); // ripristina in caso di errore
      }
    } catch {
      setRisposte(backup);
    }
  };

  /* ── Elimina post ── */
  const eliminaPost = async () => {
    if (!twitchToken || !post) return;
    if (!window.confirm('Sei sicuro di voler eliminare questo post?')) return;
    try {
      const res = await fetch('/api/community', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ postId: post.id }),
      });
      if (res.ok) {
        window.location.href = '/socialify';
      } else {
        setErroreRisposta('Impossibile eliminare il post.');
      }
    } catch {
      setErroreRisposta('Errore di rete durante l\'eliminazione.');
    }
  };

  if (caricamento) {
    return (
      <div className="main-content">
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--r-lg)', marginTop: '1rem' }} />
        <div className="skeleton" style={{ height: '80px', borderRadius: 'var(--r-md)', marginTop: '0.75rem' }} />
      </div>
    );
  }

  if (errore || !post) {
    return (
      <div className="main-content">
        <div className="glass-panel social-vuoto">
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>😵</p>
          <p style={{ color: 'var(--text-muted)' }}>{errore || 'Post non trovato.'}</p>
          <Link to="/socialify" className="btn btn-ghost" style={{ marginTop: '1rem' }}>
            <ArrowLeft size={15} /> Torna a SOCIALify
          </Link>
        </div>
      </div>
    );
  }

  const cat = infoCategoria(post.tag);

  return (
    <div className="main-content">
      <SEO
        title={`${post.title} — SOCIALify`}
        description={post.body?.slice(0, 160)}
        path={`/socialify/${postId}`}
      />

      {/* Torna indietro */}
      <motion.div {...entrata(0.05)}>
        <Link to="/socialify" className="social-btn-azione social-link-indietro">
          <ArrowLeft size={16} /> Torna a SOCIALify
        </Link>
      </motion.div>

      {/* Post principale */}
      <motion.article className="glass-panel social-post-principale" {...entrata(0.1)}>
        <div className="social-scheda-riga">
          <div className="social-avatar social-avatar-grande">
            {post.authorAvatar ? (
              <img src={post.authorAvatar} alt="" />
            ) : (
              <User size={22} />
            )}
          </div>
          <div className="social-scheda-corpo">
            <div className="social-scheda-intestazione">
              <span className="social-autore" style={{ fontSize: '0.92rem' }}>
                {post.authorDisplay || post.author}
              </span>
              <span className="chip social-chip-categoria" style={{
                background: `${cat.colore}18`, color: cat.colore,
                border: `1px solid ${cat.colore}30`,
              }}>
                {cat.etichetta}
              </span>
            </div>

            <h1 className="social-titolo-thread">{post.title}</h1>

            <span className="social-tempo" style={{ fontSize: '0.72rem' }}>
              <Clock size={11} /> {formattaData(post.createdAt)}
            </span>
          </div>
        </div>

        {/* Corpo del post */}
        <div className="social-corpo-thread">{post.body}</div>

        {/* Media content */}
        {post.mediaUrl && post.mediaType === 'video' && (
          <div className="social-media-preview" style={{ margin: '1rem 0' }}>
            <video src={post.mediaUrl} controls preload="metadata" className="social-media-video">
              Il tuo browser non supporta il tag video.
            </video>
          </div>
        )}
        {post.mediaUrl && post.mediaType === 'audio' && (
          <div className="social-media-preview" style={{ margin: '1rem 0' }}>
            <div className="social-media-audio-wrapper">
              <Music size={16} color="var(--primary)" />
              <audio src={post.mediaUrl} controls preload="metadata" className="social-media-audio">
                Il tuo browser non supporta il tag audio.
              </audio>
            </div>
          </div>
        )}
        {post.mediaUrl && !post.mediaType && (
          <div className="social-media-preview" style={{ margin: '1rem 0' }}>
            <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="social-media-link">
              <Film size={14} /> Apri media allegato
            </a>
          </div>
        )}

        {/* Azioni */}
        <div className="social-azioni-thread">
          <button
            className="social-btn-azione"
            onClick={gestisciMiPiace}
            disabled={!isLoggedIn}
            title={isLoggedIn ? (post.liked ? 'Togli mi piace' : 'Metti mi piace') : 'Accedi per mettere mi piace'}
          >
            <Heart size={16} fill={post.liked ? 'var(--accent)' : 'none'} color={post.liked ? 'var(--accent)' : 'var(--text-faint)'} />
            <span>{post.likeCount || 0}</span>
          </button>
          <span className="social-btn-azione" style={{ pointerEvents: 'none' }}>
            <MessageSquare size={16} color="var(--text-faint)" />
            <span>{risposte.length}</span>
          </span>
          {isLoggedIn && post.author === twitchUser && (
            <button
              className="social-btn-azione"
              onClick={eliminaPost}
              style={{ marginLeft: 'auto', color: 'var(--accent)' }}
              title="Elimina post"
            >
              <Trash2 size={15} /> Elimina
            </button>
          )}
        </div>
      </motion.article>

      {/* Sezione risposte */}
      <motion.div {...entrata(0.18)}>
        <h3 className="social-intestazione-risposte">
          <MessageSquare size={16} /> Risposte ({risposte.length})
        </h3>

        <div className="social-lista-risposte">
          <AnimatePresence mode="popLayout">
            {risposte.map(r => (
              <SchedaRisposta
                key={r.id}
                risposta={r}
                puoEliminare={isLoggedIn && r.author === twitchUser}
                onElimina={eliminaRisposta}
              />
            ))}
          </AnimatePresence>

          {risposte.length === 0 && (
            <div className="social-nessuna-risposta">
              Nessuna risposta ancora. Sii il primo a rispondere!
            </div>
          )}
        </div>
      </motion.div>

      {/* Form risposta */}
      <motion.div {...entrata(0.24)}>
        {isLoggedIn ? (
          <form onSubmit={inviaRisposta} className="glass-panel social-form-risposta">
            <div className="social-form-risposta-riga">
              <textarea
                value={testoRisposta}
                onChange={(e) => setTestoRisposta(e.target.value)}
                placeholder="Scrivi una risposta…"
                maxLength={1000}
                rows={2}
                className="social-campo social-area-testo"
                style={{ flex: 1, marginBottom: 0, resize: 'vertical', minHeight: '60px' }}
                required
              />
              <button
                type="submit"
                className="btn btn-primary social-btn-invia"
                disabled={invio || !testoRisposta.trim()}
              >
                {invio ? '…' : <Send size={15} />}
              </button>
            </div>
            {erroreRisposta && (
              <p className="social-errore" style={{ marginTop: '6px' }}>{erroreRisposta}</p>
            )}
          </form>
        ) : clientId ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '1.2rem' }}>
            <a href={getTwitchLoginUrl(`/socialify/${postId}`)} className="btn social-btn-twitch">
              <Twitch size={14} /> Accedi con Twitch per rispondere
            </a>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
