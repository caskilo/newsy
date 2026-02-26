/**
 * Formatter index — dispatches to format-specific renderers.
 * See: .idea/newsy0.1.md §6
 */

import { formatRaw } from './raw.js';
import { formatMarkdown } from './markdown.js';
import { formatJSON } from './json.js';

const formatters = {
  raw: formatRaw,
  markdown: formatMarkdown,
  json: formatJSON,
};

export async function exportBrief(brief, articles, clusters, format = 'raw') {
  const formatter = formatters[format];
  if (!formatter) {
    throw new Error(`Unknown format: ${format}. Available: ${Object.keys(formatters).join(', ')}`);
  }
  return formatter(brief, articles, clusters);
}
