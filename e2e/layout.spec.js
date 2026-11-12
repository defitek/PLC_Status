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

  await openView(page, 'tasks');
  await expect(page.locator('.workspace-tabs')).toContainText('Zależności zewnętrzne');
  await expect(page.locator('#task-queue-mode')).toHaveCount(0);

  await page.locator('[data-view="planner"]').evaluate(button => button.click());
  await expect(page.locator('.workspace-tabs')).toContainText('Kalendarz');
  await page.getByRole('button', { name: 'Kalendarz' }).click();
  await expect(page.locator('#title')).toHaveText('Plan · Kalendarz');

  await page.locator('[data-view="announcements"]').evaluate(button => button.click());
  await expect(page.locator('.workspace-tabs')).toContainText('Centrum wiadomości');
  await expect(page.locator('.message-center-section h2').first()).toHaveText('Do działania');
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
