# Coming soon

Pagina autonoma su `/coming-soon/`, HTML/CSS/JavaScript senza dipendenze.

## Interazioni

- Una sola card attiva. Click/tap sulla card attiva oppure Escape ripristina il messaggio generico e il form, mantenendo l'email digitata.
- Layout desktop dimensionato anche in base all’altezza disponibile: verificato senza scroll da 800×600 a 1512×982 nei normali stati di navigazione. Zoom, finestre ancora più basse e messaggi del form possono far crescere la pagina senza tagliare i contenuti.
- Fluttuazione con sole traslazioni: desktop da −11 a +9 px in verticale, mobile entro 4 px; cicli sfalsati da 6,5 a 8,2 secondi. Hit area stabile e pausa al focus/hover.
- Selezione/deselezione ispirata al video del 25/09/2026: riempimento e colore in dissolvenza, etichetta da centro a sinistra, comparsa graduale della × e lieve impulso di scala. Click rapidi e passaggio diretto tra card mantengono una sola selezione; `prefers-reduced-motion` disattiva sia le transizioni CSS sia l’impulso JavaScript.
- Layout mobile a due colonne; contenuti scrollabili sui display piccoli, senza bloccare lo zoom.
- Bordi ondulati disegnati come tracciati SVG sulle dimensioni reali di card, campo email e pulsante Conferma. `ResizeObserver` mantiene costanti spessore e frequenza delle onde; testo e aree cliccabili non vengono deformati.

## Prima della raccolta reale

Il form è un'anteprima: valida email e consenso, ma non conserva né trasmette indirizzi. Non mostra conferme di iscrizione finché manca l'endpoint.

1. Aggiungere un endpoint server per Brevo e conservare la chiave API esclusivamente sul server. Implementare validazione, limiti alle richieste e gestione del consenso nel backend.
2. Impostare `data-endpoint` sul form a un URL same-origin. Contratto: POST JSON `{ email, consent }`; risposta JSON `{ success: true }` solo dopo il salvataggio effettivo.
3. Sostituire gli avvisi di anteprima con le informative privacy/cookie approvate. I collegamenti ufficiali sono già configurati: `hello@thepeoplesroom.it`, Instagram `tpr_milano`, TikTok `@tpr_milano`.

## Riferimenti visivi

Figma `FpPfXalg4PRyqtnvwt2DUL`, sezione `794:4849`; desktop generico `794:4102`, mobile generico `799:2097`. Il design context e lo screenshot desktop sono stati recuperati il 25/09/2026: confermano PP Rader Bold, ora caricato dal file locale `PPRader-Bold.otf` senza rinforzi sintetici.

Le icone originali sono esportate localmente in `assets/coming-soon/`: email dal nodo `794:4634`, Instagram da `794:4619`, TikTok da `794:4624`, tutte 32×32. Il limite del connettore è stato raggiunto al successivo tentativo di ispezione/esportazione dei bordi. Logo e personaggi restano gli asset locali esistenti; sagome di sfondo e bordi rimangono le precedenti ricostruzioni vettoriali. I bordi non sono ancora export originali del prototipo.

Pubblicazione: `scripts/build_static.ps1` include il percorso e gli asset effettivamente usati.
