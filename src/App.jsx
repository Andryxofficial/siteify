import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { Component, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { TwitchAuthProvider } from './contexts/TwitchAuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { TemaProvider } from './contexts/TemaContext';
import { RetiProvider } from './contexts/RetiContext';
import { LinguaProvider, useLingua } from './contexts/LinguaContext';
import { TelegramProvider, useTelegram } from './contexts/TelegramContext';
import Navbar from './components/Navbar';
import SchermataCampione from './components/SchermataCampione';
import Footer from './components/Footer';
import PageTransition from './components/PageTransition';
import CookieBanner from './components/CookieBanner';
import BannerOffline from './components/BannerOffline';
import PromptInstalla from './components/PromptInstalla';
import IkigaiHelper from './components/IkigaiHelper';
import IkigaiAgencyToast from './components/IkigaiAgencyToast';
import SettingsPrivacyTail from './components/SettingsPrivacyTail';
import LegacySocialifyPurge from './components/LegacySocialifyPurge';
import useStandalone from './hooks/useStandalone';
import useScrollToTop from './hooks/useScrollToTop';
import useSwipeBack from './hooks/useSwipeBack';
import useThemeColor from './hooks/useThemeColor';
import useKeyboardInset from './hooks/useKeyboardInset';
import useReactiveExperience from './hooks/useReactiveExperience';
import useMobileSubmitBehavior from './hooks/useMobileSubmitBehavior';
import { avviaI18nDevGuard } from './i18n/i18nDevGuard';
import UpdateToast from './components/UpdateToast';
import Home from './pages/Home';
import FallbackRitardato from './components/FallbackRitardato';
import {
  TwitchPage, YouTubePage, InstagramPage, PodcastPage, TikTokPage,
  GamePage, CommunityPage, ThreadView, Scoiattoli, ModPanel,
  FriendsPage, MessagesPage, ChatGeneralePage, SettingsPage, ProfiloPage,
  AppPage, ChiSonoPage, TagInfoPage, TelegramPage, PrivacyPage,
  prefetchPagineMain,
} from './lazyPages';
import './index.css';

const GoalsOverlay  = lazy(() => import('./pages/overlay/GoalsOverlay'));
const EventsOverlay = lazy(() => import('./pages/overlay/EventsOverlay'));
const AlertsOverlay = lazy(() => import('./pages/overlay/AlertsOverlay'));

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { errore: null }; }
  static getDerivedStateFromError(err) { return { errore: err }; }
  componentDidCatch(err, info) { console.error('[ANDRYXify] Errore React non gestito:', err, info.componentStack); }
  render() { if (this.state.errore) return <ErrorFallback messaggio={this.state.errore.message} />; return this.props.children; }
}

function ErrorFallback({ messaggio }) {
  const { t } = useLingua();
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
      <span style={{ fontSize: '2.5rem' }}>⚠️</span>
      <h2 style={{ color: '#f87171', margin: 0 }}>{t('errore.titolo')}</h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.5 }}>{messaggio || t('errore.generico')}</p>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>{t('errore.ricarica')}</button>
    </div>
  );
}

function PaginaCaricamento() {
  return (
    <div className="main-content" style={{ paddingTop: '2rem', minHeight: '60vh' }}>
      <div className="glass-panel skeleton" style={{ height: 120, marginBottom: '1rem' }} />
      <div className="glass-panel skeleton" style={{ height: 240 }} />
      <div className="glass-panel skeleton" style={{ height: 180 }} />
    </div>
  );
}

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
        window.history.replaceState(null, '', location.pathname);
        const returnPath = sessionStorage.getItem('twitchAuthReturnPath');
        sessionStorage.removeItem('twitchAuthReturnPath');
        if (returnPath && returnPath !== location.pathname) navigate(returnPath, { replace: true });
        else if (location.pathname === '/') navigate('/gioco', { replace: true });
      }
    }
  }, [navigate, location]);
  return null;
}

const COLORE_PER_ROTTA = {
  '/twitch': '#9146FF', '/youtube': '#FF0000', '/instagram': '#E1306C', '/tiktok': '#000000',
  '/podcast': '#1DB954', '/gioco': '#0a0612', '/socialify': '#7c3aed', '/chat': '#0a0612',
};

function colorePerRotta(pathname) {
  if (!pathname) return null;
  for (const prefisso of Object.keys(COLORE_PER_ROTTA)) if (pathname === prefisso || pathname.startsWith(prefisso + '/')) return COLORE_PER_ROTTA[prefisso];
  return null;
}

function AppLayout() {
  const location = useLocation();
  const isStandalone = useStandalone();
  const { isTelegram } = useTelegram();
  useKeyboardInset();
  useMobileSubmitBehavior();
  useReactiveExperience();
  useScrollToTop();
  useSwipeBack(!isTelegram);
  useThemeColor(colorePerRotta(location.pathname));

  useEffect(() => { avviaI18nDevGuard(); }, []);

  useEffect(() => {
    const accento = localStorage.getItem('andryxify_tema');
    const colori = { default: '#e040fb', magenta: '#ff4081', cyan: '#00e5ff', amber: '#ffb300', emerald: '#4ade80' };
    if (accento && colori[accento]) document.documentElement.style.setProperty('--primary', colori[accento]);
  }, []);

  useEffect(() => {
    const splash = document.getElementById('andryx-splash');
    if (!splash) return;
    splash.classList.add('nascosto');
    const t = setTimeout(() => splash.remove(), 260);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => { prefetchPagineMain(); }, []);

  return (
    <div className={`app-container${isStandalone ? ' pwa-standalone' : ''}${isTelegram ? ' tg-app' : ''}`}>
      {!isTelegram && <Navbar />}
      <SchermataCampione />
      <LegacySocialifyPurge />
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
                <Route path="/giochi" element={<GamePage />} />
                <Route path="/socialify" element={<CommunityPage />} />
                <Route path="/socialify/info-tag" element={<TagInfoPage />} />
                <Route path="/socialify/:postId" element={<ThreadView />} />
                <Route path="/scoiattoli" element={<Scoiattoli />} />
                <Route path="/mod-panel" element={<ModPanel />} />
                <Route path="/amici" element={<FriendsPage />} />
                <Route path="/messaggi" element={<MessagesPage />} />
                <Route path="/chat" element={<ChatGeneralePage />} />
                <Route path="/impostazioni" element={<SettingsPage />} />
                <Route path="/profilo/:username" element={<ProfiloPage />} />
                <Route path="/app" element={<AppPage />} />
                <Route path="/chi-sono" element={<ChiSonoPage />} />
                <Route path="/telegram" element={<TelegramPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
              </Routes>
              <SettingsPrivacyTail />
            </Suspense>
          </ErrorBoundary>
        </PageTransition>
      </AnimatePresence>
      {!isTelegram && <Footer />}
      {!isTelegram && <IkigaiAgencyToast />}
      {!isTelegram && <IkigaiHelper />}
      <UpdateToast />
      <BannerOffline />
      <PromptInstalla />
      <CookieBanner />
    </div>
  );
}

function App() {
  return (
    <Router>
      <TemaProvider>
        <LinguaProvider>
          <RetiProvider>
            <TelegramProvider>
              <TwitchAuthProvider>
                <ToastProvider>
                  <TwitchOAuthRedirect />
                  <Routes>
                    <Route path="/overlay/goals" element={<Suspense fallback={null}><GoalsOverlay /></Suspense>} />
                    <Route path="/overlay/events" element={<Suspense fallback={null}><EventsOverlay /></Suspense>} />
                    <Route path="/overlay/alerts" element={<Suspense fallback={null}><AlertsOverlay /></Suspense>} />
                    <Route path="*" element={<AppLayout />} />
                  </Routes>
                </ToastProvider>
              </TwitchAuthProvider>
            </TelegramProvider>
          </RetiProvider>
        </LinguaProvider>
      </TemaProvider>
      <Analytics />
      <SpeedInsights />
    </Router>
  );
}

export default App;
