const state = {
  view: 'overview', controller: 'all', me: null, controllers: [], users: [],
  config: { categories: [], task_categories: [], function_groups: [], options: [], settings: {} },
  overview: null, mine: null, dashboard: {}, status: [], tasks: [], points: [], notes: [], goals: [],
  dialog: null, goalDraftLinks: [], taskMode: 'board', pointMode: 'list',
  functionGroupController: '', functionPointGroup: null, functionPointDraft: [], quickStatusDraft: [],
  notesFrom: '', notesTo: '', notesWeek: '', draggingTask: false,
  grouping: { status: 'category', tasks: '', notes: 'controller' },
  sort: { status: { key: '', direction: 1 }, tasks: { key: '', direction: 1 }, points: { key: '', direction: 1 } }
};

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
const today = () => new Date().toISOString().slice(0, 10);
const twoWeeksAgo = () => { const value = new Date(); value.setDate(value.getDate() - 13); return value.toISOString().slice(0, 10); };
const displayDate = value => value ? new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value)) : '—';
const displayDateTime = value => value ? new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value.replace(' ', 'T') + (value.includes('Z') ? '' : 'Z'))) : '—';

const pageCopy = {
  overview: ['Overview', 'Liczbowy obraz gotowości całego projektu', ''],
  mine: ['Moje podsumowanie', 'Twoje zadania, odpowiedzialności, wzmianki i aktywność', ''],
  status: ['Status', 'Testy uruchomieniowe według kolejności projektu', '+ Dodaj test'],
  tasks: ['Zadania', 'Plan pracy zespołu, checklisty i odpowiedzialności', '+ Nowe zadanie'],
  goals: ['Cele', 'Kamienie milowe łączące status, zadania i otwarte punkty', '+ Nowy cel'],
  points: ['Otwarte punkty', 'Problemy, oczekiwania i przypomnienia', '+ Nowy punkt'],
  notes: ['Dzienne notatki', 'Historia zmianowa i powiązania z pracą zespołu', '+ Dodaj notatkę'],
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

function roleName(role) { return ({ admin: 'Administrator', moderator: 'Moderator', user: 'Użytkownik' })[role] || role; }
function options(kind) { return state.config.options.filter(item => item.kind === kind).map(item => item.value); }
function statusCategories() { return state.config.categories.map(item => item.name); }
function taskCategories() { return state.config.task_categories.map(item => item.name); }
function functionGroups(controllerCode) { return (state.config.function_groups || []).filter(item => !controllerCode || item.controller === controllerCode); }
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
  const created = (task.created_at || today()).slice(0, 10);
  const duration = Math.max(0, -dayDifference(created));
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
    const source = key === '_all' ? JSON.stringify(row) : key === 'station' ? [row.station, row.function_detail, row.test_id].join(' ') : key === 'title' ? [row.title, row.description, row.issue_id].join(' ') : row[key];
    return String(source ?? '').toLowerCase().includes(value);
  }));
}

async function initialize() {
  try {
    state.me = await api('/api/me');
    $('#me').textContent = `${state.me.display_name} · ${roleName(state.me.role)}`;
    $('#settings-nav').hidden = state.me.role === 'user';
    bindShell();
    await loadData();
  } catch (error) { toast(error.message, true); }
}

function bindShell() {
  $$('#nav button').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  $('#controller').addEventListener('change', async event => { state.controller = event.target.value; await loadData(); });
  $('#add').addEventListener('click', () => openRecord(state.view));
  $('#close').addEventListener('click', () => $('#modal').close());
  $('#cancel').addEventListener('click', () => $('#modal').close());
  $('#form').addEventListener('submit', saveRecord);
  $('#remove').addEventListener('click', deleteRecord);
  $('#logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); location.href = '/login.html'; });
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
}

async function loadData() {
  $('#content').innerHTML = '<div class="loading">Ładowanie danych…</div>';
  const query = `?controller=${encodeURIComponent(state.controller)}`;
  state.notesFrom ||= twoWeeksAgo();
  state.notesTo ||= today();
  const notesQuery = `${query}&from=${state.notesFrom}&to=${state.notesTo}`;
  [state.controllers, state.users, state.config, state.overview, state.mine, state.dashboard, state.status, state.tasks, state.points, state.notes, state.goals] = await Promise.all([
    api('/api/controllers'), api('/api/users'), api('/api/config'), api('/api/overview'), api('/api/my-summary'),
    api('/api/dashboard' + query), api('/api/status' + query), api('/api/tasks' + query), api('/api/open-points' + query),
    api('/api/daily-notes' + notesQuery), api('/api/goals' + query)
  ]);
  if (!state.controllers.some(item => item.code === state.functionGroupController)) {
    state.functionGroupController = state.controller !== 'all' && state.controllers.some(item => item.code === state.controller)
      ? state.controller : state.controllers[0]?.code || '';
  }
  const current = state.controller;
  $('#controller').innerHTML = '<option value="all">Wszystkie sterowniki</option>' + state.controllers.map(item => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.code)}</option>`).join('');
  $('#controller').value = current;
  updateCounts();
  render();
}

function updateCounts() {
  $('#n-status').textContent = state.status.length;
  $('#n-tasks').textContent = state.tasks.filter(item => item.status !== 'Done').length;
  $('#n-goals').textContent = state.goals.filter(item => item.status !== 'Done').length;
  $('#n-points').textContent = state.points.filter(item => item.status !== 'Closed').length;
  $('#n-notes').textContent = state.notes.length;
}

function setView(view) {
  if (view === 'settings' && state.me.role === 'user') return;
  state.view = view;
  $$('#nav button').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  render();
}

function render() {
  const copy = pageCopy[state.view];
  $('#title').textContent = copy[0];
  $('#desc').textContent = copy[1];
  $('#add').textContent = copy[2];
  $('#add').hidden = !copy[2];
  ({ overview: renderOverview, mine: renderMine, status: renderStatus, tasks: renderTasks, goals: renderGoals, points: renderPoints, notes: renderNotes, settings: renderSettings })[state.view]();
}

function metricCard(title, metric, completeKey, details) {
  return `<article class="metric-card"><header><span>${title}</span><span>${metric.progress}%</span></header><strong>${metric[completeKey] || 0} / ${metric.total || 0}</strong><div class="progress"><i style="width:${metric.progress}%"></i></div><div class="metric-row">${details.map(([key, label]) => `<div><b>${metric[key] || 0}</b><small>${label}</small></div>`).join('')}</div></article>`;
}

function renderOverview() {
  const data = state.overview;
  $('#content').innerHTML = `<div class="metrics">
    ${metricCard('Status uruchomienia', data.overall.status, 'done', [['in_progress', 'w trakcie'], ['blocked', 'blokady / NOK'], ['total', 'zakres']])}
    ${metricCard('Zadania zespołu', data.overall.tasks, 'done', [['todo', 'do zrobienia'], ['in_progress', 'w trakcie'], ['overdue', 'po terminie']])}
    ${metricCard('Otwarte punkty', data.overall.points, 'closed', [['open', 'otwarte'], ['waiting', 'oczekujące'], ['reminders_overdue', 'po przypomnieniu']])}
  </div><section class="controller-overview">${data.controllers.map(item => {
    const m = item.metrics;
    return `<article class="controller-row"><div class="controller-name"><strong>${escapeHtml(item.code)}</strong><span>${escapeHtml(item.area)} · ${escapeHtml(item.description)}</span></div>
      <div class="controller-kpi"><strong>${m.status.progress}%</strong><span>Status</span><small>${m.status.done}/${m.status.total} gotowe · ${m.status.blocked} blokad</small></div>
      <div class="controller-kpi"><strong>${m.tasks.progress}%</strong><span>Zadania</span><small>${m.tasks.done}/${m.tasks.total} ukończone · ${m.tasks.overdue} po terminie</small></div>
      <div class="controller-kpi"><strong>${m.points.progress}%</strong><span>Otwarte punkty</span><small>${m.points.closed}/${m.points.total} zamknięte · ${m.points.reminders_overdue} alarmów</small></div></article>`;
  }).join('')}</section>`;
}

function summarySection(title, items, type, label) {
  return `<section class="list-section"><header><strong>${title}</strong><span class="badge blue">${items.length}</span></header><div class="compact-list">${items.length ? items.slice(0, 15).map(item => `<div class="compact-item" data-jump="${type}" data-id="${item.id}"><span><strong>${escapeHtml(label(item))}</strong><small>${escapeHtml(item.controller || 'Ogólne')} · ${badgeText(item.status || item.type)}</small></span><span>${item.due_date ? displayDate(item.due_date) : ''}</span></div>`).join('') : '<div class="empty">Brak pozycji</div>'}</div></section>`;
}

function badgeText(value) { return (badgeMap[value] || [value || '—'])[0]; }

function renderMine() {
  const data = state.mine;
  const taskProgress = data.metrics.tasks_total ? Math.round(data.metrics.tasks_done * 100 / data.metrics.tasks_total) : 0;
  const pointProgress = data.metrics.points_total ? Math.round(data.metrics.points_closed * 100 / data.metrics.points_total) : 0;
  const statusProgress = data.metrics.status_total ? Math.round(data.metrics.status_done * 100 / data.metrics.status_total) : 0;
  $('#content').innerHTML = `<div class="metrics">
    <article class="metric-card"><header><span>Moje zadania</span><span>${taskProgress}%</span></header><strong>${data.metrics.tasks_done}/${data.metrics.tasks_total}</strong><div class="progress"><i style="width:${taskProgress}%"></i></div><span class="sub">przypisane, utworzone lub ze wzmianką</span></article>
    <article class="metric-card"><header><span>Moje otwarte punkty</span><span>${pointProgress}% zamkniętych</span></header><strong>${data.metrics.points_closed}/${data.metrics.points_total}</strong><div class="progress"><i style="width:${pointProgress}%"></i></div></article>
    <article class="metric-card"><header><span>Dziennik</span><span>${data.metrics.notes_total} wpisów</span></header><strong>${data.metrics.notes_created}</strong><span class="sub">utworzonych przeze mnie · ${data.metrics.notes_mentions} wzmianek</span></article>
    <article class="metric-card"><header><span>Status i aktywność</span><span>${statusProgress}%</span></header><strong>${data.metrics.status_done}/${data.metrics.status_total}</strong><div class="progress"><i style="width:${statusProgress}%"></i></div><span class="sub">${data.metrics.status_updates} aktualizacji statusu</span></article>
  </div><div class="summary-grid">
    ${summarySection('Zadania przypisane do mnie', data.assigned_tasks.filter(item => item.status !== 'Done'), 'tasks', item => item.title)}
    ${summarySection('Utworzone przeze mnie lub ze wzmianką', data.related_tasks.filter(item => item.owner_user_id !== state.me.id), 'tasks', item => item.title)}
    ${summarySection('Zadania ogólne bez właściciela', data.general_tasks, 'tasks', item => item.title)}
    ${summarySection('Otwarte punkty: odpowiedzialność / wzmianki', data.points.filter(item => item.status !== 'Closed'), 'points', item => `${item.issue_id} · ${item.title}`)}
    ${summarySection('Moje wpisy i wzmianki w dzienniku', data.notes, 'notes', item => item.content.slice(0, 90))}
    ${summarySection('Punkty statusu przypisane do mnie', data.statuses, 'status', item => `${item.test_id} · ${item.function_detail}`)}
    <section class="list-section"><header><strong>Ostatnie aktualizacje statusu</strong><span class="badge blue">${data.status_updates.length}</span></header><div class="compact-list">${data.status_updates.slice(0, 15).map(item => `<div class="compact-item"><span><strong>${displayDateTime(item.changed_at)}</strong><small>Aktualizacja statusu #${item.entity_id}</small></span></div>`).join('') || '<div class="empty">Brak aktualizacji</div>'}</div></section>
  </div>`;
  bindJumpItems();
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
    { key: 'station', label: 'Stacja / test' }, { key: 'controller', label: 'PLC' },
    { key: 'category', label: 'Kategoria', values: statusCategories() }, { key: 'subcategory', label: 'Podkategoria' },
    { key: 'status', label: 'Status', values: ['Not started', 'Ready to test', 'In progress', 'Blocked', 'NOK / Rework', 'Retest required', 'Done', 'N/A'] },
    { key: 'criticality', label: 'Krytyczność', values: ['Low', 'Medium', 'High', 'Critical'] },
    { key: 'responsible_name', label: 'Odpowiedzialny' }, { key: 'updated_at', label: 'Aktualizacja' }
  ];
  $('#content').innerHTML = `<div class="metrics">
    <article class="metric-card"><header><span>Postęp</span><span>${d.progress || 0}%</span></header><strong>${d.done || 0}/${d.total || 0}</strong><div class="progress"><i style="width:${d.progress || 0}%"></i></div></article>
    <article class="metric-card"><header><span>W trakcie</span></header><strong>${d.in_progress || 0}</strong></article>
    <article class="metric-card"><header><span>Zablokowane / NOK</span></header><strong>${d.blocked || 0}</strong></article>
  </div><div class="panel" id="status-panel"><div class="toolbar"><strong>Lista statusowa</strong><button id="quick-status-edit" class="secondary">Szybka edycja</button><label>Grupuj <select id="status-group"><option value="function_group_name">Grupa funkcyjna</option><option value="category">Kategoria</option><option value="subcategory">Podkategoria</option><option value="status">Status</option><option value="">Bez grupowania</option></select></label></div>
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
    if (grouping) html += `<tr class="group-row"><td colspan="8">${escapeHtml(group)} <small>${items.length} pozycji</small></td></tr>`;
    html += items.map(item => `<tr data-id="${item.id}"><td class="maincell">${escapeHtml(item.station)} · ${escapeHtml(item.function_detail)}<span class="sub">${escapeHtml(item.test_id)} · ${escapeHtml(item.current_note)}</span></td><td>${escapeHtml(item.controller)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(item.subcategory || '—')}</td><td>${badge(item.status)}</td><td>${badge(item.criticality)}</td><td>${escapeHtml(item.responsible_name || '—')}</td><td>${displayDate((item.updated_at || '').slice(0, 10))}</td></tr>`).join('');
  }
  $('#status-body').innerHTML = html || '<tr><td colspan="8" class="empty">Brak wyników</td></tr>';
  $$('#status-body tr[data-id]').forEach(row => row.addEventListener('click', () => openRecord('status', state.status.find(item => item.id === Number(row.dataset.id)))));
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
      item[field] = ['function_group_id', 'responsible_user_id'].includes(field) ? (Number(input.value) || null) : input.value;
    });
  });
}

function renderQuickStatusRows() {
  const query = ($('#quick-status-search').value || '').toLowerCase();
  const rows = state.quickStatusDraft.filter(item => !query || [item.test_id, item.station, item.function_detail, item.category, item.subcategory, item.current_note]
    .join(' ').toLowerCase().includes(query));
  $('#quick-status-count').textContent = `${rows.length} z ${state.quickStatusDraft.length} punktów`;
  $('#quick-status-body').innerHTML = rows.map(item => `<tr data-id="${item.id}">
    <td><b>${escapeHtml(item.test_id)}</b><small class="sub">${escapeHtml(item.controller)}</small></td>
    <td><select data-field="controller" class="quick-controller">${selectOptions(state.controllers.map(controller => controller.code), item.controller)}</select></td>
    <td><select data-field="function_group_id">${selectOptions(functionGroups(item.controller).map(group => ({ value: group.id, label: group.name })), item.function_group_id, 'Bez grupy funkcyjnej')}</select></td>
    <td><input data-field="function_detail" value="${escapeHtml(item.function_detail)}"></td>
    <td><select data-field="category" class="quick-category">${selectOptions(statusCategories(), item.category)}</select></td>
    <td><select data-field="subcategory" class="quick-subcategory">${selectOptions(subcategories('status', item.category), item.subcategory, 'Bez podkategorii')}</select></td>
    <td><select data-field="criticality">${selectOptions(['Low', 'Medium', 'High', 'Critical'], item.criticality)}</select></td>
    <td><select data-field="status">${selectOptions(['Not started', 'Ready to test', 'In progress', 'Blocked', 'NOK / Rework', 'Retest required', 'Done', 'N/A'], item.status)}</select></td>
    <td><select data-field="responsible_user_id">${selectOptions(state.users.filter(user => user.active).map(user => ({ value: user.id, label: user.display_name })), item.responsible_user_id, 'Nieprzypisane')}</select></td>
    <td><textarea data-field="current_note" rows="2">${escapeHtml(item.current_note)}</textarea></td>
  </tr>`).join('') || '<tr><td colspan="10" class="empty">Brak wyników</td></tr>';
  $$('#quick-status-body .quick-controller').forEach(select => select.addEventListener('change', () => {
    captureQuickStatusRows();
    const row = select.closest('tr');
    const item = state.quickStatusDraft.find(entry => entry.id === Number(row.dataset.id));
    item.function_group_id = null;
    row.querySelector('[data-field="function_group_id"]').innerHTML = selectOptions(functionGroups(select.value).map(group => ({ value: group.id, label: group.name })), '', 'Bez grupy funkcyjnej');
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

function taskCard(item) {
  const completed = item.checklist.filter(entry => entry.done).length;
  const total = item.checklist.length;
  const time = taskTimeLabel(item);
  return `<article class="task-card" draggable="true" data-task-id="${item.id}"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.controller)} · ${escapeHtml(item.category || 'Bez kategorii')} / ${escapeHtml(item.subcategory || '—')}</p><div class="cardmeta"><span>${escapeHtml(item.owner_name || 'Nieprzypisane')}</span><span>${item.due_date ? displayDate(item.due_date) : 'bez deadline’u'}</span></div><span class="time-chip ${time.overdue ? 'overdue' : ''}">${escapeHtml(time.label)}</span>${total ? `<div class="checkbar"><i style="width:${completed * 100 / total}%"></i></div><p>${completed}/${total} podzadań</p>` : ''}<span class="sub">Utworzył: ${escapeHtml(item.created_by_name || 'dane historyczne')} · ${displayDate((item.created_at || '').slice(0, 10))}</span></article>`;
}

function renderTasks() {
  $('#content').innerHTML = `<div class="panel"><div class="toolbar"><strong>Zadania</strong><button id="task-board-mode" class="secondary ${state.taskMode === 'board' ? 'active-toggle' : ''}">Tablica</button><button id="task-list-mode" class="secondary ${state.taskMode === 'list' ? 'active-toggle' : ''}">Lista</button><input id="task-search" placeholder="Szukaj we wszystkich polach"><select id="task-category">${selectOptions(taskCategories(), '', 'Wszystkie kategorie')}</select></div></div><div id="task-content"></div>`;
  $('#task-board-mode').addEventListener('click', () => { state.taskMode = 'board'; renderTasks(); });
  $('#task-list-mode').addEventListener('click', () => { state.taskMode = 'list'; renderTasks(); });
  $('#task-search').addEventListener('input', drawTasks);
  $('#task-category').addEventListener('change', drawTasks);
  drawTasks();
}

function filteredTasks() {
  const query = ($('#task-search')?.value || '').toLowerCase();
  const category = $('#task-category')?.value || '';
  return state.tasks.filter(item => (!query || JSON.stringify(item).toLowerCase().includes(query)) && (!category || item.category === category));
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
    card.addEventListener('click', () => { if (!state.draggingTask) openRecord('tasks', state.tasks.find(item => item.id === Number(card.dataset.taskId))); });
    card.addEventListener('dragstart', event => { state.draggingTask = true; card.classList.add('dragging'); event.dataTransfer.setData('text/task-id', card.dataset.taskId); });
    card.addEventListener('dragend', () => { card.classList.remove('dragging'); setTimeout(() => { state.draggingTask = false; }, 0); });
  });
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
    { key: 'title', label: 'Zadanie' }, { key: 'controller', label: 'PLC' }, { key: 'category', label: 'Kategoria', values: taskCategories() },
    { key: 'subcategory', label: 'Podkategoria' }, { key: 'status', label: 'Status', values: ['To do', 'In progress', 'Done'] },
    { key: 'owner_name', label: 'Odpowiedzialny' }, { key: 'start_date', label: 'Start' }, { key: 'due_date', label: 'Deadline' }, { key: 'priority', label: 'Priorytet' }
  ];
  $('#task-content').innerHTML = `<div class="panel" id="task-list-panel"><div class="toolbar"><strong>Widok listy</strong><label>Grupuj <select id="task-group"><option value="">Bez grupowania</option><option value="category">Kategoria</option><option value="subcategory">Podkategoria</option><option value="status">Status</option><option value="owner_name">Odpowiedzialny</option><option value="controller">Sterownik</option></select></label></div><div class="tablewrap"><table><thead><tr>${columns.map(column => `<th class="sortable" data-sort="${column.key}" data-label="${column.label}">${column.label}${sortMarker('tasks', column.key)}</th>`).join('')}</tr>${tableFilterRow(columns)}</thead><tbody id="task-list-body"></tbody></table></div></div>`;
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
    if (grouping) html += `<tr class="group-row"><td colspan="9">${escapeHtml(group)} <small>${items.length} pozycji</small></td></tr>`;
    html += items.map(item => { const time = taskTimeLabel(item); return `<tr data-id="${item.id}"><td class="maincell">${escapeHtml(item.title)}<span class="sub">${escapeHtml(item.description)}</span><span class="time-chip ${time.overdue ? 'overdue' : ''}">${escapeHtml(time.label)}</span></td><td>${escapeHtml(item.controller)}</td><td>${escapeHtml(item.category || '—')}</td><td>${escapeHtml(item.subcategory || '—')}</td><td>${badge(item.status)}</td><td>${escapeHtml(item.owner_name || '—')}</td><td>${displayDate(item.start_date)}</td><td>${displayDate(item.due_date)}</td><td>${badge(item.priority)}</td></tr>`; }).join('');
  }
  $('#task-list-body').innerHTML = html || '<tr><td colspan="9" class="empty">Brak wyników</td></tr>';
  $$('#task-list-body tr[data-id]').forEach(row => row.addEventListener('click', () => openRecord('tasks', state.tasks.find(item => item.id === Number(row.dataset.id)))));
}

function entity(type, id) {
  const collection = type === 'status' ? state.status : type === 'task' || type === 'tasks' ? state.tasks : type === 'point' || type === 'points' ? state.points : type === 'note' || type === 'notes' ? state.notes : [];
  return collection.find(item => item.id === Number(id));
}

function entityLabel(type, item) {
  if (!item) return 'Nie znaleziono elementu';
  if (type === 'status') return `${item.test_id} · ${item.function_detail}`;
  if (type === 'task' || type === 'tasks') return item.title;
  if (type === 'point' || type === 'points') return `${item.issue_id} · ${item.title}`;
  return `${displayDate(item.note_date)} · ${item.content.slice(0, 80)}`;
}

function renderGoals() {
  $('#content').innerHTML = `<div class="goalgrid">${state.goals.map(goal => {
    const links = goal.links || [];
    const done = links.filter(link => ['Done', 'Closed'].includes(entity(link.entity_type, link.entity_id)?.status)).length;
    const progress = links.length ? Math.round(done * 100 / links.length) : 0;
    return `<article class="goal"><div class="cardmeta"><span>${escapeHtml(goal.controller || 'Wszystkie PLC')}</span>${badge(goal.status)}</div><h3>${escapeHtml(goal.title)}</h3><p>${escapeHtml(goal.description)}</p><div class="progress"><i style="width:${progress}%"></i></div><p>${done}/${links.length} powiązanych elementów ukończonych · termin ${displayDate(goal.due_date)}</p><div class="goal-links">${links.map(link => { const item = entity(link.entity_type, link.entity_id); return item ? `<button class="jump" data-type="${link.entity_type}" data-id="${item.id}"><span>${escapeHtml(entityLabel(link.entity_type, item))}</span><span>→</span></button>` : `<div class="sub">Brak elementu ${link.entity_type} #${link.entity_id}</div>`; }).join('') || '<span class="sub">Nie wybrano jeszcze elementów</span>'}</div><button class="secondary edit-goal" data-id="${goal.id}">Edytuj cel</button></article>`;
  }).join('') || '<div class="empty">Nie zdefiniowano celów.</div>'}</div>`;
  $$('.edit-goal').forEach(button => button.addEventListener('click', () => openRecord('goals', state.goals.find(item => item.id === Number(button.dataset.id)))));
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
    { key: 'title', label: 'ID / temat' }, { key: 'controller', label: 'PLC' }, { key: 'category', label: 'Kategoria', values: statusCategories() },
    { key: 'subcategory', label: 'Podkategoria' }, { key: 'status', label: 'Status', values: ['Open', 'Waiting', 'In progress', 'Closed'] },
    { key: 'waiting_for', label: 'Oczekiwanie na', values: options('waiting_for') }, { key: 'owner_name', label: 'Odpowiedzialny' },
    { key: 'due_date', label: 'Deadline' }, { key: 'reminder_date', label: 'Przypomnienie' }
  ];
  $('#point-content').innerHTML = `<div class="panel" id="points-panel"><div class="toolbar"><strong>Lista punktów</strong><input data-filter="_all" placeholder="Szukaj we wszystkich informacjach"></div><div class="tablewrap"><table><thead><tr>${columns.map(column => `<th class="sortable" data-sort="${column.key}" data-label="${column.label}">${column.label}${sortMarker('points', column.key)}</th>`).join('')}</tr>${tableFilterRow(columns)}</thead><tbody id="points-body"></tbody></table></div></div>`;
  $$('#points-panel [data-filter]').forEach(input => { input.addEventListener('input', drawPointRows); input.addEventListener('change', drawPointRows); });
  $$('#points-panel th[data-sort]').forEach(th => th.addEventListener('click', () => updateSort('points', th.dataset.sort)));
  drawPointRows();
}

function drawPointRows() {
  const rows = sortRows(filterRows(state.points, '#points-panel'), state.sort.points);
  $('#points-body').innerHTML = rows.map(item => `<tr data-id="${item.id}"><td class="maincell">${escapeHtml(item.issue_id)} · ${escapeHtml(item.title)}<span class="sub">${escapeHtml(item.description)}</span><span class="sub">Utworzył: ${escapeHtml(item.created_by_name || 'dane historyczne')} · ${displayDate((item.created_at || '').slice(0, 10))}</span></td><td>${escapeHtml(item.controller)}</td><td>${escapeHtml(item.category || '—')}</td><td>${escapeHtml(item.subcategory || '—')}</td><td>${badge(item.status)}</td><td>${escapeHtml(item.waiting_for || '—')}</td><td>${escapeHtml(item.owner_name || '—')}</td><td>${displayDate(item.due_date)}</td><td>${displayDate(item.reminder_date)}</td></tr>`).join('') || '<tr><td colspan="9" class="empty">Brak wyników</td></tr>';
  $$('#points-body tr[data-id]').forEach(row => row.addEventListener('click', () => openRecord('points', state.points.find(item => item.id === Number(row.dataset.id)))));
}

function reminderSection(title, items, color) {
  return `<section class="list-section"><header><strong>${title}</strong><span class="badge ${color}">${items.length}</span></header><div class="compact-list">${items.map(item => `<div class="compact-item" data-jump="points" data-id="${item.id}"><span><strong>${escapeHtml(item.issue_id)} · ${escapeHtml(item.title)}</strong><small>${escapeHtml(item.controller)} · ${escapeHtml(item.owner_name || 'bez odpowiedzialnego')}</small></span><span>${displayDate(item.reminder_date)}</span></div>`).join('') || '<div class="empty">Brak punktów</div>'}</div></section>`;
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
  $('#notes-list').innerHTML = groups.map(group => `${grouping ? `<div class="group-title">${escapeHtml(group)} · ${rows.filter(item => (item[grouping] || 'Bez wartości') === group).length}</div>` : ''}${(grouping ? rows.filter(item => (item[grouping] || 'Bez wartości') === group) : rows).map(item => `<article class="note" data-id="${item.id}"><div class="note-meta">${displayDate(item.note_date)} · ${escapeHtml(item.cw)}<br>${escapeHtml(item.controller || 'Ogólne')} · ${escapeHtml(item.shift)}<br>${escapeHtml(item.author || item.created_by_name)}</div><div><strong>${escapeHtml(item.type)}</strong><p>${escapeHtml(item.content)}</p><div class="links">${item.linked_task_id ? linkChip('task', item.linked_task_id, 'Zadanie') : ''}${item.linked_status_id ? linkChip('status', item.linked_status_id, 'Status') : ''}${item.linked_point_id ? linkChip('point', item.linked_point_id, 'Otwarty punkt') : ''}</div></div></article>`).join('')}`).join('') || '<div class="empty">Brak wpisów</div>';
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
  return categories.map((category, index) => `<div class="settings-row">${orderControls(kind, categories, index)}<span><b>${escapeHtml(category.name)}</b></span><button class="mini edit-category" data-scope="${scope}" data-id="${category.id}" data-value="${escapeHtml(category.name)}">Edytuj</button><button class="mini add-sub" data-scope="${scope}" data-id="${category.id}">+ podkategoria</button>${admin ? `<button class="mini delete-config" data-kind="${deleteCategory}" data-id="${category.id}">Usuń</button>` : ''}</div>${category.subcategories.map((sub, subIndex) => `<div class="settings-row">${orderControls(subKind, category.subcategories, subIndex)}<span>↳ ${escapeHtml(sub.name)}</span><button class="mini edit-sub" data-scope="${scope}" data-id="${sub.id}" data-parent="${category.id}" data-value="${escapeHtml(sub.name)}">Edytuj</button>${admin ? `<button class="mini delete-config" data-kind="${deleteSub}" data-id="${sub.id}">Usuń</button>` : ''}</div>`).join('')}`).join('');
}

function functionGroupConfig(admin) {
  const groups = functionGroups(state.functionGroupController);
  return `<section class="settings-card settings-wide"><div class="settings-title-row"><div><h2>Grupy funkcyjne i punkty statusu</h2><p class="sub">Osobna, uporządkowana lista stacji, robotów i innych grup dla każdego sterownika.</p></div><label class="field compact-field"><span>Sterownik</span><select id="function-group-controller">${selectOptions(state.controllers.map(item => item.code), state.functionGroupController)}</select></label></div>
    <div class="function-group-list">${groups.map((group, index) => `<div class="settings-row function-group-row">${admin ? orderControls('function_groups', groups, index) : ''}<span><b>${escapeHtml(group.name)}</b><small class="sub">${group.check_count} zdefiniowanych punktów · ${group.status_count} wierszy w Statusie</small></span>${admin ? `<button class="mini edit-function-points" data-id="${group.id}">Punkty statusu</button><button class="mini rename-function-group" data-id="${group.id}" data-value="${escapeHtml(group.name)}">Zmień nazwę</button><button class="mini delete-function-group" data-id="${group.id}">Usuń</button>` : ''}</div>`).join('') || '<div class="empty compact-empty">Brak grup funkcyjnych dla wybranego sterownika.</div>'}</div>
    ${admin ? `<div class="function-group-actions"><form id="new-function-group" class="inline-form"><input name="name" placeholder="Nowa grupa, np. Robot R01" required><button class="mini">Dodaj grupę</button></form><div class="bulk-groups"><label class="field"><span>Szybkie dodawanie — jeden wiersz = jedna grupa funkcyjna</span><textarea id="bulk-function-groups" rows="6" placeholder="Stacja 010\nRobot R01\nRobot R02"></textarea></label><button class="secondary" id="bulk-function-groups-add">Dodaj listę</button></div></div>` : '<p class="sub">Edycja grup funkcyjnych jest dostępna dla administratora.</p>'}
  </section>`;
}

function renderSettings() {
  const admin = state.me.role === 'admin';
  const dictionaries = [['waiting_for', 'Oczekiwanie na'], ['shift', 'Zmiany'], ['note_type', 'Typy notatek']].map(([kind, label]) => {
    const items = state.config.options.filter(item => item.kind === kind);
    return `<h3>${label}</h3>${items.map((item, index) => `<div class="settings-row">${orderControls('options', items, index)}<span>${escapeHtml(item.value)}</span><button class="mini edit-option" data-id="${item.id}" data-kind="${kind}" data-value="${escapeHtml(item.value)}">Edytuj</button>${admin ? `<button class="mini delete-config" data-kind="option" data-id="${item.id}">Usuń</button>` : ''}</div>`).join('')}<form class="inline-form add-option" data-kind="${kind}"><input name="value" placeholder="Nowa wartość" required><button class="mini">Dodaj</button></form>`;
  }).join('');
  $('#content').innerHTML = `<div class="settings-grid">
    <section class="settings-card"><h2>Sterowniki / obszary</h2>${state.controllers.map((item, index) => `<div class="settings-row">${admin ? orderControls('controllers', state.controllers, index) : ''}<span><b>${escapeHtml(item.code)}</b><small class="sub">${escapeHtml(item.area)} · ${escapeHtml(item.description)}</small></span>${admin ? `<button class="mini edit-controller" data-id="${item.id}">Edytuj</button>` : ''}</div>`).join('')}${admin ? '<button class="secondary" id="new-controller">+ Dodaj sterownik</button>' : ''}</section>
    ${functionGroupConfig(admin)}
    <section class="settings-card"><h2>Kategorie statusu i otwartych punktów</h2>${categoryConfig('status', state.config.categories, admin)}<form class="inline-form add-category" data-scope="status"><input name="name" placeholder="Nowa kategoria" required><button class="mini">Dodaj</button></form></section>
    <section class="settings-card"><h2>Kategorie zadań</h2>${categoryConfig('task', state.config.task_categories, admin)}<form class="inline-form add-category" data-scope="task"><input name="name" placeholder="Nowa kategoria zadań" required><button class="mini">Dodaj</button></form></section>
    <section class="settings-card"><h2>Użytkownicy</h2>${state.users.map((item, index) => `<div class="settings-row">${admin ? orderControls('users', state.users, index) : ''}<span><b>${escapeHtml(item.display_name)}</b><small class="sub">${escapeHtml(item.username)} · ${roleName(item.role)}${item.active ? '' : ' · nieaktywny'}</small></span>${admin ? `<button class="mini edit-user" data-id="${item.id}">Edytuj</button>` : ''}</div>`).join('')}${admin ? '<button class="secondary" id="new-user">+ Dodaj użytkownika</button>' : ''}</section>
    <section class="settings-card"><h2>Słowniki</h2>${dictionaries}</section>
    <section class="settings-card"><h2>Ustawienia przypomnień</h2>${admin ? `<label class="field"><span>Domyślne przypomnienie po utworzeniu (dni)</span><input id="default-reminder" type="number" min="1" value="${escapeHtml(state.config.settings.default_reminder_days || 14)}"></label><label class="field"><span>Okno „zbliżających się” przypomnień (dni)</span><input id="warning-days" type="number" min="1" value="${escapeHtml(state.config.settings.reminder_warning_days || 7)}"></label>` : '<p class="sub">Tylko administrator może zmieniać ustawienia globalne.</p>'}</section>
  </div>`;
  bindSettings();
}

function bindSettings() {
  $$('.move-item').forEach(button => button.addEventListener('click', () => moveConfigItem(button.dataset.kind, Number(button.dataset.id), Number(button.dataset.direction))));
  $('#function-group-controller')?.addEventListener('change', event => { state.functionGroupController = event.target.value; renderSettings(); });
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
  $$('.rename-function-group').forEach(button => button.addEventListener('click', async () => {
    const name = prompt('Nowa nazwa grupy funkcyjnej:', button.dataset.value);
    if (!name) return;
    try {
      await api(`/api/function-groups/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ controller: state.functionGroupController, name }) });
      toast('Nazwa grupy została zmieniona'); await loadData();
    } catch (error) { toast(error.message, true); }
  }));
  $$('.delete-function-group').forEach(button => button.addEventListener('click', async () => {
    if (!confirm('Usunąć grupę funkcyjną i wszystkie przypisane do niej punkty statusu?')) return;
    try {
      await api(`/api/function-groups/${button.dataset.id}`, { method: 'DELETE' });
      toast('Usunięto grupę funkcyjną'); await loadData();
    } catch (error) { toast(error.message, true); }
  }));
  $$('.edit-function-points').forEach(button => button.addEventListener('click', () => openFunctionGroupPoints(Number(button.dataset.id))));
  $$('.add-category').forEach(form => form.addEventListener('submit', async event => { event.preventDefault(); const scope = form.dataset.scope; const endpoint = scope === 'task' ? '/api/task-categories' : '/api/categories'; await api(endpoint, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); await loadData(); }));
  $$('.edit-category').forEach(button => button.addEventListener('click', async () => { const name = prompt('Nowa nazwa kategorii:', button.dataset.value); if (!name) return; await api(button.dataset.scope === 'task' ? `/api/task-categories/${button.dataset.id}` : `/api/categories/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ name }) }); await loadData(); }));
  $$('.add-sub').forEach(button => button.addEventListener('click', async () => { const name = prompt('Nazwa podkategorii:'); if (!name) return; await api(button.dataset.scope === 'task' ? '/api/task-subcategories' : '/api/subcategories', { method: 'POST', body: JSON.stringify({ category_id: Number(button.dataset.id), name }) }); await loadData(); }));
  $$('.edit-sub').forEach(button => button.addEventListener('click', async () => { const name = prompt('Nowa nazwa podkategorii:', button.dataset.value); if (!name) return; await api(button.dataset.scope === 'task' ? `/api/task-subcategories/${button.dataset.id}` : `/api/subcategories/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ category_id: Number(button.dataset.parent), name }) }); await loadData(); }));
  $$('.add-option').forEach(form => form.addEventListener('submit', async event => { event.preventDefault(); const value = form.querySelector('input').value; await api('/api/options', { method: 'POST', body: JSON.stringify({ kind: form.dataset.kind, value }) }); await loadData(); }));
  $$('.edit-option').forEach(button => button.addEventListener('click', async () => { const value = prompt('Nowa wartość:', button.dataset.value); if (!value) return; await api(`/api/options/${button.dataset.id}`, { method: 'PATCH', body: JSON.stringify({ kind: button.dataset.kind, value }) }); await loadData(); }));
  $$('.delete-config').forEach(button => button.addEventListener('click', async () => { if (!confirm('Usunąć tę pozycję konfiguracji?')) return; const endpoints = { category: 'categories', subcategory: 'subcategories', task_category: 'task-categories', task_subcategory: 'task-subcategories', option: 'options' }; await api(`/api/${endpoints[button.dataset.kind]}/${button.dataset.id}`, { method: 'DELETE' }); await loadData(); }));
  $$('.edit-controller').forEach(button => button.addEventListener('click', () => openRecord('controllers', state.controllers.find(item => item.id === Number(button.dataset.id)))));
  $$('.edit-user').forEach(button => button.addEventListener('click', () => openRecord('users', state.users.find(item => item.id === Number(button.dataset.id)))));
  $('#new-controller')?.addEventListener('click', () => openRecord('controllers'));
  $('#new-user')?.addEventListener('click', () => openRecord('users'));
  $('#default-reminder')?.addEventListener('change', event => saveSetting('default_reminder_days', event.target.value));
  $('#warning-days')?.addEventListener('change', event => saveSetting('reminder_warning_days', event.target.value));
}

function openFunctionGroupPoints(groupId) {
  const group = (state.config.function_groups || []).find(item => item.id === groupId);
  if (!group) return;
  state.functionPointGroup = group;
  state.functionPointDraft = (group.checks || []).map(check => ({
    id: check.id, title: check.title, category: check.category,
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
  state.functionPointDraft.push({ id: null, title: '', category: statusCategories()[0] || '', criticality: 'Medium', subcategory_ids: [] });
  renderFunctionPointDraft();
  $('#function-points-content').lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function saveFunctionGroupPoints() {
  captureFunctionPointDraft();
  const button = $('#function-points-save');
  button.disabled = true;
  try {
    await api(`/api/function-groups/${state.functionPointGroup.id}/checks`, { method: 'PUT', body: JSON.stringify({ points: state.functionPointDraft }) });
    $('#function-points-dialog').close();
    toast('Punkty grupy zapisano i zsynchronizowano ze Statusem');
    await loadData();
  } catch (error) { toast(error.message, true); }
  finally { button.disabled = false; }
}

async function moveConfigItem(kind, id, direction) {
  let items;
  if (kind === 'controllers') items = state.controllers;
  else if (kind === 'users') items = state.users;
  else if (kind === 'function_groups') items = functionGroups(state.functionGroupController);
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
    ['controller', 'Sterownik', 'controller'], ['function_group_id', 'Grupa funkcyjna', 'function-group'], ['test_id', 'Test ID'], ['station', 'Stacja / obiekt'], ['function_detail', 'Test / funkcja'],
    ['category', 'Kategoria', 'category', 'status'], ['subcategory', 'Podkategoria', 'subcategory', 'status'],
    ['status', 'Status', 'select', ['Not started', 'Ready to test', 'In progress', 'Blocked', 'NOK / Rework', 'Retest required', 'Done', 'N/A']],
    ['criticality', 'Krytyczność', 'select', ['Low', 'Medium', 'High', 'Critical']], ['responsible_user_id', 'Odpowiedzialny', 'user'],
    ['milestone', 'Milestone'], ['environment', 'Środowisko testu'], ['current_note', 'Aktualna notatka', 'textarea'], ['evidence_link', 'Dodatkowe informacje / link'], ['mentioned_user_ids', 'Wspomniane osoby', 'mentions']
  ] },
  tasks: { endpoint: '/api/tasks', title: 'zadanie', fields: [
    ['controller', 'Sterownik', 'controller'], ['title', 'Tytuł'], ['station', 'Stacja / obiekt'], ['owner_user_id', 'Odpowiedzialny', 'user'],
    ['status', 'Status', 'select', ['To do', 'In progress', 'Done']], ['priority', 'Priorytet', 'select', ['Low', 'Medium', 'High', 'Critical']],
    ['start_date', 'Planowany start', 'date'], ['due_date', 'Deadline', 'date'], ['category', 'Kategoria zadania', 'category', 'task'], ['subcategory', 'Podkategoria zadania', 'subcategory', 'task'],
    ['link', 'Powiązany element', 'entity', ['status', 'point', 'note']], ['info_link', 'Dodatkowe informacje / link'], ['description', 'Opis', 'textarea'], ['mentioned_user_ids', 'Wspomniane osoby', 'mentions'], ['checklist', 'Lista kontrolna', 'checklist']
  ] },
  points: { endpoint: '/api/open-points', title: 'otwarty punkt', fields: [
    ['controller', 'Sterownik', 'controller'], ['issue_id', 'Issue ID'], ['title', 'Temat'], ['owner_user_id', 'Odpowiedzialny', 'user'],
    ['status', 'Status', 'select', ['Open', 'Waiting', 'In progress', 'Closed']], ['priority', 'Priorytet', 'select', ['Low', 'Medium', 'High', 'Critical']],
    ['start_date', 'Planowany start', 'date'], ['due_date', 'Deadline', 'date'], ['reminder_date', 'Przypomnienie', 'date'],
    ['category', 'Kategoria', 'category', 'status'], ['subcategory', 'Podkategoria', 'subcategory', 'status'], ['waiting_for', 'Oczekiwanie na', 'options', 'waiting_for'],
    ['link', 'Powiązany element', 'entity', ['status', 'point', 'note']], ['info_link', 'Dodatkowe informacje / link'],
    ['impact', 'Wpływ', 'textarea'], ['next_action', 'Następny krok', 'textarea'], ['description', 'Opis techniczny', 'textarea'], ['mentioned_user_ids', 'Wspomniane osoby', 'mentions']
  ] },
  notes: { endpoint: '/api/daily-notes', title: 'notatkę', fields: [
    ['controller', 'Sterownik', 'controller'], ['note_date', 'Data wpisu', 'date'], ['shift', 'Zmiana', 'options', 'shift'], ['type', 'Typ wpisu', 'options', 'note_type'],
    ['content', 'Treść', 'bigtextarea'], ['note_links', 'Powiązania', 'note-links'], ['mentioned_user_ids', 'Wspomniane osoby', 'mentions']
  ] },
  goals: { endpoint: '/api/goals', title: 'cel', fields: [
    ['controller', 'Sterownik', 'controller'], ['title', 'Nazwa celu'], ['status', 'Status', 'select', ['Open', 'In progress', 'Done']], ['due_date', 'Termin', 'date'], ['description', 'Opis', 'textarea'], ['goal_links', 'Powiązane elementy', 'goal-links']
  ] },
  users: { endpoint: '/api/users', title: 'użytkownika', fields: [
    ['username', 'Login'], ['display_name', 'Imię i nazwisko'], ['password', 'Hasło', 'password'], ['role', 'Rola', 'select', ['user', 'moderator', 'admin']], ['active', 'Konto aktywne', 'boolean']
  ] },
  controllers: { endpoint: '/api/controllers', title: 'sterownik', fields: [['code', 'Kod sterownika'], ['area', 'Obszar'], ['description', 'Opis', 'textarea']] }
};

async function openRecord(type, record = null) {
  const definition = formDefinitions[type];
  if (!definition) return;
  state.dialog = { type, record };
  state.goalDraftLinks = record?.links ? record.links.map(link => ({ entity_type: link.entity_type, entity_id: Number(link.entity_id) })) : [];
  $('#modal-title').textContent = `${record ? 'Edytuj' : 'Dodaj'} ${definition.title}`;
  $('#modal-subtitle').textContent = record ? `Rekord #${record.id}` : 'Uzupełnij informacje potrzebne zespołowi.';
  $('#record-meta').innerHTML = record ? `<span>Utworzone przez: <b>${escapeHtml(record.created_by_name || record.author || 'dane historyczne')}</b></span><span>Data utworzenia: <b>${displayDateTime(record.created_at)}</b></span><span>Ostatnia aktualizacja: <b>${displayDateTime(record.updated_at)}</b></span>` : '<span>Autor zostanie przypisany automatycznie po zapisaniu.</span>';
  const configDelete = Boolean(record && state.me.role === 'admin' && ['controllers', 'users'].includes(type) && !(type === 'users' && record.id === state.me.id));
  $('#remove').hidden = !(record?.can_delete || configDelete);
  $('#fields').innerHTML = definition.fields.map(field => fieldHtml(field, record)).join('');
  bindDynamicFields(type);
  if (record && ['status', 'tasks', 'points', 'notes', 'goals'].includes(type)) await loadAudit(typeToEntity(type), record.id);
  else $('#audit-section').classList.add('hidden');
  $('#modal').showModal();
}

function typeToEntity(type) { return ({ status: 'status', tasks: 'task', points: 'point', notes: 'note', goals: 'goal' })[type]; }

function defaultValue(name) {
  if (name === 'controller') return state.controller === 'all' ? state.controllers[0]?.code || '' : state.controller;
  if (name === 'note_date') return today();
  if (name === 'active') return 1;
  return '';
}

function fieldHtml([name, label, type = 'text', extra], record) {
  const value = record?.[name] ?? defaultValue(name);
  if (type === 'entity') return entityField(record, extra);
  if (type === 'note-links') return noteLinksField(record);
  if (type === 'mentions') return mentionsField(record);
  if (type === 'checklist') return checklistField(record);
  if (type === 'goal-links') return goalLinksField();
  let input;
  if (type === 'controller') input = `<select name="${name}" id="form-controller">${selectOptions(state.controllers.map(item => item.code), value)}</select>`;
  else if (type === 'function-group') {
    const controllerCode = record?.controller || defaultValue('controller');
    input = `<select name="${name}" id="form-function-group">${selectOptions(functionGroups(controllerCode).map(item => ({ value: item.id, label: item.name })), value, 'Bez grupy funkcyjnej')}</select>`;
  }
  else if (type === 'user') input = `<select name="${name}">${selectOptions(state.users.filter(item => item.active).map(item => ({ value: item.id, label: item.display_name })), value, 'Nieprzypisane')}</select>`;
  else if (type === 'select') input = `<select name="${name}">${selectOptions(extra, value)}</select>`;
  else if (type === 'category') input = `<select name="${name}" id="form-category" data-scope="${extra}">${selectOptions(extra === 'task' ? taskCategories() : statusCategories(), value)}</select>`;
  else if (type === 'subcategory') input = `<select name="${name}" id="form-subcategory">${selectOptions(subcategories(extra, record?.category), value)}</select>`;
  else if (type === 'options') input = `<select name="${name}">${selectOptions(options(extra), value)}</select>`;
  else if (type === 'textarea' || type === 'bigtextarea') input = `<textarea name="${name}">${escapeHtml(value)}</textarea>`;
  else if (type === 'boolean') input = `<select name="${name}"><option value="1"${Number(value) !== 0 ? ' selected' : ''}>Tak</option><option value="0"${Number(value) === 0 ? ' selected' : ''}>Nie</option></select>`;
  else input = `<input name="${name}" type="${type}" value="${escapeHtml(value)}" ${['title', 'station', 'function_detail', 'username', 'display_name'].includes(name) || (name === 'password' && !record) ? 'required' : ''}>`;
  return `<label class="field ${['textarea', 'bigtextarea'].includes(type) ? `full ${type === 'bigtextarea' ? 'big' : ''}` : ''}"><span>${label}</span>${input}</label>`;
}

function entityField(record, allowedTypes) {
  const selectedType = record?.linked_entity_type || allowedTypes[0];
  const selectedId = record?.linked_entity_id || '';
  const labels = { status: 'Punkt statusu', point: 'Otwarty punkt', note: 'Wpis dziennika' };
  return `<div class="field full"><label>Powiązany element</label><div class="link-choice"><select name="linked_entity_type" id="entity-type">${allowedTypes.map(type => `<option value="${type}"${type === selectedType ? ' selected' : ''}>${labels[type]}</option>`).join('')}</select><select name="linked_entity_id" id="entity-id" data-value="${selectedId}"></select></div>${record?.linked_entity_id ? '<button type="button" class="mini" id="go-entity">Przejdź bezpośrednio do powiązanego punktu →</button>' : ''}</div>`;
}

function noteLinksField(record) {
  const definitions = [['linked_task_id', 'Zadanie', 'task'], ['linked_status_id', 'Punkt statusu', 'status'], ['linked_point_id', 'Otwarty punkt', 'point']];
  return `<div class="field full"><label>Powiązania z notatką</label>${definitions.map(([key, label, type]) => `<div class="link-choice"><label class="mention"><input type="checkbox" data-toggle="${key}" ${record?.[key] ? 'checked' : ''}>${label}</label><select name="${key}" id="${key}" ${record?.[key] ? '' : 'disabled'}>${entitySelectOptions(type, record?.[key])}</select></div>`).join('')}</div>`;
}

function mentionsField(record) {
  const selected = new Set(record?.mentioned_user_ids || []);
  return `<div class="field full"><label>Wspomniane osoby</label><div class="mentions">${state.users.filter(item => item.active).map(user => `<label class="mention"><input type="checkbox" name="mentioned_user_ids" value="${user.id}" ${selected.has(user.id) ? 'checked' : ''}>${escapeHtml(user.display_name)}</label>`).join('')}</div></div>`;
}

function checklistField(record) {
  return `<div class="checks"><label>Lista kontrolna / podzadania</label><div id="checklist">${(record?.checklist || []).map(checklistRow).join('')}</div><button type="button" class="mini" id="add-check">+ Dodaj podzadanie</button></div>`;
}

function checklistRow(item = {}) {
  return `<div class="check-row"><input type="checkbox" data-check-done ${item.done ? 'checked' : ''}><input type="text" data-check-text value="${escapeHtml(item.text || '')}" placeholder="Treść podzadania"><button type="button" class="mini delete-check">×</button></div>`;
}

function goalLinksField() {
  return `<div class="field full"><label>Powiązane elementy</label><button type="button" class="secondary" id="open-goal-picker">Wybierz status, zadania i otwarte punkty</button><div id="goal-link-preview" class="goal-links"></div></div>`;
}

function bindDynamicFields(type) {
  $('#form-category')?.addEventListener('change', event => { const scope = event.target.dataset.scope; $('#form-subcategory').innerHTML = selectOptions(subcategories(scope, event.target.value)); });
  $('#entity-type')?.addEventListener('change', fillEntitySelect);
  if (type === 'status') {
    $('#form-controller')?.addEventListener('change', event => {
      $('#form-function-group').innerHTML = selectOptions(functionGroups(event.target.value).map(item => ({ value: item.id, label: item.name })), '', 'Bez grupy funkcyjnej');
    });
    $('#form-function-group')?.addEventListener('change', event => {
      const group = (state.config.function_groups || []).find(item => item.id === Number(event.target.value));
      if (group) $('#fields [name="station"]').value = group.name;
    });
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
}

function bindChecklistDelete() { $$('.delete-check').forEach(button => button.addEventListener('click', () => button.closest('.check-row').remove())); }

function collectionForType(type) { return type === 'status' ? state.status : type === 'point' ? state.points : type === 'note' ? state.notes : state.tasks; }
function entitySelectOptions(type, selected) { return selectOptions(collectionForType(type).map(item => ({ value: item.id, label: entityLabel(type, item) })), selected); }
function fillEntitySelect() { const type = $('#entity-type').value; const selected = $('#entity-id').dataset.value; $('#entity-id').innerHTML = entitySelectOptions(type, selected); $('#entity-id').dataset.value = ''; }

function openGoalPicker() {
  $('#picker-search').value = '';
  renderGoalPicker();
  $('#goal-picker').showModal();
}

function renderGoalPicker() {
  const query = ($('#picker-search').value || '').toLowerCase();
  const sections = [['status', 'Status', state.status], ['task', 'Zadania', state.tasks], ['point', 'Otwarte punkty', state.points]];
  $('#picker-content').innerHTML = sections.map(([type, label, items]) => `<section class="picker-column"><h3>${label}</h3>${items.filter(item => entityLabel(type, item).toLowerCase().includes(query)).map(item => `<label class="picker-item"><input type="checkbox" data-picker-type="${type}" value="${item.id}" ${state.goalDraftLinks.some(link => link.entity_type === type && link.entity_id === item.id) ? 'checked' : ''}><span>${escapeHtml(entityLabel(type, item))}<small class="sub">${escapeHtml(item.controller || '')}</small></span></label>`).join('') || '<div class="empty">Brak wyników</div>'}</section>`).join('');
}

function applyGoalPicker() {
  state.goalDraftLinks = $$('[data-picker-type]:checked').map(input => ({ entity_type: input.dataset.pickerType, entity_id: Number(input.value) }));
  $('#goal-picker').close();
  renderGoalLinkPreview();
}

function renderGoalLinkPreview() {
  const container = $('#goal-link-preview');
  if (!container) return;
  container.innerHTML = state.goalDraftLinks.map(link => { const item = entity(link.entity_type, link.entity_id); return item ? `<div class="jump"><span>${escapeHtml(entityLabel(link.entity_type, item))}</span><span>${link.entity_type}</span></div>` : ''; }).join('') || '<span class="sub">Nie wybrano elementów.</span>';
}

async function loadAudit(type, id) {
  const entries = await api(`/api/audit?type=${encodeURIComponent(type)}&id=${id}`);
  $('#audit-section').classList.remove('hidden');
  $('#audit-list').innerHTML = entries.map(entry => `<article class="audit-entry"><strong>${escapeHtml(entry.user_name || 'System')} · ${displayDateTime(entry.changed_at)} · ${auditAction(entry.action)}</strong>${Object.entries(entry.changes).map(([field, change]) => `<div class="audit-change"><span>${escapeHtml(fieldLabel(field))}</span><span>${escapeHtml(formatAuditValue(change.from))} → <b>${escapeHtml(formatAuditValue(change.to))}</b></span></div>`).join('') || '<span>Brak szczegółowych różnic</span>'}</article>`).join('') || '<div class="empty">Historia jest pusta</div>';
}

function auditAction(action) { return ({ create: 'utworzenie', update: 'edycja', delete: 'usunięcie', migrate: 'migracja do V3' })[action] || action; }
function fieldLabel(field) { return ({ controller_id: 'Sterownik', owner_user_id: 'Odpowiedzialny', responsible_user_id: 'Odpowiedzialny', due_date: 'Deadline', reminder_date: 'Przypomnienie', start_date: 'Planowany start', current_note: 'Notatka', linked_entity_id: 'Powiązany element', linked_entity_type: 'Typ powiązania', mentioned_user_ids: 'Wspomniane osoby', checklist: 'Lista kontrolna' })[field] || field.replaceAll('_', ' '); }
function formatAuditValue(value) { if (value === null || value === undefined || value === '') return '—'; if (typeof value === 'object') return JSON.stringify(value); return String(value); }

async function saveRecord(event) {
  event.preventDefault();
  const { type, record } = state.dialog;
  const definition = formDefinitions[type];
  const formData = new FormData(event.currentTarget);
  const input = Object.fromEntries(formData);
  input.mentioned_user_ids = formData.getAll('mentioned_user_ids').map(Number);
  if (type === 'tasks') input.checklist = $$('#checklist .check-row').map(row => ({ text: row.querySelector('[data-check-text]').value, done: row.querySelector('[data-check-done]').checked })).filter(item => item.text.trim());
  if (type === 'goals') input.links = state.goalDraftLinks;
  if (type === 'notes') $$('[data-toggle]').forEach(toggle => { if (!toggle.checked) input[toggle.dataset.toggle] = null; });
  try {
    await api(definition.endpoint + (record ? `/${record.id}` : ''), { method: record ? 'PATCH' : 'POST', body: JSON.stringify(input) });
    $('#modal').close();
    toast('Zapisano zmiany');
    await loadData();
  } catch (error) { toast(error.message, true); }
}

async function deleteRecord() {
  const { type, record } = state.dialog;
  if (!confirm('Usunąć ten rekord? Operacja zostanie zapisana w historii.')) return;
  try {
    await api(`${formDefinitions[type].endpoint}/${record.id}`, { method: 'DELETE' });
    $('#modal').close();
    toast('Usunięto rekord');
    await loadData();
  } catch (error) { toast(error.message, true); }
}

function jumpTo(type, id) {
  const view = type === 'task' || type === 'tasks' ? 'tasks' : type === 'point' || type === 'points' ? 'points' : type === 'note' || type === 'notes' ? 'notes' : 'status';
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
