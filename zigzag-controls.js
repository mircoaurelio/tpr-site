/* Reuses the approved coming-soon control outline. Draw in CSS pixels so
   resizing keeps the same fine irregular edge, with sharp text and focus rings. */
(() => {
  "use strict";
  const svgNamespace = "http://www.w3.org/2000/svg";
  const contours = new WeakMap();
  const paperElements = new Set();
  const paperSizes = [
    [".preview-offer-card", 480, 756],
    [".preview-company-card", 1352, 920],
    [".preview-feature-card,.preview-room-card", 560, 434],
    [".preview-event-card", 560, 440],
    [".preview-contact-card:not(.preview-contact-card--event)", 660, 568],
    [".preview-map-card", 612, 568],
    [".preview-contact-card--event", 1352, 496],
    [".preview-booking-panel", 1352, 568],
    [".preview-manifesto-card", 636, 624],
  ];
  const selector =
    ".preview-button, .preview-submit, .preview-discover-button, .preview-email-row, .preview-email-row button, .preview-pilates-banner > span, .preview-fields > label, .preview-manifesto-card";
  let nextSeed = 0;

  function outlinePath(width, height, radius, stroke, seed) {
    const amplitude = stroke ? (stroke > 2 ? 0.95 : 0.6) : 0.75;
    const inset = stroke / 2 + amplitude + 0.25;
    const right = width - inset;
    const bottom = height - inset;
    const r = Math.min(
      radius,
      (height - 2 * inset) / 2,
      (width - 2 * inset) / 2,
    );
    const horizontal = width - 2 * inset - 2 * r;
    const vertical = height - 2 * inset - 2 * r;
    const arc = (Math.PI * r) / 2;
    const perimeter = 2 * horizontal + 2 * vertical + 4 * arc;
    const waves = Math.round(perimeter / 7.3);
    const details = Math.round(perimeter / 4.1);
    const drift = Math.round(perimeter / 29);
    const points = [];
    let distance = 0;

    function segment(length, pointAt) {
      const steps = Math.max(2, Math.ceil(length / 1.6));
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const phase = ((distance + length * t) / perimeter) * Math.PI * 2;
        const offset =
          amplitude *
          (0.72 * Math.sin(phase * waves + seed) +
            0.2 * Math.sin(phase * details + seed * 1.7) +
            0.08 * Math.sin(phase * drift + seed * 0.6));
        const [x, y, nx, ny] = pointAt(t);
        points.push([x + nx * offset, y + ny * offset]);
      }
      distance += length;
    }
    function corner(cx, cy, start) {
      segment(arc, (t) => {
        const angle = start + (t * Math.PI) / 2;
        return [
          cx + r * Math.cos(angle),
          cy + r * Math.sin(angle),
          Math.cos(angle),
          Math.sin(angle),
        ];
      });
    }

    segment(horizontal, (t) => [inset + r + horizontal * t, inset, 0, -1]);
    corner(right - r, inset + r, -Math.PI / 2);
    segment(vertical, (t) => [right, inset + r + vertical * t, 1, 0]);
    corner(right - r, bottom - r, 0);
    segment(horizontal, (t) => [right - r - horizontal * t, bottom, 0, 1]);
    corner(inset + r, bottom - r, Math.PI / 2);
    segment(vertical, (t) => [inset, bottom - r - vertical * t, -1, 0]);
    corner(inset + r, inset + r, Math.PI);

    const coordinate = (point) =>
      point.map((value) => value.toFixed(2)).join(" ");
    let path = `M ${coordinate(points[0])}`;
    // Catmull–Rom interpolation keeps each wave smooth, including the corners.
    for (let i = 0; i < points.length; i++) {
      const previous = points[(i + points.length - 1) % points.length];
      const current = points[i];
      const next = points[(i + 1) % points.length];
      const after = points[(i + 2) % points.length];
      const first = current.map(
        (value, axis) => value + (next[axis] - previous[axis]) / 6,
      );
      const second = next.map(
        (value, axis) => value - (after[axis] - current[axis]) / 6,
      );
      path += ` C ${coordinate(first)} ${coordinate(second)} ${coordinate(next)}`;
    }
    return `${path} Z`;
  }

  function drawContour(element) {
    const contour = contours.get(element);
    if (!contour || !element.isConnected) return;
    const width = element.clientWidth;
    const height = element.clientHeight;
    if (width < 8 || height < 8) return;
    const style = getComputedStyle(element);
    const radius = Number(style.getPropertyValue("--paper-radius")) || 10;
    const stroke = Number(style.getPropertyValue("--paper-stroke")) || 0;
    contour.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    contour.svg.setAttribute("width", String(width));
    contour.svg.setAttribute("height", String(height));
    contour.path.setAttribute(
      "d",
      outlinePath(width, height, radius, stroke, contour.seed),
    );
    element.classList.add("has-zigzag");
  }

  function syncPaper(element) {
    const size = paperSizes.find(([selector]) => element.matches(selector));
    if (!size) return;
    element.classList.toggle(
      "has-source-paper",
      innerWidth >= 1201 &&
        Math.abs(element.clientWidth - size[1]) < 0.5 &&
        Math.abs(element.clientHeight - size[2]) < 0.5,
    );
  }
  const resizedElements = new Set();
  let resizeFrame = 0;
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) resizedElements.add(entry.target);
    if (resizeFrame) return;
    // Drawing can change control geometry. Run outside observer delivery so
    // WebKit can settle those dimensions without a ResizeObserver loop error.
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      const elements = [...resizedElements];
      resizedElements.clear();
      for (const element of elements) {
        if (!element.isConnected) continue;
        drawContour(element);
        syncPaper(element);
      }
    });
  });
  function attachPaper(element) {
    if (paperElements.has(element)) return;
    paperElements.add(element);
    syncPaper(element);
    observer.observe(element);
  }
  function attach(element) {
    const existing = contours.get(element);
    if (existing) {
      // Form status labels use textContent; keep their decorative contour when
      // a busy/success/error transition replaces the button's children.
      if (existing.svg.parentNode !== element) {
        element.prepend(existing.svg);
        drawContour(element);
      }
      return;
    }
    const svg = document.createElementNS(svgNamespace, "svg");
    const path = document.createElementNS(svgNamespace, "path");
    svg.classList.add("zigzag-contour");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.append(path);
    contours.set(element, { svg, path, seed: 1.3 + nextSeed++ * 0.83 });
    element.prepend(svg);
    drawContour(element);
    observer.observe(element);
  }
  function scan(root) {
    if (root.nodeType === Node.ELEMENT_NODE && root.matches(selector))
      attach(root);
    for (const element of root.querySelectorAll(selector)) attach(element);
    if (
      root.nodeType === Node.ELEMENT_NODE &&
      root.matches(".preview-paper,.preview-manifesto-card")
    ) {
      attachPaper(root);
    }
    for (const element of root.querySelectorAll(
      ".preview-paper,.preview-manifesto-card",
    )) {
      attachPaper(element);
    }
  }
  scan(document);
  new MutationObserver((records) => {
    for (const record of records) {
      if (
        record.target.nodeType === Node.ELEMENT_NODE &&
        record.target.matches(selector)
      ) {
        attach(record.target);
      }
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) scan(node);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
  matchMedia("(min-width:1201px)").addEventListener("change", () => {
    for (const element of paperElements) syncPaper(element);
  });
})();
