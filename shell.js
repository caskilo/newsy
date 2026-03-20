/**
 * shell.js — SPA navigation controller.
 *
 * Manages hash routing (#brief, #sources, #catalogue),
 * horizontal slide transitions, header updates,
 * and lazy panel initialisation.
 */

(function () {
  'use strict';

  const PANELS = ['brief', 'sources', 'catalogue'];
  const TAGLINES = {
    brief:     'your daily brief',
    sources:   'source management',
    catalogue: 'feed catalogue',
  };
  const TITLES = {
    brief:     'newsy — daily brief',
    sources:   'newsy — sources',
    catalogue: 'newsy — catalogue',
  };

  let currentPanel = null;
  const initialisedPanels = new Set();

  // ── DOM refs ──
  const track        = document.getElementById('panel-track');
  const taglineEl    = document.getElementById('header-tagline');
  const refreshBtn   = document.getElementById('refresh-btn');
  const briefAgeEl   = document.getElementById('brief-age');
  const navLinks     = document.querySelectorAll('.bottom-nav-item[data-nav]');
  const bottomNav    = document.querySelector('.bottom-nav');

  // ── Bottom nav auto-hide ──
  const NAV_HIDE_DELAY = 3000;
  let navHideTimer = null;

  function showNav() {
    if (!bottomNav) return;
    bottomNav.classList.remove('is-hidden');
    clearTimeout(navHideTimer);
    navHideTimer = setTimeout(hideNav, NAV_HIDE_DELAY);
  }

  function hideNav() {
    if (!bottomNav) return;
    bottomNav.classList.add('is-hidden');
  }

  ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'].forEach(evt => {
    window.addEventListener(evt, showNav, { passive: true });
  });

  // ── Public API ──
  window.newsyShell = {
    navigate,
    currentPanel: () => currentPanel,
    markInitialised(name) { initialisedPanels.add(name); },
    isInitialised(name) { return initialisedPanels.has(name); },
  };

  // ── Navigation ──

  function navigate(panel) {
    if (!PANELS.includes(panel)) panel = 'brief';
    if (panel === currentPanel) return;

    const idx = PANELS.indexOf(panel);
    track.style.transform = `translateX(-${idx * strideX()}px)`;

    // Update header
    taglineEl.textContent = TAGLINES[panel];
    document.title = TITLES[panel];

    // Refresh button and brief-age are now visible on all panels

    // Update nav link highlighting
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.nav === panel);
    });

    currentPanel = panel;
    showNav();
    updatePagerDots(panel);

    // Fire custom event for lazy panel init
    window.dispatchEvent(new CustomEvent('panel-activate', { detail: { panel } }));
  }

  // ── Pager dots ──

  const pagerDotsBtn  = document.getElementById('pager-dots');
  const pagerDotEls   = pagerDotsBtn ? pagerDotsBtn.querySelectorAll('.pager-dot') : [];

  function updatePagerDots(panel) {
    pagerDotEls.forEach(dot => {
      dot.classList.toggle('active', dot.dataset.pager === panel);
    });
  }

  if (pagerDotsBtn) {
    pagerDotsBtn.addEventListener('click', () => {
      showNav();
    });
  }

  // ── Swipe navigation ──

  const SWIPE_THRESHOLD   = 80;   // px of horizontal travel required to commit
  const SWIPE_ANGLE_LIMIT = 0.7;  // |dy|/|dx| must be below this to count as horizontal
  const DRAG_RESIST       = 0.18; // edge resistance factor at edges

  const viewport = document.querySelector('.panel-viewport');
  let touchStartX = 0, touchStartY = 0;
  let dragLive = false;

  function panelIndex() {
    return PANELS.indexOf(currentPanel);
  }

  // Read --panel-gap from CSS so stride stays in sync with CSS without hardcoding.
  function panelGap() {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue('--panel-gap').trim();
    return parseFloat(raw) || 0;
  }

  // Distance the track must travel to show panel at idx.
  // stride = viewportWidth + gap  (gap sits between panels, so each step is vw + gap)
  function strideX() {
    const vw  = viewport ? viewport.offsetWidth : window.innerWidth;
    return vw + panelGap();
  }

  function setTrackX(px, animated) {
    track.style.transition = animated
      ? 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'none';
    track.style.transform = `translateX(${px}px)`;
  }

  function committedX() {
    return -(panelIndex() * strideX());
  }

  if (viewport) {
    viewport.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      dragLive = false;
      track.style.transition = 'none';
    }, { passive: true });

    viewport.addEventListener('touchmove', (e) => {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;

      if (!dragLive) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        if (Math.abs(dy) > Math.abs(dx) * (1 / SWIPE_ANGLE_LIMIT)) return;
        dragLive = true;
      }

      const idx     = panelIndex();
      const base    = -(idx * strideX());
      const atLeft  = idx === 0;
      const atRight = idx === PANELS.length - 1;

      let offset = dx;
      if ((atLeft && dx > 0) || (atRight && dx < 0)) {
        offset = dx * DRAG_RESIST;
      }

      setTrackX(base + offset, false);
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
      if (!dragLive) return;
      dragLive = false;

      const dx  = e.changedTouches[0].clientX - touchStartX;
      const dy  = e.changedTouches[0].clientY - touchStartY;
      const idx = panelIndex();

      const isHorizontal = Math.abs(dy) <= Math.abs(dx) * (1 / SWIPE_ANGLE_LIMIT);
      const committed    = Math.abs(dx) >= SWIPE_THRESHOLD && isHorizontal;

      let nextIdx = idx;
      if (committed) {
        if (dx < 0 && idx < PANELS.length - 1) nextIdx = idx + 1;
        if (dx > 0 && idx > 0)                 nextIdx = idx - 1;
      }

      if (nextIdx !== idx) {
        window.location.hash = PANELS[nextIdx];
      } else {
        setTrackX(committedX(), true);
      }
    }, { passive: true });

    viewport.addEventListener('touchcancel', () => {
      if (!dragLive) return;
      dragLive = false;
      setTrackX(committedX(), true);
    }, { passive: true });
  }

  // ── Hash routing ──

  function onHashChange() {
    const hash = window.location.hash.replace('#', '') || 'brief';
    navigate(hash);
  }

  window.addEventListener('hashchange', onHashChange);

  // Intercept nav link clicks
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const panel = link.dataset.nav;
      window.location.hash = panel;
    });
  });

  // ── Boot ──
  onHashChange();
})();
