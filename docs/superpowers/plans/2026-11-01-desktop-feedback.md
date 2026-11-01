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
- [x] Destination photo gradient: a separate photo-room palette updates at Room selection start; settled `activeRoom`, fixed photo geometry and original1250ms lift remain intact. Both engines/all five transitions, mobile viewport, booking and original lift checks passed.
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
- [ ] Build the enabled-newsletter artifact, deploy through dedicated TPR wrapper with `--keep-vars`, record old/new version IDs, verify public files and real read-only user paths.

## Current source facts and limits

The Figma MCP View-seat quota blocks API export; authenticated IAB export recovered the exact character section as `SVGs.svg` (109031 bytes). Its SHA256 is `23504a4a42dec5e1dff0ef42f6e79d4e0b50d1ac7dd8f737ce97e90eaa37818e`. Every white `Separato` path command is retained; the supplied torso/legs are one original part, not invented individual leg vectors. The original blue column remains in the provenance source.

The existing production Brevo binding was checked through a private authenticated read-only edge preview: the sender API returned200 and an active verified TPR sender was available. No SMTP message, newsletter contact or booking was submitted. Provider acceptance and failure behavior are covered by mocked backend tests.

Authenticated source recovery produced all five base Room exports and two inside exports. All source assets and the explicit `design/room-card-faces.json` manifest are bound to generated pages; exact union masks prevent a second legacy clip. The August TPR bundle remains older evidence and does not replace these definitive updated sources. Exact approved card-turn timing/video and uninspected updated mobile frames remain reference limits; no additional source artwork is invented.
