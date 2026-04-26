import { useEffect } from 'react';

function trovaForm(el) {
  return el?.closest?.('form');
}

function eComposer(el) {
  if (!el) return false;
  return !!el.closest?.([
    '.ikigai-input',
    '.comment-composer',
    '.post-composer',
    '.new-post-form',
    '.reply-form',
    '.chat-input',
    '[data-enter-submit="true"]',
  ].join(','));
}

function inviaForm(form) {
  if (!form) return false;
  if (typeof form.requestSubmit === 'function') {
    form.requestSubmit();
    return true;
  }
  const submit = form.querySelector('button[type="submit"], input[type="submit"]');
  if (submit) {
    submit.click();
    return true;
  }
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  return true;
}

export default function useMobileSubmitBehavior() {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const onKeyDown = (event) => {
      if (event.key !== 'Enter') return;
      if (event.defaultPrevented) return;
      const el = event.target;
      const tag = el?.tagName?.toLowerCase();
      if (!['input', 'textarea'].includes(tag) && !el?.isContentEditable) return;
      if (!eComposer(el)) return;

      // Shift+Enter resta a-capo nei campi multilinea.
      if (event.shiftKey && (tag === 'textarea' || el?.isContentEditable)) return;

      const form = trovaForm(el);
      if (!form) return;
      event.preventDefault();
      inviaForm(form);
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);
}
