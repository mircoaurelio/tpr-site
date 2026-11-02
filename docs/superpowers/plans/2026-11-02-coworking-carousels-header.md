# Coworking links, source carousels and scroll-up header

> Execution: implement in this existing isolated preview branch, with focused regressions and an independent final code review. The user explicitly requested the changes and online publication; no additional design approval is required.

**Goal:** Coworking access CTAs reach Vivi TPR offers, photographic/offer carousels match the supplied Figma edge treatment, and the original header becomes available when scrolling upward.

**Architecture:** Keep the native generator, Room controller and source assets. Restore full-width native carousel tracks in the existing carousel module, add a small isolated header module, and preserve inquiry/Mindbody behavior. Use the attached Events reference and existing original Home/Vivi/Events exports. No original image bytes change.

**Spec:** User message of2 November2026 and its two attached screenshots; baseline source `1d3a96f`. Earlier pending Gym request has no new source photo yet: the freshly exported Recharge card is pixel-identical to the deployed original.

## Constraints and review focus

- Preserve Room lift/panorama, Skip, card rotation, photo masks, source glyphs and reviewed copy.
- Coworking access/booking actions go to `vivi-tpr/#offerte`; Room exploration and event-specific links keep their distinct native behavior. Offer inquiry dialogs remain operational, and Move still opens Mindbody.
- Clip carousel content only at viewport edges, preserving top/bottom paper bleed and intrinsic card heights. No document-wide horizontal overflow or visible scrollbars.
- Preserve keyboard, native touch, horizontal wheel/Shift-wheel and mouse drag. Ordinary vertical wheel continues moving the page. No visible invented “Scorri”/arrow row.
- Desktop source positions: Home offers start; Vivi offers end; Events center. Mobile starts with its first card. Do not reset position after user interaction.
- Scroll-up header keeps original top-of-page composition, native menu/focus and reduced-motion support; floating blue background is an implementation choice for contrast.
- Check actual public Home metadata and legacy landing redirects. A stale search index is distinct from current HTML, and remote recrawl cannot be claimed without a successful Search Console action.
- No real email, newsletter subscription or booking in tests. Keep existing Cloudflare secrets/privacy/newsletter configuration.

## Task1 — Coworking navigation

Files: `shared-elevator.js`, `scripts/build_updated_preview.py`, generated Home/Coworking; focused browser coverage in `tests/coworking-offers-regression.mjs` and existing card-action tests.

- [x] Pin Home desktop/mobile booking and Postazioni/Sale riunioni access to `/vivi-tpr/#offerte`, covering pointer/touch/keyboard and project-prefix mounts.
- [x] Preserve event CTAs, Explore interaction, offer-dialog forms and all Move booking destinations.
- [x] Implement only the Coworking-specific destination changes; regenerate pages.

## Task2 — Figma carousel presentation

Files: generator `carousel()`, `updated-carousels.css/js`, existing `updated-preview.js` initial-scroll ownership, `tests/offer-event-carousels-regression.mjs`.

- [x] Reproduce inner-container clipping, added visible controls and source-position differences before the correction.
- [x] Remove visible control markup; retain labelled focusable native regions. Extend the wrapper to viewport width with symmetric content-grid insets and protect original paper bleed.
- [x] Own initial positioning once in the carousel module, stopping auto-placement after intent. Preserve drag/click suppression, native touch and vertical wheel.
- [x] Verify every card is reachable, track bounds equal viewport at320/393/900/1280/1512/1920px, all paper heights fit, and no page overflow appears in Chromium/WebKit.

## Task3 — Scroll-up header

Files: new `updated-header.css/js`, generator head imports, packaging allowlist, `tests/header-scroll-regression.mjs`.

- [x] Write meaningful regressions for top source composition, reveal on upward scroll, hide on downward scroll, jitter threshold, focus/menu/Escape and reduced motion on desktop/mobile.
- [x] Implement a passive rAF scroll observer with explicit native/floating/hidden states, preserving the original top header and native menu ownership.
- [x] Verify carousel-only scrolling does not alter header state, and menu/focus behavior remains usable after Room/anchor navigation.

## Task4 — Coming-soon diagnosis and release

- [x] Verify current Home and Coworking metadata/visible copy on both production domains. Search lookup currently returns a two-week-old Coming-soon Home; use official Google recrawl guidance and report its limits accurately.
- [x] Inspect known legacy landing redirects and apply permanent launch consolidation if needed, with the relevant Worker tests.
- [x] Run affected navigation/carousel/header/viewport/menu and backend/build checks; obtain independent review and resolve material findings.
- [ ] Build with enabled newsletter and existing privacy URL; deploy with keep-vars. Compare published files and real read-only user paths, save desktop/mobile screenshots, commit and push.
