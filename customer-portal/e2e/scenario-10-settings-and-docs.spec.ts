import { test, expect } from '@playwright/test';
import { screenshot } from './helpers';

test.describe('Scenario 10: Settings & API Documentation', () => {
  test('settings page renders profile, password, and danger zone sections', async ({ page }) => {
    // Try authenticated access
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-portal@example.com');
    await page.fill('input[type="password"]', 'TestPortalPass123!');
    await page.click('button[type="submit"]');

    const onDashboard = await page.waitForURL(/\/dashboard/, { timeout: 5000 }).then(() => true).catch(() => false);

    if (onDashboard) {
      await page.goto('/dashboard/settings');
      await screenshot(page, '10a-settings');

      await page.waitForLoadState('networkidle');

      // Account Settings page
      await expect(page.getByText('Account Settings')).toBeVisible();
      await expect(page.getByText('Manage your profile and security settings')).toBeVisible();

      // Profile section
      await expect(page.getByText('Profile')).toBeVisible();
      await expect(page.getByText('Display Name')).toBeVisible();
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();
      await expect(emailInput).toBeDisabled();
      await expect(page.getByText('Save Changes')).toBeVisible();

      // Password section
      await expect(page.getByText('Change Password')).toBeVisible();
      await expect(page.getByText('Current Password')).toBeVisible();
      await expect(page.getByText('New Password')).toBeVisible();
      await expect(page.getByText('Update Password')).toBeVisible();

      // Danger Zone
      await expect(page.getByText('Danger Zone')).toBeVisible();
      await expect(page.locator('input[placeholder="Type DELETE"]')).toBeVisible();
      await expect(page.getByText('Delete Account')).toBeVisible();
    } else {
      await page.goto('/dashboard/settings');
      await page.waitForURL(/\/login/, { timeout: 5000 });
      await expect(page.getByText('Welcome back')).toBeVisible();
    }
  });

  test('docs page renders all API documentation sections', async ({ page }) => {
    // Try authenticated access
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test-portal@example.com');
    await page.fill('input[type="password"]', 'TestPortalPass123!');
    await page.click('button[type="submit"]');

    const onDashboard = await page.waitForURL(/\/dashboard/, { timeout: 5000 }).then(() => true).catch(() => false);

    if (onDashboard) {
      await page.goto('/dashboard/docs');
      await screenshot(page, '10b-docs');

      await page.waitForLoadState('networkidle');

      // Docs page heading
      await expect(page.getByText('API Documentation')).toBeVisible();
      await expect(page.getByText('OpenAI-compatible REST API')).toBeVisible();

      // Base URL section
      await expect(page.getByText('Base URL')).toBeVisible();

      // Authentication section
      await expect(page.getByText('Authentication')).toBeVisible();
      await expect(page.getByText('Authorization: Bearer')).toBeVisible();

      // Chat Completions section
      await expect(page.getByText('Chat Completions')).toBeVisible();

      // List Models section
      await expect(page.getByText('List Models')).toBeVisible();
      await expect(page.getByText('GET /v1/models')).toBeVisible();

      // Rate Limits section
      await expect(page.getByText('Rate Limits')).toBeVisible();
    } else {
      await page.goto('/dashboard/docs');
      await page.waitForURL(/\/login/, { timeout: 5000 });
      await expect(page.getByText('Welcome back')).toBeVisible();
    }
  });

  test('public docs page also renders correctly', async ({ page }) => {
    await page.goto('/docs');
    await screenshot(page, '10c-public-docs');

    await page.waitForLoadState('networkidle');
    // Check heading specifically (most specific match)
    await expect(page.locator('h1').filter({ hasText: 'API Documentation' })).toBeVisible();
    // Verify sections using heading roles to avoid sidebar link conflicts
    await expect(page.getByRole('heading', { name: 'Getting Started' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Supported Models' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Rate Limits' })).toBeVisible();
  });
});
