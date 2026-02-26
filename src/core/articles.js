/**
 * Article state management.
 * See: .idea/newsy0.1.md §9 (Article lifecycle: NEW → SCORED → CLUSTERED → ELIGIBLE → SELECTED → SEEN)
 */

export async function markArticleSeen(articleId) {
  // TODO: Update article.seen = true in IndexedDB
  throw new Error('Not implemented');
}

export async function getArticle(articleId) {
  // TODO: Retrieve ArticleRecord by id
  throw new Error('Not implemented');
}
