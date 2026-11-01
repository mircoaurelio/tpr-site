# Versione Aggiornata implementation

The recovered-session responsive fixes and their reproducible checks are
recorded in [the 31 October responsive review](RESPONSIVE-QA-2026-10-31.md).
This does not close the remaining exact-artwork and mobile-reference gaps below.

The subsequent [footer, navigator and copy review](FOOTER-NAV-TEXT-REVIEW-2026-10-31.md)
records shared full-width page canvases, stable original toolbar sizing, and the
14 Card Back descriptions/labels recovered directly from the authenticated Figma UI.

The [1 November booking review](PILATES-BOOKING-REVIEW-2026-11-01.md) records the
user-supplied Mindbody calendar, corrected Move booking destination and offer copy.

The subsequent [all-card text audit](ALL-CARD-TEXT-REVIEW-2026-11-01.md) checks
first-party copy on all 11 routes and makes the 14 sourced Room card backs
available in the standalone Room explorers as well as Home.

The [card action review](CARD-ACTIONS-REVIEW-2026-11-01.md) makes all 15 Home card
CTAs native links, including all three Move booking actions to the Pilates page.
Separate open/close buttons preserve the original card flip and scroll geometry.

The native HTML/CSS/JavaScript source serves both the GitHub preview and the Cloudflare production artifact. Existing server credentials remain opaque Cloudflare bindings.

## Source assets and implementation

The original page PDFs and five newly recovered Room exports provide 30 unique embedded JPEG streams, four partner logos, original decorative vectors and paper/control outlines. JPEG bytes and dimensions are preserved. The 15 Room fronts comprise 13 photo windows and two original coming-soon illustrations. Original PDF operators provide complete alpha fronts, cardless panoramas, complete fallback panoramas and precisely clipped Room photographs. Whole-screen renders are review evidence only. Source paths, transforms, hashes and crop frames are recorded in `room-card-faces.json` and the asset registry.

The original `SVGs` section was exported directly from authenticated Figma. Six character rigs retain the unmodified white `Separato` paths. Visible figures play a finite welcome gesture on entry and on Room reentry/settling; mouse hover and linked-figure keyboard focus sustain complete gestures without restarting them. Leaving completes the gesture and restores the exact source pose. Touch uses entry only; reduced motion leaves all supplied parts still. Incoming/offscreen figures do not run hidden loops. The supplied lower body contains both legs in one path; no separate limb artwork was invented. `Menu_TPR.pdf` supplies the original pink/blue menu background and five outlined icons. The menu uses its centered About/Rooms/Vivi/World grouping and source typography; only configured Italian destinations are offered.

The approved TM header/menu logo and original `assets/brand/Logotype_blue.svg` remain in use. The Home/About body wordmark uses the original PDF letter paths; CSS clips the source registered-mark area and positions the approved TM artwork. Neither source SVG's paths were rewritten. Detailed provenance and remaining slots are in [asset-status.json](asset-status.json), [asset-files.json](asset-files.json), [figma-slots.json](figma-slots.json) and [page-decorations.json](page-decorations.json).

Shared templates implement the six main pages and five room routes, with native menus, room/discovery selectors, carousels, forms, keyboard navigation and focus handling. Source text, source photo crops, original paper edges and navigation artwork have been reconciled with the desktop references.

## Geometry and mobile

Home reuses the original `shared-elevator.js` controller and unchanged
`shared-elevator.css` motion/geometry. Its fixed masked photograph crossfades
while separate copy/background cars lift over 1250ms. Desktop Explore opens the
real 6864×1904 panorama at39% over720ms; native vertical scrolling drives the
image/card track at the original1.2 factor, reverses out above or hands off to
the next Room. The final panorama releases to the following page. At720px and
below the original expanding/flipping mobile cards replace the desktop panorama.

Home supplies configuration for source-backed replacement art, SVG figures,
titles, paragraphs and individual card photographs. All five Room photographs
use their exact source alpha clips without applying the old eye mask a second
time. The mobile lower fade takes the destination palette as soon as selection
starts; settled Room identity and lift timing remain unchanged. Complete source
fallback panoramas remain available until all separate fronts and cardless
backgrounds decode. A scoped bridge supplies
original font/CTA dependencies, normal-motion photo visibility, inert incoming
copies and updated Figma desktop copy metrics/position. Long updated copy can
scroll within its text slot with a14px minimum on mobile; motion is unchanged.
Legacy routes without configuration keep their original content and fit rules.

The table below records the static source dimensions before restoring this
scroll travel, rather than the new full Home document height.

At 1512px wide, the six main page heights match the supplied PDF canvases after removing the 30px mock macOS menu bar:

| Route | Height |
| --- | ---: |
| `/homepage-tpr/` | 8523px |
| `/about/` | 4444px |
| `/contatti/` | 1670px |
| `/eventi/` | 2806px |
| `/vivi-tpr/` | 4036px |
| `/prenota/` | 1750px |

Height matching verifies page geometry; it does not establish a complete pixel-perfect match. The latest six-page desktop/393px capture records no script errors, failed local images or document-wide horizontal overflow. Evidence is under `/workspace/tpr-redesign-audit/pdf-comparison/`.

Mobile refinements address wordmark spacing, card/media clipping, wrapping partner logos and narrow forms. The subsequent [Home hero review](HERO-REVIEW-2026-10-31.md) records actual Figma browser inspection of the393px Mobile Article: the hero ends at326px, with a36px/32.4px title and77.33px header. Home now follows those measurements and reuses the complete source photo/eye composition proportionally. Its exact mobile Vector image crop remains unavailable; other updated mobile frames remain unverified. Responsive zigzag controls and paper frames passed65 route/viewport checks at320,393,430,768 and1512px, including focus, dynamic About controls and post-submit redraw. The original source paper contours apply at their nominal desktop sizes; mobile controls retain a consistent CSS-pixel wavelength.

## Motion, interaction and reference limits

All five Home and standalone Room intros now use their definitive source artwork. All card windows and the Longevity/Studio audio illustrations are available. The original Room photo, lift and vertical-to-horizontal panorama travel remain in place, with a bottom-right Skip control. Separate complete card faces rotate together under one perspective; source paper/photos rotate with the back, with no static duplicate card behind. Native back text, links, focus, Escape and reduced-motion behavior remain owned by the existing controllers.

Hero and Events photographs move inside stationary original alpha masks. Their original composite remains pixel-identical at zero offset and is retained for reduced motion/loading failure. About discovery uses the original coming-soon float while native hit targets remain fixed and centered. Offers and Event cards support native touch/keyboard scrolling, desktop dragging and visible previous/next controls. Automatic/infinite Event scrolling was optional and is not enabled. The original star/eye cursor is restored for fine pointers; text inputs retain their caret.

The 14 card backs' text and typography were verified against live Figma. The revised physical card turn follows the approved brief, but its exact duration/easing is an implementation choice because the approved prototype video was unavailable. Home's inspected mobile Article supplies hero measurements; other updated mobile views remain responsive adaptations rather than a verified complete pixel-for-pixel mobile source match.

## Forms and booking

The community form calls the existing newsletter endpoint with email, explicit consent and honeypot. The unchanged server enforces Brevo list 2 and `FONTE=Landing`; no API key is present in the browser. Its button is enabled and blue after valid email and checked consent. Success appears only after a successful response; the production endpoint must permit the preview origin.

All four Home/Vivi offers open native contact dialogs with their selected offer. The All Inclusive/Flex 8/virtual-office geometry follows the adjacent Figma popup templates; Day Pass reuses that template with its own label. Contact, company and event forms submit directly to `/api/inquiry`. The server reuses the existing opaque Brevo binding, chooses an active verified TPR sender and fixes the recipient to `hello@thepeoplesroom.it`. The visitor is the validated reply-to. Origin, payload, honeypot and rate checks run before provider access. Success appears only after provider acceptance; errors preserve the entered values for retry. Day Pass payment/checkout is not configured.

The Pilates page contains the user-supplied Mindbody Schedules widget `4581434fffc`. Updated Home Move, standalone Move, the Home Pilates banner and header booking links lead to `/prenota/`. Its paper panel grows with the provider's automatically sized iframe, preserving the original minimum dimensions without clipping class listings.

## Checks

The validation record covers all 11 canonical routes, menu focus/Escape, room selection/exploration, discovery and keyboard carousels, newsletter validity/failure/success, and direct inquiries. Inquiry checks exercise payload validation, sender selection, provider rejection/redirects, native Worker requests and browser pending/error/retry/acknowledgement states with mocked provider activity. No real email, newsletter subscription or booking is sent by the tests. Source geometry, screenshots and the remaining reference limits define what has actually been verified; responsive checks alone do not establish a complete 1:1 match.
