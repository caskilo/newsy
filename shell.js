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
  const navLinks     = document.querySelectorAll('[data-nav]');

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
    // Get the actual panel viewport width (constrained by #app max-width)
    const viewport = document.querySelector('.panel-viewport');
    const viewportWidth = viewport ? viewport.offsetWidth : window.innerWidth;
    track.style.transform = `translateX(-${idx * viewportWidth}px)`;

    // Update header
    taglineEl.textContent = TAGLINES[panel];
    document.title = TITLES[panel];

    // Refresh button and brief-age are now visible on all panels

    // Update nav link highlighting
    navLinks.forEach(link => {
      link.classList.toggle('active', link.dataset.nav === panel);
    });

    currentPanel = panel;

    // Fire custom event for lazy panel init
    window.dispatchEvent(new CustomEvent('panel-activate', { detail: { panel } }));
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
