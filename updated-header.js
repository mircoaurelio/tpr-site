/* Preserve the source header at the top; offer navigation on upward travel. */
(() => {
  const header = document.querySelector('.updated-preview .preview-header');
  if (!header || header.dataset.scrollHeaderReady) return;
  header.dataset.scrollHeaderReady = 'true';
  let lastY = Math.max(0, scrollY), direction = 0, travel = 0, frame = 0;
  const show = visible => header.toggleAttribute('data-header-hidden', !visible);
  function floatHeader() {
    if (header.hasAttribute('data-header-floating')) return;
    header.setAttribute('data-header-floating', '');
    show(false);
    // Commit the fixed, offscreen position before animating later scroll changes.
    header.getBoundingClientRect();
    header.setAttribute('data-header-animated', '');
  }
  function update() {
    frame = 0;
    const y = Math.max(0, Math.min(scrollY, Math.max(0, document.documentElement.scrollHeight - innerHeight)));
    const delta = y - lastY;
    lastY = y;
    if (y <= 2) {
      header.removeAttribute('data-header-animated');
      header.removeAttribute('data-header-floating');
      header.removeAttribute('data-header-hidden');
      direction = travel = 0;
      return;
    }
    if (!header.hasAttribute('data-header-floating')) {
      if (y <= header.offsetHeight + 24) return;
      floatHeader();
    }
    if (header.contains(document.activeElement) || document.body.classList.contains('is-menu-open')) {
      show(true);
      return;
    }
    if (!delta) return;
    const nextDirection = Math.sign(delta);
    if (nextDirection !== direction) { direction = nextDirection; travel = 0; }
    travel += Math.abs(delta);
    if (travel >= 8) show(direction < 0);
  }
  const queue = () => { if (!frame) frame = requestAnimationFrame(update); };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue, { passive: true });
  addEventListener('pageshow', queue);
  header.addEventListener('focusin', () => {
    if (scrollY <= 2) return;
    floatHeader();
    show(true);
  });
  queue();
})();
