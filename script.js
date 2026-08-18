const siteRoot = new URL('.', document.currentScript.src);
const roomAsset = (name) => new URL(`assets/${name}`, siteRoot).href;
const routeUrl = (path) => new URL(path, siteRoot).href;
const roomOrder = ['coworking', 'reformer', 'wellness', 'bar', 'media'];
const roomData = {
  coworking: {
    label: 'Coworking',
    heading: 'Coworking Room',
    art: roomAsset('homepage-room-coworking-2x.png'),
  },
  reformer: {
    label: 'Reformer',
    heading: 'Reformer Room',
    art: roomAsset('homepage-room-reformer-2x.png'),
  },
  wellness: {
    label: 'Wellness',
    heading: 'Wellness Room',
    art: roomAsset('homepage-room-wellness-2x.png'),
  },
  bar: {
    label: 'Bar e integratori',
    heading: 'Bar Room',
    art: roomAsset('homepage-room-bar-2x.png'),
  },
  media: {
    label: 'Media e podcast',
    heading: 'Media Room',
    art: roomAsset('homepage-room-media-2x.png'),
  },
};

const rooms = document.querySelector('#rooms');
const roomArt = document.querySelector('#roomArt');
const roomHeading = document.querySelector('#room-heading');
const roomStatus = document.querySelector('#room-status');
const roomCta = document.querySelector('#roomCta');
const roomDots = [...document.querySelectorAll('.room-dot')];
const roomControls = [...document.querySelectorAll('[data-room-link]')];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let activeRoom = 'coworking';
let roomTimer = 0;

Object.values(roomData).forEach(({ art }) => {
  const image = new Image();
  image.src = art;
});

function renderRoom(key) {
  const data = roomData[key];
  activeRoom = key;
  roomArt.src = data.art;
  rooms.dataset.activeRoom = key;
  roomHeading.textContent = data.heading;
  roomStatus.textContent = `Spazio ${data.label} selezionato.`;
  roomCta.querySelector('.sr-only').textContent = `Esplora la stanza ${data.label}`;
  roomCta.href = routeUrl(`${key}/`);
  roomDots.forEach((dot) => {
    const selected = dot.dataset.roomLink === key;
    dot.classList.toggle('is-active', selected);
    dot.setAttribute('aria-pressed', String(selected));
  });
}

function setRoom(key, { scroll = false, updateHash = true } = {}) {
  if (!roomData[key]) return;
  const oldIndex = roomOrder.indexOf(activeRoom);
  const newIndex = roomOrder.indexOf(key);
  const changed = key !== activeRoom;
  const reversing = oldIndex >= 0 && newIndex < oldIndex && !(oldIndex === roomOrder.length - 1 && newIndex === 0);
  activeRoom = key;
  clearTimeout(roomTimer);
  rooms.classList.toggle('is-reversing', reversing);

  if (!changed || reduceMotion.matches) {
    renderRoom(key);
    rooms.classList.remove('is-changing');
  } else {
    rooms.classList.add('is-changing');
    roomTimer = window.setTimeout(() => {
      renderRoom(key);
      requestAnimationFrame(() => rooms.classList.remove('is-changing'));
    }, 180);
  }

  if (updateHash) history.replaceState(null, '', `#${key}`);
  if (scroll) rooms.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
}

roomControls.forEach((control) => {
  control.addEventListener('click', (event) => {
    event.preventDefault();
    setRoom(control.dataset.roomLink, {
      scroll: !control.classList.contains('room-dot'),
      updateHash: true,
    });
  });
});

const initialRoom = location.hash.slice(1);
if (roomData[initialRoom]) renderRoom(initialRoom);

addEventListener('hashchange', () => {
  const key = location.hash.slice(1);
  if (roomData[key]) setRoom(key, { updateHash: false });
});
