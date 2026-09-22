import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
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
  seedConfiguration(db);
  if (String(process.env.SEED_DEMO_DATA || 'true').toLowerCase() !== 'false') {
    seedDemoData(db, hashPassword, process.env.DEMO_DATA_LIMIT || 100);
  }
  backfillV3(db);
  seedMigrationAudit(db);
  db.prepare("INSERT INTO app_meta(key,value) VALUES('schema_version','3') ON CONFLICT(key) DO UPDATE SET value='3'").run();
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

function seedConfiguration(db) {
  const option = db.prepare('INSERT OR IGNORE INTO options(kind,value,sort_order) VALUES(?,?,?)');
  ['Dzień', 'Noc', 'Ogólne'].forEach((value, index) => option.run('shift', value, index));
  ['Postęp', 'Problem', 'Decyzja', 'Plan'].forEach((value, index) => option.run('note_type', value, index));
  ['PLC', 'Robot', 'Electrical', 'Mechanical', 'Process', 'Production'].forEach((value, index) => option.run('waiting_for', value, index));
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('default_reminder_days','14')").run();
  db.prepare("INSERT OR IGNORE INTO settings(key,value) VALUES('reminder_warning_days','7')").run();

  const statusCategories = ['Hardware', 'Manual mode', 'Automatic mode', 'Startup devices', 'Startup drives', 'Safety', 'NiO', 'Special functions', 'Counters / KPI'];
  const insertStatusCategory = db.prepare('INSERT OR IGNORE INTO categories(name,sort_order) VALUES(?,?)');
  statusCategories.forEach((name, index) => insertStatusCategory.run(name, index));

  const taskCategories = ['Commissioning', 'Programming', 'Testing', 'Documentation', 'Coordination'];
  const insertTaskCategory = db.prepare('INSERT OR IGNORE INTO task_categories(name,sort_order) VALUES(?,?)');
  taskCategories.forEach((name, index) => insertTaskCategory.run(name, index));

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
    const category = db.prepare('SELECT id FROM categories WHERE name=?').get(categoryName);
    names.forEach((name, index) => insertStatusSubcategory.run(category.id, name, index));
  }

  const taskSubcategories = {
    Commissioning: ['Field verification', 'Device startup'],
    Programming: ['PLC changes', 'HMI changes'],
    Testing: ['Interface tests', 'Sequence tests'],
    Documentation: ['As-built', 'Test report'],
    Coordination: ['Supplier action', 'Production alignment']
  };
  const insertTaskSubcategory = db.prepare('INSERT OR IGNORE INTO task_subcategories(category_id,name,sort_order) VALUES(?,?,?)');
  for (const [categoryName, names] of Object.entries(taskSubcategories)) {
    const category = db.prepare('SELECT id FROM task_categories WHERE name=?').get(categoryName);
    names.forEach((name, index) => insertTaskSubcategory.run(category.id, name, index));
  }

  if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
    const username = process.env.APP_USER || 'admin';
    const password = process.env.APP_PASSWORD || 'change-me';
    db.prepare('INSERT INTO users(username,display_name,password_hash,role,sort_order) VALUES(?,?,?,?,0)').run(username, 'Administrator', hashPassword(password), 'admin');
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

function seedMigrationAudit(db) {
  for (const [type, table] of Object.entries(TABLES)) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    const insertAudit = db.prepare('INSERT INTO audit_log(entity_type,entity_id,action,user_id,changes_json,snapshot_json) VALUES(?,?,?,?,?,?)');
    for (const row of rows) {
      const existing = db.prepare('SELECT 1 FROM audit_log WHERE entity_type=? AND entity_id=? LIMIT 1').get(type, row.id);
      if (!existing) insertAudit.run(type, row.id, 'migrate', null, JSON.stringify({ migrated: { from: null, to: 'V3' } }), JSON.stringify(row));
    }
  }
}

function createRepository(db) {
  const one = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);

  function controller(code) {
    const value = one('SELECT * FROM controllers WHERE code=?', clean(code));
    if (!value) throw appError('Nieznany sterownik');
    return value;
  }

  function userName(userId) {
    return userId ? one('SELECT display_name FROM users WHERE id=?', userId)?.display_name || '' : '';
  }

  function controllerFilter(code, alias) {
    if (!code || code === 'all') return { sql: '', params: [] };
    return { sql: ` WHERE ${alias}.controller_id=?`, params: [controller(code).id] };
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
    const row = table ? one(`SELECT * FROM ${table} WHERE id=?`, id) : null;
    if (!row) return null;
    if (type === 'task') row.checklist = all('SELECT text,done,sort_order FROM task_checklist WHERE task_id=? ORDER BY sort_order,id', id);
    row.mentioned_user_ids = all('SELECT user_id FROM entity_mentions WHERE entity_type=? AND entity_id=? ORDER BY user_id', type, id).map(item => item.user_id);
    if (type === 'goal') row.links = all('SELECT entity_type,entity_id FROM goal_links WHERE goal_id=? ORDER BY entity_type,entity_id', id);
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
    db.prepare('INSERT INTO audit_log(entity_type,entity_id,action,user_id,changes_json,snapshot_json) VALUES(?,?,?,?,?,?)').run(
      type, id, action, user?.id || null, JSON.stringify(changesBetween(before, after)), JSON.stringify(after || before || {})
    );
  }

  function setMentions(type, id, userIds) {
    db.prepare('DELETE FROM entity_mentions WHERE entity_type=? AND entity_id=?').run(type, id);
    const insert = db.prepare('INSERT OR IGNORE INTO entity_mentions(entity_type,entity_id,user_id) VALUES(?,?,?)');
    for (const userId of Array.isArray(userIds) ? userIds : []) if (asId(userId)) insert.run(type, id, asId(userId));
  }

  function mentionIds(type, id) {
    return all('SELECT user_id FROM entity_mentions WHERE entity_type=? AND entity_id=? ORDER BY user_id', type, id).map(row => row.user_id);
  }

  function canDeleteTask(task, user) {
    if (user.role === 'admin') return true;
    if (user.role !== 'user' || task.created_by !== user.id) return false;
    return !one("SELECT 1 FROM audit_log WHERE entity_type='task' AND entity_id=? AND action='update' AND user_id IS NOT NULL AND user_id!=? LIMIT 1", task.id, user.id);
  }

  function decorateStatus(row, currentUser) {
    return { ...row, mentioned_user_ids: mentionIds('status', row.id), can_delete: currentUser.role === 'admin' };
  }

  function decorateTask(row, currentUser) {
    return {
      ...row,
      checklist: all('SELECT * FROM task_checklist WHERE task_id=? ORDER BY sort_order,id', row.id),
      mentioned_user_ids: mentionIds('task', row.id),
      can_delete: canDeleteTask(row, currentUser)
    };
  }

  function decoratePoint(row, currentUser) {
    return { ...row, mentioned_user_ids: mentionIds('point', row.id), can_delete: currentUser.role === 'admin' };
  }

  function decorateNote(row, currentUser) {
    return { ...row, mentioned_user_ids: mentionIds('note', row.id), can_delete: currentUser.role === 'admin' || (currentUser.role === 'user' && row.created_by === currentUser.id) };
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
    db.prepare('DELETE FROM entity_mentions WHERE entity_type=? AND entity_id=?').run(type, id);
    writeAudit(type, id, 'delete', user, before, null);
  }

  function statusRows(code, currentUser) {
    const filter = controllerFilter(code, 's');
    return all(`SELECT s.*,c.code controller,c.sort_order controller_order,
      creator.display_name created_by_name,responsible.display_name responsible_name,
      COALESCE(cat.sort_order,9999) category_order,COALESCE(sub.sort_order,9999) subcategory_order
      FROM status_items s
      JOIN controllers c ON c.id=s.controller_id
      LEFT JOIN users creator ON creator.id=s.created_by
      LEFT JOIN users responsible ON responsible.id=s.responsible_user_id
      LEFT JOIN categories cat ON cat.name=s.category
      LEFT JOIN subcategories sub ON sub.category_id=cat.id AND sub.name=s.subcategory
      ${filter.sql}
      ORDER BY c.sort_order,category_order,subcategory_order,s.id`, ...filter.params).map(row => decorateStatus(row, currentUser));
  }

  function taskRows(code, currentUser) {
    const filter = controllerFilter(code, 't');
    return all(`SELECT t.*,c.code controller,c.sort_order controller_order,
      creator.display_name created_by_name,owner.display_name owner_name,
      COALESCE(cat.sort_order,9999) category_order,COALESCE(sub.sort_order,9999) subcategory_order
      FROM tasks t
      JOIN controllers c ON c.id=t.controller_id
      LEFT JOIN users creator ON creator.id=t.created_by
      LEFT JOIN users owner ON owner.id=t.owner_user_id
      LEFT JOIN task_categories cat ON cat.name=t.category
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
      LEFT JOIN categories cat ON cat.name=p.category
      LEFT JOIN subcategories sub ON sub.category_id=cat.id AND sub.name=p.subcategory
      ${filter.sql}
      ORDER BY c.sort_order,p.created_at DESC,p.id DESC`, ...filter.params).map(row => decoratePoint(row, currentUser));
  }

  function noteRows(code, from, to, currentUser) {
    const params = [];
    const conditions = [];
    if (code && code !== 'all') { conditions.push('n.controller_id=?'); params.push(controller(code).id); }
    if (from) { conditions.push('n.note_date>=?'); params.push(from); }
    if (to) { conditions.push('n.note_date<=?'); params.push(to); }
    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
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

  return {
    close() { db.close(); },
    authenticate(username) { return one('SELECT * FROM users WHERE username=? COLLATE NOCASE AND active=1', clean(username)); },
    me(id) { return one('SELECT id,username,display_name,role FROM users WHERE id=? AND active=1', id); },

    users() {
      return all('SELECT id,username,display_name,role,active,sort_order,created_at FROM users ORDER BY sort_order,display_name');
    },
    saveUser(id, input) {
      if (id) {
        const fields = ['username', 'display_name', 'role', 'active', 'sort_order'].filter(field => Object.hasOwn(input, field));
        const values = { ...input };
        if (clean(input.password)) { values.password_hash = hashPassword(input.password); fields.push('password_hash'); }
        if (fields.length) db.prepare(`UPDATE users SET ${fields.map(field => `${field}=?`).join(',')} WHERE id=?`).run(...fields.map(field => values[field]), id);
        return one('SELECT id,username,display_name,role,active,sort_order,created_at FROM users WHERE id=?', id);
      }
      if (!clean(input.username) || !clean(input.display_name) || !clean(input.password)) throw appError('Login, imię i hasło są wymagane');
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM users').value;
      const userId = insertRecord('users', { username: clean(input.username), display_name: clean(input.display_name), password_hash: hashPassword(input.password), role: clean(input.role) || 'user', active: 1, sort_order: nextOrder });
      return one('SELECT id,username,display_name,role,active,sort_order,created_at FROM users WHERE id=?', userId);
    },
    deleteUser(id) { db.prepare('DELETE FROM users WHERE id=?').run(id); },

    controllers() { return all('SELECT * FROM controllers ORDER BY sort_order,code'); },
    saveController(id, input) {
      if (id) {
        db.prepare('UPDATE controllers SET code=?,area=?,description=? WHERE id=?').run(clean(input.code), clean(input.area), clean(input.description), id);
        return one('SELECT * FROM controllers WHERE id=?', id);
      }
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM controllers').value;
      const controllerId = insertRecord('controllers', { code: clean(input.code), area: clean(input.area) || 'Body Shop', description: clean(input.description), sort_order: nextOrder });
      return one('SELECT * FROM controllers WHERE id=?', controllerId);
    },
    deleteController(id) { db.prepare('DELETE FROM controllers WHERE id=?').run(id); },

    config() {
      return {
        categories: all('SELECT * FROM categories WHERE active=1 ORDER BY sort_order,name').map(category => ({ ...category, subcategories: all('SELECT * FROM subcategories WHERE category_id=? AND active=1 ORDER BY sort_order,name', category.id) })),
        task_categories: all('SELECT * FROM task_categories WHERE active=1 ORDER BY sort_order,name').map(category => ({ ...category, subcategories: all('SELECT * FROM task_subcategories WHERE category_id=? AND active=1 ORDER BY sort_order,name', category.id) })),
        options: all('SELECT * FROM options WHERE active=1 ORDER BY kind,sort_order,value'),
        settings: Object.fromEntries(all('SELECT * FROM settings').map(row => [row.key, row.value]))
      };
    },
    saveCategory(scope, id, input) {
      const table = scope === 'task' ? 'task_categories' : 'categories';
      const itemTable = scope === 'task' ? 'tasks' : null;
      const name = clean(input.name);
      if (id) {
        const previous = one(`SELECT * FROM ${table} WHERE id=?`, id);
        db.prepare(`UPDATE ${table} SET name=? WHERE id=?`).run(name, id);
        if (itemTable) db.prepare(`UPDATE ${itemTable} SET category=? WHERE category=?`).run(name, previous.name);
        else for (const target of ['status_items', 'open_points']) db.prepare(`UPDATE ${target} SET category=? WHERE category=?`).run(name, previous.name);
        return one(`SELECT * FROM ${table} WHERE id=?`, id);
      }
      const nextOrder = one(`SELECT COALESCE(MAX(sort_order),-1)+1 value FROM ${table}`).value;
      const categoryId = insertRecord(table, { name, sort_order: nextOrder, active: 1 });
      return one(`SELECT * FROM ${table} WHERE id=?`, categoryId);
    },
    saveSubcategory(scope, id, input) {
      const table = scope === 'task' ? 'task_subcategories' : 'subcategories';
      const categoryTable = scope === 'task' ? 'task_categories' : 'categories';
      const targets = scope === 'task' ? ['tasks'] : ['status_items', 'open_points'];
      const name = clean(input.name);
      const categoryId = asId(input.category_id);
      if (id) {
        const previous = one(`SELECT s.*,c.name category_name FROM ${table} s JOIN ${categoryTable} c ON c.id=s.category_id WHERE s.id=?`, id);
        db.prepare(`UPDATE ${table} SET name=?,category_id=? WHERE id=?`).run(name, categoryId, id);
        for (const target of targets) db.prepare(`UPDATE ${target} SET subcategory=? WHERE category=? AND subcategory=?`).run(name, previous.category_name, previous.name);
        return one(`SELECT * FROM ${table} WHERE id=?`, id);
      }
      const nextOrder = one(`SELECT COALESCE(MAX(sort_order),-1)+1 value FROM ${table} WHERE category_id=?`, categoryId).value;
      const subcategoryId = insertRecord(table, { category_id: categoryId, name, sort_order: nextOrder, active: 1 });
      return one(`SELECT * FROM ${table} WHERE id=?`, subcategoryId);
    },
    saveOption(id, input) {
      const value = clean(input.value);
      const kind = clean(input.kind);
      if (id) {
        const previous = one('SELECT * FROM options WHERE id=?', id);
        db.prepare('UPDATE options SET value=?,kind=? WHERE id=?').run(value, kind, id);
        if (previous.kind === 'waiting_for') db.prepare('UPDATE open_points SET waiting_for=? WHERE waiting_for=?').run(value, previous.value);
        if (previous.kind === 'shift') db.prepare('UPDATE daily_notes SET shift=? WHERE shift=?').run(value, previous.value);
        if (previous.kind === 'note_type') db.prepare('UPDATE daily_notes SET type=? WHERE type=?').run(value, previous.value);
        return one('SELECT * FROM options WHERE id=?', id);
      }
      const nextOrder = one('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM options WHERE kind=?', kind).value;
      const optionId = insertRecord('options', { kind, value, sort_order: nextOrder, active: 1 });
      return one('SELECT * FROM options WHERE id=?', optionId);
    },
    deleteConfig(kind, id) {
      const map = { category: 'categories', subcategory: 'subcategories', task_category: 'task_categories', task_subcategory: 'task_subcategories', option: 'options' };
      const table = map[kind];
      if (!table) throw appError('Nieznany typ konfiguracji');
      db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
    },
    saveSetting(key, value) {
      db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
    },
    reorder(kind, ids) {
      const map = { controllers: 'controllers', users: 'users', categories: 'categories', subcategories: 'subcategories', task_categories: 'task_categories', task_subcategories: 'task_subcategories', options: 'options' };
      const table = map[kind];
      if (!table || !Array.isArray(ids)) throw appError('Nieprawidłowa lista kolejności');
      const update = db.prepare(`UPDATE ${table} SET sort_order=? WHERE id=?`);
      db.exec('BEGIN IMMEDIATE');
      try { ids.forEach((recordId, index) => update.run(index, Number(recordId))); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },

    dashboard(code) {
      if (code && code !== 'all') return dashboardForController(controller(code).id).status;
      const total = one(`SELECT COUNT(*) total,SUM(CASE WHEN status='Done' THEN 1 ELSE 0 END) done,SUM(CASE WHEN status='In progress' THEN 1 ELSE 0 END) in_progress,SUM(CASE WHEN status IN ('Blocked','NOK / Rework') THEN 1 ELSE 0 END) blocked FROM status_items`);
      const result = Object.fromEntries(Object.entries(total).map(([key, value]) => [key, Number(value || 0)]));
      result.progress = result.total ? Math.round(result.done * 100 / result.total) : 0;
      return result;
    },
    overview() {
      const controllers = all('SELECT * FROM controllers ORDER BY sort_order,code').map(item => ({ ...item, metrics: dashboardForController(item.id) }));
      const sumSection = section => {
        const keys = new Set(controllers.flatMap(item => Object.keys(item.metrics[section])));
        const result = {};
        for (const key of keys) if (key !== 'progress') result[key] = controllers.reduce((sum, item) => sum + Number(item.metrics[section][key] || 0), 0);
        const finishedKey = section === 'status' ? 'done' : section === 'tasks' ? 'done' : 'closed';
        result.progress = result.total ? Math.round((result[finishedKey] || 0) * 100 / result.total) : 0;
        return result;
      };
      return { overall: { status: sumSection('status'), tasks: sumSection('tasks'), points: sumSection('points') }, controllers };
    },

    status(code, currentUser) { return statusRows(code, currentUser); },
    saveStatus(id, input, currentUser) {
      const before = id ? baseSnapshot('status', id) : null;
      const ownerId = asId(input.responsible_user_id);
      const values = {
        controller_id: controller(input.controller).id,
        test_id: clean(input.test_id), station: clean(input.station), function_detail: clean(input.function_detail),
        category: clean(input.category) || 'General', subcategory: clean(input.subcategory), milestone: clean(input.milestone),
        criticality: clean(input.criticality) || 'Medium', responsible_user_id: ownerId, responsible: userName(ownerId),
        status: clean(input.status) || 'Not started', checked_by: clean(input.checked_by), checked_on: nullableDate(input.checked_on),
        environment: clean(input.environment) || 'Factory', current_note: clean(input.current_note), evidence_link: clean(input.evidence_link)
      };
      let recordId = id;
      if (id) updateRecord('status_items', id, values, Object.keys(values));
      else {
        if (!values.test_id) values.test_id = `${clean(input.controller)}-${String(one('SELECT COALESCE(MAX(id),0)+1 value FROM status_items').value).padStart(3, '0')}`;
        recordId = insertRecord('status_items', { ...values, created_by: currentUser.id });
      }
      setMentions('status', recordId, input.mentioned_user_ids);
      const after = baseSnapshot('status', recordId);
      writeAudit('status', recordId, id ? 'update' : 'create', currentUser, before, after);
      return decorateStatus({ ...after, controller: one('SELECT code FROM controllers WHERE id=?', after.controller_id).code, created_by_name: userName(after.created_by), responsible_name: userName(after.responsible_user_id) }, currentUser);
    },
    deleteStatus(id, currentUser) { removeWithAudit('status', id, currentUser); },

    tasks(code, currentUser) { return taskRows(code, currentUser); },
    saveTask(id, input, currentUser) {
      const before = id ? baseSnapshot('task', id) : null;
      const ownerId = asId(input.owner_user_id);
      const values = {
        controller_id: controller(input.controller).id, title: clean(input.title), description: clean(input.description), station: clean(input.station),
        priority: clean(input.priority) || 'Medium', owner_user_id: ownerId, owner: userName(ownerId), status: clean(input.status) || 'To do',
        start_date: nullableDate(input.start_date), due_date: nullableDate(input.due_date), category: clean(input.category), subcategory: clean(input.subcategory),
        info_link: clean(input.info_link), linked_entity_type: clean(input.linked_entity_type), linked_entity_id: asId(input.linked_entity_id), linked_test_id: null
      };
      let recordId = id;
      if (id) updateRecord('tasks', id, values, Object.keys(values));
      else recordId = insertRecord('tasks', { ...values, created_by: currentUser.id });
      if (Array.isArray(input.checklist)) saveChecklist(recordId, input.checklist);
      setMentions('task', recordId, input.mentioned_user_ids);
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
      const ownerId = asId(input.owner_user_id);
      const defaultDays = Number(one("SELECT value FROM settings WHERE key='default_reminder_days'")?.value || 14);
      const defaultReminder = new Date();
      defaultReminder.setUTCDate(defaultReminder.getUTCDate() + defaultDays);
      const values = {
        controller_id: controller(input.controller).id, issue_id: clean(input.issue_id), title: clean(input.title), description: clean(input.description),
        impact: clean(input.impact), priority: clean(input.priority) || 'Medium', owner_user_id: ownerId, owner: userName(ownerId),
        status: clean(input.status) || 'Open', waiting_for: clean(input.waiting_for), next_action: clean(input.next_action),
        start_date: nullableDate(input.start_date), due_date: nullableDate(input.due_date), reminder_date: nullableDate(input.reminder_date) || (!id ? defaultReminder.toISOString().slice(0, 10) : before.reminder_date),
        category: clean(input.category), subcategory: clean(input.subcategory), info_link: clean(input.info_link),
        linked_entity_type: clean(input.linked_entity_type), linked_entity_id: asId(input.linked_entity_id), linked_test_id: null
      };
      let recordId = id;
      if (id) updateRecord('open_points', id, values, Object.keys(values));
      else {
        if (!values.issue_id) values.issue_id = `OP-${String(one('SELECT COALESCE(MAX(id),0)+1 value FROM open_points').value).padStart(3, '0')}`;
        recordId = insertRecord('open_points', { ...values, created_by: currentUser.id });
      }
      setMentions('point', recordId, input.mentioned_user_ids);
      const after = baseSnapshot('point', recordId);
      writeAudit('point', recordId, id ? 'update' : 'create', currentUser, before, after);
      const row = one(`SELECT p.*,c.code controller,creator.display_name created_by_name,owner.display_name owner_name FROM open_points p JOIN controllers c ON c.id=p.controller_id LEFT JOIN users creator ON creator.id=p.created_by LEFT JOIN users owner ON owner.id=p.owner_user_id WHERE p.id=?`, recordId);
      return decoratePoint(row, currentUser);
    },
    deletePoint(id, currentUser) { removeWithAudit('point', id, currentUser); },

    notes(code, from, to, currentUser) { return noteRows(code, from, to, currentUser); },
    saveNote(id, input, currentUser) {
      const before = id ? baseSnapshot('note', id) : null;
      const values = {
        controller_id: controller(input.controller).id, note_date: nullableDate(input.note_date) || new Date().toISOString().slice(0, 10),
        shift: clean(input.shift) || 'Dzień', type: clean(input.type) || 'Postęp', content: clean(input.content),
        linked_task_id: asId(input.linked_task_id), linked_status_id: asId(input.linked_status_id), linked_point_id: asId(input.linked_point_id)
      };
      let recordId = id;
      if (id) updateRecord('daily_notes', id, values, Object.keys(values));
      else recordId = insertRecord('daily_notes', { ...values, author: currentUser.display_name, created_by: currentUser.id });
      setMentions('note', recordId, input.mentioned_user_ids);
      const after = baseSnapshot('note', recordId);
      writeAudit('note', recordId, id ? 'update' : 'create', currentUser, before, after);
      const row = one(`SELECT n.*,c.code controller,creator.display_name created_by_name FROM daily_notes n LEFT JOIN controllers c ON c.id=n.controller_id LEFT JOIN users creator ON creator.id=n.created_by WHERE n.id=?`, recordId);
      return decorateNote(row, currentUser);
    },
    deleteNote(id, currentUser) {
      const note = one('SELECT * FROM daily_notes WHERE id=?', id);
      if (!note) throw appError('Nie znaleziono notatki', 404);
      if (!(currentUser.role === 'admin' || (currentUser.role === 'user' && note.created_by === currentUser.id))) throw appError('Nie możesz usunąć tej notatki', 403);
      removeWithAudit('note', id, currentUser);
    },

    goals(code, currentUser) {
      const filter = controllerFilter(code, 'g');
      return all(`SELECT g.*,c.code controller,creator.display_name created_by_name FROM goals g LEFT JOIN controllers c ON c.id=g.controller_id LEFT JOIN users creator ON creator.id=g.created_by ${filter.sql} ORDER BY g.due_date,g.id DESC`, ...filter.params).map(goal => ({ ...goal, links: all('SELECT * FROM goal_links WHERE goal_id=? ORDER BY entity_type,entity_id', goal.id), can_delete: currentUser.role === 'admin' }));
    },
    saveGoal(id, input, currentUser) {
      const before = id ? baseSnapshot('goal', id) : null;
      const values = { controller_id: controller(input.controller).id, title: clean(input.title), description: clean(input.description), status: clean(input.status) || 'Open', due_date: nullableDate(input.due_date) };
      let recordId = id;
      if (id) updateRecord('goals', id, values, Object.keys(values));
      else recordId = insertRecord('goals', { ...values, created_by: currentUser.id });
      if (Array.isArray(input.links)) {
        db.prepare('DELETE FROM goal_links WHERE goal_id=?').run(recordId);
        const insert = db.prepare('INSERT OR IGNORE INTO goal_links(goal_id,entity_type,entity_id) VALUES(?,?,?)');
        for (const link of input.links) if (TABLES[link.entity_type] && asId(link.entity_id)) insert.run(recordId, link.entity_type, asId(link.entity_id));
      }
      const after = baseSnapshot('goal', recordId);
      writeAudit('goal', recordId, id ? 'update' : 'create', currentUser, before, after);
      return one('SELECT * FROM goals WHERE id=?', recordId);
    },
    deleteGoal(id, currentUser) { removeWithAudit('goal', id, currentUser); },

    audit(type, id) {
      return all(`SELECT a.*,u.display_name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE a.entity_type=? AND a.entity_id=? ORDER BY a.changed_at DESC,a.id DESC`, type, id).map(row => ({ ...row, changes: JSON.parse(row.changes_json || '{}') }));
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
        status_updates: all(`SELECT a.*,u.display_name user_name FROM audit_log a LEFT JOIN users u ON u.id=a.user_id WHERE a.entity_type='status' AND a.user_id=? ORDER BY a.changed_at DESC LIMIT 50`, currentUser.id)
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
