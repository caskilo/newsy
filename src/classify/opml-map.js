/**
 * OPML Category → Newsy Domain mapping.
 *
 * Maps standard OPML/RSS category strings (as used in awesome-rss-feeds
 * and common feed publishers) to our internal domain taxonomy.
 *
 * Keys are lowercased for matching. Multiple OPML categories can map
 * to the same domain. Unmapped categories fall through to keyword analysis.
 */

export const OPML_TO_DOMAIN = new Map([
  // News / Politics
  ['news', 'politics'],
  ['world', 'politics'],
  ['world news', 'politics'],
  ['international', 'politics'],
  ['global', 'politics'],
  ['top stories', 'politics'],
  ['headlines', 'politics'],
  ['breaking news', 'politics'],
  ['latest', 'politics'],
  ['politics', 'politics'],
  ['government', 'politics'],
  ['u.s.', 'politics'],
  ['us news', 'politics'],
  ['uk news', 'politics'],
  ['national', 'politics'],
  ['policy', 'politics'],
  ['elections', 'politics'],

  // Conflict
  ['war', 'conflict'],
  ['military', 'conflict'],
  ['defense', 'conflict'],
  ['security', 'conflict'],
  ['terrorism', 'conflict'],

  // Economy / Business
  ['business', 'economy'],
  ['business & economy', 'economy'],
  ['economy', 'economy'],
  ['finance', 'economy'],
  ['markets', 'economy'],
  ['money', 'economy'],
  ['personal finance', 'economy'],
  ['startups', 'economy'],
  ['investing', 'economy'],
  ['cryptocurrency', 'economy'],

  // Science
  ['science', 'science'],
  ['science & environment', 'science'],
  ['space', 'science'],
  ['physics', 'science'],
  ['biology', 'science'],
  ['chemistry', 'science'],
  ['astronomy', 'science'],
  ['research', 'science'],

  // Tech
  ['tech', 'tech'],
  ['technology', 'tech'],
  ['programming', 'tech'],
  ['web development', 'tech'],
  ['android', 'tech'],
  ['android development', 'tech'],
  ['apple', 'tech'],
  ['ios development', 'tech'],
  ['ui / ux', 'tech'],
  ['cybersecurity', 'tech'],
  ['ai', 'tech'],
  ['artificial intelligence', 'tech'],

  // Environment
  ['environment', 'environment'],
  ['climate', 'environment'],
  ['energy', 'environment'],
  ['sustainability', 'environment'],
  ['nature', 'environment'],
  ['weather', 'environment'],

  // Health
  ['health', 'health'],
  ['medicine', 'health'],
  ['medical', 'health'],
  ['wellness', 'health'],
  ['mental health', 'health'],
  ['fitness', 'health'],

  // Culture / Entertainment
  ['culture', 'culture'],
  ['entertainment', 'culture'],
  ['arts', 'culture'],
  ['movies', 'culture'],
  ['music', 'culture'],
  ['books', 'culture'],
  ['television', 'culture'],
  ['food', 'culture'],
  ['fashion', 'culture'],
  ['beauty', 'culture'],
  ['architecture', 'culture'],
  ['interior design', 'culture'],
  ['diy', 'culture'],
  ['photography', 'culture'],
  ['funny', 'culture'],
  ['history', 'culture'],
  ['travel', 'culture'],
  ['education', 'culture'],
  ['religion', 'culture'],

  // Sports
  ['sports', 'sports'],
  ['football', 'sports'],
  ['soccer', 'sports'],
  ['cricket', 'sports'],
  ['tennis', 'sports'],
  ['cars', 'sports'],
  ['gaming', 'sports'],
]);

/**
 * Map an array of RSS/OPML category strings to newsy domains.
 * Returns an array of { domain, confidence } objects, deduplicated.
 */
export function mapCategoriesToDomains(categories) {
  if (!categories || categories.length === 0) return [];

  const domainScores = new Map();

  for (const cat of categories) {
    const normalised = cat.toLowerCase().trim();
    const domain = OPML_TO_DOMAIN.get(normalised);
    if (domain) {
      domainScores.set(domain, (domainScores.get(domain) || 0) + 2);
    }
  }

  return Array.from(domainScores.entries())
    .map(([domain, score]) => ({ domain, confidence: score }))
    .sort((a, b) => b.confidence - a.confidence);
}
