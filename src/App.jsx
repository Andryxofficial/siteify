import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Component, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { TwitchAuthProvider } from './contexts/TwitchAuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { TemaProvider } from './contexts/TemaContext';
import { RetiProvider } from './contexts/RetiContext';
import Navbar from './components/Navbar';
import SchermataCampione from './components/SchermataCampione';
import Footer from './components/Footer';
import PageTransition from './components/PageTransition';
import CookieBanner from './components/CookieBanner';
import BannerOffline from './components/BannerOffline';
import useStandalone from './hooks/useStandalone';
import useScrollToTop from './hooks/useScrollToTop';
import UpdateToast from './components/UpdateToast';
import Home from './pages/Home';
import FallbackRitardato from './components/FallbackRitardato';
import {
  TwitchPage, YouTubePage, InstagramPage, PodcastPage, TikTokPage,
  GamePage, CommunityPage, ThreadView, Scoiattoli, ModPanel,
  FriendsPage, MessagesPage, ChatGeneralePage, SettingsPage, ProfiloPage,
  prefetchPagineMain,
} from './lazyPages';
import './index.css';

// Overlay OBS — layout minimo senza navbar/footer
const GoalsOverlay  = lazy(() => import('./pages/overlay/GoalsOverlay'));
const EventsOverlay = lazy(() => import('./pages/overlay/EventsOverlay'));
const AlertsOverlay = lazy(() => import('./pages/overlay/AlertsOverlay'));

/* ─── Error Boundary ───
   Cattura qualsiasi errore JavaScript durante il rendering di un componente figlio
   e mostra un messaggio di errore invece di lasciare la pagina completamente bianca.
   Senza questo, un'eccezione non gestita smonta l'intero albero React (navbar, footer, tutto). */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { errore: null };
  }

  static getDerivedStateFromError(err) {
    return { errore: err };
  }

  componentDidCatch(err, info) {
    console.error('[ANDRYXify] Errore React non gestito:', err, info.componentStack);
  }

  render() {
    if (this.state.errore) {
      return (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem', minHeight: '60vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: '1rem',
        }}>
          <span style={{ fontSize: '2.5rem' }}>⚠️</span>
          <h2 style={{ color: '#f87171', margin: 0 }}>Qualcosa è andato storto</h2>
          <p style={{ color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.5 }}>
            {this.state.errore.message || 'Errore inaspettato. Ricarica la pagina per riprovare.'}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}>
            Ricarica la pagina
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Skeleton minimo di fallback per Suspense
function PaginaCaricamento() {
  return (
    <div className="main-content" style={{ paddingTop: '2rem' }}>
      <div className="glass-panel skeleton" style={{ height: 120, marginBottom: '1rem' }} />
      <div className="glass-panel skeleton" style={{ height: 200 }} />
    </div>
  );
}

/* ─── Gestore globale OAuth Twitch ───
   Twitch può reindirizzare su qualsiasi pagina con il token nell'hash.
   Questo componente cattura il token e lo salva in localStorage.
   Il TwitchAuthProvider lo leggerà automaticamente.              */
function TwitchOAuthRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash || window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (token) {
        localStorage.setItem('twitchGameToken', token);
        // Pulisci l'hash dall'URL senza navigare via dalla pagina corrente
        window.history.replaceState(null, '', location.pathname);
        // Controlla se c'è un percorso di ritorno salvato (es. /socialify)
        const returnPath = sessionStorage.getItem('twitchAuthReturnPath');
        sessionStorage.removeItem('twitchAuthReturnPath');
        if (returnPath && returnPath !== location.pathname) {
          navigate(returnPath, { replace: true });
        } else if (location.pathname === '/') {
          navigate('/gioco', { replace: true });
        }
      }
    }
  }, [navigate, location]);

  return null;
}

function AppLayout() {
  const location = useLocation();
  const isStandalone = useStandalone();
  useScrollToTop();

  // Ripristina tema colore accent al carico (tema chiaro/scuro e font
  // sono già gestiti dallo script anti-FOUC in index.html e TemaProvider)
  useEffect(() => {
    const accento = localStorage.getItem('andryxify_tema');
    const colori = { default: '#e040fb', magenta: '#ff4081', cyan: '#00e5ff', amber: '#ffb300', emerald: '#4ade80' };
    if (accento && colori[accento]) {
      document.documentElement.style.setProperty('--primary', colori[accento]);
    }
  }, []);

  // Prefetch in idle dei chunk delle pagine principali della navbar:
  // così la prima navigazione dopo l'home è già istantanea, anche su mobile
  // dove non c'è hover. Sicuro chiamare più volte (cache interna).
  useEffect(() => { prefetchPagineMain(); }, []);

  return (
    <div className={`app-container${isStandalone ? ' pwa-standalone' : ''}`}>
      <Navbar />
      <SchermataCampione />
      <AnimatePresence mode="wait">
        <PageTransition key={location.pathname}>
          <ErrorBoundary>
          <Suspense fallback={<FallbackRitardato><PaginaCaricamento /></FallbackRitardato>}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/twitch" element={<TwitchPage />} />
              <Route path="/youtube" element={<YouTubePage />} />
              <Route path="/instagram" element={<InstagramPage />} />
              <Route path="/podcast" element={<PodcastPage />} />
              <Route path="/tiktok" element={<TikTokPage />} />
              <Route path="/gioco" element={<GamePage />} />
              <Route path="/socialify" element={<CommunityPage />} />
              <Route path="/socialify/:postId" element={<ThreadView />} />

              <Route path="/scoiattoli" element={<Scoiattoli />} />
              <Route path="/mod-panel" element={<ModPanel />} />
              <Route path="/amici" element={<FriendsPage />} />
              <Route path="/messaggi" element={<MessagesPage />} />
              <Route path="/chat" element={<ChatGeneralePage />} />
              <Route path="/impostazioni" element={<SettingsPage />} />
              <Route path="/profilo/:username" element={<ProfiloPage />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </PageTransition>
      </AnimatePresence>
      <Footer />
      <UpdateToast />
      <BannerOffline />
      <CookieBanner />
    </div>
  );
}

function App() {
  return (
    <Router>
      <TemaProvider>
        <RetiProvider>
          <TwitchAuthProvider>
            <ToastProvider>
              <TwitchOAuthRedirect />
              {/* Layout overlay — no navbar/footer, sfondo trasparente */}
              <Routes>
                <Route path="/overlay/goals"  element={<Suspense fallback={null}><GoalsOverlay /></Suspense>} />
                <Route path="/overlay/events" element={<Suspense fallback={null}><EventsOverlay /></Suspense>} />
                <Route path="/overlay/alerts" element={<Suspense fallback={null}><AlertsOverlay /></Suspense>} />
                <Route path="*" element={<AppLayout />} />
              </Routes>
            </ToastProvider>
          </TwitchAuthProvider>
        </RetiProvider>
      </TemaProvider>
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;
