import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { openDatabase, verifyPassword } from './database.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(moduleDir, 'public');
const databasePath = process.env.DB_PATH || join(moduleDir, 'data', 'plc-status.db');
const port = Number(process.env.PORT || 3000);
const repository = openDatabase(databasePath);
const sessions = new Map();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

function json(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let content = '';
  for await (const chunk of request) {
    content += chunk;
    if (content.length > 2_000_000) throw Object.assign(new Error('Żądanie jest zbyt duże'), { statusCode: 413 });
  }
  if (!content) return {};
  try { return JSON.parse(content); }
  catch { throw Object.assign(new Error('Nieprawidłowy JSON'), { statusCode: 400 }); }
}

function cookies(request) {
  return Object.fromEntries((request.headers.cookie || '').split(';').map(value => value.trim().split('=').map(decodeURIComponent)).filter(parts => parts.length === 2));
}

function sessionCookie(request, value, maxAge) {
  const https = request.socket.encrypted || String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return `plc_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${https ? '; Secure' : ''}`;
}

function currentUser(request) {
  const token = cookies(request).plc_session;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return repository.me(session.userId);
}

function requireRole(user, role = 'user') {
  const allowed = role === 'user' ? Boolean(user) : role === 'moderator' ? ['admin', 'moderator'].includes(user?.role) : user?.role === 'admin';
  if (!allowed) throw Object.assign(new Error(user ? 'Brak uprawnień' : 'Zaloguj się'), { statusCode: user ? 403 : 401 });
}

function numericId(pathname, prefix) {
  const match = pathname.match(new RegExp(`^${prefix}/(\\d+)$`));
  return match ? Number(match[1]) : null;
}

async function handleApi(request, response, url) {
  const method = request.method || 'GET';
  const path = url.pathname;
  const controller = url.searchParams.get('controller') || 'all';
  const user = currentUser(request);

  if (method === 'GET' && path === '/api/health') return json(response, 200, { status: 'ok', version: 3, release: '3.2.0' });
  if (method === 'POST' && path === '/api/login') {
    const input = await readJson(request);
    const account = repository.authenticate(input.username);
    if (!account || !verifyPassword(input.password || '', account.password_hash)) return json(response, 401, { error: 'Nieprawidłowy login lub hasło' });
    const token = randomBytes(32).toString('hex');
    sessions.set(token, { userId: account.id, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    return json(response, 200, repository.me(account.id), { 'Set-Cookie': sessionCookie(request, token, 43200) });
  }
  if (method === 'POST' && path === '/api/logout') {
    sessions.delete(cookies(request).plc_session);
    return json(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie(request, '', 0) });
  }

  requireRole(user);
  if (method === 'GET' && path === '/api/me') return json(response, 200, user);
  if (method === 'GET' && path === '/api/controllers') return json(response, 200, repository.controllers());
  if (method === 'GET' && path === '/api/users') return json(response, 200, repository.users());
  if (method === 'GET' && path === '/api/config') return json(response, 200, repository.config());
  if (method === 'GET' && path === '/api/dashboard') return json(response, 200, repository.dashboard(controller));
  if (method === 'GET' && path === '/api/overview') return json(response, 200, repository.overview());
  if (method === 'GET' && path === '/api/my-summary') return json(response, 200, repository.mySummary(user));
  if (method === 'GET' && path === '/api/audit') {
    const type = url.searchParams.get('type');
    const id = Number(url.searchParams.get('id'));
    return json(response, 200, repository.audit(type, id));
  }
  if (method === 'PATCH' && path === '/api/status/batch') {
    return json(response, 200, repository.batchUpdateStatus(await readJson(request), user));
  }

  const resources = [
    { path: '/api/status', list: () => repository.status(controller, user), save: (id, body) => repository.saveStatus(id, body, user), remove: id => repository.deleteStatus(id, user), deleteRole: 'admin' },
    { path: '/api/tasks', list: () => repository.tasks(controller, user), save: (id, body) => repository.saveTask(id, body, user), remove: id => repository.deleteTask(id, user), deleteRole: 'owner' },
    { path: '/api/open-points', list: () => repository.points(controller, user), save: (id, body) => repository.savePoint(id, body, user), remove: id => repository.deletePoint(id, user), deleteRole: 'admin' },
    { path: '/api/daily-notes', list: () => repository.notes(controller, url.searchParams.get('from'), url.searchParams.get('to'), user), save: (id, body) => repository.saveNote(id, body, user), remove: id => repository.deleteNote(id, user), deleteRole: 'owner' },
    { path: '/api/goals', list: () => repository.goals(controller, user), save: (id, body) => repository.saveGoal(id, body, user), remove: id => repository.deleteGoal(id, user), deleteRole: 'admin' }
  ];

  for (const resource of resources) {
    if (path === resource.path) {
      if (method === 'GET') return json(response, 200, resource.list());
      if (method === 'POST') return json(response, 201, resource.save(null, await readJson(request)));
    }
    const id = numericId(path, resource.path);
    if (id !== null) {
      if (method === 'PATCH') return json(response, 200, resource.save(id, await readJson(request)));
      if (method === 'DELETE') {
        if (resource.deleteRole === 'admin') requireRole(user, 'admin');
        if (resource.deleteRole === 'owner' && user.role === 'moderator') requireRole(user, 'admin');
        resource.remove(id);
        response.writeHead(204);
        return response.end();
      }
    }
  }

  if (path === '/api/users' && method === 'POST') {
    requireRole(user, 'admin');
    return json(response, 201, repository.saveUser(null, await readJson(request)));
  }
  let id = numericId(path, '/api/users');
  if (id !== null) {
    requireRole(user, 'admin');
    if (method === 'PATCH') return json(response, 200, repository.saveUser(id, await readJson(request)));
    if (method === 'DELETE') {
      if (id === user.id) throw Object.assign(new Error('Nie możesz usunąć własnego konta'), { statusCode: 400 });
      repository.deleteUser(id);
      response.writeHead(204);
      return response.end();
    }
  }

  if (path === '/api/controllers' && method === 'POST') {
    requireRole(user, 'admin');
    return json(response, 201, repository.saveController(null, await readJson(request)));
  }
  id = numericId(path, '/api/controllers');
  if (id !== null) {
    requireRole(user, 'admin');
    if (method === 'PATCH') return json(response, 200, repository.saveController(id, await readJson(request)));
    if (method === 'DELETE') { repository.deleteController(id); response.writeHead(204); return response.end(); }
  }

  if (path === '/api/function-groups' && method === 'POST') {
    requireRole(user, 'admin');
    return json(response, 201, repository.saveFunctionGroup(null, await readJson(request), user));
  }
  if (path === '/api/function-groups/bulk' && method === 'POST') {
    requireRole(user, 'admin');
    return json(response, 201, repository.bulkFunctionGroups(await readJson(request)));
  }
  const checksMatch = path.match(/^\/api\/function-groups\/(\d+)\/checks$/);
  if (checksMatch && method === 'PUT') {
    requireRole(user, 'admin');
    return json(response, 200, repository.saveFunctionGroupChecks(Number(checksMatch[1]), await readJson(request), user));
  }
  id = numericId(path, '/api/function-groups');
  if (id !== null) {
    requireRole(user, 'admin');
    if (method === 'PATCH') return json(response, 200, repository.saveFunctionGroup(id, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteFunctionGroup(id, user); response.writeHead(204); return response.end(); }
  }

  const configResources = [
    { path: '/api/categories', scope: 'status', type: 'category', save: (id, body) => repository.saveCategory('status', id, body) },
    { path: '/api/subcategories', scope: 'status', type: 'subcategory', save: (id, body) => repository.saveSubcategory('status', id, body) },
    { path: '/api/task-categories', scope: 'task', type: 'task_category', save: (id, body) => repository.saveCategory('task', id, body) },
    { path: '/api/task-subcategories', scope: 'task', type: 'task_subcategory', save: (id, body) => repository.saveSubcategory('task', id, body) },
    { path: '/api/options', type: 'option', save: (id, body) => repository.saveOption(id, body) }
  ];
  for (const resource of configResources) {
    if (path === resource.path && method === 'POST') {
      requireRole(user, 'moderator');
      return json(response, 201, resource.save(null, await readJson(request)));
    }
    id = numericId(path, resource.path);
    if (id !== null) {
      requireRole(user, 'moderator');
      if (method === 'PATCH') return json(response, 200, resource.save(id, await readJson(request)));
      if (method === 'DELETE') { requireRole(user, 'admin'); repository.deleteConfig(resource.type, id); response.writeHead(204); return response.end(); }
    }
  }

  if (method === 'PATCH' && path === '/api/reorder') {
    const input = await readJson(request);
    if (['controllers', 'users', 'function_groups'].includes(input.kind)) requireRole(user, 'admin');
    else requireRole(user, 'moderator');
    repository.reorder(input.kind, input.ids);
    return json(response, 200, { ok: true });
  }
  if (method === 'PATCH' && path.startsWith('/api/settings/')) {
    requireRole(user, 'admin');
    const input = await readJson(request);
    repository.saveSetting(decodeURIComponent(path.slice('/api/settings/'.length)), input.value);
    return json(response, 200, { ok: true });
  }

  return json(response, 404, { error: 'Nie znaleziono endpointu' });
}

function serveStatic(response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(publicDir, normalized);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath) || !statSync(filePath).isFile()) return json(response, 404, { error: 'Nie znaleziono pliku' });
  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public,max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'"
  });
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
    return json(response, statusCode, { error: statusCode === 500 ? 'Nieoczekiwany błąd serwera' : error.message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, '0.0.0.0', () => console.log(`PLC Commissioning Hub V3.2 running on port ${port}`));
}

function shutdown() {
  server.close(() => {
    repository.close();
    process.exit(0);
  });
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
