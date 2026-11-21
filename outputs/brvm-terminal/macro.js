// Module Macro : régimes, récession, sentiment et indicateurs US/zone euro via l'API gratuite MacroRadar.
const macroState = { loading: false, error: '', data: null, series: null, seriesId: 'DGS10', seriesLoading: false, seriesError: '' };
const MACRO_LABELS = {
  late_cycle: 'Fin de cycle', expansion: 'Expansion', slowdown: 'Ralentissement', reflation: 'Reflation', contraction: 'Contraction',
  stable: 'Stable', disinflation: 'Désinflation', inflation_shock: 'Choc inflationniste',
  bull: 'Haussier', bear: 'Baissier', neutral: 'Neutre', correction: 'Correction', easing: 'Assouplissement', tightening: 'Resserrement',
  'Extreme Fear': 'Peur extrême', Fear: 'Peur', Neutral: 'Neutre', Greed: 'Avidité', 'Extreme Greed': 'Avidité extrême',
  data_release: 'Publication', fomc: 'FOMC', central_bank: 'Banque centrale',
};
const macroLabel = v => MACRO_LABELS[v] || String(v || '—').replace(/_/g, ' ');
const macroPct = (v, d = 0) => (Number.isFinite(v) ? f(v * 100, d) + ' %' : '—');
const macroLimit = freq => ({ daily: 520, weekly: 156, monthly: 180, quarterly: 80 })[freq] || 300;

function macroCard(title, value, sub, tone = '') {
  return `<div class="macro-card"><span>${esc(title)}</span><strong class="${tone}">${esc(value)}</strong><small>${esc(sub)}</small></div>`;
}

function macroCards(d) {
  const r = d.regime || {}, cards = [];
  if (r.growth) cards.push(macroCard('CROISSANCE', macroLabel(r.growth.regime), 'confiance ' + macroPct(r.growth.confidence)));
  if (r.inflation) cards.push(macroCard('INFLATION', macroLabel(r.inflation.regime), 'confiance ' + macroPct(r.inflation.confidence), r.inflation.regime === 'inflation_shock' ? 'down' : ''));
  if (r.market) cards.push(macroCard('MARCHÉ ACTIONS US', macroLabel(r.market.regime), 'confiance ' + macroPct(r.market.confidence), ['bear', 'correction'].includes(r.market.regime) ? 'down' : r.market.regime === 'bull' ? 'up' : ''));
  if (r.financial_conditions) cards.push(macroCard('CONDITIONS FINANCIÈRES', macroLabel(r.financial_conditions.regime), 'confiance ' + macroPct(r.financial_conditions.confidence)));
  if (d.recession) cards.push(macroCard('RÉCESSION US À 6 MOIS', macroPct(d.recession.prob_6m, 1), 'probabilité au ' + d.recession.date, d.recession.prob_6m > 0.3 ? 'down' : 'up'));
  if (d.sentiment) {
    const delta = d.sentiment.previous ? d.sentiment.composite - d.sentiment.previous.composite : null;
    cards.push(macroCard('SENTIMENT (0–100)', `${f(d.sentiment.composite, 1)} · ${macroLabel(d.sentiment.label)}`, `au ${d.sentiment.as_of}${delta === null ? '' : ` · ${delta >= 0 ? '+' : ''}${f(delta, 1)} vs veille`}`, d.sentiment.composite < 30 ? 'down' : d.sentiment.composite > 70 ? 'up' : ''));
  }
  return `<div class="macro-cards">${cards.join('')}</div>`;
}

function macroTable(d) {
  const rows = d.indicators.map(i => {
    const pct = Number.isFinite(i.percentile_10y) ? Math.round(i.percentile_10y * 100) : null;
    const value = Number.isFinite(i.value) ? f(i.value, Math.abs(i.value) >= 1000 ? 0 : 2) : '—';
    const clickable = !i.series_id.includes('.');
    return `<tr ${clickable ? `data-macro-series="${esc(i.series_id)}" data-macro-freq="${esc(i.frequency || '')}" class="clickable ${macroState.seriesId === i.series_id ? 'selected' : ''}"` : ''}>
      <td><b>${esc(i.name)}</b><small class="muted"> ${esc(i.series_id)}</small></td>
      <td class="mono">${value}</td><td class="muted">${esc(i.units || '')}</td><td class="mono">${esc(i.date || '—')}</td>
      <td>${pct === null ? '—' : `<span class="pct-bar" title="Percentile sur 10 ans"><i style="width:${pct}%"></i></span> <span class="mono">${pct}</span>`}</td>
      <td class="mono ${i.z_score > 1.5 ? 'up' : i.z_score < -1.5 ? 'down' : ''}">${Number.isFinite(i.z_score) ? f(i.z_score, 2) : '—'}</td></tr>`;
  }).join('');
  return `<div class="table-wrap"><table><thead><tr><th>INDICATEUR</th><th>DERNIÈRE</th><th>UNITÉ</th><th>DATE</th><th>PERCENTILE 10 ANS</th><th>Z-SCORE</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Aucun indicateur reçu.</td></tr>'}</tbody></table></div>`;
}

function macroChart() {
  if (macroState.seriesLoading) return '<div class="empty" role="status">Chargement de la série…</div>';
  if (macroState.seriesError) return `<div class="notice">${esc(macroState.seriesError)}</div>`;
  const s = macroState.series;
  if (!s?.observations?.length) return '<div class="empty">Cliquez sur un indicateur pour afficher son historique.</div>';
  const obs = s.observations.filter(o => Number.isFinite(o.value));
  const W = 640, H = 200, P = 8, values = obs.map(o => o.value);
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const points = obs.map((o, i) => `${(P + i * (W - 2 * P) / Math.max(obs.length - 1, 1)).toFixed(1)},${(H - P - (o.value - min) / span * (H - 2 * P)).toFixed(1)}`).join(' ');
  const last = obs.at(-1), first = obs[0], up = last.value >= first.value;
  return `<div class="macro-chart-head"><b>${esc(s.series.name)}</b><span class="muted">${esc(s.series.units)} · ${esc(s.series.publisher || '')}</span>
      <span class="mono ${up ? 'up' : 'down'}">${f(last.value, 2)} (${up ? '+' : ''}${f(last.value - first.value, 2)} depuis ${esc(first.date)})</span></div>
    <svg class="macro-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Historique ${esc(s.series.name)}">
      <polyline points="${points}" fill="none" stroke="var(--orange)" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>
    <div class="macro-chart-axis mono"><span>${esc(first.date)}</span><span>min ${f(min, 2)} · max ${f(max, 2)}</span><span>${esc(last.date)}</span></div>
    ${s.series.chart_url ? `<div class="notes"><a href="${esc(s.series.chart_url)}" target="_blank" rel="noopener noreferrer">Graphique détaillé sur MacroRadar ↗</a></div>` : ''}`;
}

function macroSide(d) {
  const moving = d.moving.map(m => `<li><span class="${m.direction === 'up' ? 'up' : 'down'}">${m.direction === 'up' ? '▲' : '▼'}</span> ${m.chart_url ? `<a href="${esc(m.chart_url)}" target="_blank" rel="noopener noreferrer">${esc(m.sentence)}</a>` : esc(m.sentence)} <small class="muted">${esc(m.latest_date)}</small></li>`).join('');
  const calendar = d.calendar.map(e => `<tr><td class="mono">${esc(e.date)}</td><td>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener noreferrer">${esc(e.title)}</a>` : esc(e.title)}</td><td class="muted">${esc(macroLabel(e.kind))}</td></tr>`).join('');
  return `<div class="grid">${panel('MOV', 'CE QUI BOUGE (MOUVEMENTS INHABITUELS)', `<ul class="macro-moves">${moving || '<li>Aucun mouvement fourni.</li>'}</ul>`)}
    ${panel('CAL', 'CALENDRIER — 14 PROCHAINS JOURS', `<div class="table-wrap"><table class="macro-cal"><tbody>${calendar || '<tr><td>Aucun évènement.</td></tr>'}</tbody></table></div>`)}</div>`;
}

function macroView() {
  const d = macroState.data;
  const foot = `<div class="panel-foot"><span>Données : <a href="https://www.macroradar.io" target="_blank" rel="noopener noreferrer">MacroRadar ↗</a> (FRED et sources publiques) · indicateurs historiques, pas un conseil en investissement</span><span>Cache 1 h</span></div>`;
  if (macroState.loading && !d) return panel('MACRO', 'MACRO / MACRORADAR', '<div class="empty" role="status">Chargement des indicateurs macroéconomiques…</div>' + foot);
  if (!d) return panel('MACRO', 'MACRO / MACRORADAR', `<div class="empty"><strong>Macro indisponible</strong>${esc(macroState.error || 'Aucune donnée chargée.')}</div>` + foot);
  return panel('MACRO', 'RÉGIMES MACRO / MACRORADAR', `${macroState.error ? `<div class="notice">${esc(macroState.error)}</div>` : ''}${macroCards(d)}<div class="news-meta">Mis à jour ${esc(new Date(d.fetchedAt).toLocaleString('fr-FR', { timeZone: 'UTC' }))} UTC${d.cached ? ' · depuis le cache' : ''} · EUR/USD et Brent sont des repères directs pour le XOF (arrimé à l’euro) et les économies UEMOA.</div>${macroTable(d)}<div id="macroChart">${macroChart()}</div>${foot}`)
    + macroSide(d);
}

async function macroFetch(path) {
  if (location.protocol === 'file:') throw Error('Démarrez le serveur local (npm start) pour accéder à MacroRadar.');
  const response = await fetch(path, { signal: AbortSignal.timeout(30000) });
  const body = await response.json();
  if (!response.ok) throw Error(body.message || 'MacroRadar indisponible.');
  return body;
}

async function loadMacro() {
  if (macroState.loading) return;
  macroState.loading = true; macroState.error = '';
  if (state.tab === 'macro') render();
  try {
    macroState.data = await macroFetch('/api/macro/overview');
    if (!macroState.series) {
      const first = macroState.data.indicators.find(i => i.series_id === macroState.seriesId);
      loadMacroSeries(macroState.seriesId, first?.frequency);
    }
  } catch (e) {
    macroState.error = e.name === 'TimeoutError' ? 'MacroRadar met trop de temps à répondre.' : e.message;
  } finally {
    macroState.loading = false;
    if (state.tab === 'macro') render();
  }
}

async function loadMacroSeries(id, frequency) {
  macroState.seriesId = id; macroState.seriesLoading = true; macroState.seriesError = '';
  const redraw = () => { const el = document.getElementById('macroChart'); if (state.tab === 'macro' && el) el.innerHTML = macroChart(); };
  redraw();
  try { macroState.series = await macroFetch(`/api/macro/series?id=${encodeURIComponent(id)}&limit=${macroLimit(frequency)}`); }
  catch (e) { macroState.series = null; macroState.seriesError = e.message; }
  finally {
    macroState.seriesLoading = false;
    redraw();
    document.querySelectorAll('[data-macro-series]').forEach(tr => tr.classList.toggle('selected', tr.dataset.macroSeries === id));
  }
}

function bindMacro() {
  document.querySelectorAll('[data-macro-series]').forEach(tr => tr.onclick = () => loadMacroSeries(tr.dataset.macroSeries, tr.dataset.macroFreq));
  if (!macroState.data && !macroState.loading && !macroState.error) queueMicrotask(loadMacro);
}
