const { test, expect } = require('@playwright/test');

test('runtime disables development identity and unsafe token fallback', async ({ page }) => {
  await page.goto('/zhiyi-assistant-prototype.html');
  const config = await page.evaluate(() => window.ZHIYI_CONFIG);
  expect(config.environment).toBe('production');
  expect(config.allowDevIdentity).toBe(false);
  expect(await page.content()).not.toContain('dev-token');
});
