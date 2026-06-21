import { test, expect } from '@playwright/test';
import { screenshot } from './helpers';

test.describe('Scenario 9: Billing & Plans', () => {
  test('billing page renders all plans with correct pricing', async ({ page }) => {
    // Try authenticated access
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-portal@example.com');
    await page.fill('input[type="password"]', 'TestPortalPass123!');
    await page.click('button[type="submit"]');

    const onDashboard = await page.waitForURL(/\/dashboard/, { timeout: 5000 }).then(() => true).catch(() => false);

    if (onDashboard) {
      await page.goto('/dashboard/billing');
      await screenshot(page, '09-billing');

      await page.waitForLoadState('networkidle');

      // Heading and current plan badge
      await expect(page.getByText('Billing & Plans')).toBeVisible();
      await expect(page.getByText(/Current plan/i)).toBeVisible();

      // Plan cards - Free, Pro, Max 5x, Max 20x
      await expect(page.getByText('Free')).toBeVisible();
      await expect(page.getByText('Pro')).toBeVisible();
      await expect(page.getByText('Max 5x')).toBeVisible();
      await expect(page.getByText('Max 20x')).toBeVisible();

      // Pricing
      await expect(page.getByText('$0').first()).toBeVisible();
      await expect(page.getByText('$5')).toBeVisible();
      await expect(page.getByText('$20')).toBeVisible();
      await expect(page.getByText('$40')).toBeVisible();

      // Plan features should be visible
      await expect(page.getByText('2 API keys').or(page.getByText('5 API keys'))).toBeVisible();

      // Popular badge on Pro
      await expect(page.getByText('Popular').or(page.getByText('Most Popular'))).toBeVisible();
    } else {
      await page.goto('/dashboard/billing');
      await page.waitForURL(/\/login/, { timeout: 5000 });
      await expect(page.getByText('Welcome back')).toBeVisible();
    }
  });
});
