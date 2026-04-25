const SOCIALIFY_BAD_COPY = [
  'tendenze neurali',
  'evoluzione organica',
  'evoluzione organica v2.0',
];

function isSocialifyPath() {
  return typeof window !== 'undefined' && window.location.pathname.startsWith('/socialify');
}

function trovaPannello(node) {
  if (!node || !(node instanceof HTMLElement)) return null;
  return node.closest('.glass-panel, .glass-card, aside, section, article, div');
}

function cleanupSocialifyBadCopy() {
  if (!isSocialifyPath() || typeof document === 'undefined') return;

  const candidates = [...document.querySelectorAll('aside, section, article, .glass-panel, .glass-card, div')];
  for (const el of candidates) {
    const text = (el.textContent || '').toLowerCase();
    if (!text) continue;
    const hasBadCopy = SOCIALIFY_BAD_COPY.some(fragment => text.includes(fragment));
    if (!hasBadCopy) continue;

    const panel = trovaPannello(el) || el;
    panel.setAttribute('data-socialify-hidden-bad-copy', 'true');
    panel.style.display = 'none';
  }
}

export function installSocialifyUiCleanup() {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;

  const run = () => requestAnimationFrame(cleanupSocialifyBadCopy);
  run();

  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    run();
    return result;
  };
  history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    run();
    return result;
  };
  window.addEventListener('popstate', run);
}
