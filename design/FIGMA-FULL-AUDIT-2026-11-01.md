# Full Figma and card-paint audit — 1 November 2026

The review covers all 11 canonical routes at desktop 1512×952 and nominal mobile
393×852, plus menu, About discovery, an offer dialog and Room card states.
New screenshots and measurements are in ignored `.qa/figma-full-audit-20261101/`.
The browser viewport override was reset afterwards; no Figma source was edited.

## Sources and coverage

The authoritative file is `FpPfXalg4PRyqtnvwt2DUL`, updated section `616:2194`.
A fresh Figma MCP context request again returned the Professional View-seat
quota limit. Authenticated browser inspection remained available and confirmed
Home `616:1707`, 1512×8553 including the 30px mock menu bar, and Royal Blue
`#2C64E8`. This review uses the existing source desktop exports, the original
five Room PDFs and Menu PDF, and their unchanged assets/provenance registries.

| Route | Figma node | Visual reference |
| --- | --- | --- |
| `/homepage-tpr/` | `616:1707` | Source Home export; source Room assets; mobile Article below |
| `/about/` | `616:2407` | Source About export / `About_TPR.pdf` |
| `/contatti/` | `616:2569` | Source Contacts export |
| `/eventi/` | `616:2675` | Source Events export / `Eventi_TPR.pdf` |
| `/vivi-tpr/` | `685:1973` | Source Vivi export |
| `/prenota/` | `1065:3382` | Source booking export; authorized live calendar adaptation |
| `/rooms/coworking/` | `809:3282` | `Coworking.pdf` |
| `/rooms/reformer/` | `643:1823` | `Move.pdf` |
| `/rooms/wellness/` | `643:1964` | `Recharge.pdf` |
| `/rooms/bar/` | `643:1895` | `Fuel.pdf` |
| `/rooms/media/` | `643:2033` | `Media.pdf` |

The six static desktop references are `design/review/source-*-desktop.webp`.
Room PDF hashes, photo windows, card faces and transforms remain in
`room-card-faces.json`, `asset-files.json` and `figma-slots.json`.

## Visual findings

About and Contacts retain the source compositions: original image crops,
decorations, paper contours, grid, font families, heading/body hierarchy and
footer. The approved TM artwork replaces the source registered mark. All five
standalone Room intros use their definitive original photos and alpha masks;
the 13 photo fronts and two coming-soon illustrations remain source assets.

Vivi and Events were also compared after moving the native carousels to the
same source positions. Vivi reaches Flex 8 at x392 and virtual office at x952.
Free dragging Events reaches Dinner at x149.6 and Ceramic Workshop at x789.6,
with 560px cards and 80px gaps. Their photo crops, labels and paper edges agree
with the exports. Starting on the first option and the additional accessible
controls are intentional; their 72px vertical space is retained.

The booking panel intentionally grows with the Mindbody calendar instead of
matching the source's empty white placeholder. Home retains its original
1250ms lift, 39% Explore zoom and vertical panorama travel. A stitched Home
document screenshot therefore includes the scroll runway and is not a static
page-height comparison with the PDF.

The menu was checked against `Menu_TPR.pdf` after its opening transition.
Its source background, grouping and five icons are retained. About Move
discovery and the Day Pass dialog were opened through their native controls;
copy, fields, focus and close/return behavior remained available. No form,
subscription, email or booking was submitted.

All captured routes had no document-wide horizontal overflow. Requested local
images decoded successfully. Unrequested/offscreen incoming image elements
with no `currentSrc` are not broken images. A full-page screenshot alone can
precede lazy image loading; About's lower photographs were therefore checked
again in their actual scrolled viewport.

## Source arrow correction

Standalone Room photo cards used a typographic diagonal arrow, unlike the
single chevron in an irregular circle on the original PDF fronts. The shared
front-label generator now reuses the unchanged `assets/route-arrow-zigzag.png`,
already used by the source About cards. A mask applies each Room's existing
ink color. Its nominal desktop frame stays 48px with the source 52×54 painted
bounds; mobile keeps the previous 36px label height. Photos, card frames,
two coming-soon labels, focus controls and flip surfaces are unchanged.

The new arrow regression compares painted icons with the original PDF card
face, independently of the asset selected by CSS. The old glyph produced
2.7% normalized silhouette overlap. The source circle/chevron produces about
79–81% across the five Room colors and desktop/mobile rasterizations, above
the 70% tolerance. The test does not assert merely that a CSS URL exists.

## WebKit backface correction

Actual screenshot comparisons found a material pre-existing renderer problem:
WebKit painted the mirrored back over a closed front despite computed
`backface-visibility:hidden`. Frozen production commit `cea685f` served at
port4180 reproduced 73.01% wrong pixels on standalone desktop, 74.22% on
standalone mobile, 75.07% on Home desktop and 77.05% on Home mobile. A minimal
two-face fixture without TPR artwork or masks reproduced the same reversed
paint. Removing the new arrow did not affect the failure.

`updated-card-motion.js` now reads the actual rotor matrix and switches paint
only when the physically facing side changes at90 degrees. CSS opacity and
pointer-event gating suppress the opposite surface. Opacity preserves the
native controller's immediate close-button focus; `visibility:hidden` would
prevent it. Both faces keep their rigid180-degree relationship and the same
680ms animation, easing, perspective and retreat. State/inert/ARIA/link/focus
logic and atomic source loading remain with the existing controllers. The
sampling loop stops when all turns are at rest.

The paint regression compares screenshots with an independently isolated
facing surface, at front rest, both halves of the turn, back rest, reverse,
and both reduced-motion states. The final28 complete-scene samples differ by
0% on WebKit and at most0.009% on Chromium (20 pixels in one434×560 sample),
well below the unchanged0.5% raster tolerance across Home/standalone and desktop/mobile.
This is stronger evidence than checking computed opacity or rotation alone.

Independent follow-up also exercised desktop fallback when the manifest or a
single source front fails. Its original native back used a delayed opacity
change and relied on backface culling during a500ms CSS turn. It could expose
mirrored text at75ms of opening and225ms of closing. The two failed-source
opening cases reproduced56.27% wrong pixels before correction. A separate set
now samples the native back's actual angle without creating a rotor or moving
any nodes. Its500ms transform/ease-out is retained; opacity follows the facing
side immediately. Native inert/ARIA/focus remain unchanged, and pointer events
require both visible paint and an accessible back. The native set/attribute are
removed when all source assets are ready and the full scene installs atomically.
Both failed-source cases now have0% differing pixels at opening75, open rest,
closing225 and closed rest on both engines:36 paint samples per engine including
the28 complete-scene samples above.

## Verification and limits

- Final complete-scene/native-fallback paint and physical-motion run:17/17
  Chromium and17/17 WebKit passed. This covers36 paint samples per engine,
  geometry, focus, rapid reversal, reduced motion, failed/delayed source loading
  and the held-pointer installation race.
- Source-arrow comparison:2/2 on each engine passed. All14 native standalone
  backs at1512/393/320px passed3/3 Chromium copy checks. These source-arrow/copy
  checks preceded the native-fallback extension, which changes only the Home
  desktop fallback. A first overloaded WebKit navigation exceeded6s before reaching the
  DOM; only navigation timeout was increased to20s, and the sequential run
  passed. Interaction waits were not relaxed.
- `node --check updated-card-motion.js`, generator Python compilation and
  `git diff --check` passed. Both new regressions are included in `test:ui`
  and `test:feedback`. Final project-wide testing/build/deployment is recorded
  by the coordinating release work, not implied by this focused result.

The previously inspected mobile Article `560:2843` supplies the Home hero's
393px geometry and36/32.4px title. Its exact image-fill Vector `560:2989` remains
unavailable. Other updated mobile frames were not supplied or recovered, so
the mobile review establishes responsive fit and source-asset consistency,
not complete pixel-for-pixel equality to unseen frames. The browser's nominal
393px override can round to393.6 CSS pixels on this Windows display; automated
393px viewport checks use exact dimensions. Windows Chromium/WebKit runs do
not certify a physical iPhone/Safari device. The approved prototype video
remains unavailable; exact animation-duration/easing equivalence is not claimed.

The coordinating release subsequently published these corrections as Worker
version `ce75f6d8-7d5b-44bd-bbe0-775920ffbec3`, source `b0af3af`. Full-suite and
public deployment evidence, including the separately corrected gesture-test
fixture, is recorded in [SEO-FIGMA-RELEASE-2026-11-01.md](SEO-FIGMA-RELEASE-2026-11-01.md).
