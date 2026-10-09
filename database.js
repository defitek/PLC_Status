import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { seedDemoData } from './demo-data.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const TABLES = {
  status: 'status_items',
  task: 'tasks',
  point: 'open_points',
  note: 'daily_notes',
  goal: 'goals'
};
const AUDIT_IGNORED = new Set(['updated_at']);

const clean = value => typeof value === 'string' ? value.trim() : '';
const nullableDate = value => /^\d{4}-\d{2}-\d{2}$/.test(clean(value)) ? clean(value) : null;
const nullableTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(clean(value)) ? clean(value) : null;
const nullableNumber = value => value === '' || value === null || value === undefined || !Number.isFinite(Number(value)) ? null : Number(value);
const asId = value => Number(value) > 0 ? Number(value) : null;
const appError = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const hashPassword = password => {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};

export function verifyPassword(password, storedHash) {
  try {
    const [salt, expectedHex] = storedHash.split(':');
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = scryptSync(password, salt, 64);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function openDatabase(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath, { timeout: 5000 });
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;');
  db.exec(readFileSync(join(moduleDir, 'schema.sql'), 'utf8'));
  migrateToV3(db);
  migrateToV4(db);
  migrateToV5(db);
  migrateToV6(db);
  migrateToV7(db);
  migrateToV8(db);
  migrateToV9(db);
  migrateToV10(db);
  migrateToV11(db);
  migrateToV12(db);
  db.exec('CREATE INDEX IF NOT EXISTS idx_status_function_group ON status_items(function_group_id,function_group_check_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_status_project ON status_items(project_id,controller_id,status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_task_scope_group ON tasks(project_id,controller_group_id,status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_task_scope_checklist ON task_scope_checklist(task_id,sort_order)');
  seedConfiguration(db, 1);
  if (String(process.env.SEED_DEMO_DATA || 'true').toLowerCase() !== 'false') {
    seedDemoData(db, hashPassword, process.env.DEMO_DATA_LIMIT || 100, { projectId: 1, variant: 'main' });
    seedControllerHierarchy(db, 1);
    seedSecondProject(db, hashPassword);
  }
  migrateToV12(db);
  syncProjectMemberships(db);
  backfillV3(db);
  backfillFunctionGroups(db);
  backfillV4Links(db);
  backfillV5(db);
  backfillV6(db);
  backfillV7(db);
  if (String(process.env.SEED_DEMO_DATA || 'true').toLowerCase() !== 'false') { seedV5Demo(db); seedV8Demo(db); }
  seedMigrationAudit(db);
  db.prepare("INSERT INTO app_meta(key,value) VALUES('schema_version','12.0') ON CONFLICT(key) DO UPDATE SET value='12.0'").run();
  return createRepository(db);
}

function columnNames(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
}

function ensureColumn(db, table, name, definition) {
  if (!columnNames(db, table).has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

function migrateToV3(db) {
  const additions = [
    ['users', 'sort_order', 'INTEGER NOT NULL DEFAULT 0'],
    ['controllers', 'sort_order', 'INTEGER NOT NULL DEFAULT 0'],
    ['status_items', 'subcategory', "TEXT NOT NULL DEFAULT ''"],
    ['status_items', 'responsible_user_id', 'INTEGER'],
    ['status_items', 'created_by', 'INTEGER'],
    ['status_items', 'function_group_id', 'INTEGER'],
    ['status_items', 'function_group_check_id', 'INTEGER'],
    ['tasks', 'owner_user_id', 'INTEGER'],
    ['tasks', 'start_date', 'TEXT'],
    ['tasks', 'category', "TEXT NOT NULL DEFAULT ''"],
    ['tasks', 'subcategory', "TEXT NOT NULL DEFAULT ''"],
    ['tasks', 'info_link', "TEXT NOT NULL DEFAULT ''"],
    ['tasks', 'linked_entity_type', "TEXT NOT NULL DEFAULT ''"],
    ['tasks', 'linked_entity_id', 'INTEGER'],
    ['tasks', 'created_by', 'INTEGER'],
    ['open_points', 'owner_user_id', 'INTEGER'],
    ['open_points', 'start_date', 'TEXT'],
    ['open_points', 'reminder_date', 'TEXT'],
    ['open_points', 'category', "TEXT NOT NULL DEFAULT ''"],
    ['open_points', 'subcategory', "TEXT NOT NULL DEFAULT ''"],
    ['open_points', 'info_link', "TEXT NOT NULL DEFAULT ''"],
    ['open_points', 'linked_entity_type', "TEXT NOT NULL DEFAULT ''"],
    ['open_points', 'linked_entity_id', 'INTEGER'],
    ['open_points', 'created_by', 'INTEGER'],
    ['daily_notes', 'created_by', 'INTEGER'],
    ['daily_notes', 'linked_task_id', 'INTEGER'],
    ['daily_notes', 'linked_status_id', 'INTEGER'],
    ['daily_notes', 'linked_point_id', 'INTEGER']
  ];
  for (const addition of additions) ensureColumn(db, ...addition);
}

function migrateToV4(db) {
  db.prepare(`INSERT OR IGNORE INTO projects(id,code,name,description,sort_order)
    VALUES(1,'W371','W371 · Commissioning','Dotychczasowy projekt PLC',0)`).run();

  const usersBefore = columnNames(db, 'users');
  ensureColumn(db, 'users', 'system_role', "TEXT NOT NULL DEFAULT 'user'");
  ensureColumn(db, 'users', 'theme', "TEXT NOT NULL DEFAULT 'blue'");
  if (!usersBefore.has('system_role')) db.exec("UPDATE users SET system_role=CASE WHEN role='admin' THEN 'system_admin' ELSE 'user' END");

  const controllersSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='controllers'").get()?.sql || '';
  const requiresConfigRebuild = !columnNames(db, 'controllers').has('project_id') || !/UNIQUE\s*\(\s*project_id\s*,\s*code\s*\)/i.test(controllersSql);
  if (requiresConfigRebuild) rebuildProjectConfiguration(db);

  const additions = [
    ['subcategories', 'default_function', "TEXT NOT NULL DEFAULT ''"],
    ['function_groups', 'project_id', 'INTEGER NOT NULL DEFAULT 1'],
    ['function_group_checks', 'element_id', 'INTEGER'],
    ['status_items', 'project_id', 'INTEGER NOT NULL DEFAULT 1'],
    ['status_items', 'function_group_element_id', 'INTEGER'],
    ['tasks', 'project_id', 'INTEGER NOT NULL DEFAULT 1'],
    ['tasks', 'function_group_id', 'INTEGER'],
    ['tasks', 'function_group_element_id', 'INTEGER'],
    ['tasks', 'other_object', "TEXT NOT NULL DEFAULT ''"],
    ['open_points', 'project_id', 'INTEGER NOT NULL DEFAULT 1'],
    ['daily_notes', 'project_id', 'INTEGER NOT NULL DEFAULT 1'],
    ['goals', 'project_id', 'INTEGER NOT NULL DEFAULT 1'],
    ['goal_links', 'project_id', 'INTEGER NOT NULL DEFAULT 1'],
    ['entity_mentions', 'project_id', 'INTEGER NOT NULL DEFAULT 1'],
    ['audit_log', 'project_id', 'INTEGER NOT NULL DEFAULT 1']
  ];
  for (const addition of additions) ensureColumn(db, ...addition);

  db.exec(`
    UPDATE function_groups SET project_id=COALESCE((SELECT project_id FROM controllers WHERE id=function_groups.controller_id),1);
    UPDATE status_items SET project_id=COALESCE((SELECT project_id FROM controllers WHERE id=status_items.controller_id),1);
    UPDATE tasks SET project_id=COALESCE((SELECT project_id FROM controllers WHERE id=tasks.controller_id),1);
    UPDATE open_points SET project_id=COALESCE((SELECT project_id FROM controllers WHERE id=open_points.controller_id),1);
    UPDATE daily_notes SET project_id=COALESCE((SELECT project_id FROM controllers WHERE id=daily_notes.controller_id),1);
    UPDATE goals SET project_id=COALESCE((SELECT project_id FROM controllers WHERE id=goals.controller_id),1);
  `);

  const users = db.prepare('SELECT id,role FROM users').all();
  const membership = db.prepare('INSERT OR IGNORE INTO project_memberships(project_id,user_id,role,active) VALUES(?,?,?,1)');
  for (const user of users) membership.run(1, user.id, user.role === 'admin' ? 'project_admin' : user.role);
  seedControllerHierarchy(db, 1);
}

function migrateToV5(db) {
  const additions = [
    ['task_checklist', 'weight', 'REAL NOT NULL DEFAULT 1'],
    ['task_checklist', 'owner_user_id', 'INTEGER'],
    ['function_group_checks', 'group_subcategory_id', 'INTEGER'],
    ['status_items', 'function_group_subcategory_id', 'INTEGER']
  ];
  for (const addition of additions) ensureColumn(db, ...addition);
}

function migrateToV6(db) {
  const additions = [
    ['planner_entries', 'work_mode', "TEXT NOT NULL DEFAULT 'online'"],
    ['goals', 'priority', "TEXT NOT NULL DEFAULT 'Medium'"]
  ];
  for (const addition of additions) ensureColumn(db, ...addition);
}

function migrateToV7(db) {
  const additions = [
    ['project_memberships', 'planner_enabled', 'INTEGER NOT NULL DEFAULT 1'],
    ['project_memberships', 'summary_area_source', "TEXT NOT NULL DEFAULT 'configuration'"],
    ['controllers', 'leaf_code', "TEXT NOT NULL DEFAULT ''"],
    ['tasks', 'controller_group_id', 'INTEGER']
  ];
  for (const addition of additions) ensureColumn(db, ...addition);
}

function migrateToV8(db) {
  db.exec("UPDATE status_items SET milestone='' WHERE trim(COALESCE(milestone,''))!=''");
}

function migrateToV9(db) {
  const checksSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='function_group_checks'").get()?.sql || '';
  if (/UNIQUE\s*\(\s*function_group_id\s*,\s*title\s*,\s*category\s*\)/i.test(checksSql)) {
    db.exec('PRAGMA foreign_keys=OFF');
    try {
      db.exec(`
        BEGIN IMMEDIATE;
        CREATE TABLE function_group_checks_v9 (
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
        INSERT INTO function_group_checks_v9(id,function_group_id,element_id,group_subcategory_id,title,category,criticality,sort_order,active,created_at,updated_at)
          SELECT id,function_group_id,element_id,group_subcategory_id,title,category,criticality,sort_order,active,created_at,updated_at FROM function_group_checks;
        DROP TABLE function_group_checks;
        ALTER TABLE function_group_checks_v9 RENAME TO function_group_checks;
        CREATE INDEX IF NOT EXISTS idx_function_checks_group ON function_group_checks(function_group_id,sort_order);
        COMMIT;
      `);
    } catch (error) {
      try { db.exec('ROLLBACK'); } catch {}
      throw error;
    } finally {
      db.exec('PRAGMA foreign_keys=ON');
    }
  }
}

function migrateToV10(db) {
  ensureColumn(db, 'daily_notes', 'controller_group_id', 'INTEGER');
  ensureColumn(db, 'announcements', 'importance', "TEXT NOT NULL DEFAULT 'Normalna'");
  db.exec(`
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
    CREATE INDEX IF NOT EXISTS idx_announcement_labels_project ON announcement_labels(project_id,sort_order,name);
    CREATE INDEX IF NOT EXISTS idx_planner_time_adjustments_date ON planner_time_adjustments(project_id,plan_date,user_id);
  `);
  const option = db.prepare('INSERT OR IGNORE INTO options(project_id,kind,value,sort_order) VALUES(?,?,?,?)');
  const label = db.prepare('INSERT OR IGNORE INTO announcement_labels(project_id,name,color,sort_order) VALUES(?,?,?,?)');
  const setting = db.prepare('INSERT OR IGNORE INTO settings(project_id,key,value) VALUES(?,?,?)');
  for (const project of db.prepare('SELECT id FROM projects').all()) {
    ['Niska', 'Normalna', 'Wysoka', 'Krytyczna'].forEach((value, index) => option.run(project.id, 'announcement_importance', value, index));
    [['Organizacja', 'blue'], ['Bezpieczeństwo', 'red'], ['Produkcja', 'amber'], ['Techniczne', 'violet']].forEach(([name, color], index) => label.run(project.id, name, color, index));
    setting.run(project.id, 'planner_online_hours', '10.5');
    setting.run(project.id, 'planner_offline_hours', '8');
    setting.run(project.id, 'planner_base_hours', '8');
    setting.run(project.id, 'planner_weekday_multiplier', '1.5');
    setting.run(project.id, 'planner_saturday_multiplier', '1.5');
    setting.run(project.id, 'planner_sunday_holiday_multiplier', '2');
    setting.run(project.id, 'planner_time_off_debit', '8');
  }
}

function migrateToV11(db) {
  ensureColumn(db, 'project_memberships', 'assignable', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn(db, 'planner_time_adjustments', 'work_start_time', 'TEXT');
  ensureColumn(db, 'planner_time_adjustments', 'work_end_time', 'TEXT');
  ensureColumn(db, 'planner_time_adjustments', 'overtime_raw_balance_override', 'REAL');
  ensureColumn(db, 'planner_time_adjustments', 'overtime_weighted_balance_override', 'REAL');
  db.exec('UPDATE project_memberships SET assignable=1 WHERE assignable IS NULL');
}

function migrateToV12(db) {
  const notificationSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='notifications'").get()?.sql || '';
  if (!notificationSql.includes("'handover'")) {
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE notifications_v12 (
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
      INSERT INTO notifications_v12(id,project_id,user_id,kind,entity_type,entity_id,title,message,read_at,created_at)
        SELECT id,project_id,user_id,kind,entity_type,entity_id,title,message,read_at,created_at FROM notifications;
      DROP TABLE notifications;
      ALTER TABLE notifications_v12 RENAME TO notifications;
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(project_id,user_id,read_at,created_at DESC);
      COMMIT;
    `);
  }
  const insertRule = db.prepare(`INSERT OR IGNORE INTO automation_rules(
    project_id,name,trigger_type,entity_types_json,days_offset,action_type,target_priority,active
  ) VALUES(?,?,?,?,?,?,?,0)`);
  for (const project of db.prepare('SELECT id FROM projects').all()) {
    insertRule.run(project.id, 'Przekroczony termin', 'overdue', JSON.stringify(['task', 'point', 'goal']), 0, 'notify_assignees', 'High');
    insertRule.run(project.id, 'Termin w ciągu 3 dni', 'due_soon', JSON.stringify(['task', 'point', 'goal']), 3, 'notify_assignees', 'High');
    insertRule.run(project.id, 'Przypomnienie otwartego punktu', 'reminder_due', JSON.stringify(['point']), 0, 'notify_assignees', 'High');
  }
}

function canonicalControllerPart(value) {
  return String(value || '').trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^A-Za-z0-9_-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').toUpperCase() || 'PLC';
}

function refreshControllerCodesForProject(db, projectId) {
  const groups = db.prepare('SELECT id,parent_id,name FROM controller_groups WHERE project_id=?').all(projectId);
  const groupMap = new Map(groups.map(group => [group.id, group]));
  const pathCache = new Map();
  const groupPath = id => {
    if (!id || !groupMap.has(id)) return [];
    if (pathCache.has(id)) return pathCache.get(id);
    const group = groupMap.get(id);
    const path = [...groupPath(group.parent_id), group.name];
    pathCache.set(id, path);
    return path;
  };
  const controllers = db.prepare('SELECT id,group_id,code,leaf_code FROM controllers WHERE project_id=? ORDER BY sort_order,id').all(projectId);
  if (!controllers.length) return;
  const setLeaf = db.prepare('UPDATE controllers SET leaf_code=? WHERE id=?');
  for (const item of controllers) if (!String(item.leaf_code || '').trim()) setLeaf.run(String(item.code || '').trim(), item.id);
  const refreshed = db.prepare('SELECT id,group_id,leaf_code FROM controllers WHERE project_id=? ORDER BY sort_order,id').all(projectId);
  const temporary = db.prepare('UPDATE controllers SET code=? WHERE id=?');
  for (const item of refreshed) temporary.run(`__V7_${item.id}`, item.id);
  const used = new Set();
  const update = db.prepare('UPDATE controllers SET code=? WHERE id=?');
  for (const item of refreshed) {
    const parts = [...groupPath(item.group_id), item.leaf_code].map(canonicalControllerPart).filter(Boolean)
      .filter((part, index, list) => index === 0 || part !== list[index - 1]);
    const base = parts.join('-') || `PLC-${item.id}`;
    let code = base;
    let suffix = 2;
    while (used.has(code)) code = `${base}-${suffix++}`;
    used.add(code);
    update.run(code, item.id);
  }
}

function rebuildProjectConfiguration(db) {
  db.exec('PRAGMA foreign_keys=OFF');
  try {
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE controllers_v4(id INTEGER PRIMARY KEY,project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,group_id INTEGER REFERENCES controller_groups(id) ON DELETE SET NULL,code TEXT NOT NULL,area TEXT NOT NULL DEFAULT 'Body Shop',description TEXT NOT NULL DEFAULT '',sort_order INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(project_id,code)) STRICT;
      INSERT INTO controllers_v4(id,project_id,group_id,code,area,description,sort_order,created_at) SELECT id,1,NULL,code,area,description,sort_order,created_at FROM controllers;
      DROP TABLE controllers;
      ALTER TABLE controllers_v4 RENAME TO controllers;

      CREATE TABLE categories_v4(id INTEGER PRIMARY KEY,project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,name TEXT NOT NULL COLLATE NOCASE,sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,UNIQUE(project_id,name)) STRICT;
      INSERT INTO categories_v4(id,project_id,name,sort_order,active) SELECT id,1,name,sort_order,active FROM categories;
      DROP TABLE categories;
      ALTER TABLE categories_v4 RENAME TO categories;

      CREATE TABLE task_categories_v4(id INTEGER PRIMARY KEY,project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,name TEXT NOT NULL COLLATE NOCASE,sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,UNIQUE(project_id,name)) STRICT;
      INSERT INTO task_categories_v4(id,project_id,name,sort_order,active) SELECT id,1,name,sort_order,active FROM task_categories;
      DROP TABLE task_categories;
      ALTER TABLE task_categories_v4 RENAME TO task_categories;

      CREATE TABLE options_v4(id INTEGER PRIMARY KEY,project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,kind TEXT NOT NULL,value TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,UNIQUE(project_id,kind,value)) STRICT;
      INSERT INTO options_v4(id,project_id,kind,value,sort_order,active) SELECT id,1,kind,value,sort_order,active FROM options;
      DROP TABLE options;
      ALTER TABLE options_v4 RENAME TO options;

      CREATE TABLE settings_v4(project_id INTEGER NOT NULL DEFAULT 1 REFERENCES projects(id) ON DELETE CASCADE,key TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(project_id,key)) STRICT, WITHOUT ROWID;
      INSERT INTO settings_v4(project_id,key,value) SELECT 1,key,value FROM settings;
      DROP TABLE settings;
      ALTER TABLE settings_v4 RENAME TO settings;
      COMMIT;
    `);
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys=ON');
  }
}

function seedControllerHierarchy(db, projectId) {
  const controllers = db.prepare('SELECT * FROM controllers WHERE project_id=? ORDER BY sort_order,id').all(projectId);
  const insert = db.prepare('INSERT OR IGNORE INTO controller_groups(project_id,parent_id,name,sort_order) VALUES(?,?,?,?)');
  const updateController = db.prepare('UPDATE controllers SET group_id=? WHERE id=?');
  const rootOrders = new Map();
  for (const item of controllers) {
    const rootName = (item.code.match(/^[A-Za-z]+/)?.[0] || item.area || 'Inne').toUpperCase();
    if (!rootOrders.has(rootName)) rootOrders.set(rootName, rootOrders.size);
    insert.run(projectId, null, rootName, rootOrders.get(rootName));
    const root = db.prepare('SELECT id FROM controller_groups WHERE project_id=? AND parent_id IS NULL AND name=? COLLATE NOCASE').get(projectId, rootName);
    const middleName = /^([A-Za-z]+\d{2})\d/.exec(item.code)?.[1] || '';
    let groupId = root.id;
    if (middleName && middleName !== item.code) {
      const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM controller_groups WHERE project_id=? AND parent_id=?').get(projectId, root.id).value;
      insert.run(projectId, root.id, middleName, nextOrder);
      groupId = db.prepare('SELECT id FROM controller_groups WHERE project_id=? AND parent_id=? AND name=? COLLATE NOCASE').get(projectId, root.id, middleName).id;
    }
    if (!item.group_id) updateController.run(groupId, item.id);
  }
}

function seedConfiguration(db, projectId = 1, variant = 'main') {
  const option = db.prepare('INSERT OR IGNORE INTO options(project_id,kind,value,sort_order) VALUES(?,?,?,?)');
  ['Dzień', 'Noc', 'Ogólne'].forEach((value, index) => option.run(projectId, 'shift', value, index));
  ['Postęp', 'Problem', 'Decyzja', 'Plan'].forEach((value, index) => option.run(projectId, 'note_type', value, index));
  ['PLC', 'Robot', 'Electrical', 'Mechanical', 'Process', 'Production'].forEach((value, index) => option.run(projectId, 'waiting_for', value, index));
  ['Niska', 'Normalna', 'Wysoka', 'Krytyczna'].forEach((value, index) => option.run(projectId, 'announcement_importance', value, index));
  db.prepare("INSERT OR IGNORE INTO settings(project_id,key,value) VALUES(?,'default_reminder_days','14')").run(projectId);
  db.prepare("INSERT OR IGNORE INTO settings(project_id,key,value) VALUES(?,'reminder_warning_days','7')").run(projectId);
  db.prepare("INSERT OR IGNORE INTO settings(project_id,key,value) VALUES(?,'my_summary_area_source','configuration')").run(projectId);
  [['planner_online_hours', '10.5'], ['planner_offline_hours', '8'], ['planner_base_hours', '8'], ['planner_weekday_multiplier', '1.5'], ['planner_saturday_multiplier', '1.5'], ['planner_sunday_holiday_multiplier', '2'], ['planner_time_off_debit', '8']]
    .forEach(([key, value]) => db.prepare('INSERT OR IGNORE INTO settings(project_id,key,value) VALUES(?,?,?)').run(projectId, key, value));

  const insertAnnouncementLabel = db.prepare('INSERT OR IGNORE INTO announcement_labels(project_id,name,color,sort_order) VALUES(?,?,?,?)');
  [['Organizacja', 'blue'], ['Bezpieczeństwo', 'red'], ['Produkcja', 'amber'], ['Techniczne', 'violet']]
    .forEach(([name, color], index) => insertAnnouncementLabel.run(projectId, name, color, index));

  const insertRequirement = db.prepare('INSERT OR IGNORE INTO completion_requirements(project_id,name,description,sort_order) VALUES(?,?,?,?)');
  [
    ['Dokumentacja techniczna', 'Aktualna dokumentacja, schemat albo instrukcja potrzebna do zamknięcia tematu.'],
    ['Dostęp do instalacji', 'Potwierdzony dostęp do maszyny, linii albo stanowiska.'],
    ['Wsparcie dostawcy', 'Obecność lub zdalne wsparcie właściwego dostawcy.'],
    ['Części / materiał testowy', 'Komponenty, detale lub materiał potrzebny do wykonania próby.'],
    ['Akceptacja jakości', 'Odbiór albo potwierdzenie wyniku przez dział jakości.']
  ].forEach(([name, description], index) => insertRequirement.run(projectId, name, description, index));

  const statusCategories = ['Hardware', 'Manual mode', 'Automatic mode', 'Startup devices', 'Startup drives', 'Safety', 'NiO', 'Special functions', 'Counters / KPI'];
  const insertStatusCategory = db.prepare('INSERT OR IGNORE INTO categories(project_id,name,sort_order) VALUES(?,?,?)');
  statusCategories.forEach((name, index) => insertStatusCategory.run(projectId, name, index));

  const taskCategories = ['Commissioning', 'Programming', 'Testing', 'Documentation', 'Coordination'];
  const insertTaskCategory = db.prepare('INSERT OR IGNORE INTO task_categories(project_id,name,sort_order) VALUES(?,?,?)');
  taskCategories.forEach((name, index) => insertTaskCategory.run(projectId, name, index));

  const statusSubcategories = {
    Hardware: ['+24V Connection', 'Profinet connection', 'Commissioning status'],
    'Manual mode': ['Manual drives', 'Local panels'],
    'Automatic mode': ['Sequence test', 'Cycle with part'],
    'Startup devices': ['Device green', 'Diagnostic status'],
    'Startup drives': ['Drive enable', 'Referencing'],
    Safety: ['Emergency stop', 'Doors and gates'],
    NiO: ['Error handling'],
    'Special functions': ['Interfaces'],
    'Counters / KPI': ['Cycle time']
  };
  const insertStatusSubcategory = db.prepare('INSERT OR IGNORE INTO subcategories(category_id,name,sort_order) VALUES(?,?,?)');
  for (const [categoryName, names] of Object.entries(statusSubcategories)) {
    const category = db.prepare('SELECT id FROM categories WHERE project_id=? AND name=?').get(projectId, categoryName);
    names.forEach((name, index) => insertStatusSubcategory.run(category.id, name, index));
  }
  db.prepare(`UPDATE subcategories SET default_function=CASE name
    WHEN '+24V Connection' THEN 'Sprawdź zasilanie 24 V, biegunowość i zabezpieczenie.'
    WHEN 'Profinet connection' THEN 'Potwierdź nazwę urządzenia, adres IP i stabilną komunikację Profinet.'
    WHEN 'Manual drives' THEN 'Sprawdź ruch, kierunek, krańcówki i blokady w trybie ręcznym.'
    WHEN 'Sequence test' THEN 'Wykonaj pełną sekwencję i potwierdź wszystkie warunki przejścia.'
    WHEN 'Emergency stop' THEN 'Sprawdź reakcję układu, komunikaty i bezpieczny restart.'
    ELSE default_function END
    WHERE category_id IN (SELECT id FROM categories WHERE project_id=?)`).run(projectId);

  const taskSubcategories = {
    Commissioning: ['Field verification', 'Device startup'],
    Programming: ['PLC changes', 'HMI changes'],
    Testing: ['Interface tests', 'Sequence tests'],
    Documentation: ['As-built', 'Test report'],
    Coordination: ['Supplier action', 'Production alignment']
  };
  const insertTaskSubcategory = db.prepare('INSERT OR IGNORE INTO task_subcategories(category_id,name,sort_order) VALUES(?,?,?)');
  for (const [categoryName, names] of Object.entries(taskSubcategories)) {
    const category = db.prepare('SELECT id FROM task_categories WHERE project_id=? AND name=?').get(projectId, categoryName);
    names.forEach((name, index) => insertTaskSubcategory.run(category.id, name, index));
  }

  if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
    const username = process.env.APP_USER || 'admin';
    const password = process.env.APP_PASSWORD || 'change-me';
    db.prepare("INSERT INTO users(username,display_name,password_hash,role,system_role,sort_order) VALUES(?,?,?,?,?,0)").run(username, 'Administrator', hashPassword(password), 'admin', 'system_admin');
  }
  const systemAdmin = db.prepare("SELECT id FROM users WHERE system_role='system_admin' ORDER BY id LIMIT 1").get();
  if (systemAdmin) db.prepare("INSERT OR IGNORE INTO project_memberships(project_id,user_id,role,active) VALUES(?,?,'project_admin',1)").run(projectId, systemAdmin.id);
}

function seedSecondProject(db, hashPassword) {
  if (db.prepare("SELECT value FROM app_meta WHERE key='demo_project_v4'").get()?.value === '1') return;
  db.prepare(`INSERT OR IGNORE INTO projects(code,name,description,sort_order)
    VALUES('W520','W520 · Launch','Drugi projekt demonstracyjny z odrębną konfiguracją i danymi',1)`).run();
  const project = db.prepare("SELECT * FROM projects WHERE code='W520'").get();
  seedConfiguration(db, project.id, 'secondary');

  const controllerCodes = ['HB511','HB512','HB521','HB522','HB523','UB511','UB512','UB521','UB522','UB523'];
  const insertController = db.prepare('INSERT OR IGNORE INTO controllers(project_id,code,area,description,sort_order) VALUES(?,?,?,?,?)');
  controllerCodes.forEach((code, index) => insertController.run(project.id, code, code.startsWith('HB') ? 'Body Shop' : 'Underbody', `Sterownik demonstracyjny ${code} projektu W520`, index));
  seedControllerHierarchy(db, project.id);

  const users = db.prepare('SELECT id,display_name,system_role FROM users WHERE active=1 ORDER BY sort_order,id').all();
  const addMembership = db.prepare('INSERT OR IGNORE INTO project_memberships(project_id,user_id,role,active) VALUES(?,?,?,?)');
  users.forEach((user, index) => addMembership.run(project.id, user.id, user.system_role === 'system_admin' ? 'project_admin' : index % 5 === 0 ? 'moderator' : 'user', user.system_role === 'system_admin' || index % 4 !== 0 ? 1 : 0));

  const controllers = db.prepare('SELECT * FROM controllers WHERE project_id=? ORDER BY sort_order').all(project.id);
  const activeUsers = users.length ? users : [{ id: 1, display_name: 'Administrator' }];
  const statusPairs = [
    ['Hardware','+24V Connection'],['Hardware','Profinet connection'],['Manual mode','Manual drives'],
    ['Automatic mode','Sequence test'],['Safety','Emergency stop'],['Startup devices','Device green']
  ];
  const date = offset => { const value = new Date(); value.setUTCDate(value.getUTCDate() + offset); return value.toISOString().slice(0, 10); };
  const statusIds = [];
  const addStatus = db.prepare(`INSERT OR IGNORE INTO status_items(project_id,controller_id,test_id,station,function_detail,category,subcategory,criticality,responsible,responsible_user_id,status,current_note,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (let index = 0; index < 40; index += 1) {
    const controllerRow = controllers[index % controllers.length];
    const owner = activeUsers[(index + 1) % activeUsers.length];
    const [category, subcategory] = statusPairs[index % statusPairs.length];
    const status = ['Not started','In progress','Ready to test','Done','Done','Blocked'][index % 6];
    const result = addStatus.run(project.id, controllerRow.id, `W520-${controllerRow.code}-${String(index + 1).padStart(3,'0')}`, `${String((index % 12) + 1).padStart(3,'0')}VR_001`, `Weryfikacja ${subcategory}`, category, subcategory, ['Low','Medium','High','Critical'][index % 4], owner.display_name, owner.id, status, 'Dane testowe drugiego projektu.', owner.id);
    if (result.changes) statusIds.push(Number(result.lastInsertRowid));
  }

  const taskIds = [];
  const addTask = db.prepare(`INSERT INTO tasks(project_id,controller_id,title,description,station,priority,owner,owner_user_id,status,start_date,due_date,category,subcategory,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (let index = 0; index < 35; index += 1) {
    const controllerRow = controllers[(index + 2) % controllers.length];
    const owner = activeUsers[(index + 3) % activeUsers.length];
    const result = addTask.run(project.id, controllerRow.id, `W520 · zadanie ${String(index + 1).padStart(2,'0')} · ${controllerRow.code}`, 'Zadanie demonstracyjne drugiego projektu.', `${String((index % 12) + 1).padStart(3,'0')}VR_001`, ['Low','Medium','High'][index % 3], owner.display_name, owner.id, ['To do','In progress','Done'][index % 3], date(-(index % 10)), date((index % 21) - 5), ['Commissioning','Programming','Testing'][index % 3], ['Field verification','PLC changes','Sequence tests'][index % 3], owner.id);
    taskIds.push(Number(result.lastInsertRowid));
  }

  const pointIds = [];
  const addPoint = db.prepare(`INSERT INTO open_points(project_id,controller_id,issue_id,title,description,priority,owner,owner_user_id,status,waiting_for,next_action,start_date,due_date,reminder_date,category,subcategory,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (let index = 0; index < 30; index += 1) {
    const controllerRow = controllers[(index + 4) % controllers.length];
    const owner = activeUsers[(index + 2) % activeUsers.length];
    const result = addPoint.run(project.id, controllerRow.id, `W520-OP-${String(index + 1).padStart(3,'0')}`, `Punkt W520 ${index + 1}`, 'Otwarty punkt demonstracyjny projektu W520.', ['Medium','High','Critical'][index % 3], owner.display_name, owner.id, ['Open','Waiting','In progress','Closed'][index % 4], ['PLC','Robot','Electrical'][index % 3], 'Zweryfikować temat i wykonać retest.', date(-(index % 14)), date((index % 17) - 3), date((index % 19) - 7), statusPairs[index % statusPairs.length][0], statusPairs[index % statusPairs.length][1], owner.id);
    pointIds.push(Number(result.lastInsertRowid));
  }

  const noteIds = [];
  const addNote = db.prepare(`INSERT INTO daily_notes(project_id,controller_id,note_date,shift,author,type,content,created_by,linked_task_id,linked_status_id,linked_point_id)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  for (let index = 0; index < 30; index += 1) {
    const controllerRow = controllers[index % controllers.length];
    const author = activeUsers[(index + 4) % activeUsers.length];
    const result = addNote.run(project.id, controllerRow.id, date(-(index % 21)), ['Dzień','Noc','Ogólne'][index % 3], author.display_name, ['Postęp','Problem','Plan'][index % 3], `W520: wpis zmianowy ${index + 1}. Zweryfikowano bieżący zakres uruchomienia.`, author.id, taskIds[index % taskIds.length], statusIds[index % statusIds.length], index % 2 ? null : pointIds[index % pointIds.length]);
    noteIds.push(Number(result.lastInsertRowid));
  }

  const addGoal = db.prepare('INSERT INTO goals(project_id,controller_id,title,description,status,due_date,created_by) VALUES(?,?,?,?,?,?,?)');
  const addGoalLink = db.prepare('INSERT OR IGNORE INTO goal_links(project_id,goal_id,entity_type,entity_id) VALUES(?,?,?,?)');
  for (let index = 0; index < 8; index += 1) {
    const controllerRow = controllers[index % controllers.length];
    const result = addGoal.run(project.id, controllerRow.id, `Kamień milowy W520 ${index + 1}`, 'Cel demonstracyjny dla drugiego projektu.', ['Open','In progress','Done'][index % 3], date(14 + index * 5), activeUsers[index % activeUsers.length].id);
    const goalId = Number(result.lastInsertRowid);
    addGoalLink.run(project.id, goalId, 'status', statusIds[index % statusIds.length]);
    addGoalLink.run(project.id, goalId, 'task', taskIds[index % taskIds.length]);
    addGoalLink.run(project.id, goalId, 'point', pointIds[index % pointIds.length]);
  }
  db.prepare("INSERT INTO app_meta(key,value) VALUES('demo_project_v4','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
}

function syncProjectMemberships(db) {
  const users = db.prepare('SELECT id,role,system_role FROM users WHERE active=1').all();
  const projects = db.prepare('SELECT id FROM projects WHERE active=1').all();
  const insert = db.prepare('INSERT OR IGNORE INTO project_memberships(project_id,user_id,role,active) VALUES(?,?,?,1)');
  for (const user of users) {
    insert.run(1, user.id, user.role === 'admin' ? 'project_admin' : user.role);
    if (user.system_role === 'system_admin') for (const project of projects) insert.run(project.id, user.id, 'project_admin');
  }
}

function backfillV3(db) {
  db.exec(`
    UPDATE controllers SET sort_order=id-1
      WHERE (SELECT COUNT(DISTINCT sort_order) FROM controllers)<=1;
    UPDATE users SET sort_order=id-1
      WHERE (SELECT COUNT(DISTINCT sort_order) FROM users)<=1;
    UPDATE tasks SET owner_user_id=(SELECT id FROM users WHERE display_name=tasks.owner COLLATE NOCASE LIMIT 1) WHERE owner_user_id IS NULL AND owner!='';
    UPDATE open_points SET owner_user_id=(SELECT id FROM users WHERE display_name=open_points.owner COLLATE NOCASE LIMIT 1) WHERE owner_user_id IS NULL AND owner!='';
    UPDATE status_items SET responsible_user_id=(SELECT id FROM users WHERE display_name=status_items.responsible COLLATE NOCASE LIMIT 1) WHERE responsible_user_id IS NULL AND responsible!='';
    UPDATE tasks SET linked_entity_type='point' WHERE linked_entity_type='points';
    UPDATE tasks SET linked_entity_type='note' WHERE linked_entity_type='notes';
    UPDATE open_points SET linked_entity_type='point' WHERE linked_entity_type='points';
    UPDATE open_points SET linked_entity_type='note' WHERE linked_entity_type='notes';
  `);
  const distinctTaskCategories = db.prepare("SELECT DISTINCT category FROM tasks WHERE category!=''").all();
  const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1) value FROM task_categories').get().value;
  const add = db.prepare('INSERT OR IGNORE INTO task_categories(name,sort_order) VALUES(?,?)');
  distinctTaskCategories.forEach((row, index) => add.run(row.category, maxOrder + index + 1));

  const taskPairs = db.prepare("SELECT DISTINCT category,subcategory FROM tasks WHERE category!='' AND subcategory!=''").all();
  const addSubcategory = db.prepare('INSERT OR IGNORE INTO task_subcategories(category_id,name,sort_order) VALUES(?,?,?)');
  for (const pair of taskPairs) {
    const category = db.prepare('SELECT id FROM task_categories WHERE name=? COLLATE NOCASE').get(pair.category);
    if (!category) continue;
    const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM task_subcategories WHERE category_id=?').get(category.id).value;
    addSubcategory.run(category.id, pair.subcategory, nextOrder);
  }
}

function backfillFunctionGroups(db) {
  if (db.prepare("SELECT value FROM app_meta WHERE key='function_groups_backfill_v2'").get()?.value === '1') return;
  const rows = db.prepare(`SELECT DISTINCT project_id,controller_id,station FROM status_items
    WHERE station!='' AND function_group_id IS NULL ORDER BY project_id,controller_id,station COLLATE NOCASE`).all();
  if (!rows.length) return;
  const insertGroup = db.prepare('INSERT OR IGNORE INTO function_groups(project_id,controller_id,name,sort_order) VALUES(?,?,?,?)');
  for (const row of rows) {
    const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM function_groups WHERE controller_id=?').get(row.controller_id).value;
    insertGroup.run(row.project_id, row.controller_id, row.station, nextOrder);
  }
  db.exec(`UPDATE status_items SET function_group_id=(
    SELECT fg.id FROM function_groups fg
    WHERE fg.project_id=status_items.project_id AND fg.controller_id=status_items.controller_id AND fg.name=status_items.station COLLATE NOCASE
    LIMIT 1
  ) WHERE function_group_id IS NULL AND station!=''`);

  const statusRows = db.prepare(`SELECT id,function_group_id,function_detail,category,criticality,subcategory
    FROM status_items WHERE function_group_id IS NOT NULL ORDER BY id`).all();
  const insertCheck = db.prepare(`INSERT OR IGNORE INTO function_group_checks
    (function_group_id,title,category,criticality,sort_order) VALUES(?,?,?,?,?)`);
  const linkSubcategory = db.prepare('INSERT OR IGNORE INTO function_group_check_subcategories(check_id,subcategory_id) VALUES(?,?)');
  const linkStatus = db.prepare('UPDATE status_items SET function_group_check_id=? WHERE id=?');
  for (const row of statusRows) {
    let check = db.prepare(`SELECT * FROM function_group_checks
      WHERE function_group_id=? AND title=? COLLATE NOCASE AND category=? COLLATE NOCASE`).get(row.function_group_id, row.function_detail, row.category);
    if (!check) {
      const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM function_group_checks WHERE function_group_id=?').get(row.function_group_id).value;
      insertCheck.run(row.function_group_id, row.function_detail, row.category, row.criticality || 'Medium', nextOrder);
      check = db.prepare(`SELECT * FROM function_group_checks
        WHERE function_group_id=? AND title=? COLLATE NOCASE AND category=? COLLATE NOCASE`).get(row.function_group_id, row.function_detail, row.category);
    }
    linkStatus.run(check.id, row.id);
    if (row.subcategory) {
      const subcategory = db.prepare(`SELECT s.id FROM subcategories s JOIN categories c ON c.id=s.category_id
        WHERE c.name=? COLLATE NOCASE AND s.name=? COLLATE NOCASE LIMIT 1`).get(row.category, row.subcategory);
      if (subcategory) linkSubcategory.run(check.id, subcategory.id);
    }
  }
  db.prepare("INSERT INTO app_meta(key,value) VALUES('function_groups_backfill_v2','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
}

function backfillV4Links(db) {
  if (db.prepare("SELECT value FROM app_meta WHERE key='v4_links_backfill'").get()?.value === '1') return;
  const insert = db.prepare(`INSERT OR IGNORE INTO entity_links(project_id,source_type,source_id,target_type,target_id,created_by)
    VALUES(?,?,?,?,?,?)`);
  for (const row of db.prepare("SELECT * FROM tasks WHERE linked_entity_type!='' AND linked_entity_id IS NOT NULL").all()) {
    insert.run(row.project_id, 'task', row.id, row.linked_entity_type, row.linked_entity_id, row.created_by);
  }
  for (const row of db.prepare("SELECT * FROM open_points WHERE linked_entity_type!='' AND linked_entity_id IS NOT NULL").all()) {
    insert.run(row.project_id, 'point', row.id, row.linked_entity_type, row.linked_entity_id, row.created_by);
  }
  for (const row of db.prepare('SELECT * FROM daily_notes').all()) {
    if (row.linked_task_id) insert.run(row.project_id, 'note', row.id, 'task', row.linked_task_id, row.created_by);
    if (row.linked_status_id) insert.run(row.project_id, 'note', row.id, 'status', row.linked_status_id, row.created_by);
    if (row.linked_point_id) insert.run(row.project_id, 'note', row.id, 'point', row.linked_point_id, row.created_by);
  }
  const addElement = db.prepare('INSERT OR IGNORE INTO function_group_elements(function_group_id,name,description,sort_order) VALUES(?,?,?,?)');
  for (const group of db.prepare('SELECT id FROM function_groups').all()) {
    ['QM1','QM2','QM3','BZ1','BZ2'].forEach((name, index) => addElement.run(group.id, name, `Element ${name} grupy funkcyjnej`, index));
  }
  db.prepare("INSERT INTO app_meta(key,value) VALUES('v4_links_backfill','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
}

function canonicalLink(leftType, leftId, rightType, rightId) {
  const rank = { status: 1, task: 2, point: 3, note: 4, goal: 5 };
  const left = [rank[leftType] || 99, Number(leftId)];
  const right = [rank[rightType] || 99, Number(rightId)];
  return left[0] < right[0] || (left[0] === right[0] && left[1] <= right[1])
    ? [leftType, Number(leftId), rightType, Number(rightId)]
    : [rightType, Number(rightId), leftType, Number(leftId)];
}

function backfillV5(db) {
  db.exec(`
    UPDATE task_checklist SET weight=1 WHERE weight IS NULL OR weight<=0;
    INSERT OR IGNORE INTO task_assignees(project_id,task_id,user_id,assigned_directly)
      SELECT project_id,id,owner_user_id,1 FROM tasks WHERE owner_user_id IS NOT NULL;
  `);

  const links = db.prepare('SELECT * FROM entity_links ORDER BY id').all();
  const unique = new Map();
  for (const link of links) {
    if (link.source_type === link.target_type && Number(link.source_id) === Number(link.target_id)) continue;
    const pair = canonicalLink(link.source_type, link.source_id, link.target_type, link.target_id);
    const key = `${link.project_id}:${pair.join(':')}`;
    if (!unique.has(key)) unique.set(key, { ...link, source_type: pair[0], source_id: pair[1], target_type: pair[2], target_id: pair[3] });
  }
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('DELETE FROM entity_links');
    const insert = db.prepare(`INSERT OR IGNORE INTO entity_links(project_id,source_type,source_id,target_type,target_id,created_by,created_at)
      VALUES(?,?,?,?,?,?,?)`);
    for (const link of unique.values()) insert.run(link.project_id, link.source_type, link.source_id, link.target_type, link.target_id, link.created_by, link.created_at);
    db.exec(`UPDATE daily_notes SET linked_task_id=NULL,linked_status_id=NULL,linked_point_id=NULL;
      UPDATE tasks SET linked_entity_type='',linked_entity_id=NULL;
      UPDATE open_points SET linked_entity_type='',linked_entity_id=NULL;`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function backfillV6(db) {
  db.exec(`
    UPDATE planner_entries SET work_mode='online' WHERE work_mode IS NULL OR work_mode NOT IN ('online','offline');
    UPDATE goals SET priority='Medium' WHERE priority IS NULL OR priority='';
    INSERT OR IGNORE INTO status_assignees(project_id,status_id,user_id)
      SELECT project_id,id,responsible_user_id FROM status_items WHERE responsible_user_id IS NOT NULL;
    INSERT OR IGNORE INTO settings(project_id,key,value)
      SELECT id,'my_summary_area_source','configuration' FROM projects;
  `);
}

function backfillV7(db) {
  const previousVersion = Number(db.prepare("SELECT value FROM app_meta WHERE key='schema_version'").get()?.value || 0);
  if (previousVersion < 7) {
    db.exec(`
      UPDATE project_memberships
      SET planner_enabled=CASE WHEN user_id IN (SELECT id FROM users WHERE system_role='system_admin') THEN 0 ELSE 1 END;
      UPDATE project_memberships
      SET summary_area_source=COALESCE((SELECT CASE WHEN s.value='planner' THEN 'planner' ELSE 'configuration' END
        FROM settings s WHERE s.project_id=project_memberships.project_id AND s.key='my_summary_area_source'),'configuration');
    `);
  }
  db.exec("UPDATE project_memberships SET summary_area_source='configuration' WHERE summary_area_source NOT IN ('configuration','planner') OR summary_area_source IS NULL");
  db.exec("DELETE FROM entity_mentions WHERE entity_type='task'");
  db.exec(`INSERT OR IGNORE INTO entity_links(project_id,source_type,source_id,target_type,target_id,created_by)
    SELECT gl.project_id,gl.entity_type,gl.entity_id,'goal',gl.goal_id,g.created_by
    FROM goal_links gl JOIN goals g ON g.id=gl.goal_id AND g.project_id=gl.project_id`);
  for (const project of db.prepare('SELECT id FROM projects ORDER BY id').all()) refreshControllerCodesForProject(db, project.id);
}

function seedV5Demo(db) {
  if (db.prepare("SELECT value FROM app_meta WHERE key='demo_v5_planner' ").get()?.value === '1') return;
  const addGroupSubcategory = db.prepare(`INSERT OR IGNORE INTO function_group_subcategories(function_group_id,name,description,sort_order)
    VALUES(?,?,?,?)`);
  for (const group of db.prepare('SELECT id FROM function_groups ORDER BY id').all()) {
    ['Ogólne', 'Interfejsy', 'Sekwencja'].forEach((name, index) => addGroupSubcategory.run(group.id, name, `Zakres ${name.toLowerCase()} grupy`, index));
  }

  const addArea = db.prepare('INSERT OR IGNORE INTO project_user_areas(project_id,user_id,controller_group_id,sort_order) VALUES(?,?,?,?)');
  const addPlan = db.prepare(`INSERT INTO planner_entries(project_id,user_id,plan_date,shift,controller_group_id,work_mode,transport_mode,note,created_by)
    VALUES(?,?,?,?,?,?,?,?,?)`);
  const addAnnotation = db.prepare(`INSERT INTO calendar_annotations(project_id,title,description,start_date,end_date,controller_id,assigned_user_id,color,created_by)
    VALUES(?,?,?,?,?,?,?,?,?)`);
  const isoDate = offset => { const date = new Date(); date.setUTCHours(12, 0, 0, 0); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0, 10); };
  for (const project of db.prepare('SELECT id FROM projects WHERE active=1 ORDER BY id').all()) {
    const users = db.prepare(`SELECT u.id FROM users u JOIN project_memberships pm ON pm.user_id=u.id
      WHERE pm.project_id=? AND pm.active=1 AND u.active=1 AND u.system_role!='system_admin' ORDER BY u.sort_order,u.id`).all(project.id);
    const groups = db.prepare('SELECT id FROM controller_groups WHERE project_id=? AND parent_id IS NULL AND active=1 ORDER BY sort_order,id').all(project.id);
    const controllers = db.prepare('SELECT id FROM controllers WHERE project_id=? ORDER BY sort_order,id').all(project.id);
    if (!groups.length || !users.length) continue;
    users.forEach((user, index) => {
      const primary = groups[index % groups.length];
      addArea.run(project.id, user.id, primary.id, 0);
      if (groups.length > 1 && index % 3 === 0) addArea.run(project.id, user.id, groups[(index + 1) % groups.length].id, 1);
      for (let offset = 0; offset < 21; offset += 1) {
        const value = new Date(`${isoDate(offset)}T12:00:00Z`);
        if ([0, 6].includes(value.getUTCDay()) || (index + offset) % 5 === 0) continue;
        const area = groups[(index + Math.floor(offset / 5)) % groups.length];
        const shift = ['Dzień', 'Noc', 'Ogólne'][(index + offset) % 3];
        const transport = offset % 11 === 0 ? 'transport_only' : offset % 7 === 0 ? 'transport_work' : 'none';
        const workMode = (index + offset) % 4 === 0 ? 'offline' : 'online';
        addPlan.run(project.id, user.id, isoDate(offset), shift, area.id, workMode, transport, '', users[0].id);
        if ((index + offset) % 9 === 0) addPlan.run(project.id, user.id, isoDate(offset), shift, groups[(index + 1) % groups.length].id, workMode, 'none', 'Wsparcie drugiego obszaru', users[0].id);
      }
    });
    for (let index = 0; index < Math.min(8, users.length + 2); index += 1) {
      addAnnotation.run(project.id, `Plan zespołu · etap ${index + 1}`, 'Przykładowa adnotacja koordynacyjna widoczna w Kalendarzu.', isoDate(index * 3), isoDate(index * 3 + 1), controllers[index % Math.max(1, controllers.length)]?.id || null, users[index % users.length].id, ['blue', 'green', 'amber'][index % 3], users[0].id);
    }
  }
  db.prepare("INSERT INTO app_meta(key,value) VALUES('demo_v5_planner','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
}

function seedV8Demo(db) {
  const messages = [
    ['Plan rozruchu na najbliższy tydzień', 'Priorytetem pozostają testy bezpieczeństwa, zamknięcie punktów krytycznych i przygotowanie dowodów odbiorowych.'],
    ['Aktualizacja organizacji zmian', 'Planner został uzupełniony o bieżącą obsadę ON i OFF. Prosimy sprawdzić swoje przypisania przed rozpoczęciem zmiany.'],
    ['Przegląd otwartych punktów', 'Managerowie obszarów proszeni są o aktualizację terminów, odpowiedzialnych i dat przypomnienia dla aktywnych tematów.'],
    ['Standard dokumentowania testów', 'Do zakończonych punktów statusu należy dołączać krótki wynik testu albo odnośnik do dowodu.'],
    ['Gotowość do odbiorów', 'Cele odbiorowe są aktualizowane na podstawie powiązanych zadań, statusu i otwartych punktów.']
  ];
  for (const project of db.prepare('SELECT id FROM projects WHERE active=1 ORDER BY id').all()) {
    if (db.prepare('SELECT 1 FROM announcements WHERE project_id=? LIMIT 1').get(project.id)) continue;
    const author = db.prepare(`SELECT pm.user_id FROM project_memberships pm JOIN users u ON u.id=pm.user_id
      WHERE pm.project_id=? AND pm.active=1 AND u.active=1 ORDER BY (u.system_role='system_admin') DESC,u.sort_order,u.id LIMIT 1`).get(project.id)?.user_id;
    if (!author) continue;
    const roots = db.prepare('SELECT id FROM controller_groups WHERE project_id=? AND parent_id IS NULL ORDER BY sort_order,id').all(project.id);
    const recipients = db.prepare(`SELECT pm.user_id FROM project_memberships pm JOIN users u ON u.id=pm.user_id
      WHERE pm.project_id=? AND pm.active=1 AND u.active=1 AND u.system_role!='system_admin' ORDER BY u.sort_order,u.id LIMIT 3`).all(project.id);
    const insertMessage = db.prepare('INSERT INTO announcements(project_id,title,content,info_link,created_by) VALUES(?,?,?,?,?)');
    const insertScope = db.prepare('INSERT OR IGNORE INTO announcement_scopes(announcement_id,controller_group_id) VALUES(?,?)');
    const insertRecipient = db.prepare('INSERT OR IGNORE INTO announcement_users(announcement_id,user_id) VALUES(?,?)');
    messages.forEach((message, index) => {
      const result = insertMessage.run(project.id, message[0], message[1], '', author);
      const announcementId = Number(result.lastInsertRowid);
      if (index > 0 && roots.length) insertScope.run(announcementId, roots[(index - 1) % roots.length].id);
      if (index === 0) recipients.forEach(row => insertRecipient.run(announcementId, row.user_id));
    });
  }
}

function seedMigrationAudit(db) {
  for (const [type, table] of Object.entries(TABLES)) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    const insertAudit = db.prepare('INSERT INTO audit_log(project_id,entity_type,entity_id,action,user_id,changes_json,snapshot_json) VALUES(?,?,?,?,?,?,?)');
    for (const row of rows) {
      const existing = db.prepare('SELECT 1 FROM audit_log WHERE entity_type=? AND entity_id=? LIMIT 1').get(type, row.id);
      if (!existing) insertAudit.run(row.project_id || 1, type, row.id, 'migrate', null, JSON.stringify({ migrated: { from: null, to: 'V4' } }), JSON.stringify(row));
    }
  }
}

function createRepository(db) {
  const projectStorage = new AsyncLocalStorage();
  const activeProjectId = () => Number(projectStorage.getStore()) || 1;
  const one = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);
  const refreshControllerCodes = () => refreshControllerCodesForProject(db, activeProjectId());

  function controller(code) {
    const normalized = clean(code).replace(/^controller:/, '');
    const exact = one('SELECT * FROM controllers WHERE project_id=? AND code=?', activeProjectId(), normalized);
    if (exact) return exact;
    const legacyMatches = all('SELECT * FROM controllers WHERE project_id=? AND leaf_code=? COLLATE NOCASE ORDER BY id', activeProjectId(), normalized);
    if (legacyMatches.length === 1) return legacyMatches[0];
    if (legacyMatches.length > 1) throw appError('Nazwa sterownika jest niejednoznaczna. Wybierz pełną ścieżkę w hierarchii.');
    throw appError('Nieznany sterownik');
  }

  function functionGroup(id) {
    const value = one(`SELECT fg.*,c.code controller FROM function_groups fg
      JOIN controllers c ON c.id=fg.controller_id WHERE fg.id=? AND fg.project_id=?`, asId(id), activeProjectId());
    if (!value) throw appError('Nieznana grupa funkcyjna', 404);
    return value;
  }

  function userName(userId) {
    return userId ? one('SELECT display_name FROM users WHERE id=?', userId)?.display_name || '' : '';
  }

  function hierarchyData() {
    const rawGroups = all('SELECT * FROM controller_groups WHERE project_id=? AND active=1 ORDER BY sort_order,name,id', activeProjectId());
    const byParent = new Map();
    for (const group of rawGroups) {
      const parent = Number(group.parent_id || 0);
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent).push(group);
    }
    const groups = [];
    const walk = (parentId, path, rootId) => {
      for (const source of byParent.get(Number(parentId || 0)) || []) {
        const pathNames = [...path, source.name];
        const item = {
          ...source,
          depth: pathNames.length,
          root_group_id: rootId || source.id,
          path_names: pathNames,
          path_label: pathNames.join(' / '),
          display_name: pathNames.join(' / ')
        };
        groups.push(item);
        walk(source.id, pathNames, rootId || source.id);
      }
    };
    walk(null, [], null);
    const groupMap = new Map(groups.map(group => [group.id, group]));
    const controllers = all('SELECT * FROM controllers WHERE project_id=? ORDER BY sort_order,code,id', activeProjectId()).map(source => {
      const group = groupMap.get(Number(source.group_id));
      const leafCode = source.leaf_code || source.code;
      const hierarchyPath = [...(group?.path_names || []), leafCode];
      return {
        ...source, leaf_code: leafCode,
        group_name: group?.name || '',
        group_parent_id: group?.parent_id || null,
        group_depth: group?.depth || 0,
        root_group_id: group?.root_group_id || null,
        group_path: group?.path_names || [],
        group_path_label: group?.path_label || '',
        hierarchy_path: hierarchyPath,
        hierarchy_label: hierarchyPath.join(' / '),
        display_name: group ? `${group.name} ${leafCode}` : leafCode
      };
    });
    return { groups, controllers, groupMap };
  }

  function attachControllerMeta(row) {
    const item = hierarchyData().controllers.find(controller => controller.id === Number(row.controller_id));
    return item ? { ...row, controller_label: item.display_name, controller_path: item.hierarchy_label, root_group_id: item.root_group_id } : row;
  }

  function groupDescendantIds(groupId) {
    const hierarchy = hierarchyData();
    const selected = hierarchy.groups.find(group => group.id === Number(groupId));
    if (!selected) return [];
    return hierarchy.groups.filter(group => group.path_names.slice(0, selected.path_names.length).join('\u0000') === selected.path_names.join('\u0000')).map(group => group.id);
  }

  function hasHierarchyOverlap(groupIds) {
    const hierarchy = hierarchyData();
    const selected = hierarchy.groups.filter(group => groupIds.includes(group.id));
    return selected.some((left, index) => selected.some((right, otherIndex) => index !== otherIndex
      && right.path_names.length > left.path_names.length
      && right.path_names.slice(0, left.path_names.length).join('\u0000') === left.path_names.join('\u0000')));
  }

  function nextProjectIdentifier(entityType, prefix, table, column) {
    db.prepare('INSERT OR IGNORE INTO project_sequences(project_id,entity_type,next_value) VALUES(?,?,1)').run(activeProjectId(), entityType);
    let value = one('SELECT next_value FROM project_sequences WHERE project_id=? AND entity_type=?', activeProjectId(), entityType).next_value;
    const projectCode = one('SELECT code FROM projects WHERE id=?', activeProjectId())?.code || 'PRJ';
    let candidate = `${projectCode}-${prefix}-${String(value).padStart(4, '0')}`;
    while (one(`SELECT 1 FROM ${table} WHERE project_id=? AND ${column}=?`, activeProjectId(), candidate)) {
      value += 1;
      candidate = `${projectCode}-${prefix}-${String(value).padStart(4, '0')}`;
    }
    db.prepare('UPDATE project_sequences SET next_value=? WHERE project_id=? AND entity_type=?').run(value + 1, activeProjectId(), entityType);
    return candidate;
  }

  function controllersForScope(code) {
    const projectId = activeProjectId();
    if (!code || code === 'all') return all('SELECT * FROM controllers WHERE project_id=? ORDER BY sort_order,code', projectId);
    if (String(code).startsWith('group:')) {
      const groupId = asId(String(code).slice(6));
      const group = one('SELECT id FROM controller_groups WHERE id=? AND project_id=?', groupId, projectId);
      if (!group) throw appError('Nieznana grupa sterowników');
      return all(`WITH RECURSIVE descendants(id) AS (
        SELECT id FROM controller_groups WHERE id=? AND project_id=?
        UNION ALL SELECT cg.id FROM controller_groups cg JOIN descendants d ON cg.parent_id=d.id
      ) SELECT c.* FROM controllers c WHERE c.project_id=? AND c.group_id IN (SELECT id FROM descendants)
      ORDER BY c.sort_order,c.code`, groupId, projectId, projectId);
    }
    return [controller(code)];
  }

  function controllerFilter(code, alias) {
    const projectId = activeProjectId();
    const ids = controllersForScope(code).map(item => item.id);
    if (!ids.length) return { sql: ' WHERE 1=0', params: [] };
    return { sql: ` WHERE ${alias}.project_id=? AND ${alias}.controller_id IN (${ids.map(() => '?').join(',')})`, params: [projectId, ...ids] };
  }

  function insertRecord(table, values) {
    const keys = Object.keys(values);
    const result = db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(() => '?').join(',')})`).run(...keys.map(key => values[key]));
    return Number(result.lastInsertRowid);
  }

  function updateRecord(table, id, values, allowedFields) {
    const fields = allowedFields.filter(field => Object.hasOwn(values, field));
    if (!fields.length) return;
    const parameters = fields.map(field => values[field] === '' && (field.endsWith('_date') || field.endsWith('_id')) ? null : values[field]);
    const result = db.prepare(`UPDATE ${table} SET ${fields.map(field => `${field}=?`).join(',')},updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=?`).run(...parameters, id);
    if (!result.changes) throw appError('Nie znaleziono rekordu', 404);
  }

  function assertFresh(type, id, expectedUpdatedAt) {
    if (!id || !expectedUpdatedAt) return;
    const table = TABLES[type];
    const current = table ? one(`SELECT updated_at FROM ${table} WHERE id=? AND project_id=?`, id, activeProjectId()) : null;
    if (!current) throw appError('Nie znaleziono rekordu', 404);
    if (String(current.updated_at) !== String(expectedUpdatedAt)) {
      throw appError('Ten element został w międzyczasie zmieniony przez inną osobę. Otwórz go ponownie i połącz swoje zmiany z najnowszą wersją.', 409);
    }
  }

  function baseSnapshot(type, id) {
    const table = TABLES[type];
    const row = table ? one(`SELECT * FROM ${table} WHERE id=? AND project_id=?`, id, activeProjectId()) : null;
    if (!row) return null;
    if (type === 'task') {
      row.checklist = all('SELECT text,done,weight,owner_user_id,sort_order FROM task_checklist WHERE task_id=? ORDER BY sort_order,id', id);
      row.scope_checklist = all('SELECT controller_id,done,sort_order FROM task_scope_checklist WHERE task_id=? ORDER BY sort_order,controller_id', id);
      row.direct_assignee_user_ids = all('SELECT user_id FROM task_assignees WHERE project_id=? AND task_id=? AND assigned_directly=1 ORDER BY user_id', activeProjectId(), id).map(item => item.user_id);
      row.dependency_task_ids = all('SELECT prerequisite_task_id FROM task_dependencies WHERE project_id=? AND task_id=? ORDER BY prerequisite_task_id', activeProjectId(), id).map(item => item.prerequisite_task_id);
    }
    if (type === 'status') row.responsible_user_ids = all('SELECT user_id FROM status_assignees WHERE project_id=? AND status_id=? ORDER BY user_id', activeProjectId(), id).map(item => item.user_id);
    if (['status', 'task', 'point'].includes(type)) row.requirement_ids = all('SELECT requirement_id FROM entity_requirements WHERE project_id=? AND entity_type=? AND entity_id=? ORDER BY requirement_id', activeProjectId(), type, id).map(item => item.requirement_id);
    row.mentioned_user_ids = all('SELECT user_id FROM entity_mentions WHERE project_id=? AND entity_type=? AND entity_id=? ORDER BY user_id', activeProjectId(), type, id).map(item => item.user_id);
    if (type === 'goal') row.links = all('SELECT entity_type,entity_id FROM goal_links WHERE project_id=? AND goal_id=? ORDER BY entity_type,entity_id', activeProjectId(), id);
    if (['status', 'task', 'point', 'note'].includes(type)) row.links = entityLinkRows(type, id);
    return row;
  }

  function changesBetween(before, after) {
    if (!before) return { created: { from: null, to: true } };
    const changes = {};
    const keys = new Set([...Object.keys(before), ...Object.keys(after || {})]);
    for (const key of keys) {
      if (AUDIT_IGNORED.has(key)) continue;
      const left = before[key] ?? null;
      const right = after?.[key] ?? null;
      if (JSON.stringify(left) !== JSON.stringify(right)) changes[key] = { from: left, to: right };
    }
    return changes;
  }

  function writeAudit(type, id, action, user, before, after) {
    db.prepare('INSERT INTO audit_log(project_id,entity_type,entity_id,action,user_id,changes_json,snapshot_json) VALUES(?,?,?,?,?,?,?)').run(
      activeProjectId(), type, id, action, user?.id || null, JSON.stringify(changesBetween(before, after)), JSON.stringify(after || before || {})
    );
  }

  function setMentions(type, id, userIds) {
    db.prepare('DELETE FROM entity_mentions WHERE project_id=? AND entity_type=? AND entity_id=?').run(activeProjectId(), type, id);
    const insert = db.prepare('INSERT OR IGNORE INTO entity_mentions(project_id,entity_type,entity_id,user_id) VALUES(?,?,?,?)');
    for (const userId of Array.isArray(userIds) ? userIds : []) if (asId(userId)) insert.run(activeProjectId(), type, id, asId(userId));
  }

  function mentionIds(type, id) {
    return all('SELECT user_id FROM entity_mentions WHERE project_id=? AND entity_type=? AND entity_id=? ORDER BY user_id', activeProjectId(), type, id).map(row => row.user_id);
  }

  function commentRows(type, id) {
    return all(`SELECT ec.*,u.display_name user_name FROM entity_comments ec
      JOIN users u ON u.id=ec.user_id WHERE ec.project_id=? AND ec.entity_type=? AND ec.entity_id=?
      ORDER BY ec.created_at,ec.id`, activeProjectId(), type, id);
  }

  function requirementRows(type, id) {
    return all(`SELECT cr.id,cr.name,cr.description FROM entity_requirements er
      JOIN completion_requirements cr ON cr.id=er.requirement_id
      WHERE er.project_id=? AND er.entity_type=? AND er.entity_id=? AND cr.active=1
      ORDER BY cr.sort_order,cr.name`, activeProjectId(), type, id);
  }

  function setEntityRequirements(type, id, requested) {
    if (!['status', 'task', 'point'].includes(type)) return [];
    const ids = [...new Set((Array.isArray(requested) ? requested : []).map(asId).filter(Boolean))];
    for (const requirementId of ids) if (!one('SELECT 1 FROM completion_requirements WHERE id=? AND project_id=? AND active=1', requirementId, activeProjectId())) throw appError('Wybrane dodatkowe zapotrzebowanie nie należy do projektu');
    db.prepare('DELETE FROM entity_requirements WHERE project_id=? AND entity_type=? AND entity_id=?').run(activeProjectId(), type, id);
    const insert = db.prepare('INSERT INTO entity_requirements(project_id,entity_type,entity_id,requirement_id) VALUES(?,?,?,?)');
    ids.forEach(requirementId => insert.run(activeProjectId(), type, id, requirementId));
    return ids;
  }

  function createNotification(userId, kind, entityType, entityId, title, message = '') {
    if (!asId(userId)) return;
    if (!one('SELECT 1 FROM project_memberships WHERE project_id=? AND user_id=? AND active=1', activeProjectId(), asId(userId))) return;
    db.prepare(`INSERT INTO notifications(project_id,user_id,kind,entity_type,entity_id,title,message)
      VALUES(?,?,?,?,?,?,?)`).run(activeProjectId(), asId(userId), kind, entityType, entityId, clean(title), clean(message));
  }

  function entityDisplayTitle(type, id) {
    const row = one(`SELECT * FROM ${TABLES[type]} WHERE id=? AND project_id=?`, id, activeProjectId());
    if (!row) return 'Element projektu';
    return row.function_detail || row.title || 'Element projektu';
  }

  function notifyNewTaskAssignees(taskId, previousIds, nextIds, currentUser) {
    const previous = new Set((previousIds || []).map(Number));
    const title = entityDisplayTitle('task', taskId);
    for (const userId of new Set((nextIds || []).map(Number))) {
      if (!userId || userId === Number(currentUser?.id) || previous.has(userId)) continue;
      createNotification(userId, 'assignment', 'task', taskId, `Przypisano Ci zadanie: ${title}`, `${currentUser?.display_name || 'Użytkownik'} dodał Cię do osób odpowiedzialnych.`);
    }
  }

  function normalizedLinks(value) {
    return [...new Map((Array.isArray(value) ? value : []).map(link => [`${clean(link.entity_type)}:${asId(link.entity_id)}`, { entity_type: clean(link.entity_type), entity_id: asId(link.entity_id) }])).values()]
      .filter(link => TABLES[link.entity_type] && link.entity_id).sort((a, b) => `${a.entity_type}:${a.entity_id}`.localeCompare(`${b.entity_type}:${b.entity_id}`));
  }

  function ensureDuplicateChanged(type, sourceId, candidate) {
    if (!asId(sourceId)) return;
    const source = baseSnapshot(type, asId(sourceId));
    if (!source) throw appError('Nie znaleziono elementu źródłowego do duplikacji', 404);
    const fields = {
      status: ['controller_id', 'function_group_id', 'function_group_element_id', 'function_group_subcategory_id', 'station', 'function_detail', 'category', 'subcategory', 'criticality', 'status', 'checked_by', 'checked_on', 'current_note', 'evidence_link', 'responsible_user_ids', 'requirement_ids', 'links'],
      task: ['controller_id', 'controller_group_id', 'title', 'description', 'station', 'function_group_id', 'function_group_element_id', 'other_object', 'priority', 'status', 'start_date', 'due_date', 'category', 'subcategory', 'info_link', 'direct_assignee_user_ids', 'checklist', 'scope_checklist', 'dependency_task_ids', 'requirement_ids', 'links'],
      point: ['controller_id', 'title', 'description', 'impact', 'priority', 'owner_user_id', 'status', 'waiting_for', 'next_action', 'start_date', 'due_date', 'reminder_date', 'category', 'subcategory', 'info_link', 'requirement_ids', 'links'],
      goal: ['controller_id', 'title', 'description', 'status', 'priority', 'due_date', 'links']
    }[type] || [];
    const normalize = (field, value) => {
      if (field === 'links') return normalizedLinks(value);
      if (field === 'checklist') return (value || []).map((item, index) => ({ text: clean(item.text), done: item.done ? 1 : 0, weight: Number(item.weight || 1), owner_user_id: asId(item.owner_user_id), sort_order: index }));
      if (field === 'scope_checklist') return (value || []).map((item, index) => ({ controller_id: asId(item.controller_id), done: item.done ? 1 : 0, sort_order: index }));
      if (field.endsWith('_ids')) return [...new Set((value || []).map(Number).filter(Boolean))].sort((a, b) => a - b);
      return value ?? null;
    };
    const left = Object.fromEntries(fields.map(field => [field, normalize(field, source[field])]));
    const right = Object.fromEntries(fields.map(field => [field, normalize(field, candidate[field])]));
    if (JSON.stringify(left) === JSON.stringify(right)) throw appError('Duplikat musi różnić się od elementu źródłowego co najmniej jednym polem');
  }

  function canDeleteTask(task, user) {
    if (['system_admin', 'project_admin'].includes(user.role)) return true;
    if (!['user', 'moderator'].includes(user.role) || task.created_by !== user.id) return false;
    return !one("SELECT 1 FROM audit_log WHERE project_id=? AND entity_type='task' AND entity_id=? AND action='update' AND user_id IS NOT NULL AND user_id!=? LIMIT 1", activeProjectId(), task.id, user.id);
  }

  function setEntityLinks(sourceType, sourceId, links, currentUser) {
    db.prepare(`DELETE FROM entity_links WHERE project_id=? AND
      ((source_type=? AND source_id=?) OR (target_type=? AND target_id=?))`).run(activeProjectId(), sourceType, sourceId, sourceType, sourceId);
    if (sourceType === 'goal') db.prepare('DELETE FROM goal_links WHERE project_id=? AND goal_id=?').run(activeProjectId(), sourceId);
    else if (['status', 'task', 'point'].includes(sourceType)) db.prepare('DELETE FROM goal_links WHERE project_id=? AND entity_type=? AND entity_id=?').run(activeProjectId(), sourceType, sourceId);
    const insert = db.prepare(`INSERT OR IGNORE INTO entity_links(project_id,source_type,source_id,target_type,target_id,created_by)
      VALUES(?,?,?,?,?,?)`);
    const insertGoalLink = db.prepare('INSERT OR IGNORE INTO goal_links(project_id,goal_id,entity_type,entity_id) VALUES(?,?,?,?)');
    const seen = new Set();
    for (const link of Array.isArray(links) ? links : []) {
      if (!['status', 'task', 'point', 'note', 'goal'].includes(link.entity_type) || !asId(link.entity_id)) continue;
      if (link.entity_type === sourceType && asId(link.entity_id) === Number(sourceId)) continue;
      const table = TABLES[link.entity_type];
      if (!table || !one(`SELECT 1 FROM ${table} WHERE id=? AND project_id=?`, asId(link.entity_id), activeProjectId())) continue;
      const pair = canonicalLink(sourceType, sourceId, link.entity_type, asId(link.entity_id));
      const key = pair.join(':');
      if (seen.has(key)) continue;
      seen.add(key);
      insert.run(activeProjectId(), pair[0], pair[1], pair[2], pair[3], currentUser?.id || null);
      if (sourceType === 'goal' && ['status', 'task', 'point'].includes(link.entity_type)) insertGoalLink.run(activeProjectId(), sourceId, link.entity_type, asId(link.entity_id));
      if (link.entity_type === 'goal' && ['status', 'task', 'point'].includes(sourceType)) insertGoalLink.run(activeProjectId(), asId(link.entity_id), sourceType, sourceId);
    }
  }

  function entityLinkRows(type, id) {
    const seen = new Set();
    return all(`SELECT source_type,source_id,target_type,target_id FROM entity_links
      WHERE project_id=? AND ((source_type=? AND source_id=?) OR (target_type=? AND target_id=?))
      ORDER BY id`, activeProjectId(), type, id, type, id).map(row => row.source_type === type && row.source_id === id
      ? { entity_type: row.target_type, entity_id: row.target_id }
      : { entity_type: row.source_type, entity_id: row.source_id }).filter(link => {
        const key = `${link.entity_type}:${link.entity_id}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
  }

  function linkedItemStatus(link) {
    if (link.entity_type === 'note') return null;
    const table = TABLES[link.entity_type];
    if (!table) return null;
    return one(`SELECT status FROM ${table} WHERE id=? AND project_id=?`, link.entity_id, activeProjectId())?.status || null;
  }

  function taskDependencyRows(taskId, direction = 'prerequisites') {
    const prerequisite = direction === 'prerequisites';
    const joinField = prerequisite ? 'td.prerequisite_task_id' : 'td.task_id';
    const whereField = prerequisite ? 'td.task_id' : 'td.prerequisite_task_id';
    return all(`SELECT t.id,t.title,t.status,t.priority,t.start_date,t.due_date,c.code controller,c.id controller_id,
      td.lag_days,creator.display_name created_by_name,owner.display_name owner_name
      FROM task_dependencies td JOIN tasks t ON t.id=${joinField}
      JOIN controllers c ON c.id=t.controller_id
      LEFT JOIN users creator ON creator.id=t.created_by LEFT JOIN users owner ON owner.id=t.owner_user_id
      WHERE td.project_id=? AND ${whereField}=? ORDER BY t.due_date IS NULL,t.due_date,t.title`, activeProjectId(), taskId)
      .map(row => attachControllerMeta(row));
  }

  function setTaskDependencies(taskId, requested, currentUser) {
    const ids = [...new Set((Array.isArray(requested) ? requested : []).map(asId).filter(Boolean))];
    if (ids.includes(Number(taskId))) throw appError('Zadanie nie może zależeć od samego siebie');
    for (const dependencyId of ids) {
      if (!one('SELECT 1 FROM tasks WHERE id=? AND project_id=?', dependencyId, activeProjectId())) throw appError('Wybrane zadanie zależne nie należy do projektu');
    }
    for (const dependencyId of ids) {
      const cycle = one(`WITH RECURSIVE chain(id) AS (
        SELECT prerequisite_task_id FROM task_dependencies WHERE project_id=? AND task_id=?
        UNION SELECT td.prerequisite_task_id FROM task_dependencies td JOIN chain c ON td.task_id=c.id WHERE td.project_id=?
      ) SELECT 1 found FROM chain WHERE id=? LIMIT 1`, activeProjectId(), dependencyId, activeProjectId(), taskId);
      if (cycle) throw appError('Ta zależność utworzyłaby cykl pomiędzy zadaniami');
    }
    db.prepare('DELETE FROM task_dependencies WHERE project_id=? AND task_id=?').run(activeProjectId(), taskId);
    const insert = db.prepare('INSERT INTO task_dependencies(project_id,task_id,prerequisite_task_id,created_by) VALUES(?,?,?,?)');
    for (const dependencyId of ids) insert.run(activeProjectId(), taskId, dependencyId, currentUser?.id || null);
    return ids;
  }

  function decorateStatus(row, currentUser) {
    const links = entityLinkRows('status', row.id).map(link => ({ ...link, status: linkedItemStatus(link) }));
    const actionable = links.filter(link => ['task', 'point'].includes(link.entity_type));
    const completed = actionable.filter(link => ['Done', 'Closed'].includes(link.status)).length;
    const assignees = all(`SELECT sa.user_id,u.display_name FROM status_assignees sa JOIN users u ON u.id=sa.user_id
      WHERE sa.project_id=? AND sa.status_id=? ORDER BY u.sort_order,u.display_name`, activeProjectId(), row.id);
    const requirements = requirementRows('status', row.id);
    return {
      ...row, links, related_work_total: actionable.length, related_work_done: completed,
      related_work_progress: actionable.length ? Math.round(completed * 100 / actionable.length) : 100,
      assignees,
      responsible_user_ids: assignees.map(item => item.user_id),
      responsible_name: assignees.map(item => item.display_name).join(', ') || row.responsible_name || '',
      mentioned_user_ids: [], comments: commentRows('status', row.id), requirements,
      requirement_ids: requirements.map(item => item.id), requirement_names: requirements.map(item => item.name).join(', '),
      can_delete: ['system_admin', 'project_admin'].includes(currentUser.role)
    };
  }

  function decorateTask(row, currentUser) {
    const checklist = all(`SELECT tc.*,u.display_name owner_name FROM task_checklist tc
      LEFT JOIN users u ON u.id=tc.owner_user_id WHERE tc.task_id=? ORDER BY tc.sort_order,tc.id`, row.id);
    const hierarchy = hierarchyData();
    const scopeGroup = hierarchy.groups.find(group => group.id === Number(row.controller_group_id));
    const scopeChecklist = all('SELECT * FROM task_scope_checklist WHERE task_id=? ORDER BY sort_order,controller_id', row.id).map(item => {
      const controllerItem = hierarchy.controllers.find(controller => controller.id === Number(item.controller_id));
      return { ...item, controller: controllerItem?.code || '', controller_label: controllerItem?.display_name || '', controller_path: controllerItem?.hierarchy_label || '' };
    });
    const assignees = all(`SELECT ta.user_id,ta.assigned_directly,u.display_name FROM task_assignees ta
      JOIN users u ON u.id=ta.user_id WHERE ta.project_id=? AND ta.task_id=? ORDER BY u.sort_order,u.display_name`, activeProjectId(), row.id);
    const requirements = requirementRows('task', row.id);
    const totalWeight = checklist.reduce((sum, item) => sum + Number(item.weight || 1), 0) + scopeChecklist.length;
    const doneWeight = checklist.filter(item => item.done).reduce((sum, item) => sum + Number(item.weight || 1), 0) + scopeChecklist.filter(item => item.done).length;
    const progress = totalWeight ? Math.round(doneWeight * 100 / totalWeight) : row.status === 'Done' ? 100 : row.status === 'In progress' ? 50 : 0;
    const dependencies = taskDependencyRows(row.id, 'prerequisites');
    const dependents = taskDependencyRows(row.id, 'dependents');
    return {
      ...row,
      checklist,
      scope_checklist: scopeChecklist,
      scope_is_group: Boolean(scopeGroup),
      scope_label: scopeGroup?.path_label || row.controller_label || row.controller,
      scope_path: scopeGroup?.path_label || row.controller_path || row.controller,
      assignees,
      assignee_user_ids: assignees.map(item => item.user_id),
      direct_assignee_user_ids: assignees.filter(item => item.assigned_directly).map(item => item.user_id),
      owner_name: assignees.map(item => item.display_name).join(', ') || row.owner_name || '',
      progress,
      dependencies,
      dependents,
      dependency_task_ids: dependencies.map(item => item.id),
      blocked_by_dependencies: dependencies.filter(item => item.status !== 'Done').length,
      links: entityLinkRows('task', row.id),
      mentioned_user_ids: [], comments: commentRows('task', row.id), requirements,
      requirement_ids: requirements.map(item => item.id), requirement_names: requirements.map(item => item.name).join(', '),
      can_delete: canDeleteTask(row, currentUser)
    };
  }

  function decoratePoint(row, currentUser) {
    const requirements = requirementRows('point', row.id);
    return { ...row, links: entityLinkRows('point', row.id), mentioned_user_ids: mentionIds('point', row.id), comments: commentRows('point', row.id), requirements, requirement_ids: requirements.map(item => item.id), requirement_names: requirements.map(item => item.name).join(', '), can_delete: ['system_admin', 'project_admin'].includes(currentUser.role) };
  }

  function decorateNote(row, currentUser) {
    const hierarchy = hierarchyData();
    const group = hierarchy.groups.find(item => item.id === Number(row.controller_group_id));
    const controllerItem = hierarchy.controllers.find(item => item.id === Number(row.controller_id));
    return {
      ...row,
      scope_label: group?.path_label || controllerItem?.display_name || 'Cały projekt',
      scope_path: group?.path_label || controllerItem?.hierarchy_label || 'Cały projekt',
      links: entityLinkRows('note', row.id),
      mentioned_user_ids: mentionIds('note', row.id),
      can_delete: ['system_admin', 'project_admin'].includes(currentUser.role) || row.created_by === currentUser.id
    };
  }

  function saveChecklist(taskId, checklist) {
    db.prepare('DELETE FROM task_checklist WHERE task_id=?').run(taskId);
    const insert = db.prepare('INSERT INTO task_checklist(task_id,text,done,weight,owner_user_id,sort_order) VALUES(?,?,?,?,?,?)');
    (Array.isArray(checklist) ? checklist : []).forEach((item, index) => {
      const ownerId = asId(item.owner_user_id);
      if (ownerId && !one(`SELECT 1 FROM users u JOIN project_memberships pm ON pm.user_id=u.id
        WHERE u.id=? AND u.active=1 AND pm.project_id=? AND pm.active=1`, ownerId, activeProjectId())) throw appError(`Podzadanie ${index + 1}: użytkownik nie jest aktywny w projekcie`);
      const weight = Math.max(0.1, Math.min(1000, Number(item.weight) || 1));
      if (clean(item.text)) insert.run(taskId, clean(item.text), item.done ? 1 : 0, weight, ownerId, index);
    });
  }

  function controllersInGroup(groupId) {
    const descendantIds = new Set(groupDescendantIds(groupId));
    return hierarchyData().controllers.filter(item => descendantIds.has(Number(item.group_id)));
  }

  function saveTaskScopeChecklist(taskId, groupId, requested) {
    const existing = new Map(all('SELECT controller_id,done FROM task_scope_checklist WHERE task_id=?', taskId).map(item => [item.controller_id, Boolean(item.done)]));
    const submitted = Array.isArray(requested) ? new Map(requested.map(item => [asId(item.controller_id), Boolean(item.done)]).filter(([id]) => id)) : null;
    db.prepare('DELETE FROM task_scope_checklist WHERE task_id=?').run(taskId);
    if (!groupId) return [];
    const controllers = controllersInGroup(groupId);
    if (!controllers.length) throw appError('Wybrany obszar nie zawiera żadnego sterownika końcowego');
    const insert = db.prepare('INSERT INTO task_scope_checklist(task_id,controller_id,done,sort_order) VALUES(?,?,?,?)');
    controllers.forEach((item, index) => insert.run(taskId, item.id, (submitted?.get(item.id) ?? existing.get(item.id)) ? 1 : 0, index));
    return controllers;
  }

  function saveTaskAssignees(taskId, directUserIds, checklist) {
    const direct = new Set((Array.isArray(directUserIds) ? directUserIds : []).map(asId).filter(Boolean));
    const checklistUsers = new Set((Array.isArray(checklist) ? checklist : []).map(item => asId(item.owner_user_id)).filter(Boolean));
    const users = new Set([...direct, ...checklistUsers]);
    for (const userId of users) if (!one(`SELECT 1 FROM users u JOIN project_memberships pm ON pm.user_id=u.id
      WHERE u.id=? AND u.active=1 AND pm.project_id=? AND pm.active=1`, userId, activeProjectId())) throw appError('Wybrany użytkownik nie jest aktywny w projekcie');
    db.prepare('DELETE FROM task_assignees WHERE project_id=? AND task_id=?').run(activeProjectId(), taskId);
    const insert = db.prepare('INSERT INTO task_assignees(project_id,task_id,user_id,assigned_directly) VALUES(?,?,?,?)');
    for (const userId of users) insert.run(activeProjectId(), taskId, userId, direct.has(userId) ? 1 : 0);
    return [...users];
  }

  function saveStatusAssignees(statusId, userIds) {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map(asId).filter(Boolean))];
    for (const userId of ids) if (!one(`SELECT 1 FROM users u JOIN project_memberships pm ON pm.user_id=u.id
      WHERE u.id=? AND u.active=1 AND pm.project_id=? AND pm.active=1`, userId, activeProjectId())) throw appError('Wybrany odpowiedzialny nie jest aktywnym pracownikiem projektu');
    db.prepare('DELETE FROM status_assignees WHERE project_id=? AND status_id=?').run(activeProjectId(), statusId);
    const insert = db.prepare('INSERT INTO status_assignees(project_id,status_id,user_id) VALUES(?,?,?)');
    ids.forEach(userId => insert.run(activeProjectId(), statusId, userId));
    return ids;
  }

  function removeWithAudit(type, id, user) {
    const table = TABLES[type];
    const before = baseSnapshot(type, id);
    if (!before) throw appError('Nie znaleziono rekordu', 404);
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
    db.prepare('DELETE FROM entity_mentions WHERE project_id=? AND entity_type=? AND entity_id=?').run(activeProjectId(), type, id);
    db.prepare('DELETE FROM entity_links WHERE project_id=? AND ((source_type=? AND source_id=?) OR (target_type=? AND target_id=?))').run(activeProjectId(), type, id, type, id);
    db.prepare('DELETE FROM calendar_item_dates WHERE project_id=? AND entity_type=? AND entity_id=?').run(activeProjectId(), type, id);
    db.prepare('DELETE FROM entity_comments WHERE project_id=? AND entity_type=? AND entity_id=?').run(activeProjectId(), type, id);
    db.prepare('DELETE FROM entity_requirements WHERE project_id=? AND entity_type=? AND entity_id=?').run(activeProjectId(), type, id);
    if (['status', 'task', 'point'].includes(type)) db.prepare('DELETE FROM goal_links WHERE project_id=? AND entity_type=? AND entity_id=?').run(activeProjectId(), type, id);
    writeAudit(type, id, 'delete', user, before, null);
  }

  function statusRows(code, currentUser) {
    const filter = controllerFilter(code, 's');
    return all(`SELECT s.*,c.code controller,c.sort_order controller_order,
      creator.display_name created_by_name,responsible.display_name responsible_name,
      fg.name function_group_name,COALESCE(fg.sort_order,9999) function_group_order,
      fge.name function_group_element_name,
      fgs.name function_group_subcategory_name,
      COALESCE(fgc.sort_order,9999) function_check_order,
      COALESCE(cat.sort_order,9999) category_order,COALESCE(sub.sort_order,9999) subcategory_order
      FROM status_items s
      JOIN controllers c ON c.id=s.controller_id
      LEFT JOIN users creator ON creator.id=s.created_by
      LEFT JOIN users responsible ON responsible.id=s.responsible_user_id
      LEFT JOIN function_groups fg ON fg.id=s.function_group_id
      LEFT JOIN function_group_elements fge ON fge.id=s.function_group_element_id
      LEFT JOIN function_group_subcategories fgs ON fgs.id=s.function_group_subcategory_id
      LEFT JOIN function_group_checks fgc ON fgc.id=s.function_group_check_id
      LEFT JOIN categories cat ON cat.project_id=s.project_id AND cat.name=s.category
      LEFT JOIN subcategories sub ON sub.category_id=cat.id AND sub.name=s.subcategory
      ${filter.sql}
      ORDER BY c.sort_order,function_group_order,category_order,function_check_order,subcategory_order,s.id`, ...filter.params).map(row => decorateStatus(attachControllerMeta(row), currentUser));
  }

  function taskRows(code, currentUser) {
    const selectedControllerIds = new Set(controllersForScope(code).map(item => item.id));
    const groupControllerCache = new Map();
    const matchesScope = row => {
      if (!code || code === 'all') return true;
      if (!row.controller_group_id) return selectedControllerIds.has(Number(row.controller_id));
      if (!groupControllerCache.has(row.controller_group_id)) groupControllerCache.set(row.controller_group_id, new Set(controllersInGroup(row.controller_group_id).map(item => item.id)));
      return [...groupControllerCache.get(row.controller_group_id)].some(id => selectedControllerIds.has(id));
    };
    return all(`SELECT t.*,c.code controller,c.sort_order controller_order,
      creator.display_name created_by_name,owner.display_name owner_name,
      fg.name function_group_name,fge.name function_group_element_name,
      COALESCE(cat.sort_order,9999) category_order,COALESCE(sub.sort_order,9999) subcategory_order
      FROM tasks t
      JOIN controllers c ON c.id=t.controller_id
      LEFT JOIN users creator ON creator.id=t.created_by
      LEFT JOIN users owner ON owner.id=t.owner_user_id
      LEFT JOIN function_groups fg ON fg.id=t.function_group_id
      LEFT JOIN function_group_elements fge ON fge.id=t.function_group_element_id
      LEFT JOIN task_categories cat ON cat.project_id=t.project_id AND cat.name=t.category
      LEFT JOIN task_subcategories sub ON sub.category_id=cat.id AND sub.name=t.subcategory
      WHERE t.project_id=?
      ORDER BY c.sort_order,t.created_at DESC,t.id DESC`, activeProjectId()).filter(matchesScope).map(row => decorateTask(attachControllerMeta(row), currentUser));
  }

  function pointRows(code, currentUser) {
    const filter = controllerFilter(code, 'p');
    return all(`SELECT p.*,c.code controller,c.sort_order controller_order,
      creator.display_name created_by_name,owner.display_name owner_name,
      COALESCE(cat.sort_order,9999) category_order,COALESCE(sub.sort_order,9999) subcategory_order
      FROM open_points p
      JOIN controllers c ON c.id=p.controller_id
      LEFT JOIN users creator ON creator.id=p.created_by
      LEFT JOIN users owner ON owner.id=p.owner_user_id
      LEFT JOIN categories cat ON cat.project_id=p.project_id AND cat.name=p.category
      LEFT JOIN subcategories sub ON sub.category_id=cat.id AND sub.name=p.subcategory
      ${filter.sql}
      ORDER BY c.sort_order,p.created_at DESC,p.id DESC`, ...filter.params).map(row => decoratePoint(attachControllerMeta(row), currentUser));
  }

  function noteRows(code, from, to, currentUser) {
    const params = [activeProjectId()];
    const conditions = ['n.project_id=?'];
    if (from) { conditions.push('n.note_date>=?'); params.push(from); }
    if (to) { conditions.push('n.note_date<=?'); params.push(to); }
    const where = ` WHERE ${conditions.join(' AND ')}`;
    const rows = all(`SELECT n.*,c.code controller,c.sort_order controller_order,creator.display_name created_by_name
      FROM daily_notes n
      LEFT JOIN controllers c ON c.id=n.controller_id
      LEFT JOIN users creator ON creator.id=n.created_by
      ${where}
      ORDER BY n.note_date DESC,n.created_at DESC,n.id DESC`, ...params);
    if (!code || code === 'all') return rows.map(row => decorateNote(attachControllerMeta(row), currentUser));
    const selectedControllerIds = new Set(controllersForScope(code).map(item => Number(item.id)));
    const groupControllers = new Map();
    const matches = row => {
      if (!row.controller_id && !row.controller_group_id) return true;
      if (row.controller_id) return selectedControllerIds.has(Number(row.controller_id));
      if (!groupControllers.has(Number(row.controller_group_id))) groupControllers.set(Number(row.controller_group_id), new Set(controllersInGroup(row.controller_group_id).map(item => Number(item.id))));
      return [...groupControllers.get(Number(row.controller_group_id))].some(id => selectedControllerIds.has(id));
    };
    return rows.filter(matches).map(row => decorateNote(attachControllerMeta(row), currentUser));
  }

  function goalRows(code, currentUser) {
    const filter = controllerFilter(code, 'g');
    return all(`SELECT g.*,c.code controller,c.sort_order controller_order,creator.display_name created_by_name
      FROM goals g LEFT JOIN controllers c ON c.id=g.controller_id LEFT JOIN users creator ON creator.id=g.created_by
      ${filter.sql} ORDER BY g.due_date IS NULL,g.due_date,g.id DESC`, ...filter.params).map(goal => ({
        ...attachControllerMeta(goal),
        links: all('SELECT * FROM goal_links WHERE project_id=? AND goal_id=? ORDER BY entity_type,entity_id', activeProjectId(), goal.id),
        comments: commentRows('goal', goal.id),
        can_delete: ['system_admin', 'project_admin'].includes(currentUser.role)
      }));
  }

  function dashboardForController(controllerId) {
    return dashboardForControllers([controllerId]);
  }

  function taskMetricRows(controllerIds) {
    const selected = new Set(controllerIds.map(Number));
    const groupCache = new Map();
    return all('SELECT id,controller_id,controller_group_id,status,due_date,created_at FROM tasks WHERE project_id=?', activeProjectId()).filter(row => {
      if (!row.controller_group_id) return selected.has(Number(row.controller_id));
      if (!groupCache.has(row.controller_group_id)) groupCache.set(row.controller_group_id, controllersInGroup(row.controller_group_id).map(item => item.id));
      return groupCache.get(row.controller_group_id).some(id => selected.has(Number(id)));
    });
  }

  function taskMetrics(controllerIds) {
    const rows = taskMetricRows(controllerIds);
    const todayValue = new Date().toISOString().slice(0, 10);
    return {
      total: rows.length,
      todo: rows.filter(row => row.status === 'To do').length,
      in_progress: rows.filter(row => row.status === 'In progress').length,
      done: rows.filter(row => row.status === 'Done').length,
      overdue: rows.filter(row => row.status !== 'Done' && row.due_date && row.due_date < todayValue).length
    };
  }

  function dashboardForControllers(controllerIds) {
    if (!controllerIds.length) return {
      status: { total: 0, done: 0, in_progress: 0, blocked: 0, progress: 0 },
      tasks: { total: 0, todo: 0, in_progress: 0, done: 0, overdue: 0, progress: 0 },
      points: { total: 0, open: 0, waiting: 0, closed: 0, reminders_overdue: 0, progress: 0 },
      goals: { total: 0, done: 0, in_progress: 0, overdue: 0, progress: 0 }
    };
    const placeholders = controllerIds.map(() => '?').join(',');
    const status = one(`SELECT COUNT(*) total,SUM(status='Done') done,SUM(status='In progress') in_progress,SUM(status IN ('Blocked','NOK / Rework')) blocked FROM status_items WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds);
    const tasks = taskMetrics(controllerIds);
    const points = one(`SELECT COUNT(*) total,SUM(status!='Closed') open,SUM(status='Waiting') waiting,SUM(status='Closed') closed,SUM(status!='Closed' AND reminder_date IS NOT NULL AND reminder_date<date('now')) reminders_overdue FROM open_points WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds);
    const goals = one(`SELECT COUNT(*) total,SUM(status='Done') done,SUM(status='In progress') in_progress,SUM(status!='Done' AND due_date IS NOT NULL AND due_date<date('now')) overdue FROM goals WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds);
    const normalize = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, Number(value || 0)]));
    const result = { status: normalize(status), tasks: normalize(tasks), points: normalize(points), goals: normalize(goals) };
    result.status.progress = result.status.total ? Math.round(result.status.done * 100 / result.status.total) : 0;
    result.tasks.progress = result.tasks.total ? Math.round(result.tasks.done * 100 / result.tasks.total) : 0;
    result.points.progress = result.points.total ? Math.round(result.points.closed * 100 / result.points.total) : 0;
    result.goals.progress = result.goals.total ? Math.round(result.goals.done * 100 / result.goals.total) : 0;
    return result;
  }

  function overviewTrends(controllerIds) {
    if (!controllerIds.length) return { day: [], week: [], month: [] };
    const placeholders = controllerIds.map(() => '?').join(',');
    const entityData = {
      status: all(`SELECT id,status,created_at FROM status_items WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds),
      task: taskMetricRows(controllerIds).map(({ id, status, created_at }) => ({ id, status, created_at })),
      point: all(`SELECT id,status,created_at FROM open_points WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds),
      goal: all(`SELECT id,status,created_at FROM goals WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds)
    };
    const idsByType = Object.fromEntries(Object.entries(entityData).map(([type, rows]) => [type, new Set(rows.map(row => row.id))]));
    const audits = all(`SELECT entity_type,entity_id,changed_at,snapshot_json FROM audit_log
      WHERE project_id=? AND entity_type IN ('status','task','point','goal') ORDER BY changed_at,id`, activeProjectId()).filter(row => idsByType[row.entity_type]?.has(row.entity_id));
    const auditMap = new Map();
    for (const row of audits) {
      const key = `${row.entity_type}:${row.entity_id}`;
      if (!auditMap.has(key)) auditMap.set(key, []);
      let snapshot = {};
      try { snapshot = JSON.parse(row.snapshot_json || '{}'); } catch {}
      auditMap.get(key).push({ at: new Date(`${row.changed_at.replace(' ', 'T')}Z`), status: snapshot.status });
    }
    const progressAt = (type, end) => {
      const doneValues = type === 'point' ? new Set(['Closed']) : new Set(['Done']);
      const eligible = entityData[type].filter(row => new Date(`${row.created_at.replace(' ', 'T')}Z`) <= end);
      let done = 0;
      for (const row of eligible) {
        const events = auditMap.get(`${type}:${row.id}`) || [];
        const event = [...events].reverse().find(item => item.at <= end);
        if (doneValues.has(event?.status || row.status)) done += 1;
      }
      return { progress: eligible.length ? Math.round(done * 100 / eligible.length) : 0, total: eligible.length, done };
    };
    const makeSeries = (kind, count) => {
      const result = [];
      for (let offset = count - 1; offset >= 0; offset -= 1) {
        const end = new Date();
        end.setUTCHours(23, 59, 59, 999);
        if (kind === 'day') end.setUTCDate(end.getUTCDate() - offset);
        if (kind === 'week') { end.setUTCDate(end.getUTCDate() - offset * 7); end.setUTCDate(end.getUTCDate() + (7 - (end.getUTCDay() || 7))); }
        if (kind === 'month') { end.setUTCMonth(end.getUTCMonth() - offset + 1, 0); }
        const label = kind === 'day' ? end.toISOString().slice(5, 10) : kind === 'week' ? `CW${isoWeekNumber(end)}` : end.toLocaleString('pl-PL', { month: 'short', timeZone: 'UTC' });
        result.push({ label, status: progressAt('status', end), tasks: progressAt('task', end), points: progressAt('point', end), goals: progressAt('goal', end) });
      }
      return result;
    };
    return { day: makeSeries('day', 14), week: makeSeries('week', 12), month: makeSeries('month', 6) };
  }

  function isoWeekNumber(value) {
    const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
    const day = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - day);
    const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    return Math.ceil((((date - start) / 86400000) + 1) / 7);
  }

  const projectBackupTables = [
    ['controller_groups', 'project_id=?'], ['controllers', 'project_id=?'], ['categories', 'project_id=?'],
    ['subcategories', 'category_id IN (SELECT id FROM categories WHERE project_id=?)'],
    ['task_categories', 'project_id=?'], ['task_subcategories', 'category_id IN (SELECT id FROM task_categories WHERE project_id=?)'],
    ['options', 'project_id=?'], ['settings', 'project_id=?'], ['completion_requirements', 'project_id=?'], ['function_groups', 'project_id=?'],
    ['function_group_elements', 'function_group_id IN (SELECT id FROM function_groups WHERE project_id=?)'],
    ['function_group_subcategories', 'function_group_id IN (SELECT id FROM function_groups WHERE project_id=?)'],
    ['function_group_checks', 'function_group_id IN (SELECT id FROM function_groups WHERE project_id=?)'],
    ['function_group_check_subcategories', 'check_id IN (SELECT id FROM function_group_checks WHERE function_group_id IN (SELECT id FROM function_groups WHERE project_id=?))'],
    ['status_items', 'project_id=?'], ['status_assignees', 'project_id=?'], ['tasks', 'project_id=?'], ['task_dependencies', 'project_id=?'],
    ['task_checklist', 'task_id IN (SELECT id FROM tasks WHERE project_id=?)'],
    ['task_scope_checklist', 'task_id IN (SELECT id FROM tasks WHERE project_id=?)'],
    ['task_assignees', 'project_id=?'], ['project_user_areas', 'project_id=?'], ['planner_entries', 'project_id=?'], ['planner_requirements', 'project_id=?'], ['planner_holidays', 'project_id=?'], ['planner_absences', 'project_id=?'], ['planner_time_adjustments', 'project_id=?'],
    ['calendar_annotations', 'project_id=?'], ['calendar_item_dates', 'project_id=?'],
    ['open_points', 'project_id=?'], ['daily_notes', 'project_id=?'], ['goals', 'project_id=?'],
    ['goal_links', 'project_id=?'], ['entity_mentions', 'project_id=?'], ['entity_links', 'project_id=?'], ['entity_requirements', 'project_id=?'], ['entity_comments', 'project_id=?'], ['notifications', 'project_id=?'],
    ['announcements', 'project_id=?'],
    ['announcement_labels', 'project_id=?'],
    ['announcement_label_links', 'announcement_id IN (SELECT id FROM announcements WHERE project_id=?)'],
    ['announcement_scopes', 'announcement_id IN (SELECT id FROM announcements WHERE project_id=?)'],
    ['announcement_users', 'announcement_id IN (SELECT id FROM announcements WHERE project_id=?)'],
    ['announcement_links', 'announcement_id IN (SELECT id FROM announcements WHERE project_id=?)'],
    ['announcement_reads', 'announcement_id IN (SELECT id FROM announcements WHERE project_id=?)'],
    ['shift_handovers', 'project_id=?'], ['shift_handover_items', 'handover_id IN (SELECT id FROM shift_handovers WHERE project_id=?)'],
    ['automation_rules', 'project_id=?'], ['automation_rule_hits', 'rule_id IN (SELECT id FROM automation_rules WHERE project_id=?)'],
    ['commissioning_templates', 'project_id=?'], ['saved_views', 'project_id=?'],
    ['audit_log', 'project_id=?'], ['export_templates', 'project_id=?'], ['project_sequences', 'project_id=?']
  ];

  const projectRestoreOrder = [
    'controller_groups', 'controllers', 'categories', 'subcategories', 'task_categories', 'task_subcategories',
    'options', 'settings', 'completion_requirements', 'function_groups', 'function_group_elements', 'function_group_subcategories', 'function_group_checks',
    'function_group_check_subcategories', 'status_items', 'status_assignees', 'tasks', 'task_dependencies', 'task_checklist', 'task_scope_checklist', 'task_assignees', 'open_points',
    'daily_notes', 'goals', 'goal_links', 'entity_mentions', 'entity_links', 'entity_requirements', 'entity_comments', 'notifications', 'audit_log',
    'export_templates', 'project_sequences', 'project_user_areas', 'planner_entries', 'planner_requirements', 'planner_holidays', 'planner_absences', 'planner_time_adjustments',
    'announcements', 'announcement_labels', 'announcement_scopes', 'announcement_users', 'announcement_links', 'announcement_label_links', 'announcement_reads', 'calendar_annotations', 'calendar_item_dates',
    'shift_handovers', 'shift_handover_items', 'automation_rules', 'automation_rule_hits', 'commissioning_templates', 'saved_views'
  ];

  function projectBackup() {
    const projectId = activeProjectId();
    const project = one('SELECT * FROM projects WHERE id=?', projectId);
    const tables = Object.fromEntries(projectBackupTables.map(([table, condition]) => [table, all(`SELECT * FROM ${table} WHERE ${condition}`, projectId)]));
    return {
      format: 'plc-commissioning-hub-project-backup', version: 12,
      generated_at: new Date().toISOString(), project,
      users: all(`SELECT u.id,u.username,u.display_name,u.system_role,u.theme,u.active,u.sort_order,u.created_at,pm.role project_role,pm.active project_active,pm.assignable
        FROM users u JOIN project_memberships pm ON pm.user_id=u.id WHERE pm.project_id=? ORDER BY u.id`, projectId),
      memberships: all('SELECT * FROM project_memberships WHERE project_id=? ORDER BY user_id', projectId), tables
    };
  }

  function insertBackupRows(table, rows, projectId) {
    if (!Array.isArray(rows)) return;
    let orderedRows = rows;
    if (table === 'controller_groups') {
      const remaining = [...rows];
      const inserted = new Set();
      orderedRows = [];
      while (remaining.length) {
        const index = remaining.findIndex(row => !row.parent_id || inserted.has(row.parent_id) || !rows.some(candidate => candidate.id === row.parent_id));
        const [row] = remaining.splice(index < 0 ? 0 : index, 1);
        orderedRows.push(row); inserted.add(row.id);
      }
    }
    for (const source of orderedRows) {
      const row = { ...source };
      if (Object.hasOwn(row, 'project_id')) row.project_id = projectId;
      const columns = Object.keys(row);
      if (!columns.length) continue;
      db.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`).run(...columns.map(column => row[column]));
    }
  }

  function restoreProjectBackup(payload) {
    if (!payload || payload.format !== 'plc-commissioning-hub-project-backup' || ![4, 5, 6, 7, 8, 9, 10, 11, 12].includes(Number(payload.version)) || !payload.tables) throw appError('Nieprawidłowy lub nieobsługiwany plik backupu');
    const projectId = activeProjectId();
    const currentProject = one('SELECT * FROM projects WHERE id=?', projectId);
    if (!currentProject || clean(payload.project?.code).toLowerCase() !== clean(currentProject.code).toLowerCase()) throw appError(`Backup dotyczy innego projektu (${payload.project?.code || 'brak kodu'})`);
    const deleteOrder = [...projectRestoreOrder].reverse();
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const table of deleteOrder) {
        const spec = projectBackupTables.find(item => item[0] === table);
        db.prepare(`DELETE FROM ${table} WHERE ${spec[1]}`).run(projectId);
      }
      for (const table of projectRestoreOrder) insertBackupRows(table, payload.tables[table], projectId);
      for (const membership of Array.isArray(payload.memberships) ? payload.memberships : []) {
        if (!one('SELECT 1 FROM users WHERE id=?', membership.user_id)) continue;
        db.prepare(`INSERT INTO project_memberships(project_id,user_id,role,active,planner_enabled,assignable,summary_area_source,created_at) VALUES(?,?,?,?,?,?,?,?)
          ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role,active=excluded.active,planner_enabled=excluded.planner_enabled,assignable=excluded.assignable,summary_area_source=excluded.summary_area_source`).run(
          projectId, membership.user_id, membership.role, membership.active, Number(membership.planner_enabled ?? 1) ? 1 : 0,
          Number(membership.assignable ?? 1) ? 1 : 0, membership.summary_area_source === 'planner' ? 'planner' : 'configuration', membership.created_at || new Date().toISOString()
        );
      }
      db.prepare(`INSERT OR IGNORE INTO task_assignees(project_id,task_id,user_id,assigned_directly)
        SELECT project_id,id,owner_user_id,1 FROM tasks WHERE project_id=? AND owner_user_id IS NOT NULL`).run(projectId);
      db.prepare(`INSERT OR IGNORE INTO status_assignees(project_id,status_id,user_id)
        SELECT project_id,id,responsible_user_id FROM status_items WHERE project_id=? AND responsible_user_id IS NOT NULL`).run(projectId);
      db.prepare("UPDATE controllers SET leaf_code=code WHERE project_id=? AND (leaf_code IS NULL OR trim(leaf_code)='')").run(projectId);
      refreshControllerCodesForProject(db, projectId);
      db.prepare(`INSERT OR IGNORE INTO entity_links(project_id,source_type,source_id,target_type,target_id,created_by)
        SELECT gl.project_id,gl.entity_type,gl.entity_id,'goal',gl.goal_id,g.created_by
        FROM goal_links gl JOIN goals g ON g.id=gl.goal_id AND g.project_id=gl.project_id WHERE gl.project_id=?`).run(projectId);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw appError(`Nie udało się odtworzyć backupu: ${error.message}`);
    }
    return { ok: true, project: currentProject, restored_at: new Date().toISOString() };
  }

  function safeDateRange(fromValue, toValue, maxDays = 366) {
    const from = nullableDate(fromValue) || new Date().toISOString().slice(0, 10);
    const to = nullableDate(toValue) || from;
    const start = new Date(`${from}T12:00:00Z`);
    const end = new Date(`${to}T12:00:00Z`);
    const days = Math.floor((end - start) / 86400000) + 1;
    if (!Number.isFinite(days) || days < 1) throw appError('Data końcowa nie może być wcześniejsza od początkowej');
    if (days > maxDays) throw appError(`Maksymalny zakres to ${maxDays} dni`);
    return { from, to, days };
  }

  function plannerProjectUsers() {
    return all(`SELECT u.id,u.display_name,u.username,u.sort_order,pm.role,pm.planner_enabled
      FROM users u JOIN project_memberships pm ON pm.user_id=u.id AND pm.project_id=? AND pm.active=1
      WHERE u.active=1 ORDER BY u.sort_order,u.display_name`, activeProjectId());
  }

  function validatePlannerUserDate(userId, planDate) {
    const user = one(`SELECT u.id,u.display_name,pm.planner_enabled FROM users u
      JOIN project_memberships pm ON pm.user_id=u.id
      WHERE u.id=? AND u.active=1 AND pm.project_id=? AND pm.active=1`, asId(userId), activeProjectId());
    if (!user) throw appError('Użytkownik nie jest aktywny w tym projekcie');
    if (!Number(user.planner_enabled) && planDate !== new Date().toISOString().slice(0, 10)) throw appError('Osobę spoza stałego planu można dodać wyłącznie do dzisiejszego dnia');
    return user;
  }

  function normalizePlannerEntries(requested) {
    const normalized = [];
    const seenGroups = new Set();
    const hierarchyGroups = [];
    for (const source of (Array.isArray(requested) ? requested : []).slice(0, 30)) {
      const groupId = asId(source.controller_group_id);
      const workMode = ['online', 'offline'].includes(source.work_mode) ? source.work_mode : 'online';
      const transportMode = ['none', 'transport_work', 'transport_only'].includes(source.transport_mode) ? source.transport_mode : 'none';
      const shift = clean(source.shift) || 'Dzień';
      if (groupId && !one('SELECT 1 FROM controller_groups WHERE id=? AND project_id=? AND active=1', groupId, activeProjectId())) throw appError('Wybrany obszar nie należy do projektu');
      if (!one("SELECT 1 FROM options WHERE project_id=? AND kind='shift' AND value=? AND active=1", activeProjectId(), shift)) throw appError(`Nieznana zmiana: ${shift}`);
      if (!groupId && transportMode === 'none' && !clean(source.note)) continue;
      if (groupId) {
        if (seenGroups.has(groupId)) throw appError('Ten sam obszar nie może być przypisany tej osobie dwukrotnie w jednym dniu');
        seenGroups.add(groupId);
        hierarchyGroups.push(groupId);
      }
      normalized.push({ groupId, shift, workMode, transportMode, note: clean(source.note) });
    }
    if (hasHierarchyOverlap(hierarchyGroups)) throw appError('Nie można przypisać jednocześnie obszaru nadrzędnego i jego podobszaru');
    return normalized;
  }

  function replacePlannerDay(userId, planDate, normalized, currentUser) {
    db.prepare('DELETE FROM planner_entries WHERE project_id=? AND user_id=? AND plan_date=?').run(activeProjectId(), userId, planDate);
    const insert = db.prepare(`INSERT INTO planner_entries(project_id,user_id,plan_date,shift,controller_group_id,work_mode,transport_mode,note,created_by) VALUES(?,?,?,?,?,?,?,?,?)`);
    normalized.forEach(entry => insert.run(activeProjectId(), userId, planDate, entry.shift, entry.groupId, entry.workMode, entry.transportMode, entry.note, currentUser.id));
  }

  function plannerData(fromValue, toValue, currentUser = null) {
    const range = safeDateRange(fromValue, toValue, 366);
    const hierarchy = hierarchyData();
    const groupMap = new Map(hierarchy.groups.map(group => [group.id, group]));
    const projectUsers = plannerProjectUsers();
    const entries = all(`SELECT pe.*,u.display_name,creator.display_name created_by_name
      FROM planner_entries pe JOIN users u ON u.id=pe.user_id
      JOIN project_memberships pm ON pm.project_id=pe.project_id AND pm.user_id=pe.user_id AND pm.active=1
      LEFT JOIN users creator ON creator.id=pe.created_by
      WHERE pe.project_id=? AND pe.plan_date BETWEEN ? AND ?
      ORDER BY pe.plan_date,u.sort_order,pe.id`, activeProjectId(), range.from, range.to).map(entry => {
        const area = groupMap.get(Number(entry.controller_group_id));
        return { ...entry, area_name: area?.name || '', area_path: area?.path_label || '', area_depth: area?.depth || 0, root_area_id: area?.root_group_id || null };
      });
    const holidays = all('SELECT * FROM planner_holidays WHERE project_id=? AND holiday_date BETWEEN ? AND ? ORDER BY holiday_date', activeProjectId(), range.from, range.to);
    const timeAdjustments = all(`SELECT * FROM planner_time_adjustments
      WHERE project_id=? AND plan_date BETWEEN ? AND ? ORDER BY plan_date,user_id`, activeProjectId(), range.from, range.to);
    const absences = all(`SELECT pa.*,u.display_name FROM planner_absences pa JOIN users u ON u.id=pa.user_id
      WHERE pa.project_id=? AND pa.absence_date BETWEEN ? AND ? ORDER BY pa.absence_date,u.sort_order,u.display_name`, activeProjectId(), range.from, range.to);
    const usersWithEntries = new Set([...entries.map(entry => Number(entry.user_id)), ...absences.map(item => Number(item.user_id))]);
    const decorateUser = user => {
      const areaIds = all('SELECT controller_group_id FROM project_user_areas WHERE project_id=? AND user_id=? ORDER BY sort_order', activeProjectId(), user.id).map(row => row.controller_group_id);
      return { ...user, configured_area_ids: areaIds, configured_areas: areaIds.map(id => groupMap.get(id)?.path_label).filter(Boolean).join(', ') };
    };
    const users = projectUsers.filter(user => Number(user.planner_enabled) || usersWithEntries.has(Number(user.id))).map(decorateUser);
    const available_today_users = projectUsers.filter(user => !Number(user.planner_enabled) && !usersWithEntries.has(Number(user.id))).map(decorateUser);
    const work = all(`SELECT user_id,work_date,SUM(tasks) tasks,SUM(points) points,SUM(statuses) statuses,SUM(notes) notes FROM (
      SELECT ta.user_id,COALESCE(t.start_date,t.due_date,date(t.created_at)) work_date,COUNT(DISTINCT t.id) tasks,0 points,0 statuses,0 notes
        FROM task_assignees ta JOIN tasks t ON t.id=ta.task_id AND t.project_id=ta.project_id
        WHERE ta.project_id=? AND COALESCE(t.start_date,t.due_date,date(t.created_at)) BETWEEN ? AND ? GROUP BY ta.user_id,work_date
      UNION ALL SELECT p.owner_user_id,COALESCE(p.start_date,p.due_date,p.reminder_date,date(p.created_at)),0,COUNT(DISTINCT p.id),0,0
        FROM open_points p WHERE p.project_id=? AND p.owner_user_id IS NOT NULL AND COALESCE(p.start_date,p.due_date,p.reminder_date,date(p.created_at)) BETWEEN ? AND ? GROUP BY p.owner_user_id,2
      UNION ALL SELECT sa.user_id,COALESCE(s.checked_on,date(s.created_at)),0,0,COUNT(DISTINCT s.id),0
        FROM status_assignees sa JOIN status_items s ON s.id=sa.status_id AND s.project_id=sa.project_id
        WHERE sa.project_id=? AND COALESCE(s.checked_on,date(s.created_at)) BETWEEN ? AND ? GROUP BY sa.user_id,2
      UNION ALL SELECT n.created_by,n.note_date,0,0,0,COUNT(DISTINCT n.id)
        FROM daily_notes n WHERE n.project_id=? AND n.created_by IS NOT NULL AND n.note_date BETWEEN ? AND ? GROUP BY n.created_by,n.note_date
      ) GROUP BY user_id,work_date`,
      activeProjectId(), range.from, range.to, activeProjectId(), range.from, range.to,
      activeProjectId(), range.from, range.to, activeProjectId(), range.from, range.to).map(row => ({ ...row, tasks: Number(row.tasks), points: Number(row.points), statuses: Number(row.statuses), notes: Number(row.notes) }));
    const summary = all(`SELECT pe.plan_date,COUNT(DISTINCT pe.user_id) headcount,
      COUNT(DISTINCT CASE WHEN pe.work_mode='online' THEN pe.user_id END) online_headcount,
      COUNT(DISTINCT CASE WHEN pe.work_mode='offline' THEN pe.user_id END) offline_headcount,
      SUM(pe.transport_mode='transport_only') transport_only,SUM(pe.transport_mode='transport_work') transport_work
      FROM planner_entries pe JOIN project_memberships pm ON pm.project_id=pe.project_id AND pm.user_id=pe.user_id AND pm.active=1
      WHERE pe.project_id=? AND pe.plan_date BETWEEN ? AND ? GROUP BY pe.plan_date ORDER BY pe.plan_date`, activeProjectId(), range.from, range.to);
    const canManageRequirements = ['system_admin', 'project_admin', 'moderator'].includes(currentUser?.role);
    const requirements = canManageRequirements ? all(`SELECT pr.*,cg.name area_name FROM planner_requirements pr
      JOIN controller_groups cg ON cg.id=pr.controller_group_id
      WHERE pr.project_id=? AND pr.plan_date BETWEEN ? AND ? ORDER BY pr.plan_date,cg.sort_order,pr.work_mode`, activeProjectId(), range.from, range.to).map(row => {
        const area = groupMap.get(Number(row.controller_group_id));
        return { ...row, area_path: area?.path_label || row.area_name, root_area_id: area?.root_group_id || row.controller_group_id };
      }) : [];
    const currentDate = new Date().toISOString().slice(0, 10);
    const area_summary = hierarchy.groups.filter(group => !group.parent_id).map(group => {
      const descendants = new Set(groupDescendantIds(group.id));
      const related = entries.filter(entry => descendants.has(Number(entry.controller_group_id)));
      const todayRelated = related.filter(entry => entry.plan_date === new Date().toISOString().slice(0, 10));
      const unique = values => new Set(values).size;
      return {
        id: group.id, name: group.name, path_label: group.path_label,
        today_people: unique(todayRelated.map(entry => entry.user_id)),
        today_online_people: unique(todayRelated.filter(entry => entry.work_mode === 'online').map(entry => entry.user_id)),
        today_offline_people: unique(todayRelated.filter(entry => entry.work_mode === 'offline').map(entry => entry.user_id)),
        assignments: unique(related.map(entry => `${entry.user_id}:${entry.plan_date}`)),
        people: unique(related.map(entry => entry.user_id)),
        online_assignments: unique(related.filter(entry => entry.work_mode === 'online').map(entry => `${entry.user_id}:${entry.plan_date}`)),
        offline_assignments: unique(related.filter(entry => entry.work_mode === 'offline').map(entry => `${entry.user_id}:${entry.plan_date}`)),
        online_people: unique(related.filter(entry => entry.work_mode === 'online').map(entry => entry.user_id)),
        offline_people: unique(related.filter(entry => entry.work_mode === 'offline').map(entry => entry.user_id)),
        today_online_required: requirements.filter(row => row.plan_date === currentDate && row.work_mode === 'online' && descendants.has(Number(row.controller_group_id))).reduce((sum, row) => sum + Number(row.required_count || 0), 0),
        today_offline_required: requirements.filter(row => row.plan_date === currentDate && row.work_mode === 'offline' && descendants.has(Number(row.controller_group_id))).reduce((sum, row) => sum + Number(row.required_count || 0), 0)
      };
    });
    const shift_summary = all(`SELECT pe.shift,COUNT(DISTINCT pe.user_id||':'||pe.plan_date) assignments FROM planner_entries pe
      JOIN project_memberships pm ON pm.project_id=pe.project_id AND pm.user_id=pe.user_id AND pm.active=1
      WHERE pe.project_id=? AND pe.plan_date BETWEEN ? AND ? GROUP BY pe.shift ORDER BY assignments DESC`, activeProjectId(), range.from, range.to);
    const todayEntries = entries.filter(entry => entry.plan_date === currentDate);
    const uniquePeople = list => new Set(list.map(entry => entry.user_id)).size;
    const mode_summary = {
      today_online: uniquePeople(todayEntries.filter(entry => entry.work_mode === 'online')),
      today_offline: uniquePeople(todayEntries.filter(entry => entry.work_mode === 'offline')),
      range_online: uniquePeople(entries.filter(entry => entry.work_mode === 'online')),
      range_offline: uniquePeople(entries.filter(entry => entry.work_mode === 'offline')),
      online_planned_days: new Set(entries.filter(entry => entry.work_mode === 'online').map(entry => `${entry.user_id}:${entry.plan_date}`)).size,
      offline_planned_days: new Set(entries.filter(entry => entry.work_mode === 'offline').map(entry => `${entry.user_id}:${entry.plan_date}`)).size
    };
    const area_day_summary = hierarchy.groups.filter(group => !group.parent_id).map(group => {
      const descendants = new Set(groupDescendantIds(group.id));
      return {
        id: group.id, name: group.name, path_label: group.path_label,
        days: range.days ? Array.from({ length: range.days }, (_, index) => {
          const date = new Date(`${range.from}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + index); const value = date.toISOString().slice(0, 10);
          const related = entries.filter(entry => entry.plan_date === value && descendants.has(Number(entry.controller_group_id)));
          const required = requirements.filter(row => row.plan_date === value && descendants.has(Number(row.controller_group_id)));
          return {
            date: value,
            online: new Set(related.filter(entry => entry.work_mode === 'online').map(entry => entry.user_id)).size,
            offline: new Set(related.filter(entry => entry.work_mode === 'offline').map(entry => entry.user_id)).size,
            online_required: required.filter(row => row.work_mode === 'online').reduce((sum, row) => sum + Number(row.required_count || 0), 0),
            offline_required: required.filter(row => row.work_mode === 'offline').reduce((sum, row) => sum + Number(row.required_count || 0), 0)
          };
        }) : []
      };
    });
    let timeDetails = null;
    if (canManageRequirements) {
      const historicalStarts = [
        one('SELECT MIN(plan_date) value FROM planner_entries WHERE project_id=?', activeProjectId())?.value,
        one('SELECT MIN(absence_date) value FROM planner_absences WHERE project_id=?', activeProjectId())?.value,
        one('SELECT MIN(plan_date) value FROM planner_time_adjustments WHERE project_id=?', activeProjectId())?.value
      ].filter(Boolean).sort();
      const calculationFrom = historicalStarts[0] && historicalStarts[0] < range.from ? historicalStarts[0] : range.from;
      const calculationRange = safeDateRange(calculationFrom, range.to, 7305);
      const calculationEntries = calculationFrom === range.from ? entries : all(`SELECT * FROM planner_entries
        WHERE project_id=? AND plan_date BETWEEN ? AND ? ORDER BY plan_date,user_id,id`, activeProjectId(), calculationFrom, range.to);
      const calculationAbsences = calculationFrom === range.from ? absences : all(`SELECT * FROM planner_absences
        WHERE project_id=? AND absence_date BETWEEN ? AND ? ORDER BY absence_date,user_id`, activeProjectId(), calculationFrom, range.to);
      const calculationHolidays = calculationFrom === range.from ? holidays : all(`SELECT * FROM planner_holidays
        WHERE project_id=? AND holiday_date BETWEEN ? AND ? ORDER BY holiday_date`, activeProjectId(), calculationFrom, range.to);
      const calculationAdjustments = calculationFrom === range.from ? timeAdjustments : all(`SELECT * FROM planner_time_adjustments
        WHERE project_id=? AND plan_date BETWEEN ? AND ? ORDER BY plan_date,user_id`, activeProjectId(), calculationFrom, range.to);
      timeDetails = plannerTimeCalculation(calculationRange, projectUsers, calculationEntries, calculationAbsences, calculationHolidays, calculationAdjustments, range);
    }
    return { ...range, users, available_today_users, entries, absences, holidays, time_adjustments: canManageRequirements ? timeAdjustments : [], work, summary, area_summary, area_day_summary, shift_summary, mode_summary, areas: hierarchy.groups, requirements, time_details: timeDetails, can_manage_requirements: canManageRequirements, can_manage_time: canManageRequirements };
  }

  function plannerTimeCalculation(range, users, entries, absences, holidays, adjustments = [], visibleRange = range) {
    const settingNumber = (key, fallback) => {
      const value = Number(one('SELECT value FROM settings WHERE project_id=? AND key=?', activeProjectId(), key)?.value);
      return Number.isFinite(value) ? value : fallback;
    };
    const onlineHours = settingNumber('planner_online_hours', 10.5);
    const offlineHours = settingNumber('planner_offline_hours', 8);
    const baseHours = settingNumber('planner_base_hours', 8);
    const weekdayMultiplier = settingNumber('planner_weekday_multiplier', 1.5);
    const saturdayMultiplier = settingNumber('planner_saturday_multiplier', 1.5);
    const sundayHolidayMultiplier = settingNumber('planner_sunday_holiday_multiplier', 2);
    const timeOffDebit = settingNumber('planner_time_off_debit', 8);
    const holidayDates = new Set(holidays.map(item => item.holiday_date));
    const entryMap = new Map();
    for (const entry of entries) {
      const key = `${entry.user_id}:${entry.plan_date}`;
      if (!entryMap.has(key)) entryMap.set(key, []);
      entryMap.get(key).push(entry);
    }
    const absenceMap = new Map(absences.map(item => [`${item.user_id}:${item.absence_date}`, item]));
    const adjustmentMap = new Map(adjustments.map(item => [`${item.user_id}:${item.plan_date}`, item]));
    const days = Array.from({ length: range.days }, (_, index) => {
      const date = new Date(`${range.from}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + index); return date.toISOString().slice(0, 10);
    });
    const allDetails = [];
    for (const user of users) for (const date of days) {
      const absence = absenceMap.get(`${user.id}:${date}`);
      const adjustment = adjustmentMap.get(`${user.id}:${date}`) || {};
      const dayEntries = entryMap.get(`${user.id}:${date}`) || [];
      const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
      const holiday = holidayDates.has(date);
      const isSaturday = weekday === 6;
      const isSunday = weekday === 0;
      let actual = 0; let credited = 0; let overtimeRaw = 0; let overtimeWeighted = 0; let label = '';
      if (absence?.absence_type === 'time_off') {
        overtimeRaw = -timeOffDebit; overtimeWeighted = -timeOffDebit; label = 'Wolne z nadgodzin';
      } else if (absence?.absence_type === 'vacation') {
        credited = !isSaturday && !isSunday && !holiday ? baseHours : 0; label = 'Urlop';
      } else if (dayEntries.length) {
        const workEntries = dayEntries.filter(item => item.transport_mode !== 'transport_only');
        if (!workEntries.length) label = 'T · sam transport';
        else {
          actual = workEntries.some(item => item.work_mode === 'online') ? onlineHours : offlineHours;
          label = workEntries.some(item => item.work_mode === 'online') ? 'ON' : 'OFF';
        }
      }
      const actualAdjustment = Number(adjustment.actual_hours_adjustment || 0);
      const manualStart = nullableTime(adjustment.work_start_time);
      const manualEnd = nullableTime(adjustment.work_end_time);
      if (!absence && manualStart && manualEnd) {
        const [startHour, startMinute] = manualStart.split(':').map(Number);
        const [endHour, endMinute] = manualEnd.split(':').map(Number);
        let workedMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute);
        if (workedMinutes < 0) workedMinutes += 24 * 60;
        actual = workedMinutes / 60;
        label = `Ręcznie ${manualStart}–${manualEnd}`;
      } else {
        actual = Math.max(0, actual + actualAdjustment);
      }
      if (!absence && actual > 0) {
        if (!label) label = 'Korekta';
        if (isSunday || holiday) { overtimeRaw = actual; overtimeWeighted = actual * sundayHolidayMultiplier; }
        else if (isSaturday) { overtimeRaw = actual; overtimeWeighted = actual * saturdayMultiplier; }
        else { overtimeRaw = Math.max(0, actual - baseHours); overtimeWeighted = overtimeRaw * weekdayMultiplier; }
      }
      overtimeRaw += Number(adjustment.overtime_raw_adjustment || 0);
      overtimeWeighted += Number(adjustment.overtime_weighted_adjustment || 0);
      allDetails.push({
        user_id: user.id, display_name: user.display_name, date, label,
        actual_hours: actual, credited_hours: credited, overtime_raw: overtimeRaw, overtime_weighted: overtimeWeighted,
        actual_hours_adjustment: actualAdjustment,
        overtime_raw_adjustment: Number(adjustment.overtime_raw_adjustment || 0),
        overtime_weighted_adjustment: Number(adjustment.overtime_weighted_adjustment || 0),
        work_start_time: manualStart || '', work_end_time: manualEnd || '',
        overtime_raw_balance_override: nullableNumber(adjustment.overtime_raw_balance_override),
        overtime_weighted_balance_override: nullableNumber(adjustment.overtime_weighted_balance_override),
        adjustment_note: adjustment.note || '', is_holiday: holiday ? 1 : 0,
        is_weekend: isSaturday || isSunday ? 1 : 0, absence_type: absence?.absence_type || ''
      });
    }
    for (const user of users) {
      let raw = 0; let weighted = 0;
      allDetails.filter(item => item.user_id === user.id).sort((left, right) => left.date.localeCompare(right.date)).forEach(item => {
        raw += Number(item.overtime_raw || 0); weighted += Number(item.overtime_weighted || 0);
        if (item.overtime_raw_balance_override !== null) raw = item.overtime_raw_balance_override;
        if (item.overtime_weighted_balance_override !== null) weighted = item.overtime_weighted_balance_override;
        item.overtime_raw_cumulative = raw; item.overtime_weighted_cumulative = weighted;
        item.overtime_balance = weighted;
      });
    }
    const details = allDetails.filter(item => item.date >= visibleRange.from && item.date <= visibleRange.to);
    const userSummary = users.map(user => {
      const rows = details.filter(item => item.user_id === user.id);
      const weekly = new Map();
      for (const row of rows) {
        const date = new Date(`${row.date}T12:00:00Z`); const day = date.getUTCDay() || 7; date.setUTCDate(date.getUTCDate() + 4 - day); const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1)); const week = `${date.getUTCFullYear()}-${Math.ceil((((date - yearStart) / 86400000) + 1) / 7)}`;
        weekly.set(week, (weekly.get(week) || 0) + row.actual_hours);
      }
      return {
        user_id: user.id, display_name: user.display_name,
        actual_hours: rows.reduce((sum, row) => sum + row.actual_hours, 0),
        credited_hours: rows.reduce((sum, row) => sum + row.credited_hours, 0),
        overtime_raw: rows.reduce((sum, row) => sum + row.overtime_raw, 0),
        overtime_weighted: rows.reduce((sum, row) => sum + row.overtime_weighted, 0),
        overtime_raw_balance: rows.at(-1)?.overtime_raw_cumulative || 0,
        overtime_balance: rows.at(-1)?.overtime_weighted_cumulative || 0,
        overloaded_weeks: [...weekly.entries()].filter(([, hours]) => hours > 48).map(([week, hours]) => ({ week, hours }))
      };
    });
    return { details, users: userSummary };
  }

  function savePlannerDay(input, currentUser) {
    const userId = asId(input.user_id);
    const planDate = nullableDate(input.plan_date);
    if (!userId || !planDate) throw appError('Użytkownik i dzień planu są wymagane');
    validatePlannerUserDate(userId, planDate);
    const absenceType = ['time_off', 'vacation'].includes(input.absence_type) ? input.absence_type : '';
    const normalized = absenceType ? [] : normalizePlannerEntries(input.entries);
    db.exec('BEGIN IMMEDIATE');
    try {
      replacePlannerDay(userId, planDate, normalized, currentUser);
      db.prepare('DELETE FROM planner_absences WHERE project_id=? AND user_id=? AND absence_date=?').run(activeProjectId(), userId, planDate);
      if (absenceType) db.prepare(`INSERT INTO planner_absences(project_id,user_id,absence_date,absence_type,note,created_by)
        VALUES(?,?,?,?,?,?)`).run(activeProjectId(), userId, planDate, absenceType, clean(input.absence_note), currentUser.id);
      if (['actual_hours_adjustment', 'overtime_raw_adjustment', 'overtime_weighted_adjustment', 'work_start_time', 'work_end_time', 'overtime_raw_balance_override', 'overtime_weighted_balance_override', 'adjustment_note'].some(key => Object.hasOwn(input, key))) {
        const actualAdjustment = Number(input.actual_hours_adjustment || 0);
        const rawAdjustment = Number(input.overtime_raw_adjustment || 0);
        const weightedAdjustment = Number(input.overtime_weighted_adjustment || 0);
        const rawStart = clean(input.work_start_time);
        const rawEnd = clean(input.work_end_time);
        if (Boolean(rawStart) !== Boolean(rawEnd)) throw appError('Podaj jednocześnie godzinę rozpoczęcia i zakończenia pracy');
        const workStart = rawStart ? nullableTime(rawStart) : null;
        const workEnd = rawEnd ? nullableTime(rawEnd) : null;
        if ((rawStart && !workStart) || (rawEnd && !workEnd)) throw appError('Godziny pracy muszą mieć format HH:MM');
        const rawBalance = nullableNumber(input.overtime_raw_balance_override);
        const weightedBalance = nullableNumber(input.overtime_weighted_balance_override);
        if (input.overtime_raw_balance_override !== '' && input.overtime_raw_balance_override !== null && input.overtime_raw_balance_override !== undefined && rawBalance === null) throw appError('Saldo nadgodzin musi być liczbą');
        if (input.overtime_weighted_balance_override !== '' && input.overtime_weighted_balance_override !== null && input.overtime_weighted_balance_override !== undefined && weightedBalance === null) throw appError('Saldo nadgodzin z mnożnikiem musi być liczbą');
        const adjustmentNote = clean(input.adjustment_note);
        db.prepare('DELETE FROM planner_time_adjustments WHERE project_id=? AND user_id=? AND plan_date=?').run(activeProjectId(), userId, planDate);
        if (actualAdjustment || rawAdjustment || weightedAdjustment || workStart || workEnd || rawBalance !== null || weightedBalance !== null || adjustmentNote) {
          db.prepare(`INSERT INTO planner_time_adjustments(project_id,user_id,plan_date,actual_hours_adjustment,overtime_raw_adjustment,overtime_weighted_adjustment,work_start_time,work_end_time,overtime_raw_balance_override,overtime_weighted_balance_override,note,updated_by)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(activeProjectId(), userId, planDate, actualAdjustment, rawAdjustment, weightedAdjustment, workStart, workEnd, rawBalance, weightedBalance, adjustmentNote, currentUser.id);
        }
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return plannerData(planDate, planDate, currentUser);
  }

  function movePlannerEntry(input, currentUser) {
    const entry = one('SELECT * FROM planner_entries WHERE id=? AND project_id=?', asId(input.entry_id), activeProjectId());
    if (!entry) throw appError('Nie znaleziono przypisania Plannera', 404);
    const targetUserId = asId(input.target_user_id);
    const targetDate = nullableDate(input.target_date);
    if (!targetUserId || !targetDate) throw appError('Pracownik i dzień docelowy są wymagane');
    validatePlannerUserDate(targetUserId, targetDate);
    if (one('SELECT 1 FROM planner_absences WHERE project_id=? AND user_id=? AND absence_date=?', activeProjectId(), targetUserId, targetDate)) throw appError('Nie można przenieść aktywności na dzień oznaczony jako urlop lub wolne');
    if (entry.user_id === targetUserId && entry.plan_date === targetDate) return plannerData(targetDate, targetDate, currentUser);
    const sourceRows = all('SELECT * FROM planner_entries WHERE project_id=? AND user_id=? AND plan_date=? ORDER BY id', activeProjectId(), entry.user_id, entry.plan_date);
    const targetRows = all('SELECT * FROM planner_entries WHERE project_id=? AND user_id=? AND plan_date=? ORDER BY id', activeProjectId(), targetUserId, targetDate);
    const moved = { controller_group_id: entry.controller_group_id, work_mode: entry.work_mode, shift: entry.shift, transport_mode: entry.transport_mode, note: entry.note };
    const target = normalizePlannerEntries([...targetRows, moved]);
    const source = normalizePlannerEntries(sourceRows.filter(row => row.id !== entry.id));
    db.exec('BEGIN IMMEDIATE');
    try {
      replacePlannerDay(targetUserId, targetDate, target, currentUser);
      if (!Number(input.copy)) replacePlannerDay(entry.user_id, entry.plan_date, source, currentUser);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    const from = entry.plan_date < targetDate ? entry.plan_date : targetDate;
    const to = entry.plan_date > targetDate ? entry.plan_date : targetDate;
    return plannerData(from, to, currentUser);
  }

  function setPlannerRequirements(input, currentUser) {
    const planDate = nullableDate(input.plan_date);
    const groupId = asId(input.controller_group_id);
    if (!planDate || !groupId) throw appError('Dzień i obszar zapotrzebowania są wymagane');
    if (!one('SELECT 1 FROM controller_groups WHERE id=? AND project_id=? AND active=1', groupId, activeProjectId())) throw appError('Wybrany obszar nie należy do projektu');
    const values = { online: Math.max(0, Math.min(999, Number(input.online_required) || 0)), offline: Math.max(0, Math.min(999, Number(input.offline_required) || 0)) };
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM planner_requirements WHERE project_id=? AND controller_group_id=? AND plan_date=?').run(activeProjectId(), groupId, planDate);
      const insert = db.prepare('INSERT INTO planner_requirements(project_id,controller_group_id,plan_date,work_mode,required_count,note,created_by) VALUES(?,?,?,?,?,?,?)');
      for (const mode of ['online', 'offline']) if (values[mode] > 0) insert.run(activeProjectId(), groupId, planDate, mode, values[mode], clean(input.note), currentUser.id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return { plan_date: planDate, controller_group_id: groupId, online_required: values.online, offline_required: values.offline };
  }

  function setPlannerRequirementsBatch(input, currentUser) {
    const items = Array.isArray(input.items) ? input.items.slice(0, 2000) : [];
    if (!items.length) throw appError('Brak danych zapotrzebowania do zapisania');
    for (const item of items) setPlannerRequirements(item, currentUser);
    return { saved: items.length };
  }

  function savePlannerHoliday(id, input, currentUser) {
    const holidayDate = nullableDate(input.holiday_date);
    const name = clean(input.name);
    if (!holidayDate || !name) throw appError('Data i nazwa święta są wymagane');
    let recordId = asId(id);
    if (recordId) {
      const result = db.prepare('UPDATE planner_holidays SET holiday_date=?,name=? WHERE id=? AND project_id=?').run(holidayDate, name, recordId, activeProjectId());
      if (!result.changes) throw appError('Nie znaleziono święta', 404);
    } else recordId = insertRecord('planner_holidays', { project_id: activeProjectId(), holiday_date: holidayDate, name, created_by: currentUser.id });
    return one('SELECT * FROM planner_holidays WHERE id=?', recordId);
  }

  function savePlannerHolidaysBulk(input, currentUser) {
    const items = Array.isArray(input.items) ? input.items.slice(0, 366) : [];
    if (!items.length) throw appError('Brak świąt do zapisania');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const item of items) {
        const holidayDate = nullableDate(item.holiday_date);
        const name = clean(item.name);
        if (!holidayDate || !name) throw appError('Każdy wiersz musi zawierać datę RRRR-MM-DD i nazwę święta');
        db.prepare(`INSERT INTO planner_holidays(project_id,holiday_date,name,created_by) VALUES(?,?,?,?)
          ON CONFLICT(project_id,holiday_date) DO UPDATE SET name=excluded.name`).run(activeProjectId(), holidayDate, name, currentUser.id);
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return { saved: items.length };
  }

  function deletePlannerHoliday(id) {
    const result = db.prepare('DELETE FROM planner_holidays WHERE id=? AND project_id=?').run(asId(id), activeProjectId());
    if (!result.changes) throw appError('Nie znaleziono święta', 404);
  }

  function assignPlannerWork(input, currentUser) {
    const userId = asId(input.user_id);
    const planDate = nullableDate(input.plan_date);
    if (!userId || !planDate) throw appError('Pracownik i data są wymagane');
    validatePlannerUserDate(userId, planDate);
    const items = [...new Map((Array.isArray(input.items) ? input.items : []).map(item => [`${item.entity_type}:${asId(item.entity_id)}`, { entity_type: item.entity_type, entity_id: asId(item.entity_id) }])).values()].filter(item => ['task', 'status', 'point'].includes(item.entity_type) && item.entity_id);
    if (!items.length) throw appError('Wybierz co najmniej jeden element do przypisania');
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const item of items) {
        const table = TABLES[item.entity_type];
        if (!one(`SELECT 1 FROM ${table} WHERE id=? AND project_id=?`, item.entity_id, activeProjectId())) throw appError('Wybrany element nie należy do projektu');
        const before = baseSnapshot(item.entity_type, item.entity_id);
        if (item.entity_type === 'task') {
          db.prepare(`INSERT INTO task_assignees(project_id,task_id,user_id,assigned_directly) VALUES(?,?,?,1)
            ON CONFLICT(task_id,user_id) DO UPDATE SET assigned_directly=1`).run(activeProjectId(), item.entity_id, userId);
          db.prepare(`UPDATE tasks SET owner_user_id=COALESCE(owner_user_id,?),owner=CASE WHEN owner_user_id IS NULL THEN ? ELSE owner END,start_date=COALESCE(start_date,?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?`).run(userId, userName(userId), planDate, item.entity_id, activeProjectId());
        } else if (item.entity_type === 'status') {
          db.prepare('INSERT OR IGNORE INTO status_assignees(project_id,status_id,user_id) VALUES(?,?,?)').run(activeProjectId(), item.entity_id, userId);
          db.prepare(`UPDATE status_items SET responsible_user_id=COALESCE(responsible_user_id,?),responsible=CASE WHEN responsible_user_id IS NULL THEN ? ELSE responsible END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?`).run(userId, userName(userId), item.entity_id, activeProjectId());
        } else {
          db.prepare('UPDATE open_points SET owner_user_id=?,owner=?,start_date=COALESCE(start_date,?),updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?').run(userId, userName(userId), planDate, item.entity_id, activeProjectId());
        }
        writeAudit(item.entity_type, item.entity_id, 'update', currentUser, before, baseSnapshot(item.entity_type, item.entity_id));
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return { assigned: items.length, user_id: userId, plan_date: planDate };
  }

  function calendarData(input, currentUser) {
    const range = safeDateRange(input.from, input.to, 31);
    const scopeControllers = controllersForScope(input.scope || 'all');
    const controllerIds = new Set(scopeControllers.map(row => row.id));
    const types = new Set(Array.isArray(input.types) && input.types.length ? input.types : ['task', 'point', 'status', 'goal', 'note', 'annotation']);
    const priorities = new Set(Array.isArray(input.priorities) ? input.priorities.filter(Boolean) : []);
    const onlyMine = Boolean(input.only_mine);
    const category = clean(input.category);
    const isMentioned = (type, id) => mentionIds(type, id).includes(currentUser.id);
    const events = [];
    const eventKeys = new Set();
    const push = event => {
      if (event.controller_id && !controllerIds.has(event.controller_id)) return;
      if (category && !String(event.category || '').toLocaleLowerCase('pl').includes(category.toLocaleLowerCase('pl'))) return;
      if (priorities.size && ['task', 'point', 'status', 'goal'].includes(event.entity_type) && !priorities.has(event.priority || 'Medium')) return;
      if (onlyMine && !event.related_to_me) return;
      const key = `${event.entity_type}:${event.entity_id}:${event.start_date}:${event.end_date}`;
      if (eventKeys.has(key)) return;
      eventKeys.add(key);
      events.push(event);
    };
    const taskList = taskRows(input.scope || 'all', currentUser);
    const pointList = pointRows(input.scope || 'all', currentUser);
    const statusList = statusRows(input.scope || 'all', currentUser);
    const noteList = noteRows(input.scope || 'all', null, null, currentUser);
    const goalList = goalRows(input.scope || 'all', currentUser);
    if (types.has('task')) for (const row of taskList) {
      if (!row.start_date || !row.due_date) continue;
      const start = row.start_date;
      const end = row.due_date;
      if (end < range.from || start > range.to) continue;
      const ownSubtasks = row.checklist.filter(item => item.owner_user_id === currentUser.id);
      push({ entity_type: 'task', entity_id: row.id, title: row.title, start_date: start, end_date: end, controller: row.controller, controller_label: row.controller_label, controller_id: row.controller_id, category: row.category, priority: row.priority, status: row.status, assigned_names: row.owner_name, due_date: row.due_date, color: row.status === 'Done' ? 'green' : row.due_date && row.due_date < new Date().toISOString().slice(0, 10) ? 'red' : 'blue', related_to_me: row.assignee_user_ids.includes(currentUser.id) || row.created_by === currentUser.id || isMentioned('task', row.id) || ownSubtasks.length > 0 });
    }
    if (types.has('point')) for (const row of pointList) {
      const mine = row.owner_user_id === currentUser.id || row.created_by === currentUser.id || isMentioned('point', row.id);
      if (row.start_date && row.due_date && row.due_date >= range.from && row.start_date <= range.to) push({ entity_type: 'point', entity_id: row.id, title: row.title, start_date: row.start_date, end_date: row.due_date, controller: row.controller, controller_label: row.controller_label, controller_id: row.controller_id, category: row.category, priority: row.priority, status: row.status, assigned_names: row.owner_name, due_date: row.due_date, color: row.status === 'Closed' ? 'green' : row.due_date < new Date().toISOString().slice(0, 10) ? 'red' : 'amber', related_to_me: mine });
      if (row.reminder_date && row.reminder_date >= range.from && row.reminder_date <= range.to) push({ entity_type: 'point', entity_id: row.id, title: `Przypomnienie · ${row.title}`, start_date: row.reminder_date, end_date: row.reminder_date, controller: row.controller, controller_label: row.controller_label, controller_id: row.controller_id, category: row.category, priority: row.priority, status: row.status, assigned_names: row.owner_name, due_date: row.due_date, color: row.status === 'Closed' ? 'green' : row.reminder_date < new Date().toISOString().slice(0, 10) ? 'red' : 'amber', related_to_me: mine });
    }
    if (types.has('status')) for (const row of statusList) {
      const date = row.checked_on || String(row.created_at).slice(0, 10);
      if (date < range.from || date > range.to) continue;
      push({ entity_type: 'status', entity_id: row.id, title: row.function_detail, start_date: date, end_date: date, controller: row.controller, controller_label: row.controller_label, controller_id: row.controller_id, category: row.category, priority: row.criticality, status: row.status, assigned_names: row.responsible_name, color: row.status === 'Done' ? 'green' : row.status === 'Blocked' ? 'red' : 'violet', related_to_me: row.responsible_user_ids.includes(currentUser.id) || row.created_by === currentUser.id });
    }
    if (types.has('goal')) for (const row of goalList) if (row.due_date && row.due_date >= range.from && row.due_date <= range.to) push({ entity_type: 'goal', entity_id: row.id, title: row.title, start_date: row.due_date, end_date: row.due_date, controller: row.controller, controller_label: row.controller_label, controller_id: row.controller_id, category: 'Cel', priority: row.priority, status: row.status, assigned_names: row.created_by_name, due_date: row.due_date, color: row.status === 'Done' ? 'green' : 'blue', related_to_me: row.created_by === currentUser.id });
    if (types.has('note')) for (const row of noteList) if (row.note_date >= range.from && row.note_date <= range.to) push({ entity_type: 'note', entity_id: row.id, title: `${row.type} · ${row.content.slice(0, 70)}`, start_date: row.note_date, end_date: row.note_date, controller: row.controller, controller_label: row.controller_label, controller_id: row.controller_id, category: row.type, status: row.shift, assigned_names: row.created_by_name || row.author, color: 'gray', related_to_me: row.created_by === currentUser.id || isMentioned('note', row.id) });
    if (types.has('annotation')) for (const row of all(`SELECT ca.*,c.code controller,creator.display_name created_by_name,u.display_name assigned_user_name
      FROM calendar_annotations ca LEFT JOIN controllers c ON c.id=ca.controller_id LEFT JOIN users creator ON creator.id=ca.created_by LEFT JOIN users u ON u.id=ca.assigned_user_id
      WHERE ca.project_id=? AND ca.end_date>=? AND ca.start_date<=? ORDER BY ca.start_date,ca.id`, activeProjectId(), range.from, range.to)) push({ ...attachControllerMeta(row), entity_type: 'annotation', entity_id: row.id, category: 'Adnotacja', status: '', assigned_names: row.assigned_user_name || row.created_by_name, color: 'blue', related_to_me: row.assigned_user_id === currentUser.id || row.created_by === currentUser.id });
    const maps = {
      task: new Map(taskList.map(row => [row.id, row])), point: new Map(pointList.map(row => [row.id, row])),
      status: new Map(statusList.map(row => [row.id, row])), note: new Map(noteList.map(row => [row.id, row])), goal: new Map(goalList.map(row => [row.id, row]))
    };
    for (const placement of all('SELECT * FROM calendar_item_dates WHERE project_id=? AND calendar_date BETWEEN ? AND ? ORDER BY calendar_date,id', activeProjectId(), range.from, range.to)) {
      if (!types.has(placement.entity_type)) continue;
      const row = maps[placement.entity_type]?.get(placement.entity_id);
      if (!row) continue;
      const common = { entity_type: placement.entity_type, entity_id: row.id, start_date: placement.calendar_date, end_date: placement.calendar_date, controller: row.controller, controller_label: row.controller_label, controller_id: row.controller_id, category: row.category || row.type || (placement.entity_type === 'goal' ? 'Cel' : ''), priority: row.priority || row.criticality || 'Medium', status: row.status || row.shift, due_date: row.due_date, scheduled: true };
      if (placement.entity_type === 'task' && row.start_date && row.due_date) push({ ...common, start_date: row.start_date, end_date: row.due_date, title: row.title, assigned_names: row.owner_name, color: 'blue', related_to_me: row.assignee_user_ids.includes(currentUser.id) || row.created_by === currentUser.id || isMentioned('task', row.id) });
      if (placement.entity_type === 'point') push({ ...common, title: row.title, assigned_names: row.owner_name, color: 'amber', related_to_me: row.owner_user_id === currentUser.id || row.created_by === currentUser.id || isMentioned('point', row.id) });
      if (placement.entity_type === 'status') push({ ...common, title: row.function_detail, assigned_names: row.responsible_name, color: 'violet', related_to_me: row.responsible_user_ids.includes(currentUser.id) || row.created_by === currentUser.id });
      if (placement.entity_type === 'note') push({ ...common, title: `${row.type} · ${row.content.slice(0, 70)}`, assigned_names: row.created_by_name || row.author, color: 'gray', related_to_me: row.created_by === currentUser.id || isMentioned('note', row.id) });
      if (placement.entity_type === 'goal') push({ ...common, title: row.title, assigned_names: row.created_by_name, color: 'blue', related_to_me: row.created_by === currentUser.id });
    }
    events.sort((a, b) => a.start_date.localeCompare(b.start_date) || Number(b.entity_type === 'annotation') - Number(a.entity_type === 'annotation') || a.entity_type.localeCompare(b.entity_type) || a.title.localeCompare(b.title, 'pl'));
    return { ...range, events };
  }

  function saveCalendarItems(input, currentUser) {
    const calendarDate = nullableDate(input.calendar_date);
    if (!calendarDate) throw appError('Wybierz poprawną datę kalendarza');
    const items = [...new Map((Array.isArray(input.items) ? input.items : []).map(item => [`${item.entity_type}:${asId(item.entity_id)}`, { entity_type: item.entity_type, entity_id: asId(item.entity_id) }])).values()].filter(item => TABLES[item.entity_type] && item.entity_id);
    if (!items.length) throw appError('Wybierz co najmniej jeden element');
    const insert = db.prepare('INSERT OR IGNORE INTO calendar_item_dates(project_id,entity_type,entity_id,calendar_date,created_by) VALUES(?,?,?,?,?)');
    let added = 0;
    for (const item of items) {
      if (!one(`SELECT 1 FROM ${TABLES[item.entity_type]} WHERE id=? AND project_id=?`, item.entity_id, activeProjectId())) throw appError('Wybrany element nie należy do projektu');
      added += Number(insert.run(activeProjectId(), item.entity_type, item.entity_id, calendarDate, currentUser.id).changes || 0);
    }
    return { added, calendar_date: calendarDate };
  }

  function saveCalendarAnnotation(id, input, currentUser) {
    const title = clean(input.title);
    const startDate = nullableDate(input.start_date);
    const endDate = nullableDate(input.end_date) || startDate;
    if (!title || !startDate) throw appError('Tytuł i data rozpoczęcia są wymagane');
    if (endDate < startDate) throw appError('Data końcowa nie może być wcześniejsza od początkowej');
    const controllerId = asId(input.controller_id);
    const assignedUserId = asId(input.assigned_user_id);
    if (controllerId && !one('SELECT 1 FROM controllers WHERE id=? AND project_id=?', controllerId, activeProjectId())) throw appError('Sterownik nie należy do projektu');
    if (assignedUserId && !one('SELECT 1 FROM project_memberships WHERE project_id=? AND user_id=? AND active=1', activeProjectId(), assignedUserId)) throw appError('Użytkownik nie jest aktywny w projekcie');
    const color = 'blue';
    if (id) {
      const result = db.prepare(`UPDATE calendar_annotations SET title=?,description=?,start_date=?,end_date=?,controller_id=?,assigned_user_id=?,color=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?`)
        .run(title, clean(input.description), startDate, endDate, controllerId, assignedUserId, color, id, activeProjectId());
      if (!result.changes) throw appError('Nie znaleziono adnotacji', 404);
    } else id = insertRecord('calendar_annotations', { project_id: activeProjectId(), title, description: clean(input.description), start_date: startDate, end_date: endDate, controller_id: controllerId, assigned_user_id: assignedUserId, color, created_by: currentUser.id });
    return one('SELECT * FROM calendar_annotations WHERE id=? AND project_id=?', id, activeProjectId());
  }

  function deleteCalendarAnnotation(id) {
    const result = db.prepare('DELETE FROM calendar_annotations WHERE id=? AND project_id=?').run(id, activeProjectId());
    if (!result.changes) throw appError('Nie znaleziono adnotacji', 404);
  }

  function announcementRows(currentUser) {
    const hierarchy = hierarchyData();
    const groupMap = new Map(hierarchy.groups.map(group => [group.id, group]));
    return all(`SELECT a.*,u.display_name created_by_name FROM announcements a
      LEFT JOIN users u ON u.id=a.created_by WHERE a.project_id=? ORDER BY a.created_at DESC,a.id DESC`, activeProjectId()).map(row => {
      const scopeIds = all('SELECT controller_group_id FROM announcement_scopes WHERE announcement_id=? ORDER BY controller_group_id', row.id).map(item => item.controller_group_id);
      const recipientIds = all('SELECT user_id FROM announcement_users WHERE announcement_id=? ORDER BY user_id', row.id).map(item => item.user_id);
      const reads = all(`SELECT ar.user_id,ar.read_at,u.display_name FROM announcement_reads ar JOIN users u ON u.id=ar.user_id
        WHERE ar.announcement_id=? ORDER BY ar.read_at,u.display_name`, row.id);
      const projectAudienceIds = all(`SELECT pm.user_id FROM project_memberships pm JOIN users u ON u.id=pm.user_id
        WHERE pm.project_id=? AND pm.active=1 AND u.active=1 ORDER BY u.sort_order,u.display_name`, activeProjectId()).map(item => Number(item.user_id));
      const audienceIds = recipientIds.length ? recipientIds.map(Number) : projectAudienceIds;
      const audienceSet = new Set(audienceIds);
      const audienceReads = reads.filter(item => audienceSet.has(Number(item.user_id)));
      const labels = all(`SELECT al.* FROM announcement_label_links allk JOIN announcement_labels al ON al.id=allk.label_id
        WHERE allk.announcement_id=? AND al.active=1 ORDER BY al.sort_order,al.name`, row.id);
      return {
        ...row,
        scope_group_ids: scopeIds,
        scopes: scopeIds.map(id => groupMap.get(Number(id))).filter(Boolean),
        recipient_user_ids: recipientIds,
        recipient_names: recipientIds.map(userName).filter(Boolean),
        labels,
        label_ids: labels.map(item => item.id),
        links: all('SELECT entity_type,entity_id FROM announcement_links WHERE announcement_id=? ORDER BY entity_type,entity_id', row.id),
        accepted_by_me: reads.some(item => item.user_id === currentUser?.id),
        accepted_at: reads.find(item => item.user_id === currentUser?.id)?.read_at || null,
        requires_ack: audienceSet.has(Number(currentUser?.id)),
        targeted_audience: recipientIds.length > 0,
        accepted_count: audienceReads.length, audience_count: audienceIds.length,
        accepted_users: ['system_admin', 'project_admin', 'moderator'].includes(currentUser?.role) ? audienceReads : [],
        can_edit: ['system_admin', 'project_admin', 'moderator'].includes(currentUser?.role),
        can_delete: ['system_admin', 'project_admin'].includes(currentUser?.role)
      };
    });
  }

  function saveAnnouncement(id, input, currentUser) {
    const title = clean(input.title);
    const content = clean(input.content);
    if (!title || !content) throw appError('Tytuł i treść wiadomości są wymagane');
    const scopeIds = [...new Set((Array.isArray(input.scope_group_ids) ? input.scope_group_ids : []).map(asId).filter(Boolean))];
    const recipientIds = [...new Set((Array.isArray(input.recipient_user_ids) ? input.recipient_user_ids : []).map(asId).filter(Boolean))];
    const labelIds = [...new Set((Array.isArray(input.label_ids) ? input.label_ids : []).map(asId).filter(Boolean))];
    const requestedImportance = clean(input.importance) || 'Normalna';
    const importance = one("SELECT value FROM options WHERE project_id=? AND kind='announcement_importance' AND value=? COLLATE NOCASE AND active=1", activeProjectId(), requestedImportance)?.value || 'Normalna';
    const links = [...new Map((Array.isArray(input.links) ? input.links : []).map(link => [`${link.entity_type}:${asId(link.entity_id)}`, { entity_type: clean(link.entity_type), entity_id: asId(link.entity_id) }])).values()]
      .filter(link => TABLES[link.entity_type] && link.entity_id);
    for (const groupId of scopeIds) if (!one('SELECT 1 FROM controller_groups WHERE id=? AND project_id=? AND active=1', groupId, activeProjectId())) throw appError('Wybrany obszar wiadomości nie należy do projektu');
    if (hasHierarchyOverlap(scopeIds)) throw appError('Wybierz obszar nadrzędny albo jego podobszar, nie oba jednocześnie');
    for (const userId of recipientIds) if (!one('SELECT 1 FROM project_memberships WHERE project_id=? AND user_id=? AND active=1', activeProjectId(), userId)) throw appError('Wybrany odbiorca nie jest aktywny w projekcie');
    for (const labelId of labelIds) if (!one('SELECT 1 FROM announcement_labels WHERE id=? AND project_id=? AND active=1', labelId, activeProjectId())) throw appError('Wybrana etykieta nie należy do projektu');
    for (const link of links) if (!one(`SELECT 1 FROM ${TABLES[link.entity_type]} WHERE id=? AND project_id=?`, link.entity_id, activeProjectId())) throw appError('Powiązany element nie należy do projektu');
    let recordId = asId(id);
    const isNew = !recordId;
    if (recordId && input.updated_at) {
      const current = one('SELECT updated_at FROM announcements WHERE id=? AND project_id=?', recordId, activeProjectId());
      if (!current) throw appError('Nie znaleziono wiadomości', 404);
      if (String(current.updated_at) !== String(input.updated_at)) throw appError('Ta wiadomość została w międzyczasie zmieniona. Otwórz ją ponownie przed zapisaniem.', 409);
    }
    db.exec('BEGIN IMMEDIATE');
    try {
      if (recordId) {
        const result = db.prepare("UPDATE announcements SET title=?,content=?,info_link=?,importance=?,updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=? AND project_id=?").run(title, content, clean(input.info_link), importance, recordId, activeProjectId());
        if (!result.changes) throw appError('Nie znaleziono wiadomości', 404);
      } else recordId = insertRecord('announcements', { project_id: activeProjectId(), title, content, info_link: clean(input.info_link), importance, created_by: currentUser.id });
      db.prepare('DELETE FROM announcement_scopes WHERE announcement_id=?').run(recordId);
      db.prepare('DELETE FROM announcement_users WHERE announcement_id=?').run(recordId);
      db.prepare('DELETE FROM announcement_links WHERE announcement_id=?').run(recordId);
      db.prepare('DELETE FROM announcement_label_links WHERE announcement_id=?').run(recordId);
      const insertScope = db.prepare('INSERT INTO announcement_scopes(announcement_id,controller_group_id) VALUES(?,?)');
      const insertUser = db.prepare('INSERT INTO announcement_users(announcement_id,user_id) VALUES(?,?)');
      const insertLink = db.prepare('INSERT INTO announcement_links(announcement_id,entity_type,entity_id) VALUES(?,?,?)');
      const insertLabel = db.prepare('INSERT INTO announcement_label_links(announcement_id,label_id) VALUES(?,?)');
      scopeIds.forEach(groupId => insertScope.run(recordId, groupId));
      recipientIds.forEach(userId => insertUser.run(recordId, userId));
      links.forEach(link => insertLink.run(recordId, link.entity_type, link.entity_id));
      labelIds.forEach(labelId => insertLabel.run(recordId, labelId));
      if (isNew) {
        const notificationIds = recipientIds.length ? [...new Set([...recipientIds, currentUser.id])] : all('SELECT user_id FROM project_memberships WHERE project_id=? AND active=1', activeProjectId()).map(item => item.user_id);
        const notificationAudience = notificationIds.map(user_id => ({ user_id }));
        for (const member of notificationAudience) {
          createNotification(member.user_id, 'announcement', 'announcement', recordId, `Nowa wiadomość (${importance}): ${title}`, content.slice(0, 240));
        }
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return announcementRows(currentUser).find(row => row.id === recordId);
  }

  function deleteAnnouncement(id) {
    const result = db.prepare('DELETE FROM announcements WHERE id=? AND project_id=?').run(asId(id), activeProjectId());
    if (!result.changes) throw appError('Nie znaleziono wiadomości', 404);
  }

  function acknowledgeAnnouncement(id, currentUser) {
    if (!one('SELECT 1 FROM announcements WHERE id=? AND project_id=?', asId(id), activeProjectId())) throw appError('Nie znaleziono wiadomości', 404);
    const targeted = one('SELECT 1 FROM announcement_users WHERE announcement_id=? LIMIT 1', asId(id));
    if (targeted && !one('SELECT 1 FROM announcement_users WHERE announcement_id=? AND user_id=?', asId(id), currentUser.id)) throw appError('Ta wiadomość nie wymaga potwierdzenia od tego użytkownika', 403);
    db.prepare(`INSERT INTO announcement_reads(announcement_id,user_id,read_at) VALUES(?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(announcement_id,user_id) DO UPDATE SET read_at=CURRENT_TIMESTAMP`).run(asId(id), currentUser.id);
    db.prepare(`UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP)
      WHERE project_id=? AND user_id=? AND kind='announcement' AND entity_type='announcement' AND entity_id=?`).run(activeProjectId(), currentUser.id, asId(id));
    return announcementRows(currentUser).find(item => item.id === asId(id));
  }

  function notificationsData(currentUser, limit = 100) {
    return all(`SELECT * FROM notifications WHERE project_id=? AND user_id=? ORDER BY read_at IS NULL DESC,created_at DESC,id DESC LIMIT ?`, activeProjectId(), currentUser.id, Math.max(10, Math.min(250, Number(limit) || 100)));
  }

  function markNotificationRead(id, currentUser) {
    const row = one('SELECT * FROM notifications WHERE id=? AND project_id=? AND user_id=?', asId(id), activeProjectId(), currentUser.id);
    if (!row) throw appError('Nie znaleziono powiadomienia', 404);
    db.prepare('UPDATE notifications SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP) WHERE id=?').run(row.id);
    return { ...row, read_at: row.read_at || new Date().toISOString() };
  }

  function addComment(input, currentUser) {
    const type = clean(input.entity_type);
    const entityId = asId(input.entity_id);
    const content = clean(input.content);
    if (!['status', 'task', 'point', 'goal'].includes(type) || !entityId || !TABLES[type]) throw appError('Nieprawidłowy element komentarza');
    if (!content) throw appError('Treść komentarza jest wymagana');
    if (content.length > 5000) throw appError('Komentarz może mieć maksymalnie 5000 znaków');
    const snapshot = baseSnapshot(type, entityId);
    if (!snapshot) throw appError('Nie znaleziono komentowanego elementu', 404);
    const commentId = insertRecord('entity_comments', { project_id: activeProjectId(), entity_type: type, entity_id: entityId, content, user_id: currentUser.id });
    db.prepare("UPDATE " + TABLES[type] + " SET updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=? AND project_id=?").run(entityId, activeProjectId());
    db.prepare('INSERT INTO audit_log(project_id,entity_type,entity_id,action,user_id,changes_json,snapshot_json) VALUES(?,?,?,?,?,?,?)').run(
      activeProjectId(), type, entityId, 'update', currentUser.id, JSON.stringify({ comment: { from: null, to: content } }), JSON.stringify({ ...snapshot, updated_at: new Date().toISOString() })
    );
    const recipients = new Set([snapshot.created_by]);
    if (type === 'task') {
      (snapshot.direct_assignee_user_ids || []).forEach(id => recipients.add(id));
      (snapshot.checklist || []).forEach(item => recipients.add(item.owner_user_id));
    }
    if (type === 'status') (snapshot.responsible_user_ids || []).forEach(id => recipients.add(id));
    if (type === 'point') recipients.add(snapshot.owner_user_id);
    recipients.delete(currentUser.id); recipients.delete(null); recipients.delete(undefined);
    const label = entityDisplayTitle(type, entityId);
    recipients.forEach(userId => createNotification(userId, 'comment', type, entityId, `Nowy komentarz: ${label}`, `${currentUser.display_name}: ${content.slice(0, 200)}`));
    return one(`SELECT ec.*,u.display_name user_name FROM entity_comments ec JOIN users u ON u.id=ec.user_id WHERE ec.id=?`, commentId);
  }

  function saveCompletionRequirement(id, input) {
    const name = clean(input.name); const description = clean(input.description);
    if (!name) throw appError('Nazwa wymagania jest wymagana');
    let recordId = asId(id);
    if (recordId) {
      const result = db.prepare('UPDATE completion_requirements SET name=?,description=? WHERE id=? AND project_id=?').run(name, description, recordId, activeProjectId());
      if (!result.changes) throw appError('Nie znaleziono wymagania', 404);
    } else {
      const sortOrder = Number(one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM completion_requirements WHERE project_id=?', activeProjectId())?.value || 0);
      recordId = insertRecord('completion_requirements', { project_id: activeProjectId(), name, description, sort_order: sortOrder, active: 1 });
    }
    return one('SELECT * FROM completion_requirements WHERE id=?', recordId);
  }

  function deleteCompletionRequirement(id) {
    const result = db.prepare('DELETE FROM completion_requirements WHERE id=? AND project_id=?').run(asId(id), activeProjectId());
    if (!result.changes) throw appError('Nie znaleziono wymagania', 404);
  }

  function historyData(input = {}) {
    const allowed = new Set(['status', 'task', 'point', 'note']);
    const types = Array.isArray(input.types) && input.types.length ? input.types.filter(type => allowed.has(type)) : [...allowed];
    if (!types.length) return [];
    const limit = Math.max(10, Math.min(500, Number(input.limit) || 150));
    const placeholders = types.map(() => '?').join(',');
    return all(`SELECT a.*,u.display_name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id
      WHERE a.project_id=? AND a.entity_type IN (${placeholders}) ORDER BY a.changed_at DESC,a.id DESC LIMIT ?`, activeProjectId(), ...types, limit).map(row => {
        let changes = {}; let snapshot = {};
        try { changes = JSON.parse(row.changes_json || '{}'); } catch {}
        try { snapshot = JSON.parse(row.snapshot_json || '{}'); } catch {}
        const label = snapshot.function_detail || snapshot.title || snapshot.content?.slice(0, 80) || ({ status: 'Punkt statusu', task: 'Zadanie', point: 'Otwarty punkt', note: 'Wpis dziennika' })[row.entity_type] || 'Element';
        const exists = Boolean(one(`SELECT 1 FROM ${TABLES[row.entity_type]} WHERE id=? AND project_id=?`, row.entity_id, activeProjectId()));
        const controllerItem = hierarchyData().controllers.find(item => item.id === Number(snapshot.controller_id));
        return { ...row, changes, snapshot, label, exists, controller_id: snapshot.controller_id || null, controller_label: controllerItem?.display_name || '', controller_path: controllerItem?.hierarchy_label || '', root_group_id: controllerItem?.root_group_id || null };
      });
  }

  function dailySummaryData(fromValue, toValue, currentUser) {
    const range = safeDateRange(fromValue, toValue, 14);
    const moduleNames = { status: 'Status', task: 'Zadania', point: 'Otwarte punkty', note: 'Dziennik' };
    const rows = all(`SELECT a.*,u.display_name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id
      WHERE a.project_id=? AND a.entity_type IN ('status','task','point','note')
        AND a.action!='migrate'
        AND a.changed_at>=? AND a.changed_at<datetime(?,'+1 day')
      ORDER BY a.changed_at DESC,a.id DESC`, activeProjectId(), `${range.from} 00:00:00`, `${range.to} 00:00:00`);
    const priorities = { changed: 1, removed: 2, added: 3, closed: 4 };
    const unique = new Map();
    for (const row of rows) {
      let changes = {}; let snapshot = {};
      try { changes = JSON.parse(row.changes_json || '{}'); } catch {}
      try { snapshot = JSON.parse(row.snapshot_json || '{}'); } catch {}
      const nextStatus = changes.status?.to ?? snapshot.status;
      const classification = row.action === 'create' ? 'added' : row.action === 'delete' ? 'removed' : ['Done', 'Closed'].includes(nextStatus) && changes.status ? 'closed' : 'changed';
      const key = `${row.entity_type}:${row.entity_id}`;
      const previous = unique.get(key);
      const label = snapshot.function_detail || snapshot.title || snapshot.content?.slice(0, 100) || moduleNames[row.entity_type] || 'Element';
      const item = { entity_type: row.entity_type, entity_id: row.entity_id, classification, label, changed_at: row.changed_at, user_name: row.user_name || 'System', exists: Boolean(one(`SELECT 1 FROM ${TABLES[row.entity_type]} WHERE id=? AND project_id=?`, row.entity_id, activeProjectId())) };
      if (!previous || priorities[classification] > priorities[previous.classification]) unique.set(key, item);
    }
    const modules = Object.fromEntries(Object.entries(moduleNames).map(([type, name]) => {
      const items = [...unique.values()].filter(item => item.entity_type === type).sort((a, b) => b.changed_at.localeCompare(a.changed_at));
      const counts = { added: 0, closed: 0, changed: 0, removed: 0 };
      items.forEach(item => { counts[item.classification] += 1; });
      return [type, { name, counts, total: items.length, items }];
    }));
    const totals = { added: 0, closed: 0, changed: 0, removed: 0, total: 0 };
    Object.values(modules).forEach(module => { totals.total += module.total; for (const key of ['added', 'closed', 'changed', 'removed']) totals[key] += module.counts[key]; });
    const priority_notifications = currentUser ? notificationsData(currentUser, 100).filter(item => !item.read_at && ['assignment', 'comment', 'automation', 'handover'].includes(item.kind)) : [];
    return { ...range, totals, modules, priority_notifications };
  }

  function parseJson(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
  }

  function savedViewRows(currentUser) {
    return all(`SELECT sv.*,u.display_name owner_name FROM saved_views sv JOIN users u ON u.id=sv.owner_user_id
      WHERE sv.project_id=? AND (sv.visibility='team' OR sv.owner_user_id=?)
      ORDER BY sv.module,sv.is_default DESC,sv.visibility DESC,sv.name`, activeProjectId(), currentUser.id)
      .map(row => ({ ...row, config: parseJson(row.config_json, {}) }));
  }

  function saveSavedView(id, input, currentUser) {
    const module = ['status', 'tasks', 'points', 'operations'].includes(clean(input.module)) ? clean(input.module) : '';
    const visibility = clean(input.visibility) === 'team' ? 'team' : 'personal';
    const name = clean(input.name);
    if (!module || !name) throw appError('Nazwa i moduł widoku są wymagane');
    if (visibility === 'team' && !['system_admin', 'project_admin', 'moderator'].includes(currentUser.role)) throw appError('Widoki zespołowe może zapisywać Manager projektu lub administrator', 403);
    const config = input.config && typeof input.config === 'object' && !Array.isArray(input.config) ? input.config : {};
    if (JSON.stringify(config).length > 50000) throw appError('Konfiguracja widoku jest zbyt duża');
    const isDefault = Number(input.is_default) ? 1 : 0;
    if (id) {
      const existing = one('SELECT * FROM saved_views WHERE id=? AND project_id=?', id, activeProjectId());
      if (!existing) throw appError('Nie znaleziono zapisanego widoku', 404);
      const manager = ['system_admin', 'project_admin', 'moderator'].includes(currentUser.role);
      if (existing.owner_user_id !== currentUser.id && !(existing.visibility === 'team' && manager)) throw appError('Nie możesz edytować tego widoku', 403);
      db.prepare(`UPDATE saved_views SET name=?,module=?,visibility=?,config_json=?,is_default=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND project_id=?`).run(name, module, visibility, JSON.stringify(config), isDefault, id, activeProjectId());
    } else {
      id = insertRecord('saved_views', { project_id: activeProjectId(), owner_user_id: currentUser.id, module, name, visibility, config_json: JSON.stringify(config), is_default: isDefault, created_by: currentUser.id });
    }
    if (isDefault) db.prepare('UPDATE saved_views SET is_default=0 WHERE project_id=? AND owner_user_id=? AND module=? AND id!=?').run(activeProjectId(), currentUser.id, module, id);
    const row = one(`SELECT sv.*,u.display_name owner_name FROM saved_views sv JOIN users u ON u.id=sv.owner_user_id WHERE sv.id=?`, id);
    return { ...row, config: parseJson(row.config_json, {}) };
  }

  function deleteSavedView(id, currentUser) {
    const existing = one('SELECT * FROM saved_views WHERE id=? AND project_id=?', id, activeProjectId());
    if (!existing) throw appError('Nie znaleziono zapisanego widoku', 404);
    const manager = ['system_admin', 'project_admin', 'moderator'].includes(currentUser.role);
    if (existing.owner_user_id !== currentUser.id && !(existing.visibility === 'team' && manager)) throw appError('Nie możesz usunąć tego widoku', 403);
    db.prepare('DELETE FROM saved_views WHERE id=? AND project_id=?').run(id, activeProjectId());
  }

  function operationTitle(type, row) {
    return type === 'status' ? row.function_detail : row.title;
  }

  function operationScope(row) {
    return row.scope_label || row.controller_label || row.controller_path || row.controller || 'Cały projekt';
  }

  function operationCollections(currentUser) {
    return {
      status: statusRows('all', currentUser),
      task: taskRows('all', currentUser),
      point: pointRows('all', currentUser),
      goal: goalRows('all', currentUser)
    };
  }

  function isClosedEntity(type, row) {
    if (type === 'status') return ['Done', 'N/A'].includes(row.status);
    if (type === 'point') return row.status === 'Closed';
    return row.status === 'Done';
  }

  function ownerIdsForEntity(type, row) {
    if (type === 'task') return row.assignee_user_ids || [];
    if (type === 'status') return row.responsible_user_ids || [];
    if (type === 'point') return row.owner_user_id ? [row.owner_user_id] : [];
    return [];
  }

  function triageSignals(type, row, dueSoonDays = 7) {
    if (isClosedEntity(type, row)) return [];
    const todayValue = new Date().toISOString().slice(0, 10);
    const soonDate = new Date(`${todayValue}T12:00:00Z`); soonDate.setUTCDate(soonDate.getUTCDate() + Math.max(0, Number(dueSoonDays || 0)));
    const soon = soonDate.toISOString().slice(0, 10);
    const signals = [];
    if (row.due_date && row.due_date < todayValue) signals.push('overdue');
    else if (row.due_date && row.due_date >= todayValue && row.due_date <= soon) signals.push('due_soon');
    if (type === 'point' && row.reminder_date && row.reminder_date <= todayValue) signals.push('reminder_due');
    if (!ownerIdsForEntity(type, row).length && type !== 'goal') signals.push('unassigned');
    if (['Blocked', 'NOK / Rework', 'Waiting'].includes(row.status)) signals.push('blocked');
    if (type === 'task' && Number(row.blocked_by_dependencies || 0) > 0) signals.push('dependency');
    return signals;
  }

  function triageRows(currentUser, dueSoonDays = 7) {
    const collections = operationCollections(currentUser);
    const labels = { status: 'Status', task: 'Zadanie', point: 'Otwarty punkt', goal: 'Cel' };
    return Object.entries(collections).flatMap(([type, rows]) => rows.map(row => {
      const signals = triageSignals(type, row, dueSoonDays);
      return signals.length ? {
        entity_type: type, entity_id: row.id, module_label: labels[type], title: operationTitle(type, row), scope_label: operationScope(row),
        status: row.status, priority: row.priority || row.criticality || 'Medium', owner_name: row.owner_name || row.responsible_name || '',
        due_date: row.due_date || null, reminder_date: row.reminder_date || null, signals
      } : null;
    }).filter(Boolean)).sort((left, right) => {
      const score = row => (row.signals.includes('overdue') ? 50 : 0) + (row.signals.includes('blocked') ? 40 : 0) + (row.signals.includes('reminder_due') ? 30 : 0) + (row.signals.includes('unassigned') ? 20 : 0) + (row.priority === 'Critical' ? 15 : row.priority === 'High' ? 8 : 0);
      return score(right) - score(left) || String(left.due_date || '9999').localeCompare(String(right.due_date || '9999'));
    });
  }

  function qualityRows(currentUser) {
    const collections = operationCollections(currentUser);
    const issues = [];
    const add = (type, row, code, severity, message) => issues.push({ entity_type: type, entity_id: row.id, title: operationTitle(type, row), scope_label: operationScope(row), code, severity, message });
    for (const row of collections.status) if (!isClosedEntity('status', row)) {
      if (!(row.responsible_user_ids || []).length) add('status', row, 'missing_owner', 'high', 'Brak osoby odpowiedzialnej');
      if (!clean(row.category)) add('status', row, 'missing_category', 'medium', 'Brak kategorii statusu');
      if (!clean(row.function_detail)) add('status', row, 'missing_description', 'high', 'Brak instrukcji testu');
    }
    for (const row of collections.task) if (!isClosedEntity('task', row)) {
      if (!(row.assignee_user_ids || []).length) add('task', row, 'missing_owner', 'high', 'Brak osoby odpowiedzialnej');
      if (!row.due_date) add('task', row, 'missing_deadline', 'medium', 'Brak deadline’u');
      if (!row.start_date) add('task', row, 'missing_start', 'low', 'Brak planowanego startu');
      if (!clean(row.category)) add('task', row, 'missing_category', 'low', 'Brak kategorii zadania');
    }
    for (const row of collections.point) if (!isClosedEntity('point', row)) {
      if (!row.owner_user_id) add('point', row, 'missing_owner', 'high', 'Brak osoby odpowiedzialnej');
      if (!row.due_date) add('point', row, 'missing_deadline', 'medium', 'Brak deadline’u');
      if (!row.reminder_date) add('point', row, 'missing_reminder', 'medium', 'Brak daty przypomnienia');
      if (!clean(row.next_action)) add('point', row, 'missing_next_action', 'medium', 'Brak następnego kroku');
    }
    for (const row of collections.goal) if (!isClosedEntity('goal', row) && !row.due_date) add('goal', row, 'missing_deadline', 'medium', 'Brak terminu celu');
    const invalidLinks = all(`SELECT el.id,el.source_type,el.source_id,el.target_type,el.target_id FROM entity_links el WHERE el.project_id=?`, activeProjectId()).filter(link => {
      const sourceTable = TABLES[link.source_type]; const targetTable = TABLES[link.target_type];
      return !sourceTable || !targetTable || !one(`SELECT 1 FROM ${sourceTable} WHERE id=? AND project_id=?`, link.source_id, activeProjectId()) || !one(`SELECT 1 FROM ${targetTable} WHERE id=? AND project_id=?`, link.target_id, activeProjectId());
    });
    invalidLinks.forEach(link => issues.push({ entity_type: link.source_type, entity_id: link.source_id, title: 'Uszkodzone powiązanie', scope_label: 'Projekt', code: 'orphan_link', severity: 'high', message: `Powiązanie do niedostępnego elementu ${link.target_type}` }));
    return issues.sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severity] - ({ high: 0, medium: 1, low: 2 })[b.severity] || a.title.localeCompare(b.title, 'pl'));
  }

  function criticalPathData(currentUser) {
    const tasks = taskRows('all', currentUser).filter(task => task.status !== 'Done');
    const ids = new Set(tasks.map(task => task.id));
    const edges = all('SELECT * FROM task_dependencies WHERE project_id=? ORDER BY task_id,prerequisite_task_id', activeProjectId()).filter(edge => ids.has(edge.task_id) && ids.has(edge.prerequisite_task_id));
    const prerequisites = new Map(tasks.map(task => [task.id, []]));
    const dependents = new Map(tasks.map(task => [task.id, []]));
    edges.forEach(edge => { prerequisites.get(edge.task_id).push(edge); dependents.get(edge.prerequisite_task_id).push(edge); });
    const duration = task => {
      if (!task.start_date || !task.due_date || task.due_date < task.start_date) return 1;
      return Math.max(1, Math.round((new Date(`${task.due_date}T12:00:00Z`) - new Date(`${task.start_date}T12:00:00Z`)) / 86400000) + 1);
    };
    const indegree = new Map(tasks.map(task => [task.id, prerequisites.get(task.id).length]));
    const score = new Map(tasks.map(task => [task.id, duration(task)]));
    const parent = new Map();
    const queue = tasks.filter(task => indegree.get(task.id) === 0).map(task => task.id);
    const order = [];
    while (queue.length) {
      const taskId = queue.shift(); order.push(taskId);
      for (const edge of dependents.get(taskId) || []) {
        const candidate = Number(score.get(taskId) || 0) + Number(edge.lag_days || 0) + duration(tasks.find(task => task.id === edge.task_id));
        if (candidate > Number(score.get(edge.task_id) || 0)) { score.set(edge.task_id, candidate); parent.set(edge.task_id, taskId); }
        indegree.set(edge.task_id, indegree.get(edge.task_id) - 1); if (indegree.get(edge.task_id) === 0) queue.push(edge.task_id);
      }
    }
    const cycle_count = Math.max(0, tasks.length - order.length);
    let endId = order.sort((a, b) => Number(score.get(b)) - Number(score.get(a)))[0];
    const pathIds = [];
    while (endId) { pathIds.unshift(endId); endId = parent.get(endId); }
    const critical_path = pathIds.map(id => {
      const task = tasks.find(item => item.id === id); return { entity_type: 'task', entity_id: id, title: task.title, scope_label: operationScope(task), status: task.status, priority: task.priority, duration_days: duration(task), cumulative_days: score.get(id) };
    });
    const blocked_tasks = tasks.filter(task => Number(task.blocked_by_dependencies || 0) > 0).map(task => ({ entity_type: 'task', entity_id: task.id, title: task.title, scope_label: operationScope(task), blocked_by: task.dependencies.filter(item => item.status !== 'Done').map(item => ({ id: item.id, title: item.title, status: item.status })) }));
    return { tasks: tasks.length, edges: edges.length, cycle_count, total_days: critical_path.at(-1)?.cumulative_days || 0, critical_path, blocked_tasks };
  }

  function operationsData(currentUser) {
    const triage = triageRows(currentUser);
    const quality = qualityRows(currentUser);
    return {
      triage,
      triage_counts: Object.fromEntries(['overdue', 'due_soon', 'reminder_due', 'unassigned', 'blocked', 'dependency'].map(signal => [signal, triage.filter(item => item.signals.includes(signal)).length])),
      quality,
      quality_counts: Object.fromEntries(['high', 'medium', 'low'].map(level => [level, quality.filter(item => item.severity === level).length])),
      dependencies: criticalPathData(currentUser),
      handovers: handoverRows(currentUser),
      automation_rules: automationRuleRows(),
      commissioning_templates: commissioningTemplateRows(),
      can_coordinate: ['system_admin', 'project_admin', 'moderator'].includes(currentUser.role)
    };
  }

  function triageBatch(input, currentUser) {
    const items = [...new Map((Array.isArray(input.items) ? input.items : []).map(item => [`${clean(item.entity_type)}:${asId(item.entity_id)}`, { entity_type: clean(item.entity_type), entity_id: asId(item.entity_id) }])).values()]
      .filter(item => ['status', 'task', 'point', 'goal'].includes(item.entity_type) && item.entity_id).slice(0, 500);
    if (!items.length) throw appError('Wybierz co najmniej jeden element');
    const patch = input.patch && typeof input.patch === 'object' ? input.patch : {};
    if (!['owner_user_id', 'priority', 'due_date'].some(key => Object.hasOwn(patch, key))) throw appError('Wybierz zmianę do wykonania');
    const priority = ['Low', 'Medium', 'High', 'Critical'].includes(clean(patch.priority)) ? clean(patch.priority) : null;
    const ownerId = Object.hasOwn(patch, 'owner_user_id') ? asId(patch.owner_user_id) : undefined;
    const dueDate = Object.hasOwn(patch, 'due_date') ? nullableDate(patch.due_date) : undefined;
    if (ownerId && !one(`SELECT 1 FROM users u JOIN project_memberships pm ON pm.user_id=u.id
      WHERE u.id=? AND u.active=1 AND pm.project_id=? AND pm.active=1`, ownerId, activeProjectId())) throw appError('Wybrany użytkownik nie uczestniczy w projekcie');
    let updated = 0;
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const item of items) {
        const table = TABLES[item.entity_type];
        const row = one(`SELECT * FROM ${table} WHERE id=? AND project_id=?`, item.entity_id, activeProjectId());
        if (!row) continue;
        const before = baseSnapshot(item.entity_type, item.entity_id);
        if (ownerId !== undefined) {
          if (item.entity_type === 'task') {
            const checklist = all('SELECT owner_user_id FROM task_checklist WHERE task_id=?', item.entity_id);
            const assignees = saveTaskAssignees(item.entity_id, ownerId ? [ownerId] : [], checklist);
            const primary = assignees[0] || null;
            db.prepare("UPDATE tasks SET owner_user_id=?,owner=?,updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=? AND project_id=?").run(primary, userName(primary), item.entity_id, activeProjectId());
            if (ownerId) createNotification(ownerId, 'assignment', 'task', item.entity_id, `Przypisano Ci zadanie: ${row.title}`, `Zmiana zbiorcza wykonana przez ${currentUser.display_name}.`);
          } else if (item.entity_type === 'status') {
            const assignees = saveStatusAssignees(item.entity_id, ownerId ? [ownerId] : []); const primary = assignees[0] || null;
            db.prepare("UPDATE status_items SET responsible_user_id=?,responsible=?,updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=? AND project_id=?").run(primary, userName(primary), item.entity_id, activeProjectId());
            if (ownerId) createNotification(ownerId, 'assignment', 'status', item.entity_id, `Przypisano Ci punkt statusu: ${row.function_detail}`, `Zmiana zbiorcza wykonana przez ${currentUser.display_name}.`);
          } else if (item.entity_type === 'point') {
            db.prepare("UPDATE open_points SET owner_user_id=?,owner=?,updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=? AND project_id=?").run(ownerId || null, userName(ownerId), item.entity_id, activeProjectId());
            if (ownerId) createNotification(ownerId, 'assignment', 'point', item.entity_id, `Przypisano Ci otwarty punkt: ${row.title}`, `Zmiana zbiorcza wykonana przez ${currentUser.display_name}.`);
          }
        }
        if (priority) {
          const field = item.entity_type === 'status' ? 'criticality' : 'priority';
          db.prepare(`UPDATE ${table} SET ${field}=?,updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=? AND project_id=?`).run(priority, item.entity_id, activeProjectId());
        }
        if (dueDate !== undefined && ['task', 'point', 'goal'].includes(item.entity_type)) {
          db.prepare(`UPDATE ${table} SET due_date=?,updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=? AND project_id=?`).run(dueDate, item.entity_id, activeProjectId());
        }
        const after = baseSnapshot(item.entity_type, item.entity_id);
        if (JSON.stringify(before) !== JSON.stringify(after)) { writeAudit(item.entity_type, item.entity_id, 'update', currentUser, before, after); updated += 1; }
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return { updated };
  }

  function handoverItemRows(handoverId) {
    const hierarchy = hierarchyData();
    return all('SELECT * FROM shift_handover_items WHERE handover_id=? ORDER BY sort_order,entity_type,entity_id', handoverId).map(link => {
      const table = TABLES[link.entity_type];
      const row = table ? one(`SELECT * FROM ${table} WHERE id=? AND project_id=?`, link.entity_id, activeProjectId()) : null;
      if (!row) return { ...link, missing: 1, title: 'Element niedostępny', scope_label: '' };
      const controllerItem = hierarchy.controllers.find(item => item.id === Number(row.controller_id));
      const group = hierarchy.groups.find(item => item.id === Number(row.controller_group_id));
      return { ...link, title: operationTitle(link.entity_type, row) || row.content || 'Element projektu', status: row.status || row.type || '', scope_label: group?.path_label || controllerItem?.display_name || 'Cały projekt' };
    });
  }

  function handoverRows(currentUser) {
    return all(`SELECT h.*,creator.display_name created_by_name,acceptor.display_name accepted_by_name
      FROM shift_handovers h LEFT JOIN users creator ON creator.id=h.created_by LEFT JOIN users acceptor ON acceptor.id=h.accepted_by
      WHERE h.project_id=? ORDER BY h.handover_date DESC,h.created_at DESC,h.id DESC`, activeProjectId())
      .map(row => ({ ...row, items: handoverItemRows(row.id), can_edit: row.created_by === currentUser.id || ['system_admin', 'project_admin', 'moderator'].includes(currentUser.role) }));
  }

  function saveHandover(id, input, currentUser) {
    const title = clean(input.title); const summary = clean(input.summary); const handoverDate = nullableDate(input.handover_date);
    const fromShift = clean(input.from_shift); const toShift = clean(input.to_shift);
    if (!title || !summary || !handoverDate || !fromShift || !toShift) throw appError('Data, zmiany, tytuł i podsumowanie są wymagane');
    const existing = id ? one('SELECT * FROM shift_handovers WHERE id=? AND project_id=?', id, activeProjectId()) : null;
    if (id && !existing) throw appError('Nie znaleziono przekazania zmiany', 404);
    const manager = ['system_admin', 'project_admin', 'moderator'].includes(currentUser.role);
    if (existing && existing.created_by !== currentUser.id && !manager) throw appError('Nie możesz edytować tego przekazania', 403);
    const items = [...new Map((Array.isArray(input.items) ? input.items : []).map((item, index) => [`${clean(item.entity_type)}:${asId(item.entity_id)}`, { entity_type: clean(item.entity_type), entity_id: asId(item.entity_id), sort_order: index }])).values()]
      .filter(item => TABLES[item.entity_type] && item.entity_id);
    for (const item of items) if (!one(`SELECT 1 FROM ${TABLES[item.entity_type]} WHERE id=? AND project_id=?`, item.entity_id, activeProjectId())) throw appError('Wybrany element przekazania nie należy do projektu');
    db.exec('BEGIN IMMEDIATE');
    try {
      if (existing) db.prepare(`UPDATE shift_handovers SET handover_date=?,from_shift=?,to_shift=?,title=?,summary=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?`)
        .run(handoverDate, fromShift, toShift, title, summary, id, activeProjectId());
      else id = insertRecord('shift_handovers', { project_id: activeProjectId(), handover_date: handoverDate, from_shift: fromShift, to_shift: toShift, title, summary, status: 'open', created_by: currentUser.id });
      db.prepare('DELETE FROM shift_handover_items WHERE handover_id=?').run(id);
      const insert = db.prepare('INSERT INTO shift_handover_items(handover_id,entity_type,entity_id,sort_order) VALUES(?,?,?,?)');
      items.forEach(item => insert.run(id, item.entity_type, item.entity_id, item.sort_order));
      if (!existing) {
        const recipients = all('SELECT user_id FROM project_memberships WHERE project_id=? AND active=1 AND user_id!=?', activeProjectId(), currentUser.id);
        recipients.forEach(recipient => createNotification(recipient.user_id, 'handover', 'handover', id, `Nowe przekazanie zmiany: ${title}`, `${fromShift} → ${toShift} · ${handoverDate}`));
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return handoverRows(currentUser).find(row => row.id === Number(id));
  }

  function acceptHandover(id, currentUser) {
    const handover = one('SELECT * FROM shift_handovers WHERE id=? AND project_id=?', id, activeProjectId());
    if (!handover) throw appError('Nie znaleziono przekazania zmiany', 404);
    if (handover.status === 'accepted') return handoverRows(currentUser).find(row => row.id === Number(id));
    if (handover.created_by === currentUser.id && !['system_admin', 'project_admin'].includes(currentUser.role)) throw appError('Przekazanie powinien zaakceptować odbiorca kolejnej zmiany', 403);
    db.prepare("UPDATE shift_handovers SET status='accepted',accepted_by=?,accepted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?").run(currentUser.id, id, activeProjectId());
    if (handover.created_by && handover.created_by !== currentUser.id) createNotification(handover.created_by, 'handover', 'handover', id, `Przekazanie zaakceptowane: ${handover.title}`, `${currentUser.display_name} potwierdził odbiór zmiany.`);
    return handoverRows(currentUser).find(row => row.id === Number(id));
  }

  function deleteHandover(id, currentUser) {
    const handover = one('SELECT * FROM shift_handovers WHERE id=? AND project_id=?', id, activeProjectId());
    if (!handover) throw appError('Nie znaleziono przekazania zmiany', 404);
    if (handover.created_by !== currentUser.id && !['system_admin', 'project_admin', 'moderator'].includes(currentUser.role)) throw appError('Nie możesz usunąć tego przekazania', 403);
    db.prepare('DELETE FROM shift_handovers WHERE id=? AND project_id=?').run(id, activeProjectId());
  }

  function automationRuleRows() {
    return all(`SELECT ar.*,u.display_name created_by_name FROM automation_rules ar LEFT JOIN users u ON u.id=ar.created_by
      WHERE ar.project_id=? ORDER BY ar.active DESC,ar.name`, activeProjectId()).map(row => ({ ...row, entity_types: parseJson(row.entity_types_json, []) }));
  }

  function saveAutomationRule(id, input, currentUser) {
    const name = clean(input.name);
    const trigger = ['overdue', 'due_soon', 'reminder_due', 'unassigned', 'blocked'].includes(clean(input.trigger_type)) ? clean(input.trigger_type) : '';
    const action = ['notify_assignees', 'notify_managers', 'escalate_priority'].includes(clean(input.action_type)) ? clean(input.action_type) : '';
    const types = [...new Set((Array.isArray(input.entity_types) ? input.entity_types : []).map(clean).filter(type => ['status', 'task', 'point', 'goal'].includes(type)))];
    const targetPriority = ['Low', 'Medium', 'High', 'Critical'].includes(clean(input.target_priority)) ? clean(input.target_priority) : 'High';
    if (!name || !trigger || !action || !types.length) throw appError('Nazwa, warunek, moduły i działanie reguły są wymagane');
    if (trigger === 'reminder_due' && !types.includes('point')) throw appError('Reguła przypomnienia wymaga modułu Otwarte punkty');
    const values = [name, trigger, JSON.stringify(types), Math.max(0, Math.min(365, Number(input.days_offset || 0))), action, targetPriority, Number(input.active ?? 1) ? 1 : 0];
    if (id) {
      const result = db.prepare(`UPDATE automation_rules SET name=?,trigger_type=?,entity_types_json=?,days_offset=?,action_type=?,target_priority=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?`).run(...values, id, activeProjectId());
      if (!result.changes) throw appError('Nie znaleziono reguły automatyzacji', 404);
    } else id = insertRecord('automation_rules', { project_id: activeProjectId(), name, trigger_type: trigger, entity_types_json: JSON.stringify(types), days_offset: values[3], action_type: action, target_priority: targetPriority, active: values[6], created_by: currentUser.id });
    return automationRuleRows().find(row => row.id === Number(id));
  }

  function deleteAutomationRule(id) {
    const result = db.prepare('DELETE FROM automation_rules WHERE id=? AND project_id=?').run(id, activeProjectId());
    if (!result.changes) throw appError('Nie znaleziono reguły automatyzacji', 404);
  }

  function runAutomationRules(currentUser = null) {
    const actor = currentUser || { id: null, display_name: 'Automatyzacja systemowa', role: 'system_admin' };
    const collections = operationCollections(actor);
    const todayValue = new Date().toISOString().slice(0, 10);
    let executed = 0;
    for (const rule of automationRuleRows().filter(item => item.active)) {
      for (const type of rule.entity_types) for (const row of collections[type] || []) {
        const signal = triageSignals(type, row, rule.days_offset);
        if (!signal.includes(rule.trigger_type)) continue;
        const dateKey = rule.trigger_type === 'reminder_due' ? row.reminder_date : ['overdue', 'due_soon'].includes(rule.trigger_type) ? row.due_date : row.status || 'state';
        const hitKey = `${rule.trigger_type}:${dateKey || todayValue}`;
        const hit = db.prepare('INSERT OR IGNORE INTO automation_rule_hits(rule_id,entity_type,entity_id,hit_key) VALUES(?,?,?,?)').run(rule.id, type, row.id, hitKey);
        if (!hit.changes) continue;
        const title = `${rule.name}: ${operationTitle(type, row)}`;
        if (rule.action_type === 'notify_assignees') {
          const recipients = ownerIdsForEntity(type, row); if (!recipients.length && row.created_by) recipients.push(row.created_by);
          [...new Set(recipients)].forEach(userId => createNotification(userId, 'automation', type, row.id, title, `Reguła projektu wykryła: ${rule.trigger_type}.`));
        } else if (rule.action_type === 'notify_managers') {
          const recipients = all(`SELECT user_id FROM project_memberships WHERE project_id=? AND active=1 AND role IN ('moderator','project_admin')`, activeProjectId());
          recipients.forEach(recipient => createNotification(recipient.user_id, 'automation', type, row.id, title, `Reguła projektu wykryła: ${rule.trigger_type}.`));
        } else if (rule.action_type === 'escalate_priority') {
          const before = baseSnapshot(type, row.id); const table = TABLES[type]; const field = type === 'status' ? 'criticality' : 'priority';
          db.prepare(`UPDATE ${table} SET ${field}=?,updated_at=strftime('%Y-%m-%d %H:%M:%f','now') WHERE id=? AND project_id=?`).run(rule.target_priority, row.id, activeProjectId());
          writeAudit(type, row.id, 'update', actor, before, baseSnapshot(type, row.id));
        }
        executed += 1;
      }
      db.prepare('UPDATE automation_rules SET last_run_at=CURRENT_TIMESTAMP WHERE id=?').run(rule.id);
    }
    return { executed };
  }

  function commissioningTemplateRows() {
    return all(`SELECT ct.*,u.display_name created_by_name FROM commissioning_templates ct
      LEFT JOIN users u ON u.id=ct.created_by WHERE ct.project_id=? ORDER BY ct.active DESC,ct.name`, activeProjectId()).map(row => {
      const template = parseJson(row.template_json, { elements: [], group_subcategories: [], checks: [] });
      return {
        ...row,
        template,
        element_count: Array.isArray(template.elements) ? template.elements.length : 0,
        group_subcategory_count: Array.isArray(template.group_subcategories) ? template.group_subcategories.length : 0,
        check_count: Array.isArray(template.checks) ? template.checks.length : 0
      };
    });
  }

  function captureCommissioningTemplate(functionGroupId) {
    const group = functionGroup(functionGroupId);
    const elements = all('SELECT id,name,description FROM function_group_elements WHERE function_group_id=? AND active=1 ORDER BY sort_order,name', group.id);
    const elementNames = new Map(elements.map(item => [item.id, item.name]));
    const groupSubcategories = all('SELECT id,name,description FROM function_group_subcategories WHERE function_group_id=? AND active=1 ORDER BY sort_order,name', group.id);
    const groupSubcategoryNames = new Map(groupSubcategories.map(item => [item.id, item.name]));
    const checks = all('SELECT * FROM function_group_checks WHERE function_group_id=? AND active=1 ORDER BY sort_order,title', group.id).map(check => ({
      title: check.title,
      category: check.category,
      criticality: check.criticality,
      element_name: elementNames.get(Number(check.element_id)) || '',
      group_subcategory_name: groupSubcategoryNames.get(Number(check.group_subcategory_id)) || '',
      subcategory_names: all(`SELECT s.name FROM function_group_check_subcategories fgcs
        JOIN subcategories s ON s.id=fgcs.subcategory_id WHERE fgcs.check_id=? ORDER BY s.sort_order,s.name`, check.id).map(item => item.name)
    }));
    return {
      source: { function_group_id: group.id, controller: group.controller, name: group.name },
      elements: elements.map(({ name, description }) => ({ name, description })),
      group_subcategories: groupSubcategories.map(({ name, description }) => ({ name, description })),
      checks
    };
  }

  function saveCommissioningTemplate(id, input, currentUser) {
    const name = clean(input.name);
    const description = clean(input.description);
    if (!name) throw appError('Nazwa szablonu jest wymagana');
    const existing = id ? one('SELECT * FROM commissioning_templates WHERE id=? AND project_id=?', asId(id), activeProjectId()) : null;
    if (id && !existing) throw appError('Nie znaleziono szablonu uruchomieniowego', 404);
    let template;
    if (asId(input.source_function_group_id)) template = captureCommissioningTemplate(input.source_function_group_id);
    else if (existing) template = parseJson(existing.template_json, null);
    if (!template) throw appError('Wybierz grupę funkcyjną, z której ma powstać szablon');
    if (!Array.isArray(template.checks) || !template.checks.length) throw appError('Grupa źródłowa nie zawiera punktów statusu');
    const active = Number(input.active ?? existing?.active ?? 1) ? 1 : 0;
    if (existing) {
      const result = db.prepare(`UPDATE commissioning_templates SET name=?,description=?,template_json=?,active=?,updated_at=CURRENT_TIMESTAMP
        WHERE id=? AND project_id=?`).run(name, description, JSON.stringify(template), active, existing.id, activeProjectId());
      if (!result.changes) throw appError('Nie udało się zaktualizować szablonu');
    } else {
      id = insertRecord('commissioning_templates', { project_id: activeProjectId(), name, description, template_json: JSON.stringify(template), active, created_by: currentUser.id });
    }
    return commissioningTemplateRows().find(item => item.id === Number(id));
  }

  function deleteCommissioningTemplate(id) {
    const result = db.prepare('DELETE FROM commissioning_templates WHERE id=? AND project_id=?').run(asId(id), activeProjectId());
    if (!result.changes) throw appError('Nie znaleziono szablonu uruchomieniowego', 404);
  }

  function applyCommissioningTemplate(id, input, currentUser) {
    const stored = one('SELECT * FROM commissioning_templates WHERE id=? AND project_id=? AND active=1', asId(id), activeProjectId());
    if (!stored) throw appError('Nie znaleziono aktywnego szablonu uruchomieniowego', 404);
    const template = parseJson(stored.template_json, null);
    if (!template || !Array.isArray(template.checks)) throw appError('Szablon ma nieprawidłową strukturę');
    const targetController = controller(input.controller);
    const groupName = clean(input.group_name);
    if (!groupName) throw appError('Nazwa nowej grupy funkcyjnej jest wymagana');
    if (one('SELECT 1 FROM function_groups WHERE controller_id=? AND name=? COLLATE NOCASE', targetController.id, groupName)) throw appError('Taka grupa funkcyjna już istnieje dla wybranego sterownika');
    let groupId;
    let createdStatuses = 0;
    db.exec('BEGIN IMMEDIATE');
    try {
      const nextGroupOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM function_groups WHERE controller_id=?', targetController.id).value;
      groupId = insertRecord('function_groups', { project_id: activeProjectId(), controller_id: targetController.id, name: groupName, sort_order: nextGroupOrder, active: 1 });
      const elementIds = new Map();
      (template.elements || []).forEach((item, index) => {
        const itemName = clean(item.name); if (!itemName) return;
        const elementId = insertRecord('function_group_elements', { function_group_id: groupId, name: itemName, description: clean(item.description), sort_order: index, active: 1 });
        elementIds.set(itemName.toLocaleLowerCase('pl'), elementId);
      });
      const groupSubcategoryIds = new Map();
      (template.group_subcategories || []).forEach((item, index) => {
        const itemName = clean(item.name); if (!itemName) return;
        const subcategoryId = insertRecord('function_group_subcategories', { function_group_id: groupId, name: itemName, description: clean(item.description), sort_order: index, active: 1 });
        groupSubcategoryIds.set(itemName.toLocaleLowerCase('pl'), subcategoryId);
      });
      for (const [index, source] of template.checks.entries()) {
        const title = clean(source.title); const categoryName = clean(source.category);
        const category = one('SELECT * FROM categories WHERE project_id=? AND name=? COLLATE NOCASE AND active=1', activeProjectId(), categoryName);
        if (!title || !category) throw appError(`Punkt ${index + 1} szablonu ma nieprawidłową nazwę lub kategorię`);
        const elementId = elementIds.get(clean(source.element_name).toLocaleLowerCase('pl')) || null;
        const groupSubcategoryId = groupSubcategoryIds.get(clean(source.group_subcategory_name).toLocaleLowerCase('pl')) || null;
        const requestedNames = [...new Set((Array.isArray(source.subcategory_names) ? source.subcategory_names : []).map(clean).filter(Boolean))];
        const selectedSubcategories = requestedNames.map(subcategoryName => {
          const subcategory = one('SELECT * FROM subcategories WHERE category_id=? AND name=? COLLATE NOCASE AND active=1', category.id, subcategoryName);
          if (!subcategory) throw appError(`W projekcie brakuje podkategorii „${subcategoryName}” dla kategorii „${categoryName}”`);
          return subcategory;
        });
        const checkId = insertRecord('function_group_checks', {
          function_group_id: groupId, element_id: elementId, group_subcategory_id: groupSubcategoryId,
          title, category: categoryName, criticality: clean(source.criticality) || 'Medium', sort_order: index, active: 1
        });
        const link = db.prepare('INSERT INTO function_group_check_subcategories(check_id,subcategory_id) VALUES(?,?)');
        selectedSubcategories.forEach(subcategory => link.run(checkId, subcategory.id));
        const statusSubcategories = selectedSubcategories.length ? selectedSubcategories : [{ id: null, name: '', default_function: '' }];
        for (const subcategory of statusSubcategories) {
          const statusId = insertRecord('status_items', {
            project_id: activeProjectId(), controller_id: targetController.id,
            test_id: nextProjectIdentifier('status', 'ST', 'status_items', 'test_id'), station: groupName,
            function_detail: clean(subcategory.default_function) || title, category: categoryName, subcategory: subcategory.name || '',
            milestone: '', criticality: clean(source.criticality) || 'Medium', responsible: '', responsible_user_id: null,
            status: 'Not started', checked_by: '', checked_on: null, environment: 'Factory', current_note: '', evidence_link: '',
            function_group_id: groupId, function_group_element_id: elementId, function_group_subcategory_id: groupSubcategoryId,
            function_group_check_id: checkId, created_by: currentUser.id
          });
          writeAudit('status', statusId, 'create', currentUser, null, baseSnapshot('status', statusId));
          createdStatuses += 1;
        }
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return { function_group_id: groupId, function_group_name: groupName, controller: targetController.code, checks_created: template.checks.length, statuses_created: createdStatuses };
  }

  return {
    close() { db.close(); },
    withProject(projectId, callback) { return projectStorage.run(asId(projectId), callback); },
    activeProjectIds() { return all('SELECT id FROM projects WHERE active=1 ORDER BY sort_order,id').map(row => row.id); },
    authenticate(username) { return one('SELECT * FROM users WHERE username=? COLLATE NOCASE AND active=1', clean(username)); },
    availableProjects(userId) {
      const account = one('SELECT system_role FROM users WHERE id=? AND active=1', userId);
      if (!account) return [];
      if (account.system_role === 'system_admin') return all(`SELECT p.*,COALESCE(pm.role,'project_admin') project_role,1 project_active
        FROM projects p LEFT JOIN project_memberships pm ON pm.project_id=p.id AND pm.user_id=?
        WHERE p.active=1 ORDER BY p.sort_order,p.name`, userId);
      return all(`SELECT p.*,pm.role project_role,pm.active project_active FROM projects p
        JOIN project_memberships pm ON pm.project_id=p.id AND pm.user_id=?
        WHERE p.active=1 AND pm.active=1 ORDER BY p.sort_order,p.name`, userId);
    },
    me(id, selectedProjectId = undefined) {
      const account = one('SELECT id,username,display_name,system_role,theme FROM users WHERE id=? AND active=1', id);
      if (!account) return null;
      const projects = this.availableProjects(id);
      const requestedProjectId = selectedProjectId === undefined ? activeProjectId() : asId(selectedProjectId);
      const selected = projects.find(project => project.id === requestedProjectId) || null;
      return {
        ...account,
        role: account.system_role === 'system_admin' ? 'system_admin' : selected?.project_role || null,
        current_project: selected,
        projects
      };
    },
    setPreference(userId, input) {
      const allowedThemes = ['blue', 'dark', 'graphite', 'contrast', 'classic'];
      const theme = allowedThemes.includes(clean(input.theme)) ? clean(input.theme) : 'blue';
      db.prepare('UPDATE users SET theme=? WHERE id=?').run(theme, userId);
      return { theme };
    },
    changeOwnPassword(userId, input) {
      const user = one('SELECT password_hash FROM users WHERE id=? AND active=1', asId(userId));
      if (!user || !verifyPassword(String(input.current_password || ''), user.password_hash)) throw appError('Bieżące hasło jest nieprawidłowe', 403);
      const password = String(input.new_password || '');
      if (password.length < 8) throw appError('Nowe hasło musi mieć co najmniej 8 znaków');
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password), asId(userId));
      return { changed: true };
    },
    resetUserPassword(userId, input) {
      const password = String(input.new_password || '');
      if (password.length < 8) throw appError('Nowe hasło musi mieć co najmniej 8 znaków');
      const result = db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password), asId(userId));
      if (!result.changes) throw appError('Nie znaleziono użytkownika', 404);
      return { changed: true, user_id: Number(userId) };
    },

    projects() { return all('SELECT * FROM projects ORDER BY sort_order,name'); },
    saveProject(id, input) {
      const values = { code: clean(input.code), name: clean(input.name), description: clean(input.description), active: Number(input.active ?? 1) ? 1 : 0 };
      if (!values.code || !values.name) throw appError('Kod i nazwa projektu są wymagane');
      if (id) {
        db.prepare('UPDATE projects SET code=?,name=?,description=?,active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(values.code, values.name, values.description, values.active, id);
        return one('SELECT * FROM projects WHERE id=?', id);
      }
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM projects').value;
      const projectId = insertRecord('projects', { ...values, sort_order: nextOrder });
      seedConfiguration(db, projectId);
      migrateToV12(db);
      return one('SELECT * FROM projects WHERE id=?', projectId);
    },
    deleteProject(id, input) {
      const project = one('SELECT * FROM projects WHERE id=?', asId(id));
      if (!project) throw appError('Nie znaleziono projektu', 404);
      if (one('SELECT COUNT(*) count FROM projects').count <= 1) throw appError('Nie można usunąć ostatniego projektu w systemie');
      if (clean(input?.project_code) !== project.code || clean(input?.confirmation) !== `USUŃ ${project.code}`) throw appError('Kod projektu lub fraza potwierdzająca są nieprawidłowe');
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('DELETE FROM projects WHERE id=?').run(project.id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw appError(`Nie udało się usunąć projektu: ${error.message}`);
      }
      return { deleted: true, id: project.id, code: project.code };
    },

    users() {
      return all(`SELECT u.id,u.username,u.display_name,u.system_role,u.theme,u.active,u.sort_order,u.created_at,
        pm.role project_role,COALESCE(pm.role,'user') role,COALESCE(pm.active,0) project_active,
        COALESCE(pm.planner_enabled,0) planner_enabled,COALESCE(pm.assignable,1) assignable,COALESCE(pm.summary_area_source,'configuration') summary_area_source
        FROM users u LEFT JOIN project_memberships pm ON pm.user_id=u.id AND pm.project_id=?
        ORDER BY u.sort_order,u.display_name`, activeProjectId()).map(user => ({
          ...user,
          area_ids: all('SELECT controller_group_id FROM project_user_areas WHERE project_id=? AND user_id=? ORDER BY sort_order,controller_group_id', activeProjectId(), user.id).map(row => row.controller_group_id)
        }));
    },
    saveUser(id, input) {
      if (id) {
        const fields = ['username', 'display_name', 'system_role', 'active', 'sort_order'].filter(field => Object.hasOwn(input, field));
        const values = { ...input };
        if (Object.hasOwn(values, 'system_role')) values.role = values.system_role === 'system_admin' ? 'admin' : 'user';
        if (Object.hasOwn(values, 'system_role')) fields.push('role');
        if (clean(input.password)) { values.password_hash = hashPassword(input.password); fields.push('password_hash'); }
        if (fields.length) db.prepare(`UPDATE users SET ${fields.map(field => `${field}=?`).join(',')} WHERE id=?`).run(...fields.map(field => values[field]), id);
        if (['project_role', 'project_active', 'role', 'planner_enabled', 'assignable', 'summary_area_source'].some(field => Object.hasOwn(input, field))) {
          const current = one('SELECT * FROM project_memberships WHERE project_id=? AND user_id=?', activeProjectId(), id) || {};
          const summarySource = clean(input.summary_area_source || current.summary_area_source) === 'planner' ? 'planner' : 'configuration';
          db.prepare(`INSERT INTO project_memberships(project_id,user_id,role,active,planner_enabled,assignable,summary_area_source) VALUES(?,?,?,?,?,?,?)
            ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role,active=excluded.active,planner_enabled=excluded.planner_enabled,assignable=excluded.assignable,summary_area_source=excluded.summary_area_source`).run(
            activeProjectId(), id, clean(input.project_role || input.role || current.role) || 'user', Number(input.project_active ?? current.active ?? 1) ? 1 : 0,
            Number(input.planner_enabled ?? current.planner_enabled ?? 1) ? 1 : 0, Number(input.assignable ?? current.assignable ?? 1) ? 1 : 0, summarySource
          );
        }
        return this.users().find(user => user.id === id);
      }
      if (!clean(input.username) || !clean(input.display_name) || !clean(input.password)) throw appError('Login, imię i hasło są wymagane');
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM users').value;
      const systemRole = clean(input.system_role) === 'system_admin' ? 'system_admin' : 'user';
      const userId = insertRecord('users', { username: clean(input.username), display_name: clean(input.display_name), password_hash: hashPassword(input.password), role: systemRole === 'system_admin' ? 'admin' : 'user', system_role: systemRole, active: 1, sort_order: nextOrder });
      db.prepare('INSERT INTO project_memberships(project_id,user_id,role,active,planner_enabled,assignable,summary_area_source) VALUES(?,?,?,?,?,?,?)').run(
        activeProjectId(), userId, clean(input.project_role || input.role) || 'user', Number(input.project_active ?? 1) ? 1 : 0,
        Number(input.planner_enabled ?? (systemRole === 'system_admin' ? 0 : 1)) ? 1 : 0, Number(input.assignable ?? 1) ? 1 : 0, clean(input.summary_area_source) === 'planner' ? 'planner' : 'configuration'
      );
      return this.users().find(user => user.id === userId);
    },
    deleteUser(id) { db.prepare('DELETE FROM users WHERE id=?').run(id); },
    saveUserAreas(userId, input) {
      const user = one(`SELECT 1 FROM users u JOIN project_memberships pm ON pm.user_id=u.id
        WHERE u.id=? AND pm.project_id=? AND pm.active=1`, asId(userId), activeProjectId());
      if (!user) throw appError('Użytkownik nie jest aktywny w tym projekcie', 404);
      const ids = [...new Set((Array.isArray(input.area_ids) ? input.area_ids : []).map(asId).filter(Boolean))];
      for (const groupId of ids) if (!one('SELECT 1 FROM controller_groups WHERE id=? AND project_id=? AND active=1', groupId, activeProjectId())) throw appError('Wybrany obszar nie należy do projektu');
      if (hasHierarchyOverlap(ids)) throw appError('Nie można przypisać jednocześnie obszaru nadrzędnego i jego podobszaru');
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('DELETE FROM project_user_areas WHERE project_id=? AND user_id=?').run(activeProjectId(), userId);
        const insert = db.prepare('INSERT INTO project_user_areas(project_id,user_id,controller_group_id,sort_order) VALUES(?,?,?,?)');
        ids.forEach((groupId, index) => insert.run(activeProjectId(), userId, groupId, index));
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      return { user_id: Number(userId), area_ids: ids };
    },
    saveSummaryPreference(userId, input) {
      const source = clean(input.summary_area_source) === 'planner' ? 'planner' : 'configuration';
      const result = db.prepare('UPDATE project_memberships SET summary_area_source=? WHERE project_id=? AND user_id=? AND active=1').run(source, activeProjectId(), asId(userId));
      if (!result.changes) throw appError('Użytkownik nie ma dostępu do projektu', 404);
      return { summary_area_source: source };
    },
    setPlannerEnabled(userId, input) {
      const enabled = Number(input.planner_enabled) ? 1 : 0;
      const result = db.prepare('UPDATE project_memberships SET planner_enabled=? WHERE project_id=? AND user_id=? AND active=1').run(enabled, activeProjectId(), asId(userId));
      if (!result.changes) throw appError('Użytkownik nie ma aktywnego dostępu do projektu', 404);
      return { user_id: Number(userId), planner_enabled: enabled };
    },

    controllerGroups() { return hierarchyData().groups; },
    controllers() { return hierarchyData().controllers; },
    saveControllerGroup(id, input) {
      const name = clean(input.name);
      if (!name) throw appError('Nazwa grupy sterowników jest wymagana');
      const parentId = asId(input.parent_id);
      if (parentId && !one('SELECT 1 FROM controller_groups WHERE id=? AND project_id=?', parentId, activeProjectId())) throw appError('Nieprawidłowa grupa nadrzędna');
      const parent = parentId ? one('SELECT * FROM controller_groups WHERE id=? AND project_id=?', parentId, activeProjectId()) : null;
      if (parent?.parent_id) throw appError('Hierarchia ma maksymalnie poziomy: projekt → obszar → podobszar');
      if (id) {
        if (parentId === Number(id)) throw appError('Grupa nie może być własnym rodzicem');
        if (parentId && one('SELECT 1 FROM controller_groups WHERE parent_id=? LIMIT 1', id)) throw appError('Obszar zawierający podobszary nie może zostać przeniesiony na poziom podobszaru');
        if (parentId && one(`WITH RECURSIVE descendants(id) AS (
          SELECT id FROM controller_groups WHERE parent_id=? AND project_id=?
          UNION ALL SELECT cg.id FROM controller_groups cg JOIN descendants d ON cg.parent_id=d.id
        ) SELECT 1 FROM descendants WHERE id=?`, id, activeProjectId(), parentId)) throw appError('Nie można przenieść grupy pod jej własną podgrupę');
        const result = db.prepare('UPDATE controller_groups SET name=?,description=?,parent_id=? WHERE id=? AND project_id=?').run(name, clean(input.description), parentId, id, activeProjectId());
        if (!result.changes) throw appError('Nie znaleziono grupy sterowników', 404);
        refreshControllerCodes();
        return one('SELECT * FROM controller_groups WHERE id=? AND project_id=?', id, activeProjectId());
      }
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM controller_groups WHERE project_id=? AND parent_id IS ?', activeProjectId(), parentId).value;
      const groupId = insertRecord('controller_groups', { project_id: activeProjectId(), parent_id: parentId, name, description: clean(input.description), sort_order: nextOrder, active: 1 });
      return one('SELECT * FROM controller_groups WHERE id=?', groupId);
    },
    deleteControllerGroup(id) { db.prepare('DELETE FROM controller_groups WHERE id=? AND project_id=?').run(id, activeProjectId()); refreshControllerCodes(); },
    saveController(id, input) {
      const leafCode = clean(input.leaf_code || input.code);
      if (!leafCode) throw appError('Nazwa lub kod sterownika jest wymagany');
      const groupId = asId(input.group_id);
      if (groupId && !one('SELECT 1 FROM controller_groups WHERE id=? AND project_id=?', groupId, activeProjectId())) throw appError('Nieprawidłowy obszar sterownika');
      const duplicate = one(`SELECT id FROM controllers WHERE project_id=? AND COALESCE(group_id,0)=COALESCE(?,0)
        AND leaf_code=? COLLATE NOCASE AND id!=COALESCE(?,0)`, activeProjectId(), groupId, leafCode, asId(id));
      if (duplicate) throw appError('W tej samej gałęzi hierarchii istnieje już sterownik o tej nazwie');
      if (id) {
        const result = db.prepare('UPDATE controllers SET leaf_code=?,area=?,description=?,group_id=? WHERE id=? AND project_id=?').run(leafCode, clean(input.area), clean(input.description), groupId, id, activeProjectId());
        if (!result.changes) throw appError('Nie znaleziono sterownika', 404);
        refreshControllerCodes();
        return hierarchyData().controllers.find(item => item.id === Number(id));
      }
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM controllers WHERE project_id=?', activeProjectId()).value;
      const controllerId = insertRecord('controllers', { project_id: activeProjectId(), group_id: groupId, code: `__NEW_${Date.now()}_${nextOrder}`, leaf_code: leafCode, area: clean(input.area) || 'Body Shop', description: clean(input.description), sort_order: nextOrder });
      refreshControllerCodes();
      return hierarchyData().controllers.find(item => item.id === controllerId);
    },
    deleteController(id) { db.prepare('DELETE FROM controllers WHERE id=? AND project_id=?').run(id, activeProjectId()); },

    saveFunctionGroup(id, input, currentUser) {
      const targetController = controller(input.controller);
      const name = clean(input.name);
      if (!name) throw appError('Nazwa grupy funkcyjnej jest wymagana');
      const duplicate = one('SELECT id FROM function_groups WHERE controller_id=? AND name=? COLLATE NOCASE AND id!=?', targetController.id, name, asId(id) || 0);
      if (duplicate) throw appError('Taka grupa funkcyjna już istnieje dla tego sterownika');
      if (!id) {
        const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM function_groups WHERE controller_id=?', targetController.id).value;
        const groupId = insertRecord('function_groups', { project_id: activeProjectId(), controller_id: targetController.id, name, sort_order: nextOrder, active: 1 });
        return functionGroup(groupId);
      }

      const previous = functionGroup(id);
      const linkedStatuses = all('SELECT id FROM status_items WHERE function_group_id=? ORDER BY id', previous.id);
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE function_groups SET controller_id=?,name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(targetController.id, name, previous.id);
        for (const status of linkedStatuses) {
          const before = baseSnapshot('status', status.id);
          db.prepare('UPDATE status_items SET controller_id=?,station=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(targetController.id, name, status.id);
          writeAudit('status', status.id, 'update', currentUser, before, baseSnapshot('status', status.id));
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return functionGroup(previous.id);
    },
    bulkFunctionGroups(input) {
      const targetController = controller(input.controller);
      const rawNames = Array.isArray(input.names) ? input.names : String(input.names || '').split(/\r?\n/);
      const names = [...new Set(rawNames.map(clean).filter(Boolean))].slice(0, 500);
      if (!names.length) throw appError('Wklej co najmniej jedną nazwę grupy');
      const insert = db.prepare('INSERT OR IGNORE INTO function_groups(project_id,controller_id,name,sort_order) VALUES(?,?,?,?)');
      db.exec('BEGIN IMMEDIATE');
      try {
        let nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM function_groups WHERE controller_id=?', targetController.id).value;
        for (const name of names) {
          const result = insert.run(activeProjectId(), targetController.id, name, nextOrder);
          if (result.changes) nextOrder += 1;
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return all(`SELECT fg.*,c.code controller FROM function_groups fg JOIN controllers c ON c.id=fg.controller_id
        WHERE fg.controller_id=? ORDER BY fg.sort_order,fg.name`, targetController.id);
    },
    saveFunctionGroupElement(groupId, id, input) {
      const group = functionGroup(groupId);
      const name = clean(input.name);
      if (!name) throw appError('Nazwa elementu grupy jest wymagana');
      if (id) {
        db.prepare('UPDATE function_group_elements SET name=?,description=? WHERE id=? AND function_group_id=?').run(name, clean(input.description), id, group.id);
        return one('SELECT * FROM function_group_elements WHERE id=?', id);
      }
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM function_group_elements WHERE function_group_id=?', group.id).value;
      const elementId = insertRecord('function_group_elements', { function_group_id: group.id, name, description: clean(input.description), sort_order: nextOrder, active: 1 });
      return one('SELECT * FROM function_group_elements WHERE id=?', elementId);
    },
    bulkFunctionGroupElements(groupId, input) {
      const group = functionGroup(groupId);
      const names = [...new Set(String(input.names || '').split(/\r?\n/).map(clean).filter(Boolean))].slice(0, 500);
      if (!names.length) throw appError('Wklej co najmniej jeden element');
      const insert = db.prepare('INSERT OR IGNORE INTO function_group_elements(function_group_id,name,sort_order) VALUES(?,?,?)');
      let nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM function_group_elements WHERE function_group_id=?', group.id).value;
      for (const name of names) if (insert.run(group.id, name, nextOrder).changes) nextOrder += 1;
      return all('SELECT * FROM function_group_elements WHERE function_group_id=? AND active=1 ORDER BY sort_order,name', group.id);
    },
    deleteFunctionGroupElement(groupId, id) {
      const group = functionGroup(groupId);
      db.prepare('UPDATE status_items SET function_group_element_id=NULL WHERE project_id=? AND function_group_id=? AND function_group_element_id=?').run(activeProjectId(), group.id, id);
      db.prepare('UPDATE tasks SET function_group_element_id=NULL WHERE project_id=? AND function_group_id=? AND function_group_element_id=?').run(activeProjectId(), group.id, id);
      db.prepare('UPDATE function_group_checks SET element_id=NULL WHERE function_group_id=? AND element_id=?').run(group.id, id);
      db.prepare('DELETE FROM function_group_elements WHERE id=? AND function_group_id=?').run(id, group.id);
    },
    saveFunctionGroupSubcategory(groupId, id, input) {
      const group = functionGroup(groupId);
      const name = clean(input.name);
      if (!name) throw appError('Nazwa podkategorii grupy jest wymagana');
      if (id) {
        const result = db.prepare('UPDATE function_group_subcategories SET name=?,description=? WHERE id=? AND function_group_id=?').run(name, clean(input.description), id, group.id);
        if (!result.changes) throw appError('Nie znaleziono podkategorii grupy', 404);
        return one('SELECT * FROM function_group_subcategories WHERE id=?', id);
      }
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM function_group_subcategories WHERE function_group_id=?', group.id).value;
      const subcategoryId = insertRecord('function_group_subcategories', { function_group_id: group.id, name, description: clean(input.description), sort_order: nextOrder, active: 1 });
      return one('SELECT * FROM function_group_subcategories WHERE id=?', subcategoryId);
    },
    bulkFunctionGroupSubcategories(groupId, input) {
      const group = functionGroup(groupId);
      const names = [...new Set(String(input.names || '').split(/\r?\n/).map(clean).filter(Boolean))].slice(0, 500);
      if (!names.length) throw appError('Wklej co najmniej jedną podkategorię');
      const insert = db.prepare('INSERT OR IGNORE INTO function_group_subcategories(function_group_id,name,sort_order) VALUES(?,?,?)');
      let nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM function_group_subcategories WHERE function_group_id=?', group.id).value;
      for (const name of names) if (insert.run(group.id, name, nextOrder).changes) nextOrder += 1;
      return all('SELECT * FROM function_group_subcategories WHERE function_group_id=? AND active=1 ORDER BY sort_order,name', group.id);
    },
    deleteFunctionGroupSubcategory(groupId, id) {
      const group = functionGroup(groupId);
      db.prepare('UPDATE status_items SET function_group_subcategory_id=NULL WHERE project_id=? AND function_group_id=? AND function_group_subcategory_id=?').run(activeProjectId(), group.id, id);
      db.prepare('UPDATE function_group_checks SET group_subcategory_id=NULL WHERE function_group_id=? AND group_subcategory_id=?').run(group.id, id);
      db.prepare('DELETE FROM function_group_subcategories WHERE id=? AND function_group_id=?').run(id, group.id);
    },
    deleteFunctionGroup(id, currentUser) {
      const group = functionGroup(id);
      const statuses = all('SELECT id FROM status_items WHERE function_group_id=? ORDER BY id', group.id);
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const status of statuses) removeWithAudit('status', status.id, currentUser);
        db.prepare('DELETE FROM function_groups WHERE id=?').run(group.id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    saveFunctionGroupChecks(groupId, input, currentUser) {
      const group = functionGroup(groupId);
      const points = Array.isArray(input.points) ? input.points : [];
      const normalized = points.map((point, index) => {
        const title = clean(point.title);
        const category = clean(point.category);
        if (!title || !category) throw appError(`Punkt ${index + 1}: nazwa i kategoria są wymagane`);
        const categoryRow = one('SELECT id FROM categories WHERE project_id=? AND name=? COLLATE NOCASE AND active=1', activeProjectId(), category);
        if (!categoryRow) throw appError(`Punkt ${index + 1}: nieznana kategoria`);
        const subcategoryIds = [...new Set((Array.isArray(point.subcategory_ids) ? point.subcategory_ids : []).map(asId).filter(Boolean))];
        for (const subcategoryId of subcategoryIds) {
          if (!one('SELECT 1 FROM subcategories WHERE id=? AND category_id=? AND active=1', subcategoryId, categoryRow.id)) {
            throw appError(`Punkt ${index + 1}: podkategoria nie należy do wybranej kategorii`);
          }
        }
        const elementId = asId(point.element_id);
        if (elementId && !one('SELECT 1 FROM function_group_elements WHERE id=? AND function_group_id=?', elementId, group.id)) throw appError(`Punkt ${index + 1}: element nie należy do grupy`);
        const groupSubcategoryId = asId(point.group_subcategory_id);
        if (groupSubcategoryId && !one('SELECT 1 FROM function_group_subcategories WHERE id=? AND function_group_id=? AND active=1', groupSubcategoryId, group.id)) throw appError(`Punkt ${index + 1}: podkategoria grupy nie należy do wybranej grupy`);
        return { id: asId(point.id), element_id: elementId, group_subcategory_id: groupSubcategoryId, title, category, criticality: clean(point.criticality) || 'Medium', subcategoryIds, sort_order: index };
      });

      const currentChecks = all('SELECT * FROM function_group_checks WHERE function_group_id=?', group.id);
      const currentById = new Map(currentChecks.map(check => [check.id, check]));
      for (const point of normalized) if (point.id && !currentById.has(point.id)) throw appError('Punkt nie należy do tej grupy funkcyjnej');

      db.exec('BEGIN IMMEDIATE');
      try {
        const keptIds = new Set();
        const requestedIds = new Set(normalized.map(point => point.id).filter(Boolean));
        for (const check of currentChecks) {
          if (requestedIds.has(check.id)) {
            db.prepare('UPDATE function_group_checks SET title=? WHERE id=?').run(`__fg_tmp_${check.id}_${Date.now()}`, check.id);
          } else {
            for (const status of all('SELECT id FROM status_items WHERE function_group_check_id=?', check.id)) removeWithAudit('status', status.id, currentUser);
            db.prepare('DELETE FROM function_group_checks WHERE id=?').run(check.id);
          }
        }
        const linkSubcategory = db.prepare('INSERT INTO function_group_check_subcategories(check_id,subcategory_id) VALUES(?,?)');
        for (const point of normalized) {
          let checkId = point.id;
          if (checkId) {
            db.prepare(`UPDATE function_group_checks SET element_id=?,group_subcategory_id=?,title=?,category=?,criticality=?,sort_order=?,active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
              .run(point.element_id, point.group_subcategory_id, point.title, point.category, point.criticality, point.sort_order, checkId);
          } else {
            checkId = insertRecord('function_group_checks', {
              function_group_id: group.id, element_id: point.element_id, group_subcategory_id: point.group_subcategory_id, title: point.title, category: point.category,
              criticality: point.criticality, sort_order: point.sort_order, active: 1
            });
          }
          keptIds.add(checkId);
          db.prepare('DELETE FROM function_group_check_subcategories WHERE check_id=?').run(checkId);
          point.subcategoryIds.forEach(subcategoryId => linkSubcategory.run(checkId, subcategoryId));

          const desiredSubcategories = point.subcategoryIds.length
            ? point.subcategoryIds.map(subcategoryId => ({ id: subcategoryId, name: one('SELECT name FROM subcategories WHERE id=?', subcategoryId).name }))
            : [{ id: null, name: '' }];
          const existing = all('SELECT * FROM status_items WHERE function_group_check_id=? ORDER BY id', checkId);
          const unused = [...existing];
          for (const desired of desiredSubcategories) {
            let rowIndex = unused.findIndex(row => row.subcategory === desired.name);
            if (rowIndex < 0) rowIndex = 0;
            const status = unused.splice(rowIndex, 1)[0];
            const configuredFunction = desired.id ? clean(one('SELECT default_function FROM subcategories WHERE id=?', desired.id)?.default_function) : '';
            const statusValues = {
              project_id: activeProjectId(), controller_id: group.controller_id, function_group_id: group.id, function_group_element_id: point.element_id,
              function_group_subcategory_id: point.group_subcategory_id, function_group_check_id: checkId,
              station: group.name, function_detail: configuredFunction || point.title, category: point.category,
              subcategory: desired.name, criticality: point.criticality
            };
            if (status) {
              const before = baseSnapshot('status', status.id);
              updateRecord('status_items', status.id, statusValues, Object.keys(statusValues));
              const after = baseSnapshot('status', status.id);
              if (Object.keys(changesBetween(before, after)).length) writeAudit('status', status.id, 'update', currentUser, before, after);
            } else {
              const statusId = insertRecord('status_items', {
                ...statusValues, test_id: nextProjectIdentifier('status', 'ST', 'status_items', 'test_id'), status: 'Not started', environment: 'Factory', created_by: currentUser.id
              });
              writeAudit('status', statusId, 'create', currentUser, null, baseSnapshot('status', statusId));
            }
          }
          for (const obsolete of unused) removeWithAudit('status', obsolete.id, currentUser);
        }

        for (const check of currentChecks) {
          if (keptIds.has(check.id)) continue;
          for (const status of all('SELECT id FROM status_items WHERE function_group_check_id=?', check.id)) removeWithAudit('status', status.id, currentUser);
          db.prepare('DELETE FROM function_group_checks WHERE id=?').run(check.id);
        }
        db.prepare('UPDATE function_groups SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(group.id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return { id: group.id, points: normalized.length };
    },

    config() {
      return {
        categories: all('SELECT * FROM categories WHERE project_id=? AND active=1 ORDER BY sort_order,name', activeProjectId()).map(category => ({ ...category, subcategories: all('SELECT * FROM subcategories WHERE category_id=? AND active=1 ORDER BY sort_order,name', category.id) })),
        task_categories: all('SELECT * FROM task_categories WHERE project_id=? AND active=1 ORDER BY sort_order,name', activeProjectId()).map(category => ({ ...category, subcategories: all('SELECT * FROM task_subcategories WHERE category_id=? AND active=1 ORDER BY sort_order,name', category.id) })),
        function_groups: all(`SELECT fg.*,c.code controller,c.sort_order controller_order,
          (SELECT COUNT(*) FROM function_group_checks fgc WHERE fgc.function_group_id=fg.id AND fgc.active=1) check_count,
          (SELECT COUNT(*) FROM status_items si WHERE si.function_group_id=fg.id) status_count
          FROM function_groups fg JOIN controllers c ON c.id=fg.controller_id
          WHERE fg.project_id=? AND fg.active=1 ORDER BY c.sort_order,fg.sort_order,fg.name`, activeProjectId()).map(group => ({
          ...group,
          elements: all('SELECT * FROM function_group_elements WHERE function_group_id=? AND active=1 ORDER BY sort_order,name', group.id),
          subcategories: all('SELECT * FROM function_group_subcategories WHERE function_group_id=? AND active=1 ORDER BY sort_order,name', group.id),
          checks: all(`SELECT * FROM function_group_checks WHERE function_group_id=? AND active=1 ORDER BY sort_order,title`, group.id).map(check => ({
              ...check,
              subcategory_ids: all('SELECT subcategory_id FROM function_group_check_subcategories WHERE check_id=? ORDER BY subcategory_id', check.id).map(row => row.subcategory_id)
            }))
          })),
        options: all('SELECT * FROM options WHERE project_id=? AND active=1 ORDER BY kind,sort_order,value', activeProjectId()),
        announcement_labels: all('SELECT * FROM announcement_labels WHERE project_id=? AND active=1 ORDER BY sort_order,name', activeProjectId()),
        planner_holidays: all('SELECT * FROM planner_holidays WHERE project_id=? ORDER BY holiday_date', activeProjectId()),
        requirements: all('SELECT * FROM completion_requirements WHERE project_id=? AND active=1 ORDER BY sort_order,name', activeProjectId()),
        settings: Object.fromEntries(all('SELECT * FROM settings WHERE project_id=?', activeProjectId()).map(row => [row.key, row.value])),
        export_templates: all('SELECT * FROM export_templates WHERE project_id=? AND active=1 ORDER BY name', activeProjectId()).map(row => ({ ...row, columns: JSON.parse(row.columns_json || '[]'), filters: JSON.parse(row.filters_json || '{}') }))
      };
    },
    saveCategory(scope, id, input) {
      const table = scope === 'task' ? 'task_categories' : 'categories';
      const itemTable = scope === 'task' ? 'tasks' : null;
      const name = clean(input.name);
      if (!name) throw appError('Nazwa kategorii jest wymagana');
      if (id) {
        const previous = one(`SELECT * FROM ${table} WHERE id=? AND project_id=?`, id, activeProjectId());
        if (!previous) throw appError('Nie znaleziono kategorii', 404);
        db.prepare(`UPDATE ${table} SET name=? WHERE id=?`).run(name, id);
        if (itemTable) db.prepare(`UPDATE ${itemTable} SET category=? WHERE project_id=? AND category=?`).run(name, activeProjectId(), previous.name);
        else {
          for (const target of ['status_items', 'open_points']) db.prepare(`UPDATE ${target} SET category=? WHERE project_id=? AND category=?`).run(name, activeProjectId(), previous.name);
          db.prepare('UPDATE function_group_checks SET category=?,updated_at=CURRENT_TIMESTAMP WHERE category=? AND function_group_id IN (SELECT id FROM function_groups WHERE project_id=?)').run(name, previous.name, activeProjectId());
        }
        return one(`SELECT * FROM ${table} WHERE id=?`, id);
      }
      const nextOrder = one(`SELECT COALESCE(MAX(sort_order),-1)+1 value FROM ${table} WHERE project_id=?`, activeProjectId()).value;
      const categoryId = insertRecord(table, { project_id: activeProjectId(), name, sort_order: nextOrder, active: 1 });
      return one(`SELECT * FROM ${table} WHERE id=?`, categoryId);
    },
    saveSubcategory(scope, id, input) {
      const table = scope === 'task' ? 'task_subcategories' : 'subcategories';
      const categoryTable = scope === 'task' ? 'task_categories' : 'categories';
      const targets = scope === 'task' ? ['tasks'] : ['status_items', 'open_points'];
      const name = clean(input.name);
      const categoryId = asId(input.category_id);
      if (!name) throw appError('Nazwa podkategorii jest wymagana');
      if (!one(`SELECT 1 FROM ${categoryTable} WHERE id=? AND project_id=?`, categoryId, activeProjectId())) throw appError('Nieprawidłowa kategoria', 404);
      if (id) {
        const previous = one(`SELECT s.*,c.name category_name FROM ${table} s JOIN ${categoryTable} c ON c.id=s.category_id WHERE s.id=? AND c.project_id=?`, id, activeProjectId());
        if (!previous) throw appError('Nie znaleziono podkategorii', 404);
        const defaultFunction = scope === 'task' ? undefined : clean(input.default_function);
        if (scope === 'task') db.prepare(`UPDATE ${table} SET name=?,category_id=? WHERE id=?`).run(name, categoryId, id);
        else db.prepare(`UPDATE ${table} SET name=?,category_id=?,default_function=? WHERE id=?`).run(name, categoryId, defaultFunction, id);
        for (const target of targets) db.prepare(`UPDATE ${target} SET subcategory=? WHERE project_id=? AND category=? AND subcategory=?`).run(name, activeProjectId(), previous.category_name, previous.name);
        return one(`SELECT * FROM ${table} WHERE id=?`, id);
      }
      const nextOrder = one(`SELECT COALESCE(MAX(sort_order),-1)+1 value FROM ${table} WHERE category_id=?`, categoryId).value;
      const subcategoryId = insertRecord(table, { category_id: categoryId, name, ...(scope === 'task' ? {} : { default_function: clean(input.default_function) }), sort_order: nextOrder, active: 1 });
      return one(`SELECT * FROM ${table} WHERE id=?`, subcategoryId);
    },
    saveOption(id, input) {
      const value = clean(input.value);
      const kind = clean(input.kind);
      if (id) {
        const previous = one('SELECT * FROM options WHERE id=? AND project_id=?', id, activeProjectId());
        if (!previous) throw appError('Nie znaleziono pozycji słownika', 404);
        db.prepare('UPDATE options SET value=?,kind=? WHERE id=?').run(value, kind, id);
        if (previous.kind === 'waiting_for') db.prepare('UPDATE open_points SET waiting_for=? WHERE project_id=? AND waiting_for=?').run(value, activeProjectId(), previous.value);
        if (previous.kind === 'shift') db.prepare('UPDATE daily_notes SET shift=? WHERE project_id=? AND shift=?').run(value, activeProjectId(), previous.value);
        if (previous.kind === 'note_type') db.prepare('UPDATE daily_notes SET type=? WHERE project_id=? AND type=?').run(value, activeProjectId(), previous.value);
        return one('SELECT * FROM options WHERE id=?', id);
      }
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM options WHERE project_id=? AND kind=?', activeProjectId(), kind).value;
      const optionId = insertRecord('options', { project_id: activeProjectId(), kind, value, sort_order: nextOrder, active: 1 });
      return one('SELECT * FROM options WHERE id=?', optionId);
    },
    saveAnnouncementLabel(id, input) {
      const name = clean(input.name);
      const color = ['blue', 'green', 'amber', 'red', 'violet', 'gray'].includes(clean(input.color)) ? clean(input.color) : 'blue';
      if (!name) throw appError('Nazwa etykiety jest wymagana');
      if (id) {
        const result = db.prepare('UPDATE announcement_labels SET name=?,color=? WHERE id=? AND project_id=?').run(name, color, asId(id), activeProjectId());
        if (!result.changes) throw appError('Nie znaleziono etykiety', 404);
        return one('SELECT * FROM announcement_labels WHERE id=?', asId(id));
      }
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM announcement_labels WHERE project_id=?', activeProjectId()).value;
      const labelId = insertRecord('announcement_labels', { project_id: activeProjectId(), name, color, sort_order: nextOrder, active: 1 });
      return one('SELECT * FROM announcement_labels WHERE id=?', labelId);
    },
    deleteAnnouncementLabel(id) {
      const result = db.prepare('DELETE FROM announcement_labels WHERE id=? AND project_id=?').run(asId(id), activeProjectId());
      if (!result.changes) throw appError('Nie znaleziono etykiety', 404);
    },
    deleteConfig(kind, id) {
      const map = { category: 'categories', subcategory: 'subcategories', task_category: 'task_categories', task_subcategory: 'task_subcategories', option: 'options' };
      const table = map[kind];
      if (!table) throw appError('Nieznany typ konfiguracji');
      const belongs = kind === 'subcategory'
        ? one('SELECT 1 FROM subcategories s JOIN categories c ON c.id=s.category_id WHERE s.id=? AND c.project_id=?', id, activeProjectId())
        : kind === 'task_subcategory'
          ? one('SELECT 1 FROM task_subcategories s JOIN task_categories c ON c.id=s.category_id WHERE s.id=? AND c.project_id=?', id, activeProjectId())
          : one(`SELECT 1 FROM ${table} WHERE id=? AND project_id=?`, id, activeProjectId());
      if (!belongs) throw appError('Nie znaleziono elementu konfiguracji', 404);
      db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
    },
    saveSetting(key, value) {
      db.prepare('INSERT INTO settings(project_id,key,value) VALUES(?,?,?) ON CONFLICT(project_id,key) DO UPDATE SET value=excluded.value').run(activeProjectId(), key, String(value));
    },
    reorder(kind, ids) {
      const map = { controllers: 'controllers', controller_groups: 'controller_groups', users: 'users', categories: 'categories', subcategories: 'subcategories', task_categories: 'task_categories', task_subcategories: 'task_subcategories', options: 'options', announcement_labels: 'announcement_labels', completion_requirements: 'completion_requirements', function_groups: 'function_groups', function_group_elements: 'function_group_elements', function_group_subcategories: 'function_group_subcategories', export_templates: 'export_templates' };
      const table = map[kind];
      if (!table || !Array.isArray(ids)) throw appError('Nieprawidłowa lista kolejności');
      const scopeSql = kind === 'users' ? ''
        : kind === 'subcategories' ? ' AND category_id IN (SELECT id FROM categories WHERE project_id=?)'
          : kind === 'task_subcategories' ? ' AND category_id IN (SELECT id FROM task_categories WHERE project_id=?)'
            : ['function_group_elements', 'function_group_subcategories'].includes(kind) ? ' AND function_group_id IN (SELECT id FROM function_groups WHERE project_id=?)'
              : ' AND project_id=?';
      const update = db.prepare(`UPDATE ${table} SET sort_order=? WHERE id=?${scopeSql}`);
      db.exec('BEGIN IMMEDIATE');
      try { ids.forEach((recordId, index) => scopeSql ? update.run(index, Number(recordId), activeProjectId()) : update.run(index, Number(recordId))); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },

    saveExportTemplate(id, input, currentUser) {
      const name = clean(input.name);
      const detailLevel = ['controller', 'category', 'function_group', 'detailed'].includes(clean(input.detail_level)) ? clean(input.detail_level) : 'detailed';
      if (!name) throw appError('Nazwa szablonu jest wymagana');
      const values = [name, detailLevel, JSON.stringify(Array.isArray(input.columns) ? input.columns : []), JSON.stringify(input.filters && typeof input.filters === 'object' ? input.filters : {}), clean(input.sort_key), clean(input.sort_direction) === 'desc' ? 'desc' : 'asc'];
      if (id) {
        const result = db.prepare(`UPDATE export_templates SET name=?,detail_level=?,columns_json=?,filters_json=?,sort_key=?,sort_direction=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND project_id=?`).run(...values, id, activeProjectId());
        if (!result.changes) throw appError('Nie znaleziono szablonu', 404);
      } else {
        const result = db.prepare(`INSERT INTO export_templates(project_id,name,detail_level,columns_json,filters_json,sort_key,sort_direction,created_by) VALUES(?,?,?,?,?,?,?,?)`).run(activeProjectId(), ...values, currentUser?.id || null);
        id = Number(result.lastInsertRowid);
      }
      const row = one('SELECT * FROM export_templates WHERE id=? AND project_id=?', id, activeProjectId());
      return { ...row, columns: JSON.parse(row.columns_json || '[]'), filters: JSON.parse(row.filters_json || '{}') };
    },
    deleteExportTemplate(id) { db.prepare('DELETE FROM export_templates WHERE id=? AND project_id=?').run(id, activeProjectId()); },
    projectBackup,
    restoreProjectBackup,
    planner(from, to, currentUser) { return plannerData(from, to, currentUser); },
    savePlannerDay(input, currentUser) { return savePlannerDay(input, currentUser); },
    movePlannerEntry(input, currentUser) { return movePlannerEntry(input, currentUser); },
    setPlannerRequirements(input, currentUser) { return setPlannerRequirements(input, currentUser); },
    setPlannerRequirementsBatch(input, currentUser) { return setPlannerRequirementsBatch(input, currentUser); },
    savePlannerHoliday(id, input, currentUser) { return savePlannerHoliday(id, input, currentUser); },
    savePlannerHolidaysBulk(input, currentUser) { return savePlannerHolidaysBulk(input, currentUser); },
    deletePlannerHoliday(id) { return deletePlannerHoliday(id); },
    assignPlannerWork(input, currentUser) { return assignPlannerWork(input, currentUser); },
    calendar(input, currentUser) { return calendarData(input || {}, currentUser); },
    saveCalendarItems(input, currentUser) { return saveCalendarItems(input, currentUser); },
    saveCalendarAnnotation(id, input, currentUser) { return saveCalendarAnnotation(id, input, currentUser); },
    deleteCalendarAnnotation(id) { return deleteCalendarAnnotation(id); },
    announcements(currentUser) { return announcementRows(currentUser); },
    saveAnnouncement(id, input, currentUser) { return saveAnnouncement(id, input, currentUser); },
    deleteAnnouncement(id) { return deleteAnnouncement(id); },
    acknowledgeAnnouncement(id, currentUser) { return acknowledgeAnnouncement(id, currentUser); },
    notifications(currentUser, limit) { return notificationsData(currentUser, limit); },
    markNotificationRead(id, currentUser) { return markNotificationRead(id, currentUser); },
    addComment(input, currentUser) { return addComment(input, currentUser); },
    saveCompletionRequirement(id, input) { return saveCompletionRequirement(id, input); },
    deleteCompletionRequirement(id) { return deleteCompletionRequirement(id); },
    history(input) { return historyData(input); },
    dailySummary(from, to, currentUser) { return dailySummaryData(from, to, currentUser); },
    savedViews(currentUser) { return savedViewRows(currentUser); },
    saveSavedView(id, input, currentUser) { return saveSavedView(id, input, currentUser); },
    deleteSavedView(id, currentUser) { return deleteSavedView(id, currentUser); },
    operations(currentUser) { return operationsData(currentUser); },
    triageBatch(input, currentUser) { return triageBatch(input, currentUser); },
    handovers(currentUser) { return handoverRows(currentUser); },
    saveHandover(id, input, currentUser) { return saveHandover(id, input, currentUser); },
    acceptHandover(id, currentUser) { return acceptHandover(id, currentUser); },
    deleteHandover(id, currentUser) { return deleteHandover(id, currentUser); },
    automationRules() { return automationRuleRows(); },
    saveAutomationRule(id, input, currentUser) { return saveAutomationRule(id, input, currentUser); },
    deleteAutomationRule(id) { return deleteAutomationRule(id); },
    runAutomations(currentUser) { return runAutomationRules(currentUser); },
    commissioningTemplates() { return commissioningTemplateRows(); },
    saveCommissioningTemplate(id, input, currentUser) { return saveCommissioningTemplate(id, input, currentUser); },
    applyCommissioningTemplate(id, input, currentUser) { return applyCommissioningTemplate(id, input, currentUser); },
    deleteCommissioningTemplate(id) { return deleteCommissioningTemplate(id); },

    dashboard(code) {
      return dashboardForControllers(controllersForScope(code).map(item => item.id)).status;
    },
    overview(code) {
      const hierarchy = hierarchyData();
      const selectedIds = new Set(controllersForScope(code).map(item => item.id));
      const controllers = hierarchy.controllers.filter(item => selectedIds.has(item.id)).map(item => ({ ...item, metrics: dashboardForController(item.id), trends: overviewTrends([item.id]) }));
      const ids = controllers.map(item => item.id);
      const hierarchy_trends = [
        ...hierarchy.groups.map(group => {
          const groupIds = hierarchy.controllers.filter(controller => selectedIds.has(controller.id) && groupDescendantIds(group.id).includes(Number(controller.group_id))).map(controller => controller.id);
          return groupIds.length ? { scope: `group:${group.id}`, id: group.id, type: 'group', parent_scope: group.parent_id ? `group:${group.parent_id}` : 'all', label: group.name, path_label: group.path_label, depth: group.depth, metrics: dashboardForControllers(groupIds), trends: overviewTrends(groupIds) } : null;
        }).filter(Boolean),
        ...controllers.map(controller => ({ scope: controller.code, id: controller.id, type: 'controller', parent_scope: controller.group_id ? `group:${controller.group_id}` : 'all', label: controller.display_name, path_label: controller.hierarchy_label, depth: (controller.group_depth || 0) + 1, metrics: controller.metrics, trends: controller.trends }))
      ];
      const status_breakdown = ids.length ? all(`SELECT controller_id,category,subcategory,COUNT(*) total,SUM(status='Done') done
        FROM status_items WHERE project_id=? AND controller_id IN (${ids.map(() => '?').join(',')})
        GROUP BY controller_id,category,subcategory`, activeProjectId(), ...ids).map(row => {
          const controllerItem = hierarchy.controllers.find(item => item.id === Number(row.controller_id));
          return { ...row, total: Number(row.total || 0), done: Number(row.done || 0), progress: row.total ? Math.round(Number(row.done || 0) * 100 / Number(row.total)) : 0, controller_label: controllerItem?.display_name || '', controller_path: controllerItem?.hierarchy_label || '' };
        }) : [];
      return {
        scope: clean(code) || 'all',
        overall: dashboardForControllers(ids),
        controllers,
        trends: overviewTrends(ids),
        hierarchy_trends,
        status_breakdown
      };
    },

    status(code, currentUser) { return statusRows(code, currentUser); },
    saveStatus(id, input, currentUser) {
      const before = id ? baseSnapshot('status', id) : null;
      if (id && !before) throw appError('Nie znaleziono punktu statusu', 404);
      assertFresh('status', id, input.updated_at);
      const requestedOwners = Array.isArray(input.responsible_user_ids) ? input.responsible_user_ids
        : asId(input.responsible_user_id) ? [asId(input.responsible_user_id)] : before?.responsible_user_ids || [];
      const ownerIds = [...new Set(requestedOwners.map(asId).filter(Boolean))];
      const ownerId = ownerIds[0] || null;
      const selectedGroup = asId(input.function_group_id) ? functionGroup(input.function_group_id) : null;
      const selectedController = selectedGroup || controller(input.controller);
      const elementId = asId(input.function_group_element_id);
      if (elementId && (!selectedGroup || !one('SELECT 1 FROM function_group_elements WHERE id=? AND function_group_id=?', elementId, selectedGroup.id))) throw appError('Wybrany element nie należy do grupy funkcyjnej');
      const groupSubcategoryId = asId(input.function_group_subcategory_id);
      if (groupSubcategoryId && (!selectedGroup || !one('SELECT 1 FROM function_group_subcategories WHERE id=? AND function_group_id=?', groupSubcategoryId, selectedGroup.id))) throw appError('Wybrana podkategoria nie należy do grupy funkcyjnej');
      const defaultFunction = clean(input.subcategory) ? one(`SELECT s.default_function FROM subcategories s JOIN categories c ON c.id=s.category_id
        WHERE c.project_id=? AND c.name=? COLLATE NOCASE AND s.name=? COLLATE NOCASE`, activeProjectId(), clean(input.category), clean(input.subcategory))?.default_function : '';
      const values = {
        project_id: activeProjectId(),
        controller_id: selectedGroup ? selectedGroup.controller_id : selectedController.id,
        function_group_id: selectedGroup?.id || null,
        function_group_element_id: elementId,
        function_group_subcategory_id: groupSubcategoryId,
        station: selectedGroup?.name || clean(input.station), function_detail: defaultFunction || clean(input.function_detail) || `Sprawdź ${clean(input.subcategory) || clean(input.category) || 'punkt'}`,
        category: clean(input.category) || 'General', subcategory: clean(input.subcategory), milestone: '',
        criticality: clean(input.criticality) || 'Medium', responsible_user_id: ownerId, responsible: userName(ownerId),
        status: clean(input.status) || 'Not started', checked_by: clean(input.checked_by), checked_on: nullableDate(input.checked_on),
        current_note: clean(input.current_note), evidence_link: clean(input.evidence_link)
      };
      if (!values.function_detail) throw appError('Pole „Test / funkcja” jest wymagane');
      if (id) values.test_id = before.test_id;
      if (id && before.function_group_id !== values.function_group_id) values.function_group_check_id = null;
      ensureDuplicateChanged('status', input.duplicate_source_id, { ...values, responsible_user_ids: ownerIds, requirement_ids: input.requirement_ids || [], links: input.links || [] });
      let recordId = id;
      if (id) updateRecord('status_items', id, values, Object.keys(values));
      else {
        values.test_id = nextProjectIdentifier('status', 'ST', 'status_items', 'test_id');
        recordId = insertRecord('status_items', { ...values, created_by: currentUser.id });
      }
      const savedOwners = saveStatusAssignees(recordId, ownerIds);
      const primaryOwner = savedOwners[0] || null;
      db.prepare('UPDATE status_items SET responsible_user_id=?,responsible=? WHERE id=? AND project_id=?').run(primaryOwner, userName(primaryOwner), recordId, activeProjectId());
      setMentions('status', recordId, []);
      setEntityRequirements('status', recordId, input.requirement_ids);
      if (Array.isArray(input.links)) setEntityLinks('status', recordId, input.links, currentUser);
      const after = baseSnapshot('status', recordId);
      writeAudit('status', recordId, id ? 'update' : 'create', currentUser, before, after);
      return decorateStatus(attachControllerMeta({ ...after, controller: one('SELECT code FROM controllers WHERE id=?', after.controller_id).code, created_by_name: userName(after.created_by), responsible_name: userName(after.responsible_user_id) }), currentUser);
    },
    batchUpdateStatus(input, currentUser) {
      const items = Array.isArray(input.items) ? input.items : [];
      if (!items.length) throw appError('Brak punktów do zapisania');
      if (items.length > 1000) throw appError('Jednorazowo można zapisać maksymalnie 1000 punktów');
      db.exec('BEGIN IMMEDIATE');
      try {
        const saved = items.map(item => {
          const recordId = asId(item.id);
          if (!recordId) throw appError('Każdy punkt musi mieć identyfikator');
          return this.saveStatus(recordId, item, currentUser);
        });
        db.exec('COMMIT');
        return saved;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    bulkCreateStatus(input, currentUser) {
      const names = (Array.isArray(input.names) ? input.names : String(input.names || '').split(/\r?\n/)).map(clean).filter(Boolean).slice(0, 500);
      if (!names.length) throw appError('Wklej co najmniej jeden punkt statusu');
      const common = { ...input }; delete common.names; delete common.id;
      db.exec('BEGIN IMMEDIATE');
      try {
        const saved = names.map(function_detail => this.saveStatus(null, { ...common, function_detail }, currentUser));
        db.exec('COMMIT');
        return { created: saved.length, items: saved };
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    deleteStatus(id, currentUser) { removeWithAudit('status', id, currentUser); },

    tasks(code, currentUser) { return taskRows(code, currentUser); },
    saveTask(id, input, currentUser) {
      const before = id ? baseSnapshot('task', id) : null;
      if (id && !before) throw appError('Nie znaleziono zadania', 404);
      assertFresh('task', id, input.updated_at);
      const checklist = Array.isArray(input.checklist) ? input.checklist : before?.checklist || [];
      const dependencyTaskIds = Array.isArray(input.dependency_task_ids) ? input.dependency_task_ids : before?.dependency_task_ids || [];
      const hierarchyTarget = clean(input.hierarchy_target);
      const scopeGroupId = hierarchyTarget.startsWith('group:') ? asId(hierarchyTarget.slice(6)) : asId(input.controller_group_id ?? before?.controller_group_id);
      let targetController;
      if (scopeGroupId) {
        if (!one('SELECT 1 FROM controller_groups WHERE id=? AND project_id=? AND active=1', scopeGroupId, activeProjectId())) throw appError('Wybrany obszar nie należy do projektu');
        targetController = controllersInGroup(scopeGroupId)[0];
        if (!targetController) throw appError('Wybrany obszar nie zawiera sterowników końcowych');
      } else {
        const controllerCode = hierarchyTarget.replace(/^controller:/, '') || clean(input.controller) || before?.controller_id && one('SELECT code FROM controllers WHERE id=?', before.controller_id)?.code;
        targetController = controller(controllerCode);
      }
      const requestedDirect = Array.isArray(input.direct_assignee_user_ids) ? input.direct_assignee_user_ids
        : Array.isArray(input.assignee_user_ids) ? input.assignee_user_ids
          : asId(input.owner_user_id) ? [asId(input.owner_user_id)] : before?.direct_assignee_user_ids || [];
      const directUserIds = [...new Set(requestedDirect.map(asId).filter(Boolean))];
      const checklistUserIds = checklist.map(item => asId(item.owner_user_id)).filter(Boolean);
      const ownerId = directUserIds[0] || checklistUserIds[0] || null;
      const groupId = scopeGroupId ? null : asId(input.function_group_id);
      const elementId = scopeGroupId ? null : asId(input.function_group_element_id);
      const otherObject = scopeGroupId ? '' : clean(input.other_object);
      if (groupId && otherObject) throw appError('Wybierz grupę funkcyjną albo wpisz pole „Inne”, nie oba');
      if (elementId && !groupId) throw appError('Element wymaga wybranej grupy funkcyjnej');
      if (groupId) {
        const group = functionGroup(groupId);
        if (elementId && !one('SELECT 1 FROM function_group_elements WHERE id=? AND function_group_id=?', elementId, group.id)) throw appError('Element nie należy do wybranej grupy');
      }
      const values = {
        project_id: activeProjectId(), controller_id: targetController.id, controller_group_id: scopeGroupId, title: clean(input.title), description: clean(input.description), station: clean(input.station),
        function_group_id: groupId, function_group_element_id: elementId, other_object: otherObject,
        priority: clean(input.priority) || 'Medium', owner_user_id: ownerId, owner: userName(ownerId), status: clean(input.status) || 'To do',
        start_date: nullableDate(input.start_date), due_date: nullableDate(input.due_date), category: clean(input.category), subcategory: clean(input.subcategory),
        info_link: clean(input.info_link), linked_entity_type: clean(input.linked_entity_type), linked_entity_id: asId(input.linked_entity_id), linked_test_id: null
      };
      if (!values.title) throw appError('Tytuł zadania jest wymagany');
      ensureDuplicateChanged('task', input.duplicate_source_id, { ...values, direct_assignee_user_ids: directUserIds, checklist, scope_checklist: input.scope_checklist || [], dependency_task_ids: dependencyTaskIds, requirement_ids: input.requirement_ids || [], links: input.links || [] });
      let recordId = id;
      if (id) updateRecord('tasks', id, values, Object.keys(values));
      else recordId = insertRecord('tasks', { ...values, created_by: currentUser.id });
      saveChecklist(recordId, checklist);
      saveTaskScopeChecklist(recordId, scopeGroupId, input.scope_checklist);
      const allAssignees = saveTaskAssignees(recordId, directUserIds, checklist);
      const primaryOwner = allAssignees[0] || null;
      db.prepare('UPDATE tasks SET owner_user_id=?,owner=? WHERE id=? AND project_id=?').run(primaryOwner, userName(primaryOwner), recordId, activeProjectId());
      setMentions('task', recordId, []);
      setEntityRequirements('task', recordId, input.requirement_ids);
      if (Array.isArray(input.links)) setEntityLinks('task', recordId, input.links, currentUser);
      setTaskDependencies(recordId, dependencyTaskIds, currentUser);
      const after = baseSnapshot('task', recordId);
      writeAudit('task', recordId, id ? 'update' : 'create', currentUser, before, after);
      const previousAssignees = before ? [...(before.direct_assignee_user_ids || []), ...(before.checklist || []).map(item => item.owner_user_id).filter(Boolean)] : [];
      notifyNewTaskAssignees(recordId, previousAssignees, allAssignees, currentUser);
      const row = one(`SELECT t.*,c.code controller,creator.display_name created_by_name,owner.display_name owner_name FROM tasks t JOIN controllers c ON c.id=t.controller_id LEFT JOIN users creator ON creator.id=t.created_by LEFT JOIN users owner ON owner.id=t.owner_user_id WHERE t.id=?`, recordId);
      return decorateTask(attachControllerMeta(row), currentUser);
    },
    deleteTask(id, currentUser) {
      const task = one('SELECT * FROM tasks WHERE id=?', id);
      if (!task) throw appError('Nie znaleziono zadania', 404);
      if (!canDeleteTask(task, currentUser)) throw appError('Nie możesz usunąć tego zadania', 403);
      removeWithAudit('task', id, currentUser);
    },

    points(code, currentUser) { return pointRows(code, currentUser); },
    savePoint(id, input, currentUser) {
      const before = id ? baseSnapshot('point', id) : null;
      if (id && !before) throw appError('Nie znaleziono otwartego punktu', 404);
      assertFresh('point', id, input.updated_at);
      const ownerId = asId(input.owner_user_id);
      const defaultDays = Number(one("SELECT value FROM settings WHERE project_id=? AND key='default_reminder_days'", activeProjectId())?.value || 14);
      const defaultReminder = new Date();
      defaultReminder.setUTCDate(defaultReminder.getUTCDate() + defaultDays);
      const values = {
        project_id: activeProjectId(), controller_id: controller(input.controller).id, title: clean(input.title), description: clean(input.description),
        impact: clean(input.impact), priority: clean(input.priority) || 'Medium', owner_user_id: ownerId, owner: userName(ownerId),
        status: clean(input.status) || 'Open', waiting_for: clean(input.waiting_for), next_action: clean(input.next_action),
        start_date: nullableDate(input.start_date), due_date: nullableDate(input.due_date), reminder_date: nullableDate(input.reminder_date) || (!id ? defaultReminder.toISOString().slice(0, 10) : before.reminder_date),
        category: clean(input.category), subcategory: clean(input.subcategory), info_link: clean(input.info_link),
        linked_entity_type: clean(input.linked_entity_type), linked_entity_id: asId(input.linked_entity_id), linked_test_id: null
      };
      if (!values.title) throw appError('Temat otwartego punktu jest wymagany');
      if (id) values.issue_id = before.issue_id;
      ensureDuplicateChanged('point', input.duplicate_source_id, { ...values, requirement_ids: input.requirement_ids || [], links: input.links || [] });
      let recordId = id;
      if (id) updateRecord('open_points', id, values, Object.keys(values));
      else {
        values.issue_id = nextProjectIdentifier('point', 'OP', 'open_points', 'issue_id');
        recordId = insertRecord('open_points', { ...values, created_by: currentUser.id });
      }
      setMentions('point', recordId, input.mentioned_user_ids);
      setEntityRequirements('point', recordId, input.requirement_ids);
      if (Array.isArray(input.links)) setEntityLinks('point', recordId, input.links, currentUser);
      const after = baseSnapshot('point', recordId);
      writeAudit('point', recordId, id ? 'update' : 'create', currentUser, before, after);
      const row = one(`SELECT p.*,c.code controller,creator.display_name created_by_name,owner.display_name owner_name FROM open_points p JOIN controllers c ON c.id=p.controller_id LEFT JOIN users creator ON creator.id=p.created_by LEFT JOIN users owner ON owner.id=p.owner_user_id WHERE p.id=?`, recordId);
      return decoratePoint(row, currentUser);
    },
    deletePoint(id, currentUser) { removeWithAudit('point', id, currentUser); },

    notes(code, from, to, currentUser) { return noteRows(code, from, to, currentUser); },
    saveNote(id, input, currentUser) {
      const before = id ? baseSnapshot('note', id) : null;
      if (id && !before) throw appError('Nie znaleziono notatki', 404);
      assertFresh('note', id, input.updated_at);
      const hierarchyTarget = clean(input.hierarchy_target);
      let controllerId = null; let controllerGroupId = null;
      if (hierarchyTarget && hierarchyTarget !== 'all') {
        if (hierarchyTarget.startsWith('group:')) {
          controllerGroupId = asId(hierarchyTarget.slice(6));
          if (!one('SELECT 1 FROM controller_groups WHERE id=? AND project_id=? AND active=1', controllerGroupId, activeProjectId())) throw appError('Wybrany obszar nie należy do projektu');
        } else {
          const selected = controller(hierarchyTarget.replace(/^controller:/, '') || input.controller);
          controllerId = selected.id;
        }
      } else if (!hierarchyTarget && input.controller) controllerId = controller(input.controller).id;
      const values = {
        project_id: activeProjectId(), controller_id: controllerId, controller_group_id: controllerGroupId, note_date: nullableDate(input.note_date) || new Date().toISOString().slice(0, 10),
        shift: clean(input.shift) || 'Dzień', type: clean(input.type) || 'Postęp', content: clean(input.content),
        linked_task_id: null, linked_status_id: null, linked_point_id: null
      };
      let recordId = id;
      if (id) updateRecord('daily_notes', id, values, Object.keys(values));
      else recordId = insertRecord('daily_notes', { ...values, author: currentUser.display_name, created_by: currentUser.id });
      setMentions('note', recordId, input.mentioned_user_ids);
      if (Array.isArray(input.links)) setEntityLinks('note', recordId, input.links, currentUser);
      const after = baseSnapshot('note', recordId);
      writeAudit('note', recordId, id ? 'update' : 'create', currentUser, before, after);
      const row = one(`SELECT n.*,c.code controller,creator.display_name created_by_name FROM daily_notes n LEFT JOIN controllers c ON c.id=n.controller_id LEFT JOIN users creator ON creator.id=n.created_by WHERE n.id=?`, recordId);
      return decorateNote(row, currentUser);
    },
    deleteNote(id, currentUser) {
      const note = one('SELECT * FROM daily_notes WHERE id=?', id);
      if (!note) throw appError('Nie znaleziono notatki', 404);
      if (!(['system_admin', 'project_admin'].includes(currentUser.role) || note.created_by === currentUser.id)) throw appError('Nie możesz usunąć tej notatki', 403);
      removeWithAudit('note', id, currentUser);
    },

    goals(code, currentUser) { return goalRows(code, currentUser); },
    saveGoal(id, input, currentUser) {
      const before = id ? baseSnapshot('goal', id) : null;
      if (id && !before) throw appError('Nie znaleziono celu', 404);
      assertFresh('goal', id, input.updated_at);
      const values = { project_id: activeProjectId(), controller_id: controller(input.controller).id, title: clean(input.title), description: clean(input.description), status: clean(input.status) || 'Open', priority: clean(input.priority) || 'Medium', due_date: nullableDate(input.due_date) };
      if (!values.title) throw appError('Nazwa celu jest wymagana');
      ensureDuplicateChanged('goal', input.duplicate_source_id, { ...values, links: input.links || [] });
      let recordId = id;
      if (id) updateRecord('goals', id, values, Object.keys(values));
      else recordId = insertRecord('goals', { ...values, created_by: currentUser.id });
      if (Array.isArray(input.links)) {
        for (const link of input.links) {
          if (!['status', 'task', 'point'].includes(link.entity_type) || !asId(link.entity_id)) continue;
          if (!one(`SELECT 1 FROM ${TABLES[link.entity_type]} WHERE id=? AND project_id=?`, asId(link.entity_id), activeProjectId())) throw appError('Powiązany element celu nie należy do bieżącego projektu');
        }
        setEntityLinks('goal', recordId, input.links, currentUser);
      }
      const after = baseSnapshot('goal', recordId);
      writeAudit('goal', recordId, id ? 'update' : 'create', currentUser, before, after);
      return goalRows('all', currentUser).find(goal => goal.id === recordId);
    },
    deleteGoal(id, currentUser) { removeWithAudit('goal', id, currentUser); },

    audit(type, id) {
      return all(`SELECT a.*,u.display_name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE a.project_id=? AND a.entity_type=? AND a.entity_id=? ORDER BY a.changed_at DESC,a.id DESC`, activeProjectId(), type, id).map(row => ({ ...row, changes: JSON.parse(row.changes_json || '{}') }));
    },
    mySummary(currentUser) {
      const tasks = taskRows('all', currentUser);
      const points = pointRows('all', currentUser);
      const notes = noteRows('all', null, null, currentUser);
      const statuses = statusRows('all', currentUser);
      const mentioned = (type, id) => mentionIds(type, id).includes(currentUser.id);
      const directTask = row => row.direct_assignee_user_ids.includes(currentUser.id);
      const pendingSubtask = row => row.checklist.some(item => item.owner_user_id === currentUser.id && !item.done);
      const assignedTask = row => directTask(row) || pendingSubtask(row);
      const relatedTasks = tasks.filter(row => assignedTask(row) || row.created_by === currentUser.id);
      const summaryAreaSource = one("SELECT summary_area_source FROM project_memberships WHERE project_id=? AND user_id=?", activeProjectId(), currentUser.id)?.summary_area_source === 'planner' ? 'planner' : 'configuration';
      const today = new Date().toISOString().slice(0, 10);
      const upcomingLimit = new Date(); upcomingLimit.setUTCDate(upcomingLimit.getUTCDate() + 13);
      const upcomingDate = upcomingLimit.toISOString().slice(0, 10);
      const plannerEntries = all(`SELECT pe.* FROM planner_entries pe WHERE pe.project_id=? AND pe.user_id=? AND pe.plan_date BETWEEN ? AND ? ORDER BY pe.plan_date,pe.id`, activeProjectId(), currentUser.id, today, upcomingDate);
      const areaGroups = summaryAreaSource === 'planner'
        ? [...new Set(plannerEntries.map(row => row.controller_group_id).filter(Boolean))]
        : all('SELECT controller_group_id FROM project_user_areas WHERE project_id=? AND user_id=?', activeProjectId(), currentUser.id).map(row => row.controller_group_id);
      const areaControllers = areaGroups.length ? all(`WITH RECURSIVE selected(id) AS (
        SELECT id FROM controller_groups WHERE project_id=? AND id IN (${areaGroups.map(() => '?').join(',')})
        UNION ALL SELECT cg.id FROM controller_groups cg JOIN selected s ON cg.parent_id=s.id
      ) SELECT DISTINCT c.id FROM controllers c WHERE c.project_id=? AND c.group_id IN (SELECT id FROM selected)`, activeProjectId(), ...areaGroups, activeProjectId()).map(row => row.id) : [];
      const areaControllerSet = new Set(areaControllers);
      const taskInAreas = row => row.controller_group_id ? controllersInGroup(row.controller_group_id).some(item => areaControllerSet.has(item.id)) : areaControllerSet.has(row.controller_id);
      const areaUpcomingTasks = tasks.filter(row => { const date = row.start_date || row.due_date; return taskInAreas(row) && row.status !== 'Done' && date && date >= today && date <= upcomingDate; });
      const areaUpcomingPoints = points.filter(row => { const date = row.start_date || row.due_date || row.reminder_date; return areaControllerSet.has(row.controller_id) && row.status !== 'Closed' && date && date >= today && date <= upcomingDate; });
      const areaUpcomingStatuses = statuses.filter(row => areaControllerSet.has(row.controller_id) && row.status !== 'Done');
      const mine = {
        assigned_tasks: tasks.filter(row => assignedTask(row)),
        created_tasks: tasks.filter(row => row.created_by === currentUser.id),
        related_tasks: relatedTasks,
        general_tasks: tasks.filter(row => !row.owner_user_id && row.status !== 'Done'),
        points: points.filter(row => row.owner_user_id === currentUser.id || row.created_by === currentUser.id || mentioned('point', row.id)),
        notes: notes.filter(row => row.created_by === currentUser.id || mentioned('note', row.id)),
        statuses: statuses.filter(row => row.responsible_user_ids.includes(currentUser.id) || row.created_by === currentUser.id),
        status_updates: all(`SELECT a.*,u.display_name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE a.project_id=? AND a.entity_type='status' AND a.user_id=? ORDER BY a.changed_at DESC LIMIT 50`, activeProjectId(), currentUser.id),
        overdue_tasks: tasks.filter(row => assignedTask(row) && row.status !== 'Done' && row.due_date && row.due_date < new Date().toISOString().slice(0, 10)),
        overdue_points: points.filter(row => (row.owner_user_id === currentUser.id || mentioned('point', row.id)) && row.status !== 'Closed' && ((row.due_date && row.due_date < new Date().toISOString().slice(0, 10)) || (row.reminder_date && row.reminder_date < new Date().toISOString().slice(0, 10)))),
        area_source: summaryAreaSource,
        assigned_areas: hierarchyData().groups.filter(group => areaGroups.includes(group.id)),
        area_upcoming: { tasks: areaUpcomingTasks, points: areaUpcomingPoints, statuses: areaUpcomingStatuses },
        planner: plannerEntries.map(entry => { const area = hierarchyData().groups.find(group => group.id === Number(entry.controller_group_id)); return { ...entry, area_name: area?.name || '', area_path: area?.path_label || '' }; })
      };
      mine.metrics = {
        tasks_total: relatedTasks.length,
        tasks_done: relatedTasks.filter(row => row.status === 'Done').length,
        points_total: mine.points.length,
        points_closed: mine.points.filter(row => row.status === 'Closed').length,
        notes_total: mine.notes.length,
        notes_created: mine.notes.filter(row => row.created_by === currentUser.id).length,
        notes_mentions: mine.notes.filter(row => mentioned('note', row.id) && row.created_by !== currentUser.id).length,
        status_total: mine.statuses.length,
        status_done: mine.statuses.filter(row => row.status === 'Done').length,
        status_updates: mine.status_updates.length
      };
      return mine;
    }
  };
}
