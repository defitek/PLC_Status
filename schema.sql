PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','moderator','user')),
  system_role TEXT NOT NULL DEFAULT 'user' CHECK(system_role IN ('system_admin','user')),
  theme TEXT NOT NULL DEFAULT 'blue',
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS project_memberships (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('project_admin','moderator','user')),
  active INTEGER NOT NULL DEFAULT 1,
  planner_enabled INTEGER NOT NULL DEFAULT 1,
  summary_area_source TEXT NOT NULL DEFAULT 'configuration' CHECK(summary_area_source IN ('configuration','planner')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(project_id,user_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS controller_groups (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES controller_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(project_id,parent_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS controllers (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES controller_groups(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  leaf_code TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT 'Body Shop',
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,code)
) STRICT;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(project_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS subcategories (
  id INTEGER PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_function TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(category_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS task_categories (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(project_id,name)
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
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(project_id,kind,value)
) STRICT;

CREATE TABLE IF NOT EXISTS settings (
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY(project_id,key)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS function_groups (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  controller_id INTEGER NOT NULL REFERENCES controllers(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(controller_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS function_group_elements (
  id INTEGER PRIMARY KEY,
  function_group_id INTEGER NOT NULL REFERENCES function_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(function_group_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS function_group_subcategories (
  id INTEGER PRIMARY KEY,
  function_group_id INTEGER NOT NULL REFERENCES function_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(function_group_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS function_group_checks (
  id INTEGER PRIMARY KEY,
  function_group_id INTEGER NOT NULL REFERENCES function_groups(id) ON DELETE CASCADE,
  element_id INTEGER REFERENCES function_group_elements(id) ON DELETE SET NULL,
  group_subcategory_id INTEGER REFERENCES function_group_subcategories(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  criticality TEXT NOT NULL DEFAULT 'Medium',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS function_group_check_subcategories (
  check_id INTEGER NOT NULL REFERENCES function_group_checks(id) ON DELETE CASCADE,
  subcategory_id INTEGER NOT NULL REFERENCES subcategories(id) ON DELETE CASCADE,
  PRIMARY KEY(check_id,subcategory_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS status_items (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
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
  function_group_id INTEGER REFERENCES function_groups(id) ON DELETE SET NULL,
  function_group_element_id INTEGER REFERENCES function_group_elements(id) ON DELETE SET NULL,
  function_group_subcategory_id INTEGER REFERENCES function_group_subcategories(id) ON DELETE SET NULL,
  function_group_check_id INTEGER REFERENCES function_group_checks(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  controller_id INTEGER NOT NULL REFERENCES controllers(id) ON DELETE CASCADE,
  controller_group_id INTEGER REFERENCES controller_groups(id) ON DELETE SET NULL,
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
  function_group_id INTEGER REFERENCES function_groups(id) ON DELETE SET NULL,
  function_group_element_id INTEGER REFERENCES function_group_elements(id) ON DELETE SET NULL,
  other_object TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS task_checklist (
  id INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  weight REAL NOT NULL DEFAULT 1 CHECK(weight > 0),
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE IF NOT EXISTS task_scope_checklist (
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  controller_id INTEGER NOT NULL REFERENCES controllers(id) ON DELETE CASCADE,
  done INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(task_id,controller_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS task_assignees (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_directly INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(task_id,user_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS status_assignees (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status_id INTEGER NOT NULL REFERENCES status_items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(status_id,user_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS open_points (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
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
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  controller_id INTEGER REFERENCES controllers(id) ON DELETE SET NULL,
  controller_group_id INTEGER REFERENCES controller_groups(id) ON DELETE SET NULL,
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
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  controller_id INTEGER REFERENCES controllers(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',
  priority TEXT NOT NULL DEFAULT 'Medium',
  due_date TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS goal_links (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point')),
  entity_id INTEGER NOT NULL,
  UNIQUE(goal_id,entity_type,entity_id)
) STRICT;

CREATE TABLE IF NOT EXISTS entity_mentions (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','note')),
  entity_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(entity_type,entity_id,user_id)
) STRICT;

CREATE TABLE IF NOT EXISTS entity_links (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK(source_type IN ('status','task','point','note','goal')),
  source_id INTEGER NOT NULL,
  target_type TEXT NOT NULL CHECK(target_type IN ('status','task','point','note','goal')),
  target_id INTEGER NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,source_type,source_id,target_type,target_id)
) STRICT;

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('create','update','delete','migrate')),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changes_json TEXT NOT NULL DEFAULT '{}',
  snapshot_json TEXT NOT NULL DEFAULT '{}'
) STRICT;

CREATE TABLE IF NOT EXISTS export_templates (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  detail_level TEXT NOT NULL DEFAULT 'detailed',
  columns_json TEXT NOT NULL DEFAULT '[]',
  filters_json TEXT NOT NULL DEFAULT '{}',
  sort_key TEXT NOT NULL DEFAULT '',
  sort_direction TEXT NOT NULL DEFAULT 'asc',
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS project_sequences (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  next_value INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(project_id,entity_type)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS project_user_areas (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  controller_group_id INTEGER NOT NULL REFERENCES controller_groups(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(project_id,user_id,controller_group_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS planner_entries (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date TEXT NOT NULL,
  shift TEXT NOT NULL DEFAULT 'Dzień',
  controller_group_id INTEGER REFERENCES controller_groups(id) ON DELETE CASCADE,
  work_mode TEXT NOT NULL DEFAULT 'online' CHECK(work_mode IN ('online','offline')),
  transport_mode TEXT NOT NULL DEFAULT 'none' CHECK(transport_mode IN ('none','transport_work','transport_only')),
  note TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS planner_requirements (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  controller_group_id INTEGER NOT NULL REFERENCES controller_groups(id) ON DELETE CASCADE,
  plan_date TEXT NOT NULL,
  work_mode TEXT NOT NULL CHECK(work_mode IN ('online','offline')),
  required_count INTEGER NOT NULL DEFAULT 0 CHECK(required_count >= 0),
  note TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,controller_group_id,plan_date,work_mode)
) STRICT;

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  info_link TEXT NOT NULL DEFAULT '',
  importance TEXT NOT NULL DEFAULT 'Normalna',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS announcement_labels (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  color TEXT NOT NULL DEFAULT 'blue',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(project_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS announcement_label_links (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES announcement_labels(id) ON DELETE CASCADE,
  PRIMARY KEY(announcement_id,label_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS announcement_scopes (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  controller_group_id INTEGER NOT NULL REFERENCES controller_groups(id) ON DELETE CASCADE,
  PRIMARY KEY(announcement_id,controller_group_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS announcement_users (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY(announcement_id,user_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS announcement_links (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','note','goal')),
  entity_id INTEGER NOT NULL,
  PRIMARY KEY(announcement_id,entity_type,entity_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS announcement_reads (
  announcement_id INTEGER NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(announcement_id,user_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS entity_comments (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','goal')),
  entity_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('assignment','announcement','comment')),
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','goal','announcement')),
  entity_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS completion_requirements (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  UNIQUE(project_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS entity_requirements (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point')),
  entity_id INTEGER NOT NULL,
  requirement_id INTEGER NOT NULL REFERENCES completion_requirements(id) ON DELETE CASCADE,
  PRIMARY KEY(entity_type,entity_id,requirement_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS planner_holidays (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  holiday_date TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,holiday_date)
) STRICT;

CREATE TABLE IF NOT EXISTS planner_absences (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_date TEXT NOT NULL,
  absence_type TEXT NOT NULL CHECK(absence_type IN ('time_off','vacation')),
  note TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,user_id,absence_date)
) STRICT;

CREATE TABLE IF NOT EXISTS planner_time_adjustments (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_date TEXT NOT NULL,
  actual_hours_adjustment REAL NOT NULL DEFAULT 0,
  overtime_raw_adjustment REAL NOT NULL DEFAULT 0,
  overtime_weighted_adjustment REAL NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(project_id,user_id,plan_date)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS calendar_item_dates (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','note','goal')),
  entity_id INTEGER NOT NULL,
  calendar_date TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,entity_type,entity_id,calendar_date)
) STRICT;

CREATE TABLE IF NOT EXISTS calendar_annotations (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  controller_id INTEGER REFERENCES controllers(id) ON DELETE SET NULL,
  assigned_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE INDEX IF NOT EXISTS idx_status_controller_status ON status_items(controller_id,status);
CREATE INDEX IF NOT EXISTS idx_controller_groups_project ON controller_groups(project_id,parent_id,sort_order);
CREATE INDEX IF NOT EXISTS idx_function_groups_controller ON function_groups(controller_id,sort_order);
CREATE INDEX IF NOT EXISTS idx_function_group_subcategories ON function_group_subcategories(function_group_id,sort_order);
CREATE INDEX IF NOT EXISTS idx_function_checks_group ON function_group_checks(function_group_id,sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_controller_status ON tasks(controller_id,status);
CREATE INDEX IF NOT EXISTS idx_points_controller_status ON open_points(controller_id,status);
CREATE INDEX IF NOT EXISTS idx_notes_controller_date ON daily_notes(controller_id,note_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type,entity_id,changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id,changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON entity_mentions(user_id,entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_links_source ON entity_links(project_id,source_type,source_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target ON entity_links(project_id,target_type,target_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(project_id,user_id,task_id);
CREATE INDEX IF NOT EXISTS idx_status_assignees_user ON status_assignees(project_id,user_id,status_id);
CREATE INDEX IF NOT EXISTS idx_project_user_areas_user ON project_user_areas(project_id,user_id);
CREATE INDEX IF NOT EXISTS idx_planner_project_date ON planner_entries(project_id,plan_date,user_id);
CREATE INDEX IF NOT EXISTS idx_planner_requirements_date ON planner_requirements(project_id,plan_date,controller_group_id);
CREATE INDEX IF NOT EXISTS idx_announcements_project ON announcements(project_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_labels_project ON announcement_labels(project_id,sort_order,name);
CREATE INDEX IF NOT EXISTS idx_calendar_annotations_date ON calendar_annotations(project_id,start_date,end_date);
CREATE INDEX IF NOT EXISTS idx_calendar_item_dates ON calendar_item_dates(project_id,calendar_date,entity_type);
CREATE INDEX IF NOT EXISTS idx_comments_entity ON entity_comments(project_id,entity_type,entity_id,created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(project_id,user_id,read_at,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_requirements_entity ON entity_requirements(project_id,entity_type,entity_id);
CREATE INDEX IF NOT EXISTS idx_planner_holidays_date ON planner_holidays(project_id,holiday_date);
CREATE INDEX IF NOT EXISTS idx_planner_absences_date ON planner_absences(project_id,absence_date,user_id);
CREATE INDEX IF NOT EXISTS idx_planner_time_adjustments_date ON planner_time_adjustments(project_id,plan_date,user_id);
