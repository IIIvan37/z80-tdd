Status: ready-for-agent

# The FantAMS Assembler: assemble a Program with FantAMS instead of RASM

## Problem Statement

z80-tdd assembles a Program with RASM only. A CPC project written for FantAMS (<https://github.com/sikorama/fantams>) cannot use z80-tdd: its syntax differs from RASM's (`repeat` counts from 0, `/` divides in floating point, parenthesized macro calls, `end` closes any block), so RASM refuses or misreads it.

## Solution

A second Assembler, `fantamsAssembler()`, set in `z80-tdd.config.ts` or given to `loadProgram()` like `rasmAssembler()`. It runs the `fantams` binary and reads its `.fo` object file, which lists the bytes of each block at the address it is stored at, and the symbol table. RASM stays the default.

## User Stories

1. As a CPC developer using FantAMS, I want to set `assembler: fantamsAssembler()` in my configuration file, so that every test file assembles with FantAMS.
2. As a CPC developer, I want `fantams` found on the PATH, or at a path from the project root, so that the configuration is the same as for RASM.
3. As a CPC developer, I want each byte loaded at the address FantAMS stores it at, so that the Program behaves as in the real binary.
4. As a CPC developer, I want my labels and EQU symbols, so that tests run Routines and point at buffers by name.
5. As a CPC developer, I want my INCLUDEs resolved as when I run `fantams` from the source file's folder, so that the sources need no change for the tests.
6. As a CPC developer, I want an assembly error to fail the test with FantAMS's message, file and line.
7. As a CPC developer, I want a missing `fantams` to fail with a message saying where to get it.
8. As a CPC developer, I want a clear failure when my source needs FantAMS's linker (sections without `org`, `extern`), so that I do not test bytes the linker would have changed.
9. As a CPC developer, I want a clear failure when I ask for a label that matches two labels differing only by case (`Loop` and `loop`), naming both, so that the test never runs the wrong one.

## Implementation Decisions

- **Label case (story 9).** A Program keeps looking labels up whatever their case (ADR 0006), for every Assembler. A name that matches several labels of the Assembly fails and names them all. ADR 0006 gets this consequence.
- **The `.fo` object file.** The adapter runs `fantams <source> -o <temporary folder>/program.fo`. Checked with FantAMS built at commit `a3c76c7` (`fantams --version`: `2026-09-08`):
  - The first line is `fantams-object 2`. Any other version fails, naming it.
  - Each `fragment` gives the address the block is stored at in `addr=` (the run address is `logical=`), then `data <site> <XX>…` lines of bytes. `gap <n>` lines are bytes an `align` skips without writing them; an `uninit` section has a fragment with no byte.
  - `symbol "<name>" label|const …  value=0x…`: labels and EQU symbols. Variables (`x = 3`) are not written.
  - Two fragments may share addresses (two `org #4000`); the later one wins, as when the linker places them in order.
- **Linking (story 8).** A fragment marked `unplaced`, or any `reloc` line, means the source needs the linker. The adapter refuses it.
- **Folder (story 5).** FantAMS opens an INCLUDE path as written, from the folder it runs in, even an INCLUDE inside an included file (`asm_main.cpp:91`, `pp.cpp:1530`). The adapter runs `fantams` in the source file's folder.
- **Errors.** A failure prints `<file>:<line>: error: <message>` (or `error (preproc):`) and exits with 1; a missing source file exits with 2 and `error: file not found: <path>`.
- **Distribution.** FantAMS has no release, no tag and no license file. z80-tdd does not bundle it, not even its WebAssembly build: the developer builds it (`make fantams`) and puts it on the PATH. CI builds it at a pinned commit.

## Testing Decisions

- Contract tests run the real `fantams` on fixtures, as the RASM contract tests do with `rasm`. FantAMS fixtures live in a folder of their own: FantAMS syntax is not RASM's.
- The label-case rule is tested through `loadProgram()` with the in-memory Assembler; it needs no FantAMS.

## Out of Scope

- FantAMS's linker: several `.fo` files, relocatable sections, `extern`/`public`.
- Banks (`bank=` other than `-1`) and FantAMS's `.sna`, `.dsk`, `.cpr` and `.cro` outputs.
- Bundling FantAMS or its WebAssembly build, until it has a license.
- Choosing the Assembler from the source's syntax.
