/**
 * Scoring module — computes emotional and arousal scores for articles.
 * See: .idea/newsy0.1.md §4.6
 *
 * Uses pluggable lexicon registry. Defaults to English.
 * emotionalScore ∈ [-1, 1]
 * arousalScore ∈ [0, 1]
 */

import { registerLexicon, getLexicon } from './registry.js';
import { en } from './lexicons/en.js';

registerLexicon('en', en);

/**
 * Score a single article's tokens.
 * @param {string[]} tokens - normalized lowercase tokens
 * @param {string} lang - language code (default 'en')
 * @returns {{ emotionalScore: number, arousalScore: number }}
 */
export function scoreTokens(tokens, lang = 'en') {
  const lexicon = getLexicon(lang);
  if (!lexicon || tokens.length === 0) {
    return { emotionalScore: 0, arousalScore: 0 };
  }

  let sentimentSum = 0;
  let sentimentCount = 0;
  let arousalCount = 0;

  for (const token of tokens) {
    if (lexicon.sentiment.has(token)) {
      sentimentSum += lexicon.sentiment.get(token);
      sentimentCount++;
    }
    if (lexicon.arousal.has(token)) {
      arousalCount++;
    }
  }

  const emotionalScore = sentimentCount > 0
    ? Math.max(-1, Math.min(1, sentimentSum / (sentimentCount * 5)))
    : 0;

  const arousalScore = Math.min(1, arousalCount / Math.max(1, tokens.length) * 10);

  return { emotionalScore, arousalScore };
}

/**
 * Score an ArticleRecord in place, returning it with scores attached.
 */
export function scoreArticle(article) {
  const tokens = article.tokens || [];
  const { emotionalScore, arousalScore } = scoreTokens(tokens);
  return { ...article, emotionalScore, arousalScore };
}

export function scoreArticles(articles) {
  return articles.map(scoreArticle);
}
