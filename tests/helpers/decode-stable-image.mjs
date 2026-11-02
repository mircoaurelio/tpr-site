// A valid native image decode is aborted when an enhancement replaces src.
// Retry only that source transition; a broken settled asset still rejects.
export async function decodeStableImage(locator) {
  return locator.evaluate(async image => {
    let deadline;
    const work = async () => {
      for (let attempt = 0; attempt < 8; attempt++) {
        const requested = image.src, selected = image.currentSrc;
        try { await image.decode(); }
        catch (error) {
          if (image.src !== requested || image.currentSrc !== selected || image.currentSrc !== image.src) {
            await new Promise(resolve => requestAnimationFrame(resolve));
            continue;
          }
          throw error;
        }
        await new Promise(resolve => requestAnimationFrame(resolve));
        if (image.src === requested && image.currentSrc === requested && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)
          return { src: image.src, width: image.naturalWidth, height: image.naturalHeight };
      }
      throw new Error(`Image source did not settle after8 transitions: ${image.src}; selected: ${image.currentSrc}`);
    };
    try {
      return await Promise.race([work(), new Promise((_, reject) => {
        deadline = setTimeout(() => reject(new Error(`Image decode timed out: ${image.src}; selected: ${image.currentSrc}`)), 6000);
      })]);
    } finally { clearTimeout(deadline); }
  });
}
