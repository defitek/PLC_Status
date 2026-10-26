import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { createClient } from 'redis';
import { openDatabase, verifyPassword } from './database.js';
import { openPointsWorkbook, projectWorkbook, statusWorkbook } from './exports.js';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(moduleDir, 'public');
const databasePath = process.env.DB_PATH || join(moduleDir, 'data', 'plc-status.db');
const port = Number(process.env.PORT || 3000);
const repository = openDatabase(databasePath);
const sessions = new Map();
const loginFailures = new Map();
const loginChallenges = new Map();
const redisUrl = String(process.env.REDIS_URL || '').trim();
const redisPrefix = String(process.env.REDIS_PREFIX || 'plc-hub').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 60) || 'plc-hub';
const redis = redisUrl ? createClient({ url: redisUrl, socket: { connectTimeout: 10000, reconnectStrategy: retries => Math.min(3000, 100 + retries * 200) } }) : null;
if (redis) redis.on('error', error => console.error('Redis:', error.message));
const liveClients = new Set();
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
const securityHeaders = { 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin', 'Strict-Transport-Security': 'max-age=31536000' };
const sessionTtlSeconds = 12 * 60 * 60;
const maxJsonBytes = 5_000_000;
const loginWindowMs = 15 * 60 * 1000;
const loginFailureLimit = 8;
const managerSettingKeys = new Set(['planner_online_hours', 'planner_offline_hours', 'planner_base_hours', 'planner_weekday_multiplier', 'planner_saturday_multiplier', 'planner_sunday_holiday_multiplier', 'planner_time_off_debit']);
const dummySalt = randomBytes(16).toString('hex');
const dummyPasswordHash = `${dummySalt}:${scryptSync(randomBytes(32), dummySalt, 64).toString('hex')}`;
const mfaChallengeTtlSeconds = 5 * 60;
const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function configuredMfaKey() {
  const raw = String(process.env.MFA_ENCRYPTION_KEY || '').trim();
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  try { const decoded = Buffer.from(raw, 'base64'); if (decoded.length === 32) return decoded; } catch {}
  return null;
}
function encryptMfaSecret(secret) {
  const key = configuredMfaKey();
  if (!key) throw Object.assign(new Error('MFA wymaga ustawienia MFA_ENCRYPTION_KEY na Railway'), { statusCode: 503 });
  const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}
function decryptMfaSecret(value) {
  const key = configuredMfaKey();
  if (!key) return '';
  try {
    const [iv, tag, encrypted] = String(value || '').split('.').map(part => Buffer.from(part, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', key, iv); decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch { return ''; }
}
function base32Encode(buffer) {
  let bits = ''; for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let result = ''; for (let index = 0; index < bits.length; index += 5) result += base32Alphabet[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  return result;
}
function base32Decode(value) {
  let bits = ''; for (const character of String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '')) { const index = base32Alphabet.indexOf(character); if (index < 0) return Buffer.alloc(0); bits += index.toString(2).padStart(5, '0'); }
  const bytes = []; for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}
function totpCode(secret, counter) {
  const counterBuffer = Buffer.alloc(8); counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 15;
  const number = (digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(number).padStart(6, '0');
}
function verifyTotp(secret, submitted) {
  const code = String(submitted || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(code) || !secret) return false;
  const counter = Math.floor(Date.now() / 30000);
  return [-1, 0, 1].some(offset => {
    const expected = Buffer.from(totpCode(secret, counter + offset)); const actual = Buffer.from(code);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  });
}
const recoveryCodeHash = code => createHash('sha256').update(String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');
function createRecoveryCodes() {
  return Array.from({ length: 10 }, () => randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g).join('-'));
}
async function createMfaChallenge(userId) {
  const token = randomBytes(32).toString('hex');
  if (redis) await redis.set(`${redisPrefix}:mfa-challenge:${token}`, String(userId), { EX: mfaChallengeTtlSeconds });
  else {
    const now = Date.now();
    for (const [storedToken, challenge] of loginChallenges) if (challenge.expiresAt <= now) loginChallenges.delete(storedToken);
    while (loginChallenges.size >= 10000) loginChallenges.delete(loginChallenges.keys().next().value);
    loginChallenges.set(token, { userId: Number(userId), expiresAt: now + mfaChallengeTtlSeconds * 1000 });
  }
  return token;
}
async function consumeMfaChallenge(token) {
  if (!token) return null;
  if (redis) return Number(await redis.getDel(`${redisPrefix}:mfa-challenge:${token}`)) || null;
  const challenge = loginChallenges.get(token); loginChallenges.delete(token);
  return challenge?.expiresAt > Date.now() ? challenge.userId : null;
}
function logSecurityEvent(request, eventType, outcome, account = null, details = {}) {
  try {
    repository.logSecurityEvent({ user_id: account?.id, username: account?.username || details.username || '', event_type: eventType, outcome,
      ip_address: requestAddress(request), user_agent: String(request.headers['user-agent'] || ''), details });
  } catch (error) { console.error('Security event log:', error.message); }
}

function json(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  response.end(JSON.stringify(payload));
}
function download(response, buffer, contentType, filename) {
  response.writeHead(200, { ...securityHeaders, 'Content-Type': contentType, 'Content-Length': buffer.length, 'Content-Disposition': `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}"`, 'Cache-Control': 'no-store' });
  response.end(buffer);
}
async function readJson(request, byteLimit = maxJsonBytes) {
  const declaredLength = Number(request.headers['content-length'] || 0);
  if (Number.isFinite(declaredLength) && declaredLength > byteLimit) throw Object.assign(new Error('Żądanie jest zbyt duże'), { statusCode: 413 });
  let content = '';
  let receivedBytes = 0;
  for await (const chunk of request) { receivedBytes += chunk.length; if (receivedBytes > byteLimit) throw Object.assign(new Error('Żądanie jest zbyt duże'), { statusCode: 413 }); content += chunk; }
  if (!content) return {};
  try { return JSON.parse(content); } catch { throw Object.assign(new Error('Nieprawidłowy JSON'), { statusCode: 400 }); }
}
function cookies(request) {
  const result = {};
  for (const part of String(request.headers.cookie || '').split(';')) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    try { result[decodeURIComponent(part.slice(0, separator).trim())] = decodeURIComponent(part.slice(separator + 1).trim()); } catch {}
  }
  return result;
}
function sessionCookie(request, value, maxAge) {
  const https = request.socket.encrypted || String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return `plc_session=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${https ? '; Secure' : ''}`;
}
async function activeSession(request) {
  const token = cookies(request).plc_session;
  if (!token) return null;
  let session;
  if (redis) {
    const stored = await redis.get(`${redisPrefix}:session:${token}`);
    try { session = stored ? JSON.parse(stored) : null; } catch { session = null; }
  } else session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) { await deleteSession(token, session?.userId); return null; }
  return { token, session };
}
async function saveSession(token, session) {
  if (redis) {
    const ttl = Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000));
    await redis.multi()
      .set(`${redisPrefix}:session:${token}`, JSON.stringify(session), { EX: ttl })
      .zAdd(`${redisPrefix}:user-sessions:${session.userId}`, { score: Date.now(), value: token })
      .expire(`${redisPrefix}:user-sessions:${session.userId}`, ttl)
      .exec();
  } else sessions.set(token, session);
}
async function deleteSession(token, userId = null) {
  if (!token) return;
  if (redis) {
    const id = Number(userId) || null;
    await redis.del(`${redisPrefix}:session:${token}`);
    if (id) await redis.zRem(`${redisPrefix}:user-sessions:${id}`, token);
  } else sessions.delete(token);
}
async function revokeUserSessions(userId, exceptToken = '') {
  if (redis) {
    const key = `${redisPrefix}:user-sessions:${Number(userId)}`;
    const tokens = await redis.zRange(key, 0, -1);
    const removed = tokens.filter(token => token !== exceptToken);
    if (removed.length) await redis.del(removed.map(token => `${redisPrefix}:session:${token}`));
    if (exceptToken) {
      await redis.del(key);
      await redis.zAdd(key, { score: Date.now(), value: exceptToken });
      await redis.expire(key, sessionTtlSeconds);
    } else await redis.del(key);
    return;
  }
  for (const [token, session] of sessions) if (session.userId === Number(userId) && token !== exceptToken) sessions.delete(token);
}
async function createUserSession(userId, projectId = null) {
  const token = randomBytes(32).toString('hex');
  const expiresAt = Date.now() + sessionTtlSeconds * 1000;
  const session = { userId: Number(userId), projectId: projectId ? Number(projectId) : null, expiresAt };
  if (redis) {
    const key = `${redisPrefix}:user-sessions:${session.userId}`;
    const count = await redis.zCard(key);
    const existing = count >= 10 ? await redis.zRange(key, 0, count - 10) : [];
    if (existing.length) await redis.del(existing.map(storedToken => `${redisPrefix}:session:${storedToken}`));
    if (existing.length) await redis.zRem(key, existing);
  } else {
    for (const [storedToken, storedSession] of sessions) if (storedSession.expiresAt < Date.now()) sessions.delete(storedToken);
    const userSessions = [...sessions.entries()].filter(([, storedSession]) => storedSession.userId === Number(userId)).sort((left, right) => left[1].expiresAt - right[1].expiresAt);
    while (userSessions.length >= 10) sessions.delete(userSessions.shift()[0]);
  }
  await saveSession(token, session);
  return token;
}
function requestAddress(request) {
  const forwarded = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (forwarded || request.socket.remoteAddress || 'unknown').slice(0, 128);
}
async function failureState(key, limit = loginFailureLimit) {
  if (redis) {
    const redisKey = `${redisPrefix}:login:${key}`;
    const [rawCount, ttl] = await Promise.all([redis.get(redisKey), redis.ttl(redisKey)]);
    const count = Number(rawCount || 0);
    return { key, redisKey, attempts: count, blocked: count >= limit, retryAfter: ttl > 0 ? ttl : Math.ceil(loginWindowMs / 1000) };
  }
  const cutoff = Date.now() - loginWindowMs;
  const attempts = (loginFailures.get(key) || []).filter(timestamp => timestamp > cutoff);
  if (attempts.length) loginFailures.set(key, attempts); else loginFailures.delete(key);
  return { key, attempts, blocked: attempts.length >= limit, retryAfter: attempts.length ? Math.max(1, Math.ceil((attempts[0] + loginWindowMs - Date.now()) / 1000)) : 1 };
}
function loginFailureState(request) { return failureState(`ip:${requestAddress(request)}`); }
async function recordLoginFailure(key, attempts) {
  if (redis) {
    const redisKey = `${redisPrefix}:login:${key}`;
    const count = await redis.incr(redisKey);
    await redis.expire(redisKey, Math.ceil(loginWindowMs / 1000));
    return count;
  }
  loginFailures.set(key, [...attempts, Date.now()]);
  if (loginFailures.size > 10000) {
    const cutoff = Date.now() - loginWindowMs;
    for (const [storedKey, timestamps] of loginFailures) if (!timestamps.some(timestamp => timestamp > cutoff)) loginFailures.delete(storedKey);
    for (const storedKey of loginFailures.keys()) { if (loginFailures.size <= 10000) break; loginFailures.delete(storedKey); }
  }
}
async function clearLoginFailures(...states) {
  if (redis) { const keys = states.map(state => state.redisKey).filter(Boolean); if (keys.length) await redis.del(keys); }
  else states.forEach(state => loginFailures.delete(state.key));
}
async function currentUser(request) { const active = await activeSession(request); return active ? repository.me(active.session.userId, active.session.projectId || null) : null; }
function requireRole(user, role = 'user') {
  const hierarchy = { user: 1, moderator: 2, project_admin: 3, system_admin: 4 };
  if (!user || Number(hierarchy[user.role] || 0) < Number(hierarchy[role] || 1)) throw Object.assign(new Error(user ? 'Brak uprawnień' : 'Zaloguj się'), { statusCode: user ? 403 : 401 });
}
function requireExternalDependencyAccess(user) {
  const allowedByRole = ['moderator', 'project_admin', 'system_admin'].includes(user?.role);
  if (!allowedByRole && !Number(user?.current_project?.can_manage_external_dependencies)) throw Object.assign(new Error('Brak uprawnień do modyfikowania zależności zewnętrznych'), { statusCode: 403 });
}
function numericId(pathname, prefix) { const match = pathname.match(new RegExp(`^${prefix}/(\\d+)$`)); return match ? Number(match[1]) : null; }
function projectFilename(project, suffix, extension) { return `${project.code}_${suffix}_${new Date().toISOString().slice(0, 10)}.${extension}`; }
function openEventStream(request, response, projectId, userId, clientId) {
  response.writeHead(200, {
    ...securityHeaders,
    'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no'
  });
  response.write(`event: ready\ndata: ${JSON.stringify({ project_id: projectId })}\n\n`);
  const client = { response, projectId: Number(projectId), userId: Number(userId), clientId: String(clientId || '') };
  liveClients.add(client);
  const heartbeat = setInterval(async () => {
    try {
      const active = await activeSession(request);
      const current = active ? repository.me(active.session.userId, active.session.projectId || null) : null;
      if (!active || Number(active.session.userId) !== Number(userId) || Number(active.session.projectId) !== Number(projectId) || !current?.current_project) {
        clearInterval(heartbeat); liveClients.delete(client); response.end(); return;
      }
      response.write(': heartbeat\n\n');
    } catch { clearInterval(heartbeat); liveClients.delete(client); response.end(); }
  }, 20000);
  heartbeat.unref();
  request.on('close', () => { clearInterval(heartbeat); liveClients.delete(client); });
}
function broadcastProjectChange(projectId, payload) {
  const body = `event: change\ndata: ${JSON.stringify({ at: payload.at, client_id: payload.client_id })}\n\n`;
  for (const client of liveClients) {
    if (client.projectId !== Number(projectId)) continue;
    try { client.response.write(body); } catch { liveClients.delete(client); }
  }
}
function broadcastPlannerChange(payload) {
  const body = `event: change\ndata: ${JSON.stringify({ at: payload.at, client_id: payload.client_id, global_planner: true })}\n\n`;
  for (const client of liveClients) {
    try { client.response.write(body); } catch { liveClients.delete(client); }
  }
}

async function handleProjectApi(request, response, url, user) {
  const method = request.method || 'GET';
  const path = url.pathname;
  const scope = url.searchParams.get('controller') || 'all';
  const project = user.current_project;

  if (method === 'GET' && path === '/api/controllers') return json(response, 200, repository.controllers());
  if (method === 'GET' && path === '/api/controller-groups') return json(response, 200, repository.controllerGroups());
  if (method === 'GET' && path === '/api/users') {
    if (['system_admin', 'project_admin'].includes(user.role)) return json(response, 200, repository.users());
    return json(response, 200, repository.projectUsers({ includeAccountDetails: user.role === 'moderator' }));
  }
  if (method === 'GET' && path === '/api/config') return json(response, 200, repository.config());
  if (method === 'GET' && path === '/api/dashboard') return json(response, 200, repository.dashboard(scope));
  if (method === 'GET' && path === '/api/overview') return json(response, 200, repository.overview(scope));
  if (method === 'GET' && path === '/api/my-summary') return json(response, 200, repository.mySummary(user));
  if (method === 'GET' && path === '/api/navigation-counts') return json(response, 200, repository.navigationCounts(user));
  if (method === 'GET' && path === '/api/audit') return json(response, 200, repository.audit(url.searchParams.get('type'), Number(url.searchParams.get('id'))));
  if (method === 'GET' && path === '/api/history') return json(response, 200, repository.history({ types: url.searchParams.getAll('type'), limit: url.searchParams.get('limit') }));
  if (method === 'GET' && path === '/api/daily-summary') return json(response, 200, repository.dailySummary(url.searchParams.get('from'), url.searchParams.get('to'), user));
  if (method === 'GET' && path === '/api/saved-views') return json(response, 200, repository.savedViews(user));
  if (method === 'POST' && path === '/api/saved-views') return json(response, 201, repository.saveSavedView(null, await readJson(request), user));
  let savedViewId = numericId(path, '/api/saved-views');
  if (savedViewId !== null) {
    if (method === 'PATCH') return json(response, 200, repository.saveSavedView(savedViewId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteSavedView(savedViewId, user); response.writeHead(204); return response.end(); }
  }
  if (method === 'GET' && path === '/api/operations') { requireRole(user, 'moderator'); return json(response, 200, repository.operations(user, scope)); }
  if (method === 'PATCH' && path === '/api/triage/batch') { requireRole(user, 'moderator'); return json(response, 200, repository.triageBatch(await readJson(request), user)); }
  const orphanLinkId = path.match(/^\/api\/data-quality\/orphan-links\/(\d+)$/);
  if (orphanLinkId && method === 'DELETE') { requireRole(user, 'moderator'); return json(response, 200, repository.deleteOrphanLink(Number(orphanLinkId[1]))); }
  if (method === 'POST' && path === '/api/project-meetings') { requireRole(user, 'moderator'); return json(response, 201, repository.saveProjectMeeting(null, await readJson(request), user)); }
  if (method === 'GET' && path === '/api/project-meetings/candidates') { requireRole(user, 'moderator'); return json(response, 200, repository.meetingCandidates(url.searchParams.get('from'), url.searchParams.get('to'), user)); }
  if (method === 'GET' && path === '/api/meeting-summaries') return json(response, 200, repository.meetingSummaries(user));
  const meetingId = numericId(path, '/api/project-meetings');
  if (meetingId !== null) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.saveProjectMeeting(meetingId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteProjectMeeting(meetingId); response.writeHead(204); return response.end(); }
  }
  const meetingPublish = path.match(/^\/api\/project-meetings\/(\d+)\/publish$/);
  if (meetingPublish && method === 'POST') { requireRole(user, 'moderator'); return json(response, 200, repository.publishProjectMeeting(Number(meetingPublish[1]), user)); }
  if (method === 'GET' && path === '/api/external-dependencies') return json(response, 200, repository.externalDependencies(user));
  if (method === 'POST' && path === '/api/external-dependencies') { requireExternalDependencyAccess(user); return json(response, 201, repository.saveExternalDependency(null, await readJson(request), user)); }
  const externalDependencyUpdate = path.match(/^\/api\/external-dependencies\/(\d+)\/updates$/);
  if (externalDependencyUpdate && method === 'POST') { requireExternalDependencyAccess(user); return json(response, 201, repository.saveExternalDependencyUpdate(Number(externalDependencyUpdate[1]), await readJson(request), user)); }
  const externalDependencyId = numericId(path, '/api/external-dependencies');
  if (externalDependencyId !== null) {
    requireExternalDependencyAccess(user);
    if (method === 'PATCH') return json(response, 200, repository.saveExternalDependency(externalDependencyId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteExternalDependency(externalDependencyId); response.writeHead(204); return response.end(); }
  }
  if (method === 'GET' && path === '/api/similar-history') return json(response, 200, repository.similarHistory(url.searchParams.get('type'), url.searchParams.get('q'), user));
  if (method === 'GET' && path === '/api/handovers') return json(response, 200, repository.handovers(user));
  if (method === 'POST' && path === '/api/handovers') return json(response, 201, repository.saveHandover(null, await readJson(request), user));
  const handoverAccept = path.match(/^\/api\/handovers\/(\d+)\/accept$/);
  if (handoverAccept && method === 'POST') return json(response, 200, repository.acceptHandover(Number(handoverAccept[1]), user));
  const handoverId = numericId(path, '/api/handovers');
  if (handoverId !== null) {
    if (method === 'PATCH') return json(response, 200, repository.saveHandover(handoverId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteHandover(handoverId, user); response.writeHead(204); return response.end(); }
  }
  if (method === 'GET' && path === '/api/automation-rules') { requireRole(user, 'moderator'); return json(response, 200, repository.automationRules()); }
  if (method === 'POST' && path === '/api/automation-rules') { requireRole(user, 'moderator'); return json(response, 201, repository.saveAutomationRule(null, await readJson(request), user)); }
  if (method === 'POST' && path === '/api/automation-rules/run') { requireRole(user, 'moderator'); return json(response, 200, repository.runAutomations(user)); }
  const automationRuleRun = path.match(/^\/api\/automation-rules\/(\d+)\/run$/);
  if (automationRuleRun && method === 'POST') { requireRole(user, 'moderator'); return json(response, 200, repository.runAutomationRule(Number(automationRuleRun[1]), user)); }
  const automationRuleId = numericId(path, '/api/automation-rules');
  if (automationRuleId !== null) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.saveAutomationRule(automationRuleId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteAutomationRule(automationRuleId); response.writeHead(204); return response.end(); }
  }
  if (method === 'GET' && path === '/api/monthly-reviews') {
    requireRole(user, 'moderator');
    return json(response, 200, repository.monthlyEmployeeReviews(url.searchParams.get('period')));
  }
  if (method === 'POST' && path === '/api/monthly-reviews') {
    requireRole(user, 'moderator');
    return json(response, 201, repository.createMonthlyEmployeeReview(await readJson(request), user));
  }
  const monthlyReviewAction = path.match(/^\/api\/monthly-reviews\/(\d+)\/action$/);
  if (monthlyReviewAction && method === 'POST') {
    requireRole(user, 'moderator');
    const body = await readJson(request);
    if (['lock', 'reopen'].includes(body.action)) requireRole(user, 'project_admin');
    return json(response, 200, repository.actionMonthlyEmployeeReview(Number(monthlyReviewAction[1]), body, user));
  }
  const monthlyReviewId = numericId(path, '/api/monthly-reviews');
  if (monthlyReviewId !== null) {
    requireRole(user, 'moderator');
    if (method === 'GET') return json(response, 200, repository.monthlyEmployeeReview(monthlyReviewId));
    if (method === 'PATCH') return json(response, 200, repository.saveMonthlyEmployeeReview(monthlyReviewId, await readJson(request), user));
  }
  if (method === 'GET' && path === '/api/planner') return json(response, 200, repository.planner(url.searchParams.get('from'), url.searchParams.get('to'), user));
  if (method === 'PUT' && path === '/api/planner/day') { requireRole(user, 'moderator'); return json(response, 200, repository.savePlannerDay(await readJson(request), user)); }
  if (method === 'POST' && path === '/api/planner/move') { requireRole(user, 'moderator'); return json(response, 200, repository.movePlannerEntry(await readJson(request), user)); }
  const plannerEntryId = numericId(path, '/api/planner/entries');
  if (plannerEntryId !== null && method === 'DELETE') { requireRole(user, 'moderator'); return json(response, 200, repository.deletePlannerEntry(plannerEntryId, user)); }
  if (method === 'POST' && path === '/api/planner/move-day') { requireRole(user, 'moderator'); return json(response, 200, repository.movePlannerDay(await readJson(request), user)); }
  if (method === 'POST' && path === '/api/planner/overlaps/action') { requireRole(user, 'moderator'); return json(response, 200, repository.reviewPlannerOverlap(await readJson(request), user)); }
  if (method === 'PUT' && path === '/api/planner/requirements') { requireRole(user, 'moderator'); return json(response, 200, repository.setPlannerRequirements(await readJson(request), user)); }
  if (method === 'PUT' && path === '/api/planner/requirements/batch') { requireRole(user, 'moderator'); return json(response, 200, repository.setPlannerRequirementsBatch(await readJson(request), user)); }
  if (method === 'POST' && path === '/api/planner/holidays') { requireRole(user, 'moderator'); return json(response, 201, repository.savePlannerHoliday(null, await readJson(request), user)); }
  if (method === 'POST' && path === '/api/planner/holidays/bulk') { requireRole(user, 'moderator'); return json(response, 201, repository.savePlannerHolidaysBulk(await readJson(request), user)); }
  const holidayId = numericId(path, '/api/planner/holidays');
  if (holidayId !== null) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.savePlannerHoliday(holidayId, await readJson(request), user));
    if (method === 'DELETE') { repository.deletePlannerHoliday(holidayId); response.writeHead(204); return response.end(); }
  }
  if (method === 'POST' && path === '/api/planner/assign-work') { requireRole(user, 'moderator'); return json(response, 200, repository.assignPlannerWork(await readJson(request), user)); }
  if (method === 'GET' && path === '/api/announcements') return json(response, 200, repository.announcements(user));
  if (method === 'POST' && path === '/api/announcements') { requireRole(user, 'moderator'); return json(response, 201, repository.saveAnnouncement(null, await readJson(request), user)); }
  const announcementAck = path.match(/^\/api\/announcements\/(\d+)\/ack$/);
  if (announcementAck && method === 'POST') return json(response, 200, repository.acknowledgeAnnouncement(Number(announcementAck[1]), user));
  const announcementId = numericId(path, '/api/announcements');
  if (announcementId !== null) {
    if (method === 'PATCH') requireRole(user, 'moderator');
    if (method === 'DELETE') requireRole(user, 'project_admin');
    if (method === 'PATCH') return json(response, 200, repository.saveAnnouncement(announcementId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteAnnouncement(announcementId); response.writeHead(204); return response.end(); }
  }
  if (method === 'GET' && path === '/api/notifications') return json(response, 200, repository.notifications(user, url.searchParams.get('limit')));
  const notificationRead = path.match(/^\/api\/notifications\/(\d+)\/read$/);
  if (notificationRead && method === 'POST') return json(response, 200, repository.markNotificationRead(Number(notificationRead[1]), user));
  if (method === 'POST' && path === '/api/comments') return json(response, 201, repository.addComment(await readJson(request), user));
  const entityLock = path.match(/^\/api\/entity-locks\/(status|task|point|goal)\/(\d+)$/);
  if (entityLock) {
    requireRole(user, 'moderator');
    if (method === 'POST') return json(response, 200, repository.setEntityEditLock(entityLock[1], Number(entityLock[2]), await readJson(request), user));
    if (method === 'DELETE') return json(response, 200, repository.clearEntityEditLock(entityLock[1], Number(entityLock[2]), user));
  }
  if (method === 'GET' && path === '/api/calendar') return json(response, 200, repository.calendar({
    from: url.searchParams.get('from'), to: url.searchParams.get('to'), scope,
    types: url.searchParams.getAll('type'), priorities: url.searchParams.getAll('priority'), category: url.searchParams.get('category'), only_mine: url.searchParams.get('only_mine') === '1'
  }, user));
  if (method === 'GET' && path === '/api/calendar/annotations') { requireRole(user, 'moderator'); return json(response, 200, repository.calendarAnnotations()); }
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
    logSecurityEvent(request, 'project_backup_exported', 'success', repository.securityAccount(user.id), { project_id: project.id });
    return download(response, Buffer.from(JSON.stringify(repository.projectBackup(), null, 2)), 'application/json; charset=utf-8', projectFilename(project, 'backup', 'json'));
  }
  if (method === 'POST' && path === '/api/backup/restore') { requireRole(user, 'project_admin'); const input = await readJson(request, 50_000_000); const result = repository.restoreProjectBackup(input.backup || input); logSecurityEvent(request, 'project_backup_restored', 'success', repository.securityAccount(user.id), { project_id: project.id }); return json(response, 200, result); }
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
  if (method === 'POST' && path === '/api/status/bulk-create') return json(response, 201, repository.bulkCreateStatus(await readJson(request), user));
  if (method === 'POST' && path === '/api/status-layout/import') { requireRole(user, 'moderator'); return json(response, 200, repository.importStatusLayout(await readJson(request, 2_000_000))); }
  if (method === 'POST' && path === '/api/status-layout/copy') { requireRole(user, 'moderator'); return json(response, 200, repository.copyStatusLayoutElements(await readJson(request))); }
  const statusCellMatch = path.match(/^\/api\/status\/(\d+)\/cells\/(\d+)$/);
  if (statusCellMatch && method === 'PATCH') return json(response, 200, repository.saveStatusCell(Number(statusCellMatch[1]), Number(statusCellMatch[2]), await readJson(request), user));
  const taskRecurrenceSkip = path.match(/^\/api\/tasks\/(\d+)\/skip-recurrence$/);
  if (taskRecurrenceSkip && method === 'POST') return json(response, 200, repository.skipRecurringTask(Number(taskRecurrenceSkip[1]), user));

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
        if (resource.deleteRole === 'owner' && user.role === 'moderator') throw Object.assign(new Error('Manager projektu nie może usuwać elementów'), { statusCode: 403 });
        resource.remove(recordId); response.writeHead(204); return response.end();
      }
    }
  }

  if (path === '/api/users' && method === 'POST') { requireRole(user, 'system_admin'); return json(response, 201, repository.saveUser(null, await readJson(request))); }
  const userPasswordMatch = path.match(/^\/api\/users\/(\d+)\/password$/);
  if (userPasswordMatch && method === 'PUT') {
    requireRole(user, 'system_admin');
    const targetUserId = Number(userPasswordMatch[1]);
    const result = repository.resetUserPassword(targetUserId, await readJson(request));
    await revokeUserSessions(targetUserId);
    logSecurityEvent(request, 'password_reset_by_admin', 'success', repository.securityAccount(targetUserId), { actor_user_id: user.id });
    return json(response, 200, result);
  }
  let id = numericId(path, '/api/users');
  if (id !== null) {
    requireRole(user, 'project_admin');
    if (method === 'PATCH') {
      const input = await readJson(request);
      const target = repository.users().find(item => item.id === id);
      const protectedProjectFields = new Set(['planner_enabled', 'assignable', 'can_manage_external_dependencies']);
      if (user.role !== 'system_admin' && (target?.system_role === 'system_admin' || target?.project_role === 'project_admin') && Object.keys(input).some(key => !protectedProjectFields.has(key))) throw Object.assign(new Error('Dla administratora możesz tutaj zmienić wyłącznie ustawienia udziału w modułach projektu'), { statusCode: 403 });
      const safe = user.role === 'system_admin' ? input : (target?.system_role === 'system_admin' || target?.project_role === 'project_admin') ? { planner_enabled: input.planner_enabled, assignable: input.assignable, can_manage_external_dependencies: input.can_manage_external_dependencies } : { project_role: input.project_role, project_active: input.project_active, planner_enabled: input.planner_enabled, assignable: input.assignable, can_manage_external_dependencies: input.can_manage_external_dependencies };
      if (user.role !== 'system_admin' && Object.hasOwn(safe, 'project_role') && !['user', 'moderator'].includes(safe.project_role)) throw Object.assign(new Error('Administrator projektu może przydzielać wyłącznie role managera projektu i użytkownika'), { statusCode: 403 });
      const result = repository.saveUser(id, safe);
      if (Object.hasOwn(safe, 'password') || Number(safe.active) === 0) await revokeUserSessions(id);
      if (['project_role', 'project_active', 'active', 'system_role'].some(field => Object.hasOwn(safe, field))) logSecurityEvent(request, 'account_access_changed', 'success', repository.securityAccount(id), { actor_user_id: user.id, project_id: user.current_project?.id });
      return json(response, 200, result);
    }
    if (method === 'DELETE') { requireRole(user, 'system_admin'); if (id === user.id) throw Object.assign(new Error('Nie możesz usunąć własnego konta'), { statusCode: 400 }); const deletedAccount = repository.securityAccount(id); logSecurityEvent(request, 'account_deleted', 'success', null, { actor_user_id: user.id, username: deletedAccount?.username || '' }); await revokeUserSessions(id); repository.deleteUser(id); response.writeHead(204, securityHeaders); return response.end(); }
  }
  const userAreaMatch = path.match(/^\/api\/users\/(\d+)\/areas$/);
  if (userAreaMatch && method === 'PUT') { requireRole(user, 'project_admin'); return json(response, 200, repository.saveUserAreas(Number(userAreaMatch[1]), await readJson(request))); }
  const userPlannerMatch = path.match(/^\/api\/users\/(\d+)\/planner$/);
  if (userPlannerMatch && method === 'PUT') { requireRole(user, 'project_admin'); return json(response, 200, repository.setPlannerEnabled(Number(userPlannerMatch[1]), await readJson(request))); }
  if (path === '/api/my-summary/preferences' && method === 'PUT') return json(response, 200, repository.saveSummaryPreference(user.id, await readJson(request)));

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

  if (path === '/api/status-groups' && method === 'POST') { requireRole(user, 'moderator'); return json(response, 201, repository.saveStatusGroup(null, await readJson(request))); }
  match = path.match(/^\/api\/status-groups\/(\d+)\/subgroups\/(\d+)\/columns(?:\/(\d+))?$/);
  if (match) {
    requireRole(user, 'moderator'); const groupId = Number(match[1]); const subgroupId = Number(match[2]); const columnId = match[3] ? Number(match[3]) : null;
    if (method === 'POST' && !columnId) return json(response, 201, repository.saveStatusColumn(groupId, subgroupId, null, await readJson(request)));
    if (method === 'PATCH' && columnId) return json(response, 200, repository.saveStatusColumn(groupId, subgroupId, columnId, await readJson(request)));
    if (method === 'DELETE' && columnId) { repository.deleteStatusColumn(groupId, subgroupId, columnId); response.writeHead(204); return response.end(); }
  }
  match = path.match(/^\/api\/status-groups\/(\d+)\/columns(?:\/(\d+))?$/);
  if (match) {
    requireRole(user, 'moderator'); const groupId = Number(match[1]); const columnId = match[2] ? Number(match[2]) : null;
    if (method === 'POST' && !columnId) return json(response, 201, repository.saveStatusColumn(groupId, null, null, await readJson(request)));
    if (method === 'PATCH' && columnId) return json(response, 200, repository.saveStatusColumn(groupId, null, columnId, await readJson(request)));
    if (method === 'DELETE' && columnId) { repository.deleteStatusColumn(groupId, null, columnId); response.writeHead(204); return response.end(); }
  }
  match = path.match(/^\/api\/status-groups\/(\d+)\/subgroups(?:\/(\d+))?$/);
  if (match) {
    requireRole(user, 'moderator'); const groupId = Number(match[1]); const subgroupId = match[2] ? Number(match[2]) : null;
    if (method === 'POST' && !subgroupId) return json(response, 201, repository.saveStatusSubgroup(groupId, null, await readJson(request)));
    if (method === 'PATCH' && subgroupId) return json(response, 200, repository.saveStatusSubgroup(groupId, subgroupId, await readJson(request)));
    if (method === 'DELETE' && subgroupId) { repository.deleteStatusSubgroup(groupId, subgroupId); response.writeHead(204); return response.end(); }
  }
  id = numericId(path, '/api/status-groups');
  if (id !== null) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.saveStatusGroup(id, await readJson(request)));
    if (method === 'DELETE') { repository.deleteStatusGroup(id); response.writeHead(204); return response.end(); }
  }

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

  if (path === '/api/status-workflow-states' && method === 'POST') { requireRole(user, 'moderator'); return json(response, 201, repository.saveStatusWorkflowState(null, await readJson(request))); }
  id = numericId(path, '/api/status-workflow-states');
  if (id !== null) {
    if (method === 'PATCH') { requireRole(user, 'moderator'); return json(response, 200, repository.saveStatusWorkflowState(id, await readJson(request))); }
    if (method === 'DELETE') { requireRole(user, 'project_admin'); repository.deleteStatusWorkflowState(id); response.writeHead(204); return response.end(); }
  }

  if (path === '/api/completion-requirements' && method === 'POST') { requireRole(user, 'moderator'); return json(response, 201, repository.saveCompletionRequirement(null, await readJson(request))); }
  id = numericId(path, '/api/completion-requirements');
  if (id !== null) {
    if (method === 'PATCH') { requireRole(user, 'moderator'); return json(response, 200, repository.saveCompletionRequirement(id, await readJson(request))); }
    if (method === 'DELETE') { requireRole(user, 'project_admin'); repository.deleteCompletionRequirement(id); response.writeHead(204); return response.end(); }
  }

  if (path === '/api/announcement-labels' && method === 'POST') { requireRole(user, 'moderator'); return json(response, 201, repository.saveAnnouncementLabel(null, await readJson(request))); }
  id = numericId(path, '/api/announcement-labels');
  if (id !== null) {
    if (method === 'PATCH') { requireRole(user, 'moderator'); return json(response, 200, repository.saveAnnouncementLabel(id, await readJson(request))); }
    if (method === 'DELETE') { requireRole(user, 'project_admin'); repository.deleteAnnouncementLabel(id); response.writeHead(204); return response.end(); }
  }

  if (path === '/api/export-templates' && method === 'POST') { requireRole(user, 'project_admin'); return json(response, 201, repository.saveExportTemplate(null, await readJson(request), user)); }
  id = numericId(path, '/api/export-templates');
  if (id !== null) { requireRole(user, 'project_admin'); if (method === 'PATCH') return json(response, 200, repository.saveExportTemplate(id, await readJson(request), user)); if (method === 'DELETE') { repository.deleteExportTemplate(id); response.writeHead(204); return response.end(); } }
  if (method === 'PATCH' && path === '/api/reorder') {
    const input = await readJson(request);
    if (['controllers', 'controller_groups', 'users', 'function_groups', 'function_group_elements', 'function_group_subcategories', 'export_templates'].includes(input.kind)) requireRole(user, 'project_admin'); else requireRole(user, 'moderator');
    repository.reorder(input.kind, input.ids); return json(response, 200, { ok: true });
  }
  if (method === 'PATCH' && path.startsWith('/api/settings/')) {
    const key = decodeURIComponent(path.slice('/api/settings/'.length));
    requireRole(user, managerSettingKeys.has(key) ? 'moderator' : 'project_admin');
    const input = await readJson(request); repository.saveSetting(key, input.value); return json(response, 200, { ok: true });
  }
  return json(response, 404, { error: 'Nie znaleziono endpointu' });
}

async function handleApi(request, response, url) {
  const method = request.method || 'GET'; const path = url.pathname;
  if (method === 'GET' && path === '/api/health') return json(response, 200, { status: 'ok', version: '1.0.0', release: '1.0.0', session_store: redis ? 'redis' : 'memory' });
  if (method === 'POST' && path === '/api/login') {
    const input = await readJson(request);
    const username = String(input.username || '').trim().slice(0, 101);
    const password = String(input.password || '');
    const [throttle, accountThrottle] = await Promise.all([loginFailureState(request), failureState(`account:${username.toLocaleLowerCase('pl-PL')}`, 30)]);
    if (throttle.blocked || accountThrottle.blocked) {
      logSecurityEvent(request, 'login_throttled', 'blocked', null, { username });
      return json(response, 429, { error: 'Zbyt wiele nieudanych prób logowania. Spróbuj ponownie później.' }, { 'Retry-After': String(Math.max(throttle.retryAfter, accountThrottle.retryAfter)) });
    }
    const account = username.length <= 100 ? repository.authenticate(username) : null;
    const passwordForCheck = password.length <= 256 ? password : '';
    const passwordMatches = verifyPassword(passwordForCheck, account?.password_hash || dummyPasswordHash);
    if (!account || !passwordMatches || password.length > 256) {
      await Promise.all([recordLoginFailure(throttle.key, throttle.attempts), recordLoginFailure(accountThrottle.key, accountThrottle.attempts)]);
      const [latest, latestAccount] = await Promise.all([loginFailureState(request), failureState(accountThrottle.key, 30)]);
      logSecurityEvent(request, 'login_password', latest.blocked || latestAccount.blocked ? 'blocked' : 'failure', account, { username });
      if (latest.blocked || latestAccount.blocked) return json(response, 429, { error: 'Zbyt wiele nieudanych prób logowania. Spróbuj ponownie później.' }, { 'Retry-After': String(Math.max(latest.retryAfter, latestAccount.retryAfter)) });
      return json(response, 401, { error: 'Nieprawidłowy login lub hasło' });
    }
    await clearLoginFailures(throttle, accountThrottle);
    if (Number(account.mfa_enabled)) {
      if (!decryptMfaSecret(account.mfa_secret_cipher)) {
        logSecurityEvent(request, 'login_mfa_configuration', 'failure', account);
        return json(response, 503, { error: 'MFA tego konta wymaga poprawnej konfiguracji MFA_ENCRYPTION_KEY' });
      }
      const challengeToken = await createMfaChallenge(account.id);
      logSecurityEvent(request, 'login_mfa_challenge', 'info', account);
      return json(response, 202, { mfa_required: true, challenge_token: challengeToken });
    }
    const token = await createUserSession(account.id);
    logSecurityEvent(request, 'login', 'success', account, { mfa: false });
    return json(response, 200, repository.me(account.id, null), { 'Set-Cookie': sessionCookie(request, token, sessionTtlSeconds) });
  }
  if (method === 'POST' && path === '/api/login/mfa') {
    const input = await readJson(request);
    const mfaThrottle = await failureState(`mfa-ip:${requestAddress(request)}`);
    if (mfaThrottle.blocked) {
      logSecurityEvent(request, 'login_mfa', 'blocked');
      return json(response, 429, { error: 'Zbyt wiele nieudanych prób MFA. Spróbuj ponownie później.' }, { 'Retry-After': String(mfaThrottle.retryAfter) });
    }
    const userId = await consumeMfaChallenge(String(input.challenge_token || ''));
    const account = userId ? repository.securityAccount(userId) : null;
    if (!account || !Number(account.mfa_enabled)) {
      await recordLoginFailure(mfaThrottle.key, mfaThrottle.attempts);
      logSecurityEvent(request, 'login_mfa', 'failure');
      return json(response, 401, { error: 'Wyzwanie MFA wygasło. Zaloguj się ponownie.' });
    }
    const secret = decryptMfaSecret(account.mfa_secret_cipher);
    const code = String(input.code || '');
    const valid = verifyTotp(secret, code) || repository.consumeMfaRecoveryCode(account.id, recoveryCodeHash(code));
    if (!valid) {
      await recordLoginFailure(mfaThrottle.key, mfaThrottle.attempts);
      logSecurityEvent(request, 'login_mfa', 'failure', account);
      return json(response, 401, { error: 'Nieprawidłowy kod MFA. Zaloguj się ponownie.' });
    }
    await clearLoginFailures(mfaThrottle);
    const token = await createUserSession(account.id);
    logSecurityEvent(request, 'login', 'success', account, { mfa: true });
    return json(response, 200, repository.me(account.id, null), { 'Set-Cookie': sessionCookie(request, token, sessionTtlSeconds) });
  }
  if (method === 'POST' && path === '/api/logout') {
    const activeLogout = await activeSession(request);
    if (activeLogout) logSecurityEvent(request, 'logout', 'success', repository.securityAccount(activeLogout.session.userId));
    await deleteSession(cookies(request).plc_session, activeLogout?.session.userId);
    return json(response, 200, { ok: true }, { 'Set-Cookie': sessionCookie(request, '', 0) });
  }
  const active = await activeSession(request);
  if (!active) return json(response, 401, { error: 'Zaloguj się' });
  let user = repository.me(active.session.userId, active.session.projectId || null);
  if (!user) { await deleteSession(active.token, active.session.userId); return json(response, 401, { error: 'Konto jest nieaktywne' }); }
  if (method === 'GET' && path === '/api/me') return json(response, 200, user);
  if (method === 'GET' && path === '/api/projects/available') return json(response, 200, user.projects);
  if (method === 'GET' && path === '/api/account/security') {
    const account = repository.securityAccount(user.id);
    let recoveryCodes = [];
    try { recoveryCodes = JSON.parse(account?.mfa_recovery_codes_json || '[]'); } catch {}
    return json(response, 200, { mfa_enabled: Boolean(account?.mfa_enabled), mfa_available: Boolean(configuredMfaKey()), recovery_codes_remaining: Array.isArray(recoveryCodes) ? recoveryCodes.length : 0, recent_events: repository.securityEvents(user.id, 12) });
  }
  if (method === 'POST' && path === '/api/account/mfa/setup') {
    const input = await readJson(request); const account = repository.securityAccount(user.id);
    if (!account || !verifyPassword(String(input.current_password || ''), account.password_hash)) throw Object.assign(new Error('Bieżące hasło jest nieprawidłowe'), { statusCode: 403 });
    const secret = base32Encode(randomBytes(20));
    repository.beginMfaSetup(user.id, encryptMfaSecret(secret));
    const issuer = 'PLC Commissioning Hub';
    const uri = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account.username)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    logSecurityEvent(request, 'mfa_setup_started', 'success', account);
    return json(response, 200, { secret, otpauth_uri: uri });
  }
  if (method === 'POST' && path === '/api/account/mfa/enable') {
    const input = await readJson(request); const account = repository.securityAccount(user.id);
    if (!account || !verifyTotp(decryptMfaSecret(account.mfa_pending_secret_cipher), input.code)) throw Object.assign(new Error('Nieprawidłowy kod z aplikacji uwierzytelniającej'), { statusCode: 400 });
    const recoveryCodes = createRecoveryCodes();
    repository.enableMfa(user.id, recoveryCodes.map(recoveryCodeHash));
    await revokeUserSessions(user.id, active.token);
    logSecurityEvent(request, 'mfa_enabled', 'success', account);
    return json(response, 200, { enabled: true, recovery_codes: recoveryCodes });
  }
  if (method === 'DELETE' && path === '/api/account/mfa') {
    const input = await readJson(request); const account = repository.securityAccount(user.id);
    if (!account || !verifyPassword(String(input.current_password || ''), account.password_hash)) throw Object.assign(new Error('Bieżące hasło jest nieprawidłowe'), { statusCode: 403 });
    const code = String(input.code || '');
    if (!verifyTotp(decryptMfaSecret(account.mfa_secret_cipher), code) && !repository.consumeMfaRecoveryCode(user.id, recoveryCodeHash(code))) throw Object.assign(new Error('Nieprawidłowy kod MFA'), { statusCode: 403 });
    repository.disableMfa(user.id); await revokeUserSessions(user.id, active.token);
    logSecurityEvent(request, 'mfa_disabled', 'success', account);
    return json(response, 200, { enabled: false });
  }
  if (method === 'GET' && path === '/api/security/events') { requireRole(user, 'system_admin'); return json(response, 200, repository.securityEvents(null, url.searchParams.get('limit'))); }
  if (method === 'PATCH' && path === '/api/preferences') return json(response, 200, repository.setPreference(user.id, await readJson(request)));
  if (method === 'PUT' && path === '/api/account/password') {
    const result = repository.changeOwnPassword(user.id, await readJson(request));
    const selectedProjectId = active.session.projectId;
    await revokeUserSessions(user.id);
    const token = await createUserSession(user.id, selectedProjectId);
    logSecurityEvent(request, 'password_changed', 'success', repository.securityAccount(user.id));
    return json(response, 200, result, { 'Set-Cookie': sessionCookie(request, token, sessionTtlSeconds) });
  }
  if (method === 'POST' && path === '/api/select-project') {
    const input = await readJson(request); const selected = user.projects.find(project => project.id === Number(input.project_id));
    if (!selected) return json(response, 403, { error: 'Projekt jest niedostępny dla tego użytkownika' });
    active.session.projectId = selected.id; await saveSession(active.token, active.session); return json(response, 200, repository.me(user.id, selected.id));
  }
  if (path === '/api/projects') { requireRole(user, 'system_admin'); if (method === 'GET') return json(response, 200, repository.projects()); if (method === 'POST') return json(response, 201, repository.saveProject(null, await readJson(request))); }
  const projectId = numericId(path, '/api/projects');
  if (projectId !== null) {
    requireRole(user, 'system_admin');
    if (method === 'PATCH') return json(response, 200, repository.saveProject(projectId, await readJson(request)));
    if (method === 'DELETE') {
      const result = repository.deleteProject(projectId, await readJson(request));
      if (active.session.projectId === projectId) { active.session.projectId = null; await saveSession(active.token, active.session); }
      return json(response, 200, result);
    }
  }
  if (!user.current_project || !active.session.projectId) return json(response, 409, { error: 'Najpierw wybierz projekt', code: 'PROJECT_REQUIRED' });
  if (method === 'GET' && path === '/api/events') return openEventStream(request, response, active.session.projectId, user.id, url.searchParams.get('client_id'));
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const projectIdForEvent = active.session.projectId;
    response.once('finish', () => {
      if (response.statusCode < 400) {
        const payload = { method, path, at: new Date().toISOString(), client_id: String(request.headers['x-client-id'] || ''), user_id: user.id };
        if (path.startsWith('/api/planner')) broadcastPlannerChange(payload);
        else broadcastProjectChange(projectIdForEvent, payload);
      }
    });
  }
  return repository.withProject(active.session.projectId, () => handleProjectApi(request, response, url, user));
}

function serveStatic(response, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const filePath = resolve(publicDir, `.${requested}`);
  if (!(filePath === publicDir || filePath.startsWith(`${publicDir}${sep}`)) || !existsSync(filePath) || !statSync(filePath).isFile()) return json(response, 404, { error: 'Nie znaleziono pliku' });
  response.writeHead(200, { ...securityHeaders, 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream', 'Cache-Control': ['.html', '.js', '.css'].includes(extname(filePath)) ? 'no-cache, no-store, must-revalidate' : 'public,max-age=3600', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'" });
  createReadStream(filePath).pipe(response);
}

export const server = createServer(async (request, response) => {
  try {
    for (const [name, value] of Object.entries(securityHeaders)) response.setHeader(name, value);
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) return await handleApi(request, response, url);
    const publicLoginFiles = ['/login.html', '/login.js', '/styles.css'];
    const publicLoginAsset = url.pathname.startsWith('/assets/');
    if (!await currentUser(request) && !publicLoginAsset && !publicLoginFiles.includes(url.pathname)) return serveStatic(response, '/login.html');
    return serveStatic(response, url.pathname);
  } catch (error) {
    const statusCode = Number(error.statusCode) || (String(error.message).includes('UNIQUE constraint') ? 409 : 500);
    const requestId = randomBytes(6).toString('hex');
    if (statusCode >= 500 || String(error.message).includes('UNIQUE constraint')) console.error(`[${requestId}]`, error);
    const publicMessage = statusCode >= 500 ? 'Nieoczekiwany błąd serwera' : String(error.message).includes('UNIQUE constraint') ? 'Taki rekord już istnieje' : error.message;
    return json(response, statusCode, { error: publicMessage, request_id: requestId }, { 'X-Request-Id': requestId });
  }
});
let automationTimer = null;
let automationStartupTimer = null;
function runScheduledAutomations() {
  for (const projectId of repository.activeProjectIds()) {
    try {
      const result = repository.withProject(projectId, () => repository.runAutomations());
      if (result.executed) broadcastProjectChange(projectId, { method: 'AUTOMATION', path: '/api/automation-rules/run', at: new Date().toISOString(), client_id: '', user_id: null });
    } catch (error) { console.error(`Automation failed for project ${projectId}:`, error); }
  }
}
async function startServer() {
  if (redis) await redis.connect();
  server.listen(port, '0.0.0.0', () => {
    console.log(`PLC Commissioning Hub 1.0.0 running on port ${port}${redis ? ' · Redis sessions' : ''}`);
    automationStartupTimer = setTimeout(runScheduledAutomations, 5000); automationStartupTimer.unref();
    automationTimer = setInterval(runScheduledAutomations, 5 * 60 * 1000); automationTimer.unref();
  });
}
if (process.argv[1] === fileURLToPath(import.meta.url)) startServer().catch(error => { console.error('Startup failed:', error.message); repository.close(); process.exit(1); });
function shutdown() { clearTimeout(automationStartupTimer); clearInterval(automationTimer); server.close(async () => { if (redis?.isOpen) await redis.quit().catch(() => redis.disconnect()); repository.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
