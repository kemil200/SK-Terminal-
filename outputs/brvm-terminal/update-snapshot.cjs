'use strict';
// Met à jour l'instantané data.js à partir des sources publiques :
//   - cours : https://github.com/harzat/brvm-data-public (BRVMetrics, mise à jour chaque soir de séance)
//   - devises : https://github.com/fawazahmed0/exchange-api (fixings quotidiens, sans clé)
// L'historique déjà présent (OHLC complet) est conservé ; les séances plus récentes sont ajoutées puis les divisions
// du nominal sont ajustées. Usage : npm run update:data
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const B = require('./core.js');

const FILE = path.join(__dirname, 'data.js');
const BASE = 'https://raw.githubusercontent.com/harzat/brvm-data-public/main/';
const FX = date => `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/`;

function loadSnapshot() {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(FILE, 'utf8'), ctx);
  return ctx.window.BRVM_SNAPSHOT;
}
async function get(url, as = 'text') {
  const r = await fetch(url, { headers: { 'User-Agent': 'SK-TERMINAL snapshot updater' }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw Error(`HTTP ${r.status} · ${url}`);
  return as === 'json' ? r.json() : r.text();
}
async function pool(items, size, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => { while (i < items.length) { const item = items[i++]; await fn(item); } }));
}
const toCSV = rows => 'Date,Open,High,Low,Close,Volume\n' + rows.map(r => [r.date, +r.open.toFixed(4), +r.high.toFixed(4), +r.low.toFixed(4), +r.close.toFixed(4), r.volume ?? ''].join(',')).join('\n');
function days(from, to) {
  const out = [];
  for (let d = new Date(from + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

(async () => {
  const snap = loadSnapshot();
  const tickers = [...new Set([...Object.keys(snap.series), ...Object.keys(B.SOURCE_STOCKS)])].sort();
  const report = { updated: [], added: [], kept: [], failed: [], splits: [] };

  await pool(tickers, 6, async t => {
    const file = B.sourcePath(t);
    if (!file) return report.kept.push(t);
    try {
      const fresh = B.parseCSV(await get(BASE + file));
      const base = snap.series[t] ? B.parseCSV(snap.series[t]) : [];
      const merged = B.mergeSeries(base, fresh);
      merged.splits.forEach(s => report.splits.push(`${t} ${s.date} ratio ${s.ratio}`));
      snap.series[t] = toCSV(merged.rows);
      (base.length ? report.updated : report.added).push(`${t}→${merged.rows.at(-1).date}`);
    } catch (e) {
      report.failed.push(`${t}: ${e.message}`);
    }
  });

  // Devises : un fixing par jour manquant, puis le dernier disponible.
  const latest = (await get(FX('latest') + 'eur.json', 'json')).date;
  await pool(Object.keys(snap.currencies), 2, async code => {
    const cur = snap.currencies[code];
    const last = Object.keys(cur.data).sort().at(-1);
    const missing = days(last, latest).slice(1);
    await pool(missing, 6, async date => {
      try {
        const body = await get(FX(date === latest ? 'latest' : date) + code.toLowerCase() + '.min.json', 'json');
        const rates = body[code.toLowerCase()];
        // Seules les devises du terminal sont conservées (l'API en fournit environ 300, cryptos comprises).
        if (rates) cur.data[body.date] = Object.fromEntries(Object.keys(snap.currencies).map(c => [c.toLowerCase(), rates[c.toLowerCase()]]).filter(([, v]) => v > 0));
      } catch { /* fixing manquant ce jour-là : ignoré */ }
    });
    cur.meta.to = Object.keys(cur.data).sort().at(-1);
  });

  snap.retrievedAt = new Date().toISOString();
  snap.metadata = { ...snap.metadata, source: 'https://github.com/harzat/brvm-data-public', last_updated: snap.retrievedAt, total_tickers: Object.keys(snap.series).length, tickers_list: Object.keys(snap.series) };
  fs.writeFileSync(FILE, 'window.BRVM_SNAPSHOT=' + JSON.stringify(snap) + ';\n');
  console.log(`Séries mises à jour : ${report.updated.length} · ajoutées : ${report.added.join(', ') || 'aucune'} · conservées : ${report.kept.join(', ') || 'aucune'}`);
  if (report.splits.length) console.log('Divisions ajustées : ' + report.splits.join(' ; '));
  if (report.failed.length) { console.log('Échecs : ' + report.failed.join(' ; ')); process.exitCode = 1; }
  console.log('Devises jusqu’au ' + latest);
})();
