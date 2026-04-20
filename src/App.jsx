import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { TwitchAuthProvider } from './contexts/TwitchAuthContext';
import Navbar from './components/Navbar';
import SchermataCampione from './components/SchermataCampione';
import Footer from './components/Footer';
import PageTransition from './components/PageTransition';
import useStandalone from './hooks/useStandalone';
import useScrollToTop from './hooks/useScrollToTop';
import UpdateToast from './components/UpdateToast';
import Home from './pages/Home';
import './index.css';

// Lazy loading per tutte le pagine secondarie — riduce il bundle iniziale
const TwitchPage    = lazy(() => import('./pages/TwitchPage'));
const YouTubePage   = lazy(() => import('./pages/YouTubePage'));
const InstagramPage = lazy(() => import('./pages/InstagramPage'));
const PodcastPage   = lazy(() => import('./pages/PodcastPage'));
const TikTokPage    = lazy(() => import('./pages/TikTokPage'));
const GamePage      = lazy(() => import('./pages/GamePage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const ThreadView    = lazy(() => import('./components/ThreadView'));
const Scoiattoli    = lazy(() => import('./pages/tracker_scoiattoli'));
const ModPanel      = lazy(() => import('./pages/ModPanel'));
const FriendsPage        = lazy(() => import('./pages/FriendsPage'));
const MessagesPage       = lazy(() => import('./pages/MessagesPage'));
const ChatGeneralePage   = lazy(() => import('./pages/ChatGeneralePage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const ProfiloPage        = lazy(() => import('./pages/ProfiloPage'));

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

  return (
    <div className={`app-container${isStandalone ? ' pwa-standalone' : ''}`}>
      <Navbar />
      <SchermataCampione />
      <AnimatePresence mode="wait">
        <PageTransition key={location.pathname}>
          <Suspense fallback={<PaginaCaricamento />}>
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
        </PageTransition>
      </AnimatePresence>
      <Footer />
      <UpdateToast />
    </div>
  );
}

function App() {
  return (
    <Router>
      <TwitchAuthProvider>
        <TwitchOAuthRedirect />
        <AppLayout />
      </TwitchAuthProvider>
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;
