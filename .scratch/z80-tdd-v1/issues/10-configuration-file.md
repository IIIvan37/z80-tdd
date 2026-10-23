# 10: The configuration file

**What to build:** A CPC developer keeps project-wide settings in a typed configuration file at the project root, and `loadProgram()` with no argument uses them. Any value can still be overridden for a test file or a Run. See the spec, stories 2–3, 11, 20, 25, 54–55.

**Blocked by:** 06 (NOP limit and failure report), 09 (The RASM Assembler).

**Status:** done

- [x] A typed `z80-tdd.config.ts` at the CPC project root holds the Assembler and its path, the default source file, the default SP and the default NOP limit.
- [x] `loadProgram()` with no argument assembles the configured default source file with the configured Assembler.
- [x] A test file can name another source file.
- [x] A Run can override SP and the NOP limit.
- [x] Without a configuration file, the defaults apply (`rasm` on the PATH, SP `#C000`, 1,000,000 NOPs), and `loadProgram()` without a source file fails with a message saying what to configure.
- [x] An invalid configuration fails with a message naming the faulty setting.
