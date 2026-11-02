# Production release — 1 November 2026

The complete current site is published at https://thepeoplesroom.it/ and https://www.thepeoplesroom.it/ through the existing Cloudflare Worker `tpr-coming-soon`. Deployment finished at 12:08 UTC (13:08 Europe/Rome).

- Source commit: `ea0483b15b785cbb09c050872635b6fb8f5da00e`.
- Active Worker version, 100% traffic: `d6b394ce-f2cf-48ea-aad7-72366547cb56`.
- Previous production version, retained for rollback: `5526fd51-0b21-4cb1-9759-d549e4a955eb`.
- Artifact: 11 canonical pages plus Home served directly at `/`, 10 intentional aliases, 264 public image/font assets; 305 files, 114,845,230 bytes.
- Newsletter explicitly enabled with the existing Iubenda privacy notice. Existing secret, origin configuration and 30 requests/minute rate limiter retained. No DNS migration or new hosting account.

The downloaded production Worker module before and after deployment is byte-identical (SHA-256 `ed210b571aed804991471349ed033046491ab8ca13007836f31f5f7f4ad441a6`). Only the public asset bundle changed; newsletter handling remains the existing implementation. Authentication uses the dedicated TPR profile and no credential is included in public output.

## Verification

- Newsletter/Worker tests: 15/15 passed with mocked contacts; build tests: 6/6 passed. Wrangler dry run passed.
- Packaged Home checked at 320, 393 and 1512px before deployment. Production checks repeated at those widths on both apex and www: no document-wide horizontal overflow, broken loaded images, JavaScript exceptions or failed local HTTP resources.
- Thirty public files on each domain return HTTP 200 and match the artifact by SHA-256, including all 11 canonical pages, root Home, all shared runtime files and discovery metadata.
- Newsletter OPTIONS preflight returns 204 with the expected origin; unknown API paths return 404. The old `/coming-soon/` path redirects to root. No actual subscription was submitted.
- All three Move cards on Home and the standalone Move page navigate to Pilates with pointer/touch and keyboard activation: Chromium desktop 1512px, Chromium mobile 393px, WebKit mobile 393px. The initial Chromium mobile run exceeded its 6-second navigation limit; an isolated rerun passed all actions (18 seconds total).
- The real Mindbody iframe loaded from a Home card in WebKit at 393px. Its widget ID is `4581434fffc`, the panel accommodates the complete iframe, and the document stays 393px wide. Non-read requests were blocked; no class was booked.
- The public Home was also opened and visually checked in the Codex browser, then retained as the deliverable tab.

Local evidence is in ignored `.qa/production-*.png`, `.qa/production-smoke.json`, `.qa/production-baseline/`, `.qa/production-live/`, and `.qa/card-actions/webkit-live-card-to-pilates.json`. The last smoke JSON/screenshots cover www; the same checks previously passed on apex.

This release preserves the current Room scroll effect, card actions and reviewed copy. Existing missing Figma source artwork remains documented in [IMPLEMENTATION.md](IMPLEMENTATION.md); deployment does not establish a complete 1:1 design match.

If an actual production regression requires rollback, use the dedicated TPR wrapper with the recorded previous version, then repeat the public checks. Do not change secrets or recreate the Worker as part of rollback.
