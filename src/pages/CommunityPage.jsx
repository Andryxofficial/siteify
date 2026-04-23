import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Heart, Clock, Send, X, ChevronLeft, ChevronRight,
  Twitch, LogIn, Plus, User, Bell, BellOff, Trophy, Film, Music,
  Users, Lock, Shield, Star, Paperclip, Image, Volume2,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useNotifiche } from '../hooks/useNotifiche';
import useIsMod from '../hooks/useIsMod';
import { useEmoteTwitch } from '../hooks/useEmoteTwitch';
import EmotePicker from '../components/EmotePicker';
import BottoneAggiungiAmico from '../components/BottoneAggiungiAmico';
import SEO from '../components/SEO';
import { useLingua } from '../contexts/LinguaContext';
import { comprimeFileMedia, arrayBufferABase64 } from '../utils/comprimi';

function getCATEGORIE(t) {
  return [
    { valore: 'generale',     etichetta: t('community.cat.generale'),     colore: 'var(--text-muted)' },
    { valore: 'giochi',       etichetta: t('community.cat.giochi'),       colore: 'var(--accent-twitch)' },
    { valore: 'stream',       etichetta: t('community.cat.stream'),       colore: '#9146FF' },
    { valore: 'tech',         etichetta: t('community.cat.tech'),         colore: 'var(--secondary)' },
    { valore: 'meme',         etichetta: t('community.cat.meme'),         colore: 'var(--accent-warm)' },
    { valore: 'suggerimenti', etichetta: t('community.cat.suggerimenti'), colore: 'var(--primary)' },
  ];
}

function infoCategoria(valore, categorie) {
  return categorie.find(c => c.valore === valore) || categorie[0];
}

function tempoFa(ts, lingua = 'it') {
  const diff = Date.now() - Number(ts);
  const min = Math.floor(diff / 60000);
  if (lingua === 'en') {
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    const ore = Math.floor(min / 60);
    if (ore < 24) return `${ore}h ago`;
    const giorni = Math.floor(ore / 24);
    if (giorni < 30) return `${giorni}d ago`;
    return `${Math.floor(giorni / 30)} months ago`;
  }
  if (lingua === 'es') {
    if (min < 1) return 'ahora';
    if (min < 60) return `hace ${min} min`;
    const ore = Math.floor(min / 60);
    if (ore < 24) return `hace ${ore}h`;
    const giorni = Math.floor(ore / 24);
    if (giorni < 30) return `hace ${giorni}d`;
    return `hace ${Math.floor(giorni / 30)} meses`;
  }
  // it (default)
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
function SchedaPost({ post, onMiPiace, twitchToken, currentUser }) {
  const { renderTestoConEmote } = useEmoteTwitch(twitchToken);
  const { t, lingua } = useLingua();
  const CATEGORIE = useMemo(() => getCATEGORIE(t), [t]);
  const cat = infoCategoria(post.tag, CATEGORIE);
  const [favorito, setFavorito] = useState(false);

  // Controlla se il post è nei preferiti
  useEffect(() => {
    if (!twitchToken || !post.id) return;
    (async () => {
      try {
        const res = await fetch(`/api/community?action=is_favorite&postId=${post.id}`, {
          headers: { Authorization: `Bearer ${twitchToken}` },
        });
        if (res.ok) {
          const data = await res.json();
          setFavorito(!!data.favorited);
        }
      } catch { /* silenzioso */ }
    })();
  }, [twitchToken, post.id]);

  const toggleFavorito = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!twitchToken) return;
    const nuovoStato = !favorito;
    setFavorito(nuovoStato);
    try {
      await fetch('/api/community', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ postId: post.id, action: nuovoStato ? 'favorite' : 'unfavorite' }),
      });
    } catch { setFavorito(!nuovoStato); }
  };

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
              <BottoneAggiungiAmico
                targetUser={post.author}
                twitchToken={twitchToken}
                currentUser={currentUser}
              />
              <span className="social-tempo">
                <Clock size={11} /> {tempoFa(post.createdAt, lingua)}
              </span>
              <span className="chip social-chip-categoria" style={{
                background: `${cat.colore}18`, color: cat.colore,
                border: `1px solid ${cat.colore}30`,
              }}>
                {cat.etichetta}
              </span>
            </div>

            {/* Titolo */}
            <h3 className="social-titolo-post">{renderTestoConEmote(post.title)}</h3>

            {/* Anteprima testo */}
            <p className="social-anteprima-testo">{renderTestoConEmote(post.body)}</p>

            {/* Media preview — supporta sia mediaId (reale) che mediaUrl (legacy) */}
            {post.mediaId && post.mediaMimeType?.startsWith('image/') && (
              <div className="social-media-preview" onClick={e => e.preventDefault()}>
                <img src={`/api/community-media?id=${post.mediaId}`} alt="Allegato" className="social-media-img" loading="lazy" />
              </div>
            )}
            {post.mediaId && post.mediaMimeType?.startsWith('video/') && (
              <div className="social-media-preview" onClick={e => e.preventDefault()}>
                <video src={`/api/community-media?id=${post.mediaId}`} controls preload="metadata" className="social-media-video">
                  Il tuo browser non supporta il tag video.
                </video>
              </div>
            )}
            {post.mediaId && post.mediaMimeType?.startsWith('audio/') && (
              <div className="social-media-preview" onClick={e => e.preventDefault()}>
                <div className="social-media-audio-wrapper">
                  <Volume2 size={16} color="var(--primary)" />
                  <audio src={`/api/community-media?id=${post.mediaId}`} controls preload="metadata" className="social-media-audio">
                    Il tuo browser non supporta il tag audio.
                  </audio>
                </div>
              </div>
            )}
            {/* Legacy: vecchi post con mediaUrl */}
            {!post.mediaId && post.mediaUrl && post.mediaType === 'video' && (
              <div className="social-media-preview" onClick={e => e.preventDefault()}>
                <video src={post.mediaUrl} controls preload="metadata" className="social-media-video">
                  Il tuo browser non supporta il tag video.
                </video>
              </div>
            )}
            {!post.mediaId && post.mediaUrl && post.mediaType === 'audio' && (
              <div className="social-media-preview" onClick={e => e.preventDefault()}>
                <div className="social-media-audio-wrapper">
                  <Music size={16} color="var(--primary)" />
                  <audio src={post.mediaUrl} controls preload="metadata" className="social-media-audio">
                    Il tuo browser non supporta il tag audio.
                  </audio>
                </div>
              </div>
            )}
            {!post.mediaId && post.mediaUrl && !post.mediaType && (
              <div className="social-media-preview" onClick={e => e.preventDefault()}>
                <a href={post.mediaUrl} target="_blank" rel="noopener noreferrer" className="social-media-link">
                  <Film size={14} /> Apri media
                </a>
              </div>
            )}

            {/* Azioni */}
            <div className="social-azioni-riga">
              <button
                className="social-btn-azione"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMiPiace(post); }}
              >
                <Heart size={14} fill={post.liked ? 'var(--accent)' : 'none'} color={post.liked ? 'var(--accent)' : 'var(--text-faint)'} />
                <span>{post.likeCount || 0}</span>
              </button>
              <button
                className="social-btn-azione"
                onClick={toggleFavorito}
                title={favorito ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
              >
                <Star size={14} fill={favorito ? '#facc15' : 'none'} color={favorito ? '#facc15' : 'var(--text-faint)'} />
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
  const { t } = useLingua();
  const { emoteCanale, emoteGlobali, seventvCanale, seventvGlobali } = useEmoteTwitch(twitchToken);
  const CATEGORIE = useMemo(() => getCATEGORIE(t), [t]);

  // Ripristina bozza da localStorage
  const bozzaSalvata = (() => {
    try {
      const b = localStorage.getItem('andryxify_bozza_post');
      return b ? JSON.parse(b) : null;
    } catch { return null; }
  })();

  const [titolo, setTitolo] = useState(bozzaSalvata?.titolo || '');
  const [testo, setTesto] = useState(bozzaSalvata?.testo || '');
  const [categoria, setCategoria] = useState(bozzaSalvata?.categoria || 'generale');
  /* Media allegato — file reale (non URL) */
  const [mediaFile, setMediaFile] = useState(null);      // File | null
  const [mediaPreview, setMediaPreview] = useState(null); // object URL per anteprima
  const [mediaCaricamento, setMediaCaricamento] = useState(false);
  const [mediaErrore, setMediaErrore] = useState('');
  const fileInputRef = useRef(null);
  const [invio, setInvio] = useState(false);
  const [errore, setErrore] = useState('');
  const [mostraAnteprima, setMostraAnteprima] = useState(false);

  // Auto-salva bozza (senza file — i file non si serializzano)
  useEffect(() => {
    const bozza = { titolo, testo, categoria };
    localStorage.setItem('andryxify_bozza_post', JSON.stringify(bozza));
  }, [titolo, testo, categoria]);

  // Revoca object URL al cambio file
  useEffect(() => {
    return () => { if (mediaPreview) URL.revokeObjectURL(mediaPreview); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaPreview]);

  const onFileSelezionato = useCallback(async (file) => {
    if (!file) return;
    setMediaErrore('');
    setMediaCaricamento(true);
    try {
      const compresso = await comprimeFileMedia(file);
      setMediaFile(compresso);
      setMediaPreview(URL.createObjectURL(compresso));
    } catch (err) {
      setMediaErrore(err.message || t('community.editor.allega_errore'));
    } finally {
      setMediaCaricamento(false);
    }
  }, [t]);

  const rimuoviMedia = useCallback(() => {
    setMediaFile(null);
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaPreview(null);
    setMediaErrore('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [mediaPreview]);

  // Colore contatore caratteri
  const contatoreColore = testo.length > 1950 ? 'var(--accent)' : testo.length > 1800 ? '#ffb300' : 'var(--text-faint)';

  // Rendering markdown semplice per anteprima
  const renderMarkdown = (t) => {
    return t
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(255,255,255,0.08);padding:1px 4px;border-radius:3px;font-size:0.85em">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:var(--primary)">$1</a>')
      .replace(/\n/g, '<br/>');
  };

  const invia = async (e) => {
    e.preventDefault();
    if (!titolo.trim() || !testo.trim()) return;
    setInvio(true);
    setErrore('');
    try {
      const payload = { title: titolo.trim(), body: testo.trim(), tag: categoria };

      /* Se c'è un file allegato, caricalo su /api/community-media prima */
      if (mediaFile) {
        const arrayBuffer = await mediaFile.arrayBuffer();
        const base64 = arrayBufferABase64(arrayBuffer);
        const uploadRes = await fetch('/api/community-media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
          body: JSON.stringify({ contentType: mediaFile.type, dataBase64: base64 }),
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || t('community.editor.allega_errore'));
        payload.mediaId       = uploadData.id;
        payload.mediaMimeType = mediaFile.type;
      }

      const res = await fetch('/api/community', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      // Pulisci bozza dopo invio riuscito
      localStorage.removeItem('andryxify_bozza_post');
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
          <h3 className="social-editor-titolo">{t('community.editor.titolo')}</h3>
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

        <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
          <input
            type="text"
            placeholder={t('community.editor.titolo_ph')}
            value={titolo}
            onChange={(e) => setTitolo(e.target.value)}
            maxLength={120}
            className="social-campo"
            style={{ flex: 1 }}
            required
          />
          <EmotePicker
            emoteCanale={emoteCanale}
            emoteGlobali={emoteGlobali}
            seventvCanale={seventvCanale}
            seventvGlobali={seventvGlobali}
            onSelect={(nome) => setTitolo(prev => (prev ? `${prev} ${nome}` : nome))}
          />
        </div>

        <div style={{ position: 'relative' }}>
          <textarea
            placeholder={t('community.editor.testo_ph')}
            value={testo}
            onChange={(e) => setTesto(e.target.value)}
            maxLength={2000}
            rows={5}
            className="social-campo social-area-testo"
            required
          />
          <div style={{ position: 'absolute', right: '0.5rem', bottom: '0.5rem' }}>
            <EmotePicker
              emoteCanale={emoteCanale}
              emoteGlobali={emoteGlobali}
              seventvCanale={seventvCanale}
              seventvGlobali={seventvGlobali}
              onSelect={(nome) => setTesto(prev => (prev ? `${prev} ${nome}` : nome))}
            />
          </div>
        </div>

        {/* Contatore caratteri + toggle anteprima */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem', marginBottom: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', color: contatoreColore, fontWeight: testo.length > 1800 ? 600 : 400 }}>
            {testo.length}/2000 caratteri
          </span>
          <button
            type="button"
            className="chip"
            onClick={() => setMostraAnteprima(!mostraAnteprima)}
            style={{ fontSize: '0.7rem', padding: '2px 8px', cursor: 'pointer', background: mostraAnteprima ? 'rgba(var(--primary-rgb, 99,102,241), 0.15)' : 'transparent', color: mostraAnteprima ? 'var(--primary)' : 'var(--text-faint)', border: `1px solid ${mostraAnteprima ? 'var(--primary)' : 'var(--glass-border)'}` }}
          >
            {mostraAnteprima ? t('community.editor.editor') : t('community.editor.anteprima')}
          </button>
        </div>

        {/* Anteprima markdown */}
        {mostraAnteprima && testo.trim() && (
          <div
            className="glass-card"
            style={{ padding: '0.8rem', fontSize: '0.85rem', lineHeight: 1.6, marginBottom: '0.4rem' }}
            dangerouslySetInnerHTML={{ __html: renderMarkdown(testo) }}
          />
        )}

        {/* Media allegato — file picker reale */}
        <div className="social-media-sezione">
          {/* Input file nascosto */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            style={{ display: 'none' }}
            onChange={(e) => onFileSelezionato(e.target.files?.[0] || null)}
          />

          {!mediaFile && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ fontSize: '0.78rem', padding: '0.4rem 0.9rem', width: '100%', justifyContent: 'center', gap: '0.4rem' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={mediaCaricamento}
            >
              <Paperclip size={14} />
              {mediaCaricamento ? t('community.editor.allega_caricamento') : t('community.editor.allega')}
            </button>
          )}

          {mediaCaricamento && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '0.4rem' }}>
              ⏳ {t('community.editor.allega_caricamento')}
            </div>
          )}

          {mediaErrore && (
            <p style={{ fontSize: '0.73rem', color: '#f87171', marginTop: '0.3rem' }}>{mediaErrore}</p>
          )}

          {/* Anteprima allegato */}
          {mediaPreview && mediaFile && (
            <div className="social-media-preview" style={{ position: 'relative', marginTop: '0.5rem' }}>
              {mediaFile.type.startsWith('image/') && (
                <img src={mediaPreview} alt="Anteprima" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: '0.5rem', objectFit: 'contain', background: 'rgba(0,0,0,0.2)' }} />
              )}
              {mediaFile.type.startsWith('video/') && (
                <video src={mediaPreview} controls preload="metadata" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: '0.5rem' }} />
              )}
              {mediaFile.type.startsWith('audio/') && (
                <audio src={mediaPreview} controls preload="metadata" style={{ width: '100%' }} />
              )}
              <button
                type="button"
                onClick={rimuoviMedia}
                title="Rimuovi allegato"
                style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%',
                  width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: '#fff',
                }}
              >
                <X size={12} />
              </button>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.25rem' }}>
                <Paperclip size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                {mediaFile.name} · {(mediaFile.size / 1024).toFixed(0)} KB
              </p>
            </div>
          )}
        </div>

        <div className="social-editor-piede">
          {errore && <span className="social-errore">{errore}</span>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={invio || !titolo.trim() || !testo.trim()}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1.3rem' }}
          >
            {invio ? t('community.editor.invio') : <><Send size={14} /> {t('community.editor.pubblica')}</>}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   CLASSIFICA XP
   ═══════════════════════════════════════ */

function getLEVELS(t) {
  return [
    { level: 1, xp: 0,    label: t('community.lv.1'), emoji: '🌱' },
    { level: 2, xp: 50,   label: t('community.lv.2'), emoji: '🌿' },
    { level: 3, xp: 150,  label: t('community.lv.3'), emoji: '⭐' },
    { level: 4, xp: 350,  label: t('community.lv.4'), emoji: '💫' },
    { level: 5, xp: 700,  label: t('community.lv.5'), emoji: '🔥' },
    { level: 6, xp: 1200, label: t('community.lv.6'), emoji: '💎' },
    { level: 7, xp: 2000, label: t('community.lv.7'), emoji: '🏆' },
    { level: 8, xp: 3500, label: t('community.lv.8'), emoji: '👑' },
  ];
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];

function RigaClassifica({ entry, rank, showProgress = true }) {
  const medal = rank <= 3 ? RANK_MEDALS[rank - 1] : null;
  return (
    <div className={`social-lb-riga pos-${rank}`}>
      <div className={`social-lb-rank${medal ? ' medaglia' : ''}`}>
        {medal || rank}
      </div>

      <div className="social-lb-avatar">
        {entry.avatar ? (
          <img src={entry.avatar} alt="" />
        ) : (
          <User size={16} />
        )}
      </div>

      <div className="social-lb-info">
        <div className="social-lb-nome">{entry.username}</div>
        <div className="social-lb-livello-riga">
          <span className="social-lb-badge-livello">
            {entry.levelEmoji} Lv.{entry.level} {entry.levelLabel}
          </span>
        </div>
      </div>

      {showProgress && (
        <div className="social-lb-barra-xp">
          <span className="social-lb-xp-numero">{entry.xp} XP</span>
          <div className="social-lb-progress-track">
            <div
              className="social-lb-progress-fill"
              style={{ width: `${entry.progress ?? 100}%` }}
            />
          </div>
        </div>
      )}
      {!showProgress && (
        <span className="social-lb-xp-numero" style={{ flexShrink: 0 }}>{entry.xp} XP</span>
      )}
    </div>
  );
}

function Classifica() {
  const { t } = useLingua();
  const LEVELS = useMemo(() => getLEVELS(t), [t]);
  const [lbTab, setLbTab] = useState('mensile');
  const [monthly, setMonthly] = useState([]);
  const [general, setGeneral] = useState([]);
  const [archive, setArchive] = useState([]);
  const [currentLabel, setCurrentLabel] = useState('');
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');

  const caricaClassifica = useCallback(async () => {
    setCaricamento(true);
    setErrore('');
    try {
      const res = await fetch('/api/social-leaderboard');
      if (!res.ok) throw new Error('Errore di rete');
      const data = await res.json();
      setMonthly(data.monthly || []);
      setGeneral(data.general || []);
      setArchive(data.archive || []);
      setCurrentLabel(data.currentLabel || '');
    } catch {
      setErrore(t('community.errore.classifica'));
    } finally {
      setCaricamento(false);
    }
  }, [t]);

  useEffect(() => { caricaClassifica(); }, [caricaClassifica]);

  const elenco = lbTab === 'mensile' ? monthly : general;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
    >
      {/* Sub-tabs */}
      <div className="social-lb-tabs">
        {[
          { id: 'mensile',  label: '📅 ' + (currentLabel || t('game.lb.mensile')) },
          { id: 'generale', label: t('community.lb.tab.generale') },
          { id: 'archivio', label: t('community.lb.tab.archivio') },
          { id: 'livelli',  label: t('community.lb.tab.livelli') },
        ].map(tab => (
          <button
            key={tab.id}
            className={`social-lb-tab${lbTab === tab.id ? ' attiva' : ''}`}
            onClick={() => setLbTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {caricamento ? (
        <div className="social-lb-vuoto">{t('community.caricamento')}</div>
      ) : errore ? (
        <div className="social-lb-vuoto" style={{ color: 'var(--accent)' }}>
          {errore}
          <br />
          <button className="btn btn-ghost" onClick={caricaClassifica} style={{ marginTop: '0.75rem', fontSize: '0.82rem' }}>
            {t('community.riprova')}
          </button>
        </div>
      ) : lbTab === 'archivio' ? (
        <div className="social-lb-archivio">
          {archive.length === 0 ? (
            <div className="social-lb-vuoto">
              <p style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>📭</p>
              {t('community.archivio.vuoto')}
            </div>
          ) : archive.map(mese => (
            <div key={mese.season} className="social-lb-archivio-mese">
              <div className="social-lb-archivio-testata">{mese.label}</div>
              <div className="social-lb-archivio-podio">
                {mese.top3.map((e, i) => (
                  <div key={e.username} className="social-lb-archivio-voce">
                    <span className="social-lb-archivio-voce-rank">{RANK_MEDALS[i] || i + 1}</span>
                    <span className="social-lb-archivio-voce-nome">{e.levelEmoji} {e.username}</span>
                    <span className="social-lb-archivio-voce-xp">{e.xp} XP</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : lbTab === 'livelli' ? (
        <div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
            {t('community.livelli.descr')}
          </p>

          {/* XP Rewards */}
          <p className="social-lb-titolo-sezione" style={{ marginBottom: '0.4rem' }}>Come guadagnare XP</p>
          <div className="social-lb-legenda-xp" style={{ marginBottom: '0.75rem', marginTop: 0 }}>
            <div className="social-lb-legenda-item">✍️ Post: <strong>fino a +15 XP</strong></div>
            <div className="social-lb-legenda-item">💬 Risposta: <strong>fino a +7 XP</strong></div>
            <div className="social-lb-legenda-item">❤️ Like ricevuto: <strong>+2 XP</strong></div>
            <div className="social-lb-legenda-item">📩 Risposta al tuo post: <strong>+2 XP</strong></div>
            <div className="social-lb-legenda-item">👍 Like dato: <strong>+1 XP</strong></div>
          </div>

          {/* Content quality */}
          <p className="social-lb-titolo-sezione" style={{ marginBottom: '0.4rem' }}>Qualità del contenuto</p>
          <div className="social-lb-legenda-xp" style={{ marginBottom: '0.75rem', marginTop: 0 }}>
            <div className="social-lb-legenda-item" style={{ width: '100%', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                Post e risposte lunghi e curati guadagnano più XP. Messaggi corti o a caso danno pochissimo.
              </span>
              <span>🟥 {'<'}15 char → <strong>×0.3</strong> · 🟧 15–29 → <strong>×0.6</strong> · 🟩 30–79 → <strong>×1.0</strong> · 🟦 80–199 → <strong>×1.15</strong> · ⭐ 200+ → <strong>×1.3</strong></span>
              <span style={{ color: 'var(--text-faint)', fontSize: '0.68rem' }}>+0.2 bonus con 10+ parole diverse · ×0.5 se testo ripetitivo · ×0.6 se TUTTO MAIUSCOLO</span>
            </div>
          </div>

          {/* Profanity penalty */}
          <p className="social-lb-titolo-sezione" style={{ marginBottom: '0.4rem' }}>🤬 Linguaggio inappropriato</p>
          <div className="social-lb-legenda-xp" style={{ marginBottom: '0.75rem', marginTop: 0 }}>
            <div className="social-lb-legenda-item" style={{ width: '100%', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                Bestemmie e volgarità pesanti riducono l'XP guadagnato. Non blocchiamo il contenuto, ma penalizziamo.
              </span>
              <span>Bestemmie → <strong>−3 XP</strong> cad. · Volgarità → <strong>−1 XP</strong> cad. · Max penalty: <strong>−5 XP</strong></span>
            </div>
          </div>

          {/* Anti-spam */}
          <p className="social-lb-titolo-sezione" style={{ marginBottom: '0.4rem' }}>Anti-spam</p>
          <div className="social-lb-legenda-xp" style={{ marginBottom: '0.75rem', marginTop: 0 }}>
            <div className="social-lb-legenda-item" style={{ width: '100%', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                Ripetere le stesse azioni di continuo dà sempre meno XP. Lo spam non paga.
              </span>
              <span>1ª azione → <strong>100%</strong> · 2ª → <strong>75%</strong> · 3ª → <strong>50%</strong> · 4ª → <strong>25%</strong> · 5ª+ → <strong>10%</strong></span>
              <span style={{ color: 'var(--text-faint)', fontSize: '0.68rem' }}>Finestra: post 24h · risposte 1h · like 1h</span>
            </div>
          </div>

          {/* Engagement multiplier */}
          <p className="social-lb-titolo-sezione" style={{ marginBottom: '0.4rem' }}>Moltiplicatore engagement</p>
          <div className="social-lb-legenda-xp" style={{ marginBottom: '0.75rem', marginTop: 0 }}>
            <div className="social-lb-legenda-item" style={{ width: '100%', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                Più il tuo post è popolare (like + risposte), più XP ricevi per ogni nuovo like.
              </span>
              <span>0–4 interazioni → <strong>1×</strong> · 5–9 → <strong>1.25×</strong> · 10–19 → <strong>1.5×</strong> · 20+ → <strong>2×</strong></span>
            </div>
          </div>

          {/* Levels grid */}
          <p className="social-lb-titolo-sezione" style={{ marginBottom: '0.4rem' }}>Tabella livelli</p>
          <div className="social-lb-livelli-griglia">
            {LEVELS.map(l => (
              <div key={l.level} className="social-lb-livello-card">
                <span className="social-lb-livello-card-emoji">{l.emoji}</span>
                <div className="social-lb-livello-card-info">
                  <div className="social-lb-livello-card-nome">Lv.{l.level} {l.label}</div>
                  <div className="social-lb-livello-card-xp">{l.xp} XP</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {elenco.length === 0 ? (
            <div className="social-lb-vuoto">
              <p style={{ fontSize: '1.5rem', marginBottom: '0.4rem' }}>🏆</p>
              {lbTab === 'mensile'
                ? t('community.vuoto.mensile')
                : t('community.vuoto.generale')}
            </div>
          ) : (
            <>
              <p className="social-lb-titolo-sezione">
                {lbTab === 'mensile' ? `${t('community.top.mensile')} ${currentLabel}` : t('community.top.generale')}
              </p>
              <div className="social-lb-lista">
                {elenco.map((entry, i) => (
                  <RigaClassifica
                    key={entry.username}
                    entry={entry}
                    rank={i + 1}
                    showProgress={lbTab === 'mensile'}
                  />
                ))}
              </div>
              {lbTab === 'mensile' && (
                <div className="social-lb-legenda-xp">
                  <div className="social-lb-legenda-item">✍️ Post: <strong>fino a +15 XP</strong> (qualità conta!)</div>
                  <div className="social-lb-legenda-item">💬 Risposta: <strong>fino a +7 XP</strong></div>
                  <div className="social-lb-legenda-item">❤️ Like ricevuto: <strong>+2 XP</strong> (fino a ×2 se popolare)</div>
                  <div className="social-lb-legenda-item">📩 Risposta al tuo post: <strong>+2 XP</strong></div>
                  <div className="social-lb-legenda-item" style={{ color: 'var(--text-faint)', fontSize: '0.68rem', width: '100%' }}>
                    ⚠️ Spam, post corti e bestemmie riducono l'XP. Tab «⭐ Livelli» per i dettagli.
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   PAGINA SOCIALify
   ═══════════════════════════════════════ */
export default function CommunityPage() {
  const { isLoggedIn, twitchUser, twitchToken, clientId, getTwitchLoginUrl } = useTwitchAuth();
  const { supportato: notificheSupportate, attivo: notificheAttive, attiva: attivaNotifiche, disattiva: disattivaNotifiche } = useNotifiche();
  const isMod = useIsMod();
  const { t } = useLingua();
  const [searchParams, setSearchParams] = useSearchParams();
  const CATEGORIE = useMemo(() => getCATEGORIE(t), [t]);

  const [posts, setPosts] = useState([]);
  const [pagina, setPagina] = useState(parseInt(searchParams.get('pagina')) || 1);
  const [totPagine, setTotPagine] = useState(1);
  const [categoriaAttiva, setCategoriaAttiva] = useState(searchParams.get('categoria') || null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [mostraEditor, setMostraEditor] = useState(false);
  const [vistaAttiva, setVistaAttiva] = useState(searchParams.get('vista') === 'classifica' ? 'classifica' : 'feed');

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
      setErrore(t('community.errore.post'));
    } finally {
      setCaricamento(false);
    }
  }, [pagina, categoriaAttiva, twitchToken, t]);

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
        keywords="community gaming, forum streamer, socialify andryxify, discussioni twitch community"
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
                    title={notificheAttive ? t('community.notifiche.disattiva') : t('community.notifiche.attiva')}
                  >
                    {notificheAttive ? <BellOff size={15} /> : <Bell size={15} />}
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => setMostraEditor(true)}
                  style={{ fontSize: '0.82rem', padding: '0.45rem 1.1rem' }}
                >
                  <Plus size={15} /> {t('community.nuovo_post')}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="social-testo-accesso">
                {t('community.login.prompt')}
              </span>
              {clientId && (
                <a href={getTwitchLoginUrl('/socialify')} className="btn social-btn-twitch">
                  <LogIn size={14} /> {t('community.login.cta')}
                </a>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Quick links: Amici, Messaggi, Mod Panel (solo se loggati) */}
      {isLoggedIn && (
        <motion.div {...entrata(0.20)} className="social-quick-links">
          <Link to="/amici" className="social-quick-link glass-card">
            <Users size={18} />
            <span>{t('community.amici')}</span>
          </Link>
          <Link to="/messaggi" className="social-quick-link glass-card">
            <Lock size={18} />
            <span>{t('community.messaggi')}</span>
          </Link>
          {/* Mod Panel — visibile solo a chi è effettivamente moderatore del canale.
              Stile "premium" con bordo viola Twitch e iconcina scintilla. */}
          {isMod === true && (
            <Link to="/mod-panel" className="social-quick-link glass-card social-quick-link-mod">
              <Shield size={18} />
              <span>Mod Panel</span>
              <span className="mod-link-sparkle" aria-hidden="true">✦</span>
            </Link>
          )}
        </motion.div>
      )}

      {/* Tab principali: Feed | Classifica */}
      <motion.div {...entrata(0.22)} className="social-tabs-principali">
        <button
          className={`social-tab-principale${vistaAttiva === 'feed' ? ' attiva' : ''}`}
          onClick={() => setVistaAttiva('feed')}
        >
          <MessageSquare size={15} /> {t('community.feed')}
        </button>
        <button
          className={`social-tab-principale${vistaAttiva === 'classifica' ? ' attiva' : ''}`}
          onClick={() => setVistaAttiva('classifica')}
        >
          <Trophy size={15} /> {t('community.classifica')}
        </button>
      </motion.div>

      {vistaAttiva === 'classifica' ? (
        <motion.div {...entrata(0.26)} className="glass-panel" style={{ padding: '1rem' }}>
          <Classifica />
        </motion.div>
      ) : (
        <>
          {/* Filtri categoria */}
          <motion.div {...entrata(0.26)} className="social-filtri-categorie">
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
              {t('community.tutti')}
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
          <motion.div {...entrata(0.32)} className="social-lista-post">
            {caricamento && posts.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton social-skeleton" />
              ))
            ) : errore ? (
              <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
                <p style={{ color: 'var(--accent)' }}>{errore}</p>
                <button className="btn btn-ghost" onClick={caricaPosts} style={{ marginTop: '0.75rem' }}>
                  {t('community.riprova')}
                </button>
              </div>
            ) : posts.length === 0 ? (
              <div className="glass-panel social-vuoto">
                <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🫥</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  {categoriaAttiva ? `Nessun post nella categoria "${infoCategoria(categoriaAttiva, CATEGORIE).etichetta}".` : t('community.post.vuoto')}
                </p>
                {isLoggedIn && (
                  <button
                    className="btn btn-primary"
                    onClick={() => setMostraEditor(true)}
                    style={{ marginTop: '1rem', fontSize: '0.85rem' }}
                  >
                    <Plus size={15} /> {t('community.post.primo')}
                  </button>
                )}
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {posts.map(post => (
                  <SchedaPost key={post.id} post={post} onMiPiace={gestisciMiPiace} twitchToken={twitchToken} currentUser={twitchUser} />
                ))}
              </AnimatePresence>
            )}
          </motion.div>

          {/* Paginazione */}
          {totPagine > 1 && (
            <motion.div {...entrata(0.36)} className="social-paginazione">
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
        </>
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
