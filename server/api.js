/**
 * API route handlers — orchestrate the pipeline and return JSON.
 */

import { runPipeline } from './pipeline.js';
import { getSources, getAllSources, addSource, updateSource, toggleSource, removeSource, setTestResult, SOURCE_CATEGORIES } from './sources.js';
import { testFeed, testFeeds } from './feed-tester.js';

let lastBrief = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * GET /api/brief?maxReadTimeMin=15&maxArousalLoad=0.6
 */
export async function createBriefHandler(req, res) {
  try {
    const config = {
      maxReadTimeMin: parseFloat(req.query.maxReadTimeMin) || 15,
      maxArousalLoad: parseFloat(req.query.maxArousalLoad) || 0.6,
      mode: req.query.mode || 'overview',
    };

    const now = Date.now();
    const forceRefresh = req.query.refresh === 'true';

    if (lastBrief && !forceRefresh && (now - lastFetchTime) < CACHE_TTL_MS) {
      return res.json({ ...lastBrief, cached: true });
    }

    console.log('[api] Generating fresh brief...');
    const brief = await runPipeline(config);
    lastBrief = brief;
    lastFetchTime = now;

    res.json({ ...brief, cached: false });
  } catch (err) {
    console.error('[api] Error generating brief:', err);
    res.status(500).json({ error: 'Failed to generate brief', message: err.message });
  }
}

/**
 * GET /api/sources — all sources (enabled and disabled)
 */
export function getSourcesHandler(req, res) {
  res.json({ sources: getAllSources(), categories: SOURCE_CATEGORIES });
}

/**
 * POST /api/sources — add a new source
 */
export function addSourceHandler(req, res) {
  try {
    const source = addSource(req.body);
    res.status(201).json(source);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * PUT /api/sources/:id — update a source
 */
export function updateSourceHandler(req, res) {
  try {
    const source = updateSource(req.params.id, req.body);
    res.json(source);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

/**
 * POST /api/sources/:id/toggle — toggle enabled/disabled
 */
export function toggleSourceHandler(req, res) {
  try {
    const source = toggleSource(req.params.id);
    res.json(source);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

/**
 * DELETE /api/sources/:id — remove a source
 */
export function deleteSourceHandler(req, res) {
  try {
    const removed = removeSource(req.params.id);
    res.json({ removed });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

/**
 * POST /api/sources/:id/test — test a specific source's feed
 */
export async function testSourceHandler(req, res) {
  try {
    const sources = getAllSources();
    const source = sources.find(s => s.id === req.params.id);
    if (!source) return res.status(404).json({ error: 'Source not found' });

    console.log(`[api] Testing feed: ${source.name} (${source.rssUrl})`);
    const result = await testFeed(source.rssUrl);
    setTestResult(source.id, result);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/test-feed — test an arbitrary feed URL
 * Body: { url: "https://..." }
 */
export async function testFeedHandler(req, res) {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  try {
    console.log(`[api] Testing feed URL: ${url}`);
    const result = await testFeed(url);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * POST /api/sources/test-all — test all sources
 */
export async function testAllSourcesHandler(req, res) {
  const sources = getAllSources();
  console.log(`[api] Testing all ${sources.length} sources...`);
  const urls = sources.map(s => s.rssUrl);
  const results = await testFeeds(urls);

  for (let i = 0; i < sources.length; i++) {
    setTestResult(sources[i].id, results[i]);
  }

  res.json({ tested: sources.length, results: sources.map(s => ({
    id: s.id,
    name: s.name,
    verdict: s.lastTestResult?.verdict || 'unknown',
  }))});
}

/**
 * GET /api/state
 */
export function getStateHandler(req, res) {
  res.json({
    version: '0.1.0',
    lastFetchTime,
    hasBrief: !!lastBrief,
    briefAge: lastBrief ? Date.now() - lastBrief.generatedAt : null,
    sourceCount: getSources().length,
    totalSources: getAllSources().length,
  });
}
