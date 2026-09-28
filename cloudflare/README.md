# Coming soon su Cloudflare

Un Worker serve gli asset statici e `/api/newsletter` sullo stesso dominio. La chiave Brevo è un secret del Worker; non è inclusa nel repository o nei file pubblici. L'API riusa `server/newsletter.mjs`, impone lista 2 e `FONTE: Landing` e aggiorna i contatti esistenti.

## Stato al 28 settembre 2026

- Pubblicazione verificata nel browser: https://tpr-coming-soon.devitomirco.workers.dev/
- Secret `BREVO_API_KEY` configurato e verificato con `wrangler secret list`.
- Form disabilitato nella build pubblica (`data-endpoint=""`): manca il link dell'informativa privacy definitiva.
- `thepeoplesroom.it` non ancora aggiunto all'account Cloudflare; DNS Register invariati, sito principale ancora su Framer.
- 14 test Node/Cloudflare superati. La prova reale Brevo era stata completata sull'handler condiviso; la catena completa dal Worker pubblico deve ancora essere verificata dopo l'attivazione.

## Sviluppo e pubblicazione

Con Node 22+ e un account Cloudflare autorizzato:

```sh
npm ci
npm run test:newsletter
npm run build:cloudflare
npx wrangler deploy --dry-run
npm run deploy:cloudflare
```

Il comando di deploy pubblica una build con iscrizioni disabilitate per default. La directory `dist-cloudflare` contiene soltanto HTML, CSS, JavaScript, asset, `robots.txt` e `_headers`. Viene rigenerata integralmente; non usarla per file da conservare.

Per configurare o ruotare la chiave, usare il prompt riservato di `npx wrangler secret put BREVO_API_KEY`. Non passare la chiave come argomento, non salvarla in `wrangler.jsonc` e non inserirla nel frontend.

Per attivare le iscrizioni, impostare `NEWSLETTER_ENABLED=true` e `PRIVACY_POLICY_URL` all'URL HTTPS dell'informativa approvata prima di eseguire `npm run deploy:cloudflare`. La build collega entrambi i link Privacy Policy e imposta il form su `/api/newsletter`. L'origine effettiva deve comparire in `NEWSLETTER_ALLOWED_ORIGINS`; aggiungere esplicitamente l'origine workers.dev solo se il form deve funzionare anche sull'indirizzo provvisorio.

Il limite nativo Cloudflare è 30 richieste per minuto per indirizzo, con chiave SHA-256. È un limite distribuito approssimato per sede Cloudflare, non un contatore globale. Se il binding manca o fallisce, l'API restituisce 503 e non contatta Brevo. Il filtro Origin protegge l'uso nel browser, ma non sostituisce l'autenticazione.

## Collegamento del dominio

L'accesso FTP non è necessario. Occorre aggiungere `thepeoplesroom.it` all'account Cloudflare e completare la configurazione DNS. Il token CLI attuale dispone di lettura delle zone, non della creazione: questa parte richiede l'accesso al pannello Cloudflare.

Prima di cambiare i nameserver su Register, confrontare tutti i record importati con quelli esistenti, soprattutto MX, SPF, DKIM, DMARC e verifiche di altri servizi. Usare solo i nameserver assegnati alla zona, senza inventarli. Quando la zona è attiva, associare il dominio al Worker tramite Custom Domains e verificare HTTPS, asset, redirect e invio reale alla lista Brevo. Il dominio può restare registrato presso Register.

Non creare `newsletter.thepeoplesroom.it` o un servizio/account Plesk dedicato: la pagina e l'API sono sullo stesso sito.

Riferimenti: [asset statici](https://developers.cloudflare.com/workers/static-assets/), [secret](https://developers.cloudflare.com/workers/configuration/secrets/), [domini personalizzati](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [limite richieste](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
