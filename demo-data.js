import { randomBytes } from 'node:crypto';

const DEMO_TARGET_KEY = 'demo_dataset_v1_target';

const controllerDefinitions = [
  ['HB522', 'HB', 'Linia nadwozia – strefa główna'],
  ['UB512', 'UB', 'Linia podwozia – transport i pozycjonowanie'],
  ['RB310', 'Robot Cell', 'Cele robotowe i interfejsy bezpieczeństwa'],
  ['FM401', 'Framing', 'Stacja framingu i geometria nadwozia'],
  ['CV220', 'Conveyor', 'Transport międzyoperacyjny i bufory'],
  ['SAF100', 'Safety', 'Sterownik nadrzędny instalacji safety']
];

const userDefinitions = [
  ['demo.anna', 'Anna Kowalska'],
  ['demo.bartosz', 'Bartosz Nowak'],
  ['demo.celina', 'Celina Wiśniewska'],
  ['demo.daniel', 'Daniel Wójcik'],
  ['demo.ewa', 'Ewa Kamińska'],
  ['demo.filip', 'Filip Lewandowski'],
  ['demo.gabriela', 'Gabriela Zielińska'],
  ['demo.hubert', 'Hubert Szymański'],
  ['demo.iwona', 'Iwona Dąbrowska']
];

const statusPairs = [
  ['Hardware', '+24V Connection'],
  ['Hardware', 'Profinet connection'],
  ['Hardware', 'Commissioning status'],
  ['Manual mode', 'Manual drives'],
  ['Manual mode', 'Local panels'],
  ['Automatic mode', 'Sequence test'],
  ['Automatic mode', 'Cycle with part'],
  ['Startup devices', 'Device green'],
  ['Startup devices', 'Diagnostic status'],
  ['Startup drives', 'Drive enable'],
  ['Startup drives', 'Referencing'],
  ['Safety', 'Emergency stop'],
  ['Safety', 'Doors and gates'],
  ['NiO', 'Error handling'],
  ['Special functions', 'Interfaces'],
  ['Counters / KPI', 'Cycle time']
];

const taskPairs = [
  ['Commissioning', 'Field verification'],
  ['Commissioning', 'Device startup'],
  ['Programming', 'PLC changes'],
  ['Programming', 'HMI changes'],
  ['Testing', 'Interface tests'],
  ['Testing', 'Sequence tests'],
  ['Documentation', 'As-built'],
  ['Documentation', 'Test report'],
  ['Coordination', 'Supplier action'],
  ['Coordination', 'Production alignment']
];

const statusFunctions = [
  'Sprawdzenie zasilania 24 V urządzeń',
  'Weryfikacja komunikacji Profinet',
  'Test sygnałów wejściowych i wyjściowych',
  'Uruchomienie napędów w trybie ręcznym',
  'Sprawdzenie panelu operatorskiego',
  'Test sekwencji automatycznej bez detalu',
  'Test cyklu automatycznego z detalem',
  'Walidacja łańcucha bezpieczeństwa',
  'Sprawdzenie diagnostyki urządzeń',
  'Test obsługi błędów i restartu',
  'Pomiar czasu cyklu',
  'Weryfikacja interfejsu z robotem'
];

const taskTitles = [
  'Dokończyć test komunikacji urządzeń',
  'Przygotować poprawkę programu PLC',
  'Zweryfikować sekwencję automatyczną',
  'Uzupełnić opis diagnostyki HMI',
  'Wykonać test interfejsu z robotem',
  'Sprawdzić warunki startowe napędów',
  'Przygotować raport z testu',
  'Potwierdzić sygnały z dostawcą',
  'Zamknąć uwagi z odbioru',
  'Zoptymalizować czas cyklu'
];

const pointTitles = [
  'Brak potwierdzenia gotowości urządzenia',
  'Niestabilna komunikacja z robotem',
  'Niekompletna dokumentacja elektryczna',
  'Błąd sekwencji po restarcie',
  'Oczekiwanie na poprawkę dostawcy',
  'Przekroczony czas cyklu',
  'Brak detalu do testów automatycznych',
  'Nieprawidłowa diagnostyka na HMI',
  'Rozbieżność sygnałów safety',
  'Wymagane potwierdzenie produkcji'
];

const noteTexts = [
  'Wykonano testy funkcjonalne. Wyniki zapisano w powiązanych punktach, a pozostałe uwagi przekazano osobom odpowiedzialnym.',
  'Podczas zmiany sprawdzono komunikację i sygnały procesowe. Jeden punkt wymaga ponownej weryfikacji po aktualizacji programu.',
  'Zespół przeprowadził test automatyczny z detalem. Sekwencja działa stabilnie, pozostaje pomiar czasu cyklu.',
  'Omówiono otwarte tematy z dostawcą. Ustalono właścicieli oraz terminy kolejnych działań.',
  'Wprowadzono poprawki diagnostyki HMI i potwierdzono ich działanie na stanowisku.',
  'Test został wstrzymany z powodu braku warunków produkcyjnych. Utworzono otwarty punkt i ustawiono przypomnienie.',
  'Zakończono kontrolę urządzeń w trybie ręcznym. Nie stwierdzono nowych blokad.',
  'Przeanalizowano błędy z ostatniego cyklu. Przygotowano zadanie programistyczne i plan retestu.'
];

const asDate = (daysFromToday = 0) => {
  const value = new Date();
  value.setUTCHours(12, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + daysFromToday);
  return value.toISOString().slice(0, 10);
};

const asTimestamp = (daysFromToday = 0, hour = 8) => {
  const value = new Date();
  value.setUTCHours(hour, 0, 0, 0);
  value.setUTCDate(value.getUTCDate() + daysFromToday);
  return value.toISOString().replace('T', ' ').slice(0, 19);
};

const count = (db, table) => Number(db.prepare(`SELECT COUNT(*) value FROM ${table}`).get().value);
const cycle = (items, index) => items[index % items.length];

function ensureControllers(db) {
  let nextOrder = Number(db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM controllers').get().value);
  const insert = db.prepare('INSERT OR IGNORE INTO controllers(code,area,description,sort_order) VALUES(?,?,?,?)');
  for (const definition of controllerDefinitions) {
    const result = insert.run(...definition, nextOrder);
    if (result.changes) nextOrder += 1;
  }
  return controllerDefinitions.map(([code]) => db.prepare('SELECT * FROM controllers WHERE code=?').get(code));
}

function ensureUsers(db, hashPassword) {
  let nextOrder = Number(db.prepare('SELECT COALESCE(MAX(sort_order),-1)+1 value FROM users').get().value);
  const insert = db.prepare('INSERT OR IGNORE INTO users(username,display_name,password_hash,role,active,sort_order) VALUES(?,?,?,?,1,?)');
  for (const [username, displayName] of userDefinitions) {
    const password = randomBytes(32).toString('hex');
    const result = insert.run(username, displayName, hashPassword(password), 'user', nextOrder);
    if (result.changes) nextOrder += 1;
  }
  return db.prepare('SELECT id,display_name FROM users WHERE active=1 ORDER BY sort_order,id').all();
}

function addMention(db, type, entityId, userId) {
  if (!userId) return;
  db.prepare('INSERT OR IGNORE INTO entity_mentions(entity_type,entity_id,user_id) VALUES(?,?,?)').run(type, entityId, userId);
}

function demoSnapshot(db, type, table, id) {
  const snapshot = db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);
  if (!snapshot) return null;
  if (type === 'task') snapshot.checklist = db.prepare('SELECT text,done,sort_order FROM task_checklist WHERE task_id=? ORDER BY sort_order,id').all(id);
  if (type === 'goal') snapshot.links = db.prepare('SELECT entity_type,entity_id FROM goal_links WHERE goal_id=? ORDER BY entity_type,entity_id').all(id);
  if (['status', 'task', 'point', 'note'].includes(type)) {
    snapshot.mentioned_user_ids = db.prepare('SELECT user_id FROM entity_mentions WHERE entity_type=? AND entity_id=? ORDER BY user_id').all(type, id).map(row => row.user_id);
  }
  return snapshot;
}

function addCreateAudit(db, type, table, id, userId) {
  const snapshot = demoSnapshot(db, type, table, id);
  db.prepare(`INSERT INTO audit_log(entity_type,entity_id,action,user_id,changed_at,changes_json,snapshot_json)
    VALUES(?,?,?,?,?,?,?)`).run(
      type, id, 'create', userId || null, snapshot.created_at || asTimestamp(), JSON.stringify({ created: { from: null, to: true } }), JSON.stringify(snapshot)
    );
}

function seedStatuses(db, target, controllers, users) {
  const missing = Math.max(0, target - count(db, 'status_items'));
  const insert = db.prepare(`INSERT OR IGNORE INTO status_items
    (controller_id,test_id,station,function_detail,category,subcategory,milestone,criticality,responsible,responsible_user_id,status,checked_by,checked_on,environment,current_note,evidence_link,created_by,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  let added = 0;
  let index = 0;
  while (added < missing) {
    const controller = cycle(controllers, index);
    const owner = cycle(users, index + 2);
    const creator = cycle(users, index + 5);
    const [category, subcategory] = cycle(statusPairs, index);
    const statusBand = index % 20;
    const status = statusBand < 6 ? 'Done' : statusBand < 10 ? 'In progress' : statusBand < 13 ? 'Ready to test' : statusBand < 16 ? 'Not started' : statusBand < 18 ? 'Blocked' : statusBand === 18 ? 'NOK / Rework' : 'Retest required';
    const testId = `DEMO-${controller.code}-${String(index + 1).padStart(3, '0')}`;
    const createdAt = asTimestamp(-(index % 42), 6 + (index % 12));
    const result = insert.run(
      controller.id, testId, `${String((index % 24) + 1).padStart(3, '0')}ABS${String((index % 8) + 1).padStart(3, '0')}`,
      cycle(statusFunctions, index), category, subcategory, `M${(index % 5) + 1}`, cycle(['Low', 'Medium', 'High', 'Critical'], index),
      owner.display_name, owner.id, status, status === 'Done' ? owner.display_name : '', status === 'Done' ? asDate(-(index % 14)) : null,
      cycle(['Factory', 'Simulation', 'Production'], index), status === 'Blocked' ? 'Test oczekuje na usunięcie blokady.' : 'Dane demonstracyjne do weryfikacji widoków.',
      `https://example.invalid/demo/status/${testId}`, creator.id, createdAt, asTimestamp(-(index % 12), 8 + (index % 8))
    );
    if (result.changes) {
      const id = Number(result.lastInsertRowid);
      if (index % 4 === 0) addMention(db, 'status', id, cycle(users, index + 4).id);
      addCreateAudit(db, 'status', 'status_items', id, creator.id);
      added += 1;
    }
    index += 1;
  }
}

function seedTasks(db, target, controllers, users, statusIds) {
  const missing = Math.max(0, target - count(db, 'tasks'));
  const insert = db.prepare(`INSERT INTO tasks
    (controller_id,title,description,station,priority,owner,owner_user_id,status,start_date,due_date,category,subcategory,info_link,linked_entity_type,linked_entity_id,created_by,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const checklist = db.prepare('INSERT INTO task_checklist(task_id,text,done,sort_order) VALUES(?,?,?,?)');
  const created = [];
  for (let index = 0; index < missing; index += 1) {
    const controller = cycle(controllers, index + 1);
    const creator = cycle(users, index + 3);
    const assigned = index % 8 === 0 ? null : cycle(users, index + 1);
    const statusBand = index % 10;
    const status = statusBand < 4 ? 'To do' : statusBand < 7 ? 'In progress' : 'Done';
    const [category, subcategory] = cycle(taskPairs, index);
    const createdAt = asTimestamp(-(index % 46), 7 + (index % 10));
    const result = insert.run(
      controller.id, `${cycle(taskTitles, index)} – ${controller.code} / ${String(index + 1).padStart(3, '0')}`,
      'Przykładowe zadanie wygenerowane do testowania tablicy, listy, filtrów, odpowiedzialności i terminów.',
      `${String((index % 24) + 1).padStart(3, '0')}ABS${String((index % 8) + 1).padStart(3, '0')}`,
      cycle(['Low', 'Medium', 'High', 'Critical'], index + 1), assigned?.display_name || '', assigned?.id || null, status,
      asDate(-((index % 25) + 1)), index % 6 === 0 ? null : asDate((index % 45) - 12), category, subcategory,
      `https://example.invalid/demo/task/${index + 1}`, 'status', cycle(statusIds, index), creator.id, createdAt, asTimestamp(-(index % 9), 9 + (index % 7))
    );
    const id = Number(result.lastInsertRowid);
    const doneCount = status === 'Done' ? 3 : status === 'In progress' ? 1 : 0;
    ['Potwierdzić warunki wstępne', 'Wykonać test funkcjonalny', 'Dołączyć wynik lub dowód'].forEach((text, order) => checklist.run(id, text, order < doneCount ? 1 : 0, order));
    if (index % 4 === 0) addMention(db, 'task', id, cycle(users, index + 6).id);
    created.push({ id, creatorId: creator.id, index });
  }
  return created;
}

function seedPoints(db, target, controllers, users, statusIds) {
  const missing = Math.max(0, target - count(db, 'open_points'));
  const insert = db.prepare(`INSERT OR IGNORE INTO open_points
    (controller_id,issue_id,title,description,impact,priority,owner,owner_user_id,status,waiting_for,next_action,start_date,due_date,reminder_date,category,subcategory,info_link,linked_entity_type,linked_entity_id,created_by,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const created = [];
  let added = 0;
  let index = 0;
  while (added < missing) {
    const controller = cycle(controllers, index + 2);
    const owner = cycle(users, index + 4);
    const creator = cycle(users, index + 7);
    const statusBand = index % 20;
    const status = statusBand < 7 ? 'Open' : statusBand < 13 ? 'Waiting' : statusBand < 17 ? 'In progress' : 'Closed';
    const [category, subcategory] = cycle(statusPairs, index + 3);
    const issueId = `DEMO-OP-${String(index + 1).padStart(3, '0')}`;
    const createdAt = asTimestamp(-(index % 48), 6 + (index % 11));
    const result = insert.run(
      controller.id, issueId, `${cycle(pointTitles, index)} – ${controller.code}`,
      'Przykładowy otwarty punkt do testowania filtrów, przypomnień, powiązań i odpowiedzialności.',
      status === 'Closed' ? 'Temat rozwiązany.' : cycle(['Blokuje automat.', 'Wpływa na odbiór.', 'Nie blokuje dalszych testów.'], index),
      cycle(['Low', 'Medium', 'High', 'Critical'], index + 2), owner.display_name, owner.id, status,
      cycle(['PLC', 'Robot', 'Electrical', 'Mechanical', 'Process', 'Production'], index),
      cycle(['Wykonać retest.', 'Potwierdzić termin z dostawcą.', 'Zweryfikować sygnały na obiekcie.'], index),
      asDate(-((index % 20) + 1)), index % 5 === 0 ? null : asDate((index % 38) - 6), asDate((index % 29) - 14),
      category, subcategory, `https://example.invalid/demo/point/${issueId}`, 'status', cycle(statusIds, index + 5),
      creator.id, createdAt, asTimestamp(-(index % 10), 8 + (index % 8))
    );
    if (result.changes) {
      const id = Number(result.lastInsertRowid);
      if (index % 3 === 0) addMention(db, 'point', id, cycle(users, index + 1).id);
      created.push({ id, creatorId: creator.id, index });
      added += 1;
    }
    index += 1;
  }
  return created;
}

function seedNotes(db, target, controllers, users, taskIds, statusIds, pointIds) {
  const missing = Math.max(0, target - count(db, 'daily_notes'));
  const insert = db.prepare(`INSERT INTO daily_notes
    (controller_id,note_date,shift,author,type,content,created_by,linked_task_id,linked_status_id,linked_point_id,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);
  const created = [];
  for (let index = 0; index < missing; index += 1) {
    const controller = cycle(controllers, index);
    const author = cycle(users, index + 2);
    const daysAgo = -(index % 42);
    const result = insert.run(
      controller.id, asDate(daysAgo), cycle(['Dzień', 'Noc', 'Ogólne'], index), author.display_name,
      cycle(['Postęp', 'Problem', 'Decyzja', 'Plan'], index), `${cycle(noteTexts, index)} [${controller.code} / wpis ${index + 1}]`,
      author.id, index % 2 === 0 ? cycle(taskIds, index) : null, index % 3 === 0 ? cycle(statusIds, index + 3) : null,
      index % 4 === 0 ? cycle(pointIds, index + 5) : null, asTimestamp(daysAgo, 6 + (index % 14)), asTimestamp(daysAgo, 7 + (index % 14))
    );
    const id = Number(result.lastInsertRowid);
    if (index % 3 === 0) addMention(db, 'note', id, cycle(users, index + 5).id);
    addCreateAudit(db, 'note', 'daily_notes', id, author.id);
    created.push(id);
  }
  return created;
}

function finishTaskAndPointLinks(db, tasks, points, noteIds, pointIds) {
  const updateTask = db.prepare('UPDATE tasks SET linked_entity_type=?,linked_entity_id=? WHERE id=?');
  for (const task of tasks) {
    if (task.index % 10 === 0) updateTask.run('note', cycle(noteIds, task.index), task.id);
    else if (task.index % 7 === 0) updateTask.run('point', cycle(pointIds, task.index), task.id);
    addCreateAudit(db, 'task', 'tasks', task.id, task.creatorId);
  }

  const updatePoint = db.prepare("UPDATE open_points SET linked_entity_type='point',linked_entity_id=? WHERE id=?");
  for (const point of points) {
    if (point.index > 0 && point.index % 8 === 0) updatePoint.run(cycle(pointIds, point.index - 1), point.id);
    addCreateAudit(db, 'point', 'open_points', point.id, point.creatorId);
  }
}

function seedGoals(db, target, controllers, users, statusIds, taskIds, pointIds) {
  const goalTarget = Math.min(20, target);
  const missing = Math.max(0, goalTarget - count(db, 'goals'));
  const insertGoal = db.prepare(`INSERT INTO goals(controller_id,title,description,status,due_date,created_by,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?)`);
  const insertLink = db.prepare('INSERT OR IGNORE INTO goal_links(goal_id,entity_type,entity_id) VALUES(?,?,?)');
  for (let index = 0; index < missing; index += 1) {
    const controller = cycle(controllers, index);
    const creator = cycle(users, index + 1);
    const createdAt = asTimestamp(-(index % 28), 8 + (index % 8));
    const result = insertGoal.run(
      controller.id, `${controller.code}: ${cycle(['gotowość do automatu', 'odbiór wewnętrzny', 'zamknięcie testów safety', 'próba produkcyjna'], index)}`,
      'Cel demonstracyjny łączący wymagane punkty statusu, zadania i otwarte punkty.',
      cycle(['Open', 'In progress', 'Done'], index), asDate((index % 35) + 2), creator.id, createdAt, asTimestamp(-(index % 5), 9 + (index % 7))
    );
    const id = Number(result.lastInsertRowid);
    insertLink.run(id, 'status', cycle(statusIds, index * 3));
    insertLink.run(id, 'task', cycle(taskIds, index * 3 + 1));
    insertLink.run(id, 'point', cycle(pointIds, index * 3 + 2));
    addCreateAudit(db, 'goal', 'goals', id, creator.id);
  }
}

function datasetCounts(db) {
  return {
    status: count(db, 'status_items'),
    tasks: count(db, 'tasks'),
    points: count(db, 'open_points'),
    notes: count(db, 'daily_notes'),
    goals: count(db, 'goals'),
    controllers: count(db, 'controllers'),
    users: count(db, 'users')
  };
}

export function seedDemoData(db, hashPassword, requestedTarget = 100) {
  const target = Math.max(1, Math.min(100, Number(requestedTarget) || 100));
  const previousTarget = Number(db.prepare('SELECT value FROM app_meta WHERE key=?').get(DEMO_TARGET_KEY)?.value || 0);
  if (previousTarget >= target) return datasetCounts(db);

  db.exec('BEGIN IMMEDIATE');
  try {
    const controllers = ensureControllers(db);
    const users = ensureUsers(db, hashPassword);
    seedStatuses(db, target, controllers, users);
    const statusIds = db.prepare('SELECT id FROM status_items ORDER BY id').all().map(row => row.id);
    const newTasks = seedTasks(db, target, controllers, users, statusIds);
    const taskIds = db.prepare('SELECT id FROM tasks ORDER BY id').all().map(row => row.id);
    const newPoints = seedPoints(db, target, controllers, users, statusIds);
    const pointIds = db.prepare('SELECT id FROM open_points ORDER BY id').all().map(row => row.id);
    seedNotes(db, target, controllers, users, taskIds, statusIds, pointIds);
    const noteIds = db.prepare('SELECT id FROM daily_notes ORDER BY id').all().map(row => row.id);
    finishTaskAndPointLinks(db, newTasks, newPoints, noteIds, pointIds);
    seedGoals(db, target, controllers, users, statusIds, taskIds, pointIds);
    db.prepare('INSERT INTO app_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(DEMO_TARGET_KEY, String(target));
    db.exec('COMMIT');
    return datasetCounts(db);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
