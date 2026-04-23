import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, MessageSquare, Clock, Send, Trash2, User,
  Twitch, Film, Music, Paperclip, X, Volume2, CornerDownRight, Reply,
  Share2,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import BottoneAggiungiAmico from './BottoneAggiungiAmico';
import SEO from '../components/SEO';
import { preparaMediaPerUpload, MEDIA_ACCETTATI } from '../utils/compressioneMedia';
import { useMenzione, DropdownMenzione, renderConMenzioni } from './MenzionePicker';

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
   MEDIA DISPLAY locale — carica e visualizza media allegati
   ═══════════════════════════════════════ */
function MediaDisplay({ mediaId, mediaType }) {
  const [src, setSrc]     = useState(null);
  const [mime, setMime]   = useState('');
  const [nome, setNome]   = useState('');
  const [caric, setCaric] = useState(true);
  const [err, setErr]     = useState(false);
  const blobUrlRef        = useRef(null);

  const MIME_CONSENTITI = ['image/', 'audio/', 'video/'];

  useEffect(() => {
    if (!mediaId) return;
    let annullato = false;
    (async () => {
      try {
        const res  = await fetch(`/api/community-media?action=get&id=${encodeURIComponent(mediaId)}`);
        if (!res.ok) throw new Error();
        const dati = await res.json();
        if (annullato) return;
        /* Valida il MIME type prima di costruire il data: URL (prevenzione XSS) */
        if (!MIME_CONSENTITI.some(p => (dati.mimeType || '').startsWith(p))) throw new Error();
        const blob = await fetch(`data:${dati.mimeType};base64,${dati.data}`).then(r => r.blob());
        if (annullato) return;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const newUrl = URL.createObjectURL(blob);
        blobUrlRef.current = newUrl;
        setSrc(newUrl);
        setMime(dati.mimeType);
        setNome(dati.name || 'file');
      } catch { if (!annullato) setErr(true); }
      finally  { if (!annullato) setCaric(false); }
    })();
    return () => {
      annullato = true;
      if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId]);

  if (!mediaId) return null;
  if (caric) return <div style={{ opacity: 0.5, fontSize: '0.8rem', marginTop: '0.4rem' }}>⏳ Caricamento media…</div>;
  if (err)   return null;

  const tipo = mediaType || (mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'video');

  if (tipo === 'image') return (
    <div className="social-media-preview" style={{ marginTop: '0.4rem' }}>
      <img src={src} alt={nome} style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, display: 'block' }} />
    </div>
  );
  if (tipo === 'audio') return (
    <div className="social-media-preview" style={{ marginTop: '0.4rem' }}>
      <div className="social-media-audio-wrapper">
        <Music size={14} color="var(--primary)" />
        <audio src={src} controls preload="metadata" className="social-media-audio" />
      </div>
    </div>
  );
  return (
    <div className="social-media-preview" style={{ marginTop: '0.4rem' }}>
      <video src={src} controls preload="metadata" className="social-media-video" />
    </div>
  );
}


function SchedaRisposta({ risposta, puoEliminare, onElimina, onRispondi, onVaiA, onMiPiace, isLoggedIn, twitchToken, currentUser }) {
  const annidata = !!risposta.parentReplyId;
  const conteggioLike = Number(risposta.likeCount || 0);
  const giaPiaciuta = !!risposta.liked;
  return (
    <motion.div
      id={`risposta-${risposta.id}`}
      className={`social-risposta${annidata ? ' social-risposta--annidata' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      {/* Quote-pill: "↳ in risposta a @user: «...»" */}
      {annidata && (
        <button
          type="button"
          className="social-risposta-quote"
          onClick={(e) => { e.stopPropagation(); onVaiA?.(risposta.parentReplyId); }}
          title="Vai alla risposta originale"
        >
          <CornerDownRight size={12} aria-hidden="true" />
          <span className="social-risposta-quote-autore">
            @{risposta.parentReplyAuthorDisplay || risposta.parentReplyAuthor || '…'}
          </span>
          {risposta.parentReplySnippet && (
            <span className="social-risposta-quote-snippet">
              «{risposta.parentReplySnippet}{risposta.parentReplySnippet.length >= 140 ? '…' : ''}»
            </span>
          )}
        </button>
      )}

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
            <span className="social-autore" style={{ fontSize: '0.86rem' }}>
              {risposta.authorDisplay || risposta.author}
            </span>
            <BottoneAggiungiAmico
              targetUser={risposta.author}
              twitchToken={twitchToken}
              currentUser={currentUser}
            />
            <span className="social-tempo" style={{ fontSize: '0.7rem' }}>
              <Clock size={10} /> {tempoFa(risposta.createdAt)}
            </span>
            {puoEliminare && (
              <button
                className="social-btn-azione social-btn-azione--danger"
                onClick={() => onElimina(risposta.id)}
                style={{ marginLeft: 'auto', padding: '3px 7px' }}
                title="Elimina risposta"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <p className="social-testo-risposta">{renderConMenzioni(risposta.body)}</p>
          {risposta.mediaId && (
            <MediaDisplay mediaId={risposta.mediaId} mediaType={risposta.mediaType} />
          )}
          {/* Azioni: Mi piace + Rispondi a questa risposta */}
          {(onMiPiace || onRispondi) && (
            <div className="social-risposta-azioni">
              {onMiPiace && (
                <button
                  type="button"
                  className={`social-btn-azione${giaPiaciuta ? ' social-btn-azione--liked' : ''}`}
                  onClick={() => onMiPiace(risposta)}
                  disabled={!isLoggedIn}
                  title={
                    isLoggedIn
                      ? (giaPiaciuta ? 'Togli mi piace' : 'Metti mi piace')
                      : 'Accedi per mettere mi piace'
                  }
                  aria-pressed={giaPiaciuta}
                >
                  <Heart size={12} fill={giaPiaciuta ? 'currentColor' : 'none'} />
                  <span>{conteggioLike}</span>
                </button>
              )}
              {onRispondi && (
                <button
                  type="button"
                  className="social-btn-azione social-btn-azione--reply"
                  onClick={() => onRispondi(risposta)}
                >
                  <Reply size={12} /> Rispondi
                </button>
              )}
            </div>
          )}
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
  const [rispostaA, setRispostaA] = useState(null); // { id, author, displayName } se rispondiamo a una risposta
  const [mediaFile, setMediaFile]           = useState(null);
  const [mediaPreview, setMediaPreview]     = useState(null);
  const [mediaType, setMediaType]           = useState('');
  const [caricandoMedia, setCaricandoMedia] = useState(false);
  const fileInputRispostaRef = useRef(null);
  const mediaPreviewRef      = useRef(null); // ref per revoca blob URL sicura su unmount
  const textareaRispostaRef  = useRef(null);
  const formRispostaRef      = useRef(null);

  useEffect(() => {
    return () => { if (mediaPreviewRef.current) URL.revokeObjectURL(mediaPreviewRef.current); };
  }, []);

  /* ── Carica dati del post ── */
  const caricaTutto = useCallback(async () => {
    setCaricamento(true);
    setErrore('');
    try {
      const headers = {};
      if (twitchToken) headers.Authorization = `Bearer ${twitchToken}`;

      // Carica il singolo post direttamente via ?id=
      const res = await fetch(`/api/community?id=${postId}`, { headers });
      if (res.status === 403) {
        setErrore('🔒 Questo post è visibile solo agli amici dell\'autore.');
        setCaricamento(false);
        return;
      }
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

      // Carica risposte (con auth opzionale per ricevere il flag `liked` per utente)
      const resRisposte = await fetch(`/api/community-replies?postId=${postId}&limit=50`, { headers });
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

  /* ── @mention nel campo risposta ── */
  const menzione = useMenzione(textareaRispostaRef, testoRisposta, (nuovoVal, nuovaCursore) => {
    setTestoRisposta(nuovoVal);
    setTimeout(() => {
      if (textareaRispostaRef.current) {
        textareaRispostaRef.current.setSelectionRange(nuovaCursore, nuovaCursore);
      }
    }, 0);
  });

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

  /* ── Mi piace su una risposta ── */
  const gestisciMiPiaceRisposta = useCallback(async (risposta) => {
    if (!isLoggedIn || !twitchToken || !risposta?.id) return;
    const giaPiaciuta = !!risposta.liked;
    const azione = giaPiaciuta ? 'unlike' : 'like';

    /* Aggiornamento ottimistico */
    setRisposte(prev => prev.map(r => r.id === risposta.id
      ? {
          ...r,
          liked: !giaPiaciuta,
          likeCount: Math.max(0, Number(r.likeCount || 0) + (giaPiaciuta ? -1 : 1)),
        }
      : r
    ));

    try {
      const res = await fetch('/api/community-replies', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ replyId: risposta.id, action: azione }),
      });
      if (!res.ok) throw new Error('PATCH non ok');
      const data = await res.json();
      /* Riconcilia col conteggio del server (in caso di drift) */
      setRisposte(prev => prev.map(r => r.id === risposta.id
        ? { ...r, liked: !!data.liked, likeCount: Math.max(0, Number(data.likeCount || 0)) }
        : r
      ));
    } catch {
      /* Rollback in caso di errore */
      setRisposte(prev => prev.map(r => r.id === risposta.id
        ? {
            ...r,
            liked: giaPiaciuta,
            likeCount: Math.max(0, Number(r.likeCount || 0) + (giaPiaciuta ? 1 : -1)),
          }
        : r
      ));
    }
  }, [isLoggedIn, twitchToken]);

  /* ── Invia risposta ── */
  const inviaRisposta = async (e) => {
    e.preventDefault();
    if (!testoRisposta.trim() || !twitchToken) return;
    setInvio(true);
    setErroreRisposta('');
    try {
      const payload = { postId, body: testoRisposta.trim() };
      if (rispostaA?.id) payload.parentReplyId = rispostaA.id;

      // Upload media allegato
      if (mediaFile) {
        setCaricandoMedia(true);
        const preparato = await preparaMediaPerUpload(mediaFile);
        const uploadRes = await fetch('/api/community-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
          body: JSON.stringify({ action: 'upload', ...preparato }),
        });
        setCaricandoMedia(false);
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Errore upload media');
        payload.mediaId   = uploadData.mediaId;
        payload.mediaType = preparato.mediaType;
      }

      const res = await fetch('/api/community-replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setRisposte(prev => [...prev, data.reply]);
      setTestoRisposta('');
      setRispostaA(null);
      if (mediaPreview) { URL.revokeObjectURL(mediaPreview); mediaPreviewRef.current = null; }
      setMediaFile(null);
      setMediaPreview(null);
      setMediaType('');
      setPost(prev => prev ? { ...prev, replyCount: (prev.replyCount || 0) + 1 } : prev);
    } catch (err) {
      setCaricandoMedia(false);
      setErroreRisposta(err.message);
    } finally {
      setInvio(false);
    }
  };

  /* ── Inizia "rispondi a una risposta" ── */
  const iniziaRispostaA = useCallback((risposta) => {
    setRispostaA({
      id: risposta.id,
      author: risposta.author,
      displayName: risposta.authorDisplay || risposta.author,
    });
    // Scroll al form e focus
    setTimeout(() => {
      if (formRispostaRef.current) {
        formRispostaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      if (textareaRispostaRef.current) {
        textareaRispostaRef.current.focus();
      }
    }, 50);
  }, []);

  /* ── Scroll a una risposta esistente (quando si clicca sul quote-pill) ── */
  const vaiARisposta = useCallback((id) => {
    const el = document.getElementById(`risposta-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('social-risposta--evidenziata');
      setTimeout(() => el.classList.remove('social-risposta--evidenziata'), 1600);
    }
  }, []);

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
      <motion.article className="glass-panel social-post-principale" {...entrata(0.1)} style={{ '--cat-color': cat.colore }}>
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
              <BottoneAggiungiAmico
                targetUser={post.author}
                twitchToken={twitchToken}
                currentUser={twitchUser}
              />
              <span className="chip social-chip-categoria" style={{
                background: `${cat.colore}18`, color: cat.colore,
                border: `1px solid ${cat.colore}30`,
              }}>
                {cat.etichetta}
              </span>
              {post.visibility === 'friends' && (
                <span className="chip social-chip-amici">👥 Solo amici</span>
              )}
            </div>

            <h1 className="social-titolo-thread">{post.title}</h1>

            <span className="social-tempo" style={{ fontSize: '0.72rem' }}>
              <Clock size={11} /> {formattaData(post.createdAt)}
            </span>
          </div>
        </div>

        {/* Corpo del post */}
        <div className="social-corpo-thread">{renderConMenzioni(post.body)}</div>

        {/* Media content: upload reale (mediaId) o URL legacy */}
        {post.mediaId ? (
          <div style={{ margin: '1rem 0' }}>
            <MediaDisplay mediaId={post.mediaId} mediaType={post.mediaType} />
          </div>
        ) : (
          <>
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
          </>
        )}

        {/* Azioni */}
        <div className="social-azioni-thread">
          <button
            className={`social-btn-azione${post.liked ? ' social-btn-azione--liked' : ''}`}
            onClick={gestisciMiPiace}
            disabled={!isLoggedIn}
            title={isLoggedIn ? (post.liked ? 'Togli mi piace' : 'Metti mi piace') : 'Accedi per mettere mi piace'}
          >
            <Heart size={15} fill={post.liked ? 'currentColor' : 'none'} />
            <span>{post.likeCount || 0}</span>
          </button>
          <span className="social-btn-azione" style={{ pointerEvents: 'none' }}>
            <MessageSquare size={15} />
            <span>{risposte.length}</span>
          </span>
          <button
            type="button"
            className="social-btn-azione"
            onClick={() => {
              const url = `${window.location.origin}/socialify/${post.id}`;
              if (navigator.share) {
                navigator.share({ title: post.title, url }).catch(() => {});
              } else {
                navigator.clipboard?.writeText(url);
              }
            }}
            title="Condividi link"
          >
            <Share2 size={14} /> <span>Condividi</span>
          </button>
          {isLoggedIn && post.author === twitchUser && (
            <button
              className="social-btn-azione social-btn-azione--danger"
              onClick={eliminaPost}
              style={{ marginLeft: 'auto' }}
              title="Elimina post"
            >
              <Trash2 size={14} /> Elimina
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
                onRispondi={isLoggedIn ? iniziaRispostaA : null}
                onVaiA={vaiARisposta}
                onMiPiace={gestisciMiPiaceRisposta}
                isLoggedIn={isLoggedIn}
                twitchToken={twitchToken}
                currentUser={twitchUser}
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
      <motion.div {...entrata(0.24)} ref={formRispostaRef}>
        {isLoggedIn ? (
          <form onSubmit={inviaRisposta} className="glass-panel social-form-risposta" style={{ position: 'relative' }}>
            {/* Contesto: stai rispondendo a una risposta specifica */}
            {rispostaA && (
              <div className="social-form-contesto">
                <CornerDownRight size={13} />
                <span>
                  Stai rispondendo a <strong>@{rispostaA.displayName}</strong>
                </span>
                <button
                  type="button"
                  className="social-form-contesto-chiudi"
                  onClick={() => setRispostaA(null)}
                  title="Annulla risposta annidata"
                  aria-label="Annulla risposta annidata"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            <div className="social-form-risposta-riga">
              <textarea
                ref={textareaRispostaRef}
                value={testoRisposta}
                onChange={(e) => { setTestoRisposta(e.target.value); menzione.onChange(e); }}
                onKeyDown={menzione.onKeyDown}
                placeholder={rispostaA ? `Rispondi a @${rispostaA.displayName}…` : 'Scrivi una risposta… (usa @ per menzionare)'}
                maxLength={1000}
                rows={2}
                className="social-campo social-area-testo"
                style={{ flex: 1, marginBottom: 0, resize: 'vertical', minHeight: '60px' }}
                required
              />
              {/* Pulsante allegato */}
              <button
                type="button"
                className="social-btn-azione"
                onClick={() => fileInputRispostaRef.current?.click()}
                title="Allega immagine, audio o video"
                style={{ padding: '8px', flexShrink: 0 }}
              >
                <Paperclip size={16} />
              </button>
              <input
                ref={fileInputRispostaRef}
                type="file"
                accept={MEDIA_ACCETTATI}
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (mediaPreviewRef.current) URL.revokeObjectURL(mediaPreviewRef.current);
                  const newUrl = URL.createObjectURL(file);
                  mediaPreviewRef.current = newUrl;
                  setMediaFile(file);
                  setMediaPreview(newUrl);
                  setMediaType(
                    file.type.startsWith('image/') ? 'image' :
                    file.type.startsWith('audio/') ? 'audio' : 'video'
                  );
                  e.target.value = '';
                }}
              />
              <button
                type="submit"
                className="btn btn-primary social-btn-invia"
                disabled={invio || caricandoMedia || !testoRisposta.trim()}
              >
                {caricandoMedia ? '⏳' : invio ? '…' : <Send size={15} />}
              </button>
            </div>

            {/* Anteprima media selezionato */}
            {mediaFile && mediaPreview && (
              <div style={{ marginTop: '0.5rem', position: 'relative', display: 'inline-flex', alignItems: 'flex-start' }}>
                {mediaType === 'image' && (
                  <img src={mediaPreview} alt="" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, display: 'block' }} />
                )}
                {mediaType === 'audio' && (
                  <div className="social-media-audio-wrapper">
                    <Volume2 size={14} color="var(--primary)" />
                    <audio src={mediaPreview} controls preload="metadata" className="social-media-audio" />
                  </div>
                )}
                {mediaType === 'video' && (
                  <video src={mediaPreview} controls preload="metadata" style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8 }} />
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (mediaPreviewRef.current) URL.revokeObjectURL(mediaPreviewRef.current);
                    mediaPreviewRef.current = null;
                    setMediaFile(null); setMediaPreview(null); setMediaType('');
                  }}
                  style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 20, height: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Rimuovi media"
                >
                  <X size={11} color="#fff" />
                </button>
              </div>
            )}

            {erroreRisposta && (
              <p className="social-errore" style={{ marginTop: '6px' }}>{erroreRisposta}</p>
            )}
            <DropdownMenzione {...menzione.dropdownProps} />
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
