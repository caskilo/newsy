/**
 * RSS Fetcher — retrieves raw RSS payloads from sources.
 * See: .idea/newsy0.1.md §4.1
 *
 * Impure (I/O). Parallelized. Timeout bounded.
 */

import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Newsy/0.1 (cognitive-prosthetic)',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  },
});

/**
 * Fetch a single source. Returns null on failure (resilient).
 */
async function fetchSource(source) {
  try {
    const feed = await parser.parseURL(source.rssUrl);
    return {
      sourceId: source.id,
      sourceName: source.name,
      feedTitle: feed.title || source.name,
      items: feed.items || [],
      fetchedAt: Date.now(),
    };
  } catch (err) {
    console.warn(`[fetcher] Failed to fetch ${source.name}: ${err.message}`);
    return null;
  }
}

/**
 * Fetch all enabled sources in parallel.
 * @param {SourceRecord[]} sources
 * @returns {Promise<RawRSSPayload[]>} — failed sources are silently omitted
 */
export async function fetchAll(sources) {
  const enabled = sources.filter(s => s.enabled);
  const results = await Promise.allSettled(enabled.map(fetchSource));
  return results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => r.value);
}
