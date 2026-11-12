import { defineConfig } from "vitest/config";

// The tests on SingleStepTests/z80, 1.6 million cases each, kept out of `pnpm test`.
export const SUITE_TESTS = [
  "src/cpu/single-step-tests.test.ts",
  "src/nops.cell80.test.ts",
];

export default defineConfig({
  test: {
    include: SUITE_TESTS,
  },
});
