/* Original TPR cursor, independent of the legacy menu controller. */
(() => {
  const finePointer = matchMedia('(pointer: fine)');
  if (!finePointer.matches || document.querySelector('#tprCursor')) return;
  const base = new URL('.', document.currentScript.src);
  const root = document.documentElement;
  const cursor = document.createElement('div');
  cursor.id = 'tprCursor';
  cursor.className = 'tpr-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  for (const [name, height] of [['spark', 87], ['eye', 61]]) {
    const image = document.createElement('img');
    image.className = `tpr-cursor__${name}`;
    image.src = new URL(`assets/cursor-${name}.png`, base).href;
    image.alt = '';
    image.width = 110;
    image.height = height;
    cursor.append(image);
  }
  document.body.append(cursor);
  const actionSelector = 'a,button,input,select,textarea,summary,[role="button"],[data-room-link],[data-carousel]';
  const textSelector = 'textarea,[contenteditable="true"],[contenteditable=""],input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="color"]):not([type="range"]):not([type="hidden"])';
  let promoteFrame = 0;

  function hideCursor() {
    cursor.classList.remove('is-visible');
    root.classList.remove('has-tpr-cursor');
  }

  function restackCursor() {
    const host = [...document.querySelectorAll('dialog[open]')].at(-1) || document.body;
    if (cursor.parentElement !== host) host.append(cursor);
    if (typeof cursor.showPopover !== 'function') return;
    cursor.setAttribute('popover', 'manual');
    try {
      if (cursor.matches(':popover-open')) cursor.hidePopover();
      cursor.showPopover();
    } catch { /* Parent stacking remains the fallback on older browsers. */ }
  }

  function promoteCursor() {
    if (promoteFrame) return;
    promoteFrame = requestAnimationFrame(() => {
      promoteFrame = 0;
      restackCursor();
    });
  }

  restackCursor();
  addEventListener('pointermove', event => {
    if (!finePointer.matches || event.pointerType === 'touch') { hideCursor(); return; }
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(textSelector)) { hideCursor(); return; }
    cursor.style.left = `${event.clientX}px`;
    cursor.style.top = `${event.clientY}px`;
    cursor.classList.toggle('is-action', Boolean(target?.closest(actionSelector)));
    cursor.classList.add('is-visible');
    root.classList.add('has-tpr-cursor');
  }, { passive: true });
  root.addEventListener('pointerleave', hideCursor);
  addEventListener('blur', hideCursor);
  addEventListener('keydown', hideCursor, { capture: true });
  finePointer.addEventListener('change', hideCursor);
  document.addEventListener('toggle', event => { if (event.target !== cursor) promoteCursor(); }, true);
  document.addEventListener('close', event => { if (event.target instanceof HTMLDialogElement) promoteCursor(); }, true);
  new MutationObserver(promoteCursor).observe(root, { subtree: true, attributes: true, attributeFilter: ['open'] });
})();
