# The cell80-z80 core, shipped as WebAssembly

We replace `z80-emulator` with [cell80-z80](https://github.com/chrishayuk/cell80/tree/main/z80), a Rust core compiled to a WebAssembly file shipped inside the package. Against SingleStepTests/z80, `z80-emulator` failed 334 of 1,604 files. Some of those failures matter to a CPC developer: a DD/FD prefix before a non-indexed opcode skipped the instruction, `LD A,R` lost bit 3, `LD R,A` lost bit 7, and `IN F,(C)` took the carry from the byte read. The package is also deprecated on npm. cell80-z80 passes all 1,604,000 cases with no change, the Q latch included. On 18 million random instructions it showed no difference from redcode/Z80, the core the suite itself is validated against ([research](../research/z80-core-candidates.md)). This amends [ADR 0001](0001-typescript-with-a-pure-javascript-z80-core.md): what we kept from it is "no native compilation at install", which a prebuilt WebAssembly file meets as well as pure JavaScript does.

We rejected three alternatives:

- floooh's `z80.h`: mature, but it needs 89 lines of our own C on top to reach 100 % (Q, `HALT`, block-repeat flags).
- Our own TypeScript core: 2 to 4 days of work, and about 2,000 lines to maintain.
- redcode/Z80: the reference, and the only core with the NEC and CMOS variants, but LGPL-3.0.

## Consequences

- **A young project, contained.** cell80-z80 is four months old and has a single author. We vendor a pinned copy of its source in `wasm/vendor/cell80-z80/` and only call it through the CPU interface. If it goes wrong, floooh's `z80.h` plus that layer is the verified fallback behind the same interface.
- **The maintainer needs Rust to change the core.** `pnpm build:wasm` builds `src/cpu/cell80.wasm` with the toolchain pinned in `wasm/rust-toolchain.toml`. The file is committed, so tests and installs need no Rust. CI rebuilds it and fails if it differs from the committed file, then runs SingleStepTests against it.
- **The package carries a licence notice.** The cell80-z80 MIT licence ships next to the `.wasm` file in `dist/cpu/`.
- **The CPU owns its memory.** The 64 KB live inside the WebAssembly instance, and the Run writes the Program into them.
- **Not modelled:**
  - the NEC and CMOS variants (bits 3 and 5 after `SCF`/`CCF`, and `OUT (C),0`);
  - the interrupt-only P latch.

  A Routine that relies on them is out of scope for v1.
