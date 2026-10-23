# The project root is the configuration file's folder

z80-tdd looks for `z80-tdd.config.ts` in the working directory, then in each folder above it, and stops at the first one it finds. That file's folder is the **project root**: `source`, and a path to `rasm` that holds a folder, start from there. Without a file, the root is the working directory. Reading the file from the working directory alone, as v1 first did, applied the defaults without a word when Vitest ran from a folder below the root, as an editor does for one test file. ESLint and Prettier search upward the same way. A search from each test file's folder, through Vitest's state, was the other option: it would find the right file in a monorepo run from its root, but it depends on Vitest internals being ready when `loadProgram()` runs.

## Consequences

- An **Assembler** receives the root: `assemble(source, root)`. `loadSettings` cannot make `source` absolute itself, because the in-memory Assembler looks a source up by its exact name.
- RASM resolves the `rasm` path when it assembles, not when `rasmAssembler()` builds it: the configuration file builds it before the root is known.
- The fallback to the working directory lives only in `loadSettings`.
- In a monorepo run from its root, a package's configuration file below the working directory is not found.
