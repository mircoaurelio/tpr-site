/* Offer dialogs and direct inquiries. Delivery is acknowledged by the API. */
(() => {
  'use strict';
  if (document.documentElement.dataset.inquiriesInitialized) return;
  document.documentElement.dataset.inquiriesInitialized = 'true';
  const allowedOffers = new Set(['day-pass', 'all-inclusive', 'flex-8', 'ufficio-virtuale']);
  const allowedRooms = new Set(['coworking', 'reformer', 'wellness', 'bar', 'media']);
  const query = new URLSearchParams(location.search);
  const openers = new WeakMap();
  const restoreDialog = dialog => {
    if (dialog.open) return;
    if (!document.querySelector('[data-inquiry-dialog][open]')) document.documentElement.classList.remove('is-inquiry-open');
    const opener = openers.get(dialog);
    openers.delete(dialog);
    opener?.focus({ preventScroll: true });
  };
  const closeDialog = dialog => { dialog.close(); restoreDialog(dialog); };

  document.querySelectorAll('[data-inquiry-dialog]').forEach(dialog => {
    dialog.querySelector('[data-inquiry-close]')?.addEventListener('click', () => closeDialog(dialog));
    dialog.addEventListener('close', () => restoreDialog(dialog));
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog(dialog); });
    let pressedOutside = false;
    const outside = event => {
      const card = dialog.querySelector('.preview-inquiry-card').getBoundingClientRect();
      return event.clientX < card.left || event.clientX > card.right || event.clientY < card.top || event.clientY > card.bottom;
    };
    dialog.addEventListener('pointerdown', event => { pressedOutside = event.target === dialog && outside(event); });
    dialog.addEventListener('pointerup', event => { if (pressedOutside && event.target === dialog && outside(event)) closeDialog(dialog); pressedOutside = false; });
    dialog.addEventListener('pointercancel', () => { pressedOutside = false; });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
      const nodes = [...dialog.querySelectorAll('button:not(:disabled),a[href],input:not([type="hidden"]),select,textarea,[tabindex="0"]')].filter(node => node.getClientRects().length && !node.closest('[inert],.preview-trap'));
      if (!nodes.length) return;
      event.preventDefault();
      const current = nodes.indexOf(document.activeElement);
      const next = current < 0 ? (event.shiftKey ? nodes.length - 1 : 0) : (current + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
      nodes[next].focus();
    });
  });
  document.addEventListener('click', event => {
    const trigger = event.target.closest('[data-inquiry-open]');
    if (!trigger || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const dialog = document.getElementById(trigger.dataset.inquiryOpen);
    if (!(dialog instanceof HTMLDialogElement)) return;
    event.preventDefault();
    if (dialog.open) return;
    openers.set(dialog, trigger);
    dialog.showModal();
    document.documentElement.classList.add('is-inquiry-open');
    dialog.querySelector('select,input:not([type="hidden"])')?.focus({ preventScroll: true });
  });

  document.querySelectorAll('[data-inquiry-form]').forEach(form => {
    const button = form.querySelector('[type=submit]');
    const status = form.querySelector('[role=status]');
    const label = [...button.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    const originalLabel = label?.textContent || '';
    let busy = false;
    const update = () => {
      button.disabled = busy;
      button.classList.toggle('is-ready', form.checkValidity());
    };
    form.addEventListener('input', update);
    form.addEventListener('change', update);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      const values = new FormData(form);
      const kind = form.dataset.kind || 'contact';
      const body = { kind };
      for (const key of ['user_type', 'name', 'email', 'phone', 'message', 'website']) body[key] = String(values.get(key) || '').trim();
      const offer = form.dataset.offer || query.get('offer');
      const room = form.dataset.room || query.get('room');
      if (kind === 'contact' && allowedOffers.has(offer)) body.offer = offer;
      if (allowedRooms.has(room)) body.room = room;
      busy = true;
      form.dataset.state = 'pending';
      form.setAttribute('aria-busy', 'true');
      form.closest('.preview-contact-card')?.classList.add('has-status');
      status.textContent = 'Invio in corso…';
      if (label) label.textContent = 'Invio… ';
      update();
      try {
        const response = await fetch(form.dataset.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000), credentials: 'omit' });
        const result = await response.json();
        if (!response.ok || result.success !== true) throw new Error('Inquiry not acknowledged');
        form.dataset.state = 'success';
        status.textContent = 'Grazie! La tua richiesta è stata inviata.';
        form.reset();
      } catch {
        form.dataset.state = 'error';
        status.textContent = 'Invio non riuscito. Riprova tra poco.';
      } finally {
        busy = false;
        form.removeAttribute('aria-busy');
        if (label) label.textContent = originalLabel;
        update();
      }
    });
    update();
  });
})();
