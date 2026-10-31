# Versione Aggiornata implementation

The recovered-session responsive fixes and their reproducible checks are
recorded in [the 31 October responsive review](RESPONSIVE-QA-2026-10-31.md).
This does not close the remaining exact-artwork and mobile-reference gaps below.

This branch updates the native HTML/CSS/JavaScript preview. Production `thepeoplesroom.it`, Cloudflare bindings and server credentials are unchanged.

## Source assets and implementation

The supplied Figma PDFs now provide 15 unique embedded JPEGs, four partner logos, original decorative vectors and paper/control outlines, plus the Home hero, event and Coworking photo/eye compositions. Available offer, company, event, map and About-card photos are wired into native components. JPEG bytes and dimensions were preserved; extracted SVG paths were retained. The three main compositions were isolated from original static PDF operators and encoded as lossless WebP with identical decoded RGBA. Whole-screen renders are used only for review.

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

Only Home supplies configuration for source-backed replacement art, SVG figures,
titles, paragraphs and card labels. Existing wide panoramas and unmatched floor
composites remain aligned with their original photo mask and embedded card
windows until matching updated originals are available. A scoped bridge supplies
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

Mobile refinements address hero photo proportions and blue header corners using the original eye mask, wordmark spacing, card/media clipping, wrapping partner logos and narrow forms. Updated mobile frames were not supplied, so mobile remains a responsive adaptation. Responsive zigzag controls and paper frames passed 65 route/viewport checks at 320, 393, 430, 768 and 1512px, including focus, dynamic About controls and post-submit redraw. The original source paper contours apply at their nominal desktop sizes; the mobile controls retain a consistent CSS-pixel wavelength.

## Remaining source gaps

Seventeen updated room photo roles remain unavailable: five standalone `picture` roles plus twelve card photos. The shared template does not currently render the five `picture` roles; the twelve missing card photos retain empty media areas. The missing roles by room are:

- Coworking: picture, postazioni, sale riunioni.
- Move (`/rooms/reformer/`): picture, studio, classi, attrezzature.
- Recharge (`/rooms/wellness/`): picture, gym, contrast therapy.
- Fuel (`/rooms/bar/`): picture, servizi, accessibilità, storage.
- Media: picture, podcast, set fotografico.

The Coworking event card uses the exact supplied Dinner photo. Recharge longevity and Media studio audio also lack their exact source illustrations; native coming-soon labels are present. These are two illustration gaps, separate from the seventeen photos.

Move, Recharge, Fuel and Media still use legacy left photo/eye stage artwork. Their original right-side vector decorations were recovered, but the Home PDF does not retain their four updated left photo compositions. The repeated right-vector identities and generic Home `image74` photo do not establish a valid replacement. Standalone room exports are required. Exact prototype motion and card-back states also remain unverified.

## Forms and booking

The community form calls the existing newsletter endpoint with email, explicit consent and honeypot. The unchanged server enforces Brevo list 2 and `FONTE=Landing`; no API key is present in the browser. Its button is enabled and blue after valid email and checked consent. Success appears only after a successful response; the production endpoint must permit the preview origin.

Enquiries prepare a message in the visitor's email application at `hello@thepeoplesroom.it`; they do not claim delivery. Day Pass checkout/payment and direct server enquiry delivery are not configured. Offer actions lead to an enquiry with the selected offer. The Pilates booking area is empty in the supplied PDF and remains empty until a provider/embed URL is supplied.

## Checks

The existing validation record covers all 11 canonical routes, menu focus/Escape, room selection/exploration, discovery and keyboard carousels, newsletter validity/failure/success, and enquiry handoff. Form tests intercepted responses and mailto navigation; no test email or contact was sent. The newsletter server/Cloudflare suite previously passed 15 tests. Current desktop/mobile comparison evidence and the remaining source gaps above define the review limits; this preview is not claimed as a completed 1:1 match.
