import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { openDatabase, verifyPassword } from '../database.js';

function temporaryDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'plc-hub-v3-'));
  process.env.APP_USER = 'admin';
  process.env.APP_PASSWORD = 'test-password';
  return { directory, path: join(directory, 'test.db') };
}

test('V3 supports overview, ordering, assignment, mentions, audit and deletion rules', () => {
  const temporary = temporaryDatabase();
  const repository = openDatabase(temporary.path);
  try {
    const account = repository.authenticate('admin');
    const admin = repository.me(account.id);
    assert.ok(verifyPassword('test-password', account.password_hash));
    assert.equal(repository.overview().controllers.length, 6);
    assert.equal(repository.status('all', admin).length, 100);
    assert.equal(repository.tasks('all', admin).length, 100);
    assert.equal(repository.points('all', admin).length, 100);
    assert.equal(repository.notes('all', null, null, admin).length, 100);
    assert.equal(repository.goals('all', admin).length, 20);

    const workerRecord = repository.saveUser(null, { username: 'worker', display_name: 'PLC Worker', password: 'secret123', role: 'user' });
    const worker = repository.me(workerRecord.id);
    const moderatorRecord = repository.saveUser(null, { username: 'moderator', display_name: 'Moderator', password: 'secret123', role: 'moderator' });
    assert.equal(moderatorRecord.role, 'moderator');

    const controllerIds = repository.controllers().map(item => item.id).reverse();
    repository.reorder('controllers', controllerIds);
    assert.deepEqual(repository.controllers().map(item => item.id), controllerIds);

    const category = repository.saveCategory('task', null, { name: 'Worker category' });
    const subcategory = repository.saveSubcategory('task', null, { category_id: category.id, name: 'Worker subcategory' });
    assert.equal(repository.config().task_categories.find(item => item.id === category.id).subcategories[0].id, subcategory.id);

    const task = repository.saveTask(null, {
      controller: 'HB522', title: 'Worker task', owner_user_id: worker.id, category: category.name,
      subcategory: subcategory.name, due_date: '2030-01-01', checklist: [{ text: 'Step', done: false }]
    }, worker);
    assert.equal(repository.tasks('all', worker).find(item => item.id === task.id).owner_name, 'PLC Worker');
    assert.equal(repository.audit('task', task.id)[0].action, 'create');

    repository.saveTask(task.id, { ...task, controller: 'UB512', title: 'Changed by admin', checklist: task.checklist }, admin);
    assert.equal(repository.tasks('all', worker).find(item => item.id === task.id).controller, 'UB512');
    assert.throws(() => repository.deleteTask(task.id, worker), /Nie możesz usunąć/);

    const point = repository.savePoint(null, {
      controller: 'HB522', title: 'Mention worker', mentioned_user_ids: [worker.id], owner_user_id: admin.id
    }, admin);
    const note = repository.saveNote(null, {
      controller: 'HB522', content: 'Worker mentioned in shift note', shift: 'Noc', mentioned_user_ids: [worker.id], linked_point_id: point.id
    }, worker);
    const summary = repository.mySummary(worker);
    assert.ok(summary.points.some(item => item.id === point.id));
    assert.ok(summary.notes.some(item => item.id === note.id));
    repository.deleteNote(note.id, worker);
    assert.equal(repository.audit('note', note.id)[0].action, 'delete');

    const ownTask = repository.saveTask(null, { controller: 'HB522', title: 'Untouched own task' }, worker);
    repository.deleteTask(ownTask.id, worker);
    assert.equal(repository.audit('task', ownTask.id)[0].action, 'delete');
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test('V2 database is migrated to V3 without losing records', () => {
  const temporary = temporaryDatabase();
  const legacy = new DatabaseSync(temporary.path);
  legacy.exec(`
    CREATE TABLE app_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT;
    INSERT INTO app_meta VALUES('schema_version','2');
    CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT NOT NULL UNIQUE,display_name TEXT NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) STRICT;
    CREATE TABLE controllers(id INTEGER PRIMARY KEY,code TEXT NOT NULL UNIQUE,area TEXT NOT NULL DEFAULT '',description TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) STRICT;
    CREATE TABLE status_items(id INTEGER PRIMARY KEY,controller_id INTEGER NOT NULL,test_id TEXT NOT NULL UNIQUE,station TEXT NOT NULL,function_detail TEXT NOT NULL,category TEXT NOT NULL DEFAULT '',subcategory TEXT NOT NULL DEFAULT '',milestone TEXT NOT NULL DEFAULT '',criticality TEXT NOT NULL DEFAULT 'Medium',responsible TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'Not started',checked_by TEXT NOT NULL DEFAULT '',checked_on TEXT,environment TEXT NOT NULL DEFAULT '',current_note TEXT NOT NULL DEFAULT '',evidence_link TEXT NOT NULL DEFAULT '',created_by INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) STRICT;
    CREATE TABLE tasks(id INTEGER PRIMARY KEY,controller_id INTEGER NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',station TEXT NOT NULL DEFAULT '',priority TEXT NOT NULL DEFAULT 'Medium',owner TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'To do',due_date TEXT,linked_test_id TEXT,category TEXT NOT NULL DEFAULT '',subcategory TEXT NOT NULL DEFAULT '',start_date TEXT,info_link TEXT NOT NULL DEFAULT '',created_by INTEGER,linked_entity_type TEXT NOT NULL DEFAULT 'status',linked_entity_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) STRICT;
    CREATE TABLE open_points(id INTEGER PRIMARY KEY,controller_id INTEGER NOT NULL,issue_id TEXT NOT NULL UNIQUE,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',impact TEXT NOT NULL DEFAULT '',priority TEXT NOT NULL DEFAULT 'Medium',owner TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'Open',waiting_for TEXT NOT NULL DEFAULT '',next_action TEXT NOT NULL DEFAULT '',due_date TEXT,linked_test_id TEXT,category TEXT NOT NULL DEFAULT '',subcategory TEXT NOT NULL DEFAULT '',start_date TEXT,reminder_date TEXT,info_link TEXT NOT NULL DEFAULT '',created_by INTEGER,linked_entity_type TEXT NOT NULL DEFAULT 'status',linked_entity_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) STRICT;
    CREATE TABLE daily_notes(id INTEGER PRIMARY KEY,controller_id INTEGER,note_date TEXT NOT NULL,shift TEXT NOT NULL,author TEXT NOT NULL,type TEXT NOT NULL,content TEXT NOT NULL,created_by INTEGER,linked_task_id INTEGER,linked_status_id INTEGER,linked_point_id INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) STRICT;
    CREATE TABLE categories(id INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1) STRICT;
    CREATE TABLE subcategories(id INTEGER PRIMARY KEY,category_id INTEGER NOT NULL,name TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1) STRICT;
    CREATE TABLE options(id INTEGER PRIMARY KEY,kind TEXT NOT NULL,value TEXT NOT NULL,sort_order INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,UNIQUE(kind,value)) STRICT;
    CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL) STRICT;
    CREATE TABLE task_checklist(id INTEGER PRIMARY KEY,task_id INTEGER NOT NULL,text TEXT NOT NULL,done INTEGER NOT NULL DEFAULT 0,sort_order INTEGER NOT NULL DEFAULT 0) STRICT;
    CREATE TABLE goals(id INTEGER PRIMARY KEY,controller_id INTEGER,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'Open',due_date TEXT,created_by INTEGER,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP) STRICT;
    CREATE TABLE goal_links(id INTEGER PRIMARY KEY,goal_id INTEGER NOT NULL,entity_type TEXT NOT NULL,entity_id INTEGER NOT NULL) STRICT;
    INSERT INTO users(id,username,display_name,password_hash,role) VALUES(1,'legacy','Legacy Admin','salt:00','admin');
    INSERT INTO controllers(id,code,area,description) VALUES(1,'LEGACY','HB','Legacy controller');
    INSERT INTO status_items(id,controller_id,test_id,station,function_detail,created_by) VALUES(1,1,'LEG-001','ST01','Legacy test',1);
    INSERT INTO tasks(id,controller_id,title,category,subcategory,created_by) VALUES(1,1,'Legacy task','Legacy category','Legacy subcategory',1);
  `);
  legacy.close();

  const repository = openDatabase(temporary.path);
  try {
    const legacyAdmin = repository.me(1);
    assert.equal(repository.controllers()[0].code, 'LEGACY');
    assert.equal(repository.status('all', legacyAdmin)[0].test_id, 'LEG-001');
    const migratedCategory = repository.config().task_categories.find(item => item.name === 'Legacy category');
    assert.equal(migratedCategory.subcategories[0].name, 'Legacy subcategory');
    assert.equal(repository.audit('status', 1)[0].action, 'migrate');
    assert.equal(repository.config().settings.reminder_warning_days, '7');
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test('configured controller order survives a database restart', () => {
  const temporary = temporaryDatabase();
  let repository = openDatabase(temporary.path);
  try {
    const reversed = repository.controllers().map(item => item.id).reverse();
    const countsBeforeRestart = {
      status: repository.status('all', repository.me(1)).length,
      tasks: repository.tasks('all', repository.me(1)).length,
      points: repository.points('all', repository.me(1)).length,
      notes: repository.notes('all', null, null, repository.me(1)).length
    };
    repository.reorder('controllers', reversed);
    repository.close();
    repository = openDatabase(temporary.path);
    assert.deepEqual(repository.controllers().map(item => item.id), reversed);
    assert.deepEqual({
      status: repository.status('all', repository.me(1)).length,
      tasks: repository.tasks('all', repository.me(1)).length,
      points: repository.points('all', repository.me(1)).length,
      notes: repository.notes('all', null, null, repository.me(1)).length
    }, countsBeforeRestart);
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});
