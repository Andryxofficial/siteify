import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import TwitchPage from './pages/TwitchPage';
import YouTubePage from './pages/YouTubePage';
import InstagramPage from './pages/InstagramPage';
import PodcastPage from './pages/PodcastPage';
import TikTokPage from './pages/TikTokPage';
//segreto
import Scoiattoli from './pages/tracker_scoiattoli';
import './index.css';

function App() {
  useEffect(() => {
    // Check for Twitch OAuth token in the URL hash
    const hash = window.location.hash;
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1)); // Remove the '#'
      const accessToken = params.get('access_token');
      if (accessToken) {
        localStorage.setItem('twitchAccessToken', accessToken);
        // Clean the URL without fully reloading the page
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  }, []);
  return (
    <Router>
      <div className="app-container">
        <Navbar />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/twitch" element={<TwitchPage />} />
            <Route path="/youtube" element={<YouTubePage />} />
            <Route path="/instagram" element={<InstagramPage />} />
            <Route path="/podcast" element={<PodcastPage />} />
            <Route path="/tiktok" element={<TikTokPage />} />

            <Route path="/scoiattoli" element={<Scoiattoli />} />
            
          </Routes>
        </AnimatePresence>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
