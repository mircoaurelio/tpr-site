# Iscrizioni Brevo

`newsletter.mjs` è un handler server basato sulle API Web Request/Response. `server.mjs` lo espone su `/api/newsletter` con Node 22+ e serve solo i file pubblici generati in `dist/`. Non servono pacchetti npm.

Il server crea o aggiorna il contatto con `listIds: [2]`, `attributes: { FONTE: 'Landing' }` e `updateEnabled: true`. Lista e fonte sono fissate sul server. Non modifica altre liste, altri attributi o lo stato di disiscrizione del contatto. Nessuna email viene spedita direttamente da questo codice; eventuali automazioni Brevo sono configurazioni separate dell’account.

La chiave fornita è stata verificata il 28/09/2026: lista 2 `Contatti TPR`, attributo normale `FONTE` di tipo `text`. Nessuna credenziale è salvata nel repository.

## Configurazione del server

- `BREVO_API_KEY`: segreto da impostare nell’hosting, mai nel frontend.
- `NEWSLETTER_ALLOWED_ORIGINS`: origini HTTPS autorizzate, separate da virgole. Copiare i domini effettivamente pubblicati; per GitHub Pages l’origine è `https://mircoaurelio.github.io` senza il percorso `/tpr-site`.
- `HOST` / `PORT`: indirizzo e porta di ascolto dell’adapter Node (default `127.0.0.1:4180`). In produzione va esposto tramite HTTPS/reverse proxy del provider.

Avvio dopo aver impostato le variabili d’ambiente e generato `dist/`:

```sh
node server/server.mjs
```

Il form deve avere `data-endpoint` impostato all’URL HTTPS pubblico di `/api/newsletter`, oppure al percorso relativo quando pagina e backend sono sullo stesso hosting. La configurazione resta vuota finché non è disponibile il server pubblico. GitHub Pages serve solo il frontend e non esegue questo codice.

Richiesta: `POST application/json { email, consent: true, website: '' }`. Risposta `200 { success: true }` soltanto dopo la conferma Brevo. Gli errori non restituiscono chiavi, email o dettagli dell’account. Il filtro Origin/CORS autorizza i browser configurati; non è un sistema di autenticazione.

Sono presenti validazione server, campo honeypot, limite payload di 4 KiB, timeout Brevo, prevenzione del doppio invio frontend e limite locale di 30 tentativi per IP ogni 10 minuti. Quest’ultimo è in memoria e si azzera al riavvio: su hosting con più istanze va affiancato al limite condiviso del provider. L’adapter Node usa l’IP della connessione, non si fida di header IP inviati dal client. Dietro reverse proxy occorre configurare il limite sul proxy oppure un adapter che riceva l’IP verificato della piattaforma.

L’informativa mostrata in anteprima va sostituita con quella approvata prima dell’attivazione. Non conserva ancora una ricevuta separata di consenso: la richiesta viene accettata solo con consenso esplicito, mentre gli attributi inviati a Brevo sono quelli indicati sopra.

## Verifiche

```sh
node --test server/newsletter.test.mjs
```

Coprono creazione, aggiornamento idempotente, attributi fissati sul server, richieste non valide, origini, CORS, limiti, configurazione mancante, errori e indisponibilità Brevo. I test unitari simulano Brevo e non inseriscono contatti reali.

Riferimenti API: [creazione/aggiornamento contatti](https://developers.brevo.com/reference/create-contact), [attributi](https://developers.brevo.com/reference/get-attributes).
