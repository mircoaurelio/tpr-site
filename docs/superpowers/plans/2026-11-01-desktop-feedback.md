# TPR desktop feedback implementation plan

> **For agentic workers:** implement the user's approved checklist with independent source audits, focused regressions and final independent review. Preserve the current production baseline until the corrected bundle is verified.

**Goal:** Resolve the colleague's desktop feedback across imagery, motion, Room cards, offers, About, Events, menu and cursor, preserving the recently corrected mobile viewport and Pilates booking.

**Architecture:** Keep the static HTML generator and existing Room controller. Restore reusable original behavior through isolated shared modules, use original Figma source assets, and add a server-only contact adapter to the existing Cloudflare Worker. Do not substitute traced artwork for the supplied separated vectors.

**Tech stack:** Native HTML/CSS/JavaScript, Python generator, Playwright Chromium/WebKit, Cloudflare Workers, existing Brevo secret binding.

**Source:** User's point-by-point desktop brief and screenshot of `SVGs`/`Separato`/`Originale`; live Figma file `FpPfXalg4PRyqtnvwt2DUL`, updated section `616:2194`, SVG section `617:3900`. User confirms characters are in Figma and authorizes reusing existing form-service credentials.

## Constraints

- Preserve the original Room elevator/photo/panorama scroll effect while adding missing controls and depth.
- Retain the mobile `100dvh` correction, all reviewed copy and working Mindbody links.
- Export original images/vectors; screenshots are comparison evidence, not replacement implementation assets.
- Never publish credentials or logs. Keep the existing Cloudflare newsletter bindings and list/source behavior.
- Do not send real test email, make bookings, or subscribe test contacts.
- Only claim full Figma fidelity for source artwork and states actually obtained and checked.

## Checklist and ownership

- [x] Definitive Room imagery: all five complete source PDFs and two cropped variants recovered through authenticated UI. The importer verifies original JPEG bytes, exact alpha clips, fifteen source fronts, cardless/fallback panoramas and provenance. Home and standalone intros use definitive source art; mobile cards receive individual source windows. Independent desktop/mobile visual review confirms all five Rooms.
- [x] Separated characters: original `SVGs.svg` export from section `617:3900`, six cropped rigs and byte-identical source/provenance in `assets/figma-updated/characters/`. Actual upper-body/torso-legs/emblem groups animate continuously; updated routes disable the old traced `.person` motion. Six Chromium/WebKit tests verify exact source paths, colors, loop/hover continuity, hydration order and reduced motion.
- [x] Masked-image depth: `updated-parallax.css/js` keeps Home Hero/Eventi source-alpha masks stationary while moving their original raw photographs, with exact rest/reduced-motion fallback. Room photos retain their separate native fixed-photo/crossfade plane and original vertical-to-horizontal panorama travel. Their source alpha avoids legacy double-clipping; all source Room masks and source photos are reconciled.
- [x] Real two-face card rotation: complete original fronts and native backs rotate together under one perspective. The source install waits for every required asset and any held pointer; it preserves native focus, click, links, inert state and Escape. Source failures retain the complete fallback panorama. Eleven Chromium checks pass, with the corresponding WebKit source and loading-race checks also passing.
- [x] Card back typography/grouping: source frame `616:3793`560x434/padding24; title PP Rader600/48px/100%/tracking0, body Haas400/24px/100%/tracking0. Heading/body top group, bottom CTA512x32. `updated-refinements.css/js`, focused tests green in Chromium/WebKit.
- [x] Elevator Skip: `shared-elevator.js`, `updated-motion.css`; cancels transition/explore work and focuses the next section; focused checks green.
- [x] Destination photo gradient: a separate photo-room palette updates at Room selection start; settled `activeRoom`, fixed photo geometry and original1250ms lift remain intact. Both engines/all five transitions, mobile viewport, booking and original lift checks passed. Public verification exposed a separate cold CSS-mask fetch: mask image preloads now use the same anonymous CORS mode before `src` assignment. A controlled regression fails on the previous runtime and passes on the correction without changing source masks or paint thresholds.
- [x] Offers and Events scrolling: `updated-carousels.css/js`, generator controls, first-card start, arrows/drag/native touch/keyboard. Optional automatic/infinite loop omitted in favor of complete manual reachability. Six focused tests green.
- [x] Offer contact pop-ups: native offer-specific dialogs on Home/Vivi preserve selected offer and use the direct inquiry endpoint. Source AI frame `1068:2675` is recorded; selected-offer context, focus/Escape, pending/error/success and mobile paper controls have focused browser coverage. Provider calls remain mocked during testing.
- [x] Hover/focus for text controls: scoped presentation module; icon and card-open geometry preserved.
- [x] About discovery float, centered CTA and unobstructed hit targets: `updated-refinements.css/js`; reuse coming-soon movement on painted faces while button targets stay stable. Native contour resize integration checks pass after preserving source target dimensions while exposing content-box height changes to ResizeObserver.
- [x] Menu: original `Menu_TPR.pdf` vectors now supply the background and five complete outlined icons. Native centered About/Rooms/Vivi/World grouping, source80px typography and measured glyph baseline, small blue logo and opening hours are implemented. DOM and visual icon order both follow Coworking/Recharge/Media/Move/Fuel; the Room elevator order stays unchanged. Portrait cropping preserves blue-logo legibility; short screens keep native vertical scrolling. No unconfigured language or invented World destination is offered. Source geometry passed eight Chromium/WebKit cases and native keyboard/Escape passed nine WebKit cases. Thin outlined icon colors are checked against their white/blue antialias blend, preserving the stricter solid-character checks.
- [x] Original cursor: isolated exact star/eye assets and original behavior; fine pointer only, normal caret for inputs and dialog/menu layering; focused tests green.
- [x] Direct inquiry server: `server/inquiry.mjs` + Worker `/api/inquiry`; existing opaque Brevo binding, verified active brand sender, fixed recipient `hello@thepeoplesroom.it`, validated reply-to, strict payload/origin/rate limits, escaped HTML and plain text;26 backend tests green with all provider activity mocked.

## Integration and release

- [x] Register new runtime files in build-test allowlist and new tests in package scripts. All new modules, including card motion and its explicit public manifest, are wired. Six packaging checks and all26 backend checks pass.
- [x] Resolve combined-suite failures with source/interaction evidence; keep meaningful background and contour checks. The first combined run passed182/189 checks. All affected files were corrected and rerun together:42/42 pass, covering company paper, all Room actions and Move bookings, original Room effects, root/project asset mounts, cursor and Skip. The image-decode helper retries only actual source changes and still rejects settled corrupt images; the exact paper-edge comparison excludes only independently identified native control contours and detects a real mask-removal mutation.
- [x] Independently review all changes and compare desktop/mobile screenshots, not only resource/overflow counts. A fresh independent reviewer checked the implementation and final race/fixture corrections, plus all five Room intros, expanded source cards, backs and mobile states. No actionable findings remain.
- [x] Build the enabled-newsletter artifact, deploy through dedicated TPR wrapper with `--keep-vars`, record old/new version IDs, verify public files and real read-only user paths.

## Release verification

- Production rollback baseline: `9ea698b3-fed5-4509-91bd-4290038c85b0`.
- Definitive asset/checklist deployment: `8ec5041a-58c1-4d55-9fbe-0ba5e1afa482`.
- Final mask-cache correction deployment: `c0ba7768-b168-4ce4-9a1d-348af7a40d9d`.
- Final public artifact:11 pages plus root Home,10 aliases,374 public assets,431 files,180955852 bytes; newsletter enabled with the existing approved privacy URL and opaque provider binding.
- Public smoke compares46 canonical/discovery/runtime files and the Room manifest byte-for-byte against the artifact, checks320/393/1512px Home without overflow or image errors, and validates newsletter/inquiry preflights. Empty inquiry JSON is rejected400 before provider access; no valid inquiry was submitted.
- Public user paths: eight source Menu cases pass across both engines/portrait/short landscape; all Move card booking links pass pointer/touch and keyboard checks in both engines. Both bare and www domains serve the approved artifact. Desktop1512px and mobile393px Room/Menu screenshots were inspected.
- Final public gradient file:4/4 pass in Chromium/WebKit, including controlled first-use CSS cache checks and actual painted-edge checks for all five destination colors during the unchanged lift. The independent reviewer found no issue in the request-mode correction or its regression.
- Main source commit: `68e19c0`; GitHub Pages built that commit successfully. The final mask correction is saved as a follow-up commit on the same preview branch.

## Current source facts and limits

The Figma MCP View-seat quota blocks API export; authenticated IAB export recovered the exact character section as `SVGs.svg` (109031 bytes). Its SHA256 is `23504a4a42dec5e1dff0ef42f6e79d4e0b50d1ac7dd8f737ce97e90eaa37818e`. Every white `Separato` path command is retained; the supplied torso/legs are one original part, not invented individual leg vectors. The original blue column remains in the provenance source.

The existing production Brevo binding was checked through a private authenticated read-only edge preview: the sender API returned200 and an active verified TPR sender was available. No SMTP message, newsletter contact or booking was submitted. Provider acceptance and failure behavior are covered by mocked backend tests.

Authenticated source recovery produced all five base Room exports and two inside exports. All source assets and the explicit `design/room-card-faces.json` manifest are bound to generated pages; exact union masks prevent a second legacy clip. The August TPR bundle remains older evidence and does not replace these definitive updated sources. Exact approved card-turn timing/video and uninspected updated mobile frames remain reference limits; no additional source artwork is invented.

## Follow-up: single cursor and reactive inquiry forms

The user reported seeing both cursor artworks and requested responsive/reactive forms, publication and a forwardable summary. The existing page-wide `.updated-preview img` reset outranked the eye's default hidden rule. A browser regression reproduced both artworks at rest in Chromium and WebKit; scoping the eye rule under `.tpr-cursor` restores exactly one artwork while preserving the stronger action rule, native text caret, touch behavior and top-layer positioning. All10 cursor/Skip checks pass.

The form audit found browser/server validation mismatches and a partially clipped initially focused select in very short Chromium popups. The shared inquiry controller now validates normalized name/email/phone/message values immediately and before submission, sets existing server length caps, clears corrected errors and focuses the visible close control when the first field would be clipped. Original paper artwork and layout CSS are unchanged. Eight inquiry groups pass, including192 layout states across both engines and four widths with portrait/short heights. Pending feedback, duplicate suppression, strict acknowledgement, failure/timeout/data retention/retry and all offer/Room contexts are covered. Backend26/26 and packaging6/6 pass; independent review has no open findings.

The actual production backend was also exercised in an isolated authenticated edge preview using its opaque existing Brevo secret. A fail-closed test-only fetch adapter forced the documented JSON `headers: {"X-Sib-Sandbox":"drop"}` on the sole transactional request. Actual result: sender GET200, sandbox POST201, backend200/`success:true`. No email or email log was created under the provider's sandbox contract; this validates integration/request format, not mailbox delivery or all account send permissions. Two probe safety tests passed. The private preview was stopped and both listener ports were verified closed. The sandbox adapter/config remain ignored QA files and are never deployed with the public site. [Brevo sandbox documentation](https://developers.brevo.com/docs/using-sandbox-mode)

Cache version `20261101-cursor-forms-2` is generated across all eleven pages. Production version `e2c06235-77d7-4bc6-9244-6ecd3b86bc24` replaces `c0ba7768-b168-4ce4-9a1d-348af7a40d9d` with the newsletter/privacy configuration and opaque bindings preserved. Fresh public verification matches46 files to the artifact and checks320/393/1512px Home. Additional production-browser checks pass at393/1512px in both engines for single cursor/native touch, immediate validation, pending/double-submit lock, failure retention/retry and acknowledged success; both engines also pass the320×300 initial-focus case. Browser submit requests in these checks were intercepted. Live mobile/desktop form screenshots were inspected.

## Follow-up: Room entry and hover character motion

The separated source figures now play a finite welcome gesture when entering view, including each settled Room and reentry. Fine-pointer hover or focus on the linked introductory figures sustains complete gestures without restarting their phase. Leaving finishes the gesture smoothly at the exact source pose. Touch has entry motion without sticky hover; live reduced-motion changes cancel the supplied parts to their original still pose. Native Web Animations animate only the supplied groups and original joint pivots; SVG paths, palettes and source artwork are unchanged.

Three real integration defects were fixed: the transparent incoming actor intercepted current-figure hover; late source hydration used the pending destination instead of the settled outgoing Room; and cancelling an articulated gesture at lift start visibly snapped the still-opaque actor to neutral. The outgoing figure now pauses at its sampled pose during the existing native fade, then is disposed. Offscreen, hidden-document, reduced-motion and Skip cleanup still cancel correctly. No Room lift/panorama timings or geometry changed.

Validation: the complete inherited UI suite ran against an isolated frozen copy of commit `3861c6f`:197/197 pass. The final motion implementation has14/14 Chromium/WebKit checks, plus6/6 affected Skip checks after the pose-hold refinement. Root integration checks for all Room card actions/Pilates links, original scroll/panorama, mobile viewport and cursor passed33/33. A fresh independent reviewer inspected all five joints at motion extrema and verified hydration, rapid changes, hover, reduced motion, exact first-visible fade frames and cleanup in both engines; no findings remain. The temporary baseline copy/server were removed after completion, retaining its full test log.

Production version `d620004a-5f95-4d6d-ae74-a02dcc449125` replaces `e2c06235-77d7-4bc6-9244-6ecd3b86bc24`; all eleven generated pages use cache version `20261101-room-motion-3`. Fresh public checks compare46 files to the enabled-newsletter artifact, verify320/393/1512px Home and exercise actual entry/hover/rest/touch/reduced-motion behavior at1512/393px in Chromium and WebKit. Actual public hover and mobile screenshots were inspected. No form or booking was submitted during these motion checks.

## Follow-up: source Skip style and Ceramic Workshop credit

The Home export616:1707 shows a white irregular circle/double chevron for Skip,
not the later white text pill. The configured Home now reuses the existing
original `room-next-circle-painted.svg`, preserving its native51.8466×53.6008px
painted bounds inside the source48px tap frame. Desktop placement follows the
Room navigator's80px baseline at1512×952. The native button retains the accessible
name “Salta le stanze”, focus, keyboard and cancellation behavior. Mobile reserves
four extra pixels above the separate48px tap row so the artwork clears the navigator.

Dynamic-height testing exposed WebKit focus-scrolling the hidden Room frame by
602px after expanding and resizing430px mobile. Its outer viewport remained
correct while all inner controls shifted. Mobile `overflow:clip` prevents this
unintended canvas scrolling; the nested card strip keeps native scrolling.
The viewport tests now check both canvas scroll offsets and the complete Skip
artwork bounds, alongside the original painted-viewport checks. The nearby-control
band is104px rather than100px because the source tap frame replaces a44px pill.
Final checks: viewport4/4, Skip6/6, native card-strip/panorama scroll1/1; the gallery
reachability group also passes across both engines and desktop/mobile widths.

User clarification restores the complete Ceramic Workshop card and “Ottobre2026”
date; only its incorrect `@casa_buri` attribution is removed. The Dinner retains
its credit. Production version `313c5f4f-74f3-4323-9b7c-24e3a99d85a1` publishes
both changes with cache version `20261101-skip-source-5`. The Figma MCP quota
remains exhausted; the style comparison uses the existing original Home export
and original SVG rather than claiming a new live design-context response.
