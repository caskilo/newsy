/**
 * Newsy IDB — IndexedDB persistence layer for client-side state.
 *
 * Database: newsy_idb (version 1)
 * Object Stores:
 *   sources   — keyPath: "id"   (SourceRecord objects)
 *   meta      — keyPath: "key"  (arbitrary k/v config)
 *
 * All methods return Promises. If IndexedDB is unavailable,
 * operations fall back silently to in-memory maps.
 */

const DB_NAME = 'newsy_idb';
const DB_VERSION = 1;

let dbInstance = null;
const memFallback = { sources: new Map(), meta: new Map() };
let usingFallback = false;

function open() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      console.warn('[idb] IndexedDB unavailable — using in-memory fallback');
      usingFallback = true;
      return resolve(null);
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('sources')) {
        db.createObjectStore('sources', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };

    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      resolve(dbInstance);
    };

    req.onerror = (e) => {
      console.warn('[idb] Failed to open — using in-memory fallback', e.target.error);
      usingFallback = true;
      resolve(null);
    };
  });
}

// --- Generic store helpers ---

function tx(storeName, mode = 'readonly') {
  const t = dbInstance.transaction(storeName, mode);
  return t.objectStore(storeName);
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// --- Sources ---

async function getAllSources() {
  await open();
  if (usingFallback) return [...memFallback.sources.values()];
  return reqToPromise(tx('sources').getAll());
}

async function getSource(id) {
  await open();
  if (usingFallback) return memFallback.sources.get(id) || null;
  return reqToPromise(tx('sources').get(id));
}

async function putSource(source) {
  await open();
  if (usingFallback) { memFallback.sources.set(source.id, source); return source; }
  return reqToPromise(tx('sources', 'readwrite').put(source));
}

async function putAllSources(sources) {
  await open();
  if (usingFallback) {
    memFallback.sources.clear();
    for (const s of sources) memFallback.sources.set(s.id, s);
    return;
  }
  const store = tx('sources', 'readwrite');
  await reqToPromise(store.clear());
  for (const s of sources) store.put(s);
  return new Promise((resolve, reject) => {
    store.transaction.oncomplete = () => resolve();
    store.transaction.onerror = () => reject(store.transaction.error);
  });
}

async function deleteSource(id) {
  await open();
  if (usingFallback) { memFallback.sources.delete(id); return; }
  return reqToPromise(tx('sources', 'readwrite').delete(id));
}

// --- Meta (key/value) ---

async function getMeta(key) {
  await open();
  if (usingFallback) return memFallback.meta.get(key) ?? null;
  const row = await reqToPromise(tx('meta').get(key));
  return row ? row.value : null;
}

async function setMeta(key, value) {
  await open();
  if (usingFallback) { memFallback.meta.set(key, value); return; }
  return reqToPromise(tx('meta', 'readwrite').put({ key, value }));
}

// --- Config export / import ---

async function exportConfig() {
  const sources = await getAllSources();
  const configName = await getMeta('configName') || 'newsy-sources';
  return {
    configName,
    exportedAt: new Date().toISOString(),
    version: 1,
    sources,
  };
}

async function importConfig(configObj) {
  if (!configObj || !Array.isArray(configObj.sources)) {
    throw new Error('Invalid config: missing sources array');
  }
  await putAllSources(configObj.sources);
  if (configObj.configName) {
    await setMeta('configName', configObj.configName);
  }
  return configObj.sources.length;
}

// --- Brief cache ---

async function getCachedBrief() {
  const raw = await getMeta('cachedBrief');
  return raw ? raw : null;
}

async function setCachedBrief(brief) {
  await setMeta('cachedBrief', { brief, cachedAt: Date.now() });
}

// --- Public API ---

window.newsyIdb = {
  open,
  getAllSources,
  getSource,
  putSource,
  putAllSources,
  deleteSource,
  getMeta,
  setMeta,
  exportConfig,
  importConfig,
  getCachedBrief,
  setCachedBrief,
};
