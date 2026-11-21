'use strict';
// Sources de données gratuites et sans clé :
//  - Google Actualités (flux RSS officiel, usage personnel non commercial)
//  - Flux RSS d'éditeurs de presse économique africaine
//  - MacroRadar (https://www.macroradar.io/developers) : API macro US gratuite, attribution demandée
//  - Banque mondiale (https://datahelpdesk.worldbank.org) : repli sans clé pour les fiches pays
const { limitedText } = require('./feeds.cjs');

const USER_AGENT = 'SK-TERMINAL/1.2 RSS reader';
const cache = new Map();

function cached(key, ttl) {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < ttl ? hit.body : null;
}
function remember(key, body) {
  if (cache.size >= 150) cache.delete(cache.keys().next().value);
  cache.set(key, { at: Date.now(), body });
  return body;
}

async function fetchText(url, accept, timeout = 15000) {
  const response = await fetch(url, { headers: { Accept: accept, 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) {
    const err = Error(`HTTP ${response.status}`);
    err.status = response.status;
    err.body = await limitedText(response, 200000).catch(() => '');
    throw err;
  }
  return limitedText(response);
}
const fetchJSON = async (url, timeout) => JSON.parse(await fetchText(url, 'application/json', timeout));

// ---------------------------------------------------------------------------
// RSS : analyse côté serveur, sans dépendance
// ---------------------------------------------------------------------------
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(text) {
  return String(text || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1));
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}
function plainText(raw) {
  const unwrapped = String(raw || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  // Décoder une première fois (HTML échappé dans le XML), retirer les balises, puis décoder le texte restant.
  return decodeEntities(decodeEntities(unwrapped).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
}
function attr(block, name, attribute) {
  const m = block.match(new RegExp(`<${name}\\s[^>]*${attribute}="([^"]*)"`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}
function safeUrl(raw) {
  try {
    const u = new URL(plainText(raw));
    return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
  } catch { return ''; }
}

function parseRssItems(xml, fallbackSource = '') {
  if (!/<rss[\s>]/i.test(xml) && !/<feed[\s>]/i.test(xml)) throw Error('La source ne renvoie pas un flux RSS.');
  const items = [];
  const seen = new Set();
  for (const [, block] of xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)) {
    let title = plainText(tag(block, 'title'));
    const url = safeUrl(tag(block, 'link'));
    const source = plainText(tag(block, 'source')) || fallbackSource;
    const sourceUrl = safeUrl(attr(block, 'source', 'url'));
    // Google suffixe chaque titre par « - Éditeur » : on le retire pour l'afficher séparément.
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const id = plainText(tag(block, 'guid')) || url || title;
    if (!title || !url || seen.has(id)) continue;
    seen.add(id);
    const date = Date.parse(plainText(tag(block, 'pubDate')) || plainText(tag(block, 'dc:date')));
    let description = plainText(tag(block, 'description')).slice(0, 600);
    if (description.startsWith(title)) description = ''; // Google ne fournit que « titre + éditeur »
    items.push({ title, url, source, sourceUrl, description, publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Google Actualités (flux RSS public)
// ---------------------------------------------------------------------------
// Conditions du flux : « solely for the purpose of rendering Google News results within a personal
// feed reader for personal, non-commercial use ». Activé par défaut en local (usage personnel),
// désactivé par défaut sur un déploiement public (Vercel) sauf GOOGLE_NEWS_RSS=on.
const GOOGLE_EDITIONS = {
  'SN:fr': ['fr', 'SN'], 'CI:fr': ['fr', 'CI'], 'FR:fr': ['fr', 'FR'],
  'US:en': ['en-US', 'US'], 'GB:en': ['en-GB', 'GB'], 'NG:en': ['en-NG', 'NG'],
};
function googleNewsEnabled(env = process.env) {
  const flag = String(env.GOOGLE_NEWS_RSS || '').toLowerCase();
  if (['off', '0', 'false'].includes(flag)) return false;
  if (['on', '1', 'true'].includes(flag)) return true;
  return !env.VERCEL;
}
function googleNewsUrl(q, edition = 'SN:fr', when = '') {
  const [hl, gl] = GOOGLE_EDITIONS[edition];
  const query = when ? `${q} when:${when}` : q;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=${hl}&gl=${gl}&ceid=${edition}`;
}
let lastGoogle = 0;
async function googleNews(url) {
  if (!googleNewsEnabled()) {
    return { status: 503, body: { code: 'disabled', message: 'Google Actualités est désactivé sur ce déploiement : le flux RSS est réservé à un usage personnel non commercial. Utilisez la presse africaine ou NewsAPI, ou définissez GOOGLE_NEWS_RSS=on pour un usage strictement personnel.' } };
  }
  const q = (url.searchParams.get('q') || 'BRVM').trim();
  const edition = url.searchParams.get('edition') || 'SN:fr';
  const when = url.searchParams.get('when') || '';
  if (!q || q.length > 200 || !GOOGLE_EDITIONS[edition] || !['', '1d', '7d', '30d'].includes(when)) {
    return { status: 400, body: { message: 'Paramètres de recherche invalides.' } };
  }
  const key = `google:${q}:${edition}:${when}`;
  const hit = cached(key, 15 * 60000);
  if (hit) return { status: 200, body: { ...hit, cached: true } };
  if (Date.now() - lastGoogle < 2000) return { status: 429, body: { message: 'Veuillez patienter quelques secondes avant une nouvelle recherche.' } };
  lastGoogle = Date.now();
  const feedUrl = googleNewsUrl(q, edition, when);
  try {
    const articles = parseRssItems(await fetchText(feedUrl, 'application/rss+xml, application/xml')).slice(0, 60);
    return { status: 200, body: remember(key, { provider: 'Google Actualités', feedUrl, articles, totalResults: articles.length, fetchedAt: new Date().toISOString() }) };
  } catch (e) {
    return { status: 502, body: { message: e.name === 'TimeoutError' ? 'Google Actualités met trop de temps à répondre.' : 'Flux Google Actualités indisponible. Réessayez plus tard.' } };
  }
}

// ---------------------------------------------------------------------------
// Presse économique africaine (flux RSS publiés par les éditeurs)
// ---------------------------------------------------------------------------
const PRESS_FEEDS = [
  { id: 'brvm', name: 'BRVM (officiel)', url: 'https://www.brvm.org/fr/rss.xml' },
  { id: 'bceao', name: 'BCEAO (officiel)', url: 'https://www.bceao.int/fr/rss.xml' },
  { id: 'financialafrik', name: 'Financial Afrik', url: 'https://www.financialafrik.com/feed/' },
  { id: 'jeuneafrique', name: 'Jeune Afrique', url: 'https://www.jeuneafrique.com/feed/' },
  { id: 'lemonde', name: 'Le Monde Afrique', url: 'https://www.lemonde.fr/afrique/rss_full.xml' },
  { id: 'africanews', name: 'Africanews', url: 'https://fr.africanews.com/feed/' },
];
async function pressFeed(feed) {
  const key = `press:${feed.id}`;
  const hit = cached(key, 10 * 60000);
  if (hit) return hit;
  const items = parseRssItems(await fetchText(feed.url, 'application/rss+xml, application/xml, text/xml'), feed.name)
    .map(item => ({ ...item, source: feed.name, sourceUrl: new URL(feed.url).origin }));
  return remember(key, items);
}
function matchesQuery(article, q) {
  const terms = q.toLocaleLowerCase('fr').split(/\s+or\s+|,/i).map(t => t.trim()).filter(Boolean);
  if (!terms.length) return true;
  const text = `${article.title} ${article.description}`.toLocaleLowerCase('fr');
  return terms.some(term => term.split(/\s+/).every(word => text.includes(word)));
}
async function press(url) {
  const q = (url.searchParams.get('q') || '').trim();
  if (q.length > 200) return { status: 400, body: { message: 'Recherche trop longue.' } };
  const results = await Promise.allSettled(PRESS_FEEDS.map(pressFeed));
  const failed = PRESS_FEEDS.filter((_, i) => results[i].status === 'rejected').map(f => f.name);
  if (failed.length === PRESS_FEEDS.length) return { status: 502, body: { message: 'Aucun flux de presse joignable pour le moment.' } };
  const all = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
  const articles = all.filter(a => matchesQuery(a, q)).sort((a, b) => (Date.parse(b.publishedAt) || 0) - (Date.parse(a.publishedAt) || 0)).slice(0, 150);
  return { status: 200, body: { provider: 'Presse africaine', feeds: PRESS_FEEDS.map(({ name, url: feedUrl }) => ({ name, url: feedUrl })), failed, articles, totalResults: articles.length, fetchedAt: new Date().toISOString() } };
}

// ---------------------------------------------------------------------------
// MacroRadar
// ---------------------------------------------------------------------------
const MACRO_BASE = 'https://www.macroradar.io/api/v1';
const MACRO_DASHBOARD = ['DGS10', 'DGS2', 'T10Y2Y', 'FEDFUNDS', 'UNRATE', 'T10YIE', 'DEXUSEU', 'DCOILBRENTEU', 'DTWEXBGS', 'ECB_IRS_EA_10Y', 'ICSA', 'SAHMREALTIME'];
const MACRO_TTL = 60 * 60000; // l'API est elle-même mise en cache une heure
const validSeriesId = id => /^[A-Za-z0-9_]{1,40}$/.test(id);

async function macroGet(path, ttl = MACRO_TTL) {
  const hit = cached(`macro:${path}`, ttl);
  if (hit) return hit;
  return remember(`macro:${path}`, (await fetchJSON(MACRO_BASE + path, 20000)).data);
}
async function cpiYoY(id) {
  const data = await macroGet(`/series/${id}?limit=13`);
  const obs = data.observations;
  if (obs.length < 13) throw Error('Historique insuffisant');
  return { series_id: `${id}.yoy`, name: data.series.name.replace(/\s*\(.*\)$/, '') + ' — glissement annuel', units: '%', date: obs.at(-1).date, value: (obs.at(-1).value / obs[0].value - 1) * 100, chart_url: data.series.chart_url };
}
async function macroOverview() {
  const tasks = {
    regime: macroGet('/regime'),
    recession: macroGet('/recession'),
    sentiment: macroGet('/sentiment'),
    moving: macroGet('/whats-moving'),
    calendar: macroGet('/calendar?days_ahead=14&days_back=0'),
    inflation: Promise.allSettled([cpiYoY('CPIAUCSL'), cpiYoY('CPILFESL')]),
    latest: Promise.allSettled(MACRO_DASHBOARD.map(id => macroGet(`/series/${id}/latest`))),
  };
  const keys = Object.keys(tasks);
  const settled = await Promise.allSettled(Object.values(tasks));
  const out = Object.fromEntries(keys.map((k, i) => [k, settled[i].status === 'fulfilled' ? settled[i].value : null]));
  if (!out.regime && !out.latest) throw Error('MacroRadar indisponible');
  const indicators = [
    ...(out.inflation || []).filter(r => r.status === 'fulfilled').map(r => r.value),
    ...(out.latest || []).filter(r => r.status === 'fulfilled').map(({ value: d }) => ({
      series_id: d.series.series_id, name: d.series.name, units: d.series.units, frequency: d.series.frequency,
      date: d.date, value: d.value, percentile_10y: d.percentile_10y, z_score: d.z_score, chart_url: d.series.chart_url,
    })),
  ];
  const s = out.sentiment;
  return {
    provider: 'MacroRadar',
    attribution: 'MacroRadar (macroradar.io) — indicateurs dérivés de FRED et d’autres sources publiques.',
    regime: out.regime && {
      growth: out.regime.growth, inflation: out.regime.inflation, market: out.regime.market,
      financial_conditions: out.regime.financial_conditions, transitions: out.regime.transitions,
    },
    recession: out.recession,
    sentiment: s && { as_of: s.as_of, label: s.label, composite: s.composite, previous: s.previous },
    indicators,
    moving: (out.moving?.moves || []).slice(0, 10).map(m => ({ series_id: m.series_id, name: m.name, sentence: m.sentence, direction: m.direction, rarity: m.rarity, latest_date: m.latest_date, chart_url: m.chart_url })),
    calendar: (out.calendar?.upcoming || []).slice(0, 25).map(e => ({ date: e.event_date, kind: e.kind, title: e.title, url: e.url })),
    fetchedAt: new Date().toISOString(),
  };
}
async function macro(url) {
  try {
    if (url.pathname === '/api/macro/overview') {
      const hit = cached('macro:overview', MACRO_TTL);
      if (hit) return { status: 200, body: { ...hit, cached: true } };
      return { status: 200, body: remember('macro:overview', await macroOverview()) };
    }
    if (url.pathname === '/api/macro/series') {
      const id = url.searchParams.get('id') || '';
      const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 520, 2), 5000);
      if (!validSeriesId(id)) return { status: 400, body: { message: 'Identifiant de série invalide.' } };
      const data = await macroGet(`/series/${id}?limit=${limit}`);
      return { status: 200, body: { series: data.series, observations: data.observations, fetchedAt: new Date().toISOString() } };
    }
    if (url.pathname === '/api/macro/catalog') {
      const data = await macroGet('/catalog', 24 * MACRO_TTL);
      return { status: 200, body: { series: data.series.filter(s => s.redistributable !== false).map(s => ({ id: s.series_id, name: s.name, category: s.category, frequency: s.frequency, units: s.units })) } };
    }
    return null;
  } catch (e) {
    if (e.status === 451) return { status: 451, body: { message: 'Série non redistribuable par l’API MacroRadar (licence du propriétaire). Consultez le graphique sur macroradar.io.' } };
    if (e.status === 404) return { status: 404, body: { message: 'Série inconnue de MacroRadar.' } };
    return { status: 502, body: { message: e.name === 'TimeoutError' ? 'MacroRadar met trop de temps à répondre.' : 'MacroRadar est temporairement indisponible.' } };
  }
}

// ---------------------------------------------------------------------------
// Banque mondiale : fiche pays sans clé (repli quand AFRICA_API_KEY est absente)
// ---------------------------------------------------------------------------
const WB_INDICATORS = [
  ['population_total', 'SP.POP.TOTL', 'personnes'],
  ['gdp_current_usd', 'NY.GDP.MKTP.CD', 'USD courants'],
  ['gdp_per_capita_usd', 'NY.GDP.PCAP.CD', 'USD courants'],
  ['gdp_growth_pct', 'NY.GDP.MKTP.KD.ZG', '%'],
  ['inflation_pct', 'FP.CPI.TOTL.ZG', '%'],
  ['unemployment_pct', 'SL.UEM.TOTL.ZS', '% population active (OIT)'],
  ['current_account_pct_gdp', 'BN.CAB.XOKA.GD.ZS', '% du PIB'],
  ['fdi_inflows_pct_gdp', 'BX.KLT.DINV.WD.GD.ZS', '% du PIB'],
];
async function worldBankProfile(country) {
  const key = `wb:${country}`;
  const hit = cached(key, 12 * MACRO_TTL);
  if (hit) return { ...hit, cached: true };
  const base = `https://api.worldbank.org/v2/country/${country}`;
  const [info, ...series] = await Promise.allSettled([
    fetchJSON(`${base}?format=json`, 25000),
    ...WB_INDICATORS.map(([, code]) => fetchJSON(`${base}/indicator/${code}?format=json&mrnev=1`, 25000)),
  ]);
  const meta = info.status === 'fulfilled' ? info.value?.[1]?.[0] : null;
  if (!meta) throw Error('Pays inconnu de la Banque mondiale.');
  const highlights = {};
  WB_INDICATORS.forEach(([name, code, unit], i) => {
    const row = series[i].status === 'fulfilled' ? series[i].value?.[1]?.[0] : null;
    if (row && row.value !== null) highlights[name] = { value: row.value, unit, year: row.date, source: `Banque mondiale · ${code}` };
  });
  return remember(key, {
    provider: 'Banque mondiale (sans clé)',
    data: { country: { name: meta.name, code: meta.iso2Code, capital: meta.capitalCity, region: meta.region?.value?.trim() }, highlights },
    fetchedAt: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Routeur
// ---------------------------------------------------------------------------
async function sourceRoute(url, { hasAfricaKey = () => false } = {}) {
  if (url.pathname === '/api/gnews') return googleNews(url);
  if (url.pathname === '/api/press') return press(url);
  if (url.pathname.startsWith('/api/macro/')) return macro(url);
  if (url.pathname === '/api/africa/profile' && !hasAfricaKey()) {
    const country = (url.searchParams.get('country') || 'ke').toLowerCase();
    if (!/^[a-z]{2}$/.test(country)) return { status: 400, body: { message: 'Utilisez un code pays de deux lettres.' } };
    try { return { status: 200, body: await worldBankProfile(country) }; }
    catch (e) { return { status: 502, body: { message: e.message.startsWith('Pays') ? e.message : 'Banque mondiale indisponible. Réessayez.' } }; }
  }
  return null;
}

module.exports = { sourceRoute, parseRssItems, plainText, googleNewsEnabled, googleNewsUrl, matchesQuery, validSeriesId, PRESS_FEEDS, GOOGLE_EDITIONS };
