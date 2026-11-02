/* Full two-face motion, leaving native card state/focus/navigation with the
   existing controllers. This physical turn is an implementation choice; no
   unavailable prototype video is claimed as an animation reference. */
(() => {
  "use strict";
  if (!document.body.classList.contains("updated-preview") || document.documentElement.classList.contains("has-updated-card-motion")) return;
  document.documentElement.classList.add("has-updated-card-motion");
  const base = new URL(".", document.currentScript.src);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const states = new WeakMap();
  const scenes = new Set();
  const nativeBacks = new Set();
  const heldPointers = new Map();
  // The shared controller consumes its JSON marker before rebuilding the host.
  // Its initialized public marker remains available to integration modules.
  const host = document.querySelector("#rooms.tpr-elevator[data-elevator-ready]");
  const track = host?.querySelector(".tpr-elevator__explore-track");
  const panorama = track?.querySelector(":scope > img");
  const manifest = host ? fetch(new URL("design/room-card-faces.json", base))
    .then(response => response.ok ? response.json() : null).catch(() => null) : Promise.resolve(null);
  let prepareFrame = 0;
  let desktopVersion = 0;
  let paintFrame = 0;

  function syncPaint(state) {
    // Some WebKit renderers paint a reversed face despite backface-visibility.
    // Gate actual paint at the rotor's real angle, never at the requested state:
    // that state changes before the physical front has finished its first half.
    const matrix = new DOMMatrixReadOnly(getComputedStyle(state.rotor).transform);
    const face = matrix.m11 >= 0 ? "front" : "back";
    if (state.card.dataset.paintedFace !== face) state.card.dataset.paintedFace = face;
  }

  function syncNativePaint(card) {
    const back = card.querySelector(".tpr-elevator__card-back");
    if (!back) return false;
    const matrix = new DOMMatrixReadOnly(getComputedStyle(back).transform);
    const paint = matrix.m11 >= 0 ? "visible" : "hidden";
    if (card.dataset.nativeBackPaint !== paint) card.dataset.nativeBackPaint = paint;
    return back.getAnimations().some(animation => {
      const time = Number(animation.currentTime);
      const end = Number(animation.effect?.getComputedTiming().endTime);
      return animation.playState === "running" || animation.pending || (time > 0 && time < end);
    });
  }

  function paintTurns() {
    paintFrame = 0;
    let turning = false;
    for (const state of scenes) {
      if (!state.card.isConnected) continue;
      syncPaint(state);
      const animation = state.animation;
      const time = Number(animation?.currentTime);
      if (animation && (animation.playState === "running" || animation.pending || (time > 0 && time < 680))) turning = true;
    }
    for (const card of nativeBacks) {
      if (!card.isConnected || states.has(card)) { nativeBacks.delete(card); continue; }
      if (syncNativePaint(card)) turning = true;
    }
    if (turning) paintFrame = requestAnimationFrame(paintTurns);
  }

  function queuePaint() {
    if (!paintFrame) paintFrame = requestAnimationFrame(paintTurns);
  }

  function setAnimation(state) {
    state.animation?.cancel();
    state.animation = null;
    if (reducedMotion.matches) { syncPaint(state); return; }
    const width = parseFloat(getComputedStyle(state.card).width);
    // A shallow retreat keeps the complete surface inside the existing scroll
    // window, instead of clipping perspective-expanded corners or changing
    // mobile/card/carousel dimensions. Both faces follow exactly the same arc.
    const keyframes = [
      { transform: "translateZ(0px) rotateY(0deg)", offset: 0 },
      { transform: `translateZ(${-width * .4}px) rotateY(45deg)`, offset: .25 },
      { transform: `translateZ(${-width * .51}px) rotateY(90deg)`, offset: .5 },
      { transform: `translateZ(${-width * .4}px) rotateY(135deg)`, offset: .75 },
      { transform: "translateZ(0px) rotateY(180deg)", offset: 1 },
    ];
    const animation = state.rotor.animate(keyframes, { duration: 680, easing: "cubic-bezier(.4,0,.2,1)", fill: "both" });
    animation.pause();
    animation.currentTime = state.flipped ? 680 : 0;
    state.animation = animation;
    syncPaint(state);
  }

  function syncState(card) {
    const state = states.get(card);
    if (!state) {
      if (card.matches(".tpr-elevator__explore-card")) { nativeBacks.add(card); syncNativePaint(card); queuePaint(); }
      return;
    }
    const flipped = card.classList.contains("is-flipped");
    if (flipped === state.flipped) return;
    state.flipped = flipped;
    if (!reducedMotion.matches) {
      if (!state.animation) setAnimation(state);
      state.animation.playbackRate = flipped ? 1 : -1;
      state.animation.play();
    }
    syncPaint(state);
    queuePaint();
  }

  function makeScene(card, front, back) {
    if (states.has(card) || !front || !back) return;
    const focused = document.activeElement;
    const restoreFocus = focused instanceof HTMLElement && (front.contains(focused) || back.contains(focused));
    const rotor = document.createElement("div");
    rotor.className = "tpr-card-rotor";
    front.classList.add("tpr-card-face", "tpr-card-front-face");
    back.classList.add("tpr-card-face", "tpr-card-back-face");
    rotor.append(front, back);
    card.append(rotor);
    card.classList.add("tpr-card-scene");
    nativeBacks.delete(card);
    card.removeAttribute("data-native-back-paint");
    const state = { card, rotor, flipped: card.classList.contains("is-flipped"), animation: null };
    states.set(card, state);
    scenes.add(state);
    setAnimation(state);
    // Asset decoding may finish after a visitor has already focused/opened
    // this native card. Reparenting the same nodes blurs them in browsers;
    // restore that exact control synchronously without moving page scroll.
    if (restoreFocus && focused.isConnected && !focused.closest("[inert]")) focused.focus({ preventScroll: true });
  }

  function fitSourceFront(card, entry, canvas) {
    const style = getComputedStyle(card);
    const sx = parseFloat(getComputedStyle(track).width) / canvas[0];
    const sy = parseFloat(getComputedStyle(track).height) / canvas[1];
    const [x, y, width, height] = entry.crop;
    card.style.setProperty("--source-front-x", `${x * sx - parseFloat(style.left)}px`);
    card.style.setProperty("--source-front-y", `${y * sy - parseFloat(style.top)}px`);
    card.style.setProperty("--source-front-width", `${width * sx}px`);
    card.style.setProperty("--source-front-height", `${height * sy}px`);
    card.style.setProperty("--source-front-image", `url("${new URL(entry.front, base).href}")`);
  }

  async function decoded(path) {
    const image = new Image();
    image.decoding = "async";
    image.src = new URL(path, base).href;
    await image.decode();
    return image;
  }

  async function prepareDesktop() {
    if (!host || !panorama) return;
    const data = await manifest;
    const key = host.dataset.activeRoom;
    const room = data?.rooms?.[key];
    const cards = [...track.querySelectorAll(".tpr-elevator__explore-card")];
    if (!room || room.cards.length !== cards.length || !cards.length) return;
    const background = new URL(room.background, base).href;
    if (panorama.src === background && cards.every(card => states.has(card))) return;
    const version = ++desktopVersion;
    let fronts;
    try { [, ...fronts] = await Promise.all([decoded(room.background), ...room.cards.map(entry => decoded(entry.front))]); }
    catch { return; }
    if (version !== desktopVersion || host.dataset.activeRoom !== key || cards.some(card => !card.isConnected)) return;
    // Reparenting a pressed button also cancels its UA click. Keep the full
    // native fallback through pointerup/click, then retry in the next frame.
    if (cards.some(card => [...heldPointers.values()].includes(card))) return;
    cards.forEach((card, index) => {
      const front = card.querySelector("[data-elevator-card-open]");
      const back = card.querySelector(".tpr-elevator__card-back");
      if (!front || !back) return;
      const image = fronts[index];
      image.className = "tpr-card-source-front";
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      front.append(image);
      fitSourceFront(card, room.cards[index], data.sourceCanvas);
      card._sourceFront = { entry: room.cards[index], canvas: data.sourceCanvas };
      makeScene(card, front, back);
    });
    // All three original alpha fronts and the original cardless backdrop have
    // decoded before this atomic switch. An unavailable asset keeps the prior
    // complete panorama and native behavior, never a blank card-shaped hole.
    panorama.src = background;
  }

  async function hydrateMobile(card) {
    const photo = card.querySelector(".tpr-elevator__mobile-card-photo-window img");
    const key = card.closest("[data-room]")?.dataset.room;
    const data = await manifest;
    const source = data?.rooms?.[key]?.cards?.[Number(card.dataset.cardIndex)]?.photo;
    if (!photo || !source || photo.src === new URL(source, base).href) return;
    try {
      const image = await decoded(source);
      if (card.isConnected && card.closest("[data-room]")?.dataset.room === key) photo.src = image.src;
    } catch { /* Keep the established native photo fallback. */ }
  }

  function scan(scope) {
    const nativeCards = [];
    if (scope.nodeType === Node.ELEMENT_NODE && scope.matches(".tpr-elevator__explore-card")) nativeCards.push(scope);
    nativeCards.push(...(scope.querySelectorAll?.(".tpr-elevator__explore-card") || []));
    nativeCards.forEach(card => {
      if (!states.has(card)) { nativeBacks.add(card); syncNativePaint(card); queuePaint(); }
    });
    const cards = [];
    if (scope.nodeType === Node.ELEMENT_NODE && scope.matches(".preview-room-card,.tpr-elevator__mobile-card")) cards.push(scope);
    cards.push(...(scope.querySelectorAll?.(".preview-room-card,.tpr-elevator__mobile-card") || []));
    cards.forEach(card => {
      const standalone = card.classList.contains("preview-room-card");
      const front = card.querySelector(standalone ? ".preview-room-card-front" : "[data-elevator-card-open]");
      const back = card.querySelector(standalone ? ".preview-room-card-back" : ".tpr-elevator__mobile-card-back");
      makeScene(card, front, back);
      if (!standalone) hydrateMobile(card);
    });
  }

  function queueDesktop() {
    if (!prepareFrame) prepareFrame = requestAnimationFrame(() => { prepareFrame = 0; prepareDesktop(); });
  }
  document.addEventListener("pointerdown", event => {
    const card = event.target.closest?.(".tpr-elevator__explore-card");
    if (card && !states.has(card)) heldPointers.set(event.pointerId, card);
  }, { capture: true, passive: true });
  const releasePointer = event => {
    if (heldPointers.delete(event.pointerId)) queueDesktop();
  };
  addEventListener("pointerup", releasePointer, { capture: true, passive: true });
  addEventListener("pointercancel", releasePointer, { capture: true, passive: true });
  addEventListener("blur", () => {
    if (heldPointers.size) { heldPointers.clear(); queueDesktop(); }
  });
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === "attributes") {
        if (record.attributeName === "class") syncState(record.target);
        else if (record.target === panorama || record.target === host) queueDesktop();
      } else {
        record.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          scan(node);
          if (node.matches(".tpr-elevator__explore-card") || node.querySelector(".tpr-elevator__explore-card")) queueDesktop();
        });
      }
    }
    for (const state of scenes) if (!state.card.isConnected) { state.animation?.cancel(); scenes.delete(state); }
    for (const card of nativeBacks) if (!card.isConnected || states.has(card)) nativeBacks.delete(card);
  });
  scan(document);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "src", "data-active-room"] });
  queueDesktop();
  addEventListener("resize", () => {
    for (const state of scenes) {
      if (state.card._sourceFront) fitSourceFront(state.card, state.card._sourceFront.entry, state.card._sourceFront.canvas);
      setAnimation(state);
    }
  }, { passive: true });
  reducedMotion.addEventListener("change", () => scenes.forEach(setAnimation));
})();
