# FantAMS is read from its object file, run in the source file's folder

The FantAMS adapter runs `fantams <source> -o program.fo` and reads the `.fo` object: each fragment gives the address its bytes are stored at (`addr=`) and the bytes, and the `symbol` lines give the labels and EQU symbols. FantAMS has no listing, so a raw binary with `--sym` was the alternative: the binary fills the space between two ORG blocks with zeros, so it does not say which bytes the source wrote, and a Memory change or a failure report would not tell code from that filler.

FantAMS opens an INCLUDE path as written, from the folder it runs in, even inside an included file (`asm_main.cpp:91`, `pp.cpp:1530`). The adapter runs it in the source file's folder, as `cd src && fantams main.asm` would; RASM, which opens an INCLUDE from the including file, needs no such choice. Running it from the project root was the other option, with INCLUDEs written from there.

## Consequences

- The `.fo` format is FantAMS's own, at version 2 (commit `a3c76c7`). The adapter refuses any other version rather than misread it.
- An `align` writes a `gap` line: those bytes are not part of a block. An `uninit` section gives labels and no byte.
- A source that needs FantAMS's linker fails: a fragment `unplaced` (a section without ORG) or a `reloc` line (an extern symbol, or a jump into such a section). The bytes of such an object are not final.
- A fragment stored in a bank (`bank=` other than `-1`) fails: z80-tdd loads only the main 64 KB.
- When the source file's folder does not exist, `fantams` runs from the project root and reports the missing source itself.
- FantAMS has no release, no tag and no licence file. z80-tdd does not bundle it, nor its WebAssembly build; CI builds it at a pinned commit.
- FantAMS tells `Loop` from `loop`; ADR 0006 covers two such labels.
