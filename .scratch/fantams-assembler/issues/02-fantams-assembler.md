# 02: The FantAMS Assembler

**What to build:** A CPC developer can load a Program assembled by FantAMS, with its bytes at the addresses FantAMS stores them at and its labels and EQU symbols. Assembly errors, a source that needs the linker and a missing `fantams` produce clear failures. See the spec, stories 1–8, and the `.fo` notes.

**Blocked by:** 01 (two labels differing only by case).

**Status:** done

- [x] `fantamsAssembler()` implements the Assembler interface and is exported next to `rasmAssembler()`; nothing outside it knows about FantAMS.
- [x] It runs `fantams` found on the PATH, or at a path given from the project root, in the source file's folder, and writes the `.fo` to a temporary folder it removes.
- [x] It returns each fragment's bytes at its `addr=`, with `gap` lines left unoccupied, and the `label` and `const` symbols, in the case of the source.
- [x] A `.fo` version other than 2 fails, naming the version.
- [x] An `unplaced` fragment or a `reloc` line fails: the source needs FantAMS's linker.
- [x] A fragment stored in a bank fails: z80-tdd loads only the main 64 KB.
- [x] An assembly error fails with FantAMS's message, file and line.
- [x] A missing `fantams` fails with a message saying to build it from <https://github.com/sikorama/fantams> and put it on the PATH or give its path.
- [x] Contract tests run the real `fantams` on fixtures in a folder of their own: one routine, several `ORG` blocks, a block stored apart from where it runs, an EQU (a negative one too), blocks sharing addresses, an INCLUDE from the source's folder, an `align`, an `uninit` section, an error, a section without `org`, an `extern`, a bank.
- [x] CI builds FantAMS at a pinned commit (`a3c76c7` was checked) to run them.
- [x] The configuration file's message for a wrong `assembler` names both Assemblers.
- [x] README (install, configuration, limits) and docs/MODULES.md cover FantAMS; an ADR records why the adapter reads the `.fo` and runs in the source's folder.
