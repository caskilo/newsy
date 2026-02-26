/**
 * Thematic Classifier — assigns domain + register to articles.
 *
 * Pure function: (article, sourceMetadata?) → { domain, register, domainConfidence, registerConfidence }
 *
 * Classification strategy (layered, no external APIs):
 *   1. RSS/OPML category mapping → domain hint
 *   2. Source bias → domain hint (Nature → science, etc.)
 *   3. Keyword scoring against domain lexicon
 *   4. Keyword scoring against register lexicon
 *   5. Composite: merge hints, pick top-scoring domain & register
 *
 * Designed for the cognitive prosthetic: the register axis is what makes
 * this different from a standard topic classifier. It tells you not just
 * "what happened" but "what this asks of your mind".
 */

import { DOMAIN_KEYWORDS } from './domain-lexicon.js';
import { REGISTER_KEYWORDS } from './register-lexicon.js';
import { mapCategoriesToDomains } from './opml-map.js';
import { detectCountry } from './country-detector.js';

/**
 * Source bias: known sources that lean heavily toward a domain.
 * Weight 2 = strong bias, 1 = slight lean.
 */
const SOURCE_BIAS = new Map([
  ['bbc-science', { domain: 'science', weight: 3 }],
  ['nature', { domain: 'science', weight: 3 }],
  ['sciencedaily', { domain: 'science', weight: 3 }],
  ['ars-technica', { domain: 'tech', weight: 2 }],
  ['hacker-news', { domain: 'tech', weight: 2 }],
  ['the-verge', { domain: 'tech', weight: 2 }],
]);

/**
 * Score text tokens against a keyword map.
 * Uses substring matching for stems (e.g. "devastat" matches "devastating").
 *
 * @param {string[]} tokens — normalised tokens
 * @param {string} rawText — original lowercase text for phrase matching
 * @param {Map<string, number>} keywordMap — keyword → weight
 * @returns {number} aggregate score
 */
function scoreAgainst(tokens, rawText, keywordMap) {
  let score = 0;

  for (const [keyword, weight] of keywordMap) {
    // Multi-word phrases: check raw text
    if (keyword.includes(' ')) {
      if (rawText.includes(keyword)) {
        score += weight * 2;
      }
      continue;
    }

    // Single keywords: check token starts-with (stem matching)
    for (const token of tokens) {
      if (token === keyword || (keyword.length >= 4 && token.startsWith(keyword))) {
        score += weight;
        break;
      }
    }
  }

  return score;
}

/**
 * Classify a single article.
 *
 * @param {object} article — must have: title, summary, tokens, categories, sourceId
 * @returns {{ domain: string, register: string, domainConfidence: number, registerConfidence: number }}
 */
export function classify(article) {
  // Separate title and body for weighted scoring
  // Title is editorially curated — 2x weight.
  const titleText = (article.title || '').toLowerCase();
  const bodyText = `${article.summary || ''} ${article.content || ''}`.toLowerCase();
  const fullText = `${titleText} ${bodyText}`;

  const titleTokens = titleText.split(/[^a-z'-]+/).filter(t => t.length > 1);
  const allTokens = article.tokens || fullText.split(/[^a-z'-]+/).filter(t => t.length > 1);

  // --- Domain scoring ---
  const domainScores = {};

  // Layer 1: OPML/RSS category mapping
  const categoryHints = mapCategoriesToDomains(article.categories || []);
  for (const { domain, confidence } of categoryHints) {
    domainScores[domain] = (domainScores[domain] || 0) + confidence;
  }

  // Layer 2: Source bias
  const bias = SOURCE_BIAS.get(article.sourceId);
  if (bias) {
    domainScores[bias.domain] = (domainScores[bias.domain] || 0) + bias.weight;
  }

  // Layer 3: Keyword scoring (title 2x, body 1x)
  for (const [domain, keywordMap] of Object.entries(DOMAIN_KEYWORDS)) {
    const titleScore = scoreAgainst(titleTokens, titleText, keywordMap) * 2;
    const bodyScore = scoreAgainst(allTokens, fullText, keywordMap);
    const combined = titleScore + bodyScore;
    if (combined > 0) {
      domainScores[domain] = (domainScores[domain] || 0) + combined;
    }
  }

  // --- Register scoring (title 2x, body 1x) ---
  const registerScores = {};
  for (const [register, keywordMap] of Object.entries(REGISTER_KEYWORDS)) {
    const titleScore = scoreAgainst(titleTokens, titleText, keywordMap) * 2;
    const bodyScore = scoreAgainst(allTokens, fullText, keywordMap);
    const combined = titleScore + bodyScore;
    if (combined > 0) {
      registerScores[register] = combined;
    }
  }

  // --- Country detection (separate axis) ---
  const countryCode = detectCountry(article);

  // --- Pick winners ---
  const topDomain = pickTop(domainScores, null);
  const topRegister = pickTop(registerScores, 'awareness');

  return {
    domain: topDomain.key,
    register: topRegister.key,
    domainConfidence: topDomain.score,
    registerConfidence: topRegister.score,
    countryCode,
  };
}

/**
 * Pick the highest-scoring key, with fallback default.
 */
function pickTop(scores, fallback) {
  let bestKey = fallback;
  let bestScore = 0;

  for (const [key, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestKey = key;
      bestScore = score;
    }
  }

  return { key: bestKey, score: bestScore };
}

/**
 * Classify multiple articles.
 */
export function classifyAll(articles) {
  return articles.map(article => {
    const classification = classify(article);
    return { ...article, ...classification };
  });
}
