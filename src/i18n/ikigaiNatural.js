export const IKIGAI_UI = {
  it: {
    welcome: 'Eccomi. Dimmi cosa vuoi capire del sito: funzioni, SOCIALify, classifiche, premi, tag, notifiche o impostazioni.',
    suggestions: [
      'Cosa posso fare sul sito?',
      'Come salgo in classifica?',
      'A cosa servono i tag?',
      'Come gestisco le notifiche?',
    ],
    placeholder: 'Chiedi a Ikigai...',
    loading: 'Ci penso un attimo…',
    error: 'Mh, qui mi si è inceppato il collegamento. Riprova tra poco e ti rispondo meglio.',
    openAria: 'Apri Ikigai',
    closeAria: 'Chiudi Ikigai',
    privacyAria: 'Apri informativa privacy di Ikigai',
    privacyTitle: 'Privacy di Ikigai',
    linksAria: 'Collegamenti suggeriti da Ikigai',
    sendAria: 'Invia',
    openRoute: label => `Apri ${label}`,
  },
  en: {
    welcome: 'I’m here. Tell me what you want to understand: features, SOCIALify, rankings, rewards, tags, notifications or settings.',
    suggestions: [
      'What can I do on the site?',
      'How do I climb the ranking?',
      'What are tags for?',
      'How do I manage notifications?',
    ],
    placeholder: 'Ask Ikigai...',
    loading: 'Give me a second…',
    error: 'Something got stuck for a second. Try again and I’ll answer properly.',
    openAria: 'Open Ikigai',
    closeAria: 'Close Ikigai',
    privacyAria: 'Open Ikigai privacy information',
    privacyTitle: 'Ikigai privacy',
    linksAria: 'Links suggested by Ikigai',
    sendAria: 'Send',
    openRoute: label => `Open ${label}`,
  },
  es: {
    welcome: 'Estoy aquí. Dime qué quieres entender del sitio: funciones, SOCIALify, clasificaciones, premios, etiquetas, notificaciones o ajustes.',
    suggestions: [
      '¿Qué puedo hacer en el sitio?',
      '¿Cómo subo en la clasificación?',
      '¿Para qué sirven las etiquetas?',
      '¿Cómo gestiono las notificaciones?',
    ],
    placeholder: 'Pregunta a Ikigai...',
    loading: 'Déjame pensarlo un momento…',
    error: 'Algo se atascó un momento. Inténtalo de nuevo y te contesto bien.',
    openAria: 'Abrir Ikigai',
    closeAria: 'Cerrar Ikigai',
    privacyAria: 'Abrir información de privacidad de Ikigai',
    privacyTitle: 'Privacidad de Ikigai',
    linksAria: 'Enlaces sugeridos por Ikigai',
    sendAria: 'Enviar',
    openRoute: label => `Abrir ${label}`,
  },
};

export function ikigaiUiText(lingua = 'it') {
  const codice = String(lingua || 'it').toLowerCase().slice(0, 2);
  return IKIGAI_UI[codice] || IKIGAI_UI.it;
}
