const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: { command: 'python -m http.server 4173 --bind 127.0.0.1', port: 4173, reuseExistingServer: false },
  reporter: 'list',
});
