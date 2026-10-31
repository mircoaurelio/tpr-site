# Independent typography review — 31 October 2026

The six supplied desktop PDF review exports support the existing native text
families, nominal sizes, line spacing, tracking and wrapping. No non-Room type
size or font replacement was justified by the exported references.

This audit did not access live Figma. Its quota was already exhausted. The
authoritative available references are `design/review/source-*-desktop.webp`,
1200 px review renders of the 1512 px exported canvases with the 30 px mock browser
chrome removed. There are no original PDFs or text-metrics exports under the
recovered `tpr 2` workspace. `design/figma-slots.json` supplies asset geometry and
card frames rather than a complete typography-token inventory.

## Coverage and evidence

- 33 initial full-page captures: all 11 routes at 1512×952,393×852 and 320×852.
- 1707 visible text-node measurements in `computed-types.json`; no script errors
  or document-wide horizontal overflow. Out-of-viewport carousel cards were
  treated as intentional horizontal content.
- 15 further captures of the restored Home elevator: all 5 Rooms at each width.
  `room-types.json` records the initial restored state before the copy-position
  correction. Its desktop title/body are 233.234/353.234 px.
- Menu, open-Room and mobile card-back measurements and screenshots are in
  `state-types.json`. Those states have no complete updated source frame, so
  their recorded sizes are responsive-fit observations rather than 1:1 claims.
- `font-file-metadata.json` records source-font names, SHA 256 hashes and SFNT
  metrics. The actual files identify as PP Rader Bold, Alte Haas Grotesk Regular
  and Alte Haas Grotesk Bold. No replacement font was introduced.

## Source-backed desktop typography

| Role | Native source face | Size / line height | CSS weight | Tracking |
| --- | --- | ---: | ---: | ---: |
| Home hero | PP Rader Bold |160 /144 px |700 |0 |
| Main headings | PP Rader Bold |80 /80 px |700 |0 |
| Cap-trimmed Vivi / Scopri heading | PP Rader Bold |80 /72 px |700 |0 |
| Lead paragraphs | Alte Haas Grotesk Regular |40 /40 px |400 |0, with source-specific tightening retained |
| Card / form / partner headings | PP Rader Bold |40 /40 px |700 |0 |
| Body paragraphs | Alte Haas Grotesk Regular |24 /24 px |400 |0, with source-specific tightening retained |
| Offer benefits | Alte Haas Grotesk Regular |20 /20 px |400 |-0.2 px |
| Standard CTA / form controls | Alte Haas Grotesk Bold |16 /16 px |700 |0 |
| Footer headings | PP Rader Bold |24 /24 px |700 |0 |
| Footer links | Alte Haas Grotesk Regular |16 /16 px |400 |0 |

The `TPR Rader Figma` alias uses the original `PPRader-Bold.otf`, with the
existing ascent/descent overrides. This retains the source cap alignment:
the font's hhea ascender is 2048 units while its OS/2 ascender is 1466 units
at 2048 units/em. Plain browser metrics move 80 px display text vertically.

Representative white-ink comparisons at the 1200 px review scale are effectively
identical: Coworking title 454×47 px in both exports; Contacts title 255/256×46 px;
Booking heading 443/445×173 px; Community heading 444×110 px; Vivi lead 483×119 px.
The 1–2 px differences reflect rasterisation/antialiasing. `source-ink-bounds.json`
retains the sample data. The durable tests compare reference ink extents with a
3 px review-scale tolerance, checking wrapping and cap placement in addition to
computed CSS.

## Actionable finding and resolution

The restored legacy elevator put the desktop copy at 24.5% of the 952 px scene:
title 233.234 px, first body line 353.234 px. The updated source specifies the title
at 264 px and body at 384 px, with 80 px heading height and 40 px separation. The
bridge now aligns the non-exploring copy to 27.7310924% for widths≥901 px and
heights≥781 px. Its fonts are 80/80 px Rader Bold and 24/24 px Haas Regular;
paragraph gaps are 8 px and the action gap 32 px. Source CTA text is 16 px bold.
Photo, car, panorama and motion geometry remain owned by the legacy engine.

Short desktop viewports retain responsive source-font clamps. The added
901×500 and 1024×600 checks require readable body type, at least 2 visible text
lines, keyboard-reachable overflow when needed, a separate title slot and
actions inside the scene.

At 393 px the restored Room copy measures 16.8/18.816 px; at 320 px it measures
approximately 16.5–16.8 px, with 30.08 px titles. It remains readable and fits the
viewport. The six main responsive pages also show no unexpected horizontal
text clipping at 320/393 px. Updated mobile Figma frames were not supplied;
mobile 1:1 dimensions therefore cannot be established from the available source.

## Durable verification

`tests/typography-regression.mjs` checks actual painted font faces through
Chromium's platform-font inspection, nominal desktop sizes/weights/line spacing
and tracking, source-image ink wrapping, the 264/384 px Room positions, all 11
mobile routes and the two short desktop sizes. It accepts `TPR_BASE_URL` with
an origin or a trailing project mount such as `https://host/tpr-site/`.

Run `node --test --test-concurrency=1 tests/typography-regression.mjs` with the
desired `TPR_BASE_URL`; fresh evidence is written under
`.qa/designer-typography/regression-<TPR_QA_PHASE>/measurements.json`.

No live-Figma equality claim is made for missing updated mobile frames,
unavailable updated Room artwork or card-back states.
