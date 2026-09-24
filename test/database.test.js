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

test('V3.2 manages controller function groups, check templates and batch status editing', () => {
  const temporary = temporaryDatabase();
  let repository = openDatabase(temporary.path);
  try {
    const admin = repository.me(repository.authenticate('admin').id);
    const initialStatusCount = repository.status('all', admin).length;
    const group = repository.saveFunctionGroup(null, { controller: 'HB522', name: 'Test Station 900' }, admin);
    repository.bulkFunctionGroups({ controller: 'HB522', names: 'Robot TEST 01\nRobot TEST 02\nRobot TEST 01' });
    assert.ok(repository.config().function_groups.some(item => item.id === group.id));

    const hardware = repository.config().categories.find(item => item.name === 'Hardware');
    const selectedSubcategories = hardware.subcategories.slice(0, 2).map(item => item.id);
    repository.saveFunctionGroupChecks(group.id, { points: [{
      title: 'Sprawdzenie grupy testowej', category: 'Hardware', criticality: 'High', subcategory_ids: selectedSubcategories
    }] }, admin);

    let configuredGroup = repository.config().function_groups.find(item => item.id === group.id);
    assert.equal(configuredGroup.checks.length, 1);
    assert.deepEqual(configuredGroup.checks[0].subcategory_ids, selectedSubcategories);
    let generated = repository.status('all', admin).filter(item => item.function_group_id === group.id);
    assert.equal(generated.length, 2);
    assert.equal(repository.status('all', admin).length, initialStatusCount + 2);
    assert.ok(generated.every(item => item.station === 'Test Station 900' && item.category === 'Hardware'));

    repository.batchUpdateStatus({ items: [{ ...generated[0], status: 'Done', current_note: 'Zapis zbiorczy działa' }] }, admin);
    assert.equal(repository.status('all', admin).find(item => item.id === generated[0].id).status, 'Done');

    repository.saveFunctionGroupChecks(group.id, { points: [{
      id: configuredGroup.checks[0].id, title: 'Sprawdzenie grupy po edycji', category: 'Hardware', criticality: 'Critical', subcategory_ids: [selectedSubcategories[0]]
    }] }, admin);
    generated = repository.status('all', admin).filter(item => item.function_group_id === group.id);
    assert.equal(generated.length, 1);
    assert.equal(generated[0].function_detail, hardware.subcategories[0].default_function || 'Sprawdzenie grupy po edycji');
    assert.equal(generated[0].status, 'Done');

    repository.saveFunctionGroup(group.id, { controller: 'UB512', name: 'Test Station 901' }, admin);
    generated = repository.status('all', admin).filter(item => item.function_group_id === group.id);
    assert.equal(generated[0].controller, 'UB512');
    assert.equal(generated[0].station, 'Test Station 901');

    const beforeRestart = repository.status('all', admin).length;
    repository.close();
    repository = openDatabase(temporary.path);
    assert.equal(repository.status('all', repository.me(admin.id)).length, beforeRestart);
    repository.deleteFunctionGroup(group.id, repository.me(admin.id));
    assert.equal(repository.status('all', repository.me(admin.id)).filter(item => item.function_group_id === group.id).length, 0);
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test('V4 isolates projects, supports hierarchy, immutable IDs, elements, links and backup restore', () => {
  const temporary = temporaryDatabase();
  const repository = openDatabase(temporary.path);
  try {
    const account = repository.authenticate('admin');
    const beforeSelection = repository.me(account.id, null);
    assert.equal(beforeSelection.current_project, null);
    assert.equal(beforeSelection.projects.length, 2);

    repository.withProject(1, () => {
      const admin = repository.me(account.id, 1);
      assert.equal(admin.role, 'system_admin');
      assert.ok(repository.controllerGroups().length >= 2);
      assert.ok(repository.status('group:' + repository.controllerGroups()[0].id, admin).length > 0);

      const group = repository.saveFunctionGroup(null, { controller: 'HB522', name: '080VR_001' }, admin);
      repository.bulkFunctionGroupElements(group.id, { names: 'QM1\nQM2\nQM3\nBZ1\nBZ2' });
      const configured = repository.config().function_groups.find(item => item.id === group.id);
      assert.deepEqual(configured.elements.map(item => item.name), ['QM1', 'QM2', 'QM3', 'BZ1', 'BZ2']);

      const status = repository.saveStatus(null, {
        controller: 'HB522', function_group_id: group.id, function_group_element_id: configured.elements[0].id,
        test_id: 'EDIT-ME', category: 'Hardware', subcategory: '+24V Connection', status: 'Not started'
      }, admin);
      assert.match(status.test_id, /^W371-ST-/);
      assert.notEqual(status.test_id, 'EDIT-ME');
      const editedStatus = repository.saveStatus(status.id, { ...status, test_id: 'HACKED-ID', status: 'In progress' }, admin);
      assert.equal(editedStatus.test_id, status.test_id);

      const task = repository.saveTask(null, {
        controller: 'HB522', title: 'Sprawdź QM1', function_group_id: group.id,
        function_group_element_id: configured.elements[0].id, links: [{ entity_type: 'status', entity_id: status.id }]
      }, admin);
      assert.equal(task.links[0].entity_type, 'status');
      const linkedStatus = repository.status('all', admin).find(item => item.id === status.id);
      assert.equal(linkedStatus.related_work_total, 1);
      assert.equal(linkedStatus.related_work_progress, 0);
      repository.saveTask(task.id, { ...task, controller: 'HB522', status: 'Done', links: task.links }, admin);
      assert.equal(repository.status('all', admin).find(item => item.id === status.id).related_work_progress, 100);

      const backup = repository.projectBackup();
      const countBefore = repository.tasks('all', admin).length;
      repository.saveTask(null, { controller: 'HB522', title: 'Temporary record' }, admin);
      assert.equal(repository.tasks('all', admin).length, countBefore + 1);
      repository.restoreProjectBackup(backup);
      assert.equal(repository.tasks('all', admin).length, countBefore);
    });

    repository.withProject(2, () => {
      const admin = repository.me(account.id, 2);
      assert.equal(admin.current_project.code, 'W520');
      assert.equal(repository.tasks('all', admin).length, 35);
      assert.ok(repository.controllers().some(item => item.code === 'HB521'));
      assert.equal(repository.controllers().some(item => item.code === 'HB522'), true);
      assert.equal(repository.tasks('all', admin).some(item => item.title === 'Sprawdź QM1'), false);
    });
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test('V5 supports planner, calendar, weighted teamwork, canonical links and daily summaries', () => {
  const temporary = temporaryDatabase();
  const repository = openDatabase(temporary.path);
  try {
    const account = repository.authenticate('admin');
    repository.withProject(1, () => {
      const admin = repository.me(account.id, 1);
      const workerRecord = repository.saveUser(null, { username: 'v5worker', display_name: 'V5 Worker', password: 'secret123', project_role: 'user' });
      const worker = repository.me(workerRecord.id, 1);
      const root = repository.saveControllerGroup(null, { name: 'V5 Area' });
      const subarea = repository.saveControllerGroup(null, { name: 'V5 Subarea', parent_id: root.id });
      assert.throws(() => repository.saveControllerGroup(null, { name: 'Too deep', parent_id: subarea.id }), /maksymalnie/);
      repository.saveUserAreas(worker.id, { area_ids: [root.id, subarea.id, root.id] });
      assert.deepEqual(repository.users().find(item => item.id === worker.id).area_ids, [root.id, subarea.id]);

      const task = repository.saveTask(null, {
        controller: 'HB522', title: 'Weighted teamwork V5', direct_assignee_user_ids: [admin.id, worker.id, worker.id],
        checklist: [{ text: 'PLC', done: true, weight: 3, owner_user_id: admin.id }, { text: 'Robot', done: false, weight: 1, owner_user_id: worker.id }]
      }, admin);
      assert.deepEqual(task.assignee_user_ids.sort((a, b) => a - b), [admin.id, worker.id].sort((a, b) => a - b));
      assert.equal(task.progress, 75);

      const status = repository.saveStatus(null, { controller: 'HB522', category: 'Hardware', status: 'Not started', function_detail: 'V5 link target' }, admin);
      repository.saveTask(task.id, { ...task, controller: 'HB522', links: [{ entity_type: 'status', entity_id: status.id }, { entity_type: 'status', entity_id: status.id }] }, admin);
      let savedTask = repository.tasks('all', admin).find(item => item.id === task.id);
      assert.equal(savedTask.links.filter(link => link.entity_type === 'status' && link.entity_id === status.id).length, 1);
      repository.saveStatus(status.id, { ...status, controller: 'HB522', links: [{ entity_type: 'task', entity_id: task.id }, { entity_type: 'task', entity_id: task.id }] }, admin);
      savedTask = repository.tasks('all', admin).find(item => item.id === task.id);
      assert.equal(savedTask.links.filter(link => link.entity_type === 'status' && link.entity_id === status.id).length, 1);
      repository.saveTask(task.id, { ...savedTask, controller: 'HB522', status: 'Done', links: savedTask.links }, admin);

      const planDate = new Date().toISOString().slice(0, 10);
      repository.savePlannerDay({ user_id: worker.id, plan_date: planDate, entries: [
        { controller_group_id: root.id, shift: 'Dzień', transport_mode: 'transport_work' },
        { controller_group_id: subarea.id, shift: 'Noc', transport_mode: 'none' }
      ] }, admin);
      const planner = repository.planner(planDate, planDate);
      assert.equal(planner.entries.filter(item => item.user_id === worker.id).length, 2);

      const annotation = repository.saveCalendarAnnotation(null, { title: 'V5 milestone', start_date: planDate, end_date: planDate, assigned_user_id: worker.id }, admin);
      assert.ok(repository.calendar({ from: planDate, to: planDate, types: ['annotation'], only_mine: true }, worker).events.some(item => item.entity_id === annotation.id));
      assert.ok(repository.history({ limit: 20 }).some(item => item.entity_type === 'task' && item.entity_id === task.id));
      const summary = repository.dailySummary(planDate, planDate);
      assert.ok(summary.totals.added >= 1);
      assert.ok(summary.totals.closed >= 1);
      assert.equal(summary.modules.task.items.find(item => item.entity_id === task.id)?.classification, 'closed');
      assert.throws(() => repository.dailySummary('2026-01-01', '2026-01-15'), /14 dni/);

      const backup = repository.projectBackup();
      assert.equal(backup.version, 5);
      assert.ok(Array.isArray(backup.tables.planner_entries));
      assert.ok(Array.isArray(backup.tables.task_assignees));
      assert.ok(Array.isArray(backup.tables.calendar_annotations));
    });
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});
