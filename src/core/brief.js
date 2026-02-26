/**
 * Brief generation and retrieval.
 * Orchestrates the pipeline: fetch → parse → normalize → dedup → cluster → score → budget → format.
 * See: .idea/newsy0.1.md §2.3, §4.7
 */

export async function generateBrief(modeConfig = {}) {
  // TODO: Run full pipeline
  // TODO: Persist DailyBrief to IndexedDB
  // TODO: Return DailyBrief
  throw new Error('Not implemented');
}

export async function getBrief(id) {
  // TODO: Retrieve DailyBrief by id from IndexedDB
  throw new Error('Not implemented');
}
