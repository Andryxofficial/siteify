import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IKIGAI_AGENCY_EVENT,
  canIkigaiAdvise,
  dismissIkigaiTopic,
  markIkigaiAdvised,
  silenceIkigai,
} from '../utils/ikigaiAgency';
import { useLingua } from '../contexts/LinguaContext';

function langKey(lingua = 'it') {
  const l = String(lingua || 'it').toLowerCase();
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('es')) return 'es';
  return 'it';
}

const COPY = {
  it: {
    close: 'Chiudi consiglio',
    later: 'Più tardi',
    ask: 'Chiedi a Ikigai',
    title: 'Ikigai ti dà una mano',
    death: ({ label }) => `Ti vedo morire spesso su ${label}. Fermati un attimo: prova a giocare più conservativo per 20 secondi, guarda il pattern dei nemici e punta a sopravvivere prima di fare punti.`,
    fail: ({ label }) => `Qui stai ripetendo lo stesso errore su ${label}. Cambia ritmo: un tentativo lento per capire il pattern vale più di tre tentativi veloci.`,
    emptyPost: () => 'Vuoi pubblicare? Parti da una frase concreta: cosa stai facendo, cosa vuoi chiedere alla community o che momento vuoi condividere.',
    missingTags: () => 'Aggiungi 1-3 tag: aiutano SOCIALify a collegare il post a contenuti simili e a far nascere trend sensati.',
    generic: () => 'Ho notato un punto in cui posso aiutarti. Vuoi un consiglio rapido?',
  },
  en: {
    close: 'Close tip',
    later: 'Later',
    ask: 'Ask Ikigai',
    title: 'Ikigai can help',
    death: ({ label }) => `You seem to be dying often in ${label}. Pause for a second: play safer for 20 seconds, read the enemy pattern and focus on surviving before scoring.`,
    fail: ({ label }) => `You’re repeating the same mistake in ${label}. Change pace: one slow attempt to read the pattern is worth more than three rushed ones.`,
    emptyPost: () => 'Want to publish? Start with one concrete line: what you’re doing, what you want to ask the community or what moment you want to share.',
    missingTags: () => 'Add 1-3 tags: they help SOCIALify connect your post to similar content and build meaningful trends.',
    generic: () => 'I noticed a spot where I can help. Want a quick tip?',
  },
  es: {
    close: 'Cerrar consejo',
    later: 'Más tarde',
    ask: 'Preguntar a Ikigai',
    title: 'Ikigai te echa una mano',
    death: ({ label }) => `Veo que mueres a menudo en ${label}. Para un momento: juega más seguro durante 20 segundos, mira el patrón de los enemigos y céntrate en sobrevivir antes de sumar puntos.`,
    fail: ({ label }) => `Estás repitiendo el mismo error en ${label}. Cambia el ritmo: un intento lento para entender el patrón vale más que tres rápidos.`,
    emptyPost: () => '¿Quieres publicar? Empieza con una frase concreta: qué estás haciendo, qué quieres preguntar a la comunidad o qué momento quieres compartir.',
    missingTags: () => 'Añade 1-3 etiquetas: ayudan a SOCIALify a conectar el post con contenido parecido y crear tendencias útiles.',
    generic: () => 'He visto un punto donde puedo ayudarte. ¿Quieres un consejo rápido?',
  },
};

function buildAdvice(event, lingua) {
  const l = langKey(lingua);
  const c = COPY[l];
  const type = event?.type || 'generic';
  const payload = event?.payload || {};
  const label = payload.label || payload.gameName || payload.title || payload.topic || 'questo punto';
  const count = Number(payload.count || 0);

  if ((type === 'game:death' || type === 'game:death_streak') && count >= 3) {
    return { id: `${type}:${payload.topic || label}`, topic: payload.topic || label, title: c.title, text: c.death({ label }), intent: 'games' };
  }
  if ((type === 'game:fail' || type === 'form:error') && count >= 3) {
    return { id: `${type}:${payload.topic || label}`, topic: payload.topic || label, title: c.title, text: c.fail({ label }), intent: 'help' };
  }
  if (type === 'post:empty_submit') {
    return { id: 'post:empty_submit', topic: 'post', title: c.title, text: c.emptyPost(), intent: 'post' };
  }
  if (type === 'post:missing_tags') {
    return { id: 'post:missing_tags', topic: 'tag', title: c.title, text: c.missingTags(), intent: 'tags' };
  }
  if (type === 'agency:manual') {
    return { id: `manual:${Date.now()}`, topic: payload.topic || 'manuale', title: c.title, text: payload.text || c.generic(), intent: payload.intent || 'help' };
  }
  return null;
}

export default function useIkigaiAgency({ onAskIkigai } = {}) {
  const { lingua } = useLingua();
  const [advice, setAdvice] = useState(null);
  const copy = useMemo(() => COPY[langKey(lingua)] || COPY.it, [lingua]);

  useEffect(() => {
    const handler = (event) => {
      const next = buildAdvice(event.detail, lingua);
      if (!next) return;
      if (!canIkigaiAdvise(next.topic, 7)) return;
      markIkigaiAdvised(next.topic);
      setAdvice(next);
    };
    window.addEventListener(IKIGAI_AGENCY_EVENT, handler);
    return () => window.removeEventListener(IKIGAI_AGENCY_EVENT, handler);
  }, [lingua]);

  const close = useCallback(() => setAdvice(null), []);
  const later = useCallback(() => {
    if (advice?.topic) dismissIkigaiTopic(advice.topic, 45);
    setAdvice(null);
  }, [advice]);
  const quiet = useCallback(() => {
    silenceIkigai(30);
    setAdvice(null);
  }, []);
  const ask = useCallback(() => {
    if (onAskIkigai && advice) onAskIkigai(advice);
    setAdvice(null);
  }, [advice, onAskIkigai]);

  return { advice, copy, close, later, quiet, ask };
}
