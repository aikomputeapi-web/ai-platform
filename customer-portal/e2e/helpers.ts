import { Page, expect } from '@playwright/test';

export async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });
}

export async function loginAsTestUser(page: Page, email = 'test@example.com', password = 'TestPass123!') {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

export function assertVisible(page: Page, selector: string) {
  return expect(page.locator(selector)).toBeVisible({ timeout: 10000 });
}

export function assertNotVisible(page: Page, selector: string) {
  return expect(page.locator(selector)).not.toBeVisible({ timeout: 5000 });
}

export function assertText(page: Page, selector: string, text: string) {
  return expect(page.locator(selector)).toContainText(text, { timeout: 10000 });
}

export function assertCount(page: Page, selector: string, count: number) {
  return expect(page.locator(selector)).toHaveCount(count);
}
