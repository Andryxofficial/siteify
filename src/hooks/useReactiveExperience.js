import { useEffect } from 'react';
import { hapticLight } from '../utils/haptics';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const COPY_FIXES = new Map([
  ['Le notifiche push non sono supportate da questa membrana cellulare (browser).', 'Le notifiche push non sono supportate da questo browser.'],
  ['Sistema Endocrino: Notifiche', 'Notifiche'],
  ['Selettore Personalizzato Biologico', 'Colore personalizzato'],
  ['Sistema Nervoso', 'Notifiche'],
]);

const COPY_FIXES_BY_LANG = {
  it: new Map([
    ['settings.tema.label: Alba/Tramonto', 'Tema: Alba/Tramonto'],
    ['settings.tema.label: Amanecer/Atardecer', 'Tema: Alba/Tramonto'],
    ['settings.tema.label:', 'Tema:'],
    ['Vedi profilo', 'Vedi profilo'],
    ['Impostazioni', 'Impostazioni'],
    ['Logout', 'Esci'],
    ['Tema: Amanecer/Atardecer (según la hora)', 'Tema: Alba/Tramonto'],
  ]),
  en: new Map([
    ['settings.tema.label: Alba/Tramonto', 'Theme: Sunrise/Sunset'],
    ['settings.tema.label: Amanecer/Atardecer', 'Theme: Sunrise/Sunset'],
    ['settings.tema.label:', 'Theme:'],
    ['Vedi profilo', 'View profile'],
    ['Impostazioni', 'Settings'],
    ['Esci', 'Log out'],
    ['Tema: Chiaro', 'Theme: Light'],
    ['Tema: Scuro', 'Theme: Dark'],
    ['Tema: Auto', 'Theme: Auto'],
    ['Tema: Alba/Tramonto', 'Theme: Sunrise/Sunset'],
    ['Tema: Alba/Tramonto (in base all\'ora)', 'Theme: Sunrise/Sunset'],
    ['Tema: Amanecer/Atardecer (según la hora)', 'Theme: Sunrise/Sunset'],
  ]),
  es: new Map([
    ['settings.tema.label: Alba/Tramonto', 'Tema: Amanecer/Atardecer'],
    ['settings.tema.label: Amanecer/Atardecer', 'Tema: Amanecer/Atardecer'],
    ['settings.tema.label:', 'Tema:'],
    ['Vedi profilo', 'Ver perfil'],
    ['Impostazioni', 'Ajustes'],
    ['Esci', 'Cerrar sesión'],
    ['Logout', 'Cerrar sesión'],
    ['Tema: Chiaro', 'Tema: Claro'],
    ['Tema: Scuro', 'Tema: Oscuro'],
    ['Tema: Auto', 'Tema: Auto'],
    ['Tema: Alba/Tramonto', 'Tema: Amanecer/Atardecer'],
    ['Tema: Alba/Tramonto (in base all\'ora)', 'Tema: Amanecer/Atardecer'],
    ['Tema: Amanecer/Atardecer (según la hora)', 'Tema: Amanecer/Atardecer'],
  ]),
};

const SWIPE_SELECTOR = [
  '.tab-list', '.tabs', '.feed-tabs', '.category-tabs', '.tag-row', '.tags-row',
  '.social-tags-row', '.smart-tags-row', '.ikigai-suggestions', '.quick-actions',
  '.profile-menu-actions', '.notification-chips', '.privacy-actions', '.settings-buttons-row'
].join(',');

function linguaCorrente() {
  if (typeof document === 'undefined') return 'it';
  const lang = document.documentElement.getAttribute('lang') || 'it';
  if (lang.startsWith('en')) return 'en';
  if (lang.startsWith('es')) return 'es';
  return 'it';
}

function applicaCopyFixes(testo = '') {
  let prossimo = String(testo || '');
  for (const [brutto, pulito] of COPY_FIXES.entries()) prossimo = prossimo.replaceAll(brutto, pulito);
  const langMap = COPY_FIXES_BY_LANG[linguaCorrente()] || COPY_FIXES_BY_LANG.it;
  for (const [brutto, pulito] of langMap.entries()) prossimo = prossimo.replaceAll(brutto, pulito);
  prossimo = prossimo
    .replace(/settings\.tema\.label:\s*(Alba\/Tramonto|Amanecer\/Atardecer|Sunrise\/Sunset)/gi, (_, tema) => {
      const lang = linguaCorrente();
      if (lang === 'en') return 'Theme: Sunrise/Sunset';
      if (lang === 'es') return 'Tema: Amanecer/Atardecer';
      return 'Tema: Alba/Tramonto';
    })
    .replace(/settings\.tema\.label:\s*/gi, linguaCorrente() === 'en' ? 'Theme: ' : 'Tema: ');
  return prossimo;
}

function ripulisciMenuProfilo() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.mobile-profile-menu button').forEach((button) => {
    const testo = (button.textContent || '').replace(/\s+/g, ' ').trim();
    if (/settings\.tema\.label/i.test(testo)) {
      const lang = linguaCorrente();
      const icona = button.querySelector('svg');
      const label = lang === 'en' ? 'Theme: Sunrise/Sunset' : lang === 'es' ? 'Tema: Amanecer/Atardecer' : 'Tema: Alba/Tramonto';
      button.textContent = '';
      if (icona) button.appendChild(icona);
      button.appendChild(document.createTextNode(` ${label}`));
    }
  });
}

function prefersReducedMotion() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function setVar(name, value) {
  document.documentElement.style.setProperty(name, value);
}

function isInteractiveTarget(target) {
  return !!target?.closest?.('a,button,input,textarea,select,[role="button"],[data-reactive],.btn,.glass-panel,.glass-card,.tab-item,.chip');
}

function sistemaCopyProfessionale(root = document.body) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const testo = node.nodeValue;
    if (!testo) continue;
    const prossimo = applicaCopyFixes(testo);
    if (prossimo !== testo) node.nodeValue = prossimo;
  }
  ripulisciMenuProfilo();
}

function aggiornaSwipeClassi(root = document) {
  root.querySelectorAll?.(SWIPE_SELECTOR).forEach((el) => {
    if (!(el instanceof HTMLElement)) return;
    const scrollabile = el.scrollWidth > el.clientWidth + 8;
    el.classList.toggle('is-swipeable', scrollabile);
    el.classList.toggle('is-at-start', el.scrollLeft <= 4);
    el.classList.toggle('is-at-end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
  });
}

export default function useReactiveExperience() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const body = document.body;
    const reduced = prefersReducedMotion();
    body.classList.toggle('motion-reduced', reduced);
    body.classList.add('reactive-ready', 'app-grade-ui');

    let raf = 0;
    let lastScrollY = window.scrollY || 0;
    let scrollDir = 'still';
    let pointerX = 0.5;
    let pointerY = 0.5;
    let targetPointerX = 0.5;
    let targetPointerY = 0.5;
    let scrollVelocity = 0;
    let lastScrollT = performance.now();
    let tiltX = 0;
    let tiltY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let idleTimer = null;
    let swipeTimer = null;

    setVar('--rx', '50%');
    setVar('--ry', '38%');
    setVar('--rx-scroll', '0');
    setVar('--rx-velocity', '0');
    setVar('--rx-tilt-x', '0deg');
    setVar('--rx-tilt-y', '0deg');
    setVar('--rx-depth', '0');

    sistemaCopyProfessionale();
    aggiornaSwipeClassi();

    const langObserver = new MutationObserver(() => sistemaCopyProfessionale());
    langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

    const copyObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.TEXT_NODE) {
              const prossimo = applicaCopyFixes(node.nodeValue || '');
              if (prossimo !== node.nodeValue) node.nodeValue = prossimo;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              sistemaCopyProfessionale(node);
              aggiornaSwipeClassi(node);
            }
          });
        } else if (mutation.type === 'characterData') {
          const node = mutation.target;
          const prossimo = applicaCopyFixes(node.nodeValue || '');
          if (prossimo !== node.nodeValue) node.nodeValue = prossimo;
        }
      }
      ripulisciMenuProfilo();
      aggiornaSwipeClassi();
    });
    copyObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

    const markActive = () => {
      body.classList.add('user-active');
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => body.classList.remove('user-active'), 1200);
    };

    const tick = () => {
      raf = 0;
      pointerX += (targetPointerX - pointerX) * 0.16;
      pointerY += (targetPointerY - pointerY) * 0.16;
      tiltX += (targetTiltX - tiltX) * 0.08;
      tiltY += (targetTiltY - tiltY) * 0.08;

      const y = window.scrollY || 0;
      const doc = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = clamp(y / doc, 0, 1);
      const depth = Math.round(progress * 1000) / 1000;

      setVar('--rx', `${Math.round(pointerX * 10000) / 100}%`);
      setVar('--ry', `${Math.round(pointerY * 10000) / 100}%`);
      setVar('--rx-scroll', String(depth));
      setVar('--rx-velocity', String(Math.round(scrollVelocity * 1000) / 1000));
      setVar('--rx-tilt-x', `${Math.round(tiltX * 100) / 100}deg`);
      setVar('--rx-tilt-y', `${Math.round(tiltY * 100) / 100}deg`);
      setVar('--rx-depth', String(depth));
    };

    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(tick);
    };

    const onPointerMove = (event) => {
      if (event.pointerType === 'touch') return;
      targetPointerX = clamp(event.clientX / Math.max(1, window.innerWidth), 0, 1);
      targetPointerY = clamp(event.clientY / Math.max(1, window.innerHeight), 0, 1);
      body.classList.toggle('interactive-hover', isInteractiveTarget(event.target));
      markActive();
      schedule();
    };

    const onPointerDown = (event) => {
      body.classList.add('pointer-pressing');
      targetPointerX = clamp(event.clientX / Math.max(1, window.innerWidth), 0, 1);
      targetPointerY = clamp(event.clientY / Math.max(1, window.innerHeight), 0, 1);
      if (isInteractiveTarget(event.target)) hapticLight();
      markActive();
      schedule();
    };

    const onPointerUp = () => {
      body.classList.remove('pointer-pressing');
      schedule();
    };

    const onScroll = () => {
      const now = performance.now();
      const y = window.scrollY || 0;
      const delta = y - lastScrollY;
      const dt = Math.max(16, now - lastScrollT);
      scrollVelocity = clamp(Math.abs(delta) / dt, 0, 2.8);
      scrollDir = delta > 1 ? 'down' : delta < -1 ? 'up' : scrollDir;
      body.dataset.scrollDir = scrollDir;
      body.classList.add('is-scrolling');
      clearTimeout(onScroll.timer);
      onScroll.timer = setTimeout(() => body.classList.remove('is-scrolling'), 180);
      lastScrollY = y;
      lastScrollT = now;
      markActive();
      schedule();
    };

    const onSwipeScroll = (event) => {
      const el = event.target?.closest?.(SWIPE_SELECTOR);
      if (!(el instanceof HTMLElement)) return;
      el.classList.add('is-swiping');
      el.classList.toggle('is-at-start', el.scrollLeft <= 4);
      el.classList.toggle('is-at-end', el.scrollLeft + el.clientWidth >= el.scrollWidth - 4);
      clearTimeout(swipeTimer);
      swipeTimer = setTimeout(() => el.classList.remove('is-swiping'), 160);
    };

    const onTouchStart = (event) => {
      const touch = event.touches?.[0];
      if (!touch) return;
      targetPointerX = clamp(touch.clientX / Math.max(1, window.innerWidth), 0, 1);
      targetPointerY = clamp(touch.clientY / Math.max(1, window.innerHeight), 0, 1);
      body.classList.add('touch-active');
      const swipeEl = event.target?.closest?.(SWIPE_SELECTOR);
      if (swipeEl instanceof HTMLElement) swipeEl.classList.add('is-touching');
      if (isInteractiveTarget(event.target)) hapticLight();
      markActive();
      schedule();
    };

    const onTouchEnd = () => {
      body.classList.remove('touch-active');
      document.querySelectorAll('.is-touching').forEach(el => el.classList.remove('is-touching'));
      schedule();
    };

    const onDeviceMotion = (event) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      targetTiltX = clamp((acc.y || 0) * 0.42, -4, 4);
      targetTiltY = clamp((acc.x || 0) * -0.42, -4, 4);
      body.classList.add('motion-sensors-active');
      schedule();
    };

    const enableMotionSensors = async () => {
      if (reduced || !('DeviceMotionEvent' in window)) return;
      try {
        const DME = window.DeviceMotionEvent;
        if (typeof DME.requestPermission === 'function') {
          const ok = await DME.requestPermission();
          if (ok !== 'granted') return;
        }
        window.addEventListener('devicemotion', onDeviceMotion, { passive: true });
      } catch {}
    };

    const onFirstGesture = () => {
      enableMotionSensors();
      window.removeEventListener('pointerdown', onFirstGesture, true);
      window.removeEventListener('touchstart', onFirstGesture, true);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', onPointerUp, { passive: true });
    window.addEventListener('pointercancel', onPointerUp, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', onSwipeScroll, true);
    window.addEventListener('resize', aggiornaSwipeClassi, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchEnd, { passive: true });
    window.addEventListener('pointerdown', onFirstGesture, true);
    window.addEventListener('touchstart', onFirstGesture, true);

    schedule();

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
      clearTimeout(swipeTimer);
      clearTimeout(onScroll.timer);
      copyObserver.disconnect();
      langObserver.disconnect();
      body.classList.remove('reactive-ready', 'app-grade-ui', 'user-active', 'interactive-hover', 'pointer-pressing', 'touch-active', 'is-scrolling', 'motion-sensors-active');
      delete body.dataset.scrollDir;
      document.querySelectorAll('.is-swipeable,.is-swiping,.is-touching,.is-at-start,.is-at-end').forEach(el => el.classList.remove('is-swipeable', 'is-swiping', 'is-touching', 'is-at-start', 'is-at-end'));
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', onSwipeScroll, true);
      window.removeEventListener('resize', aggiornaSwipeClassi);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('devicemotion', onDeviceMotion);
      window.removeEventListener('pointerdown', onFirstGesture, true);
      window.removeEventListener('touchstart', onFirstGesture, true);
    };
  }, []);
}
