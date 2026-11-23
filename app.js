// Express wiring: middleware stack, routes, 404 and the global error handler.
import express from 'express';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as H from './handlers.js';
import { securityHeaders } from './security.js';
import { createRateLimiter } from './rateLimit.js';

export function createApp({ store, logger, seedFn, distDir = null, rateLimit = { windowMs: 60_000, max: 300 } }) {
  const app = express();
  app.disable('x-powered-by');

  // request id + access log (method, path, status, duration)
  app.use((req, res, next) => {
    req.id = randomUUID().slice(0, 8);
    res.setHeader('X-Request-Id', req.id);
    const start = Date.now();
    res.on('finish', () => {
      if (req.path.startsWith('/api')) logger.info('request', { id: req.id, method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start });
    });
    next();
  });
  app.use(securityHeaders);
  app.use('/api', createRateLimiter(rateLimit));
  app.use(express.json({ limit: '1mb' }));

  const send = (res, r) => res.status(r.status).json(r.body);

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/state', (req, res) => send(res, H.getState(store)));
  app.put('/api/state', (req, res) => send(res, H.putState(store, logger, req.body)));
  app.get('/api/burndown', (req, res) => send(res, H.getBurndown(store)));
  app.get('/api/forecast', (req, res) => send(res, H.getForecast(store)));
  app.get('/api/wip', (req, res) => send(res, H.getWip(store)));
  app.get('/api/cards', (req, res) => send(res, H.listCards(store, req.query)));
  app.post('/api/cards/:id/move', (req, res) => send(res, H.moveCard(store, logger, req.params.id, req.body)));
  app.post('/api/reset', (req, res) => send(res, H.reset(store, logger, seedFn)));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  if (distDir && fs.existsSync(distDir)) app.use(express.static(distDir)); // production: serve the built React app

  // global error handler: never leak stack traces to the client
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed JSON body' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
    logger.error('Unhandled error', { id: req.id, path: req.path, error: err.message });
    res.status(500).json({ error: 'Internal server error', requestId: req.id });
  });

  return app;
}
