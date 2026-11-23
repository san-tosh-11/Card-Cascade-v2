-- Relational design of the data model.
-- The app persists the same shape as JSON (localStorage in the browser, server/data/state.json on the server);
-- these tables + indexes are the production-ready equivalent for SQLite/PostgreSQL.
CREATE TABLE sprints (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  goal TEXT NOT NULL DEFAULT '' CHECK (length(goal) <= 160),
  start_date TEXT NOT NULL, end_date TEXT NOT NULL CHECK (end_date >= start_date),
  is_active INTEGER NOT NULL DEFAULT 1,
  velocity INTEGER                                   -- filled when the sprint is completed
);
CREATE TABLE columns (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, position INTEGER NOT NULL UNIQUE,
  wip_limit INTEGER CHECK (wip_limit IS NULL OR wip_limit BETWEEN 1 AND 100),
  color TEXT NOT NULL, is_done INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE kanban_cards (
  id TEXT PRIMARY KEY,
  sprint_id INTEGER NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  column_id TEXT NOT NULL REFERENCES columns(id),
  position INTEGER NOT NULL,                          -- order inside the column
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
  description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 600),
  story_points INTEGER NOT NULL CHECK (story_points IN (1,2,3,5,8,13)),
  assignee TEXT, tags TEXT, completed_at TEXT
);
CREATE TABLE burndown_data_points (
  sprint_id INTEGER NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  day INTEGER NOT NULL CHECK (day >= 0),
  remaining_points INTEGER NOT NULL CHECK (remaining_points >= 0),
  PRIMARY KEY (sprint_id, day)                        -- one snapshot per sprint day
);

-- Indexes for the hot queries: board rendering (cards of a column in order), per-sprint listing,
-- per-assignee filtering and the paginated card search (GET /api/cards).
CREATE UNIQUE INDEX idx_cards_column_position ON kanban_cards (sprint_id, column_id, position);
CREATE INDEX idx_cards_assignee ON kanban_cards (sprint_id, assignee);
CREATE INDEX idx_cards_completed ON kanban_cards (completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_burndown_sprint ON burndown_data_points (sprint_id, day);
CREATE UNIQUE INDEX idx_sprint_active ON sprints (is_active) WHERE is_active = 1;   -- exactly one active sprint
