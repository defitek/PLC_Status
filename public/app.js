const state = {
  view: 'overview', controller: 'all', me: null, projects: [], controllerGroups: [], controllers: [], users: [],
  config: { categories: [], task_categories: [], function_groups: [], options: [], settings: {} },
  overview: null, announcements: [], notifications: [], mine: null, dashboard: {}, status: [], tasks: [], points: [], notes: [], goals: [], planner: null, calendar: null, history: [],
  dialog: null, dialogInitial: '', dirtyCloseAttempt: new WeakSet(), goalDraftLinks: [], goalPickerCollections: null, linkDraft: [], taskMode: 'board', taskShowCompleted: false, pointMode: 'list', trendPeriod: 'week',
  functionGroupController: '', functionPointGroup: null, functionPointDraft: [], quickStatusDraft: [],
  notesFrom: '', notesTo: '', notesWeek: '', draggingTask: false, plannerFrom: '', plannerDays: 14,
  plannerCell: null, plannerClipboard: null, plannerDragEntry: null, calendarFrom: '', calendarTo: '', calendarMode: 'week', calendarTypes: ['task', 'point', 'status', 'goal', 'note', 'annotation'], calendarPriorities: ['Low', 'Medium', 'High', 'Critical'], calendarOnlyMine: false, calendarCategory: '',
  kpiModules: ['status', 'tasks', 'points', 'goals'], globalTrendMode: 'combined', overviewDetailed: false, detailedKpiMode: 'combined', detailedKpiPeriod: 'week', linkPickerAllowed: [], linkPickerDraft: [], linkPickerCollections: null, actionResolve: null, actionDialogGeneration: 0, actionClosingGeneration: 0, configPanel: null, configScroll: 0, hierarchySelection: null, dailySummaryOpening: false,
  selectionContext: null, selectionDraft: [], selectionCollections: null, duplicateSource: null, checklistTask: null, notificationSeen: new Set(), previewTimer: null,
  grouping: { status: 'category', tasks: '', notes: 'controller', history: 'hierarchy' },
  sort: { status: { key: '', direction: 1 }, tasks: { key: '', direction: 1 }, points: { key: '', direction: 1 } }
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

const pageCopy = {
  overview: ['Overview', 'Liczbowy obraz gotowości całego projektu', ''],
  announcements: ['Informator', 'Wiadomości operacyjne, decyzje i komunikaty projektu', '+ Nowa wiadomość'],
  mine: ['Moje podsumowanie', 'Twoje zadania, odpowiedzialności, wzmianki i aktywność', ''],
  planner: ['Planner', 'Planowanie manpoweru, obszarów, zmian i transportu', ''],
  calendar: ['Kalendarz', 'Zintegrowany harmonogram projektu do 31 dni', '+ Adnotacja'],
  status: ['Status', 'Testy uruchomieniowe według kolejności projektu', '+ Dodaj test'],
  tasks: ['Zadania', 'Plan pracy zespołu, checklisty i odpowiedzialności', '+ Nowe zadanie'],
  goals: ['Cele', 'Cele projektu łączące status, zadania i otwarte punkty', '+ Nowy cel'],
  points: ['Otwarte punkty', 'Problemy, oczekiwania i przypomnienia', '+ Nowy punkt'],
  notes: ['Dzienne notatki', 'Historia zmianowa i powiązania z pracą zespołu', '+ Dodaj notatkę'],
  history: ['Historia', 'Wszystkie zmiany w danych projektu z bezpośrednim przejściem', ''],
  settings: ['Konfiguracja', 'Kolejność, sterowniki, użytkownicy, kategorie i słowniki', '']
};

const badgeMap = {
  Done: ['Gotowe', 'green'], 'In progress': ['W trakcie', 'blue'], 'Ready to test': ['Do testu', 'amber'],
  Blocked: ['Zablokowane', 'red'], 'NOK / Rework': ['NOK / poprawa', 'red'], 'Retest required': ['Retest', 'amber'],
  'Not started': ['Nie rozpoczęto', 'gray'], 'N/A': ['N/A', 'gray'], 'To do': ['Do zrobienia', 'gray'],
  Open: ['Otwarte', 'red'], Waiting: ['Oczekiwanie', 'amber'], Closed: ['Zamknięte', 'green'],
  Critical: ['Krytyczny', 'red'], High: ['Wysoki', 'amber'], Medium: ['Średni', 'blue'], Low: ['Niski', 'green']
};
const badge = value => { const item = badgeMap[value] || [value || '—', 'gray']; return `<span class="badge ${item[1]}">${escapeHtml(item[0])}</span>`; };

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  if (response.status === 401) { location.href = '/login.html'; throw new Error('Sesja wygasła'); }
  if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || `Błąd serwera (${response.status})`);
  return response.status === 204 ? null : response.json();
}

function roleName(role) { return ({ system_admin: 'Administrator systemu', project_admin: 'Administrator projektu', admin: 'Administrator', moderator: 'Manager projektu', user: 'Użytkownik' })[role] || role; }
function options(kind) { return state.config.options.filter(item => item.kind === kind).map(item => item.value); }
function statusCategories() { return state.config.categories.map(item => item.name); }
function taskCategories() { return state.config.task_categories.map(item => item.name); }
function functionGroups(controllerCode) { return (state.config.function_groups || []).filter(item => !controllerCode || item.controller === controllerCode); }
function assignableUsers() { return state.users.filter(item => item.active && item.project_active && item.system_role !== 'system_admin'); }
function controllerLabel(item) {
  if (!item) return '';
  if (item.scope_label) return item.scope_label;
  if (item.controller_label) return item.controller_label;
  const code = typeof item === 'string' ? item : item.controller || item.code;
  return state.controllers.find(controller => controller.code === code)?.display_name || code || '';
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
  return `<option value="">${blank}</option>${items.map(item => {
    const value = typeof item === 'object' ? item.value : item;
    const label = typeof item === 'object' ? item.label : item;
    return `<option value="${escapeHtml(value)}"${String(value) === String(selected) ? ' selected' : ''}>${escapeHtml(label)}</option>`;
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

function sortRows(rows, sort) {
  if (!sort.key) return [...rows];
  return [...rows].sort((left, right) => {
    const a = left[sort.key] ?? '';
    const b = right[sort.key] ?? '';
    return String(a).localeCompare(String(b), 'pl', { numeric: true, sensitivity: 'base' }) * sort.direction;
  });
}

function updateSort(module, key) {
  const sort = state.sort[module];
  if (sort.key === key) sort.direction *= -1;
  else { sort.key = key; sort.direction = 1; }
  const root = module === 'status' ? '#status-panel' : module === 'tasks' ? '#task-list-panel' : '#points-panel';
  $$(`${root} th[data-sort]`).forEach(header => { header.textContent = `${header.dataset.label}${sortMarker(module, header.dataset.sort)}`; });
  if (module === 'status') drawStatusRows();
  else if (module === 'tasks') drawTaskListRows();
  else drawPointRows();
}

function sortMarker(module, key) {
  const sort = state.sort[module];
  return sort.key === key ? (sort.direction === 1 ? ' ↑' : ' ↓') : '';
}

function filterRows(rows, root) {
  const filters = Object.fromEntries($$(`${root} [data-filter]`).map(input => [input.dataset.filter, input.value.toLowerCase()]));
  return rows.filter(row => Object.entries(filters).every(([key, value]) => {
    if (!value) return true;
    const source = key === '_all' ? JSON.stringify(row) : key === 'station' ? [row.station, row.function_detail].join(' ') : key === 'title' ? [row.title, row.description].join(' ') : row[key];
    return String(source ?? '').toLowerCase().includes(value);
  }));
}

async function initialize() {
  try {
    state.me = await api('/api/me');
    state.projects = state.me.projects || [];
    applyTheme(state.me.theme || 'blue');
    bindShell();
    updateIdentity();
    if (!state.me.current_project) openProjectDialog(true);
    else await loadData();
    startNotificationPolling();
  } catch (error) { toast(error.message, true); }
}

function updateIdentity() {
  $('#me').textContent = `${state.me.display_name} · ${roleName(state.me.role)}`;
  $('#project-switch').textContent = state.me.current_project ? `${state.me.current_project.code} · ${state.me.current_project.name}` : 'Wybierz projekt';
  $('#settings-nav').hidden = !state.me.current_project || state.me.role === 'user';
}

function bindShell() {
  $$('#nav button').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $('#mobile-menu').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $('#sidebar-backdrop').addEventListener('click', () => document.body.classList.remove('nav-open'));
  $('#controller').addEventListener('change', async event => { state.controller = event.target.value; await loadData(); });
  $('#add').addEventListener('click', () => state.view === 'calendar' ? openCalendarAnnotation() : openRecord(state.view));
  $('#close').addEventListener('click', () => $('#modal').close());
  $('#cancel').addEventListener('click', () => $('#modal').close());
  $('#form').addEventListener('submit', saveRecord);
  $('#remove').addEventListener('click', deleteRecord);
  $('#duplicate').addEventListener('click', () => { const { type, record } = state.dialog || {}; if (record) openDuplicate(type, record); });
  $('#audit-toggle').addEventListener('click', toggleAudit);
  $('#comment-add').addEventListener('click', addEntityComment);
  $('#logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); location.href = '/login.html'; });
  $('#project-switch').addEventListener('click', () => openProjectDialog(false));
  $('#project-close').addEventListener('click', () => { if (state.me.current_project) $('#project-dialog').close(); });
  $('#theme-switch').addEventListener('click', openThemeDialog);
  $('#daily-summary-open').addEventListener('click', () => state.me.current_project ? openDailySummary(false) : toast('Najpierw wybierz projekt', true));
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
  $('#quick-status-close').addEventListener('click', () => $('#quick-status-dialog').close());
  $('#quick-status-cancel').addEventListener('click', () => $('#quick-status-dialog').close());
  $('#quick-status-search').addEventListener('input', () => { captureQuickStatusRows(); renderQuickStatusRows(); });
  $('#quick-status-save').addEventListener('click', saveQuickStatus);
  $('#quick-status-expand').addEventListener('click', () => { const dialog = $('#quick-status-dialog'); dialog.classList.toggle('maximized'); $('#quick-status-expand').textContent = dialog.classList.contains('maximized') ? 'Zmniejsz' : 'Rozszerz'; });
  $('#bulk-status-open').addEventListener('click', openBulkStatus);
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
  $('#action-form').addEventListener('submit', event => { event.preventDefault(); finishAction(Object.fromEntries(new FormData(event.currentTarget))); });
  $('#insight-close').addEventListener('click', () => $('#insight-dialog').close());
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
  $('#requirement-level').addEventListener('change', renderPlannerRequirementsCalendar);
  $('#planner-requirements-save').addEventListener('click', savePlannerRequirementsCalendar);
  $('#planner-holiday-add').addEventListener('click', addPlannerHoliday);
  $('#planner-hours-close').addEventListener('click', () => $('#planner-hours-dialog').close());
  $('#task-checklist-close').addEventListener('click', () => $('#task-checklist-dialog').close());
  $('#task-checklist-cancel').addEventListener('click', () => $('#task-checklist-dialog').close());
  $('#task-checklist-save').addEventListener('click', saveTaskChecklistPopup);
  $('#notification-open').addEventListener('click', openNotifications);
  $('#notifications-close').addEventListener('click', () => $('#notifications-dialog').close());
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
  document.addEventListener('click', event => { if (!event.target.closest('#context-menu')) $('#context-menu').classList.add('hidden'); });
  document.addEventListener('pointerover', previewPointerOver);
  document.addEventListener('pointerout', previewPointerOut);
  installDialogOutsideClose();
}

function fillScopeSelect(select, selected = 'all') {
  if (!select) return;
  const children = parentId => state.controllerGroups.filter(group => Number(group.parent_id || 0) === Number(parentId || 0));
  const controllers = groupId => state.controllers.filter(item => Number(item.group_id || 0) === Number(groupId || 0));
  const lines = ['<option value="all">Cały projekt</option>'];
  const walk = (parentId, depth) => {
    for (const group of children(parentId)) {
      const indent = '  '.repeat(depth);
      lines.push(`<option value="group:${group.id}">${indent}▰ ${escapeHtml(group.name)} — ${group.parent_id ? 'podobszar' : 'obszar'}</option>`);
      for (const item of controllers(group.id)) lines.push(`<option value="${escapeHtml(item.code)}">${indent}  └ ${escapeHtml(item.display_name || item.code)}</option>`);
      walk(group.id, depth + 1);
    }
  };
  walk(null, 0);
  for (const item of controllers(null)) lines.push(`<option value="${escapeHtml(item.code)}">◇ ${escapeHtml(item.display_name || item.code)} — bez obszaru</option>`);
  select.innerHTML = lines.join('');
  select.value = [...select.options].some(option => option.value === selected) ? selected : 'all';
  state.controller = select.value;
}

function openProjectDialog(mandatory = false) {
  const dialog = $('#project-dialog');
  $('#project-close').hidden = mandatory || !state.me.current_project;
  $('#project-list').innerHTML = state.projects.map(project => `<button type="button" class="project-option" data-project-id="${project.id}"><span class="project-code">${escapeHtml(project.code.slice(0, 5))}</span><span><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.description || 'Projekt bez opisu')}</small></span><span class="badge blue">${escapeHtml(roleName(project.project_role))}</span></button>`).join('') || '<div class="empty">Brak dostępnych projektów. Skontaktuj się z administratorem systemu.</div>';
  $$('.project-option').forEach(button => button.addEventListener('click', async () => {
    try {
      state.me = await api('/api/select-project', { method: 'POST', body: JSON.stringify({ project_id: Number(button.dataset.projectId) }) });
      state.projects = state.me.projects || [];
      state.controller = 'all';
      updateIdentity();
      dialog.close();
      await loadData();
      toast(`Wybrano projekt ${state.me.current_project.code}`);
    } catch (error) { toast(error.message, true); }
  }));
  if (!dialog.open) dialog.showModal();
}

const themes = [
  ['blue', 'Niebiesko-biały', 'Domyślny, jasny i nowoczesny', '#eef5fc', '#0b3a75', '#fff'],
  ['dark', 'Nocny', 'Ciemny granat do pracy wieczorem', '#08111e', '#071426', '#101c2c'],
  ['graphite', 'Grafitowy', 'Neutralny ciemny interfejs', '#191b1f', '#24262b', '#30333a'],
  ['contrast', 'Wysoki kontrast', 'Wyraźne obramowania i czytelność', '#fff', '#000', '#fff'],
  ['classic', 'Klasyczny (backup)', 'Poprzednia szata graficzna V3', '#f4f6f9', '#172554', '#fff']
];
function applyTheme(theme) { document.documentElement.dataset.theme = theme === 'blue' ? '' : theme; state.me.theme = theme; }
function openThemeDialog() {
  $('#theme-list').innerHTML = themes.map(([id, name, description, bg, nav, card]) => `<button type="button" class="theme-card ${state.me.theme === id ? 'active' : ''}" data-theme="${id}"><span class="theme-preview" style="--preview-bg:${bg};--preview-nav:${nav};--preview-card:${card}"><i></i><span></span></span><strong>${name}</strong><small class="sub">${description}</small></button>`).join('');
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
  const statuses = type === 'points' ? ['Open', 'Waiting', 'In progress', 'Closed'] : ['Not started', 'Ready to test', 'In progress', 'Blocked', 'NOK / Rework', 'Retest required', 'Done', 'N/A'];
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
  $('#action-secondary').hidden = !secondaryLabel;
  $('#action-secondary').textContent = secondaryLabel;
  $('#action-secondary').className = secondaryDanger ? 'danger' : 'secondary';
  $('#action-fields').innerHTML = fields.map(field => {
    const optionsHtml = (field.options || []).map(option => {
      const value = typeof option === 'object' ? option.value : option;
      const label = typeof option === 'object' ? option.label : option;
      return `<option value="${escapeHtml(value)}"${String(value) === String(field.value ?? '') ? ' selected' : ''}>${escapeHtml(label)}</option>`;
    }).join('');
    const input = field.type === 'textarea'
      ? `<textarea name="${escapeHtml(field.name)}" rows="${field.rows || 4}" ${field.required ? 'required' : ''}>${escapeHtml(field.value || '')}</textarea>`
      : field.type === 'select'
        ? `<select name="${escapeHtml(field.name)}">${optionsHtml}</select>`
        : field.type === 'checkbox'
          ? `<input name="${escapeHtml(field.name)}" type="checkbox" value="1" ${field.value ? 'checked' : ''}>`
          : `<input name="${escapeHtml(field.name)}" type="${field.type || 'text'}" value="${escapeHtml(field.value ?? '')}" ${field.required ? 'required' : ''}>`;
    return `<label class="field ${field.full ? 'full' : ''}"><span>${escapeHtml(field.label || field.name)}</span>${input}${field.hint ? `<small class="sub">${escapeHtml(field.hint)}</small>` : ''}</label>`;
  }).join('') || `<p class="dialog-confirm-text">${escapeHtml(description || 'Czy na pewno chcesz kontynuować?')}</p>`;
  if (state.actionResolve) state.actionResolve(null);
  return new Promise(resolve => {
    state.actionResolve = resolve;
    dialog.dataset.dirty = '';
    if (!dialog.open) dialog.showModal();
    $('#action-fields input, #action-fields textarea, #action-fields select')?.focus();
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

async function loadData() {
  if ($('#config-full-dialog')?.open) state.configScroll = $('#config-full-content')?.scrollTop || 0;
  $('#content').innerHTML = '<div class="loading">Ładowanie danych…</div>';
  const query = `?controller=${encodeURIComponent(state.controller)}`;
  state.notesFrom ||= twoWeeksAgo();
  state.notesTo ||= today();
  state.plannerFrom ||= mondayOf(today());
  state.calendarFrom ||= mondayOf(today());
  state.calendarTo ||= addDays(state.calendarFrom, 6);
  const notesQuery = `${query}&from=${state.notesFrom}&to=${state.notesTo}`;
  const plannerQuery = `?from=${state.plannerFrom}&to=${addDays(state.plannerFrom, state.plannerDays - 1)}`;
  const calendarParams = new URLSearchParams({ controller: state.controller, from: state.calendarFrom, to: state.calendarTo, only_mine: state.calendarOnlyMine ? '1' : '0', category: state.calendarCategory });
  state.calendarTypes.forEach(type => calendarParams.append('type', type));
  state.calendarPriorities.forEach(priority => calendarParams.append('priority', priority));
  [state.controllerGroups, state.controllers, state.users, state.config, state.overview, state.announcements, state.notifications, state.mine, state.dashboard, state.status, state.tasks, state.points, state.notes, state.goals, state.planner, state.calendar, state.history] = await Promise.all([
    api('/api/controller-groups'), api('/api/controllers'), api('/api/users'), api('/api/config'), api('/api/overview' + query), api('/api/announcements'), api('/api/notifications'), api('/api/my-summary'),
    api('/api/dashboard' + query), api('/api/status' + query), api('/api/tasks' + query), api('/api/open-points' + query),
    api('/api/daily-notes' + notesQuery), api('/api/goals' + query), api('/api/planner' + plannerQuery), api('/api/calendar?' + calendarParams), api('/api/history?limit=200')
  ]);
  if (!state.controllers.some(item => item.code === state.functionGroupController)) {
    state.functionGroupController = state.controller !== 'all' && state.controllers.some(item => item.code === state.controller)
      ? state.controller : state.controllers[0]?.code || '';
  }
  const current = state.controller;
  fillScopeSelect($('#controller'), current);
  updateCounts();
  updateNotificationUi(true);
  renderTopNews();
  render();
  const summaryKey = `daily-summary:${state.me.current_project?.id}:${today()}`;
  if (state.me.current_project && !sessionStorage.getItem(summaryKey) && !state.dailySummaryOpening) {
    sessionStorage.setItem(summaryKey, '1');
    queueMicrotask(() => openDailySummary(true));
  }
}

function updateCounts() {
  $('#n-announcements').textContent = state.announcements.length;
  $('#n-status').textContent = state.status.length;
  $('#n-tasks').textContent = state.tasks.filter(item => item.status !== 'Done').length;
  $('#n-goals').textContent = state.goals.filter(item => item.status !== 'Done').length;
  $('#n-points').textContent = state.points.filter(item => item.status !== 'Closed').length;
  $('#n-notes').textContent = state.notes.length;
}

let notificationPollTimer;
function startNotificationPolling() {
  clearInterval(notificationPollTimer);
  notificationPollTimer = setInterval(async () => {
    if (!state.me?.current_project || document.hidden) return;
    try {
      state.notifications = await api('/api/notifications');
      updateNotificationUi(true);
    } catch { /* kolejna próba nastąpi automatycznie */ }
  }, 30000);
}

function notificationTarget(notification) {
  if (notification.entity_type === 'announcement') return state.announcements.find(item => item.id === Number(notification.entity_id));
  return entity(notification.entity_type, notification.entity_id);
}

function updateNotificationUi(showPush = false) {
  const unread = (state.notifications || []).filter(item => !item.read_at);
  $('#notification-count').textContent = unread.length;
  $('#notification-open').classList.toggle('has-unread', unread.length > 0);
  if (!showPush) return;
  unread.slice().reverse().forEach(item => {
    if (state.notificationSeen.has(item.id)) return;
    state.notificationSeen.add(item.id);
    const root = $('#push-stack');
    const card = document.createElement('article');
    card.className = `push-message ${item.kind}`;
    card.innerHTML = `<span class="push-icon">${item.kind === 'assignment' ? '✓' : item.kind === 'announcement' ? '◆' : '●'}</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.message || '')}</small></span><button type="button" aria-label="Zamknij">×</button>`;
    card.addEventListener('click', event => { if (event.target.closest('button')) return; openNotification(item); });
    card.querySelector('button').addEventListener('click', () => card.remove());
    root.append(card);
    setTimeout(() => card.remove(), 9000);
  });
}

function openNotifications() {
  const rows = state.notifications || [];
  $('#notifications-list').innerHTML = rows.map(item => `<button type="button" class="notification-row ${item.read_at ? 'read' : 'unread'}" data-notification-id="${item.id}"><span class="type-dot ${item.entity_type === 'announcement' ? 'goal' : item.entity_type}"></span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.message || '')}</small><time>${displayDateTime(item.created_at)}</time></span><em>${item.read_at ? 'przeczytane' : 'nowe'}</em></button>`).join('') || '<div class="empty">Brak powiadomień.</div>';
  $$('[data-notification-id]').forEach(button => button.addEventListener('click', () => openNotification(rows.find(item => item.id === Number(button.dataset.notificationId)))));
  $('#notifications-dialog').showModal();
}

async function openNotification(item) {
  if (!item) return;
  try {
    if (!item.read_at) {
      const updated = await api(`/api/notifications/${item.id}/read`, { method: 'POST' });
      Object.assign(item, updated);
      updateNotificationUi(false);
    }
  } catch (error) { toast(error.message, true); }
  $('#notifications-dialog').close();
  if (item.entity_type === 'announcement') {
    const announcement = notificationTarget(item);
    if (announcement) openAnnouncementDetails(announcement);
    return;
  }
  const target = notificationTarget(item);
  if (target) jumpTo(item.entity_type, item.entity_id);
  else toast('Powiązany element nie jest już dostępny', true);
}

async function acknowledgeAnnouncement(id) {
  try {
    const updated = await api(`/api/announcements/${id}/ack`, { method: 'POST' });
    const index = state.announcements.findIndex(item => item.id === Number(id));
    if (index >= 0) state.announcements[index] = updated;
    state.notifications = await api('/api/notifications');
    updateNotificationUi(false);
    renderTopNews();
    openAnnouncementDetails(updated);
    toast('Wiadomość została oznaczona jako przeczytana');
  } catch (error) { toast(error.message, true); }
}

function setView(view) {
  if (view === 'settings' && state.me.role === 'user') return;
  state.view = view;
  document.body.classList.remove('nav-open');
  $$('#nav button').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  render();
}

function render() {
  const copy = pageCopy[state.view];
  $('#title').textContent = copy[0];
  $('#desc').textContent = copy[1];
  $('#add').textContent = copy[2];
  $('#add').hidden = !copy[2];
  ({ overview: renderOverview, announcements: renderAnnouncements, mine: renderMine, planner: renderPlanner, calendar: renderCalendar, status: renderStatus, tasks: renderTasks, goals: renderGoals, points: renderPoints, notes: renderNotes, history: renderHistory, settings: renderSettings })[state.view]();
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

function renderTopNews() {
  const root = $('#top-news');
  if (!root) return;
  const latest = state.announcements.slice(0, 5);
  root.innerHTML = latest.length ? `<span class="top-news-label">Informator</span><div class="news-ticker"><div class="news-ticker-track">${latest.map(item => `<button type="button" data-news-id="${item.id}" title="${escapeHtml(item.title)}"><time>${displayDate(item.created_at.slice(0, 10))}</time><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.content)}</span></button>`).join('')}</div></div>` : '<span class="top-news-empty">Brak nowych komunikatów</span>';
  root.querySelectorAll('[data-news-id]').forEach(button => button.addEventListener('click', () => openAnnouncementDetails(state.announcements.find(item => item.id === Number(button.dataset.newsId)))));
}

function openAnnouncementDetails(item) {
  if (!item) return;
  $('#insight-title').textContent = item.title;
  $('#insight-description').textContent = `${announcementAudience(item)} · ${item.created_by_name || 'System'} · ${displayDateTime(item.created_at)}`;
  const href = safeExternalLink(item.info_link);
  $('#insight-content').innerHTML = `<article class="announcement-detail"><p>${escapeHtml(item.content).replace(/\n/g, '<br>')}</p>${href ? `<a class="announcement-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">Otwórz dołączony link ↗</a>` : ''}<div class="announcement-audience"><span><b>Zakres:</b> ${escapeHtml(announcementAudience(item))}</span><span><b>Dotyczy bezpośrednio:</b> ${escapeHtml((item.recipient_names || []).join(', ') || 'bez wskazania osób')}</span></div><div class="goal-links">${(item.links || []).map(link => linkChip(link.entity_type, link.entity_id, ({ status: 'Status', task: 'Zadanie', point: 'Otwarty punkt', note: 'Dziennik', goal: 'Cel' })[link.entity_type])).join('') || '<span class="sub">Brak przypiętych elementów</span>'}</div>${!item.accepted_by_me ? '<button class="primary" id="ack-announcement">Akceptuję · przeczytane</button>' : `<span class="announcement-read-self">✓ Zaakceptowano ${displayDateTime(item.accepted_at)}</span>`}${canManageAnnouncements() ? `<section class="announcement-receipts"><header><b>Potwierdzenia przeczytania</b><span>${item.accepted_count || 0}/${item.audience_count || 0}</span></header><div>${(item.accepted_users || []).map(user => `<span><b>${escapeHtml(user.display_name)}</b><small>${displayDateTime(user.read_at)}</small></span>`).join('') || '<small>Brak potwierdzeń.</small>'}</div></section><button class="secondary" id="edit-announcement-detail">Edytuj wiadomość</button>` : ''}</article>`;
  bindJumpItems();
  $('#ack-announcement')?.addEventListener('click', () => acknowledgeAnnouncement(item.id));
  $('#edit-announcement-detail')?.addEventListener('click', () => { $('#insight-dialog').close(); openRecord('announcements', item); });
  if (!$('#insight-dialog').open) $('#insight-dialog').showModal();
}

function renderAnnouncements() {
  $('#add').hidden = !canManageAnnouncements();
  $('#content').innerHTML = `<section class="announcements-feed">${state.announcements.map(item => {
    const href = safeExternalLink(item.info_link);
    return `<article class="announcement-card ${item.accepted_by_me ? 'read' : 'unread'}" data-announcement-id="${item.id}"><header><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.created_by_name || 'System')} · ${displayDateTime(item.created_at)}</small></span><span class="badge blue">${escapeHtml(announcementAudience(item))}</span></header><p>${escapeHtml(item.content)}</p><footer><span>${(item.recipient_names || []).length ? `Osoby: ${escapeHtml(item.recipient_names.join(', '))}` : 'Wiadomość ogólna'}</span><span>${item.accepted_by_me ? '✓ przeczytane' : 'wymaga potwierdzenia'}${canManageAnnouncements() ? ` · ${item.accepted_count || 0}/${item.audience_count || 0} potwierdzeń` : ''}</span></footer></article>`;
  }).join('') || '<div class="empty">Informator nie zawiera jeszcze wiadomości.</div>'}</section>`;
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
  const data = state.overview;
  const scopeLabel = $('#controller')?.selectedOptions?.[0]?.textContent?.trim() || 'Cały projekt';
  const score = combinedMetric(data.overall);
  const trends = data.trends?.[state.trendPeriod] || [];
  const modules = [
    ['status', 'Status uruchomienia', data.overall.status || {}, 'done', 'blocked'],
    ['tasks', 'Zadania zespołu', data.overall.tasks || {}, 'done', 'overdue'],
    ['points', 'Otwarte punkty', data.overall.points || {}, 'closed', 'reminders_overdue'],
    ['goals', 'Cele projektu', data.overall.goals || {}, 'done', 'overdue']
  ];
  const hierarchyRows = data.hierarchy_trends || [];
  const currentScope = data.scope || state.controller || 'all';
  const areaRows = state.overviewDetailed
    ? data.controllers.map(item => ({ ...item, scope: item.code, label: item.display_name || item.leaf_code, path_label: item.hierarchy_label || item.group_path_label, type: 'controller' }))
    : hierarchyRows.filter(item => item.parent_scope === currentScope || (currentScope !== 'all' && item.scope === currentScope && !hierarchyRows.some(child => child.parent_scope === currentScope)));
  const attention = (data.overall.status.blocked || 0) + (data.overall.tasks.overdue || 0) + (data.overall.points.reminders_overdue || 0) + (data.overall.goals?.overdue || 0);
  $('#content').innerHTML = `<section class="overview-command"><div><span class="eyebrow">${escapeHtml(scopeLabel)}</span><h2>${escapeHtml(state.me.current_project.name)}</h2><p>Aktualny obraz wykonania · ${data.controllers.length} sterowników</p></div><div class="score-ring" style="--score:${score}"><strong>${score}%</strong><small>realizacji</small></div><div class="attention-strip" data-insight="attention"><strong>${attention}</strong><span>elementów wymaga uwagi</span><b>Otwórz listę →</b></div></section>
  <section class="compact-kpis">${modules.map(([key, title, metric, doneKey, riskKey]) => `<button class="compact-kpi" data-insight="${key}"><span><b>${escapeHtml(title)}</b><small>${metric[doneKey] || 0}/${metric.total || 0} zakończonych</small></span><strong>${metric.progress || 0}%</strong><i class="progress"><u style="width:${metric.progress || 0}%"></u></i><em class="${metric[riskKey] ? 'risk' : ''}">${metric[riskKey] || 0} ${key === 'status' ? 'blokad' : key === 'points' ? 'alarmów' : 'po terminie'}</em></button>`).join('')}</section>
  <section class="area-radar panel"><div class="section-title"><div><strong>Realizacja według ${state.overviewDetailed ? 'sterowników' : 'obszarów'}</strong><small>${state.overviewDetailed ? 'Sterowniki końcowe w wybranym zakresie.' : 'Obszary nadrzędne sumują wszystkie podobszary i sterowniki.'}</small></div><button class="mini" id="overview-detail-toggle">${state.overviewDetailed ? 'Widok obszarów' : 'Widok sterowników'}</button></div><div class="area-performance-head"><span>Zakres</span><span>Łączne KPI</span><span>Wszystkie</span><span>Otwarte</span><span>Zamknięte</span><span>Status</span><span>Zadania</span><span>Punkty</span><span>Cele</span></div>${areaRows.map(overviewAreaRow).join('') || '<div class="empty compact-empty">Brak danych dla tego zakresu.</div>'}</section>
  <section class="trend-panel"><div class="trend-head"><div><strong>Trend KPI · procent realizacji i wielkość zakresu</strong><small>Globalny wynik całego zakresu lub porównanie modułów w tym samym okresie.</small></div><div><select id="global-trend-mode"><option value="combined">Łączne KPI</option><option value="split">Z podziałem</option></select><button class="mini" id="detailed-kpi-open">Szczegółowe KPI</button><button class="mini" id="kpi-config">Parametry</button><button class="mini trend-period" data-period="day">Dni</button><button class="mini trend-period" data-period="week">Tygodnie</button><button class="mini trend-period" data-period="month">Miesiące</button></div></div><div class="horizontal-trends">${state.globalTrendMode === 'combined' ? trendRow('combined', scopeLabel, trends) : modules.filter(([key]) => state.kpiModules.includes(key)).map(([key, title]) => trendRow(key, title, trends)).join('')}</div></section>
  ${state.overviewDetailed ? renderStatusBreakdown(data.status_breakdown || []) : ''}`;
  $$('.trend-period').forEach(button => { button.classList.toggle('active-toggle', button.dataset.period === state.trendPeriod); button.addEventListener('click', () => { state.trendPeriod = button.dataset.period; renderOverview(); }); });
  $$('[data-insight]').forEach(button => button.addEventListener('click', () => openOverviewInsight(button.dataset.insight)));
  $$('[data-controller-scope]').forEach(button => button.addEventListener('click', async () => { state.controller = button.dataset.controllerScope; $('#controller').value = state.controller; await loadData(); }));
  $('#kpi-config').addEventListener('click', openKpiConfig);
  $('#detailed-kpi-open').addEventListener('click', openDetailedKpi);
  $('#overview-detail-toggle').addEventListener('click', () => { state.overviewDetailed = !state.overviewDetailed; renderOverview(); });
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
  return `<button class="area-performance-row" data-controller-scope="${escapeHtml(scope)}"><span><b>${item.type === 'group' ? '▰ ' : '◇ '}${escapeHtml(item.label || item.display_name || item.leaf_code)}</b><small>${escapeHtml(item.path_label || item.hierarchy_label || item.group_path_label || '')}</small></span><strong>${combinedMetric(item.metrics)}%</strong><b>${counts.total}</b><b class="open-count">${counts.open}</b><b class="closed-count">${counts.closed}</b>${['status', 'tasks', 'points', 'goals'].map(key => `<span><b>${item.metrics[key]?.progress || 0}%</b><i><u style="width:${item.metrics[key]?.progress || 0}%"></u></i></span>`).join('')}</button>`;
}

function hierarchyTrendRow(item, period = state.detailedKpiPeriod, mode = state.detailedKpiMode) {
  const points = item.trends?.[period] || []; const first = combinedTrendMetric(points[0]); const last = combinedTrendMetric(points.at(-1)); const delta = last.progress - first.progress;
  const split = ['status', 'tasks', 'points', 'goals'].map(key => `<span class="module-trend"><span class="module-trend-head"><small>${({ status: 'Status', tasks: 'Zadania', points: 'Punkty', goals: 'Cele' })[key]}</small><b>${item.metrics[key]?.progress || 0}%</b></span><span class="mini-trend labeled">${points.map(point => { const metric = trendMetric(point, key); return `<span class="mini-trend-node" title="${escapeHtml(point.label)} · ${metric.progress}% · ${metric.done}/${metric.total}"><b>${metric.progress}%</b><i><u style="height:${Math.max(4, metric.progress)}%"></u></i><small>${escapeHtml(point.label)}</small></span>`; }).join('')}</span></span>`).join('');
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
  $('#insight-content').innerHTML = `<div class="detailed-kpi-toolbar"><select id="detailed-kpi-mode"><option value="combined">Łączne KPI</option><option value="split">Z podziałem na moduły</option></select><select id="detailed-kpi-period"><option value="day">Dni</option><option value="week">Tygodnie</option><option value="month">Miesiące</option></select></div><div class="detailed-kpi-tree">${children('all').map(item => branch(item)).join('') || '<div class="empty">Brak danych KPI.</div>'}</div>`;
  $('#detailed-kpi-mode').value = state.detailedKpiMode;
  $('#detailed-kpi-period').value = state.detailedKpiPeriod;
  $('#detailed-kpi-mode').addEventListener('change', event => { state.detailedKpiMode = event.target.value; openDetailedKpi(); });
  $('#detailed-kpi-period').addEventListener('change', event => { state.detailedKpiPeriod = event.target.value; openDetailedKpi(); });
  $$('[data-detailed-scope]').forEach(button => button.addEventListener('click', async event => { event.preventDefault(); event.stopPropagation(); $('#insight-dialog').close(); state.controller = button.dataset.detailedScope; $('#controller').value = state.controller; await loadData(); }));
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
    { name: 'points', label: 'Otwarte punkty', type: 'checkbox', value: state.kpiModules.includes('points') }, { name: 'goals', label: 'Cele', type: 'checkbox', value: state.kpiModules.includes('goals') }
  ] });
  if (!result) return;
  state.kpiModules = ['status', 'tasks', 'points', 'goals'].filter(key => result[key]);
  if (!state.kpiModules.length) state.kpiModules = ['status'];
  renderOverview();
}

function openOverviewInsight(kind) {
  const definitions = {
    status: ['Status uruchomienia', state.status, 'status'], tasks: ['Zadania zespołu', state.tasks, 'task'], points: ['Otwarte punkty', state.points, 'point'], goals: ['Cele projektu', state.goals, 'goal']
  };
  let title; let rows;
  if (kind === 'attention') {
    title = 'Elementy wymagające uwagi';
    rows = [
      ...state.status.filter(item => ['Blocked', 'NOK / Rework'].includes(item.status)).map(item => ({ type: 'status', item })),
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
    return `<button class="insight-row rich" data-jump="${type}" data-id="${item.id}"><span class="type-dot ${type}"></span><span><b>${escapeHtml(entityLabel(type, item))}</b><small>${escapeHtml(controllerLabel(item) || 'Ogólne')} · ${escapeHtml(item.category || 'Bez kategorii')}</small></span><span><b>${escapeHtml(assigned)}</b><small>${escapeHtml(badgeText(item.status || item.type))} · ${escapeHtml(item.priority || item.criticality || 'Medium')}</small></span><span><b>${date ? displayDate(date) : 'Bez terminu'}</b><small>${item.due_date ? 'deadline' : item.reminder_date ? 'przypomnienie' : item.start_date ? 'start' : ''}</small></span></button>`;
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
  return `<section class="list-section"><header><strong>${title}</strong><span class="badge blue">${items.length}</span></header><div class="compact-list">${items.length ? items.slice(0, 15).map(item => `<div class="compact-item" data-jump="${type}" data-id="${item.id}"><span><strong>${escapeHtml(label(item))}</strong><small>${escapeHtml(controllerLabel(item) || 'Ogólne')} · ${badgeText(item.status || item.type)}</small></span><span>${item.due_date ? displayDate(item.due_date) : ''}</span></div>`).join('') : '<div class="empty">Brak pozycji</div>'}</div></section>`;
}

function badgeText(value) { return (badgeMap[value] || [value || '—'])[0]; }

function renderMine() {
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
  const sourceLabel = data.area_source === 'planner' ? 'Planner · najbliższe 14 dni' : 'przypisanie w konfiguracji';
  $('#content').innerHTML = `<section class="personal-command compact"><div><span class="eyebrow">Plan pracy · ${escapeHtml(state.me.display_name)}</span><h2>${overdue.length ? `${overdue.length} pozycji wymaga reakcji` : 'Plan jest pod kontrolą'}</h2><p>Źródło obszarów: <b>${escapeHtml(sourceLabel)}</b> · ${(data.assigned_areas || []).map(item => escapeHtml(item.path_label || item.name)).join(', ') || 'brak przypisania'}</p></div><div class="personal-stats compact"><span><b>${taskProgress}%</b>Zadania</span><span><b>${pointProgress}%</b>Punkty</span><span><b>${statusProgress}%</b>Status</span><span><b>${data.metrics.notes_mentions}</b>Wzmianki</span></div></section>
  ${overdue.length ? `<section class="urgent-lane"><header><strong>Do pilnego działania</strong><span>${overdue.length} zaległych</span></header><div>${overdue.slice(0, 12).map(({ type, item }) => `<button data-jump="${type}" data-id="${item.id}"><span>!</span><b>${escapeHtml(entityLabel(typeToEntity(type), item))}</b><small>${displayDate(item.due_date || item.reminder_date)}</small></button>`).join('')}</div></section>` : ''}
  <section class="personal-plan-calendar"><header><div><strong>Mój plan manpoweru</strong><small>Online / offline · najbliższe 14 dni</small></div><span>${(data.planner || []).length} wpisów</span></header><div class="personal-plan-days">${planDays.map(date => { const entries = plannerByDate.get(date) || []; return `<article class="personal-plan-day ${date === today() ? 'today' : ''}"><header><b>${date.slice(8, 10)}</b><small>${new Intl.DateTimeFormat('pl-PL', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</small></header><div>${entries.map(entry => `<span class="mini-plan-chip ${entry.work_mode || 'online'}"><b>${entry.work_mode === 'offline' ? 'OFF' : 'ON'}</b>${escapeHtml(entry.area_path || entry.area_name || 'Transport')}<small>${escapeHtml(entry.shift)}${entry.transport_mode === 'transport_only' ? ' · T' : entry.transport_mode === 'transport_work' ? ' · T+P' : ''}</small></span>`).join('') || '<i>—</i>'}</div></article>`; }).join('')}</div></section>
  <div class="workbench-grid compact"><section class="focus-lane"><header><div><strong>Moje aktywne zadania</strong><small>Bez ukończonych podzadań przypisanych tylko do Ciebie</small></div><span>${data.assigned_tasks.filter(item => item.status !== 'Done').length}</span></header>${data.assigned_tasks.filter(item => item.status !== 'Done').slice(0, 20).map(item => personalTaskRow(item)).join('') || '<div class="empty">Nie masz aktywnych zadań.</div>'}</section>
  <section class="focus-lane"><header><div><strong>Najbliższe dla moich obszarów</strong><small>Następne 14 dni i niezamknięty status</small><label class="mine-source">Źródło <select id="mine-area-source"><option value="configuration">Przypisanie stałe</option><option value="planner">Planner · 14 dni</option></select></label></div><span>${upcoming.length}</span></header>${upcoming.slice(0, 20).map(({ type, item, date }) => `<button class="focus-row" data-jump="${type}" data-id="${item.id}"><span class="type-dot ${typeToEntity(type)}"></span><span><b>${escapeHtml(entityLabel(typeToEntity(type), item))}</b><small>${escapeHtml(controllerLabel(item))} · ${escapeHtml(badgeText(item.status))}</small></span><time>${date ? displayDate(date) : '→'}</time></button>`).join('') || '<div class="empty">Brak zbliżających się pozycji.</div>'}</section>
  ${summarySection('Otwarte punkty i wzmianki', data.points.filter(item => item.status !== 'Closed'), 'points', item => item.title)}
  </div>`;
  $('#mine-area-source').value = data.area_source || 'configuration';
  $('#mine-area-source').addEventListener('change', async event => { try { await api('/api/my-summary/preferences', { method: 'PUT', body: JSON.stringify({ summary_area_source: event.target.value }) }); toast('Zapisano indywidualne źródło obszarów'); await loadData(); } catch (error) { toast(error.message, true); } });
  bindJumpItems();
}

function personalTaskRow(item) {
  const own = item.checklist.filter(entry => entry.owner_user_id === state.me.id);
  const time = taskTimeLabel(item);
  return `<button class="focus-row" data-jump="tasks" data-id="${item.id}"><span class="progress-value ${item.progress >= 100 ? 'done' : item.progress > 0 ? 'active' : ''}"><b>${item.progress || 0}%</b><i><u style="width:${item.progress || 0}%"></u></i></span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(controllerLabel(item))} · ${escapeHtml(item.owner_name || 'Nieprzypisane')}${own.length ? ` · Twoje podzadania ${own.filter(entry => entry.done).length}/${own.length}` : ''}</small></span><time class="${time?.overdue ? 'danger-text' : ''}">${time ? escapeHtml(time.label) : 'Start w przyszłości'}</time></button>`;
}

function canCoordinate() { return ['moderator', 'project_admin', 'system_admin'].includes(state.me.role); }

function renderPlanner() {
  const data = state.planner || { users: [], entries: [], work: [], summary: [], area_summary: [], shift_summary: [] };
  const days = dateRange(state.plannerFrom, addDays(state.plannerFrom, state.plannerDays - 1));
  const entryMap = new Map();
  for (const entry of data.entries || []) { const key = `${entry.user_id}:${entry.plan_date}`; if (!entryMap.has(key)) entryMap.set(key, []); entryMap.get(key).push(entry); }
  const workMap = new Map((data.work || []).map(item => [`${item.user_id}:${item.work_date}`, item]));
  const absenceMap = new Map((data.absences || []).map(item => [`${item.user_id}:${item.absence_date}`, item]));
  const timeMap = new Map((data.time_details?.details || []).map(item => [`${item.user_id}:${item.date}`, item]));
  const holidayMap = new Map((data.holidays || []).map(item => [item.holiday_date, item]));
  const summaryMap = new Map((data.summary || []).map(item => [item.plan_date, item]));
  const mode = data.mode_summary || {};
  $('#content').innerHTML = `<section class="planner-command compact"><div class="planner-controls"><button class="mini planner-shift" data-days="-${state.plannerDays}">←</button><button class="mini" id="planner-today">Dzisiaj</button><button class="mini planner-shift" data-days="${state.plannerDays}">→</button><label>Zakres <select id="planner-days"><option value="7">7 dni</option><option value="14">14 dni</option><option value="28">28 dni</option><option value="31">31 dni</option><option value="90">Kwartał</option><option value="365">Rok</option></select></label>${['project_admin', 'system_admin'].includes(state.me.role) ? '<button class="mini" id="planner-participants">Uczestnicy Plannera</button>' : ''}${data.can_manage_requirements ? '<button class="mini requirement-button" id="planner-requirements-open">Zapotrzebowanie</button>' : ''}${data.can_manage_time ? '<button class="mini" id="planner-hours-open">Czas pracy i nadgodziny</button>' : ''}<span>${displayDate(days[0])} – ${displayDate(days.at(-1))}</span></div><div class="planner-summary mode-summary"><span><b>${data.summary?.find(item => item.plan_date === today())?.headcount || 0}</b> osób dzisiaj</span><span class="online"><b>${mode.today_online || 0}</b> ON · fabryka<small>${mode.online_planned_days || 0} zaplanowanych dni</small></span><span class="offline"><b>${mode.today_offline || 0}</b> OFF · biuro<small>${mode.offline_planned_days || 0} zaplanowanych dni</small></span><span><b>${data.users.length}</b> uczestników</span>${data.can_manage_time ? `<span><b>${(data.time_details?.users || []).reduce((sum, item) => sum + item.actual_hours + item.credited_hours, 0).toFixed(1)}</b> h w zakresie</span>` : ''}${(data.shift_summary || []).map(item => `<span><b>${item.assignments}</b> ${escapeHtml(item.shift)}</span>`).join('')}</div></section>
  ${plannerUnifiedSection(data.users || [], days, entryMap, workMap, summaryMap, data.area_day_summary || [], data.can_manage_requirements, absenceMap, timeMap, holidayMap, data.can_manage_time)}
  ${(data.available_today_users || []).length && days.includes(today()) && canCoordinate() ? `<section class="planner-unassigned"><strong>Dostępni tylko na dzisiaj</strong><small>Te osoby należą do projektu, ale nie są stałymi uczestnikami Plannera.</small><div>${data.available_today_users.map(user => `<button class="mini planner-today-user" data-user-id="${user.id}">+ ${escapeHtml(user.display_name)}</button>`).join('')}</div></section>` : ''}
  <p class="planner-legend"><span class="mode-dot online"></span> ON · fabryka <span class="mode-dot offline"></span> OFF · biuro <span><b>T</b> transport</span><span><b>T+P</b> transport i praca</span><span class="workload-dot"></span> zadania / punkty / status / notatki${data.can_manage_requirements ? '<span class="requirement-shortage-key"></span> obsada poniżej zapotrzebowania' : ''}</p>`;
  $('#planner-days').value = String(state.plannerDays);
  $('#planner-days').addEventListener('change', async event => { state.plannerDays = Number(event.target.value); await reloadPlanner(); });
  $$('.planner-shift').forEach(button => button.addEventListener('click', async () => { state.plannerFrom = addDays(state.plannerFrom, Number(button.dataset.days)); await reloadPlanner(); }));
  $('#planner-today').addEventListener('click', async () => { state.plannerFrom = mondayOf(today()); await reloadPlanner(); });
  $('#planner-participants')?.addEventListener('click', openPlannerParticipants);
  $('#planner-requirements-open')?.addEventListener('click', () => openPlannerRequirements(today()));
  $('#planner-hours-open')?.addEventListener('click', openPlannerHours);
  if (canCoordinate()) {
    $$('.planner-cell').forEach(cell => {
      cell.addEventListener('click', event => { if (!event.target.closest('.plan-chip') && cell.dataset.editable === '1') openPlannerCell(Number(cell.dataset.userId), cell.dataset.date); });
      cell.addEventListener('contextmenu', event => showPlannerContext(event, Number(cell.dataset.userId), cell.dataset.date, Number(event.target.closest('.plan-chip')?.dataset.entryId) || null));
      cell.addEventListener('dragover', event => { if (cell.dataset.editable !== '1') return; event.preventDefault(); cell.classList.add('drag-over'); });
      cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
      cell.addEventListener('drop', event => dropPlannerEntry(event, cell));
    });
    $$('.plan-chip[draggable="true"]').forEach(chip => {
      chip.addEventListener('dragstart', event => { state.plannerDragEntry = Number(chip.dataset.entryId); event.dataTransfer.effectAllowed = 'copyMove'; event.dataTransfer.setData('text/planner-entry', chip.dataset.entryId); chip.classList.add('dragging'); });
      chip.addEventListener('dragend', () => { state.plannerDragEntry = null; chip.classList.remove('dragging'); $$('.planner-cell').forEach(cell => cell.classList.remove('drag-over')); });
    });
    $$('.planner-today-user').forEach(button => button.addEventListener('click', () => openPlannerCell(Number(button.dataset.userId), today())));
  }
}

function plannerUnifiedSection(users, days, entryMap, workMap, summaryMap, areaDaySummary, showRequirements, absenceMap, timeMap, holidayMap, showTime) {
  const segments = (source, label) => { const result = []; let current; source.forEach(date => { const value = label(date); if (!current || current.value !== value) { current = { value, count: 0 }; result.push(current); } current.count += 1; }); return result; };
  const months = segments(days, date => new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)));
  const weeks = segments(days, date => isoWeek(date).label);
  const areaRows = areaDaySummary.map(area => `<tr class="area-day-row"><th class="person-col">${escapeHtml(area.name)}</th>${days.map(date => plannerHeadcountCell(area.days.find(item => item.date === date), showRequirements)).join('')}</tr>`).join('');
  return `<section class="planner-shell planner-unified"><header><div><strong>Plan zespołu</strong><small>ON i OFF w jednym widoku · przeciągnij aktywność na inny dzień lub osobę</small></div><span>${users.length} uczestników</span></header><div class="planner-scroll"><table class="planner-table compact" style="--planner-days:${days.length}"><thead><tr><th class="person-col" rowspan="4">Pracownik</th>${months.map(item => `<th colspan="${item.count}">${escapeHtml(item.value)}</th>`).join('')}</tr><tr>${weeks.map(item => `<th colspan="${item.count}">${escapeHtml(item.value)}</th>`).join('')}</tr><tr>${days.map(date => `<th class="${date === today() ? 'today' : ''} ${holidayMap.has(date) ? 'holiday' : ''}" title="${escapeHtml(holidayMap.get(date)?.name || '')}">${new Intl.DateTimeFormat('pl-PL', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</th>`).join('')}</tr><tr>${days.map(date => `<th class="${date === today() ? 'today' : ''} ${holidayMap.has(date) ? 'holiday' : ''}" title="${escapeHtml(holidayMap.get(date)?.name || '')}">${date.slice(8, 10)}</th>`).join('')}</tr></thead><tbody>${users.map(user => `<tr class="${user.planner_enabled ? '' : 'temporary-planner-user'}"><th class="person-col"><b>${escapeHtml(user.display_name)}</b><small>${escapeHtml(user.configured_areas || 'bez obszaru')}${user.planner_enabled ? '' : ' · tylko dzisiaj'}</small>${showTime ? `<em>${Number((state.planner.time_details?.users || []).find(item => item.user_id === user.id)?.actual_hours || 0).toFixed(1)} h</em>` : ''}</th>${days.map(date => plannerCell(user, date, entryMap.get(`${user.id}:${date}`) || [], workMap.get(`${user.id}:${date}`), absenceMap.get(`${user.id}:${date}`), timeMap.get(`${user.id}:${date}`), holidayMap.get(date), showTime)).join('')}</tr>`).join('') || `<tr><td colspan="${days.length + 1}" class="empty compact-empty">Brak uczestników Plannera.</td></tr>`}</tbody><tfoot><tr class="total-headcount-row"><th class="person-col">Obsada razem</th>${days.map(date => { const summary = summaryMap.get(date); return `<td><b>${summary?.headcount || 0}</b><small><i class="on-tag">ON ${summary?.online_headcount || 0}</i><i class="off-tag">OFF ${summary?.offline_headcount || 0}</i></small></td>`; }).join('')}</tr>${areaRows}</tfoot></table></div></section>`;
}

function plannerHeadcountCell(day = {}, showRequirements = false) {
  const shortage = showRequirements && ((day.online || 0) < (day.online_required || 0) || (day.offline || 0) < (day.offline_required || 0));
  return `<td class="area-headcount-cell ${shortage ? 'shortage' : ''}"><span><i class="on-tag">ON</i><b>${day.online || 0}${showRequirements ? `/${day.online_required || 0}` : ''}</b></span><span><i class="off-tag">OFF</i><b>${day.offline || 0}${showRequirements ? `/${day.offline_required || 0}` : ''}</b></span></td>`;
}

function plannerCell(user, date, entries, work, absence, timeDetail, holiday, showTime) {
  const weekend = [0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay());
  const editable = canCoordinate() && (Number(user.planner_enabled) || date === today());
  const chips = entries.map(entry => `<span class="plan-chip ${entry.transport_mode} ${entry.work_mode}" data-entry-id="${entry.id}" draggable="${editable ? 'true' : 'false'}"><b class="mode-label">${entry.work_mode === 'offline' ? 'OFF' : 'ON'}</b>${entry.transport_mode === 'transport_only' ? '<b>T</b>' : entry.transport_mode === 'transport_work' ? '<b>T+P</b>' : ''}<span>${entry.area_path ? escapeHtml(entry.area_path) : entry.area_name ? escapeHtml(entry.area_name) : 'Transport / ogólne'}</span><small>${escapeHtml(entry.shift)}</small></span>`).join('');
  const workload = work && (work.tasks || work.points || work.statuses || work.notes) ? `<span class="workload" title="Zadania / otwarte punkty / status / notatki">${work.tasks}/${work.points}/${work.statuses}/${work.notes}</span>` : '';
  const absenceChip = absence ? `<span class="absence-chip ${absence.absence_type}"><b>${absence.absence_type === 'vacation' ? 'URLOP' : 'WOLNE'}</b><small>${escapeHtml(absence.note || '')}</small></span>` : '';
  const hours = showTime && (timeDetail?.actual_hours || timeDetail?.credited_hours || timeDetail?.overtime_balance) ? `<span class="planner-hours-chip" title="Godziny rzeczywiste / zaliczone · bilans nadgodzin">${Number(timeDetail.actual_hours + timeDetail.credited_hours).toFixed(1)}h <b>${timeDetail.overtime_balance >= 0 ? '+' : ''}${Number(timeDetail.overtime_balance).toFixed(1)}</b></span>` : '';
  return `<td class="planner-cell ${weekend ? 'weekend' : ''} ${holiday ? 'holiday' : ''} ${absence ? 'absent' : ''} ${date === today() ? 'today' : ''} ${entries.length ? 'planned' : ''} ${editable ? '' : 'read-only'}" data-user-id="${user.id}" data-date="${date}" data-editable="${editable ? 1 : 0}" title="${holiday ? `${escapeHtml(holiday.name)} · ` : ''}${editable ? 'Kliknij: edycja · prawy klik: kopiowanie · przeciągnij aktywność' : 'Plan tylko do odczytu'}">${absenceChip}${chips}${workload}${hours}${!absenceChip && !chips && editable ? '<i>+</i>' : ''}</td>`;
}

async function dropPlannerEntry(event, cell) {
  if (!canCoordinate() || cell.dataset.editable !== '1') return;
  event.preventDefault(); cell.classList.remove('drag-over');
  const entryId = Number(event.dataTransfer.getData('text/planner-entry') || state.plannerDragEntry);
  if (!entryId) return;
  try {
    const copy = event.ctrlKey || event.altKey;
    await api('/api/planner/move', { method: 'POST', body: JSON.stringify({ entry_id: entryId, target_user_id: Number(cell.dataset.userId), target_date: cell.dataset.date, copy }) });
    toast(copy ? 'Skopiowano aktywność' : 'Przeniesiono aktywność'); await reloadPlanner();
  } catch (error) { toast(error.message, true); }
}

async function reloadPlanner() {
  try { state.planner = await api(`/api/planner?from=${state.plannerFrom}&to=${addDays(state.plannerFrom, state.plannerDays - 1)}`); renderPlanner(); } catch (error) { toast(error.message, true); }
}

function plannerEntryRow(entry = {}) {
  return `<div class="planner-entry-row"><select data-plan-area>${selectOptions(hierarchyGroupOptions(), entry.controller_group_id, 'Bez obszaru')}</select><select data-plan-mode>${selectOptions([{ value: 'online', label: 'Online · fabryka' }, { value: 'offline', label: 'Offline · biuro' }], entry.work_mode || 'online', '')}</select><select data-plan-shift>${selectOptions(options('shift'), entry.shift || 'Dzień')}</select><select data-plan-transport>${selectOptions([{ value: 'none', label: 'Praca' }, { value: 'transport_work', label: 'T+P · transport i praca' }, { value: 'transport_only', label: 'T · sam transport' }], entry.transport_mode || 'none', '')}</select><input data-plan-note value="${escapeHtml(entry.note || '')}" placeholder="Krótka notatka"><button type="button" class="mini remove-plan-entry">×</button></div>`;
}

function bindPlannerEntryRows() { $$('.remove-plan-entry').forEach(button => button.onclick = () => button.closest('.planner-entry-row').remove()); }

function openPlannerCell(userId, date) {
  if (!canCoordinate()) return;
  const user = [...(state.planner.users || []), ...(state.planner.available_today_users || [])].find(item => item.id === userId);
  if (!user) return toast('Nie znaleziono użytkownika projektu', true);
  if (!Number(user.planner_enabled) && date !== today()) return toast('Osobę nieuwzględnioną stale w Plannerze można dopisać wyłącznie do dzisiejszego dnia', true);
  const entries = state.planner.entries.filter(item => item.user_id === userId && item.plan_date === date);
  const absence = (state.planner.absences || []).find(item => item.user_id === userId && item.absence_date === date);
  state.plannerCell = { userId, date };
  $('#planner-dialog-title').textContent = `${user?.display_name || 'Pracownik'} · ${displayDate(date)}`;
  $('#planner-dialog-description').textContent = 'Obszar można wskazać tylko raz. Obszar nadrzędny wyklucza jego podobszary.';
  $('#planner-entry-list').innerHTML = entries.map(plannerEntryRow).join('') || plannerEntryRow();
  $('#planner-day-kind').value = absence?.absence_type || 'work';
  $('#planner-absence-note').value = absence?.note || '';
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
}

async function savePlannerCell(event) {
  event.preventDefault(); if (!state.plannerCell) return;
  const absenceType = $('#planner-day-kind').value === 'work' ? '' : $('#planner-day-kind').value;
  const entries = absenceType ? [] : $$('#planner-entry-list .planner-entry-row').map(row => ({ controller_group_id: Number(row.querySelector('[data-plan-area]').value) || null, work_mode: row.querySelector('[data-plan-mode]').value, shift: row.querySelector('[data-plan-shift]').value, transport_mode: row.querySelector('[data-plan-transport]').value, note: row.querySelector('[data-plan-note]').value }));
  if (!await confirmMixedPlannerModes(state.plannerCell.userId, state.plannerCell.date, entries)) return;
  try { await api('/api/planner/day', { method: 'PUT', body: JSON.stringify({ user_id: state.plannerCell.userId, plan_date: state.plannerCell.date, entries, absence_type: absenceType, absence_note: $('#planner-absence-note').value }) }); $('#planner-dialog').close(); toast('Plan dnia został zapisany'); await reloadPlanner(); } catch (error) { toast(error.message, true); }
}

async function savePlannerTarget(userId, date, entries) {
  if (!await confirmMixedPlannerModes(userId, date, entries)) return false;
  await api('/api/planner/day', { method: 'PUT', body: JSON.stringify({ user_id: userId, plan_date: date, entries: entries.map(({ controller_group_id, work_mode, shift, transport_mode, note }) => ({ controller_group_id, work_mode, shift, transport_mode, note })) }) });
  await reloadPlanner();
  return true;
}

async function confirmMixedPlannerModes(userId, date, entries) {
  const finalModes = new Set(entries.map(item => item.work_mode || 'online'));
  const previousModes = new Set((state.planner?.entries || []).filter(item => item.user_id === Number(userId) && item.plan_date === date).map(item => item.work_mode));
  if (finalModes.size < 2 || previousModes.size > 1) return true;
  const user = state.users.find(item => item.id === Number(userId));
  return Boolean(await uiConfirm('Jednoczesny plan ONLINE i OFFLINE', `${user?.display_name || 'Ta osoba'} ma być tego samego dnia zaplanowana w fabryce i w biurze. Czy na pewno chcesz zachować oba tryby?`, 'Tak, zapisz oba tryby', true));
}

async function openPlannerParticipants() {
  const participants = state.users.filter(item => item.project_active && item.active);
  const result = await uiForm({ title: 'Uczestnicy Plannera', description: 'Aktywność konta i udział w Plannerze są niezależne. Dotyczy to również administratora systemu.', submitLabel: 'Zapisz uczestników', fields: participants.map(item => ({ name: `planner_${item.id}`, label: `${item.display_name} · ${roleName(item.system_role === 'system_admin' ? 'system_admin' : item.project_role)}`, type: 'checkbox', value: item.planner_enabled })) });
  if (!result) return;
  try {
    await Promise.all(participants.map(item => api(`/api/users/${item.id}/planner`, { method: 'PUT', body: JSON.stringify({ planner_enabled: result[`planner_${item.id}`] ? 1 : 0 }) })));
    toast('Lista uczestników Plannera została zapisana');
    await loadData();
  } catch (error) { toast(error.message, true); }
}

function openPlannerRequirements(date = today(), groupId = '') {
  if (!state.planner?.can_manage_requirements) return;
  renderPlannerRequirementsCalendar();
  if (!$('#planner-requirements-dialog').open) $('#planner-requirements-dialog').showModal();
}

function renderPlannerRequirementsCalendar() {
  if (!state.planner?.can_manage_requirements) return;
  const days = dateRange(state.plannerFrom, addDays(state.plannerFrom, state.plannerDays - 1));
  const groups = (state.planner.areas || []).filter(group => $('#requirement-level').value === 'all' || !group.parent_id);
  const values = new Map();
  for (const row of state.planner.requirements || []) {
    const key = `${row.controller_group_id}:${row.plan_date}`;
    if (!values.has(key)) values.set(key, { online: 0, offline: 0 });
    values.get(key)[row.work_mode] += Number(row.required_count || 0);
  }
  const holidays = (state.planner.holidays || []).filter(item => days.includes(item.holiday_date));
  $('#planner-requirements-calendar').innerHTML = `${holidays.length ? `<div class="holiday-list"><b>Święta w zakresie</b>${holidays.map(item => `<span>${displayDate(item.holiday_date)} · ${escapeHtml(item.name)} <button type="button" class="delete-holiday" data-id="${item.id}" title="Usuń">×</button></span>`).join('')}</div>` : ''}<div class="requirement-calendar-scroll"><table style="--requirement-days:${days.length}"><thead><tr><th class="requirement-area">Obszar</th>${days.map(date => `<th class="${[0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? 'weekend' : ''}"><b>${date.slice(8, 10)}</b><small>${new Intl.DateTimeFormat('pl-PL', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}<br>${isoWeek(date).label}</small></th>`).join('')}</tr></thead><tbody>${groups.map(group => `<tr><th class="requirement-area"><b>${escapeHtml(group.path_label || group.name)}</b></th>${days.map(date => { const value = values.get(`${group.id}:${date}`) || {}; return `<td data-requirement-cell data-group="${group.id}" data-date="${date}"><label class="on"><span>ON</span><input type="number" min="0" max="999" value="${value.online || 0}" data-required-online></label><label class="off"><span>OFF</span><input type="number" min="0" max="999" value="${value.offline || 0}" data-required-offline></label></td>`; }).join('')}</tr>`).join('') || `<tr><td colspan="${days.length + 1}" class="empty">Brak obszarów.</td></tr>`}</tbody></table></div>`;
  $$('.delete-holiday').forEach(button => button.addEventListener('click', async () => {
    if (!await uiConfirm('Usuń święto', 'Dzień przestanie być liczony jako święto w kalkulacji nadgodzin.', 'Usuń', true)) return;
    try { await api(`/api/planner/holidays/${button.dataset.id}`, { method: 'DELETE' }); await reloadPlanner(); renderPlannerRequirementsCalendar(); toast('Święto usunięto'); } catch (error) { toast(error.message, true); }
  }));
}

async function savePlannerRequirementsCalendar() {
  const items = $$('#planner-requirements-calendar [data-requirement-cell]').map(cell => ({
    plan_date: cell.dataset.date, controller_group_id: Number(cell.dataset.group),
    online_required: Number(cell.querySelector('[data-required-online]').value) || 0,
    offline_required: Number(cell.querySelector('[data-required-offline]').value) || 0
  }));
  if (!items.length) return;
  const button = $('#planner-requirements-save'); button.disabled = true;
  try {
    for (let index = 0; index < items.length; index += 1500) await api('/api/planner/requirements/batch', { method: 'PUT', body: JSON.stringify({ items: items.slice(index, index + 1500) }) });
    toast(`Zapisano zapotrzebowanie dla ${items.length} komórek`);
    await reloadPlanner();
    renderPlannerRequirementsCalendar();
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

async function addPlannerHoliday() {
  const result = await uiForm({ title: 'Dodaj święto projektu', description: 'Święto wpływa na kalkulację czasu pracy i mnożnik nadgodzin.', fields: [
    { name: 'holiday_date', label: 'Data', type: 'date', value: today(), required: true }, { name: 'name', label: 'Nazwa święta', required: true }
  ], submitLabel: 'Dodaj święto' });
  if (!result) return;
  try { await api('/api/planner/holidays', { method: 'POST', body: JSON.stringify(result) }); await reloadPlanner(); renderPlannerRequirementsCalendar(); toast('Święto dodano'); } catch (error) { toast(error.message, true); }
}

function openPlannerHours() {
  if (!state.planner?.can_manage_time) return;
  const report = state.planner.time_details || { users: [], details: [] };
  $('#planner-hours-content').innerHTML = `<section class="hours-rules"><b>Zasady kalkulacji</b><span>ON 10,5 h</span><span>OFF 8 h</span><span>Dzień roboczy: 1,5× ponad 8 h</span><span>Sobota: 1,5× całość</span><span>Niedziela / święto: 2× całość</span><span>Wolne z nadgodzin: −8 h</span></section><div class="tablewrap"><table class="hours-table"><thead><tr><th>Pracownik</th><th>Praca</th><th>Urlop zaliczony</th><th>Nadgodziny rzeczywiste</th><th>Nadgodziny ważone / bilans</th><th>Przeciążenie</th></tr></thead><tbody>${report.users.map(item => `<tr class="${item.overloaded_weeks?.length ? 'overloaded' : ''}"><td><b>${escapeHtml(item.display_name)}</b></td><td>${Number(item.actual_hours).toFixed(1)} h</td><td>${Number(item.credited_hours).toFixed(1)} h</td><td>${Number(item.overtime_raw).toFixed(1)} h</td><td><b>${item.overtime_balance >= 0 ? '+' : ''}${Number(item.overtime_balance).toFixed(1)} h</b></td><td>${item.overloaded_weeks?.length ? `<span class="badge red">${item.overloaded_weeks.map(week => `${week.week}: ${week.hours} h`).join(', ')}</span>` : '<span class="badge green">w normie</span>'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Brak danych w zakresie.</td></tr>'}</tbody></table></div><details class="hours-details"><summary>Szczegóły dzienne</summary><div class="tablewrap"><table><thead><tr><th>Data</th><th>Pracownik</th><th>Rodzaj</th><th>Praca</th><th>Zaliczone</th><th>Bilans nadgodzin</th></tr></thead><tbody>${report.details.filter(item => item.label || item.overtime_balance).map(item => `<tr><td>${displayDate(item.date)}</td><td>${escapeHtml(item.display_name)}</td><td>${escapeHtml(item.label || '—')}${item.is_holiday ? ' · święto' : ''}</td><td>${Number(item.actual_hours).toFixed(1)} h</td><td>${Number(item.credited_hours).toFixed(1)} h</td><td>${item.overtime_balance >= 0 ? '+' : ''}${Number(item.overtime_balance).toFixed(1)} h</td></tr>`).join('')}</tbody></table></div></details>`;
  $('#planner-hours-dialog').showModal();
}

async function pastePlannerRange(userId, anchorDate, source, kind) {
  if (!source.length) return toast('Skopiowany dzień nie zawiera aktywności', true);
  const result = await uiForm({ title: 'Kopiuj aktywność na wiele dni', description: 'Wybierz zakres docelowy. Maksymalnie 31 dni w jednej operacji.', fields: [
    { name: 'from', label: 'Od', type: 'date', value: anchorDate, required: true }, { name: 'to', label: 'Do', type: 'date', value: addDays(anchorDate, 6), required: true }
  ], submitLabel: 'Kopiuj na zakres' });
  if (!result) return;
  const days = dateRange(result.from, result.to);
  if (!days.length || result.to < result.from || days.length > 31) return toast('Zakres musi obejmować od 1 do 31 dni', true);
  try {
    for (const date of days) {
      const existing = (state.planner.entries || []).filter(item => item.user_id === userId && item.plan_date === date);
      const target = kind === 'day' ? source : [...existing, ...source.filter(candidate => !existing.some(item => Number(item.controller_group_id || 0) === Number(candidate.controller_group_id || 0) && candidate.controller_group_id))];
      await api('/api/planner/day', { method: 'PUT', body: JSON.stringify({ user_id: userId, plan_date: date, entries: target.map(({ controller_group_id, work_mode, shift, transport_mode, note }) => ({ controller_group_id, work_mode, shift, transport_mode, note })) }) });
    }
    toast(`Skopiowano aktywność na ${days.length} dni`); await reloadPlanner();
  } catch (error) { toast(error.message, true); }
}

function showPlannerContext(event, userId, date, entryId = null) {
  if (!canCoordinate()) return;
  event.preventDefault(); event.stopPropagation();
  const user = [...(state.planner.users || []), ...(state.planner.available_today_users || [])].find(item => item.id === userId);
  if (!Number(user?.planner_enabled) && date !== today()) return toast('Ta osoba może być planowana tylko na dzisiaj', true);
  const menu = $('#context-menu');
  const entry = entryId ? state.planner.entries.find(item => item.id === entryId) : null;
  menu.innerHTML = `${entry ? '<button data-action="copy-entry">Kopiuj to przypisanie</button><button data-action="repeat-entry">Powiel aktywność na wiele dni…</button>' : ''}<button data-action="copy-day">Kopiuj cały dzień</button><button data-action="repeat-day">Powiel cały dzień na wiele dni…</button>${state.plannerClipboard ? `<button data-action="paste">Wklej ${state.plannerClipboard.kind === 'day' ? 'cały dzień' : 'przypisanie'}</button><button data-action="paste-range">Wklej na zakres dni…</button>` : ''}<button data-action="assign">Przypisz zadania / status / punkty</button><button data-action="edit">Edytuj dzień</button><button data-action="clear">Wyczyść dzień</button>`;
  menu.style.left = `${Math.min(event.clientX, innerWidth - 300)}px`; menu.style.top = `${Math.min(event.clientY, innerHeight - 260)}px`; menu.classList.remove('hidden');
  menu.querySelectorAll('button').forEach(button => button.addEventListener('click', async () => {
    menu.classList.add('hidden');
    const dayEntries = state.planner.entries.filter(item => item.user_id === userId && item.plan_date === date);
    try {
      if (button.dataset.action === 'copy-entry' && entry) { state.plannerClipboard = { kind: 'entry', entries: [entry] }; return toast('Skopiowano przypisanie'); }
      if (button.dataset.action === 'copy-day') { state.plannerClipboard = { kind: 'day', entries: dayEntries }; return toast('Skopiowano cały dzień'); }
      if (button.dataset.action === 'repeat-entry' && entry) return pastePlannerRange(userId, date, [entry], 'entry');
      if (button.dataset.action === 'repeat-day') return pastePlannerRange(userId, date, dayEntries, 'day');
      if (button.dataset.action === 'paste') {
        const source = state.plannerClipboard.entries || [];
        const target = state.plannerClipboard.kind === 'day' ? source : [...dayEntries, ...source];
        if (await savePlannerTarget(userId, date, target)) toast('Plan został wklejony'); return;
      }
      if (button.dataset.action === 'paste-range') return pastePlannerRange(userId, date, state.plannerClipboard.entries || [], state.plannerClipboard.kind);
      if (button.dataset.action === 'assign') return openEntitySelection({ mode: 'planner', userId, date, allowed: ['task', 'status', 'point'] });
      if (button.dataset.action === 'edit') return openPlannerCell(userId, date);
      if (button.dataset.action === 'clear' && await uiConfirm('Wyczyść plan dnia', 'Wszystkie przypisania tej osoby w wybranym dniu zostaną usunięte.', 'Wyczyść', true)) { await savePlannerTarget(userId, date, []); toast('Plan dnia został wyczyszczony'); }
    } catch (error) { toast(error.message, true); }
  }));
}

function renderCalendar() {
  const events = state.calendar?.events || [];
  const days = dateRange(state.calendarFrom, state.calendarTo);
  const singleEventsForDay = date => events.filter(event => event.start_date === date && event.end_date === date).sort((a, b) => Number(b.entity_type === 'annotation') - Number(a.entity_type === 'annotation') || a.title.localeCompare(b.title, 'pl'));
  const spans = events.filter(event => event.end_date > event.start_date).map(event => ({
    event,
    start: Math.max(0, days.indexOf(event.start_date) < 0 ? 0 : days.indexOf(event.start_date)),
    end: Math.min(days.length - 1, days.indexOf(event.end_date) < 0 ? days.length - 1 : days.indexOf(event.end_date))
  })).filter(item => item.end >= 0 && item.start < days.length).sort((a, b) => Number(b.event.entity_type === 'annotation') - Number(a.event.entity_type === 'annotation') || a.start - b.start || b.end - a.end);
  const laneEnds = [];
  spans.forEach(item => { let lane = laneEnds.findIndex(end => end < item.start); if (lane < 0) lane = laneEnds.length; laneEnds[lane] = item.end; item.lane = lane; });
  $('#add').hidden = !canCoordinate();
  $('#content').innerHTML = `<section class="calendar-command"><div><button class="mini calendar-nav" data-offset="-1">←</button><button class="mini" id="calendar-today">Dzisiaj</button><button class="mini calendar-nav" data-offset="1">→</button></div><div class="calendar-modes"><button class="mini" data-calendar-mode="day">Dzień</button><button class="mini" data-calendar-mode="week">Tydzień</button><button class="mini" data-calendar-mode="month">Miesiąc</button><button class="mini" data-calendar-mode="custom">Dowolny</button></div><label>Od <input type="date" id="calendar-from" value="${state.calendarFrom}"></label><label>Do <input type="date" id="calendar-to" value="${state.calendarTo}"></label><button class="secondary" id="calendar-apply-range">Pokaż</button><button class="secondary ${state.calendarOnlyMine ? 'active-toggle' : ''}" id="calendar-mine-toggle">${state.calendarOnlyMine ? '✓ Tylko moje' : 'Wszystkie / moje'}</button><button class="secondary" id="calendar-filter">Filtry <b>${state.calendarTypes.length}</b></button></section>
  <section class="calendar-shell"><div class="calendar-timeline" style="--calendar-days:${days.length}"><div class="calendar-date-heads">${days.map(date => `<header class="calendar-day-head ${date === today() ? 'today' : ''} ${[0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? 'weekend' : ''}" data-date="${date}"><strong>${new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</strong><small>${isoWeek(date).label}</small></header>`).join('')}</div>${spans.length ? `<div class="calendar-span-rows" style="--span-row-count:${laneEnds.length}">${spans.map(item => `<div class="calendar-span-slot" style="grid-column:${item.start + 1}/span ${item.end - item.start + 1};grid-row:${item.lane + 1}">${calendarEvent(item.event, false, true)}</div>`).join('')}</div>` : ''}<div class="calendar-day-bodies">${days.map(date => `<article class="calendar-day ${date === today() ? 'today' : ''} ${[0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? 'weekend' : ''}" data-date="${date}" title="Prawy przycisk: dodaj lub wybierz element"><div>${singleEventsForDay(date).map(event => calendarEvent(event, false)).join('') || '<span class="calendar-empty">Prawy klik, aby dodać</span>'}</div></article>`).join('')}</div></div></section><div class="calendar-legend"><span class="type-dot task"></span>Zadania <span class="type-dot point"></span>Otwarte punkty <span class="type-dot status"></span>Status <span class="type-dot goal"></span>Cele <span class="type-dot note"></span>Dziennik <span class="type-dot annotation"></span>Adnotacje</div>`;
  $$('[data-calendar-mode]').forEach(button => { button.classList.toggle('active-toggle', button.dataset.calendarMode === state.calendarMode); button.addEventListener('click', async () => { await setCalendarMode(button.dataset.calendarMode); }); });
  $$('.calendar-nav').forEach(button => button.addEventListener('click', async () => { const span = days.length; state.calendarFrom = addDays(state.calendarFrom, Number(button.dataset.offset) * span); state.calendarTo = addDays(state.calendarTo, Number(button.dataset.offset) * span); await reloadCalendar(); }));
  $('#calendar-today').addEventListener('click', async () => { await setCalendarMode(state.calendarMode === 'custom' ? 'week' : state.calendarMode, today()); });
  $('#calendar-apply-range').addEventListener('click', async () => { const from = $('#calendar-from').value; const to = $('#calendar-to').value; if (dateRange(from, to).length > 31) return toast('Kalendarz może pokazać maksymalnie 31 dni', true); state.calendarFrom = from; state.calendarTo = to; state.calendarMode = 'custom'; await reloadCalendar(); });
  $('#calendar-filter').addEventListener('click', openCalendarFilters);
  $('#calendar-mine-toggle').addEventListener('click', async () => { state.calendarOnlyMine = !state.calendarOnlyMine; await reloadCalendar(); });
  $$('.calendar-day, .calendar-day-head').forEach(day => day.addEventListener('contextmenu', event => showCalendarDayContext(event, day.dataset.date)));
  $$('.calendar-event').forEach(button => button.addEventListener('click', () => { const event = events.find(item => item.entity_type === button.dataset.type && item.entity_id === Number(button.dataset.id)); if (!event) return; if (event.entity_type === 'annotation') return canCoordinate() ? openCalendarAnnotation(event) : null; jumpTo(event.entity_type, event.entity_id); }));
  $$('.calendar-event.annotation').forEach(button => button.addEventListener('contextmenu', event => {
    event.preventDefault(); event.stopPropagation();
    const item = events.find(value => value.entity_type === 'annotation' && value.entity_id === Number(button.dataset.id));
    if (item && canCoordinate()) showCalendarAnnotationContext(event, item);
  }));
}

function calendarEvent(event, continuation = false, spanning = false) {
  const details = [event.controller_label || event.controller, event.assigned_names || event.assigned_user_name].filter(Boolean).join(' · ');
  const range = spanning ? `${displayDate(event.start_date)} – ${displayDate(event.end_date)}` : '';
  return `<button class="calendar-event ${event.entity_type} ${event.color || ''} ${spanning ? 'spanning' : ''}" data-type="${event.entity_type}" data-id="${event.entity_id}" title="${escapeHtml(event.title)}"><span>${continuation ? '↳' : ({ task: '✓', point: '!', status: '▦', goal: '◎', note: '▤', annotation: '◆' })[event.entity_type]}</span><b>${escapeHtml(event.title)}</b><small>${escapeHtml([details || 'Cały projekt', range].filter(Boolean).join(' · '))}</small></button>`;
}

function showCalendarDayContext(event, date) {
  event.preventDefault(); event.stopPropagation();
  const menu = $('#context-menu');
  menu.innerHTML = `${canCoordinate() ? '<button data-action="annotation">+ Adnotacja</button>' : ''}<button data-action="task">+ Nowe zadanie</button><button data-action="status">+ Nowy punkt statusu</button><button data-action="point">+ Nowy otwarty punkt</button><button data-action="goal">+ Nowy cel</button><button data-action="note">+ Nowa notatka</button><button data-action="existing">Wybierz istniejące elementy…</button>`;
  menu.style.left = `${Math.min(event.clientX, innerWidth - 300)}px`; menu.style.top = `${Math.min(event.clientY, innerHeight - 320)}px`; menu.classList.remove('hidden');
  menu.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
    menu.classList.add('hidden');
    const action = button.dataset.action;
    if (action === 'annotation') return openCalendarAnnotation(null, date);
    if (action === 'existing') return openEntitySelection({ mode: 'calendar', date, allowed: ['task', 'status', 'point', 'goal', 'note'] });
    if (action === 'task') return openRecord('tasks', null, { start_date: date });
    if (action === 'point') return openRecord('points', null, { start_date: date });
    if (action === 'goal') return openRecord('goals', null, { due_date: date });
    if (action === 'note') return openRecord('notes', null, { note_date: date });
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
  try { state.calendar = await api('/api/calendar?' + params); renderCalendar(); } catch (error) { toast(error.message, true); }
}

function openCalendarFilters() {
  const labels = { task: 'Zadania', point: 'Otwarte punkty', status: 'Status', goal: 'Cele', note: 'Dziennik', annotation: 'Adnotacje' };
  $('#calendar-filter-fields').innerHTML = `<div class="field full"><label>Typy informacji</label><div class="mentions">${Object.entries(labels).map(([type, label]) => `<label class="mention"><input type="checkbox" name="type" value="${type}" ${state.calendarTypes.includes(type) ? 'checked' : ''}>${label}</label>`).join('')}</div></div><div class="field full"><label>Priorytety zadań, statusu, punktów i celów</label><div class="mentions">${['Low', 'Medium', 'High', 'Critical'].map(priority => `<label class="mention"><input type="checkbox" name="priority" value="${priority}" ${state.calendarPriorities.includes(priority) ? 'checked' : ''}>${badgeText(priority)}</label>`).join('')}</div></div><label class="field"><span>Kategoria / branża zawiera</span><input name="category" value="${escapeHtml(state.calendarCategory)}" placeholder="np. Electrical"></label><label class="field calendar-own-filter"><span>Zakres osobisty</span><span class="toggle-line"><input name="only_mine" type="checkbox" value="1" ${state.calendarOnlyMine ? 'checked' : ''}><b>Tylko elementy utworzone przeze mnie lub przypisane / wspomniane przy mnie</b></span></label>`;
  $('#calendar-filter-dialog').showModal();
}

async function applyCalendarFilters(event) {
  event.preventDefault(); const form = new FormData(event.currentTarget); state.calendarTypes = form.getAll('type'); if (!state.calendarTypes.length) state.calendarTypes = ['task']; state.calendarPriorities = form.getAll('priority'); if (!state.calendarPriorities.length) state.calendarPriorities = ['Low', 'Medium', 'High', 'Critical']; state.calendarCategory = String(form.get('category') || ''); state.calendarOnlyMine = form.get('only_mine') === '1'; $('#calendar-filter-dialog').close(); await reloadCalendar();
}

async function openCalendarAnnotation(record = null, date = null) {
  if (!canCoordinate()) return;
  const result = await uiForm({ title: record ? 'Edytuj adnotację' : 'Nowa adnotacja w Kalendarzu', fields: [
    { name: 'title', label: 'Tytuł', value: record?.title || '', required: true }, { name: 'start_date', label: 'Od', type: 'date', value: record?.start_date || date || state.calendarFrom, required: true }, { name: 'end_date', label: 'Do', type: 'date', value: record?.end_date || record?.start_date || date || state.calendarFrom },
    { name: 'controller_id', label: 'Sterownik', type: 'select', value: record?.controller_id || '', options: [{ value: '', label: 'Cały projekt' }, ...state.controllers.map(item => ({ value: item.id, label: item.display_name || item.code }))] },
    { name: 'assigned_user_id', label: 'Osoba', type: 'select', value: record?.assigned_user_id || '', options: [{ value: '', label: 'Bez osoby' }, ...assignableUsers().map(item => ({ value: item.id, label: item.display_name }))] },
    { name: 'description', label: 'Opis', type: 'textarea', value: record?.description || '', full: true }
  ], submitLabel: 'Zapisz adnotację', secondaryLabel: record ? 'Usuń adnotację' : '', secondaryDanger: true });
  if (result?.__action === 'secondary') return deleteCalendarAnnotation(record);
  if (!result?.title) return;
  try { await api('/api/calendar/annotations' + (record ? `/${record.entity_id || record.id}` : ''), { method: record ? 'PATCH' : 'POST', body: JSON.stringify(result) }); toast('Adnotacja została zapisana'); await reloadCalendar(); } catch (error) { toast(error.message, true); }
}

async function deleteCalendarAnnotation(record) {
  if (!record || !await uiConfirm('Usuń adnotację', `Adnotacja „${record.title}” zostanie trwale usunięta z Kalendarza.`, 'Usuń', true)) return;
  try { await api(`/api/calendar/annotations/${record.entity_id || record.id}`, { method: 'DELETE' }); toast('Adnotacja została usunięta'); await reloadCalendar(); } catch (error) { toast(error.message, true); }
}

function showCalendarAnnotationContext(event, record) {
  const menu = $('#context-menu');
  menu.innerHTML = '<button data-action="edit">Edytuj adnotację</button><button data-action="delete" class="danger-text">Usuń adnotację</button>';
  menu.style.left = `${Math.min(event.clientX, innerWidth - 260)}px`; menu.style.top = `${Math.min(event.clientY, innerHeight - 160)}px`; menu.classList.remove('hidden');
  menu.querySelector('[data-action="edit"]').addEventListener('click', () => { menu.classList.add('hidden'); openCalendarAnnotation(record); });
  menu.querySelector('[data-action="delete"]').addEventListener('click', () => { menu.classList.add('hidden'); deleteCalendarAnnotation(record); });
}

function renderHistory() {
  const types = [['status', 'Status'], ['task', 'Zadania'], ['point', 'Otwarte punkty'], ['note', 'Dziennik']];
  $('#content').innerHTML = `<section class="history-shell"><div class="history-tools"><strong>Rejestr zmian projektu</strong><div>${types.map(([type, label]) => `<label class="mention"><input type="checkbox" data-history-type value="${type}" checked>${label}</label>`).join('')}</div><label>Grupuj <select id="history-group"><option value="hierarchy">Hierarchia projektu</option><option value="controller">Sterownik</option><option value="none">Bez grupowania</option></select></label><input id="history-search" type="search" placeholder="Szukaj osoby, elementu lub zmienionego pola…"></div><div id="history-feed" class="history-feed"></div></section>`;
  $('#history-group').value = state.grouping.history || 'hierarchy';
  $$('[data-history-type]').forEach(input => input.addEventListener('change', drawHistory)); $('#history-search').addEventListener('input', drawHistory); $('#history-group').addEventListener('change', event => { state.grouping.history = event.target.value; drawHistory(); }); drawHistory();
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

async function openDailySummary(automatic = false) {
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
  $('#daily-summary-content').innerHTML = `${priorities.length ? `<section class="priority-updates"><header><span><b>Najpierw dla Ciebie</b><small>Nowe przypisania i komentarze wymagające uwagi</small></span><span class="badge red">${priorities.length}</span></header>${priorities.map(item => `<button type="button" data-priority-notification="${item.id}"><span class="type-dot ${item.entity_type}"></span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.message || '')} · ${displayDateTime(item.created_at)}</small></span><span>→</span></button>`).join('')}</section>` : ''}<section class="summary-strip"><span><b>${data.totals.total}</b> tematów</span><span class="blue"><b>${data.totals.added}</b> dodanych</span><span class="green"><b>${data.totals.closed}</b> zamkniętych</span><span class="amber"><b>${data.totals.changed}</b> zmienionych</span><span><b>${data.totals.removed}</b> usuniętych</span><small>${displayDate(data.from)} – ${displayDate(data.to)}</small></section><div class="daily-module-grid">${order.map(type => {
    const module = data.modules[type];
    return `<section class="daily-module"><header><span class="history-icon ${type}">${({ status: '▦', task: '✓', point: '!', note: '▤' })[type]}</span><div><strong>${escapeHtml(module.name)}</strong><small>${module.total} zmienionych tematów · +${module.counts.added} / ✓${module.counts.closed} / ~${module.counts.changed}</small></div></header><div>${module.items.slice(0, 100).map(item => { const [label, color] = classes[item.classification]; return `<button class="daily-summary-row" ${item.exists ? `data-summary-jump="${item.entity_type}" data-id="${item.entity_id}"` : 'disabled'}><span class="badge ${color}">${label}</span><span><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.user_name)} · ${displayDateTime(item.changed_at)}</small></span><span>${item.exists ? '→' : 'usunięty'}</span></button>`; }).join('') || '<div class="empty compact-empty">Brak zmian w tym module.</div>'}</div></section>`;
  }).join('')}</div>`;
  $$('[data-summary-jump]').forEach(button => button.addEventListener('click', () => { $('#daily-summary-dialog').close(); jumpTo(button.dataset.summaryJump, Number(button.dataset.id)); }));
  $$('[data-priority-notification]').forEach(button => button.addEventListener('click', () => { $('#daily-summary-dialog').close(); openNotification(priorities.find(item => item.id === Number(button.dataset.priorityNotification))); }));
}

function tableFilterRow(columns) {
  return `<tr class="filters">${columns.map(column => `<th>${column.filter === false ? '' : column.values ? `<select data-filter="${column.key}">${selectOptions(column.values, '', 'Wszystkie')}</select>` : `<input data-filter="${column.key}" placeholder="Filtruj…">`}</th>`).join('')}</tr>`;
}

function orderedGroups(module, grouping, rows) {
  if (!grouping) return [''];
  const present = new Set(rows.map(row => row[grouping] || 'Bez wartości'));
  let order = [];
  if (module === 'status' && grouping === 'category') order = statusCategories();
  else if (module === 'status' && grouping === 'subcategory') order = state.config.categories.flatMap(category => category.subcategories.map(item => item.name));
  else if (module === 'status' && grouping === 'function_group_name') order = [...new Set((state.config.function_groups || []).map(group => group.name))];
  else if (module === 'status' && grouping === 'function_group_subcategory_name') order = state.config.function_groups.flatMap(group => (group.subcategories || []).map(item => item.name));
  else if (module === 'status' && grouping === 'status') order = ['Not started', 'Ready to test', 'In progress', 'Blocked', 'NOK / Rework', 'Retest required', 'Done', 'N/A'];
  else if (module === 'tasks' && grouping === 'category') order = taskCategories();
  else if (module === 'tasks' && grouping === 'subcategory') order = state.config.task_categories.flatMap(category => category.subcategories.map(item => item.name));
  else order = [...present];
  const result = order.filter(value => present.has(value));
  for (const value of present) if (!result.includes(value)) result.push(value);
  return result;
}

function renderStatus() {
  const d = state.dashboard;
  const columns = [
    { key: 'station', label: 'Grupa funkcyjna' }, { key: 'function_group_element_name', label: 'Element' }, { key: 'controller', label: 'PLC' },
    { key: 'category', label: 'Kategoria', values: statusCategories() }, { key: 'subcategory', label: 'Podkategoria' },
    { key: 'status', label: 'Status', values: ['Not started', 'Ready to test', 'In progress', 'Blocked', 'NOK / Rework', 'Retest required', 'Done', 'N/A'] },
    { key: 'related_work_progress', label: 'Prace dodatkowe' }, { key: 'criticality', label: 'Krytyczność', values: ['Low', 'Medium', 'High', 'Critical'] },
    { key: 'responsible_name', label: 'Odpowiedzialny' }, { key: 'requirement_names', label: 'Zapotrzebowanie', values: (state.config.requirements || []).map(item => item.name) }, { key: 'updated_at', label: 'Aktualizacja' }
  ];
  $('#content').innerHTML = `<div class="metrics">
    <article class="metric-card"><header><span>Postęp</span><span>${d.progress || 0}%</span></header><strong>${d.done || 0}/${d.total || 0}</strong><div class="progress"><i style="width:${d.progress || 0}%"></i></div></article>
    <article class="metric-card"><header><span>W trakcie</span></header><strong>${d.in_progress || 0}</strong></article>
    <article class="metric-card"><header><span>Zablokowane / NOK</span></header><strong>${d.blocked || 0}</strong></article>
  </div><div class="panel" id="status-panel"><div class="toolbar"><strong>Lista statusowa</strong><button id="quick-status-edit" class="secondary">Szybka edycja</button><label>Grupuj <select id="status-group"><option value="function_group_name">Grupa funkcyjna</option><option value="function_group_subcategory_name">Podkategoria grupy</option><option value="category">Kategoria</option><option value="subcategory">Podkategoria statusu</option><option value="status">Status</option><option value="">Bez grupowania</option></select></label></div>
  <div class="tablewrap"><table><thead><tr>${columns.map(column => `<th class="sortable" data-sort="${column.key}" data-label="${column.label}">${column.label}${sortMarker('status', column.key)}</th>`).join('')}</tr>${tableFilterRow(columns)}</thead><tbody id="status-body"></tbody></table></div></div>`;
  $('#status-group').value = state.grouping.status;
  $('#quick-status-edit').addEventListener('click', openQuickStatusEditor);
  $('#status-group').addEventListener('change', event => { state.grouping.status = event.target.value; drawStatusRows(); });
  $$('#status-panel [data-filter]').forEach(input => { input.addEventListener('input', drawStatusRows); input.addEventListener('change', drawStatusRows); });
  $$('#status-panel th[data-sort]').forEach(th => th.addEventListener('click', () => updateSort('status', th.dataset.sort)));
  drawStatusRows();
}

function drawStatusRows() {
  let rows = sortRows(filterRows(state.status, '#status-panel'), state.sort.status);
  const grouping = state.grouping.status;
  let html = '';
  for (const group of orderedGroups('status', grouping, rows)) {
    const items = grouping ? rows.filter(row => (row[grouping] || 'Bez wartości') === group) : rows;
    if (grouping) html += `<tr class="group-row"><td colspan="11">${escapeHtml(group)} <small>${items.length} pozycji</small></td></tr>`;
    html += items.map(item => `<tr data-id="${item.id}" data-preview-type="status" data-preview-id="${item.id}"><td class="maincell">${escapeHtml(item.function_group_name || item.station)}<span class="sub">${item.function_group_subcategory_name ? `${escapeHtml(item.function_group_subcategory_name)} · ` : ''}${escapeHtml(item.current_note || item.function_detail)}</span></td><td>${escapeHtml(item.function_group_element_name || '—')}</td><td>${escapeHtml(controllerLabel(item))}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.subcategory || '—')}</td><td>${badge(item.status)}</td><td><span class="status-related"><b>${item.related_work_progress}%</b><small class="sub">${item.related_work_done}/${item.related_work_total}</small><span class="progress"><i style="width:${item.related_work_progress}%"></i></span></span></td><td>${badge(item.criticality)}</td><td>${escapeHtml(item.responsible_name || '—')}</td><td>${escapeHtml(item.requirement_names || '—')}</td><td>${displayDate((item.updated_at || '').slice(0, 10))}</td></tr>`).join('');
  }
  $('#status-body').innerHTML = html || '<tr><td colspan="10" class="empty">Brak wyników</td></tr>';
  $$('#status-body tr[data-id]').forEach(row => {
    const item = state.status.find(entry => entry.id === Number(row.dataset.id));
    row.addEventListener('click', () => openRecord('status', item));
    row.addEventListener('contextmenu', event => showStatusContext(event, item));
  });
}

function showStatusContext(event, item) {
  event.preventDefault(); event.stopPropagation();
  const menu = $('#context-menu');
  menu.innerHTML = `<button data-action="edit">Edytuj punkt statusu</button><button data-action="duplicate">Duplikuj punkt…</button><button data-action="task">+ Utwórz powiązane zadanie</button><button data-action="point">+ Utwórz powiązany otwarty punkt</button><button data-action="note">+ Dodaj wpis w dzienniku</button><button data-action="done">Oznacz jako gotowe</button>`;
  menu.style.left = `${Math.min(event.clientX, innerWidth - 270)}px`; menu.style.top = `${Math.min(event.clientY, innerHeight - 240)}px`; menu.classList.remove('hidden');
  menu.querySelectorAll('button').forEach(button => button.addEventListener('click', async () => {
    menu.classList.add('hidden');
    if (button.dataset.action === 'edit') return openRecord('status', item);
    if (button.dataset.action === 'duplicate') return openDuplicate('status', item);
    if (button.dataset.action === 'done') {
      try { await api(`/api/status/${item.id}`, { method: 'PATCH', body: JSON.stringify({ ...item, status: 'Done' }) }); toast('Punkt oznaczono jako gotowy'); await loadData(); } catch (error) { toast(error.message, true); }
      return;
    }
    const type = button.dataset.action === 'task' ? 'tasks' : button.dataset.action === 'point' ? 'points' : 'notes';
    const prefill = { controller: item.controller, hierarchy_target: `controller:${item.controller}`, function_group_id: item.function_group_id, function_group_element_id: item.function_group_element_id, category: item.category, subcategory: item.subcategory, title: item.function_detail, content: `Aktualizacja statusu: ${item.function_detail}`, links: [{ entity_type: 'status', entity_id: item.id }] };
    openRecord(type, null, prefill);
  }));
}

function openQuickStatusEditor() {
  state.quickStatusDraft = state.status.map(item => ({ ...item }));
  $('#quick-status-search').value = '';
  renderQuickStatusRows();
  $('#quick-status-dialog').showModal();
}

function captureQuickStatusRows() {
  $$('#quick-status-body tr[data-id]').forEach(row => {
    const item = state.quickStatusDraft.find(entry => entry.id === Number(row.dataset.id));
    if (!item) return;
    row.querySelectorAll('[data-field]').forEach(input => {
      const field = input.dataset.field;
      item[field] = field === 'responsible_user_ids'
        ? [...input.selectedOptions].map(option => Number(option.value)).filter(Boolean)
        : ['function_group_id', 'function_group_subcategory_id', 'function_group_element_id'].includes(field) ? (Number(input.value) || null) : input.value;
    });
  });
}

function renderQuickStatusRows() {
  const query = ($('#quick-status-search').value || '').toLowerCase();
  const rows = state.quickStatusDraft.filter(item => !query || [controllerLabel(item), item.station, item.function_detail, item.category, item.subcategory, item.current_note]
    .join(' ').toLowerCase().includes(query));
  $('#quick-status-count').textContent = `${rows.length} z ${state.quickStatusDraft.length} punktów`;
  $('#quick-status-body').innerHTML = rows.map(item => `<tr data-id="${item.id}">
    <td><select data-field="controller" class="quick-controller">${selectOptions(state.controllers.map(controller => ({ value: controller.code, label: controller.display_name || controller.code })), item.controller)}</select></td>
    <td><select data-field="function_group_id">${selectOptions(functionGroups(item.controller).map(group => ({ value: group.id, label: group.name })), item.function_group_id, 'Bez grupy funkcyjnej')}</select></td>
    <td><select data-field="function_group_subcategory_id">${selectOptions(((state.config.function_groups || []).find(group => group.id === Number(item.function_group_id))?.subcategories || []).map(subcategory => ({ value: subcategory.id, label: subcategory.name })), item.function_group_subcategory_id, 'Bez podkategorii grupy')}</select></td>
    <td><select data-field="function_group_element_id">${selectOptions(((state.config.function_groups || []).find(group => group.id === Number(item.function_group_id))?.elements || []).map(element => ({ value: element.id, label: element.name })), item.function_group_element_id, 'Cała grupa')}</select></td>
    <td><input data-field="function_detail" value="${escapeHtml(item.function_detail)}"></td>
    <td><select data-field="category" class="quick-category">${selectOptions(statusCategories(), item.category)}</select></td>
    <td><select data-field="subcategory" class="quick-subcategory">${selectOptions(subcategories('status', item.category), item.subcategory, 'Bez podkategorii')}</select></td>
    <td><select data-field="criticality">${selectOptions(['Low', 'Medium', 'High', 'Critical'], item.criticality)}</select></td>
    <td><select data-field="status">${selectOptions(['Not started', 'Ready to test', 'In progress', 'Blocked', 'NOK / Rework', 'Retest required', 'Done', 'N/A'], item.status)}</select></td>
    <td><select data-field="responsible_user_ids" multiple size="2">${assignableUsers().map(user => `<option value="${user.id}" ${(item.responsible_user_ids || []).includes(user.id) ? 'selected' : ''}>${escapeHtml(user.display_name)}</option>`).join('')}</select></td>
    <td><textarea data-field="current_note" rows="2">${escapeHtml(item.current_note)}</textarea></td>
  </tr>`).join('') || '<tr><td colspan="11" class="empty">Brak wyników</td></tr>';
  $$('#quick-status-body .quick-controller').forEach(select => select.addEventListener('change', () => {
    captureQuickStatusRows();
    const row = select.closest('tr');
    const item = state.quickStatusDraft.find(entry => entry.id === Number(row.dataset.id));
    item.function_group_id = null;
    item.function_group_subcategory_id = null;
    item.function_group_element_id = null;
    row.querySelector('[data-field="function_group_id"]').innerHTML = selectOptions(functionGroups(select.value).map(group => ({ value: group.id, label: group.name })), '', 'Bez grupy funkcyjnej');
    row.querySelector('[data-field="function_group_subcategory_id"]').innerHTML = selectOptions([], '', 'Bez podkategorii grupy');
    row.querySelector('[data-field="function_group_element_id"]').innerHTML = selectOptions([], '', 'Cała grupa');
  }));
  $$('#quick-status-body [data-field="function_group_id"]').forEach(select => select.addEventListener('change', () => {
    const row = select.closest('tr'); const group = (state.config.function_groups || []).find(item => item.id === Number(select.value));
    row.querySelector('[data-field="function_group_subcategory_id"]').innerHTML = selectOptions((group?.subcategories || []).map(item => ({ value: item.id, label: item.name })), '', 'Bez podkategorii grupy');
    row.querySelector('[data-field="function_group_element_id"]').innerHTML = selectOptions((group?.elements || []).map(element => ({ value: element.id, label: element.name })), '', 'Cała grupa');
  }));
  $$('#quick-status-body .quick-category').forEach(select => select.addEventListener('change', () => {
    captureQuickStatusRows();
    const row = select.closest('tr');
    const item = state.quickStatusDraft.find(entry => entry.id === Number(row.dataset.id));
    item.subcategory = '';
    row.querySelector('.quick-subcategory').innerHTML = selectOptions(subcategories('status', select.value), '', 'Bez podkategorii');
  }));
}

async function saveQuickStatus() {
  captureQuickStatusRows();
  const button = $('#quick-status-save');
  button.disabled = true;
  try {
    await api('/api/status/batch', { method: 'PATCH', body: JSON.stringify({ items: state.quickStatusDraft }) });
    $('#quick-status-dialog').close();
    toast(`Zapisano ${state.quickStatusDraft.length} punktów statusu`);
    await loadData();
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

function openBulkStatus() {
  const controller = defaultValue('controller');
  $('#bulk-status-fields').innerHTML = `<label class="field required-field"><span>Sterownik *</span><select name="controller" id="bulk-status-controller" required>${selectOptions(state.controllers.map(item => ({ value: item.code, label: item.display_name })), controller)}</select></label>
    <label class="field"><span>Grupa funkcyjna</span><select name="function_group_id" id="bulk-status-group">${selectOptions(functionGroups(controller).map(item => ({ value: item.id, label: item.name })), '', 'Bez grupy funkcyjnej')}</select></label>
    <label class="field required-field"><span>Kategoria *</span><select name="category" id="bulk-status-category" required>${selectOptions(statusCategories(), statusCategories()[0] || '')}</select></label>
    <label class="field"><span>Podkategoria</span><select name="subcategory" id="bulk-status-subcategory">${selectOptions(subcategories('status', statusCategories()[0] || ''), '', 'Bez podkategorii')}</select></label>
    <label class="field"><span>Krytyczność</span><select name="criticality">${selectOptions(['Low', 'Medium', 'High', 'Critical'], 'Medium', '')}</select></label>
    <label class="field"><span>Status początkowy</span><select name="status">${selectOptions(['Not started', 'Ready to test', 'In progress', 'Blocked', 'NOK / Rework', 'Retest required', 'Done', 'N/A'], 'Not started', '')}</select></label>
    <label class="field full required-field big"><span>Punkty do dodania *</span><textarea name="names" rows="14" required placeholder="Każdy wiersz to osobny punkt, np.&#10;Sprawdź sygnał QM1&#10;Sprawdź sygnał QM2&#10;Potwierdź blokadę osłony"></textarea><small class="sub">Maksymalnie 500 punktów w jednej operacji. Nazwy mogą się powtarzać.</small></label>${requirementsField({}, 'requirement_ids', 'Dodatkowe zapotrzebowanie')}`;
  $('#bulk-status-controller').addEventListener('change', event => { $('#bulk-status-group').innerHTML = selectOptions(functionGroups(event.target.value).map(item => ({ value: item.id, label: item.name })), '', 'Bez grupy funkcyjnej'); });
  $('#bulk-status-category').addEventListener('change', event => { $('#bulk-status-subcategory').innerHTML = selectOptions(subcategories('status', event.target.value), '', 'Bez podkategorii'); });
  $('#bulk-status-dialog').dataset.dirty = '';
  $('#bulk-status-dialog').showModal();
}

async function saveBulkStatus(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const input = Object.fromEntries(form);
  input.requirement_ids = form.getAll('requirement_ids').map(Number);
  input.responsible_user_ids = [];
  input.function_group_id = Number(input.function_group_id) || null;
  const count = String(input.names || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean).length;
  if (!count) return toast('Wklej co najmniej jeden punkt', true);
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
  return `<article class="task-card compact" draggable="true" data-task-id="${item.id}" data-preview-type="task" data-preview-id="${item.id}"><div class="task-card-head"><h3>${escapeHtml(item.title)}</h3><span class="progress-value ${item.progress >= 100 ? 'done' : item.progress > 0 ? 'active' : ''}"><b>${item.progress || 0}%</b><i><u style="width:${item.progress || 0}%"></u></i></span></div><p>${escapeHtml(controllerLabel(item))} · ${escapeHtml(item.function_group_name || item.other_object || (item.scope_is_group ? 'zadanie obszarowe' : 'bez grupy'))}${item.function_group_element_name ? ` → ${escapeHtml(item.function_group_element_name)}` : ''}</p><div class="cardmeta"><span>${escapeHtml(item.owner_name || 'Nieprzypisane')}</span><span>${item.due_date ? displayDate(item.due_date) : 'bez deadline’u'}</span></div>${time ? `<span class="time-chip ${time.overdue ? 'overdue' : ''}">${escapeHtml(time.label)}</span>` : ''}<div class="checkbar"><i style="width:${item.progress || 0}%"></i></div><div class="task-card-foot"><button type="button" class="task-check-count" data-checklist-task="${item.id}">${allChecks.filter(entry => entry.done).length}/${allChecks.length} punktów kontroli</button><span>${escapeHtml(item.category || 'Bez kategorii')} · utworzył ${escapeHtml(item.created_by_name || 'dane historyczne')}</span></div></article>`;
}

function renderTasks() {
  $('#content').innerHTML = `<div class="panel"><div class="toolbar"><strong>Zadania</strong><button id="task-board-mode" class="secondary ${state.taskMode === 'board' ? 'active-toggle' : ''}">Tablica</button><button id="task-list-mode" class="secondary ${state.taskMode === 'list' ? 'active-toggle' : ''}">Lista</button><input id="task-search" placeholder="Szukaj we wszystkich polach"><select id="task-category">${selectOptions(taskCategories(), '', 'Wszystkie kategorie')}</select><select id="task-requirement">${selectOptions((state.config.requirements || []).map(item => item.name), '', 'Każde zapotrzebowanie')}</select>${state.taskMode === 'list' ? `<label class="toggle-line compact-toggle"><input type="checkbox" id="task-show-completed" ${state.taskShowCompleted ? 'checked' : ''}> Pokaż ukończone</label>` : ''}</div></div><div id="task-content"></div>`;
  $('#task-board-mode').addEventListener('click', () => { state.taskMode = 'board'; renderTasks(); });
  $('#task-list-mode').addEventListener('click', () => { state.taskMode = 'list'; renderTasks(); });
  $('#task-search').addEventListener('input', drawTasks);
  $('#task-category').addEventListener('change', drawTasks);
  $('#task-requirement').addEventListener('change', drawTasks);
  $('#task-show-completed')?.addEventListener('change', event => { state.taskShowCompleted = event.target.checked; drawTasks(); });
  drawTasks();
}

function filteredTasks() {
  const query = ($('#task-search')?.value || '').toLowerCase();
  const category = $('#task-category')?.value || '';
  const requirement = $('#task-requirement')?.value || '';
  return state.tasks.filter(item => (state.taskMode !== 'list' || state.taskShowCompleted || item.status !== 'Done') && (!query || JSON.stringify(item).toLowerCase().includes(query)) && (!category || item.category === category) && (!requirement || (item.requirement_names || '').split(', ').includes(requirement)));
}

function drawTasks() {
  if (state.taskMode === 'board') drawTaskBoard();
  else drawTaskList();
}

function drawTaskBoard() {
  const lanes = [['To do', 'Do zrobienia', 'todo'], ['In progress', 'W trakcie', 'progressing'], ['Done', 'Ukończone', 'done']];
  const rows = filteredTasks();
  $('#task-content').innerHTML = `<div class="board">${lanes.map(([status, label, className]) => {
    const items = rows.filter(item => item.status === status);
    return `<section class="lane ${className}" data-status="${status}"><div class="lanehead"><span>${label}</span><span>${items.length}</span></div>${items.map(taskCard).join('') || '<div class="empty">Przeciągnij tutaj zadanie</div>'}</section>`;
  }).join('')}</div>`;
  $$('.task-card').forEach(card => {
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
      try { await api(`/api/tasks/${task.id}`, { method: 'PATCH', body: JSON.stringify({ ...task, status: lane.dataset.status }) }); toast('Status zadania został zmieniony'); await loadData(); }
      catch (error) { toast(error.message, true); }
    });
  });
}

function drawTaskList() {
  const columns = [
    { key: 'title', label: 'Zadanie' }, { key: 'scope_label', label: 'Zakres / PLC' }, { key: 'function_group_name', label: 'Grupa funkcyjna' }, { key: 'function_group_element_name', label: 'Element grupy' }, { key: 'category', label: 'Kategoria', values: taskCategories() },
    { key: 'subcategory', label: 'Podkategoria' }, { key: 'requirement_names', label: 'Zapotrzebowanie', values: (state.config.requirements || []).map(item => item.name) }, { key: 'status', label: 'Status', values: ['To do', 'In progress', 'Done'] },
    { key: 'owner_name', label: 'Odpowiedzialni' }, { key: 'progress', label: 'Postęp' }, { key: 'start_date', label: 'Start' }, { key: 'due_date', label: 'Deadline' }, { key: 'priority', label: 'Priorytet' }
  ];
  $('#task-content').innerHTML = `<div class="panel" id="task-list-panel"><div class="toolbar"><strong>Widok listy</strong><label>Grupuj <select id="task-group"><option value="">Bez grupowania</option><option value="function_group_name">Grupa funkcyjna</option><option value="function_group_element_name">Element grupy</option><option value="category">Kategoria</option><option value="subcategory">Podkategoria</option><option value="status">Status</option><option value="owner_name">Odpowiedzialny</option><option value="scope_label">Zakres hierarchii</option></select></label></div><div class="tablewrap"><table><thead><tr>${columns.map(column => `<th class="sortable" data-sort="${column.key}" data-label="${column.label}">${column.label}${sortMarker('tasks', column.key)}</th>`).join('')}</tr>${tableFilterRow(columns)}</thead><tbody id="task-list-body"></tbody></table></div></div>`;
  $('#task-group').value = state.grouping.tasks;
  $('#task-group').addEventListener('change', event => { state.grouping.tasks = event.target.value; drawTaskListRows(); });
  $$('#task-list-panel [data-filter]').forEach(input => { input.addEventListener('input', drawTaskListRows); input.addEventListener('change', drawTaskListRows); });
  $$('#task-list-panel th[data-sort]').forEach(th => th.addEventListener('click', () => updateSort('tasks', th.dataset.sort)));
  drawTaskListRows();
}

function drawTaskListRows() {
  let rows = sortRows(filterRows(filteredTasks(), '#task-list-panel'), state.sort.tasks);
  const grouping = state.grouping.tasks;
  let html = '';
  for (const group of orderedGroups('tasks', grouping, rows)) {
    const items = grouping ? rows.filter(row => (row[grouping] || 'Bez wartości') === group) : rows;
    if (grouping) html += `<tr class="group-row"><td colspan="13">${escapeHtml(group)} <small>${items.length} pozycji</small></td></tr>`;
    html += items.map(item => { const time = taskTimeLabel(item); return `<tr data-id="${item.id}" data-preview-type="task" data-preview-id="${item.id}"><td class="maincell">${escapeHtml(item.title)}<span class="sub">${escapeHtml(item.description)}</span>${time ? `<span class="time-chip ${time.overdue ? 'overdue' : ''}">${escapeHtml(time.label)}</span>` : ''}</td><td>${escapeHtml(controllerLabel(item))}</td><td>${escapeHtml(item.function_group_name || item.other_object || '—')}</td><td>${escapeHtml(item.function_group_element_name || '—')}</td><td>${escapeHtml(item.category || '—')}</td><td>${escapeHtml(item.subcategory || '—')}</td><td>${escapeHtml(item.requirement_names || '—')}</td><td>${badge(item.status)}</td><td>${escapeHtml(item.owner_name || '—')}</td><td><span class="table-progress"><i><u style="width:${item.progress || 0}%"></u></i><b>${item.progress || 0}%</b></span></td><td>${displayDate(item.start_date)}</td><td>${displayDate(item.due_date)}</td><td>${badge(item.priority)}</td></tr>`; }).join('');
  }
  $('#task-list-body').innerHTML = html || '<tr><td colspan="12" class="empty">Brak wyników</td></tr>';
  $$('#task-list-body tr[data-id]').forEach(row => {
    const item = state.tasks.find(value => value.id === Number(row.dataset.id));
    row.addEventListener('click', () => openRecord('tasks', item));
    row.addEventListener('contextmenu', event => showEntityContext(event, 'tasks', item));
  });
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
  $('#content').innerHTML = `<div class="goalgrid">${state.goals.map(goal => {
    const links = goal.links || [];
    const done = links.filter(link => ['Done', 'Closed'].includes(entity(link.entity_type, link.entity_id)?.status)).length;
    const progress = links.length ? Math.round(done * 100 / links.length) : 0;
    return `<article class="goal clickable-goal" data-goal-id="${goal.id}" tabindex="0"><div class="cardmeta"><span>${escapeHtml(controllerLabel(goal) || 'Wszystkie PLC')}</span>${badge(goal.status)}</div><h3>${escapeHtml(goal.title)}</h3><p>${escapeHtml(goal.description)}</p><div class="progress"><i style="width:${progress}%"></i></div><p>${done}/${links.length} powiązanych elementów ukończonych · termin ${displayDate(goal.due_date)}</p><div class="goal-links">${links.map(link => { const item = entity(link.entity_type, link.entity_id); return item ? `<button class="jump" data-type="${link.entity_type}" data-id="${item.id}"><span>${escapeHtml(entityLabel(link.entity_type, item))}</span><span>→</span></button>` : '<div class="sub">Powiązany element jest niedostępny</div>'; }).join('') || '<span class="sub">Nie wybrano jeszcze elementów</span>'}</div><button class="secondary edit-goal" data-id="${goal.id}">Edytuj cel</button></article>`;
  }).join('') || '<div class="empty">Nie zdefiniowano celów.</div>'}</div>`;
  $$('.edit-goal').forEach(button => button.addEventListener('click', () => openRecord('goals', state.goals.find(item => item.id === Number(button.dataset.id)))));
  $$('.clickable-goal').forEach(card => {
    const edit = event => { if (event.target.closest('button,a')) return; openRecord('goals', state.goals.find(item => item.id === Number(card.dataset.goalId))); };
    card.addEventListener('click', edit);
    card.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); edit(event); } });
  });
  bindJumpItems();
}

function renderPoints() {
  $('#content').innerHTML = `<div class="panel"><div class="toolbar"><strong>Otwarte punkty</strong><button id="point-list-mode" class="secondary ${state.pointMode === 'list' ? 'active-toggle' : ''}">Pełna lista</button><button id="point-reminder-mode" class="secondary ${state.pointMode === 'reminders' ? 'active-toggle' : ''}">Przypomnienia</button></div></div><div id="point-content"></div>`;
  $('#point-list-mode').addEventListener('click', () => { state.pointMode = 'list'; renderPoints(); });
  $('#point-reminder-mode').addEventListener('click', () => { state.pointMode = 'reminders'; renderPoints(); });
  if (state.pointMode === 'reminders') drawReminderView(); else drawPointList();
}

function drawPointList() {
  const columns = [
    { key: 'title', label: 'Temat' }, { key: 'controller', label: 'PLC' }, { key: 'category', label: 'Kategoria', values: statusCategories() },
    { key: 'subcategory', label: 'Podkategoria' }, { key: 'status', label: 'Status', values: ['Open', 'Waiting', 'In progress', 'Closed'] },
    { key: 'waiting_for', label: 'Oczekiwanie na', values: options('waiting_for') }, { key: 'owner_name', label: 'Odpowiedzialny' },
    { key: 'requirement_names', label: 'Zapotrzebowanie', values: (state.config.requirements || []).map(item => item.name) }, { key: 'due_date', label: 'Deadline' }, { key: 'reminder_date', label: 'Przypomnienie' }
  ];
  $('#point-content').innerHTML = `<div class="panel" id="points-panel"><div class="toolbar"><strong>Lista punktów</strong><input data-filter="_all" placeholder="Szukaj we wszystkich informacjach"></div><div class="tablewrap"><table><thead><tr>${columns.map(column => `<th class="sortable" data-sort="${column.key}" data-label="${column.label}">${column.label}${sortMarker('points', column.key)}</th>`).join('')}</tr>${tableFilterRow(columns)}</thead><tbody id="points-body"></tbody></table></div></div>`;
  $$('#points-panel [data-filter]').forEach(input => { input.addEventListener('input', drawPointRows); input.addEventListener('change', drawPointRows); });
  $$('#points-panel th[data-sort]').forEach(th => th.addEventListener('click', () => updateSort('points', th.dataset.sort)));
  drawPointRows();
}

function drawPointRows() {
  const rows = sortRows(filterRows(state.points, '#points-panel'), state.sort.points);
  $('#points-body').innerHTML = rows.map(item => `<tr data-id="${item.id}" data-preview-type="point" data-preview-id="${item.id}"><td class="maincell">${escapeHtml(item.title)}<span class="sub">${escapeHtml(item.description)}</span><span class="sub">Utworzył: ${escapeHtml(item.created_by_name || 'dane historyczne')} · ${displayDate((item.created_at || '').slice(0, 10))}</span></td><td>${escapeHtml(controllerLabel(item))}</td><td>${escapeHtml(item.category || '—')}</td><td>${escapeHtml(item.subcategory || '—')}</td><td>${badge(item.status)}</td><td>${escapeHtml(item.waiting_for || '—')}</td><td>${escapeHtml(item.owner_name || '—')}</td><td>${escapeHtml(item.requirement_names || '—')}</td><td>${displayDate(item.due_date)}</td><td>${displayDate(item.reminder_date)}</td></tr>`).join('') || '<tr><td colspan="10" class="empty">Brak wyników</td></tr>';
  $$('#points-body tr[data-id]').forEach(row => {
    const item = state.points.find(value => value.id === Number(row.dataset.id));
    row.addEventListener('click', () => openRecord('points', item));
    row.addEventListener('contextmenu', event => showEntityContext(event, 'points', item));
  });
}

function showEntityContext(event, type, item) {
  if (!item) return;
  event.preventDefault(); event.stopPropagation();
  const menu = $('#context-menu');
  menu.innerHTML = '<button data-action="edit">Edytuj</button><button data-action="duplicate">Duplikuj…</button>';
  menu.style.left = `${Math.min(event.clientX, innerWidth - 240)}px`;
  menu.style.top = `${Math.min(event.clientY, innerHeight - 130)}px`;
  menu.classList.remove('hidden');
  menu.querySelector('[data-action="edit"]').addEventListener('click', () => { menu.classList.add('hidden'); openRecord(type, item); });
  menu.querySelector('[data-action="duplicate"]').addEventListener('click', () => { menu.classList.add('hidden'); openDuplicate(type, item); });
}

function previewPointerOver(event) {
  const target = event.target.closest?.('[data-preview-type][data-preview-id]');
  if (!target || target.contains(event.relatedTarget) || matchMedia('(hover: none)').matches) return;
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(() => showEntityPreview(target), 320);
}

function previewPointerOut(event) {
  const target = event.target.closest?.('[data-preview-type][data-preview-id]');
  if (!target || target.contains(event.relatedTarget)) return;
  clearTimeout(state.previewTimer);
  $('#entity-preview').classList.add('hidden');
}

function showEntityPreview(target) {
  if (!target?.isConnected || document.querySelector('dialog[open]')) return;
  const type = target.dataset.previewType;
  const item = entity(type, Number(target.dataset.previewId));
  if (!item) return;
  const title = entityLabel(type, item);
  const owner = item.owner_name || item.responsible_name || 'Nieprzypisane';
  const date = item.due_date || item.reminder_date || item.checked_on;
  const description = item.description || item.current_note || item.function_detail || '';
  const extra = type === 'task' ? `${item.progress || 0}% wykonania` : type === 'status' ? `${item.related_work_progress || 0}% prac dodatkowych` : item.waiting_for || '';
  const preview = $('#entity-preview');
  preview.innerHTML = `<header><span class="type-dot ${type}"></span><b>${escapeHtml(title)}</b></header><p>${escapeHtml(description).slice(0, 260)}</p><dl><div><dt>Zakres</dt><dd>${escapeHtml(controllerLabel(item) || 'Cały projekt')}</dd></div><div><dt>Status</dt><dd>${escapeHtml(badgeText(item.status))}</dd></div><div><dt>Odpowiedzialni</dt><dd>${escapeHtml(owner)}</dd></div>${date ? `<div><dt>Termin</dt><dd>${displayDate(date)}</dd></div>` : ''}${extra ? `<div><dt>Postęp / informacja</dt><dd>${escapeHtml(extra)}</dd></div>` : ''}</dl>`;
  const rect = target.getBoundingClientRect();
  const width = 340;
  preview.style.left = `${Math.max(12, Math.min(innerWidth - width - 12, rect.left + Math.min(rect.width, 80)))}px`;
  preview.style.top = `${Math.max(70, Math.min(innerHeight - 260, rect.bottom + 8))}px`;
  preview.classList.remove('hidden');
}

function openTaskChecklistPopup(taskId) {
  const task = state.tasks.find(item => item.id === Number(taskId));
  if (!task) return;
  state.checklistTask = task;
  $('#task-checklist-title').textContent = task.title;
  $('#task-checklist-description').textContent = `${controllerLabel(task)} · ${task.progress || 0}% wykonania`;
  $('#task-checklist-popup').innerHTML = `<section class="checks compact-popup-checks"><header><span><b>Podzadania</b><small>Waga wpływa na procent wykonania całego zadania.</small></span><button type="button" class="mini" id="popup-add-check">+ Podzadanie</button></header><div id="popup-checklist">${(task.checklist || []).map(checklistRow).join('') || checklistRow()}</div></section>${(task.scope_checklist || []).length ? `<section class="scope-checks compact-popup-scope"><header><span><b>Kontrola sterowników w zakresie</b><small>Elementy automatycznie utworzone z hierarchii projektu.</small></span></header><div>${task.scope_checklist.map(item => `<label class="scope-check-row"><input type="checkbox" data-popup-scope-controller="${item.controller_id}" ${item.done ? 'checked' : ''}><span><b>${escapeHtml(item.controller_label || auditControllerName(item.controller_id))}</b></span></label>`).join('')}</div></section>` : ''}`;
  const bind = () => $$('#task-checklist-popup .delete-check').forEach(button => button.onclick = () => button.closest('.check-row').remove());
  bind();
  $('#popup-add-check').addEventListener('click', () => { $('#popup-checklist').insertAdjacentHTML('beforeend', checklistRow()); bind(); });
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
  bindJumpItems();
}

function renderNotes() {
  const weeks = [...new Map(state.notes.map(item => { const week = isoWeek(item.note_date); return [week.key, week]; })).values()];
  $('#content').innerHTML = `<div class="panel"><div class="toolbar"><strong>Historia wpisów</strong><label>Od <input type="date" id="notes-from" value="${state.notesFrom}"></label><label>Do <input type="date" id="notes-to" value="${state.notesTo}"></label><label>Calendar week <select id="week-filter">${selectOptions(weeks.map(week => ({ value: week.key, label: week.label })), state.notesWeek, 'Wszystkie CW')}</select></label><label>Grupuj <select id="notes-group"><option value="controller">Sterownik</option><option value="type">Typ wpisu</option><option value="shift">Zmiana</option><option value="cw">Calendar week</option><option value="">Bez grupowania</option></select></label><button id="notes-refresh" class="secondary">Odśwież zakres</button></div></div><div id="notes-list" class="notes"></div>`;
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
  const rows = state.notes.map(item => ({ ...item, cw: isoWeek(item.note_date).label, cwKey: isoWeek(item.note_date).key })).filter(item => !weekFilter || item.cwKey === weekFilter);
  const grouping = state.grouping.notes;
  const groups = grouping ? [...new Set(rows.map(item => item[grouping] || 'Bez wartości'))] : [''];
  $('#notes-list').innerHTML = groups.map(group => `${grouping ? `<div class="group-title">${escapeHtml(group)} · ${rows.filter(item => (item[grouping] || 'Bez wartości') === group).length}</div>` : ''}${(grouping ? rows.filter(item => (item[grouping] || 'Bez wartości') === group) : rows).map(item => `<article class="note" data-id="${item.id}"><div class="note-meta">${displayDate(item.note_date)} · ${escapeHtml(item.cw)}<br>${escapeHtml(controllerLabel(item) || 'Ogólne')} · ${escapeHtml(item.shift)}<br>${escapeHtml(item.author || item.created_by_name)}<br>Utworzono: ${displayDateTime(item.created_at)}</div><div><strong>${escapeHtml(item.type)}</strong><p>${escapeHtml(item.content)}</p><div class="links">${(item.links || []).map(link => linkChip(link.entity_type, link.entity_id, ({ status: 'Status', task: 'Zadanie', point: 'Otwarty punkt' })[link.entity_type] || link.entity_type)).join('')}</div></div></article>`).join('')}`).join('') || '<div class="empty">Brak wpisów</div>';
  $$('.note[data-id]').forEach(row => row.addEventListener('click', event => { if (!event.target.closest('.jump')) openRecord('notes', state.notes.find(item => item.id === Number(row.dataset.id))); }));
  bindJumpItems();
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

function categoryConfig(scope, categories, admin) {
  const kind = scope === 'task' ? 'task_categories' : 'categories';
  const subKind = scope === 'task' ? 'task_subcategories' : 'subcategories';
  const deleteCategory = scope === 'task' ? 'task_category' : 'category';
  const deleteSub = scope === 'task' ? 'task_subcategory' : 'subcategory';
  return categories.map((category, index) => `<div class="settings-row">${orderControls(kind, categories, index)}<span><b>${escapeHtml(category.name)}</b></span><button class="mini edit-category" data-scope="${scope}" data-id="${category.id}" data-value="${escapeHtml(category.name)}">Edytuj</button><button class="mini add-sub" data-scope="${scope}" data-id="${category.id}">+ podkategoria</button>${admin ? `<button class="mini delete-config" data-kind="${deleteCategory}" data-id="${category.id}">Usuń</button>` : ''}</div>${category.subcategories.map((sub, subIndex) => `<div class="settings-row">${orderControls(subKind, category.subcategories, subIndex)}<span>↳ ${escapeHtml(sub.name)}${scope === 'status' && sub.default_function ? `<small class="sub">${escapeHtml(sub.default_function)}</small>` : ''}</span><button class="mini edit-sub" data-scope="${scope}" data-id="${sub.id}" data-parent="${category.id}" data-value="${escapeHtml(sub.name)}" data-function="${escapeHtml(sub.default_function || '')}">Edytuj</button>${admin ? `<button class="mini delete-config" data-kind="${deleteSub}" data-id="${sub.id}">Usuń</button>` : ''}</div>`).join('')}`).join('');
}

function functionGroupConfig(admin) {
  const groups = functionGroups(state.functionGroupController);
  return `<section class="settings-card settings-wide"><div class="settings-title-row"><div><h2>Grupy funkcyjne i punkty statusu</h2><p class="sub">Osobna, uporządkowana lista stacji, robotów i innych grup dla każdego sterownika.</p></div><label class="field compact-field"><span>Sterownik</span><select id="function-group-controller">${selectOptions(state.controllers.map(item => ({ value: item.code, label: item.display_name || item.code })), state.functionGroupController)}</select></label></div>
    <div class="function-group-list">${groups.map((group, index) => `<div class="function-group-block"><div class="settings-row function-group-row">${admin ? orderControls('function_groups', groups, index) : ''}<span><b>${escapeHtml(group.name)}</b><small class="sub">${group.check_count} zdefiniowanych punktów · ${group.status_count} wierszy w Statusie</small><span class="element-list">${(group.elements || []).map(element => `<span class="element-chip">${escapeHtml(element.name)}${admin ? ` <button class="delete-element" data-group="${group.id}" data-id="${element.id}" title="Usuń">×</button>` : ''}</span>`).join('') || '<small>Brak elementów</small>'}</span><span class="element-list group-subcategory-list">${(group.subcategories || []).map((subcategory, subIndex) => `<span class="element-chip violet">${admin ? orderControls('function_group_subcategories', group.subcategories, subIndex) : ''}${escapeHtml(subcategory.name)}${admin ? ` <button class="edit-group-subcategory" data-group="${group.id}" data-id="${subcategory.id}" data-name="${escapeHtml(subcategory.name)}" title="Edytuj">✎</button> <button class="delete-group-subcategory" data-group="${group.id}" data-id="${subcategory.id}" title="Usuń">×</button>` : ''}</span>`).join('') || '<small>Brak własnych podkategorii grupy</small>'}</span></span>${admin ? `<button class="mini edit-function-points" data-id="${group.id}">Punkty statusu</button><button class="mini rename-function-group" data-id="${group.id}" data-value="${escapeHtml(group.name)}">Zmień nazwę</button><button class="mini delete-function-group" data-id="${group.id}">Usuń</button>` : ''}</div>${admin ? `<div class="bulk-groups two"><label class="field"><span>Elementy grupy — po jednym wierszu</span><textarea class="bulk-elements" data-group="${group.id}" rows="2" placeholder="QM1\nQM2\nBZ1"></textarea><button class="mini bulk-elements-add" data-group="${group.id}">Dodaj elementy</button></label><label class="field"><span>Własne podkategorie — po jednym wierszu</span><textarea class="bulk-group-subcategories" data-group="${group.id}" rows="2" placeholder="Napędy\nCzujniki\nSekwencja"></textarea><button class="mini bulk-group-subcategories-add" data-group="${group.id}">Dodaj podkategorie</button></label></div>` : ''}</div>`).join('') || '<div class="empty compact-empty">Brak grup funkcyjnych dla wybranego sterownika.</div>'}</div>
    ${admin ? `<div class="function-group-actions"><form id="new-function-group" class="inline-form"><input name="name" placeholder="Nowa grupa, np. Robot R01" required><button class="mini">Dodaj grupę</button></form><div class="bulk-groups"><label class="field"><span>Szybkie dodawanie — jeden wiersz = jedna grupa funkcyjna</span><textarea id="bulk-function-groups" rows="6" placeholder="Stacja 010\nRobot R01\nRobot R02"></textarea></label><button class="secondary" id="bulk-function-groups-add">Dodaj listę</button></div></div>` : '<p class="sub">Edycja grup funkcyjnych jest dostępna dla administratora.</p>'}
  </section>`;
}

function controllerHierarchyConfig(admin) {
  const children = parentId => state.controllerGroups.filter(group => Number(group.parent_id || 0) === Number(parentId || 0));
  if (!state.hierarchySelection || ![...state.controllerGroups.map(item => `group:${item.id}`), ...state.controllers.map(item => `controller:${item.id}`)].includes(state.hierarchySelection)) state.hierarchySelection = state.controllerGroups[0] ? `group:${state.controllerGroups[0].id}` : state.controllers[0] ? `controller:${state.controllers[0].id}` : null;
  const rows = [];
  const walk = (parentId, depth) => {
    const siblings = children(parentId);
    siblings.forEach((group, index) => {
      rows.push(`<div class="hierarchy-tree-row ${state.hierarchySelection === `group:${group.id}` ? 'selected' : ''}" style="--depth:${depth}">${admin ? orderControls('controller_groups', siblings, index) : ''}<button type="button" class="select-hierarchy-node" data-node="group:${group.id}"><b>▰ ${escapeHtml(group.name)}</b><small>${escapeHtml(group.path_label || group.name)}</small></button><span class="node-count">${state.controllers.filter(item => Number(item.group_id) === group.id).length}</span></div>`);
      state.controllers.filter(item => Number(item.group_id || 0) === group.id).forEach(controller => rows.push(`<div class="hierarchy-tree-row controller-leaf ${state.hierarchySelection === `controller:${controller.id}` ? 'selected' : ''}" style="--depth:${depth + 1}"><button type="button" class="select-hierarchy-node" data-node="controller:${controller.id}"><b>◇ ${escapeHtml(controller.leaf_code || controller.display_name)}</b><small>${escapeHtml(controller.display_name || controller.hierarchy_label || '')}</small></button></div>`));
      walk(group.id, depth + 1);
    });
  };
  walk(null, 0);
  state.controllers.filter(item => !item.group_id).forEach(controller => rows.push(`<div class="hierarchy-tree-row controller-leaf ${state.hierarchySelection === `controller:${controller.id}` ? 'selected' : ''}" style="--depth:0"><button type="button" class="select-hierarchy-node" data-node="controller:${controller.id}"><b>◇ ${escapeHtml(controller.leaf_code || controller.display_name)}</b><small>Bez przypisanego obszaru</small></button></div>`));
  const [kind, rawId] = String(state.hierarchySelection || '').split(':');
  const selected = kind === 'group' ? state.controllerGroups.find(item => item.id === Number(rawId)) : state.controllers.find(item => item.id === Number(rawId));
  const details = !selected ? '<div class="empty">Wybierz element z drzewa lub utwórz pierwszy obszar.</div>' : kind === 'group'
    ? `<div class="hierarchy-detail-head"><span class="hierarchy-symbol">▰</span><div><small>${selected.parent_id ? 'Podobszar' : 'Obszar główny'}</small><h3>${escapeHtml(selected.name)}</h3><p>${escapeHtml(selected.path_label || selected.name)}</p></div></div><p>${escapeHtml(selected.description || 'Brak dodatkowego opisu.')}</p><dl class="hierarchy-facts"><div><dt>Poziom</dt><dd>${selected.depth}</dd></div><div><dt>Podobszary</dt><dd>${children(selected.id).length}</dd></div><div><dt>Sterowniki bezpośrednie</dt><dd>${state.controllers.filter(item => Number(item.group_id) === selected.id).length}</dd></div></dl>${admin ? `<div class="hierarchy-actions">${Number(selected.depth) < 2 ? `<button class="secondary add-child-group" data-id="${selected.id}">+ Dodaj podobszar</button>` : ''}<button class="secondary" id="new-controller-selected" data-group="${selected.id}">+ Dodaj sterownik</button><button class="mini edit-controller-group" data-id="${selected.id}" data-parent="${selected.parent_id || ''}" data-name="${escapeHtml(selected.name)}">Edytuj obszar</button><button class="mini danger-outline delete-controller-group" data-id="${selected.id}">Usuń obszar</button></div>` : ''}`
    : `<div class="hierarchy-detail-head"><span class="hierarchy-symbol controller">◇</span><div><small>Sterownik końcowy</small><h3>${escapeHtml(selected.display_name || selected.leaf_code)}</h3><p>${escapeHtml(selected.hierarchy_label || 'Bez obszaru')}</p></div></div><p>${escapeHtml(selected.description || 'Brak dodatkowego opisu.')}</p><dl class="hierarchy-facts"><div><dt>Kod lokalny</dt><dd>${escapeHtml(selected.leaf_code)}</dd></div><div><dt>Obszar</dt><dd>${escapeHtml(selected.area || '—')}</dd></div></dl>${admin ? `<div class="hierarchy-actions"><button class="primary edit-controller" data-id="${selected.id}">Edytuj sterownik</button></div>` : ''}`;
  return `<div class="hierarchy-editor"><aside><div class="hierarchy-tree-toolbar"><strong>Struktura projektu</strong>${admin ? '<button class="mini" id="new-root-group">+ Obszar</button>' : ''}</div><div class="config-tree compact-tree">${rows.join('') || '<div class="empty compact-empty">Brak hierarchii sterowników.</div>'}</div>${admin ? '<button class="secondary full-width" id="new-controller">+ Sterownik bez obszaru</button>' : ''}</aside><section class="hierarchy-detail">${details}</section></div>`;
}

function canManageUser(item) {
  return state.me.role === 'system_admin' || (state.me.role === 'project_admin' && item.system_role !== 'system_admin' && item.project_role !== 'project_admin');
}

function renderSettings() {
  const admin = ['system_admin', 'project_admin'].includes(state.me.role);
  const systemAdmin = state.me.role === 'system_admin';
  const launchers = [
    ...(systemAdmin ? [['projects', 'Projekty systemu', 'Globalne projekty, dostęp i bezpieczne usuwanie', state.projects.length, '▦']] : []),
    ['hierarchy', 'Hierarchia obszarów / sterowników', 'Projekt → obszar → podobszar → sterownik', state.controllerGroups.length + state.controllers.length, '⌘'],
    ['function_groups', 'Grupy funkcyjne i punkty statusu', 'Stacje, roboty, elementy oraz szablony kontroli', state.config.function_groups.length, '⚙'],
    ['status_categories', 'Kategorie statusu', 'Kategorie i podkategorie w ustalonej kolejności', state.config.categories.length, '▤'],
    ['task_categories', 'Kategorie zadań', 'Niezależny słownik dla modułu Zadania', state.config.task_categories.length, '✓'],
    ['users', 'Użytkownicy projektu', 'Role, dostęp, Planner i przypisane obszary', state.users.length, '♙'],
    ['dictionaries', 'Słowniki projektu', 'Zmiany, typy notatek i „Oczekiwanie na”', state.config.options.length, '≡'],
    ['completion_requirements', 'Wymagania do spełnienia', 'Zapotrzebowanie wybierane w statusie, zadaniach i otwartych punktach', (state.config.requirements || []).length, '◇'],
    ['reminders', 'Przypomnienia', 'Domyślne terminy i okno ostrzegawcze', 2, '◷'],
    ...(admin ? [['backup', 'Backup projektu', 'Pobieranie i odtwarzanie kompletnego projektu', '', '⇄'], ['exports', 'Szablony eksportu', 'Predefiniowane raporty statusu do Excel', (state.config.export_templates || []).length, '↗']] : [])
  ];
  $('#content').innerHTML = `<section class="settings-home"><header><div><span class="eyebrow">Ustawienia projektu</span><h2>Wybierz obszar konfiguracji</h2><p>Każda grupa ustawień otwiera się w osobnym, trwałym oknie. Zapis nie zamyka edytowanego widoku.</p></div><span class="settings-role">${escapeHtml(roleName(state.me.role))}</span></header><div class="settings-launchers">${launchers.map(([key, title, description, count, icon]) => `<button type="button" class="settings-launcher" data-config-panel="${key}"><span class="settings-launcher-icon">${icon}</span><span><b>${escapeHtml(title)}</b><small>${escapeHtml(description)}</small></span>${count !== '' ? `<em>${count}</em>` : ''}<i>→</i></button>`).join('')}</div></section>`;
  $$('[data-config-panel]').forEach(button => button.addEventListener('click', () => openConfigPanel(button.dataset.configPanel)));
  if ($('#config-full-dialog').open && state.configPanel) refreshConfigPanel();
}

function configPanelDefinition(key) {
  const admin = ['system_admin', 'project_admin'].includes(state.me.role);
  const canEdit = ['system_admin', 'project_admin', 'moderator'].includes(state.me.role);
  const systemAdmin = state.me.role === 'system_admin';
  const dictionaries = [['waiting_for', 'Oczekiwanie na'], ['shift', 'Zmiany'], ['note_type', 'Typy notatek']].map(([kind, label]) => {
    const items = state.config.options.filter(item => item.kind === kind);
    return `<section class="config-subsection"><h3>${label}</h3>${items.map((item, index) => `<div class="settings-row">${orderControls('options', items, index)}<span>${escapeHtml(item.value)}</span><button class="mini edit-option" data-id="${item.id}" data-kind="${kind}" data-value="${escapeHtml(item.value)}">Edytuj</button>${admin ? `<button class="mini delete-config" data-kind="option" data-id="${item.id}">Usuń</button>` : ''}</div>`).join('')}<form class="inline-form add-option" data-kind="${kind}"><input name="value" placeholder="Nowa wartość" required><button class="mini">Dodaj</button></form></section>`;
  }).join('');
  const users = state.users.map((item, index) => `<div class="settings-row user-config-row">${systemAdmin ? orderControls('users', state.users, index) : ''}<span><b>${escapeHtml(item.display_name)}</b><small class="sub">${escapeHtml(item.username)} · ${item.system_role === 'system_admin' ? 'Administrator systemu' : roleName(item.project_role)} · ${item.project_active ? 'w projekcie' : 'wyłączony z projektu'} · Planner: ${item.planner_enabled ? 'tak' : 'nie'}</small><small class="sub">Obszary: ${(item.area_ids || []).map(id => state.controllerGroups.find(group => group.id === id)?.path_label).filter(Boolean).map(escapeHtml).join(', ') || 'nie przypisano'}</small></span>${admin && item.project_active ? `<button class="mini toggle-user-planner ${item.planner_enabled ? 'active-toggle' : ''}" data-id="${item.id}" data-enabled="${item.planner_enabled ? 1 : 0}">${item.planner_enabled ? 'Planner ✓' : 'Planner —'}</button>` : ''}${admin && item.project_active && item.system_role !== 'system_admin' ? `<button class="mini edit-user-areas" data-id="${item.id}">Obszary</button>` : ''}${canManageUser(item) ? `<button class="mini edit-user" data-id="${item.id}">Edytuj dostęp</button>` : ''}</div>`).join('');
  const definitions = {
    projects: ['Projekty systemu', `<section class="config-panel-body"><p class="sub">Konta są globalne, a role i dostęp są niezależne dla każdego projektu.</p>${state.projects.map(item => `<div class="settings-row"><span><b>${escapeHtml(item.code)} · ${escapeHtml(item.name)}</b><small class="sub">${escapeHtml(item.description || '')}</small></span><button class="mini edit-project" data-id="${item.id}">Edytuj</button><button class="mini danger-outline delete-project" data-id="${item.id}" ${state.projects.length <= 1 ? 'disabled title="Nie można usunąć ostatniego projektu"' : ''}>Usuń</button></div>`).join('')}<button class="secondary" id="new-project">+ Dodaj projekt</button></section>`],
    hierarchy: ['Hierarchia obszarów / sterowników', `<section class="config-panel-body"><p class="sub">Projekt → obszar → podobszar → sterownik. Wybierz element po lewej, a jego działania pojawią się po prawej.</p>${controllerHierarchyConfig(admin)}</section>`],
    function_groups: ['Grupy funkcyjne i punkty statusu', functionGroupConfig(admin)],
    status_categories: ['Kategorie statusu i otwartych punktów', `<section class="config-panel-body">${categoryConfig('status', state.config.categories, admin)}<form class="inline-form add-category" data-scope="status"><input name="name" placeholder="Nowa kategoria" required><button class="mini">Dodaj</button></form></section>`],
    task_categories: ['Kategorie zadań', `<section class="config-panel-body">${categoryConfig('task', state.config.task_categories, admin)}<form class="inline-form add-category" data-scope="task"><input name="name" placeholder="Nowa kategoria zadań" required><button class="mini">Dodaj</button></form></section>`],
    users: ['Użytkownicy projektu', `<section class="config-panel-body">${users}${systemAdmin ? '<button class="secondary" id="new-user">+ Dodaj globalne konto</button>' : ''}</section>`],
    dictionaries: ['Słowniki projektu', `<section class="config-panel-body config-dictionaries">${dictionaries}</section>`],
    completion_requirements: ['Wymagania do spełnienia', `<section class="config-panel-body"><p class="sub">Ta uporządkowana lista jest dostępna jako wielokrotny wybór w Statusie, Zadaniach i Otwartych punktach.</p>${(state.config.requirements || []).map((item, index, items) => `<div class="settings-row">${canEdit ? orderControls('completion_requirements', items, index) : ''}<span><b>${escapeHtml(item.name)}</b><small class="sub">${escapeHtml(item.description || 'Bez opisu')}</small></span>${canEdit ? `<button class="mini edit-requirement-config" data-id="${item.id}">Edytuj</button>` : ''}${admin ? `<button class="mini delete-requirement-config" data-id="${item.id}">Usuń</button>` : ''}</div>`).join('') || '<div class="empty compact-empty">Nie zdefiniowano jeszcze wymagań.</div>'}${canEdit ? '<button class="secondary" id="new-requirement-config">+ Dodaj wymaganie</button>' : ''}</section>`],
    reminders: ['Ustawienia przypomnień', `<section class="config-panel-body">${admin ? `<p class="sub">Źródło obszarów dla „Mojego podsumowania” każdy użytkownik wybiera indywidualnie w tym module.</p><label class="field"><span>Domyślne przypomnienie po utworzeniu (dni)</span><input id="default-reminder" type="number" min="1" value="${escapeHtml(state.config.settings.default_reminder_days || 14)}"></label><label class="field"><span>Okno „zbliżających się” przypomnień (dni)</span><input id="warning-days" type="number" min="1" value="${escapeHtml(state.config.settings.reminder_warning_days || 7)}"></label>` : '<p class="sub">Tylko administrator może zmieniać ustawienia projektu.</p>'}</section>`],
    backup: ['Backup projektu', `<section class="config-panel-body"><p class="sub">Plik JSON zawiera konfigurację, status, zadania, cele, otwarte punkty, dziennik, Planner, Informator, powiązania i historię zmian.</p><div class="backup-actions"><button class="secondary" id="download-backup">Pobierz backup</button><label class="secondary file-button">Wczytaj backup<input id="restore-backup" type="file" accept="application/json,.json"></label></div></section>`],
    exports: ['Szablony eksportu statusu', `<section class="config-panel-body">${(state.config.export_templates || []).map((item, index) => `<div class="settings-row">${orderControls('export_templates', state.config.export_templates, index)}<span><b>${escapeHtml(item.name)}</b><small class="sub">${escapeHtml(item.detail_level)}</small></span><button class="mini edit-export-template" data-id="${item.id}">Edytuj</button><button class="mini delete-export-template" data-id="${item.id}">Usuń</button></div>`).join('') || '<p class="sub">Brak własnych szablonów.</p>'}<button class="secondary" id="new-export-template">+ Nowy szablon</button></section>`]
  };
  return definitions[key] || ['Konfiguracja', '<div class="empty">Nie znaleziono tej grupy ustawień.</div>'];
}

function openConfigPanel(key) {
  state.configPanel = key; state.configScroll = 0;
  refreshConfigPanel();
  if (!$('#config-full-dialog').open) $('#config-full-dialog').showModal();
}

function refreshConfigPanel() {
  if (!state.configPanel) return;
  const dialog = $('#config-full-dialog'); const [title, html] = configPanelDefinition(state.configPanel);
  dialog.dataset.refreshing = '1';
  $('#config-full-title').textContent = title;
  $('#config-full-content').innerHTML = html;
  bindSettings();
  requestAnimationFrame(() => { $('#config-full-content').scrollTop = state.configScroll || 0; dialog.dataset.dirty = ''; dialog.dataset.refreshing = ''; });
}

function bindSettings() {
  $$('.move-item').forEach(button => button.addEventListener('click', () => moveConfigItem(button.dataset.kind, Number(button.dataset.id), Number(button.dataset.direction))));
  $$('.select-hierarchy-node').forEach(button => button.addEventListener('click', () => { state.hierarchySelection = button.dataset.node; state.configScroll = $('#config-full-content')?.scrollTop || 0; refreshConfigPanel(); }));
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
  $$('.add-option').forEach(form => form.addEventListener('submit', async event => { event.preventDefault(); const value = form.querySelector('input').value; await api('/api/options', { method: 'POST', body: JSON.stringify({ kind: form.dataset.kind, value }) }); await loadData(); }));
  $$('.edit-option').forEach(button => button.addEventListener('click', async () => { const result = await uiForm({ title: 'Edytuj pozycję słownika', fields: [{ name: 'value', label: 'Wartość', value: button.dataset.value, required: true }] }); if (!result?.value) return; await api(`/api/options/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ kind: button.dataset.kind, value: result.value }) }); await loadData(); }));
  $$('.delete-config').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń pozycję konfiguracji', 'Zmiana może wpłynąć na istniejące rekordy projektu.', 'Usuń', true)) return; const endpoints = { category: 'categories', subcategory: 'subcategories', task_category: 'task-categories', task_subcategory: 'task-subcategories', option: 'options' }; await api(`/api/${endpoints[button.dataset.kind]}/${button.dataset.id}`, { method: 'DELETE' }); await loadData(); }));
  $$('.edit-controller').forEach(button => button.addEventListener('click', () => openRecord('controllers', state.controllers.find(item => item.id === Number(button.dataset.id)))));
  $$('.edit-user').forEach(button => button.addEventListener('click', () => openRecord('users', state.users.find(item => item.id === Number(button.dataset.id)))));
  $$('.edit-user-areas').forEach(button => button.addEventListener('click', () => editUserAreas(Number(button.dataset.id))));
  $$('.toggle-user-planner').forEach(button => button.addEventListener('click', async () => { try { await api(`/api/users/${button.dataset.id}/planner`, { method: 'PUT', body: JSON.stringify({ planner_enabled: button.dataset.enabled === '1' ? 0 : 1 }) }); toast('Ustawienie Plannera zostało zapisane'); await loadData(); } catch (error) { toast(error.message, true); } }));
  $('#new-controller')?.addEventListener('click', () => openRecord('controllers'));
  $('#new-user')?.addEventListener('click', () => openRecord('users'));
  $('#new-project')?.addEventListener('click', () => editProject());
  $$('.edit-project').forEach(button => button.addEventListener('click', () => editProject(Number(button.dataset.id))));
  $$('.delete-project').forEach(button => button.addEventListener('click', () => deleteProjectSafely(Number(button.dataset.id))));
  $('#default-reminder')?.addEventListener('change', event => saveSetting('default_reminder_days', event.target.value));
  $('#warning-days')?.addEventListener('change', event => saveSetting('reminder_warning_days', event.target.value));
  $('#download-backup')?.addEventListener('click', downloadBackup);
  $('#restore-backup')?.addEventListener('change', restoreBackup);
  $('#new-export-template')?.addEventListener('click', () => editExportTemplate());
  $$('.edit-export-template').forEach(button => button.addEventListener('click', () => editExportTemplate(Number(button.dataset.id))));
  $$('.delete-export-template').forEach(button => button.addEventListener('click', async () => { if (!await uiConfirm('Usuń szablon eksportu', 'Szablon zostanie usunięty tylko z bieżącego projektu.', 'Usuń', true)) return; await api(`/api/export-templates/${button.dataset.id}`, { method: 'DELETE' }); await loadData(); }));
  $('#new-requirement-config')?.addEventListener('click', () => editCompletionRequirement());
  $$('.edit-requirement-config').forEach(button => button.addEventListener('click', () => editCompletionRequirement(Number(button.dataset.id))));
  $$('.delete-requirement-config').forEach(button => button.addEventListener('click', async () => {
    if (!await uiConfirm('Usuń wymaganie', 'Wymaganie zostanie odłączone od wszystkich elementów projektu.', 'Usuń', true)) return;
    try { await api(`/api/completion-requirements/${button.dataset.id}`, { method: 'DELETE' }); toast('Wymaganie usunięto'); await loadData(); } catch (error) { toast(error.message, true); }
  }));
}

async function editCompletionRequirement(id = null) {
  const existing = (state.config.requirements || []).find(item => item.id === id);
  const result = await uiForm({ title: id ? 'Edytuj wymaganie' : 'Nowe wymaganie do spełnienia', fields: [
    { name: 'name', label: 'Nazwa', value: existing?.name || '', required: true },
    { name: 'description', label: 'Krótki opis dla pracownika', type: 'textarea', value: existing?.description || '', full: true }
  ], submitLabel: id ? 'Zapisz wymaganie' : 'Dodaj wymaganie' });
  if (!result?.name) return;
  try { await api('/api/completion-requirements' + (id ? `/${id}` : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify(result) }); toast('Lista wymagań została zapisana'); await loadData(); } catch (error) { toast(error.message, true); }
}

async function saveControllerGroup(id, parentId, existingName = '') {
  const result = await uiForm({ title: id ? 'Edytuj obszar' : parentId ? 'Dodaj podobszar' : 'Dodaj obszar', description: 'Hierarchia: projekt → obszar → podobszar → sterownik.', fields: [{ name: 'name', label: 'Nazwa', value: existingName, required: true }, { name: 'description', label: 'Opis', type: 'textarea', full: true }] });
  if (!result?.name) return;
  try { await api('/api/controller-groups' + (id ? `/${id}` : ''), { method: id ? 'PATCH' : 'POST', body: JSON.stringify({ ...result, parent_id: parentId }) }); state.controller = 'all'; toast('Hierarchia została zapisana'); await loadData(); } catch (error) { toast(error.message, true); }
}

async function editProject(id = null) {
  const existing = state.projects.find(item => item.id === id);
  const result = await uiForm({ title: id ? 'Edytuj projekt' : 'Nowy projekt', fields: [{ name: 'code', label: 'Kod projektu', value: existing?.code || 'NOWY', required: true }, { name: 'name', label: 'Nazwa projektu', value: existing?.name || 'Nowy projekt', required: true }, { name: 'description', label: 'Opis', type: 'textarea', value: existing?.description || '', full: true }] });
  if (!result?.code || !result?.name) return;
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

async function editUserAreas(userId) {
  const user = state.users.find(item => item.id === userId); if (!user) return;
  const fields = state.controllerGroups.map(group => ({ name: `area_${group.id}`, label: `${'↳ '.repeat(Math.max(0, Number(group.depth || 1) - 1))}${group.path_label || group.name}`, type: 'checkbox', value: (user.area_ids || []).includes(group.id) }));
  const result = await uiForm({ title: `Obszary · ${user.display_name}`, description: 'Przypisanie steruje sugestiami w „Moim podsumowaniu”.', fields, submitLabel: 'Zapisz obszary' });
  if (!result) return;
  const area_ids = state.controllerGroups.filter(group => result[`area_${group.id}`]).map(group => group.id);
  try { await api(`/api/users/${userId}/areas`, { method: 'PUT', body: JSON.stringify({ area_ids }) }); toast('Przypisania obszarów zapisano'); await loadData(); } catch (error) { toast(error.message, true); }
}

async function downloadBackup() {
  try {
    const response = await fetch('/api/backup'); if (!response.ok) throw new Error((await response.json()).error);
    const blob = await response.blob(); const filename = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] || 'backup.json';
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } catch (error) { toast(error.message, true); }
}
async function restoreBackup(event) {
  const file = event.target.files[0]; if (!file) return;
  if (!await uiConfirm('Odtwórz backup projektu', 'Wczytanie pliku zastąpi wszystkie dane bieżącego projektu. Tej operacji nie można cofnąć bez innego backupu.', 'Odtwórz backup', true)) { event.target.value = ''; return; }
  try { const backup = JSON.parse(await file.text()); await api('/api/backup/restore', { method: 'POST', body: JSON.stringify({ backup }) }); toast('Backup został odtworzony'); await loadData(); } catch (error) { toast(error.message, true); }
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
      <label class="field"><span>Krytyczność</span><select data-point-criticality>${selectOptions(['Low', 'Medium', 'High', 'Critical'], point.criticality || 'Medium')}</select></label>
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

async function saveSetting(key, value) {
  await api(`/api/settings/${key}`, { method: 'PATCH', body: JSON.stringify({ value }) });
  toast('Ustawienie zapisane');
  await loadData();
}

const formDefinitions = {
  status: { endpoint: '/api/status', title: 'test', fields: [
    ['controller', 'Sterownik', 'controller'], ['function_group_id', 'Grupa funkcyjna', 'function-group'], ['function_group_subcategory_id', 'Podkategoria grupy funkcyjnej', 'function-subcategory'], ['function_group_element_id', 'Obiekt / element grupy', 'function-element'], ['function_detail', 'Test / funkcja (instrukcja)', 'textarea'],
    ['category', 'Kategoria', 'category', 'status'], ['subcategory', 'Podkategoria', 'subcategory', 'status'],
    ['status', 'Status', 'select', ['Not started', 'Ready to test', 'In progress', 'Blocked', 'NOK / Rework', 'Retest required', 'Done', 'N/A']],
    ['criticality', 'Krytyczność', 'select', ['Low', 'Medium', 'High', 'Critical']], ['responsible_user_ids', 'Osoby odpowiedzialne', 'users'],
    ['requirement_ids', 'Dodatkowe zapotrzebowanie', 'requirements'], ['current_note', 'Aktualna notatka', 'textarea'], ['evidence_link', 'Dodatkowe informacje / link'], ['links', 'Powiązane elementy', 'multi-links', ['task', 'point', 'note', 'goal']]
  ] },
  tasks: { endpoint: '/api/tasks', title: 'zadanie', fields: [
    ['hierarchy_target', 'Zakres w hierarchii projektu', 'hierarchy-target'], ['title', 'Tytuł', 'wide-text'], ['description', 'Opis', 'textarea'], ['info_link', 'Dodatkowe informacje / link', 'wide-text'],
    ['direct_assignee_user_ids', 'Odpowiedzialni', 'users'], ['checklist', 'Lista kontrolna', 'checklist'], ['scope_checklist', 'Kontrola sterowników w zakresie', 'scope-checklist'],
    ['function_group_id', 'Grupa funkcyjna', 'function-group'], ['function_group_element_id', 'Element grupy funkcyjnej', 'function-element'], ['other_object', 'Inne (gdy nie dotyczy grupy)'],
    ['status', 'Status', 'select', ['To do', 'In progress', 'Done']], ['priority', 'Priorytet', 'select', ['Low', 'Medium', 'High', 'Critical']],
    ['start_date', 'Planowany start', 'date'], ['due_date', 'Deadline', 'date'], ['category', 'Kategoria zadania', 'category', 'task'], ['subcategory', 'Podkategoria zadania', 'subcategory', 'task'], ['requirement_ids', 'Dodatkowe zapotrzebowanie', 'requirements'],
    ['links', 'Powiązane elementy', 'multi-links', ['status', 'point', 'note']]
  ] },
  points: { endpoint: '/api/open-points', title: 'otwarty punkt', fields: [
    ['controller', 'Sterownik', 'controller'], ['title', 'Temat'], ['owner_user_id', 'Odpowiedzialny', 'user'],
    ['status', 'Status', 'select', ['Open', 'Waiting', 'In progress', 'Closed']], ['priority', 'Priorytet', 'select', ['Low', 'Medium', 'High', 'Critical']],
    ['start_date', 'Planowany start', 'date'], ['due_date', 'Deadline', 'date'], ['reminder_date', 'Przypomnienie', 'date'],
    ['category', 'Kategoria', 'category', 'status'], ['subcategory', 'Podkategoria', 'subcategory', 'status'], ['waiting_for', 'Oczekiwanie na', 'options', 'waiting_for'], ['requirement_ids', 'Dodatkowe zapotrzebowanie', 'requirements'],
    ['links', 'Powiązane elementy', 'multi-links', ['status', 'task', 'point', 'note']], ['info_link', 'Dodatkowe informacje / link'],
    ['impact', 'Wpływ', 'textarea'], ['next_action', 'Następny krok', 'textarea'], ['description', 'Opis techniczny', 'textarea'], ['mentioned_user_ids', 'Wspomniane osoby', 'mentions']
  ] },
  notes: { endpoint: '/api/daily-notes', title: 'notatkę', fields: [
    ['controller', 'Sterownik', 'controller'], ['note_date', 'Data wpisu', 'date'], ['shift', 'Zmiana', 'options', 'shift'], ['type', 'Typ wpisu', 'options', 'note_type'],
    ['content', 'Treść', 'bigtextarea'], ['links', 'Powiązane elementy', 'multi-links', ['status', 'task', 'point']], ['mentioned_user_ids', 'Wspomniane osoby', 'mentions']
  ] },
  goals: { endpoint: '/api/goals', title: 'cel', fields: [
    ['controller', 'Sterownik', 'controller'], ['title', 'Nazwa celu'], ['status', 'Status', 'select', ['Open', 'In progress', 'Done']], ['priority', 'Priorytet', 'select', ['Low', 'Medium', 'High', 'Critical']], ['due_date', 'Termin', 'date'], ['description', 'Opis', 'textarea'], ['goal_links', 'Powiązane elementy', 'goal-links']
  ] },
  announcements: { endpoint: '/api/announcements', title: 'wiadomość', fields: [
    ['title', 'Tytuł', 'wide-text'], ['content', 'Treść', 'bigtextarea'], ['info_link', 'Link', 'wide-text'],
    ['scope_group_ids', 'Zakres projektu', 'announcement-scopes'], ['recipient_user_ids', 'Osoby, których wiadomość bezpośrednio dotyczy', 'announcement-users'],
    ['links', 'Przypięte elementy', 'multi-links', ['status', 'task', 'point', 'note', 'goal']]
  ] },
  users: { endpoint: '/api/users', title: 'użytkownika', fields: [
    ['username', 'Login'], ['display_name', 'Imię i nazwisko'], ['password', 'Hasło', 'password'], ['system_role', 'Rola systemowa', 'select', [{ value: 'user', label: 'Konto projektowe' }, { value: 'system_admin', label: 'Administrator systemu' }]], ['project_role', 'Rola w tym projekcie', 'select', [{ value: 'user', label: 'Użytkownik' }, { value: 'moderator', label: 'Manager projektu' }, { value: 'project_admin', label: 'Administrator projektu' }]], ['project_active', 'Dostęp do projektu', 'boolean'], ['planner_enabled', 'Uwzględniaj w Plannerze', 'boolean'], ['active', 'Konto globalnie aktywne', 'boolean']
  ] },
  controllers: { endpoint: '/api/controllers', title: 'sterownik', fields: [['leaf_code', 'Nazwa / kod sterownika'], ['group_id', 'Grupa w hierarchii', 'controller-group'], ['area', 'Obszar'], ['description', 'Opis', 'textarea']] }
};

async function openRecord(type, record = null, prefill = null, duplicateSource = null) {
  const definition = formDefinitions[type];
  if (!definition) return;
  const source = record || prefill || null;
  if (type === 'goals') {
    try {
      const [status, task, point] = await Promise.all([api('/api/status?controller=all'), api('/api/tasks?controller=all'), api('/api/open-points?controller=all')]);
      state.goalPickerCollections = { status, task, point };
    } catch { state.goalPickerCollections = { status: state.status, task: state.tasks, point: state.points }; }
  }
  state.dialog = { type, record, prefill, duplicateSource, auditLoaded: false };
  state.goalDraftLinks = source?.links ? source.links.map(link => ({ entity_type: link.entity_type, entity_id: Number(link.entity_id) })) : [];
  state.linkDraft = source?.links ? source.links.map(link => ({ entity_type: link.entity_type, entity_id: Number(link.entity_id) })) : [];
  $('#modal-title').textContent = `${record ? 'Edytuj' : duplicateSource ? 'Duplikuj' : 'Dodaj'} ${definition.title}`;
  $('#modal-subtitle').textContent = record ? 'Szczegóły elementu, komentarze i historia zmian.' : duplicateSource ? 'Zmień co najmniej jedno pole. Kopia 1:1 nie zostanie zapisana.' : 'Uzupełnij informacje potrzebne zespołowi. Pola oznaczone kolorem są wymagane.';
  $('#record-meta').innerHTML = record ? `<span>Utworzone przez: <b>${escapeHtml(record.created_by_name || record.author || 'dane historyczne')}</b></span><span>Data utworzenia: <b>${displayDateTime(record.created_at)}</b></span><span>Ostatnia aktualizacja: <b>${displayDateTime(record.updated_at)}</b></span>` : '<span>Autor zostanie przypisany automatycznie po zapisaniu.</span>';
  const configDelete = Boolean(record && state.me.role === 'system_admin' && ['controllers', 'users'].includes(type) && !(type === 'users' && record.id === state.me.id));
  $('#remove').hidden = !(record?.can_delete || configDelete);
  $('#duplicate').hidden = !(record && ['status', 'tasks', 'points'].includes(type));
  $('#audit-toggle').hidden = !(record && ['status', 'tasks', 'points', 'goals'].includes(type));
  $('#audit-toggle').textContent = 'Pokaż historię edycji';
  $('#audit-section').classList.add('hidden');
  $('#audit-list').innerHTML = '';
  const commentable = Boolean(record && ['status', 'tasks', 'points', 'goals'].includes(type));
  $('#comments-section').classList.toggle('hidden', !commentable);
  $('#comment-content').value = '';
  if (commentable) renderEntityComments(record.comments || []);
  $('#fields').innerHTML = definition.fields.map(field => fieldHtml(field, source, type)).join('');
  if (type === 'users' && state.me.role !== 'system_admin') {
    ['username', 'display_name', 'password', 'system_role', 'active'].forEach(name => { const input = $(`#fields [name="${name}"]`); if (input) input.disabled = true; });
    const projectRole = $('#fields [name="project_role"]');
    if (projectRole) [...projectRole.options].forEach(option => { if (option.value === 'project_admin') option.remove(); });
  }
  bindDynamicFields(type);
  $('#modal').showModal();
  $('#modal').dataset.dirty = '';
}

function typeToEntity(type) { return ({ status: 'status', tasks: 'task', points: 'point', notes: 'note', goals: 'goal' })[type]; }

function renderEntityComments(comments = []) {
  $('#comments-count').textContent = `${comments.length} ${comments.length === 1 ? 'komentarz' : 'komentarzy'}`;
  $('#comments-list').innerHTML = comments.map(item => `<article class="entity-comment"><header><b>${escapeHtml(item.user_name || 'Użytkownik')}</b><time>${displayDateTime(item.created_at)}</time></header><p>${escapeHtml(item.content).replace(/\n/g, '<br>')}</p></article>`).join('') || '<div class="empty compact-empty">Brak komentarzy. Możesz dodać pierwszą aktualizację.</div>';
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
    dialog.record.comments ||= [];
    dialog.record.comments.push(comment);
    renderEntityComments(dialog.record.comments);
    $('#comment-content').value = '';
    $('#modal').dataset.dirty = '';
    if (dialog.auditLoaded) await loadAudit(entityType, dialog.record.id);
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
    $('#audit-toggle').textContent = 'Pokaż historię edycji';
    return;
  }
  section.classList.remove('hidden');
  $('#audit-toggle').textContent = 'Ukryj historię edycji';
  if (!dialog.auditLoaded) {
    $('#audit-list').innerHTML = '<div class="loading">Ładowanie historii…</div>';
    try { await loadAudit(typeToEntity(dialog.type), dialog.record.id); dialog.auditLoaded = true; }
    catch (error) { $('#audit-list').innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
  }
}

async function openDuplicate(type, record) {
  if (!record || !['status', 'tasks', 'points'].includes(type)) return;
  const clone = structuredClone(record);
  $('#modal').close();
  await openRecord(type, null, clone, record);
}

function defaultValue(name) {
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
  if (name === 'active' || name === 'project_active' || name === 'planner_enabled') return 1;
  return '';
}

function requiredRecordField(formType, name, record) {
  const fields = {
    status: ['controller', 'function_detail', 'category', 'status'], tasks: ['hierarchy_target', 'title', 'status'],
    points: ['controller', 'title', 'status'], goals: ['controller', 'title', 'status'], announcements: ['title', 'content'],
    users: ['username', 'display_name'], controllers: ['leaf_code']
  };
  return (fields[formType] || []).includes(name) || (formType === 'users' && name === 'password' && !record?.id);
}

function fieldHtml([name, label, type = 'text', extra], record, formType = '') {
  const value = record?.[name] ?? defaultValue(name);
  const required = requiredRecordField(formType, name, record);
  if (type === 'multi-links') return multiLinksField(extra);
  if (type === 'mentions') return mentionsField(record);
  if (type === 'requirements') return requirementsField(record, name, label);
  if (type === 'checklist') return checklistField(record);
  if (type === 'scope-checklist') return scopeChecklistField(record);
  if (type === 'goal-links') return goalLinksField();
  if (type === 'announcement-scopes') {
    const selected = new Set((record?.scope_group_ids || []).map(Number));
    return `<div class="field full"><label>${escapeHtml(label)}</label><details class="multi-user-select"><summary>${selected.size ? `${selected.size} wybranych obszarów` : 'Cały projekt'}</summary><div class="mentions announcement-scope-grid">${state.controllerGroups.map(group => `<label class="mention hierarchy-option" style="--depth:${Math.max(0, Number(group.depth || 1) - 1)}"><input type="checkbox" name="scope_group_ids" value="${group.id}" ${selected.has(group.id) ? 'checked' : ''}>${escapeHtml(group.path_label || group.name)}</label>`).join('')}</div></details><small class="sub">Brak wyboru oznacza cały projekt. Nie wybieraj jednocześnie obszaru nadrzędnego i jego podobszaru.</small></div>`;
  }
  if (type === 'announcement-users') {
    const selected = new Set((record?.recipient_user_ids || []).map(Number));
    const users = state.users.filter(item => item.active && item.project_active);
    return `<div class="field full"><label>${escapeHtml(label)}</label><details class="multi-user-select"><summary>${selected.size ? `${selected.size} wskazanych osób` : 'Bez wskazania konkretnych osób'}</summary><div class="mentions assignee-grid">${users.map(user => `<label class="mention"><input type="checkbox" name="recipient_user_ids" value="${user.id}" ${selected.has(user.id) ? 'checked' : ''}>${escapeHtml(user.display_name)}</label>`).join('')}</div></details></div>`;
  }
  let input;
  if (type === 'controller') input = `<select name="${name}" id="form-controller" ${required ? 'required' : ''}>${selectOptions(state.controllers.map(item => ({ value: item.code, label: item.display_name || item.code })), value)}</select>`;
  else if (type === 'hierarchy-target') {
    const selected = record?.controller_group_id ? `group:${record.controller_group_id}` : record?.controller ? `controller:${record.controller}` : value;
    input = `<select name="${name}" id="form-hierarchy-target" ${required ? 'required' : ''}>${selectOptions(taskHierarchyOptions(), selected, 'Wybierz zakres')}</select><small class="sub">Możesz wybrać cały obszar, podobszar albo pojedynczy sterownik.</small>`;
  }
  else if (type === 'controller-group') input = `<select name="${name}">${selectOptions(hierarchyGroupOptions(), value, 'Bez grupy')}</select>`;
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
  else if (type === 'user') input = `<select name="${name}">${selectOptions(assignableUsers().map(item => ({ value: item.id, label: item.display_name })), value, 'Nieprzypisane')}</select>`;
  else if (type === 'users') {
    const selected = new Set((record?.[name] || record?.assignee_user_ids || []).map(Number));
    const users = assignableUsers(); const selectedNames = users.filter(user => selected.has(user.id)).map(user => user.display_name);
    const hint = name === 'direct_assignee_user_ids' ? 'Właściciel podzadania zostanie dodany automatycznie do odpowiedzialnych.' : 'Możesz wskazać dowolną liczbę aktywnych pracowników projektu.';
    return `<div class="field full"><label>${escapeHtml(label)}</label><details class="multi-user-select"><summary>${escapeHtml(selectedNames.length ? `${selectedNames.length} · ${selectedNames.join(', ')}` : 'Wybierz osoby odpowiedzialne')}</summary><div class="mentions assignee-grid">${users.map(user => `<label class="mention"><input type="checkbox" name="${name}" value="${user.id}" ${selected.has(user.id) ? 'checked' : ''}>${escapeHtml(user.display_name)}</label>`).join('')}</div></details><small class="sub">${escapeHtml(hint)}</small></div>`;
  }
  else if (type === 'select') input = `<select name="${name}" ${required ? 'required' : ''}>${selectOptions(extra, value)}</select>`;
  else if (type === 'category') input = `<select name="${name}" id="form-category" data-scope="${extra}" ${required ? 'required' : ''}>${selectOptions(extra === 'task' ? taskCategories() : statusCategories(), value)}</select>`;
  else if (type === 'subcategory') input = `<select name="${name}" id="form-subcategory">${selectOptions(subcategories(extra, record?.category), value)}</select>`;
  else if (type === 'options') input = `<select name="${name}">${selectOptions(options(extra), value)}</select>`;
  else if (type === 'textarea' || type === 'bigtextarea') input = `<textarea name="${name}" ${required ? 'required' : ''}>${escapeHtml(value)}</textarea>`;
  else if (type === 'wide-text') input = `<input name="${name}" type="text" value="${escapeHtml(value)}" ${required ? 'required' : ''}>`;
  else if (type === 'boolean') input = `<select name="${name}"><option value="1"${Number(value) !== 0 ? ' selected' : ''}>Tak</option><option value="0"${Number(value) === 0 ? ' selected' : ''}>Nie</option></select>`;
  else if (type === 'readonly') input = `<span class="id-lock"><input name="${name}" value="${escapeHtml(value || 'Zostanie nadane automatycznie')}" readonly></span>`;
  else input = `<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? 'required' : ''}>`;
  return `<label class="field ${required ? 'required-field' : ''} ${['textarea', 'bigtextarea', 'wide-text'].includes(type) ? `full ${type === 'bigtextarea' ? 'big' : ''}` : ''}"><span>${label}${required ? ' *' : ''}</span>${input}${type === 'readonly' ? '<small class="sub">ID jest unikalne w projekcie i nie można go edytować.</small>' : ''}</label>`;
}

function requirementsField(record, name = 'requirement_ids', label = 'Dodatkowe zapotrzebowanie') {
  const selected = new Set((record?.[name] || []).map(Number));
  const items = state.config.requirements || [];
  const selectedNames = items.filter(item => selected.has(item.id)).map(item => item.name);
  return `<div class="field full requirement-field"><label>${escapeHtml(label)}</label><details class="multi-user-select" data-empty-label="Brak dodatkowych wymagań"><summary>${selectedNames.length ? `${selectedNames.length} · ${escapeHtml(selectedNames.join(', '))}` : 'Brak dodatkowych wymagań'}</summary><div class="mentions requirement-picks">${items.map(item => `<label class="mention" title="${escapeHtml(item.description || '')}"><input type="checkbox" name="${name}" value="${item.id}" ${selected.has(item.id) ? 'checked' : ''}><span><b>${escapeHtml(item.name)}</b>${item.description ? `<small>${escapeHtml(item.description)}</small>` : ''}</span></label>`).join('') || '<span class="form-hint">Lista jest pusta. Dodaj wymagania w Konfiguracji.</span>'}</div></details><small class="sub">Możesz wybrać więcej niż jeden element z listy konfiguracyjnej.</small></div>`;
}

function multiLinksField(allowedTypes) {
  return `<div class="field full"><label>Powiązane elementy — można dodać wiele</label><div id="multi-links" class="links-editor"></div><button type="button" class="secondary" id="add-link">Wybierz z listy…</button><small class="sub">Wyszukiwanie, filtrowanie i sortowanie odbywa się w osobnym oknie. Duplikaty są blokowane.</small></div>`;
}

function mentionsField(record) {
  const selected = new Set(record?.mentioned_user_ids || []);
  return `<div class="field full"><label>Wspomniane osoby</label><div class="mentions">${state.users.filter(item => item.active && (item.project_active || item.system_role === 'system_admin')).map(user => `<label class="mention"><input type="checkbox" name="mentioned_user_ids" value="${user.id}" ${selected.has(user.id) ? 'checked' : ''}>${escapeHtml(user.display_name)}</label>`).join('')}</div></div>`;
}

function checklistField(record) {
  return `<section class="checks task-checklist-editor"><header><span><b>Lista kontrolna / podzadania</b><small>Treść może być wielowierszowa; każde podzadanie ma wagę i opcjonalnego wykonawcę.</small></span><button type="button" class="mini" id="add-check">+ Dodaj podzadanie</button></header><div id="checklist">${(record?.checklist || []).map(checklistRow).join('')}</div></section>`;
}

function checklistRow(item = {}) {
  return `<div class="check-row"><label class="check-text-field"><span>Treść podzadania</span><textarea data-check-text rows="3" placeholder="Opisz konkretny rezultat podzadania…">${escapeHtml(item.text || '')}</textarea></label><div class="check-row-meta"><label class="check-control check-done"><span>Stan</span><span class="check-toggle"><input type="checkbox" data-check-done ${item.done ? 'checked' : ''}><b>Gotowe</b></span></label><label class="check-control"><span>Waga</span><input type="number" data-check-weight min="0.1" max="1000" step="0.1" value="${escapeHtml(item.weight || 1)}"></label><label class="check-control check-owner"><span>Wykonawca</span><select data-check-owner>${selectOptions(assignableUsers().map(user => ({ value: user.id, label: user.display_name })), item.owner_user_id, 'Bez osoby')}</select></label><button type="button" class="mini delete-check" title="Usuń podzadanie">×</button></div></div>`;
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
  return scopeControllersForGroup(groupId).map(controller => `<label class="scope-check-row"><input type="checkbox" data-scope-controller="${controller.id}" ${done.get(controller.id) ? 'checked' : ''}><span><b>${escapeHtml(controller.display_name)}</b><small>${escapeHtml(controller.hierarchy_label)}</small></span></label>`).join('') || '<div class="form-hint">Ten obszar nie zawiera jeszcze sterowników końcowych.</div>';
}

function goalLinksField() {
  return `<div class="field full"><label>Powiązane elementy</label><button type="button" class="secondary" id="open-goal-picker">Wybierz status, zadania i otwarte punkty</button><div id="goal-link-preview" class="goal-links"></div></div>`;
}

function bindDynamicFields(type) {
  $$('.multi-user-select input[type="checkbox"]').forEach(input => input.addEventListener('change', event => {
    const details = event.target.closest('.multi-user-select');
    const names = [...details.querySelectorAll('input:checked')].map(item => item.closest('label').textContent.trim());
    const fieldName = event.target.name;
    const empty = details.dataset.emptyLabel || (fieldName === 'scope_group_ids' ? 'Cały projekt' : fieldName === 'recipient_user_ids' ? 'Bez wskazania konkretnych osób' : 'Wybierz osoby odpowiedzialne');
    details.querySelector('summary').textContent = names.length ? `${names.length} · ${names.join(', ')}` : empty;
  }));
  $('#form-category')?.addEventListener('change', event => { const scope = event.target.dataset.scope; $('#form-subcategory').innerHTML = selectOptions(subcategories(scope, event.target.value)); if (type === 'status') applyDefaultFunction(); });
  $('#form-subcategory')?.addEventListener('change', () => { if (type === 'status') applyDefaultFunction(); });
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
    $('#form-hierarchy-target')?.addEventListener('change', syncTaskHierarchyTarget);
    if (type === 'tasks') syncTaskHierarchyTarget(false);
    syncTaskObjectFields();
  }
  if ($('#entity-type')) fillEntitySelect();
  $('#go-entity')?.addEventListener('click', () => { const type = $('#entity-type').value; const id = Number($('#entity-id').value); $('#modal').close(); jumpTo(type, id); });
  $$('[data-toggle]').forEach(checkbox => checkbox.addEventListener('change', () => { $('#' + checkbox.dataset.toggle).disabled = !checkbox.checked; }));
  if (type === 'tasks') {
    $('#add-check').addEventListener('click', () => { $('#checklist').insertAdjacentHTML('beforeend', checklistRow()); bindChecklistDelete(); });
    bindChecklistDelete();
  }
  if (type === 'goals') {
    $('#open-goal-picker').addEventListener('click', openGoalPicker);
    renderGoalLinkPreview();
  }
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
  container.innerHTML = state.linkDraft.map((link, index) => { const item = entity(link.entity_type, link.entity_id); return item ? `<div class="link-editor-row static"><span class="type-dot ${link.entity_type}"></span><span><b>${escapeHtml(entityLabel(link.entity_type, item))}</b><small>${escapeHtml(controllerLabel(item))} · ${escapeHtml(badgeText(item.status || item.type))}</small></span><button type="button" class="mini go-link" data-index="${index}" title="Przejdź do elementu">→</button><button type="button" class="mini remove-link" data-index="${index}">×</button></div>` : ''; }).join('') || '<div class="form-hint">Brak powiązań. Wybierz status, zadanie, otwarty punkt, cel lub wpis dziennika.</div>';
  $$('#multi-links .go-link').forEach(button => button.addEventListener('click', () => { const link = state.linkDraft[Number(button.dataset.index)]; $('#modal').close(); jumpTo(link.entity_type, link.entity_id); }));
  $$('#multi-links .remove-link').forEach(button => button.addEventListener('click', () => { state.linkDraft.splice(Number(button.dataset.index), 1); renderMultiLinks(allowed); }));
}

async function openLinkPicker(allowed) {
  captureMultiLinks();
  state.linkPickerAllowed = allowed;
  state.linkPickerDraft = state.linkDraft.map(link => ({ ...link }));
  $('#link-picker-search').value = '';
  const typeLabels = { status: 'Status', task: 'Zadania', point: 'Otwarte punkty', goal: 'Cele', note: 'Dziennik' };
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
  const labels = { status: 'Status', task: 'Zadania', point: 'Otwarte punkty', goal: 'Cele', note: 'Dziennik' };
  state.selectionContext = context;
  state.selectionDraft = [];
  $('#entity-selection-search').value = '';
  $('#entity-selection-type').innerHTML = `<option value="all">Wszystkie typy</option>${context.allowed.map(type => `<option value="${type}">${labels[type]}</option>`).join('')}`;
  $('#entity-selection-title').textContent = context.mode === 'planner' ? 'Przypisz pracę pracownikowi' : 'Dodaj istniejące elementy do dnia';
  const user = context.userId ? state.users.find(item => item.id === context.userId) : null;
  $('#entity-selection-description').textContent = context.mode === 'planner'
    ? `${user?.display_name || 'Pracownik'} · ${displayDate(context.date)} · wybór przypisze osobę i planowany start.`
    : `${displayDate(context.date)} · wybrane elementy pojawią się w tym dniu bez zmiany ich terminów.`;
  $('#entity-selection-dialog').showModal();
  $('#entity-selection-content').innerHTML = '<div class="loading">Ładowanie elementów całego projektu…</div>';
  try {
    const endpoints = { status: '/api/status?controller=all', task: '/api/tasks?controller=all', point: '/api/open-points?controller=all', goal: '/api/goals?controller=all', note: '/api/daily-notes?controller=all' };
    const values = await Promise.all(context.allowed.map(type => api(endpoints[type])));
    state.selectionCollections = Object.fromEntries(context.allowed.map((type, index) => [type, values[index]]));
  } catch (error) { toast(error.message, true); state.selectionCollections = null; }
  renderEntitySelection();
}

function renderEntitySelection() {
  const context = state.selectionContext;
  if (!context) return;
  const query = ($('#entity-selection-search').value || '').toLocaleLowerCase('pl');
  const selectedType = $('#entity-selection-type').value || 'all';
  const selected = new Set(state.selectionDraft.map(item => `${item.entity_type}:${item.entity_id}`));
  let rows = context.allowed.flatMap(type => (selectionCollections()[type] || []).map(item => ({ type, item })));
  rows = rows.filter(({ type, item }) => (selectedType === 'all' || type === selectedType) && (!query || `${entityLabel(type, item)} ${controllerLabel(item)} ${item.owner_name || item.responsible_name || item.created_by_name || ''} ${item.category || ''}`.toLocaleLowerCase('pl').includes(query)));
  const typeNames = { status: 'Status', task: 'Zadanie', point: 'Otwarty punkt', goal: 'Cel', note: 'Dziennik' };
  $('#entity-selection-content').innerHTML = `<div class="link-picker-table">${pickerGroupHtml(rows.slice(0, 700), ({ type, item }) => {
    const key = `${type}:${item.id}`;
    const assigned = item.owner_name || item.responsible_name || item.created_by_name || item.author || 'Nieprzypisane';
    const date = item.due_date || item.reminder_date || item.note_date || item.checked_on || item.start_date;
    return `<label class="link-picker-row entity-select-row"><input type="checkbox" data-entity-pick="${key}" ${selected.has(key) ? 'checked' : ''}><span class="type-dot ${type}"></span><span><b>${escapeHtml(controllerLabel(item) || 'Cały projekt')} · ${escapeHtml(entityLabel(type, item))}</b><small>${escapeHtml(typeNames[type])} · ${escapeHtml(assigned)}</small></span><span>${badge(item.priority || item.criticality || item.status || item.type)}${date ? `<small>${displayDate(date)}</small>` : ''}</span></label>`;
  }) || '<div class="empty">Brak elementów odpowiadających filtrom.</div>'}</div>`;
  $$('[data-entity-pick]').forEach(input => input.addEventListener('change', () => {
    const [entityType, rawId] = input.dataset.entityPick.split(':');
    const key = `${entityType}:${rawId}`;
    state.selectionDraft = state.selectionDraft.filter(item => `${item.entity_type}:${item.entity_id}` !== key);
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
    else await api('/api/calendar/items', { method: 'POST', body: JSON.stringify({ calendar_date: context.date, items: state.selectionDraft }) });
    const count = state.selectionDraft.length;
    closeEntitySelection();
    toast(`${count} elementów zostało ${context.mode === 'planner' ? 'przypisanych' : 'dodanych do kalendarza'}`);
    await loadData();
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
  const labels = { status: 'Status', task: 'Zadanie', point: 'Otwarty punkt' };
  const source = state.goalPickerCollections || { status: state.status, task: state.tasks, point: state.points };
  container.innerHTML = state.goalDraftLinks.map(link => { const item = (source[link.entity_type] || []).find(value => value.id === Number(link.entity_id)) || entity(link.entity_type, link.entity_id); return item ? `<div class="jump"><span><b>${escapeHtml(controllerLabel(item) || 'Cały projekt')}</b> · ${escapeHtml(entityLabel(link.entity_type, item))}</span><span>${labels[link.entity_type] || link.entity_type}</span></div>` : ''; }).join('') || '<span class="sub">Nie wybrano elementów.</span>';
}

async function loadAudit(type, id) {
  const entries = await api(`/api/audit?type=${encodeURIComponent(type)}&id=${id}`);
  $('#audit-section').classList.remove('hidden');
  $('#audit-list').innerHTML = entries.map(entry => `<article class="audit-entry"><strong>${escapeHtml(entry.user_name || 'System')} · ${displayDateTime(entry.changed_at)} · ${auditAction(entry.action)}</strong>${Object.entries(entry.changes).map(([field, change]) => auditChangeHtml(field, change)).join('') || '<span>Brak szczegółowych różnic</span>'}</article>`).join('') || '<div class="empty">Historia jest pusta</div>';
}

function auditAction(action) { return ({ create: 'utworzenie', update: 'edycja', delete: 'usunięcie', migrate: 'migracja do V3' })[action] || action; }
function fieldLabel(field) { return ({
  created: 'Utworzenie elementu', migrated: 'Migracja danych', controller_id: 'Sterownik', controller_group_id: 'Zakres hierarchii',
  title: 'Tytuł', description: 'Opis', status: 'Status', priority: 'Priorytet', category: 'Kategoria', subcategory: 'Podkategoria',
  station: 'Stacja / obiekt', function_detail: 'Test / funkcja', function_group_id: 'Grupa funkcyjna', function_group_element_id: 'Element grupy', function_group_subcategory_id: 'Podkategoria grupy funkcyjnej',
  other_object: 'Inny obiekt', owner: 'Odpowiedzialny (opis)', owner_user_id: 'Odpowiedzialny', responsible: 'Odpowiedzialny (opis)', responsible_user_id: 'Odpowiedzialny', responsible_user_ids: 'Osoby odpowiedzialne', direct_assignee_user_ids: 'Odpowiedzialni', mentioned_user_ids: 'Wspomniane osoby',
  due_date: 'Deadline', reminder_date: 'Przypomnienie', start_date: 'Planowany start', note_date: 'Data wpisu', checked_on: 'Data sprawdzenia', checked_by: 'Sprawdził',
  current_note: 'Aktualna notatka', environment: 'Środowisko', criticality: 'Krytyczność', evidence_link: 'Dowód / link', info_link: 'Dodatkowe informacje / link',
  impact: 'Wpływ', waiting_for: 'Oczekiwanie na', next_action: 'Następny krok', shift: 'Zmiana', type: 'Typ wpisu', content: 'Treść', author: 'Autor', comment: 'Dodany komentarz',
  linked_entity_id: 'Powiązany element', linked_entity_type: 'Typ powiązania', checklist: 'Lista kontrolna / podzadania', scope_checklist: 'Kontrola sterowników w zakresie', links: 'Powiązania', requirement_ids: 'Dodatkowe zapotrzebowanie'
})[field] || field.replaceAll('_', ' '); }

function auditUserName(id) { return state.users.find(user => user.id === Number(id))?.display_name || 'Nieprzypisane'; }
function auditControllerName(id) { return state.controllers.find(item => item.id === Number(id))?.display_name || 'Bez sterownika'; }
function auditLinkName(link) { const item = entity(link?.entity_type, link?.entity_id); return `${({ status: 'Status', task: 'Zadanie', point: 'Otwarty punkt', note: 'Dziennik', goal: 'Cel' })[link?.entity_type] || 'Element'}${item ? ` · ${entityLabel(link.entity_type, item)}` : ''}`; }
function formatAuditValue(field, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (['owner_user_id', 'responsible_user_id', 'created_by'].includes(field)) return auditUserName(value);
  if (['responsible_user_ids', 'direct_assignee_user_ids'].includes(field)) return (value || []).map(auditUserName).join(', ') || '—';
  if (field === 'controller_id') return auditControllerName(value);
  if (field === 'controller_group_id') return state.controllerGroups.find(item => item.id === Number(value))?.path_label || 'Cały projekt';
  if (field === 'function_group_id') return state.config.function_groups.find(item => item.id === Number(value))?.name || 'Bez grupy';
  if (field === 'function_group_element_id') return state.config.function_groups.flatMap(item => item.elements || []).find(item => item.id === Number(value))?.name || 'Bez elementu';
  if (field === 'function_group_subcategory_id') return state.config.function_groups.flatMap(item => item.subcategories || []).find(item => item.id === Number(value))?.name || 'Bez podkategorii';
  if (field === 'links') return (value || []).map(auditLinkName).join(', ') || '—';
  if (field === 'requirement_ids') return (value || []).map(id => (state.config.requirements || []).find(item => item.id === Number(id))?.name || `Usunięte wymaganie`).join(', ') || '—';
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

function auditChangeHtml(field, change) {
  if (['id', 'project_id', 'test_id', 'issue_id', 'linked_test_id', 'created_at'].includes(field)) return '';
  if (['checklist', 'scope_checklist'].includes(field)) return checklistAuditHtml(field, change);
  if (field === 'created') return '<div class="audit-change"><span>Utworzenie elementu</span><span><b>Element został dodany</b></span></div>';
  if (field === 'migrated') return '<div class="audit-change"><span>Migracja danych</span><span><b>Element został przeniesiony do aktualnej wersji</b></span></div>';
  return `<div class="audit-change"><span>${escapeHtml(fieldLabel(field))}</span><span>${escapeHtml(formatAuditValue(field, change.from))} → <b>${escapeHtml(formatAuditValue(field, change.to))}</b></span></div>`;
}

async function saveRecord(event) {
  event.preventDefault();
  const { type, record, prefill, duplicateSource } = state.dialog;
  const definition = formDefinitions[type];
  const formData = new FormData(event.currentTarget);
  const input = Object.fromEntries(formData);
  input.mentioned_user_ids = formData.getAll('mentioned_user_ids').map(Number);
  input.direct_assignee_user_ids = formData.getAll('direct_assignee_user_ids').map(Number);
  input.responsible_user_ids = formData.getAll('responsible_user_ids').map(Number);
  input.requirement_ids = formData.getAll('requirement_ids').map(Number);
  input.scope_group_ids = formData.getAll('scope_group_ids').map(Number);
  input.recipient_user_ids = formData.getAll('recipient_user_ids').map(Number);
  if (duplicateSource?.id) input.duplicate_source_id = duplicateSource.id;
  if (formDefinitions[type].fields.some(field => field[2] === 'multi-links')) { captureMultiLinks(); input.links = state.linkDraft; }
  if (type === 'tasks') {
    input.checklist = $$('#checklist .check-row').map(row => ({ text: row.querySelector('[data-check-text]').value, done: row.querySelector('[data-check-done]').checked, weight: Number(row.querySelector('[data-check-weight]').value) || 1, owner_user_id: Number(row.querySelector('[data-check-owner]').value) || null })).filter(item => item.text.trim());
    input.scope_checklist = $$('#scope-checklist [data-scope-controller]').map(item => ({ controller_id: Number(item.dataset.scopeController), done: item.checked }));
  }
  if (type === 'goals') input.links = state.goalDraftLinks;
  if (type === 'notes') $$('[data-toggle]').forEach(toggle => { if (!toggle.checked) input[toggle.dataset.toggle] = null; });
  try {
    const saved = await api(definition.endpoint + (record ? `/${record.id}` : ''), { method: record ? 'PATCH' : 'POST', body: JSON.stringify(input) });
    if (!record && prefill?._calendar_date && saved?.id) await api('/api/calendar/items', { method: 'POST', body: JSON.stringify({ calendar_date: prefill._calendar_date, items: [{ entity_type: typeToEntity(type), entity_id: saved.id }] }) });
    $('#modal').close();
    if (type === 'controllers') state.controller = 'all';
    toast('Zapisano zmiany');
    await loadData();
  } catch (error) { toast(error.message, true); }
}

async function deleteRecord() {
  const { type, record } = state.dialog;
  if (!await uiConfirm('Usuń rekord', 'Operacja zostanie zapisana w historii zmian.', 'Usuń rekord', true)) return;
  try {
    await api(`${formDefinitions[type].endpoint}/${record.id}`, { method: 'DELETE' });
    $('#modal').close();
    toast('Usunięto rekord');
    await loadData();
  } catch (error) { toast(error.message, true); }
}

function jumpTo(type, id) {
  const view = type === 'task' || type === 'tasks' ? 'tasks' : type === 'point' || type === 'points' ? 'points' : type === 'note' || type === 'notes' ? 'notes' : type === 'goal' || type === 'goals' ? 'goals' : 'status';
  setView(view);
  const item = entity(type, id);
  if (item) openRecord(view, item);
}

function bindJumpItems() {
  $$('[data-jump]').forEach(item => item.addEventListener('click', () => jumpTo(item.dataset.jump, Number(item.dataset.id))));
  $$('.jump[data-type]').forEach(item => item.addEventListener('click', event => { event.stopPropagation(); jumpTo(item.dataset.type, Number(item.dataset.id)); }));
}

let toastTimer;
function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.className = 'toast'; }, 3200);
}

initialize();
