# 01: Walking skeleton: run a Routine and read its registers

**What to build:** A CPC developer can load a Program built from hand-written bytes and symbols, start a Run of a Routine by its label with chosen registers and flags, and read the registers and flags the Run left behind. This sets up the package, its tooling and the first end-to-end path: public API → Program → Run → CPU adapter on the `z80-emulator` core. See the spec: "Loading a Program", "Starting a Run", "Ending a Run", and ADRs 0001 and 0003.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The package builds with pnpm and TypeScript in strict mode; Vitest runs the tests; Biome checks lint and format.
- [x] dependency-cruiser fails the build on an import into another module's folder other than its `index.ts`, and on a test that imports past its module's interface.
- [x] GitHub CI runs typecheck, Biome, dependency-cruiser and the tests.
- [x] An in-memory Assembler, given bytes with their load addresses and a symbol table, produces a Program; the tests use it instead of RASM.
- [x] The Assembler and CPU interfaces exist, each in its own folder with the interface as `index.ts`; the CPU adapter wraps `z80-emulator`.
- [x] `loadProgram` returns a Program; the Program resolves a label to its address; an unknown label fails with a message naming it.
- [x] A Run starts from the deterministic initial state: all registers zero, RAM zero outside the Program, the Program at its addresses, SP at `#C000`, a sentinel return address pushed on the stack.
- [x] A test can set any 8-bit or 16-bit register, IX, IY, the shadow registers and individual flags before the Run, and can override SP for one Run.
- [x] A Run finishes when PC reaches the sentinel, whichever `RET` leads there, including after a `JP` to another routine that returns.
- [x] The Run result is frozen and gives every register and flag.
- [x] Each Run starts from a fresh machine: two Runs in a row do not affect each other.
- [x] `docs/MODULES.md` lists each module, its path and the decision it hides; `CODING_STANDARDS.md` already points to it.
