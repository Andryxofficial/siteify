import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import TwitchPage from './pages/TwitchPage';
import YouTubePage from './pages/YouTubePage';
import InstagramPage from './pages/InstagramPage';
import PodcastPage from './pages/PodcastPage';
//segreto
import Scoiattoli from './pages/tracker_scoiattoli';
import './index.css';

function App() {
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

            <Route path="/scoiattoli" element={<Scoiattoli />} />
            
          </Routes>
        </AnimatePresence>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
