import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // 1.6 million cases: `pnpm test:core` runs them, see vitest.core.config.ts.
    exclude: ["src/cpu/single-step-tests.test.ts"],
  },
});
