/**
 * Users.jsx — Gestione Mods / VIP / Sub / Banned del canale.
 *
 * Tab interne:
 *   • Moderatori — promuovi/rimuovi (richiede broadcaster)
 *   • VIP        — promuovi/rimuovi
 *   • Subscriber — sola lettura
 *   • Bannati    — rimuovi ban (un-ban)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Crown, Star, Ban, UserPlus, UserMinus, Search,
  Loader, RefreshCw,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

const API_USERS      = '/api/mod-users';
const API_MODERATION = '/api/mod-moderation';

const TABS = [
  { id: 'mods',   label: 'Mod',       icon: Shield, color: 'var(--accent-twitch)', canAdd: true,  ruolo: 'mod' },
  { id: 'vips',   label: 'VIP',       icon: Crown,  color: 'var(--accent-warm)',   canAdd: true,  ruolo: 'vip' },
  { id: 'subs',   label: 'Sub',       icon: Star,   color: 'var(--accent-spotify)', canAdd: false },
  { id: 'banned', label: 'Bannati',   icon: Ban,    color: 'var(--accent)',         canAdd: false },
];

function tierLabel(t) {
  return t === '3000' ? 'T3' : t === '2000' ? 'T2' : 'T1';
}

export default function Users({ token }) {
  const toast = useToast();
  const [tab,         setTab]         = useState('mods');
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filtro,      setFiltro]      = useState('');
  const [nuovoLogin,  setNuovoLogin]  = useState('');
  const [aggiungendo, setAggiungendo] = useState(false);
  const [rimuovendoId, setRimuovendoId] = useState('');

  const tabInfo = TABS.find(t => t.id === tab) || TABS[0];
  const TabIcon = tabInfo.icon;

  const carica = useCallback(async () => {
    setLoading(true);
    try {
      let dati;
      if (tab === 'banned') {
        const r = await fetch(`${API_MODERATION}?action=banned_users`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error((await r.json()).error || 'Errore');
        dati = await r.json();
        setUsers(dati.users || []);
      } else {
        const r = await fetch(`${API_USERS}?type=${tab}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error((await r.json()).error || 'Errore');
        dati = await r.json();
        setUsers(dati.users || []);
      }
    } catch (e) { toast.error(e.message, { titolo: 'Caricamento fallito' }); }
    finally    { setLoading(false); }
  }, [token, tab, toast]);

  useEffect(() => { carica(); }, [carica]);

  /* ── Aggiungi mod o VIP ── */
  const aggiungi = async () => {
    if (!nuovoLogin.trim() || !tabInfo.canAdd) return;
    setAggiungendo(true);
    try {
      const r = await fetch(API_USERS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'add', role: tabInfo.ruolo, login: nuovoLogin.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      toast.success(`${nuovoLogin.trim()} aggiunto come ${tabInfo.label}.`, { titolo: '✨ Promosso' });
      setNuovoLogin('');
      await carica();
    } catch (e) { toast.error(e.message, { titolo: 'Aggiunta fallita' }); }
    finally    { setAggiungendo(false); }
  };

  /* ── Rimuovi (mod, vip o ban) ── */
  const rimuovi = async (u) => {
    if (!confirm(`Rimuovere ${u.user_name || u.user_login} ${tab === 'banned' ? 'dal ban' : `dai ${tabInfo.label}`}?`)) return;
    setRimuovendoId(u.user_id);
    try {
      if (tab === 'banned') {
        const r = await fetch(API_MODERATION, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'unban', target_user_id: u.user_id }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        toast.success(`${u.user_name} graziato.`, { titolo: '🕊️ Unban' });
      } else {
        const r = await fetch(API_USERS, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'remove', role: tabInfo.ruolo, user_id: u.user_id }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        toast.success(`${u.user_name} rimosso dai ${tabInfo.label}.`);
      }
      await carica();
    } catch (e) { toast.error(e.message, { titolo: 'Operazione fallita' }); }
    finally    { setRimuovendoId(''); }
  };

  const utentiFiltrati = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.user_login || '').toLowerCase().includes(q) ||
      (u.user_name  || '').toLowerCase().includes(q)
    );
  }, [users, filtro]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Tab interne */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const attiva = tab === t.id;
          return (
            <button key={t.id}
              onClick={() => setTab(t.id)}
              className={`mod-tab${attiva ? ' mod-tab-active' : ''}`}
              style={attiva ? { borderColor: `${t.color}55`, color: t.color, background: `${t.color}1a` } : {}}
            >
              <Icon size={13} /> {t.label}
            </button>
          );
        })}
        <button className="mod-icon-btn" onClick={carica} title="Aggiorna" style={{ marginLeft: 'auto' }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Form aggiungi (solo mods e vips) */}
      {tabInfo.canAdd && (
        <motion.div className="glass-panel" style={{ padding: '1rem' }}
          initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <UserPlus size={16} style={{ color: tabInfo.color, flexShrink: 0 }} />
            <input className="mod-input" value={nuovoLogin}
              onChange={e => setNuovoLogin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && aggiungi()}
              placeholder={`Promuovi a ${tabInfo.label} — username Twitch`}
              style={{ flex: 1, marginTop: 0 }} />
            <button className="btn-primary" onClick={aggiungi}
              disabled={aggiungendo || !nuovoLogin.trim()}
              style={{ fontSize: '0.82rem', padding: '0.45rem 0.85rem',
                background: `${tabInfo.color}26`, borderColor: `${tabInfo.color}55`, color: tabInfo.color }}>
              {aggiungendo ? <Loader size={13} className="spin" /> : <UserPlus size={13} />}
              Promuovi
            </button>
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginTop: '0.45rem' }}>
            Solo il broadcaster può promuovere e rimuovere {tabInfo.label}.
          </p>
        </motion.div>
      )}

      {/* Filtro */}
      <div style={{ position: 'relative' }}>
        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)' }} />
        <input className="mod-input" value={filtro}
          onChange={e => setFiltro(e.target.value)}
          placeholder={`Cerca tra i ${tabInfo.label.toLowerCase()}…`}
          style={{ paddingLeft: 28, marginTop: 0 }} />
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <Loader size={26} className="spin" style={{ color: tabInfo.color }} />
        </div>
      ) : utentiFiltrati.length === 0 ? (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <TabIcon size={32} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            {filtro ? 'Nessun risultato.' : `Nessun ${tabInfo.label.toLowerCase()} al momento.`}
          </p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.5rem' }}>
            <AnimatePresence initial={false}>
              {utentiFiltrati.map((u, i) => (
                <motion.div key={u.user_id || u.user_login}
                  layout
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ delay: Math.min(i * 0.015, 0.25), type: 'spring', stiffness: 320, damping: 26 }}
                  className="glass-card"
                  style={{ padding: '0.55rem 0.7rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  <span style={{
                    width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${tabInfo.color}1a`, color: tabInfo.color, flexShrink: 0,
                  }}>
                    <TabIcon size={12} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {u.user_name || u.user_login}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>
                      @{u.user_login}
                      {u.tier && <> · {tierLabel(u.tier)}{u.is_gift ? ' 🎁' : ''}</>}
                      {u.reason && <> · {u.reason.slice(0, 24)}</>}
                    </div>
                  </div>
                  {(tabInfo.canAdd || tab === 'banned') && (
                    <button className="mod-icon-btn mod-icon-btn-danger"
                      title={tab === 'banned' ? 'Grazia' : `Rimuovi da ${tabInfo.label}`}
                      onClick={() => rimuovi(u)}
                      disabled={rimuovendoId === u.user_id}
                    >
                      {rimuovendoId === u.user_id ? <Loader size={13} className="spin" /> : <UserMinus size={13} />}
                    </button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          <div style={{ marginTop: '0.75rem', textAlign: 'right', fontSize: '0.72rem', color: 'var(--text-faint)' }}>
            {utentiFiltrati.length} {tabInfo.label.toLowerCase()}{utentiFiltrati.length !== users.length && ` su ${users.length}`}
          </div>
        </div>
      )}
    </div>
  );
}
