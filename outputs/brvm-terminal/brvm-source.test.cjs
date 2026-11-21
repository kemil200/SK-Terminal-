const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const B = require('./core.js');

const FR = '﻿Date;Clôture;Plus bas;Plus haut;Ouverture;Volume Titres;Volume FCFA;Variation %\n'
  + '22/10/2026;42 000;41 800;42 100;41 900;22 620;950 040 000;0.61%\n'
  + '23/10/2026;43 800;42 000;43 800;42 000;17 096;748 804 800;4.29%\n'
  + '26/10/2026;4 700;4 380;4 700;4 380;323 351;1 519 749 700;-89.27%\n'
  + 'ligne invalide;;;;;;;\n';

test('CSV BRVMetrics : dates JJ/MM/AAAA, milliers avec espaces, enveloppe OHLC cohérente', () => {
  const rows = B.parseCSV(FR);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1], { date: '2026-10-23', open: 42000, high: 43800, low: 42000, close: 43800, volume: 17096 });
  for (const r of rows) assert.ok(r.low <= Math.min(r.open, r.close) && r.high >= Math.max(r.open, r.close));
  const index = B.parseCSV('Date;Clôture;Plus bas;Plus haut;Ouverture;Volume Titres;Volume FCFA;Variation %\n20/11/2026;492.89;490.88;495.15;492.89;;3891118468;-0.21%');
  assert.equal(index[0].volume, null);
  assert.equal(index[0].close, 492.89);
});

test('Division du nominal 1:10 détectée malgré la variation de séance, ajustement de l’historique', () => {
  const { rows, splits } = B.adjustSplits(B.parseCSV(FR));
  assert.deepEqual(splits, [{ date: '2026-10-26', ratio: 10 }]);
  assert.equal(rows[0].close, 4200);
  assert.equal(rows[0].volume, 226200);
  assert.equal(rows[2].close, 4700);
  assert.ok(Math.abs(B.change(rows) - (4700 / 4380 - 1) * 100) < 1e-9);
});

test('Pas de fausse division sur une forte variation ordinaire ou un ratio non usuel', () => {
  const row = (date, close) => ({ date, open: close, high: close, low: close, close, volume: 1 });
  assert.deepEqual(B.detectSplits([row('2026-01-01', 100), row('2026-01-02', 92.5)]), []);
  assert.deepEqual(B.detectSplits([row('2025-09-25', 3760), row('2025-09-26', 2185)]), []); // FTSC, rapport 1,72
  assert.deepEqual(B.detectSplits([row('2018-02-02', 8100), row('2018-02-05', 4050)]), [{ date: '2018-02-05', ratio: 2 }]);
  assert.deepEqual(B.detectSplits([row('2020-01-01', 100), row('2020-01-02', 1000)]), [{ date: '2020-01-02', ratio: 0.1 }]);
});

test('Fusion : historique connu conservé, séances récentes ajoutées', () => {
  const base = [{ date: '2026-10-22', open: 41500, high: 42500, low: 41000, close: 42000, volume: 22620 }];
  const { rows } = B.mergeSeries(base, B.parseCSV(FR));
  assert.equal(rows.length, 3);
  assert.equal(rows[0].high, 4250); // OHLC d'origine conservé puis ajusté
  assert.equal(rows.at(-1).date, '2026-10-26');
});

test('Correspondance tickers → fichiers de la source', () => {
  assert.equal(B.sourcePath('SNTS'), 'Historique_Complet_SONATEL.csv');
  assert.equal(B.sourcePath('BBGC'), 'Historique_Complet_BRIDGE_BANK_GROUP_CI.csv');
  assert.equal(B.sourcePath('BRVMC'), 'indices/Indice_BRVMC.csv');
  assert.equal(B.sourcePath('BRVM-TEL'), 'indices/Indice_BRVM_TEL.csv');
  assert.equal(B.sourcePath('SVOC'), null);
});

test('Instantané : aucune division non ajustée restante', () => {
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync('data.js', 'utf8'), ctx);
  for (const [t, csv] of Object.entries(ctx.window.BRVM_SNAPSHOT.series)) {
    assert.deepEqual(B.detectSplits(B.parseCSV(csv).filter(r => r.date >= '2019-01-01')), [], t);
  }
});
