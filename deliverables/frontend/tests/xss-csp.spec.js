const { test, expect } = require('@playwright/test');

test('prototype uses strict CSP and no inline executable resources', async ({ page }) => {
  const violations = [];
  await page.exposeFunction('recordViolation', (value) => violations.push(value));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (event) => window.recordViolation(event.violatedDirective)));
  await page.goto('/zhiyi-assistant-prototype.html');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  expect(await page.locator('[onclick],[onerror],[onload]').count()).toBe(0);
  expect(violations).toEqual([]);
});
