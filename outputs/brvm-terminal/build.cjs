const fs=require('node:fs'),path=require('node:path');
const output=path.join(__dirname,'dist');
fs.mkdirSync(output,{recursive:true});
for(const file of ['index.html','styles.css','app.js','core.js','news.js','data.js','extensions.js','shortcuts.js'])fs.copyFileSync(path.join(__dirname,file),path.join(output,file));
console.log('SK-TERMINAL : 8 fichiers publics préparés.');
