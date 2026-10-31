# Character color review — 31 October 2026

The external SVG fallback was the confirmed black-figure cause. The five
original little-man SVGs use `fill="currentColor"`. When loaded through an
external `<img>`, they do not inherit the surrounding element's CSS color.
The parent correctly computed blue/yellow/green while the image painted black.

The source palette is unchanged:

| Room | Source foreground |
| --- | --- |
| Coworking | `#2c64e8` |
| Move / Reformer | `#ffc100` |
| Recharge / Wellness | `#3f9941` |
| Fuel / Bar | `#ffc100` |
| Media | `#2c64e8` |

`tests/character-colors-regression.mjs` failed before the production fix:
20 fallback specimens covered all five Rooms at 1512px and 393px, with
hydration fetches separately aborted or delayed. Only SVG fetch/XHR was
affected; image requests loaded normally. Every specimen had dominant
foreground `#000000`, no expected-color pixels and 85.75–90.57% black
foreground. Original screenshots and measurements remain in `before-fix/`.

After the Home alpha-mask fallback fix, the full test file passes
3/3 tests. Its 51 raster specimens cover:

- 20 delayed/failed-hydration fallback cases;
- 5 normally hydrated current figures;
- 5 incoming figures observed while the elevator is lifting;
- 5 standalone Room masks;
- 5 white Home intro figures and 5 white menu figures;
- 6 About discovery variants, including the original selected Move artwork.

The color specimen is a clone of the real element with its actual computed
styles, image URLs and masks, painted on a plain backdrop. No source fill,
color, mask or color filter is repaired by the test. White figures use a blue
backdrop. The lift's color-neutral blur is removed only from the isolated
color specimen so translucent blur fringes do not dilute the solid-foreground
percentage; the live scene remains unchanged. Incoming-state measurements
record the actual motion filter separately.

Each specimen must have the exact expected dominant RGB value, at least 65%
solid expected-color foreground and at most 1% black foreground. These strict
pixel assertions are identical for fallback, hydrated, incoming and static
colored/white cases. `after-fix/measurements.json` and its PNGs contain the fresh
passing evidence.

Run with `TPR_BASE_URL` set to an origin or project mount and an optional
`TPR_QA_PHASE`, followed by:

`node --test --test-concurrency=1 tests/character-colors-regression.mjs`

This designer agent changed only the new test file and QA evidence; production
SVG paths, artwork, motion, typography and scroll behavior were not edited.
