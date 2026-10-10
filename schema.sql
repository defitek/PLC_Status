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
  assignable INTEGER NOT NULL DEFAULT 1,
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
  title TEXT NOT NULL DEFAULT '',
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
  entry_type TEXT NOT NULL DEFAULT 'message' CHECK(entry_type IN ('message','decision','scope_change')),
  rationale TEXT NOT NULL DEFAULT '',
  effective_date TEXT,
  decision_status TEXT NOT NULL DEFAULT 'published' CHECK(decision_status IN ('draft','published','implemented','superseded')),
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
  kind TEXT NOT NULL CHECK(kind IN ('assignment','announcement','comment','handover','automation')),
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','goal','announcement','handover')),
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
  requires_evidence INTEGER NOT NULL DEFAULT 0,
  requires_second_approval INTEGER NOT NULL DEFAULT 0,
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
  work_start_time TEXT,
  work_end_time TEXT,
  overtime_raw_balance_override REAL,
  overtime_weighted_balance_override REAL,
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

CREATE TABLE IF NOT EXISTS saved_views (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module TEXT NOT NULL CHECK(module IN ('status','tasks','points','operations')),
  name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'personal' CHECK(visibility IN ('personal','team')),
  config_json TEXT NOT NULL DEFAULT '{}',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,owner_user_id,module,name)
) STRICT;

CREATE TABLE IF NOT EXISTS task_dependencies (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  prerequisite_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  lag_days INTEGER NOT NULL DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(task_id,prerequisite_task_id),
  CHECK(task_id!=prerequisite_task_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS entity_dependencies (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  dependent_type TEXT NOT NULL CHECK(dependent_type IN ('status','task','point')),
  dependent_id INTEGER NOT NULL,
  prerequisite_type TEXT NOT NULL CHECK(prerequisite_type IN ('status','task','point')),
  prerequisite_id INTEGER NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(dependent_type,dependent_id,prerequisite_type,prerequisite_id),
  CHECK(dependent_type!=prerequisite_type OR dependent_id!=prerequisite_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS shift_handovers (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  handover_date TEXT NOT NULL,
  from_shift TEXT NOT NULL,
  to_shift TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','accepted')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  accepted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS shift_handover_items (
  handover_id INTEGER NOT NULL REFERENCES shift_handovers(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','goal','note')),
  entity_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(handover_id,entity_type,entity_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS automation_rules (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('overdue','due_soon','reminder_due','unassigned','blocked')),
  entity_types_json TEXT NOT NULL DEFAULT '[]',
  days_offset INTEGER NOT NULL DEFAULT 0,
  action_type TEXT NOT NULL CHECK(action_type IN ('notify_assignees','notify_managers','escalate_priority')),
  target_priority TEXT NOT NULL DEFAULT 'High',
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_run_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS automation_rule_hits (
  rule_id INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id INTEGER NOT NULL,
  hit_key TEXT NOT NULL,
  executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(rule_id,entity_type,entity_id,hit_key)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS commissioning_templates (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL COLLATE NOCASE,
  description TEXT NOT NULL DEFAULT '',
  template_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,name)
) STRICT;

CREATE TABLE IF NOT EXISTS daily_note_sections (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  note_id INTEGER NOT NULL REFERENCES daily_notes(id) ON DELETE CASCADE,
  information_type TEXT NOT NULL DEFAULT 'Aktualizacja',
  content TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS monthly_employee_reviews (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  reviewer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK(review_status IN ('draft','approved','locked')),
  delivery_score INTEGER NOT NULL DEFAULT 3 CHECK(delivery_score BETWEEN 1 AND 5),
  quality_score INTEGER NOT NULL DEFAULT 3 CHECK(quality_score BETWEEN 1 AND 5),
  timeliness_score INTEGER NOT NULL DEFAULT 3 CHECK(timeliness_score BETWEEN 1 AND 5),
  communication_score INTEGER NOT NULL DEFAULT 3 CHECK(communication_score BETWEEN 1 AND 5),
  collaboration_score INTEGER NOT NULL DEFAULT 3 CHECK(collaboration_score BETWEEN 1 AND 5),
  overall_score REAL NOT NULL DEFAULT 0,
  manager_summary TEXT NOT NULL DEFAULT '',
  strengths TEXT NOT NULL DEFAULT '',
  improvement_areas TEXT NOT NULL DEFAULT '',
  development_plan TEXT NOT NULL DEFAULT '',
  snapshot_json TEXT NOT NULL DEFAULT '{}',
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  locked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  locked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id,user_id,period)
) STRICT;

CREATE TABLE IF NOT EXISTS monthly_employee_review_items (
  id INTEGER PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES monthly_employee_reviews(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('task','status','point','note','campaign')),
  entity_id INTEGER NOT NULL,
  title_snapshot TEXT NOT NULL,
  scope_snapshot TEXT NOT NULL DEFAULT '',
  role_snapshot TEXT NOT NULL DEFAULT '',
  completed_at TEXT,
  difficulty INTEGER NOT NULL DEFAULT 3 CHECK(difficulty BETWEEN 1 AND 5),
  effort INTEGER NOT NULL DEFAULT 3 CHECK(effort BETWEEN 1 AND 5),
  impact INTEGER NOT NULL DEFAULT 3 CHECK(impact BETWEEN 1 AND 5),
  quality INTEGER NOT NULL DEFAULT 3 CHECK(quality BETWEEN 1 AND 5),
  contribution_share INTEGER NOT NULL DEFAULT 100 CHECK(contribution_share BETWEEN 0 AND 100),
  excluded INTEGER NOT NULL DEFAULT 0,
  reviewer_note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(review_id,entity_type,entity_id)
) STRICT;

CREATE TABLE IF NOT EXISTS monthly_employee_review_audit (
  id INTEGER PRIMARY KEY,
  review_id INTEGER NOT NULL REFERENCES monthly_employee_reviews(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  changes_json TEXT NOT NULL DEFAULT '{}',
  changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS daily_note_section_scopes (
  section_id INTEGER NOT NULL REFERENCES daily_note_sections(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK(scope_type IN ('project','group','controller')),
  scope_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(section_id,scope_type,scope_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS daily_note_section_links (
  section_id INTEGER NOT NULL REFERENCES daily_note_sections(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','goal','note')),
  entity_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(section_id,entity_type,entity_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS test_campaigns (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  campaign_type TEXT NOT NULL DEFAULT 'Functional test',
  model TEXT NOT NULL DEFAULT '',
  shift TEXT NOT NULL DEFAULT 'Dzień',
  scope_type TEXT NOT NULL DEFAULT 'project' CHECK(scope_type IN ('project','group','controller')),
  scope_id INTEGER NOT NULL DEFAULT 0,
  planned_start TEXT,
  planned_end TEXT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','completed','cancelled')),
  description TEXT NOT NULL DEFAULT '',
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS test_campaign_items (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES test_campaigns(id) ON DELETE CASCADE,
  status_item_id INTEGER NOT NULL REFERENCES status_items(id) ON DELETE CASCADE,
  result TEXT NOT NULL DEFAULT 'pending' CHECK(result IN ('pending','pass','fail','skipped')),
  note TEXT NOT NULL DEFAULT '',
  evidence_link TEXT NOT NULL DEFAULT '',
  retest_number INTEGER NOT NULL DEFAULT 0,
  tested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tested_at TEXT,
  created_point_id INTEGER REFERENCES open_points(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(campaign_id,status_item_id)
) STRICT;

CREATE TABLE IF NOT EXISTS readiness_gates (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  stage_order INTEGER NOT NULL DEFAULT 0,
  scope_type TEXT NOT NULL DEFAULT 'project' CHECK(scope_type IN ('project','group','controller')),
  scope_id INTEGER NOT NULL DEFAULT 0,
  criteria_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','ready','approved','overridden')),
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  override_reason TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS project_meetings (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  meeting_date TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),
  summary TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  closed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS project_meeting_items (
  id INTEGER PRIMARY KEY,
  meeting_id INTEGER NOT NULL REFERENCES project_meetings(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','goal','note')),
  entity_id INTEGER NOT NULL,
  decision TEXT NOT NULL DEFAULT '',
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date TEXT,
  item_status TEXT NOT NULL DEFAULT 'open' CHECK(item_status IN ('open','decided','deferred')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(meeting_id,entity_type,entity_id)
) STRICT;

CREATE TABLE IF NOT EXISTS entity_requirement_status (
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point')),
  entity_id INTEGER NOT NULL,
  requirement_id INTEGER NOT NULL REFERENCES completion_requirements(id) ON DELETE CASCADE,
  evidence TEXT NOT NULL DEFAULT '',
  completed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_at TEXT,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approved_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(entity_type,entity_id,requirement_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS external_dependencies (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','goal')),
  entity_id INTEGER NOT NULL,
  party TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  dependency_status TEXT NOT NULL DEFAULT 'waiting' CHECK(dependency_status IN ('waiting','responded','resolved')),
  requested_at TEXT NOT NULL,
  expected_date TEXT,
  next_followup TEXT,
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;

CREATE TABLE IF NOT EXISTS knowledge_articles (
  id INTEGER PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  problem TEXT NOT NULL,
  solution TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  source_entity_type TEXT NOT NULL DEFAULT '',
  source_entity_id INTEGER,
  status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft','published','archived')),
  use_count INTEGER NOT NULL DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_saved_views_owner ON saved_views(project_id,module,visibility,owner_user_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(project_id,task_id,prerequisite_task_id);
CREATE INDEX IF NOT EXISTS idx_entity_dependencies_dependent ON entity_dependencies(project_id,dependent_type,dependent_id);
CREATE INDEX IF NOT EXISTS idx_entity_dependencies_prerequisite ON entity_dependencies(project_id,prerequisite_type,prerequisite_id);
CREATE INDEX IF NOT EXISTS idx_handovers_date ON shift_handovers(project_id,handover_date,status);
CREATE INDEX IF NOT EXISTS idx_automation_rules_project ON automation_rules(project_id,active,trigger_type);
CREATE INDEX IF NOT EXISTS idx_templates_project ON commissioning_templates(project_id,active,name);
CREATE INDEX IF NOT EXISTS idx_note_sections_note ON daily_note_sections(note_id,sort_order);
CREATE INDEX IF NOT EXISTS idx_monthly_reviews_project_period ON monthly_employee_reviews(project_id,period,user_id);
CREATE INDEX IF NOT EXISTS idx_monthly_review_items_review ON monthly_employee_review_items(review_id,sort_order,id);
CREATE INDEX IF NOT EXISTS idx_monthly_review_audit_review ON monthly_employee_review_audit(review_id,changed_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_campaigns_project ON test_campaigns(project_id,status,planned_start);
CREATE INDEX IF NOT EXISTS idx_campaign_items_campaign ON test_campaign_items(campaign_id,result,sort_order);
CREATE INDEX IF NOT EXISTS idx_readiness_gates_project ON readiness_gates(project_id,stage_order,scope_type,scope_id);
CREATE INDEX IF NOT EXISTS idx_meetings_project ON project_meetings(project_id,meeting_date DESC);
CREATE INDEX IF NOT EXISTS idx_requirement_status_entity ON entity_requirement_status(project_id,entity_type,entity_id);
CREATE INDEX IF NOT EXISTS idx_external_dependencies_entity ON external_dependencies(project_id,entity_type,entity_id,dependency_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_articles(project_id,status,category);
