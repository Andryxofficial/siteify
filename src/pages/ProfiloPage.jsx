/**
 * ProfiloPage — Pagina profilo utente.
 * Route: /profilo/:username
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  User, Edit3, Save, ExternalLink, Trophy, MessageSquare, Heart,
  Instagram, Youtube, Twitch, Globe, Loader,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useEmoteTwitch } from '../hooks/useEmoteTwitch';
import EmotePicker from '../components/EmotePicker';
import BottoneAggiungiAmico from '../components/BottoneAggiungiAmico';
import TikTokIcon from '../components/TikTokIcon';
import DiscordIcon from '../components/DiscordIcon';
import SEO from '../components/SEO';

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
  website: Globe,
};

export default function ProfiloPage() {
  const { username } = useParams();
  const { isLoggedIn, twitchUser, twitchToken } = useTwitchAuth();
  const { emoteCanale, emoteGlobali, seventvCanale, seventvGlobali, renderTestoConEmote } = useEmoteTwitch(twitchToken);

  const [profilo, setProfilo] = useState(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState('');
  const [modifica, setModifica] = useState(false);
  const [tabAttiva, setTabAttiva] = useState('post');

  // Form modifica
  const [bio, setBio] = useState('');
  const [socials, setSocials] = useState({});
  const [friendRequestsOpen, setFriendRequestsOpen] = useState(true);
  const [salvataggio, setSalvataggio] = useState(false);

  // Tab data
  const [posts, setPosts] = useState([]);
  const [preferiti, setPreferiti] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const isOwnProfile = isLoggedIn && twitchUser === username;

  const caricaProfilo = useCallback(async () => {
    setCaricamento(true);
    setErrore('');
    try {
      const headers = {};
      if (twitchToken) headers.Authorization = `Bearer ${twitchToken}`;
      const res = await fetch(`/api/profile?user=${encodeURIComponent(username)}`, { headers });
      if (!res.ok) throw new Error('Profilo non trovato');
      const data = await res.json();
      setProfilo(data);
      setBio(data.bio || '');
      setSocials(data.socials || {});
      setFriendRequestsOpen(data.friendRequestsOpen !== false);
    } catch (e) {
      setErrore(e.message);
    } finally {
      setCaricamento(false);
    }
  }, [username, twitchToken]);

  const caricaPost = useCallback(async () => {
    setPostsLoading(true);
    try {
      const res = await fetch(`/api/community?author=${encodeURIComponent(username)}&limit=10`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch { /* silenzioso */ }
    finally { setPostsLoading(false); }
  }, [username]);

  const caricaPreferiti = useCallback(async () => {
    if (!isOwnProfile || !twitchToken) return;
    try {
      const res = await fetch(`/api/community?action=favorites`, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPreferiti(data.posts || []);
      }
    } catch { /* silenzioso */ }
  }, [isOwnProfile, twitchToken]);

  useEffect(() => { caricaProfilo(); }, [caricaProfilo]);
  useEffect(() => { if (tabAttiva === 'post') caricaPost(); }, [tabAttiva, caricaPost]);
  useEffect(() => { if (tabAttiva === 'preferiti') caricaPreferiti(); }, [tabAttiva, caricaPreferiti]);

  const salvaProfilo = async () => {
    if (!twitchToken) return;
    setSalvataggio(true);
    try {
      const payload = { bio: bio.slice(0, 300), socials, friendRequestsOpen };
      await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify(payload),
      });
      setModifica(false);
      caricaProfilo();
    } catch { /* silenzioso */ }
    finally { setSalvataggio(false); }
  };

  if (caricamento) {
    return (
      <div className="main-content">
        <SEO title={`@${username}`} description={`Profilo di ${username} su ANDRYXify`} path={`/profilo/${username}`} />
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={28} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>Caricamento profilo…</p>
        </div>
      </div>
    );
  }

  if (errore) {
    return (
      <div className="main-content">
        <SEO title={`@${username}`} description={`Profilo di ${username} su ANDRYXify`} path={`/profilo/${username}`} />
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
          <User size={40} color="var(--text-muted)" style={{ marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-muted)' }}>{errore}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-content">
      <SEO title={`${profilo?.display || username} — Profilo`} description={profilo?.bio || `Profilo di ${username} su ANDRYXify`} path={`/profilo/${username}`} />

      {/* ═══ Testata profilo ═══ */}
      <motion.section className="glass-panel" style={{ padding: '1.5rem', marginBottom: '1rem' }} {...entrata(0.05)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          {profilo?.avatar ? (
            <img src={profilo.avatar} alt="" style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover' }} className="glass-avatar" />
          ) : (
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--surface-1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={36} />
            </div>
          )}
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{profilo?.display || username}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>@{username}</p>
          </div>
        </div>

        {/* Bio */}
        {profilo?.bio && !modifica && (
          <p style={{ fontSize: '0.9rem', marginBottom: '0.8rem', lineHeight: 1.5 }}>
            {renderTestoConEmote(profilo.bio)}
          </p>
        )}

        {/* Social links */}
        {profilo?.socials && !modifica && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.8rem' }}>
            {Object.entries(profilo.socials).filter(([, v]) => v).map(([piattaforma, link]) => {
              const IconComp = SOCIAL_ICONS[piattaforma] || Globe;
              return (
                <a
                  key={piattaforma}
                  href={link.startsWith('http') ? link : `https://${link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chip"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem', textDecoration: 'none' }}
                >
                  <IconComp size={13} /> {piattaforma}
                  <ExternalLink size={10} />
                </a>
              );
            })}
          </div>
        )}

        {/* Azioni */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isOwnProfile && !modifica && (
            <button className="btn btn-ghost" style={{ fontSize: '0.82rem' }} onClick={() => setModifica(true)}>
              <Edit3 size={14} /> Modifica profilo
            </button>
          )}
          {!isOwnProfile && isLoggedIn && (
            <BottoneAggiungiAmico targetUser={username} twitchToken={twitchToken} currentUser={twitchUser} />
          )}
        </div>

        {/* ── Form modifica ── */}
        {modifica && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} style={{ marginTop: '1rem' }}>
            <label style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
              Bio ({bio.length}/300)
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              className="social-campo social-area-testo"
              placeholder="Scrivi qualcosa su di te…"
              style={{ marginBottom: '0.5rem' }}
            />
            <div style={{ marginBottom: '0.8rem', display: 'flex', justifyContent: 'flex-end' }}>
              <EmotePicker
                emoteCanale={emoteCanale}
                emoteGlobali={emoteGlobali}
                seventvCanale={seventvCanale}
                seventvGlobali={seventvGlobali}
                onSelect={(nome) => setBio(prev => (prev ? `${prev} ${nome}` : nome).slice(0, 300))}
              />
            </div>

            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Link social:</p>
            {['twitch', 'youtube', 'instagram', 'tiktok', 'discord', 'website'].map(piattaforma => (
              <input
                key={piattaforma}
                type="text"
                placeholder={piattaforma.charAt(0).toUpperCase() + piattaforma.slice(1)}
                value={socials[piattaforma] || ''}
                onChange={e => setSocials(prev => ({ ...prev, [piattaforma]: e.target.value }))}
                className="social-campo"
                style={{ marginBottom: '0.4rem', fontSize: '0.82rem' }}
              />
            ))}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0' }}>
              <span style={{ fontSize: '0.85rem' }}>Richieste amicizia aperte</span>
              <button
                role="switch"
                aria-checked={friendRequestsOpen}
                onClick={() => setFriendRequestsOpen(!friendRequestsOpen)}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none',
                  background: friendRequestsOpen ? 'var(--primary)' : 'rgba(255,255,255,0.15)',
                  position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: friendRequestsOpen ? 22 : 2,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff', transition: 'left 0.2s',
                }} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <button className="btn btn-primary" style={{ fontSize: '0.82rem' }} onClick={salvaProfilo} disabled={salvataggio}>
                <Save size={14} /> {salvataggio ? 'Salvataggio…' : 'Salva'}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: '0.82rem' }} onClick={() => setModifica(false)}>
                Annulla
              </button>
            </div>
          </motion.div>
        )}
      </motion.section>

      {/* ═══ Stats ═══ */}
      <motion.div className="glass-stats-bar" style={{ display: 'flex', justifyContent: 'space-around', padding: '0.8rem', marginBottom: '1rem' }} {...entrata(0.1)}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{profilo?.postCount ?? 0}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Post</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{profilo?.friendCount ?? 0}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Amici</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{profilo?.gameScore ?? 0}</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Punteggio</div>
        </div>
      </motion.div>

      {/* ═══ Tabs ═══ */}
      <motion.section className="glass-panel" style={{ padding: '1rem', marginBottom: '2rem' }} {...entrata(0.15)}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.6rem' }}>
          {[
            { id: 'post', label: 'Post', icon: MessageSquare },
            ...(isOwnProfile ? [{ id: 'preferiti', label: 'Preferiti', icon: Heart }] : []),
            { id: 'trofei', label: 'Trofei', icon: Trophy },
          ].map(tab => (
            <button
              key={tab.id}
              className={`btn ${tabAttiva === tab.id ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: '0.8rem', padding: '0.35rem 0.8rem' }}
              onClick={() => setTabAttiva(tab.id)}
            >
              <tab.icon size={13} /> {tab.label}
            </button>
          ))}
        </div>

        {/* Contenuto tab */}
        {tabAttiva === 'post' && (
          <div>
            {postsLoading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>Caricamento…</p>
            ) : posts.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>Nessun post ancora.</p>
            ) : (
              posts.map(post => (
                <Link
                  key={post.id}
                  to={`/socialify/${post.id}`}
                  className="glass-card"
                  style={{ display: 'block', padding: '0.8rem', marginBottom: '0.5rem', textDecoration: 'none' }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{post.title}</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.body}
                  </p>
                </Link>
              ))
            )}
          </div>
        )}

        {tabAttiva === 'preferiti' && isOwnProfile && (
          <div>
            {preferiti.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>Nessun preferito.</p>
            ) : (
              preferiti.map(post => (
                <Link
                  key={post.id}
                  to={`/socialify/${post.id}`}
                  className="glass-card"
                  style={{ display: 'block', padding: '0.8rem', marginBottom: '0.5rem', textDecoration: 'none' }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{post.title}</div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.body}
                  </p>
                </Link>
              ))
            )}
          </div>
        )}

        {tabAttiva === 'trofei' && (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <Trophy size={32} color="var(--text-faint)" style={{ marginBottom: '0.5rem' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              I trofei arriveranno presto! 🏆
            </p>
          </div>
        )}
      </motion.section>
    </div>
  );
}
