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
    assert.match(repository.tasks('all', worker).find(item => item.id === task.id).controller_label, /UB512/);
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
    assert.match(generated[0].controller_label, /UB512/);
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
      assert.ok(repository.controllers().some(item => item.leaf_code === 'HB521'));
      assert.equal(repository.controllers().some(item => item.leaf_code === 'HB522'), true);
      assert.equal(repository.tasks('all', admin).some(item => item.title === 'Sprawdź QM1'), false);
    });
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test('V5 data remains compatible with planner, calendar, weighted teamwork, canonical links and daily summaries', () => {
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
      assert.throws(() => repository.saveUserAreas(worker.id, { area_ids: [root.id, subarea.id] }), /nadrzędnego/);
      repository.saveUserAreas(worker.id, { area_ids: [subarea.id, subarea.id] });
      assert.deepEqual(repository.users().find(item => item.id === worker.id).area_ids, [subarea.id]);

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
      assert.throws(() => repository.savePlannerDay({ user_id: worker.id, plan_date: planDate, entries: [
        { controller_group_id: root.id, shift: 'Dzień', transport_mode: 'transport_work' },
        { controller_group_id: subarea.id, shift: 'Noc', transport_mode: 'none' }
      ] }, admin), /nadrzędnego/);
      repository.savePlannerDay({ user_id: worker.id, plan_date: planDate, entries: [
        { controller_group_id: subarea.id, shift: 'Noc', work_mode: 'online', transport_mode: 'none' }
      ] }, admin);
      const planner = repository.planner(planDate, planDate);
      assert.equal(planner.entries.filter(item => item.user_id === worker.id).length, 1);

      const annotation = repository.saveCalendarAnnotation(null, { title: 'V5 milestone', start_date: planDate, end_date: planDate, assigned_user_id: worker.id }, admin);
      assert.ok(repository.calendar({ from: planDate, to: planDate, types: ['annotation'], only_mine: true }, worker).events.some(item => item.entity_id === annotation.id));
      assert.ok(repository.history({ limit: 20 }).some(item => item.entity_type === 'task' && item.entity_id === task.id));
      const summary = repository.dailySummary(planDate, planDate);
      assert.ok(summary.totals.added >= 1);
      assert.ok(summary.totals.closed >= 1);
      assert.equal(summary.modules.task.items.find(item => item.entity_id === task.id)?.classification, 'closed');
      assert.throws(() => repository.dailySummary('2026-01-01', '2026-01-15'), /14 dni/);

      const backup = repository.projectBackup();
      assert.equal(backup.version, 10);
      assert.ok(Array.isArray(backup.tables.planner_entries));
      assert.ok(Array.isArray(backup.tables.task_assignees));
      assert.ok(Array.isArray(backup.tables.calendar_annotations));
      assert.ok(Array.isArray(backup.tables.status_assignees));
      assert.ok(Array.isArray(backup.tables.calendar_item_dates));
    });
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test('V6 supports four-level display paths, safe manpower modes, calendar placement, multi-owner status and protected project deletion', () => {
  const temporary = temporaryDatabase();
  const repository = openDatabase(temporary.path);
  try {
    const account = repository.authenticate('admin');
    repository.withProject(1, () => {
      const admin = repository.me(account.id, 1);
      const firstController = repository.controllers().find(item => item.group_id);
      assert.ok(firstController.display_name.includes(firstController.leaf_code));
      assert.ok(firstController.hierarchy_label.endsWith(firstController.leaf_code));
      assert.equal(firstController.hierarchy_path.length <= 4, true);

      const workerARecord = repository.saveUser(null, { username: 'v6worker.a', display_name: 'V6 Worker A', password: 'secret123', project_role: 'user' });
      const workerBRecord = repository.saveUser(null, { username: 'v6worker.b', display_name: 'V6 Worker B', password: 'secret123', project_role: 'user' });
      const workerA = repository.me(workerARecord.id, 1);
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const roots = repository.controllerGroups().filter(item => !item.parent_id);
      assert.ok(roots.length >= 2);

      const status = repository.saveStatus(null, {
        controller: firstController.code, category: 'Hardware', subcategory: '+24V Connection', status: 'In progress',
        criticality: 'Critical', function_detail: 'V6 multi-owner status', responsible_user_ids: [workerA.id, workerBRecord.id, workerA.id]
      }, admin);
      assert.deepEqual(status.responsible_user_ids.sort((a, b) => a - b), [workerA.id, workerBRecord.id].sort((a, b) => a - b));
      assert.match(status.responsible_name, /V6 Worker/);

      assert.throws(() => repository.savePlannerDay({ user_id: workerA.id, plan_date: today, entries: [
        { controller_group_id: roots[0].id, work_mode: 'online', shift: 'Dzień' },
        { controller_group_id: roots[0].id, work_mode: 'offline', shift: 'Noc' }
      ] }, admin), /dwukrotnie/);
      const child = repository.controllerGroups().find(item => item.parent_id === roots[0].id);
      if (child) assert.throws(() => repository.savePlannerDay({ user_id: workerA.id, plan_date: today, entries: [
        { controller_group_id: roots[0].id, work_mode: 'online', shift: 'Dzień' },
        { controller_group_id: child.id, work_mode: 'online', shift: 'Dzień' }
      ] }, admin), /nadrzędnego/);
      repository.savePlannerDay({ user_id: workerA.id, plan_date: today, entries: [
        { controller_group_id: roots[0].id, work_mode: 'online', shift: 'Dzień', transport_mode: 'transport_work' },
        { controller_group_id: roots[1].id, work_mode: 'offline', shift: 'Noc', transport_mode: 'none' }
      ] }, admin);
      const planner = repository.planner(today, today);
      assert.equal(planner.users.some(item => item.id === admin.id), false);
      assert.equal(planner.entries.filter(item => item.user_id === workerA.id && item.work_mode === 'online').length, 1);
      assert.equal(planner.entries.filter(item => item.user_id === workerA.id && item.work_mode === 'offline').length, 1);
      assert.ok(planner.mode_summary.today_online >= 1);
      assert.ok(planner.mode_summary.today_offline >= 1);
      assert.ok(planner.area_summary.some(item => item.today_people >= 1));

      const task = repository.saveTask(null, { controller: firstController.code, title: 'V6 planned task', priority: 'High', due_date: tomorrow }, admin);
      const point = repository.savePoint(null, { controller: firstController.code, title: 'V6 planned point', priority: 'Medium', reminder_date: tomorrow }, admin);
      const note = repository.saveNote(null, { controller: firstController.code, note_date: today, shift: 'Dzień', type: 'General', content: 'V6 calendar note' }, admin);
      const goal = repository.saveGoal(null, { controller: firstController.code, title: 'V6 calendar goal', priority: 'Low', due_date: tomorrow }, admin);
      const assigned = repository.assignPlannerWork({ user_id: workerA.id, plan_date: today, items: [
        { entity_type: 'task', entity_id: task.id }, { entity_type: 'status', entity_id: status.id }, { entity_type: 'point', entity_id: point.id }, { entity_type: 'task', entity_id: task.id }
      ] }, admin);
      assert.equal(assigned.assigned, 3);
      assert.ok(repository.tasks('all', workerA).find(item => item.id === task.id).assignee_user_ids.includes(workerA.id));
      assert.ok(repository.status('all', workerA).find(item => item.id === status.id).responsible_user_ids.includes(workerA.id));
      assert.equal(repository.points('all', workerA).find(item => item.id === point.id).owner_user_id, workerA.id);

      const placement = repository.saveCalendarItems({ calendar_date: today, items: [
        { entity_type: 'task', entity_id: task.id }, { entity_type: 'status', entity_id: status.id }, { entity_type: 'point', entity_id: point.id },
        { entity_type: 'goal', entity_id: goal.id }, { entity_type: 'note', entity_id: note.id }, { entity_type: 'task', entity_id: task.id }
      ] }, admin);
      assert.equal(placement.added, 5);
      assert.equal(repository.saveCalendarItems({ calendar_date: today, items: [{ entity_type: 'task', entity_id: task.id }] }, admin).added, 0);
      const calendar = repository.calendar({ from: today, to: tomorrow, types: ['task', 'status', 'point', 'goal', 'note'], only_mine: false }, admin);
      assert.ok(['task', 'status', 'point', 'goal', 'note'].every(type => calendar.events.some(item => item.entity_type === type)));
      const critical = repository.calendar({ from: today, to: today, types: ['status'], priorities: ['Critical'], only_mine: true }, workerA);
      assert.ok(critical.events.some(item => item.entity_id === status.id));

      repository.saveSummaryPreference(workerA.id, { summary_area_source: 'planner' });
      const mine = repository.mySummary(workerA);
      assert.equal(mine.area_source, 'planner');
      assert.ok(mine.assigned_areas.some(item => [roots[0].id, roots[1].id].includes(item.id)));
    });

    const removable = repository.projects().find(item => item.id !== 1);
    assert.throws(() => repository.deleteProject(removable.id, { project_code: removable.code, confirmation: 'wrong' }), /nieprawidłowe/);
    assert.equal(repository.deleteProject(removable.id, { project_code: removable.code, confirmation: `USUŃ ${removable.code}` }).deleted, true);
    assert.equal(repository.projects().length, 1);
    const remaining = repository.projects()[0];
    assert.throws(() => repository.deleteProject(remaining.id, { project_code: remaining.code, confirmation: `USUŃ ${remaining.code}` }), /ostatniego/);
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test('V7 supports canonical hierarchy IDs, area tasks, goal links and configurable Planner participation', () => {
  const temporary = temporaryDatabase();
  const repository = openDatabase(temporary.path);
  try {
    const account = repository.authenticate('admin');
    repository.withProject(1, () => {
      const admin = repository.me(account.id, 1);
      const root = repository.saveControllerGroup(null, { name: 'TEST V7' });
      const areaA = repository.saveControllerGroup(null, { name: 'CELL A', parent_id: root.id });
      const areaB = repository.saveControllerGroup(null, { name: 'CELL B', parent_id: root.id });
      const plcA = repository.saveController(null, { leaf_code: 'SPS1', group_id: areaA.id, area: 'Test' });
      const plcB = repository.saveController(null, { leaf_code: 'SPS1', group_id: areaB.id, area: 'Test' });

      assert.equal(plcA.leaf_code, 'SPS1');
      assert.equal(plcB.leaf_code, 'SPS1');
      assert.notEqual(plcA.code, plcB.code);
      assert.match(plcA.code, /TEST-V7-CELL-A-SPS1/);
      assert.match(plcB.code, /TEST-V7-CELL-B-SPS1/);
      assert.match(plcA.display_name, /CELL A SPS1/);
      assert.throws(() => repository.saveController(null, { leaf_code: 'SPS1', group_id: areaA.id }), /już sterownik/);

      const areaTask = repository.saveTask(null, {
        hierarchy_target: `group:${root.id}`, title: 'Globalne sprawdzenie TEST V7', status: 'In progress'
      }, admin);
      assert.equal(areaTask.scope_is_group, true);
      assert.equal(areaTask.scope_checklist.length, 2);
      assert.equal(areaTask.progress, 0);
      const completedController = areaTask.scope_checklist[0].controller_id;
      const updatedTask = repository.saveTask(areaTask.id, {
        ...areaTask, hierarchy_target: `group:${root.id}`,
        scope_checklist: areaTask.scope_checklist.map(item => ({ controller_id: item.controller_id, done: item.controller_id === completedController }))
      }, admin);
      assert.equal(updatedTask.progress, 50);
      const taskAudit = repository.audit('task', areaTask.id)[0];
      assert.ok(Array.isArray(taskAudit.changes.scope_checklist.to));
      assert.ok(repository.tasks(plcA.code, admin).some(item => item.id === areaTask.id));
      assert.ok(repository.tasks(plcB.code, admin).some(item => item.id === areaTask.id));
      assert.equal(repository.overview(plcA.code).overall.tasks.total, repository.tasks(plcA.code, admin).length);

      const status = repository.saveStatus(null, {
        controller: plcA.code, function_detail: 'Status przypisany do celu', category: 'Hardware', status: 'In progress'
      }, admin);
      const goal = repository.saveGoal(null, { controller: plcA.code, title: 'Cel V7', status: 'Open', links: [] }, admin);
      const linkedStatus = repository.saveStatus(status.id, { ...status, controller: plcA.code, links: [{ entity_type: 'goal', entity_id: goal.id }] }, admin);
      assert.equal(linkedStatus.links.filter(link => link.entity_type === 'goal' && link.entity_id === goal.id).length, 1);
      assert.equal(repository.goals('all', admin).find(item => item.id === goal.id).links.filter(link => link.entity_type === 'status' && link.entity_id === status.id).length, 1);

      assert.equal(repository.users().find(user => user.id === admin.id).planner_enabled, 0);
      repository.setPlannerEnabled(admin.id, { planner_enabled: 1 });
      assert.ok(repository.planner(new Date().toISOString().slice(0, 10), new Date().toISOString().slice(0, 10)).users.some(user => user.id === admin.id));
      repository.saveSummaryPreference(admin.id, { summary_area_source: 'planner' });
      assert.equal(repository.mySummary(admin).area_source, 'planner');

      const overview = repository.overview('all');
      assert.ok(overview.overall.goals.total >= 1);
      assert.ok(Array.isArray(overview.status_breakdown));
      assert.ok(overview.trends.week.every(point => point.goals && Number.isFinite(point.goals.total)));
      assert.equal(repository.projectBackup().version, 10);
    });
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test('V8 supports announcements, aggregated KPI trends, unified Planner requirements and today-only guests', () => {
  const temporary = temporaryDatabase();
  const repository = openDatabase(temporary.path);
  try {
    const account = repository.authenticate('admin');
    repository.withProject(1, () => {
      const admin = repository.me(account.id, 1);
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const roots = repository.controllerGroups().filter(item => !item.parent_id);
      const controller = repository.controllers()[0];
      const guestRecord = repository.saveUser(null, { username: 'v8guest', display_name: 'V8 Today Guest', password: 'secret123', project_role: 'user', planner_enabled: 0 });
      const guest = repository.me(guestRecord.id, 1);
      repository.setPlannerEnabled(guest.id, { planner_enabled: 0 });

      const status = repository.saveStatus(null, { controller: controller.code, function_detail: 'V8 test status', category: 'Hardware', status: 'In progress', milestone: 'legacy milestone' }, admin);
      assert.equal(status.milestone, '');
      const task = repository.saveTask(null, { controller: controller.code, title: 'V8 linked task', status: 'To do' }, admin);

      const announcement = repository.saveAnnouncement(null, {
        title: 'Wiadomość testowa V8', content: 'Treść dla zespołu', info_link: 'https://example.com',
        scope_group_ids: [roots[0].id], recipient_user_ids: [guest.id],
        links: [{ entity_type: 'task', entity_id: task.id }, { entity_type: 'task', entity_id: task.id }, { entity_type: 'status', entity_id: status.id }]
      }, admin);
      assert.deepEqual(announcement.scope_group_ids, [roots[0].id]);
      assert.deepEqual(announcement.recipient_user_ids, [guest.id]);
      assert.equal(announcement.links.length, 2);
      assert.equal(repository.announcements(guest)[0].can_edit, false);

      repository.savePlannerDay({ user_id: guest.id, plan_date: today, entries: [{ controller_group_id: roots[0].id, work_mode: 'online', shift: 'Dzień' }] }, admin);
      assert.throws(() => repository.savePlannerDay({ user_id: guest.id, plan_date: tomorrow, entries: [{ controller_group_id: roots[0].id, work_mode: 'online', shift: 'Dzień' }] }, admin), /wyłącznie do dzisiejszego/);
      repository.setPlannerRequirements({ plan_date: today, controller_group_id: roots[0].id, online_required: 3, offline_required: 1, note: 'Rozruch' }, admin);
      const managerPlan = repository.planner(today, today, admin);
      const userPlan = repository.planner(today, today, guest);
      assert.equal(managerPlan.can_manage_requirements, true);
      assert.equal(managerPlan.requirements.length, 2);
      assert.equal(userPlan.can_manage_requirements, false);
      assert.equal(userPlan.requirements.length, 0);
      assert.equal(managerPlan.area_day_summary.find(item => item.id === roots[0].id).days[0].online_required, 3);

      repository.setPlannerEnabled(guest.id, { planner_enabled: 1 });
      const entry = repository.planner(today, today, admin).entries.find(item => item.user_id === guest.id);
      repository.movePlannerEntry({ entry_id: entry.id, target_user_id: guest.id, target_date: tomorrow, copy: true }, admin);
      assert.ok(repository.planner(today, tomorrow, admin).entries.some(item => item.user_id === guest.id && item.plan_date === tomorrow));

      const overview = repository.overview('all');
      const rootTrend = overview.hierarchy_trends.find(item => item.scope === `group:${roots[0].id}`);
      assert.ok(rootTrend);
      assert.ok(Array.isArray(rootTrend.trends.day));
      assert.ok(Array.isArray(rootTrend.trends.week));
      assert.ok(Array.isArray(rootTrend.trends.month));
      assert.equal(repository.projectBackup().version, 10);

      repository.deleteAnnouncement(announcement.id);
      assert.equal(repository.announcements(admin).some(item => item.id === announcement.id), false);
    });
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test('V9 supports requirements, guarded duplication, comments, pushes, calendar ranges and work-time calculation', () => {
  const temporary = temporaryDatabase();
  const repository = openDatabase(temporary.path);
  try {
    const account = repository.authenticate('admin');
    repository.withProject(1, () => {
      const admin = repository.me(account.id, 1);
      const controller = repository.controllers()[0];
      const root = repository.controllerGroups().find(item => !item.parent_id);
      const workerRecord = repository.saveUser(null, {
        username: 'v9worker', display_name: 'V9 Worker', password: 'secret123', project_role: 'user', planner_enabled: 1
      });
      const worker = repository.me(workerRecord.id, 1);

      const requirement = repository.saveCompletionRequirement(null, {
        name: 'Pomiary odbiorowe V9', description: 'Wymagane przed zamknięciem.'
      });
      const statusBatch = repository.bulkCreateStatus({
        controller: controller.code,
        names: ['Powtarzalna nazwa V9', 'Powtarzalna nazwa V9'],
        category: 'Hardware', status: 'Not started', requirement_ids: [requirement.id]
      }, admin);
      assert.equal(statusBatch.created, 2);
      assert.equal(statusBatch.items.every(item => item.requirement_ids.includes(requirement.id)), true);
      assert.equal(repository.status('all', admin).filter(item => item.function_detail === 'Powtarzalna nazwa V9').length, 2);

      const task = repository.saveTask(null, {
        controller: controller.code, title: 'Zadanie V9', description: 'Kontrola duplikatu',
        status: 'To do', start_date: '2026-10-08', due_date: '2026-10-10',
        direct_assignee_user_ids: [worker.id],
        checklist: [{ text: 'Potwierdzić wynik', done: false, weight: 2, owner_user_id: worker.id }],
        requirement_ids: [requirement.id]
      }, admin);
      assert.deepEqual(task.requirement_ids, [requirement.id]);
      assert.ok(repository.notifications(worker, 50).some(item => item.kind === 'assignment' && item.entity_id === task.id));
      assert.throws(() => repository.saveTask(null, {
        ...task, controller: controller.code, duplicate_source_id: task.id,
        checklist: task.checklist, direct_assignee_user_ids: task.direct_assignee_user_ids,
        requirement_ids: task.requirement_ids, links: task.links
      }, admin), /musi różnić się/);
      const duplicate = repository.saveTask(null, {
        ...task, controller: controller.code, title: 'Zadanie V9 — kopia zmieniona', duplicate_source_id: task.id,
        checklist: task.checklist, direct_assignee_user_ids: task.direct_assignee_user_ids,
        requirement_ids: task.requirement_ids, links: task.links
      }, admin);
      assert.notEqual(duplicate.id, task.id);

      const comment = repository.addComment({ entity_type: 'task', entity_id: task.id, content: 'Proszę potwierdzić wynik testu.' }, admin);
      assert.equal(comment.user_name, admin.display_name);
      assert.ok(repository.tasks('all', worker).find(item => item.id === task.id).comments.some(item => item.id === comment.id));
      assert.ok(repository.notifications(worker, 50).some(item => item.kind === 'comment' && item.entity_id === task.id));
      assert.ok(repository.audit('task', task.id).some(item => item.changes.comment?.to === 'Proszę potwierdzić wynik testu.'));

      const point = repository.savePoint(null, {
        controller: controller.code, title: 'Punkt V9', owner_user_id: worker.id,
        start_date: '2026-10-08', due_date: '2026-10-11', reminder_date: '2026-10-09', requirement_ids: [requirement.id]
      }, admin);
      assert.deepEqual(point.requirement_ids, [requirement.id]);
      assert.equal(repository.calendar({ from: '2026-10-08', to: '2026-10-11', types: ['task'], only_mine: false }, admin).events.some(item => item.entity_id === task.id && item.start_date === '2026-10-08' && item.end_date === '2026-10-10'), true);
      const undated = repository.saveTask(null, { controller: controller.code, title: 'Bez dat V9' }, admin);
      assert.equal(repository.calendar({ from: '2026-10-01', to: '2026-10-31', types: ['task'], only_mine: false }, admin).events.some(item => item.entity_id === undated.id), false);

      const announcement = repository.saveAnnouncement(null, {
        title: 'Komunikat V9', content: 'Wymagane potwierdzenie odczytu.', scope_group_ids: [root.id], recipient_user_ids: [worker.id]
      }, admin);
      assert.ok(repository.notifications(admin, 50).some(item => item.kind === 'announcement' && item.entity_id === announcement.id));
      assert.ok(repository.notifications(worker, 50).some(item => item.kind === 'announcement' && item.entity_id === announcement.id));
      repository.acknowledgeAnnouncement(announcement.id, worker);
      assert.equal(repository.announcements(admin).find(item => item.id === announcement.id).accepted_users.some(item => item.user_id === worker.id), true);

      repository.savePlannerDay({
        user_id: worker.id, plan_date: '2026-10-08', entries: [{ controller_group_id: root.id, work_mode: 'online', shift: 'Dzień' }]
      }, admin);
      repository.savePlannerHoliday(null, { holiday_date: '2026-10-08', name: 'Święto testowe V9' }, admin);
      repository.savePlannerDay({ user_id: worker.id, plan_date: '2026-10-09', absence_type: 'vacation', absence_note: 'Urlop' }, admin);
      repository.savePlannerDay({ user_id: worker.id, plan_date: '2026-10-10', absence_type: 'time_off', absence_note: 'Odbiór nadgodzin' }, admin);
      repository.savePlannerDay({
        user_id: worker.id, plan_date: '2026-10-11', entries: [{ controller_group_id: root.id, work_mode: 'online', shift: 'Dzień', transport_mode: 'transport_only' }]
      }, admin);
      repository.setPlannerRequirementsBatch({ items: [{
        plan_date: '2026-10-08', controller_group_id: root.id, online_required: 2, offline_required: 1
      }] }, admin);
      const managerPlanner = repository.planner('2026-10-08', '2026-10-11', admin);
      const workerPlanner = repository.planner('2026-10-08', '2026-10-11', worker);
      const workerHours = managerPlanner.time_details.users.find(item => item.user_id === worker.id);
      assert.equal(workerHours.actual_hours, 10.5);
      assert.equal(workerHours.credited_hours, 8);
      assert.equal(workerHours.overtime_balance, 13);
      assert.equal(managerPlanner.time_details.details.find(item => item.user_id === worker.id && item.date === '2026-10-11').actual_hours, 0);
      assert.equal(managerPlanner.area_day_summary.find(item => item.id === root.id).days[0].online_required, 2);
      assert.equal(workerPlanner.requirements.length, 0);
      assert.equal(workerPlanner.time_details, null);

      assert.equal(repository.projectBackup().version, 10);
      assert.ok(Array.isArray(repository.projectBackup().tables.completion_requirements));
      assert.ok(Array.isArray(repository.projectBackup().tables.entity_comments));
      assert.ok(Array.isArray(repository.projectBackup().tables.planner_absences));
    });
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});

test('V10 supports live-safe edits, scoped notes, targeted news, passwords and Planner corrections', () => {
  const temporary = temporaryDatabase();
  const repository = openDatabase(temporary.path);
  try {
    const account = repository.authenticate('admin');
    const admin = repository.me(account.id);
    repository.withProject(1, () => {
      const workerRecord = repository.saveUser(null, { username: 'v10worker', display_name: 'V10 Worker', password: 'secret123', project_role: 'user', planner_enabled: 1 });
      const worker = repository.me(workerRecord.id);
      const root = repository.controllerGroups().find(item => !item.parent_id);
      const controller = repository.controllers()[0];

      const note = repository.saveNote(null, { hierarchy_target: `group:${root.id}`, note_date: '2026-10-08', content: 'Notatka całego obszaru', shift: 'Dzień' }, admin);
      assert.equal(note.controller_group_id, root.id);
      assert.match(note.scope_label, new RegExp(root.name));

      const label = repository.saveAnnouncementLabel(null, { name: 'Pilne V10', color: 'red' });
      const announcement = repository.saveAnnouncement(null, { title: 'Tylko dla pracownika', content: 'Potwierdź odbiór.', importance: 'Krytyczna', label_ids: [label.id], recipient_user_ids: [worker.id] }, admin);
      assert.deepEqual(announcement.label_ids, [label.id]);
      assert.equal(repository.announcements(worker).find(item => item.id === announcement.id).requires_ack, true);
      assert.equal(repository.announcements(admin).find(item => item.id === announcement.id).requires_ack, false);
      assert.throws(() => repository.acknowledgeAnnouncement(announcement.id, admin), /nie wymaga potwierdzenia/i);
      assert.equal(repository.acknowledgeAnnouncement(announcement.id, worker).accepted_by_me, true);

      const task = repository.saveTask(null, { controller: controller.code, title: 'Edycja współbieżna V10' }, admin);
      const stale = { ...task };
      const updated = repository.saveTask(task.id, { ...task, title: 'Najnowszy tytuł', updated_at: task.updated_at }, admin);
      assert.equal(updated.title, 'Najnowszy tytuł');
      assert.throws(() => repository.saveTask(task.id, { ...stale, title: 'Stary zapis', updated_at: stale.updated_at }, admin), /zmieniony przez inną osobę/i);

      repository.savePlannerDay({ user_id: worker.id, plan_date: '2026-10-08', entries: [], actual_hours_adjustment: 9, overtime_raw_adjustment: 2, overtime_weighted_adjustment: 3, adjustment_note: 'Korekta testowa' }, admin);
      const detail = repository.planner('2026-10-08', '2026-10-08', admin).time_details.details.find(item => item.user_id === worker.id);
      assert.equal(detail.actual_hours, 9);
      assert.equal(detail.overtime_raw, 3);
      assert.equal(detail.overtime_weighted, 4.5);
      assert.equal(detail.overtime_raw_cumulative, 3);
      assert.equal(detail.adjustment_note, 'Korekta testowa');
      repository.savePlannerHolidaysBulk({ items: [{ holiday_date: '2026-12-25', name: 'Boże Narodzenie' }] }, admin);
      assert.ok(repository.config().planner_holidays.some(item => item.holiday_date === '2026-12-25'));

      repository.changeOwnPassword(admin.id, { current_password: 'test-password', new_password: 'new-password-10' });
      assert.ok(verifyPassword('new-password-10', repository.authenticate('admin').password_hash));
      repository.resetUserPassword(worker.id, { new_password: 'worker-password-10' });
      assert.ok(verifyPassword('worker-password-10', repository.authenticate('v10worker').password_hash));

      const backup = repository.projectBackup();
      assert.equal(backup.version, 10);
      assert.ok(Array.isArray(backup.tables.announcement_labels));
      assert.ok(Array.isArray(backup.tables.planner_time_adjustments));
    });
  } finally {
    repository.close();
    rmSync(temporary.directory, { recursive: true, force: true });
  }
});
