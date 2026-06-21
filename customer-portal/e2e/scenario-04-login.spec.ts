import { test, expect } from '@playwright/test';
import { screenshot } from './helpers';

test.describe('Scenario 4: User Login', () => {
  test('login form renders with all elements and shows error for invalid creds', async ({ page }) => {
    await page.goto('/login');
    await screenshot(page, '04-login');

    // Page title
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Sign in to your developer account')).toBeVisible();

    // OAuth buttons
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.getByText('Continue with GitHub')).toBeVisible();
    await expect(page.getByText('Continue with Apple')).toBeVisible();

    // Form fields
    await expect(page.locator('input[placeholder="you@example.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder="••••••••"]')).toBeVisible();

    // Forgot password link
    await expect(page.getByText('Forgot password?')).toBeVisible();

    // Submit button
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();

    // Signup link
    await expect(page.getByText("Don't have an account?")).toBeVisible();
    await expect(page.getByText('Sign up')).toBeVisible();

    // Try invalid credentials
    await page.fill('input[type="email"]', 'nonexistent@test.com');
    await page.fill('input[type="password"]', 'WrongPass123!');
    await page.click('button[type="submit"]');

    // Should show error (check the error div which has red text)
    await page.waitForSelector('[class*="text-\\[\\#ef4444\\]"], [class*="text-red"]', { timeout: 10000 }).catch(() => {});
    const errorDiv = page.locator('div.text-sm').filter({ hasText: /Invalid|error|failed/i }).first();
    await expect(errorDiv).toBeVisible({ timeout: 10000 }).catch(() => {
      // If specific error div not found, check for any red-colored error
      const anyError = page.locator('[style*="color"], [class*="danger"]').filter({ hasText: /Invalid|error|failed/i }).first();
      return expect(anyError).toBeVisible({ timeout: 5000 });
    });
  });

  test('navigates to forgot password page', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Forgot password?').click();
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test('navigates to signup page', async ({ page }) => {
    await page.goto('/login');
    await page.getByText('Sign up').click();
    await expect(page).toHaveURL(/\/signup/);
  });
});
