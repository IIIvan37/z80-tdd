import { defineConfig } from "vitest/config";
import { SUITE_TESTS } from "./vitest.core.config.ts";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // `pnpm test:core` runs them.
    exclude: SUITE_TESTS,
  },
});
