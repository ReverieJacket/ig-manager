import { chromium, defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: 'html',
  timeout: 60000,
  use: {
    browserName: 'webkit',
     locale: 'pt-BR',
    headless: false
  },

});
