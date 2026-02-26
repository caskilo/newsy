/**
 * OPML Import/Export — handles the standard outline format for RSS feeds.
 *
 * OPML (Outline Processor Markup Language) is the standard interchange
 * format for RSS feed lists. The awesome-rss-feeds project provides
 * both "with_category" and "without_category" OPML files.
 *
 * This module:
 *   - Parses OPML XML into structured source records
 *   - Maps OPML categories to our internal domain taxonomy
 *   - Exports our sources back to OPML format
 *
 * Pure functions, no I/O.
 */

import { OPML_TO_DOMAIN } from './opml-map.js';

/**
 * Parse an OPML XML string into an array of source descriptors.
 *
 * Handles both flat and nested (categorised) OPML structures:
 *   - Flat: <outline type="rss" xmlUrl="..." text="..." />
 *   - Nested: <outline text="Category"><outline type="rss" ... /></outline>
 *
 * @param {string} xml — raw OPML XML string
 * @returns {{ title: string, sources: Array<{ name, rssUrl, category, opmlCategories }> }}
 */
export function parseOPML(xml) {
  const title = extractTag(xml, 'title') || 'Imported OPML';
  const sources = [];

  // Extract all outline elements with xmlUrl (these are the actual feeds)
  const outlineRegex = /<outline\s[^>]*xmlUrl\s*=\s*"([^"]*)"[^>]*>/gi;
  let match;

  while ((match = outlineRegex.exec(xml)) !== null) {
    const element = match[0];
    const rssUrl = match[1];
    const name = extractAttr(element, 'text') || extractAttr(element, 'title') || rssUrl;
    const rawCategory = extractAttr(element, 'category') || '';
    const htmlUrl = extractAttr(element, 'htmlUrl') || '';

    // Also try to infer category from parent outline element
    const parentCategory = findParentCategory(xml, match.index);

    const opmlCategories = [rawCategory, parentCategory]
      .filter(c => c && c.trim().length > 0)
      .map(c => c.trim());

    // Map to internal domain
    const domain = mapToInternalDomain(opmlCategories);

    sources.push({
      name: decodeXmlEntities(name),
      rssUrl: decodeXmlEntities(rssUrl),
      htmlUrl: decodeXmlEntities(htmlUrl),
      domain,
      opmlCategories,
      language: inferLanguage(name, rssUrl),
    });
  }

  return { title: decodeXmlEntities(title), sources };
}

/**
 * Find the parent <outline text="..."> for a nested OPML structure.
 * Looks backwards from the match position for an outline without xmlUrl.
 */
function findParentCategory(xml, position) {
  // Search backwards for the nearest <outline text="..." that does NOT have xmlUrl
  const before = xml.substring(0, position);
  const parentRegex = /<outline\s+text\s*=\s*"([^"]*)"(?![^>]*xmlUrl)/gi;
  let lastMatch = null;
  let m;
  while ((m = parentRegex.exec(before)) !== null) {
    lastMatch = m[1];
  }
  return lastMatch || '';
}

/**
 * Map OPML categories to an internal domain using the mapping table.
 */
function mapToInternalDomain(opmlCategories) {
  for (const cat of opmlCategories) {
    const normalised = cat.toLowerCase().trim();
    // Try exact match
    if (OPML_TO_DOMAIN.has(normalised)) return OPML_TO_DOMAIN.get(normalised);
    // Try splitting on / or , (OPML allows "Tech/AI" style categories)
    for (const sub of normalised.split(/[\/,]/)) {
      const trimmed = sub.trim();
      if (OPML_TO_DOMAIN.has(trimmed)) return OPML_TO_DOMAIN.get(trimmed);
    }
  }
  return null;
}

/**
 * Rough language inference from feed name/URL.
 */
function inferLanguage(name, url) {
  const combined = `${name} ${url}`.toLowerCase();
  if (/\.(fr|france)\b/.test(combined) || /french|français/.test(combined)) return 'fr';
  if (/\.(de|germany)\b/.test(combined) || /german|deutsch/.test(combined)) return 'de';
  if (/\.(es|spain|mexico)\b/.test(combined) || /spanish|español/.test(combined)) return 'es';
  if (/\.(it|italy)\b/.test(combined) || /italian|italiano/.test(combined)) return 'it';
  if (/\.(pt|brazil)\b/.test(combined) || /portuguese|português/.test(combined)) return 'pt';
  if (/\.(jp|japan)\b/.test(combined) || /japanese|日本/.test(combined)) return 'ja';
  if (/\.(ru|russia)\b/.test(combined) || /russian|русский/.test(combined)) return 'ru';
  if (/\.(cn|china)\b/.test(combined) || /chinese|中文/.test(combined)) return 'zh';
  if (/\.(kr|korea)\b/.test(combined) || /korean|한국/.test(combined)) return 'ko';
  if (/\.(ar|arabic)\b/.test(combined) || /arabic|العربية/.test(combined)) return 'ar';
  return 'en';
}

/**
 * Export sources to OPML XML string.
 *
 * @param {string} title — OPML document title
 * @param {Array<{ name, rssUrl, category?, domain?, opmlCategories? }>} sources
 * @param {boolean} withCategories — if true, group by domain
 * @returns {string} OPML XML
 */
export function exportOPML(title, sources, withCategories = true) {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    '  <head>',
    `    <title>${escapeXml(title)}</title>`,
    `    <dateCreated>${new Date().toUTCString()}</dateCreated>`,
    '  </head>',
    '  <body>',
  ];

  if (withCategories) {
    // Group by domain
    const grouped = {};
    for (const s of sources) {
      const group = s.domain || s.category || 'uncategorised';
      if (!grouped[group]) grouped[group] = [];
      grouped[group].push(s);
    }

    for (const [group, feeds] of Object.entries(grouped)) {
      lines.push(`    <outline text="${escapeXml(group)}">`);
      for (const s of feeds) {
        lines.push(`      <outline type="rss" text="${escapeXml(s.name)}" xmlUrl="${escapeXml(s.rssUrl)}" category="${escapeXml(s.domain || s.category || '')}" />`);
      }
      lines.push('    </outline>');
    }
  } else {
    for (const s of sources) {
      lines.push(`    <outline type="rss" text="${escapeXml(s.name)}" xmlUrl="${escapeXml(s.rssUrl)}" category="${escapeXml(s.domain || s.category || '')}" />`);
    }
  }

  lines.push('  </body>');
  lines.push('</opml>');

  return lines.join('\n');
}

// --- Utilities ---

function extractTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}

function extractAttr(element, attr) {
  const m = element.match(new RegExp(`${attr}\\s*=\\s*"([^"]*)"`, 'i'));
  return m ? m[1] : null;
}

function decodeXmlEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
