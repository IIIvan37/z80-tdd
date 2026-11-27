# FantAMS is read from its object file, run in the source file's folder

The FantAMS adapter runs `fantams <source> -o program.fo` and reads the `.fo` object: each fragment gives the address its bytes are stored at (`addr=`) and the bytes, and the `symbol` lines give the labels and EQU symbols. FantAMS has no listing, so a raw binary with `--sym` was the alternative: the binary fills the space between two ORG blocks with zeros, so it does not say which bytes the source wrote, and a Memory change or a failure report would not tell code from that filler.

Until its commit `f9303e1` (2026-11-12), FantAMS opened an INCLUDE path as written, from the folder it runs in, even inside an included file. The adapter thus runs it in the source file's folder, as `cd src && fantams main.asm` would. Running it from the project root was the other option, with INCLUDEs written from there. From `f9303e1`, FantAMS opens an INCLUDE from the folder of the file that includes it, as RASM does, and the folder it runs in no longer counts. The adapter still runs it in the source file's folder, which changes nothing for such a FantAMS. A nested INCLUDE written from the source file's folder, which the older FantAMS needed, now fails.

## Consequences

- The `.fo` format is FantAMS's own, at version 2 (commit `5b2ca65`). The adapter refuses any other version rather than misread it.
- An `align` writes a `gap` line: those bytes are not part of a block. An `uninit` section gives labels and no byte.
- A source that needs FantAMS's linker fails: a fragment `unplaced` (a section without ORG) or a `reloc` line (an extern symbol, or a jump into such a section). The bytes of such an object are not final.
- A fragment stored in a bank (`bank=` other than `-1`) fails: z80-tdd loads only the main 64 KB.
- FantAMS has no release, no tag and no licence file. z80-tdd does not bundle it, nor its WebAssembly build; CI builds it at a pinned commit.
- FantAMS tells `Loop` from `loop`; ADR 0006 covers two such labels.
