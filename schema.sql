PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','moderator','user')),
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS controllers (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  area TEXT NOT NULL DEFAULT 'Body Shop',
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
) STRICT;

CREATE TABLE IF NOT EXISTS subcategories (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(category_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS task_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
) STRICT;

CREATE TABLE IF NOT EXISTS task_subcategories (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES task_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(category_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS options (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(kind,value)
) STRICT;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS status_items (
  id INTEGER PRIMARY KEY,
  controller_id INTEGER NOT NULL REFERENCES controllers(id) ON DELETE CASCADE,
  test_id TEXT NOT NULL UNIQUE,
  station TEXT NOT NULL,
  function_detail TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  subcategory TEXT NOT NULL DEFAULT '',
  milestone TEXT NOT NULL DEFAULT '',
  criticality TEXT NOT NULL DEFAULT 'Medium',
  responsible TEXT NOT NULL DEFAULT '',
  responsible_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Not started',
  checked_by TEXT NOT NULL DEFAULT '',
  checked_on TEXT,
  environment TEXT NOT NULL DEFAULT 'Factory',
  current_note TEXT NOT NULL DEFAULT '',
  evidence_link TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  controller_id INTEGER NOT NULL REFERENCES controllers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  station TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium',
  owner TEXT NOT NULL DEFAULT '',
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'To do',
  start_date TEXT,
  due_date TEXT,
  category TEXT NOT NULL DEFAULT '',
  subcategory TEXT NOT NULL DEFAULT '',
  info_link TEXT NOT NULL DEFAULT '',
  linked_test_id TEXT,
  linked_entity_type TEXT NOT NULL DEFAULT '',
  linked_entity_id INTEGER,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS task_checklist (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE IF NOT EXISTS open_points (
  id INTEGER PRIMARY KEY,
  controller_id INTEGER NOT NULL REFERENCES controllers(id) ON DELETE CASCADE,
  issue_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  impact TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Medium',
  owner TEXT NOT NULL DEFAULT '',
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'Open',
  waiting_for TEXT NOT NULL DEFAULT '',
  next_action TEXT NOT NULL DEFAULT '',
  start_date TEXT,
  due_date TEXT,
  reminder_date TEXT,
  category TEXT NOT NULL DEFAULT '',
  subcategory TEXT NOT NULL DEFAULT '',
  info_link TEXT NOT NULL DEFAULT '',
  linked_test_id TEXT,
  linked_entity_type TEXT NOT NULL DEFAULT '',
  linked_entity_id INTEGER,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS daily_notes (
  id INTEGER PRIMARY KEY,
  controller_id INTEGER REFERENCES controllers(id) ON DELETE SET NULL,
  note_date TEXT NOT NULL,
  shift TEXT NOT NULL DEFAULT 'Dzień',
  author TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Postęp',
  content TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  linked_task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  linked_status_id INTEGER REFERENCES status_items(id) ON DELETE SET NULL,
  linked_point_id INTEGER REFERENCES open_points(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY,
  controller_id INTEGER REFERENCES controllers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',
  due_date TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS goal_links (
  id INTEGER PRIMARY KEY,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point')),
  entity_id INTEGER NOT NULL,
  UNIQUE(goal_id,entity_type,entity_id)
) STRICT;

CREATE TABLE IF NOT EXISTS entity_mentions (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','note')),
  entity_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(entity_type,entity_id,user_id)
) STRICT;

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('create','update','delete','migrate')),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changes_json TEXT NOT NULL DEFAULT '{}',
  snapshot_json TEXT NOT NULL DEFAULT '{}'
) STRICT;

CREATE INDEX IF NOT EXISTS idx_status_controller_status ON status_items(controller_id,status);
CREATE INDEX IF NOT EXISTS idx_tasks_controller_status ON tasks(controller_id,status);
CREATE INDEX IF NOT EXISTS idx_points_controller_status ON open_points(controller_id,status);
CREATE INDEX IF NOT EXISTS idx_notes_controller_date ON daily_notes(controller_id,note_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type,entity_id,changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id,changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON entity_mentions(user_id,entity_type);
