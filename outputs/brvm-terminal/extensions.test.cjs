const test=require('node:test'),assert=require('node:assert/strict');
const {shortcutAction}=require('./shortcuts.js');
test('Raccourcis de navigation, saisie et modales',()=>{assert.equal(shortcutAction({key:'8',altKey:true}),'tab:8');assert.equal(shortcutAction({key:'9',altKey:true}),'tab:9');assert.equal(shortcutAction({key:'8',altKey:true},true),null);assert.equal(shortcutAction({key:'r',altKey:true},false,true),null);assert.equal(shortcutAction({key:'k',ctrlKey:true},true),'command');assert.equal(shortcutAction({key:'k',ctrlKey:true},false,true),null);assert.equal(shortcutAction({key:'r',altKey:true,repeat:true}),null);assert.equal(shortcutAction({key:'e',altKey:true}),'export');assert.equal(shortcutAction({key:'F1'}),'help');assert.equal(shortcutAction({key:'a'}),null)});
const {feedRoute,limitedText}=require('./feeds.cjs');
test('La route Afrique rejette les codes pays arbitraires',async()=>{assert.equal((await feedRoute(new URL('http://localhost/api/africa/profile?country=../../../'))).status,400)});
test('La lecture RSS borne la taille des réponses',async()=>{await assert.rejects(()=>limitedText(new Response('0123456789'),5),/volumineuse/);assert.equal(await limitedText(new Response('<rss/>'),100),'<rss/>')});

test('Chiffres physiques AZERTY',()=>{assert.equal(shortcutAction({key:'ç',code:'Digit9',altKey:true}),'tab:9');assert.equal(shortcutAction({key:'&',code:'Digit1',altKey:true},true),null)});
test('Alt+0 ouvre le dixième module (Macro)',()=>{assert.equal(shortcutAction({key:'0',altKey:true}),'tab:10');assert.equal(shortcutAction({key:'à',code:'Digit0',altKey:true}),'tab:10')});
