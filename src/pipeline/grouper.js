/**
 * Story Grouper — clusters articles about the same underlying event.
 *
 * Different from deduplication: dedup removes near-identical copies,
 * grouping recognises distinct articles covering the same story.
 *
 * Phase 1 algorithm:
 *   1. Jaccard token overlap (lower threshold than dedup: ~0.25-0.40)
 *   2. Boosted by: same domain, same countryCode, close publish time
 *   3. Single-pass greedy: each article joins the best-matching existing group
 *      or starts a new one
 *
 * A group's representative is chosen by lowest arousal score (most neutral).
 * The group headline comes from the shortest title (wire services tend to be
 * more neutral than editorial outlets).
 *
 * Pure function. No side effects.
 */

const BASE_THRESHOLD = 0.20;
const DOMAIN_BOOST   = 0.08;
const COUNTRY_BOOST  = 0.10;
const TIME_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const TIME_BOOST     = 0.05;

/**
 * Jaccard similarity between two token arrays.
 */
function jaccard(tokensA, tokensB) {
  if (!tokensA?.length || !tokensB?.length) return 0;
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
 * Compute boosted similarity between two articles.
 * The boost rewards articles that share structural metadata,
 * lowering the token-overlap bar needed to group them.
 */
function similarity(a, b) {
  let score = jaccard(a.tokens || [], b.tokens || []);

  const differentSources = a.sourceId && b.sourceId && a.sourceId !== b.sourceId;

  if (differentSources && a.domain && b.domain && a.domain === b.domain) score += DOMAIN_BOOST;
  if (differentSources && a.countryCode && b.countryCode && a.countryCode === b.countryCode) score += COUNTRY_BOOST;

  const timeDelta = Math.abs((a.publishedAt || 0) - (b.publishedAt || 0));
  if (differentSources && timeDelta < TIME_WINDOW_MS) score += TIME_BOOST;

  return score;
}

/**
 * Pick the most representative article from a group.
 * Criteria: lowest arousal score (most neutral tone).
 * Tie-break: shortest title (wire service style).
 */
function pickRepresentative(articles) {
  return articles.reduce((best, curr) => {
    const bestArousal = best.arousalScore || 0;
    const currArousal = curr.arousalScore || 0;
    if (currArousal < bestArousal) return curr;
    if (currArousal === bestArousal && (curr.title || '').length < (best.title || '').length) return curr;
    return best;
  });
}

/**
 * Pick the group headline: shortest title among all articles.
 */
function pickHeadline(articles) {
  return articles.reduce((shortest, curr) => {
    return (curr.title || '').length < (shortest.title || '').length ? curr : shortest;
  }).title;
}

/**
 * Consensus value: most common non-null value in the group.
 */
function consensus(articles, field) {
  const counts = {};
  for (const a of articles) {
    const v = a[field];
    if (v) counts[v] = (counts[v] || 0) + 1;
  }
  let best = null, bestCount = 0;
  for (const [k, c] of Object.entries(counts)) {
    if (c > bestCount) { best = k; bestCount = c; }
  }
  return best;
}

/**
 * Worst-case register: pick the highest cognitive cost register in the group.
 */
const REGISTER_COST = { alert: 5, concern: 4, analysis: 3, reflection: 2, curiosity: 1, awareness: 0 };

function worstRegister(articles) {
  let worst = 'awareness', worstCost = 0;
  for (const a of articles) {
    const cost = REGISTER_COST[a.register] ?? 0;
    if (cost > worstCost) { worst = a.register; worstCost = cost; }
  }
  return worst;
}

/**
 * Extract key terms from a group — tokens that appear in 2+ articles.
 * These are the shared concepts that define the story.
 * Used for reinforcement learning from manual grouping.
 */
export function extractSharedTerms(articles) {
  const tokenCounts = {};
  for (const a of articles) {
    const seen = new Set();
    for (const t of (a.tokens || [])) {
      if (!seen.has(t)) {
        tokenCounts[t] = (tokenCounts[t] || 0) + 1;
        seen.add(t);
      }
    }
  }
  // Terms appearing in at least 2 articles, sorted by frequency
  return Object.entries(tokenCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([term, count]) => ({ term, count }));
}

/**
 * Extract named entities (simple heuristic: capitalised multi-word sequences).
 * Phase 3 will use proper NER; this captures obvious names, places, orgs.
 */
export function extractEntities(articles) {
  const entityCounts = {};
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;

  for (const a of articles) {
    const text = `${a.title || ''} ${a.summary || ''}`;
    const seen = new Set();
    let match;
    while ((match = namePattern.exec(text)) !== null) {
      const entity = match[1];
      if (!seen.has(entity)) {
        entityCounts[entity] = (entityCounts[entity] || 0) + 1;
        seen.add(entity);
      }
    }
  }

  return Object.entries(entityCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([entity, count]) => ({ entity, count }));
}

/**
 * Build a StoryGroup object from a set of articles.
 */
function buildGroup(articles) {
  const representative = pickRepresentative(articles);
  const headline = pickHeadline(articles);

  return {
    groupId: articles.map(a => a.id).sort().join('|'),
    headline,
    domain: consensus(articles, 'domain'),
    register: worstRegister(articles),
    countryCode: consensus(articles, 'countryCode'),
    sources: articles.map(a => ({
      sourceId: a.sourceId,
      sourceName: a.sourceName,
      articleId: a.id,
      title: a.title,
      link: a.link,
      summary: a.summary,
      content: a.content,
      publishedAt: a.publishedAt,
      readTimeMin: a.readTimeMin,
      emotionalScore: a.emotionalScore,
      arousalScore: a.arousalScore,
    })),
    articleCount: articles.length,
    representative,
    publishedRange: {
      earliest: Math.min(...articles.map(a => a.publishedAt || Infinity)),
      latest: Math.max(...articles.map(a => a.publishedAt || 0)),
    },
    readTimeMin: representative.readTimeMin,
    emotionalScore: representative.emotionalScore,
    arousalScore: representative.arousalScore,
    sharedTerms: extractSharedTerms(articles),
    sharedEntities: extractEntities(articles),
  };
}

/**
 * Group articles into story groups.
 *
 * @param {ArticleRecord[]} articles — classified, deduplicated articles
 * @param {number} threshold — minimum boosted similarity to group (default BASE_THRESHOLD)
 * @returns {{ groups: StoryGroup[], ungrouped: ArticleRecord[] }}
 */
export function groupArticles(articles, threshold = BASE_THRESHOLD) {
  // Each group is an array of articles. We try to assign each article
  // to the best-matching group, or start a new one.
  const groupBuckets = []; // Array<Array<ArticleRecord>>

  for (const article of articles) {
    let bestGroupIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < groupBuckets.length; i++) {
      // Compare against the group's representative (first article or lowest arousal)
      const rep = groupBuckets[i][0];
      const score = similarity(article, rep);

      // Also check against other members for better matching
      let maxScore = score;
      for (const member of groupBuckets[i]) {
        const s = similarity(article, member);
        if (s > maxScore) maxScore = s;
      }

      if (maxScore > bestScore && maxScore >= threshold) {
        bestScore = maxScore;
        bestGroupIdx = i;
      }
    }

    if (bestGroupIdx >= 0) {
      groupBuckets[bestGroupIdx].push(article);
    } else {
      groupBuckets.push([article]);
    }
  }

  // Separate multi-article groups from singletons
  const groups = [];
  const ungrouped = [];

  for (const bucket of groupBuckets) {
    if (bucket.length >= 2) {
      groups.push(buildGroup(bucket));
    } else {
      ungrouped.push(bucket[0]);
    }
  }

  return { groups, ungrouped };
}
