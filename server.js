import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { openDatabase } from './database.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(moduleDir, 'public');
const databasePath = process.env.DB_PATH || join(moduleDir, 'data', 'plc-status.db');
const port = Number(process.env.PORT || 3000);
const repository = openDatabase(databasePath);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function json(response, statusCode, body) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 1_000_000) {
      const error = new Error('Request body is too large');
      error.statusCode = 413;
      throw error;
    }
  }
  if (!body) return {};
  try { return JSON.parse(body); }
  catch {
    const error = new Error('Invalid JSON');
    error.statusCode = 400;
    throw error;
  }
}

function basicAuthAllowed(request) {
  const expectedUser = process.env.APP_USER || '';
  const expectedPassword = process.env.APP_PASSWORD || '';
  if (!expectedUser && !expectedPassword) return true;
  if (!expectedUser || !expectedPassword) return false;
  const value = request.headers.authorization || '';
  if (!value.startsWith('Basic ')) return false;
  let provided;
  try { provided = Buffer.from(value.slice(6), 'base64').toString('utf8'); }
  catch { return false; }
  const expected = Buffer.from(`${expectedUser}:${expectedPassword}`);
  const actual = Buffer.from(provided);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function numericId(pathname, prefix) {
  const match = pathname.match(new RegExp(`^${prefix}/(\\d+)$`));
  return match ? Number(match[1]) : null;
}

async function handleApi(request, response, url) {
  const method = request.method || 'GET';
  const path = url.pathname;
  const controller = url.searchParams.get('controller') || 'all';

  if (method === 'GET' && path === '/api/health') return json(response, 200, { status: 'ok' });
  if (method === 'GET' && path === '/api/controllers') return json(response, 200, repository.controllers());
  if (method === 'GET' && path === '/api/dashboard') return json(response, 200, repository.dashboard(controller));

  const resources = [
    { path: '/api/status', list: () => repository.statusItems(controller), create: body => repository.createStatus(body), update: (id, body) => repository.updateStatus(id, body), remove: id => repository.deleteStatus(id) },
    { path: '/api/tasks', list: () => repository.tasks(controller), create: body => repository.createTask(body), update: (id, body) => repository.updateTask(id, body), remove: id => repository.deleteTask(id) },
    { path: '/api/open-points', list: () => repository.openPoints(controller), create: body => repository.createOpenPoint(body), update: (id, body) => repository.updateOpenPoint(id, body), remove: id => repository.deleteOpenPoint(id) },
    { path: '/api/daily-notes', list: () => repository.dailyNotes(controller, url.searchParams.get('date')), create: body => repository.createDailyNote(body), update: (id, body) => repository.updateDailyNote(id, body), remove: id => repository.deleteDailyNote(id) }
  ];

  for (const resource of resources) {
    if (path === resource.path) {
      if (method === 'GET') return json(response, 200, resource.list());
      if (method === 'POST') return json(response, 201, resource.create(await readJson(request)));
    }
    const id = numericId(path, resource.path);
    if (id !== null) {
      if (method === 'PATCH') return json(response, 200, resource.update(id, await readJson(request)));
      if (method === 'DELETE') { resource.remove(id); response.writeHead(204); return response.end(); }
    }
  }

  return json(response, 404, { error: 'Endpoint not found' });
}

function serveStatic(response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const normalized = normalize(requested).replace(/^(\.\.[/\\])+/, '');
  const filePath = join(publicDir, normalized);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    return json(response, 404, { error: 'File not found' });
  }
  response.writeHead(200, {
    'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'X-Frame-Options': 'SAMEORIGIN',
    'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'"
  });
  createReadStream(filePath).pipe(response);
}

export const server = createServer(async (request, response) => {
  try {
    if (!basicAuthAllowed(request)) {
      response.writeHead(401, { 'WWW-Authenticate': 'Basic realm="PLC Commissioning Hub"' });
      return response.end('Authentication required');
    }
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    if (request.method !== 'GET' && request.method !== 'HEAD') return json(response, 405, { error: 'Method not allowed' });
    return serveStatic(response, url.pathname);
  } catch (error) {
    console.error(error);
    const statusCode = Number(error.statusCode) || (String(error.message).includes('UNIQUE constraint') ? 409 : 500);
    return json(response, statusCode, { error: statusCode === 500 ? 'Unexpected server error' : error.message });
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(port, '0.0.0.0', () => {
    console.log(`PLC Commissioning Hub running on http://0.0.0.0:${port}`);
  });
}

function shutdown() {
  server.close(() => {
    repository.close();
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
