# The People's Room

Static preview of Figma’s [Versione Aggiornata](https://www.figma.com/design/FpPfXalg4PRyqtnvwt2DUL/TPR?node-id=616-2194).

[Open the published GitHub Pages preview](https://mircoaurelio.github.io/tpr-site/homepage-tpr/).
Pages serves the `figma-updated-preview-2026-10-30` branch from its repository root.

```sh
npm run build:preview
npm run dev
```

Open http://localhost:4173/homepage-tpr/. The preview uses native HTML, CSS and JavaScript; Python 3 builds the shared page templates. Dependencies are needed for browser/backend tests and deployment tooling.

Content lives in `design/updated-content.json`, shared templates in `scripts/build_updated_preview.py`, and responsive styles and interactions in `updated-preview.css` and `updated-preview.js`. Generated HTML is committed so GitHub Pages can serve it directly.

Home reuses the original Room elevator: the masked photograph stays on its own plane as copy/background layers lift and photos crossfade. Explore opens the original wide image; vertical page scrolling pans it and its cards horizontally, then hands off to the next Room. Its original timing, easing, panorama geometry and 720px mobile expansion remain. Available updated assets and copy are supplied through a Home-only configuration. The scroll travel intentionally extends Home beyond its static Figma canvas; standalone Room pages retain their ordinary layout.

See [ROUTES.md](ROUTES.md) for frames and routes, and [design/IMPLEMENTATION.md](design/IMPLEMENTATION.md) for validation and remaining gaps. Supplied Figma PDFs provide the available photos, partner logos, original vectors and Home compositions. Seventeen room photo roles, four left photo/eye stages, two coming-soon illustrations, updated mobile frames and the booking provider remain unresolved. This preview is not claimed as a completed 1:1 match.

The older `/homepage/` variant remains available. Production hosting and the Cloudflare newsletter backend are separate from this preview.

```sh
npm ci
npx playwright install chromium webkit
npm run test:newsletter
```

For browser checks, run `npm run dev:qa` in one terminal. In another, set
`TPR_BASE_URL=http://127.0.0.1:4174` and run `npm run test:ui` (PowerShell:
`$env:TPR_BASE_URL='http://127.0.0.1:4174'`). Native scrollbars stay hidden while
text/cards remain scrollable. Character colors are checked during slow/failed
SVG hydration as well as after loading; see the [color review](design/COLOR-REVIEW-2026-10-31.md).
