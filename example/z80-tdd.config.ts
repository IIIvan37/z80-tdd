import { defineConfig } from "z80-tdd";

export default defineConfig({
  source: "src/main.asm",
  nopLimit: 10_000,
});
