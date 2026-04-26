const TEXT = {
  it: {
    kicker: 'Spazio creator',
    title: 'Mandy Mashwear',
    body: 'In live mi capita spesso di indossare accessori, maglie o felpe realizzate da Mandy Mashwear. È un piccolo spazio che mi fa piacere dedicarle, perché alcune cose che vedete addosso a me arrivano proprio dal suo lavoro.',
    note: 'Non è una collaborazione pagata, non è una sponsorizzazione e nessuno dei due ha chiesto qualcosa in cambio. È solo un rimando sincero a una creator che mi piace supportare.',
    cta: 'Visita mandymashwear.it',
    aria: 'Apri il sito Mandy Mashwear in una nuova scheda',
  },
  en: {
    kicker: 'Creator spotlight',
    title: 'Mandy Mashwear',
    body: 'During live streams I often wear accessories, shirts or hoodies made by Mandy Mashwear. This is a small space I’m happy to give her, because some of the pieces you see me wearing come from her work.',
    note: 'This is not a paid collaboration, not a sponsorship, and neither of us asked anything in return. It is simply an honest shout-out to a creator I’m happy to support.',
    cta: 'Visit mandymashwear.it',
    aria: 'Open Mandy Mashwear website in a new tab',
  },
  es: {
    kicker: 'Espacio creator',
    title: 'Mandy Mashwear',
    body: 'En los directos suelo llevar accesorios, camisetas o sudaderas hechas por Mandy Mashwear. Es un pequeño espacio que me hace ilusión dedicarle, porque algunas cosas que me veis llevar vienen de su trabajo.',
    note: 'No es una colaboración pagada, no es un patrocinio y ninguno de los dos ha pedido nada a cambio. Es simplemente una mención sincera a una creadora que me gusta apoyar.',
    cta: 'Visitar mandymashwear.it',
    aria: 'Abrir el sitio de Mandy Mashwear en una nueva pestaña',
  },
};

export function chiSonoExtraText(lingua = 'it') {
  const lang = String(lingua || 'it').toLowerCase().startsWith('en')
    ? 'en'
    : String(lingua || 'it').toLowerCase().startsWith('es')
      ? 'es'
      : 'it';
  return TEXT[lang];
}
