# Responsive review after session recovery

The recovered GitHub branch remains the implementation source. Production
`thepeoplesroom.it` and its backend configuration were not changed.

## Fixes verified in Chromium

- Home hero and Community headings fit at 320px without changing the reviewed
  393px and 430px type sizes.
- Newsletter controls retain their SVG paper contour while disabled, ready,
  submitting, failed and reset after success. The native button background no
  longer covers the irregular edge.
- Opening, closing and escaping Room exploration keeps the focused control
  visible on mobile. Desktop scroll position is retained.
- The menu close glyph retains its 48px design size and its separate mobile
  position of 14px from the right and 10px from the top.
- The Home Pilates banner uses the existing paper mask on its decorative
  background. Its text and native hit area remain unmasked.
- Enquiry selects use the existing white arrow with their native hit area and
  keyboard selection retained.
- The preview generator reads its source copy and writes generated pages as
  UTF-8 explicitly, including on Windows with a non-UTF-8 default text locale.
  A temporary-tree regression checks generated pages and JSON-sourced accents.

## Eventi reference supplied in chat

The pink `#ff7bff`, blue `#2c64e8` and original photo/eye composition match the
available source. The supplied cropped screenshot is consistent with a 402 CSS
pixel viewport at 125% display scale. It does not establish a 393px frame.
The current responsive layout stacks the two CTAs at 320/393px and puts them
on one row at 402/430px. No breakpoint was changed based only on that crop.

## Verification and reproducibility

Install the locked development dependencies with `npm ci`, then install the
matching test browser with `npx playwright install chromium`. Serve the project
root on port 4173 (`npm run dev` requires Python 3). In another terminal run:

```sh
npm run test:newsletter
npm run test:ui
python3 -m unittest discover -s tests -p test_preview_generator.py
```

`TPR_BASE_URL` selects another server URL. UI tests run the real pages and
intercept external writes; they do not subscribe contacts or send email.
Screenshots and measurements are written to the ignored `.qa/` directory.
UI test files run serially against the shared local server. Assertions are not
retried or weakened to accommodate resource contention.

The final unchanged-tree runs passed: 10 UI tests, 15 newsletter tests and the
generator locale regression. The full rebuild succeeded without changing the
generated HTML. Representative final captures:

- [Newsletter ready, 393px](review/responsive-2026-10-31/newsletter-393-ready.png)
- [Menu, 393px](review/responsive-2026-10-31/menu-393.png)
- [Eventi, 402 CSS px at 125% scale](review/responsive-2026-10-31/events-402-at-125-percent.png)

These captures are evidence of the implementation, not substitutes for the
missing updated mobile Figma export.

## Verification limits

The current Figma MCP connection reached its View-seat quota. The browser can
view the updated Drive folder, but PDF downloads failed. Computer control was
then stopped because it could not confidently verify the native browser URL.
The suggested Google Drive plugin has not been confirmed connected.

The remaining exact Room artwork and full updated mobile frames therefore remain
unverified. See `IMPLEMENTATION.md` and `asset-status.json` for the outstanding
17 photo roles, four left-stage compositions and two illustrations. The booking
provider is also still unspecified. Neither successful browser tests nor the
supplied cropped screenshot establishes complete 1:1 Figma fidelity.
