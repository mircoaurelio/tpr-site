# iPhone Room scroll and mobile review

The user reported a blue strip below the active Room while scrolling on iPhone, and confirmed it disappears when scrolling stops. This is the previous Room background exposed beneath a short moving layer, rather than a native scrollbar.

## Reproduction and correction

The original mobile sticky layer is `100svh` tall. Safari keeps that length at its smallest viewport while retracting its toolbar and expanding the visible viewport. The controller already measures the live `innerHeight`. During the 1250ms lift, the incoming and outgoing shade layers cover only the short sticky frame; the earlier Room color remains visible underneath until the new Room settles.

The regression models that Safari condition by materializing CSS `svh` lengths against a fixed 664px small viewport, then growing the visible viewport to 852px. It reproduces the supplied screenshot's blue strip beneath Move during the lift. Before the correction, the shade is 664px tall against an 852px visible window and the test fails.

Only the updated Home's mobile sticky height changes to `100dvh`, with `100vh` fallback. The existing percentage-height frame, shade cars and bottom navigator then follow the visible viewport. The shared legacy stylesheet/controller, 1250ms timing, fixed photo plane, original desktop panorama geometry, reviewed copy and assets are unchanged.

## Verification

- New regression: 4/4 passed across Chromium and WebKit. It covers all five settled Room states and four incoming lifts, plus 320px and 430px phones with open cards while the viewport grows and contracts.
- Existing targeted UI tests: 25/25 passed. These cover original lift, native forward/reverse floor scrolling, hash/button alignment, original panorama travel/handoff, mobile expansion, all card destinations and controls, 393px inspected Figma hero geometry/painted font, 320/430px hero adaptations, and all five Room navigator sizes at 320/393/430/1512px.
- Independent code review approved the scoped fix. Additional independent WebKit checks passed for scroll-triggered forward and reverse lifts and viewport shrink during a lift.
- A separate read-only public audit covered all 11 routes at Chromium 320/393/430px and WebKit 393px, plus menu, 20 Room overviews and 10 card openings/closures. No new overflow, native scrollbar, JavaScript or local asset failure was found. Existing explicitly missing Room card photos remain source gaps.
- No newsletter signup, contact message or booking was submitted.

Before/after motion screenshots: ignored `.qa/mobile-room-viewport/before/webkit-toolbar-during-move.png` and `.qa/mobile-room-viewport/after/webkit-toolbar-during-move.png`. Measurements and independent public screenshots are under `.qa/mobile-room-viewport/` and `.qa/mobile-public-audit-20261101/`.

## Figma and device limits

The live Figma file was inspected in the authenticated browser, including Website Mobile Article `560:2843` (393x2843). The plugin still reports its View-seat call limit, so no new full high-fidelity context or missing mobile artwork was exported. The existing source-derived hero and navigator checks remain green. This correction does not claim that all unavailable artwork or older placeholder mobile frames now match the updated desktop design 1:1.

The fixed-small-viewport fixture verifies the geometry defect and its correction; desktop WebKit is not a physical iPhone certification. The user's real-device screenshot and stationary/scrolling confirmation establish the reported trigger.

## Publication

Source and local checks are ready for the existing Cloudflare production Worker. The preceding active version is `d6b394ce-f2cf-48ea-aad7-72366547cb56`; retain it for rollback. Record the new version and public verification after release.
