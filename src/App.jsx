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
import GamePage from './pages/GamePage';
//segreto
import Scoiattoli from './pages/tracker_scoiattoli';
import './index.css';

function App() {
  // Twitch OAuth hash is handled directly by GamePage.jsx
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
            <Route path="/gioco" element={<GamePage />} />

            <Route path="/scoiattoli" element={<Scoiattoli />} />
            
          </Routes>
        </AnimatePresence>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
