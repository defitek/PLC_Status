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
  const savedCell = page.locator(`.planner-cell[data-user-id="${userId}"][data-date="${date}"]`);
  const transportChip = savedCell.locator(`.plan-chip.transport-only:has(.plan-note[data-note="${transportNote}"])`);
  await expect(transportChip).toContainText(transportCode);
  await expect(transportChip).toContainText('7 h 17 min');
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
  await freeCell.click();
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
  await workCell.click();
  await page.keyboard.press('p');
  await expect(page.locator('#action-title')).toContainText('Dodaj pracę');
  const rootAreaValues = await page.locator('#action-fields [name="controller_group_ids"]').evaluateAll(inputs => inputs.map(input => ({ value: input.value, label: input.closest('label')?.textContent?.trim() || '' })).filter(item => !item.label.includes(' / ')).slice(0, 2).map(item => item.value));
  expect(rootAreaValues).toHaveLength(2);
  await page.locator('#action-fields [data-ui-multiselect="controller_group_ids"] summary').click();
  for (const value of rootAreaValues) await page.locator(`#action-fields [name="controller_group_ids"][value="${value}"]`).check();
  await page.locator('#action-fields [name="note"]').fill(workNote);
  await page.locator('#action-submit').click();
  await expect(workCell.locator(`.plan-chip[data-current-project="1"]:has(.plan-note[data-note="${workNote}"])`)).toHaveCount(2);

  await workCell.click();
  await page.keyboard.press('e');
  const groupedWorkRow = page.locator('#planner-entry-list .planner-entry-row:not(.transport-entry)').filter({ has: page.locator(`[data-plan-note][value="${workNote}"]`) });
  await expect(groupedWorkRow).toHaveCount(1);
  await expect(groupedWorkRow.locator('[data-plan-area]:checked')).toHaveCount(2);
  await groupedWorkRow.locator('[data-plan-manpower]').uncheck();
  await page.locator('#planner-form .dialog-actions .primary').click();
  await expect(workCell.locator(`.plan-chip.excluded-from-manpower:has(.plan-note[data-note="${workNote}"])`)).toHaveCount(2);

  const genericCell = page.locator('.planner-cell[data-editable="1"]:not(.planned):not(.absent)').first();
  const genericUserId = await genericCell.getAttribute('data-user-id');
  const genericDate = await genericCell.getAttribute('data-date');
  await genericCell.click();
  await page.keyboard.press('p');
  await page.locator('#action-fields [name="count_in_manpower"]').uncheck();
  await page.locator('#action-fields [name="note"]').fill(genericNote);
  await page.locator('#action-submit').click();
  const savedGenericCell = page.locator(`.planner-cell[data-user-id="${genericUserId}"][data-date="${genericDate}"]`);
  await expect(savedGenericCell.locator(`.plan-chip.excluded-from-manpower:has(.plan-note[data-note="${genericNote}"])`)).toContainText('poza manpowerem');

  await savedGenericCell.click();
  await page.keyboard.press('e');
  await page.locator('#planner-entry-list .remove-plan-entry').click();
  await page.locator('#planner-entry-add').click();
  const directGenericRow = page.locator('#planner-entry-list .planner-entry-row:not(.transport-entry)').first();
  await expect(directGenericRow.locator('[data-plan-area-none]')).toBeChecked();
  await expect(directGenericRow.locator('[data-plan-area]:checked')).toHaveCount(0);
  await expect(directGenericRow.locator('[data-plan-manpower]')).toBeChecked();
  await page.locator('#planner-form .dialog-actions .primary').click();
  await expect(savedGenericCell.locator('.plan-chip[data-current-project="1"]:not(.excluded-from-manpower)')).toContainText('Bez obszaru');

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
  await page.locator('#action-fields [name="new_group_name"]').fill(configured.copyName);
  await page.locator('#action-submit').click();
  await expect(page.locator('#action-dialog')).not.toBeVisible();
  await expect(page.locator('.status-config-group', { hasText: configured.copyName })).toBeVisible();
  await sourceCard.locator('.status-config-group-toggle').click();
  await expect(sourceCard.locator('.status-config-group-body')).toBeHidden();
  await expectViewportContained(page);
});

test('Status przełącza globalne i wewnętrzne grupowanie funkcyjne', async ({ page }) => {
  await openView(page, 'status');
  await page.locator('#status-group-functional').click();
  await page.locator('#action-fields [name="mode"]').selectOption('global');
  await page.locator('#action-submit').click();
  await expect(page.locator('#status-group-functional')).toContainText('globalne');
  await expect(page.locator('.status-functional-global').first()).toBeVisible();

  await page.locator('#status-group-functional').click();
  await page.locator('#action-fields [name="mode"]').selectOption('within');
  await page.locator('#action-submit').click();
  await expect(page.locator('#status-group-functional')).toContainText('wewnątrz grup');
  await expect(page.locator('.matrix-functional-group-row').first()).toBeVisible();
  await expectViewportContained(page);
});

test('Planner sortuje kafelki i zwija nadmiar powyżej trzech', async ({ page }) => {
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
  await expect(savedCell.locator('.plan-chip:visible')).toHaveCount(3);
  await expect(savedCell.locator('.plan-chip').nth(0)).toHaveClass(/transport-only/);
  await expect(savedCell.locator('.plan-chip').nth(1)).toContainText('Bez obszaru');
  await expect(savedCell.locator('.planner-cell-expand')).toHaveText('+1');
  await savedCell.locator('.planner-cell-expand').click();
  await expect(savedCell.locator('.plan-chip:visible')).toHaveCount(4);
  await expect(savedCell.locator('.plan-chip').nth(2)).toContainText(areas[0].name);
  await expect(savedCell.locator('.plan-chip').nth(3)).toContainText(areas[1].name);
  await expectViewportContained(page);
  await page.evaluate(async ({ userId, date }) => {
    const response = await fetch('/api/planner/day', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId, plan_date: date, entries: [] }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Nie udało się posprzątać planu testowego');
  }, { userId, date });
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
