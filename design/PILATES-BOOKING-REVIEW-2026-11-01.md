# Pilates booking and copy — 1 November 2026

The user supplied the Mindbody Schedules embed and replacement virtual-office
copy. The existing Figma booking page (`1065:3385`) and paper placeholder
(`1065:3390`) remain the layout reference; the calendar replaces the empty area.

## Changes

- Corrected “sale riunione” to “sale riunioni” in three offer benefit lists and
  the company benefits. Home and Vivi TPR are regenerated from canonical JSON.
- Replaced the virtual-office description exactly with: “Tu lavori dove vuoi,
  la tua attività ha casa qui. Sede legale, gestione della corrispondenza e una
  targhetta con il tuo logo”.
- Mounted the supplied `Schedules` widget `4581434fffc` and async
  `https://brandedweb.mindbodyonline.com/embed/widget.js` loader on `/prenota/`
  only. No Mindbody account credentials are required by the public embed.
- Updated Home Move's desktop/mobile Prenota destination from the generic
  contact enquiry to the existing booking page. Unconfigured legacy Room
  defaults and all elevator motion remain intact.
- Replaced the paper panel's fixed height with the original minimum height
  (568px desktop, 500px mobile), natural content height and an inset to keep
  provider controls clear of the paper edge. The provider controls iframe
  height; the site constrains its width to the panel.

## Verification

The six new regression tests failed first for the missing widget, incorrect
Home Move destination and clipped frame. They now pass in Chromium and WebKit,
covering navigation at 320, 393, 1512 and 1920px and iframe heights of 694/1050px.
An independent reviewer also served the site strictly under `/tpr-site/` and
verified navigation and containment at 320, 393 and 1512px with no local 404s or
page errors. The UTF-8 generator regression passes.
The complete UI suite passes 110/110 with two file workers (347.7 seconds).
Repeat generation is deterministic and `git diff --check` passes. Direct copy
checks on Home and Vivi TPR at 320, 393 and 1512px confirm the full replacement
description remains visible and the reported typo is absent.

Live Mindbody probes loaded the real schedule on Chromium 320/1512 and WebKit
393. At 320px the iframe grew to 780px; at 1512px it used 652px; neither page nor
provider content had horizontal overflow. Mobile Chromium and WebKit also
followed “Vai al…” to the next available class day, showing three real TPR Move
classes and their Prenota actions; the panel grew with the longer listing.
Only the inspected date-range class-fetch request was allowed through POST.
Reservation/account/payment requests remained blocked, and no booking was made.

Evidence is in the ignored `.qa/pilates/` directory. Existing source-artwork gaps
and the unrelated newsletter/enquiry limits remain documented in IMPLEMENTATION.
