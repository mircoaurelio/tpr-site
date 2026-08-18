# TPR — audit Figma e integrazioni

Audit eseguito il 18 agosto 2026 sul canvas Figma autenticato, sugli export locali e sul sito servito in locale. Il connettore Figma non ha potuto leggere il file programmaticamente perché richiede accesso di modifica; le note sono state quindi lette direttamente nell'interfaccia Figma e documentate con screenshot.

## Note Figma controllate

| Node | Nota | Esito |
|---|---|---|
| `260:6912` | Hero: video in loop; click con zoom-in/player | **Bloccato:** manca l'asset video e il player è annotato come “ancora da definire”. Il sito conserva un placeholder esplicito. |
| `260:6913` | CTA About/video; hover omini con tag che segue il mouse | CTA e hover **verificati**; il video dipende dal gap precedente. |
| `260:6909` | Omino della Room con idle motion e cambio postura | Cambio postura/stanza **verificato**. Idle isolato **bloccato:** il personaggio è fuso nell'export raster; serve il layer SVG separato. |
| `265:7913` | Logo home e menu full-screen | **Verificato.** |
| `265:7914` | Rooms sticky “ascensore” e barra a cinque icone | **Verificato** desktop/mobile, inclusi hash e deep-link. |
| `260:6911` | Dettaglio Room orizzontale, testo fisso, card fronte/retro | **Integrato e verificato** sulle cinque Room. |
| `265:7915` | Parallax/effetto 3D nella foto Eventi | **Verificato** con fallback reduced-motion. |
| `265:7916` | Due card Membership con destinazioni distinte | **Verificato.** Le pagine destinazione restano placeholder perché non esistono frame finali dedicati. |
| `265:7917` | Partner in scorrimento | **Verificato** come marquee automatico. |
| `265:7918` | Mockup App/Contatti in lieve salita allo scroll | **Verificato.** |
| `265:6967` | Cursore scintilla/occhio con effetto difference | **Verificato** su puntatori precisi. |
| `269:3431`, `260:4995`, `269:3432` | About, Eventi e Contatti: testi/struttura placeholder | Route presenti; contenuti non dichiarati definitivi. |

## Correzioni di questo pass

- Menu desktop riallineato al gruppo Figma da circa 624 px e mantenuta la transizione da 500 ms.
- Header reso trasparente durante l'Ascensore, lasciando visibili logo e menu sopra lo stage.
- Eliminata la duplicazione mobile delle icone incorporate nella tavola Room.
- Risolta la race dei deep-link e dei cambi hash nella stessa pagina.
- Rimossa visivamente la CTA extra “Prenota” dal piano Reformer della Homepage, assente nel prototipo.
- Ripristinato il pannello testuale fisso durante lo scorrimento orizzontale delle Room.
- Sostituita la modale card inventata con flip Front/Back inline da 500 ms, con ARIA coerente.
- Allineati i colori browser delle cinque Room; alias root reindirizzati alle route canoniche `/rooms/*/`.
- Prenota mantenuto nelle pagine dettaglio Coworking/Reformer, dove compare nei frame dedicati.

## QA tecnico

- 20 file HTML verificati.
- Zero riferimenti locali mancanti.
- Tutti gli script superano `node --check`.
- Homepage, About, Eventi, Contatti e cinque Room rispondono HTTP 200.
- Test live desktop e mobile: menu, Ascensore, CTA, deep-link, parallax, flip card e route.

## Limiti esterni

Per completare senza approssimazioni servono:

1. il file video Hero definitivo e la decisione sul player;
2. gli SVG/layer separati dei cinque omini per applicare l'idle motion senza duplicare la sagoma;
3. i webfont originali PP Rader e Alte Haas Grotesk, non presenti negli export disponibili.

Le interazioni Smart Animate non sono esposte integralmente dal connettore disponibile; gli stati sono stati ricostruiti dalle note, dai frame visibili e dal prototipo live.

