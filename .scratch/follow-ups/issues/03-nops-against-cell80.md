# 03: A test compares nops.ts with the cell80 clock

**What to build:** The WebAssembly build of cell80 counts T-states, aligned on 4 at each bus access and at the end of each instruction, and a test of `pnpm test:core` checks that `nops.ts` gives the same NOPs for every instruction of the SingleStepTests suite, except the known differences. See the spec, story 3 and the clock decision.

**Blocked by:** none.

**Status:** ready-for-agent

- [ ] The Rust bus in `wasm/src/lib.rs` counts the T-states of `tick()`, aligns the count up to a multiple of 4 at each `read`, `write`, `input` and `output` and at the end of `step()`, and exposes it; `src/cpu/cell80.ts` reads it.
- [ ] A Run still reads its NOPs from `nops.ts`: only the test reads the clock.
- [ ] The test runs in `pnpm test:core` on the fetched SingleStepTests suite. It lists the known differences (`IN r,(C)`, `OUT (C),r`, repeated `OTIR` and `OTDR`) and fails on any other, naming the instruction, `nops.ts`'s NOPs and the clock's.
- [ ] The agreement count matches the 2026-10-24 measurement (3 524 out of 3 560), or the difference is explained in the session report.
- [ ] `cell80.wasm` rebuilt with `pnpm build:wasm` and committed.
- [ ] ADR 0002 gets the consequence; docs/MODULES.md describes the clock in the CPU module.
