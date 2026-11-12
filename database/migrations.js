import { seedDemoData } from '../demo-data.js';
import { ENTITY_TABLES as TABLES } from './constants.js';
import { hashPassword, validPassword } from './security.js';
import { DEFAULT_STATUS_WORKFLOW_STATES, PRIORITY_VALUES, statusValues } from '../public/modules/workflow-model.js';

const clean = value => typeof value === 'string' ? value.trim() : '';

/**
 * Applies schema migrations, seeds configuration and performs idempotent backfills.
 * Repository methods stay in database.js; this module owns schema evolution only.
 */
export function prepareDatabase(db, { seedDemo, demoLimit = 100 }) {
  ensureMigrationTable(db);
  runMigrations(db, [
    ['003-base-projects', migrateToV3],
    ['004-project-links', migrateToV4],
    ['005-planner', migrateToV5],
    ['006-hierarchy', migrateToV6],
    ['007-status-groups', migrateToV7],
    ['008-meetings', migrateToV8],
    ['009-announcements', migrateToV9],
    ['010-notifications', migrateToV10],
    ['011-saved-views', migrateToV11],
    ['012-automation', migrateToV12],
    ['013-open-points', migrateToV13],
    ['014-entity-history', migrateToV14],
    ['015-calendar-annotations', migrateToV15],
    ['016-operations', migrateToV16],
    ['017-planner-requirements', migrateToV17],
    ['018-review-workflow', migrateToV18],
    ['019-meeting-publication', migrateToV19],
    ['020-meeting-plans', migrateToV20],
    ['021-meeting-groups', migrateToV21],
    ['022-meeting-priorities', migrateToV22],
    ['023-status-descriptions', migrateToV23],
    ['024-status-inheritance', migrateToV24],
    ['025-external-dependencies', migrateToV25],
    ['026-security-foundation', migrateSecurityFoundation],
    ['027-status-workflow', migrateStatusWorkflow],
    ['028-entity-dependencies', migrateEntityDependencies],
    ['029-status-matrix-columns', ensureStatusMatrixColumns],
    ['030-entity-scope-columns', ensureEntityScopeColumns],
    ['031-project-meeting-features', ensureProjectMeetingFeatures],
    ['032-performance-indexes', ensurePerformanceIndexes]
  ]);
  const defaultProjectId = primaryProjectId(db);

  runMigration(db, '033-default-configuration', () => {
    seedConfiguration(db, defaultProjectId);
    ensureStatusWorkflowStates(db);
  });

  if (seedDemo) {
    if (defaultProjectId === 1) seedDemoData(db, hashPassword, demoLimit);
    seedControllerHierarchy(db, defaultProjectId);
    seedSecondProject(db, hashPassword);
  }

  runMigrations(db, [
    ['034-global-planner-data', migrateGlobalPlannerData],
    ['035-remove-commissioning-module', removeCommissioningModule],
    ['036-remove-definition-of-done', removeDefinitionOfDone],
    ['037-remove-knowledge-base', removeKnowledgeBase],
    ['038-sync-project-memberships', syncProjectMemberships],
    ['039-remove-duplicate-controller-roots', removeEmptyDuplicateControllerRoots],
    ['040-backfill-v3', backfillV3],
    ['041-backfill-function-groups', backfillFunctionGroups],
    ['042-backfill-v4-links', backfillV4Links],
    ['043-backfill-v5', backfillV5],
    ['044-backfill-v6', backfillV6],
    ['045-backfill-v7', backfillV7]
  ]);
  if (seedDemo) { seedV5Demo(db); seedV8Demo(db); }
  runMigration(db, '046-status-matrix', () => migrateStatusMatrix(db));
  runMigration(db, '047-migration-audit', () => seedMigrationAudit(db, defaultProjectId));
  runMigration(db, '048-current-schema-marker', () => db.prepare("INSERT INTO app_meta(key,value) VALUES('schema_version','current') ON CONFLICT(key) DO UPDATE SET value='current'").run());
  runMigration(db, '049-meeting-priority-p1-p4', () => migrateMeetingPrioritiesToP1P4(db));
  return defaultProjectId;
}

function migrateMeetingPrioritiesToP1P4(db) {
  db.exec(`UPDATE project_meeting_items SET meeting_priority=CASE
    WHEN meeting_priority IN ('Critical','1','2') THEN '1'
    WHEN meeting_priority IN ('High','3','4') THEN '2'
    WHEN meeting_priority IN ('Medium','5','6','7') THEN '3'
    WHEN meeting_priority IN ('Low','8','9','10') THEN '4'
    ELSE '3' END`);
  const meetings = db.prepare("SELECT id,published_snapshot_json FROM project_meetings WHERE COALESCE(published_snapshot_json,'{}')!='{}'").all();
  const normalize = value => {
    const number = Number(value);
    if (['Critical', '1', '2'].includes(String(value))) return '1';
    if (value === 'High' || number === 3 || number === 4) return '2';
    if (value === 'Medium' || (number >= 5 && number <= 7)) return '3';
    if (value === 'Low' || (number >= 8 && number <= 10)) return '4';
    return '3';
  };
  const update = db.prepare('UPDATE project_meetings SET published_snapshot_json=? WHERE id=?');
  for (const meeting of meetings) {
    try {
      const snapshot = JSON.parse(meeting.published_snapshot_json);
      if (!Array.isArray(snapshot.items)) continue;
      snapshot.items = snapshot.items.map(item => ({ ...item, meeting_priority: normalize(item.meeting_priority) }));
      update.run(JSON.stringify(snapshot), meeting.id);
    } catch { /* historyczne uszkodzone migawki pozostają bez zmian */ }
  }
}

function ensureMigrationTable(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) STRICT`);
}

function runMigration(db, id, migrate) {
  if (db.prepare('SELECT 1 FROM schema_migrations WHERE id=?').get(id)) return false;
  migrate(db);
  db.prepare('INSERT INTO schema_migrations(id) VALUES(?)').run(id);
  return true;
}

function runMigrations(db, migrations) {
  for (const [id, migrate] of migrations) runMigration(db, id, () => migrate(db));
}

function ensurePerformanceIndexes(db) {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_status_function_group ON status_items(function_group_id,function_group_check_id);
    CREATE INDEX IF NOT EXISTS idx_status_project ON status_items(project_id,controller_id,status);
    CREATE INDEX IF NOT EXISTS idx_status_scope_group ON status_items(project_id,controller_group_id,status);
    CREATE INDEX IF NOT EXISTS idx_task_scope_group ON tasks(project_id,controller_group_id,status);
    CREATE INDEX IF NOT EXISTS idx_task_scope_checklist ON task_scope_checklist(task_id,sort_order);
    CREATE INDEX IF NOT EXISTS idx_points_project ON open_points(project_id,controller_id,status,due_date);
    CREATE INDEX IF NOT EXISTS idx_points_scope_group ON open_points(project_id,controller_group_id,status,due_date);
    CREATE INDEX IF NOT EXISTS idx_goals_project ON goals(project_id,controller_id,status,due_date);
    CREATE INDEX IF NOT EXISTS idx_goals_scope_group ON goals(project_id,controller_group_id,status,due_date);
    CREATE INDEX IF NOT EXISTS idx_notes_project_date ON daily_notes(project_id,note_date DESC,controller_id);
    CREATE INDEX IF NOT EXISTS idx_audit_project_changed ON audit_log(project_id,changed_at DESC,id DESC);
  `);
}

function columnNames(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
}

function removeKnowledgeBase(db) {
  db.exec('DROP TABLE IF EXISTS knowledge_articles');
}

function ensureColumn(db, table, name, definition) {
  if (!columnNames(db, table).has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

function ensureProjectMeetingFeatures(db) {
  ensureColumn(db, 'project_meetings', 'period_from', 'TEXT');
  ensureColumn(db, 'project_meetings', 'period_to', 'TEXT');
  ensureColumn(db, 'project_meeting_items', 'objective', "TEXT NOT NULL DEFAULT 'Kontynuacja'");
  ensureColumn(db, 'project_meeting_items', 'outcome_comment', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'project_meeting_items', 'target_status', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'project_meeting_items', 'meeting_priority', "TEXT NOT NULL DEFAULT '5'");
  ensureColumn(db, 'project_meeting_items', 'baseline_json', "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(db, 'project_meeting_items', 'status_changed_by_user_id', 'INTEGER');
  ensureColumn(db, 'project_meeting_items', 'group_name', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'project_meeting_items', 'group_key', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'project_meeting_items', 'review_confirmed', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'project_meetings', 'published_at', 'TEXT');
  ensureColumn(db, 'project_meetings', 'published_announcement_id', 'INTEGER');
  ensureColumn(db, 'project_meetings', 'published_snapshot_json', "TEXT NOT NULL DEFAULT '{}'");
  db.exec(`CREATE TABLE IF NOT EXISTS project_meeting_item_assignees (
    meeting_item_id INTEGER NOT NULL REFERENCES project_meeting_items(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY(meeting_item_id,user_id)
  ) STRICT, WITHOUT ROWID;
  CREATE TABLE IF NOT EXISTS project_meeting_item_workers (
    meeting_item_id INTEGER NOT NULL REFERENCES project_meeting_items(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY(meeting_item_id,user_id)
  ) STRICT, WITHOUT ROWID;`);
  db.exec("UPDATE project_meetings SET period_from=COALESCE(period_from,meeting_date),period_to=COALESCE(period_to,meeting_date)");
}

const BASE_STATUS_WORKFLOW_STATES = DEFAULT_STATUS_WORKFLOW_STATES.map(item => [
  item.system_key, item.value, item.label, item.icon, item.description, Number(item.counts_as_done)
]);

function ensureStatusWorkflowStates(db, projectId = null) {
  const projects = projectId ? [{ id: Number(projectId) }] : db.prepare('SELECT id FROM projects').all();
  const insert = db.prepare(`INSERT OR IGNORE INTO status_workflow_states(project_id,value,label,icon,description,system_key,included,counts_as_done,sort_order)
    VALUES(?,?,?,?,?,?,1,?,?)`);
  for (const project of projects) BASE_STATUS_WORKFLOW_STATES.forEach(([key, value, label, icon, description, done], index) => insert.run(project.id, value, label, icon, description, key, done, index));
}

function ensureStatusMatrixColumns(db) {
  ensureColumn(db, 'status_items', 'status_group_id', 'INTEGER');
  ensureColumn(db, 'status_items', 'status_subgroup_id', 'INTEGER');
  ensureColumn(db, 'status_items', 'progress_updated_at', 'TEXT');
  ensureColumn(db, 'status_items', 'progress_updated_by', 'INTEGER REFERENCES users(id) ON DELETE SET NULL');
  const hadColumnRole = columnNames(db, 'status_columns').has('column_role');
  ensureColumn(db, 'status_columns', 'column_role', "TEXT NOT NULL DEFAULT 'subpoint' CHECK(column_role IN ('basic','subpoint'))");
  if (!hadColumnRole) db.exec("UPDATE status_columns SET column_role=CASE WHEN field_type='text' THEN 'basic' ELSE 'subpoint' END");
  db.exec('CREATE INDEX IF NOT EXISTS idx_status_items_matrix ON status_items(project_id,status_group_id,status_subgroup_id)');
}

function ensureEntityScopeColumns(db) {
  for (const table of ['status_items', 'open_points', 'goals']) {
    ensureColumn(db, table, 'controller_group_id', 'INTEGER REFERENCES controller_groups(id) ON DELETE SET NULL');
  }
}

function migrateStatusMatrix(db, onlyProjectId = null) {
  ensureStatusMatrixColumns(db);
  if (!onlyProjectId && db.prepare("SELECT value FROM app_meta WHERE key='status_matrix_backfill_v1'").get()?.value === '1') return;
  const allowedStatuses = new Set(statusValues('status').filter(value => value !== 'Never checked'));
  const rows = db.prepare(`SELECT id,project_id,trim(COALESCE(category,'')) category,trim(COALESCE(subcategory,'')) subcategory,status
    FROM status_items ${onlyProjectId ? 'WHERE project_id=?' : ''} ORDER BY project_id,id`).all(...(onlyProjectId ? [onlyProjectId] : []));
  const findGroup = db.prepare('SELECT id FROM status_groups WHERE project_id=? AND name=? COLLATE NOCASE');
  const insertGroup = db.prepare('INSERT INTO status_groups(project_id,name,sort_order) VALUES(?,?,?)');
  const nextGroupOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM status_groups WHERE project_id=?');
  const findSubgroup = db.prepare('SELECT id FROM status_subgroups WHERE status_group_id=? AND name=? COLLATE NOCASE');
  const insertSubgroup = db.prepare('INSERT INTO status_subgroups(status_group_id,name,sort_order) VALUES(?,?,?)');
  const nextSubgroupOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM status_subgroups WHERE status_group_id=?');
  const findColumn = db.prepare(`SELECT id FROM status_columns WHERE status_group_id=? AND
    ((status_subgroup_id IS NULL AND ? IS NULL) OR status_subgroup_id=?) AND name='Status' COLLATE NOCASE`);
  const insertColumn = db.prepare(`INSERT INTO status_columns(status_group_id,status_subgroup_id,name,field_type,include_in_progress,sort_order)
    VALUES(?,?,'Status','status',1,0)`);
  const updateItem = db.prepare('UPDATE status_items SET status_group_id=?,status_subgroup_id=? WHERE id=?');
  const insertValue = db.prepare(`INSERT OR IGNORE INTO status_cell_values(status_item_id,column_id,value)
    VALUES(?,?,?)`);
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const groupName = row.category || 'Ogólne';
      let groupId = Number(findGroup.get(row.project_id, groupName)?.id || 0);
      if (!groupId) groupId = Number(insertGroup.run(row.project_id, groupName, nextGroupOrder.get(row.project_id).value).lastInsertRowid);
      let subgroupId = null;
      if (row.subcategory) {
        subgroupId = Number(findSubgroup.get(groupId, row.subcategory)?.id || 0);
        if (!subgroupId) subgroupId = Number(insertSubgroup.run(groupId, row.subcategory, nextSubgroupOrder.get(groupId).value).lastInsertRowid);
      }
      let columnId = Number(findColumn.get(groupId, subgroupId, subgroupId)?.id || 0);
      if (!columnId) columnId = Number(insertColumn.run(groupId, subgroupId).lastInsertRowid);
      updateItem.run(groupId, subgroupId, row.id);
      insertValue.run(row.id, columnId, allowedStatuses.has(row.status) ? row.status : 'Ready to test');
    }
    for (const project of db.prepare(`SELECT id FROM projects ${onlyProjectId ? 'WHERE id=?' : ''}`).all(...(onlyProjectId ? [onlyProjectId] : []))) {
      if (db.prepare('SELECT 1 FROM status_groups WHERE project_id=? LIMIT 1').get(project.id)) continue;
      const groupId = Number(insertGroup.run(project.id, 'Ogólne', 0).lastInsertRowid);
      insertColumn.run(groupId, null);
    }
    if (!onlyProjectId) db.prepare("INSERT INTO app_meta(key,value) VALUES('status_matrix_backfill_v1','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function migrateEntityDependencies(db) {
  db.exec(`INSERT OR IGNORE INTO entity_dependencies(
    project_id,dependent_type,dependent_id,prerequisite_type,prerequisite_id,created_by,created_at
  ) SELECT project_id,'task',task_id,'task',prerequisite_task_id,created_by,created_at FROM task_dependencies`);
}

function removeCommissioningModule(db) {
  const affectedReviews = db.prepare("SELECT DISTINCT review_id FROM monthly_employee_review_items WHERE entity_type='campaign'").all();
  db.prepare("DELETE FROM monthly_employee_review_items WHERE entity_type='campaign'").run();
  for (const { review_id: reviewId } of affectedReviews) {
    const review = db.prepare('SELECT * FROM monthly_employee_reviews WHERE id=?').get(reviewId);
    if (!review) continue;
    const items = db.prepare('SELECT * FROM monthly_employee_review_items WHERE review_id=? AND excluded=0').all(reviewId);
    const weight = items.reduce((sum, item) => sum + Number(item.contribution_share || 0), 0);
    const itemScore = weight ? items.reduce((sum, item) => sum + ((Number(item.difficulty) + Number(item.effort) + Number(item.impact) + Number(item.quality)) / 4) * Number(item.contribution_share || 0), 0) / weight * 20 : 0;
    const dimensionScore = ['delivery_score', 'quality_score', 'timeliness_score', 'communication_score', 'collaboration_score'].reduce((sum, key) => sum + Number(review[key] || 0), 0) / 5 * 20;
    const itemWeight = Number(db.prepare("SELECT value FROM settings WHERE project_id=? AND key='employee_review_item_weight'").get(review.project_id)?.value || 60);
    const dimensionWeight = Number(db.prepare("SELECT value FROM settings WHERE project_id=? AND key='employee_review_dimension_weight'").get(review.project_id)?.value || 40);
    const denominator = (items.length ? itemWeight : 0) + dimensionWeight;
    const overall = denominator ? ((items.length ? itemScore * itemWeight : 0) + dimensionScore * dimensionWeight) / denominator : 0;
    db.prepare('UPDATE monthly_employee_reviews SET overall_score=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(Math.round(overall * 10) / 10, reviewId);
  }
  db.exec(`
    DROP TABLE IF EXISTS test_campaign_items;
    DROP TABLE IF EXISTS test_campaigns;
    DROP TABLE IF EXISTS readiness_gates;
    DROP TABLE IF EXISTS commissioning_templates;
  `);
}

function removeDefinitionOfDone(db) {
  db.exec(`
    DROP TABLE IF EXISTS entity_requirement_status;
  `);
}

function migrateStatusWorkflow(db) {
  ensureColumn(db, 'status_items', 'dependency_override', 'INTEGER NOT NULL DEFAULT 0');
  db.exec(`
    UPDATE status_items SET status='Ready to test' WHERE status='Not started';
    UPDATE status_items SET status='NOK / Retest required' WHERE status IN ('NOK / Rework','Retest required');
  `);
}

function migrateToV15(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS entity_edit_locks (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','goal')),
    entity_id INTEGER NOT NULL,
    locked_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason TEXT NOT NULL,
    locked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY(project_id,entity_type,entity_id)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS idx_entity_edit_locks_project ON entity_edit_locks(project_id,entity_type,entity_id);`);
  const automationSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='automation_rules'").get()?.sql || '';
  if (!automationSql.includes("'in_progress'")) {
    db.exec('PRAGMA foreign_keys=OFF');
    try {
      db.exec(`BEGIN IMMEDIATE;
        CREATE TABLE automation_rules_v15 (
          id INTEGER PRIMARY KEY, project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          name TEXT NOT NULL, trigger_type TEXT NOT NULL CHECK(trigger_type IN ('overdue','due_soon','reminder_due','unassigned','blocked','in_progress')),
          entity_types_json TEXT NOT NULL DEFAULT '[]', days_offset INTEGER NOT NULL DEFAULT 0,
          action_type TEXT NOT NULL CHECK(action_type IN ('notify_assignees','notify_managers','escalate_priority')),
          target_priority TEXT NOT NULL DEFAULT 'High', active INTEGER NOT NULL DEFAULT 1,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL, last_run_at TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id,name)
        ) STRICT;
        INSERT INTO automation_rules_v15 SELECT * FROM automation_rules;
        DROP TABLE automation_rules;
        ALTER TABLE automation_rules_v15 RENAME TO automation_rules;
        CREATE INDEX IF NOT EXISTS idx_automation_rules_project ON automation_rules(project_id,active,trigger_type);
        COMMIT;`);
    } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
    finally { db.exec('PRAGMA foreign_keys=ON'); }
  }
}

function migrateToV16(db) {
  ensureColumn(db, 'automation_rules', 'actions_json', "TEXT NOT NULL DEFAULT '[]'");
}

function migrateToV17(db) {
  ensureColumn(db, 'planner_requirements', 'manual_required_count', 'INTEGER');
  db.exec(`UPDATE planner_requirements
    SET manual_required_count=CASE WHEN note='Automatyczne minimum z sumy podobszarów' THEN 0 ELSE required_count END
    WHERE manual_required_count IS NULL`);
}

function migrateToV18(db) {
  ensureColumn(db, 'tasks', 'recurrence_interval', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'tasks', 'recurrence_unit', "TEXT NOT NULL DEFAULT 'days'");
  ensureColumn(db, 'tasks', 'recurrence_next_task_id', 'INTEGER');
  ensureColumn(db, 'status_groups', 'inherit_from_group_id', 'INTEGER');
  ensureColumn(db, 'status_groups', 'inherit_from_subgroup_id', 'INTEGER');
  ensureColumn(db, 'status_subgroups', 'inherit_from_group_id', 'INTEGER');
  ensureColumn(db, 'status_subgroups', 'inherit_from_subgroup_id', 'INTEGER');
  db.exec("UPDATE tasks SET recurrence_interval=0 WHERE recurrence_interval IS NULL OR recurrence_interval<0");
  db.exec("UPDATE tasks SET recurrence_unit='days' WHERE recurrence_unit NOT IN ('days','weeks','months') OR recurrence_unit IS NULL");
}

function migrateToV19(db) {
  ensureColumn(db, 'calendar_annotations', 'background_color', "TEXT NOT NULL DEFAULT '#dcfce7'");
  ensureColumn(db, 'calendar_annotations', 'text_color', "TEXT NOT NULL DEFAULT '#14532d'");
  ensureColumn(db, 'status_columns', 'description', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'options', 'description', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'project_meetings', 'published_at', 'TEXT');
  ensureColumn(db, 'project_meetings', 'published_announcement_id', 'INTEGER');
  db.prepare("UPDATE status_workflow_states SET icon='●' WHERE system_key='progress' AND icon='◐'").run();
}

function migrateToV20(db) {
  ensureColumn(db, 'project_meeting_items', 'meeting_priority', "TEXT NOT NULL DEFAULT '5'");
  ensureColumn(db, 'project_meeting_items', 'status_changed_by_user_id', 'INTEGER');
  db.exec(`CREATE TABLE IF NOT EXISTS calendar_annotation_scopes (
    annotation_id INTEGER NOT NULL REFERENCES calendar_annotations(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK(scope_type IN ('project','group','controller')),
    scope_id INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(annotation_id,scope_type,scope_id)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS idx_calendar_annotation_scopes ON calendar_annotation_scopes(scope_type,scope_id,annotation_id);
  INSERT OR IGNORE INTO calendar_annotation_scopes(annotation_id,scope_type,scope_id)
    SELECT id,'controller',controller_id FROM calendar_annotations WHERE controller_id IS NOT NULL;
  INSERT OR IGNORE INTO calendar_annotation_scopes(annotation_id,scope_type,scope_id)
    SELECT ca.id,'project',0 FROM calendar_annotations ca
    WHERE NOT EXISTS (SELECT 1 FROM calendar_annotation_scopes cas WHERE cas.annotation_id=ca.id);`);
  const notificationSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='notifications'").get()?.sql || '';
  if (!notificationSql.includes("'meeting'")) {
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE notifications_v20 (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('assignment','announcement','comment','handover','automation','meeting')),
        entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','goal','announcement','handover','meeting')),
        entity_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        read_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) STRICT;
      INSERT INTO notifications_v20(id,project_id,user_id,kind,entity_type,entity_id,title,message,read_at,created_at)
        SELECT id,project_id,user_id,kind,entity_type,entity_id,title,message,read_at,created_at FROM notifications;
      DROP TABLE notifications;
      ALTER TABLE notifications_v20 RENAME TO notifications;
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(project_id,user_id,read_at,created_at DESC);
      COMMIT;
    `);
  }
}

function migrateToV21(db) {
  ensureColumn(db, 'project_meeting_items', 'group_name', "TEXT NOT NULL DEFAULT ''");
  db.exec(`CREATE TABLE IF NOT EXISTS daily_note_section_recipients (
    section_id INTEGER NOT NULL REFERENCES daily_note_sections(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY(section_id,user_id)
  ) STRICT, WITHOUT ROWID;
  CREATE INDEX IF NOT EXISTS idx_daily_note_section_recipients_user ON daily_note_section_recipients(user_id,section_id);`);
  const usedNames = new Set();
  for (const meeting of db.prepare('SELECT id,project_id,title FROM project_meetings ORDER BY project_id,id').all()) {
    const base = String(meeting.title || '').trim() || `Odprawa ${meeting.id}`;
    let title = base; let suffix = 2;
    while (usedNames.has(`${meeting.project_id}:${title.toLocaleLowerCase('pl-PL')}`)) title = `${base} (${suffix++})`;
    usedNames.add(`${meeting.project_id}:${title.toLocaleLowerCase('pl-PL')}`);
    if (title !== meeting.title) db.prepare('UPDATE project_meetings SET title=? WHERE id=?').run(title, meeting.id);
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_project_meetings_unique_title ON project_meetings(project_id,title COLLATE NOCASE)');
  const notificationSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='notifications'").get()?.sql || '';
  if (!notificationSql.includes("'mention'") || !notificationSql.includes("'note'")) {
    db.exec(`
      BEGIN IMMEDIATE;
      CREATE TABLE notifications_v21 (
        id INTEGER PRIMARY KEY,
        project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL CHECK(kind IN ('assignment','announcement','comment','handover','automation','meeting','mention')),
        entity_type TEXT NOT NULL CHECK(entity_type IN ('status','task','point','goal','note','announcement','handover','meeting')),
        entity_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL DEFAULT '',
        read_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) STRICT;
      INSERT INTO notifications_v21(id,project_id,user_id,kind,entity_type,entity_id,title,message,read_at,created_at)
        SELECT id,project_id,user_id,kind,entity_type,entity_id,title,message,read_at,created_at FROM notifications;
      DROP TABLE notifications;
      ALTER TABLE notifications_v21 RENAME TO notifications;
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(project_id,user_id,read_at,created_at DESC);
      COMMIT;
    `);
  }
}

function migrateToV22(db) {
  ensureColumn(db, 'project_meetings', 'published_snapshot_json', "TEXT NOT NULL DEFAULT '{}'");
  db.exec(`UPDATE project_meeting_items SET meeting_priority=CASE meeting_priority
    WHEN 'Critical' THEN '1' WHEN 'High' THEN '3' WHEN 'Medium' THEN '5' WHEN 'Low' THEN '8'
    ELSE CAST(MAX(1,MIN(10,CAST(meeting_priority AS INTEGER))) AS TEXT) END
    WHERE meeting_priority NOT IN ('1','2','3','4','5','6','7','8','9','10')`);
  const publishedMeetings = db.prepare(`SELECT pm.*,creator.display_name created_by_name,closer.display_name closed_by_name
    FROM project_meetings pm LEFT JOIN users creator ON creator.id=pm.created_by LEFT JOIN users closer ON closer.id=pm.closed_by
    WHERE pm.published_at IS NOT NULL AND COALESCE(pm.published_snapshot_json,'{}')='{}'`).all();
  const itemRows = db.prepare('SELECT * FROM project_meeting_items WHERE meeting_id=? ORDER BY sort_order,id');
  const assigneeRows = db.prepare(`SELECT pmia.user_id,u.display_name FROM project_meeting_item_assignees pmia
    JOIN users u ON u.id=pmia.user_id WHERE pmia.meeting_item_id=? ORDER BY u.display_name`);
  const workerRows = db.prepare(`SELECT pmiw.user_id,u.display_name FROM project_meeting_item_workers pmiw
    JOIN users u ON u.id=pmiw.user_id WHERE pmiw.meeting_item_id=? ORDER BY u.display_name`);
  const saveSnapshot = db.prepare('UPDATE project_meetings SET published_snapshot_json=? WHERE id=?');
  publishedMeetings.forEach(meeting => {
    const items = itemRows.all(meeting.id).map(item => {
      const assignees = assigneeRows.all(item.id); const workers = workerRows.all(item.id);
      return { ...item, assignee_user_ids: assignees.map(row => row.user_id), assignee_names: assignees.map(row => row.display_name), worker_user_ids: workers.map(row => row.user_id), worker_names: workers.map(row => row.display_name) };
    });
    const { published_snapshot_json: ignored, ...snapshot } = meeting;
    saveSnapshot.run(JSON.stringify({ ...snapshot, period_from: meeting.period_from || meeting.meeting_date, period_to: meeting.period_to || meeting.meeting_date, items }), meeting.id);
  });
}

function migrateToV23(db) {
  ensureColumn(db, 'project_meeting_items', 'group_key', "TEXT NOT NULL DEFAULT ''");
  db.exec("UPDATE project_meeting_items SET group_key='legacy:'||group_name WHERE group_key='' AND group_name!=''");
}

function migrateToV24(db) {
  ensureColumn(db, 'project_meeting_items', 'review_confirmed', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'options', 'external_dependency_enabled', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'project_memberships', 'can_manage_external_dependencies', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'external_dependencies', 'contact_person', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'external_dependencies', 'contact_email', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'external_dependencies', 'contact_phone', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'external_dependencies', 'configuration_pending', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'external_dependencies', 'auto_created', 'INTEGER NOT NULL DEFAULT 0');
  db.exec(`UPDATE project_meeting_items SET review_confirmed=1
    WHERE review_confirmed=0 AND meeting_id IN (SELECT id FROM project_meetings WHERE status='closed')`);
}

function migrateToV25(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS external_dependency_updates (
    id INTEGER PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    dependency_id INTEGER NOT NULL REFERENCES external_dependencies(id) ON DELETE CASCADE,
    update_type TEXT NOT NULL DEFAULT 'communication' CHECK(update_type IN ('reported','communication')),
    previous_status TEXT NOT NULL DEFAULT '',
    dependency_status TEXT NOT NULL CHECK(dependency_status IN ('waiting','responded')),
    response_context TEXT NOT NULL DEFAULT '',
    response_date TEXT,
    our_response_date TEXT,
    expected_date TEXT,
    next_followup TEXT,
    contact_person TEXT NOT NULL DEFAULT '',
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_external_dependency_updates ON external_dependency_updates(dependency_id,created_at,id);
  UPDATE external_dependencies SET requested_at='' WHERE configuration_pending=1;
  INSERT INTO external_dependency_updates(
    project_id,dependency_id,update_type,previous_status,dependency_status,response_context,response_date,
    our_response_date,expected_date,next_followup,contact_person,created_by,created_at
  )
  SELECT ed.project_id,ed.id,'reported','unreported',
    CASE WHEN ed.dependency_status IN ('responded','resolved') THEN 'responded' ELSE 'waiting' END,
    CASE WHEN TRIM(ed.note)!='' THEN ed.note ELSE 'Stan początkowy zależności przeniesiony do historii komunikacji.' END,
    NULL,ed.requested_at,ed.expected_date,ed.next_followup,ed.contact_person,ed.created_by,ed.created_at
  FROM external_dependencies ed
  WHERE ed.configuration_pending=0
    AND NOT EXISTS (SELECT 1 FROM external_dependency_updates edu WHERE edu.dependency_id=ed.id);`);
}

function migrateSecurityFoundation(db) {
  ensureColumn(db, 'users', 'mfa_secret_cipher', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'users', 'mfa_pending_secret_cipher', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'users', 'mfa_enabled', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'users', 'mfa_recovery_codes_json', "TEXT NOT NULL DEFAULT '[]'");
  db.exec(`CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    username TEXT NOT NULL DEFAULT '',
    event_type TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK(outcome IN ('success','failure','blocked','info')),
    ip_address TEXT NOT NULL DEFAULT '',
    user_agent TEXT NOT NULL DEFAULT '',
    details_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) STRICT;
  CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC,id DESC);
  CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id,created_at DESC,id DESC);`);
}

const globalPlannerSettingKeys = [
  'planner_online_hours', 'planner_offline_hours', 'planner_base_hours', 'planner_weekday_multiplier',
  'planner_saturday_multiplier', 'planner_sunday_holiday_multiplier', 'planner_time_off_debit'
];

function migrateGlobalPlannerData(db) {
  const migrated = db.prepare("SELECT value FROM app_meta WHERE key='global_planner_data_v1'").get()?.value === '1';
  if (!migrated) db.exec(`INSERT OR IGNORE INTO system_holidays(holiday_date,name,created_by,created_at)
      SELECT holiday_date,name,created_by,created_at FROM planner_holidays ORDER BY project_id,id;
      INSERT OR IGNORE INTO system_absences(user_id,absence_date,absence_type,note,created_by,created_at,updated_at)
      SELECT user_id,absence_date,absence_type,note,created_by,created_at,updated_at FROM planner_absences ORDER BY project_id,id;`);
  const insert = db.prepare('INSERT OR IGNORE INTO system_settings(key,value) VALUES(?,?)');
  const defaults = { planner_online_hours: '10.5', planner_offline_hours: '8', planner_base_hours: '8', planner_weekday_multiplier: '1.5', planner_saturday_multiplier: '1.5', planner_sunday_holiday_multiplier: '2', planner_time_off_debit: '8' };
  for (const key of globalPlannerSettingKeys) {
    const value = !migrated ? db.prepare('SELECT value FROM settings WHERE key=? ORDER BY project_id LIMIT 1').get(key)?.value || defaults[key] : defaults[key];
    insert.run(key, value);
  }
  if (!migrated) db.prepare("INSERT INTO app_meta(key,value) VALUES('global_planner_data_v1','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
}

function primaryProjectId(db) {
  const project = db.prepare(`SELECT id FROM projects
    ORDER BY CASE WHEN id=1 THEN 0 WHEN code='W371' COLLATE NOCASE THEN 1 ELSE 2 END,sort_order,id
    LIMIT 1`).get();
  if (!project) throw new Error('Brak projektu bazowego po migracji bazy danych');
  return Number(project.id);
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
  const defaultProjectId = primaryProjectId(db);

  const usersBefore = columnNames(db, 'users');
  ensureColumn(db, 'users', 'system_role', "TEXT NOT NULL DEFAULT 'user'");
  ensureColumn(db, 'users', 'theme', "TEXT NOT NULL DEFAULT 'dark'");
  db.exec("UPDATE users SET theme='dark' WHERE theme IN ('blue','classic') OR trim(COALESCE(theme,''))=''");
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

  for (const table of ['function_groups', 'status_items', 'tasks', 'open_points', 'daily_notes', 'goals']) {
    db.prepare(`UPDATE ${table} SET project_id=COALESCE((SELECT project_id FROM controllers WHERE id=${table}.controller_id),?)`).run(defaultProjectId);
  }

  const users = db.prepare('SELECT id,role FROM users').all();
  const membership = db.prepare('INSERT OR IGNORE INTO project_memberships(project_id,user_id,role,active) VALUES(?,?,?,1)');
  for (const user of users) membership.run(defaultProjectId, user.id, user.role === 'admin' ? 'project_admin' : user.role);
  seedControllerHierarchy(db, defaultProjectId);
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

function migrateToV13(db) {
  ensureColumn(db, 'daily_notes', 'title', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'announcements', 'entry_type', "TEXT NOT NULL DEFAULT 'message'");
  ensureColumn(db, 'announcements', 'rationale', "TEXT NOT NULL DEFAULT ''");
  ensureColumn(db, 'announcements', 'effective_date', 'TEXT');
  ensureColumn(db, 'announcements', 'decision_status', "TEXT NOT NULL DEFAULT 'published'");
  ensureColumn(db, 'completion_requirements', 'requires_evidence', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'completion_requirements', 'requires_second_approval', 'INTEGER NOT NULL DEFAULT 0');

  const insertSection = db.prepare(`INSERT INTO daily_note_sections(project_id,note_id,content,sort_order)
    VALUES(?,?,?,?)`);
  const insertScope = db.prepare(`INSERT OR IGNORE INTO daily_note_section_scopes(section_id,scope_type,scope_id)
    VALUES(?,?,?)`);
  const insertSectionLink = db.prepare(`INSERT OR IGNORE INTO daily_note_section_links(section_id,entity_type,entity_id,sort_order)
    VALUES(?,?,?,?)`);
  for (const note of db.prepare(`SELECT * FROM daily_notes n WHERE NOT EXISTS(
    SELECT 1 FROM daily_note_sections s WHERE s.note_id=n.id) ORDER BY n.id`).all()) {
    const sectionId = Number(insertSection.run(note.project_id, note.id, note.content || 'Przekazanie bez treści', 0).lastInsertRowid);
    if (note.controller_group_id) insertScope.run(sectionId, 'group', note.controller_group_id);
    else if (note.controller_id) insertScope.run(sectionId, 'controller', note.controller_id);
    else insertScope.run(sectionId, 'project', 0);
    const links = db.prepare(`SELECT source_type,source_id,target_type,target_id FROM entity_links
      WHERE project_id=? AND ((source_type='note' AND source_id=?) OR (target_type='note' AND target_id=?)) ORDER BY id`).all(note.project_id, note.id, note.id);
    links.forEach((link, index) => {
      const type = link.source_type === 'note' && Number(link.source_id) === Number(note.id) ? link.target_type : link.source_type;
      const id = link.source_type === 'note' && Number(link.source_id) === Number(note.id) ? link.target_id : link.source_id;
      insertSectionLink.run(sectionId, type, id, index);
    });
    if (!String(note.title || '').trim()) db.prepare("UPDATE daily_notes SET title=CASE WHEN trim(type)!='' THEN type ELSE 'Przekazanie statusu' END WHERE id=?").run(note.id);
  }

  if (db.prepare("SELECT value FROM app_meta WHERE key='v13_handover_to_notes'").get()?.value !== '1') {
    const insertNote = db.prepare(`INSERT INTO daily_notes(project_id,note_date,shift,author,type,title,content,created_by,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?)`);
    for (const handover of db.prepare('SELECT * FROM shift_handovers ORDER BY id').all()) {
      const author = handover.created_by ? db.prepare('SELECT display_name FROM users WHERE id=?').get(handover.created_by)?.display_name || 'System' : 'System';
      const noteId = Number(insertNote.run(handover.project_id, handover.handover_date, handover.from_shift, author, 'Przekazanie statusu', handover.title, handover.summary, handover.created_by, handover.created_at, handover.updated_at).lastInsertRowid);
      const sectionId = Number(insertSection.run(handover.project_id, noteId, handover.summary, 0).lastInsertRowid);
      insertScope.run(sectionId, 'project', 0);
      db.prepare('SELECT * FROM shift_handover_items WHERE handover_id=? ORDER BY sort_order').all(handover.id)
        .forEach((item, index) => insertSectionLink.run(sectionId, item.entity_type, item.entity_id, index));
    }
    db.prepare("INSERT INTO app_meta(key,value) VALUES('v13_handover_to_notes','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
  }

}

function migrateToV14(db) {
  ensureColumn(db, 'daily_note_sections', 'information_type', "TEXT NOT NULL DEFAULT 'Aktualizacja'");
  const setting = db.prepare('INSERT OR IGNORE INTO settings(project_id,key,value) VALUES(?,?,?)');
  for (const project of db.prepare('SELECT id FROM projects').all()) {
    setting.run(project.id, 'employee_review_item_weight', '60');
    setting.run(project.id, 'employee_review_dimension_weight', '40');
  }
  db.exec(`
    UPDATE daily_note_sections
      SET information_type=COALESCE(NULLIF((SELECT n.type FROM daily_notes n WHERE n.id=daily_note_sections.note_id),''),'Aktualizacja')
      WHERE information_type IS NULL OR trim(information_type)='' OR information_type='Aktualizacja';
    UPDATE daily_note_sections
      SET information_type=COALESCE((SELECT o.value FROM options o WHERE o.project_id=daily_note_sections.project_id AND o.kind='note_type' AND o.active=1 ORDER BY o.sort_order,o.id LIMIT 1),'Postęp')
      WHERE NOT EXISTS(SELECT 1 FROM options o WHERE o.project_id=daily_note_sections.project_id AND o.kind='note_type' AND o.active=1 AND o.value=daily_note_sections.information_type);
  `);
  if (db.prepare("SELECT 1 FROM planner_entries WHERE transport_mode='transport_work' LIMIT 1").get()) {
    db.exec(`
      INSERT INTO planner_entries(project_id,user_id,plan_date,shift,controller_group_id,work_mode,transport_mode,note,created_by,created_at,updated_at)
        SELECT project_id,user_id,plan_date,shift,controller_group_id,'online','transport_only',note,created_by,created_at,updated_at
        FROM planner_entries WHERE transport_mode='transport_work';
      UPDATE planner_entries SET transport_mode='none' WHERE transport_mode='transport_work';
    `);
  }
  db.prepare("INSERT INTO app_meta(key,value) VALUES('v14_planner_activity_split','1') ON CONFLICT(key) DO UPDATE SET value='1'").run();
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

function removeEmptyDuplicateControllerRoots(db) {
  // The old startup seeder created empty root copies because NULL bypasses UNIQUE.
  // Never delete a group with children, assignments, or other linked records.
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  const references = tables.flatMap(({ name }) => db.prepare(`PRAGMA foreign_key_list("${name}")`).all()
    .filter(key => key.table === 'controller_groups')
    .map(key => ({ table: name, column: key.from })));
  const roots = db.prepare('SELECT * FROM controller_groups WHERE parent_id IS NULL ORDER BY id').all();
  const seen = new Set();
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const root of roots) {
      const key = `${root.project_id}:${root.name.toLowerCase()}`;
      if (!seen.has(key)) { seen.add(key); continue; }
      if (root.description || references.some(ref => db.prepare(`SELECT 1 FROM "${ref.table}" WHERE "${ref.column}"=? LIMIT 1`).get(root.id))) continue;
      const scoped = tables.some(({ name }) => {
        const columns = columnNames(db, name);
        return columns.has('scope_type') && columns.has('scope_id') && db.prepare(`SELECT 1 FROM "${name}" WHERE scope_type='group' AND scope_id=? LIMIT 1`).get(root.id);
      });
      if (scoped) continue;
      db.prepare('DELETE FROM controller_groups WHERE id=?').run(root.id);
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
}

function seedControllerHierarchy(db, projectId) {
  const controllers = db.prepare('SELECT * FROM controllers WHERE project_id=? ORDER BY sort_order,id').all(projectId);
  const insert = db.prepare('INSERT OR IGNORE INTO controller_groups(project_id,parent_id,name,sort_order) VALUES(?,?,?,?)');
  const updateController = db.prepare('UPDATE controllers SET group_id=? WHERE id=?');
  const rootOrders = new Map();
  for (const item of controllers) {
    if (item.group_id) continue;
    const rootName = (item.code.match(/^[A-Za-z]+/)?.[0] || item.area || 'Inne').toUpperCase();
    if (!rootOrders.has(rootName)) rootOrders.set(rootName, rootOrders.size);
    let root = db.prepare('SELECT id FROM controller_groups WHERE project_id=? AND parent_id IS NULL AND name=? COLLATE NOCASE ORDER BY id LIMIT 1').get(projectId, rootName);
    // SQLite UNIQUE constraints allow repeated NULL parent IDs.
    if (!root) {
      insert.run(projectId, null, rootName, rootOrders.get(rootName));
      root = db.prepare('SELECT id FROM controller_groups WHERE project_id=? AND parent_id IS NULL AND name=? COLLATE NOCASE ORDER BY id LIMIT 1').get(projectId, rootName);
    }
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
  ['Rozpoczęcie', 'Kontynuacja', 'Ukończenie'].forEach((value, index) => option.run(projectId, 'meeting_goal', value, index));
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
    const username = clean(process.env.APP_USER) || 'admin';
    const password = String(process.env.APP_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'change-me'));
    if (username.length > 100) throw new Error('APP_USER może mieć maksymalnie 100 znaków');
    if (!password) throw new Error('APP_PASSWORD jest wymagane przy pierwszym uruchomieniu produkcyjnym');
    if (!validPassword(password)) throw new Error('APP_PASSWORD musi mieć od 8 do 256 znaków');
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
    const status = ['Ready to test','In progress','Ready to test','Done','Done','Blocked'][index % 6];
    const result = addStatus.run(project.id, controllerRow.id, `W520-${controllerRow.code}-${String(index + 1).padStart(3,'0')}`, `${String((index % 12) + 1).padStart(3,'0')}VR_001`, `Weryfikacja ${subcategory}`, category, subcategory, PRIORITY_VALUES[index % PRIORITY_VALUES.length], owner.display_name, owner.id, status, 'Dane testowe drugiego projektu.', owner.id);
    if (result.changes) statusIds.push(Number(result.lastInsertRowid));
  }

  const taskIds = [];
  const addTask = db.prepare(`INSERT INTO tasks(project_id,controller_id,title,description,station,priority,owner,owner_user_id,status,start_date,due_date,category,subcategory,created_by)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (let index = 0; index < 35; index += 1) {
    const controllerRow = controllers[(index + 2) % controllers.length];
    const owner = activeUsers[(index + 3) % activeUsers.length];
    const result = addTask.run(project.id, controllerRow.id, `W520 · zadanie ${String(index + 1).padStart(2,'0')} · ${controllerRow.code}`, 'Zadanie demonstracyjne drugiego projektu.', `${String((index % 12) + 1).padStart(3,'0')}VR_001`, PRIORITY_VALUES[index % 3], owner.display_name, owner.id, ['To do','In progress','Done'][index % 3], date(-(index % 10)), date((index % 21) - 5), ['Commissioning','Programming','Testing'][index % 3], ['Field verification','PLC changes','Sequence tests'][index % 3], owner.id);
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
  const insert = db.prepare(`INSERT OR IGNORE INTO project_memberships(project_id,user_id,role,active,planner_enabled,assignable)
    VALUES(?,?,?,?,?,?)`);
  for (const user of users) {
    const isSystemAdmin = user.system_role === 'system_admin' || user.role === 'admin';
    for (const project of projects) insert.run(
      project.id, user.id, isSystemAdmin ? 'project_admin' : ['moderator', 'user'].includes(user.role) ? user.role : 'user',
      isSystemAdmin ? 1 : 0, isSystemAdmin ? 1 : 0, isSystemAdmin ? 1 : 0
    );
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
  const distinctTaskCategories = db.prepare("SELECT DISTINCT project_id,category FROM tasks WHERE category!=''").all();
  const add = db.prepare('INSERT OR IGNORE INTO task_categories(project_id,name,sort_order) VALUES(?,?,?)');
  for (const row of distinctTaskCategories) {
    const nextOrder = db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM task_categories WHERE project_id=?').get(row.project_id).value;
    add.run(row.project_id, row.category, nextOrder);
  }

  const taskPairs = db.prepare("SELECT DISTINCT project_id,category,subcategory FROM tasks WHERE category!='' AND subcategory!=''").all();
  const addSubcategory = db.prepare('INSERT OR IGNORE INTO task_subcategories(category_id,name,sort_order) VALUES(?,?,?)');
  for (const pair of taskPairs) {
    const category = db.prepare('SELECT id FROM task_categories WHERE project_id=? AND name=? COLLATE NOCASE').get(pair.project_id, pair.category);
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

function seedMigrationAudit(db, defaultProjectId) {
  for (const [type, table] of Object.entries(TABLES)) {
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    const insertAudit = db.prepare('INSERT INTO audit_log(project_id,entity_type,entity_id,action,user_id,changes_json,snapshot_json) VALUES(?,?,?,?,?,?,?)');
    for (const row of rows) {
      const existing = db.prepare('SELECT 1 FROM audit_log WHERE entity_type=? AND entity_id=? LIMIT 1').get(type, row.id);
      if (!existing) insertAudit.run(row.project_id || defaultProjectId, type, row.id, 'migrate', null, JSON.stringify({ migrated: { from: null, to: 'bieżący schemat' } }), JSON.stringify(row));
    }
  }
}

export {
  columnNames,
  ensureStatusWorkflowStates,
  migrateStatusMatrix,
  migrateEntityDependencies,
  migrateStatusWorkflow,
  globalPlannerSettingKeys,
  refreshControllerCodesForProject,
  seedConfiguration,
  syncProjectMemberships,
  canonicalLink
};
