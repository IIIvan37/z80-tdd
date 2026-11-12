import { defineConfig } from "vitest/config";

// The tests on SingleStepTests/z80, kept out of `pnpm test`.
export default defineConfig({
  test: {
    include: ["src/cpu/single-step-tests.test.ts", "src/nops.cell80.test.ts"],
  },
});
