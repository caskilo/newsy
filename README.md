# newsy — a cosy cognitive prosthetic for news

Newsy is a deterministic, client-forward RSS aggregation and curation tool. The Node server fetches, normalizes, scores, and groups articles; the browser client renders a grid of colour-coded story groups, standalone articles, a drag-to-group workbench, and an in-app reader modal so you never need to leave the "newsy" world.

## Pipeline overview (server/src)
| Stage | Purpose | Key files |
|-------|---------|-----------|
| Fetcher → Parser | Pull RSS feeds, turn them into structured articles | `server/pipeline.js`, `src/parse/` |
| Filter → Normalizer | Drop duplicates, clean metadata, tokenize | `src/filter/`, `src/normalize/` |
| Classifier | Dual-axis taxonomy (domain + register) + country detection | `src/classify/*.js` |
| Deduplicator | Jaccard token overlap | `src/pipeline/deduplicator.js` |
| Scorer + Budget | Rank by attention budget, emotional load | `src/scoring/`, `src/pipeline/budget-selector.js` |
| Grouper | Token overlap + boosting to build story groups | `src/pipeline/grouper.js` |
| Formatter → Transport | Shape payload for the SPA | `server/pipeline.js`, Express routes |

Each article carries title, summary, full content, emotional/arousal scores, taxonomy labels, and provenance metadata. Groups include a representative article plus per-source metadata so the reader modal can open any headline inside a group.

## Client highlights (client/)
- **Sticky filter/search bar** with country, domain, register dropdowns and free-text search
- **Register-coloured group cards** laid out as a 2-column grid, expandable inline
- **Draggable standalone articles** (drag mode toggle in the filter bar) feeding a manual grouping sidebar for reinforcement learning
- **In-app reader modal** with cosy typography, showing full article text, tags, and an optional external link
- **Active filter chips & search highlighting** shared across groups + standalone cards

## Getting started
```bash
# 1. Install dependencies
npm install

# 2. Run the pipeline + dev server
npm run dev   # or: node server/index.js

# 3. Open the client
open http://localhost:3000   # or use the proxy printed by the server
```

### Environment
- Node.js LTS (18+)
- RSS access requires outbound network connectivity
- Browser: Chromium or Firefox recommended (uses modern CSS grid + `backdrop-filter`)

## Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Starts the Node pipeline in watch mode (server auto-restarts) |
| `npm run server` | Runs just the backend pipeline once |
| `npm run build` | Bundles the browser assets via esbuild |
| `npm test` | Placeholder for future vitest suite |

## Folder map
```
client/           # SPA (vanilla JS + CSS)
  index.html      # layout inkl. reader modal markup
  app.js          # rendering, filters, drag-to-group, reader modal
  style.css       # typography, grid, modal, sidebar, drag affordances
server/
  index.js        # express entrypoint
  pipeline.js     # orchestrates pipeline + response payload
src/
  classify/       # taxonomy lexicons, country detector
  pipeline/       # dedupe, grouping, scoring helpers
  core/, scoring/, etc.
```

## Troubleshooting / known sharp edges
- Manual drag mode is disabled by default; toggle via "⠿ drag" button if the sidebar needs to appear.
- The grouper currently uses token overlap; future work includes semantic embeddings and reinforcement from manual groupings.
- When adding new feeds, ensure they expose full content or readable summaries—reader modal prefers `article.content` but falls back gracefully.

## Roadmap & bug triage
1. Polish bug queue (scroll preservation in manual sidebar, edge-case country detection)
2. Expand reinforcement learning capture + share signals back to the pipeline
3. Add persistence (IndexedDB) so seen articles + manual groups survive reloads
4. Optional: multi-user sync via lightweight Supabase/SQLite backend

Pull requests, design sketches, and RSS tips welcome. Grab a warm beverage, open the cosy brief, and stay inside the newsy greenhouse. 📰🌿
