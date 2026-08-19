(() => {
  const host = document.querySelector('#rooms');
  if (!host || host.dataset.elevatorReady) return;

  const base = new URL('.', document.currentScript.src);
  const asset = (file) => {
    const url = new URL(`assets/${file}`, base);
    if (file.includes('elevator-icon')) url.searchParams.set('v', '20260819-rev-3');
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
  const roomTitle = (room) => `${room.label}<span>Room</span>`;
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
          <h2 class="tpr-elevator__title" id="elevatorTitle">${roomTitle(rooms[active])}</h2>
          <p class="tpr-elevator__description">${copyParagraphs.join(' ')}</p>
          <div class="tpr-elevator__mobile-actions">
            <button class="tpr-elevator__mobile-cta" type="button" data-elevator-explore>Esplora Stanza <span class="tpr-elevator__cta-arrow" aria-hidden="true"></span></button>
            <a class="tpr-elevator__mobile-book" data-elevator-book href="${bookingUrl(rooms[active].key)}" ${rooms[active].bookable ? '' : 'hidden'}>Prenota</a>
          </div>
        </div>
        <div class="tpr-elevator__desktop-copy">
          <h2>${roomTitle(rooms[active])}</h2>
          ${roomCopyHtml}
          <div class="tpr-elevator__desktop-actions">
            <button class="tpr-elevator__cta" type="button" data-elevator-explore aria-label="Esplora ${rooms[active].label} Room"><span>Esplora Stanza</span><span class="tpr-elevator__cta-arrow" aria-hidden="true"></span></button>
            <a class="tpr-elevator__book" data-elevator-book href="${bookingUrl(rooms[active].key)}" ${rooms[active].bookable ? '' : 'hidden'}>Prenota<span class="sr-only"> ${rooms[active].label} Room</span></a>
          </div>
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

  const art = host.querySelector('.tpr-elevator__art--current');
  const incomingArt = host.querySelector('.tpr-elevator__art--incoming');
  const currentCharacter = host.querySelector('.tpr-elevator__character--current');
  const incomingCharacter = host.querySelector('.tpr-elevator__character--incoming');
  const titles = [...host.querySelectorAll('.tpr-elevator__title, .tpr-elevator__desktop-copy h2')];
  const ctas = [...host.querySelectorAll('[data-elevator-explore]')];
  const bookLinks = [...host.querySelectorAll('[data-elevator-book]')];
  const buttons = [...host.querySelectorAll('[data-elevator-room]')];
  const status = host.querySelector('#elevatorStatus');
  const frame = host.querySelector('.tpr-elevator__frame');
  const nav = host.querySelector('.tpr-elevator__nav');
  const desktopCopy = host.querySelector('.tpr-elevator__desktop-copy');
  const exploreLayer = host.querySelector('.tpr-elevator__explore');
  const exploreTrack = host.querySelector('.tpr-elevator__explore-track');
  const exploreTrackImage = host.querySelector('.tpr-elevator__explore-track img');
  const exploreCards = host.querySelector('.tpr-elevator__explore-cards');
  const exploreProgressControl = host.querySelector('.tpr-elevator__explore-progress');
  const ROOM_SCROLL_FACTOR = 1.35;
  const ROOM_EXPLORE_PROGRESS = .4;
  const EXPLORE_OPEN_MS = 720;
  let exploring = false;
  let exploreProgress = 0;
  let exploreStartTimer = 0;
  let exploreOpenRaf = 0;
  let exploreOpening = false;
  let exploreHandoffLocked = false;
  const preloadedImages = new Map();
  rooms.forEach((room) => {
    [room.art, room.character].forEach((file) => {
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
    element.style.setProperty('--character-x', `${Math.max(0, x - 1.4)}%`);
    element.style.setProperty('--character-y', `${Math.max(0, y - 3)}%`);
    element.style.setProperty('--character-width', `${width}%`);
    element.style.setProperty('--character-height', `${height}%`);
  }

  function updateMeta(index, direction = 0) {
    const room = rooms[index];
    active = index;
    host.dataset.activeRoom = room.key;
    titles.forEach((title) => { title.innerHTML = roomTitle(room); });
    status.textContent = `${room.label} Room selezionata.`;
    ctas.forEach((cta) => {
      cta.setAttribute('aria-label', `Esplora ${room.label} Room`);
    });
    bookLinks.forEach((link) => {
      link.href = bookingUrl(room.key);
      link.hidden = !room.bookable;
      const sr = link.querySelector('.sr-only');
      if (sr) sr.textContent = ` ${room.label} Room`;
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
    [room.art, room.character].forEach((file) => {
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

  function renderExploreCards(room) {
    exploreCards.innerHTML = room.cards.map(([cardTitle, cardCopy], index) => `
      <button class="tpr-elevator__explore-card" type="button" data-card-index="${index}" aria-expanded="false" aria-label="Apri la card ${cardTitle}">
        <span class="tpr-elevator__card-front" aria-hidden="true"><strong>${cardTitle}</strong><span class="tpr-elevator__card-arrow"></span></span>
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

  function getExploreGeometry() {
    const ratio = (exploreTrackImage.naturalWidth && exploreTrackImage.naturalHeight)
      ? exploreTrackImage.naturalWidth / exploreTrackImage.naturalHeight
      : 6864 / 1904;
    const viewHeight = frame.clientHeight || innerHeight;
    const expectedWidth = viewHeight * ratio;
    const rect = exploreTrack.getBoundingClientRect();
    const width = Math.max(rect.width, expectedWidth);
    const height = rect.height > 0 ? rect.height : viewHeight;
    const travelMax = Math.max(0, width - innerWidth);
    const scrollDistance = Math.max(1, travelMax * ROOM_SCROLL_FACTOR);
    const handoffDistance = active < rooms.length - 1 ? Math.max(120, innerHeight * .32) : 0;
    if (exploring) host.style.height = `${innerHeight + scrollDistance + handoffDistance}px`;
    return { width, height, travelMax, scrollDistance, handoffDistance };
  }

  function getOpeningExploreProgress() {
    const geometry = getExploreGeometry();
    if (geometry.travelMax <= 0) return ROOM_EXPLORE_PROGRESS;
    const hideLeftPhoto = Math.min(innerWidth * .5, geometry.width * .22);
    const keepCopyOnScreen = Math.max(0, geometry.width * .232 - 40);
    const travel = Math.min(hideLeftPhoto, keepCopyOnScreen);
    return Math.max(.22, Math.min(ROOM_EXPLORE_PROGRESS, travel / geometry.travelMax));
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
      top: top + (geometry.scrollDistance * bounded),
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
    setExploreRoom(rooms[active]);
    exploreLayer.setAttribute('aria-hidden', 'false');
    host.classList.add('is-exploring', 'is-explore-opening');
    document.body.classList.add('elevator-exploring');
    status.textContent = `${rooms[active].label} Room: esplorazione aperta nella homepage.`;
    host.dataset.mode = 'explore';
    host._exploreOpener = opener;
    if (desktopCopy.parentElement !== exploreTrack) exploreTrack.appendChild(desktopCopy);
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setExploreProgress(0);
    scrollExploreTo(0, 'auto');
    const opening = getOpeningExploreProgress();
    const finishOpening = () => {
      if (!exploring) return;
      scrollExploreTo(opening, 'auto');
      setExploreProgress(opening);
      host.classList.add('is-explore-ready');
      host.classList.remove('is-explore-opening');
      exploreOpening = false;
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
        setExploreProgress(opening * easeExploreOpen(t));
        if (t < 1) exploreOpenRaf = requestAnimationFrame(tick);
        else finishOpening();
      };
      exploreOpenRaf = requestAnimationFrame(tick);
    }));
  }

  function closeExplore({ restoreFocus = true, scrollBack = true, updateHistory = true } = {}) {
    if (!exploring) return;
    clearTimeout(exploreStartTimer);
    cancelAnimationFrame(exploreOpenRaf);
    const opener = host._exploreOpener;
    exploring = false;
    exploreOpening = false;
    exploreProgress = 0;
    host.classList.remove('is-exploring', 'is-explore-ready', 'is-explore-opening');
    document.body.classList.remove('elevator-exploring');
    exploreLayer.setAttribute('aria-hidden', 'true');
    if (desktopCopy.parentElement !== frame) frame.insertBefore(desktopCopy, nav);
    host.style.removeProperty('--explore-travel');
    host.style.removeProperty('--explore-progress');
    exploreLayer.style.removeProperty('--explore-travel');
    exploreLayer.style.removeProperty('--explore-progress');
    host.style.removeProperty('height');
    delete host.dataset.mode;
    if (updateHistory) history.replaceState(null, '', `#${rooms[active].key}`);
    requestAnimationFrame(() => {
      if (scrollBack) scrollToFloor(active, 'auto');
      if (restoreFocus && opener instanceof HTMLElement) opener.focus({ preventScroll: true });
    });
  }

  function handoffExploreToNextRoom() {
    if (!exploring || exploreHandoffLocked || active >= rooms.length - 1) return;
    exploreHandoffLocked = true;
    const next = active + 1;
    hashJumpIndex = next;
    closeExplore({ restoreFocus: false, scrollBack: false, updateHistory: false });
    select(next, 1);
    history.replaceState(null, '', `#${rooms[next].key}`);
    requestAnimationFrame(() => {
      scrollToFloor(next, 'auto');
      status.textContent = `${rooms[next].label} Room selezionata.`;
      setTimeout(() => {
        exploreHandoffLocked = false;
        hashJumpIndex = null;
        updateFromScroll();
      }, 360);
    });
  }

  ctas.forEach((cta) => cta.addEventListener('click', () => {
    if (exploring) return;
    openExplore(cta);
  }));

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
    if (event.key === 'Escape' && exploring) closeExplore();
  });

  function scrollToFloor(index, behavior = null) {
    const travel = Math.max(0, host.offsetHeight - innerHeight);
    const top = host.getBoundingClientRect().top + scrollY;
    const target = top + travel * (index / (rooms.length - 1));
    const requestedBehavior = behavior || (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
    scrollTo({ top: target, behavior: requestedBehavior === 'auto' ? 'instant' : requestedBehavior });
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
    if (exploring) closeExplore({ restoreFocus: false, scrollBack: false });
    clearTimeout(hashJumpTimer);
    hashJumpIndex = index;
    render(index, 0);
    history.pushState(null, '', `#${rooms[index].key}`);
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
      if (exploreOpening) { ticking = false; return; }
      const geometry = getExploreGeometry();
      const offset = Math.max(0, -rect.top);
      setExploreProgress(offset / geometry.scrollDistance);
      if (geometry.handoffDistance > 0 && offset >= geometry.scrollDistance + (geometry.handoffDistance * .72)) {
        handoffExploreToNextRoom();
      }
      ticking = false;
      return;
    }
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
    if (exploring) return;
    const index = rooms.findIndex((room) => room.key === location.hash.slice(1));
    if (index < 0) return;
    clearTimeout(hashJumpTimer);
    hashJumpIndex = index;
    render(index, 0);
    scrollToFloor(index, 'auto');
    hashJumpTimer = setTimeout(() => {
      hashJumpIndex = null;
      updateFromScroll();
    }, 120);
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
        hashJumpIndex = initialIndex;
        render(initialIndex, 0);
        scrollToFloor(initialIndex, 'auto');
        requestAnimationFrame(() => requestAnimationFrame(() => {
          render(initialIndex, 0);
          initialJump = false;
          hashJumpIndex = null;
          updateFromScroll();
        }));
      }, 420);
      });
    };
    if (document.readyState === 'complete') performInitialJump();
    else addEventListener('load', performInitialJump, { once: true });
    setTimeout(performInitialJump, 0);
  }
})();
