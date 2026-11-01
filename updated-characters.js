/* Hydrate the supplied, separated Figma character paths on updated routes. */
(() => {
  if (!document.body.classList.contains('updated-preview')) return;
  const base = new URL('.', document.currentScript.src);
  const keys = ['coworking', 'bar', 'media', 'reformer', 'wellness', 'generic'];
  const labels = { coworking: 'TPR Coworking', bar: 'TPR Fuel', media: 'TPR Media', reformer: 'TPR Move', wellness: 'TPR Recharge' };
  const previous = window.tprLittleMen;
  const markup = new Map();
  const svg = key => {
    const source = markup.get(key);
    if (!source) return previous?.svg?.(key) || '';
    // Newly inserted elevator cars share the same phase as the moving preview.
    return source.replace('<svg ', `<svg style="--character-clock:${(-performance.now() / 1000).toFixed(4)}s" `);
  };
  const ready = Promise.allSettled(keys.map(async key => {
    const response = await fetch(new URL(`assets/figma-updated/characters/${key}.svg`, base), { credentials: 'omit' });
    if (response.ok) markup.set(key, await response.text());
  }));
  window.tprLittleMen = { svg, ready };

  const visibility = new IntersectionObserver(entries => {
    for (const entry of entries) entry.target.classList.toggle('is-character-visible', entry.isIntersecting);
  }, { threshold: 0 });
  function observeCharacter(node) {
    if (node.dataset.characterObserved) return;
    node.dataset.characterObserved = 'true';
    visibility.observe(node);
  }
  function mountCharacters() {
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
  }
  ready.then(() => {
    let frame = 0;
    new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => { frame = 0; mountCharacters(); });
    }).observe(document.body, { childList: true, subtree: true });
    mountCharacters();
    document.dispatchEvent(new Event('tpr-little-men-ready'));
  });
})();
