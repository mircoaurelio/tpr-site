"""Build the native HTML preview from the retrieved Versione Aggiornata copy.

Run with: python scripts/build_updated_preview.py
Uses the supplied PDF exports as the source for available static artwork.
Remaining room assets are recorded in design/asset-status.json.
"""
from pathlib import Path
import json, html, re

ROOT=Path(__file__).resolve().parents[1]
DATA=json.loads((ROOT/'design/updated-content.json').read_text(encoding='utf-8'))
SLOTS=json.loads((ROOT/'design/figma-slots.json').read_text(encoding='utf-8'))['roles']
ASSET_FILE=ROOT/'design/asset-files.json'
ASSETS=json.loads(ASSET_FILE.read_text(encoding='utf-8')).get('assets',{}) if ASSET_FILE.exists() else {}
for i,name in enumerate(['partner-1.svg','partner-2-revo.svg','partner-3.svg','partner-4.svg'],1):
 ASSETS[f'partners.{i}']={'path':'assets/figma-updated/partners/'+name}
COMPOSITES={'home.hero-window':'home-hero-photo-eye-2x.webp','home.events-window':'home-events-photo-eye-2x.webp','home.coworking-window':'home-coworking-photo-eye-2x.webp'}
for role,name in COMPOSITES.items():
 ASSETS[role]={'path':'assets/figma-updated/composites/'+name}
ASSETS['home.hero-mobile-photo']=ASSETS.get('home.hero',{}).get('embedded_photo',{})
PAGE='home'
DECORATIONS=json.loads((ROOT/'design/page-decorations.json').read_text(encoding='utf-8'))
E=html.escape
ROOMS=[('coworking','Coworking'),('reformer','TPR Move'),('wellness','Recharge'),('bar','Fuel'),('media','Media')]
PRIVACY=DATA['legal']['privacy']; COOKIE=DATA['legal']['cookie']
def paras(items,cls=''):
 return ''.join(f'<p class="{cls}">{E(v)}</p>' for v in items)
def link(root,path,label,cls=''):
 return f'<a class="{cls}" href="{root}{path}">{label}</a>'
def img(root,path,alt='',cls='',extra=''):
 return f'<img class="{cls}" src="{root}assets/{path}" alt="{E(alt)}" decoding="async" {extra}>'
def slot_source(role,field='layer_id'):
 sources=SLOTS.get(role,{}).get('sources',{});d=sources.get(PAGE,next(iter(sources.values()),{}))
 return d.get(field,d.get('layer_id',''))
def asset_image(root,role,alt='',extra=''):
 item=ASSETS.get(role,{})
 path=item if isinstance(item,str) else item.get('path','')
 if not path or not (ROOT/path).is_file():return ''
 return f'<img src="{root}{E(path)}" alt="{E(alt)}" decoding="async" {extra}>'
def media(root,role,cls,alt='',fallback=''):
 image=asset_image(root,role,alt)
 pending='' if image else f' data-pending-figma-image="{slot_source(role)}"'
 return f'<div class="{cls}" data-asset-role="{role}" data-figma-node="{slot_source(role)}"{pending}>{image or fallback}</div>'
def body_wordmark(root):
 return '<span class="preview-body-wordmark">'+img(root,'figma-updated/composites/home-about-wordmark-original.svg',"The People’s Room™",'preview-body-wordmark-source')+'<span class="preview-body-trademark" aria-hidden="true">'+img(root,'brand/Logotype_blue.svg','')+'</span></span>'
def head(root,title,home=False):
 legacy=f'<link rel="stylesheet" href="{root}shared-elevator.css?v=20261031-clean"><link rel="stylesheet" href="{root}updated-elevator.css?v=20261101-cardactions"><link rel="stylesheet" href="{root}home-layout.css?v=20261031-review">' if home else ''
 elevator=f'<script src="{root}shared-elevator.js?v=20261101-cardactions" defer></script><script src="{root}updated-elevator.js?v=20261031-clean" defer></script>' if home else ''
 return f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#2c64e8"><title>{E(title)} — The People's Room</title><meta name="description" content="The People's Room: coworking, movimento, cultura e benessere a Milano."><link rel="icon" href="{root}assets/tpr-character.svg" type="image/svg+xml"><link rel="preload" href="{root}assets/fonts/pp-rader/PPRader-Bold.otf" as="font" type="font/otf" crossorigin><link rel="stylesheet" href="{root}updated-preview.css?v=20261101-allcopy"><link rel="stylesheet" href="{root}figma-refinements.css?v=20261031-clean"><link rel="stylesheet" href="{root}pdf-assets.css?v=20261031-clean"><link rel="stylesheet" href="{root}page-layout.css?v=20261031-review">{legacy}<script src="{root}updated-preview.js?v=20261101-allcopy" defer></script>{elevator}<script src="{root}zigzag-controls.js?v=20261031-clean" defer></script></head>'''
def header(root,cta=False):
 return f'''<a class="skip-link" href="#main">Vai al contenuto</a><header class="preview-header"><a class="preview-brand" href="{root}homepage-tpr/" aria-label="The People's Room — Home">{img(root,'tpr-logo.svg',"The People's Room",extra='width="131" height="64"')}</a><div class="preview-header-actions">{link(root,'prenota/','Prenota il Pilates <span class="preview-chevron" aria-hidden="true"></span>','preview-button preview-button--outline') if cta else ''}<button class="preview-menu-button" type="button" data-menu-open aria-label="Apri il menu" aria-controls="siteMenu" aria-expanded="false">{img(root,'figma-updated/shapes/header-hamburger.svg','','preview-menu-glyph','aria-hidden="true"')}</button></div></header>'''
def menu(root):
 rooms=''.join(link(root,f'rooms/{key}/',img(root,f'little-man/{key}.svg',name,extra='width="112" height="180"'),'preview-menu-room') for key,name in ROOMS)
 return f'''<aside class="preview-menu" id="siteMenu" role="dialog" aria-label="Menu principale" aria-modal="true" aria-hidden="true" inert><a class="preview-menu-brand" href="{root}homepage-tpr/">{img(root,'tpr-logo.svg',"The People's Room")}</a><button class="preview-menu-close" type="button" data-menu-close aria-label="Chiudi il menu">×</button><nav><a href="{root}about/">About</a><div class="preview-menu-group"><a href="{root}homepage-tpr/#rooms">TPR Rooms</a><div class="preview-menu-rooms">{rooms}</div></div><a href="{root}vivi-tpr/">Vivi TPR</a><a href="{root}eventi/">Eventi &amp; Gallery</a><a href="{root}contatti/">Contatti</a><a class="preview-button preview-button--outline" href="{root}prenota/">Prenota il Pilates</a></nav></aside>'''
def footer(root,home=False):
 brand='brand/Logotype_blue.svg' if (ROOT/'assets/brand/Logotype_blue.svg').exists() else 'type-footer.png'
 links=''.join(link(root,p,t) for p,t in [('about/','About'),('vivi-tpr/','Vivi TPR'),('eventi/','Eventi &amp; Gallery'),('contatti/','Contatti')])
 roomlinks=''.join(link(root,f'rooms/{key}/',E(name)) for key,name in ROOMS)
 return f'''<footer class="preview-footer {'preview-footer--home' if home else ''}"><div class="preview-footer-top"><a class="preview-footer-wordmark {'is-artboard' if brand.endswith('.svg') else ''}" href="{root}homepage-tpr/" aria-label="TPR — Home">{img(root,brand,'TPR™')}</a><div class="preview-footer-columns"><nav aria-label="TPR"><h2>TPR</h2>{links}</nav><nav aria-label="Rooms"><h2>Rooms</h2>{roomlinks}</nav></div></div><div class="preview-footer-bottom"><div><span>© {E(DATA['legal']['company'])}</span><i>/</i><span>{E(DATA['legal']['address'])}</span><i>/</i><span>P. IVA {DATA['legal']['vat']}</span></div><div><a href="{PRIVACY}" target="_blank" rel="noopener">Privacy Policy</a><i>/</i><a href="{COOKIE}" target="_blank" rel="noopener">Cookie policy</a><i>/</i><a href="https://www.marmellatalab.com/" target="_blank" rel="noopener">Designed by <strong>Marmellata Lab</strong></a></div></div></footer>'''
def fields(subject,flat=False):
 return f'''<form class="preview-contact-form {'preview-contact-form--flat' if flat else ''}" data-inquiry-form data-subject="{E(subject)}"><div class="preview-fields"><label class="preview-select"><span class="sr-only">Tipologia utente</span><select name="user_type" required aria-label="Tipologia utente"><option value="">Tipologia utente*</option><option>Privato</option><option>Freelancer</option><option>Startup</option><option>Azienda</option></select></label><label><span class="sr-only">Nome e Cognome</span><input name="name" autocomplete="name" placeholder="Nome e Cognome*" required></label><label><span class="sr-only">Email</span><input name="email" type="email" autocomplete="email" placeholder="Email*" required></label><label><span class="sr-only">Telefono</span><input name="phone" type="tel" autocomplete="tel" placeholder="Telefono*" required></label><label class="preview-field-message"><span class="sr-only">Messaggio</span><textarea name="message" placeholder="Messaggio" rows="3"></textarea></label><button class="preview-submit" type="submit">Invia <span class="preview-chevron" aria-hidden="true"></span></button></div><p class="preview-form-status" role="status" aria-live="polite"></p></form>'''
def contact_card(root,subject='Informazioni TPR',event=False):
 title='Raccontaci che tipo di evento hai in mente e quando:<br>al resto pensiamo insieme.' if event else 'Raccontaci chi sei<br>e cosa cerchi.'
 return f'''<div class="preview-contact-card preview-paper {'preview-contact-card--event' if event else ''}"><div class="preview-form-heading"><div><h2>{title}</h2><p>Ti rispondiamo il prima possibile.</p></div>{img(root,'tpr-character.svg','',extra='width="64" height="80" aria-hidden="true"')}</div>{fields(subject,event)}</div>'''
def map_card(root):
 return f'''<a class="preview-map-card preview-paper" href="https://www.google.com/maps/search/?api=1&amp;query=Via+Cola+Montano+36+Milano" target="_blank" rel="noopener">{media(root,'contact.map','preview-map-image','Mappa della zona Isola a Milano')}<div class="preview-map-caption"><p><strong>{DATA['visit']['address']}</strong><br>{DATA['visit']['city']}</p><p><strong>{DATA['visit']['days']}</strong><br>{DATA['visit']['hours']}</p></div></a>'''
def contact_section(root):
 return f'''<section class="preview-contact-section" id="contattaci" data-figma-node="616:2469"><h2 class="preview-section-title preview-centered">Contattaci</h2><div class="preview-contact-row">{contact_card(root)}{map_card(root)}</div></section>'''
def newsletter(root,vivi=False):
 n=DATA['newsletter'];return f'''<section class="preview-newsletter preview-shell" id="community" data-figma-node="677:1739"><div class="preview-two-columns"><h2 class="preview-section-title">{n['title']}</h2><div class="preview-lead">{paras([DATA['vivi']['communityIntro'],n['description']] if vivi else [n['description']])}</div></div><form class="preview-newsletter-form" data-newsletter-form data-endpoint="https://thepeoplesroom.it/api/newsletter"><div class="preview-email-row"><label class="sr-only" for="newsletter-email">Indirizzo email</label><input id="newsletter-email" name="email" type="email" placeholder="Inserisci il tuo indirizzo email" autocomplete="email" required><button type="submit" disabled>Resta aggiornato</button></div><label class="preview-consent"><input name="consent" type="checkbox" required><span>{E(n['consent'])} <a href="{PRIVACY}" target="_blank" rel="noopener">Privacy Policy</a>.</span></label><label class="preview-trap" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><p class="preview-form-status" role="status" aria-live="polite"></p></form></section>'''
def offer_cards(root):
 cards=[]
 for i,o in enumerate(DATA['offers']):
  tags=''.join(f'<span>{E(t)}</span>' for t in o['tags']);benefits=''.join(f'<li class="{"is-excluded" if t.startswith("✕") else ""}">{E(t)}</li>' for t in o['benefits'])
  cta_class='preview-button--solid' if i==0 else 'preview-button--blue-outline'
  role='offers.'+o['id']
  cards.append(f'''<article class="preview-offer-card preview-paper" id="{o['id']}" data-figma-node="{slot_source(role,'card_layer_id')}">{media(root,role,'preview-offer-media',o['title'])}<div class="preview-offer-body"><div class="preview-offer-summary"><p class="preview-offer-eyebrow">{E(o['eyebrow'])}</p><h3>{E(o['title'])}</h3><p class="preview-offer-description">{E(o['description'])}</p></div><div class="preview-offer-tags">{tags}</div>{'<ul>'+benefits+'</ul>' if benefits else ''}<a class="preview-button {cta_class}" href="{root}contatti/?offer={o['id']}">{E(o['cta'])}</a></div></article>''')
 initial=' data-initial-scroll="end"' if PAGE=='vivi' else ''
 return '<div'+initial+' class="preview-offer-carousel" tabindex="0" role="region" aria-label="Offerte TPR, scorri per esplorare" data-carousel>'+''.join(cards)+'</div>'
def company(root):
 c=DATA['company'];return f'''<section class="preview-company" id="aziende"><h2 class="preview-section-title preview-centered">{E(c['title'])}</h2><div class="preview-company-card preview-paper">{media(root,'offers.company','preview-company-media','Gli spazi TPR per aziende e startup')}<div class="preview-company-copy"><div class="preview-company-text"><h3>{E(c['subtitle'])}</h3><div><p>{E(c['description'])}</p><p>Alcuni vantaggi esclusivi che puoi sbloccare:</p><ul>{''.join('<li>✓ '+E(t)+'</li>' for t in c['benefits'])}</ul></div></div>{fields('Offerte startup e aziende')}</div></div></section>'''
def wordmark(root):
 return '<span class="preview-inline-wordmark">'+img(root,'brand/Logotype_blue.svg','TPR™')+'</span>'
def offers(root,heading='Vivi TPR'):
 title='<span class="preview-cap-text">Vivi</span> '+wordmark(root) if heading=='Vivi TPR' else E(heading)
 subtitle='<p>Offerte per privati, freelance e startup</p>' if heading=='Vivi TPR' else ''
 banner=f'<a class="preview-pilates-banner" href="{root}prenota/"><strong>Vuoi iniziare col Reformer Pilates?</strong><span>Prenota la tua lezione</span></a>' if heading=='Vivi TPR' else ''
 return f'''<section class="preview-offers preview-shell" id="offerte"><div class="preview-offers-heading"><h2 class="preview-section-title">{title}</h2>{subtitle}</div>{offer_cards(root)}{banner}{company(root)}</section>'''
def vivi(root):
 intro=paras(DATA['vivi']['intro'])
 return f'<section class="preview-vivi-intro preview-shell"><div class="preview-two-columns"><h1 class="preview-section-title"><span class="preview-cap-text">Vivi</span> {wordmark(root)}</h1><div class="preview-lead">{intro}</div></div></section>'+offers(root,'Scopri le offerte')+newsletter(root,True)
def about_selector(root):
 labels=[('community','Community'),('reformer','TPR Move'),('wellness','TPR Recharge'),('media','TPR Media'),('bar','TPR Fuel'),('coworking','TPR Coworking')]
 buttons=''.join(f'<button type="button" data-discover="{key}" class="preview-discover-button preview-discover-button--{key}" aria-pressed="false">{label}</button>' for key,label in labels)
 return f'''<section class="preview-discover" aria-label="Scopri TPR" data-figma-node="809:2800">{buttons}<div class="preview-discover-content" aria-live="polite"><h2><span class="preview-cap-text">Scopri</span><br>{wordmark(root)}</h2><p>Seleziona una voce per esplorare gli spazi e le persone che li abitano.</p></div></section>'''
def about(root):
 d=DATA['about'];return f'''<section class="preview-shell preview-page-section preview-about" data-figma-node="616:2410"><div class="preview-two-columns"><h1 class="preview-about-logo">{body_wordmark(root)}</h1><div class="preview-lead">{paras(d['intro'])}</div></div><div class="preview-two-columns preview-manifesto"><article class="preview-manifesto-card">{paras(d['respira'])}<h2>Respira.</h2></article><article class="preview-manifesto-card">{paras(d['ispira'])}<h2>Ispira.</h2></article></div><div class="preview-two-columns"><h2 class="preview-section-title">TPR è energia,<br>musica,<br>connessioni</h2><div class="preview-body-copy">{paras(d['body'])}</div></div>{about_selector(root)}<div class="preview-feature-cards"><a href="{root}vivi-tpr/" class="preview-feature-card preview-paper" >{media(root,'about.offers','preview-feature-media','Scopri le offerte TPR')}<span>Scopri le offerte {img(root,'route-arrow-zigzag.png','',extra='width="48" height="48" aria-hidden="true"')}</span></a><a href="{root}eventi/" class="preview-feature-card preview-paper" >{media(root,'about.events','preview-feature-media','Un evento TPR')}<span>Eventi {img(root,'route-arrow-zigzag.png','',extra='width="48" height="48" aria-hidden="true"')}</span></a></div>{contact_section(root)}</section>'''
def contacts(root):
 return f'''<section class="preview-shell preview-page-section preview-contacts" data-figma-node="616:2572"><div class="preview-two-columns"><h1 class="preview-section-title">Contatti</h1><p class="preview-lead">{E(DATA['contacts']['intro'][0])}</p></div><div class="preview-contact-row">{contact_card(root)}{map_card(root)}</div></section>'''
def events(root):
 cards=[]
 for title,person,role in [('Shamans Ritual','','events.shamans-ritual'),('The Dinner','@casa_buri','events.the-dinner'),('Ceramic Workshop','@casa_buri','events.ceramic-workshop'),('The People’s Week Talk','','events.the-peoples-week-talk')]:
  cards.append(f'<article class="preview-event-card preview-paper" data-figma-node="{slot_source(role,'card_layer_id')}">{media(root,role,'preview-event-media',title)}<div><h3>{E(title)}</h3><p><span>Ottobre 2026</span><span>{E(person)}</span></p></div></article>')
 return f'''<section class="preview-shell preview-page-section preview-events" data-figma-node="616:2678"><div class="preview-two-columns"><h1 class="preview-section-title">TPR è energia,<br>musica,<br>connessioni</h1><div class="preview-lead">{paras(DATA['events']['intro'])}</div></div><section id="gallery" class="preview-event-gallery"><h2 class="preview-section-title preview-centered">Eventi passati</h2><div class="preview-event-carousel" data-initial-scroll="center" tabindex="0" role="region" aria-label="Eventi passati, scorri per esplorare" data-carousel>{''.join(cards)}</div></section><section class="preview-event-organize" id="organizza"><div class="preview-two-columns"><h2 class="preview-section-title">Organizza un<br>evento</h2><p class="preview-lead">{E(DATA['events']['organize'][0])}</p></div>{contact_card(root,'Organizza un evento',True)}</section></section>'''
def home(root):
 hero=(ROOT/'design/partials/home-hero.html').read_text(encoding='utf-8');people=(ROOT/'design/partials/home-people.html').read_text(encoding='utf-8')
 if asset_image(root,'home.hero-window'):
  hero='<section class="hero preview-hero--pdf" id="home" aria-labelledby="hero-title"><picture>'+asset_image(root,'home.hero-window','Lo spazio The People’s Room','class="preview-hero-composite" fetchpriority="high"')+'</picture><div class="hero-copy"><h1 id="hero-title"><span>Respira,</span><span>Ispira.</span></h1></div></section>'
 intro=f'''<section class="preview-home-about preview-shell"><div class="preview-two-columns"><div class="preview-about-logo">{body_wordmark(root)}</div><div class="preview-body-copy">{paras(DATA['home']['intro'])}<a class="preview-button preview-button--pink" href="{root}about/">About TPR</a></div></div>{people}<div class="preview-two-columns preview-rooms-intro"><h2 class="preview-section-title">TPR Rooms</h2><p class="preview-lead">{E(DATA['home']['roomIntro'][0])}</p></div></section>'''
 ev=f'''<section class="preview-home-events preview-shell"><div class="preview-two-columns"><h2 class="preview-section-title">Eventi</h2><div class="preview-body-copy">{paras(DATA['home']['events'])}<div class="preview-button-row"><a class="preview-button preview-button--solid" href="{root}eventi/">Eventi e Gallery</a><a class="preview-button preview-button--blue-outline" href="{root}eventi/#organizza">Organizza un evento</a></div></div></div><figure class="preview-home-event-photo preview-events--pdf" data-figma-node="616:1780">{asset_image(root,'home.events-window','Un evento The People’s Room','class="preview-event-composite"')}</figure></section>'''
 return hero+intro+room_explorer(root)+ev+'<div class="preview-membership">'+offers(root)+partners(root)+'</div>'+newsletter(root)

def partners(root):
 logos=''.join('<span data-asset-role="partners.'+str(i)+'">'+asset_image(root,'partners.'+str(i),'Partner TPR '+str(i))+'</span>' for i in range(1,5))
 return '<section class="preview-partners preview-shell" data-figma-node="791:1770"><h2>I nostri partner</h2><div class="preview-partner-logos" aria-label="Partner TPR">'+logos+'</div></section>'

def room_explorer(root,standalone=None):
 if not standalone:
  # Reuse the previous elevator and its panorama geometry. Only source-backed
  # asset/content overrides are supplied here; unmatched wide composites stay
  # on the originals so their embedded photo windows remain aligned.
  overrides={}
  shapes={'coworking':'coworking','reformer':'move','wellness':'recharge','bar':'fuel','media':'media'}
  for key,_ in ROOMS:
   d=DATA['rooms'][key]
   details=d.get('cardDetails',{})
   cards=[[label,details[label]['description'],details[label]['ctaLabels']] if label in details else [label,d['paragraphs'][0]] for label in d['cards']]
   overrides[key]={'title':d['title'],'paragraphs':d['paragraphs'],'character':f'little-man/{key}.svg','cards':cards,'comingSoonCards':[label for label in d['cards'] if label in ('longevity','studio audio')]}
   overrides[key]['icon']=f'figma-updated/shapes/room-toolbar-{shapes[key]}-default.svg' if key=='coworking' else f'elevator-icon-{key}.svg'
   overrides[key]['off']=f'elevator-icon-{key}-off.svg' if key=='coworking' else f'figma-updated/shapes/room-toolbar-{shapes[key]}-default.svg'
  overrides['coworking']['art']='figma-updated/composites/home-coworking-photo-eye-2x.webp'
  payload=json.dumps(overrides,ensure_ascii=False).replace('<','\\u003c')
  return '<section id="rooms" aria-label="TPR Rooms"><script type="application/json" data-elevator-config>'+payload+'</script></section>'
 colors={'coworking':('#98caff','#2c64e8'),'reformer':('#3f9941','#ffc100'),'wellness':('#c2d569','#3f9941'),'bar':('#eb642b','#ffc100'),'media':('#ffc100','#2c64e8')}
 keys=[standalone] if standalone else [key for key,_ in ROOMS]
 # Mask URLs in custom properties resolve in pdf-assets.css, not in this route.
 panels=[]
 for i,key in enumerate(keys):
  d=DATA['rooms'][key];bg,accent=colors[key];heading_tag='h1' if standalone else 'h2'
  cards=[]
  for card_index,label in enumerate(d['cards']):
   soon=label in ('longevity','studio audio')
   detail=d.get('cardDetails',{}).get(label)
   card_id=f'room-{key}-card-{card_index}'
   front=media(root,'rooms.'+key+'.cards.'+label.lower().replace(' ','-').replace('à','a'),'preview-room-card-photo',label)+f'<div class="preview-room-card-label"><h3 id="{card_id}-title">{E(label)}</h3>{"<small>coming soon</small>" if soon else "<span aria-hidden=\"true\">↗</span>"}</div>'
   back=''
   # Studio audio has only a coming-soon front in the source, not a Card Back.
   if detail and detail.get('ctaLabels'):
    front=f'<div class="preview-room-card-front" aria-hidden="false">{front}<button class="preview-room-card-open" type="button" data-room-card-open aria-labelledby="{card_id}-title" aria-controls="{card_id}-back" aria-expanded="false"></button></div>'
    default_route='prenota/' if key=='reformer' else 'vivi-tpr/'
    cta_routes={'Eventi e Gallery':'eventi/','Organizza un evento':'eventi/#organizza'}
    ctas=''.join(link(root,cta_routes.get(cta,default_route),E(cta)) for cta in detail['ctaLabels'])
    back=f'<div class="preview-room-card-back" id="{card_id}-back" data-figma-node="{detail["sourceNode"]}" aria-hidden="true" inert><div class="preview-room-card-back-top"><h3>{E(label)}</h3><button class="preview-room-card-close" type="button" data-room-card-close aria-label="Chiudi {E(label)}">Chiudi</button></div><p>{E(detail["description"])}</p><div class="preview-room-card-ctas">{ctas}</div></div>'
   cards.append(f'<article class="preview-room-card preview-paper">{front}{back}</article>')
  book=f'<a class="preview-button preview-button--room-outline" href="{root}{"prenota/" if key=="reformer" else "vivi-tpr/"}">{"Prenota" if key=="reformer" else "Scopri come accedere"}</a>' if key in ('coworking','reformer') and standalone else ''
  art=asset_image(root,'home.coworking-window','', 'class="preview-room-art preview-room-art--pdf" aria-hidden="true"') if key=='coworking' else ''
  art=art or img(root,f'homepage-room-{key}-no-text-2x.webp','', 'preview-room-art', 'aria-hidden="true" data-pending-figma-image="'+d['sourceNode']+'"')
  panels.append(f'''<div class="preview-room-panel" data-room-panel="{key}" style="--room-bg:{bg};--room-accent:{accent}" {'hidden' if i else ''} data-figma-node="{d['sourceNode']}">{art}<div class="preview-room-character" style="--room-character:url('assets/little-man/{key}.svg')">{img(root,f'little-man/{key}.svg','',extra='aria-hidden="true"')}</div><div class="preview-room-copy"><{heading_tag}>{d['title']}</{heading_tag}><div class="preview-room-body">{paras(d['paragraphs'])}<div class="preview-room-actions"><button class="preview-button" data-room-explore type="button" aria-expanded="false">Esplora Stanza <span class="preview-chevron" aria-hidden="true"></span></button>{book}</div></div></div><section class="preview-room-details" aria-label="Esplora {d['title']}" inert aria-hidden="true"><div class="preview-room-details-top"><h2>{d['title']}</h2><button class="preview-room-back" type="button" data-room-back>‹ Torna alla stanza</button></div><div class="preview-room-cards" tabindex="0" role="region" aria-label="Spazi {d['title']}" data-carousel>{''.join(cards)}</div></section></div>''')
 nav=''
 if not standalone:
  icons=[]
  shape_names={'coworking':'coworking','reformer':'move','wellness':'recharge','bar':'fuel','media':'media'}
  for i,(key,label) in enumerate(ROOMS):
   on=f'figma-updated/shapes/room-toolbar-{shape_names[key]}-default.svg' if key=='coworking' else f'elevator-icon-{key}.svg'
   off=f'elevator-icon-{key}-off.svg' if key=='coworking' else f'figma-updated/shapes/room-toolbar-{shape_names[key]}-default.svg'
   icons.append(f'<button type="button" data-room-select="{key}" aria-label="{label}" aria-pressed="{str(i==0).lower()}">{img(root,on,"","preview-room-icon--on"+(" preview-room-icon--painted" if key=="coworking" else ""),extra="aria-hidden=\"true\"")}{img(root,off,"","preview-room-icon--off"+(" preview-room-icon--painted" if key!="coworking" else ""),extra="aria-hidden=\"true\"")}</button>')
  nav='<nav class="preview-room-nav" aria-label="Scegli la tua stanza">'+''.join(icons)+'</nav><button type="button" class="preview-room-next" data-room-next aria-label="Stanza successiva">'+img(root,'figma-updated/shapes/room-next-circle-painted.svg','','',extra='aria-hidden="true"')+'</button>'

 return f'<section id="rooms" class="preview-room-explorer" aria-label="TPR Rooms" data-room-explorer>{"".join(panels)}{nav}</section>'
def booking(root):
 return f'''<section class="preview-shell preview-page-section preview-booking" data-figma-node="1065:3385"><div class="preview-two-columns"><h1 class="preview-section-title">{E(DATA['booking']['title'])}</h1><div class="preview-lead">{paras(DATA['booking']['intro'])}</div></div><section class="preview-booking-panel preview-paper" aria-label="Prenotazione Reformer Pilates" data-figma-node="1065:3390"><!-- Mindbody Schedules widget begin --><div class="mindbody-widget" data-widget-type="Schedules" data-widget-id="4581434fffc"></div><script async src="https://brandedweb.mindbodyonline.com/embed/widget.js"></script><!-- Mindbody Schedules widget end --></section></section>'''
def write(path,title,body,kind='blue',home_page=False):
 global PAGE
 PAGE={'homepage-tpr':'home','contatti':'contacts','eventi':'events','prenota':'booking','vivi-tpr':'vivi'}.get(Path(path).parts[0],Path(path).parts[0])
 depth=len(Path(path).parts)-1;root='../'*depth
 classes=f'updated-preview updated-preview--{kind} preview-page--{PAGE}'
 decor=''.join(f'<img src="{root}{r["path"]}" alt="" aria-hidden="true" class="preview-decoration preview-decoration--{r["name"]}" style="--decor-x:{r["css"]["left_px"]};--decor-y:{r["css"]["top_px"]};--decor-w:{r["css"]["width_px"]}">' for r in DECORATIONS if r['name'].startswith(PAGE+'-'))
 source=head(root,title,home_page)+f'<body class="{classes}">'+header(root,home_page)+menu(root)+f'<main id="main"><div class="preview-page-art" aria-hidden="true">'+decor+'</div>'+body(root)+f'</main>'+footer(root,home_page)
 source+='</body></html>\n';target=ROOT/path;target.parent.mkdir(parents=True,exist_ok=True);source=re.sub(r'(<p\b[^>]*>)\s*(</p>)',r'\1\2',source.replace('><','>\n<'))
 target.write_text('\n'.join(line.rstrip() for line in source.splitlines())+'\n',encoding='utf-8')
write('homepage-tpr/index.html','Respira, ispira',home,home_page=True)
write('about/index.html','About TPR',about)
write('contatti/index.html','Contatti',contacts)
write('eventi/index.html','Eventi & Gallery',events,'pink')
write('vivi-tpr/index.html','Vivi TPR',lambda root:'<div class="preview-vivi preview-page-section">'+vivi(root)+'</div>')
write('prenota/index.html','Prenota il Pilates',booking,'green')
for key,label in ROOMS:
 write(f'rooms/{key}/index.html',label,lambda root,key=key:room_explorer(root,key))
for p,anchor in [('membership/aziende-startup/index.html','aziende'),('membership/privati-freelancer/index.html','offerte')]:
 target='../../vivi-tpr/#'+anchor
 (ROOT/p).write_text(f'<!doctype html><html lang="it"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url={target}"><title>Vivi TPR</title><script>location.replace({json.dumps(target)});</script><a href="{target}">Scopri le offerte TPR</a></html>\n',encoding='utf-8')
print('Built updated homepage, About, contacts, events, Vivi TPR and Pilates pages with shared native components.')
