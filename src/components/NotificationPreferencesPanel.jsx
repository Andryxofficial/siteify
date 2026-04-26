import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellRing, Clock, Eye, EyeOff, Layers, Volume2, Vibrate, Zap } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useTwitchAuth } from '../contexts/TwitchAuthContext';
import { useNotifiche } from '../hooks/useNotifiche';
import {
  NOTIFICHE_CATEGORIE,
  leggiPreferenzeNotifiche,
  salvaPreferenzeNotifiche,
  buildServerPrefsNotifiche,
} from '../utils/notifichePrefs';

function SwitchCompatto({ checked, onChange, label, desc, Icon }) {
  return (
    <button
      type="button"
      className={`notif-pref-row${checked ? ' active' : ''}`}
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="notif-pref-icon">{Icon ? <Icon size={17} /> : <Bell size={17} />}</span>
      <span className="notif-pref-text">
        <strong>{label}</strong>
        {desc && <small>{desc}</small>}
      </span>
      <span className="notif-pref-switch"><span /></span>
    </button>
  );
}

export default function NotificationPreferencesPanel() {
  const location = useLocation();
  const { twitchToken, isLoggedIn } = useTwitchAuth();
  const { attivo: pushAttive, attiva: attivaPush, disattiva: disattivaPush, supportato } = useNotifiche();
  const [prefs, setPrefs] = useState(() => leggiPreferenzeNotifiche());
  const [syncState, setSyncState] = useState('');

  const visibile = location.pathname === '/impostazioni';

  useEffect(() => {
    if (!visibile) return undefined;
    const onStorage = () => setPrefs(leggiPreferenzeNotifiche());
    const onPrefs = (e) => setPrefs(e.detail || leggiPreferenzeNotifiche());
    window.addEventListener('storage', onStorage);
    window.addEventListener('andryxify:notifiche-prefs', onPrefs);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('andryxify:notifiche-prefs', onPrefs);
    };
  }, [visibile]);

  if (!visibile) return null;

  const updatePrefs = async (next) => {
    const merged = salvaPreferenzeNotifiche(next);
    setPrefs(merged);
    if (!isLoggedIn || !twitchToken) return;
    setSyncState('salvataggio');
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'prefs', prefs: buildServerPrefsNotifiche(merged) }),
      });
      setSyncState('salvato');
      setTimeout(() => setSyncState(''), 1400);
    } catch {
      setSyncState('locale');
      setTimeout(() => setSyncState(''), 1800);
    }
  };

  const setCampo = (campo, valore) => updatePrefs({ ...prefs, [campo]: valore });
  const setCategoria = (id, valore) => updatePrefs({ ...prefs, categories: { ...prefs.categories, [id]: valore } });

  const togglePush = async (value) => {
    setCampo('push', value);
    if (!supportato) return;
    if (value) await attivaPush();
    else disattivaPush();
  };

  const testNotifica = async () => {
    if (!isLoggedIn || !twitchToken) return;
    setSyncState('test');
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${twitchToken}` },
        body: JSON.stringify({ action: 'test' }),
      });
      setSyncState('test inviato');
    } catch {
      setSyncState('test non riuscito');
    } finally {
      setTimeout(() => setSyncState(''), 1800);
    }
  };

  return (
    <motion.section
      className="glass-panel notif-pref-panel"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
    >
      <div className="notif-pref-head">
        <div>
          <h3><BellRing size={19} /> Notifiche avanzate</h3>
          <p>Decidi cosa ricevere, quando riceverlo e quanto devono essere invasive.</p>
        </div>
        {syncState && <span className="notif-pref-status">{syncState}</span>}
      </div>

      <div className="notif-pref-grid">
        <SwitchCompatto checked={prefs.inApp} onChange={v => setCampo('inApp', v)} label="In-app" desc="Avvisi dentro il sito." Icon={Bell} />
        <SwitchCompatto checked={prefs.push && pushAttive} onChange={togglePush} label="Push dispositivo" desc={supportato ? 'Anche fuori dalla pagina.' : 'Non supportate da questo browser.'} Icon={Zap} />
        <SwitchCompatto checked={prefs.sound} onChange={v => setCampo('sound', v)} label="Suoni" desc="Feedback audio leggero." Icon={Volume2} />
        <SwitchCompatto checked={prefs.vibration} onChange={v => setCampo('vibration', v)} label="Vibrazione" desc="Feedback aptico su mobile." Icon={Vibrate} />
        <SwitchCompatto checked={prefs.previews} onChange={v => setCampo('previews', v)} label="Anteprime" desc="Mostra parte del contenuto." Icon={prefs.previews ? Eye : EyeOff} />
        <SwitchCompatto checked={prefs.groupSimilar} onChange={v => setCampo('groupSimilar', v)} label="Raggruppa simili" desc="Meno spam, più ordine." Icon={Layers} />
        <SwitchCompatto checked={prefs.priorityOnly} onChange={v => setCampo('priorityOnly', v)} label="Solo prioritarie" desc="Menzioni, DM e sistema." Icon={Zap} />
        <SwitchCompatto checked={prefs.quietHours} onChange={v => setCampo('quietHours', v)} label="Ore silenziose" desc="Blocca notifiche in fascia oraria." Icon={Clock} />
      </div>

      {prefs.quietHours && (
        <div className="notif-time-row">
          <label>Da <input type="time" value={prefs.quietStart} onChange={e => setCampo('quietStart', e.target.value)} /></label>
          <label>A <input type="time" value={prefs.quietEnd} onChange={e => setCampo('quietEnd', e.target.value)} /></label>
        </div>
      )}

      <div className="notif-category-box">
        <h4>Categorie</h4>
        <div className="notif-category-grid">
          {NOTIFICHE_CATEGORIE.map(cat => (
            <SwitchCompatto
              key={cat.id}
              checked={prefs.categories?.[cat.id] !== false}
              onChange={v => setCategoria(cat.id, v)}
              label={cat.label}
              desc={cat.desc}
            />
          ))}
        </div>
      </div>

      {isLoggedIn && (
        <button type="button" className="btn btn-ghost notif-test-btn" onClick={testNotifica}>
          Invia notifica di prova
        </button>
      )}
    </motion.section>
  );
}
