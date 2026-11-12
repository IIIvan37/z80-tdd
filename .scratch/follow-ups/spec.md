Status: ready-for-agent

# Follow-ups of the FantAMS step: a missing source, a negative EQU, NOPs against cell80

## Problem Statement

Three loose ends were left open when the FantAMS Assembler shipped (PR #6):

- A missing source file fails differently with each Assembler. RASM fails inside the file that includes the source; FantAMS runs from the project root when the source's folder is missing, only so that `fantams` reports it.
- A negative EQU symbol has two values: `minus equ -16` gives -16 with FantAMS and 0xFFFFFFF0 (4 294 967 280) with RASM.
- Nothing checks `nops.ts` against the CPU core. A throwaway tool measured on 2026-10-24 that cell80, with its clock aligned on 4 T-states at each bus access and at the end of each instruction, agrees with the table on 3 524 cases out of 3 560. The 36 others are `IN r,(C)`, `OUT (C),r` and repeated `OTIR` and `OTDR`. That tool is gone.

## Solution

- The Assemblers that read a file check that the source file exists before they run their tool, through one function of the Assembler module, and fail with one message. The FantAMS adapter always runs in the source file's folder.
- Every Assembler gives a symbol its signed value: the RASM adapter reads its symbol export as a signed 32-bit number.
- The WebAssembly build of cell80 counts T-states, aligned as measured, and exposes them. A test of `pnpm test:core` compares each instruction's NOPs in `nops.ts` with that count, the 36 known differences listed.

## User Stories

1. As a CPC developer, I want a test to fail with `The source file "<source>" does not exist` when my configuration names a source file that is not there, whatever the Assembler, so that I fix the path without reading an Assembler's output.
2. As a CPC developer, I want an EQU symbol with a negative value to give that negative value, whatever the Assembler, so that a test reads the same number from RASM and FantAMS.
3. As the maintainer of z80-tdd, I want a test to fail when `nops.ts` and the cell80 core disagree on an instruction outside the known differences, so that a wrong entry in the table, or a change in the core, shows up.

## Implementation Decisions

- **Missing source (story 1).** The check cannot sit in `loadProgram()`: the in-memory Assembler reads no file, and its tests name a source that is not on disk. One function of the Assembler module resolves the source from the project root (ADR 0008) and fails when it is not there; the RASM and FantAMS adapters call it before running their tool. The message names the source as the configuration wrote it. The FantAMS adapter drops its fallback to the project root, and ADR 0010 drops its consequence line about it.
- **Signed symbols (story 2).** RASM writes `-16` as `#FFFFFFF0` in its symbol export. The RASM adapter reads it as a signed 32-bit number, so `#FFFFFFF0` gives -16 and `#12345` stays #12345. FantAMS already writes `value=-0x10`. ADR 0006 states that a symbol's value is signed.
- **Clock (story 3).**
  - The Rust bus in `wasm/src/lib.rs` counts the T-states `tick()` gives, aligns the count up to a multiple of 4 at each bus access (`read`, `write`, `input`, `output`) and at the end of each instruction, and exposes the count to `src/cpu/cell80.ts`. The rules come from the 2026-10-24 report; the implementer checks where cell80 calls `tick()` relative to each access.
  - Only the test reads the count: a Run keeps reading its NOPs from `nops.ts` (ADR 0002).
  - `cell80.wasm` is rebuilt with `pnpm build:wasm` and committed; CI checks it matches its source.
  - ADR 0002 gets a consequence: a test compares the table with the cell80 clock, and lists the known differences.

## Testing Decisions

- Story 1 is tested by the contract tests of both adapters: a missing source file, and a source in a missing folder.
- Story 2 is tested by the RASM contract tests on a fixture with a negative EQU; the FantAMS contract test already covers it.
- Story 3 is a test of `pnpm test:core`, which runs on the SingleStepTests suite already fetched there: each case gives an instruction and the state before it, which is what `nops.ts` needs.

## Out of Scope

- Changing `nops.ts` to match cell80, or cell80 to match `nops.ts`: the table stays the reference for CPC timing (ADR 0002).
- Contention, video timing and interrupts.
- A missing file named by an INCLUDE: each Assembler reports it.
