import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Heart, Clock, Send, X, Tag, ChevronLeft, ChevronRight,
  Twitch, LogIn, Plus, User,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import SEO from '../components/SEO';

const TAGS = [
  { value: 'generale',      label: '💬 Generale',     color: 'var(--text-muted)' },
  { value: 'giochi',        label: '🎮 Giochi',       color: 'var(--accent-twitch)' },
  { value: 'stream',        label: '📺 Stream',       color: '#9146FF' },
  { value: 'tech',          label: '🤖 Tech & IA',    color: 'var(--secondary)' },
  { value: 'meme',          label: '😂 Meme',         color: 'var(--accent-warm)' },
  { value: 'suggerimenti',  label: '💡 Suggerimenti', color: 'var(--primary)' },
];

function tagInfo(value) {
  return TAGS.find(t => t.value === value) || TAGS[0];
}

function timeAgo(ts) {
  const diff = Date.now() - Number(ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ora';
  if (mins < 60) return `${mins}m fa`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h fa`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}g fa`;
  return `${Math.floor(days / 30)}mesi fa`;
}

const up = (delay = 0) => ({
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay, type: 'spring', stiffness: 220, damping: 24 },
});

/* ═══════════════════════════════════════
   POST CARD
   ═══════════════════════════════════════ */
function PostCard({ post, onLike }) {
  const tag = tagInfo(post.tag);
  return (
    <motion.div layout {...up(0)}>
      <Link
        to={`/community/${post.id}`}
        className="glass-card community-post-card"
        style={{ display: 'block', textDecoration: 'none', color: 'inherit', padding: '1.2rem 1.4rem' }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {/* Avatar */}
          <div className="community-avatar">
            {post.authorAvatar ? (
              <img src={post.authorAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <User size={20} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                {post.authorDisplay || post.author}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
                <Clock size={11} style={{ verticalAlign: '-1px' }} /> {timeAgo(post.createdAt)}
              </span>
              <span className="chip" style={{
                fontSize: '0.65rem', padding: '2px 8px',
                background: `${tag.color}18`, color: tag.color,
                border: `1px solid ${tag.color}30`,
                marginLeft: 'auto',
              }}>
                {tag.label}
              </span>
            </div>

            {/* Title */}
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 6px', lineHeight: 1.35, color: 'var(--text-main)' }}>
              {post.title}
            </h3>

            {/* Body preview */}
            <p style={{
              fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.55,
              overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
              WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', margin: 0,
            }}>
              {post.body}
            </p>

            {/* Footer */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '10px', alignItems: 'center' }}>
              <button
                className="community-action-btn"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLike(post); }}
              >
                <Heart size={14} fill={post.liked ? 'var(--accent)' : 'none'} color={post.liked ? 'var(--accent)' : 'var(--text-faint)'} />
                <span>{post.likeCount || 0}</span>
              </button>
              <span className="community-action-btn" style={{ pointerEvents: 'none' }}>
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
   POST EDITOR (modal-style)
   ═══════════════════════════════════════ */
function PostEditor({ onClose, onCreated }) {
  const { twitchToken } = useTwitchAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState('generale');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/community', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), tag }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      onCreated(data.post);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <motion.div
      className="community-editor-backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        className="glass-panel community-editor"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
            ✏️ Nuovo Post
          </h3>
          <button type="button" onClick={onClose} className="community-action-btn" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tag selector */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          {TAGS.map(t => (
            <button
              key={t.value}
              type="button"
              className="chip"
              onClick={() => setTag(t.value)}
              style={{
                fontSize: '0.7rem', padding: '3px 10px', cursor: 'pointer',
                background: tag === t.value ? `${t.color}25` : 'var(--surface-1)',
                color: tag === t.value ? t.color : 'var(--text-muted)',
                border: `1px solid ${tag === t.value ? `${t.color}40` : 'var(--glass-border)'}`,
                transition: 'all .2s ease',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Titolo del post..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          className="community-input"
          required
        />

        <textarea
          placeholder="Scrivi il tuo messaggio..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          rows={5}
          className="community-input community-textarea"
          required
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
            {body.length}/2000
          </span>
          {error && <span style={{ fontSize: '0.78rem', color: 'var(--accent)', flex: 1 }}>{error}</span>}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={sending || !title.trim() || !body.trim()}
            style={{ fontSize: '0.85rem', padding: '0.5rem 1.3rem' }}
          >
            {sending ? 'Invio…' : <><Send size={14} /> Pubblica</>}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   COMMUNITY PAGE
   ═══════════════════════════════════════ */
export default function CommunityPage() {
  const { isLoggedIn, twitchUser, twitchToken, clientId, getTwitchLoginUrl } = useTwitchAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(parseInt(searchParams.get('page')) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTag, setActiveTag] = useState(searchParams.get('tag') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditor, setShowEditor] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page);
      params.set('limit', '20');
      if (activeTag) params.set('tag', activeTag);

      const headers = {};
      if (twitchToken) headers.Authorization = `Bearer ${twitchToken}`;

      const res = await fetch(`/api/community?${params}`, { headers });
      if (!res.ok) throw new Error('Fetch failed');
      const data = await res.json();
      setPosts(data.posts || []);
      setTotalPages(data.pages || 1);
    } catch {
      setError('Impossibile caricare i post.');
    } finally {
      setLoading(false);
    }
  }, [page, activeTag, twitchToken]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Sync URL params
  useEffect(() => {
    const p = new URLSearchParams();
    if (page > 1) p.set('page', page);
    if (activeTag) p.set('tag', activeTag);
    setSearchParams(p, { replace: true });
  }, [page, activeTag, setSearchParams]);

  const handleTagClick = (tagValue) => {
    setActiveTag(prev => prev === tagValue ? null : tagValue);
    setPage(1);
  };

  const handleLike = async (post) => {
    if (!isLoggedIn) return;
    const action = post.liked ? 'unlike' : 'like';
    // Optimistic update
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
        body: JSON.stringify({ postId: post.id, action }),
      });
    } catch {
      // Revert on error
      setPosts(prev => prev.map(p =>
        p.id === post.id ? { ...p, liked: post.liked, likeCount: post.likeCount } : p
      ));
    }
  };

  const handlePostCreated = (newPost) => {
    setPosts(prev => [newPost, ...prev]);
  };

  return (
    <div className="main-content">
      <SEO
        title="Community"
        description="La community di ANDRYXify — Discussioni, meme, suggerimenti e molto altro. Accedi con Twitch per partecipare!"
        path="/community"
      />

      {/* Header */}
      <section className="header" style={{ paddingTop: '1rem', paddingBottom: '0.5rem' }}>
        <motion.h1 className="title" {...up(0.05)}>
          <span className="text-gradient">Community</span>
        </motion.h1>
        <motion.p className="subtitle" {...up(0.12)}>
          Discuti, condividi e connettiti con la community di <strong>ANDRYXify</strong>.
        </motion.p>
      </section>

      {/* Auth bar + New post button */}
      <motion.div className="glass-panel" style={{ padding: '1rem 1.3rem' }} {...up(0.18)}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          {isLoggedIn ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Twitch size={16} color="#9146FF" />
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-twitch)' }}>
                  {twitchUser}
                </span>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => setShowEditor(true)}
                style={{ fontSize: '0.82rem', padding: '0.45rem 1.1rem' }}
              >
                <Plus size={15} /> Nuovo Post
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                Accedi con Twitch per pubblicare e mettere like
              </span>
              {clientId && (
                <a href={getTwitchLoginUrl('/community')} className="btn" style={{
                  background: 'linear-gradient(135deg,#9146FF,#c800ff)',
                  color: '#fff', fontSize: '0.82rem', padding: '0.45rem 1.1rem',
                  boxShadow: '0 4px 16px rgba(145,70,255,.3)',
                }}>
                  <LogIn size={14} /> Login con Twitch
                </a>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Tag filters */}
      <motion.div {...up(0.22)} style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          className="chip"
          onClick={() => handleTagClick(null)}
          style={{
            cursor: 'pointer', fontSize: '0.74rem', padding: '4px 12px',
            background: !activeTag ? 'rgba(255,255,255,0.08)' : 'transparent',
            color: !activeTag ? 'var(--text-main)' : 'var(--text-muted)',
            border: `1px solid ${!activeTag ? 'rgba(255,255,255,0.14)' : 'var(--glass-border)'}`,
          }}
        >
          <Tag size={12} /> Tutti
        </button>
        {TAGS.map(t => (
          <button
            key={t.value}
            className="chip"
            onClick={() => handleTagClick(t.value)}
            style={{
              cursor: 'pointer', fontSize: '0.74rem', padding: '4px 12px',
              background: activeTag === t.value ? `${t.color}20` : 'transparent',
              color: activeTag === t.value ? t.color : 'var(--text-muted)',
              border: `1px solid ${activeTag === t.value ? `${t.color}35` : 'var(--glass-border)'}`,
              transition: 'all .2s ease',
            }}
          >
            {t.label}
          </button>
        ))}
      </motion.div>

      {/* Post list */}
      <motion.div {...up(0.28)} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {loading && posts.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton" style={{ height: '120px', borderRadius: 'var(--r-md)' }} />
          ))
        ) : error ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ color: 'var(--accent)' }}>{error}</p>
            <button className="btn btn-ghost" onClick={fetchPosts} style={{ marginTop: '0.75rem' }}>
              Riprova
            </button>
          </div>
        ) : posts.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
            <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🫥</p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              Nessun post {activeTag ? `con tag "${tagInfo(activeTag).label}"` : 'ancora'}.
            </p>
            {isLoggedIn && (
              <button
                className="btn btn-primary"
                onClick={() => setShowEditor(true)}
                style={{ marginTop: '1rem', fontSize: '0.85rem' }}
              >
                <Plus size={15} /> Scrivi il primo!
              </button>
            )}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {posts.map(post => (
              <PostCard key={post.id} post={post} onLike={handleLike} />
            ))}
          </AnimatePresence>
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div {...up(0.32)} style={{ display: 'flex', justifyContent: 'center', gap: '8px', alignItems: 'center' }}>
          <button
            className="btn btn-ghost"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {page} / {totalPages}
          </span>
          <button
            className="btn btn-ghost"
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            style={{ padding: '0.4rem 0.8rem', fontSize: '0.82rem' }}
          >
            <ChevronRight size={16} />
          </button>
        </motion.div>
      )}

      {/* Post Editor Modal */}
      <AnimatePresence>
        {showEditor && isLoggedIn && (
          <PostEditor onClose={() => setShowEditor(false)} onCreated={handlePostCreated} />
        )}
      </AnimatePresence>
    </div>
  );
}
