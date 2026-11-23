// State store with atomic JSON-file persistence. Data read from disk is validated before use.
import fs from 'node:fs';
import path from 'node:path';
import { validateState, sanitizeState } from '../src/lib/validation.js';
import { snapshot } from '../src/lib/sprintLogic.js';

export function createStore({ file = null, seedFn, logger = null }) {
  function load() {
    if (file) {
      try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        const v = validateState(raw);
        if (v.ok) return sanitizeState(raw);
        logger?.warn('Stored state failed validation, starting from sample data', { errors: v.errors });
      } catch (e) {
        if (e.code !== 'ENOENT') logger?.warn('Could not read state file, starting from sample data', { error: e.message });
      }
    }
    const s = seedFn();
    snapshot(s);
    return s;
  }

  let state = load();

  function persist() {
    if (!file) return;
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2)); // write to a temp file, then rename (atomic)
      fs.renameSync(tmp, file);
    } catch (e) {
      logger?.error('Failed to persist state', { error: e.message });
    }
  }

  persist();
  return { get: () => state, set(next) { state = next; persist(); } };
}
