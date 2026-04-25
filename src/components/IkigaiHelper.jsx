import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Send, X, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const SUGGERIMENTI = [
  'Cosa posso fare sul sito?',
  'Come salgo in classifica?',
  'A cosa servono i tag?',
  'Come gestisco le notifiche?',
];

function descriviPagina(pathname) {
  if (pathname === '/') return 'Home';
  if (pathname.startsWith('/socialify/info-tag')) return 'Info tag SOCIALify';
  if (pathname.startsWith('/socialify/')) return 'Thread SOCIALify';
  if (pathname.startsWith('/socialify')) return 'SOCIALify';
  if (pathname.startsWith('/impostazioni')) return 'Impostazioni';
  if (pathname.startsWith('/profilo')) return 'Profilo utente';
  if (pathname.startsWith('/messaggi')) return 'Messaggi';
  if (pathname.startsWith('/amici')) return 'Amici';
  if (pathname.startsWith('/gioco') || pathname.startsWith('/giochi')) return 'Giochi';
  if (pathname.startsWith('/chat')) return 'Chat';
  return pathname;
}

export default function IkigaiHelper() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    { role: 'ikigai', text: 'Eccomi. Dimmi cosa vuoi capire del sito: funzioni, SOCIALify, classifiche, premi, tag, notifiche o impostazioni.' },
  ]);
  const [loading, setLoading] = useState(false);

  if (location.pathname.startsWith('/overlay/')) return null;

  const chiedi = async (q = question) => {
    const clean = String(q || '').trim();
    if (!clean || loading) return;
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', text: clean }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ikigai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domanda: clean,
          cronologia: messages.filter(m => m.role === 'user').map(m => m.text).slice(-4),
          contestoPagina: {
            pathname: location.pathname,
            search: location.search,
            label: descriviPagina(location.pathname),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore Ikigai');
      setMessages(prev => [...prev, { role: 'ikigai', text: data.answer, routes: data.routes || [] }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ikigai', text: 'Mh, qui mi si è inceppato il collegamento. Riprova tra poco e ti rispondo meglio.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <motion.button
        type="button"
        className="ikigai-fab"
        onClick={() => setOpen(v => !v)}
        whileTap={{ scale: 0.92 }}
        aria-label="Apri Ikigai"
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.aside
            className="ikigai-panel glass-panel"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          >
            <header className="ikigai-head">
              <div>
                <h3><HelpCircle size={18} /> Ikigai</h3>
                <p>{descriviPagina(location.pathname)}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Chiudi Ikigai"><X size={18} /></button>
            </header>

            <div className="ikigai-suggestions">
              {SUGGERIMENTI.map(s => (
                <button key={s} type="button" onClick={() => chiedi(s)} disabled={loading}>{s}</button>
              ))}
            </div>

            <div className="ikigai-messages">
              {messages.map((m, i) => (
                <div key={i} className={`ikigai-msg ${m.role}`}>
                  <p>{m.text}</p>
                  {Array.isArray(m.routes) && m.routes.length > 0 && (
                    <div className="ikigai-routes">
                      {m.routes.map(r => <Link key={`${r.path}-${r.label}`} to={r.path}>{r.label}</Link>)}
                    </div>
                  )}
                </div>
              ))}
              {loading && <div className="ikigai-msg ikigai"><p>Ci penso un attimo…</p></div>}
            </div>

            <form className="ikigai-input" onSubmit={(e) => { e.preventDefault(); chiedi(); }}>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="Chiedi a Ikigai..."
                maxLength={700}
              />
              <button type="submit" disabled={loading || !question.trim()} aria-label="Invia"><Send size={18} /></button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
