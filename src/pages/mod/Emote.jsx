/**
 * Emote.jsx — Gestione emote Twitch + 7TV.
 *
 * 2 tab:
 *   Tab "Twitch": lista emote canale (usa useEmoteTwitch hook), filtri per tier/tipo/animate
 *   Tab "7TV": GET /api/mod-emotes?action=seventv_status + lista emote 7TV canale
 *     + search 7TV + add/remove/rename + set token (broadcaster only)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smile, Twitch as TwitchIcon, Search, Plus, Trash2, Loader, RefreshCw,
  Edit2, Check, X, AlertTriangle, ExternalLink, Info, Zap, Sparkles,
  Upload, Image as ImageIcon,
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

  // Upload custom emote
  const [uploadFile, setUploadFile] = useState(null);            // File originale
  const [uploadName, setUploadName] = useState('');              // Nome emote
  const [uploadOriginalDim, setUploadOriginalDim] = useState(null); // { w, h, hasAlpha, animata }
  const [uploadPad, setUploadPad] = useState(true);              // Applica padding a quadrato
  const [uploadPreviewUrl, setUploadPreviewUrl] = useState(null);// blob: URL della preview elaborata
  const [uploadProcessedBlob, setUploadProcessedBlob] = useState(null); // Blob da inviare
  const [uploadProcessing, setUploadProcessing] = useState(false);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const fileInputRef = useRef(null);

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

  /* ─── Upload custom emote ────────────────────────────────────────────────── */

  // Reset stato upload (mantiene file/name a discrezione)
  const resetUploadProcessing = useCallback(() => {
    setUploadProcessedBlob(null);
    if (uploadPreviewUrl) {
      try { URL.revokeObjectURL(uploadPreviewUrl); } catch { /* ignore */ }
    }
    setUploadPreviewUrl(null);
  }, [uploadPreviewUrl]);

  const resetUploadAll = useCallback(() => {
    setUploadFile(null);
    setUploadName('');
    setUploadOriginalDim(null);
    setUploadPad(true);
    resetUploadProcessing();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [resetUploadProcessing]);

  // Quando cambia il file: leggi metadata (dimensioni, alpha, animata)
  useEffect(() => {
    if (!uploadFile) {
      setUploadOriginalDim(null);
      resetUploadProcessing();
      return;
    }
    let cancelled = false;
    const ct = (uploadFile.type || '').toLowerCase();
    // Tipi animati che NON possiamo ri-elaborare con un canvas singolo (frame multipli).
    const animata = ct === 'image/gif' || ct === 'image/apng';
    // Per WebP non possiamo sapere a priori se è animato senza parsing — assumiamo statico.

    const url = URL.createObjectURL(uploadFile);
    const img = new Image();
    img.onload = () => {
      if (cancelled) { URL.revokeObjectURL(url); return; }
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      // Rileva alpha disegnando su canvas e campionando
      let hasAlpha = false;
      if (!animata && w > 0 && h > 0) {
        try {
          // Campioniamo a max 64x64 per costare poco
          const sw = Math.min(64, w);
          const sh = Math.min(64, h);
          const c = document.createElement('canvas');
          c.width = sw; c.height = sh;
          const ctx = c.getContext('2d', { willReadFrequently: true });
          ctx.clearRect(0, 0, sw, sh);
          ctx.drawImage(img, 0, 0, sw, sh);
          const data = ctx.getImageData(0, 0, sw, sh).data;
          // Soglia 250 (non 255) per tollerare il rumore introdotto da decoder
          // JPEG/WebP che possono produrre alfa 254 anche su immagini "opache".
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 250) { hasAlpha = true; break; }
          }
        } catch { /* ignore */ }
      } else if (animata) {
        // GIF/APNG hanno alpha 1-bit — assumiamo presente
        hasAlpha = true;
      }
      setUploadOriginalDim({ w, h, hasAlpha, animata, mime: ct });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      if (!cancelled) {
        toast.error('Impossibile leggere l\'immagine.', { titolo: 'Upload 7TV' });
        resetUploadAll();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
    return () => { cancelled = true; };
  }, [uploadFile, toast, resetUploadAll, resetUploadProcessing]);

  // Quando cambiano file/dim/pad: produci il blob processato + preview
  useEffect(() => {
    if (!uploadFile || !uploadOriginalDim) {
      resetUploadProcessing();
      return;
    }
    const { w, h, animata } = uploadOriginalDim;
    // Per animate o se padding disattivato (oppure già quadrata): usa file originale
    const isSquare = w === h;
    if (animata || !uploadPad || isSquare) {
      const url = URL.createObjectURL(uploadFile);
      setUploadProcessedBlob(uploadFile);
      setUploadPreviewUrl(prev => {
        if (prev) { try { URL.revokeObjectURL(prev); } catch { /* ignore */ } }
        return url;
      });
      return;
    }
    // Altrimenti: pad a quadrato su canvas trasparente
    let cancelled = false;
    setUploadProcessing(true);
    const url = URL.createObjectURL(uploadFile);
    const img = new Image();
    img.onload = () => {
      if (cancelled) { URL.revokeObjectURL(url); return; }
      const target = Math.max(w, h);
      const c = document.createElement('canvas');
      c.width = target;
      c.height = target;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, target, target); // sfondo trasparente (preserva alpha)
      const dx = Math.floor((target - w) / 2);
      const dy = Math.floor((target - h) / 2);
      ctx.drawImage(img, dx, dy, w, h);
      // Serializza in PNG per preservare l'alpha (sempre, anche se il file originale era JPEG)
      c.toBlob(blob => {
        URL.revokeObjectURL(url);
        if (cancelled) return;
        if (!blob) {
          toast.error('Elaborazione immagine fallita.', { titolo: 'Upload 7TV' });
          setUploadProcessing(false);
          return;
        }
        const previewUrl = URL.createObjectURL(blob);
        setUploadProcessedBlob(blob);
        setUploadPreviewUrl(prev => {
          if (prev) { try { URL.revokeObjectURL(prev); } catch { /* ignore */ } }
          return previewUrl;
        });
        setUploadProcessing(false);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      if (!cancelled) {
        toast.error('Lettura immagine fallita.', { titolo: 'Upload 7TV' });
        setUploadProcessing(false);
      }
    };
    img.src = url;
    return () => { cancelled = true; URL.revokeObjectURL(url); };
    // mime non usato direttamente ma incluso per riprocessare se cambia tipo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadFile, uploadOriginalDim, uploadPad]);

  // Cleanup blob URL alla smount
  useEffect(() => {
    return () => {
      if (uploadPreviewUrl) {
        try { URL.revokeObjectURL(uploadPreviewUrl); } catch { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPickFile = useCallback((file) => {
    if (!file) return;
    const ct = (file.type || '').toLowerCase();
    const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/apng', 'image/avif'];
    if (!allowed.includes(ct)) {
      toast.error('Formato non supportato. Usa PNG, JPEG, WebP, GIF, APNG o AVIF.', { titolo: 'Upload 7TV' });
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error(`Immagine troppo grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 6 MB.`, { titolo: 'Upload 7TV' });
      return;
    }
    setUploadFile(file);
    // Auto-suggest name dal filename
    if (!uploadName) {
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 25);
      if (base.length >= 2) setUploadName(base);
    }
  }, [toast, uploadName]);

  const submitUpload = useCallback(async () => {
    if (!uploadProcessedBlob || !uploadName.trim()) return;
    if (!/^[A-Za-z0-9_-]{2,25}$/.test(uploadName.trim())) {
      toast.error('Nome non valido. 2-25 caratteri tra lettere, numeri, "_" e "-".', { titolo: 'Upload 7TV' });
      return;
    }
    setUploadSubmitting(true);
    try {
      // Converti blob → base64
      const dataBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== 'string') return reject(new Error('Lettura fallita'));
          // result = "data:<mime>;base64,XXXXX"
          const idx = result.indexOf('base64,');
          resolve(idx >= 0 ? result.slice(idx + 7) : result);
        };
        reader.onerror = () => reject(new Error('Lettura fallita'));
        reader.readAsDataURL(uploadProcessedBlob);
      });
      const r = await modPost('/api/mod-emotes', token, {
        action: 'seventv_upload',
        name: uploadName.trim(),
        contentType: uploadProcessedBlob.type || 'image/png',
        dataBase64,
        addToSet: true,
      });
      if (r.ok) {
        if (r.data?.added === false && r.data?.addError) {
          toast.warning(`Emote caricata ma non aggiunta al set: ${r.data.addError}`, { titolo: '⚠️ 7TV' });
        } else {
          toast.success(`Emote ${uploadName.trim()} caricata e aggiunta!`, { titolo: '✨ 7TV' });
        }
        resetUploadAll();
        await loadSeventvStatus();
      } else {
        toast.error(r.error || 'Upload fallito.', { titolo: 'Upload 7TV' });
      }
    } catch (e) {
      toast.error(e.message || 'Errore durante l\'upload.', { titolo: 'Upload 7TV' });
    } finally {
      setUploadSubmitting(false);
    }
  }, [uploadProcessedBlob, uploadName, token, toast, resetUploadAll, loadSeventvStatus]);

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
                            src={emote.url || emote.url2x}
                            srcSet={emote.url && emote.url2x ? `${emote.url} 1x, ${emote.url2x} 2x` : undefined}
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

              {/* Upload custom emote */}
              {tokenPresent && (
                <div className="glass-card" style={{ padding: '1rem' }}>
                  <h3 style={{ fontSize: '0.88rem', fontWeight: 600, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <Upload size={14} style={{ color: 'var(--primary)' }} />
                    Carica emote custom
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                    Trascina o seleziona un'immagine (PNG, JPEG, WebP, GIF, APNG, AVIF — max 6&nbsp;MB).
                    Se l'immagine non è quadrata, può essere automaticamente <strong>centrata su sfondo trasparente</strong> senza stretchare.
                  </p>

                  {!uploadFile ? (
                    <label
                      htmlFor="seventv-upload-input"
                      className="glass-card"
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                        padding: '1.5rem 1rem', textAlign: 'center', cursor: 'pointer',
                        borderStyle: 'dashed', borderWidth: '1.5px',
                      }}
                    >
                      <ImageIcon size={28} style={{ color: 'var(--text-muted)' }} />
                      <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>Scegli un file immagine</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        PNG · JPEG · WebP · GIF · APNG · AVIF
                      </div>
                      <input
                        id="seventv-upload-input"
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/apng,image/avif"
                        onChange={(e) => onPickFile(e.target.files?.[0])}
                        style={{ display: 'none' }}
                      />
                    </label>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {/* Preview + info */}
                      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                        <div
                          className="glass-card"
                          style={{
                            width: 96, height: 96, padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: 'repeating-conic-gradient(rgba(255,255,255,0.08) 0% 25%, transparent 0% 50%) 50% / 16px 16px',
                            position: 'relative', flexShrink: 0,
                          }}
                          aria-label="Anteprima emote"
                        >
                          {uploadProcessing ? (
                            <Loader size={20} className="spin" style={{ color: 'var(--primary)' }} />
                          ) : uploadPreviewUrl ? (
                            <img
                              src={uploadPreviewUrl}
                              alt="Anteprima"
                              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                            />
                          ) : null}
                        </div>
                        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="chip" style={{ fontSize: '0.7rem' }}>
                              {uploadFile.name}
                            </span>
                            <span className="chip" style={{ fontSize: '0.7rem' }}>
                              {(uploadFile.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                          {uploadOriginalDim && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', color: 'var(--text-muted)' }}>
                              <span>{uploadOriginalDim.w} × {uploadOriginalDim.h}px</span>
                              {uploadOriginalDim.w === uploadOriginalDim.h && <span>· quadrata</span>}
                              {uploadOriginalDim.hasAlpha && <span>· trasparenza ✓</span>}
                              {uploadOriginalDim.animata && <span>· animata</span>}
                            </div>
                          )}
                          {uploadOriginalDim && uploadOriginalDim.w !== uploadOriginalDim.h && !uploadOriginalDim.animata && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', marginTop: '0.2rem' }}>
                              <input
                                type="checkbox"
                                checked={uploadPad}
                                onChange={(e) => setUploadPad(e.target.checked)}
                              />
                              <span>Pad a quadrato {Math.max(uploadOriginalDim.w, uploadOriginalDim.h)}×{Math.max(uploadOriginalDim.w, uploadOriginalDim.h)} (sfondo trasparente)</span>
                            </label>
                          )}
                          {uploadOriginalDim?.animata && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--accent-warm)', fontSize: '0.7rem' }}>
                              <Info size={11} />
                              <span>Le immagini animate vengono caricate come sono (no padding).</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Nome */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem', display: 'block' }}>
                          Nome emote
                        </label>
                        <input
                          className="mod-input"
                          value={uploadName}
                          onChange={(e) => setUploadName(e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 25))}
                          placeholder="MyCoolEmote"
                          maxLength={25}
                          style={{ marginTop: 0 }}
                        />
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          2-25 caratteri: lettere, numeri, &quot;_&quot;, &quot;-&quot;.
                        </div>
                      </div>

                      {/* Azioni */}
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          className="btn-primary"
                          onClick={submitUpload}
                          disabled={
                            uploadSubmitting || uploadProcessing || !uploadProcessedBlob ||
                            !/^[A-Za-z0-9_-]{2,25}$/.test(uploadName.trim())
                          }
                          style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          {uploadSubmitting
                            ? <Loader size={13} className="spin" />
                            : <Upload size={13} />}
                          Carica e aggiungi al canale
                        </button>
                        <button
                          className="mod-permission-btn"
                          onClick={resetUploadAll}
                          disabled={uploadSubmitting}
                          style={{ fontSize: '0.8rem', padding: '0.45rem 0.75rem' }}
                        >
                          <X size={13} /> Annulla
                        </button>
                      </div>
                    </div>
                  )}
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
