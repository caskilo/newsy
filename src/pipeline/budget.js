/**
 * Budget Selector — selects articles within cognitive budget.
 * See: .idea/newsy0.1.md §4.7
 *
 * Pure. Deterministic given state snapshot.
 * Greedy inclusion sorted by recency, with arousal and time limits.
 *
 * v1: No clustering — operates directly on scored articles.
 * Clustering-aware selection comes in a later phase.
 */

import { createHash } from 'crypto';

/**
 * Select articles that fit within the cognitive budget.
 * @param {ArticleRecord[]} articles — scored, deduplicated
 * @param {object} config — { maxReadTimeMin, maxArousalLoad, mode }
 * @returns {DailyBrief}
 */
export function selectBrief(articles, config) {
  const {
    maxReadTimeMin = 15,
    maxArousalLoad = 0.6,
  } = config;

  const candidates = [...articles]
    .filter(a => !a.seen)
    .sort((a, b) => b.publishedAt - a.publishedAt);

  const selected = [];
  let totalReadTime = 0;
  let emotionalLoadSum = 0;
  let highArousalCount = 0;

  for (const article of candidates) {
    if (totalReadTime + article.readTimeMin > maxReadTimeMin) continue;

    const isHighArousal = (article.arousalScore || 0) > 0.6;
    if (isHighArousal && highArousalCount >= 1) continue;

    const projectedLoad = (emotionalLoadSum + Math.abs(article.emotionalScore || 0)) / (selected.length + 1);
    if (selected.length > 0 && projectedLoad > maxArousalLoad) continue;

    selected.push({ ...article, selected: true });
    totalReadTime += article.readTimeMin;
    emotionalLoadSum += Math.abs(article.emotionalScore || 0);
    if (isHighArousal) highArousalCount++;
  }

  const now = Date.now();
  const dateStr = new Date(now).toISOString().slice(0, 10);
  const briefId = createHash('sha256').update(`brief-${dateStr}-${now}`).digest('hex').slice(0, 16);

  return {
    id: briefId,
    generatedAt: now,
    articles: selected,
    articleIds: selected.map(a => a.id),
    clusterIds: [],
    totalReadTime: Math.round(totalReadTime * 100) / 100,
    emotionalLoad: selected.length > 0
      ? Math.round((emotionalLoadSum / selected.length) * 100) / 100
      : 0,
    mode: config.mode || 'overview',
    articleCount: selected.length,
    candidateCount: candidates.length,
  };
}
