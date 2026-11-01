# Mobile Room viewport correction

> **For agentic workers:** Use superpowers:executing-plans to implement this task. Steps use checkbox syntax for tracking.

**Goal:** Remove the exposed previous Room color below the Room during iPhone scrolling.

**Architecture:** Keep the original Room controller and desktop scroll geometry. Change only the updated Home mobile sticky layer to use the dynamic viewport height. Its existing frame, shade, content and navigator follow that height.

**Tech Stack:** Native CSS/JavaScript, Playwright Chromium/WebKit, existing Cloudflare Worker.

**Spec:** User's iPhone screenshot and confirmation that the band disappears after scrolling stops. Existing mobile source geometry is documented in `design/HERO-REVIEW-2026-10-31.md`.

## Global constraints

- Preserve the original 1250ms Room lift, fixed photo plane and desktop panorama scroll.
- Preserve reviewed Figma fonts, copy, source assets, native card links and Mindbody widget.
- Do not submit a booking, subscription or contact form during verification.
- Preserve production newsletter bindings/secrets; deploy via the dedicated TPR wrapper with `--keep-vars`.

## Review focus

- Safari toolbar retracts while `svh` stays fixed: moving Room covers the visible viewport.
- Toolbar expands again: navigator and cards stay within the viewport.
- 320/393/430px phones: all five Room shades cover the viewport, no document overflow.
- Desktop: the original motion and panorama dimensions remain unchanged.
- Legacy Home: the updated-Home override does not change the older route.

### Task 1: Correct the mobile sticky viewport

**Files:** Modify `updated-elevator.css`, `package.json`; test `tests/mobile-room-viewport-regression.mjs`; record evidence in `design/MOBILE-VIEWPORT-REVIEW-2026-11-01.md`.

**Interface:** Existing `.updated-preview .tpr-elevator__sticky` at `max-width:720px`; no JavaScript interface changes.

- [x] Reproduce the issue before changing production code. Freeze only CSS `svh` lengths at 664px while the visible viewport grows to 852px. WebKit paints the reported blue band during the lift; the viewport test fails with a 664px shade against an 852px window.
- [x] Set the updated Home mobile sticky height to `100dvh`, with `100vh` fallback. Do not alter shared legacy styles/controller.
- [x] Run the four viewport tests on Chromium/WebKit, the source mobile-hero checks, original Room effect checks, and mobile card navigation checks. Review screenshots during motion. All 29 checks passed.
- [x] Request independent review of the scoped change and test model. No blocking findings; independent scroll-triggered forward/reverse and mid-lift shrink checks passed. Added the new regression file to `test:ui` as requested by review.
- [x] Commit, publish to the existing production Worker, verify public files and the targeted mobile checks; retain deployment version for rollback. Public 4/4 viewport tests and 30-file smoke check passed; active version is recorded in the review.
