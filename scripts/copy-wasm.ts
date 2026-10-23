// Copies the CPU's WebAssembly file into dist/, next to the compiled adapter that loads it,
// with the licence of the cell80-z80 code compiled into it.
import { copyFileSync } from "node:fs";

copyFileSync("src/cpu/cell80.wasm", "dist/cpu/cell80.wasm");
copyFileSync(
  "wasm/vendor/cell80-z80/LICENSE-MIT",
  "dist/cpu/cell80.LICENSE-MIT",
);
