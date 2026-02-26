/**
 * Normalizer — lowercase, remove stopwords, tokenize, estimate read time.
 * See: .idea/newsy0.1.md §4.3
 *
 * Pure. readTimeMin = wordCount / 225
 */

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'shall', 'can', 'it', 'its',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'we',
  'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his',
  'our', 'their', 'what', 'which', 'who', 'whom', 'when', 'where',
  'why', 'how', 'not', 'no', 'nor', 'so', 'if', 'then', 'than',
  'too', 'very', 'just', 'about', 'above', 'after', 'again', 'all',
  'also', 'am', 'as', 'because', 'before', 'between', 'both', 'each',
  'few', 'get', 'got', 'here', 'into', 'more', 'most', 'new', 'now',
  'only', 'other', 'out', 'over', 'own', 'said', 'same', 'some',
  'such', 'there', 'through', 'under', 'up', 'while', 'down',
]);

const WPM = 225;

/**
 * Tokenize text: lowercase, split on non-alpha, remove stopwords.
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z'-]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * Estimate reading time from raw text word count.
 */
function estimateReadTime(text) {
  if (!text) return 0;
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  return Math.round((words / WPM) * 100) / 100;
}

/**
 * Normalize a single partial article into a complete ArticleRecord (minus scores/cluster).
 */
export function normalize(article) {
  const textForTokens = `${article.title} ${article.summary} ${article.content || ''}`;
  const tokens = tokenize(textForTokens);
  const readTimeMin = estimateReadTime(article.content || article.summary || article.title);

  return {
    ...article,
    tokens,
    readTimeMin,
  };
}

/**
 * Normalize multiple articles.
 */
export function normalizeAll(articles) {
  return articles.map(normalize);
}
