/* Presentation refinements leave navigation, form state and card controllers
   with their existing owners. Safe to load after deferred shared scripts. */
(() => {
  "use strict";
  if (!document.body.classList.contains("updated-preview") || document.documentElement.classList.contains("has-updated-refinements")) return;
  document.documentElement.classList.add("has-updated-refinements");

  document.querySelectorAll(".preview-discover-button").forEach((button) => {
    const face = document.createElement("span");
    face.className = "preview-discover-face";
    // Keep the SVG as a direct child: zigzag-controls owns and redraws it.
    [...button.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE).forEach((node) => face.append(node));
    button.append(face);
    // Start every painted layer in the same frame, even if this deferred
    // script arrives later than the contour's owning script.
    button.classList.add("has-discover-float");
  });

  const excluded = ".preview-menu-button,[data-menu-close],.tpr-elevator__button,.preview-room-icon,[data-elevator-card-open],[data-room-card-open]";
  function markTextControl(element) {
    if (element.matches(excluded)) return;
    if (/[\p{L}\p{N}]/u.test(element.textContent)) element.classList.add("tpr-text-control");
  }
  function scan(scope) {
    if (scope.nodeType === Node.ELEMENT_NODE && scope.matches("a,button")) markTextControl(scope);
    scope.querySelectorAll?.("a,button").forEach(markTextControl);
  }
  scan(document);
  new MutationObserver((records) => {
    for (const record of records) {
      const control = record.target.nodeType === Node.ELEMENT_NODE ? record.target.closest("a,button") : null;
      if (control) markTextControl(control);
      record.addedNodes.forEach((node) => { if (node.nodeType === Node.ELEMENT_NODE) scan(node); });
    }
  }).observe(document.body, { childList: true, subtree: true });
})();
