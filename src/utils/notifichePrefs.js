export const NOTIFICHE_PREFS_KEY = 'andryxify_notifiche_prefs_v2';

export const NOTIFICHE_DEFAULT_PREFS = {
  inApp: true,
  push: true,
  sound: true,
  vibration: true,
  previews: true,
  groupSimilar: true,
  priorityOnly: false,
  quietHours: false,
  quietStart: '22:30',
  quietEnd: '08:00',
  categories: {
    messages: true,
    replies: true,
    mentions: true,
    likes: true,
    friends: true,
    community: true,
    live: true,
    system: true,
  },
};

export const NOTIFICHE_CATEGORIE = [
  { id: 'messages', label: 'Messaggi privati', desc: 'DM, conversazioni e messaggi personali.' },
  { id: 'replies', label: 'Risposte', desc: 'Risposte ai tuoi post o commenti.' },
  { id: 'mentions', label: 'Menzioni', desc: 'Quando qualcuno ti cita con @.' },
  { id: 'likes', label: 'Mi piace e reazioni', desc: 'Like, preferiti e interazioni leggere.' },
  { id: 'friends', label: 'Amici', desc: 'Richieste e aggiornamenti dagli amici.' },
  { id: 'community', label: 'Community', desc: 'Attività pubbliche su SOCIALify.' },
  { id: 'live', label: 'Live e Twitch', desc: 'Avvisi live, streaming e contenuti Twitch.' },
  { id: 'system', label: 'Sistema', desc: 'Aggiornamenti importanti e sicurezza.' },
];

export function mergePreferenzeNotifiche(raw) {
  return {
    ...NOTIFICHE_DEFAULT_PREFS,
    ...(raw || {}),
    categories: {
      ...NOTIFICHE_DEFAULT_PREFS.categories,
      ...(raw?.categories || {}),
    },
  };
}

export function leggiPreferenzeNotifiche() {
  if (typeof window === 'undefined') return NOTIFICHE_DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(NOTIFICHE_PREFS_KEY);
    return mergePreferenzeNotifiche(raw ? JSON.parse(raw) : null);
  } catch {
    return NOTIFICHE_DEFAULT_PREFS;
  }
}

export function salvaPreferenzeNotifiche(prefs) {
  if (typeof window === 'undefined') return mergePreferenzeNotifiche(prefs);
  const merged = mergePreferenzeNotifiche(prefs);
  window.localStorage.setItem(NOTIFICHE_PREFS_KEY, JSON.stringify(merged));
  window.dispatchEvent(new CustomEvent('andryxify:notifiche-prefs', { detail: merged }));
  return merged;
}

export function buildServerPrefsNotifiche(prefs = leggiPreferenzeNotifiche()) {
  const merged = mergePreferenzeNotifiche(prefs);
  return {
    push: !!merged.push,
    inApp: !!merged.inApp,
    sound: !!merged.sound,
    vibration: !!merged.vibration,
    previews: !!merged.previews,
    groupSimilar: !!merged.groupSimilar,
    priorityOnly: !!merged.priorityOnly,
    quietHours: !!merged.quietHours,
    quietStart: merged.quietStart || NOTIFICHE_DEFAULT_PREFS.quietStart,
    quietEnd: merged.quietEnd || NOTIFICHE_DEFAULT_PREFS.quietEnd,
    categories: { ...merged.categories },
  };
}
