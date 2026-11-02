/* Source carousel positioning and mouse drag; touch and keyboard stay native. */
(() => {
  'use strict';
  document.querySelectorAll('[data-accessible-carousel]').forEach(wrapper => {
    if (wrapper.dataset.carouselEnhanced) return;
    const track = wrapper.querySelector('[data-carousel]');
    if (!track) return;
    wrapper.dataset.carouselEnhanced = 'true';

    const maximum = () => Math.max(0, track.scrollWidth - track.clientWidth);
    let used = false, placementFrame = 0;
    const placeInitially = () => {
      placementFrame = 0;
      if (used) return;
      const source = matchMedia('(min-width: 901px)').matches ? track.dataset.initialScroll : 'start';
      const left = source === 'end' ? maximum() : source === 'center' ? maximum() / 2 : 0;
      track.scrollTo({ left, behavior: 'instant' });
    };
    const queuePlacement = () => {
      if (!used && !placementFrame) placementFrame = requestAnimationFrame(placeInitially);
    };
    for (const event of ['pointerdown', 'wheel', 'keydown']) track.addEventListener(event, () => { used = true; }, { once: true, passive: true });
    new ResizeObserver(queuePlacement).observe(track);
    document.fonts?.ready.then(queuePlacement);
    queuePlacement();

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
