/**
 * Emote.jsx — Gestione emote Twitch + 7TV.
 *
 * 2 tab:
 *   Tab "Twitch": lista emote canale (usa useEmoteTwitch hook), filtri per tier/tipo/animate
 *   Tab "7TV": GET /api/mod-emotes?action=seventv_status + lista emote 7TV canale
 *     + search 7TV + add/remove/rename + set token (broadcaster only)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smile, Twitch as TwitchIcon, Search, Plus, Trash2, Loader, RefreshCw,
  Edit2, Check, X, AlertTriangle, ExternalLink, Info, Zap, Sparkles,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { useEmoteTwitch } from '../../hooks/useEmoteTwitch';
import { modGet, modPost } from '../../utils/modApi';
import { useTwitchAuth } from '../../contexts/TwitchAuthContext';

/** Icona 7TV stilizzata */
function SevenTVIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"
      xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.5 4.5h7.2L8.3 19.5h3.4L16 4.5h2.5l-4.3 15h-7l4.4-15z" />
    </svg>
  );
}

const TIER_LABELS = {
  1000: { label: 'Tier 1', color: 'var(--accent-twitch)' },
  2000: { label: 'Tier 2', color: 'var(--accent-warm)' },
  3000: { label: 'Tier 3', color: 'var(--accent-spotify)' },
};

export default function Emote({ token }) {
  const toast = useToast();
  const { twitchToken, twitchUser } = useTwitchAuth();
  const { emoteCanale, caricamento: emoteTwitchLoading } = useEmoteTwitch(twitchToken);

  const [tab, setTab] = useState('twitch'); // 'twitch' | 'seventv'
  const [searchTwitch, setSearchTwitch] = useState('');
  const [filterAnimate, setFilterAnimate] = useState(false);

  // 7TV
  const [seventvStatus, setSeventvStatus] = useState(null);
  const [seventvLoading, setSeventvLoading] = useState(true);
  const [seventvSearch, setSeventvSearch] = useState('');
  const [seventvResults, setSeventvResults] = useState([]);
  const [seventvSearching, setSeventvSearching] = useState(false);
  const [seventvActionLoading, setSeventvActionLoading] = useState(null);
  const [tokenInput, setTokenInput] = useState('');
  const [tokenSaving, setTokenSaving] = useState(false);
  const [renameId, setRenameId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);

  // isBroadcaster viene determinato dall'API in seventv_status response
  // (TwitchAuthContext non espone broadcasterId, lo sa solo il backend).
  const isBroadcaster = seventvStatus?.isBroadcaster === true;

  const loadSeventvStatus = useCallback(async () => {
    setSeventvLoading(true);
    const r = await modGet('/api/mod-emotes?action=seventv_status', token);
    if (r.ok) {
      setSeventvStatus(r.data);
    } else {
      toast.error(r.error, { titolo: '7TV Status' });
    }
    setSeventvLoading(false);
  }, [token, toast]);

  useEffect(() => {
    if (tab === 'seventv') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadSeventvStatus();
    }
  }, [tab, loadSeventvStatus]);

  const searchSeventv = useCallback(async () => {
    if (!seventvSearch.trim()) {
      setSeventvResults([]);
      return;
    }
    setSeventvSearching(true);
    const r = await modGet(`/api/mod-emotes?action=seventv_search&q=${encodeURIComponent(seventvSearch.trim())}`, token);
    if (r.ok) {
      setSeventvResults(r.data?.emotes || []);
    } else {
      toast.error(r.error, { titolo: 'Ricerca 7TV' });
    }
    setSeventvSearching(false);
  }, [seventvSearch, token, toast]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (seventvSearch.trim()) searchSeventv();
    }, 600);
    return () => clearTimeout(debounce);
  }, [seventvSearch, searchSeventv]);

  const addSeventvEmote = useCallback(async (emote) => {
    setSeventvActionLoading(emote.id);
    const r = await modPost('/api/mod-emotes', token, {
      action: 'seventv_add',
      emote_id: emote.id,
      name: emote.name,
    });
    if (r.ok) {
      toast.success(`Emote ${emote.name} aggiunta!`, { titolo: '✨ 7TV' });
      await loadSeventvStatus();
    } else {
      if (r.code === 'seventv_token_missing') {
        toast.error('Token 7TV non configurato. Solo il broadcaster può impostarlo.', { titolo: '7TV' });
      } else {
        toast.error(r.error, { titolo: 'Aggiungi Emote' });
      }
    }
    setSeventvActionLoading(null);
  }, [token, toast, loadSeventvStatus]);

  const removeSeventvEmote = useCallback(async (emote) => {
    setSeventvActionLoading(emote.id);
    const r = await modPost('/api/mod-emotes', token, {
      action: 'seventv_remove',
      emote_id: emote.id,
    });
    if (r.ok) {
      toast.success(`Emote ${emote.nome} rimossa.`, { titolo: '🗑️ 7TV' });
      await loadSeventvStatus();
    } else {
      toast.error(r.error, { titolo: 'Rimozione fallita' });
    }
    setSeventvActionLoading(null);
  }, [token, toast, loadSeventvStatus]);

  const renameSeventvEmote = useCallback(async (emote) => {
    if (!renameValue.trim()) return;
    setRenameSaving(true);
    const r = await modPost('/api/mod-emotes', token, {
      action: 'seventv_rename',
      emote_id: emote.id,
      name: renameValue.trim(),
    });
    if (r.ok) {
      toast.success(`Emote rinominata in ${renameValue.trim()}`, { titolo: '✏️ 7TV' });
      setRenameId(null);
      setRenameValue('');
      await loadSeventvStatus();
    } else {
      toast.error(r.error, { titolo: 'Rinomina fallita' });
    }
    setRenameSaving(false);
  }, [renameValue, token, toast, loadSeventvStatus]);

  const setSeventvToken = useCallback(async () => {
    if (!tokenInput.trim()) return;
    setTokenSaving(true);
    const r = await modPost('/api/mod-emotes', token, {
      action: 'seventv_set_token',
      token: tokenInput.trim(),
    });
    if (r.ok) {
      toast.success('Token 7TV salvato!', { titolo: '✅ 7TV' });
      setTokenInput('');
      await loadSeventvStatus();
    } else {
      toast.error(r.error, { titolo: 'Token 7TV' });
    }
    setTokenSaving(false);
  }, [tokenInput, token, toast, loadSeventvStatus]);

  // Filtra emote Twitch
  const filteredTwitchEmotes = useMemo(() => {
    let list = emoteCanale || [];
    if (searchTwitch.trim()) {
      const q = searchTwitch.toLowerCase();
      list = list.filter(e => e.nome.toLowerCase().includes(q));
    }
    if (filterAnimate) {
      list = list.filter(e => e.animata);
    }
    return list;
  }, [emoteCanale, searchTwitch, filterAnimate]);

  // Group per tier/tipo
  const groupedTwitch = useMemo(() => {
    const groups = {};
    filteredTwitchEmotes.forEach(e => {
      const key = e.tier ? `tier_${e.tier}` : e.tipo || 'other';
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    return groups;
  }, [filteredTwitchEmotes]);

  const seventvEmoteList = seventvStatus?.emotes || [];
  const tokenPresent = seventvStatus?.tokenPresent;
  const setInfo = seventvStatus?.set;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, flex: 1 }}>
          <Smile size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem', color: 'var(--primary)' }} />
          Gestione Emote
        </h2>
      </div>

      {/* Tab switcher */}
      <div className="glass-card" style={{ padding: '0.5rem', display: 'flex', gap: '0.35rem' }}>
        <button
          onClick={() => setTab('twitch')}
          className={`mod-permission-btn${tab === 'twitch' ? ' mod-permission-btn-active' : ''}`}
          style={{ flex: 1 }}
        >
          <TwitchIcon size={13} /> Twitch
        </button>
        <button
          onClick={() => setTab('seventv')}
          className={`mod-permission-btn${tab === 'seventv' ? ' mod-permission-btn-active' : ''}`}
          style={{ flex: 1 }}
        >
          <SevenTVIcon size={13} /> 7TV
        </button>
      </div>

      {/* Tab Twitch */}
      {tab === 'twitch' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {/* Filtri */}
          <div className="glass-card" style={{ padding: '0.65rem 0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              className="mod-input"
              value={searchTwitch}
              onChange={e => setSearchTwitch(e.target.value)}
              placeholder="Cerca emote..."
              style={{ marginTop: 0, flex: 1, minWidth: 180 }}
            />
            <button
              onClick={() => setFilterAnimate(!filterAnimate)}
              className={`mod-permission-btn${filterAnimate ? ' mod-permission-btn-active' : ''}`}
              style={{ fontSize: '0.75rem', padding: '0.35rem 0.6rem' }}
            >
              <Sparkles size={11} /> Solo animate
            </button>
          </div>

          {emoteTwitchLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Loader size={28} className="spin" style={{ color: 'var(--accent-twitch)' }} />
            </div>
          ) : filteredTwitchEmotes.length === 0 ? (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
              <Smile size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {searchTwitch || filterAnimate ? 'Nessuna emote trovata.' : 'Nessuna emote Twitch sul canale.'}
              </p>
            </div>
          ) : (
            Object.keys(groupedTwitch).map(groupKey => {
              const list = groupedTwitch[groupKey];
              let groupLabel = groupKey;
              let groupColor = 'var(--secondary)';
              if (groupKey.startsWith('tier_')) {
                const tier = Number(groupKey.replace('tier_', ''));
                const info = TIER_LABELS[tier];
                if (info) {
                  groupLabel = info.label;
                  groupColor = info.color;
                }
              } else if (groupKey === 'follower') {
                groupLabel = 'Follower';
                groupColor = 'var(--accent-spotify)';
              } else if (groupKey === 'bitstier') {
                groupLabel = 'Bit Tier';
                groupColor = 'var(--accent-warm)';
              }
              return (
                <div key={groupKey} className="glass-card" style={{ padding: '1rem' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.65rem', color: groupColor }}>
                    {groupLabel} <span style={{ fontWeight: 400, opacity: 0.7 }}>({list.length})</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '0.5rem' }}>
                    {list.map(e => (
                      <div key={e.id} className="glass-card" style={{ padding: '0.5rem', textAlign: 'center', position: 'relative' }}>
                        <img
                          src={e.url}
                          srcSet={`${e.url} 1x, ${e.url2x} 2x`}
                          alt={e.nome}
                          title={e.nome}
                          loading="lazy"
                          decoding="async"
                          style={{ width: 48, height: 48, objectFit: 'contain', display: 'block', margin: '0 auto 0.3rem' }}
                        />
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {e.nome}
                        </div>
                        {e.animata && (
                          <span
                            aria-hidden="true"
                            title="Animata"
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: 'var(--accent-warm)',
                              boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 7TV */}
      {tab === 'seventv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {seventvLoading ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <Loader size={28} className="spin" style={{ color: 'var(--primary)' }} />
            </div>
          ) : (
            <>
              {/* Token config (broadcaster only) */}
              {!tokenPresent && isBroadcaster && (
                <div className="glass-card" style={{ padding: '1rem', borderColor: 'rgba(255,184,108,0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
                    <AlertTriangle size={14} style={{ color: 'var(--accent-warm)' }} />
                    <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>Token 7TV non configurato</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.65rem', lineHeight: 1.4 }}>
                    Per gestire le emote 7TV serve un token personale. Ottienilo da{' '}
                    <a href="https://7tv.app/settings" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>
                      7tv.app/settings <ExternalLink size={10} style={{ verticalAlign: 'middle' }} />
                    </a>
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="mod-input"
                      type="password"
                      value={tokenInput}
                      onChange={e => setTokenInput(e.target.value)}
                      placeholder="Token 7TV (segreto)"
                      style={{ flex: 1, marginTop: 0 }}
                    />
                    <button
                      className="btn-primary"
                      onClick={setSeventvToken}
                      disabled={tokenSaving || !tokenInput.trim()}
                      style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                    >
                      {tokenSaving ? <Loader size={13} className="spin" /> : <Check size={13} />}
                      Salva
                    </button>
                  </div>
                </div>
              )}

              {!tokenPresent && !isBroadcaster && (
                <div className="glass-card" style={{ padding: '1rem', borderColor: 'rgba(255,184,108,0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Info size={14} style={{ color: 'var(--accent-warm)' }} />
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Il broadcaster deve configurare il token 7TV per abilitare la gestione emote.
                    </span>
                  </div>
                </div>
              )}

              {/* Slot indicator */}
              {setInfo && (
                <div className="glass-card" style={{ padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Zap size={14} style={{ color: 'var(--primary)' }} />
                  <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500 }}>
                    {setInfo.name || 'Emote Set'}
                  </span>
                  <span className="chip" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {setInfo.count} / {setInfo.capacity} slot
                  </span>
                </div>
              )}

              {/* Emote canale correnti */}
              {seventvEmoteList.length > 0 && (
                <div className="glass-card" style={{ padding: '1rem' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.65rem' }}>
                    Emote 7TV Canale ({seventvEmoteList.length})
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.5rem' }}>
                    {seventvEmoteList.map(emote => {
                      const isRenaming = renameId === emote.id;
                      return (
                        <div key={emote.id} className="glass-card" style={{ padding: '0.5rem', textAlign: 'center', position: 'relative' }}>
                          <img
                            src={emote.url2x || emote.url}
                            srcSet={`${emote.url || emote.url2x} 1x, ${emote.url2x || emote.url} 2x`}
                            alt={emote.nome}
                            title={emote.nome}
                            loading="lazy"
                            decoding="async"
                            style={{ width: 48, height: 48, objectFit: 'contain', display: 'block', margin: '0 auto 0.3rem' }}
                          />
                          {isRenaming ? (
                            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.3rem' }}>
                              <input
                                className="mod-input"
                                value={renameValue}
                                onChange={ev => setRenameValue(ev.target.value)}
                                onKeyDown={ev => ev.key === 'Enter' && renameSeventvEmote(emote)}
                                placeholder={emote.nome}
                                style={{ fontSize: '0.7rem', padding: '0.2rem 0.3rem', marginTop: 0 }}
                              />
                              <button
                                className="mod-icon-btn"
                                onClick={() => renameSeventvEmote(emote)}
                                disabled={renameSaving}
                                style={{ padding: '0.2rem' }}
                              >
                                {renameSaving ? <Loader size={10} className="spin" /> : <Check size={10} />}
                              </button>
                              <button
                                className="mod-icon-btn"
                                onClick={() => { setRenameId(null); setRenameValue(''); }}
                                style={{ padding: '0.2rem' }}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.3rem' }}>
                                {emote.nome}
                              </div>
                              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                <button
                                  className="mod-icon-btn"
                                  onClick={() => { setRenameId(emote.id); setRenameValue(emote.nome); }}
                                  disabled={seventvActionLoading === emote.id}
                                  title="Rinomina"
                                  style={{ padding: '0.2rem' }}
                                >
                                  <Edit2 size={10} />
                                </button>
                                <button
                                  className="mod-icon-btn mod-icon-btn-danger"
                                  onClick={() => removeSeventvEmote(emote)}
                                  disabled={seventvActionLoading === emote.id}
                                  title="Rimuovi"
                                  style={{ padding: '0.2rem' }}
                                >
                                  {seventvActionLoading === emote.id ? <Loader size={10} className="spin" /> : <Trash2 size={10} />}
                                </button>
                              </div>
                            </>
                          )}
                          {emote.animata && (
                            <span
                              aria-hidden="true"
                              title="Animata"
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: 'var(--accent-warm)',
                                boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ricerca 7TV */}
              {tokenPresent && (
                <div className="glass-card" style={{ padding: '1rem' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.65rem' }}>
                    Aggiungi Emote 7TV
                  </h3>
                  <div className="glass-card" style={{ padding: '0.65rem 0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    <input
                      className="mod-input"
                      value={seventvSearch}
                      onChange={e => setSeventvSearch(e.target.value)}
                      placeholder="Cerca emote pubbliche..."
                      style={{ marginTop: 0, flex: 1 }}
                    />
                    {seventvSearching && <Loader size={13} className="spin" />}
                  </div>
                  {seventvResults.length === 0 && seventvSearch.trim() && !seventvSearching && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                      Nessun risultato per "{seventvSearch}".
                    </p>
                  )}
                  {seventvResults.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '0.5rem' }}>
                      {seventvResults.map(e => (
                        <div key={e.id} className="glass-card" style={{ padding: '0.5rem', textAlign: 'center', position: 'relative' }}>
                          <img
                            src={e.preview || e.preview4x}
                            alt={e.name}
                            title={e.owner ? `${e.name} by ${e.owner}` : e.name}
                            loading="lazy"
                            decoding="async"
                            style={{ width: 48, height: 48, objectFit: 'contain', display: 'block', margin: '0 auto 0.3rem' }}
                          />
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.3rem' }}>
                            {e.name}
                          </div>
                          <button
                            className="btn-primary"
                            onClick={() => addSeventvEmote(e)}
                            disabled={seventvActionLoading === e.id}
                            style={{ fontSize: '0.7rem', padding: '0.25rem 0.4rem', width: '100%' }}
                          >
                            {seventvActionLoading === e.id ? <Loader size={10} className="spin" /> : <Plus size={10} />}
                          </button>
                          {e.animated && (
                            <span
                              aria-hidden="true"
                              title="Animata"
                              style={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: 'var(--accent-warm)',
                                boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                              }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
