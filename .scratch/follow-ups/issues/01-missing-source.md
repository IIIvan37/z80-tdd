# 01: One message for a missing source file

**What to build:** `loadProgram()` fails with `The source file "<source>" does not exist` when the source file is not there, before it calls the Assembler, whatever the Assembler. See the spec, story 1 and the missing-source decision.

**Blocked by:** none.

**Status:** ready-for-agent

- [ ] `loadProgram()` checks the source resolved from the project root, and the message names the source as the configuration wrote it.
- [ ] A source in a folder that does not exist fails the same way.
- [ ] The FantAMS adapter always runs `fantams` in the source file's folder: the fallback to the project root goes.
- [ ] Tested through `loadProgram()` with the in-memory Assembler, and with `fantamsAssembler()` on a source in a missing folder.
- [ ] ADR 0010 drops its consequence about the fallback; README needs no change unless it describes the old messages.
