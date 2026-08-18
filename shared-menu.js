(() => {
  const siteRoot = new URL('.', document.currentScript.src);
  const url = (path) => new URL(path, siteRoot).href;
  let menu = document.querySelector('#siteMenu');
  const openButton = document.querySelector('[data-open-menu], #openMenu');
  if (!openButton) return;
  if (!menu || !menu.querySelector('.site-menu__nav')) {
    menu?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <aside class="site-menu" id="siteMenu" role="dialog" aria-modal="true" aria-label="Menu principale" aria-hidden="true">
        <a class="site-menu__brand" href="${url('homepage-tpr/')}" aria-label="The People's Room, ricarica la home"><img src="${url('assets/tpr-logo-menu.svg')}" alt=""></a>
        <button class="site-menu__close" data-close-menu type="button" aria-label="Chiudi il menu">×</button>
        <nav class="site-menu__nav" aria-label="Navigazione principale">
          <a class="site-menu__primary" href="${url('about/')}">About</a>
          <h2 class="site-menu__heading"><a href="${url('homepage-tpr/#rooms')}">TPR Rooms</a></h2>
          <div class="site-menu__rooms" aria-label="Le stanze">
            ${[['coworking','Coworking'],['bar','Bar'],['media','Media'],['reformer','Reformer'],['wellness','Wellness']].map(([key, label]) => `<a class="site-menu__room" href="${url(`homepage-tpr/#${key}`)}" aria-label="${label} Room"><img src="${url(`assets/elevator-icon-${key}-off.svg`)}" alt=""></a>`).join('')}
          </div>
          <h2 class="site-menu__heading"><a href="${url('homepage-tpr/#membership')}">Membership</a></h2>
          <div class="site-menu__sub"><a href="${url('membership/aziende-startup/')}">Aziende &amp; Startup</a><a href="${url('membership/privati-freelancer/')}">Privati &amp; Freelancer</a></div>
          <h2 class="site-menu__heading"><a href="${url('homepage-tpr/#world')}">TPR World</a></h2>
          <div class="site-menu__sub"><a href="${url('eventi/')}">Eventi</a><a href="${url('gallery/')}">Gallery</a><a href="${url('app/')}">App</a><a href="${url('contatti/')}">Contatti</a></div>
        </nav>
      </aside>`);
    menu = document.querySelector('#siteMenu');
  }
  const closeButton = menu.querySelector('[data-close-menu], #closeMenu');
  if (!closeButton || menu.dataset.menuReady) return;
  menu.dataset.menuReady = 'true';
  const background = [...document.body.children].filter((node) => node !== menu && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE');
  let opener = openButton;

  function focusable() {
    return [...menu.querySelectorAll('a[href], button:not([disabled])')].filter((node) => node.offsetParent !== null);
  }

  function setMenu(open, restore = true) {
    if (open) opener = document.activeElement instanceof HTMLElement ? document.activeElement : openButton;
    menu.classList.toggle('is-open', open);
    menu.setAttribute('aria-hidden', String(!open));
    openButton.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('menu-open', open);
    background.forEach((node) => { if ('inert' in node) node.inert = open; });
    if (open) requestAnimationFrame(() => closeButton.focus({ preventScroll: true }));
    else if (restore) opener?.focus({ preventScroll: true });
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
})();
