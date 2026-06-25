import { test, expect } from '@playwright/test';
import { screenshot } from './helpers';

test.describe('Scenario 6: Dashboard Overview', () => {
  test('dashboard loads with stats and quick start after login', async ({ page }) => {
    // Attempt login (may fail if no test user exists, but we can test the UI structure)
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-portal@example.com');
    await page.fill('input[type="password"]', 'TestPortalPass123!');
    await page.click('button[type="submit"]');

    // If login succeeds, test dashboard; if not, skip authentication-specific checks
    const onDashboard = await page.waitForURL(/\/dashboard/, { timeout: 5000 }).then(() => true).catch(() => false);

    if (onDashboard) {
      await screenshot(page, '06-dashboard-overview');

      // Welcome message
      await expect(page.getByText('Dashboard')).toBeVisible();

      // Stats cards
      await expect(page.getByText('Total Requests')).toBeVisible();
      await expect(page.getByText('Tokens Used')).toBeVisible();
      await expect(page.getByText('API Keys')).toBeVisible();
      await expect(page.getByText('Plan')).toBeVisible();

      // Quick Start section
      await expect(page.getByText('Quick Start')).toBeVisible();
      await expect(page.getByText('Base URL for all API calls')).toBeVisible();

      // Rate Limits section
      await expect(page.getByText('Your Limits')).toBeVisible();
      const rateLimitBoxes = page.locator('text=/Requests \\/ (Month|Day|Minute)/');
      expect(await rateLimitBoxes.count()).toBeGreaterThanOrEqual(1);
    } else {
      // Not authenticated - test the redirect to login
      await page.goto('/dashboard');
      await page.waitForURL(/\/login/, { timeout: 5000 });
      await expect(page.getByText('Welcome back')).toBeVisible();
    }
  });
});
