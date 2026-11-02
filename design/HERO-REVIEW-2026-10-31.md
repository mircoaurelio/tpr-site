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

## Full-width colored sections

The subsequent Event screenshot exposed the same container limit outside the
hero. At 1536px / DPR1.25, Events painted from x12 to x1524, leaving body-blue
rails on both sides. The original photograph stopped at those same boundaries.

Above 1512px, Home now limits its inner content grid rather than its page canvas.
Colored sections and the footer fill the viewport; adaptive padding preserves
the 1352px text/card grid and the footer's original 92px inset. The Event photo
and eye scale together to the full viewport. Its figure grows enough to retain
the complete original composition, including the part occupying bottom padding.
The people strip's pink plane also reaches both edges.

The membership decoration remains proportional and full width, anchored at the
bottom so it does not hide the same-colored partner heading. At very wide sizes
this crops more of the top decoration. The original 1512px page composition is
unchanged; an independent full-page A/B comparison produced identical PNG bytes
(SHA256 `1a0f29311840c51c9873d523840e480dbde35e3f18e382b8e5c22c3a5c1b000e`).
Mobile rules and original Room geometry remain unchanged.

The full UI run passed 88 tests with two independent file workers. The new edge
regression reproduced blue rails at 1536/1920/2560 before the fix. Its final
focused run passed 16 checks on Chromium and WebKit at
320/393/1280/1512/1536/1920/2560, including DPR1.25 and1.5, painted edge colors,
photo reach, grid width, document overflow and partner glyph visibility. The
added contrast check reproduced 82.59% visible glyph pixels before correcting
decorative placement; both engines paint 100% afterward. Generator locale and
diff checks pass. No form submissions were sent.

- [Event section before](review/section-edges-2026-10-31/events-before-1536.png)
- [Event section after](review/section-edges-2026-10-31/events-after-1536.png)
