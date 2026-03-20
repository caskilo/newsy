/**
 * Newsy Catalogue — feed discovery and curation UI.
 * Catalogue entries live in IndexedDB ('catalogue' store).
 * Selected feeds are promoted to the 'sources' store for use by the pipeline.
 */

(function () {
'use strict';

const _catAPI = window.NEWSY_API_BASE || window.location.origin;
const _catIdb = window.newsyIdb;
const _cat$ = (sel) => document.querySelector(sel);
const _catShow = (el) => el.classList.remove('hidden');
const _catHide = (el) => el.classList.add('hidden');

let allEntries = [];
let curatedIds = new Set();
let selected = new Set();

const CATEGORIES = [
  'politics', 'conflict', 'economy', 'science', 'tech',
  'environment', 'health', 'culture', 'sports', 'human', 'meta',
];

function _catEsc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const catEls = {
  container:      _cat$('#cat-container'),
  loading:        _cat$('#cat-loading'),
  stats:          _cat$('#cat-stats'),
  search:         _cat$('#cat-search'),
  filterCategory: _cat$('#cat-filter-category'),
  filterLanguage: _cat$('#cat-filter-language'),
  filterStatus:   _cat$('#cat-filter-status'),
  sortBy:         _cat$('#cat-sort-by'),
  bulkBar:        _cat$('#bulk-bar'),
  selectAll:      _cat$('#select-all'),
  selectCount:    _cat$('#select-count'),
  opmlPanel:      _cat$('#opml-panel'),
  opmlFile:       _cat$('#opml-file'),
  opmlText:       _cat$('#opml-text'),
  opmlResult:     _cat$('#opml-result'),
  addPanel:       _cat$('#cat-add-panel'),
  addName:        _cat$('#cat-add-name'),
  addUrl:         _cat$('#cat-add-url'),
  addCategory:    _cat$('#cat-add-category'),
  addCountry:     _cat$('#cat-add-country'),
  addLanguage:    _cat$('#cat-add-language'),
  urlTestResult:  _cat$('#cat-url-test-result'),
};

// --- Init ---

async function catInit() {
  await _catIdb.open();
  allEntries = await _catIdb.getAllCatalogue();

  const sources = await _catIdb.getAllSources();
  curatedIds = new Set(sources.map(s => s.id));

  populateFilters();
  render();
  _catHide(catEls.loading);
}

// --- Filters ---

function populateFilters() {
  const cats = new Set(CATEGORIES);
  const langs = new Set();

  for (const e of allEntries) {
    if (e.category) cats.add(e.category);
    if (e.language) langs.add(e.language);
  }

  catEls.filterCategory.innerHTML = '<option value="">all categories</option>' +
    [...cats].sort().map(c => `<option value="${c}">${c}</option>`).join('');

  catEls.filterLanguage.innerHTML = '<option value="">all languages</option>' +
    [...langs].sort().map(c => `<option value="${c}">${c}</option>`).join('');

  catEls.addCategory.innerHTML = '<option value="">category</option>' +
    [...cats].sort().map(c => `<option value="${c}">${c}</option>`).join('');
}

function getFiltered() {
  let list = [...allEntries];
  const q = catEls.search.value.trim().toLowerCase();
  const cat = catEls.filterCategory.value;
  const lang = catEls.filterLanguage.value;
  const status = catEls.filterStatus.value;
  const sort = catEls.sortBy?.value || 'quality';

  if (q) list = list.filter(e =>
    (e.name || '').toLowerCase().includes(q) ||
    (e.rssUrl || '').toLowerCase().includes(q));
  if (cat) list = list.filter(e => e.category === cat);
  if (lang) list = list.filter(e => e.language === lang);
  if (status === 'untested') list = list.filter(e => !e.lastTestResult);
  else if (status) list = list.filter(e => e.lastTestResult?.verdict === status);

  if (sort === 'quality') {
    list.sort((a, b) => (b.qualityScore ?? 0) - (a.qualityScore ?? 0));
  } else if (sort === 'name') {
    list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  } else if (sort === 'added') {
    list.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  }

  return list;
}

// --- Rendering ---

function render() {
  const filtered = getFiltered();

  catEls.stats.textContent = `${allEntries.length} feeds` +
    (curatedIds.size ? ` · ${curatedIds.size} curated` : '');

  // Clear old cards
  catEls.container.querySelectorAll('.cat-card').forEach(c => c.remove());
  catEls.container.querySelectorAll('.status-message.dynamic').forEach(c => c.remove());

  if (filtered.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'status-message dynamic';
    msg.innerHTML = allEntries.length === 0
      ? '<p>Catalogue is empty. Use <strong>import OPML</strong> or <strong>+ add feed</strong> above to populate it.</p>'
      : '<p>No feeds match the current filters.</p>';
    catEls.container.appendChild(msg);
  } else {
    for (const entry of filtered) {
      catEls.container.appendChild(createCard(entry));
    }
  }

  updateBulkBar();
}

function createCard(entry) {
  const card = document.createElement('div');
  card.className = 'cat-card' +
    (selected.has(entry.id) ? ' selected' : '') +
    (curatedIds.has(entry.id) ? ' curated' : '');
  card.dataset.id = entry.id;

  const verdict = entry.lastTestResult?.verdict || 'untested';
  const testHtml = entry.lastTestResult ? formatTestDetail(entry.lastTestResult) : '';
  const sourceCount = Array.isArray(entry.sources) ? entry.sources.length : 1;
  const qualityHtml = entry.qualityScore != null
    ? `<span class="quality-score" title="Quality score (0–100)">Q${entry.qualityScore}</span>`
    : '';
  const multiSrcHtml = sourceCount > 1
    ? `<span class="tag tag-multi-src" title="Appears in ${sourceCount} independent sources">${sourceCount} sources</span>`
    : '';

  card.innerHTML = `
    <input type="checkbox" class="cat-check" data-id="${entry.id}"
           ${selected.has(entry.id) ? 'checked' : ''}>
    <div class="cat-body">
      <div class="cat-main-row">
        <span class="cat-name" title="${_catEsc(entry.name)}">${_catEsc(entry.name)}</span>
        <div class="cat-side">
          <span class="verdict-badge verdict-${verdict}">${verdict}</span>
          <div class="cat-actions">
            ${qualityHtml}
            <button class="btn-icon" data-action="test" data-id="${entry.id}" title="Test feed">test</button>
            ${curatedIds.has(entry.id)
              ? '<span class="tag tag-curated">in sources</span>'
              : `<button class="btn-icon btn-icon-curate" data-action="curate-one" data-id="${entry.id}" title="Add to curated sources">+ add to sources</button>`}
            <button class="btn-icon btn-icon-danger" data-action="delete" data-id="${entry.id}" title="Remove from catalogue" aria-label="Remove from catalogue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
          </div>
        </div>
      </div>
      <div class="cat-url" title="${_catEsc(entry.rssUrl)}">${_catEsc(entry.rssUrl)}</div>
      <div class="cat-tags">
        ${entry.category ? `<span class="tag tag-category">${entry.category}</span>` : ''}
        ${entry.country ? `<span class="tag tag-country">${entry.country}</span>` : ''}
        ${entry.language ? `<span class="tag tag-language">${entry.language}</span>` : ''}
        ${multiSrcHtml}
      </div>
      ${testHtml ? `<div class="test-detail">${testHtml}</div>` : ''}
    </div>
  `;

  return card;
}

function formatTestDetail(r) {
  const parts = [];
  if (r.itemCount !== undefined) parts.push(`<span>${r.itemCount} items</span>`);
  if (r.freshnessHours != null) parts.push(`<span>latest: ${r.freshnessHours}h ago</span>`);
  if (r.responseTimeMs) parts.push(`<span>${r.responseTimeMs}ms</span>`);
  if (r.feedTitle) parts.push(`<span>"${_catEsc(r.feedTitle)}"</span>`);
  if (r.errors?.length > 0) parts.push(`<span style="color:var(--negative)">${_catEsc(r.errors[0])}</span>`);
  return parts.join('');
}

// --- Bulk selection ---

function updateBulkBar() {
  if (selected.size > 0) {
    _catShow(catEls.bulkBar);
    catEls.selectCount.textContent = `${selected.size} selected`;
    const filtered = getFiltered();
    catEls.selectAll.checked = filtered.length > 0 && filtered.every(e => selected.has(e.id));
  } else {
    _catHide(catEls.bulkBar);
    catEls.selectAll.checked = false;
  }
}

function toggleSelect(id) {
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  // Update just the card visually
  const card = catEls.container.querySelector(`.cat-card[data-id="${id}"]`);
  if (card) {
    card.classList.toggle('selected', selected.has(id));
    const cb = card.querySelector('.cat-check');
    if (cb) cb.checked = selected.has(id);
  }
  updateBulkBar();
}

function selectAllVisible() {
  const filtered = getFiltered();
  const allSelected = filtered.every(e => selected.has(e.id));
  for (const e of filtered) {
    if (allSelected) selected.delete(e.id);
    else selected.add(e.id);
  }
  render();
}

// --- OPML Import ---

async function parseOpml() {
  let xml = catEls.opmlText.value.trim();

  if (!xml && catEls.opmlFile.files[0]) {
    xml = await catEls.opmlFile.files[0].text();
  }

  if (!xml) {
    showOpmlResult('No OPML content provided.', true);
    return;
  }

  const btn = _cat$('#opml-parse-btn');
  btn.disabled = true;
  btn.textContent = 'parsing...';

  try {
    const res = await fetch(`${_catAPI}/api/parse-opml`, {
      method: 'POST',
      headers: newsyHeaders(),
      body: JSON.stringify({ xml }),
    });
    const data = await res.json();

    if (data.error) {
      showOpmlResult(data.error, true);
      return;
    }

    if (!data.sources || data.sources.length === 0) {
      showOpmlResult('No feeds found in OPML.', true);
      return;
    }

    // Convert to catalogue entries
    const entries = data.sources.map(s => ({
      id: slugify(s.name || s.rssUrl),
      name: s.name || s.rssUrl,
      rssUrl: s.rssUrl,
      category: s.domain || '',
      country: '',
      language: s.language || 'en',
      source: 'opml',
      addedAt: Date.now(),
      lastTestResult: null,
    }));

    // Dedupe against existing catalogue
    const existing = new Set(allEntries.map(e => e.id));
    let dupeCount = 0;
    const newEntries = [];
    for (const e of entries) {
      // Also dedupe by URL
      let origId = e.id;
      if (existing.has(e.id) || allEntries.some(x => x.rssUrl === e.rssUrl)) {
        dupeCount++;
        continue;
      }
      // Handle id collisions from different feeds with similar names
      let counter = 2;
      while (existing.has(e.id)) {
        e.id = `${origId}-${counter++}`;
      }
      existing.add(e.id);
      newEntries.push(e);
    }

    if (newEntries.length > 0) {
      await _catIdb.putAllCatalogue(newEntries);
      allEntries = await _catIdb.getAllCatalogue();
      populateFilters();
      render();
    }

    showOpmlResult(
      `Imported ${newEntries.length} feeds from "${data.title}"` +
      (dupeCount > 0 ? ` (${dupeCount} duplicates skipped)` : ''),
      false
    );

    catEls.opmlText.value = '';
    catEls.opmlFile.value = '';
  } catch (err) {
    showOpmlResult(`Error: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'parse';
  }
}

function showOpmlResult(msg, isError) {
  catEls.opmlResult.textContent = msg;
  catEls.opmlResult.className = 'opml-result' + (isError ? ' error' : '');
  _catShow(catEls.opmlResult);
}

// --- Manual add ---

async function testUrl() {
  const url = catEls.addUrl.value.trim();
  if (!url) return;

  const btn = _cat$('#cat-test-url-btn');
  btn.disabled = true;
  btn.textContent = 'testing...';
  _catHide(catEls.urlTestResult);

  try {
    const res = await fetch(`${_catAPI}/api/test-feed`, {
      method: 'POST',
      headers: newsyHeaders(),
      body: JSON.stringify({ url }),
    });
    const result = await res.json();

    catEls.urlTestResult.className = `test-result ${result.verdict || 'fail'}`;
    catEls.urlTestResult.textContent = formatUrlTestResult(result);
    _catShow(catEls.urlTestResult);

    if (!catEls.addName.value && result.feedTitle) {
      catEls.addName.value = result.feedTitle;
    }
  } catch (err) {
    catEls.urlTestResult.className = 'test-result fail';
    catEls.urlTestResult.textContent = `Error: ${err.message}`;
    _catShow(catEls.urlTestResult);
  } finally {
    btn.disabled = false;
    btn.textContent = 'test URL';
  }
}

function formatUrlTestResult(r) {
  const lines = [];
  lines.push(`verdict: ${r.verdict}  |  reachable: ${r.reachable}  |  parsable: ${r.parsable}`);
  if (r.feedTitle) lines.push(`title: "${r.feedTitle}"`);
  lines.push(`items: ${r.itemCount}  |  response: ${r.responseTimeMs}ms`);
  if (r.freshnessHours != null) lines.push(`latest item: ${r.freshnessHours}h ago`);
  if (r.errors?.length > 0) lines.push(`issues: ${r.errors.join(', ')}`);
  return lines.join('\n');
}

async function addFeed() {
  const name = catEls.addName.value.trim();
  const rssUrl = catEls.addUrl.value.trim();
  if (!name || !rssUrl) return alert('Name and URL are required');

  const id = slugify(name);
  if (allEntries.some(e => e.id === id || e.rssUrl === rssUrl)) {
    return alert('This feed already exists in the catalogue');
  }

  const entry = {
    id,
    name,
    rssUrl,
    category: catEls.addCategory.value,
    country: catEls.addCountry.value.trim(),
    language: (catEls.addLanguage.value.trim()) || 'en',
    source: 'manual',
    addedAt: Date.now(),
    lastTestResult: null,
  };

  await _catIdb.putCatalogueEntry(entry);
  allEntries = await _catIdb.getAllCatalogue();
  populateFilters();
  render();

  catEls.addName.value = '';
  catEls.addUrl.value = '';
  catEls.addCountry.value = '';
  _catHide(catEls.addPanel);
  _catHide(catEls.urlTestResult);
}

// --- Feed testing ---

async function testEntry(id) {
  const entry = allEntries.find(e => e.id === id);
  if (!entry) return;

  const btn = catEls.container.querySelector(`[data-action="test"][data-id="${id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    const res = await fetch(`${_catAPI}/api/test-feed`, {
      method: 'POST',
      headers: newsyHeaders(),
      body: JSON.stringify({ url: entry.rssUrl }),
    });
    const result = await res.json();
    entry.lastTestResult = result;
    if (result.feedTitle && (!entry.name || entry.name === entry.rssUrl)) {
      entry.name = result.feedTitle;
    }
    await _catIdb.putCatalogueEntry(entry);
    allEntries = await _catIdb.getAllCatalogue();
    render();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'test'; }
  }
}

async function bulkTest() {
  const ids = [...selected];
  const btn = _cat$('#bulk-test');
  btn.disabled = true;
  btn.textContent = `testing 0/${ids.length}...`;

  let done = 0;
  // Test in batches of 3
  for (let i = 0; i < ids.length; i += 3) {
    const batch = ids.slice(i, i + 3);
    await Promise.all(batch.map(async (id) => {
      const entry = allEntries.find(e => e.id === id);
      if (!entry) return;
      try {
        const res = await fetch(`${_catAPI}/api/test-feed`, {
          method: 'POST',
          headers: newsyHeaders(),
          body: JSON.stringify({ url: entry.rssUrl }),
        });
        const result = await res.json();
        entry.lastTestResult = result;
        if (result.feedTitle && (!entry.name || entry.name === entry.rssUrl)) {
          entry.name = result.feedTitle;
        }
        await _catIdb.putCatalogueEntry(entry);
      } catch (err) {
        entry.lastTestResult = { verdict: 'fail', errors: [err.message] };
        await _catIdb.putCatalogueEntry(entry);
      }
      done++;
      btn.textContent = `testing ${done}/${ids.length}...`;
    }));
  }

  allEntries = await _catIdb.getAllCatalogue();
  render();
  btn.disabled = false;
  btn.textContent = 'test selected';
}

// --- Curation (catalogue → sources) ---

function showCurateModal(ids) {
  const entries = allEntries.filter(e => ids.includes(e.id));
  if (entries.length === 0) return;

  const newOnes = entries.filter(e => !curatedIds.has(e.id));
  const dupes = entries.filter(e => curatedIds.has(e.id));

  const body = _cat$('#curate-modal-body');
  body.innerHTML = '';

  const summary = document.createElement('p');
  summary.className = 'curate-summary';
  summary.textContent = `${newOnes.length} new feed${newOnes.length !== 1 ? 's' : ''} will be added to your curated sources.` +
    (dupes.length > 0 ? ` ${dupes.length} already curated.` : '');
  body.appendChild(summary);

  const ul = document.createElement('ul');
  ul.className = 'curate-list';
  for (const e of newOnes) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="curate-name">${_catEsc(e.name)}</span>
      <span class="curate-detail">${e.category || ''} ${e.country || ''}</span>`;
    ul.appendChild(li);
  }
  for (const e of dupes) {
    const li = document.createElement('li');
    li.className = 'curate-dup';
    li.innerHTML = `<span class="curate-name">${_catEsc(e.name)}</span>
      <span class="curate-detail">already curated</span>`;
    ul.appendChild(li);
  }
  body.appendChild(ul);

  _catShow(_cat$('#curate-modal'));
  _pendingCurate = newOnes;
}

let _pendingCurate = [];

async function confirmCurate() {
  for (const entry of _pendingCurate) {
    const sourceRecord = {
      id: entry.id,
      name: entry.name,
      rssUrl: entry.rssUrl,
      enabled: false,
      fetchIntervalMin: 30,
      category: entry.category || '',
      country: entry.country || 'international',
      language: entry.language || 'en',
      lastTestResult: entry.lastTestResult || null,
    };
    await _catIdb.putSource(sourceRecord);
    curatedIds.add(entry.id);
  }

  _pendingCurate = [];
  selected.clear();
  _catHide(_cat$('#curate-modal'));
  render();
}

function closeCurateModal() {
  _catHide(_cat$('#curate-modal'));
  _pendingCurate = [];
}

// --- Load default catalogue ---

async function loadDefaultCatalogue() {
  try {
    const res = await fetch('./catalogue.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const entries = await res.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      return alert('Default catalogue is empty or invalid.');
    }

    const existingUrls = new Set(allEntries.map(e => (e.rssUrl || '').toLowerCase().replace(/\/$/, '')));
    let added = 0;
    const toAdd = [];
    const seenIds = new Set(allEntries.map(e => e.id));

    for (const entry of entries) {
      const normUrl = (entry.rssUrl || '').toLowerCase().replace(/\/$/, '');
      if (existingUrls.has(normUrl)) continue;
      let id = entry.id || slugify(entry.name || entry.rssUrl);
      const origId = id;
      let counter = 2;
      while (seenIds.has(id)) id = `${origId}-${counter++}`;
      seenIds.add(id);
      existingUrls.add(normUrl);
      toAdd.push({ ...entry, id, addedAt: entry.addedAt || Date.now() });
      added++;
    }

    if (added === 0) {
      return alert('All default catalogue feeds are already in your catalogue.');
    }

    if (!confirm(`Load ${added} feeds from the default catalogue? (${entries.length - added} already present)`)) return;

    await _catIdb.putAllCatalogue(toAdd);
    allEntries = await _catIdb.getAllCatalogue();
    populateFilters();
    render();
  } catch (err) {
    alert(`Failed to load default catalogue: ${err.message}`);
  }
}

// --- Delete ---

async function deleteEntry(id) {
  await _catIdb.deleteCatalogueEntry(id);
  selected.delete(id);
  allEntries = await _catIdb.getAllCatalogue();
  render();
}


async function clearCatalogue() {
  if (!confirm('Clear entire catalogue? This cannot be undone.')) return;
  await _catIdb.clearCatalogue();
  allEntries = [];
  selected.clear();
  populateFilters();
  render();
}

// --- Utilities ---

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

// --- Event delegation ---

catEls.container.addEventListener('click', (e) => {
  const cb = e.target.closest('.cat-check');
  if (cb) {
    e.stopPropagation();
    toggleSelect(cb.dataset.id);
    return;
  }

  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === 'test') testEntry(id);
  else if (action === 'curate-one') showCurateModal([id]);
  else if (action === 'delete') deleteEntry(id);
});

// Import bar
_cat$('#import-opml-btn').addEventListener('click', () => {
  catEls.opmlPanel.classList.contains('hidden') ? _catShow(catEls.opmlPanel) : _catHide(catEls.opmlPanel);
  _catHide(catEls.addPanel);
});
_cat$('#add-feed-btn').addEventListener('click', () => {
  catEls.addPanel.classList.contains('hidden') ? _catShow(catEls.addPanel) : _catHide(catEls.addPanel);
  _catHide(catEls.opmlPanel);
});
_cat$('#clear-cat-btn').addEventListener('click', clearCatalogue);
_cat$('#load-default-btn').addEventListener('click', loadDefaultCatalogue);

// OPML panel
_cat$('#opml-parse-btn').addEventListener('click', parseOpml);
_cat$('#opml-cancel-btn').addEventListener('click', () => {
  _catHide(catEls.opmlPanel);
  _catHide(catEls.opmlResult);
});
catEls.opmlFile.addEventListener('change', async () => {
  if (catEls.opmlFile.files[0]) {
    const text = await catEls.opmlFile.files[0].text();
    catEls.opmlText.value = text;
  }
});

// Add panel
_cat$('#cat-test-url-btn').addEventListener('click', testUrl);
_cat$('#cat-confirm-add-btn').addEventListener('click', addFeed);
_cat$('#cat-cancel-add-btn').addEventListener('click', () => {
  _catHide(catEls.addPanel);
  _catHide(catEls.urlTestResult);
});

// Filters
catEls.search.addEventListener('input', render);
catEls.filterCategory.addEventListener('change', render);
catEls.filterLanguage.addEventListener('change', render);
catEls.filterStatus.addEventListener('change', render);
if (catEls.sortBy) catEls.sortBy.addEventListener('change', render);

// Bulk actions
catEls.selectAll.addEventListener('change', selectAllVisible);
_cat$('#bulk-test').addEventListener('click', bulkTest);
_cat$('#bulk-curate').addEventListener('click', () => showCurateModal([...selected]));

// Curate modal
_cat$('#curate-confirm').addEventListener('click', confirmCurate);
_cat$('#curate-cancel').addEventListener('click', closeCurateModal);
_cat$('#curate-modal-close').addEventListener('click', closeCurateModal);
_cat$('#curate-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeCurateModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCurateModal();
});

// --- Start (lazy SPA init) ---

function initCataloguePanel() {
  if (window.newsyShell && window.newsyShell.isInitialised('catalogue')) return;
  if (window.newsyShell) window.newsyShell.markInitialised('catalogue');
  catInit();
}

if (window.newsyShell) {
  window.addEventListener('panel-activate', (e) => {
    if (e.detail.panel === 'catalogue') initCataloguePanel();
  });
  if (window.newsyShell.currentPanel() === 'catalogue') initCataloguePanel();
} else {
  initCataloguePanel();
}

})(); // end IIFE
