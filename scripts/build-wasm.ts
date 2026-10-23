// Builds src/cpu/cell80.wasm from wasm/. Cargo runs inside wasm/ so that rustup
// picks the toolchain pinned in wasm/rust-toolchain.toml.
import { spawnSync } from "node:child_process";
import { copyFileSync } from "node:fs";

const cargo = spawnSync(
  "cargo",
  ["build", "--release", "--target", "wasm32-unknown-unknown"],
  { cwd: "wasm", stdio: "inherit" },
);
if (cargo.status !== 0) {
  process.exit(cargo.status ?? 1);
}
copyFileSync(
  "wasm/target/wasm32-unknown-unknown/release/z80_tdd_cpu.wasm",
  "src/cpu/cell80.wasm",
);
