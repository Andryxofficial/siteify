import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Send, X, Sparkles, ShieldCheck } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const SUGGERIMENTI = [
  'Cosa posso fare sul sito?',
  'Come salgo in classifica?',
  'A cosa servono i tag?',
  'Come gestisco le notifiche?',
];

const CHIAVE_ANONIMA = 'andryxify_ikigai_anon_v1';

function idAnonimoLocale() {
  try {
    const esistente = localStorage.getItem(CHIAVE_ANONIMA);
    if (esistente) return esistente;
    const bytes = new Uint8Array(18);
    crypto.getRandomValues(bytes);
    const valore = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem(CHIAVE_ANONIMA, valore);
    return valore;
  } catch {
    return '';
  }
}

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
  const mostraLinkPrivacyImpostazioni = location.pathname.startsWith('/impostazioni');

  if (location.pathname.startsWith('/overlay/')) return null;

  const chiedi = async (q = question) => {
    const clean = String(q || '').trim();
    if (!clean || loading) return;
    const anonId = idAnonimoLocale();
    setQuestion('');
    setMessages(prev => [...prev, { role: 'user', text: clean }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ikigai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(anonId ? { 'X-Ikigai-Anon': anonId } : {}),
        },
        body: JSON.stringify({
          domanda: clean,
          anonId,
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
      {mostraLinkPrivacyImpostazioni && (
        <Link
          to="/privacy"
          className="settings-privacy-shortcut glass-panel"
          aria-label="Apri informativa privacy e sicurezza di Ikigai"
          title="Privacy & Ikigai"
        >
          <ShieldCheck size={16} />
          <span>Privacy & Ikigai</span>
        </Link>
      )}

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
                <h3>
                  <Link
                    to="/privacy"
                    className="ikigai-privacy-link"
                    aria-label="Apri informativa privacy di Ikigai"
                    title="Privacy di Ikigai"
                    onClick={() => setOpen(false)}
                  >
                    <HelpCircle size={18} />
                  </Link>
                  Ikigai
                </h3>
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
                    <div className="ikigai-routes" aria-label="Collegamenti suggeriti da Ikigai">
                      {m.routes.map(r => {
                        const href = r.href || r.path;
                        return (
                          <Link
                            key={`${href}-${r.label}`}
                            to={href}
                            aria-label={`Apri ${r.label}`}
                            onClick={() => setOpen(false)}
                          >
                            {r.label}
                          </Link>
                        );
                      })}
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
