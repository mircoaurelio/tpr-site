/* Original PDF photographs inside fixed original alpha masks. The source
   composite remains the exact rest/reduced-motion/loading fallback. */
(() => {
  "use strict";
  if (!document.body.classList.contains("preview-page--home") || document.documentElement.classList.contains("has-updated-parallax")) return;
  document.documentElement.classList.add("has-updated-parallax");
  const base = new URL(".", document.currentScript.src);
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const specs = [
    {
      key: "hero", selector: ".preview-hero-composite",
      photo: "assets/figma-updated/photos/home-hero-room.jpeg",
      canvas: [1512, 952], crop: [-130.99993896484375, -208.0638427734375, 1644.9998779296875, 1096.3988037109375],
      // asset-files.json PDF xref130 transform; y omits the30px mock chrome.
    },
    {
      key: "events", selector: ".preview-event-composite",
      photo: "assets/figma-updated/photos/shamans-ritual.jpeg",
      canvas: [1512, 720], crop: [-335.4952697753906, -377.8125, 2050.5771484375, 1367.21826171875],
      // PDF xref112 supplies x/width/height. This crop-relative y is recovered
      // from3314 opaque source-composite samples, MAE1.77/channel. The PDF and
      // browser resamplers differ slightly, so offset0 keeps the original
      // composite pixel-identical rather than claiming a new raster equals it.
    },
  ];
  const entries = [];
  const started = new WeakSet();
  let frame = 0;
  let scrolled = false;
  let proximityObserver;

  function deactivate(entry) {
    entry.source.classList.remove("is-photo-parallax-active");
    entry.window.classList.remove("is-photo-parallax-active");
    entry.photo.style.translate = "0px 0px";
  }

  function fit(entry) {
    const style = getComputedStyle(entry.source);
    const width = parseFloat(style.width);
    const height = parseFloat(style.height);
    if (!(width > 0 && height > 0)) return;
    const mode = style.objectFit === "contain" ? "contain" : style.objectFit === "fill" ? "fill" : "cover";
    const ratio = mode === "contain" ? Math.min(width / entry.spec.canvas[0], height / entry.spec.canvas[1]) : Math.max(width / entry.spec.canvas[0], height / entry.spec.canvas[1]);
    const sx = mode === "fill" ? width / entry.spec.canvas[0] : ratio;
    const sy = mode === "fill" ? height / entry.spec.canvas[1] : ratio;
    const [x, y, photoWidth, photoHeight] = entry.spec.crop;
    const originX = (width - entry.spec.canvas[0] * sx) / 2;
    const originY = (height - entry.spec.canvas[1] * sy) / 2;
    Object.assign(entry.window.style, {
      left: style.left === "auto" ? `${entry.source.offsetLeft}px` : style.left,
      top: style.top === "auto" ? `${entry.source.offsetTop}px` : style.top,
      width: `${width}px`, height: `${height}px`,
      maskSize: mode === "fill" ? "100% 100%" : mode,
    });
    Object.assign(entry.photo.style, {
      left: `${originX + x * sx}px`, top: `${originY + y * sy}px`,
      width: `${photoWidth * sx}px`, height: `${photoHeight * sy}px`,
    });
    // Both proven photographs extend past their alpha bounds by more than
    // 24 source pixels vertically. No additional zoom changes the source crop.
    entry.travel = 24 * sy;
  }

  function update() {
    frame = 0;
    for (const entry of entries) {
      const rect = entry.window.getBoundingClientRect();
      if (reducedMotion.matches || rect.bottom <= 0 || rect.top >= innerHeight) {
        entry.anchor = null;
        deactivate(entry);
        continue;
      }
      if (entry.anchor === null || !scrolled) entry.anchor = scrollY;
      const offset = scrolled ? Math.max(-entry.travel, Math.min(entry.travel, (scrollY - entry.anchor) * .06)) : 0;
      if (Math.abs(offset) < .001) {
        deactivate(entry);
      } else {
        entry.photo.style.translate = `0px ${offset.toFixed(3)}px`;
        entry.window.classList.add("is-photo-parallax-active");
        entry.source.classList.add("is-photo-parallax-active");
      }
    }
  }

  function requestUpdate() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  async function prepare(spec) {
    const source = document.querySelector(spec.selector);
    if (!source || started.has(source)) return;
    started.add(source);
    const photo = new Image();
    photo.className = "tpr-parallax-photo";
    photo.alt = "";
    photo.setAttribute("aria-hidden", "true");
    photo.src = new URL(spec.photo, base).href;
    const mask = new Image();
    mask.src = source.currentSrc || source.src;
    try {
      await Promise.all([source.decode(), photo.decode(), mask.decode()]);
    } catch {
      // An unavailable source ingredient never removes or changes the fallback.
      return;
    }
    const window = document.createElement("span");
    window.className = "tpr-photo-window";
    window.dataset.photoParallax = spec.key;
    window.setAttribute("aria-hidden", "true");
    window.style.maskImage = `url("${mask.src}")`;
    window.append(photo);
    source.after(window);
    source.classList.add("tpr-photo-source");
    const entry = { source, photo, window, spec, anchor: null, travel: 0 };
    entries.push(entry);
    fit(entry);
    deactivate(entry);
    requestUpdate();
  }

  function preparePhotos() {
    if (reducedMotion.matches) return;
    prepare(specs[0]);
    // The event source remains the exact loading/reduced-motion fallback.
    // Avoid eagerly decoding it and its raw photo while the hero is loading.
    const spec = specs[1], source = document.querySelector(spec.selector);
    if (!source || started.has(source)) return;
    if (!proximityObserver) proximityObserver = new IntersectionObserver(entries => {
      if (reducedMotion.matches || !entries.some(entry => entry.isIntersecting)) return;
      proximityObserver.disconnect();
      prepare(spec);
    }, { rootMargin: '250px 0px' });
    proximityObserver.observe(source);
  }
  addEventListener("scroll", () => {
    if (!reducedMotion.matches) scrolled = true;
    requestUpdate();
  }, { passive: true });
  addEventListener("resize", () => {
    scrolled = false;
    entries.forEach(entry => { entry.anchor = null; fit(entry); });
    requestUpdate();
  }, { passive: true });
  reducedMotion.addEventListener("change", () => {
    scrolled = false;
    entries.forEach(entry => { entry.anchor = null; deactivate(entry); });
    preparePhotos();
    requestUpdate();
  });
  preparePhotos();
})();
