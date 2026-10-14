import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function startApplication(t) {
  const directory = mkdtempSync(join(tmpdir(), 'plc-hub-server-'));
  const port = 32000 + Math.floor(Math.random() * 20000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, PORT: String(port), DB_PATH: join(directory, 'test.db'), APP_USER: 'security-admin', APP_PASSWORD: 'security-test-password', MFA_ENCRYPTION_KEY: '11'.repeat(32), SEED_DEMO_DATA: 'false', NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null) child.kill('SIGTERM');
    for (let attempt = 0; child.exitCode === null && attempt < 20; attempt += 1) await delay(25);
    if (child.exitCode === null) child.kill('SIGKILL');
    rmSync(directory, { recursive: true, force: true });
  });
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Serwer zakończył pracę podczas startu:\n${output}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return { baseUrl, child };
    } catch {}
    await delay(25);
  }
  throw new Error(`Serwer nie uruchomił się w oczekiwanym czasie:\n${output}`);
}

async function request(baseUrl, path, { cookie = '', method = 'GET', body, headers = {} } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function login(baseUrl, username, password, headers = {}) {
  const response = await request(baseUrl, '/api/login', { method: 'POST', body: { username, password }, headers });
  const cookie = String(response.headers.get('set-cookie') || '').split(';')[0];
  return { response, cookie, data: await response.json() };
}

async function selectProject(baseUrl, cookie, projectId) {
  const response = await request(baseUrl, '/api/select-project', { cookie, method: 'POST', body: { project_id: projectId } });
  assert.equal(response.status, 200);
  return response.json();
}

function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of secret) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

test('API protects manager data, project directory and account sessions', async t => {
  const { baseUrl } = await startApplication(t);
  const health = await request(baseUrl, '/api/health');
  assert.equal((await health.clone().json()).version, '1.0.0');
  assert.equal(health.headers.get('x-frame-options'), 'DENY');
  assert.match(health.headers.get('permissions-policy'), /camera=\(\)/);

  const adminLogin = await login(baseUrl, 'security-admin', 'security-test-password');
  assert.equal(adminLogin.response.status, 200);
  const projectId = adminLogin.data.projects[0].id;
  await selectProject(baseUrl, adminLogin.cookie, projectId);

  const createUser = async input => {
    const response = await request(baseUrl, '/api/users', { cookie: adminLogin.cookie, method: 'POST', body: input });
    assert.equal(response.status, 201);
    return response.json();
  };
  const worker = await createUser({ username: 'security-worker', display_name: 'Security Worker', password: 'worker-password', project_role: 'user' });
  const manager = await createUser({ username: 'security-manager', display_name: 'Security Manager', password: 'manager-password', project_role: 'moderator' });
  const hidden = await createUser({ username: 'security-hidden', display_name: 'Hidden Account', password: 'hidden-password', project_role: 'user' });
  const deactivate = await request(baseUrl, `/api/users/${hidden.id}`, { cookie: adminLogin.cookie, method: 'PATCH', body: { project_active: 0 } });
  assert.equal(deactivate.status, 200);

  const secondProjectResponse = await request(baseUrl, '/api/projects', { cookie: adminLogin.cookie, method: 'POST', body: { code: 'SEC2', name: 'Security second project' } });
  assert.equal(secondProjectResponse.status, 201);
  const secondProject = await secondProjectResponse.json();
  await selectProject(baseUrl, adminLogin.cookie, secondProject.id);
  for (const userId of [worker.id, manager.id, hidden.id]) {
    const activate = await request(baseUrl, `/api/users/${userId}`, { cookie: adminLogin.cookie, method: 'PATCH', body: { project_active: 1, planner_enabled: 1 } });
    assert.equal(activate.status, 200);
  }
  const areaResponse = await request(baseUrl, '/api/controller-groups', { cookie: adminLogin.cookie, method: 'POST', body: { name: 'SECURITY-AREA' } });
  assert.equal(areaResponse.status, 201);
  const area = await areaResponse.json();
  const planDate = new Date().toISOString().slice(0, 10);
  for (const userId of [worker.id, manager.id]) {
    const savePlan = await request(baseUrl, '/api/planner/day', { cookie: adminLogin.cookie, method: 'PUT', body: { user_id: userId, plan_date: planDate, entries: [{ activity_type: 'work', controller_group_id: area.id, work_mode: 'online', shift: 'Dzień' }] } });
    assert.equal(savePlan.status, 200);
  }
  const hiddenAbsence = await request(baseUrl, '/api/planner/day', { cookie: adminLogin.cookie, method: 'PUT', body: { user_id: hidden.id, plan_date: planDate, absence_type: 'vacation', absence_note: 'Poufna nieobecność innego projektu' } });
  assert.equal(hiddenAbsence.status, 200);
  await selectProject(baseUrl, adminLogin.cookie, projectId);

  const workerLogin = await login(baseUrl, 'security-worker', 'worker-password');
  assert.equal(workerLogin.response.status, 200);
  await selectProject(baseUrl, workerLogin.cookie, projectId);
  const workerUsersResponse = await request(baseUrl, '/api/users', { cookie: workerLogin.cookie });
  assert.equal(workerUsersResponse.status, 200);
  const workerUsers = await workerUsersResponse.json();
  assert.equal(workerUsers.some(user => user.id === hidden.id), false);
  assert.ok(workerUsers.some(user => user.id === manager.id));
  assert.ok(workerUsers.every(user => !Object.hasOwn(user, 'username') && !Object.hasOwn(user, 'system_role')));
  assert.ok(workerUsers.every(user => !Object.hasOwn(user, 'project_role') && !Object.hasOwn(user, 'planner_enabled') && !Object.hasOwn(user, 'area_ids')));
  const workerPlanner = await (await request(baseUrl, `/api/planner?from=${planDate}&to=${planDate}`, { cookie: workerLogin.cookie })).json();
  assert.ok(workerPlanner.users.every(user => !Object.hasOwn(user, 'username')));
  assert.ok(workerPlanner.cross_project_entries.some(entry => entry.user_id === worker.id));
  assert.ok(workerPlanner.cross_project_entries.every(entry => entry.user_id === worker.id));
  assert.equal(workerPlanner.absences.some(absence => absence.user_id === hidden.id), false);
  for (const privatePath of ['/api/operations', '/api/monthly-reviews', '/api/automation-rules', '/api/backup']) {
    const response = await request(baseUrl, privatePath, { cookie: workerLogin.cookie });
    assert.equal(response.status, 403, privatePath);
  }
  assert.equal((await request(baseUrl, '/api/security/events', { cookie: workerLogin.cookie })).status, 403);

  const managerLogin = await login(baseUrl, 'security-manager', 'manager-password');
  assert.equal(managerLogin.response.status, 200);
  await selectProject(baseUrl, managerLogin.cookie, projectId);
  assert.equal((await request(baseUrl, '/api/operations', { cookie: managerLogin.cookie })).status, 200);
  assert.equal((await request(baseUrl, '/api/monthly-reviews', { cookie: managerLogin.cookie })).status, 200);
  for (const removedPath of ['/api/commissioning', '/api/commissioning-templates', '/api/test-campaigns', '/api/readiness-gates']) {
    assert.equal((await request(baseUrl, removedPath, { cookie: managerLogin.cookie })).status, 404, removedPath);
  }
  const managerUsers = await (await request(baseUrl, '/api/users', { cookie: managerLogin.cookie })).json();
  assert.equal(managerUsers.some(user => user.id === hidden.id), false);
  assert.ok(managerUsers.every(user => Object.hasOwn(user, 'username')));
  const managerWorkingNorm = await request(baseUrl, '/api/settings/planner_online_hours', { cookie: managerLogin.cookie, method: 'PATCH', body: { value: 9.5 } });
  assert.equal(managerWorkingNorm.status, 200);
  const managerReminderSetting = await request(baseUrl, '/api/settings/default_reminder_days', { cookie: managerLogin.cookie, method: 'PATCH', body: { value: 21 } });
  assert.equal(managerReminderSetting.status, 403);
  const managerPlanner = await (await request(baseUrl, `/api/planner?from=${planDate}&to=${planDate}`, { cookie: managerLogin.cookie })).json();
  assert.ok(managerPlanner.cross_project_entries.some(entry => entry.user_id === worker.id));
  assert.ok(managerPlanner.cross_project_entries.some(entry => entry.user_id === manager.id));
  assert.equal(managerPlanner.absences.some(absence => absence.user_id === hidden.id), false);

  const adminUsers = await (await request(baseUrl, '/api/users', { cookie: adminLogin.cookie })).json();
  assert.ok(adminUsers.some(user => user.id === hidden.id));
  assert.ok(adminUsers.every(user => Object.hasOwn(user, 'username') && Object.hasOwn(user, 'system_role')));
  const invalidSetting = await request(baseUrl, '/api/settings/default_reminder_days', { cookie: adminLogin.cookie, method: 'PATCH', body: { value: 'nie-liczba' } });
  assert.equal(invalidSetting.status, 400);
  const unknownSetting = await request(baseUrl, '/api/settings/private_debug_switch', { cookie: adminLogin.cookie, method: 'PATCH', body: { value: 1 } });
  assert.equal(unknownSetting.status, 400);

  const reset = await request(baseUrl, `/api/users/${worker.id}/password`, { cookie: adminLogin.cookie, method: 'PUT', body: { new_password: 'worker-password-new' } });
  assert.equal(reset.status, 200);
  assert.equal((await request(baseUrl, '/api/me', { cookie: workerLogin.cookie })).status, 401);
  const workerRelogin = await login(baseUrl, 'security-worker', 'worker-password-new');
  assert.equal(workerRelogin.response.status, 200);

  const passwordChange = await request(baseUrl, '/api/account/password', { cookie: managerLogin.cookie, method: 'PUT', body: { current_password: 'manager-password', new_password: 'manager-password-new' } });
  assert.equal(passwordChange.status, 200);
  const rotatedCookie = String(passwordChange.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(rotatedCookie && rotatedCookie !== managerLogin.cookie);
  assert.equal((await request(baseUrl, '/api/me', { cookie: managerLogin.cookie })).status, 401);
  assert.equal((await request(baseUrl, '/api/me', { cookie: rotatedCookie })).status, 200);

  const duplicate = await request(baseUrl, '/api/users', { cookie: adminLogin.cookie, method: 'POST', body: { username: 'security-worker', display_name: 'Duplicate', password: 'duplicate-password' } });
  assert.equal(duplicate.status, 409);
  const duplicateError = await duplicate.json();
  assert.equal(duplicateError.error, 'Taki rekord już istnieje');
  assert.doesNotMatch(JSON.stringify(duplicateError), /UNIQUE|users\.username/i);
});

test('MFA protects logins, consumes recovery codes and records security events', async t => {
  const { baseUrl } = await startApplication(t);
  const initial = await login(baseUrl, 'security-admin', 'security-test-password');
  assert.equal(initial.response.status, 200);

  const setupResponse = await request(baseUrl, '/api/account/mfa/setup', {
    cookie: initial.cookie, method: 'POST', body: { current_password: 'security-test-password' }
  });
  assert.equal(setupResponse.status, 200);
  const setup = await setupResponse.json();
  assert.match(setup.secret, /^[A-Z2-7]{32}$/);

  const enableResponse = await request(baseUrl, '/api/account/mfa/enable', {
    cookie: initial.cookie, method: 'POST', body: { code: totp(setup.secret) }
  });
  assert.equal(enableResponse.status, 200);
  const enabled = await enableResponse.json();
  assert.equal(enabled.recovery_codes.length, 10);

  const security = await (await request(baseUrl, '/api/account/security', { cookie: initial.cookie })).json();
  assert.equal(security.mfa_enabled, true);
  assert.equal(security.recovery_codes_remaining, 10);
  await request(baseUrl, '/api/logout', { cookie: initial.cookie, method: 'POST', body: {} });

  const passwordStep = await login(baseUrl, 'security-admin', 'security-test-password');
  assert.equal(passwordStep.response.status, 202);
  assert.equal(passwordStep.cookie, '');
  assert.equal(passwordStep.data.mfa_required, true);
  const mfaResponse = await request(baseUrl, '/api/login/mfa', {
    method: 'POST', body: { challenge_token: passwordStep.data.challenge_token, code: totp(setup.secret) }
  });
  assert.equal(mfaResponse.status, 200);
  const mfaCookie = String(mfaResponse.headers.get('set-cookie') || '').split(';')[0];
  assert.ok(mfaCookie);

  await request(baseUrl, '/api/logout', { cookie: mfaCookie, method: 'POST', body: {} });
  const recoveryPasswordStep = await login(baseUrl, 'security-admin', 'security-test-password');
  const recoveryResponse = await request(baseUrl, '/api/login/mfa', {
    method: 'POST', body: { challenge_token: recoveryPasswordStep.data.challenge_token, code: enabled.recovery_codes[0] }
  });
  assert.equal(recoveryResponse.status, 200);
  const recoveryCookie = String(recoveryResponse.headers.get('set-cookie') || '').split(';')[0];
  const afterRecovery = await (await request(baseUrl, '/api/account/security', { cookie: recoveryCookie })).json();
  assert.equal(afterRecovery.recovery_codes_remaining, 9);

  const eventsResponse = await request(baseUrl, '/api/security/events', { cookie: recoveryCookie });
  assert.equal(eventsResponse.status, 200);
  const events = await eventsResponse.json();
  assert.ok(events.some(event => event.event_type === 'mfa_enabled' && event.outcome === 'success'));
  assert.ok(events.some(event => event.event_type === 'login' && event.details.mfa === true));
});

test('login throttling blocks repeated password guessing', async t => {
  const { baseUrl } = await startApplication(t);
  const headers = { 'X-Forwarded-For': '203.0.113.19' };
  let response;
  for (let attempt = 0; attempt < 8; attempt += 1) ({ response } = await login(baseUrl, 'security-admin', 'wrong-password', headers));
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get('retry-after')) > 0);
  const blockedCorrectLogin = await login(baseUrl, 'security-admin', 'security-test-password', headers);
  assert.equal(blockedCorrectLogin.response.status, 429);
});
