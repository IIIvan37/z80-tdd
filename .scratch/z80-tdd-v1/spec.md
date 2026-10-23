Status: ready-for-agent

# z80-tdd v1: test Z80 routines of a CPC project, test-first

## Problem Statement

When I write Z80 assembly for an Amstrad CPC project, I have no way to check a routine except running the whole program in an emulator and looking at the screen or stepping through a debugger. I cannot write the expected behaviour down first, I cannot re-check every routine after a change, and I cannot pin down how many NOPs a routine takes, which matters for raster and game-loop code. The closest existing tool, DeZog's unit tests, targets sjasmplus and the ZX Spectrum, and does not measure time. Nothing targets the CPC or RASM.

## Solution

An npm package, `z80-tdd`, installed as a dev dependency of a CPC project. I write tests in TypeScript with Vitest, next to my CPC source. A test loads a **Program** (the project's source assembled by RASM), starts a **Run** of a **Routine** by its label with the registers and memory it needs, and checks what the Run left behind: registers, flags, **Memory changes**, **Port writes**, calls to **Stubs**, and the duration in **NOPs**. When a Run goes wrong, the failure shows the last instructions executed so I can see where it went.

## User Stories

### Loading a Program

1. As a CPC developer, I want to load a Program from my project's main source file with one call, so that a test file starts with no boilerplate.
2. As a CPC developer, I want the default source file to come from a configuration file at the root of my project, so that every test file uses the same Program without repeating its path.
3. As a CPC developer, I want a test file to name a different source file, so that I can test a project that produces several binaries.
4. As a CPC developer, I want the Program assembled from my real source files, never from copies, so that what I test is what I ship.
5. As a CPC developer, I want each byte of the Program loaded at the address RASM assembled it for, so that absolute addresses, tables and jumps behave as in the real program.
6. As a CPC developer, I want to get the address of any label in the Program, so that tests never hard-code an address.
7. As a CPC developer, I want a clear failure when I ask for a label that does not exist, naming the label, so that a typo or a renamed label is obvious.
8. As a CPC developer, I want a memory range expressed as a label and a length, so that I can point at a buffer by name.
9. As a CPC developer, I want an assembly error to fail the test with RASM's message, file and line, so that I fix the source without running RASM by hand.
10. As a CPC developer, I want the tool to find `rasm` on my PATH, so that I have nothing to configure in the usual case.
11. As a CPC developer, I want to give the path to `rasm` in the configuration file, so that I can use a specific RASM build.
12. As a CPC developer, I want a clear message when `rasm` cannot be found, saying where to download it, so that a fresh setup tells me what is missing.
13. As a CPC developer, I want the Program assembled once per test file rather than once per test, so that a test file with many tests stays fast.

### Starting a Run

14. As a CPC developer, I want to start a Run of a Routine by its entry label, so that the test reads like the code it exercises.
15. As a CPC developer, I want every register to start at zero unless my test sets it, so that a Run is deterministic and a test only states what matters to it.
16. As a CPC developer, I want to set any 8-bit or 16-bit register before a Run, including IX, IY and the shadow registers, so that I can call a Routine with its real inputs.
17. As a CPC developer, I want to set individual flags before a Run, so that I can test a Routine that reads the carry or zero flag on entry.
18. As a CPC developer, I want all RAM outside the Program to start at zero, so that a Run never depends on leftovers from another test.
19. As a CPC developer, I want to write bytes into memory before a Run, at a label or an address, so that I can prepare a buffer or a table.
20. As a CPC developer, I want SP to start at a default value (`#C000`, just below the CPC screen memory) that the configuration file or a test can change, so that the stack sits where my program expects.
21. As a CPC developer, I want each Run to start from a fresh machine, so that tests never affect one another.

### Ending a Run

22. As a CPC developer, I want a Run to finish when the Routine returns to the place it was called from, whichever `RET` gets it there, so that Routines with several conditional returns work.
23. As a CPC developer, I want a Run to finish correctly when the Routine ends with a `JP` to another routine that returns, so that tail calls work.
24. As a CPC developer, I want a Run stopped and the test failed when it exceeds its NOP limit, so that an infinite loop fails fast instead of hanging the test suite.
25. As a CPC developer, I want a default NOP limit (1,000,000 NOPs, one second of CPC time) set in the configuration file, so that I rarely think about it.
26. As a CPC developer, I want to set a different NOP limit for one Run, so that a long Routine or a tight timing test has the limit it needs.

### Checking the result

27. As a CPC developer, I want to read every register and flag after a Run, so that I can check a Routine's outputs.
28. As a CPC developer, I want to read memory after a Run, at a label or an address, so that I can check what a Routine wrote.
29. As a CPC developer, I want the Run to give me the list of Memory changes (address, old value, new value), so that I can see everything the Routine wrote.
30. As a CPC developer, I want to assert that only a given range changed, so that a buffer overflow or a stray write fails the test.
31. As a CPC developer, I want to assert that memory did not change at all, so that I can check a Routine that must be read-only.
32. As a CPC developer, I want Vitest matchers for these checks, so that failures print a readable diff instead of a bare boolean.
33. As a CPC developer, I want a Run's result to be frozen, so that reading it twice always gives the same answer.

### Measuring time

34. As a CPC developer, I want the duration of a Run in CPC NOPs, so that I can pin the timing of raster or game-loop code.
35. As a CPC developer, I want that duration to count from the Routine's first instruction to its final `RET` included, without the `CALL` the tool makes, so that the number matches how I count a Routine's cost.
36. As a CPC developer, I want the duration including the cost of the `CALL` too, so that I can check the full cost of calling a Routine.
37. As a CPC developer, I want conditional instructions counted according to whether the condition was met, so that branches cost what they cost on a CPC.
38. As a CPC developer, I want repeated block instructions (`LDIR`, `LDDR`, `CPIR`, `OTIR`…) counted per iteration, so that a block copy costs what it costs on a CPC.
39. As a CPC developer, I want the NOP counts to match Madram's "Perfectly accurate Z80 flags and CPC timing" for every instruction, so that I can trust the number against real hardware.

### Ports

40. As a CPC developer, I want every `OUT` recorded as a Port write with its full 16-bit port address and its value, in order, so that I can check what a Routine sent to the CRTC or the Gate Array.
41. As a CPC developer, I want to give, for each port, a sequence of values that `IN` returns in order, so that I can simulate hardware a Routine polls, such as waiting for VSYNC.
42. As a CPC developer, I want to give, for a port, a function that computes the value read, so that I can simulate hardware whose answer depends on what the Routine did.
43. As a CPC developer, I want a Port read from a port I did not supply, or past the end of its sequence, to fail the Run with the port address and the PC, so that the tool never invents a value silently.

### Stubs

44. As a CPC developer, I want to declare a Stub at a label, so that the Routine under test does not run code I am not testing, such as `play_sound`.
45. As a CPC developer, I want to declare a Stub at an address, so that a call into the firmware (for example `#BB5A`) returns instead of running zeros, since the ROM is not loaded.
46. As a CPC developer, I want a Stub to set chosen registers when it returns, so that I can simulate what the stubbed code would have returned.
47. As a CPC developer, I want every call to a Stub recorded with the registers at the moment of the call, so that I can check that `play_sound` was called once with `A=3`.
48. As a CPC developer, I want a Stub call to cost the price of a `RET` (3 NOPs) by default, on top of the `CALL` the Routine already paid, so that the total stays close to reality.
49. As a CPC developer, I want to give a Stub a different duration, so that I can check the timing of a game loop whose callees I have measured elsewhere.

### Failures

50. As a CPC developer, I want a failed Run to show the last 16 instructions executed, disassembled, each with its address and the nearest label, so that I can see where the Routine went wrong.
51. As a CPC developer, I want a failed Run to show the final registers, so that I can see the state at the point of failure.
52. As a CPC developer, I want a Run that hits its NOP limit to say so explicitly, with the limit, so that I can tell a loop from a wrong result.

### Configuration and installation

53. As a CPC developer, I want to install `z80-tdd` as an npm dev dependency with no native compilation, so that it works on Linux, macOS and Windows alike.
54. As a CPC developer, I want a typed configuration file at my project root (`z80-tdd.config.ts`) holding the Assembler and its path, the default source file, the default SP and the default NOP limit, so that project-wide settings live in one place.
55. As a CPC developer, I want any configuration value overridable for a single Run or test file, so that one special case does not change the defaults.

### Maintainer

56. As the maintainer, I want the Assembler behind an interface, with RASM as its first adapter, so that I can support another assembler later without touching the Run.
57. As the maintainer, I want the Z80 core behind a CPU interface, so that I can replace it if it proves wrong.
58. As the maintainer, I want the core validated against the SingleStepTests/z80 suite in CI, so that I trust it before relying on it.
59. As the maintainer, I want the NOP table owned by the tool and independent of the core, so that changing the core never changes the timing.
60. As the maintainer, I want the folder tree to follow the module seams, checked by dependency-cruiser, so that the structure does not drift.

## Implementation Decisions

- **Language and runtime.** TypeScript in strict mode, tests with Vitest, pnpm, Biome for lint and format. One npm package, `z80-tdd`. See ADR 0001.
- **Z80 core.** Reuse the pure-JavaScript `z80-emulator` package behind a CPU interface. Its adapter must pass SingleStepTests/z80 before the rest of the tool relies on it. If it fails, replace the core or write one, without touching other modules. *Amended during ticket 02: the core is now cell80-z80 compiled to WebAssembly, see ADR 0004.*
- **NOP counting.** The tool looks up each executed instruction in its own CPC NOP table, derived from Madram's tables, with separate values for conditions met and not met, and per-iteration values for repeated block instructions. It never converts T-states from the core. See ADR 0002. Credit Madram / Overlanders in the package, as the source asks.
- **Assembler interface.** It takes a source file (and include paths) and returns either the assembled bytes with their load addresses and the symbol table, or the assembler's errors with file and line. RASM is the first adapter: it runs the `rasm` binary found on the PATH or at the configured path, and reads RASM's symbol export.
- **Program.** It holds the assembled bytes and the symbol table. It resolves labels to addresses and label-plus-length to ranges. It is built once per test file and is the only way to start a Run.
- **Run semantics.**
  - **Initial state**: all registers zero, RAM zero outside the Program, the Program loaded at its addresses, SP at the configured default, and a sentinel return address pushed on the stack. The test then applies its own registers, flags and memory.
  - **Execution**: steps the CPU until PC reaches the sentinel (success) or the NOP count exceeds the NOP limit (failure).
  - **Result**: frozen; gives registers, flags, memory, the list of Memory changes, the ordered list of Port writes, the Stub calls, and the duration in NOPs (entry to `RET` included, without the `CALL`), plus the duration including the `CALL`.
- **Ports.** `OUT` appends a Port write with the full 16-bit port address and the value. `IN` takes the next value from the test's sequence for that port, or calls the test's function for it. An unsupplied port or an exhausted sequence fails the Run, naming the port and the PC. *Amended during ticket 07: a Port read matches the port address under the Port mask, `#FF00` by default, see ADR 0007.*
- **Stubs.** Declared by label or address for one Run. When PC reaches a Stub, the tool records the call and the registers, applies the Stub's chosen output registers, adds the Stub's duration (default 3 NOPs, the cost of `RET`) and returns to the caller.
- **Failure report.** The Run keeps the last 16 instructions executed. On failure (NOP limit, unsupplied port, unknown label), the message shows them disassembled, each with its address and nearest label, plus the final registers. *Amended during ticket 08: a label the Program does not have fails before the first step, without the report, since no instruction has run; a Stub call shows as a `Stub` line among the last instructions.*
- **Configuration.** A typed `z80-tdd.config.ts` at the CPC project root: Assembler and its path, default source file, default SP (`#C000`), default NOP limit (1,000,000). A test file can name another source file, and a Run can override SP and the NOP limit. *Amended during ticket 07: the Port mask (`#FF00`) is a setting too, which a Run can override, see ADR 0007.*
- **Public API.** `loadProgram` returns a `Program`. `program.run(label, options)` returns a frozen Run result. The `Program` gives `address` (of a label) and `range` helpers. The in-memory Assembler is public too, so a CPC project can test a few hand-written bytes without RASM; the tool's own tests use it the same way. A set of Vitest matchers covers "only this range changed", "memory unchanged" and readable register comparisons.
- **Module structure.** Per ADR 0003 and `CODING_STANDARDS.md`: a module is a file until it gains an internal seam. The planned modules are the public API, `program`, `run`, `nops`, `matchers`, and two folders from day one, `assembler` (interface plus the RASM adapter) and `cpu` (interface plus the core adapter). dependency-cruiser forbids imports into another module's folder other than its `index.ts`, and test imports past a module's interface. `docs/MODULES.md` is created with the first code and lists each module, its path and the decision it hides.
- **Repository.** Private GitHub repository `IIIvan37/z80-tdd` for now, MIT licence. GitHub CI runs the tests, including SingleStepTests and the RASM contract tests. Publish to npm once a version is usable in `green-beret-cpc`.

## Testing Decisions

- **A good test checks external behaviour only**: what a CPC developer can observe through the public API. It never reaches into a module's internals and never asserts on how the tool computes a result.
- **One main seam: the public API.** Almost all tests go through `loadProgram` → `Program` → `run` → the Run result and the matchers. They inject an in-memory Assembler, built from hand-written bytes and symbols, so they need no RASM. They use the real Z80 core, which is fast and deterministic. This seam covers Run semantics, Stubs, Port reads and writes, Memory changes, the NOP limit, the sentinel, failure reports, label resolution and configuration overrides.
- **The NOP table is tested at the main seam too**: for each instruction, inject its bytes, run it, and compare the NOP count to Madram's value, covering both outcomes of conditional instructions and the per-iteration cost of block instructions. It has no seam of its own.
- **Contract seam: Assembler → RASM.** Assemble small `.asm` fixtures with the real `rasm` and check bytes, load addresses, symbols, and the error report with file and line. These tests need `rasm` installed in CI.
- **Contract seam: CPU → core.** Run the SingleStepTests/z80 suite against the CPU adapter.
- **No other module gets its own tests.** `program`, `run`, `nops` and `matchers` are tested through the public API.
- **Prior art.** None in this repository yet; the first tests set the pattern. For the shape of a test, see the example agreed during design: load the Program in `beforeAll`, start a Run by label with registers, then assert registers, NOPs and "only this range changed".

## Out of Scope

- ROM and firmware, memory banking, video, interrupts. A Routine that waits for an interrupt (for example `HALT` with interrupts expected) hits its NOP limit.
- CPC decoding of Port writes into CRTC registers or Gate Array commands. Port writes stay raw in v1; decoding comes later as a layer on top.
- Assemblers other than RASM. The Assembler interface allows them later.
- Test files written in assembly or in a declarative format.
- Code coverage of Routines, a standalone CLI runner outside Vitest, and publication to npm.
- The `hexagonal-tdd-starter` layout and its tooling: Sheriff, mutation testing, coverage thresholds, knip, jscpd.

## Further Notes

- Domain vocabulary: `GLOSSARY.md`. Decisions: ADR 0001 (TypeScript with a pure-JavaScript core), ADR 0002 (NOPs from our own CPC table), ADR 0003 (folder tree follows module seams).
- Madram's timing source, as copied in the author's `cpc/z80-timing/` reference, is only partly machine-readable: mnemonics are patterns rather than opcodes, some values are free text (for example "6 / 5 for last iteration"), and `ld (ix+n),n` is missing. `flags.md`'s opcode bit patterns are the easiest base for a per-opcode table. The rule behind the table: a NOP count is the sum of each machine cycle's T-states rounded up to a multiple of 4, except `OUT (C),r`, and an IX/IY prefix without indirection adds 1 NOP.
- The local RASM documentation describes v3.2; RASM is at v3.3.1. Check the symbol export format against the installed version.
