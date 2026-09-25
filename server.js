import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { openDatabase, verifyPassword } from './database.js';
import { openPointsWorkbook, projectWorkbook, statusWorkbook } from './exports.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(moduleDir, 'public');
const databasePath = process.env.DB_PATH || join(moduleDir, 'data', 'plc-status.db');
const port = Number(process.env.PORT || 3000);
const repository = openDatabase(databasePath);
const sessions = new Map();
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

function json(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  response.end(JSON.stringify(payload));
}
function download(response, buffer, contentType, filename) {
  response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': buffer.length, 'Content-Disposition': `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(buffer);
}
async function readJson(request) {
  let content = '';
  for await (const chunk of request) { content += chunk; if (content.length > 50_000_000) throw Object.assign(new Error('Żądanie jest zbyt duże'), { statusCode: 413 }); }
  if (!content) return {};
  try { return JSON.parse(content); } catch { throw Object.assign(new Error('Nieprawidłowy JSON'), { statusCode: 400 }); }
}
function cookies(request) { return Object.fromEntries((request.headers.cookie || '').split(';').map(value => value.trim().split('=').map(decodeURIComponent)).filter(parts => parts.length === 2)); }
function sessionCookie(request, value, maxAge) {
  const https = request.socket.encrypted || String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return `plc_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${https ? '; Secure' : ''}`;
}
function activeSession(request) {
  const token = cookies(request).plc_session;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); return null; }
  return { token, session };
}
function currentUser(request) { const active = activeSession(request); return active ? repository.me(active.session.userId, active.session.projectId || null) : null; }
function requireRole(user, role = 'user') {
  const hierarchy = { user: 1, moderator: 2, project_admin: 3, system_admin: 4 };
  if (!user || Number(hierarchy[user.role] || 0) < Number(hierarchy[role] || 1)) throw Object.assign(new Error(user ? 'Brak uprawnień' : 'Zaloguj się'), { statusCode: user ? 403 : 401 });
}
function numericId(pathname, prefix) { const match = pathname.match(new RegExp(`^${prefix}/(\\d+)$`)); return match ? Number(match[1]) : null; }
function projectFilename(project, suffix, extension) { return `${project.code}_${suffix}_${new Date().toISOString().slice(0, 10)}.${extension}`; }

async function handleProjectApi(request, response, url, user) {
  const method = request.method || 'GET';
  const path = url.pathname;
  const scope = url.searchParams.get('controller') || 'all';
  const project = user.current_project;

  if (method === 'GET' && path === '/api/controllers') return json(response, 200, repository.controllers());
  if (method === 'GET' && path === '/api/controller-groups') return json(response, 200, repository.controllerGroups());
  if (method === 'GET' && path === '/api/users') return json(response, 200, repository.users());
  if (method === 'GET' && path === '/api/config') return json(response, 200, repository.config());
  if (method === 'GET' && path === '/api/dashboard') return json(response, 200, repository.dashboard(scope));
  if (method === 'GET' && path === '/api/overview') return json(response, 200, repository.overview(scope));
  if (method === 'GET' && path === '/api/my-summary') return json(response, 200, repository.mySummary(user));
  if (method === 'GET' && path === '/api/audit') return json(response, 200, repository.audit(url.searchParams.get('type'), Number(url.searchParams.get('id'))));
  if (method === 'GET' && path === '/api/history') return json(response, 200, repository.history({ types: url.searchParams.getAll('type'), limit: url.searchParams.get('limit') }));
  if (method === 'GET' && path === '/api/daily-summary') return json(response, 200, repository.dailySummary(url.searchParams.get('from'), url.searchParams.get('to')));
  if (method === 'GET' && path === '/api/planner') return json(response, 200, repository.planner(url.searchParams.get('from'), url.searchParams.get('to')));
  if (method === 'PUT' && path === '/api/planner/day') { requireRole(user, 'moderator'); return json(response, 200, repository.savePlannerDay(await readJson(request), user)); }
  if (method === 'POST' && path === '/api/planner/assign-work') { requireRole(user, 'moderator'); return json(response, 200, repository.assignPlannerWork(await readJson(request), user)); }
  if (method === 'GET' && path === '/api/calendar') return json(response, 200, repository.calendar({
    from: url.searchParams.get('from'), to: url.searchParams.get('to'), scope,
    types: url.searchParams.getAll('type'), priorities: url.searchParams.getAll('priority'), category: url.searchParams.get('category'), only_mine: url.searchParams.get('only_mine') === '1'
  }, user));
  if (method === 'POST' && path === '/api/calendar/items') return json(response, 201, repository.saveCalendarItems(await readJson(request), user));
  if (method === 'POST' && path === '/api/calendar/annotations') { requireRole(user, 'moderator'); return json(response, 201, repository.saveCalendarAnnotation(null, await readJson(request), user)); }
  let annotationMatch = path.match(/^\/api\/calendar\/annotations\/(\d+)$/);
  if (annotationMatch) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.saveCalendarAnnotation(Number(annotationMatch[1]), await readJson(request), user));
    if (method === 'DELETE') { repository.deleteCalendarAnnotation(Number(annotationMatch[1])); response.writeHead(204); return response.end(); }
  }

  if (method === 'GET' && path === '/api/backup') {
    requireRole(user, 'project_admin');
    return download(response, Buffer.from(JSON.stringify(repository.projectBackup(), null, 2)), 'application/json; charset=utf-8', projectFilename(project, 'backup', 'json'));
  }
  if (method === 'POST' && path === '/api/backup/restore') { requireRole(user, 'project_admin'); const input = await readJson(request); return json(response, 200, repository.restoreProjectBackup(input.backup || input)); }
  if (method === 'POST' && path === '/api/exports/project') {
    const data = { overview: repository.overview('all'), status: repository.status('all', user), tasks: repository.tasks('all', user), points: repository.points('all', user), notes: repository.notes('all', null, null, user), goals: repository.goals('all', user) };
    return download(response, projectWorkbook(data, project), mimeTypes['.xlsx'], projectFilename(project, 'caly_projekt', 'xlsx'));
  }
  if (method === 'POST' && path === '/api/exports/open-points') {
    const input = await readJson(request); const selectedScope = input.scope || scope;
    const label = selectedScope === 'all' ? 'cały projekt' : selectedScope.startsWith('group:') ? 'grupa sterowników' : selectedScope;
    return download(response, openPointsWorkbook(repository.points(selectedScope, user), project, { ...input, scope_label: label }), mimeTypes['.xlsx'], projectFilename(project, 'otwarte_punkty', 'xlsx'));
  }
  if (method === 'POST' && path === '/api/exports/status') {
    const input = await readJson(request); let options = { ...input };
    if (Number(input.template_id)) {
      const template = repository.config().export_templates.find(item => item.id === Number(input.template_id));
      if (!template) throw Object.assign(new Error('Nie znaleziono szablonu eksportu'), { statusCode: 404 });
      options = { ...template, ...input, filters: { ...template.filters, ...(input.filters || {}) }, columns: input.columns?.length ? input.columns : template.columns };
    }
    const selectedScope = input.scope || scope;
    return download(response, statusWorkbook(repository.status(selectedScope, user), project, options), mimeTypes['.xlsx'], projectFilename(project, 'status', 'xlsx'));
  }
  if (method === 'PATCH' && path === '/api/status/batch') return json(response, 200, repository.batchUpdateStatus(await readJson(request), user));

  const resources = [
    { path: '/api/status', list: () => repository.status(scope, user), save: (id, body) => repository.saveStatus(id, body, user), remove: id => repository.deleteStatus(id, user), deleteRole: 'project_admin' },
    { path: '/api/tasks', list: () => repository.tasks(scope, user), save: (id, body) => repository.saveTask(id, body, user), remove: id => repository.deleteTask(id, user), deleteRole: 'owner' },
    { path: '/api/open-points', list: () => repository.points(scope, user), save: (id, body) => repository.savePoint(id, body, user), remove: id => repository.deletePoint(id, user), deleteRole: 'project_admin' },
    { path: '/api/daily-notes', list: () => repository.notes(scope, url.searchParams.get('from'), url.searchParams.get('to'), user), save: (id, body) => repository.saveNote(id, body, user), remove: id => repository.deleteNote(id, user), deleteRole: 'owner' },
    { path: '/api/goals', list: () => repository.goals(scope, user), save: (id, body) => repository.saveGoal(id, body, user), remove: id => repository.deleteGoal(id, user), deleteRole: 'project_admin' }
  ];
  for (const resource of resources) {
    if (path === resource.path) { if (method === 'GET') return json(response, 200, resource.list()); if (method === 'POST') return json(response, 201, resource.save(null, await readJson(request))); }
    const recordId = numericId(path, resource.path);
    if (recordId !== null) {
      if (method === 'PATCH') return json(response, 200, resource.save(recordId, await readJson(request)));
      if (method === 'DELETE') {
        if (resource.deleteRole === 'project_admin') requireRole(user, 'project_admin');
        if (resource.deleteRole === 'owner' && user.role === 'moderator') throw Object.assign(new Error('Moderator nie może usuwać elementów'), { statusCode: 403 });
        resource.remove(recordId); response.writeHead(204); return response.end();
      }
    }
  }

  if (path === '/api/users' && method === 'POST') { requireRole(user, 'system_admin'); return json(response, 201, repository.saveUser(null, await readJson(request))); }
  let id = numericId(path, '/api/users');
  if (id !== null) {
    requireRole(user, 'project_admin');
    if (method === 'PATCH') {
      const input = await readJson(request);
      const target = repository.users().find(item => item.id === id);
      if (user.role !== 'system_admin' && (target?.system_role === 'system_admin' || target?.project_role === 'project_admin')) throw Object.assign(new Error('Tylko administrator systemu może modyfikować administratorów'), { statusCode: 403 });
      const safe = user.role === 'system_admin' ? input : { project_role: input.project_role, project_active: input.project_active };
      if (user.role !== 'system_admin' && !['user', 'moderator'].includes(safe.project_role)) throw Object.assign(new Error('Administrator projektu może przydzielać wyłącznie role moderatora i użytkownika'), { statusCode: 403 });
      return json(response, 200, repository.saveUser(id, safe));
    }
    if (method === 'DELETE') { requireRole(user, 'system_admin'); if (id === user.id) throw Object.assign(new Error('Nie możesz usunąć własnego konta'), { statusCode: 400 }); repository.deleteUser(id); response.writeHead(204); return response.end(); }
  }
  const userAreaMatch = path.match(/^\/api\/users\/(\d+)\/areas$/);
  if (userAreaMatch && method === 'PUT') { requireRole(user, 'project_admin'); return json(response, 200, repository.saveUserAreas(Number(userAreaMatch[1]), await readJson(request))); }

  if (path === '/api/controller-groups' && method === 'POST') { requireRole(user, 'project_admin'); return json(response, 201, repository.saveControllerGroup(null, await readJson(request))); }
  id = numericId(path, '/api/controller-groups');
  if (id !== null) { requireRole(user, 'project_admin'); if (method === 'PATCH') return json(response, 200, repository.saveControllerGroup(id, await readJson(request))); if (method === 'DELETE') { repository.deleteControllerGroup(id); response.writeHead(204); return response.end(); } }
  if (path === '/api/controllers' && method === 'POST') { requireRole(user, 'project_admin'); return json(response, 201, repository.saveController(null, await readJson(request))); }
  id = numericId(path, '/api/controllers');
  if (id !== null) { requireRole(user, 'project_admin'); if (method === 'PATCH') return json(response, 200, repository.saveController(id, await readJson(request))); if (method === 'DELETE') { repository.deleteController(id); response.writeHead(204); return response.end(); } }

  if (path === '/api/function-groups' && method === 'POST') { requireRole(user, 'project_admin'); return json(response, 201, repository.saveFunctionGroup(null, await readJson(request), user)); }
  if (path === '/api/function-groups/bulk' && method === 'POST') { requireRole(user, 'project_admin'); return json(response, 201, repository.bulkFunctionGroups(await readJson(request))); }
  let match = path.match(/^\/api\/function-groups\/(\d+)\/checks$/);
  if (match && method === 'PUT') { requireRole(user, 'project_admin'); return json(response, 200, repository.saveFunctionGroupChecks(Number(match[1]), await readJson(request), user)); }
  match = path.match(/^\/api\/function-groups\/(\d+)\/elements\/bulk$/);
  if (match && method === 'POST') { requireRole(user, 'project_admin'); return json(response, 201, repository.bulkFunctionGroupElements(Number(match[1]), await readJson(request))); }
  match = path.match(/^\/api\/function-groups\/(\d+)\/elements(?:\/(\d+))?$/);
  if (match) {
    requireRole(user, 'project_admin'); const groupId = Number(match[1]); const elementId = match[2] ? Number(match[2]) : null;
    if (method === 'POST' && !elementId) return json(response, 201, repository.saveFunctionGroupElement(groupId, null, await readJson(request)));
    if (method === 'PATCH' && elementId) return json(response, 200, repository.saveFunctionGroupElement(groupId, elementId, await readJson(request)));
    if (method === 'DELETE' && elementId) { repository.deleteFunctionGroupElement(groupId, elementId); response.writeHead(204); return response.end(); }
  }
  match = path.match(/^\/api\/function-groups\/(\d+)\/subcategories\/bulk$/);
  if (match && method === 'POST') { requireRole(user, 'project_admin'); return json(response, 201, repository.bulkFunctionGroupSubcategories(Number(match[1]), await readJson(request))); }
  match = path.match(/^\/api\/function-groups\/(\d+)\/subcategories(?:\/(\d+))?$/);
  if (match) {
    requireRole(user, 'project_admin'); const groupId = Number(match[1]); const subcategoryId = match[2] ? Number(match[2]) : null;
    if (method === 'POST' && !subcategoryId) return json(response, 201, repository.saveFunctionGroupSubcategory(groupId, null, await readJson(request)));
    if (method === 'PATCH' && subcategoryId) return json(response, 200, repository.saveFunctionGroupSubcategory(groupId, subcategoryId, await readJson(request)));
    if (method === 'DELETE' && subcategoryId) { repository.deleteFunctionGroupSubcategory(groupId, subcategoryId); response.writeHead(204); return response.end(); }
  }
  id = numericId(path, '/api/function-groups');
  if (id !== null) { requireRole(user, 'project_admin'); if (method === 'PATCH') return json(response, 200, repository.saveFunctionGroup(id, await readJson(request), user)); if (method === 'DELETE') { repository.deleteFunctionGroup(id, user); response.writeHead(204); return response.end(); } }

  const configResources = [
    { path: '/api/categories', type: 'category', save: (recordId, body) => repository.saveCategory('status', recordId, body) },
    { path: '/api/subcategories', type: 'subcategory', save: (recordId, body) => repository.saveSubcategory('status', recordId, body) },
    { path: '/api/task-categories', type: 'task_category', save: (recordId, body) => repository.saveCategory('task', recordId, body) },
    { path: '/api/task-subcategories', type: 'task_subcategory', save: (recordId, body) => repository.saveSubcategory('task', recordId, body) },
    { path: '/api/options', type: 'option', save: (recordId, body) => repository.saveOption(recordId, body) }
  ];
  for (const resource of configResources) {
    if (path === resource.path && method === 'POST') { requireRole(user, 'moderator'); return json(response, 201, resource.save(null, await readJson(request))); }
    id = numericId(path, resource.path);
    if (id !== null) { requireRole(user, 'moderator'); if (method === 'PATCH') return json(response, 200, resource.save(id, await readJson(request))); if (method === 'DELETE') { requireRole(user, 'project_admin'); repository.deleteConfig(resource.type, id); response.writeHead(204); return response.end(); } }
  }

  if (path === '/api/export-templates' && method === 'POST') { requireRole(user, 'project_admin'); return json(response, 201, repository.saveExportTemplate(null, await readJson(request), user)); }
  id = numericId(path, '/api/export-templates');
  if (id !== null) { requireRole(user, 'project_admin'); if (method === 'PATCH') return json(response, 200, repository.saveExportTemplate(id, await readJson(request), user)); if (method === 'DELETE') { repository.deleteExportTemplate(id); response.writeHead(204); return response.end(); } }
  if (method === 'PATCH' && path === '/api/reorder') {
    const input = await readJson(request);
    if (['controllers', 'controller_groups', 'users', 'function_groups', 'function_group_elements', 'function_group_subcategories', 'export_templates'].includes(input.kind)) requireRole(user, 'project_admin'); else requireRole(user, 'moderator');
    repository.reorder(input.kind, input.ids); return json(response, 200, { ok: true });
  }
  if (method === 'PATCH' && path.startsWith('/api/settings/')) { requireRole(user, 'project_admin'); const input = await readJson(request); repository.saveSetting(decodeURIComponent(path.slice('/api/settings/'.length)), input.value); return json(response, 200, { ok: true }); }
  return json(response, 404, { error: 'Nie znaleziono endpointu' });
}

async function handleApi(request, response, url) {
  const method = request.method || 'GET'; const path = url.pathname;
  if (method === 'GET' && path === '/api/health') return json(response, 200, { status: 'ok', version: 6, release: '6.0.0' });
  if (method === 'POST' && path === '/api/login') {
    const input = await readJson(request); const account = repository.authenticate(input.username);
    if (!account || !verifyPassword(input.password || '', account.password_hash)) return json(response, 401, { error: 'Nieprawidłowy login lub hasło' });
    const token = randomBytes(32).toString('hex'); sessions.set(token, { userId: account.id, projectId: null, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    return json(response, 200, repository.me(account.id, null), { 'Set-Cookie': sessionCookie(request, token, 43200) });
  }
  if (method === 'POST' && path === '/api/logout') { sessions.delete(cookies(request).plc_session); return json(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie(request, '', 0) }); }
  const active = activeSession(request);
  if (!active) return json(response, 401, { error: 'Zaloguj się' });
  let user = repository.me(active.session.userId, active.session.projectId || null);
  if (!user) return json(response, 401, { error: 'Konto jest nieaktywne' });
  if (method === 'GET' && path === '/api/me') return json(response, 200, user);
  if (method === 'GET' && path === '/api/projects/available') return json(response, 200, user.projects);
  if (method === 'PATCH' && path === '/api/preferences') return json(response, 200, repository.setPreference(user.id, await readJson(request)));
  if (method === 'POST' && path === '/api/select-project') {
    const input = await readJson(request); const selected = user.projects.find(project => project.id === Number(input.project_id));
    if (!selected) return json(response, 403, { error: 'Projekt jest niedostępny dla tego użytkownika' });
    active.session.projectId = selected.id; return json(response, 200, repository.me(user.id, selected.id));
  }
  if (path === '/api/projects') { requireRole(user, 'system_admin'); if (method === 'GET') return json(response, 200, repository.projects()); if (method === 'POST') return json(response, 201, repository.saveProject(null, await readJson(request))); }
  const projectId = numericId(path, '/api/projects');
  if (projectId !== null) {
    requireRole(user, 'system_admin');
    if (method === 'PATCH') return json(response, 200, repository.saveProject(projectId, await readJson(request)));
    if (method === 'DELETE') {
      const result = repository.deleteProject(projectId, await readJson(request));
      if (active.session.projectId === projectId) active.session.projectId = null;
      return json(response, 200, result);
    }
  }
  if (!user.current_project || !active.session.projectId) return json(response, 409, { error: 'Najpierw wybierz projekt', code: 'PROJECT_REQUIRED' });
  return repository.withProject(active.session.projectId, () => handleProjectApi(request, response, url, user));
}

function serveStatic(response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname; const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, ''); const filePath = join(publicDir, normalized);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath) || !statSync(filePath).isFile()) return json(response, 404, { error: 'Nie znaleziono pliku' });
  response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream', 'Cache-Control': ['.html', '.js', '.css'].includes(extname(filePath)) ? 'no-cache, no-store, must-revalidate' : 'public,max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'" });
  createReadStream(filePath).pipe(response);
}

export const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    const publicLoginFiles = ['/login.html', '/login.js', '/styles.css'];
    if (!currentUser(request) && !publicLoginFiles.includes(url.pathname)) return serveStatic(response, '/login.html');
    return serveStatic(response, url.pathname);
  } catch (error) {
    const statusCode = Number(error.statusCode) || (String(error.message).includes('UNIQUE constraint') ? 409 : 500);
    if (statusCode >= 500) console.error(error);
    return json(response, statusCode, { error: statusCode === 500 ? `Nieoczekiwany błąd serwera: ${error.message}` : error.message });
  }
});
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(port, '0.0.0.0', () => console.log(`PLC Commissioning Hub V6.0.0 running on port ${port}`));
function shutdown() { server.close(() => { repository.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
