// Structured server-side logging (observability): console + optional JSON-lines file.
import fs from 'node:fs';
import path from 'node:path';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

// `sink` lets tests capture entries instead of printing them.
export function createLogger({ level = 'info', file = null, sink = null } = {}) {
  const min = LEVELS[level] ?? LEVELS.info;
  function write(lvl, msg, meta) {
    if (LEVELS[lvl] < min) return;
    const entry = { time: new Date().toISOString(), level: lvl, msg, ...(meta || {}) };
    if (sink) sink(entry);
    else {
      const line = `${entry.time} ${lvl.toUpperCase().padEnd(5)} ${msg}${meta ? ' ' + JSON.stringify(meta) : ''}`;
      (lvl === 'error' ? console.error : lvl === 'warn' ? console.warn : console.log)(line);
    }
    if (file) {
      try {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.appendFileSync(file, JSON.stringify(entry) + '\n');
      } catch (e) { /* logging must never crash the server */ }
    }
  }
  return {
    debug: (m, x) => write('debug', m, x), info: (m, x) => write('info', m, x),
    warn: (m, x) => write('warn', m, x), error: (m, x) => write('error', m, x),
  };
}
