/**
 * Newsy Client — fetches brief from server and renders it.
 *
 * Renders story groups (multi-source) and standalone articles.
 * Supports drag-to-group manual curation with reinforcement learning.
 */

const API_BASE = window.location.origin;

const $ = (sel) => document.querySelector(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

// --- State ---
let currentBrief = null;
let allItems = [];       // unified: groups + standalone articles, each with .itemType
const defaultFlagFilter = { type: 'flagged', value: 'flagged', label: 'flagged posts', mode: 'exclude', auto: true };
let activeFilters = [defaultFlagFilter];  // filters with include/exclude mode
let searchQuery = '';
let manualGroups = [];   // client-side manual groups
let dragArticleId = null;
let dragModeActive = false;
let excludePreviewActive = false;

const elements = {
  loading: $('#loading'),
  error: $('#error'),
  empty: $('#empty'),
  container: $('#articles-container'),
  meta: $('#brief-meta'),
  metaCount: $('#meta-count'),
  metaTime: $('#meta-time'),
  metaEmotional: $('#meta-emotional'),
  metaMode: $('#meta-mode'),
  footer: $('#footer'),
  refreshBtn: $('#refresh-btn'),
  filterBar: $('#filter-bar'),
  activeFilters: $('#active-filters'),
  filterCountry: $('#filter-country'),
  filterDomain: $('#filter-domain'),
  filterRegister: $('#filter-register'),
  pageSearch: $('#page-search'),
  sidebar: $('#group-sidebar'),
  sidebarGroups: $('#sidebar-groups'),
  sidebarClose: $('#sidebar-close'),
  sidebarNewGroup: $('#sidebar-new-group'),
  dragOverlay: $('#drag-overlay'),
  dragToggleBtn: $('#drag-toggle'),
  readerModal: $('#reader-modal'),
  readerTitle: $('#reader-title'),
  readerBody: $('#reader-body'),
  readerSource: $('#reader-source'),
  readerTime: $('#reader-time'),
  readerReadTime: $('#reader-read-time'),
  readerTags: $('#reader-tags'),
  readerLink: $('#reader-link'),
  readerClose: $('#reader-close'),
  readerBackdrop: document.querySelector('.reader-backdrop'),
};

// ─── Fetch ───

async function fetchBrief(forceRefresh = false) {
  elements.refreshBtn.classList.add('spinning');
  show(elements.loading);
  hide(elements.error);
  hide(elements.empty);
  hide(elements.footer);
  clearContainer();

  try {
    const params = new URLSearchParams();
    if (forceRefresh) params.set('refresh', 'true');

    const res = await fetch(`${API_BASE}/api/brief?${params}`);
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    currentBrief = await res.json();
    hide(elements.loading);
    renderBrief(currentBrief);
  } catch (err) {
    hide(elements.loading);
    elements.error.textContent = `Failed to load brief: ${err.message}`;
    elements.error.classList.add('error');
    show(elements.error);
  } finally {
    elements.refreshBtn.classList.remove('spinning');
  }
}

function clearContainer() {
  elements.container.querySelectorAll('.groups-grid, .story-group, .article-card').forEach(c => c.remove());
}

// ─── Render ───

function renderBrief(brief) {
  const groups = brief.groups || [];
  const articles = brief.articles || [];

  if (groups.length === 0 && articles.length === 0) {
    show(elements.empty);
    return;
  }

  // Build unified item list for filtering
  allItems = [];

  elements.metaCount.textContent = `${brief.articleCount} articles`;
  elements.metaTime.textContent = `${brief.totalReadTime} min read`;
  elements.metaEmotional.textContent = `emotional load: ${brief.emotionalLoad}`;
  elements.metaMode.textContent = brief.mode;
  show(elements.meta);

  // Render groups in a grid
  if (groups.length > 0) {
    const grid = document.createElement('div');
    grid.className = 'groups-grid';
    for (const group of groups) {
      const el = createGroupCard(group);
      const flagged = group.sources.some(s => (s.contentFlags || []).length > 0);
      setFilterData(el, group.domain, group.register, group.countryCode, group.headline + ' ' + group.sources.map(s => s.title).join(' '), flagged);
      grid.appendChild(el);
      allItems.push({ type: 'group', data: group, el });
    }
    elements.container.appendChild(grid);
  }

  // Render standalone articles
  for (const article of articles) {
    const el = createArticleCard(article);
    const flagged = (article.contentFlags || []).length > 0;
    setFilterData(el, article.domain, article.register, article.countryCode, article.title + ' ' + (article.summary || '') + ' ' + (article.sourceName || ''), flagged);
    el.draggable = false;  // draggable only when drag mode is active
    el.dataset.articleId = article.id;
    elements.container.appendChild(el);
    allItems.push({ type: 'article', data: article, el });
  }

  buildFilterDropdowns();
  renderFilterChips();
  show(elements.filterBar);
  applyFilters();
  show(elements.footer);
}

function setFilterData(el, domain, register, country, searchableText, flagged = false) {
  el.dataset.domain = domain || '';
  el.dataset.register = register || '';
  el.dataset.country = country || '';
  el.dataset.searchText = (searchableText || '').toLowerCase();
  el.dataset.flagged = flagged ? 'flagged' : '';
}

// ─── Group card ───

function createGroupCard(group) {
  const card = document.createElement('div');
  card.className = `story-group${group.register ? ' register-' + group.register : ''}`;
  card.dataset.groupId = group.groupId;

  const domainHtml = group.domain ? `<span class="domain-tag domain-${group.domain}">${group.domain}</span>` : '';
  const registerHtml = group.register ? `<span class="register-tag register-${group.register}">${group.register}</span>` : '';
  const countryHtml = group.countryCode ? `<span class="country-tag">${group.countryCode}</span>` : '';

  card.innerHTML = `
    <div class="group-header">
      <div class="group-headline">${esc(group.headline)}</div>
      <span class="group-count">${group.articleCount}</span>
    </div>
    <div class="group-footer">
      <div class="group-tags">${countryHtml}${domainHtml}${registerHtml}</div>
      <span class="group-expand-indicator">&#9654;</span>
    </div>
  `;

  // Build expandable article list (hidden by default)
  const articlesDiv = document.createElement('div');
  articlesDiv.className = 'group-articles hidden';
  articlesDiv.dataset.groupId = group.groupId;

  for (const s of group.sources) {
    const row = document.createElement('div');
    row.className = 'group-article-row';
    row.innerHTML = `
      <span class="ga-source">${esc(s.sourceName)}</span>
      <span class="ga-title" data-article-id="${esc(s.articleId)}" data-link="${esc(s.link)}">${esc(s.title)}</span>
    `;
    articlesDiv.appendChild(row);
  }

  card.appendChild(articlesDiv);
  return card;
}

// ─── Article card ───

function createArticleCard(article) {
  const card = document.createElement('div');
  card.className = 'article-card';

  const arousalClass = article.arousalScore > 0.6 ? 'arousal-high'
    : article.arousalScore > 0.3 ? 'arousal-mid'
    : 'arousal-low';

  const sentimentClass = article.emotionalScore > 0.1 ? 'sentiment-positive'
    : article.emotionalScore < -0.1 ? 'sentiment-negative'
    : 'sentiment-neutral';

  const sentimentLabel = article.emotionalScore > 0.1 ? '+'
    : article.emotionalScore < -0.1 ? '−'
    : '·';

  const timeAgo = formatTimeAgo(article.publishedAt);

  const domainHtml = article.domain ? `<span class="domain-tag domain-${article.domain}">${article.domain}</span>` : '';
  const registerHtml = article.register ? `<span class="register-tag register-${article.register}">${article.register}</span>` : '';
  const countryHtml = article.countryCode ? `<span class="country-tag">${article.countryCode}</span>` : '';
  const flagsHtml = (article.contentFlags || []).length > 0
    ? `<span class="flag-tag" title="${esc(article.contentFlags.join(', '))}">flagged</span>` : '';

  card.innerHTML = `
    <div class="article-header">
      <span class="article-title" data-article-id="${esc(article.id)}">
        ${esc(article.title)}
      </span>
      <div class="arousal-pip ${arousalClass}" title="arousal: ${(article.arousalScore || 0).toFixed(2)}"></div>
    </div>
    ${article.summary ? `<div class="article-summary">${esc(article.summary)}</div>` : ''}
    <div class="article-meta">
      <span class="source">${esc(article.sourceName || article.sourceId)}</span>
      <span>${article.readTimeMin} min</span>
      <span>${timeAgo}</span>
      <span class="sentiment ${sentimentClass}">${sentimentLabel} ${(article.emotionalScore || 0).toFixed(2)}</span>
    </div>
    <div class="article-classification">
      ${flagsHtml}
      ${countryHtml}${domainHtml}${registerHtml}
    </div>
  `;

  return card;
}

// ─── Helpers ───

function formatTimeAgo(epochMs) {
  if (!epochMs) return '';
  const seconds = Math.floor((Date.now() - epochMs) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ─── Filtering ───

function collectValues(field) {
  const vals = new Set();
  for (const item of allItems) {
    const d = item.data;
    const v = field === 'country' ? d.countryCode : d[field];
    if (v) vals.add(v);
    // Also collect from group sources' representative
    if (item.type === 'group' && d.representative) {
      const rv = field === 'country' ? d.representative.countryCode : d.representative[field];
      if (rv) vals.add(rv);
    }
  }
  return [...vals].sort();
}

const filterSelects = () => [elements.filterCountry, elements.filterDomain, elements.filterRegister];

function updateSelectHighlight(select) {
  if (!select) return;
  const isHovering = select.dataset.hover === 'true';
  const shouldHighlight = excludePreviewActive && isHovering;
  select.classList.toggle('exclude-hover', shouldHighlight);
}

function updateAllSelectHighlights() {
  for (const select of filterSelects()) {
    updateSelectHighlight(select);
  }
}

function cacheOptionLabels(select) {
  Array.from(select.options).forEach(option => {
    if (!option.dataset.label) {
      option.dataset.label = option.textContent;
    }
  });
}

function updateDropdownOptionLabels() {
  for (const select of filterSelects()) {
    Array.from(select.options).forEach(option => {
      const base = option.dataset.label || option.textContent;
      if (!option.value) {
        option.textContent = base;
      } else {
        option.textContent = excludePreviewActive ? `not ${base}` : base;
      }
    });
  }
}

function buildFilterDropdowns() {
  const activeIncludeValues = (type) => activeFilters.filter(f => f.type === type && f.mode === 'include').map(f => f.value);

  const countries = collectValues('country').filter(v => !activeIncludeValues('country').includes(v));
  const domains = collectValues('domain').filter(v => !activeIncludeValues('domain').includes(v));
  const registers = collectValues('register').filter(v => !activeIncludeValues('register').includes(v));

  elements.filterCountry.innerHTML = '<option value="">country</option>' +
    countries.map(c => `<option value="${esc(c)}" data-label="${esc(c)}">${esc(c)}</option>`).join('');
  elements.filterDomain.innerHTML = '<option value="">domain</option>' +
    domains.map(d => `<option value="${esc(d)}" data-label="${esc(d)}">${esc(d)}</option>`).join('');
  elements.filterRegister.innerHTML = '<option value="">register</option>' +
    registers.map(r => `<option value="${esc(r)}" data-label="${esc(r)}">${esc(r)}</option>`).join('');

  for (const select of filterSelects()) {
    cacheOptionLabels(select);
  }
  updateDropdownOptionLabels();
  updateAllSelectHighlights();
}

function addFilter(type, value, mode = 'include') {
  if (!value || activeFilters.some(f => f.type === type && f.value === value && f.mode === mode)) return;
  const label = mode === 'exclude' ? `not ${value}` : value;
  activeFilters.push({ type, value, mode, label });
  renderFilterChips();
  buildFilterDropdowns();
  applyFilters();
}

function removeFilter(type, value, mode) {
  activeFilters = activeFilters.filter(f => !(f.type === type && f.value === value && (!mode || f.mode === mode)));
  renderFilterChips();
  buildFilterDropdowns();
  applyFilters();
}

function renderFilterChips() {
  elements.activeFilters.innerHTML = '';
  for (const f of activeFilters) {
    const chip = document.createElement('span');
    chip.className = `filter-chip chip-${f.type} chip-${f.mode}${f.auto ? ' chip-auto' : ''}`;
    chip.innerHTML = `${esc(f.label || f.value)} <span class="remove-filter" data-type="${f.type}" data-value="${esc(f.value)}" data-mode="${f.mode}">&times;</span>`;
    elements.activeFilters.appendChild(chip);
  }
}

function applyFilters() {
  const items = elements.container.querySelectorAll('.story-group, .article-card');
  const includeByType = { country: [], domain: [], register: [] };
  const excludeByType = { country: [], domain: [], register: [], flagged: [] };
  for (const f of activeFilters) {
    if (f.mode === 'exclude') {
      excludeByType[f.type]?.push(f.value);
    } else {
      includeByType[f.type]?.push(f.value);
    }
  }

  const hasFilters = activeFilters.length > 0 || searchQuery.length > 0;
  let visibleCount = 0;

  for (const el of items) {
    let visible = true;

    if (includeByType.country.length > 0 && !includeByType.country.includes(el.dataset.country)) visible = false;
    if (includeByType.domain.length > 0 && !includeByType.domain.includes(el.dataset.domain)) visible = false;
    if (includeByType.register.length > 0 && !includeByType.register.includes(el.dataset.register)) visible = false;

    if (excludeByType.country.length > 0 && excludeByType.country.includes(el.dataset.country)) visible = false;
    if (excludeByType.domain.length > 0 && excludeByType.domain.includes(el.dataset.domain)) visible = false;
    if (excludeByType.register.length > 0 && excludeByType.register.includes(el.dataset.register)) visible = false;
    if (excludeByType.flagged.length > 0 && el.dataset.flagged === 'flagged') visible = false;

    if (visible && searchQuery.length > 0) {
      visible = el.dataset.searchText.includes(searchQuery);
    }

    el.style.display = visible ? '' : 'none';
    if (visible) visibleCount++;
  }

  const totalItems = (currentBrief?.groups?.length || 0) + (currentBrief?.articles?.length || 0);
  elements.metaCount.textContent = hasFilters
    ? `${visibleCount} / ${totalItems} stories`
    : `${totalItems} stories`;
}

function handleFilterSelection(type, el, mode) {
  if (!el.value) return;
  addFilter(type, el.value, mode);
  el.value = '';
}

for (const [type, el] of [['country', elements.filterCountry], ['domain', elements.filterDomain], ['register', elements.filterRegister]]) {
  el.addEventListener('pointerenter', () => {
    el.dataset.hover = 'true';
    updateSelectHighlight(el);
  });
  el.addEventListener('pointerleave', () => {
    delete el.dataset.hover;
    updateSelectHighlight(el);
  });
  el.addEventListener('change', () => {
    const mode = excludePreviewActive ? 'exclude' : 'include';
    handleFilterSelection(type, el, mode);
  });
}

let searchTimeout;
elements.pageSearch.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = elements.pageSearch.value.trim().toLowerCase();
    applyFilters();
  }, 150);
});

elements.activeFilters.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-filter');
  if (!btn) return;
  removeFilter(btn.dataset.type, btn.dataset.value, btn.dataset.mode);
});

function setExcludePreview(active) {
  if (excludePreviewActive === active) return;
  excludePreviewActive = active;
  updateDropdownOptionLabels();
  updateAllSelectHighlights();
}

function syncExcludePreviewFromEvent(e) {
  setExcludePreview(Boolean(e?.ctrlKey || e?.metaKey));
}

document.addEventListener('keydown', syncExcludePreviewFromEvent);
document.addEventListener('keyup', syncExcludePreviewFromEvent);
document.addEventListener('pointerdown', syncExcludePreviewFromEvent);

window.addEventListener('blur', () => setExcludePreview(false));
window.addEventListener('focus', () => setExcludePreview(false));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') {
    setExcludePreview(false);
  }
});

// ─── Drag-to-Group ───

elements.container.addEventListener('dragstart', (e) => {
  if (!dragModeActive) return;
  const card = e.target.closest('.article-card');
  if (!card) return;

  dragArticleId = card.dataset.articleId;
  card.classList.add('dragging');

  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragArticleId);

  // Show sidebar after a brief moment
  requestAnimationFrame(() => {
    openSidebar();
    show(elements.dragOverlay);
  });
});

elements.container.addEventListener('dragend', (e) => {
  const card = e.target.closest('.article-card');
  if (card) card.classList.remove('dragging');
  dragArticleId = null;
  hide(elements.dragOverlay);
});

function openSidebar() {
  populateSidebar();
  elements.sidebar.classList.remove('hidden');
}

function closeSidebar() {
  elements.sidebar.classList.add('hidden');
  hide(elements.dragOverlay);
}

elements.sidebarClose.addEventListener('click', closeSidebar);

function populateSidebar() {
  elements.sidebarGroups.innerHTML = '';

  // Show existing auto-groups as drop targets
  const groups = currentBrief?.groups || [];
  for (const g of groups) {
    const slot = document.createElement('div');
    slot.className = 'sidebar-group-slot';
    slot.dataset.groupId = g.groupId;
    slot.innerHTML = `
      <div class="slot-headline">${esc(g.headline)}</div>
      <div class="slot-count">${g.articleCount} sources · ${esc(g.domain || '')} · ${esc(g.countryCode || '')}</div>
    `;
    setupDropTarget(slot, g.groupId);
    elements.sidebarGroups.appendChild(slot);
  }

  // Show manual groups as drop targets
  for (const mg of manualGroups) {
    const slot = document.createElement('div');
    slot.className = 'sidebar-group-slot';
    slot.dataset.groupId = mg.id;
    slot.innerHTML = `
      <div class="slot-headline">${esc(mg.headline)}</div>
      <div class="slot-count">${mg.articles.length} articles (manual)</div>
    `;
    setupDropTarget(slot, mg.id);
    elements.sidebarGroups.appendChild(slot);
  }
}

function setupDropTarget(slot, groupId) {
  slot.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    slot.classList.add('drag-over');
  });

  slot.addEventListener('dragleave', () => {
    slot.classList.remove('drag-over');
  });

  slot.addEventListener('drop', (e) => {
    e.preventDefault();
    slot.classList.remove('drag-over');
    const articleId = e.dataTransfer.getData('text/plain');
    if (articleId) {
      handleManualGroup(articleId, groupId);
    }
    closeSidebar();
  });
}

elements.sidebarNewGroup.addEventListener('click', () => {
  if (!dragArticleId) return;
  const article = findArticleById(dragArticleId);
  if (!article) return;

  const newGroup = {
    id: 'manual_' + Date.now(),
    headline: article.title,
    articles: [article],
    learnedTerms: [],
    learnedEntities: [],
    createdAt: Date.now(),
  };

  manualGroups.push(newGroup);
  removeArticleFromView(dragArticleId);
  renderManualGroupCard(newGroup);
  closeSidebar();
  captureReinforcementSignal(newGroup);
});

// ─── Manual grouping logic ───

function findArticleById(id) {
  const articles = currentBrief?.articles || [];
  return articles.find(a => a.id === id);
}

function handleManualGroup(articleId, targetGroupId) {
  const article = findArticleById(articleId);
  if (!article) return;

  // Check if target is a manual group
  const manualGroup = manualGroups.find(g => g.id === targetGroupId);
  if (manualGroup) {
    manualGroup.articles.push(article);
    removeArticleFromView(articleId);
    refreshManualGroupCard(manualGroup);
    captureReinforcementSignal(manualGroup);
    return;
  }

  // Target is an auto-group — create a manual group containing the article
  // and noting its association with the auto-group
  const autoGroup = (currentBrief?.groups || []).find(g => g.groupId === targetGroupId);
  if (autoGroup) {
    const newGroup = {
      id: 'manual_' + Date.now(),
      headline: autoGroup.headline,
      articles: [article],
      associatedAutoGroup: targetGroupId,
      learnedTerms: [],
      learnedEntities: [],
      createdAt: Date.now(),
    };
    manualGroups.push(newGroup);
    removeArticleFromView(articleId);
    // Merge visual: append to existing auto-group card
    updateAutoGroupWithManual(autoGroup, article);
    captureReinforcementSignal(newGroup);
  }
}

function removeArticleFromView(articleId) {
  const card = elements.container.querySelector(`.article-card[data-article-id="${articleId}"]`);
  if (card) card.remove();

  // Remove from brief.articles
  if (currentBrief) {
    currentBrief.articles = currentBrief.articles.filter(a => a.id !== articleId);
  }
}

function updateAutoGroupWithManual(autoGroup, article) {
  const groupEl = elements.container.querySelector(`.story-group[data-group-id="${autoGroup.groupId}"]`);
  if (!groupEl) return;

  // Add the manually grouped article's source to the group sources display
  autoGroup.sources.push({
    sourceId: article.sourceId,
    sourceName: article.sourceName,
    articleId: article.id,
    title: article.title,
    link: article.link,
  });
  autoGroup.articleCount++;

  // Update the sources area and count
  const sourcesEl = groupEl.querySelector('.group-sources');
  if (sourcesEl) {
    const btn = document.createElement('a');
    btn.className = 'group-source-btn';
    btn.href = article.link;
    btn.target = '_blank';
    btn.rel = 'noopener';
    btn.title = article.title;
    btn.textContent = article.sourceName;
    btn.style.borderColor = 'var(--accent)';
    sourcesEl.appendChild(btn);
  }

  const countEl = groupEl.querySelector('.group-count');
  if (countEl) countEl.textContent = `${autoGroup.articleCount} sources`;
}

function renderManualGroupCard(group) {
  const card = document.createElement('div');
  card.className = 'story-group';
  card.dataset.groupId = group.id;
  card.style.borderLeftColor = '#d29922';

  const sourceBtns = group.articles
    .map(a => `<a class="group-source-btn" href="${esc(a.link)}" target="_blank" rel="noopener" title="${esc(a.title)}">${esc(a.sourceName || a.sourceId)}</a>`)
    .join('');

  const first = group.articles[0];
  const domainHtml = first.domain ? `<span class="domain-tag domain-${first.domain}">${first.domain}</span>` : '';
  const registerHtml = first.register ? `<span class="register-tag register-${first.register}">${first.register}</span>` : '';
  const countryHtml = first.countryCode ? `<span class="country-tag">${first.countryCode}</span>` : '';

  card.innerHTML = `
    <div class="group-header">
      <div class="group-headline">${esc(group.headline)}</div>
      <span class="group-count">${group.articles.length} sources</span>
    </div>
    <div class="group-sources">${sourceBtns}</div>
    <div class="group-classification">
      ${countryHtml}${domainHtml}${registerHtml}
    </div>
  `;

  setFilterData(card, first.domain, first.register, first.countryCode, group.headline);

  // Insert after the last .story-group, before standalone articles
  const lastGroup = elements.container.querySelector('.story-group:last-of-type');
  if (lastGroup && lastGroup.nextSibling) {
    elements.container.insertBefore(card, lastGroup.nextSibling);
  } else {
    elements.container.prepend(card);
  }
}

function refreshManualGroupCard(group) {
  const existing = elements.container.querySelector(`.story-group[data-group-id="${group.id}"]`);
  if (existing) existing.remove();
  renderManualGroupCard(group);
}

// ─── Reinforcement Learning Capture ───

function captureReinforcementSignal(manualGroup) {
  const articles = manualGroup.articles;
  if (articles.length < 2) return;

  // Extract shared terms: tokens appearing in 2+ articles
  const tokenCounts = {};
  for (const a of articles) {
    const tokens = (a.title + ' ' + (a.summary || '')).toLowerCase()
      .split(/[^a-z'-]+/).filter(t => t.length > 2);
    const seen = new Set();
    for (const t of tokens) {
      if (!seen.has(t)) { tokenCounts[t] = (tokenCounts[t] || 0) + 1; seen.add(t); }
    }
  }
  manualGroup.learnedTerms = Object.entries(tokenCounts)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term, count]) => ({ term, count }));

  // Extract named entities (capitalised multi-word sequences)
  const entityCounts = {};
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  for (const a of articles) {
    const text = `${a.title || ''} ${a.summary || ''}`;
    const seen = new Set();
    let match;
    while ((match = namePattern.exec(text)) !== null) {
      const entity = match[1];
      if (!seen.has(entity)) { entityCounts[entity] = (entityCounts[entity] || 0) + 1; seen.add(entity); }
    }
  }
  manualGroup.learnedEntities = Object.entries(entityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([entity, count]) => ({ entity, count }));

  console.log('[reinforcement] Manual group signal captured:', {
    headline: manualGroup.headline,
    articleCount: manualGroup.articles.length,
    learnedTerms: manualGroup.learnedTerms.map(t => t.term),
    learnedEntities: manualGroup.learnedEntities.map(e => e.entity),
  });
}

// ─── Group expand/collapse (whole card click) ───

elements.container.addEventListener('click', (e) => {
  // Click article title in a group row → open reader (must check before group card)
  const gaTitle = e.target.closest('.ga-title');
  if (gaTitle) {
    e.preventDefault();
    e.stopPropagation();
    const articleId = gaTitle.dataset.articleId;
    const article = findArticleInBrief(articleId);
    if (article) openReader(article);
    return;
  }

  // Click article title in standalone card → open reader
  const artTitle = e.target.closest('.article-title[data-article-id]');
  if (artTitle) {
    e.preventDefault();
    const articleId = artTitle.dataset.articleId;
    const article = findArticleInBrief(articleId);
    if (article) openReader(article);
    return;
  }

  // Expand/collapse: click anywhere on the group card
  const groupCard = e.target.closest('.story-group');
  if (groupCard) {
    const articlesDiv = groupCard.querySelector('.group-articles');
    if (articlesDiv) {
      const isOpen = !articlesDiv.classList.contains('hidden');
      articlesDiv.classList.toggle('hidden');
      groupCard.classList.toggle('open', !isOpen);
    }
    return;
  }
});

// ─── Reader modal ───

function findArticleInBrief(articleId) {
  // Search standalone articles
  const standalone = (currentBrief?.articles || []).find(a => a.id === articleId);
  if (standalone) return standalone;

  // Search within group sources (each source now carries full article data)
  for (const g of (currentBrief?.groups || [])) {
    if (g.representative && g.representative.id === articleId) return g.representative;
    const source = g.sources.find(s => s.articleId === articleId);
    if (source) {
      return {
        id: source.articleId,
        title: source.title,
        link: source.link,
        sourceName: source.sourceName,
        content: source.content || source.summary || g.representative.content,
        summary: source.summary || g.representative.summary,
        domain: g.domain,
        register: g.register,
        countryCode: g.countryCode,
        readTimeMin: source.readTimeMin || g.readTimeMin,
        publishedAt: source.publishedAt || g.publishedRange?.latest,
        emotionalScore: source.emotionalScore ?? g.emotionalScore,
        arousalScore: source.arousalScore ?? g.arousalScore,
      };
    }
  }

  return null;
}

function openReader(article) {
  elements.readerTitle.textContent = article.title;
  elements.readerSource.textContent = article.sourceName || article.sourceId || '';
  elements.readerTime.textContent = formatTimeAgo(article.publishedAt);
  elements.readerReadTime.textContent = article.readTimeMin ? `${article.readTimeMin} min read` : '';
  elements.readerLink.href = article.link || '#';

  // Tags
  let tagsHtml = '';
  if (article.countryCode) tagsHtml += `<span class="country-tag">${esc(article.countryCode)}</span>`;
  if (article.domain) tagsHtml += `<span class="domain-tag domain-${article.domain}">${esc(article.domain)}</span>`;
  if (article.register) tagsHtml += `<span class="register-tag register-${article.register}">${esc(article.register)}</span>`;
  elements.readerTags.innerHTML = tagsHtml;

  // Body content — use content if available, fallback to summary
  const bodyText = article.content || article.summary || 'No content available.';
  // Convert plain text to paragraphs
  const paragraphs = bodyText.split(/\n\n+|\r\n\r\n+/).filter(p => p.trim());
  if (paragraphs.length > 1) {
    elements.readerBody.innerHTML = paragraphs.map(p => `<p>${esc(p.trim())}</p>`).join('');
  } else {
    elements.readerBody.innerHTML = `<p>${esc(bodyText)}</p>`;
  }

  show(elements.readerModal);
  document.body.style.overflow = 'hidden';
}

function closeReader() {
  hide(elements.readerModal);
  document.body.style.overflow = '';
}

elements.readerClose.addEventListener('click', closeReader);
elements.readerBackdrop.addEventListener('click', closeReader);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !elements.readerModal.classList.contains('hidden')) {
    closeReader();
  }
});

// ─── Drag mode toggle ───

elements.dragToggleBtn.addEventListener('click', () => {
  dragModeActive = !dragModeActive;
  elements.dragToggleBtn.classList.toggle('active', dragModeActive);
  elements.container.classList.toggle('drag-mode', dragModeActive);

  // Enable/disable draggable on all standalone article cards
  const cards = elements.container.querySelectorAll('.article-card');
  for (const card of cards) {
    card.draggable = dragModeActive;
  }
});

// ─── Init ───

elements.refreshBtn.addEventListener('click', () => fetchBrief(true));

fetchBrief();
