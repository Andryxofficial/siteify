import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Heart, Clock, Send, X, ChevronLeft, ChevronRight,
  Twitch, LogIn, Plus, User, Bell, BellOff,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useNotifiche } from '../hooks/useNotifiche';
import SEO from '../components/SEO';

const CATEGORIE = [
  { valore: 'generale',      etichetta: '💬 Generale',     colore: 'var(--text-muted)' },
  { valore: 'giochi',        etichetta: '🎮 Giochi',       colore: 'var(--accent-twitch)' },
  { valore: 'stream',        etichetta: '📺 Dirette',      colore: '#9146FF' },
  { valore: 'tech',          etichetta: '🤖 Tech & IA',    colore: 'var(--secondary)' },
  { valore: 'meme',          etichetta: '😂 Meme',         colore: 'var(--accent-warm)' },
  { valore: 'suggerimenti',  etichetta: '💡 Suggerimenti', colore: 'var(--primary)' },
];

function infoCategoria(valore) {
  return CATEGORIE.find(c => c.valore === valore) || CATEGORIE[0];
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

const entrata = (ritardo = 0) => ({
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay: ritardo, type: 'spring', stiffness: 220, damping: 24 },
});

/* ═══════════════════════════════════════
   SCHEDA POST
   ═══════════════════════════════════════ */
function SchedaPost({ post, onMiPiace }) {
  const cat = infoCategoria(post.tag);
  return (
    <motion.div layout {...entrata(0)}>
      <Link
        to={`/socialify/${post.id}`}
        className="glass-card social-scheda-post"
      >
        <div className="social-scheda-riga">
          {/* Immagine profilo */}
          <div className="social-avatar">
            {post.authorAvatar ? (
              <img src={post.authorAvatar} alt="" />
            ) : (
              <User size={20} />
            )}
          </div>

          <div className="social-scheda-corpo">
            {/* Intestazione */}
            <div className="social-scheda-intestazione">
              <span className="social-autore">
                {post.authorDisplay || post.author}
              </span>
              <span className="social-tempo">
                <Clock size={11} /> {tempoFa(post.createdAt)}
              </span>
              <span className="chip social-chip-categoria" style={{
                background: `${cat.colore}18`, color: cat.colore,
                border: `1px solid ${cat.colore}30`,
              }}>
                {cat.etichetta}
              </span>
            </div>

            {/* Titolo */}
            <h3 className="social-titolo-post">{post.title}</h3>

            {/* Anteprima testo */}
            <p className="social-anteprima-testo">{post.body}</p>

            {/* Azioni */}
            <div className="social-azioni-riga">
              <button
                className="social-btn-azione"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMiPiace(post); }}
              >
                <Heart size={14} fill={post.liked ? 'var(--accent)' : 'none'} color={post.liked ? 'var(--accent)' : 'var(--text-faint)'} />
                <span>{post.likeCount || 0}</span>
              </button>
              <span className="social-btn-azione" style={{ pointerEvents: 'none' }}>
                <MessageSquare size={14} color="var(--text-faint)" />
                <span>{post.replyCount || 0}</span>
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   EDITOR POST (modale)
   ═══════════════════════════════════════ */
function EditorPost({ onChiudi, onCreato }) {
  const { twitchToken } = useTwitchAuth();
  const [titolo, setTitolo] = useState('');
  const [testo, setTesto] = useState('');
  const [categoria, setCategoria] = useState('generale');
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');

  const invia = async (e) => {
    e.preventDefault();
    if (!titolo.trim() || !testo.trim()) return;
    setInvio(true);
    setErrore('');
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ title: titolo.trim(), body: testo.trim(), tag: categoria }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      onCreato(data.post);
      onChiudi();
    } catch (err) {
      setErrore(err.message);
    } finally {
      setInvio(false);
    }
  };

  return (
    <motion.div
      className="social-editor-sfondo"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onChiudi}
    >
      <motion.form
        className="glass-panel social-editor"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={invia}
      >
        <div className="social-editor-testata">
          <h3 className="social-editor-titolo">✏️ Nuovo Post</h3>
          <button type="button" onClick={onChiudi} className="social-btn-azione" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Selettore categoria */}
        <div className="social-categorie-griglia">
          {CATEGORIE.map(c => (
            <button
              key={c.valore}
              type="button"
              className="chip"
              onClick={() => setCategoria(c.valore)}
              style={{
                fontSize: '0.7rem', padding: '3px 10px', cursor: 'pointer',
                background: categoria === c.valore ? `${c.colore}25` : 'var(--surface-1)',
                color: categoria === c.valore ? c.colore : 'var(--text-muted)',
                border: `1px solid ${categoria === c.valore ? `${c.colore}40` : 'var(--glass-border)'}`,
                transition: 'all .2s ease',
              }}
            >
              {c.etichetta}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Titolo del post…"
          value={titolo}
          onChange={(e) => setTitolo(e.target.value)}
          maxLength={120}
          className="social-campo"
          required
        />

        <textarea
          placeholder="Scrivi il tuo messaggio…"
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          maxLength={2000}
          rows={5}
          className="social-campo social-area-testo"
          required
        />

        <div className="social-editor-piede">
          <span className="social-contatore">{testo.length}/2000</span>
          {errore && <span className="social-errore">{errore}</span>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={invio || !titolo.trim() || !testo.trim()}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1.3rem' }}
          >
            {invio ? 'Invio…' : <><Send size={14} /> Pubblica</>}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   PAGINA SOCIALify
   ═══════════════════════════════════════ */
export default function CommunityPage() {
  const { isLoggedIn, twitchUser, twitchToken, clientId, getTwitchLoginUrl } = useTwitchAuth();
  const { supportato: notificheSupportate, attivo: notificheAttive, attiva: attivaNotifiche, disattiva: disattivaNotifiche } = useNotifiche();
  const [searchParams, setSearchParams] = useSearchParams();

  const [posts, setPosts] = useState([]);
  const [pagina, setPagina] = useState(parseInt(searchParams.get('pagina')) || 1);
  const [totPagine, setTotPagine] = useState(1);
  const [categoriaAttiva, setCategoriaAttiva] = useState(searchParams.get('categoria') || null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [mostraEditor, setMostraEditor] = useState(false);

  const caricaPosts = useCallback(async () => {
    setCaricamento(true);
    setErrore('');
    try {
      const params = new URLSearchParams();
      params.set('page', pagina);
      params.set('limit', '20');
      if (categoriaAttiva) params.set('tag', categoriaAttiva);

      const headers = {};
      if (twitchToken) headers.Authorization = `Bearer ${twitchToken}`;

      const res = await fetch(`/api/community?${params}`, { headers });
      if (!res.ok) throw new Error('Errore di rete');
      const data = await res.json();
      setPosts(data.posts || []);
      setTotPagine(data.pages || 1);
    } catch (e) {
      console.error('Caricamento post fallito:', e);
      setErrore('Impossibile caricare i post.');
    } finally {
      setCaricamento(false);
    }
  }, [pagina, categoriaAttiva, twitchToken]);

  useEffect(() => { caricaPosts(); }, [caricaPosts]);

  // Sincronizza parametri URL
  useEffect(() => {
    const p = new URLSearchParams();
    if (pagina > 1) p.set('pagina', pagina);
    if (categoriaAttiva) p.set('categoria', categoriaAttiva);
    setSearchParams(p, { replace: true });
  }, [pagina, categoriaAttiva, setSearchParams]);

  const gestisciCategoria = (valore) => {
    setCategoriaAttiva(prev => prev === valore ? null : valore);
    setPagina(1);
  };

  const gestisciMiPiace = async (post) => {
    if (!isLoggedIn) return;
    const azione = post.liked ? 'unlike' : 'like';
    // Aggiornamento ottimistico
    setPosts(prev => prev.map(p =>
      p.id === post.id ? {
        ...p,
        liked: !p.liked,
        likeCount: p.liked ? Math.max(0, p.likeCount - 1) : p.likeCount + 1,
      } : p
    ));
    try {
      await fetch('/api/community', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ postId: post.id, action: azione }),
      });
    } catch {
      // Ripristina in caso di errore
      setPosts(prev => prev.map(p =>
        p.id === post.id ? { ...p, liked: post.liked, likeCount: post.likeCount } : p
      ));
    }
  };

  const gestisciNuovoPost = (nuovoPost) => {
    setPosts(prev => [nuovoPost, ...prev]);
  };

  return (
    <div className="main-content">
      <SEO
        title="SOCIALify"
        description="SOCIALify — Il punto di ritrovo della community di ANDRYXify. Crea discussioni, condividi idee e connettiti. Accedi con Twitch!"
        path="/socialify"
      />

      {/* Intestazione */}
      <section className="header" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
        <motion.h1 className="title" {...entrata(0.05)}>
          <span className="text-gradient">SOCIAL</span>ify
        </motion.h1>
        <motion.p className="subtitle" {...entrata(0.12)}>
          Il punto di ritrovo della community di <strong>ANDRYXify</strong>.
          <br />Discuti, condividi e connettiti.
        </motion.p>
      </section>

      {/* Barra autenticazione + Nuovo post + Notifiche */}
      <motion.div className="glass-panel social-barra-auth" {...entrata(0.18)}>
        <div className="social-barra-contenuto">
          {isLoggedIn ? (
            <>
              <div className="social-utente-info">
                <Twitch size={16} color="#9146FF" />
                <span className="social-nome-utente">{twitchUser}</span>
              </div>
              <div className="social-barra-azioni">
                {notificheSupportate && (
                  <button
                    className="btn btn-ghost social-btn-notifica"
                    onClick={notificheAttive ? disattivaNotifiche : attivaNotifiche}
                    title={notificheAttive ? 'Disattiva notifiche' : 'Attiva notifiche'}
                  >
                    {notificheAttive ? <BellOff size={15} /> : <Bell size={15} />}
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => setMostraEditor(true)}
                  style={{ fontSize: '0.82rem', padding: '0.45rem 1.1rem' }}
                >
                  <Plus size={15} /> Nuovo Post
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="social-testo-accesso">
                Accedi con Twitch per pubblicare e mettere «mi piace»
              </span>
              {clientId && (
                <a href={getTwitchLoginUrl('/socialify')} className="btn social-btn-twitch">
                  <LogIn size={14} /> Accedi con Twitch
                </a>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Filtri categoria */}
      <motion.div {...entrata(0.22)} className="social-filtri-categorie">
        <button
          className="chip"
          onClick={() => gestisciCategoria(null)}
          style={{
            cursor: 'pointer', fontSize: '0.74rem', padding: '4px 12px',
            background: !categoriaAttiva ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: !categoriaAttiva ? 'var(--text-main)' : 'var(--text-muted)',
            border: `1px solid ${!categoriaAttiva ? 'rgba(255,255,255,0.14)' : 'var(--glass-border)'}`,
          }}
        >
          Tutti
        </button>
        {CATEGORIE.map(c => (
          <button
            key={c.valore}
            className="chip"
            onClick={() => gestisciCategoria(c.valore)}
            style={{
              cursor: 'pointer', fontSize: '0.74rem', padding: '4px 12px',
              background: categoriaAttiva === c.valore ? `${c.colore}20` : 'transparent',
              color: categoriaAttiva === c.valore ? c.colore : 'var(--text-muted)',
              border: `1px solid ${categoriaAttiva === c.valore ? `${c.colore}35` : 'var(--glass-border)'}`,
              transition: 'all .2s ease',
            }}
          >
            {c.etichetta}
          </button>
        ))}
      </motion.div>

      {/* Lista post */}
      <motion.div {...entrata(0.28)} className="social-lista-post">
        {caricamento && posts.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton social-skeleton" />
          ))
        ) : errore ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--accent)' }}>{errore}</p>
            <button className="btn btn-ghost" onClick={caricaPosts} style={{ marginTop: '0.75rem' }}>
              Riprova
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-panel social-vuoto">
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🫥</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {categoriaAttiva ? `Nessun post nella categoria "${infoCategoria(categoriaAttiva).etichetta}".` : 'Ancora nessun post. Sii il primo!'}
            </p>
            {isLoggedIn && (
              <button
                className="btn btn-primary"
                onClick={() => setMostraEditor(true)}
                style={{ marginTop: '1rem', fontSize: '0.85rem' }}
              >
                <Plus size={15} /> Scrivi il primo!
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {posts.map(post => (
              <SchedaPost key={post.id} post={post} onMiPiace={gestisciMiPiace} />
            ))}
          </AnimatePresence>
        )}
      </motion.div>

      {/* Paginazione */}
      {totPagine > 1 && (
        <motion.div {...entrata(0.32)} className="social-paginazione">
          <button
            className="btn btn-ghost"
            disabled={pagina <= 1}
            onClick={() => setPagina(p => Math.max(1, p - 1))}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {pagina} / {totPagine}
          </span>
          <button
            className="btn btn-ghost"
            disabled={pagina >= totPagine}
            onClick={() => setPagina(p => Math.min(totPagine, p + 1))}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
          >
            <ChevronRight size={16} />
          </button>
        </motion.div>
      )}

      {/* Modale editor post */}
      <AnimatePresence>
        {mostraEditor && isLoggedIn && (
          <EditorPost onChiudi={() => setMostraEditor(false)} onCreato={gestisciNuovoPost} />
        )}
      </AnimatePresence>
    </div>
  );
}
