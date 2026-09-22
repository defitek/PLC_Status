import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { openDatabase, verifyPassword } from '../database.js';

test('V2 seeds demo, accounts, config and supports all modules', () => {
  const directory = mkdtempSync(join(tmpdir(), 'plc-hub-v2-'));
  process.env.APP_USER = 'admin';
  process.env.APP_PASSWORD = 'test-password';
  const repository = openDatabase(join(directory, 'test.db'));
  try {
    const admin = repository.authenticate('admin');
    assert.ok(verifyPassword('test-password', admin.password_hash));
    assert.deepEqual(repository.controllers().map(x => x.code), ['HB522', 'UB512']);
    assert.equal(repository.config().settings.default_reminder_days, '14');
    assert.ok(repository.config().categories.some(x => x.name === 'Hardware'));
    const user = repository.saveUser(null, { username: 'worker', display_name: 'PLC Worker', password: 'secret123', role: 'user' });
    assert.equal(user.role, 'user');
    const status = repository.saveStatus(null, { controller: 'HB522', station: 'ST99', function_detail: 'Test API', category: 'Hardware', subcategory: 'Device green' }, admin);
    assert.equal(repository.saveStatus(status.id, { status: 'Done' }, admin).status, 'Done');
    const task = repository.saveTask(null, { controller: 'HB522', title: 'Task API', owner: 'PLC Worker', category: 'Hardware', linked_entity_type: 'status', linked_entity_id: status.id, checklist: [{ text: 'Step one', done: true }] }, admin);
    assert.equal(repository.tasks('HB522').find(x => x.id === task.id).checklist.length, 1);
    const point = repository.savePoint(null, { controller: 'UB512', title: 'Point API', waiting_for: 'Robot', linked_entity_type: 'status', linked_entity_id: status.id }, admin);
    assert.ok(point.reminder_date);
    const note = repository.saveNote(null, { controller: 'HB522', content: 'Long shift note', shift: 'Noc', linked_task_id: task.id }, admin);
    assert.equal(repository.notes('HB522').find(x => x.id === note.id).author, 'Administrator');
    const goal = repository.saveGoal(null, { controller: 'HB522', title: 'Goal API', links: [{ entity_type: 'status', entity_id: status.id }, { entity_type: 'task', entity_id: task.id }, { entity_type: 'point', entity_id: point.id }] }, admin);
    assert.equal(repository.goals('HB522').find(x => x.id === goal.id).links.length, 3);
  } finally {
    repository.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
