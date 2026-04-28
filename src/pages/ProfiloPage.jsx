/**
 * ProfiloPage — Scheda profilo utente "stile Facebook ma meglio".
 * Route: /profilo/:username
 *
 * Sezioni: header con copertina (custom o preset) + avatar grande, stats potenziate,
 * pannello Intro (pronomi/località/lavoro/giochi/streamer preferiti), anteprima amici,
 * tab Post / Foto / Preferiti / Trofei, selettore tema/copertina, badge LIVE,
 * pulsante condividi. Layout 2-colonne ≥960px, 1-colonna mobile.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Edit3, Save, ExternalLink, Trophy, MessageSquare, Heart,
  Instagram, Youtube, Twitch, Globe, Loader, Camera, Image as ImageIcon,
  X, MapPin, Briefcase, Gamepad2, Star, Calendar, Users as UsersIcon,
  Award, Crown, Medal, Shield, Share2, Palette, Radio, Music,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useEmoteTwitch } from '../hooks/useEmoteTwitch';
import EmotePicker from '../components/EmotePicker';
import BottoneAggiungiAmico from '../components/BottoneAggiungiAmico';
import TikTokIcon from '../components/TikTokIcon';
import DiscordIcon from '../components/DiscordIcon';
import SEO from '../components/SEO';
import { preparaMediaPerUpload } from '../utils/compressioneMedia';
import { condividi } from '../utils/condividi';

const entrata = (ritardo = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: ritardo, type: 'spring', stiffness: 220, damping: 24 },
});

const SOCIAL_ICONS = {
  twitch: Twitch,
  youtube: Youtube,
  instagram: Instagram,
  tiktok: ({ size }) => <TikTokIcon size={size} />,
  discord: ({ size }) => <DiscordIcon size={size} />,
  spotify: Music,
  twitter: Globe,
  website: Globe,
};

/* Mappa tema → CSS accent (stessi valori del backend ALLOWED_THEMES) */
const TEMA_ACCENT = {
  default: '#E040FB',
  magenta: '#FF1493',
  cyan:    '#00E5FF',
  amber:   '#FFB300',
  emerald: '#10B981',
  violet:  '#7C3AED',
};

/* Icone trofei dinamiche per nome */
const TROFEO_ICONA = {
  crown: Crown, medal: Medal, trophy: Trophy, message: MessageSquare,
  users: UsersIcon, heart: Heart, shield: Shield, star: Star, award: Award,
};

const INTRO_LABELS = {
  pronomi:           { icon: User,      label: 'Pronomi' },
  localita:          { icon: MapPin,    label: 'Località' },
  lavoro:            { icon: Briefcase, label: 'Lavoro' },
  giocoPreferito:    { icon: Gamepad2,  label: 'Gioco preferito' },
  streamerPreferito: { icon: Heart,     label: 'Streamer preferito' },
};

const formatDataIT = (ts) => {
  if (!ts) return null;
  try {
    return new Date(Number(ts)).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return null; }
};

export default function ProfiloPage() {
  const { username } = useParams();
  const usernameLower = (username || '').toLowerCase();
  const { isLoggedIn, twitchUser, twitchToken } = useTwitchAuth();
  const { emoteCanale, emoteGlobali, seventvCanale, seventvGlobali, renderTestoConEmote } = useEmoteTwitch(twitchToken);

  const [profilo, setProfilo] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [modifica, setModifica] = useState(false);
  const [tabAttiva, setTabAttiva] = useState('post');

  /* Form modifica */
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState({});
  const [intro, setIntro] = useState({});
  const [tema, setTema] = useState('default');
  const [coverPresetSel, setCoverPresetSel] = useState('');
  const [friendRequestsOpen, setFriendRequestsOpen] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState('public');
  const [salvataggio, setSalvataggio] = useState(false);
  const [erroreSalvataggio, setErroreSalvataggio] = useState('');

  /* Upload immagini */
  const [uploadCover, setUploadCover] = useState(false);
  const [uploadAvatar, setUploadAvatar] = useState(false);
  const [erroreUpload, setErroreUpload] = useState('');
  const inputCoverRef = useRef(null);
  const inputAvatarRef = useRef(null);

  /* Tab data */
  const [posts, setPosts] = useState([]);
  const [preferiti, setPreferiti] = useState([]);
  const [foto, setFoto] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [fotoLoading, setFotoLoading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  /* Selettore copertina/tema panel separato (anche fuori da modifica generale) */
  const [pannelloPersonalizza, setPannelloPersonalizza] = useState(false);
  const [coverPresets, setCoverPresets] = useState([]);

  const isOwnProfile = isLoggedIn && twitchUser?.toLowerCase() === usernameLower;

  /* ─── Caricamento profilo ─── */
  const caricaProfilo = useCallback(async () => {
    setCaricamento(true);
    setErrore('');
    try {
      const headers = {};
      if (twitchToken) headers.Authorization = `Bearer ${twitchToken}`;
      const res = await fetch(`/api/profile?user=${encodeURIComponent(usernameLower)}`, { headers });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Profilo non trovato');
      }
      const data = await res.json().catch(() => { throw new Error('Profilo non trovato'); });
      setProfilo(data);
      setBio(data.bio || '');
      setSocials(data.socials || {});
      setIntro(data.intro || {});
      setTema(data.theme || 'default');
      setCoverPresetSel(data.coverPreset?.slug || '');
      setFriendRequestsOpen(data.friendRequestsOpen !== false);
      setProfileVisibility(data.profileVisibility || 'public');
    } catch (e) {
      setErrore(e.message);
    } finally {
      setCaricamento(false);
    }
  }, [usernameLower, twitchToken]);

  /* ─── Caricamento tab data ─── */
  const caricaPost = useCallback(async () => {
    setPostsLoading(true);
    try {
      const res = await fetch(`/api/community?user=${encodeURIComponent(usernameLower)}&limit=10`);
      if (res.ok) { const d = await res.json(); setPosts(d.posts || []); }
    } catch { /* silenzioso */ } finally { setPostsLoading(false); }
  }, [usernameLower]);

  const caricaPreferiti = useCallback(async () => {
    if (!isOwnProfile || !twitchToken) return;
    try {
      const res = await fetch(`/api/community?action=favorites`, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (res.ok) { const d = await res.json(); setPreferiti(d.posts || []); }
    } catch { /* silenzioso */ }
  }, [isOwnProfile, twitchToken]);

  const caricaFoto = useCallback(async () => {
    setFotoLoading(true);
    try {
      const headers = {};
      if (twitchToken) headers.Authorization = `Bearer ${twitchToken}`;
      const res = await fetch(`/api/community?action=user_media&user=${encodeURIComponent(usernameLower)}&limit=24`, { headers });
      if (res.ok) { const d = await res.json(); setFoto(d.media || []); }
    } catch { /* silenzioso */ } finally { setFotoLoading(false); }
  }, [usernameLower, twitchToken]);

  const caricaCoverPresets = useCallback(async () => {
    if (coverPresets.length > 0) return;
    try {
      const res = await fetch('/api/profile?action=cover_presets');
      if (res.ok) { const d = await res.json(); setCoverPresets(d.presets || []); }
    } catch { /* silenzioso */ }
  }, [coverPresets.length]);

  useEffect(() => { caricaProfilo(); }, [caricaProfilo]);
  useEffect(() => { if (tabAttiva === 'post') caricaPost(); }, [tabAttiva, caricaPost]);
  useEffect(() => { if (tabAttiva === 'preferiti') caricaPreferiti(); }, [tabAttiva, caricaPreferiti]);
  useEffect(() => { if (tabAttiva === 'foto') caricaFoto(); }, [tabAttiva, caricaFoto]);
  useEffect(() => { if (modifica || pannelloPersonalizza) caricaCoverPresets(); }, [modifica, pannelloPersonalizza, caricaCoverPresets]);

  /* Tema accent applicato come CSS variable sul container del profilo */
  const accentColor = useMemo(
    () => profilo?.accentColor || TEMA_ACCENT[profilo?.theme || 'default'] || TEMA_ACCENT.default,
    [profilo],
  );
  const stileContainer = useMemo(() => ({ '--profilo-accent': accentColor }), [accentColor]);

  /* ─── Upload copertina/avatar ─── */
  const upload = useCallback(async (file) => {
    if (!twitchToken) throw new Error('Devi essere loggato.');
    const preparato = await preparaMediaPerUpload(file);
    const res = await fetch('/api/community-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
      body: JSON.stringify({ action: 'upload', ...preparato }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload fallito');
    return data.mediaId;
  }, [twitchToken]);

  const cambiaCopertina = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErroreUpload('');
    setUploadCover(true);
    try {
      const mediaId = await upload(file);
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'update', coverMediaId: mediaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore salvataggio copertina');
      await caricaProfilo();
    } catch (err) {
      setErroreUpload(err.message);
    } finally { setUploadCover(false); }
  };

  const cambiaAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErroreUpload('');
    setUploadAvatar(true);
    try {
      const mediaId = await upload(file);
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'update', customAvatarMediaId: mediaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore salvataggio avatar');
      await caricaProfilo();
    } catch (err) {
      setErroreUpload(err.message);
    } finally { setUploadAvatar(false); }
  };

  const ripristinaAvatar = async () => {
    if (!twitchToken) return;
    setUploadAvatar(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'update', customAvatarMediaId: '' }),
      });
      await caricaProfilo();
    } finally { setUploadAvatar(false); }
  };

  const selezionaPreset = async (slug) => {
    if (!twitchToken) return;
    setUploadCover(true);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'update', coverPreset: slug }),
      });
      await caricaProfilo();
      setCoverPresetSel(slug);
    } finally { setUploadCover(false); }
  };

  const selezionaTema = async (nuovoTema) => {
    if (!twitchToken) return;
    setTema(nuovoTema);
    try {
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'update', theme: nuovoTema }),
      });
      await caricaProfilo();
    } catch { /* silenzioso */ }
  };

  /* ─── Salvataggio dati testuali (bio, intro, socials, ecc.) ─── */
  const salvaProfilo = async () => {
    if (!twitchToken) return;
    setSalvataggio(true);
    setErroreSalvataggio('');
    try {
      const payload = {
        action: 'update',
        bio: bio.slice(0, 300),
        socials,
        friendRequestsOpen,
        profileVisibility,
        theme: tema,
      };
      for (const [k, v] of Object.entries(intro)) {
        payload[k] = v ?? '';
      }
      const res = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore salvataggio');
      setModifica(false);
      await caricaProfilo();
    } catch (e) {
      setErroreSalvataggio(e.message);
    } finally { setSalvataggio(false); }
  };

  /* ─── Condividi profilo ─── */
  const condividiProfilo = async () => {
    const url = `${window.location.origin}/profilo/${usernameLower}`;
    await condividi({
      titolo: `${profilo?.display || usernameLower} su ANDRYXify`,
      testo: profilo?.bio?.slice(0, 120) || `Scopri il profilo di ${profilo?.display || usernameLower}!`,
      url,
    });
  };

  /* ═══════════════════════════════════════════════ */
  if (caricamento) {
    return (
      <div className="main-content">
        <SEO title={`@${usernameLower}`} description={`Profilo di ${usernameLower} su ANDRYXify`} path={`/profilo/${usernameLower}`} />
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={28} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Caricamento profilo…</p>
        </div>
      </div>
    );
  }

  if (errore) {
    return (
      <div className="main-content">
        <SEO title={`@${usernameLower}`} description={`Profilo di ${usernameLower} su ANDRYXify`} path={`/profilo/${usernameLower}`} />
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <User size={40} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>{errore}</p>
        </div>
      </div>
    );
  }

  const coverStyle = profilo?.coverUrl
    ? { backgroundImage: `url(${profilo.coverUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : profilo?.coverPreset
      ? { background: profilo.coverPreset.css }
      : { background: 'linear-gradient(135deg, rgba(40,52,88,0.55) 0%, rgba(80,100,160,0.30) 100%)' };

  const liveActive = profilo?.live?.live;

  return (
    <div className="main-content profilo-pagina" style={stileContainer}>
      <SEO
        title={`${profilo?.display || usernameLower} — Profilo`}
        description={profilo?.bio || `Profilo di ${usernameLower} su ANDRYXify`}
        path={`/profilo/${usernameLower}`}
      />

      {/* ═══════════════════════════════════════════════
          HEADER — copertina + avatar grande + azioni
          ═══════════════════════════════════════════════ */}
      <motion.section className="glass-panel profilo-header" {...entrata(0.05)}>
        <div className="profilo-cover" style={coverStyle}>
          {liveActive && (
            <a href="/twitch" className="profilo-live-badge" title={profilo.live.title || 'In live ora'}>
              <span className="profilo-live-dot" /> LIVE su Twitch
              {profilo.live.viewerCount > 0 && <span className="profilo-live-count"> · {profilo.live.viewerCount} 👁</span>}
            </a>
          )}

          {isOwnProfile && (
            <div className="profilo-cover-azioni">
              <button
                type="button"
                className="btn btn-ghost profilo-cover-btn"
                onClick={() => { setPannelloPersonalizza(p => !p); caricaCoverPresets(); }}
                title="Cambia copertina"
              >
                <Palette size={14} /> Copertina
              </button>
              <button
                type="button"
                className="btn btn-ghost profilo-cover-btn"
                onClick={() => inputCoverRef.current?.click()}
                disabled={uploadCover}
                title="Carica una foto come copertina"
              >
                {uploadCover ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={14} />}
                {' '}Carica
              </button>
              <input ref={inputCoverRef} type="file" accept="image/*" onChange={cambiaCopertina} style={{ display: 'none' }} />
            </div>
          )}

          {/* Avatar grande sovrapposto */}
          <div className="profilo-avatar-wrap">
            {profilo?.avatar ? (
              <img src={profilo.avatar} alt="" className="profilo-avatar-grande glass-avatar" />
            ) : (
              <div className="profilo-avatar-grande glass-avatar profilo-avatar-placeholder">
                <User size={48} />
              </div>
            )}
            {isOwnProfile && (
              <button
                type="button"
                className="profilo-avatar-edit"
                onClick={() => inputAvatarRef.current?.click()}
                disabled={uploadAvatar}
                title="Cambia avatar"
              >
                {uploadAvatar ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Camera size={14} />}
              </button>
            )}
            <input ref={inputAvatarRef} type="file" accept="image/*" onChange={cambiaAvatar} style={{ display: 'none' }} />
          </div>
        </div>

        {/* Pannello selezione copertina (preset library) */}
        <AnimatePresence>
          {isOwnProfile && pannelloPersonalizza && (
            <motion.div
              className="profilo-cover-libreria glass-card"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <strong style={{ fontSize: '0.9rem' }}>Libreria copertine</strong>
                <button type="button" className="btn btn-ghost" style={{ fontSize: '0.78rem' }} onClick={() => setPannelloPersonalizza(false)}>
                  <X size={13} />
                </button>
              </div>
              <div className="profilo-preset-griglia">
                {coverPresets.map(p => (
                  <button
                    key={p.slug}
                    type="button"
                    className={`profilo-preset-chip ${coverPresetSel === p.slug ? 'is-attivo' : ''}`}
                    style={{ background: p.css }}
                    onClick={() => selezionaPreset(p.slug)}
                    title={p.label}
                  >
                    <span className="profilo-preset-label">{p.label}</span>
                  </button>
                ))}
              </div>

              <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--vetro-bordo-colore)', paddingTop: '0.6rem' }}>
                <strong style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.4rem' }}>
                  <Palette size={12} /> Tema accento
                </strong>
                <div className="profilo-tema-griglia">
                  {Object.entries(TEMA_ACCENT).map(([k, color]) => (
                    <button
                      key={k}
                      type="button"
                      className={`profilo-tema-chip ${tema === k ? 'is-attivo' : ''}`}
                      style={{ background: color }}
                      onClick={() => selezionaTema(k)}
                      title={k}
                    />
                  ))}
                </div>
              </div>

              {profilo?.avatarSource === 'custom' && (
                <div style={{ marginTop: '0.8rem', borderTop: '1px solid var(--vetro-bordo-colore)', paddingTop: '0.6rem' }}>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={ripristinaAvatar}>
                    <ImageIcon size={13} /> Ripristina avatar Twitch
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Identità + bio + azioni */}
        <div className="profilo-identita">
          <div className="profilo-identita-testo">
            <h2 className="profilo-display">
              {profilo?.display || usernameLower}
              {profilo?.roles?.broadcaster && <span className="profilo-badge-ruolo profilo-badge-broadcaster" title="Broadcaster">📺</span>}
              {profilo?.roles?.mod && <span className="profilo-badge-ruolo profilo-badge-mod" title="Moderatore"><Shield size={12} /></span>}
            </h2>
            <p className="profilo-handle">@{usernameLower}</p>
            {profilo?.bio && !modifica && (
              <p className="profilo-bio">{renderTestoConEmote(profilo.bio)}</p>
            )}

            {profilo?.socials && Object.values(profilo.socials).some(Boolean) && !modifica && (
              <div className="profilo-social-row">
                {Object.entries(profilo.socials).filter(([, v]) => v).map(([piattaforma, link]) => {
                  const IconComp = SOCIAL_ICONS[piattaforma] || Globe;
                  return (
                    <a
                      key={piattaforma}
                      href={link.startsWith('http') ? link : `https://${link}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="chip profilo-social-chip"
                    >
                      <IconComp size={13} /> {piattaforma}
                      <ExternalLink size={10} />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          <div className="profilo-azioni">
            {isOwnProfile && !modifica && (
              <button type="button" className="btn btn-ghost" onClick={() => setModifica(true)}>
                <Edit3 size={14} /> Modifica
              </button>
            )}
            {!isOwnProfile && isLoggedIn && (
              <>
                <BottoneAggiungiAmico targetUser={usernameLower} twitchToken={twitchToken} currentUser={twitchUser} />
                <Link to={`/messaggi?u=${encodeURIComponent(usernameLower)}`} className="btn btn-ghost">
                  <MessageSquare size={14} /> Messaggio
                </Link>
              </>
            )}
            <button type="button" className="btn btn-ghost" onClick={condividiProfilo} title="Condividi profilo">
              <Share2 size={14} /> Condividi
            </button>
          </div>
        </div>

        {erroreUpload && <p className="profilo-errore">{erroreUpload}</p>}

        {/* ─── Form modifica esteso ─── */}
        <AnimatePresence>
          {modifica && (
            <motion.div
              className="profilo-form"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <label className="profilo-label">Bio ({bio.length}/300)</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                maxLength={300}
                rows={3}
                className="social-campo social-area-testo"
                placeholder="Scrivi qualcosa su di te…"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.6rem' }}>
                <EmotePicker
                  emoteCanale={emoteCanale}
                  emoteGlobali={emoteGlobali}
                  seventvCanale={seventvCanale}
                  seventvGlobali={seventvGlobali}
                  onSelect={(nome) => setBio(prev => (prev ? `${prev} ${nome}` : nome).slice(0, 300))}
                />
              </div>

              <details className="profilo-details" open>
                <summary>Intro (pronomi, località, lavoro…)</summary>
                {Object.entries(INTRO_LABELS).map(([campo, { icon: Icon, label }]) => (
                  <div key={campo} className="profilo-intro-input">
                    <Icon size={13} className="profilo-intro-icon" />
                    <input
                      type="text"
                      placeholder={label}
                      value={intro[campo] || ''}
                      maxLength={60}
                      onChange={e => setIntro(prev => ({ ...prev, [campo]: e.target.value }))}
                      className="social-campo"
                    />
                  </div>
                ))}
              </details>

              <details className="profilo-details">
                <summary>Link social</summary>
                {['twitch', 'youtube', 'instagram', 'tiktok', 'discord', 'spotify', 'twitter', 'website'].map(p => (
                  <input
                    key={p}
                    type="text"
                    placeholder={p.charAt(0).toUpperCase() + p.slice(1)}
                    value={socials[p] || ''}
                    onChange={e => setSocials(prev => ({ ...prev, [p]: e.target.value }))}
                    className="social-campo"
                    style={{ marginBottom: '0.4rem' }}
                  />
                ))}
              </details>

              <details className="profilo-details">
                <summary>Privacy</summary>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0' }}>
                  <span style={{ fontSize: '0.85rem' }}>Richieste amicizia aperte</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={friendRequestsOpen}
                    onClick={() => setFriendRequestsOpen(!friendRequestsOpen)}
                    className="profilo-toggle"
                    data-attivo={friendRequestsOpen}
                  >
                    <span className="profilo-toggle-knob" />
                  </button>
                </div>
                <label className="profilo-label" style={{ marginTop: '0.4rem' }}>Visibilità profilo</label>
                <select
                  value={profileVisibility}
                  onChange={e => setProfileVisibility(e.target.value)}
                  className="social-campo"
                >
                  <option value="public">Pubblico</option>
                  <option value="friends">Solo amici</option>
                  <option value="private">Privato</option>
                </select>
              </details>

              {erroreSalvataggio && <p className="profilo-errore">{erroreSalvataggio}</p>}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem' }}>
                <button className="btn btn-primary" onClick={salvaProfilo} disabled={salvataggio}>
                  <Save size={14} /> {salvataggio ? 'Salvataggio…' : 'Salva'}
                </button>
                <button className="btn btn-ghost" onClick={() => setModifica(false)}>
                  Annulla
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* ═══════════════════════════════════════════════
          STATS POTENZIATE
          ═══════════════════════════════════════════════ */}
      <motion.div className="profilo-stats-griglia" {...entrata(0.1)}>
        <StatCard icon={MessageSquare} label="Post" value={profilo?.stats?.postCount ?? 0} />
        <StatCard icon={UsersIcon} label="Amici" value={profilo?.stats?.friendCount ?? 0} />
        <StatCard icon={Heart} label="Like ricevuti" value={profilo?.stats?.likesReceived ?? 0} />
        <StatCard icon={Trophy} label="Mensile" value={profilo?.stats?.scoreMonthly ?? 0} accent />
        <StatCard icon={Crown} label="Legend" value={profilo?.stats?.scoreLegend ?? 0} />
        <StatCard icon={Gamepad2} label="Jump" value={profilo?.stats?.scorePlatform ?? 0} />
      </motion.div>

      {/* ═══════════════════════════════════════════════
          CONTENUTO PRINCIPALE — 2 COLONNE DESKTOP
          ═══════════════════════════════════════════════ */}
      <div className="profilo-corpo">
        {/* ── Sidebar (intro + amici) ── */}
        <aside className="profilo-sidebar">
          {/* Intro */}
          <motion.section className="glass-panel profilo-intro" {...entrata(0.15)}>
            <h3 className="profilo-sezione-titolo"><User size={14} /> Intro</h3>
            {Object.keys(profilo?.intro || {}).length === 0 && !profilo?.firstPostAt && !profilo?.lastPostAt ? (
              <p className="profilo-vuoto">Nessuna informazione ancora.</p>
            ) : (
              <ul className="profilo-intro-lista">
                {Object.entries(profilo?.intro || {}).map(([campo, valore]) => {
                  const meta = INTRO_LABELS[campo];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <li key={campo}>
                      <Icon size={13} /> <span>{valore}</span>
                    </li>
                  );
                })}
                {profilo?.firstPostAt && (
                  <li><Calendar size={13} /> Iscritto dal {formatDataIT(profilo.firstPostAt)}</li>
                )}
                {profilo?.lastPostAt && profilo.lastPostAt !== profilo.firstPostAt && (
                  <li><Radio size={13} /> Ultima attività {formatDataIT(profilo.lastPostAt)}</li>
                )}
              </ul>
            )}
          </motion.section>

          {/* Amici (anteprima) */}
          <motion.section className="glass-panel profilo-amici" {...entrata(0.18)}>
            <div className="profilo-sezione-header">
              <h3 className="profilo-sezione-titolo">
                <UsersIcon size={14} /> Amici
                <span className="profilo-amici-count">({profilo?.stats?.friendCount ?? 0})</span>
              </h3>
              {isOwnProfile && (
                <Link to="/amici" className="profilo-vedi-tutti">Vedi tutti</Link>
              )}
            </div>
            {(!profilo?.friendsPreview || profilo.friendsPreview.length === 0) ? (
              <p className="profilo-vuoto">Nessun amico da mostrare.</p>
            ) : (
              <div className="profilo-amici-griglia">
                {profilo.friendsPreview.map(a => (
                  <Link key={a.login} to={`/profilo/${a.login}`} className="profilo-amico-card">
                    {a.avatar ? (
                      <img src={a.avatar} alt="" />
                    ) : (
                      <div className="profilo-amico-placeholder"><User size={20} /></div>
                    )}
                    <span className="profilo-amico-nome">{a.display}</span>
                  </Link>
                ))}
              </div>
            )}
          </motion.section>
        </aside>

        {/* ── Main column (tabs) ── */}
        <main className="profilo-main">
          <motion.section className="glass-panel profilo-tab-panel" {...entrata(0.2)}>
            <div className="profilo-tabs">
              {[
                { id: 'post',     label: 'Post',     icon: MessageSquare },
                { id: 'foto',     label: 'Foto',     icon: ImageIcon },
                ...(isOwnProfile ? [{ id: 'preferiti', label: 'Preferiti', icon: Heart }] : []),
                { id: 'trofei',   label: 'Trofei',   icon: Trophy },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  className={`profilo-tab ${tabAttiva === tab.id ? 'is-attiva' : ''}`}
                  onClick={() => setTabAttiva(tab.id)}
                >
                  <tab.icon size={13} /> {tab.label}
                </button>
              ))}
            </div>

            {tabAttiva === 'post' && (
              <div>
                {postsLoading ? (
                  <p className="profilo-vuoto">Caricamento…</p>
                ) : posts.length === 0 ? (
                  <p className="profilo-vuoto">Nessun post ancora.</p>
                ) : (
                  posts.map(post => (
                    <Link key={post.id} to={`/socialify/${post.id}`} className="glass-card profilo-post-link">
                      <div className="profilo-post-titolo">{post.title}</div>
                      <p className="profilo-post-anteprima">{post.body}</p>
                    </Link>
                  ))
                )}
              </div>
            )}

            {tabAttiva === 'foto' && (
              <div>
                {fotoLoading ? (
                  <p className="profilo-vuoto">Caricamento…</p>
                ) : foto.length === 0 ? (
                  <p className="profilo-vuoto">Nessuna foto da mostrare.</p>
                ) : (
                  <div className="profilo-foto-griglia">
                    {foto.map(m => (
                      <button
                        key={`${m.postId}-${m.mediaId}`}
                        type="button"
                        className="profilo-foto-cell"
                        onClick={() => setLightbox(m)}
                        title={m.title}
                      >
                        <img src={m.url} alt={m.title} loading="lazy" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tabAttiva === 'preferiti' && isOwnProfile && (
              <div>
                {preferiti.length === 0 ? (
                  <p className="profilo-vuoto">Nessun preferito.</p>
                ) : (
                  preferiti.map(post => (
                    <Link key={post.id} to={`/socialify/${post.id}`} className="glass-card profilo-post-link">
                      <div className="profilo-post-titolo">{post.title}</div>
                      <p className="profilo-post-anteprima">{post.body}</p>
                    </Link>
                  ))
                )}
              </div>
            )}

            {tabAttiva === 'trofei' && (
              <div>
                {(!profilo?.trofei || profilo.trofei.length === 0) ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                    <Trophy size={32} color="var(--text-faint)" style={{ marginBottom: '0.5rem' }} />
                    <p className="profilo-vuoto">Nessun trofeo ancora — gioca, posta, fai amici!</p>
                  </div>
                ) : (
                  <div className="profilo-trofei-griglia">
                    {profilo.trofei.map(t => {
                      const Icon = TROFEO_ICONA[t.icon] || Award;
                      return (
                        <div key={t.id} className={`profilo-trofeo profilo-trofeo-${t.tier || 'community'}`}>
                          <div className="profilo-trofeo-icona"><Icon size={20} /></div>
                          <div className="profilo-trofeo-testo">
                            <div className="profilo-trofeo-titolo">{t.title}</div>
                            <div className="profilo-trofeo-desc">{t.description}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.section>
        </main>
      </div>

      {/* Lightbox per la galleria foto */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            className="profilo-lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
          >
            <button type="button" className="profilo-lightbox-close" onClick={() => setLightbox(null)}>
              <X size={20} />
            </button>
            <img src={lightbox.url} alt={lightbox.title} onClick={e => e.stopPropagation()} />
            <Link
              to={`/socialify/${lightbox.postId}`}
              className="btn btn-primary profilo-lightbox-link"
              onClick={() => setLightbox(null)}
            >
              Vai al post <ExternalLink size={13} />
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Card statistica riusabile ─── */
function StatCard({ icon: Icon, label, value, accent = false }) {
  return (
    <div className={`profilo-stat-card ${accent ? 'profilo-stat-accent' : ''}`}>
      <div className="profilo-stat-icona"><Icon size={16} /></div>
      <div className="profilo-stat-valore">{Number(value).toLocaleString('it-IT')}</div>
      <div className="profilo-stat-label">{label}</div>
    </div>
  );
}
