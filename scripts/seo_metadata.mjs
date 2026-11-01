// Production metadata belongs to the release artifact; the public design preview is noindex.
const origin = 'https://thepeoplesroom.it';
const brand = "The People's Room";
const image = `${origin}/assets/figma-updated/photos/home-hero-room.jpeg`;
const pages = {
  '/homepage-tpr/': {
    title: `Coworking e Reformer Pilates a Milano | ${brand}`,
    description: 'Lavoro, movimento, cultura e benessere nello stesso spazio a Milano. Scopri coworking, Reformer Pilates, bar, studio contenuti, eventi e offerte TPR.',
  },
  '/about/': {
    title: `Uno spazio per lavoro e benessere a Milano | ${brand}`,
    description: "Scopri The People's Room: uno spazio a Milano dove coworking, movimento, cultura e benessere convivono. La nostra visione, le stanze e la community.",
  },
  '/contatti/': {
    title: `Contatti e indirizzo a Milano | ${brand}`,
    description: "Vieni a The People's Room in Via Cola Montano 36, Milano. Scopri indirizzo e orari e contattaci per informazioni sugli spazi, le offerte e gli eventi.",
  },
  '/eventi/': {
    title: `Eventi e spazi per eventi a Milano | ${brand}`,
    description: "Musica, cultura, talk e workshop a The People's Room, Milano. Guarda gli eventi passati e raccontaci il tuo progetto per organizzare un evento nello spazio.",
  },
  '/vivi-tpr/': {
    title: 'Offerte coworking a Milano | Vivi TPR',
    description: 'Scopri le formule TPR a Milano per privati, freelance, startup e aziende: day pass, Flex 8, All Inclusive e ufficio virtuale. Richiedi informazioni.',
  },
  '/prenota/': {
    title: 'Prenota Reformer Pilates a Milano | TPR Move',
    description: 'Prenota la tua lezione di Reformer Pilates a Milano. Scopri il calendario TPR Move e scegli la classe, senza abbonamento obbligatorio: prenoti quando ti serve.',
  },
  '/rooms/coworking/': {
    title: `Coworking e sale riunioni a Milano | ${brand}`,
    description: 'Postazioni condivise, sale riunioni e spazi per eventi a Milano. Esplora TPR Coworking e scopri le formule di accesso per freelance, professionisti e team.',
  },
  '/rooms/reformer/': {
    title: 'Reformer Pilates a Milano | TPR Move',
    description: 'Esplora TPR Move a Milano: una sala dedicata al Reformer Pilates con macchinari Technogym e istruttori qualificati. Scopri lo studio e prenota una lezione.',
  },
  '/rooms/wellness/': {
    title: 'Benessere e palestra a Milano | TPR Recharge',
    description: 'TPR Recharge è lo spazio per il benessere a Milano: palestra, sauna e cold plunge per integrare movimento e recupero nella tua giornata. Esplora la stanza.',
  },
  '/rooms/bar/': {
    title: 'Bar e preparazioni funzionali a Milano | TPR Fuel',
    description: 'TPR Fuel è il bar di The People’s Room a Milano: preparazioni funzionali e uno spazio per una pausa tra lavoro, movimento e incontri. Scopri la stanza.',
  },
  '/rooms/media/': {
    title: 'Podcast e set fotografico a Milano | TPR Media',
    description: 'Uno spazio a Milano per creare contenuti: postazione podcast e set fotografico per shooting e riprese video. Esplora TPR Media e scopri come accedere.',
  },
};

const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const jsonLd = value => `<script type="application/ld+json">${JSON.stringify(value).replaceAll('<', '\\u003c')}</script>`;

function locationSchema(content) {
  const { address, city, days, hours } = content.visit;
  const place = /^(\d{5}) (.+) ([A-Z]{2})$/.exec(city);
  const times = /^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/.exec(hours);
  // Fail visibly if the editorial location record changes beyond this known schedule.
  if (!place || !times || days !== 'Lun - Ven') throw new Error('Review the public location schema after changing visit address or hours.');
  return {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', '@id': `${origin}/#location`,
    name: brand, url: `${origin}/contatti/`, image,
    address: {
      '@type': 'PostalAddress', streetAddress: address,
      addressLocality: place[2], postalCode: place[1], addressRegion: place[3], addressCountry: 'IT',
    },
    openingHoursSpecification: {
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      opens: times[1].padStart(5, '0'), closes: times[2].padStart(5, '0'),
    },
  };
}

export function configureSeo(html, route, content) {
  const metadata = pages[route];
  if (!metadata) throw new Error(`Missing production SEO metadata: ${route}`);
  const url = `${origin}${route === '/homepage-tpr/' ? '/' : route}`;
  // These fields are owned here, so a preview noindex or a stale canonical cannot leak into a release.
  html = html.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*\bname\s*=\s*(["'])(?:description|robots)\1[^>]*>/gi, '')
    .replace(/<link\b[^>]*\brel\s*=\s*(["'])canonical\1[^>]*>/gi, '')
    .replace(/<meta\b[^>]*\bproperty\s*=\s*(["'])og:[^"']+\1[^>]*>/gi, '');
  const fields = {
    'og:type': 'website', 'og:locale': 'it_IT', 'og:site_name': brand,
    'og:title': metadata.title, 'og:description': metadata.description, 'og:url': url,
    'og:image': image, 'og:image:alt': "Gli spazi di The People's Room a Milano",
  };
  let head = `<title>${escapeHtml(metadata.title)}</title>\n<meta name="description" content="${escapeHtml(metadata.description)}">\n<meta name="robots" content="index,follow">\n<link rel="canonical" href="${url}">\n`;
  head += Object.entries(fields).map(([property, value]) => `<meta property="${property}" content="${escapeHtml(value)}">`).join('\n');
  if (route === '/homepage-tpr/') head += `\n${jsonLd({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${origin}/#website`, name: brand, alternateName: 'TPR', url: `${origin}/` })}`;
  if (route === '/contatti/') head += `\n${jsonLd(locationSchema(content))}`;
  return html.replace('</head>', `${head}\n</head>`);
}

export function canonicalNavigation(html, route) {
  return html.replace(/(<a\b[^>]*?\bhref\s*=\s*)(["'])([^"']*)\2/gi, (match, prefix, quote, href) => {
    if (!href || href.startsWith('#')) return match;
    const target = new URL(href.replaceAll('&amp;', '&'), `${origin}${route}`);
    if (target.origin !== origin || target.pathname !== '/homepage-tpr/') return match;
    return `${prefix}${quote}${escapeHtml(`/${target.search}${target.hash}`)}${quote}`;
  });
}
