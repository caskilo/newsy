/**
 * Source management — add, remove, list RSS sources.
 * See: .idea/newsy0.1.md §2.4
 */

export async function addSource(source) {
  // TODO: Validate SourceRecord shape
  // TODO: Persist to IndexedDB sources store
  throw new Error('Not implemented');
}

export async function removeSource(sourceId) {
  // TODO: Remove from IndexedDB sources store
  throw new Error('Not implemented');
}

export async function listSources() {
  // TODO: Return all SourceRecord[]
  throw new Error('Not implemented');
}
