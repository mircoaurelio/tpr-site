# Coworking, caroselli e header — 2 novembre 2026

Intervento richiesto sulle CTA del coworking, sulle card Eventi/Vivi TPR e sulla navigazione durante lo scroll. Riferimento: le due immagini inviate il 2 novembre e le esportazioni originali Figma già nel progetto. Le fotografie originali non sono state sostituite.

## Modifiche

- I pulsanti di prenotazione/accesso al coworking nella Home, nella pagina della stanza e nei retro delle card Postazioni/Sale riunioni portano a `/vivi-tpr/#offerte`.
- I caroselli delle offerte e degli eventi arrivano ai bordi della finestra: la card successiva viene tagliata lateralmente, senza un secondo ritaglio all'interno della griglia del testo. Il bordo irregolare superiore/inferiore rimane visibile. Le card degli eventi si adattano anche a schermi da 320 px.
- Rimossa la riga aggiunta «Scorri per esplorare» con le frecce. Rimangono trascinamento con mouse, scorrimento touch/trackpad e tastiera; la rotella verticale continua a scorrere la pagina. Su desktop le posizioni iniziali riprendono i riferimenti originali: Home all'inizio, Vivi TPR alla fine, Eventi al centro. Su mobile si parte dalla prima card.
- L'header riappare scorrendo verso l'alto e si nasconde scorrendo verso il basso, con una soglia che evita lampeggi per piccoli movimenti. In cima alla pagina rimane la composizione originale. Menu, focus da tastiera e preferenza per movimento ridotto sono mantenuti.
- Il vecchio percorso `/coming-soon/` ora reindirizza definitivamente alla Home con stato HTTP 301, conservando gli eventuali parametri dell'URL.

## Verifiche locali

- 18 test dedicati superati in Chromium e WebKit: collegamenti coworking, header e caroselli. Il test dei caroselli copre Home/Vivi/Eventi a 320, 393, 900, 1280, 1512 e 1920 px; tutte le card diventano interamente leggibili e la pagina non deborda orizzontalmente.
- 26 test backend e 9 test di build superati. Il primo avvio dei test di build ha incontrato un limite di lettura del sandbox; rieseguiti con i permessi necessari, sono passati tutti.
- Generatore verificato; audit dell'artefatto SEO superato per le 11 pagine canoniche e la sitemap.
- Revisione indipendente completata: corretti il lampeggio durante il primo passaggio dell'header a posizione fissa e la larghezza delle card Eventi a 320 px; nessun rilievo residuo del revisore.
- Verificate inoltre le azioni delle 15 card, la prenotazione Pilates, il menu, i form, il montaggio del progetto sotto un prefisso e il comportamento delle stanze al variare dell'altezza mobile. Tre segnalazioni del primo passaggio di integrazione sono state riesaminate: il test di navigazione imponeva 6 secondi anche al caricamento; separato il limite di navigazione (20 secondi) da quello delle interazioni, i due casi dei moduli sono passati. La prova delle stanze WebKit, interrotta durante l'attesa dell'animazione, è stata ripetuta insieme alle altre tre prove del viewport: 4/4 superate. Nessuna modifica al comportamento dei form o all'animazione delle stanze è stata necessaria.
- Non sono state inviate email, iscrizioni o prenotazioni reali durante queste verifiche.

## Risultato «Coming soon» nei motori di ricerca

La Home pubblica su entrambi i domini e la pagina coworking restituiscono già i titoli attuali. La ricerca eseguita il 2 novembre mostrava ancora il vecchio risultato della Home, acquisito circa due settimane prima. Il nuovo HTML e il redirect permanente aiutano il consolidamento, ma il titolo del risultato dipende dal successivo passaggio del motore di ricerca.

L'account Search Console aperto nel browser non include la proprietà TPR. Non è stata quindi inviata una richiesta di nuova indicizzazione. Chi gestisce la proprietà verificata può controllare la Home e richiederne l'indicizzazione in [Google Search Console](https://search.google.com/search-console). [Indicazioni ufficiali Google sulla nuova scansione](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).

## Pubblicazione

Pubblicato su [thepeoplesroom.it](https://thepeoplesroom.it/) e sul dominio www tramite Cloudflare, conservando la configurazione dei form. Versione di rilascio: `f2e89a06-4ee1-4b51-a380-1c74d47c9811`.

Controlli online completati: 47 file serviti identici all'artefatto di pubblicazione, 54 redirect permanenti, 12 prove di navigazione/header in Chromium e WebKit e 8 casi aggiuntivi sulle card di Eventi/Vivi TPR a 320, 393 e 1512 px. Tutte le quattro card di ciascun carosello sono raggiungibili; apertura e chiusura dei moduli verificate senza invii reali. Verificati anche i titoli su entrambi i domini e il redirect permanente del vecchio percorso Coming soon.

Prove locali conservate nella cartella privata `.qa/release-20261102/`; schermate della Home anche a 320, 393 e 1512 px. La nuova release è stata controllata direttamente sul dominio pubblico, oltre alle prove sul server di sviluppo.

Le prove WebKit sono eseguite in un browser automatizzato: non equivalgono a una verifica manuale su un iPhone fisico. Non viene dichiarata una nuova verifica 1:1 di frame Figma non disponibili in questa sessione.
