import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TwitchAuthProvider } from './contexts/TwitchAuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PageTransition from './components/PageTransition';
import useStandalone from './hooks/useStandalone';
import useScrollToTop from './hooks/useScrollToTop';
import Home from './pages/Home';
import TwitchPage from './pages/TwitchPage';
import YouTubePage from './pages/YouTubePage';
import InstagramPage from './pages/InstagramPage';
import PodcastPage from './pages/PodcastPage';
import TikTokPage from './pages/TikTokPage';
import GamePage from './pages/GamePage';
import CommunityPage from './pages/CommunityPage';
import ThreadView from './components/ThreadView';
//segreto
import Scoiattoli from './pages/tracker_scoiattoli';
import ModPanel from './pages/ModPanel';
import './index.css';

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
      <AnimatePresence mode="wait">
        <PageTransition key={location.pathname}>
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
            
          </Routes>
        </PageTransition>
      </AnimatePresence>
      <Footer />
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
    </Router>
  );
}

export default App;
