# 02: Validate the Z80 core with SingleStepTests

**What to build:** The maintainer can trust the Z80 core: the SingleStepTests/z80 suite runs against the CPU adapter in CI, checking registers (including WZ/MEMPTR and the undocumented flag bits), memory and port activity for every opcode. See the spec, story 58, and ADR 0001.

**Blocked by:** 01 (Walking skeleton).

**Status:** done

- [x] The SingleStepTests/z80 cases run against the CPU adapter, through the CPU interface only.
- [ ] CI runs the suite; it is fetched or cached so a normal test run stays fast.
- [x] Every failing case is either fixed in the adapter or listed with the reason it does not matter for z80-tdd (for example, a state the tool never exposes).
- [x] If the core fails on behaviour that matters, the ticket records the decision (replace the core or write our own) in a new ADR, and the rest of the tool is untouched.

## Comments

- 2026-10-23: `z80-emulator` failed 334 of 1,604 files, some on behaviour that matters (DD/FD prefix before a non-indexed opcode, `LD A,R`, `LD R,A`, `IN F,(C)`). [ADR 0004](../../../docs/adr/0004-cell80-z80-core-as-webassembly.md) replaces it with cell80-z80 compiled to WebAssembly, chosen from [the research](../../../docs/research/z80-core-candidates.md).
- cell80-z80 passes all 1,604,000 cases, comparing every register, WZ, IFF1, IFF2, IM, Q, the RAM each case lists, port reads and writes, and the absence of writes elsewhere in memory. No case is left failing, so no case needed listing. The suite's `ei` and `p` fields are not compared: they only matter when an interrupt is accepted.
- `pnpm test:core` fetches the suite (pinned commit `ebe1875`) into `.cache/` and runs it in about 50 s; `pnpm test` leaves it out. The CI `core` job rebuilds `cell80.wasm`, checks it matches the committed file, caches the suite and runs it. It has not run yet, because the repository has no remote: tick the CI box after its first green run.
- Outside `src/cpu/`, only `src/run.ts` changed (3 lines): the CPU now owns its 64 KB, so the Run copies the Program into `cpu.memory` instead of handing over its own buffer.
