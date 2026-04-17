import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PageTransition from './components/PageTransition';
import useStandalone from './hooks/useStandalone';
import Home from './pages/Home';
import TwitchPage from './pages/TwitchPage';
import YouTubePage from './pages/YouTubePage';
import InstagramPage from './pages/InstagramPage';
import PodcastPage from './pages/PodcastPage';
import TikTokPage from './pages/TikTokPage';
import GamePage from './pages/GamePage';
//segreto
import Scoiattoli from './pages/tracker_scoiattoli';
import './index.css';

/* ─── Global Twitch OAuth hash handler ───
   Twitch may redirect to the root URL (or any page) depending on the
   registered redirect URI in the developer console. This component
   catches the access_token hash on ANY route, persists it, and
   navigates to /gioco so GamePage can pick it up.                    */
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
        // Clean the hash from the URL
        window.history.replaceState(null, '', location.pathname);
        // If we're not already on the game page, navigate there
        if (location.pathname !== '/gioco') {
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

            <Route path="/scoiattoli" element={<Scoiattoli />} />
            
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
      <TwitchOAuthRedirect />
      <AppLayout />
    </Router>
  );
}

export default App;
