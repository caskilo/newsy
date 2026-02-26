/**
 * Newsy Server — Express HTTP server.
 * Runs the full pipeline server-side and serves the brief via JSON API.
 * Also serves the client UI as static files.
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  createBriefHandler, getSourcesHandler, getStateHandler,
  addSourceHandler, updateSourceHandler, toggleSourceHandler,
  deleteSourceHandler, testSourceHandler, testFeedHandler,
  testAllSourcesHandler,
} from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use(express.static(join(__dirname, '..', 'client')));

app.get('/api/brief', createBriefHandler);
app.get('/api/state', getStateHandler);

app.get('/api/sources', getSourcesHandler);
app.post('/api/sources', addSourceHandler);
app.post('/api/sources/test-all', testAllSourcesHandler);
app.post('/api/test-feed', testFeedHandler);
app.put('/api/sources/:id', updateSourceHandler);
app.post('/api/sources/:id/toggle', toggleSourceHandler);
app.delete('/api/sources/:id', deleteSourceHandler);
app.post('/api/sources/:id/test', testSourceHandler);

app.listen(PORT, () => {
  console.log(`\n  ╔══════════════════════════════════════╗`);
  console.log(`  ║  newsy v0.1 — cognitive prosthetic   ║`);
  console.log(`  ║  http://localhost:${PORT}                ║`);
  console.log(`  ╚══════════════════════════════════════╝\n`);
});
