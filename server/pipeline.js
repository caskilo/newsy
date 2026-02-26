/**
 * Server-side pipeline orchestrator.
 * Fetcher → Parser → Filter → Normalizer → Classifier → Deduplicator → Scorer → Budget Selector
 */

import { fetchAll } from '../src/pipeline/fetcher.js';
import { parseAll } from '../src/pipeline/parser.js';
import { filterArticles } from '../src/classify/filter.js';
import { normalizeAll } from '../src/pipeline/normalizer.js';
import { classifyAll } from '../src/classify/classifier.js';
import { deduplicate } from '../src/pipeline/deduplicator.js';
import { scoreArticles } from '../src/scoring/index.js';
import { selectBrief } from '../src/pipeline/budget.js';
import { groupArticles } from '../src/pipeline/grouper.js';
import { getSources } from './sources.js';

/**
 * Run the full pipeline and return a DailyBrief.
 */
export async function runPipeline(config) {
  const sources = getSources();
  console.log(`[pipeline] Fetching from ${sources.length} sources...`);

  const rawPayloads = await fetchAll(sources);
  console.log(`[pipeline] Fetched ${rawPayloads.length} feeds, ${rawPayloads.reduce((n, p) => n + p.items.length, 0)} raw items`);

  const parsed = parseAll(rawPayloads);
  console.log(`[pipeline] Parsed ${parsed.length} articles`);

  const { kept: filtered, rejected, flagged } = filterArticles(parsed);
  if (rejected.length > 0) {
    console.log(`[pipeline] Filtered: ${rejected.length} rejected, ${flagged.length} flagged`);
    for (const r of rejected.slice(0, 5)) {
      console.log(`  ✗ ${r.title?.slice(0, 60)} — ${r.reasons.join(', ')}`);
    }
  }

  const normalized = normalizeAll(filtered);
  console.log(`[pipeline] Normalized ${normalized.length} articles`);

  const classified = classifyAll(normalized);
  console.log(`[pipeline] Classified ${classified.length} articles`);

  const deduped = deduplicate(classified);
  console.log(`[pipeline] Deduplicated: ${classified.length} → ${deduped.length}`);

  const scored = scoreArticles(deduped);
  console.log(`[pipeline] Scored ${scored.length} articles`);

  const brief = selectBrief(scored, config);
  console.log(`[pipeline] Brief: ${brief.articleCount} articles selected (${brief.totalReadTime} min, emotional load: ${brief.emotionalLoad})`);

  const { groups, ungrouped } = groupArticles(brief.articles);
  console.log(`[pipeline] Grouped: ${groups.length} story groups (${groups.reduce((n, g) => n + g.articleCount, 0)} articles), ${ungrouped.length} standalone`);

  function articleForClient(a) {
    return {
      id: a.id,
      title: a.title,
      summary: a.summary,
      content: a.content || a.summary || '',
      link: a.link,
      sourceName: a.sourceName,
      sourceId: a.sourceId,
      publishedAt: a.publishedAt,
      readTimeMin: a.readTimeMin,
      emotionalScore: a.emotionalScore,
      arousalScore: a.arousalScore,
      categories: a.categories,
      domain: a.domain,
      register: a.register,
      countryCode: a.countryCode || null,
      domainConfidence: a.domainConfidence,
      registerConfidence: a.registerConfidence,
      contentFlags: a.contentFlags || [],
    };
  }

  const groupsForClient = groups.map(g => ({
    groupId: g.groupId,
    headline: g.headline,
    domain: g.domain,
    register: g.register,
    countryCode: g.countryCode,
    articleCount: g.articleCount,
    readTimeMin: g.readTimeMin,
    emotionalScore: g.emotionalScore,
    arousalScore: g.arousalScore,
    publishedRange: g.publishedRange,
    sharedTerms: g.sharedTerms.slice(0, 10),
    sharedEntities: g.sharedEntities.slice(0, 8),
    representative: articleForClient(g.representative),
    sources: g.sources,
  }));

  const ungroupedForClient = ungrouped.map(articleForClient);

  return {
    id: brief.id,
    generatedAt: brief.generatedAt,
    mode: brief.mode,
    totalReadTime: brief.totalReadTime,
    emotionalLoad: brief.emotionalLoad,
    articleCount: brief.articleCount,
    candidateCount: brief.candidateCount,
    rejectedCount: rejected.length,
    flaggedCount: flagged.length,
    groupCount: groups.length,
    groups: groupsForClient,
    articles: ungroupedForClient,
  };
}
