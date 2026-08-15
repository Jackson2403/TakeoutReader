import { test, expect } from '@playwright/test';
import { TAKE_OUT_ZIP } from './fixtures';

test.describe('TakeoutReader end-to-end', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Ensure a clean IndexedDB instance per test.
    await page.evaluate(() => indexedDB.deleteDatabase('takeout-reader'));
    await page.reload();
  });

  test('ingests a Takeout zip and reflects it on the dashboard', async ({ page }) => {
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'takeout.zip',
      mimeType: 'application/zip',
      buffer: TAKE_OUT_ZIP,
    });

    // Outcome message appears (records imported).
    await expect(page.getByText(/records imported/)).toBeVisible({ timeout: 20000 });

    // Dashboard stat cards show per-service counts.
    await expect(page.getByText('YouTube').first()).toBeVisible();
    await expect(page.getByText('My Activity')).toBeVisible();
    await expect(page.getByText('Location')).toBeVisible();
  });

  test('searches indexed records and finds a match', async ({ page }) => {
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'takeout.zip',
      mimeType: 'application/zip',
      buffer: TAKE_OUT_ZIP,
    });
    await expect(page.getByText(/records imported/)).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: 'Search' }).click();
    const searchInput = page.getByPlaceholder(/Search titles, channels/);
    await searchInput.fill('pasta');
    await expect(page.getByText(/Intro to pasta making/)).toBeVisible({ timeout: 10000 });
  });

  test('riduplicate re-import of the same zip is skipped as duplicate', async ({ page }) => {
    const input = page.locator('[data-testid="file-input"]');
    await input.setInputFiles({ name: 'takeout.zip', mimeType: 'application/zip', buffer: TAKE_OUT_ZIP });
    await expect(page.getByText(/records imported/)).toBeVisible({ timeout: 20000 });

    // Also reflect a fresh reload so the app sees a "second" import.
    await page.reload();
    await input.setInputFiles({ name: 'takeout.zip', mimeType: 'application/zip', buffer: TAKE_OUT_ZIP });
    await expect(page.getByText(/already imported \(skipped\)/)).toBeVisible({ timeout: 20000 });
  });

  test('insights renders after import', async ({ page }) => {
    await page.setInputFiles('[data-testid="file-input"]', {
      name: 'takeout.zip',
      mimeType: 'application/zip',
      buffer: TAKE_OUT_ZIP,
    });
    await expect(page.getByText(/records imported/)).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: 'Insights' }).click();
    await expect(page.getByText('Top channels')).toBeVisible();
    await expect(page.getByText(/A lovely cat video/)).not.toBeVisible();
  });
});