/**
 * Newsy Sources Manager — client-side logic for source management UI.
 */

const API = window.NEWSY_API_BASE || window.location.origin;
const $ = (sel) => document.querySelector(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

let allSources = [];
let categories = [];

const els = {
  container: $('#sources-container'),
  loading: $('#loading'),
  statsTotal: $('#stats-total'),
  statsEnabled: $('#stats-enabled'),
  filterCategory: $('#filter-category'),
  filterStatus: $('#filter-status'),
  filterVerdict: $('#filter-verdict'),
  addPanel: $('#add-panel'),
  addName: $('#add-name'),
  addUrl: $('#add-url'),
  addCategory: $('#add-category'),
  addCountry: $('#add-country'),
  addLanguage: $('#add-language'),
  urlTestResult: $('#url-test-result'),
};

// --- Data fetching ---

async function loadSources() {
  try {
    const res = await fetch(`${API}/api/sources`);
    const data = await res.json();
    allSources = data.sources;
    categories = data.categories;
    populateFilters();
    render();
  } catch (err) {
    els.container.innerHTML = `<div class="status-message error">Failed to load sources: ${err.message}</div>`;
  }
}

function populateFilters() {
  els.filterCategory.innerHTML = '<option value="">all categories</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');

  els.addCategory.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
}

function getFilteredSources() {
  let filtered = allSources;
  const cat = els.filterCategory.value;
  const status = els.filterStatus.value;
  const verdict = els.filterVerdict.value;

  if (cat) filtered = filtered.filter(s => s.category === cat);
  if (status === 'enabled') filtered = filtered.filter(s => s.enabled);
  if (status === 'disabled') filtered = filtered.filter(s => !s.enabled);
  if (verdict === 'untested') filtered = filtered.filter(s => !s.lastTestResult);
  else if (verdict) filtered = filtered.filter(s => s.lastTestResult?.verdict === verdict);

  return filtered;
}

// --- Rendering ---

function render() {
  const filtered = getFilteredSources();
  const enabledCount = allSources.filter(s => s.enabled).length;

  els.statsTotal.textContent = `${allSources.length} sources`;
  els.statsEnabled.textContent = `${enabledCount} enabled`;

  // Remove existing cards
  els.container.querySelectorAll('.source-card').forEach(c => c.remove());
  hide(els.loading);

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'status-message';
    empty.innerHTML = '<p>No sources match the current filters.</p>';
    els.container.appendChild(empty);
    return;
  }

  for (const source of filtered) {
    els.container.appendChild(createSourceCard(source));
  }
}

function createSourceCard(source) {
  const card = document.createElement('div');
  card.className = `source-card ${source.enabled ? '' : 'disabled'}`;
  card.dataset.id = source.id;

  const verdict = source.lastTestResult?.verdict || 'untested';
  const testDetail = source.lastTestResult ? formatTestDetail(source.lastTestResult) : '';

  card.innerHTML = `
    <button class="source-toggle ${source.enabled ? 'on' : ''}" 
            data-action="toggle" data-id="${source.id}"
            title="${source.enabled ? 'Disable' : 'Enable'}"></button>
    <div class="source-info">
      <div class="source-name">${esc(source.name)}</div>
      <div class="source-url" title="${esc(source.rssUrl)}">${esc(source.rssUrl)}</div>
      <div class="source-tags">
        <span class="tag tag-category">${source.category || 'news'}</span>
        <span class="tag tag-country">${source.country || '?'}</span>
        <span class="tag tag-language">${source.language || 'en'}</span>
      </div>
      ${testDetail ? `<div class="test-detail">${testDetail}</div>` : ''}
    </div>
    <span class="verdict-badge verdict-${verdict}">${verdict}</span>
    <div class="source-actions">
      <button class="btn btn-sm btn-secondary" data-action="test" data-id="${source.id}" title="Test feed">test</button>
      <button class="btn btn-sm btn-ghost" data-action="delete" data-id="${source.id}" title="Remove source">✕</button>
    </div>
  `;

  return card;
}

function formatTestDetail(result) {
  const parts = [];
  if (result.itemCount !== undefined) parts.push(`<span>${result.itemCount} items</span>`);
  if (result.freshnessHours !== null && result.freshnessHours !== undefined) {
    parts.push(`<span>latest: ${result.freshnessHours}h ago</span>`);
  }
  if (result.responseTimeMs) parts.push(`<span>${result.responseTimeMs}ms</span>`);
  if (result.feedTitle) parts.push(`<span>"${esc(result.feedTitle)}"</span>`);
  if (result.errors && result.errors.length > 0) {
    parts.push(`<span style="color:var(--negative)">${esc(result.errors[0])}</span>`);
  }
  return parts.join('');
}

// --- Actions ---

async function toggleSource(id) {
  const scrollY = window.scrollY;
  await fetch(`${API}/api/sources/${id}/toggle`, { method: 'POST' });
  await loadSources();
  window.scrollTo(0, scrollY);
}

async function deleteSource(id) {
  if (!confirm('Remove this source?')) return;
  const scrollY = window.scrollY;
  await fetch(`${API}/api/sources/${id}`, { method: 'DELETE' });
  await loadSources();
  window.scrollTo(0, scrollY);
}

async function testSource(id) {
  const btn = document.querySelector(`[data-action="test"][data-id="${id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  const scrollY = window.scrollY;
  try {
    await fetch(`${API}/api/sources/${id}/test`, { method: 'POST' });
    await loadSources();
    window.scrollTo(0, scrollY);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'test'; }
  }
}

async function testAllSources() {
  const btn = $('#test-all-btn');
  btn.disabled = true;
  btn.textContent = 'testing...';

  const scrollY = window.scrollY;
  try {
    await fetch(`${API}/api/sources/test-all`, { method: 'POST' });
    await loadSources();
    window.scrollTo(0, scrollY);
  } finally {
    btn.disabled = false;
    btn.textContent = 'test all';
  }
}

async function testUrl() {
  const url = els.addUrl.value.trim();
  if (!url) return;

  const btn = $('#test-url-btn');
  btn.disabled = true;
  btn.textContent = 'testing...';
  hide(els.urlTestResult);

  try {
    const res = await fetch(`${API}/api/test-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const result = await res.json();

    els.urlTestResult.className = `test-result ${result.verdict || 'fail'}`;
    els.urlTestResult.innerHTML = formatUrlTestResult(result);
    show(els.urlTestResult);

    // Auto-fill name if empty
    if (!els.addName.value && result.feedTitle) {
      els.addName.value = result.feedTitle;
    }
  } catch (err) {
    els.urlTestResult.className = 'test-result fail';
    els.urlTestResult.textContent = `Error: ${err.message}`;
    show(els.urlTestResult);
  } finally {
    btn.disabled = false;
    btn.textContent = 'test URL first';
  }
}

function formatUrlTestResult(r) {
  const lines = [];
  lines.push(`verdict: ${r.verdict}  |  reachable: ${r.reachable}  |  parsable: ${r.parsable}`);
  if (r.feedTitle) lines.push(`title: "${esc(r.feedTitle)}"`);
  lines.push(`items: ${r.itemCount}  |  response: ${r.responseTimeMs}ms`);
  if (r.freshnessHours !== null) lines.push(`latest item: ${r.freshnessHours}h ago`);
  if (r.quality) {
    const q = r.quality;
    lines.push(`quality: ${q.hasTitle}/${r.itemCount} titles, ${q.hasSummary}/${r.itemCount} summaries, ${q.hasDate}/${r.itemCount} dates`);
    lines.push(`avg title: ${q.avgTitleLength} chars, avg summary: ${q.avgSummaryLength} chars`);
  }
  if (r.errors && r.errors.length > 0) lines.push(`issues: ${r.errors.join(', ')}`);
  return lines.join('\n');
}

async function addNewSource() {
  const name = els.addName.value.trim();
  const rssUrl = els.addUrl.value.trim();
  if (!name || !rssUrl) return alert('Name and URL are required');

  try {
    const res = await fetch(`${API}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        rssUrl,
        category: els.addCategory.value,
        country: els.addCountry.value.trim() || 'international',
        language: els.addLanguage.value.trim() || 'en',
        enabled: false,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      return alert(err.error || 'Failed to add source');
    }

    // Reset form
    els.addName.value = '';
    els.addUrl.value = '';
    els.addCountry.value = 'international';
    els.addLanguage.value = 'en';
    hide(els.addPanel);
    hide(els.urlTestResult);

    await loadSources();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// --- Event delegation ---

els.container.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === 'toggle') toggleSource(id);
  else if (action === 'test') testSource(id);
  else if (action === 'delete') deleteSource(id);
});

$('#add-source-btn').addEventListener('click', () => {
  els.addPanel.classList.contains('hidden') ? show(els.addPanel) : hide(els.addPanel);
});
$('#cancel-add-btn').addEventListener('click', () => { hide(els.addPanel); hide(els.urlTestResult); });
$('#test-url-btn').addEventListener('click', testUrl);
$('#confirm-add-btn').addEventListener('click', addNewSource);
$('#test-all-btn').addEventListener('click', testAllSources);

els.filterCategory.addEventListener('change', render);
els.filterStatus.addEventListener('change', render);
els.filterVerdict.addEventListener('change', render);

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Init ---
loadSources();
