# TypeScript with a pure-JavaScript Z80 core

> Amended by [ADR 0004](0004-cell80-z80-core-as-webassembly.md): the core is now cell80-z80 compiled to WebAssembly. The reason below, no native compilation at install, still holds.

We write the tool in TypeScript, with tests run by Vitest, and reuse a pure-JavaScript Z80 core such as `z80-emulator`, even though the strongest core we found is the C++ `z80` package for Python (kosarev). We chose the option simplest to install: `z80` 1.2.0 ships prebuilt wheels only for Linux x86 and Windows on Python 3.10–3.13, so macOS, Linux ARM and Python 3.14 users would have to compile C++, while a pure-JavaScript core installs with `npm install` wherever Node runs. TypeScript is also the language of the author's other CPC tools.

## Consequences

The core sits behind a CPU interface and must pass the SingleStepTests/z80 suite before we trust it. If it fails, we replace it or write our own, without touching the rest of the tool.
