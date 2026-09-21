import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));

function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function clean(value, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function nullableDate(value) {
  const text = clean(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

export function openDatabase(databasePath) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath, { timeout: 5000 });
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  db.exec(readFileSync(join(moduleDir, 'schema.sql'), 'utf8'));
  seedDatabase(db);
  return createRepository(db);
}

function seedDatabase(db) {
  const row = db.prepare('SELECT COUNT(*) AS count FROM controllers').get();
  if (row.count > 0) return;

  db.exec('BEGIN IMMEDIATE');
  try {
    const insertController = db.prepare('INSERT INTO controllers (code, area, description) VALUES (?, ?, ?)');
    insertController.run('HB522', 'Body Shop', 'Main body line controller');
    insertController.run('UB512', 'Body Shop', 'Underbody line controller');

    const controllerId = code => db.prepare('SELECT id FROM controllers WHERE code = ?').get(code).id;
    const hb = controllerId('HB522');
    const ub = controllerId('UB512');
    const insertStatus = db.prepare(`
      INSERT INTO status_items
      (controller_id, test_id, station, function_detail, category, milestone, criticality, responsible, status, current_note, checked_by, checked_on)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const statusRows = [
      [hb, 'HB522-014', 'ST522.30', 'Clamp sequence', 'Safety & sequence', 'M2', 'High', 'M. Nowak', 'In progress', 'Czekamy na potwierdzenie sygnału z robota.', '', null],
      [hb, 'HB522-018', 'ST522.30', 'Robot home position', 'Robot interface', 'M2', 'Critical', 'A. Zieliński', 'Blocked', 'Brak sygnału RobotAtHome z R522.3.', '', null],
      [hb, 'HB522-021', 'ST522.40', 'Door interlock', 'Safety', 'M2', 'High', 'K. Wójcik', 'Ready to test', 'Warunki przygotowane. Wymagany test z produkcją.', '', null],
      [hb, 'HB522-027', 'ST522.50', 'Part present sensors', 'I/O test', 'M1', 'Medium', 'M. Nowak', 'Done', 'Wszystkie warianty OK.', 'M. Nowak', isoDate(-1)],
      [hb, 'HB522-031', 'ST522.60', 'Cycle without part', 'Automatic cycle', 'M3', 'High', 'P. Lis', 'Ready to test', 'Do wykonania po zwolnieniu stacji.', '', null],
      [hb, 'HB522-036', 'ST522.70', 'HMI alarm diagnostics', 'Diagnostics', 'M2', 'Medium', 'P. Lis', 'Done', 'Alarmy napędów i safety sprawdzone.', 'P. Lis', isoDate(-2)],
      [ub, 'UB512-006', 'ST512.10', 'Conveyor handshake', 'Interface', 'M2', 'Critical', 'P. Lis', 'Blocked', 'Brak potwierdzenia z nadrzędnego PLC.', '', null],
      [ub, 'UB512-011', 'ST512.20', 'Lift positions', 'Drives', 'M2', 'High', 'K. Wójcik', 'In progress', 'Pozycja robocza OK, serwisowa do korekty.', '', null],
      [ub, 'UB512-016', 'ST512.20', 'Emergency stop chain', 'Safety', 'M1', 'Critical', 'A. Zieliński', 'Done', 'Test wspólny zakończony.', 'A. Zieliński', isoDate(-1)],
      [ub, 'UB512-022', 'ST512.30', 'Model selection', 'Variants', 'M2', 'Medium', 'M. Nowak', 'Ready to test', 'Warianty A i B przygotowane.', '', null],
      [ub, 'UB512-025', 'ST512.40', 'Fault reset sequence', 'Diagnostics', 'M2', 'High', 'P. Lis', 'NOK / Rework', 'Niespójny reset napędu po E-Stop.', '', null],
      [ub, 'UB512-029', 'ST512.50', 'Automatic dry cycle', 'Automatic cycle', 'M3', 'High', 'K. Wójcik', 'Not started', 'Oczekuje na zakończenie testów safety.', '', null]
    ];
    statusRows.forEach(rowData => insertStatus.run(...rowData));

    const insertTask = db.prepare(`
      INSERT INTO tasks (controller_id, title, description, station, priority, owner, status, due_date, linked_test_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    [
      [hb, 'Zweryfikować telegram Profinet', 'Potwierdzić mapowanie sygnałów z robotem.', 'ST522.30', 'Critical', 'M. Nowak', 'To do', isoDate(0), 'HB522-018'],
      [hb, 'Dodać diagnostykę clampów', 'Uzupełnić alarmy i teksty HMI.', 'ST522.30', 'Medium', 'P. Lis', 'To do', isoDate(2), 'HB522-014'],
      [hb, 'Test resetu po E-Stop', 'Wspólny test z Electrical.', 'ST522.40', 'High', 'K. Wójcik', 'In progress', isoDate(1), 'HB522-021'],
      [hb, 'Backup PLC i HMI', 'Wersja bazowa po M1.', 'HB522', 'Low', 'P. Lis', 'Done', isoDate(-1), null],
      [ub, 'Korekta pozycji serwisowej', 'Dostroić pozycję windy.', 'ST512.20', 'High', 'K. Wójcik', 'In progress', isoDate(1), 'UB512-011'],
      [ub, 'Sprawdzić reset napędu', 'Odtworzyć problem po E-Stop.', 'ST512.40', 'Critical', 'P. Lis', 'To do', isoDate(0), 'UB512-025'],
      [ub, 'Test wyboru modelu B', 'Potwierdzić receptę i traceability.', 'ST512.30', 'Medium', 'M. Nowak', 'To do', isoDate(3), 'UB512-022']
    ].forEach(rowData => insertTask.run(...rowData));

    const insertPoint = db.prepare(`
      INSERT INTO open_points
      (controller_id, issue_id, title, description, impact, priority, owner, status, waiting_for, next_action, due_date, linked_test_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    [
      [hb, 'OP-017', 'Brak sygnału RobotAtHome z R522.3', 'Sygnał nie pojawia się w telegramie robota.', 'Brak możliwości testu automatycznego.', 'Critical', 'A. Zieliński', 'Waiting', 'Robot Team', 'Zweryfikować mapowanie telegramu.', isoDate(-1), 'HB522-018'],
      [hb, 'OP-019', 'Brak finalnej listy alarmów HMI', 'Lista nie zawiera alarmów wszystkich napędów.', 'Diagnostyka operatora niekompletna.', 'Medium', 'P. Lis', 'Open', 'Automation', 'Uzupełnić i zatwierdzić teksty.', isoDate(2), null],
      [hb, 'OP-021', 'Do potwierdzenia czasy cyklu modelu B', 'Brak wyniku z produkcyjnego cyklu.', 'Brak akceptacji milestone M3.', 'High', 'M. Nowak', 'Open', 'Production', 'Wykonać pomiar czasu cyklu.', isoDate(3), 'HB522-031'],
      [ub, 'OP-024', 'Niespójny reset napędu po E-Stop', 'Napęd wymaga dodatkowego ręcznego resetu.', 'Ponowny start linii opóźniony.', 'Critical', 'K. Wójcik', 'In progress', 'Electrical', 'Sprawdzić parametry resetu napędu.', isoDate(0), 'UB512-025'],
      [ub, 'OP-026', 'Brak potwierdzenia nadrzędnego PLC', 'Handshake przenośnika nie jest domykany.', 'Transport detalu zablokowany.', 'High', 'P. Lis', 'Waiting', 'Line PLC Team', 'Test wspólny po aktualizacji programu.', isoDate(1), 'UB512-006']
    ].forEach(rowData => insertPoint.run(...rowData));

    const insertNote = db.prepare(`
      INSERT INTO daily_notes (controller_id, note_date, shift, author, type, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    [
      [hb, isoDate(0), 'Shift 1', 'M. Nowak', 'Progress', 'Potwierdzono I/O clampów na ST522.30. RobotAtHome nadal brak — punkt OP-017 pozostaje otwarty.'],
      [hb, isoDate(0), 'Shift 1', 'K. Wójcik', 'Progress', 'Door interlock działa poprawnie. Pozostał wspólny test E-Stop z Electrical.'],
      [hb, isoDate(0), 'Shift 1', 'P. Lis', 'Decision', 'Backup PLC HB522 zapisany jako v0.42.'],
      [ub, isoDate(0), 'Shift 1', 'K. Wójcik', 'Problem', 'Pozycja serwisowa windy wymaga korekty o około 4 mm.'],
      [ub, isoDate(-1), 'Shift 2', 'P. Lis', 'Plan', 'Na pierwszej zmianie wykonać test handshake z nadrzędnym PLC.']
    ].forEach(rowData => insertNote.run(...rowData));

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function createRepository(db) {
  const controllerStatement = db.prepare('SELECT id, code, area, description FROM controllers WHERE code = ?');

  function controller(code) {
    const value = controllerStatement.get(code);
    if (!value) {
      const error = new Error('Unknown controller');
      error.statusCode = 400;
      throw error;
    }
    return value;
  }

  function controllerFilter(code, alias) {
    if (!code || code === 'all') return { sql: '', params: [] };
    return { sql: ` WHERE ${alias}.controller_id = ?`, params: [controller(code).id] };
  }

  function updateRecord(table, fields, id, input) {
    const changes = fields.filter(field => Object.hasOwn(input, field));
    if (!changes.length) return;
    const values = changes.map(field => input[field] === '' && field.endsWith('_date') ? null : input[field]);
    const sql = `UPDATE ${table} SET ${changes.map(field => `${field} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    const result = db.prepare(sql).run(...values, id);
    if (result.changes === 0) {
      const error = new Error('Record not found');
      error.statusCode = 404;
      throw error;
    }
  }

  function deleteRecord(table, id) {
    const result = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
    if (result.changes === 0) {
      const error = new Error('Record not found');
      error.statusCode = 404;
      throw error;
    }
  }

  return {
    close() { db.close(); },

    controllers() {
      return db.prepare('SELECT id, code, area, description FROM controllers ORDER BY code').all();
    },

    dashboard(code) {
      const filter = controllerFilter(code, 's');
      const rows = db.prepare(`SELECT s.status, COUNT(*) AS count FROM status_items s${filter.sql} GROUP BY s.status`).all(...filter.params);
      const counts = Object.fromEntries(rows.map(row => [row.status, row.count]));
      const total = rows.reduce((sum, row) => sum + row.count, 0);
      const done = counts.Done || 0;
      const taskFilter = controllerFilter(code, 't');
      const openTaskCount = db.prepare(`SELECT COUNT(*) AS count FROM tasks t${taskFilter.sql}${taskFilter.sql ? ' AND' : ' WHERE'} t.status != 'Done'`).get(...taskFilter.params).count;
      const pointFilter = controllerFilter(code, 'p');
      const openPointCount = db.prepare(`SELECT COUNT(*) AS count FROM open_points p${pointFilter.sql}${pointFilter.sql ? ' AND' : ' WHERE'} p.status != 'Closed'`).get(...pointFilter.params).count;
      return {
        total,
        done,
        progress: total ? Math.round((done / total) * 100) : 0,
        inProgress: counts['In progress'] || 0,
        blocked: (counts.Blocked || 0) + (counts['NOK / Rework'] || 0),
        ready: counts['Ready to test'] || 0,
        openTasks: openTaskCount,
        openPoints: openPointCount
      };
    },

    statusItems(code) {
      const filter = controllerFilter(code, 's');
      return db.prepare(`
        SELECT s.*, c.code AS controller
        FROM status_items s JOIN controllers c ON c.id = s.controller_id
        ${filter.sql}
        ORDER BY c.code, s.station, s.test_id
      `).all(...filter.params);
    },

    createStatus(input) {
      const ctrl = controller(clean(input.controller));
      const functionDetail = clean(input.function_detail);
      const station = clean(input.station);
      if (!functionDetail || !station) throw requiredError('Station and test name are required');
      const prefix = ctrl.code;
      const next = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS value FROM status_items').get().value;
      const testId = clean(input.test_id) || `${prefix}-${String(next).padStart(3, '0')}`;
      const result = db.prepare(`
        INSERT INTO status_items
        (controller_id, test_id, station, function_detail, category, milestone, criticality, responsible, status, current_note, evidence_link)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(ctrl.id, testId, station, functionDetail, clean(input.category, 'General'), clean(input.milestone), clean(input.criticality, 'Medium'), clean(input.responsible), clean(input.status, 'Not started'), clean(input.current_note), clean(input.evidence_link));
      return db.prepare('SELECT s.*, c.code AS controller FROM status_items s JOIN controllers c ON c.id=s.controller_id WHERE s.id=?').get(result.lastInsertRowid);
    },

    updateStatus(id, input) {
      updateRecord('status_items', ['station', 'function_detail', 'category', 'milestone', 'criticality', 'responsible', 'status', 'checked_by', 'checked_on', 'environment', 'current_note', 'evidence_link'], id, input);
      return db.prepare('SELECT s.*, c.code AS controller FROM status_items s JOIN controllers c ON c.id=s.controller_id WHERE s.id=?').get(id);
    },
    deleteStatus(id) { deleteRecord('status_items', id); },

    tasks(code) {
      const filter = controllerFilter(code, 't');
      return db.prepare(`SELECT t.*, c.code AS controller FROM tasks t JOIN controllers c ON c.id=t.controller_id${filter.sql} ORDER BY CASE t.status WHEN 'In progress' THEN 1 WHEN 'To do' THEN 2 ELSE 3 END, t.due_date, t.id DESC`).all(...filter.params);
    },
    createTask(input) {
      const ctrl = controller(clean(input.controller));
      const title = clean(input.title);
      if (!title) throw requiredError('Task title is required');
      const result = db.prepare(`INSERT INTO tasks (controller_id,title,description,station,priority,owner,status,due_date,linked_test_id) VALUES (?,?,?,?,?,?,?,?,?)`).run(ctrl.id, title, clean(input.description), clean(input.station), clean(input.priority, 'Medium'), clean(input.owner), clean(input.status, 'To do'), nullableDate(input.due_date), clean(input.linked_test_id) || null);
      return db.prepare('SELECT t.*, c.code AS controller FROM tasks t JOIN controllers c ON c.id=t.controller_id WHERE t.id=?').get(result.lastInsertRowid);
    },
    updateTask(id, input) {
      updateRecord('tasks', ['title', 'description', 'station', 'priority', 'owner', 'status', 'due_date', 'linked_test_id'], id, input);
      return db.prepare('SELECT t.*, c.code AS controller FROM tasks t JOIN controllers c ON c.id=t.controller_id WHERE t.id=?').get(id);
    },
    deleteTask(id) { deleteRecord('tasks', id); },

    openPoints(code) {
      const filter = controllerFilter(code, 'p');
      return db.prepare(`SELECT p.*, c.code AS controller FROM open_points p JOIN controllers c ON c.id=p.controller_id${filter.sql} ORDER BY CASE p.priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, p.due_date, p.id DESC`).all(...filter.params);
    },
    createOpenPoint(input) {
      const ctrl = controller(clean(input.controller));
      const title = clean(input.title);
      if (!title) throw requiredError('Open point title is required');
      const next = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS value FROM open_points').get().value;
      const issueId = clean(input.issue_id) || `OP-${String(next).padStart(3, '0')}`;
      const result = db.prepare(`INSERT INTO open_points (controller_id,issue_id,title,description,impact,priority,owner,status,waiting_for,next_action,due_date,linked_test_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(ctrl.id, issueId, title, clean(input.description), clean(input.impact), clean(input.priority, 'Medium'), clean(input.owner), clean(input.status, 'Open'), clean(input.waiting_for), clean(input.next_action), nullableDate(input.due_date), clean(input.linked_test_id) || null);
      return db.prepare('SELECT p.*, c.code AS controller FROM open_points p JOIN controllers c ON c.id=p.controller_id WHERE p.id=?').get(result.lastInsertRowid);
    },
    updateOpenPoint(id, input) {
      updateRecord('open_points', ['title', 'description', 'impact', 'priority', 'owner', 'status', 'waiting_for', 'next_action', 'due_date', 'linked_test_id'], id, input);
      return db.prepare('SELECT p.*, c.code AS controller FROM open_points p JOIN controllers c ON c.id=p.controller_id WHERE p.id=?').get(id);
    },
    deleteOpenPoint(id) { deleteRecord('open_points', id); },

    dailyNotes(code, date) {
      const params = [];
      const conditions = [];
      if (code && code !== 'all') { conditions.push('n.controller_id = ?'); params.push(controller(code).id); }
      if (date) { conditions.push('n.note_date = ?'); params.push(date); }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
      return db.prepare(`SELECT n.*, c.code AS controller FROM daily_notes n LEFT JOIN controllers c ON c.id=n.controller_id${where} ORDER BY n.note_date DESC, n.created_at DESC, n.id DESC`).all(...params);
    },
    createDailyNote(input) {
      const ctrl = controller(clean(input.controller));
      const content = clean(input.content);
      const author = clean(input.author);
      if (!content || !author) throw requiredError('Author and note content are required');
      const result = db.prepare(`INSERT INTO daily_notes (controller_id,note_date,shift,author,type,content) VALUES (?,?,?,?,?,?)`).run(ctrl.id, nullableDate(input.note_date) || isoDate(0), clean(input.shift, 'Shift 1'), author, clean(input.type, 'Progress'), content);
      return db.prepare('SELECT n.*, c.code AS controller FROM daily_notes n LEFT JOIN controllers c ON c.id=n.controller_id WHERE n.id=?').get(result.lastInsertRowid);
    },
    updateDailyNote(id, input) {
      updateRecord('daily_notes', ['note_date', 'shift', 'author', 'type', 'content'], id, input);
      return db.prepare('SELECT n.*, c.code AS controller FROM daily_notes n LEFT JOIN controllers c ON c.id=n.controller_id WHERE n.id=?').get(id);
    },
    deleteDailyNote(id) { deleteRecord('daily_notes', id); }
  };
}

function requiredError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}
