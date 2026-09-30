# Coming soon su Cloudflare

Un Worker serve gli asset statici e `/api/newsletter` sullo stesso dominio. La chiave Brevo è un secret del Worker; non è inclusa nel repository o nei file pubblici. L'API riusa `server/newsletter.mjs`, impone lista 2 e `FONTE: Landing` e aggiorna i contatti esistenti.

## Stato al 30 settembre 2026

- Pubblicazione nell'account `social@thepeoplesroom.it`: https://tpr-coming-soon.tpr-coming-soon.workers.dev/
- Il Worker `tpr-coming-soon` dell'account personale precedente è stato eliminato su richiesta dell'utente.
- `wrangler.jsonc` fissa l'account TPR; `scripts/wrangler_tpr.mjs` usa credenziali locali separate da quelle personali.
- Secret `BREVO_API_KEY` configurato nell'account TPR. La chiave è stata verificata via API Brevo: account `social@thepeoplesroom.it`, azienda The People's Room, lista 2 `Contatti TPR`, attributo `FONTE` di tipo testo.
- Form disabilitato nella build pubblica (`data-endpoint=""`): manca il link dell'informativa privacy definitiva.
- Zona `thepeoplesroom.it` nell'account TPR, piano Free. Confrontati tutti i 17 record applicativi con l'esportazione Register e completati i quattro record mancanti dalla scansione.
- Cambio nameserver salvato su Register il 30 settembre alle 12:56 Europe/Rome: `boyd.ns.cloudflare.com` e `colette.ns.cloudflare.com`. Il registro `.it` restituisce entrambi dalle 13:07; Cloudflare è `active` dalle 13:10. I resolver possono conservare i precedenti indirizzi Framer fino alla scadenza delle rispettive cache.
- Root e `www` associati al Worker con Custom Domains, deploy completato (versione `3b606ffc-e7c1-4ea5-a5ca-a424af2abf1f`). Sostituiti soltanto i due record A Framer del dominio principale e il CNAME Framer di `www`; preservati i 14 record di posta e altri servizi. La tabella Cloudflare contiene ora 16 record.
- DNSSEC Register disabilitato per il trasferimento; vecchio DS assente dal 29 settembre. Riattivare la firma Cloudflare e registrare il nuovo DS su Register dopo la propagazione dei nameserver, senza riutilizzare il vecchio DS.
- Certificato HTTPS gestito da Cloudflare attivo per root e `www`; abilitato `Always Use HTTPS`. Verifica diretta sugli IP autorevoli Cloudflare: TLS valido su entrambi i domini, HTML identico alla build e 18 asset/file pubblici verificati. Confermati MX Google/PEC, DKIM Brevo, SPF e DMARC dalla nuova autorità DNS.
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

Il dominio resta registrato presso Register; il DNS passa a Cloudflare. I Custom Domains sono definiti in `wrangler.jsonc`, quindi i deploy successivi mantengono root e `www` collegati al Worker. Cloudflare gestisce i record del sito e i certificati. Non ricreare i vecchi A/CNAME Framer, che entrerebbero in conflitto con questi collegamenti.

Prima di considerare conclusa l'attivazione, verificare stato della zona `active`, HTTPS e asset sia sul dominio principale sia su `www`, redirect `/coming-soon/` verso `/`, e conservazione dei record MX/SPF/DKIM/DMARC. La prova Brevo sul dominio finale deve seguire l'attivazione del form con informativa approvata.

Non creare `newsletter.thepeoplesroom.it` o un servizio/account Plesk dedicato: la pagina e l'API sono sullo stesso sito.

Riferimenti: [asset statici](https://developers.cloudflare.com/workers/static-assets/), [secret](https://developers.cloudflare.com/workers/configuration/secrets/), [domini personalizzati](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [limite richieste](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
