import { createWorkbook } from './xlsx.js';

const dateTime = value => value ? String(value).replace('T', ' ').replace('Z', '') : '';
const linkText = links => (links || []).map(link => `${link.entity_type} #${link.entity_id}${link.status ? ` (${link.status})` : ''}`).join(', ');
const percent = (done, total) => total ? Math.round(Number(done || 0) * 100 / Number(total)) : 0;

function filterAndSort(rows, options = {}) {
  let result = [...rows];
  for (const [key, raw] of Object.entries(options.filters || {})) {
    const expected = String(raw ?? '').trim().toLocaleLowerCase('pl');
    if (!expected) continue;
    result = result.filter(row => String(row[key] ?? '').toLocaleLowerCase('pl').includes(expected));
  }
  const key = options.sort_key;
  if (key) {
    const direction = options.sort_direction === 'desc' ? -1 : 1;
    result.sort((left, right) => String(left[key] ?? '').localeCompare(String(right[key] ?? ''), 'pl', { numeric: true, sensitivity: 'base' }) * direction);
  }
  return result;
}

const statusColumns = [
  ['test_id', 'ID punktu', 18], ['controller', 'Sterownik', 14], ['function_group_name', 'Grupa funkcyjna', 22],
  ['function_group_subcategory_name', 'Podkategoria grupy', 22], ['function_group_element_name', 'Element grupy', 20],
  ['category', 'Kategoria', 20], ['subcategory', 'Podkategoria', 24],
  ['status', 'Status', 18], ['related_work_progress', 'Prace powiązane [%]', 19], ['criticality', 'Krytyczność', 15],
  ['responsible_name', 'Odpowiedzialny', 22], ['checked_by', 'Sprawdził', 20], ['checked_on', 'Data sprawdzenia', 16],
  ['function_detail', 'Test / funkcja', 42], ['current_note', 'Notatka', 46], ['links_text', 'Powiązania', 34],
  ['evidence_link', 'Dowód / link', 34], ['created_by_name', 'Utworzone przez', 22], ['created_at', 'Data utworzenia', 20], ['updated_at', 'Aktualizacja', 20]
];
const taskColumns = [
  ['title', 'Zadanie', 36], ['controller', 'Sterownik', 14], ['function_group_name', 'Grupa funkcyjna', 22],
  ['function_group_element_name', 'Element grupy', 20], ['other_object', 'Inne', 20], ['category', 'Kategoria', 20],
  ['subcategory', 'Podkategoria', 22], ['status', 'Status', 16], ['priority', 'Priorytet', 14],
  ['owner_name', 'Odpowiedzialny', 22], ['start_date', 'Planowany start', 16], ['due_date', 'Deadline', 16],
  ['checklist_progress', 'Postęp ważony', 18], ['description', 'Opis', 45], ['info_link', 'Informacje / link', 34],
  ['links_text', 'Powiązania', 34], ['created_by_name', 'Utworzone przez', 22], ['created_at', 'Data utworzenia', 20], ['updated_at', 'Aktualizacja', 20]
];
const pointColumns = [
  ['issue_id', 'ID punktu', 18], ['title', 'Otwarty punkt', 36], ['controller', 'Sterownik', 14], ['category', 'Kategoria', 20],
  ['subcategory', 'Podkategoria', 22], ['status', 'Status', 16], ['priority', 'Priorytet', 14], ['owner_name', 'Odpowiedzialny', 22],
  ['waiting_for', 'Oczekiwanie na', 22], ['next_action', 'Następny krok', 36], ['start_date', 'Planowany start', 16],
  ['due_date', 'Deadline', 16], ['reminder_date', 'Przypomnienie', 16], ['description', 'Opis', 45], ['impact', 'Wpływ', 34],
  ['info_link', 'Informacje / link', 34], ['links_text', 'Powiązania', 34], ['created_by_name', 'Utworzone przez', 22],
  ['created_at', 'Data utworzenia', 20], ['updated_at', 'Aktualizacja', 20]
];

const cols = definitions => definitions.map(([key, label, width]) => ({ key, label, width }));
const enrich = rows => rows.map(row => ({ ...row, links_text: linkText(row.links), created_at: dateTime(row.created_at), updated_at: dateTime(row.updated_at) }));

function taskRows(rows) {
  return enrich(rows).map(row => {
    const total = row.checklist?.length || 0;
    const done = row.checklist?.filter(item => item.done).length || 0;
    const progress = Number.isFinite(Number(row.progress)) ? Number(row.progress) : percent(done, total);
    return { ...row, checklist_progress: total ? `${progress}% · ${done}/${total} podzadań` : `${progress}%` };
  });
}

function statusSummary(rows, level) {
  const keyFor = row => level === 'controller' ? [row.controller] : level === 'category' ? [row.controller, row.category] : [row.controller, row.function_group_name || 'Bez grupy'];
  const groups = new Map();
  for (const row of rows) {
    const parts = keyFor(row);
    const key = JSON.stringify(parts);
    if (!groups.has(key)) groups.set(key, { controller: parts[0], group: parts[1] || '', total: 0, done: 0, in_progress: 0, blocked: 0, related_total: 0, related_done: 0 });
    const item = groups.get(key);
    item.total += 1;
    item.done += row.status === 'Done' ? 1 : 0;
    item.in_progress += row.status === 'In progress' ? 1 : 0;
    item.blocked += ['Blocked', 'NOK / Rework'].includes(row.status) ? 1 : 0;
    item.related_total += Number(row.related_work_total || 0);
    item.related_done += Number(row.related_work_done || 0);
  }
  return [...groups.values()].map(item => ({
    ...item, progress: percent(item.done, item.total), related_progress: percent(item.related_done, item.related_total)
  }));
}

export function statusWorkbook(rows, project, options = {}) {
  const filtered = filterAndSort(rows, options);
  const level = options.detail_level || 'detailed';
  const subtitle = `${project.code} · ${project.name} · wygenerowano ${new Date().toLocaleString('pl-PL', { timeZone: 'UTC' })} UTC`;
  let sheet;
  if (level === 'detailed') {
    const requested = Array.isArray(options.columns) && options.columns.length ? new Set(options.columns) : null;
    const definitions = requested ? statusColumns.filter(([key]) => requested.has(key)) : statusColumns;
    sheet = { name: 'Status', title: 'Status projektu — widok szczegółowy', subtitle, columns: cols(definitions), rows: enrich(filtered) };
  } else {
    const grouped = statusSummary(filtered, level);
    const groupLabel = level === 'category' ? 'Kategoria' : level === 'function_group' ? 'Grupa funkcyjna' : 'Zakres';
    sheet = {
      name: 'Status', title: `Status projektu — ${level === 'controller' ? 'sterowniki' : groupLabel.toLocaleLowerCase('pl')}`, subtitle,
      columns: cols([['controller', 'Sterownik', 18], ['group', groupLabel, 26], ['total', 'Liczba punktów', 16], ['done', 'Gotowe', 12], ['progress', 'Realizacja [%]', 16], ['in_progress', 'W trakcie', 14], ['blocked', 'Blokady / NOK', 16], ['related_total', 'Prace powiązane', 17], ['related_progress', 'Prace ukończone [%]', 21]]),
      rows: grouped
    };
  }
  return createWorkbook([sheet], { title: `Status ${project.code}` });
}

export function openPointsWorkbook(rows, project, options = {}) {
  const filtered = enrich(filterAndSort(rows, options));
  const subtitle = `${project.code} · ${project.name} · zakres: ${options.scope_label || 'cały projekt'} · ${filtered.length} pozycji`;
  return createWorkbook([{ name: 'Otwarte punkty', title: 'Lista otwartych punktów', subtitle, columns: cols(pointColumns), rows: filtered }], { title: `Otwarte punkty ${project.code}` });
}

export function projectWorkbook(data, project) {
  const subtitle = `${project.code} · ${project.name} · eksport całego projektu · ${new Date().toLocaleString('pl-PL', { timeZone: 'UTC' })} UTC`;
  const overview = data.overview;
  const overviewRows = [
    { module: 'Status', total: overview.overall.status.total, completed: overview.overall.status.done, progress: overview.overall.status.progress, alerts: overview.overall.status.blocked },
    { module: 'Zadania', total: overview.overall.tasks.total, completed: overview.overall.tasks.done, progress: overview.overall.tasks.progress, alerts: overview.overall.tasks.overdue },
    { module: 'Otwarte punkty', total: overview.overall.points.total, completed: overview.overall.points.closed, progress: overview.overall.points.progress, alerts: overview.overall.points.reminders_overdue }
  ];
  const goalRows = enrich(data.goals).map(row => ({ ...row, links_text: linkText(row.links) }));
  const noteRows = enrich(data.notes).map(row => ({ ...row, links_text: linkText(row.links) }));
  return createWorkbook([
    { name: 'Podsumowanie', title: 'Podsumowanie zarządcze projektu', subtitle, columns: cols([['module', 'Moduł', 24], ['total', 'Wszystkie', 14], ['completed', 'Ukończone', 14], ['progress', 'Realizacja [%]', 16], ['alerts', 'Alarmy / blokady', 18]]), rows: overviewRows },
    { name: 'Status', title: 'Status uruchomienia', subtitle, columns: cols(statusColumns), rows: enrich(data.status) },
    { name: 'Zadania', title: 'Zadania projektu', subtitle, columns: cols(taskColumns), rows: taskRows(data.tasks) },
    { name: 'Cele', title: 'Cele projektu', subtitle, columns: cols([['title', 'Cel', 38], ['controller', 'Sterownik', 14], ['status', 'Status', 16], ['due_date', 'Deadline', 16], ['description', 'Opis', 50], ['links_text', 'Powiązane elementy', 42], ['created_by_name', 'Utworzone przez', 22], ['created_at', 'Data utworzenia', 20]]), rows: goalRows },
    { name: 'Otwarte punkty', title: 'Otwarte punkty projektu', subtitle, columns: cols(pointColumns), rows: enrich(data.points) },
    { name: 'Dziennik', title: 'Dziennik projektu', subtitle, columns: cols([['note_date', 'Data wpisu', 16], ['controller', 'Sterownik', 14], ['shift', 'Zmiana', 14], ['type', 'Typ', 18], ['author', 'Autor', 22], ['content', 'Treść', 60], ['links_text', 'Powiązania', 42], ['created_at', 'Data utworzenia', 20], ['updated_at', 'Aktualizacja', 20]]), rows: noteRows }
  ], { title: `Eksport projektu ${project.code}` });
}
