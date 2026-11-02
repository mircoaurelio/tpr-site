import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {configureSeo} from '../scripts/seo_metadata.mjs';

const content=JSON.parse(await readFile(new URL('../design/updated-content.json',import.meta.url),'utf8'));
const origin='https://thepeoplesroom.it';
const shell='<html><head><title>Preview</title><meta name="robots" content="noindex,follow"></head><body></body></html>';
const schema=html=>[...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>JSON.parse(m[1]));

test('Home identifies TPR Milano and its full brand in unique, matching search/share metadata',()=>{
 const html=configureSeo(shell,'/homepage-tpr/',content);
 assert.match(html,/<title>TPR Milano \| The People's Room: coworking e Pilates<\/title>/);
 assert.match(html,/<meta property="og:title" content="TPR Milano \| The People's Room: coworking e Pilates">/);
 assert.match(html,/<meta name="description" content="TPR .*The People's Room.*Milano.*Reformer Pilates/);
 assert.match(html,/<meta name="description" content="TPR - The People's Room/);
 assert.doesNotMatch(html,/—/,'public search/share metadata uses the requested hyphen');
 assert.match(html,/<link rel="canonical" href="https:\/\/thepeoplesroom.it\/">/);
 assert.doesNotMatch(html,/noindex|Coming soon/i);
});

test('Home and About naturally connect the abbreviation, full name and city in visible copy',()=>{
 for(const paragraph of [content.home.intro[0],content.about.body[0]]){
  assert.match(paragraph,/The People's Room \(TPR\)/);
  assert.match(paragraph,/Milano/);
 }
});

test('WebSite publisher and public business use one stable, truthful organization identity',async()=>{
 const home=schema(configureSeo(shell,'/homepage-tpr/',content));
 const website=home.find(s=>s['@type']==='WebSite'),organization=home.find(s=>s['@type']==='Organization');
 assert.ok(organization,'Home must describe the full-name/acronym identity');
 assert.equal(website.publisher['@id'],organization['@id']);
 assert.equal(organization['@id'],origin+'/#organization');
 assert.equal(organization.name,"The People's Room");assert.equal(organization.alternateName,'TPR');
 assert.equal(website.alternateName,'TPR');assert.equal(website.inLanguage,'it-IT');
 assert.equal(organization.url,origin+'/');
 const logo=new URL(organization.logo);assert.equal(logo.origin,origin);
 assert.ok((await readFile(new URL('..'+logo.pathname,import.meta.url),'utf8')).includes('<svg'));
 const location=schema(configureSeo(shell,'/contatti/',content)).find(s=>s['@type']==='LocalBusiness');
 assert.equal(location['@id'],organization['@id']);assert.equal(location.alternateName,'TPR');assert.equal(location.url,organization.url);
 assert.equal(location.address.streetAddress,'Via Cola Montano, 36');assert.equal(location.address.addressLocality,'Milano');
 assert.equal(location.openingHoursSpecification.opens,'07:00');assert.equal(location.openingHoursSpecification.closes,'22:00');
 assert.doesNotMatch(JSON.stringify(home)+JSON.stringify(location),/Olgiati|aggregateRating|review|priceRange|telephone|sameAs|geo/);
});

test('reapplying SEO replaces owned identity data without deleting unrelated JSON-LD',()=>{
 const unrelated='<script type="application/ld+json">{"@type":"BreadcrumbList","@id":"https://thepeoplesroom.it/#crumbs"}</script>';
 const first=configureSeo(shell.replace('</head>',unrelated+'</head>'),'/homepage-tpr/',content);
 const second=configureSeo(first,'/homepage-tpr/',content);
 assert.deepEqual(schema(second),schema(first),'one copy of each owned entity, foreign schema preserved');
 assert.equal((second.match(/<title>/g)||[]).length,1);
 assert.equal(schema(second).filter(s=>s['@type']==='BreadcrumbList').length,1);
});

test('unreviewed location changes fail visibly instead of publishing guessed hours',()=>{
 const changed=structuredClone(content);changed.visit.days='Sempre aperto';
 assert.throws(()=>configureSeo(shell,'/contatti/',changed),/Review the public location schema/);
});
