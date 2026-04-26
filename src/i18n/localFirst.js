export const LOCAL_FIRST_TEXT = {
  it: {
    livePrivacyTitle: 'ANDRYXify',
    livePrivacyText: 'Preview live disattivata in modalità privacy-first. Apri Twitch solo quando vuoi tu.',
    principleTitle: 'Locale, sicuro, privacy-first',
    principleText: 'ANDRYXify non richiede API esterne per funzionare. Le funzioni devono privilegiare logica locale, dati minimi, sicurezza e controllo dell’utente.',
  },
  en: {
    livePrivacyTitle: 'ANDRYXify',
    livePrivacyText: 'Live preview is disabled in privacy-first mode. Open Twitch only when you choose to.',
    principleTitle: 'Local, secure, privacy-first',
    principleText: 'ANDRYXify does not require external APIs to work. Features must prioritize local logic, minimal data, security and user control.',
  },
  es: {
    livePrivacyTitle: 'ANDRYXify',
    livePrivacyText: 'La vista previa en directo está desactivada en modo privacy-first. Abre Twitch solo cuando tú lo decidas.',
    principleTitle: 'Local, seguro, privacy-first',
    principleText: 'ANDRYXify no requiere APIs externas para funcionar. Las funciones deben priorizar lógica local, datos mínimos, seguridad y control del usuario.',
  },
};

export function localFirstText(lingua = 'it') {
  const codice = String(lingua || 'it').toLowerCase().slice(0, 2);
  return LOCAL_FIRST_TEXT[codice] || LOCAL_FIRST_TEXT.it;
}
