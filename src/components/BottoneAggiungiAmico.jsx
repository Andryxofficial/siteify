import { useState, useEffect, useCallback } from 'react';
import { UserPlus, UserCheck, Clock, Loader } from 'lucide-react';

/**
 * Inline "Add friend" button shown next to post/reply author names.
 * Checks friendship status via the friends API and shows contextual icons:
 *   - UserPlus → can send friend request
 *   - UserCheck → already friends / accept incoming
 *   - Clock → request pending
 *   - Loader → checking status
 * Hidden for the user's own posts.
 */
export default function BottoneAggiungiAmico({ targetUser, twitchToken, currentUser }) {
  const [stato, setStato] = useState(null); // null | 'loading' | 'self' | 'friends' | 'pending' | 'incoming' | 'none' | 'sent' | 'error'

  const controlla = useCallback(async () => {
    if (!twitchToken || !targetUser || !currentUser) return;
    if (targetUser.toLowerCase() === currentUser.toLowerCase()) {
      setStato('self');
      return;
    }
    setStato('loading');
    try {
      const res = await fetch(`/api/friends?user=${encodeURIComponent(targetUser)}`, {
        headers: { Authorization: `Bearer ${twitchToken}` },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setStato(data.status || 'none');
    } catch {
      setStato('error');
    }
  }, [twitchToken, targetUser, currentUser]);

  useEffect(() => { controlla(); }, [controlla]);

  const inviaRichiesta = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!twitchToken) return;
    setStato('loading');
    try {
      const res = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'send', target: targetUser }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setStato(data.action === 'accepted' ? 'friends' : 'sent');
    } catch {
      setStato('error');
    }
  };

  // Don't show for self or when not logged in
  if (!currentUser || stato === 'self' || stato === null) return null;

  if (stato === 'loading') {
    return (
      <span className="social-btn-azione social-btn-add-friend" title="Caricamento…" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
        <Loader size={12} className="spin" />
      </span>
    );
  }

  if (stato === 'friends') {
    return (
      <span className="social-btn-azione social-btn-add-friend social-friend-ok" title="Già amici" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
        <UserCheck size={12} />
      </span>
    );
  }

  if (stato === 'pending' || stato === 'sent') {
    return (
      <span className="social-btn-azione social-btn-add-friend social-friend-pending" title="Richiesta inviata" onClick={e => { e.preventDefault(); e.stopPropagation(); }}>
        <Clock size={12} />
      </span>
    );
  }

  if (stato === 'incoming') {
    return (
      <button className="social-btn-azione social-btn-add-friend social-friend-accept" title="Accetta richiesta di amicizia" onClick={inviaRichiesta}>
        <UserCheck size={12} />
      </button>
    );
  }

  // stato === 'none' or 'error'
  return (
    <button className="social-btn-azione social-btn-add-friend" title="Aggiungi amico" onClick={inviaRichiesta}>
      <UserPlus size={12} />
    </button>
  );
}
