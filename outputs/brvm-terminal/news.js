// Module Actualités : Google Actualités (RSS, sans clé), presse économique africaine (RSS) et NewsAPI (clé).
const NEWS_SOURCES = {
  google: { label: 'Google Actualités', endpoint: '/api/gnews', note: 'Flux RSS Google Actualités · usage personnel non commercial · cache 15 min' },
  press: { label: 'Presse africaine', endpoint: '/api/press', note: 'BRVM · BCEAO · Financial Afrik · Jeune Afrique · Le Monde Afrique · Africanews · cache 10 min' },
  newsapi: { label: 'NewsAPI (clé)', endpoint: '/api/news', note: 'NewsAPI.org · couverture et délai selon abonnement · cache 15 min' },
};
const NEWS_EDITIONS = [['SN:fr', 'Sénégal · FR'], ['CI:fr', 'Côte d’Ivoire · FR'], ['FR:fr', 'France · FR'], ['NG:en', 'Nigeria · EN'], ['GB:en', 'Royaume-Uni · EN'], ['US:en', 'États-Unis · EN']];
let newsState = { source: 'google', q: 'BRVM OR UEMOA OR BCEAO', edition: 'SN:fr', when: '7d', language: 'fr', sort: 'publishedAt', loading: false, error: '', result: null, requestId: 0 };

function newsOptions(list, current) {
  return list.map(([value, label]) => `<option value="${esc(value)}" ${current === value ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

function newsView() {
  const s = newsState;
  const google = s.source === 'google', api = s.source === 'newsapi';
  const filters = google
    ? `<label>ÉDITION<select id="newsEdition">${newsOptions(NEWS_EDITIONS, s.edition)}</select></label><label>PÉRIODE<select id="newsWhen">${newsOptions([['1d', '24 h'], ['7d', '7 jours'], ['30d', '30 jours'], ['', 'Tout']], s.when)}</select></label>`
    : api
      ? `<label>LANGUE<select id="newsLanguage">${newsOptions([['fr', 'Français'], ['en', 'English'], ['all', 'Toutes']], s.language)}</select></label><label>TRIER PAR<select id="newsSort">${newsOptions([['publishedAt', 'Plus récentes'], ['relevancy', 'Pertinence'], ['popularity', 'Popularité']], s.sort)}</select></label>`
      : '';
  const presets = ['BRVM OR UEMOA OR BCEAO', 'Sonatel OR Orange Côte d’Ivoire', 'Ecobank OR Société Générale Côte d’Ivoire', 'inflation UEMOA', 'économie Sénégal', 'économie Côte d’Ivoire'];
  return panel('N', `ACTUALITÉS / ${esc(NEWS_SOURCES[s.source].label.toUpperCase())}`,
    `<form id="newsForm" class="form-row">
      <label>SOURCE<select id="newsSource">${newsOptions(Object.entries(NEWS_SOURCES).map(([k, v]) => [k, v.label]), s.source)}</select></label>
      <label style="flex:3">${s.source === 'press' ? 'FILTRE (vide = tout)' : 'RECHERCHE'}<input id="newsQuery" maxlength="200" value="${esc(s.q)}" placeholder="BRVM, Sonatel, inflation…" ${s.source === 'press' ? '' : 'required'}></label>
      ${filters}
      <button class="primary" ${s.loading ? 'disabled' : ''}>${s.loading ? 'Chargement…' : 'Rechercher'}</button>
    </form>
    <div class="news-presets">${presets.map(q => `<button data-news-query="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <div id="newsResults">${newsBody()}</div>
    <div class="panel-foot"><span>${esc(NEWS_SOURCES[s.source].note)}</span><span>Chaque titre renvoie vers l’article de l’éditeur</span></div>`);
}

function newsTime(iso) {
  const dt = new Date(iso);
  if (!iso || !Number.isFinite(dt.getTime())) return '<span>Date inconnue</span>';
  return `<span>${dt.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}</span><b>${dt.toISOString().slice(11, 16)} UTC</b>`;
}
function newsSafeUrl(raw) {
  try { const u = new URL(raw); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; }
}

function newsBody() {
  const s = newsState, r = s.result;
  if (s.loading) return '<div class="empty" role="status">Recherche des actualités…</div>';
  if (s.error) return `<div class="empty"><strong>Actualités indisponibles</strong>${esc(s.error)}</div>`;
  if (!r) return '<div class="empty">Lancez une recherche pour consulter les articles.</div>';
  if (!r.articles.length) return '<div class="empty"><strong>Aucun article pour cette recherche.</strong>Essayez un terme plus large, une autre édition ou une autre source.</div>';
  const failed = r.failed?.length ? ` · flux indisponibles : ${esc(r.failed.join(', '))}` : '';
  const meta = `${r.articles.length} articles affichés${r.totalResults > r.articles.length ? ' / ' + f(r.totalResults) + ' résultats' : ''} · ${esc(r.provider || 'NewsAPI')} · Requête du ${esc(new Date(r.fetchedAt).toLocaleString('fr-FR', { timeZone: 'UTC' }))} UTC${r.cached ? ' · depuis le cache' : ''}${failed}`;
  const items = r.articles.map(a => {
    const link = newsSafeUrl(a.url), home = newsSafeUrl(a.sourceUrl);
    const source = esc(a.source || 'Source non précisée');
    return `<article class="news-article"><div class="news-time">${newsTime(a.publishedAt)}</div><div>
      <span class="news-source">${home ? `<a href="${esc(home)}" target="_blank" rel="noopener noreferrer">${source}</a>` : source}</span>
      <h3>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(a.title)} ↗</a>` : esc(a.title)}</h3>
      ${a.description ? `<p>${esc(a.description)}</p>` : ''}</div></article>`;
  }).join('');
  return `<div class="news-meta">${meta}</div><div class="news-list">${items}</div>`;
}

async function loadNews() {
  const s = newsState, id = ++s.requestId;
  s.loading = true; s.error = '';
  if (state.tab === 'news') render();
  try {
    if (location.protocol === 'file:') throw Error('Ouvrez le terminal avec npm start pour accéder aux actualités.');
    const params = s.source === 'google' ? { q: s.q, edition: s.edition, when: s.when }
      : s.source === 'press' ? { q: s.q }
        : { q: s.q, language: s.language, sortBy: s.sort };
    const response = await fetch(NEWS_SOURCES[s.source].endpoint + '?' + new URLSearchParams(params), { signal: AbortSignal.timeout(25000) });
    const body = await response.json();
    if (!response.ok) throw Error(body.message || 'Erreur du service d’actualités.');
    if (id === s.requestId) s.result = body;
  } catch (e) {
    if (id === s.requestId) s.error = e.name === 'TimeoutError' ? 'Le service d’actualités ne répond pas.' : e.message;
  } finally {
    if (id === s.requestId) { s.loading = false; if (state.tab === 'news') render(); }
  }
}

function bindNews() {
  const value = sel => document.querySelector(sel)?.value;
  $('#newsSource').onchange = e => { newsState.source = e.target.value; newsState.result = null; newsState.error = ''; if (newsState.source === 'press') newsState.q = ''; else if (!newsState.q) newsState.q = 'BRVM OR UEMOA OR BCEAO'; render(); loadNews(); };
  $('#newsForm').onsubmit = e => {
    e.preventDefault();
    newsState.q = $('#newsQuery').value.trim();
    newsState.edition = value('#newsEdition') ?? newsState.edition;
    newsState.when = value('#newsWhen') ?? newsState.when;
    newsState.language = value('#newsLanguage') ?? newsState.language;
    newsState.sort = value('#newsSort') ?? newsState.sort;
    loadNews();
  };
  document.querySelectorAll('[data-news-query]').forEach(b => b.onclick = () => { newsState.q = b.dataset.newsQuery; loadNews(); });
  if (!newsState.result && !newsState.loading && !newsState.error) queueMicrotask(loadNews);
}
