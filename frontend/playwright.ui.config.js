import {defineConfig} from '@playwright/test';

// UI contracts use intercepted requests and never connect to a database.
export default defineConfig({
  testDir:'./ui-tests', workers:1, timeout:30000,
  use:{baseURL:'http://localhost:5189',headless:true,trace:'retain-on-failure',
    channel:process.env.PLAYWRIGHT_CHANNEL || undefined,
    launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}},
  webServer:{command:'npm run dev -- --host localhost --port 5189 --strictPort',url:'http://localhost:5189',reuseExistingServer:false,env:{VITE_API_URL:'http://localhost:5189/api'}},
});
