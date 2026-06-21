import { test, expect } from '@playwright/test';
import { screenshot } from './helpers';

test.describe('Scenario 3: User Registration', () => {
  test('signup form renders with all fields and validation', async ({ page }) => {
    await page.goto('/signup');
    await screenshot(page, '03-signup');

    // Page title
    await expect(page.getByText('Create your account')).toBeVisible();
    await expect(page.getByText('Start building with AI in minutes')).toBeVisible();

    // OAuth buttons
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.getByText('Continue with GitHub')).toBeVisible();
    await expect(page.getByText('Continue with Apple')).toBeVisible();

    // Form fields
    await expect(page.locator('input[placeholder="John Doe"]')).toBeVisible();
    await expect(page.locator('input[placeholder="you@example.com"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Min 8 characters"]')).toBeVisible();

    // Submit button
    await expect(page.getByText('Create Account')).toBeVisible();

    // Login link
    await expect(page.getByText('Already have an account?')).toBeVisible();
    await expect(page.getByText('Sign in')).toBeVisible();

    // Free tier notice
    await expect(page.getByText('Free tier includes 50 requests/month total')).toBeVisible();

    // Try submitting empty form
    await page.click('button[type="submit"]');
    // Browser validation should prevent submission
    await expect(page).toHaveURL(/\/signup/);
  });
});
