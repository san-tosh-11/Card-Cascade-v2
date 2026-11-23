// Framework-independent request handlers: each returns { status, body }.
// Express only wires them to routes (server/app.js), which keeps them unit-testable.
import * as L from '../src/lib/sprintLogic.js';
import { validateState, sanitizeState, validateMovePayload } from '../src/lib/validation.js';

const ok = (body, status = 200) => ({ status, body });
const fail = (status, error, details) => ({ status, body: { error, ...(details ? { details } : {}) } });

export const getState = (store) => ok(store.get());

export function putState(store, logger, body) {
  const v = validateState(body);
  if (!v.ok) {
    logger.warn('PUT /api/state rejected', { errors: v.errors });
    return fail(400, 'Invalid state', v.errors);
  }
  const next = sanitizeState(body);
  store.set(next);
  logger.info('State replaced', { cards: next.cards.length, sprint: next.sprint.name });
  return ok({ ok: true });
}

export const getBurndown = (store) => ok(L.burndown(store.get()));
export const getForecast = (store) => {
  const f = L.forecast(store.get());
  return ok({ rate: f.rate, finishDay: f.finishDay, shortBy: f.shortBy, onTrack: f.onTrack });
};
export const getWip = (store) => {
  const s = store.get();
  return ok(s.columns.map((c) => ({ column: c.id, ...L.wipStatus(s, c.id) })));
};

// Column re-ordering: validates the payload, moves the card, records the burndown snapshot.
export function moveCard(store, logger, cardId, body) {
  const current = store.get();
  const card = current.cards.find((c) => c.id === cardId);
  if (!card) return fail(404, 'Card not found');
  const errors = validateMovePayload(body, current);
  if (errors.length) {
    logger.warn('Move rejected', { cardId, errors });
    return fail(400, 'Invalid move', errors);
  }
  const from = card.colId;
  const next = structuredClone(current);
  L.moveCard(next, cardId, body.colId, body.beforeId || null);
  L.snapshot(next);
  store.set(next);
  const wip = L.wipStatus(next, body.colId);
  logger.info('Card moved', { cardId, from, to: body.colId, wip: `${wip.count}/${wip.limit ?? '-'}`, remaining: L.totals(next).remaining });
  if (wip.status === 'over') logger.warn('WIP limit exceeded', { column: body.colId, count: wip.count, limit: wip.limit });
  return ok({ wip, burndown: L.burndown(next) });
}

// Paginated + filterable card listing (keeps responses small on large boards).
export function listCards(store, query = {}) {
  const page = query.page === undefined ? 1 : Number(query.page);
  const limit = query.limit === undefined ? 50 : Number(query.limit);
  if (!Number.isInteger(page) || page < 1) return fail(400, 'page must be a positive integer');
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return fail(400, 'limit must be between 1 and 200');
  const q = String(query.q || '').trim().toLowerCase().slice(0, 100);
  let items = store.get().cards;
  if (query.colId) items = items.filter((c) => c.colId === String(query.colId));
  if (query.assignee) items = items.filter((c) => c.assignee === String(query.assignee));
  if (q) items = items.filter((c) => [c.id, c.title, c.desc, ...c.tags].join(' ').toLowerCase().includes(q));
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  return ok({ items: items.slice((page - 1) * limit, page * limit), page, limit, total, pages });
}

export function reset(store, logger, seedFn) {
  const s = seedFn();
  L.snapshot(s);
  store.set(s);
  logger.info('State reset to sample data');
  return ok(s);
}
