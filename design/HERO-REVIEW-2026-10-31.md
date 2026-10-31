# Home container and mobile hero review

The reported blue outer strip came from centering the Home hero inside the
1512px content grid. At 1920px this left 204px gutters; at 1536px it left 12px.
The hero artwork now reaches both viewport edges while its desktop title stays
aligned with the source content grid. The fixed-size partner row also leaked
horizontal overflow between 901px and 1163px after restoring the full-width Room
section. It now wraps within smaller desktop grids.

## Figma evidence

The MCP quota is exhausted. An authenticated in-app browser was able to inspect
the actual Properties panel in file `FpPfXalg4PRyqtnvwt2DUL`, Website Mobile
section `560:1291`, Article `560:2843`. These are directly observed values,
not dimensions inferred from the supplied cropped screenshot.

| Source element | Observed at 393px | Implementation |
| --- | --- | --- |
| First section boundary | 326px | 326px at 393px, proportional width adaptation |
| Title `560:2991` | x223, y262, w142, h64 | x223.17, y262, w141.83, h64.78 |
| Title type | PP Rader Bold, 600, 36px, 90% leading | Original font file, 36px/32.4px at 393px |
| Title treatment | White, uppercase, right aligned, tracking 0 | Preserved |
| Header `560:2962` | 393×77.33px, top 24px, padding 12px 24px | Same geometry at 393px |
| Header logo `560:2963` | 109.47×53.33px | Same dimensions |
| Intro Copy `560:2848` | Top 326px, padding 24px | Content starts at 350px |

The former mobile title was 88px inside a 740px hero. `home-layout.css` replaces
those values only on Home. Widths 320px and 430px are responsive adaptations;
there is no claim that unprovided frames at those widths match pixel for pixel.
A 24px minimum right inset keeps the narrowest title within the content margins.
The source mobile header contains only logo and hamburger. Home follows that
composition; booking remains available in the main menu and page content.

The original mobile image Vector `560:2989` measures 907×501px at x−279, y−215
and has an image fill. Export/download did not yield that artwork. The fallback
therefore uses the supplied original 3024×1904 Home photo/eye composition as one
proportional image with `object-fit:cover`. It removes the independently stretched
desktop mask and differently cropped raw photograph. This corrects distortion,
but does not establish an exact match to the unavailable mobile Vector crop.

## Regression coverage

`hero-container-regression.mjs` reproduces the gutter and document overflow
before the fix and checks 13 widths/DPR combinations after it. It checks both
title lines, decoded artwork and document width. Vertical checks use CSS line
boxes because native text Range height includes unused font descenders beyond
the source 90% leading. A further screenshot-pixel regression requires at least
95% blue behind the white booking CTA at 1920px. Moving Home navigation to the
viewport corners above 1512px raises that coverage from 58.57% to 100%.
Below the nominal desktop canvas, booking moves into the menu so its white
header text does not sit over the bright photograph. At 1512px the source
header remains unchanged. A browser check verifies menu booking access at
1280px and 1440px.

`mobile-hero-figma-regression.mjs` uses independent literals from the inspected
Figma Properties panel. It verifies the 393px geometry, font actually painted
through Chromium CDP, artwork proportions, and readability at 320/430px.
The previous 88px expectation in the older mobile suite is replaced by the
inspected source 36px size and proportional adaptation.

An independent review found no material defect. At 1512×952 the hero screenshot
with the new stylesheet enabled and disabled was byte-identical. Hero and Room
sections remain full width across the mobile/desktop breakpoints; the original
Room controller, motion stylesheet and panorama geometry are unchanged.

Verification passed: the full UI suite (73 tests), then the affected mobile/menu
checks after the header refinement (19 tests), and the final hero/container
suite after the wide navigation fix (16 tests). The generator locale regression
passes and repeat generation preserves HTML bytes. Independent WebKit testing
passes 69 checks across eight viewports, including native Room scrolling and
panorama travel. These Windows browser-engine runs do not certify physical iOS.

- [Desktop before](review/hero-2026-10-31/desktop-before-1920.png)
- [Desktop after](review/hero-2026-10-31/desktop-1920.png)
- [Mobile before](review/hero-2026-10-31/mobile-before-393.png)
- [Mobile after](review/hero-2026-10-31/mobile-393.png)
