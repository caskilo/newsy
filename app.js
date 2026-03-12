/**
 * Newsy Client — fetches brief from server and renders it.
 *
 * Renders story groups (multi-source) and standalone articles.
 * Supports drag-to-group manual curation with reinforcement learning.
 */

const API_BASE = window.NEWSY_API_BASE || window.location.origin;
const idb = window.newsyIdb;

const $ = (sel) => document.querySelector(sel);
const show = (el) => el.classList.remove('hidden');
const hide = (el) => el.classList.add('hidden');

// --- State ---
let currentBrief = null;
let allItems = [];       // unified: groups + standalone articles, each with .itemType
const defaultFlagFilter = { type: 'register', value: 'flagged', label: 'not flagged', mode: 'exclude', auto: true };
let activeFilters = [defaultFlagFilter];  // filters with include/exclude mode
let searchQuery = '';
let ageFilterMs = 86400000; // default: 1 day
let manualGroups = [];   // client-side manual groups
let dragArticleId = null;
let dragModeActive = false;
let excludePreviewActive = false;
let excludeToggleLocked = false; // true when toggled via button (not keyboard)
let filterSummaryExpanded = false;
let lastScrollY = window.scrollY;
let intensityThreshold = -Infinity;

const elements = {
  loading: $('#loading'),
  error: $('#error'),
  empty: $('#empty'),
  container: $('#articles-container'),
  meta: $('#brief-meta'),
  metaCount: $('#meta-count'),
  metaHistogram: $('#meta-histogram'),
  footer: $('#footer'),
  refreshBtn: $('#refresh-btn'),
  briefAge: $('#brief-age'),
  filterBar: $('#filter-bar'),
  activeFilters: $('#active-filters'),
  activeFiltersWrap: $('#active-filters-wrap'),
  filterAge: $('#filter-age'),
  filterCountry: $('#filter-country'),
  filterDomain: $('#filter-domain'),
  filterRegister: $('#filter-register'),
  pageSearch: $('#page-search'),
  excludeToggleBtn: $('#exclude-toggle'),
  filtersSummaryToggle: $('#filters-summary-toggle'),
  sidebar: $('#group-sidebar'),
  sidebarGroups: $('#sidebar-groups'),
  sidebarClose: $('#sidebar-close'),
  sidebarNewGroup: $('#sidebar-new-group'),
  dragOverlay: $('#drag-overlay'),
  dragToggleBtn: $('#drag-toggle'), // may be null if button is hidden
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

// ─── Brief age ticker ───

const AUTO_REFRESH_MS = 60 * 60 * 1000; // 1 hour
let _ageInterval = null;
let _cachedAt = null;

function formatAge(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m ago` : `${h}h ago`;
}

function startAgeTicker(cachedAt) {
  _cachedAt = cachedAt;
  if (_ageInterval) clearInterval(_ageInterval);
  if (!elements.briefAge) return;

  const tick = () => {
    const age = Date.now() - _cachedAt;
    elements.briefAge.textContent = formatAge(age);
    elements.briefAge.classList.toggle('brief-age--stale', age >= AUTO_REFRESH_MS);
    if (age >= AUTO_REFRESH_MS) {
      clearInterval(_ageInterval);
      _ageInterval = null;
      fetchBrief(true);
    }
  };

  show(elements.briefAge);
  tick();
  _ageInterval = setInterval(tick, 30000);
}

function updateFilterBarPeek() {
  if (!elements.filterBar || elements.filterBar.classList.contains('hidden')) return;

  const currentScrollY = window.scrollY;
  const delta = currentScrollY - lastScrollY;

  if (currentScrollY <= 0) {
    elements.filterBar.classList.remove('is-peek-hidden');
    lastScrollY = currentScrollY;
    return;
  }

  if (delta > 6) {
    elements.filterBar.classList.add('is-peek-hidden');
  } else if (delta < -4) {
    elements.filterBar.classList.remove('is-peek-hidden');
  }

  lastScrollY = currentScrollY;
}

// ─── Fetch ───

async function fetchBrief(forceRefresh = false) {
  elements.refreshBtn.classList.add('spinning');

  // Show cached brief immediately on first load
  let cached = null;
  if (idb) {
    try {
      cached = await idb.getCachedBrief();
      if (!currentBrief && cached && cached.brief) {
        currentBrief = cached.brief;
        hide(elements.loading);
        renderBrief(currentBrief);
        startAgeTicker(cached.cachedAt);
      }
    } catch (_) {
      cached = null;
    }
  }

  const cachedAge = cached ? Date.now() - cached.cachedAt : Infinity;
  const shouldFetch = forceRefresh || !cached || cachedAge >= AUTO_REFRESH_MS;

  if (!shouldFetch) {
    elements.refreshBtn.classList.remove('spinning');
    return;
  }

  if (!currentBrief) {
    show(elements.loading);
  }
  hide(elements.error);

  try {
    const params = new URLSearchParams();
    if (forceRefresh) params.set('refresh', 'true');

    const sources = idb ? await idb.getAllSources() : [];

    const res = await fetch(`${API_BASE}/api/brief?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sources }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    currentBrief = await res.json();
    if (idb) await idb.setCachedBrief(currentBrief);

    hide(elements.loading);
    hide(elements.empty);
    hide(elements.footer);
    clearContainer();
    renderBrief(currentBrief);
    startAgeTicker(Date.now());
  } catch (err) {
    hide(elements.loading);
    if (!currentBrief) {
      elements.error.textContent = `Failed to load brief: ${err.message}`;
      elements.error.classList.add('error');
      show(elements.error);
    }
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
  show(elements.meta);

  // Render groups in a grid
  if (groups.length > 0) {
    const grid = document.createElement('div');
    grid.className = 'groups-grid';
    for (const group of groups) {
      const el = createGroupCard(group);
      const flagged = group.sources.some(s => {
        const sourceIntensity = computeIntensity(s.emotionalScore, s.arousalScore);
        const sourceIntensityFlagged = sourceIntensity !== null && sourceIntensity < -1.0;
        return (s.contentFlags || []).length > 0 || sourceIntensityFlagged;
      });
      const groupPub = group.publishedRange?.latest || group.representative?.publishedAt || 0;
      const groupIntensity = computeIntensity(group.representative?.emotionalScore, group.representative?.arousalScore);
      setFilterData(el, group.domain, group.register, group.countryCode, group.headline + ' ' + group.sources.map(s => s.title).join(' '), flagged, groupPub, groupIntensity);
      grid.appendChild(el);
      allItems.push({ type: 'group', data: group, el });
    }
    elements.container.appendChild(grid);
  }

  // Render standalone articles
  for (const article of articles) {
    const el = createArticleCard(article);
    // Auto-flag extreme intensity articles (intensity < -1.0)
    const autoIntensity = computeIntensity(article.emotionalScore, article.arousalScore);
    const intensityFlagged = autoIntensity !== null && autoIntensity < -1.0;
    const flagged = (article.contentFlags || []).length > 0 || intensityFlagged;
    const articleIntensity = computeIntensity(article.emotionalScore, article.arousalScore);
    setFilterData(el, article.domain, article.register, article.countryCode, article.title + ' ' + (article.summary || '') + ' ' + (article.sourceName || ''), flagged, article.publishedAt || 0, articleIntensity);
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

function setFilterData(el, domain, register, country, searchableText, flagged = false, publishedAt = 0, intensity = null) {
  el.dataset.domain = domain || '';
  el.dataset.register = register || '';
  el.dataset.country = country || '';
  el.dataset.searchText = (searchableText || '').toLowerCase();
  el.dataset.flagged = flagged ? 'flagged' : '';
  el.dataset.publishedAt = publishedAt || 0;
  el.dataset.intensity = intensity !== null ? intensity : '';
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
    const chip = intensityChipHtml(s.emotionalScore, s.arousalScore, 'ga-intensity-chip');
    const gaTimeAgo = s.publishedAt ? formatTimeAgo(s.publishedAt) : '';
    row.innerHTML = `
      <div class="ga-source-block">
        <span class="ga-source">${esc(s.sourceName)}</span>
        <div class="ga-source-meta">${chip}${gaTimeAgo ? `<span class="ga-time">${gaTimeAgo}</span>` : ''}</div>
      </div>
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

  const timeAgo = formatTimeAgo(article.publishedAt);
  const chip = intensityChipHtml(article.emotionalScore, article.arousalScore);
  const autoIntensity = computeIntensity(article.emotionalScore, article.arousalScore);
  const flagged = (article.contentFlags || []).length > 0 || (autoIntensity !== null && autoIntensity < -1.0);

  const domainHtml = article.domain ? `<span class="domain-tag domain-${article.domain}">${article.domain}</span>` : '';
  const registerHtml = article.register ? `<span class="register-tag register-${article.register}">${article.register}</span>` : '';
  const countryHtml = article.countryCode ? `<span class="country-tag">${article.countryCode}</span>` : '';
  const flagReasons = [...(article.contentFlags || [])];
  if (autoIntensity !== null && autoIntensity < -1.0) {
    flagReasons.push('intensity below -1.0');
  }
  const flagsHtml = flagged
    ? `<span class="flag-tag" title="${esc(flagReasons.join(', '))}">flagged</span>` : '';

  card.innerHTML = `
    <div class="article-header">
      <span class="article-title" data-article-id="${esc(article.id)}">${esc(article.title)}</span>
      ${chip}
    </div>
    ${article.summary ? `<div class="article-summary">${esc(article.summary)}</div>` : ''}
    <div class="article-meta">
      <span class="source">${esc(article.sourceName || article.sourceId)}</span>
      <span class="meta-time">${timeAgo}</span>
      <span class="article-tags">${flagsHtml}${countryHtml}${domainHtml}${registerHtml}</span>
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

// ─── Composite intensity ───
// intensity = emotionalScore − arousalScore
// Range: roughly [-2, 1]. Values below -1.0 are auto-flagged.

function computeIntensity(emotionalScore, arousalScore) {
  const e = emotionalScore || 0;
  const a = arousalScore || 0;
  if (e === 0 && a === 0) return null; // no scoring data
  return Math.round((e - a) * 100) / 100;
}

function intensityColor(v) {
  if (v === null) return 'var(--text-dim)';
  if (v < -0.5)  return 'var(--negative)';
  if (v < 0)     return '#f0883e';
  if (v < 0.5)   return 'var(--warning)';
  if (v < 0.85)  return 'var(--text-dim)';
  return 'var(--positive)';
}

function intensityChipHtml(emotionalScore, arousalScore, extraClass = '') {
  const v = computeIntensity(emotionalScore, arousalScore);
  if (v === null) return '';
  const color = intensityColor(v);
  const label = `${v > 0 ? '+' : ''}${v.toFixed(2)}`;
  const tip = `intensity: ${label} (sentiment ${(emotionalScore || 0).toFixed(2)}, arousal ${(arousalScore || 0).toFixed(2)})`;
  return `<span class="intensity-chip${extraClass ? ' ' + extraClass : ''}" style="color:${color}" title="${tip}">${label}</span>`;
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
    // Add 'flagged' as a synthetic register option if any items are flagged
    if (field === 'register' && item.el?.dataset.flagged === 'flagged') {
      vals.add('flagged');
    }
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
  saveFilterState();
}

function removeFilter(type, value, mode) {
  activeFilters = activeFilters.filter(f => !(f.type === type && f.value === value && (!mode || f.mode === mode)));
  renderFilterChips();
  buildFilterDropdowns();
  applyFilters();
  saveFilterState();
}

function renderFilterChips() {
  elements.activeFilters.innerHTML = '';
  for (const f of activeFilters) {
    const chip = document.createElement('span');
    chip.className = `filter-chip chip-${f.type} chip-${f.mode}${f.auto ? ' chip-auto' : ''}`;
    chip.innerHTML = `${esc(f.label || f.value)} <span class="remove-filter" data-type="${f.type}" data-value="${esc(f.value)}" data-mode="${f.mode}">&times;</span>`;
    elements.activeFilters.appendChild(chip);
  }
  updateFilterSummaryVisibility();
}

function updateFilterSummaryVisibility() {
  const visibleFilters = activeFilters;
  const hasVisibleFilters = visibleFilters.length > 0;
  if (elements.filtersSummaryToggle) {
    elements.filtersSummaryToggle.classList.toggle('has-filters', hasVisibleFilters);
    elements.filtersSummaryToggle.textContent = hasVisibleFilters ? `filters (${visibleFilters.length})` : 'filters';
    elements.filtersSummaryToggle.setAttribute('aria-expanded', filterSummaryExpanded ? 'true' : 'false');
  }
  if (elements.activeFiltersWrap) {
    elements.activeFiltersWrap.classList.toggle('hidden', !filterSummaryExpanded || !hasVisibleFilters);
  }
}

function renderHistogram() {
  const el = elements.metaHistogram;
  if (!el || !allItems.length) { if (el) el.innerHTML = ''; return; }

  // Collect intensity values from entire corpus
  const values = allItems.map(item => {
    const d = item.data;
    return computeIntensity(d.emotionalScore ?? d.representative?.emotionalScore,
                            d.arousalScore  ?? d.representative?.arousalScore) ?? 0;
  });

  const BINS = 25;
  const MIN = -1.8, MAX = 1;
  const step = (MAX - MIN) / BINS;
  const counts = new Array(BINS).fill(0);
  for (const v of values) {
    const idx = Math.min(BINS - 1, Math.max(0, Math.floor((v - MIN) / step)));
    counts[idx]++;
  }
  const peak = Math.max(...counts, 1);

  // Convert threshold to slider position (0-100)
  const thresholdPct = ((intensityThreshold === -Infinity ? MIN : intensityThreshold) - MIN) / (MAX - MIN) * 100;

  const bars = counts.map((c, i) => {
    const binMin = MIN + i * step;
    const heightPct = Math.round(c / peak * 100);
    const active = binMin >= (intensityThreshold === -Infinity ? MIN : intensityThreshold);
    const color = binMin < -0.5 ? 'var(--negative)' : binMin < 0 ? '#f0883e' : binMin < 0.3 ? 'var(--accent)' : 'var(--positive)';
    const opacity = active ? '1' : '0.2';
    return `<div class="hist-bar" style="height:${heightPct}%;background:${color};opacity:${opacity}" title="${binMin.toFixed(1)}–${(binMin+step).toFixed(1)}: ${c}"></div>`;
  }).join('');

  const thresholdLabel = intensityThreshold === -Infinity ? 'all' : intensityThreshold.toFixed(2);

  el.innerHTML = `
    <div class="hist-wrap" title="Intensity distribution — drag slider to filter">
      <div class="hist-bars">${bars}</div>
      <div class="hist-slider-row">
        <input type="range" class="hist-slider" min="0" max="100" step="1" value="${Math.round(thresholdPct)}"
          aria-label="Intensity threshold">
        <span class="hist-label">&ge; ${thresholdLabel}</span>
      </div>
    </div>
  `;

  const slider = el.querySelector('.hist-slider');

  slider.addEventListener('input', (e) => {
    const pct = parseFloat(e.target.value) / 100;
    const raw = MIN + pct * (MAX - MIN);
    intensityThreshold = pct <= 0.01 ? -Infinity : Math.round(raw * 100) / 100;
    el.querySelector('.hist-label').textContent = `\u2265 ${intensityThreshold === -Infinity ? 'all' : intensityThreshold.toFixed(2)}`;
    // Recolour bars immediately
    const bars = el.querySelectorAll('.hist-bar');
    bars.forEach((b, i) => {
      const binMin = MIN + i * step;
      b.style.opacity = binMin >= (intensityThreshold === -Infinity ? MIN : intensityThreshold) ? '1' : '0.2';
    });
    applyFilters({ skipHistogram: true });
    saveFilterState();
  });

  slider.addEventListener('change', () => {
    applyFilters();
    saveFilterState();
  });
}

function applyFilters(options = {}) {
  const { skipHistogram = false } = options;
  const items = elements.container.querySelectorAll('.story-group, .article-card');
  const includeByType = { country: [], domain: [], register: [] };
  const excludeByType = { country: [], domain: [], register: [] };
  for (const f of activeFilters) {
    if (f.mode === 'exclude') {
      excludeByType[f.type]?.push(f.value);
    } else {
      includeByType[f.type]?.push(f.value);
    }
  }

  const now = Date.now();
  const hasThreshold = intensityThreshold !== -Infinity;
  const hasFilters = activeFilters.length > 0 || searchQuery.length > 0 || ageFilterMs > 0 || hasThreshold;
  let visibleCount = 0;
  const visibleItems = [];

  for (const el of items) {
    let visible = true;

    if (includeByType.country.length > 0 && !includeByType.country.includes(el.dataset.country)) visible = false;
    if (includeByType.domain.length > 0 && !includeByType.domain.includes(el.dataset.domain)) visible = false;
    if (includeByType.register.length > 0) {
      const registerMatch = includeByType.register.includes(el.dataset.register);
      const flaggedMatch = includeByType.register.includes('flagged') && el.dataset.flagged === 'flagged';
      if (!registerMatch && !flaggedMatch) visible = false;
    }

    if (excludeByType.country.length > 0 && excludeByType.country.includes(el.dataset.country)) visible = false;
    if (excludeByType.domain.length > 0 && excludeByType.domain.includes(el.dataset.domain)) visible = false;
    if (excludeByType.register.length > 0) {
      const registerExclude = excludeByType.register.includes(el.dataset.register);
      const flaggedExclude = excludeByType.register.includes('flagged') && el.dataset.flagged === 'flagged';
      if (registerExclude || flaggedExclude) visible = false;
    }

    if (visible && ageFilterMs > 0) {
      const pub = parseInt(el.dataset.publishedAt, 10);
      if (pub && (now - pub) > ageFilterMs) visible = false;
    }

    if (visible && searchQuery.length > 0) {
      visible = el.dataset.searchText.includes(searchQuery);
    }

    if (visible && hasThreshold && el.dataset.intensity !== '') {
      visible = parseFloat(el.dataset.intensity) >= intensityThreshold;
    }

    el.style.display = visible ? '' : 'none';
    if (visible) {
      visibleCount++;
      // Find the matching allItems entry to get intensityScore
      const matched = allItems.find(i => i.el === el);
      if (matched) visibleItems.push(matched);
    }
  }

  const totalItems = (currentBrief?.groups?.length || 0) + (currentBrief?.articles?.length || 0);
  elements.metaCount.textContent = hasFilters
    ? `${visibleCount} / ${totalItems} stories`
    : `${totalItems} stories`;

  if (!skipHistogram) {
    renderHistogram();
  }
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

if (elements.filterAge) {
  elements.filterAge.addEventListener('change', () => {
    ageFilterMs = elements.filterAge.value ? parseInt(elements.filterAge.value, 10) : 0;
    applyFilters();
    saveFilterState();
  });
}

let searchTimeout;
elements.pageSearch.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    searchQuery = elements.pageSearch.value.trim().toLowerCase();
    applyFilters();
    saveFilterState();
  }, 150);
});

elements.activeFilters.addEventListener('click', (e) => {
  const btn = e.target.closest('.remove-filter');
  if (!btn) return;
  removeFilter(btn.dataset.type, btn.dataset.value, btn.dataset.mode);
});

if (elements.filtersSummaryToggle) {
  elements.filtersSummaryToggle.addEventListener('click', () => {
    filterSummaryExpanded = !filterSummaryExpanded;
    updateFilterSummaryVisibility();
  });
}

function setExcludePreview(active) {
  if (excludePreviewActive === active) return;
  excludePreviewActive = active;
  if (elements.excludeToggleBtn) {
    elements.excludeToggleBtn.classList.toggle('active', active);
    elements.excludeToggleBtn.setAttribute('aria-pressed', active ? 'true' : 'false');
    elements.excludeToggleBtn.title = active ? 'Exclude mode ON (click or release Ctrl/⌘ to disable)' : 'Toggle exclude mode (Ctrl/⌘)';
  }
  updateDropdownOptionLabels();
  updateAllSelectHighlights();
}

function syncExcludePreviewFromEvent(e) {
  if (excludeToggleLocked) return;
  setExcludePreview(Boolean(e?.ctrlKey || e?.metaKey));
}

document.addEventListener('keydown', syncExcludePreviewFromEvent);
document.addEventListener('keyup', syncExcludePreviewFromEvent);
document.addEventListener('pointerdown', syncExcludePreviewFromEvent);

window.addEventListener('blur', () => { if (!excludeToggleLocked) setExcludePreview(false); });
window.addEventListener('focus', () => { if (!excludeToggleLocked) setExcludePreview(false); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible' && !excludeToggleLocked) {
    setExcludePreview(false);
  }
});

if (elements.excludeToggleBtn) {
  elements.excludeToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const next = !excludePreviewActive;
    excludeToggleLocked = next; // locked = true means button is holding it on
    setExcludePreview(next);
  });
}

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

// ─── Filter state persistence (idb) ───

async function saveFilterState() {
  if (!idb) return;
  try {
    await idb.open();
    const nonAuto = activeFilters.filter(f => !f.auto);
    await idb.setMeta('filterState', { filters: nonAuto, searchQuery, ageFilterMs, intensityThreshold });
  } catch (e) {
    console.warn('[filters] Could not save filter state', e);
  }
}

async function restoreFilterState() {
  if (!idb) return;
  try {
    await idb.open();
    const saved = await idb.getMeta('filterState');
    if (!saved) return;
    if (Array.isArray(saved.filters) && saved.filters.length > 0) {
      for (const f of saved.filters) {
        if (!activeFilters.some(x => x.type === f.type && x.value === f.value && x.mode === f.mode)) {
          activeFilters.push(f);
        }
      }
    }
    if (saved.searchQuery) {
      searchQuery = saved.searchQuery;
      elements.pageSearch.value = saved.searchQuery;
    }
    if (saved.ageFilterMs !== undefined) {
      ageFilterMs = saved.ageFilterMs;
      if (elements.filterAge) {
        elements.filterAge.value = ageFilterMs > 0 ? String(ageFilterMs) : '';
      }
    }
    if (saved.intensityThreshold !== undefined) {
      intensityThreshold = saved.intensityThreshold;
    }
  } catch (e) {
    console.warn('[filters] Could not restore filter state', e);
  }
}

// ─── Drag mode toggle ───

if (elements.dragToggleBtn) {
  elements.dragToggleBtn.addEventListener('click', () => {
    dragModeActive = !dragModeActive;
    elements.dragToggleBtn.classList.toggle('active', dragModeActive);
    elements.container.classList.toggle('drag-mode', dragModeActive);

    const cards = elements.container.querySelectorAll('.article-card');
    for (const card of cards) {
      card.draggable = dragModeActive;
    }
  });
}

// ─── Init ───

elements.refreshBtn.addEventListener('click', () => fetchBrief(true));
window.addEventListener('scroll', updateFilterBarPeek, { passive: true });

(async () => {
  await restoreFilterState();
  fetchBrief();
})();
