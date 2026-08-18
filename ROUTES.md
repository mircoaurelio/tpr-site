# Alberatura TPR

## Homepage

- `/` → redirect alla homepage del prototipo.
- `/homepage-tpr/` → `Homepage_TPR`, nodo Figma `260:1717`, starting point del prototipo.
- `/homepage/` → variante `Homepage`, nodo Figma `260:1540`.

Entrambe le homepage condividono il menu full-screen e l’ascensore delle cinque stanze.

## Pagine principali

- `/about/` → `About_TPR`, nodo `268:2154`.
- `/eventi/` → `Eventi_TPR`, nodo `268:2824`.
- `/contatti/` → `Contatti_TPR`, nodo `269:3179`.
- `/gallery/` → redirect a `/eventi/#gallery`: non esiste un frame Gallery autonomo.
- `/app/` → redirect alla sezione App: non esiste un frame App autonomo.

## Room

- `/rooms/coworking/` → nodo `260:3549`.
- `/rooms/reformer/` → nodo `260:3661`.
- `/rooms/bar/` → nodo `260:3773`.
- `/rooms/wellness/` → nodo `260:3951`.
- `/rooms/media/` → nodo `260:4060`.

I vecchi URL `/{room}/` restano disponibili come redirect. `Coworking-1`, `Coworking-2` e `Coworking-3` sono stati del meccanismo orizzontale, non route.

## Membership

- `/membership/aziende-startup/`
- `/membership/privati-freelancer/`

Il Figma indica le due destinazioni ma non contiene frame definitivi; le route dichiarano quindi esplicitamente lo stato placeholder.

## Motion condiviso

- menu full-screen con apertura ease-out da 500 ms, focus trap, Escape e focus restore;
- ascensore Room sticky: lo scroll nativo seleziona i cinque piani, le icone permettono il jump diretto;
- dettaglio Room: lo scroll verticale controlla lo stage orizzontale e le tre card;
- hero video loop/player, hover degli omini, parallax Eventi, marquee Partner e rise-up App;
- tutte le animazioni rispettano `prefers-reduced-motion`.

Nota tecnica: le interazioni Smart Animate tra frame non sono esposte dal connettore MCP; durata e comportamento del menu derivano dalle proprietà visibili nel file Figma.
