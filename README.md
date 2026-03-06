# newsy — a cosy cognitive prosthetic for news

Newsy is a personal, privacy-first RSS reader. It curates your daily brief from RSS sources you choose, renders it as a compact grid of story groups and articles, and lets you read everything without leaving the page — no accounts, no tracking, no data collected anywhere.

The client is a vanilla JS + CSS single-page app deployed as a static site. It is the complete user-facing product. A companion API service handles feed fetching and curation; sources are supplied by the client on each request, so the server holds no state about you.

---

## Personalisation without a login

Most personalised apps require an account so the server can remember your preferences. Newsy inverts this: **the browser is the database**.

- Your RSS source list lives in [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — a private, persistent, per-origin store built into every modern browser.
- On each brief request, the client sends its own source list to the curation API. The server is stateless and stores nothing.
- The most recent brief is also cached in IndexedDB, so the page loads instantly even before the network responds.
- Nothing is collected, stored, or transmitted to any party other than the RSS feeds you add and the curation API you configure.

This means your configuration is yours alone: it survives page reloads and browser restarts, is not shared across devices, and disappears cleanly if you clear your browser data. You can save and restore it at any time as a plain JSON file.

---

## Features

### Daily brief
- **Story groups** — related articles from multiple sources are automatically clustered into expandable group cards, each with a colour-coded register border (alert, analysis, curiosity, etc.)
- **Standalone articles** — ungrouped items appear below, styled consistently
- **In-app reader** — click any headline to open a full reader modal with typography, tags, estimated read time, and a link to the original
- **Filter bar** — narrow the brief by country, domain, or register; combine filters; use Ctrl/⌘ to add exclusion filters; free-text search across all visible content
- **Brief age indicator** — a timestamp next to the refresh button shows when the brief was last fetched; auto-refreshes after one hour

### Source management (`sources.html`)
- **Source cards** — toggle, test, or delete individual sources; each card shows category, country, and last test verdict
- **Add source** — provide a name and RSS URL; the feed is tested before saving
- **Config bar** — name your source configuration; download it as JSON; reload from a saved file
- **Set default** — load a curated starter set with a diff preview showing what will change; choose to replace or preserve your current sources
- **Filter toolbar** — narrow sources by category, status, or test verdict

---

## Privacy

| What | Where | Who sees it |
|------|-------|-------------|
| Your source list | Your browser (IndexedDB) | You only |
| Your brief cache | Your browser (IndexedDB) | You only |
| Fetched feeds | API server (in-flight only, not stored) | You + feed publisher |
| Config exports | Your device (JSON file you download) | You only |

No cookies. No analytics. No login. No server-side source storage.

---

## Getting started (local)

```bash
# Serve the client files (any static server will do)
npx serve -l 5000
# or: python -m http.server 5000
```

Then open `http://localhost:5000`. On first load the source list will be empty — use **⟳ set default** in the config bar to load a starter set, or add your own feeds.

`api-config.js` reads `localhost` and points the API at `http://localhost:3000`. In production (GitHub Pages) the API URL is injected at deploy time via a GitHub Actions environment variable — no URL is hardcoded in the source.

---

## Client files

| File | Purpose |
|------|---------|
| `index.html` | Main brief page |
| `sources.html` | Source management page |
| `app.js` | Brief rendering, filtering, reader modal, brief cache |
| `sources.js` | Source management UI logic |
| `idb.js` | IndexedDB layer (sources, meta, brief cache) |
| `sources.default.js` | Curated default source list |
| `api-config.js` | Resolves API base URL from meta tag at runtime |
| `style.css` | Global typography and layout |
| `sources.css` | Source page styles |

---

## Browser support

Modern evergreen browsers (Chrome, Firefox, Edge, Safari 16+). Requires IndexedDB and CSS grid. No build step — the client ships as plain HTML, CSS, and JavaScript.

---

## Licence

Copyright © 2026 the newsy contributors

This client is released under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). You are free to use, study, modify, and redistribute it, provided that:

- Any modified version you distribute or run as a network service is also released under the AGPL-3.0.
- Credit to the original project is retained.

See `LICENSE` for the full terms.
