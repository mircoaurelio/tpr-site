(() => {
  const host = document.querySelector('#rooms');
  if (!host || host.dataset.elevatorReady) return;

  const base = new URL('.', document.currentScript.src);
  const asset = (file) => new URL(`assets/${file}`, base).href;
  const route = (slug) => new URL(`rooms/${slug}/`, base).href;
  const rooms = [
    { key: 'coworking', label: 'Coworking', art: 'homepage-room-coworking-clean-2x.png', character: 'character-coworking.png', box: [5.85, 30.83, 8.10, 15.97], title: 'type-coworking.png', icon: 'elevator-icon-coworking.svg', off: 'elevator-icon-coworking-off.svg' },
    { key: 'reformer', label: 'Reformer', art: 'homepage-room-reformer-clean-2x.png', character: 'character-reformer.png', box: [5.79, 30.72, 8.20, 16.07], title: 'type-reformer.png', icon: 'elevator-icon-reformer.svg', off: 'elevator-icon-reformer-off.svg' },
    { key: 'wellness', label: 'Wellness', art: 'homepage-room-wellness-clean-2x.png', character: 'character-wellness.png', box: [5.99, 29.67, 7.80, 17.12], title: 'type-wellness.png', icon: 'elevator-icon-wellness.svg', off: 'elevator-icon-wellness-off.svg' },
    { key: 'bar', label: 'Bar', art: 'homepage-room-bar-clean-2x.png', character: 'character-bar.png', box: [6.98, 30.20, 5.82, 16.60], title: 'type-bar.png', icon: 'elevator-icon-bar.svg', off: 'elevator-icon-bar-off.svg' },
    { key: 'media', label: 'Media', art: 'homepage-room-media-clean-2x.png', character: 'character-media.png', box: [6.55, 27.57, 6.75, 19.22], title: 'type-media.png', icon: 'elevator-icon-media.svg', off: 'elevator-icon-media-off.svg' },
  ];
  const copy = "The People's Room è uno spazio ibrido e autentico che nutre corpo, mente e spirito, offrendo un rifugio reale in un mondo sempre più digitale. Attraverso design non convenzionale, pratiche di benessere fisico, esperienze culturali e connessioni autentiche, stimoliamo la creatività, il pensiero critico e il senso di appartenenza.";
  const hashRoom = location.hash.slice(1);
  const initialIndex = Math.max(0, rooms.findIndex((room) => room.key === hashRoom));
  let initialJump = Boolean(hashRoom && rooms.some((room) => room.key === hashRoom));
  let active = initialIndex;
  let timer = 0;
  let hashJumpTimer = 0;
  let hashJumpIndex = null;
  let ticking = false;

  if (initialJump) document.body.classList.add('elevator-active');

  host.className = 'tpr-elevator';
  host.dataset.elevatorReady = 'true';
  host.dataset.activeRoom = rooms[active].key;
  host.setAttribute('aria-labelledby', 'elevatorTitle');
  host.innerHTML = `
    <div class="tpr-elevator__sticky">
      <div class="tpr-elevator__frame">
        <img class="tpr-elevator__art tpr-elevator__art--current" src="${asset(rooms[active].art)}" width="3024" height="1904" alt="" aria-hidden="true" fetchpriority="high">
        <img class="tpr-elevator__art tpr-elevator__art--incoming" width="3024" height="1904" alt="" aria-hidden="true">
        <div class="tpr-elevator__character-plane" aria-hidden="true">
          <img class="tpr-elevator__character tpr-elevator__character--current" src="${asset(rooms[active].character)}" alt="">
          <img class="tpr-elevator__character tpr-elevator__character--incoming" alt="">
        </div>
        <div class="tpr-elevator__mobile-copy">
          <h2 id="elevatorTitle"><img class="tpr-elevator__title" src="${asset(rooms[active].title)}" alt="${rooms[active].label} Room"></h2>
          <p class="tpr-elevator__description">${copy}</p>
          <a class="tpr-elevator__mobile-cta" href="${route(rooms[active].key)}">Esplora Stanza <span aria-hidden="true">›</span></a>
        </div>
        <a class="tpr-elevator__cta" href="${route(rooms[active].key)}"><span class="sr-only">Esplora ${rooms[active].label} Room</span></a>
        <span class="tpr-elevator__reformer-book-mask" aria-hidden="true"></span>
        <nav class="tpr-elevator__nav" aria-label="Ascensore delle stanze">
          ${rooms.map((room, index) => `<button class="tpr-elevator__button" type="button" data-elevator-room="${room.key}" aria-label="Vai a ${room.label} Room" aria-pressed="${index === active}"><img class="icon-off" src="${asset(room.off)}" alt=""><img class="icon-on" src="${asset(room.icon)}" alt=""></button>`).join('')}
        </nav>
        <div class="tpr-elevator__progress" aria-hidden="true"><span></span></div>
        <p class="sr-only" aria-live="polite" id="elevatorStatus">${rooms[active].label} Room selezionata.</p>
      </div>
    </div>`;

  const art = host.querySelector('.tpr-elevator__art--current');
  const incomingArt = host.querySelector('.tpr-elevator__art--incoming');
  const currentCharacter = host.querySelector('.tpr-elevator__character--current');
  const incomingCharacter = host.querySelector('.tpr-elevator__character--incoming');
  const title = host.querySelector('.tpr-elevator__title');
  const ctas = [...host.querySelectorAll('.tpr-elevator__cta, .tpr-elevator__mobile-cta')];
  const buttons = [...host.querySelectorAll('[data-elevator-room]')];
  const status = host.querySelector('#elevatorStatus');
  const preloadedImages = new Map();
  rooms.forEach((room) => {
    [room.art, room.character, room.title].forEach((file) => {
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.fetchPriority = room.key === rooms[active].key ? 'high' : 'low';
      image.src = asset(file);
      preloadedImages.set(file, image);
      if (image.decode) image.decode().catch(() => {});
    });
  });

  function setCharacter(element, room) {
    const [x, y, width, height] = room.box;
    element.src = asset(room.character);
    element.style.setProperty('--character-x', `${x}%`);
    element.style.setProperty('--character-y', `${y}%`);
    element.style.setProperty('--character-width', `${width}%`);
    element.style.setProperty('--character-height', `${height}%`);
  }

  function updateMeta(index, direction = 0) {
    const room = rooms[index];
    active = index;
    host.dataset.activeRoom = room.key;
    title.src = asset(room.title);
    title.alt = `${room.label} Room`;
    status.textContent = `${room.label} Room selezionata.`;
    ctas.forEach((cta) => {
      cta.href = route(room.key);
      const sr = cta.querySelector('.sr-only');
      if (sr) sr.textContent = `Esplora ${room.label} Room`;
    });
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.elevatorRoom === room.key)));
    host.classList.toggle('is-reversing', direction < 0);
  }

  function render(index, direction = 0) {
    const room = rooms[index];
    updateMeta(index, direction);
    art.src = asset(room.art);
    setCharacter(currentCharacter, room);
    host.classList.remove('is-lifting');
  }

  function select(index, direction = 0, animate = true) {
    if (index < 0 || index >= rooms.length || index === active) return;
    clearTimeout(timer);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduced) { render(index, direction); return; }
    if (host.classList.contains('is-lifting')) {
      const previousTarget = rooms[active];
      art.src = asset(previousTarget.art);
      setCharacter(currentCharacter, previousTarget);
      host.classList.remove('is-lifting');
    }
    const room = rooms[index];
    [room.art, room.character, room.title].forEach((file) => {
      const image = preloadedImages.get(file);
      if (image) image.fetchPriority = 'high';
    });
    incomingArt.src = asset(room.art);
    setCharacter(incomingCharacter, room);
    updateMeta(index, direction);
    requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add('is-lifting')));
    timer = setTimeout(() => {
      art.src = asset(room.art);
      setCharacter(currentCharacter, room);
      host.classList.remove('is-lifting');
      incomingArt.removeAttribute('src');
      incomingCharacter.removeAttribute('src');
    }, 460);
  }

  function scrollToFloor(index, behavior = null) {
    const travel = Math.max(0, host.offsetHeight - innerHeight);
    const top = host.getBoundingClientRect().top + scrollY;
    const target = top + travel * (index / (rooms.length - 1));
    scrollTo({ top: target, behavior: behavior || (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth') });
  }

  buttons.forEach((button, index) => button.addEventListener('click', () => {
    select(index, index > active ? 1 : -1);
    history.pushState(null, '', `#${rooms[index].key}`);
    scrollToFloor(index, 'auto');
  }));

  document.querySelectorAll('[data-room-link]').forEach((control) => control.addEventListener('click', (event) => {
    const index = rooms.findIndex((room) => room.key === control.dataset.roomLink);
    if (index < 0 || control.closest('.tpr-elevator')) return;
    event.preventDefault();
    history.pushState(null, '', `#${rooms[index].key}`);
    scrollToFloor(index);
  }));

  function updateFromScroll() {
    const rect = host.getBoundingClientRect();
    document.body.classList.toggle('elevator-active', rect.top <= 1 && rect.bottom >= innerHeight - 1);
    if (initialJump || hashJumpIndex !== null) { ticking = false; return; }
    const travel = Math.max(1, host.offsetHeight - innerHeight);
    const progress = Math.min(1, Math.max(0, -rect.top / travel));
    host.style.setProperty('--elevator-progress', progress);
    const next = Math.min(rooms.length - 1, Math.max(0, Math.round(progress * (rooms.length - 1))));
    if (rect.top <= 1 && rect.bottom >= innerHeight - 1 && next !== active) {
      const direction = next > active ? 1 : -1;
      select(next, direction);
      const hashIsRoom = rooms.some((room) => room.key === location.hash.slice(1));
      if (!location.hash || hashIsRoom) history.replaceState(null, '', `#${rooms[next].key}`);
    }
    ticking = false;
  }

  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateFromScroll);
  }, { passive: true });
  addEventListener('resize', updateFromScroll, { passive: true });
  addEventListener('hashchange', () => {
    const index = rooms.findIndex((room) => room.key === location.hash.slice(1));
    if (index < 0) return;
    clearTimeout(hashJumpTimer);
    hashJumpIndex = index;
    render(index, index > active ? 1 : -1);
    scrollToFloor(index);
    hashJumpTimer = setTimeout(() => {
      hashJumpIndex = null;
      updateFromScroll();
    }, 520);
  });
  render(active, 0);
  requestAnimationFrame(updateFromScroll);
  if (initialJump) {
    let jumpStarted = false;
    const performInitialJump = () => {
      if (jumpStarted) return;
      jumpStarted = true;
      requestAnimationFrame(() => {
      render(initialIndex, 0);
      scrollToFloor(initialIndex, 'auto');
      setTimeout(() => scrollToFloor(initialIndex, 'auto'), 180);
      setTimeout(() => {
        scrollToFloor(initialIndex, 'auto');
        initialJump = false;
        updateFromScroll();
      }, 420);
      });
    };
    if (document.readyState === 'complete') performInitialJump();
    else addEventListener('load', performInitialJump, { once: true });
    setTimeout(performInitialJump, 0);
  }
})();
