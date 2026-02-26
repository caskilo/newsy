/**
 * Deduplicator — removes duplicate articles.
 * See: .idea/newsy0.1.md §4.4
 *
 * Pure. Duplicates defined by cosine(tfidf) > 0.92 OR identical normalized title hash.
 * Retains earliest, merges categories, discards later.
 *
 * v1: Uses normalized title hash + Jaccard token overlap as a lightweight
 * proxy for cosine/TF-IDF. Full TF-IDF comes with clustering in a later phase.
 */

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function jaccardSimilarity(tokensA, tokensB) {
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Deduplicate articles.
 * @param {ArticleRecord[]} articles — should be sorted by publishedAt ascending for "retain earliest"
 * @param {number} threshold — Jaccard similarity threshold (default 0.7, approximates cosine 0.92 for short texts)
 * @returns {ArticleRecord[]}
 */
export function deduplicate(articles, threshold = 0.7) {
  const sorted = [...articles].sort((a, b) => a.publishedAt - b.publishedAt);
  const seen = new Map();
  const kept = [];

  for (const article of sorted) {
    const normTitle = normalizeTitle(article.title);

    if (seen.has(normTitle)) {
      const existing = seen.get(normTitle);
      existing.categories = [...new Set([...existing.categories, ...article.categories])];
      continue;
    }

    let isDuplicate = false;
    for (const existing of kept) {
      if (jaccardSimilarity(article.tokens || [], existing.tokens || []) > threshold) {
        existing.categories = [...new Set([...existing.categories, ...article.categories])];
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      seen.set(normTitle, article);
      kept.push(article);
    }
  }

  return kept;
}
