# Native Room card actions — 1 November 2026

The user requested functional card actions, specifically all three TPR Move
“Prenota la tua lezione” controls opening the Pilates page with Mindbody on
desktop and mobile. The previous Home markup placed CTA labels inside the
outer flip button; activating the label therefore only flipped the card.
Standalone Room cards already used native links.

## Change

Configured Home card shells retain their existing classes, dimensions, paper,
photographs and flip transforms. They now contain a native front-open button
and a sibling back face with a native close button and real anchor actions.
Buttons and links are never nested inside another interactive control.

All 15 Home CTA labels have internal destinations:

| Action | Destination |
| --- | --- |
| All three TPR Move cards: Prenota la tua lezione | `prenota/` |
| Scopri come accedere | `vivi-tpr/` |
| Coworking Eventi: Eventi e Gallery | `eventi/` |
| Coworking Eventi: Organizza un evento | `eventi/#organizza` |

The Media Studio audio coming-soon card has no invented CTA. Existing standalone
links keep the same destinations. URLs resolve against the shared script's
project base, including GitHub Pages subpaths.

Hidden backs and hidden front controls are inert. Opening a card focuses its
close control; closing restores the front button without moving page scroll.
Escape closes an open configured card before leaving exploration. CTA clicks
keep native navigation and are not handled as flip commands. Unconfigured
legacy routes retain their original markup and behavior.

`shared-elevator.css`, lift timings, panorama geometry and the native image/card
scroll effect are unchanged. Only the configured card renderer/handlers and
scoped new-control styling changed. Home script/style cache keys use
`20261101-cardactions`.

## Verification

The new regression failed first for absent anchors. Its 12-test matrix passes
in Chromium and WebKit at 320, 393 and 1512px, covering all 15 Home labels/hrefs,
all three Move links in Home and standalone pages, pointer/touch and native
Enter activation, actual Pilates heading and the supplied Mindbody Schedules
widget `4581434fffc`. External provider requests and submissions are blocked in
these repeatable navigation tests. Existing copy/legacy checks pass 4/4.

An independent reviewer also activated all 15 Home links by touch at 393px and
verified their destinations. A same-engine before/after comparison of 30 Home
card states at 393/1512px found identical fonts/colors and at most 0.000122px
frame roundoff. Additional reviewer samples preserve Recharge metrics at
320/393/1512px. An independent subpath fixture confirms all 15 Home hrefs retain
the `/the-peoples-room/` mount.

The live mobile journey additionally touches the Attrezzature booking link and
loads the real provider iframe on the Pilates page in Chromium and WebKit. No
booking, account change, payment or form submission is performed.

The complete UI suite passed 125/125 with three file workers (373.8 seconds).
A subsequent edge-hit test exposed inactive padding at the sides of the CTA.
Moving the horizontal padding from the frame to its child anchors fixes the
tap area without moving the frame or its text. The final affected action/copy
suite then passed 16/16 (161.4 seconds), including touches 8px inside the left
edge of all three Home Move buttons at 320/393px in both engines. A fresh
30-state before/after comparison also reports zero frame/font/text differences.
Generator locale, deterministic regeneration, JS syntax and diff checks pass.

Evidence is in `.qa/card-actions/` and `.qa/home-card-actions/`. The earlier text
audit remains recorded in ALL-CARD-TEXT-REVIEW-2026-11-01.md; this follow-up changes
the actions, with the existing source wording retained.
