/**
 * Feed Tester — standardised health check for RSS feeds.
 *
 * Tests:
 *  1. Reachability — can we fetch the URL at all?
 *  2. Parsability  — is the response valid RSS/Atom XML?
 *  3. Freshness    — how recent is the latest item?
 *  4. Volume       — how many items does the feed contain?
 *  5. Quality      — do items have titles, summaries, dates, links?
 *
 * Returns a structured report with a pass/warn/fail verdict.
 */

import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Newsy/0.1 (feed-tester)',
    'Accept': 'application/rss+xml, application/xml, text/xml',
  },
});

/**
 * Test a single RSS feed URL.
 * @param {string} url — the RSS/Atom feed URL
 * @returns {Promise<FeedTestResult>}
 */
export async function testFeed(url) {
  const result = {
    url,
    testedAt: Date.now(),
    reachable: false,
    parsable: false,
    feedTitle: null,
    feedDescription: null,
    itemCount: 0,
    latestItemDate: null,
    oldestItemDate: null,
    freshnessHours: null,
    quality: {
      hasTitle: 0,
      hasSummary: 0,
      hasLink: 0,
      hasDate: 0,
      hasCategories: 0,
      avgTitleLength: 0,
      avgSummaryLength: 0,
    },
    responseTimeMs: 0,
    errors: [],
    verdict: 'fail',
  };

  const start = Date.now();

  try {
    const feed = await parser.parseURL(url);
    result.responseTimeMs = Date.now() - start;
    result.reachable = true;
    result.parsable = true;
    result.feedTitle = feed.title || null;
    result.feedDescription = feed.description || null;

    const items = feed.items || [];
    result.itemCount = items.length;

    if (items.length === 0) {
      result.errors.push('Feed contains no items');
      result.verdict = 'warn';
      return result;
    }

    let titleCount = 0, summaryCount = 0, linkCount = 0, dateCount = 0, catCount = 0;
    let titleLenSum = 0, summaryLenSum = 0;
    const dates = [];

    for (const item of items) {
      if (item.title && item.title.trim().length > 0) {
        titleCount++;
        titleLenSum += item.title.trim().length;
      }
      const summary = item.contentSnippet || item.content || item.summary || '';
      if (summary.trim().length > 0) {
        summaryCount++;
        summaryLenSum += summary.trim().length;
      }
      if (item.link) linkCount++;
      const dateStr = item.pubDate || item.isoDate;
      if (dateStr) {
        dateCount++;
        const d = new Date(dateStr).getTime();
        if (!isNaN(d)) dates.push(d);
      }
      if (item.categories && item.categories.length > 0) catCount++;
    }

    result.quality.hasTitle = titleCount;
    result.quality.hasSummary = summaryCount;
    result.quality.hasLink = linkCount;
    result.quality.hasDate = dateCount;
    result.quality.hasCategories = catCount;
    result.quality.avgTitleLength = titleCount > 0 ? Math.round(titleLenSum / titleCount) : 0;
    result.quality.avgSummaryLength = summaryCount > 0 ? Math.round(summaryLenSum / summaryCount) : 0;

    if (dates.length > 0) {
      dates.sort((a, b) => b - a);
      result.latestItemDate = dates[0];
      result.oldestItemDate = dates[dates.length - 1];
      result.freshnessHours = Math.round((Date.now() - dates[0]) / (1000 * 60 * 60) * 10) / 10;
    }

    result.verdict = computeVerdict(result);
  } catch (err) {
    result.responseTimeMs = Date.now() - start;
    result.errors.push(err.message);

    if (err.message.includes('Status code')) {
      result.reachable = false;
    } else if (err.message.includes('ENOTFOUND') || err.message.includes('ECONNREFUSED')) {
      result.reachable = false;
    } else {
      result.reachable = true;
      result.parsable = false;
    }
  }

  return result;
}

/**
 * Compute a pass/warn/fail verdict from the test result.
 */
function computeVerdict(result) {
  const issues = [];

  if (result.itemCount < 3) issues.push('very few items');
  if (result.freshnessHours !== null && result.freshnessHours > 168) issues.push('stale (>7 days)');
  if (result.quality.hasTitle < result.itemCount * 0.8) issues.push('many items missing titles');
  if (result.quality.hasLink < result.itemCount * 0.8) issues.push('many items missing links');
  if (result.responseTimeMs > 10000) issues.push('slow response');

  if (issues.length > 0) {
    result.errors.push(...issues);
  }

  if (result.itemCount === 0) return 'fail';
  if (result.freshnessHours !== null && result.freshnessHours > 720) return 'fail';
  if (issues.length >= 3) return 'fail';
  if (issues.length >= 1) return 'warn';
  return 'pass';
}

/**
 * Test multiple feeds in parallel.
 * @param {string[]} urls
 * @returns {Promise<FeedTestResult[]>}
 */
export async function testFeeds(urls) {
  const results = await Promise.allSettled(urls.map(testFeed));
  return results.map(r => r.status === 'fulfilled' ? r.value : {
    url: 'unknown',
    testedAt: Date.now(),
    reachable: false,
    parsable: false,
    errors: [r.reason?.message || 'Unknown error'],
    verdict: 'fail',
  });
}
