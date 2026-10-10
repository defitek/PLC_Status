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
const liveClients = new Set();
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
function openEventStream(request, response, projectId, userId, clientId) {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive', 'X-Accel-Buffering': 'no'
  });
  response.write(`event: ready\ndata: ${JSON.stringify({ project_id: projectId })}\n\n`);
  const client = { response, projectId: Number(projectId), userId: Number(userId), clientId: String(clientId || '') };
  liveClients.add(client);
  const heartbeat = setInterval(() => response.write(': heartbeat\n\n'), 20000);
  heartbeat.unref();
  request.on('close', () => { clearInterval(heartbeat); liveClients.delete(client); });
}
function broadcastProjectChange(projectId, payload) {
  const body = `event: change\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of liveClients) {
    if (client.projectId !== Number(projectId)) continue;
    try { client.response.write(body); } catch { liveClients.delete(client); }
  }
}
function broadcastPlannerChange(payload) {
  const body = `event: change\ndata: ${JSON.stringify({ ...payload, global_planner: true })}\n\n`;
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
  if (method === 'GET' && path === '/api/users') return json(response, 200, repository.users());
  if (method === 'GET' && path === '/api/config') return json(response, 200, repository.config());
  if (method === 'GET' && path === '/api/dashboard') return json(response, 200, repository.dashboard(scope));
  if (method === 'GET' && path === '/api/overview') return json(response, 200, repository.overview(scope));
  if (method === 'GET' && path === '/api/my-summary') return json(response, 200, repository.mySummary(user));
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
  if (method === 'GET' && path === '/api/operations') { requireRole(user, 'moderator'); return json(response, 200, repository.operations(user)); }
  if (method === 'PATCH' && path === '/api/triage/batch') { requireRole(user, 'moderator'); return json(response, 200, repository.triageBatch(await readJson(request), user)); }
  const orphanLinkId = path.match(/^\/api\/data-quality\/orphan-links\/(\d+)$/);
  if (orphanLinkId && method === 'DELETE') { requireRole(user, 'moderator'); return json(response, 200, repository.deleteOrphanLink(Number(orphanLinkId[1]))); }
  if (method === 'GET' && path === '/api/commissioning') return json(response, 200, repository.commissioning(user));
  if (method === 'POST' && path === '/api/test-campaigns') { requireRole(user, 'moderator'); return json(response, 201, repository.saveTestCampaign(null, await readJson(request), user)); }
  const campaignItem = path.match(/^\/api\/test-campaigns\/(\d+)\/items\/(\d+)$/);
  if (campaignItem && method === 'PATCH') return json(response, 200, repository.updateTestCampaignItem(Number(campaignItem[1]), Number(campaignItem[2]), await readJson(request), user));
  const campaignId = numericId(path, '/api/test-campaigns');
  if (campaignId !== null) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.saveTestCampaign(campaignId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteTestCampaign(campaignId); response.writeHead(204); return response.end(); }
  }
  if (method === 'POST' && path === '/api/readiness-gates') { requireRole(user, 'moderator'); return json(response, 201, repository.saveReadinessGate(null, await readJson(request), user)); }
  const gateAction = path.match(/^\/api\/readiness-gates\/(\d+)\/action$/);
  if (gateAction && method === 'POST') { requireRole(user, 'moderator'); return json(response, 200, repository.actionReadinessGate(Number(gateAction[1]), await readJson(request), user)); }
  const gateId = numericId(path, '/api/readiness-gates');
  if (gateId !== null) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.saveReadinessGate(gateId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteReadinessGate(gateId); response.writeHead(204); return response.end(); }
  }
  if (method === 'POST' && path === '/api/project-meetings') { requireRole(user, 'moderator'); return json(response, 201, repository.saveProjectMeeting(null, await readJson(request), user)); }
  const meetingId = numericId(path, '/api/project-meetings');
  if (meetingId !== null) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.saveProjectMeeting(meetingId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteProjectMeeting(meetingId); response.writeHead(204); return response.end(); }
  }
  if (method === 'POST' && path === '/api/external-dependencies') { requireRole(user, 'moderator'); return json(response, 201, repository.saveExternalDependency(null, await readJson(request), user)); }
  const externalDependencyId = numericId(path, '/api/external-dependencies');
  if (externalDependencyId !== null) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.saveExternalDependency(externalDependencyId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteExternalDependency(externalDependencyId); response.writeHead(204); return response.end(); }
  }
  if (method === 'POST' && path === '/api/knowledge') { requireRole(user, 'moderator'); return json(response, 201, repository.saveKnowledgeArticle(null, await readJson(request), user)); }
  if (method === 'GET' && path === '/api/knowledge/similar') return json(response, 200, repository.similarKnowledge(url.searchParams.get('type'), Number(url.searchParams.get('id')), user));
  const knowledgeId = numericId(path, '/api/knowledge');
  if (knowledgeId !== null) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.saveKnowledgeArticle(knowledgeId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteKnowledgeArticle(knowledgeId); response.writeHead(204); return response.end(); }
  }
  if (method === 'GET' && path === '/api/handovers') return json(response, 200, repository.handovers(user));
  if (method === 'POST' && path === '/api/handovers') return json(response, 201, repository.saveHandover(null, await readJson(request), user));
  const handoverAccept = path.match(/^\/api\/handovers\/(\d+)\/accept$/);
  if (handoverAccept && method === 'POST') return json(response, 200, repository.acceptHandover(Number(handoverAccept[1]), user));
  const handoverId = numericId(path, '/api/handovers');
  if (handoverId !== null) {
    if (method === 'PATCH') return json(response, 200, repository.saveHandover(handoverId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteHandover(handoverId, user); response.writeHead(204); return response.end(); }
  }
  if (method === 'GET' && path === '/api/automation-rules') return json(response, 200, repository.automationRules());
  if (method === 'POST' && path === '/api/automation-rules') { requireRole(user, 'moderator'); return json(response, 201, repository.saveAutomationRule(null, await readJson(request), user)); }
  if (method === 'POST' && path === '/api/automation-rules/run') { requireRole(user, 'moderator'); return json(response, 200, repository.runAutomations(user)); }
  const automationRuleId = numericId(path, '/api/automation-rules');
  if (automationRuleId !== null) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.saveAutomationRule(automationRuleId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteAutomationRule(automationRuleId); response.writeHead(204); return response.end(); }
  }
  if (method === 'GET' && path === '/api/commissioning-templates') return json(response, 200, repository.commissioningTemplates());
  if (method === 'POST' && path === '/api/commissioning-templates') { requireRole(user, 'moderator'); return json(response, 201, repository.saveCommissioningTemplate(null, await readJson(request), user)); }
  const templateApply = path.match(/^\/api\/commissioning-templates\/(\d+)\/apply$/);
  if (templateApply && method === 'POST') { requireRole(user, 'moderator'); return json(response, 201, repository.applyCommissioningTemplate(Number(templateApply[1]), await readJson(request), user)); }
  const commissioningTemplateId = numericId(path, '/api/commissioning-templates');
  if (commissioningTemplateId !== null) {
    requireRole(user, 'moderator');
    if (method === 'PATCH') return json(response, 200, repository.saveCommissioningTemplate(commissioningTemplateId, await readJson(request), user));
    if (method === 'DELETE') { repository.deleteCommissioningTemplate(commissioningTemplateId); response.writeHead(204); return response.end(); }
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
  const requirementStatus = path.match(/^\/api\/(status|task|point)\/(\d+)\/requirements\/(\d+)$/);
  if (requirementStatus && method === 'PATCH') {
    const body = await readJson(request);
    if (body.action === 'approve') requireRole(user, 'moderator');
    return json(response, 200, repository.updateRequirementStatus(requirementStatus[1], Number(requirementStatus[2]), Number(requirementStatus[3]), body, user));
  }
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
  if (method === 'POST' && path === '/api/status/bulk-create') return json(response, 201, repository.bulkCreateStatus(await readJson(request), user));

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
  if (userPasswordMatch && method === 'PUT') { requireRole(user, 'system_admin'); return json(response, 200, repository.resetUserPassword(Number(userPasswordMatch[1]), await readJson(request))); }
  let id = numericId(path, '/api/users');
  if (id !== null) {
    requireRole(user, 'project_admin');
    if (method === 'PATCH') {
      const input = await readJson(request);
      const target = repository.users().find(item => item.id === id);
      const protectedProjectFields = new Set(['planner_enabled', 'assignable']);
      if (user.role !== 'system_admin' && (target?.system_role === 'system_admin' || target?.project_role === 'project_admin') && Object.keys(input).some(key => !protectedProjectFields.has(key))) throw Object.assign(new Error('Dla administratora możesz tutaj zmienić wyłącznie udział w Plannerze i widoczność na listach wyboru'), { statusCode: 403 });
      const safe = user.role === 'system_admin' ? input : (target?.system_role === 'system_admin' || target?.project_role === 'project_admin') ? { planner_enabled: input.planner_enabled, assignable: input.assignable } : { project_role: input.project_role, project_active: input.project_active, planner_enabled: input.planner_enabled, assignable: input.assignable };
      if (user.role !== 'system_admin' && Object.hasOwn(safe, 'project_role') && !['user', 'moderator'].includes(safe.project_role)) throw Object.assign(new Error('Administrator projektu może przydzielać wyłącznie role managera projektu i użytkownika'), { statusCode: 403 });
      return json(response, 200, repository.saveUser(id, safe));
    }
    if (method === 'DELETE') { requireRole(user, 'system_admin'); if (id === user.id) throw Object.assign(new Error('Nie możesz usunąć własnego konta'), { statusCode: 400 }); repository.deleteUser(id); response.writeHead(204); return response.end(); }
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
  if (method === 'PATCH' && path.startsWith('/api/settings/')) { requireRole(user, 'project_admin'); const input = await readJson(request); repository.saveSetting(decodeURIComponent(path.slice('/api/settings/'.length)), input.value); return json(response, 200, { ok: true }); }
  return json(response, 404, { error: 'Nie znaleziono endpointu' });
}

async function handleApi(request, response, url) {
  const method = request.method || 'GET'; const path = url.pathname;
  if (method === 'GET' && path === '/api/health') return json(response, 200, { status: 'ok', version: 14, release: '14.0.0' });
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
  if (method === 'PUT' && path === '/api/account/password') return json(response, 200, repository.changeOwnPassword(user.id, await readJson(request)));
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
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(port, '0.0.0.0', () => {
  console.log(`PLC Commissioning Hub V14.0.0 running on port ${port}`);
  automationStartupTimer = setTimeout(runScheduledAutomations, 5000); automationStartupTimer.unref();
  automationTimer = setInterval(runScheduledAutomations, 5 * 60 * 1000); automationTimer.unref();
});
function shutdown() { clearTimeout(automationStartupTimer); clearInterval(automationTimer); server.close(() => { repository.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
