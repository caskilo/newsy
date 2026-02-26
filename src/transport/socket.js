/**
 * Socket.io transport layer.
 * See: .idea/newsy0.1.md §7.1
 *
 * Namespace: /newsy
 *
 * Client → Server: fetchNow, generateBrief, setMode, markSeen, updateSources, getState
 * Server → Client: briefGenerated, articlesUpdated, stateSnapshot, error
 */

export function createSocketTransport(io) {
  // TODO: Register /newsy namespace
  // TODO: Bind event handlers
  // TODO: Return transport handle
  throw new Error('Not implemented');
}
