import { test, expect } from '@playwright/test';
import { screenshot } from './helpers';

test.describe('Scenario 2: Models Catalog', () => {
  test('renders models page with benchmarks and cards', async ({ page }) => {
    await page.goto('/models');
    await screenshot(page, '02-models-catalog');

    // Hero section
    await expect(page.getByText('Every Frontier Model')).toBeVisible();
    await expect(page.getByText('One API.', { exact: true })).toBeVisible();

    // Intelligence leaderboard
    await expect(page.getByText('Intelligence Leaderboard')).toBeVisible();

    // Speed & Price sections (may be skeleton loading)
    await expect(page.getByText('Speed & Price Comparison')).toBeVisible({ timeout: 15000 });

    // Model cards grid
    await expect(page.locator('.glass-card').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Available Models')).toBeVisible();

    // "Why cheaper" section
    await expect(page.getByText('Why Cheaper Than the Labs?')).toBeVisible();
    await expect(page.getByText('Smart Routing')).toBeVisible();
    await expect(page.getByText('Volume Purchasing')).toBeVisible();
    await expect(page.getByText('Load Balancing')).toBeVisible();

    // CTA
    await expect(page.getByText('Get Free API Key')).toBeVisible();
    await expect(page.getByText('Read the Docs')).toBeVisible();
  });
});
