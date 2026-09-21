PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS controllers (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  area TEXT NOT NULL DEFAULT 'Body Shop',
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS status_items (
  id INTEGER PRIMARY KEY,
  controller_id INTEGER NOT NULL REFERENCES controllers(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL UNIQUE,
  station TEXT NOT NULL,
  function_detail TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  milestone TEXT NOT NULL DEFAULT '',
  criticality TEXT NOT NULL DEFAULT 'Medium' CHECK (criticality IN ('Low', 'Medium', 'High', 'Critical')),
  responsible TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Not started' CHECK (status IN ('Not started', 'Ready to test', 'In progress', 'Blocked', 'NOK / Rework', 'Retest required', 'Done', 'N/A')),
  checked_by TEXT NOT NULL DEFAULT '',
  checked_on TEXT,
  environment TEXT NOT NULL DEFAULT 'Factory',
  current_note TEXT NOT NULL DEFAULT '',
  evidence_link TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  controller_id INTEGER NOT NULL REFERENCES controllers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  station TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  owner TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'To do' CHECK (status IN ('To do', 'In progress', 'Done')),
  due_date TEXT,
  linked_test_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS open_points (
  id INTEGER PRIMARY KEY,
  controller_id INTEGER NOT NULL REFERENCES controllers(id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  impact TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  owner TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Waiting', 'In progress', 'Closed')),
  waiting_for TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  linked_test_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS daily_notes (
  id INTEGER PRIMARY KEY,
  controller_id INTEGER REFERENCES controllers(id) ON DELETE SET NULL,
  note_date TEXT NOT NULL,
  shift TEXT NOT NULL DEFAULT 'Shift 1' CHECK (shift IN ('Shift 1', 'Shift 2', 'Shift 3', 'General')),
  author TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Progress' CHECK (type IN ('Progress', 'Problem', 'Decision', 'Plan')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE INDEX IF NOT EXISTS idx_status_controller_status
ON status_items(controller_id, status);

CREATE INDEX IF NOT EXISTS idx_tasks_controller_status
ON tasks(controller_id, status);

CREATE INDEX IF NOT EXISTS idx_open_points_controller_status
ON open_points(controller_id, status);

CREATE INDEX IF NOT EXISTS idx_daily_notes_controller_date
ON daily_notes(controller_id, note_date DESC);

PRAGMA optimize;
