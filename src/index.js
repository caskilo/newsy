/**
 * Newsy — Public API Surface
 *
 * All methods return Promises.
 * See: .idea/newsy0.1.md §16
 */

export { init } from './core/init.js';
export { addSource, removeSource } from './core/sources.js';
export { fetchAll } from './pipeline/fetcher.js';
export { generateBrief, getBrief } from './core/brief.js';
export { markArticleSeen } from './core/articles.js';
export { exportBrief } from './format/index.js';
export { getState } from './core/state.js';
