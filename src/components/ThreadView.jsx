import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, MessageSquare, Clock, Send, Trash2, User,
  Twitch, LogIn,
} from 'lucide-react';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import SEO from '../components/SEO';

const TAGS_MAP = {
  generale:     { label: '💬 Generale',     color: 'var(--text-muted)' },
  giochi:       { label: '🎮 Giochi',       color: 'var(--accent-twitch)' },
  stream:       { label: '📺 Stream',       color: '#9146FF' },
  tech:         { label: '🤖 Tech & IA',    color: 'var(--secondary)' },
  meme:         { label: '😂 Meme',         color: 'var(--accent-warm)' },
  suggerimenti: { label: '💡 Suggerimenti', color: 'var(--primary)' },
};

function tagInfo(value) {
  return TAGS_MAP[value] || TAGS_MAP.generale;
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

function formatDate(ts) {
  return new Date(Number(ts)).toLocaleDateString('it-IT', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const up = (delay = 0) => ({
  initial:    { opacity: 0, y: 16 },
  animate:    { opacity: 1, y: 0 },
  transition: { delay, type: 'spring', stiffness: 220, damping: 24 },
});

/* ═══════════════════════════════════════
   REPLY CARD
   ═══════════════════════════════════════ */
function ReplyCard({ reply, canDelete, onDelete }) {
  return (
    <motion.div
      className="community-reply"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24 }}
    >
      <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
        <div className="community-avatar" style={{ width: '32px', height: '32px', minWidth: '32px' }}>
          {reply.authorAvatar ? (
            <img src={reply.authorAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <User size={16} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>
              {reply.authorDisplay || reply.author}
            </span>
            <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>
              {timeAgo(reply.createdAt)}
            </span>
            {canDelete && (
              <button
                className="community-action-btn"
                onClick={() => onDelete(reply.id)}
                style={{ marginLeft: 'auto', color: 'var(--accent)', padding: '2px 6px' }}
                title="Elimina risposta"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {reply.body}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════
   THREAD VIEW PAGE
   ═══════════════════════════════════════ */
export default function ThreadView() {
  const { postId } = useParams();
  const { isLoggedIn, twitchUser, twitchToken, clientId, getTwitchLoginUrl } = useTwitchAuth();

  const [post, setPost] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState('');

  /* ── Fetch post data ── */
  const fetchPost = useCallback(async () => {
    try {
      const headers = {};
      if (twitchToken) headers.Authorization = `Bearer ${twitchToken}`;

      const res = await fetch(`/api/community?limit=1&page=1`, { headers });
      // The list endpoint doesn't support single-post fetch, so we use a workaround:
      // Fetch all and find, OR we fetch from the full timeline
      // Actually let's just fetch all posts and find the one. For a better UX later,
      // we can add a ?id= param to the API. For now, fetch the post hash directly.
    } catch { /* handled below */ }
  }, [twitchToken]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const headers = {};
      if (twitchToken) headers.Authorization = `Bearer ${twitchToken}`;

      // Fetch post list to find our post (paginate through if needed)
      // For simplicity, fetch multiple pages until we find it
      // But actually, posts in the list are returned newest-first.
      // A cleaner approach: fetch the post from a dedicated endpoint.
      // Since we don't have one, we'll scan pages. For a small community this is fine.
      // But let's be smarter: use tag=all and a large limit
      let found = null;
      let pg = 1;
      while (!found && pg <= 10) {
        const res = await fetch(`/api/community?page=${pg}&limit=50`, { headers });
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        found = data.posts.find(p => String(p.id) === String(postId));
        if (data.posts.length === 0 || pg >= data.pages) break;
        pg++;
      }

      if (!found) {
        setError('Post non trovato.');
        setLoading(false);
        return;
      }
      setPost(found);

      // Fetch replies
      const repliesRes = await fetch(`/api/community-replies?postId=${postId}&limit=50`);
      if (repliesRes.ok) {
        const repliesData = await repliesRes.json();
        setReplies(repliesData.replies || []);
      }
    } catch {
      setError('Errore nel caricamento del thread.');
    } finally {
      setLoading(false);
    }
  }, [postId, twitchToken]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Like toggle ── */
  const handleLike = async () => {
    if (!isLoggedIn || !post) return;
    const action = post.liked ? 'unlike' : 'like';
    setPost(prev => ({
      ...prev,
      liked: !prev.liked,
      likeCount: prev.liked ? Math.max(0, prev.likeCount - 1) : prev.likeCount + 1,
    }));
    try {
      await fetch('/api/community', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ postId: post.id, action }),
      });
    } catch {
      setPost(prev => ({
        ...prev,
        liked: post.liked,
        likeCount: post.likeCount,
      }));
    }
  };

  /* ── Submit reply ── */
  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !twitchToken) return;
    setSending(true);
    setReplyError('');
    try {
      const res = await fetch('/api/community-replies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ postId, body: replyText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setReplies(prev => [...prev, data.reply]);
      setReplyText('');
      // Increment reply count on post
      setPost(prev => prev ? { ...prev, replyCount: (prev.replyCount || 0) + 1 } : prev);
    } catch (err) {
      setReplyError(err.message);
    } finally {
      setSending(false);
    }
  };

  /* ── Delete reply ── */
  const handleDeleteReply = async (replyId) => {
    if (!twitchToken) return;
    setReplies(prev => prev.filter(r => r.id !== replyId));
    try {
      await fetch('/api/community-replies', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ replyId }),
      });
      setPost(prev => prev ? { ...prev, replyCount: Math.max(0, (prev.replyCount || 0) - 1) } : prev);
    } catch { /* silent */ }
  };

  /* ── Delete post ── */
  const handleDeletePost = async () => {
    if (!twitchToken || !post) return;
    if (!window.confirm('Sei sicuro di voler eliminare questo post?')) return;
    try {
      await fetch('/api/community', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${twitchToken}`,
        },
        body: JSON.stringify({ postId: post.id }),
      });
      window.location.href = '/community';
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="main-content">
        <div className="skeleton" style={{ height: '200px', borderRadius: 'var(--r-lg)', marginTop: '1rem' }} />
        <div className="skeleton" style={{ height: '80px', borderRadius: 'var(--r-md)', marginTop: '0.75rem' }} />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="main-content">
        <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>😵</p>
          <p style={{ color: 'var(--text-muted)' }}>{error || 'Post non trovato.'}</p>
          <Link to="/community" className="btn btn-ghost" style={{ marginTop: '1rem' }}>
            <ArrowLeft size={15} /> Torna alla Community
          </Link>
        </div>
      </div>
    );
  }

  const tag = tagInfo(post.tag);

  return (
    <div className="main-content">
      <SEO
        title={`${post.title} — Community`}
        description={post.body?.slice(0, 160)}
        path={`/community/${postId}`}
      />

      {/* Back link */}
      <motion.div {...up(0.05)}>
        <Link to="/community" className="community-action-btn" style={{ display: 'inline-flex', gap: '6px', padding: '6px 0', fontSize: '0.84rem', color: 'var(--text-muted)', textDecoration: 'none' }}>
          <ArrowLeft size={16} /> Torna alla Community
        </Link>
      </motion.div>

      {/* Main post */}
      <motion.article className="glass-panel" style={{ padding: '1.5rem 1.6rem' }} {...up(0.1)}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div className="community-avatar" style={{ width: '44px', height: '44px', minWidth: '44px' }}>
            {post.authorAvatar ? (
              <img src={post.authorAvatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <User size={22} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                {post.authorDisplay || post.author}
              </span>
              <span className="chip" style={{
                fontSize: '0.65rem', padding: '2px 8px',
                background: `${tag.color}18`, color: tag.color,
                border: `1px solid ${tag.color}30`,
              }}>
                {tag.label}
              </span>
            </div>

            <h1 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 4px', lineHeight: 1.3, fontFamily: "'Space Grotesk', 'Outfit', sans-serif" }}>
              {post.title}
            </h1>

            <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
              <Clock size={11} style={{ verticalAlign: '-1px' }} /> {formatDate(post.createdAt)}
            </span>
          </div>
        </div>

        {/* Body */}
        <div style={{ marginTop: '1.2rem', fontSize: '0.92rem', color: 'var(--text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {post.body}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '1.2rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)', alignItems: 'center' }}>
          <button
            className="community-action-btn"
            onClick={handleLike}
            disabled={!isLoggedIn}
            title={isLoggedIn ? (post.liked ? 'Togli like' : 'Metti like') : 'Accedi per mettere like'}
          >
            <Heart size={16} fill={post.liked ? 'var(--accent)' : 'none'} color={post.liked ? 'var(--accent)' : 'var(--text-faint)'} />
            <span>{post.likeCount || 0}</span>
          </button>
          <span className="community-action-btn" style={{ pointerEvents: 'none' }}>
            <MessageSquare size={16} color="var(--text-faint)" />
            <span>{replies.length}</span>
          </span>
          {isLoggedIn && post.author === twitchUser && (
            <button
              className="community-action-btn"
              onClick={handleDeletePost}
              style={{ marginLeft: 'auto', color: 'var(--accent)' }}
              title="Elimina post"
            >
              <Trash2 size={15} /> Elimina
            </button>
          )}
        </div>
      </motion.article>

      {/* Replies section */}
      <motion.div {...up(0.18)}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={16} /> Risposte ({replies.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <AnimatePresence mode="popLayout">
            {replies.map(r => (
              <ReplyCard
                key={r.id}
                reply={r}
                canDelete={isLoggedIn && r.author === twitchUser}
                onDelete={handleDeleteReply}
              />
            ))}
          </AnimatePresence>

          {replies.length === 0 && (
            <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-faint)', fontSize: '0.85rem' }}>
              Nessuna risposta ancora. Sii il primo a rispondere!
            </div>
          )}
        </div>
      </motion.div>

      {/* Reply form */}
      <motion.div {...up(0.24)}>
        {isLoggedIn ? (
          <form onSubmit={handleReply} className="glass-panel" style={{ padding: '1rem 1.2rem' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Scrivi una risposta…"
                maxLength={1000}
                rows={2}
                className="community-input community-textarea"
                style={{ flex: 1, marginBottom: 0, resize: 'vertical', minHeight: '60px' }}
                required
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={sending || !replyText.trim()}
                style={{ fontSize: '0.82rem', padding: '0.5rem 1rem', flexShrink: 0 }}
              >
                {sending ? '…' : <Send size={15} />}
              </button>
            </div>
            {replyError && (
              <p style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '6px' }}>{replyError}</p>
            )}
          </form>
        ) : clientId ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '1.2rem' }}>
            <a href={getTwitchLoginUrl(`/community/${postId}`)} className="btn" style={{
              background: 'linear-gradient(135deg,#9146FF,#c800ff)',
              color: '#fff', fontSize: '0.82rem',
              boxShadow: '0 4px 16px rgba(145,70,255,.3)',
            }}>
              <Twitch size={14} /> Accedi con Twitch per rispondere
            </a>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}
