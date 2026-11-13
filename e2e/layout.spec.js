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
  for (const [id, palette] of Object.entries(palettes)) {
    expect(tokens[id].palette).toEqual(palette);
    expect(tokens[id].statuses).toEqual(['#1769D2', '#925D00', '#117A4D', '#B42318']);
  }
  await expectViewportContained(page);
  await page.locator('#theme-close').click();
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
