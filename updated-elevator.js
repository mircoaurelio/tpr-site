/* Home-only integration for the unchanged shared elevator controller. */
(() => {
  const host = document.querySelector('.updated-preview #rooms.tpr-elevator[data-elevator-ready]');
  if (!host || host.dataset.updatedElevatorReady) return;
  host.dataset.updatedElevatorReady = 'true';
  const base = new URL('.', document.currentScript.src);
  const keys = ['coworking', 'bar', 'media', 'reformer', 'wellness'];

  // Same normalization and public hydration contract as shared-menu.js, without
  // starting the original menu, cursor, global input listeners or scroll locks.
  const normalizeSvg = (svg, key) => {
    svg = svg.replace(/\srole="img"\saria-label="[^"]+"/, ' aria-hidden="true"');
    if (!/class="[^"]*little-man/.test(svg))
      svg = svg.replace(/<svg\b/, `<svg class="little-man little-man--${key}"`);
    return svg;
  };
  if (!window.tprLittleMen) {
    const markup = new Map();
    const ready = Promise.allSettled(keys.map(async key => {
      const response = await fetch(new URL(`assets/little-man/${key}.svg?v=20260820-little-men-2`, base), { credentials: 'omit' });
      if (response.ok) markup.set(key, normalizeSvg(await response.text(), key));
    }));
    window.tprLittleMen = { svg: key => markup.get(key) || '', ready };
  }
  Promise.resolve(window.tprLittleMen.ready).then(() => {
    document.dispatchEvent(new Event('tpr-little-men-ready'));
  });

  // The live controller always paints settled content into the current car.
  // Its incoming car is a visual preview, including while it becomes visible.
  host.querySelectorAll('.tpr-elevator__car--incoming').forEach(car => { car.inert = true; });
  const exploration = host.querySelector('.tpr-elevator__explore');
  const track = host.querySelector('.tpr-elevator__explore-track');
  if (exploration && track) {
    // The outer layer already carries the correct open/closed aria-hidden state;
    // hiding the inner track would also hide the real panorama card controls.
    track.removeAttribute('aria-hidden');
    const syncExploration = () => { exploration.inert = exploration.getAttribute('aria-hidden') !== 'false'; };
    syncExploration();
    new MutationObserver(syncExploration).observe(exploration, { attributes: true, attributeFilter: ['aria-hidden'] });
  }

  const mobile = matchMedia('(max-width: 720px)');
  const textSlots = [...host.querySelectorAll('.tpr-elevator__mobile-copy-text-inner')];
  let textFrame = 0;
  const syncMobileText = () => {
    textFrame = 0;
    for (const text of textSlots) {
      const overview = mobile.matches && !host.classList.contains('is-mobile-expanded') && !text.closest('.tpr-elevator__car--incoming');
      text.inert = !overview;
      const scrollable = overview && text.scrollHeight > text.clientHeight + 1;
      if (scrollable) {
        text.tabIndex = 0;
        text.setAttribute('role', 'region');
        text.setAttribute('aria-label', 'Descrizione della stanza');
      } else {
        text.removeAttribute('tabindex');
        text.removeAttribute('role');
        text.removeAttribute('aria-label');
      }
    }
  };
  const queueMobileText = () => {
    if (!textFrame) textFrame = requestAnimationFrame(syncMobileText);
  };
  new MutationObserver(queueMobileText).observe(host, { attributes: true, attributeFilter: ['class', 'data-active-room'] });
  const textObserver = new MutationObserver(queueMobileText);
  const textResize = new ResizeObserver(queueMobileText);
  for (const text of textSlots) {
    textObserver.observe(text, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    textResize.observe(text);
  }
  mobile.addEventListener('change', queueMobileText);
  document.fonts.ready.then(queueMobileText);
  queueMobileText();

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) host.classList.toggle('is-inview', entry.isIntersecting);
  }, { threshold: 0 });
  observer.observe(host);
})();
