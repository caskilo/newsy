/**
 * Source management for the server.
 * Loads defaults, supports full CRUD + test result storage.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { DEFAULT_SOURCES, SOURCE_CATEGORIES } from '../src/config/sources.default.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const SOURCES_FILE = path.join(DATA_DIR, 'sources.local.json');

function loadPersistedSources() {
  try {
    if (existsSync(SOURCES_FILE)) {
      const raw = readFileSync(SOURCES_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn(`[sources] Failed to read persisted sources: ${err.message}`);
  }
  return null;
}

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function persistSources() {
  try {
    ensureDataDir();
    writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2), 'utf-8');
  } catch (err) {
    console.warn(`[sources] Failed to persist sources: ${err.message}`);
  }
}

const initialSources = loadPersistedSources();
let sources = (initialSources || DEFAULT_SOURCES).map(s => ({ ...s }));

if (!initialSources) {
  persistSources();
}

export function getSources() {
  return sources.filter(s => s.enabled);
}

export function getAllSources() {
  return sources;
}

export function getSource(sourceId) {
  return sources.find(s => s.id === sourceId) || null;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function addSource(source) {
  if (!source.name || !source.rssUrl) {
    throw new Error('Source must have name and rssUrl');
  }
  const id = source.id || slugify(source.name);
  if (sources.some(s => s.id === id)) {
    throw new Error(`Source with id '${id}' already exists`);
  }
  const record = {
    id,
    name: source.name,
    rssUrl: source.rssUrl,
    enabled: source.enabled !== undefined ? source.enabled : false,
    fetchIntervalMin: source.fetchIntervalMin || 30,
    country: source.country || 'international',
    category: source.category || 'news',
    language: source.language || 'en',
    lastTestResult: null,
  };
  sources.push(record);
  persistSources();
  return record;
}

export function updateSource(sourceId, updates) {
  const source = sources.find(s => s.id === sourceId);
  if (!source) throw new Error(`Source '${sourceId}' not found`);
  const allowed = ['name', 'rssUrl', 'enabled', 'fetchIntervalMin', 'country', 'category', 'language'];
  for (const key of allowed) {
    if (updates[key] !== undefined) source[key] = updates[key];
  }
  persistSources();
  return source;
}

export function toggleSource(sourceId) {
  const source = sources.find(s => s.id === sourceId);
  if (!source) throw new Error(`Source '${sourceId}' not found`);
  source.enabled = !source.enabled;
  persistSources();
  return source;
}

export function removeSource(sourceId) {
  const idx = sources.findIndex(s => s.id === sourceId);
  if (idx === -1) throw new Error(`Source '${sourceId}' not found`);
  const removed = sources.splice(idx, 1)[0];
  persistSources();
  return removed;
}

export function setTestResult(sourceId, result) {
  const source = sources.find(s => s.id === sourceId);
  if (source) {
    source.lastTestResult = result;
    persistSources();
  }
}

export { SOURCE_CATEGORIES };
