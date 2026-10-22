import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-full-stack",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:18090",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{
    name: "chromium-full-stack",
    use: { ...devices["Desktop Chrome"] },
  }],
});

