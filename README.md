# The People's Room

Implementazione multi-route del file Figma TPR.

- `/` e `/homepage-tpr/`: homepage canonica del prototipo, starting point Figma `260:1717`.
- `/homepage/`: seconda variante `Homepage`, nodo `260:1540`, conservata separatamente.
- `/about/`, `/eventi/`, `/contatti/`: pagine dedicate esportate dai rispettivi frame.
- `/rooms/coworking/`, `/rooms/reformer/`, `/rooms/wellness/`, `/rooms/bar/`, `/rooms/media/`: percorsi Room canonici con movimento orizzontale controllato dallo scroll e card interattive. I vecchi URL `/{room}/` restano alias compatibili.
- `/membership/aziende-startup/` e `/membership/privati-freelancer/`: destinazioni previste dalle note Figma; restano dichiaratamente placeholder perché i relativi frame non sono definiti.

Le due homepage condividono il menu full-screen e l’ascensore sticky a cinque piani. Gli asset originali e gli SVG ricavati dagli stati Figma sono locali e condivisi in `assets/`.

La mappa completa, gli ID Figma e le note sulle animazioni sono in [`ROUTES.md`](ROUTES.md) e [`routes.json`](routes.json).

Server locale: `http://127.0.0.1:4173/`.
