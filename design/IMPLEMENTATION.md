# Versione Aggiornata implementation

This branch updates the GitHub preview. Production `thepeoplesroom.it`, Cloudflare bindings and server credentials were not changed.

## Implemented

- Shared TM logo, header, menu, footer, legal links, fonts and palette.
- Updated home introduction, room copy, events, offers, company enquiries, partner layout and community form.
- About manifesto, discovery selector, offer/event links and contact section.
- Contacts layout and address/hours; updated events gallery and event enquiry layout.
- Vivi TPR page with four offers, company section and community subscription.
- Pilates page with the empty embed area shown in the supplied frame.
- Five room routes, floor selector, room exploration, card labels/order and coming-soon states.
- Responsive adaptations, keyboard navigation, focus handling and form validation.

## Assets and limits

The exact October photos, composed masks, decorative vectors and partner logos could not be exported: Figma MCP reports its View-seat call limit, and the returned asset URLs fail with proxy CONNECT 403. The newer Drive folder requires Google sign-in. No screenshots of whole screens were introduced as page assets.

The public original brand folder provided the approved `Logotype_blue.svg` TM artwork, used in the footer and inline Vivi headings. Its original paths are preserved; CSS positions the existing artboard in a cropped wrapper. Existing TM full logo and same-role legacy hero/room/event/map artwork remain in use pending exact exports. Newly introduced image slots are neutral empty media areas. `data-pending-figma-image` attributes and [asset-status.json](asset-status.json) identify these gaps. This draft must not be described as a completed 1:1 visual match.

The room detail fronts and coming-soon labels are implemented; card back states and the exact prototype motion were not available for verification. The mobile layout is an adaptation, because a complete updated mobile frame set was not supplied.

## Forms

The community form calls the existing newsletter endpoint with email, explicit consent and honeypot. The unchanged server implementation enforces Brevo list 2 and `FONTE=Landing`; no API key is present in the browser. Its button is enabled and blue only after a valid email and checked consent. Success is shown only after a successful server response. The production endpoint must allow the preview origin; localhost is not automatically allowed.

Enquiries hand off a prepared message to the visitor’s email application at the existing `hello@thepeoplesroom.it` address. They do not claim delivery. Direct server delivery, checkout/payment for Day Pass, and a real Pilates booking embed are not configured by the supplied design. Offer buttons currently lead to an enquiry with the selected offer. The Pilates panel remains empty as in Figma, pending the provider URL.

## Validation

- Built all 11 canonical routes and captured desktop 1512×952 and mobile 393×852 screenshots.
- Checked layouts at 320, 393, 768, 1024, 1512 and 1920px.
- Tested menu focus containment/restoration, Escape, all five room selections and room exploration, discovery selector and keyboard carousels.
- Tested newsletter validity, button color, failure and success using intercepted responses. Tested enquiry handoff by intercepting the mailto link. No test contacts or emails were sent.
- Existing server/Cloudflare newsletter suite: 15 tests passed.
- No browser script errors or failed local image requests in the canonical route capture.

Visual review remains open until the exact exports and booking destination are available. Screenshots and the before/after report are saved in the task workspace under `/workspace/tpr-redesign-audit/`.
