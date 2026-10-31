# Footer, Contacts, Room navigator and copy review

## Page canvas

The previous Home fix left the shared footer capped at1512px on the other ten
canonical routes. At1920px that exposed204px colored rails beside white footers.
Contacts also clipped its source S decoration at the centered canvas edge.

`page-layout.css` extends the white footer on all11 routes and the decorative
canvas on the five static main pages. Inner content remains centered on its
source grid:1352px for text/forms and1328px inside the footer's92px insets.
Decorative SVGs retain original dimensions and positions relative to that grid;
their complete paths can continue into the newly visible viewport edges.
Standalone Room stage geometry is unchanged. Vivi's newsletter uses
`display:contents`, so its columns receive the adaptive inset directly.

An independent A/B review found identical1512px renders for all six main pages
with the shared stylesheet enabled and disabled. This checks the layout change,
not the intentional copy corrections described below.

## Navigator

The original updated toolbar uses48px nominal frames with32px desktop gaps.
Its irregular artwork paints about52×54px. Percentage-sized legacy Home controls
instead painted82×84px at1512px. Padded active/off images shrank to68×71px on
desktop and40×42px on mobile when the active Room changed.

The Home bridge now uses48×48px control frames. Tightly cropped source SVGs keep
their original51.808655×53.660400px canvases. Original124×124 legacy files scale
uniformly to62×62px and align their painted bounds to the same frame. No SVG path
is edited. Desktop centers are596/676/756/836/916 at1512px, with the nominal row
top824px in a952px scene. Smaller viewport insets remain responsive.

Both Chromium and WebKit passed100 painted specimens over all five active
states at1512/393/320/430px. Every specimen paints52×54px; engine comparisons show
no dimension or position difference. Mobile checks establish fit,48px targets
and state consistency; they do not claim an unavailable mobile Figma toolbar
reference. Standalone Room routes have no five-icon navigator in the supplied
implementation/reference, so none was added.

## Text sources

The audit checked241 base strings on11 canonical routes and corrected:

- About Move: `Tecnogym` to `Technogym`.
- Recharge: `logevity room` to `longevity room`.
- Home Room introduction: removed an unmatched closing quote, also present as
  a typo in the source raster.
- Configured Room navigation, Explore and status announcements now use the
  current visible TPR titles. Unconfigured legacy names retain their fallback.

Visit and legal addresses are intentionally different. Both addresses, opening
hours, company name and VAT match the supplied source exports and were retained.

The authenticated Figma UI also exposed14 actual Card Back frames in updated
section616:2194, file `FpPfXalg4PRyqtnvwt2DUL`. Their headings, descriptions and CTA
labels were read at116% zoom and recorded in each Room's `cardDetails`, replacing
the repeated Room introduction and generic back labels. Source frames:

| Room | Card Back nodes |
| --- | --- |
| Coworking |616:3793,616:3808,616:3822 |
| Move |643:2102,643:2115,643:2128 |
| Recharge |643:2141,643:2154,643:2167 |
| Fuel |643:2180,643:2193,643:2206 |
| Media |643:2219,643:2245 |

Recharge643:1964 and Media643:2033 confirm the existing card order and the
Longevity/Studio audio `coming soon` front labels. Studio audio has no supplied
Card Back; its description remains that literal source state, with no CTA.
No card copy was invented. Existing flip controls and navigation behavior are
preserved: CTA wording remains inside the original flip control, without adding
new nested links. Tests exercise45 configured backs at1512/393/320px and the
unconfigured legacy fallback; no description clipping was recorded.

Exact missing Room photographs, two illustrations and the mobile hero crop
remain separate artwork limitations documented in IMPLEMENTATION.md.

## Verification

New regressions first reproduced the footer rails, Contacts clipping, navigator
size jumps, stale names and repeated card text. Shared canvas tests cover all11
footers and Contacts at1512/1536(DPR1.25)/1920/393/320; an additional check guards
Vivi's newsletter grid. Form tests intercept responses and send no submissions.
The final full UI suite passed104/104 tests with two independent file workers.
The separate WebKit navigator run passed4/4 tests over100 painted specimens.
Generator locale, deterministic rebuild and diff checks also pass.
