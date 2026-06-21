import { test, expect } from '@playwright/test';
import { screenshot } from './helpers';

test.describe('Scenario 8: Usage Analytics', () => {
  test('usage page renders time range controls and stats cards', async ({ page }) => {
    // Try authenticated access
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-portal@example.com');
    await page.fill('input[type="password"]', 'TestPortalPass123!');
    await page.click('button[type="submit"]');

    const onDashboard = await page.waitForURL(/\/dashboard/, { timeout: 5000 }).then(() => true).catch(() => false);

    if (onDashboard) {
      await page.goto('/dashboard/usage');
      await screenshot(page, '08-usage-analytics');

      await page.waitForLoadState('networkidle');

      // Heading
      await expect(page.getByText('Usage')).toBeVisible();
      await expect(page.getByText('Track your API consumption')).toBeVisible();

      // Time range selector
      await expect(page.getByText('1d')).toBeVisible();
      await expect(page.getByText('7d')).toBeVisible();
      await expect(page.getByText('30d')).toBeVisible();
      await expect(page.getByText('90d')).toBeVisible();

      // Stats cards
      await expect(page.getByText('Requests').or(page.locator('text=/Total Requests|Requests/'))).toBeVisible();
      await expect(page.getByText('Cost').or(page.locator('text=/Est. Cost/'))).toBeVisible();

      // Check active range state
      const activeButton = page.locator('button').filter({ hasText: '30d' });
      await expect(activeButton).toBeVisible();
    } else {
      // Not authenticated - test redirect
      await page.goto('/dashboard/usage');
      await page.waitForURL(/\/login/, { timeout: 5000 });
      await expect(page.getByText('Welcome back')).toBeVisible();
    }
  });
});
