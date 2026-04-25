export const SICUREZZA_LOCALE = Object.freeze({
  localFirst: true,
  privacyFirst: true,
  noExternalApisByDefault: true,
  noExternalScriptsByDefault: true,
  noExternalIframesByDefault: true,
  noThirdPartyTraining: true,
  allowedUserInitiatedExternalLinks: true,
});

export function puoCaricareRisorsaEsterna({ userInitiated = false } = {}) {
  if (userInitiated && SICUREZZA_LOCALE.allowedUserInitiatedExternalLinks) return true;
  return !SICUREZZA_LOCALE.noExternalApisByDefault;
}
