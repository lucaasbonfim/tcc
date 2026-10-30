import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir:'./e2e',fullyParallel:false,workers:1,timeout:60000,
  use:{baseURL:'http://localhost:5178',headless:true,trace:'retain-on-failure',
    launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH} : {}},
  webServer:[
    {command:'node ../backend/test-support/browser-server.js',url:'http://127.0.0.1:3101/api/auth/me',reuseExistingServer:false,timeout:30000},
    {command:'npm run dev -- --host localhost --port 5178 --strictPort',url:'http://localhost:5178',reuseExistingServer:false,
      env:{VITE_API_URL:'http://localhost:3101/api'},timeout:30000},
  ],
});
