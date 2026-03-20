# $newsy$ - a cosy cognitive prosthetic for news

Newsy is a deterministic, client-resident news aggregation engine that transforms
high-volume RSS feeds into bounded, psychologically-aware daily briefings.

Newsy curates your daily brief from RSS sources you choose, renders it as a compact grid of story groups and articles. It also surfaces thematic and semantic groupings and tags to reduce topic-switching and cognitive load. Filters (inclusive or exclusive) can be added, as can a cutoff based on scored "intensity", which comes from a combination of semantic and tonal analysis.

#### [View on Github Pages](https://caskilo.github.io/newsy/)
---

## Personalisation without a login

Most personalised apps require an account so the server can remember your preferences. Newsy inverts this: **the browser is the database**.

- Your RSS source list lives in [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — a private, persistent, per-origin store built into every modern browser.
- Your brief filter state also lives there, including search, active filters, age window, and the intensity threshold slider position.
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
- **Intensity histogram** — a compact distribution view in the brief meta bar shows the whole corpus across the intensity range, with a draggable lower-bound slider for filtering out low-intensity items
- **Brief age indicator** — a timestamp next to the refresh button shows when the brief was last fetched; auto-refreshes after one hour

### Source management (`#sources`)
- **Source cards** — toggle, test, or delete individual sources; each card shows category, country, and last test verdict
- **Add source** — provide a name and RSS URL; the feed is tested before saving
- **Config bar** — name your source configuration; download it as JSON; reload from a saved file
- **Filter toolbar** — narrow sources by category, status, or test verdict

### Catalogue (`#catalogue`)
- **Default catalogue loader** — load the built-in `catalogue.json` straight into the browser store
- **Browse and curate** — search, filter, sort, multi-select, and add feeds from the catalogue into your sources list
- **Independent removal** — removing a source from the curated list does not delete it from the catalogue, so it can be re-added later

### Coming Soon
- **New styles** — a style-picker to adapt newsy's look to your liking
- **Feedback page** — a space for people to share opinions, ideas, requests about newsy

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

## Browser support

Modern evergreen browsers (Chrome, Firefox, Edge, Safari 16+). Requires IndexedDB and CSS grid. No build step — the client ships as plain HTML, CSS, and JavaScript.

---

## Licence

Copyright © 2026 the newsy contributors

This client is released under the [GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). You are free to use, study, modify, and redistribute it, provided that:

- Any modified version you distribute or run as a network service is also released under the AGPL-3.0.
- Credit to the original project is retained.

See `LICENSE` for the full terms.
