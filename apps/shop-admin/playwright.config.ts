import { defineConfig } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  webServer: {
    command:
      "CATEGORYFIX_E2E_MOCK=1 PORT=4173 pnpm --filter @categoryfix/shop-admin build && CATEGORYFIX_E2E_MOCK=1 PORT=4173 pnpm --filter @categoryfix/shop-admin start",
    port,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
