# The People's Room

Static preview of Figma’s [Versione Aggiornata](https://www.figma.com/design/FpPfXalg4PRyqtnvwt2DUL/TPR?node-id=616-2194).

```sh
npm run build:preview
npm run dev
```

Open http://localhost:4173/homepage-tpr/. The preview uses native HTML, CSS and JavaScript; Python 3 builds the shared page templates. Dependencies are needed only for the existing Cloudflare tests and deployment tooling.

Content lives in `design/updated-content.json`, shared templates in `scripts/build_updated_preview.py`, and responsive styles and interactions in `updated-preview.css` and `updated-preview.js`. Generated HTML is committed so GitHub Pages can serve it directly.

See [ROUTES.md](ROUTES.md) for frames and routes, and [design/IMPLEMENTATION.md](design/IMPLEMENTATION.md) for validation and outstanding assets. This is a draft implementation: the exact October artwork exports remain unavailable, and the booking provider has not been specified. It is not yet a verified pixel-perfect match.

The older `/homepage/` variant remains available. Production hosting and the Cloudflare newsletter backend are separate from this preview.

```sh
npm ci
npm run test:newsletter
```
