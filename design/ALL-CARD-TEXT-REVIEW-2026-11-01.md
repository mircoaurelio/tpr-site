# All cards and first-party text — 1 November 2026

The reported Move screenshot showed an old, already-open document. Inspection
of that exact in-app tab found `20261031-clean` scripts, the previous virtual
office copy and generic “Cosa si fa?” / “Diventa Membro” card content. Navigating
that tab to the current release displayed the sourced Attrezzature title, body
and “Prenota la tua lezione” wording. Fresh Figma design context for `643:2128`
and direct authenticated Figma UI inspection confirm that wording; Postazioni
`616:3793` was also visually rechecked. The other card records retain their
authenticated Figma transcripts from 31 October.

## Public text audit

An independent read-only audit of the previous public commit `f1ec168` exercised
all 11 canonical routes at 1512, 393 and 320px: 33 page runs, 672 selector/array
comparisons, all passing. Coverage includes the Room overviews, all six About
discovery states, offers/company benefits, Events cards, newsletter, contact
labels/options, booking introduction and widget configuration, menus and legal
footers. The latest user-supplied virtual-office wording and “sale riunioni”
correction take precedence over older source copy. Another 27 transient form
copy checks used intercepted responses and prevented mailto navigation.

The audit also compared all 14 recorded Figma Card Back descriptions, CTA labels
and source IDs with the canonical JSON. The existing Home regression passed
for 45 card instances at 1512/393/320px, plus the deliberately retained legacy
fallback. No generic card wording remains on the updated Home.

## Omission corrected

The five standalone `/rooms/*` explorers previously rendered only card fronts.
Their 14 sourced back descriptions and CTA labels were absent and unavailable
to pointer or keyboard interaction. They now use the same `cardDetails` content
as Home. Media Studio audio remains the source's noninteractive coming-soon
state, with no invented description or CTA.

Each standalone card has separate front-open and back-close controls. Hidden
faces are inert and excluded from accessibility; focus moves to Chiudi on open
and returns to the front on close. Escape closes an open card before leaving
exploration. CTA anchors are siblings of the flip control and use existing Vivi,
Pilates and Events destinations. Move uses green and Fuel orange card text,
matching the source and Home instead of their yellow room-action accent.

Existing card dimensions, order, paper masks, photographs and all Home elevator
motion remain in place. Shared CSS/JS URLs are versioned `20261101-allcopy` so
fresh navigation loads the corrected standalone templates and controller.

The new regression failed first for missing open controls at all three widths,
then separately for the wrong Move text color. The corrected tests pass at
1512/393/320px across all 14 backs, covering exact copy/CTA routes, source ink,
unclipped text, card geometry, Enter/Tab/Chiudi/Escape and focus restoration.
An independent reviewer also verified all 42 standalone back instances in
WebKit. A literal port of the Chromium test fails its Tab-to-first-anchor
expectation because Windows WebKit's native keyboard preference skips links.
The WebKit-only QA variant instead verifies that Tab excludes hidden fronts,
then focuses the CTA explicitly; all copy, routes, colors, layout, pointer,
Escape and focus-restoration assertions pass (3/3 tests). This is a test
portability limit, not a hidden-face focus defect; no product Tab interception
was added to change native link behavior.

The final complete UI suite passes 113/113 with two file workers (368.6 seconds).
The UTF-8 generator regression passes, repeat generation is deterministic, JS
syntax checks pass and `git diff --check` reports no whitespace errors.

## Scope of evidence

The complete new Figma API extraction is quota-limited; this audit combines
previously verified source transcripts, fresh Attrezzature design context and
the direct UI checks above. It does not claim every Figma frame was freshly
transcribed today or that all visual/artwork gaps have been closed. External
Mindbody class/account/payment text and Iubenda document contents are outside
the first-party copy comparison. No real form submissions or bookings were made.

Detailed scripts, per-route records and screenshots are in the ignored
`.qa/all-copy-20261101/` and
`.qa/text-audit-current/standalone-card-copy-regression/` directories.
