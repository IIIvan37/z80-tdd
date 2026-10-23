import { defineConfig } from "vitest/config";

// The CPU contract test against SingleStepTests/z80, kept out of `pnpm test`.
export default defineConfig({
  test: {
    include: ["src/cpu/single-step-tests.test.ts"],
  },
});
