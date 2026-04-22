/**
 * EventSubConsole.jsx — Console EventSub: lista subscriptions + log eventi.
 *
 * 2 sezioni:
 *   - Subscriptions list: GET /api/mod-eventsub → {total, cost, maxCost, subscriptions:[{id, type, status, condition, created_at}]}
 *     Con pulsante Delete per ogni subscription.
 *   - Event log: GET /api/mod-eventsub?action=log&n=50 → {items:[{type, ts, ...}]}
 *     Auto-refresh 15s.
 */
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, Trash2, Loader, RefreshCw, CheckCircle, XCircle, AlertTriangle,
  Activity, Clock, Zap,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { modGet, modPost } from '../../utils/modApi';

const STATUS_INFO = {
  enabled:                  { label: 'Attiva',    icon: CheckCircle,    color: 'var(--accent-spotify)' },
  webhook_callback_verification_pending: { label: 'Pending',  icon: Clock,         color: 'var(--accent-warm)' },
  webhook_callback_verification_failed:  { label: 'Failed',   icon: XCircle,       color: 'var(--accent)' },
  notification_failures_exceeded:        { label: 'Fallita',  icon: AlertTriangle, color: 'var(--accent)' },
  authorization_revoked:                 { label: 'Revocata', icon: XCircle,       color: 'var(--text-faint)' },
  moderator_removed:                     { label: 'Rimosso',  icon: XCircle,       color: 'var(--text-faint)' },
  user_removed:                          { label: 'Rimosso',  icon: XCircle,       color: 'var(--text-faint)' },
  version_removed:                       { label: 'Obsoleta', icon: XCircle,       color: 'var(--text-faint)' },
};

function getStatusInfo(status) {
  return STATUS_INFO[status] || { label: status, icon: Bell, color: 'var(--text-muted)' };
}

export default function EventSubConsole({ token }) {
  const toast = useToast();

  // Subscriptions
  const [subs, setSubs] = useState([]);
  const [subsTotal, setSubsTotal] = useState(0);
  const [maxCost, setMaxCost] = useState(0);
  const [subsLoading, setSubsLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  // Event log
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const loadSubscriptions = useCallback(async () => {
    setSubsLoading(true);
    const r = await modGet('/api/mod-eventsub', token);
    if (r.ok) {
      setSubs(r.data?.subscriptions || []);
      setSubsTotal(r.data?.total || 0);
      setMaxCost(r.data?.maxCost || 0);
    } else {
      toast.error(r.error, { titolo: 'EventSub Subscriptions' });
    }
    setSubsLoading(false);
  }, [token, toast]);

  const loadEvents = useCallback(async () => {
    setEventsLoading(true);
    const r = await modGet('/api/mod-eventsub?action=log&n=50', token);
    if (r.ok) {
      setEvents(r.data?.items || []);
    } else {
      toast.error(r.error, { titolo: 'EventSub Log' });
    }
    setEventsLoading(false);
  }, [token, toast]);

  const deleteSubscription = useCallback(async (id) => {
    if (!confirm('Eliminare questa subscription EventSub?')) return;
    setDeleting(id);
    const r = await modPost('/api/mod-eventsub', token, { action: 'delete', id });
    if (r.ok) {
      toast.success('Subscription eliminata.', { titolo: '🗑️ EventSub' });
      await loadSubscriptions();
    } else {
      toast.error(r.error, { titolo: 'Eliminazione fallita' });
    }
    setDeleting(null);
  }, [token, toast, loadSubscriptions]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSubscriptions();
    loadEvents();
    // Auto-refresh log ogni 15s
    const interval = setInterval(loadEvents, 15000);
    return () => clearInterval(interval);
  }, [loadSubscriptions, loadEvents]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
        <Bell size={18} style={{ verticalAlign: 'middle', marginRight: '0.4rem', color: 'var(--accent-warm)' }} />
        EventSub Console
      </h2>

      {/* Subscriptions */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 600, flex: 1 }}>
            <Zap size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-twitch)' }} />
            Subscriptions Attive
          </h3>
          <div className="chip" style={{ fontSize: '0.75rem' }}>
            {subsTotal} / {maxCost} cost
          </div>
          <button className="mod-icon-btn" onClick={loadSubscriptions} title="Aggiorna">
            {subsLoading ? <Loader size={13} className="spin" /> : <RefreshCw size={13} />}
          </button>
        </div>

        {subsLoading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Loader size={26} className="spin" style={{ color: 'var(--accent-twitch)' }} />
          </div>
        ) : subs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Bell size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Nessuna subscription EventSub registrata.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: 500, overflowY: 'auto' }}>
            {subs.map((sub, i) => {
              const statusInfo = getStatusInfo(sub.status);
              const Icon = statusInfo.icon;
              const isDeleting = deleting === sub.id;
              return (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  className="glass-card"
                  style={{ padding: '0.75rem', display: 'flex', alignItems: 'flex-start', gap: '0.65rem' }}
                >
                  <Icon size={14} style={{ color: statusInfo.color, marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                      {sub.type}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                      Status: <span style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                    </div>
                    {sub.condition && Object.keys(sub.condition).length > 0 && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', fontFamily: 'monospace', marginBottom: '0.3rem' }}>
                        {Object.entries(sub.condition).map(([k, v]) => `${k}=${v}`).join(', ')}
                      </div>
                    )}
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Clock size={9} />
                      {new Date(sub.created_at).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    className="mod-icon-btn mod-icon-btn-danger"
                    onClick={() => deleteSubscription(sub.id)}
                    disabled={isDeleting}
                    title="Elimina"
                  >
                    {isDeleting ? <Loader size={12} className="spin" /> : <Trash2 size={12} />}
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Event Log */}
      <div className="glass-card" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 600, flex: 1 }}>
            <Activity size={15} style={{ verticalAlign: 'middle', marginRight: '0.35rem', color: 'var(--accent-spotify)' }} />
            Log Eventi (ultimi 50)
          </h3>
          <button className="mod-icon-btn" onClick={loadEvents} title="Aggiorna">
            {eventsLoading ? <Loader size={13} className="spin" /> : <RefreshCw size={13} />}
          </button>
        </div>

        {eventsLoading && events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Loader size={26} className="spin" style={{ color: 'var(--accent-spotify)' }} />
          </div>
        ) : events.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <Activity size={36} style={{ color: 'var(--text-faint)', marginBottom: '0.5rem' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Nessun evento ricevuto ancora.
            </p>
          </div>
        ) : (
          <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {events.map((evt, i) => (
              <div key={i} className="glass-card" style={{ padding: '0.6rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem' }}>
                <Bell size={12} style={{ color: 'var(--accent-warm)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0, fontFamily: 'monospace' }}>
                  {evt.type || 'unknown'}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Clock size={9} />
                  {new Date(evt.ts).toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
