import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import xtreamHandler from './api/xtream.js';
import proxyHandler from './api/proxy.js';
import artworkHandler from './api/artwork.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Simple health check for Render.
app.get('/health', (_req, res) => {
  res.status(200).json({ ok: true, service: 'NeoPlayer' });
});

// Keep the existing API handlers. They already use the req/res contract
// expected by Express, so the same playback/Xtream logic can run on Render.
app.use('/api/xtream', (req, res) => xtreamHandler(req, res));
app.use('/api/proxy', (req, res) => proxyHandler(req, res));
app.use('/api/playlist', (req, res) => proxyHandler(req, res));
app.use('/api/artwork', (req, res) => artworkHandler(req, res));

// Vite production build.
const distDir = path.join(__dirname, 'dist');
app.use(express.static(distDir, {
  index: 'index.html',
  maxAge: '1h',
  etag: true,
}));

// SPA fallback. API requests that reach here are returned as 404 instead
// of accidentally receiving index.html.
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found.' });
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }
  return res.sendFile(path.join(distDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('[NeoPlayer]', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`NeoPlayer running on 0.0.0.0:${PORT}`);
});
