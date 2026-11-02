# Figma, SEO and loading review — 1 November 2026

This review starts from source commit `cea685f`, following the production release with finite entry/hover character gestures. It combines an independent Figma review, the `seo-audit` and `schema` skills, a complete regression run, and a separate code review. Detailed findings are in [FIGMA-FULL-AUDIT-2026-11-01.md](FIGMA-FULL-AUDIT-2026-11-01.md) and [SEO-AUDIT-2026-11-01.md](SEO-AUDIT-2026-11-01.md).

## Changes

- Standalone photo-card front arrows now use the original Figma/PDF circular arrow silhouette in the native Room palette.
- WebKit card faces are culled according to their actual animated angle. This fixes mirrored back text during the rigid turn, including the native desktop fallback if source assets fail. The physical turn, focus/inert handling, reduced motion and original artwork remain covered by tests.
- All eleven production pages have specific search titles and descriptions, canonical URLs and Open Graph metadata. Home has WebSite structured data; Contacts has LocalBusiness data derived from the visible public address and opening hours.
- Native HTTP 301 rules consolidate 54 old paths and URL variants, preserving query strings and target anchors. Home links point to the canonical root. Production remains indexable; the public GitHub design preview emits noindex.
- Home defers unused panorama/card images and belowfold photographs. Cold Explore waits for the real image decode before starting the existing transition; Skip, Escape and changing Rooms cancel stale pending actions. All five tiny CSS masks remain preloaded in the correct CORS mode so the destination gradient can paint immediately.

No original image/font bytes were compressed or replaced. The existing Room timings, native mobile card layout, zero-scroll photo composition, Mindbody booking widget and inquiry/newsletter backend are preserved. No real subscription, email or booking was submitted for this review.

## Verification record

- Fresh backend suite: 26/26 passed with provider calls mocked.
- Fresh production-build suite: 9/9 passed, including the real static router's 54 redirect variants.
- Fresh Python suite: 6/6 passed, including generator and original asset importer.
- Artifact SEO audit: eleven canonical pages and sitemap coherent.
- Cloudflare dry run passed with existing bindings and keep-vars configuration.
- Complete UI suite: 227 tests executed, 226 passed on the first final run. The remaining WebKit gesture test failed its precondition because it sampled the expected selection peak after the native two-frame lift arming. Diagnostic capture reproduced the issue, showing a real peak at click and an exactly held subsequent fade. Only fixture synchronization was changed: the actual click peak is checked separately from the final pre-lift pose, with all matrix tolerances, paused-state and animation-time checks retained. The targeted WebKit case passed five consecutive repetitions; its complete 14-test Chromium/WebKit file then passed. All 227 distinct UI checks are verified; this is not reported as a single uninterrupted 227/227 run. An earlier frozen-baseline navigation timeout is retained in its log, not concealed as a baseline pass.

## Published release and public checks

- Source: `b0af3af98886493c566ffafd7a48d998750e34c0`, pushed to the existing preview branch.
- Production Worker version: `ce75f6d8-7d5b-44bd-bbe0-775920ffbec3`, deployed on both existing custom domains with the current secrets and variables preserved. Previous production version `d620004a-5f95-4d6d-ae74-a02dcc449125` remains available for rollback.
- Bundle: 11 canonical pages plus root Home, 10 aliases, 374 original public assets; 432 files, 180,982,287 bytes. Native routing directives are not public downloadable assets.
- Public artifact verification: 45 page/runtime/discovery files match the release artifact by SHA-256. Home at 320, 393 and 1512px has no document overflow, failed required images, JavaScript exceptions or failed local resources; belowfold event/offer images are also visited and decoded. API preflights are correct, empty inquiry input returns 400, unknown API and nonexistent page return 404, coming-soon retains its 302.
- Public rendered SEO crawl: 11 HTTP 200 canonical pages, 11 unique titles and descriptions, index/follow, one H1 each, no missing alt attributes, zero JavaScript errors. All 54 native redirect variants preserve query and destination anchors; 29 internal targets return 200. HTTP redirects to HTTPS, and the canonical sitemap contains exactly 11 URLs.
- GitHub Pages built commit `b0af3af`; all 14 checked preview pages emit noindex, and the obsolete preview sitemap returns 404. The published source files also match the repository.
- Further public browser checks passed in Chromium and WebKit at 393/1512px: one cursor artwork, native touch cursor behavior, inline field validation, pending state, duplicate suppression, error/retry and strict acknowledgement. A 320×300px short dialog keeps the focused field visible. All form POSTs in this browser exercise were intercepted locally. Public character entry, sustained desktop hover, exact return to rest, touch without sticky hover, reduced motion and original Move yellow also passed on both engines.
- External Google/Schema.org validator UI could not run because Computer Use could not verify Chrome's current URL. This is documented in the SEO audit, separately from the successful public DOM/schema checks.

Private evidence stays in ignored `.qa/seo-figma-*`, `.qa/seo/`, `.qa/hover-peak-*`, the Figma screenshot folders, and the original full-suite log. Temporary frozen-baseline server/copy were stopped and removed; the user's source preview was left running.

## Loading measurement

A single before/after Chromium laboratory comparison used the same public URL and desktop/mobile viewports, without scrolling, and blocked non-read/external requests. On the unthrottled connection the initial completed transfers fell from 35.90 to 9.87 MB on desktop and 26.10 to 8.97 MB on mobile. Layout-shift session score was zero in each measured run. These are laboratory observations, not field Core Web Vitals or guaranteed timings.

The original hero remains 2.32 MB. With the deliberately constrained 1.6 Mbps / 150ms mobile profile, the after-run hero completed with a measured LCP of 43.97 seconds; the before-run hero had not loaded at the 45-second deadline and its provisional wordmark LCP is not a valid hero comparison. There is therefore no claim that slow-network LCP is solved. Further responsive image-size work remains an explicit performance opportunity; this release preserves exact source image bytes and focuses on eliminating unused early downloads. Source-versus-build screenshots and settled layout geometry remain exact at desktop/mobile sizes.

## Limits

The audit does not establish equality to unavailable mobile frames or the unavailable approved animation video. Chromium and WebKit on Windows are not physical iPhone certification. Search Console, Google Business Profile, rankings, analytics and field Core Web Vitals were not available; no ranking or traffic improvement is claimed. Original multi-megabyte hero/event photos remain an image-size opportunity beyond scheduling improvements. Existing inquiry delivery remains Cloudflare Worker plus Brevo to hello@thepeoplesroom.it; the earlier separately authorized real-delivery check is not repeated or counted as a new delivery in this release. The operational email list remains https://app.brevo.com/transactional/email/logs.
