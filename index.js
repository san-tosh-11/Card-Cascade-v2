// Entry point: `node server/index.js`
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { createStore } from './store.js';
import { createLogger } from './logger.js';
import { seed } from '../src/lib/seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4000;
const logger = createLogger({ level: process.env.LOG_LEVEL || 'info', file: path.join(__dirname, 'data', 'server.log') });
const store = createStore({ file: path.join(__dirname, 'data', 'state.json'), seedFn: seed, logger });
const app = createApp({ store, logger, seedFn: seed, distDir: path.join(__dirname, '..', 'dist') });

const server = app.listen(PORT, () => logger.info(`CardCascade API listening on http://localhost:${PORT}`));

process.on('unhandledRejection', (e) => logger.error('Unhandled rejection', { error: String(e) }));
process.on('uncaughtException', (e) => { logger.error('Uncaught exception', { error: e.message }); process.exit(1); });
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { logger.info(`${sig} received, shutting down`); server.close(() => process.exit(0)); });
