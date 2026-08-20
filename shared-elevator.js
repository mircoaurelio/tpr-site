(() => {
  const host = document.querySelector('#rooms');
  if (!host || host.dataset.elevatorReady) return;

  const base = new URL('.', document.currentScript.src);
  const asset = (file) => {
    const url = new URL(`assets/${file}`, base);
    if (file.includes('elevator-icon')) url.searchParams.set('v', '20260820-on-glyphs');
    return url.href;
  };
  const bookingUrl = (roomKey) => `${new URL('contatti/', base).href}?room=${encodeURIComponent(roomKey)}`;
  const rooms = [
    {
      key: 'coworking', label: 'Coworking', art: 'homepage-room-coworking-no-text-2x.webp', routeArt: 'routes/coworking-2x.webp', character: 'character-coworking.png', box: [5.85, 30.83, 8.10, 15.97], icon: 'elevator-icon-coworking.svg', off: 'elevator-icon-coworking-off.svg',
      description: 'Postazioni flessibili, sale riunioni e spazi per eventi in cui lavorare, incontrarsi e dare forma a nuove idee.', bookable: true,
      cards: [['Postazioni', 'Approfondisci le postazioni nella Coworking Room.'], ['Sale riunioni', 'Approfondisci le sale riunioni nella Coworking Room.'], ['Eventi', 'Approfondisci gli eventi nella Coworking Room.']],
    },
    {
      key: 'reformer', label: 'Reformer', art: 'homepage-room-reformer-no-text-2x.webp', routeArt: 'routes/reformer-2x.webp', character: 'character-reformer.png', box: [5.79, 30.72, 8.20, 16.07], icon: 'elevator-icon-reformer.svg', off: 'elevator-icon-reformer-off.svg',
      description: 'Uno studio dedicato al movimento consapevole, con classi guidate e attrezzature professionali.', bookable: true,
      cards: [['Spazi', 'Approfondisci gli spazi nella Reformer Room.'], ['Classi', 'Approfondisci le classi nella Reformer Room.'], ['Attrezzature', 'Approfondisci le attrezzature nella Reformer Room.']],
    },
    {
      key: 'wellness', label: 'Wellness', art: 'homepage-room-wellness-no-text-2x.webp', routeArt: 'routes/wellness-2x.webp', character: 'character-wellness.png', box: [5.99, 29.67, 7.80, 17.12], icon: 'elevator-icon-wellness.svg', off: 'elevator-icon-wellness-off.svg',
      description: 'Rituali e tecnologie per ritrovare equilibrio, energia e presenza.', bookable: false,
      cards: [['Power', 'Approfondisci Power nella Wellness Room.'], ['Biohacking', 'Approfondisci il biohacking nella Wellness Room.'], ['Contrast Therapy', 'Approfondisci la contrast therapy nella Wellness Room.']],
    },
    {
      key: 'bar', label: 'Bar', art: 'homepage-room-bar-no-text-2x.webp', routeArt: 'routes/bar-2x.webp', character: 'character-bar.png', box: [6.98, 30.20, 5.82, 16.60], icon: 'elevator-icon-bar.svg', off: 'elevator-icon-bar-off.svg',
      description: "Il punto di incontro quotidiano della community TPR, dalla colazione all'aperitivo.", bookable: false,
      cards: [['Servizi', 'Approfondisci i servizi nella Bar Room.'], ['Accessibilità', "Approfondisci l'accessibilità nella Bar Room."], ['Storage', 'Approfondisci lo storage nella Bar Room.']],
    },
    {
      key: 'media', label: 'Media', art: 'homepage-room-media-no-text-2x.webp', routeArt: 'routes/media-2x.webp', character: 'character-media.png', box: [6.55, 27.57, 6.75, 19.22], icon: 'elevator-icon-media.svg', off: 'elevator-icon-media-off.svg',
      description: 'Uno studio pronto per podcast, shooting, streaming e nuovi linguaggi.', bookable: false,
      cards: [['Podcast', 'Approfondisci il podcast nella Media Room.'], ['Studio', 'Approfondisci lo studio nella Media Room.'], ['Set fotografico', 'Approfondisci il set fotografico nella Media Room.']],
    },
  ];
  const copyParagraphs = [
    "The People's Room è uno spazio ibrido e autentico che nutre corpo, mente e spirito, offrendo un rifugio reale in un mondo sempre più digitale.",
    "Attraverso design non convenzionale, pratiche di benessere fisico, esperienze culturali e connessioni autentiche, stimoliamo la creatività, il pensiero critico e il senso di appartenenza.",
    "Il nostro obiettivo quotidiano è ispirare le persone a esprimere sé stesse, riscoprire il valore dell'umanità e vivere in modo più presente, creativo e vitale.",
  ];
  const roomCopyHtml = copyParagraphs.map((paragraph) => `<p>${paragraph}</p>`).join('');
  const roomTitle = (room) => `${room.label} <span>Room</span>`;
  const CARD_FOCUSES = ['20% 42%', '50% 38%', '82% 42%'];
  const cardArrowSrc = new URL('assets/route-arrow-zigzag.png?v=20260819-arrow-2', base).href;
  const LIFT_MS = 1250;
  const LAST_FLOOR_HOLD = 1;
  const desktopCopyMarkup = (room, { live = true } = {}) => `
          <h2>${roomTitle(room)}</h2>
          ${roomCopyHtml}
          <div class="tpr-elevator__desktop-actions">
            <button class="tpr-elevator__cta" type="button"${live ? ` data-elevator-explore aria-label="Esplora ${room.label} Room"` : ' tabindex="-1" aria-hidden="true"'}><span class="tpr-elevator__cta-label">Esplora Stanza</span><span class="tpr-elevator__cta-arrow" aria-hidden="true"></span></button>
            <a class="tpr-elevator__book"${live ? ' data-elevator-book' : ''} href="${bookingUrl(room.key)}" ${room.bookable ? '' : 'hidden'}>Prenota${live ? `<span class="sr-only"> ${room.label} Room</span>` : ''}</a>
          </div>`;
  const mobileDropMarkup = (room) => room.cards.map(([cardTitle, cardCopy], index) => {
    const focus = CARD_FOCUSES[index] || CARD_FOCUSES[0];
    return `
            <button class="tpr-elevator__mobile-card" type="button" data-card-index="${index}" aria-expanded="false" aria-label="Apri la card ${cardTitle}">
              <span class="tpr-elevator__mobile-card-front" aria-hidden="true">
                <span class="tpr-elevator__mobile-card-photo"><span class="tpr-elevator__mobile-card-photo-window"><img src="${asset(room.art)}" alt="" width="3024" height="1904" decoding="async" style="object-position:${focus}" /></span></span>
                <span class="tpr-elevator__mobile-card-meta"><strong>${cardTitle}</strong><span class="tpr-elevator__card-arrow"><img src="${cardArrowSrc}" alt="" width="52" height="54" /></span></span>
              </span>
              <span class="sr-only">Apri la card ${cardTitle}</span>
              <span class="tpr-elevator__mobile-card-back" aria-hidden="true">
                <strong>Cosa si fa?</strong>
                <span class="tpr-elevator__card-close" aria-hidden="true"></span>
                <span>${cardCopy}</span>
                <span class="tpr-elevator__card-cta">Diventa Membro</span>
              </span>
            </button>`;
  }).join('');
  const mobileCopyMarkup = (room, { live = true } = {}) => `
          <h2 class="tpr-elevator__title"${live ? ' id="elevatorTitle"' : ''}>${roomTitle(room)}</h2>
          <div class="tpr-elevator__mobile-copy-text">${copyParagraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}</div>
          <div class="tpr-elevator__mobile-actions">
            <button class="tpr-elevator__mobile-cta" type="button"${live ? ' data-elevator-explore aria-expanded="false"' : ' tabindex="-1" aria-hidden="true"'}><span class="tpr-elevator__cta-label">Esplora Stanza</span><span class="tpr-elevator__cta-arrow" aria-hidden="true"></span></button>
            <a class="tpr-elevator__mobile-book"${live ? ' data-elevator-book' : ''} href="${bookingUrl(room.key)}" ${room.bookable ? '' : 'hidden'}><span>Prenota</span></a>
          </div>
          <div class="tpr-elevator__mobile-drop" aria-label="Card della stanza">${mobileDropMarkup(room)}</div>`;
  const isRoomKey = (key) => rooms.some((room) => room.key === key);
  const hashRoom = location.hash.slice(1);
  const initialIndex = Math.max(0, rooms.findIndex((room) => room.key === hashRoom));
  let initialJump = isRoomKey(hashRoom);
  let active = initialIndex;
  let timer = 0;
  let hashJumpTimer = 0;
  let hashJumpIndex = null;
  let ticking = false;

  function clearRoomHash() {
    if (!isRoomKey(location.hash.slice(1))) return;
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }

  host.className = 'tpr-elevator';
  host.dataset.elevatorReady = 'true';
  host.dataset.activeRoom = rooms[active].key;
  host.style.setProperty('--elevator-lift-ms', `${LIFT_MS}ms`);
  host.style.setProperty('--elevator-floors', String(rooms.length + LAST_FLOOR_HOLD));
  host.setAttribute('aria-labelledby', 'elevatorTitle');
  host.innerHTML = `
    <div class="tpr-elevator__sticky">
      <div class="tpr-elevator__frame">
        <div class="tpr-elevator__car tpr-elevator__car--shade tpr-elevator__car--current" data-room="${rooms[active].key}" aria-hidden="true"></div>
        <div class="tpr-elevator__car tpr-elevator__car--shade tpr-elevator__car--incoming" aria-hidden="true"></div>
        <div class="tpr-elevator__car tpr-elevator__car--current" data-room="${rooms[active].key}">
          <div class="tpr-elevator__mobile-copy">${mobileCopyMarkup(rooms[active])}</div>
          <div class="tpr-elevator__desktop-copy">${desktopCopyMarkup(rooms[active])}</div>
        </div>
        <div class="tpr-elevator__car tpr-elevator__car--incoming" aria-hidden="true">
          <div class="tpr-elevator__mobile-copy">${mobileCopyMarkup(rooms[active], { live: false })}</div>
          <div class="tpr-elevator__desktop-copy">${desktopCopyMarkup(rooms[active], { live: false })}</div>
        </div>
        <div class="tpr-elevator__photo-plane" aria-hidden="true">
          <img class="tpr-elevator__art tpr-elevator__art--current" src="${asset(rooms[active].art)}" width="3024" height="1904" alt="" fetchpriority="high">
          <img class="tpr-elevator__art tpr-elevator__art--incoming" width="3024" height="1904" alt="">
        </div>
        <div class="tpr-elevator__character-plane" aria-hidden="true">
          <div class="tpr-elevator__character tpr-elevator__character--current"></div>
          <div class="tpr-elevator__character tpr-elevator__character--incoming"></div>
        </div>
        <nav class="tpr-elevator__nav" aria-label="Ascensore delle stanze">
          ${rooms.map((room, index) => `<button class="tpr-elevator__button" type="button" data-elevator-room="${room.key}" aria-label="Vai a ${room.label} Room" aria-pressed="${index === active}"><img class="icon-off" src="${asset(room.off)}" alt=""><img class="icon-on" src="${asset(room.icon)}" alt=""></button>`).join('')}
        </nav>
        <div class="tpr-elevator__progress" aria-hidden="true"><span></span></div>
        <div class="tpr-elevator__explore" aria-hidden="true">
          <div class="tpr-elevator__explore-track" aria-hidden="true">
            <img alt="" width="6864" height="1904">
            <div class="tpr-elevator__explore-chrome-mask" aria-hidden="true"></div>
            <div class="tpr-elevator__explore-cards"></div>
          </div>
          <div class="tpr-elevator__explore-progress" role="scrollbar" tabindex="0" aria-label="Scorri orizzontalmente la stanza" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
        </div>
        <p class="sr-only" aria-live="polite" id="elevatorStatus">${rooms[active].label} Room selezionata.</p>
      </div>
    </div>`;

  const currentCar = host.querySelector('.tpr-elevator__car--current:not(.tpr-elevator__car--shade)');
  const incomingCar = host.querySelector('.tpr-elevator__car--incoming:not(.tpr-elevator__car--shade)');
  const currentShade = host.querySelector('.tpr-elevator__car--shade.tpr-elevator__car--current');
  const incomingShade = host.querySelector('.tpr-elevator__car--shade.tpr-elevator__car--incoming');
  const art = host.querySelector('.tpr-elevator__art--current');
  const incomingArt = host.querySelector('.tpr-elevator__art--incoming');
  const currentCharacter = host.querySelector('.tpr-elevator__character--current');
  const incomingCharacter = host.querySelector('.tpr-elevator__character--incoming');
  const ctas = [...host.querySelectorAll('[data-elevator-explore]')];
  const buttons = [...host.querySelectorAll('[data-elevator-room]')];
  const status = host.querySelector('#elevatorStatus');
  const frame = host.querySelector('.tpr-elevator__frame');
  const desktopCopy = currentCar.querySelector('.tpr-elevator__desktop-copy');
  const exploreLayer = host.querySelector('.tpr-elevator__explore');
  const exploreTrack = host.querySelector('.tpr-elevator__explore-track');
  const exploreTrackImage = host.querySelector('.tpr-elevator__explore-track img');
  const exploreCards = host.querySelector('.tpr-elevator__explore-cards');
  const exploreProgressControl = host.querySelector('.tpr-elevator__explore-progress');
  const ROOM_SCROLL_FACTOR = 1.2;
  const ROOM_EXPLORE_PROGRESS = .39;
  const EXPLORE_OPEN_MS = 720;
  let exploring = false;
  let exploreProgress = 0;
  let exploreOpenProgress = ROOM_EXPLORE_PROGRESS;
  let exploreOrigin = 0;
  let exploreGeometry = null;
  let exploreArmed = false;
  let exploreCanClose = false;
  let exploreStartTimer = 0;
  let exploreOpenRaf = 0;
  let exploreOpening = false;
  let exploreHandoffLocked = false;

  function pageInset() {
    const header = document.querySelector('.site-header');
    if (header) return parseFloat(getComputedStyle(header).paddingLeft) || 80;
    return 80;
  }
  const preloadedImages = new Map();
  rooms.forEach((room) => {
    [room.art, room.character, room.routeArt].forEach((file) => {
      const image = new Image();
      image.decoding = 'async';
      image.loading = 'eager';
      image.fetchPriority = room.key === rooms[active].key ? 'high' : 'low';
      image.src = asset(file);
      preloadedImages.set(file, image);
      if (image.decode) image.decode().catch(() => {});
    });
  });

  const CHARACTER_COLOR = {
    coworking: '#2c64e8',
    reformer: '#ffc100',
    wellness: '#3f9941',
    bar: '#ffc100',
    media: '#2c64e8',
  };

  function setCharacter(element, room) {
    const [x, y, width, height] = room.box;
    const responsiveYOffset = (18 / 952) * 100;
    const svg = window.tprLittleMen?.svg?.(room.key);
    element.dataset.room = room.key;
    element.style.color = CHARACTER_COLOR[room.key] || '#2c64e8';
    element.style.setProperty('--character-x', `${Math.max(0, x - 1.4)}%`);
    element.style.setProperty('--character-y', `${Math.max(0, y - responsiveYOffset)}%`);
    element.style.setProperty('--character-width', `${width}%`);
    element.style.setProperty('--character-height', `${height}%`);
    if (svg) {
      element.innerHTML = svg;
      return;
    }
    element.innerHTML = `<img src="${asset(room.character)}" alt="">`;
  }

  let entranceTimer = 0;
  function playEntrance(element) {
    if (!element?.querySelector('.little-man')) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    element.classList.remove('is-entering');
    void element.offsetWidth;
    element.classList.add('is-entering');
    window.clearTimeout(entranceTimer);
    entranceTimer = window.setTimeout(() => element.classList.remove('is-entering'), 2000);
  }

  setCharacter(currentCharacter, rooms[active]);
  const hydrateLittleMen = () => {
    setCharacter(currentCharacter, rooms[active]);
    playEntrance(currentCharacter);
  };
  if (window.tprLittleMen?.ready) window.tprLittleMen.ready.then(hydrateLittleMen);
  document.addEventListener('tpr-little-men-ready', hydrateLittleMen);
  new IntersectionObserver((entries, observer) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    playEntrance(currentCharacter);
    observer.disconnect();
  }, { threshold: .35 }).observe(host);

  function paintCopy(car, room) {
    if (!car) return;
    car.dataset.room = room.key;
    const shade = car === currentCar ? currentShade : incomingShade;
    if (shade) shade.dataset.room = room.key;
    car.querySelectorAll('h2').forEach((title) => { title.innerHTML = roomTitle(room); });
    car.querySelectorAll('.tpr-elevator__book, .tpr-elevator__mobile-book').forEach((link) => {
      link.href = bookingUrl(room.key);
      link.hidden = !room.bookable;
      const sr = link.querySelector('.sr-only');
      if (sr) sr.textContent = ` ${room.label} Room`;
    });
    car.querySelectorAll('[data-elevator-explore]').forEach((cta) => {
      cta.setAttribute('aria-label', `Esplora ${room.label} Room`);
    });
    const drop = car.querySelector('.tpr-elevator__mobile-drop');
    if (drop) drop.innerHTML = mobileDropMarkup(room);
    syncExploreCtas(room);
  }

  function isMobileView() {
    return matchMedia('(max-width: 720px)').matches;
  }

  function resetMobileCards(scope = currentCar) {
    scope?.querySelectorAll('.tpr-elevator__mobile-card.is-flipped').forEach((card) => {
      const cardTitle = rooms[active].cards[Number(card.dataset.cardIndex)]?.[0] || 'stanza';
      card.classList.remove('is-flipped');
      card.setAttribute('aria-expanded', 'false');
      card.setAttribute('aria-label', `Apri la card ${cardTitle}`);
      card.querySelector('.tpr-elevator__mobile-card-back')?.setAttribute('aria-hidden', 'true');
    });
  }

  function setMobileCardExpanded(card, expanded) {
    const cardTitle = rooms[active].cards[Number(card.dataset.cardIndex)]?.[0] || 'stanza';
    card.classList.toggle('is-flipped', expanded);
    card.setAttribute('aria-expanded', String(expanded));
    card.setAttribute('aria-label', expanded ? `Chiudi i dettagli di ${cardTitle}` : `Apri la card ${cardTitle}`);
    card.querySelector('.tpr-elevator__mobile-card-back')?.setAttribute('aria-hidden', String(!expanded));
  }

  function setMobileExpanded(open) {
    host.classList.toggle('is-mobile-expanded', open);
    currentCar.classList.toggle('is-mobile-expanded', open);
    incomingCar.classList.remove('is-mobile-expanded');
    currentCar.querySelectorAll('.tpr-elevator__mobile-cta').forEach((cta) => {
      cta.setAttribute('aria-expanded', String(open));
    });
    incomingCar.querySelectorAll('.tpr-elevator__mobile-cta').forEach((cta) => {
      cta.setAttribute('aria-expanded', 'false');
    });
    const drop = currentCar.querySelector('.tpr-elevator__mobile-drop');
    if (!open) {
      resetMobileCards();
      return;
    }
    if (drop) drop.scrollLeft = 0;
  }

  function closeMobileDrop() {
    setMobileExpanded(false);
  }

  function syncExploreCtas(room = rooms[active]) {
    const exploringMode = exploring || host.classList.contains('is-exploring');
    host.querySelectorAll('[data-elevator-explore]').forEach((cta) => {
      const label = cta.querySelector('.tpr-elevator__cta-label');
      if (label) label.textContent = exploringMode ? 'Tutte le Stanze' : 'Esplora Stanza';
      cta.setAttribute('aria-label', exploringMode ? 'Torna a tutte le stanze' : `Esplora ${room.label} Room`);
    });
  }

  function updateChrome(index) {
    const room = rooms[index];
    status.textContent = `${room.label} Room selezionata.`;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.elevatorRoom === room.key)));
  }

  function settle(room) {
    host.classList.add('is-arming');
    closeMobileDrop();
    if (host.classList.contains('is-explore-handoff')) {
      teardownExploreOverlay();
    }
    art.src = asset(room.art);
    setCharacter(currentCharacter, room);
    paintCopy(currentCar, room);
    host.dataset.activeRoom = room.key;
    host.classList.remove('is-lifting', 'is-reversing', 'is-explore-handoff');
    incomingArt.removeAttribute('src');
    incomingCharacter.innerHTML = '';
    incomingCharacter.removeAttribute('data-room');
    incomingCar.removeAttribute('data-room');
    incomingShade.removeAttribute('data-room');
    incomingCar.offsetHeight;
    host.classList.remove('is-arming');
    playEntrance(currentCharacter);
  }

  function render(index) {
    const room = rooms[index];
    active = index;
    updateChrome(index);
    settle(room);
  }

  function select(index, direction = 0, animate = true) {
    if (index < 0 || index >= rooms.length || index === active) return;
    closeMobileDrop();
    clearTimeout(timer);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduced) { render(index); return; }
    if (host.classList.contains('is-lifting')) settle(rooms[active]);
    const room = rooms[index];
    [room.art, room.character].forEach((file) => {
      const image = preloadedImages.get(file);
      if (image) image.fetchPriority = 'high';
    });
    incomingArt.src = asset(room.art);
    setCharacter(incomingCharacter, room);
    paintCopy(incomingCar, room);
    active = index;
    updateChrome(index);
    host.classList.add('is-arming');
    host.classList.toggle('is-reversing', direction < 0);
    incomingCar.offsetHeight;
    host.classList.remove('is-arming');
    requestAnimationFrame(() => requestAnimationFrame(() => host.classList.add('is-lifting')));
    timer = setTimeout(() => settle(room), LIFT_MS + 50);
  }

  host.addEventListener('wheel', (event) => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (exploring && !exploreHandoffLocked) return;
    if (!host.classList.contains('is-lifting') && !exploreHandoffLocked) return;
    const rect = host.getBoundingClientRect();
    if (rect.top > 1 || rect.bottom < innerHeight - 1) return;
    event.preventDefault();
  }, { passive: false });

  function renderExploreCards(room) {
    exploreCards.innerHTML = room.cards.map(([cardTitle, cardCopy], index) => `
      <button class="tpr-elevator__explore-card" type="button" data-card-index="${index}" aria-expanded="false" aria-label="Apri la card ${cardTitle}">
        <span class="tpr-elevator__card-front" aria-hidden="true"><strong>${cardTitle}</strong><span class="tpr-elevator__card-arrow" aria-hidden="true"><img src="${new URL('assets/route-arrow-zigzag.png?v=20260819-arrow-2', base).href}" alt="" width="52" height="54" /></span></span>
        <span class="sr-only">Apri la card ${cardTitle}</span>
        <span class="tpr-elevator__card-back" aria-hidden="true">
          <strong>Cosa si fa?</strong>
          <span class="tpr-elevator__card-close" aria-hidden="true"></span>
          <span>${cardCopy}</span>
          <span class="tpr-elevator__card-cta">Diventa Membro</span>
        </span>
      </button>`).join('');

    exploreCards.querySelectorAll('.tpr-elevator__explore-card').forEach((card, index) => {
      card.addEventListener('click', () => {
        const expanded = card.classList.toggle('is-flipped');
        const cardTitle = room.cards[index][0];
        card.setAttribute('aria-expanded', String(expanded));
        card.setAttribute('aria-label', expanded ? `Chiudi i dettagli di ${cardTitle}` : `Apri la card ${cardTitle}`);
        card.querySelector('.tpr-elevator__card-back').setAttribute('aria-hidden', String(!expanded));
      });
    });
  }

  function setExploreRoom(room) {
    exploreTrackImage.src = asset(room.routeArt);
    renderExploreCards(room);
  }

  function measureExploreGeometry() {
    const ratio = (exploreTrackImage.naturalWidth && exploreTrackImage.naturalHeight)
      ? exploreTrackImage.naturalWidth / exploreTrackImage.naturalHeight
      : 6864 / 1904;
    const viewHeight = frame.clientHeight || innerHeight;
    const rect = exploreTrack.getBoundingClientRect();
    const trackHeight = rect.height > 0 ? rect.height : viewHeight;
    const expectedWidth = trackHeight * ratio;
    const width = Math.max(rect.width, expectedWidth);
    const height = rect.height > 0 ? rect.height : viewHeight;
    const travelMax = Math.max(0, width - innerWidth);
    const scrollDistance = Math.max(1, travelMax * ROOM_SCROLL_FACTOR);
    const leaveDistance = 96;
    const handoffDistance = active < rooms.length - 1 ? Math.max(160, innerHeight * .45) : leaveDistance;
    return { width, height, travelMax, scrollDistance, leaveDistance, handoffDistance };
  }

  function lockExploreLayout() {
    exploreOrigin = Math.max(0, -host.getBoundingClientRect().top);
    const geometry = measureExploreGeometry();
    const needed = exploreOrigin + geometry.scrollDistance + geometry.handoffDistance + innerHeight;
    host.style.height = `${Math.max(host.offsetHeight, needed)}px`;
    exploreGeometry = measureExploreGeometry();
    return exploreGeometry;
  }

  function getExploreGeometry() {
    if (exploring && exploreGeometry) return exploreGeometry;
    return measureExploreGeometry();
  }

  function getOpeningExploreProgress() {
    return ROOM_EXPLORE_PROGRESS;
  }

  function setExploreProgress(progress) {
    if (!exploring) return;
    const bounded = Math.max(0, Math.min(1, progress));
    const geometry = getExploreGeometry();
    const travel = bounded * geometry.travelMax;
    exploreProgress = bounded;
    host.style.setProperty('--explore-travel', `${travel}px`);
    host.style.setProperty('--explore-progress', String(bounded));
    exploreLayer.style.setProperty('--explore-travel', `${travel}px`);
    exploreLayer.style.setProperty('--explore-progress', String(bounded));
    exploreProgressControl.setAttribute('aria-valuenow', String(Math.round(bounded * 100)));
  }

  function scrollExploreTo(progress, behavior = 'auto') {
    const bounded = Math.max(0, Math.min(1, progress));
    const top = host.getBoundingClientRect().top + scrollY;
    const geometry = getExploreGeometry();
    scrollTo({
      top: top + exploreOrigin + (geometry.scrollDistance * bounded),
      behavior: behavior === 'auto' ? 'instant' : behavior,
    });
  }

  function easeExploreOpen(t) {
    return 1 - ((1 - t) ** 3);
  }

  function openExplore(opener) {
    if (exploring) return;
    clearTimeout(exploreStartTimer);
    cancelAnimationFrame(exploreOpenRaf);
    exploring = true;
    exploreOpening = true;
    exploreArmed = false;
    exploreCanClose = false;
    exploreGeometry = null;
    setExploreRoom(rooms[active]);
    exploreLayer.setAttribute('aria-hidden', 'false');
    host.dataset.mode = 'explore';
    host._exploreOpener = opener;
    if (desktopCopy.parentElement !== exploreTrack) exploreTrack.appendChild(desktopCopy);
    host.classList.add('is-exploring', 'is-explore-opening');
    document.body.classList.add('elevator-exploring');
    syncExploreCtas();
    status.textContent = `${rooms[active].label} Room: esplorazione aperta nella homepage.`;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    lockExploreLayout();
    setExploreProgress(0);
    const opening = getOpeningExploreProgress();
    const finishOpening = () => {
      if (!exploring) return;
      setExploreProgress(opening);
      scrollExploreTo(opening, 'auto');
      exploreOpenProgress = opening;
      host.classList.add('is-explore-ready');
      host.classList.remove('is-explore-opening');
      exploreOpening = false;
      requestAnimationFrame(() => { exploreArmed = true; });
    };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!exploring) return;
      if (reduced) {
        finishOpening();
        return;
      }
      const start = performance.now();
      const tick = (now) => {
        if (!exploring) return;
        const t = Math.min(1, (now - start) / EXPLORE_OPEN_MS);
        const next = opening * easeExploreOpen(t);
        setExploreProgress(next);
        scrollExploreTo(next, 'auto');
        if (t < 1) exploreOpenRaf = requestAnimationFrame(tick);
        else finishOpening();
      };
      exploreOpenRaf = requestAnimationFrame(tick);
    }));
  }

  function teardownExploreOverlay() {
    clearTimeout(exploreStartTimer);
    cancelAnimationFrame(exploreOpenRaf);
    exploring = false;
    exploreOpening = false;
    exploreArmed = false;
    exploreCanClose = false;
    exploreProgress = 0;
    exploreGeometry = null;
    host.classList.remove('is-exploring', 'is-explore-ready', 'is-explore-opening');
    document.body.classList.remove('elevator-exploring');
    exploreLayer.setAttribute('aria-hidden', 'true');
    if (desktopCopy.parentElement !== currentCar) currentCar.appendChild(desktopCopy);
    host.style.removeProperty('--explore-travel');
    host.style.removeProperty('--explore-progress');
    exploreLayer.style.removeProperty('--explore-travel');
    exploreLayer.style.removeProperty('--explore-progress');
    delete host.dataset.mode;
    syncExploreCtas();
  }

  function closeExplore({ restoreFocus = true, scrollBack = true } = {}) {
    if (!exploring || exploreHandoffLocked) return;
    const opener = host._exploreOpener;
    teardownExploreOverlay();
    exploreOrigin = 0;
    host.classList.add('is-explore-exit');
    host.style.removeProperty('height');
    requestAnimationFrame(() => {
      if (scrollBack) scrollToFloor(active, 'auto');
      if (restoreFocus && opener instanceof HTMLElement) opener.focus({ preventScroll: true });
      requestAnimationFrame(() => host.classList.remove('is-explore-exit'));
    });
  }

  function exitExploreToPage(direction) {
    if (!exploring || exploreHandoffLocked) return;
    exploreHandoffLocked = true;
    exploreArmed = false;
    const top = host.getBoundingClientRect().top + scrollY;
    host.style.removeProperty('height');
    exploreOrigin = 0;
    hashJumpIndex = active;
    const destination = direction > 0
      ? top + host.offsetHeight
      : Math.max(0, top - innerHeight);
    scrollTo({ top: destination, behavior: 'instant' });
    teardownExploreOverlay();
    requestAnimationFrame(() => {
      exploreHandoffLocked = false;
      hashJumpIndex = null;
      updateFromScroll();
    });
  }

  function finishExploreHandoff(index) {
    host.style.removeProperty('height');
    exploreOrigin = 0;
    scrollToFloor(index, 'auto');
    requestAnimationFrame(() => {
      exploreHandoffLocked = false;
      hashJumpIndex = null;
      updateFromScroll();
    });
  }

  function handoffExploreToNextRoom() {
    if (!exploring || exploreHandoffLocked || active >= rooms.length - 1) return;
    if (host.classList.contains('is-lifting')) return;
    exploreHandoffLocked = true;
    const next = active + 1;
    hashJumpIndex = next;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      teardownExploreOverlay();
      render(next);
      finishExploreHandoff(next);
      return;
    }
    host.classList.add('is-explore-handoff');
    select(next, 1);
    status.textContent = `${rooms[next].label} Room selezionata.`;
    setTimeout(() => finishExploreHandoff(next), LIFT_MS + 80);
  }

  ctas.forEach((cta) => cta.addEventListener('click', () => {
    if (exploreHandoffLocked) return;
    if (isMobileView()) {
      setMobileExpanded(!host.classList.contains('is-mobile-expanded'));
      return;
    }
    if (exploring) {
      closeExplore({ restoreFocus: false });
      return;
    }
    openExplore(cta);
  }));

  host.addEventListener('click', (event) => {
    const card = event.target.closest('.tpr-elevator__mobile-card');
    if (!card || !isMobileView() || !currentCar.contains(card)) return;
    const expanded = !card.classList.contains('is-flipped');
    currentCar.querySelectorAll('.tpr-elevator__mobile-card.is-flipped').forEach((openCard) => {
      if (openCard !== card) setMobileCardExpanded(openCard, false);
    });
    setMobileCardExpanded(card, expanded);
    if (expanded) {
      card.scrollIntoView({ inline: 'center', block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  });

  exploreProgressControl.addEventListener('pointerdown', (event) => {
    const rect = exploreProgressControl.getBoundingClientRect();
    exploreProgressControl.setPointerCapture(event.pointerId);
    scrollExploreTo((event.clientX - rect.left) / Math.max(1, rect.width));
  });
  exploreProgressControl.addEventListener('pointermove', (event) => {
    if (!exploreProgressControl.hasPointerCapture(event.pointerId)) return;
    const rect = exploreProgressControl.getBoundingClientRect();
    scrollExploreTo((event.clientX - rect.left) / Math.max(1, rect.width));
  });
  exploreProgressControl.addEventListener('keydown', (event) => {
    const moves = {
      ArrowLeft: exploreProgress - .08,
      ArrowRight: exploreProgress + .08,
      PageUp: exploreProgress - .25,
      PageDown: exploreProgress + .25,
      Home: 0,
      End: 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    scrollExploreTo(moves[event.key], matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (host.classList.contains('is-mobile-expanded')) closeMobileDrop();
    else if (exploring) closeExplore();
  });

  function elevatorTravel() {
    return Math.max(1, host.offsetHeight - innerHeight);
  }

  function roomTravel() {
    return Math.max(1, elevatorTravel() - (innerHeight * LAST_FLOOR_HOLD));
  }

  function floorOffset(index) {
    return roomTravel() * (index / (rooms.length - 1));
  }

  function scrollToFloor(index, behavior = null) {
    const top = host.getBoundingClientRect().top + scrollY;
    const target = top + floorOffset(index);
    const requestedBehavior = behavior || (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
    scrollTo({ top: target, behavior: requestedBehavior === 'auto' ? 'instant' : requestedBehavior });
  }

  buttons.forEach((button, index) => button.addEventListener('click', () => {
    select(index, index > active ? 1 : -1);
    clearRoomHash();
    scrollToFloor(index, 'auto');
  }));

  document.querySelectorAll('[data-room-link]').forEach((control) => control.addEventListener('click', (event) => {
    const index = rooms.findIndex((room) => room.key === control.dataset.roomLink);
    if (index < 0 || control.closest('.tpr-elevator')) return;
    event.preventDefault();
    if (exploring) closeExplore({ restoreFocus: false, scrollBack: false });
    clearTimeout(hashJumpTimer);
    hashJumpIndex = index;
    render(index);
    clearRoomHash();
    scrollToFloor(index, 'auto');
    hashJumpTimer = setTimeout(() => {
      hashJumpIndex = null;
      updateFromScroll();
    }, 120);
  }));

  function updateFromScroll() {
    const rect = host.getBoundingClientRect();
    document.body.classList.toggle('elevator-active', rect.top <= 1 && rect.bottom >= innerHeight - 1);
    if (exploring) {
      if (exploreOpening || !exploreArmed || exploreHandoffLocked) { ticking = false; return; }
      const geometry = getExploreGeometry();
      const offset = Math.max(0, -rect.top);
      const raw = (offset - exploreOrigin) / geometry.scrollDistance;
      if (raw >= exploreOpenProgress * .9) exploreCanClose = true;
      if (exploreCanClose && raw <= 0.02) {
        ticking = false;
        exitExploreToPage(-1);
        return;
      }
      setExploreProgress(raw);
      if ((offset - exploreOrigin) >= geometry.scrollDistance + 24) {
        ticking = false;
        if (active < rooms.length - 1) handoffExploreToNextRoom();
        else exitExploreToPage(1);
        return;
      }
      ticking = false;
      return;
    }
    if (initialJump || hashJumpIndex !== null || exploreHandoffLocked) { ticking = false; return; }
    const offset = Math.max(0, -rect.top);
    const progress = Math.min(1, offset / roomTravel());
    host.style.setProperty('--elevator-progress', progress);
    const next = Math.min(rooms.length - 1, Math.max(0, Math.round(progress * (rooms.length - 1))));
    if (rect.top <= 1 && rect.bottom >= innerHeight - 1 && next !== active) {
      if (host.classList.contains('is-lifting')) { ticking = false; return; }
      const direction = next > active ? 1 : -1;
      select(next, direction);
    }
    ticking = false;
  }

  addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateFromScroll);
  }, { passive: true });
  addEventListener('resize', () => {
    if (!isMobileView()) closeMobileDrop();
    updateFromScroll();
  }, { passive: true });
  addEventListener('hashchange', () => {
    if (exploring) return;
    const index = rooms.findIndex((room) => room.key === location.hash.slice(1));
    if (index < 0) return;
    clearTimeout(hashJumpTimer);
    hashJumpIndex = index;
    render(index);
    scrollToFloor(index, 'auto');
    clearRoomHash();
    hashJumpTimer = setTimeout(() => {
      hashJumpIndex = null;
      updateFromScroll();
    }, 120);
  });
  render(active);
  requestAnimationFrame(updateFromScroll);
  if (initialJump) {
    let jumpStarted = false;
    let jumpReleased = false;
    const releaseInitialJump = () => {
      if (jumpReleased) return;
      jumpReleased = true;
      initialJump = false;
      if (hashJumpIndex === initialIndex) hashJumpIndex = null;
      updateFromScroll();
    };
    const performInitialJump = () => {
      if (jumpStarted) return;
      jumpStarted = true;
      hashJumpIndex = initialIndex;
      render(initialIndex);
      requestAnimationFrame(() => {
        scrollToFloor(initialIndex, 'auto');
        clearRoomHash();
        requestAnimationFrame(releaseInitialJump);
      });
    };
    if (document.readyState === 'complete') performInitialJump();
    else addEventListener('load', performInitialJump, { once: true });
    setTimeout(performInitialJump, 0);
    setTimeout(releaseInitialJump, 800);
  }
})();
