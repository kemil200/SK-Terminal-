const test = require('node:test'), assert = require('node:assert/strict');
const { sourceRoute, parseRssItems, plainText, googleNewsEnabled, googleNewsUrl, matchesQuery, validSeriesId } = require('./sources.cjs');

const GOOGLE_XML = `<?xml version="1.0"?><rss version="2.0"><channel><title>"BRVM" - Google Actualités</title>
<item><title>La BRVM appelle à mobiliser 4 000 milliards &amp; plus - Financial Afrik</title><link>https://news.google.com/rss/articles/ABC?oc=5</link><guid isPermaLink="false">ABC</guid><pubDate>Fri, 20 Nov 2026 09:17:09 GMT</pubDate><description>&lt;a href="https://news.google.com/rss/articles/ABC?oc=5"&gt;La BRVM appelle à mobiliser 4 000 milliards &amp;amp; plus&lt;/a&gt;&amp;nbsp;&lt;font color="#6f6f6f"&gt;Financial Afrik&lt;/font&gt;</description><source url="https://www.financialafrik.com">Financial Afrik</source></item>
<item><title>Doublon - Financial Afrik</title><link>https://news.google.com/rss/articles/ABC?oc=5</link><guid>ABC</guid></item>
<item><title>Lien dangereux</title><link>javascript:alert(1)</link></item>
</channel></rss>`;

test('RSS Google : titre sans suffixe, éditeur, lien, date, doublons et liens non HTTP écartés', () => {
  const items = parseRssItems(GOOGLE_XML);
  assert.equal(items.length, 1);
  const [a] = items;
  assert.equal(a.title, 'La BRVM appelle à mobiliser 4 000 milliards & plus');
  assert.equal(a.source, 'Financial Afrik');
  assert.equal(a.sourceUrl, 'https://www.financialafrik.com/');
  assert.equal(a.url, 'https://news.google.com/rss/articles/ABC?oc=5');
  assert.equal(a.publishedAt, '2026-11-20T09:17:09.000Z');
  assert.equal(a.description, '');
});

test('RSS éditeur : CDATA et HTML nettoyés', () => {
  const xml = '<rss><channel><item><title><![CDATA[Sonatel : résultats]]></title><link>https://ex.com/a</link><description><![CDATA[<p>Chiffre d&#8217;affaires <b>en hausse</b></p>]]></description></item></channel></rss>';
  const [a] = parseRssItems(xml, 'Ex');
  assert.equal(a.title, 'Sonatel : résultats');
  assert.equal(a.description, 'Chiffre d’affaires en hausse');
  assert.equal(a.source, 'Ex');
  assert.throws(() => parseRssItems('<html></html>'));
  assert.equal(plainText('&lt;b&gt;A&lt;/b&gt; &amp;amp; B'), 'A & B');
});

test('Google Actualités : actif en local, désactivé par défaut sur Vercel', () => {
  assert.equal(googleNewsEnabled({}), true);
  assert.equal(googleNewsEnabled({ VERCEL: '1' }), false);
  assert.equal(googleNewsEnabled({ VERCEL: '1', GOOGLE_NEWS_RSS: 'on' }), true);
  assert.equal(googleNewsEnabled({ GOOGLE_NEWS_RSS: 'off' }), false);
  assert.equal(googleNewsUrl('BRVM OR UEMOA', 'SN:fr', '7d'), 'https://news.google.com/rss/search?q=BRVM%20OR%20UEMOA%20when%3A7d&hl=fr&gl=SN&ceid=SN:fr');
});

test('Paramètres rejetés avant tout appel réseau', async () => {
  assert.equal((await sourceRoute(new URL('http://x/api/gnews?q=BRVM&edition=XX:yy'))).status, 400);
  assert.equal((await sourceRoute(new URL('http://x/api/gnews?q=BRVM&when=1y'))).status, 400);
  assert.equal((await sourceRoute(new URL('http://x/api/macro/series?id=../../etc'))).status, 400);
  assert.equal((await sourceRoute(new URL('http://x/api/africa/profile?country=../../'))).status, 400);
  assert.equal(await sourceRoute(new URL('http://x/api/africa/profile?country=ke'), { hasAfricaKey: () => true }), null);
  assert.equal(await sourceRoute(new URL('http://x/api/rss')), null);
  assert.equal(validSeriesId('ECB_IRS_EA_10Y'), true);
});

test('Filtre presse : OU entre termes, ET entre mots', () => {
  const a = { title: 'La BRVM progresse', description: 'Sonatel tire l’indice' };
  assert.equal(matchesQuery(a, ''), true);
  assert.equal(matchesQuery(a, 'UEMOA OR brvm'), true);
  assert.equal(matchesQuery(a, 'sonatel indice'), true);
  assert.equal(matchesQuery(a, 'orange'), false);
});
