import { test, expect } from '@playwright/test';
import { screenshot } from './helpers';

test.describe('Scenario 5: Password Reset Flow', () => {
  test('forgot password page loads and form works', async ({ page }) => {
    await page.goto('/forgot-password');
    await screenshot(page, '05-forgot-password');

    // Check we're on the forgot password page
    await expect(page.locator('h1').or(page.locator('h2'))).toBeVisible();

    // Email input should be present
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible();

    // Submit button should be present
    const submitBtn = page.locator('button[type="submit"]');
    await expect(submitBtn).toBeVisible();

    // Should have a link back to login
    await expect(page.getByText(/sign in/i).or(page.locator('a[href*="login"]'))).toBeVisible();
  });

  test('reset password page renders if token is in URL', async ({ page }) => {
    await page.goto('/reset-password?token=test-token');
    await screenshot(page, '05-reset-password');

    // Reset password page should render
    await expect(page.getByText('Choose a new password')).toBeVisible({ timeout: 10000 });

    // Password inputs should exist
    const passwordInputs = page.locator('input[type="password"]');
    const count = await passwordInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);

    // Submit button should be present
    const setNewPasswordBtn = page.getByRole('button', { name: 'Set New Password' });
    await expect(setNewPasswordBtn).toBeVisible();
  });
});
