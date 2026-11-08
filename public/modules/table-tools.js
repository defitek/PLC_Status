/**
 * Shared table behavior for Status, Tasks and Open points.
 * UI and application callbacks are injected to keep this module independent from view modules.
 */
export function createTableTools(dependencies) {
  const { state, $, $$, escapeHtml, badgeMap, api, uiForm, uiConfirm, toast, drawStatusRows, drawTaskListRows, drawPointRows, renderOperations, renderTasks, drawTasks, render } = dependencies;

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

  function uniqueValues(rows, key, csv = false) {
    const values = rows.flatMap(row => {
      const value = row[key];
      if (Array.isArray(value)) return value;
      return csv ? String(value || '').split(',').map(item => item.trim()) : [value];
    }).filter(value => value !== null && value !== undefined && String(value).trim());
    return [...new Set(values.map(String))].sort((a, b) => a.localeCompare(b, 'pl', { numeric: true, sensitivity: 'base' }));
  }

  function hierarchyFilterOptions() {
    const values = [];
    for (const group of state.controllerGroups) {
      values.push({ value: `group:${group.id}`, label: `${'  '.repeat(Math.max(0, Number(group.depth || 1) - 1))}▰ ${group.path_label || group.name}` });
      state.controllers.filter(item => Number(item.group_id) === Number(group.id)).forEach(item => values.push({ value: `controller:${item.code}`, label: `${'  '.repeat(Number(group.depth || 1))}◇ ${item.display_name || item.code}` }));
    }
    state.controllers.filter(item => !item.group_id).forEach(item => values.push({ value: `controller:${item.code}`, label: `◇ ${item.display_name || item.code}` }));
    return values;
  }

  function multiFilterControl(key, values, label = 'Wszystkie', kind = 'multi') {
    const items = values.map(item => typeof item === 'object' ? item : { value: item, label: item });
    return `<details class="table-filter-menu" data-filter-kind="${kind}" data-filter-key="${escapeHtml(key)}" data-filter-label="${escapeHtml(label)}"><summary data-filter-summary>${escapeHtml(label)}</summary><div class="table-filter-options"><div class="filter-actions"><button type="button" class="filter-select-all" data-filter-select-all>Zaznacz wszystko</button><button type="button" class="filter-clear" data-filter-clear>Wyczyść</button></div>${items.map(item => `<label><input type="checkbox" value="${escapeHtml(item.value)}"> <span>${escapeHtml(badgeMap[item.label]?.[0] || item.label)}</span></label>`).join('') || '<span class="filter-empty">Brak wartości</span>'}</div></details>`;
  }

  function tableFilterRow(columns) {
    return `<tr class="filters">${columns.map(column => {
      let control = '';
      if (column.filter !== false) {
        if (column.filter === 'hierarchy') control = multiFilterControl(column.key, hierarchyFilterOptions(), `${column.label} · cała hierarchia`, 'hierarchy');
        else if (column.filter === 'number') control = `<div class="range-filter number-filter" data-filter-kind="number" data-filter-key="${column.key}"><select data-filter-mode><option value="between">Od–do</option><option value="gt">Powyżej</option><option value="lt">Poniżej</option><option value="eq">Równe</option></select><input type="number" min="0" max="100" step="1" data-filter-min placeholder="Od"><input type="number" min="0" max="100" step="1" data-filter-max placeholder="Do"></div>`;
        else if (column.filter === 'date') control = `<div class="range-filter date-filter" data-filter-kind="date" data-filter-key="${column.key}"><select data-filter-mode><option value="from">Od daty (≥)</option><option value="to">Do daty (≤)</option><option value="on">Dokładnie</option></select><input type="date" data-filter-date></div>`;
        else if (column.values) control = multiFilterControl(column.key, column.values, `${column.label} · wszystkie`);
        else control = `<input data-filter-text="${column.key}" placeholder="Filtruj…">`;
      }
      return `<th data-column="${column.key}">${control}</th>`;
    }).join('')}</tr>`;
  }

  function hierarchyControllerCodes(value) {
    const [kind, raw] = String(value || '').split(':');
    if (kind === 'controller') return new Set([raw]);
    if (kind !== 'group') return new Set();
    const rootId = Number(raw);
    const groupIds = new Set([rootId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const group of state.controllerGroups) if (groupIds.has(Number(group.parent_id)) && !groupIds.has(Number(group.id))) { groupIds.add(Number(group.id)); changed = true; }
    }
    return new Set(state.controllers.filter(item => groupIds.has(Number(item.group_id))).map(item => String(item.code)));
  }

  function rowControllerCodes(row) {
    if (row.controller_group_id) return hierarchyControllerCodes(`group:${row.controller_group_id}`);
    const code = row.controller || state.controllers.find(item => item.id === Number(row.controller_id))?.code;
    return code ? new Set([String(code)]) : new Set();
  }

  function selectedMultiValues(root, key) {
    return $$(`${root} [data-filter-key="${key}"] input[type="checkbox"]:checked`).map(input => input.value);
  }

  function filterRows(rows, root) {
    const textFilters = Object.fromEntries($$(`${root} [data-filter-text]`).map(input => [input.dataset.filterText, input.value.trim().toLowerCase()]));
    const widgets = $$(`${root} [data-filter-kind][data-filter-key]`);
    return rows.filter(row => {
      if (!Object.entries(textFilters).every(([key, value]) => {
        if (!value) return true;
        const source = key === '_all' ? JSON.stringify(row) : key === 'title' ? [row.title, row.description].join(' ') : row[key];
        return String(source ?? '').toLowerCase().includes(value);
      })) return false;
      for (const widget of widgets) {
        const key = widget.dataset.filterKey;
        const kind = widget.dataset.filterKind;
        if (kind === 'multi') {
          const selected = [...widget.querySelectorAll('input:checked')].map(input => input.value.toLowerCase());
          if (!selected.length) continue;
          const tokens = (Array.isArray(row[key]) ? row[key] : String(row[key] || '').split(',')).map(value => String(value).trim().toLowerCase()).filter(Boolean);
          if (!selected.some(value => tokens.includes(value))) return false;
        } else if (kind === 'hierarchy') {
          const selected = [...widget.querySelectorAll('input:checked')].map(input => input.value);
          if (!selected.length) continue;
          const rowCodes = rowControllerCodes(row);
          if (!selected.some(value => [...hierarchyControllerCodes(value)].some(code => rowCodes.has(code)))) return false;
        } else if (kind === 'number') {
          const minInput = widget.querySelector('[data-filter-min]').value;
          const maxInput = widget.querySelector('[data-filter-max]').value;
          if (minInput === '' && maxInput === '') continue;
          const value = Number(row[key]); const min = Number(minInput); const max = Number(maxInput); const mode = widget.querySelector('[data-filter-mode]').value;
          if (!Number.isFinite(value)) return false;
          if (mode === 'between' && ((minInput !== '' && value < min) || (maxInput !== '' && value > max))) return false;
          if (mode === 'gt' && minInput !== '' && value <= min) return false;
          if (mode === 'lt' && minInput !== '' && value >= min) return false;
          if (mode === 'eq' && minInput !== '' && value !== min) return false;
        } else if (kind === 'date') {
          const target = widget.querySelector('[data-filter-date]').value;
          if (!target) continue;
          const value = String(row[key] || '').slice(0, 10); const mode = widget.querySelector('[data-filter-mode]').value;
          if (!value || (mode === 'from' && value < target) || (mode === 'to' && value > target) || (mode === 'on' && value !== target)) return false;
        }
      }
      return true;
    });
  }

  function updateFilterSummaries(root) {
    $$(`${root} details[data-filter-kind]`).forEach(widget => {
      const checked = [...widget.querySelectorAll('input:checked')];
      const summary = widget.querySelector('[data-filter-summary]');
      if (!summary) return;
      const label = widget.dataset.filterLabel || (widget.dataset.filterKind === 'hierarchy' ? 'Cała hierarchia' : 'Wszystkie');
      summary.textContent = checked.length ? (checked.length === 1 ? checked[0].closest('label')?.textContent.trim() : `${label.split(' · ')[0]} · ${checked.length} wybrane`) : label;
    });
  }

  function bindTableFilters(root, redraw) {
    $$(`${root} details.table-filter-menu`).forEach(menu => menu.addEventListener('toggle', () => {
      if (!menu.open) return;
      document.querySelectorAll('details.table-filter-menu[open]').forEach(other => { if (other !== menu) other.open = false; });
      const rect = menu.querySelector('summary').getBoundingClientRect();
      const width = Math.max(230, Math.min(330, rect.width));
      menu.style.setProperty('--filter-popup-left', `${Math.max(8, Math.min(innerWidth - width - 8, rect.left))}px`);
      menu.style.setProperty('--filter-popup-top', `${Math.min(innerHeight - 220, rect.bottom + 4)}px`);
      menu.style.setProperty('--filter-popup-width', `${width}px`);
    }));
    $$(`${root} [data-filter-text], ${root} [data-filter-min], ${root} [data-filter-max], ${root} [data-filter-date]`).forEach(input => input.addEventListener('input', redraw));
    $$(`${root} [data-filter-kind] input[type="checkbox"], ${root} [data-filter-mode]`).forEach(input => input.addEventListener('change', () => { updateFilterSummaries(root); const widget = input.closest('[data-filter-kind="number"]'); if (widget) widget.classList.toggle('single-value', input.value !== 'between'); redraw(); }));
    $$(`${root} [data-filter-clear]`).forEach(button => button.addEventListener('click', event => { event.preventDefault(); const widget = button.closest('[data-filter-kind]'); widget.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = false; }); updateFilterSummaries(root); redraw(); }));
    $$(`${root} [data-filter-select-all]`).forEach(button => button.addEventListener('click', event => { event.preventDefault(); const widget = button.closest('[data-filter-kind]'); widget.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = true; }); updateFilterSummaries(root); redraw(); }));
    $$(`${root} [data-clear-filters]`).forEach(button => button.addEventListener('click', () => { $$(`${root} input[data-filter-text], ${root} input[data-filter-min], ${root} input[data-filter-max], ${root} input[data-filter-date]`).forEach(input => { input.value = ''; }); $$(`${root} [data-filter-kind] input[type="checkbox"]`).forEach(input => { input.checked = false; }); updateFilterSummaries(root); redraw(); }));
    updateFilterSummaries(root);
  }

  function applyGroupedColumnVisibility(root, grouping, columns) {
    const module = root.includes('status') ? 'status' : root.includes('task') ? 'tasks' : 'points';
    const hidden = state.hiddenColumns[module] || new Set();
    const visibleColumns = columns.map(column => column.key);
    for (const key of visibleColumns) $$(`${root} [data-column="${key}"]`).forEach(cell => { cell.hidden = hidden.has(key) || Boolean(grouping && key === grouping); });
    return Math.max(1, visibleColumns.filter(key => !hidden.has(key) && (!grouping || key !== grouping)).length);
  }

  function columnVisibilityControl(module, columns) {
    const hidden = state.hiddenColumns[module] || new Set();
    const visible = columns.filter(column => !hidden.has(column.key)).length;
    return `<details class="multi-user-select column-picker"><summary>Kolumny · ${visible}/${columns.length}</summary><div><div class="column-picker-actions"><button type="button" class="filter-select-all" data-column-select-all>Zaznacz wszystko</button><button type="button" class="filter-clear" data-column-clear>Wyczyść</button></div>${columns.map(column => `<label><input type="checkbox" data-column-toggle="${column.key}" ${hidden.has(column.key) ? '' : 'checked'}><span>${escapeHtml(column.label)}</span></label>`).join('')}</div></details>`;
  }

  function bindColumnVisibility(root, module, columns, redraw) {
    const allowedKeys = new Set(columns.map(column => column.key));
    state.hiddenColumns[module] = new Set([...(state.hiddenColumns[module] || [])].filter(key => allowedKeys.has(key)));
    const syncPicker = picker => {
      const hidden = state.hiddenColumns[module] || new Set();
      const inputs = [...picker.querySelectorAll('[data-column-toggle]')];
      inputs.forEach(input => { input.checked = !hidden.has(input.dataset.columnToggle); });
      picker.querySelector('summary').textContent = `Kolumny · ${inputs.filter(input => input.checked).length}/${inputs.length}`;
    };
    $$(`${root} [data-column-select-all]`).forEach(button => button.addEventListener('click', event => {
      event.preventDefault(); state.hiddenColumns[module] = new Set(); syncPicker(button.closest('.column-picker')); redraw();
    }));
    $$(`${root} [data-column-clear]`).forEach(button => button.addEventListener('click', event => {
      event.preventDefault(); state.hiddenColumns[module] = new Set(columns.slice(1).map(column => column.key)); syncPicker(button.closest('.column-picker')); redraw();
    }));
    $$(`${root} [data-column-toggle]`).forEach(input => input.addEventListener('change', () => {
      const hidden = state.hiddenColumns[module] || new Set();
      if (input.checked) hidden.delete(input.dataset.columnToggle); else hidden.add(input.dataset.columnToggle);
      if (hidden.size >= columns.length) { hidden.delete(input.dataset.columnToggle); input.checked = true; return toast('Co najmniej jedna kolumna musi pozostać widoczna.', true); }
      state.hiddenColumns[module] = hidden;
      syncPicker(input.closest('.column-picker'));
      redraw();
    }));
  }

  function savedViewsToolbar(module) {
    const rows = (state.savedViews || []).filter(item => item.module === module);
    return `<div class="saved-view-bar" data-saved-view-module="${module}"><span class="saved-view-label">Widok</span><select data-saved-view-select><option value="">Bieżące ustawienia</option>${rows.map(item => `<option value="${item.id}"${Number(state.activeSavedView[module]) === Number(item.id) ? ' selected' : ''}>${item.visibility === 'team' ? 'Zespół · ' : 'Mój · '}${escapeHtml(item.name)}</option>`).join('')}</select><button type="button" class="mini" data-saved-view-save>Zapisz widok</button><button type="button" class="mini" data-saved-view-delete ${state.activeSavedView[module] ? '' : 'disabled'}>Usuń</button></div>`;
  }

  function captureSavedView(module, root) {
    const selector = suffix => module === 'tasks' && root !== '#task-filter-bar' ? `${root} ${suffix}, #task-filter-bar ${suffix}` : `${root} ${suffix}`;
    const config = {
      grouping: state.grouping[module] || '',
      sort: state.sort[module] ? { ...state.sort[module] } : null,
      task_mode: module === 'tasks' ? state.taskMode : undefined,
      show_completed: module === 'tasks' ? state.taskShowCompleted : undefined,
      operations_tab: module === 'operations' ? state.operationsTab : undefined,
      search: module === 'tasks' ? ($('#task-search')?.value || '') : module === 'status' ? ($('#status-matrix-search')?.value || '') : '',
      status_function_group: module === 'status' ? ($('#status-function-group-filter')?.value || '') : undefined,
      status_group_by_function: module === 'status' ? state.statusGroupByFunction : undefined,
      hidden_columns: state.hiddenColumns[module] ? [...state.hiddenColumns[module]] : [],
      text: {}, filters: {}
    };
    $$(selector('[data-filter-text]')).forEach(input => { config.text[input.dataset.filterText] = input.value; });
    $$(selector('[data-filter-kind][data-filter-key]')).forEach(widget => {
      const key = widget.dataset.filterKey;
      if (widget.dataset.filterKind === 'multi' || widget.dataset.filterKind === 'hierarchy') config.filters[key] = { kind: widget.dataset.filterKind, values: [...widget.querySelectorAll('input:checked')].map(input => input.value) };
      else if (widget.dataset.filterKind === 'number') config.filters[key] = { kind: 'number', mode: widget.querySelector('[data-filter-mode]')?.value || 'between', min: widget.querySelector('[data-filter-min]')?.value || '', max: widget.querySelector('[data-filter-max]')?.value || '' };
      else if (widget.dataset.filterKind === 'date') config.filters[key] = { kind: 'date', mode: widget.querySelector('[data-filter-mode]')?.value || 'from', date: widget.querySelector('[data-filter-date]')?.value || '' };
    });
    return config;
  }

  function restoreSavedViewControls(config, module, root, redraw) {
    const selector = suffix => module === 'tasks' && root !== '#task-filter-bar' ? `${root} ${suffix}, #task-filter-bar ${suffix}` : `${root} ${suffix}`;
    const groupSelect = module === 'status' ? $('#status-group') : module === 'tasks' ? $('#task-group') : null;
    if (groupSelect && [...groupSelect.options].some(option => option.value === String(config.grouping || ''))) {
      groupSelect.value = config.grouping || '';
      state.grouping[module] = groupSelect.value;
    }
    if (config.sort && state.sort[module]) state.sort[module] = { key: config.sort.key || '', direction: Number(config.sort.direction) === -1 ? -1 : 1 };
    if (state.hiddenColumns[module]) {
      const available = new Set($$(`${root} [data-column-toggle]`).map(input => input.dataset.columnToggle));
      state.hiddenColumns[module] = new Set((config.hidden_columns || []).filter(key => !available.size || available.has(key)));
    }
    $$(`${root} [data-column-toggle]`).forEach(input => { input.checked = !state.hiddenColumns[module]?.has(input.dataset.columnToggle); });
    $$(`${root} .column-picker`).forEach(picker => { const inputs = [...picker.querySelectorAll('[data-column-toggle]')]; picker.querySelector('summary').textContent = `Kolumny · ${inputs.filter(input => input.checked).length}/${inputs.length}`; });
    if (module === 'tasks' && $('#task-search')) $('#task-search').value = config.search || '';
    if (module === 'status' && $('#status-matrix-search')) {
      $('#status-matrix-search').value = config.search || ''; state.statusMatrixQuery = config.search || '';
      state.statusFunctionGroupFilter = config.status_function_group || '';
      if ($('#status-function-group-filter')) $('#status-function-group-filter').value = state.statusFunctionGroupFilter;
      state.statusGroupByFunction = Boolean(config.status_group_by_function);
      $('#status-group-functional')?.classList.toggle('active-toggle', state.statusGroupByFunction);
      $('#status-group-functional')?.setAttribute('aria-pressed', String(state.statusGroupByFunction));
    }
    $$(selector('[data-filter-text]')).forEach(input => { input.value = config.text?.[input.dataset.filterText] || ''; });
    $$(selector('[data-filter-kind][data-filter-key]')).forEach(widget => {
      const saved = config.filters?.[widget.dataset.filterKey];
      if (!saved) return;
      if (['multi', 'hierarchy'].includes(widget.dataset.filterKind)) widget.querySelectorAll('input[type="checkbox"]').forEach(input => { input.checked = (saved.values || []).includes(input.value); });
      if (widget.dataset.filterKind === 'number') {
        if (widget.querySelector('[data-filter-mode]')) widget.querySelector('[data-filter-mode]').value = saved.mode || 'between';
        if (widget.querySelector('[data-filter-min]')) widget.querySelector('[data-filter-min]').value = saved.min || '';
        if (widget.querySelector('[data-filter-max]')) widget.querySelector('[data-filter-max]').value = saved.max || '';
      }
      if (widget.dataset.filterKind === 'date') {
        if (widget.querySelector('[data-filter-mode]')) widget.querySelector('[data-filter-mode]').value = saved.mode || 'from';
        if (widget.querySelector('[data-filter-date]')) widget.querySelector('[data-filter-date]').value = saved.date || '';
      }
    });
    updateFilterSummaries(root);
    if (module === 'tasks' && root !== '#task-filter-bar') updateFilterSummaries('#task-filter-bar');
    redraw();
  }

  function bindSavedViews(module, root, redraw) {
    const bar = document.querySelector(`[data-saved-view-module="${module}"]`);
    if (!bar) return;
    const select = bar.querySelector('[data-saved-view-select]');
    select.addEventListener('change', () => {
      const view = (state.savedViews || []).find(item => item.id === Number(select.value));
      state.activeSavedView[module] = view?.id || null;
      bar.querySelector('[data-saved-view-delete]').disabled = !view;
      if (!view) return;
      if (module === 'operations' && view.config?.operations_tab) {
        state.operationsTab = view.config.operations_tab;
        renderOperations();
        return;
      }
      if (module === 'tasks' && view.config?.task_mode && view.config.task_mode !== state.taskMode) {
        state.taskMode = view.config.task_mode;
        state.taskShowCompleted = Boolean(view.config.show_completed);
        renderTasks();
        queueMicrotask(() => restoreSavedViewControls(view.config, module, state.taskMode === 'list' ? '#task-list-panel' : '#task-filter-bar', drawTasks));
        return;
      }
      const applyRoot = module === 'tasks' && state.taskMode === 'list' ? '#task-list-panel' : root;
      restoreSavedViewControls(view.config || {}, module, applyRoot, redraw);
    });
    bar.querySelector('[data-saved-view-save]').addEventListener('click', async () => {
      const manager = ['system_admin', 'project_admin', 'moderator'].includes(state.me.role);
      const result = await uiForm({ title: 'Zapisz widok', description: 'Zapisz filtry, grupowanie i sortowanie, aby wracać do nich jednym kliknięciem.', submitLabel: 'Zapisz widok', fields: [
        { name: 'name', label: 'Nazwa widoku', required: true },
        { name: 'visibility', label: 'Dostępność', type: 'select', options: manager ? [{ value: 'personal', label: 'Tylko dla mnie' }, { value: 'team', label: 'Dla całego zespołu' }] : [{ value: 'personal', label: 'Tylko dla mnie' }] },
        { name: 'is_default', label: 'Ustaw jako mój domyślny widok', type: 'checkbox' }
      ] });
      if (!result) return;
      try {
        const configRoot = module === 'tasks' && state.taskMode === 'list' ? '#task-list-panel' : root;
        const saved = await api('/api/saved-views', { method: 'POST', body: JSON.stringify({ module, name: result.name, visibility: result.visibility, is_default: result.is_default ? 1 : 0, config: captureSavedView(module, configRoot) }) });
        state.savedViews = await api('/api/saved-views'); state.activeSavedView[module] = saved.id; toast('Widok został zapisany'); render();
      } catch (error) { toast(error.message, true); }
    });
    bar.querySelector('[data-saved-view-delete]').addEventListener('click', async () => {
      const id = Number(select.value); if (!id) return;
      if (!await uiConfirm('Usuń zapisany widok', 'Usunięcie nie zmieni danych projektu.', 'Usuń', true)) return;
      try { await api(`/api/saved-views/${id}`, { method: 'DELETE' }); state.savedViews = await api('/api/saved-views'); state.activeSavedView[module] = null; toast('Widok został usunięty'); render(); }
      catch (error) { toast(error.message, true); }
    });
    const preferred = (state.savedViews || []).find(item => item.module === module && item.is_default && Number(item.owner_user_id) === Number(state.me.id));
    if (!state.activeSavedView[module] && preferred) {
      state.activeSavedView[module] = preferred.id;
      select.value = String(preferred.id);
      queueMicrotask(() => select.dispatchEvent(new Event('change')));
    }
  }

  return { sortRows, updateSort, sortMarker, uniqueValues, hierarchyFilterOptions, multiFilterControl, tableFilterRow, hierarchyControllerCodes, rowControllerCodes, filterRows, bindTableFilters, applyGroupedColumnVisibility, columnVisibilityControl, bindColumnVisibility, savedViewsToolbar, bindSavedViews };
}
