/**
 * Newsy Catalogue — feed discovery and curation UI.
 * Catalogue entries live in IndexedDB ('catalogue' store).
 * Selected feeds are promoted to the 'sources' store for use by the pipeline.
 */

const API = window.NEWSY_API_BASE || window.location.origin;
const idb = window.newsyIdb;
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

let allEntries = [];
let curatedIds = new Set();
let selected = new Set();

const CATEGORIES = [
  'politics', 'conflict', 'economy', 'science', 'tech',
  'environment', 'health', 'culture', 'sports', 'human', 'meta',
];

const els = {
  container:      $('#cat-container'),
  loading:        $('#loading'),
  stats:          $('#cat-stats'),
  search:         $('#cat-search'),
  filterCategory: $('#filter-category'),
  filterLanguage: $('#filter-language'),
  filterStatus:   $('#filter-status'),
  sortBy:         $('#sort-by'),
  bulkBar:        $('#bulk-bar'),
  selectAll:      $('#select-all'),
  selectCount:    $('#select-count'),
  opmlPanel:      $('#opml-panel'),
  opmlFile:       $('#opml-file'),
  opmlText:       $('#opml-text'),
  opmlResult:     $('#opml-result'),
  addPanel:       $('#add-panel'),
  addName:        $('#add-name'),
  addUrl:         $('#add-url'),
  addCategory:    $('#add-category'),
  addCountry:     $('#add-country'),
  addLanguage:    $('#add-language'),
  urlTestResult:  $('#url-test-result'),
};

// --- Init ---

async function init() {
  await idb.open();
  allEntries = await idb.getAllCatalogue();

  const sources = await idb.getAllSources();
  curatedIds = new Set(sources.map(s => s.id));

  populateFilters();
  render();
  hide(els.loading);
}

// --- Filters ---

function populateFilters() {
  const cats = new Set(CATEGORIES);
  const langs = new Set();

  for (const e of allEntries) {
    if (e.category) cats.add(e.category);
    if (e.language) langs.add(e.language);
  }

  els.filterCategory.innerHTML = '<option value="">all categories</option>' +
    [...cats].sort().map(c => `<option value="${c}">${c}</option>`).join('');

  els.filterLanguage.innerHTML = '<option value="">all languages</option>' +
    [...langs].sort().map(c => `<option value="${c}">${c}</option>`).join('');

  els.addCategory.innerHTML = '<option value="">category</option>' +
    [...cats].sort().map(c => `<option value="${c}">${c}</option>`).join('');
}

function getFiltered() {
  let list = [...allEntries];
  const q = els.search.value.trim().toLowerCase();
  const cat = els.filterCategory.value;
  const lang = els.filterLanguage.value;
  const status = els.filterStatus.value;
  const sort = els.sortBy?.value || 'quality';

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

  els.stats.textContent = `${allEntries.length} feeds` +
    (curatedIds.size ? ` · ${curatedIds.size} curated` : '');

  // Clear old cards
  els.container.querySelectorAll('.cat-card').forEach(c => c.remove());
  els.container.querySelectorAll('.status-message.dynamic').forEach(c => c.remove());

  if (filtered.length === 0) {
    const msg = document.createElement('div');
    msg.className = 'status-message dynamic';
    msg.innerHTML = allEntries.length === 0
      ? '<p>Catalogue is empty. Use <strong>import OPML</strong> or <strong>+ add feed</strong> above to populate it.</p>'
      : '<p>No feeds match the current filters.</p>';
    els.container.appendChild(msg);
  } else {
    for (const entry of filtered) {
      els.container.appendChild(createCard(entry));
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
        <span class="cat-name" title="${esc(entry.name)}">${esc(entry.name)}</span>
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
      <div class="cat-url" title="${esc(entry.rssUrl)}">${esc(entry.rssUrl)}</div>
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
  if (r.feedTitle) parts.push(`<span>"${esc(r.feedTitle)}"</span>`);
  if (r.errors?.length > 0) parts.push(`<span style="color:var(--negative)">${esc(r.errors[0])}</span>`);
  return parts.join('');
}

// --- Bulk selection ---

function updateBulkBar() {
  if (selected.size > 0) {
    show(els.bulkBar);
    els.selectCount.textContent = `${selected.size} selected`;
    const filtered = getFiltered();
    els.selectAll.checked = filtered.length > 0 && filtered.every(e => selected.has(e.id));
  } else {
    hide(els.bulkBar);
    els.selectAll.checked = false;
  }
}

function toggleSelect(id) {
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  // Update just the card visually
  const card = els.container.querySelector(`.cat-card[data-id="${id}"]`);
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
  let xml = els.opmlText.value.trim();

  if (!xml && els.opmlFile.files[0]) {
    xml = await els.opmlFile.files[0].text();
  }

  if (!xml) {
    showOpmlResult('No OPML content provided.', true);
    return;
  }

  const btn = $('#opml-parse-btn');
  btn.disabled = true;
  btn.textContent = 'parsing...';

  try {
    const res = await fetch(`${API}/api/parse-opml`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      await idb.putAllCatalogue(newEntries);
      allEntries = await idb.getAllCatalogue();
      populateFilters();
      render();
    }

    showOpmlResult(
      `Imported ${newEntries.length} feeds from "${data.title}"` +
      (dupeCount > 0 ? ` (${dupeCount} duplicates skipped)` : ''),
      false
    );

    els.opmlText.value = '';
    els.opmlFile.value = '';
  } catch (err) {
    showOpmlResult(`Error: ${err.message}`, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'parse';
  }
}

function showOpmlResult(msg, isError) {
  els.opmlResult.textContent = msg;
  els.opmlResult.className = 'opml-result' + (isError ? ' error' : '');
  show(els.opmlResult);
}

// --- Manual add ---

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
    els.urlTestResult.textContent = formatUrlTestResult(result);
    show(els.urlTestResult);

    if (!els.addName.value && result.feedTitle) {
      els.addName.value = result.feedTitle;
    }
  } catch (err) {
    els.urlTestResult.className = 'test-result fail';
    els.urlTestResult.textContent = `Error: ${err.message}`;
    show(els.urlTestResult);
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
  const name = els.addName.value.trim();
  const rssUrl = els.addUrl.value.trim();
  if (!name || !rssUrl) return alert('Name and URL are required');

  const id = slugify(name);
  if (allEntries.some(e => e.id === id || e.rssUrl === rssUrl)) {
    return alert('This feed already exists in the catalogue');
  }

  const entry = {
    id,
    name,
    rssUrl,
    category: els.addCategory.value,
    country: els.addCountry.value.trim(),
    language: (els.addLanguage.value.trim()) || 'en',
    source: 'manual',
    addedAt: Date.now(),
    lastTestResult: null,
  };

  await idb.putCatalogueEntry(entry);
  allEntries = await idb.getAllCatalogue();
  populateFilters();
  render();

  els.addName.value = '';
  els.addUrl.value = '';
  els.addCountry.value = '';
  hide(els.addPanel);
  hide(els.urlTestResult);
}

// --- Feed testing ---

async function testEntry(id) {
  const entry = allEntries.find(e => e.id === id);
  if (!entry) return;

  const btn = els.container.querySelector(`[data-action="test"][data-id="${id}"]`);
  if (btn) { btn.disabled = true; btn.textContent = '...'; }

  try {
    const res = await fetch(`${API}/api/test-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: entry.rssUrl }),
    });
    const result = await res.json();
    entry.lastTestResult = result;
    if (result.feedTitle && (!entry.name || entry.name === entry.rssUrl)) {
      entry.name = result.feedTitle;
    }
    await idb.putCatalogueEntry(entry);
    allEntries = await idb.getAllCatalogue();
    render();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'test'; }
  }
}

async function bulkTest() {
  const ids = [...selected];
  const btn = $('#bulk-test');
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
        const res = await fetch(`${API}/api/test-feed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: entry.rssUrl }),
        });
        const result = await res.json();
        entry.lastTestResult = result;
        if (result.feedTitle && (!entry.name || entry.name === entry.rssUrl)) {
          entry.name = result.feedTitle;
        }
        await idb.putCatalogueEntry(entry);
      } catch (err) {
        entry.lastTestResult = { verdict: 'fail', errors: [err.message] };
        await idb.putCatalogueEntry(entry);
      }
      done++;
      btn.textContent = `testing ${done}/${ids.length}...`;
    }));
  }

  allEntries = await idb.getAllCatalogue();
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

  const body = $('#curate-modal-body');
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
    li.innerHTML = `<span class="curate-name">${esc(e.name)}</span>
      <span class="curate-detail">${e.category || ''} ${e.country || ''}</span>`;
    ul.appendChild(li);
  }
  for (const e of dupes) {
    const li = document.createElement('li');
    li.className = 'curate-dup';
    li.innerHTML = `<span class="curate-name">${esc(e.name)}</span>
      <span class="curate-detail">already curated</span>`;
    ul.appendChild(li);
  }
  body.appendChild(ul);

  show($('#curate-modal'));
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
    await idb.putSource(sourceRecord);
    curatedIds.add(entry.id);
  }

  _pendingCurate = [];
  selected.clear();
  hide($('#curate-modal'));
  render();
}

function closeCurateModal() {
  hide($('#curate-modal'));
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

    await idb.putAllCatalogue(toAdd);
    allEntries = await idb.getAllCatalogue();
    populateFilters();
    render();
  } catch (err) {
    alert(`Failed to load default catalogue: ${err.message}`);
  }
}

// --- Delete ---

async function deleteEntry(id) {
  await idb.deleteCatalogueEntry(id);
  selected.delete(id);
  allEntries = await idb.getAllCatalogue();
  render();
}


async function clearCatalogue() {
  if (!confirm('Clear entire catalogue? This cannot be undone.')) return;
  await idb.clearCatalogue();
  allEntries = [];
  selected.clear();
  populateFilters();
  render();
}

// --- Utilities ---

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// --- Event delegation ---

els.container.addEventListener('click', (e) => {
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
$('#import-opml-btn').addEventListener('click', () => {
  els.opmlPanel.classList.contains('hidden') ? show(els.opmlPanel) : hide(els.opmlPanel);
  hide(els.addPanel);
});
$('#add-feed-btn').addEventListener('click', () => {
  els.addPanel.classList.contains('hidden') ? show(els.addPanel) : hide(els.addPanel);
  hide(els.opmlPanel);
});
$('#clear-cat-btn').addEventListener('click', clearCatalogue);
$('#load-default-btn').addEventListener('click', loadDefaultCatalogue);

// OPML panel
$('#opml-parse-btn').addEventListener('click', parseOpml);
$('#opml-cancel-btn').addEventListener('click', () => {
  hide(els.opmlPanel);
  hide(els.opmlResult);
});
els.opmlFile.addEventListener('change', async () => {
  if (els.opmlFile.files[0]) {
    const text = await els.opmlFile.files[0].text();
    els.opmlText.value = text;
  }
});

// Add panel
$('#test-url-btn').addEventListener('click', testUrl);
$('#confirm-add-btn').addEventListener('click', addFeed);
$('#cancel-add-btn').addEventListener('click', () => {
  hide(els.addPanel);
  hide(els.urlTestResult);
});

// Filters
els.search.addEventListener('input', render);
els.filterCategory.addEventListener('change', render);
els.filterLanguage.addEventListener('change', render);
els.filterStatus.addEventListener('change', render);
if (els.sortBy) els.sortBy.addEventListener('change', render);

// Bulk actions
els.selectAll.addEventListener('change', selectAllVisible);
$('#bulk-test').addEventListener('click', bulkTest);
$('#bulk-curate').addEventListener('click', () => showCurateModal([...selected]));

// Curate modal
$('#curate-confirm').addEventListener('click', confirmCurate);
$('#curate-cancel').addEventListener('click', closeCurateModal);
$('#curate-modal-close').addEventListener('click', closeCurateModal);
$('#curate-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeCurateModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeCurateModal();
});

// --- Start ---
init();
