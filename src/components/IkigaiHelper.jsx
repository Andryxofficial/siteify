import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Send, X, Sparkles } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useLingua } from '../contexts/LinguaContext';
import { ikigaiUiText } from '../i18n/ikigaiNatural';

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

function descriviPagina(pathname, lingua = 'it') {
  const en = lingua === 'en';
  const es = lingua === 'es';
  if (pathname === '/') return en ? 'Home' : es ? 'Inicio' : 'Home';
  if (pathname.startsWith('/socialify/info-tag')) return en ? 'SOCIALify tag info' : es ? 'Info etiquetas SOCIALify' : 'Info tag SOCIALify';
  if (pathname.startsWith('/socialify/')) return en ? 'SOCIALify thread' : es ? 'Hilo SOCIALify' : 'Thread SOCIALify';
  if (pathname.startsWith('/socialify')) return 'SOCIALify';
  if (pathname.startsWith('/impostazioni')) return en ? 'Settings' : es ? 'Ajustes' : 'Impostazioni';
  if (pathname.startsWith('/privacy')) return en ? 'Privacy' : es ? 'Privacidad' : 'Privacy';
  if (pathname.startsWith('/profilo')) return en ? 'User profile' : es ? 'Perfil de usuario' : 'Profilo utente';
  if (pathname.startsWith('/messaggi')) return en ? 'Messages' : es ? 'Mensajes' : 'Messaggi';
  if (pathname.startsWith('/amici')) return en ? 'Friends' : es ? 'Amigos' : 'Amici';
  if (pathname.startsWith('/gioco') || pathname.startsWith('/giochi')) return en ? 'Games' : es ? 'Juegos' : 'Giochi';
  if (pathname.startsWith('/chat')) return 'Chat';
  return pathname;
}

export default function IkigaiHelper() {
  const location = useLocation();
  const { lingua } = useLingua();
  const txt = ikigaiUiText(lingua);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([{ role: 'ikigai', text: txt.welcome }]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMessages(prev => {
      if (prev.length > 1) return prev;
      return [{ role: 'ikigai', text: txt.welcome }];
    });
  }, [txt.welcome]);

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
          lingua,
          cronologia: messages.filter(m => m.role === 'user').map(m => m.text).slice(-4),
          contestoPagina: {
            pathname: location.pathname,
            search: location.search,
            label: descriviPagina(location.pathname, lingua),
            lingua,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore Ikigai');
      setMessages(prev => [...prev, { role: 'ikigai', text: data.answer, routes: data.routes || [] }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ikigai', text: txt.error }]);
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
        aria-label={txt.openAria}
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
                    aria-label={txt.privacyAria}
                    title={txt.privacyTitle}
                    onClick={() => setOpen(false)}
                  >
                    <HelpCircle size={18} />
                  </Link>
                  Ikigai
                </h3>
                <p>{descriviPagina(location.pathname, lingua)}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label={txt.closeAria}><X size={18} /></button>
            </header>

            <div className="ikigai-suggestions">
              {txt.suggestions.map(s => (
                <button key={s} type="button" onClick={() => chiedi(s)} disabled={loading}>{s}</button>
              ))}
            </div>

            <div className="ikigai-messages">
              {messages.map((m, i) => (
                <div key={i} className={`ikigai-msg ${m.role}`}>
                  <p>{m.text}</p>
                  {Array.isArray(m.routes) && m.routes.length > 0 && (
                    <div className="ikigai-routes" aria-label={txt.linksAria}>
                      {m.routes.map(r => {
                        const href = r.href || r.path;
                        return (
                          <Link
                            key={`${href}-${r.label}`}
                            to={href}
                            aria-label={txt.openRoute(r.label)}
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
              {loading && <div className="ikigai-msg ikigai"><p>{txt.loading}</p></div>}
            </div>

            <form className="ikigai-input" onSubmit={(e) => { e.preventDefault(); chiedi(); }}>
              <input
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder={txt.placeholder}
                maxLength={700}
              />
              <button type="submit" disabled={loading || !question.trim()} aria-label={txt.sendAria}><Send size={18} /></button>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
