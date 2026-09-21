const state = {
  view: 'status',
  controller: 'all',
  controllers: [],
  dashboard: {},
  status: [],
  tasks: [],
  points: [],
  notes: [],
  dialog: null
};

const content = document.querySelector('#content');
const controllerSelect = document.querySelector('#controller-select');
const addRecordButton = document.querySelector('#add-record');
const dialog = document.querySelector('#record-dialog');
const dialogForm = document.querySelector('#record-form');
const dialogFields = document.querySelector('#dialog-fields');
const deleteButton = document.querySelector('#delete-record');
const connection = document.querySelector('#connection-state');

const pageCopy = {
  status: ['Status', 'Postęp testów i szybka aktualizacja stanu.', '+ Dodaj test'],
  tasks: ['Zadania', 'Praca zespołu PLC pogrupowana według etapu realizacji.', '+ Nowe zadanie'],
  points: ['Lista otwartych punktów', 'Blokady, braki i tematy wymagające decyzji lub wsparcia.', '+ Nowy punkt'],
  notes: ['Dzienne notatki', 'Dziennik zmianowy: postęp, problemy, decyzje i plan na kolejną zmianę.', '+ Dodaj notatkę']
};

const badgeMap = {
  'Done': ['Gotowe', 'green'],
  'In progress': ['W toku', 'blue'],
  'Ready to test': ['Do testu', 'amber'],
  'Blocked': ['Zablokowane', 'red'],
  'NOK / Rework': ['NOK / poprawa', 'red'],
  'Retest required': ['Retest', 'amber'],
  'Not started': ['Nie rozpoczęto', 'gray'],
  'N/A': ['N/A', 'gray'],
  'To do': ['Do zrobienia', 'gray'],
  'Open': ['Otwarte', 'red'],
  'Waiting': ['Oczekuje', 'amber'],
  'Closed': ['Zamknięte', 'green'],
  'Critical': ['Krytyczny', 'red'],
  'High': ['Wysoki', 'amber'],
  'Medium': ['Średni', 'blue'],
  'Low': ['Niski', 'green']
};

const forms = {
  status: {
    endpoint: '/api/status',
    title: 'test',
    fields: [
      field('controller', 'Sterownik', 'controller', true),
      field('test_id', 'Test ID', 'text', false, 'Nadawany automatycznie, jeśli puste'),
      field('station', 'Stacja / obiekt', 'text', true),
      field('function_detail', 'Test / funkcja', 'text', true),
      field('category', 'Kategoria'),
      field('milestone', 'Milestone'),
      field('criticality', 'Krytyczność', 'select', true, '', ['Low', 'Medium', 'High', 'Critical']),
      field('responsible', 'Odpowiedzialny'),
      field('status', 'Status', 'select', true, '', ['Not started', 'Ready to test', 'In progress', 'Blocked', 'NOK / Rework', 'Retest required', 'Done', 'N/A']),
      field('current_note', 'Aktualna notatka', 'textarea', false, '', [], true),
      field('evidence_link', 'Dowód / link', 'text', false, '', [], true)
    ]
  },
  tasks: {
    endpoint: '/api/tasks',
    title: 'zadanie',
    fields: [
      field('controller', 'Sterownik', 'controller', true),
      field('title', 'Tytuł zadania', 'text', true),
      field('station', 'Stacja / obiekt'),
      field('owner', 'Odpowiedzialny'),
      field('priority', 'Priorytet', 'select', true, '', ['Low', 'Medium', 'High', 'Critical']),
      field('status', 'Status', 'select', true, '', ['To do', 'In progress', 'Done']),
      field('due_date', 'Termin', 'date'),
      field('linked_test_id', 'Powiązany Test ID'),
      field('description', 'Opis / rezultat', 'textarea', false, '', [], true)
    ]
  },
  points: {
    endpoint: '/api/open-points',
    title: 'otwarty punkt',
    fields: [
      field('controller', 'Sterownik', 'controller', true),
      field('issue_id', 'Issue ID', 'text', false, 'Nadawany automatycznie, jeśli puste'),
      field('title', 'Temat', 'text', true),
      field('owner', 'Odpowiedzialny'),
      field('priority', 'Priorytet', 'select', true, '', ['Low', 'Medium', 'High', 'Critical']),
      field('status', 'Status', 'select', true, '', ['Open', 'Waiting', 'In progress', 'Closed']),
      field('due_date', 'Termin', 'date'),
      field('waiting_for', 'Oczekujemy na'),
      field('impact', 'Wpływ na uruchomienie', 'textarea', false, '', [], true),
      field('next_action', 'Następny krok', 'textarea', false, '', [], true),
      field('description', 'Opis techniczny', 'textarea', false, '', [], true),
      field('linked_test_id', 'Powiązany Test ID')
    ]
  },
  notes: {
    endpoint: '/api/daily-notes',
    title: 'notatkę',
    fields: [
      field('controller', 'Sterownik', 'controller', true),
      field('note_date', 'Data', 'date', true),
      field('shift', 'Zmiana', 'select', true, '', ['Shift 1', 'Shift 2', 'Shift 3', 'General']),
      field('author', 'Autor', 'text', true),
      field('type', 'Typ wpisu', 'select', true, '', ['Progress', 'Problem', 'Decision', 'Plan']),
      field('content', 'Treść', 'textarea', true, 'Co zrobiono, jaki jest efekt i co dalej?', [], true)
    ]
  }
};

function field(name, label, type = 'text', required = false, placeholder = '', options = [], full = false) {
  return { name, label, type, required, placeholder, options, full };
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[character]);
}

function badge(value) {
  const [label, color] = badgeMap[value] || [value || '—', 'gray'];
  return `<span class="badge ${color}">${escapeHtml(label)}</span>`;
}

function displayDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Błąd serwera (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

async function initialize() {
  try {
    state.controllers = await api('/api/controllers');
    controllerSelect.insertAdjacentHTML('beforeend', state.controllers.map(item => `<option value="${escapeHtml(item.code)}">${escapeHtml(item.code)}</option>`).join(''));
    bindShellEvents();
    await loadData();
  } catch (error) {
    showError(error);
  }
}

function bindShellEvents() {
  document.querySelectorAll('.nav-button').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  controllerSelect.addEventListener('change', async () => {
    state.controller = controllerSelect.value;
    await loadData();
  });
  addRecordButton.addEventListener('click', () => openDialog(state.view));
  document.querySelector('#close-dialog').addEventListener('click', () => dialog.close());
  document.querySelector('#cancel-dialog').addEventListener('click', () => dialog.close());
  dialogForm.addEventListener('submit', saveDialogRecord);
  deleteButton.addEventListener('click', deleteDialogRecord);
}

async function loadData() {
  content.innerHTML = '<div class="loading">Ładowanie danych…</div>';
  try {
    const query = `?controller=${encodeURIComponent(state.controller)}`;
    [state.dashboard, state.status, state.tasks, state.points, state.notes] = await Promise.all([
      api(`/api/dashboard${query}`),
      api(`/api/status${query}`),
      api(`/api/tasks${query}`),
      api(`/api/open-points${query}`),
      api(`/api/daily-notes${query}`)
    ]);
    connection.className = 'connection online';
    connection.innerHTML = '<span class="connection-dot"></span><span>Połączono</span>';
    updateCounts();
    render();
  } catch (error) {
    connection.className = 'connection error';
    connection.innerHTML = '<span class="connection-dot"></span><span>Brak połączenia</span>';
    showError(error);
  }
}

function setView(view) {
  state.view = view;
  document.querySelectorAll('.nav-button').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  render();
}

function render() {
  const [title, description, action] = pageCopy[state.view];
  document.querySelector('#page-title').textContent = title;
  document.querySelector('#page-description').textContent = description;
  addRecordButton.textContent = action;
  ({ status: renderStatus, tasks: renderTasks, points: renderPoints, notes: renderNotes })[state.view]();
}

function updateCounts() {
  document.querySelector('#nav-status-count').textContent = state.status.length;
  document.querySelector('#nav-tasks-count').textContent = state.tasks.filter(item => item.status !== 'Done').length;
  document.querySelector('#nav-points-count').textContent = state.points.filter(item => item.status !== 'Closed').length;
  document.querySelector('#nav-notes-count').textContent = state.notes.filter(item => item.note_date === today()).length;
}

function renderStatus() {
  const d = state.dashboard;
  content.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="stat-label">Postęp</div><div class="stat-value">${d.progress || 0}%</div><div class="progress-track"><div class="progress-fill" style="width:${d.progress || 0}%"></div></div></div>
      <div class="stat"><div class="stat-label">Gotowe</div><div class="stat-value">${d.done || 0} / ${d.total || 0}</div></div>
      <div class="stat"><div class="stat-label">W toku</div><div class="stat-value">${d.inProgress || 0}</div></div>
      <div class="stat"><div class="stat-label">Zablokowane / NOK</div><div class="stat-value">${d.blocked || 0}</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><strong>Lista testów</strong><input id="status-search" type="search" placeholder="Szukaj testu lub stacji"><select id="status-filter"><option value="">Wszystkie statusy</option>${['Not started','Ready to test','In progress','Blocked','NOK / Rework','Retest required','Done','N/A'].map(value => `<option value="${value}">${escapeHtml((badgeMap[value] || [value])[0])}</option>`).join('')}</select></div>
      <div class="table-wrap"><table><thead><tr><th>Stacja / test</th><th>Sterownik</th><th>Status</th><th>Krytyczność</th><th>Odpowiedzialny</th><th>Milestone</th></tr></thead><tbody id="status-table-body"></tbody></table></div>
    </div>`;
  const renderRows = () => {
    const phrase = document.querySelector('#status-search').value.trim().toLowerCase();
    const filter = document.querySelector('#status-filter').value;
    const rows = state.status.filter(item => {
      const text = [item.test_id, item.station, item.function_detail, item.category, item.responsible].join(' ').toLowerCase();
      return (!phrase || text.includes(phrase)) && (!filter || item.status === filter);
    });
    document.querySelector('#status-table-body').innerHTML = rows.length ? rows.map(item => `
      <tr data-edit="${item.id}"><td class="cell-title">${escapeHtml(item.station)} · ${escapeHtml(item.function_detail)}<span class="cell-subtitle">${escapeHtml(item.test_id)} · ${escapeHtml(item.category)}</span></td><td>${escapeHtml(item.controller)}</td><td>${badge(item.status)}</td><td>${badge(item.criticality)}</td><td>${escapeHtml(item.responsible || '—')}</td><td>${escapeHtml(item.milestone || '—')}</td></tr>`).join('') : '<tr><td colspan="6"><div class="empty-state">Brak testów dla wybranego filtra.</div></td></tr>';
    document.querySelectorAll('#status-table-body [data-edit]').forEach(row => row.addEventListener('click', () => openDialog('status', state.status.find(item => item.id === Number(row.dataset.edit)))));
  };
  document.querySelector('#status-search').addEventListener('input', renderRows);
  document.querySelector('#status-filter').addEventListener('change', renderRows);
  renderRows();
}

function renderTasks() {
  const lanes = [['To do', 'Do zrobienia'], ['In progress', 'W toku'], ['Done', 'Zakończone']];
  content.innerHTML = `<div class="task-board">${lanes.map(([status, label]) => {
    const items = state.tasks.filter(item => item.status === status);
    return `<section class="task-lane"><div class="lane-title">${label}<span>${items.length}</span></div>${items.length ? items.map(task => `
      <button type="button" class="task-card" data-edit="${task.id}"><strong>${escapeHtml(task.title)}</strong><p>${escapeHtml(task.station || task.controller)}${task.description ? ` · ${escapeHtml(task.description)}` : ''}</p><div class="card-foot"><span>${escapeHtml(task.owner || 'Bez właściciela')}</span><span>${task.due_date ? displayDate(task.due_date) : badge(task.priority)}</span></div></button>`).join('') : '<div class="empty-state">Brak zadań</div>'}</section>`;
  }).join('')}</div>`;
  document.querySelectorAll('.task-card[data-edit]').forEach(card => card.addEventListener('click', () => openDialog('tasks', state.tasks.find(item => item.id === Number(card.dataset.edit)))));
}

function renderPoints() {
  const openItems = state.points.filter(item => item.status !== 'Closed');
  content.innerHTML = `<div class="point-list">${openItems.length ? openItems.map(point => `
    <button type="button" class="point-card" data-edit="${point.id}"><span class="priority-bar ${point.priority === 'Critical' ? 'critical' : point.priority === 'Low' ? 'low' : ''}"></span><span><strong>${escapeHtml(point.issue_id)} · ${escapeHtml(point.title)}</strong><p>${escapeHtml(point.impact || point.description || 'Brak opisu')}${point.waiting_for ? ` · Oczekujemy na: ${escapeHtml(point.waiting_for)}` : ''}</p></span><span class="point-side">${escapeHtml(point.owner || 'Bez właściciela')}<br>${badge(point.status)} ${point.due_date ? displayDate(point.due_date) : ''}</span></button>`).join('') : '<div class="empty-state">Brak otwartych punktów.</div>'}</div>`;
  document.querySelectorAll('.point-card[data-edit]').forEach(card => card.addEventListener('click', () => openDialog('points', state.points.find(item => item.id === Number(card.dataset.edit)))));
}

function renderNotes() {
  const defaultController = state.controller === 'all' ? (state.controllers[0]?.code || '') : state.controller;
  content.innerHTML = `
    <div class="notes-layout">
      <section class="panel"><div class="panel-head"><strong>Ostatnie wpisy</strong><span class="badge blue">${state.notes.length}</span></div><div class="note-list">${state.notes.length ? state.notes.map(note => `
        <article class="note-row" data-edit="${note.id}"><div class="note-meta">${displayDate(note.note_date)}<br>${escapeHtml(note.controller || 'Ogólne')} · ${escapeHtml(note.shift)}<br>${escapeHtml(note.author)}</div><div><strong>${escapeHtml(typeLabel(note.type))}</strong><p>${escapeHtml(note.content)}</p></div></article>`).join('') : '<div class="empty-state">Brak notatek dla wybranego sterownika.</div>'}</div></section>
      <section class="panel"><div class="panel-head"><strong>Dodaj notatkę</strong></div><form id="quick-note-form" class="note-form">
        <div class="field"><label for="quick-note-controller">Sterownik</label><select id="quick-note-controller" name="controller" required>${controllerOptions(defaultController)}</select></div>
        <div class="field"><label for="quick-note-date">Data</label><input id="quick-note-date" name="note_date" type="date" value="${today()}" required></div>
        <div class="field"><label for="quick-note-shift">Zmiana</label><select id="quick-note-shift" name="shift"><option>Shift 1</option><option>Shift 2</option><option>Shift 3</option><option>General</option></select></div>
        <div class="field"><label for="quick-note-author">Autor</label><input id="quick-note-author" name="author" required placeholder="Imię i nazwisko"></div>
        <div class="field"><label for="quick-note-type">Typ</label><select id="quick-note-type" name="type"><option value="Progress">Postęp</option><option value="Problem">Problem / blokada</option><option value="Decision">Decyzja</option><option value="Plan">Plan</option></select></div>
        <div class="field"><label for="quick-note-content">Treść</label><textarea id="quick-note-content" name="content" required placeholder="Co zrobiono, jaki jest efekt i co dalej?"></textarea></div>
        <button class="primary-button" type="submit">Zapisz notatkę</button>
      </form></section>
    </div>`;
  document.querySelector('#quick-note-form').addEventListener('submit', saveQuickNote);
  document.querySelectorAll('.note-row[data-edit]').forEach(row => row.addEventListener('click', () => openDialog('notes', state.notes.find(item => item.id === Number(row.dataset.edit)))));
}

function typeLabel(type) {
  return ({ Progress:'Postęp prac', Problem:'Problem / blokada', Decision:'Decyzja', Plan:'Plan na kolejną zmianę' })[type] || type;
}

async function saveQuickNote(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    await api('/api/daily-notes', { method: 'POST', body: JSON.stringify(data) });
    showToast('Notatka została zapisana.');
    await loadData();
  } catch (error) { showToast(error.message, true); }
}

function controllerOptions(selected) {
  return state.controllers.map(item => `<option value="${escapeHtml(item.code)}"${item.code === selected ? ' selected' : ''}>${escapeHtml(item.code)}</option>`).join('');
}

function openDialog(view, record = null) {
  if (view === 'notes' && !record) {
    document.querySelector('#quick-note-content')?.focus();
    return;
  }
  const config = forms[view];
  state.dialog = { view, record };
  document.querySelector('#dialog-title').textContent = record ? `Edytuj ${config.title}` : `Dodaj ${config.title}`;
  document.querySelector('#dialog-subtitle').textContent = record ? `Rekord ${record.test_id || record.issue_id || record.id}` : 'Uzupełnij tylko informacje potrzebne zespołowi.';
  deleteButton.classList.toggle('hidden', !record);
  dialogFields.innerHTML = '';
  config.fields.forEach(definition => dialogFields.appendChild(createField(definition, record)));
  dialog.showModal();
}

function createField(definition, record) {
  const wrapper = document.createElement('div');
  wrapper.className = `field${definition.full ? ' full' : ''}`;
  const label = document.createElement('label');
  const id = `field-${definition.name}`;
  label.htmlFor = id;
  label.textContent = definition.label;
  let input;
  const value = record?.[definition.name] ?? defaultValue(definition.name);
  if (definition.type === 'select' || definition.type === 'controller') {
    input = document.createElement('select');
    const options = definition.type === 'controller' ? state.controllers.map(item => item.code) : definition.options;
    options.forEach(optionValue => {
      const option = document.createElement('option');
      option.value = optionValue;
      option.textContent = optionLabel(optionValue);
      option.selected = optionValue === value;
      input.appendChild(option);
    });
    if (definition.type === 'controller' && record) input.disabled = true;
  } else if (definition.type === 'textarea') {
    input = document.createElement('textarea');
    input.value = value;
  } else {
    input = document.createElement('input');
    input.type = definition.type;
    input.value = value;
  }
  input.id = id;
  input.name = definition.name;
  input.required = definition.required;
  input.placeholder = definition.placeholder;
  wrapper.append(label, input);
  return wrapper;
}

function defaultValue(name) {
  if (name === 'controller') return state.controller === 'all' ? (state.controllers[0]?.code || '') : state.controller;
  if (name === 'note_date') return today();
  const defaults = { criticality:'Medium', priority:'Medium', status: state.view === 'tasks' ? 'To do' : state.view === 'points' ? 'Open' : 'Not started', shift:'Shift 1', type:'Progress' };
  return defaults[name] || '';
}

function optionLabel(value) {
  const labels = { Low:'Niski', Medium:'Średni', High:'Wysoki', Critical:'Krytyczny', 'Not started':'Nie rozpoczęto', 'Ready to test':'Gotowe do testu', 'In progress':'W toku', Blocked:'Zablokowane', 'NOK / Rework':'NOK / poprawa', 'Retest required':'Wymagany retest', Done:'Gotowe', 'To do':'Do zrobienia', Open:'Otwarte', Waiting:'Oczekuje', Closed:'Zamknięte', 'Shift 1':'Zmiana 1', 'Shift 2':'Zmiana 2', 'Shift 3':'Zmiana 3', General:'Ogólne', Progress:'Postęp', Problem:'Problem / blokada', Decision:'Decyzja', Plan:'Plan' };
  return labels[value] || value;
}

async function saveDialogRecord(event) {
  event.preventDefault();
  const { view, record } = state.dialog;
  const config = forms[view];
  const data = Object.fromEntries(new FormData(dialogForm));
  if (record?.controller) data.controller = record.controller;
  const path = record ? `${config.endpoint}/${record.id}` : config.endpoint;
  try {
    await api(path, { method: record ? 'PATCH' : 'POST', body: JSON.stringify(data) });
    dialog.close();
    showToast(record ? 'Zmiany zostały zapisane.' : 'Rekord został dodany.');
    await loadData();
  } catch (error) { showToast(error.message, true); }
}

async function deleteDialogRecord() {
  const { view, record } = state.dialog || {};
  if (!record) return;
  if (!window.confirm('Usunąć ten rekord? Tej operacji nie można cofnąć.')) return;
  try {
    await api(`${forms[view].endpoint}/${record.id}`, { method: 'DELETE' });
    dialog.close();
    showToast('Rekord został usunięty.');
    await loadData();
  } catch (error) { showToast(error.message, true); }
}

function showToast(message, error = false) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  toast.className = `toast show${error ? ' error' : ''}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.className = 'toast'; }, 3200);
}

function showError(error) {
  content.innerHTML = `<div class="error-state">${escapeHtml(error.message || 'Nie udało się pobrać danych.')}</div>`;
  showToast(error.message || 'Nie udało się pobrać danych.', true);
}

initialize();
