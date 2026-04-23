/**
 * TelegramContext — Integrazione Telegram Mini App per ANDRYXify.
 *
 * Rileva automaticamente se l'app è in esecuzione nella WebView di Telegram
 * (tramite `window.Telegram.WebApp`). Se sì, inizializza l'SDK, espande il
 * viewport a schermo intero e sincronizza il tema con i colori di Telegram.
 *
 * Quando l'app NON è dentro Telegram, tutti i valori sono null/false e
 * l'app funziona esattamente come prima — nessun side effect.
 *
 * Uso:
 *   const { isTelegram, tgUser, haptic, mainButton } = useTelegram();
 */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const TelegramContext = createContext(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useTelegram() {
  const ctx = useContext(TelegramContext);
  if (!ctx) throw new Error('useTelegram deve essere usato dentro TelegramProvider');
  return ctx;
}

/** Carica lo script SDK Telegram una sola volta (idempotente). */
let sdkPromise = null;
function loadTelegramSdk() {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-web-app.js';
    script.async = true;
    script.onload  = () => resolve(window.Telegram?.WebApp ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export function TelegramProvider({ children }) {
  const [isTelegram, setIsTelegram]   = useState(false);
  const [webApp,     setWebApp]       = useState(null);
  const [tgUser,     setTgUser]       = useState(null);
  const [tgTheme,    setTgTheme]      = useState(null);
  const [pronto,     setPronto]       = useState(false);
  const mainBtnRef = useRef(null);
  const backBtnRef = useRef(null);

  useEffect(() => {
    loadTelegramSdk().then((wa) => {
      if (!wa || !wa.initData) {
        // Non siamo in Telegram — nessun initData disponibile
        setPronto(true);
        return;
      }

      // Siamo dentro Telegram
      setIsTelegram(true);
      setWebApp(wa);

      // Notifica a Telegram che l'app è pronta (rimuove lo splash nativo)
      try { wa.ready(); } catch { /* ignora */ }

      // Espandi al massimo (full-screen nella WebView)
      try { wa.expand(); } catch { /* ignora */ }

      // Utente Telegram
      if (wa.initDataUnsafe?.user) {
        const u = wa.initDataUnsafe.user;
        setTgUser({
          id:          u.id,
          firstName:   u.first_name || '',
          lastName:    u.last_name  || '',
          username:    u.username   || null,
          languageCode: u.language_code || 'it',
          isPremium:   u.is_premium || false,
          photoUrl:    u.photo_url  || null,
        });
      }

      // Parametri tema Telegram (bg, text, button, hint, link)
      const tp = wa.themeParams || {};
      setTgTheme({
        bgColor:         tp.bg_color         || '#0f0f0f',
        textColor:       tp.text_color        || '#ffffff',
        hintColor:       tp.hint_color        || '#999999',
        linkColor:       tp.link_color        || '#9146FF',
        buttonColor:     tp.button_color      || '#E040FB',
        buttonTextColor: tp.button_text_color || '#ffffff',
        secondaryBg:     tp.secondary_bg_color || '#1a1a2e',
      });

      // Sincronizza colori CSS con il tema Telegram
      try {
        if (tp.button_color) {
          document.documentElement.style.setProperty('--primary', tp.button_color);
        }
        if (tp.bg_color) {
          document.documentElement.style.setProperty('--bg-dark', tp.bg_color);
        }
      } catch { /* ignora */ }

      // Ascolta i cambi di tema dinamici (utente cambia tema Telegram)
      try {
        wa.onEvent('themeChanged', () => {
          const np = wa.themeParams || {};
          setTgTheme({
            bgColor:         np.bg_color         || '#0f0f0f',
            textColor:       np.text_color        || '#ffffff',
            hintColor:       np.hint_color        || '#999999',
            linkColor:       np.link_color        || '#9146FF',
            buttonColor:     np.button_color      || '#E040FB',
            buttonTextColor: np.button_text_color || '#ffffff',
            secondaryBg:     np.secondary_bg_color || '#1a1a2e',
          });
        });
      } catch { /* ignora */ }

      mainBtnRef.current = wa.MainButton   || null;
      backBtnRef.current = wa.BackButton   || null;

      setPronto(true);
    });
  }, []);

  /* ── Haptic feedback via Telegram API ── */
  const haptic = {
    impact:  (style = 'medium') => {
      try { webApp?.HapticFeedback?.impactOccurred(style); } catch { /* ignora */ }
    },
    notifica: (tipo = 'success') => {
      try { webApp?.HapticFeedback?.notificationOccurred(tipo); } catch { /* ignora */ }
    },
    selezione: () => {
      try { webApp?.HapticFeedback?.selectionChanged(); } catch { /* ignora */ }
    },
  };

  /* ── MainButton helpers ── */
  const mainButton = {
    mostra: (testo, onClick) => {
      const mb = mainBtnRef.current;
      if (!mb) return;
      mb.setText(testo || 'OK');
      mb.onClick(onClick);
      mb.show();
    },
    nascondi: () => {
      try { mainBtnRef.current?.hide(); mainBtnRef.current?.offClick(); } catch { /* ignora */ }
    },
    caricamento: (attivo) => {
      const mb = mainBtnRef.current;
      if (!mb) return;
      attivo ? mb.showProgress() : mb.hideProgress();
    },
  };

  /* ── BackButton helpers ── */
  const backButton = {
    mostra: (onClick) => {
      const bb = backBtnRef.current;
      if (!bb) return;
      bb.onClick(onClick);
      bb.show();
    },
    nascondi: () => {
      try { backBtnRef.current?.hide(); backBtnRef.current?.offClick(); } catch { /* ignora */ }
    },
  };

  /* ── Apri link nel browser esterno (utile per OAuth Twitch) ── */
  const apriLink = useCallback((url) => {
    if (webApp?.openLink) {
      try { webApp.openLink(url); return; } catch { /* fallback */ }
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [webApp]);

  /* ── Chiudi la Mini App ── */
  const chiudi = useCallback(() => {
    try { webApp?.close(); } catch { /* ignora */ }
  }, [webApp]);

  /* ── initData raw (per validazione server-side) ── */
  const initData = webApp?.initData ?? '';

  return (
    <TelegramContext.Provider value={{
      isTelegram,
      webApp,
      tgUser,
      tgTheme,
      pronto,
      initData,
      haptic,
      mainButton,
      backButton,
      apriLink,
      chiudi,
    }}>
      {children}
    </TelegramContext.Provider>
  );
}
