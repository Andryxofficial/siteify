/**
 * Bot24h.jsx — Configurazione e stato del bot 24/7 serverless.
 *
 * Permette di:
 *   1. Autorizzare l'account bot (OAuth Twitch authorization_code)
 *   2. Concedere channel:bot al broadcaster
 *   3. Attivare le sottoscrizioni EventSub sul canale
 *   4. Monitorare stato e log in tempo reale
 *
 * I dati di comandi/timer/citazioni/keyword sono già gestiti dalla sezione Chat.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot, Wifi, WifiOff, Key, Radio, RefreshCw, Loader,
  CheckCircle2, XCircle, AlertCircle, Clock, Trash2,
  ExternalLink, List, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { useTwitchAuth } from '../../contexts/TwitchAuthContext';

const CHIAVETWITCH = import.meta.env.VITE_CHIAVETWITCH;

/** Costruisce l'URL OAuth Twitch (authorization_code flow) per il bot. */
function buildBotOAuthUrl(tipo) {
  const stateObj = { type: tipo, nonce: Math.random().toString(36).slice(2) };
  const state    = btoa(JSON.stringify(stateObj));
  const redirect = `${window.location.origin}/api/bot-auth-callback`;
  const scopes   = tipo === 'broadcaster'
    ? 'channel:bot'
    : 'user:bot user:write:chat user:read:chat';
  return (
    `https://id.twitch.tv/oauth2/authorize` +
    `?client_id=${CHIAVETWITCH}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${encodeURIComponent(state)}` +
    `&force_verify=true`
  );
}

function StatoBadge({ ok, testoSi, testoNo }) {
  return ok ? (
    <span className="chip chip-success" style={{ fontSize: '0.72rem' }}>
      <CheckCircle2 size={11} /> {testoSi}
    </span>
  ) : (
    <span className="chip chip-danger" style={{ fontSize: '0.72rem' }}>
      <XCircle size={11} /> {testoNo}
    </span>
  );
}

function LogEntry({ entry }) {
  const colori = {
    risposta: 'var(--accent-spotify)',
    timer:    'var(--accent-warm)',
    revoca:   '#ff6b6b',
    comando:  'var(--secondary)',
    raw:      'var(--text-muted)',
  };
  const col = colori[entry.tipo] || 'var(--text-muted)';
  const ora = entry.ts ? new Date(entry.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', padding: '0.3rem 0', borderBottom: '1px solid rgba(130,170,240,0.07)', fontSize: '0.78rem' }}>
      <span style={{ color: col, fontWeight: 600, minWidth: 72, flexShrink: 0 }}>{entry.tipo}</span>
      <span style={{ color: 'var(--text-muted)', flex: 1 }}>{entry.messaggio}</span>
      {ora && <span style={{ color: 'var(--text-faint)', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{ora}</span>}
    </div>
  );
}

export default function Bot24h({ token }) {
  useTwitchAuth(); // verifica che il provider sia montato

  const [stato,          setStato]          = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [loadingSubs,    setLoadingSubs]     = useState(false);
  const [subscriptions,  setSubscriptions]  = useState([]);
  const [mostraLog,      setMostraLog]      = useState(false);
  const [mostraSubs,     setMostraSubs]     = useState(false);
  const [salvando,       setSalvando]       = useState(false);
  const [errore,         setErrore]         = useState('');
  const [notifica,       setNotifica]       = useState('');

  // Leggi esito OAuth dai query param (redirect dopo callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bot    = params.get('bot');
    const mappa  = {
      'ok':             '✅ Bot autorizzato con successo!',
      'broadcaster-ok': '✅ Accesso canale concesso!',
      'negato':         '❌ Autorizzazione negata.',
      'errore':         '❌ Errore durante l\'autorizzazione.',
      'token-errore':   '❌ Errore nello scambio del token.',
      'no-config':      '❌ Variabili d\'ambiente mancanti (CHIAVETWITCH_CLIENT_SECRET).',
    };
    if (bot && mappa[bot]) {
      setNotifica(mappa[bot]);
      // Pulisci i query param senza ricaricare la pagina
      const url = new URL(window.location.href);
      url.searchParams.delete('bot');
      url.searchParams.delete('sezione');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const caricaStato = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/bot-status', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      setStato(await r.json());
    } catch (e) { setErrore(e.message); }
    finally    { setLoading(false); }
  }, [token]);

  const caricaSubscriptions = useCallback(async () => {
    setLoadingSubs(true);
    try {
      const r = await fetch('/api/bot-subscribe', { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      const d = await r.json();
      setSubscriptions(d.subscriptions || []);
    } catch (e) { setErrore(e.message); }
    finally    { setLoadingSubs(false); }
  }, [token]);

  useEffect(() => { caricaStato(); }, [caricaStato]);
  // Auto-refresh stato ogni 30s
  useEffect(() => {
    const t = setInterval(caricaStato, 30_000);
    return () => clearInterval(t);
  }, [caricaStato]);

  const attivaSubscriptions = async () => {
    setSalvando(true); setErrore('');
    try {
      const r = await fetch('/api/bot-subscribe', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({}),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Errore');
      setNotifica(`✅ Sottoscrizioni attivate: ${d.sottoscritte?.length || 0}${d.errori?.length ? ` (${d.errori.length} errori)` : ''}`);
      await caricaStato();
    } catch (e) { setErrore(e.message); }
    finally    { setSalvando(false); }
  };

  const eliminaSubscription = async (id) => {
    try {
      const r = await fetch(`/api/bot-subscribe?id=${encodeURIComponent(id)}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error((await r.json()).error || 'Errore');
      setSubscriptions(prev => prev.filter(s => s.id !== id));
    } catch (e) { setErrore(e.message); }
  };

  const tuttiOk = stato?.botAutorizzato && stato?.broadcasterGranted && stato?.subscriptioniTs;

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem' }}>
        <Loader size={28} className="spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Notifica temporanea */}
      <AnimatePresence>
        {notifica && (
          <motion.div className="glass-card"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', borderColor: notifica.startsWith('✅') ? 'rgba(87,242,135,.3)' : 'rgba(255,107,107,.3)' }}>
            <span style={{ flex: 1, fontSize: '0.85rem' }}>{notifica}</span>
            <button className="mod-icon-btn" onClick={() => setNotifica('')}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Errore */}
      {errore && (
        <div className="glass-card" style={{ padding: '0.75rem 1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', borderColor: 'rgba(255,107,107,.3)' }}>
          <AlertCircle size={15} className="text-tonal-danger" style={{ flexShrink: 0 }} />
          <span className="text-tonal-danger" style={{ flex: 1, fontSize: '0.85rem' }}>{errore}</span>
          <button className="mod-icon-btn" onClick={() => setErrore('')}>✕</button>
        </div>
      )}

      {/* ── Riepilogo stato ── */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: tuttiOk ? 'rgba(87,242,135,.15)' : 'rgba(130,170,240,.1)', border: `1.5px solid ${tuttiOk ? 'rgba(87,242,135,.3)' : 'rgba(130,170,240,.2)'}` }}>
            {tuttiOk ? <Wifi size={20} color="var(--accent-spotify)" /> : <WifiOff size={20} color="var(--text-muted)" />}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>
              Bot 24/7 {tuttiOk ? <span className="text-tonal-success" style={{ fontSize: '0.8rem' }}>● Attivo</span> : <span style={{ color: 'var(--text-faint)', fontSize: '0.8rem' }}>● Non configurato</span>}
            </div>
            {stato?.botLogin && (
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Account bot: <strong>@{stato.botLogin}</strong>
                {stato.botTokenScadeAt && (
                  <span style={{ marginLeft: '0.5rem', color: 'var(--text-faint)' }}>
                    <Clock size={10} style={{ verticalAlign: 'middle' }} /> scade {new Date(stato.botTokenScadeAt).toLocaleString('it-IT')}
                  </span>
                )}
              </div>
            )}
          </div>
          <button className="mod-icon-btn" onClick={caricaStato} style={{ marginLeft: 'auto' }} title="Aggiorna">
            <RefreshCw size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <StatoBadge ok={stato?.botAutorizzato}    testoSi="Bot autorizzato"    testoNo="Bot non autorizzato" />
          <StatoBadge ok={stato?.broadcasterGranted} testoSi="channel:bot OK"    testoNo="channel:bot mancante" />
          <StatoBadge ok={!!stato?.subscriptioniTs}  testoSi="EventSub attivi"   testoNo="EventSub non attivi" />
        </div>

        {stato?.subscriptioniTs && (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-faint)', marginTop: '0.5rem' }}>
            Ultima attivazione: {new Date(stato.subscriptioniTs).toLocaleString('it-IT')}
          </p>
        )}
      </div>

      {/* ── Passo 1: Autorizza bot ── */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: stato?.botAutorizzato ? 'rgba(87,242,135,.2)' : 'rgba(130,170,240,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>1</div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}><Key size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Autorizza il Bot</h3>
          {stato?.botAutorizzato && <CheckCircle2 size={16} color="var(--accent-spotify)" style={{ marginLeft: 'auto' }} />}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
          Clicca il pulsante e accedi con l'<strong>account Twitch del bot</strong> (può essere un account dedicato o il tuo).
          Concede gli scope <code style={{ fontSize: '0.75rem' }}>user:bot</code>, <code style={{ fontSize: '0.75rem' }}>user:write:chat</code>, <code style={{ fontSize: '0.75rem' }}>user:read:chat</code>.
        </p>
        <a href={buildBotOAuthUrl('bot')} className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <Bot size={14} /> {stato?.botAutorizzato ? 'Re-autorizza Bot' : 'Autorizza Bot'} <ExternalLink size={12} />
        </a>
        {!CHIAVETWITCH && (
          <p className="text-tonal-danger" style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
            ⚠ VITE_CHIAVETWITCH non configurato — il link OAuth non funzionerà.
          </p>
        )}
      </div>

      {/* ── Passo 2: channel:bot del broadcaster ── */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: stato?.broadcasterGranted ? 'rgba(87,242,135,.2)' : 'rgba(130,170,240,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>2</div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}><Radio size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Concedi Accesso al Canale</h3>
          {stato?.broadcasterGranted && <CheckCircle2 size={16} color="var(--accent-spotify)" style={{ marginLeft: 'auto' }} />}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
          Il <strong>broadcaster</strong> deve autorizzare il bot a scrivere nel proprio canale.
          Clicca il pulsante mentre sei loggato come broadcaster (o fallo fare al proprietario del canale).
          Concede lo scope <code style={{ fontSize: '0.75rem' }}>channel:bot</code>.
        </p>
        <a href={buildBotOAuthUrl('broadcaster')} className="btn btn-primary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <Key size={14} /> {stato?.broadcasterGranted ? 'Re-autorizza Canale' : 'Autorizza Canale'} <ExternalLink size={12} />
        </a>
      </div>

      {/* ── Passo 3: Attiva EventSub ── */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: stato?.subscriptioniTs ? 'rgba(87,242,135,.2)' : 'rgba(130,170,240,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>3</div>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}><Sparkles size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />Attiva Sottoscrizioni EventSub</h3>
          {stato?.subscriptioniTs && <CheckCircle2 size={16} color="var(--accent-spotify)" style={{ marginLeft: 'auto' }} />}
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', lineHeight: 1.5 }}>
          Registra gli webhook di Twitch EventSub. Twitch invierà una notifica al server ad ogni messaggio,
          follow, sub, cheer e raid — il bot risponderà 24/7, anche con il browser chiuso.
          Riattiva ogni volta che cambi il canale o dopo un re-deploy.
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
            onClick={attivaSubscriptions}
            disabled={salvando || !stato?.botAutorizzato}>
            {salvando ? <Loader size={14} className="spin" /> : <Radio size={14} />}
            {stato?.subscriptioniTs ? 'Rinnova EventSub' : 'Attiva EventSub'}
          </button>
          <button className="mod-icon-btn"
            onClick={() => { setMostraSubs(!mostraSubs); if (!mostraSubs) caricaSubscriptions(); }}
            title="Mostra sottoscrizioni attive">
            <List size={15} />
            {mostraSubs ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Lista sottoscrizioni attive */}
        <AnimatePresence>
          {mostraSubs && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: '1rem', overflow: 'hidden' }}>
              {loadingSubs ? (
                <div style={{ textAlign: 'center', padding: '1rem' }}><Loader size={18} className="spin" style={{ color: 'var(--primary)' }} /></div>
              ) : subscriptions.length === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-faint)' }}>Nessuna sottoscrizione attiva.</p>
              ) : (
                <div className="mod-list" style={{ marginTop: '0.5rem' }}>
                  {subscriptions.map(sub => (
                    <div key={sub.id} className="mod-item glass-card" style={{ padding: '0.6rem 0.9rem' }}>
                      <div className="mod-item-header">
                        <code className="mod-trigger" style={{ fontSize: '0.72rem' }}>{sub.type}</code>
                        <span className={`chip ${sub.status === 'enabled' ? 'chip-success' : 'chip-danger'}`} style={{ fontSize: '0.65rem' }}>
                          {sub.status}
                        </span>
                        <div className="mod-item-actions">
                          <button className="mod-icon-btn mod-icon-btn-danger" title="Elimina" onClick={() => eliminaSubscription(sub.id)}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Log eventi ── */}
      {stato?.log?.length > 0 && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <button
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', width: '100%', fontWeight: 600, fontSize: '0.95rem' }}
            onClick={() => setMostraLog(!mostraLog)}>
            <List size={15} /> Log eventi recenti
            <span className="mod-badge" style={{ marginLeft: '0.25rem' }}>{stato.log.length}</span>
            <span style={{ marginLeft: 'auto' }}>{mostraLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
          </button>
          <AnimatePresence>
            {mostraLog && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ marginTop: '0.75rem', overflow: 'hidden' }}>
                {stato.log.map((entry, i) => (
                  <LogEntry key={i} entry={entry} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

    </div>
  );
}
