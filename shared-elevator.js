(() => {
  const host = document.querySelector('#rooms');
  if (!host || host.dataset.elevatorReady) return;

  const base = new URL('.', document.currentScript.src);
  const asset = (file) => new URL(`assets/${file}`, base).href;
  const rooms = [
    {
      key: 'coworking', label: 'Coworking', art: 'homepage-room-coworking-clean-2x.webp', routeArt: 'routes/coworking-2x.webp', character: 'character-coworking.png', box: [5.85, 30.83, 8.10, 15.97], title: 'type-coworking.png', icon: 'elevator-icon-coworking.svg', off: 'elevator-icon-coworking-off.svg',
      description: 'Postazioni flessibili, sale riunioni e spazi per eventi in cui lavorare, incontrarsi e dare forma a nuove idee.', bookable: true,
      cards: [['Postazioni', 'Approfondisci le postazioni nella Coworking Room.'], ['Sale riunioni', 'Approfondisci le sale riunioni nella Coworking Room.'], ['Eventi', 'Approfondisci gli eventi nella Coworking Room.']],
    },
    {
      key: 'reformer', label: 'Reformer', art: 'homepage-room-reformer-clean-2x.webp', routeArt: 'routes/reformer-2x.webp', character: 'character-reformer.png', box: [5.79, 30.72, 8.20, 16.07], title: 'type-reformer.png', icon: 'elevator-icon-reformer.svg', off: 'elevator-icon-reformer-off.svg',
      description: 'Uno studio dedicato al movimento consapevole, con classi guidate e attrezzature professionali.', bookable: true,
      cards: [['Spazi', 'Approfondisci gli spazi nella Reformer Room.'], ['Classi', 'Approfondisci le classi nella Reformer Room.'], ['Attrezzature', 'Approfondisci le attrezzature nella Reformer Room.']],
    },
    {
      key: 'wellness', label: 'Wellness', art: 'homepage-room-wellness-clean-2x.webp', routeArt: 'routes/wellness-2x.webp', character: 'character-wellness.png', box: [5.99, 29.67, 7.80, 17.12], title: 'type-wellness.png', icon: 'elevator-icon-wellness.svg', off: 'elevator-icon-wellness-off.svg',
      description: 'Rituali e tecnologie per ritrovare equilibrio, energia e presenza.', bookable: false,
      cards: [['Power', 'Approfondisci Power nella Wellness Room.'], ['Biohacking', 'Approfondisci il biohacking nella Wellness Room.'], ['Contrast Therapy', 'Approfondisci la contrast therapy nella Wellness Room.']],
    },
    {
      key: 'bar', label: 'Bar', art: 'homepage-room-bar-clean-2x.webp', routeArt: 'routes/bar-2x.webp', character: 'character-bar.png', box: [6.98, 30.20, 5.82, 16.60], title: 'type-bar.png', icon: 'elevator-icon-bar.svg', off: 'elevator-icon-bar-off.svg',
      description: "Il punto di incontro quotidiano della community TPR, dalla colazione all'aperitivo.", bookable: false,
      cards: [['Servizi', 'Approfondisci i servizi nella Bar Room.'], ['Accessibilità', "Approfondisci l'accessibilità nella Bar Room."], ['Storage', 'Approfondisci lo storage nella Bar Room.']],
    },
    {
      key: 'media', label: 'Media', art: 'homepage-room-media-clean-2x.webp', routeArt: 'routes/media-2x.webp', character: 'character-media.png', box: [6.55, 27.57, 6.75, 19.22], title: 'type-media.png', icon: 'elevator-icon-media.svg', off: 'elevator-icon-media-off.svg',
      description: 'Uno studio pronto per podcast, shooting, streaming e nuovi linguaggi.', bookable: false,
      cards: [['Podcast', 'Approfondisci il podcast nella Media Room.'], ['Studio', 'Approfondisci lo studio nella Media Room.'], ['Set fotografico', 'Approfondisci il set fotografico nella Media Room.']],
    },
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
          <button class="tpr-elevator__mobile-cta" type="button" data-elevator-explore>Esplora Stanza <span class="tpr-elevator__cta-arrow" aria-hidden="true"></span></button>
        </div>
        <button class="tpr-elevator__cta" type="button" data-elevator-explore><span class="sr-only">Esplora ${rooms[active].label} Room</span></button>
        <span class="tpr-elevator__reformer-book-mask" aria-hidden="true"></span>
        <span class="tpr-elevator__bar-title-fix" aria-hidden="true"><img src="${asset('type-bar.png')}" alt=""></span>
        <nav class="tpr-elevator__nav" aria-label="Ascensore delle stanze">
          ${rooms.map((room, index) => `<button class="tpr-elevator__button" type="button" data-elevator-room="${room.key}" aria-label="Vai a ${room.label} Room" aria-pressed="${index === active}"><img class="icon-off" src="${asset(room.off)}" alt=""><img class="icon-on" src="${asset(room.icon)}" alt=""></button>`).join('')}
        </nav>
        <div class="tpr-elevator__progress" aria-hidden="true"><span></span></div>
        <div class="tpr-elevator__explore" aria-hidden="true">
          <div class="tpr-elevator__explore-track" aria-hidden="true"><img alt="" width="6864" height="1904"></div>
          <span class="tpr-elevator__explore-bar-title-fix" aria-hidden="true"><img src="${asset('type-bar.png')}" alt=""></span>
          <div class="tpr-elevator__explore-cards"></div>
          <div class="tpr-elevator__explore-progress" role="scrollbar" tabindex="0" aria-label="Scorri orizzontalmente la stanza" aria-orientation="horizontal" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
        </div>
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
  const exploreLayer = host.querySelector('.tpr-elevator__explore');
  const exploreTrackImage = host.querySelector('.tpr-elevator__explore-track img');
  const exploreBarTitleFix = host.querySelector('.tpr-elevator__explore-bar-title-fix');
  const exploreCards = host.querySelector('.tpr-elevator__explore-cards');
  const exploreProgressControl = host.querySelector('.tpr-elevator__explore-progress');
  const ROOM_SCROLL_FACTOR = 1.35;
  const ROOM_EXPLORE_PROGRESS = .4;
  const CARD_POSITIONS = [.439, .6265, .812];
  let exploring = false;
  let exploreProgress = 0;
  let exploreStartTimer = 0;
  let exploreHandoffLocked = false;
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

  function renderExploreCards(room) {
    exploreCards.innerHTML = room.cards.map(([cardTitle, cardCopy], index) => `
      <button class="tpr-elevator__explore-card" type="button" data-card-index="${index}" aria-expanded="false" aria-label="Apri la card ${cardTitle}">
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
    const source = asset(room.routeArt);
    exploreTrackImage.src = source;
    exploreBarTitleFix.hidden = room.key !== 'bar';
    renderExploreCards(room);
  }

  function getExploreGeometry() {
    const ratio = (exploreTrackImage.naturalWidth && exploreTrackImage.naturalHeight)
      ? exploreTrackImage.naturalWidth / exploreTrackImage.naturalHeight
      : 6864 / 1904;
    const rect = exploreTrackImage.getBoundingClientRect();
    const fallbackWidth = matchMedia('(max-width: 720px)').matches ? innerHeight * ratio : innerWidth * 2.26984;
    const width = rect.width > 0 ? rect.width : fallbackWidth;
    const height = rect.height > 0 ? rect.height : width / ratio;
    const travelMax = Math.max(0, width - innerWidth);
    const scrollDistance = Math.max(1, travelMax * ROOM_SCROLL_FACTOR);
    const handoffDistance = active < rooms.length - 1 ? Math.max(120, innerHeight * .32) : 0;
    if (exploring) host.style.height = `${innerHeight + scrollDistance + handoffDistance}px`;
    return { width, height, travelMax, scrollDistance, handoffDistance };
  }

  function setExploreProgress(progress) {
    if (!exploring) return;
    const bounded = Math.max(0, Math.min(1, progress));
    const geometry = getExploreGeometry();
    const travel = bounded * geometry.travelMax;
    exploreProgress = bounded;
    exploreLayer.style.setProperty('--explore-travel', `${travel}px`);
    exploreLayer.style.setProperty('--explore-progress', String(bounded));
    exploreProgressControl.setAttribute('aria-valuenow', String(Math.round(bounded * 100)));

    exploreCards.querySelectorAll('.tpr-elevator__explore-card').forEach((card, index) => {
      card.style.left = `${(CARD_POSITIONS[index] * geometry.width) - travel}px`;
      card.style.top = `${.264 * geometry.height}px`;
      card.style.width = `${.166 * geometry.width}px`;
      card.style.height = `${.47 * geometry.height}px`;
    });
    exploreBarTitleFix.style.left = `${(.232 * geometry.width) - travel}px`;
    exploreBarTitleFix.style.top = `${.145 * geometry.height}px`;
    exploreBarTitleFix.style.width = `${.18 * geometry.width}px`;
    exploreBarTitleFix.style.height = `${.21 * geometry.height}px`;
  }

  function scrollExploreTo(progress, behavior = 'auto') {
    const bounded = Math.max(0, Math.min(1, progress));
    const top = host.getBoundingClientRect().top + scrollY;
    const geometry = getExploreGeometry();
    scrollTo({ top: top + (geometry.scrollDistance * bounded), behavior });
  }

  function openExplore(opener) {
    if (exploring) return;
    clearTimeout(exploreStartTimer);
    exploring = true;
    setExploreRoom(rooms[active]);
    exploreLayer.setAttribute('aria-hidden', 'false');
    host.classList.add('is-exploring');
    document.body.classList.add('elevator-exploring');
    status.textContent = `${rooms[active].label} Room: esplorazione aperta nella homepage.`;
    host.dataset.mode = 'explore';
    host._exploreOpener = opener;
    setExploreProgress(0);
    scrollExploreTo(0, 'auto');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      host.classList.add('is-explore-ready');
      const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      scrollExploreTo(ROOM_EXPLORE_PROGRESS, behavior);
      if (behavior === 'smooth') {
        exploreStartTimer = setTimeout(() => scrollExploreTo(ROOM_EXPLORE_PROGRESS, 'auto'), 720);
      }
    }));
  }

  function closeExplore({ restoreFocus = true, scrollBack = true, updateHistory = true } = {}) {
    if (!exploring) return;
    clearTimeout(exploreStartTimer);
    const opener = host._exploreOpener;
    exploring = false;
    exploreProgress = 0;
    host.classList.remove('is-exploring', 'is-explore-ready');
    document.body.classList.remove('elevator-exploring');
    exploreLayer.setAttribute('aria-hidden', 'true');
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

  ctas.forEach((cta) => cta.addEventListener('click', () => openExplore(cta)));

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
