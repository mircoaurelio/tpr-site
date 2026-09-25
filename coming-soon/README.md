# Coming soon

Pagina autonoma su `/coming-soon/`, HTML/CSS/JavaScript senza dipendenze.

## Interazioni

- Una sola card attiva. Click/tap sulla card attiva oppure Escape ripristina il messaggio generico e il form, mantenendo l'email digitata.
- Fluttuazione con sole traslazioni: desktop entro 5 px, mobile entro 2 px. Hit area stabile, pausa al focus/hover e animazioni disattivate con `prefers-reduced-motion`.
- Layout mobile a due colonne; contenuti scrollabili sui display piccoli, senza bloccare lo zoom.
- Bordi ondulati disegnati come tracciati SVG sulle dimensioni reali di card, campo email e pulsante Conferma. `ResizeObserver` mantiene costanti spessore e frequenza delle onde; testo e aree cliccabili non vengono deformati.

## Prima della raccolta reale

Il form è un'anteprima: valida email e consenso, ma non conserva né trasmette indirizzi. Non mostra conferme di iscrizione finché manca l'endpoint.

1. Aggiungere un endpoint server per Brevo e conservare la chiave API esclusivamente sul server. Implementare validazione, limiti alle richieste e gestione del consenso nel backend.
2. Impostare `data-endpoint` sul form a un URL same-origin. Contratto: POST JSON `{ email, consent }`; risposta JSON `{ success: true }` solo dopo il salvataggio effettivo.
3. Sostituire gli avvisi di anteprima con le informative privacy/cookie approvate e collegare email, Instagram e TikTok ufficiali. I recapiti non sono stati inventati.

## Riferimenti visivi

Figma `FpPfXalg4PRyqtnvwt2DUL`, sezione `794:4849`; desktop generico `794:4102`, mobile generico `799:2097`. Testi e misure recuperati dai metadati Figma, riferimenti visivi verificati nel browser. Il limite del connettore ha impedito il recupero del design context e degli export: logo, caratteri e personaggi riutilizzano gli asset locali; sagome di sfondo e bordo sono ricostruzioni vettoriali dalle schermate. PP Rader Regular con un leggero rinforzo CSS sostituisce il Semibold assente.

Pubblicazione: `scripts/build_static.ps1` include il percorso e gli asset effettivamente usati.
