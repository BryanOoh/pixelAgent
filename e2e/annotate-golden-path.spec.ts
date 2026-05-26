import { test, expect } from '@playwright/test';

const TOOLBAR = '[data-pixelagent-toolbar-portal]';
const NOTE = 'golden path e2e note';

test.describe('Annotate golden path', () => {
  test.beforeEach(async ({ context, page }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
  });

  test('Click → Note → Add → toolbar Copy → markdown clipboard', async ({ page }) => {
    await page.locator(TOOLBAR).getByRole('button', { name: 'Annotate' }).click();
    await page.locator('.site-hero-lead').click({ force: true });

    const dialog = page.getByRole('dialog', { name: 'Add annotation' });
    await expect(dialog).toBeVisible();
    await dialog.locator('textarea').fill(NOTE);
    await dialog.getByRole('button', { name: 'Add', exact: true }).click();

    await expect(page.getByText(`Session (1)`)).toBeVisible();

    await page
      .locator(TOOLBAR)
      .getByRole('button', { name: 'Copy all annotations' })
      .click();

    await expect
      .poll(async () => page.evaluate(() => navigator.clipboard.readText()))
      .toMatch(/# PixelAgent Annotations \(1\)/);

    const markdown = await page.evaluate(() => navigator.clipboard.readText());
    expect(markdown).toContain(NOTE);
    expect(markdown).toContain('**note:**');
    expect(markdown).toMatch(/site-hero-lead|\.site-hero-lead/);
  });

  test('Session Copy all matches toolbar export', async ({ page }) => {
    await page.locator(TOOLBAR).getByRole('button', { name: 'Annotate' }).click();
    await page.locator('.site-hero-lead').click({ force: true });
    await page.getByRole('dialog', { name: 'Add annotation' }).locator('textarea').fill(NOTE);
    await page.getByRole('dialog', { name: 'Add annotation' }).getByRole('button', { name: 'Add', exact: true }).click();

    await page
      .locator(TOOLBAR)
      .getByRole('button', { name: 'Copy all annotations' })
      .click();
    const fromToolbar = await page.evaluate(() => navigator.clipboard.readText());

    await page.getByRole('button', { name: 'Copy all' }).click();
    const fromSession = await page.evaluate(() => navigator.clipboard.readText());

    expect(fromSession).toBe(fromToolbar);
    expect(fromSession).toContain(NOTE);
  });
});
