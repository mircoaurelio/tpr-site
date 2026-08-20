(() => {
  const siteRoot = new URL('.', document.currentScript.src);
  const url = (path) => new URL(path, siteRoot).href;
  const ROOM_KEYS = ['coworking', 'bar', 'media', 'reformer', 'wellness'];
  const littleManMarkup = {};
  let littleMenLoad = null;
  let littleMenIdleBound = false;
  let bumpLittleMenIdle = () => {};
  const root = document.documentElement;

  function roomKeyFrom(link) {
    if (ROOM_KEYS.includes(link.dataset.roomLink)) return link.dataset.roomLink;
    const match = (link.getAttribute('href') || '').match(/#(coworking|bar|media|reformer|wellness)\b/);
    return match ? match[1] : '';
  }

  function normalizeSvg(svg, key) {
    svg = svg.replace(/\srole="img"\saria-label="[^"]+"/, ' aria-hidden="true"');
    if (!/class="[^"]*little-man/.test(svg)) {
      svg = svg.replace(/<svg\b/, `<svg class="little-man little-man--${key}"`);
    }
    return svg;
  }

  function mountLittleManLinks(scope = document) {
    scope.querySelectorAll('.site-menu__room').forEach((link) => {
      const key = roomKeyFrom(link);
      if (!key) return;
      link.dataset.roomLink = key;
      if (littleManMarkup[key]) {
        if (!link.querySelector('.little-man')) link.innerHTML = littleManMarkup[key];
        return;
      }
      if (!link.querySelector('img, .little-man')) {
        link.innerHTML = `<img src="${url(`assets/elevator-icon-${key}-off.svg`)}?v=20260819-icons-1" alt="">`;
      }
    });
  }

  function visibleLittleMen() {
    return [...document.querySelectorAll('.people-figure, .site-menu__room, .tpr-elevator__character--current')].filter((el) => {
      if (!el.querySelector('.little-man')) return false;
      const menuHost = el.closest('.site-menu');
      if (menuHost && !menuHost.classList.contains('is-open')) return false;
      const elevator = el.closest('.tpr-elevator');
      return !elevator || !elevator.classList.contains('is-exploring');
    });
  }

  function stopLittleMen() {
    document.querySelectorAll('.people-figure.is-playing, .site-menu__room.is-playing, .tpr-elevator__character.is-playing').forEach((el) => {
      el.classList.remove('is-playing');
    });
  }

  function bindLittleManIdle() {
    if (littleMenIdleBound) return;
    littleMenIdleBound = true;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let idleTimer = 0;
    let playTimer = 0;

    function schedule() {
      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(playIdle, 2000);
    }

    function playIdle() {
      const items = visibleLittleMen();
      if (!items.length) {
        schedule();
        return;
      }
      stopLittleMen();
      items.forEach((el, index) => {
        window.setTimeout(() => {
          el.classList.remove('is-playing');
          void el.offsetWidth;
          el.classList.add('is-playing');
        }, index * 70);
      });
      window.clearTimeout(playTimer);
      playTimer = window.setTimeout(() => {
        stopLittleMen();
        schedule();
      }, 1100 + items.length * 70);
    }

    bumpLittleMenIdle = () => {
      window.clearTimeout(playTimer);
      stopLittleMen();
      schedule();
    };

    ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((type) => {
      addEventListener(type, bumpLittleMenIdle, { passive: true });
    });
    schedule();
  }

  window.tprLittleMen = {
    svg(key) { return littleManMarkup[key] || ''; },
    get ready() { return littleMenLoad || Promise.resolve(); },
  };

  function initLittleMen() {
    bindLittleManIdle();
    if (!littleMenLoad) {
      littleMenLoad = Promise.all(ROOM_KEYS.map(async (key) => {
        const response = await fetch(`${url(`assets/little-man/${key}.svg`)}?v=20260820-little-men-2`);
        if (!response.ok) return;
        littleManMarkup[key] = normalizeSvg(await response.text(), key);
      })).catch(() => {});
    }
    littleMenLoad.then(() => {
      mountLittleManLinks();
      document.dispatchEvent(new Event('tpr-little-men-ready'));
    });
  }
  const scrollLockClasses = ['menu-open', 'dialog-open', 'card-open'];

  function scrollbarGap() {
    return Math.max(0, innerWidth - root.clientWidth);
  }

  function isOverflowLocked() {
    return scrollLockClasses.some((name) => document.body.classList.contains(name));
  }

  function rememberScrollbarGap() {
    if (root.classList.contains('is-scroll-locked') || isOverflowLocked()) return;
    root.style.setProperty('--tpr-scrollbar-gap', `${scrollbarGap()}px`);
  }

  function syncScrollLock() {
    const locked = isOverflowLocked();
    root.classList.toggle('is-scroll-locked', locked);
    if (!locked) rememberScrollbarGap();
  }

  rememberScrollbarGap();
  addEventListener('resize', rememberScrollbarGap);
  addEventListener('load', rememberScrollbarGap);
  document.fonts?.ready?.then(rememberScrollbarGap);
  new MutationObserver(syncScrollLock).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  let cursor = document.querySelector('#tprCursor');
  if (!cursor) {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="tpr-cursor" id="tprCursor" aria-hidden="true">
        <img class="tpr-cursor__spark" src="${url('assets/cursor-spark.png')}?v=20260819-rev-5" alt="" width="110" height="87">
        <img class="tpr-cursor__eye" src="${url('assets/cursor-eye.png')}?v=20260819-rev-5" alt="" width="110" height="61">
      </div>`);
    cursor = document.querySelector('#tprCursor');
  } else {
    const spark = cursor.querySelector('.tpr-cursor__spark');
    const eye = cursor.querySelector('.tpr-cursor__eye');
    if (spark) spark.src = `${url('assets/cursor-spark.png')}?v=20260819-rev-5`;
    if (eye) eye.src = `${url('assets/cursor-eye.png')}?v=20260819-rev-5`;
    document.body.appendChild(cursor);
  }
  const finePointer = matchMedia('(pointer: fine)');
  if (finePointer.matches && cursor && !cursor.dataset.cursorReady) {
    cursor.dataset.cursorReady = 'true';
    document.documentElement.classList.add('has-tpr-cursor');
    const actionSelector = 'a, button, input, select, textarea, summary, [role="button"], [data-room-link]';
    let promoteFrame = 0;

    function topLayerHost() {
      return document.querySelector('dialog[open]') || document.body;
    }

    function restackCursor() {
      const host = topLayerHost();
      if (cursor.parentElement !== host) host.appendChild(cursor);
      if (typeof cursor.showPopover !== 'function') return;
      cursor.setAttribute('popover', 'manual');
      try {
        if (cursor.matches(':popover-open')) cursor.hidePopover();
        cursor.showPopover();
      } catch {
        if (cursor.parentElement !== host) host.appendChild(cursor);
      }
    }

    function promoteCursor() {
      if (promoteFrame) return;
      promoteFrame = requestAnimationFrame(() => {
        promoteFrame = 0;
        restackCursor();
      });
    }

    restackCursor();
    addEventListener('pointermove', (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
      cursor.style.transform = 'translate(-50%, -50%)';
      cursor.classList.add('is-visible');
      const action = event.target instanceof Element && event.target.closest(actionSelector);
      cursor.classList.toggle('is-action', Boolean(action));
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => cursor.classList.remove('is-visible'));
    addEventListener('blur', () => cursor.classList.remove('is-visible'));
    document.addEventListener('toggle', (event) => {
      if (event.target !== cursor) promoteCursor();
    }, true);
    document.addEventListener('close', (event) => {
      if (event.target instanceof HTMLDialogElement) promoteCursor();
    }, true);
    new MutationObserver(promoteCursor).observe(document.documentElement, {
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
  }
  let menu = document.querySelector('#siteMenu');
  const openButton = document.querySelector('[data-open-menu], #openMenu');
  if (!openButton) {
    initLittleMen();
    return;
  }
  if (!menu || !menu.querySelector('.site-menu__nav')) {
    menu?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <aside class="site-menu" id="siteMenu" role="dialog" aria-modal="true" aria-label="Menu principale" aria-hidden="true">
        <a class="site-menu__brand" href="${url('homepage-tpr/')}" aria-label="The People's Room, ricarica la home"><img src="${url('assets/tpr-logo-menu.svg')}" alt=""></a>
        <button class="site-menu__close" data-close-menu type="button" aria-label="Chiudi il menu"></button>
        <nav class="site-menu__nav" aria-label="Navigazione principale">
          <a class="site-menu__primary" href="${url('about/')}">About</a>
          <div class="site-menu__group">
            <h2 class="site-menu__heading"><a href="${url('homepage-tpr/#rooms')}">TPR Rooms</a></h2>
            <div class="site-menu__rooms" aria-label="Le stanze">
              ${[['coworking','Coworking'],['bar','Bar'],['media','Media'],['reformer','Reformer'],['wellness','Wellness']].map(([key, label]) => `<a class="site-menu__room" href="${url(`homepage-tpr/#${key}`)}" data-room-link="${key}" aria-label="${label} Room"></a>`).join('')}
            </div>
          </div>
          <div class="site-menu__group">
            <h2 class="site-menu__heading"><a href="${url('homepage-tpr/#membership')}">Membership</a></h2>
            <div class="site-menu__sub"><a href="${url('membership/aziende-startup/')}">Aziende &amp; Startup</a><a href="${url('membership/privati-freelancer/')}">Privati &amp; Freelancer</a></div>
          </div>
          <div class="site-menu__group">
            <h2 class="site-menu__heading"><a href="${url('homepage-tpr/#world')}">TPR World</a></h2>
            <div class="site-menu__sub"><a href="${url('eventi/')}">Eventi</a><a href="${url('gallery/')}">Gallery</a><a href="${url('app/')}">App</a><a href="${url('contatti/')}">Contatti</a></div>
          </div>
        </nav>
      </aside>`);
    menu = document.querySelector('#siteMenu');
  }
  const closeButton = menu.querySelector('[data-close-menu], #closeMenu');
  if (!closeButton || menu.dataset.menuReady) {
    initLittleMen();
    return;
  }
  menu.dataset.menuReady = 'true';
  const background = [...document.body.children].filter((node) => node !== menu && node !== cursor && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE');
  let opener = openButton;

  function focusable() {
    return [...menu.querySelectorAll('a[href], button:not([disabled])')].filter((node) => node.offsetParent !== null);
  }

  function setMenu(open, restore = true) {
    if (open) {
      rememberScrollbarGap();
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : openButton;
    }
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    openButton.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    background.forEach((node) => { if ('inert' in node) node.inert = open; });
    if (open) {
      requestAnimationFrame(() => closeButton.focus({ preventScroll: true }));
      bumpLittleMenIdle();
    } else if (restore) opener?.focus({ preventScroll: true });
  }

  openButton.addEventListener('pointerdown', () => { menu.dataset.focusOrigin = 'pointer'; });
  openButton.addEventListener('keydown', () => { menu.dataset.focusOrigin = 'keyboard'; });
  openButton.addEventListener('click', (event) => {
    if (!menu.dataset.focusOrigin) menu.dataset.focusOrigin = event.detail ? 'pointer' : 'keyboard';
    setMenu(true);
  });
  closeButton.addEventListener('click', () => setMenu(false));
  menu.querySelectorAll('a[href]').forEach((link) => link.addEventListener('click', () => setMenu(false, false)));
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); setMenu(false); return; }
    if (event.key !== 'Tab') return;
    const items = focusable();
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  initLittleMen();
})();
