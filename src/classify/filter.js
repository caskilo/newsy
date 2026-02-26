/**
 * Content Filter — catches spam, clickbait, and malicious patterns.
 *
 * Applied EARLY in the pipeline (post-parse, pre-normalise).
 * Returns a filtered array plus a rejection log for transparency.
 *
 * Pure function. No external calls.
 *
 * Rejection reasons are explicit, never silent drops.
 */

/**
 * Clickbait title patterns — excessive hype, manufactured urgency.
 * Each pattern is { regex, reason, severity }.
 * severity: 'reject' = always drop, 'flag' = mark but keep.
 */
const CLICKBAIT_PATTERNS = [
  { regex: /you won'?t believe/i, reason: 'clickbait: manufactured shock', severity: 'reject' },
  { regex: /shocking\s*(truth|reason|fact|secret)/i, reason: 'clickbait: shock bait', severity: 'reject' },
  { regex: /\d+\s*(reason|thing|way|secret|trick|hack)s?\s*(you|that|why|to)/i, reason: 'clickbait: listicle bait', severity: 'flag' },
  { regex: /this\s*(one\s*)?(weird|simple|strange)\s*(trick|hack)/i, reason: 'clickbait: trick bait', severity: 'reject' },
  { regex: /what happens next/i, reason: 'clickbait: manufactured suspense', severity: 'flag' },
  { regex: /doctors?\s*(hate|don'?t want)/i, reason: 'clickbait: authority bait', severity: 'reject' },
  { regex: /is\s*dead/i, reason: 'clickbait: death bait', severity: 'flag' },
];

/**
 * Promotional/spam patterns.
 */
const SPAM_PATTERNS = [
  { regex: /\b(buy now|order now|limited time|act now|don'?t miss)\b/i, reason: 'spam: promotional', severity: 'reject' },
  { regex: /\b(free shipping|discount code|promo code|coupon)\b/i, reason: 'spam: commercial', severity: 'reject' },
  { regex: /\b(affiliate|sponsored content|paid partnership)\b/i, reason: 'spam: affiliate', severity: 'flag' },
  { regex: /\b(subscribe now|sign up free|join now)\b/i, reason: 'spam: acquisition', severity: 'flag' },
  { regex: /\$\d+[,.]?\d*\s*(off|savings?|deal)/i, reason: 'spam: deal promotion', severity: 'reject' },
];

/**
 * SEO / quality patterns.
 */
const QUALITY_PATTERNS = [
  { test: (article) => {
    // Excessive caps in title (>50% uppercase letters, min 10 chars)
    const alpha = (article.title || '').replace(/[^a-zA-Z]/g, '');
    if (alpha.length < 10) return null;
    const upper = alpha.replace(/[^A-Z]/g, '').length;
    return (upper / alpha.length) > 0.5 ? { reason: 'quality: excessive caps', severity: 'flag' } : null;
  }},
  { test: (article) => {
    // Title too short to be meaningful
    const title = (article.title || '').trim();
    return title.length < 8 ? { reason: 'quality: title too short', severity: 'reject' } : null;
  }},
  { test: (article) => {
    // No summary and minimal content = stub article
    const content = (article.summary || '') + (article.content || '');
    return content.trim().length < 20 ? { reason: 'quality: stub article', severity: 'flag' } : null;
  }},
  { test: (article) => {
    // Keyword stuffing: same significant word appears >4 times in title
    const words = (article.title || '').toLowerCase().split(/\s+/);
    const counts = {};
    for (const w of words) {
      if (w.length > 3) {
        counts[w] = (counts[w] || 0) + 1;
        if (counts[w] > 4) return { reason: 'quality: keyword stuffing', severity: 'reject' };
      }
    }
    return null;
  }},
];

/**
 * Suspicious URL patterns.
 */
const URL_PATTERNS = [
  { regex: /bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly/i, reason: 'url: link shortener', severity: 'flag' },
  { regex: /\.(xyz|top|click|work|loan|racing|date|download|stream|gdn|accountant)\//i, reason: 'url: suspicious TLD', severity: 'reject' },
  { regex: /[?&](utm_|ref=|aff=|partner=)/i, reason: 'url: tracking parameters', severity: 'flag' },
];

/**
 * Filter articles for spam, clickbait, and quality issues.
 *
 * @param {object[]} articles — parsed articles (post-parse, pre-normalise)
 * @returns {{ kept: object[], rejected: object[], flagged: object[] }}
 */
export function filterArticles(articles) {
  const kept = [];
  const rejected = [];
  const flagged = [];

  for (const article of articles) {
    const issues = checkArticle(article);
    const rejects = issues.filter(i => i.severity === 'reject');
    const flags = issues.filter(i => i.severity === 'flag');

    if (rejects.length > 0) {
      rejected.push({
        id: article.id,
        title: article.title,
        sourceId: article.sourceId,
        reasons: rejects.map(r => r.reason),
      });
    } else {
      const enriched = { ...article };
      if (flags.length > 0) {
        enriched.contentFlags = flags.map(f => f.reason);
        flagged.push({
          id: article.id,
          title: article.title,
          reasons: flags.map(f => f.reason),
        });
      }
      kept.push(enriched);
    }
  }

  return { kept, rejected, flagged };
}

/**
 * Check a single article against all patterns.
 * @returns {Array<{ reason: string, severity: string }>}
 */
function checkArticle(article) {
  const issues = [];
  const title = article.title || '';
  const summary = article.summary || '';
  const text = `${title} ${summary}`;
  const link = article.link || '';

  // Clickbait
  for (const p of CLICKBAIT_PATTERNS) {
    if (p.regex.test(title)) {
      issues.push({ reason: p.reason, severity: p.severity });
    }
  }

  // Spam
  for (const p of SPAM_PATTERNS) {
    if (p.regex.test(text)) {
      issues.push({ reason: p.reason, severity: p.severity });
    }
  }

  // Quality
  for (const p of QUALITY_PATTERNS) {
    const result = p.test(article);
    if (result) issues.push(result);
  }

  // URL patterns
  for (const p of URL_PATTERNS) {
    if (p.regex.test(link)) {
      issues.push({ reason: p.reason, severity: p.severity });
    }
  }

  return issues;
}
