import { expect, test } from '@playwright/test';

async function login(page) {
  await page.addInitScript(() => sessionStorage.setItem(`daily-summary:1:${new Date().toISOString().slice(0, 10)}`, '1'));
  await page.goto('/login.html');
  await page.locator('input[name="username"]').fill('ui-admin');
  await page.locator('input[name="password"]').fill('ui-test-password');
  await page.locator('#login-submit').click();
  await page.waitForURL(url => !url.pathname.endsWith('/login.html'));
  const projectDialog = page.locator('#project-dialog');
  if (await projectDialog.isVisible().catch(() => false)) await projectDialog.locator('.project-option').first().click();
  await expect(page.locator('#content')).toBeVisible();
  const dailySummary = page.locator('#daily-summary-dialog');
  if (await dailySummary.isVisible().catch(() => false)) await page.locator('#daily-summary-close').click();
}

async function openView(page, view) {
  await page.locator(`[data-view="${view}"]`).evaluate(button => button.click());
  await expect(page.locator(`[data-view="${view}"]`)).toHaveClass(/active/);
  const titles = { status: 'Status', tasks: 'Praca · Zadania', operations: 'Priorytety i odprawy', announcements: 'Komunikacja', planner: 'Plan' };
  if (titles[view]) await expect(page.locator('#title')).toHaveText(titles[view]);
  await expect(page.locator('#content .loading')).toHaveCount(0);
  const dailySummary = page.locator('#daily-summary-dialog');
  if (await dailySummary.isVisible().catch(() => false)) await page.locator('#daily-summary-close').click();
}

async function expectViewportContained(page) {
  const overflow = await page.evaluate(() => ({
    body: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    dialogs: [...document.querySelectorAll('dialog[open]')].map(dialog => {
      const box = dialog.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: innerWidth, height: innerHeight };
    })
  }));
  expect(overflow.body).toBeLessThanOrEqual(2);
  for (const dialog of overflow.dialogs) {
    expect(dialog.left).toBeGreaterThanOrEqual(-1);
    expect(dialog.right).toBeLessThanOrEqual(dialog.width + 1);
    expect(dialog.top).toBeGreaterThanOrEqual(-1);
    expect(dialog.bottom).toBeLessThanOrEqual(dialog.height + 1);
  }
}

async function createRelatedData(page, suffix) {
  return page.evaluate(async testSuffix => {
    const request = async (path, options = {}) => {
      const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `${response.status} ${path}`);
      return body;
    };
    const controller = (await request('/api/controllers'))[0];
    const base = { hierarchy_target: `controller:${controller.code}`, status: 'To do', priority: 'Medium' };
    const source = await request('/api/tasks', { method: 'POST', body: JSON.stringify({ ...base, title: `Źródło nawigacji ${testSuffix}` }) });
    const dependent = await request('/api/tasks', { method: 'POST', body: JSON.stringify({ ...base, title: `Zadanie zależne ${testSuffix}`, dependency_refs: [{ entity_type: 'task', entity_id: source.id }] }) });
    const date = new Date().toISOString().slice(0, 10);
    const meeting = await request('/api/project-meetings', { method: 'POST', body: JSON.stringify({
      title: `Test układu odprawy ${testSuffix}`, period_from: date, period_to: date, status: 'open', scope: 'all',
      items: [{ entity_type: 'task', entity_id: dependent.id, objective: 'Kontynuacja', meeting_priority: '2', item_status: 'open' }]
    }) });
    return { source, dependent, meeting };
  }, suffix);
}

test.beforeEach(async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await login(page);
  page.__pageErrors = pageErrors;
});

test.afterEach(async ({ page }) => {
  expect(page.__pageErrors || []).toEqual([]);
});

test('uproszczona nawigacja łączy pracę, plan i komunikację', async ({ page }) => {
  const navigation = page.locator('#nav button[data-view]');
  await expect(navigation).toHaveCount(7);
  await expect(navigation.locator(':scope > span:nth-child(2)')).toHaveText(['Start', 'Status', 'Praca', 'Plan', 'Priorytety i odprawy', 'Komunikacja', 'Konfiguracja']);
  await expect(navigation.locator(':scope > .nav-icon > svg')).toHaveCount(7);
  await expect(page.locator('#top-news')).toHaveCount(0);
  await expect(page.locator('#daily-summary-open')).toHaveCount(0);
  await expect(page.locator('#notifications-dialog')).toHaveCount(0);
  await expect(page.locator('#daily-summary-dialog')).not.toBeVisible();
  await expect(page.locator('.start-shortcuts')).toContainText('Do działania');

  await openView(page, 'tasks');
  await expect(page.locator('.workspace-tabs')).toContainText('Zależności zewnętrzne');
  await expect(page.locator('.workspace-tabs')).toContainText('Kamienie milowe');
  await expect(page.locator('#task-queue-mode')).toHaveCount(0);

  await page.locator('[data-view="planner"]').evaluate(button => button.click());
  await expect(page.locator('.workspace-tabs')).toContainText('Kalendarz');
  await page.getByRole('button', { name: 'Kalendarz' }).click();
  await expect(page.locator('#title')).toHaveText('Plan · Kalendarz');

  await page.locator('[data-view="announcements"]').evaluate(button => button.click());
  await expect(page.locator('.workspace-tabs')).toContainText('Centrum wiadomości');
  await expect(page.locator('.message-center-section h2').first()).toHaveText('Do działania');
  await expect(page.getByRole('button', { name: 'Moje', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zespół', exact: true })).toBeVisible();
  await expect(page.locator('#digest-enabled')).toBeVisible();
  await expect(page.locator('#daily-summary-dialog')).not.toBeVisible();

  await page.getByRole('button', { name: 'Historia zmian', exact: true }).click();
  await expect(page.locator('#history-summary-open')).toHaveText('Podsumuj zakres');
  await expectViewportContained(page);
});

test('nagłówki, wyszukiwarka i karty Centrum wiadomości pozostają kompaktowe', async ({ page }) => {
  const searchAlignment = await page.evaluate(() => {
    const input = document.querySelector('#global-search').getBoundingClientRect();
    const icon = document.querySelector('.global-search-icon').getBoundingClientRect();
    const shortcut = document.querySelector('.global-search>kbd');
    const kbd = shortcut.getBoundingClientRect();
    return {
      iconOffset: Math.abs((input.top + input.height / 2) - (icon.top + icon.height / 2)),
      shortcutVisible: getComputedStyle(shortcut).display !== 'none',
      shortcutOffset: Math.abs((input.top + input.height / 2) - (kbd.top + kbd.height / 2)),
      headerHeight: document.querySelector('.pagehead').getBoundingClientRect().height
    };
  });
  expect(searchAlignment.iconOffset).toBeLessThanOrEqual(1.5);
  if (searchAlignment.shortcutVisible) expect(searchAlignment.shortcutOffset).toBeLessThanOrEqual(1.5);
  expect(searchAlignment.headerHeight).toBeLessThanOrEqual(46);

  await openView(page, 'announcements');
  const summaryCards = page.locator('.message-center-summary>article');
  await expect(summaryCards).toHaveCount(4);
  const positions = await summaryCards.evaluateAll(cards => cards.map(card => {
    const box = card.getBoundingClientRect(); return { top: box.top, height: box.height };
  }));
  if ((await page.viewportSize()).width >= 1100) {
    expect(Math.max(...positions.map(item => item.top)) - Math.min(...positions.map(item => item.top))).toBeLessThanOrEqual(2);
    expect(Math.max(...positions.map(item => item.height))).toBeLessThanOrEqual(62);
  }
  await expectViewportContained(page);
});

test('zakładki Priorytetów są spójne, a samotna akcja mieści się w belce zakładek', async ({ page }) => {
  await openView(page, 'tasks');
  await page.getByRole('button', { name: 'Kamienie milowe', exact: true }).click();
  await expect(page.locator('.workspace-tabs [data-module-primary-action]')).toHaveText('+ Nowy kamień milowy');
  await expect(page.locator('.module-action-bar')).toHaveCount(0);
  const workspaceStyle = await page.locator('.workspace-tabs button.active').evaluate(element => {
    const style = getComputedStyle(element); return { background: style.backgroundColor, color: style.color, height: element.getBoundingClientRect().height };
  });
  await openView(page, 'operations');
  const operationsStyle = await page.locator('.operations-tabs button.active').evaluate(element => {
    const style = getComputedStyle(element); return { background: style.backgroundColor, color: style.color, height: element.getBoundingClientRect().height };
  });
  expect(operationsStyle.background).toBe(workspaceStyle.background);
  expect(operationsStyle.color).toBe(workspaceStyle.color);
  expect(Math.abs(operationsStyle.height - workspaceStyle.height)).toBeLessThanOrEqual(2);
});

test('Planner udostępnia transport, wolne i urlop w narzędziach oraz menu kontekstowym', async ({ page }) => {
  const transportCode = await page.evaluate(async () => {
    const users = await fetch('/api/users').then(response => response.json());
    const participant = users.find(user => user.system_role !== 'system_admin') || users[0];
    if (!participant) throw new Error('Brak użytkownika do testu Plannera');
    const response = await fetch(`/api/users/${participant.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_active: 1, planner_enabled: 1 }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się włączyć uczestnika Plannera');
    const code = `T${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const vehicleResponse = await fetch('/api/planner/vehicles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, registration_number: `UI ${Date.now()}` }) });
    if (!vehicleResponse.ok) throw new Error((await vehicleResponse.json()).error || 'Nie udało się dodać auta Plannera');
    return code;
  });
  await openView(page, 'planner');
  const transportNote = `Transport testowy ${transportCode}`;
  const workNote = `Praca testowa ${transportCode}`;
  const genericNote = `Wsparcie poza kalkulacją ${transportCode}`;
  await expect(page.locator('#planner-bulk-toolbar')).toBeHidden();
  await page.locator('#planner-tools-toggle').click();
  await expect(page.locator('#planner-bulk-toolbar')).toBeVisible();
  await expect(page.locator('#planner-bulk-transport')).toHaveText('+Transport');
  await expect(page.locator('#planner-bulk-remove')).toHaveCount(0);
  await expect(page.locator('#planner-bulk-time-off')).toHaveText('+ Wolne');
  await expect(page.locator('#planner-bulk-vacation')).toHaveText('+ Urlop');
  await expect(page.locator('#planner-bulk-approve')).toBeHidden();

  const cell = page.locator('.planner-cell[data-editable="1"]:not(.planned):not(.absent)').first();
  const userId = await cell.getAttribute('data-user-id');
  const date = await cell.getAttribute('data-date');
  await cell.click();
  await page.keyboard.press('t');
  await expect(page.locator('#action-title')).toHaveText(/Transport/);
  await expect(page.locator('#action-fields [name="controller_group_id"]')).toHaveCount(0);
  await expect(page.locator('#action-fields [name="shift"]')).toHaveCount(0);
  const transportVehicleValue = await page.locator('#action-fields [name="vehicle_id"] option').evaluateAll((options, code) => options.find(option => option.textContent.trim().startsWith(`${code} ·`))?.value, transportCode);
  await page.locator('#action-fields [name="vehicle_id"]').selectOption(transportVehicleValue);
  await page.locator('#action-fields [name="duration_hours"]').fill('7');
  await page.locator('#action-fields [name="duration_minutes"]').fill('17');
  await page.locator('#action-fields [name="note"]').fill(transportNote);
  await page.locator('#action-submit').click();
  await expect(page.locator('#action-dialog')).not.toBeVisible();
  await page.locator('#planner-detail-toggle').check();
  await page.locator('#planner-show-areas').click();
  const savedCell = page.locator(`.planner-cell[data-user-id="${userId}"][data-date="${date}"]`);
  const transportChip = savedCell.locator(`.plan-chip.transport-only:has(.plan-note[data-note="${transportNote}"])`);
  await expect(transportChip).toContainText(transportCode);
  await expect(transportChip).not.toContainText('Transport');
  await expect(transportChip).not.toContainText('7 h 17 min');
  await expect(transportChip).toHaveAttribute('title', /7 h 17 min/);
  await expect(page.locator('#planner-bulk-approve')).toBeHidden();

  await savedCell.click();
  await page.keyboard.press('e');
  const transportRow = page.locator('#planner-entry-list .planner-entry-row.transport-entry').filter({ has: page.locator('[data-plan-vehicle] option:checked', { hasText: transportCode }) });
  await expect(transportRow.locator('.planner-area-picker')).toBeHidden();
  await expect(transportRow.locator('[data-plan-shift]')).toBeHidden();
  await expect(transportRow.locator('[data-plan-duration-hours]')).toHaveValue('7');
  await expect(transportRow.locator('[data-plan-duration-minutes]')).toHaveValue('17');
  await expect(transportRow.locator('[data-plan-vehicle]')).toHaveValue(/\d+/);
  await page.locator('#planner-dialog-close').click();

  const freeCell = page.locator('.planner-cell[data-editable="1"]').nth(1);
  await freeCell.dispatchEvent('pointerdown', { button: 0, buttons: 1 });
  await page.locator('body').dispatchEvent('pointerup', { button: 0 });
  await page.keyboard.press('w');
  await expect(page.locator('#action-title')).toContainText('Wolne');
  await page.locator('#action-fields [name="note"]').fill('Odbiór nadgodzin');
  await page.locator('#action-submit').click();
  await expect(freeCell.locator('.absence-chip.time_off')).toContainText('WOLNE');

  const vacationCell = page.locator('.planner-cell[data-editable="1"]').nth(2);
  await vacationCell.click({ button: 'right' });
  await expect(page.locator('#context-menu [data-action="add-time-off"]')).toContainText('+ Wolne');
  await expect(page.locator('#context-menu [data-action="add-transport"]')).toContainText('+Transport');
  await expect(page.locator('#context-menu [data-action="remove-selection"]')).toHaveCount(0);
  await page.locator('#title').click();
  await page.keyboard.press('u');
  await expect(page.locator('#action-title')).toContainText('Urlop');
  await page.locator('#action-fields [name="note"]').fill('Urlop testowy');
  await page.locator('#action-submit').click();
  await expect(vacationCell.locator('.absence-chip.vacation')).toContainText('URLOP');

  const workCell = page.locator('.planner-cell[data-editable="1"]').nth(3);
  await workCell.dispatchEvent('pointerdown', { button: 0, buttons: 1 });
  await page.locator('body').dispatchEvent('pointerup', { button: 0 });
  await page.keyboard.press('p');
  await expect(page.locator('#action-title')).toContainText('Dodaj pracę');
  const rootAreas = await page.locator('#action-fields [name="controller_group_ids"]').evaluateAll(inputs => inputs.map(input => ({ value: input.value, label: input.closest('label')?.textContent?.trim() || '' })).filter(item => !item.label.includes(' / ')).slice(0, 2));
  expect(rootAreas).toHaveLength(2);
  await page.locator('#action-fields [data-ui-multiselect="controller_group_ids"] summary').click();
  for (const area of rootAreas) await page.locator(`#action-fields [name="controller_group_ids"][value="${area.value}"]`).check();
  await page.locator('#action-fields [name="note"]').fill(workNote);
  await page.locator('#action-submit').click();
  const mergedWorkChip = workCell.locator(`.plan-chip[data-current-project="1"]:has(.plan-note[data-note="${workNote}"])`);
  await expect(mergedWorkChip).toHaveCount(1);
  for (const area of rootAreas) await expect(mergedWorkChip).toContainText(area.label);
  await expect(mergedWorkChip).toHaveAttribute('data-entry-ids', /\d+,\d+/);
  await expect(mergedWorkChip.locator('.mode-label')).toBeVisible();
  await expect(mergedWorkChip.locator('.shift-label')).toHaveCount(0);
  await expect(mergedWorkChip).toHaveAttribute('style', /--project-color:#[0-9a-f]{6}/);
  await mergedWorkChip.dispatchEvent('pointerdown', { button: 0, buttons: 1 });
  await page.locator('body').dispatchEvent('pointerup', { button: 0 });
  await expect(page.locator('#planner-entry-selection-count')).toHaveText('2');
  await page.locator('#planner-selection-clear').click();
  const tileHeights = await Promise.all([transportChip, freeCell.locator('.absence-chip.time_off'), vacationCell.locator('.absence-chip.vacation'), mergedWorkChip].map(locator => locator.evaluate(element => Math.round(element.getBoundingClientRect().height))));
  expect(new Set(tileHeights).size).toBe(1);
  const fixedColors = await Promise.all([transportChip, freeCell.locator('.absence-chip.time_off'), vacationCell.locator('.absence-chip.vacation')].map(locator => locator.evaluate(element => getComputedStyle(element).backgroundColor)));
  expect(new Set(fixedColors).size).toBe(3);

  await workCell.click();
  await page.keyboard.press('e');
  const groupedWorkRow = page.locator('#planner-entry-list .planner-entry-row:not(.transport-entry)').filter({ has: page.locator(`[data-plan-note][value="${workNote}"]`) });
  await expect(groupedWorkRow).toHaveCount(1);
  await expect(groupedWorkRow.locator('[data-plan-area]:checked')).toHaveCount(2);
  await groupedWorkRow.locator('[data-plan-manpower]').uncheck();
  await page.locator('#planner-form .dialog-actions .primary').click();
  await expect(workCell.locator(`.plan-chip.excluded-from-manpower:has(.plan-note[data-note="${workNote}"])`)).toHaveCount(1);

  const genericCell = page.locator('.planner-cell[data-editable="1"]:not(.planned):not(.absent)').first();
  const genericUserId = await genericCell.getAttribute('data-user-id');
  const genericDate = await genericCell.getAttribute('data-date');
  await genericCell.click();
  await page.keyboard.press('p');
  await page.locator('#action-fields [name="count_in_manpower"]').uncheck();
  await page.locator('#action-fields [name="note"]').fill(genericNote);
  await page.locator('#action-submit').click();
  const savedGenericCell = page.locator(`.planner-cell[data-user-id="${genericUserId}"][data-date="${genericDate}"]`);
  const genericChip = savedGenericCell.locator(`.plan-chip.excluded-from-manpower:has(.plan-note[data-note="${genericNote}"])`);
  await expect(genericChip.locator('.mode-label')).toBeVisible();
  await expect(genericChip).not.toContainText(/\b(?:ON|OFF|D|N)\b/);
  await expect(genericChip).not.toContainText('Bez obszaru');
  await expect(genericChip).toHaveAttribute('title', /manpoweru/);

  await savedGenericCell.click();
  await page.keyboard.press('e');
  await page.locator('#planner-entry-list .remove-plan-entry').click();
  await page.locator('#planner-entry-add').click();
  const directGenericRow = page.locator('#planner-entry-list .planner-entry-row:not(.transport-entry)').first();
  await expect(directGenericRow.locator('[data-plan-area-none]')).toBeChecked();
  await expect(directGenericRow.locator('[data-plan-area]:checked')).toHaveCount(0);
  await expect(directGenericRow.locator('[data-plan-manpower]')).toBeChecked();
  await page.locator('#planner-form .dialog-actions .primary').click();
  await expect(savedGenericCell.locator('.plan-chip[data-current-project="1"]:not(.excluded-from-manpower)')).not.toContainText(/\b(?:ON|OFF|D|N)\b/);
  await expect(savedGenericCell.locator('.plan-chip[data-current-project="1"]:not(.excluded-from-manpower)')).not.toContainText('Bez obszaru');

  await savedCell.dispatchEvent('pointerdown', { button: 0 });
  await freeCell.dispatchEvent('pointerdown', { button: 0, ctrlKey: true });
  await freeCell.click({ button: 'right' });
  await expect(page.locator('#context-menu [data-action="clear"]')).toContainText('Wyczyść cały dzień');
  await page.locator('#context-menu [data-action="clear"]').click();
  await expect(page.locator('#action-title')).toHaveText('Wyczyść cały dzień');
  await expect(page.locator('#action-description')).toContainText('2 wybranych dni');
  await page.locator('#action-submit').click();
  await expect(savedCell.locator('.plan-chip')).toHaveCount(0);
  await expect(freeCell.locator('.absence-chip')).toHaveCount(0);

  await vacationCell.dispatchEvent('pointerdown', { button: 0 });
  await workCell.dispatchEvent('pointerdown', { button: 0, ctrlKey: true });
  await page.keyboard.press('Delete');
  await expect(page.locator('#action-title')).toHaveText('Wyczyść cały dzień');
  await expect(page.locator('#action-description')).toContainText('2 wybranych dni');
  await page.locator('#action-submit').click();
  await expect(vacationCell.locator('.absence-chip')).toHaveCount(0);
  await expect(workCell.locator('.plan-chip[data-current-project="1"]')).toHaveCount(0);
});

test('Planner przelicza godziny po dodaniu święta i dla ręcznie wybranego okresu', async ({ page }) => {
  await page.evaluate(async () => {
    const users = await fetch('/api/users').then(response => response.json());
    const participant = users.find(user => user.project_active) || users[0];
    const response = await fetch(`/api/users/${participant.id}/planner`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planner_enabled: 1 }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się włączyć uczestnika Plannera');
  });
  await page.reload();
  await expect(page.locator('#content')).toBeVisible();
  await openView(page, 'planner');
  await page.locator('#planner-detail-toggle').check();
  const target = await page.locator('.planner-cell[data-editable="1"]').evaluateAll(cells => {
    const candidate = cells.find(cell => {
      const weekday = new Date(`${cell.dataset.date}T12:00:00Z`).getUTCDay();
      return weekday > 0 && weekday < 6 && !cell.classList.contains('holiday');
    });
    return candidate ? { userId: Number(candidate.dataset.userId), date: candidate.dataset.date } : null;
  });
  expect(target).not.toBeNull();
  await page.evaluate(async ({ userId, date }) => {
    const response = await fetch('/api/planner/day', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, plan_date: date, entries: [], absence_type: 'time_off', absence_note: 'Test przeliczenia święta' }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się zapisać wolnego');
  }, target);
  const before = await page.evaluate(async ({ userId, date }) => {
    const planner = await fetch(`/api/planner?from=${date}&to=${date}`).then(response => response.json());
    return planner.time_details.details.find(item => item.user_id === userId && item.date === date);
  }, target);
  expect(before.overtime_weighted).toBeLessThan(0);

  await page.waitForTimeout(500);
  await page.locator('#planner-config-open').click();
  const [year, month, day] = target.date.split('-');
  await page.locator('#planner-holidays-bulk').fill(`${day}.${month}.${year} Święto E2E przeliczenia`);
  await expect(page.locator('#planner-holidays-bulk')).toHaveValue(`${day}.${month}.${year} Święto E2E przeliczenia`);
  await page.locator('#planner-holidays-bulk-save').click();
  await expect(page.locator('#toast')).toContainText('godziny zostały przeliczone ponownie');
  const after = await page.evaluate(async ({ userId, date }) => {
    const planner = await fetch(`/api/planner?from=${date}&to=${date}`).then(response => response.json());
    return planner.time_details.details.find(item => item.user_id === userId && item.date === date);
  }, target);
  expect(after.is_holiday).toBe(1);
  expect(after.overtime_raw).toBe(0);
  expect(after.overtime_weighted).toBe(0);
  await page.locator('#config-full-close').click();

  await page.locator('#planner-hours-open').click();
  await page.locator('#planner-hours-from').fill(target.date);
  await page.locator('#planner-hours-to').fill(target.date);
  await page.locator('#planner-hours-recalculate').click();
  await expect(page.locator('.planner-hours-toolbar small')).toContainText('Przeliczono:');
  await page.locator('.hours-details summary').click();
  const detail = page.locator('.hours-details tbody tr', { hasText: 'Wolne z nadgodzin' });
  await expect(detail).toContainText('święto');
  await expect(detail).toContainText('0.0 / 0.0 h');
  await expectViewportContained(page);
  await page.evaluate(async ({ userId, date }) => {
    const config = await fetch('/api/config').then(response => response.json());
    const holiday = (config.planner_holidays || []).find(item => item.holiday_date === date);
    if (holiday) await fetch(`/api/planner/holidays/${holiday.id}`, { method: 'DELETE' });
    await fetch('/api/planner/day', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, plan_date: date, entries: [] }) });
  }, target);
});

test('zadanie przyjmuje screenshot przez Ctrl+V, kompresuje go i pokazuje po zapisie', async ({ page }) => {
  await openView(page, 'tasks');
  await page.getByRole('button', { name: '+ Nowe zadanie', exact: true }).click();
  await expect(page.locator('#modal')).toBeVisible();
  const title = `Screenshot zadania ${Date.now()}`;
  await page.locator('#fields [name="title"]').fill(title);
  await page.locator('#fields [name="status"]').selectOption('To do');
  await page.evaluate(async () => {
    const blob = await fetch('/assets/favicon.png').then(response => response.blob());
    const file = new File([blob], 'screenshot-schowek.png', { type: 'image/png' });
    const transfer = new DataTransfer(); transfer.items.add(file);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: transfer });
    document.dispatchEvent(event);
  });
  await expect(page.locator('.task-image-card.pending')).toHaveCount(1);
  await expect(page.locator('.task-image-card.pending')).toContainText('do zapisania');
  await expect(page.locator('.task-image-card.pending b')).toContainText('.webp');
  const invalidFields = await page.locator('#form').evaluate(form => [...form.querySelectorAll(':invalid')].map(control => control.getAttribute('name') || control.id || control.tagName));
  expect(invalidFields).toEqual([]);
  await page.locator('#record-save').click();
  await expect(page.locator('#modal')).not.toBeVisible();

  const card = page.locator('.task-card', { hasText: title });
  await expect(card).toBeVisible();
  await expect(card.locator('.task-image-count')).toHaveText(/1/);
  await card.click();
  await expect(page.locator('#task-image-gallery .task-image-card')).toHaveCount(1);
  const oldImageUrl = await page.locator('#task-image-gallery img').getAttribute('src');
  expect(oldImageUrl).toMatch(/\/api\/task-images\/\d+\/content\?v=[a-f0-9]+/);
  await page.locator('#edit-record').click();
  await page.locator('[data-remove-task-image^="saved:"]').click();
  await expect(page.locator('#task-image-gallery .task-image-card')).toHaveCount(0);
  await expect(page.locator('#toast')).toContainText('trwale usunięte z serwera');
  expect(await page.evaluate(url => fetch(url, { cache: 'no-store' }).then(response => response.status), oldImageUrl)).toBe(404);

  await page.evaluate(async () => {
    const blob = await fetch('/assets/commissioning-hub-login.png').then(response => response.blob());
    const file = new File([blob], 'nowy-screenshot.png', { type: 'image/png' });
    const transfer = new DataTransfer(); transfer.items.add(file);
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: transfer });
    document.dispatchEvent(event);
  });
  await expect(page.locator('.task-image-card.pending')).toHaveCount(1);
  await page.locator('#record-save').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await card.click();
  const newImageUrl = await page.locator('#task-image-gallery img').getAttribute('src');
  expect(newImageUrl).not.toBe(oldImageUrl);
  expect(await page.evaluate(url => fetch(url, { cache: 'no-store' }).then(response => response.status), oldImageUrl)).toBe(404);
  await expectViewportContained(page);
});

test('menedżer motywów udostępnia dziesięć profesjonalnych palet', async ({ page }) => {
  const palettes = {
    'industrial-pro': ['#081B30', '#0057C8', '#74C7F8', '#41546A', '#F8FAFC'],
    'modern-light': ['#F3F7FC', '#1139D8', '#62A0FF', '#DCE5F0', '#17243F'],
    'dark-professional': ['#101719', '#235E41', '#65C466', '#354F48', '#E8EDF0'],
    'siemens-inspired': ['#07556C', '#099DAD', '#D3EFF2', '#D8E3EB', '#152C39'],
    'rockwell-inspired': ['#181B20', '#C51D35', '#EA8796', '#444B55', '#F1F4F8'],
    'green-automation': ['#EAF8F1', '#06754E', '#58BA68', '#D4F4DA', '#193B30'],
    'amber-industrial': ['#141719', '#F58A00', '#FFBB21', '#515B68', '#F0F2F5'],
    'tech-purple': ['#1A142C', '#6630CA', '#B88AFF', '#45425D', '#F7F3FF'],
    'steel-blue': ['#E7EFF9', '#164A86', '#2378CC', '#AECDEA', '#172A45'],
    'minimal-pro': ['#F7F9FC', '#182638', '#788796', '#CBD4DE', '#FFFFFF']
  };
  await page.locator('#theme-switch').evaluate(button => button.click());
  const cards = page.locator('#theme-list .theme-card');
  await expect(cards).toHaveCount(10);
  await expect(page.locator('#theme-list .theme-swatches i')).toHaveCount(50);
  await expect(cards.locator('.theme-card-title strong')).toHaveText([
    'Industrial Pro', 'Modern Light', 'Dark Professional', 'Siemens Inspired', 'Rockwell Inspired',
    'Green Automation', 'Amber Industrial', 'Tech Purple', 'Steel Blue', 'Minimal Pro'
  ]);
  await expect(page.locator('#theme-list')).not.toContainText('Nocny');
  await expect(page.locator('#theme-list')).not.toContainText('Cyber Grid');

  const tokens = await page.evaluate(themePalettes => {
    const root = document.documentElement;
    const names = ['--theme-bg', '--theme-accent', '--theme-secondary', '--theme-line', '--theme-contrast'];
    const result = {};
    for (const id of Object.keys(themePalettes)) {
      root.dataset.theme = id;
      const styles = getComputedStyle(root);
      result[id] = {
        palette: names.map(name => styles.getPropertyValue(name).trim().toUpperCase()),
        statuses: ['--status-progress', '--status-ready', '--status-done', '--status-blocked'].map(name => styles.getPropertyValue(name).trim().toUpperCase())
      };
    }
    root.dataset.theme = 'industrial-pro';
    return result;
  }, palettes);
  const darkThemes = new Set(['industrial-pro', 'dark-professional', 'rockwell-inspired', 'amber-industrial', 'tech-purple']);
  for (const [id, palette] of Object.entries(palettes)) {
    expect(tokens[id].palette).toEqual(palette);
    expect(tokens[id].statuses).toEqual(darkThemes.has(id)
      ? ['#74C7F8', '#FFD076', '#65D49C', '#FF8B82']
      : ['#1769D2', '#925D00', '#117A4D', '#B42318']);
  }
  await expectViewportContained(page);
  await page.locator('#theme-close').click();
});

test('motywy zachowują kontrast tablicy, kalendarza, statusów i zakładek', async ({ page }) => {
  const themes = ['industrial-pro', 'modern-light', 'dark-professional', 'siemens-inspired', 'rockwell-inspired', 'green-automation', 'amber-industrial', 'tech-purple', 'steel-blue', 'minimal-pro'];
  const contrast = await page.evaluate(themeIds => {
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0';
    host.innerHTML = '<section class="lane progressing"><div class="lanehead">W trakcie</div></section><header class="calendar-day-head today">Dzisiaj</header><nav class="announcement-tabs workspace-tabs"><button class="active">Zadania</button></nav><button class="primary">Zapisz</button><span class="status-symbol progress">P</span><span class="status-symbol blocked">B</span>';
    host.querySelectorAll('*').forEach(element => { element.style.transition = 'none'; });
    document.body.append(host);
    const parseColor = value => {
      const rgb = value.match(/rgba?\(([^)]+)\)/i);
      if (rgb) return rgb[1].split(/[ ,/]+/).slice(0, 3).map(Number);
      const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
      return srgb ? srgb.slice(1, 4).map(value => Number(value) * 255) : [0, 0, 0];
    };
    const luminance = color => color.map(value => {
      const channel = value / 255;
      return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
    const ratio = element => {
      const styles = getComputedStyle(element);
      const foreground = luminance(parseColor(styles.color));
      const background = luminance(parseColor(styles.backgroundColor));
      return (Math.max(foreground, background) + .05) / (Math.min(foreground, background) + .05);
    };
    const selectors = ['.lane', '.calendar-day-head', '.workspace-tabs .active', '.primary', '.status-symbol.progress', '.status-symbol.blocked'];
    const result = {};
    for (const id of themeIds) {
      document.documentElement.dataset.theme = id;
      result[id] = selectors.map(selector => ratio(host.querySelector(selector)));
    }
    host.remove();
    document.documentElement.dataset.theme = 'industrial-pro';
    return result;
  }, themes);
  const surfaces = ['kolumna W trakcie', 'dzisiejszy dzień', 'aktywna zakładka', 'przycisk główny', 'status W trakcie', 'status Zablokowane'];
  for (const id of themes) {
    contrast[id].forEach((ratio, index) => expect(ratio, `${id} · ${surfaces[index]} powinien zachować czytelny kontrast`).toBeGreaterThanOrEqual(4.5));
  }
});

test('akcje dodawania są w belkach modułów, a eksport pozostaje przy prawym marginesie', async ({ page }) => {
  await openView(page, 'tasks');
  await expect(page.locator('#task-filter-bar [data-module-primary-action]')).toHaveText('+ Nowe zadanie');
  await expect(page.locator('.page-actions #add')).toBeHidden();
  await expect(page.locator('.page-actions #export')).toBeVisible();

  await page.getByRole('button', { name: 'Otwarte punkty', exact: true }).click();
  await expect(page.locator('#title')).toHaveText('Praca · Otwarte punkty');
  await expect(page.locator('#point-filter-bar [data-module-primary-action]')).toHaveText('+ Nowy punkt');

  await page.getByRole('button', { name: 'Zależności zewnętrzne', exact: true }).click();
  await expect(page.locator('[data-module-primary-action]')).toHaveCount(0);
  await expect(page.locator('#external-add')).toBeVisible();

  await openView(page, 'status');
  await expect(page.locator('#status-panel > .module-toolbar [data-module-primary-action]')).toHaveText('+ Dodaj punkt');
  const alignment = await page.evaluate(() => {
    const main = document.querySelector('main').getBoundingClientRect();
    const button = document.querySelector('#export').getBoundingClientRect();
    return Math.abs(main.right - button.right);
  });
  expect(alignment).toBeLessThanOrEqual(22);
  await expectViewportContained(page);
});

test('komunikat błędu pozostaje nad otwartym popupem', async ({ page }) => {
  await openView(page, 'tasks');
  await page.route('**/api/tasks', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ error: 'Testowy błąd zapisu zadania' }) });
    } else await route.continue();
  });
  await page.locator('#task-filter-bar [data-module-primary-action]').click();
  await expect(page.locator('#modal')).toBeVisible();
  await page.locator('#fields [name="title"]').fill('Test widoczności błędu');
  await page.locator('#fields [name="status"]').selectOption({ index: 1 });
  await page.locator('#record-save').click();
  const toast = page.locator('#toast');
  await expect(toast).toContainText('Testowy błąd zapisu zadania');
  await expect(toast).toBeVisible();
  expect(await toast.evaluate(element => element.parentElement?.id)).toBe('modal');
  await expect(page.locator('#modal')).toBeVisible();
});

test('globalne wyszukiwanie otwiera rekord z obserwowaniem, wzmiankami i osią czasu', async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-search-${Date.now()}`;
  const { source } = await createRelatedData(page, suffix);
  await page.locator('#global-search').fill(source.title);
  const result = page.locator(`[data-global-result="task:${source.id}"]`);
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('#fields [name="title"]')).toHaveValue(source.title);
  await expect(page.locator('#watch-record')).toBeVisible();
  await expect(page.locator('#mute-record')).toBeVisible();
  await page.locator('#watch-record').click();
  await expect(page.locator('#watch-record')).toContainText('Obserwujesz');

  await page.locator('#comment-content').fill('@');
  await expect(page.locator('#comment-mention-suggestions')).toBeVisible();
  await expect(page.locator('#comment-mention-suggestions button').first()).toBeVisible();
  await page.locator('#comment-mention-suggestions button').first().click();
  await page.locator('#comment-content').pressSequentially('sprawdź proszę.');
  await page.locator('#comment-add').click();
  await expect(page.locator('.entity-comment').last()).toContainText('sprawdź proszę');

  await page.locator('#audit-toggle').click();
  await expect(page.locator('#audit-section')).toBeVisible();
  await expect(page.locator('.timeline-entry.comment').first()).toBeVisible();
  await expectViewportContained(page);
});

test('tabele pozostają w obszarze strony', async ({ page }, testInfo) => {
  await openView(page, 'status');
  await expect(page.locator('.status-matrix-table table').first()).toBeVisible();
  const tableLayout = await page.locator('.status-matrix-table').first().evaluate(wrapper => ({
    wrapperWidth: wrapper.clientWidth,
    tableWidth: wrapper.querySelector('table').scrollWidth,
    canScroll: wrapper.scrollWidth >= wrapper.clientWidth
  }));
  expect(tableLayout.wrapperWidth).toBeGreaterThan(0);
  expect(tableLayout.tableWidth).toBeGreaterThan(0);
  expect(tableLayout.canScroll).toBe(true);
  await expectViewportContained(page);

  if (testInfo.project.name === 'mobile') {
    await page.locator('#mobile-menu').click();
    await expect(page.locator('body')).toHaveClass(/nav-open/);
    await expect(page.locator('#nav')).toBeVisible();
  }
});

test('szybkie dodawanie statusu obsługuje tekst ze średnikami i tabelę kolumn podstawowych', async ({ page }) => {
  const configured = await page.evaluate(async () => {
    const request = async (path, options = {}) => {
      const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `${response.status} ${path}`);
      return body;
    };
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const group = await request('/api/status-groups', { method: 'POST', body: JSON.stringify({ name: `Szybkie dodawanie ${suffix}` }) });
    const type = await request(`/api/status-groups/${group.id}/columns`, { method: 'POST', body: JSON.stringify({ name: 'Typ urządzenia', column_role: 'basic', field_type: 'text' }) });
    const name = await request(`/api/status-groups/${group.id}/columns`, { method: 'POST', body: JSON.stringify({ name: 'Nazwa urządzenia', column_role: 'basic', field_type: 'text' }) });
    return { groupId: group.id, typeId: type.id, nameId: name.id };
  });
  await page.reload();
  await expect(page.locator('#content')).toBeVisible();
  await openView(page, 'status');

  await page.locator('#bulk-status-open').click();
  await page.locator('#bulk-status-matrix-group').selectOption(String(configured.groupId));
  await expect(page.locator('#bulk-status-text-hint')).toContainText('Typ urządzenia ; Nazwa urządzenia');
  await page.locator('#bulk-status-names').fill('Napęd;M1\nCzujnik;B2');
  await page.locator('#bulk-status-form .primary').click();
  await expect(page.locator('#bulk-status-dialog')).not.toBeVisible();
  let saved = await page.evaluate(groupId => fetch('/api/status?controller=all').then(response => response.json()).then(items => items.filter(item => item.status_group_id === groupId)), configured.groupId);
  expect(saved.some(item => item.matrix_values[configured.typeId] === 'Napęd' && item.matrix_values[configured.nameId] === 'M1')).toBe(true);
  expect(saved.some(item => item.matrix_values[configured.typeId] === 'Czujnik' && item.matrix_values[configured.nameId] === 'B2')).toBe(true);

  await page.locator('#bulk-status-open').click();
  await page.locator('#bulk-status-matrix-group').selectOption(String(configured.groupId));
  await page.locator('#bulk-status-mode-switch [data-mode="table"]').click();
  await expect(page.locator('#bulk-status-table-mode')).toBeVisible();
  await expect(page.locator('#bulk-status-table-head')).toContainText('Typ urządzenia');
  const firstRow = page.locator('#bulk-status-table-body tr').first();
  await firstRow.locator(`[data-bulk-status-column="${configured.typeId}"]`).fill('Wyspa zaworowa');
  await firstRow.locator(`[data-bulk-status-column="${configured.nameId}"]`).fill('YV1');
  await page.locator('#bulk-status-form .primary').click();
  await expect(page.locator('#bulk-status-dialog')).not.toBeVisible();
  saved = await page.evaluate(groupId => fetch('/api/status?controller=all').then(response => response.json()).then(items => items.filter(item => item.status_group_id === groupId)), configured.groupId);
  expect(saved.some(item => item.matrix_values[configured.typeId] === 'Wyspa zaworowa' && item.matrix_values[configured.nameId] === 'YV1')).toBe(true);
  await expectViewportContained(page);
});

test('kopiowanie grup statusu ma uporządkowany zakres i zwijany konfigurator', async ({ page }) => {
  const configured = await page.evaluate(async () => {
    const request = async (path, options = {}) => {
      const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `${response.status} ${path}`);
      return body;
    };
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const group = await request('/api/status-groups', { method: 'POST', body: JSON.stringify({ name: `Źródło kopiowania ${suffix}` }) });
    await request(`/api/status-groups/${group.id}/columns`, { method: 'POST', body: JSON.stringify({ name: 'Nazwa urządzenia', column_role: 'basic', field_type: 'text' }) });
    await request(`/api/status-groups/${group.id}/columns`, { method: 'POST', body: JSON.stringify({ name: 'Kontrola sygnału', column_role: 'subpoint', field_type: 'status', include_in_progress: 1 }) });
    return { groupId: group.id, groupName: group.name, copyName: `Kopia ${suffix}` };
  });
  await page.reload();
  await openView(page, 'settings');
  await page.locator('[data-config-panel="status_matrix"]').click();
  await expect(page.locator('#config-full-dialog')).toBeVisible();
  const sourceCard = page.locator(`.status-config-group[data-status-config-group="${configured.groupId}"]`);
  await sourceCard.locator('.copy-status-layout').click();
  await expect(page.locator('#action-fields .field > span')).toHaveText(['Nazwa nowej grupy', 'Grupa źródłowa', 'Zakres kopiowania']);
  await expect(page.locator('#action-fields [name="source_group_id"]')).toHaveValue(String(configured.groupId));
  await expect(page.locator('#action-fields [name="element_refs"]:checked')).toHaveCount(2);
  await expect(page.locator('#action-fields .ui-grouped-multiselect h4')).toHaveText(['Kolumny podstawowe 1', 'Podpunkty 1']);
  const checkboxColumns = await page.locator('#action-fields .ui-grouped-multiselect section').evaluateAll(sections => sections.map(section => [...section.querySelectorAll('label input')].map(input => Math.round(input.getBoundingClientRect().left))));
  expect(checkboxColumns.every(column => new Set(column).size <= 1)).toBe(true);
  await page.locator('#action-fields [name="new_group_name"]').fill(configured.copyName);
  await page.locator('#action-submit').click();
  await expect(page.locator('#action-dialog')).not.toBeVisible();
  await expect(page.locator('.status-config-group', { hasText: configured.copyName })).toBeVisible();
  await sourceCard.locator('.status-config-group-toggle').click();
  await expect(sourceCard.locator('.status-config-group-body')).toBeHidden();
  await expectViewportContained(page);
});

test('konfigurator importuje grupy statusu z tekstu z tabulatorami', async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
  const groupName = `Import tekstowy ${suffix}`;
  await openView(page, 'settings');
  await page.locator('[data-config-panel="status_matrix"]').click();
  await page.locator('#status-layout-text-import').click();
  const textarea = page.locator('#action-fields [name="layout_text"]');
  await textarea.fill(` ${groupName}\n\tDevice Type`);
  await expect(page.locator('#status-text-import-preview')).toContainText('Wiersz 1');
  await expect(page.locator('#action-submit')).toBeDisabled();
  await textarea.fill(`${groupName}\n\tDevice Type\n\tDevice Name\n\t\t+24V\tCzy urządzenie jest zasilone +24V?\tNIE\n\t\tGreen\tCzy urządzenie jest w pełni skonfigurowane?\tTAK`);
  await expect(page.locator('#status-text-import-preview')).toContainText('1 grupa, 4 kolumn i podpunktów');
  await expect(page.locator('#action-submit')).toBeEnabled();
  await page.locator('#action-submit').click();
  await expect(page.locator('#action-dialog')).not.toBeVisible();
  await expect.poll(() => page.evaluate(async name => {
    const config = await fetch('/api/config').then(response => response.json());
    const group = (config.status_groups || []).find(item => item.name === name);
    if (!group) return null;
    return (group.columns || []).map(column => ({ name: column.name, role: column.column_role, description: column.description, included: Number(column.include_in_progress) }));
  }, groupName)).not.toBeNull();
  const columns = await page.evaluate(async name => {
    const config = await fetch('/api/config').then(response => response.json());
    return config.status_groups.find(item => item.name === name).columns;
  }, groupName);
  expect(columns.find(column => column.name === 'Device Type')).toMatchObject({ column_role: 'basic', field_type: 'text' });
  expect(columns.find(column => column.name === '+24V')).toMatchObject({ column_role: 'subpoint', field_type: 'status', description: 'Czy urządzenie jest zasilone +24V?', include_in_progress: 0 });
  expect(columns.find(column => column.name === 'Green')).toMatchObject({ column_role: 'subpoint', field_type: 'status', include_in_progress: 1 });
  await expect(page.locator('.status-config-group', { hasText: groupName })).toBeVisible();
  await expectViewportContained(page);
});

test('Status przełącza globalne i wewnętrzne grupowanie funkcyjne', async ({ page }) => {
  await openView(page, 'status');
  await page.locator('#status-group-functional').click();
  await page.locator('#action-fields [name="mode"]').selectOption('global');
  await page.locator('#action-submit').click();
  await expect(page.locator('#status-group-functional')).toContainText('globalne');
  await expect(page.locator('.status-functional-global').first()).toBeVisible();
  const globalFunction = page.locator('.status-functional-global').first();
  await globalFunction.locator(':scope > header > button').click();
  await expect(globalFunction).toHaveClass(/collapsed/);
  await expect(globalFunction.locator(':scope > div')).toHaveCount(0);
  await globalFunction.locator(':scope > header > button').click();
  await expect(globalFunction).not.toHaveClass(/collapsed/);
  const controllerToggle = page.locator('.status-controller-block > header > button').first();
  if (await controllerToggle.count()) {
    await controllerToggle.click();
    await expect(controllerToggle).toHaveAttribute('aria-expanded', 'false');
    await controllerToggle.click();
  }

  await page.locator('#status-group-functional').click();
  await page.locator('#action-fields [name="mode"]').selectOption('within');
  await page.locator('#action-submit').click();
  await expect(page.locator('#status-group-functional')).toContainText('wewnątrz grup');
  await expect(page.locator('.matrix-functional-group-row').first()).toBeVisible();
  const headerAlignment = await page.locator('.status-matrix-table th').evaluateAll(headers => [...new Set(headers.map(header => getComputedStyle(header).verticalAlign))]);
  expect(headerAlignment).toEqual(['middle']);
  const controllerHeader = page.locator('.status-matrix-table th.matrix-controller-cell').first();
  await expect(controllerHeader).toContainText('Sterownik');
  await controllerHeader.locator('[data-status-sort-controller]').click();
  await expect(page.locator('.status-matrix-table [data-status-sort-controller].active').first()).toContainText('↑');
  await page.locator('.status-matrix-table [data-status-sort-controller].active').first().click();
  await expect(page.locator('.status-matrix-table [data-status-sort-controller].active').first()).toContainText('↓');
  const fittedController = await page.locator('.status-matrix-table th.matrix-controller-cell').first().evaluate(header => ({
    minWidth: getComputedStyle(header).minWidth,
    whiteSpace: getComputedStyle(header).whiteSpace
  }));
  expect(fittedController.minWidth).toBe('0px');
  expect(fittedController.whiteSpace).toBe('nowrap');
  const resizeHandle = page.locator('.status-matrix-table [data-status-column-resizer]').first();
  const columnKey = await resizeHandle.getAttribute('data-status-column-resizer');
  const initialWidth = await resizeHandle.locator('xpath=..').evaluate(header => header.getBoundingClientRect().width);
  const startX = await resizeHandle.evaluate(handle => handle.getBoundingClientRect().left + 3);
  await resizeHandle.dispatchEvent('pointerdown', { button: 0, clientX: startX, pointerId: 7, pointerType: 'mouse' });
  await page.evaluate(x => document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, pointerId: 7, pointerType: 'mouse' })), startX + 48);
  await page.evaluate(x => document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, pointerId: 7, pointerType: 'mouse' })), startX + 48);
  const resizedWidth = await page.locator(`.status-matrix-table th[data-status-column-key="${columnKey}"]`).first().evaluate(header => header.getBoundingClientRect().width);
  expect(resizedWidth).toBeGreaterThan(initialWidth + 30);
  await page.locator('.status-matrix-table [data-status-sort-controller].active').first().click();
  const persistedWidth = await page.locator(`.status-matrix-table th[data-status-column-key="${columnKey}"]`).first().evaluate(header => header.getBoundingClientRect().width);
  expect(Math.abs(persistedWidth - resizedWidth)).toBeLessThanOrEqual(2);
  const currentHandle = page.locator(`.status-matrix-table [data-status-column-resizer="${columnKey}"]`).first();
  const shrinkX = await currentHandle.evaluate(handle => handle.getBoundingClientRect().left + 3);
  await currentHandle.dispatchEvent('pointerdown', { button: 0, clientX: shrinkX, pointerId: 8, pointerType: 'mouse' });
  await page.evaluate(x => document.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, pointerId: 8, pointerType: 'mouse' })), shrinkX - 90);
  await page.evaluate(x => document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, pointerId: 8, pointerType: 'mouse' })), shrinkX - 90);
  const shrunkenWidth = await page.locator(`.status-matrix-table th[data-status-column-key="${columnKey}"]`).first().evaluate(header => header.getBoundingClientRect().width);
  expect(shrunkenWidth).toBeLessThan(persistedWidth - 25);
  const controllerContent = await page.locator('.status-matrix-table td.matrix-controller-cell').first().evaluate(cell => {
    const label = cell.querySelector('b'); const cellBox = cell.getBoundingClientRect(); const labelBox = label.getBoundingClientRect(); const style = getComputedStyle(label);
    return { verticalAlign: getComputedStyle(cell).verticalAlign, labelFits: labelBox.width <= cellBox.width, overflow: style.overflow, textOverflow: style.textOverflow };
  });
  expect(controllerContent).toEqual({ verticalAlign: 'middle', labelFits: true, overflow: 'hidden', textOverflow: 'ellipsis' });
  const withinToggle = page.locator('.matrix-functional-group-row button').first();
  await withinToggle.click();
  await expect(withinToggle).toHaveAttribute('aria-expanded', 'false');
  await expectViewportContained(page);
});

test('Planner sortuje kafelki i scala obszary jednego projektu', async ({ page }) => {
  await page.evaluate(async () => {
    const users = await fetch('/api/users').then(response => response.json());
    const participant = users.find(user => user.project_active) || users[0];
    const response = await fetch(`/api/users/${participant.id}/planner`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ planner_enabled: 1 }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się włączyć uczestnika Plannera');
  });
  await page.reload();
  await openView(page, 'planner');
  const cell = page.locator('.planner-cell[data-editable="1"]').first();
  const userId = Number(await cell.getAttribute('data-user-id'));
  const date = await cell.getAttribute('data-date');
  const areas = await page.evaluate(async suffix => {
    const request = async (path, options = {}) => {
      const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `${response.status} ${path}`);
      return body;
    };
    const first = await request('/api/controller-groups', { method: 'POST', body: JSON.stringify({ name: `E2E Obszar A ${suffix}` }) });
    const second = await request('/api/controller-groups', { method: 'POST', body: JSON.stringify({ name: `E2E Obszar B ${suffix}` }) });
    return [first, second];
  }, `${Date.now()}-${Math.floor(Math.random() * 10000)}`);
  await page.evaluate(async ({ userId, date, areas }) => {
    const response = await fetch('/api/planner/day', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, plan_date: date, entries: [
      { activity_type: 'work', controller_group_id: areas[1].id, work_mode: 'online', shift: 'Dzień' },
      { activity_type: 'work', allow_without_area: 1, work_mode: 'offline', shift: 'Dzień' },
      { activity_type: 'transport', duration_hours: 1 },
      { activity_type: 'work', controller_group_id: areas[0].id, work_mode: 'online', shift: 'Dzień' }
    ] }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się zapisać planu');
  }, { userId, date, areas });
  await page.locator('[data-view="planner"]').evaluate(button => button.click());
  const savedCell = page.locator(`.planner-cell[data-user-id="${userId}"][data-date="${date}"]`);
  await expect(page.locator('#planner-detail-toggle')).not.toBeChecked();
  await expect(page.locator('#planner-show-hours')).toHaveCount(0);
  const simplifiedHeight = await savedCell.evaluate(element => element.getBoundingClientRect().height);
  await expect(savedCell.locator('.plan-chip:visible')).toHaveCount(2);
  await expect(savedCell.locator('.plan-chip.project-work')).not.toContainText(/\b(?:ON|OFF|D|N)\b/);
  await page.locator('#planner-detail-toggle').check();
  await expect(page.locator('#planner-show-hours')).toBeVisible();
  await expect(page.locator('#planner-show-areas')).toBeVisible();
  await expect(savedCell.locator('.plan-chip').nth(2)).not.toContainText(areas[0].name);
  await page.locator('#planner-show-areas').click();
  await expect(page.locator('#planner-show-areas')).toHaveAttribute('aria-pressed', 'true');
  await expect(savedCell.locator('.plan-chip:visible')).toHaveCount(3);
  expect(await savedCell.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThan(simplifiedHeight);
  await expect(savedCell.locator('.plan-chip').nth(0)).toHaveClass(/transport-only/);
  await expect(savedCell.locator('.plan-chip').nth(1)).toHaveClass(/offline-work/);
  await expect(savedCell.locator('.plan-chip').nth(1)).not.toContainText('OFF');
  await expect(savedCell.locator('.plan-chip').nth(1)).not.toContainText('Bez obszaru');
  await expect(savedCell.locator('.plan-chip').nth(2)).toContainText(areas[0].name);
  await expect(savedCell.locator('.plan-chip').nth(2)).toContainText(areas[1].name);
  await expect(savedCell.locator('.plan-chip').nth(2)).toHaveAttribute('data-entry-ids', /\d+,\d+/);
  await expect(savedCell.locator('.planner-cell-expand')).toHaveCount(0);
  await expectViewportContained(page);
  await page.evaluate(async ({ userId, date }) => {
    const response = await fetch('/api/planner/day', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, plan_date: date, entries: [] }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się posprzątać planu testowego');
  }, { userId, date });
});

test('Planner zachowuje scroll, zaznacza prostokąty i zatwierdza plan międzyprojektowy', async ({ page }) => {
  const setup = await page.evaluate(async suffix => {
    const request = async (path, options = {}) => {
      const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `${response.status} ${path}`);
      return body;
    };
    const me = await request('/api/me');
    const target = me.projects.find(project => Number(project.id) !== Number(me.current_project.id));
    if (!target) throw new Error('Brak drugiego projektu do testu');
    const worker = await request('/api/users', { method: 'POST', body: JSON.stringify({
      username: `planner.cross.${suffix}`, display_name: `Pracownik międzyprojektowy ${suffix}`, password: 'test-password-123',
      project_role: 'user', project_active: 1, planner_enabled: 1, assignable: 1, active: 1
    }) });
    await request('/api/select-project', { method: 'POST', body: JSON.stringify({ project_id: target.id }) });
    await request(`/api/users/${worker.id}`, { method: 'PATCH', body: JSON.stringify({ project_role: 'user', project_active: 1, planner_enabled: 1, assignable: 1 }) });
    await request('/api/select-project', { method: 'POST', body: JSON.stringify({ project_id: me.current_project.id }) });
    return { sourceProjectId: me.current_project.id, sourceProjectShortCode: me.current_project.planner_short_code, targetProjectId: target.id, targetProjectCode: target.code, targetProjectShortCode: target.planner_short_code, targetProjectColor: target.planner_color, workerId: worker.id, workerName: worker.display_name };
  }, `${Date.now()}-${Math.floor(Math.random() * 10000)}`);
  await openView(page, 'planner');
  await page.locator('#planner-days').selectOption('31');
  const rowCells = page.locator(`.planner-cell[data-user-id="${setup.workerId}"]`);
  await expect(rowCells).toHaveCount(31);
  const scroller = page.locator('.planner-scroll');
  const beforeScroll = await scroller.evaluate(element => { element.scrollLeft = 420; return element.scrollLeft; });
  await page.locator('#planner-tools-toggle').click();
  await expect.poll(() => scroller.evaluate(element => element.scrollLeft)).toBeGreaterThanOrEqual(Math.max(1, beforeScroll - 2));

  await rowCells.nth(1).dispatchEvent('pointerdown', { button: 0, buttons: 1 });
  await page.locator('body').dispatchEvent('pointerup', { button: 0 });
  await rowCells.nth(4).dispatchEvent('pointerdown', { button: 0, buttons: 1, ctrlKey: true, shiftKey: true });
  await page.locator('body').dispatchEvent('pointerup', { button: 0 });
  await expect(page.locator(`.planner-cell[data-user-id="${setup.workerId}"].multi-selected`)).toHaveCount(4);
  await page.locator('#planner-selection-clear').click();
  await rowCells.nth(6).dispatchEvent('pointerdown', { button: 0, buttons: 1, ctrlKey: true });
  await rowCells.nth(8).dispatchEvent('pointerenter', { buttons: 1, ctrlKey: true });
  await page.locator('body').dispatchEvent('pointerup', { button: 0 });
  await expect(page.locator(`.planner-cell[data-user-id="${setup.workerId}"].multi-selected`)).toHaveCount(3);
  await page.locator('#planner-selection-clear').click();

  const planDate = await rowCells.first().getAttribute('data-date');
  await page.evaluate(async ({ workerId, planDate }) => {
    const response = await fetch('/api/planner/day', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: workerId, plan_date: planDate, entries: [{ activity_type: 'work', allow_without_area: 1, work_mode: 'offline', shift: 'Noc', count_in_manpower: 1 }] }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się zapisać nocnego planu');
  }, { workerId: setup.workerId, planDate });
  await page.locator('[data-view="planner"]').evaluate(button => button.click());
  const nightChip = page.locator(`.planner-cell[data-user-id="${setup.workerId}"][data-date="${planDate}"] .plan-chip.night-shift`);
  await expect(nightChip).toContainText(setup.sourceProjectShortCode);
  await expect(nightChip).toHaveClass(/offline-work/);
  await expect(nightChip).not.toContainText(/\b(?:ON|OFF|D|N)\b/);
  await expect(nightChip).not.toContainText('Bez obszaru');
  await page.evaluate(async ({ workerId, planDate }) => {
    const response = await fetch('/api/planner/day', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: workerId, plan_date: planDate, entries: [] }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się wyczyścić planu źródłowego');
  }, { workerId: setup.workerId, planDate });
  await page.locator('[data-view="planner"]').evaluate(button => button.click());

  const requestCell = page.locator(`.planner-cell[data-user-id="${setup.workerId}"][data-date="${planDate}"]`);
  await requestCell.dispatchEvent('pointerdown', { button: 0, buttons: 1 });
  await page.locator('body').dispatchEvent('pointerup', { button: 0 });
  await page.locator('#planner-bulk-add').click();
  await page.locator('#action-fields [name="target_project_id"]').selectOption(String(setup.targetProjectId));
  await page.locator('#action-fields [name="work_mode"]').selectOption('offline');
  await page.locator('#action-fields [name="shift"]').selectOption('Noc');
  await page.locator('#action-fields [name="note"]').fill('Nocne wsparcie projektu docelowego');
  await page.locator('#action-submit').click();
  await expect(page.locator('#planner-requirements-open')).toBeVisible();
  await expect(page.locator('#planner-config-open')).toBeVisible();
  await expect(page.locator('#planner-hours-open')).toBeVisible();
  const targetRequirementToggle = page.locator(`[data-requirement-project-toggle="${setup.targetProjectId}"]`).first();
  await expect(targetRequirementToggle).toBeVisible();
  await expect(page.locator(`[data-requirement-project="${setup.targetProjectId}"]`)).not.toHaveCount(0);
  await targetRequirementToggle.click();
  await expect(page.locator(`[data-requirement-project="${setup.targetProjectId}"]`)).toHaveCount(0);
  await page.locator(`[data-requirement-project-toggle="${setup.targetProjectId}"]`).first().click();
  await page.locator('#planner-detail-toggle').check();
  const directSourceChip = page.locator(`.planner-cell[data-user-id="${setup.workerId}"][data-date="${planDate}"] .plan-chip.other-project.night-shift`);
  await expect(directSourceChip).not.toHaveClass(/approval-pending/);

  await page.evaluate(async targetProjectId => {
    const response = await fetch('/api/select-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: targetProjectId }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się przełączyć projektu');
  }, setup.targetProjectId);
  await page.reload();
  await expect(page.locator('#content')).toBeVisible();
  await openView(page, 'planner');
  await page.locator('#planner-detail-toggle').check();
  const approvedChip = page.locator(`.planner-cell[data-user-id="${setup.workerId}"][data-date="${planDate}"] .plan-chip.night-shift`);
  await expect(approvedChip).toContainText(setup.targetProjectShortCode);
  await expect(approvedChip).toHaveClass(/offline-work/);
  await expect(approvedChip).not.toHaveClass(/approval-pending/);
  await expect(approvedChip).toHaveAttribute('style', new RegExp(`--project-color:${setup.targetProjectColor}`, 'i'));
  await expect(page.locator('.planner-cross-project-row.incoming', { hasText: setup.workerName })).toHaveCount(0);

  await page.evaluate(async sourceProjectId => {
    const response = await fetch('/api/select-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: sourceProjectId }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się wrócić do projektu źródłowego');
  }, setup.sourceProjectId);
  await page.reload();
  await openView(page, 'planner');
  await page.locator('#planner-detail-toggle').check();
  await page.locator('#planner-requirements-open').click();
  const requirementProjectSelect = page.locator('#planner-requirement-project-inline');
  await expect(requirementProjectSelect.locator(`option[value="${setup.targetProjectId}"]`)).toContainText(setup.targetProjectShortCode);
  await requirementProjectSelect.selectOption(String(setup.targetProjectId));
  await expect(page.locator('#planner-requirement-project-inline')).toHaveValue(String(setup.targetProjectId));
  await page.locator('#planner-requirements-open').click();
  const externalNightChip = page.locator(`.planner-cell[data-user-id="${setup.workerId}"][data-date="${planDate}"] .plan-chip.other-project.night-shift`);
  await expect(externalNightChip).toContainText(setup.targetProjectShortCode);
  await expect(externalNightChip).not.toContainText(/\b(?:ON|OFF|D|N)\b/);
  await expect(externalNightChip).toHaveAttribute('style', new RegExp(`--project-color:${setup.targetProjectColor}`, 'i'));
  expect(await externalNightChip.evaluate(element => getComputedStyle(element).backgroundImage)).toContain('repeating-linear-gradient');
  await page.locator('.planner-scroll').evaluate(element => { element.scrollLeft = 0; });
  await expect(externalNightChip).toHaveAttribute('draggable', 'true');
  await externalNightChip.dispatchEvent('pointerdown', { button: 0, buttons: 1 });
  await page.locator('body').dispatchEvent('pointerup', { button: 0 });
  await expect(page.locator('#planner-entry-selection-count')).toHaveText('1');
  await externalNightChip.dblclick();
  await expect(page.locator('#planner-dialog-description')).toContainText('bez dodatkowej akceptacji');
  await page.locator('#planner-entry-add').click();
  const transportRow = page.locator('#planner-entry-list .planner-entry-row').last();
  await transportRow.locator('[data-plan-activity]').selectOption('transport');
  await transportRow.locator('[data-plan-duration-hours]').fill('2');
  await transportRow.locator('[data-plan-duration-minutes]').fill('15');
  await transportRow.locator('[data-plan-note]').fill('Transport edytowany z projektu źródłowego');
  await page.locator('#planner-form footer .primary').click();
  await expect(page.locator(`.planner-cell[data-user-id="${setup.workerId}"][data-date="${planDate}"] .plan-chip.other-project.approval-pending`)).toHaveCount(0);

  const copyDate = await rowCells.nth(1).getAttribute('data-date');
  const moveDate = await rowCells.nth(2).getAttribute('data-date');
  const externalTransport = page.locator(`.planner-cell[data-user-id="${setup.workerId}"][data-date="${planDate}"] .plan-chip.other-project.transport-only`);
  await expect(externalTransport).toHaveAttribute('draggable', 'true');
  await externalTransport.dispatchEvent('pointerdown', { button: 0, buttons: 1 });
  await page.locator('body').dispatchEvent('pointerup', { button: 0 });
  await page.keyboard.press('Control+C');
  const copyCell = page.locator(`.planner-cell[data-user-id="${setup.workerId}"][data-date="${copyDate}"]`);
  await copyCell.dispatchEvent('pointerdown', { button: 0, buttons: 1 });
  await page.locator('body').dispatchEvent('pointerup', { button: 0 });
  await page.keyboard.press('Control+V');
  const copiedTransport = page.locator(`.planner-cell[data-user-id="${setup.workerId}"][data-date="${copyDate}"] .plan-chip.other-project.transport-only`);
  await expect(copiedTransport).toBeVisible();
  await copiedTransport.evaluate((source, { workerId, moveDate }) => {
    const target = document.querySelector(`.planner-cell[data-user-id="${workerId}"][data-date="${moveDate}"]`);
    const transfer = new DataTransfer();
    source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
    source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  }, { workerId: setup.workerId, moveDate });
  const movedTransport = page.locator(`.planner-cell[data-user-id="${setup.workerId}"][data-date="${moveDate}"] .plan-chip.other-project.transport-only`);
  await expect(movedTransport).toBeVisible();
  await expect(copiedTransport).toHaveCount(0);
  await movedTransport.dispatchEvent('pointerdown', { button: 0, buttons: 1 });
  await page.locator('body').dispatchEvent('pointerup', { button: 0 });
  await page.keyboard.press('Delete');
  await expect(page.locator('#action-title')).toHaveText('Usuń zaznaczone kafelki');
  await page.locator('#action-submit').click();
  await expect(movedTransport).toHaveCount(0);

  await page.evaluate(async targetProjectId => {
    const response = await fetch('/api/select-project', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: targetProjectId }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się przełączyć projektu do sprzątania');
  }, setup.targetProjectId);
  await page.reload();
  await openView(page, 'planner');
  await page.locator('#planner-detail-toggle').check();
  await expect(page.locator('.planner-cross-project-row.incoming', { hasText: setup.workerName })).toHaveCount(0);
  await expect(page.locator(`.planner-cell[data-user-id="${setup.workerId}"][data-date="${planDate}"] .plan-chip.transport-only`)).toBeVisible();
  await page.evaluate(async ({ workerId, planDate }) => {
    const planner = await fetch(`/api/planner?from=${planDate}&to=${planDate}`).then(response => response.json());
    const entries = planner.entries.filter(item => Number(item.user_id) === Number(workerId) && item.plan_date === planDate);
    for (const entry of entries) await fetch(`/api/planner/entries/${entry.id}`, { method: 'DELETE' });
  }, { workerId: setup.workerId, planDate });
  await expectViewportContained(page);
});

test('odprawa i zagnieżdżone szczegóły zachowują okno źródłowe', async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const { dependent, meeting } = await createRelatedData(page, suffix);
  await openView(page, 'operations');
  await page.locator('[data-operations-tab="meetings"]').click();
  await expect(page.locator(`[data-meeting-open="${meeting.id}"]`)).toBeVisible();
  await page.locator(`[data-meeting-open="${meeting.id}"]`).click();
  await expect(page.locator('#insight-dialog')).toBeVisible();
  await expect(page.locator(`.meeting-plan-item[data-meeting-item="task:${dependent.id}"]`)).toBeVisible();
  await expect(page.locator('[data-meeting-priority] option')).toHaveCount(4);
  await expect(page.locator('.meeting-priority-badge').first()).toHaveText('P2');
  await expect(page.locator('[data-meeting-group-config]')).toHaveCount(0);
  await expectViewportContained(page);

  await page.locator(`[data-operation-jump="task:${dependent.id}"]`).click();
  await expect(page.locator('#modal')).toBeVisible();
  await expect(page.locator('#fields [name="title"]')).toHaveValue(dependent.title);
  await page.locator('#close').click();
  await expect(page.locator('#modal')).not.toBeVisible();
  await expect(page.locator('#insight-dialog')).toBeVisible();
});

test('przejście do zależności udostępnia Wróć i zachowuje formularz', async ({ page }, testInfo) => {
  const suffix = `${testInfo.project.name}-stack-${Date.now()}`;
  const { source, dependent } = await createRelatedData(page, suffix);
  await openView(page, 'tasks');
  await page.locator(`.task-card[data-task-id="${dependent.id}"]`).click();
  await expect(page.locator('#fields [name="title"]')).toHaveValue(dependent.title);
  await page.locator(`[data-dependency-jump="task:${source.id}"]`).click();
  await expect(page.locator('#fields [name="title"]')).toHaveValue(source.title);
  await expect(page.locator('#record-back')).toBeVisible();
  await expectViewportContained(page);
  await page.locator('#record-back').click();
  await expect(page.locator('#fields [name="title"]')).toHaveValue(dependent.title);
  await expect(page.locator('#record-back')).toBeHidden();
});
