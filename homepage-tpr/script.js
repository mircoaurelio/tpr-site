const body = document.body;
const siteHeader = document.querySelector('#siteHeader');
const hero = document.querySelector('.hero');
const mobileHeaderQuery = matchMedia('(max-width: 1024px), (orientation: portrait)');
const videoDialog = document.querySelector('#videoDialog');
const videoButton = document.querySelector('#videoButton');
const videoTriggers = [...document.querySelectorAll('[data-video-trigger]')];
const closeVideo = document.querySelector('#closeVideo');
let videoOpener = videoButton;

function updateHeaderVisibility() {
  const heroIsPast = !mobileHeaderQuery.matches || !hero || hero.getBoundingClientRect().bottom <= 0;
  siteHeader.classList.toggle('is-past-hero', heroIsPast);
}

siteHeader.classList.toggle('is-scrolled', scrollY > 80);
updateHeaderVisibility();

function closeVideoDialog() {
  if (!videoDialog?.open) return;
  videoDialog.close();
  videoOpener?.focus({ preventScroll: true });
}

videoTriggers.forEach((trigger) => trigger.addEventListener('click', () => {
  videoOpener = trigger;
  body.classList.add('dialog-open');
  videoDialog.showModal();
}));
closeVideo?.addEventListener('click', closeVideoDialog);
videoDialog.addEventListener('close', () => body.classList.remove('dialog-open'));
videoDialog.addEventListener('click', (event) => {
  if (event.target === videoDialog || event.target.closest('.video-placeholder')) closeVideoDialog();
});

// The shared elevator owns the room state, sticky scroll and icon navigation.
if (false) {
const roomOrder = ['coworking', 'reformer', 'wellness', 'bar', 'media'];
const roomData = {
  coworking: {
    title: 'Coworking',
    titleAsset: '../assets/type-coworking.png',
    titleSize: [1124, 118],
    characterAsset: '../assets/character-coworking.png',
    characterSize: [358, 447],
    image: '../assets/tpr-hero.webp',
    alt: 'Lo spazio Coworking',
    description: 'Postazioni flessibili, sale riunioni e spazi per eventi. Un ambiente progettato per lavorare meglio, incontrarsi e dare forma a nuove idee.',
    features: [['Postazioni', 'Desk flessibili e dedicati'], ['Meeting', 'Sale e spazi riservabili'], ['Community', 'Idee, incontri ed eventi']],
  },
  reformer: {
    title: 'Reformer',
    titleAsset: '../assets/type-reformer.png',
    titleSize: [1025, 118],
    characterAsset: '../assets/character-reformer.png',
    characterSize: [363, 450],
    image: '../assets/tpr-reformer.webp',
    alt: 'Allenamento Reformer Pilates',
    description: 'Uno studio dedicato al movimento consapevole. Classi guidate, attrezzature professionali e un programma pensato per energia, controllo e postura.',
    features: [['Classi', 'Sessioni individuali e di gruppo'], ['Metodo', 'Movimento preciso e consapevole'], ['Attrezzatura', 'Reformer professionali']],
  },
  wellness: {
    title: 'Wellness',
    titleAsset: '../assets/type-wellness.png',
    titleSize: [1027, 117],
    characterAsset: '../assets/character-wellness.png',
    characterSize: [345, 480],
    image: '../assets/tpr-wellness.webp',
    alt: 'Trattamento nella Wellness Room',
    description: 'Rituali e tecnologie per ritrovare equilibrio, energia e presenza. Un luogo intimo dove recupero fisico e benessere mentale si incontrano.',
    features: [['Recovery', 'Recupero ed energia'], ['Biohacking', 'Pratiche e tecnologie'], ['Therapy', 'Caldo, freddo e respiro']],
  },
  bar: {
    title: 'Bar',
    titleAsset: '../assets/type-bar.png',
    titleSize: [570, 118],
    characterAsset: '../assets/character-bar.png',
    characterSize: [255, 465],
    image: '../assets/tpr-bar.webp',
    alt: 'Il Bar di The People’s Room',
    description: 'Il punto d’incontro quotidiano della community: colazioni lente, pause veloci e cocktail dopo il lavoro, sempre con qualcosa da condividere.',
    features: [['Coffee', 'Specialty coffee e colazioni'], ['Food', 'Proposte stagionali'], ['Social', 'Aperitivi e community']],
  },
  media: {
    title: 'Media',
    titleAsset: '../assets/type-media.png',
    titleSize: [681, 116],
    characterAsset: '../assets/character-media.png',
    characterSize: [299, 538],
    image: '../assets/tpr-media.webp',
    alt: 'La Media Room di The People’s Room',
    description: 'Uno studio pronto per podcast, shooting, streaming e nuovi linguaggi. Uno spazio tecnico, flessibile e immediato per dare voce alle idee.',
    features: [['Podcast', 'Registrazione audio e video'], ['Content', 'Shooting e live streaming'], ['Production', 'Setup modulare professionale']],
  },
};

Object.values(roomData).forEach(({ image, titleAsset, characterAsset }) => {
  [image, titleAsset, characterAsset].forEach((source) => {
    const preload = new Image();
    preload.src = source;
  });
});

const rooms = document.querySelector('#rooms');
const roomCta = document.querySelector('#roomCta');
const roomImage = document.querySelector('#roomImage');
const roomCharacter = document.querySelector('#roomCharacter');
const roomTitle = document.querySelector('#roomTitle');
const roomTitleGraphic = document.querySelector('#roomTitleGraphic');
const roomCount = document.querySelector('#roomCount');
const roomDescription = document.querySelector('#roomDescription');
const roomFeatures = document.querySelector('#roomFeatures');
const roomProgress = document.querySelector('#roomProgress');
const roomTabs = [...document.querySelectorAll('.room-tab')];
const roomTabsNav = document.querySelector('.room-tabs');
const roomPrev = document.querySelector('#roomPrev');
const roomNext = document.querySelector('#roomNext');
let activeRoom = 'coworking';
let roomTimer;

function renderRoom(key) {
  const data = roomData[key];
  const index = roomOrder.indexOf(key);
  rooms.dataset.activeRoom = key;
  roomImage.src = data.image;
  roomImage.alt = data.alt;
  roomCharacter.src = data.characterAsset;
  [roomCharacter.width, roomCharacter.height] = data.characterSize;
  roomTitle.textContent = `${data.title} Room`;
  roomTitleGraphic.src = data.titleAsset;
  [roomTitleGraphic.width, roomTitleGraphic.height] = data.titleSize;
  roomDescription.textContent = data.description;
  roomCta.href = `../${key}/`;
  roomCta.setAttribute('aria-label', `Esplora ${data.title} Room`);
  roomCount.textContent = `${String(index + 1).padStart(2, '0')} / ${String(roomOrder.length).padStart(2, '0')}`;
  roomProgress.textContent = `${String(index + 1).padStart(2, '0')} — ${String(roomOrder.length).padStart(2, '0')}`;
  roomFeatures.replaceChildren(...data.features.map(([title, text]) => {
    const item = document.createElement('li');
    const strong = document.createElement('strong');
    const span = document.createElement('span');
    strong.textContent = title;
    span.textContent = text;
    item.append(strong, span);
    return item;
  }));
  roomTabs.forEach((tab) => {
    const selected = tab.dataset.roomLink === key;
    tab.classList.toggle('is-active', selected);
    tab.setAttribute('aria-pressed', String(selected));
  });
  const selectedTab = roomTabs.find((tab) => tab.dataset.roomLink === key);
  const centeredLeft = selectedTab.offsetLeft - ((roomTabsNav.clientWidth - selectedTab.offsetWidth) / 2);
  roomTabsNav.scrollTo({
    left: Math.max(0, centeredLeft),
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
  activeRoom = key;
}

function setRoom(key, { scroll = false, updateHash = false, direction = null } = {}) {
  if (!roomData[key]) return;
  const changed = key !== activeRoom;
  const oldIndex = roomOrder.indexOf(activeRoom);
  const newIndex = roomOrder.indexOf(key);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reversing = direction ? direction === 'prev' : newIndex < oldIndex;
  rooms.classList.toggle('is-reversing', reversing);
  clearTimeout(roomTimer);
  activeRoom = key;
  if (reduceMotion) {
    renderRoom(key);
    rooms.classList.remove('is-changing');
  } else {
    if (changed) rooms.classList.add('is-changing');
    roomTimer = setTimeout(() => {
      renderRoom(key);
      requestAnimationFrame(() => rooms.classList.remove('is-changing'));
    }, changed ? 170 : 0);
  }
  if (updateHash) history.replaceState(null, '', `#${key}`);
  if (scroll) rooms.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}

document.querySelectorAll('[data-room-link]').forEach((control) => {
  control.addEventListener('click', (event) => {
    event.preventDefault();
    setRoom(control.dataset.roomLink, { scroll: !control.classList.contains('room-tab'), updateHash: true });
  });
});

roomPrev.addEventListener('click', () => {
  const index = (roomOrder.indexOf(activeRoom) - 1 + roomOrder.length) % roomOrder.length;
  setRoom(roomOrder[index], { updateHash: true, direction: 'prev' });
});
roomNext.addEventListener('click', () => {
  const index = (roomOrder.indexOf(activeRoom) + 1) % roomOrder.length;
  setRoom(roomOrder[index], { updateHash: true, direction: 'next' });
});

let elevatorLockUntil = 0;
rooms.addEventListener('wheel', (event) => {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || Math.abs(event.deltaY) < 24) return;
  const rect = rooms.getBoundingClientRect();
  const headerOffset = siteHeader.getBoundingClientRect().height;
  const isPinned = rect.top <= headerOffset + 12 && rect.bottom >= innerHeight - 12;
  if (!isPinned) return;
  const currentIndex = roomOrder.indexOf(activeRoom);
  const direction = event.deltaY > 0 ? 1 : -1;
  const nextIndex = currentIndex + direction;
  if (nextIndex < 0 || nextIndex >= roomOrder.length) return;
  event.preventDefault();
  if (performance.now() < elevatorLockUntil) return;
  elevatorLockUntil = performance.now() + 520;
  setRoom(roomOrder[nextIndex], {
    updateHash: true,
    direction: direction > 0 ? 'next' : 'prev',
  });
  rooms.scrollIntoView({ behavior: 'smooth', block: 'start' });
}, { passive: false });

const initialRoom = location.hash.slice(1);
if (roomData[initialRoom]) renderRoom(initialRoom);
addEventListener('hashchange', () => {
  const key = location.hash.slice(1);
  if (roomData[key]) setRoom(key);
});
}

const peopleCanvas = document.querySelector('.people-canvas');
const peopleTooltip = document.querySelector('#peopleTooltip');
document.querySelectorAll('.people-hotspots [data-room-link]').forEach((hotspot) => {
  hotspot.addEventListener('pointerenter', () => {
    peopleTooltip.textContent = hotspot.dataset.hoverLabel || hotspot.getAttribute('aria-label') || '';
    peopleTooltip.classList.add('is-visible');
  });
  hotspot.addEventListener('pointermove', (event) => {
    const rect = peopleCanvas.getBoundingClientRect();
    const x = Math.min(event.clientX - rect.left + 18, rect.width - peopleTooltip.offsetWidth - 8);
    const y = Math.min(event.clientY - rect.top + 18, rect.height - peopleTooltip.offsetHeight - 8);
    peopleTooltip.style.setProperty('--tooltip-x', `${Math.max(8, x)}px`);
    peopleTooltip.style.setProperty('--tooltip-y', `${Math.max(8, y)}px`);
  });
  hotspot.addEventListener('pointerleave', () => peopleTooltip.classList.remove('is-visible'));
});

const revealObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('is-visible');
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.1 }) : null;

document.querySelectorAll('.reveal').forEach((element) => {
  if (revealObserver) revealObserver.observe(element);
  else element.classList.add('is-visible');
});

const eventsImage = document.querySelector('.events-visual img');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let ticking = false;

function onScroll() {
  siteHeader.classList.toggle('is-scrolled', scrollY > 80);
  updateHeaderVisibility();
  if (reducedMotion.matches || ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    const rect = eventsImage.getBoundingClientRect();
    if (rect.top < innerHeight && rect.bottom > 0) {
      const progress = (innerHeight - rect.top) / (innerHeight + rect.height);
      eventsImage.style.transform = `translateY(${(progress - 0.55) * 8}%) scale(1.08)`;
    }
    ticking = false;
  });
}

addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', updateHeaderVisibility, { passive: true });
mobileHeaderQuery.addEventListener('change', updateHeaderVisibility);
reducedMotion.addEventListener('change', (event) => {
  if (event.matches) eventsImage.style.transform = 'none';
});
