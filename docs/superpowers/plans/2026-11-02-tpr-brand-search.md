# TPR brand search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. One independent whole-change review before release.

**Goal:** Strengthen the association between TPR, The People's Room and Milano; verify structured data, configure Search Console and publish the tested site.

**Architecture:** Keep the existing static generator and production SEO metadata module. Update a small amount of natural public copy and the Home metadata; connect the WebSite and organization identities without inventing business facts. Configure Google through its existing signed-in browser and manual DNS verification with the authorized Cloudflare account.

**Tech Stack:** Python generator, JavaScript metadata/build, Node tests, Playwright, Cloudflare Workers Static Assets, Google Search Console.

**Spec:** User request of2 November2026: “ottimizza il sito per TPR e TPR Milano, controlla i dati strutturati e configura Search Console con gli accessi che hai, poi pubblica tutto”. Baseline source `7846d0a`; production `f2e89a06-4ee1-4b51-a380-1c74d47c9811`.

## Global Constraints

- Preserve the approved layout, original assets, carousel/header fixes, Room motion, all form endpoints and Mindbody booking.
- No fabricated reviews, rankings, coordinates, telephone, social accounts, prices or business hours. Keep the public visiting address distinct from the legal office.
- Keep production indexable and the GitHub preview noindex. Do not keyword-stuff, hide SEO text or represent “TPR Milano” as a separate business.
- Use the existing Google session and add only the requested TPR property. Manual DNS verification adds one TXT record; do not modify existing mail, routing or ownership records, and do not grant an extra DNS integration.
- Publishing is explicitly authorized. No real email, subscription or booking tests; retain deployment secrets and newsletter/privacy configuration.

## Review Focus

- Google sees the same truthful brand/location identity as visitors; abbreviations support identification, without claims of guaranteed ranking.
- Canonical Home `/` and known aliases remain coherent across apex and www.
- Metadata ownership is idempotent and JSON-LD remains parseable without duplicating the site's own entities.
- Schema logo URLs resolve to genuine, legible brand assets and no unverified social identity is added.
- Ownership verification must visibly succeed before reporting Search Console configured; sitemap submission and indexing requests have separate outcomes.

## Task1 — Brand metadata and public copy

Files: `scripts/seo_metadata.mjs`, `design/updated-content.json`, generated Home/About, `tests/seo-brand.test.mjs`, existing build/schema tests.

- [x] Add failing tests for Home title containing TPR/Milano/full brand, matching Open Graph and a natural visible full-name/acronym/location introduction.
- [x] Add failing tests for linked WebSite/organization IDs, correct TPR alias, truthful LocalBusiness address/hours and metadata reapplication without duplicate owned schema.
- [x] Implement Home title “TPR Milano | The People's Room: coworking e Pilates”, a relevant unique description and a small Home/About introduction update. Keep all design dimensions and interaction code unchanged.
- [x] Connect identity schema using stable IDs, authentic branding and only verified public facts; keep LocalBusiness on Contacts. Update the artifact tests to cover the new identity contract.
- [x] Run focused tests red→green, regenerate pages, test the production build and perform the existing SEO audit plus responsive checks of the affected copy.

## Task2 — Search Console

- [x] Add the domain property `thepeoplesroom.it` in the existing signed-in Google account; select manual TXT verification.
- [x] In the existing TPR Cloudflare account, inspect the domain's DNS records, add only Google's requested TXT record and verify it is served.
- [x] Complete Google ownership verification, submit `https://thepeoplesroom.it/sitemap.xml` and inspect the Home and Coworking URLs after release. Request indexing where available; record Google's actual result.
- [x] Save proof of the verified property and submitted sitemap, and provide the direct property/report link. If authentication or verification is blocked, record the concrete blocker and complete unaffected release work.

## Task3 — Review, publish and verify

- [x] Obtain one read-only independent code/schema review and resolve material findings.
- [x] Deploy through the existing TPR wrapper with keep-vars and the current newsletter/privacy settings.
- [x] Verify all canonical titles/descriptions/schema/robots/sitemap and the affected public layout in Chromium/WebKit, with no form submissions.
- [x] Commit/push the reviewed source, record the release ID, exact Search Console outcome and limits in a forwardable Italian report.

## Execution ledger

Ruling: proceed inline without another plan approval — the user explicitly requested execution and publication, and session instructions require completing already authorized work.

Ruling: keep the current isolated preview branch — it contains the reviewed live site and only the pre-existing untracked `debug.log`; do not include that file in commits.

Task1: red→green complete for5 focused tests (four assertions failed before implementation; pre-existing schedule guard already passed). The original logo is the blue TPR vector already used publicly. No verified social URLs exist in the current editorial data, so no `sameAs` is invented. Static independent review found no actionable issue.

Task2: authentication blocked. User explicitly chose an account TPR instead of the personal Google account, then stated they cannot reactivate Google now. Existing Google `social@thepeoplesroom.it` session is expired and the prior credential table specifies Google sign-in without a Google password. Cancelled the unsaved TXT for the personal account; DNS still has20 records. Do not verify or grant ownership to the personal account. Keep the TPR login available and complete website release independently.

Task2: cleanup verified — removed the newly added, unverified TPR placeholder from the personal Google account. Property selector again shows only the previously existing unrelated property. No verification TXT was saved and no owner permission granted. The TPR login tab remains available for a later user sign-in.

Task3: deployed Cloudflare release `7819d4b2-27ee-4029-af40-879c74d3342d`, preserving form/privacy/newsletter variables. Local production artifact audit passed for11 canonical pages;5 SEO unit tests,9 build tests, generator test,3 audit tests and18 browser cases are green. Live verification passed for47 matching files and18 further browser cases.

Task2: authentication resolved after the user supplied the TPR Google credential. Signed in to `social@thepeoplesroom.it`; no password stored in repository or browser. Added one TXT generated for that account (DNS count20→21) and Google confirmed Ownership verified. Sitemap accepted with Success and11 discovered pages. Home already indexed; its fresh indexing request was accepted and entered Google's priority crawl queue. Coworking inspection pending. Schema.org validation: Home and Contacts0 errors/0 warnings. Google Rich Results: Contacts2 valid items, with only optional telephone/priceRange warnings.

Task2: complete — Coworking was not yet indexed at inspection; Google accepted its indexing request as well. Both priority-queue confirmations and the verified property/sitemap success are saved as screenshots. No pending authentication, ownership or submission blocker remains; index processing and future ranking remain Google's work. Keep the signed-in TPR property as the user-facing browser deliverable.
