# Modules

Each module, where it lives, and the decision it hides. Rules: [CODING_STANDARDS.md](../CODING_STANDARDS.md). Vocabulary: [GLOSSARY.md](../GLOSSARY.md).

| Module | Path | Hides |
|---|---|---|
| Public API | `src/index.ts` | Which types and functions a CPC project may use; everything else is internal. |
| Program | `src/program.ts` | How an **Assembler**'s output is loaded into 64 KB of memory, which bytes it occupies, and how labels resolve to addresses. |
| Run | `src/run.ts` | How a **Routine** is entered and known to have returned (a sentinel return address pushed below SP, `#C000` by default, reached again with SP back in place), the initial machine state and its checks, the layout of the flag bits, and the shape of the frozen result. |
| Assembler | `src/assembler/` | The interface every assembler implements, and the in-memory Assembler that tests use instead of RASM. |
| NOPs | `src/nops.ts` | The CPC duration of each instruction, from Madram's tables (ADR 0002, credited in `CREDITS.md`), and how a conditional instruction's outcome is read from the state before it runs. |
| CPU | `src/cpu/` | Which Z80 core executes the code (cell80-z80 compiled to WebAssembly, built from `wasm/`, see ADR 0004), how its state maps onto our registers and internal state (WZ, IFF1, IFF2, IM, Q, HALT), and the list of register names and widths. Its contract test runs SingleStepTests/z80 (`pnpm test:core`). |
