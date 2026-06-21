import { test, expect } from '@playwright/test';
import { screenshot } from './helpers';

test.describe('Scenario 1: Landing Page', () => {
  test('loads all critical sections correctly', async ({ page }) => {
    await page.goto('/');
    await screenshot(page, '01-landing-page');

    // Hero section
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByText('Smart AI Routing')).toBeVisible();

    // Stats strip
    const stats = page.locator('.stat-value');
    await expect(stats.first()).toBeVisible();

    // Provider trust strip
    await expect(page.getByText('Direct access to all major AI providers')).toBeVisible();

    // Intelligence leaderboard section
    await expect(page.getByText('Intelligence Rankings')).toBeVisible();

    // Routing decision log
    await expect(page.getByText('Every Decision, Explained')).toBeVisible();

    // Failover transparency
    await expect(page.getByText('Failover Transparency')).toBeVisible();

    // Pricing section
    await expect(page.getByText('Get the same usage and models')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pro', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Max 5x', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Max 20x', exact: true })).toBeVisible();

    // CTA buttons
    await expect(page.getByText('Start Building for Free')).toBeVisible();
    await expect(page.getByText('Explore Models')).toBeVisible();

    // Footer
    await expect(page.locator('footer')).toBeVisible();
  });
});
