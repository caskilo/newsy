/**
 * RSS Parser — converts raw RSS payloads to partial ArticleRecords.
 * See: .idea/newsy0.1.md §4.2
 *
 * Pure. Strips HTML, normalizes whitespace, converts dates to epoch, drops media.
 */

import { createHash } from 'crypto';

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function toEpoch(dateStr) {
  if (!dateStr) return Date.now();
  const ms = new Date(dateStr).getTime();
  return Number.isNaN(ms) ? Date.now() : ms;
}

function makeId(sourceId, link, title) {
  return createHash('sha256')
    .update(`${sourceId}|${link}|${title}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Parse a single raw RSS payload into partial ArticleRecords.
 * @param {RawRSSPayload} payload
 * @returns {Partial<ArticleRecord>[]}
 */
export function parse(payload) {
  const { sourceId, sourceName, items, fetchedAt } = payload;

  return items.map(item => {
    const title = stripHtml(item.title || '');
    const summary = stripHtml(item.contentSnippet || item.content || item.summary || '');
    const content = stripHtml(item['content:encoded'] || item.content || '');
    const link = item.link || '';
    const categories = (item.categories || []).map(c =>
      typeof c === 'string' ? c : c._ || c.term || String(c)
    );

    return {
      id: makeId(sourceId, link, title),
      sourceId,
      sourceName,
      title,
      summary,
      content: content || summary,
      link,
      publishedAt: toEpoch(item.pubDate || item.isoDate),
      fetchedAt,
      categories,
      seen: false,
      selected: false,
    };
  }).filter(a => a.title.length > 0);
}

/**
 * Parse multiple payloads.
 */
export function parseAll(payloads) {
  return payloads.flatMap(parse);
}
