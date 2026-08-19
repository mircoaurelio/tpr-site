(() => {
  const photoSelector = [
    '.hero-photo',
    '.events-visual > img:first-child',
    '.membership-card .torn-photo img',
    '.phone-mockup__screen',
    '.mobile-brand-membership__photo img',
    '.route-photo-card__photo-window > img',
    '.mobile-event-card__photo-window > img',
  ].join(', ');

  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const photos = [...document.querySelectorAll(photoSelector)];
  let frame = 0;

  if (!photos.length) return;

  const style = document.createElement('style');
  style.textContent = `
    .tpr-scroll-parallax {
      will-change: translate;
    }

    .tpr-scroll-parallax {
      scale: 1.14;
    }

    @media (prefers-reduced-motion: reduce) {
      .tpr-scroll-parallax {
        translate: none !important;
        scale: none !important;
      }
    }
  `;
  document.head.append(style);
  photos.forEach((photo) => photo.classList.add('tpr-scroll-parallax'));

  function updateParallax() {
    frame = 0;

    if (reducedMotion.matches) {
      photos.forEach((photo) => { photo.style.translate = ''; });
      return;
    }

    const viewportHeight = innerHeight;

    photos.forEach((photo) => {
      const rect = photo.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewportHeight) return;

      const travel = Number(photo.dataset.parallaxStrength || 12);
      const elementCenter = rect.top + (rect.height / 2);
      const progress = (elementCenter - (viewportHeight / 2)) / ((viewportHeight + rect.height) / 2);
      const offset = Math.max(-1, Math.min(1, progress)) * travel;
      photo.style.translate = `0 ${offset.toFixed(3)}%`;
    });
  }

  function requestUpdate() {
    if (frame) return;
    frame = requestAnimationFrame(updateParallax);
  }

  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', requestUpdate, { passive: true });
  reducedMotion.addEventListener('change', requestUpdate);
  requestUpdate();
})();
