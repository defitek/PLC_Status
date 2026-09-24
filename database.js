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
  db.exec('CREATE INDEX IF NOT EXISTS idx_status_function_group ON status_items(function_group_id,function_group_check_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_status_project ON status_items(project_id,controller_id,status)');
  seedConfiguration(db, 1);
  if (String(process.env.SEED_DEMO_DATA || 'true').toLowerCase() !== 'false') {
    seedDemoData(db, hashPassword, process.env.DEMO_DATA_LIMIT || 100, { projectId: 1, variant: 'main' });
    seedControllerHierarchy(db, 1);
    seedSecondProject(db, hashPassword);
  }
  syncProjectMemberships(db);
  backfillV3(db);
  backfillFunctionGroups(db);
  backfillV4Links(db);
  seedMigrationAudit(db);
  db.prepare("INSERT INTO app_meta(key,value) VALUES('schema_version','4.0') ON CONFLICT(key) DO UPDATE SET value='4.0'").run();
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
  db.prepare("INSERT OR IGNORE INTO settings(project_id,key,value) VALUES(?,'default_reminder_days','14')").run(projectId);
  db.prepare("INSERT OR IGNORE INTO settings(project_id,key,value) VALUES(?,'reminder_warning_days','7')").run(projectId);

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

  function controller(code) {
    const normalized = clean(code).replace(/^controller:/, '');
    const value = one('SELECT * FROM controllers WHERE project_id=? AND code=?', activeProjectId(), normalized);
    if (!value) throw appError('Nieznany sterownik');
    return value;
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
    const result = db.prepare(`UPDATE ${table} SET ${fields.map(field => `${field}=?`).join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...parameters, id);
    if (!result.changes) throw appError('Nie znaleziono rekordu', 404);
  }

  function baseSnapshot(type, id) {
    const table = TABLES[type];
    const row = table ? one(`SELECT * FROM ${table} WHERE id=? AND project_id=?`, id, activeProjectId()) : null;
    if (!row) return null;
    if (type === 'task') row.checklist = all('SELECT text,done,sort_order FROM task_checklist WHERE task_id=? ORDER BY sort_order,id', id);
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

  function canDeleteTask(task, user) {
    if (['system_admin', 'project_admin'].includes(user.role)) return true;
    if (!['user', 'moderator'].includes(user.role) || task.created_by !== user.id) return false;
    return !one("SELECT 1 FROM audit_log WHERE project_id=? AND entity_type='task' AND entity_id=? AND action='update' AND user_id IS NOT NULL AND user_id!=? LIMIT 1", activeProjectId(), task.id, user.id);
  }

  function setEntityLinks(sourceType, sourceId, links, currentUser) {
    db.prepare('DELETE FROM entity_links WHERE project_id=? AND source_type=? AND source_id=?').run(activeProjectId(), sourceType, sourceId);
    const insert = db.prepare(`INSERT OR IGNORE INTO entity_links(project_id,source_type,source_id,target_type,target_id,created_by)
      VALUES(?,?,?,?,?,?)`);
    for (const link of Array.isArray(links) ? links : []) {
      if (!['status', 'task', 'point', 'note', 'goal'].includes(link.entity_type) || !asId(link.entity_id)) continue;
      const table = TABLES[link.entity_type];
      if (!table || !one(`SELECT 1 FROM ${table} WHERE id=? AND project_id=?`, asId(link.entity_id), activeProjectId())) continue;
      insert.run(activeProjectId(), sourceType, sourceId, link.entity_type, asId(link.entity_id), currentUser?.id || null);
    }
  }

  function entityLinkRows(type, id) {
    return all(`SELECT source_type,source_id,target_type,target_id FROM entity_links
      WHERE project_id=? AND ((source_type=? AND source_id=?) OR (target_type=? AND target_id=?))
      ORDER BY id`, activeProjectId(), type, id, type, id).map(row => row.source_type === type && row.source_id === id
      ? { entity_type: row.target_type, entity_id: row.target_id }
      : { entity_type: row.source_type, entity_id: row.source_id });
  }

  function linkedItemStatus(link) {
    if (link.entity_type === 'note') return null;
    const table = TABLES[link.entity_type];
    if (!table) return null;
    return one(`SELECT status FROM ${table} WHERE id=? AND project_id=?`, link.entity_id, activeProjectId())?.status || null;
  }

  function decorateStatus(row, currentUser) {
    const links = entityLinkRows('status', row.id).map(link => ({ ...link, status: linkedItemStatus(link) }));
    const actionable = links.filter(link => ['task', 'point'].includes(link.entity_type));
    const completed = actionable.filter(link => ['Done', 'Closed'].includes(link.status)).length;
    return {
      ...row, links, related_work_total: actionable.length, related_work_done: completed,
      related_work_progress: actionable.length ? Math.round(completed * 100 / actionable.length) : 100,
      mentioned_user_ids: mentionIds('status', row.id), can_delete: ['system_admin', 'project_admin'].includes(currentUser.role)
    };
  }

  function decorateTask(row, currentUser) {
    return {
      ...row,
      checklist: all('SELECT * FROM task_checklist WHERE task_id=? ORDER BY sort_order,id', row.id),
      links: entityLinkRows('task', row.id),
      mentioned_user_ids: mentionIds('task', row.id),
      can_delete: canDeleteTask(row, currentUser)
    };
  }

  function decoratePoint(row, currentUser) {
    return { ...row, links: entityLinkRows('point', row.id), mentioned_user_ids: mentionIds('point', row.id), can_delete: ['system_admin', 'project_admin'].includes(currentUser.role) };
  }

  function decorateNote(row, currentUser) {
    return { ...row, links: entityLinkRows('note', row.id), mentioned_user_ids: mentionIds('note', row.id), can_delete: ['system_admin', 'project_admin'].includes(currentUser.role) || row.created_by === currentUser.id };
  }

  function saveChecklist(taskId, checklist) {
    db.prepare('DELETE FROM task_checklist WHERE task_id=?').run(taskId);
    const insert = db.prepare('INSERT INTO task_checklist(task_id,text,done,sort_order) VALUES(?,?,?,?)');
    (Array.isArray(checklist) ? checklist : []).forEach((item, index) => {
      if (clean(item.text)) insert.run(taskId, clean(item.text), item.done ? 1 : 0, index);
    });
  }

  function removeWithAudit(type, id, user) {
    const table = TABLES[type];
    const before = baseSnapshot(type, id);
    if (!before) throw appError('Nie znaleziono rekordu', 404);
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
    db.prepare('DELETE FROM entity_mentions WHERE project_id=? AND entity_type=? AND entity_id=?').run(activeProjectId(), type, id);
    db.prepare('DELETE FROM entity_links WHERE project_id=? AND ((source_type=? AND source_id=?) OR (target_type=? AND target_id=?))').run(activeProjectId(), type, id, type, id);
    if (['status', 'task', 'point'].includes(type)) db.prepare('DELETE FROM goal_links WHERE project_id=? AND entity_type=? AND entity_id=?').run(activeProjectId(), type, id);
    writeAudit(type, id, 'delete', user, before, null);
  }

  function statusRows(code, currentUser) {
    const filter = controllerFilter(code, 's');
    return all(`SELECT s.*,c.code controller,c.sort_order controller_order,
      creator.display_name created_by_name,responsible.display_name responsible_name,
      fg.name function_group_name,COALESCE(fg.sort_order,9999) function_group_order,
      fge.name function_group_element_name,
      COALESCE(fgc.sort_order,9999) function_check_order,
      COALESCE(cat.sort_order,9999) category_order,COALESCE(sub.sort_order,9999) subcategory_order
      FROM status_items s
      JOIN controllers c ON c.id=s.controller_id
      LEFT JOIN users creator ON creator.id=s.created_by
      LEFT JOIN users responsible ON responsible.id=s.responsible_user_id
      LEFT JOIN function_groups fg ON fg.id=s.function_group_id
      LEFT JOIN function_group_elements fge ON fge.id=s.function_group_element_id
      LEFT JOIN function_group_checks fgc ON fgc.id=s.function_group_check_id
      LEFT JOIN categories cat ON cat.project_id=s.project_id AND cat.name=s.category
      LEFT JOIN subcategories sub ON sub.category_id=cat.id AND sub.name=s.subcategory
      ${filter.sql}
      ORDER BY c.sort_order,function_group_order,category_order,function_check_order,subcategory_order,s.id`, ...filter.params).map(row => decorateStatus(row, currentUser));
  }

  function taskRows(code, currentUser) {
    const filter = controllerFilter(code, 't');
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
      ${filter.sql}
      ORDER BY c.sort_order,t.created_at DESC,t.id DESC`, ...filter.params).map(row => decorateTask(row, currentUser));
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
      ORDER BY c.sort_order,p.created_at DESC,p.id DESC`, ...filter.params).map(row => decoratePoint(row, currentUser));
  }

  function noteRows(code, from, to, currentUser) {
    const filter = controllerFilter(code, 'n');
    const params = [...filter.params];
    const conditions = [filter.sql.replace(/^ WHERE /, '')];
    if (from) { conditions.push('n.note_date>=?'); params.push(from); }
    if (to) { conditions.push('n.note_date<=?'); params.push(to); }
    const where = ` WHERE ${conditions.join(' AND ')}`;
    return all(`SELECT n.*,c.code controller,c.sort_order controller_order,creator.display_name created_by_name
      FROM daily_notes n
      LEFT JOIN controllers c ON c.id=n.controller_id
      LEFT JOIN users creator ON creator.id=n.created_by
      ${where}
      ORDER BY n.note_date DESC,n.created_at DESC,n.id DESC`, ...params).map(row => decorateNote(row, currentUser));
  }

  function dashboardForController(controllerId) {
    const status = one(`SELECT COUNT(*) total,
      SUM(CASE WHEN status='Done' THEN 1 ELSE 0 END) done,
      SUM(CASE WHEN status='In progress' THEN 1 ELSE 0 END) in_progress,
      SUM(CASE WHEN status IN ('Blocked','NOK / Rework') THEN 1 ELSE 0 END) blocked
      FROM status_items WHERE controller_id=?`, controllerId);
    const tasks = one(`SELECT COUNT(*) total,
      SUM(CASE WHEN status='To do' THEN 1 ELSE 0 END) todo,
      SUM(CASE WHEN status='In progress' THEN 1 ELSE 0 END) in_progress,
      SUM(CASE WHEN status='Done' THEN 1 ELSE 0 END) done,
      SUM(CASE WHEN status!='Done' AND due_date IS NOT NULL AND due_date<date('now') THEN 1 ELSE 0 END) overdue
      FROM tasks WHERE controller_id=?`, controllerId);
    const points = one(`SELECT COUNT(*) total,
      SUM(CASE WHEN status!='Closed' THEN 1 ELSE 0 END) open,
      SUM(CASE WHEN status='Waiting' THEN 1 ELSE 0 END) waiting,
      SUM(CASE WHEN status='Closed' THEN 1 ELSE 0 END) closed,
      SUM(CASE WHEN status!='Closed' AND reminder_date IS NOT NULL AND reminder_date<date('now') THEN 1 ELSE 0 END) reminders_overdue
      FROM open_points WHERE controller_id=?`, controllerId);
    const normalize = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, Number(value || 0)]));
    const result = { status: normalize(status), tasks: normalize(tasks), points: normalize(points) };
    result.status.progress = result.status.total ? Math.round(result.status.done * 100 / result.status.total) : 0;
    result.tasks.progress = result.tasks.total ? Math.round(result.tasks.done * 100 / result.tasks.total) : 0;
    result.points.progress = result.points.total ? Math.round(result.points.closed * 100 / result.points.total) : 0;
    return result;
  }

  function dashboardForControllers(controllerIds) {
    if (!controllerIds.length) return {
      status: { total: 0, done: 0, in_progress: 0, blocked: 0, progress: 0 },
      tasks: { total: 0, todo: 0, in_progress: 0, done: 0, overdue: 0, progress: 0 },
      points: { total: 0, open: 0, waiting: 0, closed: 0, reminders_overdue: 0, progress: 0 }
    };
    const placeholders = controllerIds.map(() => '?').join(',');
    const status = one(`SELECT COUNT(*) total,SUM(status='Done') done,SUM(status='In progress') in_progress,SUM(status IN ('Blocked','NOK / Rework')) blocked FROM status_items WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds);
    const tasks = one(`SELECT COUNT(*) total,SUM(status='To do') todo,SUM(status='In progress') in_progress,SUM(status='Done') done,SUM(status!='Done' AND due_date IS NOT NULL AND due_date<date('now')) overdue FROM tasks WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds);
    const points = one(`SELECT COUNT(*) total,SUM(status!='Closed') open,SUM(status='Waiting') waiting,SUM(status='Closed') closed,SUM(status!='Closed' AND reminder_date IS NOT NULL AND reminder_date<date('now')) reminders_overdue FROM open_points WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds);
    const normalize = object => Object.fromEntries(Object.entries(object).map(([key, value]) => [key, Number(value || 0)]));
    const result = { status: normalize(status), tasks: normalize(tasks), points: normalize(points) };
    result.status.progress = result.status.total ? Math.round(result.status.done * 100 / result.status.total) : 0;
    result.tasks.progress = result.tasks.total ? Math.round(result.tasks.done * 100 / result.tasks.total) : 0;
    result.points.progress = result.points.total ? Math.round(result.points.closed * 100 / result.points.total) : 0;
    return result;
  }

  function overviewTrends(controllerIds) {
    if (!controllerIds.length) return { day: [], week: [], month: [] };
    const placeholders = controllerIds.map(() => '?').join(',');
    const entityData = {
      status: all(`SELECT id,status,created_at FROM status_items WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds),
      task: all(`SELECT id,status,created_at FROM tasks WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds),
      point: all(`SELECT id,status,created_at FROM open_points WHERE project_id=? AND controller_id IN (${placeholders})`, activeProjectId(), ...controllerIds)
    };
    const idsByType = Object.fromEntries(Object.entries(entityData).map(([type, rows]) => [type, new Set(rows.map(row => row.id))]));
    const audits = all(`SELECT entity_type,entity_id,changed_at,snapshot_json FROM audit_log
      WHERE project_id=? AND entity_type IN ('status','task','point') ORDER BY changed_at,id`, activeProjectId()).filter(row => idsByType[row.entity_type]?.has(row.entity_id));
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
      return eligible.length ? Math.round(done * 100 / eligible.length) : 0;
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
        result.push({ label, status: progressAt('status', end), tasks: progressAt('task', end), points: progressAt('point', end) });
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
    ['options', 'project_id=?'], ['settings', 'project_id=?'], ['function_groups', 'project_id=?'],
    ['function_group_elements', 'function_group_id IN (SELECT id FROM function_groups WHERE project_id=?)'],
    ['function_group_checks', 'function_group_id IN (SELECT id FROM function_groups WHERE project_id=?)'],
    ['function_group_check_subcategories', 'check_id IN (SELECT id FROM function_group_checks WHERE function_group_id IN (SELECT id FROM function_groups WHERE project_id=?))'],
    ['status_items', 'project_id=?'], ['tasks', 'project_id=?'],
    ['task_checklist', 'task_id IN (SELECT id FROM tasks WHERE project_id=?)'],
    ['open_points', 'project_id=?'], ['daily_notes', 'project_id=?'], ['goals', 'project_id=?'],
    ['goal_links', 'project_id=?'], ['entity_mentions', 'project_id=?'], ['entity_links', 'project_id=?'],
    ['audit_log', 'project_id=?'], ['export_templates', 'project_id=?'], ['project_sequences', 'project_id=?']
  ];

  const projectRestoreOrder = [
    'controller_groups', 'controllers', 'categories', 'subcategories', 'task_categories', 'task_subcategories',
    'options', 'settings', 'function_groups', 'function_group_elements', 'function_group_checks',
    'function_group_check_subcategories', 'status_items', 'tasks', 'task_checklist', 'open_points',
    'daily_notes', 'goals', 'goal_links', 'entity_mentions', 'entity_links', 'audit_log',
    'export_templates', 'project_sequences'
  ];

  function projectBackup() {
    const projectId = activeProjectId();
    const project = one('SELECT * FROM projects WHERE id=?', projectId);
    const tables = Object.fromEntries(projectBackupTables.map(([table, condition]) => [table, all(`SELECT * FROM ${table} WHERE ${condition}`, projectId)]));
    return {
      format: 'plc-commissioning-hub-project-backup', version: 4,
      generated_at: new Date().toISOString(), project,
      users: all(`SELECT u.id,u.username,u.display_name,u.system_role,u.theme,u.active,u.sort_order,u.created_at,pm.role project_role,pm.active project_active
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
    if (!payload || payload.format !== 'plc-commissioning-hub-project-backup' || Number(payload.version) !== 4 || !payload.tables) throw appError('Nieprawidłowy lub nieobsługiwany plik backupu');
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
        db.prepare(`INSERT INTO project_memberships(project_id,user_id,role,active,created_at) VALUES(?,?,?,?,?)
          ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role,active=excluded.active`).run(projectId, membership.user_id, membership.role, membership.active, membership.created_at || new Date().toISOString());
      }
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw appError(`Nie udało się odtworzyć backupu: ${error.message}`);
    }
    return { ok: true, project: currentProject, restored_at: new Date().toISOString() };
  }

  return {
    close() { db.close(); },
    withProject(projectId, callback) { return projectStorage.run(asId(projectId), callback); },
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
      return one('SELECT * FROM projects WHERE id=?', projectId);
    },

    users() {
      return all(`SELECT u.id,u.username,u.display_name,u.system_role,u.theme,u.active,u.sort_order,u.created_at,
        pm.role project_role,COALESCE(pm.role,'user') role,COALESCE(pm.active,0) project_active
        FROM users u LEFT JOIN project_memberships pm ON pm.user_id=u.id AND pm.project_id=?
        ORDER BY u.sort_order,u.display_name`, activeProjectId());
    },
    saveUser(id, input) {
      if (id) {
        const fields = ['username', 'display_name', 'system_role', 'active', 'sort_order'].filter(field => Object.hasOwn(input, field));
        const values = { ...input };
        if (Object.hasOwn(values, 'system_role')) values.role = values.system_role === 'system_admin' ? 'admin' : 'user';
        if (Object.hasOwn(values, 'system_role')) fields.push('role');
        if (clean(input.password)) { values.password_hash = hashPassword(input.password); fields.push('password_hash'); }
        if (fields.length) db.prepare(`UPDATE users SET ${fields.map(field => `${field}=?`).join(',')} WHERE id=?`).run(...fields.map(field => values[field]), id);
        if (Object.hasOwn(input, 'project_role') || Object.hasOwn(input, 'project_active') || Object.hasOwn(input, 'role')) {
          db.prepare(`INSERT INTO project_memberships(project_id,user_id,role,active) VALUES(?,?,?,?)
            ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role,active=excluded.active`).run(
            activeProjectId(), id, clean(input.project_role || input.role) || 'user', Number(input.project_active ?? 1) ? 1 : 0
          );
        }
        return this.users().find(user => user.id === id);
      }
      if (!clean(input.username) || !clean(input.display_name) || !clean(input.password)) throw appError('Login, imię i hasło są wymagane');
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM users').value;
      const systemRole = clean(input.system_role) === 'system_admin' ? 'system_admin' : 'user';
      const userId = insertRecord('users', { username: clean(input.username), display_name: clean(input.display_name), password_hash: hashPassword(input.password), role: systemRole === 'system_admin' ? 'admin' : 'user', system_role: systemRole, active: 1, sort_order: nextOrder });
      db.prepare('INSERT INTO project_memberships(project_id,user_id,role,active) VALUES(?,?,?,?)').run(activeProjectId(), userId, clean(input.project_role || input.role) || 'user', Number(input.project_active ?? 1) ? 1 : 0);
      return this.users().find(user => user.id === userId);
    },
    deleteUser(id) { db.prepare('DELETE FROM users WHERE id=?').run(id); },

    controllerGroups() { return all('SELECT * FROM controller_groups WHERE project_id=? AND active=1 ORDER BY parent_id,sort_order,name', activeProjectId()); },
    controllers() { return all(`SELECT c.*,cg.name group_name,cg.parent_id group_parent_id FROM controllers c
      LEFT JOIN controller_groups cg ON cg.id=c.group_id WHERE c.project_id=? ORDER BY c.sort_order,c.code`, activeProjectId()); },
    saveControllerGroup(id, input) {
      const name = clean(input.name);
      if (!name) throw appError('Nazwa grupy sterowników jest wymagana');
      const parentId = asId(input.parent_id);
      if (parentId && !one('SELECT 1 FROM controller_groups WHERE id=? AND project_id=?', parentId, activeProjectId())) throw appError('Nieprawidłowa grupa nadrzędna');
      if (id) {
        if (parentId === Number(id)) throw appError('Grupa nie może być własnym rodzicem');
        if (parentId && one(`WITH RECURSIVE descendants(id) AS (
          SELECT id FROM controller_groups WHERE parent_id=? AND project_id=?
          UNION ALL SELECT cg.id FROM controller_groups cg JOIN descendants d ON cg.parent_id=d.id
        ) SELECT 1 FROM descendants WHERE id=?`, id, activeProjectId(), parentId)) throw appError('Nie można przenieść grupy pod jej własną podgrupę');
        const result = db.prepare('UPDATE controller_groups SET name=?,description=?,parent_id=? WHERE id=? AND project_id=?').run(name, clean(input.description), parentId, id, activeProjectId());
        if (!result.changes) throw appError('Nie znaleziono grupy sterowników', 404);
        return one('SELECT * FROM controller_groups WHERE id=? AND project_id=?', id, activeProjectId());
      }
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM controller_groups WHERE project_id=? AND parent_id IS ?', activeProjectId(), parentId).value;
      const groupId = insertRecord('controller_groups', { project_id: activeProjectId(), parent_id: parentId, name, description: clean(input.description), sort_order: nextOrder, active: 1 });
      return one('SELECT * FROM controller_groups WHERE id=?', groupId);
    },
    deleteControllerGroup(id) { db.prepare('DELETE FROM controller_groups WHERE id=? AND project_id=?').run(id, activeProjectId()); },
    saveController(id, input) {
      if (!clean(input.code)) throw appError('Kod sterownika jest wymagany');
      if (id) {
        const result = db.prepare('UPDATE controllers SET code=?,area=?,description=?,group_id=? WHERE id=? AND project_id=?').run(clean(input.code), clean(input.area), clean(input.description), asId(input.group_id), id, activeProjectId());
        if (!result.changes) throw appError('Nie znaleziono sterownika', 404);
        return one('SELECT * FROM controllers WHERE id=? AND project_id=?', id, activeProjectId());
      }
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM controllers WHERE project_id=?', activeProjectId()).value;
      const controllerId = insertRecord('controllers', { project_id: activeProjectId(), group_id: asId(input.group_id), code: clean(input.code), area: clean(input.area) || 'Body Shop', description: clean(input.description), sort_order: nextOrder });
      return one('SELECT * FROM controllers WHERE id=?', controllerId);
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
      const duplicateKeys = new Set();
      const normalized = points.map((point, index) => {
        const title = clean(point.title);
        const category = clean(point.category);
        if (!title || !category) throw appError(`Punkt ${index + 1}: nazwa i kategoria są wymagane`);
        const categoryRow = one('SELECT id FROM categories WHERE project_id=? AND name=? COLLATE NOCASE AND active=1', activeProjectId(), category);
        if (!categoryRow) throw appError(`Punkt ${index + 1}: nieznana kategoria`);
        const key = `${title.toLocaleLowerCase('pl')}\u0000${category.toLocaleLowerCase('pl')}`;
        if (duplicateKeys.has(key)) throw appError(`Punkt ${index + 1}: powtórzona nazwa w tej samej kategorii`);
        duplicateKeys.add(key);
        const subcategoryIds = [...new Set((Array.isArray(point.subcategory_ids) ? point.subcategory_ids : []).map(asId).filter(Boolean))];
        for (const subcategoryId of subcategoryIds) {
          if (!one('SELECT 1 FROM subcategories WHERE id=? AND category_id=? AND active=1', subcategoryId, categoryRow.id)) {
            throw appError(`Punkt ${index + 1}: podkategoria nie należy do wybranej kategorii`);
          }
        }
        const elementId = asId(point.element_id);
        if (elementId && !one('SELECT 1 FROM function_group_elements WHERE id=? AND function_group_id=?', elementId, group.id)) throw appError(`Punkt ${index + 1}: element nie należy do grupy`);
        return { id: asId(point.id), element_id: elementId, title, category, criticality: clean(point.criticality) || 'Medium', subcategoryIds, sort_order: index };
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
            db.prepare(`UPDATE function_group_checks SET element_id=?,title=?,category=?,criticality=?,sort_order=?,active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
              .run(point.element_id, point.title, point.category, point.criticality, point.sort_order, checkId);
          } else {
            checkId = insertRecord('function_group_checks', {
              function_group_id: group.id, element_id: point.element_id, title: point.title, category: point.category,
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
            const statusValues = {
              project_id: activeProjectId(), controller_id: group.controller_id, function_group_id: group.id, function_group_element_id: point.element_id, function_group_check_id: checkId,
              station: group.name, function_detail: point.title, category: point.category,
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
            checks: all(`SELECT * FROM function_group_checks WHERE function_group_id=? AND active=1 ORDER BY sort_order,title`, group.id).map(check => ({
              ...check,
              subcategory_ids: all('SELECT subcategory_id FROM function_group_check_subcategories WHERE check_id=? ORDER BY subcategory_id', check.id).map(row => row.subcategory_id)
            }))
          })),
        options: all('SELECT * FROM options WHERE project_id=? AND active=1 ORDER BY kind,sort_order,value', activeProjectId()),
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
      const map = { controllers: 'controllers', controller_groups: 'controller_groups', users: 'users', categories: 'categories', subcategories: 'subcategories', task_categories: 'task_categories', task_subcategories: 'task_subcategories', options: 'options', function_groups: 'function_groups', function_group_elements: 'function_group_elements', export_templates: 'export_templates' };
      const table = map[kind];
      if (!table || !Array.isArray(ids)) throw appError('Nieprawidłowa lista kolejności');
      const scopeSql = kind === 'users' ? ''
        : kind === 'subcategories' ? ' AND category_id IN (SELECT id FROM categories WHERE project_id=?)'
          : kind === 'task_subcategories' ? ' AND category_id IN (SELECT id FROM task_categories WHERE project_id=?)'
            : kind === 'function_group_elements' ? ' AND function_group_id IN (SELECT id FROM function_groups WHERE project_id=?)'
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

    dashboard(code) {
      return dashboardForControllers(controllersForScope(code).map(item => item.id)).status;
    },
    overview(code) {
      const controllers = controllersForScope(code).map(item => ({ ...item, metrics: dashboardForController(item.id) }));
      const ids = controllers.map(item => item.id);
      return {
        scope: clean(code) || 'all',
        overall: dashboardForControllers(ids),
        controllers,
        trends: overviewTrends(ids)
      };
    },

    status(code, currentUser) { return statusRows(code, currentUser); },
    saveStatus(id, input, currentUser) {
      const before = id ? baseSnapshot('status', id) : null;
      if (id && !before) throw appError('Nie znaleziono punktu statusu', 404);
      const ownerId = asId(input.responsible_user_id);
      const selectedGroup = asId(input.function_group_id) ? functionGroup(input.function_group_id) : null;
      const selectedController = selectedGroup || controller(input.controller);
      const elementId = asId(input.function_group_element_id);
      if (elementId && (!selectedGroup || !one('SELECT 1 FROM function_group_elements WHERE id=? AND function_group_id=?', elementId, selectedGroup.id))) throw appError('Wybrany element nie należy do grupy funkcyjnej');
      const defaultFunction = clean(input.subcategory) ? one(`SELECT s.default_function FROM subcategories s JOIN categories c ON c.id=s.category_id
        WHERE c.project_id=? AND c.name=? COLLATE NOCASE AND s.name=? COLLATE NOCASE`, activeProjectId(), clean(input.category), clean(input.subcategory))?.default_function : '';
      const values = {
        project_id: activeProjectId(),
        controller_id: selectedGroup ? selectedGroup.controller_id : selectedController.id,
        function_group_id: selectedGroup?.id || null,
        function_group_element_id: elementId,
        station: selectedGroup?.name || clean(input.station), function_detail: clean(input.function_detail) || defaultFunction || `Sprawdź ${clean(input.subcategory) || clean(input.category) || 'punkt'}`,
        category: clean(input.category) || 'General', subcategory: clean(input.subcategory), milestone: clean(input.milestone),
        criticality: clean(input.criticality) || 'Medium', responsible_user_id: ownerId, responsible: userName(ownerId),
        status: clean(input.status) || 'Not started', checked_by: clean(input.checked_by), checked_on: nullableDate(input.checked_on),
        environment: clean(input.environment) || 'Factory', current_note: clean(input.current_note), evidence_link: clean(input.evidence_link)
      };
      if (id) values.test_id = before.test_id;
      if (id && before.function_group_id !== values.function_group_id) values.function_group_check_id = null;
      let recordId = id;
      if (id) updateRecord('status_items', id, values, Object.keys(values));
      else {
        values.test_id = nextProjectIdentifier('status', 'ST', 'status_items', 'test_id');
        recordId = insertRecord('status_items', { ...values, created_by: currentUser.id });
      }
      setMentions('status', recordId, input.mentioned_user_ids);
      if (Array.isArray(input.links)) setEntityLinks('status', recordId, input.links, currentUser);
      const after = baseSnapshot('status', recordId);
      writeAudit('status', recordId, id ? 'update' : 'create', currentUser, before, after);
      return decorateStatus({ ...after, controller: one('SELECT code FROM controllers WHERE id=?', after.controller_id).code, created_by_name: userName(after.created_by), responsible_name: userName(after.responsible_user_id) }, currentUser);
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
    deleteStatus(id, currentUser) { removeWithAudit('status', id, currentUser); },

    tasks(code, currentUser) { return taskRows(code, currentUser); },
    saveTask(id, input, currentUser) {
      const before = id ? baseSnapshot('task', id) : null;
      if (id && !before) throw appError('Nie znaleziono zadania', 404);
      const ownerId = asId(input.owner_user_id);
      const groupId = asId(input.function_group_id);
      const elementId = asId(input.function_group_element_id);
      const otherObject = clean(input.other_object);
      if (groupId && otherObject) throw appError('Wybierz grupę funkcyjną albo wpisz pole „Inne”, nie oba');
      if (elementId && !groupId) throw appError('Element wymaga wybranej grupy funkcyjnej');
      if (groupId) {
        const group = functionGroup(groupId);
        if (elementId && !one('SELECT 1 FROM function_group_elements WHERE id=? AND function_group_id=?', elementId, group.id)) throw appError('Element nie należy do wybranej grupy');
      }
      const values = {
        project_id: activeProjectId(), controller_id: controller(input.controller).id, title: clean(input.title), description: clean(input.description), station: clean(input.station),
        function_group_id: groupId, function_group_element_id: elementId, other_object: otherObject,
        priority: clean(input.priority) || 'Medium', owner_user_id: ownerId, owner: userName(ownerId), status: clean(input.status) || 'To do',
        start_date: nullableDate(input.start_date), due_date: nullableDate(input.due_date), category: clean(input.category), subcategory: clean(input.subcategory),
        info_link: clean(input.info_link), linked_entity_type: clean(input.linked_entity_type), linked_entity_id: asId(input.linked_entity_id), linked_test_id: null
      };
      let recordId = id;
      if (id) updateRecord('tasks', id, values, Object.keys(values));
      else recordId = insertRecord('tasks', { ...values, created_by: currentUser.id });
      if (Array.isArray(input.checklist)) saveChecklist(recordId, input.checklist);
      setMentions('task', recordId, input.mentioned_user_ids);
      if (Array.isArray(input.links)) setEntityLinks('task', recordId, input.links, currentUser);
      const after = baseSnapshot('task', recordId);
      writeAudit('task', recordId, id ? 'update' : 'create', currentUser, before, after);
      const row = one(`SELECT t.*,c.code controller,creator.display_name created_by_name,owner.display_name owner_name FROM tasks t JOIN controllers c ON c.id=t.controller_id LEFT JOIN users creator ON creator.id=t.created_by LEFT JOIN users owner ON owner.id=t.owner_user_id WHERE t.id=?`, recordId);
      return decorateTask(row, currentUser);
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
      if (id) values.issue_id = before.issue_id;
      let recordId = id;
      if (id) updateRecord('open_points', id, values, Object.keys(values));
      else {
        values.issue_id = nextProjectIdentifier('point', 'OP', 'open_points', 'issue_id');
        recordId = insertRecord('open_points', { ...values, created_by: currentUser.id });
      }
      setMentions('point', recordId, input.mentioned_user_ids);
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
      const values = {
        project_id: activeProjectId(), controller_id: controller(input.controller).id, note_date: nullableDate(input.note_date) || new Date().toISOString().slice(0, 10),
        shift: clean(input.shift) || 'Dzień', type: clean(input.type) || 'Postęp', content: clean(input.content),
        linked_task_id: asId(input.linked_task_id), linked_status_id: asId(input.linked_status_id), linked_point_id: asId(input.linked_point_id)
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

    goals(code, currentUser) {
      const filter = controllerFilter(code, 'g');
      return all(`SELECT g.*,c.code controller,creator.display_name created_by_name FROM goals g LEFT JOIN controllers c ON c.id=g.controller_id LEFT JOIN users creator ON creator.id=g.created_by ${filter.sql} ORDER BY g.due_date,g.id DESC`, ...filter.params).map(goal => ({ ...goal, links: all('SELECT * FROM goal_links WHERE project_id=? AND goal_id=? ORDER BY entity_type,entity_id', activeProjectId(), goal.id), can_delete: ['system_admin', 'project_admin'].includes(currentUser.role) }));
    },
    saveGoal(id, input, currentUser) {
      const before = id ? baseSnapshot('goal', id) : null;
      if (id && !before) throw appError('Nie znaleziono celu', 404);
      const values = { project_id: activeProjectId(), controller_id: controller(input.controller).id, title: clean(input.title), description: clean(input.description), status: clean(input.status) || 'Open', due_date: nullableDate(input.due_date) };
      let recordId = id;
      if (id) updateRecord('goals', id, values, Object.keys(values));
      else recordId = insertRecord('goals', { ...values, created_by: currentUser.id });
      if (Array.isArray(input.links)) {
        db.prepare('DELETE FROM goal_links WHERE project_id=? AND goal_id=?').run(activeProjectId(), recordId);
        const insert = db.prepare('INSERT OR IGNORE INTO goal_links(project_id,goal_id,entity_type,entity_id) VALUES(?,?,?,?)');
        for (const link of input.links) if (TABLES[link.entity_type] && asId(link.entity_id)) insert.run(activeProjectId(), recordId, link.entity_type, asId(link.entity_id));
      }
      const after = baseSnapshot('goal', recordId);
      writeAudit('goal', recordId, id ? 'update' : 'create', currentUser, before, after);
      return one('SELECT * FROM goals WHERE id=?', recordId);
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
      const relatedTasks = tasks.filter(row => row.owner_user_id === currentUser.id || row.created_by === currentUser.id || mentioned('task', row.id));
      const mine = {
        assigned_tasks: tasks.filter(row => row.owner_user_id === currentUser.id),
        created_tasks: tasks.filter(row => row.created_by === currentUser.id),
        related_tasks: relatedTasks,
        general_tasks: tasks.filter(row => !row.owner_user_id && row.status !== 'Done'),
        points: points.filter(row => row.owner_user_id === currentUser.id || row.created_by === currentUser.id || mentioned('point', row.id)),
        notes: notes.filter(row => row.created_by === currentUser.id || mentioned('note', row.id)),
        statuses: statuses.filter(row => row.responsible_user_id === currentUser.id || row.created_by === currentUser.id || mentioned('status', row.id)),
        status_updates: all(`SELECT a.*,u.display_name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE a.project_id=? AND a.entity_type='status' AND a.user_id=? ORDER BY a.changed_at DESC LIMIT 50`, activeProjectId(), currentUser.id)
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
