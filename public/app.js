import { createTableTools } from './modules/table-tools.js?v=1.7.0';
import {
  DEFAULT_STATUS_WORKFLOW_STATES,
  MEETING_PRIORITY_DEFINITIONS,
  PRIORITY_DEFINITIONS,
  PRIORITY_VALUES,
  meetingPriorityDefinition,
  normalizeMeetingPriority,
  statusDefinitions,
  statusValues,
  workflowLabel,
  workflowTone
} from './modules/workflow-model.js?v=1.1.0';

const state = {
  view: 'mine', controller: 'all', me: null, projects: [], controllerGroups: [], controllers: [], users: [],
  config: { categories: [], task_categories: [], function_groups: [], status_groups: [], options: [], announcement_labels: [], requirements: [], settings: {} },
  overview: null, announcements: [], meetingSummaries: [], notifications: [], communicationPreferences: { digest_enabled: 0 }, navigationCounts: {}, mine: null, dashboard: {}, status: [], tasks: [], points: [], externalDependencies: [], notes: [], goals: [], planner: null, calendar: null, history: [], savedViews: [], operations: null, securityEvents: [], loadSequence: 0,
  dialog: null, dialogStack: [], dialogInitial: '', dirtyCloseAttempt: new WeakSet(), goalDraftLinks: [], goalPickerCollections: null, linkDraft: [], statusMode: 'list', taskMode: 'board', taskShowCompleted: false, pointMode: 'list', pointSection: 'points', trendPeriod: 'week',
  functionGroupController: '', functionPointGroup: null, functionPointDraft: [],
  notesFrom: '', notesTo: '', notesWeek: '', draggingTask: false, plannerFrom: '', plannerDays: 14, plannerShowHours: false, plannerShowAreas: false, plannerDetailedView: false, plannerToolsVisible: false,
  plannerCell: null, plannerClipboard: null, plannerDragEntry: null, plannerDragDay: null, plannerDragging: false, plannerSelection: new Set(), plannerEntrySelection: new Set(), plannerExpandedCells: new Set(), plannerSelectionAnchor: null, plannerScrollLeft: 0, plannerScrollTop: 0, plannerSelectionAbort: null, plannerRawPlans: [], plannerRawPlanId: null, calendarFrom: '', calendarTo: '', calendarMode: 'week', calendarTypes: ['task', 'point', 'status', 'goal', 'note', 'annotation'], calendarPriorities: [...PRIORITY_VALUES], calendarOnlyMine: false, calendarCategory: '', calendarPlanner: null, calendarPlanningVisible: false, calendarRequirementEdit: false,
  plannerFilters: { users: [], projects: [], modes: [], shifts: [], activities: [] }, plannerFiltersLoaded: false, plannerHighlightedUsers: new Set(), plannerHighlightedDates: new Set(), plannerSnapshots: [], plannerUndoStack: [], plannerRedoStack: [], plannerHistoryReplaying: false,
  plannerRequirementEdit: false, requirementProjectId: null, requirementLevel: 'areas', requirementFrom: '', requirementDays: 14, requirementData: null, requirementDraft: new Map(), requirementBaseline: new Map(), requirementDirty: new Set(), requirementSelection: null, requirementCollapsedGroups: new Set(), plannerCollapsedRequirementProjects: new Set(), requirementGridAbort: null, requirementPointerSelecting: false, requirementFill: null,
  kpiModules: ['status', 'tasks', 'points', 'goals'], globalTrendMode: 'combined', overviewDetailed: false, detailedKpiMode: 'combined', detailedKpiPeriod: 'week', linkPickerAllowed: [], linkPickerDraft: [], linkPickerCollections: null, actionResolve: null, actionDialogGeneration: 0, actionClosingGeneration: 0, configPanel: null, configScroll: 0, hierarchySelection: null, dailySummaryOpening: false,
  selectionContext: null, selectionDraft: [], selectionCollections: null, duplicateSource: null, checklistTask: null,
  announcementLabelFilter: '', announcementImportanceFilter: '', announcementTab: 'inbox', announcementFrom: '', announcementTo: '', announcementWeek: '', messageActionScope: 'mine', liveSource: null, liveRefreshTimer: null,
  categorySelection: { status: null, task: null },
  functionListManager: null, bulkChoice: null,
  operationsTab: 'triage', operationsLoading: new Set(), triageSelection: new Set(), savedViewApplying: false, activeSavedView: {}, taskDependencyOptions: [], dependencyOptions: null, dependencyOptionsAll: false,
  dataCache: { projectId: null, entries: new Map(), versions: new Map() },
  collapsedStatusGroups: new Set(), collapsedStatusConfigGroups: new Set(), collapsedTaskGroups: new Set(), statusTransfer: null, overviewHierarchyLevel: 'areas', statusMatrixQuery: '', statusFunctionGroupFilter: '', statusFunctionGroupingMode: '', statusShowControllerColumn: false, statusShowUnassigned: false,
  statusMatrixSort: { key: '', columnId: null, direction: 1 }, statusColumnWidths: {}, statusColumnWidthProjectId: null, statusColumnResizeCleanup: null,
  hiddenColumns: { status: new Set(), tasks: new Set(), points: new Set(), external: new Set() },
  grouping: { status: 'category', tasks: '', notes: 'scope', history: 'hierarchy' },
  sort: { status: { key: '', direction: 1 }, tasks: { key: '', direction: 1 }, points: { key: '', direction: 1 }, external: { key: 'next_followup', direction: 1 } }
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const today = () => new Date().toISOString().slice(0, 10);
const twoWeeksAgo = () => { const value = new Date(); value.setDate(value.getDate() - 13); return value.toISOString().slice(0, 10); };
const addDays = (value, days) => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const mondayOf = value => { const date = new Date(`${value}T12:00:00Z`); date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() || 7) - 1)); return date.toISOString().slice(0, 10); };
const dateRange = (from, to) => { const result = []; for (let value = from; value <= to && result.length < 370; value = addDays(value, 1)) result.push(value); return result; };
const displayDate = value => value ? new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value)) : '—';
const displayDateTime = value => value ? new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'))) : '—';
const clientId = globalThis.crypto?.randomUUID?.() || `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const pageCopy = {
  overview: ['Start · Projekt', 'Liczbowy obraz gotowości całego projektu', ''],
  announcements: ['Komunikacja', 'Jedno miejsce dla działań, wiadomości, planów i przekazań', '+ Nowa wiadomość'],
  mine: ['Start', 'Twoja praca, terminy i najbliższy plan', ''],
  operations: ['Priorytety i odprawy', 'Wspólna kolejka działań oraz opublikowane plany pracy', ''],
  planner: ['Plan', 'Planner manpoweru i kalendarz projektu', ''],
  calendar: ['Plan · Kalendarz', 'Zintegrowany harmonogram i adnotacje projektu', '+ Adnotacja'],
  status: ['Status', 'Konfigurowalne grupy, podgrupy i pola weryfikacji', '+ Dodaj punkt'],
  tasks: ['Praca · Zadania', 'Zadania, punkty, zależności i kamienie milowe w jednym module', '+ Nowe zadanie'],
  goals: ['Praca · Kamienie milowe', 'Najważniejsze rezultaty i daty kontrolne projektu', '+ Nowy kamień milowy'],
  points: ['Praca · Otwarte punkty', 'Problemy, oczekiwania i zależności zewnętrzne', '+ Nowy punkt'],
  notes: ['Komunikacja · Przekazania', 'Przekazania informacji dla projektu, obszarów i sterowników', '+ Nowe przekazanie'],
  history: ['Komunikacja · Historia zmian', 'Wszystkie zmiany projektu z bezpośrednim przejściem do elementu', ''],
  settings: ['Konfiguracja', 'Kolejność, sterowniki, użytkownicy, kategorie i słowniki', '']
};

const sharedWorkflowDefinitions = [...DEFAULT_STATUS_WORKFLOW_STATES, ...statusDefinitions('task'), ...statusDefinitions('point'), ...statusDefinitions('goal'), ...PRIORITY_DEFINITIONS];
const badgeMap = {
  ...Object.fromEntries(sharedWorkflowDefinitions.map(item => [item.value, [workflowLabel(item.value), workflowTone(item.value)]])),
  'NOK / Rework': [workflowLabel('NOK / Retest required', 'status'), workflowTone('NOK / Retest required', 'status')],
  'Retest required': [workflowLabel('NOK / Retest required', 'status'), workflowTone('NOK / Retest required', 'status')],
  'Not started': [workflowLabel('Ready to test', 'status'), 'gray'],
  published: ['Opublikowana', 'green'], draft: ['Wersja robocza', 'gray'], archived: ['Archiwalna', 'gray']
};
const fallbackStatusWorkflowStates = DEFAULT_STATUS_WORKFLOW_STATES.map(item => ({ ...item }));
function allStatusWorkflowStates() { return state.config?.status_workflow_states?.length ? state.config.status_workflow_states : fallbackStatusWorkflowStates; }
function statusWorkflowOptions(currentValue = '') {
  return allStatusWorkflowStates()
    .filter(item => Number(item.included) !== 0 || (currentValue && item.value === currentValue))
    .map(item => ({ value: item.value, label: item.label + (Number(item.included) === 0 ? ' (wyłączony)' : '') }));
}
function statusWorkflowValues() { return statusWorkflowOptions().map(item => item.value); }
function statusSymbolDetails(value) {
  const item = allStatusWorkflowStates().find(stateItem => stateItem.value === value);
  const tone = item?.system_key === 'progress' ? 'progress' : item?.system_key === 'blocked' ? 'blocked' : item?.system_key === 'retest' ? 'retest' : item?.system_key === 'done' ? 'done' : item?.system_key === 'na' ? 'na' : item?.system_key === 'never_checked' ? 'unchecked' : 'ready';
  return item ? [item.icon, item.label, tone, item.system_key] : ['?', value || 'Brak statusu', 'unknown', ''];
}
function professionalStatusIcon(systemKey, fallback) {
  const icons = {
    never_checked: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" stroke-dasharray="2.2 2.2"/><path d="M8.5 12h7"/></svg>',
    ready: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2" class="status-icon-fill"/></svg>',
    progress: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3.5 2"/><path d="M6.5 5.8 8 4.5M17.5 5.8 16 4.5"/></svg>',
    blocked: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="m6.4 6.4 11.2 11.2"/></svg>',
    retest: '<svg viewBox="0 0 24 24"><path d="M18.4 9A7 7 0 0 0 6.8 6.5L5 8.2M5 8.2V4.8M5 8.2h3.4M5.6 15A7 7 0 0 0 17.2 17.5l1.8-1.7M19 15.8v3.4M19 15.8h-3.4"/></svg>',
    done: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="m8 12.2 2.5 2.5L16.5 9"/></svg>',
    na: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M8 12h8"/></svg>'
  };
  return icons[systemKey] || `<i aria-hidden="true">${escapeHtml(fallback || '?')}</i>`;
}
function statusSymbol(value, interactive = false) {
  const [symbol, label, tone, systemKey] = statusSymbolDetails(value);
  return `<span class="status-symbol ${tone} ${interactive ? 'interactive' : ''}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${professionalStatusIcon(systemKey, symbol)}</span>`;
}
function statusSymbolLegend(compact = false) {
  return `<div class="status-symbol-legend ${compact ? 'compact' : ''}" aria-label="Legenda statusów"><b>Legenda</b>${statusWorkflowOptions().map(item => `<span>${statusSymbol(item.value)}<small>${escapeHtml(item.label)}</small></span>`).join('')}</div>`;
}
const statusColumnRole = column => column?.column_role || (column?.field_type === 'text' ? 'basic' : 'subpoint');
const badge = value => { const item = badgeMap[value] || [value || '—', 'gray']; return `<span class="badge ${item[1]}">${escapeHtml(item[0])}</span>`; };
const editLockNote = item => item?.edit_locked ? `<span class="edit-lock-note" title="${escapeHtml(`Zablokowany przed edycją przez: ${item.edit_lock?.locked_by_name || 'managera'}; Powód: ${item.edit_lock?.reason || 'nie podano'}`)}">🔒 Zablokowany przed edycją</span>` : '';
function appendEditLockNote(root, item, selector) {
  if (!item?.edit_locked || root.querySelector('.edit-lock-note')) return;
  (root.querySelector(selector) || root).insertAdjacentHTML('beforeend', editLockNote(item));
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', 'X-Client-Id': clientId, ...(options.headers || {}) } });
  if (response.status === 401) { location.href = '/login.html'; throw new Error('Sesja wygasła'); }
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Błąd serwera (${response.status})`);
  const result = response.status === 204 ? null : await response.json();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(String(options.method || 'GET').toUpperCase())) invalidateCacheForMutation(path);
  return result;
}

let globalSearchTimer;
async function runGlobalSearch() {
  const input = $('#global-search'); const container = $('#global-search-results');
  const query = input.value.trim();
  if (query.length < 2) { container.classList.add('hidden'); container.innerHTML = ''; return; }
  container.classList.remove('hidden');
  container.innerHTML = '<div class="global-search-state">Szukanie…</div>';
  try {
    const rows = await api(`/api/search?q=${encodeURIComponent(query)}`);
    if (input.value.trim() !== query) return;
    const labels = { status: 'Status', task: 'Zadanie', point: 'Otwarty punkt', goal: 'Kamień milowy', note: 'Przekazanie', announcement: 'Wiadomość', meeting: 'Odprawa', external: 'Zależność zewnętrzna' };
    container.innerHTML = rows.map(item => `<button type="button" data-global-result="${escapeHtml(item.type)}:${item.id}"><span class="type-dot ${['announcement', 'meeting'].includes(item.type) ? 'goal' : item.type}"></span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml([labels[item.type], item.scope, item.status].filter(Boolean).join(' · '))}</small></span><em>${escapeHtml(String(item.detail || '').slice(0, 90))}</em></button>`).join('') || '<div class="global-search-state">Brak wyników w modułach projektu.</div>';
    $$('[data-global-result]').forEach(button => button.addEventListener('click', () => openGlobalSearchResult(button.dataset.globalResult)));
  } catch (error) { container.innerHTML = `<div class="global-search-state error">${escapeHtml(error.message)}</div>`; }
}

async function openGlobalSearchResult(reference) {
  const [type, rawId] = String(reference || '').split(':'); const id = Number(rawId);
  $('#global-search-results').classList.add('hidden');
  if (['status', 'task', 'point', 'goal', 'note'].includes(type)) return openEntityOverlay(type, id);
  if (type === 'announcement') {
    state.announcements = await api('/api/announcements'); rememberDataCache('announcements', state.announcements);
    await setView('announcements');
    return openAnnouncementDetails(state.announcements.find(item => Number(item.id) === id));
  }
  if (type === 'meeting') {
    state.meetingSummaries = await api('/api/meeting-summaries'); rememberDataCache('meetingSummaries', state.meetingSummaries);
    const meeting = state.meetingSummaries.find(item => Number(item.id) === id);
    if (meeting) return openMeetingPlanDetails(meeting);
  }
  if (type === 'external') {
    state.externalDependencies = await api('/api/external-dependencies');
    const dependency = state.externalDependencies.find(item => Number(item.id) === id);
    if (dependency) return openExternalDependencyDetails(dependency);
  }
  toast('Element nie jest już dostępny', true);
}

function ensureProjectCache() {
  const projectId = Number(state.me?.current_project?.id) || null;
  if (state.dataCache.projectId === projectId) return;
  state.dataCache = { projectId, entries: new Map(), versions: new Map() };
  state.operations = null;
  state.operationsLoading.clear();
}

function ensureStatusColumnWidths() {
  const projectId = Number(state.me?.current_project?.id) || 0;
  if (state.statusColumnWidthProjectId === projectId) return state.statusColumnWidths;
  state.statusColumnWidthProjectId = projectId;
  try {
    const stored = JSON.parse(localStorage.getItem(`status-column-widths:${projectId}`) || '{}');
    state.statusColumnWidths = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  } catch { state.statusColumnWidths = {}; }
  return state.statusColumnWidths;
}

function persistStatusColumnWidths() {
  try { localStorage.setItem(`status-column-widths:${Number(state.me?.current_project?.id) || 0}`, JSON.stringify(state.statusColumnWidths)); } catch { /* ustawienia przeglądarki mogą blokować pamięć lokalną */ }
}

function statusColumnAttributes(key) {
  const width = Number(ensureStatusColumnWidths()[key]);
  const style = Number.isFinite(width) && width > 0 ? ` style="width:${width}px;min-width:${width}px;max-width:${width}px"` : '';
  return `data-status-column-key="${escapeHtml(key)}"${style}`;
}

function invalidateDataCache(...keys) {
  keys.flat().forEach(key => {
    state.dataCache.entries.delete(key);
    state.dataCache.versions.set(key, (state.dataCache.versions.get(key) || 0) + 1);
  });
}

function rememberDataCache(key, value) {
  state.dataCache.entries.set(key, { value, loadedAt: Date.now() });
  return value;
}

function cachedDataRequest(key, path, maxAge = Infinity) {
  const cached = state.dataCache.entries.get(key);
  if (cached?.promise) return cached.promise;
  if (cached && Date.now() - cached.loadedAt <= maxAge) return Promise.resolve(cached.value);
  const version = state.dataCache.versions.get(key) || 0;
  const request = api(path).then(value => {
    if ((state.dataCache.versions.get(key) || 0) === version) rememberDataCache(key, value);
    return value;
  }).catch(error => {
    if (state.dataCache.entries.get(key)?.promise === request) state.dataCache.entries.delete(key);
    throw error;
  });
  state.dataCache.entries.set(key, { promise: request, loadedAt: 0 });
  return request;
}

function invalidateCacheForMutation(path) {
  const pathname = String(path || '').split('?')[0];
  invalidateDataCache('notifications', 'navigationCounts', 'meetingSummaries');
  if (/^\/api\/(?:settings|options|categories|subcategories|task-categories|task-subcategories|function-groups|status-groups|status-subgroups|status-columns|status-workflow-states|status-layout|completion-requirements|announcement-labels|export-templates)(?:\/|$)/.test(pathname) || /^\/api\/planner\/(?:holidays|vehicles)(?:\/|$)/.test(pathname)) invalidateDataCache('config');
  if (/^\/api\/(?:controllers|controller-groups)(?:\/|$)/.test(pathname)) invalidateDataCache('controllers', 'controllerGroups', 'config');
  if (/^\/api\/(?:users|projects|project-memberships)(?:\/|$)/.test(pathname)) invalidateDataCache('users');
  if (/^\/api\/saved-views(?:\/|$)/.test(pathname)) invalidateDataCache('savedViews');
  if (/^\/api\/(?:announcements|project-meetings)(?:\/|$)/.test(pathname)) invalidateDataCache('announcements', 'meetingSummaries');
  if (pathname === '/api/reorder' || pathname === '/api/backup/restore') invalidateDataCache('controllerGroups', 'controllers', 'users', 'config', 'announcements', 'meetingSummaries', 'savedViews');
  if (state.operations) state.operations._loaded = {};
}

function mergeOperationsData(payload) {
  if (!payload) return;
  const sameScope = state.operations?.scope === payload.scope;
  const loaded = sameScope ? { ...(state.operations._loaded || {}) } : {};
  loaded[payload.tab] = true;
  state.operations = { ...(sameScope ? state.operations : {}), ...payload, _loaded: loaded };
}

function roleName(role) { return ({ system_admin: 'Administrator systemu', project_admin: 'Lider projektu', admin: 'Administrator', moderator: 'Manager projektu', user: 'Użytkownik' })[role] || role; }
function options(kind) { return state.config.options.filter(item => item.kind === kind).map(item => item.value); }
function statusCategories() { return state.config.categories.map(item => item.name); }
function taskCategories() { return state.config.task_categories.map(item => item.name); }
function functionGroups(controllerCode) { return (state.config.function_groups || []).filter(item => !controllerCode || item.controller === controllerCode); }
function statusGroups() { return state.config.status_groups || []; }
function statusSubgroups(groupId) { return statusGroups().find(item => item.id === Number(groupId))?.subgroups || []; }
function statusInheritanceValue(item, subgroup = false) {
  if (item?.inherit_from_subgroup_id) return `subgroup:${item.inherit_from_subgroup_id}`;
  if (item?.inherit_from_group_id) return `group:${item.inherit_from_group_id}`;
  return subgroup ? 'parent' : 'own';
}
function statusInheritanceOptions(targetGroupId = null, targetSubgroupId = null, subgroup = false) {
  const result = subgroup
    ? [{ value: 'parent', label: 'Automatycznie z grupy nadrzędnej (gdy brak własnych kolumn)' }, { value: 'own', label: 'Własny układ kolumn' }]
    : [{ value: 'own', label: 'Własny układ kolumn' }];
  statusGroups().forEach(group => {
    if (!(Number(group.id) === Number(targetGroupId) && !subgroup)) result.push({ value: `group:${group.id}`, label: `Dziedzicz: ${group.name}` });
    (group.subgroups || []).forEach(item => {
      if (Number(item.id) !== Number(targetSubgroupId)) result.push({ value: `subgroup:${item.id}`, label: `Dziedzicz: ${group.name} → ${item.name}` });
    });
  });
  return result;
}
function assignableUsers(selectedIds = []) {
  const selected = new Set([].concat(selectedIds || []).map(Number).filter(Boolean));
  return state.users.filter(item => item.active && item.project_active && (Number(item.assignable) !== 0 || selected.has(Number(item.id))));
}
function controllerLabel(item) {
  if (!item) return '';
  if (item.scope_label) return item.scope_label;
  if (item.controller_label) return item.controller_label;
  const code = typeof item === 'string' ? item : item.controller || item.code;
  return state.controllers.find(controller => controller.code === code)?.display_name || code || '';
}
function safeProjectColor(value) { return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : '#2563eb'; }
function projectColorStyle(value) {
  const color = safeProjectColor(value);
  const red = Number.parseInt(color.slice(1, 3), 16); const green = Number.parseInt(color.slice(3, 5), 16); const blue = Number.parseInt(color.slice(5, 7), 16);
  const contrast = (red * 299 + green * 587 + blue * 114) / 1000 > 155 ? '#111827' : '#ffffff';
  return `--project-color:${color};--project-contrast:${contrast}`;
}
function plannerChipEntryIds(chip) {
  return String(chip?.dataset.entryIds || chip?.dataset.entryId || '').split(',').map(Number).filter(Boolean);
}
function plannerDisplayEntries(entries = [], simplified = false) {
  const display = []; const workGroups = new Map();
  for (const entry of entries) {
    const transport = entry.activity_type === 'transport' || entry.transport_mode === 'transport_only';
    if (transport) {
      display.push({ ...entry, merged_entry_ids: [Number(entry.id)], merged_entries: [entry], display_area_label: '' });
      continue;
    }
    const key = simplified
      ? `${Number(entry.project_id || state.me.current_project?.id || 0)}:${entry.is_proposal?'proposal':'official'}`
      : [Number(entry.project_id || state.me.current_project?.id || 0), entry.work_mode || 'online', entry.shift || 'Dzień', Number(entry.count_in_manpower) === 0 ? 0 : 1,entry.is_proposal?'proposal':'official'].join(':');
    if (!workGroups.has(key)) workGroups.set(key, { ...entry, merged_entry_ids: [], merged_entries: [], display_area_labels: [], display_notes: [] });
    const group = workGroups.get(key);
    group.merged_entry_ids.push(Number(entry.id)); group.merged_entries.push(entry);
    const area = entry.area_path || entry.area_name || '';
    if (area && !group.display_area_labels.includes(area)) group.display_area_labels.push(area);
    if (entry.note && !group.display_notes.includes(entry.note)) group.display_notes.push(entry.note);
  }
  for (const group of workGroups.values()) display.push({
    ...group,
    note: group.display_notes.join(' · '),
    display_area_label: group.display_area_labels.join(' + '),
    area_count: group.display_area_labels.length
  });
  return display;
}
function hierarchyGroupOptions() { return state.controllerGroups.map(group => ({ value: group.id, label: `${'  '.repeat(Math.max(0, Number(group.depth || 1) - 1))}${group.path_label || group.name}` })); }
function taskHierarchyOptions() {
  const values = [];
  for (const group of state.controllerGroups) {
    values.push({ value: `group:${group.id}`, label: `${'  '.repeat(Math.max(0, Number(group.depth || 1) - 1))}▰ ${group.path_label}` });
    state.controllers.filter(item => Number(item.group_id) === Number(group.id)).forEach(item => values.push({ value: `controller:${item.code}`, label: `${'  '.repeat(Number(group.depth || 1))}◇ ${item.display_name}` }));
  }
  state.controllers.filter(item => !item.group_id).forEach(item => values.push({ value: `controller:${item.code}`, label: `◇ ${item.display_name}` }));
  return values;
}
function hierarchyTargetLabel(value) {
  if (!value || value === 'all' || value === 'project:0') return 'Cały projekt';
  if (String(value).startsWith('group:')) {
    const group = state.controllerGroups.find(item => Number(item.id) === Number(String(value).slice(6)));
    return group?.path_label || group?.name || 'Nieznany obszar';
  }
  const code = String(value).replace(/^controller:/, '');
  const controller = state.controllers.find(item => item.code === code);
  return controller?.display_name || controller?.leaf_code || controller?.code || code || 'Wybierz zakres';
}
function hierarchyTargetTreeHtml(selected, { fieldName = 'hierarchy_target', inputId = 'form-hierarchy-target', allowProject = false, controllerValuePrefix = true } = {}) {
  const selectedValue = String(selected || '');
  const controllerNode = (controller, depth = 0) => {
    const value = controllerValuePrefix ? `controller:${controller.code}` : controller.code;
    return `<label class="hierarchy-target-option hierarchy-controller-node" style="--hierarchy-depth:${depth}" data-hierarchy-node="${escapeHtml(value)}"><input type="radio" data-hierarchy-target-choice value="${escapeHtml(value)}" ${value === selectedValue ? 'checked' : ''}><span>${escapeHtml(controller.display_name || controller.leaf_code || controller.code)}</span></label>`;
  };
  const children = parentId => state.controllerGroups.filter(group => Number(group.parent_id || 0) === Number(parentId || 0));
  const branch = (group, depth = 0) => {
    const value = `group:${group.id}`;
    const directControllers = state.controllers.filter(item => Number(item.group_id) === Number(group.id));
    return `<div class="hierarchy-target-branch ${value === selectedValue ? 'selected' : ''}" data-parent="${group.parent_id || ''}"><label class="hierarchy-target-option hierarchy-group-node" style="--hierarchy-depth:${depth}" data-hierarchy-node="${escapeHtml(value)}"><input type="radio" data-hierarchy-target-choice value="${escapeHtml(value)}" ${value === selectedValue ? 'checked' : ''}><span>${escapeHtml(group.name)}</span></label>${children(group.id).map(item => branch(item, depth + 1)).join('')}${directControllers.map(item => controllerNode(item, depth + 1)).join('')}</div>`;
  };
  const project = allowProject ? `<label class="hierarchy-target-option hierarchy-project-node" style="--hierarchy-depth:0"><input type="radio" data-hierarchy-target-choice value="all" ${selectedValue === 'all' ? 'checked' : ''}><span>Cały projekt</span></label>` : '';
  const branches = children(null).map(item => branch(item)).join('');
  const ungrouped = state.controllers.filter(item => !item.group_id).map(item => controllerNode(item)).join('');
  return `<div class="hierarchy-target-picker" data-hierarchy-target-tree><input type="hidden" name="${escapeHtml(fieldName)}" id="${escapeHtml(inputId)}" value="${escapeHtml(selectedValue)}"><details class="hierarchy-target-dropdown"><summary data-hierarchy-target-summary>${escapeHtml(hierarchyTargetLabel(selectedValue))}</summary><div class="hierarchy-target-menu">${project}${branches}${ungrouped}</div></details></div>`;
}
function bindHierarchyTargetTrees(root = document) {
  root.querySelectorAll('[data-hierarchy-target-tree]').forEach(tree => {
    const hidden = tree.querySelector('input[type="hidden"]');
    const summary = tree.querySelector('[data-hierarchy-target-summary]');
    const sync = value => {
      hidden.value = value;
      tree.querySelectorAll('[data-hierarchy-target-choice]').forEach(control => { control.checked = control.value === value; });
      tree.querySelectorAll('.hierarchy-target-branch').forEach(branch => branch.classList.toggle('selected', branch.querySelector(':scope > .hierarchy-target-option input')?.checked));
      if (summary) summary.textContent = hierarchyTargetLabel(value);
      hidden.dispatchEvent(new Event('change', { bubbles: true }));
      const dropdown = tree.querySelector('details.hierarchy-target-dropdown');
      if (dropdown) dropdown.open = false;
    };
    tree.querySelectorAll('[data-hierarchy-target-choice]').forEach(control => control.addEventListener('change', () => { if (control.checked) sync(control.value); }));
  });
}
function hierarchyMultiDropdownHtml(selected = []) {
  const picked = new Set((selected || []).map(String));
  const children = parentId => state.controllerGroups.filter(group => Number(group.parent_id || 0) === Number(parentId || 0));
  const controllerRow = (controller, depth) => `<label class="hierarchy-target-option" style="--hierarchy-depth:${depth}"><input type="checkbox" data-hierarchy-multi-choice value="controller:${escapeHtml(controller.code)}" ${picked.has(`controller:${controller.code}`) ? 'checked' : ''}><span>${escapeHtml(controller.display_name || controller.leaf_code || controller.code)}</span></label>`;
  const branch = (group, depth = 0) => `<div class="hierarchy-target-branch"><label class="hierarchy-target-option" style="--hierarchy-depth:${depth}"><input type="checkbox" data-hierarchy-multi-choice value="group:${group.id}" ${picked.has(`group:${group.id}`) ? 'checked' : ''}><span>${escapeHtml(group.name)}</span></label>${state.controllers.filter(item => Number(item.group_id) === Number(group.id)).map(item => controllerRow(item, depth + 1)).join('')}${children(group.id).map(item => branch(item, depth + 1)).join('')}</div>`;
  return `<details class="hierarchy-multi-dropdown"><summary data-hierarchy-multi-summary>${picked.size ? `Zakresy · ${picked.size}` : 'Wszystkie obszary'}</summary><div class="hierarchy-target-menu">${children(0).map(item => branch(item)).join('')}${state.controllers.filter(item => !item.group_id).map(item => controllerRow(item, 0)).join('')}</div></details>`;
}
function hierarchyMultiFormHtml(field) {
  const picked = new Set((Array.isArray(field.value) ? field.value : []).map(String));
  const children = parentId => state.controllerGroups.filter(group => Number(group.parent_id || 0) === Number(parentId || 0));
  const option = (value, label, depth, kind = '') => `<label class="hierarchy-target-option ${kind}" style="--hierarchy-depth:${depth}"><input name="${escapeHtml(field.name)}" type="checkbox" data-hierarchy-multi-choice value="${escapeHtml(value)}" ${picked.has(value) ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
  const branch = (group, depth = 0) => `<div class="hierarchy-target-branch">${option(`group:${group.id}`, group.name, depth, 'hierarchy-group-node')}${children(group.id).map(item => branch(item, depth + 1)).join('')}${state.controllers.filter(item => Number(item.group_id) === Number(group.id)).map(item => option(`controller:${item.id}`, item.display_name || item.code, depth + 1, 'hierarchy-controller-node')).join('')}</div>`;
  const project = option('project:0', 'Cały projekt', 0, 'hierarchy-project-node');
  const ungrouped = state.controllers.filter(item => !item.group_id).map(item => option(`controller:${item.id}`, item.display_name || item.code, 0, 'hierarchy-controller-node')).join('');
  return `<div class="ui-hierarchy-multiselect" data-ui-multiselect="${escapeHtml(field.name)}"><details class="hierarchy-multi-dropdown"><summary data-hierarchy-multi-summary>${picked.has('project:0') ? 'Cały projekt' : picked.size ? `Zakresy · ${picked.size}` : 'Wybierz zakresy'}</summary><div class="hierarchy-target-menu">${project}${children(0).map(item => branch(item)).join('')}${ungrouped}</div></details></div>`;
}
function bindHierarchyMultiDropdown(root = document, onChange = null) {
  root.querySelectorAll('.hierarchy-multi-dropdown').forEach(dropdown => dropdown.querySelectorAll('[data-hierarchy-multi-choice]').forEach(input => input.addEventListener('change', () => {
    if (input.checked && input.value === 'project:0') dropdown.querySelectorAll('[data-hierarchy-multi-choice]').forEach(control => { if (control !== input) control.checked = false; });
    else if (input.checked) { const project = dropdown.querySelector('[data-hierarchy-multi-choice][value="project:0"]'); if (project) project.checked = false; }
    const selected = [...dropdown.querySelectorAll('[data-hierarchy-multi-choice]:checked')].map(control => control.value);
    dropdown.querySelector('[data-hierarchy-multi-summary]').textContent = selected.includes('project:0') ? 'Cały projekt' : selected.length ? `Zakresy · ${selected.length}` : 'Wybierz zakresy';
    onChange?.(selected);
  })));
}
function controllerHierarchyOrder(item) {
  if (item?.controller_group_id) {
    const group = state.controllerGroups.find(value => value.id === Number(item.controller_group_id));
    const descendant = state.controllers.find(value => (value.group_path || []).slice(0, group?.path_names?.length || 0).join('/') === (group?.path_names || []).join('/'));
    return Math.max(0, state.controllers.indexOf(descendant));
  }
  const controller = state.controllers.find(value => value.id === Number(item?.controller_id) || value.code === item?.controller);
  return controller ? state.controllers.indexOf(controller) : 999999;
}
function subcategories(scope, category) {
  const source = scope === 'task' ? state.config.task_categories : state.config.categories;
  return source.find(item => item.name === category)?.subcategories.map(item => item.name) || [];
}
function selectOptions(items, selected = '', blank = '— wybierz —') {
  const emptyOption = blank === null ? '' : `<option value="">${escapeHtml(blank)}</option>`;
  return `${emptyOption}${items.map(item => {
    const value = typeof item === 'object' ? item.value : item;
    const label = typeof item === 'object' ? item.label : item;
    const title = typeof item === 'object' ? item.description || item.title || '' : '';
    const visibleLabel = badgeMap[label]?.[0] || label;
    return `<option value="${escapeHtml(value)}"${title ? ` title="${escapeHtml(title)}"` : ''}${String(value) === String(selected) ? ' selected' : ''}>${escapeHtml(visibleLabel)}</option>`;
  }).join('')}`;
}

function isoWeek(value) {
  const source = new Date(`${value}T12:00:00Z`);
  const date = new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week, key: `${date.getUTCFullYear()}-${String(week).padStart(2, '0')}`, label: `CW${week} / ${date.getUTCFullYear()}` };
}

function dayDifference(dateValue) {
  const target = new Date(`${dateValue}T12:00:00Z`);
  const now = new Date(`${today()}T12:00:00Z`);
  return Math.round((target - now) / 86400000);
}

function taskTimeLabel(task) {
  if (task.due_date) {
    const days = dayDifference(task.due_date);
    if (task.status === 'Done') return { label: `Zakończone · deadline ${displayDate(task.due_date)}`, overdue: false };
    if (days < 0) return { label: `${Math.abs(days)} dni po terminie`, overdue: true };
    if (days === 0) return { label: 'Termin dzisiaj', overdue: true };
    return { label: `Pozostało ${days} dni`, overdue: false };
  }
  if (task.status === 'Done') return null;
  const created = (task.start_date || task.created_at || today()).slice(0, 10);
  const duration = -dayDifference(created);
  if (duration < 0) return null;
  return { label: `Czas trwania: ${duration} dni`, overdue: false };
}

const {
  sortRows, updateSort, sortMarker, uniqueValues, hierarchyFilterOptions,
  multiFilterControl, tableFilterRow, hierarchyControllerCodes, rowControllerCodes,
  filterRows, bindTableFilters, applyGroupedColumnVisibility, columnVisibilityControl,
  bindColumnVisibility, savedViewsToolbar, bindSavedViews
} = createTableTools({
  state, $, $$, escapeHtml, badgeMap, api, uiForm, uiConfirm, toast,
  drawStatusRows, drawTaskListRows, drawPointRows, renderOperations, renderTasks, drawTasks, render
});

async function initialize() {
  try {
    state.me = await api('/api/me');
    state.projects = state.me.projects || [];
    applyTheme(state.me.theme || 'industrial-pro');
    bindShell();
    updateIdentity();
    if (!state.me.current_project) openProjectDialog(true);
    else { await loadData(); startLiveSync(); }
    startNotificationPolling();
  } catch (error) { toast(error.message, true); }
}

function updateIdentity() {
  $('#me').textContent = `${state.me.display_name} · ${roleName(state.me.role)}`;
  $('#project-switch').textContent = state.me.current_project ? `${state.me.current_project.code} · ${state.me.current_project.name}` : 'Wybierz projekt';
  $('#settings-nav').hidden = !state.me.current_project || state.me.role === 'user';
  document.querySelector('[data-view="operations"]').hidden = !state.me.current_project || !canCoordinate();
}

const navigationMedia = matchMedia('(max-width: 1024px)');

function updateNavigationToggle() {
  const mobileExpanded = document.body.classList.contains('nav-open');
  const desktopExpanded = !document.body.classList.contains('sidebar-collapsed');
  const mobileToggle = $('#mobile-menu');
  const mobileLabel = mobileExpanded ? 'Zamknij menu' : 'Otwórz menu';
  mobileToggle.setAttribute('aria-expanded', String(mobileExpanded));
  mobileToggle.setAttribute('aria-label', mobileLabel);
  mobileToggle.title = mobileLabel;
  const pin = $('#sidebar-pin');
  const pinLabel = desktopExpanded ? 'Zminimalizuj menu' : 'Rozwiń menu na stałe';
  pin.setAttribute('aria-expanded', String(desktopExpanded));
  pin.setAttribute('aria-label', pinLabel);
  pin.title = pinLabel;
  pin.querySelector('.sidebar-pin-icon').textContent = desktopExpanded ? '«' : '»';
  pin.querySelector('.sidebar-pin-label').textContent = desktopExpanded ? 'Zminimalizuj menu' : 'Rozwiń menu na stałe';
}

function bindShell() {
  if (navigationMedia.matches) document.body.classList.remove('sidebar-collapsed');
  else document.body.classList.toggle('sidebar-collapsed', localStorage.getItem('sidebar-expanded') !== '1');
  $$('#nav button').forEach(button => {
    const label = button.querySelector('span:nth-child(2)')?.textContent.trim() || '';
    button.title = label;
    button.setAttribute('aria-label', label);
    button.addEventListener('click', () => setView(button.dataset.view));
  });
  $('#mobile-menu').addEventListener('click', () => {
    if (navigationMedia.matches) document.body.classList.toggle('nav-open');
    else { document.body.classList.toggle('sidebar-collapsed'); localStorage.setItem('sidebar-expanded', document.body.classList.contains('sidebar-collapsed') ? '0' : '1'); }
    updateNavigationToggle();
  });
  $('#sidebar-pin').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebar-expanded', document.body.classList.contains('sidebar-collapsed') ? '0' : '1');
    updateNavigationToggle();
  });
  $('#sidebar-backdrop').addEventListener('click', () => { document.body.classList.remove('nav-open'); updateNavigationToggle(); });
  navigationMedia.addEventListener('change', event => {
    document.body.classList.remove('nav-open');
    document.body.classList.toggle('sidebar-collapsed', !event.matches && localStorage.getItem('sidebar-expanded') !== '1');
    updateNavigationToggle();
  });
  updateNavigationToggle();
  $('#global-search').addEventListener('input', () => { clearTimeout(globalSearchTimer); globalSearchTimer = setTimeout(runGlobalSearch, 220); });
  $('#global-search').addEventListener('keydown', event => {
    if (event.key === 'Escape') $('#global-search-results').classList.add('hidden');
    if (event.key === 'Enter') { const first = $('#global-search-results [data-global-result]'); if (first) { event.preventDefault(); first.click(); } }
  });
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#global-search').focus(); $('#global-search').select(); }
  });
  document.addEventListener('paste', handleTaskImagePaste);
  $('#controller-picker-host').addEventListener('change', async event => { if (event.target.id !== 'controller') return; state.controller = event.target.value; await loadData(); });
  $('#add').addEventListener('click', () => state.view === 'calendar' ? openCalendarAnnotation() : state.view === 'notes' ? openStatusTransferEditor() : openRecord(state.view));
  $('#close').addEventListener('click', closeOrReturnRecordDialog);
  $('#cancel').addEventListener('click', closeOrReturnRecordDialog);
  $('#record-back').addEventListener('click', restoreRecordDialog);
  $('#modal').addEventListener('cancel', event => {
    if (!state.dialogStack.length) return;
    event.preventDefault();
    restoreRecordDialog();
  });
  $('#modal').addEventListener('close', () => {
    state.dialogStack = [];
    state.dialog = null;
    updateRecordBackButton();
  });
  $('#form').addEventListener('submit', saveRecord);
  $('#remove').addEventListener('click', deleteRecord);
  $('#skip-recurrence').addEventListener('click', skipRecurringTask);
  $('#duplicate').addEventListener('click', () => { const { type, record } = state.dialog || {}; if (record) openDuplicate(type, record); });
  $('#edit-record').addEventListener('click', () => setRecordDialogMode(true));
  $('#lock-record').addEventListener('click', toggleRecordEditLock);
  $('#watch-record').addEventListener('click', () => setRecordNotificationPreference(state.dialog?.notificationMode === 'watching' ? 'default' : 'watching'));
  $('#mute-record').addEventListener('click', () => setRecordNotificationPreference(state.dialog?.notificationMode === 'muted' ? 'default' : 'muted'));
  $('#audit-toggle').addEventListener('click', toggleAudit);
  $('#comment-add').addEventListener('click', addEntityComment);
  $('#comment-content').addEventListener('input', renderCommentMentionSuggestions);
  $('#logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); location.href = '/login.html'; });
  $('#brand-reload').addEventListener('click', () => location.reload());
  $('#project-switch').addEventListener('click', () => openProjectDialog(false));
  $('#project-close').addEventListener('click', () => { if (state.me.current_project) $('#project-dialog').close(); });
  $('#theme-switch').addEventListener('click', openThemeDialog);
  $('#security-manage').addEventListener('click', manageAccountSecurity);
  $('#password-change').addEventListener('click', changeOwnPassword);
  $('#daily-summary-close').addEventListener('click', () => $('#daily-summary-dialog').close());
  $('#daily-summary-range').addEventListener('submit', event => { event.preventDefault(); loadDailySummary($('#daily-summary-from').value, $('#daily-summary-to').value); });
  $('#theme-close').addEventListener('click', () => $('#theme-dialog').close());
  $('#export').addEventListener('click', openExportDialog);
  $('#export-close').addEventListener('click', () => $('#export-dialog').close());
  $('#export-cancel').addEventListener('click', () => $('#export-dialog').close());
  $('#export-type').addEventListener('change', updateExportFields);
  $('#export-template').addEventListener('change', () => { const template = (state.config.export_templates || []).find(item => item.id === Number($('#export-template').value)); if (template) $('#export-detail').value = template.detail_level; });
  $('#export-form').addEventListener('submit', runExport);
  $('#picker-close').addEventListener('click', () => $('#goal-picker').close());
  $('#picker-cancel').addEventListener('click', () => $('#goal-picker').close());
  $('#picker-search').addEventListener('input', renderGoalPicker);
  $('#picker-apply').addEventListener('click', applyGoalPicker);
  $('#function-points-close').addEventListener('click', () => $('#function-points-dialog').close());
  $('#function-points-cancel').addEventListener('click', () => $('#function-points-dialog').close());
  $('#function-point-add').addEventListener('click', addFunctionPointDraft);
  $('#function-points-save').addEventListener('click', saveFunctionGroupPoints);
  $('#function-list-close').addEventListener('click', () => $('#function-list-dialog').close());
  $('#function-list-done').addEventListener('click', () => $('#function-list-dialog').close());
  $('#function-list-add-form').addEventListener('submit', addFunctionGroupListItems);
  $('#bulk-status-close').addEventListener('click', () => $('#bulk-status-dialog').close());
  $('#bulk-status-cancel').addEventListener('click', () => $('#bulk-status-dialog').close());
  $('#bulk-status-form').addEventListener('submit', saveBulkStatus);
  $('#action-close').addEventListener('click', () => finishAction(null));
  $('#action-cancel').addEventListener('click', () => finishAction(null));
  $('#action-secondary').addEventListener('click', () => finishAction({ __action: 'secondary' }));
  $('#action-dialog').addEventListener('close', () => {
    if ($('#action-dialog').dataset.actionCompleted === '1') { $('#action-dialog').dataset.actionCompleted = ''; return; }
    if (!state.actionResolve) return;
    const resolve = state.actionResolve;
    state.actionResolve = null;
    resolve(null);
  });
  $('#action-dialog').addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.target.closest('textarea,button')) return;
    if ($('#action-fields').querySelector('input,select,textarea')) return;
    event.preventDefault(); $('#action-form').requestSubmit($('#action-submit'));
  });
  $('#action-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget); const result = Object.fromEntries(form);
    event.currentTarget.querySelectorAll('[data-ui-multiselect]').forEach(group => { result[group.dataset.uiMultiselect] = form.getAll(group.dataset.uiMultiselect); });
    event.currentTarget.querySelectorAll('[data-ui-tree]').forEach(tree => {
      result[tree.dataset.uiTree] = [...tree.querySelectorAll('[data-ui-tree-value]:checked')].map(input => input.value);
    });
    finishAction(result);
  });
  $('#insight-close').addEventListener('click', () => $('#insight-dialog').close());
  $('#insight-dialog').addEventListener('close', () => $('#insight-dialog').classList.remove('kpi-expanded', 'area-detail-dialog', 'employee-review-dialog'));
  $('#link-picker-close').addEventListener('click', closeLinkPicker);
  $('#link-picker-cancel').addEventListener('click', closeLinkPicker);
  $('#link-picker-search').addEventListener('input', renderLinkPicker);
  $('#link-picker-type').addEventListener('change', renderLinkPicker);
  $('#link-picker-sort').addEventListener('change', renderLinkPicker);
  $('#link-picker-apply').addEventListener('click', applyLinkPicker);
  $('#planner-dialog-close').addEventListener('click', () => $('#planner-dialog').close());
  $('#planner-dialog-cancel').addEventListener('click', () => $('#planner-dialog').close());
  $('#planner-entry-add').addEventListener('click', () => { $('#planner-entry-list').insertAdjacentHTML('beforeend', plannerEntryRow()); bindPlannerEntryRows(); });
  $('#planner-form').addEventListener('submit', savePlannerCell);
  $('#planner-day-kind').addEventListener('change', updatePlannerDayKind);
  $('#planner-requirements-close').addEventListener('click', () => $('#planner-requirements-dialog').close());
  $('#requirement-days').addEventListener('change', async event => { state.requirementDays = Number(event.target.value); await loadPlannerRequirementRange(); });
  $$('.requirement-shift').forEach(button => button.addEventListener('click', async () => { state.requirementFrom = addDays(state.requirementFrom, button.dataset.days === 'previous' ? -state.requirementDays : state.requirementDays); await loadPlannerRequirementRange(); }));
  $('#requirement-today').addEventListener('click', async () => { state.requirementFrom = mondayOf(today()); await loadPlannerRequirementRange(); });
  $('#requirement-collapse-all').addEventListener('click', () => { requirementCollapsibleGroups().forEach(id => state.requirementCollapsedGroups.add(id)); renderPlannerRequirementsCalendar(); });
  $('#requirement-expand-all').addEventListener('click', () => { state.requirementCollapsedGroups.clear(); renderPlannerRequirementsCalendar(); });
  $('#requirement-copy').addEventListener('click', copyRequirementSelection);
  $('#requirement-paste').addEventListener('click', pasteRequirementSelectionFromClipboard);
  $('#planner-requirements-save').addEventListener('click', savePlannerRequirementsCalendar);
  $('#planner-holiday-add')?.addEventListener('click', addPlannerHoliday);
  $('#planner-hours-close').addEventListener('click', () => $('#planner-hours-dialog').close());
  $('#task-checklist-close').addEventListener('click', () => $('#task-checklist-dialog').close());
  $('#task-checklist-cancel').addEventListener('click', () => $('#task-checklist-dialog').close());
  $('#task-checklist-save').addEventListener('click', saveTaskChecklistPopup);
  $('#notification-open').addEventListener('click', async () => { state.announcementTab = 'inbox'; await setView('announcements'); });
  $('#calendar-filter-close').addEventListener('click', () => $('#calendar-filter-dialog').close());
  $('#calendar-filter-cancel').addEventListener('click', () => $('#calendar-filter-dialog').close());
  $('#calendar-filter-form').addEventListener('submit', applyCalendarFilters);
  $('#config-full-close').addEventListener('click', () => { state.configPanel = null; $('#config-full-dialog').close(); });
  $('#config-full-dialog').addEventListener('close', () => { if (!$('#config-full-dialog').dataset.refreshing) state.configPanel = null; });
  $('#entity-selection-close').addEventListener('click', closeEntitySelection);
  $('#entity-selection-cancel').addEventListener('click', closeEntitySelection);
  $('#entity-selection-search').addEventListener('input', renderEntitySelection);
  $('#entity-selection-type').addEventListener('change', renderEntitySelection);
  $('#entity-selection-apply').addEventListener('click', applyEntitySelection);
  $('#bulk-choice-close').addEventListener('click', () => closeBulkChoice(null));
  $('#bulk-choice-cancel').addEventListener('click', () => closeBulkChoice(null));
  $('#bulk-choice-search').addEventListener('input', renderBulkChoiceList);
  $('#bulk-choice-select-visible').addEventListener('click', () => setVisibleBulkChoices(true));
  $('#bulk-choice-clear-visible').addEventListener('click', () => setVisibleBulkChoices(false));
  $('#bulk-choice-apply').addEventListener('click', applyBulkChoice);
  $('#bulk-choice-dialog').addEventListener('close', () => { if (state.bulkChoice) closeBulkChoice(null); });
  $('#status-transfer-close').addEventListener('click', () => $('#status-transfer-dialog').close());
  $('#status-transfer-cancel').addEventListener('click', () => $('#status-transfer-dialog').close());
  $('#status-transfer-add-section').addEventListener('click', () => addStatusTransferSection());
  $('#status-transfer-form').addEventListener('submit', saveStatusTransfer);
  $('#status-transfer-delete').addEventListener('click', deleteStatusTransfer);
  $('#status-transfer-audit').addEventListener('click', openStatusTransferAudit);
  document.addEventListener('click', event => {
    if (!event.target.closest('#context-menu')) $('#context-menu').classList.add('hidden');
    if (!event.target.closest('.global-search')) $('#global-search-results').classList.add('hidden');
    if (!event.target.closest('.comment-compose')) $('#comment-mention-suggestions').classList.add('hidden');
    document.querySelectorAll('details.table-filter-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; });
  });
  document.addEventListener('keydown', handlePlannerClipboardShortcut);
  document.addEventListener('close', event => {
    if (event.target instanceof HTMLDialogElement) queueMicrotask(elevateVisibleToast);
  }, true);
  installDropdownLayers();
  installDialogOutsideClose();
}

function installDropdownLayers() {
  const selector = 'details.table-filter-menu,details.multi-user-select,details.transfer-scope-picker,details.hierarchy-target-dropdown,details.hierarchy-multi-dropdown';
  const closeMenus = () => document.querySelectorAll(`${selector.split(',').map(part => `${part}[open]`).join(',')}`).forEach(menu => { menu.open = false; });
  document.addEventListener('toggle', event => {
    const menu = event.target;
    if (!(menu instanceof HTMLDetailsElement) || !menu.matches(selector)) return;
    const panel = menu.querySelector(':scope > div');
    if (!panel || !('showPopover' in panel)) return;
    if (!menu.open) { if (panel.matches(':popover-open')) panel.hidePopover(); return; }
    document.querySelectorAll(selector).forEach(other => { if (other !== menu) other.open = false; });
    panel.classList.add('dropdown-layer');
    panel.setAttribute('popover', 'manual');
    panel.showPopover();
    const anchor = menu.querySelector('summary').getBoundingClientRect();
    const width = Math.min(innerWidth - 16, Math.max(230, Math.min(420, anchor.width)));
    const below = innerHeight - anchor.bottom - 12;
    const above = anchor.top - 12;
    const useBelow = below >= Math.min(260, panel.scrollHeight) || below >= above;
    panel.style.setProperty('--dropdown-width', `${width}px`);
    panel.style.setProperty('--dropdown-max-height', `${Math.max(40, Math.min(310, useBelow ? below : above))}px`);
    panel.style.setProperty('--dropdown-left', `${Math.max(8, Math.min(innerWidth - width - 8, anchor.left))}px`);
    panel.style.setProperty('--dropdown-top', `${useBelow ? anchor.bottom + 4 : Math.max(8, anchor.top - panel.getBoundingClientRect().height - 4)}px`);
  }, true);
  document.addEventListener('pointerdown', event => {
    document.querySelectorAll(selector).forEach(menu => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
  }, true);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && document.querySelector('.dropdown-layer:popover-open')) {
      event.preventDefault(); closeMenus();
    }
  }, true);
  document.addEventListener('close', event => {
    if (event.target instanceof HTMLDialogElement) event.target.querySelectorAll(selector).forEach(menu => { menu.open = false; });
  }, true);
  document.addEventListener('scroll', event => { if (!event.target.closest?.('.dropdown-layer')) closeMenus(); }, true);
  window.addEventListener('resize', closeMenus);
}

function fillScopeSelect(select, selected = 'all') {
  const host = $('#controller-picker-host');
  if (!host) return;
  const valid = selected === 'all' || String(selected).startsWith('group:') || state.controllers.some(item => item.code === selected);
  const value = valid ? selected : 'all';
  host.innerHTML = hierarchyTargetTreeHtml(value, { fieldName: 'controller_scope', inputId: 'controller', allowProject: true, controllerValuePrefix: false });
  bindHierarchyTargetTrees(host);
  state.controller = value;
}

function openProjectDialog(mandatory = false) {
  const dialog = $('#project-dialog');
  $('#project-close').hidden = mandatory || !state.me.current_project;
  $('#project-list').innerHTML = state.projects.map(project => `<button type="button" class="project-option" data-project-id="${project.id}" style="${projectColorStyle(project.planner_color)}"><span class="project-code">${escapeHtml(project.code)}</span><span class="project-option-name"><b>${escapeHtml(project.name || project.code)}</b><small>${escapeHtml(project.description || 'Projekt bez opisu')}</small></span><span class="badge blue">${escapeHtml(roleName(project.project_role))}</span></button>`).join('') || '<div class="empty">Brak dostępnych projektów. Skontaktuj się z administratorem systemu.</div>';
  $$('.project-option').forEach(button => button.addEventListener('click', async () => {
    try {
      state.me = await api('/api/select-project', { method: 'POST', body: JSON.stringify({ project_id: Number(button.dataset.projectId) }) });
      state.projects = state.me.projects || [];
      state.controller = 'all';
      state.view = 'mine';
      state.activeSavedView = {};
      clearPlannerSelections(false);
      state.plannerRequirementEdit = false; state.requirementProjectId = null; state.requirementDirty = new Set();
      updateIdentity();
      if (dialog.id === 'modal') closeOrReturnRecordDialog();
      else dialog.close();
      await loadData();
      startLiveSync();
      toast(`Wybrano projekt ${state.me.current_project.code}`);
    } catch (error) { toast(error.message, true); }
  }));
  if (!dialog.open) dialog.showModal();
}

const themes = [
  { id: 'industrial-pro', name: 'Industrial Pro', description: 'Techniczny granat i elektryczny błękit.', mode: 'Ciemny', colors: ['#081B30', '#0057C8', '#74C7F8', '#41546A', '#F8FAFC'] },
  { id: 'modern-light', name: 'Modern Light', description: 'Jasny, minimalistyczny interfejs do codziennej pracy.', mode: 'Jasny', colors: ['#F3F7FC', '#1139D8', '#62A0FF', '#DCE5F0', '#17243F'] },
  { id: 'dark-professional', name: 'Dark Professional', description: 'Stonowany grafit z zielonym akcentem.', mode: 'Ciemny', colors: ['#101719', '#235E41', '#65C466', '#354F48', '#E8EDF0'] },
  { id: 'siemens-inspired', name: 'Siemens Inspired', description: 'Przemysłowy turkus i czyste powierzchnie.', mode: 'Jasny', colors: ['#07556C', '#099DAD', '#D3EFF2', '#D8E3EB', '#152C39'] },
  { id: 'rockwell-inspired', name: 'Rockwell Inspired', description: 'Grafit z mocnym czerwonym akcentem.', mode: 'Ciemny', colors: ['#181B20', '#C51D35', '#EA8796', '#444B55', '#F1F4F8'] },
  { id: 'green-automation', name: 'Green Automation', description: 'Mięta i zieleń dla czytelnego interfejsu automatyki.', mode: 'Jasny', colors: ['#EAF8F1', '#06754E', '#58BA68', '#D4F4DA', '#193B30'] },
  { id: 'amber-industrial', name: 'Amber Industrial', description: 'Antracyt, pomarańcz i bursztyn.', mode: 'Ciemny', colors: ['#141719', '#F58A00', '#FFBB21', '#515B68', '#F0F2F5'] },
  { id: 'tech-purple', name: 'Tech Purple', description: 'Granat z eleganckim technologicznym fioletem.', mode: 'Ciemny', colors: ['#1A142C', '#6630CA', '#B88AFF', '#45425D', '#F7F3FF'] },
  { id: 'steel-blue', name: 'Steel Blue', description: 'Stalowe odcienie niebieskiego dla zespołów inżynierskich.', mode: 'Jasny', colors: ['#E7EFF9', '#164A86', '#2378CC', '#AECDEA', '#172A45'] },
  { id: 'minimal-pro', name: 'Minimal Pro', description: 'Biel, grafit i chłodne szarości bez rozpraszaczy.', mode: 'Jasny', colors: ['#F7F9FC', '#182638', '#788796', '#CBD4DE', '#FFFFFF'] }
];
const legacyThemeAliases = {
  dark: 'industrial-pro', graphite: 'dark-professional', contrast: 'minimal-pro', aurora: 'tech-purple',
  oceanic: 'siemens-inspired', nord: 'steel-blue', solar: 'amber-industrial', sakura: 'modern-light',
  cyber: 'dark-professional', classic: 'modern-light'
};
function applyTheme(theme) {
  const selected = themes.some(item => item.id === theme) ? theme : legacyThemeAliases[theme] || 'industrial-pro';
  const definition = themes.find(item => item.id === selected);
  document.documentElement.dataset.theme = selected;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', definition.colors[0]);
  state.me.theme = selected;
}
function openThemeDialog() {
  $('#theme-list').innerHTML = themes.map(({ id, name, description, mode, colors }) => `<button type="button" class="theme-card ${state.me.theme === id ? 'active' : ''}" data-theme="${id}" style="--preview-bg:${colors[0]};--preview-accent:${colors[1]};--preview-secondary:${colors[2]};--preview-line:${colors[3]};--preview-contrast:${colors[4]}"><span class="theme-preview" aria-hidden="true"><i></i><span></span><b></b></span><span class="theme-card-title"><strong>${name}</strong><em>${mode}</em></span><small>${description}</small><span class="theme-swatches" aria-label="Paleta kolorów">${colors.map(color => `<i style="--swatch:${color}" title="${color}"></i>`).join('')}</span></button>`).join('');
  $$('.theme-card').forEach(button => button.addEventListener('click', async () => {
    const theme = button.dataset.theme;
    applyTheme(theme);
    try { await api('/api/preferences', { method: 'PATCH', body: JSON.stringify({ theme }) }); toast('Motyw został zapisany'); }
    catch (error) { toast(error.message, true); }
    $('#theme-dialog').close();
  }));
  $('#theme-dialog').showModal();
}

function openExportDialog() {
  fillScopeSelect($('#export-scope'), state.controller);
  $('#export-template').innerHTML = '<option value="">Ustawienia ręczne</option>' + (state.config.export_templates || []).map(item => `<option value="${item.id}">${escapeHtml(item.name)}</option>`).join('');
  const suggested = state.view === 'status' ? 'status' : state.view === 'points' ? 'points' : 'project';
  $('#export-type').value = suggested;
  updateExportFields();
  $('#export-dialog').showModal();
}
function updateExportFields() {
  const type = $('#export-type').value;
  $$('.export-status-field').forEach(field => field.hidden = type !== 'status');
  $$('.export-filter-field').forEach(field => field.hidden = type === 'project');
  $('#export-scope').closest('.field').hidden = type === 'project';
  const statuses = type === 'points' ? statusDefinitions('point') : statusWorkflowOptions();
  $('#export-status-filter').innerHTML = selectOptions(statuses, '', 'Wszystkie');
}
async function runExport(event) {
  event.preventDefault();
  const type = $('#export-type').value;
  const endpoint = type === 'project' ? '/api/exports/project' : type === 'status' ? '/api/exports/status' : '/api/exports/open-points';
  const status = $('#export-status-filter').value;
  const body = { scope: $('#export-scope').value, template_id: Number($('#export-template').value) || null, detail_level: $('#export-detail').value, sort_key: $('#export-sort').value, filters: status ? { status } : {} };
  const button = $('#export-form button.primary');
  button.disabled = true; button.textContent = 'Generowanie…';
  try {
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'Nie udało się wygenerować eksportu');
    const blob = await response.blob();
    const disposition = response.headers.get('content-disposition') || '';
    const filename = disposition.match(/filename="([^"]+)"/)?.[1] || 'eksport.xlsx';
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    $('#export-dialog').close(); toast('Plik Excel został wygenerowany');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; button.textContent = 'Pobierz Excel'; }
}

function installDialogOutsideClose() {
  const startedOutside = new WeakMap();
  $$('dialog').forEach(dialog => {
    dialog.addEventListener('input', () => { dialog.dataset.dirty = '1'; dialog.dataset.outsideWarning = ''; });
    dialog.addEventListener('change', () => { dialog.dataset.dirty = '1'; dialog.dataset.outsideWarning = ''; });
    dialog.addEventListener('close', () => { dialog.dataset.dirty = ''; dialog.dataset.outsideWarning = ''; dialog.classList.remove('dirty-warning'); });
    dialog.addEventListener('pointerdown', event => startedOutside.set(dialog, event.target === dialog));
    dialog.addEventListener('click', event => {
      if (event.target !== dialog || !startedOutside.get(dialog)) return;
      startedOutside.set(dialog, false);
      if (dialog.id === 'project-dialog' && !state.me.current_project) return;
      if (dialog.dataset.dirty === '1' && dialog.dataset.outsideWarning !== '1') {
        dialog.dataset.outsideWarning = '1'; dialog.classList.add('dirty-warning'); setTimeout(() => dialog.classList.remove('dirty-warning'), 600);
        toast('Masz niezapisane zmiany. Kliknij poza oknem ponownie, aby je odrzucić.', true); return;
      }
      dialog.close();
    });
  });
}

function uiForm({ title, description = '', fields = [], submitLabel = 'Zastosuj', danger = false, secondaryLabel = '', secondaryDanger = true }) {
  const dialog = $('#action-dialog');
  $('#action-title').textContent = title;
  $('#action-description').textContent = description;
  $('#action-submit').textContent = submitLabel;
  $('#action-submit').className = danger ? 'danger' : 'primary';
  $('#action-submit').disabled = false;
  $('#action-secondary').hidden = !secondaryLabel;
  $('#action-secondary').textContent = secondaryLabel;
  $('#action-secondary').className = secondaryDanger ? 'danger' : 'secondary';
  $('#action-fields').innerHTML = fields.map(field => {
    if (field.type === 'html') return `<div class="field ${field.full ? 'full' : ''} ui-form-html">${field.html || ''}</div>`;
    const optionLabels = (field.options || []).map(option => String(typeof option === 'object' ? option.label : option));
    const compact = field.compact ?? ((field.type === 'select' && optionLabels.length && Math.max(...optionLabels.map(label => label.length)) <= 22) || ['date', 'number', 'checkbox', 'time'].includes(field.type));
    const optionsHtml = (field.options || []).map(option => {
      const value = typeof option === 'object' ? option.value : option;
      const label = typeof option === 'object' ? option.label : option;
      return `<option value="${escapeHtml(value)}"${String(value) === String(field.value ?? '') ? ' selected' : ''}>${escapeHtml(badgeMap[label]?.[0] || label)}</option>`;
    }).join('');
    const selectedValues = new Set((Array.isArray(field.value) ? field.value : []).map(String));
    if (field.type === 'user-multiselect') {
      const selectedNames = (field.options || []).filter(option => selectedValues.has(String(typeof option === 'object' ? option.value : option))).map(option => typeof option === 'object' ? option.label : option);
      const emptyLabel = field.emptyLabel || 'Wybierz osoby odpowiedzialne';
      return `<div class="field ${field.full ? 'full' : ''}"><span>${escapeHtml(field.label || field.name)}</span><details class="multi-user-select" data-ui-multiselect="${escapeHtml(field.name)}" data-empty-label="${escapeHtml(emptyLabel)}"><summary>${escapeHtml(selectedNames.length ? `${selectedNames.length} · ${selectedNames.join(', ')}` : emptyLabel)}</summary><div class="mentions assignee-grid"><input class="multi-choice-search" type="search" placeholder="Szukaj osoby…">${(field.options || []).map(option => { const optionValue = typeof option === 'object' ? option.value : option; const optionLabel = typeof option === 'object' ? option.label : option; return `<label class="mention"><input name="${escapeHtml(field.name)}" type="checkbox" value="${escapeHtml(optionValue)}" ${selectedValues.has(String(optionValue)) ? 'checked' : ''}>${escapeHtml(optionLabel)}</label>`; }).join('')}</div></details></div>`;
    }
    const input = field.type === 'hierarchy-multiselect'
      ? hierarchyMultiFormHtml(field)
      : field.type === 'textarea'
      ? `<textarea name="${escapeHtml(field.name)}" rows="${field.rows || 4}" ${field.required ? 'required' : ''}>${escapeHtml(field.value || '')}</textarea>`
      : field.type === 'select'
        ? `<select name="${escapeHtml(field.name)}">${optionsHtml}</select>`
        : field.type === 'grouped-multiselect'
          ? `<div class="ui-grouped-multiselect" data-ui-multiselect="${escapeHtml(field.name)}">${(field.groups || []).map(group => `<section><h4>${escapeHtml(group.label)} <small>${group.options?.length || 0}</small></h4><div>${(group.options || []).map(option => `<label><input name="${escapeHtml(field.name)}" type="checkbox" value="${escapeHtml(option.value)}" ${selectedValues.has(String(option.value)) ? 'checked' : ''}><span>${escapeHtml(option.label)}</span></label>`).join('') || '<p class="sub">Brak elementów</p>'}</div></section>`).join('')}</div>`
        : field.type === 'multiselect'
          ? `<div class="ui-multiselect" data-ui-multiselect="${escapeHtml(field.name)}">${(field.options || []).map(option => { const optionValue = typeof option === 'object' ? option.value : option; const optionLabel = typeof option === 'object' ? option.label : option; return `<label><input name="${escapeHtml(field.name)}" type="checkbox" value="${escapeHtml(optionValue)}" ${selectedValues.has(String(optionValue)) ? 'checked' : ''}><span>${escapeHtml(badgeMap[optionLabel]?.[0] || optionLabel)}</span></label>`; }).join('')}</div>`
        : field.type === 'checkbox'
          ? `<input name="${escapeHtml(field.name)}" type="checkbox" value="1" ${field.value ? 'checked' : ''}>`
          : `<input name="${escapeHtml(field.name)}" type="${field.type || 'text'}" value="${escapeHtml(field.value ?? '')}" ${field.required ? 'required' : ''}${field.min !== undefined ? ` min="${escapeHtml(field.min)}"` : ''}${field.max !== undefined ? ` max="${escapeHtml(field.max)}"` : ''}${field.step !== undefined ? ` step="${escapeHtml(field.step)}"` : ''}>`;
    return `<label class="field ${field.full ? 'full' : compact ? 'ui-compact-field' : ''} ${escapeHtml(field.className || '')}"><span>${escapeHtml(field.label || field.name)}</span>${input}${field.hint ? `<small class="sub">${escapeHtml(field.hint)}</small>` : ''}</label>`;
  }).join('') || `<p class="dialog-confirm-text">${escapeHtml(description || 'Czy na pewno chcesz kontynuować?')}</p>`;
  bindHierarchyMultiDropdown(dialog);
  dialog.querySelectorAll('.multi-choice-search').forEach(search => search.addEventListener('input', () => { const term = search.value.trim().toLocaleLowerCase('pl'); search.parentElement.querySelectorAll(':scope > label').forEach(label => { label.hidden = Boolean(term) && !label.textContent.toLocaleLowerCase('pl').includes(term); }); }));
  dialog.querySelectorAll('.multi-user-select input[type="checkbox"]').forEach(input => input.addEventListener('change', () => { const details = input.closest('details'); const names = [...details.querySelectorAll('input[type="checkbox"]:checked')].map(control => control.closest('label').textContent.trim()); details.querySelector('summary').textContent = names.length ? `${names.length} · ${names.join(', ')}` : details.dataset.emptyLabel || 'Wybierz osoby odpowiedzialne'; }));
  if (state.actionResolve) state.actionResolve(null);
  return new Promise(resolve => {
    state.actionResolve = resolve;
    dialog.dataset.dirty = '';
    if (!dialog.open) dialog.showModal();
    const firstField = $('#action-fields input, #action-fields textarea, #action-fields select');
    (firstField || $('#action-submit')).focus();
  });
}

function uiConfirm(title, description, submitLabel = 'Potwierdź', danger = false) {
  return uiForm({ title, description, submitLabel, danger });
}

function finishAction(result) {
  const resolve = state.actionResolve;
  state.actionResolve = null;
  const dialog = $('#action-dialog');
  if (dialog.open) { dialog.dataset.actionCompleted = '1'; dialog.close(); }
  if (resolve) resolve(result);
}

async function loadData(silent = false) {
  const loadId = ++state.loadSequence;
  ensureProjectCache();
  if ($('#config-full-dialog')?.open) state.configScroll = $('#config-full-content')?.scrollTop || 0;
  if (!silent) $('#content').innerHTML = '<div class="loading">Ładowanie danych…</div>';
  const query = `?controller=${encodeURIComponent(state.controller)}`;
  state.notesFrom ||= twoWeeksAgo();
  state.notesTo ||= today();
  state.announcementFrom ||= twoWeeksAgo();
  state.announcementTo ||= today();
  state.plannerFrom ||= mondayOf(today());
  state.calendarFrom ||= mondayOf(today());
  state.calendarTo ||= addDays(state.calendarFrom, 6);
  const notesQuery = `${query}&from=${state.notesFrom}&to=${state.notesTo}`;
  const plannerQuery = `?from=${state.plannerFrom}&to=${addDays(state.plannerFrom, state.plannerDays - 1)}`;
  const calendarParams = new URLSearchParams({ controller: state.controller, from: state.calendarFrom, to: state.calendarTo, only_mine: state.calendarOnlyMine ? '1' : '0', category: state.calendarCategory });
  state.calendarTypes.forEach(type => calendarParams.append('type', type));
  state.calendarPriorities.forEach(priority => calendarParams.append('priority', priority));
  const requests = {
    controllerGroups: cachedDataRequest('controllerGroups', '/api/controller-groups'),
    controllers: cachedDataRequest('controllers', '/api/controllers'),
    users: cachedDataRequest('users', '/api/users'),
    config: cachedDataRequest('config', '/api/config'),
    announcements: cachedDataRequest('announcements', '/api/announcements'),
    meetingSummaries: cachedDataRequest('meetingSummaries', '/api/meeting-summaries'),
    notifications: cachedDataRequest('notifications', '/api/notifications', 15000),
    navigationCounts: cachedDataRequest('navigationCounts', '/api/navigation-counts', 15000),
    savedViews: cachedDataRequest('savedViews', '/api/saved-views')
  };
  const addWorkCollections = (includeGoals = false, includeNotes = false) => {
    requests.status = api('/api/status' + query); requests.tasks = api('/api/tasks' + query); requests.points = api('/api/open-points' + query);
    if (includeGoals) requests.goals = api('/api/goals' + query);
    if (includeNotes) requests.notes = api('/api/daily-notes' + notesQuery);
  };
  if (state.view === 'mine') requests.mine = api('/api/my-summary');
  if (state.view === 'announcements' && state.announcementTab === 'inbox') {
    requests.mine = api('/api/my-summary');
    requests.communicationPreferences = api('/api/communication-preferences');
    if (canCoordinate()) requests.operationsPayload = api(`/api/operations${query}&tab=triage`);
  }
  if (state.view === 'overview') { requests.overview = api('/api/overview' + query); requests.dashboard = api('/api/dashboard' + query); addWorkCollections(true); }
  if (['status', 'tasks', 'points'].includes(state.view)) { requests.dashboard = api('/api/dashboard' + query); addWorkCollections(); }
  if (state.view === 'points') requests.externalDependencies = api('/api/external-dependencies');
  if (state.view === 'goals') { requests.goals = api('/api/goals' + query); addWorkCollections(); }
  if (state.view === 'notes') addWorkCollections(true, true);
  if (state.view === 'planner') { requests.planner = api('/api/planner' + plannerQuery); if (canCoordinate()) requests.plannerRawPlans = api('/api/planner/raw-plans'); }
  if (state.view === 'calendar') { requests.calendar = api('/api/calendar?' + calendarParams); requests.calendarPlanner = api(`/api/planner?from=${state.calendarFrom}&to=${state.calendarTo}`); }
  if (state.view === 'history') requests.history = api('/api/history?limit=200');
  if (state.view === 'operations' && canCoordinate()) {
    requests.operationsPayload = api(`/api/operations${query}&tab=${encodeURIComponent(state.operationsTab)}`);
  }
  const entries = Object.entries(requests);
  const values = await Promise.all(entries.map(([, request]) => request));
  if (loadId !== state.loadSequence) return;
  entries.forEach(([key], index) => {
    if (key === 'operationsPayload') mergeOperationsData(values[index]);
    else state[key] = values[index];
  });
  if (state.view === 'planner' && state.plannerRawPlanId) {
    if (!state.plannerRawPlans.some(plan => Number(plan.id) === Number(state.plannerRawPlanId))) state.plannerRawPlanId = null;
    else state.planner = await api(`/api/planner/raw-plans/${state.plannerRawPlanId}${plannerQuery}`);
  }
  state.dependencyOptions = { status: state.status, task: state.tasks, point: state.points };
  state.taskDependencyOptions = state.tasks;
  state.dependencyOptionsAll = state.controller === 'all';
  if (!state.controllers.some(item => item.code === state.functionGroupController)) {
    state.functionGroupController = state.controller !== 'all' && state.controllers.some(item => item.code === state.controller)
      ? state.controller : state.controllers[0]?.code || '';
  }
  const current = state.controller;
  fillScopeSelect($('#controller'), current);
  updateCounts();
  updateNotificationUi();
  render();
  if ($('#config-full-dialog')?.open && state.configPanel) refreshConfigPanel();
}

async function changeOwnPassword() {
  const result = await uiForm({ title: 'Zmień hasło', description: 'Po zapisaniu używaj nowego hasła przy kolejnym logowaniu.', submitLabel: 'Zmień hasło', fields: [
    { name: 'current_password', label: 'Bieżące hasło', type: 'password', required: true },
    { name: 'new_password', label: 'Nowe hasło (min. 8 znaków)', type: 'password', required: true },
    { name: 'confirm_password', label: 'Powtórz nowe hasło', type: 'password', required: true }
  ] });
  if (!result) return;
  if (result.new_password !== result.confirm_password) return toast('Nowe hasła nie są takie same', true);
  try { await api('/api/account/password', { method: 'PUT', body: JSON.stringify(result) }); toast('Hasło zostało zmienione'); }
  catch (error) { toast(error.message, true); }
}

async function manageAccountSecurity() {
  try {
    const security = await api('/api/account/security');
    if (!security.mfa_enabled) {
      if (!security.mfa_available) return toast('Administrator musi najpierw ustawić MFA_ENCRYPTION_KEY na Railway.', true);
      const credentials = await uiForm({ title: 'Włącz uwierzytelnianie dwuskładnikowe', description: 'Potwierdź bieżące hasło. Następnie dodasz konto w aplikacji uwierzytelniającej.', submitLabel: 'Rozpocznij', fields: [
        { name: 'current_password', label: 'Bieżące hasło', type: 'password', required: true }
      ] });
      if (!credentials) return;
      const setup = await api('/api/account/mfa/setup', { method: 'POST', body: JSON.stringify(credentials) });
      const confirmation = await uiForm({ title: 'Dodaj konto w aplikacji MFA', description: 'W aplikacji uwierzytelniającej wybierz dodawanie klucza ręcznie. Zapisz kod, który pojawi się w aplikacji.', submitLabel: 'Włącz MFA', fields: [
        { name: 'secret', label: 'Klucz konfiguracji', value: setup.secret, hint: 'Nazwa konta: PLC Commissioning Hub' },
        { name: 'code', label: 'Aktualny kod 6-cyfrowy', inputmode: 'numeric', required: true }
      ] });
      if (!confirmation) return;
      const enabled = await api('/api/account/mfa/enable', { method: 'POST', body: JSON.stringify({ code: confirmation.code }) });
      await uiForm({ title: 'Kody awaryjne MFA', description: 'Zapisz je w bezpiecznym miejscu. Każdego kodu można użyć tylko raz.', submitLabel: 'Zapisałem kody', fields: [
        { name: 'recovery_codes', label: 'Kody awaryjne', type: 'textarea', rows: 10, value: enabled.recovery_codes.join('\n') }
      ] });
      return toast('MFA zostało włączone');
    }
    const disabled = await uiForm({ title: 'Bezpieczeństwo konta', description: `MFA jest aktywne. Pozostałe kody awaryjne: ${security.recovery_codes_remaining}. Wyłączenie wymaga hasła i kodu MFA.`, submitLabel: 'Wyłącz MFA', danger: true, fields: [
      { name: 'current_password', label: 'Bieżące hasło', type: 'password', required: true },
      { name: 'code', label: 'Kod MFA lub awaryjny', required: true }
    ] });
    if (!disabled) return;
    await api('/api/account/mfa', { method: 'DELETE', body: JSON.stringify(disabled) });
    toast('MFA zostało wyłączone');
  } catch (error) { toast(error.message, true); }
}

function startLiveSync() {
  state.liveSource?.close();
  if (!state.me?.current_project || !globalThis.EventSource) return;
  const source = new EventSource(`/api/events?client_id=${encodeURIComponent(clientId)}`);
  state.liveSource = source;
  source.addEventListener('change', event => {
    let change; try { change = JSON.parse(event.data); } catch { return; }
    if (change.client_id === clientId) return;
    if (change.path) invalidateCacheForMutation(change.path);
    else invalidateDataCache('controllerGroups', 'controllers', 'users', 'config', 'announcements', 'meetingSummaries', 'notifications', 'navigationCounts', 'savedViews');
    clearTimeout(state.liveRefreshTimer);
    state.liveRefreshTimer = setTimeout(async () => {
      try {
        if ($('#config-full-dialog')?.open && $('#config-full-dialog').dataset.dirty === '1') {
          [state.announcements, state.notifications] = await Promise.all([api('/api/announcements'), api('/api/notifications')]);
          rememberDataCache('announcements', state.announcements); rememberDataCache('notifications', state.notifications);
          updateNotificationUi();
          toast('Inny użytkownik zmienił dane. Zapisz lub zamknij konfigurację, aby odświeżyć pełny widok.');
        } else {
          const openDialog = state.dialog?.record && $('#modal')?.open ? { type: state.dialog.type, id: state.dialog.record.id, updated_at: state.dialog.record.updated_at, dirty: $('#modal').dataset.dirty === '1' } : null;
          await loadData(true);
          if (openDialog) {
            const entityType = typeToEntity(openDialog.type);
            const fresh = openDialog.type === 'announcements' ? state.announcements.find(item => item.id === Number(openDialog.id)) : entityType ? entity(entityType, openDialog.id) : null;
            if (fresh && fresh.updated_at !== openDialog.updated_at) {
              if (openDialog.dirty) toast('Ten otwarty element został zmieniony przez inną osobę. Twoje pola pozostają bez zmian; zapis wymaga ponownego otwarcia najnowszej wersji.', true);
              else { await openRecord(openDialog.type, fresh, null, null, true); toast('Otwarty element zaktualizowano na żywo'); }
            }
          }
        }
      } catch { /* EventSource ponowi połączenie, a okresowe sprawdzanie pozostaje aktywne. */ }
    }, 180);
  });
}

function updateCounts() {
  $('#n-announcements').textContent = communicationAttentionCount();
  $('#n-status').textContent = state.navigationCounts.status || 0;
  $('#n-tasks').textContent = Number(state.navigationCounts.tasks || 0) + Number(state.navigationCounts.points || 0) + Number(state.navigationCounts.goals || 0);
  if (state.operations?._loaded?.triage) $('#n-operations').textContent = state.operations.triage?.length || 0;
}

let notificationPollTimer;
function startNotificationPolling() {
  clearInterval(notificationPollTimer);
  notificationPollTimer = setInterval(async () => {
    if (!state.me?.current_project || document.hidden) return;
    try {
      if (!state.liveSource || state.liveSource.readyState !== 1) await loadData(true);
      else { state.notifications = await api('/api/notifications'); rememberDataCache('notifications', state.notifications); updateNotificationUi(); }
    } catch { /* kolejna próba nastąpi automatycznie */ }
  }, 15000);
}

function notificationTarget(notification) {
  if (notification.entity_type === 'announcement') return state.announcements.find(item => item.id === Number(notification.entity_id));
  if (notification.entity_type === 'meeting') return state.meetingSummaries.find(item => item.id === Number(notification.entity_id));
  return entity(notification.entity_type, notification.entity_id);
}

function updateNotificationUi() {
  const attention = communicationAttentionCount();
  $('#notification-count').textContent = attention;
  if ($('#n-announcements')) $('#n-announcements').textContent = attention;
  $('#notification-open').classList.toggle('has-unread', attention > 0);
}

async function markNotificationAsRead(id) {
  const item = state.notifications.find(row => Number(row.id) === Number(id));
  if (!item || item.read_at) return;
  try {
    Object.assign(item, await api(`/api/notifications/${id}/read`, { method: 'POST' }));
    updateNotificationUi();
    if (state.view === 'announcements' && state.announcementTab === 'inbox') render();
    toast('Powiadomienie oznaczono jako przeczytane');
  } catch (error) { toast(error.message, true); }
}

async function openNotification(item) {
  if (!item) return;
  try {
    if (!item.read_at) {
      const updated = await api(`/api/notifications/${item.id}/read`, { method: 'POST' });
      Object.assign(item, updated);
      updateNotificationUi();
    }
  } catch (error) { toast(error.message, true); }
  if (item.kind === 'automation' && String(item.title || '').startsWith('Zmiana planu pracy:')) {
    await setView('planner');
    toast(item.message || 'Plan pracy został zaktualizowany');
    return;
  }
  if (item.entity_type === 'handover') {
    state.controller = 'all'; fillScopeSelect($('#controller'), 'all');
    await setView('notes');
    toast('Dawne przekazania zmian zostały przeniesione do modułu „Przekazanie statusu”');
    return;
  }
  if (item.entity_type === 'meeting') {
    state.meetingSummaries = await api('/api/meeting-summaries'); rememberDataCache('meetingSummaries', state.meetingSummaries);
    state.announcementTab = 'meetings'; await setView('announcements');
    const meeting = state.meetingSummaries.find(row => Number(row.id) === Number(item.entity_id));
    if (meeting) openMeetingPlanDetails(meeting); else toast('Plan odprawy nie jest już dostępny', true);
    return;
  }
  try {
    if (item.entity_type === 'announcement') { state.announcements = await api('/api/announcements'); rememberDataCache('announcements', state.announcements); }
    else {
      const targets = {
        status: ['/api/status?controller=all', 'status'], task: ['/api/tasks?controller=all', 'tasks'],
        point: ['/api/open-points?controller=all', 'points'], note: [`/api/daily-notes?controller=all&from=${addDays(today(), -3650)}&to=${addDays(today(), 3650)}`, 'notes'],
        goal: ['/api/goals?controller=all', 'goals']
      };
      const targetInfo = targets[item.entity_type];
      if (targetInfo) state[targetInfo[1]] = await api(targetInfo[0]);
    }
  } catch (error) { toast(`Nie udało się pobrać elementu: ${error.message}`, true); }
  if (item.entity_type === 'announcement') {
    const meeting = state.meetingSummaries.find(row => Number(row.published_announcement_id) === Number(item.entity_id));
    if (meeting) { state.announcementTab = 'meetings'; await setView('announcements'); openMeetingPlanDetails(meeting); return; }
    const announcement = notificationTarget(item);
    if (announcement) {
      await setView('announcements');
      openAnnouncementDetails(notificationTarget(item) || announcement);
    }
    else toast('Wiadomość nie jest już dostępna', true);
    return;
  }
  const target = notificationTarget(item);
  if (target) {
    state.controller = 'all'; fillScopeSelect($('#controller'), 'all');
    openEntityOverlay(item.entity_type, item.entity_id);
  }
  else toast('Powiązany element nie jest już dostępny', true);
}

async function acknowledgeAnnouncement(id) {
  try {
    const updated = await api(`/api/announcements/${id}/ack`, { method: 'POST' });
    const index = state.announcements.findIndex(item => item.id === Number(id));
    if (index >= 0) state.announcements[index] = updated;
    state.notifications = await api('/api/notifications'); rememberDataCache('notifications', state.notifications);
    updateNotificationUi();
    updateCounts();
    if (state.view === 'announcements') render();
    openAnnouncementDetails(updated);
    toast('Wiadomość została oznaczona jako przeczytana');
  } catch (error) { toast(error.message, true); }
}

async function setView(view) {
  if (view === 'settings' && state.me.role === 'user') return;
  if (view === 'operations' && !canCoordinate()) return;
  if (view === 'announcements' && state.view !== 'announcements') { state.announcementLabelFilter = ''; state.announcementImportanceFilter = ''; }
  state.view = view;
  document.body.classList.remove('nav-open');
  updateNavigationToggle();
  const parentView = ({ overview: 'mine', calendar: 'planner', points: 'tasks', goals: 'tasks', notes: 'announcements', history: 'announcements' })[view] || view;
  $$('#nav button').forEach(button => button.classList.toggle('active', button.dataset.view === parentView));
  await loadData();
}

function render() {
  const copy = pageCopy[state.view];
  $('#title').textContent = copy[0];
  $('#desc').textContent = copy[1];
  $('#add').textContent = copy[2];
  $('#add').hidden = !copy[2];
  ({ overview: renderOverview, announcements: renderAnnouncements, mine: renderMine, operations: renderOperations, planner: renderPlanner, calendar: renderCalendar, status: renderStatus, tasks: renderTasks, goals: renderGoals, points: renderPoints, notes: renderNotes, history: renderHistory, settings: renderSettings })[state.view]();
  decorateUnifiedWorkspace();
}

function unifiedWorkspaceTabs() {
  const pending = informationAnnouncements().filter(item => item.requires_ack && !item.accepted_by_me).length;
  const unread = communicationAttentionCount() - pending;
  if (['mine', 'overview'].includes(state.view)) return [
    { view: 'mine', label: 'Moja praca' }, { view: 'overview', label: 'Projekt' }
  ];
  if (['tasks', 'points', 'goals'].includes(state.view)) return [
    { view: 'tasks', label: 'Zadania' },
    { view: 'points', section: 'points', label: 'Otwarte punkty' },
    { view: 'points', section: 'external', label: 'Zależności zewnętrzne' },
    { view: 'goals', label: 'Kamienie milowe' }
  ];
  if (['planner', 'calendar'].includes(state.view)) return [
    { view: 'planner', label: 'Planner' }, { view: 'calendar', label: 'Kalendarz' }
  ];
  if (['announcements', 'notes', 'history'].includes(state.view)) return [
    { view: 'announcements', tab: 'inbox', label: 'Centrum wiadomości', count: pending + unread },
    { view: 'announcements', tab: 'news', label: 'Informacje', count: pending },
    { view: 'announcements', tab: 'meetings', label: 'Plany i priorytety' },
    { view: 'notes', label: 'Przekazania statusu' },
    { view: 'history', label: 'Historia zmian' }
  ];
  return [];
}

function decorateUnifiedWorkspace() {
  const tabs = unifiedWorkspaceTabs();
  const content = $('#content');
  if (!content) return;
  content.querySelector(':scope > .workspace-tabs')?.remove();
  if (tabs.length) {
    const active = item => item.view === state.view
      && (!item.section || item.section === state.pointSection)
      && (!item.tab || item.tab === state.announcementTab);
    content.insertAdjacentHTML('afterbegin', `<nav class="announcement-tabs workspace-tabs" aria-label="Widoki modułu">${tabs.map((item, index) => `<button type="button" data-workspace-tab="${index}" class="${active(item) ? 'active' : ''}">${escapeHtml(item.label)}${item.count ? `<b>${item.count}</b>` : ''}</button>`).join('')}</nav>`);
    $$('[data-workspace-tab]').forEach(button => button.addEventListener('click', async () => {
      const item = tabs[Number(button.dataset.workspaceTab)];
      if (item.section) state.pointSection = item.section;
      if (item.tab) state.announcementTab = item.tab;
      await setView(item.view);
    }));
  }
  syncModulePrimaryAction();
}

function syncModulePrimaryAction() {
  const content = $('#content');
  const source = $('#add');
  content?.querySelector('[data-module-primary-action]')?.remove();
  content?.querySelector('.module-action-bar')?.remove();
  if (!content || !source || source.hidden || !source.textContent.trim()) return;
  if (state.view === 'points' && state.pointSection === 'external') return;
  if (state.view === 'announcements' && state.announcementTab !== 'news') return;

  const targetSelector = {
    status: '#status-panel > .module-toolbar', tasks: '#task-filter-bar', points: '#point-filter-bar',
    calendar: '.calendar-command', notes: '#content > .panel > .toolbar', announcements: '.announcement-range-filters .toolbar'
  }[state.view];
  let target = targetSelector ? $(targetSelector) : null;
  if (!target) {
    const tabs = content.querySelector(':scope > .workspace-tabs');
    if (tabs) target = tabs;
    else {
      content.insertAdjacentHTML('afterbegin', '<div class="module-action-bar" data-module-action-bar></div>');
      target = content.querySelector('[data-module-action-bar]');
    }
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'primary module-primary-action';
  button.dataset.modulePrimaryAction = '';
  button.textContent = source.textContent;
  button.addEventListener('click', () => source.click());
  target.append(button);
}

function canManageAnnouncements() { return ['system_admin', 'project_admin', 'moderator'].includes(state.me.role); }

function safeExternalLink(value) {
  const link = String(value || '').trim();
  return /^(https?:\/\/|mailto:)/i.test(link) ? link : '';
}

function announcementAudience(item) {
  const scopes = (item.scopes || []).map(scope => scope.path_label || scope.name);
  return scopes.length ? scopes.join(', ') : 'Cały projekt';
}

function meetingAnnouncementIds() {
  return new Set((state.meetingSummaries || []).map(item => Number(item.published_announcement_id)).filter(Boolean));
}

function informationAnnouncements() {
  const meetingIds = meetingAnnouncementIds();
  return state.announcements.filter(item => !meetingIds.has(Number(item.id))).sort((left, right) => {
    const leftPending = Number(Boolean(left.requires_ack && !left.accepted_by_me));
    const rightPending = Number(Boolean(right.requires_ack && !right.accepted_by_me));
    return rightPending - leftPending || String(right.created_at).localeCompare(String(left.created_at)) || Number(right.id) - Number(left.id);
  });
}

function futureSnooze(value) {
  if (!value) return false;
  const normalized = String(value).includes('T') ? String(value) : `${String(value).replace(' ', 'T')}Z`;
  const timestamp = new Date(normalized).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function communicationAttentionCount() {
  const pending = informationAnnouncements().filter(item => item.requires_ack && !item.accepted_by_me && !futureSnooze(item.snoozed_until));
  const pendingIds = new Set(pending.map(item => Number(item.id)));
  const otherUnread = (state.notifications || []).filter(item => !item.read_at && !futureSnooze(item.snoozed_until) && !(item.entity_type === 'announcement' && pendingIds.has(Number(item.entity_id))));
  return pending.length + otherUnread.length;
}

function announcementStateClasses(item) {
  return [Number(item.created_by) === Number(state.me.id) ? 'own' : '', item.requires_ack && !item.accepted_by_me ? 'awaiting-ack' : '', item.accepted_by_me ? 'accepted' : ''].filter(Boolean).join(' ');
}

function openAnnouncementDetails(item) {
  if (!item) return;
  $('#insight-title').textContent = item.title;
  $('#insight-description').textContent = `${announcementAudience(item)} · ${item.created_by_name || 'System'} · ${displayDateTime(item.created_at)}`;
  const href = safeExternalLink(item.info_link);
  const labels = (item.labels || []).map(label => `<span class="announcement-label ${escapeHtml(label.color)}">${escapeHtml(label.name)}</span>`).join('');
  const acknowledgement = item.requires_ack
    ? (!item.accepted_by_me ? '<button class="primary" id="ack-announcement">Akceptuję · przeczytane</button>' : `<span class="announcement-read-self">✓ Zaakceptowano ${displayDateTime(item.accepted_at)}</span>`)
    : '<span class="announcement-read-self neutral">Wiadomość informacyjna — potwierdzenie nie jest wymagane od tego użytkownika.</span>';
  const reminder = item.requires_ack && !item.accepted_by_me ? '<button type="button" class="secondary" id="snooze-announcement-detail">Przypomnij później</button>' : '';
  const entryLabel = ({ message: 'Komunikat', decision: 'Decyzja projektowa', scope_change: 'Zmiana zakresu' })[item.entry_type] || 'Komunikat';
  $('#insight-content').innerHTML = `<article class="announcement-detail"><div class="announcement-tags"><span class="decision-type ${escapeHtml(item.entry_type || 'message')}">${entryLabel}</span><span class="importance importance-${escapeHtml(String(item.importance || 'normalna').toLowerCase())}">${escapeHtml(item.importance || 'Normalna')}</span>${labels}</div><p>${escapeHtml(item.content).replace(/\n/g, '<br>')}</p>${item.rationale ? `<section class="decision-rationale"><b>Uzasadnienie / wpływ</b><p>${escapeHtml(item.rationale).replace(/\n/g, '<br>')}</p><small>${item.effective_date ? `Obowiązuje od ${displayDate(item.effective_date)}` : ''} · ${escapeHtml(badgeText(item.decision_status || 'published'))}</small></section>` : ''}${href ? `<a class="announcement-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Otwórz dołączony link ↗</a>` : ''}<div class="announcement-audience"><span><b>Zakres:</b> ${escapeHtml(announcementAudience(item))}</span><span><b>Dotyczy bezpośrednio:</b> ${escapeHtml((item.recipient_names || []).join(', ') || 'wszyscy aktywni uczestnicy projektu')}</span></div><div class="goal-links">${(item.links || []).map(link => linkChip(link.entity_type, link.entity_id, ({ status: 'Status', task: 'Zadanie', point: 'Otwarty punkt', note: 'Przekazanie', goal: 'Kamień milowy' })[link.entity_type])).join('') || '<span class="sub">Brak przypiętych elementów</span>'}</div><section class="announcement-detail-actions"><div>${acknowledgement}${reminder}</div><div><b>Utwórz działanie z tej wiadomości</b><button type="button" class="secondary" data-announcement-work="task">+ Zadanie</button><button type="button" class="secondary" data-announcement-work="point">+ Otwarty punkt</button></div></section>${canManageAnnouncements() ? `<section class="announcement-receipts"><header><b>Potwierdzenia przeczytania</b><span>${item.accepted_count || 0}/${item.audience_count || 0}</span></header><div>${(item.accepted_users || []).map(user => `<span><b>${escapeHtml(user.display_name)}</b><small>${displayDateTime(user.read_at)}</small></span>`).join('') || '<small>Brak potwierdzeń.</small>'}</div></section><button class="secondary" id="edit-announcement-detail">Edytuj wiadomość</button>` : ''}</article>`;
  bindJumpItems();
  $('#ack-announcement')?.addEventListener('click', () => acknowledgeAnnouncement(item.id));
  $('#snooze-announcement-detail')?.addEventListener('click', () => { $('#insight-dialog').close(); snoozeMessage('announcement', item.id); });
  $$('[data-announcement-work]').forEach(button => button.addEventListener('click', () => createWorkFromAnnouncement(item.id, button.dataset.announcementWork)));
  $('#edit-announcement-detail')?.addEventListener('click', () => { $('#insight-dialog').close(); openRecord('announcements', item); });
  if (!$('#insight-dialog').open) $('#insight-dialog').showModal();
}

async function createWorkFromAnnouncement(id, entityType) {
  try {
    const result = await api(`/api/announcements/${id}/create-work`, { method: 'POST', body: JSON.stringify({ entity_type: entityType }) });
    const label = entityType === 'task' ? 'Zadanie' : 'Otwarty punkt';
    toast(`${label} został utworzony i powiązany z wiadomością`);
    $('#insight-dialog').close();
    await openEntityOverlay(entityType, result.entity.id);
  } catch (error) { toast(error.message, true); }
}

function meetingPriorityValue(value, fallback = 'Medium') { return Number(normalizeMeetingPriority(value, fallback)); }
function meetingPriorityOptions() { return MEETING_PRIORITY_DEFINITIONS.map(item => ({ value: item.value, label: item.label })); }
function meetingPriorityBadge(value) { const priority = meetingPriorityDefinition(value); return `<span class="meeting-priority-badge priority-${priority.value}" title="${escapeHtml(priority.label)}">${priority.short_label}</span>`; }
function meetingPlanSignature(meeting = {}) {
  const userIds = values => (values || []).map(Number).filter(Boolean).sort((a, b) => a - b);
  return JSON.stringify({
    title: String(meeting.title || ''), period_from: String(meeting.period_from || meeting.meeting_date || ''),
    period_to: String(meeting.period_to || meeting.meeting_date || ''), summary: String(meeting.summary || ''),
    items: (meeting.items || []).map(item => ({
      entity_type: String(item.entity_type || ''), entity_id: Number(item.entity_id || item.id) || 0,
      group_key: meetingGroupKey(item), decision: String(item.decision || ''),
      objective: String(item.objective || ''), outcome_comment: String(item.outcome_comment || ''),
      target_status: String(item.target_status || ''), meeting_priority: meetingPriorityValue(item.meeting_priority, item.entity?.priority),
      assignee_user_ids: userIds(item.assignee_user_ids), worker_user_ids: userIds(item.worker_user_ids),
      owner_user_id: Number(item.owner_user_id) || null, status_changed_by_user_id: Number(item.status_changed_by_user_id) || null,
      due_date: String(item.due_date || ''), item_status: String(item.item_status || 'open'), review_confirmed: Number(item.review_confirmed) ? 1 : 0
    }))
  });
}
function meetingLifecycle(meeting) {
  if (meeting.status === 'closed') return { key: 'closed', label: 'Zamknięte', description: 'Odprawa została podsumowana i zamknięta.' };
  if (!meeting.published_at) return { key: 'preparing', label: 'W trakcie przygotowania', description: 'Odprawa została utworzona, ale nie została udostępniona.' };
  try {
    const published = JSON.parse(meeting.published_snapshot_json || '{}');
    if (Array.isArray(published.items) && meetingPlanSignature(meeting) !== meetingPlanSignature(published)) return { key: 'modified', label: 'Zmodyfikowana, zmiany nieudostępnione', description: 'Po udostępnieniu zapisano nowszy szkic.' };
    if (Array.isArray(published.items)) return { key: 'published', label: 'Udostępnione', description: 'Aktualna wersja odprawy jest widoczna w Informatorze.' };
  } catch {}
  if (String(meeting.updated_at || '') > String(meeting.published_at || '')) return { key: 'modified', label: 'Zmodyfikowana, zmiany nieudostępnione', description: 'Po udostępnieniu zapisano nowszy szkic.' };
  return { key: 'published', label: 'Udostępnione', description: 'Aktualna wersja odprawy jest widoczna w Informatorze.' };
}
function meetingLifecycleBadge(meeting) { const lifecycle = meetingLifecycle(meeting); return `<span class="meeting-lifecycle ${lifecycle.key}" title="${escapeHtml(lifecycle.description)}">${escapeHtml(lifecycle.label)}</span>`; }
function meetingGroupKey(item) { const name = String(item.group_name || '').trim(); return String(item.group_key || (name ? `legacy:${name}` : '')).trim(); }
function meetingItemGroups(items = []) {
  const result = []; const named = new Map();
  items.forEach(item => {
    const name = String(item.group_name || '').trim();
    const key = meetingGroupKey(item);
    if (!key) { result.push({ key: '', name: '', items: [item] }); return; }
    if (!named.has(key)) { const group = { key, name, items: [] }; named.set(key, group); result.push(group); }
    named.get(key).items.push(item);
  });
  return result;
}

function meetingPlanTableHtml(meeting) {
  const rows = meeting.items || [];
  const groups = meetingItemGroups(rows);
  const bodies = groups.map((group, groupIndex) => `<tbody class="meeting-public-group ${group.key ? 'grouped' : 'single'}" data-public-meeting-group="${escapeHtml(group.key)}">${group.items.map((item, itemIndex) => `<tr>${itemIndex === 0 ? `<td class="meeting-group-order" rowspan="${group.items.length}"><b>${groupIndex + 1}</b></td>` : ''}<td>${meetingPriorityBadge(item.meeting_priority)}</td><td>${escapeHtml(operationTypeNames[item.entity_type] || item.entity_type)}</td><td><button type="button" class="meeting-plan-link" data-meeting-plan-jump="${item.entity_type}:${item.entity_id}"><b>${escapeHtml(item.entity?.title || 'Element niedostępny')}</b><small>${escapeHtml(item.decision || 'Brak dodatkowego opisu działania')}</small></button></td><td>${escapeHtml(item.entity?.scope_label || 'Cały projekt')}</td><td>${escapeHtml(item.objective || 'Kontynuacja')}</td><td>${escapeHtml((item.assignee_names || []).join(', ') || 'Nieprzypisane')}</td><td>${displayDate(item.due_date || item.entity?.due_date)}</td><td>${badge(item.baseline?.status || 'Nie określono')}</td><td>${badge(item.entity?.status || 'Nie określono')}</td></tr>`).join('')}</tbody>`).join('');
  return `<div class="tablewrap meeting-public-plan"><table><thead><tr><th>Lp.</th><th>Priorytet</th><th>Typ</th><th>Zadanie / temat</th><th>Obszar</th><th>Cel</th><th>Odpowiedzialni</th><th>Deadline</th><th>Stan początkowy</th><th>Aktualny stan</th></tr></thead>${bodies || '<tbody><tr><td colspan="10" class="empty">Plan nie zawiera jeszcze elementów.</td></tr></tbody>'}</table></div>`;
}

function openMeetingPlanDetails(meeting) {
  if (!meeting) return;
  $('#insight-title').textContent = `Plan i priorytety · ${meeting.title}`;
  $('#insight-description').textContent = `${displayDate(meeting.period_from)}–${displayDate(meeting.period_to)} · ${meeting.status === 'closed' ? 'odprawa podsumowana' : 'plan aktywny'}`;
  const reviews = (meeting.items || []).map(item => `<article class="meeting-public-review"><header><span class="type-dot ${item.entity_type}"></span><span><b>${escapeHtml(item.entity?.title || 'Element niedostępny')}</b><small>${escapeHtml(item.entity?.scope_label || 'Cały projekt')} · cel: ${escapeHtml(item.objective || 'Kontynuacja')}</small></span>${badge(item.item_status === 'decided' ? 'Closed' : item.item_status === 'deferred' ? 'Waiting' : 'Open')}</header><div><span><small>Stan przy utworzeniu odprawy</small><b>${escapeHtml(badgeText(item.baseline?.status || '—'))}</b></span><span><small>Aktualny stan</small><b>${escapeHtml(badgeText(item.entity?.status || '—'))}</b></span><span><small>Status zmienił / zamknął</small><b>${escapeHtml(item.status_changed_by_name || item.status_events?.[0]?.user_name || 'Nie wykryto')}</b></span><span><small>Faktycznie pracowali</small><b>${escapeHtml((item.worker_names || []).join(', ') || 'Nie wskazano')}</b></span><span><small>Nowe komentarze</small><b>${(item.comments || []).length}</b></span></div>${item.outcome_comment ? `<p>${escapeHtml(item.outcome_comment)}</p>` : ''}</article>`).join('');
  $('#insight-content').innerHTML = `<article class="announcement-detail meeting-plan-detail"><p>${escapeHtml(meeting.summary || 'Brak opisu planu.').replace(/\n/g, '<br>')}</p><div class="meeting-public-meta"><span>${meeting.published_at ? `Opublikowano ${displayDateTime(meeting.published_at)}` : 'Plan roboczy'}</span><span>Autor: ${escapeHtml(meeting.created_by_name || 'System')}</span></div>${meetingPlanTableHtml(meeting)}${meeting.status === 'closed' ? `<section class="meeting-public-summary"><h3>Podsumowanie realizacji</h3>${reviews || '<div class="empty">Brak elementów do podsumowania.</div>'}</section>` : ''}</article>`;
  $$('[data-meeting-plan-jump]').forEach(button => button.addEventListener('click', () => { const [type, id] = button.dataset.meetingPlanJump.split(':'); openEntityOverlay(type, Number(id)); }));
  $('#insight-dialog').classList.add('kpi-expanded'); if (!$('#insight-dialog').open) $('#insight-dialog').showModal();
}

function announcementEntryDate(item, meeting = false) { return String(meeting ? item.period_from || item.published_at : item.effective_date || item.created_at || '').slice(0, 10); }
function announcementDateMatches(item, meeting = false) {
  const date = announcementEntryDate(item, meeting); if (!date) return false;
  const inRange = date >= state.announcementFrom && date <= state.announcementTo;
  return inRange && (!state.announcementWeek || isoWeek(date).key === state.announcementWeek);
}

function messageCenterActions(scope = state.messageActionScope) {
  if (scope === 'team' && canCoordinate() && state.operations?._loaded?.triage) return (state.operations.triage || []).map(item => ({
    type: item.entity_type, item: { ...item, id: item.entity_id }, signals: item.signals || []
  }));
  const mine = state.mine || {};
  const warningDays = Number(state.config.settings.reminder_warning_days || 7);
  const signalsFor = (item, reminder = false) => {
    const date = reminder ? item.reminder_date || item.due_date : item.due_date;
    const days = date ? dayDifference(date) : null;
    return [
      ['Blocked', 'NOK / Retest required'].includes(item.status) ? 'blocked' : '',
      days !== null && days < 0 ? 'overdue' : '',
      days !== null && days >= 0 && days <= warningDays ? (reminder ? 'reminder_due' : 'due_soon') : ''
    ].filter(Boolean);
  };
  const rows = [
    ...(mine.assigned_tasks || []).filter(item => item.status !== 'Done').map(item => ({ type: 'task', item, signals: signalsFor(item) })).filter(row => row.signals.length),
    ...(mine.points || []).filter(item => item.status !== 'Closed').map(item => ({ type: 'point', item, signals: signalsFor(item, true) })).filter(row => row.signals.length),
    ...(mine.statuses || []).filter(item => ['Blocked', 'NOK / Retest required'].includes(item.status)).map(item => ({ type: 'status', item, signals: ['blocked'] }))
  ];
  const score = row => (row.signals.includes('blocked') ? 100 : 0) + (row.signals.includes('overdue') ? 70 : 0) + (row.signals.includes('reminder_due') ? 40 : 0) + (row.signals.includes('due_soon') ? 20 : 0);
  return [...new Map(rows.map(row => [`${row.type}:${row.item.project_id || ''}:${row.item.id}`, row])).values()].sort((first, second) => score(second) - score(first));
}

async function markAllNotificationsAsRead() {
  try {
    const result = await api('/api/notifications/read-all', { method: 'POST' });
    state.notifications = result.notifications || [];
    rememberDataCache('notifications', state.notifications);
    updateNotificationUi(); render();
    toast(result.updated ? `Oznaczono ${result.updated} powiadomień jako przeczytane` : 'Nie ma nowych powiadomień');
  } catch (error) { toast(error.message, true); }
}

async function snoozeMessage(kind, id) {
  const result = await uiForm({ title: 'Przypomnij później', description: 'Element zniknie z bieżącej kolejki i wróci automatycznie po wybranym czasie.', submitLabel: 'Odłóż', fields: [{ name: 'delay', label: 'Przypomnij', type: 'select', value: '4', options: [{ value: '1', label: 'Za godzinę' }, { value: '4', label: 'Za 4 godziny' }, { value: '24', label: 'Jutro' }, { value: '72', label: 'Za 3 dni' }] }] });
  if (!result) return;
  const until = new Date(Date.now() + Number(result.delay) * 3600000).toISOString();
  try {
    if (kind === 'announcement') {
      const updated = await api(`/api/announcements/${id}/snooze`, { method: 'POST', body: JSON.stringify({ until }) });
      const index = state.announcements.findIndex(item => Number(item.id) === Number(id)); if (index >= 0) state.announcements[index] = updated;
      state.notifications.filter(item => item.entity_type === 'announcement' && Number(item.entity_id) === Number(id) && !item.read_at).forEach(item => { item.snoozed_until = updated.snoozed_until; });
    } else {
      const updated = await api(`/api/notifications/${id}/snooze`, { method: 'POST', body: JSON.stringify({ until }) });
      const item = state.notifications.find(row => Number(row.id) === Number(id)); if (item) Object.assign(item, updated);
    }
    updateNotificationUi(); render(); toast('Przypomnienie zostało odłożone');
  } catch (error) { toast(error.message, true); }
}

async function saveDigestPreference(enabled) {
  try {
    state.communicationPreferences = await api('/api/communication-preferences', { method: 'PUT', body: JSON.stringify({ digest_enabled: enabled ? 1 : 0 }) });
    render(); toast(enabled ? 'Włączono jeden dzienny digest' : 'Wyłączono dzienny digest');
  } catch (error) { toast(error.message, true); }
}

function renderMessageCenter() {
  $('#add').hidden = true;
  const actions = messageCenterActions();
  const pendingAll = informationAnnouncements().filter(item => item.requires_ack && !item.accepted_by_me);
  const pending = pendingAll.filter(item => !futureSnooze(item.snoozed_until));
  const pendingAllIds = new Set(pendingAll.map(item => Number(item.id)));
  const pendingIds = new Set(pending.map(item => Number(item.id)));
  const unread = (state.notifications || []).filter(item => !item.read_at && !futureSnooze(item.snoozed_until) && !(item.entity_type === 'announcement' && pendingIds.has(Number(item.entity_id))));
  const snoozedAnnouncements = pendingAll.filter(item => futureSnooze(item.snoozed_until));
  const snoozedNotifications = (state.notifications || []).filter(item => !item.read_at && futureSnooze(item.snoozed_until) && !(item.entity_type === 'announcement' && pendingAllIds.has(Number(item.entity_id))));
  const activity = (state.notifications || []).filter(item => item.read_at).slice(0, 30);
  const notificationRows = (rows, isSnoozed = false) => rows.map(item => `<article class="message-center-row ${item.read_at ? 'read' : 'unread'} ${isSnoozed ? 'snoozed' : ''}"><button type="button" data-message-notification="${item.id}"><span class="type-dot ${['announcement', 'meeting'].includes(item.entity_type) ? 'goal' : item.entity_type}"></span><span><b>${escapeHtml(item.title)}${Number(item.event_count || 1) > 1 ? ` <em class="notification-group-count">${item.event_count} zmian</em>` : ''}</b><small>${escapeHtml(item.message || '')} · ${displayDateTime(item.updated_at || item.created_at)}${isSnoozed ? ` · wróci ${displayDateTime(item.snoozed_until)}` : ''}</small></span></button>${item.read_at ? '' : `<button type="button" class="mini" data-message-snooze="${item.id}">Przypomnij później</button><button type="button" class="mini" data-message-read="${item.id}">Przeczytane</button>`}</article>`).join('');
  $('#content').innerHTML = `<section class="message-center-summary"><article><b>${actions.length}</b><span>Do działania</span><small>terminy, blokady i ryzyka</small></article><article><b>${pending.length + unread.length}</b><span>Do przeczytania</span><small>wiadomości wymagające uwagi</small></article><article><b>${activity.length}</b><span>Ostatnia aktywność</span><small>przeczytane powiadomienia</small></article><article class="digest-preference"><label><input type="checkbox" id="digest-enabled" ${Number(state.communicationPreferences?.digest_enabled) ? 'checked' : ''}><span><b>Jeden dzienny digest</b><small>Opcjonalne podsumowanie dostępne tutaj, bez automatycznego popupu.</small></span></label>${Number(state.communicationPreferences?.digest_enabled) ? '<button type="button" class="mini" id="digest-open">Pokaż dzisiejszy digest</button>' : ''}</article></section>
    <section class="message-center-grid"><article class="panel message-center-section"><header><div><h2>Do działania</h2><p>Jedna kolejka zamiast osobnych kolejek w Statusie, Zadaniach i Otwartych punktach.</p></div><div class="message-center-actions">${canCoordinate() ? `<button type="button" class="mini ${state.messageActionScope === 'mine' ? 'active-toggle' : ''}" data-message-scope="mine">Moje</button><button type="button" class="mini ${state.messageActionScope === 'team' ? 'active-toggle' : ''}" data-message-scope="team">Zespół</button>` : ''}<b>${actions.length}</b></div></header><div class="operation-list">${actions.map(({ type, item, signals }) => `<button type="button" class="operation-row" data-jump="${type}" data-id="${item.id}" data-project-id="${item.project_id || ''}"><span class="type-dot ${type}"></span><span class="operation-primary"><b>${escapeHtml(item.title || item.function_detail || 'Element projektu')}</b><small>${escapeHtml(item.scope_label || item.controller_label || item.controller || 'Cały projekt')} · ${escapeHtml(item.owner_name || item.responsible_name || 'Nieprzypisane')}</small></span><span class="operation-signals">${signals.map(signal => `<em class="signal ${signal}">${escapeHtml(triageSignalNames[signal] || signal)}</em>`).join('')}</span><span class="operation-date">${badge(item.priority || item.criticality || item.status)}<small>${item.due_date ? displayDate(item.due_date) : item.reminder_date ? displayDate(item.reminder_date) : 'Bez terminu'}</small></span></button>`).join('') || '<div class="empty">Brak elementów wymagających działania.</div>'}</div></article>
    <article class="panel message-center-section"><header><div><h2>Do przeczytania</h2><p>Potwierdzenie jest wymagane tylko od wskazanych odbiorców i przy wiadomościach krytycznych.</p></div><div class="message-center-actions">${unread.length ? '<button type="button" class="mini" id="message-read-all">Oznacz wszystkie jako przeczytane</button>' : ''}<b>${pending.length + unread.length}</b></div></header><div>${pending.map(item => `<article class="message-center-announcement"><button type="button" data-message-announcement="${item.id}"><span>◆</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.created_by_name || 'System')} · wymaga potwierdzenia odczytu</small></span></button><button type="button" class="mini" data-announcement-snooze="${item.id}">Przypomnij później</button></article>`).join('')}${notificationRows(unread) || (!pending.length ? '<div class="empty">Wszystko przeczytane.</div>' : '')}</div></article>
    ${snoozedAnnouncements.length || snoozedNotifications.length ? `<article class="panel message-center-section snoozed-section"><header><div><h2>Odłożone</h2><p>Wrócą automatycznie do kolejki w wybranym terminie.</p></div><b>${snoozedAnnouncements.length + snoozedNotifications.length}</b></header><div>${snoozedAnnouncements.map(item => `<button type="button" class="message-center-announcement snoozed" data-message-announcement="${item.id}"><span>◷</span><span><b>${escapeHtml(item.title)}</b><small>wróci ${displayDateTime(item.snoozed_until)}</small></span></button>`).join('')}${notificationRows(snoozedNotifications, true)}</div></article>` : ''}
    <article class="panel message-center-section activity"><header><div><h2>Aktywność</h2><p>Ostatnie przeczytane powiadomienia.</p></div></header><div>${notificationRows(activity) || '<div class="empty">Brak aktywności.</div>'}</div></article></section>`;
  bindJumpItems();
  $$('[data-message-notification]').forEach(button => button.addEventListener('click', () => openNotification(state.notifications.find(item => item.id === Number(button.dataset.messageNotification)))));
  $$('[data-message-read]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); markNotificationAsRead(Number(button.dataset.messageRead)); }));
  $$('[data-message-snooze]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); snoozeMessage('notification', Number(button.dataset.messageSnooze)); }));
  $$('[data-announcement-snooze]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); snoozeMessage('announcement', Number(button.dataset.announcementSnooze)); }));
  $$('[data-message-announcement]').forEach(button => button.addEventListener('click', () => openAnnouncementDetails(state.announcements.find(item => item.id === Number(button.dataset.messageAnnouncement)))));
  $$('[data-message-scope]').forEach(button => button.addEventListener('click', () => { state.messageActionScope = button.dataset.messageScope; render(); }));
  $('#message-read-all')?.addEventListener('click', markAllNotificationsAsRead);
  $('#digest-enabled')?.addEventListener('change', event => saveDigestPreference(event.target.checked));
  $('#digest-open')?.addEventListener('click', openDailySummary);
}

function renderAnnouncements() {
  $('#add').hidden = !canManageAnnouncements();
  const news = informationAnnouncements();
  const pendingCount = news.filter(item => item.requires_ack && !item.accepted_by_me).length;
  const dates = [...news.map(item => announcementEntryDate(item)), ...state.meetingSummaries.map(item => announcementEntryDate(item, true))].filter(Boolean);
  const weeks = [...new Map(dates.map(date => { const week = isoWeek(date); return [week.key, week]; })).values()].sort((first, second) => second.key.localeCompare(first.key));
  const tabs = '';
  const rangeControls = `<label>Numer tygodnia <select id="announcement-week">${selectOptions(weeks.map(week => ({ value: week.key, label: week.label })), state.announcementWeek, 'Wszystkie CW')}</select></label><label>Od <input type="date" id="announcement-from" value="${state.announcementFrom}"></label><label>Do <input type="date" id="announcement-to" value="${state.announcementTo}"></label><button type="button" class="secondary" id="announcement-range-apply">Pokaż zakres</button>`;
  const legend = `<div class="announcement-state-legend" aria-label="Legenda oznaczeń"><b>Legenda</b><span class="own">Utworzone przeze mnie</span><span class="meeting">Plan odprawy</span><span class="accepted">Odczytane</span><span class="awaiting-ack">Czeka na potwierdzenie</span></div>`;
  const bindCommonControls = () => {
    $('#announcement-week').addEventListener('change', event => { state.announcementWeek = event.target.value; render(); });
    $('#announcement-range-apply').addEventListener('click', () => { const from = $('#announcement-from').value; const to = $('#announcement-to').value; if (!from || !to || to < from) return toast('Wybierz poprawny zakres dat Informatora.', true); state.announcementFrom = from; state.announcementTo = to; state.announcementWeek = ''; render(); });
  };
  if (state.announcementTab === 'inbox') { renderMessageCenter(); return; }
  if (state.announcementTab === 'meetings') {
    const meetings = state.meetingSummaries.filter(item => announcementDateMatches(item, true));
    $('#content').innerHTML = `${tabs}<section class="panel announcement-range-filters"><div class="toolbar"><strong>Widoczność opublikowanych planów</strong>${rangeControls}</div></section>${legend}<section class="announcements-feed meeting-summary-feed">${meetings.map(item => { const priorities = [...new Set((item.items || []).map(row => meetingPriorityValue(row.meeting_priority)))].sort((a, b) => a - b); const date = announcementEntryDate(item, true); const publishedBadge = meetingLifecycleBadge({ status: item.status === 'closed' ? 'closed' : 'open', published_at: item.published_at || 'published', updated_at: item.published_at || 'published' }); return `<article class="announcement-card meeting-summary-card meeting-origin ${Number(item.created_by) === Number(state.me.id) ? 'own' : ''}" data-meeting-summary="${item.id}"><header><span><b>${escapeHtml(item.title)}</b><small>${displayDate(item.period_from)}–${displayDate(item.period_to)} · ${escapeHtml(item.created_by_name || 'System')} · ${escapeHtml(isoWeek(date).label)}</small></span>${publishedBadge}</header><p>${escapeHtml(item.summary || 'Brak opisu planu.')}</p><div class="meeting-card-priorities">${priorities.map(priority => `<span>${meetingPriorityBadge(priority)} <b>${(item.items || []).filter(row => meetingPriorityValue(row.meeting_priority) === priority).length}</b></span>`).join('')}</div><footer><span>${item.item_count} elementów · opublikowany</span><span>${item.closed_count} zamkniętych · ${item.open_count} otwartych · ${item.deferred_count} odłożonych</span></footer></article>`; }).join('') || '<div class="empty">Brak opublikowanych planów w wybranym zakresie.</div>'}</section>`;
    bindCommonControls();
    $$('[data-meeting-summary]').forEach(card => card.addEventListener('click', () => openMeetingPlanDetails(state.meetingSummaries.find(row => Number(row.id) === Number(card.dataset.meetingSummary)))));
    return;
  }
  const importanceOptions = options('announcement_importance');
  const filtered = news.filter(item => {
    const pending = item.requires_ack && !item.accepted_by_me;
    return pending || (announcementDateMatches(item) && (!state.announcementLabelFilter || (item.label_ids || []).includes(Number(state.announcementLabelFilter))) && (!state.announcementImportanceFilter || item.importance === state.announcementImportanceFilter));
  });
  $('#content').innerHTML = `${tabs}<section class="panel announcement-filters announcement-range-filters"><div class="toolbar"><strong>Widoczność wpisów · Wszystkie wiadomości</strong>${rangeControls}<label>Etykieta <select id="announcement-label-filter">${selectOptions((state.config.announcement_labels || []).map(item => ({ value: item.id, label: item.name })), state.announcementLabelFilter, 'Wszystkie')}</select></label><label>Ważność <select id="announcement-importance-filter">${selectOptions(importanceOptions, state.announcementImportanceFilter, 'Wszystkie')}</select></label><button class="mini" id="announcement-clear-filters">Wyczyść filtry wiadomości</button></div></section>${legend}<section class="announcements-feed">${filtered.map(item => {
    const href = safeExternalLink(item.info_link);
    const entryLabel = ({ message: 'Komunikat', decision: 'Decyzja', scope_change: 'Zmiana zakresu' })[item.entry_type] || 'Komunikat';
    const date = announcementEntryDate(item);
    return `<article class="announcement-card ${item.accepted_by_me ? 'read' : 'unread'} ${announcementStateClasses(item)}" data-announcement-id="${item.id}"><header><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.created_by_name || 'System')} · ${displayDateTime(item.created_at)} · ${escapeHtml(isoWeek(date).label)}</small></span>${item.requires_ack && !item.accepted_by_me ? '<span class="ack-alert">Wymaga potwierdzenia odczytu</span>' : `<span class="badge blue">${escapeHtml(announcementAudience(item))}</span>`}</header><div class="announcement-tags"><span class="decision-type ${escapeHtml(item.entry_type || 'message')}">${entryLabel}</span><span class="importance importance-${escapeHtml(String(item.importance || 'normalna').toLowerCase())}">${escapeHtml(item.importance || 'Normalna')}</span>${(item.labels || []).map(label => `<span class="announcement-label ${escapeHtml(label.color)}">${escapeHtml(label.name)}</span>`).join('')}</div><p>${escapeHtml(item.content)}</p><footer><span>${(item.recipient_names || []).length ? `Osoby: ${escapeHtml(item.recipient_names.join(', '))}` : 'Wiadomość ogólna'}</span><span>${Number(item.created_by) === Number(state.me.id) ? 'utworzone przez Ciebie' : item.requires_ack ? (item.accepted_by_me ? '✓ przeczytane' : 'wymaga potwierdzenia') : 'informacyjna'}${canManageAnnouncements() ? ` · ${item.accepted_count || 0}/${item.audience_count || 0} potwierdzeń` : ''}</span></footer></article>`;
  }).join('') || '<div class="empty">Informator nie zawiera jeszcze wiadomości.</div>'}</section>`;
  $('#announcement-label-filter').addEventListener('change', event => { state.announcementLabelFilter = event.target.value; render(); });
  $('#announcement-importance-filter').addEventListener('change', event => { state.announcementImportanceFilter = event.target.value; render(); });
  $('#announcement-clear-filters').addEventListener('click', () => { state.announcementLabelFilter = ''; state.announcementImportanceFilter = ''; render(); });
  bindCommonControls();
  $$('.announcement-card').forEach(card => card.addEventListener('click', event => {
    if (event.target.closest('a,button')) return;
    const item = state.announcements.find(value => value.id === Number(card.dataset.announcementId));
    openAnnouncementDetails(item);
  }));
}

function metricCard(title, metric, completeKey, details) {
  return `<article class="metric-card"><header><span>${title}</span><span>${metric.progress}%</span></header><strong>${metric[completeKey] || 0} / ${metric.total || 0}</strong><div class="progress"><i style="width:${metric.progress}%"></i></div><div class="metric-row">${details.map(([key, label]) => `<div><b>${metric[key] || 0}</b><small>${label}</small></div>`).join('')}</div></article>`;
}

function renderOverview() {
  queueMicrotask(decorateUnifiedWorkspace);
  const data = state.overview;
  const scopeLabel = hierarchyTargetLabel(state.controller);
  const score = combinedMetric(data.overall);
  const trends = data.trends?.[state.trendPeriod] || [];
  const modules = [
    ['status', 'Status uruchomienia', data.overall.status || {}, 'done', 'blocked'],
    ['tasks', 'Zadania zespołu', data.overall.tasks || {}, 'done', 'overdue'],
    ['points', 'Otwarte punkty', data.overall.points || {}, 'closed', 'reminders_overdue'],
    ['goals', 'Kamienie milowe', data.overall.goals || {}, 'done', 'overdue']
  ];
  const hierarchyRows = data.hierarchy_trends || [];
  const currentScope = data.scope || state.controller || 'all';
  const attention = (data.overall.status.blocked || 0) + (data.overall.tasks.overdue || 0) + (data.overall.points.reminders_overdue || 0) + (data.overall.goals?.overdue || 0);
  $('#content').innerHTML = `<section class="overview-command"><div><span class="eyebrow">${escapeHtml(scopeLabel)}</span><h2>${escapeHtml(state.me.current_project.code)}</h2><p>Aktualny obraz wykonania · ${data.controllers.length} sterowników</p></div><div class="score-ring" style="--score:${score}"><strong>${score}%</strong><small>realizacji</small></div><div class="attention-strip" data-insight="attention"><strong>${attention}</strong><span>elementów wymaga uwagi</span><b>Otwórz listę →</b></div></section>
  <section class="compact-kpis">${modules.map(([key, title, metric, doneKey, riskKey]) => `<button class="compact-kpi" data-insight="${key}"><span><b>${escapeHtml(title)}</b><small>${metric[doneKey] || 0}/${metric.total || 0} zakończonych</small></span><strong>${metric.progress || 0}%</strong><i class="progress"><u style="width:${metric.progress || 0}%"></u></i><em class="${metric[riskKey] ? 'risk' : ''}">${metric[riskKey] || 0} ${key === 'status' ? 'blokad' : key === 'points' ? 'alarmów' : 'po terminie'}</em></button>`).join('')}</section>
  <section class="area-radar panel"><div class="section-title"><div><strong>Realizacja według hierarchii</strong><small>Każdy wiersz pokazuje wykonanie Statusu, Zadań, Otwartych punktów i Kamieni milowych.</small></div><label class="overview-level">Zakres hierarchii <select id="overview-hierarchy-level"><option value="areas">Tylko obszary</option><option value="subareas">Obszary + podobszary</option><option value="controllers">Cała hierarchia</option></select></label></div><div class="overview-hierarchy-tree">${overviewHierarchyTree(hierarchyRows, currentScope)}</div></section>
  <section class="trend-panel"><div class="trend-head"><div><strong>Trend KPI · procent realizacji i wielkość zakresu</strong><small>Globalny wynik całego zakresu lub porównanie modułów w tym samym okresie.</small></div><div><select id="global-trend-mode"><option value="combined">Łączne KPI</option><option value="split">Z podziałem</option></select><button class="mini" id="detailed-kpi-open">Szczegółowe KPI</button><button class="mini" id="kpi-config">Parametry</button><button class="mini trend-period" data-period="day">Dni</button><button class="mini trend-period" data-period="week">Tygodnie</button><button class="mini trend-period" data-period="month">Miesiące</button></div></div><div class="horizontal-trends">${state.globalTrendMode === 'combined' ? trendRow('combined', scopeLabel, trends) : modules.filter(([key]) => state.kpiModules.includes(key)).map(([key, title]) => trendRow(key, title, trends)).join('')}</div></section>
  ${state.overviewHierarchyLevel === 'controllers' ? renderStatusBreakdown(data.status_breakdown || []) : ''}`;
  $$('.trend-period').forEach(button => { button.classList.toggle('active-toggle', button.dataset.period === state.trendPeriod); button.addEventListener('click', () => { state.trendPeriod = button.dataset.period; renderOverview(); }); });
  $$('[data-insight]').forEach(button => button.addEventListener('click', () => openOverviewInsight(button.dataset.insight)));
  $$('[data-area-detail]').forEach(button => button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); openAreaPerformanceDetails(button.dataset.areaDetail); }));
  $('#kpi-config').addEventListener('click', openKpiConfig);
  $('#detailed-kpi-open').addEventListener('click', openDetailedKpi);
  $('#overview-hierarchy-level').value = state.overviewHierarchyLevel;
  $('#overview-hierarchy-level').addEventListener('change', event => { state.overviewHierarchyLevel = event.target.value; renderOverview(); });
  $('#global-trend-mode').value = state.globalTrendMode;
  $('#global-trend-mode').addEventListener('change', event => { state.globalTrendMode = event.target.value; renderOverview(); });
}

function trendMetric(item, key) { const value = item?.[key]; return typeof value === 'number' ? { progress: value, total: 0, done: 0 } : value || { progress: 0, total: 0, done: 0 }; }
function combinedTrendMetric(point) { const values = ['status', 'tasks', 'points', 'goals'].map(key => trendMetric(point, key)); const total = values.reduce((sum, item) => sum + item.total, 0); const done = values.reduce((sum, item) => sum + item.done, 0); return { progress: total ? Math.round(done * 100 / total) : 0, total, done }; }
function combinedMetric(metrics) { const total = ['status', 'tasks', 'points', 'goals'].reduce((sum, key) => sum + Number(metrics?.[key]?.total || 0), 0); const done = Number(metrics?.status?.done || 0) + Number(metrics?.tasks?.done || 0) + Number(metrics?.points?.closed || 0) + Number(metrics?.goals?.done || 0); return total ? Math.round(done * 100 / total) : 0; }

function metricCounts(metrics) {
  const total = ['status', 'tasks', 'points', 'goals'].reduce((sum, key) => sum + Number(metrics?.[key]?.total || 0), 0);
  const closed = Number(metrics?.status?.done || 0) + Number(metrics?.tasks?.done || 0) + Number(metrics?.points?.closed || 0) + Number(metrics?.goals?.done || 0);
  return { total, closed, open: Math.max(0, total - closed) };
}

function overviewAreaRow(item) {
  const counts = metricCounts(item.metrics); const scope = item.scope || item.code;
  const label = item.label || item.display_name || item.leaf_code;
  return `<button class="area-performance-row" data-area-detail="${escapeHtml(scope)}" aria-label="Otwórz szczegółową realizację dla ${escapeHtml(label)}"><span><b>${item.type === 'group' ? '▰ ' : '◇ '}${escapeHtml(label)}</b><small>${escapeHtml(item.path_label || item.hierarchy_label || item.group_path_label || '')}</small><em>Otwórz szczegóły →</em></span><strong>${combinedMetric(item.metrics)}%</strong><b>${counts.total}</b><b class="open-count">${counts.open}</b><b class="closed-count">${counts.closed}</b>${['status', 'tasks', 'points', 'goals'].map(key => `<span><b>${item.metrics[key]?.progress || 0}%</b><i><u style="width:${item.metrics[key]?.progress || 0}%"></u></i></span>`).join('')}</button>`;
}

function areaModuleCards(metrics = {}) {
  const names = { status: 'Status', tasks: 'Zadania', points: 'Otwarte punkty', goals: 'Kamienie milowe' };
  const doneKey = { status: 'done', tasks: 'done', points: 'closed', goals: 'done' };
  return ['status', 'tasks', 'points', 'goals'].map(key => {
    const metric = metrics[key] || {}; const done = Number(metric[doneKey[key]] || 0); const total = Number(metric.total || 0);
    const open = Number(metric.open ?? Math.max(0, total - done));
    const blockers = Number(metric.blocked || (key === 'tasks' ? metric.overdue : key === 'points' ? (metric.reminders_overdue || metric.waiting) : key === 'goals' ? metric.overdue : 0) || 0);
    return `<article class="area-module-detail ${key}"><header><span><b>${names[key]}</b><small>${done}/${total} wykonanych</small></span><strong>${Number(metric.progress || 0)}%</strong></header><div class="progress"><i style="width:${Number(metric.progress || 0)}%"></i></div><footer><span><b>${total}</b> wszystkich</span><span><b>${open}</b> otwartych</span><span><b>${done}</b> zamkniętych</span><span class="${blockers ? 'danger-text' : ''}"><b>${blockers}</b> blokad</span></footer></article>`;
  }).join('');
}

function overviewAreaBlock(item) {
  const scope = item.scope || item.code; const label = item.label || item.display_name || item.leaf_code;
  const counts = metricCounts(item.metrics);
  return `<article class="overview-area-block"><button type="button" class="overview-area-title" data-area-detail="${escapeHtml(scope)}"><span><b>${item.type === 'group' ? '▰' : '◇'} ${escapeHtml(label)}</b><small>${escapeHtml(item.path_label || item.hierarchy_label || '')}</small></span><strong>${combinedMetric(item.metrics)}%</strong><em>${counts.closed}/${counts.total} zamkniętych · szczegóły →</em></button><div class="area-detail-grid inline">${areaModuleCards(item.metrics)}</div></article>`;
}

function overviewHierarchyTree(rows, currentScope = 'all') {
  const children = new Map();
  rows.forEach(item => {
    const parent = item.parent_scope || 'all';
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(item);
  });
  const maxDepth = state.overviewHierarchyLevel === 'controllers' ? Infinity : state.overviewHierarchyLevel === 'subareas' ? 1 : 0;
  const renderBranch = (item, depth) => {
    const nested = depth < maxDepth ? (children.get(item.scope) || []).filter(child => state.overviewHierarchyLevel === 'controllers' || child.type === 'group') : [];
    const counts = metricCounts(item.metrics);
    const label = item.label || item.display_name || item.leaf_code || item.scope;
    const modules = [['status', 'S', 'done'], ['tasks', 'Z', 'done'], ['points', 'P', 'closed'], ['goals', 'C', 'done']]
      .map(([key, short, doneKey]) => { const metric = item.metrics?.[key] || {}; return `<span class="overview-tree-metric ${key}" title="${key === 'status' ? 'Status' : key === 'tasks' ? 'Zadania' : key === 'points' ? 'Otwarte punkty' : 'Kamienie milowe'}: ${metric[doneKey] || 0}/${metric.total || 0}"><span><b>${short}</b><em>${metric[doneKey] || 0}/${metric.total || 0}</em></span><i><u style="width:${metric.progress || 0}%"></u></i><small>${metric.progress || 0}%</small></span>`; }).join('');
    const row = `<summary class="overview-tree-row" style="--tree-depth:${depth}"><span class="overview-tree-name"><b>${item.type === 'group' ? '▰' : '◇'} ${escapeHtml(label)}</b><small>${escapeHtml(item.path_label || item.hierarchy_label || '')}</small></span><strong>${combinedMetric(item.metrics)}%</strong><span class="overview-tree-modules">${modules}</span><small class="overview-tree-count">${counts.closed}/${counts.total}</small><button type="button" class="mini" data-area-detail="${escapeHtml(item.scope)}">Szczegóły</button></summary>`;
    if (!nested.length) return `<details class="overview-tree-branch leaf" style="--tree-depth:${depth}">${row}</details>`;
    return `<details class="overview-tree-branch" style="--tree-depth:${depth}" open>${row}<div class="overview-tree-children">${nested.map(child => renderBranch(child, depth + 1)).join('')}</div></details>`;
  };
  const roots = currentScope === 'all'
    ? (children.get('all') || []).filter(item => state.overviewHierarchyLevel === 'controllers' || item.type === 'group')
    : rows.filter(item => item.scope === currentScope);
  return roots.map(item => renderBranch(item, 0)).join('') || '<div class="empty compact-empty">Brak danych dla tego zakresu.</div>';
}

function openAreaPerformanceDetails(scope) {
  const item = (state.overview?.hierarchy_trends || []).find(row => row.scope === scope)
    || (state.overview?.controllers || []).find(row => row.code === scope);
  if (!item) return;
  const metrics = item.metrics || {};
  const rows = areaModuleCards(metrics);
  const ids = scope === 'all' ? new Set(state.controllers.map(row => row.id)) : scope.startsWith('group:') ? hierarchyControllerCodes(scope).size ? new Set(state.controllers.filter(row => hierarchyControllerCodes(scope).has(row.code)).map(row => row.id)) : new Set() : new Set(state.controllers.filter(row => row.code === scope).map(row => row.id));
  const breakdown = (state.overview.status_breakdown || []).filter(row => ids.has(Number(row.controller_id)));
  $('#insight-title').textContent = `Realizacja · ${item.path_label || item.hierarchy_label || item.label || item.display_name || scope}`;
  $('#insight-description').textContent = 'Rozkład wykonania, liczba pozycji oraz blokady w każdym module.';
  $('#insight-content').innerHTML = `<div class="area-detail-grid">${rows}</div>${breakdown.length ? renderStatusBreakdown(breakdown) : ''}<div class="insight-footer"><button class="secondary" id="area-detail-scope">Pokaż ten zakres w Przeglądzie</button></div>`;
  $('#area-detail-scope').addEventListener('click', async () => { $('#insight-dialog').close(); state.controller = scope; $('#controller').value = scope; await loadData(); });
  $('#insight-dialog').classList.add('area-detail-dialog');
  $('#insight-dialog').showModal();
}

function hierarchyTrendRow(item, period = state.detailedKpiPeriod, mode = state.detailedKpiMode) {
  const points = item.trends?.[period] || []; const first = combinedTrendMetric(points[0]); const last = combinedTrendMetric(points.at(-1)); const delta = last.progress - first.progress;
  const split = ['status', 'tasks', 'points', 'goals'].map(key => `<span class="module-trend"><span class="module-trend-head"><small>${({ status: 'Status', tasks: 'Zadania', points: 'Punkty', goals: 'Kamienie milowe' })[key]}</small><b>${item.metrics[key]?.progress || 0}%</b></span><span class="mini-trend labeled">${points.map(point => { const metric = trendMetric(point, key); return `<span class="mini-trend-node" title="${escapeHtml(point.label)} · ${metric.progress}% · ${metric.done}/${metric.total}"><b>${metric.progress}%</b><i><u style="height:${Math.max(4, metric.progress)}%"></u></i><small>${escapeHtml(point.label)}</small></span>`; }).join('')}</span></span>`).join('');
  const counts = metricCounts(item.metrics);
  return `<div class="hierarchy-trend-row ${item.type} ${mode}" style="--depth:${Math.max(0, item.depth - 1)}"><button data-detailed-scope="${escapeHtml(item.scope)}"><span><b>${item.type === 'group' ? '▰' : '◇'} ${escapeHtml(item.label)}</b><small>${escapeHtml(item.path_label)} · ${counts.closed}/${counts.total} zamkniętych</small></span></button>${mode === 'split' ? `<span class="hierarchy-module-split detailed-series">${split}</span>` : `<strong>${combinedMetric(item.metrics)}% <em>${delta >= 0 ? '+' : ''}${delta} pp</em></strong><span class="mini-trend labeled">${points.map(point => { const metric = combinedTrendMetric(point); return `<span class="mini-trend-node" title="${escapeHtml(point.label)} · ${metric.progress}% · ${metric.done}/${metric.total}"><b>${metric.progress}%</b><i><u style="height:${Math.max(4, metric.progress)}%"></u></i><small>${escapeHtml(point.label)}</small></span>`; }).join('')}</span>`}</div>`;
}

function openDetailedKpi() {
  const rows = state.overview?.hierarchy_trends || [];
  const children = scope => rows.filter(item => item.parent_scope === scope);
  const branch = (item, depth = 0) => {
    const nested = item.type === 'group' ? children(item.scope) : [];
    return `<details class="detailed-kpi-branch" ${depth === 0 ? 'open' : ''}><summary>${hierarchyTrendRow(item)}</summary>${nested.length ? `<div>${nested.map(child => branch(child, depth + 1)).join('')}</div>` : ''}</details>`;
  };
  $('#insight-title').textContent = 'Szczegółowe KPI według hierarchii';
  $('#insight-description').textContent = 'Rozwiń obszar, aby przejść od linii przez podobszary do pojedynczych sterowników.';
  $('#insight-content').innerHTML = `<div class="detailed-kpi-toolbar"><span>Hierarchia projektu i trend wykonania</span><button type="button" class="mini" id="detailed-kpi-expand">Rozwiń wszystko</button><button type="button" class="mini" id="detailed-kpi-collapse">Zwiń podobszary</button><select id="detailed-kpi-mode"><option value="combined">Łączne KPI</option><option value="split">Z podziałem na moduły</option></select><select id="detailed-kpi-period"><option value="day">Dni</option><option value="week">Tygodnie</option><option value="month">Miesiące</option></select></div><div class="detailed-kpi-tree">${children('all').map(item => branch(item)).join('') || '<div class="empty">Brak danych KPI.</div>'}</div>`;
  $('#detailed-kpi-mode').value = state.detailedKpiMode;
  $('#detailed-kpi-period').value = state.detailedKpiPeriod;
  $('#detailed-kpi-mode').addEventListener('change', event => { state.detailedKpiMode = event.target.value; openDetailedKpi(); });
  $('#detailed-kpi-period').addEventListener('change', event => { state.detailedKpiPeriod = event.target.value; openDetailedKpi(); });
  $('#detailed-kpi-expand').addEventListener('click', () => $$('.detailed-kpi-branch').forEach(item => { item.open = true; }));
  $('#detailed-kpi-collapse').addEventListener('click', () => $$('.detailed-kpi-branch').forEach(item => { item.open = !item.parentElement.closest('.detailed-kpi-branch'); }));
  $$('[data-detailed-scope]').forEach(button => button.addEventListener('click', async event => { event.preventDefault(); event.stopPropagation(); $('#insight-dialog').close(); state.controller = button.dataset.detailedScope; $('#controller').value = state.controller; await loadData(); }));
  $('#insight-dialog').classList.add('kpi-expanded');
  if (!$('#insight-dialog').open) $('#insight-dialog').showModal();
}

function renderStatusBreakdown(rows) {
  const groups = new Map();
  for (const row of rows) { const key = `${row.controller_id}:${row.category}`; if (!groups.has(key)) groups.set(key, { label: row.controller_label, path: row.controller_path, category: row.category, rows: [] }); groups.get(key).rows.push(row); }
  return `<section class="status-breakdown panel"><div class="section-title"><div><strong>Status · kategorie i podkategorie</strong><small>Szczegółowy obraz gotowości bez technicznych identyfikatorów.</small></div></div>${[...groups.values()].map(group => { const total = group.rows.reduce((sum, row) => sum + row.total, 0); const done = group.rows.reduce((sum, row) => sum + row.done, 0); const progress = total ? Math.round(done * 100 / total) : 0; return `<article><header><span><b>${escapeHtml(group.label)}</b><small>${escapeHtml(group.category)} · ${escapeHtml(group.path)}</small></span><strong>${progress}%</strong></header><div>${group.rows.map(row => `<span><b>${escapeHtml(row.subcategory || 'Bez podkategorii')}</b><i><u style="width:${row.progress}%"></u></i><small>${row.done}/${row.total} · ${row.progress}%</small></span>`).join('')}</div></article>`; }).join('') || '<div class="empty">Brak punktów statusu.</div>'}</section>`;
}

function trendRow(key, title, trends) {
  const colors = { combined: 'violet', status: 'blue', tasks: 'green', points: 'amber', goals: 'violet' };
  return `<div class="trend-line-row ${colors[key]}"><div class="trend-label"><strong>${escapeHtml(title)}</strong><small>% / liczba wszystkich punktów</small></div><div class="trend-timeline">${trends.map(item => { const value = key === 'combined' ? combinedTrendMetric(item) : trendMetric(item, key); return `<div class="trend-node" title="${escapeHtml(item.label)} · ${value.progress}% · ${value.done}/${value.total}"><span>${value.progress}%</span><i style="--total:${Math.min(100, value.total)}%"></i><b>${value.total}</b><small>${escapeHtml(item.label)}</small></div>`; }).join('')}</div></div>`;
}

async function openKpiConfig() {
  const result = await uiForm({ title: 'Parametry trendu KPI', description: 'Wskaż moduły widoczne w widoku „Z podziałem”.', fields: [
    { name: 'status', label: 'Status', type: 'checkbox', value: state.kpiModules.includes('status') }, { name: 'tasks', label: 'Zadania', type: 'checkbox', value: state.kpiModules.includes('tasks') },
    { name: 'points', label: 'Otwarte punkty', type: 'checkbox', value: state.kpiModules.includes('points') }, { name: 'goals', label: 'Kamienie milowe', type: 'checkbox', value: state.kpiModules.includes('goals') }
  ] });
  if (!result) return;
  state.kpiModules = ['status', 'tasks', 'points', 'goals'].filter(key => result[key]);
  if (!state.kpiModules.length) state.kpiModules = ['status'];
  renderOverview();
}

function openOverviewInsight(kind) {
  const definitions = {
    status: ['Status uruchomienia', state.status, 'status'], tasks: ['Zadania zespołu', state.tasks, 'task'], points: ['Otwarte punkty', state.points, 'point'], goals: ['Kamienie milowe', state.goals, 'goal']
  };
  let title; let rows;
  if (kind === 'attention') {
    title = 'Elementy wymagające uwagi';
    rows = [
      ...state.status.filter(item => ['Blocked', 'NOK / Retest required'].includes(item.status)).map(item => ({ type: 'status', item })),
      ...state.tasks.filter(item => item.status !== 'Done' && item.due_date && item.due_date < today()).map(item => ({ type: 'task', item })),
      ...state.points.filter(item => item.status !== 'Closed' && item.reminder_date && item.reminder_date < today()).map(item => ({ type: 'point', item })),
      ...state.goals.filter(item => item.status !== 'Done' && item.due_date && item.due_date < today()).map(item => ({ type: 'goal', item }))
    ];
  } else {
    const [label, collection, type] = definitions[kind]; title = label; rows = collection.map(item => ({ type, item }));
  }
  $('#insight-title').textContent = title;
  $('#insight-description').textContent = `${rows.length} pozycji · kliknij, aby przejść do rekordu`;
  $('#insight-content').innerHTML = rows.slice(0, 250).map(({ type, item }) => {
    const assigned = item.owner_name || item.responsible_name || item.created_by_name || 'Nieprzypisane';
    const date = item.due_date || item.reminder_date || item.start_date || item.checked_on;
    return `<button class="insight-row rich" data-jump="${type}" data-id="${item.id}"><span class="type-dot ${type}"></span><span><b>${escapeHtml(entityLabel(type, item))}</b><small>${escapeHtml(controllerLabel(item) || 'Ogólne')} · ${escapeHtml(item.category || 'Bez kategorii')}</small></span><span><b>${escapeHtml(assigned)}</b><small>${escapeHtml(badgeText(item.status || item.type))} · ${escapeHtml(badgeText(item.priority || item.criticality || 'Medium'))}</small></span><span><b>${date ? displayDate(date) : 'Bez terminu'}</b><small>${item.due_date ? 'deadline' : item.reminder_date ? 'przypomnienie' : item.start_date ? 'start' : ''}</small></span></button>`;
  }).join('') || '<div class="empty">Brak pozycji wymagających uwagi.</div>';
  bindJumpItems();
  $('#insight-dialog').showModal();
}

function openAreaComparison() {
  $('#insight-title').textContent = 'Porównanie trendu KPI obszarów';
  $('#insight-description').textContent = 'Zmiana względem pierwszego widocznego tygodnia oraz aktualny zakres.';
  $('#insight-content').innerHTML = `<div class="area-comparison"><div class="area-comparison-head"><span>Sterownik</span><span>Status</span><span>Zadania</span><span>Punkty</span><span>Alarmy</span></div>${state.overview.controllers.map(item => { const first = item.trends?.[0]; const last = item.trends?.at(-1); const delta = key => trendMetric(last, key).progress - trendMetric(first, key).progress; const m = item.metrics; return `<button data-controller-scope="${escapeHtml(item.code)}"><b>${escapeHtml(item.code)}</b><span>${m.status.progress}% <em>${delta('status') >= 0 ? '+' : ''}${delta('status')} pp</em></span><span>${m.tasks.progress}% <em>${delta('tasks') >= 0 ? '+' : ''}${delta('tasks')} pp</em></span><span>${m.points.progress}% <em>${delta('points') >= 0 ? '+' : ''}${delta('points')} pp</em></span><span>${(m.status.blocked || 0) + (m.tasks.overdue || 0) + (m.points.reminders_overdue || 0)}</span></button>`; }).join('')}</div>`;
  $$('#insight-content [data-controller-scope]').forEach(button => button.addEventListener('click', async () => { $('#insight-dialog').close(); state.controller = button.dataset.controllerScope; await loadData(); }));
  $('#insight-dialog').showModal();
}

function summarySection(title, items, type, label) {
  return `<section class="list-section"><header><strong>${title}</strong><span class="badge blue">${items.length}</span></header><div class="compact-list">${items.length ? items.slice(0, 15).map(item => `<div class="compact-item" data-jump="${type}" data-id="${item.id}" data-project-id="${item.project_id || ''}"><span><strong>${item.project_code ? `<em class="project-prefix">${escapeHtml(item.project_code)}</em>` : ''}${escapeHtml(label(item))}</strong><small>${escapeHtml(controllerLabel(item) || 'Ogólne')} · ${badgeText(item.status || item.type)}</small></span><span>${item.due_date ? displayDate(item.due_date) : ''}</span></div>`).join('') : '<div class="empty">Brak pozycji</div>'}</div></section>`;
}

function badgeText(value) { return (badgeMap[value] || [value || '—'])[0]; }

function renderMine() {
  queueMicrotask(decorateUnifiedWorkspace);
  const data = state.mine;
  const taskProgress = data.metrics.tasks_total ? Math.round(data.metrics.tasks_done * 100 / data.metrics.tasks_total) : 0;
  const pointProgress = data.metrics.points_total ? Math.round(data.metrics.points_closed * 100 / data.metrics.points_total) : 0;
  const statusProgress = data.metrics.status_total ? Math.round(data.metrics.status_done * 100 / data.metrics.status_total) : 0;
  const overdue = [...(data.overdue_tasks || []).map(item => ({ type: 'tasks', item })), ...(data.overdue_points || []).map(item => ({ type: 'points', item }))];
  const upcoming = [
    ...(data.area_upcoming?.tasks || []).map(item => ({ type: 'tasks', item, date: item.start_date || item.due_date })),
    ...(data.area_upcoming?.points || []).map(item => ({ type: 'points', item, date: item.start_date || item.due_date || item.reminder_date })),
    ...(data.area_upcoming?.statuses || []).slice(0, 15).map(item => ({ type: 'status', item, date: item.checked_on }))
  ].sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
  const planDays = dateRange(today(), addDays(today(), 13));
  const plannerByDate = new Map(planDays.map(date => [date, (data.planner || []).filter(entry => entry.plan_date === date)]));
  const projectLabels = (data.projects_in_scope || []).map(project => project.code).join(', ') || state.me.current_project?.code || '';
  $('#content').innerHTML = `<section class="personal-command compact"><div><span class="eyebrow">Plan pracy · ${escapeHtml(state.me.display_name)}</span><h2>${overdue.length ? `${overdue.length} pozycji wymaga reakcji` : 'Plan jest pod kontrolą'}</h2><p>Zakres z Plannera: <b>${escapeHtml(projectLabels)}</b> · ${(data.assigned_areas || []).map(item => `${item.project_code ? `${escapeHtml(item.project_code)} · ` : ''}${escapeHtml(item.path_label || item.name)}`).join(', ') || 'brak przypisania na 14 dni'}</p></div><div class="personal-stats compact"><span><b>${taskProgress}%</b>Zadania</span><span><b>${pointProgress}%</b>Punkty</span><span><b>${statusProgress}%</b>Status</span><span><b>${data.metrics.notes_mentions}</b>Wzmianki</span></div></section>
  <nav class="start-shortcuts" aria-label="Skróty pracy"><button type="button" data-start-view="announcements">Do działania <b>${messageCenterActions('mine').length}</b></button><button type="button" data-start-view="tasks">Otwórz pracę</button><button type="button" data-start-view="planner">Pokaż plan</button></nav>
  ${overdue.length ? `<section class="urgent-lane"><header><strong>Do pilnego działania</strong><span>${overdue.length} zaległych</span></header><div>${overdue.slice(0, 12).map(({ type, item }) => `<button data-jump="${type}" data-id="${item.id}" data-project-id="${item.project_id || ''}"><span>!</span><b>${item.project_code ? `<em class="project-prefix">${escapeHtml(item.project_code)}</em>` : ''}${escapeHtml(entityLabel(typeToEntity(type), item))}</b><small>${displayDate(item.due_date || item.reminder_date)}</small></button>`).join('')}</div></section>` : ''}
  <section class="personal-plan-calendar"><header><div><strong>Mój plan manpoweru</strong><small>Wszystkie projekty · najbliższe 14 dni</small></div><span>${(data.planner || []).length} wpisów</span></header><div class="personal-plan-days">${planDays.map(date => { const entries = plannerDisplayEntries(plannerByDate.get(date) || [], true); return `<article class="personal-plan-day ${date === today() ? 'today' : ''}"><header><b>${date.slice(8, 10)}</b><small>${new Intl.DateTimeFormat('pl-PL', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</small></header><div>${entries.map(entry => { const transport = entry.activity_type === 'transport'; const grouped = entry.merged_entries?.length ? entry.merged_entries : [entry]; const offline = grouped.some(item => item.work_mode === 'offline'); const night = grouped.some(item => item.shift === 'Noc'); return `<span class="mini-plan-chip ${transport ? 'transport' : `project-work ${offline ? 'offline-work' : 'online-work'} ${night ? 'night-shift' : ''}`}" style="${transport ? '' : projectColorStyle(entry.project_color)}" title="${escapeHtml(entry.project_name || entry.project_code || '')}"><b>${transport ? entry.transport_code || 'T' : entry.project_short_code || entry.project_code || 'PRJ'}</b></span>`; }).join('') || '<i>—</i>'}</div></article>`; }).join('')}</div></section>
  <div class="workbench-grid compact"><section class="focus-lane"><header><div><strong>Moje aktywne zadania</strong><small>Bez ukończonych podzadań przypisanych tylko do Ciebie</small></div><span>${data.assigned_tasks.filter(item => item.status !== 'Done').length}</span></header>${data.assigned_tasks.filter(item => item.status !== 'Done').slice(0, 20).map(item => personalTaskRow(item)).join('') || '<div class="empty">Nie masz aktywnych zadań.</div>'}</section>
  <section class="focus-lane"><header><div><strong>Najbliższe z mojego planu</strong><small>Wszystkie zaplanowane projekty · następne 14 dni</small></div><span>${upcoming.length}</span></header>${upcoming.slice(0, 20).map(({ type, item, date }) => `<button class="focus-row" data-jump="${type}" data-id="${item.id}" data-project-id="${item.project_id || ''}"><span class="type-dot ${typeToEntity(type)}"></span><span><b>${item.project_code ? `<em class="project-prefix">${escapeHtml(item.project_code)}</em>` : ''}${escapeHtml(entityLabel(typeToEntity(type), item))}</b><small>${escapeHtml(controllerLabel(item))} · ${escapeHtml(badgeText(item.status))}</small></span><time>${date ? displayDate(date) : '→'}</time></button>`).join('') || '<div class="empty">Brak zbliżających się pozycji.</div>'}</section>
  ${summarySection('Otwarte punkty i wzmianki', data.points.filter(item => item.status !== 'Closed'), 'points', item => item.title)}
  </div>`;
  bindJumpItems();
  $$('[data-start-view]').forEach(button => button.addEventListener('click', () => { if (button.dataset.startView === 'announcements') state.announcementTab = 'inbox'; setView(button.dataset.startView); }));
}

function personalTaskRow(item) {
  const own = item.checklist.filter(entry => entry.owner_user_id === state.me.id);
  const time = taskTimeLabel(item);
  return `<button class="focus-row" data-jump="tasks" data-id="${item.id}" data-project-id="${item.project_id || ''}"><span class="progress-value ${item.progress >= 100 ? 'done' : item.progress > 0 ? 'active' : ''}"><b>${item.progress || 0}%</b><i><u style="width:${item.progress || 0}%"></u></i></span><span><b>${item.project_code ? `<em class="project-prefix">${escapeHtml(item.project_code)}</em>` : ''}${escapeHtml(item.title)}</b><small>${escapeHtml(controllerLabel(item))} · ${escapeHtml(item.owner_name || 'Nieprzypisane')}${own.length ? ` · Twoje podzadania ${own.filter(entry => entry.done).length}/${own.length}` : ''}</small></span><time class="${time?.overdue ? 'danger-text' : ''}">${time ? escapeHtml(time.label) : 'Start w przyszłości'}</time></button>`;
}

const operationTypeNames = { status: 'Status', task: 'Zadanie', point: 'Otwarty punkt', goal: 'Kamień milowy', note: 'Przekazanie statusu' };
const triageSignalNames = { overdue: 'Po terminie', due_soon: 'Termin blisko', reminder_due: 'Przypomnienie', unassigned: 'Bez właściciela', blocked: 'Blokada', dependency: 'Zależność', in_progress: 'Za długo w trakcie' };

function operationJump(type, id) {
  openEntityOverlay(type, id);
}

async function reloadOperations(tab = state.operationsTab) {
  const loadingKey = `${state.controller}:${tab}`;
  if (state.operationsLoading.has(loadingKey)) return;
  state.operationsLoading.add(loadingKey);
  try {
    const payload = await api(`/api/operations?controller=${encodeURIComponent(state.controller)}&tab=${encodeURIComponent(tab)}`);
    mergeOperationsData(payload);
    if (state.operations?._loaded?.triage) $('#n-operations').textContent = state.operations.triage?.length || 0;
    if (state.view === 'operations') renderOperations();
  } finally { state.operationsLoading.delete(loadingKey); }
}

function renderOperations() {
  if (!state.operations || state.operations.scope !== state.controller) state.operations = { scope: state.controller, can_coordinate: canCoordinate(), _loaded: {} };
  const data = state.operations;
  const tabCount = (key, count) => data._loaded?.[key] ? count : '…';
  const tabs = [
    ['triage', 'Do działania', tabCount('triage', data.triage?.length || 0)],
    ['meetings', 'Odprawy projektowe', tabCount('meetings', data.meetings?.filter(item => item.status === 'open').length || 0)]
  ];
  const configurationTabs = {
    automations: ['automations', 'Reguły automatyzacji', tabCount('automations', data.automation_rules?.filter(item => item.active).length || 0)]
  };
  if (configurationTabs[state.operationsTab]) tabs.push(configurationTabs[state.operationsTab]);
  if (!tabs.some(([key]) => key === state.operationsTab)) state.operationsTab = 'triage';
  $('#content').innerHTML = `${savedViewsToolbar('operations')}<section class="operations-shell"><nav class="operations-tabs">${tabs.map(([key, label, count]) => `<button type="button" data-operations-tab="${key}" class="${state.operationsTab === key ? 'active' : ''}"><span>${escapeHtml(label)}</span><b>${count}</b></button>`).join('')}</nav><div id="operations-content"></div></section>`;
  $$('[data-operations-tab]').forEach(button => button.addEventListener('click', () => { state.operationsTab = button.dataset.operationsTab; renderOperations(); }));
  bindSavedViews('operations', '.operations-shell', renderOperations);
  if (!data._loaded?.[state.operationsTab]) {
    $('#operations-content').innerHTML = '<div class="loading">Ładowanie wybranej zakładki…</div>';
    reloadOperations(state.operationsTab).catch(error => toast(error.message, true));
    return;
  }
  ({ triage: renderTriage, quality: renderDataQuality, risk: renderRiskRadar, dependencies: renderDependencies, meetings: renderProjectMeetings, automations: renderAutomations })[state.operationsTab]?.();
}

function renderTriage() {
  const data = state.operations;
  const rows = data.triage || [];
  const counts = data.triage_counts || {};
  const root = $('#operations-content');
  root.innerHTML = `<section class="operation-view"><header class="operation-head"><div><h2>Do działania</h2><p>Wspólna kolejka terminów, blokad i ryzyk ze wszystkich modułów.</p></div>${data.can_coordinate ? '<div class="operation-actions"><button class="secondary" data-triage-action="owner">Przypisz</button><button class="secondary" data-triage-action="priority">Priorytet</button><button class="secondary" data-triage-action="due">Termin</button></div>' : ''}</header><div class="signal-strip">${Object.entries(triageSignalNames).filter(([key]) => key !== 'in_progress').map(([key, label]) => `<span><b>${counts[key] || 0}</b>${label}</span>`).join('')}</div><div class="operation-list triage-list">${rows.map(item => `<article class="operation-row" data-operation-jump="${item.entity_type}:${item.entity_id}">${data.can_coordinate ? `<input type="checkbox" data-triage-select="${item.entity_type}:${item.entity_id}" ${state.triageSelection.has(`${item.entity_type}:${item.entity_id}`) ? 'checked' : ''} aria-label="Wybierz ${escapeHtml(item.title)}">` : ''}<span class="type-dot ${item.entity_type}"></span><span class="operation-primary"><b>${escapeHtml(item.scope_label || 'Cały projekt')} · ${escapeHtml(item.title)}</b><small>${escapeHtml(operationTypeNames[item.entity_type])} · ${escapeHtml(item.owner_name || 'Nieprzypisane')}</small></span><span class="operation-signals">${item.signals.map(signal => `<em class="signal ${signal}">${escapeHtml(triageSignalNames[signal] || signal)}</em>`).join('')}</span><span class="operation-date">${badge(item.priority)}<small>${item.due_date ? `Termin ${displayDate(item.due_date)}` : item.reminder_date ? `Przypomnienie ${displayDate(item.reminder_date)}` : 'Bez terminu'}</small></span></article>`).join('') || '<div class="empty">Brak pozycji wymagających działania.</div>'}</div></section>`;
  $$('[data-triage-select]').forEach(input => input.addEventListener('click', event => event.stopPropagation()));
  $$('[data-triage-select]').forEach(input => input.addEventListener('change', () => { if (input.checked) state.triageSelection.add(input.dataset.triageSelect); else state.triageSelection.delete(input.dataset.triageSelect); }));
  $$('[data-operation-jump]').forEach(row => row.addEventListener('click', event => { if (event.target.matches('input')) return; const [type, id] = row.dataset.operationJump.split(':'); operationJump(type, Number(id)); }));
  $$('[data-triage-action]').forEach(button => button.addEventListener('click', () => runTriageBatch(button.dataset.triageAction)));
}

async function runTriageBatch(action) {
  const items = [...state.triageSelection].map(key => { const [entity_type, id] = key.split(':'); return { entity_type, entity_id: Number(id) }; });
  if (!items.length) return toast('Zaznacz pozycje do zmiany', true);
  let result; let patch;
  if (action === 'owner') {
    result = await uiForm({ title: 'Zbiorcze przypisanie', description: `Wybrano ${items.length} pozycji. Kamienie milowe zostaną pominięte, ponieważ nie mają pola odpowiedzialnego.`, submitLabel: 'Przypisz', fields: [{ name: 'owner_user_id', label: 'Osoba odpowiedzialna', type: 'select', options: [{ value: '', label: 'Usuń przypisanie' }, ...assignableUsers().map(user => ({ value: user.id, label: user.display_name }))] }] });
    if (!result) return; patch = { owner_user_id: Number(result.owner_user_id) || null };
  } else if (action === 'priority') {
    result = await uiForm({ title: 'Zbiorcza zmiana priorytetu', description: `Wybrano ${items.length} pozycji.`, submitLabel: 'Zmień priorytet', fields: [{ name: 'priority', label: 'Priorytet', type: 'select', options: PRIORITY_DEFINITIONS }] });
    if (!result) return; patch = { priority: result.priority };
  } else {
    result = await uiForm({ title: 'Zbiorczy termin', description: 'Punkty statusu nie mają deadline’u i zostaną pominięte.', submitLabel: 'Ustaw termin', fields: [{ name: 'due_date', label: 'Deadline', type: 'date', required: true }] });
    if (!result) return; patch = { due_date: result.due_date };
  }
  try { const saved = await api('/api/triage/batch', { method: 'PATCH', body: JSON.stringify({ items, patch }) }); state.triageSelection.clear(); toast(`Zaktualizowano ${saved.updated} pozycji`); await loadData(true); }
  catch (error) { toast(error.message, true); }
}

function renderDataQuality() {
  const data = state.operations; const rows = data.quality || []; const counts = data.quality_counts || {};
  $('#operations-content').innerHTML = `<section class="operation-view"><header class="operation-head"><div><h2>Raport jakości danych</h2><p>Braki utrudniające planowanie, raportowanie i automatyzację projektu.</p></div><button type="button" class="secondary" id="quality-refresh">Odśwież raport</button></header><div class="signal-strip quality"><span class="high"><b>${counts.high || 0}</b>Wysoki wpływ</span><span class="medium"><b>${counts.medium || 0}</b>Średni wpływ</span><span class="low"><b>${counts.low || 0}</b>Niski wpływ</span><span><b>${rows.length}</b>Łącznie</span></div><div class="operation-list">${rows.map(item => `<div class="operation-row quality-row ${item.jump_available === false ? 'no-jump' : ''}" ${item.entity_type && item.entity_id ? `data-operation-jump="${item.entity_type}:${item.entity_id}"` : ''}><span class="quality-level ${item.severity}"></span><span class="operation-primary"><b>${escapeHtml(item.scope_label || 'Cały projekt')} · ${escapeHtml(item.title)}</b><small>${escapeHtml(operationTypeNames[item.entity_type] || (item.code === 'orphan_link' ? 'Powiązanie' : item.entity_type))}</small></span><span class="quality-message">${escapeHtml(item.message)}</span>${item.code === 'orphan_link' ? `<button type="button" class="mini danger-outline" data-orphan-delete="${item.link_id}">Usuń uszkodzone powiązanie</button>` : '<span>→</span>'}</div>`).join('') || '<div class="empty success-empty">Dane operacyjne są kompletne.</div>'}</div></section>`;
  $('#quality-refresh').addEventListener('click', () => reloadOperations().catch(error => toast(error.message, true)));
  $$('[data-operation-jump]').forEach(row => row.addEventListener('click', event => { if (event.target.closest('[data-orphan-delete]')) return; const [type, id] = row.dataset.operationJump.split(':'); operationJump(type, Number(id)); }));
  $$('[data-orphan-delete]').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Napraw uszkodzone powiązanie', 'Usunięty zostanie wyłącznie osierocony wpis relacji. Istniejące elementy projektu nie zostaną zmienione.', 'Usuń powiązanie', true)) return; try { await api(`/api/data-quality/orphan-links/${button.dataset.orphanDelete}`, { method: 'DELETE' }); toast('Uszkodzone powiązanie zostało usunięte'); await reloadOperations(); } catch (error) { toast(error.message, true); } }));
}

function renderRiskRadar() {
  const rows = state.operations.risk_radar || [];
  const counts = Object.fromEntries(['critical', 'high', 'medium', 'low'].map(level => [level, rows.filter(item => item.risk_level === level).length]));
  $('#operations-content').innerHTML = `<section class="operation-view risk-radar"><header class="operation-head"><div><h2>Inteligentny radar ryzyka</h2><p>Priorytet łączy terminy, blokady, brak właściciela, zależności i oczekiwanie na strony zewnętrzne.</p></div><button type="button" class="secondary" id="risk-refresh">Przelicz ryzyko</button></header><div class="signal-strip"><span class="high"><b>${counts.critical || 0}</b>Krytyczne</span><span class="medium"><b>${counts.high || 0}</b>Wysokie</span><span><b>${counts.medium || 0}</b>Średnie</span><span><b>${rows.length}</b>Obserwowane</span></div><div class="risk-list">${rows.map(item => `<button type="button" class="risk-row ${item.risk_level}" data-operation-jump="${item.entity_type}:${item.entity_id}"><span class="risk-score"><b>${item.risk_score}</b><small>/100</small></span><span><b>${escapeHtml(item.scope_label)} · ${escapeHtml(item.title)}</b><small>${item.signals.map(signal => escapeHtml(triageSignalNames[signal] || signal)).join(' · ')}${item.external_dependencies ? ` · ${item.external_dependencies} zależn. zewn.` : ''}</small></span><span>${badge(item.priority)}<small>${item.due_date ? displayDate(item.due_date) : 'bez terminu'}</small></span></button>`).join('') || '<div class="empty success-empty">Brak aktywnych ryzyk.</div>'}</div></section>`;
  $('#risk-refresh').addEventListener('click', () => reloadOperations().catch(error => toast(error.message, true)));
  $$('[data-operation-jump]').forEach(row => row.addEventListener('click', () => { const [type, id] = row.dataset.operationJump.split(':'); operationJump(type, Number(id)); }));
}

function canManageExternalDependencies() {
  return canCoordinate() || Number(state.me.current_project?.can_manage_external_dependencies) !== 0;
}

function externalDependencyStatus(item) {
  if (Number(item.configuration_pending)) return { key: 'unreported', label: 'Niezgłoszona', badge: 'gray' };
  if (item.dependency_status === 'responded' || item.dependency_status === 'resolved') return { key: 'responded', label: 'Odpowiedź otrzymana', badge: 'blue' };
  return { key: 'waiting', label: 'Oczekująca odpowiedzi', badge: 'amber' };
}

function externalDependencyTableRows() {
  return (state.externalDependencies || []).map(item => {
    const dependency = externalDependencyStatus(item);
    const reminderDays = item.next_followup ? dayDifference(item.next_followup) : null;
    return {
      ...item, point_title: item.point_title || item.entity?.title || 'Element niedostępny',
      scope_label: item.entity?.scope_label || 'Cały projekt', waiting_department: item.party || item.waiting_for || '',
      point_status: item.point_status || item.entity?.status || '', dependency_state: dependency.label,
      point_deadline: item.point_due_date || item.entity?.due_date || '', reminder_days: reminderDays,
      author_name: item.created_by_name || 'Dane historyczne', dependency_meta: dependency
    };
  });
}

function renderExternalDependencies() {
  const root = $('#point-content'); if (!root) return;
  const allRows = externalDependencyTableRows();
  const columns = [
    { key: 'point_title', label: 'Nazwa punktu' }, { key: 'scope_label', label: 'Zakres', values: uniqueValues(allRows, 'scope_label') },
    { key: 'waiting_department', label: 'Oczekiwanie na', values: uniqueValues(allRows, 'waiting_department') },
    { key: 'point_status', label: 'Status punktu', values: uniqueValues(allRows, 'point_status') },
    { key: 'dependency_state', label: 'Status zależności', values: uniqueValues(allRows, 'dependency_state') },
    { key: 'point_deadline', label: 'Deadline punktu', filter: 'date' }, { key: 'requested_at', label: 'Data zgłoszenia', filter: 'date' },
    { key: 'expected_date', label: 'Oczekiwana odpowiedź', filter: 'date' }, { key: 'next_followup', label: 'Follow-up', filter: 'date' },
    { key: 'reminder_days', label: 'Dni do przypomnienia', filter: 'number' }, { key: 'author_name', label: 'Autor', values: uniqueValues(allRows, 'author_name') }
  ];
  state.externalColumns = columns;
  const filterHeader = tableFilterRow(columns).replace('</tr>', '<th></th></tr>');
  root.innerHTML = `<section class="panel compact-data-panel external-dependencies-panel" id="external-panel"><header class="external-module-head"><span><h2>Zależności zewnętrzne</h2><small>Lista jest dostępna dla całego projektu. Każda aktualizacja komunikacji pozostaje w historii punktu.</small></span>${canManageExternalDependencies() ? '<button type="button" class="primary" id="external-add">+ Dodaj zależność</button>' : ''}</header><div class="table-view-tools">${columnVisibilityControl('external', columns)}</div><div class="tablewrap"><table class="external-dependency-table"><thead><tr>${columns.map(column => `<th class="sortable" data-column="${column.key}" data-sort="${column.key}" data-label="${column.label}">${column.label}${sortMarker('external', column.key)}</th>`).join('')}<th>Szczegóły</th></tr>${filterHeader}</thead><tbody id="external-body"></tbody></table></div></section>`;
  const drawRows = () => {
    const rows = sortRows(filterRows(allRows, '#external-panel'), state.sort.external);
    const visibleCount = Math.max(1, columns.filter(column => !(state.hiddenColumns.external || new Set()).has(column.key)).length + 1);
    $('#external-body').innerHTML = rows.map(item => `<tr class="external-dependency-record ${item.dependency_meta.key}" data-external-id="${item.id}"><td data-column="point_title" class="maincell"><button type="button" data-operation-jump="point:${item.entity_id}"><b>${escapeHtml(item.point_title)}</b></button><span class="sub">${escapeHtml(item.note || '')}</span></td><td data-column="scope_label">${escapeHtml(item.scope_label)}</td><td data-column="waiting_department"><b>${escapeHtml(item.waiting_department || '—')}</b><span class="sub">${escapeHtml(item.contact_person || 'kontakt nieuzupełniony')}${item.contact_email ? ` · ${escapeHtml(item.contact_email)}` : ''}${item.contact_phone ? ` · ${escapeHtml(item.contact_phone)}` : ''}</span></td><td data-column="point_status">${badge(item.point_status)}</td><td data-column="dependency_state"><span class="badge ${item.dependency_meta.badge}">${escapeHtml(item.dependency_meta.label)}</span></td><td data-column="point_deadline">${displayDate(item.point_deadline)}</td><td data-column="requested_at">${displayDate(item.requested_at)}</td><td data-column="expected_date">${displayDate(item.expected_date)}</td><td data-column="next_followup">${displayDate(item.next_followup)}</td><td data-column="reminder_days" class="${item.reminder_days !== null && item.reminder_days < 0 ? 'danger-text' : ''}">${item.reminder_days === null ? '—' : item.reminder_days < 0 ? `${Math.abs(item.reminder_days)} dni po terminie` : item.reminder_days === 0 ? 'dzisiaj' : `${item.reminder_days} dni`}</td><td data-column="author_name">${escapeHtml(item.author_name)}</td><td class="external-actions"><button type="button" class="mini" data-external-details="${item.id}">Szczegóły</button></td></tr>`).join('') || `<tr><td colspan="${visibleCount}" class="empty">Brak zależności odpowiadających filtrom.</td></tr>`;
    applyGroupedColumnVisibility('#external-panel', '', columns);
    $$('[data-operation-jump]').forEach(button => button.addEventListener('click', () => { const [type, id] = button.dataset.operationJump.split(':'); operationJump(type, Number(id)); }));
    $$('[data-external-details]').forEach(button => button.addEventListener('click', () => openExternalDependencyDetails((state.externalDependencies || []).find(item => item.id === Number(button.dataset.externalDetails)))));
  };
  bindTableFilters('#external-panel', drawRows);
  bindColumnVisibility('#external-panel', 'external', columns, drawRows);
  $$('#external-panel th[data-sort]').forEach(th => th.addEventListener('click', () => { updateSort('external', th.dataset.sort); drawRows(); }));
  $('#external-add')?.addEventListener('click', () => openExternalDependencyEditor());
  drawRows();
}

async function openExternalDependencyEditor(existing = null, selectedPoint = null) {
  if (!existing && !selectedPoint) {
    openEntitySelection({ mode: 'external_dependency', allowed: ['point'], initial: [], onApply: async links => {
      if (links.length !== 1 || links[0].entity_type !== 'point') throw new Error('Wybierz dokładnie jeden otwarty punkt');
      const point = state.points.find(item => Number(item.id) === Number(links[0].entity_id));
      if (!point || point.status === 'Closed') throw new Error('Wybierz nieukończony otwarty punkt');
      await openExternalDependencyEditor(null, point);
    } });
    return;
  }
  const point = selectedPoint || state.points.find(item => Number(item.id) === Number(existing.entity_id)) || existing.entity;
  const initialConfiguration = !existing || Number(existing.configuration_pending) !== 0;
  const result = await uiForm({ title: initialConfiguration ? 'Skonfiguruj i zgłoś zależność' : 'Edytuj dane zależności', description: `${point?.title || existing?.point_title || 'Otwarty punkt'} · ${controllerLabel(point) || existing?.entity?.scope_label || 'Cały projekt'}`, submitLabel: initialConfiguration ? 'Zapisz i zgłoś' : 'Zapisz dane', fields: [
    { name: 'party', label: 'Dział / strona, na którą czekamy', value: existing?.party || point?.waiting_for || '', required: true, full: true },
    { name: 'contact_person', label: 'Osoba kontaktowa', value: existing?.contact_person || '', required: true },
    { name: 'contact_email', label: 'E-mail (opcjonalnie)', type: 'email', value: existing?.contact_email || '' },
    { name: 'contact_phone', label: 'Telefon (opcjonalnie)', value: existing?.contact_phone || '' },
    ...(initialConfiguration ? [{ name: 'dependency_status', label: 'Status po zgłoszeniu', type: 'select', value: 'waiting', options: [{ value: 'waiting', label: 'Oczekująca odpowiedzi' }, { value: 'responded', label: 'Odpowiedź otrzymana' }] }] : []),
    { name: 'owner_user_id', label: 'Właściciel follow-upu', type: 'select', value: existing?.owner_user_id || '', options: [{ value: '', label: 'Nieprzypisane' }, ...assignableUsers().map(user => ({ value: user.id, label: user.display_name }))] },
    { name: 'requested_at', label: 'Data zgłoszenia', type: 'date', value: existing?.requested_at || today(), required: true },
    { name: 'expected_date', label: 'Oczekiwana odpowiedź', type: 'date', value: existing?.expected_date || '' },
    { name: 'next_followup', label: 'Data follow-upu', type: 'date', value: existing?.next_followup || '' },
    { name: 'note', label: 'Kontekst / następny krok', type: 'textarea', value: existing?.note || '', full: true, rows: 4 }
  ] });
  if (!result) return;
  try {
    const saved = await api(existing ? `/api/external-dependencies/${existing.id}` : '/api/external-dependencies', { method: existing ? 'PATCH' : 'POST', body: JSON.stringify({ ...result, owner_user_id: Number(result.owner_user_id) || null, entity_type: 'point', entity_id: existing?.entity_id || point.id }) });
    toast(initialConfiguration ? 'Zależność została skonfigurowana i zgłoszona' : 'Dane zależności zostały zapisane'); state.externalDependencies = await api('/api/external-dependencies'); if (state.view === 'points') renderPoints();
    return state.externalDependencies.find(item => item.id === saved.id) || saved;
  } catch (error) { toast(error.message, true); }
}

async function openExternalDependencyUpdate(existing) {
  const formPromise = uiForm({ title: 'Dodaj aktualizację komunikacji', description: `${existing.point_title || existing.entity?.title || 'Otwarty punkt'} · historia zachowa wcześniejsze wpisy`, submitLabel: 'Zapisz aktualizację', fields: [
    { name: 'dependency_status', label: 'Nowy status zależności', type: 'select', value: existing.dependency_status === 'responded' ? 'responded' : 'waiting', options: [{ value: 'waiting', label: 'Oczekująca odpowiedzi' }, { value: 'responded', label: 'Odpowiedź otrzymana' }], full: true },
    { name: 'response_context', label: 'Kontekst aktualizacji / treść odpowiedzi', type: 'textarea', rows: 5, required: true, full: true },
    { name: 'response_date', label: 'Data otrzymania odpowiedzi', type: 'date', value: today(), className: 'external-update-response-date' },
    { name: 'our_response_date', label: 'Data naszej odpowiedzi / zgłoszenia', type: 'date', value: today(), className: 'external-update-waiting' },
    { name: 'expected_date', label: 'Data oczekiwanej odpowiedzi', type: 'date', value: existing.expected_date || '', className: 'external-update-waiting' },
    { name: 'next_followup', label: 'Data follow-upu', type: 'date', value: existing.next_followup || '', className: 'external-update-waiting' },
    { name: 'contact_person', label: 'Osoba kontaktowa w kolejnych krokach', value: existing.contact_person || '', className: 'external-update-waiting', full: true }
  ] });
  const status = $('#action-fields [name="dependency_status"]');
  const syncFields = () => {
    const waiting = status.value === 'waiting';
    $$('#action-fields .external-update-waiting').forEach(field => { field.hidden = !waiting; field.querySelectorAll('input,select,textarea').forEach(control => { control.disabled = !waiting; }); });
    $$('#action-fields .external-update-response-date').forEach(field => { field.hidden = waiting; field.querySelectorAll('input,select,textarea').forEach(control => { control.disabled = waiting; }); });
  };
  status.addEventListener('change', syncFields); syncFields();
  const result = await formPromise;
  if (!result) return null;
  try {
    const saved = await api(`/api/external-dependencies/${existing.id}/updates`, { method: 'POST', body: JSON.stringify(result) });
    state.externalDependencies = await api('/api/external-dependencies');
    toast('Aktualizacja została dodana do historii komunikacji');
    if (state.view === 'points') renderPoints();
    return state.externalDependencies.find(item => item.id === saved.id) || saved;
  } catch (error) { toast(error.message, true); return null; }
}

function externalDependencyUpdateHtml(update) {
  const status = externalDependencyStatus({ dependency_status: update.dependency_status, configuration_pending: 0 });
  const dates = [update.response_date ? `Odpowiedź: ${displayDate(update.response_date)}` : '', update.our_response_date ? `Nasza odpowiedź: ${displayDate(update.our_response_date)}` : '', update.expected_date ? `Oczekiwana: ${displayDate(update.expected_date)}` : '', update.next_followup ? `Follow-up: ${displayDate(update.next_followup)}` : ''].filter(Boolean);
  return `<article class="external-history-entry ${escapeHtml(status.key)}"><i></i><header><span><b>${update.update_type === 'reported' ? 'Zgłoszenie zależności' : 'Aktualizacja komunikacji'}</b><small>${escapeHtml(update.created_by_name || 'Dane historyczne')} · ${displayDateTime(update.created_at)}</small></span><span class="badge ${status.badge}">${escapeHtml(status.label)}</span></header><p>${escapeHtml(update.response_context || 'Bez dodatkowego kontekstu').replace(/\n/g, '<br>')}</p>${update.contact_person ? `<span class="external-history-contact">Osoba kontaktowa: <b>${escapeHtml(update.contact_person)}</b></span>` : ''}${dates.length ? `<footer>${dates.map(value => `<span>${escapeHtml(value)}</span>`).join('')}</footer>` : ''}</article>`;
}

function openExternalDependencyDetails(existing) {
  if (!existing) return;
  const status = externalDependencyStatus(existing);
  $('#insight-title').textContent = existing.point_title || existing.entity?.title || 'Zależność zewnętrzna';
  $('#insight-description').textContent = `${existing.entity?.scope_label || 'Cały projekt'} · ${status.label}`;
  const history = (existing.updates || []).map(externalDependencyUpdateHtml).join('');
  $('#insight-content').innerHTML = `<section class="external-detail"><header class="external-detail-summary"><span><small>Status zależności</small><b class="badge ${status.badge}">${escapeHtml(status.label)}</b></span><span><small>Oczekiwanie na</small><b>${escapeHtml(existing.party || existing.waiting_for || '—')}</b></span><span><small>Status punktu</small>${badge(existing.point_status || existing.entity?.status)}</span><button type="button" class="mini" data-operation-jump="point:${existing.entity_id}">Otwórz punkt</button></header><section class="external-contact-card"><div><small>Osoba kontaktowa</small><b>${escapeHtml(existing.contact_person || 'Nieuzupełniona')}</b></div><div><small>E-mail</small><b>${escapeHtml(existing.contact_email || '—')}</b></div><div><small>Telefon</small><b>${escapeHtml(existing.contact_phone || '—')}</b></div><div><small>Właściciel follow-upu</small><b>${escapeHtml(existing.owner_name || 'Nieprzypisany')}</b></div><div><small>Data zgłoszenia</small><b>${displayDate(existing.requested_at)}</b></div><div><small>Oczekiwana odpowiedź / follow-up</small><b>${displayDate(existing.expected_date)} / ${displayDate(existing.next_followup)}</b></div></section><section class="external-history"><header><span><h3>Historia komunikacji</h3><small>Wpisy są uporządkowane od pierwszego zgłoszenia.</small></span>${canManageExternalDependencies() && !Number(existing.configuration_pending) ? '<button type="button" class="primary" id="external-update-add">+ Dodaj aktualizację</button>' : ''}</header><div>${history || `<div class="empty compact-empty">${Number(existing.configuration_pending) ? 'Zależność nie została jeszcze zgłoszona.' : 'Brak zapisanych aktualizacji.'}</div>`}</div></section>${canManageExternalDependencies() ? `<footer class="external-detail-actions"><button type="button" class="mini danger-text" id="external-detail-delete">Usuń zależność</button><span></span><button type="button" class="secondary" id="external-detail-edit">${Number(existing.configuration_pending) ? 'Skonfiguruj i zgłoś' : 'Edytuj dane'}</button></footer>` : ''}</section>`;
  $('#external-detail-edit')?.addEventListener('click', async () => { const saved = await openExternalDependencyEditor(existing); if (saved) openExternalDependencyDetails(saved); });
  $('#external-update-add')?.addEventListener('click', async () => { const saved = await openExternalDependencyUpdate(existing); if (saved) openExternalDependencyDetails(saved); });
  $('#external-detail-delete')?.addEventListener('click', async () => { if (!await uiConfirm('Usuń zależność zewnętrzną', 'Otwarty punkt i historia samego punktu pozostaną bez zmian.', 'Usuń', true)) return; try { await api(`/api/external-dependencies/${existing.id}`, { method: 'DELETE' }); state.externalDependencies = await api('/api/external-dependencies'); $('#insight-dialog').close(); renderPoints(); toast('Zależność została usunięta'); } catch (error) { toast(error.message, true); } });
  $$('[data-operation-jump]').forEach(button => button.addEventListener('click', () => { const [type, id] = button.dataset.operationJump.split(':'); openEntityOverlay(type, Number(id)); }));
  $('#insight-dialog').classList.add('kpi-expanded'); if (!$('#insight-dialog').open) $('#insight-dialog').showModal();
}
function renderProjectMeetings() {
  const rows = state.operations.meetings || [];
  const legend = ['preparing', 'published', 'modified', 'closed'].map(key => { const sample = key === 'closed' ? { status: 'closed' } : key === 'preparing' ? { status: 'open' } : key === 'modified' ? { status: 'open', published_at: '2026-01-01', updated_at: '2026-01-02' } : { status: 'open', published_at: '2026-01-02', updated_at: '2026-01-02' }; const lifecycle = meetingLifecycle(sample); return `<span class="meeting-legend-item ${key}"><i></i><b>${escapeHtml(lifecycle.label)}</b><small>${escapeHtml(lifecycle.description)}</small></span>`; }).join('');
  $('#operations-content').innerHTML = `<section class="operation-view"><header class="operation-head"><div><h2>Odprawy projektowe</h2><p>Plan działania na wybrany okres, zespół, terminy, cele i pełne podsumowanie realizacji.</p></div><button type="button" class="primary" id="meeting-add">+ Rozpocznij odprawę</button></header><div class="meeting-lifecycle-legend">${legend}</div><div class="meeting-list">${rows.map(item => { const lifecycle = meetingLifecycle(item); return `<button type="button" class="meeting-card ${lifecycle.key}" data-meeting-open="${item.id}"><span><b>${escapeHtml(item.title)}</b><small>${displayDate(item.period_from || item.meeting_date)}–${displayDate(item.period_to || item.meeting_date)} · ${escapeHtml(item.created_by_name || '')}</small></span>${meetingLifecycleBadge(item)}<span class="meeting-card-count"><b>${item.items.length}</b><small>tematów</small></span></button>`; }).join('') || '<div class="empty">Brak zapisanych odpraw.</div>'}</div></section>`;
  $('#meeting-add').addEventListener('click', () => createProjectMeeting());
  $$('[data-meeting-open]').forEach(button => button.addEventListener('click', () => openProjectMeeting(rows.find(item => item.id === Number(button.dataset.meetingOpen)))));
}

async function createProjectMeeting() {
  const from = today(); const to = addDays(from, 6);
  const result = await uiForm({ title: 'Nowa odprawa projektowa', description: 'Zakres określa okres planu. Odprawa zaczyna się pustą listą; tematy wybierzesz po jej utworzeniu.', submitLabel: 'Utwórz odprawę', fields: [
    { name: 'period_from', label: 'Plan od', type: 'date', value: from, required: true }, { name: 'period_to', label: 'Plan do', type: 'date', value: to, required: true },
    { name: 'title', label: 'Tytuł odprawy', value: `Plan działania · ${displayDate(from)}`, required: true, full: true },
    { name: 'summary', label: 'Cel / agenda', type: 'textarea', full: true, rows: 3 }
  ] });
  if (!result) return;
  try { const meeting = await api('/api/project-meetings', { method: 'POST', body: JSON.stringify({ ...result, status: 'open', items: [], scope: 'all' }) }); await loadData(true); openProjectMeeting(meeting); } catch (error) { toast(error.message, true); }
}

function meetingUsersHtml(attribute, selectedIds = [], emptyLabel = 'Wybierz osoby') {
  const selected = new Set((selectedIds || []).map(Number));
  const users = assignableUsers([...selected]);
  const names = users.filter(user => selected.has(Number(user.id))).map(user => user.display_name);
  return `<details class="multi-user-select meeting-assignee-select" data-empty-label="${escapeHtml(emptyLabel)}"><summary>${escapeHtml(names.length ? `${names.length} · ${names.join(', ')}` : emptyLabel)}</summary><div class="mentions assignee-grid"><input class="multi-choice-search" type="search" placeholder="Szukaj osoby…">${users.map(user => `<label class="mention"><input type="checkbox" ${attribute} value="${user.id}" ${selected.has(Number(user.id)) ? 'checked' : ''}>${escapeHtml(user.display_name)}</label>`).join('')}</div></details>`;
}

function meetingTargetStatuses(type, current = '') {
  const values = type === 'status' ? statusWorkflowOptions(current) : statusDefinitions(type);
  return selectOptions(values, current, 'Nie zmieniaj statusu');
}

function meetingItemPayload(item) {
  return { entity_type: item.entity_type, entity_id: item.entity_id, group_name: '', group_key: meetingGroupKey(item), decision: item.decision || '', objective: item.objective || 'Kontynuacja', outcome_comment: item.outcome_comment || '', target_status: item.target_status || '', meeting_priority: meetingPriorityValue(item.meeting_priority, item.entity?.priority), assignee_user_ids: item.assignee_user_ids || (item.owner_user_id ? [item.owner_user_id] : []), worker_user_ids: item.worker_user_ids || [], owner_user_id: item.owner_user_id || null, status_changed_by_user_id: item.status_changed_by_user_id || null, due_date: item.due_date || '', item_status: item.item_status || 'open', review_confirmed: Number(item.review_confirmed) ? 1 : 0 };
}

async function addMeetingItems(meeting) {
  openEntitySelection({ meeting: true, allowed: ['status', 'task', 'point', 'goal'], from: meeting.period_from || meeting.meeting_date, to: meeting.period_to || meeting.meeting_date, initial: meeting.items.map(item => ({ entity_type: item.entity_type, entity_id: item.entity_id })), onApply: async links => {
    const existing = new Map(meeting.items.map(item => [`${item.entity_type}:${item.entity_id}`, meetingItemPayload(item)]));
    const items = links.map(link => existing.get(`${link.entity_type}:${link.entity_id}`) || { ...link, objective: options('meeting_goal')[0] || 'Rozpoczęcie', item_status: 'open' });
    const updated = await api(`/api/project-meetings/${meeting.id}`, { method: 'PATCH', body: JSON.stringify({ ...meeting, status: 'open', items, scope: 'all' }) });
    toast('Lista odprawy została uzupełniona'); await reloadOperations(); openProjectMeeting(updated);
  } });
}

function meetingActivityHtml(item) {
  const baselineStatus = item.baseline?.status || 'Nie określono';
  const currentStatus = item.entity?.status || 'Nie określono';
  const statusEvents = (item.status_events || []).map(event => `<li><b>${escapeHtml(event.user_name || 'System')}</b><span>${escapeHtml(badgeText(event.from))} → ${escapeHtml(badgeText(event.to))}</span><small>${displayDateTime(event.changed_at)}</small></li>`).join('');
  const audit = (item.changes || []).map(change => `<article><b>${escapeHtml(change.user_name || 'System')} · ${displayDateTime(change.changed_at)}</b>${auditChangesHtml(change.changes)}</article>`).join('');
  const comments = (item.comments || []).map(comment => `<article class="meeting-comment"><b>${escapeHtml(comment.user_name || 'System')} · ${displayDateTime(comment.created_at)}</b><p>${escapeHtml(comment.content || '')}</p></article>`).join('');
  return `<div class="meeting-state-comparison"><span><small>Stan przy dodaniu do odprawy</small>${badge(baselineStatus)}</span><i>→</i><span><small>Stan aktualny</small>${badge(currentStatus)}</span><span><small>Ostatnia zmiana statusu / zamknięcie</small><b>${escapeHtml(item.status_changed_by_name || item.status_events?.[0]?.user_name || 'Nie wykryto')}</b></span></div>${statusEvents ? `<section class="meeting-status-events"><b>Zmiany stanu</b><ul>${statusEvents}</ul></section>` : ''}<div class="meeting-change-log">${audit || '<div class="empty compact-empty">Brak zmian pól od dodania do odprawy.</div>'}</div><section class="meeting-comments-log"><b>Nowe komentarze · ${(item.comments || []).length}</b>${comments || '<div class="empty compact-empty">Brak nowych komentarzy.</div>'}</section>`;
}

function openProjectMeeting(meeting, requestedMode = null) {
  const reviewMode = requestedMode === 'review' || (requestedMode !== 'plan' && meeting.status === 'closed');
  const lifecycle = meetingLifecycle(meeting);
  const confirmedCount = (meeting.items || []).filter(item => Number(item.review_confirmed)).length;
  $('#insight-title').textContent = meeting.title;
  $('#insight-description').textContent = `${displayDate(meeting.period_from || meeting.meeting_date)}–${displayDate(meeting.period_to || meeting.meeting_date)} · ${meeting.items.length} tematów`;
  const meetingGoals = options('meeting_goal').length ? options('meeting_goal') : ['Rozpoczęcie', 'Kontynuacja', 'Ukończenie'];
  const itemCardHtml = item => {
    const groupKey = meetingGroupKey(item);
    const statusUserOptions = assignableUsers([item.status_changed_by_user_id]).map(user => ({ value: user.id, label: user.display_name }));
    if (reviewMode) {
      const confirmed = Number(item.review_confirmed) !== 0;
      return `<details class="meeting-plan-item meeting-summary-item ${confirmed ? 'confirmed' : 'pending'}" data-meeting-item="${item.entity_type}:${item.entity_id}" data-meeting-group-key="${escapeHtml(groupKey)}" data-review-confirmed="${confirmed ? 1 : 0}"><summary><span class="meeting-summary-entity"><span class="type-dot ${item.entity_type}"></span><span><b>${escapeHtml(item.entity?.scope_label || 'Projekt')} · ${escapeHtml(item.entity?.title || 'Element niedostępny')}</b><small>${escapeHtml(operationTypeNames[item.entity_type] || item.entity_type)} · ${escapeHtml(badgeText(item.entity?.status))}</small></span></span><span class="meeting-review-fact assignees"><small>Przypisani pracownicy</small><b>${escapeHtml((item.assignee_names || []).join(', ') || 'Nieprzypisane')}</b></span><span class="meeting-review-fact"><small>Deadline</small><b>${displayDate(item.due_date || item.entity?.due_date)}</b></span><span class="meeting-review-fact"><small>Cel</small><b>${escapeHtml(item.objective || 'Kontynuacja')}</b></span><span class="meeting-review-priority"><small>Priorytet</small>${meetingPriorityBadge(item.meeting_priority)}</span><span class="meeting-review-state ${confirmed ? 'confirmed' : 'pending'}" data-review-state>${confirmed ? '✓ Zatwierdzone' : 'Do zatwierdzenia'}</span></summary><div class="meeting-summary-editor"><button type="button" class="meeting-open-entity mini" data-operation-jump="${item.entity_type}:${item.entity_id}">Otwórz szczegóły elementu</button>${meetingActivityHtml(item)}<div class="meeting-review-fields"><label><span>Faktycznie pracowali</span>${meetingUsersHtml('data-meeting-worker', item.worker_user_ids || [], 'Nie wskazano')}</label><label><span>Status zmienił / zamknął</span><select data-meeting-status-user>${selectOptions(statusUserOptions, item.status_changed_by_user_id || '', 'Wykryj z historii')}</select></label><label><span>Wynik</span><select data-meeting-status>${selectOptions([{ value: 'decided', label: 'Zamknięty' }, { value: 'open', label: 'Nadal otwarty' }, { value: 'deferred', label: 'Odłożony' }], item.item_status, null)}</select></label><label><span>Stan elementu po odprawie</span><select data-meeting-target-status>${meetingTargetStatuses(item.entity_type, item.target_status)}</select></label><label class="meeting-outcome"><span>Uzasadnienie / podsumowanie</span><textarea data-meeting-outcome rows="2" placeholder="Opisz wynik, blokadę lub dalsze działania">${escapeHtml(item.outcome_comment || '')}</textarea></label><div class="meeting-followup-actions"><button type="button" class="mini" data-meeting-create="task" data-source-key="${item.entity_type}:${item.entity_id}">+ Dodaj powiązane zadanie</button><button type="button" class="mini" data-meeting-create="point" data-source-key="${item.entity_type}:${item.entity_id}">+ Dodaj powiązany punkt otwarty</button><span></span><button type="button" class="primary" data-meeting-confirm="${item.entity_type}:${item.entity_id}">${confirmed ? 'Zatwierdź ponownie' : 'Zatwierdź podsumowanie punktu'}</button></div></div></div></details>`;
    }
    return `<article class="meeting-plan-item" data-meeting-item="${item.entity_type}:${item.entity_id}" data-meeting-group-key="${escapeHtml(groupKey)}"><header><input type="checkbox" data-meeting-select aria-label="Wybierz do grupowania"><button type="button" data-operation-jump="${item.entity_type}:${item.entity_id}"><span class="type-dot ${item.entity_type}"></span><span><b>${escapeHtml(item.entity?.scope_label || 'Projekt')} · ${escapeHtml(item.entity?.title || 'Element niedostępny')}</b><small>${escapeHtml(operationTypeNames[item.entity_type] || item.entity_type)} · ${escapeHtml(badgeText(item.entity?.status))}</small></span></button><div class="meeting-plan-fields"><label class="meeting-priority-field"><span>Priorytet P1–P4 ${meetingPriorityBadge(item.meeting_priority)}</span><select data-meeting-priority>${selectOptions(meetingPriorityOptions(), meetingPriorityValue(item.meeting_priority, item.entity?.priority), null)}</select></label><label><span>Cel</span><select data-meeting-objective>${selectOptions(meetingGoals, item.objective || 'Kontynuacja', null)}</select></label><label><span>Odpowiedzialni</span>${meetingUsersHtml('data-meeting-assignee', item.assignee_user_ids || (item.owner_user_id ? [item.owner_user_id] : []), 'Wybierz osoby odpowiedzialne')}</label><label><span>Deadline</span><input data-meeting-due type="date" value="${escapeHtml(item.due_date || item.entity?.due_date || '')}"></label><label class="meeting-decision"><span>Co jest do zrobienia</span><textarea data-meeting-decision rows="1" placeholder="Krótkie ustalenie / następny krok">${escapeHtml(item.decision || '')}</textarea></label></div><div class="meeting-item-actions"><button type="button" class="mini meeting-order" data-meeting-move="up" title="Przesuń wyżej">↑</button><button type="button" class="mini meeting-order" data-meeting-move="down" title="Przesuń niżej">↓</button><button type="button" class="mini danger-text" data-meeting-remove="${item.entity_type}:${item.entity_id}">Usuń</button></div></header></article>`;
  };
  const itemHtml = meetingItemGroups(meeting.items).map(group => group.key
    ? `<section class="meeting-group-block" data-meeting-group-block="${escapeHtml(group.key)}"><header class="meeting-group-divider"><span><small>Pakiet pracy · ${group.items.length} elementy</small></span>${reviewMode ? '' : `<button type="button" class="mini" data-meeting-group-clear="${escapeHtml(group.key)}">Rozgrupuj</button>`}</header><div class="meeting-group-items">${group.items.map(itemCardHtml).join('')}</div></section>`
    : `<section class="meeting-single-block">${itemCardHtml(group.items[0])}</section>`).join('');
  const heading = reviewMode
    ? `<section class="meeting-summary-head"><span class="meeting-summary-title"><small>Odprawa</small><b>${escapeHtml(meeting.title || '')}</b>${meetingLifecycleBadge(meeting)}</span><span><small>Zakres planu</small><b>${displayDate(meeting.period_from || meeting.meeting_date)}–${displayDate(meeting.period_to || meeting.meeting_date)}</b></span><span><small>Postęp podsumowania</small><b data-review-progress>${confirmedCount}/${meeting.items.length} zatwierdzone</b></span></section>`
    : `<header class="meeting-plan-head"><label class="field meeting-title-field"><span class="meeting-title-label">Nazwa odprawy ${meetingLifecycleBadge(meeting)}</span><input id="meeting-title" value="${escapeHtml(meeting.title || '')}" required></label><label class="field"><span>Plan od</span><input id="meeting-period-from" type="date" value="${escapeHtml(meeting.period_from || meeting.meeting_date)}"></label><label class="field"><span>Plan do</span><input id="meeting-period-to" type="date" value="${escapeHtml(meeting.period_to || meeting.meeting_date)}"></label><label class="field meeting-agenda-field"><span>Cel / agenda</span><textarea id="meeting-summary" rows="2">${escapeHtml(meeting.summary || '')}</textarea></label><div class="meeting-plan-tools"><button type="button" class="mini secondary" id="meeting-add-items">+ Dodaj tematy z list</button><button type="button" class="mini secondary" id="meeting-group-selected">Połącz w pakiet</button><button type="button" class="mini secondary" id="meeting-sort-priority">Sortuj P1 → P4</button></div></header>`;
  const publishLabel = meeting.published_at ? 'Zaktualizuj odprawę w Informatorze' : 'Opublikuj w Informatorze';
  const allConfirmed = meeting.items.length > 0 && confirmedCount === meeting.items.length;
  const footer = reviewMode
    ? `<footer class="meeting-actions meeting-summary-actions"><span data-review-footer-status>${allConfirmed ? 'Wszystkie decyzje zostały zatwierdzone.' : `Zatwierdź jeszcze ${meeting.items.length - confirmedCount} elementów.`}</span>${meeting.status === 'closed' ? `<button type="button" class="secondary" id="meeting-publish">${publishLabel}</button><button type="button" class="secondary" id="meeting-reopen">Otwórz ponownie</button>` : '<button type="button" class="secondary" id="meeting-back-plan">Wróć do planu</button>'}<button type="button" class="primary" id="meeting-close" ${allConfirmed ? '' : 'disabled'}>${meeting.status === 'closed' ? 'Zapisz podsumowanie' : 'Zamknij odprawę'}</button></footer>`
    : `<footer class="meeting-actions"><button type="button" class="danger" id="meeting-delete">Usuń odprawę</button><span></span><button type="button" class="secondary" id="meeting-publish">${publishLabel}</button><button type="button" class="secondary" id="meeting-save">Zapisz szkic</button><button type="button" class="primary" id="meeting-start-review">Podsumuj odprawę</button></footer>`;
  $('#insight-content').innerHTML = `<div class="meeting-mode ${reviewMode ? 'meeting-review-mode' : 'meeting-plan-mode'}">${heading}<div class="meeting-items">${itemHtml || '<div class="empty">Lista jest pusta. Wróć do planu i dodaj tematy z list.</div>'}</div>${footer}</div>`;

  const sourceItem = root => { const [entityType, entityId] = root.dataset.meetingItem.split(':'); return meeting.items.find(item => item.entity_type === entityType && Number(item.entity_id) === Number(entityId)); };
  const collectItems = () => $$('#insight-content [data-meeting-item]').map(root => {
    const source = sourceItem(root) || {}; const [entity_type, entityId] = root.dataset.meetingItem.split(':');
    if (reviewMode) return { ...meetingItemPayload(source), entity_type, entity_id: Number(entityId), group_key: root.dataset.meetingGroupKey || '', group_name: '', worker_user_ids: [...root.querySelectorAll('[data-meeting-worker]:checked')].map(input => Number(input.value)), status_changed_by_user_id: Number(root.querySelector('[data-meeting-status-user]').value) || null, item_status: root.querySelector('[data-meeting-status]').value, target_status: root.querySelector('[data-meeting-target-status]').value, outcome_comment: root.querySelector('[data-meeting-outcome]').value, review_confirmed: Number(root.dataset.reviewConfirmed) ? 1 : 0 };
    return { ...meetingItemPayload(source), entity_type, entity_id: Number(entityId), group_key: root.dataset.meetingGroupKey || '', group_name: '', meeting_priority: root.querySelector('[data-meeting-priority]').value, objective: root.querySelector('[data-meeting-objective]').value, decision: root.querySelector('[data-meeting-decision]').value, assignee_user_ids: [...root.querySelectorAll('[data-meeting-assignee]:checked')].map(input => Number(input.value)), due_date: root.querySelector('[data-meeting-due]').value };
  });
  const currentMeeting = items => ({ ...meeting, title: reviewMode ? meeting.title : $('#meeting-title').value.trim(), period_from: reviewMode ? meeting.period_from : $('#meeting-period-from').value, period_to: reviewMode ? meeting.period_to : $('#meeting-period-to').value, summary: reviewMode ? meeting.summary : $('#meeting-summary').value, items });
  const mergeMeetingItems = items => items.map(item => ({ ...(meeting.items.find(source => source.entity_type === item.entity_type && Number(source.entity_id) === Number(item.entity_id)) || {}), ...item }));
  const localMeeting = () => currentMeeting(mergeMeetingItems(collectItems()));
  const updateReviewProgress = () => {
    const roots = $$('#insight-content [data-meeting-item]');
    const count = roots.filter(root => Number(root.dataset.reviewConfirmed)).length;
    const complete = roots.length > 0 && count === roots.length;
    const progress = $('[data-review-progress]'); if (progress) progress.textContent = `${count}/${roots.length} zatwierdzone`;
    const status = $('[data-review-footer-status]'); if (status) status.textContent = complete ? 'Wszystkie decyzje zostały zatwierdzone.' : `Zatwierdź jeszcze ${roots.length - count} elementów.`;
    if ($('#meeting-close')) $('#meeting-close').disabled = !complete;
  };
  const markReviewPending = root => {
    if (!root || !Number(root.dataset.reviewConfirmed)) return;
    root.dataset.reviewConfirmed = '0'; root.classList.remove('confirmed'); root.classList.add('pending');
    const stateLabel = root.querySelector('[data-review-state]'); if (stateLabel) { stateLabel.className = 'meeting-review-state pending'; stateLabel.textContent = 'Zmiany wymagają zatwierdzenia'; }
    const button = root.querySelector('[data-meeting-confirm]'); if (button) button.textContent = 'Zatwierdź podsumowanie punktu';
    updateReviewProgress();
  };
  const save = async status => {
    const items = collectItems();
    const title = reviewMode ? meeting.title : $('#meeting-title').value.trim();
    if (!title) { $('#meeting-title')?.focus(); return toast('Podaj indywidualną nazwę odprawy.', true); }
    if (status === 'closed') {
      const unconfirmed = items.find(item => !Number(item.review_confirmed));
      if (unconfirmed) return toast('Zatwierdź podsumowanie każdego elementu przed zamknięciem odprawy.', true);
      const incomplete = items.find(item => ['open', 'deferred'].includes(item.item_status) && !item.outcome_comment.trim());
      if (incomplete) return toast('Uzupełnij uzasadnienie dla wszystkich otwartych lub odłożonych elementów.', true);
    }
    const updated = await api(`/api/project-meetings/${meeting.id}`, { method: 'PATCH', body: JSON.stringify({ ...currentMeeting(items), status, scope: 'all' }) });
    toast(status === 'closed' ? 'Podsumowanie odprawy zostało zapisane' : 'Szkic odprawy został zapisany. Udostępnij go osobnym przyciskiem.'); await loadData(true); openProjectMeeting(updated, status === 'closed' ? 'review' : 'plan');
  };

  $('#meeting-add-items')?.addEventListener('click', () => addMeetingItems(localMeeting()));
  $('#meeting-group-selected')?.addEventListener('click', () => {
    const keys = $$('#insight-content [data-meeting-item]').filter(root => root.querySelector('[data-meeting-select]')?.checked).map(root => root.dataset.meetingItem);
    if (keys.length < 2) return toast('Zaznacz co najmniej dwa elementy, które mają tworzyć pakiet pracy.', true);
    const groupKey = `group:${Date.now()}:${Math.random().toString(16).slice(2)}`;
    const changed = collectItems().map(item => keys.includes(`${item.entity_type}:${item.entity_id}`) ? { ...item, group_key: groupKey, group_name: '' } : item);
    openProjectMeeting(currentMeeting(mergeMeetingItems(changed)), 'plan');
    toast('Elementy połączono wizualnie. Ich priorytety, terminy i odpowiedzialni pozostają indywidualne.');
  });
  $$('[data-meeting-group-clear]').forEach(button => button.addEventListener('click', () => {
    const groupKey = button.dataset.meetingGroupClear;
    const changed = collectItems().map(item => item.group_key === groupKey ? { ...item, group_key: '', group_name: '' } : item);
    openProjectMeeting(currentMeeting(mergeMeetingItems(changed)), 'plan');
  }));
  $('#meeting-sort-priority')?.addEventListener('click', () => {
    const groups = meetingItemGroups(collectItems()).map((group, index) => ({ ...group, index, priority: Math.min(...group.items.map(item => meetingPriorityValue(item.meeting_priority))), items: group.items.slice().sort((first, second) => meetingPriorityValue(first.meeting_priority) - meetingPriorityValue(second.meeting_priority)) }));
    groups.sort((first, second) => first.priority - second.priority || first.index - second.index);
    openProjectMeeting(currentMeeting(mergeMeetingItems(groups.flatMap(group => group.items))), 'plan'); toast('Elementy posortowano od P1 do P4');
  });
  $$('.multi-choice-search').forEach(search => search.addEventListener('input', () => { const term = search.value.trim().toLocaleLowerCase('pl'); search.parentElement.querySelectorAll(':scope > label').forEach(label => { label.hidden = Boolean(term) && !label.textContent.toLocaleLowerCase('pl').includes(term); }); }));
  $$('[data-meeting-priority]').forEach(select => select.addEventListener('change', () => { const current = select.closest('.meeting-priority-field')?.querySelector('.meeting-priority-badge'); if (current) current.outerHTML = meetingPriorityBadge(select.value); }));
  $$('.meeting-mode .multi-user-select input[type="checkbox"]').forEach(input => input.addEventListener('change', () => { const details = input.closest('details.multi-user-select'); const names = [...details.querySelectorAll('input[type="checkbox"]:checked')].map(control => control.closest('label').textContent.trim()); details.querySelector('summary').textContent = names.length ? `${names.length} · ${names.join(', ')}` : details.dataset.emptyLabel || 'Wybierz osoby odpowiedzialne'; }));
  if (reviewMode) $$('.meeting-summary-item :is(input,select,textarea)').forEach(control => control.addEventListener('change', () => markReviewPending(control.closest('[data-meeting-item]'))));
  $$('[data-meeting-confirm]').forEach(button => button.addEventListener('click', async () => {
    const root = button.closest('[data-meeting-item]');
    const confirmedKey = root.dataset.meetingItem;
    const status = root.querySelector('[data-meeting-status]').value;
    const outcome = root.querySelector('[data-meeting-outcome]').value.trim();
    if (['open', 'deferred'].includes(status) && !outcome) { root.querySelector('[data-meeting-outcome]').focus(); return toast('Dodaj uzasadnienie dla elementu pozostawionego jako otwarty lub odłożony.', true); }
    root.dataset.reviewConfirmed = '1';
    try {
      const items = collectItems().map(item => {
        const key = `${item.entity_type}:${item.entity_id}`;
        if (key === confirmedKey) return item;
        const source = meeting.items.find(entry => entry.entity_type === item.entity_type && Number(entry.entity_id) === Number(item.entity_id));
        return source ? meetingItemPayload(source) : item;
      });
      const updated = await api(`/api/project-meetings/${meeting.id}`, { method: 'PATCH', body: JSON.stringify({ ...currentMeeting(items), status: meeting.status, scope: 'all' }) });
      toast('Decyzja dla elementu została zatwierdzona'); await reloadOperations(); openProjectMeeting(updated, 'review');
    } catch (error) { root.dataset.reviewConfirmed = '0'; toast(error.message, true); }
  }));
  $$('[data-meeting-move]').forEach(button => button.addEventListener('click', () => { const item = button.closest('[data-meeting-item]'); const sibling = button.dataset.meetingMove === 'up' ? item.previousElementSibling : item.nextElementSibling; if (!sibling?.matches('[data-meeting-item]')) return; if (button.dataset.meetingMove === 'up') item.parentElement.insertBefore(item, sibling); else item.parentElement.insertBefore(sibling, item); }));
  $$('[data-meeting-remove]').forEach(button => button.addEventListener('click', async () => { const key = button.dataset.meetingRemove; const items = collectItems().filter(item => `${item.entity_type}:${item.entity_id}` !== key); try { const updated = await api(`/api/project-meetings/${meeting.id}`, { method: 'PATCH', body: JSON.stringify({ ...currentMeeting(items), scope: 'all' }) }); await reloadOperations(); openProjectMeeting(updated, 'plan'); } catch (error) { toast(error.message, true); } }));
  $$('[data-meeting-create]').forEach(button => button.addEventListener('click', () => { const [entityType, entityId] = button.dataset.sourceKey.split(':'); const current = collectItems().find(item => item.entity_type === entityType && Number(item.entity_id) === Number(entityId)); const source = { ...(meeting.items.find(item => item.entity_type === entityType && Number(item.entity_id) === Number(entityId)) || {}), ...current }; if (!source.entity_type) return; const links = [{ entity_type: source.entity_type, entity_id: source.entity_id }]; if (button.dataset.meetingCreate === 'task') openRecord('tasks', null, { title: `Działanie po odprawie: ${source.entity?.title || ''}`, description: source.decision || '', hierarchy_target: source.entity?.controller_group_id ? `group:${source.entity.controller_group_id}` : `controller:${source.entity?.controller || ''}`, links }); else openRecord('points', null, { title: `Punkt po odprawie: ${source.entity?.title || ''}`, description: source.decision || '', hierarchy_target: source.entity?.controller_group_id ? `group:${source.entity.controller_group_id}` : `controller:${source.entity?.controller || ''}`, links }); }));
  $('#meeting-publish')?.addEventListener('click', async () => { try { const current = localMeeting(); if (!current.title.trim()) return toast('Podaj indywidualną nazwę odprawy.', true); const updatingPublication = Boolean(meeting.published_at); const updated = await api(`/api/project-meetings/${meeting.id}`, { method: 'PATCH', body: JSON.stringify({ ...current, status: meeting.status, scope: 'all' }) }); const published = await api(`/api/project-meetings/${meeting.id}/publish`, { method: 'POST' }); meeting = published.meeting || updated; toast(`Plan odprawy został ${updatingPublication ? 'zaktualizowany' : 'opublikowany'} w „Planach i priorytetach”`); await loadData(true); openProjectMeeting(meeting, meeting.status === 'closed' ? 'review' : 'plan'); } catch (error) { toast(error.message, true); } });
  $('#meeting-save')?.addEventListener('click', () => save(meeting.status).catch(error => toast(error.message, true)));
  $('#meeting-start-review')?.addEventListener('click', () => openProjectMeeting(localMeeting(), 'review'));
  $('#meeting-back-plan')?.addEventListener('click', () => openProjectMeeting(localMeeting(), 'plan'));
  $('#meeting-close')?.addEventListener('click', () => save('closed').catch(error => toast(error.message, true)));
  $('#meeting-reopen')?.addEventListener('click', () => save('open').catch(error => toast(error.message, true)));
  $('#meeting-delete')?.addEventListener('click', async () => { if (!await uiConfirm('Usuń odprawę', 'Ustalenia zapisane w elementach i ich historia pozostaną bez zmian.', 'Usuń', true)) return; try { await api(`/api/project-meetings/${meeting.id}`, { method: 'DELETE' }); $('#insight-dialog').close(); await reloadOperations(); } catch (error) { toast(error.message, true); } });
  $$('[data-operation-jump]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); const [type, id] = button.dataset.operationJump.split(':'); operationJump(type, Number(id)); }));
  $('#insight-dialog').classList.add('kpi-expanded'); if (!$('#insight-dialog').open) $('#insight-dialog').showModal();
}
function renderDependencies() {
  const data = state.operations.dependencies || { critical_path: [], blocked_tasks: [] };
  $('#operations-content').innerHTML = `<section class="operation-view"><header class="operation-head"><div><h2>Zależności i ścieżka krytyczna</h2><p>Szacowanie wykorzystuje planowany start i deadline; brak zakresu dat oznacza 1 dzień.</p></div><span class="operation-summary">${data.edges || 0} zależności · ${data.total_days || 0} dni ścieżki</span></header>${data.cycle_count ? `<div class="operation-alert">Wykryto ${data.cycle_count} zadań w cyklu zależności. Edycja nowych cykli jest zablokowana.</div>` : ''}<div class="dependency-layout"><section><h3>Ścieżka krytyczna</h3><ol class="critical-path">${(data.critical_path || []).map((item, index) => `<li><button type="button" data-operation-jump="task:${item.entity_id}"><span>${index + 1}</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.scope_label)} · ${item.duration_days} dni</small></span><em>Σ ${item.cumulative_days} dni</em></button></li>`).join('') || '<li class="empty">Dodaj zależności do zadań, aby wyznaczyć ścieżkę.</li>'}</ol></section><section><h3>Zadania zablokowane</h3><div class="blocked-list">${(data.blocked_tasks || []).map(item => `<button type="button" data-operation-jump="task:${item.entity_id}"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.scope_label)}</small><span>Blokuje: ${item.blocked_by.map(blocker => escapeHtml(blocker.title)).join(', ')}</span></button>`).join('') || '<div class="empty success-empty">Żadne zadanie nie jest blokowane przez zależności.</div>'}</div></section></div></section>`;
  $$('[data-operation-jump]').forEach(row => row.addEventListener('click', () => { const [type, id] = row.dataset.operationJump.split(':'); operationJump(type, Number(id)); }));
}

function renderAutomations() {
  const rows = state.operations.automation_rules || [];
  const actionLabel = (action, item) => action === 'notify_assignees' ? 'powiadom odpowiedzialnych' : action === 'notify_managers' ? 'powiadom managerów' : `ustaw priorytet ${item.target_priority}`;
  $('#operations-content').innerHTML = `<section class="operation-view"><header class="operation-head"><div><h2>Reguły automatyzacji</h2><p>Powiadomienia i eskalacja priorytetu bez ręcznego pilnowania list.</p></div>${state.operations.can_coordinate ? '<div class="operation-actions"><button type="button" class="secondary" id="automation-run">Uruchom aktywne</button><button type="button" class="primary" id="automation-add">+ Reguła</button></div>' : ''}</header><div class="automation-list">${rows.map(item => `<article class="automation-row ${item.active ? 'active' : 'inactive'}"><span class="automation-state"></span><span><b>${escapeHtml(item.name)}</b><small>${item.entity_types.map(type => operationTypeNames[type]).join(', ')} · ostatnio: ${item.last_run_at ? displayDateTime(item.last_run_at) : 'jeszcze nie uruchomiono'}</small></span><span>${escapeHtml(triageSignalNames[item.trigger_type] || item.trigger_type)} → ${(item.actions || [item.action_type]).map(action => escapeHtml(actionLabel(action, item))).join(' + ')}</span><span class="automation-state-label">${item.active ? 'Aktywna' : 'Nieaktywna'}</span>${state.operations.can_coordinate ? `${item.active ? '' : `<button type="button" class="mini" data-automation-run-once="${item.id}">Uruchom raz</button>`}<button type="button" class="mini" data-automation-edit="${item.id}">Edytuj</button><button type="button" class="mini danger-text" data-automation-delete="${item.id}">Usuń</button>` : ''}</article>`).join('') || '<div class="empty">Brak reguł automatyzacji.</div>'}</div></section>`;
  $('#automation-add')?.addEventListener('click', () => openAutomationEditor());
  $('#automation-run')?.addEventListener('click', async () => { try { const result = await api('/api/automation-rules/run', { method: 'POST' }); toast(`Wykonano ${result.executed} nowych działań`); await loadData(true); } catch (error) { toast(error.message, true); } });
  $$('[data-automation-run-once]').forEach(button => button.addEventListener('click', async () => {
    try {
      const result = await api(`/api/automation-rules/${button.dataset.automationRunOnce}/run`, { method: 'POST' });
      toast(`Reguła wykonana jednorazowo · ${result.executed} nowych działań`);
      await reloadOperations();
    } catch (error) { toast(error.message, true); }
  }));
  $$('[data-automation-edit]').forEach(button => button.addEventListener('click', () => openAutomationEditor(rows.find(item => item.id === Number(button.dataset.automationEdit)))));
  $$('[data-automation-delete]').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń regułę', 'Dotychczasowe zmiany i powiadomienia pozostaną w historii.', 'Usuń', true)) return; try { await api(`/api/automation-rules/${button.dataset.automationDelete}`, { method: 'DELETE' }); await reloadOperations(); } catch (error) { toast(error.message, true); } }));
}

async function openAutomationEditor(existing = null) {
  const enabled = new Set(existing?.entity_types || ['task', 'point']);
  const formPromise = uiForm({ title: existing ? 'Edytuj regułę' : 'Nowa reguła automatyzacji', description: 'Wybierz warunek, zakres elementów i wszystkie działania wykonywane przez regułę.', submitLabel: 'Zapisz regułę', fields: [
    { name: 'name', label: 'Nazwa reguły', value: existing?.name || '', required: true, full: true, className: 'automation-editor-name' },
    { name: 'trigger_type', label: 'Warunek', type: 'select', value: existing?.trigger_type || 'overdue', options: [{ value: 'overdue', label: 'Przekroczony deadline' }, { value: 'due_soon', label: 'Deadline w ciągu N dni' }, { value: 'reminder_due', label: 'Nadszedł termin przypomnienia' }, { value: 'unassigned', label: 'Brak odpowiedzialnego' }, { value: 'blocked', label: 'Element zablokowany' }, { value: 'in_progress', label: 'Element ze statusem „W trakcie” przez co najmniej N dni' }] },
    { name: 'days_offset', label: 'Liczba dni dla warunku czasowego', type: 'number', value: existing?.days_offset ?? 3 },
    { name: 'entity_types', label: 'Typy elementów', type: 'multiselect', value: [...enabled], options: ['status', 'task', 'point', 'goal'].map(type => ({ value: type, label: operationTypeNames[type] })), full: true, className: 'automation-editor-types' },
    { name: 'actions', label: 'Działania', type: 'multiselect', value: existing?.actions || [existing?.action_type || 'notify_assignees'], options: [{ value: 'notify_assignees', label: 'Powiadom odpowiedzialnych' }, { value: 'notify_managers', label: 'Powiadom managerów' }, { value: 'escalate_priority', label: 'Podnieś priorytet' }], full: true, className: 'automation-editor-actions', hint: 'Możesz uruchomić kilka działań jednocześnie.' },
    { name: 'target_priority', label: 'Priorytet po eskalacji', type: 'select', value: existing?.target_priority || 'High', options: PRIORITY_DEFINITIONS, full: true, className: 'automation-editor-priority' },
    { name: 'active', label: 'Reguła aktywna', type: 'checkbox', value: existing ? Boolean(existing.active) : true, full: true, className: 'automation-editor-active' }
  ] });
  const priorityField = $('#action-fields .automation-editor-priority');
  const syncPriorityVisibility = () => { priorityField.hidden = !$('#action-fields [name="actions"][value="escalate_priority"]')?.checked; };
  $$('#action-fields [name="actions"]').forEach(input => input.addEventListener('change', syncPriorityVisibility));
  syncPriorityVisibility();
  const result = await formPromise;
  if (!result) return;
  const entity_types = result.entity_types || [];
  if (!entity_types.length) return toast('Wybierz co najmniej jeden typ elementu.', true);
  if (!result.actions?.length) return toast('Wybierz co najmniej jedno działanie.', true);
  try { await api(existing ? `/api/automation-rules/${existing.id}` : '/api/automation-rules', { method: existing ? 'PATCH' : 'POST', body: JSON.stringify({ ...result, entity_types, active: result.active ? 1 : 0 }) }); toast('Reguła została zapisana'); await reloadOperations(); }
  catch (error) { toast(error.message, true); }
}

function canCoordinate() { return ['moderator', 'project_admin', 'system_admin'].includes(state.me.role); }

function plannerRawControls() {
  const active = Number(state.plannerRawPlanId || 0);
  return `<span class="planner-raw-controls ${active ? 'active' : ''}"><label>Plan <select id="planner-raw-select"><option value="">Produkcyjny</option>${(state.plannerRawPlans || []).map(plan => `<option value="${plan.id}" ${Number(plan.id) === active ? 'selected' : ''}>RAW · ${escapeHtml(plan.name)}${plan.changes_count ? ` (${plan.changes_count})` : ''}</option>`).join('')}</select></label><button type="button" class="mini" id="planner-raw-new" ${state.plannerRawPlans.length >= 5 ? 'disabled' : ''}>+ RAW</button>${active ? '<button type="button" class="mini" id="planner-raw-range">Zakres RAW</button><button type="button" class="mini" id="planner-raw-compare">Porównaj</button><button type="button" class="mini primary" id="planner-raw-publish">Opublikuj RAW</button><button type="button" class="mini danger-text" id="planner-raw-delete">Usuń RAW</button>' : ''}</span>`;
}

async function createPlannerRawPlan() {
  const result = await uiForm({ title: 'Nowy prywatny plan RAW', description: 'Powstanie prywatna kopia planu produkcyjnego w wybranym zakresie. Tylko Ty zobaczysz ją przed publikacją.', submitLabel: 'Utwórz RAW', fields: [
    { name: 'name', label: 'Nazwa planu', required: true, full: true },
    { name: 'from_date', label: 'Od', type: 'date', value: state.plannerFrom, required: true },
    { name: 'to_date', label: 'Do', type: 'date', value: addDays(state.plannerFrom, state.plannerDays - 1), required: true }
  ] });
  if (!result) return;
  try { const plan = await api('/api/planner/raw-plans', { method: 'POST', body: JSON.stringify(result) }); state.plannerRawPlanId = Number(plan.id); state.plannerRawPlans = await api('/api/planner/raw-plans'); await reloadPlanner(); toast('Utworzono prywatny plan RAW'); }
  catch (error) { toast(error.message, true); }
}

async function editPlannerRawRange() {
  const plan = state.planner?.raw_plan; if (!plan) return;
  const result = await uiForm({ title: `Zakres RAW · ${plan.name}`, description: 'Dni pozostające w zakresie zachowają prywatne zmiany. Nowo dodane dni otrzymają snapshot planu produkcyjnego z chwili rozszerzenia.', submitLabel: 'Zapisz zakres', fields: [
    { name: 'name', label: 'Nazwa planu', value: plan.name, required: true, full: true },
    { name: 'from_date', label: 'Od', type: 'date', value: plan.from_date, required: true },
    { name: 'to_date', label: 'Do', type: 'date', value: plan.to_date, required: true }
  ] });
  if (!result) return;
  try {
    const updated = await api(`/api/planner/raw-plans/${plan.id}`, { method: 'PATCH', body: JSON.stringify(result) });
    state.plannerFrom = updated.from_date; state.plannerDays = Math.min(365, Math.max(7, Math.round((new Date(`${updated.to_date}T12:00:00Z`) - new Date(`${updated.from_date}T12:00:00Z`)) / 86400000) + 1));
    state.plannerRawPlans = await api('/api/planner/raw-plans'); await reloadPlanner(); toast('Zakres planu RAW został zaktualizowany');
  } catch (error) { toast(error.message, true); }
}

async function comparePlannerRawPlan() {
  const changes = state.planner?.raw_changes || [];
  await uiForm({ title: `Porównanie RAW · ${state.planner?.raw_plan?.name || ''}`, description: changes.length ? `${changes.length} zmian względem planu produkcyjnego.` : 'Plan RAW jest identyczny z produkcyjnym.', submitLabel: 'Zamknij', fields: changes.length ? [{ name: 'changes', label: 'Zmiany pracowników', type: 'textarea', rows: Math.min(16, Math.max(5, changes.length * 2)), value: changes.map(change => `${change.display_name} · ${displayDate(change.plan_date)} · ${change.project_label || 'Plan'}\n${change.before} → ${change.after}`).join('\n\n'), full: true }] : [] });
}

async function publishPlannerRawPlan() {
  const changes = state.planner?.raw_changes || [];
  if (!changes.length) return toast('Plan RAW nie zawiera zmian do opublikowania');
  const result = await uiForm({ title: `Opublikuj RAW · ${state.planner.raw_plan.name}`, description: `Plan produkcyjny zostanie zastąpiony w zakresie ${displayDate(state.planner.raw_plan.from_date)} – ${displayDate(state.planner.raw_plan.to_date)}. Zmiany dotyczą ${new Set(changes.map(change => change.user_id)).size} osób.`, submitLabel: 'Opublikuj plan', danger: true, fields: [
    { name: 'notify_users', label: 'Poinformuj pracowników o zmianach dotyczących ich osoby', type: 'checkbox', value: 1, full: true }
  ] });
  if (!result) return;
  try { const published = await api(`/api/planner/raw-plans/${state.plannerRawPlanId}/publish`, { method: 'POST', body: JSON.stringify({ notify_users: result.notify_users ? 1 : 0 }) }); state.plannerRawPlans = await api('/api/planner/raw-plans'); await reloadPlanner(); toast(`Plan RAW opublikowano${published.notified_users ? ` · powiadomiono ${published.notified_users} osób` : ''}`); }
  catch (error) { toast(error.message, true); }
}

async function deletePlannerRawPlan() {
  const plan = state.planner?.raw_plan; if (!plan) return;
  if (!await uiConfirm('Usuń plan RAW', `Prywatny plan „${plan.name}” zostanie trwale usunięty. Plan produkcyjny nie zmieni się.`, 'Usuń RAW', true)) return;
  try { await api(`/api/planner/raw-plans/${plan.id}`, { method: 'DELETE' }); state.plannerRawPlanId = null; state.plannerRawPlans = await api('/api/planner/raw-plans'); await reloadPlanner(); toast('Usunięto plan RAW'); }
  catch (error) { toast(error.message, true); }
}

async function togglePlannerCheckout() {
  const lock=state.planner?.planner_lock; const own=lock&&Number(lock.locked_by)===Number(state.me.id);
  try {
    if(own) await api('/api/planner/checkin',{method:'POST',body:'{}'});
    else if(lock){
      if(!['project_admin','system_admin'].includes(state.me.role)) return toast(`Planner edytuje obecnie ${lock.locked_by_name}`,true);
      if(!await uiConfirm('Wymuś zaewidencjonowanie',`Zakończyć sesję edycji użytkownika ${lock.locked_by_name}?`,'Wymuś',true)) return;
      await api('/api/planner/checkin',{method:'POST',body:JSON.stringify({force:1})});
    } else await api('/api/planner/checkout',{method:'POST',body:'{}'});
    toast(own||lock?'Planner został zaewidencjonowany':'Planner został wyewidencjonowany do edycji'); await reloadPlanner();
  } catch(error){toast(error.message,true);}
}

async function openPlannerSnapshots() {
  try { state.plannerSnapshots=await api('/api/planner/snapshots'); } catch(error){ return toast(error.message,true); }
  const now=new Date(); const currentYear=Math.min(2040,Math.max(2026,now.getUTCFullYear())); const currentQuarter=Math.floor(now.getUTCMonth()/3)+1;
  const result=await uiForm({title:'Kwartalne snapshoty Plannera',description:'Wspólny, nieedytowalny punkt przywracania obejmuje pełny kwartał i globalny plan uczestników projektu. Limit: 3 snapshoty na kwartał.',submitLabel:'Wykonaj',fields:[
    {name:'action',label:'Operacja',type:'select',value:'create',options:[{value:'create',label:'Utwórz snapshot'},{value:'restore',label:'Przywróć snapshot'}],full:true},
    {name:'snapshot_id',label:'Istniejący snapshot',type:'select',options:state.plannerSnapshots.map(item=>({value:item.id,label:`Q${item.quarter} ${item.year} · ${item.name} · ${item.created_by_name||''}`})),full:true},
    {name:'year',label:'Rok',type:'number',value:currentYear},{name:'quarter',label:'Kwartał',type:'number',value:currentQuarter},
    {name:'name',label:'Nazwa nowego snapshotu',full:true},{name:'from',label:'Przywróć od (opcjonalnie)',type:'date'},{name:'to',label:'Przywróć do (opcjonalnie)',type:'date'}
  ]});
  if(!result)return;
  try{
    if(result.action==='create') await api('/api/planner/snapshots',{method:'POST',body:JSON.stringify({year:Number(result.year),quarter:Number(result.quarter),name:result.name})});
    else { if(!result.snapshot_id) return toast('Wybierz snapshot do przywrócenia',true); if(!await uiConfirm('Przywróć snapshot','Plan produkcyjny wybranego zakresu zostanie zastąpiony, a zmiany trafią do historii i kolejki informowania.','Przywróć',true))return; await api(`/api/planner/snapshots/${result.snapshot_id}/restore`,{method:'POST',body:JSON.stringify({from:result.from,to:result.to})}); }
    toast(result.action==='create'?'Utworzono snapshot kwartalny':'Przywrócono snapshot'); await reloadPlanner();
  }catch(error){toast(error.message,true);}
}

async function openPlannerInformationQueue() {
  const pending=(state.planner?.information_queue||[]).filter(item=>item.status==='pending');
  const result=await uiForm({title:'Zmiany wymagające przekazania',description:`Oczekuje ${pending.length} zmian. Możesz wysłać jedno zbiorcze powiadomienie na osobę albo odnotować przekazanie inną drogą.`,submitLabel:'Oznacz jako przekazane',fields:[
    {name:'from',label:'Od',type:'date',value:state.plannerFrom,required:true},{name:'to',label:'Do',type:'date',value:addDays(state.plannerFrom,state.plannerDays-1),required:true},
    {name:'notify_users',label:'Wyślij powiadomienie użytkownikom',type:'checkbox',value:1,full:true},{name:'note',label:'Komentarz do przekazania',full:true}
  ]});
  if(!result)return;
  try{const saved=await api('/api/planner/information',{method:'POST',body:JSON.stringify(result)});toast(`Przekazano ${saved.updated} zmian · powiadomiono ${saved.notified_users} osób`);await reloadPlanner();}catch(error){toast(error.message,true);}
}

async function openPlannerDayHistory(userId,planDate){
  try{
    const rows=await api(`/api/planner/history?user_id=${userId}&plan_date=${planDate}`);
    const detail=value=>{if(value===null||value===undefined||value==='')return '—';if(typeof value==='string')return value;const parts=[];if(value.note)parts.push(`komentarz: ${value.note}`);if(value.absence_type)parts.push(value.absence_type==='vacation'?'urlop':'wolne');if(value.vehicle)parts.push(`auto: ${value.vehicle}`);return parts.join(', ')||JSON.stringify(value);};
    const changeLine=change=>change.type==='added'?`+ ${change.label}${detail(change.to)!=='—'?` · ${detail(change.to)}`:''}`:change.type==='removed'?`− ${change.label}${detail(change.from)!=='—'?` · ${detail(change.from)}`:''}`:`• ${change.label}: ${detail(change.from)} → ${detail(change.to)}`;
    await uiForm({title:`Historia dnia · ${displayDate(planDate)}`,description:`${rows.length} zapisanych wersji planu.`,submitLabel:'Zamknij',fields:[{name:'history',label:'Zmiany',type:'textarea',rows:Math.min(18,Math.max(5,rows.length*3)),value:rows.map(row=>`${displayDateTime(row.created_at)} · ${row.changed_by_name||'System'} · ${row.action==='create'?'utworzenie':row.action==='delete'?'usunięcie':'zmiana'}\n${row.changes.map(changeLine).join('\n')}`).join('\n\n'),full:true}]});
  }catch(error){toast(error.message,true);}
}

function plannerProjectLegend(data) {
  const projects = new Map();
  for (const entry of [...(data.entries || []), ...(data.cross_project_entries || []),...(data.proposed_entries||[])]) {
    const id = Number(entry.project_id || state.me.current_project?.id || 0);
    if (!projects.has(id)) projects.set(id, { code: entry.project_short_code || entry.project_code || state.me.current_project?.planner_short_code || state.me.current_project?.code || 'Projekt', name: entry.project_name || '', color: safeProjectColor(entry.project_color || state.me.current_project?.planner_color) });
  }
  return [...projects.values()].map(project => `<span class="project-color-key" title="${escapeHtml(project.name || project.code)}" style="${projectColorStyle(project.color)}"><i></i>${escapeHtml(project.code)}</span>`).join('');
}

function loadPlannerFilters() {
  try {
    const saved = JSON.parse(localStorage.getItem(`planner-filters:${state.me?.id || 0}:${state.me?.current_project?.id || 0}`) || '{}');
    for (const key of Object.keys(state.plannerFilters)) state.plannerFilters[key] = Array.isArray(saved[key]) ? saved[key].map(String) : [];
  } catch { /* ustawienia lokalne są opcjonalne */ }
}

function savePlannerFilters() {
  localStorage.setItem(`planner-filters:${state.me?.id || 0}:${state.me?.current_project?.id || 0}`, JSON.stringify(state.plannerFilters));
}

function plannerEntryMatchesFilters(entry) {
  const filters=state.plannerFilters; const transport=entry.transport_mode==='transport_only'||entry.activity_type==='transport';
  if(filters.projects.length && !transport && !filters.projects.includes(String(entry.project_id||state.me.current_project?.id))) return false;
  if(filters.modes.length && (transport || !filters.modes.includes(entry.work_mode||'online'))) return false;
  if(filters.shifts.length && (transport || !filters.shifts.includes(entry.shift||'Dzień'))) return false;
  if(filters.activities.length){ const activity=transport?'transport':'work'; if(!filters.activities.includes(activity)) return false; }
  return true;
}

function plannerFilteredData(data) {
  const userFilter=new Set(state.plannerFilters.users.map(Number));
  const users=(data.users||[]).filter(user=>!userFilter.size||userFilter.has(Number(user.id)));
  const userIds=new Set(users.map(user=>Number(user.id)));
  const official=[...(data.entries||[]),...(data.cross_project_entries||[])].filter(entry=>userIds.has(Number(entry.user_id)));
  const proposed=(data.proposed_entries||[]).filter(entry=>userIds.has(Number(entry.user_id)));
  const categoryFiltersActive=['projects','modes','shifts','activities'].some(key=>state.plannerFilters[key].length);
  const filtersActive=state.plannerFilters.users.length||categoryFiltersActive;
  const absences=(data.absences||[]).filter(item=>userIds.has(Number(item.user_id)));
  const modeSummary=rows=>{const work=rows.filter(entry=>entry.transport_mode!=='transport_only'&&Number(entry.count_in_manpower)!==0);const todayRows=work.filter(entry=>entry.plan_date===today());return {today_online:new Set(todayRows.filter(entry=>entry.work_mode==='online').map(entry=>entry.user_id)).size,today_offline:new Set(todayRows.filter(entry=>entry.work_mode==='offline').map(entry=>entry.user_id)).size,online_planned_days:new Set(work.filter(entry=>entry.work_mode==='online').map(entry=>`${entry.user_id}:${entry.plan_date}`)).size,offline_planned_days:new Set(work.filter(entry=>entry.work_mode==='offline').map(entry=>`${entry.user_id}:${entry.plan_date}`)).size};};
  if(!filtersActive) return { users,entries:official,proposed,absences,summary:data.summary||[],mode:modeSummary(official),matchingEntries:official.filter(entry=>entry.transport_mode!=='transport_only'&&Number(entry.count_in_manpower)!==0) };
  const filterMatch=entry=>plannerEntryMatchesFilters(entry);
  const matchingDays=new Set(official.filter(filterMatch).map(entry=>`${entry.user_id}:${entry.plan_date}`));
  if(state.plannerFilters.users.length&&!categoryFiltersActive){official.forEach(entry=>matchingDays.add(`${entry.user_id}:${entry.plan_date}`));absences.forEach(item=>matchingDays.add(`${item.user_id}:${item.absence_date}`));}
  if(state.plannerFilters.activities.includes('vacation')) absences.filter(item=>item.absence_type==='vacation').forEach(item=>matchingDays.add(`${item.user_id}:${item.absence_date}`));
  if(state.plannerFilters.activities.includes('time_off')) absences.filter(item=>item.absence_type==='time_off').forEach(item=>matchingDays.add(`${item.user_id}:${item.absence_date}`));
  const entries=official.filter(entry=>matchingDays.has(`${entry.user_id}:${entry.plan_date}`));
  const matching=official.filter(filterMatch).filter(entry=>entry.transport_mode!=='transport_only'&&Number(entry.count_in_manpower)!==0);
  const byDate=new Map(); for(const entry of matching){ if(!byDate.has(entry.plan_date))byDate.set(entry.plan_date,[]);byDate.get(entry.plan_date).push(entry); }
  const summary=[...byDate].map(([plan_date,rows])=>({plan_date,headcount:new Set(rows.map(row=>row.user_id)).size,online_headcount:new Set(rows.filter(row=>row.work_mode==='online').map(row=>row.user_id)).size,offline_headcount:new Set(rows.filter(row=>row.work_mode==='offline').map(row=>row.user_id)).size}));
  return { users,entries,proposed:proposed.filter(entry=>matchingDays.has(`${entry.user_id}:${entry.plan_date}`)||plannerEntryMatchesFilters(entry)),absences:absences.filter(item=>matchingDays.has(`${item.user_id}:${item.absence_date}`)),summary,mode:modeSummary(matching),matchingEntries:matching };
}

function plannerFilterBar(data) {
  const projects=(data.assignment_projects||[]).filter(project=>[...(data.entries||[]),...(data.cross_project_entries||[])].some(entry=>Number(entry.project_id)===Number(project.id))||Number(project.id)===Number(state.me.current_project?.id));
  const select=(key,label,options)=>`<label>${label}<select multiple data-planner-filter="${key}">${options.map(option=>`<option value="${escapeHtml(option.value)}" ${state.plannerFilters[key].includes(String(option.value))?'selected':''}>${escapeHtml(option.label)}</option>`).join('')}</select></label>`;
  return `<details class="planner-filter-bar"><summary>Filtry widoku${Object.values(state.plannerFilters).some(values=>values.length)?' · aktywne':''}</summary><div>${select('users','Pracownicy',(data.users||[]).map(user=>({value:user.id,label:user.display_name})))}${select('projects','Projekty',projects.map(project=>({value:project.id,label:project.planner_short_code||project.code})))}${select('modes','Tryb',[{value:'online',label:'ON'},{value:'offline',label:'OFF'}])}${select('shifts','Zmiana',[{value:'Dzień',label:'Dzień'},{value:'Noc',label:'Noc'}])}${select('activities','Aktywność',[{value:'work',label:'Praca'},{value:'transport',label:'Transport'},{value:'vacation',label:'Urlop'},{value:'time_off',label:'Wolne'}])}<button type="button" class="mini" id="planner-filter-clear">Wyczyść wszystkie filtry</button></div></details>`;
}

function renderPlanner() {
  queueMicrotask(decorateUnifiedWorkspace);
  const previousPlannerScroll = $('.planner-scroll');
  if (previousPlannerScroll) { state.plannerScrollLeft = previousPlannerScroll.scrollLeft; state.plannerScrollTop = previousPlannerScroll.scrollTop; }
  const data = state.planner || { users: [], entries: [], work: [], summary: [], area_summary: [], shift_summary: [] };
  if (!state.plannerFiltersLoaded) { loadPlannerFilters(); state.plannerFiltersLoaded = true; }
  const filtered = plannerFilteredData(data);
  if (state.plannerRequirementEdit && (state.requirementData?.source !== data || state.requirementFrom !== state.plannerFrom || state.requirementDays !== state.plannerDays)) prepareInlinePlannerRequirements();
  const days = dateRange(state.plannerFrom, addDays(state.plannerFrom, state.plannerDays - 1));
  const entryMap = new Map();
  for (const entry of [...filtered.entries, ...filtered.proposed]) { const key = `${entry.user_id}:${entry.plan_date}`; if (!entryMap.has(key)) entryMap.set(key, []); entryMap.get(key).push(entry); }
  const workMap = new Map((data.work || []).map(item => [`${item.user_id}:${item.work_date}`, item]));
  const absenceMap = new Map((filtered.absences || []).map(item => [`${item.user_id}:${item.absence_date}`, item]));
  const timeMap = new Map((data.time_details?.details || []).map(item => [`${item.user_id}:${item.date}`, item]));
  const holidayMap = new Map((data.holidays || []).map(item => [item.holiday_date, item]));
  const overlapMap = new Map((data.overlap_reviews || []).map(item => [`${item.user_id}:${item.plan_date}`, item]));
  const summaryMap = new Map((filtered.summary || []).map(item => [item.plan_date, item]));
  const mode = filtered.mode || {};
  const detailed = state.plannerDetailedView;
  const lock=data.planner_lock; const ownLock=lock&&Number(lock.locked_by)===Number(state.me.id);
  $('#content').innerHTML = `<section class="planner-command compact ${data.raw_plan ? 'raw-mode' : ''}"><div class="planner-controls"><button class="mini planner-shift" data-days="-${state.plannerDays}">←</button><button class="mini" id="planner-today">Dzisiaj</button><button class="mini planner-shift" data-days="${state.plannerDays}">→</button><label>Zakres <select id="planner-days"><option value="7">7 dni</option><option value="14">14 dni</option><option value="28">28 dni</option><option value="31">31 dni</option><option value="90">Kwartał</option><option value="365">Rok</option></select></label><label class="planner-detail-toggle"><input type="checkbox" id="planner-detail-toggle" ${detailed ? 'checked' : ''}> Pokaż szczegóły</label>${detailed ? `<span class="planner-detail-options"><button type="button" class="mini ${state.plannerShowHours ? 'active-toggle' : ''}" id="planner-show-hours" aria-pressed="${state.plannerShowHours}">Pokaż godziny</button><button type="button" class="mini ${state.plannerShowAreas ? 'active-toggle' : ''}" id="planner-show-areas" aria-pressed="${state.plannerShowAreas}">Pokaż przypisanie obszarów</button></span>` : ''}${['project_admin', 'system_admin'].includes(state.me.role) ? '<button class="mini" id="planner-participants">Uczestnicy Plannera</button>' : ''}${data.can_manage_requirements ? `<button class="mini requirement-button ${state.plannerRequirementEdit ? 'active-toggle' : ''}" id="planner-requirements-open" aria-pressed="${state.plannerRequirementEdit}">Zapotrzebowanie${state.requirementDirty.size ? ` · ${state.requirementDirty.size}` : ''}</button><button class="mini" id="planner-config-open">Konfiguracja</button>` : ''}${data.can_manage_time ? '<button class="mini" id="planner-hours-open">Czas pracy i nadgodziny</button>' : ''}${canCoordinate() ? `<button class="mini ${ownLock?'active-toggle':''}" id="planner-checkout">${ownLock?'Zaewidencjonuj':'Wyewidencjonuj'}</button><button class="mini" id="planner-snapshots">Snapshoty</button><button class="mini ${data.information_queue?.some(item=>item.status==='pending')?'warning-toggle':''}" id="planner-information">Zmiany do przekazania · ${(data.information_queue||[]).filter(item=>item.status==='pending').length}</button>${data.raw_plan?'':`<button class="mini" id="planner-undo" ${state.plannerUndoStack.length?'':'disabled'} title="Cofnij własną zmianę planu produkcyjnego">↶ Cofnij</button><button class="mini" id="planner-redo" ${state.plannerRedoStack.length?'':'disabled'} title="Ponów własną zmianę planu produkcyjnego">↷ Ponów</button>`}<button class="mini planner-tools-toggle ${state.plannerToolsVisible ? 'active-toggle' : ''}" id="planner-tools-toggle" aria-expanded="${state.plannerToolsVisible}">${state.plannerToolsVisible ? 'Ukryj narzędzia' : 'Pokaż narzędzia'}</button>${plannerRawControls()}` : ''}<span>${displayDate(days[0])} – ${displayDate(days.at(-1))}</span></div>${lock&&!ownLock?`<div class="planner-lock-banner">Plan projektu wyewidencjonował(a) <b>${escapeHtml(lock.locked_by_name)}</b>. Pozostali użytkownicy mają dostęp tylko do odczytu.</div>`:''}${data.raw_plan ? `<div class="planner-raw-banner"><b>PRYWATNY RAW · ${escapeHtml(data.raw_plan.name)}</b><span>Zmiany: ${data.raw_changes?.length || 0} · plan produkcyjny pozostaje bez zmian do publikacji</span></div>` : ''}<div class="planner-summary mode-summary"><span><b>${filtered.summary?.find(item => item.plan_date === today())?.headcount || 0}</b> osób dzisiaj</span>${detailed ? `<span class="online"><b>${mode.today_online || 0}</b> ON · fabryka<small>${mode.online_planned_days || 0} zaplanowanych dni</small></span><span class="offline"><b>${mode.today_offline || 0}</b> OFF · biuro<small>${mode.offline_planned_days || 0} zaplanowanych dni</small></span>` : ''}<span><b>${filtered.users.length}</b> uczestników</span>${detailed && state.plannerShowHours && data.can_manage_time ? `<span><b>${(data.time_details?.users || []).filter(item=>filtered.users.some(user=>user.id===item.user_id)).reduce((sum, item) => sum + item.actual_hours + item.credited_hours, 0).toFixed(1)}</b> h pracy w zakresie</span><span><b>${(data.time_details?.users || []).filter(item=>filtered.users.some(user=>user.id===item.user_id)).reduce((sum, item) => sum + Number(item.travel_hours || 0), 0).toFixed(1)}</b> h podróży służbowych</span>` : ''}${detailed ? (data.shift_summary || []).map(item => `<span><b>${item.assignments}</b> ${escapeHtml(item.shift)}</span>`).join('') : ''}</div></section>${plannerFilterBar(data)}
  ${canCoordinate() ? plannerBulkToolbar() : ''}
  ${canCoordinate() && detailed ? plannerCrossProjectRequestsHtml(data.incoming_cross_project_requests || [], data.outgoing_cross_project_requests || []) : ''}
  ${plannerUnifiedSection(filtered.users, days, entryMap, workMap, summaryMap, data.area_day_summary || [], data.can_manage_requirements, absenceMap, timeMap, holidayMap, detailed && state.plannerShowHours && data.can_manage_time, overlapMap, detailed ? data.annotations || [] : [], detailed, filtered.matchingEntries || [])}
  <p class="planner-legend">${detailed ? '<span class="mode-dot online"></span> praca online <span class="offline-texture-key"></span> praca offline ' : ''}<span class="transport-color-key"></span> T · transport <span class="vacation-color-key"></span> urlop <span class="time-off-color-key"></span> wolne ${detailed ? '<span class="night-shift-key"></span> zmiana nocna ' : ''}${plannerProjectLegend(data)}${detailed ? ' <span class="workload-dot"></span> zadania / punkty / status / notatki' : ''}${detailed && data.can_manage_requirements ? '<span class="requirement-shortage-key"></span> obsada poniżej zapotrzebowania' : ''}</p>`;
  $('#content').classList.toggle('planner-hide-areas', !detailed || !state.plannerShowAreas);
  $('#planner-days').value = String(state.plannerDays);
  $('#planner-days').addEventListener('change', async event => { state.plannerDays = Number(event.target.value); state.plannerScrollLeft = 0; state.plannerScrollTop = 0; clearPlannerSelections(false); await reloadPlanner(); });
  $$('.planner-shift').forEach(button => button.addEventListener('click', async () => { state.plannerFrom = addDays(state.plannerFrom, Number(button.dataset.days)); state.plannerScrollLeft = 0; state.plannerScrollTop = 0; clearPlannerSelections(false); await reloadPlanner(); }));
  $('#planner-today').addEventListener('click', async () => { state.plannerFrom = mondayOf(today()); state.plannerScrollLeft = 0; state.plannerScrollTop = 0; clearPlannerSelections(false); await reloadPlanner(); });
  $('#planner-participants')?.addEventListener('click', openPlannerParticipants);
  $('#planner-detail-toggle')?.addEventListener('change', event => { state.plannerDetailedView = event.target.checked; renderPlanner(); });
  $('#planner-show-hours')?.addEventListener('click', () => { state.plannerShowHours = !state.plannerShowHours; renderPlanner(); });
  $('#planner-show-areas')?.addEventListener('click', () => { state.plannerShowAreas = !state.plannerShowAreas; renderPlanner(); });
  $('#planner-requirements-open')?.addEventListener('click', togglePlannerRequirementsEditor);
  $('#planner-config-open')?.addEventListener('click', () => openConfigPanel('planner'));
  $('#planner-hours-open')?.addEventListener('click', openPlannerHours);
  $('#planner-checkout')?.addEventListener('click', togglePlannerCheckout);
  $('#planner-snapshots')?.addEventListener('click', openPlannerSnapshots);
  $('#planner-information')?.addEventListener('click', openPlannerInformationQueue);
  $('#planner-undo')?.addEventListener('click', () => replayPlannerAction('undo'));
  $('#planner-redo')?.addEventListener('click', () => replayPlannerAction('redo'));
  $$('[data-planner-filter]').forEach(select=>select.addEventListener('change',()=>{state.plannerFilters[select.dataset.plannerFilter]=[...select.selectedOptions].map(option=>option.value);savePlannerFilters();renderPlanner();}));
  $('#planner-filter-clear')?.addEventListener('click',()=>{for(const key of Object.keys(state.plannerFilters))state.plannerFilters[key]=[];savePlannerFilters();renderPlanner();});
  $('#planner-tools-toggle')?.addEventListener('click', () => { state.plannerToolsVisible = !state.plannerToolsVisible; renderPlanner(); });
  $('#planner-raw-select')?.addEventListener('change', async event => {
    state.plannerRawPlanId = Number(event.target.value) || null;
    const plan = state.plannerRawPlans.find(item => Number(item.id) === Number(state.plannerRawPlanId));
    if (plan) {
      state.plannerFrom = plan.from_date;
      state.plannerDays = Math.min(365, Math.max(7, Math.round((new Date(`${plan.to_date}T12:00:00Z`) - new Date(`${plan.from_date}T12:00:00Z`)) / 86400000) + 1));
      state.plannerScrollLeft = 0; state.plannerScrollTop = 0;
    }
    await reloadPlanner();
  });
  $('#planner-raw-new')?.addEventListener('click', createPlannerRawPlan);
  $('#planner-raw-range')?.addEventListener('click', editPlannerRawRange);
  $('#planner-raw-compare')?.addEventListener('click', comparePlannerRawPlan);
  $('#planner-raw-publish')?.addEventListener('click', publishPlannerRawPlan);
  $('#planner-raw-delete')?.addEventListener('click', deletePlannerRawPlan);
  $$('[data-planner-cross-project-action]').forEach(button => button.addEventListener('click', () => reviewPlannerCrossProjectRequest(Number(button.dataset.requestId), button.dataset.plannerCrossProjectAction)));
  $$('[data-requirement-project-toggle]').forEach(button => button.addEventListener('click', () => {
    const projectId = Number(button.dataset.requirementProjectToggle);
    if (state.plannerCollapsedRequirementProjects.has(projectId)) state.plannerCollapsedRequirementProjects.delete(projectId); else state.plannerCollapsedRequirementProjects.add(projectId);
    renderPlanner();
  }));
  $$('[data-planner-user-header]').forEach(header=>header.addEventListener('click',event=>{const id=Number(header.dataset.plannerUserHeader);if(!event.ctrlKey&&!event.metaKey)state.plannerHighlightedUsers.clear();if(state.plannerHighlightedUsers.has(id))state.plannerHighlightedUsers.delete(id);else state.plannerHighlightedUsers.add(id);renderPlanner();}));
  $$('[data-planner-date-header]').forEach(header=>header.addEventListener('click',event=>{const date=header.dataset.plannerDateHeader;if(!event.ctrlKey&&!event.metaKey)state.plannerHighlightedDates.clear();if(state.plannerHighlightedDates.has(date))state.plannerHighlightedDates.delete(date);else state.plannerHighlightedDates.add(date);renderPlanner();}));
  $$('[data-planner-history-user]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();openPlannerDayHistory(Number(button.dataset.plannerHistoryUser),button.dataset.plannerHistoryDate);}));
  if (canCoordinate()) {
    state.plannerSelectionAbort?.abort(); state.plannerSelectionAbort = new AbortController();
    const selectionSignal = state.plannerSelectionAbort.signal;
    let rectangleStart = null; let rectangleBaseSelection = null; let selectingRectangle = false;
    $$('.planner-cell').forEach(cell => {
      cell.addEventListener('pointerdown', event => {
        if (event.button !== 0 || cell.dataset.editable !== '1' || event.target.closest('.plan-chip,.absence-chip,.planner-cell-expand,[data-overlap-action]')) return;
        event.preventDefault();
        const position = plannerCellGridPosition(cell);
        if ((event.ctrlKey || event.metaKey) && event.shiftKey) {
          rectangleStart = state.plannerSelectionAnchor || position; selectPlannerRectangle(rectangleStart, position); state.plannerSelectionAnchor = rectangleStart; return;
        }
        if (event.ctrlKey || event.metaKey) {
          if (state.plannerEntrySelection.size) { state.plannerEntrySelection.clear(); $$('.plan-chip.entry-selected').forEach(chip => chip.classList.remove('entry-selected')); }
          rectangleBaseSelection = new Set(state.plannerSelection); rectangleStart = position; state.plannerSelectionAnchor = position; selectingRectangle = true; selectPlannerRectangle(rectangleStart, position, rectangleBaseSelection); return;
        }
        if (event.shiftKey) {
          rectangleStart = state.plannerSelectionAnchor || position; selectingRectangle = true; selectPlannerRectangle(rectangleStart, position); state.plannerSelectionAnchor = rectangleStart; return;
        }
        clearPlannerSelections(false); setPlannerCellSelected(cell, true); state.plannerSelectionAnchor = position;
      });
      cell.addEventListener('pointerenter', event => { if (selectingRectangle && (event.buttons & 1) && cell.dataset.editable === '1') selectPlannerRectangle(rectangleStart, plannerCellGridPosition(cell), rectangleBaseSelection); });
      cell.addEventListener('click', event => { if (cell.dataset.editable === '1' && !event.target.closest('[data-overlap-action]')) event.preventDefault(); });
      cell.addEventListener('dblclick', event => {
        if (cell.dataset.editable !== '1' || event.target.closest('[data-overlap-action]')) return;
        event.preventDefault();
        if (!cell.classList.contains('planned') && !cell.classList.contains('absent')) {
          clearPlannerSelections(false);
          state.plannerSelection.add(plannerSelectionKey(cell.dataset.userId, cell.dataset.date));
          cell.classList.add('multi-selected'); updatePlannerBulkCount();
          addWorkToPlannerSelection();
          return;
        }
        openPlannerCell(Number(cell.dataset.userId), cell.dataset.date);
      });
      cell.addEventListener('contextmenu', event => {
        const chip = event.target.closest('.plan-chip');
        showPlannerContext(event, Number(cell.dataset.userId), cell.dataset.date, plannerChipEntryIds(chip), Number(chip?.dataset.projectId || state.me.current_project?.id));
      });
      cell.addEventListener('dragover', event => { if (cell.dataset.editable !== '1') return; event.preventDefault(); cell.classList.add('drag-over'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', event => dropPlannerEntry(event, cell));
    });
    document.addEventListener('pointermove', event => {
      if (!selectingRectangle || !(event.buttons & 1)) return;
      const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.planner-cell');
      if (cell?.dataset.editable === '1') selectPlannerRectangle(rectangleStart, plannerCellGridPosition(cell), rectangleBaseSelection);
      event.preventDefault();
    }, { signal: selectionSignal });
    document.addEventListener('pointerup', () => {
      $$('[data-shift-drag-disabled]').forEach(item => { item.draggable = true; delete item.dataset.shiftDragDisabled; });
      selectingRectangle = false; rectangleStart = null; rectangleBaseSelection = null; updatePlannerBulkCount();
    }, { signal: selectionSignal });
    bindPlannerBulkToolbar();
    $$('.plan-chip[draggable="true"]').forEach(chip => {
      chip.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.stopPropagation();
        if (event.shiftKey) {
          event.preventDefault();
          const cell = chip.closest('.planner-cell');
          chip.draggable = false; chip.dataset.shiftDragDisabled = '1';
          clearPlannerSelections(false); rectangleStart = plannerCellGridPosition(cell); selectingRectangle = true;
          selectPlannerRectangle(rectangleStart, rectangleStart); return;
        }
        const ids = plannerChipEntryIds(chip); const id = ids[0]; const additive = event.ctrlKey || event.metaKey;
        const selected = ids.length && ids.every(entryId => state.plannerEntrySelection.has(entryId));
        if (!additive && !selected) clearPlannerSelections(false);
        else if (state.plannerSelection.size) { state.plannerSelection.clear(); $$('.planner-cell.multi-selected').forEach(cell => cell.classList.remove('multi-selected')); }
        setPlannerEntrySelected(chip, additive ? !selected : true);
      });
      chip.addEventListener('dragstart', event => { if (event.shiftKey || selectingRectangle) return event.preventDefault(); state.plannerDragging = true; state.plannerDragEntry = Number(chip.dataset.entryId); event.dataTransfer.effectAllowed = 'copyMove'; event.dataTransfer.setData('text/planner-entry', chip.dataset.entryId); chip.classList.add('dragging'); });
      chip.addEventListener('dragend', () => { state.plannerDragEntry = null; chip.classList.remove('dragging'); $$('.planner-cell').forEach(cell => cell.classList.remove('drag-over')); setTimeout(() => { state.plannerDragging = false; }, 0); });
    });
    $$('.absence-chip[draggable="true"]').forEach(chip => {
      chip.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        event.stopPropagation();
        const cell = chip.closest('.planner-cell');
        if (event.shiftKey) {
          event.preventDefault();
          chip.draggable = false; chip.dataset.shiftDragDisabled = '1';
          clearPlannerSelections(false); rectangleStart = plannerCellGridPosition(cell); selectingRectangle = true;
          selectPlannerRectangle(rectangleStart, rectangleStart); return;
        }
        const additive = event.ctrlKey || event.metaKey;
        if (!additive) clearPlannerSelections(false);
        else if (state.plannerEntrySelection.size) { state.plannerEntrySelection.clear(); $$('.plan-chip.entry-selected').forEach(item => item.classList.remove('entry-selected')); }
        setPlannerCellSelected(cell, additive ? !state.plannerSelection.has(plannerSelectionKey(cell.dataset.userId, cell.dataset.date)) : true);
      });
      chip.addEventListener('dblclick', event => { event.preventDefault(); event.stopPropagation(); const cell = chip.closest('.planner-cell'); openPlannerCell(Number(cell.dataset.userId), cell.dataset.date); });
      chip.addEventListener('dragstart', event => { if (event.shiftKey || selectingRectangle) return event.preventDefault(); state.plannerDragging = true; const cell = chip.closest('.planner-cell'); state.plannerDragDay = { userId: Number(cell.dataset.userId), date: cell.dataset.date }; event.dataTransfer.effectAllowed = 'copyMove'; event.dataTransfer.setData('text/planner-day', JSON.stringify(state.plannerDragDay)); chip.classList.add('dragging'); });
      chip.addEventListener('dragend', () => { state.plannerDragDay = null; chip.classList.remove('dragging'); $$('.planner-cell').forEach(cell => cell.classList.remove('drag-over')); setTimeout(() => { state.plannerDragging = false; }, 0); });
    });
    $$('[data-overlap-action]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); decidePlannerOverlap(Number(button.dataset.userId), button.dataset.date, button.dataset.overlapAction); }));
  }
  $$('.plan-chip').forEach(chip => {
    chip.ondblclick = event => {
      event.preventDefault(); event.stopPropagation();
      const cell = chip.closest('.planner-cell');
      if (cell && canCoordinate()) openPlannerCell(Number(cell.dataset.userId), cell.dataset.date, Number(chip.dataset.projectId));
    };
  });
  $$('[data-planner-expand]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    const key = button.dataset.plannerExpand; const cell = button.closest('.planner-cell');
    const expanded = !state.plannerExpandedCells.has(key);
    if (expanded) state.plannerExpandedCells.add(key); else state.plannerExpandedCells.delete(key);
    cell.classList.toggle('entries-expanded', expanded);
    cell.querySelectorAll('[data-planner-extra]').forEach(chip => { chip.hidden = !expanded; });
    button.textContent = expanded ? 'Zwiń' : `+${cell.querySelectorAll('[data-planner-extra]').length}`;
    button.setAttribute('aria-expanded', String(expanded));
  }));
  const plannerScroll = $('.planner-scroll');
  if (plannerScroll) { plannerScroll.scrollLeft = state.plannerScrollLeft; plannerScroll.scrollTop = state.plannerScrollTop; }
  if (state.plannerRequirementEdit) bindInlinePlannerRequirements();
}

function plannerSelectionKey(userId, date) { return `${Number(userId)}:${date}`; }

function plannerCellGridPosition(cell) {
  const cells = $$('.planner-table tbody tr .planner-cell');
  const columns = Math.max(1, dateRange(state.plannerFrom, addDays(state.plannerFrom, state.plannerDays - 1)).length);
  const index = cells.indexOf(cell);
  return { row: Math.floor(index / columns), column: index % columns };
}

function selectPlannerRectangle(anchor, focus, baseSelection = null) {
  if (!anchor || !focus) return;
  const top = Math.min(anchor.row, focus.row); const bottom = Math.max(anchor.row, focus.row); const left = Math.min(anchor.column, focus.column); const right = Math.max(anchor.column, focus.column);
  state.plannerSelection = new Set(baseSelection || []); state.plannerEntrySelection.clear();
  $$('.planner-table tbody tr .planner-cell').forEach(cell => {
    const position = plannerCellGridPosition(cell);
    const key = plannerSelectionKey(cell.dataset.userId, cell.dataset.date);
    const selected = cell.dataset.editable === '1' && (state.plannerSelection.has(key) || position.row >= top && position.row <= bottom && position.column >= left && position.column <= right);
    cell.classList.toggle('multi-selected', selected);
    if (selected) state.plannerSelection.add(key);
  });
  $$('.plan-chip.entry-selected').forEach(chip => chip.classList.remove('entry-selected'));
  updatePlannerBulkCount();
}

function plannerClipboardLabel() {
  if (!state.plannerClipboard) return 'zawartość';
  if (state.plannerClipboard.kind === 'day') return 'skopiowany dzień';
  if (state.plannerClipboard.kind === 'days') return `${state.plannerClipboard.days?.length || 0} skopiowanych dni`;
  return state.plannerClipboard.entries?.length === 1 ? 'skopiowaną aktywność' : `${state.plannerClipboard.entries?.length || 0} skopiowanych aktywności`;
}

function plannerBulkToolbar() {
  const hidden = !state.plannerToolsVisible;
  const collisionHidden = plannerSelectionOverlapReviews().length ? '' : 'hidden';
  return `<section class="planner-bulk-toolbar ${hidden ? 'hidden' : ''}" id="planner-bulk-toolbar"><span><b id="planner-selection-count">${state.plannerSelection.size}</b> dni · <b id="planner-entry-selection-count">${state.plannerEntrySelection.size}</b> aktywności</span><button type="button" class="primary" id="planner-bulk-add" title="Skrót: P">+ Praca</button><button type="button" class="mini" id="planner-bulk-transport" title="Skrót: T">+Transport</button><button type="button" class="mini" id="planner-bulk-time-off" title="Wolne z nadgodzin · skrót: W">+ Wolne</button><button type="button" class="mini" id="planner-bulk-vacation" title="Urlop płatny · skrót: U">+ Urlop</button><button type="button" class="mini" id="planner-bulk-copy">Kopiuj zaznaczenie</button><button type="button" class="mini" id="planner-bulk-paste" ${state.plannerClipboard ? '' : 'disabled'}>Wklej ${plannerClipboardLabel()}</button><button type="button" class="mini ${collisionHidden}" id="planner-bulk-approve">✓ Zatwierdź kolizje</button><button type="button" class="mini" id="planner-selection-clear">Wyczyść zaznaczenie</button></section>`;
}

function plannerCrossProjectRequestsHtml(incoming, outgoing) {
  if (!incoming.length && !outgoing.length) return '';
  const grouped = new Map();
  incoming.forEach(item => { const key = String(item.user_id); if (!grouped.has(key)) grouped.set(key, { ...item, days: [] }); grouped.get(key).days.push(item); });
  const rows = [...grouped.values()].map(group => `<article class="planner-cross-project-row incoming"><span><b>${escapeHtml(group.display_name)}</b><small>${group.days.length} ${group.days.length === 1 ? 'dzień' : 'dni'} do potwierdzenia</small></span><div class="planner-approval-days">${group.days.map(item => `<span class="planner-approval-day"><b>${displayDate(item.plan_date)}</b><small>${escapeHtml(item.source_project_code)} · plan pracy · ${Number(item.linked_entry_count) || 1} poz.</small><button type="button" class="mini primary" data-planner-cross-project-action="approve" data-request-id="${item.id}" title="Potwierdź ten dzień">✓</button><button type="button" class="mini danger-outline" data-planner-cross-project-action="reject" data-request-id="${item.id}" title="Odrzuć ten dzień">×</button></span>`).join('')}</div></article>`).join('');
  return `<details class="planner-cross-project-requests"><summary><span><b>Dni do potwierdzenia</b><small>Oficjalny plan × pozostaje liczony do czasu akceptacji propozycji ?. Ostatnia propozycja zastępuje wcześniejszą.</small></span><strong>${incoming.length} do decyzji${outgoing.length ? ` · ${outgoing.length} oczekuje w innych projektach` : ''}</strong></summary>${incoming.length ? `<div class="planner-cross-project-list">${rows}</div>` : '<p class="sub">Brak dni wymagających Twojej decyzji.</p>'}</details>`;
}

async function reviewPlannerCrossProjectRequest(id, action) {
  if (action === 'reject' && !await uiConfirm('Odrzuć przypisanie międzyprojektowe', 'Plan pracy utworzony przez managera innego projektu zostanie usunięty z tego dnia. Transport pozostanie bez zmian.', 'Odrzuć', true)) return;
  try {
    await api(`/api/planner/cross-project-requests/${id}/action`, { method: 'POST', body: JSON.stringify({ action }) });
    toast(action === 'approve' ? 'Dzień został potwierdzony' : 'Przypisanie zostało odrzucone');
    await reloadPlanner();
  } catch (error) { toast(error.message, true); }
}

function setPlannerCellSelected(cell, selected) {
  const key = plannerSelectionKey(cell.dataset.userId, cell.dataset.date);
  if (selected) state.plannerSelection.add(key); else state.plannerSelection.delete(key);
  cell.classList.toggle('multi-selected', selected);
  updatePlannerBulkCount();
}

function setPlannerEntrySelected(chip, selected) {
  const ids = plannerChipEntryIds(chip);
  ids.forEach(id => { if (selected) state.plannerEntrySelection.add(id); else state.plannerEntrySelection.delete(id); });
  chip.classList.toggle('entry-selected', selected);
  updatePlannerBulkCount();
}

function clearPlannerSelections(update = true) {
  state.plannerSelection.clear(); state.plannerEntrySelection.clear();
  state.plannerSelectionAnchor = null;
  $$('.planner-cell.multi-selected').forEach(cell => cell.classList.remove('multi-selected'));
  $$('.plan-chip.entry-selected').forEach(chip => chip.classList.remove('entry-selected'));
  if (update) updatePlannerBulkCount();
}

function selectedPlannerTargets() {
  return $$('.planner-cell[data-editable="1"]').filter(cell => state.plannerSelection.has(plannerSelectionKey(cell.dataset.userId, cell.dataset.date))).map(cell => {
    const key = plannerSelectionKey(cell.dataset.userId, cell.dataset.date);
    const separator = key.indexOf(':'); return { userId: Number(key.slice(0, separator)), date: key.slice(separator + 1) };
  });
}

function selectedPlannerEntries() {
  const selected = state.plannerEntrySelection;
  return allPlannerEntries().filter(entry => selected.has(Number(entry.id)));
}

function allPlannerEntries() {
  return [...(state.planner?.entries || []), ...(state.planner?.cross_project_entries || [])];
}

function plannerEntryProjectId(entry) {
  return Number(entry?.project_id || state.me.current_project?.id || 0);
}

function plannerProjectDayEntries(projectId, userId, date) {
  return allPlannerEntries().filter(entry => plannerEntryProjectId(entry) === Number(projectId) && Number(entry.user_id) === Number(userId) && entry.plan_date === date);
}

function plannerSelectionOverlapReviews() {
  const keys = new Set(state.plannerSelection);
  selectedPlannerEntries().forEach(entry => keys.add(plannerSelectionKey(entry.user_id, entry.plan_date)));
  return (state.planner?.overlap_reviews || []).filter(item => item.status === 'pending' && keys.has(plannerSelectionKey(item.user_id, item.plan_date)));
}

function updatePlannerBulkCount() {
  const dayCount = state.plannerSelection.size; const entryCount = state.plannerEntrySelection.size;
  if ($('#planner-selection-count')) $('#planner-selection-count').textContent = String(dayCount);
  if ($('#planner-entry-selection-count')) $('#planner-entry-selection-count').textContent = String(entryCount);
  ['#planner-bulk-add', '#planner-bulk-transport', '#planner-bulk-time-off', '#planner-bulk-vacation'].forEach(selector => { const button = $(selector); if (button) button.disabled = !dayCount; });
  if ($('#planner-bulk-approve')) $('#planner-bulk-approve').classList.toggle('hidden', !plannerSelectionOverlapReviews().length);
  if ($('#planner-bulk-copy')) $('#planner-bulk-copy').disabled = !dayCount && !entryCount;
  if ($('#planner-bulk-paste')) { $('#planner-bulk-paste').disabled = !dayCount || !state.plannerClipboard; $('#planner-bulk-paste').textContent = `Wklej ${plannerClipboardLabel()}`; }
}

function plannerDefaultTransportMinutes() {
  const configured = Number(state.config.settings?.planner_offline_hours || 8);
  return Math.max(1, Math.round((Number.isFinite(configured) && configured > 0 ? configured : 8) * 60));
}

function plannerTransportMinutes(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.max(1, Math.round(numeric * 60)) : 0;
}

function plannerTransportParts(value) {
  const totalMinutes = plannerTransportMinutes(value) || plannerDefaultTransportMinutes();
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

function plannerTransportHoursFromParts(hoursValue, minutesValue) {
  const hours = Number(hoursValue); const minutes = Number(minutesValue);
  if (!Number.isInteger(hours) || hours < 0 || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;
  const totalMinutes = hours * 60 + minutes;
  return Number.isSafeInteger(totalMinutes) && totalMinutes > 0 ? totalMinutes / 60 : null;
}

function formatPlannerTransportDuration(value) {
  const totalMinutes = plannerTransportMinutes(value);
  if (!totalMinutes) return '0 min';
  const hours = Math.floor(totalMinutes / 60); const minutes = totalMinutes % 60;
  return [hours ? `${hours} h` : '', minutes ? `${minutes} min` : ''].filter(Boolean).join(' ');
}

function plannerEntryPayload(entry) {
  const activity = entry.activity_type || (entry.transport_mode === 'transport_only' ? 'transport' : 'work');
  const durationMinutes = activity === 'transport' ? plannerTransportMinutes(entry.duration_hours) || plannerDefaultTransportMinutes() : 0;
  return { controller_group_id: activity === 'work' ? Number(entry.controller_group_id) || null : null, activity_type: activity, work_mode: activity === 'work' ? (entry.work_mode || 'online') : 'offline', shift: activity === 'work' ? entry.shift || 'Dzień' : 'Dzień', transport_mode: activity === 'transport' ? 'transport_only' : 'none', duration_hours: activity === 'transport' ? durationMinutes / 60 : 0, allocated_hours: activity === 'work' && entry.allocated_hours !== '' && entry.allocated_hours !== null && entry.allocated_hours !== undefined ? Number(entry.allocated_hours) : null, count_in_manpower: activity === 'work' && Number(entry.count_in_manpower) === 0 ? 0 : 1, vehicle_id: activity === 'transport' ? Number(entry.vehicle_id) || null : null, allow_without_area: activity === 'work' && !entry.controller_group_id ? 1 : 0, note: entry.note || '' };
}

function uniquePlannerEntries(entries) {
  const seen = new Set();
  return (entries || []).map(plannerEntryPayload).filter(entry => { const key = `${entry.activity_type}:${entry.controller_group_id || 0}:${entry.work_mode}:${entry.shift}:${entry.duration_hours}:${entry.allocated_hours ?? ''}:${entry.count_in_manpower}:${entry.vehicle_id || 0}:${entry.note}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

function plannerWorkSignature(entries) {
  return JSON.stringify(uniquePlannerEntries(entries).filter(entry => entry.activity_type === 'work').map(entry => ({ controller_group_id: entry.controller_group_id || null, work_mode: entry.work_mode, shift: entry.shift, count_in_manpower: entry.count_in_manpower, note: entry.note || '' })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))));
}

async function saveForeignPlannerDay(projectId, userId, date, entries, originalEntries = plannerProjectDayEntries(projectId, userId, date)) {
  const project = plannerProjectConfig(projectId);
  if (!project) throw new Error('Projekt kafelka nie jest dostępny dla tej osoby');
  const normalized = uniquePlannerEntries(entries);
  if (state.plannerRawPlanId) return api(`/api/planner/raw-plans/${state.plannerRawPlanId}/day`, { method: 'PUT', body: JSON.stringify({ target_project_id: Number(projectId), user_id: Number(userId), plan_date: date, entries: normalized }) });
  const transportOnlyUpdate = !project.can_manage && plannerWorkSignature(normalized) === plannerWorkSignature(originalEntries);
  const submitted = transportOnlyUpdate ? normalized.filter(entry => entry.activity_type === 'transport') : normalized;
  return api('/api/planner/cross-project-requests', { method: 'POST', body: JSON.stringify({
    target_project_id: Number(projectId),
    items: [{ user_id: Number(userId), plan_date: date, entries: submitted, replace_all: transportOnlyUpdate ? 0 : 1, transport_only_update: transportOnlyUpdate ? 1 : 0 }]
  }) });
}

async function savePlannerProjectDay(projectId, userId, date, entries, originalEntries = plannerProjectDayEntries(projectId, userId, date)) {
  if (Number(projectId) !== Number(state.me.current_project?.id || 0)) return saveForeignPlannerDay(projectId, userId, date, entries, originalEntries);
  const day = plannerDaySnapshot(userId, date);
  const endpoint = state.plannerRawPlanId ? `/api/planner/raw-plans/${state.plannerRawPlanId}/day` : '/api/planner/day';
  return api(endpoint, { method: 'PUT', body: JSON.stringify({ ...plannerDayRequest({ userId, date }, entries, day), target_project_id: Number(projectId) }) });
}

function plannerDayRequest(target, entries, day = plannerDaySnapshot(target.userId, target.date)) {
  return { user_id: target.userId, plan_date: target.date, entries: uniquePlannerEntries(entries), absence_type: day.absence_type || '', absence_note: day.absence_note || '', day_comment: day.day_comment || '', actual_hours_adjustment: Number(day.actual_hours_adjustment || 0), overtime_raw_adjustment: Number(day.overtime_raw_adjustment || 0), overtime_weighted_adjustment: Number(day.overtime_weighted_adjustment || 0), work_start_time: day.work_start_time || '', work_end_time: day.work_end_time || '', overtime_raw_balance_override: day.overtime_raw_balance_override ?? null, overtime_weighted_balance_override: day.overtime_weighted_balance_override ?? null, adjustment_note: day.adjustment_note || '' };
}

async function savePlannerBulkRequests(requests, message) {
  if (!requests.length) return toast('Brak dni, do których można zastosować tę operację', true);
  const before = requests.map(request => plannerDayRequest({ userId: request.user_id, date: request.plan_date }, plannerDaySnapshot(request.user_id, request.plan_date).entries, plannerDaySnapshot(request.user_id, request.plan_date)));
  try {
    const endpoint = state.plannerRawPlanId ? `/api/planner/raw-plans/${state.plannerRawPlanId}/day` : '/api/planner/day';
    for (let index = 0; index < requests.length; index += 12) await Promise.all(requests.slice(index, index + 12).map(body => api(endpoint, { method: 'PUT', body: JSON.stringify(body) })));
    rememberPlannerAction(before, requests);
    state.plannerSelection.clear(); state.plannerEntrySelection.clear();
    toast(`${message} · ${requests.length} ${requests.length === 1 ? 'dzień' : 'dni'}`);
    await reloadPlanner();
  } catch (error) { toast(error.message, true); }
}

function rememberPlannerAction(before, after) {
  if (state.plannerRawPlanId || state.plannerHistoryReplaying) return;
  state.plannerUndoStack.push({ project_id: Number(state.me.current_project?.id || 0), before: structuredClone(before), after: structuredClone(after) });
  if (state.plannerUndoStack.length > 20) state.plannerUndoStack.shift();
  state.plannerRedoStack = [];
}

async function replayPlannerAction(direction) {
  if (state.plannerRawPlanId) return;
  const source = direction === 'undo' ? state.plannerUndoStack : state.plannerRedoStack;
  const target = direction === 'undo' ? state.plannerRedoStack : state.plannerUndoStack;
  const action = source.pop(); if (!action) return;
  if (Number(action.project_id) !== Number(state.me.current_project?.id || 0)) { source.push(action); return toast('Historia cofania dotyczy innego projektu', true); }
  state.plannerHistoryReplaying = true;
  try {
    const requests = direction === 'undo' ? action.before : action.after;
    for (const request of requests) await api('/api/planner/day', { method: 'PUT', body: JSON.stringify(request) });
    target.push(action); if (target.length > 20) target.shift();
    toast(direction === 'undo' ? 'Cofnięto ostatnią zmianę Plannera' : 'Ponowiono zmianę Plannera');
    await reloadPlanner();
  } catch (error) { source.push(action); toast(error.message, true); }
  finally { state.plannerHistoryReplaying = false; }
}

async function addWorkToPlannerSelection() {
  const targets = selectedPlannerTargets(); if (!targets.length) return;
  const selectedUserIds = [...new Set(targets.map(target => Number(target.userId)))];
  const currentProjectId = Number(state.me.current_project?.id || 0);
  const projects = (state.planner?.assignment_projects || []).filter(project => selectedUserIds.every(userId => (project.eligible_user_ids || []).map(Number).includes(userId)));
  if (!projects.length) return toast('Wybrane osoby nie mają wspólnego aktywnego projektu', true);
  const initialProject = projects.find(project => Number(project.id) === currentProjectId) || projects[0];
  const projectAreaOptions = project => (project.areas || []).map(area => ({ value: area.id, label: area.path_label || area.name }));
  const formPromise = uiForm({ title: `Dodaj pracę do ${targets.length} dni`, description: 'Wybierz projekt, w którym pracownik ma być zaplanowany. Jeśli jesteś jego managerem, zapis będzie bezpośredni; w przeciwnym razie plan pracy trafi do akceptacji managera projektu docelowego.', submitLabel: 'Dodaj do zaznaczenia', fields: [
    { name: 'target_project_id', label: 'Projekt', type: 'select', value: initialProject.id, options: projects.map(project => ({ value: project.id, label: `${project.code} · ${project.name}` })), full: true },
    { name: 'controller_group_ids', label: 'Obszary pracy', type: 'user-multiselect', options: projectAreaOptions(initialProject), emptyLabel: 'Bez konkretnego obszaru', full: true },
    { name: 'work_mode', label: 'Tryb', type: 'select', value: 'online', options: [{ value: 'online', label: 'Online · fabryka' }, { value: 'offline', label: 'Offline · biuro' }] },
    { name: 'shift', label: 'Zmiana', type: 'select', value: initialProject.shifts?.[0] || 'Dzień', options: initialProject.shifts?.length ? initialProject.shifts : ['Dzień', 'Noc'] },
    { name: 'count_in_manpower', label: 'Uwzględniaj osobę w kalkulacji manpoweru', type: 'checkbox', value: 1, hint: 'Z obszarami: +1 tylko w wybranych obszarach. Bez obszaru: +1 we wszystkich obszarach.', full: true },
    { name: 'note', label: 'Notatka', full: true }
  ] });
  const projectSelect = $('#action-fields [name="target_project_id"]');
  projectSelect?.addEventListener('change', () => {
    const project = projects.find(item => Number(item.id) === Number(projectSelect.value)) || initialProject;
    const details = $('#action-fields [data-ui-multiselect="controller_group_ids"]');
    if (details) {
      const search = details.querySelector('.multi-choice-search');
      details.querySelector('.mentions').innerHTML = `${search ? '<input class="multi-choice-search" type="search" placeholder="Szukaj obszaru…">' : ''}${projectAreaOptions(project).map(option => `<label class="mention"><input name="controller_group_ids" type="checkbox" value="${option.value}">${escapeHtml(option.label)}</label>`).join('')}`;
      details.querySelector('summary').textContent = 'Bez konkretnego obszaru';
    }
    const shift = $('#action-fields [name="shift"]');
    if (shift) { const shifts = project.shifts?.length ? project.shifts : ['Dzień', 'Noc']; shift.innerHTML = shifts.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join(''); }
  });
  const result = await formPromise;
  if (!result) return;
  const areaIds = [...new Set((result.controller_group_ids || []).map(Number).filter(Boolean))];
  const entriesToAdd = (areaIds.length ? areaIds : [null]).map(controllerGroupId => ({ controller_group_id: controllerGroupId, activity_type: 'work', work_mode: result.work_mode, shift: result.shift, transport_mode: 'none', count_in_manpower: result.count_in_manpower ? 1 : 0, allow_without_area: controllerGroupId ? 0 : 1, note: result.note }));
  const targetProjectId = Number(result.target_project_id);
  if (state.plannerRawPlanId && targetProjectId !== currentProjectId) {
    try {
      for (const target of targets) {
        const original = plannerProjectDayEntries(targetProjectId, target.userId, target.date);
        await savePlannerProjectDay(targetProjectId, target.userId, target.date, [...original, ...entriesToAdd], original);
      }
      clearPlannerSelections(false); toast('Dodano pracę do prywatnego planu RAW'); await reloadPlanner();
    } catch (error) { toast(error.message, true); }
    return;
  }
  if (targetProjectId !== currentProjectId) {
    try {
      const response = await api('/api/planner/cross-project-requests', { method: 'POST', body: JSON.stringify({
        target_project_id: targetProjectId,
        items: targets.map(target => ({ user_id: target.userId, plan_date: target.date, controller_group_ids: areaIds, work_mode: result.work_mode, shift: result.shift, count_in_manpower: result.count_in_manpower ? 1 : 0, note: result.note }))
      }) });
      clearPlannerSelections(false);
      toast(response.awaiting_approval ? `Plan zapisany · ${response.awaiting_approval} ${response.awaiting_approval === 1 ? 'dzień oczekuje' : 'dni oczekuje'} na potwierdzenie` : 'Plan został zapisany w wybranym projekcie');
      await reloadPlanner();
    } catch (error) { toast(error.message, true); }
    return;
  }
  const usable = targets.filter(target => !plannerDaySnapshot(target.userId, target.date).absence_type);
  const mixed = usable.some(target => allPlannerEntries().some(item => Number(item.user_id) === Number(target.userId) && item.plan_date === target.date && item.transport_mode !== 'transport_only' && item.work_mode !== result.work_mode));
  if (mixed) return toast('Pracownik może pracować danego dnia wyłącznie ON albo wyłącznie OFF — również pomiędzy projektami', true);
  await savePlannerBulkRequests(usable.map(target => { const day = plannerDaySnapshot(target.userId, target.date); return plannerDayRequest(target, [...day.entries, ...entriesToAdd], day); }), areaIds.length > 1 ? `Dodano ${areaIds.length} obszary pracy` : areaIds.length ? 'Dodano obszar pracy' : 'Dodano pracę bez obszaru');
}

function plannerVehicleOptions(projectId = Number(state.me.current_project?.id || 0)) {
  const project = plannerProjectConfig(projectId);
  const vehicles = project?.vehicles || state.planner?.vehicles || state.config.planner_vehicles || [];
  return [{ value: '', label: 'T · niezdefiniowany transport' }, ...vehicles.map(vehicle => ({ value: vehicle.id, label: `${vehicle.code} · ${vehicle.registration_number}` }))];
}

async function addTransportToPlannerSelection() {
  const targets = selectedPlannerTargets();
  if (!targets.length) return toast('Zaznacz co najmniej jeden dzień dla transportu', true);
  const defaultDuration = plannerTransportParts(plannerDefaultTransportMinutes() / 60);
  const result = await uiForm({ title: `Transport · ${targets.length} ${targets.length === 1 ? 'dzień' : 'dni'}`, description: 'Transport jest wspólną aktywnością pracownika widoczną pomiędzy projektami. Oznaczenie T lub kod auta (np. T1) nie zwiększa obsady ON/OFF.', submitLabel: '+Transport', fields: [
    { name: 'vehicle_id', label: 'Auto / transport', type: 'select', value: '', options: plannerVehicleOptions(), full: true },
    { name: 'duration_hours', label: 'Godziny', type: 'number', value: defaultDuration.hours, min: 0, step: 1, required: true },
    { name: 'duration_minutes', label: 'Minuty', type: 'number', value: defaultDuration.minutes, min: 0, max: 59, step: 1, required: true },
    { name: 'note', label: 'Komentarz', placeholder: 'Opcjonalnie', full: true }
  ] });
  if (!result) return;
  const durationHours = plannerTransportHoursFromParts(result.duration_hours, result.duration_minutes);
  if (durationHours === null) return toast('Podaj dodatni czas transportu w pełnych godzinach i minutach', true);
  const entry = { controller_group_id: null, activity_type: 'transport', work_mode: 'offline', shift: 'Dzień', transport_mode: 'transport_only', duration_hours: durationHours, vehicle_id: Number(result.vehicle_id) || null, note: result.note };
  const usable = targets.filter(target => !plannerDaySnapshot(target.userId, target.date).absence_type);
  await savePlannerBulkRequests(usable.map(target => { const day = plannerDaySnapshot(target.userId, target.date); return plannerDayRequest(target, [...day.entries, entry], day); }), 'Dodano transport');
}

async function addAbsenceToPlannerSelection(absenceType) {
  const targets = selectedPlannerTargets();
  if (!targets.length) return toast('Zaznacz co najmniej jeden dzień', true);
  const vacation = absenceType === 'vacation';
  const label = vacation ? 'Urlop' : 'Wolne';
  const description = vacation ? 'Urlop płatny zastąpi plan pracy i transport w zaznaczonych dniach.' : 'Wolne z nadgodzin zastąpi plan pracy i transport w zaznaczonych dniach.';
  const result = await uiForm({ title: `${label} · ${targets.length} ${targets.length === 1 ? 'dzień' : 'dni'}`, description, submitLabel: `Dodaj ${label.toLowerCase()}`, fields: [
    { name: 'note', label: 'Notatka nieobecności', placeholder: 'Opcjonalnie', full: true }
  ] });
  if (!result) return;
  const requests = targets.map(target => {
    const day = plannerDaySnapshot(target.userId, target.date);
    return plannerDayRequest(target, [], { ...day, absence_type: absenceType, absence_note: result.note });
  });
  await savePlannerBulkRequests(requests, vacation ? 'Dodano urlop' : 'Dodano wolne');
}

function selectedPlannerDayTargets() {
  const targets = new Map(selectedPlannerTargets().map(target => [plannerSelectionKey(target.userId, target.date), target]));
  selectedPlannerEntries().forEach(entry => targets.set(plannerSelectionKey(entry.user_id, entry.plan_date), { userId: Number(entry.user_id), date: entry.plan_date }));
  return [...targets.values()];
}

function emptyPlannerDayRequest(target) {
  return { user_id: target.userId, plan_date: target.date, entries: [], absence_type: '', absence_note: '', clear_all_projects: 1, actual_hours_adjustment: 0, overtime_raw_adjustment: 0, overtime_weighted_adjustment: 0, work_start_time: '', work_end_time: '', overtime_raw_balance_override: null, overtime_weighted_balance_override: null, adjustment_note: '' };
}

async function clearSelectedPlannerDays() {
  if (state.plannerEntrySelection.size) return deleteSelectedPlannerEntries();
  const targets = selectedPlannerDayTargets();
  if (!targets.length) return toast('Zaznacz co najmniej jeden dzień', true);
  const plural = targets.length === 1 ? 'wybranego dnia' : `${targets.length} wybranych dni`;
  if (!await uiConfirm('Wyczyść cały dzień', `Z ${plural} zostaną usunięte wszystkie wpisy pracy, transport, nieobecności i ręczne korekty czasu.`, 'Wyczyść wszystko', true)) return;
  await savePlannerBulkRequests(targets.map(emptyPlannerDayRequest), 'Wyczyszczono cały plan');
}

async function deleteSelectedPlannerEntries() {
  const entries = selectedPlannerEntries();
  if (!entries.length) return toast('Zaznacz co najmniej jeden kafelek', true);
  if (!await uiConfirm('Usuń zaznaczone kafelki', `Z planu zostanie usuniętych ${entries.length} ${entries.length === 1 ? 'aktywność' : 'aktywności'}.`, 'Usuń', true)) return;
  const groups = new Map();
  entries.forEach(entry => {
    const projectId = plannerEntryProjectId(entry); const key = `${projectId}:${entry.user_id}:${entry.plan_date}`;
    if (!groups.has(key)) groups.set(key, { projectId, userId: Number(entry.user_id), date: entry.plan_date, ids: new Set() });
    (entry.merged_entry_ids || [entry.id]).forEach(id => groups.get(key).ids.add(Number(id)));
  });
  try {
    for (const group of groups.values()) {
      const original = plannerProjectDayEntries(group.projectId, group.userId, group.date);
      await savePlannerProjectDay(group.projectId, group.userId, group.date, original.filter(entry => !group.ids.has(Number(entry.id))), original);
    }
    clearPlannerSelections(false); toast(`Usunięto ${entries.length} ${entries.length === 1 ? 'aktywność' : 'aktywności'}`); await reloadPlanner();
  } catch (error) { toast(error.message, true); }
}

function editSelectedPlannerDay() {
  const entries = selectedPlannerEntries();
  if (entries.length) {
    const days = new Map(entries.map(entry => [`${plannerEntryProjectId(entry)}:${entry.user_id}:${entry.plan_date}`, entry]));
    if (days.size !== 1) return toast('Do edycji zaznacz aktywności z dokładnie jednego dnia i projektu', true);
    const entry = days.values().next().value;
    return openPlannerCell(Number(entry.user_id), entry.plan_date, plannerEntryProjectId(entry));
  }
  const targets = selectedPlannerDayTargets();
  if (targets.length !== 1) return toast('Do edycji zaznacz dokładnie jeden dzień', true);
  openPlannerCell(targets[0].userId, targets[0].date);
}

function copyPlannerSelection() {
  const entries = selectedPlannerEntries();
  if (entries.length) {
    state.plannerClipboard = { kind: 'entry', entries: entries.map(entry => ({ ...plannerEntryPayload(entry), source_project_id: plannerEntryProjectId(entry) })) };
    toast(`Skopiowano ${entries.length} ${entries.length === 1 ? 'aktywność' : entries.length < 5 ? 'aktywności' : 'aktywności'}`);
    updatePlannerBulkCount();
    return true;
  }
  const targets = selectedPlannerTargets();
  if (!targets.length) { toast('Najpierw zaznacz dni lub aktywności.', true); return false; }
  if (targets.length === 1) {
    state.plannerClipboard = { kind: 'day', ...plannerDaySnapshot(targets[0].userId, targets[0].date) };
  } else {
    state.plannerClipboard = { kind: 'days', days: targets.map(target => ({ ...plannerDaySnapshot(target.userId, target.date) })) };
  }
  toast(targets.length === 1 ? 'Skopiowano cały dzień' : `Skopiowano ${targets.length} dni`);
  updatePlannerBulkCount();
  return true;
}

async function pastePlannerSelection() {
  const targets = selectedPlannerTargets(); const clipboard = state.plannerClipboard;
  if (!targets.length || !clipboard) return;
  if (clipboard.kind === 'day') return savePlannerBulkRequests(targets.map(target => plannerDayRequest(target, clipboard.entries || [], clipboard)), 'Wklejono skopiowany dzień');
  if (clipboard.kind === 'days') return savePlannerBulkRequests(targets.map((target, index) => { const source = clipboard.days[index % clipboard.days.length]; return plannerDayRequest(target, source.entries || [], source); }), 'Wklejono skopiowany zakres dni');
  const usable = targets.filter(target => !plannerDaySnapshot(target.userId, target.date).absence_type);
  const byProject = new Map();
  (clipboard.entries || []).forEach(entry => {
    const projectId = Number(entry.source_project_id || state.me.current_project?.id || 0);
    if (!byProject.has(projectId)) byProject.set(projectId, []);
    byProject.get(projectId).push(entry);
  });
  try {
    for (const target of usable) for (const [projectId, copied] of byProject) {
      const original = plannerProjectDayEntries(projectId, target.userId, target.date);
      await savePlannerProjectDay(projectId, target.userId, target.date, [...original, ...copied], original);
    }
    clearPlannerSelections(false); toast(`Wklejono skopiowaną aktywność · ${usable.length} ${usable.length === 1 ? 'dzień' : 'dni'}`); await reloadPlanner();
  } catch (error) { toast(error.message, true); }
}

function handlePlannerClipboardShortcut(event) {
  if (state.view !== 'planner' || event.altKey || document.querySelector('dialog[open]')) return;
  if (event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && key === 'c' && (state.plannerSelection.size || state.plannerEntrySelection.size)) { event.preventDefault(); copyPlannerSelection(); }
  if ((event.ctrlKey || event.metaKey) && key === 'v' && state.plannerSelection.size && state.plannerClipboard) { event.preventDefault(); pastePlannerSelection(); }
  if (!event.ctrlKey && !event.metaKey && state.plannerSelection.size && ['p', 't', 'u', 'w'].includes(key)) {
    event.preventDefault();
    if (key === 'p') addWorkToPlannerSelection();
    if (key === 't') addTransportToPlannerSelection();
    if (key === 'u') addAbsenceToPlannerSelection('vacation');
    if (key === 'w') addAbsenceToPlannerSelection('time_off');
  }
  if (!event.ctrlKey && !event.metaKey && key === 'e' && (state.plannerSelection.size || state.plannerEntrySelection.size)) { event.preventDefault(); editSelectedPlannerDay(); }
  if (event.key === 'Delete' && (state.plannerSelection.size || state.plannerEntrySelection.size)) { event.preventDefault(); clearSelectedPlannerDays(); }
}

async function approvePlannerSelectionOverlaps() {
  const reviews = plannerSelectionOverlapReviews();
  if (!reviews.length) return toast('W zaznaczeniu nie ma kolizji oczekujących na decyzję');
  try {
    for (let index = 0; index < reviews.length; index += 15) await Promise.all(reviews.slice(index, index + 15).map(item => api('/api/planner/overlaps/action', { method: 'POST', body: JSON.stringify({ user_id: item.user_id, plan_date: item.plan_date, action: 'approve' }) })));
    toast(`Zatwierdzono ${reviews.length} nakładających się dni`); state.plannerSelection.clear(); state.plannerEntrySelection.clear(); await reloadPlanner();
  } catch (error) { toast(error.message, true); }
}

function bindPlannerBulkToolbar() {
  $('#planner-bulk-add')?.addEventListener('click', addWorkToPlannerSelection);
  $('#planner-bulk-transport')?.addEventListener('click', addTransportToPlannerSelection);
  $('#planner-bulk-time-off')?.addEventListener('click', () => addAbsenceToPlannerSelection('time_off'));
  $('#planner-bulk-vacation')?.addEventListener('click', () => addAbsenceToPlannerSelection('vacation'));
  $('#planner-bulk-copy')?.addEventListener('click', copyPlannerSelection);
  $('#planner-bulk-paste')?.addEventListener('click', pastePlannerSelection);
  $('#planner-bulk-approve')?.addEventListener('click', approvePlannerSelectionOverlaps);
  $('#planner-selection-clear')?.addEventListener('click', clearPlannerSelections);
  updatePlannerBulkCount();
}

function plannerUnifiedSection(users, days, entryMap, workMap, summaryMap, areaDaySummary, showRequirements, absenceMap, timeMap, holidayMap, showTime, overlapMap, annotations = [], detailed = true, matchingEntries = []) {
  const segments = (source, label) => { const result = []; let current; source.forEach(date => { const value = label(date); if (!current || current.value !== value) { current = { value, count: 0 }; result.push(current); } current.count += 1; }); return result; };
  const months = segments(days, date => new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)));
  const weeks = segments(days, date => isoWeek(date).label);
  const requirementProjects = plannerRequirementProjects();
  const areaRows = showRequirements ? state.plannerRequirementEdit ? plannerInlineRequirementRows(days) : requirementProjects.map(project => {
    const collapsed = state.plannerCollapsedRequirementProjects.has(Number(project.id));
    const filteredProjectRows=days.map(plan_date=>{const rows=matchingEntries.filter(entry=>Number(entry.project_id||state.me.current_project?.id)===Number(project.id)&&entry.plan_date===plan_date);return {plan_date,headcount:new Set(rows.map(row=>row.user_id)).size,online_headcount:new Set(rows.filter(row=>row.work_mode==='online').map(row=>row.user_id)).size,offline_headcount:new Set(rows.filter(row=>row.work_mode==='offline').map(row=>row.user_id)).size,online_required:Number((project.summary||[]).find(item=>item.plan_date===plan_date)?.online_required||0),offline_required:Number((project.summary||[]).find(item=>item.plan_date===plan_date)?.offline_required||0)};});
    const projectSummary = new Map(filteredProjectRows.map(item => [item.plan_date, item]));
    const projectBar = `<tr class="requirement-project-row ${collapsed ? 'collapsed' : ''}" data-requirement-project-bar="${project.id}" style="${projectColorStyle(project.planner_color)}"><th class="person-col"><button type="button" class="requirement-project-toggle" data-requirement-project-toggle="${project.id}" aria-expanded="${!collapsed}" title="${collapsed ? 'Rozwiń' : 'Zwiń'} projekt"><i>${collapsed ? '›' : '⌄'}</i><span><b>${escapeHtml(project.planner_short_code || project.code)}</b><small>${escapeHtml(project.name || project.code)} · obsada razem</small></span></button></th>${days.map(date => plannerProjectTotalCell(projectSummary.get(date), date, project.id, collapsed)).join('')}</tr>`;
    return `${projectBar}${collapsed ? '' : (project.area_day_summary || []).map(area => `<tr class="area-day-row" data-requirement-project="${project.id}"><th class="person-col">${escapeHtml(area.name)}</th>${days.map(date => plannerAreaRequirementCell(area.days.find(item => item.date === date), date)).join('')}</tr>`).join('')}`;
  }).join('') : '';
  const requirementTools = showRequirements && state.plannerRequirementEdit ? `<div class="planner-inline-requirement-toolbar"><span><b>Edycja zapotrzebowania</b><small>Cały projekt i obszary główne · ON/OFF, np. 4/2 · suma obszarów nie może przekroczyć wartości projektu</small></span><label>Projekt <select id="planner-requirement-project-inline">${requirementProjects.map(project => `<option value="${project.id}">${escapeHtml(project.planner_short_code || project.code)} · ${escapeHtml(project.name || project.code)}</option>`).join('')}</select></label><button type="button" class="mini" id="planner-requirement-copy-inline">Kopiuj</button><button type="button" class="mini" id="planner-requirement-paste-inline">Wklej</button><span class="requirement-selection-meta" id="requirement-selection-count-inline">Brak zaznaczenia</span><span class="requirement-dirty-meta" id="requirement-dirty-count-inline">Brak niezapisanych zmian</span><button type="button" class="primary" id="planner-requirements-save-inline">Zapisz zapotrzebowanie</button></div>` : '';
  const dayHeader = (date, number = false) => { const weekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()); const holiday = holidayMap.get(date); return `<th class="${date === today() ? 'today' : ''} ${holiday ? 'holiday' : ''} ${weekend ? 'weekend' : ''} ${state.plannerHighlightedDates.has(date)?'visual-highlight':''}" data-planner-date-header="${date}" title="${escapeHtml(holiday?.name || '')}">${number ? date.slice(8, 10) : new Intl.DateTimeFormat('pl-PL', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}${holiday && !number ? `<span class="holiday-info" title="${escapeHtml(holiday.name)}">i</span>` : ''}</th>`; };
  const annotationRow = annotations.length ? `<tr class="planner-annotation-row"><th class="person-col"><b>Adnotacje</b><small>z Kalendarza</small></th>${days.map(date => `<td>${annotations.filter(item => item.start_date <= date && item.end_date >= date).map(item => { const scopes = (item.scope_labels || []).join(', ') || 'Cały projekt'; return `<span class="planner-annotation-chip" style="--annotation-bg:${item.background_color || '#dcfce7'};--annotation-text:${item.text_color || '#14532d'}" title="${escapeHtml([item.title, scopes, item.description].filter(Boolean).join(' · '))}"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(scopes)}</small></span>`; }).join('')}</td>`).join('')}</tr>` : '';
  const footer = detailed || showRequirements ? `<tfoot><tr class="total-headcount-row"><th class="person-col">Obsada razem</th>${days.map(date => { const summary = summaryMap.get(date); return `<td class="${date === today() ? 'today' : ''}" data-total-date="${date}"><b>${summary?.headcount || 0}</b><small><i class="on-tag">ON ${summary?.online_headcount || 0}</i><i class="off-tag">OFF ${summary?.offline_headcount || 0}</i></small></td>`; }).join('')}</tr>${requirementTools ? `<tr class="requirement-toolbar-row"><td colspan="${days.length + 1}">${requirementTools}</td></tr>` : ''}${areaRows}</tfoot>` : '';
  return `<section class="planner-shell planner-unified ${detailed ? 'planner-detailed' : 'planner-simplified'} ${state.plannerRequirementEdit ? 'requirements-editing' : ''}" ${state.plannerRequirementEdit ? 'id="planner-inline-requirements"' : ''}><header><div><strong>Plan zespołu</strong><small>Klik zaznacza · Ctrl+przeciągnięcie zaznacza zakres · Ctrl+Shift+klik zaznacza prostokąt · skróty: P praca · T transport · U urlop · W wolne · E edycja · Delete wyczyść dzień</small></div><span>${users.length} uczestników</span></header><div class="planner-scroll"><table class="planner-table compact" style="--planner-days:${days.length};--requirement-days:${days.length}"><thead><tr><th class="person-col" rowspan="4">Pracownik</th>${months.map(item => `<th colspan="${item.count}">${escapeHtml(item.value)}</th>`).join('')}</tr><tr>${weeks.map(item => `<th colspan="${item.count}">${escapeHtml(item.value)}</th>`).join('')}</tr><tr>${days.map(date => dayHeader(date)).join('')}</tr><tr>${days.map(date => dayHeader(date, true)).join('')}</tr></thead><tbody>${annotationRow}${users.map(user => `<tr class="${Number(user.id) === Number(state.me.id) ? 'planner-current-user' : ''} ${state.plannerHighlightedUsers.has(Number(user.id))?'visual-highlight':''}"><th class="person-col" data-planner-user-header="${user.id}"><b>${escapeHtml(user.display_name)}${Number(user.id) === Number(state.me.id) ? ' · Ty' : ''}</b>${detailed ? `<small>${escapeHtml(user.planned_areas || 'bez obszaru')}</small>` : ''}${showTime ? `<em>${Number((state.planner.time_details?.users || []).find(item => item.user_id === user.id)?.actual_hours || 0).toFixed(1)} h</em>` : ''}</th>${days.map(date => plannerCell(user, date, entryMap.get(`${user.id}:${date}`) || [], workMap.get(`${user.id}:${date}`), absenceMap.get(`${user.id}:${date}`), timeMap.get(`${user.id}:${date}`), holidayMap.get(date), showTime, overlapMap.get(`${user.id}:${date}`), detailed)).join('')}</tr>`).join('') || `<tr><td colspan="${days.length + 1}" class="empty compact-empty">Brak uczestników Plannera.</td></tr>`}</tbody>${footer}</table></div></section>`;
}

function plannerInlineRequirementRows(days) {
  const groups = state.requirementData?.areas || []; const groupById = new Map(groups.map(group => [Number(group.id), group]));
  const actuals = new Map();
  const plannerSource = state.view === 'calendar' ? state.calendarPlanner : state.requirementData || state.planner;
  for (const entry of plannerSource?.entries || []) {
    const transport = entry.activity_type === 'transport' || entry.transport_mode === 'transport_only';
    if (transport || Number(entry.count_in_manpower) === 0) continue;
    const projectKey = `0:${entry.plan_date}:${entry.work_mode || 'online'}`;
    if (!actuals.has(projectKey)) actuals.set(projectKey,new Set()); actuals.get(projectKey).add(Number(entry.user_id));
    const target = groupById.get(Number(entry.controller_group_id));
    if (!target) {
      for (const group of groups) {
        const key = `${group.id}:${entry.plan_date}:${entry.work_mode || 'online'}`;
        if (!actuals.has(key)) actuals.set(key, new Set());
        actuals.get(key).add(Number(entry.user_id));
      }
      continue;
    }
    for (const group of groups) {
      const path = group.path_names || []; const targetPath = target.path_names || [];
      if (path.length > targetPath.length || path.some((name, index) => name !== targetPath[index])) continue;
      const key = `${group.id}:${entry.plan_date}:${entry.work_mode || 'online'}`;
      if (!actuals.has(key)) actuals.set(key, new Set());
      actuals.get(key).add(Number(entry.user_id));
    }
  }
  const { rows } = requirementHierarchy();
  return rows.map(({ group, depth, hasChildren }, rowIndex) => `<tr class="area-day-row requirement-edit-row"><th class="person-col requirement-area"><div class="requirement-tree-node" style="--requirement-depth:${depth}">${hasChildren ? `<button type="button" class="requirement-tree-toggle" data-requirement-toggle-inline="${group.id}" aria-label="${state.requirementCollapsedGroups.has(Number(group.id)) ? 'Rozwiń' : 'Zwiń'} ${escapeHtml(group.name)}">${state.requirementCollapsedGroups.has(Number(group.id)) ? '›' : '⌄'}</button>` : '<i></i>'}<span><b>${escapeHtml(group.name)}</b>${depth ? `<small>${escapeHtml((group.path_names || []).slice(0, -1).join(' / '))}</small>` : ''}</span></div></th>${days.map((date, columnIndex) => { const key = `${group.id}:${date}`; const entered = state.requirementDraft.get(key) || ''; const online = actuals.get(`${key}:online`)?.size || 0; const offline = actuals.get(`${key}:offline`)?.size || 0; return `<td class="${date === today() ? 'today' : ''}" data-requirement-cell data-group="${group.id}" data-date="${date}" data-grid-row="${rowIndex}" data-grid-column="${columnIndex}"><input class="requirement-grid-input ${parseRequirementValue(entered) ? '' : 'invalid'}" value="${escapeHtml(entered)}" placeholder="0/0" inputmode="numeric" data-requirement-value aria-label="${escapeHtml(group.path_label || group.name)}, ${displayDate(date)}, ON/OFF"><small class="requirement-live-count">ON ${online} · OFF ${offline}</small><i class="requirement-fill-handle" title="Przeciągnij, aby powielić zaznaczenie"></i></td>`; }).join('')}</tr>`).join('') || `<tr class="area-day-row"><td colspan="${days.length + 1}" class="empty">Brak obszarów.</td></tr>`;
}

function plannerHeadcountCell(day = {}, showRequirements = false, date = '') {
  const shortage = showRequirements && ((day.online || 0) < (day.online_required || 0) || (day.offline || 0) < (day.offline_required || 0));
  return `<td class="area-headcount-cell ${shortage ? 'shortage' : ''} ${date === today() ? 'today' : ''}"><span><i class="on-tag">ON</i><b>${day.online || 0}${showRequirements ? `/${day.online_required || 0}` : ''}</b></span><span><i class="off-tag">OFF</i><b>${day.offline || 0}${showRequirements ? `/${day.offline_required || 0}` : ''}</b></span></td>`;
}

function plannerAreaRequirementCell(day = {}, date = '') {
  return `<td class="area-headcount-cell requirement-only ${date === today() ? 'today' : ''}" title="Przypisanie do obszaru ma charakter informacyjny; obsada jest rozliczana na poziomie projektu"><span><i class="on-tag">ON</i><b>${day.online_required || 0}</b></span><span><i class="off-tag">OFF</i><b>${day.offline_required || 0}</b></span></td>`;
}

function plannerProjectTotalCell(summary = {}, date = '', projectId, collapsed = false) {
  const shortage=Number(summary.online_headcount||0)<Number(summary.online_required||0)||Number(summary.offline_headcount||0)<Number(summary.offline_required||0);
  return `<td class="project-total-cell ${shortage?'shortage':''} ${date === today() ? 'today' : ''}" data-project-total-date="${date}"><button type="button" data-requirement-project-toggle="${projectId}" aria-expanded="${!collapsed}" title="Obsada / zapotrzebowanie projektu · ${displayDate(date)}"><b>${summary.headcount || 0}</b><small><i class="on-tag">ON ${summary.online_headcount || 0}/${summary.online_required||0}</i><i class="off-tag">OFF ${summary.offline_headcount || 0}/${summary.offline_required||0}</i></small></button></td>`;
}

function plannerCombinedChip(user, date, entries, editable) {
  if (!entries.length) return '';
  const projects = entries.filter(entry => entry.activity_type !== 'transport' && entry.transport_mode !== 'transport_only').slice(0, 3);
  const transports = entries.filter(entry => entry.activity_type === 'transport' || entry.transport_mode === 'transport_only');
  const previousDate = addDays(date, -1);
  const previousHadProject = allPlannerEntries().some(entry => Number(entry.user_id) === Number(user.id) && entry.plan_date === previousDate && entry.activity_type !== 'transport' && entry.transport_mode !== 'transport_only')
    || (date === state.planner?.from && (state.planner?.previous_project_user_ids || []).map(Number).includes(Number(user.id)));
  const transportSegments = transports.slice(0, 1).map(entry => ({ type: 'transport', entry, label: entry.transport_code || 'T' }));
  const projectSegments = projects.map(entry => ({ type: 'project', entry, label: entry.project_short_code || entry.project_code || state.me.current_project?.planner_short_code || state.me.current_project?.code || 'PRJ' }));
  const segments = previousHadProject ? [...transportSegments, ...projectSegments] : [...projectSegments, ...transportSegments];
  const entryIds = entries.flatMap(entry => entry.merged_entry_ids || [entry.id]).map(Number).filter(Boolean);
  const selected = entryIds.length && entryIds.every(id => state.plannerEntrySelection.has(id));
  const notes = [...new Set(entries.flatMap(entry => entry.display_notes || [entry.note]).filter(Boolean))];
  const pending = entries.some(entry => entry.cross_project_status === 'pending');
  const offline = projects.some(entry => (entry.merged_entries?.length ? entry.merged_entries : [entry]).some(item => item.work_mode === 'offline'));
  const night = projects.some(entry => (entry.merged_entries?.length ? entry.merged_entries : [entry]).some(item => item.shift === 'Noc'));
  const title = segments.map(segment => segment.type === 'transport'
    ? `${segment.label} · transport`
    : `${segment.entry.project_name || segment.entry.project_code || segment.label}`).join(' / ');
  const first = entries[0];
  const superseded=entries.some(entry=>entry.superseded_by_proposal);
  return `<span class="plan-chip combined-plan-chip ${projects.length ? 'project-work' : 'transport-only'} ${offline ? 'offline-work' : ''} ${night ? 'night-shift' : ''} ${selected ? 'entry-selected' : ''} ${pending ? 'approval-pending' : ''} ${superseded?'approval-superseded':''}" title="${escapeHtml([title, ...notes].filter(Boolean).join(' · '))}" data-entry-id="${entryIds[0] || ''}" data-entry-ids="${entryIds.join(',')}" data-current-project="${entries.every(entry => entry.is_current_project !== false) ? 1 : 0}" data-project-id="${first.project_id || state.me.current_project?.id}" draggable="${editable && !entries.some(entry=>entry.is_proposal) ? 'true' : 'false'}"><span class="combined-plan-track">${segments.map((segment, index) => `${index ? '<i aria-hidden="true">/</i>' : ''}<b class="combined-plan-segment ${segment.type}" style="${segment.type === 'project' ? projectColorStyle(segment.entry.project_color || state.me.current_project?.planner_color) : ''}">${escapeHtml(segment.label)}</b>`).join('')}</span>${pending ? '<b class="planner-approval-mark" aria-label="Propozycja oczekuje na potwierdzenie">?</b>' : superseded?'<b class="planner-approval-old" aria-label="Aktualny oficjalny plan do czasu decyzji">×</b>':''}</span>`;
}

function plannerCell(user, date, entries, work, absence, timeDetail, holiday, showTime, overlap, detailed = true) {
  const weekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
  const lock=state.planner?.planner_lock; const editable = canCoordinate() && (!lock||Number(lock.locked_by)===Number(state.me.id)) && (Number(user.planner_enabled) || date === today());
  const cellKey = plannerSelectionKey(user.id, date);
  const expanded = state.plannerExpandedCells.has(cellKey);
  const sortedEntries = plannerDisplayEntries(entries, !detailed).sort((left, right) => {
    const rank = entry => entry.activity_type === 'transport' || entry.transport_mode === 'transport_only' ? 1 : entry.controller_group_id ? 3 : 2;
    return rank(left) - rank(right) || controllerHierarchyOrder(left) - controllerHierarchyOrder(right) || String(left.area_path || left.area_name || '').localeCompare(String(right.area_path || right.area_name || ''), 'pl', { numeric: true });
  });
  const visibleEntryLimit = Math.max(0, 3 - Number(Boolean(absence)));
  let overlapPlaced = false;
  const detailedChips = sortedEntries.map((entry, entryIndex) => {
    const transport = entry.activity_type === 'transport' || entry.transport_mode === 'transport_only';
    const current = entry.is_current_project !== false;
    const entryIds = (entry.merged_entry_ids || [entry.id]).map(Number).filter(Boolean);
    const selectedEntry = entryIds.length && entryIds.every(id => state.plannerEntrySelection.has(id));
    const showOverlap = detailed && current && overlap && !overlapPlaced;
    if (showOverlap) overlapPlaced = true;
    const collision = showOverlap ? `<span class="planner-overlap-actions ${overlap.status}" title="Nakładanie się projektów: ${escapeHtml(overlap.other_project_codes || 'inny projekt')}">${overlap.status === 'approved' ? '<b aria-label="Kolizja zatwierdzona">✓</b>' : overlap.status === 'rejected' ? '<b aria-label="Kolizja odrzucona">×</b>' : canCoordinate() ? `<button type="button" data-overlap-action="approve" data-user-id="${user.id}" data-date="${date}" aria-label="Zatwierdź kolizję">✓</button><button type="button" data-overlap-action="reject" data-user-id="${user.id}" data-date="${date}" aria-label="Odrzuć plan">×</button>` : '<b>⚠</b>'}</span>` : '';
    const duration = transport ? formatPlannerTransportDuration(entry.duration_hours) : '';
    const transportCode = entry.transport_code || 'T';
    const approvalPending = detailed && entry.cross_project_status === 'pending';
    const contextLabel = transport || !detailed || !state.plannerShowAreas ? '' : entry.display_area_label || entry.area_path || entry.area_name || '';
    const groupedEntries = entry.merged_entries?.length ? entry.merged_entries : [entry];
    const night = !transport && groupedEntries.some(item => item.shift === 'Noc');
    const offline = !transport && groupedEntries.some(item => item.work_mode === 'offline');
    const projectColor = safeProjectColor(entry.project_color || state.me.current_project?.planner_color);
    const projectShortCode = entry.project_short_code || entry.project_code || state.me.current_project?.planner_short_code || state.me.current_project?.code || 'PRJ';
    const title = transport
      ? `${transportCode}${entry.vehicle_registration ? ` · ${entry.vehicle_registration}` : ''} · transport poza kalkulacją ON/OFF${duration ? ` · ${duration}` : ''}`
      : [entry.project_name || entry.project_code, contextLabel, entry.work_mode === 'offline' ? 'OFF' : 'ON', night ? 'Noc' : 'Dzień', approvalPending ? `Oczekuje na potwierdzenie managera projektu${entry.cross_project_source_code ? ` · wpis z ${entry.cross_project_source_code}` : ''}` : '', Number(entry.count_in_manpower) === 0 ? 'Poza kalkulacją manpoweru' : '', showOverlap ? `Nakładanie się projektów: ${overlap.other_project_codes || 'inny projekt'}` : ''].filter(Boolean).join(' · ');
    const extra = entryIndex >= visibleEntryLimit;
    const superseded=groupedEntries.some(item=>item.superseded_by_proposal);
    return `<span class="plan-chip ${transport ? 'transport-only' : 'project-work'} ${contextLabel ? 'shows-areas' : ''} ${offline ? 'offline-work' : 'online-work'} ${night ? 'night-shift' : ''} ${approvalPending ? 'approval-pending' : ''} ${superseded?'approval-superseded':''} ${Number(entry.count_in_manpower) === 0 ? 'excluded-from-manpower' : ''} ${current ? '' : 'other-project'} ${selectedEntry ? 'entry-selected' : ''} ${showOverlap ? `has-overlap ${overlap.status}` : ''}" style="${transport ? '' : projectColorStyle(projectColor)}" ${extra ? 'data-planner-extra' : ''} ${extra && !expanded ? 'hidden' : ''} title="${escapeHtml(title)}" data-entry-id="${entryIds[0] || entry.id}" data-entry-ids="${entryIds.join(',')}" data-current-project="${current ? 1 : 0}" data-project-id="${entry.project_id || state.me.current_project?.id}" draggable="${editable&&!entry.is_proposal ? 'true' : 'false'}"><b class="mode-label ${contextLabel ? 'area-mode-label' : ''}">${escapeHtml(contextLabel || (transport ? transportCode : projectShortCode))}</b>${contextLabel ? '' : '<span></span>'}${Number(entry.count_in_manpower)===0&&canCoordinate()?'<em class="manpower-excluded-mark">−M</em>':''}${approvalPending ? '<b class="planner-approval-mark" aria-label="Propozycja oczekuje na potwierdzenie">?</b>' : superseded?'<b class="planner-approval-old" aria-label="Aktualny oficjalny plan do czasu decyzji">×</b>':''}${collision}</span>`;
  }).join('');
  const chips = detailed ? detailedChips : plannerCombinedChip(user, date, sortedEntries, editable);
  const workload = detailed && work && (work.tasks || work.points || work.statuses || work.notes) ? `<span class="workload" title="Zadania / otwarte punkty / status / notatki">${work.tasks}/${work.points}/${work.statuses}/${work.notes}</span>` : '';
  const absenceChip = absence ? `<span class="absence-chip ${absence.absence_type}" draggable="${editable ? 'true' : 'false'}" title="${escapeHtml(absence.note || (absence.absence_type === 'vacation' ? 'Urlop' : 'Wolne'))}"><b>${absence.absence_type === 'vacation' ? 'URLOP' : 'WOLNE'}</b>${absence.note ? `<small>${escapeHtml(absence.note)}</small><span class="plan-note" data-note="${escapeHtml(absence.note)}" title="${escapeHtml(absence.note)}" tabindex="0" aria-label="Notatka: ${escapeHtml(absence.note)}">i</span>` : ''}</span>` : '';
  const tileCount = detailed ? sortedEntries.length + Number(Boolean(absence)) : Number(Boolean(chips)) + Number(Boolean(absence));
  const expandButton = detailed && tileCount > 3 ? `<button type="button" class="planner-cell-expand" data-planner-expand="${escapeHtml(cellKey)}" aria-expanded="${expanded}">${expanded ? 'Zwiń' : `+${tileCount - 3}`}</button>` : '';
  const hours = showTime && timeDetail ? `<span class="planner-hours-chip" title="Praca i urlop: ${Number(timeDetail.actual_hours + timeDetail.credited_hours).toFixed(1)} h · podróż służbowa: ${Number(timeDetail.travel_hours || 0).toFixed(1)} h · narastająco bez mnożnika: ${Number(timeDetail.overtime_raw_cumulative || 0).toFixed(1)} h · z mnożnikiem: ${Number(timeDetail.overtime_weighted_cumulative || 0).toFixed(1)} h"><b>${Number(timeDetail.actual_hours + timeDetail.credited_hours).toFixed(1)}h${Number(timeDetail.travel_hours || 0) ? ` · T ${Number(timeDetail.travel_hours).toFixed(1)}h` : ''}</b><i>Σ ${Number(timeDetail.overtime_raw_cumulative || 0).toFixed(1)} / ${Number(timeDetail.overtime_weighted_cumulative || 0).toFixed(1)}</i></span>` : '';
  const dayComment=(state.planner?.day_comments||[]).find(item=>Number(item.user_id)===Number(user.id)&&item.plan_date===date)?.comment||'';
  const commentLines=[...(dayComment?[`Ogólny: ${dayComment}`]:[]),...entries.filter(entry=>entry.note).map(entry=>`${entry.transport_mode==='transport_only'?(entry.transport_code||'T'):`${entry.project_short_code||entry.project_code||'Projekt'}${entry.area_path||entry.area_name?` / ${entry.area_path||entry.area_name}`:''}`}: ${entry.note}`)];
  const commentIcon=commentLines.length?`<button type="button" class="planner-cell-note" title="${escapeHtml(commentLines.join('\n'))}" aria-label="Komentarze dnia">i</button>`:'';
  const historyCount=Number((state.planner?.history_counts||[]).find(item=>Number(item.user_id)===Number(user.id)&&item.plan_date===date)?.history_count||0);
  const historyIcon=historyCount>1?`<button type="button" class="planner-history-mark" data-planner-history-user="${user.id}" data-planner-history-date="${date}" title="Historia zmian dnia">↺</button>`:'';
  const selected = state.plannerSelection.has(cellKey);
  return `<td class="planner-cell ${weekend ? 'weekend' : ''} ${holiday ? 'holiday' : ''} ${absence ? 'absent' : ''} ${date === today() ? 'today' : ''} ${state.plannerHighlightedDates.has(date)?'visual-highlight':''} ${entries.length ? 'planned' : ''} ${detailed && overlap ? `overlap-${overlap.status}` : ''} ${selected ? 'multi-selected' : ''} ${expanded ? 'entries-expanded' : ''} ${editable ? '' : 'read-only'}" data-user-id="${user.id}" data-date="${date}" data-editable="${editable ? 1 : 0}" title="${holiday ? `${escapeHtml(holiday.name)} · ` : ''}${editable ? 'Lewy przycisk: zaznacz · prawy przycisk: edytuj i kopiuj · przeciągnij aktywność' : 'Plan tylko do odczytu'}">${absenceChip}${chips}${expandButton}${workload}${hours}${commentIcon}${historyIcon}${!absenceChip && !chips && editable ? '<i>+</i>' : ''}</td>`;
}

async function decidePlannerOverlap(userId, date, action) {
  if (action === 'reject' && !await uiConfirm('Odrzuć nakładający się plan', 'Plan tej osoby w bieżącym projekcie zostanie usunięty dla wybranego dnia.', 'Odrzuć plan', true)) return;
  try {
    await api('/api/planner/overlaps/action', { method: 'POST', body: JSON.stringify({ user_id: userId, plan_date: date, action }) });
    toast(action === 'approve' ? 'Kolizja została zatwierdzona' : 'Nakładający się plan został odrzucony');
    await reloadPlanner();
  } catch (error) { toast(error.message, true); }
}

async function dropPlannerEntry(event, cell) {
  if (!canCoordinate() || cell.dataset.editable !== '1') return;
  event.preventDefault(); cell.classList.remove('drag-over');
  const rawDay = event.dataTransfer.getData('text/planner-day');
  if (rawDay || state.plannerDragDay) {
    const source = rawDay ? JSON.parse(rawDay) : state.plannerDragDay;
    try {
      const copy = event.ctrlKey || event.altKey; const targetUserId = Number(cell.dataset.userId); const targetDate = cell.dataset.date;
      if (state.plannerRawPlanId) {
        const sourceEntries = plannerProjectDayEntries(state.me.current_project?.id, source.userId, source.date);
        const targetEntries = plannerProjectDayEntries(state.me.current_project?.id, targetUserId, targetDate);
        await savePlannerProjectDay(state.me.current_project?.id, targetUserId, targetDate, [...targetEntries, ...sourceEntries]);
        if (!copy) await savePlannerProjectDay(state.me.current_project?.id, source.userId, source.date, []);
      } else await api('/api/planner/move-day', { method: 'POST', body: JSON.stringify({ source_user_id: source.userId, source_date: source.date, target_user_id: targetUserId, target_date: targetDate, copy }) });
      toast(copy ? 'Skopiowano cały dzień' : 'Przeniesiono cały dzień'); await reloadPlanner();
    } catch (error) { toast(error.message, true); }
    return;
  }
  const entryId = Number(event.dataTransfer.getData('text/planner-entry') || state.plannerDragEntry);
  if (!entryId) return;
  try {
    const copy = event.ctrlKey || event.altKey;
    const entryIds = new Set(state.plannerEntrySelection.has(entryId) ? [...state.plannerEntrySelection] : [entryId]);
    const entries = allPlannerEntries().filter(entry => entryIds.has(Number(entry.id)));
    if (!entries.length) throw new Error('Nie znaleziono przenoszonych aktywności');
    const targetUserId = Number(cell.dataset.userId); const targetDate = cell.dataset.date;
    const plans = new Map();
    const ensurePlan = (projectId, userId, date) => {
      const key = `${projectId}:${userId}:${date}`;
      if (!plans.has(key)) { const original = plannerProjectDayEntries(projectId, userId, date); plans.set(key, { projectId, userId, date, original, entries: [...original] }); }
      return plans.get(key);
    };
    const groups = new Map();
    entries.forEach(entry => {
      const projectId = plannerEntryProjectId(entry); const key = `${projectId}:${entry.user_id}:${entry.plan_date}`;
      if (!groups.has(key)) groups.set(key, { projectId, userId: Number(entry.user_id), date: entry.plan_date, entries: [] });
      groups.get(key).entries.push(entry);
    });
    for (const group of groups.values()) {
      if (group.userId === targetUserId && group.date === targetDate) continue;
      const movedIds = new Set(group.entries.map(entry => Number(entry.id)));
      if (!copy) {
        const source = ensurePlan(group.projectId, group.userId, group.date);
        source.entries = source.entries.filter(entry => !movedIds.has(Number(entry.id)));
      }
      const target = ensurePlan(group.projectId, targetUserId, targetDate);
      target.entries.push(...group.entries);
    }
    for (const plan of plans.values()) await savePlannerProjectDay(plan.projectId, plan.userId, plan.date, plan.entries, plan.original);
    const label = entries.length === 1 ? 'aktywność' : `${entries.length} aktywności`;
    clearPlannerSelections(false);
    toast(copy ? `Skopiowano ${label}` : `Przeniesiono ${label}`); await reloadPlanner();
  } catch (error) { toast(error.message, true); }
}

async function reloadPlanner() {
  try {
    const query = `?from=${state.plannerFrom}&to=${addDays(state.plannerFrom, state.plannerDays - 1)}`;
    if (canCoordinate()) state.plannerRawPlans = await api('/api/planner/raw-plans');
    state.planner = await api(state.plannerRawPlanId ? `/api/planner/raw-plans/${state.plannerRawPlanId}${query}` : `/api/planner${query}`);
    if (state.plannerRequirementEdit) {
      state.requirementFrom = state.plannerFrom; state.requirementDays = state.plannerDays; state.requirementData = state.planner;
      mergePlannerRequirementData(state.requirementData);
    }
    renderPlanner();
  } catch (error) { toast(error.message, true); }
}

function plannerProjectConfig(projectId = Number(state.me.current_project?.id || 0)) {
  return (state.planner?.assignment_projects || []).find(project => Number(project.id) === Number(projectId)) || null;
}

function plannerAreaOptions(projectId = Number(state.me.current_project?.id || 0)) {
  const project = plannerProjectConfig(projectId);
  return project ? (project.areas || []).map(area => ({ value: area.id, label: area.path_label || area.name })) : hierarchyGroupOptions();
}

function plannerAreaPicker(selectedIds = [], projectId = Number(state.me.current_project?.id || 0)) {
  const selected = new Set((selectedIds || []).map(Number).filter(Boolean));
  const areaOptions = plannerAreaOptions(projectId);
  const picked = areaOptions.filter(option => selected.has(Number(option.value)));
  const summary = picked.length ? `${picked.length} · ${picked.map(option => option.label).join(', ')}` : 'Bez obszaru';
  return `<details class="multi-user-select planner-area-multiselect" data-plan-areas data-empty-label="Bez obszaru"><summary>${escapeHtml(summary)}</summary><div class="mentions assignee-grid"><input class="multi-choice-search" type="search" placeholder="Szukaj obszaru…"><label class="mention planner-no-area-option"><input type="checkbox" data-plan-area-none value="" ${picked.length ? '' : 'checked'}><span><b>Bez obszaru</b><small>Pracownik pozostaje w planie projektu bez przypisania obszaru.</small></span></label>${areaOptions.map(option => `<label class="mention"><input type="checkbox" data-plan-area value="${escapeHtml(option.value)}" ${selected.has(Number(option.value)) ? 'checked' : ''}><span>${escapeHtml(option.label)}</span></label>`).join('')}</div></details>`;
}

function plannerEditorEntries(entries) {
  const grouped = [];
  const workGroups = new Map();
  (entries || []).forEach(entry => {
    const activity = entry.activity_type || (entry.transport_mode === 'transport_only' ? 'transport' : 'work');
    if (activity === 'transport') { grouped.push({ ...entry, activity_type: 'transport' }); return; }
    const scopeKind = entry.controller_group_id ? 'areas' : 'none';
    const key = [scopeKind, entry.work_mode || 'online', entry.shift || 'Dzień', Number(entry.count_in_manpower) === 0 ? 0 : 1, entry.allocated_hours ?? ''].join('\u001f');
    if (!workGroups.has(key)) {
      const draft = { ...entry, activity_type: 'work', controller_group_ids: [], area_notes: {} };
      workGroups.set(key, draft); grouped.push(draft);
    }
    if (entry.controller_group_id) { workGroups.get(key).controller_group_ids.push(Number(entry.controller_group_id)); workGroups.get(key).area_notes[Number(entry.controller_group_id)] = entry.note || ''; }
  });
  return grouped;
}

function updatePlannerAreaPicker(details) {
  const areaInputs = [...details.querySelectorAll('[data-plan-area]')];
  const noneInput = details.querySelector('[data-plan-area-none]');
  const selected = areaInputs.filter(input => input.checked);
  noneInput.checked = !selected.length;
  const names = selected.map(input => input.closest('label').querySelector('span').textContent.trim());
  details.querySelector('summary').textContent = names.length ? `${names.length} · ${names.join(', ')}` : details.dataset.emptyLabel;
}

function plannerEntryRow(entry = {}) {
  const projectId = Number(state.plannerCell?.targetProjectId || state.me.current_project?.id || 0);
  const project = plannerProjectConfig(projectId);
  const activity = entry.activity_type || (entry.transport_mode === 'transport_only' ? 'transport' : 'work');
  const transport = activity === 'transport';
  const selectedAreas = Array.isArray(entry.controller_group_ids) ? entry.controller_group_ids : entry.controller_group_id ? [entry.controller_group_id] : [];
  const modeControl = activity === 'transport'
    ? plannerTransportDurationFields(entry.duration_hours)
    : `<select data-plan-mode aria-label="Tryb pracy">${selectOptions([{ value: 'online', label: 'Online · fabryka' }, { value: 'offline', label: 'Offline · biuro' }], entry.work_mode || 'online', null)}</select>`;
  const areaNotes = escapeHtml(JSON.stringify(entry.area_notes || {}));
  return `<div class="planner-entry-row ${transport ? 'transport-entry' : ''}" data-plan-entry-id="${entry.id || ''}" data-area-notes="${areaNotes}"><select data-plan-activity aria-label="Rodzaj aktywności">${selectOptions([{ value: 'work', label: 'Praca' }, { value: 'transport', label: 'Transport · T' }], activity, null)}</select><div class="planner-area-picker" ${transport ? 'hidden' : ''}>${plannerAreaPicker(selectedAreas, projectId)}</div><select data-plan-vehicle ${transport ? '' : 'hidden disabled'} aria-label="Auto lub transport">${selectOptions(plannerVehicleOptions(projectId), entry.vehicle_id || '', null)}</select><select data-plan-shift ${transport ? 'hidden disabled' : ''}>${selectOptions(project?.shifts?.length ? project.shifts : options('shift'), entry.shift || 'Dzień', null)}</select><span class="planner-entry-mode">${modeControl}</span><label class="planner-allocation" ${transport ? 'hidden' : ''} title="Godziny przypisane do tego projektu; puste pole oznacza automatyczny równy podział"><span>Godziny projektu</span><input data-plan-allocated-hours type="number" min="0" max="24" step="0.25" value="${entry.allocated_hours ?? ''}" placeholder="auto"></label><label class="planner-manpower-toggle" ${transport ? 'hidden' : ''} title="Zaznaczenie pola oznacza, że pracownik będzie wliczany do Manpoweru danego dnia"><input type="checkbox" data-plan-manpower ${Number(entry.count_in_manpower) === 0 ? '' : 'checked'}><span>Manpower</span></label><input data-plan-note value="${escapeHtml(entry.note || '')}" placeholder="${selectedAreas.length ? 'Komentarz wspólny (opcjonalnie)' : 'Komentarz (opcjonalnie)'}"><button type="button" class="mini remove-plan-entry" aria-label="Usuń aktywność">×</button><div class="planner-area-comments" ${transport || !selectedAreas.length ? 'hidden' : ''}></div></div>`;
}

function syncPlannerAreaComments(row) {
  const container = row.querySelector('.planner-area-comments'); if (!container) return;
  let saved = {}; try { saved = JSON.parse(row.dataset.areaNotes || '{}'); } catch { saved = {}; }
  container.querySelectorAll('[data-plan-area-note]').forEach(input => { saved[input.dataset.planAreaNote] = input.value; });
  row.dataset.areaNotes = JSON.stringify(saved);
  const selected = [...row.querySelectorAll('[data-plan-area]:checked')];
  container.hidden = row.querySelector('[data-plan-activity]').value === 'transport' || !selected.length;
  container.innerHTML = selected.map(input => { const label=input.closest('label')?.querySelector('span')?.textContent?.trim() || `Obszar ${input.value}`; return `<label><span>${escapeHtml(label)}</span><input data-plan-area-note="${input.value}" value="${escapeHtml(saved[input.value] || '')}" placeholder="Komentarz dla tego obszaru"></label>`; }).join('');
}

function plannerTransportDurationFields(durationHours = null) {
  const duration = plannerTransportParts(durationHours || plannerDefaultTransportMinutes() / 60);
  return `<span class="planner-transport-duration"><label><span>Godziny</span><input data-plan-duration-hours type="number" min="0" step="1" value="${duration.hours}" required aria-label="Godziny transportu"></label><label><span>Minuty</span><input data-plan-duration-minutes type="number" min="0" max="59" step="1" value="${duration.minutes}" required aria-label="Minuty transportu"></label></span>`;
}

function bindPlannerEntryRows() {
  $$('.remove-plan-entry').forEach(button => button.onclick = () => button.closest('.planner-entry-row').remove());
  $$('[data-plan-activity]').forEach(select => select.onchange = () => {
    const row = select.closest('.planner-entry-row'); const transport = select.value === 'transport';
    row.classList.toggle('transport-entry', transport);
    row.querySelector('.planner-area-picker').hidden = transport;
    const shift = row.querySelector('[data-plan-shift]'); shift.hidden = transport; shift.disabled = transport;
    const vehicle = row.querySelector('[data-plan-vehicle]'); vehicle.hidden = !transport; vehicle.disabled = !transport;
    row.querySelector('.planner-manpower-toggle').hidden = transport;
    row.querySelector('.planner-allocation').hidden = transport;
    row.querySelector('.planner-area-comments').hidden = transport;
    row.querySelector('.planner-entry-mode').innerHTML = transport ? plannerTransportDurationFields() : `<select data-plan-mode aria-label="Tryb pracy">${selectOptions([{ value: 'online', label: 'Online · fabryka' }, { value: 'offline', label: 'Offline · biuro' }], 'online', null)}</select>`;
  });
  $$('.planner-area-multiselect').forEach(details => {
    const noneInput = details.querySelector('[data-plan-area-none]');
    noneInput.onchange = () => {
      if (noneInput.checked) details.querySelectorAll('[data-plan-area]').forEach(input => { input.checked = false; });
      updatePlannerAreaPicker(details); syncPlannerAreaComments(details.closest('.planner-entry-row'));
    };
    details.querySelectorAll('[data-plan-area]').forEach(input => { input.onchange = () => { if (input.checked) noneInput.checked = false; updatePlannerAreaPicker(details); syncPlannerAreaComments(details.closest('.planner-entry-row')); }; });
    details.querySelector('.multi-choice-search').oninput = event => {
      const term = event.currentTarget.value.trim().toLocaleLowerCase('pl');
      details.querySelectorAll('label:not(.planner-no-area-option)').forEach(label => { label.hidden = Boolean(term) && !label.textContent.toLocaleLowerCase('pl').includes(term); });
    };
    syncPlannerAreaComments(details.closest('.planner-entry-row'));
  });
}

function openPlannerCell(userId, date, targetProjectId = Number(state.me.current_project?.id || 0)) {
  if (!canCoordinate()) return;
  const user = (state.planner.users || []).find(item => item.id === userId);
  if (!user) return toast('Nie znaleziono użytkownika projektu', true);
  const currentProjectId = Number(state.me.current_project?.id || 0);
  const foreignProject = Number(targetProjectId) !== currentProjectId;
  const project = plannerProjectConfig(targetProjectId);
  if (foreignProject && !(project?.eligible_user_ids || []).map(Number).includes(Number(userId))) return toast('Ta osoba nie jest aktywna w wybranym projekcie', true);
  const source = foreignProject ? state.planner.cross_project_entries : state.planner.entries;
  const entries = source.filter(item => item.user_id === userId && item.plan_date === date && Number(item.project_id || currentProjectId) === Number(targetProjectId));
  const absence = (state.planner.absences || []).find(item => item.user_id === userId && item.absence_date === date);
  const timeDetail = (state.planner.time_details?.details || []).find(item => item.user_id === userId && item.date === date) || {};
  const otherProjects = [...new Set((state.planner.cross_project_entries || []).filter(item => item.user_id === userId && item.plan_date === date).map(item => item.project_code).filter(Boolean))];
  const canManageTarget = !foreignProject || Boolean(project?.can_manage);
  state.plannerCell = { userId, date, targetProjectId: Number(targetProjectId), foreignProject, canManageTarget, originalEntries: entries.map(entry => ({ ...entry })) };
  $('#planner-dialog-title').textContent = `${user?.display_name || 'Pracownik'} · ${displayDate(date)} · ${project?.planner_short_code || project?.code || state.me.current_project?.planner_short_code || state.me.current_project?.code}`;
  $('#planner-dialog-description').textContent = foreignProject
    ? canManageTarget
      ? `Edytujesz plan projektu ${project?.name || project?.code} jako jego manager. Zmiany zostaną zapisane bez dodatkowej akceptacji.`
      : `Edytujesz plan projektu ${project?.name || project?.code}. Oficjalny plan pozostanie oznaczony ×, a propozycja ? zastąpi go dopiero po akceptacji managera tego projektu. Transport zostanie zapisany bezpośrednio.`
    : otherProjects.length
    ? `Uwaga: ta osoba ma już plan w ${otherProjects.join(', ')}. Zapis utworzy kolizję wymagającą decyzji managera.`
    : 'W jednym wpisie możesz wybrać kilka obszarów albo pozostawić opcję „Bez obszaru”. Obszar nadrzędny wyklucza jego podobszary.';
  $('#planner-entry-list').innerHTML = plannerEditorEntries(entries).map(plannerEntryRow).join('') || plannerEntryRow();
  $('#planner-day-kind').value = absence?.absence_type || 'work';
  $('#planner-absence-note').value = absence?.note || '';
  $('#planner-day-comment').value = (state.planner.day_comments || []).find(item => Number(item.user_id) === Number(userId) && item.plan_date === date)?.comment || '';
  $('#planner-work-start').value = timeDetail.work_start_time || '';
  $('#planner-work-end').value = timeDetail.work_end_time || '';
  $('#planner-raw-balance').value = timeDetail.overtime_raw_balance_override ?? '';
  $('#planner-weighted-balance').value = timeDetail.overtime_weighted_balance_override ?? '';
  $('#planner-raw-balance').placeholder = `Aktualnie: ${Number(timeDetail.overtime_raw_cumulative || 0).toFixed(1)} h`;
  $('#planner-weighted-balance').placeholder = `Aktualnie: ${Number(timeDetail.overtime_weighted_cumulative || 0).toFixed(1)} h`;
  $('#planner-adjustment-note').value = timeDetail.adjustment_note || '';
  $('.planner-day-kind').hidden = foreignProject && !state.plannerRawPlanId;
  $('.planner-adjustments').hidden = foreignProject || Boolean(state.plannerRawPlanId);
  bindPlannerEntryRows();
  updatePlannerDayKind();
  $('#planner-dialog').showModal();
}

function updatePlannerDayKind() {
  const work = $('#planner-day-kind').value === 'work';
  $('#planner-entry-list').classList.toggle('disabled-section', !work);
  $('#planner-entry-list').querySelectorAll('input,select,textarea,button').forEach(input => { input.disabled = !work; });
  $('#planner-entry-add').disabled = !work;
  $('#planner-absence-note').disabled = work;
  $('#planner-work-start').disabled = !work;
  $('#planner-work-end').disabled = !work;
}

async function savePlannerCell(event) {
  event.preventDefault(); if (!state.plannerCell) return;
  const absenceType = $('#planner-day-kind').value === 'work' ? '' : $('#planner-day-kind').value;
  const entries = absenceType ? [] : $$('#planner-entry-list .planner-entry-row').flatMap(row => {
    const activity = row.querySelector('[data-plan-activity]').value; const transport = activity === 'transport';
    const allocationValue = row.querySelector('[data-plan-allocated-hours]')?.value;
    const common = { id: Number(row.dataset.planEntryId) || null, activity_type: activity, work_mode: transport ? 'offline' : row.querySelector('[data-plan-mode]').value, shift: transport ? 'Dzień' : row.querySelector('[data-plan-shift]').value, transport_mode: transport ? 'transport_only' : 'none', duration_hours: transport ? plannerTransportHoursFromParts(row.querySelector('[data-plan-duration-hours]').value, row.querySelector('[data-plan-duration-minutes]').value) : 0, allocated_hours: !transport && allocationValue !== '' ? Number(allocationValue) : null, count_in_manpower: !transport && row.querySelector('[data-plan-manpower]').checked ? 1 : 0, vehicle_id: transport ? Number(row.querySelector('[data-plan-vehicle]').value) || null : null, note: row.querySelector('[data-plan-note]').value };
    if (transport) return [{ ...common, controller_group_id: null }];
    const selectedAreaIds = [...row.querySelectorAll('[data-plan-area]:checked')].map(input => Number(input.value)).filter(Boolean);
    return (selectedAreaIds.length ? selectedAreaIds : [null]).map(controllerGroupId => ({ ...common, id: null, controller_group_id: controllerGroupId, allow_without_area: controllerGroupId ? 0 : 1, note: controllerGroupId ? (row.querySelector(`[data-plan-area-note="${controllerGroupId}"]`)?.value || common.note) : common.note }));
  });
  if (entries.some(entry => entry.activity_type === 'transport' && entry.duration_hours === null)) return toast('Podaj dodatni czas transportu w pełnych godzinach i minutach', true);
  if (!state.plannerCell.foreignProject && !await confirmMixedPlannerModes(state.plannerCell.userId, state.plannerCell.date, entries)) return;
  const previous = plannerDaySnapshot(state.plannerCell.userId, state.plannerCell.date);
  try {
    if (state.plannerRawPlanId) {
      await api(`/api/planner/raw-plans/${state.plannerRawPlanId}/day`, { method: 'PUT', body: JSON.stringify({ target_project_id: state.plannerCell.targetProjectId, user_id: state.plannerCell.userId, plan_date: state.plannerCell.date, entries, absence_type: absenceType, absence_note: $('#planner-absence-note').value }) });
      $('#planner-dialog').close(); toast('Prywatny plan RAW został zaktualizowany'); await reloadPlanner(); return;
    }
    if (state.plannerCell.foreignProject) {
      const workChanged = plannerWorkSignature(entries) !== plannerWorkSignature(state.plannerCell.originalEntries || []);
      const transportOnlyUpdate = !state.plannerCell.canManageTarget && !workChanged;
      const submittedEntries = transportOnlyUpdate ? entries.filter(entry => entry.activity_type === 'transport') : entries;
      const result = await api('/api/planner/cross-project-requests', { method: 'POST', body: JSON.stringify({ target_project_id: state.plannerCell.targetProjectId, items: [{ user_id: state.plannerCell.userId, plan_date: state.plannerCell.date, entries: submittedEntries, replace_all: transportOnlyUpdate ? 0 : 1, transport_only_update: transportOnlyUpdate ? 1 : 0, note: entries.map(item => item.note).filter(Boolean).join(' · ') }] }) });
      $('#planner-dialog').close();
      toast(result.awaiting_approval ? 'Plan pracy zaktualizowano i przekazano do akceptacji; transport zapisano bezpośrednio' : transportOnlyUpdate ? 'Transport zaktualizowano bezpośrednio' : 'Plan projektu zaktualizowano bez dodatkowej akceptacji');
      await reloadPlanner(); return;
    }
    const beforeRequest = plannerDayRequest({ userId: state.plannerCell.userId, date: state.plannerCell.date }, previous.entries, previous);
    const request = { user_id: state.plannerCell.userId, plan_date: state.plannerCell.date, entries, absence_type: absenceType, absence_note: $('#planner-absence-note').value, day_comment: $('#planner-day-comment').value, actual_hours_adjustment: previous.actual_hours_adjustment, overtime_raw_adjustment: previous.overtime_raw_adjustment, overtime_weighted_adjustment: previous.overtime_weighted_adjustment, work_start_time: $('#planner-work-start').value, work_end_time: $('#planner-work-end').value, overtime_raw_balance_override: $('#planner-raw-balance').value === '' ? null : Number($('#planner-raw-balance').value), overtime_weighted_balance_override: $('#planner-weighted-balance').value === '' ? null : Number($('#planner-weighted-balance').value), adjustment_note: $('#planner-adjustment-note').value };
    await api('/api/planner/day', { method: 'PUT', body: JSON.stringify(request) });
    rememberPlannerAction([beforeRequest], [request]);
    $('#planner-dialog').close(); toast('Plan dnia i korekty czasu zostały zapisane'); await reloadPlanner();
  } catch (error) { toast(error.message, true); }
}

async function confirmMixedPlannerModes(userId, date, entries) {
  const finalModes = new Set(entries.filter(item => (item.activity_type || (item.transport_mode === 'transport_only' ? 'transport' : 'work')) === 'work').map(item => item.work_mode || 'online'));
  if (finalModes.size < 2) return true;
  toast('Pracownik może pracować danego dnia wyłącznie ON albo wyłącznie OFF — również pomiędzy projektami.', true);
  return false;
}

async function openPlannerParticipants() {
  const participants = state.users.filter(item => item.project_active && item.active);
  const result = await openBulkChoice({
    title: 'Uczestnicy Plannera',
    description: 'Wyszukaj osoby i zmień ich udział. Wyłączenie uczestnika usuwa jego plan, korekty czasu i przypisane obszary z bieżącego projektu.',
    submitLabel: 'Zapisz uczestników',
    selectedIds: participants.filter(item => item.planner_enabled).map(item => item.id),
    items: participants.map(item => ({ id: item.id, label: item.display_name, detail: roleName(item.system_role === 'system_admin' ? 'system_admin' : item.project_role), badge: item.planner_enabled ? 'Aktywny w Plannerze' : 'Poza Plannerem' }))
  });
  if (result === null) return;
  const changed = participants.filter(item => result.has(item.id) !== Boolean(item.planner_enabled));
  if (!changed.length) return toast('Lista uczestników nie wymaga zmian');
  const disabled = changed.filter(item => !result.has(item.id));
  if (disabled.length && !await uiConfirm('Wyłącz uczestników Plannera', `Plan i przypisane obszary zostaną usunięte dla ${disabled.length} ${disabled.length === 1 ? 'osoby' : 'osób'} w bieżącym projekcie.`, 'Wyłącz i usuń przypisania', true)) return;
  try {
    let removedAssignments = 0;
    for (let index = 0; index < changed.length; index += 20) {
      const saved = await Promise.all(changed.slice(index, index + 20).map(item => api(`/api/users/${item.id}/planner`, { method: 'PUT', body: JSON.stringify({ planner_enabled: result.has(item.id) ? 1 : 0 }) })));
      removedAssignments += saved.reduce((sum, item) => sum + Number(item.removed_assignments || 0), 0);
    }
    toast(`Lista uczestników Plannera została zapisana${removedAssignments ? ` · usunięto ${removedAssignments} przypisań` : ''}`);
    await loadData();
  } catch (error) { toast(error.message, true); }
}

function openBulkChoice({ title, description = '', submitLabel = 'Zastosuj wybór', items = [], selectedIds = [] }) {
  if (state.bulkChoice?.resolve) state.bulkChoice.resolve(null);
  $('#bulk-choice-title').textContent = title;
  $('#bulk-choice-description').textContent = description;
  $('#bulk-choice-apply').textContent = submitLabel;
  $('#bulk-choice-search').value = '';
  const promise = new Promise(resolve => { state.bulkChoice = { items, draft: new Set(selectedIds.map(Number)), resolve }; });
  renderBulkChoiceList();
  if (!$('#bulk-choice-dialog').open) $('#bulk-choice-dialog').showModal();
  requestAnimationFrame(() => $('#bulk-choice-search').focus());
  return promise;
}

function visibleBulkChoiceItems() {
  const term = ($('#bulk-choice-search')?.value || '').trim().toLocaleLowerCase('pl');
  return (state.bulkChoice?.items || []).filter(item => !term || `${item.label} ${item.detail || ''} ${item.badge || ''} ${item.search || ''}`.toLocaleLowerCase('pl').includes(term));
}

function renderBulkChoiceList() {
  if (!state.bulkChoice) return;
  const visible = visibleBulkChoiceItems();
  $('#bulk-choice-list').innerHTML = visible.map(item => `<label class="bulk-choice-row" style="--choice-depth:${Math.max(0, Number(item.depth || 0))}"><input type="checkbox" value="${Number(item.id)}" ${state.bulkChoice.draft.has(Number(item.id)) ? 'checked' : ''}><span><b>${escapeHtml(item.label)}</b>${item.detail ? `<small>${escapeHtml(item.detail)}</small>` : ''}</span>${item.badge ? `<em>${escapeHtml(item.badge)}</em>` : ''}</label>`).join('') || '<div class="empty">Brak wyników dla podanego wyszukiwania.</div>';
  $('#bulk-choice-count').textContent = `${state.bulkChoice.draft.size} wybranych · ${visible.length} widocznych`;
  $$('#bulk-choice-list input[type="checkbox"]').forEach(input => input.addEventListener('change', () => {
    const id = Number(input.value);
    if (input.checked) state.bulkChoice.draft.add(id); else state.bulkChoice.draft.delete(id);
    $('#bulk-choice-count').textContent = `${state.bulkChoice.draft.size} wybranych · ${visible.length} widocznych`;
  }));
}

function setVisibleBulkChoices(selected) {
  if (!state.bulkChoice) return;
  for (const item of visibleBulkChoiceItems()) selected ? state.bulkChoice.draft.add(Number(item.id)) : state.bulkChoice.draft.delete(Number(item.id));
  renderBulkChoiceList();
}

function applyBulkChoice() {
  if (!state.bulkChoice) return;
  closeBulkChoice(new Set(state.bulkChoice.draft));
}

function closeBulkChoice(result) {
  const manager = state.bulkChoice;
  if (!manager) return;
  state.bulkChoice = null;
  if ($('#bulk-choice-dialog').open) $('#bulk-choice-dialog').close();
  manager.resolve(result);
}

function requirementValueFromCounts(online = 0, offline = 0) {
  const on = Number(online || 0); const off = Number(offline || 0);
  return on || off ? `${on}/${off}` : '';
}

function mergePlannerRequirementData(data) {
  const loaded = new Map();
  for (const row of data.requirements || []) {
    const key = `${row.controller_group_id}:${row.plan_date}`;
    if (!loaded.has(key)) loaded.set(key, { online: 0, offline: 0 });
    loaded.get(key)[row.work_mode] += Number(row.required_count || 0);
  }
  for (const row of data.project_requirements || []) {
    const key = `0:${row.plan_date}`;
    if (!loaded.has(key)) loaded.set(key, { online: 0, offline: 0 });
    loaded.get(key)[row.work_mode] = Number(row.required_count || 0);
  }
  const days = dateRange(state.requirementFrom, addDays(state.requirementFrom, state.requirementDays - 1));
  for (const group of [{id:0},...(data.areas || []).filter(group=>!group.parent_id)]) for (const date of days) {
    const key = `${group.id}:${date}`; const value = loaded.get(key) || {};
    const entered = requirementValueFromCounts(value.online, value.offline);
    if (!state.requirementDirty.has(key)) state.requirementDraft.set(key, entered);
    state.requirementBaseline.set(key, entered);
  }
}

function plannerRequirementProjects(source = state.planner) {
  return source?.requirement_projects?.length ? source.requirement_projects : [{ id: Number(state.me.current_project?.id || 0), code: state.me.current_project?.code, planner_short_code: state.me.current_project?.planner_short_code, areas: source?.areas || [], requirements: source?.requirements || [], area_day_summary: source?.area_day_summary || [], summary: source?.summary || [] }];
}

function plannerRequirementData(projectId, source = state.planner) {
  const project = plannerRequirementProjects(source).find(item => Number(item.id) === Number(projectId)) || plannerRequirementProjects(source)[0];
  return { ...project, source, project_requirements:project.project_requirements || (Number(project.id)===Number(state.me.current_project?.id)?source?.project_requirements||[]:[]), can_manage_requirements: source?.can_manage_requirements, entries: [...(source?.entries || []), ...(source?.cross_project_entries || [])].filter(entry => Number(entry.project_id || state.me.current_project?.id) === Number(project.id)) };
}

function prepareInlinePlannerRequirements() {
  const projects = plannerRequirementProjects();
  const projectId = projects.some(project => Number(project.id) === Number(state.requirementProjectId)) ? Number(state.requirementProjectId) : Number(state.me.current_project?.id || projects[0]?.id || 0);
  const reset = state.requirementProjectId !== projectId || state.requirementData?.source !== state.planner;
  state.requirementProjectId = projectId;
  state.requirementFrom = state.plannerFrom; state.requirementDays = state.plannerDays;
  state.requirementData = plannerRequirementData(projectId);
  if (reset) {
    state.requirementDraft = new Map(); state.requirementBaseline = new Map(); state.requirementDirty = new Set();
    state.requirementSelection = null; state.requirementCollapsedGroups = new Set();
  }
  mergePlannerRequirementData(state.requirementData);
}

function togglePlannerRequirementsEditor() {
  if (!state.planner?.can_manage_requirements) return;
  state.plannerRequirementEdit = !state.plannerRequirementEdit;
  clearPlannerSelections(false);
  state.requirementSelection = null; state.requirementFill = null;
  if (state.plannerRequirementEdit) prepareInlinePlannerRequirements();
  renderPlanner();
}

function bindInlinePlannerRequirements() {
  const projectSelect = $('#planner-requirement-project-inline');
  if (projectSelect) {
    projectSelect.value = String(state.requirementProjectId);
    projectSelect.addEventListener('change', event => {
      if (state.requirementDirty.size) { event.target.value = String(state.requirementProjectId); return toast('Zapisz lub odrzuć zmiany przed przełączeniem projektu', true); }
      state.requirementProjectId = Number(event.target.value); state.requirementData = null; state.requirementCollapsedGroups = new Set(); prepareInlinePlannerRequirements(); renderPlanner();
    });
  }
  const level = $('#planner-requirement-level-inline');
  if (level) {
    level.value = state.requirementLevel;
    level.addEventListener('change', event => { state.requirementLevel = event.target.value; state.requirementSelection = null; renderPlanner(); });
  }
  $$('[data-requirement-toggle-inline]').forEach(button => button.addEventListener('click', () => {
    const id = Number(button.dataset.requirementToggleInline);
    if (state.requirementCollapsedGroups.has(id)) state.requirementCollapsedGroups.delete(id); else state.requirementCollapsedGroups.add(id);
    state.requirementSelection = null; renderPlanner();
  }));
  $('#planner-requirement-collapse-inline')?.addEventListener('click', () => { requirementCollapsibleGroups().forEach(id => state.requirementCollapsedGroups.add(id)); state.requirementSelection = null; renderPlanner(); });
  $('#planner-requirement-expand-inline')?.addEventListener('click', () => { state.requirementCollapsedGroups.clear(); state.requirementSelection = null; renderPlanner(); });
  $('#planner-requirement-copy-inline')?.addEventListener('click', copyRequirementSelection);
  $('#planner-requirement-paste-inline')?.addEventListener('click', pasteRequirementSelectionFromClipboard);
  $('#planner-requirements-save-inline')?.addEventListener('click', savePlannerRequirementsCalendar);
  bindRequirementGrid(); updateRequirementDirtyCount();
}

async function openPlannerRequirements(date = today(), groupId = '') {
  if (!state.planner?.can_manage_requirements) return;
  state.requirementFrom = state.plannerFrom || mondayOf(date);
  state.requirementDays = state.plannerDays;
  state.requirementProjectId = Number(state.requirementProjectId || state.me.current_project?.id || 0);
  state.requirementData = plannerRequirementData(state.requirementProjectId);
  state.requirementDraft = new Map(); state.requirementBaseline = new Map(); state.requirementDirty = new Set();
  state.requirementSelection = null; state.requirementCollapsedGroups = new Set();
  mergePlannerRequirementData(state.requirementData);
  $('#requirement-days').value = String(state.requirementDays);
  renderPlannerRequirementsCalendar();
  if (!$('#planner-requirements-dialog').open) $('#planner-requirements-dialog').showModal();
}

async function loadPlannerRequirementRange() {
  if (!state.requirementFrom) return;
  state.requirementSelection = null;
  $('#planner-requirements-calendar').innerHTML = '<div class="empty">Wczytywanie zapotrzebowania…</div>';
  try {
    const loaded = await api(`/api/planner?from=${state.requirementFrom}&to=${addDays(state.requirementFrom, state.requirementDays - 1)}`);
    state.requirementData = plannerRequirementData(state.requirementProjectId, loaded);
    mergePlannerRequirementData(state.requirementData);
    renderPlannerRequirementsCalendar();
  } catch (error) { toast(error.message, true); }
}

function requirementHierarchy() {
  const groups = state.requirementData?.areas || [];
  const eligible = [{id:0,name:'Cały projekt',path_label:'Cały projekt',path_names:['Cały projekt'],depth:0,parent_id:null,is_project_total:true},...groups.filter(group => !group.parent_id)];
  const allowed = new Set(eligible.map(group => Number(group.id)));
  const children = new Map();
  for (const group of eligible) {
    const parent = allowed.has(Number(group.parent_id)) ? Number(group.parent_id) : 0;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(group);
  }
  const rows = [];
  const walk = (parentId, depth) => {
    for (const group of children.get(parentId) || []) {
      const hasChildren = Boolean(children.get(Number(group.id))?.length);
      rows.push({ group, depth, hasChildren });
      if (hasChildren && !state.requirementCollapsedGroups.has(Number(group.id))) walk(Number(group.id), depth + 1);
    }
  };
  rows.push({group:eligible[0],depth:0,hasChildren:false});
  for(const group of eligible.slice(1)) rows.push({group,depth:0,hasChildren:false});
  return { rows, children };
}

function requirementCollapsibleGroups() {
  const { children } = requirementHierarchy();
  return [...children.entries()].filter(([id, items]) => id && items.length).map(([id]) => Number(id));
}

function renderPlannerRequirementsCalendar() {
  if (!state.requirementData?.can_manage_requirements) return;
  const days = dateRange(state.requirementFrom, addDays(state.requirementFrom, state.requirementDays - 1));
  const { rows } = requirementHierarchy();
  state.requirementSelection = null; state.requirementFill = null;
  $('#requirement-days').value = String(state.requirementDays);
  $('#requirement-date-range').textContent = `${displayDate(days[0])} – ${displayDate(days.at(-1))}`;
  $('#planner-requirements-calendar').innerHTML = `<div class="requirement-grid-help"><b>Jedna komórka = ON/OFF</b><span>Wpisz np. <code>4/2</code>. Przeciągnij po komórkach, użyj <code>Ctrl+C</code>/<code>Ctrl+V</code> albo przeciągnij uchwyt zaznaczenia, aby powielić wartości.</span></div><div class="requirement-calendar-scroll"><table style="--requirement-days:${days.length}"><thead><tr><th class="requirement-area">Hierarchia obszarów</th>${days.map(date => `<th class="${[0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? 'weekend' : ''}"><b>${date.slice(8, 10)}</b><small>${new Intl.DateTimeFormat('pl-PL', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}<br>${isoWeek(date).label}</small></th>`).join('')}</tr></thead><tbody>${rows.map(({ group, depth, hasChildren }, rowIndex) => `<tr><th class="requirement-area"><div class="requirement-tree-node" style="--requirement-depth:${depth}">${hasChildren ? `<button type="button" class="requirement-tree-toggle" data-requirement-toggle="${group.id}" aria-label="${state.requirementCollapsedGroups.has(Number(group.id)) ? 'Rozwiń' : 'Zwiń'} ${escapeHtml(group.name)}">${state.requirementCollapsedGroups.has(Number(group.id)) ? '›' : '⌄'}</button>` : '<i></i>'}<span><b>${escapeHtml(group.name)}</b>${depth ? `<small>${escapeHtml((group.path_names || []).slice(0, -1).join(' / '))}</small>` : ''}</span></div></th>${days.map((date, columnIndex) => { const key = `${group.id}:${date}`; const entered = state.requirementDraft.get(key) || ''; return `<td data-requirement-cell data-group="${group.id}" data-date="${date}" data-grid-row="${rowIndex}" data-grid-column="${columnIndex}"><input class="requirement-grid-input ${parseRequirementValue(entered) ? '' : 'invalid'}" value="${escapeHtml(entered)}" placeholder="0/0" inputmode="numeric" data-requirement-value aria-label="${escapeHtml(group.path_label || group.name)}, ${displayDate(date)}, ON/OFF"><i class="requirement-fill-handle" title="Przeciągnij, aby powielić zaznaczenie"></i></td>`; }).join('')}</tr>`).join('') || `<tr><td colspan="${days.length + 1}" class="empty">Brak obszarów.</td></tr>`}</tbody></table></div>`;
  $$('[data-requirement-toggle]').forEach(button => button.addEventListener('click', () => {
    const id = Number(button.dataset.requirementToggle);
    if (state.requirementCollapsedGroups.has(id)) state.requirementCollapsedGroups.delete(id); else state.requirementCollapsedGroups.add(id);
    renderPlannerRequirementsCalendar();
  }));
  bindRequirementGrid();
  updateRequirementDirtyCount();
}

function parseRequirementValue(value) {
  const text = String(value || '').trim();
  if (!text) return { online_required: 0, offline_required: 0 };
  const parts = text.split(/[\/;,:\s]+/).filter(Boolean);
  if (parts.length > 2 || parts.some(item => !/^\d+$/.test(item))) return null;
  const online = Number(parts[0] || 0); const offline = Number(parts[1] || 0);
  if (online > 999 || offline > 999) return null;
  return { online_required: online, offline_required: offline };
}

function bindRequirementGrid() {
  state.requirementGridAbort?.abort();
  const controller = new AbortController(); state.requirementGridAbort = controller;
  const signal = controller.signal; const cells = requirementGridCells();
  cells.forEach(cell => {
    const input = cell.querySelector('[data-requirement-value]');
    input.addEventListener('input', () => writeRequirementCell(cell, input.value), { signal });
    input.addEventListener('focus', () => {
      const position = requirementCellPosition(cell);
      if (!requirementSelectionContains(position)) setRequirementSelection(position, position);
    }, { signal });
    input.addEventListener('keydown', event => navigateRequirementGrid(event, cell), { signal });
    cell.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      if (event.target.closest('.requirement-fill-handle')) return startRequirementFill(event);
      const position = requirementCellPosition(cell);
      const anchor = event.shiftKey && state.requirementSelection?.anchor ? state.requirementSelection.anchor : position;
      setRequirementSelection(anchor, position);
      state.requirementPointerSelecting = true;
    }, { signal });
    cell.addEventListener('pointerenter', event => {
      if (!state.requirementPointerSelecting || !(event.buttons & 1)) return;
      setRequirementSelection(state.requirementSelection?.anchor || requirementCellPosition(cell), requirementCellPosition(cell));
    }, { signal });
  });
  const root = requirementGridRoot();
  if (!root) return;
  root.addEventListener('keydown', event => {
    if (event.key === 'Delete' && state.requirementSelection) { event.preventDefault(); clearRequirementSelection(); return; }
    if (!(event.ctrlKey || event.metaKey)) return;
    if (event.key.toLowerCase() === 'c') { event.preventDefault(); copyRequirementSelection(); }
    if (event.key.toLowerCase() === 'a' && event.target.closest('[data-requirement-cell]')) {
      event.preventDefault(); const all = requirementGridCells();
      if (all.length) setRequirementSelection(requirementCellPosition(all[0]), requirementCellPosition(all.at(-1)));
    }
  }, { signal });
  root.addEventListener('paste', event => {
    const text = event.clipboardData?.getData('text/plain');
    if (!text || !state.requirementSelection) return;
    event.preventDefault(); pasteRequirementText(text);
  }, { signal });
  root.addEventListener('contextmenu', event => {
    const cell = event.target.closest('[data-requirement-cell]'); if (!cell) return;
    event.preventDefault(); const position = requirementCellPosition(cell);
    if (!requirementSelectionContains(position)) setRequirementSelection(position, position);
    showRequirementContextMenu(event);
  }, { signal });
  document.addEventListener('pointermove', moveRequirementFill, { signal });
  document.addEventListener('pointerup', finishRequirementPointerAction, { signal });
}

function clearRequirementSelection() {
  const bounds = requirementSelectionBounds(); if (!bounds) return;
  for (let row = bounds.top; row <= bounds.bottom; row += 1) for (let column = bounds.left; column <= bounds.right; column += 1) {
    const cell = requirementCellAt(row, column); if (cell) writeRequirementCell(cell, '');
  }
}

function showRequirementContextMenu(event) {
  const menu = $('#context-menu');
  menu.innerHTML = `<section><b>Zaznaczone zapotrzebowanie</b><button data-action="copy">Kopiuj <small>Ctrl+C</small></button><button data-action="paste">Wklej <small>Ctrl+V</small></button><button class="danger-text" data-action="delete">Usuń wartości <small>Delete</small></button></section>`;
  menu.style.left = `${Math.min(event.clientX, innerWidth - 250)}px`; menu.style.top = `${Math.min(event.clientY, innerHeight - 170)}px`; menu.classList.remove('hidden');
  menu.querySelector('[data-action="copy"]').addEventListener('click', () => { menu.classList.add('hidden'); copyRequirementSelection(); });
  menu.querySelector('[data-action="paste"]').addEventListener('click', () => { menu.classList.add('hidden'); pasteRequirementSelectionFromClipboard(); });
  menu.querySelector('[data-action="delete"]').addEventListener('click', () => { menu.classList.add('hidden'); clearRequirementSelection(); });
}

function requirementGridRoot() { return state.calendarRequirementEdit && state.view === 'calendar' ? $('#calendar-inline-requirements') : state.plannerRequirementEdit ? $('#planner-inline-requirements') : $('#planner-requirements-calendar'); }
function requirementGridCells() { return [...(requirementGridRoot()?.querySelectorAll('[data-requirement-cell]') || [])]; }
function requirementCellPosition(cell) { return { row: Number(cell.dataset.gridRow), column: Number(cell.dataset.gridColumn) }; }
function requirementCellAt(row, column) { return requirementGridRoot()?.querySelector(`[data-requirement-cell][data-grid-row="${row}"][data-grid-column="${column}"]`) || null; }

function requirementSelectionBounds(selection = state.requirementSelection) {
  if (!selection) return null;
  return { top: Math.min(selection.anchor.row, selection.focus.row), bottom: Math.max(selection.anchor.row, selection.focus.row), left: Math.min(selection.anchor.column, selection.focus.column), right: Math.max(selection.anchor.column, selection.focus.column) };
}

function requirementSelectionContains(position) {
  const bounds = requirementSelectionBounds();
  return bounds && position.row >= bounds.top && position.row <= bounds.bottom && position.column >= bounds.left && position.column <= bounds.right;
}

function setRequirementSelection(anchor, focus) {
  state.requirementSelection = { anchor: { ...anchor }, focus: { ...focus } };
  const bounds = requirementSelectionBounds();
  requirementGridCells().forEach(cell => {
    const { row, column } = requirementCellPosition(cell);
    cell.classList.toggle('selected', row >= bounds.top && row <= bounds.bottom && column >= bounds.left && column <= bounds.right);
    cell.classList.toggle('selection-corner', row === bounds.bottom && column === bounds.right);
  });
  const count = (bounds.bottom - bounds.top + 1) * (bounds.right - bounds.left + 1);
  const label = `${count} ${count === 1 ? 'komórka' : count < 5 ? 'komórki' : 'komórek'} · ${bounds.bottom - bounds.top + 1} × ${bounds.right - bounds.left + 1}`;
  if ($('#requirement-selection-count')) $('#requirement-selection-count').textContent = label;
  if ($('#requirement-selection-count-inline')) $('#requirement-selection-count-inline').textContent = label;
}

function normalizedRequirementValue(value) {
  const parsed = parseRequirementValue(value);
  return parsed ? requirementValueFromCounts(parsed.online_required, parsed.offline_required) : String(value || '').trim();
}

function writeRequirementCell(cell, value) {
  const input = cell.querySelector('[data-requirement-value]'); const groupId = Number(cell.dataset.group); const date = cell.dataset.date;
  input.value = String(value ?? '').trim(); input.classList.toggle('invalid', !parseRequirementValue(input.value));
  storeRequirementDraftValue(groupId, date, input.value);
  if (parseRequirementValue(input.value)) updateRequirementAncestors(groupId, date);
  updateRequirementDirtyCount();
}

function storeRequirementDraftValue(groupId, date, value) {
  const key = `${Number(groupId)}:${date}`; const entered = String(value ?? '').trim();
  state.requirementDraft.set(key, entered);
  if (normalizedRequirementValue(entered) === normalizedRequirementValue(state.requirementBaseline.get(key) || '')) state.requirementDirty.delete(key); else state.requirementDirty.add(key);
  const visible = requirementGridRoot()?.querySelector(`[data-requirement-cell][data-group="${Number(groupId)}"][data-date="${date}"] [data-requirement-value]`);
  if (visible && visible.value !== entered) { visible.value = entered; visible.classList.toggle('invalid', !parseRequirementValue(entered)); }
}

function updateRequirementAncestors(groupId, date) {
  const groups = state.requirementData?.areas || []; const byId = new Map(groups.map(group => [Number(group.id), group]));
  let parentId = Number(byId.get(Number(groupId))?.parent_id || 0);
  while (parentId) {
    const children = groups.filter(group => Number(group.parent_id || 0) === parentId);
    const sum = children.reduce((totals, child) => {
      const parsed = parseRequirementValue(state.requirementDraft.get(`${child.id}:${date}`)) || { online_required: 0, offline_required: 0 };
      totals.online += parsed.online_required; totals.offline += parsed.offline_required; return totals;
    }, { online: 0, offline: 0 });
    const key = `${parentId}:${date}`; const current = parseRequirementValue(state.requirementDraft.get(key)) || { online_required: 0, offline_required: 0 };
    const next = requirementValueFromCounts(Math.max(current.online_required, sum.online), Math.max(current.offline_required, sum.offline));
    if (normalizedRequirementValue(state.requirementDraft.get(key) || '') !== normalizedRequirementValue(next)) storeRequirementDraftValue(parentId, date, next);
    parentId = Number(byId.get(parentId)?.parent_id || 0);
  }
}

function updateRequirementDirtyCount() {
  const count = state.requirementDirty.size;
  const label = count === 1 ? '1 niezapisana zmiana' : count > 1 && count < 5 ? `${count} niezapisane zmiany` : count ? `${count} niezapisanych zmian` : 'Brak niezapisanych zmian';
  if ($('#requirement-dirty-count')) $('#requirement-dirty-count').textContent = label;
  if ($('#requirement-dirty-count-inline')) $('#requirement-dirty-count-inline').textContent = label;
  if ($('#planner-requirements-save')) $('#planner-requirements-save').disabled = !count;
  if ($('#planner-requirements-save-inline')) $('#planner-requirements-save-inline').disabled = !count;
  if ($('#calendar-requirements-save')) $('#calendar-requirements-save').disabled = !count;
  if ($('#planner-requirements-open')) $('#planner-requirements-open').textContent = `Zapotrzebowanie${count ? ` · ${count}` : ''}`;
}

function navigateRequirementGrid(event, cell) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    const value = cell.querySelector('[data-requirement-value]').value; const bounds = requirementSelectionBounds();
    if (!bounds) return;
    for (let row = bounds.top; row <= bounds.bottom; row += 1) for (let column = bounds.left; column <= bounds.right; column += 1) {
      const target = requirementCellAt(row, column); if (target) writeRequirementCell(target, value);
    }
    toast('Wartość wpisano do całego zaznaczenia'); return;
  }
  if ((event.ctrlKey || event.metaKey) && ['a', 'c', 'v'].includes(event.key.toLowerCase())) return;
  let { row, column } = requirementCellPosition(cell);
  if (event.key === 'ArrowRight' || event.key === 'Tab' && !event.shiftKey) column += 1;
  else if (event.key === 'ArrowLeft' || event.key === 'Tab' && event.shiftKey) column -= 1;
  else if (event.key === 'ArrowDown' || event.key === 'Enter') row += 1;
  else if (event.key === 'ArrowUp') row -= 1;
  else return;
  const target = requirementCellAt(row, column);
  if (!target) return;
  event.preventDefault(); const targetPosition = requirementCellPosition(target);
  if (event.shiftKey && event.key !== 'Tab') setRequirementSelection(state.requirementSelection?.anchor || requirementCellPosition(cell), targetPosition); else setRequirementSelection(targetPosition, targetPosition);
  target.querySelector('input').focus(); target.querySelector('input').select();
}

function requirementSelectionText() {
  const bounds = requirementSelectionBounds();
  if (!bounds) return '';
  const lines = [];
  for (let row = bounds.top; row <= bounds.bottom; row += 1) {
    const values = [];
    for (let column = bounds.left; column <= bounds.right; column += 1) values.push(requirementCellAt(row, column)?.querySelector('input').value || '');
    lines.push(values.join('\t'));
  }
  return lines.join('\n');
}

async function copyRequirementSelection() {
  const text = requirementSelectionText();
  if (!text && !state.requirementSelection) return toast('Najpierw zaznacz komórkę lub zakres.', true);
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
    else { const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.append(area); area.select(); document.execCommand('copy'); area.remove(); }
    toast('Skopiowano zaznaczony zakres');
  } catch { toast('Przeglądarka zablokowała schowek. Użyj Ctrl+C.', true); }
}

async function pasteRequirementSelectionFromClipboard() {
  if (!state.requirementSelection) return toast('Najpierw zaznacz komórkę lub zakres.', true);
  try { pasteRequirementText(await navigator.clipboard.readText()); }
  catch { toast('Przeglądarka zablokowała odczyt schowka. Użyj Ctrl+V.', true); }
}

function pasteRequirementText(text) {
  const bounds = requirementSelectionBounds();
  if (!bounds) return;
  const matrix = String(text || '').replace(/\r/g, '').replace(/\n$/, '').split('\n').map(line => line.split('\t'));
  if (!matrix.length) return;
  const cells = requirementGridCells();
  const maxRow = Math.max(...cells.map(cell => Number(cell.dataset.gridRow))); const maxColumn = Math.max(...cells.map(cell => Number(cell.dataset.gridColumn)));
  const fillSelection = matrix.length === 1 && matrix[0].length === 1 && (bounds.bottom > bounds.top || bounds.right > bounds.left);
  const targetBottom = fillSelection ? bounds.bottom : Math.min(maxRow, bounds.top + matrix.length - 1);
  const targetRight = fillSelection ? bounds.right : Math.min(maxColumn, bounds.left + Math.max(...matrix.map(row => row.length)) - 1);
  for (let row = bounds.top; row <= targetBottom; row += 1) for (let column = bounds.left; column <= targetRight; column += 1) {
    const sourceRow = fillSelection ? 0 : row - bounds.top; const sourceColumn = fillSelection ? 0 : column - bounds.left;
    if (matrix[sourceRow]?.[sourceColumn] === undefined) continue;
    const cell = requirementCellAt(row, column); if (cell) writeRequirementCell(cell, matrix[sourceRow][sourceColumn]);
  }
  setRequirementSelection({ row: bounds.top, column: bounds.left }, { row: targetBottom, column: targetRight });
}

function startRequirementFill(event) {
  event.preventDefault(); event.stopPropagation();
  const source = requirementSelectionBounds(); if (!source) return;
  const matrix = [];
  for (let row = source.top; row <= source.bottom; row += 1) {
    const values = []; for (let column = source.left; column <= source.right; column += 1) values.push(requirementCellAt(row, column)?.querySelector('input').value || '');
    matrix.push(values);
  }
  state.requirementFill = { source, target: { ...source }, matrix };
}

function moveRequirementFill(event) {
  if (!state.requirementFill) return;
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-requirement-cell]');
  if (!cell || !requirementGridRoot()?.contains(cell)) return;
  const position = requirementCellPosition(cell); const source = state.requirementFill.source;
  state.requirementFill.target = { top: Math.min(source.top, position.row), bottom: Math.max(source.bottom, position.row), left: Math.min(source.left, position.column), right: Math.max(source.right, position.column) };
  requirementGridCells().forEach(item => { const { row, column } = requirementCellPosition(item); const target = state.requirementFill.target; item.classList.toggle('fill-preview', row >= target.top && row <= target.bottom && column >= target.left && column <= target.right); });
}

function finishRequirementPointerAction() {
  state.requirementPointerSelecting = false;
  if (!state.requirementFill) return;
  const { source, target, matrix } = state.requirementFill; state.requirementFill = null;
  for (let row = target.top; row <= target.bottom; row += 1) for (let column = target.left; column <= target.right; column += 1) {
    const cell = requirementCellAt(row, column); if (!cell) continue;
    const sourceRow = ((row - source.top) % matrix.length + matrix.length) % matrix.length;
    const sourceColumn = ((column - source.left) % matrix[0].length + matrix[0].length) % matrix[0].length;
    writeRequirementCell(cell, matrix[sourceRow][sourceColumn]); cell.classList.remove('fill-preview');
  }
  setRequirementSelection({ row: target.top, column: target.left }, { row: target.bottom, column: target.right });
}

async function savePlannerRequirementsCalendar() {
  const items = [...state.requirementDirty].map(key => {
    const separator = key.indexOf(':'); const groupId = Number(key.slice(0, separator)); const planDate = key.slice(separator + 1);
    const parsed = parseRequirementValue(state.requirementDraft.get(key));
    return parsed && { plan_date: planDate, controller_group_id: groupId, ...parsed, key };
  });
  if (items.some(item => !item)) return toast('Popraw zaznaczone komórki. Użyj formatu ON/OFF, np. 4/2.', true);
  if (!items.length) return toast('Brak zmian do zapisania');
  const button = state.calendarRequirementEdit && state.view === 'calendar' ? $('#calendar-requirements-save') : state.plannerRequirementEdit ? $('#planner-requirements-save-inline') : $('#planner-requirements-save'); if (button) button.disabled = true;
  try {
    for (let index = 0; index < items.length; index += 1500) await api('/api/planner/requirements/batch', { method: 'PUT', body: JSON.stringify({ project_id: state.requirementProjectId, items: items.slice(index, index + 1500).map(({ key, ...item }) => item) }) });
    for (const item of items) { const value = normalizedRequirementValue(state.requirementDraft.get(item.key)); state.requirementDraft.set(item.key, value); state.requirementBaseline.set(item.key, value); state.requirementDirty.delete(item.key); }
    state.requirementSelection = null;
    toast(`Zapisano zapotrzebowanie dla ${items.length} ${items.length === 1 ? 'komórki' : 'komórek'}`);
    if (state.view === 'calendar') await reloadCalendar(); else await reloadPlanner();
    updateRequirementDirtyCount();
  } catch (error) { toast(error.message, true); }
  finally { if (button) button.disabled = !state.requirementDirty.size; }
}

async function addPlannerHoliday() {
  const result = await uiForm({ title: 'Dodaj święto systemowe', description: 'Święto obowiązuje we wszystkich projektach i wpływa na kalkulację czasu pracy.', fields: [
    { name: 'holiday_date', label: 'Data', type: 'date', value: today(), required: true }, { name: 'name', label: 'Nazwa święta', required: true }
  ], submitLabel: 'Dodaj święto' });
  if (!result) return;
  try { await api('/api/planner/holidays', { method: 'POST', body: JSON.stringify(result) }); await refreshAfterPlannerHolidayChange('Święto dodano'); } catch (error) { toast(error.message, true); }
}

async function refreshAfterPlannerHolidayChange(message) {
  await loadData(true);
  if ($('#planner-hours-dialog')?.open) await recalculatePlannerHoursRange({ silent: true });
  if ($('#planner-requirements-dialog')?.open) renderPlannerRequirementsCalendar();
  toast(`${message} · godziny zostały przeliczone ponownie`);
}

function renderPlannerHoursReport(report, from, to, recalculatedAt = '') {
  report ||= { users: [], details: [] };
  const s = state.config.settings || {};
  const emptyUsersRow = '<tr><td colspan="7" class="empty">Brak danych w zakresie.</td></tr>';
  const usersRows = report.users.map(item => `<tr class="${item.overloaded_weeks?.length ? 'overloaded' : ''}"><td><b>${escapeHtml(item.display_name)}</b></td><td>${Number(item.actual_hours).toFixed(1)} h</td><td>${Number(item.credited_hours).toFixed(1)} h</td><td><b>${Number(item.travel_hours || 0).toFixed(1)} h</b></td><td><b>${Number(item.overtime_raw_balance || 0).toFixed(1)} h</b></td><td><b>${item.overtime_balance >= 0 ? '+' : ''}${Number(item.overtime_balance).toFixed(1)} h</b></td><td>${item.overloaded_weeks?.length ? `<span class="badge red">${item.overloaded_weeks.map(week => `${week.week}: ${week.hours} h`).join(', ')}</span>` : '<span class="badge green">w normie</span>'}</td></tr>`).join('') || emptyUsersRow;
  const detailRows = report.details.filter(item => item.label || item.overtime_balance || item.adjustment_note || item.travel_hours).map(item => `<tr><td>${displayDate(item.date)}</td><td>${escapeHtml(item.display_name)}</td><td>${escapeHtml(item.label || '—')}${item.is_holiday ? ' · święto' : ''}</td><td>${item.work_start_time && item.work_end_time ? `${escapeHtml(item.work_start_time)}–${escapeHtml(item.work_end_time)}` : 'automatycznie'}</td><td>${Number(item.actual_hours).toFixed(1)} h</td><td>${Number(item.travel_hours || 0).toFixed(1)} h</td><td>${Number(item.overtime_raw).toFixed(1)} / ${Number(item.overtime_weighted).toFixed(1)} h</td><td>${Number(item.overtime_raw_cumulative || 0).toFixed(1)} h${item.overtime_raw_balance_override !== null ? ' · korekta salda' : ''}</td><td>${Number(item.overtime_weighted_cumulative || 0).toFixed(1)} h${item.overtime_weighted_balance_override !== null ? ' · korekta salda' : ''}</td><td>${escapeHtml(item.adjustment_note || '—')}</td></tr>`).join('');
  $('#planner-hours-content').innerHTML = `<section class="planner-hours-toolbar"><label><span>Od</span><input type="date" id="planner-hours-from" value="${escapeHtml(from)}"></label><label><span>Do</span><input type="date" id="planner-hours-to" value="${escapeHtml(to)}"></label><button type="button" class="primary" id="planner-hours-recalculate">Przelicz godziny</button><small>${recalculatedAt ? `Przeliczono: ${escapeHtml(recalculatedAt)}` : `Aktualny zakres: ${displayDate(from)} – ${displayDate(to)}`}</small></section><section class="hours-rules"><b>Zasady kalkulacji</b><span>ON ${escapeHtml(s.planner_online_hours || '10.5')} h</span><span>OFF ${escapeHtml(s.planner_offline_hours || '8')} h</span><span>Dzień roboczy: ${escapeHtml(s.planner_weekday_multiplier || '1.5')}× ponad ${escapeHtml(s.planner_base_hours || '8')} h</span><span>Sobota: ${escapeHtml(s.planner_saturday_multiplier || '1.5')}× całość</span><span>Niedziela / święto: ${escapeHtml(s.planner_sunday_holiday_multiplier || '2')}× całość</span><span>Wolne lub pusty dzień roboczy: −${escapeHtml(s.planner_time_off_debit || '8')} h</span><span>Transport: tylko pula „Podróże służbowe”, bez nadgodzin</span></section><div class="tablewrap"><table class="hours-table"><thead><tr><th>Pracownik</th><th>Praca</th><th>Urlop zaliczony</th><th>Podróże służbowe</th><th>Saldo bez mnożnika</th><th>Saldo z mnożnikiem</th><th>Przeciążenie</th></tr></thead><tbody>${usersRows}</tbody></table></div><details class="hours-details"><summary>Szczegóły dzienne i przebieg bilansu</summary><div class="tablewrap"><table><thead><tr><th>Data</th><th>Pracownik</th><th>Rodzaj</th><th>Praca od–do</th><th>Godziny pracy</th><th>Podróż służbowa</th><th>Nadgodziny dnia</th><th>Σ bez mnożnika</th><th>Σ z mnożnikiem</th><th>Powód korekty</th></tr></thead><tbody>${detailRows}</tbody></table></div></details>`;
  $('#planner-hours-recalculate').addEventListener('click', recalculatePlannerHoursRange);
}

function openPlannerHours() {
  if (!state.planner?.can_manage_time) return;
  const to = addDays(state.plannerFrom, state.plannerDays - 1);
  renderPlannerHoursReport(state.planner.time_details, state.plannerFrom, to);
  $('#planner-hours-dialog').showModal();
}

async function recalculatePlannerHoursRange({ silent = false } = {}) {
  const from = $('#planner-hours-from')?.value; const to = $('#planner-hours-to')?.value;
  const days = from && to && from <= to ? dateRange(from, to) : [];
  if (!from || !to || from > to) return toast('Podaj prawidłowy zakres dat od–do', true);
  if (!days.length || days.at(-1) !== to || days.length > 366) return toast('Zakres przeliczenia może obejmować maksymalnie 366 dni', true);
  const button = $('#planner-hours-recalculate'); button.disabled = true; button.textContent = 'Przeliczanie…';
  try {
    const recalculated = await api(`/api/planner?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const visibleTo = addDays(state.plannerFrom, state.plannerDays - 1);
    if (from === state.plannerFrom && to === visibleTo) { state.planner = recalculated; renderPlanner(); }
    const timestamp = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date());
    renderPlannerHoursReport(recalculated.time_details, from, to, timestamp);
    if (!silent) toast(`Przeliczono godziny dla okresu ${displayDate(from)} – ${displayDate(to)}`);
  } catch (error) { button.disabled = false; button.textContent = 'Przelicz godziny'; toast(error.message, true); }
}

function plannerDaySnapshot(userId, date) {
  const absence = (state.planner.absences || []).find(item => item.user_id === userId && item.absence_date === date);
  const adjustment = (state.planner.time_adjustments || []).find(item => item.user_id === userId && item.plan_date === date);
  return {
    entries: state.planner.entries.filter(item => item.user_id === userId && item.plan_date === date),
    absence_type: absence?.absence_type || '', absence_note: absence?.note || '',
    day_comment: (state.planner.day_comments || []).find(item => Number(item.user_id) === Number(userId) && item.plan_date === date)?.comment || '',
    actual_hours_adjustment: Number(adjustment?.actual_hours_adjustment || 0), overtime_raw_adjustment: Number(adjustment?.overtime_raw_adjustment || 0), overtime_weighted_adjustment: Number(adjustment?.overtime_weighted_adjustment || 0),
    work_start_time: adjustment?.work_start_time || '', work_end_time: adjustment?.work_end_time || '',
    overtime_raw_balance_override: adjustment?.overtime_raw_balance_override ?? null,
    overtime_weighted_balance_override: adjustment?.overtime_weighted_balance_override ?? null,
    adjustment_note: adjustment?.note || ''
  };
}

async function pastePlannerRange(userId, anchorDate, source, kind) {
  const snapshot = kind === 'day' ? source : { entries: source || [] };
  if (!(snapshot.entries || []).length && !snapshot.absence_type) return toast('Skopiowany dzień nie zawiera aktywności ani nieobecności', true);
  const result = await uiForm({ title: 'Kopiuj aktywność na wiele dni', description: 'Wybierz zakres docelowy. Maksymalnie 31 dni w jednej operacji.', fields: [
    { name: 'from', label: 'Od', type: 'date', value: anchorDate, required: true }, { name: 'to', label: 'Do', type: 'date', value: addDays(anchorDate, 6), required: true }
  ], submitLabel: 'Kopiuj na zakres' });
  if (!result) return;
  const days = dateRange(result.from, result.to);
  if (!days.length || result.to < result.from || days.length > 31) return toast('Zakres musi obejmować od 1 do 31 dni', true);
  try {
    for (const date of days) {
      const existing = (state.planner.entries || []).filter(item => item.user_id === userId && item.plan_date === date);
      const target = kind === 'day' ? snapshot.entries : [...existing, ...(snapshot.entries || []).filter(candidate => !existing.some(item => Number(item.controller_group_id || 0) === Number(candidate.controller_group_id || 0) && candidate.controller_group_id))];
      await api('/api/planner/day', { method: 'PUT', body: JSON.stringify({ user_id: userId, plan_date: date, entries: target.map(plannerEntryPayload), absence_type: kind === 'day' ? snapshot.absence_type : '', absence_note: kind === 'day' ? snapshot.absence_note : '', ...(kind === 'day' ? { actual_hours_adjustment: Number(snapshot.actual_hours_adjustment || 0), overtime_raw_adjustment: Number(snapshot.overtime_raw_adjustment || 0), overtime_weighted_adjustment: Number(snapshot.overtime_weighted_adjustment || 0), work_start_time: snapshot.work_start_time || '', work_end_time: snapshot.work_end_time || '', overtime_raw_balance_override: snapshot.overtime_raw_balance_override, overtime_weighted_balance_override: snapshot.overtime_weighted_balance_override, adjustment_note: snapshot.adjustment_note || '' } : {}) }) });
    }
    toast(`Skopiowano aktywność na ${days.length} dni`); await reloadPlanner();
  } catch (error) { toast(error.message, true); }
}

function showPlannerContext(event, userId, date, entryIds = [], targetProjectId = Number(state.me.current_project?.id || 0)) {
  if (!canCoordinate()) return;
  event.preventDefault(); event.stopPropagation();
  const user = (state.planner.users || []).find(item => item.id === userId);
  if (!user) return toast('Nie znaleziono użytkownika projektu', true);
  const menu = $('#context-menu');
  const normalizedEntryIds = [].concat(entryIds || []).map(Number).filter(Boolean);
  const entryId = normalizedEntryIds[0] || null;
  const entry = entryId ? allPlannerEntries().find(item => Number(item.id) === entryId && plannerEntryProjectId(item) === Number(targetProjectId)) : null;
  const foreignProject = Number(targetProjectId) !== Number(state.me.current_project?.id || 0);
  if (entry) {
    if (!normalizedEntryIds.every(id => state.plannerEntrySelection.has(id))) {
      clearPlannerSelections(false);
      normalizedEntryIds.forEach(id => state.plannerEntrySelection.add(id));
      event.target.closest('.plan-chip')?.classList.add('entry-selected');
    }
  } else {
    const key = plannerSelectionKey(userId, date);
    if (!state.plannerSelection.has(key)) { clearPlannerSelections(false); state.plannerSelection.add(key); event.target.closest('.planner-cell')?.classList.add('multi-selected'); }
  }
  updatePlannerBulkCount();
  const selectedLabel = state.plannerEntrySelection.size ? `${state.plannerEntrySelection.size} aktywności` : `${state.plannerSelection.size} dni`;
  const approveCollision = plannerSelectionOverlapReviews().length ? '<button data-action="approve-selection">Zatwierdź kolizje</button>' : '';
  const addTransport = state.plannerSelection.size ? '<button data-action="add-transport">+Transport <small>T</small></button>' : '';
  const addAbsences = state.plannerSelection.size ? '<button data-action="add-time-off">+ Wolne <small>W</small></button><button data-action="add-vacation">+ Urlop <small>U</small></button>' : '';
  const addWork = state.plannerSelection.size ? '<button data-action="add-work">+ Praca <small>P</small></button>' : '';
  const currentProjectActions = foreignProject ? '' : `<button data-action="assign">Przypisz zadania, status lub punkty</button>${entry ? '<button data-action="repeat-entry">Powiel aktywność na wiele dni…</button>' : ''}<button data-action="repeat-day">Powiel cały dzień na wiele dni…</button>${state.plannerClipboard && state.plannerClipboard.kind !== 'days' ? '<button data-action="paste-range">Wklej na zakres dni…</button>' : ''}`;
  const deleteLabel = state.plannerEntrySelection.size ? 'Usuń zaznaczone kafelki' : 'Wyczyść cały dzień';
  menu.innerHTML = `<section><b>Zaznaczenie · ${selectedLabel}</b>${addWork}${addTransport}${addAbsences}<button data-action="copy-selection">Kopiuj zaznaczenie <small>Ctrl+C</small></button>${state.plannerClipboard && state.plannerSelection.size ? `<button data-action="paste-selection">Wklej ${plannerClipboardLabel()} <small>Ctrl+V</small></button>` : ''}${approveCollision}<button data-action="clear-selection">Wyczyść zaznaczenie</button></section><section><b>Edycja</b><button data-action="edit">Edytuj plan dnia <small>E</small></button>${currentProjectActions}</section><section class="context-danger"><b>${state.plannerEntrySelection.size ? 'Aktywności' : 'Dzień'}</b><button class="danger-text" data-action="clear">${deleteLabel} <small>Delete</small></button></section>`;
  menu.style.left = `${Math.min(event.clientX, innerWidth - 300)}px`; menu.style.top = `${Math.max(8, Math.min(event.clientY, innerHeight - 430))}px`; menu.classList.remove('hidden');
  menu.querySelectorAll('button').forEach(button => button.addEventListener('click', async () => {
    menu.classList.add('hidden');
    const daySnapshot = plannerDaySnapshot(userId, date);
    try {
      if (button.dataset.action === 'copy-selection') return copyPlannerSelection();
      if (button.dataset.action === 'add-work') return addWorkToPlannerSelection();
      if (button.dataset.action === 'add-transport') return addTransportToPlannerSelection();
      if (button.dataset.action === 'add-time-off') return addAbsenceToPlannerSelection('time_off');
      if (button.dataset.action === 'add-vacation') return addAbsenceToPlannerSelection('vacation');
      if (button.dataset.action === 'paste-selection') return pastePlannerSelection();
      if (button.dataset.action === 'approve-selection') return approvePlannerSelectionOverlaps();
      if (button.dataset.action === 'clear-selection') return clearPlannerSelections();
      if (button.dataset.action === 'repeat-entry' && entry) return pastePlannerRange(userId, date, [entry], 'entry');
      if (button.dataset.action === 'repeat-day') return pastePlannerRange(userId, date, daySnapshot, 'day');
      if (button.dataset.action === 'paste-range') return pastePlannerRange(userId, date, state.plannerClipboard.kind === 'day' ? state.plannerClipboard : (state.plannerClipboard.entries || []), state.plannerClipboard.kind);
      if (button.dataset.action === 'assign') return openEntitySelection({ mode: 'planner', userId, date, allowed: ['task', 'status', 'point'] });
      if (button.dataset.action === 'edit') return openPlannerCell(userId, date, targetProjectId);
      if (button.dataset.action === 'clear') return clearSelectedPlannerDays();
    } catch (error) { toast(error.message, true); }
  }));
}

function renderCalendar() {
  queueMicrotask(decorateUnifiedWorkspace);
  const events = state.calendar?.events || [];
  const days = dateRange(state.calendarFrom, state.calendarTo);
  const holidayMap = new Map((state.calendar?.holidays || []).map(item => [item.holiday_date, item.name]));
  const singleEventsForDay = date => events.filter(event => event.start_date === date && event.end_date === date).sort((a, b) => Number(b.entity_type === 'annotation') - Number(a.entity_type === 'annotation') || a.title.localeCompare(b.title, 'pl'));
  const spans = events.filter(event => event.end_date > event.start_date).map(event => ({
    event,
    start: Math.max(0, days.indexOf(event.start_date) < 0 ? 0 : days.indexOf(event.start_date)),
    end: Math.min(days.length - 1, days.indexOf(event.end_date) < 0 ? days.length - 1 : days.indexOf(event.end_date))
  })).filter(item => item.end >= 0 && item.start < days.length).sort((a, b) => Number(b.event.entity_type === 'annotation') - Number(a.event.entity_type === 'annotation') || a.start - b.start || b.end - a.end);
  const laneEnds = [];
  spans.forEach(item => { let lane = laneEnds.findIndex(end => end < item.start); if (lane < 0) lane = laneEnds.length; laneEnds[lane] = item.end; item.lane = lane; });
  const integratedPlanning = Boolean(state.calendarPlanner && state.calendarPlanningVisible);
  $('#add').hidden = !canCoordinate();
  $('#content').innerHTML = `<section class="calendar-command"><div><button class="mini calendar-nav" data-offset="-1">←</button><button class="mini" id="calendar-today">Dzisiaj</button><button class="mini calendar-nav" data-offset="1">→</button></div><div class="calendar-modes"><button class="mini" data-calendar-mode="day">Dzień</button><button class="mini" data-calendar-mode="week">Tydzień</button><button class="mini" data-calendar-mode="month">Miesiąc</button><button class="mini" data-calendar-mode="custom">Dowolny</button></div><label>Od <input type="date" id="calendar-from" value="${state.calendarFrom}"></label><label>Do <input type="date" id="calendar-to" value="${state.calendarTo}"></label><button class="secondary" id="calendar-apply-range">Pokaż</button><button class="secondary ${state.calendarOnlyMine ? 'active-toggle' : ''}" id="calendar-mine-toggle">${state.calendarOnlyMine ? '✓ Tylko moje' : 'Wszystkie / moje'}</button><button class="secondary" id="calendar-filter">Filtry <b>${state.calendarTypes.length}</b></button></section>
  <section class="calendar-shell"><div class="calendar-timeline ${integratedPlanning ? 'with-planning' : ''}" style="--calendar-days:${days.length}"><div class="calendar-date-heads">${integratedPlanning ? '<header class="calendar-grid-corner"><b>Aktywności</b><small>Harmonogram projektu</small></header>' : ''}${days.map(date => { const holiday = holidayMap.get(date); return `<header class="calendar-day-head ${date === today() ? 'today' : ''} ${[0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? 'weekend' : ''} ${holiday ? 'holiday' : ''}" data-date="${date}"><strong>${new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}${holiday ? ` <span class="holiday-info" title="${escapeHtml(holiday)}" aria-label="Święto: ${escapeHtml(holiday)}">i</span>` : ''}</strong><small>${isoWeek(date).label}</small></header>`; }).join('')}</div>${spans.length ? `<div class="calendar-span-rows" style="--span-row-count:${laneEnds.length}">${spans.map(item => `<div class="calendar-span-slot" style="grid-column:${item.start + (integratedPlanning ? 2 : 1)}/span ${item.end - item.start + 1};grid-row:${item.lane + 1}">${calendarEvent(item.event, false, true)}</div>`).join('')}</div>` : ''}<div class="calendar-day-bodies">${integratedPlanning ? '<aside class="calendar-activity-label">Aktywności<br><small>Najpierw plan i terminy</small></aside>' : ''}${days.map(date => { const holiday = holidayMap.get(date); return `<article class="calendar-day ${date === today() ? 'today' : ''} ${[0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? 'weekend' : ''} ${holiday ? 'holiday' : ''}" data-date="${date}" title="${holiday ? `${escapeHtml(holiday)} · ` : ''}Prawy przycisk: dodaj lub wybierz element"><div>${singleEventsForDay(date).map(event => calendarEvent(event, false)).join('') || '<span class="calendar-empty">Prawy klik, aby dodać</span>'}</div></article>`; }).join('')}</div>${calendarManpowerSection(days)}</div></section><div class="calendar-legend"><span class="type-dot task"></span>Zadania <span class="type-dot point"></span>Otwarte punkty <span class="type-dot status"></span>Status <span class="type-dot goal"></span>Kamienie milowe <span class="type-dot note"></span>Przekazanie statusu <span class="type-dot annotation"></span>Adnotacje</div>`;
  $('#calendar-filter').insertAdjacentHTML('afterend', `${canCoordinate() ? '<button class="secondary" id="calendar-annotations">Wszystkie adnotacje</button>' : ''}<button class="secondary ${state.calendarPlanningVisible ? 'active-toggle' : ''}" id="calendar-planning-toggle">${state.calendarPlanningVisible ? 'Ukryj planowanie' : 'Pokaż planowanie'}</button>`);
  $$('[data-calendar-mode]').forEach(button => { button.classList.toggle('active-toggle', button.dataset.calendarMode === state.calendarMode); button.addEventListener('click', async () => { await setCalendarMode(button.dataset.calendarMode); }); });
  $$('.calendar-nav').forEach(button => button.addEventListener('click', async () => { const span = days.length; state.calendarFrom = addDays(state.calendarFrom, Number(button.dataset.offset) * span); state.calendarTo = addDays(state.calendarTo, Number(button.dataset.offset) * span); await reloadCalendar(); }));
  $('#calendar-today').addEventListener('click', async () => { await setCalendarMode(state.calendarMode === 'custom' ? 'week' : state.calendarMode, today()); });
  $('#calendar-apply-range').addEventListener('click', async () => { const from = $('#calendar-from').value; const to = $('#calendar-to').value; if (dateRange(from, to).length > 31) return toast('Kalendarz może pokazać maksymalnie 31 dni', true); state.calendarFrom = from; state.calendarTo = to; state.calendarMode = 'custom'; await reloadCalendar(); });
  $('#calendar-filter').addEventListener('click', openCalendarFilters);
  $('#calendar-annotations')?.addEventListener('click', openCalendarAnnotationsManager);
  $('#calendar-planning-toggle').addEventListener('click', () => { state.calendarPlanningVisible = !state.calendarPlanningVisible; renderCalendar(); });
  $('#calendar-mine-toggle').addEventListener('click', async () => { state.calendarOnlyMine = !state.calendarOnlyMine; await reloadCalendar(); });
  $$('.calendar-day, .calendar-day-head').forEach(day => day.addEventListener('contextmenu', event => showCalendarDayContext(event, day.dataset.date)));
  $$('.calendar-event').forEach(button => button.addEventListener('click', () => { const event = events.find(item => item.entity_type === button.dataset.type && item.entity_id === Number(button.dataset.id)); if (!event) return; if (event.entity_type === 'annotation') return canCoordinate() ? openCalendarAnnotation(event) : null; openEntityOverlay(event.entity_type, event.entity_id); }));
  $$('.calendar-event.annotation').forEach(button => button.addEventListener('contextmenu', event => {
    event.preventDefault(); event.stopPropagation();
    const item = events.find(value => value.entity_type === 'annotation' && value.entity_id === Number(button.dataset.id));
    if (item && canCoordinate()) showCalendarAnnotationContext(event, item);
  }));
  bindCalendarManpower();
}

function calendarManpowerSection(days) {
  const data = state.calendarPlanner; if (!data || !state.calendarPlanningVisible) return '';
  const summaryRows = (data.area_day_summary || []).map(area => `<tr class="area-day-row"><th class="person-col">${escapeHtml(area.name)}</th>${days.map(date => plannerAreaRequirementCell(area.days.find(item => item.date === date), date)).join('')}</tr>`).join('');
  let editorRows = '';
  if (state.calendarRequirementEdit) {
    const rows = plannerInlineRequirementRows(days);
    editorRows = `<tr class="calendar-requirement-toolbar-row"><td colspan="${days.length + 1}"><div class="planner-inline-requirement-toolbar"><span><b>Edycja zapotrzebowania</b><small>Cały projekt i obszary główne · ON/OFF; suma obszarów nie może przekroczyć wartości projektu.</small></span><button type="button" class="mini" id="calendar-requirement-copy">Kopiuj</button><button type="button" class="mini" id="calendar-requirement-paste">Wklej</button><span id="requirement-selection-count-inline">Brak zaznaczenia</span><span id="requirement-dirty-count-inline">Brak niezapisanych zmian</span><button type="button" class="primary" id="calendar-requirements-save">Zapisz</button></div></td></tr>${rows}`;
  }
  return `<section class="calendar-integrated-planning"><header><span><strong>Planowanie manpoweru</strong><small>Obsada i zapotrzebowanie w tych samych kolumnach dni co aktywności powyżej.</small></span>${data.can_manage_requirements ? `<button type="button" class="secondary ${state.calendarRequirementEdit ? 'active-toggle' : ''}" id="calendar-requirements-toggle">Zapotrzebowanie</button>` : ''}</header><div id="calendar-inline-requirements" class="calendar-planning-grid"><table class="planner-table compact" style="--planner-days:${days.length};--requirement-days:${days.length}"><colgroup><col class="calendar-planning-label-col">${days.map(() => '<col>').join('')}</colgroup><tbody>${summaryRows || `<tr><td colspan="${days.length + 1}" class="empty">Brak obszarów.</td></tr>`}${editorRows}</tbody></table></div></section>`;
}

function prepareCalendarRequirements() {
  state.requirementFrom = state.calendarFrom; state.requirementDays = dateRange(state.calendarFrom, state.calendarTo).length; state.requirementData = state.calendarPlanner;
  state.requirementDraft = new Map(); state.requirementBaseline = new Map(); state.requirementDirty = new Set(); state.requirementSelection = null; state.requirementCollapsedGroups = new Set();
  mergePlannerRequirementData(state.requirementData);
}

function bindCalendarManpower() {
  $('#calendar-requirements-toggle')?.addEventListener('click', () => { state.calendarRequirementEdit = !state.calendarRequirementEdit; if (state.calendarRequirementEdit) prepareCalendarRequirements(); renderCalendar(); });
  if (!state.calendarRequirementEdit) return;
  $$('[data-requirement-toggle-inline]').forEach(button => button.addEventListener('click', () => { const id = Number(button.dataset.requirementToggleInline); if (state.requirementCollapsedGroups.has(id)) state.requirementCollapsedGroups.delete(id); else state.requirementCollapsedGroups.add(id); state.requirementSelection = null; renderCalendar(); }));
  $('#calendar-requirement-copy').addEventListener('click', copyRequirementSelection);
  $('#calendar-requirement-paste').addEventListener('click', pasteRequirementSelectionFromClipboard);
  $('#calendar-requirements-save').addEventListener('click', savePlannerRequirementsCalendar);
  bindRequirementGrid(); updateRequirementDirtyCount();
}

function calendarEvent(event, continuation = false, spanning = false) {
  const details = [event.controller_label || event.controller, event.assigned_names || event.assigned_user_name].filter(Boolean).join(' · ');
  const range = spanning ? `${displayDate(event.start_date)} – ${displayDate(event.end_date)}` : '';
  const annotationStyle = event.entity_type === 'annotation' ? ` style="--annotation-bg:${event.background_color || '#dcfce7'};--annotation-text:${event.text_color || '#14532d'}"` : '';
  return `<button class="calendar-event ${event.entity_type} ${event.color || ''} ${spanning ? 'spanning' : ''}"${annotationStyle} data-type="${event.entity_type}" data-id="${event.entity_id}" title="${escapeHtml(event.title)}"><span>${continuation ? '↳' : ({ task: '✓', point: '!', status: '▦', goal: '◎', note: '▤', annotation: '◆' })[event.entity_type]}</span><b>${escapeHtml(event.title)}</b><small>${escapeHtml([details || 'Cały projekt', range].filter(Boolean).join(' · '))}</small></button>`;
}

function showCalendarDayContext(event, date) {
  event.preventDefault(); event.stopPropagation();
  const menu = $('#context-menu');
  menu.innerHTML = `${canCoordinate() ? '<button data-action="annotation">+ Adnotacja</button>' : ''}<button data-action="task">+ Nowe zadanie</button><button data-action="status">+ Nowy punkt statusu</button><button data-action="point">+ Nowy otwarty punkt</button><button data-action="goal">+ Nowy kamień milowy</button><button data-action="note">+ Nowe przekazanie statusu</button><button data-action="existing">Wybierz istniejące elementy…</button>`;
  menu.style.left = `${Math.min(event.clientX, innerWidth - 300)}px`; menu.style.top = `${Math.min(event.clientY, innerHeight - 320)}px`; menu.classList.remove('hidden');
  menu.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    menu.classList.add('hidden');
    const action = button.dataset.action;
    if (action === 'annotation') return openCalendarAnnotation(null, date);
    if (action === 'existing') return openEntitySelection({ mode: 'calendar', date, allowed: ['task', 'status', 'point', 'goal', 'note'] });
    if (action === 'task') return openRecord('tasks', null, { start_date: date });
    if (action === 'point') return openRecord('points', null, { start_date: date });
    if (action === 'goal') return openRecord('goals', null, { due_date: date });
    if (action === 'note') return openStatusTransferEditor(null, { note_date: date });
    if (action === 'status') return openRecord('status', null, { _calendar_date: date });
  }));
}

async function setCalendarMode(mode, anchor = state.calendarFrom) {
  state.calendarMode = mode;
  if (mode === 'day') { state.calendarFrom = anchor; state.calendarTo = anchor; }
  if (mode === 'week') { state.calendarFrom = mondayOf(anchor); state.calendarTo = addDays(state.calendarFrom, 6); }
  if (mode === 'month') { const date = new Date(`${anchor}T12:00:00Z`); state.calendarFrom = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10); state.calendarTo = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).toISOString().slice(0, 10); }
  if (mode !== 'custom') await reloadCalendar(); else renderCalendar();
}

async function reloadCalendar() {
  const params = new URLSearchParams({ controller: state.controller, from: state.calendarFrom, to: state.calendarTo, only_mine: state.calendarOnlyMine ? '1' : '0', category: state.calendarCategory }); state.calendarTypes.forEach(type => params.append('type', type));
  state.calendarPriorities.forEach(priority => params.append('priority', priority));
  try {
    [state.calendar, state.calendarPlanner] = await Promise.all([api('/api/calendar?' + params), api(`/api/planner?from=${state.calendarFrom}&to=${state.calendarTo}`)]);
    if (state.calendarRequirementEdit) { state.requirementFrom = state.calendarFrom; state.requirementDays = dateRange(state.calendarFrom, state.calendarTo).length; state.requirementData = state.calendarPlanner; mergePlannerRequirementData(state.requirementData); }
    renderCalendar();
  } catch (error) { toast(error.message, true); }
}

function openCalendarFilters() {
  const labels = { task: 'Zadania', point: 'Otwarte punkty', status: 'Status', goal: 'Kamienie milowe', note: 'Przekazanie statusu', annotation: 'Adnotacje' };
  $('#calendar-filter-fields').innerHTML = `<section class="calendar-filter-section full"><header><b>Typy informacji</b><small>Zaznacz moduły widoczne na osi czasu.</small></header><div class="calendar-choice-grid">${Object.entries(labels).map(([type, label]) => `<label class="calendar-choice"><input type="checkbox" name="type" value="${type}" ${state.calendarTypes.includes(type) ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></section><section class="calendar-filter-section full"><header><b>Priorytety</b><small>Dotyczy zadań, statusu, punktów i kamieni milowych.</small></header><div class="calendar-choice-grid four">${PRIORITY_VALUES.map(priority => `<label class="calendar-choice"><input type="checkbox" name="priority" value="${priority}" ${state.calendarPriorities.includes(priority) ? 'checked' : ''}><span>${badgeText(priority)}</span></label>`).join('')}</div></section><label class="field calendar-filter-text"><span>Kategoria / branża zawiera</span><input name="category" value="${escapeHtml(state.calendarCategory)}" placeholder="np. Elektryka"></label><label class="calendar-own-filter"><input name="only_mine" type="checkbox" value="1" ${state.calendarOnlyMine ? 'checked' : ''}><span><b>Tylko moje elementy</b><small>Utworzone przeze mnie lub takie, do których jestem przypisany / wspomniany.</small></span></label>`;
  $('#calendar-filter-dialog').showModal();
}

async function applyCalendarFilters(event) {
  event.preventDefault(); const form = new FormData(event.currentTarget); state.calendarTypes = form.getAll('type'); if (!state.calendarTypes.length) state.calendarTypes = ['task']; state.calendarPriorities = form.getAll('priority'); if (!state.calendarPriorities.length) state.calendarPriorities = [...PRIORITY_VALUES]; state.calendarCategory = String(form.get('category') || ''); state.calendarOnlyMine = form.get('only_mine') === '1'; $('#calendar-filter-dialog').close(); await reloadCalendar();
}

function calendarAnnotationScopeOptions() {
  return [
    { value: 'project:0', label: 'Cały projekt' },
    ...state.controllerGroups.map(group => ({ value: `group:${group.id}`, label: `${Number(group.depth || 1) > 1 ? 'Podobszar' : 'Obszar'} · ${group.path_label || group.name}` })),
    ...state.controllers.map(controller => ({ value: `controller:${controller.id}`, label: `Sterownik · ${controller.hierarchy_label || controller.display_name || controller.code}` }))
  ];
}

async function openCalendarAnnotation(record = null, date = null) {
  if (!canCoordinate()) return;
  const result = await uiForm({ title: record ? 'Edytuj adnotację' : 'Nowa adnotacja w Kalendarzu', fields: [
    { name: 'title', label: 'Tytuł', value: record?.title || '', required: true }, { name: 'start_date', label: 'Od', type: 'date', value: record?.start_date || date || state.calendarFrom, required: true }, { name: 'end_date', label: 'Do', type: 'date', value: record?.end_date || record?.start_date || date || state.calendarFrom },
    { name: 'scope_refs', label: 'Zakresy w hierarchii projektu', type: 'hierarchy-multiselect', value: record?.scope_refs?.length ? record.scope_refs : record?.controller_id ? [`controller:${record.controller_id}`] : ['project:0'], hint: 'Możesz wskazać wiele obszarów, podobszarów i sterowników. „Cały projekt” zastępuje pozostałe wybory.', full: true },
    { name: 'assigned_user_id', label: 'Osoba', type: 'select', value: record?.assigned_user_id || '', options: [{ value: '', label: 'Bez osoby' }, ...assignableUsers().map(item => ({ value: item.id, label: item.display_name }))] },
    { name: 'background_color', label: 'Kolor tła (RGB)', type: 'color', value: record?.background_color || '#dcfce7' },
    { name: 'text_color', label: 'Kolor tekstu (RGB)', type: 'color', value: record?.text_color || '#14532d' },
    { name: 'description', label: 'Opis', type: 'textarea', value: record?.description || '', full: true }
  ], submitLabel: 'Zapisz adnotację', secondaryLabel: record ? 'Usuń adnotację' : '', secondaryDanger: true });
  if (result?.__action === 'secondary') return deleteCalendarAnnotation(record);
  if (!result?.title) return;
  try { await api('/api/calendar/annotations' + (record ? `/${record.entity_id || record.id}` : ''), { method: record ? 'PATCH' : 'POST', body: JSON.stringify(result) }); toast('Adnotacja została zapisana'); await reloadCalendar(); return true; } catch (error) { toast(error.message, true); return false; }
}

async function openCalendarAnnotationsManager() {
  if (!canCoordinate()) return;
  try {
    const annotations = await api('/api/calendar/annotations');
    $('#insight-title').textContent = 'Wszystkie adnotacje';
    $('#insight-description').textContent = 'Zbiorczy podgląd, dodawanie i edycja adnotacji Kalendarza';
    $('#insight-content').innerHTML = `<div class="annotation-manager"><header><button type="button" class="primary" id="annotation-manager-add">+ Dodaj adnotację</button><span>${annotations.length} pozycji</span></header>${annotations.map(item => `<article><i style="--annotation-bg:${item.background_color};--annotation-text:${item.text_color}">◆</i><button type="button" data-annotation-edit="${item.id}"><b>${escapeHtml(item.title)}</b><small>${displayDate(item.start_date)} – ${displayDate(item.end_date)} · ${escapeHtml((item.scope_labels || []).join(', ') || 'Cały projekt')}${item.assigned_user_name ? ` · ${escapeHtml(item.assigned_user_name)}` : ''}</small><span>${escapeHtml(item.description || 'Bez opisu')}</span></button><button type="button" class="mini danger-text" data-annotation-delete="${item.id}">Usuń</button></article>`).join('') || '<div class="empty">Brak adnotacji.</div>'}</div>`;
    if (!$('#insight-dialog').open) $('#insight-dialog').showModal();
    $('#annotation-manager-add').addEventListener('click', async () => { $('#insight-dialog').close(); await openCalendarAnnotation(); await openCalendarAnnotationsManager(); });
    $$('[data-annotation-edit]').forEach(button => button.addEventListener('click', async () => { const item = annotations.find(value => value.id === Number(button.dataset.annotationEdit)); $('#insight-dialog').close(); await openCalendarAnnotation(item); await openCalendarAnnotationsManager(); }));
    $$('[data-annotation-delete]').forEach(button => button.addEventListener('click', async () => { const item = annotations.find(value => value.id === Number(button.dataset.annotationDelete)); if (await deleteCalendarAnnotation(item)) await openCalendarAnnotationsManager(); }));
  } catch (error) { toast(error.message, true); }
}

async function deleteCalendarAnnotation(record) {
  if (!record || !await uiConfirm('Usuń adnotację', `Adnotacja „${record.title}” zostanie trwale usunięta z Kalendarza.`, 'Usuń', true)) return;
  try { await api(`/api/calendar/annotations/${record.entity_id || record.id}`, { method: 'DELETE' }); toast('Adnotacja została usunięta'); await reloadCalendar(); return true; } catch (error) { toast(error.message, true); return false; }
}

function showCalendarAnnotationContext(event, record) {
  const menu = $('#context-menu');
  menu.innerHTML = '<button data-action="edit">Edytuj adnotację</button><button data-action="delete" class="danger-text">Usuń adnotację</button>';
  menu.style.left = `${Math.min(event.clientX, innerWidth - 260)}px`; menu.style.top = `${Math.min(event.clientY, innerHeight - 160)}px`; menu.classList.remove('hidden');
  menu.querySelector('[data-action="edit"]').addEventListener('click', () => { menu.classList.add('hidden'); openCalendarAnnotation(record); });
  menu.querySelector('[data-action="delete"]').addEventListener('click', () => { menu.classList.add('hidden'); deleteCalendarAnnotation(record); });
}

function renderHistory() {
  queueMicrotask(decorateUnifiedWorkspace);
  const types = [['status', 'Status'], ['task', 'Zadania'], ['point', 'Otwarte punkty'], ['note', 'Przekazanie statusu']];
  $('#content').innerHTML = `<section class="history-shell"><div class="history-tools"><strong>Rejestr zmian projektu</strong><div>${types.map(([type, label]) => `<label class="mention"><input type="checkbox" data-history-type value="${type}" checked>${label}</label>`).join('')}</div><label>Grupuj <select id="history-group"><option value="hierarchy">Hierarchia projektu</option><option value="controller">Sterownik</option><option value="none">Bez grupowania</option></select></label><input id="history-search" type="search" placeholder="Szukaj osoby, elementu lub zmienionego pola…"><button type="button" class="secondary" id="history-summary-open">Podsumuj zakres</button></div><div id="history-feed" class="history-feed"></div></section>`;
  $('#history-group').value = state.grouping.history || 'hierarchy';
  $$('[data-history-type]').forEach(input => input.addEventListener('change', drawHistory)); $('#history-search').addEventListener('input', drawHistory); $('#history-group').addEventListener('change', event => { state.grouping.history = event.target.value; drawHistory(); }); drawHistory();
  $('#history-summary-open').addEventListener('click', openDailySummary);
}

function drawHistory() {
  const types = new Set($$('[data-history-type]:checked').map(input => input.value)); const query = ($('#history-search').value || '').toLocaleLowerCase('pl');
  const rows = state.history.filter(item => types.has(item.entity_type) && (!query || JSON.stringify(item).toLocaleLowerCase('pl').includes(query)));
  const grouping = state.grouping.history || 'hierarchy';
  const groups = new Map();
  for (const item of rows) {
    const label = grouping === 'none' ? '' : grouping === 'controller' ? (item.controller_label || 'Bez sterownika') : (item.controller_path || 'Cały projekt / bez sterownika');
    if (!groups.has(label)) groups.set(label, []); groups.get(label).push(item);
  }
  const ordered = [...groups.entries()].sort((a, b) => { const left = controllerHierarchyOrder(a[1][0]); const right = controllerHierarchyOrder(b[1][0]); return left - right || a[0].localeCompare(b[0], 'pl', { numeric: true }); });
  const hiddenAuditFields = new Set(['updated_at', 'id', 'project_id', 'test_id', 'issue_id', 'linked_test_id', 'created_at', 'milestone']);
  $('#history-feed').innerHTML = ordered.map(([group, items]) => `${group ? `<div class="history-group-head"><b>${escapeHtml(group)}</b><span>${items.length} zmian</span></div>` : ''}${items.map(item => { const changed = Object.keys(item.changes || {}).filter(key => !hiddenAuditFields.has(key)); return `<article class="history-entry ${item.action} ${item.exists ? 'clickable' : ''}" ${item.exists ? `data-jump="${item.entity_type}" data-id="${item.entity_id}" tabindex="0"` : ''}><span class="history-icon ${item.entity_type}">${({ status: '▦', task: '✓', point: '!', note: '▤' })[item.entity_type]}</span><div><header><b>${escapeHtml(item.label)}</b><span>${escapeHtml(item.user_name || 'System')} · ${displayDateTime(item.changed_at)}</span></header><p>${escapeHtml(auditAction(item.action))}${changed.length ? ` · ${changed.map(fieldLabel).join(', ')}` : ''}</p></div>${item.exists ? '<span class="history-go">→</span>' : '<span class="badge gray">usunięty</span>'}</article>`; }).join('')}`).join('') || '<div class="empty">Brak zmian odpowiadających filtrom.</div>';
  bindJumpItems();
}

async function openDailySummary() {
  if (state.dailySummaryOpening || !state.me.current_project) return;
  state.dailySummaryOpening = true;
  const dialog = $('#daily-summary-dialog');
  $('#daily-summary-from').value = today();
  $('#daily-summary-to').value = today();
  $('#daily-summary-content').innerHTML = '<div class="loading">Przygotowuję krótkie podsumowanie…</div>';
  if (!dialog.open) dialog.showModal();
  try { await loadDailySummary(today(), today()); }
  finally { state.dailySummaryOpening = false; }
}

async function loadDailySummary(from, to) {
  if (!from || !to) return toast('Wybierz poprawny zakres dat', true);
  const days = dateRange(from, to);
  if (!days.length || to < from) return toast('Data końcowa nie może być wcześniejsza od początkowej', true);
  if (days.length > 14) return toast('Podsumowanie może obejmować maksymalnie 14 dni', true);
  $('#daily-summary-content').innerHTML = '<div class="loading">Analizuję zmiany…</div>';
  try {
    const data = await api(`/api/daily-summary?from=${from}&to=${to}`);
    renderDailySummary(data);
  } catch (error) { $('#daily-summary-content').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; toast(error.message, true); }
}

function renderDailySummary(data) {
  const classes = { added: ['Dodano', 'blue'], closed: ['Zamknięto', 'green'], changed: ['Zmieniono', 'amber'], removed: ['Usunięto', 'gray'] };
  const order = ['status', 'task', 'point', 'note'];
  const priorities = data.priority_notifications || [];
  const pendingAnnouncements = data.pending_announcements || [];
  $('#daily-summary-content').innerHTML = `${pendingAnnouncements.length ? `<section class="priority-updates pending-announcement-updates"><header><span><b>Wymagają potwierdzenia odczytu</b><small>Te wiadomości pozostaną na pierwszym miejscu do czasu zaakceptowania.</small></span><span class="badge red">${pendingAnnouncements.length}</span></header>${pendingAnnouncements.map(item => `<button type="button" data-pending-announcement="${item.id}"><span class="type-dot goal"></span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.created_by_name || 'System')} · ${displayDateTime(item.created_at)}</small></span><strong>Przeczytaj →</strong></button>`).join('')}</section>` : ''}${priorities.length ? `<section class="priority-updates"><header><span><b>Najpierw dla Ciebie</b><small>Nowe przypisania i komentarze wymagające uwagi</small></span><span class="badge red">${priorities.length}</span></header>${priorities.map(item => `<button type="button" data-priority-notification="${item.id}"><span class="type-dot ${item.entity_type}"></span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.message || '')} · ${displayDateTime(item.created_at)}</small></span><span>→</span></button>`).join('')}</section>` : ''}<section class="summary-strip"><span><b>${data.totals.total}</b> tematów</span><span class="blue"><b>${data.totals.added}</b> dodanych</span><span class="green"><b>${data.totals.closed}</b> zamkniętych</span><span class="amber"><b>${data.totals.changed}</b> zmienionych</span><span><b>${data.totals.removed}</b> usuniętych</span><small>${displayDate(data.from)} – ${displayDate(data.to)}</small></section><div class="daily-module-grid">${order.map(type => {
    const module = data.modules[type];
    return `<section class="daily-module"><header><span class="history-icon ${type}">${({ status: '▦', task: '✓', point: '!', note: '▤' })[type]}</span><div><strong>${escapeHtml(module.name)}</strong><small>${module.total} zmienionych tematów · +${module.counts.added} / ✓${module.counts.closed} / ~${module.counts.changed}</small></div></header><div>${module.items.slice(0, 100).map(item => { const [label, color] = classes[item.classification]; return `<button class="daily-summary-row" ${item.exists ? `data-summary-jump="${item.entity_type}" data-id="${item.entity_id}"` : 'disabled'}><span class="badge ${color}">${label}</span><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.user_name)} · ${displayDateTime(item.changed_at)}</small></span><span>${item.exists ? '→' : 'usunięty'}</span></button>`; }).join('') || '<div class="empty compact-empty">Brak zmian w tym module.</div>'}</div></section>`;
  }).join('')}</div>`;
  $$('[data-summary-jump]').forEach(button => button.addEventListener('click', () => openEntityOverlay(button.dataset.summaryJump, Number(button.dataset.id))));
  $$('[data-pending-announcement]').forEach(button => button.addEventListener('click', () => { $('#daily-summary-dialog').close(); const item = state.announcements.find(row => Number(row.id) === Number(button.dataset.pendingAnnouncement)); if (item) openAnnouncementDetails(item); }));
  $$('[data-priority-notification]').forEach(button => button.addEventListener('click', () => { $('#daily-summary-dialog').close(); openNotification(priorities.find(item => item.id === Number(button.dataset.priorityNotification))); }));
}

function orderedGroups(module, grouping, rows) {
  if (!grouping) return [''];
  const present = new Set(rows.map(row => row[grouping] || 'Bez wartości'));
  let order = [];
  if (module === 'status' && grouping === 'category') order = statusCategories();
  else if (module === 'status' && grouping === 'subcategory') order = state.config.categories.flatMap(category => category.subcategories.map(item => item.name));
  else if (module === 'status' && grouping === 'function_group_name') order = [...new Set((state.config.function_groups || []).map(group => group.name))];
  else if (module === 'status' && grouping === 'function_group_subcategory_name') order = state.config.function_groups.flatMap(group => (group.subcategories || []).map(item => item.name));
  else if (module === 'status' && grouping === 'status') order = statusWorkflowValues();
  else if (module === 'tasks' && grouping === 'category') order = taskCategories();
  else if (module === 'tasks' && grouping === 'subcategory') order = state.config.task_categories.flatMap(category => category.subcategories.map(item => item.name));
  else order = [...present];
  const result = order.filter(value => present.has(value));
  for (const value of present) if (!result.includes(value)) result.push(value);
  return result;
}

function inlineStatusBadge(type, item) {
  return inlineEntityField(type === 'task' ? 'tasks' : type, 'status', item, badge(item.status), 'priority');
}

function inlineTaskField(field, item, content, className = '') {
  return inlineEntityField('tasks', field, item, content, className);
}

function inlineEntityField(type, field, item, content, className = '') {
  return `<button type="button" class="inline-edit-button ${className}" data-inline-entity-field="${field}" data-inline-entity-type="${type}" data-id="${item.id}" title="Kliknij, aby szybko zmienić wartość">${content}</button>`;
}

function positionInlinePopover(root, button) {
  const anchor = button.getBoundingClientRect();
  const bounds = root.getBoundingClientRect();
  root.style.left = `${Math.max(8, Math.min(innerWidth - bounds.width - 8, anchor.left))}px`;
  root.style.top = `${anchor.bottom + bounds.height + 4 <= innerHeight - 8 ? anchor.bottom + 4 : Math.max(8, anchor.top - bounds.height - 4)}px`;
}

const inlineEditDefinitions = {
  tasks: { endpoint: '/api/tasks', fields: {
    status: { label: 'Status', kind: 'select', values: statusValues('task') },
    start_date: { label: 'Start', kind: 'date' }, due_date: { label: 'Deadline', kind: 'date' },
    direct_assignee_user_ids: { label: 'Odpowiedzialni', kind: 'users' }, requirement_ids: { label: 'Zapotrzebowanie', kind: 'requirements' },
    priority: { label: 'Priorytet', kind: 'select', values: PRIORITY_VALUES }
  } },
  points: { endpoint: '/api/open-points', fields: {
    status: { label: 'Status', kind: 'select', values: statusValues('point') },
    waiting_for: { label: 'Oczekiwanie na', kind: 'select', values: () => options('waiting_for'), blank: '— brak —' },
    owner_user_id: { label: 'Odpowiedzialny', kind: 'user' }, requirement_ids: { label: 'Zapotrzebowanie', kind: 'requirements' },
    due_date: { label: 'Deadline', kind: 'date' }, reminder_date: { label: 'Przypomnienie', kind: 'date' }
  } },
  status: { endpoint: '/api/status', fields: {
    status: { label: 'Status', kind: 'select', values: () => statusWorkflowOptions() },
    criticality: { label: 'Krytyczność', kind: 'select', values: PRIORITY_VALUES },
    responsible_user_ids: { label: 'Odpowiedzialni', kind: 'users' }, requirement_ids: { label: 'Zapotrzebowanie', kind: 'requirements' }
  } }
};

function inlineEditorContent(definition, field, item) {
  if (definition.kind === 'date') {
    return `<input type="date" data-inline-edit-value value="${escapeHtml(item[field] || '')}"><div class="inline-edit-date-actions"><button type="button" data-inline-edit-today>Dzisiaj</button><button type="button" data-inline-edit-clear>Wyczyść</button></div>`;
  }
  if (definition.kind === 'select') {
    const configured = typeof definition.values === 'function' ? definition.values() : definition.values;
    const values = [...configured];
    if (item[field] && !values.some(value => String(typeof value === 'object' ? value.value : value) === String(item[field]))) values.unshift(item[field]);
    return `<select data-inline-edit-value>${selectOptions(values, item[field], definition.blank ?? null)}</select>`;
  }
  if (definition.kind === 'user') {
    const users = assignableUsers([item[field]]);
    return `<select data-inline-edit-value>${selectOptions(users.map(user => ({ value: user.id, label: user.display_name })), item[field], 'Nieprzypisane')}</select>`;
  }
  if (definition.kind === 'users') {
    const selected = new Set((item[field] || []).map(Number));
    const users = assignableUsers([...selected]);
    return `<div class="inline-edit-choices">${users.map(user => `<label><input type="checkbox" data-inline-edit-choice value="${user.id}" ${selected.has(Number(user.id)) ? 'checked' : ''}><span>${escapeHtml(user.display_name)}</span></label>`).join('') || '<span class="form-hint">Brak osób możliwych do przypisania.</span>'}</div>`;
  }
  const selected = new Set((item.requirement_ids || []).map(Number));
  const requirements = state.config.requirements || [];
  return `<div class="inline-edit-choices">${requirements.map(requirement => `<label title="${escapeHtml(requirement.description || '')}"><input type="checkbox" data-inline-edit-choice value="${requirement.id}" ${selected.has(Number(requirement.id)) ? 'checked' : ''}><span><b>${escapeHtml(requirement.name)}</b>${requirement.description ? `<small>${escapeHtml(requirement.description)}</small>` : ''}</span></label>`).join('') || '<span class="form-hint">Lista zapotrzebowania jest pusta.</span>'}</div>`;
}

function dependencyDraftBlockers(refs = []) {
  const collections = state.dependencyOptions || { status: state.status, task: state.tasks, point: state.points };
  return refs.map(ref => ({ ...ref, item: (collections[ref.entity_type] || []).find(item => Number(item.id) === Number(ref.entity_id)) }))
    .filter(ref => ref.item && !(['Done', 'Closed', 'N/A'].includes(ref.item.status)));
}

function dependencySourceLabel(type) {
  return ({ status: 'Status', task: 'Zadanie', point: 'Otwarty punkt' })[type] || type;
}

function dependencyMetaHtml(type, item) {
  const complete = Boolean(item?.is_complete || (type === 'task' ? item?.status === 'Done' : type === 'status' ? ['Done', 'N/A'].includes(item?.status) : item?.status === 'Closed'));
  const person = complete ? item?.completed_by_name : (item?.owner_name || item?.responsible_name);
  const personLabel = complete ? 'Wykonał' : 'Przypisano';
  const deadline = item?.due_date ? ` · deadline ${displayDate(item.due_date)}` : '';
  const completedAt = complete && item?.completed_at ? ` · ${displayDateTime(item.completed_at)}` : '';
  return `<small>${escapeHtml(dependencySourceLabel(type))} · ${escapeHtml(controllerLabel(item) || 'Cały projekt')}</small><em>${escapeHtml(personLabel)}: ${escapeHtml(person || 'brak przypisania')}${escapeHtml(completedAt || deadline)}</em>`;
}

function dependencyCardHtml(type, item, { selectable = false, selected = false } = {}) {
  const complete = Boolean(item?.is_complete || (type === 'task' ? item?.status === 'Done' : type === 'status' ? ['Done', 'N/A'].includes(item?.status) : item?.status === 'Closed'));
  const content = `<span class="dependency-state">${complete ? '✓' : '!'}</span><span><b>${escapeHtml(entityLabel(type, item))}</b>${dependencyMetaHtml(type, item)}</span><span class="dependency-card-status">${badge(item?.status)}</span>`;
  return selectable
    ? `<label class="dependency-card ${complete ? 'done' : ''}"><input type="checkbox" name="dependency_refs" value="${type}:${item.id}" ${selected ? 'checked' : ''}>${content}</label>`
    : `<article class="dependency-card dependency-jump ${complete ? 'done' : ''}" data-dependency-jump="${type}:${item.id}" role="button" tabindex="0" title="Otwórz element zależności">${content}</article>`;
}

function bindDependencyJumps(root = document) {
  root.querySelectorAll('[data-dependency-jump]').forEach(card => {
    if (card.dataset.jumpBound === '1') return;
    card.dataset.jumpBound = '1';
    const open = event => {
      if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const [type, rawId] = card.dataset.dependencyJump.split(':');
      openEntityOverlay(type, Number(rawId));
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', open);
  });
}

function dependencyBlockerListHtml(blockers) {
  return `<div class="dependency-blocker-scroll"><ul>${blockers.map(ref => { const item = ref.item || ref; return `<li><b>${escapeHtml(dependencySourceLabel(ref.entity_type || item.entity_type))}</b><span>${escapeHtml(item.title || entityLabel(ref.entity_type || item.entity_type, item))}</span><small>${escapeHtml(controllerLabel(item) || 'Cały projekt')} · ${escapeHtml(badgeMap[item.status]?.[0] || item.status || 'bez statusu')}</small></li>`; }).join('')}</ul></div>`;
}

async function ensureAllDependencyOptions() {
  if (state.dependencyOptionsAll) return;
  try {
    const [status, task, point] = await Promise.all([api('/api/status?controller=all'), api('/api/tasks?controller=all'), api('/api/open-points?controller=all')]);
    state.dependencyOptions = { status, task, point };
    state.taskDependencyOptions = task;
    state.dependencyOptionsAll = true;
  } catch {}
}

function dependencyBlockChoices(item) {
  const collections = state.dependencyOptions || { status: state.status, task: state.tasks, point: state.points };
  const typeNames = { status: 'Status', task: 'Zadanie', point: 'Otwarty punkt' };
  return ['status', 'task', 'point'].flatMap(type => (collections[type] || [])
    .filter(candidate => !(type === 'status' && Number(candidate.id) === Number(item.id)) && !['Done', 'Closed', 'N/A'].includes(candidate.status))
    .map(candidate => ({ value: `${type}:${candidate.id}`, label: `${typeNames[type]} · ${entityLabel(type, candidate)} (${badgeMap[candidate.status]?.[0] || candidate.status})` })));
}

async function statusChangePayload(item, nextStatus, options = {}) {
  if (!item || nextStatus === item.status) return {};
  await ensureAllDependencyOptions();
  const refs = options.dependencyRefs || item.dependency_refs || [];
  const blockers = dependencyDraftBlockers(refs);
  const blockedOverride = blockers.length > 0 && nextStatus !== 'Blocked';
  const manualBlock = nextStatus === 'Blocked' && !blockers.length;
  const needsReason = nextStatus === 'NOK / Retest required' || blockedOverride || manualBlock;
  if (!needsReason) return {};
  if (options.commentAlreadyAdded) return { status_comment_already_added: true };
  const statusLabel = badgeMap[nextStatus]?.[0] || nextStatus;
  while (true) {
    const fields = manualBlock ? [
      { name: 'dependency', label: 'Niespełniona zależność', type: 'select', options: [{ value: '', label: '— wybierz zależność lub podaj komentarz —' }, ...dependencyBlockChoices(item)], full: true },
      { name: 'reason', label: 'Komentarz / inna przyczyna', type: 'textarea', rows: 4, full: true }
    ] : [
      ...(blockedOverride ? [{ type: 'html', html: dependencyBlockerListHtml(blockers), full: true }] : []),
      { name: 'reason', label: 'Komentarz', type: 'textarea', rows: 4, required: true, full: true }
    ];
    const result = await uiForm({
      title: blockedOverride ? 'Pomiń blokadę zależności' : manualBlock ? 'Wyjaśnij ręczną blokadę' : `Zmiana statusu: ${statusLabel}`,
      description: blockedOverride
        ? 'Ten punkt nadal oczekuje na poniższe elementy. Opisz, dlaczego praca ma być kontynuowana mimo blokady.'
        : manualBlock ? 'Wskaż niespełnione zadanie, status lub otwarty punkt albo opisz przyczynę blokady w komentarzu.' : 'Opisz, dlaczego punkt wymaga ponownego testu.',
      submitLabel: manualBlock ? 'Zapisz blokadę' : 'Zapisz status i komentarz', fields
    });
    if (!result) return null;
    const reason = String(result.reason || '').trim();
    if (!manualBlock) return { status_change_comment: reason };
    if (!result.dependency && !reason) { toast('Wybierz niespełnioną zależność albo wpisz komentarz.', true); continue; }
    const payload = {};
    if (reason) payload.status_change_comment = reason;
    if (result.dependency) {
      const [entity_type, entityId] = result.dependency.split(':');
      payload.dependency_refs = [...refs, { entity_type, entity_id: Number(entityId) }]
        .filter((ref, index, list) => index === list.findIndex(candidate => candidate.entity_type === ref.entity_type && Number(candidate.entity_id) === Number(ref.entity_id)));
    }
    return payload;
  }
}

function bindInlineEntityEditors() {
  $$('[data-inline-entity-field]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault(); event.stopPropagation();
    document.querySelectorAll('.inline-edit-popover').forEach(popover => popover.remove());
    const type = button.dataset.inlineEntityType;
    const field = button.dataset.inlineEntityField;
    const config = inlineEditDefinitions[type];
    const definition = config?.fields[field];
    const item = entity(type, Number(button.dataset.id));
    if (!item || !definition) return;
    if (item.edit_locked && !item.can_override_edit_lock) return toast(`Edycja jest zablokowana przez ${item.edit_lock?.locked_by_name || 'managera'}.`, true);
    const root = document.createElement('div');
    root.className = 'inline-edit-popover';
    root.innerHTML = `<header><strong>${definition.label}</strong><button type="button" class="cancel" title="Anuluj">×</button></header><div class="inline-edit-control">${inlineEditorContent(definition, field, item)}</div><footer><button type="button" class="confirm">Zapisz</button></footer>`;
    document.body.append(root);
    positionInlinePopover(root, button);
    const dateInput = root.querySelector('input[type="date"]');
    root.querySelector('[data-inline-edit-today]')?.addEventListener('click', () => { dateInput.value = today(); });
    root.querySelector('[data-inline-edit-clear]')?.addEventListener('click', () => { dateInput.value = ''; });
    let outside;
    const close = () => { root.remove(); document.removeEventListener('pointerdown', outside, true); };
    root.querySelector('.cancel').addEventListener('click', close);
    root.querySelector('.confirm').addEventListener('click', async event => {
      const saveButton = event.currentTarget;
      saveButton.disabled = true;
      const next = { ...item };
      if (type === 'status' && field !== 'responsible_user_ids') {
        delete next.responsible_user_ids;
        delete next.responsible_user_id;
      }
      if (definition.kind === 'date') next[field] = root.querySelector('[data-inline-edit-value]').value || null;
      else if (definition.kind === 'select') next[field] = root.querySelector('[data-inline-edit-value]').value;
      else if (definition.kind === 'user') next[field] = Number(root.querySelector('[data-inline-edit-value]').value) || null;
      else next[field] = [...root.querySelectorAll('[data-inline-edit-choice]:checked')].map(input => Number(input.value));
      if (type === 'status' && field === 'status') {
        const statusPayload = await statusChangePayload(item, next.status);
        if (!statusPayload) { saveButton.disabled = false; return; }
        Object.assign(next, statusPayload);
      }
      if (type === 'tasks' && field === 'status') {
        const statusPayload = await taskStatusChangePayload(item, next.status);
        if (!statusPayload) { saveButton.disabled = false; return; }
        Object.assign(next, statusPayload);
      }
      try {
        await api(`${config.endpoint}/${item.id}`, { method: 'PATCH', body: JSON.stringify(next) });
        close(); toast(`${definition.label} — zapisano zmianę`); await loadData(true);
      } catch (error) { saveButton.disabled = false; toast(error.message, true); }
    });
    outside = outsideEvent => { if (!root.contains(outsideEvent.target) && !button.contains(outsideEvent.target)) close(); };
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    root.querySelector('input,select')?.focus();
  }));
}


const queueLabels = {
  in_progress: ['W trakcie', 'Elementy już realizowane'],
  ready: ['Gotowe do rozpoczęcia', 'Wszystkie wymagane wcześniejsze elementy są ukończone'],
  blocked: ['Oczekujące', 'Najpierw trzeba ukończyć wskazane zależności'],
  completed: ['Ukończone', 'Elementy zamknięte']
};

function queuePriority(item) {
  return ({ Critical: 0, High: 1, Medium: 2, Low: 3 })[item.priority || item.criticality] ?? 4;
}

function queueRows(rows) {
  return [...rows].sort((left, right) => queuePriority(left) - queuePriority(right)
    || Number(!left.due_date) - Number(!right.due_date)
    || String(left.due_date || '').localeCompare(String(right.due_date || ''))
    || entityLabel(left.entity_type, left).localeCompare(entityLabel(right.entity_type, right), 'pl', { numeric: true }));
}

function dependencyQueueCard(type, item) {
  const label = entityLabel(type, item);
  const typeLabel = ({ status: 'Status', task: 'Zadanie', point: 'Otwarty punkt' })[type];
  const owner = item.owner_name || item.responsible_name || 'Nieprzypisane';
  return `<article class="dependency-queue-card queue-${item.queue_state}" data-queue-type="${type}" data-queue-id="${item.id}" data-node-key="${type}:${item.id}">
    <header><span class="queue-entity-type">${typeLabel}</span>${badge(item.priority || item.criticality || item.status)}</header>
    <h3>${escapeHtml(label)}</h3>${editLockNote(item)}
    <p>${escapeHtml(controllerLabel(item) || item.scope_label || 'Cały projekt')} · ${escapeHtml(owner)}${item.due_date ? ` · ${displayDate(item.due_date)}` : ''}</p>
    <footer><span>${escapeHtml(queueLabels[item.queue_state]?.[0] || item.status)}</span>${item.queue_state === 'ready' ? '<button type="button" class="mini queue-start">Rozpocznij</button>' : ''}</footer>
  </article>`;
}

function dependencyGraphData(focusType, focusRows) {
  const collections = state.dependencyOptions || { status: state.status, task: state.tasks, point: state.points };
  const nodeMap = new Map(['status', 'task', 'point'].flatMap(type => (collections[type] || []).map(item => [`${type}:${item.id}`, { ...item, entity_type: type }])));
  focusRows.forEach(item => nodeMap.set(`${focusType}:${item.id}`, { ...item, entity_type: focusType }));
  const neighbours = key => {
    const node = nodeMap.get(key); if (!node) return [];
    return [...(node.dependency_refs || []).map(ref => `${ref.entity_type}:${ref.entity_id}`), ...(node.dependents || []).map(ref => `${ref.entity_type}:${ref.id || ref.entity_id}`)].filter(candidate => nodeMap.has(candidate));
  };
  const seen = new Set(); const components = [];
  for (const focus of focusRows) {
    const start = `${focusType}:${focus.id}`; if (seen.has(start)) continue;
    const pending = [start]; const keys = new Set();
    while (pending.length) { const key = pending.pop(); if (keys.has(key)) continue; keys.add(key); seen.add(key); neighbours(key).forEach(next => pending.push(next)); }
    components.push([...keys].map(key => nodeMap.get(key)));
  }
  const standalone = components.filter(component => component.length === 1 && !neighbours(`${component[0].entity_type}:${component[0].id}`).length);
  const connected = components.filter(component => !standalone.includes(component));
  if (standalone.length) connected.push(standalone.flat().map(item => ({ ...item, standalone: true })));
  return connected;
}

function dependencyGraphLevels(component) {
  if (component.some(item => item.standalone)) return [queueRows(component)];
  const keys = new Set(component.map(item => `${item.entity_type}:${item.id}`)); const cache = new Map();
  const level = (item, trail = new Set()) => {
    const key = `${item.entity_type}:${item.id}`; if (cache.has(key)) return cache.get(key); if (trail.has(key)) return 0;
    const dependencies = (item.dependency_refs || []).map(ref => `${ref.entity_type}:${ref.entity_id}`).filter(value => keys.has(value));
    const value = dependencies.length ? 1 + Math.max(...dependencies.map(value => level(component.find(candidate => `${candidate.entity_type}:${candidate.id}` === value), new Set([...trail, key])))) : 0;
    cache.set(key, value); return value;
  };
  component.forEach(item => level(item));
  return Array.from({ length: Math.max(...cache.values()) + 1 }, (_, index) => queueRows(component.filter(item => cache.get(`${item.entity_type}:${item.id}`) === index)));
}

function drawDependencyGraphEdges(target) {
  target.querySelectorAll('.dependency-graph-canvas').forEach((canvas, graphIndex) => {
    const svg = canvas.querySelector('svg'); if (!svg) return; const bounds = canvas.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${canvas.scrollWidth} ${canvas.scrollHeight}`); svg.setAttribute('width', canvas.scrollWidth); svg.setAttribute('height', canvas.scrollHeight);
    const paths = [];
    canvas.querySelectorAll('[data-node-key]').forEach(node => {
      const item = target._dependencyGraphItems?.get(node.dataset.nodeKey) || entity(node.dataset.queueType, Number(node.dataset.queueId));
      (item?.dependents || []).forEach(dependent => {
        const targetNode = canvas.querySelector(`[data-node-key="${dependent.entity_type}:${dependent.id || dependent.entity_id}"]`); if (!targetNode) return;
        const from = node.getBoundingClientRect(); const to = targetNode.getBoundingClientRect();
        const x1 = from.right - bounds.left; const y1 = from.top + from.height / 2 - bounds.top;
        const x2 = to.left - bounds.left; const y2 = to.top + to.height / 2 - bounds.top; const middle = x1 + (x2 - x1) / 2;
        const radius = Math.max(0, Math.min(10, Math.abs(y2 - y1) / 2, Math.abs(x2 - x1) / 4));
        const direction = y2 >= y1 ? 1 : -1;
        const path = Math.abs(y2 - y1) < 1
          ? `M ${x1} ${y1} H ${x2}`
          : `M ${x1} ${y1} H ${middle - radius} Q ${middle} ${y1} ${middle} ${y1 + direction * radius} V ${y2 - direction * radius} Q ${middle} ${y2} ${middle + radius} ${y2} H ${x2}`;
        paths.push(`<path d="${path}" marker-end="url(#queue-arrow-${graphIndex})"></path>`);
      });
    });
    svg.innerHTML = `<defs><marker id="queue-arrow-${graphIndex}" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z"></path></marker></defs>${paths.join('')}`;
  });
}

function drawDependencyQueue(type, rows, targetSelector) {
  const target = $(targetSelector);
  if (!target) return;
  const components = dependencyGraphData(type, rows);
  target._dependencyGraphItems = new Map(components.flat().map(item => [`${item.entity_type}:${item.id}`, item]));
  target.innerHTML = rows.length ? `<div class="dependency-flow-legend"><span>Strzałka prowadzi od elementu wymaganego</span><b>→</b><span>do elementu zależnego</span></div><div class="dependency-graphs">${components.map((component, index) => {
    const standalone = component.some(item => item.standalone); const levels = dependencyGraphLevels(component);
    return `<section class="dependency-graph-group"><header><span><b>${standalone ? 'Elementy bez zależności' : `Grupa zależności ${index + 1}`}</b><small>${standalone ? 'Pozycje można realizować niezależnie' : `${component.length} połączonych elementów · ${levels.length} etapów`}</small></span><strong>${component.length}</strong></header><div class="dependency-graph-scroll"><div class="dependency-graph-canvas" style="--graph-levels:${levels.length}"><svg aria-hidden="true"></svg>${levels.map((items, level) => `<div class="dependency-graph-level" data-level="${level}"><span class="dependency-level-label">${standalone ? 'Samodzielne' : `Etap ${level + 1}`}</span>${items.map(item => dependencyQueueCard(item.entity_type, item)).join('')}</div>`).join('')}</div></div></section>`;
  }).join('')}</div>` : '<div class="empty">Brak elementów kolejki.</div>';
  requestAnimationFrame(() => drawDependencyGraphEdges(target));
  target._dependencyResizeObserver?.disconnect();
  if (globalThis.ResizeObserver) {
    target._dependencyResizeObserver = new ResizeObserver(() => requestAnimationFrame(() => drawDependencyGraphEdges(target)));
    target.querySelectorAll('.dependency-graph-canvas').forEach(canvas => target._dependencyResizeObserver.observe(canvas));
  }
  $$(`${targetSelector} .dependency-queue-card`).forEach(card => card.addEventListener('click', event => {
    if (event.target.closest('.queue-start')) return;
    const item = target._dependencyGraphItems.get(card.dataset.nodeKey) || entity(card.dataset.queueType, Number(card.dataset.queueId));
    openRecord(({ status: 'status', task: 'tasks', point: 'points' })[card.dataset.queueType], item);
  }));
  $$(`${targetSelector} .queue-start`).forEach(button => button.addEventListener('click', async event => {
    event.stopPropagation();
    const card = button.closest('.dependency-queue-card');
    const cardType = card.dataset.queueType; const item = target._dependencyGraphItems.get(card.dataset.nodeKey) || entity(cardType, Number(card.dataset.queueId));
    if (!item) return;
    button.disabled = true;
    try {
      const endpoint = ({ status: '/api/status', task: '/api/tasks', point: '/api/open-points' })[cardType];
      const next = { ...item, status: 'In progress' };
      if (cardType === 'status') {
        const statusPayload = await statusChangePayload(item, next.status);
        if (!statusPayload) { button.disabled = false; return; }
        Object.assign(next, statusPayload);
      }
      await api(`${endpoint}/${item.id}`, { method: 'PATCH', body: JSON.stringify(next) });
      toast('Element został rozpoczęty');
      await loadData(true);
    } catch (error) { button.disabled = false; toast(error.message, true); }
  }));
}

function renderStatus() {
  const d = state.dashboard;
  if (state.statusMode !== 'list') state.statusMode = 'list';
  const visibilityColumns = [...statusGroups().flatMap(group => [...(group.columns || []).map(column => ({ key: `matrix_${column.id}`, label: `${group.name} · ${column.name}` })), ...(group.subgroups || []).flatMap(subgroup => (subgroup.columns || []).map(column => ({ key: `matrix_${column.id}`, label: `${group.name} / ${subgroup.name} · ${column.name}` }))) ]), { key: 'progress_updated', label: 'Ostatnia aktualizacja' }];
  state.statusColumns = visibilityColumns;
  const functionGroupsInStatus = [...new Map(state.status.filter(item => item.function_group_id).map(item => [Number(item.function_group_id), { id: Number(item.function_group_id), name: item.function_group_name || `Grupa ${item.function_group_id}` }])).values()].sort((a, b) => a.name.localeCompare(b.name, 'pl', { numeric: true }));
  if (state.statusFunctionGroupFilter && !functionGroupsInStatus.some(item => Number(item.id) === Number(state.statusFunctionGroupFilter))) state.statusFunctionGroupFilter = '';
  const unassignedCount = state.status.filter(item => !item.status_group_id).length;
  const groupingLabels = { global: 'Grupowanie: globalne', within: 'Grupowanie: wewnątrz grup' };
  $('#content').innerHTML = `<div class="panel status-matrix-panel" id="status-panel"><div class="toolbar module-toolbar"><strong>Tabele statusowe</strong><input id="status-matrix-search" class="compact-search" type="search" placeholder="Szukaj punktu lub wartości…" value="${escapeHtml(state.statusMatrixQuery)}"><select id="status-function-group-filter" aria-label="Filtr grupy funkcyjnej">${selectOptions(functionGroupsInStatus.map(item => ({ value: item.id, label: item.name })), state.statusFunctionGroupFilter, 'Wszystkie grupy funkcyjne')}</select><button type="button" class="mini ${state.statusFunctionGroupingMode ? 'active-toggle' : ''}" id="status-group-functional" aria-pressed="${Boolean(state.statusFunctionGroupingMode)}">${groupingLabels[state.statusFunctionGroupingMode] || 'Grupuj wg grupy funkcyjnej'}</button><button type="button" class="mini ${state.statusShowUnassigned ? 'active-toggle' : ''}" id="status-show-unassigned" aria-pressed="${state.statusShowUnassigned}">Pokaż nieprzypisane${unassignedCount ? ` · ${unassignedCount}` : ''}</button><button type="button" class="mini" id="status-collapse-all">Zwiń wszystkie</button><button type="button" class="mini" id="status-expand-all">Rozwiń wszystkie</button>${savedViewsToolbar('status')}<div class="status-inline-metrics"><span><b>${d.progress || 0}%</b> postęp</span><span><b>${d.in_progress || 0}</b> w trakcie</span><span class="${d.blocked ? 'danger-text' : ''}"><b>${d.blocked || 0}</b> blokady/NOK</span></div></div><div class="table-view-tools status-table-view-tools">${columnVisibilityControl('status', visibilityColumns)}${statusSymbolLegend()}</div><div id="status-matrix-content" class="status-matrix-content"></div></div>`;
  $('#status-matrix-search').insertAdjacentHTML('beforebegin', '<button id="bulk-status-open" class="secondary">+ Dodaj wiele punktów</button>');
  $('#bulk-status-open').addEventListener('click', openBulkStatus);
  $('#status-matrix-search').addEventListener('input', event => { state.statusMatrixQuery = event.target.value; drawStatusRows(); });
  $('#status-function-group-filter').addEventListener('change', event => { state.statusFunctionGroupFilter = event.target.value; drawStatusRows(); });
  $('#status-group-functional').addEventListener('click', configureStatusFunctionGrouping);
  $('#status-show-unassigned').addEventListener('click', event => { state.statusShowUnassigned = !state.statusShowUnassigned; event.currentTarget.classList.toggle('active-toggle', state.statusShowUnassigned); event.currentTarget.setAttribute('aria-pressed', String(state.statusShowUnassigned)); drawStatusRows(); });
  $('#status-collapse-all').addEventListener('click', () => { (state.config.status_groups || []).forEach(group => { state.collapsedStatusGroups.add(`group:${group.id}`); (group.subgroups || []).forEach(subgroup => state.collapsedStatusGroups.add(`subgroup:${subgroup.id}`)); }); drawStatusRows(); });
  $('#status-expand-all').addEventListener('click', () => { state.collapsedStatusGroups.clear(); drawStatusRows(); });
  bindColumnVisibility('#status-panel', 'status', visibilityColumns, drawStatusRows);
  bindSavedViews('status', '#status-panel', drawStatusRows);
  drawStatusRows();
}

async function configureStatusFunctionGrouping() {
  const result = await uiForm({ title: 'Grupowanie według grupy funkcyjnej', description: 'Wybierz układ tabeli. Tryb globalny najpierw rozdziela sterowniki, aby nie łączyć grup funkcyjnych z różnych PLC.', submitLabel: 'Zastosuj grupowanie', fields: [
    { name: 'mode', label: 'Typ grupowania', type: 'select', value: state.statusFunctionGroupingMode || 'global', options: [
      { value: 'global', label: 'Globalnie · Sterownik → Grupa funkcyjna → Hardware / Safety' },
      { value: 'within', label: 'Wewnątrz głównych grup · Hardware / Safety → Grupa funkcyjna' },
      { value: '', label: 'Bez grupowania według grupy funkcyjnej' }
    ], full: true }
  ] });
  if (!result) return;
  state.statusFunctionGroupingMode = ['global', 'within'].includes(result.mode) ? result.mode : '';
  renderStatus();
}

function bindStatusModeButtons() {
  $('#status-list-mode')?.addEventListener('click', () => { state.statusMode = 'list'; renderStatus(); });
  $('#status-queue-mode')?.addEventListener('click', () => { state.statusMode = 'queue'; renderStatus(); });
}

function drawStatusRows() {
  const root = $('#status-matrix-content'); if (!root) return;
  state.statusColumnResizeCleanup?.();
  const query = String(state.statusMatrixQuery || '').trim().toLocaleLowerCase('pl');
  const matches = item => (!state.statusFunctionGroupFilter || Number(item.function_group_id) === Number(state.statusFunctionGroupFilter)) && (!query || `${item.function_detail} ${item.function_group_name || ''} ${controllerLabel(item)} ${item.current_note || ''} ${Object.values(item.matrix_values || {}).join(' ')}`.toLocaleLowerCase('pl').includes(query));
  const groups = state.config.status_groups || [];
  const matchedRows = state.status.filter(matches);
  state.statusShowControllerColumn = state.statusFunctionGroupingMode !== 'global' && new Set(matchedRows.map(item => Number(item.controller_id)).filter(Boolean)).size > 1;
  if (state.statusFunctionGroupingMode === 'global') root.innerHTML = statusFunctionalGlobalHtml(matchedRows, groups);
  else {
    const sections = groups.map(group => { const rows = matchedRows.filter(item => Number(item.status_group_id) === Number(group.id)); return query && !rows.length ? '' : statusMatrixGroupHtml(group, rows); }).join('');
    const unassigned = matchedRows.filter(item => !item.status_group_id);
    root.innerHTML = sections + (state.statusShowUnassigned && unassigned.length ? statusMatrixFallbackHtml(unassigned) : '') || '<div class="empty">Brak punktów statusu w wybranym zakresie.</div>';
  }
  $$('[data-status-matrix-toggle]').forEach(button => button.addEventListener('click', () => { const key = button.dataset.statusMatrixToggle; if (state.collapsedStatusGroups.has(key)) state.collapsedStatusGroups.delete(key); else state.collapsedStatusGroups.add(key); drawStatusRows(); }));
  $$('[data-status-global-toggle]').forEach(button => button.addEventListener('click', () => { const key = button.dataset.statusGlobalToggle; if (state.collapsedStatusGroups.has(key)) state.collapsedStatusGroups.delete(key); else state.collapsedStatusGroups.add(key); drawStatusRows(); }));
  $$('[data-status-sort-column]').forEach(button => button.addEventListener('click', () => {
    const columnId = Number(button.dataset.statusSortColumn);
    if (!columnId) return;
    if (state.statusMatrixSort.key === 'column' && Number(state.statusMatrixSort.columnId) === columnId) state.statusMatrixSort.direction *= -1;
    else state.statusMatrixSort = { key: 'column', columnId, direction: 1 };
    drawStatusRows();
  }));
  $$('[data-status-sort-controller]').forEach(button => button.addEventListener('click', () => {
    if (state.statusMatrixSort.key === 'controller') state.statusMatrixSort.direction *= -1;
    else state.statusMatrixSort = { key: 'controller', columnId: null, direction: 1 };
    drawStatusRows();
  }));
  bindStatusColumnResizers(root);
  $$('[data-status-cell]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); const item = state.status.find(row => row.id === Number(button.dataset.id)); const column = (state.config.status_groups || []).flatMap(group => [...(group.columns || []), ...(group.subgroups || []).flatMap(subgroup => subgroup.columns || [])]).find(value => value.id === Number(button.dataset.column)); editStatusMatrixCell(item, column, button); }));
  $$('[data-status-open]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); openRecord('status', state.status.find(item => item.id === Number(button.dataset.statusOpen))); }));
  $$('#status-matrix-content tr[data-id]').forEach(row => {
    const item = state.status.find(entry => entry.id === Number(row.dataset.id));
    appendEditLockNote(row, item, 'td');
    row.addEventListener('click', event => { if (!event.target.closest('[data-status-cell],[data-status-open]')) openRecord('status', item); });
    row.addEventListener('contextmenu', event => showStatusContext(event, item));
  });
}

function bindStatusColumnResizers(root) {
  const handles = [...root.querySelectorAll('[data-status-column-resizer]')];
  if (!handles.length) { state.statusColumnResizeCleanup = null; return; }
  let removeActiveListeners = null;
  const stopActiveResize = () => { removeActiveListeners?.(); removeActiveListeners = null; document.body.classList.remove('status-column-resizing'); };
  state.statusColumnResizeCleanup = stopActiveResize;
  const applyWidth = (key, width) => {
    root.querySelectorAll('[data-status-column-key]').forEach(element => {
      if (element.dataset.statusColumnKey !== key) return;
      element.style.width = `${width}px`;
      element.style.minWidth = `${width}px`;
      element.style.maxWidth = `${width}px`;
    });
  };
  handles.forEach(handle => {
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault(); event.stopPropagation(); stopActiveResize();
      const key = handle.dataset.statusColumnResizer;
      const header = handle.closest('th');
      const startX = event.clientX; const startWidth = header?.getBoundingClientRect().width || 92;
      document.body.classList.add('status-column-resizing');
      const move = moveEvent => {
        const width = Math.max(key === 'controller' ? 64 : 72, Math.min(560, Math.round(startWidth + moveEvent.clientX - startX)));
        ensureStatusColumnWidths()[key] = width;
        applyWidth(key, width);
      };
      const up = () => { persistStatusColumnWidths(); stopActiveResize(); };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up, { once: true });
      document.addEventListener('pointercancel', up, { once: true });
      removeActiveListeners = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', up);
      };
    });
    handle.addEventListener('dblclick', event => {
      event.preventDefault(); event.stopPropagation();
      delete ensureStatusColumnWidths()[handle.dataset.statusColumnResizer];
      persistStatusColumnWidths();
      drawStatusRows();
    });
  });
}

function statusFunctionalGlobalHtml(rows, groups) {
  if (!rows.length) return '<div class="empty">Brak punktów statusu w wybranym zakresie.</div>';
  const controllerBuckets = new Map();
  rows.forEach(item => {
    const key = `controller:${Number(item.controller_id) || 0}`;
    if (!controllerBuckets.has(key)) {
      const controller = state.controllers.find(value => Number(value.id) === Number(item.controller_id));
      controllerBuckets.set(key, { key, label: controller?.display_name || controller?.hierarchy_label || controllerLabel(item) || 'Bez sterownika', first: item, rows: [] });
    }
    controllerBuckets.get(key).rows.push(item);
  });
  const controllers = [...controllerBuckets.values()].sort((left, right) => controllerHierarchyOrder(left.first) - controllerHierarchyOrder(right.first) || left.label.localeCompare(right.label, 'pl', { numeric: true }));
  const showControllerHeaders = controllers.length > 1;
  return controllers.map(controller => {
    const controllerKey = `global:${controller.key}`; const controllerCollapsed = showControllerHeaders && state.collapsedStatusGroups.has(controllerKey);
    const functionBuckets = new Map();
    controller.rows.forEach(item => {
      const key = item.function_group_id ? `function:${item.function_group_id}` : 'function:none';
      if (!functionBuckets.has(key)) functionBuckets.set(key, { key, label: item.function_group_name || 'Bez grupy funkcyjnej', rows: [] });
      functionBuckets.get(key).rows.push(item);
    });
    const functions = [...functionBuckets.values()].sort((left, right) => left.label.localeCompare(right.label, 'pl', { numeric: true }));
    const functionHtml = functions.map(bucket => {
      const functionKey = `global:${controller.key}:${bucket.key}`; const functionCollapsed = state.collapsedStatusGroups.has(functionKey);
      const matrixGroups = groups.map(group => {
        const groupRows = bucket.rows.filter(item => Number(item.status_group_id) === Number(group.id));
        return groupRows.length ? statusMatrixGroupHtml(group, groupRows, `${functionKey}:`) : '';
      }).join('');
      const unassigned = bucket.rows.filter(item => !item.status_group_id);
      const fallback = state.statusShowUnassigned && unassigned.length ? statusMatrixFallbackHtml(unassigned) : '';
      if (!matrixGroups && !fallback) return '';
      return `<section class="status-functional-global ${functionCollapsed ? 'collapsed' : ''}"><header><button type="button" data-status-global-toggle="${escapeHtml(functionKey)}" aria-expanded="${!functionCollapsed}"><i>${functionCollapsed ? '▸' : '▾'}</i><span><b>${escapeHtml(bucket.label)}</b><small>${bucket.rows.length} ${bucket.rows.length === 1 ? 'punkt' : 'punktów'} statusu</small></span></button></header>${functionCollapsed ? '' : `<div>${matrixGroups}${fallback}</div>`}</section>`;
    }).join('');
    return `<section class="status-controller-block ${controllerCollapsed ? 'collapsed' : ''}">${showControllerHeaders ? `<header><button type="button" data-status-global-toggle="${escapeHtml(controllerKey)}" aria-expanded="${!controllerCollapsed}"><i>${controllerCollapsed ? '▸' : '▾'}</i><span><b>${escapeHtml(controller.label)}</b><small>Grupy funkcyjne tego sterownika</small></span></button></header>` : ''}${controllerCollapsed ? '' : functionHtml}</section>`;
  }).join('') || '<div class="empty">Brak punktów statusu w wybranym zakresie.</div>';
}

function statusMatrixProgress(rows, columns) {
  const tracked = (columns || []).filter(column => column.field_type === 'status' && Number(column.include_in_progress));
  if (!tracked.length) return { done: rows.filter(item => ['Done', 'N/A'].includes(item.status)).length, total: rows.length, progress: rows.length ? Math.round(rows.filter(item => ['Done', 'N/A'].includes(item.status)).length * 100 / rows.length) : 0 };
  const values = rows.flatMap(item => tracked.map(column => item.matrix_values?.[column.id] || item.status || 'Never checked'));
  const done = values.filter(value => ['Done', 'N/A'].includes(value)).length;
  return { done, total: values.length, progress: values.length ? Math.round(done * 100 / values.length) : 0 };
}

function statusMatrixGroupMetrics(group, rows) {
  const direct = rows.filter(item => !item.status_subgroup_id);
  const metrics = [statusMatrixProgress(direct, group.columns || [])];
  for (const subgroup of group.subgroups || []) metrics.push(statusMatrixProgress(rows.filter(item => Number(item.status_subgroup_id) === Number(subgroup.id)), subgroup.columns || []));
  const done = metrics.reduce((sum, item) => sum + item.done, 0); const total = metrics.reduce((sum, item) => sum + item.total, 0);
  return { done, total, progress: total ? Math.round(done * 100 / total) : 0 };
}

function statusMatrixProgressHtml(metrics) {
  return `<span class="matrix-progress"><b>${metrics.done}/${metrics.total}</b><i><u style="width:${metrics.progress}%"></u></i><strong>${metrics.progress}%</strong></span>`;
}

function statusMatrixTableHtml(rows, columns, emptyLabel, keyPrefix = '') {
  if (!rows.length) return `<div class="empty compact-empty">${escapeHtml(emptyLabel)}</div>`;
  const hidden = state.hiddenColumns.status || new Set();
  const visibleColumns = columns.filter(column => !hidden.has(`matrix_${column.id}`));
  const updateHidden = hidden.has('progress_updated');
  const showController = Boolean(state.statusShowControllerColumn);
  const controllerSortActive = state.statusMatrixSort.key === 'controller';
  const activeSortColumn = state.statusMatrixSort.key === 'column' ? columns.find(column => Number(column.id) === Number(state.statusMatrixSort.columnId)) : null;
  const sortedRows = [...rows].sort((a, b) => {
    const functional = state.statusFunctionGroupingMode === 'within' ? `${a.function_group_name || 'Bez grupy funkcyjnej'}\u001f${a.controller_id || 0}\u001f${a.function_group_id || 0}`.localeCompare(`${b.function_group_name || 'Bez grupy funkcyjnej'}\u001f${b.controller_id || 0}\u001f${b.function_group_id || 0}`, 'pl', { numeric: true }) : 0;
    if (functional) return functional;
    if (controllerSortActive) {
      const compared = String(controllerLabel(a) || '').localeCompare(String(controllerLabel(b) || ''), 'pl', { numeric: true, sensitivity: 'base' });
      if (compared) return compared * state.statusMatrixSort.direction;
    }
    if (activeSortColumn) {
      const left = a.matrix_values?.[activeSortColumn.id] ?? (activeSortColumn.field_type === 'status' ? a.status : '');
      const right = b.matrix_values?.[activeSortColumn.id] ?? (activeSortColumn.field_type === 'status' ? b.status : '');
      const statusOrder = activeSortColumn.field_type === 'status' ? statusWorkflowValues().indexOf(left) - statusWorkflowValues().indexOf(right) : 0;
      const compared = statusOrder || String(left || '').localeCompare(String(right || ''), 'pl', { numeric: true, sensitivity: 'base' });
      if (compared) return compared * state.statusMatrixSort.direction;
    }
    return controllerHierarchyOrder(a) - controllerHierarchyOrder(b) || Number(a.id) - Number(b.id);
  });
  let previousFunctionGroup = null;
  const body = sortedRows.map(item => {
    const functionGroup = item.function_group_name || 'Bez grupy funkcyjnej';
    const functionIdentity = `${item.controller_id || 0}:${item.function_group_id || 'none'}`;
    const functionKey = `within:${keyPrefix}function:${item.function_group_id || 'none'}`;
    const functionCollapsed = state.statusFunctionGroupingMode === 'within' && state.collapsedStatusGroups.has(functionKey);
    const changedFunctionGroup = functionIdentity !== previousFunctionGroup;
    const groupHeader = state.statusFunctionGroupingMode === 'within' && changedFunctionGroup ? `<tr class="matrix-functional-group-row"><th colspan="${visibleColumns.length + Number(!updateHidden) + Number(showController) + 1}"><button type="button" data-status-global-toggle="${escapeHtml(functionKey)}" aria-expanded="${!functionCollapsed}"><i>${functionCollapsed ? '▸' : '▾'}</i><span>${escapeHtml(functionGroup)}</span></button></th></tr>` : '';
    previousFunctionGroup = functionIdentity;
    if (functionCollapsed) return groupHeader;
    return `${groupHeader}<tr data-id="${item.id}">${showController ? `<td class="matrix-controller-cell" ${statusColumnAttributes('controller')}><b>${escapeHtml(controllerLabel(item))}</b></td>` : ''}${visibleColumns.map(column => {
    const value = item.matrix_values?.[column.id] ?? (column.field_type === 'status' ? item.status : '');
    return `<td class="matrix-cell ${column.field_type}" ${statusColumnAttributes(`column:${column.id}`)}><button type="button" data-status-cell data-id="${item.id}" data-column="${column.id}" title="${escapeHtml(column.description || (column.field_type === 'status' ? `${column.name}: ${badgeMap[value]?.[0] || value}` : `Edytuj: ${column.name}`))}">${column.field_type === 'status' ? statusSymbol(value, true) : `<span class="matrix-text-value">${escapeHtml(value || '—')}</span>`}</button></td>`;
  }).join('')}${updateHidden ? '' : `<td class="matrix-last-update" ${statusColumnAttributes('updated')}>${item.progress_updated_at ? `<b>${displayDateTime(item.progress_updated_at)}</b><small>${escapeHtml(item.progress_updated_by_name || 'użytkownik historyczny')}</small>` : '<span>Brak zmian postępu</span>'}</td>`}<td class="matrix-row-action"><button type="button" class="mini" data-status-open="${item.id}" title="Otwórz szczegóły">•••</button></td></tr>`;
  }).join('');
  const resizeHandle = key => `<i class="status-column-resizer" data-status-column-resizer="${escapeHtml(key)}" title="Przeciągnij, aby zmienić szerokość. Kliknij dwukrotnie, aby przywrócić dopasowanie automatyczne."></i>`;
  const columnGroup = `<colgroup>${showController ? `<col ${statusColumnAttributes('controller')}>` : ''}${visibleColumns.map(column => `<col ${statusColumnAttributes(`column:${column.id}`)}>`).join('')}${updateHidden ? '' : `<col ${statusColumnAttributes('updated')}>`}<col class="matrix-row-action-column"></colgroup>`;
  const controllerHeader = showController ? `<th class="matrix-controller-cell status-resizable-column" ${statusColumnAttributes('controller')}><button type="button" class="matrix-sort-button ${controllerSortActive ? 'active' : ''}" data-status-sort-controller title="Sortuj po sterowniku"><span>Sterownik</span><i>${controllerSortActive ? state.statusMatrixSort.direction > 0 ? '↑' : '↓' : '↕'}</i></button>${resizeHandle('controller')}</th>` : '';
  const columnHeaders = visibleColumns.map(column => {
    const key = `column:${column.id}`; const active = state.statusMatrixSort.key === 'column' && Number(state.statusMatrixSort.columnId) === Number(column.id);
    return `<th class="status-resizable-column" ${statusColumnAttributes(key)} title="${escapeHtml(column.description || '')}"><button type="button" class="matrix-sort-button ${active ? 'active' : ''}" data-status-sort-column="${column.id}" title="${escapeHtml(column.description || `Sortuj po kolumnie ${column.name}`)}"><span>${escapeHtml(column.name)}</span><i>${active ? state.statusMatrixSort.direction > 0 ? '↑' : '↓' : '↕'}</i></button>${resizeHandle(key)}</th>`;
  }).join('');
  const updateHeader = updateHidden ? '' : `<th class="status-resizable-column" ${statusColumnAttributes('updated')}><span>Ostatnia aktualizacja</span>${resizeHandle('updated')}</th>`;
  return `<div class="tablewrap status-matrix-table"><table>${columnGroup}<thead><tr>${controllerHeader}${columnHeaders}${updateHeader}<th class="matrix-row-action"><span class="sr-only">Szczegóły</span></th></tr></thead><tbody>${body}</tbody></table></div>`;
}

function statusMatrixGroupHtml(group, rows, keyPrefix = '') {
  const key = `${keyPrefix}group:${group.id}`; const collapsed = state.collapsedStatusGroups.has(key); const metrics = statusMatrixGroupMetrics(group, rows);
  const directRows = rows.filter(item => !item.status_subgroup_id);
  const directVisible = directRows.length || (group.columns || []).length;
  return `<section class="status-matrix-group"><header><button type="button" data-status-matrix-toggle="${key}" aria-expanded="${!collapsed}"><span>${collapsed ? '▸' : '▾'}</span><span><b class="matrix-group-title">${escapeHtml(group.name)}</b>${group.description ? `<small>${escapeHtml(group.description)}</small>` : ''}</span>${statusMatrixProgressHtml(metrics)}</button></header>${collapsed ? '' : `<div class="status-matrix-group-body">${directVisible ? `<section class="status-matrix-scope direct">${statusMatrixTableHtml(directRows, group.columns || [], 'Brak punktów bezpośrednio w tej grupie.', `${key}:direct:`)}</section>` : ''}${(group.subgroups || []).map(subgroup => {
    const subgroupRows = rows.filter(item => Number(item.status_subgroup_id) === Number(subgroup.id)); const subKey = `${keyPrefix}subgroup:${subgroup.id}`; const subCollapsed = state.collapsedStatusGroups.has(subKey); const subMetrics = statusMatrixProgress(subgroupRows, subgroup.columns || []);
    return `<section class="status-matrix-scope subgroup"><header><button type="button" data-status-matrix-toggle="${subKey}" aria-expanded="${!subCollapsed}"><span>${subCollapsed ? '▸' : '▾'}</span><span><b>${escapeHtml(subgroup.name)}</b>${subgroup.description ? `<small>${escapeHtml(subgroup.description)}</small>` : ''}</span>${statusMatrixProgressHtml(subMetrics)}</button></header>${subCollapsed ? '' : statusMatrixTableHtml(subgroupRows, subgroup.columns || [], 'Brak punktów w tej podgrupie.', `${subKey}:`)}</section>`;
  }).join('')}</div>`}</section>`;
}

function statusMatrixFallbackHtml(rows) {
  return `<section class="status-matrix-group unassigned"><header><div class="status-matrix-unassigned-head"><span><b class="matrix-group-title">Nieprzypisane</b><small>Przypisz te punkty do grupy w podglądzie elementu.</small></span>${statusMatrixProgressHtml(statusMatrixProgress(rows, []))}</div></header>${statusMatrixTableHtml(rows, [{ id: 'legacy', name: 'Status', field_type: 'status', include_in_progress: 1 }], 'Brak punktów.').replaceAll('data-column="legacy"', 'data-column=""').replaceAll('data-status-cell ', '')}</section>`;
}

function editStatusMatrixTextCell(item, column, anchor) {
  document.querySelectorAll('.inline-edit-popover').forEach(popover => popover.remove());
  const current = item.matrix_values?.[column.id] ?? '';
  const root = document.createElement('div');
  root.className = 'inline-edit-popover matrix-text-popover';
  root.innerHTML = `<header><strong>${escapeHtml(column.name)}</strong><button type="button" class="cancel" title="Anuluj">×</button></header><div class="inline-edit-control"><input type="text" data-inline-edit-value value="${escapeHtml(current)}" maxlength="4000"></div><footer><button type="button" class="confirm">Zapisz</button></footer>`;
  document.body.append(root); positionInlinePopover(root, anchor);
  let outside;
  const close = () => { root.remove(); document.removeEventListener('pointerdown', outside, true); };
  const save = async () => {
    const button = root.querySelector('.confirm'); button.disabled = true;
    try {
      const saved = await api(`/api/status/${item.id}/cells/${column.id}`, { method: 'PATCH', body: JSON.stringify({ value: root.querySelector('[data-inline-edit-value]').value, updated_at: item.updated_at }) });
      const index = state.status.findIndex(row => row.id === item.id); if (index >= 0) state.status[index] = saved;
      close(); drawStatusRows(); toast(`${column.name} — zapisano zmianę`);
    } catch (error) { button.disabled = false; toast(error.message, true); }
  };
  root.querySelector('.cancel').addEventListener('click', close);
  root.querySelector('.confirm').addEventListener('click', save);
  root.querySelector('input').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); save(); } else if (event.key === 'Escape') close(); });
  outside = event => { if (!root.contains(event.target) && !anchor.contains(event.target)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  root.querySelector('input').focus(); root.querySelector('input').select();
}

function editStatusMatrixStatusCell(item, column, anchor) {
  document.querySelectorAll('.inline-edit-popover').forEach(popover => popover.remove());
  const current = item.matrix_values?.[column.id] ?? item.status ?? 'Never checked';
  const root = document.createElement('div');
  root.className = 'inline-edit-popover matrix-status-popover';
  root.innerHTML = `<header><strong>${escapeHtml(column.name)}</strong><button type="button" class="cancel" title="Anuluj">×</button></header><div class="matrix-status-options">${statusWorkflowOptions(current).map(option => `<button type="button" data-matrix-status-value="${escapeHtml(option.value)}" class="${option.value === current ? 'active' : ''}">${statusSymbol(option.value)}<span>${escapeHtml(option.label)}</span>${option.value === current ? '<b>Aktualny</b>' : ''}</button>`).join('')}</div>`;
  document.body.append(root); positionInlinePopover(root, anchor);
  let outside;
  const close = () => { root.remove(); document.removeEventListener('pointerdown', outside, true); };
  root.querySelector('.cancel').addEventListener('click', close);
  root.querySelectorAll('[data-matrix-status-value]').forEach(button => button.addEventListener('click', async () => {
    const value = button.dataset.matrixStatusValue;
    if (value === current) return close();
    root.querySelectorAll('button').forEach(control => { control.disabled = true; });
    close();
    const statusPayload = await statusChangePayload({ ...item, status: current }, value);
    if (!statusPayload) return;
    try {
      const saved = await api(`/api/status/${item.id}/cells/${column.id}`, { method: 'PATCH', body: JSON.stringify({ value, updated_at: item.updated_at, ...statusPayload }) });
      const index = state.status.findIndex(row => row.id === item.id); if (index >= 0) state.status[index] = saved;
      drawStatusRows(); toast(`${column.name} — zapisano zmianę`);
    } catch (error) { toast(error.message, true); }
  }));
  outside = event => { if (!root.contains(event.target) && !anchor.contains(event.target)) close(); };
  setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
  root.querySelector('[data-matrix-status-value].active')?.focus();
}

async function editStatusMatrixCell(item, column, anchor) {
  if (!item || !column) return;
  if (item.edit_locked && !item.can_override_edit_lock) return toast(`Edycja jest zablokowana przez ${item.edit_lock?.locked_by_name || 'managera'}.`, true);
  if (column.field_type === 'text' && anchor) return editStatusMatrixTextCell(item, column, anchor);
  if (column.field_type === 'status' && anchor) return editStatusMatrixStatusCell(item, column, anchor);
  const current = item.matrix_values?.[column.id] ?? (column.field_type === 'status' ? item.status : '');
  const fields = column.field_type === 'status'
    ? [{ name: 'value', label: column.name, type: 'select', value: current, options: statusWorkflowOptions(current).map(option => ({ value: option.value, label: `${statusSymbolDetails(option.value)[0] || ''} ${option.label}` })) }]
    : [{ name: 'value', label: column.name, type: 'textarea', value: current, rows: 5, full: true }];
  const result = await uiForm({ title: `Edytuj · ${column.name}`, description: item.function_detail, submitLabel: 'Zapisz wartość', fields });
  if (!result) return;
  const payload = { value: result.value, updated_at: item.updated_at };
  if (column.field_type === 'status') {
    const statusPayload = await statusChangePayload({ ...item, status: current }, result.value);
    if (!statusPayload) return;
    Object.assign(payload, statusPayload);
  }
  try {
    const saved = await api(`/api/status/${item.id}/cells/${column.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    const index = state.status.findIndex(row => row.id === item.id); if (index >= 0) state.status[index] = saved;
    drawStatusRows(); toast('Wartość została zapisana');
  } catch (error) { toast(error.message, true); }
}

function showStatusContext(event, item) {
  event.preventDefault(); event.stopPropagation();
  const menu = $('#context-menu');
  menu.innerHTML = `<button data-action="edit">Otwórz punkt statusu</button><button data-action="duplicate">Duplikuj punkt…</button><button data-action="task">+ Utwórz powiązane zadanie</button><button data-action="point">+ Utwórz powiązany otwarty punkt</button><button data-action="note">+ Dodaj przekazanie statusu</button><button data-action="done">Oznacz jako gotowe</button>`;
  menu.style.left = `${Math.min(event.clientX, innerWidth - 270)}px`; menu.style.top = `${Math.min(event.clientY, innerHeight - 240)}px`; menu.classList.remove('hidden');
  menu.querySelectorAll('button').forEach(button => button.addEventListener('click', async () => {
    menu.classList.add('hidden');
    if (button.dataset.action === 'edit') return openRecord('status', item);
    if (button.dataset.action === 'duplicate') return openDuplicate('status', item);
    if (button.dataset.action === 'done') {
      const next = { ...item, status: 'Done' };
      const statusPayload = await statusChangePayload(item, next.status);
      if (!statusPayload) return;
      Object.assign(next, statusPayload);
      try { await api(`/api/status/${item.id}`, { method: 'PATCH', body: JSON.stringify(next) }); toast('Punkt oznaczono jako gotowy'); await loadData(); } catch (error) { toast(error.message, true); }
      return;
    }
    const type = button.dataset.action === 'task' ? 'tasks' : button.dataset.action === 'point' ? 'points' : 'notes';
    const prefill = { controller: item.controller, controller_group_id: item.controller_group_id || null, hierarchy_target: item.controller_group_id ? `group:${item.controller_group_id}` : `controller:${item.controller}`, function_group_id: item.function_group_id, function_group_element_id: item.function_group_element_id, category: item.category, subcategory: item.subcategory, title: item.function_detail, content: `Aktualizacja statusu: ${item.function_detail}`, links: [{ entity_type: 'status', entity_id: item.id }] };
    if (type === 'notes') openStatusTransferEditor(null, prefill); else openRecord(type, null, prefill);
  }));
}

function bulkStatusBasicColumns() {
  return statusEditorColumns(Number($('#bulk-status-matrix-group')?.value), Number($('#bulk-status-matrix-subgroup')?.value) || null).filter(column => statusColumnRole(column) === 'basic');
}

function appendBulkStatusTableRow(values = {}) {
  const body = $('#bulk-status-table-body'); if (!body) return;
  const columns = bulkStatusBasicColumns();
  const fields = columns.length ? columns : [{ id: 'function_detail', name: 'Nazwa punktu' }];
  const row = document.createElement('tr');
  row.innerHTML = `${fields.map(column => `<td><input type="text" data-bulk-status-column="${escapeHtml(column.id)}" value="${escapeHtml(values[column.id] || '')}" aria-label="${escapeHtml(column.name)}"></td>`).join('')}<td><button type="button" class="mini danger-text remove-bulk-status-row" aria-label="Usuń wiersz">×</button></td>`;
  row.querySelector('.remove-bulk-status-row').addEventListener('click', () => { row.remove(); if (!body.children.length) appendBulkStatusTableRow(); });
  body.append(row);
}

function renderBulkStatusInput(resetRows = true) {
  const columns = bulkStatusBasicColumns();
  const names = columns.map(column => column.name);
  const hint = $('#bulk-status-text-hint');
  const textarea = $('#bulk-status-names');
  if (hint) hint.textContent = columns.length ? `Jedna linia = jeden punkt. Średnik rozdziela kolejno: ${names.join(' ; ')}. Maksymalnie 500 punktów.` : 'Jedna linia = jeden punkt. Maksymalnie 500 punktów.';
  if (textarea) textarea.placeholder = columns.length ? `${names.map((name, index) => index ? `${name} ${index + 1}` : `Wartość ${name}`).join(';')}` : 'Sprawdź sygnał QM1\nSprawdź sygnał QM2';
  const head = $('#bulk-status-table-head');
  const body = $('#bulk-status-table-body');
  if (head) head.innerHTML = `<tr>${(columns.length ? columns : [{ name: 'Nazwa punktu' }]).map(column => `<th title="${escapeHtml(column.description || '')}">${escapeHtml(column.name)}</th>`).join('')}<th></th></tr>`;
  if (body && resetRows) { body.innerHTML = ''; for (let index = 0; index < 6; index += 1) appendBulkStatusTableRow(); }
}

function setBulkStatusMode(mode) {
  const normalized = mode === 'table' ? 'table' : 'text';
  $('#bulk-status-dialog').dataset.inputMode = normalized;
  $$('#bulk-status-mode-switch button').forEach(button => button.classList.toggle('active-toggle', button.dataset.mode === normalized));
  $('#bulk-status-text-mode').hidden = normalized !== 'text';
  $('#bulk-status-table-mode').hidden = normalized !== 'table';
}

function openBulkStatus() {
  const hierarchyTarget = defaultValue('hierarchy_target');
  const statusGroup = statusGroups()[0];
  $('#bulk-status-fields').innerHTML = `<div class="field full hierarchy-target-field required-field"><label>Zakres w hierarchii projektu *</label>${hierarchyTargetTreeHtml(hierarchyTarget, { inputId: 'bulk-status-hierarchy-target' })}</div>
    <label class="field required-field"><span>Grupa statusu *</span><select name="status_group_id" id="bulk-status-matrix-group" required>${selectOptions(statusGroups().map(item => ({ value: item.id, label: item.name })), statusGroup?.id || '', 'Wybierz grupę')}</select></label>
    <label class="field"><span>Podgrupa</span><select name="status_subgroup_id" id="bulk-status-matrix-subgroup">${selectOptions((statusGroup?.subgroups || []).map(item => ({ value: item.id, label: item.name })), '', 'Bezpośrednio w grupie')}</select></label>
    <label class="field"><span>Krytyczność</span><select name="criticality">${selectOptions(PRIORITY_DEFINITIONS, 'Medium', '')}</select></label>
    <label class="field"><span>Status początkowy</span><select name="status">${selectOptions(statusWorkflowOptions(), 'Never checked', '')}</select></label>
    <section class="field full required-field bulk-status-input"><header><span><b>Punkty do dodania *</b><small>Wybierz wygodny sposób wprowadzania danych.</small></span><div class="segmented-control" id="bulk-status-mode-switch"><button type="button" class="mini active-toggle" data-mode="text">Tekst</button><button type="button" class="mini" data-mode="table">Tabela</button></div></header><div id="bulk-status-text-mode"><textarea id="bulk-status-names" name="names" rows="12"></textarea><small class="sub" id="bulk-status-text-hint"></small></div><div id="bulk-status-table-mode" hidden><div class="tablewrap bulk-status-table-wrap"><table class="bulk-status-table"><thead id="bulk-status-table-head"></thead><tbody id="bulk-status-table-body"></tbody></table></div><button type="button" class="secondary" id="bulk-status-add-row">+ Dodaj wiersz</button><small class="sub">Puste wiersze zostaną pominięte. Maksymalnie 500 punktów.</small></div></section>${requirementsField({}, 'requirement_ids', 'Zapotrzebowanie')}`;
  bindHierarchyTargetTrees($('#bulk-status-fields'));
  $('#bulk-status-matrix-group').addEventListener('change', event => { $('#bulk-status-matrix-subgroup').innerHTML = selectOptions(statusSubgroups(event.target.value).map(item => ({ value: item.id, label: item.name })), '', 'Bezpośrednio w grupie'); renderBulkStatusInput(); });
  $('#bulk-status-matrix-subgroup').addEventListener('change', () => renderBulkStatusInput());
  $$('#bulk-status-mode-switch button').forEach(button => button.addEventListener('click', () => setBulkStatusMode(button.dataset.mode)));
  $('#bulk-status-add-row').addEventListener('click', () => { appendBulkStatusTableRow(); $('#bulk-status-table-body tr:last-child input')?.focus(); });
  renderBulkStatusInput();
  setBulkStatusMode('text');
  $('#bulk-status-dialog').dataset.dirty = '';
  $('#bulk-status-dialog').showModal();
}

async function saveBulkStatus(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const input = Object.fromEntries(form);
  input.requirement_ids = form.getAll('requirement_ids').map(Number);
  input.responsible_user_ids = [];
  input.status_group_id = Number(input.status_group_id) || null;
  input.status_subgroup_id = Number(input.status_subgroup_id) || null;
  const columns = bulkStatusBasicColumns();
  const mode = $('#bulk-status-dialog').dataset.inputMode || 'text';
  let items = [];
  if (mode === 'text') {
    const lines = String(input.names || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
    if (lines.length > 500) return toast('Jednorazowo można utworzyć maksymalnie 500 punktów', true);
    for (const [index, line] of lines.entries()) {
      const values = line.split(';').map(value => value.trim());
      if (columns.length && values.length > columns.length) return toast(`Wiersz ${index + 1} ma więcej wartości niż skonfigurowanych kolumn podstawowych (${columns.length})`, true);
      const matrixValues = Object.fromEntries(columns.map((column, columnIndex) => [column.id, values[columnIndex] || '']));
      const functionDetail = columns.length ? values.filter(Boolean).join(' · ') : line;
      if (functionDetail) items.push({ function_detail: functionDetail, matrix_values: matrixValues });
    }
  } else {
    items = $$('#bulk-status-table-body tr').map(row => {
      const values = Object.fromEntries([...row.querySelectorAll('[data-bulk-status-column]')].map(control => [control.dataset.bulkStatusColumn, control.value.trim()]));
      const functionDetail = columns.length ? columns.map(column => values[column.id]).filter(Boolean).join(' · ') : values.function_detail || '';
      return { function_detail: functionDetail, matrix_values: columns.length ? Object.fromEntries(columns.map(column => [column.id, values[column.id] || ''])) : {} };
    }).filter(item => item.function_detail);
  }
  if (!items.length) return toast('Dodaj co najmniej jeden punkt', true);
  if (items.length > 500) return toast('Jednorazowo można utworzyć maksymalnie 500 punktów', true);
  delete input.names;
  input.items = items;
  const button = event.currentTarget.querySelector('.primary'); button.disabled = true;
  try {
    const result = await api('/api/status/bulk-create', { method: 'POST', body: JSON.stringify(input) });
    $('#bulk-status-dialog').close();
    toast(`Utworzono ${result.created} punktów statusu`);
    await loadData();
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

function taskCard(item) {
  const time = taskTimeLabel(item);
  const allChecks = [...(item.checklist || []), ...(item.scope_checklist || [])];
  const recurrence = taskRecurrenceLabel(item);
  return `<article class="task-card compact" draggable="true" data-task-id="${item.id}"><div class="task-card-head"><h3>${escapeHtml(item.title)}${Number(item.image_count) ? `<span class="task-image-count" title="Zdjęcia: ${Number(item.image_count)}">▧ ${Number(item.image_count)}</span>` : ''}</h3><span class="progress-value ${item.progress >= 100 ? 'done' : item.progress > 0 ? 'active' : ''}"><b>${item.progress || 0}%</b><i><u style="width:${item.progress || 0}%"></u></i></span></div><p>${escapeHtml(controllerLabel(item))} · ${escapeHtml(item.function_group_name || item.other_object || (item.scope_is_group ? 'zadanie obszarowe' : 'bez grupy'))}${item.function_group_element_name ? ` → ${escapeHtml(item.function_group_element_name)}` : ''}</p><div class="cardmeta"><span>${escapeHtml(item.owner_name || 'Nieprzypisane')}</span><span>${item.due_date ? displayDate(item.due_date) : 'bez deadline’u'}</span></div>${recurrence ? `<span class="time-chip recurring">↻ ${escapeHtml(recurrence)}</span>` : ''}${item.blocked_by_dependencies ? `<span class="dependency-warning">Zablokowane przez ${item.blocked_by_dependencies} ${item.blocked_by_dependencies === 1 ? 'element' : 'elementy'}</span>` : ''}${time ? `<span class="time-chip ${time.overdue ? 'overdue' : ''}">${escapeHtml(time.label)}</span>` : ''}<div class="checkbar"><i style="width:${item.progress || 0}%"></i></div><div class="task-card-foot"><button type="button" class="task-check-count" data-checklist-task="${item.id}">${allChecks.filter(entry => entry.done).length}/${allChecks.length} punktów kontroli</button><span>${escapeHtml(item.category || 'Bez kategorii')} · utworzył ${escapeHtml(item.created_by_name || 'dane historyczne')}</span></div></article>`;
}

function taskRecurrenceLabel(item) {
  const interval = Number(item?.recurrence_interval || 0);
  if (!interval) return '';
  const unit = item.recurrence_unit === 'months' ? (interval === 1 ? 'miesiąc' : 'miesiące') : item.recurrence_unit === 'weeks' ? (interval === 1 ? 'tydzień' : 'tygodnie') : (interval === 1 ? 'dzień' : 'dni');
  return `cykl: ${interval} ${unit}`;
}

async function taskStatusChangePayload(item, nextStatus) {
  if (!item || nextStatus === item.status || !['Blocked', 'NOK / Retest required'].includes(nextStatus)) return {};
  const result = await uiForm({
    title: nextStatus === 'Blocked' ? 'Dlaczego zadanie jest zablokowane?' : 'Dlaczego zadanie wymaga retestu?',
    description: 'Uzasadnienie zostanie zapisane jako komentarz i będzie widoczne w historii zadania.',
    submitLabel: 'Zmień status',
    fields: [{ name: 'status_change_comment', label: 'Komentarz', type: 'textarea', rows: 4, required: true, full: true }]
  });
  return result?.status_change_comment?.trim() ? { status_change_comment: result.status_change_comment.trim() } : null;
}

function renderTasks() {
  queueMicrotask(decorateUnifiedWorkspace);
  if (state.taskMode === 'queue') state.taskMode = 'list';
  const listTools = state.taskMode === 'list' ? `<select id="task-group" aria-label="Grupowanie zadań"><option value="">Bez grupowania</option><option value="function_group_name">Grupa funkcyjna</option><option value="function_group_element_name">Element grupy</option><option value="category">Kategoria</option><option value="subcategory">Podkategoria</option><option value="status">Status</option><option value="owner_name">Odpowiedzialny</option><option value="scope_label">Zakres hierarchii</option></select><button type="button" class="mini" id="task-collapse-all">Zwiń wszystkie</button><button type="button" class="mini" id="task-expand-all">Rozwiń wszystkie</button><button type="button" class="mini" id="task-table-clear">Wyczyść filtry tabeli</button><button type="button" class="mini completed-toggle ${state.taskShowCompleted ? 'active-toggle' : ''}" id="task-show-completed" aria-pressed="${state.taskShowCompleted}">Pokaż ukończone</button>` : '';
  $('#content').innerHTML = `<div class="panel compact-data-panel task-filter-panel"><div class="toolbar module-toolbar" id="task-filter-bar"><strong>Zadania</strong><button id="task-board-mode" class="secondary ${state.taskMode === 'board' ? 'active-toggle' : ''}">Tablica</button><button id="task-list-mode" class="secondary ${state.taskMode === 'list' ? 'active-toggle' : ''}">Lista</button><input id="task-search" placeholder="Szukaj we wszystkich polach">${listTools}${savedViewsToolbar('tasks')}</div></div><div id="task-content"></div>`;
  $('#task-board-mode').addEventListener('click', () => { state.taskMode = 'board'; renderTasks(); });
  $('#task-list-mode').addEventListener('click', () => { state.taskMode = 'list'; renderTasks(); });
  $('#task-search').addEventListener('input', drawTasks);
  bindTableFilters('#task-filter-bar', drawTasks);
  bindSavedViews('tasks', '#task-filter-bar', drawTasks);
  $('#task-show-completed')?.addEventListener('click', event => { state.taskShowCompleted = !state.taskShowCompleted; event.currentTarget.classList.toggle('active-toggle', state.taskShowCompleted); event.currentTarget.setAttribute('aria-pressed', String(state.taskShowCompleted)); drawTasks(); });
  drawTasks();
  if ($('#task-group')) {
    $('#task-group').value = state.grouping.tasks;
    $('#task-group').addEventListener('change', event => { state.grouping.tasks = event.target.value; state.collapsedTaskGroups.clear(); drawTaskListRows(); });
    $('#task-collapse-all').addEventListener('click', () => { orderedGroups('tasks', state.grouping.tasks, filterRows(filteredTasks(), '#task-list-panel')).forEach(group => state.collapsedTaskGroups.add(String(group))); drawTaskListRows(); });
    $('#task-expand-all').addEventListener('click', () => { state.collapsedTaskGroups.clear(); drawTaskListRows(); });
    $('#task-table-clear').addEventListener('click', () => { $$('#task-list-panel input[data-filter-text], #task-list-panel input[data-filter-min], #task-list-panel input[data-filter-max], #task-list-panel input[data-filter-date]').forEach(input => { input.value = ''; }); $$('#task-list-panel [data-filter-kind] input[type="checkbox"]').forEach(input => { input.checked = false; }); updateFilterSummaries('#task-list-panel'); drawTaskListRows(); });
  }
}

function filteredTasks() {
  const query = ($('#task-search')?.value || '').toLowerCase();
  return state.tasks.filter(item => (state.taskMode !== 'list' || state.taskShowCompleted || item.status !== 'Done') && (!query || JSON.stringify(item).toLowerCase().includes(query)));
}

function drawTasks() {
  if (state.taskMode === 'board') drawTaskBoard();
  else if (state.taskMode === 'queue') drawDependencyQueue('task', filteredTasks(), '#task-content');
  else drawTaskList();
}

function drawTaskBoard() {
  const lanes = [['To do', 'Do zrobienia', 'todo'], ['In progress', 'W trakcie', 'progressing'], ['Blocked', 'Zablokowane', 'blocked'], ['NOK / Retest required', 'NOK / retest', 'retest'], ['Done', 'Ukończone', 'done']];
  const rows = filteredTasks();
  $('#task-content').innerHTML = `<div class="board">${lanes.map(([status, label, className]) => {
    const items = rows.filter(item => item.status === status);
    return `<section class="lane ${className}" data-status="${status}"><div class="lanehead"><span>${label}</span><span>${items.length}</span></div>${items.map(taskCard).join('') || '<div class="empty">Przeciągnij tutaj zadanie</div>'}</section>`;
  }).join('')}</div>`;
  $$('.task-card').forEach(card => {
    appendEditLockNote(card, state.tasks.find(item => item.id === Number(card.dataset.taskId)), '.task-card-head');
    card.addEventListener('click', event => { if (event.target.closest('[data-checklist-task]')) return; if (!state.draggingTask) openRecord('tasks', state.tasks.find(item => item.id === Number(card.dataset.taskId))); });
    card.addEventListener('contextmenu', event => showEntityContext(event, 'tasks', state.tasks.find(item => item.id === Number(card.dataset.taskId))));
    card.addEventListener('dragstart', event => { state.draggingTask = true; card.classList.add('dragging'); event.dataTransfer.setData('text/task-id', card.dataset.taskId); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); setTimeout(() => { state.draggingTask = false; }, 0); });
  });
  $$('[data-checklist-task]').forEach(button => button.addEventListener('click', event => { event.stopPropagation(); openTaskChecklistPopup(Number(button.dataset.checklistTask)); }));
  $$('.lane').forEach(lane => {
    lane.addEventListener('dragover', event => { event.preventDefault(); lane.classList.add('drag-over'); });
    lane.addEventListener('dragleave', () => lane.classList.remove('drag-over'));
    lane.addEventListener('drop', async event => {
      event.preventDefault(); lane.classList.remove('drag-over');
      const task = state.tasks.find(item => item.id === Number(event.dataTransfer.getData('text/task-id')));
      if (!task || task.status === lane.dataset.status) return;
      const statusPayload = await taskStatusChangePayload(task, lane.dataset.status);
      if (!statusPayload) return;
      try { await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ ...task, status: lane.dataset.status, ...statusPayload }) }); toast('Status zadania został zmieniony'); await loadData(); }
      catch (error) { toast(error.message, true); }
    });
  });
}

function drawTaskList() {
  const columns = [
    { key: 'title', label: 'Zadanie' }, { key: 'scope_label', label: 'Zakres / PLC', filter: 'hierarchy' }, { key: 'function_group_name', label: 'Grupa funkcyjna', values: uniqueValues(state.tasks, 'function_group_name') }, { key: 'function_group_element_name', label: 'Element grupy', values: uniqueValues(state.tasks, 'function_group_element_name') }, { key: 'category', label: 'Kategoria', values: taskCategories() },
    { key: 'subcategory', label: 'Podkategoria', values: uniqueValues(state.tasks, 'subcategory') }, { key: 'requirement_names', label: 'Zapotrzebowanie', values: uniqueValues(state.tasks, 'requirement_names', true) }, { key: 'status', label: 'Status', values: statusValues('task') },
    { key: 'owner_name', label: 'Odpowiedzialni', values: uniqueValues(state.tasks, 'owner_name', true) }, { key: 'progress', label: 'Postęp', filter: 'number' }, { key: 'start_date', label: 'Start', filter: 'date' }, { key: 'due_date', label: 'Deadline', filter: 'date' }, { key: 'priority', label: 'Priorytet', values: PRIORITY_VALUES }
  ];
  state.taskColumns = columns;
  $('#task-content').innerHTML = `<div class="panel compact-data-panel" id="task-list-panel"><div class="table-view-tools">${columnVisibilityControl('tasks', columns)}</div><div class="tablewrap"><table><thead><tr>${columns.map(column => `<th class="sortable" data-column="${column.key}" data-sort="${column.key}" data-label="${column.label}">${column.label}${sortMarker('tasks', column.key)}</th>`).join('')}</tr>${tableFilterRow(columns)}</thead><tbody id="task-list-body"></tbody></table></div></div>`;
  bindTableFilters('#task-list-panel', drawTaskListRows);
  bindColumnVisibility('#task-list-panel', 'tasks', columns, drawTaskListRows);
  $$('#task-list-panel th[data-sort]').forEach(th => th.addEventListener('click', () => updateSort('tasks', th.dataset.sort)));
  drawTaskListRows();
}

function drawTaskListRows() {
  let rows = sortRows(filterRows(filteredTasks(), '#task-list-panel'), state.sort.tasks);
  const grouping = state.grouping.tasks;
  const columns = state.taskColumns || [];
  const hidden = state.hiddenColumns.tasks || new Set();
  const visibleCount = Math.max(1, columns.filter(column => !hidden.has(column.key) && (!grouping || column.key !== grouping)).length);
  let html = '';
  for (const group of orderedGroups('tasks', grouping, rows)) {
    const items = grouping ? rows.filter(row => (row[grouping] || 'Bez wartości') === group) : rows;
    const collapsed = grouping && state.collapsedTaskGroups.has(String(group));
    const progress = items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.progress || 0), 0) / items.length) : 0;
    if (grouping) html += `<tr class="group-row ${collapsed ? 'collapsed' : ''}" data-task-group="${escapeHtml(group)}"><td colspan="${visibleCount}"><button type="button" class="group-toggle"><span>${collapsed ? '▸' : '▾'}</span><b>${escapeHtml(group)}</b><span class="group-progress"><i><u style="width:${progress}%"></u></i><b>${progress}%</b></span><small>${items.length} pozycji</small></button></td></tr>`;
    if (!collapsed) html += items.map(item => { const time = taskTimeLabel(item); const recurrence = taskRecurrenceLabel(item); return `<tr data-id="${item.id}"><td data-column="title" class="maincell">${escapeHtml(item.title)}${Number(item.image_count) ? `<span class="task-image-count" title="Zdjęcia: ${Number(item.image_count)}">▧ ${Number(item.image_count)}</span>` : ''}<span class="sub">${escapeHtml(item.description)}</span>${recurrence ? `<span class="time-chip recurring">↻ ${escapeHtml(recurrence)}</span>` : ''}${time ? `<span class="time-chip ${time.overdue ? 'overdue' : ''}">${escapeHtml(time.label)}</span>` : ''}</td><td data-column="scope_label">${escapeHtml(controllerLabel(item))}</td><td data-column="function_group_name">${escapeHtml(item.function_group_name || item.other_object || '—')}</td><td data-column="function_group_element_name">${escapeHtml(item.function_group_element_name || '—')}</td><td data-column="category">${escapeHtml(item.category || '—')}</td><td data-column="subcategory">${escapeHtml(item.subcategory || '—')}</td><td data-column="requirement_names">${inlineTaskField('requirement_ids', item, escapeHtml(item.requirement_names || '—'), 'textual')}</td><td data-column="status">${inlineStatusBadge('task', item)}</td><td data-column="owner_name">${inlineTaskField('direct_assignee_user_ids', item, escapeHtml(item.owner_name || '—'), 'textual')}</td><td data-column="progress"><span class="table-progress"><i><u style="width:${item.progress || 0}%"></u></i><b>${item.progress || 0}%</b></span></td><td data-column="start_date">${inlineTaskField('start_date', item, displayDate(item.start_date), 'date')}</td><td data-column="due_date">${inlineTaskField('due_date', item, displayDate(item.due_date), 'date')}</td><td data-column="priority">${inlineTaskField('priority', item, badge(item.priority), 'priority')}</td></tr>`; }).join('');
  }
  $('#task-list-body').innerHTML = html || `<tr><td colspan="${visibleCount}" class="empty">Brak wyników</td></tr>`;
  applyGroupedColumnVisibility('#task-list-panel', grouping, columns);
  $$('[data-task-group]').forEach(row => row.querySelector('button').addEventListener('click', () => { const key = row.dataset.taskGroup; if (state.collapsedTaskGroups.has(key)) state.collapsedTaskGroups.delete(key); else state.collapsedTaskGroups.add(key); drawTaskListRows(); }));
  $$('#task-list-body tr[data-id]').forEach(row => {
    const item = state.tasks.find(value => value.id === Number(row.dataset.id));
    appendEditLockNote(row, item, '.maincell');
    row.addEventListener('click', event => { if (!event.target.closest('[data-inline-entity-field]')) openRecord('tasks', item); });
    row.addEventListener('contextmenu', event => showEntityContext(event, 'tasks', item));
  });
  bindInlineEntityEditors();
}

function entity(type, id) {
  const collection = type === 'status' ? state.status : type === 'task' || type === 'tasks' ? state.tasks : type === 'point' || type === 'points' ? state.points : type === 'note' || type === 'notes' ? state.notes : type === 'goal' || type === 'goals' ? state.goals : [];
  return collection.find(item => item.id === Number(id));
}

function entityLabel(type, item) {
  if (!item) return 'Nie znaleziono elementu';
  if (type === 'status') return item.function_detail || item.station || 'Punkt statusu';
  if (type === 'task' || type === 'tasks') return item.title;
  if (type === 'point' || type === 'points') return item.title;
  if (type === 'goal' || type === 'goals') return item.title;
  return `${displayDate(item.note_date)} · ${item.content.slice(0, 80)}`;
}

function renderGoals() {
  queueMicrotask(decorateUnifiedWorkspace);
  $('#content').innerHTML = `<div class="goalgrid">${state.goals.map(goal => {
    const links = goal.links || [];
    const done = links.filter(link => ['Done', 'Closed'].includes(entity(link.entity_type, link.entity_id)?.status)).length;
    const progress = links.length ? Math.round(done * 100 / links.length) : 0;
    return `<article class="goal clickable-goal" data-goal-id="${goal.id}" tabindex="0"><div class="cardmeta"><span>${escapeHtml(controllerLabel(goal) || 'Wszystkie PLC')}</span>${badge(goal.status)}</div><h3>${escapeHtml(goal.title)}</h3><p>${escapeHtml(goal.description)}</p><div class="progress"><i style="width:${progress}%"></i></div><p>${done}/${links.length} elementów wymaganych do osiągnięcia kamienia milowego · termin ${displayDate(goal.due_date)}</p><div class="goal-links goal-dependency-list">${links.map(link => { const item = entity(link.entity_type, link.entity_id); return item ? dependencyCardHtml(link.entity_type, item) : '<div class="sub">Powiązany element jest niedostępny</div>'; }).join('') || '<span class="sub">Nie wybrano jeszcze elementów</span>'}</div><button class="secondary edit-goal" data-id="${goal.id}">Otwórz kamień milowy</button></article>`;
  }).join('') || '<div class="empty">Nie zdefiniowano kamieni milowych.</div>'}</div>`;
  $$('.edit-goal').forEach(button => button.addEventListener('click', () => openRecord('goals', state.goals.find(item => item.id === Number(button.dataset.id)))));
  $$('.clickable-goal').forEach(card => {
    appendEditLockNote(card, state.goals.find(item => item.id === Number(card.dataset.goalId)), 'h3');
    const edit = event => { if (event.target.closest('button,a')) return; openRecord('goals', state.goals.find(item => item.id === Number(card.dataset.goalId))); };
    card.addEventListener('click', edit);
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); edit(event); } });
  });
  bindDependencyJumps($('#content'));
  bindJumpItems();
}

function renderPoints() {
  queueMicrotask(decorateUnifiedWorkspace);
  if (state.pointMode === 'queue') state.pointMode = 'list';
  const searchable = ['list', 'queue'].includes(state.pointMode);
  const activeDependencies = (state.externalDependencies || []).filter(item => item.dependency_status !== 'resolved' || Number(item.configuration_pending)).length;
  const pointTools = state.pointSection === 'points' ? `<button id="point-reminder-mode" class="secondary ${state.pointMode === 'reminders' ? 'active-toggle' : ''}">Tablica</button><button id="point-list-mode" class="secondary ${state.pointMode === 'list' ? 'active-toggle' : ''}">Lista</button>${searchable ? '<input id="point-search" type="search" placeholder="Szukaj we wszystkich informacjach">' : ''}${state.pointMode === 'list' ? '<button type="button" class="mini" id="point-clear-filters">Wyczyść filtry</button>' : ''}${savedViewsToolbar('points')}` : '';
  $('#content').innerHTML = `<div class="panel compact-data-panel"><div class="toolbar module-toolbar point-section-toolbar" id="point-filter-bar"><strong>${state.pointSection === 'external' ? `Zależności zewnętrzne · ${activeDependencies}` : `Otwarte punkty · ${state.points.length}`}</strong>${pointTools}</div></div><div id="point-content"></div>`;
  if (state.pointSection === 'external') { renderExternalDependencies(); return; }
  $('#point-list-mode').addEventListener('click', () => { state.pointMode = 'list'; renderPoints(); });
  $('#point-reminder-mode').addEventListener('click', () => { state.pointMode = 'reminders'; renderPoints(); });
  if (state.pointMode === 'reminders') drawReminderView();
  else if (state.pointMode === 'queue') drawDependencyQueue('point', filteredPoints(), '#point-content');
  else drawPointList();
  if (state.pointMode === 'reminders') bindSavedViews('points', '#point-filter-bar', drawReminderView);
  if (state.pointMode === 'queue') bindSavedViews('points', '#point-filter-bar', () => drawDependencyQueue('point', filteredPoints(), '#point-content'));
  $('#point-search')?.addEventListener('input', state.pointMode === 'queue' ? () => drawDependencyQueue('point', filteredPoints(), '#point-content') : drawPointRows);
  $('#point-clear-filters')?.addEventListener('click', () => { $('#point-search').value = ''; $$('#points-panel input[data-filter-text], #points-panel input[data-filter-date], #points-panel input[data-filter-min], #points-panel input[data-filter-max]').forEach(input => { input.value = ''; }); $$('#points-panel [data-filter-kind] input[type="checkbox"]').forEach(input => { input.checked = false; }); updateFilterSummaries('#points-panel'); drawPointRows(); });
}

function filteredPoints() {
  const search = ($('#point-search')?.value || '').trim().toLowerCase();
  return state.points.filter(item => !search || JSON.stringify(item).toLowerCase().includes(search));
}

function drawPointList() {
  const columns = [
    { key: 'title', label: 'Temat' }, { key: 'controller', label: 'PLC', filter: 'hierarchy' }, { key: 'category', label: 'Kategoria', values: statusCategories() },
    { key: 'subcategory', label: 'Podkategoria', values: uniqueValues(state.points, 'subcategory') }, { key: 'status', label: 'Status', values: statusValues('point') },
    { key: 'waiting_for', label: 'Oczekiwanie na', values: options('waiting_for') }, { key: 'owner_name', label: 'Odpowiedzialny', values: uniqueValues(state.points, 'owner_name', true) },
    { key: 'requirement_names', label: 'Zapotrzebowanie', values: uniqueValues(state.points, 'requirement_names', true) }, { key: 'due_date', label: 'Deadline', filter: 'date' }, { key: 'reminder_date', label: 'Przypomnienie', filter: 'date' }
  ];
  state.pointColumns = columns;
  $('#point-content').innerHTML = `<div class="panel compact-data-panel" id="points-panel"><div class="table-view-tools">${columnVisibilityControl('points', columns)}</div><div class="tablewrap"><table><thead><tr>${columns.map(column => `<th class="sortable" data-column="${column.key}" data-sort="${column.key}" data-label="${column.label}">${column.label}${sortMarker('points', column.key)}</th>`).join('')}</tr>${tableFilterRow(columns)}</thead><tbody id="points-body"></tbody></table></div></div>`;
  bindTableFilters('#points-panel', drawPointRows);
  bindColumnVisibility('#points-panel', 'points', columns, drawPointRows);
  bindSavedViews('points', '#points-panel', drawPointRows);
  $$('#points-panel th[data-sort]').forEach(th => th.addEventListener('click', () => updateSort('points', th.dataset.sort)));
  drawPointRows();
}

function drawPointRows() {
  const rows = sortRows(filterRows(filteredPoints(), '#points-panel'), state.sort.points);
  const columns = state.pointColumns || [];
  const visibleCount = Math.max(1, columns.filter(column => !(state.hiddenColumns.points || new Set()).has(column.key)).length);
  $('#points-body').innerHTML = rows.map(item => `<tr data-id="${item.id}"><td data-column="title" class="maincell">${escapeHtml(item.title)}<span class="sub">${escapeHtml(item.description)}</span><span class="sub">Utworzył: ${escapeHtml(item.created_by_name || 'dane historyczne')} · ${displayDate((item.created_at || '').slice(0, 10))}</span></td><td data-column="controller">${escapeHtml(controllerLabel(item))}</td><td data-column="category">${escapeHtml(item.category || '—')}</td><td data-column="subcategory">${escapeHtml(item.subcategory || '—')}</td><td data-column="status">${inlineEntityField('points', 'status', item, badge(item.status), 'priority')}</td><td data-column="waiting_for">${inlineEntityField('points', 'waiting_for', item, escapeHtml(item.waiting_for || '—'), 'textual')}</td><td data-column="owner_name">${inlineEntityField('points', 'owner_user_id', item, escapeHtml(item.owner_name || '—'), 'textual')}</td><td data-column="requirement_names">${inlineEntityField('points', 'requirement_ids', item, escapeHtml(item.requirement_names || '—'), 'textual')}</td><td data-column="due_date">${inlineEntityField('points', 'due_date', item, displayDate(item.due_date), 'date')}</td><td data-column="reminder_date">${inlineEntityField('points', 'reminder_date', item, displayDate(item.reminder_date), 'date')}</td></tr>`).join('') || `<tr><td colspan="${visibleCount}" class="empty">Brak wyników</td></tr>`;
  applyGroupedColumnVisibility('#points-panel', '', columns);
  $$('#points-body tr[data-id]').forEach(row => {
    const item = state.points.find(value => value.id === Number(row.dataset.id));
    appendEditLockNote(row, item, '.maincell');
    row.addEventListener('click', event => { if (!event.target.closest('[data-inline-entity-field]')) openRecord('points', item); });
    row.addEventListener('contextmenu', event => showEntityContext(event, 'points', item));
  });
  bindInlineEntityEditors();
}

function showEntityContext(event, type, item) {
  if (!item) return;
  event.preventDefault(); event.stopPropagation();
  const menu = $('#context-menu');
  menu.innerHTML = '<button data-action="edit">Otwórz</button><button data-action="duplicate">Duplikuj…</button>';
  menu.style.left = `${Math.min(event.clientX, innerWidth - 240)}px`;
  menu.style.top = `${Math.min(event.clientY, innerHeight - 130)}px`;
  menu.classList.remove('hidden');
  menu.querySelector('[data-action="edit"]').addEventListener('click', () => { menu.classList.add('hidden'); openRecord(type, item); });
  menu.querySelector('[data-action="duplicate"]').addEventListener('click', () => { menu.classList.add('hidden'); openDuplicate(type, item); });
}

function openTaskChecklistPopup(taskId) {
  const task = state.tasks.find(item => item.id === Number(taskId));
  if (!task) return;
  state.checklistTask = task;
  $('#task-checklist-title').textContent = task.title;
  $('#task-checklist-description').textContent = `${controllerLabel(task)} · ${task.progress || 0}% wykonania`;
  const checklist = task.checklist || [];
  $('#task-checklist-popup').innerHTML = `${checklist.length ? `<section class="checks compact-popup-checks"><header><span><b>Podzadania</b><small>Waga wpływa na procent wykonania całego zadania.</small></span><button type="button" class="mini" id="popup-add-check">+ Podzadanie</button></header><div id="popup-checklist">${checklist.map(checklistRow).join('')}</div></section>` : ''}${(task.scope_checklist || []).length ? `<section class="scope-checks compact-popup-scope"><header><span><b>Kontrola sterowników w zakresie</b><small>Elementy automatycznie utworzone z hierarchii projektu.</small></span></header><div>${task.scope_checklist.map(item => `<div class="scope-check-row"><input type="checkbox" data-popup-scope-controller="${item.controller_id}" ${item.done ? 'checked' : ''}><span><b>${escapeHtml(item.controller_label || auditControllerName(item.controller_id))}</b></span><button type="button" class="mini remove-popup-scope" title="Usuń ten sterownik z kontroli">×</button></div>`).join('')}</div></section>` : ''}`;
  const bind = () => $$('#task-checklist-popup .delete-check').forEach(button => button.onclick = () => button.closest('.check-row').remove());
  bind();
  $$('#task-checklist-popup .remove-popup-scope').forEach(button => button.addEventListener('click', () => button.closest('.scope-check-row').remove()));
  $('#popup-add-check')?.addEventListener('click', () => { $('#popup-checklist').insertAdjacentHTML('beforeend', checklistRow()); bind(); });
  $('#task-checklist-dialog').dataset.dirty = '';
  $('#task-checklist-dialog').showModal();
}

async function saveTaskChecklistPopup() {
  const task = state.checklistTask;
  if (!task) return;
  const checklist = $$('#popup-checklist .check-row').map(row => ({
    text: row.querySelector('[data-check-text]').value.trim(), done: row.querySelector('[data-check-done]').checked,
    weight: Number(row.querySelector('[data-check-weight]').value) || 1, owner_user_id: Number(row.querySelector('[data-check-owner]').value) || null
  })).filter(item => item.text);
  const scopeChecklist = $$('#task-checklist-popup [data-popup-scope-controller]').map(input => ({ controller_id: Number(input.dataset.popupScopeController), done: input.checked }));
  const button = $('#task-checklist-save'); button.disabled = true;
  try {
    await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ ...task, checklist, scope_checklist: scopeChecklist }) });
    $('#task-checklist-dialog').close();
    toast('Lista kontrolna została zapisana');
    await loadData();
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

function reminderSection(title, items, color) {
  return `<section class="list-section"><header><strong>${title}</strong><span class="badge ${color}">${items.length}</span></header><div class="compact-list">${items.map(item => `<div class="compact-item" data-jump="points" data-id="${item.id}"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(controllerLabel(item))} · ${escapeHtml(item.owner_name || 'bez odpowiedzialnego')}</small></span><span>${displayDate(item.reminder_date)}</span></div>`).join('') || '<div class="empty">Brak punktów</div>'}</div></section>`;
}

function drawReminderView() {
  const warningDays = Number(state.config.settings.reminder_warning_days || 7);
  const open = state.points.filter(item => item.status !== 'Closed' && item.reminder_date);
  const overdue = open.filter(item => dayDifference(item.reminder_date) < 0).sort((a, b) => a.reminder_date.localeCompare(b.reminder_date));
  const upcoming = open.filter(item => dayDifference(item.reminder_date) >= 0 && dayDifference(item.reminder_date) <= warningDays).sort((a, b) => a.reminder_date.localeCompare(b.reminder_date));
  $('#point-content').innerHTML = `<div class="reminder-grid">${reminderSection('Przedawnione przypomnienia', overdue, 'red')}${reminderSection(`Zbliżające się w ciągu ${warningDays} dni`, upcoming, 'amber')}</div>`;
  $$('#point-content .compact-item[data-id]').forEach(row => appendEditLockNote(row, state.points.find(item => item.id === Number(row.dataset.id)), 'span:first-child'));
  bindJumpItems();
}

function renderNotes() {
  queueMicrotask(decorateUnifiedWorkspace);
  const weeks = [...new Map(state.notes.map(item => { const week = isoWeek(item.note_date); return [week.key, week]; })).values()];
  $('#content').innerHTML = `<div class="panel"><div class="toolbar"><strong>Historia wpisów</strong><label>Od <input type="date" id="notes-from" value="${state.notesFrom}"></label><label>Do <input type="date" id="notes-to" value="${state.notesTo}"></label><select id="week-filter" aria-label="Numer tygodnia kalendarzowego">${selectOptions(weeks.map(week => ({ value: week.key, label: week.label })), state.notesWeek, 'Wszystkie CW')}</select><select id="notes-group" aria-label="Grupowanie"><option value="scope">Zakres projektu</option><option value="type">Typ wpisu</option><option value="shift">Zmiana</option><option value="cw">Tydzień kalendarzowy</option><option value="">Bez grupowania</option></select><button id="notes-refresh" class="secondary">Odśwież zakres</button></div></div><div id="notes-list" class="notes"></div>`;
  $('#notes-group').value = state.grouping.notes;
  $('#notes-group').addEventListener('change', event => { state.grouping.notes = event.target.value; drawNotes(); });
  $('#week-filter').addEventListener('change', event => { state.notesWeek = event.target.value; drawNotes(); });
  $('#notes-refresh').addEventListener('click', async () => {
    state.notesFrom = $('#notes-from').value || twoWeeksAgo();
    state.notesTo = $('#notes-to').value || today();
    state.notesWeek = '';
    const query = `?controller=${encodeURIComponent(state.controller)}&from=${state.notesFrom}&to=${state.notesTo}`;
    state.notes = await api('/api/daily-notes' + query);
    renderNotes();
  });
  drawNotes();
}

function drawNotes() {
  const weekFilter = $('#week-filter')?.value || '';
  const rows = state.notes.map(item => ({ ...item, type: [...new Set((item.sections || []).map(section => section.information_type).filter(Boolean))].join(', ') || item.type, scope: item.scope_label || controllerLabel(item) || 'Cały projekt', cw: isoWeek(item.note_date).label, cwKey: isoWeek(item.note_date).key })).filter(item => !weekFilter || item.cwKey === weekFilter);
  const grouping = state.grouping.notes;
  const groups = grouping ? [...new Set(rows.map(item => item[grouping] || 'Bez wartości'))] : [''];
  $('#notes-list').innerHTML = groups.map(group => `${grouping ? `<div class="group-title">${escapeHtml(group)} · ${rows.filter(item => (item[grouping] || 'Bez wartości') === group).length}</div>` : ''}${(grouping ? rows.filter(item => (item[grouping] || 'Bez wartości') === group) : rows).map(item => { const links = item.links || []; const sections = item.sections?.length ? item.sections : [{ information_type: item.type, content: item.content, scopes: [{ label: item.scope_label || 'Cały projekt' }] }]; return `<article class="note status-transfer-card" data-id="${item.id}"><div class="note-meta">${displayDate(item.note_date)} · ${escapeHtml(item.cw)}<br>${escapeHtml(item.shift)}<br>${escapeHtml(item.author || item.created_by_name)}<br>Utworzono: ${displayDateTime(item.created_at)}</div><div><strong>${escapeHtml(item.title || 'Przekazanie statusu')}</strong><small class="sub">${sections.length} ${sections.length === 1 ? 'informacja' : 'informacje'}</small><div class="transfer-section-preview">${sections.slice(0, 3).map(section => `<p><b>${escapeHtml(section.information_type || 'Informacja')} · ${escapeHtml((section.scopes || []).map(scope => scope.label).join(', ') || 'Cały projekt')}</b><span>${escapeHtml(section.content)}</span></p>`).join('')}${sections.length > 3 ? `<small>+${sections.length - 3} kolejne informacje</small>` : ''}</div><div class="links">${links.slice(0, 2).map(link => linkChip(link.entity_type, link.entity_id, ({ status: 'Status', task: 'Zadanie', point: 'Otwarty punkt', goal: 'Kamień milowy', note: 'Przekazanie' })[link.entity_type] || link.entity_type)).join('')}${links.length > 2 ? `<span class="more-relations">+${links.length - 2} powiązania · otwórz przekazanie</span>` : ''}</div></div></article>`; }).join('')}`).join('') || '<div class="empty">Brak przekazań statusu</div>';
  $$('.note[data-id]').forEach(row => row.addEventListener('click', event => { if (!event.target.closest('.jump')) openStatusTransferEditor(state.notes.find(item => item.id === Number(row.dataset.id))); }));
  bindJumpItems();
}

function emptyStatusTransferSection() { return { information_type: options('note_type')[0] || 'Postęp', content: '', scopes: [{ scope_type: 'project', scope_id: 0 }], recipient_user_ids: [], links: [] }; }

function captureStatusTransferSections() {
  if (!state.statusTransfer) return;
  state.statusTransfer.mentioned_user_ids = [...document.querySelectorAll('[data-transfer-global-recipient]:checked')].map(input => Number(input.value));
  state.statusTransfer.sections = $$('#status-transfer-sections .status-transfer-section').map((root, index) => ({
    information_type: root.querySelector('[data-transfer-type]').value,
    content: root.querySelector('[data-transfer-content]').value,
    scopes: [...root.querySelectorAll('[data-transfer-scope]:checked')].map(input => { const [scope_type, raw] = input.value.split(':'); return { scope_type, scope_id: Number(raw || 0) }; }),
    recipient_user_ids: [...root.querySelectorAll('[data-transfer-recipient]:checked')].map(input => Number(input.value)),
    links: state.statusTransfer.sections[index]?.links || []
  }));
}

function statusTransferScopeOptions(selected = []) {
  const keys = new Set(selected.map(scope => `${scope.scope_type}:${Number(scope.scope_id || 0)}`));
  const children = parentId => state.controllerGroups.filter(group => Number(group.parent_id || 0) === Number(parentId || 0));
  const option = (value, label, depth, kind = '') => `<label class="hierarchy-target-option ${kind}" style="--hierarchy-depth:${depth}"><input type="checkbox" data-transfer-scope value="${value}" ${keys.has(value) ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`;
  const branch = (group, depth = 0) => `<div class="hierarchy-target-branch">${option(`group:${group.id}`, group.name, depth, 'hierarchy-group-node')}${children(group.id).map(item => branch(item, depth + 1)).join('')}${state.controllers.filter(item => Number(item.group_id) === Number(group.id)).map(item => option(`controller:${item.id}`, item.display_name || item.code, depth + 1, 'hierarchy-controller-node')).join('')}</div>`;
  return `${option('project:0', 'Cały projekt', 0, 'hierarchy-project-node')}${children(0).map(item => branch(item)).join('')}${state.controllers.filter(item => !item.group_id).map(item => option(`controller:${item.id}`, item.display_name || item.code, 0, 'hierarchy-controller-node')).join('')}`;
}

function bindTransferRecipientControls() {
  $$('#status-transfer-dialog .multi-choice-search').forEach(search => search.addEventListener('input', () => { const term = search.value.trim().toLocaleLowerCase('pl'); search.parentElement.querySelectorAll(':scope > label').forEach(label => { label.hidden = Boolean(term) && !label.textContent.toLocaleLowerCase('pl').includes(term); }); }));
  $$('#status-transfer-dialog .multi-user-select input[type="checkbox"]').forEach(input => input.addEventListener('change', () => { const details = input.closest('details'); const names = [...details.querySelectorAll('input[type="checkbox"]:checked')].map(control => control.closest('label').textContent.trim()); details.querySelector('summary').textContent = names.length ? `${names.length} · ${names.join(', ')}` : details.dataset.emptyLabel || 'Bez wskazanych osób'; }));
  $$('#status-transfer-dialog [data-transfer-scope]').forEach(input => input.addEventListener('change', () => {
    const picker = input.closest('.transfer-scope-picker');
    if (input.checked && input.value === 'project:0') picker.querySelectorAll('[data-transfer-scope]').forEach(control => { if (control !== input) control.checked = false; });
    else if (input.checked) { const project = picker.querySelector('[data-transfer-scope][value="project:0"]'); if (project) project.checked = false; }
    const count = picker.querySelectorAll('[data-transfer-scope]:checked').length;
    picker.querySelector('summary').textContent = count ? `Zakresy · ${count}` : 'Wybierz zakres';
  }));
}

function renderStatusTransferSections() {
  const draft = state.statusTransfer; if (!draft) return;
  const disabled = draft.can_edit === false ? 'disabled' : '';
  $('#status-transfer-sections').innerHTML = draft.sections.map((section, index) => `<section class="status-transfer-section" data-section-index="${index}"><header><span><b>Informacja ${index + 1}</b></span><div class="transfer-section-header-tools"><label>Typ <select data-transfer-type ${disabled}>${selectOptions(options('note_type'), section.information_type || options('note_type')[0], null)}</select></label><details class="transfer-scope-picker"><summary>Zakresy · ${(section.scopes || []).length || 1}</summary><div class="hierarchy-target-menu">${statusTransferScopeOptions(section.scopes || [])}</div></details><div class="transfer-recipient-picker">${meetingUsersHtml('data-transfer-recipient', section.recipient_user_ids || [], 'Powiadom osoby')}</div><button type="button" class="secondary" data-transfer-links="${index}">Powiązania · ${(section.links || []).length}</button>${draft.can_edit !== false && draft.sections.length > 1 ? `<button type="button" class="mini danger-text" data-transfer-remove="${index}">Usuń</button>` : ''}</div></header><label class="field full"><span>Treść *</span><textarea rows="5" data-transfer-content required ${disabled}>${escapeHtml(section.content || '')}</textarea></label></section>`).join('');
  if (draft.can_edit === false) $$('#status-transfer-dialog [data-transfer-scope],#status-transfer-dialog [data-transfer-recipient],#status-transfer-dialog [data-transfer-global-recipient]').forEach(input => { input.disabled = true; });
  $$('[data-transfer-remove]').forEach(button => button.addEventListener('click', () => { captureStatusTransferSections(); state.statusTransfer.sections.splice(Number(button.dataset.transferRemove), 1); renderStatusTransferSections(); }));
  $$('[data-transfer-links]').forEach(button => button.addEventListener('click', () => { captureStatusTransferSections(); openStatusTransferRelations(Number(button.dataset.transferLinks)); }));
  bindTransferRecipientControls();
}

function openStatusTransferRelations(index) {
  const section = state.statusTransfer?.sections?.[index]; if (!section) return;
  $('#insight-title').textContent = `Powiązania · Informacja ${index + 1}`;
  $('#insight-description').textContent = `${section.links.length} elementów · lista jest tylko podglądem`;
  $('#insight-content').innerHTML = `<div class="transfer-relation-list">${section.links.map(link => { const item = entity(link.entity_type, link.entity_id); return `<button type="button" data-relation-jump="${link.entity_type}" data-id="${link.entity_id}"><span class="type-dot ${link.entity_type}"></span><span><b>${escapeHtml(operationTypeNames[link.entity_type] || link.entity_type)}</b><small>${escapeHtml(entityLabel(link.entity_type, item))}</small></span><em>Przejdź →</em></button>`; }).join('') || '<div class="empty">Brak powiązań dla tej informacji.</div>'}</div>${state.statusTransfer.can_edit === false ? '' : '<div class="insight-footer"><button type="button" class="primary" id="status-transfer-relations-edit">Dodaj / edytuj powiązania</button></div>'}`;
  $$('[data-relation-jump]').forEach(button => button.addEventListener('click', () => openEntityOverlay(button.dataset.relationJump, Number(button.dataset.id))));
  $('#status-transfer-relations-edit')?.addEventListener('click', () => {
    $('#insight-dialog').close();
    openEntitySelection({ mode: 'status_transfer', allowed: ['status', 'task', 'point', 'goal', 'note'], initial: section.links || [], onApply: async links => { section.links = links; renderStatusTransferSections(); } });
  });
  $('#insight-dialog').showModal();
}

async function openStatusTransferAudit() {
  const id = state.statusTransfer?.id; if (!id) return;
  try {
    const rows = await api(`/api/audit?type=note&id=${id}`);
    $('#insight-title').textContent = 'Historia przekazania statusu';
    $('#insight-description').textContent = `${rows.length} zapisanych zmian`;
    $('#insight-content').innerHTML = `<div class="audit-timeline">${rows.filter(row => auditChangesHtml(row.changes)).map(row => `<article><header><b>${escapeHtml(row.user_name || 'System')}</b><time>${displayDateTime(row.changed_at)}</time></header><div>${auditChangesHtml(row.changes)}</div></article>`).join('') || '<div class="empty">Brak historii.</div>'}</div>`;
    $('#insight-dialog').showModal();
  } catch (error) { toast(error.message, true); }
}

function openStatusTransferEditor(existing = null, prefill = null) {
  state.statusTransfer = {
    id: existing?.id || null, updated_at: existing?.updated_at || null,
    title: existing?.title || prefill?.title || `Przekazanie · ${options('shift')[0] || 'Dzień'}`,
    note_date: existing?.note_date || prefill?.note_date || today(), shift: existing?.shift || options('shift')[0] || 'Dzień',
    mentioned_user_ids: existing?.mentioned_user_ids || [],
    sections: existing?.sections?.length ? existing.sections.map(section => ({ information_type: section.information_type || existing.type || options('note_type')[0], content: section.content, scopes: (section.scopes || []).map(scope => ({ scope_type: scope.scope_type, scope_id: Number(scope.scope_id || 0) })), recipient_user_ids: section.recipient_user_ids || [], links: (section.links || []).map(link => ({ entity_type: link.entity_type, entity_id: Number(link.entity_id) })) })) : [prefill ? { information_type: prefill.information_type || options('note_type')[0], content: prefill.content || '', scopes: prefill.controller ? [{ scope_type: 'controller', scope_id: state.controllers.find(item => item.code === prefill.controller)?.id || 0 }] : [{ scope_type: 'project', scope_id: 0 }], recipient_user_ids: [], links: prefill.links || [] } : emptyStatusTransferSection()],
    can_delete: existing?.can_delete, can_edit: existing?.can_edit ?? true
  };
  $('#status-transfer-title').value = state.statusTransfer.title;
  $('#status-transfer-date').value = state.statusTransfer.note_date;
  $('#status-transfer-shift').innerHTML = selectOptions(options('shift'), state.statusTransfer.shift, null);
  $('#status-transfer-global-recipients').innerHTML = meetingUsersHtml('data-transfer-global-recipient', state.statusTransfer.mentioned_user_ids, 'Bez globalnego powiadomienia');
  $('#status-transfer-delete').hidden = !existing?.id || !existing?.can_delete;
  $('#status-transfer-audit').hidden = !existing?.id;
  $('#status-transfer-add-section').hidden = state.statusTransfer.can_edit === false;
  $('#status-transfer-save').hidden = state.statusTransfer.can_edit === false;
  ['#status-transfer-title', '#status-transfer-date', '#status-transfer-shift'].forEach(selector => { $(selector).disabled = state.statusTransfer.can_edit === false; });
  renderStatusTransferSections();
  $('#status-transfer-dialog').showModal();
}

function addStatusTransferSection() { captureStatusTransferSections(); state.statusTransfer.sections.push(emptyStatusTransferSection()); renderStatusTransferSections(); }

async function saveStatusTransfer(event) {
  event.preventDefault(); captureStatusTransferSections();
  const draft = state.statusTransfer; const sections = draft.sections.filter(section => section.content.trim()).map(section => ({ ...section, scopes: section.scopes.length ? section.scopes : [{ scope_type: 'project', scope_id: 0 }] }));
  if (!sections.length) return toast('Dodaj co najmniej jedną informację', true);
  try {
    await api(draft.id ? `/api/daily-notes/${draft.id}` : '/api/daily-notes', { method: draft.id ? 'PATCH' : 'POST', body: JSON.stringify({ title: $('#status-transfer-title').value, note_date: $('#status-transfer-date').value, shift: $('#status-transfer-shift').value, mentioned_user_ids: draft.mentioned_user_ids, sections, updated_at: draft.updated_at }) });
    $('#status-transfer-dialog').close(); toast('Przekazanie statusu zostało zapisane'); await loadData();
  } catch (error) { toast(error.message, true); }
}

async function deleteStatusTransfer() {
  const draft = state.statusTransfer; if (!draft?.id || !await uiConfirm('Usuń przekazanie statusu', 'Wpis i jego sekcje zostaną usunięte z historii.', 'Usuń', true)) return;
  try { await api(`/api/daily-notes/${draft.id}`, { method: 'DELETE' }); $('#status-transfer-dialog').close(); toast('Przekazanie usunięte'); await loadData(); } catch (error) { toast(error.message, true); }
}

function linkChip(type, id, prefix) {
  const item = entity(type, id);
  return item ? `<button class="jump" data-type="${type}" data-id="${id}"><span><b>${prefix}:</b> ${escapeHtml(entityLabel(type, item))}</span><span>→</span></button>` : '';
}

function orderControls(kind, items, index) {
  return `<span class="order-buttons"><button class="mini move-item" data-kind="${kind}" data-id="${items[index].id}" data-direction="-1" ${index === 0 ? 'disabled' : ''}>↑</button><button class="mini move-item" data-kind="${kind}" data-id="${items[index].id}" data-direction="1" ${index === items.length - 1 ? 'disabled' : ''}>↓</button></span>`;
}

function configListRows(kind, items, admin, editClass, deleteKind) {
  return items.map((item, index) => `<div class="settings-row">${orderControls(kind, items, index)}<span>${escapeHtml(item.name || item.value || item.display_name || item.code)}${item.description ? `<small class="sub">${escapeHtml(item.description)}</small>` : ''}</span><button class="mini ${editClass}" data-id="${item.id}">Edytuj</button>${admin ? `<button class="mini delete-config" data-kind="${deleteKind}" data-id="${item.id}">Usuń</button>` : ''}</div>`).join('');
}

function categoryConfig(scope, categories, admin, canEdit = admin) {
  const kind = scope === 'task' ? 'task_categories' : 'categories';
  const subKind = scope === 'task' ? 'task_subcategories' : 'subcategories';
  const deleteCategory = scope === 'task' ? 'task_category' : 'category';
  const deleteSub = scope === 'task' ? 'task_subcategory' : 'subcategory';
  if (!state.categorySelection[scope] || !categories.some(item => item.id === state.categorySelection[scope])) state.categorySelection[scope] = categories[0]?.id || null;
  const selected = categories.find(item => item.id === state.categorySelection[scope]);
  const categoryRows = categories.map((category, index) => `<div class="hierarchy-tree-row category-tree-row ${selected?.id === category.id ? 'selected' : ''}">${canEdit ? orderControls(kind, categories, index) : ''}<button type="button" class="select-category-node" data-scope="${scope}" data-id="${category.id}"><b>${escapeHtml(category.name)}</b><small>${category.subcategories.length} podkategorii</small></button>${canEdit ? `<span class="category-node-actions"><button type="button" class="mini edit-category" data-scope="${scope}" data-id="${category.id}" data-value="${escapeHtml(category.name)}" title="Edytuj nazwę">✎</button>${admin ? `<button type="button" class="mini danger-outline delete-config" data-kind="${deleteCategory}" data-id="${category.id}" title="Usuń kategorię">×</button>` : ''}</span>` : ''}</div>`).join('');
  const addCategory = canEdit ? `<form class="inline-form add-category category-add-form" data-scope="${scope}"><input name="name" placeholder="Nowa kategoria" required><button class="mini">Dodaj</button></form>` : '';
  const details = selected ? `<div class="category-detail-head"><div><small>Wybrana kategoria</small><h3>${escapeHtml(selected.name)}</h3></div>${canEdit ? `<div><button class="mini add-sub" data-scope="${scope}" data-id="${selected.id}">+ Podkategoria</button></div>` : ''}</div><div class="category-sub-list">${selected.subcategories.map((sub, subIndex) => `<div class="settings-row">${canEdit ? orderControls(subKind, selected.subcategories, subIndex) : ''}<span><b>${escapeHtml(sub.name)}</b>${scope === 'status' && sub.default_function ? `<small class="sub">${escapeHtml(sub.default_function)}</small>` : ''}</span>${canEdit ? `<button class="mini edit-sub" data-scope="${scope}" data-id="${sub.id}" data-parent="${selected.id}" data-value="${escapeHtml(sub.name)}" data-function="${escapeHtml(sub.default_function || '')}">Edytuj</button>` : ''}${admin ? `<button class="mini delete-config" data-kind="${deleteSub}" data-id="${sub.id}">Usuń</button>` : ''}</div>`).join('') || '<div class="empty compact-empty">Brak podkategorii.</div>'}</div>` : '<div class="empty">Dodaj pierwszą kategorię po lewej stronie.</div>';
  return `<div class="category-editor"><aside><strong>Kategorie</strong><div class="config-tree compact-tree">${categoryRows || '<div class="empty compact-empty">Brak kategorii.</div>'}</div>${addCategory}</aside><section class="category-detail">${details}</section></div>`;
}

function functionGroupConfig(admin) {
  const groups = functionGroups(state.functionGroupController);
  return `<section class="settings-card settings-wide"><div class="settings-title-row"><div><h2>Grupy funkcyjne i punkty statusu</h2><p class="sub">Osobna, uporządkowana lista stacji, robotów i innych grup dla każdego sterownika.</p></div><label class="field compact-field"><span>Sterownik</span><select id="function-group-controller">${selectOptions(state.controllers.map(item => ({ value: item.code, label: item.display_name || item.code })), state.functionGroupController)}</select></label></div>
    <div class="function-group-list compact-function-groups">${groups.map((group, index) => `<div class="settings-row function-group-row">${admin ? orderControls('function_groups', groups, index) : ''}<span><b>${escapeHtml(group.name)}</b><small class="sub">${group.check_count} punktów statusu · ${group.status_count} wierszy · ${(group.elements || []).length} elementów · ${(group.subcategories || []).length} podkategorii</small></span>${admin ? `<button class="mini manage-function-group-list" data-group="${group.id}" data-kind="elements">Elementy (${(group.elements || []).length})</button><button class="mini manage-function-group-list" data-group="${group.id}" data-kind="subcategories">Podkategorie (${(group.subcategories || []).length})</button><button class="mini edit-function-points" data-id="${group.id}">Punkty statusu</button><button class="mini rename-function-group" data-id="${group.id}" data-value="${escapeHtml(group.name)}">Nazwa</button><button class="mini danger-outline delete-function-group" data-id="${group.id}">Usuń</button>` : ''}</div>`).join('') || '<div class="empty compact-empty">Brak grup funkcyjnych dla wybranego sterownika.</div>'}</div>
    ${admin ? `<div class="function-group-actions"><form id="new-function-group" class="inline-form"><input name="name" placeholder="Nowa grupa, np. Robot R01" required><button class="mini">Dodaj grupę</button></form><div class="bulk-groups"><label class="field"><span>Szybkie dodawanie — jeden wiersz = jedna grupa funkcyjna</span><textarea id="bulk-function-groups" rows="6" placeholder="Stacja 010\nRobot R01\nRobot R02"></textarea></label><button class="secondary" id="bulk-function-groups-add">Dodaj listę</button></div></div>` : '<p class="sub">Edycja grup funkcyjnych jest dostępna dla administratora.</p>'}
  </section>`;
}

function statusMatrixConfig(canEdit) {
  const groups = statusGroups();
  const columnRows = (group, subgroup) => {
    const scope = subgroup || group;
    const inherited = Boolean(scope.inheritance);
    const columns = inherited ? (scope.columns || []) : (scope.own_columns || scope.columns || []);
    const editable = canEdit && !inherited;
    const rows = items => `<div class="status-config-columns">${items.map(column => { const index = columns.indexOf(column); const detail = statusColumnRole(column) === 'subpoint' ? (column.field_type === 'status' ? `Status · ${column.include_in_progress ? 'liczony do realizacji' : 'informacyjny'}` : 'Pole tekstowe') : ''; return `<div class="settings-row status-config-column ${inherited ? 'inherited' : ''}">${editable ? orderControls('status_columns', columns, index) : ''}<span title="${escapeHtml(column.description || '')}"><b>${escapeHtml(column.name)}</b>${column.description ? `<small class="sub">${escapeHtml(column.description)}</small>` : ''}${detail ? `<small class="sub">${detail}</small>` : ''}</span>${editable ? `<button class="mini edit-status-column" data-group="${group.id}" data-subgroup="${subgroup?.id || ''}" data-id="${column.id}">Edytuj</button><button class="mini danger-outline delete-status-column" data-group="${group.id}" data-subgroup="${subgroup?.id || ''}" data-id="${column.id}">Usuń</button>` : ''}</div>`; }).join('')}</div>`;
    const basic = columns.filter(column => statusColumnRole(column) === 'basic');
    const subpoints = columns.filter(column => statusColumnRole(column) === 'subpoint');
    const note = inherited ? `<p class="status-inheritance-note">Dziedziczony układ: <b>${escapeHtml(scope.inheritance.label || 'grupa nadrzędna')}</b>${scope.inheritance.implicit ? ' · automatycznie, ponieważ podgrupa nie ma własnych kolumn' : ''}</p>` : '';
    return `${note}<div class="status-column-kinds"><section><h5>Kolumny podstawowe</h5>${basic.length ? rows(basic) : '<div class="empty compact-empty">Brak kolumn opisowych.</div>'}</section><section><h5>Podpunkty statusowe</h5>${subpoints.length ? rows(subpoints) : '<div class="empty compact-empty">Brak podpunktów do weryfikacji.</div>'}</section></div>`;
  };
  const addColumnButtons = (groupId, subgroupId = '', scope = null) => scope?.inheritance && !scope.inheritance.implicit ? '' : `<button class="mini add-status-column" data-column-role="basic" data-group="${groupId}" data-subgroup="${subgroupId}">+ Kolumna podstawowa</button><button class="mini add-status-column" data-column-role="subpoint" data-group="${groupId}" data-subgroup="${subgroupId}">+ Podpunkt statusowy</button>`;
  const layoutActions = canEdit ? '<div class="status-layout-actions"><button type="button" class="mini" id="status-layout-export">Eksportuj układ JSON</button><label class="mini button-file">Importuj układ JSON<input type="file" id="status-layout-import" accept="application/json,.json"></label><button type="button" class="mini" id="status-layout-text-import">Importuj z tekstu</button><button class="secondary" id="new-status-group">+ Dodaj grupę</button><button class="secondary" id="status-states-open">Stany punktów statusowych</button></div>' : '';
  const groupCards = groups.map((group, groupIndex) => {
    const collapsed = state.collapsedStatusConfigGroups.has(Number(group.id));
    const subgroups = (group.subgroups || []).map((subgroup, subgroupIndex, siblings) => `<section class="status-config-subgroup"><header>${canEdit ? orderControls('status_subgroups', siblings, subgroupIndex) : ''}<span><b>${escapeHtml(subgroup.name)}</b>${subgroup.description ? `<small>${escapeHtml(subgroup.description)}</small>` : ''}</span>${canEdit ? `<button class="mini edit-status-subgroup" data-group="${group.id}" data-id="${subgroup.id}">Edytuj</button>${addColumnButtons(group.id, subgroup.id, subgroup)}<button class="mini danger-outline delete-status-subgroup" data-group="${group.id}" data-id="${subgroup.id}">Usuń</button>` : ''}</header>${columnRows(group, subgroup)}</section>`).join('') || '<div class="empty compact-empty">Ta grupa nie ma podgrup. Punkty mogą znajdować się bezpośrednio w grupie.</div>';
    return `<article class="status-config-group" data-status-config-group="${group.id}"><header>${canEdit ? orderControls('status_groups', groups, groupIndex) : ''}<button type="button" class="mini status-config-group-toggle" data-id="${group.id}" aria-expanded="${!collapsed}" title="${collapsed ? 'Rozwiń grupę' : 'Zwiń grupę'}">${collapsed ? '▸' : '▾'}</button><span><b class="status-config-group-title">${escapeHtml(group.name)}</b>${group.description ? `<small>${escapeHtml(group.description)}</small>` : ''}</span>${canEdit ? `<button class="mini edit-status-group" data-id="${group.id}">Edytuj</button><button class="mini copy-status-layout" data-group="${group.id}">Kopiuj</button><button class="mini add-status-subgroup" data-group="${group.id}">+ Podgrupa</button>${addColumnButtons(group.id, '', group)}<button class="mini danger-outline delete-status-group" data-id="${group.id}">Usuń</button>` : ''}</header><div class="status-config-group-body ${collapsed ? 'hidden' : ''}"><section class="status-config-direct"><h4>Punkty bezpośrednio w grupie</h4>${columnRows(group, null)}</section><div class="status-config-subgroups">${subgroups}</div></div></article>`;
  }).join('');
  return `<section class="config-panel-body status-matrix-config"><header class="status-config-intro"><div><h3>Układ tabel statusowych</h3><p class="sub">Kolumny podstawowe opisują element, np. typ i nazwę urządzenia. Grupa lub podgrupa może korzystać z układu innej sekcji. Podgrupa bez własnych kolumn automatycznie korzysta z układu grupy nadrzędnej.</p></div>${layoutActions}</header>${groupCards || '<div class="empty">Nie skonfigurowano jeszcze tabel statusowych.</div>'}</section>`;
}

function statusLayoutTreeHtml(groups) {
  const branches = groups.map((group, groupIndex) => {
    const groupName = group.name || `Grupa ${groupIndex + 1}`;
    const children = (group.subgroups || []).map((subgroup, subgroupIndex) => `<label class="ui-tree-node ui-tree-child"><input type="checkbox" value="subgroup:${groupIndex}:${subgroupIndex}" data-ui-tree-value data-ui-tree-child checked><span><b>${escapeHtml(subgroup.name || `Podgrupa ${subgroupIndex + 1}`)}</b><small>Podgrupa · razem z „${escapeHtml(groupName)}”</small></span></label>`).join('');
    return `<section class="ui-tree-branch" data-ui-tree-branch><label class="ui-tree-node ui-tree-group"><input type="checkbox" value="group:${groupIndex}" data-ui-tree-value data-ui-tree-group checked><span><b>${escapeHtml(groupName)}</b><small data-ui-tree-summary>${children ? `${group.subgroups.length} podgrupy` : 'Bez podgrup'}</small></span></label>${children ? `<div class="ui-tree-children">${children}</div>` : ''}</section>`;
  }).join('');
  return `<div class="ui-tree-select" data-ui-tree="layout_scopes" data-status-layout-tree><label class="ui-tree-root"><input type="checkbox" data-ui-tree-all checked><span><b>Cały układ tabel statusowych</b><small>Wszystkie grupy i podgrupy</small></span></label><div class="ui-tree-branches">${branches}</div></div>`;
}

function bindStatusLayoutTree() {
  const tree = $('[data-status-layout-tree]');
  if (!tree) return;
  const all = tree.querySelector('[data-ui-tree-all]');
  const inputs = [...tree.querySelectorAll('[data-ui-tree-value]')];
  const update = () => {
    const selected = inputs.filter(input => input.checked).length;
    all.checked = selected > 0;
    all.indeterminate = selected > 0 && selected < inputs.length;
    tree.querySelectorAll('[data-ui-tree-branch]').forEach(branch => {
      const group = branch.querySelector('[data-ui-tree-group]');
      const children = [...branch.querySelectorAll('[data-ui-tree-child]')];
      const chosen = children.filter(input => input.checked).length;
      const summary = branch.querySelector('[data-ui-tree-summary]');
      branch.classList.toggle('selected', group.checked);
      if (summary && children.length) summary.textContent = chosen ? `${chosen}/${children.length} podgrup w zakresie` : 'Tylko kolumny grupy';
    });
  };
  all.addEventListener('change', () => { inputs.forEach(input => { input.checked = all.checked; }); update(); });
  tree.querySelectorAll('[data-ui-tree-branch]').forEach(branch => {
    const group = branch.querySelector('[data-ui-tree-group]');
    const children = [...branch.querySelectorAll('[data-ui-tree-child]')];
    group.addEventListener('change', () => { if (!group.checked) children.forEach(input => { input.checked = false; }); update(); });
    children.forEach(child => child.addEventListener('change', () => { if (child.checked) group.checked = true; update(); }));
  });
  update();
}

function selectedStatusLayout(groups, selectedScopes) {
  const selected = new Set(selectedScopes || []);
  return groups.map((group, groupIndex) => {
    const groupSelected = selected.has(`group:${groupIndex}`);
    const subgroups = (group.subgroups || []).filter((subgroup, subgroupIndex) => selected.has(`subgroup:${groupIndex}:${subgroupIndex}`));
    const includeGroup = groupSelected || subgroups.length;
    return includeGroup ? { ...group, columns: group.columns || [], subgroups } : null;
  }).filter(Boolean);
}

async function chooseStatusLayout(groups, mode) {
  if (!groups.length) return toast('Brak grup statusowych do wybrania', true), null;
  const formPromise = uiForm({
    title: mode === 'export' ? 'Wybierz zakres eksportu' : 'Wybierz zakres importu',
    description: 'Wybierz gałęzie układu od góry do dołu. Podgrupa zawsze dołącza swoją grupę nadrzędną.',
    submitLabel: mode === 'export' ? 'Eksportuj wybrane' : 'Importuj wybrane',
    fields: [{ type: 'html', html: statusLayoutTreeHtml(groups), full: true }]
  });
  bindStatusLayoutTree();
  const result = await formPromise;
  if (!result) return null;
  const selected = selectedStatusLayout(groups, result.layout_scopes || []);
  if (!selected.length) { toast('Wybierz co najmniej jedną grupę lub podgrupę', true); return null; }
  return selected;
}

function statusLayoutPayload(groups = statusGroups()) {
  const column = item => ({ name: item.name, description: item.description || '', column_role: statusColumnRole(item), field_type: item.field_type, include_in_progress: Number(item.include_in_progress || 0) });
  return {
    format: 'plc-status-layout', version: 1, exported_at: new Date().toISOString(),
    groups: groups.map(group => ({
      name: group.name, description: group.description || '', columns: (group.columns || []).map(column),
      subgroups: (group.subgroups || []).map(subgroup => ({ name: subgroup.name, description: subgroup.description || '', columns: (subgroup.columns || []).map(column) }))
    }))
  };
}

async function exportStatusLayout() {
  const groups = await chooseStatusLayout(statusGroups(), 'export');
  if (!groups) return;
  const code = state.me.current_project?.code || 'projekt';
  downloadBlob(new Blob([JSON.stringify(statusLayoutPayload(groups), null, 2)], { type: 'application/json' }), `${code}-uklad-statusu.json`);
  toast(`Wyeksportowano wybrany układ · ${groups.length} grup`);
}

async function importStatusLayoutFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const layout = JSON.parse(await file.text());
    if (!layout || layout.format !== 'plc-status-layout' || !Array.isArray(layout.groups)) throw new Error('Plik nie zawiera prawidłowego układu tabel statusowych');
    const groups = await chooseStatusLayout(layout.groups, 'import');
    if (!groups) return;
    const result = await api('/api/status-layout/import', { method: 'POST', body: JSON.stringify({ ...layout, groups }) });
    toast(`Zaimportowano: ${result.groups} grup, ${result.subgroups} podgrup i ${result.columns} kolumn`);
    await loadData(true);
  } catch (error) { toast(error instanceof SyntaxError ? 'Plik nie zawiera poprawnego JSON' : error.message, true); }
  finally { event.target.value = ''; }
}

function parseStatusLayoutText(source) {
  const groups = []; const errors = []; let currentGroup = null;
  const groupNames = new Set(); const columnNames = new Map();
  String(source || '').replace(/\r\n?/g, '\n').split('\n').forEach((rawLine, index) => {
    const lineNumber = index + 1;
    if (!rawLine.trim()) return;
    const leadingTabs = rawLine.match(/^\t*/)?.[0].length || 0;
    if (/^ +\S/.test(rawLine) || /^\t+ +\S/.test(rawLine)) {
      errors.push(`Wiersz ${lineNumber}: do definiowania poziomu użyj tabulatorów, nie spacji.`); return;
    }
    if (leadingTabs > 2) { errors.push(`Wiersz ${lineNumber}: dozwolone są maksymalnie dwa tabulatory na początku.`); return; }
    const content = rawLine.slice(leadingTabs);
    if (leadingTabs === 0) {
      if (content.includes('\t')) { errors.push(`Wiersz ${lineNumber}: nazwa grupy nie może zawierać dodatkowych pól.`); return; }
      const name = content.trim(); const normalized = name.toLocaleLowerCase('pl');
      if (!name) { errors.push(`Wiersz ${lineNumber}: podaj nazwę grupy.`); return; }
      if (groupNames.has(normalized)) { errors.push(`Wiersz ${lineNumber}: grupa „${name}” występuje w imporcie więcej niż raz.`); return; }
      groupNames.add(normalized); columnNames.set(normalized, new Set());
      currentGroup = { name, description: '', columns: [], subgroups: [] };
      groups.push(currentGroup); return;
    }
    if (!currentGroup) { errors.push(`Wiersz ${lineNumber}: najpierw podaj grupę bez tabulatora.`); return; }
    const usedNames = columnNames.get(currentGroup.name.toLocaleLowerCase('pl'));
    if (leadingTabs === 1) {
      if (content.includes('\t')) { errors.push(`Wiersz ${lineNumber}: kolumna podstawowa powinna zawierać tylko nazwę.`); return; }
      const name = content.trim(); const normalized = name.toLocaleLowerCase('pl');
      if (!name) { errors.push(`Wiersz ${lineNumber}: podaj nazwę kolumny podstawowej.`); return; }
      if (usedNames.has(normalized)) { errors.push(`Wiersz ${lineNumber}: element „${name}” jest już zdefiniowany w grupie „${currentGroup.name}”.`); return; }
      usedNames.add(normalized);
      currentGroup.columns.push({ name, description: '', column_role: 'basic', field_type: 'text', include_in_progress: 0 });
      return;
    }
    const fields = content.split('\t');
    if (fields.length < 3) { errors.push(`Wiersz ${lineNumber}: podpunkt wymaga nazwy, opisu oraz wartości TAK albo NIE, rozdzielonych tabulatorami.`); return; }
    const name = fields.shift().trim(); const progressFlag = fields.pop().trim().toLocaleUpperCase('pl'); const description = fields.join(' ').trim();
    const normalized = name.toLocaleLowerCase('pl');
    if (!name) { errors.push(`Wiersz ${lineNumber}: podaj nazwę podpunktu statusowego.`); return; }
    if (!['TAK', 'NIE'].includes(progressFlag)) { errors.push(`Wiersz ${lineNumber}: ostatnie pole musi mieć wartość TAK albo NIE.`); return; }
    if (usedNames.has(normalized)) { errors.push(`Wiersz ${lineNumber}: element „${name}” jest już zdefiniowany w grupie „${currentGroup.name}”.`); return; }
    usedNames.add(normalized);
    currentGroup.columns.push({ name, description, column_role: 'subpoint', field_type: 'status', include_in_progress: progressFlag === 'TAK' ? 1 : 0 });
  });
  if (!groups.length && !errors.length) errors.push('Wklej co najmniej jedną grupę wraz z jej kolumnami.');
  groups.forEach(group => { if (!group.columns.length) errors.push(`Grupa „${group.name}” nie zawiera żadnych kolumn ani podpunktów.`); });
  return { groups, errors, layout: { format: 'plc-status-layout', version: 1, exported_at: new Date().toISOString(), groups } };
}

function statusLayoutTextPreview(parsed) {
  if (parsed.errors.length) return `<div class="status-text-import-preview invalid"><strong>Popraw format przed importem</strong><ul>${parsed.errors.map(error => `<li>${escapeHtml(error)}</li>`).join('')}</ul></div>`;
  const columns = parsed.groups.reduce((sum, group) => sum + group.columns.length, 0);
  return `<div class="status-text-import-preview valid"><strong>Gotowe do importu · ${parsed.groups.length} ${parsed.groups.length === 1 ? 'grupa' : 'grupy'}, ${columns} kolumn i podpunktów</strong><div>${parsed.groups.map(group => `<span><b>${escapeHtml(group.name)}</b><small>${group.columns.length} elementów</small></span>`).join('')}</div></div>`;
}

async function importStatusLayoutText() {
  const example = "Hardware\n\tDevice Type\n\tDevice Name\n\t\t+24V\tCzy urządzenie jest zasilone +24V?\tNIE\n\t\tGreen\tCzy urządzenie jest w pełni skonfigurowane?\tTAK";
  const formPromise = uiForm({
    title: 'Import konfiguracji statusu z tekstu',
    description: 'Każda grupa zaczyna się bez tabulatora. Jeden tabulator oznacza kolumnę podstawową, a dwa — podpunkt statusowy z opisem i flagą TAK/NIE.',
    submitLabel: 'Importuj konfigurację',
    fields: [
      { name: 'layout_text', label: 'Konfiguracja do importu', type: 'textarea', rows: 15, full: true, hint: 'Istniejące grupy i kolumny o tych samych nazwach zostaną zaktualizowane; pozostałe elementy nie zostaną usunięte.' },
      { type: 'html', full: true, html: `<details class="status-text-import-example"><summary>Pokaż przykład formatu</summary><pre>${escapeHtml(example)}</pre></details><div id="status-text-import-preview"></div>` }
    ]
  });
  const textarea = $('#action-fields [name="layout_text"]'); const preview = $('#status-text-import-preview'); const submit = $('#action-submit');
  const updatePreview = () => {
    const parsed = parseStatusLayoutText(textarea.value);
    preview.innerHTML = statusLayoutTextPreview(parsed);
    submit.disabled = parsed.errors.length > 0;
  };
  textarea.addEventListener('input', updatePreview); updatePreview();
  const result = await formPromise;
  if (!result) return;
  const parsed = parseStatusLayoutText(result.layout_text);
  if (parsed.errors.length) { toast(parsed.errors[0], true); return; }
  try {
    const imported = await api('/api/status-layout/import', { method: 'POST', body: JSON.stringify(parsed.layout) });
    toast(`Zaimportowano: ${imported.groups} grup i ${imported.columns} kolumn`);
    await loadData(true);
  } catch (error) { toast(error.message, true); }
}

function controllerHierarchyConfig(admin) {
  const children = parentId => state.controllerGroups.filter(group => Number(group.parent_id || 0) === Number(parentId || 0));
  if (!state.hierarchySelection || ![...state.controllerGroups.map(item => `group:${item.id}`), ...state.controllers.map(item => `controller:${item.id}`)].includes(state.hierarchySelection)) state.hierarchySelection = state.controllerGroups[0] ? `group:${state.controllerGroups[0].id}` : state.controllers[0] ? `controller:${state.controllers[0].id}` : null;
  const rows = [];
  const walk = (parentId, depth) => {
    const siblings = children(parentId);
    siblings.forEach((group, index) => {
      rows.push(`<div class="hierarchy-tree-row ${state.hierarchySelection === `group:${group.id}` ? 'selected' : ''}" style="--depth:${depth}">${admin ? orderControls('controller_groups', siblings, index) : ''}<button type="button" class="select-hierarchy-node" data-node="group:${group.id}"><b>▰ ${escapeHtml(group.name)}</b><small>${escapeHtml(group.path_label || group.name)}</small></button><span class="node-count">${state.controllers.filter(item => Number(item.group_id) === group.id).length}</span></div>`);
      const groupControllers = state.controllers.filter(item => Number(item.group_id || 0) === group.id);
      groupControllers.forEach((controller, controllerIndex) => rows.push(`<div class="hierarchy-tree-row controller-leaf ${state.hierarchySelection === `controller:${controller.id}` ? 'selected' : ''}" style="--depth:${depth + 1}">${admin ? orderControls('controllers', groupControllers, controllerIndex) : ''}<button type="button" class="select-hierarchy-node" data-node="controller:${controller.id}"><b>◇ ${escapeHtml(controller.leaf_code || controller.display_name)}</b><small>${escapeHtml(controller.display_name || controller.hierarchy_label || '')}</small></button></div>`));
      walk(group.id, depth + 1);
    });
  };
  walk(null, 0);
  const ungroupedControllers = state.controllers.filter(item => !item.group_id);
  ungroupedControllers.forEach((controller, index) => rows.push(`<div class="hierarchy-tree-row controller-leaf ${state.hierarchySelection === `controller:${controller.id}` ? 'selected' : ''}" style="--depth:0">${admin ? orderControls('controllers', ungroupedControllers, index) : ''}<button type="button" class="select-hierarchy-node" data-node="controller:${controller.id}"><b>◇ ${escapeHtml(controller.leaf_code || controller.display_name)}</b><small>Bez przypisanego obszaru</small></button></div>`));
  const [kind, rawId] = String(state.hierarchySelection || '').split(':');
  const selected = kind === 'group' ? state.controllerGroups.find(item => item.id === Number(rawId)) : state.controllers.find(item => item.id === Number(rawId));
  const details = !selected ? '<div class="empty">Wybierz element z drzewa lub utwórz pierwszy obszar.</div>' : kind === 'group'
    ? `<div class="hierarchy-detail-head"><span class="hierarchy-symbol">▰</span><div><small>${selected.parent_id ? 'Podobszar' : 'Obszar główny'}</small><h3>${escapeHtml(selected.name)}</h3><p>${escapeHtml(selected.path_label || selected.name)}</p></div></div><p>${escapeHtml(selected.description || 'Brak dodatkowego opisu.')}</p><dl class="hierarchy-facts"><div><dt>Poziom</dt><dd>${selected.depth}</dd></div><div><dt>Podobszary</dt><dd>${children(selected.id).length}</dd></div><div><dt>Sterowniki bezpośrednie</dt><dd>${state.controllers.filter(item => Number(item.group_id) === selected.id).length}</dd></div></dl>${admin ? `<div class="hierarchy-actions">${Number(selected.depth) < 2 ? `<button class="secondary add-child-group" data-id="${selected.id}">+ Dodaj podobszar</button>` : ''}<button class="secondary" id="new-controller-selected" data-group="${selected.id}">+ Dodaj sterownik</button><button class="mini edit-controller-group" data-id="${selected.id}" data-parent="${selected.parent_id || ''}" data-name="${escapeHtml(selected.name)}">Edytuj obszar</button><button class="mini danger-outline delete-controller-group" data-id="${selected.id}">Usuń obszar</button></div>` : ''}`
    : `<div class="hierarchy-detail-head"><span class="hierarchy-symbol controller">◇</span><div><small>Sterownik końcowy</small><h3>${escapeHtml(selected.display_name || selected.leaf_code)}</h3><p>${escapeHtml(selected.hierarchy_label || 'Bez obszaru')}</p></div></div><p>${escapeHtml(selected.description || 'Brak dodatkowego opisu.')}</p><dl class="hierarchy-facts"><div><dt>Kod lokalny</dt><dd>${escapeHtml(selected.leaf_code)}</dd></div><div><dt>Obszar</dt><dd>${escapeHtml(selected.area || '—')}</dd></div></dl>${admin ? `<div class="hierarchy-actions"><button class="primary edit-controller" data-id="${selected.id}">Edytuj sterownik</button></div>` : ''}`;
  return `<div class="hierarchy-editor"><aside><div class="hierarchy-tree-toolbar"><strong>Struktura projektu</strong>${admin ? '<button class="mini" id="new-root-group">+ Obszar</button>' : ''}</div><div class="config-tree compact-tree">${rows.join('') || '<div class="empty compact-empty">Brak hierarchii sterowników.</div>'}</div>${admin ? '<button class="secondary full-width" id="new-controller">+ Sterownik bez obszaru</button>' : ''}</aside><section class="hierarchy-detail">${details}</section></div>`;
}

function renderSettings() {
  const admin = ['system_admin', 'project_admin'].includes(state.me.role);
  const systemAdmin = state.me.role === 'system_admin';
  const globalLaunchers = [
    ...(systemAdmin ? [['projects', 'Projekty systemu', 'Globalne projekty, dostęp i bezpieczne usuwanie', state.projects.length, '▦'], ['global_users', 'Konta użytkowników', 'Konta globalne, aktywacja, role systemowe i hasła', state.users.length, '♙'], ['security', 'Dziennik bezpieczeństwa', 'Logowania, MFA, hasła i zmiany dostępów', '', '⌾']] : []),
    ['planner_global', 'Globalne ustawienia czasu pracy', 'Święta, normy godzin i mnożniki nadgodzin', (state.planner?.holidays || []).length, '◷']
  ];
  const projectLaunchers = [
    ...(admin ? [['hierarchy', 'Hierarchia obszarów / sterowników', 'Projekt → obszar → podobszar → sterownik', state.controllerGroups.length + state.controllers.length, '⌘']] : []),
    ['status_matrix', 'Tabele i pola statusu', 'Grupy, podgrupy oraz niezależne kolumny statusowe i tekstowe', statusGroups().length, '▦'],
    ['function_groups', 'Obiekty funkcyjne', 'Stacje, roboty i elementy używane również w zadaniach', state.config.function_groups.length, '⚙'],
    ['ops_automations', 'Reguły automatyzacji', 'Powiadomienia i eskalacje według terminów oraz blokad', state.operations?.automation_rules?.length || 0, '⌁'],
    ['status_categories', 'Konfigurator otwartych punktów', 'Kategorie, podkategorie oraz reguły „Oczekiwanie na”', state.config.categories.length + state.config.options.filter(item => item.kind === 'waiting_for').length, '▤'],
    ['task_categories', 'Kategorie zadań', 'Niezależny słownik dla modułu Zadania', state.config.task_categories.length, '✓'],
    ...(admin ? [['users', 'Użytkownicy projektu', 'Dostęp, rola projektowa, Planner i listy wyboru', state.users.length, '♙']] : []),
    ['announcements', 'Informator', 'Etykiety oraz poziomy ważności wiadomości', (state.config.announcement_labels || []).length, '◆'],
    ['planner', 'Planner · ustawienia projektu', 'Auta transportowe używane w bieżącym projekcie', (state.config.planner_vehicles || []).length, '▥'],
    ['dictionaries', 'Słowniki projektu', 'Cele odpraw, zmiany i typy notatek', state.config.options.filter(item => item.kind !== 'waiting_for').length, '≡'],
    ['completion_requirements', 'Zapotrzebowanie', 'Lista zapotrzebowania wybierana w Statusie, Zadaniach i Otwartych punktach', (state.config.requirements || []).length, '◇'],
    ['reminders', 'Przypomnienia', 'Domyślne terminy i okno ostrzegawcze', 2, '◷'],
    ...(admin ? [['backup', 'Backup projektu', 'Pobieranie i odtwarzanie kompletnego projektu', '', '⇄'], ['exports', 'Szablony eksportu', 'Predefiniowane raporty statusu do Excel', (state.config.export_templates || []).length, '↗']] : [])
  ];
  const launcherHtml = (items, scope) => `<div class="settings-launchers">${items.map(([key, title, description, count, icon]) => `<button type="button" class="settings-launcher" data-config-panel="${key}" data-config-scope="${scope}"><span class="settings-launcher-icon">${icon}</span><span><b>${escapeHtml(title)}</b><small>${escapeHtml(description)}</small></span>${count !== '' ? `<em>${count}</em>` : ''}<i>→</i></button>`).join('')}</div>`;
  $('#content').innerHTML = `<section class="settings-home"><header><div><span class="eyebrow">Konfigurator</span><h2>Konfiguracja systemu i projektu</h2><p>Ustawienia są rozdzielone według zakresu działania. Oznaczenie zakresu pozostaje widoczne także w otwartym panelu.</p></div><span class="settings-role">${escapeHtml(roleName(state.me.role))}</span></header>${globalLaunchers.length ? `<section class="settings-scope global"><header><span class="config-scope-badge global">GLOBALNE</span><div><h3>Konfiguracja globalna</h3><p>Dotyczy całego systemu i wszystkich projektów.</p></div></header>${launcherHtml(globalLaunchers, 'global')}</section>` : ''}<section class="settings-scope project"><header><span class="config-scope-badge project">PROJEKT</span><div><h3>Konfiguracja projektu</h3><p>Dotyczy wyłącznie projektu ${escapeHtml(state.me.current_project?.code || '')}.</p></div></header>${launcherHtml(projectLaunchers, 'project')}</section></section>`;
  $$('[data-config-panel]').forEach(button => button.addEventListener('click', async () => {
    if (button.dataset.configPanel === 'ops_automations') {
      state.operationsTab = 'automations'; await setView('operations'); return;
    }
    if (button.dataset.configPanel === 'security') state.securityEvents = await api('/api/security/events?limit=200');
    openConfigPanel(button.dataset.configPanel);
  }));
  if ($('#config-full-dialog').open && state.configPanel) refreshConfigPanel();
}

function configPanelDefinition(key) {
  const admin = ['system_admin', 'project_admin'].includes(state.me.role);
  const canEdit = ['system_admin', 'project_admin', 'moderator'].includes(state.me.role);
  const systemAdmin = state.me.role === 'system_admin';
  const dictionaries = [['shift', 'Zmiany'], ['note_type', 'Typy notatek'], ['meeting_goal', 'Cele elementów odprawy']].map(([kind, label]) => {
    const items = state.config.options.filter(item => item.kind === kind);
    return `<section class="config-subsection"><h3>${label}</h3>${items.map((item, index) => `<div class="settings-row dictionary-row" title="${escapeHtml(item.description || '')}">${orderControls('options', items, index)}<span><b>${escapeHtml(item.value)}</b><small class="sub">${escapeHtml(item.description || 'Bez opisu')}</small></span><button class="mini edit-option" data-id="${item.id}" data-kind="${kind}" data-value="${escapeHtml(item.value)}" data-description="${escapeHtml(item.description || '')}">Edytuj</button>${admin ? `<button class="mini delete-config" data-kind="option" data-id="${item.id}">Usuń</button>` : ''}</div>`).join('')}<form class="inline-form add-option dictionary-add" data-kind="${kind}"><input name="value" placeholder="Nowa wartość" required><input name="description" placeholder="Opis widoczny po najechaniu"><button class="mini">Dodaj</button></form></section>`;
  }).join('');
  const workflowStates = state.config.status_workflow_states || fallbackStatusWorkflowStates;
  const statusStateConfig = `<section class="config-subsection status-state-config"><header><span><h3>Stany punktów statusowych</h3><small class="sub">Stany systemowe korzystają ze spójnego zestawu profesjonalnych ikon. Dla własnych stanów można wybrać symbol.</small></span><button type="button" class="secondary" id="new-status-state">+ Dodaj stan</button></header>${workflowStates.map((item, index) => `<div class="settings-row">${orderControls('status_workflow_states', workflowStates, index)}<span title="${escapeHtml(item.description || '')}"><b>${escapeHtml(item.label)}</b><small class="sub">${escapeHtml(item.description || 'Bez opisu')} · ${item.included ? 'widoczny na listach' : 'wyłączony'}${item.counts_as_done ? ' · zamyka punkt' : ''}</small></span><span class="dictionary-legend">${statusSymbol(item.value)}</span><button type="button" class="mini edit-status-state" data-id="${item.id}">Edytuj</button>${admin && !item.system_key ? `<button type="button" class="mini danger-text delete-status-state" data-id="${item.id}">Usuń</button>` : ''}</div>`).join('')}</section>`;
  const waitingForItems = state.config.options.filter(item => item.kind === 'waiting_for');
  const waitingForConfig = `<section class="config-subsection waiting-for-config"><header><span><h3>Oczekiwanie na</h3><small class="sub">Włącz automatyczne utworzenie zależności zewnętrznej dla punktów oczekujących na wybrany dział.</small></span></header>${waitingForItems.map((item, index) => `<div class="settings-row dictionary-row" title="${escapeHtml(item.description || '')}">${orderControls('options', waitingForItems, index)}<span><b>${escapeHtml(item.value)}</b><small class="sub">${escapeHtml(item.description || 'Bez opisu')}</small></span><span class="dependency-rule ${Number(item.external_dependency_enabled) ? 'enabled' : ''}">${Number(item.external_dependency_enabled) ? 'Zależność zewnętrzna ✓' : 'Bez zależności'}</span><button class="mini edit-option" data-id="${item.id}" data-kind="waiting_for" data-value="${escapeHtml(item.value)}" data-description="${escapeHtml(item.description || '')}" data-external-enabled="${Number(item.external_dependency_enabled) ? 1 : 0}">Edytuj</button>${admin ? `<button class="mini delete-config" data-kind="option" data-id="${item.id}">Usuń</button>` : ''}</div>`).join('') || '<div class="empty compact-empty">Nie zdefiniowano jeszcze żadnego działu.</div>'}<form class="inline-form add-option dictionary-add waiting-for-add" data-kind="waiting_for"><input name="value" placeholder="Nowy dział / strona" required><input name="description" placeholder="Opis widoczny po najechaniu"><label class="checkline"><input type="checkbox" name="external_dependency_enabled" value="1"><span>Pokazuj w Zależnościach zewnętrznych</span></label><button class="mini">Dodaj</button></form></section>`;
  const users = `<form id="project-users-form" class="project-users-editor"><header><div><span class="config-scope-badge project">PROJEKT</span><h3>Uczestnicy projektu ${escapeHtml(state.me.current_project?.code || '')}</h3><p class="sub">Zaznacz wszystkie potrzebne ustawienia, a następnie zapisz je jedną decyzją.</p></div><button type="submit" class="primary" id="save-project-users" disabled>Zapisz zmiany</button></header><div class="project-users-table-wrap"><table class="project-users-table"><thead><tr><th>Użytkownik</th><th>Dostęp</th><th>Rola w projekcie</th><th>Planner</th><th>Listy wyboru</th><th>Zależności</th></tr></thead><tbody>${state.users.map(item => {
    const protectedRow = item.system_role === 'system_admin' || (!systemAdmin && item.project_role === 'project_admin');
    const disabled = protectedRow ? 'disabled' : '';
    return `<tr data-project-user="${item.id}" class="${item.project_active ? '' : 'inactive'} ${protectedRow ? 'protected' : ''}"><td><b>${escapeHtml(item.display_name)}</b><small>${escapeHtml(item.username)}</small>${item.system_role === 'system_admin' ? '<span class="user-system-mark">Administrator systemu</span>' : ''}</td><td><label class="table-check" title="Dostęp do bieżącego projektu"><input type="checkbox" name="project_active" ${item.project_active ? 'checked' : ''} ${disabled}><span>✓</span></label></td><td><select name="project_role" aria-label="Rola w projekcie" ${disabled}><option value="user"${item.project_role === 'user' ? ' selected' : ''}>Użytkownik</option><option value="moderator"${item.project_role === 'moderator' ? ' selected' : ''}>Manager projektu</option>${systemAdmin ? `<option value="project_admin"${item.project_role === 'project_admin' ? ' selected' : ''}>Lider projektu</option>` : ''}</select></td><td><label class="table-check" title="Uwzględniaj w Plannerze"><input type="checkbox" name="planner_enabled" ${item.planner_enabled ? 'checked' : ''} ${disabled}><span>✓</span></label></td><td><label class="table-check" title="Widoczny na listach wyboru"><input type="checkbox" name="assignable" ${Number(item.assignable) !== 0 ? 'checked' : ''} ${disabled}><span>✓</span></label></td><td><label class="table-check" title="Może modyfikować zależności zewnętrzne"><input type="checkbox" name="can_manage_external_dependencies" ${Number(item.can_manage_external_dependencies) !== 0 ? 'checked' : ''} ${disabled}><span>✓</span></label></td></tr>`;
  }).join('')}</tbody></table></div><footer><span id="project-users-change-count">Brak niezapisanych zmian</span><button type="submit" class="primary" disabled>Zapisz zmiany</button></footer></form>`;
  const globalUsers = `<section class="config-panel-body global-users-panel"><header class="config-section-actions"><span><span class="config-scope-badge global">GLOBALNE</span><h3>Konta użytkowników systemu</h3><small class="sub">Dane konta są pokazane tylko tutaj. Dostęp projektowy jest konfigurowany oddzielnie w panelu projektu.</small></span><button class="secondary" id="new-user">+ Dodaj konto</button></header><div class="global-users-table"><div class="global-users-head"><span>Użytkownik</span><span>Rola systemowa</span><span>Stan konta</span><span>Operacje</span></div>${state.users.map(item => `<div class="global-user-row"><span><b>${escapeHtml(item.display_name)}</b><small>${escapeHtml(item.username)}</small></span><span><span class="account-role ${item.system_role === 'system_admin' ? 'admin' : ''}">${item.system_role === 'system_admin' ? 'Administrator systemu' : 'Konto projektowe'}</span></span><span><span class="account-state ${item.active ? 'active' : ''}">${item.active ? 'Aktywne' : 'Nieaktywne'}</span></span><span><button class="mini reset-user-password" data-id="${item.id}" data-name="${escapeHtml(item.display_name)}">Resetuj hasło</button><button class="mini edit-global-user" data-id="${item.id}">Edytuj konto</button></span></div>`).join('')}</div></section>`;
  const importanceItems = state.config.options.filter(item => item.kind === 'announcement_importance');
  const announcementConfig = `<section class="config-panel-body config-two-columns"><section class="config-subsection"><h3>Etykiety wiadomości</h3>${(state.config.announcement_labels || []).map((item, index, items) => `<div class="settings-row">${orderControls('announcement_labels', items, index)}<span><span class="announcement-label ${escapeHtml(item.color)}">${escapeHtml(item.name)}</span></span><button class="mini edit-announcement-label" data-id="${item.id}">Edytuj</button>${admin ? `<button class="mini delete-announcement-label" data-id="${item.id}">Usuń</button>` : ''}</div>`).join('')}<button class="secondary" id="new-announcement-label">+ Dodaj etykietę</button></section><section class="config-subsection"><h3>Poziomy ważności</h3>${importanceItems.map((item, index) => `<div class="settings-row dictionary-row" title="${escapeHtml(item.description || '')}">${orderControls('options', importanceItems, index)}<span><b>${escapeHtml(item.value)}</b><small class="sub">${escapeHtml(item.description || 'Bez opisu')}</small></span><button class="mini edit-option" data-id="${item.id}" data-kind="announcement_importance" data-value="${escapeHtml(item.value)}" data-description="${escapeHtml(item.description || '')}">Edytuj</button>${admin ? `<button class="mini delete-config" data-kind="option" data-id="${item.id}">Usuń</button>` : ''}</div>`).join('')}<form class="inline-form add-option dictionary-add" data-kind="announcement_importance"><input name="value" placeholder="Nowy poziom" required><input name="description" placeholder="Opis"><button class="mini">Dodaj</button></form></section></section>`;
  const plannerSettingFields = [
    ['planner_online_hours', 'Standard godzin ON', '10.5'], ['planner_offline_hours', 'Standard godzin OFF', '8'], ['planner_base_hours', 'Norma dnia roboczego', '8'],
    ['planner_weekday_multiplier', 'Mnożnik nadgodzin w dzień roboczy', '1.5'], ['planner_saturday_multiplier', 'Mnożnik sobotni', '1.5'], ['planner_sunday_holiday_multiplier', 'Mnożnik niedziela / święto', '2'], ['planner_time_off_debit', 'Odjęcie za wolne z nadgodzin', '8']
  ];
  const plannerVehiclesConfig = `<section class="config-subsection"><header><span><span class="config-scope-badge project">PROJEKT</span><h3>Auta transportowe</h3><small class="sub">Kod T oznacza transport bez wskazanego auta. Zdefiniowane auta są pokazywane jako T1, T2 itd.</small></span><button type="button" class="secondary" id="new-planner-vehicle">+ Dodaj auto</button></header><div class="planner-vehicle-list">${(state.config.planner_vehicles || []).map(vehicle => `<div class="settings-row"><span><b>${escapeHtml(vehicle.code)}</b><small class="sub">${escapeHtml(vehicle.registration_number)}</small></span><button type="button" class="mini edit-planner-vehicle" data-id="${vehicle.id}">Edytuj</button><button type="button" class="mini danger-outline delete-planner-vehicle" data-id="${vehicle.id}">Usuń</button></div>`).join('') || '<div class="empty compact-empty">Brak zdefiniowanych aut. Transport będzie oznaczany jako T.</div>'}</div></section>`;
  const plannerConfig = `<section class="config-panel-body planner-config-grid">${plannerVehiclesConfig}</section>`;
  const plannerGlobalConfig = `<section class="config-panel-body planner-config-grid"><section class="config-subsection"><span class="config-scope-badge global">GLOBALNE</span><h3>Normy czasu pracy</h3><p class="sub">Jedna konfiguracja obowiązuje we wszystkich projektach.</p><div class="planner-setting-grid">${plannerSettingFields.map(([key, label, fallback]) => `<label class="field"><span>${label}</span><input class="planner-setting" data-key="${key}" type="number" min="0" step="0.25" value="${escapeHtml(state.config.settings[key] || fallback)}"></label>`).join('')}</div></section><section class="config-subsection"><span class="config-scope-badge global">GLOBALNE</span><h3>Święta systemowe</h3><p class="sub">Ta lista jest wspólna dla wszystkich projektów.</p><div class="holiday-list-config">${(state.config.planner_holidays || []).map(item => `<div class="settings-row"><span><b>${displayDate(item.holiday_date)}</b> · ${escapeHtml(item.name)}</span><button class="mini edit-planner-holiday" data-id="${item.id}">Edytuj</button><button class="mini delete-planner-holiday" data-id="${item.id}">Usuń</button></div>`).join('') || '<div class="empty compact-empty">Brak zdefiniowanych świąt.</div>'}</div><label class="field"><span>Szybkie dodawanie — DD.MM.RRRR Nazwa święta</span><textarea id="planner-holidays-bulk" rows="7" placeholder="25.12.2026 Boże Narodzenie\n26.12.2026 Drugi dzień świąt"></textarea></label><button class="secondary" id="planner-holidays-bulk-save">Dodaj listę świąt</button></section></section>`;
  const definitions = {
    projects: ['Projekty systemu', `<section class="config-panel-body"><p class="sub">Konta są globalne, a role i dostęp są niezależne dla każdego projektu. Kolor i skrót rozróżniają projekty w Plannerze.</p>${state.projects.map(item => `<div class="settings-row project-settings-row" style="${projectColorStyle(item.planner_color)}"><i class="project-color-swatch" aria-hidden="true"></i><span><b>${escapeHtml(item.code)} · ${escapeHtml(item.planner_short_code || String(item.code).slice(0, 6))}</b><small class="sub">${escapeHtml(item.description || '')}</small></span><button class="mini edit-project" data-id="${item.id}">Edytuj</button><button class="mini danger-outline delete-project" data-id="${item.id}" ${state.projects.length <= 1 ? 'disabled title="Nie można usunąć ostatniego projektu"' : ''}>Usuń</button></div>`).join('')}<button class="secondary" id="new-project">+ Dodaj projekt</button></section>`],
    security: ['Dziennik bezpieczeństwa', `<section class="config-panel-body"><p class="sub">Ostatnie zdarzenia uwierzytelniania i zmian dostępu. Rejestr jest przechowywany przez 180 dni.</p>${(state.securityEvents || []).map(item => `<div class="settings-row security-event ${escapeHtml(item.outcome)}"><span><b>${escapeHtml(item.event_type)}</b><small class="sub">${escapeHtml(item.username || 'nieznane konto')} · ${escapeHtml(item.ip_address || 'brak adresu')} · ${displayDateTime(item.created_at)}</small></span><em>${escapeHtml(item.outcome)}</em></div>`).join('') || '<div class="empty compact-empty">Brak zarejestrowanych zdarzeń.</div>'}</section>`],
    hierarchy: ['Hierarchia obszarów / sterowników', `<section class="config-panel-body"><p class="sub">Projekt → obszar → podobszar → sterownik. Wybierz element po lewej, a jego działania pojawią się po prawej.</p>${controllerHierarchyConfig(admin)}</section>`],
    status_matrix: ['Tabele i pola statusu', statusMatrixConfig(canEdit)],
    status_states: ['Stany punktów statusowych', `<section class="config-panel-body"><button type="button" class="mini config-back" id="status-states-back">← Tabele i pola statusu</button>${statusStateConfig}</section>`],
    function_groups: ['Grupy funkcyjne i punkty statusu', functionGroupConfig(canEdit)],
    status_categories: ['Konfigurator otwartych punktów', `<section class="config-panel-body"><header class="config-section-actions"><span><h3>Kategorie i podkategorie</h3><small class="sub">Struktura klasyfikacji używana w module Otwartych punktów.</small></span><button type="button" class="secondary" id="waiting-for-open">Oczekiwanie na</button></header>${categoryConfig('status', state.config.categories, admin, canEdit)}</section>`],
    waiting_for: ['Oczekiwanie na', `<section class="config-panel-body"><button type="button" class="mini config-back" id="waiting-for-back">← Konfigurator otwartych punktów</button>${waitingForConfig}</section>`],
    task_categories: ['Kategorie zadań', `<section class="config-panel-body">${categoryConfig('task', state.config.task_categories, admin, canEdit)}</section>`],
    users: ['Użytkownicy projektu', `<section class="config-panel-body">${users}</section>`],
    global_users: ['Konta użytkowników', globalUsers],
    announcements: ['Informator · etykiety i ważność', announcementConfig],
    planner: ['Planner · konfiguracja', plannerConfig],
    planner_global: ['Globalne ustawienia czasu pracy', plannerGlobalConfig],
    dictionaries: ['Słowniki projektu', `<section class="config-panel-body config-dictionaries">${dictionaries}</section>`],
    completion_requirements: ['Zapotrzebowanie', `<section class="config-panel-body"><p class="sub">Ta lista jest dostępna jako wielokrotny wybór w Statusie, Zadaniach i Otwartych punktach.</p>${(state.config.requirements || []).map((item, index, items) => `<div class="settings-row">${canEdit ? orderControls('completion_requirements', items, index) : ''}<span><b>${escapeHtml(item.name)}</b><small class="sub">${escapeHtml(item.description || 'Bez opisu')}</small></span>${canEdit ? `<button class="mini edit-requirement-config" data-id="${item.id}">Edytuj</button>` : ''}${admin ? `<button class="mini delete-requirement-config" data-id="${item.id}">Usuń</button>` : ''}</div>`).join('') || '<div class="empty compact-empty">Nie zdefiniowano jeszcze zapotrzebowania.</div>'}${canEdit ? '<button class="secondary" id="new-requirement-config">+ Dodaj pozycję</button>' : ''}</section>`],
    reminders: ['Ustawienia przypomnień', `<section class="config-panel-body">${admin ? `<p class="sub">Źródło obszarów dla „Mojego podsumowania” każdy użytkownik wybiera indywidualnie w tym module.</p><label class="field"><span>Domyślne przypomnienie po utworzeniu (dni)</span><input id="default-reminder" type="number" min="1" value="${escapeHtml(state.config.settings.default_reminder_days || 14)}"></label><label class="field"><span>Okno „zbliżających się” przypomnień (dni)</span><input id="warning-days" type="number" min="1" value="${escapeHtml(state.config.settings.reminder_warning_days || 7)}"></label>` : '<p class="sub">Tylko administrator może zmieniać ustawienia projektu.</p>'}</section>`],
    backup: ['Backup projektu', `<section class="config-panel-body"><p class="sub">Backup zawiera konfigurację i dane projektu. Nowe pliki są szyfrowane hasłem lokalnie w przeglądarce; hasło nie trafia na serwer.</p><div class="backup-actions"><button class="secondary" id="download-backup">Pobierz zaszyfrowany backup</button><label class="secondary file-button">Wczytaj backup<input id="restore-backup" type="file" accept="application/json,.json,.plcbak"></label></div></section>`],
    exports: ['Szablony eksportu statusu', `<section class="config-panel-body">${(state.config.export_templates || []).map((item, index) => `<div class="settings-row">${orderControls('export_templates', state.config.export_templates, index)}<span><b>${escapeHtml(item.name)}</b><small class="sub">${escapeHtml(item.detail_level)}</small></span><button class="mini edit-export-template" data-id="${item.id}">Edytuj</button><button class="mini delete-export-template" data-id="${item.id}">Usuń</button></div>`).join('') || '<p class="sub">Brak własnych szablonów.</p>'}<button class="secondary" id="new-export-template">+ Nowy szablon</button></section>`]
  };
  return definitions[key] || ['Konfiguracja', '<div class="empty">Nie znaleziono tej grupy ustawień.</div>'];
}

function openConfigPanel(key) {
  state.configPanel = key; state.configScroll = 0;
  refreshConfigPanel();
  if (!$('#config-full-dialog').open) $('#config-full-dialog').showModal();
}

async function editStatusWorkflowState(id = null) {
  const item = (state.config.status_workflow_states || []).find(row => Number(row.id) === Number(id));
  const icons = ['○', '●', '⊘', '↻', '✓', '—', '◎', '◉', '◆', '▲', '!', '?', '★', '⚙'];
  const result = await uiForm({ title: item ? 'Edytuj stan statusu' : 'Dodaj stan statusu', description: item?.system_key ? 'Stan systemowy korzysta z przypisanej profesjonalnej ikony. Możesz zmienić nazwę i opis.' : 'Własny stan będzie dostępny we wszystkich podpunktach statusowych tego projektu.', submitLabel: 'Zapisz stan', fields: [
    { name: 'label', label: 'Nazwa', value: item?.label || '', required: true },
    ...(!item?.system_key ? [{ name: 'icon', label: 'Ikona', type: 'select', value: item?.icon || '○', options: icons.map(icon => ({ value: icon, label: icon })) }] : []),
    { name: 'description', label: 'Opis w legendzie', type: 'textarea', rows: 3, value: item?.description || '', full: true },
    { name: 'included', label: 'Dostępny przy zmianie statusu', type: 'checkbox', value: item ? Number(item.included) !== 0 : true },
    { name: 'counts_as_done', label: 'Uwzględniaj jako ukończony', type: 'checkbox', value: Boolean(item?.counts_as_done) }
  ] });
  if (!result) return;
  if (item?.system_key) result.icon = item.icon;
  try {
    await api(`/api/status-workflow-states${item ? `/${item.id}` : ''}`, { method: item ? 'PATCH' : 'POST', body: JSON.stringify(result) });
    await loadData(true); toast('Stan statusu został zapisany');
  } catch (error) { toast(error.message, true); }
}

function refreshConfigPanel() {
  if (!state.configPanel) return;
  const dialog = $('#config-full-dialog'); const [title, html] = configPanelDefinition(state.configPanel);
  const globalPanels = new Set(['projects', 'global_users', 'planner_global', 'security']);
  const scope = globalPanels.has(state.configPanel) ? 'global' : 'project';
  dialog.dataset.refreshing = '1';
  $('#config-full-title').innerHTML = `<span class="config-scope-badge ${scope}">${scope === 'global' ? 'GLOBALNE' : 'PROJEKT'}</span>${escapeHtml(title)}`;
  $('#config-full-content').innerHTML = html;
  bindSettings();
  requestAnimationFrame(() => { $('#config-full-content').scrollTop = state.configScroll || 0; dialog.dataset.dirty = ''; dialog.dataset.refreshing = ''; });
}

function bindProjectUsersEditor() {
  const form = $('#project-users-form');
  if (!form) return;
  const rows = [...form.querySelectorAll('[data-project-user]')];
  const readRow = row => ({
    user_id: Number(row.dataset.projectUser),
    project_active: row.querySelector('[name="project_active"]').checked ? 1 : 0,
    project_role: row.querySelector('[name="project_role"]').value,
    planner_enabled: row.querySelector('[name="planner_enabled"]').checked ? 1 : 0,
    assignable: row.querySelector('[name="assignable"]').checked ? 1 : 0,
    can_manage_external_dependencies: row.querySelector('[name="can_manage_external_dependencies"]').checked ? 1 : 0
  });
  const initial = new Map(rows.map(row => [Number(row.dataset.projectUser), JSON.stringify(readRow(row))]));
  const changedRows = () => rows.map(readRow).filter(item => initial.get(item.user_id) !== JSON.stringify(item));
  const refresh = () => {
    rows.forEach(row => row.classList.toggle('inactive', !row.querySelector('[name="project_active"]').checked));
    const count = changedRows().length;
    form.querySelectorAll('button[type="submit"]').forEach(button => { button.disabled = count === 0; });
    $('#project-users-change-count').textContent = count ? `${count} ${count === 1 ? 'użytkownik oczekuje' : 'użytkowników oczekuje'} na zapis` : 'Brak niezapisanych zmian';
    $('#config-full-dialog').dataset.dirty = count ? '1' : '';
  };
  form.querySelectorAll('input,select').forEach(control => control.addEventListener('change', refresh));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const changes = changedRows();
    if (!changes.length) return;
    const destructive = changes.some(change => {
      const before = JSON.parse(initial.get(change.user_id));
      return (before.project_active && !change.project_active) || (before.planner_enabled && !change.planner_enabled);
    });
    if (destructive && !await uiConfirm('Zapisz zmiany uczestników', 'Wyłączenie dostępu lub widoczności w Plannerze usuwa przypisania tej osoby z planu bieżącego projektu.', 'Zapisz zmiany', true)) return;
    form.querySelectorAll('button[type="submit"]').forEach(button => { button.disabled = true; });
    try {
      const result = await api('/api/project-users', { method: 'PUT', body: JSON.stringify({ changes }) });
      $('#config-full-dialog').dataset.dirty = '';
      toast(`Zapisano ustawienia ${result.updated} ${result.updated === 1 ? 'użytkownika' : 'użytkowników'}`);
      await loadData(true);
    } catch (error) { toast(error.message, true); refresh(); }
  });
  refresh();
}

function bindSettings() {
  $('#status-states-open')?.addEventListener('click', () => { state.configPanel = 'status_states'; state.configScroll = 0; refreshConfigPanel(); });
  $('#status-states-back')?.addEventListener('click', () => { state.configPanel = 'status_matrix'; state.configScroll = 0; refreshConfigPanel(); });
  $('#waiting-for-open')?.addEventListener('click', () => { state.configPanel = 'waiting_for'; state.configScroll = 0; refreshConfigPanel(); });
  $('#waiting-for-back')?.addEventListener('click', () => { state.configPanel = 'status_categories'; state.configScroll = 0; refreshConfigPanel(); });
  $$('.move-item').forEach(button => button.addEventListener('click', () => moveConfigItem(button.dataset.kind, Number(button.dataset.id), Number(button.dataset.direction))));
  $('#new-status-state')?.addEventListener('click', () => editStatusWorkflowState());
  $$('.edit-status-state').forEach(button => button.addEventListener('click', () => editStatusWorkflowState(Number(button.dataset.id))));
  $$('.delete-status-state').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń własny stan', 'Stan można usunąć tylko wtedy, gdy nie jest używany.', 'Usuń', true)) return; try { await api(`/api/status-workflow-states/${button.dataset.id}`, { method: 'DELETE' }); await loadData(true); } catch (error) { toast(error.message, true); } }));
  $('#new-status-group')?.addEventListener('click', () => editStatusGroup());
  $('#status-layout-export')?.addEventListener('click', exportStatusLayout);
  $('#status-layout-import')?.addEventListener('change', importStatusLayoutFile);
  $('#status-layout-text-import')?.addEventListener('click', importStatusLayoutText);
  $$('.status-config-group-toggle').forEach(button => button.addEventListener('click', () => {
    const id = Number(button.dataset.id); const card = button.closest('[data-status-config-group]'); const body = card.querySelector('.status-config-group-body');
    const collapsed = !state.collapsedStatusConfigGroups.has(id);
    if (collapsed) state.collapsedStatusConfigGroups.add(id); else state.collapsedStatusConfigGroups.delete(id);
    body.classList.toggle('hidden', collapsed); button.textContent = collapsed ? '▸' : '▾'; button.title = collapsed ? 'Rozwiń grupę' : 'Zwiń grupę'; button.setAttribute('aria-expanded', String(!collapsed));
  }));
  $$('.edit-status-group').forEach(button => button.addEventListener('click', () => editStatusGroup(Number(button.dataset.id))));
  $$('.copy-status-layout').forEach(button => button.addEventListener('click', () => copyStatusLayout(Number(button.dataset.group), Number(button.dataset.subgroup) || null)));
  $$('.add-status-subgroup').forEach(button => button.addEventListener('click', () => editStatusSubgroup(Number(button.dataset.group))));
  $$('.edit-status-subgroup').forEach(button => button.addEventListener('click', () => editStatusSubgroup(Number(button.dataset.group), Number(button.dataset.id))));
  $$('.add-status-column').forEach(button => button.addEventListener('click', () => editStatusColumn(Number(button.dataset.group), Number(button.dataset.subgroup) || null, null, button.dataset.columnRole)));
  $$('.edit-status-column').forEach(button => button.addEventListener('click', () => editStatusColumn(Number(button.dataset.group), Number(button.dataset.subgroup) || null, Number(button.dataset.id))));
  $$('.delete-status-column').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń kolumnę', 'Wartości zapisane w tej kolumnie zostaną usunięte.', 'Usuń kolumnę', true)) return; const base = `/api/status-groups/${button.dataset.group}${button.dataset.subgroup ? `/subgroups/${button.dataset.subgroup}` : ''}/columns/${button.dataset.id}`; try { await api(base, { method: 'DELETE' }); await loadData(true); toast('Kolumna została usunięta'); } catch (error) { toast(error.message, true); } }));
  $$('.delete-status-subgroup').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń podgrupę', 'Punkty zostaną przeniesione bezpośrednio do grupy, a wartości kolumn podgrupy usunięte.', 'Usuń podgrupę', true)) return; try { await api(`/api/status-groups/${button.dataset.group}/subgroups/${button.dataset.id}`, { method: 'DELETE' }); await loadData(true); toast('Podgrupa została usunięta'); } catch (error) { toast(error.message, true); } }));
  $$('.delete-status-group').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń grupę statusu', 'Punkty pozostaną w systemie jako nieprzypisane. Układ kolumn i jego wartości zostaną usunięte.', 'Usuń grupę', true)) return; try { await api(`/api/status-groups/${button.dataset.id}`, { method: 'DELETE' }); await loadData(true); toast('Grupa została usunięta'); } catch (error) { toast(error.message, true); } }));
  $$('.select-hierarchy-node').forEach(button => button.addEventListener('click', () => { state.hierarchySelection = button.dataset.node; state.configScroll = $('#config-full-content')?.scrollTop || 0; refreshConfigPanel(); }));
  $$('.select-category-node').forEach(button => button.addEventListener('click', () => { state.categorySelection[button.dataset.scope] = Number(button.dataset.id); state.configScroll = $('#config-full-content')?.scrollTop || 0; refreshConfigPanel(); }));
  $('#new-root-group')?.addEventListener('click', () => saveControllerGroup(null, null));
  $('#new-controller-selected')?.addEventListener('click', button => openRecord('controllers', null, { group_id: Number(button.currentTarget.dataset.group) }));
  $$('.add-child-group').forEach(button => button.addEventListener('click', () => saveControllerGroup(null, Number(button.dataset.id))));
  $$('.edit-controller-group').forEach(button => button.addEventListener('click', () => saveControllerGroup(Number(button.dataset.id), Number(button.dataset.parent) || null, button.dataset.name)));
  $$('.delete-controller-group').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń obszar', 'Podobszary i przypisania mogą również zostać usunięte.', 'Usuń', true)) return; try { await api(`/api/controller-groups/${button.dataset.id}`, { method: 'DELETE' }); state.controller = 'all'; await loadData(); } catch (error) { toast(error.message, true); } }));
  $('#function-group-controller')?.addEventListener('change', event => { state.functionGroupController = event.target.value; state.configScroll = 0; refreshConfigPanel(); });
  $('#new-function-group')?.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      await api('/api/function-groups', { method: 'POST', body: JSON.stringify({ controller: state.functionGroupController, name: new FormData(event.currentTarget).get('name') }) });
      toast('Dodano grupę funkcyjną'); await loadData();
    } catch (error) { toast(error.message, true); }
  });
  $('#bulk-function-groups-add')?.addEventListener('click', async () => {
    const names = $('#bulk-function-groups').value;
    if (!names.trim()) return toast('Wklej co najmniej jedną nazwę grupy', true);
    try {
      await api('/api/function-groups/bulk', { method: 'POST', body: JSON.stringify({ controller: state.functionGroupController, names }) });
      toast('Lista grup została dodana'); await loadData();
    } catch (error) { toast(error.message, true); }
  });
  $$('.manage-function-group-list').forEach(button => button.addEventListener('click', () => manageFunctionGroupList(Number(button.dataset.group), button.dataset.kind)));
  $$('.bulk-elements-add').forEach(button => button.addEventListener('click', async () => {
    const textarea = $(`.bulk-elements[data-group="${button.dataset.group}"]`);
    if (!textarea.value.trim()) return toast('Wklej co najmniej jeden element grupy', true);
    try { await api(`/api/function-groups/${button.dataset.group}/elements/bulk`, { method: 'POST', body: JSON.stringify({ names: textarea.value }) }); toast('Elementy grupy zostały dodane'); await loadData(); } catch (error) { toast(error.message, true); }
  }));
  $$('.bulk-group-subcategories-add').forEach(button => button.addEventListener('click', async () => {
    const textarea = $(`.bulk-group-subcategories[data-group="${button.dataset.group}"]`);
    if (!textarea.value.trim()) return toast('Wklej co najmniej jedną podkategorię grupy', true);
    try { await api(`/api/function-groups/${button.dataset.group}/subcategories/bulk`, { method: 'POST', body: JSON.stringify({ names: textarea.value }) }); toast('Podkategorie grupy zostały dodane'); await loadData(); } catch (error) { toast(error.message, true); }
  }));
  $$('.delete-group-subcategory').forEach(button => button.addEventListener('click', async event => { event.stopPropagation(); if (!await uiConfirm('Usuń podkategorię grupy', 'Przypisania w punktach statusu zostaną wyczyszczone.', 'Usuń', true)) return; try { await api(`/api/function-groups/${button.dataset.group}/subcategories/${button.dataset.id}`, { method: 'DELETE' }); await loadData(); } catch (error) { toast(error.message, true); } }));
  $$('.edit-group-subcategory').forEach(button => button.addEventListener('click', async event => { event.stopPropagation(); const result = await uiForm({ title: 'Edytuj podkategorię grupy funkcyjnej', fields: [{ name: 'name', label: 'Nazwa', value: button.dataset.name, required: true }, { name: 'description', label: 'Opis', type: 'textarea', full: true }] }); if (!result?.name) return; try { await api(`/api/function-groups/${button.dataset.group}/subcategories/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify(result) }); await loadData(); } catch (error) { toast(error.message, true); } }));
  $$('.delete-element').forEach(button => button.addEventListener('click', async event => { event.stopPropagation(); if (!await uiConfirm('Usuń element grupy', 'Element zostanie odłączony od istniejących rekordów.', 'Usuń', true)) return; try { await api(`/api/function-groups/${button.dataset.group}/elements/${button.dataset.id}`, { method: 'DELETE' }); await loadData(); } catch (error) { toast(error.message, true); } }));
  $$('.rename-function-group').forEach(button => button.addEventListener('click', async () => {
    const result = await uiForm({ title: 'Zmień nazwę grupy funkcyjnej', fields: [{ name: 'name', label: 'Nazwa', value: button.dataset.value, required: true }] });
    if (!result?.name) return;
    try {
      await api(`/api/function-groups/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ controller: state.functionGroupController, name: result.name }) });
      toast('Nazwa grupy została zmieniona'); await loadData();
    } catch (error) { toast(error.message, true); }
  }));
  $$('.delete-function-group').forEach(button => button.addEventListener('click', async () => {
    if (!await uiConfirm('Usuń grupę funkcyjną', 'Wszystkie przypisane do niej punkty statusu zostaną usunięte i odnotowane w historii.', 'Usuń grupę', true)) return;
    try {
      await api(`/api/function-groups/${button.dataset.id}`, { method: 'DELETE' });
      toast('Usunięto grupę funkcyjną'); await loadData();
    } catch (error) { toast(error.message, true); }
  }));
  $$('.edit-function-points').forEach(button => button.addEventListener('click', () => openFunctionGroupPoints(Number(button.dataset.id))));
  $$('.add-category').forEach(form => form.addEventListener('submit', async event => { event.preventDefault(); const scope = form.dataset.scope; const endpoint = scope === 'task' ? '/api/task-categories' : '/api/categories'; await api(endpoint, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); await loadData(); }));
  $$('.edit-category').forEach(button => button.addEventListener('click', async () => { const result = await uiForm({ title: 'Edytuj kategorię', fields: [{ name: 'name', label: 'Nazwa kategorii', value: button.dataset.value, required: true }] }); if (!result?.name) return; await api(button.dataset.scope === 'task' ? `/api/task-categories/${button.dataset.id}` : `/api/categories/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ name: result.name }) }); await loadData(); }));
  $$('.add-sub').forEach(button => button.addEventListener('click', async () => { const fields = [{ name: 'name', label: 'Nazwa podkategorii', required: true }]; if (button.dataset.scope === 'status') fields.push({ name: 'default_function', label: 'Domyślna instrukcja „Test / funkcja”', type: 'textarea', full: true }); const result = await uiForm({ title: 'Dodaj podkategorię', fields }); if (!result?.name) return; await api(button.dataset.scope === 'task' ? '/api/task-subcategories' : '/api/subcategories', { method: 'POST', body: JSON.stringify({ category_id: Number(button.dataset.id), ...result }) }); await loadData(); }));
  $$('.edit-sub').forEach(button => button.addEventListener('click', async () => { const fields = [{ name: 'name', label: 'Nazwa podkategorii', value: button.dataset.value, required: true }]; if (button.dataset.scope === 'status') fields.push({ name: 'default_function', label: 'Domyślna instrukcja „Test / funkcja”', type: 'textarea', value: button.dataset.function || '', full: true }); const result = await uiForm({ title: 'Edytuj podkategorię', fields }); if (!result?.name) return; const payload = { category_id: Number(button.dataset.parent), ...result }; await api(button.dataset.scope === 'task' ? `/api/task-subcategories/${button.dataset.id}` : `/api/subcategories/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify(payload) }); await loadData(); }));
  $$('.add-option').forEach(form => form.addEventListener('submit', async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(form)); await api('/api/options', { method: 'POST', body: JSON.stringify({ kind: form.dataset.kind, value: data.value, description: data.description || '', external_dependency_enabled: data.external_dependency_enabled || 0 }) }); await loadData(); }));
  $$('.edit-option').forEach(button => button.addEventListener('click', async () => { const fields = [{ name: 'value', label: 'Wartość', value: button.dataset.value, required: true }, { name: 'description', label: 'Opis', type: 'textarea', rows: 3, value: button.dataset.description || '', full: true }]; if (button.dataset.kind === 'waiting_for') fields.push({ name: 'external_dependency_enabled', label: 'Pokazuj punkty z tą wartością w Zależnościach zewnętrznych', type: 'checkbox', value: button.dataset.externalEnabled === '1', full: true }); const result = await uiForm({ title: 'Edytuj pozycję słownika', fields }); if (!result?.value) return; await api(`/api/options/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ kind: button.dataset.kind, value: result.value, description: result.description || '', external_dependency_enabled: result.external_dependency_enabled ? 1 : 0 }) }); await loadData(); }));
  $$('.delete-config').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń pozycję konfiguracji', 'Zmiana może wpłynąć na istniejące rekordy projektu.', 'Usuń', true)) return; const endpoints = { category: 'categories', subcategory: 'subcategories', task_category: 'task-categories', task_subcategory: 'task-subcategories', option: 'options' }; await api(`/api/${endpoints[button.dataset.kind]}/${button.dataset.id}`, { method: 'DELETE' }); await loadData(); }));
  $$('.edit-controller').forEach(button => button.addEventListener('click', () => openRecord('controllers', state.controllers.find(item => item.id === Number(button.dataset.id)))));
  $$('.edit-global-user').forEach(button => button.addEventListener('click', () => openRecord('global_users', state.users.find(item => item.id === Number(button.dataset.id)))));
  $$('.reset-user-password').forEach(button => button.addEventListener('click', () => resetUserPassword(Number(button.dataset.id), button.dataset.name)));
  bindProjectUsersEditor();
  $('#new-controller')?.addEventListener('click', () => openRecord('controllers'));
  $('#new-user')?.addEventListener('click', () => openRecord('global_users'));
  $('#new-project')?.addEventListener('click', () => editProject());
  $$('.edit-project').forEach(button => button.addEventListener('click', () => editProject(Number(button.dataset.id))));
  $$('.delete-project').forEach(button => button.addEventListener('click', () => deleteProjectSafely(Number(button.dataset.id))));
  $('#default-reminder')?.addEventListener('change', event => saveSetting('default_reminder_days', event.target.value));
  $('#warning-days')?.addEventListener('change', event => saveSetting('reminder_warning_days', event.target.value));
  $$('.planner-setting').forEach(input => input.addEventListener('change', event => saveSetting(event.target.dataset.key, event.target.value)));
  $('#planner-holidays-bulk-save')?.addEventListener('click', savePlannerHolidaysBulk);
  $$('.edit-planner-holiday').forEach(button => button.addEventListener('click', () => editPlannerHoliday(Number(button.dataset.id))));
  $$('.delete-planner-holiday').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń święto', 'Zmieni to kalkulację nadgodzin dla tego dnia.', 'Usuń', true)) return; try { await api(`/api/planner/holidays/${button.dataset.id}`, { method: 'DELETE' }); await refreshAfterPlannerHolidayChange('Święto usunięto'); } catch (error) { toast(error.message, true); } }));
  $('#new-planner-vehicle')?.addEventListener('click', () => editPlannerVehicle());
  $$('.edit-planner-vehicle').forEach(button => button.addEventListener('click', () => editPlannerVehicle(Number(button.dataset.id))));
  $$('.delete-planner-vehicle').forEach(button => button.addEventListener('click', async () => {
    if (!await uiConfirm('Usuń auto z Plannera', 'Istniejące transporty przypisane do tego auta zostaną oznaczone ogólnym kodem T.', 'Usuń auto', true)) return;
    try { await api(`/api/planner/vehicles/${button.dataset.id}`, { method: 'DELETE' }); await loadData(true); toast('Auto zostało usunięte'); } catch (error) { toast(error.message, true); }
  }));
  $('#new-announcement-label')?.addEventListener('click', () => editAnnouncementLabel());
  $$('.edit-announcement-label').forEach(button => button.addEventListener('click', () => editAnnouncementLabel(Number(button.dataset.id))));
  $$('.delete-announcement-label').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń etykietę', 'Etykieta zostanie odłączona od wiadomości.', 'Usuń', true)) return; try { await api(`/api/announcement-labels/${button.dataset.id}`, { method: 'DELETE' }); await loadData(true); } catch (error) { toast(error.message, true); } }));
  $('#download-backup')?.addEventListener('click', downloadBackup);
  $('#restore-backup')?.addEventListener('change', restoreBackup);
  $('#new-export-template')?.addEventListener('click', () => editExportTemplate());
  $$('.edit-export-template').forEach(button => button.addEventListener('click', () => editExportTemplate(Number(button.dataset.id))));
  $$('.delete-export-template').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń szablon eksportu', 'Szablon zostanie usunięty tylko z bieżącego projektu.', 'Usuń', true)) return; await api(`/api/export-templates/${button.dataset.id}`, { method: 'DELETE' }); await loadData(); }));
  $('#new-requirement-config')?.addEventListener('click', () => editCompletionRequirement());
  $$('.edit-requirement-config').forEach(button => button.addEventListener('click', () => editCompletionRequirement(Number(button.dataset.id))));
  $$('.delete-requirement-config').forEach(button => button.addEventListener('click', async () => {
    if (!await uiConfirm('Usuń pozycję zapotrzebowania', 'Pozycja zostanie odłączona od wszystkich elementów projektu.', 'Usuń', true)) return;
    try { await api(`/api/completion-requirements/${button.dataset.id}`, { method: 'DELETE' }); toast('Pozycja zapotrzebowania została usunięta'); await loadData(); } catch (error) { toast(error.message, true); }
  }));
}

async function resetUserPassword(userId, name) {
  const result = await uiForm({ title: `Nowe hasło · ${name}`, description: 'Administrator systemu ustawia hasło bez znajomości poprzedniego.', submitLabel: 'Ustaw nowe hasło', fields: [
    { name: 'new_password', label: 'Nowe hasło (min. 8 znaków)', type: 'password', required: true },
    { name: 'confirm_password', label: 'Powtórz hasło', type: 'password', required: true }
  ] });
  if (!result) return;
  if (result.new_password !== result.confirm_password) return toast('Hasła nie są takie same', true);
  try { await api(`/api/users/${userId}/password`, { method: 'PUT', body: JSON.stringify(result) }); toast('Hasło użytkownika zostało zmienione'); }
  catch (error) { toast(error.message, true); }
}

async function editAnnouncementLabel(id = null) {
  const existing = (state.config.announcement_labels || []).find(item => item.id === id);
  const result = await uiForm({ title: id ? 'Edytuj etykietę Informatora' : 'Nowa etykieta Informatora', fields: [
    { name: 'name', label: 'Nazwa', value: existing?.name || '', required: true },
    { name: 'color', label: 'Kolor', type: 'select', value: existing?.color || 'blue', options: [
      { value: 'blue', label: 'Niebieski' }, { value: 'green', label: 'Zielony' }, { value: 'amber', label: 'Bursztynowy' },
      { value: 'red', label: 'Czerwony' }, { value: 'violet', label: 'Fioletowy' }, { value: 'gray', label: 'Szary' }
    ] }
  ], submitLabel: id ? 'Zapisz etykietę' : 'Dodaj etykietę' });
  if (!result?.name) return;
  try { await api('/api/announcement-labels' + (id ? `/${id}` : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify(result) }); await loadData(true); toast('Etykiety Informatora zostały zapisane'); }
  catch (error) { toast(error.message, true); }
}

async function savePlannerHolidaysBulk() {
  const rows = String($('#planner-holidays-bulk')?.value || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const items = [];
  for (const row of rows) {
    const match = row.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(.+)$/);
    if (!match) return toast(`Nieprawidłowy wiersz: „${row}”. Użyj formatu DD.MM.RRRR Nazwa święta.`, true);
    const [, day, month, year, name] = match;
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) return toast(`Nieprawidłowa data: „${day}.${month}.${year}”.`, true);
    items.push({ holiday_date: `${year}-${month}-${day}`, name: name.trim() });
  }
  if (!items.length) return toast('Wklej co najmniej jedno święto', true);
  try { await api('/api/planner/holidays/bulk', { method: 'POST', body: JSON.stringify({ items }) }); await refreshAfterPlannerHolidayChange(`Dodano lub zaktualizowano ${items.length} świąt`); }
  catch (error) { toast(error.message, true); }
}

async function editPlannerHoliday(id) {
  const existing = (state.config.planner_holidays || []).find(item => item.id === id);
  if (!existing) return;
  const result = await uiForm({ title: 'Edytuj święto projektu', fields: [
    { name: 'holiday_date', label: 'Data', type: 'date', value: existing.holiday_date, required: true },
    { name: 'name', label: 'Nazwa', value: existing.name, required: true }
  ], submitLabel: 'Zapisz święto' });
  if (!result) return;
  try { await api(`/api/planner/holidays/${id}`, { method: 'PATCH', body: JSON.stringify(result) }); await refreshAfterPlannerHolidayChange('Święto zostało zmienione'); }
  catch (error) { toast(error.message, true); }
}

async function editPlannerVehicle(id = null) {
  const existing = (state.config.planner_vehicles || []).find(item => Number(item.id) === Number(id));
  const suggested = `T${Math.max(0, ...(state.config.planner_vehicles || []).map(item => Number(String(item.code).slice(1)) || 0)) + 1}`;
  const result = await uiForm({ title: existing ? `Edytuj auto ${existing.code}` : 'Dodaj auto transportowe', description: 'Kod T bez numeru jest zarezerwowany dla transportu bez wskazanego auta.', submitLabel: existing ? 'Zapisz auto' : 'Dodaj auto', fields: [
    { name: 'code', label: 'Kod auta', value: existing?.code || suggested, required: true },
    { name: 'registration_number', label: 'Numer rejestracyjny', value: existing?.registration_number || '', required: true }
  ] });
  if (!result) return;
  try { await api(`/api/planner/vehicles${existing ? `/${existing.id}` : ''}`, { method: existing ? 'PATCH' : 'POST', body: JSON.stringify(result) }); await loadData(true); toast('Auto transportowe zostało zapisane'); }
  catch (error) { toast(error.message, true); }
}

async function manageFunctionGroupList(groupId, kind) {
  const group = (state.config.function_groups || []).find(item => item.id === groupId);
  if (!group) return;
  state.functionListManager = { groupId, kind };
  $('#function-list-add-value').value = '';
  renderFunctionGroupListManager();
  if (!$('#function-list-dialog').open) $('#function-list-dialog').showModal();
}

function renderFunctionGroupListManager() {
  const manager = state.functionListManager;
  if (!manager) return;
  const group = (state.config.function_groups || []).find(item => item.id === manager.groupId);
  if (!group) return;
  const items = manager.kind === 'elements' ? (group.elements || []) : (group.subcategories || []);
  const label = manager.kind === 'elements' ? 'Elementy grupy' : 'Podkategorie grupy';
  $('#function-list-title').textContent = `${label} · ${group.name}`;
  $('#function-list-subtitle').textContent = `${controllerLabel(group.controller)} · wszystkie pozycje są widoczne i można zmienić ich kolejność`;
  $('#function-list-count').textContent = `${items.length} pozycji`;
  $('#function-list-add-value').placeholder = manager.kind === 'elements' ? 'QM1\nQM2\nBZ1' : 'Napędy\nSensory\nBezpieczeństwo';
  $('#function-list-content').innerHTML = items.map((item, index) => `<article class="function-list-row" data-id="${item.id}"><span class="function-list-index">${index + 1}</span><span class="order-buttons"><button type="button" class="mini function-list-move" data-direction="-1" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="mini function-list-move" data-direction="1" ${index === items.length - 1 ? 'disabled' : ''}>↓</button></span><label><span>Nazwa</span><input data-function-list-name value="${escapeHtml(item.name)}"></label>${manager.kind === 'subcategories' ? `<label class="function-list-description"><span>Opis</span><input data-function-list-description value="${escapeHtml(item.description || '')}" placeholder="Opcjonalny opis"></label>` : ''}<button type="button" class="mini function-list-save">Zapisz</button><button type="button" class="mini danger-outline function-list-delete">Usuń</button></article>`).join('') || '<div class="empty">Lista jest pusta. Dodaj kilka pozycji powyżej.</div>';
  $$('#function-list-content .function-list-save').forEach(button => button.addEventListener('click', () => saveFunctionGroupListItem(button.closest('[data-id]'))));
  $$('#function-list-content .function-list-delete').forEach(button => button.addEventListener('click', () => deleteFunctionGroupListItem(button.closest('[data-id]'))));
  $$('#function-list-content .function-list-move').forEach(button => button.addEventListener('click', () => moveFunctionGroupListItem(button.closest('[data-id]'), Number(button.dataset.direction))));
}

async function refreshFunctionGroupListManager(message = '') {
  await loadData(true);
  renderFunctionGroupListManager();
  if (message) toast(message);
}

async function addFunctionGroupListItems(event) {
  event.preventDefault();
  const manager = state.functionListManager;
  const names = $('#function-list-add-value').value.trim();
  if (!manager || !names) return;
  try {
    await api(`/api/function-groups/${manager.groupId}/${manager.kind}/bulk`, { method: 'POST', body: JSON.stringify({ names }) });
    $('#function-list-add-value').value = '';
    await refreshFunctionGroupListManager('Pozycje zostały dodane');
  } catch (error) { toast(error.message, true); }
}

async function saveFunctionGroupListItem(row) {
  const manager = state.functionListManager;
  const name = row.querySelector('[data-function-list-name]').value.trim();
  if (!manager || !name) return toast('Nazwa pozycji nie może być pusta', true);
  const payload = { name };
  if (manager.kind === 'subcategories') payload.description = row.querySelector('[data-function-list-description]').value.trim();
  try { await api(`/api/function-groups/${manager.groupId}/${manager.kind}/${row.dataset.id}`, { method: 'PATCH', body: JSON.stringify(payload) }); await refreshFunctionGroupListManager('Pozycja została zapisana'); }
  catch (error) { toast(error.message, true); }
}

async function deleteFunctionGroupListItem(row) {
  const manager = state.functionListManager;
  if (!manager || !await uiConfirm('Usuń pozycję', 'Powiązania istniejących rekordów z tą pozycją zostaną wyczyszczone.', 'Usuń', true)) return;
  try { await api(`/api/function-groups/${manager.groupId}/${manager.kind}/${row.dataset.id}`, { method: 'DELETE' }); await refreshFunctionGroupListManager('Pozycja została usunięta'); }
  catch (error) { toast(error.message, true); }
}

async function moveFunctionGroupListItem(row, direction) {
  const manager = state.functionListManager;
  const group = (state.config.function_groups || []).find(item => item.id === manager?.groupId);
  const items = manager?.kind === 'elements' ? (group?.elements || []) : (group?.subcategories || []);
  const index = items.findIndex(item => item.id === Number(row.dataset.id));
  const target = index + direction;
  if (!manager || index < 0 || target < 0 || target >= items.length) return;
  const ids = items.map(item => item.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  try { await api('/api/reorder', { method: 'PATCH', body: JSON.stringify({ kind: manager.kind === 'elements' ? 'function_group_elements' : 'function_group_subcategories', ids }) }); await refreshFunctionGroupListManager(); }
  catch (error) { toast(error.message, true); }
}

async function editCompletionRequirement(id = null) {
  const existing = (state.config.requirements || []).find(item => item.id === id);
  const result = await uiForm({ title: id ? 'Edytuj pozycję zapotrzebowania' : 'Nowa pozycja zapotrzebowania', fields: [
    { name: 'name', label: 'Nazwa', value: existing?.name || '', required: true },
    { name: 'description', label: 'Krótki opis', type: 'textarea', value: existing?.description || '', full: true }
  ], submitLabel: id ? 'Zapisz' : 'Dodaj' });
  if (!result?.name) return;
  try { await api('/api/completion-requirements' + (id ? `/${id}` : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify(result) }); toast('Lista zapotrzebowania została zapisana'); await loadData(); } catch (error) { toast(error.message, true); }
}

async function saveControllerGroup(id, parentId, existingName = '') {
  const result = await uiForm({ title: id ? 'Edytuj obszar' : parentId ? 'Dodaj podobszar' : 'Dodaj obszar', description: 'Hierarchia: projekt → obszar → podobszar → sterownik.', fields: [{ name: 'name', label: 'Nazwa', value: existingName, required: true }, { name: 'description', label: 'Opis', type: 'textarea', full: true }] });
  if (!result?.name) return;
  try { await api('/api/controller-groups' + (id ? `/${id}` : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify({ ...result, parent_id: parentId }) }); state.controller = 'all'; toast('Hierarchia została zapisana'); await loadData(); } catch (error) { toast(error.message, true); }
}

async function editProject(id = null) {
  const existing = state.projects.find(item => item.id === id);
  const result = await uiForm({ title: id ? 'Edytuj projekt' : 'Nowy projekt', description: 'Kolor i krótki kod są stałymi oznaczeniami projektu w Plannerze.', fields: [{ name: 'code', label: 'Kod projektu', value: existing?.code || 'NOWY', required: true }, { name: 'planner_short_code', label: 'Skrót w Plannerze (maks. 6 znaków)', value: existing?.planner_short_code || String(existing?.code || 'NOWY').slice(0, 6), required: true, max: 6 }, { name: 'name', label: 'Nazwa projektu', value: existing?.name || 'Nowy projekt', required: true }, ...(existing ? [{ name: 'planner_color', label: 'Kolor projektu w Plannerze', type: 'color', value: safeProjectColor(existing.planner_color) }] : []), { name: 'description', label: 'Opis', type: 'textarea', value: existing?.description || '', full: true }] });
  if (!result?.code || !result?.name) return;
  if (!result.planner_short_code || result.planner_short_code.trim().length > 6) return toast('Skrót Plannera musi zawierać od 1 do 6 znaków', true);
  try { await api('/api/projects' + (id ? `/${id}` : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify({ ...result, active: 1 }) }); state.me = await api('/api/me'); state.projects = state.me.projects || []; updateIdentity(); renderSettings(); toast('Projekt został zapisany'); } catch (error) { toast(error.message, true); }
}

async function deleteProjectSafely(id) {
  const project = state.projects.find(item => item.id === id);
  if (!project) return;
  const first = await uiConfirm('Usuwanie całego projektu', `Projekt ${project.code} wraz ze wszystkimi danymi zostanie trwale usunięty. To pierwsze z dwóch zabezpieczeń.`, 'Przejdź dalej', true);
  if (!first) return;
  const result = await uiForm({ title: `Potwierdź usunięcie ${project.code}`, description: 'Wpisz osobno kod projektu oraz dokładną frazę potwierdzającą.', submitLabel: 'Trwale usuń projekt', danger: true, fields: [
    { name: 'project_code', label: `Kod projektu: ${project.code}`, required: true, hint: 'Kod musi być identyczny, z zachowaniem wielkości liter.' },
    { name: 'confirmation', label: `Fraza: USUŃ ${project.code}`, required: true, hint: 'To drugie, niezależne zabezpieczenie.' }
  ] });
  if (!result) return;
  if (result.project_code !== project.code || result.confirmation !== `USUŃ ${project.code}`) return toast('Kod lub fraza potwierdzająca są nieprawidłowe', true);
  try {
    await api(`/api/projects/${project.id}`, { method: 'DELETE', body: JSON.stringify(result) });
    state.me = await api('/api/me'); state.projects = state.me.projects || []; state.controller = 'all'; updateIdentity();
    toast(`Projekt ${project.code} został trwale usunięty`);
    if (!state.me.current_project) openProjectDialog(true); else await loadData();
  } catch (error) { toast(error.message, true); }
}

const bytesToBase64 = bytes => { let binary = ''; for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(binary); };
const base64ToBytes = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
async function backupKey(password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 250000 }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptBackup(backup, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await backupKey(password, salt), new TextEncoder().encode(JSON.stringify(backup)));
  return { format: 'plc-hub-encrypted-backup', version: 1, kdf: 'PBKDF2-SHA256', iterations: 250000, salt: bytesToBase64(salt), iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(encrypted)) };
}
async function decryptBackup(envelope, password) {
  if (envelope.format !== 'plc-hub-encrypted-backup' || Number(envelope.version) !== 1) return envelope;
  const salt = base64ToBytes(envelope.salt); const iv = base64ToBytes(envelope.iv); const data = base64ToBytes(envelope.data);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await backupKey(password, salt), data);
  return JSON.parse(new TextDecoder().decode(plain));
}
function downloadBlob(blob, filename) {
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
async function downloadBackup() {
  const password = await uiForm({ title: 'Zabezpiecz backup hasłem', description: 'Użyj osobnego, długiego hasła i przechowuj je poza aplikacją.', submitLabel: 'Szyfruj i pobierz', fields: [
    { name: 'password', label: 'Hasło backupu (min. 12 znaków)', type: 'password', required: true },
    { name: 'confirmation', label: 'Powtórz hasło', type: 'password', required: true }
  ] });
  if (!password) return;
  if (password.password.length < 12 || password.password !== password.confirmation) return toast('Hasła muszą być identyczne i mieć co najmniej 12 znaków.', true);
  try {
    const response = await fetch('/api/backup'); if (!response.ok) throw new Error((await response.json()).error);
    const backup = await response.json(); const envelope = await encryptBackup(backup, password.password);
    const sourceName = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'backup.json';
    downloadBlob(new Blob([JSON.stringify(envelope)], { type: 'application/json' }), sourceName.replace(/\.json$/i, '.plcbak'));
    toast('Zaszyfrowany backup został pobrany');
  } catch (error) { toast(error.message, true); }
}
async function restoreBackup(event) {
  const file = event.target.files[0]; if (!file) return;
  if (!await uiConfirm('Odtwórz backup projektu', 'Wczytanie pliku zastąpi wszystkie dane bieżącego projektu. Tej operacji nie można cofnąć bez innego backupu.', 'Odtwórz backup', true)) { event.target.value = ''; return; }
  try {
    const parsed = JSON.parse(await file.text()); let backup = parsed;
    if (parsed.format === 'plc-hub-encrypted-backup') {
      const password = await uiForm({ title: 'Odszyfruj backup', submitLabel: 'Odszyfruj', fields: [{ name: 'password', label: 'Hasło backupu', type: 'password', required: true }] });
      if (!password) return;
      try { backup = await decryptBackup(parsed, password.password); } catch { throw new Error('Nieprawidłowe hasło lub uszkodzony plik backupu'); }
    }
    await api('/api/backup/restore', { method: 'POST', body: JSON.stringify({ backup }) }); toast('Backup został odtworzony'); await loadData();
  } catch (error) { toast(error.message, true); }
  finally { event.target.value = ''; }
}
async function editExportTemplate(id = null) {
  const existing = (state.config.export_templates || []).find(item => item.id === id);
  const availableColumns = ['controller', 'function_group_name', 'function_group_element_name', 'category', 'subcategory', 'status', 'related_work_progress', 'criticality', 'responsible_name', 'checked_by', 'checked_on', 'function_detail', 'current_note', 'links_text', 'evidence_link', 'created_by_name', 'created_at', 'updated_at'];
  const currentColumns = existing?.columns?.length ? existing.columns.join(', ') : availableColumns.join(', ');
  const result = await uiForm({ title: id ? 'Edytuj szablon eksportu' : 'Nowy szablon eksportu', fields: [
    { name: 'name', label: 'Nazwa szablonu', value: existing?.name || 'Raport managerski', required: true },
    { name: 'detail_level', label: 'Poziom szczegółowości', type: 'select', value: existing?.detail_level || 'category', options: [{ value: 'controller', label: 'Sterowniki' }, { value: 'category', label: 'Kategorie' }, { value: 'function_group', label: 'Grupy funkcyjne' }, { value: 'detailed', label: 'Pełna lista' }] },
    { name: 'columns', label: 'Kolumny (oddzielone przecinkami)', type: 'textarea', value: currentColumns, full: true, hint: availableColumns.join(', ') },
    { name: 'status_filter', label: 'Filtr statusu (opcjonalnie)', value: existing?.filters?.status || '' },
    { name: 'sort_key', label: 'Sortowanie', type: 'select', value: existing?.sort_key || '', options: [{ value: '', label: 'Kolejność konfiguracji' }, 'controller', 'category', 'status', 'updated_at'] },
    { name: 'sort_direction', label: 'Kierunek', type: 'select', value: existing?.sort_direction || 'asc', options: [{ value: 'asc', label: 'Rosnąco' }, { value: 'desc', label: 'Malejąco' }] }
  ] });
  if (!result?.name) return;
  const columns = result.detail_level === 'detailed' ? result.columns.split(',').map(value => value.trim()).filter(value => availableColumns.includes(value)) : [];
  try { await api('/api/export-templates' + (id ? `/${id}` : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify({ name: result.name, detail_level: result.detail_level, columns, filters: result.status_filter ? { status: result.status_filter } : {}, sort_key: result.sort_key, sort_direction: result.sort_direction }) }); toast('Szablon eksportu został zapisany'); await loadData(); } catch (error) { toast(error.message, true); }
}

function openFunctionGroupPoints(groupId) {
  const group = (state.config.function_groups || []).find(item => item.id === groupId);
  if (!group) return;
  state.functionPointGroup = group;
  state.functionPointDraft = (group.checks || []).map(check => ({
    id: check.id, element_id: check.element_id, group_subcategory_id: check.group_subcategory_id, title: check.title, category: check.category,
    criticality: check.criticality, subcategory_ids: [...(check.subcategory_ids || [])]
  }));
  $('#function-points-title').textContent = `Punkty · ${group.name}`;
  $('#function-points-subtitle').textContent = `Sterownik ${group.controller} · ${state.functionPointDraft.length} zdefiniowanych punktów`;
  renderFunctionPointDraft();
  $('#function-points-dialog').showModal();
}

function captureFunctionPointDraft() {
  $$('#function-points-content [data-point-index]').forEach(row => {
    const point = state.functionPointDraft[Number(row.dataset.pointIndex)];
    if (!point) return;
    point.title = row.querySelector('[data-point-title]').value;
    point.element_id = Number(row.querySelector('[data-point-element]').value) || null;
    point.group_subcategory_id = Number(row.querySelector('[data-point-group-subcategory]').value) || null;
    point.category = row.querySelector('[data-point-category]').value;
    point.criticality = row.querySelector('[data-point-criticality]').value;
    point.subcategory_ids = [...row.querySelectorAll('[data-point-subcategory]:checked')].map(input => Number(input.value));
  });
}

function renderFunctionPointDraft() {
  $('#function-points-subtitle').textContent = `Sterownik ${state.functionPointGroup.controller} · ${state.functionPointDraft.length} zdefiniowanych punktów`;
  $('#function-points-content').innerHTML = state.functionPointDraft.map((point, index) => {
    const category = point.category || statusCategories()[0] || '';
    const categoryConfig = state.config.categories.find(item => item.name === category);
    const selected = new Set(point.subcategory_ids || []);
    return `<article class="function-point" data-point-index="${index}"><header><strong>Punkt ${index + 1}</strong><span class="order-buttons"><button type="button" class="mini move-function-point" data-direction="-1" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" class="mini move-function-point" data-direction="1" ${index === state.functionPointDraft.length - 1 ? 'disabled' : ''}>↓</button><button type="button" class="mini remove-function-point">Usuń</button></span></header><div class="function-point-fields">
      <label class="field"><span>Nazwa punktu / funkcji</span><input data-point-title value="${escapeHtml(point.title)}" placeholder="Np. Ruch osi w trybie ręcznym"></label>
      <label class="field"><span>Element grupy (opcjonalnie)</span><select data-point-element>${selectOptions((state.functionPointGroup.elements || []).map(element => ({ value: element.id, label: element.name })), point.element_id, 'Cała grupa funkcyjna')}</select></label>
      <label class="field"><span>Podkategoria grupy funkcyjnej</span><select data-point-group-subcategory>${selectOptions((state.functionPointGroup.subcategories || []).map(item => ({ value: item.id, label: item.name })), point.group_subcategory_id, 'Bez podkategorii grupy')}</select></label>
      <label class="field"><span>Kategoria statusu</span><select data-point-category>${selectOptions(statusCategories(), category)}</select></label>
      <label class="field"><span>Krytyczność</span><select data-point-criticality>${selectOptions(PRIORITY_DEFINITIONS, point.criticality || 'Medium')}</select></label>
    </div><div class="subcategory-picks"><span>Podkategorie dotyczące punktu</span><div>${categoryConfig?.subcategories.length ? categoryConfig.subcategories.map(subcategory => `<label class="mention"><input type="checkbox" data-point-subcategory value="${subcategory.id}" ${selected.has(subcategory.id) ? 'checked' : ''}>${escapeHtml(subcategory.name)}</label>`).join('') : '<span class="sub">Ta kategoria nie ma podkategorii — zostanie utworzony jeden punkt na poziomie kategorii.</span>'}</div></div></article>`;
  }).join('') || '<div class="empty">Dodaj pierwszy punkt do sprawdzenia dla tej grupy.</div>';
  $$('.remove-function-point').forEach(button => button.addEventListener('click', () => {
    captureFunctionPointDraft();
    state.functionPointDraft.splice(Number(button.closest('[data-point-index]').dataset.pointIndex), 1);
    renderFunctionPointDraft();
  }));
  $$('.move-function-point').forEach(button => button.addEventListener('click', () => {
    captureFunctionPointDraft();
    const index = Number(button.closest('[data-point-index]').dataset.pointIndex);
    const target = index + Number(button.dataset.direction);
    [state.functionPointDraft[index], state.functionPointDraft[target]] = [state.functionPointDraft[target], state.functionPointDraft[index]];
    renderFunctionPointDraft();
  }));
  $$('[data-point-category]').forEach(select => select.addEventListener('change', () => {
    captureFunctionPointDraft();
    const point = state.functionPointDraft[Number(select.closest('[data-point-index]').dataset.pointIndex)];
    point.category = select.value;
    point.subcategory_ids = [];
    renderFunctionPointDraft();
  }));
}

function addFunctionPointDraft() {
  captureFunctionPointDraft();
  state.functionPointDraft.push({ id: null, element_id: null, group_subcategory_id: null, title: '', category: statusCategories()[0] || '', criticality: 'Medium', subcategory_ids: [] });
  renderFunctionPointDraft();
  $('#function-points-content').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function saveFunctionGroupPoints() {
  captureFunctionPointDraft();
  const button = $('#function-points-save');
  button.disabled = true;
  try {
    const groupId = state.functionPointGroup.id;
    await api(`/api/function-groups/${groupId}/checks`, { method: 'PUT', body: JSON.stringify({ points: state.functionPointDraft }) });
    toast('Punkty grupy zapisano i zsynchronizowano ze Statusem');
    await loadData();
    const updated = (state.config.function_groups || []).find(item => item.id === groupId);
    if (updated) {
      state.functionPointGroup = updated;
      state.functionPointDraft = (updated.checks || []).map(check => ({ id: check.id, element_id: check.element_id, group_subcategory_id: check.group_subcategory_id, title: check.title, category: check.category, criticality: check.criticality, subcategory_ids: [...(check.subcategory_ids || [])] }));
      renderFunctionPointDraft();
      $('#function-points-dialog').dataset.dirty = '';
    }
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

async function moveConfigItem(kind, id, direction) {
  let items;
  if (kind === 'controllers') items = state.controllers;
  else if (kind === 'controller_groups') {
    const item = state.controllerGroups.find(entry => entry.id === id);
    items = state.controllerGroups.filter(entry => Number(entry.parent_id || 0) === Number(item?.parent_id || 0));
  }
  else if (kind === 'users') items = state.users;
  else if (kind === 'function_groups') items = functionGroups(state.functionGroupController);
  else if (kind === 'function_group_elements') {
    const group = state.config.function_groups.find(entry => entry.elements?.some(element => element.id === id));
    items = group?.elements || [];
  }
  else if (kind === 'function_group_subcategories') {
    const group = state.config.function_groups.find(entry => entry.subcategories?.some(item => item.id === id));
    items = group?.subcategories || [];
  }
  else if (kind === 'status_groups') items = statusGroups();
  else if (kind === 'status_subgroups') {
    const group = statusGroups().find(entry => entry.subgroups?.some(item => item.id === id));
    items = group?.subgroups || [];
  }
  else if (kind === 'status_columns') {
    const scopes = statusGroups().flatMap(group => [group.columns || [], ...(group.subgroups || []).map(subgroup => subgroup.columns || [])]);
    items = scopes.find(columns => columns.some(item => item.id === id)) || [];
  }
  else if (kind === 'export_templates') items = state.config.export_templates || [];
  else if (kind === 'completion_requirements') items = state.config.requirements || [];
  else if (kind === 'categories') items = state.config.categories;
  else if (kind === 'task_categories') items = state.config.task_categories;
  else if (kind === 'options') {
    const item = state.config.options.find(entry => entry.id === id);
    items = state.config.options.filter(entry => entry.kind === item.kind);
  } else {
    const source = kind === 'subcategories' ? state.config.categories : state.config.task_categories;
    const parent = source.find(category => category.subcategories.some(sub => sub.id === id));
    if (!parent) return;
    items = parent.subcategories;
  }
  const index = items.findIndex(item => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return;
  const ids = items.map(item => item.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await api('/api/reorder', { method: 'PATCH', body: JSON.stringify({ kind, ids }) });
  await loadData();
}

async function editStatusGroup(id = null) {
  const item = statusGroups().find(group => group.id === Number(id));
  const result = await uiForm({ title: item ? 'Edytuj grupę statusu' : 'Dodaj grupę statusu', description: 'Grupa może mieć własne kolumny albo dziedziczyć układ z dowolnej innej grupy lub podgrupy.', submitLabel: item ? 'Zapisz grupę' : 'Dodaj grupę', fields: [
    { name: 'name', label: 'Nazwa grupy', value: item?.name || '', required: true },
    { name: 'inheritance_source', label: 'Układ kolumn i podpunktów', type: 'select', value: statusInheritanceValue(item), options: statusInheritanceOptions(item?.id), full: true },
    { name: 'description', label: 'Opis (opcjonalnie)', type: 'textarea', value: item?.description || '', rows: 3, full: true }
  ] });
  if (!result) return;
  try { await api('/api/status-groups' + (item ? `/${item.id}` : ''), { method: item ? 'PATCH' : 'POST', body: JSON.stringify(result) }); toast('Grupa statusu została zapisana'); await loadData(true); }
  catch (error) { toast(error.message, true); }
}

function statusCopyElements(group) {
  const element = (column, ref, scopeLabel) => ({
    value: ref,
    kind: statusColumnRole(column) === 'basic' ? 'basic' : 'subpoint',
    label: `${scopeLabel} · ${column.name}`
  });
  return [
    ...(group.columns || []).map(column => element(column, `direct:${column.id}`, group.name)),
    ...(group.subgroups || []).flatMap(subgroup => (subgroup.columns || []).map(column => element(column, `subgroup:${subgroup.id}:${column.id}`, `${group.name} / ${subgroup.name}`)))
  ];
}

function statusCopyElementGroups(group) {
  const elements = statusCopyElements(group);
  return [
    { label: 'Kolumny podstawowe', options: elements.filter(item => item.kind === 'basic') },
    { label: 'Podpunkty', options: elements.filter(item => item.kind === 'subpoint') }
  ];
}

function statusCopyGroupsHtml(groups) {
  return groups.map(section => `<section><h4>${escapeHtml(section.label)} <small>${section.options.length}</small></h4><div>${section.options.map(item => `<label><input name="element_refs" type="checkbox" value="${escapeHtml(item.value)}" checked><span>${escapeHtml(item.label)}</span></label>`).join('') || '<p class="sub">Brak elementów</p>'}</div></section>`).join('');
}

function renderStatusCopyScope(group) {
  const picker = $('#action-fields [data-ui-multiselect="element_refs"]'); if (!picker) return;
  picker.innerHTML = statusCopyGroupsHtml(statusCopyElementGroups(group));
}

async function copyStatusLayout(groupId) {
  let group = statusGroups().find(item => Number(item.id) === Number(groupId));
  if (!group) return;
  const sourceOptions = statusGroups().map(item => ({ value: item.id, label: item.name }));
  const formPromise = uiForm({
    title: 'Kopiuj grupę tabeli statusowej',
    description: 'Powstanie nowa, niezależna grupa. Zaznacz dokładnie te kolumny i podpunkty, które mają zostać skopiowane.',
    submitLabel: 'Utwórz kopię',
    fields: [
      { name: 'new_group_name', label: 'Nazwa nowej grupy', value: `${group.name} — kopia`, required: true, full: true },
      { name: 'source_group_id', label: 'Grupa źródłowa', type: 'select', value: group.id, options: sourceOptions, full: true },
      { name: 'element_refs', label: 'Zakres kopiowania', type: 'grouped-multiselect', value: statusCopyElements(group).map(item => item.value), groups: statusCopyElementGroups(group), className: 'status-copy-scope', full: true }
    ]
  });
  const sourceSelect = $('#action-fields [name="source_group_id"]');
  sourceSelect?.addEventListener('change', () => {
    group = statusGroups().find(item => Number(item.id) === Number(sourceSelect.value));
    if (!group) return;
    $('#action-fields [name="new_group_name"]').value = `${group.name} — kopia`;
    renderStatusCopyScope(group);
  });
  const result = await formPromise;
  if (!result) return;
  if (!(result.element_refs || []).length) return toast('Wybierz co najmniej jeden element do skopiowania', true);
  const payload = { source_group_id: Number(result.source_group_id), mode: 'new_group_selected', element_refs: result.element_refs, new_group_name: result.new_group_name };
  try { await api('/api/status-layout/copy', { method: 'POST', body: JSON.stringify(payload) }); toast('Nowa grupa została utworzona'); await loadData(true); }
  catch (error) { toast(error.message, true); }
}

async function editStatusSubgroup(groupId, id = null) {
  const group = statusGroups().find(item => item.id === Number(groupId)); const item = group?.subgroups?.find(subgroup => subgroup.id === Number(id));
  if (!group) return;
  const fields = [
    { name: 'name', label: 'Nazwa podgrupy', value: item?.name || '', required: true },
    { name: 'inheritance_source', label: 'Układ kolumn i podpunktów', type: 'select', value: statusInheritanceValue(item, true), options: statusInheritanceOptions(group.id, item?.id, true), full: true },
    { name: 'description', label: 'Opis (opcjonalnie)', type: 'textarea', value: item?.description || '', rows: 3, full: true }
  ];
  const result = await uiForm({ title: item ? `Edytuj podgrupę · ${group.name}` : `Dodaj podgrupę · ${group.name}`, submitLabel: item ? 'Zapisz podgrupę' : 'Dodaj podgrupę', fields });
  if (!result) return;
  try { await api(`/api/status-groups/${group.id}/subgroups` + (item ? `/${item.id}` : ''), { method: item ? 'PATCH' : 'POST', body: JSON.stringify(result) }); toast('Podgrupa została zapisana'); await loadData(true); }
  catch (error) { toast(error.message, true); }
}

async function editStatusColumn(groupId, subgroupId = null, id = null, requestedRole = null) {
  const group = statusGroups().find(item => item.id === Number(groupId)); const subgroup = group?.subgroups?.find(item => item.id === Number(subgroupId));
  const columns = subgroup ? subgroup.own_columns || subgroup.columns || [] : group?.own_columns || group?.columns || []; const item = columns.find(column => column.id === Number(id));
  if (!group) return;
  const columnRole = item ? statusColumnRole(item) : requestedRole === 'basic' ? 'basic' : 'subpoint';
  const fieldType = columnRole === 'basic' ? 'text' : item?.field_type || 'status';
  const formPromise = uiForm({ title: item ? `Edytuj ${columnRole === 'subpoint' ? 'podpunkt statusowy' : 'kolumnę podstawową'}` : `Dodaj ${columnRole === 'subpoint' ? 'podpunkt statusowy' : 'kolumnę podstawową'}`, description: `${group.name}${subgroup ? ` → ${subgroup.name}` : ' → punkty grupy'}`, submitLabel: item ? 'Zapisz' : 'Dodaj', fields: [
    { name: 'name', label: 'Nazwa kolumny', value: item?.name || '', required: true },
    { name: 'description', label: 'Opis dla pracownika', type: 'textarea', rows: 3, value: item?.description || '', hint: 'Opis pojawi się po dłuższym najechaniu na nagłówek w tabeli.', full: true },
    ...(columnRole === 'subpoint' ? [
      { name: 'field_type', label: 'Rodzaj podpunktu', type: 'select', value: fieldType, options: [{ value: 'status', label: 'Status — wybór symbolu workflow' }, { value: 'text', label: 'Pole tekstowe — dowolna wartość' }], full: true, className: 'status-subpoint-type' },
      { name: 'include_in_progress', label: 'Uwzględniaj podpunkt w procencie realizacji', type: 'checkbox', value: item ? Number(item.include_in_progress) : 1, full: true, className: 'status-subpoint-progress' }
    ] : [])
  ] });
  if (columnRole === 'subpoint') {
    const typeSelect = $('#action-fields [name="field_type"]');
    const progressField = $('#action-fields .status-subpoint-progress');
    const syncProgress = () => { progressField.hidden = typeSelect.value !== 'status'; };
    typeSelect.addEventListener('change', syncProgress); syncProgress();
  }
  const result = await formPromise;
  if (!result) return;
  result.column_role = columnRole;
  if (columnRole === 'basic') result.field_type = 'text';
  if (result.field_type === 'text') result.include_in_progress = 0;
  const base = `/api/status-groups/${group.id}${subgroup ? `/subgroups/${subgroup.id}` : ''}/columns`;
  try { await api(base + (item ? `/${item.id}` : ''), { method: item ? 'PATCH' : 'POST', body: JSON.stringify(result) }); toast('Kolumna została zapisana'); await loadData(true); }
  catch (error) { toast(error.message, true); }
}

async function saveSetting(key, value) {
  await api(`/api/settings/${key}`, { method: 'PATCH', body: JSON.stringify({ value }) });
  toast('Ustawienie zapisane');
  await loadData();
}

const formDefinitions = {
  status: { endpoint: '/api/status', title: 'punkt statusu', fields: [
    ['hierarchy_target', 'Zakres w hierarchii projektu', 'hierarchy-target'], ['status_group_id', 'Grupa tabeli statusowej', 'status-group'], ['status_subgroup_id', 'Podgrupa tabeli statusowej', 'status-subgroup'],
    ['matrix_values', 'Dane punktu statusowego', 'status-matrix'], ['function_group_id', 'Grupa funkcyjna', 'function-group'], ['function_group_subcategory_id', 'Podkategoria grupy funkcyjnej', 'function-subcategory'], ['function_group_element_id', 'Obiekt / element grupy', 'function-element'],
    ['criticality', 'Krytyczność', 'select', PRIORITY_DEFINITIONS], ['responsible_user_ids', 'Osoby odpowiedzialne', 'users'], ['dependency_refs', 'Zależności — elementy wymagane wcześniej', 'dependencies'],
    ['requirement_ids', 'Zapotrzebowanie', 'requirements'], ['current_note', 'Aktualna notatka', 'textarea'], ['evidence_link', 'Dodatkowe informacje / link'], ['links', 'Powiązane elementy', 'multi-links', ['task', 'point', 'note', 'goal']]
  ] },
  tasks: { endpoint: '/api/tasks', title: 'zadanie', fields: [
    ['hierarchy_target', 'Zakres w hierarchii projektu', 'hierarchy-target'], ['title', 'Tytuł', 'wide-text'], ['description', 'Opis', 'textarea'], ['images', 'Zdjęcia', 'task-images'], ['info_link', 'Dodatkowe informacje / link', 'wide-text'],
    ['direct_assignee_user_ids', 'Odpowiedzialni', 'users'], ['dependency_refs', 'Zależności — elementy wymagane wcześniej', 'dependencies'], ['checklist', 'Lista kontrolna', 'checklist'], ['scope_checklist', 'Kontrola sterowników w zakresie', 'scope-checklist'],
    ['function_group_id', 'Grupa funkcyjna', 'function-group'], ['function_group_element_id', 'Element grupy funkcyjnej', 'function-element'], ['other_object', 'Inne (gdy nie dotyczy grupy)'],
    ['status', 'Status', 'select', statusDefinitions('task')], ['priority', 'Priorytet', 'select', PRIORITY_DEFINITIONS],
    ['start_date', 'Planowany start', 'date'], ['due_date', 'Deadline', 'date'],
    ['recurrence_enabled', 'Zadanie cykliczne', 'boolean'], ['recurrence_interval', 'Odstęp cyklu', 'number'], ['recurrence_unit', 'Jednostka cyklu', 'select', [{ value: 'days', label: 'Dni' }, { value: 'weeks', label: 'Tygodnie' }, { value: 'months', label: 'Miesiące' }]],
    ['category', 'Kategoria zadania', 'category', 'task'], ['subcategory', 'Podkategoria zadania', 'subcategory', 'task'], ['requirement_ids', 'Zapotrzebowanie', 'requirements'],
    ['links', 'Powiązane elementy', 'multi-links', ['status', 'point', 'note']]
  ] },
  points: { endpoint: '/api/open-points', title: 'otwarty punkt', fields: [
    ['hierarchy_target', 'Zakres w hierarchii projektu', 'hierarchy-target'], ['title', 'Temat'], ['owner_user_id', 'Odpowiedzialny', 'user'],
    ['status', 'Status', 'select', statusDefinitions('point')], ['priority', 'Priorytet', 'select', PRIORITY_DEFINITIONS], ['dependency_refs', 'Zależności — elementy wymagane wcześniej', 'dependencies'],
    ['start_date', 'Planowany start', 'date'], ['due_date', 'Deadline', 'date'], ['reminder_date', 'Przypomnienie', 'date'],
    ['category', 'Kategoria', 'category', 'status'], ['subcategory', 'Podkategoria', 'subcategory', 'status'], ['waiting_for', 'Oczekiwanie na', 'options', 'waiting_for'], ['requirement_ids', 'Zapotrzebowanie', 'requirements'],
    ['links', 'Powiązane elementy', 'multi-links', ['status', 'task', 'point', 'note']], ['info_link', 'Dodatkowe informacje / link'],
    ['impact', 'Wpływ', 'textarea'], ['next_action', 'Następny krok', 'textarea'], ['description', 'Opis techniczny', 'textarea'], ['mentioned_user_ids', 'Wspomniane osoby', 'mentions']
  ] },
  notes: { endpoint: '/api/daily-notes', title: 'notatkę', fields: [
    ['hierarchy_target', 'Zakres projektu / obszar / sterownik', 'note-hierarchy-target'], ['note_date', 'Data wpisu', 'date'], ['shift', 'Zmiana', 'options', 'shift'], ['type', 'Typ wpisu', 'options', 'note_type'],
    ['content', 'Treść', 'bigtextarea'], ['links', 'Powiązane elementy', 'multi-links', ['status', 'task', 'point']], ['mentioned_user_ids', 'Wspomniane osoby', 'mentions']
  ] },
  goals: { endpoint: '/api/goals', title: 'kamień milowy', fields: [
    ['hierarchy_target', 'Zakres w hierarchii projektu', 'hierarchy-target'], ['title', 'Nazwa kamienia milowego'], ['status', 'Status', 'select', statusDefinitions('goal')], ['priority', 'Priorytet', 'select', PRIORITY_DEFINITIONS], ['due_date', 'Termin', 'date'], ['description', 'Opis rezultatu', 'textarea'], ['goal_links', 'Powiązane elementy', 'goal-links']
  ] },
  announcements: { endpoint: '/api/announcements', title: 'wiadomość', fields: [
    ['entry_type', 'Rodzaj wpisu', 'select', [{ value: 'message', label: 'Komunikat' }, { value: 'decision', label: 'Decyzja projektowa' }, { value: 'scope_change', label: 'Zmiana zakresu' }]], ['decision_status', 'Stan decyzji / zmiany', 'select', [{ value: 'draft', label: 'Szkic' }, { value: 'published', label: 'Opublikowana' }, { value: 'implemented', label: 'Wdrożona' }, { value: 'superseded', label: 'Zastąpiona' }]],
    ['title', 'Tytuł', 'wide-text'], ['importance', 'Poziom ważności', 'options', 'announcement_importance'], ['label_ids', 'Etykiety', 'announcement-labels'], ['content', 'Treść', 'bigtextarea'], ['rationale', 'Uzasadnienie / wpływ na zakres', 'textarea'], ['effective_date', 'Obowiązuje od', 'date'], ['info_link', 'Link', 'wide-text'],
    ['scope_group_ids', 'Zakres projektu', 'announcement-scopes'], ['recipient_user_ids', 'Osoby, których wiadomość bezpośrednio dotyczy', 'announcement-users'],
    ['links', 'Przypięte elementy', 'multi-links', ['status', 'task', 'point', 'note', 'goal']]
  ] },
  global_users: { endpoint: '/api/users', title: 'konto użytkownika', fields: [
    ['username', 'Login'], ['display_name', 'Imię i nazwisko'], ['password', 'Nowe hasło (pozostaw puste bez zmiany)', 'password'], ['system_role', 'Rola systemowa', 'select', [{ value: 'user', label: 'Konto projektowe' }, { value: 'system_admin', label: 'Administrator systemu' }]], ['active', 'Konto globalnie aktywne', 'boolean']
  ] },
  controllers: { endpoint: '/api/controllers', title: 'sterownik', fields: [['leaf_code', 'Nazwa / kod sterownika'], ['group_id', 'Grupa w hierarchii', 'controller-group'], ['area', 'Obszar'], ['description', 'Opis', 'textarea']] }
};

function recordControlState(root) {
  return [...root.querySelectorAll('input,select,textarea')].map(control => ({
    value: control.value,
    checked: control.checked,
    selected: control instanceof HTMLSelectElement && control.multiple ? [...control.selectedOptions].map(option => option.value) : null
  }));
}

function applyRecordControlState(root, values = []) {
  [...root.querySelectorAll('input,select,textarea')].forEach((control, index) => {
    const saved = values[index]; if (!saved) return;
    if (control instanceof HTMLSelectElement && control.multiple && saved.selected) [...control.options].forEach(option => { option.selected = saved.selected.includes(option.value); });
    else if (control.type === 'checkbox' || control.type === 'radio') control.checked = Boolean(saved.checked);
    else control.value = saved.value;
  });
}

function recordButtonState(id) {
  const button = $(id); return { hidden: button.hidden, disabled: button.disabled, text: button.textContent, className: button.className };
}

function applyRecordButtonState(id, saved) {
  const button = $(id); if (!button || !saved) return;
  button.hidden = saved.hidden; button.disabled = saved.disabled; button.textContent = saved.text; button.className = saved.className;
}

function captureRecordDialog() {
  const fields = $('#fields');
  return {
    dialog: structuredClone(state.dialog),
    goalDraftLinks: structuredClone(state.goalDraftLinks),
    linkDraft: structuredClone(state.linkDraft),
    fieldsHtml: fields.innerHTML,
    controls: recordControlState(fields),
    title: $('#modal-title').textContent,
    subtitle: $('#modal-subtitle').textContent,
    metaHtml: $('#record-meta').innerHTML,
    similarClass: $('#similar-history-section').className,
    similarCount: $('#similar-history-count').textContent,
    similarHtml: $('#similar-history-list').innerHTML,
    commentsClass: $('#comments-section').className,
    commentsCount: $('#comments-count').textContent,
    commentsHtml: $('#comments-list').innerHTML,
    commentContent: $('#comment-content').value,
    auditToggle: recordButtonState('#audit-toggle'),
    auditClass: $('#audit-section').className,
    auditHtml: $('#audit-list').innerHTML,
    buttons: Object.fromEntries(['#remove', '#skip-recurrence', '#duplicate', '#watch-record', '#mute-record', '#lock-record', '#cancel', '#edit-record', '#record-save'].map(id => [id, recordButtonState(id)])),
    fieldsClass: fields.className,
    dirty: $('#modal').dataset.dirty || '',
    scrollTop: $('#modal').scrollTop
  };
}

function updateRecordBackButton() {
  const button = $('#record-back');
  button.hidden = !state.dialogStack.length;
  button.setAttribute('aria-label', state.dialogStack.length ? 'Wróć do poprzedniego elementu' : 'Brak poprzedniego elementu');
}

function restoreRecordDialog() {
  const saved = state.dialogStack.pop();
  if (!saved) return $('#modal').close();
  state.dialog = saved.dialog;
  state.goalDraftLinks = saved.goalDraftLinks;
  state.linkDraft = saved.linkDraft;
  $('#modal-title').textContent = saved.title;
  $('#modal-subtitle').textContent = saved.subtitle;
  $('#record-meta').innerHTML = saved.metaHtml;
  $('#fields').innerHTML = saved.fieldsHtml;
  $('#fields').className = saved.fieldsClass;
  applyRecordControlState($('#fields'), saved.controls);
  $('#similar-history-section').className = saved.similarClass;
  $('#similar-history-count').textContent = saved.similarCount;
  $('#similar-history-list').innerHTML = saved.similarHtml;
  $('#comments-section').className = saved.commentsClass;
  $('#comments-count').textContent = saved.commentsCount;
  $('#comments-list').innerHTML = saved.commentsHtml;
  $('#comment-content').value = saved.commentContent;
  applyRecordButtonState('#audit-toggle', saved.auditToggle);
  $('#audit-section').className = saved.auditClass;
  $('#audit-list').innerHTML = saved.auditHtml;
  Object.entries(saved.buttons).forEach(([id, button]) => applyRecordButtonState(id, button));
  bindDynamicFields(state.dialog.type);
  applyRecordControlState($('#fields'), saved.controls);
  $('#modal').dataset.dirty = saved.dirty;
  $('#modal').scrollTop = saved.scrollTop;
  updateRecordBackButton();
}

function closeOrReturnRecordDialog() {
  if (state.dialogStack.length) restoreRecordDialog();
  else $('#modal').close();
}

async function finishRecordMutation() {
  const returnToSource = state.dialogStack.length > 0;
  if (!returnToSource) $('#modal').close();
  await loadData();
  if (returnToSource) restoreRecordDialog();
}

async function openRecord(type, record = null, prefill = null, duplicateSource = null, replaceCurrent = false) {
  const definition = formDefinitions[type];
  if (!definition) return;
  const parentDialog = !replaceCurrent && $('#modal').open && state.dialog ? captureRecordDialog() : null;
  let source = record || prefill || null;
  if (type === 'tasks' && record?.id) {
    try { record.images = await api(`/api/tasks/${record.id}/images`); }
    catch (error) { record.images = []; toast(`Nie udało się pobrać zdjęć: ${error.message}`, true); }
    source = record;
  } else if (type === 'tasks' && duplicateSource) source = { ...(source || {}), images: [] };
  if (type === 'goals') {
    try {
      const [status, task, point] = await Promise.all([api('/api/status?controller=all'), api('/api/tasks?controller=all'), api('/api/open-points?controller=all')]);
      state.goalPickerCollections = { status, task, point };
    } catch { state.goalPickerCollections = { status: state.status, task: state.tasks, point: state.points }; }
  }
  if (['status', 'tasks', 'points'].includes(type)) {
    try {
      const [status, task, point] = await Promise.all([api('/api/status?controller=all'), api('/api/tasks?controller=all'), api('/api/open-points?controller=all')]);
      state.dependencyOptions = { status, task, point };
      state.taskDependencyOptions = task;
      state.dependencyOptionsAll = true;
    } catch {
      state.dependencyOptions = { status: state.status, task: state.tasks, point: state.points };
      state.taskDependencyOptions = state.tasks;
      state.dependencyOptionsAll = state.controller === 'all';
    }
  }
  const lockable = Boolean(record && ['status', 'tasks', 'points', 'goals'].includes(type));
  if (parentDialog) state.dialogStack.push(parentDialog);
  state.dialog = {
    type, record, prefill, duplicateSource, auditLoaded: false, editing: !lockable, commentAdded: false, notificationMode: 'default',
    taskImages: type === 'tasks' ? [...(source?.images || [])] : [], pendingTaskImages: []
  };
  state.goalDraftLinks = source?.links ? source.links.map(link => ({ entity_type: link.entity_type, entity_id: Number(link.entity_id) })) : [];
  state.linkDraft = source?.links ? source.links.map(link => ({ entity_type: link.entity_type, entity_id: Number(link.entity_id) })) : [];
  renderRecordDialogHeader();
  const configDelete = Boolean(record && state.me.role === 'system_admin' && ['controllers', 'global_users'].includes(type) && !(type === 'global_users' && record.id === state.me.id));
  $('#remove').hidden = !(record?.can_delete || configDelete);
  $('#duplicate').hidden = !(record && ['status', 'tasks', 'points', 'goals'].includes(type));
  $('#skip-recurrence').hidden = !(type === 'tasks' && record && Number(record.recurrence_interval || 0) > 0 && record.status !== 'Done');
  $('#audit-toggle').hidden = !(record && ['status', 'tasks', 'points', 'goals'].includes(type));
  $('#audit-toggle').textContent = 'Pokaż wspólną oś czasu';
  $('#audit-section').classList.add('hidden');
  $('#audit-list').innerHTML = '';
  const commentable = Boolean(record && ['status', 'tasks', 'points', 'goals'].includes(type));
  $('#comments-section').classList.toggle('hidden', !commentable);
  $('#comment-content').value = '';
  $('#comment-mention-suggestions').classList.add('hidden');
  if (commentable) renderEntityComments(record.comments || []);
  resetSimilarHistory();
  const visibleFields = type === 'status' && record
    ? definition.fields.filter(field => !['hierarchy_target', 'status_group_id', 'status_subgroup_id'].includes(field[0]))
    : definition.fields;
  $('#fields').innerHTML = visibleFields.map(field => fieldHtml(field, source, type)).join('');
  bindDynamicFields(type);
  if (!$('#modal').open) $('#modal').showModal();
  setRecordDialogMode(state.dialog.editing);
  $('#modal').dataset.dirty = '';
  updateRecordBackButton();
  if (commentable) await loadRecordNotificationPreference();
  if (!record && ['tasks', 'points'].includes(type)) bindSimilarHistorySearch(typeToEntity(type));
}

function renderRecordDialogHeader() {
  const dialog = state.dialog; if (!dialog) return;
  const { type, record, duplicateSource, editing } = dialog; const definition = formDefinitions[type];
  $('#modal-title').textContent = `${record ? editing ? 'Edytuj' : 'Podgląd' : duplicateSource ? 'Duplikuj' : 'Dodaj'} ${definition.title}`;
  $('#modal-subtitle').textContent = record ? editing ? 'Tryb edycji. Zapisz zmiany po zakończeniu.' : 'Tryb odczytu. Użyj przycisku „Edytuj”, aby zmienić pola.' : duplicateSource ? 'Zmień co najmniej jedno pole. Kopia 1:1 nie zostanie zapisana.' : 'Uzupełnij informacje potrzebne zespołowi. Pola oznaczone kolorem są wymagane.';
  const lock = record?.edit_lock;
  const statusScope = type === 'status' && record ? (() => {
    const group = statusGroups().find(item => Number(item.id) === Number(record.status_group_id));
    const subgroup = group?.subgroups?.find(item => Number(item.id) === Number(record.status_subgroup_id));
    return `<div class="record-scope-summary"><span><small>Zakres hierarchii</small><b>${escapeHtml(controllerLabel(record) || 'Bez zakresu')}</b></span><span><small>Grupa tabeli statusowej</small><b>${escapeHtml(record.status_group_name || group?.name || 'Nieprzypisana')}</b></span><span><small>Podgrupa tabeli statusowej</small><b>${escapeHtml(record.status_subgroup_name || subgroup?.name || 'Punkty bezpośrednio w grupie')}</b></span></div>`;
  })() : '';
  $('#record-meta').innerHTML = record ? `${statusScope}<span>Utworzone przez: <b>${escapeHtml(record.created_by_name || record.author || 'dane historyczne')}</b></span><span>Data utworzenia: <b>${displayDateTime(record.created_at)}</b></span><span>Ostatnia aktualizacja: <b>${displayDateTime(record.updated_at)}</b></span>${lock ? `<span class="record-lock-banner">Zablokowany przed edycją przez: <b>${escapeHtml(lock.locked_by_name)}</b>; Powód: <b>${escapeHtml(lock.reason)}</b></span>` : ''}` : '<span>Autor zostanie przypisany automatycznie po zapisaniu.</span>';
}

function setRecordDialogMode(editing) {
  const dialog = state.dialog; if (!dialog) return;
  const lockable = Boolean(dialog.record && ['status', 'tasks', 'points', 'goals'].includes(dialog.type));
  if (editing && dialog.record?.edit_locked && !dialog.record?.can_override_edit_lock) return toast(`Edycja jest zablokowana przez ${dialog.record.edit_lock?.locked_by_name || 'managera'}.`, true);
  dialog.editing = Boolean(editing || !lockable);
  $('#fields').classList.toggle('record-readonly', !dialog.editing);
  $$('#fields input, #fields select, #fields textarea, #fields button').forEach(control => { control.disabled = !dialog.editing; });
  $('#record-save').disabled = !dialog.editing;
  $('#edit-record').hidden = !lockable || dialog.editing;
  $('#remove').disabled = lockable && !dialog.editing;
  $('#duplicate').disabled = false;
  $('#skip-recurrence').disabled = false;
  renderRecordNotificationPreference();
  const canLock = lockable && canCoordinate();
  $('#lock-record').hidden = !canLock;
  $('#lock-record').textContent = dialog.record?.edit_locked ? 'Odblokuj edycję' : 'Zablokuj edycję';
  renderRecordDialogHeader();
}

function renderRecordNotificationPreference() {
  const dialog = state.dialog; const supported = Boolean(dialog?.record && ['status', 'tasks', 'points', 'goals'].includes(dialog.type));
  const watch = $('#watch-record'); const mute = $('#mute-record');
  watch.hidden = !supported; mute.hidden = !supported;
  if (!supported) return;
  watch.textContent = dialog.notificationMode === 'watching' ? '✓ Obserwujesz' : 'Obserwuj';
  mute.textContent = dialog.notificationMode === 'muted' ? '✓ Wyciszono' : 'Wycisz';
  watch.classList.toggle('active-toggle', dialog.notificationMode === 'watching');
  mute.classList.toggle('active-toggle', dialog.notificationMode === 'muted');
}

async function loadRecordNotificationPreference() {
  const dialog = state.dialog; const entityType = typeToEntity(dialog?.type);
  if (!dialog?.record || !entityType || !['status', 'task', 'point', 'goal'].includes(entityType)) return;
  try {
    const preference = await api(`/api/entity-notification-preferences/${entityType}/${dialog.record.id}`);
    if (state.dialog === dialog) { dialog.notificationMode = preference.mode || 'default'; renderRecordNotificationPreference(); }
  } catch { /* brak preferencji nie blokuje podglądu */ }
}

async function setRecordNotificationPreference(mode) {
  const dialog = state.dialog; const entityType = typeToEntity(dialog?.type);
  if (!dialog?.record || !entityType) return;
  try {
    const preference = await api(`/api/entity-notification-preferences/${entityType}/${dialog.record.id}`, { method: 'PUT', body: JSON.stringify({ mode }) });
    dialog.notificationMode = preference.mode || 'default'; renderRecordNotificationPreference();
    toast(dialog.notificationMode === 'watching' ? 'Element jest obserwowany' : dialog.notificationMode === 'muted' ? 'Powiadomienia dla elementu wyciszono' : 'Przywrócono domyślne powiadomienia');
  } catch (error) { toast(error.message, true); }
}

async function toggleRecordEditLock() {
  const dialog = state.dialog; const entityType = typeToEntity(dialog?.type);
  if (!dialog?.record || !entityType || !canCoordinate()) return;
  try {
    let lockState;
    if (dialog.record.edit_locked) {
      lockState = await api(`/api/entity-locks/${entityType}/${dialog.record.id}`, { method: 'DELETE' });
      toast('Odblokowano edycję elementu');
    } else {
      const result = await uiForm({ title: 'Zablokuj element przed edycją', description: 'Użytkownicy zobaczą autora blokady i podany powód. Manager może później odblokować element.', submitLabel: 'Zablokuj edycję', fields: [{ name: 'reason', label: 'Powód blokady', type: 'textarea', rows: 4, required: true, full: true }] });
      if (!result) return;
      lockState = await api(`/api/entity-locks/${entityType}/${dialog.record.id}`, { method: 'POST', body: JSON.stringify({ reason: result.reason }) });
      toast('Zablokowano edycję elementu');
    }
    Object.assign(dialog.record, lockState);
    setRecordDialogMode(false);
    await loadData(true);
  } catch (error) { toast(error.message, true); }
}

function resetSimilarHistory() {
  $('#similar-history-section').classList.add('hidden');
  $('#similar-history-count').textContent = '';
  $('#similar-history-list').innerHTML = '';
}

async function loadSimilarHistory(entityType, query) {
  try {
    const rows = await api(`/api/similar-history?type=${encodeURIComponent(entityType)}&q=${encodeURIComponent(query)}`);
    if (typeToEntity(state.dialog?.type) !== entityType) return;
    if (!rows.length) return resetSimilarHistory();
    $('#similar-history-count').textContent = `${rows.length} ${rows.length === 1 ? 'podpowiedź' : 'podpowiedzi'}`;
    $('#similar-history-list').innerHTML = rows.map(item => `<details class="similar-history-row">
      <summary><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml([item.entity_type === 'task' ? 'Zadanie' : 'Otwarty punkt', item.scope_label, item.category, displayDate(item.updated_at)].filter(Boolean).join(' · '))}</small></span><strong>${Number(item.similarity || 0)}% zgodności</strong></summary>
      <div><p>${escapeHtml(item.outcome || 'Brak dodatkowego opisu rezultatu.').replace(/\n/g, '<br>')}</p></div>
    </details>`).join('');
    $('#similar-history-section').classList.remove('hidden');
  } catch {
    resetSimilarHistory();
  }
}

function bindSimilarHistorySearch(entityType) {
  const fields = ['#form-title', '#fields [name="description"]', '#fields [name="impact"]', '#fields [name="next_action"]'].map(selector => $(selector)).filter(Boolean);
  if (!fields.length) return;
  let timer;
  const refresh = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const query = fields.map(field => field.value.trim()).filter(Boolean).join(' ');
      if (query.length < 4) return resetSimilarHistory();
      void loadSimilarHistory(entityType, query);
    }, 280);
  };
  fields.forEach(field => field.addEventListener('input', refresh));
  refresh();
}

function typeToEntity(type) { return ({ status: 'status', tasks: 'task', points: 'point', notes: 'note', goals: 'goal' })[type]; }

function highlightedComment(content, mentions = []) {
  const tokens = [...new Set(mentions.flatMap(user => [`@${user.display_name}`, `@${user.username}`]).filter(token => token.length > 1))].sort((a, b) => b.length - a.length);
  if (!tokens.length) return escapeHtml(content).replace(/\n/g, '<br>');
  const source = String(content || ''); const lower = source.toLocaleLowerCase('pl-PL'); let cursor = 0; let html = '';
  while (cursor < source.length) {
    let best = null;
    for (const token of tokens) {
      const index = lower.indexOf(token.toLocaleLowerCase('pl-PL'), cursor);
      if (index >= 0 && (!best || index < best.index || (index === best.index && token.length > best.token.length))) best = { index, token };
    }
    if (!best) { html += escapeHtml(source.slice(cursor)); break; }
    html += escapeHtml(source.slice(cursor, best.index));
    html += `<mark class="comment-mention">${escapeHtml(source.slice(best.index, best.index + best.token.length))}</mark>`;
    cursor = best.index + best.token.length;
  }
  return html.replace(/\n/g, '<br>');
}

function renderEntityComments(comments = []) {
  $('#comments-count').textContent = `${comments.length} ${comments.length === 1 ? 'komentarz' : 'komentarzy'}`;
  $('#comments-list').innerHTML = comments.map(item => `<article class="entity-comment"><header><b>${escapeHtml(item.user_name || 'Użytkownik')}</b><time>${displayDateTime(item.created_at)}</time></header><p>${highlightedComment(item.content, item.mentions || [])}</p></article>`).join('') || '<div class="empty compact-empty">Brak komentarzy. Możesz dodać pierwszą aktualizację.</div>';
}

function renderCommentMentionSuggestions() {
  const input = $('#comment-content'); const container = $('#comment-mention-suggestions');
  const position = input.selectionStart ?? input.value.length; const before = input.value.slice(0, position); const at = before.lastIndexOf('@');
  if (at < 0 || before.slice(at + 1).includes('\n')) { container.classList.add('hidden'); return; }
  const query = before.slice(at + 1).toLocaleLowerCase('pl-PL');
  const users = (state.users || []).filter(user => Number(user.active) !== 0 && (`${user.display_name} ${user.username}`).toLocaleLowerCase('pl-PL').includes(query)).slice(0, 6);
  if (!users.length) { container.classList.add('hidden'); return; }
  container.innerHTML = users.map(user => `<button type="button" data-comment-mention="${user.id}"><b>${escapeHtml(user.display_name)}</b><small>@${escapeHtml(user.username || '')}</small></button>`).join('');
  container.classList.remove('hidden');
  $$('[data-comment-mention]').forEach(button => button.addEventListener('click', () => {
    const user = state.users.find(item => Number(item.id) === Number(button.dataset.commentMention)); if (!user) return;
    const end = input.selectionStart ?? input.value.length; const start = input.value.slice(0, end).lastIndexOf('@');
    input.value = `${input.value.slice(0, start)}@${user.display_name} ${input.value.slice(end)}`;
    input.focus(); input.selectionStart = input.selectionEnd = start + user.display_name.length + 2;
    container.classList.add('hidden');
  }));
}

async function addEntityComment() {
  const dialog = state.dialog;
  const content = $('#comment-content').value.trim();
  const entityType = typeToEntity(dialog?.type);
  if (!dialog?.record || !entityType) return;
  if (!content) return toast('Wpisz treść komentarza', true);
  const button = $('#comment-add'); button.disabled = true;
  try {
    const comment = await api('/api/comments', { method: 'POST', body: JSON.stringify({ entity_type: entityType, entity_id: dialog.record.id, content }) });
    if (comment.entity_updated_at) dialog.record.updated_at = comment.entity_updated_at;
    dialog.record.comments ||= [];
    dialog.record.comments.push(comment);
    dialog.commentAdded = true;
    if (entityType === 'status') {
      const statusItem = state.status.find(item => Number(item.id) === Number(dialog.record.id));
      if (statusItem) {
        statusItem.updated_at = comment.entity_updated_at || statusItem.updated_at;
        statusItem.progress_updated_at = comment.progress_updated_at || comment.created_at;
        statusItem.progress_updated_by_name = comment.user_name || state.me.display_name;
        statusItem.comments ||= [];
        if (!statusItem.comments.some(item => Number(item.id) === Number(comment.id))) statusItem.comments.push(comment);
        if (state.view === 'status' && state.statusMode === 'list') drawStatusRows();
      }
    }
    renderEntityComments(dialog.record.comments);
    $('#comment-content').value = '';
    $('#modal').dataset.dirty = '';
    if (dialog.auditLoaded) await loadTimeline(entityType, dialog.record.id);
    toast('Komentarz został dodany jako aktualizacja');
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

async function toggleAudit() {
  const dialog = state.dialog;
  if (!dialog?.record) return;
  const section = $('#audit-section');
  if (!section.classList.contains('hidden')) {
    section.classList.add('hidden');
    $('#audit-toggle').textContent = 'Pokaż wspólną oś czasu';
    return;
  }
  section.classList.remove('hidden');
  $('#audit-toggle').textContent = 'Ukryj wspólną oś czasu';
  if (!dialog.auditLoaded) {
    $('#audit-list').innerHTML = '<div class="loading">Ładowanie osi czasu…</div>';
    try { await loadTimeline(typeToEntity(dialog.type), dialog.record.id); dialog.auditLoaded = true; }
    catch (error) { $('#audit-list').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
  }
}

async function openDuplicate(type, record) {
  if (!record || !['status', 'tasks', 'points', 'goals'].includes(type)) return;
  const clone = structuredClone(record);
  await openRecord(type, null, clone, record);
}

function defaultValue(name) {
  if (name === 'entry_type') return 'message';
  if (name === 'decision_status') return 'published';
  if (name === 'hierarchy_target') {
    if (state.controller === 'all') return `controller:${state.controllers[0]?.code || ''}`;
    return state.controller.startsWith('group:') ? state.controller : `controller:${state.controller}`;
  }
  if (name === 'controller') {
    if (state.controllers.some(item => item.code === state.controller)) return state.controller;
    if (state.controller.startsWith('group:')) {
      const rootId = Number(state.controller.slice(6));
      const groupIds = new Set([rootId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const group of state.controllerGroups) {
          if (groupIds.has(Number(group.parent_id)) && !groupIds.has(group.id)) { groupIds.add(group.id); changed = true; }
        }
      }
      return state.controllers.find(item => groupIds.has(Number(item.group_id)))?.code || state.controllers[0]?.code || '';
    }
    return state.controllers[0]?.code || '';
  }
  if (name === 'note_date') return today();
  if (name === 'recurrence_enabled') return 0;
  if (name === 'recurrence_interval') return 1;
  if (name === 'recurrence_unit') return 'days';
  if (name === 'active' || name === 'project_active' || name === 'planner_enabled' || name === 'assignable') return 1;
  if (name === 'can_manage_external_dependencies') return 0;
  return '';
}

function requiredRecordField(formType, name, record) {
  const fields = {
    status: ['hierarchy_target', 'status_group_id'], tasks: ['hierarchy_target', 'title', 'status'],
    points: ['hierarchy_target', 'title', 'status'], goals: ['hierarchy_target', 'title', 'status'], announcements: ['title', 'content'],
    users: ['username', 'display_name'], controllers: ['leaf_code']
  };
  return (fields[formType] || []).includes(name) || (formType === 'users' && name === 'password' && !record?.id);
}

function statusEditorColumns(groupId, subgroupId) {
  const group = statusGroups().find(item => Number(item.id) === Number(groupId));
  if (!group) return [];
  if (subgroupId) return group.subgroups?.find(item => Number(item.id) === Number(subgroupId))?.columns || [];
  return group.columns || [];
}

function statusMatrixEditorField(record, groupId = record?.status_group_id, subgroupId = record?.status_subgroup_id) {
  const columns = statusEditorColumns(groupId, subgroupId);
  const basic = columns.filter(column => statusColumnRole(column) === 'basic');
  const subpoints = columns.filter(column => statusColumnRole(column) === 'subpoint');
  const workflowSubpoints = subpoints.filter(column => column.field_type === 'status');
  const value = column => record?.matrix_values?.[column.id] ?? (column.field_type === 'status' ? record?.status || 'Never checked' : '');
  const basicHtml = basic.map(column => `<label class="field" title="${escapeHtml(column.description || '')}"><span>${escapeHtml(column.name)}</span><input type="text" data-matrix-value data-column="${column.id}" data-column-type="text" value="${escapeHtml(value(column))}"></label>`).join('');
  const subpointsHtml = subpoints.map(column => column.field_type === 'status'
    ? `<label class="status-subpoint-field" title="${escapeHtml(column.description || '')}"><span>${statusSymbol(value(column))}<b>${escapeHtml(column.name)}</b></span><select data-matrix-value data-column="${column.id}" data-column-type="status">${selectOptions(statusWorkflowOptions(value(column)), value(column), null)}</select></label>`
    : `<label class="status-subpoint-field text" title="${escapeHtml(column.description || '')}"><span><i class="status-text-marker">Aa</i><b>${escapeHtml(column.name)}</b></span><input type="text" data-matrix-value data-column="${column.id}" data-column-type="text" value="${escapeHtml(value(column))}"></label>`).join('');
  const scope = statusGroups().find(item => Number(item.id) === Number(groupId));
  const scopeName = [scope?.name, scope?.subgroups?.find(item => Number(item.id) === Number(subgroupId))?.name].filter(Boolean).join(' → ');
  return `<section class="field full status-item-matrix-editor" id="status-item-matrix-editor"><header><span><b>Dane punktu statusowego</b><small>${scopeName ? `${escapeHtml(scopeName)} · ` : ''}Kolumny podstawowe opisują element, a każdy podpunkt przechowuje własną wartość.</small></span></header>${columns.length ? `${basic.length ? `<div class="status-basic-fields"><h4>Kolumny podstawowe</h4><div>${basicHtml}</div></div>` : ''}${subpoints.length ? `<div class="status-subpoint-fields"><div class="status-subpoint-heading"><h4>Podpunkty statusowe</h4>${workflowSubpoints.length ? statusSymbolLegend(true) : ''}</div><div>${subpointsHtml}</div></div>` : ''}` : '<div class="empty compact-empty">Ta grupa nie ma jeszcze zdefiniowanych kolumn podstawowych ani podpunktów statusowych.</div>'}</section>`;
}

function fieldHtml([name, label, type = 'text', extra], record, formType = '') {
  const value = name === 'recurrence_enabled' && record ? (Number(record.recurrence_interval || 0) > 0 ? 1 : 0) : record?.[name] ?? defaultValue(name);
  const required = requiredRecordField(formType, name, record);
  if (type === 'multi-links') return multiLinksField(extra);
  if (type === 'mentions') return mentionsField(record);
  if (type === 'requirements') return requirementsField(record, name, label);
  if (type === 'dependencies') return dependenciesField(record, typeToEntity(formType));
  if (type === 'status-matrix') return statusMatrixEditorField(record);
  if (type === 'hierarchy-target') {
    const selected = record?.controller_group_id ? `group:${record.controller_group_id}` : record?.hierarchy_target || (record?.controller ? `controller:${record.controller}` : value);
    return `<div class="field full hierarchy-target-field ${required ? 'required-field' : ''}"><label>${escapeHtml(label)}${required ? ' *' : ''}</label>${hierarchyTargetTreeHtml(selected)}</div>`;
  }
  if (type === 'checklist') return checklistField(record);
  if (type === 'scope-checklist') return scopeChecklistField(record);
  if (type === 'task-images') return taskImagesField();
  if (type === 'goal-links') return goalLinksField();
  if (type === 'announcement-scopes') {
    const selected = new Set((record?.scope_group_ids || []).map(Number));
    return `<div class="field full"><label>${escapeHtml(label)}</label><details class="multi-user-select"><summary>${selected.size ? `${selected.size} wybranych obszarów` : 'Cały projekt'}</summary><div class="mentions announcement-scope-grid"><input class="multi-choice-search" type="search" placeholder="Szukaj obszaru…">${state.controllerGroups.map(group => `<label class="mention hierarchy-option" style="--depth:${Math.max(0, Number(group.depth || 1) - 1)}"><input type="checkbox" name="scope_group_ids" value="${group.id}" ${selected.has(group.id) ? 'checked' : ''}>${escapeHtml(group.path_label || group.name)}</label>`).join('')}</div></details><small class="sub">Brak wyboru oznacza cały projekt. Nie wybieraj jednocześnie obszaru nadrzędnego i jego podobszaru.</small></div>`;
  }
  if (type === 'announcement-users') {
    const selected = new Set((record?.recipient_user_ids || []).map(Number));
    const users = assignableUsers([...selected]);
    return `<div class="field full"><label>${escapeHtml(label)}</label><details class="multi-user-select"><summary>${selected.size ? `${selected.size} wskazanych osób` : 'Bez wskazania konkretnych osób'}</summary><div class="mentions assignee-grid"><input class="multi-choice-search" type="search" placeholder="Szukaj osoby…">${users.map(user => `<label class="mention"><input type="checkbox" name="recipient_user_ids" value="${user.id}" ${selected.has(user.id) ? 'checked' : ''}>${escapeHtml(user.display_name)}</label>`).join('')}</div></details></div>`;
  }
  if (type === 'announcement-labels') {
    const selected = new Set((record?.label_ids || []).map(Number));
    return `<div class="field full"><label>${escapeHtml(label)}</label><div class="mentions announcement-label-picks">${(state.config.announcement_labels || []).map(item => `<label class="mention"><input type="checkbox" name="label_ids" value="${item.id}" ${selected.has(item.id) ? 'checked' : ''}><span class="announcement-label ${escapeHtml(item.color)}">${escapeHtml(item.name)}</span></label>`).join('') || '<span class="sub">Brak etykiet — dodaj je w Konfiguratorze.</span>'}</div></div>`;
  }
  let input;
  if (type === 'controller') input = `<select name="${name}" id="form-controller" ${required ? 'required' : ''}>${selectOptions(state.controllers.map(item => ({ value: item.code, label: item.display_name || item.code })), value)}</select>`;
  else if (type === 'note-hierarchy-target') {
    const selected = record?.controller_group_id ? `group:${record.controller_group_id}` : record?.controller ? `controller:${record.controller}` : (record?.hierarchy_target || (state.controller === 'all' ? 'all' : state.controller.startsWith('group:') ? state.controller : `controller:${state.controller}`));
    input = `<select name="${name}" id="form-note-hierarchy-target">${selectOptions([{ value: 'all', label: 'Cały projekt' }, ...taskHierarchyOptions()], selected, null)}</select>`;
  }
  else if (type === 'controller-group') input = `<select name="${name}">${selectOptions(hierarchyGroupOptions(), value, 'Bez grupy')}</select>`;
  else if (type === 'status-group') input = `<select name="${name}" id="form-status-group" ${required ? 'required' : ''}>${selectOptions(statusGroups().map(item => ({ value: item.id, label: item.name })), value, 'Wybierz grupę')}</select>`;
  else if (type === 'status-subgroup') {
    const groupId = record?.status_group_id || $('#form-status-group')?.value || '';
    input = `<select name="${name}" id="form-status-subgroup">${selectOptions(statusSubgroups(groupId).map(item => ({ value: item.id, label: item.name })), value, 'Punkty bezpośrednio w grupie')}</select>`;
  }
  else if (type === 'function-group') {
    const controllerCode = record?.controller || defaultValue('controller');
    input = `<select name="${name}" id="form-function-group">${selectOptions(functionGroups(controllerCode).map(item => ({ value: item.id, label: item.name })), value, 'Bez grupy funkcyjnej')}</select>`;
  }
  else if (type === 'function-element') {
    const group = (state.config.function_groups || []).find(item => item.id === Number(record?.function_group_id));
    input = `<select name="${name}" id="form-function-element">${selectOptions((group?.elements || []).map(item => ({ value: item.id, label: item.name })), value, 'Bez elementu')}</select>`;
  }
  else if (type === 'function-subcategory') {
    const group = (state.config.function_groups || []).find(item => item.id === Number(record?.function_group_id));
    input = `<select name="${name}" id="form-function-subcategory">${selectOptions((group?.subcategories || []).map(item => ({ value: item.id, label: item.name })), value, 'Bez podkategorii grupy')}</select>`;
  }
  else if (type === 'user') input = `<select name="${name}">${selectOptions(assignableUsers([value]).map(item => ({ value: item.id, label: item.display_name })), value, 'Nieprzypisane')}</select>`;
  else if (type === 'users') {
    const selected = new Set((record?.[name] || record?.assignee_user_ids || []).map(Number));
    const users = assignableUsers([...selected]); const selectedNames = users.filter(user => selected.has(user.id)).map(user => user.display_name);
    return `<div class="field full"><label>${escapeHtml(label)}</label><details class="multi-user-select"><summary>${escapeHtml(selectedNames.length ? `${selectedNames.length} · ${selectedNames.join(', ')}` : 'Wybierz osoby odpowiedzialne')}</summary><div class="mentions assignee-grid"><input class="multi-choice-search" type="search" placeholder="Szukaj osoby…">${users.map(user => `<label class="mention"><input type="checkbox" name="${name}" value="${user.id}" ${selected.has(user.id) ? 'checked' : ''}>${escapeHtml(user.display_name)}</label>`).join('')}</div></details></div>`;
  }
  else if (type === 'select') input = `<select name="${name}" ${required ? 'required' : ''}>${selectOptions(extra, value)}</select>`;
  else if (type === 'category') input = `<select name="${name}" id="form-category" data-scope="${extra}" ${required ? 'required' : ''}>${selectOptions(extra === 'task' ? taskCategories() : statusCategories(), value)}</select>`;
  else if (type === 'subcategory') input = `<select name="${name}" id="form-subcategory">${selectOptions(subcategories(extra, record?.category), value)}</select>`;
  else if (type === 'options') input = `<select name="${name}">${selectOptions(state.config.options.filter(item => item.kind === extra).map(item => ({ value: item.value, label: item.value, description: item.description })), value)}</select>`;
  else if (type === 'textarea' || type === 'bigtextarea') input = `<textarea name="${name}" ${required ? 'required' : ''}>${escapeHtml(value)}</textarea>`;
  else if (type === 'wide-text') input = `<input name="${name}" type="text" value="${escapeHtml(value)}" ${required ? 'required' : ''}>`;
  else if (type === 'boolean') input = `<select name="${name}"><option value="1"${Number(value) !== 0 ? ' selected' : ''}>Tak</option><option value="0"${Number(value) === 0 ? ' selected' : ''}>Nie</option></select>`;
  else if (name === 'recurrence_interval') input = `<input name="${name}" type="number" min="1" max="3650" step="1" value="${escapeHtml(Math.max(1, Number(value) || 1))}">`;
  else if (type === 'readonly') input = `<span class="id-lock"><input name="${name}" value="${escapeHtml(value || 'Zostanie nadane automatycznie')}" readonly></span>`;
  else input = `<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? 'required' : ''}>`;
  const info = formType === 'status' && name === 'status' ? `<span class="field-info" tabindex="0" aria-label="Legenda statusów">i<span class="field-info-tooltip" role="tooltip"><b>Legenda statusów</b><ul>${allStatusWorkflowStates().filter(item => Number(item.included) !== 0).map(({ label: title, description }) => `<li><strong>${escapeHtml(title)}</strong> — ${escapeHtml(description)}</li>`).join('')}</ul></span></span>` : '';
  const compactOptions = type === 'select' && Array.isArray(extra) ? extra.map(option => String(typeof option === 'object' ? option.label : option)) : [];
  const compact = (compactOptions.length && Math.max(...compactOptions.map(option => option.length)) <= 22) || ['date', 'boolean'].includes(type);
  const recurrenceCompact = formType === 'tasks' && ['start_date', 'due_date', 'recurrence_enabled', 'recurrence_interval', 'recurrence_unit'].includes(name) ? 'task-cycle-field' : '';
  return `<label class="field ${required ? 'required-field' : ''} ${recurrenceCompact} ${['textarea', 'bigtextarea', 'wide-text'].includes(type) ? `full ${type === 'bigtextarea' ? 'big' : ''}` : compact ? 'ui-compact-field' : ''}"><span>${label}${required ? ' *' : ''}${info}</span>${input}${type === 'readonly' ? '<small class="sub">ID jest unikalne w projekcie i nie można go edytować.</small>' : ''}</label>`;
}

function requirementsField(record, name = 'requirement_ids', label = 'Zapotrzebowanie') {
  const selected = new Set((record?.[name] || []).map(Number));
  const items = state.config.requirements || [];
  const selectedNames = items.filter(item => selected.has(item.id)).map(item => item.name);
  return `<div class="field full requirement-field"><label>${escapeHtml(label)}</label><details class="multi-user-select" data-empty-label="Brak zapotrzebowania"><summary>${selectedNames.length ? `${selectedNames.length} · ${escapeHtml(selectedNames.join(', '))}` : 'Brak zapotrzebowania'}</summary><div class="mentions requirement-picks">${items.map(item => `<label class="mention" title="${escapeHtml(item.description || '')}"><input type="checkbox" name="${name}" value="${item.id}" ${selected.has(item.id) ? 'checked' : ''}><span><b>${escapeHtml(item.name)}</b>${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}</span></label>`).join('') || '<span class="form-hint">Lista jest pusta. Dodaj pozycje w Konfiguracji.</span>'}</div></details></div>`;
}

function dependenciesField(record, currentType) {
  const collections = state.dependencyOptions || { status: state.status, task: state.tasks, point: state.points };
  const selected = new Set((record?.dependency_refs || []).map(item => `${item.entity_type}:${Number(item.entity_id)}`));
  const typeLabels = { status: 'Status', task: 'Zadania', point: 'Otwarte punkty' };
  const rows = ['status', 'task', 'point'].flatMap(entityType => (collections[entityType] || [])
    .filter(item => !(entityType === currentType && Number(item.id) === Number(record?.id)))
    .map(item => ({ entityType, item })))
    .sort((left, right) => left.entityType.localeCompare(right.entityType) || controllerHierarchyOrder(left.item) - controllerHierarchyOrder(right.item) || entityLabel(left.entityType, left.item).localeCompare(entityLabel(right.entityType, right.item), 'pl', { numeric: true }));
  const selectedRows = rows.filter(({ entityType, item }) => selected.has(`${entityType}:${Number(item.id)}`));
  const selectedNames = selectedRows.map(({ entityType, item }) => `${typeLabels[entityType]} · ${entityLabel(entityType, item)}`);
  const groups = ['status', 'task', 'point'].map(entityType => {
    const items = rows.filter(row => row.entityType === entityType);
    if (!items.length) return '';
    return `<div class="dependency-group-label">${typeLabels[entityType]}</div>${items.map(({ item }) => {
      const key = `${entityType}:${item.id}`;
      return dependencyCardHtml(entityType, item, { selectable: true, selected: selected.has(key) });
    }).join('')}`;
  }).join('');
  const selectedCards = selectedRows.length ? `<div class="selected-dependency-cards">${selectedRows.map(({ entityType, item }) => dependencyCardHtml(entityType, item)).join('')}</div>` : '<div class="form-hint dependency-empty">Brak wybranych zależności.</div>';
  return `<div class="field full task-dependency-field"><label>Zależności — elementy wymagane wcześniej</label>${selectedCards}<details class="multi-user-select dependency-picker" data-empty-label="Brak zależności"><summary>${selectedNames.length ? `Zmień wybór · ${selectedNames.length}` : 'Wybierz zależności'}</summary><div class="dependency-picks">${groups || '<span class="form-hint">Brak innych elementów w projekcie.</span>'}</div></details><small class="form-hint">Każda pozycja pokazuje źródło, tytuł, status, wykonawcę lub osobę przypisaną oraz deadline. Cykle są blokowane automatycznie.</small></div>`;
}

function multiLinksField(allowedTypes) {
  return `<div class="field full"><label>Powiązane elementy</label><div id="multi-links" class="links-editor"></div><button type="button" class="secondary" id="add-link">Wybierz z listy…</button></div>`;
}

function mentionsField(record) {
  const selected = new Set(record?.mentioned_user_ids || []);
  const users = assignableUsers([...selected]); const selectedNames = users.filter(user => selected.has(user.id)).map(user => user.display_name);
  return `<div class="field full"><label>Wspomniane osoby</label><details class="multi-user-select" data-empty-label="Bez wspomnianych osób"><summary>${selectedNames.length ? `${selectedNames.length} · ${escapeHtml(selectedNames.join(', '))}` : 'Bez wspomnianych osób'}</summary><div class="mentions assignee-grid"><input class="multi-choice-search" type="search" placeholder="Szukaj osoby…">${users.map(user => `<label class="mention"><input type="checkbox" name="mentioned_user_ids" value="${user.id}" ${selected.has(user.id) ? 'checked' : ''}>${escapeHtml(user.display_name)}</label>`).join('')}</div></details></div>`;
}

function checklistField(record) {
  return `<section class="checks task-checklist-editor"><header><span><b>Lista kontrolna / podzadania</b><small>Treść może być wielowierszowa; każde podzadanie ma wagę i opcjonalnego wykonawcę.</small></span><button type="button" class="mini" id="add-check">+ Dodaj podzadanie</button></header><div id="checklist">${(record?.checklist || []).map(checklistRow).join('')}</div></section>`;
}

function taskImagesField() {
  return `<section class="task-images-editor" id="task-images-editor"><header><span><b>Zdjęcia i zrzuty ekranu</b><small>Obrazy są automatycznie zmniejszane i zapisywane jako WebP. Maksymalnie 12 zdjęć.</small></span><label class="mini task-image-picker">+ Dodaj zdjęcia<input id="task-image-input" type="file" accept="image/jpeg,image/png,image/webp" multiple></label></header><div class="task-image-paste-hint"><kbd>Ctrl</kbd> + <kbd>V</kbd> Wklej zrzut ekranu w dowolnym miejscu okna zadania.</div><div id="task-image-progress" class="form-hint"></div><div id="task-image-gallery" class="task-image-gallery"></div></section>`;
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  return value < 1024 * 1024 ? `${Math.round(value / 1024)} KB` : `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function renderTaskImages() {
  const dialog = state.dialog;
  const gallery = $('#task-image-gallery');
  if (!gallery || dialog?.type !== 'tasks') return;
  const existing = (dialog.taskImages || []).map(image => ({ ...image, pending: false, preview_url: image.content_url }));
  const pending = (dialog.pendingTaskImages || []).map((image, index) => ({ ...image, pending: true, pending_index: index, preview_url: `data:${image.mime_type};base64,${image.data_base64}` }));
  const images = [...existing, ...pending];
  gallery.innerHTML = images.map(image => `<article class="task-image-card ${image.pending ? 'pending' : ''}"><a href="${escapeHtml(image.preview_url)}" target="_blank" rel="noopener" title="Otwórz zdjęcie w pełnym rozmiarze"><img src="${escapeHtml(image.preview_url)}" alt="${escapeHtml(image.filename)}" loading="lazy"></a><div><b>${escapeHtml(image.filename)}</b><small>${image.width} × ${image.height} · ${formatFileSize(image.byte_size)}${image.pending ? ' · do zapisania' : ''}</small></div><button type="button" class="mini danger-text" data-remove-task-image="${image.pending ? `pending:${image.pending_index}` : `saved:${image.id}`}" aria-label="Usuń zdjęcie ${escapeHtml(image.filename)}">Usuń</button></article>`).join('') || '<div class="form-hint task-images-empty">Brak zdjęć. Wybierz plik albo wklej screenshot skrótem Ctrl+V.</div>';
  $$('[data-remove-task-image]').forEach(button => button.addEventListener('click', async () => {
    const [kind, rawId] = button.dataset.removeTaskImage.split(':');
    if (kind === 'pending') {
      dialog.pendingTaskImages.splice(Number(rawId), 1);
      $('#modal').dataset.dirty = '1';
      renderTaskImages();
      return;
    }
    button.disabled = true;
    try {
      await api(`/api/task-images/${Number(rawId)}`, { method: 'DELETE' });
      dialog.taskImages = dialog.taskImages.filter(image => Number(image.id) !== Number(rawId));
      if (dialog.record) { dialog.record.images = [...dialog.taskImages]; dialog.record.image_count = dialog.taskImages.length; }
      const task = state.tasks.find(item => Number(item.id) === Number(dialog.record?.id));
      if (task) task.image_count = dialog.taskImages.length;
      renderTaskImages();
      toast('Zdjęcie zostało trwale usunięte z serwera');
    } catch (error) { button.disabled = false; toast(error.message, true); }
  }));
}

function canvasBlob(canvas, mimeType, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));
}

async function decodedImage(file) {
  if ('createImageBitmap' in globalThis) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { width: bitmap.width, height: bitmap.height, draw: (context, width, height) => context.drawImage(bitmap, 0, 0, width, height), close: () => bitmap.close() };
    } catch { /* fallback dla starszych formatów przeglądarki */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = () => reject(new Error('Nie można odczytać obrazu')); element.src = url; });
    return { width: image.naturalWidth, height: image.naturalHeight, draw: (context, width, height) => context.drawImage(image, 0, 0, width, height), close: () => {} };
  } finally { URL.revokeObjectURL(url); }
}

async function compressTaskImage(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Wybrany plik nie jest zdjęciem');
  if (file.size > 25_000_000) throw new Error('Plik źródłowy może mieć maksymalnie 25 MB');
  const source = await decodedImage(file);
  try {
    if (!source.width || !source.height) throw new Error('Zdjęcie ma nieprawidłowe wymiary');
    let result = null;
    for (const maxDimension of [1600, 1400, 1200, 1000, 800]) {
      const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
      const width = Math.max(1, Math.round(source.width * scale)); const height = Math.max(1, Math.round(source.height * scale));
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d', { alpha: true });
      context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; source.draw(context, width, height);
      for (const quality of [0.82, 0.7, 0.58]) {
        const blob = await canvasBlob(canvas, 'image/webp', quality);
        if (!blob) continue;
        result = { blob, width, height };
        if (blob.size <= 700_000) break;
      }
      if (result?.blob.size <= 700_000) break;
    }
    if (!result?.blob || result.blob.size > 900_000) throw new Error('Nie udało się skompresować zdjęcia poniżej 900 KB');
    const stem = String(file.name || `screenshot-${new Date().toISOString().replace(/[:.]/g, '-')}`).replace(/\.[^.]+$/, '').replace(/[\\/\x00-\x1f\x7f]/g, '_').slice(0, 110) || 'zdjecie';
    return {
      filename: `${stem}.webp`, mime_type: 'image/webp', byte_size: result.blob.size, original_size: file.size,
      width: result.width, height: result.height, data_base64: bytesToBase64(new Uint8Array(await result.blob.arrayBuffer()))
    };
  } finally { source.close(); }
}

async function addTaskImageFiles(files) {
  const dialog = state.dialog; const progress = $('#task-image-progress');
  if (dialog?.type !== 'tasks' || !dialog.editing) return;
  const selected = [...files].filter(file => file?.type?.startsWith('image/'));
  if (!selected.length) return toast('Schowek lub wybór nie zawiera zdjęcia', true);
  const activeCount = (dialog.taskImages || []).length + (dialog.pendingTaskImages || []).length;
  if (activeCount + selected.length > 12) return toast('Do jednego zadania można dodać maksymalnie 12 zdjęć', true);
  for (let index = 0; index < selected.length; index += 1) {
    const file = selected[index];
    if (progress) progress.textContent = `Kompresowanie ${index + 1}/${selected.length}: ${file.name || 'screenshot'}…`;
    try {
      const image = await compressTaskImage(file);
      dialog.pendingTaskImages.push(image);
      renderTaskImages();
      if (progress) progress.textContent = `${file.name || 'Screenshot'}: ${formatFileSize(file.size)} → ${formatFileSize(image.byte_size)}.`;
      $('#modal').dataset.dirty = '1';
    } catch (error) { toast(`${file.name || 'Zdjęcie'}: ${error.message}`, true); }
  }
}

function bindTaskImagesField() {
  const input = $('#task-image-input');
  input?.addEventListener('change', async () => { await addTaskImageFiles(input.files || []); input.value = ''; });
  renderTaskImages();
}

function handleTaskImagePaste(event) {
  if (!$('#modal')?.open || state.dialog?.type !== 'tasks' || !state.dialog.editing) return;
  const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
  if (!files.length) return;
  event.preventDefault();
  void addTaskImageFiles(files);
}

function checklistRow(item = {}) {
  return `<div class="check-row"><label class="check-text-field"><span>Treść podzadania</span><textarea data-check-text rows="3" placeholder="Opisz konkretny rezultat podzadania…">${escapeHtml(item.text || '')}</textarea></label><div class="check-row-meta"><label class="check-control check-done"><span>Stan</span><span class="check-toggle"><input type="checkbox" data-check-done ${item.done ? 'checked' : ''}><b>Gotowe</b></span></label><label class="check-control"><span>Waga</span><input type="number" data-check-weight min="0.1" max="1000" step="0.1" value="${escapeHtml(item.weight || 1)}"></label><label class="check-control check-owner"><span>Wykonawca</span><select data-check-owner>${selectOptions(assignableUsers([item.owner_user_id]).map(user => ({ value: user.id, label: user.display_name })), item.owner_user_id, 'Bez osoby')}</select></label><button type="button" class="mini delete-check" title="Usuń podzadanie">×</button></div></div>`;
}

function scopeControllersForGroup(groupId) {
  const selected = state.controllerGroups.find(group => group.id === Number(groupId));
  if (!selected) return [];
  const prefix = (selected.path_names || []).join('\u0000');
  const groupIds = new Set(state.controllerGroups.filter(group => (group.path_names || []).slice(0, selected.path_names.length).join('\u0000') === prefix).map(group => group.id));
  return state.controllers.filter(controller => groupIds.has(Number(controller.group_id)));
}

function scopeChecklistField(record) {
  const groupId = record?.controller_group_id || (defaultValue('hierarchy_target').startsWith('group:') ? Number(defaultValue('hierarchy_target').slice(6)) : null);
  return `<section class="scope-checks ${groupId ? '' : 'hidden'}" id="scope-checklist-section"><header><span><b>Kontrola wszystkich sterowników w wybranym zakresie</b><small>Lista powstaje automatycznie z ostatnich elementów hierarchii.</small></span></header><div id="scope-checklist">${scopeChecklistRows(groupId, record?.scope_checklist || [])}</div></section>`;
}

function scopeChecklistRows(groupId, items = []) {
  if (!groupId) return '';
  const done = new Map(items.map(item => [Number(item.controller_id), Boolean(item.done)]));
  return scopeControllersForGroup(groupId).map(controller => `<div class="scope-check-row"><input type="checkbox" data-scope-controller="${controller.id}" ${done.get(controller.id) ? 'checked' : ''}><span><b>${escapeHtml(controller.display_name)}</b><small>${escapeHtml(controller.hierarchy_label)}</small></span><button type="button" class="mini remove-scope-check" title="Usuń ten sterownik z kontroli">×</button></div>`).join('') || '<div class="form-hint">Ten obszar nie zawiera jeszcze sterowników końcowych.</div>';
}

function goalLinksField() {
  return `<div class="field full"><label>Elementy realizujące kamień milowy</label><button type="button" class="secondary" id="open-goal-picker">Wybierz status, zadania i otwarte punkty</button><div id="goal-link-preview" class="goal-links"></div></div>`;
}

function bindDynamicFields(type) {
  bindHierarchyTargetTrees($('#fields'));
  const bindStatusMatrixSymbols = () => $$('[data-matrix-value][data-column-type="status"]').forEach(select => select.addEventListener('change', () => {
    const symbol = select.closest('.status-subpoint-field')?.querySelector('.status-symbol');
    if (symbol) symbol.outerHTML = statusSymbol(select.value);
  }));
  bindStatusMatrixSymbols();
  $$('.multi-choice-search').forEach(search => {
    search.addEventListener('input', () => {
      const term = search.value.trim().toLocaleLowerCase('pl');
      search.parentElement.querySelectorAll(':scope > label').forEach(label => { label.hidden = Boolean(term) && !label.textContent.toLocaleLowerCase('pl').includes(term); });
    });
    search.addEventListener('keydown', event => { if (event.key === 'Enter') event.preventDefault(); });
  });
  $$('.multi-user-select input[type="checkbox"]').forEach(input => input.addEventListener('change', event => {
    const details = event.target.closest('.multi-user-select');
    const names = [...details.querySelectorAll('input:checked')].map(item => item.closest('label').textContent.trim());
    const fieldName = event.target.name;
    const empty = details.dataset.emptyLabel || (fieldName === 'scope_group_ids' ? 'Cały projekt' : fieldName === 'recipient_user_ids' ? 'Bez wskazania konkretnych osób' : 'Wybierz osoby odpowiedzialne');
    details.querySelector('summary').textContent = details.classList.contains('dependency-picker')
      ? (names.length ? `Zmień wybór · ${names.length}` : 'Wybierz zależności')
      : names.length ? `${names.length} · ${names.join(', ')}` : empty;
    if (details.classList.contains('dependency-picker')) {
      const selectedRoot = details.parentElement.querySelector('.selected-dependency-cards, .dependency-empty');
      const collections = state.dependencyOptions || { status: state.status, task: state.tasks, point: state.points };
      const cards = [...details.querySelectorAll('input:checked')].map(control => {
        const [entityType, rawId] = control.value.split(':');
        const item = (collections[entityType] || []).find(candidate => Number(candidate.id) === Number(rawId));
        return item ? dependencyCardHtml(entityType, item) : '';
      }).join('');
      if (selectedRoot) {
        selectedRoot.className = cards ? 'selected-dependency-cards' : 'form-hint dependency-empty';
        selectedRoot.innerHTML = cards || 'Brak wybranych zależności.';
        bindDependencyJumps(selectedRoot);
      }
    }
  }));
  $('#form-category')?.addEventListener('change', event => { const scope = event.target.dataset.scope; $('#form-subcategory').innerHTML = selectOptions(subcategories(scope, event.target.value)); if (type === 'status') applyDefaultFunction(); });
  $('#form-subcategory')?.addEventListener('change', () => { if (type === 'status') applyDefaultFunction(); });
  const refreshStatusMatrixEditor = () => {
    const root = $('#status-item-matrix-editor'); if (!root) return;
    root.outerHTML = statusMatrixEditorField(state.dialog?.record || state.dialog?.prefill || state.dialog?.duplicateSource || {}, $('#form-status-group')?.value, $('#form-status-subgroup')?.value);
    bindStatusMatrixSymbols();
    if (state.dialog && !state.dialog.editing) setRecordDialogMode(false);
  };
  $('#form-status-group')?.addEventListener('change', event => {
    $('#form-status-subgroup').innerHTML = selectOptions(statusSubgroups(event.target.value).map(item => ({ value: item.id, label: item.name })), '', 'Punkty bezpośrednio w grupie');
    refreshStatusMatrixEditor();
  });
  $('#form-status-subgroup')?.addEventListener('change', refreshStatusMatrixEditor);
  $('#entity-type')?.addEventListener('change', fillEntitySelect);
  if (['status', 'tasks'].includes(type)) {
    $('#form-controller')?.addEventListener('change', event => {
      $('#form-function-group').innerHTML = selectOptions(functionGroups(event.target.value).map(item => ({ value: item.id, label: item.name })), '', 'Bez grupy funkcyjnej');
      $('#form-function-element').innerHTML = selectOptions([], '', 'Bez elementu');
      if ($('#form-function-subcategory')) $('#form-function-subcategory').innerHTML = selectOptions([], '', 'Bez podkategorii grupy');
      syncTaskObjectFields();
    });
    $('#form-function-group')?.addEventListener('change', event => {
      const group = (state.config.function_groups || []).find(item => item.id === Number(event.target.value));
      $('#form-function-element').innerHTML = selectOptions((group?.elements || []).map(item => ({ value: item.id, label: item.name })), '', 'Bez elementu');
      if ($('#form-function-subcategory')) $('#form-function-subcategory').innerHTML = selectOptions((group?.subcategories || []).map(item => ({ value: item.id, label: item.name })), '', 'Bez podkategorii grupy');
      syncTaskObjectFields();
    });
    $('#fields [name="other_object"]')?.addEventListener('input', syncTaskObjectFields);
    $('#form-hierarchy-target')?.addEventListener('change', event => {
      const target = event.target.value;
      const controllerCode = target.startsWith('controller:') ? target.slice(11) : '';
      const areaSelected = target.startsWith('group:');
      if ($('#form-function-group')) {
        $('#form-function-group').innerHTML = selectOptions(functionGroups(controllerCode).map(item => ({ value: item.id, label: item.name })), '', 'Bez grupy funkcyjnej');
        if (type === 'status') $('#form-function-group').disabled = areaSelected;
      }
      if ($('#form-function-element')) { $('#form-function-element').innerHTML = selectOptions([], '', 'Bez elementu'); if (type === 'status') $('#form-function-element').disabled = areaSelected; }
      if ($('#form-function-subcategory')) { $('#form-function-subcategory').innerHTML = selectOptions([], '', 'Bez podkategorii grupy'); if (type === 'status') $('#form-function-subcategory').disabled = areaSelected; }
      if (type === 'tasks') syncTaskHierarchyTarget();
      else syncTaskObjectFields();
    });
    if (type === 'status' && $('#form-hierarchy-target')?.value.startsWith('group:')) $('#form-hierarchy-target').dispatchEvent(new Event('change', { bubbles: true }));
    if (type === 'tasks') syncTaskHierarchyTarget(false);
    syncTaskObjectFields();
  }
  if ($('#entity-type')) fillEntitySelect();
  $('#go-entity')?.addEventListener('click', () => { const type = $('#entity-type').value; const id = Number($('#entity-id').value); openEntityOverlay(type, id); });
  $$('[data-toggle]').forEach(checkbox => checkbox.addEventListener('change', () => { $('#' + checkbox.dataset.toggle).disabled = !checkbox.checked; }));
  if (type === 'tasks') {
    bindTaskImagesField();
    $('#add-check').addEventListener('click', () => { $('#checklist').insertAdjacentHTML('beforeend', checklistRow()); bindChecklistDelete(); });
    bindChecklistDelete();
    $('#scope-checklist')?.addEventListener('click', event => { const button = event.target.closest('.remove-scope-check'); if (button) button.closest('.scope-check-row').remove(); });
    const recurrenceEnabled = $('#fields [name="recurrence_enabled"]');
    const recurrenceInterval = $('#fields [name="recurrence_interval"]');
    const recurrenceUnit = $('#fields [name="recurrence_unit"]');
    const syncRecurrence = () => {
      const enabled = Number(recurrenceEnabled?.value) !== 0;
      if (recurrenceInterval) recurrenceInterval.disabled = !enabled;
      if (recurrenceUnit) recurrenceUnit.disabled = !enabled;
      if (recurrenceInterval?.closest('.field')) recurrenceInterval.closest('.field').hidden = !enabled;
      if (recurrenceUnit?.closest('.field')) recurrenceUnit.closest('.field').hidden = !enabled;
    };
    recurrenceEnabled?.addEventListener('change', syncRecurrence);
    syncRecurrence();
  }
  if (type === 'goals') {
    $('#open-goal-picker').addEventListener('click', openGoalPicker);
    renderGoalLinkPreview();
  }
  bindDependencyJumps($('#fields'));
  const linkField = formDefinitions[type].fields.find(field => field[2] === 'multi-links');
  if (linkField) {
    const allowed = linkField[3];
    renderMultiLinks(allowed);
    $('#add-link').addEventListener('click', () => openLinkPicker(allowed));
  }
}

function applyDefaultFunction() {
  const category = state.config.categories.find(item => item.name === $('#form-category')?.value);
  const subcategory = category?.subcategories.find(item => item.name === $('#form-subcategory')?.value);
  const input = $('#fields [name="function_detail"]');
  if (input && subcategory?.default_function) input.value = subcategory.default_function;
}

function syncTaskObjectFields() {
  const group = $('#form-function-group');
  const element = $('#form-function-element');
  const other = $('#fields [name="other_object"]');
  if (!group || !other) return;
  const hierarchyGroupSelected = $('#form-hierarchy-target')?.value.startsWith('group:');
  const hasOther = Boolean(other.value.trim());
  group.disabled = hierarchyGroupSelected || hasOther;
  if (element) element.disabled = hierarchyGroupSelected || hasOther || !group.value;
  other.disabled = hierarchyGroupSelected || Boolean(group.value);
}

function syncTaskHierarchyTarget(preserve = true) {
  const target = $('#form-hierarchy-target')?.value || '';
  const section = $('#scope-checklist-section');
  if (!section) return;
  const existing = preserve ? $$('#scope-checklist [data-scope-controller]').map(input => ({ controller_id: Number(input.dataset.scopeController), done: input.checked })) : (state.dialog?.record?.scope_checklist || []);
  if (target.startsWith('group:')) {
    const groupId = Number(target.slice(6));
    section.classList.remove('hidden');
    $('#scope-checklist').innerHTML = scopeChecklistRows(groupId, existing);
    $('#form-function-group').value = '';
    $('#form-function-element').innerHTML = selectOptions([], '', 'Bez elementu');
  } else {
    section.classList.add('hidden');
    $('#scope-checklist').innerHTML = '';
    const controllerCode = target.replace(/^controller:/, '');
    $('#form-function-group').innerHTML = selectOptions(functionGroups(controllerCode).map(item => ({ value: item.id, label: item.name })), state.dialog?.record?.function_group_id || '', 'Bez grupy funkcyjnej');
  }
  syncTaskObjectFields();
}

function captureMultiLinks() {
  state.linkDraft = [...new Map(state.linkDraft.filter(link => link.entity_id).map(link => [`${link.entity_type}:${Number(link.entity_id)}`, { entity_type: link.entity_type, entity_id: Number(link.entity_id) }])).values()];
}
function renderMultiLinks(allowed) {
  const container = $('#multi-links'); if (!container) return;
  captureMultiLinks();
  container.innerHTML = state.linkDraft.map((link, index) => { const item = entity(link.entity_type, link.entity_id); return item ? `<div class="link-editor-row static"><span class="type-dot ${link.entity_type}"></span><span><b>${escapeHtml(entityLabel(link.entity_type, item))}</b><small>${escapeHtml(controllerLabel(item))} · ${escapeHtml(badgeText(item.status || item.type))}</small></span><button type="button" class="mini go-link" data-index="${index}" title="Przejdź do elementu">→</button><button type="button" class="mini remove-link" data-index="${index}">×</button></div>` : ''; }).join('') || '<div class="form-hint">Brak powiązań. Wybierz status, zadanie, otwarty punkt, kamień milowy lub wpis dziennika.</div>';
  $$('#multi-links .go-link').forEach(button => button.addEventListener('click', () => { const link = state.linkDraft[Number(button.dataset.index)]; openEntityOverlay(link.entity_type, link.entity_id); }));
  $$('#multi-links .remove-link').forEach(button => button.addEventListener('click', () => { state.linkDraft.splice(Number(button.dataset.index), 1); renderMultiLinks(allowed); }));
}

async function openLinkPicker(allowed) {
  captureMultiLinks();
  state.linkPickerAllowed = allowed;
  state.linkPickerDraft = state.linkDraft.map(link => ({ ...link }));
  $('#link-picker-search').value = '';
  const typeLabels = { status: 'Status', task: 'Zadania', point: 'Otwarte punkty', goal: 'Kamienie milowe', note: 'Przekazanie statusu' };
  $('#link-picker-type').innerHTML = '<option value="all">Wszystkie typy</option>' + allowed.map(type => `<option value="${type}">${typeLabels[type] || type}</option>`).join('');
  $('#link-picker-dialog').showModal();
  $('#link-picker-content').innerHTML = '<div class="loading">Ładowanie elementów całego projektu…</div>';
  try {
    const [status, task, point, note, goal] = await Promise.all([api('/api/status?controller=all'), api('/api/tasks?controller=all'), api('/api/open-points?controller=all'), api('/api/daily-notes?controller=all'), api('/api/goals?controller=all')]);
    state.linkPickerCollections = { status, task, point, note, goal };
  } catch (error) { toast(error.message, true); state.linkPickerCollections = { status: state.status, task: state.tasks, point: state.points, note: state.notes, goal: state.goals }; }
  renderLinkPicker();
}

function linkPickerItems() {
  const sources = state.linkPickerCollections || { status: state.status, task: state.tasks, point: state.points, note: state.notes, goal: state.goals };
  return state.linkPickerAllowed.flatMap(type => (sources[type] || []).map(item => ({ type, item })));
}

function pickerGroupHtml(rows, renderRow) {
  const sorted = [...rows].sort((a, b) => controllerHierarchyOrder(a.item) - controllerHierarchyOrder(b.item)
    || controllerLabel(a.item).localeCompare(controllerLabel(b.item), 'pl', { numeric: true })
    || entityLabel(a.type, a.item).localeCompare(entityLabel(b.type, b.item), 'pl', { numeric: true }));
  const groups = new Map();
  for (const row of sorted) {
    const label = row.item.scope_path || row.item.controller_path || controllerLabel(row.item) || 'Cały projekt';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row);
  }
  return [...groups.entries()].map(([label, items]) => `<section class="picker-area-group"><header><b>${escapeHtml(label)}</b><span>${items.length}</span></header>${items.map(renderRow).join('')}</section>`).join('');
}

function renderLinkPicker() {
  const query = ($('#link-picker-search').value || '').toLocaleLowerCase('pl');
  const type = $('#link-picker-type').value;
  const sort = $('#link-picker-sort').value;
  let rows = linkPickerItems().filter(row => (type === 'all' || row.type === type) && (!query || JSON.stringify(row.item).toLocaleLowerCase('pl').includes(query) || entityLabel(row.type, row.item).toLocaleLowerCase('pl').includes(query)));
  if (sort !== 'hierarchy') rows.sort((a, b) => String(sort === 'label' ? entityLabel(a.type, a.item) : a.item[sort] || '').localeCompare(String(sort === 'label' ? entityLabel(b.type, b.item) : b.item[sort] || ''), 'pl', { numeric: true }));
  const selected = new Set(state.linkPickerDraft.map(link => `${link.entity_type}:${link.entity_id}`));
  $('#link-picker-content').innerHTML = `<div class="link-picker-table">${pickerGroupHtml(rows.slice(0, 500), ({ type: rowType, item }) => `<label class="link-picker-row"><input type="checkbox" data-link-pick="${rowType}:${item.id}" ${selected.has(`${rowType}:${item.id}`) ? 'checked' : ''}><span class="type-dot ${rowType}"></span><span><b>${escapeHtml(controllerLabel(item) || 'Cały projekt')} · ${escapeHtml(entityLabel(rowType, item))}</b><small>${escapeHtml(badgeText(item.status || item.type))}</small></span><span>${item.due_date || item.note_date || item.checked_on ? displayDate(item.due_date || item.note_date || item.checked_on) : ''}</span></label>`) || '<div class="empty">Brak wyników.</div>'}</div>`;
  $$('[data-link-pick]').forEach(input => input.addEventListener('change', () => {
    const [entityType, rawId] = input.dataset.linkPick.split(':'); const id = Number(rawId); const key = `${entityType}:${id}`;
    state.linkPickerDraft = state.linkPickerDraft.filter(link => `${link.entity_type}:${link.entity_id}` !== key);
    if (input.checked) state.linkPickerDraft.push({ entity_type: entityType, entity_id: id });
    $('#link-picker-count').textContent = `Wybrano: ${state.linkPickerDraft.length}`;
  }));
  $('#link-picker-count').textContent = `Wybrano: ${state.linkPickerDraft.length}`;
}

function applyLinkPicker() {
  state.linkDraft = [...new Map(state.linkPickerDraft.map(link => [`${link.entity_type}:${link.entity_id}`, link])).values()];
  $('#link-picker-dialog').close();
  renderMultiLinks(state.linkPickerAllowed);
}

function closeLinkPicker() { $('#link-picker-dialog').close(); }

function selectionCollections() {
  return state.selectionCollections || { status: state.status, task: state.tasks, point: state.points, goal: state.goals, note: state.notes };
}

async function openEntitySelection(context) {
  const labels = { status: 'Status', task: 'Zadania', point: 'Otwarte punkty', goal: 'Kamienie milowe', note: 'Przekazanie statusu' };
  state.selectionContext = context;
  state.selectionDraft = [...new Map((context.initial || []).map(item => [`${item.entity_type}:${Number(item.entity_id)}`, { entity_type: item.entity_type, entity_id: Number(item.entity_id) }])).values()];
  $('#entity-selection-search').value = '';
  $('#entity-selection-type').innerHTML = context.meeting
    ? `<option value="due">Terminy w okresie i zbliżające się</option><option value="status">Otwarte punkty statusu</option><option value="task">Otwarte zadania</option><option value="point">Otwarte punkty</option><option value="goal">Otwarte kamienie milowe</option>`
    : `<option value="all">Wszystkie typy</option>${context.allowed.map(type => `<option value="${type}">${labels[type]}</option>`).join('')}`;
  $('#entity-selection-title').textContent = context.meeting ? 'Dodaj tematy do odprawy' : context.mode === 'planner' ? 'Przypisz pracę pracownikowi' : context.mode === 'external_dependency' ? 'Wybierz otwarty punkt' : context.onApply ? 'Powiązane elementy informacji' : 'Dodaj istniejące elementy do dnia';
  const user = context.userId ? state.users.find(item => item.id === context.userId) : null;
  $('#entity-selection-description').textContent = context.meeting ? `${displayDate(context.from)}–${displayDate(context.to)} · wybierz jedną z osobnych list i zawęź ją obszarami.` : context.mode === 'planner'
    ? `${user?.display_name || 'Pracownik'} · ${displayDate(context.date)} · wybór przypisze osobę i planowany start.`
    : context.mode === 'external_dependency' ? 'Wybierz jeden nieukończony punkt. Zależność zostanie utworzona wyłącznie na jego podstawie.'
      : context.onApply ? 'Wybierz zadania, status, otwarte punkty, kamienie milowe lub wcześniejsze przekazania związane z tą informacją.'
      : `${displayDate(context.date)} · wybrane elementy pojawią się w tym dniu bez zmiany ich terminów.`;
  $('#entity-selection-scope').innerHTML = context.meeting ? hierarchyMultiDropdownHtml([]) : '';
  state.selectionScopes = [];
  if (context.meeting) bindHierarchyMultiDropdown($('#entity-selection-scope'), selected => { state.selectionScopes = selected; renderEntitySelection(); });
  $('#entity-selection-dialog').showModal();
  $('#entity-selection-content').innerHTML = '<div class="loading">Ładowanie elementów całego projektu…</div>';
  try {
    if (context.meeting) {
      state.selectionCollections = await api(`/api/project-meetings/candidates?from=${encodeURIComponent(context.from)}&to=${encodeURIComponent(context.to)}`);
      const warningDays = Number(state.selectionCollections?.meta?.deadline_window_days || 7);
      const dueOption = $('#entity-selection-type option[value="due"]');
      if (dueOption) dueOption.textContent = `Terminy w okresie i ${warningDays} dni po nim`;
    }
    else {
      const endpoints = { status: '/api/status?controller=all', task: '/api/tasks?controller=all', point: '/api/open-points?controller=all', goal: '/api/goals?controller=all', note: '/api/daily-notes?controller=all' };
      const values = await Promise.all(context.allowed.map(type => api(endpoints[type])));
      state.selectionCollections = Object.fromEntries(context.allowed.map((type, index) => [type, values[index]]));
    }
  } catch (error) { toast(error.message, true); state.selectionCollections = null; }
  renderEntitySelection();
}

function meetingSelectionTable(rows, selectedType, selected) {
  const sources = [
    ['due', 'Zbliżające się terminy'], ['status', 'Otwarte punkty statusu'], ['task', 'Otwarte zadania'], ['point', 'Otwarte punkty'], ['goal', 'Otwarte kamienie milowe']
  ];
  const tabs = `<nav class="meeting-source-tabs" aria-label="Źródło tematów">${sources.map(([value, label]) => `<button type="button" class="mini ${selectedType === value ? 'active-toggle' : ''}" data-meeting-source="${value}">${label}</button>`).join('')}</nav>`;
  if (!rows.length) return `${tabs}<div class="empty">Brak nieukończonych elementów odpowiadających filtrom.</div>`;
  const pick = (type, item) => { const key = `${type}:${item.id}`; return `<input type="checkbox" data-entity-pick="${key}" ${selected.has(key) ? 'checked' : ''} aria-label="Wybierz element">`; };
  const details = (type, item) => `<button type="button" class="mini" data-meeting-detail="${type}:${item.id}">Szczegóły</button>`;
  const owner = item => escapeHtml(item.owner_name || item.responsible_name || 'Nieprzypisane');
  const table = (headers, body) => `<div class="tablewrap meeting-selection-table"><table><thead><tr><th aria-label="Wybierz"></th>${headers.map(label => `<th>${label}</th>`).join('')}<th></th></tr></thead><tbody>${body}</tbody></table></div>`;
  let content;
  if (selectedType === 'status') {
    const matrixColumns = [...new Map(rows.flatMap(({ item }) => statusEditorColumns(item.status_group_id, item.status_subgroup_id).map(column => [column.id, column]))).values()];
    content = table(['Zakres', 'Punkt', 'Grupa', 'Podgrupa', ...matrixColumns.map(column => escapeHtml(column.name)), 'Status', 'Odpowiedzialni', 'Krytyczność'], rows.map(({ type, item }) => `<tr><td>${pick(type, item)}</td><td>${escapeHtml(controllerLabel(item) || 'Cały projekt')}</td><td class="maincell">${escapeHtml(item.title)}</td><td>${escapeHtml(item.status_group_name || '—')}</td><td>${escapeHtml(item.status_subgroup_name || '—')}</td>${matrixColumns.map(column => `<td>${column.field_type === 'status' ? statusSymbol(item.matrix_values?.[column.id] || item.status) : escapeHtml(item.matrix_values?.[column.id] || '—')}</td>`).join('')}<td>${statusSymbol(item.status)} ${escapeHtml(badgeText(item.status))}</td><td>${owner(item)}</td><td>${badge(item.criticality)}</td><td>${details(type, item)}</td></tr>`).join(''));
  } else if (selectedType === 'task') {
    content = table(['Zadanie', 'Zakres / PLC', 'Grupa funkcyjna', 'Element', 'Kategoria', 'Podkategoria', 'Status', 'Odpowiedzialni', 'Postęp', 'Start', 'Deadline', 'Priorytet'], rows.map(({ type, item }) => `<tr><td>${pick(type, item)}</td><td class="maincell">${escapeHtml(item.title)}<small>${escapeHtml(item.description || '')}</small></td><td>${escapeHtml(controllerLabel(item) || 'Cały projekt')}</td><td>${escapeHtml(item.function_group_name || item.other_object || '—')}</td><td>${escapeHtml(item.function_group_element_name || '—')}</td><td>${escapeHtml(item.category || '—')}</td><td>${escapeHtml(item.subcategory || '—')}</td><td>${badge(item.status)}</td><td>${owner(item)}</td><td>${Number.isFinite(Number(item.progress)) ? `${Number(item.progress)}%` : '—'}</td><td>${displayDate(item.start_date)}</td><td>${displayDate(item.due_date)}</td><td>${badge(item.priority)}</td><td>${details(type, item)}</td></tr>`).join(''));
  } else if (selectedType === 'point') {
    content = table(['Temat', 'Zakres / PLC', 'Kategoria', 'Podkategoria', 'Status', 'Oczekiwanie', 'Odpowiedzialny', 'Deadline', 'Przypomnienie', 'Priorytet'], rows.map(({ type, item }) => `<tr><td>${pick(type, item)}</td><td class="maincell">${escapeHtml(item.title)}<small>${escapeHtml(item.description || '')}</small></td><td>${escapeHtml(controllerLabel(item) || 'Cały projekt')}</td><td>${escapeHtml(item.category || '—')}</td><td>${escapeHtml(item.subcategory || '—')}</td><td>${badge(item.status)}</td><td>${escapeHtml(item.waiting_for || '—')}</td><td>${owner(item)}</td><td>${displayDate(item.due_date)}</td><td>${displayDate(item.reminder_date)}</td><td>${badge(item.priority)}</td><td>${details(type, item)}</td></tr>`).join(''));
  } else if (selectedType === 'goal') {
    content = table(['Kamień milowy', 'Zakres', 'Status', 'Priorytet', 'Deadline', 'Opis'], rows.map(({ type, item }) => `<tr><td>${pick(type, item)}</td><td class="maincell">${escapeHtml(item.title)}</td><td>${escapeHtml(controllerLabel(item) || 'Cały projekt')}</td><td>${badge(item.status)}</td><td>${badge(item.priority)}</td><td>${displayDate(item.due_date)}</td><td>${escapeHtml(item.description || '—')}</td><td>${details(type, item)}</td></tr>`).join(''));
  } else {
    const typeNames = { status: 'Status', task: 'Zadanie', point: 'Otwarty punkt', goal: 'Kamień milowy' };
    content = table(['Źródło', 'Obszar', 'Temat', 'Odpowiedzialny', 'Deadline', 'Priorytet', 'Status'], rows.map(({ type, item }) => `<tr><td>${pick(type, item)}</td><td>${escapeHtml(typeNames[type] || type)}</td><td>${escapeHtml(controllerLabel(item) || 'Cały projekt')}</td><td class="maincell">${escapeHtml(item.title)}</td><td>${owner(item)}</td><td>${displayDate(item.due_date)}</td><td>${badge(item.priority || item.criticality)}</td><td>${badge(item.status)}</td><td>${details(type, item)}</td></tr>`).join(''));
  }
  return tabs + content;
}

function renderEntitySelection() {
  const context = state.selectionContext;
  if (!context) return;
  const query = ($('#entity-selection-search').value || '').toLocaleLowerCase('pl');
  const selectedType = $('#entity-selection-type').value || 'all';
  const selected = new Set(state.selectionDraft.map(item => `${item.entity_type}:${item.entity_id}`));
  let rows = context.meeting
    ? (selectionCollections()[selectedType] || []).map(item => ({ type: item.entity_type || selectedType, item: { ...item, id: item.entity_id || item.id } }))
    : context.allowed.flatMap(type => (selectionCollections()[type] || []).map(item => ({ type, item })));
  rows = rows.filter(({ type, item }) => (context.meeting || selectedType === 'all' || type === selectedType) && (!query || `${entityLabel(type, item)} ${controllerLabel(item)} ${item.owner_name || item.responsible_name || item.created_by_name || ''} ${item.category || ''}`.toLocaleLowerCase('pl').includes(query)));
  if (context.meeting && state.selectionScopes?.length) rows = rows.filter(({ item }) => {
    const codes = rowControllerCodes(item);
    return state.selectionScopes.some(value => [...hierarchyControllerCodes(value)].some(code => codes.has(code)));
  });
  const typeNames = { status: 'Status', task: 'Zadanie', point: 'Otwarty punkt', goal: 'Kamień milowy', note: 'Przekazanie statusu' };
  $('#entity-selection-content').innerHTML = context.meeting ? meetingSelectionTable(rows.slice(0, 700), selectedType, selected) : `<div class="link-picker-table">${pickerGroupHtml(rows.slice(0, 700), ({ type, item }) => {
    const key = `${type}:${item.id}`;
    const assigned = item.owner_name || item.responsible_name || item.created_by_name || item.author || 'Nieprzypisane';
    const date = item.due_date || item.reminder_date || item.note_date || item.checked_on || item.start_date;
    return `<label class="link-picker-row entity-select-row"><input type="${context.mode === 'external_dependency' ? 'radio' : 'checkbox'}" ${context.mode === 'external_dependency' ? 'name="external-dependency-point"' : ''} data-entity-pick="${key}" ${selected.has(key) ? 'checked' : ''}><span class="type-dot ${type}"></span><span><b>${escapeHtml(controllerLabel(item) || 'Cały projekt')} · ${escapeHtml(entityLabel(type, item))}</b><small>${escapeHtml(typeNames[type])} · ${escapeHtml(assigned)}</small></span><span>${badge(item.priority || item.criticality || item.status || item.type)}${date ? `<small>${displayDate(date)}</small>` : ''}</span></label>`;
  }) || '<div class="empty">Brak elementów odpowiadających filtrom.</div>'}</div>`;
  $$('[data-meeting-source]').forEach(button => button.addEventListener('click', () => { $('#entity-selection-type').value = button.dataset.meetingSource; renderEntitySelection(); }));
  $$('[data-meeting-detail]').forEach(button => button.addEventListener('click', () => { const [type, rawId] = button.dataset.meetingDetail.split(':'); operationJump(type, Number(rawId)); }));
  $$('[data-entity-pick]').forEach(input => input.addEventListener('change', () => {
    const [entityType, rawId] = input.dataset.entityPick.split(':');
    const key = `${entityType}:${rawId}`;
    if (context.mode === 'external_dependency') state.selectionDraft = [];
    else state.selectionDraft = state.selectionDraft.filter(item => `${item.entity_type}:${item.entity_id}` !== key);
    if (input.checked) state.selectionDraft.push({ entity_type: entityType, entity_id: Number(rawId) });
    $('#entity-selection-count').textContent = `Wybrano: ${state.selectionDraft.length}`;
  }));
  $('#entity-selection-count').textContent = `Wybrano: ${state.selectionDraft.length}`;
}

function closeEntitySelection() {
  state.selectionContext = null;
  state.selectionDraft = [];
  state.selectionCollections = null;
  $('#entity-selection-dialog').close();
}

async function applyEntitySelection() {
  const context = state.selectionContext;
  if (!context || !state.selectionDraft.length) return toast('Wybierz co najmniej jeden element', true);
  const button = $('#entity-selection-apply');
  button.disabled = true;
  try {
    if (context.mode === 'planner') await api('/api/planner/assign-work', { method: 'POST', body: JSON.stringify({ user_id: context.userId, plan_date: context.date, items: state.selectionDraft }) });
    else if (context.onApply) await context.onApply(state.selectionDraft.map(item => ({ ...item })));
    else await api('/api/calendar/items', { method: 'POST', body: JSON.stringify({ calendar_date: context.date, items: state.selectionDraft }) });
    const count = state.selectionDraft.length;
    closeEntitySelection();
    if (!context.onApply) {
      toast(`${count} elementów zostało ${context.mode === 'planner' ? 'przypisanych' : 'dodanych do kalendarza'}`);
      await loadData();
    }
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

function bindChecklistDelete() { $$('.delete-check').forEach(button => button.addEventListener('click', () => button.closest('.check-row').remove())); }

function collectionForType(type) { return type === 'status' ? state.status : type === 'point' ? state.points : type === 'note' ? state.notes : type === 'goal' ? state.goals : state.tasks; }
function entitySelectOptions(type, selected) { return selectOptions(collectionForType(type).map(item => ({ value: item.id, label: `${entityLabel(type, item)}${item.status ? ` · ${badgeText(item.status)}` : ''}` })), selected); }
function fillEntitySelect() { const type = $('#entity-type').value; const selected = $('#entity-id').dataset.value; $('#entity-id').innerHTML = entitySelectOptions(type, selected); $('#entity-id').dataset.value = ''; }

async function openGoalPicker() {
  $('#picker-search').value = '';
  $('#picker-content').innerHTML = '<div class="loading">Ładowanie wszystkich elementów projektu…</div>';
  $('#goal-picker').showModal();
  try {
    const query = '?controller=all';
    const [status, task, point] = await Promise.all([api('/api/status' + query), api('/api/tasks' + query), api('/api/open-points' + query)]);
    state.goalPickerCollections = { status, task, point };
  } catch (error) { toast(error.message, true); state.goalPickerCollections = { status: state.status, task: state.tasks, point: state.points }; }
  renderGoalPicker();
}

function renderGoalPicker() {
  const query = ($('#picker-search').value || '').toLowerCase();
  const source = state.goalPickerCollections || { status: state.status, task: state.tasks, point: state.points };
  const sections = [['status', 'Status', source.status], ['task', 'Zadania', source.task], ['point', 'Otwarte punkty', source.point]];
  $('#picker-content').innerHTML = sections.map(([type, label, items]) => {
    const rows = (items || []).filter(item => !query || `${entityLabel(type, item)} ${controllerLabel(item)} ${item.category || ''}`.toLowerCase().includes(query)).map(item => ({ type, item }));
    return `<section class="picker-column"><h3>${label}</h3>${pickerGroupHtml(rows, ({ item }) => `<label class="picker-item"><input type="checkbox" data-picker-type="${type}" value="${item.id}" ${state.goalDraftLinks.some(link => link.entity_type === type && link.entity_id === item.id) ? 'checked' : ''}><span><b>${escapeHtml(controllerLabel(item) || 'Cały projekt')} · ${escapeHtml(entityLabel(type, item))}</b><small class="sub">${escapeHtml(badgeText(item.status))}</small></span></label>`) || '<div class="empty">Brak wyników</div>'}</section>`;
  }).join('');
}

function applyGoalPicker() {
  state.goalDraftLinks = $$('[data-picker-type]:checked').map(input => ({ entity_type: input.dataset.pickerType, entity_id: Number(input.value) }));
  $('#goal-picker').close();
  renderGoalLinkPreview();
}

function renderGoalLinkPreview() {
  const container = $('#goal-link-preview');
  if (!container) return;
  const source = state.goalPickerCollections || { status: state.status, task: state.tasks, point: state.points };
  container.innerHTML = state.goalDraftLinks.map(link => { const item = (source[link.entity_type] || []).find(value => value.id === Number(link.entity_id)) || entity(link.entity_type, link.entity_id); return item ? dependencyCardHtml(link.entity_type, item) : ''; }).join('') || '<span class="sub">Nie wybrano elementów.</span>';
  bindDependencyJumps(container);
}

async function loadTimeline(type, id) {
  const entries = await api(`/api/timeline/${encodeURIComponent(type)}/${id}`);
  $('#audit-section').classList.remove('hidden');
  const labels = { change: 'Zmiana', comment: 'Komentarz', meeting: 'Odprawa', announcement: 'Wiadomość', external: 'Komunikacja zewnętrzna' };
  $('#audit-list').innerHTML = entries.map(entry => {
    const changes = entry.event_type === 'change' ? auditChangesHtml(entry.changes || {}) : '';
    const description = entry.description ? `<p>${highlightedComment(entry.description, entry.mentions || [])}</p>` : '';
    const target = entry.announcement_id ? ` data-timeline-announcement="${entry.announcement_id}"` : entry.meeting_id ? ` data-timeline-meeting="${entry.meeting_id}"` : entry.dependency_id ? ` data-timeline-external="${entry.dependency_id}"` : '';
    return `<article class="audit-entry timeline-entry ${escapeHtml(entry.event_type)}"${target}><header><span class="timeline-icon" aria-hidden="true"></span><span><b>${escapeHtml(entry.title || labels[entry.event_type] || 'Aktualizacja')}</b><small>${escapeHtml(entry.author || 'System')} · ${displayDateTime(entry.occurred_at)} · ${escapeHtml(labels[entry.event_type] || '')}</small></span></header>${changes}${description}${target ? '<button type="button" class="mini timeline-open">Otwórz szczegóły</button>' : ''}</article>`;
  }).join('') || '<div class="empty">Oś czasu jest pusta</div>';
  $$('[data-timeline-announcement]').forEach(row => row.querySelector('.timeline-open')?.addEventListener('click', async () => {
    state.announcements = await api('/api/announcements'); rememberDataCache('announcements', state.announcements);
    openAnnouncementDetails(state.announcements.find(item => Number(item.id) === Number(row.dataset.timelineAnnouncement)));
  }));
  $$('[data-timeline-meeting]').forEach(row => row.querySelector('.timeline-open')?.addEventListener('click', async () => {
    state.meetingSummaries = await api('/api/meeting-summaries'); rememberDataCache('meetingSummaries', state.meetingSummaries);
    const meeting = state.meetingSummaries.find(item => Number(item.id) === Number(row.dataset.timelineMeeting));
    if (meeting) openMeetingPlanDetails(meeting); else toast('Odprawa nie jest dostępna', true);
  }));
  $$('[data-timeline-external]').forEach(row => row.querySelector('.timeline-open')?.addEventListener('click', async () => {
    state.externalDependencies = await api('/api/external-dependencies');
    const dependency = state.externalDependencies.find(item => Number(item.id) === Number(row.dataset.timelineExternal));
    if (dependency) openExternalDependencyDetails(dependency); else toast('Zależność nie jest dostępna', true);
  }));
}

function auditAction(action) { return ({ create: 'utworzenie', update: 'edycja', delete: 'usunięcie', migrate: 'migracja danych' })[action] || action; }
function fieldLabel(field) { return ({
  created: 'Utworzenie elementu', migrated: 'Migracja danych', controller_id: 'Sterownik', controller_group_id: 'Zakres hierarchii',
  title: 'Tytuł', description: 'Opis', status: 'Status', priority: 'Priorytet', category: 'Kategoria', subcategory: 'Podkategoria',
  station: 'Stacja / obiekt', function_detail: 'Dane identyfikujące', function_group_id: 'Grupa funkcyjna', function_group_element_id: 'Element grupy', function_group_subcategory_id: 'Podkategoria grupy funkcyjnej', status_group_id: 'Grupa tabeli statusowej', status_subgroup_id: 'Podgrupa tabeli statusowej', matrix_values: 'Wartości tabeli statusowej',
  other_object: 'Inny obiekt', owner: 'Odpowiedzialny (opis)', owner_user_id: 'Odpowiedzialny', responsible: 'Odpowiedzialny (opis)', responsible_user_id: 'Odpowiedzialny', responsible_user_ids: 'Osoby odpowiedzialne', direct_assignee_user_ids: 'Odpowiedzialni', mentioned_user_ids: 'Wspomniane osoby',
  due_date: 'Deadline', reminder_date: 'Przypomnienie', start_date: 'Planowany start', note_date: 'Data wpisu', checked_on: 'Data sprawdzenia', checked_by: 'Sprawdził', recurrence_interval: 'Czas cyklu', recurrence_unit: 'Jednostka cyklu', recurrence_next_task_id: 'Następne zadanie cykliczne',
  current_note: 'Aktualna notatka', environment: 'Środowisko', criticality: 'Krytyczność', evidence_link: 'Dowód / link', info_link: 'Dodatkowe informacje / link',
  impact: 'Wpływ', waiting_for: 'Oczekiwanie na', next_action: 'Następny krok', shift: 'Zmiana', type: 'Typ wpisu', content: 'Treść', sections: 'Informacje przekazania', author: 'Autor', comment: 'Dodany komentarz',
  linked_entity_id: 'Powiązany element', linked_entity_type: 'Typ powiązania', checklist: 'Lista kontrolna / podzadania', scope_checklist: 'Kontrola sterowników w zakresie', task_images: 'Zdjęcia', links: 'Powiązania', requirement_ids: 'Zapotrzebowanie', dependency_task_ids: 'Zależności zadania', dependency_refs: 'Zależności kolejki'
})[field] || field.replaceAll('_', ' '); }

function auditUserName(id) { return state.users.find(user => user.id === Number(id))?.display_name || 'Nieprzypisane'; }
function auditControllerName(id) { return state.controllers.find(item => item.id === Number(id))?.display_name || 'Bez sterownika'; }
function auditLinkName(link) { const item = entity(link?.entity_type, link?.entity_id); return `${({ status: 'Status', task: 'Zadanie', point: 'Otwarty punkt', note: 'Przekazanie statusu', goal: 'Kamień milowy' })[link?.entity_type] || 'Element'}${item ? ` · ${entityLabel(link.entity_type, item)}` : ''}`; }
function formatAuditValue(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (['status', 'priority', 'criticality'].includes(field)) return badgeText(value);
  if (field === 'recurrence_unit') return ({ days: 'Dni', weeks: 'Tygodnie', months: 'Miesiące' })[value] || String(value);
  if (['owner_user_id', 'responsible_user_id', 'created_by'].includes(field)) return auditUserName(value);
  if (['responsible_user_ids', 'direct_assignee_user_ids'].includes(field)) return (value || []).map(auditUserName).join(', ') || '—';
  if (field === 'controller_id') return auditControllerName(value);
  if (field === 'controller_group_id') return state.controllerGroups.find(item => item.id === Number(value))?.path_label || 'Cały projekt';
  if (field === 'function_group_id') return state.config.function_groups.find(item => item.id === Number(value))?.name || 'Bez grupy';
  if (field === 'function_group_element_id') return state.config.function_groups.flatMap(item => item.elements || []).find(item => item.id === Number(value))?.name || 'Bez elementu';
  if (field === 'function_group_subcategory_id') return state.config.function_groups.flatMap(item => item.subcategories || []).find(item => item.id === Number(value))?.name || 'Bez podkategorii';
  if (field === 'status_group_id') return statusGroups().find(item => item.id === Number(value))?.name || 'Bez grupy';
  if (field === 'status_subgroup_id') return statusGroups().flatMap(item => item.subgroups || []).find(item => item.id === Number(value))?.name || 'Bez podgrupy';
  if (field === 'matrix_values') {
    const columns = statusGroups().flatMap(group => [...(group.columns || []), ...(group.subgroups || []).flatMap(subgroup => subgroup.columns || [])]);
    return Object.entries(value || {}).map(([id, cell]) => `${columns.find(column => column.id === Number(id))?.name || `Kolumna ${id}`}: ${badgeMap[cell]?.[0] || cell || '—'}`).join('; ') || '—';
  }
  if (field === 'links') return (value || []).map(auditLinkName).join(', ') || '—';
  if (field === 'requirement_ids') return (value || []).map(id => (state.config.requirements || []).find(item => item.id === Number(id))?.name || 'Usunięta pozycja zapotrzebowania').join(', ') || '—';
  if (field === 'dependency_task_ids') return (value || []).map(id => (state.taskDependencyOptions.length ? state.taskDependencyOptions : state.tasks).find(item => item.id === Number(id))?.title || 'Usunięte zadanie').join(', ') || '—';
  if (field === 'dependency_refs') return (value || []).map(link => auditLinkName(link)).join(', ') || '—';
  if (['due_date', 'reminder_date', 'start_date', 'note_date', 'checked_on'].includes(field)) return displayDate(String(value).slice(0, 10));
  if (Array.isArray(value)) return value.map(item => typeof item === 'object' ? Object.values(item).filter(part => typeof part !== 'object' && part !== null).join(' · ') : String(item)).join(', ') || '—';
  if (typeof value === 'object') return Object.entries(value).map(([key, item]) => `${fieldLabel(key)}: ${String(item ?? '—')}`).join('; ');
  if (value === 1 || value === true) return 'Tak';
  if (value === 0 || value === false) return 'Nie';
  return String(value);
}

function checklistAuditHtml(field, change) {
  const before = Array.isArray(change.from) ? change.from : [];
  const after = Array.isArray(change.to) ? change.to : [];
  const max = Math.max(before.length, after.length);
  const lines = [];
  for (let index = 0; index < max; index += 1) {
    const left = before[index]; const right = after[index];
    if (!left && right) { lines.push(`<li><b>Dodano:</b> ${escapeHtml(right.text || right.controller_label || auditControllerName(right.controller_id))}</li>`); continue; }
    if (left && !right) { lines.push(`<li><b>Usunięto:</b> ${escapeHtml(left.text || left.controller_label || auditControllerName(left.controller_id))}</li>`); continue; }
    const name = right?.text || left?.text || right?.controller_label || left?.controller_label || auditControllerName(right?.controller_id || left?.controller_id);
    const details = [];
    if (Boolean(left?.done) !== Boolean(right?.done)) details.push(`stan: ${left?.done ? 'gotowe' : 'do wykonania'} → ${right?.done ? 'gotowe' : 'do wykonania'}`);
    if (Number(left?.weight || 1) !== Number(right?.weight || 1)) details.push(`waga: ${left?.weight || 1} → ${right?.weight || 1}`);
    if (Number(left?.owner_user_id || 0) !== Number(right?.owner_user_id || 0)) details.push(`wykonawca: ${auditUserName(left?.owner_user_id)} → ${auditUserName(right?.owner_user_id)}`);
    if (left?.text !== right?.text) details.push(`treść: „${left?.text || '—'}” → „${right?.text || '—'}”`);
    if (details.length) lines.push(`<li><b>${escapeHtml(name)}</b>: ${escapeHtml(details.join('; '))}</li>`);
  }
  return `<div class="audit-change complex"><span>${escapeHtml(fieldLabel(field))}</span><ul>${lines.join('') || '<li>Zmieniono kolejność listy.</li>'}</ul></div>`;
}

function matrixValuesAuditHtml(change) {
  const before = change?.from && typeof change.from === 'object' ? change.from : {};
  const after = change?.to && typeof change.to === 'object' ? change.to : {};
  const columns = statusGroups().flatMap(group => [...(group.columns || []), ...(group.subgroups || []).flatMap(subgroup => subgroup.columns || [])]);
  const lines = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(id => String(before[id] ?? '') !== String(after[id] ?? '')).map(id => {
    const column = columns.find(item => Number(item.id) === Number(id));
    const format = value => badgeMap[value]?.[0] || value || '—';
    return `<li><b>${escapeHtml(column?.name || `Kolumna ${id}`)}</b><span>${escapeHtml(format(before[id]))} → <strong>${escapeHtml(format(after[id]))}</strong></span></li>`;
  });
  if (!lines.length) return '';
  return `<div class="audit-change complex matrix-audit-change"><span>${escapeHtml(fieldLabel('matrix_values'))}</span><ul>${lines.join('')}</ul></div>`;
}

function semanticAuditHtml(field, change) {
  if (field === 'meeting_assignment') {
    const meeting = change?.to || {};
    return `<div class="audit-change complex"><span>Odprawa</span><ul><li><b>Dodano do odprawy:</b> ${escapeHtml(meeting.title || 'Bez nazwy')}<small>${displayDate(meeting.period_from)} – ${displayDate(meeting.period_to)}</small></li></ul></div>`;
  }
  if (field === 'recurrence_skipped') return `<div class="audit-change complex"><span>Zadanie cykliczne</span><ul><li><b>Pominięto wystąpienie</b><small>Deadline: ${displayDate(change?.from)} → ${displayDate(change?.to)}</small></li></ul></div>`;
  return '';
}

function statusTransferSectionsAuditHtml(change) {
  const before = Array.isArray(change.from) ? change.from : [];
  const after = Array.isArray(change.to) ? change.to : [];
  const lines = [];
  const sectionLabel = section => `${section?.information_type || 'Informacja'}: ${section?.content || '—'}`;
  const scopeLabels = section => (section?.scopes || []).map(scope => scope.label || (scope.scope_type === 'project' ? 'Cały projekt' : scope.scope_type === 'group' ? state.controllerGroups.find(item => item.id === Number(scope.scope_id))?.path_label : auditControllerName(scope.scope_id))).filter(Boolean);
  const linkLabels = section => (section?.links || []).map(auditLinkName);
  const max = Math.max(before.length, after.length);
  for (let index = 0; index < max; index += 1) {
    const left = before[index]; const right = after[index];
    if (!left && right) { lines.push(`<li><b>Dodano informację ${index + 1}:</b> ${escapeHtml(sectionLabel(right))}<small>Zakres: ${escapeHtml(scopeLabels(right).join(', ') || 'Cały projekt')}${linkLabels(right).length ? ` · Powiązania: ${escapeHtml(linkLabels(right).join(', '))}` : ''}</small></li>`); continue; }
    if (left && !right) { lines.push(`<li><b>Usunięto informację ${index + 1}:</b> ${escapeHtml(sectionLabel(left))}</li>`); continue; }
    const details = [];
    if (left.information_type !== right.information_type) details.push(`typ: ${left.information_type || '—'} → ${right.information_type || '—'}`);
    if (left.content !== right.content) details.push(`treść: „${left.content || '—'}” → „${right.content || '—'}”`);
    const leftScopes = scopeLabels(left).join(', ') || 'Cały projekt'; const rightScopes = scopeLabels(right).join(', ') || 'Cały projekt';
    if (leftScopes !== rightScopes) details.push(`zakres: ${leftScopes} → ${rightScopes}`);
    const leftLinks = linkLabels(left).join(', ') || 'brak'; const rightLinks = linkLabels(right).join(', ') || 'brak';
    if (leftLinks !== rightLinks) details.push(`powiązania: ${leftLinks} → ${rightLinks}`);
    if (details.length) lines.push(`<li><b>Informacja ${index + 1}</b><small>${escapeHtml(details.join('; '))}</small></li>`);
  }
  return `<div class="audit-change complex transfer-audit-change"><span>${escapeHtml(fieldLabel('sections'))}</span><ul>${lines.join('') || '<li>Zmieniono kolejność informacji.</li>'}</ul></div>`;
}

function auditChangesHtml(changes) { return Object.entries(changes || {}).map(([field, change]) => auditChangeHtml(field, change)).join(''); }

function auditChangeHtml(field, change) {
  if (['id', 'project_id', 'test_id', 'issue_id', 'linked_test_id', 'created_at'].includes(field)) return '';
  if (['checklist', 'scope_checklist'].includes(field)) return checklistAuditHtml(field, change);
  if (field === 'matrix_values') return matrixValuesAuditHtml(change);
  if (['meeting_assignment', 'recurrence_skipped'].includes(field)) return semanticAuditHtml(field, change);
  if (field === 'sections') return statusTransferSectionsAuditHtml(change);
  if (field === 'created') return '<div class="audit-change"><span>Utworzenie elementu</span><span><b>Element został dodany</b></span></div>';
  if (field === 'migrated') return '<div class="audit-change"><span>Migracja danych</span><span><b>Element został przeniesiony do aktualnej wersji</b></span></div>';
  return `<div class="audit-change"><span>${escapeHtml(fieldLabel(field))}</span><span>${escapeHtml(formatAuditValue(field, change.from))} → <b>${escapeHtml(formatAuditValue(field, change.to))}</b></span></div>`;
}

async function syncTaskImages(taskId, dialog) {
  const errors = [];
  for (const image of [...(dialog.pendingTaskImages || [])]) {
    try {
      const saved = await api(`/api/tasks/${taskId}/images`, { method: 'POST', body: JSON.stringify(image) });
      dialog.pendingTaskImages = dialog.pendingTaskImages.filter(candidate => candidate !== image);
      dialog.taskImages.push(saved);
    } catch (error) { errors.push(`${image.filename}: ${error.message}`); }
  }
  renderTaskImages();
  return errors;
}

async function saveRecord(event) {
  event.preventDefault();
  if (!state.dialog?.editing) return;
  const { type, record, prefill, duplicateSource } = state.dialog;
  const definition = formDefinitions[type];
  const formData = new FormData(event.currentTarget);
  const input = Object.fromEntries(formData);
  const desiredMatrixValues = type === 'status' ? Object.fromEntries($$('[data-matrix-value]').map(control => [String(control.dataset.column), control.value])) : {};
  input.mentioned_user_ids = formData.getAll('mentioned_user_ids').map(Number);
  input.direct_assignee_user_ids = formData.getAll('direct_assignee_user_ids').map(Number);
  input.dependency_task_ids = formData.getAll('dependency_task_ids').map(Number);
  input.dependency_refs = formData.getAll('dependency_refs').map(value => {
    const [entity_type, entityId] = value.split(':');
    return { entity_type, entity_id: Number(entityId) };
  }).filter(item => ['status', 'task', 'point'].includes(item.entity_type) && item.entity_id);
  input.responsible_user_ids = formData.getAll('responsible_user_ids').map(Number);
  input.requirement_ids = formData.getAll('requirement_ids').map(Number);
  input.scope_group_ids = formData.getAll('scope_group_ids').map(Number);
  input.recipient_user_ids = formData.getAll('recipient_user_ids').map(Number);
  input.label_ids = formData.getAll('label_ids').map(Number);
  if (record?.updated_at) input.updated_at = record.updated_at;
  if (duplicateSource?.id) input.duplicate_source_id = duplicateSource.id;
  if (type === 'status') {
    input.status = record?.status || duplicateSource?.status || 'Never checked';
    if (duplicateSource?.id) input.matrix_values = desiredMatrixValues;
  }
  if (formDefinitions[type].fields.some(field => field[2] === 'multi-links')) { captureMultiLinks(); input.links = state.linkDraft; }
  if (type === 'tasks') {
    input.checklist = $$('#checklist .check-row').map(row => ({ text: row.querySelector('[data-check-text]').value, done: row.querySelector('[data-check-done]').checked, weight: Number(row.querySelector('[data-check-weight]').value) || 1, owner_user_id: Number(row.querySelector('[data-check-owner]').value) || null })).filter(item => item.text.trim());
    input.scope_checklist = $$('#scope-checklist [data-scope-controller]').map(item => ({ controller_id: Number(item.dataset.scopeController), done: item.checked }));
    const statusPayload = await taskStatusChangePayload(record, input.status);
    if (!statusPayload) return;
    Object.assign(input, statusPayload);
  }
  if (type === 'goals') input.links = state.goalDraftLinks;
  if (type === 'notes') $$('[data-toggle]').forEach(toggle => { if (!toggle.checked) input[toggle.dataset.toggle] = null; });
  try {
    let saved = await api(definition.endpoint + (record ? `/${record.id}` : ''), { method: record ? 'PATCH' : 'POST', body: JSON.stringify(input) });
    if (type === 'tasks' && saved?.id) {
      const imageErrors = await syncTaskImages(saved.id, state.dialog);
      saved.images = [...state.dialog.taskImages]; saved.image_count = saved.images.length;
      state.dialog.record = saved;
      if (imageErrors.length) {
        toast(`Zadanie zapisano, ale część operacji na zdjęciach nie powiodła się: ${imageErrors.join(' ')}`, true);
        return;
      }
    }
    if (type === 'status' && saved?.id) {
      const columns = statusEditorColumns(saved.status_group_id, saved.status_subgroup_id);
      for (const column of columns) {
        const desired = desiredMatrixValues[String(column.id)];
        const current = saved.matrix_values?.[column.id] ?? (column.field_type === 'status' ? saved.status : '');
        if (desired === undefined || String(desired) === String(current ?? '')) continue;
        const payload = { value: desired, updated_at: saved.updated_at };
        if (column.field_type === 'status') {
          const statusPayload = await statusChangePayload({ ...saved, status: current }, desired, { dependencyRefs: saved.dependency_refs, commentAlreadyAdded: state.dialog.commentAdded });
          if (!statusPayload) { state.dialog.record = saved; toast('Dane punktu zapisano, ale anulowano zmianę podpunktu statusowego.', true); return; }
          Object.assign(payload, statusPayload);
        }
        saved = await api(`/api/status/${saved.id}/cells/${column.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      }
    }
    if (!record && prefill?._calendar_date && saved?.id) await api('/api/calendar/items', { method: 'POST', body: JSON.stringify({ calendar_date: prefill._calendar_date, items: [{ entity_type: typeToEntity(type), entity_id: saved.id }] }) });
    if (type === 'controllers') state.controller = 'all';
    toast('Zapisano zmiany');
    await finishRecordMutation();
  } catch (error) { toast(error.message, true); }
}

async function deleteRecord() {
  const { type, record } = state.dialog;
  if (!await uiConfirm('Usuń rekord', 'Operacja zostanie zapisana w historii zmian.', 'Usuń rekord', true)) return;
  try {
    await api(`${formDefinitions[type].endpoint}/${record.id}`, { method: 'DELETE' });
    toast('Usunięto rekord');
    await finishRecordMutation();
  } catch (error) { toast(error.message, true); }
}

async function skipRecurringTask() {
  const { type, record } = state.dialog || {};
  if (type !== 'tasks' || !record || !Number(record.recurrence_interval || 0)) return;
  if (!await uiConfirm('Pomiń bieżące zadanie', `Zadanie „${record.title}” zostanie usunięte, a następne wystąpienie otrzyma deadline liczony od obecnego terminu.`, 'Pomiń zadanie', true)) return;
  try {
    const next = await api(`/api/tasks/${record.id}/skip-recurrence`, { method: 'POST' });
    toast(`Pominięto zadanie. Nowy deadline: ${displayDate(next.due_date)}`);
    await finishRecordMutation();
  } catch (error) { toast(error.message, true); }
}

async function jumpTo(type, id, projectId = null) {
  if (projectId && Number(projectId) !== Number(state.me.current_project?.id)) {
    try {
      state.me = await api('/api/select-project', { method: 'POST', body: JSON.stringify({ project_id: Number(projectId) }) });
      state.projects = state.me.projects || []; state.controller = 'all'; state.activeSavedView = {}; updateIdentity(); await loadData(); startLiveSync();
    } catch (error) { return toast(error.message, true); }
  }
  const view = type === 'task' || type === 'tasks' ? 'tasks' : type === 'point' || type === 'points' ? 'points' : type === 'note' || type === 'notes' ? 'notes' : type === 'goal' || type === 'goals' ? 'goals' : 'status';
  await setView(view);
  let item = entity(type, id);
  if (!item) {
    const endpoint = { status: '/api/status?controller=all', tasks: '/api/tasks?controller=all', points: '/api/open-points?controller=all', notes: '/api/daily-notes?controller=all', goals: '/api/goals?controller=all' }[view];
    try { item = (await api(endpoint)).find(candidate => Number(candidate.id) === Number(id)); } catch {}
  }
  if (item) {
    if (view === 'notes') openStatusTransferEditor(item);
    else openRecord(view, item);
  }
}

async function openEntityOverlay(type, id) {
  const entityType = ({ tasks: 'task', points: 'point', notes: 'note', goals: 'goal' })[type] || type;
  const view = ({ task: 'tasks', point: 'points', note: 'notes', goal: 'goals', status: 'status' })[entityType];
  const endpoint = {
    status: '/api/status?controller=all', task: '/api/tasks?controller=all', point: '/api/open-points?controller=all',
    note: `/api/daily-notes?controller=all&from=${addDays(today(), -3650)}&to=${addDays(today(), 3650)}`, goal: '/api/goals?controller=all'
  }[entityType];
  if (!view || !endpoint) return;
  let item = entity(entityType, id);
  try { item = (await api(endpoint)).find(candidate => Number(candidate.id) === Number(id)) || item; }
  catch (error) { if (!item) return toast(`Nie udało się otworzyć szczegółów: ${error.message}`, true); }
  if (!item) return toast('Element nie jest już dostępny', true);
  if (entityType === 'note') openStatusTransferEditor(item);
  else openRecord(view, item);
}

function bindJumpItems() {
  $$('[data-jump]').forEach(item => item.addEventListener('click', () => { const projectId = Number(item.dataset.projectId) || null; if (projectId && Number(projectId) !== Number(state.me.current_project?.id)) jumpTo(item.dataset.jump, Number(item.dataset.id), projectId); else openEntityOverlay(item.dataset.jump, Number(item.dataset.id)); }));
  $$('.jump[data-type]').forEach(item => item.addEventListener('click', event => { event.stopPropagation(); openEntityOverlay(item.dataset.type, Number(item.dataset.id)); }));
}

let toastTimer;
function elevateVisibleToast() {
  const element = $('#toast');
  if (!element?.classList.contains('show')) return;
  if (element.matches(':popover-open')) element.hidePopover();
  const activeModal = [...document.querySelectorAll('dialog:modal')].at(-1);
  if (activeModal) {
    element.removeAttribute('popover');
    activeModal.append(element);
  } else {
    element.setAttribute('popover', 'manual');
    document.body.append(element);
    if ('showPopover' in element) element.showPopover();
  }
}
function toast(message, error = false) {
  const element = $('#toast');
  if (element.matches(':popover-open')) element.hidePopover();
  element.textContent = message;
  element.className = `toast show${error ? ' error' : ''}`;
  elevateVisibleToast();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (element.matches(':popover-open')) element.hidePopover();
    element.className = 'toast';
    element.setAttribute('popover', 'manual');
    document.body.append(element);
  }, error ? 5200 : 3200);
}

initialize();
