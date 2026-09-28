# Coming soon su Cloudflare

Un Worker serve gli asset statici e `/api/newsletter` sullo stesso dominio. La chiave Brevo è un secret del Worker; non è inclusa nel repository o nei file pubblici. L'API riusa `server/newsletter.mjs`, impone lista 2 e `FONTE: Landing` e aggiorna i contatti esistenti.

## Stato al 28 settembre 2026

- Pubblicazione nell'account `social@thepeoplesroom.it`: https://tpr-coming-soon.tpr-coming-soon.workers.dev/
- Il Worker `tpr-coming-soon` dell'account personale precedente è stato eliminato su richiesta dell'utente.
- `wrangler.jsonc` fissa l'account TPR; `scripts/wrangler_tpr.mjs` usa credenziali locali separate da quelle personali.
- Secret `BREVO_API_KEY` configurato nell'account TPR. La chiave è stata verificata via API Brevo: account `social@thepeoplesroom.it`, azienda The People's Room, lista 2 `Contatti TPR`, attributo `FONTE` di tipo testo.
- Form disabilitato nella build pubblica (`data-endpoint=""`): manca il link dell'informativa privacy definitiva.
- Zona `thepeoplesroom.it` aggiunta all'account TPR con piano Free e stato `pending`. Importati 13 record; record di posta, DKIM, FTP e sito attuale mantenuti DNS-only. La scansione deve ancora essere confrontata con l'elenco completo di Register, che richiede un codice temporaneo del titolare. Nameserver Register invariati, sito principale ancora su Framer.
- 15 test superati, incluso il runtime nativo workerd. Prova reale sul Worker pubblico completata: creazione e reinvio dello stesso contatto, verifica della lista 2 e `FONTE=Landing` via API Brevo, rimozione del contatto temporaneo. Il form pubblico resta comunque disabilitato finché manca l'informativa.

## Sviluppo e pubblicazione

Con Node 22+ e un account Cloudflare autorizzato:

```sh
npm ci
npm run test:newsletter
npm run build:cloudflare
node scripts/wrangler_tpr.mjs deploy --dry-run
npm run deploy:cloudflare
```

Per i comandi account usare sempre lo stesso wrapper, ad esempio `node scripts/wrangler_tpr.mjs whoami`. Il login separato è `node scripts/wrangler_tpr.mjs login --scopes account:read user:read workers_scripts:write workers_routes:write zone:read`. L'email Cloudflare TPR è stata verificata.

Il comando di deploy pubblica una build con iscrizioni disabilitate per default. La directory `dist-cloudflare` contiene soltanto HTML, CSS, JavaScript, asset, `robots.txt` e `_headers`. Viene rigenerata integralmente; non usarla per file da conservare.

Per configurare o ruotare la chiave, usare il prompt riservato di `node scripts/wrangler_tpr.mjs secret put BREVO_API_KEY`. Non passare la chiave come argomento, non salvarla in `wrangler.jsonc` e non inserirla nel frontend.

Per attivare le iscrizioni, impostare `NEWSLETTER_ENABLED=true` e `PRIVACY_POLICY_URL` all'URL HTTPS dell'informativa approvata prima di eseguire `npm run deploy:cloudflare`. La build collega entrambi i link Privacy Policy e imposta il form su `/api/newsletter`. L'origine effettiva deve comparire in `NEWSLETTER_ALLOWED_ORIGINS`; sono già inclusi dominio principale, www, GitHub e l'indirizzo workers.dev dell'account TPR. L'account Iubenda fornito è stato controllato: non contiene ancora una policy per TPR.

La chiamata Brevo usa `redirect: 'manual'` e accetta solo risposte 200/201/204. Il runtime workerd usato dal provider rifiuta `redirect: 'error'`; il test nativo previene questa regressione e verifica che eventuali redirect non ricevano la chiave API.

Il limite nativo Cloudflare è 30 richieste per minuto per indirizzo, con chiave SHA-256. È un limite distribuito approssimato per sede Cloudflare, non un contatore globale. Se il binding manca o fallisce, l'API restituisce 503 e non contatta Brevo. Il filtro Origin protegge l'uso nel browser, ma non sostituisce l'autenticazione.

## Collegamento del dominio

L'accesso FTP non è necessario. La zona `thepeoplesroom.it` è già stata aggiunta dal pannello Cloudflare dell'account TPR. Il token CLI dispone di lettura delle zone, non della modifica dei DNS: completare questa parte nel pannello.

Prima di cambiare i nameserver su Register, confrontare tutti i record importati con quelli esistenti, soprattutto MX, SPF, DKIM, DMARC e verifiche di altri servizi. Usare solo i nameserver assegnati alla zona, senza inventarli. Quando la zona è attiva, associare il dominio al Worker tramite Custom Domains e verificare HTTPS, asset, redirect e invio reale alla lista Brevo. Il dominio può restare registrato presso Register.

Non creare `newsletter.thepeoplesroom.it` o un servizio/account Plesk dedicato: la pagina e l'API sono sullo stesso sito.

Riferimenti: [asset statici](https://developers.cloudflare.com/workers/static-assets/), [secret](https://developers.cloudflare.com/workers/configuration/secrets/), [domini personalizzati](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [limite richieste](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
