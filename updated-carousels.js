/* Desktop controls for offers and events; touch and keyboard stay native. */
(() => {
  'use strict';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  document.querySelectorAll('[data-accessible-carousel]').forEach(wrapper => {
    if (wrapper.dataset.carouselEnhanced) return;
    const track = wrapper.querySelector('[data-carousel]');
    const controls = wrapper.querySelector('.preview-carousel__controls');
    const previous = wrapper.querySelector('[data-carousel-prev]');
    const next = wrapper.querySelector('[data-carousel-next]');
    if (!track || !controls || !previous || !next) return;
    wrapper.dataset.carouselEnhanced = 'true';

    const maximum = () => Math.max(0, track.scrollWidth - track.clientWidth);
    const update = () => {
      const end = maximum();
      controls.hidden = end < 2;
      previous.disabled = track.scrollLeft <= 1;
      next.disabled = track.scrollLeft >= end - 1;
    };
    const move = direction => {
      const distance = (track.firstElementChild?.getBoundingClientRect().width || 320) + (parseFloat(getComputedStyle(track).gap) || 0);
      track.scrollTo({ left: Math.max(0, Math.min(maximum(), track.scrollLeft + direction * distance)), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    };
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(track);
    update();

    let drag = null;
    let suppressClick = false;
    track.addEventListener('pointerdown', event => {
      if (event.pointerType !== 'mouse' || event.button !== 0 || !event.isPrimary || event.target.closest('input,select,textarea,button')) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, left: track.scrollLeft, active: false, snap: track.style.scrollSnapType };
    });
    track.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (!drag.active) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 7) return;
        if (Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
        drag.active = true;
        track.style.scrollSnapType = 'none';
        track.classList.add('is-carousel-dragging');
        track.setPointerCapture(event.pointerId);
      }
      event.preventDefault();
      track.scrollLeft = drag.left - dx;
    });
    const finish = event => {
      if (!drag || event.pointerId !== drag.id) return;
      const ended = drag;
      drag = null;
      track.classList.remove('is-carousel-dragging');
      track.style.scrollSnapType = ended.snap;
      if (ended.active) {
        suppressClick = event.type === 'pointerup';
        setTimeout(() => { suppressClick = false; }, 0);
        if (track.hasPointerCapture(ended.id)) track.releasePointerCapture(ended.id);
      }
      update();
    };
    // A press may leave the track before it crosses the drag threshold and
    // captures the pointer. Always clear it when released outside as well.
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
    track.addEventListener('lostpointercapture', finish);
    track.addEventListener('click', event => {
      if (!suppressClick) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      suppressClick = false;
    }, true);
    track.addEventListener('dragstart', event => event.preventDefault());

    // Only Shift explicitly converts a vertical mouse wheel into horizontal
    // travel. Ordinary vertical scrolling and trackpad gestures stay native.
    track.addEventListener('wheel', event => {
      if (!event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? track.clientWidth : 1;
      const left = Math.max(0, Math.min(maximum(), track.scrollLeft + event.deltaY * unit));
      if (Math.abs(left - track.scrollLeft) < 1) return;
      event.preventDefault();
      track.scrollLeft = left;
    }, { passive: false });
  });
})();
