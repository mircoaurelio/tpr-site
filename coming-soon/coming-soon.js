(() => {
  'use strict';

  // Draw in CSS pixels so the fine, irregular edge keeps its wavelength at every
  // breakpoint. Only the decorative outline moves; text and hit areas stay sharp.
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const contours = new Map();

  function outlinePath(width, height, radius, stroke, seed) {
    const amplitude = stroke ? (stroke > 2 ? .95 : .6) : .75;
    const inset = stroke / 2 + amplitude + .25;
    const right = width - inset;
    const bottom = height - inset;
    const r = Math.min(radius, (height - 2 * inset) / 2, (width - 2 * inset) / 2);
    const horizontal = width - 2 * inset - 2 * r;
    const vertical = height - 2 * inset - 2 * r;
    const arc = Math.PI * r / 2;
    const perimeter = 2 * horizontal + 2 * vertical + 4 * arc;
    const waves = Math.round(perimeter / 7.3);
    const details = Math.round(perimeter / 4.1);
    const drift = Math.round(perimeter / 29);
    const points = [];
    let distance = 0;

    function segment(length, pointAt) {
      const steps = Math.max(2, Math.ceil(length / 1.6));
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const phase = (distance + length * t) / perimeter * Math.PI * 2;
        const offset = amplitude * (.72 * Math.sin(phase * waves + seed)
          + .2 * Math.sin(phase * details + seed * 1.7)
          + .08 * Math.sin(phase * drift + seed * .6));
        const [x, y, nx, ny] = pointAt(t);
        points.push([x + nx * offset, y + ny * offset]);
      }
      distance += length;
    }
    function corner(cx, cy, start) {
      segment(arc, t => {
        const angle = start + t * Math.PI / 2;
        return [cx + r * Math.cos(angle), cy + r * Math.sin(angle), Math.cos(angle), Math.sin(angle)];
      });
    }

    segment(horizontal, t => [inset + r + horizontal * t, inset, 0, -1]);
    corner(right - r, inset + r, -Math.PI / 2);
    segment(vertical, t => [right, inset + r + vertical * t, 1, 0]);
    corner(right - r, bottom - r, 0);
    segment(horizontal, t => [right - r - horizontal * t, bottom, 0, 1]);
    corner(inset + r, bottom - r, Math.PI / 2);
    segment(vertical, t => [inset, bottom - r - vertical * t, -1, 0]);
    corner(inset + r, inset + r, Math.PI);

    const coordinate = point => point.map(value => value.toFixed(2)).join(' ');
    let path = `M ${coordinate(points[0])}`;
    // Catmull–Rom interpolation keeps each wave smooth, including the corners.
    for (let i = 0; i < points.length; i++) {
      const previous = points[(i + points.length - 1) % points.length];
      const current = points[i];
      const next = points[(i + 1) % points.length];
      const after = points[(i + 2) % points.length];
      const first = current.map((value, axis) => value + (next[axis] - previous[axis]) / 6);
      const second = next.map((value, axis) => value - (after[axis] - current[axis]) / 6);
      path += ` C ${coordinate(first)} ${coordinate(second)} ${coordinate(next)}`;
    }
    return `${path} Z`;
  }

  function drawContour(element) {
    const { svg, path, seed } = contours.get(element);
    // Layout dimensions remain stable while the card's selection pulse is playing.
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width < 8 || height < 8) return;
    const style = getComputedStyle(element);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    path.setAttribute('d', outlinePath(width, height,
      Number(style.getPropertyValue('--paper-radius')),
      Number(style.getPropertyValue('--paper-stroke')), seed));
    element.classList.add('has-contour');
  }

  const contourObserver = new ResizeObserver(entries => entries.forEach(entry => drawContour(entry.target)));
  document.querySelectorAll('.card-face, .email-row, .email-row button').forEach((element, index) => {
    const svg = document.createElementNS(svgNamespace, 'svg');
    const path = document.createElementNS(svgNamespace, 'path');
    svg.classList.add('paper-contour');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.append(path);
    element.prepend(svg);
    contours.set(element, { svg, path, seed: 1.3 + index * .83 });
    drawContour(element);
    contourObserver.observe(element);
  });

  const spaces = {
    community: { name: 'Community', color: '#ff7bff', paragraphs: ["Prima delle stanze vengono le persone. Chi entra porta qualcosa, e da quella somma nasce tutto il resto. Perché nessuno si ispira da solo.", "Perché le stanze sono solo l'inizio. Coming Soon."] },
    coworking: { name: 'TPR Coworking', color: '#98caff', paragraphs: ["Il cuore operativo dello spazio. Un piano condiviso da professionisti indipendenti, aziende e nuove realtà, dove nascono confronti e collaborazioni inaspettate.", "Perché l'ispirazione nasce sempre da una nuova connessione."] },
    move: { name: 'TPR Move', color: '#3f9941', paragraphs: ["Un ambiente luminoso e ampio dedicato al Reformer Pilates, con macchinari Tecnogym e istruttori qualificati a guidare ogni classe.", "Un luogo dove respirare e prendersi cura di sé."] },
    fuel: { name: 'TPR Fuel', color: '#eb642b', paragraphs: ["Un'area dove l'alimentazione ha una funzione precisa. Bevande funzionali preparate al momento e una cucina attrezzata sempre a disposizione.", "Dove il nutrimento diventa carburante."] },
    recharge: { name: 'TPR Recharge', color: '#c2d569', paragraphs: ["Un’area dedicata al recupero. Sauna, relax e contrast therapy, per rigenerarsi e tornare a dare il massimo.", "Il respiro che precede ogni nuova ispirazione."] },
    media: { name: 'TPR Media', color: '#ffc100', paragraphs: ["Una sala di registrazione professionale per podcast, interviste, musica e shooting fotografici, per lavorare con la voce, il suono e l'immagine.", "Dove le idee diventano realtà."] }
  };
  const cards = [...document.querySelectorAll('.space-card')];
  const signup = document.querySelector('#signup');
  const detail = document.querySelector('#space-detail');
  const title = document.querySelector('#space-title');
  const description = document.querySelector('#space-description');
  const status = document.querySelector('#space-status');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const selectionAnimations = new Map();
  let selected = null;

  function animateSelection(card) {
    const face = card.querySelector('.card-face');
    selectionAnimations.get(face)?.cancel();
    if (reducedMotion.matches) return;
    // Scale is independent of the continuous floating translation. Repeated clicks
    // cancel the previous pulse without queuing state changes or moving the hit area.
    const animation = face.animate([
      { scale: '1', offset: 0 },
      { scale: '.985', offset: .25 },
      { scale: '1.006', offset: .65 },
      { scale: '1', offset: 1 }
    ], { duration: 420, easing: 'ease-in-out' });
    selectionAnimations.set(face, animation);
    animation.onfinish = () => selectionAnimations.delete(face);
  }

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    selectionAnimations.forEach(animation => animation.cancel());
    selectionAnimations.clear();
  });

  function selectSpace(key) {
    selected = key === selected ? null : key;
    const space = spaces[selected];
    document.body.dataset.space = selected || 'generic';
    document.querySelector('meta[name="theme-color"]').content = space?.color || '#2c64e8';
    cards.forEach(card => {
      const pressed = String(card.dataset.space === selected);
      if (card.getAttribute('aria-pressed') !== pressed) {
        card.setAttribute('aria-pressed', pressed);
        animateSelection(card);
      }
    });
    signup.hidden = Boolean(space);
    detail.hidden = !space;
    if (space) {
      title.textContent = space.name;
      description.replaceChildren(...space.paragraphs.map(text => {
        const paragraph = document.createElement('p');
        paragraph.textContent = text;
        return paragraph;
      }));
    }
    status.textContent = space ? `${space.name}. ${space.paragraphs.join(' ')} Premi di nuovo la card per tornare alla coming soon.` : 'Manca sempre meno. Puoi lasciare la tua email per ricevere aggiornamenti.';
  }

  cards.forEach(card => card.addEventListener('click', () => selectSpace(card.dataset.space)));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && selected && !document.querySelector('dialog[open]')) selectSpace(selected);
  });

  const form = document.querySelector('#newsletter');
  const formStatus = document.querySelector('#newsletter-status');
  const submit = form.querySelector('[type=submit]');
  const submitLabel = submit.querySelector('.submit-label');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity() || submit.disabled) return;
    const endpoint = form.dataset.endpoint;
    if (!endpoint) {
      formStatus.textContent = 'Le iscrizioni apriranno a breve. La tua email non è stata inviata.';
      return;
    }
    submit.disabled = true;
    submitLabel.textContent = 'Invio…';
    formStatus.textContent = '';
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.elements.email.value.trim(), consent: form.elements.consent.checked }),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error('Subscription unavailable');
      formStatus.textContent = 'Grazie! Ti terremo al corrente di tutte le novità.';
      form.reset();
    } catch {
      formStatus.textContent = 'Non siamo riusciti a inviare la tua email. Riprova tra poco.';
    } finally {
      submit.disabled = false;
      submitLabel.textContent = 'Conferma';
    }
  });

  // Legal notices remain previews until approved copy is supplied.
  const info = {
    privacy: ['Privacy Policy', 'L’informativa completa sarà disponibile prima dell’apertura delle iscrizioni. In questa anteprima la tua email non viene inviata né salvata.'],
    cookies: ['Cookie policy', 'Questa pagina di anteprima non imposta cookie di profilazione e non usa strumenti di analisi. L’informativa completa sarà disponibile con il sito definitivo.']
  };
  const dialog = document.querySelector('#info-dialog');
  document.querySelectorAll('[data-info]').forEach(button => button.addEventListener('click', () => {
    const [heading, copy] = info[button.dataset.info];
    document.querySelector('#info-title').textContent = heading;
    document.querySelector('#info-copy').textContent = copy;
    dialog.showModal();
  }));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
})();
