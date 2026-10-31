# Responsive review after session recovery

The recovered GitHub branch remains the implementation source. Production
`thepeoplesroom.it` and its backend configuration were not changed.

## Fixes verified in Chromium

- Home hero and Community headings fit at 320px without changing the reviewed
  393px and 430px type sizes.
- Newsletter controls retain their SVG paper contour while disabled, ready,
  submitting, failed and reset after success. The native button background no
  longer covers the irregular edge.
- Opening, closing and escaping Room exploration keeps the focused control
  visible on mobile. Desktop scroll position is retained.
- The menu close glyph retains its 48px design size and its separate mobile
  position of 14px from the right and 10px from the top.
- The Home Pilates banner uses the existing paper mask on its decorative
  background. Its text and native hit area remain unmasked.
- Enquiry selects use the existing white arrow with their native hit area and
  keyboard selection retained.
- The preview generator reads its source copy and writes generated pages as
  UTF-8 explicitly, including on Windows with a non-UTF-8 default text locale.
  A temporary-tree regression checks generated pages and JSON-sourced accents.

## Eventi reference supplied in chat

The pink `#ff7bff`, blue `#2c64e8` and original photo/eye composition match the
available source. The supplied cropped screenshot is consistent with a 402 CSS
pixel viewport at 125% display scale. It does not establish a 393px frame.
The current responsive layout stacks the two CTAs at 320/393px and puts them
on one row at 402/430px. No breakpoint was changed based only on that crop.

## Verification and reproducibility

Install the locked development dependencies with `npm ci`, then install the
matching test browsers with `npx playwright install chromium webkit`. Serve the
project with `npm run dev:qa` on port 4174. In another terminal run (PowerShell
uses `$env:TPR_BASE_URL='http://127.0.0.1:4174'`):

```sh
npm run test:newsletter
TPR_BASE_URL=http://127.0.0.1:4174 npm run test:ui
python3 -m unittest discover -s tests -p test_preview_generator.py
```

`TPR_BASE_URL` selects another server URL. UI tests run the real pages and
intercept external writes; they do not subscribe contacts or send email.
Screenshots and measurements are written to the ignored `.qa/` directory.
UI test files run serially against the shared local server. Assertions are not
retried or weakened to accommodate resource contention.

The first recovered-session run passed 10 UI tests, 15 newsletter tests and the
generator locale regression. The additional public review below extends that
coverage. Representative captures from the first run:

- [Newsletter ready, 393px](review/responsive-2026-10-31/newsletter-393-ready.png)
- [Menu, 393px](review/responsive-2026-10-31/menu-393.png)
- [Eventi, 402 CSS px at 125% scale](review/responsive-2026-10-31/events-402-at-125-percent.png)

These captures are evidence of the implementation, not substitutes for the
missing updated mobile Figma export.

## Public review and restored scroll elevator

The first GitHub Pages publication exposed stylesheet-relative mask URLs that
escaped the `/tpr-site/` project base. The generator now uses paths relative to
the consuming stylesheet; the new project-base regression requests every Room
mask at both root and project mounts and rejects escaped URLs.

Independent WebKit testing also found focus escaping the menu when native Tab
navigation skipped links. The menu now cycles its visible controls explicitly
and restores its opener after touch activation. The company paper uses unchanged
source mask/frame slices at responsive sizes, with the original nominal desktop
rendering retained. Unsupported mask-box-image engines retain their prior mask.

Home now reuses the original layered elevator controller and unchanged motion
stylesheet. Separate photo/copy/background planes preserve the fixed masked
photograph and crossfade during the1250ms lift. Explore restores the real wide
panorama,39% opening position,720ms opening animation,1.2 native-scroll factor,
reverse exit, next-Room handoff and final exit. The original720px mobile
boundary and expanding/flipping cards remain. Only data/assets and a scoped
compatibility bridge adapt the section to the new preview.

Four independent baseline cases passed against the previous Git revision and
failed on the replaced preview before restoration. Current comparison tests
exercise actual computed transforms and image/card motion, not just selected
Room buttons. Further checks cover forward/reverse floors, hashes/query
preservation, readable copy in constrained viewports, the project asset prefix,
WebKit menu focus and source-scaled company paper edges.

An independent designer compared the available six desktop PDF exports and
11routes at1512/393/320px. It confirmed source families and sizes, and identified
a30.766px Room-copy offset: the bridge aligns the nominal title/body to264/384px,
with80px Rader Bold and24px Haas Regular. Updated titles/paragraphs are supplied
as content; the legacy motion and image geometry remain separate. Mobile
checks verify readability and fit because full updated mobile source frames
are still unavailable. The footer legal capitalization follows the source.

See [the independent typography review](TYPE-REVIEW-2026-10-31.md) for source
families, nominal sizes, font-file inspection and comparison limits.

Final visual captures of the restored section:

- [Desktop overview](review/restored-elevator-2026-10-31/desktop-overview.png)
- [Desktop panorama after native scrolling](review/restored-elevator-2026-10-31/desktop-explore.png)
- [Mobile overview](review/restored-elevator-2026-10-31/mobile-overview.png)
- [Original mobile expanding cards](review/restored-elevator-2026-10-31/mobile-explore.png)

Browser-engine runs are on Windows and do not establish physical iOS behavior.
All write requests are intercepted. The earlier local Python server produced
connection-refused asset loads during a combined run; the async Node QA server
and explicit resource-load assertions make incomplete pages fail before visual
comparisons. Source-sized paper preservation is checked with a same-page A/B,
so independent application changes cannot invalidate a stale screenshot hash.

The final unchanged-source run passed **43/43 browser tests**, **15/15 newsletter
tests** and the generator locale regression. A repeat build preserved generated
HTML bytes. Syntax and diff checks passed. The original elevator stylesheet is
unchanged; configuration and a scoped bridge adapt its content and dependencies.

## Native scrollbars and character colors

The follow-up hides native scrollbar tracks on the document and every preview
scroll container. Overflow, touch gestures, keyboard scrolling and the original
custom panorama progress control remain functional. Chromium and WebKit passed
all 88 route/viewport combinations, including menus, filled textareas and Room
cards; 537 overflowing-container observations had no scrollbar-style violations.

All five source figure SVGs use `currentColor`. External-image fallbacks painted
black while inline SVG hydration was delayed or failed. Home now paints that
same source silhouette as an alpha mask in the Room foreground color until the
animated inline SVG is ready. Existing PNG fallbacks on legacy routes remain.
The [independent color audit](COLOR-REVIEW-2026-10-31.md) records 20 reproduced
black fallbacks before the fix and 51 passing raster specimens after it,
including incoming figures, standalone Rooms, white intro/menu figures and
About discovery variants.

WebKit also exposed a resize-delivery loop in the paper controls. ResizeObserver
now queues targets and draws them in one animation frame, preserving source
paths and control states. The dedicated uninstrumented regression passes without
loop warnings after initial load, responsive changes and dynamic About content.

- [Media mobile without native bars](review/scrollbar-color-2026-10-31/media-mobile.png)
- [Yellow Move figure before inline SVG hydration](review/scrollbar-color-2026-10-31/reformer-before-hydration.png)

Follow-up verification passed **48/48 browser tests** on the final clean source,
plus the separate **10/10 scrollbar suite** covering all 88 combinations.
The generator locale regression, syntax and diff checks also passed.

## Home container and inspected mobile hero

The [Home hero review](HERO-REVIEW-2026-10-31.md) records the follow-up gutter
fix and direct browser inspection of Figma's393px Mobile Article. The hero now
reaches the viewport edges, smaller desktop partner rows wrap, and mobile title,
header and section dimensions use the inspected source values. The original
desktop source rendering and Room scroll effect are preserved.

The follow-up Event rail regression extends all Home colored canvases above
1512px while retaining the source inner grid. Event artwork fills the viewport
without clipping; footer and people-strip backgrounds also reach both edges.
The membership background remains proportional and anchors at its bottom to
preserve partner-heading visibility. The linked review includes before/after
screenshots, the identical full-page 1512px comparison, 88 passing UI tests and
the final 16 edge/contrast checks on Chromium and WebKit.

## Verification limits

The current Figma MCP connection reached its View-seat quota. The native Chrome
workflow was stopped because it could not confidently verify its URL. A later
authenticated in-app browser inspection did verify the393px Mobile Article and
its Properties values. Figma asset downloads still did not yield the exact
mobile Vector. The suggested Google Drive plugin has not been confirmed connected.

The remaining exact Room artwork and other updated mobile frames therefore remain
unverified. See `IMPLEMENTATION.md` and `asset-status.json` for the outstanding
17 photo roles, four left-stage compositions and two illustrations. The booking
provider is also still unspecified. Neither successful browser tests nor the
supplied cropped screenshot establishes complete 1:1 Figma fidelity.
