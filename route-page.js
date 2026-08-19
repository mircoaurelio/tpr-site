const reduceMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const openMenuButton = document.querySelector('[data-open-menu]');
const closeMenuButton = document.querySelector('[data-close-menu]');
const menu = document.querySelector('#siteMenu');
const pageMain = document.querySelector('main');
let menuOpener = null;

function openMenu() {
  if (!menu) return;
  menuOpener = document.activeElement;
  menu.classList.add('is-open');
  menu.setAttribute('aria-hidden', 'false');
  openMenuButton?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
  if (pageMain) pageMain.inert = true;
  requestAnimationFrame(() => closeMenuButton?.focus({ preventScroll: true }));
}

function closeMenu({ restoreFocus = true } = {}) {
  if (!menu) return;
  menu.classList.remove('is-open');
  menu.setAttribute('aria-hidden', 'true');
  openMenuButton?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
  if (pageMain) pageMain.inert = false;
  if (restoreFocus && menuOpener instanceof HTMLElement) menuOpener.focus({ preventScroll: true });
}

openMenuButton?.addEventListener('click', openMenu);
closeMenuButton?.addEventListener('click', () => closeMenu());
menu?.addEventListener('click', (event) => {
  if (event.target.closest('a')) closeMenu({ restoreFocus: false });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menu?.classList.contains('is-open')) closeMenu();
  if (event.key !== 'Tab' || !menu?.classList.contains('is-open')) return;
  const focusable = [...menu.querySelectorAll('a, button:not([disabled])')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

const roomScene = document.querySelector('[data-room-scene]');
const roomSticky = document.querySelector('[data-room-sticky]');
const roomCanvas = roomSticky?.querySelector('.room-track img');
const roomCards = [...document.querySelectorAll('[data-card-x]')];
const roomTitleFix = document.querySelector('[data-room-title-fix]');
const exploreRoomButtons = [...document.querySelectorAll('[data-explore-room], [data-track-explore]')];
const trackExploreButton = document.querySelector('[data-track-explore]');
const bookRoomButton = document.querySelector('.room-action--book');
const roomProgressControl = document.querySelector('.room-progress');
const ROOM_SCROLL_FACTOR = 1.35;
const ROOM_EXPLORE_PROGRESS = .4;

function getRoomGeometry() {
  if (!roomCanvas || !roomScene) return { width: innerWidth, height: innerHeight, travelMax: 0 };
  const rect = roomCanvas.getBoundingClientRect();
  const intrinsicRatio = (roomCanvas.width && roomCanvas.height) ? roomCanvas.width / roomCanvas.height : 3432 / 952;
  const fallbackWidth = matchMedia('(max-width: 720px)').matches ? innerHeight * intrinsicRatio : innerWidth * 2.26984;
  const width = rect.width > 0 ? rect.width : fallbackWidth;
  const height = rect.height > 0 ? rect.height : width / intrinsicRatio;
  const travelMax = Math.max(0, width - innerWidth);
  roomScene.style.height = `${innerHeight + (travelMax * ROOM_SCROLL_FACTOR)}px`;
  return { width, height, travelMax };
}

function scrollRoomTo(progress, behavior = 'auto') {
  if (!roomScene) return;
  const bounded = Math.max(0, Math.min(1, progress));
  const sceneTop = roomScene.getBoundingClientRect().top + scrollY;
  getRoomGeometry();
  const distance = Math.max(0, roomScene.offsetHeight - innerHeight);
  scrollTo({ top: sceneTop + (distance * bounded), behavior });
}

function setRoomProgress(progress) {
  const bounded = Math.max(0, Math.min(1, progress));
  if (!roomCanvas || !roomScene || !roomSticky) return;
  if (roomSticky.scrollLeft) roomSticky.scrollLeft = 0;
  const canvasRect = getRoomGeometry();
  const travelMax = canvasRect.travelMax;
  const travel = bounded * travelMax;
  roomSticky.style.setProperty('--room-travel', `${travel}px`);
  roomSticky?.style.setProperty('--room-progress', String(bounded));
  roomSticky.classList.toggle('is-exploring', bounded > .22);
  roomProgressControl?.setAttribute('aria-valuenow', String(Math.round(bounded * 100)));

  roomCards.forEach((button) => {
    const sourceX = Number(button.dataset.cardX);
    button.style.left = `${(sourceX * canvasRect.width) - travel}px`;
    button.style.top = `${.264 * canvasRect.height}px`;
    button.style.width = `${.166 * canvasRect.width}px`;
    button.style.height = `${.47 * canvasRect.height}px`;
  });

  if (roomTitleFix) {
    roomTitleFix.style.left = `${(.232 * canvasRect.width) - travel}px`;
    roomTitleFix.style.top = `${.277 * canvasRect.height}px`;
    roomTitleFix.style.width = `${.185 * canvasRect.width}px`;
    roomTitleFix.style.height = `${.445 * canvasRect.height}px`;
  }

  if (trackExploreButton) {
    trackExploreButton.style.left = `${(.232 * canvasRect.width) - travel}px`;
    trackExploreButton.style.top = `${.702 * canvasRect.height}px`;
    trackExploreButton.style.width = `${.078 * canvasRect.width}px`;
    trackExploreButton.style.height = `${Math.max(44, .039 * canvasRect.height)}px`;
  }
  if (bookRoomButton) {
    bookRoomButton.style.left = `${(.318 * canvasRect.width) - travel}px`;
    bookRoomButton.style.top = `${.702 * canvasRect.height}px`;
    bookRoomButton.style.width = `${.055 * canvasRect.width}px`;
    bookRoomButton.style.height = `${Math.max(44, .039 * canvasRect.height)}px`;
  }
}

function updateRoomScroll() {
  if (!roomScene || !roomSticky) return;
  const rect = roomScene.getBoundingClientRect();
  const distance = Math.max(1, roomScene.offsetHeight - innerHeight);
  setRoomProgress(-rect.top / distance);
}

if (roomScene && roomSticky) {
  updateRoomScroll();
  roomCanvas?.addEventListener('load', updateRoomScroll);
  addEventListener('scroll', updateRoomScroll, { passive: true });
  addEventListener('resize', updateRoomScroll);
}

if (roomProgressControl && roomScene) {
  roomProgressControl.setAttribute('role', 'scrollbar');
  roomProgressControl.setAttribute('tabindex', '0');
  roomProgressControl.setAttribute('aria-label', 'Scorri orizzontalmente la stanza');
  roomProgressControl.setAttribute('aria-orientation', 'horizontal');
  roomProgressControl.setAttribute('aria-valuemin', '0');
  roomProgressControl.setAttribute('aria-valuemax', '100');
  roomProgressControl.setAttribute('aria-valuenow', '0');

  const progressFromPointer = (event) => {
    const rect = roomProgressControl.getBoundingClientRect();
    scrollRoomTo((event.clientX - rect.left) / Math.max(1, rect.width));
  };

  roomProgressControl.addEventListener('pointerdown', (event) => {
    roomProgressControl.setPointerCapture(event.pointerId);
    progressFromPointer(event);
  });
  roomProgressControl.addEventListener('pointermove', (event) => {
    if (roomProgressControl.hasPointerCapture(event.pointerId)) progressFromPointer(event);
  });
  roomProgressControl.addEventListener('keydown', (event) => {
    const current = Number(roomProgressControl.getAttribute('aria-valuenow') || 0) / 100;
    const moves = {
      ArrowLeft: current - .08,
      ArrowRight: current + .08,
      PageUp: current - .25,
      PageDown: current + .25,
      Home: 0,
      End: 1,
    };
    if (!(event.key in moves)) return;
    event.preventDefault();
    scrollRoomTo(moves[event.key], reduceMotionQuery.matches ? 'auto' : 'smooth');
  });
  updateRoomScroll();
}

exploreRoomButtons.forEach((button) => button.addEventListener('click', () => {
  if (roomSticky?.scrollLeft) roomSticky.scrollLeft = 0;
  const behavior = reduceMotionQuery.matches ? 'auto' : 'smooth';
  scrollRoomTo(ROOM_EXPLORE_PROGRESS, behavior);
  if (behavior === 'smooth') setTimeout(() => scrollRoomTo(ROOM_EXPLORE_PROGRESS, 'auto'), 620);
}));

if (roomScene && location.hash === '#explore') {
  const startExploration = () => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollRoomTo(ROOM_EXPLORE_PROGRESS, reduceMotionQuery.matches ? 'auto' : 'smooth');
      setTimeout(() => scrollRoomTo(ROOM_EXPLORE_PROGRESS, 'auto'), 720);
    }));
  };
  if (document.readyState === 'complete') startExploration();
  else addEventListener('load', startExploration, { once: true });
}

document.querySelectorAll('[data-card-title]').forEach((button) => {
  const cardName = button.dataset.cardTitle || 'stanza';
  const front = document.createElement('span');
  front.className = 'room-card-front';
  front.setAttribute('aria-hidden', 'true');
  front.innerHTML = `<strong>${cardName}</strong><span class="room-card-front__arrow"></span>`;
  const back = document.createElement('span');
  back.className = 'room-card-back';
  back.setAttribute('aria-hidden', 'true');
  back.innerHTML = `
    <strong class="room-card-back__title">Cosa si fa?</strong>
    <span class="room-card-back__close" aria-hidden="true"></span>
    <span class="room-card-back__copy">Il nostro obiettivo quotidiano è ispirare le persone a esprimere sé stesse, riscoprire il valore dell'umanità e vivere in modo più presente, creativo e vitale.<br><br>Il nostro obiettivo quotidiano è ispirare le persone a esprimere sé stesse, riscoprire il valore dell'umanità e vivere in modo più presente, creativo e vitale.</span>
    <span class="room-card-back__cta">Diventa Membro</span>`;
  button.prepend(front);
  button.append(back);
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-label', `Apri la card ${cardName}`);
  button.addEventListener('click', () => {
    const expanded = button.classList.toggle('is-flipped');
    button.setAttribute('aria-expanded', String(expanded));
    button.setAttribute('aria-label', expanded ? `Chiudi i dettagli di ${cardName}` : `Apri la card ${cardName}`);
    back.setAttribute('aria-hidden', String(!expanded));
  });
});

document.querySelector('[data-contact-form]')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const status = event.currentTarget.querySelector('.mobile-form-status');
  status.textContent = "Messaggio pronto per l'invio.";
});
