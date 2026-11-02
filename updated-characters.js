/* Hydrate the supplied, separated Figma character paths on updated routes. */
(() => {
  if (!document.body.classList.contains('updated-preview')) return;
  const base = new URL('.', document.currentScript.src);
  const keys = ['coworking', 'bar', 'media', 'reformer', 'wellness', 'generic'];
  const labels = { coworking: 'TPR Coworking', bar: 'TPR Fuel', media: 'TPR Media', reformer: 'TPR Move', wellness: 'TPR Recharge' };
  const previous = window.tprLittleMen;
  const markup = new Map();
  const svg = key => markup.get(key) || previous?.svg?.(key) || '';
  const ready = Promise.allSettled(keys.map(async key => {
    const response = await fetch(new URL(`assets/figma-updated/characters/${key}.svg`, base), { credentials: 'omit' });
    if (response.ok) markup.set(key, await response.text());
  }));
  window.tprLittleMen = { svg, ready };

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const states = new Map();
  const hostSelector = '.people-figure, .preview-menu-room, .preview-room-character, .tpr-elevator__character';
  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = states.get(entry.target);
      if (!state) continue;
      state.visible = entry.isIntersecting && entry.intersectionRatio >= .15;
      entry.target.classList.toggle('is-character-visible', state.visible);
      syncMotion(state);
    }
  }, { threshold: [0, .15] });

  function eligible(state, allowLift = false) {
    if (reduced.matches || document.hidden || !state.visible || !state.rig.isConnected || state.host.closest('[inert]')) return false;
    if (state.host.classList.contains('tpr-elevator__character--incoming')) return false;
    const room = state.host.closest('#rooms');
    if (room?.classList.contains('is-explore-exit') || (!allowLift && room?.classList.contains('is-lifting'))) return false;
    for (let node = state.host; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    }
    return true;
  }

  function stopGesture(state) {
    state.generation++;
    for (const animation of state.animations) animation.cancel();
    state.animations = [];
    state.parts.forEach(part => part.style.removeProperty('will-change'));
    state.rig.classList.remove('is-character-playing');
  }

  function startGesture(state) {
    if (state.animations.length || !eligible(state)) return;
    const token = ++state.generation;
    // A finite, original-pose-to-original-pose gesture. All transforms act on
    // the original separated groups and retain their source joint pivots.
    const transforms = part => part.classList.contains('tpr-character__body')
      ? ['translateY(0px) rotate(0deg)', 'translateY(-2px) rotate(-1.8deg)', 'translateY(-.5px) rotate(1.1deg)', 'translateY(0px) rotate(0deg)']
      : part.classList.contains('tpr-character__upper')
        ? ['rotate(0deg)', 'rotate(-8deg)', 'rotate(5.5deg)', 'rotate(0deg)']
        : part.classList.contains('tpr-character__emblem')
          ? ['translateY(0px) rotate(0deg)', 'translateY(-3px) rotate(4deg)', 'translateY(-1px) rotate(-3deg)', 'translateY(0px) rotate(0deg)']
          : ['translateY(0px) rotate(0deg)', 'translateY(-7px) rotate(-3deg)', 'translateY(-2px) rotate(2deg)', 'translateY(0px) rotate(0deg)'];
    state.rig.classList.add('is-character-playing');
    state.animations = state.parts.map((part, index) => {
      part.style.willChange = 'transform';
      return part.animate(transforms(part).map((transform, i) => ({ transform, offset: [0, .32, .67, 1][i], easing: 'cubic-bezier(.45,0,.3,1)' })), {
        duration: 1740, delay: Math.min(index * 35, 175), iterations: 1, fill: 'none',
      });
    });
    Promise.all(state.animations.map(animation => animation.finished)).then(() => {
      if (state.generation !== token) return;
      stopGesture(state);
      if ((state.hovered || state.focused) && eligible(state)) startGesture(state);
    }).catch(() => {}); // Removing/offscreen rigs deliberately cancels their work.
  }

  function syncMotion(state) {
    const active = eligible(state);
    if (!active) {
      state.active = false;
      if (state.host.classList.contains('tpr-elevator__character--current') && state.host.closest('#rooms')?.classList.contains('is-lifting') && eligible(state, true)) {
        // The native lift fades this still-visible actor. Hold its current
        // articulation until disposal instead of snapping to rest at opacity 1.
        state.animations.forEach(animation => animation.pause());
        return;
      }
      if (state.animations.length) stopGesture(state);
      return;
    }
    const entering = !state.active;
    state.active = true;
    if (entering || state.hovered || state.focused) startGesture(state);
  }

  function observeCharacter(node) {
    if (states.has(node)) return;
    const host = node.closest(hostSelector) || node;
    const state = { rig: node, host, parts: [...node.querySelectorAll('.tpr-character__body, .tpr-character__upper, .tpr-character__emblem, .tpr-character__detail')], visible: false, active: false, hovered: finePointer.matches && host.matches(':hover'), focused: host.matches('a, button') && host.contains(document.activeElement), generation: 0, animations: [] };
    const enter = event => { if (!finePointer.matches || event.pointerType === 'touch') return; state.hovered = true; syncMotion(state); };
    const leave = () => { state.hovered = false; };
    const focus = () => { state.focused = host.matches('a, button'); syncMotion(state); };
    const blur = event => { if (!host.contains(event.relatedTarget)) state.focused = false; };
    host.addEventListener('pointerenter', enter);
    host.addEventListener('pointerleave', leave);
    host.addEventListener('focusin', focus);
    host.addEventListener('focusout', blur);
    state.dispose = () => {
      stopGesture(state); visibility.unobserve(node);
      host.removeEventListener('pointerenter', enter); host.removeEventListener('pointerleave', leave);
      host.removeEventListener('focusin', focus); host.removeEventListener('focusout', blur);
      states.delete(node);
    };
    states.set(node, state);
    visibility.observe(node);
  }
  function mountCharacters() {
    for (const state of states.values()) if (!state.rig.isConnected) state.dispose();
    document.querySelectorAll('.people-figure, .preview-menu-room:not([data-menu-icon]), .preview-room-character, .tpr-elevator__character').forEach(host => {
      const existing = host.querySelector('svg, img');
      const key = host.dataset.roomLink || host.dataset.room
        || host.getAttribute('href')?.match(/rooms\/(coworking|bar|media|reformer|wellness)\//)?.[1]
        || existing?.getAttribute('src')?.match(/little-man\/(coworking|bar|media|reformer|wellness)\.svg/)?.[1];
      if (!key || !markup.has(key)) return;
      if (existing?.classList.contains('tpr-character') && existing.dataset.character === key) {
        observeCharacter(existing); return;
      }
      const template = document.createElement('template');
      template.innerHTML = svg(key);
      const character = template.content.firstElementChild;
      if (!character) return;
      if (host.matches('a') && !host.hasAttribute('aria-label')) host.setAttribute('aria-label', existing?.getAttribute('alt') || labels[key]);
      if (existing) existing.replaceWith(character);
      else host.replaceChildren(character);
      if (host.classList.contains('preview-room-character')) host.classList.add('has-separated-character');
      observeCharacter(character);
    });
    document.querySelectorAll('.tpr-character').forEach(observeCharacter);
    states.forEach(syncMotion);
  }
  const stopHidden = () => states.forEach(syncMotion);
  document.addEventListener('visibilitychange', stopHidden);
  reduced.addEventListener('change', stopHidden);
  finePointer.addEventListener('change', () => { states.forEach(state => { state.hovered = false; }); stopHidden(); });
  document.documentElement.addEventListener('pointerleave', () => states.forEach(state => { state.hovered = false; }));
  ready.then(() => {
    let frame = 0;
    new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; mountCharacters(); });
    }).observe(document.body, { childList: true, subtree: true });
    const roomHost = document.querySelector('#rooms');
    if (roomHost) new MutationObserver(stopHidden).observe(roomHost, { attributes: true, attributeFilter: ['class', 'data-active-room'] });
    mountCharacters();
    document.dispatchEvent(new Event('tpr-little-men-ready'));
  });
})();
