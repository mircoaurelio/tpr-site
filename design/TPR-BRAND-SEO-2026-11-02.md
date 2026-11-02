# TPR e TPR Milano — SEO e Search Console

Intervento del 2 novembre 2026 sul sito [thepeoplesroom.it](https://thepeoplesroom.it/).

## Modifiche al sito

- Titolo della Home: **TPR Milano | The People's Room: coworking e Pilates**.
- Descrizione della Home dedicata al brand e ai servizi di Milano; descrizioni About/Contatti aggiornate per associare anche la sigla TPR al nome completo. I metadati Open Graph restano coerenti con il titolo e la descrizione di ciascuna pagina.
- Breve aggiornamento delle introduzioni visibili in Home e About: «The People's Room (TPR)» e Milano compaiono insieme in un testo naturale. Nessun blocco nascosto o ripetizione artificiale di parole chiave.
- `WebSite` della Home collegato a un'entità `Organization`, con nome completo, nome alternativo TPR e logo blu originale. La pagina Contatti descrive la stessa attività come `LocalBusiness`, con il medesimo identificatore e con indirizzo di visita e orari effettivamente pubblicati.
- Indirizzo di visita: **Via Cola Montano, 36, 20159 Milano MI**. Orari: **lunedì–venerdì, 07:00–22:00**. Non viene confuso con l'indirizzo della sede legale nel footer.
- La generazione dei metadati sostituisce i propri JSON-LD senza duplicarli e conserva eventuali dati strutturati estranei. Nessun numero telefonico, profilo social, recensione, coordinata o prezzo inventato.
- L'anteprima GitHub rimane `noindex`; la produzione rimane indicizzabile con URL canonici e sitemap delle 11 pagine pubbliche.

## Verifiche

- 5 test SEO dedicati superati, dopo aver verificato quattro errori attesi sulla versione precedente.
- 9 test di build superati, inclusi metadati unici, schema nell'HTML pubblico, logo disponibile, redirect e configurazione newsletter.
- Test del generatore e 3 test dell'audit SEO superati; audit dell'artefatto di produzione senza errori sulle 11 pagine canoniche e sulla sitemap.
- 18 casi di controllo in Chromium/WebKit su Home, About e Contatti, a 320, 393 e 1512 px: testo visibile, metadati, JSON-LD e assenza di debordamenti orizzontali. Nessun invio reale di form.
- Revisione indipendente del codice e dei dati strutturati: nessun rilievo azionabile. Gli stili, i cursori, le animazioni, i caroselli e le prenotazioni non sono stati modificati da questo intervento.

## Search Console: configurazione completata

Proprietà **Dominio thepeoplesroom.it verificata** con l’account aziendale **social@thepeoplesroom.it**. La proprietà comprende dominio principale, www e varianti di protocollo. Verifica eseguita con un solo nuovo record TXT in Cloudflare; conservarlo per mantenere la verifica. Gli altri record DNS non sono stati modificati. Nessuna proprietà è stata concessa all’account personale.

Sitemap **https://thepeoplesroom.it/sitemap.xml inviata e letta con stato Success**: Google ha rilevato **11 pagine**, il 2 novembre 2026. I report Rendimento/Indicizzazione sono ancora in elaborazione: non esiste ancora una base sufficiente per dichiarare posizioni o traffico.

Link operativi, da aprire con l’account TPR:

- [Proprietà TPR in Search Console](https://search.google.com/u/1/search-console?resource_id=sc-domain%3Athepeoplesroom.it).
- [Sitemap e 11 pagine rilevate](https://search.google.com/u/1/search-console/sitemaps?resource_id=sc-domain%3Athepeoplesroom.it).
- [Rendimento: ricerche TPR e TPR Milano](https://search.google.com/u/1/search-console/performance/search-analytics?resource_id=sc-domain%3Athepeoplesroom.it).

Controllo URL completato: la **Home è già nell'indice Google**; al momento dell'ispezione la pagina **Coworking non era ancora indicizzata**. Per entrambe Google ha accettato la richiesta di indicizzazione, confermando l'aggiunta alla coda prioritaria di scansione. Una richiesta accettata non equivale a un'indicizzazione già completata o a una posizione garantita per «TPR».

## Validazione esterna

Il validatore Schema.org ha letto il sito pubblico aggiornato: **0 errori e 0 avvisi** sia per il WebSite con la sua organizzazione nella Home sia per il LocalBusiness in Contatti.

Il [test Google della pagina Contatti](https://search.google.com/test/rich-results/result?id=JSl8YudQQirXh68eRQS3Mw) rileva **2 elementi validi** (Attività locali e Società), senza errori bloccanti. Per l’attività locale restano due suggerimenti facoltativi: `telephone` e `priceRange`. Non sono stati compilati con valori inventati; non impediscono la validità rilevata da Google.

## Pubblicazione

Aggiornamento pubblicato su entrambi i domini nella release Cloudflare `7819d4b2-27ee-4029-af40-879c74d3342d`. Verificati 47 file pubblici corrispondenti all’artefatto e 18 ulteriori casi desktop/mobile in Chromium e WebKit sul dominio pubblico. I controlli comprendono titoli, canonical, robots, schema e testi delle pagine modificate; nessun invio reale di form. Prove e schermate conservate nella cartella privata `.qa/seo-brand-20261102/`.

Le modifiche aiutano a descrivere il brand e il contesto locale; non garantiscono una posizione specifica per una sigla generica come TPR. La comparsa dei nuovi titoli richiede che il motore rilegga il sito. Riferimenti ufficiali: [nomi dei siti](https://developers.google.com/search/docs/appearance/site-names), [Organization](https://developers.google.com/search/docs/appearance/structured-data/organization), [LocalBusiness](https://developers.google.com/search/docs/appearance/structured-data/local-business), [nuova scansione](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).
