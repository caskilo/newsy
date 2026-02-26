/**
 * Emotional Scoring Engine — computes emotional and arousal scores.
 * See: .idea/newsy0.1.md §4.6
 *
 * Pure. Lexicon-based (phase 1).
 * emotionalScore = mean(sentiment(tokens)) ∈ [-1, 1]
 * arousalScore = count(high_arousal_terms) / tokenCount ∈ [0, 1]
 */

export function scoreArticle(article) {
  // TODO: Apply sentiment lexicon to tokens
  // TODO: Compute emotionalScore
  // TODO: Compute arousalScore
  // TODO: Return scored ArticleRecord
  throw new Error('Not implemented');
}

export function scoreArticles(articles) {
  return articles.map(scoreArticle);
}
