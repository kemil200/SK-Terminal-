const test=require('node:test'),assert=require('node:assert/strict');
const handler=require('./api/index.js');
async function call(url,method='GET'){let status,body;await handler({url,method,headers:{}},{writeHead(s){status=s},end(s){body=JSON.parse(s)}});return {status,body}}
test('Vercel rejette les méthodes et routes inconnues',async()=>{assert.equal((await call('/api/rss','POST')).status,405);assert.equal((await call('/api/unknown')).status,404)});
test('Vercel conserve les paramètres des routes réécrites',async()=>{assert.equal((await call('/api/index?route=africa/profile&country=invalid')).status,400)});
test('Le dossier public ne contient que les ressources du navigateur',()=>{const fs=require('node:fs');assert.deepEqual(fs.readdirSync(__dirname+'/dist').sort(),['index.html','styles.css','app.js','core.js','news.js','data.js','extensions.js','shortcuts.js'].sort())});
