// Preserve the original Figma image bytes and geometry while allowing the
// browser to schedule these known belowfold Home images near their viewport.
export function configureImageLoading(html, pathname) {
  if (!['/', '/homepage-tpr/'].includes(pathname)) return html;
  // Reserve the shared controller's existing final geometry before deferred
  // initialization; otherwise native lazy loading sees Events beside an
  // empty Room section and downloads it during the hero's first paint.
  if (html.includes('data-elevator-config')) html = html.replace(/<section\b[^>]*\sid=(['"])rooms\1[^>]*>/, tag => {
    if (!/\bclass=/.test(tag)) return tag.replace('<section', '<section class="tpr-elevator"');
    return tag.replace(/\bclass=(['"])(.*?)\1/, (attribute, quote, classes) => classes.split(/\s+/).includes('tpr-elevator') ? attribute : `class=${quote}${classes} tpr-elevator${quote}`);
  });
  return html.replace(/<img\b[^>]*>/g, tag => {
    const source = tag.match(/\bsrc=(['"])(.*?)\1/)?.[2];
    if (!source || !/(?:^|\/)assets\/figma-updated\/(?:composites\/home-events-photo-eye-2x\.webp|photos\/(?:day-pass|all-inclusive|flex-8|ufficio-virtuale|company)\.jpeg)(?:[?#]|$)/.test(source)) return tag;
    return /\bloading\s*=/.test(tag)
      ? tag.replace(/\bloading\s*=\s*(['"])[^'"]*\1/, 'loading="lazy"')
      : tag.replace(/\s*\/?>(?=$)/, ending => ` loading="lazy"${ending}`);
  });
}
