/**
 * Newsy Sources Manager — client-side logic for source management UI.
 * Primary data store: IndexedDB (via idb.js). Server is a read-only seed.
 */

const API = window.NEWSY_API_BASE || window.location.origin;
const idb = window.newsyIdb;
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
  urlTestResult: $('#url-test-result'),
  configName: $('#config-name'),
  configSetDefault: $('#config-set-default'),
  configDownload: $('#config-download'),
  configUpload: $('#config-upload'),
  configFile: $('#config-file'),
};

// --- Data loading: idb-first, server-seed fallback ---

async function loadSources() {
  try {
    await idb.open();
    allSources = await idb.getAllSources();

    if (allSources.length === 0) {
      await idb.setMeta('configName', 'newsy-sources');
    }
    categories = deriveCategories(allSources);

    await refreshConfigUI();
    populateFilters();
    render();
  } catch (err) {
    els.container.innerHTML = `<div class="status-message error">Failed to load sources: ${err.message}</div>`;
  }
}

function deriveCategories(sources) {
  const set = new Set(sources.map(s => s.category).filter(Boolean));
  // Ensure baseline categories are present
  for (const c of ['politics', 'conflict', 'economy', 'science', 'tech', 'environment', 'health', 'culture', 'sports', 'human', 'meta']) set.add(c);
  return [...set].sort();
}

function populateFilters() {
  els.filterCategory.innerHTML = '<option value="">all categories</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');

  els.addCategory.innerHTML = '<option value="">domain</option>' +
    categories.map(c => `<option value="${c}">${c}</option>`).join('');
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
  els.container.querySelectorAll('.status-message.dynamic').forEach(c => c.remove());
  hide(els.loading);

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'status-message dynamic';
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

// --- Actions (idb-first, server-sync best-effort) ---

async function toggleSource(id) {
  const scrollY = window.scrollY;
  const source = allSources.find(s => s.id === id);
  if (source) {
    source.enabled = !source.enabled;
  }
  await idb.putSource(source);
  allSources = await idb.getAllSources();
  render();
  window.scrollTo(0, scrollY);
}

async function deleteSource(id) {
  if (!confirm('Remove this source?')) return;
  const scrollY = window.scrollY;
  await idb.deleteSource(id);
  allSources = await idb.getAllSources();
  render();
  window.scrollTo(0, scrollY);
}

async function testSource(id) {
  const btn = document.querySelector(`[data-action="test"][data-id="${id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  const scrollY = window.scrollY;
  try {
    const source = allSources.find(s => s.id === id);
    if (!source) return;
    const res = await fetch(`${API}/api/test-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: source.rssUrl }),
    });
    const result = await res.json();
    source.lastTestResult = result;
    await idb.putSource(source);
    allSources = await idb.getAllSources();
    render();
    window.scrollTo(0, scrollY);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'test'; }
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

  const id = slugify(name);
  if (allSources.some(s => s.id === id)) return alert(`Source '${id}' already exists`);

  const record = {
    id,
    name,
    rssUrl,
    enabled: false,
    fetchIntervalMin: 30,
    category: els.addCategory.value,
    country: els.addCountry.value.trim() || 'international',
    language: 'en',
    lastTestResult: null,
  };

  try {
    await idb.putSource(record);

    // Reset form
    els.addName.value = '';
    els.addUrl.value = '';
    els.addCountry.value = 'international';
    hide(els.addPanel);
    hide(els.urlTestResult);

    allSources = await idb.getAllSources();
    render();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// --- Config download / upload ---

async function downloadConfig() {
  await saveConfigName();
  const config = await idb.exportConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${config.configName || 'newsy-sources'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function uploadConfig(file) {
  try {
    const text = await file.text();
    const incoming = JSON.parse(text);
    if (!incoming || !Array.isArray(incoming.sources)) {
      throw new Error('Invalid config: missing sources array');
    }
    const current = await idb.exportConfig();
    const diff = diffConfigs(current.sources, incoming.sources);
    showDiffModal({
      title: `Load "${incoming.configName || file.name}"?`,
      diff,
      showActions: true,
      onConfirm: async () => {
        await idb.importConfig(incoming);
        await reloadSourcesFromStore();
      },
      onMerge: diff.removed.length > 0 ? async () => {
        await mergeIntoCurrent(incoming);
      } : null,
    });
  } catch (err) {
    alert(`Failed to read config: ${err.message}`);
  }
}

async function loadDefaultSources() {
  const defaults = window.DEFAULT_SOURCES || [];
  const current = await idb.exportConfig();
  const diff = diffConfigs(current.sources, defaults);
  showDiffModal({
    title: 'Reset to default sources?',
    diff,
    showActions: true,
    onConfirm: async () => {
      const config = { configName: 'newsy-sources', sources: defaults };
      await idb.importConfig(config);
      await reloadSourcesFromStore();
    },
    onMerge: diff.removed.length > 0 ? async () => {
      await mergeIntoCurrent({ configName: 'newsy-sources', sources: defaults });
    } : null,
  });
}

async function mergeIntoCurrent(incoming) {
  const current = await idb.exportConfig();
  const merged = new Map((current.sources || []).map(s => [s.id, s]));
  for (const src of incoming.sources || []) {
    if (!src || !src.id) continue;
    merged.set(src.id, src);
  }
  await idb.importConfig({
    configName: current.configName || 'newsy-sources',
    sources: Array.from(merged.values()),
  });
  await reloadSourcesFromStore();
}

async function reloadSourcesFromStore() {
  allSources = await idb.getAllSources();
  categories = deriveCategories(allSources);
  populateFilters();
  render();
  await refreshConfigUI();
}

// --- Diff engine ---

function diffConfigs(before, after) {
  const beforeMap = new Map((before || []).map(s => [s.id, s]));
  const afterMap  = new Map((after  || []).map(s => [s.id, s]));

  const added   = [];
  const removed = [];
  const changed = [];
  const same    = [];

  for (const [id, s] of afterMap) {
    if (!beforeMap.has(id)) {
      added.push(s);
    } else {
      const b = beforeMap.get(id);
      const changes = [];
      if (b.enabled !== s.enabled) changes.push(s.enabled ? 'enabled' : 'disabled');
      if (b.name !== s.name) changes.push(`renamed`);
      if (b.rssUrl !== s.rssUrl) changes.push(`url changed`);
      if (changes.length) changed.push({ source: s, changes });
      else same.push(s);
    }
  }

  for (const [id, s] of beforeMap) {
    if (!afterMap.has(id)) removed.push(s);
  }

  return { added, removed, changed, same };
}

// --- Diff modal ---

let _diffOnConfirm = null;
let _diffOnMerge = null;
let _diffCurrentMode = 'replace';
let _diffBaseDiff = null;

function showDiffModal({ title, diff, showActions, onConfirm, onMerge }) {
  const modal    = $('#diff-modal');
  const titleEl  = $('#diff-modal-title');
  const footerEl = $('#diff-modal-footer');
  const modeToggle = $('#diff-mode-toggle');
  const confirmBtn = $('#diff-confirm');

  titleEl.textContent = title;
  _diffBaseDiff = diff;
  _diffCurrentMode = 'replace';
  renderDiffWithMode();
  resetDiffModeRadios();
  if (confirmBtn) confirmBtn.textContent = onMerge ? 'apply changes' : 'load this config';

  if (showActions) {
    show(footerEl);
    _diffOnConfirm = onConfirm;
    _diffOnMerge = onMerge || null;
    if (modeToggle) {
      if (onMerge) {
        show(modeToggle);
      } else {
        hide(modeToggle);
      }
    }
  } else {
    hide(footerEl);
    _diffOnConfirm = null;
    _diffOnMerge = null;
    if (modeToggle) hide(modeToggle);
  }

  modal.classList.remove('hidden');
}

function closeDiffModal() {
  $('#diff-modal').classList.add('hidden');
  _diffOnConfirm = null;
  _diffOnMerge = null;
}

function resetDiffModeRadios() {
  document.querySelectorAll('input[name="diff-mode"]').forEach(input => {
    input.checked = input.value === 'replace';
  });
}

function renderDiffWithMode() {
  const bodyEl = $('#diff-modal-body');
  if (!bodyEl || !_diffBaseDiff) return;
  if (_diffCurrentMode === 'preserve') {
    const filtered = {
      ..._diffBaseDiff,
      removed: [],
    };
    bodyEl.innerHTML = renderDiff(filtered);
  } else {
    bodyEl.innerHTML = renderDiff(_diffBaseDiff);
  }
}

function renderDiff({ added, removed, changed, same }) {
  const rows = [];

  const section = (label) =>
    `<div class="diff-section-label">${label}</div>`;

  const row = (cls, prefix, name, detail = '') =>
    `<div class="diff-row ${cls}">
      <span class="diff-prefix">${prefix}</span>
      <span class="diff-row-name">${esc(name)}</span>
      ${detail ? `<span class="diff-row-detail">${detail}</span>` : ''}
    </div>`;

  if (added.length) {
    rows.push(section(`${added.length} added`));
    added.forEach(s => rows.push(row('diff-added', '+', s.name, s.category || '')));
  }
  if (removed.length) {
    rows.push(section(`${removed.length} removed`));
    removed.forEach(s => rows.push(row('diff-removed', '−', s.name, s.category || '')));
  }
  if (changed.length) {
    rows.push(section(`${changed.length} changed`));
    changed.forEach(({ source: s, changes }) =>
      rows.push(row('diff-changed', '~', s.name, changes.join(', '))));
  }
  if (same.length) {
    rows.push(section(`${same.length} unchanged`));
    same.forEach(s => rows.push(row('diff-same', ' ', s.name, s.enabled ? 'on' : 'off')));
  }
  if (!added.length && !removed.length && !changed.length && !same.length) {
    rows.push('<p class="diff-empty">Nothing to show.</p>');
  }

  return rows.join('');
}

async function refreshConfigUI() {
  if (!els.configName) return;
  const name = await idb.getMeta('configName') || 'newsy-sources';
  els.configName.value = name;
}

async function saveConfigName() {
  const name = els.configName.value.trim() || 'newsy-sources';
  els.configName.value = name;
  await idb.setMeta('configName', name);
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
els.filterCategory.addEventListener('change', render);
els.filterStatus.addEventListener('change', render);
els.filterVerdict.addEventListener('change', render);

if (els.configName) els.configName.addEventListener('change', saveConfigName);
if (els.configName) els.configName.addEventListener('blur', saveConfigName);
if (els.configSetDefault) els.configSetDefault.addEventListener('click', loadDefaultSources);
if (els.configDownload) els.configDownload.addEventListener('click', downloadConfig);
if (els.configUpload) els.configUpload.addEventListener('click', () => els.configFile.click());
if (els.configFile) els.configFile.addEventListener('change', (e) => {
  if (e.target.files[0]) uploadConfig(e.target.files[0]);
  e.target.value = '';
});

$('#diff-modal-close').addEventListener('click', closeDiffModal);
$('#diff-modal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDiffModal(); });
$('#diff-cancel').addEventListener('click', closeDiffModal);
$('#diff-confirm').addEventListener('click', async () => {
  if (_diffCurrentMode === 'preserve' && _diffOnMerge) {
    await _diffOnMerge();
  } else if (_diffOnConfirm) {
    await _diffOnConfirm();
  }
  closeDiffModal();
});

document.querySelectorAll('input[name="diff-mode"]').forEach(input => {
  input.addEventListener('change', () => {
    if (!input.checked) return;
    _diffCurrentMode = input.value;
    renderDiffWithMode();
  });
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeDiffModal();
});

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Init ---
loadSources();
